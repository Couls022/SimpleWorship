import React, { useState, useRef, useEffect } from 'react';
import { 
  Plus, 
  Film, 
  Image as ImageIcon, 
  Music,
  Upload, 
  Check, 
  Sparkles, 
  Play, 
  Clock, 
  Layers, 
  Folder,
  Tv,
  Trash2,
  Copy,
  GripVertical,
  LayoutGrid,
  List
} from 'lucide-react';
import { Panel, PanelGroup } from 'react-resizable-panels';
import ResizeHandle from '../ResizeHandle';
import { useStore } from '../../store/useStore';
import { Asset } from '../../types';
import { handleRangeSelection } from '../../utils/selectionUtils';

export default function MediaTab() {
  const store = useStore();
  const { assetsList, addAsset, deleteAsset, setDefaultBackground, addScheduleItem, goLiveItem } = store;

  const [activeMediaFilter, setActiveMediaFilter] = useState<'all' | 'image' | 'audio' | 'video'>('all');
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(() => assetsList[0]?.id ? [assetsList[0].id] : []);
  const [anchorAssetId, setAnchorAssetId] = useState<string | null>(() => assetsList[0]?.id || null);

  // View mode state with operator persistence
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    try {
      const saved = localStorage.getItem('simpleworship_media_view_mode');
      return (saved === 'grid' || saved === 'list') ? saved : 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleSetViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    try {
      localStorage.setItem('simpleworship_media_view_mode', mode);
    } catch {
      // ignore
    }
  };

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    asset: Asset;
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

  const filters = [
    { id: 'all', label: 'All Media' },
    { id: 'image', label: 'Images' },
    { id: 'audio', label: 'Audio' },
    { id: 'video', label: 'Videos' },
  ];

  const safeAssetsList = assetsList || [];

  const filteredAssets = safeAssetsList.filter(a => {
    if (!a) return false;
    if (activeMediaFilter === 'all') return true;
    if (activeMediaFilter === 'image') return a.type === 'image';
    if (activeMediaFilter === 'audio') return a.type === 'audio';
    if (activeMediaFilter === 'video') return a.type === 'video' || a.type === 'motion';
    return true;
  });

  const selectedAsset = safeAssetsList.find(a => a && selectedAssetIds.includes(a.id)) || filteredAssets[0] || null;

  const handleAssetClick = (e: React.MouseEvent, asset: Asset) => {
    const { selectedIds, anchorId } = handleRangeSelection(
      filteredAssets,
      selectedAssetIds,
      asset.id,
      e,
      anchorAssetId
    );
    setSelectedAssetIds(selectedIds);
    setAnchorAssetId(anchorId);
  };

  const handleContextMenu = (e: React.MouseEvent, asset: Asset) => {
    e.preventDefault();
    if (!selectedAssetIds.includes(asset.id)) {
      setSelectedAssetIds([asset.id]);
      setAnchorAssetId(asset.id);
    }
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 240),
      asset
    });
  };

  const handleDeleteAsset = (asset: Asset) => {
    deleteAsset(asset.id);
    if (selectedAssetIds.includes(asset.id)) {
      setSelectedAssetIds([]);
      setAnchorAssetId(null);
    }
    setContextMenu(null);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Deleted "${asset.name}"` 
      })
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        const isVideo = file.type.startsWith('video');
        const isAudio = file.type.startsWith('audio');
        let assetType: 'image' | 'video' | 'audio' = 'image';
        if (isVideo) assetType = 'video';
        else if (isAudio) assetType = 'audio';

        const newAsset: Asset = {
          id: `asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          type: assetType,
          url: url,
          thumbnailUrl: (isVideo || isAudio) ? undefined : url,
          tags: ['uploaded', assetType],
        };
        addAsset(newAsset);
        window.dispatchEvent(
          new CustomEvent('simpleworship:notify', { 
            detail: `Imported "${newAsset.name}" successfully!` 
          })
        );
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
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
      contentId: asset.id,
      name: asset.name,
      customBackgroundUrl: asset.url,
      data: { url: asset.url, isVideo: asset.type === 'video' }
    });
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Added "${asset.name}" to schedule!` 
      })
    );
  };

  const handleSendToLive = (asset: Asset) => {
    const itemId = `media-${Date.now()}`;
    const item = {
      id: itemId,
      type: 'media' as const,
      contentId: asset.id,
      name: asset.name,
      customBackgroundUrl: asset.url,
      data: { url: asset.url, isVideo: asset.type === 'video' }
    };
    store.setRoutingRequest({ item, isNew: true, slideIndex: 0 });
  };

  // Drag-and-drop start handler
  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
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
          isVideo: asset.type === 'video'
        }
      }
    };
    const jsonStr = JSON.stringify(payload);
    e.dataTransfer.setData('application/json', jsonStr);
    e.dataTransfer.setData('application/x-simpleworship-item', jsonStr);
    e.dataTransfer.setData('text/plain', asset.name);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  return (
    <div className="flex flex-col h-full bg-[#181a1f] text-gray-200 select-none text-xs relative">
      {/* Media Filter & Upload Bar */}
      <div className="h-8 bg-[#22252c] border-b border-[#15161a] flex items-center justify-between px-3 gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveMediaFilter(f.id as any)}
              className={`px-2.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeMediaFilter === f.id
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'bg-[#1b1c22] text-gray-400 hover:text-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-2">
          {/* View Options Toggle (Grid / List) */}
          <div className="flex items-center bg-[#15161b] p-0.5 rounded border border-[#2b2e38] text-[10px]">
            <button
              type="button"
              onClick={() => handleSetViewMode('grid')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Grid View (Thumbnails)"
            >
              <LayoutGrid size={11} />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('list')}
              className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="List View (Explorer Details)"
            >
              <List size={11} />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>

          <label className="flex items-center gap-1 bg-[#2b303d] hover:bg-[#363c4d] border border-[#3e4456] text-gray-200 px-2.5 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-colors shadow-sm">
            <Upload size={12} className="text-cyan-400" />
            <span>Import Media</span>
            <input
              type="file"
              multiple
              accept="image/*,video/*,audio/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>

      {/* Main View: Grid or List */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
        {filteredAssets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-500">
            <Film size={36} className="text-gray-600 mb-3" />
            <p className="text-xs font-semibold text-gray-300">No media files found in this category.</p>
            <p className="text-[11px] text-gray-500 mt-1 max-w-[220px]">Browse your local computer storage to select image, video, or audio files.</p>
            <label className="mt-4 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-3 py-1.5 rounded-md text-xs cursor-pointer transition-colors shadow">
              <Upload size={14} />
              <span>Browse Computer Files...</span>
              <input
                type="file"
                multiple
                accept="image/*,video/*,audio/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        ) : viewMode === 'list' ? (
          <div className="border border-[#262933] rounded overflow-hidden divide-y divide-[#232630] bg-[#1a1c22]">
            {filteredAssets.map((asset) => {
              const isSelected = selectedAssetIds.includes(asset.id);
              return (
                <div
                  key={asset.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, asset)}
                  onClick={(e) => handleAssetClick(e, asset)}
                  onDoubleClick={() => handleAddToSchedule(asset)}
                  onContextMenu={(e) => handleContextMenu(e, asset)}
                  className={`flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing transition-colors text-xs select-none ${
                    isSelected
                      ? 'bg-[#252c3d] text-white'
                      : 'hover:bg-[#20232b] text-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <GripVertical size={13} className="text-gray-600 shrink-0" />
                    {asset.type === 'video' || asset.type === 'motion' ? (
                      <Film size={14} className="text-cyan-400 shrink-0" />
                    ) : asset.type === 'audio' ? (
                      <Music size={14} className="text-purple-400 shrink-0" />
                    ) : (
                      <ImageIcon size={14} className="text-amber-400 shrink-0" />
                    )}
                    <span className="font-medium truncate">{asset.name}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-[11px] text-gray-400">
                    <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-[#131418] border border-[#2b2e38] text-gray-300">
                      {asset.type}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAsset(asset);
                      }}
                      className="p-1 hover:text-rose-400 rounded hover:bg-[#2b2f3d]"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filteredAssets.map((asset) => {
            const isSelected = selectedAssetIds.includes(asset.id);

            return (
              <div
                key={asset.id}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, asset)}
                onClick={(e) => handleAssetClick(e, asset)}
                onDoubleClick={() => handleAddToSchedule(asset)}
                onContextMenu={(e) => handleContextMenu(e, asset)}
                className={`group aspect-video rounded-lg border relative overflow-hidden cursor-grab active:cursor-grabbing transition-all flex flex-col justify-between p-2 ${
                  isSelected
                    ? 'border-cyan-400 ring-2 ring-cyan-500/40 bg-[#1e2530] shadow-lg'
                    : 'border-[#2d3039] bg-[#1a1c22] hover:border-[#424754] hover:bg-[#23262f]'
                }`}
              >
                {/* Media Preview */}
                {asset.type === 'video' || asset.type === 'motion' ? (
                  <video
                    src={asset.url}
                    muted
                    loop
                    autoPlay
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                  />
                ) : asset.type === 'audio' ? (
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 flex flex-col items-center justify-center p-2 text-indigo-200">
                    <Music size={26} className="text-cyan-400 mb-1 animate-pulse" />
                    <span className="text-[9px] font-mono text-indigo-300 tracking-wider uppercase font-semibold">Audio Track</span>
                  </div>
                ) : (
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-70 group-hover:opacity-90 transition-opacity"
                    style={{ backgroundImage: `url(${asset.url})` }}
                  />
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

                {/* Top Type Pill */}
                <div className="relative z-10 flex items-center justify-between">
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm border border-white/10 uppercase tracking-tight flex items-center gap-1">
                    {asset.type === 'video' || asset.type === 'motion' ? (
                      <Film size={10} className="text-cyan-400" />
                    ) : asset.type === 'audio' ? (
                      <Music size={10} className="text-purple-400" />
                    ) : (
                      <ImageIcon size={10} className="text-amber-400" />
                    )}
                    <span>{asset.type === 'motion' ? 'video' : asset.type}</span>
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAsset(asset);
                      }}
                      className="p-1 rounded bg-black/60 hover:bg-rose-600 text-gray-300 hover:text-white transition-colors"
                      title="Delete Media"
                    >
                      <Trash2 size={10} />
                    </button>
                    <span className="text-gray-400">
                      <GripVertical size={12} />
                    </span>
                  </div>
                </div>

                {/* Bottom Title */}
                <div className="relative z-10">
                  <div className="text-[11px] font-bold text-white drop-shadow truncate">
                    {asset.name}
                  </div>
                </div>
              </div>
            );
          })}
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
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2 text-emerald-300"
          >
            <Sparkles size={12} />
            <span>Set Default for Logo</span>
          </button>

          <div className="border-t border-[#2a2e3d] my-1"></div>

          <button
            onClick={() => {
              handleDeleteAsset(contextMenu.asset);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-rose-600 hover:text-white flex items-center gap-2 text-rose-300 transition-colors"
          >
            <Trash2 size={12} />
            <span>Delete Media</span>
          </button>
        </div>
      )}
    </div>
  );
}
