'use client';

import { useState, useEffect, useRef } from 'react';
import {
  ClipboardCheck,
  Brain,
  FileText,
  Database,
  Check,
  Loader2,
} from 'lucide-react';
import type { PipelineStep } from '@/lib/api';

const STEP_DEFS = [
  {
    id: 'intake',
    icon: ClipboardCheck,
    label: 'Intake Processing',
    sublabel: null,
    running: 'Recording triage responses...',
  },
  {
    id: 'ctas',
    icon: Brain,
    label: 'Clinical Triage Model',
    sublabel: 'Fine-tuned · Vertex AI',
    running: 'Assessing severity with CTAS guidelines...',
  },
  {
    id: 'report',
    icon: FileText,
    label: 'Assessment Agent',
    sublabel: 'Gemini 2.5 Flash',
    running: 'Generating clinical report...',
  },
  {
    id: 'finalize',
    icon: Database,
    label: 'Finalizing',
    sublabel: null,
    running: 'Saving assessment...',
  },
] as const;

type StepStatus = 'waiting' | 'running' | 'done';

const CTAS_COLORS: Record<number, string> = {
  1: '#E5625E', 2: '#CD533B', 3: '#2364AA', 4: '#62A8AC', 5: '#8BA868',
};
const CTAS_BG: Record<number, string> = {
  1: '#FADCDB', 2: '#F8D5CC', 3: '#CDDDF2', 4: '#D4EDEE', 5: '#E8F2D8',
};

interface AgentPipelineProps {
  steps: Record<string, PipelineStep>;
  complete: boolean;
}

export function AgentPipeline({ steps, complete }: AgentPipelineProps) {
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const startTimes = useRef<Record<string, number>>({});
  const endTimes = useRef<Record<string, number>>({});

  // Track start/end times for each step
  useEffect(() => {
    for (const [id, step] of Object.entries(steps)) {
      if (step.status === 'running' && !startTimes.current[id]) {
        startTimes.current[id] = Date.now();
      }
      if (step.status === 'done' && !endTimes.current[id]) {
        endTimes.current[id] = Date.now();
      }
    }
  }, [steps]);

  // Live elapsed timer
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const next: Record<string, number> = {};
      for (const [id, start] of Object.entries(startTimes.current)) {
        next[id] = ((endTimes.current[id] || now) - start) / 1000;
      }
      setElapsed(next);
    }, 100);
    return () => clearInterval(iv);
  }, []);

  const getStatus = (id: string): StepStatus => steps[id]?.status ?? 'waiting';

  return (
    <div
      className={`pipeline-container bg-surface-soft rounded-[var(--radius-md)] overflow-hidden transition-all duration-700 ease-in-out ${
        complete
          ? 'max-h-0 opacity-0 scale-y-95 mb-0 mt-0 origin-top'
          : 'max-h-[500px] opacity-100 scale-y-100 mb-3'
      }`}
    >
      {/* Header */}
      <div className="px-4 pt-3.5 pb-1.5 flex items-center gap-2.5">
        <div className="relative flex items-center justify-center w-[18px] h-[18px]">
          {!complete && (
            <div className="absolute inset-0 rounded-full bg-accent/20 pipeline-radar" />
          )}
          <div className="relative w-2 h-2 rounded-full bg-accent" />
        </div>
        <span className="text-[0.8125rem] font-semibold font-[family-name:var(--font-heading)] text-text-primary">
          Agent Pipeline
        </span>
        <span className="text-[0.625rem] text-text-tertiary ml-auto font-medium tabular-nums">
          {Object.values(steps).filter((s) => s.status === 'done').length}/{STEP_DEFS.length}
        </span>
      </div>

      {/* Steps */}
      <div className="px-4 pb-3.5 pt-1">
        {STEP_DEFS.map((def, i) => {
          const status = getStatus(def.id);
          const step = steps[def.id];
          const Icon = def.icon;
          const isLast = i === STEP_DEFS.length - 1;
          const time = elapsed[def.id];
          const ctasData = step?.data as Record<string, unknown> | undefined;
          const ctasLevel = ctasData?.ctas_level as number | undefined;
          const ctasLabel = ctasData?.ctas_label as string | undefined;
          const model = ctasData?.model as string | undefined;

          return (
            <div key={def.id} className="relative flex gap-3">
              {/* Timeline */}
              <div className="flex flex-col items-center w-7 flex-shrink-0">
                {/* Node */}
                <div
                  className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full transition-all duration-500 ${
                    status === 'done'
                      ? 'bg-accent text-white pipeline-node-done'
                      : status === 'running'
                        ? 'bg-accent/10 text-accent border-[1.5px] border-accent'
                        : 'bg-surface text-text-tertiary border border-border-soft'
                  }`}
                >
                  {status === 'done' ? (
                    <Check size={12} strokeWidth={3} />
                  ) : status === 'running' ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Icon size={11} className="opacity-50" />
                  )}
                  {status === 'running' && (
                    <div className="absolute inset-[-3px] rounded-full border border-accent/30 pipeline-radar" />
                  )}
                </div>
                {/* Connector line */}
                {!isLast && (
                  <div className="w-px flex-1 my-[2px] relative overflow-hidden">
                    <div className="absolute inset-0 bg-border-soft" />
                    <div
                      className="absolute inset-0 bg-accent origin-top transition-transform duration-500 ease-out"
                      style={{ transform: status === 'done' ? 'scaleY(1)' : 'scaleY(0)' }}
                    />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 min-w-0 ${isLast ? 'pb-1' : 'pb-3'}`}>
                <div className="flex items-center gap-2 min-h-[28px]">
                  <span
                    className={`text-[0.8125rem] font-semibold transition-colors duration-300 leading-tight ${
                      status === 'waiting' ? 'text-text-tertiary' : 'text-text-primary'
                    }`}
                  >
                    {def.label}
                  </span>
                  {def.sublabel && status !== 'waiting' && (
                    <span className="text-[0.5625rem] text-text-tertiary bg-surface px-1.5 py-[2px] rounded font-medium tracking-wide uppercase whitespace-nowrap">
                      {model && def.id === 'ctas' ? model.replace('-', ' ') : def.sublabel}
                    </span>
                  )}
                  {time !== undefined && (
                    <span className="text-[0.5625rem] text-text-tertiary tabular-nums ml-auto font-medium">
                      {time.toFixed(1)}s
                    </span>
                  )}
                </div>

                <p
                  className={`text-[0.75rem] leading-relaxed transition-colors duration-300 ${
                    status === 'running'
                      ? 'text-accent'
                      : status === 'done'
                        ? 'text-text-secondary'
                        : 'text-text-tertiary/60'
                  }`}
                >
                  {status === 'done' && step?.detail
                    ? step.detail.length > 120
                      ? step.detail.slice(0, 120) + '...'
                      : step.detail
                    : status === 'running'
                      ? step?.detail || def.running
                      : 'Queued'}
                </p>

                {/* CTAS badge when triage step completes */}
                {def.id === 'ctas' && status === 'done' && ctasLevel && (
                  <div className="mt-1.5 pipeline-result-enter">
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-[3px] text-[0.6875rem] font-bold rounded-[6px]"
                      style={{
                        backgroundColor: CTAS_BG[ctasLevel] || '#e5e7eb',
                        color: CTAS_COLORS[ctasLevel] || '#6b7280',
                      }}
                    >
                      CTAS {ctasLevel} &middot; {ctasLabel}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
