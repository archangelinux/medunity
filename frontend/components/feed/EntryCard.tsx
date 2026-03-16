'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Clock, ArrowRight, Link as LinkIcon, Stethoscope, Loader2, Trash2, ClipboardList, Send, AlertTriangle, Shield, FileText } from 'lucide-react';
import { CTASBadge } from '@/components/ui/CTASBadge';
import { SymptomTag } from '@/components/ui/SymptomTag';
import { IconCircle } from '@/components/ui/IconCircle';
import { Button } from '@/components/ui/Button';
import { ProviderReport } from '@/components/locations/ProviderReport';
import { AgentPipeline } from '@/components/feed/AgentPipeline';
import { getEntry, resolveEntryStream } from '@/lib/api';
import type { PipelineStep } from '@/lib/api';
import type { HealthEntry, TriageQuestion } from '@/lib/types';
import { CTAS_COLORS, CTAS_BG_COLORS } from '@/lib/provider-types';

interface EntryCardProps {
  entry: HealthEntry;
  onRespond?: (entryId: string, message: string, resolve?: boolean) => Promise<void>;
  onDelete?: (entryId: string) => void;
  onEntryUpdated?: (entry: HealthEntry) => void;
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${months[date.getMonth()]} ${date.getDate()} · ${hour12}:${minutes} ${ampm}`;
}

const CTAS_LABELS: Record<number, string> = {
  1: 'Resuscitation',
  2: 'Emergent',
  3: 'Urgent',
  4: 'Less Urgent',
  5: 'Non-Urgent',
};

// --- Triage Form Component ---
function TriageForm({
  questions,
  onSubmit,
  submitting,
}: {
  questions: TriageQuestion[];
  onSubmit: (answers: Record<string, string>) => void;
  submitting: boolean;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const setAnswer = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const toggleMultiSelect = (id: string, value: string) => {
    setAnswers((prev) => {
      const current = prev[id] ? prev[id].split(', ') : [];
      const isNoneOption = value.toLowerCase().includes('none');

      if (isNoneOption) {
        return { ...prev, [id]: current.includes(value) ? '' : value };
      }

      const withoutNone = current.filter(
        (v) => !v.toLowerCase().includes('none'),
      );

      const next = withoutNone.includes(value)
        ? withoutNone.filter((v) => v !== value)
        : [...withoutNone, value];

      return { ...prev, [id]: next.join(', ') };
    });
  };

  const allAnswered = questions.every((q) => {
    if (q.type === 'text') return true;
    return answers[q.id] && answers[q.id].length > 0;
  });

  return (
    <div className="bg-surface-soft rounded-[var(--radius-md)] p-4 mb-3">
      <div className="flex items-center gap-2 mb-4">
        <IconCircle color="accent" size="sm">
          <ClipboardList size={14} />
        </IconCircle>
        <h4 className="text-[0.875rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
          Quick Triage Assessment
        </h4>
      </div>

      <div className="space-y-4">
        {questions.map((q) => (
          <div key={q.id}>
            <label className="text-[0.8125rem] font-medium text-text-primary block mb-2">
              {q.question}
            </label>

            {q.type === 'yesno' && (
              <div className="flex gap-2">
                {['Yes', 'No'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setAnswer(q.id, opt)}
                    className={`px-4 py-2 rounded-[var(--radius-sm)] text-[0.8125rem] font-medium transition-colors cursor-pointer ${
                      answers[q.id] === opt
                        ? 'bg-accent text-white'
                        : 'bg-surface text-text-secondary border border-border-soft hover:bg-border-soft'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {q.type === 'scale' && (
              <div className="flex gap-1.5 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    onClick={() => setAnswer(q.id, String(n))}
                    className={`w-9 h-9 rounded-[var(--radius-sm)] text-[0.8125rem] font-semibold transition-colors cursor-pointer ${
                      answers[q.id] === String(n)
                        ? 'bg-accent text-white'
                        : 'bg-surface text-text-secondary border border-border-soft hover:bg-border-soft'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}

            {q.type === 'choice' && q.options && (
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setAnswer(q.id, opt)}
                    className={`px-3.5 py-2 rounded-[var(--radius-sm)] text-[0.8125rem] font-medium transition-colors cursor-pointer ${
                      answers[q.id] === opt
                        ? 'bg-accent text-white'
                        : 'bg-surface text-text-secondary border border-border-soft hover:bg-border-soft'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {q.type === 'multiselect' && q.options && (
              <div>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt) => {
                    const selected = answers[q.id]?.split(', ').includes(opt);
                    return (
                      <button
                        key={opt}
                        onClick={() => toggleMultiSelect(q.id, opt)}
                        className={`px-3.5 py-2 rounded-[var(--radius-sm)] text-[0.8125rem] font-medium transition-colors cursor-pointer ${
                          selected
                            ? 'bg-accent text-white'
                            : 'bg-surface text-text-secondary border border-border-soft hover:bg-border-soft'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[0.6875rem] text-text-tertiary mt-1.5">Select all that apply</p>
              </div>
            )}

            {q.type === 'text' && (
              <input
                type="text"
                value={answers[q.id] || ''}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder="Type your answer..."
                className="w-full px-3.5 py-2.5 text-[0.8125rem] text-text-primary placeholder:text-text-tertiary bg-surface rounded-[var(--radius-md)] border border-border-soft focus:outline-none focus:border-accent/40 transition-all"
              />
            )}
          </div>
        ))}
      </div>

      <Button
        onClick={() => onSubmit(answers)}
        disabled={!allAnswered || submitting}
        className="w-full mt-4"
        icon={submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
      >
        {submitting ? 'Assessing...' : 'Submit & Get Assessment'}
      </Button>
    </div>
  );
}

// --- Compact Triage Assessment (collapsible, defaults open on first view) ---
function TriageAssessment({ entry, defaultExpanded = false }: { entry: HealthEntry; defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const report = entry.triageReport;
  if (!report) return null;

  return (
    <div className="bg-surface-soft rounded-[var(--radius-md)] overflow-hidden mb-3">
      {/* Compact header — always visible, clickable to expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-surface-soft/80 transition-colors"
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <IconCircle color="accent" size="sm">
            <Stethoscope size={14} />
          </IconCircle>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[0.8125rem] text-text-primary leading-relaxed">
              {report.summary}
            </p>
            <p className="text-[0.6875rem] text-accent font-medium mt-0.5">
              {report.recommendedAction}
            </p>
          </div>
        </div>
        <ArrowRight size={14} className={`text-text-tertiary flex-shrink-0 ml-2 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border-soft divide-y divide-border-soft">
          {/* Assessment */}
          <div className="px-4 py-2.5">
            <p className="text-[0.6875rem] font-semibold text-text-tertiary uppercase tracking-wider mb-1">Assessment</p>
            <p className="text-[0.8125rem] text-text-primary leading-relaxed">{report.assessment}</p>
          </div>

          {/* Watch For */}
          {report.watchFor.length > 0 && (
            <div className="px-4 py-2.5">
              <p className="text-[0.6875rem] font-semibold text-text-tertiary uppercase tracking-wider mb-1 flex items-center gap-1">
                <AlertTriangle size={10} className="text-warning" />
                Watch For
              </p>
              <ul className="space-y-0.5">
                {report.watchFor.map((item, i) => (
                  <li key={i} className="text-[0.8125rem] text-text-secondary flex items-start gap-1.5">
                    <span className="text-warning mt-0.5">&#x2022;</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Timeframe + Care Type */}
          <div className="px-4 py-2.5 flex items-center gap-3">
            {report.urgencyTimeframe && (
              <span className="text-[0.75rem] text-text-secondary">{report.urgencyTimeframe}</span>
            )}
            <span className="px-2 py-0.5 text-[0.6875rem] rounded-[var(--radius-sm)] bg-accent-soft text-accent font-medium capitalize">
              {report.recommendedCareType.replace('-', ' ')}
            </span>
          </div>

          {/* Disclaimer */}
          <div className="px-4 py-2 flex items-start gap-1.5">
            <Shield size={9} className="text-text-tertiary mt-0.5 flex-shrink-0" />
            <p className="text-[0.625rem] text-text-tertiary leading-relaxed">
              Unofficial AI-generated preliminary assessment — not a medical diagnosis.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Survey Responses modal ---
function SurveyResponsesModal({ entry, onClose }: { entry: HealthEntry; onClose: () => void }) {
  const pairs: { question: string; answer: string }[] = [];
  for (const msg of entry.followUp) {
    if (msg.role !== 'user') continue;
    const lines = msg.text.split('\n');
    for (const line of lines) {
      const match = line.match(/^-\s*(.+?):\s*(.+)$/);
      if (match) pairs.push({ question: match[1].trim(), answer: match[2].trim() });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative bg-surface rounded-[var(--radius-lg)] shadow-xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border-soft flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <IconCircle color="accent" size="sm">
              <ClipboardList size={14} />
            </IconCircle>
            <h3 className="text-[0.9375rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
              Survey Responses
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[var(--radius-sm)] text-text-tertiary hover:text-text-primary hover:bg-surface-soft transition-colors cursor-pointer"
          >
            <span className="text-lg leading-none">&times;</span>
          </button>
        </div>

        {/* Responses */}
        <div className="overflow-y-auto flex-1">
          <div className="divide-y divide-border-soft">
            {pairs.map((p, i) => (
              <div key={i} className="px-5 py-3">
                <p className="text-[0.6875rem] text-text-tertiary mb-1">{p.question}</p>
                <p className="text-[0.875rem] text-text-primary">{p.answer}</p>
              </div>
            ))}
            {pairs.length === 0 && (
              <div className="px-5 py-8 text-center">
                <p className="text-[0.8125rem] text-text-tertiary italic">No survey responses recorded.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SurveyResponsesButton({ entry }: { entry: HealthEntry }) {
  const [show, setShow] = useState(false);

  const hasPairs = entry.followUp.some((msg) => {
    if (msg.role !== 'user') return false;
    return msg.text.split('\n').some((line) => /^-\s*.+?:\s*.+$/.test(line));
  });

  if (!hasPairs) return null;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setShow(true)} icon={<ClipboardList size={14} />}>
        Survey Responses
      </Button>
      {show && createPortal(
        <SurveyResponsesModal entry={entry} onClose={() => setShow(false)} />,
        document.body
      )}
    </>
  );
}

// --- Main Entry Card ---
export function EntryCard({ entry, onRespond, onDelete, onEntryUpdated }: EntryCardProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [triageSubmitting, setTriageSubmitting] = useState(false);
  const [triageSubmitted, setTriageSubmitted] = useState(false);
  const [resolving, setResolving] = useState(false);

  // Agent pipeline state
  const [pipelineActive, setPipelineActive] = useState(false);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<Record<string, PipelineStep>>({});

  useEffect(() => { setMounted(true); }, []);

  const handleTriageSubmit = async (answers: Record<string, string>) => {
    if (!entry.triageQuestions) return;
    setTriageSubmitting(true);

    const lines = entry.triageQuestions.map((q) => {
      const answer = answers[q.id] || 'Not answered';
      return `- ${q.question}: ${answer}`;
    });
    const message = `Triage responses:\n${lines.join('\n')}`;

    // Use streaming endpoint with pipeline visualization
    setPipelineActive(true);
    setPipelineSteps({});

    try {
      const { entry: updatedEntry } = await resolveEntryStream(
        entry.id,
        message,
        (step) => setPipelineSteps((prev) => ({ ...prev, [step.agent]: step })),
      );
      setTriageSubmitted(true);
      // Brief pause to show completed pipeline before collapsing
      await new Promise((r) => setTimeout(r, 800));
      setPipelineComplete(true);
      // Let collapse animation finish, then update entry
      await new Promise((r) => setTimeout(r, 700));
      if (onEntryUpdated) onEntryUpdated(updatedEntry);
    } catch {
      // Fallback to regular endpoint if streaming fails
      if (onRespond) {
        try {
          await onRespond(entry.id, message, true);
          setTriageSubmitted(true);
        } catch { /* silent */ }
      }
      setPipelineActive(false);
      setPipelineComplete(false);
    } finally {
      setTriageSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (resolving || !onRespond) return;
    setResolving(true);
    try {
      await onRespond(entry.id, 'Please resolve and provide your final assessment.', true);
    } finally {
      setResolving(false);
    }
  };

  const hasAssessment = entry.assessment && entry.assessment.length > 0;
  const isActive = entry.status === 'active';
  const showTriageForm = isActive && entry.triageQuestions && entry.triageQuestions.length > 0 && !triageSubmitted && !hasAssessment;

  const containerRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef<HTMLDivElement>(null);
  const [svgPath, setSvgPath] = useState('');

  useEffect(() => {
    const container = containerRef.current;
    const tab = tabRef.current;
    if (!container || !tab) return;

    const buildPath = () => {
      const W = container.offsetWidth;
      const tw = tab.offsetWidth;
      const th = tab.offsetHeight;
      const tabRight = 24;
      const pad = 6; // padding around the badge
      const lineY = th / 2 + pad; // line sits at vertical center of badge + padding = bottom of notch
      const r = 10; // curve radius
      // Notch edges (with padding around the badge)
      const rEdge = W - tabRight + pad;
      const lEdge = rEdge - tw - pad * 2;
      const notchTop = 0; // top of the notch

      const endR = 6; // radius for the downward curves at left and right ends
      const endDip = lineY + endR; // how far the ends dip down

      setSvgPath(
        // Left end — curves down
        `M 0,${endDip} ` +
        `Q 0,${lineY} ${endR},${lineY} ` +
        // Straight to notch
        `L ${lEdge - r},${lineY} ` +
        // Notch left curve up
        `Q ${lEdge},${lineY} ${lEdge},${lineY - r} ` +
        `L ${lEdge},${notchTop + r} ` +
        `Q ${lEdge},${notchTop} ${lEdge + r},${notchTop} ` +
        // Notch top
        `L ${rEdge - r},${notchTop} ` +
        // Notch right curve down
        `Q ${rEdge},${notchTop} ${rEdge},${notchTop + r} ` +
        `L ${rEdge},${lineY - r} ` +
        `Q ${rEdge},${lineY} ${rEdge + r},${lineY} ` +
        // Straight to right end
        `L ${W - endR},${lineY} ` +
        // Right end — curves down
        `Q ${W},${lineY} ${W},${endDip}`
      );
    };

    buildPath();
    const observer = new ResizeObserver(buildPath);
    observer.observe(container);
    return () => observer.disconnect();
  }, [entry.ctasLevel, isActive, mounted]);

  return (
    <div
      ref={containerRef}
      className="slide-down bg-surface p-5 pt-7 mt-5 first:mt-0 relative"
      id={`entry-${entry.id}`}
    >
      {/* SVG divider line + shadow that follows the curve */}
      {svgPath && (
        <svg
          className="absolute top-0 left-0 w-full pointer-events-none overflow-visible"
          style={{ height: '40px' }}
        >
          <path d={svgPath} fill="none" stroke="var(--color-border)" strokeWidth="1.5" />
        </svg>
      )}

      {/* CTAS tab — fully rounded, sits inside the curve housing */}
      <div
        ref={tabRef}
        className="absolute"
        style={{ top: '6px', right: '24px' }}
      >
        {entry.ctasLevel && !isActive ? (
          <CTASBadge level={entry.ctasLevel} />
        ) : (
          <span className="inline-flex items-center px-3 py-1 text-[0.6875rem] font-semibold rounded-[var(--radius-sm)] bg-surface-soft text-text-tertiary">
            Active
          </span>
        )}
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[0.75rem] text-text-tertiary">
          <Clock size={13} />
          <span suppressHydrationWarning>
            {mounted ? formatTimestamp(entry.timestamp) : '\u00A0'}
          </span>
        </div>
      </div>

      {/* User text */}
      <p className="text-[0.9375rem] text-text-primary leading-relaxed mb-3">
        &ldquo;{entry.userText}&rdquo;
      </p>

      {/* Symptom tags */}
      {entry.symptoms.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {entry.symptoms.map((symptom) => (
            <SymptomTag key={symptom.label} symptom={symptom} />
          ))}
        </div>
      )}

      {/* Linked entries */}
      {entry.linkedEntries.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <LinkIcon size={13} className="text-text-tertiary flex-shrink-0" />
          {entry.linkedEntries.map((linked) => (
            <button
              key={linked.id}
              onClick={() => {
                const el = document.getElementById(`entry-${linked.id}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  el.classList.add('ring-2', 'ring-accent/30');
                  setTimeout(() => el.classList.remove('ring-2', 'ring-accent/30'), 2000);
                }
              }}
              className="text-[0.75rem] text-info hover:text-info/80 transition-colors cursor-pointer underline decoration-info/30"
            >
              {linked.label} ({linked.date})
            </button>
          ))}
        </div>
      )}

      {/* Triage Form — shown for new active entries with questions */}
      {showTriageForm && !pipelineActive && (
        <TriageForm
          questions={entry.triageQuestions!}
          onSubmit={handleTriageSubmit}
          submitting={triageSubmitting}
        />
      )}

      {/* Agent Pipeline — shown during streaming resolution */}
      {pipelineActive && (
        <AgentPipeline steps={pipelineSteps} complete={pipelineComplete} />
      )}

      {/* Structured Triage Assessment — shown after resolution */}
      {entry.triageReport ? (
        <TriageAssessment entry={entry} defaultExpanded={triageSubmitted} />
      ) : hasAssessment ? (
        <div className="bg-surface-soft rounded-[var(--radius-md)] p-3 mb-3">
          <div className="flex items-start gap-2.5">
            <IconCircle color="accent" size="sm">
              <Stethoscope size={14} />
            </IconCircle>
            <p className="text-[0.8125rem] text-text-secondary leading-relaxed flex-1">
              {entry.assessment}
            </p>
          </div>
        </div>
      ) : null}

      {/* Action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Legacy fallback for entries with no triage questions */}
        {isActive && onRespond && !showTriageForm && !triageSubmitted && (!entry.triageQuestions || entry.triageQuestions.length === 0) && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleResolve}
            disabled={resolving}
            icon={resolving ? <Loader2 size={14} className="animate-spin" /> : <Stethoscope size={14} />}
          >
            {resolving ? 'Assessing...' : 'Get Assessment'}
          </Button>
        )}

        {/* Survey Responses — opens modal with the Q&A the user filled out */}
        {entry.status === 'resolved' && <SurveyResponsesButton entry={entry} />}

        <div className="flex items-center gap-1 ml-auto">
          {entry.status === 'resolved' && (
            <button
              onClick={() => router.push(`/locations?entryId=${entry.id}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.8125rem] font-semibold font-[family-name:var(--font-heading)] rounded-[var(--radius-sm)] border cursor-pointer transition-all duration-300"
              style={{
                color: CTAS_COLORS[entry.ctasLevel],
                borderColor: `${CTAS_COLORS[entry.ctasLevel]}40`,
                boxShadow: `0 0 12px ${CTAS_COLORS[entry.ctasLevel]}20`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = `0 0 20px ${CTAS_COLORS[entry.ctasLevel]}35`;
                e.currentTarget.style.borderColor = `${CTAS_COLORS[entry.ctasLevel]}70`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = `0 0 12px ${CTAS_COLORS[entry.ctasLevel]}20`;
                e.currentTarget.style.borderColor = `${CTAS_COLORS[entry.ctasLevel]}40`;
              }}
            >
              <ArrowRight size={14} />
              Find care
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(entry.id)}
              className="p-1.5 rounded-[var(--radius-sm)] text-text-tertiary hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer"
              title="Delete entry"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
