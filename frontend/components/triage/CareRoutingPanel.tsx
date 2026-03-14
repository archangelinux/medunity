'use client';

import { X, MapPin, Clock, Stethoscope, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { IconCircle } from '@/components/ui/IconCircle';
import type { Clinic, CareType } from '@/lib/types';

interface CareRoutingPanelProps {
  clinics: Clinic[];
  onClose: () => void;
}

const typeLabels: Record<CareType, string> = {
  'walk-in': 'Walk-in',
  er: 'ER',
  'urgent-care': 'Urgent Care',
  telehealth: 'Telehealth',
  'campus-health': 'Campus Health',
};

const typeBadgeVariant: Record<CareType, 'accent' | 'info' | 'warning' | 'danger' | 'default'> = {
  'walk-in': 'accent',
  er: 'danger',
  'urgent-care': 'warning',
  telehealth: 'info',
  'campus-health': 'default',
};

function getWaitColor(minutes: number) {
  if (minutes <= 15) return 'text-accent';
  if (minutes <= 30) return 'text-warning';
  return 'text-danger';
}

export function CareRoutingPanel({ clinics, onClose }: CareRoutingPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative slide-up w-full md:max-w-lg max-h-[85vh] overflow-y-auto bg-bg rounded-t-[var(--radius-lg)] md:rounded-[var(--radius-lg)] p-1.5">
        {/* Header card */}
        <Card className="mb-1.5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <IconCircle color="accent" size="md">
                <Stethoscope size={18} />
              </IconCircle>
              <div>
                <h2 className="text-[1.125rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
                  Care Options
                </h2>
                <p className="text-[0.75rem] text-text-tertiary">
                  Based on your triage assessment
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-[var(--radius-md)] bg-surface-soft text-text-tertiary
                         hover:bg-border-soft hover:text-text-secondary
                         flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
          <div className="bg-accent-soft rounded-[var(--radius-sm)] px-3.5 py-2.5">
            <p className="text-[0.8125rem] text-accent font-medium">
              CTAS 4 · Less Urgent. Recommended: GP or Walk-in within 1 week.
            </p>
          </div>
        </Card>

        {/* Clinic cards */}
        <div className="space-y-1.5">
          {clinics.map((clinic) => (
            <Card
              key={clinic.id}
              hoverable
              className={clinic.recommended ? 'ring-1 ring-accent/20' : ''}
            >
              {clinic.recommended && (
                <Badge variant="accent" className="mb-2">Best match</Badge>
              )}

              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-[0.9375rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
                    {clinic.name}
                  </h3>
                  <Badge variant={typeBadgeVariant[clinic.type]} className="mt-1">
                    {typeLabels[clinic.type]}
                  </Badge>
                </div>
                <div className="text-right">
                  <span className={`text-[2rem] font-bold font-[family-name:var(--font-heading)] leading-none ${getWaitColor(clinic.waitMinutes)}`}>
                    {clinic.waitMinutes}
                  </span>
                  <span className="text-[0.6875rem] text-text-tertiary ml-0.5">min</span>
                  {/* Urgency bar */}
                  <div className="mt-1 h-[4px] w-16 bg-surface-soft rounded-full overflow-hidden ml-auto">
                    <div
                      className={`h-full rounded-full ${
                        clinic.waitMinutes <= 15
                          ? 'bg-accent'
                          : clinic.waitMinutes <= 30
                          ? 'bg-warning'
                          : 'bg-danger'
                      }`}
                      style={{ width: `${Math.min((clinic.waitMinutes / 60) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 mb-3">
                {clinic.distanceKm > 0 && (
                  <div className="flex items-center gap-2 text-[0.8125rem] text-text-secondary">
                    <MapPin size={13} className="text-text-tertiary" />
                    <span>{clinic.distanceKm} km · {clinic.address}</span>
                  </div>
                )}
                {clinic.distanceKm === 0 && (
                  <div className="flex items-center gap-2 text-[0.8125rem] text-text-secondary">
                    <MapPin size={13} className="text-text-tertiary" />
                    <span>{clinic.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[0.8125rem] text-text-secondary">
                  <Clock size={13} className="text-text-tertiary" />
                  <span>{clinic.hours}</span>
                  {clinic.isOpen && (
                    <span className="text-accent text-[0.75rem] font-medium">
                      Open {clinic.closingTime ? `· Closes ${clinic.closingTime}` : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(Array.isArray(clinic.services) ? clinic.services : []).map((service) => (
                  <span
                    key={service}
                    className="px-2 py-0.5 text-[0.6875rem] rounded-[var(--radius-sm)] bg-surface-soft text-text-tertiary"
                  >
                    {service}
                  </span>
                ))}
              </div>
            </Card>
          ))}
        </div>

        {/* Contextual note */}
        <Card className="mt-1.5 bg-cream">
          <p className="text-[0.8125rem] text-text-secondary leading-relaxed">
            Based on your symptoms, a GP assessment is recommended. <strong>MediCentre Walk-In</strong> has blood work on-site, which can handle investigation in one visit.
          </p>
        </Card>
      </div>
    </div>
  );
}
