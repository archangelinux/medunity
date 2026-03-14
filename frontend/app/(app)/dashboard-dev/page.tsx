'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, Plus } from 'lucide-react';
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
  demoEntries,
  demoClinics,
  demoTreatments,
  demoPatternAlert,
  demoSymptomFrequency,
} from '@/lib/demo-data';
import {
  getEntries,
  createEntry,
  respondToEntry,
  getCareRouting,
  getOverview,
} from '@/lib/api';
import type { HealthEntry, Clinic } from '@/lib/types';
import type { OverviewData } from '@/lib/api';

function FeedContent({
  entries,
  submitting,
  apiAvailable,
  onSubmit,
  onFindCare,
  onRespond,
}: {
  entries: HealthEntry[];
  submitting: boolean;
  apiAvailable: boolean;
  onSubmit: (text: string) => void;
  onFindCare: (ctasLevel?: number) => void;
  onRespond: (entryId: string, message: string) => Promise<void>;
}) {
  return (
    <div className="space-y-1.5">
      <EntryBar onSubmit={onSubmit} submitting={submitting} />
      {entries.map((entry) => (
        <EntryCard
          key={entry.id}
          entry={entry}
          onFindCare={() => onFindCare(entry.ctasLevel)}
          onRespond={apiAvailable ? onRespond : undefined}
        />
      ))}
    </div>
  );
}

function OverviewContent({
  entries,
  overview,
  apiAvailable,
  onFindCare,
}: {
  entries: HealthEntry[];
  overview: OverviewData | null;
  apiAvailable: boolean;
  onFindCare: () => void;
}) {
  const hasRealData = apiAvailable && overview && overview.entryCount > 0;
  const entryCount = hasRealData ? overview.entryCount : entries.length;
  const avgCtas = hasRealData ? overview.avgCtas : Math.round(entries.reduce((s, e) => s + (e.ctasLevel || 0), 0) / (entries.length || 1));
  const summary = (hasRealData && overview.summary) ? overview.summary : undefined;
  const symptomFrequency = (hasRealData && overview.symptomFrequency?.length) ? overview.symptomFrequency : demoSymptomFrequency;
  const patternAlert = (hasRealData ? overview.patternAlert : null) ?? demoPatternAlert;

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
      <TreatmentTracker treatments={demoTreatments} />
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'feed' | 'overview'>('feed');
  const [showCareRouting, setShowCareRouting] = useState(false);
  const [entries, setEntries] = useState<HealthEntry[]>(demoEntries);
  const [clinics, setClinics] = useState<Clinic[]>(demoClinics);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function fetchData() {
      try {
        const [fetchedEntries, overviewData] = await Promise.all([
          getEntries(),
          getOverview(),
        ]);
        setEntries(fetchedEntries.length > 0 ? fetchedEntries : demoEntries);
        setOverview(overviewData);
        setApiAvailable(true);
      } catch {
        setApiAvailable(false);
      }
    }
    fetchData();
  }, [user]);

  const refreshOverview = useCallback(async () => {
    if (!apiAvailable) return;
    try {
      const data = await getOverview();
      setOverview(data);
    } catch { /* silent */ }
  }, [apiAvailable]);

  const handleSubmit = async (text: string) => {
    if (!apiAvailable) return;
    setSubmitting(true);
    try {
      const result = await createEntry(text);
      setEntries((prev) => [result.entry, ...prev]);
      refreshOverview();
    } catch (err) {
      console.error('Failed to create entry:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRespond = async (entryId: string, message: string) => {
    if (!apiAvailable) return;
    try {
      const result = await respondToEntry(entryId, message);
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? result.entry : e))
      );
      refreshOverview();
    } catch (err) {
      console.error('Failed to respond:', err);
    }
  };

  const handleFindCare = async (ctasLevel?: number) => {
    if (apiAvailable && ctasLevel) {
      try {
        const routedClinics = await getCareRouting(ctasLevel);
        if (routedClinics.length > 0) setClinics(routedClinics);
      } catch { /* fallback */ }
    }
    setShowCareRouting(true);
  };

  return (
    <div className="min-h-screen">
      <main className="max-w-6xl mx-auto px-3 md:px-4 pb-20 md:pb-4 pt-4">
        {/* Desktop: two-column layout */}
        <div className="hidden md:grid md:grid-cols-[2fr_3fr] gap-2 items-start">
          <div className="sticky top-4">
            <OverviewContent
              entries={entries}
              overview={overview}
              apiAvailable={apiAvailable}
              onFindCare={() => handleFindCare(4)}
            />
          </div>
          <FeedContent
            entries={entries}
            submitting={submitting}
            apiAvailable={apiAvailable}
            onSubmit={handleSubmit}
            onFindCare={handleFindCare}
            onRespond={handleRespond}
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
              apiAvailable={apiAvailable}
              onSubmit={handleSubmit}
              onFindCare={handleFindCare}
              onRespond={handleRespond}
            />
          ) : (
            <OverviewContent
              entries={entries}
              overview={overview}
              apiAvailable={apiAvailable}
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
