import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Tv, 
  Settings,
  ChevronDown,
  Play,
  Pin,
  Plus,
  X,
  Grid2x2,
  Grid3x3,
  List,
  ListFilter,
  Maximize2,
  GripVertical,
  ArrowLeft,
  ArrowRight,
  Film,
  Pause,
  RotateCcw,
  Repeat,
  Volume2,
  VolumeX,
  MonitorUp,
  Presentation,
  Clock,
  Zap
} from 'lucide-react';
import { Panel, PanelGroup } from 'react-resizable-panels';
import ResizeHandle from './ResizeHandle';
import { useStore } from '../store/useStore';
import { useWorkspace } from '../context/WorkspaceContext';
import { PresentationCore } from '../core/PresentationCore';
import RouteConfigModal from './RouteConfigModal';
import { ThemeEngine } from '../core/ThemeEngine';
import MonitorPreviewCanvas from './MonitorPreviewCanvas';
import { formatVerseNumber } from '../utils/scriptureFormatter';
import { DisplayManager } from '../core/DisplayManager';
import { processDroppedFileList } from '../utils/fileDropHandler';
import CameraLiveRenderer from './CameraLiveRenderer';
import { PresentationContentResolver } from '../core/PresentationContentResolver';
import { LiveSlideCard } from './LiveSlideCard';
import { isValidPptxBinary } from '../utils/pptxValidator';
import { SlideTransitionManager } from '../core/SlideTransitionManager';
import { SlideAnnotationHUD } from './SlideAnnotationHUD';

interface LivePanelProps {
  groupId: string;
  routerId?: string;
  showPreviewDisplay?: boolean;
  key?: React.Key;
}

