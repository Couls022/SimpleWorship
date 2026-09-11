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
  const store = useStore();
  const opts = store.systemOptions?.serviceIntervals;

  const label = opts?.intervalType || _propLabel || 'Pre-Service Countdown';
  const isRunning = opts?.isRunning ?? false;
  const targetTimestamp = opts?.targetTimestamp || null;
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
    if (!targetTimestamp) return parseSeconds(initialTimeStr);
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
    }, 500); // 500ms to keep it snappy visually
    return () => clearInterval(timer);
  }, [enabled, isRunning, targetTimestamp, initialTimeStr]);

  if (!enabled) return null;

  const mins = Math.floor(remainingSecs / 60);
  const secs = remainingSecs % 60;
  const formattedTime = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  const isExpired = remainingSecs === 0 && targetTimestamp !== null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/50 text-xs font-mono select-none">
      <span className="font-semibold text-gray-300">{label}:</span>
      <span
        className={`font-bold transition-colors ${
          isExpired
            ? 'text-rose-400 animate-pulse'
            : remainingSecs < 60 && isRunning
            ? 'text-amber-400'
            : 'text-cyan-400'
        }`}
      >
        {isExpired ? '00:00 (LIVE)' : formattedTime}
      </span>
    </div>
  );
};
