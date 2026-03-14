import type { Symptom } from '@/lib/types';

interface SymptomTagProps {
  symptom: Symptom;
  className?: string;
}

const categoryColors: Record<Symptom['category'], { bg: string; text: string }> = {
  pain: { bg: 'bg-danger-soft', text: 'text-danger' },
  digestive: { bg: 'bg-warning-soft', text: 'text-warning' },
  neurological: { bg: 'bg-info-soft', text: 'text-info' },
  respiratory: { bg: 'bg-accent-soft', text: 'text-accent' },
  mental: { bg: 'bg-[#F3EAFF]', text: 'text-[#7C5CBF]' },
  general: { bg: 'bg-surface-soft', text: 'text-text-secondary' },
};

export function SymptomTag({ symptom, className = '' }: SymptomTagProps) {
  const colors = categoryColors[symptom.category];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 text-[0.75rem] font-medium rounded-[var(--radius-sm)] ${colors.bg} ${colors.text} ${className}`}
    >
      {symptom.label}
    </span>
  );
}
