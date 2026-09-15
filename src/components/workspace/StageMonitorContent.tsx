import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { PresentationCore } from '../../core/PresentationCore';
import { ThemeEngine } from '../../core/ThemeEngine';
import { Clock, Eye, AlertCircle, ExternalLink, Maximize2, ShieldAlert, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { StageCountdownTimer } from './StageCountdownTimer';
import { DisplayManager } from '../../core/DisplayManager';
import { matchSlideLabel } from '../../utils/slideLabelHelper';
import { useStageConnection } from '../../store/sync';

const StageClock = React.memo(({ isLarge }: { isLarge?: boolean }) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Clock size={isLarge ? 24 : 16} className="text-amber-400" />
      <span className={`${isLarge ? 'text-2xl sm:text-3xl' : 'text-lg'} font-mono font-black text-amber-300`}>{time}</span>
    </div>
  );
});

interface StageMonitorContentProps {
  isProjectorMode?: boolean;
}

export default function StageMonitorContent({ isProjectorMode = false }: StageMonitorContentProps) {
  const activeSchedule = useStore(state => state.activeSchedule);
  const activeControlGroupId = useStore(state => state.activeControlGroupId);
  
  const activeControlState = useStore(React.useCallback(state => {
    return state.activeControlGroupId && state.groupStates[state.activeControlGroupId]
      ? state.groupStates[state.activeControlGroupId]
      : (state.groupStates['group-stage'] || state.groupStates[state.outputGroups[0]?.id]);
  }, []));

  const outputGroups = useStore(state => state.outputGroups);
  const songsList = useStore(state => state.songsList);
  const alert = useStore(state => state.alert);
  const systemOptions = useStore(state => state.systemOptions);

  // Automatic broadcast & engine connection watchdog
  const { status: connStatus, reconnectAttempts, latency, reconnect: forceReconnect } = useStageConnection();

  const liveItem = activeControlState ? PresentationCore.getActiveContent(activeSchedule, activeControlState, activeControlState.directLiveItem) : null;
  const slides = liveItem ? PresentationCore.generateSlides(liveItem, songsList, systemOptions) : [];
  const currentSlideIndex = activeControlState?.activeSlideIndex ?? 0;
  const currentSlide = slides[currentSlideIndex] || null;
  const nextSlide = slides[currentSlideIndex + 1] || null;

  const foldbackFont = systemOptions?.foldback?.defaultFont;
  const foldbackThemeStyles = ThemeEngine.fontStyleToThemeStyles(foldbackFont);
  const foldbackTextStyle = ThemeEngine.getTextStyle(foldbackThemeStyles, isProjectorMode ? 1.0 : 0.45);

  const clockEnabled = systemOptions?.foldback?.clockEnabled ?? true;
  const countdownEnabled = systemOptions?.serviceIntervals?.countdownEnabled ?? true;
  const countdownTimeStr = systemOptions?.serviceIntervals?.countdownTime || '05:00';
  const countdownLabel = systemOptions?.serviceIntervals?.intervalType || 'Pre-Service Countdown';

  const isBlack = Boolean(activeControlState?.isBlack);
  const isClear = Boolean(activeControlState?.isClear);

  const currentMatchedLabel = React.useMemo(() => {
    return matchSlideLabel(currentSlide?.title, systemOptions?.slideLabels);
  }, [currentSlide?.title, systemOptions?.slideLabels]);

  const nextMatchedLabel = React.useMemo(() => {
    return matchSlideLabel(nextSlide?.title, systemOptions?.slideLabels);
  }, [nextSlide?.title, systemOptions?.slideLabels]);

  const handleLaunchStageWindow = () => {
    DisplayManager.openProjector('group-stage', systemOptions?.foldback?.outputMonitor);
  };

  return (
    <div className={`h-full w-full bg-black text-white ${isProjectorMode ? 'p-6 md:p-8' : 'p-3'} flex flex-col justify-between select-none overflow-y-auto min-h-0 custom-scrollbar font-sans`}>
      {/* Top Header: Current Time & Service Interval Countdown */}
      <div className={`flex items-center justify-between border-b border-gray-800 ${isProjectorMode ? 'pb-4 mb-4' : 'pb-2 mb-2'}`}>
        <div className="flex items-center gap-4 flex-wrap">
          {clockEnabled && <StageClock isLarge={isProjectorMode} />}
          {countdownEnabled && (
            <StageCountdownTimer
              initialTimeStr={countdownTimeStr}
              label={countdownLabel}
              enabled={countdownEnabled}
            />
          )}
          {isBlack && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-950/80 border border-rose-600 text-rose-300 text-xs font-bold animate-pulse">
              <ShieldAlert size={14} />
              <span>MAIN OUTPUT: BLACKOUT</span>
            </div>
          )}
          {isClear && !isBlack && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-950/80 border border-amber-600 text-amber-300 text-xs font-bold">
              <span>MAIN OUTPUT: TEXT CLEARED</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Live Engine Sync Connection Status */}
          {connStatus === 'connected' ? (
            <div 
              title={`Broadcast connection active (${latency}ms latency)`}
              className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-600/50 flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span>LIVE SYNC ({latency}ms)</span>
            </div>
          ) : (
            <button
              onClick={() => forceReconnect()}
              title="Connection interrupted. Click to manually force instant reconnection."
              className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-950/90 text-rose-300 border border-rose-500 flex items-center gap-1.5 hover:bg-rose-900 transition-colors cursor-pointer animate-pulse"
            >
              <RefreshCw size={11} className="animate-spin text-rose-400" />
              <span>RECONNECTING...</span>
            </button>
          )}

          {!isProjectorMode && (
            <button
              onClick={handleLaunchStageWindow}
              title="Pop out into full Stage Display Window"
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1e222d] hover:bg-[#2c3242] border border-[#3b4152] text-[11px] font-semibold text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              <ExternalLink size={12} className="text-amber-400" />
              <span>Pop Out Window</span>
            </button>
          )}
          <div className="text-xs font-bold px-2.5 py-1 rounded bg-amber-950/70 text-amber-400 border border-amber-600/50 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>STAGE / CONFIDENCE MONITOR</span>
          </div>
        </div>
      </div>

      {/* Auto-reconnection notice banner if connection is ever interrupted */}
      {connStatus !== 'connected' && (
        <div className={`mb-3 px-3 py-2 rounded-lg flex items-center justify-between border ${
          connStatus === 'reconnecting'
            ? 'bg-amber-950/90 border-amber-500/80 text-amber-200'
            : 'bg-rose-950/90 border-rose-500/80 text-rose-200'
        } shadow-lg transition-all`}>
          <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold">
            <RefreshCw size={15} className="animate-spin text-amber-400 shrink-0" />
            <span>
              {connStatus === 'reconnecting'
                ? `Stage display connection interrupted. Automatically reconnecting (Attempt #${reconnectAttempts})...`
                : 'Connection to live engine disconnected. Re-establishing connection...'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] opacity-80 hidden sm:inline">Cached lyrics active</span>
            <button
              onClick={() => forceReconnect()}
              className="px-2.5 py-1 text-xs font-bold rounded bg-amber-500 hover:bg-amber-400 text-black transition-colors cursor-pointer shadow"
            >
              Reconnect Now
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Current Slide (Large) & Next Slide (Medium) */}
      <div className="flex-1 grid grid-rows-2 gap-3 min-h-0">
        {/* CURRENT LIVE SLIDE */}
        <div className="bg-[#0e1015] border-2 border-amber-500/50 rounded-lg p-3 sm:p-5 flex flex-col justify-between overflow-hidden shadow-2xl relative">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs sm:text-sm font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
              <span>CURRENT LIVE SLIDE: {liveItem?.name || 'Nothing Live'}</span>
              <span className="text-gray-400 font-mono text-xs">({currentSlideIndex + 1}/{slides.length || 1})</span>
            </div>
            {currentSlide?.title && (
              <span 
                className="text-[11px] font-bold px-2 py-0.5 rounded border border-black/30 shadow-sm"
                style={currentMatchedLabel ? {
                  backgroundColor: currentMatchedLabel.bgColor,
                  color: currentMatchedLabel.textColor
                } : {
                  backgroundColor: 'rgba(251, 191, 36, 0.2)',
                  color: '#FCD34D',
                  borderColor: 'rgba(251, 191, 36, 0.3)'
                }}
              >
                {currentSlide.title}
                {currentMatchedLabel?.shortcut && (
                  <span className="ml-1.5 opacity-80 font-mono text-[9px] px-1 py-0.2 rounded bg-black/40 border border-white/20">
                    {currentMatchedLabel.shortcut}
                  </span>
                )}
              </span>
            )}
          </div>

          <div 
            className={`flex-1 flex items-center justify-center text-center p-3 font-black whitespace-pre-line overflow-y-auto min-h-0 custom-scrollbar leading-snug ${
              isProjectorMode ? 'text-2xl sm:text-4xl md:text-5xl lg:text-6xl' : 'text-base sm:text-xl md:text-2xl'
            }`}
            style={{
              ...foldbackTextStyle,
              fontFamily: foldbackFont?.family || 'Segoe UI, system-ui, sans-serif',
              color: foldbackFont?.color || '#FACC15',
            }}
          >
            {currentSlide?.text || '— No active slide live on output —'}
          </div>
        </div>

        {/* NEXT SLIDE */}
        <div className="bg-[#12151f] border border-blue-500/40 rounded-lg p-3 sm:p-4 flex flex-col justify-between overflow-hidden relative">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs sm:text-sm font-bold text-sky-400 uppercase tracking-widest flex items-center gap-2">
              <Eye size={16} className="text-sky-400" />
              <span>NEXT UP: {nextSlide ? `${liveItem?.name} (Slide ${currentSlideIndex + 2})` : 'End of Item'}</span>
            </div>
            {nextSlide?.title && (
              <span 
                className="text-[11px] font-semibold px-2 py-0.5 rounded border border-black/30 shadow-sm"
                style={nextMatchedLabel ? {
                  backgroundColor: nextMatchedLabel.bgColor,
                  color: nextMatchedLabel.textColor
                } : {
                  backgroundColor: '#0c1a30',
                  color: '#7dd3fc',
                  borderColor: 'rgba(56, 189, 248, 0.3)'
                }}
              >
                {nextSlide.title}
                {nextMatchedLabel?.shortcut && (
                  <span className="ml-1.5 opacity-80 font-mono text-[9px] px-1 py-0.2 rounded bg-black/40 border border-white/20">
                    {nextMatchedLabel.shortcut}
                  </span>
                )}
              </span>
            )}
          </div>

          <div 
            className={`flex-1 flex items-center justify-center text-center p-2 font-semibold text-slate-200 whitespace-pre-line overflow-y-auto min-h-0 custom-scrollbar leading-snug ${
              isProjectorMode ? 'text-xl sm:text-3xl md:text-4xl' : 'text-sm sm:text-base md:text-lg'
            }`}
            style={{
              fontFamily: foldbackFont?.family || 'Segoe UI, system-ui, sans-serif',
            }}
          >
            {nextSlide?.text || '— End of Selected Presentation —'}
          </div>
        </div>
      </div>

      {/* Nursery / Stage Alert Banner */}
      {alert.active && (
        <div className={`mt-3 ${isProjectorMode ? 'p-3 text-base' : 'p-2 text-xs'} bg-rose-950 border border-rose-500 rounded-lg flex items-center gap-2 font-bold text-rose-100 animate-pulse`}>
          <AlertCircle size={isProjectorMode ? 20 : 14} className="text-rose-400 shrink-0" />
          <span className="truncate">{alert.message}</span>
        </div>
      )}
    </div>
  );
}
