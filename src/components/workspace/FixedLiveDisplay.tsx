import React, { useState } from 'react';
import { 
  Tv, 
  ChevronDown, 
  Eye, 
  Check, 
  Radio, 
  ShieldAlert, 
  Sparkles,
  Layers,
  WifiOff,
  Film,
  Pause,
  Play,
  RotateCcw,
  Repeat,
  Volume2,
  VolumeX,
  Music
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import MonitorPreviewCanvas, { resolveGroupResolution } from '../MonitorPreviewCanvas';
import { DisplayManager } from '../../core/DisplayManager';
import RouteConfigModal from '../RouteConfigModal';
import { PresentationCore } from '../../core/PresentationCore';
import { ThemeEngine } from '../../core/ThemeEngine';
import { PresentationContentResolver } from '../../core/PresentationContentResolver';
import { processDroppedFileList } from '../../utils/fileDropHandler';

interface FixedLiveDisplayProps {
  forcedGroupId?: string;
}

export default function FixedLiveDisplay({ forcedGroupId }: FixedLiveDisplayProps) {
  const store = useStore();
  const { 
    outputGroups, 
    groupStates, 
    activeSchedule, 
    activeControlGroupId, 
    systemOptions, 
    songsList, 
    themesList, 
    setGroupState 
  } = store;

  // Selected display mode: 'follow-target' or specific groupId
  const [displayTargetId, setDisplayTargetId] = useState<string>('follow-target');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Sync fullscreen state & listen for in-app projector events
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    const handleProjectorActivate = () => {
      handleToggleFullscreen();
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('simpleworship:projector-activate', handleProjectorActivate);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('simpleworship:projector-activate', handleProjectorActivate);
    };
  }, []);

  // Determine which groupId to actually display
  const effectiveGroupId = (() => {
    if (forcedGroupId) return forcedGroupId;
    if (displayTargetId === 'follow-target') {
      return activeControlGroupId || outputGroups[0]?.id || 'group-1';
    }
    // Check if selected groupId exists
    const exists = outputGroups.some(g => g.id === displayTargetId);
    if (exists) return displayTargetId;
    return activeControlGroupId || outputGroups[0]?.id || 'group-1';
  })();

  const activeGroup = outputGroups.find(g => g.id === effectiveGroupId) || outputGroups[0];
  const groupIndex = outputGroups.findIndex(g => g.id === effectiveGroupId);
  const activeControlState = groupStates[effectiveGroupId];

  // Active item & slide info
  const liveItem = activeControlState ? PresentationCore.getActiveContent(activeSchedule, activeControlState) : null;
  const slides = liveItem ? PresentationCore.generateSlides(liveItem, songsList, systemOptions) : [];
  const currentSlide = activeControlState && slides.length > 0 ? slides[activeControlState.activeSlideIndex] : null;

  // Resolve theme for this live output group
  const globalTheme = themesList.find(t => t.type === 'global') || themesList[0];
  const groupTheme = themesList.find(t => t.id === activeGroup?.themeId);
  const typeTheme = themesList.find(t => t.type === liveItem?.type);
  
  const baseSong = liveItem?.type === 'song' ? songsList.find(s => s.id === liveItem.contentId) : null;
  const itemTheme = themesList.find(t => t.id === (liveItem?.themeId || baseSong?.themeId));
  
  // Schedule item's override takes precedence over the base song's override
  const elementOverride = liveItem?.themeOverride || baseSong?.themeOverride;

  const systemFontOverride = ThemeEngine.getSystemFontForContent(systemOptions, liveItem?.type);

  const resolvedStyles = ThemeEngine.resolveStyles(
    globalTheme?.styles || ThemeEngine.getDefaultGlobalTheme(),
    groupTheme?.styles,
    typeTheme?.styles,
    systemFontOverride,
    itemTheme?.styles,
    elementOverride
  );

  const isLogoMode = Boolean(activeControlState?.showLogo);
  const logoTheme = themesList.find(t => t.type === 'logo' || t.id === 'theme-logo');
  const logoStyles = logoTheme?.styles || {};

  const liveContentType = PresentationContentResolver.detectContentType(liveItem);
  const mediaFormat = PresentationContentResolver.getMediaFormat(liveItem);
  const isAudioItem = Boolean(liveItem && liveContentType === 'audio');

  const isExplicitImage = Boolean(
    liveContentType === 'image' ||
    liveItem?.type === 'image' ||
    (liveItem?.type === 'media' && (liveItem.data?.isVideo === false || liveItem.data?.type === 'image')) ||
    (currentSlide?.isVideo === false) ||
    (typeof currentSlide?.backgroundUrl === 'string' && (
      currentSlide.backgroundUrl.toLowerCase().endsWith('.jpg') ||
      currentSlide.backgroundUrl.toLowerCase().endsWith('.jpeg') ||
      currentSlide.backgroundUrl.toLowerCase().endsWith('.png') ||
      currentSlide.backgroundUrl.toLowerCase().endsWith('.webp') ||
      currentSlide.backgroundUrl.toLowerCase().endsWith('.gif') ||
      currentSlide.backgroundUrl.toLowerCase().endsWith('.svg') ||
      currentSlide.backgroundUrl.toLowerCase().startsWith('data:image/')
    ))
  );

  const isPresentationItem = liveContentType === 'pptx' || liveItem?.type === 'presentation' || liveItem?.type === 'ppt';

  const isVideoItem = !isPresentationItem && !isExplicitImage && !isAudioItem && (
    (isLogoMode && logoStyles.backgroundType === 'video' && Boolean(logoStyles.backgroundVideoUrl)) ||
    (Boolean(liveItem) && !isLogoMode && (
      liveContentType === 'video' ||
      liveItem?.type === 'video' ||
      (liveItem?.type === 'media' && (liveItem.data?.type === 'video' || liveItem.data?.type === 'motion' || liveItem.data?.isVideo === true)) ||
      currentSlide?.isVideo === true ||
      (typeof currentSlide?.backgroundUrl === 'string' && (
        currentSlide.backgroundUrl.toLowerCase().endsWith('.mp4') ||
        currentSlide.backgroundUrl.toLowerCase().endsWith('.webm') ||
        currentSlide.backgroundUrl.toLowerCase().endsWith('.mov') ||
        currentSlide.backgroundUrl.toLowerCase().endsWith('.m4v') ||
        currentSlide.backgroundUrl.toLowerCase().startsWith('data:video/')
      )) ||
      (!currentSlide?.backgroundUrl && resolvedStyles.backgroundType === 'video' && Boolean(resolvedStyles.backgroundVideoUrl) && liveItem?.type !== 'song' && liveItem?.type !== 'bible' && liveItem?.type !== 'presentation' && liveItem?.type !== 'ppt')
    ))
  );

  const formatVideoTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const isLive = Boolean(activeControlState?.isLiveEnabled && activeControlState?.activeItemId && !activeControlState?.isBlack && !activeControlState?.isClear);
  const isBlack = Boolean(activeControlState?.isBlack);
  const isClear = Boolean(activeControlState?.isClear);
  const isLogo = Boolean(activeControlState?.showLogo);

  // Group resolution details
  const resInfo = resolveGroupResolution(activeGroup, systemOptions);

  const handleToggleFullscreen = () => {
    const el = document.getElementById('fixed-live-display-container');
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <section 
      id="fixed-live-display-container"
      className="w-full h-full flex flex-col bg-[#0f1117] overflow-visible select-none text-gray-200 relative"
    >
      {/* Top Header Bar for Fixed Live Output Display */}
      <div className="h-9 flex items-center justify-between px-3 shrink-0 bg-[#151720] border-b border-[#222634] z-40">
        {/* Left: Indicator + Status Title */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Pulsing Live LED Indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`w-2.5 h-2.5 rounded-full ${
              isBlack ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]' :
              isClear ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' :
              isLogo ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]' :
              isLive ? 'bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.9)]' :
              (activeControlState?.activeItemId ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-gray-600')
            }`} />
            <span className={`text-[11px] font-extrabold uppercase tracking-wider shrink-0 hidden min-[450px]:inline ${
              isLive ? 'text-emerald-400' : (activeControlState?.activeItemId ? 'text-amber-400' : 'text-gray-400')
            }`}>
              {isBlack ? 'BLACKOUT' : isClear ? 'CLEARED' : isLogo ? 'LOGO' : isLive ? 'LIVE DISPLAY' : (activeControlState?.activeItemId ? 'PREVIEW (LIVE OFF)' : 'STANDBY')}
            </span>
          </div>
        </div>

        {/* Right: Aspect Tag + 1:1 Target Monitor Quick Tag */}
        <div className="flex items-center gap-1 shrink-0 overflow-hidden">
          {/* Aspect ratio tag */}
          <span 
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1b1e29] text-gray-300 border border-[#2b3042] shrink-0 hidden min-[540px]:inline-block"
            title={`Resolution Aspect: ${resInfo.aspectLabel} (${resInfo.width}×${resInfo.height})`}
          >
            {resInfo.aspectLabel}
          </span>

          {/* 1:1 Target Monitor Quick Tag */}
          {(() => {
            const hasTarget = Boolean((activeGroup?.displayIds && activeGroup.displayIds.length > 0) || activeGroup?.targetDisplayId);
            const targetText = activeGroup?.displayIds && activeGroup.displayIds.length > 0
              ? (activeGroup.displayIds.length > 1 ? `${activeGroup.displayIds.length} Monitors` : activeGroup.displayIds[0])
              : (activeGroup?.targetDisplayId || 'None');

            return (
              <button
                onClick={() => setIsConfigOpen(true)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#151722] hover:bg-[#1f2230] border border-[#2a2e40] text-[10px] text-gray-300 transition-colors cursor-pointer shrink-0"
                title={hasTarget ? `Current 1:1 Target Monitor: ${targetText} (Click to change)` : "No target monitor selected (Click to configure)"}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${hasTarget ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                <span className="text-gray-400 hidden min-[560px]:inline">1:1 Target:</span>
                <span className={`font-mono font-semibold truncate max-w-[55px] min-[560px]:max-w-[85px] ${hasTarget ? 'text-cyan-300' : 'text-gray-400'}`}>
                  {targetText}
                </span>
              </button>
            );
          })()}
        </div>
      </div>

      {isConfigOpen && <RouteConfigModal groupId={effectiveGroupId} onClose={() => setIsConfigOpen(false)} />}

      {/* Main Screen Canvas Frame */}
      <div 
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isDraggingOver) setIsDraggingOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setIsDraggingOver(false);
        }}
        onDrop={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDraggingOver(false);

          // 1. Check if OS files were dropped (Images, Audio, Video, PPTX, PPT)
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const dropResult = await processDroppedFileList(e.dataTransfer.files);
            if (dropResult.schedule) {
              store.setActiveSchedule(dropResult.schedule);
              return;
            }
            if (dropResult.items && dropResult.items.length > 0) {
              for (const item of dropResult.items) {
                store.addScheduleItem(item);
              }
              const targetItem = dropResult.items[0];
              store.goLiveItem(targetItem.id, 0, effectiveGroupId, targetItem);
              store.setGroupState(effectiveGroupId, {
                activeItemId: targetItem.id,
                activeSlideIndex: 0,
                isBlack: false,
                isClear: false,
              });
              window.dispatchEvent(
                new CustomEvent('simpleworship:notify', {
                  detail: `Projecting LIVE on ${activeGroup?.name || 'Display'}: "${targetItem.name}"!`
                })
              );
              return;
            }
          }

          // 2. Internal JSON / item drop
          const rawJson = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('application/x-simpleworship-item');
          if (rawJson) {
            try {
              const payload = JSON.parse(rawJson);
              if (payload && payload.item) {
                const item = payload.item;
                if (payload.source !== 'schedule') {
                  store.addScheduleItem(item);
                }
                store.goLiveItem(item.id, 0, effectiveGroupId, item);
                store.setGroupState(effectiveGroupId, {
                  activeItemId: item.id,
                  activeSlideIndex: 0,
                  isBlack: false,
                  isClear: false,
                });
                window.dispatchEvent(
                  new CustomEvent('simpleworship:notify', {
                    detail: `Projecting LIVE on ${activeGroup?.name || 'Display'}: "${item.name}"!`
                  })
                );
              }
            } catch (err) {
              console.error('Failed to parse dropped item', err);
            }
          }
        }}
        className="flex-1 w-full h-full min-h-0 bg-[#07080b] relative flex items-center justify-center overflow-hidden p-2"
      >
        {/* Aspect-Ratio Box containing the MonitorPreviewCanvas */}
        <div className="w-full h-full relative rounded-lg border border-[#1d212d] overflow-hidden shadow-2xl bg-black flex items-center justify-center">
          <MonitorPreviewCanvas 
            groupId={effectiveGroupId} 
            showResolutionTag={false}
            className="w-full h-full"
          />

          {/* Drag & Drop Live Overlay */}
          {isDraggingOver && (
            <div className="absolute inset-0 bg-cyan-950/85 backdrop-blur-[2px] z-40 flex flex-col items-center justify-center text-cyan-200 border-2 border-dashed border-cyan-400 p-4 text-center pointer-events-none animate-in fade-in duration-150">
              <Tv size={42} className="text-cyan-400 mb-2 animate-bounce" />
              <span className="text-sm font-black uppercase tracking-wider text-white">Drop to Go Live on Display</span>
              <span className="text-xs text-cyan-300 mt-1">Directly projects to {activeGroup?.name || 'Display Output'}</span>
            </div>
          )}

          {/* Mute Overlays for clear operator feedback */}
          {(!activeControlState?.activeItemId && !isLogo) && (
            <div className="absolute inset-0 bg-[#0a0b0e] flex flex-col items-center justify-center pointer-events-none z-30">
              <Tv size={36} className="mb-2 text-gray-700" />
              <span className="text-sm font-black tracking-widest uppercase text-gray-500">STANDBY DISPLAY</span>
              <span className="text-[10px] text-gray-600 mt-1">Ready for Live Content</span>
            </div>
          )}

          {/* Staged / Preview Mode Badge when Live is OFF */}
          {!isLive && Boolean(activeControlState?.activeItemId) && !isBlack && !isClear && !isLogo && (
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-[#13151c]/90 border border-amber-500/50 text-amber-300 text-[10px] font-bold tracking-wider uppercase pointer-events-none z-25 flex items-center gap-1.5 shadow-lg backdrop-blur-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>PREVIEW MODE • LIVE OFF (STAGED)</span>
            </div>
          )}

          {isBlack && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xs flex flex-col items-center justify-center text-rose-400 pointer-events-none z-30">
              <ShieldAlert size={36} className="mb-1 animate-pulse" />
              <span className="text-sm font-black tracking-widest uppercase">BLACKOUT ACTIVE</span>
              <span className="text-[11px] text-gray-400 mt-0.5">Press F6 or Esc to restore display</span>
            </div>
          )}

          {isClear && !isBlack && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-600/80 text-amber-300 text-xs font-bold tracking-wider uppercase pointer-events-none z-30 flex items-center gap-1.5 shadow-lg">
              <Eye size={13} />
              <span>TEXT CLEARED (BACKGROUND ONLY)</span>
            </div>
          )}

          {isLogo && !isBlack && !isClear && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-600/80 text-indigo-300 text-xs font-bold tracking-wider uppercase pointer-events-none z-30 flex items-center gap-1.5 shadow-lg">
              <Sparkles size={13} />
              <span>LOGO MODE ACTIVE</span>
            </div>
          )}


        </div>
      </div>

      {/* Video & Audio Player Controls Panel (Moved here from the Live Output Panel) */}
      {(isVideoItem || isAudioItem) && (
        <div className="p-3 bg-[#111216] border-t border-[#222530] shrink-0">
          <div className="p-2.5 bg-[#161820] border border-[#2a2d3c] rounded-lg flex flex-col gap-2 shadow-lg">
            {/* Top Header Row */}
            <div className="flex items-center justify-between text-[11px] font-bold">
              <div className="flex items-center gap-2 text-cyan-300 min-w-0">
                {isAudioItem ? (
                  <Music size={13} className="text-cyan-400 animate-pulse shrink-0" />
                ) : (
                  <Film size={13} className="text-cyan-400 animate-pulse shrink-0" />
                )}
                <span className="truncate">{liveItem?.name || currentSlide?.title || (isAudioItem ? 'Audio Track' : 'Video Content')}</span>
                {mediaFormat && (
                  <span className="uppercase text-[9px] px-1 py-0.5 bg-gray-800/80 text-cyan-300 rounded font-mono border border-cyan-800/50 shrink-0">
                    {mediaFormat}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setGroupState(effectiveGroupId, { isVideoPlaying: !(activeControlState?.isVideoPlaying ?? true) })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer select-none active:scale-95 ${
                    activeControlState?.isVideoPlaying ?? true
                      ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 hover:bg-emerald-900 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                      : 'bg-amber-950/90 text-amber-300 border border-amber-700/80 hover:bg-amber-900 shadow-[0_0_8px_rgba(245,158,11,0.3)]'
                  }`}
                  title={activeControlState?.isVideoPlaying ?? true ? 'Click to Pause' : 'Click to Resume Playback'}
                >
                  {activeControlState?.isVideoPlaying ?? true ? '► PLAYING' : '❚❚ PAUSED'}
                </button>
                <button
                  type="button"
                  onClick={() => setGroupState(effectiveGroupId, { isVideoLooping: !(activeControlState?.isVideoLooping ?? true) })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-all cursor-pointer select-none active:scale-95 ${
                    activeControlState?.isVideoLooping ?? true
                      ? 'bg-cyan-950/90 text-cyan-300 border-cyan-600/80 hover:bg-cyan-900 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                      : 'bg-gray-800/80 text-gray-400 border-gray-700 hover:text-gray-200'
                  }`}
                  title="Toggle Continuous Media Looping"
                >
                  {activeControlState?.isVideoLooping ?? true ? '🔁 LOOP ON' : '➡️ LOOP OFF'}
                </button>
              </div>
            </div>

            {/* Seek Progress Bar */}
            <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400">
              <span className="w-9 text-right shrink-0 font-bold text-gray-300">{formatVideoTime(activeControlState?.videoCurrentTime || 0)}</span>
              <input
                type="range"
                min={0}
                max={activeControlState?.videoDuration && activeControlState.videoDuration > 0 ? activeControlState.videoDuration : 100}
                step={0.1}
                value={activeControlState?.videoCurrentTime || 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setGroupState(effectiveGroupId, { videoSeekTime: val, videoCurrentTime: val });
                }}
                className="flex-1 h-1.5 bg-[#262936] accent-cyan-400 rounded-lg cursor-pointer animate-none transition-all hover:h-2"
                title={`Seek position: ${formatVideoTime(activeControlState?.videoCurrentTime || 0)}`}
              />
              <span className="w-9 shrink-0 font-bold text-gray-300">{formatVideoTime(activeControlState?.videoDuration || 0)}</span>
            </div>

            {/* Button Controls Row */}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-[#232634]">
              <div className="flex items-center gap-1.5">
                {/* Play / Pause Toggle */}
                <button
                  type="button"
                  onClick={() => setGroupState(effectiveGroupId, { isVideoPlaying: !(activeControlState?.isVideoPlaying ?? true) })}
                  className={`px-3 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer select-none active:scale-95 ${
                    activeControlState?.isVideoPlaying ?? true
                      ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_8px_rgba(217,119,6,0.4)]'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                  }`}
                  title={activeControlState?.isVideoPlaying ?? true ? 'Pause Media Playback (Space)' : 'Play Media (Space)'}
                >
                  {activeControlState?.isVideoPlaying ?? true ? (
                    <>
                      <Pause size={12} className="fill-white" />
                      <span>PAUSE</span>
                    </>
                  ) : (
                    <>
                      <Play size={12} className="fill-white" />
                      <span>PLAY</span>
                    </>
                  )}
                </button>

                {/* Restart Button */}
                <button
                  type="button"
                  onClick={() => setGroupState(effectiveGroupId, { videoSeekTime: 0, videoCurrentTime: 0, isVideoPlaying: true })}
                  className="px-2.5 py-1 rounded bg-[#252834] hover:bg-[#323646] text-gray-200 text-[11px] font-semibold flex items-center gap-1 border border-[#373b4d] transition-all cursor-pointer select-none active:scale-95"
                  title="Restart Media from 0:00"
                >
                  <RotateCcw size={11} />
                  <span>Restart</span>
                </button>

                {/* Loop Toggle Button */}
                <button
                  type="button"
                  onClick={() => setGroupState(effectiveGroupId, { isVideoLooping: !(activeControlState?.isVideoLooping ?? true) })}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 border transition-all cursor-pointer select-none active:scale-95 ${
                    activeControlState?.isVideoLooping ?? true
                      ? 'bg-cyan-950/90 border-cyan-500/80 text-cyan-300 hover:bg-cyan-900 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                      : 'bg-[#252834] border-[#373b4d] text-gray-400 hover:text-gray-200'
                  }`}
                  title="Toggle Continuous Loop Mode"
                >
                  <Repeat size={11} />
                  <span>{activeControlState?.isVideoLooping ?? true ? 'Loop On' : 'Loop Off'}</span>
                </button>
              </div>

              {/* Volume & Mute Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setGroupState(effectiveGroupId, { isVideoMuted: !(activeControlState?.isVideoMuted ?? false) })}
                  className={`p-1.5 rounded transition-all cursor-pointer select-none active:scale-95 ${
                    activeControlState?.isVideoMuted
                      ? 'bg-rose-950 border border-rose-700/80 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                      : 'bg-[#252834] border border-[#373b4d] text-gray-300 hover:text-white'
                  }`}
                  title={activeControlState?.isVideoMuted ? 'Unmute Audio' : 'Mute Audio'}
                >
                  {activeControlState?.isVideoMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={activeControlState?.isVideoMuted ? 0 : (activeControlState?.videoVolume ?? 1)}
                  onChange={(e) => {
                    const vol = parseFloat(e.target.value);
                    setGroupState(effectiveGroupId, { videoVolume: vol, isVideoMuted: vol === 0 });
                  }}
                  className="w-16 h-1.5 bg-[#262936] accent-cyan-400 rounded cursor-pointer"
                  title={`Volume: ${Math.round((activeControlState?.isVideoMuted ? 0 : (activeControlState?.videoVolume ?? 1)) * 100)}%`}
                />
                <span className="text-[9px] font-mono text-gray-400 min-w-[24px]">
                  {activeControlState?.isVideoMuted ? '0%' : `${Math.round((activeControlState?.videoVolume ?? 1) * 100)}%`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
