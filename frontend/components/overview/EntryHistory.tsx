'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { CTASBadge } from '@/components/ui/CTASBadge';
import type { HealthEntry } from '@/lib/types';

interface EntryHistoryProps {
  entries: HealthEntry[];
}

function formatShortDate(timestamp: string) {
  const date = new Date(timestamp);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

export function EntryHistory({ entries }: EntryHistoryProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Card>
      <h3 className="text-[0.875rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary mb-3">
        Entry History
      </h3>
      <div className="space-y-0.5">
        {entries.map((entry) => (
          <button
            key={entry.id}
            className="w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-sm)] hover:bg-surface-soft transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <Clock size={13} className="text-text-tertiary flex-shrink-0" />
              <span className="text-[0.8125rem] text-text-primary truncate">
                {entry.symptoms.map((s) => s.label).join(', ')}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              <span className="text-[0.6875rem] text-text-tertiary" suppressHydrationWarning>
                {mounted ? formatShortDate(entry.timestamp) : '\u00A0'}
              </span>
              <CTASBadge level={entry.ctasLevel} />
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}
