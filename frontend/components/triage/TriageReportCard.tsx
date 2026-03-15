'use client';

import { AlertTriangle, Clock, Stethoscope, Shield, ArrowRight } from 'lucide-react';
import { CTASBadge } from '@/components/ui/CTASBadge';
import { IconCircle } from '@/components/ui/IconCircle';
import type { TriageReport, CTASLevel } from '@/lib/types';

interface TriageReportCardProps {
  report: TriageReport;
  ctasLevel: CTASLevel;
  compact?: boolean;
}

export function TriageReportCard({ report, ctasLevel, compact = false }: TriageReportCardProps) {
  if (compact) {
    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="text-[0.8125rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
            Triage Report
          </h4>
          <CTASBadge level={ctasLevel} />
        </div>

        {/* Summary */}
        <p className="text-[0.8125rem] text-text-secondary leading-relaxed">
          {report.summary}
        </p>

        {/* Recommended action */}
        <div className="bg-accent-soft rounded-[var(--radius-sm)] px-3 py-2">
          <div className="flex items-center gap-2">
            <ArrowRight size={13} className="text-accent flex-shrink-0" />
            <span className="text-[0.8125rem] text-accent font-medium">{report.recommendedAction}</span>
          </div>
        </div>

        {/* Urgency */}
        <div className="flex items-center gap-2 text-[0.75rem] text-text-tertiary">
          <Clock size={12} />
          <span>{report.urgencyTimeframe}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-soft rounded-[var(--radius-md)] p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <IconCircle color="accent" size="sm">
            <Stethoscope size={14} />
          </IconCircle>
          <div>
            <h4 className="text-[0.875rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
              Preliminary Triage Assessment
            </h4>
            <p className="text-[0.6875rem] text-text-tertiary mt-0.5">
              This report can be shared with your care provider
            </p>
          </div>
        </div>
        <CTASBadge level={ctasLevel} />
      </div>

      {/* Summary */}
      <p className="text-[0.8125rem] text-text-secondary leading-relaxed mb-3">
        {report.summary}
      </p>

      {/* Assessment */}
      <div className="mb-3">
        <p className="text-[0.8125rem] text-text-primary leading-relaxed">
          {report.assessment}
        </p>
      </div>

      {/* Recommended Action */}
      <div className="bg-accent-soft rounded-[var(--radius-sm)] px-3.5 py-2.5 mb-3">
        <div className="flex items-start gap-2">
          <ArrowRight size={14} className="text-accent mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-[0.75rem] font-semibold text-accent uppercase tracking-wide">Recommended</span>
            <p className="text-[0.8125rem] text-accent font-medium mt-0.5">{report.recommendedAction}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2 ml-6">
          <Clock size={12} className="text-accent/70" />
          <span className="text-[0.75rem] text-accent/70">{report.urgencyTimeframe}</span>
        </div>
      </div>

      {/* Watch For */}
      {report.watchFor.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={13} className="text-warning" />
            <span className="text-[0.75rem] font-semibold text-text-primary uppercase tracking-wide">Watch for</span>
          </div>
          <ul className="space-y-1 ml-5">
            {report.watchFor.map((item, i) => (
              <li key={i} className="text-[0.8125rem] text-text-secondary list-disc">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Symptoms identified */}
      {report.symptomsIdentified.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border-soft">
          <Shield size={12} className="text-text-tertiary" />
          <span className="text-[0.6875rem] text-text-tertiary">Identified:</span>
          {report.symptomsIdentified.map((s, i) => (
            <span key={i} className="px-2 py-0.5 text-[0.6875rem] rounded-[var(--radius-sm)] bg-surface text-text-tertiary">
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
