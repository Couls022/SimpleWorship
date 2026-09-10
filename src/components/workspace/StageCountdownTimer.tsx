import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';

interface StageCountdownTimerProps {
  initialTimeStr?: string;
  label?: string;
  enabled?: boolean;
}

export const StageCountdownTimer: React.FC<StageCountdownTimerProps> = ({
  initialTimeStr = '05:00',
  label = 'Pre-Service Countdown',
  enabled = true,
}) => {
  // Parse mm:ss into seconds
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

  const [totalSeconds, setTotalSeconds] = useState<number>(() => parseSeconds(initialTimeStr));
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const prevTimeRef = useRef<string>(initialTimeStr);

  // Sync when initialTimeStr changes from options
  useEffect(() => {
    if (initialTimeStr !== prevTimeRef.current) {
      prevTimeRef.current = initialTimeStr;
      setTotalSeconds(parseSeconds(initialTimeStr));
      setIsRunning(true);
    }
  }, [initialTimeStr]);

  // Countdown timer loop
  useEffect(() => {
    if (!enabled || !isRunning || totalSeconds <= 0) return;

    const timer = setInterval(() => {
      setTotalSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [enabled, isRunning, totalSeconds]);

  if (!enabled) return null;

  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const formattedTime = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  const isExpired = totalSeconds === 0;

  const handleReset = () => {
    setTotalSeconds(parseSeconds(initialTimeStr));
    setIsRunning(true);
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-700/50 text-xs font-mono select-none">
      <span className="font-semibold text-gray-300">{label}:</span>
      <span
        className={`font-bold transition-colors ${
          isExpired
            ? 'text-rose-400 animate-pulse'
            : totalSeconds < 60
            ? 'text-amber-400'
            : 'text-cyan-400'
        }`}
      >
        {isExpired ? '00:00 (LIVE)' : formattedTime}
      </span>
      <div className="flex items-center gap-0.5 ml-1 border-l border-cyan-800/60 pl-1">
        <button
          type="button"
          onClick={() => setIsRunning((r) => !r)}
          className="p-0.5 hover:text-white text-cyan-300 rounded transition-colors"
          title={isRunning ? 'Pause countdown' : 'Resume countdown'}
        >
          {isRunning ? <Pause size={10} /> : <Play size={10} />}
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="p-0.5 hover:text-white text-cyan-300 rounded transition-colors"
          title="Reset countdown"
        >
          <RotateCcw size={10} />
        </button>
      </div>
    </div>
  );
};
