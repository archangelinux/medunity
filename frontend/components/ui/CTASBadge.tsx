import type { CTASLevel } from '@/lib/types';

interface CTASBadgeProps {
  level: CTASLevel;
  className?: string;
}

const ctasConfig: Record<CTASLevel, { label: string; bg: string; text: string }> = {
  1: { label: 'CTAS 1 · Resuscitation', bg: 'bg-danger', text: 'text-white' },
  2: { label: 'CTAS 2 · Emergent', bg: 'bg-warning', text: 'text-white' },
  3: { label: 'CTAS 3 · Urgent', bg: 'bg-info', text: 'text-white' },
  4: { label: 'CTAS 4 · Less Urgent', bg: 'bg-accent-soft', text: 'text-accent' },
  5: { label: 'CTAS 5 · Non-Urgent', bg: 'bg-surface-soft', text: 'text-text-secondary' },
};

export function CTASBadge({ level, className = '' }: CTASBadgeProps) {
  const config = ctasConfig[level];
  return (
    <span
      className={`ctas-badge-enter inline-flex items-center gap-1.5 px-3 py-1 text-[0.75rem] font-semibold rounded-[var(--radius-sm)] ${config.bg} ${config.text} ${className}`}
    >
      {config.label}
    </span>
  );
}
