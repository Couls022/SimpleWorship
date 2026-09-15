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
  Presentation,
  Clock,
  Zap,
  Pencil,
  Check
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

  const activeSchedule = useStore(state => state.activeSchedule);
  const publicControlState = useStore(state => state.groupStates[groupId]);
  const outputGroups = useStore(state => state.outputGroups);
  const songsList = useStore(state => state.songsList);
  const themesList = useStore(state => state.themesList);
  const alert = useStore(state => state.alert);
  const systemOptions = useStore(state => state.systemOptions);
  const setStagedGroupState = useStore(state => state.setStagedGroupState);
  const addOutputGroup = useStore(state => state.addOutputGroup);
  const removeOutputGroup = useStore(state => state.removeOutputGroup);
  const reorderOutputGroups = useStore(state => state.reorderOutputGroups);
  const updateOutputGroup = useStore(state => state.updateOutputGroup);
  const updateRouterPanel = useStore(state => state.updateRouterPanel);
  const routerPanels = useStore(state => state.routerPanels);
  
  const activeRouterId = useStore(state => state.activeRouterId);
  const activeControlGroupId = useStore(state => state.activeControlGroupId);
  const stagedGroupState = useStore(state => state.stagedGroupStates[groupId]);
  
  const { panels, togglePanelDock } = useWorkspace();
  const isDocked = panels.live?.isDocked ?? true;

  const activeGroup = outputGroups.find(g => g.id === groupId) || outputGroups[0];
  const groupIndex = outputGroups.findIndex(g => g.id === groupId);

  const matchedRouter = routerPanels.find(p => p.routerId === routerId || p.targetOutputGroupId === groupId);
  const routerIndex = routerPanels.findIndex(p => p.routerId === (matchedRouter?.routerId || routerId));
  const fallbackRouteName = routerIndex !== -1 ? `Route ${routerIndex + 1}` : (groupIndex !== -1 ? `Route ${groupIndex + 1}` : 'Route');
  const displayTitle = matchedRouter?.name || activeGroup?.name || fallbackRouteName;

  const [isRenamingTitle, setIsRenamingTitle] = useState(false);
  const [editingTitleText, setEditingTitleText] = useState('');

  const saveTitleRename = () => {
    const trimmed = editingTitleText.trim();
    const finalTitle = trimmed || fallbackRouteName;
    if (activeGroup) {
      updateOutputGroup(activeGroup.id, { name: finalTitle });
    }
    if (matchedRouter) {
      updateRouterPanel(matchedRouter.routerId, { name: finalTitle });
    }
    setIsRenamingTitle(false);
    setEditingTitleText('');
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Renamed to ${finalTitle}` 
      })
    );
  };

  const activeControlState = stagedGroupState;
  const isTargetedGroup = activeRouterId === routerId || (!routerId && activeControlGroupId === groupId);
  const isActiveControlGroup = activeControlGroupId === groupId;
  const groupTargetDisplays = (activeGroup?.displayIds && activeGroup.displayIds.length > 0)
    ? activeGroup.displayIds
    : (activeGroup?.targetDisplayId ? [activeGroup.targetDisplayId] : []);

  const handleFocusPanel = () => {
    const targetRouter = routerId || useStore.getState().activeRouterId || 'router-1';
    useStore.getState().setActiveRouterId(targetRouter);
    useStore.getState().setActiveControlGroupId(groupId);
  };

  const handleAddPanel = () => {
    const nextNum = outputGroups.length + 1;
    const newGroup = {
      id: `group-${Date.now()}`,
      name: `Route ${nextNum}`,
      role: 'broadcast' as const,
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
  
  const baseSong = liveItem?.type === 'song' 
    ? songsList.find(s => s.id === liveItem.contentId || s.id === liveItem.data?.songId || s.title?.toLowerCase() === liveItem.name?.toLowerCase()) 
    : null;
  const itemTheme = themesList.find(t => t.id === (liveItem?.themeId || baseSong?.themeId));
  
  // Schedule item's override takes precedence over the base song's override
  const elementOverride = liveItem?.themeOverride || baseSong?.themeOverride;

  const systemFontOverride = ThemeEngine.getSystemFontForContent(systemOptions, liveItem?.type);

  const resolvedStyles = React.useMemo(() => ThemeEngine.resolveStyles(
    globalTheme?.styles || ThemeEngine.getDefaultGlobalTheme(),
    groupTheme?.styles,
    typeTheme?.styles,
    systemFontOverride,
    itemTheme?.styles,
    elementOverride
  ), [globalTheme, groupTheme, typeTheme, systemFontOverride, itemTheme, elementOverride]);

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
        useStore.getState().setActiveSchedule(dropResult.schedule);
        return;
      }
      if (dropResult.items && dropResult.items.length > 0) {
        // Go live with the first dropped item immediately on this output panel without polluting schedule
        const targetLiveItem = dropResult.items[0];
        useStore.getState().goLiveItem(targetLiveItem.id, 0, groupId, targetLiveItem, routerId);
        useStore.getState().setStagedGroupState(groupId, {
          activeItemId: targetLiveItem.id,
          activeSlideIndex: 0,
      pptxAction: null,
          isBlack: false,
          isClear: false,
        });
        window.dispatchEvent(
          new CustomEvent('simpleworship:notify', { 
            detail: `Staged on ${activeGroup?.name || 'Output'}: "${targetLiveItem.name}". Click Commit to send Live.` 
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

        // Handle schedule item, scripture verses, or song drop to stage
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
          useStore.getState().goLiveItem(itemId, 0, groupId, newItem, routerId); 
          useStore.getState().setStagedGroupState(groupId, {
            activeItemId: itemId,
            activeSlideIndex: 0,
            isBlack: false,
            isClear: false,
          });
          window.dispatchEvent(
            new CustomEvent('simpleworship:notify', { 
              detail: `Staged on ${activeGroup?.name || 'Output'}: "${newItem.name}". Click Commit to send Live.` 
            })
          );
        }
      } catch (err) {
        console.error('Failed to parse live drop payload', err);
      }
    }
  };

  const handleSelectSlide = React.useCallback((idx: number) => {
    useStore.getState().setActiveControlGroupId(groupId);
    if (activeControlState?.activeItemId === liveItem?.id) {
      useStore.getState().setStagedGroupState(groupId, { activeSlideIndex: idx, pptxAction: null });
    } else if (liveItem) {
      useStore.getState().goLiveItem(liveItem.id, idx, groupId, liveItem, routerId);
    }
  }, [groupId, activeControlState?.activeItemId, liveItem, routerId]);

  const handlePrevSlide = () => {
    if (slides.length === 0) return;
    const current = activeControlState?.activeSlideIndex || 0;
    const prev = Math.max(0, current - 1);
    useStore.getState().setStagedGroupState(groupId, { activeSlideIndex: prev, pptxAction: null });
  };

  const handleNextSlide = () => {
    if (slides.length === 0) return;
    const current = activeControlState?.activeSlideIndex || 0;
    const next = Math.min(slides.length - 1, current + 1);
    useStore.getState().setStagedGroupState(groupId, { activeSlideIndex: next, pptxAction: null });
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
          useStore.getState().setStagedGroupState(groupId, { activeSlideIndex: current + 1, pptxAction: null });
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [currentSlide?.id, activeControlState?.activeSlideIndex, currentSlide?.transition?.advanceAfterTimeMs, isAutoAdvancePaused, activeControlState?.isLiveEnabled, activeControlState?.isBlack, activeControlState?.isClear, activeControlState?.showLogo, slides.length, groupId]);

  return (
    <section 
      onClick={() => useStore.getState().setActiveControlGroupId(groupId)}
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
        className="min-h-9 py-1 flex items-center justify-between flex-wrap gap-1 px-3 shrink-0 cursor-grab active:cursor-grabbing transition-colors bg-[#151720] border-b border-[#222634] z-40"
        title="Drag header to move panel left or right • Click to select as Active Target"
      >
        <div 
          className="flex items-center gap-1.5 min-w-0 flex-1 cursor-pointer select-none overflow-hidden" 
          onClick={handleFocusPanel}
          title="Click to focus this route in operator console"
        >
          {/* Drag Handle Icon */}
          <div 
            className="p-0.5 text-gray-400 hover:text-sky-300 transition-colors flex items-center cursor-grab active:cursor-grabbing shrink-0"
            title="Drag to rearrange panel position"
          >
            <GripVertical size={13} />
          </div>

          <div className="flex items-center gap-1.5 min-w-0 shrink overflow-hidden">
            {isRenamingTitle ? (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <input
                  type="text"
                  value={editingTitleText}
                  onChange={e => setEditingTitleText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveTitleRename();
                    if (e.key === 'Escape') setIsRenamingTitle(false);
                  }}
                  onBlur={saveTitleRename}
                  autoFocus
                  className="bg-[#0f1118] border border-sky-500 rounded px-1.5 py-0 text-[11px] text-white font-bold w-[110px] outline-none"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    saveTitleRename();
                  }}
                  className="p-0.5 rounded hover:bg-emerald-800 text-emerald-300 cursor-pointer"
                  title="Save name"
                >
                  <Check size={11} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 min-w-0">
                <span 
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingTitleText(displayTitle);
                    setIsRenamingTitle(true);
                  }}
                  className="text-[11px] font-bold text-sky-400 tracking-wider uppercase truncate max-w-[100px] min-[420px]:max-w-[140px] sm:max-w-[180px] cursor-pointer" 
                  title={`${displayTitle} (Double-click to rename)`}
                >
                  {displayTitle}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingTitleText(displayTitle);
                    setIsRenamingTitle(true);
                  }}
                  className="opacity-40 hover:opacity-100 p-0.5 rounded hover:bg-sky-950 text-sky-300 transition-opacity cursor-pointer"
                  title="Rename Route"
                >
                  <Pencil size={10} />
                </button>
              </div>
            )}
            {liveItem?.name && (
              <>
                <span className="text-gray-500 shrink-0 hidden min-[520px]:inline">•</span>
                <span className="text-[11px] font-medium text-gray-300 truncate max-w-[80px] min-[600px]:max-w-[120px] hidden min-[520px]:inline" title={liveItem?.name}>
                  {liveItem?.name}
                </span>
              </>
            )}
          </div>
        </div>

        <div 
          className="flex items-center gap-1.5 shrink-0" 
          onClick={(e) => e.stopPropagation()} 
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* View Options Menu */}
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

          {/* Remove Panel - only for user-created dynamic routes */}
          {outputGroups.length > 2 && activeGroup && 
           activeGroup.id !== 'group-congregation' && 
           activeGroup.id !== 'group-r2' && 
           activeGroup.id !== 'group-stage' && (
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
      <div className="flex-1 overflow-hidden flex flex-col max-h-full">
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
            <div className={`flex-1 bg-[#18191e] p-2 overflow-y-auto min-h-0 custom-scrollbar ${viewMode === 'large' ? 'space-y-3' : viewMode === 'small' || viewMode === 'summary' ? 'space-y-1' : 'space-y-2'}`}>
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
                      isPublicLive={publicControlState?.activeItemId === liveItem?.id && publicControlState?.activeSlideIndex === idx && Boolean(publicControlState?.isLiveEnabled && !publicControlState?.isBlack && !publicControlState?.isClear)}
                      viewMode={viewMode}
                      liveItem={liveItem}
                      liveContentType={liveContentType}
                      mediaFormat={mediaFormat}
                      resolvedStyles={resolvedStyles}
                      systemOptions={systemOptions}
                      isVideoPlaying={activeControlState?.activeSlideIndex === idx ? activeControlState?.isVideoPlaying : undefined}
                      videoDuration={activeControlState?.activeSlideIndex === idx ? activeControlState?.videoDuration : undefined}
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
              <div className={`h-full bg-[#18191e] p-2 overflow-y-auto min-h-0 custom-scrollbar ${viewMode === 'large' ? 'space-y-3' : viewMode === 'small' || viewMode === 'summary' ? 'space-y-1' : 'space-y-2'}`}>
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
                        isPublicLive={publicControlState?.activeItemId === liveItem?.id && publicControlState?.activeSlideIndex === idx && Boolean(publicControlState?.isLiveEnabled && !publicControlState?.isBlack && !publicControlState?.isClear)}
                        viewMode={viewMode}
                        liveItem={liveItem}
                        liveContentType={liveContentType}
                        mediaFormat={mediaFormat}
                        resolvedStyles={resolvedStyles}
                        systemOptions={systemOptions}
                        isVideoPlaying={activeControlState?.activeSlideIndex === idx ? activeControlState?.isVideoPlaying : undefined}
                        videoDuration={activeControlState?.activeSlideIndex === idx ? activeControlState?.videoDuration : undefined}
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
                  <div className="mt-2 shrink-0 max-h-32 overflow-y-auto min-h-0 custom-scrollbar bg-[#181920] rounded border border-[#252834] p-2 text-xs">
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
