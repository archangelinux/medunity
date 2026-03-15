import { Activity, AlertTriangle, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { IconCircle } from '@/components/ui/IconCircle';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { PatternAlert } from '@/lib/types';

interface HealthStatusProps {
  entryCount?: number;
  avgCtas?: number;
}

export function HealthStatus({
  entryCount = 0,
  avgCtas = 0,
}: HealthStatusProps) {
  return (
    <Card padding="sm">
      <div className="flex items-center gap-2.5 mb-2">
        <IconCircle color="accent" size="sm">
          <Activity size={15} />
        </IconCircle>
        <h3 className="text-[0.875rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
          Health Status
        </h3>
      </div>
      <div className="flex gap-5">
        <div>
          <span className="text-[1.5rem] font-bold text-text-primary font-[family-name:var(--font-heading)] leading-none">{entryCount}</span>
          <span className="text-[0.625rem] text-text-tertiary ml-1 uppercase tracking-wide">entries</span>
        </div>
        <div className="border-l border-border-soft pl-5">
          <span className="text-[1.5rem] font-bold text-accent font-[family-name:var(--font-heading)] leading-none">{avgCtas || '—'}</span>
          <span className="text-[0.625rem] text-text-tertiary ml-1 uppercase tracking-wide">avg CTAS</span>
        </div>
      </div>
    </Card>
  );
}

const trendConfig = {
  worsening: { label: 'Worsening', variant: 'danger' as const },
  stable: { label: 'Stable', variant: 'warning' as const },
  improving: { label: 'Improving', variant: 'accent' as const },
};

interface HealthSummaryProps {
  entryCount?: number;
  patternAlert?: PatternAlert | null;
  onFindCare?: () => void;
}

export function HealthSummary({ entryCount = 0, patternAlert, onFindCare }: HealthSummaryProps) {
  const trend = patternAlert ? trendConfig[patternAlert.ctasTrend] : null;

  return (
    <Card padding="sm" className="flex-1 flex flex-col">
      <h3 className="text-[0.8125rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary mb-3">
        Trends & Alerts
      </h3>

      {/* Pattern section — always present, fills available height */}
      <div className="flex-1 flex flex-col justify-center">
        {patternAlert ? (
          <div className="flex items-start gap-2.5">
            <IconCircle color="warning" size="sm">
              <AlertTriangle size={13} />
            </IconCircle>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-[0.8125rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary truncate">
                  {patternAlert.title}
                </h4>
                <Badge variant={trend!.variant}>{trend!.label}</Badge>
              </div>
              <p className="text-[0.75rem] text-text-secondary leading-relaxed mb-2">
                {patternAlert.description}
              </p>
              <div className="flex items-center gap-3">
                <span className="text-[0.6875rem] text-text-tertiary">
                  {patternAlert.relatedEntries} related entries
                </span>
                <Button size="sm" onClick={onFindCare} icon={<ArrowRight size={14} />}>
                  Find care now
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[0.75rem] text-text-tertiary italic">
            {entryCount === 0
              ? 'No entries yet. Log how you\'re feeling to get started.'
              : 'No patterns detected yet. Trends will appear as you log more entries.'}
          </p>
        )}
      </div>
    </Card>
  );
}
