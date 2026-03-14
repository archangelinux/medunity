'use client';

import { Package, AlertTriangle, Check, X } from 'lucide-react';
import type { Resource } from '@/lib/types';

const categoryLabels: Record<string, string> = {
  food: 'Food',
  clothing: 'Clothing',
  hygiene: 'Hygiene',
  medical: 'Medical',
  'mental-health': 'Mental Health',
  housing: 'Housing',
  other: 'Other',
};

interface ResourceListProps {
  resources: Resource[];
}

export function ResourceList({ resources }: ResourceListProps) {
  const grouped = resources.reduce<Record<string, Resource[]>>((acc, r) => {
    const cat = r.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Package size={14} className="text-text-tertiary" />
        <span className="text-[0.8125rem] font-medium text-text-primary">
          Resource Inventory
        </span>
      </div>
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <p className="text-[0.6875rem] font-medium text-text-tertiary uppercase tracking-wider mb-1">
            {categoryLabels[category] || category}
          </p>
          <div className="space-y-1">
            {items.map((resource) => (
              <div
                key={resource.id}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-[var(--radius-sm)] ${
                  resource.inStock ? 'bg-surface-soft' : 'bg-danger-soft/50'
                }`}
              >
                <span className="text-[0.8125rem] text-text-secondary">{resource.name}</span>
                <div className="flex items-center gap-2">
                  {resource.inStock ? (
                    <span className="flex items-center gap-1 text-[0.75rem] font-medium text-accent">
                      <Check size={12} /> In Stock
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[0.75rem] font-medium text-danger">
                      <X size={12} /> Out of Stock
                    </span>
                  )}
                  {resource.donationNeeded && (
                    <span className="flex items-center gap-1 text-[0.6875rem] font-medium text-warning">
                      <AlertTriangle size={11} /> Donate
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
