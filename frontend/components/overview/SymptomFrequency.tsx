import { Card } from '@/components/ui/Card';
import type { SymptomFrequencyItem } from '@/lib/types';

interface SymptomFrequencyProps {
  data: SymptomFrequencyItem[];
}

export function SymptomFrequency({ data }: SymptomFrequencyProps) {
  if (data.length === 0) {
    return (
      <Card padding="sm">
        <h3 className="text-[0.8125rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary mb-1">
          Symptoms
        </h3>
        <p className="text-[0.75rem] text-text-tertiary">No symptoms logged yet</p>
      </Card>
    );
  }

  return (
    <Card padding="sm">
      <h3 className="text-[0.8125rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary mb-2">
        Symptoms <span className="text-text-tertiary font-normal">· 30 days</span>
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {data.map((item) => (
          <span
            key={item.symptom}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] text-[0.75rem] font-medium"
            style={{ backgroundColor: `${item.color}14`, color: item.color }}
          >
            {item.symptom}
            <span
              className="inline-flex items-center justify-center w-4.5 h-4.5 rounded-full text-[0.625rem] font-bold text-white min-w-[18px] px-1"
              style={{ backgroundColor: item.color }}
            >
              {item.count}
            </span>
          </span>
        ))}
      </div>
    </Card>
  );
}
