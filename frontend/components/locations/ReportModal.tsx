'use client';

import { useState } from 'react';
import { X, Send, AlertTriangle, Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { LocationFacility, LocationReport, Resource } from '@/lib/types';

interface ReportModalProps {
  facility: LocationFacility;
  onClose: () => void;
  onSubmit: (report: Omit<LocationReport, 'id' | 'createdAt'>) => void;
}

const isCommunityOrWellness = (type: string) =>
  type === 'community-centre' || type === 'wellness-centre';

export function ReportModal({ facility, onClose, onSubmit }: ReportModalProps) {
  const [reporterType, setReporterType] = useState<'visitor' | 'medical-professional'>('visitor');
  const [message, setMessage] = useState('');
  const [waitTimeUpdate, setWaitTimeUpdate] = useState('');
  const [strainLevel, setStrainLevel] = useState<'low' | 'moderate' | 'high' | 'critical' | ''>('');
  // Resource shortage toggles (only for community/wellness centres)
  const [shortageIds, setShortageIds] = useState<Set<string>>(new Set());

  const hasResources = isCommunityOrWellness(facility.type) && facility.resources && facility.resources.length > 0;

  const toggleShortage = (resourceId: string) => {
    setShortageIds((prev) => {
      const next = new Set(prev);
      if (next.has(resourceId)) next.delete(resourceId);
      else next.add(resourceId);
      return next;
    });
  };

  const handleSubmit = () => {
    // Build message with resource shortages appended
    let fullMessage = message.trim();
    if (shortageIds.size > 0 && facility.resources) {
      const shortageNames = facility.resources
        .filter((r) => shortageIds.has(r.id))
        .map((r) => r.name);
      if (shortageNames.length > 0) {
        const shortageText = `\n\nResource shortages reported: ${shortageNames.join(', ')}`;
        fullMessage = fullMessage ? fullMessage + shortageText : `Resource shortages: ${shortageNames.join(', ')}`;
      }
    }

    if (!fullMessage) return;

    onSubmit({
      facilityId: facility.id,
      reporterType,
      message: fullMessage,
      waitTimeUpdate: waitTimeUpdate ? parseInt(waitTimeUpdate) : undefined,
      strainLevel: strainLevel || undefined,
    });
    onClose();
  };

  const canSubmit = message.trim() || shortageIds.size > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative slide-up w-full md:max-w-md bg-bg rounded-t-[var(--radius-lg)] md:rounded-[var(--radius-lg)] p-1.5 max-h-[90vh] overflow-y-auto">
        <Card>
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-[1.125rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
                Submit Report
              </h2>
              <p className="text-[0.8125rem] text-text-secondary mt-0.5">{facility.name}</p>
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

          {/* Reporter type */}
          <div className="mb-4">
            <label className="text-[0.8125rem] font-medium text-text-secondary block mb-2">I am a</label>
            <div className="flex gap-2">
              <button
                onClick={() => setReporterType('visitor')}
                className={`flex-1 px-3 py-2 rounded-[var(--radius-sm)] text-[0.8125rem] font-medium transition-colors cursor-pointer ${
                  reporterType === 'visitor'
                    ? 'bg-accent-soft text-accent border border-accent/20'
                    : 'bg-surface-soft text-text-secondary border border-transparent hover:bg-border-soft'
                }`}
              >
                Visitor / Patient
              </button>
              <button
                onClick={() => setReporterType('medical-professional')}
                className={`flex-1 px-3 py-2 rounded-[var(--radius-sm)] text-[0.8125rem] font-medium transition-colors cursor-pointer ${
                  reporterType === 'medical-professional'
                    ? 'bg-info-soft text-info border border-info/20'
                    : 'bg-surface-soft text-text-secondary border border-transparent hover:bg-border-soft'
                }`}
              >
                {isCommunityOrWellness(facility.type) ? 'Staff' : 'Medical Professional'}
              </button>
            </div>
          </div>

          {/* Wait time (optional — medical facilities only) */}
          {!isCommunityOrWellness(facility.type) && (
            <div className="mb-4">
              <label className="text-[0.8125rem] font-medium text-text-secondary block mb-2">
                Current wait time (minutes, optional)
              </label>
              <input
                type="number"
                value={waitTimeUpdate}
                onChange={(e) => setWaitTimeUpdate(e.target.value)}
                placeholder="e.g. 90"
                className="w-full px-3 py-2 rounded-[var(--radius-sm)] bg-surface-soft border border-border-soft
                           text-[0.875rem] text-text-primary placeholder-text-tertiary
                           focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30
                           transition-all"
              />
            </div>
          )}

          {/* Strain level (for medical professionals at hospitals/clinics only) */}
          {reporterType === 'medical-professional' && !isCommunityOrWellness(facility.type) && (
            <div className="mb-4">
              <label className="text-[0.8125rem] font-medium text-text-secondary block mb-2">
                Current strain level
              </label>
              <div className="flex flex-wrap gap-2">
                {(['low', 'moderate', 'high', 'critical'] as const).map((level) => (
                  <button
                    key={level}
                    onClick={() => setStrainLevel(strainLevel === level ? '' : level)}
                    className={`px-3 py-1.5 rounded-[var(--radius-sm)] text-[0.8125rem] font-medium capitalize transition-colors cursor-pointer ${
                      strainLevel === level
                        ? level === 'low' ? 'bg-accent-soft text-accent border border-accent/20'
                        : level === 'moderate' ? 'bg-warning-soft text-warning border border-warning/20'
                        : 'bg-danger-soft text-danger border border-danger/20'
                        : 'bg-surface-soft text-text-secondary border border-transparent hover:bg-border-soft'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resource shortage reporting — for community/wellness centres with seeded resources */}
          {hasResources && (
            <div className="mb-4">
              <label className="text-[0.8125rem] font-medium text-text-secondary block mb-2">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle size={13} className="text-warning" />
                  Resource availability
                </span>
              </label>
              <p className="text-[0.6875rem] text-text-tertiary mb-2">
                {reporterType === 'medical-professional'
                  ? 'Update which resources are available or flag shortages.'
                  : 'Flag any resources that were unavailable during your visit.'}
              </p>
              <div className="space-y-1">
                {facility.resources!.map((resource) => {
                  const isSelected = shortageIds.has(resource.id);
                  return (
                    <button
                      key={resource.id}
                      onClick={() => toggleShortage(resource.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-sm)] text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-warning-soft border border-warning/20'
                          : 'bg-surface-soft border border-transparent hover:bg-border-soft'
                      }`}
                    >
                      <span className={`text-[0.8125rem] ${isSelected ? 'text-warning font-medium' : 'text-text-secondary'}`}>
                        {resource.name}
                      </span>
                      {isSelected ? (
                        <span className="flex items-center gap-1 text-[0.6875rem] font-medium text-warning">
                          <AlertTriangle size={11} /> Shortage
                        </span>
                      ) : resource.inStock ? (
                        <span className="flex items-center gap-1 text-[0.6875rem] text-accent">
                          <Check size={11} /> In stock
                        </span>
                      ) : (
                        <span className="text-[0.6875rem] text-danger">Out of stock</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Message */}
          <div className="mb-4">
            <label className="text-[0.8125rem] font-medium text-text-secondary block mb-2">
              {hasResources ? 'Additional notes (optional if shortages selected)' : 'Your update'}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                hasResources
                  ? 'Any details about resource availability, conditions, or needs...'
                  : 'Share what you\'re seeing — wait times, conditions, availability...'
              }
              rows={3}
              className="w-full px-3 py-2 rounded-[var(--radius-sm)] bg-surface-soft border border-border-soft
                         text-[0.875rem] text-text-primary placeholder-text-tertiary resize-none
                         focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/30
                         transition-all"
            />
          </div>

          {/* Anonymous note */}
          <div className="bg-surface-soft rounded-[var(--radius-sm)] px-3 py-2 mb-4">
            <p className="text-[0.75rem] text-text-tertiary">
              All reports are anonymous. Your identity is never shared.
            </p>
          </div>

          {/* Submit */}
          <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full" icon={<Send size={16} />}>
            Submit Report
          </Button>
        </Card>
      </div>
    </div>
  );
}
