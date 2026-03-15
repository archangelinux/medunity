'use client';

import { X, FileText, Clock, Stethoscope, AlertTriangle, Shield, User, ArrowRight } from 'lucide-react';
import { CTASBadge } from '@/components/ui/CTASBadge';
import type { ProviderSignal, TriageDocumentData } from '@/lib/provider-types';
import { CTAS_COLORS, CTAS_LABELS } from '@/lib/provider-types';
import type { CTASLevel } from '@/lib/types';

/** Parse "- Question: Answer" lines into structured pairs */
function parseTriageText(text: string): { question: string; answer: string }[] {
  const pairs: { question: string; answer: string }[] = [];
  for (const line of text.split('\n')) {
    const match = line.match(/^-\s*(.+?):\s*(.+)$/);
    if (match) pairs.push({ question: match[1].trim(), answer: match[2].trim() });
  }
  return pairs;
}

interface SignalReportPopupProps {
  signal: ProviderSignal;
  onClose: () => void;
}

function formatDate(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function TableRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start border-b border-border-soft last:border-b-0">
      <div className="px-4 py-2.5 text-[0.75rem] font-semibold text-text-tertiary uppercase tracking-wider bg-surface-soft/50">
        {label}
      </div>
      <div className="px-4 py-2.5">
        {children}
      </div>
    </div>
  );
}

