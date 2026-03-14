import { Pill, CheckCircle, Eye } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { IconCircle } from '@/components/ui/IconCircle';
import { Badge } from '@/components/ui/Badge';
import type { Treatment } from '@/lib/types';

interface TreatmentTrackerProps {
  treatments: Treatment[];
}

const typeConfig: Record<Treatment['type'], { icon: React.ReactNode; color: 'accent' | 'info' | 'warning' | 'default' }> = {
  medication: { icon: <Pill size={14} />, color: 'accent' },
  'lab-work': { icon: <Eye size={14} />, color: 'info' },
  'follow-up': { icon: <CheckCircle size={14} />, color: 'warning' },
  referral: { icon: <CheckCircle size={14} />, color: 'default' },
};

export function TreatmentTracker({ treatments }: TreatmentTrackerProps) {
  return (
    <Card>
      <h3 className="text-[1rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary mb-3">
        Active Treatments
      </h3>
      <div className="space-y-3">
        {treatments.map((treatment) => {
          const config = typeConfig[treatment.type];
          return (
            <div
              key={treatment.id}
              className="bg-surface-soft rounded-[var(--radius-md)] p-3"
            >
              <div className="flex items-start gap-2.5">
                <IconCircle color={config.color} size="sm">
                  {config.icon}
                </IconCircle>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[0.875rem] font-medium text-text-primary truncate">
                      {treatment.label}
                    </span>
                    {treatment.progress > 0 && (
                      <Badge variant="accent">
                        {treatment.progress}%
                      </Badge>
                    )}
                    {treatment.progress === 0 && (
                      <Badge variant="warning">Pending</Badge>
                    )}
                  </div>
                  <p className="text-[0.75rem] text-text-tertiary">
                    {treatment.detail}
                  </p>
                  {/* Progress bar */}
                  {treatment.progress > 0 && (
                    <div className="mt-2 h-[5px] bg-white rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-500"
                        style={{ width: `${treatment.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
