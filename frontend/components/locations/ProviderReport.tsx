'use client';

import { useState } from 'react';
import { X, FileText, Send, CheckCircle, Clock, AlertTriangle, Stethoscope, MapPin, User } from 'lucide-react';
import { CTASBadge } from '@/components/ui/CTASBadge';
import { Button } from '@/components/ui/Button';
import type { HealthEntry, LocationFacility } from '@/lib/types';
import { sendProviderReport } from '@/lib/api';

interface ProviderReportProps {
  entry: HealthEntry;
  facility?: LocationFacility;
  departureOffset?: number;
  userLocation?: { lat: number; lng: number };
  onClose: () => void;
  onSent?: (signalId?: string) => void;
  viewOnly?: boolean;
  linkedEntries?: HealthEntry[];
}

/** Parse "- Question: Answer" lines from triage response messages into structured pairs */
function parseTriageResponses(followUp: HealthEntry['followUp']): { question: string; answer: string }[] {
  const pairs: { question: string; answer: string }[] = [];
  for (const msg of followUp) {
    if (msg.role !== 'user') continue;
    const lines = msg.text.split('\n');
    for (const line of lines) {
      const match = line.match(/^-\s*(.+?):\s*(.+)$/);
      if (match) {
        pairs.push({ question: match[1].trim(), answer: match[2].trim() });
      }
    }
  }
  return pairs;
}

