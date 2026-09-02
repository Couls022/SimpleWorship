import React, { useState } from 'react';
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
  VolumeX
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

interface LivePanelProps {
  groupId: string;
}

export default function LivePanel({ groupId }: LivePanelProps) {
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
  const isTargetedGroup = store.activeControlGroupId === groupId;

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

  const isExplicitImage = Boolean(
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

  const isVideoItem = !isExplicitImage && Boolean(
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
      (!currentSlide?.backgroundUrl && resolvedStyles.backgroundType === 'video' && Boolean(resolvedStyles.backgroundVideoUrl) && liveItem?.type !== 'song' && liveItem?.type !== 'bible')
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
    setIsItemDragOver(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeftHalf = (e.clientX - rect.left) < rect.width / 2;
    setDropPosition(isLeftHalf ? 'left' : 'right');
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const finalDropPos = dropPosition;
    setDropPosition(null);
    setIsItemDragOver(false);

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
          if (payload.source !== 'schedule') {
            store.addScheduleItem(newItem);
          }
          store.goLiveItem(itemId, 0, groupId); 
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
    if (liveItem) {
      store.goLiveItem(liveItem.id, idx, groupId);
    }
  };

  return (
    <section 
      onClick={() => store.setActiveControlGroupId(groupId)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-full h-full flex flex-col bg-[#1e2026] overflow-hidden select-none text-gray-200 relative transition-all duration-150 ${
        isDraggingSelf ? 'opacity-40 border-2 border-dashed border-cyan-400' : ''
      } ${
        isItemDragOver ? 'ring-2 ring-emerald-500/80' : ''
      } ${
        isTargetedGroup ? 'ring-2 ring-cyan-500/90 shadow-[0_0_15px_rgba(34,211,238,0.2)] z-10' : 'ring-1 ring-[#2a2d38] opacity-95 hover:opacity-100'
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
            Auto-flowing selected scripture into template slides
          </p>
        </div>
      )}
      {/* Enterprise Drop Indicator Overlays */}
      {dropPosition === 'left' && (
        <div className="absolute left-0 top-0 bottom-0 w-2.5 bg-cyan-400 z-50 shadow-[0_0_15px_#22d3ee] pointer-events-none rounded-r animate-pulse flex items-center justify-center">
          <div className="w-1 h-8 bg-white rounded-full"></div>
        </div>
      )}
      {dropPosition === 'right' && (
        <div className="absolute right-0 top-0 bottom-0 w-2.5 bg-cyan-400 z-50 shadow-[0_0_15px_#22d3ee] pointer-events-none rounded-l animate-pulse flex items-center justify-center">
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
        className={`h-8 flex items-center justify-between px-2 shrink-0 cursor-grab active:cursor-grabbing transition-colors ${
          isTargetedGroup
            ? 'bg-gradient-to-r from-[#1c2a38] via-[#24354a] to-[#1a2636] border-b border-cyan-500/60'
            : 'bg-[#282b33] border-b border-[#18191d] hover:bg-[#2d313a]'
        }`}
        title="Drag header to move panel left or right • Click to select as Active Target"
      >
        <div className="flex items-center gap-1.5 min-w-0" onClick={() => store.setActiveControlGroupId(groupId)}>
          {/* Drag Handle Icon */}
          <div 
            className="p-0.5 text-gray-400 hover:text-cyan-300 transition-colors flex items-center cursor-grab active:cursor-grabbing"
            title="Drag to rearrange panel position"
          >
            <GripVertical size={14} />
          </div>

          {/* Position Index Badge */}
          <span 
            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border shrink-0 ${
              isTargetedGroup ? 'bg-cyan-950 text-cyan-300 border-cyan-500/50' : 'bg-[#16171d] text-cyan-400 border-[#373b47]'
            }`}
            title={`Panel sequence position #${groupIndex + 1} of ${outputGroups.length}`}
          >
            #{groupIndex + 1}
          </span>

          <span className="text-xs font-bold text-gray-200 tracking-wide uppercase truncate">
            <span className={isTargetedGroup ? 'text-cyan-300 font-extrabold' : 'text-indigo-400'}>{activeGroup?.name || 'Live Panel'}</span> • Live - {liveItem?.name || 'No Content Live'}
          </span>

          {isTargetedGroup ? (
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 tracking-wider uppercase ml-1 animate-pulse shrink-0">
              TARGET
            </span>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); store.setActiveControlGroupId(groupId); }}
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#1e2029] hover:bg-cyan-950 text-gray-400 hover:text-cyan-300 border border-[#343948] transition-colors ml-1 shrink-0"
              title="Click to set this panel as active live target"
            >
              Select Target
            </button>
          )}
        </div>

        <div 
          className="flex items-center space-x-1" 
          onClick={(e) => e.stopPropagation()} 
          onMouseDown={(e) => e.stopPropagation()}
        >


          <div className="relative">
            <button
              onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
              className="p-1 rounded hover:bg-[#383d47] text-gray-400 hover:text-cyan-400 transition-colors"
              title="Live View Options"
            >
              <ListFilter size={12} />
            </button>
            {isViewMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-[#232630] border border-[#3b4152] rounded-md shadow-2xl py-1 text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Panel Arrangement
                </div>
                <button
                  onClick={() => {
                    moveOutputGroup(groupId, 'first');
                    setIsViewMenuOpen(false);
                  }}
                  disabled={isFirst}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[#323847] flex items-center gap-2 transition-colors ${
                    isFirst ? 'opacity-40 cursor-not-allowed' : 'text-gray-200'
                  }`}
                >
                  <ArrowLeft size={12} className="text-cyan-400 shrink-0" />
                  <span>Move to First (Leftmost)</span>
                </button>
                <button
                  onClick={() => {
                    moveOutputGroup(groupId, 'left');
                    setIsViewMenuOpen(false);
                  }}
                  disabled={isFirst}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[#323847] flex items-center gap-2 transition-colors ${
                    isFirst ? 'opacity-40 cursor-not-allowed' : 'text-gray-200'
                  }`}
                >
                  <ChevronLeft size={12} className="text-cyan-400 shrink-0" />
                  <span>Move Left</span>
                </button>
                <button
                  onClick={() => {
                    moveOutputGroup(groupId, 'right');
                    setIsViewMenuOpen(false);
                  }}
                  disabled={isLast}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[#323847] flex items-center gap-2 transition-colors ${
                    isLast ? 'opacity-40 cursor-not-allowed' : 'text-gray-200'
                  }`}
                >
                  <ChevronRight size={12} className="text-cyan-400 shrink-0" />
                  <span>Move Right</span>
                </button>
                <button
                  onClick={() => {
                    moveOutputGroup(groupId, 'last');
                    setIsViewMenuOpen(false);
                  }}
                  disabled={isLast}
                  className={`w-full px-3 py-1.5 text-left hover:bg-[#323847] flex items-center gap-2 transition-colors ${
                    isLast ? 'opacity-40 cursor-not-allowed' : 'text-gray-200'
                  }`}
                >
                  <ArrowRight size={12} className="text-cyan-400 shrink-0" />
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

          {/* Add Panel */}
          <button
            onClick={handleAddPanel}
            className="p-1 rounded hover:bg-[#383d47] text-gray-400 hover:text-cyan-400 transition-colors"
            title="Add Live Panel"
          >
            <Plus size={12} />
          </button>

          {/* Remove Panel */}
          {outputGroups.length > 1 && (
            <button
              onClick={handleRemovePanel}
              className="p-1 rounded hover:bg-[#383d47] text-gray-400 hover:text-rose-400 transition-colors"
              title="Remove Live Panel"
            >
              <X size={12} />
            </button>
          )}

          {/* Dock / Undock (Float) toggle */}
          <button
            onClick={() => togglePanelDock('live')}
            className={`p-1 rounded hover:bg-[#383d47] transition-colors text-[10px] ${
              !isDocked ? 'text-cyan-400 bg-[#323744]' : 'text-gray-400 hover:text-white'
            }`}
            title={isDocked ? 'Float / Undock Live Panel' : 'Dock Live Panel to Grid'}
          >
            <Pin size={12} className={isDocked ? '' : 'rotate-45'} />
          </button>

          {/* Configure Route dropdown/button */}
          <button
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-0.5 px-1.5 py-0.5 hover:bg-[#383d47] rounded text-gray-300 hover:text-white transition-colors text-[10px]"
            title="Configure Output Route"
          >
            <Settings size={13} />
            <ChevronDown size={10} />
          </button>

          {/* Go Live button */}
          <button
            onClick={() => {
              const activeGroupState = store.groupStates[groupId];
              if (activeGroupState?.activeItemId) {
                // Keep whatever content is already inside this live output panel
                store.setGroupState(groupId, {
                  isBlack: false,
                  isClear: false,
                  showLogo: false,
                });
                store.setActiveControlGroupId(groupId);
                window.dispatchEvent(
                  new CustomEvent('simpleworship:notify', { 
                    detail: `LIVE: Output active for ${activeGroup?.name || 'Monitor'}!` 
                  })
                );
              } else {
                // If panel is empty, only then initialize from schedule
                const itemToGoLive = store.activeSchedule?.items.length 
                  ? store.activeSchedule.items[0].id 
                  : store.previewItemId;
                
                if (itemToGoLive) {
                  store.goLiveItem(itemToGoLive, 0, groupId);
                  window.dispatchEvent(
                    new CustomEvent('simpleworship:notify', { 
                      detail: `LIVE: Direct Output to ${activeGroup?.name || 'Monitor'}!` 
                    })
                  );
                }
              }
            }}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-[10px] font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
            title={`Go Live: Direct output to ${activeGroup?.name || 'this display'}`}
          >
            <Play size={11} className="fill-white text-white" />
            <span>GO LIVE</span>
          </button>
        </div>
      </div>

      {isConfigOpen && <RouteConfigModal groupId={groupId} onClose={() => setIsConfigOpen(false)} />}

      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="vertical" autoSaveId={`workspace-layout-v3-live-${groupId}`}>
          {/* Top Half: Slide Thumbnails / List */}
          <Panel id={`panel-slides-${groupId}`} order={1} defaultSize={52} minSize={25}>
            <div className={`h-full bg-[#18191e] p-2 overflow-y-auto custom-scrollbar ${viewMode === 'large' ? 'space-y-3' : viewMode === 'small' || viewMode === 'summary' ? 'space-y-1' : 'space-y-2'}`}>
              {slides.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-gray-500">
                  <Tv size={28} className="text-gray-600 mb-2 opacity-60" />
                  <span className="text-xs font-semibold text-gray-400">No Content Live in this Route</span>
                  <p className="text-[11px] text-gray-500 mt-1 max-w-xs">
                    Double click any item from Schedule or click 'Go Live' to project to this display
                  </p>
                </div>
              ) : (
                slides.map((slide, idx) => {
                  const isSelected = activeControlState?.activeSlideIndex === idx;
                  const isScripture = liveItem?.type === 'bible';
                  const isSong = liveItem?.type === 'song';

                  return (
                    <div
                      key={slide.id || idx}
                      onClick={() => handleSelectSlide(idx)}
                      className={`flex rounded-xs border cursor-pointer select-none transition-all text-left overflow-hidden ${
                        isSelected
                          ? 'border-blue-500 ring-2 ring-blue-500/50 bg-[#1f2838] shadow-md'
                          : 'border-[#2d3039] bg-[#22242c] hover:border-[#404554]'
                      }`}
                    >
                      {viewMode !== 'summary' && (
                        <div className={`bg-[#16171c] border-r border-[#2d3039] flex flex-col items-center justify-start shrink-0 ${viewMode === 'large' ? 'w-12 py-3' : viewMode === 'small' ? 'w-8 py-1' : 'w-10 py-2'}`}>
                          <span className={`${viewMode === 'large' ? 'text-xs' : 'text-[11px]'} font-mono font-bold text-gray-300`}>
                            {idx + 1}
                          </span>
                          <Tv size={viewMode === 'large' ? 15 : viewMode === 'small' ? 11 : 13} className="text-gray-400 mt-1" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className={`${viewMode === 'large' ? 'px-3 py-1 text-xs' : viewMode === 'small' || viewMode === 'summary' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'} font-bold truncate border-b border-black/30 ${
                          (() => {
                            const t = (slide.title || liveItem?.name || '').toLowerCase();
                            if (isScripture) return 'bg-[#5f171d] text-rose-100';
                            if (!isSong) return 'bg-[#1e2a44] text-blue-100';
                            
                            if (t.includes('chorus') || t.includes('koro') || t.includes('refrain')) return 'bg-emerald-900 text-emerald-100 border-emerald-700/50';
                            if (t.includes('bridge') || t.includes('tulay')) return 'bg-purple-900 text-purple-100 border-purple-700/50';
                            if (t.includes('pre-chorus')) return 'bg-amber-900 text-amber-100 border-amber-700/50';
                            if (t.includes('tag') || t.includes('ending') || t.includes('coda')) return 'bg-rose-900 text-rose-100 border-rose-700/50';
                            if (t.includes('verse') || t.includes('talatâ') || t.match(/^v\d+$/)) return 'bg-indigo-900 text-indigo-100 border-indigo-700/50';
                            
                            return 'bg-[#1e2a44] text-blue-100'; // Default Blue
                          })()
                        }`}>
                          {viewMode === 'summary' && (
                            <span className="text-gray-400 font-mono mr-2">{idx + 1}</span>
                          )}
                          {slide.title || liveItem?.name || `Slide ${idx + 1}`}
                        </div>

                        {viewMode !== 'summary' && (
                          <div 
                            className={`${viewMode === 'large' ? 'p-3 text-sm min-h-[64px]' : viewMode === 'small' ? 'p-1.5 text-[10px] min-h-[32px]' : 'p-2 text-[11px] min-h-[48px]'} leading-relaxed font-sans whitespace-pre-line bg-[#1c1e24] relative overflow-hidden`}
                          >
                            <div 
                              className="relative z-10"
                              style={{
                                textTransform: resolvedStyles.textTransform || (
                                  isSong 
                                    ? ((systemOptions?.mainOutput?.song?.allCapsLyrics || systemOptions?.mainOutput?.song?.songFont?.casing === 'uppercase') ? 'uppercase' : undefined)
                                    : (isScripture && systemOptions?.mainOutput?.scripture?.scriptureFont?.casing === 'uppercase' ? 'uppercase' : undefined)
                                ),
                                color: resolvedStyles.fontColor || '#ffffff',
                                textShadow: resolvedStyles.textShadow ? `${resolvedStyles.shadowOffsetX || 0}px ${resolvedStyles.shadowOffsetY || 2}px ${resolvedStyles.shadowBlur || 4}px ${resolvedStyles.shadowColor || 'rgba(0,0,0,0.85)'}` : undefined,
                                textAlign: (resolvedStyles.textAlign as any) || 'center',
                                fontWeight: resolvedStyles.fontWeight || (
                                  isSong 
                                    ? (systemOptions?.mainOutput?.song?.songFont?.bold ? '700' : '400')
                                    : (isScripture ? (systemOptions?.mainOutput?.scripture?.scriptureFont?.bold ? '700' : '400') : '700')
                                ),
                                fontStyle: resolvedStyles.fontStyle || (
                                  isSong 
                                    ? (systemOptions?.mainOutput?.song?.songFont?.italic ? 'italic' : 'normal')
                                    : (isScripture ? (systemOptions?.mainOutput?.scripture?.scriptureFont?.italic ? 'italic' : 'normal') : 'normal')
                                ),
                                fontFamily: resolvedStyles.fontFamily || (
                                  isSong 
                                    ? (systemOptions?.mainOutput?.song?.songFont?.family || 'Tahoma, sans-serif')
                                    : (isScripture ? (systemOptions?.mainOutput?.scripture?.scriptureFont?.family || 'Tahoma, sans-serif') : 'Tahoma, sans-serif')
                                ),
                                lineHeight: resolvedStyles.lineHeight || (
                                  isSong 
                                    ? (systemOptions?.mainOutput?.song?.lineSpacing || 1.3)
                                    : (isScripture ? (systemOptions?.mainOutput?.scripture?.lineSpacing || 1.35) : 1.35)
                                ),
                              }}
                            >
                              {isScripture && slide.verses && slide.verses.length > 0 ? (
                                slide.verses.map((v: any, vIdx: number) => (
                                  <span key={v.verse || vIdx} className="inline">
                                    {(systemOptions?.mainOutput?.scripture?.showVerseNumbers ?? true) && (
                                      <span 
                                        className="font-bold inline-block mr-1.5 select-none"
                                        style={{ 
                                          color: systemOptions?.mainOutput?.scripture?.verseFont?.color || systemOptions?.mainOutput?.scripture?.verseColor || '#F6E05E',
                                          fontFamily: systemOptions?.mainOutput?.scripture?.verseFont?.family || resolvedStyles.fontFamily || 'Tahoma, sans-serif',
                                        }}
                                      >
                                        {formatVerseNumber(v.verse, systemOptions?.mainOutput?.scripture?.verseNumberStyle)}
                                      </span>
                                    )}
                                    <span>{v.text}</span>
                                    {vIdx < slide.verses.length - 1 && ' '}
                                  </span>
                                ))
                              ) : (
                                slide.text
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
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
                      : (currentSlide ? 'bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-gray-500')
                  }`} />
                  <span className="text-gray-200 font-semibold flex items-center gap-1.5">
                    {activeGroup?.name || 'Live Output Monitor'}
                    {currentSlide && (
                      <span className="text-emerald-400 text-[10px] font-mono font-normal lowercase bg-emerald-950/80 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                        live • slide {currentSlideIndex + 1}/{slides.length}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Video Player Controls Panel (Shown when a video is active) */}
              {isVideoItem && (
                <div className="mb-2 p-2 bg-[#161820] border border-[#2a2d3c] rounded-lg flex flex-col gap-1.5 shadow-lg shrink-0">
                  {/* Top Header Row */}
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <div className="flex items-center gap-2 text-cyan-300 min-w-0">
                      <Film size={13} className="text-cyan-400 animate-pulse shrink-0" />
                      <span className="truncate">{liveItem?.name || currentSlide?.title || 'Video Content'}</span>
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
                        onClick={() => setGroupState(groupId, { isVideoLooping: !(activeControlState?.isVideoLooping ?? true) })}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border transition-colors ${
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
                        setGroupState(groupId, { videoSeekTime: val, videoCurrentTime: val });
                      }}
                      className="flex-1 h-1.5 bg-[#262936] accent-cyan-400 rounded-lg cursor-pointer"
                    />
                    <span className="w-9 shrink-0">{formatVideoTime(activeControlState?.videoDuration || 0)}</span>
                  </div>

                  {/* Button Controls Row */}
                  <div className="flex items-center justify-between gap-1 pt-1 border-t border-[#232634]">
                    <div className="flex items-center gap-1.5">
                      {/* Play / Pause Toggle */}
                      <button
                        onClick={() => setGroupState(groupId, { isVideoPlaying: !(activeControlState?.isVideoPlaying ?? true) })}
                        className={`px-3 py-1 rounded text-[11px] font-bold flex items-center gap-1.5 transition-colors shadow-xs ${
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
                        onClick={() => setGroupState(groupId, { videoSeekTime: 0, videoCurrentTime: 0, isVideoPlaying: true })}
                        className="px-2.5 py-1 rounded bg-[#252834] hover:bg-[#323646] text-gray-200 text-[11px] font-semibold flex items-center gap-1 border border-[#373b4d] transition-colors"
                        title="Restart Video from 0:00"
                      >
                        <RotateCcw size={11} />
                        <span>Restart</span>
                      </button>

                      {/* Loop Toggle Button */}
                      <button
                        onClick={() => setGroupState(groupId, { isVideoLooping: !(activeControlState?.isVideoLooping ?? true) })}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 border transition-colors ${
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
                        onClick={() => setGroupState(groupId, { isVideoMuted: !(activeControlState?.isVideoMuted ?? false) })}
                        className={`p-1.5 rounded transition-colors ${
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
                          setGroupState(groupId, { videoVolume: vol, isVideoMuted: vol === 0 });
                        }}
                        className="w-16 h-1 bg-[#262936] accent-cyan-400 rounded cursor-pointer"
                        title="Video Volume"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* The Live Output Monitor Screen Box */}
              <div className="flex-1 w-full min-h-0 bg-[#08090b] rounded-lg border border-[#222530] overflow-hidden relative flex items-center justify-center shadow-inner">
                <MonitorPreviewCanvas groupId={groupId} showResolutionTag={true} />
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </section>
  );
}
