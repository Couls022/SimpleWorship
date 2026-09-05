import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Settings, 
  ChevronRight, 
  ChevronDown, 
  GripVertical, 
  Trash2, 
  Play, 
  Pause,
  Music, 
  BookOpen, 
  FileText, 
  Film, 
  Image as ImageIcon,
  Volume2,
  VolumeX,
  Layers,
  LayoutGrid,
  Pin,
  Tv,
  Copy,
  Calendar,
  Palette,
  Sparkles,
  Maximize2,
  Grid2x2,
  Grid3x3,
  List,
  ListFilter,
  Edit3,
  Upload
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useWorkspace } from '../context/WorkspaceContext';
import { PresentationItem, Song } from '../types';
import { PresentationCore } from '../core/PresentationCore';
import { PresentationContentResolver, FormatBadgeInfo } from '../core/PresentationContentResolver';
import { readSwsFile } from '../services/swsService';
import { handleRangeSelection } from '../utils/selectionUtils';
import { dbApi } from '../db';
import { isValidPptxBinary } from '../utils/pptxValidator';
import { processDroppedFileList, isMediaOrPresentationFile } from '../utils/fileDropHandler';
import SimpleWorshipLogo from './SimpleWorshipLogo';
import BibleLibraryModule from './workspace/BibleLibraryModule';
import SongsTab from './resources/SongsTab';
import PresentationsTab from './resources/PresentationsTab';
import CamerasTab from './resources/CamerasTab';
import { Camera } from 'lucide-react';

type ScheduleViewMode = 'large' | 'medium' | 'small' | 'summary';

interface SchedulePanelProps {
  onEditSlide?: (item: PresentationItem) => void;
  onOpenNewSong?: () => void;
  onEditSong?: (song: Song) => void;
}

