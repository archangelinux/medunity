import { Activity } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { IconCircle } from '@/components/ui/IconCircle';

interface HealthStatusProps {
  entryCount?: number;
  avgCtas?: number;
  summary?: string;
}

export function HealthStatus({
  entryCount = 0,
  avgCtas = 0,
  summary = 'No entries yet. Log your first symptom to get started.',
}: HealthStatusProps) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-3">
        <IconCircle color="accent" size="sm">
          <Activity size={15} />
        </IconCircle>
        <h3 className="text-[1rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
          Health Status
        </h3>
      </div>
      <p className="text-[0.8125rem] text-text-secondary leading-relaxed mb-4">
        {summary}
      </p>
      <div className="flex gap-6">
        <div>
          <span className="text-[2rem] font-bold text-text-primary font-[family-name:var(--font-heading)] leading-none">{entryCount}</span>
          <span className="text-[0.6875rem] text-text-tertiary ml-1.5 uppercase tracking-wide">entries</span>
        </div>
        <div className="border-l border-border-soft pl-6">
          <span className="text-[2rem] font-bold text-accent font-[family-name:var(--font-heading)] leading-none">{avgCtas || '—'}</span>
          <span className="text-[0.6875rem] text-text-tertiary ml-1.5 uppercase tracking-wide">avg CTAS</span>
        </div>
      </div>
    </Card>
  );
}
