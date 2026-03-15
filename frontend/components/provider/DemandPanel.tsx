'use client';

import { useState } from 'react';
import {
  AlertTriangle, TrendingUp, Users, Building2, Clock,
  Shield, ArrowRightLeft, FileText,
} from 'lucide-react';
import type { CTASLevel } from '@/lib/types';
import type { ProviderSignal, FacilityLoad, DemandAnalysis } from '@/lib/provider-types';
import { CTAS_COLORS, CTAS_LABELS } from '@/lib/provider-types';
import { SignalReportPopup } from './SignalReportPopup';

const ETA_BINS = [
  { label: '0-15m', min: 0, max: 15 },
  { label: '15-30m', min: 15, max: 30 },
  { label: '30-60m', min: 30, max: 60 },
  { label: '1-2h', min: 60, max: 120 },
];

function loadColor(util: number): string {
  if (util > 85) return '#DC2626';
  if (util > 60) return '#F59E0B';
  return '#5D9E82';
}

interface DemandPanelProps {
  facilityName: string;
  facilityType: string;
  mySignals: ProviderSignal[];
  myLoad: FacilityLoad | null;
  allLoads: FacilityLoad[];
  demandAnalysis: DemandAnalysis | null;
}

export function DemandPanel({
  facilityName,
  facilityType,
  mySignals,
  myLoad,
  allLoads,
  demandAnalysis,
}: DemandPanelProps) {
  const [viewingReport, setViewingReport] = useState<ProviderSignal | null>(null);

  const capacity = myLoad?.capacity ?? 0;
  const incoming = myLoad?.incoming ?? 0;
  const utilization = myLoad?.utilization ?? 0;

  // CTAS breakdown
  const ctasCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<CTASLevel, number>;
  const symptomCounts: Record<string, number> = {};
  for (const s of mySignals) {
    ctasCounts[s.ctasLevel]++;
    for (const symptom of s.symptoms) {
      symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1;
    }
  }
  const topSymptoms = Object.entries(symptomCounts)
    .map(([symptom, count]) => ({ symptom, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  const maxSymptom = Math.max(...topSymptoms.map((s) => s.count), 1);

  // Arrival timeline bins
  const bins = ETA_BINS.map((bin) => ({
    ...bin,
    count: mySignals.filter((s) => s.etaMinutes >= bin.min && s.etaMinutes < bin.max).length,
  }));
  const maxBin = Math.max(...bins.map((b) => b.count), 1);

  // Sorted by ETA
  const sortedPatients = [...mySignals].sort((a, b) => a.etaMinutes - b.etaMinutes).slice(0, 12);

  // Ward suggestion lookup from analysis
  const wardMap = new Map<string, string>();
  const checklistMap = new Map<string, string[]>();
  if (demandAnalysis) {
    for (const ws of demandAnalysis.wardSuggestions) {
      if (ws.signal_id) wardMap.set(ws.signal_id, ws.ward);
    }
    for (const pc of demandAnalysis.prepChecklists) {
      if (pc.signal_id) checklistMap.set(pc.signal_id, pc.checklist);
    }
  }

  // Other facilities
  const otherLoads = allLoads.filter((l) => l.facilityId !== myLoad?.facilityId).slice(0, 6);

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-surface scrollbar-hide">
      {/* Facility header */}
      <div className="px-5 py-4 border-b border-border-soft">
        <h2 className="text-[1rem] font-bold font-[family-name:var(--font-heading)] text-text-primary truncate">
          {facilityName}
        </h2>
        <span className="text-[0.6875rem] text-text-tertiary capitalize">
          {facilityType.replace('-', ' ')}
        </span>
      </div>

      {/* Cluster Alerts */}
      {demandAnalysis && demandAnalysis.clusterAlerts.length > 0 && (
        <div className="px-5 py-4 border-b border-border-soft">
          <div className="flex items-center gap-2 mb-2.5">
            <Shield size={13} className="text-warning" />
            <span className="text-[0.6875rem] font-semibold text-text-tertiary uppercase tracking-wider">
              Cluster Alerts
            </span>
          </div>
          <div className="space-y-2">
            {demandAnalysis.clusterAlerts.map((alert, i) => (
              <div
                key={i}
                className="px-3 py-2.5 rounded-[var(--radius-md)] bg-warning-soft border border-warning/15"
              >
                <div className="text-[0.8125rem] font-semibold text-text-primary">
                  {alert.message}
                </div>
                <div className="text-[0.75rem] text-warning mt-0.5">
                  {alert.protocol}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Capacity Projection */}
      <div className="px-5 py-4 border-b border-border-soft">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Building2 size={13} className="text-text-tertiary" />
            <span className="text-[0.6875rem] font-semibold text-text-tertiary uppercase tracking-wider">
              Capacity
            </span>
          </div>
          <span
            className="text-[1.25rem] font-bold font-[family-name:var(--font-heading)] tabular-nums"
            style={{ color: incoming > 0 ? loadColor(utilization) : 'var(--color-text-tertiary)' }}
          >
            {utilization}%
          </span>
        </div>
        <div className="h-2.5 bg-surface-soft rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${Math.min(utilization, 100)}%`,
              background: loadColor(utilization),
            }}
          />
        </div>
        <div className="text-[0.6875rem] text-text-tertiary mt-1.5">
          {incoming} incoming / {capacity} est. capacity (2h window)
        </div>
        {demandAnalysis?.capacityProjection?.recommendation && (
          <div className="text-[0.75rem] text-text-secondary mt-2 leading-relaxed">
            {demandAnalysis.capacityProjection.recommendation}
          </div>
        )}
        {utilization > 85 && (
          <div className="flex items-center gap-1.5 mt-2 text-[0.6875rem] text-danger font-medium">
            <AlertTriangle size={12} />
            Approaching overcapacity
          </div>
        )}
      </div>

      {/* CTAS Breakdown */}
      <div className="px-5 py-4 border-b border-border-soft">
        <div className="flex items-center gap-2 mb-3">
          <Users size={13} className="text-text-tertiary" />
          <span className="text-[0.6875rem] font-semibold text-text-tertiary uppercase tracking-wider">
            Incoming by Acuity
          </span>
          <span className="ml-auto text-[0.8125rem] font-bold text-text-primary tabular-nums">
            {incoming}
          </span>
        </div>
        <div className="flex gap-1.5">
          {([1, 2, 3, 4, 5] as CTASLevel[]).map((level) => {
            const count = ctasCounts[level];
            return (
              <div key={level} className="flex-1 text-center">
                <div
                  className="rounded-[var(--radius-sm)] py-1.5 mb-1 text-[0.8125rem] font-bold tabular-nums"
                  style={{
                    background: count > 0 ? CTAS_COLORS[level] + '18' : 'var(--color-surface-soft)',
                    color: count > 0 ? CTAS_COLORS[level] : 'var(--color-text-tertiary)',
                  }}
                >
                  {count}
                </div>
                <div className="text-[0.5625rem] text-text-tertiary font-medium">
                  {CTAS_LABELS[level].split(' ')[0]}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Arrival Timeline */}
      <div className="px-5 py-4 border-b border-border-soft">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={13} className="text-text-tertiary" />
          <span className="text-[0.6875rem] font-semibold text-text-tertiary uppercase tracking-wider">
            Arrival Timeline
          </span>
        </div>
        <div className="flex items-end gap-2 h-16">
          {bins.map((bin) => (
            <div key={bin.label} className="flex-1 flex flex-col items-center gap-1 h-full">
              <div className="flex-1 flex items-end w-full">
                <div
                  className="w-full rounded-sm transition-all duration-500 ease-out"
                  style={{
                    height: bin.count > 0 ? `${Math.max(20, (bin.count / maxBin) * 100)}%` : '4px',
                    background: bin.count > 0 ? 'var(--color-accent)' : 'var(--color-surface-soft)',
                  }}
                />
              </div>
              <span className="text-[0.5625rem] text-text-tertiary font-medium">{bin.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Incoming Queue — with ward + prep checklist */}
      {sortedPatients.length > 0 && (
        <div className="px-5 py-4 border-b border-border-soft">
          <span className="text-[0.6875rem] font-semibold text-text-tertiary uppercase tracking-wider">
            Incoming Queue
          </span>
          <div className="mt-2 space-y-1">
            {sortedPatients.map((signal) => {
              const ward = signal.suggestedWard || wardMap.get(signal.id);
              return (
                <button
                  key={signal.id}
                  onClick={() => setViewingReport(signal)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-md)] hover:bg-surface-soft transition-colors cursor-pointer text-left"
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[0.625rem] font-bold text-white flex-shrink-0"
                    style={{ background: CTAS_COLORS[signal.ctasLevel] }}
                  >
                    {signal.ctasLevel}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.75rem] font-medium text-text-primary truncate">
                      {signal.chiefComplaint}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[0.625rem] text-text-tertiary truncate">
                        {signal.symptoms.join(', ')}
                      </span>
                      {ward && (
                        <span className="text-[0.5625rem] px-1.5 py-0.5 rounded bg-accent-soft text-accent font-semibold flex-shrink-0">
                          {ward}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-[0.75rem] font-bold tabular-nums ${
                      Math.round(signal.etaMinutes) <= 3 ? 'text-accent' : 'text-text-primary'
                    }`}>
                      {Math.round(signal.etaMinutes)}m
                    </div>
                    <div className="text-[0.5625rem] text-text-tertiary">ETA</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Diversion Recommendations */}
      {demandAnalysis && demandAnalysis.diversionRecommendations.length > 0 && (
        <div className="px-5 py-4 border-b border-border-soft">
          <div className="flex items-center gap-2 mb-2.5">
            <ArrowRightLeft size={13} className="text-text-tertiary" />
            <span className="text-[0.6875rem] font-semibold text-text-tertiary uppercase tracking-wider">
              Diversion Recommendations
            </span>
          </div>
          <div className="space-y-2">
            {demandAnalysis.diversionRecommendations.map((rec, i) => (
              <div
                key={i}
                className="px-3 py-2.5 rounded-[var(--radius-md)] bg-accent-soft/50 border border-accent/10"
              >
                <div className="text-[0.8125rem] text-accent font-medium">
                  {rec.recommendation}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top symptoms */}
      {topSymptoms.length > 0 && (
        <div className="px-5 py-4 border-b border-border-soft">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={13} className="text-text-tertiary" />
            <span className="text-[0.6875rem] font-semibold text-text-tertiary uppercase tracking-wider">
              Top Presenting Symptoms
            </span>
          </div>
          <div className="space-y-1.5">
            {topSymptoms.map(({ symptom, count }) => (
              <div key={symptom} className="flex items-center gap-2">
                <span className="text-[0.75rem] text-text-secondary flex-1 truncate capitalize">
                  {symptom}
                </span>
                <div className="w-16 h-[5px] bg-surface-soft rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-700 ease-out"
                    style={{ width: `${(count / maxSymptom) * 100}%` }}
                  />
                </div>
                <span className="text-[0.6875rem] w-4 text-right text-text-secondary font-semibold tabular-nums">
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regional comparison */}
      <div className="px-5 py-4 flex-1">
        <div className="flex items-center gap-2 mb-3">
          <Building2 size={13} className="text-text-tertiary" />
          <span className="text-[0.6875rem] font-semibold text-text-tertiary uppercase tracking-wider">
            Nearby Facilities
          </span>
        </div>
        {otherLoads.length > 0 ? (
          <div className="space-y-2">
            {otherLoads.map((fl) => (
              <div key={fl.facilityId} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: fl.incoming > 0 ? loadColor(fl.utilization) : 'var(--color-border)' }}
                />
                <span className="text-[0.75rem] text-text-secondary flex-1 truncate">
                  {fl.name}
                </span>
                <div className="w-12 h-[4px] bg-surface-soft rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(fl.utilization, 100)}%`,
                      background: loadColor(fl.utilization),
                    }}
                  />
                </div>
                <span
                  className="text-[0.625rem] w-7 text-right font-semibold tabular-nums"
                  style={{ color: fl.incoming > 0 ? loadColor(fl.utilization) : 'var(--color-text-tertiary)' }}
                >
                  {fl.utilization}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[0.75rem] text-text-tertiary">No nearby facilities loaded.</p>
        )}
      </div>

      {/* Integration note */}
      <div className="px-5 py-3">
        <p className="text-[0.625rem] text-text-tertiary leading-relaxed">
          Patients are cleared from the incoming queue upon arrival. In production, this handoff would integrate with the facility&apos;s waiting room management and existing triage systems (e.g., Cerner, Epic) for seamless continuity of care.
        </p>
      </div>

      {/* Report popup */}
      {viewingReport && (
        <SignalReportPopup
          signal={viewingReport}
          onClose={() => setViewingReport(null)}
        />
      )}
    </div>
  );
}
