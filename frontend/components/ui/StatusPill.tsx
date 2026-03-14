import type { EntryStatus } from '@/lib/types';

interface StatusPillProps {
  status: EntryStatus;
  className?: string;
}

const statusConfig: Record<EntryStatus, { label: string; bg: string; text: string; dot: string }> = {
  active: { label: 'Active', bg: 'bg-info-soft', text: 'text-info', dot: 'bg-info' },
  resolved: { label: 'Resolved', bg: 'bg-accent-soft', text: 'text-accent', dot: 'bg-accent' },
  watching: { label: 'Watching', bg: 'bg-warning-soft', text: 'text-warning', dot: 'bg-warning' },
  escalated: { label: 'Escalated', bg: 'bg-danger-soft', text: 'text-danger', dot: 'bg-danger' },
};

export function StatusPill({ status, className = '' }: StatusPillProps) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.75rem] font-medium rounded-[var(--radius-sm)] ${config.bg} ${config.text} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
