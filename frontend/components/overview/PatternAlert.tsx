import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { IconCircle } from '@/components/ui/IconCircle';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { PatternAlert as PatternAlertType } from '@/lib/types';

interface PatternAlertProps {
  alert: PatternAlertType;
  onFindCare?: () => void;
}

const trendConfig = {
  worsening: { label: 'Worsening', variant: 'danger' as const },
  stable: { label: 'Stable', variant: 'warning' as const },
  improving: { label: 'Improving', variant: 'accent' as const },
};

export function PatternAlertCard({ alert, onFindCare }: PatternAlertProps) {
  const trend = trendConfig[alert.ctasTrend];

  return (
    <Card className="pattern-reveal border border-warning/20 bg-cream">
      <div className="flex items-start gap-3">
        <IconCircle color="warning" size="sm">
          <AlertTriangle size={14} />
        </IconCircle>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <h4 className="text-[0.875rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
              {alert.title}
            </h4>
            <Badge variant={trend.variant}>{trend.label}</Badge>
          </div>
          <p className="text-[0.8125rem] text-text-secondary leading-relaxed mb-3">
            {alert.description}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-[0.75rem] text-text-tertiary">
              {alert.relatedEntries} related entries
            </span>
            <Button size="sm" onClick={onFindCare} icon={<ArrowRight size={14} />}>
              Find care now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
