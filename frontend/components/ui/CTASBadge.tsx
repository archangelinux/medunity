import type { CTASLevel } from '@/lib/types';

interface CTASBadgeProps {
  level: CTASLevel;
  className?: string;
}

const ctasConfig: Record<CTASLevel, { label: string; bg: string; text: string }> = {
  1: { label: 'CTAS 1 · Resuscitation', bg: 'bg-ctas-1-soft', text: 'text-ctas-1' },
  2: { label: 'CTAS 2 · Emergent', bg: 'bg-ctas-2-soft', text: 'text-ctas-2' },
  3: { label: 'CTAS 3 · Urgent', bg: 'bg-ctas-3-soft', text: 'text-ctas-3' },
  4: { label: 'CTAS 4 · Less Urgent', bg: 'bg-ctas-4-soft', text: 'text-ctas-4' },
  5: { label: 'CTAS 5 · Non-Urgent', bg: 'bg-ctas-5-soft', text: 'text-ctas-5' },
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
