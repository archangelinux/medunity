'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Plus, Loader2, WifiOff } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { EntryBar } from '@/components/feed/EntryBar';
import { EntryCard } from '@/components/feed/EntryCard';
import { HealthStatus } from '@/components/overview/HealthStatus';
import { EntryHistory } from '@/components/overview/EntryHistory';
import { SymptomFrequency } from '@/components/overview/SymptomFrequency';
import { PatternAlertCard } from '@/components/overview/PatternAlert';
import { TreatmentTracker } from '@/components/overview/TreatmentTracker';
import { CareRoutingPanel } from '@/components/triage/CareRoutingPanel';
import {
  getEntries,
  createEntry,
  respondToEntry,
  deleteEntry,
  getCareRouting,
  getOverview,
} from '@/lib/api';
import type { HealthEntry, Clinic, Treatment } from '@/lib/types';
import type { OverviewData } from '@/lib/api';

function FeedContent({
  entries,
  submitting,
  onSubmit,
  onFindCare,
  onRespond,
  onDelete,
}: {
  entries: HealthEntry[];
  submitting: boolean;
  onSubmit: (text: string) => void;
  onFindCare: (ctasLevel?: number) => void;
  onRespond: (entryId: string, message: string, resolve?: boolean) => Promise<void>;
  onDelete: (entryId: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <EntryBar onSubmit={onSubmit} submitting={submitting} />
      {entries.length === 0 && !submitting && (
        <div className="bg-surface rounded-[var(--radius-lg)] shadow-sm p-8 text-center">
          <p className="text-[0.9375rem] font-medium text-text-secondary">No entries yet</p>
          <p className="text-[0.8125rem] text-text-tertiary mt-1">
            Describe how you're feeling to get started
          </p>
        </div>
      )}
      {entries.map((entry) => (
        <EntryCard
          key={entry.id}
          entry={entry}
          onFindCare={() => onFindCare(entry.ctasLevel)}
          onRespond={onRespond}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function OverviewContent({
  entries,
  overview,
  onFindCare,
}: {
  entries: HealthEntry[];
  overview: OverviewData | null;
  onFindCare: () => void;
}) {
  const entryCount = overview?.entryCount ?? entries.length;
  const avgCtas = overview?.avgCtas ?? (entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + (e.ctasLevel || 0), 0) / entries.length)
    : 0);
  const summary = overview?.summary;
  const symptomFrequency = overview?.symptomFrequency ?? [];
  const patternAlert = overview?.patternAlert ?? null;

  // Build treatments from entries that have recommended_action
  const treatments: Treatment[] = [];

  return (
    <div className="space-y-1.5">
      <HealthStatus
        entryCount={entryCount}
        avgCtas={avgCtas}
        summary={summary}
      />
      {patternAlert && (
        <PatternAlertCard
          alert={patternAlert}
          onFindCare={onFindCare}
        />
      )}
      <EntryHistory entries={entries} />
      {symptomFrequency.length > 0 && (
        <SymptomFrequency data={symptomFrequency} />
      )}
      {treatments.length > 0 && (
        <TreatmentTracker treatments={treatments} />
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'feed' | 'overview'>('feed');
  const [showCareRouting, setShowCareRouting] = useState(false);
  const [entries, setEntries] = useState<HealthEntry[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [fetchedEntries, overviewData] = await Promise.all([
          getEntries(),
          getOverview(),
        ]);
        if (!cancelled) {
          setEntries(fetchedEntries);
          setOverview(overviewData);
        }
      } catch {
        if (!cancelled) {
          setError('Could not connect to the server. Make sure the backend is running.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [user]);

  const refreshOverview = useCallback(async () => {
    try {
      const data = await getOverview();
      setOverview(data);
    } catch { /* silent */ }
  }, []);

  const handleSubmit = async (text: string) => {
    setSubmitting(true);
    try {
      const result = await createEntry(text);
      const entryWithQuestions = {
        ...result.entry,
        triageQuestions: result.triageQuestions,
      };
      setEntries((prev) => [entryWithQuestions, ...prev]);
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
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? result.entry : e))
      );
      await refreshOverview();
    } catch (err) {
      console.error('Failed to respond:', err);
    }
  };

  const handleDelete = async (entryId: string) => {
    try {
      await deleteEntry(entryId);
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      await refreshOverview();
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  const handleFindCare = async (ctasLevel?: number) => {
    if (ctasLevel) {
      try {
        const routedClinics = await getCareRouting(ctasLevel);
        if (routedClinics.length > 0) setClinics(routedClinics);
      } catch { /* fallback */ }
    }
    setShowCareRouting(true);
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={24} className="animate-spin text-accent mx-auto mb-3" />
          <p className="text-[0.875rem] text-text-secondary">Loading your health data...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
    <div className="min-h-screen">
      <main className="max-w-6xl mx-auto px-3 md:px-4 pb-20 md:pb-4 pt-4">
        {/* Desktop: two-column layout */}
        <div className="hidden md:grid md:grid-cols-[2fr_3fr] gap-2 items-start">
          <div className="sticky top-4">
            <OverviewContent
              entries={entries}
              overview={overview}
              onFindCare={() => handleFindCare(4)}
            />
          </div>
          <FeedContent
            entries={entries}
            submitting={submitting}
            onSubmit={handleSubmit}
            onFindCare={handleFindCare}
            onRespond={handleRespond}
            onDelete={handleDelete}
          />
        </div>

        {/* Mobile: tabbed layout */}
        <div className="md:hidden">
          <div className="flex gap-1 mb-3 bg-surface rounded-[var(--radius-md)] p-1 shadow-sm">
            <button
              onClick={() => setActiveTab('feed')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-[var(--radius-sm)] text-[0.8125rem] font-medium transition-colors cursor-pointer ${activeTab === 'feed' ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              <Plus size={16} />
              Feed
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-[var(--radius-sm)] text-[0.8125rem] font-medium transition-colors cursor-pointer ${activeTab === 'overview' ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
            >
              <Activity size={16} />
              Overview
            </button>
          </div>

          {activeTab === 'feed' ? (
            <FeedContent
              entries={entries}
              submitting={submitting}
              onSubmit={handleSubmit}
              onFindCare={handleFindCare}
              onRespond={handleRespond}
              onDelete={handleDelete}
            />
          ) : (
            <OverviewContent
              entries={entries}
              overview={overview}
              onFindCare={() => handleFindCare(4)}
            />
          )}
        </div>
      </main>

      {showCareRouting && (
        <CareRoutingPanel
          clinics={clinics}
          onClose={() => setShowCareRouting(false)}
        />
      )}
    </div>
  );
}
