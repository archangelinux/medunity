'use client';

import { useState, useEffect, useRef } from 'react';
import { Clock, ChevronDown, ChevronUp, ArrowRight, Link as LinkIcon, Stethoscope, ArrowUp, Loader2, CheckCircle, Trash2, ClipboardList, Send } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { CTASBadge } from '@/components/ui/CTASBadge';
import { SymptomTag } from '@/components/ui/SymptomTag';
import { IconCircle } from '@/components/ui/IconCircle';
import { Button } from '@/components/ui/Button';
import type { HealthEntry, FollowUpMessage, TriageQuestion } from '@/lib/types';

interface EntryCardProps {
  entry: HealthEntry;
  onFindCare?: () => void;
  onRespond?: (entryId: string, message: string, resolve?: boolean) => Promise<void>;
  onDelete?: (entryId: string) => void;
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

function formatTime() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

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

  const allAnswered = questions.every((q) => {
    if (q.type === 'text') return true; // text is optional
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

            {/* Yes / No */}
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

            {/* Scale 1-10 */}
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

            {/* Multiple choice */}
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

            {/* Free text */}
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

// --- Main Entry Card ---
export function EntryCard({ entry, onFindCare, onRespond, onDelete }: EntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [triageSubmitting, setTriageSubmitting] = useState(false);
  const [triageSubmitted, setTriageSubmitted] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<FollowUpMessage[]>([]);
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!sending) setPendingMessages([]);
  }, [entry.followUp.length, sending]);

  useEffect(() => {
    if (expanded && threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [entry.followUp.length, pendingMessages.length, expanded]);

  const handleTriageSubmit = async (answers: Record<string, string>) => {
    if (!onRespond || !entry.triageQuestions) return;
    setTriageSubmitting(true);

    // Format answers as a structured message
    const lines = entry.triageQuestions.map((q) => {
      const answer = answers[q.id] || 'Not answered';
      return `- ${q.question}: ${answer}`;
    });
    const message = `Triage responses:\n${lines.join('\n')}`;

    try {
      await onRespond(entry.id, message, true);
      setTriageSubmitted(true);
    } finally {
      setTriageSubmitting(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || sending || !onRespond) return;
    const msg = replyText.trim();
    setReplyText('');

    setPendingMessages((prev) => [...prev, {
      role: 'user', text: msg, timestamp: formatTime(),
    }]);

    setSending(true);
    try {
      await onRespond(entry.id, msg, false);
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    if (sending || !onRespond) return;
    setSending(true);
    try {
      await onRespond(entry.id, 'Please resolve and provide your final assessment.', true);
    } finally {
      setSending(false);
    }
  };

  const hasAssessment = entry.assessment && entry.assessment.length > 0;
  const hasThread = entry.followUp.length > 0 || pendingMessages.length > 0;
  const isActive = entry.status === 'active';
  const showTriageForm = isActive && entry.triageQuestions && entry.triageQuestions.length > 0 && !triageSubmitted && !hasAssessment;
  const allMessages = [...entry.followUp, ...pendingMessages];
  const threadCount = allMessages.length;

  return (
    <Card className="slide-down">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-[0.75rem] text-text-tertiary">
          <Clock size={13} />
          <span suppressHydrationWarning>
            {mounted ? formatTimestamp(entry.timestamp) : '\u00A0'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {entry.ctasLevel && <CTASBadge level={entry.ctasLevel} />}
          <StatusPill status={entry.status} />
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
              className="text-[0.75rem] text-info hover:text-info/80 transition-colors cursor-pointer underline decoration-info/30"
            >
              {linked.label} ({linked.date})
            </button>
          ))}
        </div>
      )}

      {/* Triage Form — shown for new active entries with questions */}
      {showTriageForm && onRespond && (
        <TriageForm
          questions={entry.triageQuestions!}
          onSubmit={handleTriageSubmit}
          submitting={triageSubmitting}
        />
      )}

      {/* Assessment — shown after triage or resolution */}
      {hasAssessment && (
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
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {isActive && onRespond && !showTriageForm && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleResolve}
            disabled={sending}
            icon={sending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
          >
            Resolve
          </Button>
        )}
        {hasThread && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            icon={expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          >
            {expanded ? 'Collapse' : 'Thread'} ({threadCount})
          </Button>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {onFindCare && (
            <Button variant="ghost" size="sm" onClick={onFindCare} icon={<ArrowRight size={14} />}>
              Find care
            </Button>
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

      {/* Thread — for additional messages after triage */}
      {expanded && hasThread && (
        <div className="mt-4 pt-4 border-t border-border-soft space-y-2.5">
          {allMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-3.5 py-2.5 rounded-[var(--radius-md)] text-[0.8125rem] leading-relaxed ${msg.role === 'user' ? 'bg-accent text-white rounded-br-[4px]' : 'bg-surface-soft text-text-secondary rounded-bl-[4px]'}`}>
                <p>{msg.text}</p>
                <span className={`text-[0.6875rem] mt-1 block ${msg.role === 'user' ? 'text-white/60' : 'text-text-tertiary'}`}>
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-start">
              <div className="px-3.5 py-2.5 rounded-[var(--radius-md)] rounded-bl-[4px] bg-surface-soft">
                <div className="flex items-center gap-2 text-text-tertiary">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-[0.8125rem]">Thinking...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={threadEndRef} />

          {isActive && onRespond && (
            <div className="flex items-end gap-2 pt-1">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Add more details..."
                  disabled={sending}
                  className="w-full px-3.5 py-2.5 pr-10 text-[0.8125rem] text-text-primary placeholder:text-text-tertiary bg-surface-soft rounded-[var(--radius-md)] border border-border-soft focus:outline-none focus:border-accent/40 focus:bg-white transition-all duration-150 font-[family-name:var(--font-body)] disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                />
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || sending}
                  className={`absolute right-1.5 bottom-1.5 w-7 h-7 rounded-[var(--radius-sm)] flex items-center justify-center transition-all duration-150 cursor-pointer disabled:cursor-not-allowed ${replyText.trim() && !sending ? 'bg-accent text-white hover:bg-accent-hover' : 'bg-transparent text-text-tertiary'}`}
                >
                  <ArrowUp size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