const ScheduleItemThumbnail: React.FC<{
  item: PresentationItem;
  viewMode: 'large' | 'medium' | 'small' | 'summary';
  isItemLive: boolean;
  themesList: any[];
}> = ({ item, viewMode, isItemLive, themesList }) => {
  const badgeInfo = PresentationContentResolver.getFormatBadgeInfo(item);
  const isVideo = badgeInfo.category === 'video';
  const isAudio = badgeInfo.category === 'audio';
  const isImage = badgeInfo.category === 'image';
  const isPptx = badgeInfo.category === 'pptx';
  const isSong = badgeInfo.category === 'song';
  const isBible = badgeInfo.category === 'bible';

  const videoUrl = item.data?.url || (isVideo ? item.customBackgroundUrl : undefined);
  const imageUrl = item.customBackgroundUrl || item.data?.thumbnailUrl || item.data?.url;
  const firstSlide = item.data?.slides?.[0];

  const sizeClass = 
    viewMode === 'large' ? 'w-14 h-10' :
    viewMode === 'small' ? 'w-6 h-5' : 'w-8 h-6';

  if (viewMode === 'summary') {
    return (
      <div className="shrink-0 flex items-center justify-center">
        {isVideo ? <Film size={12} className="text-cyan-400" /> :
         isAudio ? <Music size={12} className="text-purple-400" /> :
         isImage ? <ImageIcon size={12} className="text-emerald-400" /> :
         isPptx ? <FileText size={12} className="text-amber-400" /> :
         isSong ? <Music size={12} className="text-sky-400" /> :
         isBible ? <BookOpen size={12} className="text-rose-400" /> :
         <Layers size={12} className="text-gray-400" />}
      </div>
    );
  }

  return (
    <div className={`rounded-xs bg-[#0b0c10] border border-[#2b2e38] relative overflow-hidden flex items-center justify-center shrink-0 ${sizeClass}`}>
      {isVideo && videoUrl ? (
        <div className="w-full h-full relative bg-slate-950 flex items-center justify-center overflow-hidden">
          <video
            src={videoUrl}
            muted
            playsInline
            preload="metadata"
            className="w-full h-full object-cover pointer-events-none opacity-80"
          />
          <div className="absolute inset-0 bg-black/25 flex items-center justify-center">
            <span className="w-3.5 h-3.5 rounded-full bg-cyan-500/90 text-slate-950 flex items-center justify-center text-[7px] font-bold shadow-xs">
              ▶
            </span>
          </div>
        </div>
      ) : isAudio ? (
        <div className="w-full h-full bg-gradient-to-br from-[#271542] via-[#1b0e30] to-[#120822] flex items-center justify-center relative p-0.5">
          <div className="flex items-end gap-0.5 h-3">
            <span className="w-0.5 h-2 bg-purple-400 rounded-xs animate-pulse" />
            <span className="w-0.5 h-3 bg-purple-300 rounded-xs animate-pulse" style={{ animationDelay: '0.2s' }} />
            <span className="w-0.5 h-1.5 bg-purple-400 rounded-xs animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
          <Music size={viewMode === 'large' ? 12 : 9} className="text-purple-300 absolute top-0.5 right-0.5 opacity-60" />
        </div>
      ) : isImage && imageUrl ? (
        <img
          src={imageUrl}
          alt={item.name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      ) : isPptx ? (
        firstSlide?.backgroundUrl ? (
          <img
            src={firstSlide.backgroundUrl}
            alt={item.name}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        ) : (
          <div 
            className="w-full h-full flex flex-col items-center justify-center p-0.5 text-center"
            style={{ background: firstSlide?.backgroundColor || '#1e293b' }}
          >
            <span className="text-[7px] font-black text-amber-300 font-mono leading-none">PPT</span>
            {viewMode === 'large' && firstSlide?.title && (
              <span className="text-[6px] text-gray-200 line-clamp-1 leading-none mt-0.5">
                {firstSlide.title}
              </span>
            )}
          </div>
        )
      ) : item.customBackgroundUrl ? (
        <img
          src={item.customBackgroundUrl}
          alt={item.name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-[#111216] flex items-center justify-center">
          {isSong ? <Music size={11} className="text-sky-400" /> :
           isBible ? <BookOpen size={11} className="text-rose-400" /> :
           <Layers size={11} className="text-gray-400" />}
        </div>
      )}

      {/* Live Badge dot */}
      {isItemLive && (
        <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_4px_rgba(244,63,94,1)]"></span>
      )}
    </div>
  );
};

export default function SchedulePanel({ onEditSlide, onOpenNewSong, onEditSong }: SchedulePanelProps) {
  const store = useStore();
  const { panels, togglePanelDock } = useWorkspace();
  const isDocked = panels.schedule?.isDocked ?? true;

  const [activeSidebarTab, setActiveSidebarTab] = useState<'schedule' | 'scriptures' | 'songs' | 'presentations' | 'cameras'>('schedule');

  // Schedule View Mode State ('large' | 'medium' | 'small' | 'summary')
  const [viewMode, setViewMode] = useState<ScheduleViewMode>(() => {
    try {
      return (localStorage.getItem('simpleworship_schedule_view_mode') as ScheduleViewMode) || 'medium';
    } catch {
      return 'medium';
    }
  });
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const handleGoLive = (item: PresentationItem, slideIndex: number = 0) => {
    setPreviewItem(item.id, slideIndex);
    setSelectedScheduleItemIds([item.id]);
    setAnchorScheduleItemId(item.id);
    store.setRoutingRequest({ item, isNew: false, slideIndex });
  };

  const viewMenuRef = useRef<HTMLDivElement>(null);

  const handleSelectViewMode = (mode: ScheduleViewMode) => {
    setViewMode(mode);
    setIsViewMenuOpen(false);
    try {
      localStorage.setItem('simpleworship_schedule_view_mode', mode);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setIsViewMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { 
    activeSchedule, 
    previewItemId, 
    previewSlideIndex,
    setPreviewItem, 
    goLiveItem, 
    groupStates, 
    activeControlGroupId, 
    toggleScheduleItemExpand, 
    removeScheduleItem,
    updateScheduleItem,
    reorderSchedule,
    addScheduleItem,
    songsList
  } = store;

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
  const [isDropTargetActive, setIsDropTargetActive] = useState(false);

  // Quick schedule audio preview player
  const [previewingAudioItemId, setPreviewingAudioItemId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const toggleAudioPreview = (itemId: string, audioUrl: string) => {
    if (!audioUrl) return;
    if (previewingAudioItemId === itemId) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setPreviewingAudioItemId(null);
    } else {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;
      audio.play().catch(e => console.warn('Preview play warning:', e));
      audio.onended = () => setPreviewingAudioItemId(null);
      setPreviewingAudioItemId(itemId);
    }
  };

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  // Single and Multi-selection state for Schedule Rundown
  const [selectedScheduleItemIds, setSelectedScheduleItemIds] = useState<string[]>([]);
  const [anchorScheduleItemId, setAnchorScheduleItemId] = useState<string | null>(null);

  // Sync selection with previewItemId if no explicit multi-selection
  useEffect(() => {
    if (previewItemId && selectedScheduleItemIds.length <= 1) {
      setSelectedScheduleItemIds([previewItemId]);
      setAnchorScheduleItemId(previewItemId);
    }
  }, [previewItemId]);

  // Global Keyboard handlers for Schedule Panel (Delete, Ctrl+A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If typing inside an input or textarea, ignore
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      // Ctrl+A / Cmd+A : Select all schedule items
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && activeSchedule?.items.length) {
        e.preventDefault();
        const allIds = activeSchedule.items.map(it => it.id);
        setSelectedScheduleItemIds(allIds);
        return;
      }

      // Delete or Backspace: Remove all selected items
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedScheduleItemIds.length > 0) {
        e.preventDefault();
        selectedScheduleItemIds.forEach(id => removeScheduleItem(id));
        setSelectedScheduleItemIds([]);
        setAnchorScheduleItemId(null);
        window.dispatchEvent(
          new CustomEvent('simpleworship:notify', {
            detail: `Removed ${selectedScheduleItemIds.length} item(s) from schedule`
          })
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSchedule, selectedScheduleItemIds, removeScheduleItem]);

  const handleItemClick = (e: React.MouseEvent, item: PresentationItem) => {
    if (!activeSchedule?.items) return;
    
    const { selectedIds, anchorId } = handleRangeSelection(
      activeSchedule.items,
      selectedScheduleItemIds,
      item.id,
      e,
      anchorScheduleItemId
    );

    setSelectedScheduleItemIds(selectedIds);
    setAnchorScheduleItemId(anchorId);

    // If single item selected, set as preview
    if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
      setPreviewItem(item.id, 0);
    } else if (selectedIds.length === 1) {
      setPreviewItem(selectedIds[0], 0);
    }
  };

  // Right-click context menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: PresentationItem;
    index: number;
  } | null>(null);

  const contextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeControlState = activeControlGroupId && groupStates[activeControlGroupId] 
    ? groupStates[activeControlGroupId] 
    : null;

  // Reorder start
  const handleItemDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', index.toString());
    if (activeSchedule?.items[index]) {
      e.dataTransfer.setData('application/json', JSON.stringify({ source: 'schedule', item: activeSchedule.items[index] }));
    }
    e.dataTransfer.setData('application/x-simpleworship-internal-index', index.toString());
    e.dataTransfer.effectAllowed = 'copyMove';
    setDraggedIdx(index);
  };

  const handleItemDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
    setDropPosition(null);
    setIsDropTargetActive(false);
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDropTargetActive) setIsDropTargetActive(true);
  };

  const handleItemDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const position = relativeY < rect.height / 2 ? 'before' : 'after';
    
    // Only update state if changed to prevent 60fps re-render lag
    if (dragOverIdx !== index) setDragOverIdx(index);
    if (dropPosition !== position) setDropPosition(position);
    if (!isDropTargetActive) setIsDropTargetActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only reset if leaving the outer container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDropTargetActive(false);
    setDragOverIdx(null);
    setDropPosition(null);
  };

  // Drop handler handling both internal reordering & external resource drops
  const handleDrop = async (e: React.DragEvent, targetIndex?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDropTargetActive(false);

    let finalInsertIndex: number = activeSchedule ? activeSchedule.items.length : 0;
    if (typeof targetIndex === 'number') {
      finalInsertIndex = dropPosition === 'after' ? targetIndex + 1 : targetIndex;
    }

    setDragOverIdx(null);
    setDropPosition(null);

    // Check if OS files were dropped (Images, Audio, Video, PPTX, PPT, SWS, JSON)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropResult = await processDroppedFileList(e.dataTransfer.files);
      if (dropResult.schedule) {
        store.setActiveSchedule(dropResult.schedule);
        setDraggedIdx(null);
        return;
      }
      if (dropResult.items && dropResult.items.length > 0) {
        if (activeSchedule) {
          const currentItems = [...activeSchedule.items];
          const clampedPos = Math.max(0, Math.min(finalInsertIndex, currentItems.length));
          currentItems.splice(clampedPos, 0, ...dropResult.items);
          reorderSchedule(currentItems);
        } else {
          for (const it of dropResult.items) {
            addScheduleItem(it);
          }
        }
        setDraggedIdx(null);
        return;
      }
    }

    // Check for theme drop directly onto a schedule item or schedule list
    const themeJson = e.dataTransfer.getData('application/x-simpleworship-theme');
    const customPayload = themeJson || e.dataTransfer.getData('application/x-simpleworship-item') || e.dataTransfer.getData('application/json');
    
    if (customPayload) {
      try {
        const parsed = JSON.parse(customPayload);

        // Special handling if a Theme was dropped directly onto an existing schedule item
        if (parsed && (parsed.type === 'theme' || parsed.theme) && typeof targetIndex === 'number' && activeSchedule) {
          const targetItem = activeSchedule.items[targetIndex];
          if (targetItem && dropPosition === null) {
            const themeStyles = parsed.theme?.styles || parsed.styles;
            const themeName = parsed.theme?.name || parsed.name || 'Theme';

            updateScheduleItem(targetItem.id, {
              themeId: parsed.theme?.id || parsed.id,
              themeOverride: undefined,
              customBackgroundUrl: undefined
            });

            window.dispatchEvent(
              new CustomEvent('simpleworship:notify', { 
                detail: `Applied theme "${themeName}" to "${targetItem.name}"!` 
              })
            );
            setDraggedIdx(null);
            return;
          }
        }

        if (parsed && parsed.item && parsed.source !== 'schedule') {
          const newItem: PresentationItem = {
            id: parsed.item.id || `item-${Date.now()}`,
            type: parsed.item.type,
            contentId: parsed.item.contentId,
            name: parsed.item.name,
            notes: parsed.item.notes,
            themeId: parsed.item.themeId,
            themeOverride: parsed.item.themeOverride,
            customBackgroundUrl: parsed.item.customBackgroundUrl,
            data: parsed.item.data,
            isExpanded: true
          };

          if (newItem.type === 'presentation') {
            if (!isValidPptxBinary(newItem.data?.fileBytes)) {
              newItem.data = { ...(newItem.data || {}), fileBytes: undefined };
            }
          }

          if (activeSchedule) {
            const currentItems = [...activeSchedule.items];
            const clampedPos = Math.max(0, Math.min(finalInsertIndex, currentItems.length));
            currentItems.splice(clampedPos, 0, newItem);
            reorderSchedule(currentItems);
          } else {
            addScheduleItem(newItem);
          }

          window.dispatchEvent(
            new CustomEvent('simpleworship:notify', { 
              detail: `Added "${newItem.name}" to Schedule!` 
            })
          );
          setDraggedIdx(null);
          return;
        }
      } catch (err) {
        console.error('Failed to parse dropped resource JSON', err);
      }
    }

    // 2. Fallback check for plain text drop (e.g. dragged text reference)
    const plainText = e.dataTransfer.getData('text/plain');
    const internalIdxStr = e.dataTransfer.getData('application/x-simpleworship-internal-index');

    // 3. Internal schedule reordering
    if ((internalIdxStr !== '' || draggedIdx !== null) && activeSchedule) {
      const fromIdx = internalIdxStr ? parseInt(internalIdxStr, 10) : (draggedIdx ?? 0);
      if (!isNaN(fromIdx) && fromIdx >= 0 && fromIdx < activeSchedule.items.length) {
        const items = [...activeSchedule.items];
        const [moved] = items.splice(fromIdx, 1);
        let dest = finalInsertIndex;
        if (fromIdx < finalInsertIndex) {
          dest = finalInsertIndex - 1;
        }
        dest = Math.max(0, Math.min(dest, items.length));
        items.splice(dest, 0, moved);
        reorderSchedule(items);
      }
      setDraggedIdx(null);
      return;
    }

    // 4. Plain text dragged into schedule
    if (plainText && !plainText.startsWith('{') && isNaN(Number(plainText))) {
      const noteId = `note-${Date.now()}`;
      const textItem: PresentationItem = {
        id: noteId,
        contentId: noteId,
        type: 'presentation',
        name: plainText.slice(0, 40),
        notes: 'Quick Drop Note',
        data: {
          slides: [{ title: plainText.slice(0, 40), text: plainText }]
        },
        isExpanded: true
      };
      if (activeSchedule) {
        const currentItems = [...activeSchedule.items];
        const clampedPos = Math.max(0, Math.min(finalInsertIndex, currentItems.length));
        currentItems.splice(clampedPos, 0, textItem);
        reorderSchedule(currentItems);
      } else {
        addScheduleItem(textItem);
      }
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { 
          detail: `Added note "${textItem.name}" to Schedule!` 
        })
      );
    }
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'song': return <Music size={12} className="text-cyan-400" />;
      case 'bible': return <BookOpen size={12} className="text-amber-400" />;
      case 'ppt': case 'presentation': return <FileText size={12} className="text-blue-400" />;
      case 'media': case 'video': case 'image': return <Film size={12} className="text-emerald-400" />;
      default: return <Layers size={12} className="text-gray-400" />;
    }
  };

  const handleContextMenu = (e: React.MouseEvent, item: PresentationItem, index: number) => {
    e.preventDefault();
    if (!selectedScheduleItemIds.includes(item.id)) {
      setSelectedScheduleItemIds([item.id]);
      setAnchorScheduleItemId(item.id);
      setPreviewItem(item.id, 0);
    }
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 240),
      item,
      index
    });
  };

  return (
    <aside className="w-full flex flex-col bg-[#1f2127] border-r border-[#15161a] select-none h-full overflow-hidden text-gray-200 relative">
      {/* Sidebar Header & Tab Switcher */}
      <div className="bg-[#282b33] border-b border-[#18191d] flex flex-col shrink-0">
        <div className="h-8 flex items-center justify-between px-2">
          {/* Tabs: Schedule, Scriptures, Songs, Presentations, Cameras - Evenly Divided (Grid 5-col) */}
          <div className="grid grid-cols-5 gap-0.5 bg-[#171920] p-0.5 rounded border border-[#343946] flex-1 min-w-0 mr-1.5 shadow-inner">
            <button
              onClick={() => setActiveSidebarTab('schedule')}
              title={`Schedule (${activeSchedule ? activeSchedule.items.length : 0})`}
              className={`flex items-center justify-center gap-1 px-1 py-1 rounded text-[11px] font-semibold transition-all min-w-0 w-full select-none cursor-pointer ${
                activeSidebarTab === 'schedule'
                  ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#252834]'
              }`}
            >
              <Calendar size={11} className="shrink-0" />
              <span className="truncate hidden xl:inline">Schedule</span>
              {activeSchedule && (
                <span className="text-[9px] bg-[#2a2e3a] px-1 rounded-full text-gray-300 shrink-0 font-mono ml-0.5">
                  {activeSchedule.items.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSidebarTab('scriptures')}
              title="Scriptures"
              className={`flex items-center justify-center gap-1 px-1 py-1 rounded text-[11px] font-semibold transition-all min-w-0 w-full select-none cursor-pointer ${
                activeSidebarTab === 'scriptures'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#252834]'
              }`}
            >
              <BookOpen size={11} className="shrink-0" />
              <span className="truncate hidden xl:inline">Scriptures</span>
            </button>

            <button
              onClick={() => setActiveSidebarTab('songs')}
              title="Songs"
              className={`flex items-center justify-center gap-1 px-1 py-1 rounded text-[11px] font-semibold transition-all min-w-0 w-full select-none cursor-pointer ${
                activeSidebarTab === 'songs'
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#252834]'
              }`}
            >
              <Music size={11} className="shrink-0" />
              <span className="truncate hidden xl:inline">Songs</span>
            </button>

            <button
              onClick={() => setActiveSidebarTab('presentations')}
              title="Presentations"
              className={`flex items-center justify-center gap-1 px-1 py-1 rounded text-[11px] font-semibold transition-all min-w-0 w-full select-none cursor-pointer ${
                activeSidebarTab === 'presentations'
                  ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#252834]'
              }`}
            >
              <FileText size={11} className="shrink-0" />
              <span className="truncate hidden xl:inline">Presentations</span>
            </button>

            <button
              onClick={() => setActiveSidebarTab('cameras')}
              title="Cameras"
              className={`flex items-center justify-center gap-1 px-1 py-1 rounded text-[11px] font-semibold transition-all min-w-0 w-full select-none cursor-pointer ${
                activeSidebarTab === 'cameras'
                  ? 'bg-pink-600/30 text-pink-300 border border-pink-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#252834]'
              }`}
            >
              <Camera size={11} className="shrink-0" />
              <span className="truncate hidden xl:inline">Cameras</span>
            </button>
          </div>

          <div className="flex items-center space-x-1">
            {/* View Mode Dropdown Button */}
            {activeSidebarTab === 'schedule' && (
              <div className="relative" ref={viewMenuRef}>
                <button
                  onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
                  className={`p-1 rounded hover:bg-[#383d47] transition-colors text-[10px] ${
                    isViewMenuOpen 
                      ? 'text-cyan-400 bg-[#323744]' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Schedule View Options"
                >
                  <ListFilter size={12} />
                </button>

                {/* Popup Dropdown Menu */}
                {isViewMenuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-44 bg-[#232630] border border-[#3b4152] rounded-md shadow-2xl py-1 text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-100">
                    <button
                      onClick={() => handleSelectViewMode('large')}
                      className={`w-full px-3 py-1.5 text-left hover:bg-[#323847] flex items-center gap-2.5 transition-colors ${
                        viewMode === 'large' ? 'bg-[#2c3241] text-cyan-300 font-bold' : 'text-gray-200'
                      }`}
                    >
                      <Maximize2 size={13} className="text-gray-300 shrink-0" />
                      <span>Large Icons</span>
                    </button>

                    <button
                      onClick={() => handleSelectViewMode('medium')}
                      className={`w-full px-3 py-1.5 text-left hover:bg-[#323847] flex items-center gap-2.5 transition-colors ${
                        viewMode === 'medium' ? 'bg-[#2c3241] text-cyan-300 font-bold' : 'text-gray-200'
                      }`}
                    >
                      <Grid2x2 size={13} className="text-gray-300 shrink-0" />
                      <span>Medium Icons</span>
                    </button>

                    <button
                      onClick={() => handleSelectViewMode('small')}
                      className={`w-full px-3 py-1.5 text-left hover:bg-[#323847] flex items-center gap-2.5 transition-colors ${
                        viewMode === 'small' ? 'bg-[#2c3241] text-cyan-300 font-bold' : 'text-gray-200'
                      }`}
                    >
                      <Grid3x3 size={13} className="text-gray-300 shrink-0" />
                      <span>Small Icons</span>
                    </button>

                    <div className="border-t border-[#343a4a] my-1"></div>

                    <button
                      onClick={() => handleSelectViewMode('summary')}
                      className={`w-full px-3 py-1.5 text-left hover:bg-[#323847] flex items-center gap-2.5 transition-colors ${
                        viewMode === 'summary' ? 'bg-[#2c3241] text-cyan-300 font-bold' : 'text-gray-200'
                      }`}
                    >
                      <List size={13} className="text-gray-300 shrink-0" />
                      <span>Summary View</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Dock / Undock toggle */}
            <button
              onClick={() => togglePanelDock('schedule')}
              className={`p-1 rounded hover:bg-[#383d47] transition-colors text-[10px] ${
                !isDocked ? 'text-cyan-400 bg-[#323744]' : 'text-gray-400 hover:text-white'
              }`}
              title={isDocked ? 'Float Schedule Panel' : 'Dock Schedule Panel'}
            >
              <Pin size={12} className={isDocked ? '' : 'rotate-45'} />
            </button>

            {/* Schedule Settings dropdown */}
            {activeSidebarTab === 'schedule' && (
              <button
                onClick={() => {
                  const name = prompt('Rename schedule:', activeSchedule?.name || 'Sunday Morning Worship');
                  if (name && activeSchedule) {
                    store.setActiveSchedule({ ...activeSchedule, name });
                  }
                }}
                className="flex items-center gap-0.5 px-1.5 py-0.5 hover:bg-[#383d47] rounded text-gray-300 hover:text-white transition-colors text-[10px]"
                title="Schedule Options"
              >
                <Settings size={13} />
                <ChevronDown size={10} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeSidebarTab === 'scriptures' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <BibleLibraryModule isSidebarMode={true} />
        </div>
      ) : activeSidebarTab === 'songs' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <SongsTab 
            onOpenNewSong={onOpenNewSong || (() => {})} 
            onEditSong={onEditSong || (() => {})} 
          />
        </div>
      ) : activeSidebarTab === 'presentations' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <PresentationsTab />
        </div>
      ) : activeSidebarTab === 'cameras' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <CamerasTab />
        </div>
      ) : (
        /* Schedule Items Tree / Drop Area */
        <div 
          onDragOver={handleContainerDragOver}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e)}
          className={`flex-1 overflow-y-auto p-1 space-y-1.5 custom-scrollbar transition-all relative ${
            isDropTargetActive ? 'bg-[#1b2230] ring-2 ring-cyan-500/40 ring-inset' : ''
          }`}
        >
        {/* Active Drop Indicator Overlay Header when dragging over panel */}
        {isDropTargetActive && (
          <div className="sticky top-0 z-30 bg-cyan-950/90 border border-cyan-500/60 text-cyan-200 px-2 py-1 rounded text-[11px] font-bold flex items-center justify-between shadow-lg backdrop-blur-xs animate-pulse">
            <div className="flex items-center gap-1.5">
              <Plus size={12} className="text-cyan-400" />
              <span>Drop to insert into Service Schedule</span>
            </div>
            <span className="text-[9px] bg-cyan-900 px-1.5 py-0.5 rounded text-cyan-100 font-mono">
              {dropPosition === 'after' && typeof dragOverIdx === 'number'
                ? `Position ${dragOverIdx + 2}`
                : typeof dragOverIdx === 'number'
                ? `Position ${dragOverIdx + 1}`
                : 'At bottom'}
            </span>
          </div>
        )}

        {(!activeSchedule || activeSchedule.items.length === 0) && (
          <div 
            onDragOver={handleContainerDragOver}
            onDrop={(e) => handleDrop(e, 0)}
            className={`p-6 text-center text-gray-500 text-xs flex flex-col items-center justify-center space-y-2.5 h-56 border-2 border-dashed rounded-lg m-1 transition-all ${
              isDropTargetActive ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200' : 'border-[#2d313d] bg-[#171920]/60'
            }`}
          >
            <div className="relative">
              <SimpleWorshipLogo size={36} showText={false} variant="icon" />
            </div>
            <div>
              <p className="font-bold text-gray-300 text-xs">Schedule is empty</p>
              <p className="text-[11px] text-gray-400 mt-0.5 max-w-[220px] leading-tight">
                Drag & drop Songs, Scriptures, Media, or <span className="text-cyan-400 font-semibold font-mono">.sws</span> schedule packages here
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-cyan-400/80 bg-cyan-950/60 px-2.5 py-1 rounded border border-cyan-800/40">
              <Sparkles size={11} />
              <span>SimpleWorship Enterprise Format</span>
            </div>
          </div>
        )}

        {activeSchedule?.items.map((item, index) => {
          const isSelected = selectedScheduleItemIds.includes(item.id);
          const isItemInPreview = previewItemId === item.id;
          const isItemLive = activeControlState?.activeItemId === item.id;
          const slides = PresentationCore.generateSlides(item, songsList, store.systemOptions);
          const isDragOverThis = dragOverIdx === index;
          const isBeingDragged = draggedIdx === index;

          return (
            <div key={item.id} className="relative">
              {/* Insertion line indicator above item */}
              {isDragOverThis && dropPosition === 'before' && (
                <div className="h-1 bg-gradient-to-r from-cyan-500 via-indigo-400 to-cyan-500 rounded-full mb-1 shadow-md shadow-cyan-500/50 flex items-center justify-center">
                  <span className="bg-cyan-500 text-gray-950 font-bold text-[8px] px-1 rounded-full uppercase tracking-tighter">
                    Insert Here
                  </span>
                </div>
              )}

              <div
                draggable
                onDragStart={(e) => handleItemDragStart(e, index)}
                onDragEnd={handleItemDragEnd}
                onDragOver={(e) => handleItemDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onContextMenu={(e) => handleContextMenu(e, item, index)}
                className={`rounded-sm border transition-all text-xs overflow-hidden cursor-grab active:cursor-grabbing ${
                  isBeingDragged ? 'opacity-40 border-dashed border-gray-500' : ''
                } ${
                  isSelected
                    ? 'border-cyan-400 bg-cyan-950/40 shadow-sm ring-1 ring-cyan-400/60'
                    : isItemLive
                    ? 'border-rose-900/50 bg-[#21232b] border-l-2 border-l-rose-500'
                    : 'border-[#2d3039] bg-[#23252c] hover:border-[#3e4350]'
                }`}
              >
                {/* Item Header Row */}
                <div 
                  className={`flex items-center gap-2 cursor-pointer select-none group ${
                    viewMode === 'large' 
                      ? 'p-2.5' 
                      : viewMode === 'small' || viewMode === 'summary' 
                      ? 'p-1' 
                      : 'p-1.5'
                  }`}
                  onClick={(e) => handleItemClick(e, item)}
                  onDoubleClick={() => handleGoLive(item, 0)}
                >
                  {/* Drag Grip Handle */}
                  <div className="text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing">
                    <GripVertical size={13} />
                  </div>

                  {/* Expand/Collapse Chevron */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleScheduleItemExpand(item.id);
                    }}
                    className="p-0.5 text-gray-400 hover:text-white rounded"
                  >
                    {item.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  {/* Left Thumbnail / Icon Box based on viewMode */}
                  {(() => {
                    const badgeInfo = PresentationContentResolver.getFormatBadgeInfo(item);
                    return (
                      <>
                        <ScheduleItemThumbnail
                          item={item}
                          viewMode={viewMode}
                          isItemLive={isItemLive}
                          themesList={store.themesList}
                        />

                        {/* Title & Subtitle */}
                        <div className="flex-1 min-w-0 pr-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0 truncate">
                              <span className={`truncate ${
                                viewMode === 'large' 
                                  ? 'text-xs font-bold' 
                                  : viewMode === 'small' 
                                  ? 'text-[10px] font-semibold' 
                                  : 'text-[11px] font-semibold'
                              } ${
                                isSelected 
                                  ? 'text-cyan-200 font-bold' 
                                  : isItemLive 
                                  ? 'text-rose-200 font-semibold' 
                                  : 'text-gray-200'
                              }`}>
                                {item.name}
                              </span>
                              {/* Format Badge */}
                              <span className={`px-1.5 py-0.2 rounded text-[8px] font-mono font-extrabold uppercase tracking-wider border shadow-2xs shrink-0 ${badgeInfo.badgeColorClass}`}>
                                {badgeInfo.badgeLabel}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {isItemLive && (
                                <span className="flex items-center gap-1 bg-rose-950/90 text-rose-300 border border-rose-600/60 text-[9px] font-black px-1.5 py-0.2 rounded shadow-2xs uppercase">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                  Live
                                </span>
                              )}
                              {(item.themeOverride || item.themeId) && (
                                <span 
                                  className="px-1 py-0.2 rounded text-[8px] font-semibold bg-indigo-950/80 text-indigo-300 border border-indigo-500/40 flex items-center gap-0.5 shrink-0 shadow-2xs" 
                                  title="Custom Theme Applied"
                                >
                                  <Palette size={8} className="text-indigo-400" />
                                  <span>Theme</span>
                                </span>
                              )}
                            </div>
                          </div>
                          {viewMode !== 'summary' && (
                            <div className="text-[10px] text-gray-400 truncate italic">
                              {item.notes || badgeInfo.subLabel}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}

                {/* Quick Action: Edit Slide */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEditSlide) {
                      onEditSlide(item);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-cyan-900/80 rounded text-cyan-400 hover:text-cyan-200 transition-all"
                  title="Edit Slide (SimpleWorship Editor)"
                >
                  <Edit3 size={11} />
                </button>

                {/* Quick Action: Go Live */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGoLive(item, 0);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-emerald-600 rounded text-emerald-400 hover:text-white transition-all"
                  title="Go Live"
                >
                  <Play size={11} className="fill-current" />
                </button>

                {/* Remove */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeScheduleItem(item.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-900/80 rounded text-gray-400 hover:text-rose-300 transition-all"
                  title="Remove from Schedule"
                >
                  <Trash2 size={11} />
                </button>
              </div>

              {/* Sub-Slides / Expanded Format View */}
              {item.isExpanded && (() => {
                const badgeInfo = PresentationContentResolver.getFormatBadgeInfo(item);
                const isVideo = badgeInfo.category === 'video';
                const isAudio = badgeInfo.category === 'audio';
                const isImage = badgeInfo.category === 'image';
                const isPptx = badgeInfo.category === 'pptx';

                // 1. VIDEO PREVIEW BAR
                if (isVideo) {
                  const vUrl = item.data?.url || item.customBackgroundUrl;
                  return (
                    <div className="border-t border-[#1a1b20] bg-[#12141a] p-2 flex items-center gap-3">
                      <div className="w-24 h-14 rounded bg-black relative overflow-hidden shrink-0 border border-cyan-800/40 flex items-center justify-center">
                        {vUrl ? (
                          <video
                            src={vUrl}
                            muted
                            playsInline
                            className="w-full h-full object-cover pointer-events-none opacity-90"
                          />
                        ) : (
                          <Film size={20} className="text-cyan-400" />
                        )}
                        <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded text-[7px] font-mono font-bold bg-black/80 text-cyan-300">
                          {badgeInfo.badgeLabel}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-gray-200 truncate">
                          {item.name}
                        </div>
                        <div className="text-[9px] text-gray-400 truncate mt-0.5">
                          {item.data?.sourceFileName || `${badgeInfo.badgeLabel} Video Asset`}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => handleGoLive(item, 0)}
                            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs transition-colors"
                          >
                            <Play size={10} className="fill-current" />
                            <span>Go Live</span>
                          </button>
                          <button
                            onClick={() => setPreviewItem(item.id, 0)}
                            className="px-2 py-0.5 rounded bg-[#252834] hover:bg-[#323646] text-gray-200 text-[10px] font-medium transition-colors"
                          >
                            Preview
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                // 2. AUDIO AUDITIONING BAR
                if (isAudio) {
                  const aUrl = item.data?.url;
                  const isAuditioning = previewingAudioItemId === item.id;
                  return (
                    <div className="border-t border-purple-900/30 bg-[#161222] p-2.5 flex items-center gap-3">
                      <button
                        onClick={() => toggleAudioPreview(item.id, aUrl || '')}
                        disabled={!aUrl}
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-md transition-all active:scale-95 cursor-pointer ${
                          isAuditioning 
                            ? 'bg-purple-500 text-white ring-2 ring-purple-300' 
                            : 'bg-purple-700 hover:bg-purple-600 text-white'
                        }`}
                        title={isAuditioning ? 'Pause Audition' : 'Play Audition'}
                      >
                        {isAuditioning ? <Pause size={14} /> : <Play size={14} className="fill-current ml-0.5" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-600/50 uppercase">
                            {badgeInfo.badgeLabel}
                          </span>
                          <span className="text-[11px] font-semibold text-gray-200 truncate">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[9px] text-purple-300/70 font-mono">
                          {isAuditioning ? (
                            <span className="flex items-center gap-1 text-purple-300 font-semibold animate-pulse">
                              <Volume2 size={10} /> Auditioning Audio...
                            </span>
                          ) : (
                            <span>Click play to audition track</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => handleGoLive(item, 0)}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs transition-colors shrink-0"
                      >
                        <Play size={10} className="fill-current" />
                        <span>Go Live</span>
                      </button>
                    </div>
                  );
                }

                // 3. IMAGE PREVIEW BAR
                if (isImage) {
                  const imgUrl = item.customBackgroundUrl || item.data?.thumbnailUrl || item.data?.url;
                  return (
                    <div className="border-t border-emerald-900/30 bg-[#111815] p-2 flex items-center gap-3">
                      <div className="w-24 h-14 rounded bg-black relative overflow-hidden shrink-0 border border-emerald-800/40 flex items-center justify-center">
                        {imgUrl ? (
                          <img
                            src={imgUrl}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <ImageIcon size={20} className="text-emerald-400" />
                        )}
                        <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded text-[7px] font-mono font-bold bg-black/80 text-emerald-300">
                          {badgeInfo.badgeLabel}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-gray-200 truncate">
                          {item.name}
                        </div>
                        <div className="text-[9px] text-gray-400 truncate mt-0.5">
                          {item.data?.sourceFileName || `${badgeInfo.badgeLabel} Graphic`}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            onClick={() => handleGoLive(item, 0)}
                            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs transition-colors"
                          >
                            <Play size={10} className="fill-current" />
                            <span>Go Live</span>
                          </button>
                          <button
                            onClick={() => setPreviewItem(item.id, 0)}
                            className="px-2 py-0.5 rounded bg-[#252834] hover:bg-[#323646] text-gray-200 text-[10px] font-medium transition-colors"
                          >
                            Preview
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                // 4. PRESENTATION / PPT / PPTX or MULTI-SLIDE LIST
                if (slides.length > 0) {
                  return (
                    <div className="border-t border-[#1a1b20] bg-[#17181d] divide-y divide-[#1f2128]">
                      {slides.map((slide, slideIdx) => {
                        const isSlideLive = isItemLive && activeControlState?.activeSlideIndex === slideIdx;
                        const isSlidePreview = isItemInPreview && previewSlideIndex === slideIdx;

                        return (
                          <div
                            key={slide.id || slideIdx}
                            onClick={() => setPreviewItem(item.id, slideIdx)}
                            onDoubleClick={() => handleGoLive(item, slideIdx)}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              e.currentTarget.classList.add('bg-cyan-900/40', 'border-y', 'border-cyan-500/50');
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.classList.remove('bg-cyan-900/40', 'border-y', 'border-cyan-500/50');
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              e.currentTarget.classList.remove('bg-cyan-900/40', 'border-y', 'border-cyan-500/50');
                              const assetJson = e.dataTransfer.getData('application/x-simpleworship-asset-bg');
                              if (assetJson) {
                                try {
                                  const asset = JSON.parse(assetJson);
                                  const slideBackgrounds = item.data?.slideBackgrounds || {};
                                  slideBackgrounds[slideIdx] = asset.url;
                                  
                                  const slideMediaData = item.data?.slideMedia || {};
                                  slideMediaData[slideIdx] = { url: asset.url, isVideo: asset.type === 'video' || asset.type === 'motion' };

                                  updateScheduleItem(item.id, {
                                    data: {
                                      ...item.data,
                                      slideBackgrounds,
                                      slideMedia: slideMediaData
                                    }
                                  });
                                  window.dispatchEvent(
                                    new CustomEvent('simpleworship:notify', { 
                                      detail: `Applied custom media to slide ${slideIdx + 1} of "${item.name}"!` 
                                    })
                                  );
                                } catch (err) {}
                              }
                            }}
                            className={`flex items-start gap-2.5 px-3 py-1.5 cursor-pointer transition-colors border-y border-transparent ${
                              isSlideLive
                                ? 'bg-blue-600/30 text-white font-medium shadow-sm'
                                : isSlidePreview
                                ? 'bg-cyan-950/40 text-cyan-200'
                                : 'hover:bg-[#23262e] text-gray-300'
                            }`}
                          >
                            {/* Slide Number / Thumbnail */}
                            {isPptx ? (
                              <div className="w-10 h-7 rounded-xs bg-black border border-[#30333d] relative overflow-hidden flex items-center justify-center shrink-0">
                                {slide.backgroundUrl ? (
                                  <img
                                    src={slide.backgroundUrl}
                                    alt={`Slide ${slideIdx + 1}`}
                                    referrerPolicy="no-referrer"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div
                                    className="w-full h-full flex items-center justify-center text-[8px] font-mono font-bold text-amber-300"
                                    style={{ background: slide.backgroundColor || '#1e293b' }}
                                  >
                                    {slideIdx + 1}
                                  </div>
                                )}
                                <span className={`absolute bottom-0 right-0 px-1 py-0.2 rounded-tl text-[7px] font-mono font-bold ${
                                  isSlideLive ? 'bg-blue-600 text-white' : 'bg-black/80 text-gray-300'
                                }`}>
                                  {slideIdx + 1}
                                </span>
                              </div>
                            ) : (
                              <span className={`w-4 h-4 rounded text-[10px] flex items-center justify-center font-bold font-mono shrink-0 mt-0.5 ${
                                isSlideLive ? 'bg-blue-500 text-white' : 'bg-[#2b2e37] text-gray-400'
                              }`}>
                                {slideIdx + 1}
                              </span>
                            )}

                            <div className="flex-1 min-w-0">
                              {slide.title && (
                                <div className="text-[10px] font-bold text-indigo-300 truncate mb-0.5">
                                  {slide.title}
                                </div>
                              )}
                              <p className="text-[10px] leading-tight line-clamp-2 text-gray-300 whitespace-pre-line font-sans">
                                {slide.text}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                return null;
              })()}
            </div>

            {/* Insertion line indicator below item */}
            {isDragOverThis && dropPosition === 'after' && (
              <div className="h-1 bg-gradient-to-r from-cyan-500 via-indigo-400 to-cyan-500 rounded-full mt-1 shadow-md shadow-cyan-500/50 flex items-center justify-center">
                <span className="bg-cyan-500 text-gray-950 font-bold text-[8px] px-1 rounded-full uppercase tracking-tighter">
                  Insert Here
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
    )}

      {/* Right-Click Context Menu for Schedule items */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-[#1c1f28] border border-[#373c4d] rounded-md shadow-2xl py-1 w-52 text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
        >
          <div className="px-3 py-1 font-bold text-cyan-300 border-b border-[#2a2e3d] text-[11px] truncate">
            {contextMenu.item.name}
          </div>

          <button
            onClick={() => {
              handleGoLive(contextMenu.item, 0);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-emerald-600 hover:text-white flex items-center gap-2"
          >
            <Play size={12} className="text-emerald-400 fill-emerald-400" />
            <span>Go Live</span>
          </button>

          <button
            onClick={() => {
              if (onEditSlide) {
                onEditSlide(contextMenu.item);
              } else {
                setPreviewItem(contextMenu.item.id, 0);
              }
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2"
          >
            <Tv size={12} className="text-cyan-400" />
            <span>Edit Slide</span>
          </button>

          <button
            onClick={() => {
              toggleScheduleItemExpand(contextMenu.item.id);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2"
          >
            <Layers size={12} className="text-amber-400" />
            <span>{contextMenu.item.isExpanded ? 'Collapse Slides' : 'Expand Slides'}</span>
          </button>

          {(contextMenu.item.themeOverride || contextMenu.item.themeId) && (
            <button
              onClick={() => {
                updateScheduleItem(contextMenu.item.id, {
                  themeId: undefined,
                  themeOverride: undefined,
                  customBackgroundUrl: undefined
                });
                setContextMenu(null);
                window.dispatchEvent(
                  new CustomEvent('simpleworship:notify', { 
                    detail: `Cleared custom theme from "${contextMenu.item.name}"` 
                  })
                );
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2 text-indigo-300"
            >
              <Palette size={12} className="text-indigo-400" />
              <span>Reset to Default Theme</span>
            </button>
          )}

          <div className="border-t border-[#2a2e3d] my-1"></div>

          <button
            onClick={() => {
              if (activeSchedule) {
                const dupItem: PresentationItem = {
                  ...contextMenu.item,
                  id: `sched-item-${Date.now()}`,
                  name: `${contextMenu.item.name} (Copy)`
                };
                const newItems = [...activeSchedule.items];
                newItems.splice(contextMenu.index + 1, 0, dupItem);
                reorderSchedule(newItems);
              }
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2"
          >
            <Copy size={12} className="text-gray-400" />
            <span>Duplicate in Schedule</span>
          </button>

          <button
            onClick={() => {
              if (selectedScheduleItemIds.length > 1) {
                selectedScheduleItemIds.forEach(id => removeScheduleItem(id));
                setSelectedScheduleItemIds([]);
                setAnchorScheduleItemId(null);
                window.dispatchEvent(
                  new CustomEvent('simpleworship:notify', { 
                    detail: `Removed ${selectedScheduleItemIds.length} items from Schedule` 
                  })
                );
              } else {
                removeScheduleItem(contextMenu.item.id);
                setSelectedScheduleItemIds([]);
                setAnchorScheduleItemId(null);
              }
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-rose-600 hover:text-white flex items-center gap-2 text-rose-300"
          >
            <Trash2 size={12} />
            <span>
              {selectedScheduleItemIds.length > 1
                ? `Remove (${selectedScheduleItemIds.length}) Items from Schedule`
                : 'Remove from Schedule'}
            </span>
          </button>
        </div>
      )}
    </aside>
  );
}
