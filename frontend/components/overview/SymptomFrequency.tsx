import { Card } from '@/components/ui/Card';
import type { SymptomFrequencyItem } from '@/lib/types';

interface SymptomFrequencyProps {
  data: SymptomFrequencyItem[];
}

export function SymptomFrequency({ data }: SymptomFrequencyProps) {
  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <Card>
      <h3 className="text-[1rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary mb-1">
        Symptom Frequency
      </h3>
      <p className="text-[0.75rem] text-text-tertiary mb-4">Past 30 days</p>

      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.symptom} className="flex items-center gap-3">
            <span className="text-[0.8125rem] text-text-secondary w-24 text-right flex-shrink-0">
              {item.symptom}
            </span>
            <div className="flex-1 h-[6px] bg-surface-soft rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(item.count / maxCount) * 100}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
            <span className="text-[0.8125rem] font-semibold text-text-primary w-6 text-right font-[family-name:var(--font-heading)]">
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
