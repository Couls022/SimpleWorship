import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';

interface StageCountdownTimerProps {
  label?: string;
  enabled?: boolean;
  initialTimeStr?: string;
}

export const StageCountdownTimer: React.FC<StageCountdownTimerProps> = ({
  label: _propLabel,
  enabled = true,
}) => {
  const opts = useStore(state => state.systemOptions?.serviceIntervals);

  const label = opts?.intervalType || _propLabel || 'Pre-Service Countdown';
  const isRunning = opts?.isRunning ?? false;
  const targetTimestamp = opts?.targetTimestamp || null;
  const pausedRemainingSecs = opts?.pausedRemainingSecs ?? null;
  const initialTimeStr = opts?.countdownTime || '05:00';

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
    setRemainingSecs(calculateRemaining());
    if (!enabled || !isRunning || !targetTimestamp) return;

    const timer = setInterval(() => {
      setRemainingSecs((prev) => {
        const current = calculateRemaining();
        if (current <= 0) {
          clearInterval(timer);
          return 0;
        }
        return current;
      });
    }, 250); // 250ms for responsive and silky smooth clock sync
    return () => clearInterval(timer);
  }, [enabled, isRunning, targetTimestamp, pausedRemainingSecs, initialTimeStr]);

  if (!enabled) return null;

  const mins = Math.floor(remainingSecs / 60);
  const secs = remainingSecs % 60;
  const formattedTime = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  const isExpired = remainingSecs === 0 && (targetTimestamp !== null || isRunning);

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded border text-xs font-mono select-none shadow-sm transition-all ${
      isExpired
        ? 'bg-rose-950/90 border-rose-600/80 text-rose-300 animate-pulse'
        : isRunning
        ? 'bg-amber-950/80 border-amber-500/70 text-amber-200'
        : pausedRemainingSecs !== null
        ? 'bg-amber-950/40 border-amber-600/40 text-amber-300/80'
        : 'bg-cyan-950/70 border-cyan-700/40 text-cyan-300'
    }`}>
      <span className="font-semibold text-gray-300 truncate max-w-[140px]">{label}:</span>
      <span
        className={`font-black tabular-nums transition-colors ${
          isExpired
            ? 'text-rose-400 font-bold'
            : isRunning
            ? remainingSecs < 60
              ? 'text-rose-400 animate-pulse'
              : 'text-amber-300'
            : 'text-gray-300'
        }`}
      >
        {isExpired ? '00:00 (LIVE)' : formattedTime}
      </span>
      {!isRunning && pausedRemainingSecs !== null && (
        <span className="text-[9px] uppercase px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
          PAUSED
        </span>
      )}
    </div>
  );
};
