import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { Film, ImageIcon, Music, Search, LayoutGrid, List, Sparkles, Plus, Play, CheckSquare, X, Check, Lock, Unlock } from 'lucide-react';
import { Asset, PresentationItem } from '../../types';
import { isMediaLibraryAsset, isDefaultBackgroundFor, getActiveDefaultBadges, DefaultMediaScope } from '../../db/assets';
import { handleRangeSelection } from '../../utils/selectionUtils';
import { PresentationContentResolver } from '../../core/PresentationContentResolver';
import { LazyVideoThumbnail } from '../common/LazyVideoThumbnail';

export default function MediaLibraryPanel() {
  const assetsList = useStore(state => state.assetsList);
  const setDefaultBackground = useStore(state => state.setDefaultBackground);
  const addScheduleItem = useStore(state => state.addScheduleItem);
  const setPreviewItem = useStore(state => state.setPreviewItem);
  const goLiveItem = useStore(state => state.goLiveItem);
  const activeControlGroupId = useStore(state => state.activeControlGroupId);
  const themesList = useStore(state => state.themesList);
  const systemOptions = useStore(state => state.systemOptions);

  const [search, setSearch] = useState('');
  const [activeMediaFilter, setActiveMediaFilter] = useState<'all' | 'image' | 'video' | 'audio'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; asset: Asset } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAssetClick = (e: React.MouseEvent, asset: Asset) => {
    const result = handleRangeSelection(
      filtered,
      selectedIds,
      asset.id,
      e,
      anchorId
    );
    setSelectedIds(result.selectedIds);
    setAnchorId(result.anchorId);
  };

  const handleContextMenu = (e: React.MouseEvent, asset: Asset) => {
    e.preventDefault();
    if (!selectedIds.includes(asset.id)) {
      setSelectedIds([asset.id]);
      setAnchorId(asset.id);
    }
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 240),
      y: Math.min(e.clientY, window.innerHeight - 360),
      asset,
    });
  };

  const handleLockDefaultBg = (asset: Asset, scope: DefaultMediaScope) => {
    const isVideo = PresentationContentResolver.isAssetVideo(asset, asset.url, asset.name);
    setDefaultBackground(asset.url, scope, isVideo, 'lock');
    const label = scope.charAt(0).toUpperCase() + scope.slice(1);
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Locked "${asset.name}" as Default Background for ${label}!` }));
  };

  const handleUnlockDefaultBg = (asset: Asset, scope: DefaultMediaScope) => {
    setDefaultBackground(asset.url, scope, false, 'unlock');
    const label = scope.charAt(0).toUpperCase() + scope.slice(1);
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Unlocked Default Background for ${label}.` }));
  };

  const handleAddToSchedule = (asset: Asset) => {
    addScheduleItem({
      type: (asset.type === 'video' || asset.type === 'motion') ? 'video' : (asset.type === 'audio' ? 'audio' : 'image'),
      name: asset.name,
      contentId: asset.id,
      customBackgroundUrl: asset.url,
      data: {
        url: asset.url,
        type: asset.type,
        isVideo: asset.type === 'video' || asset.type === 'motion',
        isAudio: asset.type === 'audio',
      },
    });
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Added "${asset.name}" to Schedule!` }));
  };

  const handleSendToLive = (asset: Asset) => {
    const itemId = `media-${Date.now()}`;
    const item: PresentationItem = {
      id: itemId,
      type: (asset.type === 'video' || asset.type === 'motion') ? 'video' : (asset.type === 'audio' ? 'audio' : 'image'),
      name: asset.name,
      contentId: asset.id,
      customBackgroundUrl: asset.type === 'image' ? asset.url : undefined,
      data: {
        url: asset.url,
        type: asset.type,
        isVideo: asset.type === 'video' || asset.type === 'motion',
        isAudio: asset.type === 'audio',
      },
    };
    setPreviewItem(item.id, 0);
    goLiveItem(item.id, 0, activeControlGroupId || undefined, item);
  };

  const handleSendMultipleToLive = (assets: Asset[]) => {
    if (assets.length === 0) return;
    if (assets.length === 1) {
      handleSendToLive(assets[0]);
      return;
    }

    // Build multi-image slideshow presentation item
    const slideshowItem: PresentationItem = {
      id: `slideshow-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: 'presentation',
      name: `Image Slideshow (${assets.length} images)`,
      notes: `${assets.length} photos`,
      contentId: assets[0].id,
      customBackgroundUrl: assets[0].url,
      data: {
        format: 'ImageSlideshow',
        slides: assets.map((a, idx) => ({
          id: `img-slide-${idx}-${a.id}`,
          title: a.name,
          text: '',
          backgroundUrl: a.url,
          isVideo: a.type === 'video' || a.type === 'motion',
          assetId: a.id
        }))
      },
      isExpanded: true
    };

    setPreviewItem(slideshowItem.id, 0);
    goLiveItem(slideshowItem.id, 0, activeControlGroupId || undefined, slideshowItem);
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { 
      detail: `Sent ${assets.length} images as slideshow directly to Active Live Output!` 
    }));
  };

  const handleAddMultipleToSchedule = (assets: Asset[]) => {
    if (assets.length === 0) return;
    assets.forEach(asset => {
      addScheduleItem({
        type: (asset.type === 'video' || asset.type === 'motion') ? 'video' : (asset.type === 'audio' ? 'audio' : 'image'),
        name: asset.name,
        contentId: asset.id,
        customBackgroundUrl: asset.type === 'image' ? asset.url : undefined,
        data: {
          url: asset.url,
          type: asset.type,
          isVideo: asset.type === 'video' || asset.type === 'motion',
          isAudio: asset.type === 'audio',
        },
      });
    });
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { 
      detail: `Added ${assets.length} media items to Schedule!` 
    }));
  };
  
  const isDefaultBgFor = (asset: Asset | null | undefined, scope: DefaultMediaScope) => {
    return isDefaultBackgroundFor(asset, scope, mediaAssets);
  };

  const mediaAssets = assetsList.filter(a => isMediaLibraryAsset(a) && ['image', 'video', 'motion', 'audio'].includes(a.type));
  
  const filtered = mediaAssets.filter(a => {
    if (activeMediaFilter === 'image' && a.type !== 'image') return false;
    if (activeMediaFilter === 'video' && a.type !== 'video' && a.type !== 'motion') return false;
    if (activeMediaFilter === 'audio' && a.type !== 'audio') return false;
    return a.name.toLowerCase().includes(search.toLowerCase()) || 
      (a.tags && a.tags.some(t => t.toLowerCase().includes(search.toLowerCase())));
  });

  const selectedAssets = filtered.filter(a => selectedIds.includes(a.id));

  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
    // Used for dropping onto a SPECIFIC slide to set its background
    e.dataTransfer.setData('application/x-simpleworship-asset-bg', JSON.stringify(asset));
    
    // If multiple items are selected and dragged item is in the selection, bundle all selected items
    const isMultiDrag = selectedIds.includes(asset.id) && selectedAssets.length > 1;
    const targetAssets = isMultiDrag ? selectedAssets : [asset];

    const itemsPayload = targetAssets.map(a => ({
      id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      type: (a.type === 'video' || a.type === 'motion') ? 'video' : (a.type === 'audio' ? 'audio' : 'image'),
      contentId: a.id,
      name: a.name,
      customBackgroundUrl: a.type === 'image' ? a.url : undefined,
      data: {
        url: a.url,
        type: a.type,
        isVideo: a.type === 'video' || a.type === 'motion',
        isAudio: a.type === 'audio',
      }
    }));

    const payload = isMultiDrag ? { type: 'media', items: itemsPayload } : { type: 'media', item: itemsPayload[0] };
    const jsonStr = JSON.stringify(payload);
    e.dataTransfer.setData('application/x-simpleworship-item', jsonStr);
    e.dataTransfer.setData('application/json', jsonStr);
  };

  return (
    <div className="flex flex-col h-full bg-[#1c1e24] text-gray-200">
      <div className="p-2 border-b border-[#2d3039] flex flex-col gap-1.5 shrink-0">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search media..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#111216] border border-[#2d3039] rounded px-6 py-1 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div className="flex border border-[#2d3039] rounded overflow-hidden">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1 ${viewMode === 'grid' ? 'bg-emerald-600/30 text-emerald-400' : 'bg-[#111216] text-gray-400 hover:text-white'}`}
            >
              <LayoutGrid size={12} />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1 border-l border-[#2d3039] ${viewMode === 'list' ? 'bg-emerald-600/30 text-emerald-400' : 'bg-[#111216] text-gray-400 hover:text-white'}`}
            >
              <List size={12} />
            </button>
          </div>
        </div>

        {/* Media Type Filter Tabs */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveMediaFilter('all')}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-colors ${
              activeMediaFilter === 'all' ? 'bg-emerald-600 text-white' : 'bg-[#12141a] text-gray-400 hover:text-white hover:bg-[#202430]'
            }`}
          >
            All ({mediaAssets.length})
          </button>
          <button
            onClick={() => setActiveMediaFilter('image')}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
              activeMediaFilter === 'image' ? 'bg-amber-600 text-white' : 'bg-[#12141a] text-gray-400 hover:text-white hover:bg-[#202430]'
            }`}
          >
            <ImageIcon size={10} />
            <span>Images</span>
          </button>
          <button
            onClick={() => setActiveMediaFilter('video')}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
              activeMediaFilter === 'video' ? 'bg-cyan-600 text-white' : 'bg-[#12141a] text-gray-400 hover:text-white hover:bg-[#202430]'
            }`}
          >
            <Film size={10} />
            <span>Videos</span>
          </button>
          <button
            onClick={() => setActiveMediaFilter('audio')}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
              activeMediaFilter === 'audio' ? 'bg-purple-600 text-white' : 'bg-[#12141a] text-gray-400 hover:text-white hover:bg-[#202430]'
            }`}
          >
            <Music size={10} />
            <span>Audio</span>
          </button>
        </div>
      </div>

      {/* Multi-selection Action Bar */}
      {selectedIds.length > 1 && (
        <div className="px-3 py-1.5 bg-indigo-950/80 border-b border-indigo-500/40 flex items-center justify-between text-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="font-bold text-indigo-300 flex items-center gap-1">
              <CheckSquare size={13} className="text-cyan-400" />
              {selectedIds.length} media selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleSendMultipleToLive(selectedAssets)}
              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded flex items-center gap-1 shadow-xs text-[11px]"
              title="Send all selected images as a slideshow live"
            >
              <Play size={11} className="fill-white" />
              <span>Go Live (Slideshow)</span>
            </button>
            <button
              onClick={() => handleAddMultipleToSchedule(selectedAssets)}
              className="px-2 py-0.5 bg-[#252a38] hover:bg-[#32394d] text-cyan-300 font-medium rounded flex items-center gap-1 border border-[#3d455c] text-[11px]"
            >
              <Plus size={11} />
              <span>Add All to Schedule</span>
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"
              title="Clear Selection"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto min-h-0 p-2">
        <div className="text-[10px] text-gray-400 mb-2 italic px-1 flex items-center justify-between">
          <span>Click to select, Shift/Ctrl to multi-select. Double-click to Go Live.</span>
        </div>
        
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filtered.map(asset => {
              const isSelected = selectedIds.includes(asset.id);
              const badges = getActiveDefaultBadges(asset, mediaAssets);
              return (
                <div 
                  key={asset.id}
                  draggable
                  onClick={(e) => handleAssetClick(e, asset)}
                  onDoubleClick={() => {
                    if (selectedIds.length > 1) {
                      handleSendMultipleToLive(selectedAssets);
                    } else {
                      handleSendToLive(asset);
                    }
                  }}
                  onDragStart={(e) => handleDragStart(e, asset)}
                  onContextMenu={(e) => handleContextMenu(e, asset)}
                  className={`group relative aspect-video rounded-md overflow-hidden bg-black border cursor-grab active:cursor-grabbing transition-all ${
                    isSelected
                      ? 'border-emerald-400 ring-2 ring-emerald-500/50 shadow-md'
                      : 'border-[#2d3039] hover:border-emerald-500'
                  }`}
                >
                  {asset.type === 'video' || asset.type === 'motion' ? (
                    <LazyVideoThumbnail 
                      src={asset.url} 
                      poster={asset.thumbnailUrl} 
                      alt={asset.name}
                    />
                  ) : (
                    <img src={asset.url} className="w-full h-full object-cover pointer-events-none" referrerPolicy="no-referrer" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1.5 pointer-events-none">
                    <span className="text-[10px] font-bold text-white truncate">{asset.name}</span>
                  </div>
                  {/* Default Badges on Card */}
                  {badges.length > 0 && (
                    <div className="absolute bottom-1 left-1 z-10 flex flex-wrap gap-0.5 pointer-events-none">
                      {badges.map(b => (
                        <span key={b.scope} className={`text-[7px] font-extrabold px-1 py-0.2 rounded shadow-xs uppercase tracking-tight flex items-center gap-0.5 ${b.color}`} title={`Locked Default for ${b.label}`}>
                          <Lock size={6} /> {b.label}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="absolute top-1 right-1 bg-black/60 rounded px-1 py-0.5 text-[8px] uppercase font-bold text-gray-300 border border-white/10 flex items-center gap-1 pointer-events-none">
                    {asset.type === 'video' ? <Film size={8} className="text-cyan-400" /> : <ImageIcon size={8} className="text-amber-400" />}
                  </div>
                  {isSelected && (
                    <div className="absolute top-1 left-1 bg-emerald-500 text-black rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold text-[9px] shadow-sm pointer-events-none">
                      ✓
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map(asset => {
              const isSelected = selectedIds.includes(asset.id);
              const badges = getActiveDefaultBadges(asset, mediaAssets);
              return (
                <div 
                  key={asset.id}
                  draggable
                  onClick={(e) => handleAssetClick(e, asset)}
                  onDoubleClick={() => {
                    if (selectedIds.length > 1) {
                      handleSendMultipleToLive(selectedAssets);
                    } else {
                      handleSendToLive(asset);
                    }
                  }}
                  onDragStart={(e) => handleDragStart(e, asset)}
                  onContextMenu={(e) => handleContextMenu(e, asset)}
                  className={`flex items-center gap-2 border rounded p-1 cursor-grab active:cursor-grabbing transition-all ${
                    isSelected
                      ? 'bg-[#1a2e26] border-emerald-400 text-white'
                      : 'bg-[#15161a] border-[#2d3039] hover:border-emerald-500 text-gray-200'
                  }`}
                >
                  <div className="w-12 aspect-video bg-black rounded overflow-hidden relative shrink-0">
                    {asset.type === 'video' || asset.type === 'motion' ? (
                      <LazyVideoThumbnail 
                        src={asset.url} 
                        poster={asset.thumbnailUrl} 
                        alt={asset.name}
                      />
                    ) : (
                      <img src={asset.url} className="w-full h-full object-cover pointer-events-none" referrerPolicy="no-referrer" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <div className="text-[11px] font-bold truncate">{asset.name}</div>
                      {badges.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 shrink-0">
                          {badges.map(b => (
                            <span key={b.scope} className={`text-[7px] font-extrabold px-1 py-0.2 rounded shadow-xs uppercase tracking-tight flex items-center gap-0.5 ${b.color}`} title={`Locked Default for ${b.label}`}>
                              <Lock size={6} /> {b.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-[9px] text-gray-400 uppercase">{asset.type}</div>
                  </div>
                  {isSelected && (
                    <span className="text-emerald-400 font-bold text-xs pr-1">✓</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 text-xs mt-10">
            No media found.
          </div>
        )}
      </div>

      {/* Right-Click Context Menu for Media */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-[#1c1f28] border border-[#373c4d] rounded-md shadow-2xl py-1 w-56 text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
        >
          <div className="px-3 py-1 font-bold text-cyan-300 border-b border-[#2a2e3d] text-[11px] truncate">
            {selectedIds.length > 1 ? `${selectedIds.length} Media Selected` : contextMenu.asset.name}
          </div>

          {selectedIds.length > 1 ? (
            <>
              <button
                onClick={() => {
                  handleSendMultipleToLive(selectedAssets);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-emerald-600 hover:text-white flex items-center gap-2 text-emerald-400 font-bold"
              >
                <Play size={12} className="fill-emerald-400" />
                <span>Go Live as Slideshow ({selectedIds.length})</span>
              </button>

              <button
                onClick={() => {
                  handleAddMultipleToSchedule(selectedAssets);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2"
              >
                <Plus size={12} className="text-indigo-400" />
                <span>Add All ({selectedIds.length}) to Schedule</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  handleAddToSchedule(contextMenu.asset);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2"
              >
                <Plus size={12} className="text-indigo-400" />
                <span>Add to Schedule</span>
              </button>

              <button
                onClick={() => {
                  handleSendToLive(contextMenu.asset);
                  setContextMenu(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-emerald-600 hover:text-white flex items-center gap-2 text-emerald-400"
              >
                <Play size={12} className="fill-emerald-400" />
                <span>Go Live Directly</span>
              </button>
            </>
          )}

          <div className="border-t border-[#2a2e3d] my-1"></div>

          <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
            <span>Set Default Lock</span>
            <span className="text-[9px] text-gray-500 font-normal lowercase">1 file per category</span>
          </div>

          {/* Scope: Songs */}
          <div className="px-2 py-0.5">
            <div className={`w-full px-2 py-1 rounded flex items-center justify-between transition-colors ${
              isDefaultBgFor(contextMenu.asset, 'songs') ? 'bg-cyan-950/40 border border-cyan-500/40 text-cyan-300' : 'hover:bg-[#252b3d] text-gray-300'
            }`}>
              <button
                onClick={() => {
                  handleLockDefaultBg(contextMenu.asset, 'songs');
                  setContextMenu(null);
                }}
                className="flex items-center gap-1.5 flex-1 text-left cursor-pointer"
                title="Lock as Default Background for Songs"
              >
                <Sparkles size={11} className="text-cyan-400" />
                <span className="font-medium text-[11px]">For Songs</span>
              </button>
              {isDefaultBgFor(contextMenu.asset, 'songs') ? (
                <div className="flex items-center gap-1">
                  <span className="flex items-center gap-0.5 text-[9px] text-cyan-400 font-bold bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-500/50">
                    <Lock size={9} /> Locked
                  </span>
                  <button
                    onClick={() => {
                      handleUnlockDefaultBg(contextMenu.asset, 'songs');
                      setContextMenu(null);
                    }}
                    className="p-0.5 rounded text-gray-400 hover:text-rose-300 hover:bg-rose-950/50"
                    title="Unlock Default"
                  >
                    <Unlock size={10} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    handleLockDefaultBg(contextMenu.asset, 'songs');
                    setContextMenu(null);
                  }}
                  className="text-[10px] text-gray-400 hover:text-cyan-300 font-semibold px-1 rounded hover:bg-cyan-950/50"
                >
                  Set Lock
                </button>
              )}
            </div>
          </div>

          {/* Scope: Scriptures */}
          <div className="px-2 py-0.5">
            <div className={`w-full px-2 py-1 rounded flex items-center justify-between transition-colors ${
              isDefaultBgFor(contextMenu.asset, 'scriptures') ? 'bg-amber-950/40 border border-amber-500/40 text-amber-300' : 'hover:bg-[#252b3d] text-gray-300'
            }`}>
              <button
                onClick={() => {
                  handleLockDefaultBg(contextMenu.asset, 'scriptures');
                  setContextMenu(null);
                }}
                className="flex items-center gap-1.5 flex-1 text-left cursor-pointer"
                title="Lock as Default Background for Scriptures"
              >
                <Sparkles size={11} className="text-amber-400" />
                <span className="font-medium text-[11px]">For Scriptures</span>
              </button>
              {isDefaultBgFor(contextMenu.asset, 'scriptures') ? (
                <div className="flex items-center gap-1">
                  <span className="flex items-center gap-0.5 text-[9px] text-amber-400 font-bold bg-amber-950/80 px-1.5 py-0.2 rounded border border-amber-500/50">
                    <Lock size={9} /> Locked
                  </span>
                  <button
                    onClick={() => {
                      handleUnlockDefaultBg(contextMenu.asset, 'scriptures');
                      setContextMenu(null);
                    }}
                    className="p-0.5 rounded text-gray-400 hover:text-rose-300 hover:bg-rose-950/50"
                    title="Unlock Default"
                  >
                    <Unlock size={10} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    handleLockDefaultBg(contextMenu.asset, 'scriptures');
                    setContextMenu(null);
                  }}
                  className="text-[10px] text-gray-400 hover:text-amber-300 font-semibold px-1 rounded hover:bg-amber-950/50"
                >
                  Set Lock
                </button>
              )}
            </div>
          </div>

          {/* Scope: Logo */}
          <div className="px-2 py-0.5">
            <div className={`w-full px-2 py-1 rounded flex items-center justify-between transition-colors ${
              isDefaultBgFor(contextMenu.asset, 'logo') ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300' : 'hover:bg-[#252b3d] text-gray-300'
            }`}>
              <button
                onClick={() => {
                  handleLockDefaultBg(contextMenu.asset, 'logo');
                  setContextMenu(null);
                }}
                className="flex items-center gap-1.5 flex-1 text-left cursor-pointer"
                title="Lock as Default Logo"
              >
                <Sparkles size={11} className="text-emerald-400" />
                <span className="font-medium text-[11px]">For Logo</span>
              </button>
              {isDefaultBgFor(contextMenu.asset, 'logo') ? (
                <div className="flex items-center gap-1">
                  <span className="flex items-center gap-0.5 text-[9px] text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-500/50">
                    <Lock size={9} /> Locked
                  </span>
                  <button
                    onClick={() => {
                      handleUnlockDefaultBg(contextMenu.asset, 'logo');
                      setContextMenu(null);
                    }}
                    className="p-0.5 rounded text-gray-400 hover:text-rose-300 hover:bg-rose-950/50"
                    title="Unlock Default"
                  >
                    <Unlock size={10} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    handleLockDefaultBg(contextMenu.asset, 'logo');
                    setContextMenu(null);
                  }}
                  className="text-[10px] text-gray-400 hover:text-emerald-300 font-semibold px-1 rounded hover:bg-emerald-950/50"
                >
                  Set Lock
                </button>
              )}
            </div>
          </div>

          {/* Scope: Timers */}
          <div className="px-2 py-0.5">
            <div className={`w-full px-2 py-1 rounded flex items-center justify-between transition-colors ${
              isDefaultBgFor(contextMenu.asset, 'timers') ? 'bg-teal-950/40 border border-teal-500/40 text-teal-300' : 'hover:bg-[#252b3d] text-gray-300'
            }`}>
              <button
                onClick={() => {
                  handleLockDefaultBg(contextMenu.asset, 'timers');
                  setContextMenu(null);
                }}
                className="flex items-center gap-1.5 flex-1 text-left cursor-pointer"
                title="Lock as Default Background for Timers"
              >
                <Sparkles size={11} className="text-teal-400" />
                <span className="font-medium text-[11px]">For Timer</span>
              </button>
              {isDefaultBgFor(contextMenu.asset, 'timers') ? (
                <div className="flex items-center gap-1">
                  <span className="flex items-center gap-0.5 text-[9px] text-teal-400 font-bold bg-teal-950/80 px-1.5 py-0.2 rounded border border-teal-500/50">
                    <Lock size={9} /> Locked
                  </span>
                  <button
                    onClick={() => {
                      handleUnlockDefaultBg(contextMenu.asset, 'timers');
                      setContextMenu(null);
                    }}
                    className="p-0.5 rounded text-gray-400 hover:text-rose-300 hover:bg-rose-950/50"
                    title="Unlock Default"
                  >
                    <Unlock size={10} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    handleLockDefaultBg(contextMenu.asset, 'timers');
                    setContextMenu(null);
                  }}
                  className="text-[10px] text-gray-400 hover:text-teal-300 font-semibold px-1 rounded hover:bg-teal-950/50"
                >
                  Set Lock
                </button>
              )}
            </div>
          </div>

          {/* Scope: Presentations */}
          <div className="px-2 py-0.5">
            <div className={`w-full px-2 py-1 rounded flex items-center justify-between transition-colors ${
              isDefaultBgFor(contextMenu.asset, 'presentations') ? 'bg-purple-950/40 border border-purple-500/40 text-purple-300' : 'hover:bg-[#252b3d] text-gray-300'
            }`}>
              <button
                onClick={() => {
                  handleLockDefaultBg(contextMenu.asset, 'presentations');
                  setContextMenu(null);
                }}
                className="flex items-center gap-1.5 flex-1 text-left cursor-pointer"
                title="Lock as Default Background for Presentations"
              >
                <Sparkles size={11} className="text-purple-400" />
                <span className="font-medium text-[11px]">For PPT</span>
              </button>
              {isDefaultBgFor(contextMenu.asset, 'presentations') ? (
                <div className="flex items-center gap-1">
                  <span className="flex items-center gap-0.5 text-[9px] text-purple-400 font-bold bg-purple-950/80 px-1.5 py-0.2 rounded border border-purple-500/50">
                    <Lock size={9} /> Locked
                  </span>
                  <button
                    onClick={() => {
                      handleUnlockDefaultBg(contextMenu.asset, 'presentations');
                      setContextMenu(null);
                    }}
                    className="p-0.5 rounded text-gray-400 hover:text-rose-300 hover:bg-rose-950/50"
                    title="Unlock Default"
                  >
                    <Unlock size={10} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    handleLockDefaultBg(contextMenu.asset, 'presentations');
                    setContextMenu(null);
                  }}
                  className="text-[10px] text-gray-400 hover:text-purple-300 font-semibold px-1 rounded hover:bg-purple-950/50"
                >
                  Set Lock
                </button>
              )}
            </div>
          </div>

          {/* Scope: Announcements */}
          <div className="px-2 py-0.5">
            <div className={`w-full px-2 py-1 rounded flex items-center justify-between transition-colors ${
              isDefaultBgFor(contextMenu.asset, 'announcements') ? 'bg-rose-950/40 border border-rose-500/40 text-rose-300' : 'hover:bg-[#252b3d] text-gray-300'
            }`}>
              <button
                onClick={() => {
                  handleLockDefaultBg(contextMenu.asset, 'announcements');
                  setContextMenu(null);
                }}
                className="flex items-center gap-1.5 flex-1 text-left cursor-pointer"
                title="Lock as Default Background for Notices"
              >
                <Sparkles size={11} className="text-rose-400" />
                <span className="font-medium text-[11px]">For Notice</span>
              </button>
              {isDefaultBgFor(contextMenu.asset, 'announcements') ? (
                <div className="flex items-center gap-1">
                  <span className="flex items-center gap-0.5 text-[9px] text-rose-400 font-bold bg-rose-950/80 px-1.5 py-0.2 rounded border border-rose-500/50">
                    <Lock size={9} /> Locked
                  </span>
                  <button
                    onClick={() => {
                      handleUnlockDefaultBg(contextMenu.asset, 'announcements');
                      setContextMenu(null);
                    }}
                    className="p-0.5 rounded text-gray-400 hover:text-rose-300 hover:bg-rose-950/50"
                    title="Unlock Default"
                  >
                    <Unlock size={10} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    handleLockDefaultBg(contextMenu.asset, 'announcements');
                    setContextMenu(null);
                  }}
                  className="text-[10px] text-gray-400 hover:text-rose-300 font-semibold px-1 rounded hover:bg-rose-950/50"
                >
                  Set Lock
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
