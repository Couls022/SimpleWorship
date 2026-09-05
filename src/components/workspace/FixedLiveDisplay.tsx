import React, { useState } from 'react';
import { 
  Tv, 
  MonitorUp, 
  Maximize2, 
  Settings, 
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
  const isAudioItem = liveContentType === 'audio';

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

  const isVideoItem = !isPresentationItem && !isExplicitImage && !isAudioItem && Boolean(
    liveContentType === 'video' ||
    (isLogoMode && logoStyles.backgroundType === 'video' && logoStyles.backgroundVideoUrl) ||
    (!isLogoMode && (
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

  const isLive = Boolean(activeControlState?.activeItemId && !activeControlState?.isBlack && !activeControlState?.isClear);
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
      className="w-full h-full flex flex-col bg-[#101217] overflow-visible select-none text-gray-200 relative border-l border-[#262936]"
    >
      {/* Top Header Bar for Fixed Live Output Display */}
      <div className="h-8 flex items-center justify-between px-2.5 shrink-0 bg-gradient-to-r from-[#171a23] via-[#1d212d] to-[#171a23] border-b border-[#292d3b] z-40">
        {/* Left: Indicator + Title + Target Dropdown */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Pulsing Live LED Indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`w-2.5 h-2.5 rounded-full ${
              isBlack ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]' :
              isClear ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' :
              isLogo ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]' :
              isLive ? 'bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.9)]' :
              'bg-gray-600'
            }`} />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400 shrink-0">
              {isBlack ? 'BLACKOUT' : isClear ? 'CLEARED' : isLogo ? 'LOGO' : isLive ? 'LIVE DISPLAY' : 'STANDBY'}
            </span>
          </div>

          {/* Target Output Group Dropdown */}
          <div className="relative shrink-0">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#1f2330] hover:bg-[#282d3e] border border-[#353a4e] text-xs font-bold text-gray-200 transition-colors cursor-pointer"
              title="Select which output group this operator display monitors"
            >
              <Tv size={12} className="text-cyan-400" />
              <span className="truncate max-w-[120px]">
                {displayTargetId === 'follow-target' ? `Active: ${activeGroup?.name || 'Main'}` : activeGroup?.name || 'Output Group'}
              </span>
              <ChevronDown size={12} className="text-gray-400" />
            </button>

            {isDropdownOpen && (
              <div 
                className="absolute left-0 top-full mt-1 w-52 bg-[#181b24] border border-[#33384a] rounded-md shadow-2xl z-50 py-1 text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setIsDropdownOpen(false)}
              >
                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#2a2f42]">
                  Operator Monitor Target
                </div>
                <button
                  onClick={() => setDisplayTargetId('follow-target')}
                  className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-[#252a3a] transition-colors ${
                    displayTargetId === 'follow-target' ? 'text-cyan-300 font-bold bg-[#1f2536]' : 'text-gray-300'
                  }`}
                >
                  <span className="truncate">Follow Active Target ({activeGroup?.name})</span>
                  {displayTargetId === 'follow-target' && <Check size={12} className="text-cyan-400 shrink-0" />}
                </button>
                {outputGroups.map((grp) => (
                  <button
                    key={grp.id}
                    onClick={() => setDisplayTargetId(grp.id)}
                    className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-[#252a3a] transition-colors ${
                      displayTargetId === grp.id ? 'text-cyan-300 font-bold bg-[#1f2536]' : 'text-gray-300'
                    }`}
                  >
                    <span className="truncate">{grp.name} ({grp.role})</span>
                    {displayTargetId === grp.id && <Check size={12} className="text-cyan-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Aspect Tag + Popout Projector + Fullscreen + Settings */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Aspect ratio tag */}
          <span 
            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#171922] text-gray-400 border border-[#2c3142]"
            title={`Resolution Aspect: ${resInfo.aspectLabel} (${resInfo.width}×${resInfo.height})`}
          >
            {resInfo.aspectLabel}
          </span>

          {/* Launch Fullscreen Projector Presentation Mode */}
          <button
            onClick={() => {
              DisplayManager.openProjector(effectiveGroupId, activeGroup?.displayIds?.[0]);
            }}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-600/50 text-cyan-300 hover:text-white transition-all text-[11px] font-bold cursor-pointer active:scale-95 shadow-xs"
            title={`Open separate full hardware projector window for ${activeGroup?.name || 'this display'}`}
          >
            <MonitorUp size={12} className="text-cyan-400" />
            <span>Projector</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={handleToggleFullscreen}
            className="p-1 rounded hover:bg-[#2a3040] text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Toggle Fullscreen Live Output Display (Esc to exit)"
          >
            <Maximize2 size={13} />
          </button>

          {/* Route Config */}
          <button
            onClick={() => setIsConfigOpen(true)}
            className="p-1 rounded hover:bg-[#2a3040] text-gray-400 hover:text-white transition-colors"
            title="Route Display Settings"
          >
            <Settings size={13} />
          </button>
        </div>
      </div>

      {isConfigOpen && <RouteConfigModal groupId={effectiveGroupId} onClose={() => setIsConfigOpen(false)} />}

      {/* Main Screen Canvas Frame */}
      <div className="flex-1 w-full h-full min-h-0 bg-[#07080b] relative flex items-center justify-center overflow-hidden p-2">
        {/* Aspect-Ratio Box containing the MonitorPreviewCanvas */}
        <div className="w-full h-full relative rounded-lg border border-[#1d212d] overflow-hidden shadow-2xl bg-black flex items-center justify-center">
          <MonitorPreviewCanvas 
            groupId={effectiveGroupId} 
            showResolutionTag={false}
            className="w-full h-full"
          />

          {/* Mute Overlays for clear operator feedback */}
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
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  activeControlState?.isVideoPlaying ?? true
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                    : 'bg-amber-950 text-amber-300 border border-amber-800/80'
                }`}>
                  {activeControlState?.isVideoPlaying ?? true ? '► Playing' : '❚❚ Paused'}
                </span>
                <button
                  onClick={() => setGroupState(effectiveGroupId, { isVideoLooping: !(activeControlState?.isVideoLooping ?? true) })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors cursor-pointer ${
                    activeControlState?.isVideoLooping ?? true
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-700/80 hover:bg-cyan-900'
                      : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200'
                  }`}
                  title="Toggle Continuous Video Looping"
                >
                  {activeControlState?.isVideoLooping ?? true ? '🔁 Loop ON' : '➡️ Loop OFF'}
                </button>
              </div>
            </div>

            {/* Seek Progress Bar */}
            <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400">
              <span className="w-9 text-right shrink-0">{formatVideoTime(activeControlState?.videoCurrentTime || 0)}</span>
              <input
                type="range"
                min={0}
                max={activeControlState?.videoDuration || 100}
                step={0.1}
                value={activeControlState?.videoCurrentTime || 0}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setGroupState(effectiveGroupId, { videoSeekTime: val, videoCurrentTime: val });
                }}
                className="flex-1 h-1.5 bg-[#262936] accent-cyan-400 rounded-lg cursor-pointer animate-none"
              />
              <span className="w-9 shrink-0">{formatVideoTime(activeControlState?.videoDuration || 0)}</span>
            </div>

            {/* Button Controls Row */}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-[#232634]">
              <div className="flex items-center gap-1.5">
                {/* Play / Pause Toggle */}
                <button
                  onClick={() => setGroupState(effectiveGroupId, { isVideoPlaying: !(activeControlState?.isVideoPlaying ?? true) })}
                  className={`px-3 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer ${
                    activeControlState?.isVideoPlaying ?? true
                      ? 'bg-amber-600 hover:bg-amber-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                  title={activeControlState?.isVideoPlaying ?? true ? 'Pause Video' : 'Play Video'}
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
                  onClick={() => setGroupState(effectiveGroupId, { videoSeekTime: 0, videoCurrentTime: 0, isVideoPlaying: true })}
                  className="px-2.5 py-1 rounded bg-[#252834] hover:bg-[#323646] text-gray-200 text-[11px] font-semibold flex items-center gap-1 border border-[#373b4d] transition-colors cursor-pointer"
                  title="Restart Video from 0:00"
                >
                  <RotateCcw size={11} />
                  <span>Restart</span>
                </button>

                {/* Loop Toggle Button */}
                <button
                  onClick={() => setGroupState(effectiveGroupId, { isVideoLooping: !(activeControlState?.isVideoLooping ?? true) })}
                  className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 border transition-colors cursor-pointer ${
                    activeControlState?.isVideoLooping ?? true
                      ? 'bg-cyan-950 border-cyan-500/60 text-cyan-300 hover:bg-cyan-900'
                      : 'bg-[#252834] border-[#373b4d] text-gray-400 hover:text-gray-200'
                  }`}
                  title="Toggle Continuous Video Looping"
                >
                  <Repeat size={11} />
                  <span>{activeControlState?.isVideoLooping ?? true ? 'Loop On' : 'Loop Off'}</span>
                </button>
              </div>

              {/* Volume & Mute Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setGroupState(effectiveGroupId, { isVideoMuted: !(activeControlState?.isVideoMuted ?? false) })}
                  className={`p-1.5 rounded transition-colors cursor-pointer ${
                    activeControlState?.isVideoMuted
                      ? 'bg-rose-950 border border-rose-700/60 text-rose-300'
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
                  className="w-16 h-1 bg-[#262936] accent-cyan-400 rounded cursor-pointer"
                  title="Video Volume"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