export function SignalReportPopup({ signal, onClose }: SignalReportPopupProps) {
  const report = signal.reportData;
  const tr = report?.triageReport;
  const ctasLevel = signal.ctasLevel as CTASLevel;
  const ctasColor = CTAS_COLORS[ctasLevel] || '#94A3B8';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative slide-up w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 bg-white rounded-[var(--radius-lg)] shadow-2xl">
        {/* Header */}
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
                {signal.isSimulated ? 'Simulated patient signal' : 'Submitted by patient via MedUnity'}
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
                {report?.timestamp
                  ? `${formatDate(report.timestamp)} at ${formatTime(report.timestamp)}`
                  : formatTime(signal.reportedAt)}
              </span>
              <span className="flex items-center gap-1.5 text-[0.75rem] text-text-tertiary">
                ETA: {Math.round(signal.etaMinutes)} min
              </span>
            </div>
            <CTASBadge level={ctasLevel} />
          </div>

          {/* Chief Complaint */}
          <div>
            <h3 className="text-[0.75rem] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
              Chief Complaint
            </h3>
            <div className="bg-surface-soft rounded-[var(--radius-md)] px-4 py-3">
              <div className="flex items-start gap-2.5">
                <User size={14} className="text-text-tertiary mt-0.5 flex-shrink-0" />
                <p className="text-[0.875rem] text-text-primary leading-relaxed italic">
                  &ldquo;{report?.userText || signal.chiefComplaint}&rdquo;
                </p>
              </div>
            </div>
          </div>

          {/* Symptom tags */}
          {((report?.symptoms && report.symptoms.length > 0) || signal.symptoms.length > 0) && (
            <div>
              <h3 className="text-[0.75rem] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                Identified Symptoms
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {(report?.symptoms || signal.symptoms.map((s) => ({ label: s, category: '' }))).map((s, i) => (
                  <span
                    key={i}
                    className="px-2.5 py-1 text-[0.8125rem] rounded-[var(--radius-sm)] bg-surface-soft text-text-secondary border border-border-soft"
                  >
                    {typeof s === 'string' ? s : s.label}
                    {typeof s !== 'string' && s.category && (
                      <span className="text-[0.6875rem] text-text-tertiary ml-1.5">{s.category}</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Ward Assignment */}
          {signal.suggestedWard && (
            <div className="bg-accent-soft/50 rounded-[var(--radius-md)] px-4 py-3 border border-accent/10">
              <span className="text-[0.75rem] font-semibold text-accent uppercase tracking-wider">Suggested Ward</span>
              <p className="text-[0.875rem] text-accent font-medium mt-0.5">{signal.suggestedWard}</p>
            </div>
          )}

          {/* Triage Survey Responses (input — shown before assessment) */}
          {report?.triageResponses && (() => {
            const pairs = parseTriageText(report.triageResponses);
            return pairs.length > 0 ? (
              <div>
                <h3 className="text-[0.75rem] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                  Triage Survey Responses
                </h3>
                <div className="rounded-[var(--radius-md)] border border-border-soft overflow-hidden">
                  {pairs.map((qa, i) => (
                    <div key={i} className={`grid grid-cols-[1fr_1fr] ${i > 0 ? 'border-t border-border-soft' : ''}`}>
                      <div className="px-3 py-2.5 bg-surface-soft/50 text-[0.8125rem] text-text-secondary">{qa.question}</div>
                      <div className="px-3 py-2.5 text-[0.8125rem] font-medium text-text-primary">{qa.answer}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {/* Full triage report (if available) */}
          {tr ? (
            <>
              {/* AI Triage Assessment */}
              <div>
                <h3 className="text-[0.75rem] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                  <span className="flex items-center gap-1.5">
                    <Stethoscope size={12} />
                    AI Triage Assessment
                  </span>
                </h3>
                <p className="text-[0.875rem] text-text-primary leading-relaxed">
                  {tr.summary}
                </p>
                <p className="text-[0.875rem] text-text-secondary leading-relaxed mt-2">
                  {tr.assessment}
                </p>
              </div>

              {/* Recommendation */}
              <div className="bg-accent-soft/50 rounded-[var(--radius-md)] px-4 py-3 border border-accent/10">
                <div className="flex items-start gap-2">
                  <ArrowRight size={14} className="text-accent mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-[0.75rem] font-semibold text-accent uppercase tracking-wide">Recommendation</span>
                    <p className="text-[0.875rem] text-accent font-medium mt-0.5">{tr.recommendedAction}</p>
                    <p className="text-[0.75rem] text-text-tertiary mt-0.5">{tr.urgencyTimeframe}</p>
                  </div>
                </div>
              </div>

              {/* Watch For */}
              {tr.watchFor.length > 0 && (
                <div>
                  <h3 className="text-[0.75rem] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle size={12} className="text-warning" />
                      Red Flags to Monitor
                    </span>
                  </h3>
                  <ul className="space-y-1">
                    {tr.watchFor.map((item, i) => (
                      <li key={i} className="text-[0.8125rem] text-text-secondary flex items-start gap-2">
                        <span className="text-warning mt-0.5">&#x2022;</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            /* No full report — show what we have */
            <div className="rounded-[var(--radius-md)] border border-border-soft overflow-hidden">
              <TableRow label="CTAS Level">
                <div className="flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[0.6875rem] font-bold text-white"
                    style={{ background: ctasColor }}
                  >
                    {ctasLevel}
                  </span>
                  <span className="text-[0.8125rem] font-medium text-text-primary">
                    {CTAS_LABELS[ctasLevel]}
                  </span>
                </div>
              </TableRow>
              <TableRow label="Symptoms">
                <p className="text-[0.8125rem] text-text-secondary">{signal.symptoms.join(', ')}</p>
              </TableRow>
              {signal.suggestedWard && (
                <TableRow label="Ward">
                  <p className="text-[0.8125rem] text-text-primary font-medium">{signal.suggestedWard}</p>
                </TableRow>
              )}
            </div>
          )}

          {/* Prep Checklist */}
          {signal.prepChecklist.length > 0 && (
            <div>
              <h3 className="text-[0.75rem] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle size={12} className="text-accent" />
                  Preparation Checklist
                </span>
              </h3>
              <ul className="space-y-1">
                {signal.prepChecklist.map((item, i) => (
                  <li key={i} className="text-[0.8125rem] text-text-secondary flex items-start gap-2">
                    <span className="text-accent mt-0.5">&#x2022;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Disclaimer */}
          <div className="border-t border-border-soft pt-4">
            <div className="flex items-start gap-1.5">
              <Shield size={10} className="text-text-tertiary mt-0.5 flex-shrink-0" />
              <p className="text-[0.6875rem] text-text-tertiary leading-relaxed">
                {signal.isSimulated
                  ? 'This is a simulated patient signal for demand planning purposes.'
                  : "This report was generated by MedUnity's AI triage system based on patient self-reported symptoms. Clinical evaluation by a licensed healthcare provider is required."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