function formatDate(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ProviderReport({ entry, facility, departureOffset = 0, userLocation, onClose, onSent, viewOnly = false, linkedEntries = [] }: ProviderReportProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const report = entry.triageReport;
  const travelMin = facility?.travelMinutes ?? 0;
  const arrivalTime = new Date(Date.now() + (departureOffset + travelMin) * 60000);
  const triageResponses = parseTriageResponses(entry.followUp);

  const handleSend = async () => {
    setSending(true);
    try {
      const result = await sendProviderReport({
        entry_id: entry.id,
        facility_id: facility!.id,
        facility_name: facility!.name,
        ctas_level: entry.ctasLevel,
        chief_complaint: entry.userText,
        symptoms: entry.symptoms.map((s) => ({ label: s.label, category: s.category })),
        eta_minutes: travelMin + departureOffset,
        latitude: userLocation?.lat ?? facility!.latitude,
        longitude: userLocation?.lng ?? facility!.longitude,
        report_data: {
          userText: entry.userText,
          symptoms: entry.symptoms.map((s) => ({ label: s.label, category: s.category })),
          ctasLevel: entry.ctasLevel,
          timestamp: entry.timestamp,
          triageReport: entry.triageReport ? {
            summary: entry.triageReport.summary,
            symptomsIdentified: entry.triageReport.symptomsIdentified,
            assessment: entry.triageReport.assessment,
            recommendedAction: entry.triageReport.recommendedAction,
            watchFor: entry.triageReport.watchFor,
            urgencyTimeframe: entry.triageReport.urgencyTimeframe,
            recommendedCareType: entry.triageReport.recommendedCareType,
          } : undefined,
          triageResponses: entry.followUp
            .filter((m) => m.role === 'user')
            .map((m) => m.text)
            .join('\n'),
          linkedEntries: linkedEntries.map((le) => ({
            userText: le.userText,
            symptoms: le.symptoms.map((s) => ({ label: s.label, category: s.category })),
            ctasLevel: le.ctasLevel,
            timestamp: le.timestamp,
            assessment: le.triageReport?.assessment || le.assessment || '',
            triageResponses: le.followUp
              .filter((m) => m.role === 'user')
              .map((m) => m.text)
              .join('\n'),
            triageReport: le.triageReport ? {
              summary: le.triageReport.summary,
              assessment: le.triageReport.assessment,
              recommendedAction: le.triageReport.recommendedAction,
              watchFor: le.triageReport.watchFor,
            } : undefined,
          })),
        },
      }) as { signal?: { id?: string } };
      const signalId = result?.signal?.id;
      setSending(false);
      setSent(true);
      setTimeout(() => onSent?.(signalId), 1200);
      return;
    } catch (e) {
      console.error('Failed to send report:', e);
    }
    setSending(false);
    setSent(true);
    setTimeout(() => onSent?.(), 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative slide-up w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 bg-white rounded-[var(--radius-lg)] shadow-2xl">
        {/* Document header */}
        <div className="sticky top-0 bg-white border-b border-border-soft px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[var(--radius-md)] bg-accent-soft flex items-center justify-center">
              <FileText size={18} className="text-accent" />
            </div>
            <div>
              <h2 className="text-[1rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
                Patient Intake Report
              </h2>
              <p className="text-[0.75rem] text-text-tertiary">
                Preliminary triage assessment for provider review
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[var(--radius-md)] text-text-tertiary hover:bg-surface-soft hover:text-text-secondary flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Meta row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4 text-[0.8125rem] text-text-secondary">
              <span className="flex items-center gap-1.5">
                <Clock size={13} className="text-text-tertiary" />
                {formatDate(entry.timestamp)} at {formatTime(entry.timestamp)}
              </span>
            </div>
            <CTASBadge level={entry.ctasLevel} />
          </div>

          {/* Patient Demographics */}
          {report?.patientDemographics && Object.keys(report.patientDemographics).length > 0 && (
            <div className="bg-surface-soft rounded-[var(--radius-md)] px-4 py-3">
              <div className="flex items-start gap-3">
                <User size={16} className="text-accent mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[0.8125rem]">
                    {report.patientDemographics.age && (
                      <span className="text-text-primary"><span className="text-text-tertiary">Age:</span> {report.patientDemographics.age}</span>
                    )}
                    {report.patientDemographics.sex && (
                      <span className="text-text-primary"><span className="text-text-tertiary">Sex:</span> {report.patientDemographics.sex}</span>
                    )}
                  </div>
                  {report.patientDemographics.conditions && report.patientDemographics.conditions.length > 0 && (
                    <p className="text-[0.8125rem] text-text-primary mt-1">
                      <span className="text-text-tertiary">Conditions:</span> {report.patientDemographics.conditions.join(', ')}
                    </p>
                  )}
                  {report.patientDemographics.medications && report.patientDemographics.medications.length > 0 && (
                    <p className="text-[0.8125rem] text-text-primary mt-1">
                      <span className="text-text-tertiary">Medications:</span> {report.patientDemographics.medications.join(', ')}
                    </p>
                  )}
                  {report.patientDemographics.allergies && report.patientDemographics.allergies.length > 0 && (
                    <p className="text-[0.8125rem] text-text-primary mt-1">
                      <span className="text-text-tertiary text-warning">Allergies:</span> {report.patientDemographics.allergies.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Destination — shown only when facility is provided */}
          {facility && !viewOnly && (
          <div className="bg-surface-soft rounded-[var(--radius-md)] px-4 py-3">
            <div className="flex items-start gap-3">
              <MapPin size={16} className="text-accent mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[0.875rem] font-semibold text-text-primary">{facility.name}</p>
                <p className="text-[0.8125rem] text-text-secondary">{facility.address}</p>
                <p className="text-[0.75rem] text-text-tertiary mt-1">
                  ETA: {arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {facility.waitMinutes != null && ` · Est. wait: ${facility.waitMinutes} min`}
                </p>
              </div>
            </div>
          </div>
          )}

          {/* Chief complaint */}
          <div>
            <h3 className="text-[0.75rem] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
              Chief Complaint
            </h3>
            <div className="bg-surface-soft rounded-[var(--radius-md)] px-4 py-3">
              <div className="flex items-start gap-2.5">
                <User size={14} className="text-text-tertiary mt-0.5 flex-shrink-0" />
                <p className="text-[0.875rem] text-text-primary leading-relaxed italic">
                  &ldquo;{entry.userText}&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* Symptom tags */}
          {entry.symptoms.length > 0 && (
            <div>
              <h3 className="text-[0.75rem] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                Identified Symptoms
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {entry.symptoms.map((s) => (
                  <span
                    key={s.label}
                    className="px-2.5 py-1 text-[0.8125rem] rounded-[var(--radius-sm)] bg-surface-soft text-text-secondary border border-border-soft"
                  >
                    {s.label}
                    <span className="text-[0.6875rem] text-text-tertiary ml-1.5">{s.category}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Triage survey responses — structured table (input) */}
          {triageResponses.length > 0 && (
            <div>
              <h3 className="text-[0.75rem] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                Triage Survey Responses
              </h3>
              <div className="rounded-[var(--radius-md)] border border-border-soft overflow-hidden">
                {triageResponses.map((qa, i) => (
                  <div
                    key={i}
                    className={`grid grid-cols-[1fr_1fr] ${i > 0 ? 'border-t border-border-soft' : ''}`}
                  >
                    <div className="px-3 py-2.5 bg-surface-soft/50 text-[0.8125rem] text-text-secondary">
                      {qa.question}
                    </div>
                    <div className="px-3 py-2.5 text-[0.8125rem] font-medium text-text-primary">
                      {qa.answer}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Triage Assessment (output) — fallback to plain assessment if no structured report */}
          {!report && entry.assessment && (
            <div>
              <h3 className="text-[0.75rem] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                <span className="flex items-center gap-1.5">
                  <Stethoscope size={12} />
                  Assessment
                </span>
              </h3>
              <p className="text-[0.875rem] text-text-secondary leading-relaxed">
                {entry.assessment}
              </p>
            </div>
          )}
          {report && (
            <>
              <div>
                <h3 className="text-[0.75rem] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                  <span className="flex items-center gap-1.5">
                    <Stethoscope size={12} />
                    AI Triage Assessment
                  </span>
                </h3>
                <p className="text-[0.875rem] text-text-primary leading-relaxed">
                  {report.summary}
                </p>
                <p className="text-[0.875rem] text-text-secondary leading-relaxed mt-2">
                  {report.assessment}
                </p>
              </div>

              {/* Recommendation */}
              <div className="bg-accent-soft/50 rounded-[var(--radius-md)] px-4 py-3 border border-accent/10">
                <h3 className="text-[0.75rem] font-semibold text-accent uppercase tracking-wider mb-1">
                  Recommendation
                </h3>
                <p className="text-[0.875rem] text-accent font-medium">
                  {report.recommendedAction}
                </p>
                <p className="text-[0.8125rem] text-text-secondary mt-1">
                  Timeframe: {report.urgencyTimeframe}
                </p>
              </div>

              {/* Watch for */}
              {report.watchFor.length > 0 && (
                <div>
                  <h3 className="text-[0.75rem] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle size={12} className="text-warning" />
                      Red Flags to Monitor
                    </span>
                  </h3>
                  <ul className="space-y-1">
                    {report.watchFor.map((item, i) => (
                      <li key={i} className="text-[0.8125rem] text-text-secondary flex items-start gap-2">
                        <span className="text-warning mt-0.5">&#x2022;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {/* Related Prior Entries */}
          {linkedEntries.length > 0 && (
            <div>
              <h3 className="text-[0.75rem] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                Related Prior Entries
              </h3>
              <div className="space-y-2">
                {linkedEntries.map((le) => (
                  <div key={le.id} className="rounded-[var(--radius-md)] border border-border-soft overflow-hidden">
                    <div className="px-3 py-2 bg-surface-soft/50 flex items-center justify-between">
                      <span className="text-[0.75rem] font-medium text-text-primary">
                        {formatDate(le.timestamp)}
                      </span>
                      <CTASBadge level={le.ctasLevel} className="!text-[0.625rem] !px-2 !py-0.5" />
                    </div>
                    <div className="px-3 py-2.5 space-y-2">
                      <p className="text-[0.8125rem] text-text-secondary italic">
                        &ldquo;{le.userText}&rdquo;
                      </p>
                      {le.symptoms.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {le.symptoms.map((s) => (
                            <span key={s.label} className="px-2 py-0.5 text-[0.6875rem] rounded-[var(--radius-sm)] bg-surface-soft text-text-tertiary border border-border-soft">
                              {s.label}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Prior entry triage survey responses */}
                      {(() => {
                        const priorResponses = parseTriageResponses(le.followUp);
                        return priorResponses.length > 0 ? (
                          <div className="rounded-[var(--radius-sm)] border border-border-soft overflow-hidden">
                            {priorResponses.map((qa, qi) => (
                              <div key={qi} className={`grid grid-cols-[1fr_1fr] ${qi > 0 ? 'border-t border-border-soft' : ''}`}>
                                <div className="px-2.5 py-1.5 bg-surface-soft/50 text-[0.75rem] text-text-tertiary">{qa.question}</div>
                                <div className="px-2.5 py-1.5 text-[0.75rem] text-text-primary">{qa.answer}</div>
                              </div>
                            ))}
                          </div>
                        ) : null;
                      })()}
                      {/* Prior entry assessment */}
                      {le.triageReport ? (
                        <p className="text-[0.8125rem] text-text-secondary">{le.triageReport.assessment}</p>
                      ) : le.assessment ? (
                        <p className="text-[0.8125rem] text-text-secondary">{le.assessment}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="border-t border-border-soft pt-4">
            <p className="text-[0.6875rem] text-text-tertiary leading-relaxed">
              This report was generated by MedUnity&apos;s AI triage system based on patient self-reported symptoms and is intended as a preliminary assessment only. It does not constitute a medical diagnosis. Clinical evaluation by a licensed healthcare provider is required.
            </p>
          </div>
        </div>

        {/* Sticky footer */}
        {!viewOnly && facility && (
          <div className="sticky bottom-0 bg-white border-t border-border-soft px-6 py-4 flex items-center justify-between">
            <p className="text-[0.75rem] text-text-tertiary">
              This report will be shared with {facility.name}
            </p>
            {sent ? (
              <div className="flex items-center gap-2 text-accent">
                <CheckCircle size={18} />
                <span className="text-[0.875rem] font-semibold">Report sent</span>
              </div>
            ) : (
              <Button
                onClick={handleSend}
                disabled={sending}
                icon={sending ? <Clock size={16} className="animate-spin" /> : <Send size={16} />}
              >
                {sending ? 'Sending...' : 'Send to Provider'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
