'use client';

import { useState, useEffect } from 'react';
import { Clock, ChevronRight, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { CTASBadge } from '@/components/ui/CTASBadge';
import { StatusPill } from '@/components/ui/StatusPill';
import type { HealthEntry } from '@/lib/types';

interface EntryHistoryProps {
  entries: HealthEntry[];
  maxVisible?: number;
}

function formatShortDate(timestamp: string) {
  const date = new Date(timestamp);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

export function EntryHistory({ entries, maxVisible = 3 }: EntryHistoryProps) {
  const [mounted, setMounted] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const visible = entries.slice(0, maxVisible);
  const hasMore = entries.length > maxVisible;

  if (entries.length === 0) {
    return (
      <Card padding="sm">
        <h3 className="text-[0.8125rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary mb-1">
          Entry History
        </h3>
        <p className="text-[0.75rem] text-text-tertiary">No entries recorded yet</p>
      </Card>
    );
  }

  return (
    <>
      <Card padding="sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[0.8125rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
            Entry History
          </h3>
          {hasMore && (
            <button
              onClick={() => setShowAll(true)}
              className="text-[0.6875rem] text-accent font-medium hover:underline cursor-pointer flex items-center gap-0.5"
            >
              View all ({entries.length}) <ChevronRight size={12} />
            </button>
          )}
        </div>
        <div className="space-y-0.5">
          {visible.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between px-2 py-1.5 rounded-[var(--radius-sm)] hover:bg-surface-soft transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Clock size={11} className="text-text-tertiary flex-shrink-0" />
                <span className="text-[0.75rem] text-text-primary truncate">
                  {entry.symptoms.length > 0
                    ? entry.symptoms.map((s) => s.label).join(', ')
                    : entry.userText.slice(0, 40) + (entry.userText.length > 40 ? '...' : '')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                <span className="text-[0.625rem] text-text-tertiary" suppressHydrationWarning>
                  {mounted ? formatShortDate(entry.timestamp) : '\u00A0'}
                </span>
                {entry.status !== 'active' && <CTASBadge level={entry.ctasLevel} />}
                {entry.status === 'active' && <StatusPill status="active" />}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Full history modal */}
      {showAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={() => setShowAll(false)} />
          <div className="relative slide-up w-full max-w-lg max-h-[80vh] overflow-y-auto bg-bg rounded-[var(--radius-lg)] p-1.5">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[1.125rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
                  All Entries ({entries.length})
                </h2>
                <button
                  onClick={() => setShowAll(false)}
                  className="w-8 h-8 rounded-[var(--radius-md)] bg-surface-soft text-text-tertiary hover:bg-border-soft hover:text-text-secondary flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-1">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-[var(--radius-sm)] hover:bg-surface-soft transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[0.8125rem] text-text-primary truncate">
                        {entry.symptoms.length > 0
                          ? entry.symptoms.map((s) => s.label).join(', ')
                          : entry.userText.slice(0, 60)}
                      </p>
                      <span className="text-[0.6875rem] text-text-tertiary" suppressHydrationWarning>
                        {mounted ? formatShortDate(entry.timestamp) : '\u00A0'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {entry.status !== 'active' && <CTASBadge level={entry.ctasLevel} />}
                      {entry.status === 'active' && <StatusPill status="active" />}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
