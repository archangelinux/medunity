'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Plus, Loader2, WifiOff } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { EntryBar } from '@/components/feed/EntryBar';
import { EntryCard } from '@/components/feed/EntryCard';
import { HealthStatus, HealthSummary } from '@/components/overview/HealthStatus';
import { EntryHistory } from '@/components/overview/EntryHistory';
import { SymptomFrequency } from '@/components/overview/SymptomFrequency';
import {
  getEntries,
  createEntry,
  respondToEntry,
  deleteEntry,
  getOverview,
} from '@/lib/api';
import type { HealthEntry } from '@/lib/types';
import type { OverviewData } from '@/lib/api';

// Module-level cache so data persists across navigations
let cachedEntries: HealthEntry[] | null = null;
let cachedOverview: OverviewData | null = null;

export default function DashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'feed' | 'overview'>('feed');
  const [entries, setEntries] = useState<HealthEntry[]>(cachedEntries ?? []);
  const [overview, setOverview] = useState<OverviewData | null>(cachedOverview);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(cachedEntries === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    async function fetchData() {
      // Only show loading spinner on cold start (no cached data)
      if (!cachedEntries) setLoading(true);
      setError(null);
      try {
        const [fetchedEntries, overviewData] = await Promise.all([
          getEntries(),
          getOverview(),
        ]);
        if (!cancelled) {
          setEntries(fetchedEntries);
          setOverview(overviewData);
          cachedEntries = fetchedEntries;
          cachedOverview = overviewData;
        }
      } catch {
        if (!cancelled && !cachedEntries) {
          setError('Could not connect to the server. Make sure the backend is running.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [user]);

  const updateEntries = useCallback((updater: (prev: HealthEntry[]) => HealthEntry[]) => {
    setEntries((prev) => {
      const next = updater(prev);
      cachedEntries = next;
      return next;
    });
  }, []);

  const refreshOverview = useCallback(async () => {
    try {
      const data = await getOverview();
      setOverview(data);
      cachedOverview = data;
    } catch { /* silent */ }
  }, []);

  const handleSubmit = async (text: string) => {
    setSubmitting(true);
    try {
      const result = await createEntry(text);
      updateEntries((prev) => [{ ...result.entry, triageQuestions: result.triageQuestions }, ...prev]);
      await refreshOverview();
    } catch (err) {
      console.error('Failed to create entry:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespond = async (entryId: string, message: string, resolve: boolean = false) => {
    try {
      const result = await respondToEntry(entryId, message, resolve);
      updateEntries((prev) => prev.map((e) => (e.id === entryId ? result.entry : e)));
      await refreshOverview();
    } catch (err) {
      console.error('Failed to respond:', err);
    }
  };

  const handleDelete = async (entryId: string) => {
    try {
      await deleteEntry(entryId);
      updateEntries((prev) => prev.filter((e) => e.id !== entryId));
      await refreshOverview();
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  // Derived overview values
  const entryCount = overview?.entryCount ?? entries.length;
  const avgCtas = overview?.avgCtas ?? (entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + (e.ctasLevel || 0), 0) / entries.length)
    : 0);
  const symptomFrequency = overview?.symptomFrequency ?? [];
  const patternAlert = overview?.patternAlert ?? null;

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={24} className="animate-spin text-accent mx-auto mb-3" />
          <p className="text-[0.875rem] text-text-secondary">Loading your health data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-sm">
          <WifiOff size={32} className="text-text-tertiary mx-auto mb-3" />
          <p className="text-[0.9375rem] font-medium text-text-secondary">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-5 py-2 rounded-[var(--radius-sm)] bg-accent text-white text-[0.875rem] font-semibold hover:bg-accent-hover transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Desktop: fixed left overview panel */}
      <div className="hidden md:flex md:flex-col md:w-[380px] md:flex-shrink-0 h-full overflow-hidden pl-2 pr-1 pt-3 pb-2 space-y-1.5">
        <HealthStatus entryCount={entryCount} avgCtas={avgCtas} />
        <HealthSummary entryCount={entryCount} patternAlert={patternAlert} onFindCare={() => {
          const ids = patternAlert?.relatedEntryIds ?? [];
          const params = ids.length > 0 ? `?patternEntryIds=${ids.join(',')}` : '';
          window.location.href = `/locations${params}`;
        }} />
        <EntryHistory entries={entries} maxVisible={3} />
        <SymptomFrequency data={symptomFrequency} />
      </div>

      {/* Desktop: right feed panel — single unified card */}
      <div className="hidden md:flex md:flex-col flex-1 h-screen overflow-hidden pl-1 pr-2 pt-3 pb-2">
        <div className="flex flex-col flex-1 bg-surface rounded-[var(--radius-lg)] shadow-sm overflow-hidden">
          {/* Pinned input */}
          <div className="flex-shrink-0 p-4 pb-5">
            <EntryBar onSubmit={handleSubmit} submitting={submitting} />
          </div>

          {/* Scrollable entries */}
          <div className="flex-1 overflow-y-auto">
            {submitting && (
              <div className="flex items-center gap-3 px-5 py-3 bg-accent-soft/50 border-b border-accent/10">
                <Loader2 size={15} className="animate-spin text-accent" />
                <span className="text-[0.8125rem] text-accent font-medium">
                  Evaluating concern, generating triage survey...
                </span>
              </div>
            )}
            {entries.length === 0 && !submitting && (
              <div className="p-8 text-center">
                <p className="text-[0.9375rem] font-medium text-text-secondary">No entries yet</p>
                <p className="text-[0.8125rem] text-text-tertiary mt-1">
                  Describe how you&apos;re feeling to get started
                </p>
              </div>
            )}
            {entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onRespond={handleRespond}
                onDelete={handleDelete}
                onEntryUpdated={(updated) => {
                  updateEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
                  refreshOverview();
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: tabbed layout */}
      <div className="md:hidden flex-1 overflow-y-auto px-2 pt-3 pb-20">
        <div className="flex gap-1 mb-3 bg-surface rounded-[var(--radius-md)] p-1 shadow-sm">
          <button
            onClick={() => setActiveTab('feed')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-[var(--radius-sm)] text-[0.8125rem] font-medium transition-colors cursor-pointer ${activeTab === 'feed' ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
          >
            <Plus size={16} /> Feed
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-[var(--radius-sm)] text-[0.8125rem] font-medium transition-colors cursor-pointer ${activeTab === 'overview' ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
          >
            <Activity size={16} /> Overview
          </button>
        </div>

        {activeTab === 'feed' ? (
          <div>
            <div className="mb-3">
              <EntryBar onSubmit={handleSubmit} submitting={submitting} />
            </div>
            {submitting && (
              <div className="flex items-center gap-3 px-4 py-3 mb-2 rounded-[var(--radius-md)] bg-accent-soft/50">
                <Loader2 size={15} className="animate-spin text-accent" />
                <span className="text-[0.8125rem] text-accent font-medium">
                  Evaluating concern, generating triage survey...
                </span>
              </div>
            )}
            {entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onRespond={handleRespond}
                onDelete={handleDelete}
                onEntryUpdated={(updated) => {
                  updateEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
                  refreshOverview();
                }}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            <HealthStatus entryCount={entryCount} avgCtas={avgCtas} />
            <HealthSummary entryCount={entryCount} patternAlert={patternAlert} onFindCare={() => {
              const ids = patternAlert?.relatedEntryIds ?? [];
              const params = ids.length > 0 ? `?patternEntryIds=${ids.join(',')}` : '';
              window.location.href = `/locations${params}`;
            }} />
            <SymptomFrequency data={symptomFrequency} />
            <EntryHistory entries={entries} />
          </div>
        )}
      </div>

    </div>
  );
}
