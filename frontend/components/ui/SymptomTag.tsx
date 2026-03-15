import type { Symptom } from '@/lib/types';

interface SymptomTagProps {
  symptom: Symptom;
  className?: string;
}

const categoryColors: Record<Symptom['category'], string> = {
  pain: '#E5625E',
  digestive: '#CD533B',
  neurological: '#2364AA',
  respiratory: '#62A8AC',
  mental: '#8BA868',
  general: '#62A8AC',
};

export function SymptomTag({ symptom, className = '' }: SymptomTagProps) {
  const color = categoryColors[symptom.category] || '#62A8AC';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-[var(--radius-sm)] text-[0.75rem] font-medium ${className}`}
      style={{ backgroundColor: `${color}14`, color }}
    >
      {symptom.label}
    </span>
  );
}
