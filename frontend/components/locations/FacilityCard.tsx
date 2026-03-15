'use client';

import {
  MapPin,
  Clock,
  Car,
  Phone,
  MessageCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Shield,
} from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ResourceList } from './ResourceList';
import type { LocationFacility, FacilityType } from '@/lib/types';

const typeLabels: Record<FacilityType, string> = {
  hospital: 'Hospital / ER',
  'walk-in': 'Walk-in Clinic',
  'urgent-care': 'Urgent Care',
  'community-centre': 'Community Centre',
  'wellness-centre': 'Wellness Centre',
  telehealth: 'Telehealth',
};

const typeBadgeVariant: Record<FacilityType, 'accent' | 'info' | 'warning' | 'danger' | 'default'> = {
  hospital: 'danger',
  'walk-in': 'accent',
  'urgent-care': 'warning',
  'community-centre': 'default',
  'wellness-centre': 'info',
  telehealth: 'info',
};

function getWaitColor(minutes: number) {
  if (minutes <= 20) return 'text-accent';
  if (minutes <= 45) return 'text-warning';
  return 'text-danger';
}

function getStrainBadge(strain: string) {
  switch (strain) {
    case 'low': return <Badge variant="accent">Low Strain</Badge>;
    case 'moderate': return <Badge variant="warning">Moderate Strain</Badge>;
    case 'high': return <Badge variant="danger">High Strain</Badge>;
    case 'critical': return <Badge variant="danger">Critical Strain</Badge>;
    default: return null;
  }
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface FacilityCardProps {
  facility: LocationFacility;
  isSelected: boolean;
  onSelect: () => void;
  onReport: () => void;
}

export function FacilityCard({ facility, isSelected, onSelect, onReport }: FacilityCardProps) {
  const [showReports, setShowReports] = useState(false);
  const [showResources, setShowResources] = useState(false);
  const hasResources = facility.resources && facility.resources.length > 0;
  const donationsNeeded = facility.resources?.filter((r) => r.donationNeeded) ?? [];
  const totalMinutes = (facility.waitMinutes ?? 0) + (facility.travelMinutes ?? 0);
  const hasMedicalWait = facility.type === 'hospital' || facility.type === 'walk-in' || facility.type === 'urgent-care';

  // Latest strain report from a professional
  const latestStrain = facility.reports
    .filter((r) => r.reporterType === 'medical-professional' && r.strainLevel)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  return (
    <Card
      className={`transition-all duration-200 ${isSelected ? 'ring-2 ring-accent/30 shadow-md' : ''}`}
      onClick={onSelect}
      hoverable
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-[0.9375rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary truncate">
            {facility.name}
          </h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant={typeBadgeVariant[facility.type]}>
              {typeLabels[facility.type]}
            </Badge>
            {latestStrain && getStrainBadge(latestStrain.strainLevel!)}
          </div>
        </div>

        {/* Wait + Travel time */}
        {hasMedicalWait && facility.waitMinutes != null && (
          <div className="text-right ml-3 flex-shrink-0">
            <span className={`text-[1.75rem] font-bold font-[family-name:var(--font-heading)] leading-none ${getWaitColor(facility.waitMinutes)}`}>
              {facility.waitMinutes}
            </span>
            <span className="text-[0.6875rem] text-text-tertiary ml-0.5">min</span>
            {/* Wait bar */}
            <div className="mt-1 h-[4px] w-14 bg-surface-soft rounded-full overflow-hidden ml-auto">
              <div
                className={`h-full rounded-full ${
                  facility.waitMinutes <= 20 ? 'bg-accent' : facility.waitMinutes <= 45 ? 'bg-warning' : 'bg-danger'
                }`}
                style={{ width: `${Math.min((facility.waitMinutes / 120) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Location & Hours */}
      <div className="space-y-1 mb-3">
        <div className="flex items-center gap-2 text-[0.8125rem] text-text-secondary">
          <MapPin size={13} className="text-text-tertiary flex-shrink-0" />
          <span className="truncate">{facility.address}</span>
        </div>
        <div className="flex items-center gap-2 text-[0.8125rem] text-text-secondary">
          <Clock size={13} className="text-text-tertiary flex-shrink-0" />
          <span>{facility.hours}</span>
          {facility.isOpen && (
            <span className="text-accent text-[0.75rem] font-medium">
              Open{facility.closingTime ? ` · Closes ${facility.closingTime}` : ''}
            </span>
          )}
        </div>
        {facility.travelMinutes != null && facility.travelMinutes > 0 && (
          <div className="flex items-center gap-2 text-[0.8125rem] text-text-secondary">
            <Car size={13} className="text-text-tertiary flex-shrink-0" />
            <span>~{facility.travelMinutes} min drive</span>
            {facility.distanceKm != null && (
              <span className="text-text-tertiary">({facility.distanceKm} km)</span>
            )}
          </div>
        )}
        {facility.phone && (
          <div className="flex items-center gap-2 text-[0.8125rem] text-text-secondary">
            <Phone size={13} className="text-text-tertiary flex-shrink-0" />
            <span>{facility.phone}</span>
          </div>
        )}
      </div>

      {/* Total time */}
      {hasMedicalWait && facility.waitMinutes != null && facility.travelMinutes != null && facility.travelMinutes > 0 && (
        <div className="bg-surface-soft rounded-[var(--radius-sm)] px-3 py-2 mb-3 flex items-center justify-between">
          <span className="text-[0.8125rem] text-text-secondary font-medium">Total estimated time</span>
          <div className="flex items-center gap-1.5">
            <span className="text-[0.75rem] text-text-tertiary">{facility.travelMinutes} drive + {facility.waitMinutes} wait =</span>
            <span className="text-[1rem] font-bold font-[family-name:var(--font-heading)] text-text-primary">{totalMinutes} min</span>
          </div>
        </div>
      )}

      {/* Donation alert */}
      {donationsNeeded.length > 0 && (
        <div className="bg-warning-soft rounded-[var(--radius-sm)] px-3 py-2 mb-3 flex items-start gap-2">
          <AlertTriangle size={14} className="text-warning mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[0.8125rem] font-medium text-warning">Donations needed</p>
            <p className="text-[0.75rem] text-text-secondary mt-0.5">
              {donationsNeeded.map((r) => r.name).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Services */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {facility.services.map((service) => (
          <span
            key={service}
            className="px-2 py-0.5 text-[0.6875rem] rounded-[var(--radius-sm)] bg-surface-soft text-text-tertiary"
          >
            {service}
          </span>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-soft">
        {hasResources && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowResources(!showResources); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[0.8125rem] font-medium text-text-secondary
                       hover:bg-surface-soft rounded-[var(--radius-sm)] transition-colors cursor-pointer"
          >
            <Shield size={14} />
            Resources ({facility.resources!.length})
            {showResources ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
        {facility.reports.length > 0 && (
          <button
            onClick={(e) => { e.stopPropagation(); setShowReports(!showReports); }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[0.8125rem] font-medium text-text-secondary
                       hover:bg-surface-soft rounded-[var(--radius-sm)] transition-colors cursor-pointer"
          >
            <MessageCircle size={14} />
            Reports ({facility.reports.length})
            {showReports ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onReport(); }}
          className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 text-[0.8125rem] font-medium text-accent
                     hover:bg-accent-soft rounded-[var(--radius-sm)] transition-colors cursor-pointer"
        >
          <MessageCircle size={14} />
          Submit Report
        </button>
      </div>

      {/* Resources expandable */}
      {showResources && hasResources && (
        <div className="mt-3 pt-3 border-t border-border-soft">
          <ResourceList resources={facility.resources!} />
        </div>
      )}

      {/* Reports expandable */}
      {showReports && facility.reports.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border-soft space-y-2">
          {facility.reports.map((report) => (
            <div key={report.id} className="bg-surface-soft rounded-[var(--radius-sm)] px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={report.reporterType === 'medical-professional' ? 'info' : 'default'}>
                  {report.reporterType === 'medical-professional' ? 'Staff' : 'Visitor'}
                </Badge>
                {report.strainLevel && getStrainBadge(report.strainLevel)}
                {report.waitTimeUpdate && (
                  <span className="text-[0.75rem] text-text-tertiary">
                    Reported wait: {report.waitTimeUpdate} min
                  </span>
                )}
                <span className="text-[0.6875rem] text-text-tertiary ml-auto">{timeAgo(report.createdAt)}</span>
              </div>
              <p className="text-[0.8125rem] text-text-secondary">{report.message}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
