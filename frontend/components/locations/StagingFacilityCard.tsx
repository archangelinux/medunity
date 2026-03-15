'use client';

import { useState } from 'react';
import { MapPin, Car, Clock, CheckCircle, Send, XCircle, Navigation } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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

interface StagingFacilityCardProps {
  facility: LocationFacility;
  departureOffset: number;
  isSelected: boolean;
  signalStatus: { signalId: string; status: string } | null;
  onSelect: () => void;
  onSendReport: () => void;
  onCancel?: (signalId: string) => Promise<void>;
  onArrived?: (signalId: string) => Promise<void>;
}

export function StagingFacilityCard({
  facility, departureOffset, isSelected, signalStatus,
  onSelect, onSendReport, onCancel, onArrived,
}: StagingFacilityCardProps) {
  const [actionLoading, setActionLoading] = useState(false);

  const travelMin = facility.travelMinutes ?? 0;
  const waitMin = facility.waitMinutes;
  const hasWait = waitMin != null;
  const arrivalTime = new Date(Date.now() + (departureOffset + travelMin) * 60000);

  const status = signalStatus?.status;
  const isSent = status === 'active';
  const isCancelled = status === 'cancelled';
  const isArrived = status === 'arrived';

  const handleCancel = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!signalStatus || actionLoading) return;
    setActionLoading(true);
    await onCancel?.(signalStatus.signalId);
    setActionLoading(false);
  };

  const handleArrived = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!signalStatus || actionLoading) return;
    setActionLoading(true);
    await onArrived?.(signalStatus.signalId);
    setActionLoading(false);
  };

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
          <Badge variant={typeBadgeVariant[facility.type]} className="mt-1">
            {typeLabels[facility.type]}
          </Badge>
        </div>
      </div>

      {/* Timing row */}
      <div className={`grid ${hasWait ? 'grid-cols-2' : 'grid-cols-1'} gap-2 bg-surface-soft rounded-[var(--radius-sm)] px-3 py-2.5 mb-3`}>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Car size={11} className="text-text-tertiary" />
            <span className="text-[0.6875rem] text-text-tertiary">Travel</span>
          </div>
          <span className="text-[1.125rem] font-bold font-[family-name:var(--font-heading)] text-text-primary">
            {travelMin}
          </span>
          <span className="text-[0.6875rem] text-text-tertiary ml-0.5">min</span>
        </div>
        {hasWait && (
          <div className="text-center border-l border-border-soft">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <Clock size={11} className="text-text-tertiary" />
              <span className="text-[0.6875rem] text-text-tertiary">Est. Wait</span>
            </div>
            <span className="text-[1.125rem] font-bold font-[family-name:var(--font-heading)] text-text-primary">
              ~{waitMin}
            </span>
            <span className="text-[0.6875rem] text-text-tertiary ml-0.5">min</span>
          </div>
        )}
      </div>

      {/* ETA */}
      <div className="flex items-center justify-between text-[0.8125rem] mb-3">
        <span className="text-text-tertiary">Arrive by</span>
        <span className="font-medium text-text-primary">
          ~{arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* Address */}
      <div className="flex items-center gap-2 text-[0.8125rem] text-text-secondary mb-3">
        <MapPin size={13} className="text-text-tertiary flex-shrink-0" />
        <span className="truncate">{facility.address}</span>
      </div>

      {/* CTA — depends on signal status */}
      {isArrived ? (
        <div className="flex items-center justify-center gap-2 py-2 bg-accent-soft rounded-[var(--radius-sm)]">
          <CheckCircle size={16} className="text-accent" />
          <span className="text-[0.8125rem] font-semibold text-accent">Arrived</span>
        </div>
      ) : isCancelled ? (
        <Button
          className="w-full"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onSendReport(); }}
          icon={<Send size={14} />}
        >
          Send Report & ETA
        </Button>
      ) : isSent ? (
        <div className="flex gap-2">
          <Button
            className="flex-1"
            size="sm"
            variant="secondary"
            onClick={handleCancel}
            disabled={actionLoading}
            icon={<XCircle size={14} />}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            size="sm"
            onClick={handleArrived}
            disabled={actionLoading}
            icon={<Navigation size={14} />}
          >
            Arrived
          </Button>
        </div>
      ) : (
        <Button
          className="w-full"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onSendReport(); }}
          icon={<Send size={14} />}
        >
          Send Report & ETA
        </Button>
      )}
    </Card>
  );
}
