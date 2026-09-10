import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { PresentationCore } from '../../core/PresentationCore';
import { ThemeEngine } from '../../core/ThemeEngine';
import { Clock, Eye, AlertCircle } from 'lucide-react';

const StageClock = React.memo(() => {
  const [time, setTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Clock size={16} className="text-amber-400" />
      <span className="text-lg font-mono font-bold text-amber-300">{time}</span>
    </div>
  );
});

export default function StageMonitorContent() {
  const store = useStore();
  const { 
    activeSchedule, 
    groupStates, 
    activeControlGroupId, 
    outputGroups, 
    songsList, 
    alert,
    systemOptions 
  } = store;

  const activeControlState = activeControlGroupId && groupStates[activeControlGroupId] 
    ? groupStates[activeControlGroupId] 
    : groupStates[outputGroups[0]?.id];

  const liveItem = activeControlState ? PresentationCore.getActiveContent(activeSchedule, activeControlState) : null;
  const slides = liveItem ? PresentationCore.generateSlides(liveItem, songsList, systemOptions) : [];
  const currentSlideIndex = activeControlState?.activeSlideIndex ?? 0;
  const currentSlide = slides[currentSlideIndex] || null;
  const nextSlide = slides[currentSlideIndex + 1] || null;

  const foldbackFont = systemOptions?.foldback?.defaultFont;
  const foldbackThemeStyles = ThemeEngine.fontStyleToThemeStyles(foldbackFont);
  const foldbackTextStyle = ThemeEngine.getTextStyle(foldbackThemeStyles, 0.45);

  const clockEnabled = systemOptions?.foldback?.clockEnabled ?? true;
  const countdownEnabled = systemOptions?.serviceIntervals?.countdownEnabled ?? true;
  const countdownTimeStr = systemOptions?.serviceIntervals?.countdownTime || '05:00';
  const countdownLabel = systemOptions?.serviceIntervals?.intervalType || 'Pre-Service Countdown';

  return (
    <div className="h-full w-full bg-black text-white p-3 flex flex-col justify-between select-none overflow-y-auto custom-scrollbar font-sans">
      {/* Top Header: Current Time & Service Interval Countdown */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-2">
        <div className="flex items-center gap-3">
          {clockEnabled && <StageClock />}
          {countdownEnabled && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 text-xs font-mono">
              <span className="font-semibold text-gray-300">{countdownLabel}:</span>
              <span className="font-bold text-cyan-400">{countdownTimeStr}</span>
            </div>
          )}
        </div>
        <div className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-700/50">
          STAGE / CONFIDENCE DISPLAY
        </div>
      </div>

      {/* Main Grid: Current Slide (Large) & Next Slide (Medium) */}
      <div className="flex-1 grid grid-rows-2 gap-2 min-h-0">
        {/* CURRENT LIVE SLIDE */}
        <div className="bg-[#111216] border border-emerald-500/40 rounded p-2.5 flex flex-col justify-between overflow-hidden">
          <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Current Slide: {liveItem?.name || 'Nothing Live'} ({currentSlideIndex + 1}/{slides.length || 1})
          </div>
          <div 
            className="flex-1 flex items-center justify-center text-center p-2 text-sm sm:text-base font-bold whitespace-pre-line overflow-y-auto custom-scrollbar"
            style={{
              ...foldbackTextStyle,
              fontFamily: foldbackFont?.family || 'Segoe UI, sans-serif',
              color: foldbackFont?.color || '#FACC15',
            }}
          >
            {currentSlide?.text || '— No active slide —'}
          </div>
        </div>

        {/* NEXT SLIDE */}
        <div className="bg-[#14161d] border border-blue-500/30 rounded p-2 flex flex-col justify-between overflow-hidden">
          <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Eye size={12} />
            Next Slide: {nextSlide ? `${liveItem?.name} (Slide ${currentSlideIndex + 2})` : 'End of Item'}
          </div>
          <div 
            className="flex-1 flex items-center justify-center text-center p-2 text-xs sm:text-sm font-semibold text-gray-300 whitespace-pre-line overflow-y-auto custom-scrollbar"
            style={{
              fontFamily: foldbackFont?.family || 'Segoe UI, sans-serif',
            }}
          >
            {nextSlide?.text || '— End of Presentation —'}
          </div>
        </div>
      </div>

      {/* Nursery / Stage Alert Banner */}
      {alert.active && (
        <div className="mt-2 p-2 bg-rose-950 border border-rose-600 rounded flex items-center gap-2 text-xs font-bold text-rose-200 animate-pulse">
          <AlertCircle size={14} className="text-rose-400 shrink-0" />
          <span className="truncate">{alert.message}</span>
        </div>
      )}
    </div>
  );
}
