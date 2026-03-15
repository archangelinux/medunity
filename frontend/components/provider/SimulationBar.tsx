'use client';

import { Play, Pause, RotateCcw, Radio, FastForward, CheckCircle } from 'lucide-react';
import type { Scenario } from '@/lib/provider-types';
import { SCENARIOS } from '@/lib/provider-types';

interface SimulationBarProps {
  scenario: Scenario;
  onScenarioChange: (s: Scenario) => void;
  onGenerate: () => void;
  isLive: boolean;
  onToggleLive: () => void;
  onClear: () => void;
  realCount: number;
  simCount: number;
  arrivedCount: number;
  timeSpeed: number;
  onTimeSpeedChange: (speed: number) => void;
  disabled: boolean;
}

const SCENARIO_KEYS: Scenario[] = ['normal', 'flu-season', 'mass-casualty', 'heat-wave'];
const SPEED_OPTIONS = [1, 2, 5, 10];

export function SimulationBar({
  scenario,
  onScenarioChange,
  onGenerate,
  isLive,
  onToggleLive,
  onClear,
  realCount,
  simCount,
  arrivedCount,
  timeSpeed,
  onTimeSpeedChange,
  disabled,
}: SimulationBarProps) {
  const totalCount = realCount + simCount;

  return (
    <div className="bg-surface border-t border-border-soft px-5 py-3 flex items-center gap-4 flex-wrap">
      {/* Scenario selector */}
      <div className="flex items-center gap-1.5">
        <span className="text-[0.6875rem] text-text-tertiary font-medium mr-1">Scenario:</span>
        {SCENARIO_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => onScenarioChange(key)}
            className={`px-2.5 py-1.5 rounded-[var(--radius-sm)] text-[0.6875rem] font-medium transition-colors cursor-pointer ${
              scenario === key
                ? 'bg-accent-soft text-accent'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-soft'
            }`}
          >
            {SCENARIOS[key].label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-6 bg-border-soft" />

      {/* Generate */}
      <button
        onClick={onGenerate}
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 rounded-[var(--radius-md)] bg-accent text-white text-[0.8125rem] font-semibold font-[family-name:var(--font-heading)] hover:bg-accent-hover transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Play size={13} />
        Generate Demand
      </button>

      {/* Live toggle */}
      <button
        onClick={onToggleLive}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 rounded-[var(--radius-md)] text-[0.75rem] font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          isLive
            ? 'bg-danger text-white shadow-sm'
            : 'bg-surface-soft text-text-secondary hover:bg-border-soft'
        }`}
      >
        {isLive ? <Pause size={12} /> : <Radio size={12} />}
        {isLive ? 'Stop Live' : 'Live Updates'}
      </button>

      {/* Time speed toggle */}
      <div className="flex items-center gap-1">
        <FastForward size={12} className="text-text-tertiary" />
        {SPEED_OPTIONS.map((speed) => (
          <button
            key={speed}
            onClick={() => onTimeSpeedChange(speed)}
            className={`px-2 py-1 rounded-[var(--radius-sm)] text-[0.6875rem] font-bold transition-colors cursor-pointer tabular-nums ${
              timeSpeed === speed
                ? speed > 1 ? 'bg-gold-soft text-gold' : 'bg-surface-soft text-text-secondary'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-soft'
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Signal count breakdown */}
      <div className="flex items-center gap-2 text-[0.75rem] tabular-nums">
        {realCount > 0 && (
          <span className="font-semibold text-accent">
            {realCount} real
          </span>
        )}
        {realCount > 0 && simCount > 0 && (
          <span className="text-text-tertiary">+</span>
        )}
        {simCount > 0 && (
          <span className="font-semibold text-text-tertiary">
            {simCount} sim
          </span>
        )}
        {realCount > 0 && simCount > 0 && (
          <>
            <span className="text-text-tertiary">=</span>
            <span className="font-bold text-text-primary">{totalCount}</span>
          </>
        )}
        {totalCount === 0 && (
          <span className="font-semibold text-text-tertiary">0 signals</span>
        )}
        {totalCount > 0 && !(realCount > 0 && simCount > 0) && (
          <span className="text-text-tertiary">signals</span>
        )}
        {arrivedCount > 0 && (
          <>
            <div className="w-px h-4 bg-border-soft" />
            <span className="flex items-center gap-1 font-medium text-accent">
              <CheckCircle size={11} />
              {arrivedCount} arrived
            </span>
          </>
        )}
      </div>

      {/* Reset (only clears simulation) */}
      <button
        onClick={onClear}
        disabled={simCount === 0 && arrivedCount === 0}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[var(--radius-sm)] text-[0.6875rem] text-text-tertiary hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <RotateCcw size={11} />
        Reset Sim
      </button>
    </div>
  );
}
