import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { Film, ImageIcon, Search, LayoutGrid, List, Sparkles, Plus, Play, CheckSquare, X, Check } from 'lucide-react';
import { Asset, PresentationItem } from '../../types';
import { handleRangeSelection } from '../../utils/selectionUtils';
import { PresentationContentResolver } from '../../core/PresentationContentResolver';
import { LazyVideoThumbnail } from '../common/LazyVideoThumbnail';

export default function MediaLibraryPanel() {
  const store = useStore();
  const { assetsList, setDefaultBackground, addScheduleItem } = store;

  const isDefaultBgFor = (asset: Asset, scope: 'songs' | 'scriptures' | 'presentations' | 'announcements' | 'logo' | 'timers') => {
    if (!asset) return false;
    if (asset.isDefaultScope?.[scope] === true) return true;
    const url = asset.url;
    const id = asset.id;
    if (scope === 'songs') {
      const t = store.themesList.find(th => th.type === 'song' || th.id === 'theme-song');
      return (Boolean(url) && (t?.styles?.backgroundImageUrl === url || t?.styles?.backgroundVideoUrl === url)) || (Boolean(id) && (t?.styles?.backgroundImageUrl === id || t?.styles?.backgroundVideoUrl === id));
    }
    if (scope === 'scriptures') {
      const t = store.themesList.find(th => th.type === 'bible' || th.id === 'theme-scripture');
      return (Boolean(url) && (t?.styles?.backgroundImageUrl === url || t?.styles?.backgroundVideoUrl === url)) || (Boolean(id) && (t?.styles?.backgroundImageUrl === id || t?.styles?.backgroundVideoUrl === id));
    }
    if (scope === 'presentations') {
      const t = store.themesList.find(th => th.type === 'presentation' || (th.type as any) === 'ppt' || th.id === 'theme-presentation');
      return (Boolean(url) && (t?.styles?.backgroundImageUrl === url || t?.styles?.backgroundVideoUrl === url)) || (Boolean(id) && (t?.styles?.backgroundImageUrl === id || t?.styles?.backgroundVideoUrl === id));
    }
    if (scope === 'announcements') {
      const t = store.themesList.find(th => th.type === 'announcement' || th.id === 'theme-announcement');
      return (Boolean(url) && (t?.styles?.backgroundImageUrl === url || t?.styles?.backgroundVideoUrl === url)) || (Boolean(id) && (t?.styles?.backgroundImageUrl === id || t?.styles?.backgroundVideoUrl === id));
    }
    if (scope === 'logo') {
      const sysLogo = store.systemOptions?.general?.defaultLogoUrl || store.systemOptions?.mainOutput?.general?.defaultLogoUrl;
      const t = store.themesList.find(th => th.type === 'logo' || th.id === 'theme-logo');
      return sysLogo === url || sysLogo === id || (Boolean(url) && (t?.styles?.backgroundImageUrl === url || t?.styles?.backgroundVideoUrl === url || t?.styles?.logoUrl === url)) || (Boolean(id) && (t?.styles?.backgroundImageUrl === id || t?.styles?.backgroundVideoUrl === id || t?.styles?.logoUrl === id));
    }
    if (scope === 'timers') {
      const sysTimer = store.systemOptions?.serviceIntervals?.backgroundAssetId || (store.systemOptions?.serviceIntervals as any)?.backgroundAssetUrl;
      const t = store.themesList.find(th => th.type === 'timer' || th.id === 'theme-timer');
      return sysTimer === url || sysTimer === id || (Boolean(url) && (t?.styles?.backgroundImageUrl === url || t?.styles?.backgroundVideoUrl === url)) || (Boolean(id) && (t?.styles?.backgroundImageUrl === id || t?.styles?.backgroundVideoUrl === id));
    }
    return false;
  };

  const getActiveDefaultBadges = (asset: Asset) => {
    const badges: { scope: string; label: string; color: string }[] = [];
    if (isDefaultBgFor(asset, 'logo')) badges.push({ scope: 'logo', label: 'LOGO', color: 'bg-emerald-500/90 text-white' });
    if (isDefaultBgFor(asset, 'songs')) badges.push({ scope: 'songs', label: 'SONGS', color: 'bg-cyan-500/90 text-white' });
    if (isDefaultBgFor(asset, 'scriptures')) badges.push({ scope: 'scriptures', label: 'BIBLE', color: 'bg-amber-500/90 text-white' });
    if (isDefaultBgFor(asset, 'timers')) badges.push({ scope: 'timers', label: 'TIMER', color: 'bg-emerald-600/90 text-white' });
    if (isDefaultBgFor(asset, 'presentations')) badges.push({ scope: 'presentations', label: 'PPT', color: 'bg-purple-500/90 text-white' });
    if (isDefaultBgFor(asset, 'announcements')) badges.push({ scope: 'announcements', label: 'NOTICE', color: 'bg-rose-500/90 text-white' });
    return badges;
  };
  const [search, setSearch] = useState('');
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
      x: Math.min(e.clientX, window.innerWidth - 230),
      y: Math.min(e.clientY, window.innerHeight - 240),
      asset,
    });
  };

  const handleApplyToSongs = (asset: Asset) => {
    const isVideo = PresentationContentResolver.isAssetVideo(asset, asset.url, asset.name);
    setDefaultBackground(asset.url, 'songs', isVideo);
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Set "${asset.name}" as default background for Songs!` }));
  };

  const handleApplyToScriptures = (asset: Asset) => {
    const isVideo = PresentationContentResolver.isAssetVideo(asset, asset.url, asset.name);
    setDefaultBackground(asset.url, 'scriptures', isVideo);
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Set "${asset.name}" as default background for Scriptures!` }));
  };

  const handleApplyToLogo = (asset: Asset) => {
    const isVideo = PresentationContentResolver.isAssetVideo(asset, asset.url, asset.name);
    setDefaultBackground(asset.url, 'logo', isVideo);
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Set "${asset.name}" as default for Logo!` }));
  };

  const handleApplyToTimers = (asset: Asset) => {
    const isVideo = PresentationContentResolver.isAssetVideo(asset, asset.url, asset.name);
    setDefaultBackground(asset.url, 'timers', isVideo);
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Set "${asset.name}" as default background for Timers!` }));
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
    useStore.getState().setRoutingRequest({ item, isNew: true, slideIndex: 0 });
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

    useStore.getState().setRoutingRequest({ item: slideshowItem, isNew: true, slideIndex: 0 });
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { 
      detail: `Sent ${assets.length} images as slideshow to Live Output!` 
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
  
  const mediaAssets = assetsList.filter(a => ['image', 'video', 'motion'].includes(a.type));
  
  const filtered = mediaAssets.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) || 
    (a.tags && a.tags.some(t => t.toLowerCase().includes(search.toLowerCase())))
  );

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
      <div className="p-2 border-b border-[#2d3039] flex gap-2 items-center shrink-0">
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
      
      <div className="flex-1 overflow-y-auto p-2">
        <div className="text-[10px] text-gray-400 mb-2 italic px-1 flex items-center justify-between">
          <span>Click to select, Shift/Ctrl to multi-select. Double-click to Go Live.</span>
        </div>
        
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filtered.map(asset => {
              const isSelected = selectedIds.includes(asset.id);
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
                  {getActiveDefaultBadges(asset).length > 0 && (
                    <div className="absolute bottom-1 left-1 z-10 flex flex-wrap gap-0.5 pointer-events-none">
                      {getActiveDefaultBadges(asset).map(b => (
                        <span key={b.scope} className={`text-[7px] font-extrabold px-1 py-0.2 rounded shadow-xs uppercase tracking-tight flex items-center gap-0.5 ${b.color}`}>
                          <Check size={6} /> {b.label}
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
                    <div className="text-[11px] font-bold truncate">{asset.name}</div>
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

          <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Set as Default Background:
          </div>

          <button
            onClick={() => {
              handleApplyToSongs(contextMenu.asset);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center justify-between text-cyan-300"
          >
            <span className="flex items-center gap-2">
              <Sparkles size={12} className="text-cyan-400" />
              <span>For Songs</span>
            </span>
            {isDefaultBgFor(contextMenu.asset, 'songs') && (
              <span className="flex items-center gap-1 text-[10px] text-cyan-400 font-semibold bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30">
                <Check size={10} /> Active
              </span>
            )}
          </button>

          <button
            onClick={() => {
              handleApplyToScriptures(contextMenu.asset);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center justify-between text-amber-300"
          >
            <span className="flex items-center gap-2">
              <Sparkles size={12} className="text-amber-400" />
              <span>For Scriptures</span>
            </span>
            {isDefaultBgFor(contextMenu.asset, 'scriptures') && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/30">
                <Check size={10} /> Active
              </span>
            )}
          </button>

          <button
            onClick={() => {
              handleApplyToLogo(contextMenu.asset);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center justify-between text-emerald-300 font-semibold"
          >
            <span className="flex items-center gap-2">
              <Sparkles size={12} className="text-emerald-400" />
              <span>For Logo</span>
            </span>
            {isDefaultBgFor(contextMenu.asset, 'logo') && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                <Check size={10} /> Active
              </span>
            )}
          </button>

          <button
            onClick={() => {
              handleApplyToTimers(contextMenu.asset);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center justify-between text-teal-300 font-semibold"
          >
            <span className="flex items-center gap-2">
              <Sparkles size={12} className="text-teal-400" />
              <span>For Timers</span>
            </span>
            {isDefaultBgFor(contextMenu.asset, 'timers') && (
              <span className="flex items-center gap-1 text-[10px] text-teal-400 font-semibold bg-teal-950/60 px-1.5 py-0.5 rounded border border-teal-500/30">
                <Check size={10} /> Active
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