export default function LivePanel({ groupId, routerId, showPreviewDisplay = true }: LivePanelProps) {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isDraggingSelf, setIsDraggingSelf] = useState(false);
  const [dropPosition, setDropPosition] = useState<'left' | 'right' | null>(null);
  const [isItemDragOver, setIsItemDragOver] = useState(false);

  type ViewMode = 'large' | 'medium' | 'small' | 'summary';
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      return (localStorage.getItem('simpleworship_live_view_mode') as ViewMode) || 'medium';
    } catch {
      return 'medium';
    }
  });
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const handleSelectViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    setIsViewMenuOpen(false);
    try {
      localStorage.setItem('simpleworship_live_view_mode', mode);
    } catch {}
  };

  const store = useStore();
  const { panels, togglePanelDock } = useWorkspace();
  const isDocked = panels.live?.isDocked ?? true;

  const { 
    activeSchedule, 
    groupStates, 
    outputGroups, 
    songsList, 
    themesList,
    alert,
    systemOptions,
    setGroupState,
    addOutputGroup,
    removeOutputGroup,
    reorderOutputGroups,
    moveOutputGroup
  } = store;

  const activeGroup = outputGroups.find(g => g.id === groupId) || outputGroups[0];
  const groupIndex = outputGroups.findIndex(g => g.id === groupId);
  const isFirst = groupIndex <= 0;
  const isLast = groupIndex === -1 || groupIndex >= outputGroups.length - 1;
  const activeControlState = groupStates[groupId];
  const isTargetedGroup = store.activeRouterId === routerId || (!routerId && store.activeControlGroupId === groupId);
  const isActiveControlGroup = store.activeControlGroupId === groupId;
  const groupTargetDisplays = (activeGroup?.displayIds && activeGroup.displayIds.length > 0)
    ? activeGroup.displayIds
    : (activeGroup?.targetDisplayId ? [activeGroup.targetDisplayId] : []);

  const handleMakeActiveOverlay = () => {
    store.setActiveControlGroupId(groupId);
    store.setActiveRouterId(routerId || 'router-1');
    DisplayManager.syncPhysicalDisplays(outputGroups, groupStates, groupId);
  };

  const handleAddPanel = () => {
    const newGroup = {
      id: `group-${Date.now()}`,
      name: `Display ${outputGroups.length + 1}`,
      role: 'confidence' as const,
      displayIds: []
    };
    addOutputGroup(newGroup);
  };

  const handleRemovePanel = () => {
    if (outputGroups.length > 1 && activeGroup) {
      removeOutputGroup(activeGroup.id);
    }
  };

  const liveItem = activeControlState ? PresentationCore.getActiveContent(activeSchedule, activeControlState) : null;
  const slides = liveItem ? PresentationCore.generateSlides(liveItem, songsList, systemOptions) : [];
  const currentSlide = activeControlState && slides.length > 0 ? slides[activeControlState.activeSlideIndex] : null;

  // Resolve theme for this live output group
  const globalTheme = themesList.find(t => t.type === 'global') || themesList[0];
  const groupTheme = themesList.find(t => t.id === activeGroup?.themeId);
  const itemContentType = (liveItem?.type as any) === 'ppt' ? 'presentation' : ((liveItem?.type as any) === 'scripture' ? 'bible' : liveItem?.type);
  const typeTheme = themesList.find(t => t.type === itemContentType || t.type === liveItem?.type || (itemContentType === 'presentation' && t.id === 'theme-presentation') || (itemContentType === 'bible' && t.id === 'theme-scripture') || (itemContentType === 'song' && t.id === 'theme-song') || (itemContentType === 'announcement' && t.id === 'theme-announcement'));
  
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

  const isPresentation = liveContentType === 'pptx' || liveItem?.type === 'presentation' || liveItem?.type === 'ppt';

  const isVideoItem = !isPresentation && !isExplicitImage && !isAudioItem && (
    (isLogoMode && logoStyles.backgroundType === 'video' && Boolean(logoStyles.backgroundVideoUrl)) ||
    (Boolean(liveItem) && !isLogoMode && (
      liveContentType === 'video' ||
      liveItem?.type === 'video' ||
      (liveItem?.type === 'media' && (liveItem.data?.type === 'video' || liveItem.data?.type === 'motion' || liveItem.data?.isVideo === true)) ||
      currentSlide?.isVideo === true ||
      (typeof currentSlide?.backgroundUrl === 'string' && PresentationContentResolver.isVideoUrl(currentSlide.backgroundUrl)) ||
      (resolvedStyles.backgroundType === 'video' && Boolean(resolvedStyles.backgroundVideoUrl)) ||
      (typeof currentSlide?.backgroundUrl === 'string' && (
        currentSlide.backgroundUrl.toLowerCase().endsWith('.mp4') ||
        currentSlide.backgroundUrl.toLowerCase().endsWith('.webm') ||
        currentSlide.backgroundUrl.toLowerCase().endsWith('.mov') ||
        currentSlide.backgroundUrl.toLowerCase().endsWith('.m4v') ||
        currentSlide.backgroundUrl.toLowerCase().startsWith('data:video/')
      ))
    ))
  );

  const formatVideoTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const currentSlideIndex = activeControlState?.activeSlideIndex || 0;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!isItemDragOver) setIsItemDragOver(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = (e.clientX - rect.left) < rect.width / 2;
    const targetPos = isLeftHalf ? 'left' : 'right';
    if (dropPosition !== targetPos) setDropPosition(targetPos);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only reset if leaving the component boundaries
    const rect = e.currentTarget.getBoundingClientRect();
    if (
      e.clientX < rect.left || 
      e.clientX >= rect.right || 
      e.clientY < rect.top || 
      e.clientY >= rect.bottom
    ) {
      setDropPosition(null);
      setIsItemDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const finalDropPos = dropPosition;
    setDropPosition(null);
    setIsItemDragOver(false);

    // 1. Direct OS files dropped (Images, Audio, Video, PPTX, PPT)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropResult = await processDroppedFileList(e.dataTransfer.files);
      if (dropResult.schedule) {
        store.setActiveSchedule(dropResult.schedule);
        return;
      }
      if (dropResult.items && dropResult.items.length > 0) {
        // Ingest all dropped items into Schedule
        for (const item of dropResult.items) {
          store.addScheduleItem(item);
        }
        // Go live with the first dropped item immediately on this output panel
        const targetLiveItem = dropResult.items[0];
        store.goLiveItem(targetLiveItem.id, 0, groupId, targetLiveItem, routerId);
        store.setGroupState(groupId, {
          activeItemId: targetLiveItem.id,
          activeSlideIndex: 0,
          isBlack: false,
          isClear: false,
        });
        window.dispatchEvent(
          new CustomEvent('simpleworship:notify', { 
            detail: `Going LIVE on ${activeGroup?.name || 'Output'} with "${targetLiveItem.name}"!` 
          })
        );
        return;
      }
    }

    const rawJson = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('application/x-simpleworship-item');
    if (rawJson) {
      try {
        const payload = JSON.parse(rawJson);

        // Handle panel reordering drag & drop
        if (payload && payload.type === 'reorder-output-group') {
          const srcIdx = payload.sourceIndex;
          if (typeof srcIdx === 'number' && srcIdx !== -1) {
            let targetIdx = finalDropPos === 'left' ? groupIndex : groupIndex + 1;
            if (srcIdx < targetIdx) {
              targetIdx = targetIdx - 1;
            }
            if (srcIdx !== targetIdx && targetIdx >= 0 && targetIdx < outputGroups.length) {
              reorderOutputGroups(srcIdx, targetIdx);
            }
          }
          return;
        }

        // Handle schedule item, scripture verses, or song drop to go live immediately
        if (payload && payload.item) {
          const itemId = payload.item.id || `live-${Date.now()}`;
          const newItem = {
            id: itemId,
            type: payload.item.type,
            contentId: payload.item.contentId,
            name: payload.item.name,
            notes: payload.item.notes,
            customBackgroundUrl: payload.item.customBackgroundUrl,
            data: payload.item.data
          };

          if (newItem.type === 'presentation') {
            if (!isValidPptxBinary(newItem.data?.fileBytes)) {
              newItem.data = { ...(newItem.data || {}), fileBytes: undefined };
            }
          }
          if (payload.source !== 'schedule') {
            store.addScheduleItem(newItem);
          }
          store.goLiveItem(itemId, 0, groupId, undefined, routerId); 
          store.setGroupState(groupId, {
            activeItemId: itemId,
            activeSlideIndex: 0,
            isBlack: false,
            isClear: false,
          });
          window.dispatchEvent(
            new CustomEvent('simpleworship:notify', { 
              detail: `Going LIVE in ${activeGroup?.name} with "${newItem.name}"!` 
            })
          );
        }
      } catch (err) {
        console.error('Failed to parse live drop payload', err);
      }
    }
  };

  const handleSelectSlide = (idx: number) => {
    store.setActiveControlGroupId(groupId);
    if (activeControlState?.activeItemId === liveItem?.id) {
      store.setGroupState(groupId, { activeSlideIndex: idx });
    } else if (liveItem) {
      store.goLiveItem(liveItem.id, idx, groupId, liveItem, routerId);
    }
  };

  const handlePrevSlide = () => {
    if (slides.length === 0) return;
    const current = activeControlState?.activeSlideIndex || 0;
    const prev = Math.max(0, current - 1);
    store.setGroupState(groupId, { activeSlideIndex: prev });
  };

  const handleNextSlide = () => {
    if (slides.length === 0) return;
    const current = activeControlState?.activeSlideIndex || 0;
    const next = Math.min(slides.length - 1, current + 1);
    store.setGroupState(groupId, { activeSlideIndex: next });
  };

  // Auto-advance timer logic (synced from source PPTX transitions)
  const [autoAdvanceTimeLeft, setAutoAdvanceTimeLeft] = useState<number | null>(null);
  const [isAutoAdvancePaused, setIsAutoAdvancePaused] = useState(false);

  useEffect(() => {
    const advanceMs = currentSlide?.transition?.advanceAfterTimeMs;
    const isLive = Boolean(activeControlState?.isLiveEnabled && !activeControlState?.isBlack && !activeControlState?.isClear && !activeControlState?.showLogo);

    if (!advanceMs || advanceMs <= 0 || !isLive || isAutoAdvancePaused) {
      setAutoAdvanceTimeLeft(null);
      return;
    }

    const duration = advanceMs;
    const startTime = Date.now();
    setAutoAdvanceTimeLeft(Math.ceil(duration / 1000));

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      setAutoAdvanceTimeLeft(Math.ceil(remaining / 1000));

      if (remaining <= 0) {
        clearInterval(interval);
        const current = activeControlState?.activeSlideIndex || 0;
        if (current < slides.length - 1) {
          store.setGroupState(groupId, { activeSlideIndex: current + 1 });
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [currentSlide?.id, activeControlState?.activeSlideIndex, currentSlide?.transition?.advanceAfterTimeMs, isAutoAdvancePaused, activeControlState?.isLiveEnabled, activeControlState?.isBlack, activeControlState?.isClear, activeControlState?.showLogo, slides.length, groupId]);

  return (
    <section 
      onClick={() => store.setActiveControlGroupId(groupId)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full h-full flex flex-col bg-[#0f1117] overflow-hidden select-none text-gray-200 relative transition-all duration-150 ${
        isDraggingSelf ? 'opacity-40 border-2 border-dashed border-sky-400' : ''
      } ${
        isItemDragOver ? 'ring-2 ring-emerald-500/80' : ''
      } ${
        isTargetedGroup ? 'ring-1 ring-sky-500/50 shadow-[0_0_12px_rgba(56,189,248,0.15)] z-10' : 'ring-1 ring-[#1f2330]'
      }`}
    >
      {/* Direct Content Drop Overlay */}
      {isItemDragOver && !isDraggingSelf && (
        <div className="absolute inset-0 z-50 bg-emerald-950/40 backdrop-blur-[1px] border-2 border-dashed border-emerald-400 pointer-events-none flex flex-col items-center justify-center text-center p-4">
          <Play size={28} className="text-emerald-400 fill-emerald-400 animate-bounce mb-2" />
          <p className="text-sm font-bold text-white shadow-sm">
            Drop here to Go LIVE in {activeGroup?.name || 'Output'}
          </p>
          <p className="text-[11px] text-emerald-200 mt-0.5">
            Images, Videos, Audio, PPTX presentations, Scriptures or Songs
          </p>
        </div>
      )}
      {/* Enterprise Drop Indicator Overlays */}
      {dropPosition === 'left' && (
        <div className="absolute left-0 top-0 bottom-0 w-2 bg-sky-400 z-50 shadow-[0_0_12px_#38bdf8] pointer-events-none rounded-r animate-pulse flex items-center justify-center">
          <div className="w-1 h-8 bg-white rounded-full"></div>
        </div>
      )}
      {dropPosition === 'right' && (
        <div className="absolute right-0 top-0 bottom-0 w-2 bg-sky-400 z-50 shadow-[0_0_12px_#38bdf8] pointer-events-none rounded-l animate-pulse flex items-center justify-center">
          <div className="w-1 h-8 bg-white rounded-full"></div>
        </div>
      )}

      {/* Live Header */}
      <div 
        draggable
        onDragStart={(e) => {
          setIsDraggingSelf(true);
          e.dataTransfer.setData('application/json', JSON.stringify({
            type: 'reorder-output-group',
            groupId: groupId,
            sourceIndex: groupIndex
          }));
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => setIsDraggingSelf(false)}
        className="h-9 flex items-center justify-between px-3 shrink-0 cursor-grab active:cursor-grabbing transition-colors bg-[#151720] border-b border-[#222634] z-40"
        title="Drag header to move panel left or right • Click to select as Active Target"
      >
        <div 
          className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer select-none overflow-hidden" 
          onClick={handleMakeActiveOverlay}
          title="Click to select this panel as Active Overlay for its target monitor(s)"
        >
          {/* Drag Handle Icon */}
          <div 
            className="p-0.5 text-gray-400 hover:text-sky-300 transition-colors flex items-center cursor-grab active:cursor-grabbing shrink-0"
            title="Drag to rearrange panel position"
          >
            <GripVertical size={13} />
          </div>

          <div className="flex items-center gap-1.5 min-w-0 shrink overflow-hidden">
            <span className="text-[11px] font-bold text-sky-400 tracking-wider uppercase truncate max-w-[100px] min-[420px]:max-w-[140px] sm:max-w-[180px]" title={activeGroup?.name || 'Output'}>
              {activeGroup?.name || 'Output'}
            </span>
            {liveItem?.name && (
              <>
                <span className="text-gray-500 shrink-0 hidden min-[520px]:inline">•</span>
                <span className="text-[11px] font-medium text-gray-300 truncate max-w-[80px] min-[600px]:max-w-[120px] hidden min-[520px]:inline" title={liveItem?.name}>
                  {liveItem?.name}
                </span>
              </>
            )}
            {activeControlState?.isLiveEnabled ? (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0 flex items-center gap-1 hidden min-[480px]:flex">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0 flex items-center gap-1 hidden min-[480px]:flex" title="Live button is OFF. Content is staged for preview.">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Live Off
              </span>
            )}
          </div>
        </div>

        <div 
          className="flex items-center space-x-1" 
          onClick={(e) => e.stopPropagation()} 
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Quick Send 1:1 Presentation Button */}
          <button
            onClick={async (e) => {
              e.stopPropagation();
              handleMakeActiveOverlay();
              for (const disp of groupTargetDisplays) {
                await DisplayManager.sendPresentationToTarget(groupId, disp);
              }
              window.dispatchEvent(
                new CustomEvent('simpleworship:notify', {
                  detail: `1:1 Presentation sent for ${activeGroup.name} to ${groupTargetDisplays.join(', ')}`
                })
              );
            }}
            className="p-1.5 rounded hover:bg-[#252937] text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
            title={`Send 1:1 Presentation to ${groupTargetDisplays.join(', ')} (Overlaying as Active)`}
          >
            <MonitorUp size={13} />
          </button>


          <div className="relative">
            <button
              onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
              className="p-1.5 rounded hover:bg-[#252937] text-gray-400 hover:text-sky-300 transition-colors cursor-pointer"
              title="Live View Options"
            >
              <ListFilter size={13} />
            </button>
            {isViewMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-[#1a1d27] border border-[#2e3447] rounded-md shadow-2xl py-1 text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Panel Arrangement
                </div>
                <button
                  onClick={() => {
                    moveOutputGroup(groupId, 'first');
                    setIsViewMenuOpen(false);
                  }}
                  disabled={isFirst}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[#262c3b] flex items-center gap-2 transition-colors ${
                    isFirst ? 'opacity-40 cursor-not-allowed' : 'text-gray-200'
                  }`}
                >
                  <ArrowLeft size={12} className="text-sky-400 shrink-0" />
                  <span>Move to First (Leftmost)</span>
                </button>
                <button
                  onClick={() => {
                    moveOutputGroup(groupId, 'left');
                    setIsViewMenuOpen(false);
                  }}
                  disabled={isFirst}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[#262c3b] flex items-center gap-2 transition-colors ${
                    isFirst ? 'opacity-40 cursor-not-allowed' : 'text-gray-200'
                  }`}
                >
                  <ChevronLeft size={12} className="text-sky-400 shrink-0" />
                  <span>Move Left</span>
                </button>
                <button
                  onClick={() => {
                    moveOutputGroup(groupId, 'right');
                    setIsViewMenuOpen(false);
                  }}
                  disabled={isLast}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[#262c3b] flex items-center gap-2 transition-colors ${
                    isLast ? 'opacity-40 cursor-not-allowed' : 'text-gray-200'
                  }`}
                >
                  <ChevronRight size={12} className="text-sky-400 shrink-0" />
                  <span>Move Right</span>
                </button>
                <button
                  onClick={() => {
                    moveOutputGroup(groupId, 'last');
                    setIsViewMenuOpen(false);
                  }}
                  disabled={isLast}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[#262c3b] flex items-center gap-2 transition-colors ${
                    isLast ? 'opacity-40 cursor-not-allowed' : 'text-gray-200'
                  }`}
                >
                  <ArrowRight size={12} className="text-sky-400 shrink-0" />
                  <span>Move to Last (Rightmost)</span>
                </button>

                <div className="border-t border-[#343a4a] my-1"></div>
                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Slide Layout
                </div>
                <button
                  onClick={() => handleSelectViewMode('large')}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[#323847] flex items-center gap-2.5 transition-colors ${viewMode === 'large' ? 'bg-[#2c3241] text-cyan-300 font-bold' : 'text-gray-200'}`}
                >
                  <Maximize2 size={13} className="text-gray-300 shrink-0" />
                  <span>Large Icons</span>
                </button>
                <button
                  onClick={() => handleSelectViewMode('medium')}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[#323847] flex items-center gap-2.5 transition-colors ${viewMode === 'medium' ? 'bg-[#2c3241] text-cyan-300 font-bold' : 'text-gray-200'}`}
                >
                  <Grid2x2 size={13} className="text-gray-300 shrink-0" />
                  <span>Medium Icons</span>
                </button>
                <button
                  onClick={() => handleSelectViewMode('small')}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[#323847] flex items-center gap-2.5 transition-colors ${viewMode === 'small' ? 'bg-[#2c3241] text-cyan-300 font-bold' : 'text-gray-200'}`}
                >
                  <Grid3x3 size={13} className="text-gray-300 shrink-0" />
                  <span>Small Icons</span>
                </button>
                <button
                  onClick={() => handleSelectViewMode('summary')}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[#323847] flex items-center gap-2.5 transition-colors ${viewMode === 'summary' ? 'bg-[#2c3241] text-cyan-300 font-bold' : 'text-gray-200'}`}
                >
                  <List size={13} className="text-gray-300 shrink-0" />
                  <span>Summary View</span>
                </button>
              </div>
            )}
          </div>

          {/* Remove Panel */}
          {outputGroups.length > 1 && (
            <button
              onClick={handleRemovePanel}
              className="p-1.5 rounded hover:bg-[#252937] text-gray-400 hover:text-rose-400 transition-colors cursor-pointer"
              title="Remove Live Panel"
            >
              <X size={13} />
            </button>
          )}

          {/* Configure Route Settings button */}
          <button
            onClick={() => setIsConfigOpen(true)}
            className="p-1.5 rounded hover:bg-[#252937] text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Configure Output Route"
          >
            <Settings size={13} />
          </button>


        </div>
      </div>

      {isConfigOpen && <RouteConfigModal groupId={groupId} onClose={() => setIsConfigOpen(false)} />}

      {/* Content Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Presentation Presenter Toolbar */}
        {isPresentation && liveItem && (
          <div className="bg-[#14151b] border-b border-[#262832] px-2.5 py-1.5 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="p-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                <Presentation size={13} />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-gray-200 truncate">{liveItem.name || 'PowerPoint Presentation'}</div>
                <div className="text-[10px] text-gray-400 flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-amber-400 font-bold">Slide {currentSlideIndex + 1}</span> of {slides.length}
                  
                  {/* Synced Slide Transition Info */}
                  {currentSlide?.transition && currentSlide.transition.type !== 'none' && (
                    <span className="px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono text-[9px] flex items-center gap-1">
                      <Zap size={9} className="text-amber-400" />
                      <span>{SlideTransitionManager.getTransitionLabel(currentSlide.transition.type)} ({currentSlide.transition.durationMs ?? 500}ms)</span>
                    </span>
                  )}

                  {/* Auto-Advance Countdown Indicator */}
                  {autoAdvanceTimeLeft !== null && (
                    <span 
                      onClick={() => setIsAutoAdvancePaused(!isAutoAdvancePaused)}
                      className={`px-1.5 py-0.2 rounded font-mono text-[9px] flex items-center gap-1 cursor-pointer transition-colors ${
                        isAutoAdvancePaused 
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' 
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                      }`}
                      title={isAutoAdvancePaused ? 'Auto-advance paused. Click to resume' : 'Auto-advance active. Click to pause'}
                    >
                      <Clock size={9} />
                      <span>{isAutoAdvancePaused ? 'Paused' : `Auto: ${autoAdvanceTimeLeft}s`}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handlePrevSlide}
                disabled={currentSlideIndex <= 0}
                className="px-2.5 py-1 bg-[#222530] hover:bg-[#2c3040] disabled:opacity-30 disabled:cursor-not-allowed rounded text-xs font-medium text-gray-200 flex items-center gap-1 border border-[#303546] transition-colors"
                title="Previous Slide"
              >
                <ChevronLeft size={13} />
                <span>Prev</span>
              </button>

              <button
                onClick={handleNextSlide}
                disabled={currentSlideIndex >= slides.length - 1}
                className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 disabled:opacity-30 disabled:cursor-not-allowed rounded text-xs font-medium text-amber-300 flex items-center gap-1 border border-amber-500/40 transition-colors"
                title="Next Slide"
              >
                <span>Next</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}

        {!showPreviewDisplay ? (
          /* Fixed Live Output Panel WITHOUT display: Full-height slides */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            <div className={`flex-1 bg-[#18191e] p-2 overflow-y-auto custom-scrollbar ${viewMode === 'large' ? 'space-y-3' : viewMode === 'small' || viewMode === 'summary' ? 'space-y-1' : 'space-y-2'}`}>
              {slides.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-500">
                  <Tv size={28} className="text-gray-600 mb-2 opacity-60" />
                  <span className="text-xs font-semibold text-gray-400">No Content in this Route</span>
                  <p className="text-[11px] text-gray-500 mt-1 max-w-xs">
                    Select or double click any item from Schedule, Scriptures, or Songs to stage or present
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 p-1.5 w-full min-w-0">
                  {slides.map((slide, idx) => (
                    <LiveSlideCard
                      key={slide.id || idx}
                      slide={slide}
                      idx={idx}
                      totalSlides={slides.length}
                      isSelected={activeControlState?.activeSlideIndex === idx}
                      viewMode={viewMode}
                      liveItem={liveItem}
                      liveContentType={liveContentType}
                      mediaFormat={mediaFormat}
                      resolvedStyles={resolvedStyles}
                      systemOptions={systemOptions}
                      activeControlState={activeControlState}
                      onSelect={handleSelectSlide}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <PanelGroup direction="vertical" autoSaveId={`workspace-layout-v3-live-${groupId}`}>
            {/* Top Half: Slide Thumbnails / List */}
            <Panel id={`panel-slides-${groupId}`} order={1} defaultSize={52} minSize={25}>
              <div className={`h-full bg-[#18191e] p-2 overflow-y-auto custom-scrollbar ${viewMode === 'large' ? 'space-y-3' : viewMode === 'small' || viewMode === 'summary' ? 'space-y-1' : 'space-y-2'}`}>
                {slides.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-500">
                    <Tv size={28} className="text-gray-600 mb-2 opacity-60" />
                    <span className="text-xs font-semibold text-gray-400">No Content in this Route</span>
                    <p className="text-[11px] text-gray-500 mt-1 max-w-xs">
                      Select or double click any item from Schedule, Scriptures, or Songs to stage or present
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 p-1.5 w-full min-w-0">
                    {slides.map((slide, idx) => (
                      <LiveSlideCard
                        key={slide.id || idx}
                        slide={slide}
                        idx={idx}
                        totalSlides={slides.length}
                        isSelected={activeControlState?.activeSlideIndex === idx}
                        viewMode={viewMode}
                        liveItem={liveItem}
                        liveContentType={liveContentType}
                        mediaFormat={mediaFormat}
                        resolvedStyles={resolvedStyles}
                        systemOptions={systemOptions}
                        activeControlState={activeControlState}
                        onSelect={handleSelectSlide}
                      />
                    ))}
                  </div>
                )}
              </div>
            </Panel>

            <ResizeHandle direction="vertical" />

            {/* Bottom Half: Live Output Monitor Display Screen */}
            <Panel id={`panel-preview-${groupId}`} order={2} defaultSize={48} minSize={25}>
              <div className="h-full bg-[#111216] border-t border-[#262832] p-2 flex flex-col overflow-hidden relative">
                {/* Header Bar for Live Monitor Output */}
                <div className="text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5 px-2 py-1 bg-[#181920] rounded border border-[#252834] flex items-center justify-between shrink-0 shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      activeControlState?.isBlack || activeControlState?.isClear 
                        ? 'bg-amber-500 animate-pulse' 
                        : (activeControlState?.isLiveEnabled && currentSlide 
                            ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' 
                            : (currentSlide ? 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]' : 'bg-gray-500'))
                    }`} />
                    <span className="text-gray-200 font-semibold flex items-center gap-1.5">
                      {activeGroup?.name || 'Live Output Monitor'}
                      {currentSlide && (
                        <span className={`text-[10px] font-mono font-normal lowercase border px-1.5 py-0.5 rounded ${
                          activeControlState?.isLiveEnabled
                            ? 'text-emerald-400 bg-emerald-950/80 border-emerald-800/60 font-semibold'
                            : 'text-amber-300 bg-amber-950/80 border-amber-800/60'
                        }`}>
                          {activeControlState?.isLiveEnabled ? 'live' : 'preview'} • slide {currentSlideIndex + 1}/{slides.length}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <SlideAnnotationHUD className="static py-0.5 px-2" />
                  </div>
                </div>

                {/* The Live Output Monitor Screen Box */}
                <div className="flex-1 w-full min-h-0 bg-[#08090b] rounded-lg border border-[#222530] overflow-hidden relative flex items-center justify-center shadow-inner">
                  <MonitorPreviewCanvas groupId={groupId} showResolutionTag={false} />
                </div>
                
                {/* Speaker Notes & Metadata Section */}
                {currentSlide && (currentSlide.notes || currentSlide.transition) && (
                  <div className="mt-2 shrink-0 max-h-32 overflow-y-auto custom-scrollbar bg-[#181920] rounded border border-[#252834] p-2 text-xs">
                    {currentSlide.transition && (
                      <div className="text-[10px] text-sky-400 font-mono mb-1.5 flex items-center gap-1">
                        <span className="font-bold uppercase">Transition:</span> 
                        {currentSlide.transition.type} {currentSlide.transition.durationMs ? `(${currentSlide.transition.durationMs}ms)` : ''}
                      </div>
                    )}
                    {currentSlide.notes && (
                      <div>
                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Speaker Notes</div>
                        <div className="text-gray-300 whitespace-pre-wrap leading-relaxed">{currentSlide.notes}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Panel>
          </PanelGroup>
        )}
      </div>
    </section>
  );
}
