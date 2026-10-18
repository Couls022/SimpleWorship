import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';

interface StageCountdownTimerProps {
  label?: string;
  enabled?: boolean;
  initialTimeStr?: string;
  isProjectorMode?: boolean;
}

export const StageCountdownTimer: React.FC<StageCountdownTimerProps> = ({
  label: _propLabel,
  enabled = true,
  isProjectorMode = false,
}) => {
  const opts = useStore(state => state.systemOptions?.serviceIntervals);

  const label = opts?.intervalType || _propLabel || 'Pre-Service Countdown';
  const isRunning = opts?.isRunning ?? false;
  const targetTimestamp = opts?.targetTimestamp || null;
  const pausedRemainingSecs = opts?.pausedRemainingSecs ?? null;
  const initialTimeStr = opts?.countdownTime || '05:00';
  const fontFamily = opts?.fontFamily || 'Segoe UI, monospace';
  const fontColor = opts?.fontColor || '#ffffff';
  const mainFontSize = Math.max(60, Math.min(720, Number(opts?.fontSize) || 440));
  const independentStageSize = Boolean(opts?.independentStageSize);
  const rawStageSize = Math.max(10, Math.min(96, Number(opts?.stageTimerSize) || 16));

  // Compute effective Stage Display timer font size (independent or linked to Main Display)
  const effectiveStageFontSize = independentStageSize
    ? (isProjectorMode ? Math.round(rawStageSize * 1.35) : rawStageSize)
    : Math.max(11, Math.round((mainFontSize / 440) * (isProjectorMode ? 24 : 15)));

  const handleAdjustStageSize = (delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (independentStageSize) {
      const next = Math.max(10, Math.min(96, rawStageSize + delta));
      useStore.getState().setServiceIntervalConfig({ stageTimerSize: next });
    } else {
      const nextMain = Math.max(60, Math.min(720, mainFontSize + delta * 20));
      useStore.getState().setServiceIntervalConfig({ fontSize: nextMain });
    }
  };

  const parseSeconds = (timeStr: string): number => {
    if (!timeStr) return 300;
    const parts = timeStr.trim().split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10) || 0;
      const secs = parseInt(parts[1], 10) || 0;
      return mins * 60 + secs;
    }
    const num = parseInt(timeStr, 10);
    return isNaN(num) ? 300 : num * 60;
  };

  const calculateRemaining = () => {
    if (pausedRemainingSecs !== null && pausedRemainingSecs !== undefined) {
      return Math.max(0, pausedRemainingSecs);
    }
    if (!targetTimestamp || !isRunning) {
      return parseSeconds(initialTimeStr);
    }
    const diff = targetTimestamp - Date.now();
    return diff > 0 ? Math.ceil(diff / 1000) : 0;
  };

  const [remainingSecs, setRemainingSecs] = useState<number>(calculateRemaining());

  useEffect(() => {
    const initial = calculateRemaining();
    setRemainingSecs(initial);
    if (!enabled || !isRunning || !targetTimestamp) return;

    if (initial <= 0) {
      useStore.getState().completeServiceTimerToLogo();
      return;
    }

    const timer = setInterval(() => {
      const current = calculateRemaining();
      setRemainingSecs(current);
      if (current <= 0) {
        clearInterval(timer);
        useStore.getState().completeServiceTimerToLogo();
      }
    }, 200);
    return () => clearInterval(timer);
  }, [enabled, isRunning, targetTimestamp, pausedRemainingSecs, initialTimeStr]);

  if (!enabled) return null;

  const mins = Math.floor(remainingSecs / 60);
  const secs = remainingSecs % 60;
  const formattedTime = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;

  return (
    <div
      className={`group flex items-center gap-1.5 px-2.5 py-0.5 rounded border font-mono select-none shadow-sm transition-all ${
        isRunning
          ? 'bg-amber-950/80 border-amber-500/70'
          : pausedRemainingSecs !== null
          ? 'bg-amber-950/40 border-amber-600/40'
          : 'bg-cyan-950/70 border-cyan-700/40'
      }`}
      style={{
        fontFamily,
        fontSize: `${effectiveStageFontSize}px`,
        lineHeight: 1.25,
      }}
    >
      <span className="font-semibold text-gray-300 truncate max-w-[160px]" style={{ fontSize: '0.82em' }}>
        {label}:
      </span>
      <span
        className="font-black tabular-nums"
        style={{ color: fontColor || '#ffffff' }}
      >
        {formattedTime}
      </span>
      {!isRunning && pausedRemainingSecs !== null && (
        <span className="text-[9px] uppercase px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
          PAUSED
        </span>
      )}
      {!isProjectorMode && (
        <div className="flex items-center gap-1 ml-1 pl-1 border-l border-white/10 text-[10px] font-sans">
          <input
            type="color"
            value={/^#[0-9A-Fa-f]{6}$/.test(fontColor) ? fontColor : '#ffffff'}
            onClick={(e) => e.stopPropagation()}
            onInput={(e) => {
              e.stopPropagation();
              const val = (e.target as HTMLInputElement).value;
              useStore.getState().setServiceIntervalConfig({ fontColor: val });
            }}
            onChange={(e) => {
              e.stopPropagation();
              useStore.getState().setServiceIntervalConfig({ fontColor: e.target.value });
            }}
            className="w-3.5 h-3.5 rounded-xs border border-white/30 bg-transparent cursor-pointer p-0 shrink-0"
            title="Change Timer Font Color"
          />
          <button
            type="button"
            onClick={(e) => handleAdjustStageSize(-2, e)}
            className="px-1 py-0 rounded bg-black/40 hover:bg-black/70 text-gray-300 hover:text-white transition-colors cursor-pointer"
            title="Decrease Timer Size"
          >
            -
          </button>
          <button
            type="button"
            onClick={(e) => handleAdjustStageSize(2, e)}
            className="px-1 py-0 rounded bg-black/40 hover:bg-black/70 text-gray-300 hover:text-white transition-colors cursor-pointer"
            title="Increase Timer Size"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
};
