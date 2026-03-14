'use client';

import { Database, Lock, FileText, TrendingUp, Download } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { IconCircle } from '@/components/ui/IconCircle';

export function MyDataPage() {
  return (
    <div className="max-w-2xl mx-auto px-3 md:px-6 py-6 pb-24 md:pb-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[1.5rem] font-bold font-[family-name:var(--font-heading)] text-text-primary">
          My Data
        </h1>
        <p className="text-[0.875rem] text-text-secondary mt-1">
          Your health data, owned by you
        </p>
      </div>

      {/* Coming soon cards */}
      <div className="space-y-1.5">
        <Card className="bg-accent-soft/50 border border-accent/10">
          <div className="flex items-center gap-3 mb-3">
            <IconCircle color="accent" size="md">
              <Lock size={18} />
            </IconCircle>
            <div>
              <h2 className="text-[1rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
                Privacy First
              </h2>
              <p className="text-[0.8125rem] text-text-secondary">
                All your health data stays encrypted and under your control
              </p>
            </div>
          </div>
        </Card>

        {[
          {
            icon: FileText,
            title: 'Health Records',
            description: 'View and export all your entries, assessments, and triage history',
          },
          {
            icon: TrendingUp,
            title: 'Trends & Insights',
            description: 'Visualize symptom patterns, CTAS trends, and health trajectory over time',
          },
          {
            icon: Download,
            title: 'Data Export',
            description: 'Download your complete health record in standard formats (PDF, FHIR)',
          },
          {
            icon: Database,
            title: 'Connected Services',
            description: 'Link with Ontario Health, pharmacy records, and lab results',
          },
        ].map(({ icon: Icon, title, description }) => (
          <Card key={title} className="opacity-60">
            <div className="flex items-start gap-3">
              <IconCircle size="md">
                <Icon size={18} />
              </IconCircle>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-[0.9375rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
                    {title}
                  </h3>
                  <span className="px-2 py-0.5 text-[0.6875rem] font-medium rounded-[var(--radius-sm)] bg-surface-soft text-text-tertiary">
                    Coming Soon
                  </span>
                </div>
                <p className="text-[0.8125rem] text-text-secondary mt-0.5">{description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
