import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store/useStore';
import { Film, ImageIcon, Search, LayoutGrid, List, Sparkles, Plus, Play } from 'lucide-react';
import { Asset } from '../../types';

export default function MediaLibraryPanel() {
  const { assetsList, setDefaultBackground, addScheduleItem, goLiveItem } = useStore();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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

  const handleContextMenu = (e: React.MouseEvent, asset: Asset) => {
    e.preventDefault();
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 230),
      y: Math.min(e.clientY, window.innerHeight - 240),
      asset,
    });
  };

  const handleApplyToSongs = (asset: Asset) => {
    setDefaultBackground(asset.url, 'songs', asset.type === 'video');
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Set "${asset.name}" as default background for Songs!` }));
  };

  const handleApplyToScriptures = (asset: Asset) => {
    setDefaultBackground(asset.url, 'scriptures', asset.type === 'video');
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Set "${asset.name}" as default background for Scriptures!` }));
  };

  const handleApplyToPresentations = (asset: Asset) => {
    setDefaultBackground(asset.url, 'presentations', asset.type === 'video');
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Set "${asset.name}" as default background for Presentations!` }));
  };

  const handleApplyToAnnouncements = (asset: Asset) => {
    setDefaultBackground(asset.url, 'announcements', asset.type === 'video');
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Set "${asset.name}" as default background for Announcements!` }));
  };

  const handleApplyToLogo = (asset: Asset) => {
    setDefaultBackground(asset.url, 'logo', asset.type === 'video');
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Set "${asset.name}" as default for Logo!` }));
  };

  const handleAddToSchedule = (asset: Asset) => {
    addScheduleItem({
      type: 'media',
      name: asset.name,
      contentId: asset.id,
      customBackgroundUrl: asset.url,
      data: {
        url: asset.url,
        type: asset.type,
      },
    });
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Added "${asset.name}" to Schedule!` }));
  };

  const handleSendToLive = (asset: Asset) => {
    const itemId = `media-${Date.now()}`;
    const item = {
      id: itemId,
      type: 'media' as const,
      name: asset.name,
      contentId: asset.id,
      customBackgroundUrl: asset.url,
      data: {
        url: asset.url,
        type: asset.type,
      },
    };
    useStore.getState().setRoutingRequest({ item, isNew: true, slideIndex: 0 });
  };
  
  const mediaAssets = assetsList.filter(a => ['image', 'video', 'motion'].includes(a.type));
  
  const filtered = mediaAssets.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) || 
    (a.tags && a.tags.some(t => t.toLowerCase().includes(search.toLowerCase())))
  );

  const handleDragStart = (e: React.DragEvent, asset: any) => {
    // Used for dropping onto a SPECIFIC slide to set its background
    e.dataTransfer.setData('application/x-simpleworship-asset-bg', JSON.stringify(asset));
    
    // Also provide standard asset payload for dropping into schedule as a new item
    const payload = {
      type: 'media',
      item: {
        id: `media-${Date.now()}`,
        type: 'media',
        contentId: asset.id,
        name: asset.name,
        customBackgroundUrl: asset.url,
        data: {
          url: asset.url,
          type: asset.type
        }
      }
    };
    e.dataTransfer.setData('application/x-simpleworship-item', JSON.stringify(payload));
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
      
      <div className="flex-1 overflow-y-auto p-2">
        <div className="text-[10px] text-gray-400 mb-2 italic px-1 flex items-center justify-between">
          <span>Right-click any media item for quick default background assignments.</span>
        </div>
        
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filtered.map(asset => (
              <div 
                key={asset.id}
                draggable
                onDragStart={(e) => handleDragStart(e, asset)}
                onContextMenu={(e) => handleContextMenu(e, asset)}
                className="group relative aspect-video rounded-md overflow-hidden bg-black border border-[#2d3039] hover:border-emerald-500 cursor-grab active:cursor-grabbing"
              >
                {asset.type === 'video' || asset.type === 'motion' ? (
                  <video src={asset.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={asset.url} className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-1.5">
                  <span className="text-[10px] font-bold text-white truncate">{asset.name}</span>
                </div>
                <div className="absolute top-1 right-1 bg-black/60 rounded px-1 py-0.5 text-[8px] uppercase font-bold text-gray-300 border border-white/10 flex items-center gap-1">
                  {asset.type === 'video' ? <Film size={8} className="text-cyan-400" /> : <ImageIcon size={8} className="text-amber-400" />}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filtered.map(asset => (
              <div 
                key={asset.id}
                draggable
                onDragStart={(e) => handleDragStart(e, asset)}
                onContextMenu={(e) => handleContextMenu(e, asset)}
                className="flex items-center gap-2 bg-[#15161a] border border-[#2d3039] hover:border-emerald-500 rounded p-1 cursor-grab active:cursor-grabbing"
              >
                <div className="w-12 aspect-video bg-black rounded overflow-hidden relative shrink-0">
                  {asset.type === 'video' || asset.type === 'motion' ? (
                    <video src={asset.url} className="w-full h-full object-cover" />
                  ) : (
                    <img src={asset.url} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-gray-200 truncate">{asset.name}</div>
                  <div className="text-[9px] text-gray-400 uppercase">{asset.type}</div>
                </div>
              </div>
            ))}
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
            {contextMenu.asset.name}
          </div>

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
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2 text-emerald-400"
          >
            <Play size={12} />
            <span>Go Live Directly</span>
          </button>

          <div className="border-t border-[#2a2e3d] my-1"></div>

          <button
            onClick={() => {
              handleApplyToSongs(contextMenu.asset);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2 text-cyan-300"
          >
            <Sparkles size={12} />
            <span>Set Default for Songs</span>
          </button>

          <button
            onClick={() => {
              handleApplyToScriptures(contextMenu.asset);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2 text-amber-300"
          >
            <Sparkles size={12} />
            <span>Set Default for Scriptures</span>
          </button>

          <button
            onClick={() => {
              handleApplyToPresentations(contextMenu.asset);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2 text-purple-300"
          >
            <Sparkles size={12} />
            <span>Set Default for Presentations</span>
          </button>

          <button
            onClick={() => {
              handleApplyToAnnouncements(contextMenu.asset);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2 text-rose-300"
          >
            <Sparkles size={12} />
            <span>Set Default for Announcements</span>
          </button>

          <button
            onClick={() => {
              handleApplyToLogo(contextMenu.asset);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2 text-emerald-300 font-semibold"
          >
            <Sparkles size={12} />
            <span>Set Default for Logo</span>
          </button>
        </div>
      )}
    </div>
  );
}
