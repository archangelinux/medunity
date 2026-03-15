'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, ArrowLeft } from 'lucide-react';
import { CTASBadge } from '@/components/ui/CTASBadge';
import type { HealthEntry } from '@/lib/types';

interface StagingPanelProps {
  entry: HealthEntry;
  departureOffset: number;
  onDepartureChange: (offset: number) => void;
}

const departureOptions = [
  { label: 'Now', value: 0 },
  { label: '30m', value: 30 },
  { label: '1h', value: 60 },
];

function formatEntryDate(ts: string) {
  const d = new Date(ts);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function getEntryNumber(id: string) {
  // Derive a short numeric from the UUID for display
  const num = parseInt(id.replace(/-/g, '').slice(0, 8), 16) % 10000;
  return num.toString().padStart(4, '0');
}

export function StagingPanel({ entry, departureOffset, onDepartureChange }: StagingPanelProps) {
  const router = useRouter();
  const [customTime, setCustomTime] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const handleCustomSubmit = () => {
    const mins = parseInt(customTime);
    if (!isNaN(mins) && mins >= 0) {
      onDepartureChange(mins);
      setShowCustom(false);
    }
  };

  const departureTime = new Date(Date.now() + departureOffset * 60000);
  const departureLabel = departureOffset === 0
    ? 'Leaving now'
    : `Depart ${departureTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

  return (
    <div className="bg-surface/90 backdrop-blur-xl rounded-[var(--radius-lg)] shadow-lg border border-white/30 overflow-hidden">
      {/* Main pill row */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Back to entry */}
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-accent hover:text-accent-hover transition-colors cursor-pointer flex-shrink-0"
        >
          <ArrowLeft size={14} />
          <span className="hidden sm:inline">Back</span>
        </button>

        <div className="w-px h-5 bg-border-soft" />

        {/* Entry identifier */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[0.8125rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
            Entry #{getEntryNumber(entry.id)}
          </span>
          <span className="text-[0.75rem] text-text-tertiary">
            {formatEntryDate(entry.timestamp)}
          </span>
        </div>

        <CTASBadge level={entry.ctasLevel} />

        <div className="ml-auto" />

        {/* Departure time pills */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Clock size={13} className="text-text-tertiary" />
          {departureOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onDepartureChange(opt.value); setShowCustom(false); }}
              className={`px-2 py-1 rounded-[var(--radius-sm)] text-[0.75rem] font-medium transition-colors cursor-pointer ${
                departureOffset === opt.value && !showCustom
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:bg-surface-soft'
              }`}
            >
              {opt.label}
            </button>
          ))}
          <span className="text-[0.6875rem] text-text-tertiary ml-1 hidden sm:inline">{departureLabel}</span>
        </div>

      </div>

    </div>
  );
}
