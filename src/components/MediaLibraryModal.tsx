import { withPortal } from './common/withPortal';
import React, { useState, useRef, useEffect } from 'react';
import { PresentationContentResolver } from '../core/PresentationContentResolver';
import { 
  X, 
  Film, 
  Image as ImageIcon, 
  Music, 
  Upload, 
  Search, 
  Play, 
  Pause,
  Plus, 
  Tv, 
  Trash2, 
  Check, 
  Sparkles,
  GripVertical,
  SlidersHorizontal,
  ChevronDown,
  Lock,
  Unlock
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Asset } from '../types';
import { isMediaLibraryAsset, isDefaultBackgroundFor, getActiveDefaultBadges, DefaultMediaScope } from '../db/assets';
import { LazyVideoThumbnail } from './common/LazyVideoThumbnail';

interface MediaLibraryModalProps {
  onClose: () => void;
  onSelect?: (asset: Asset) => void;
}

function MediaLibraryModal({ onClose, onSelect }: MediaLibraryModalProps) {
  const assetsList = useStore(state => state.assetsList);
  const themesList = useStore(state => state.themesList);
  const systemOptions = useStore(state => state.systemOptions);

  const [activeMediaFilter, setActiveMediaFilter] = useState<'all' | 'image' | 'audio' | 'video'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  // Check if an asset is the currently active locked default background for a given category
  const isDefaultBgFor = (asset: Asset | null | undefined, category: DefaultMediaScope) => {
    return isDefaultBackgroundFor(asset, category, assetsList);
  };
  
  // Context menu state for right-click on assets
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    asset: Asset;
  } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (playingAudioId && audioRef.current) {
          audioRef.current.pause();
        }
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, playingAudioId]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const filters = [
    { id: 'all', label: 'All Media' },
    { id: 'image', label: 'Images' },
    { id: 'audio', label: 'Audio' },
    { id: 'video', label: 'Videos' },
  ];

  // Strictly filter out any cache items and documents to only show genuine images, audio, and videos
  const mediaOnlyAssets = assetsList.filter(isMediaLibraryAsset);

  const filteredAssets = mediaOnlyAssets.filter(a => {
    // Filter by type
    if (activeMediaFilter === 'image' && a.type !== 'image') return false;
    if (activeMediaFilter === 'audio' && a.type !== 'audio') return false;
    if (activeMediaFilter === 'video' && a.type !== 'video' && a.type !== 'motion') return false;

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = a.name.toLowerCase().includes(q);
      const matchTags = a.tags && a.tags.some(t => t.toLowerCase().includes(q));
      return matchName || matchTags;
    }
    return true;
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      try {
        const { processAssetFile } = await import('../db/assets');
        const newAsset = await processAssetFile(file);
        useStore.getState().addAsset(newAsset);
        window.dispatchEvent(
          new CustomEvent('simpleworship:notify', { 
            detail: `Imported "${newAsset.name}" successfully!` 
          })
        );
      } catch (err) {
        console.error("Failed to import media:", err);
      }
    }
  };

  const handleToggleAudio = (asset: Asset, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingAudioId === asset.id) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingAudioId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(asset.url);
      audioRef.current = audio;
      audio.play().catch(err => console.log("Audio play error:", err));
      audio.onended = () => setPlayingAudioId(null);
      setPlayingAudioId(asset.id);
    }
  };

  const handleAddToSchedule = (asset: Asset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isVid = asset.type === 'video' || asset.type === 'motion';
    const isAud = asset.type === 'audio';
    const itemType = isVid ? ('video' as const) : (isAud ? ('audio' as const) : ('image' as const));
    useStore.getState().addScheduleItem({
      type: itemType,
      contentId: asset.id,
      name: asset.name,
      customBackgroundUrl: asset.url,
      data: { 
        url: asset.url, 
        isVideo: isVid,
        isAudio: isAud,
        type: asset.type
      }
    });
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Added "${asset.name}" to Schedule!` 
      })
    );
  };

  const handleSendToLive = (asset: Asset, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const itemId = `media-${Date.now()}`;
    const isVid = asset.type === 'video' || asset.type === 'motion';
    const isAud = asset.type === 'audio';
    const itemType = isVid ? ('video' as const) : (isAud ? ('audio' as const) : ('image' as const));
    const item = {
      id: itemId,
      type: itemType,
      contentId: asset.id,
      name: asset.name,
      customBackgroundUrl: asset.url,
      data: { 
        url: asset.url, 
        isVideo: isVid,
        isAudio: isAud,
        type: asset.type
      }
    };
    useStore.getState().setPreviewItem(item.id, 0);
    useStore.getState().goLiveItem(item.id, 0, useStore.getState().activeControlGroupId || undefined, item);
    onClose();
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Broadcasting "${asset.name}" directly to Live Output!` 
      })
    );
  };

  const handleContextMenu = (e: React.MouseEvent, asset: Asset) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedAssetId(asset.id);
    const menuWidth = 230;
    const menuHeight = 330;
    const x = Math.min(e.clientX, window.innerWidth - menuWidth - 10);
    const y = Math.min(e.clientY, window.innerHeight - menuHeight - 10);
    setContextMenu({ x: Math.max(10, x), y: Math.max(10, y), asset });
  };

  const handleLockDefaultBg = (asset: Asset, category: DefaultMediaScope, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isVideo = PresentationContentResolver.isAssetVideo(asset, asset.url, asset.name);
    useStore.getState().setDefaultBackground(asset.url, category, isVideo, 'lock');
    setContextMenu(null);
    const catLabel = category.charAt(0).toUpperCase() + category.slice(1);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Locked "${asset.name}" as Default Background for ${catLabel}!` 
      })
    );
  };

  const handleUnlockDefaultBg = (asset: Asset, category: DefaultMediaScope, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    useStore.getState().setDefaultBackground(asset.url, category, false, 'unlock');
    setContextMenu(null);
    const catLabel = category.charAt(0).toUpperCase() + category.slice(1);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Unlocked Default Background for ${catLabel}.` 
      })
    );
  };

  const handleDelete = (asset: Asset, e: React.MouseEvent) => {
    e.stopPropagation();
    if (playingAudioId === asset.id && audioRef.current) {
      audioRef.current.pause();
      setPlayingAudioId(null);
    }
    useStore.getState().deleteAsset(asset.id);
    if (selectedAssetId === asset.id) {
      setSelectedAssetId(null);
    }
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Deleted "${asset.name}"` 
      })
    );
  };

  const handleDragStart = (e: React.DragEvent, asset: Asset) => {
    // Drop onto a slide directly to set background
    e.dataTransfer.setData('application/x-simpleworship-asset-bg', JSON.stringify(asset));

    // Standard schedule item payload
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
          isVideo: asset.type === 'video' || asset.type === 'motion',
          isAudio: asset.type === 'audio'
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
    <div 
      className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
      onClick={() => {
        if (playingAudioId && audioRef.current) {
          audioRef.current.pause();
        }
        onClose();
      }}
    >
      <div 
        className="w-full max-w-5xl h-[88vh] bg-[#161820] border border-[#2e3344] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] animate-in zoom-in-95 duration-150"
        onClick={(e) => {
          e.stopPropagation();
          setContextMenu(null);
        }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#252834] bg-[#1d202b] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/25 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shadow-sm">
              <Film size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white tracking-wide">Media Library</h2>
                <span className="text-[10px] font-semibold bg-[#2a2e3d] text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {filteredAssets.length} {filteredAssets.length === 1 ? 'Asset' : 'Assets'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400">
                Worship backgrounds, motion video loops, audio pads, and graphic media
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (playingAudioId && audioRef.current) {
                audioRef.current.pause();
              }
              onClose();
            }}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-[#2c303f] transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter & Action Bar (Matches screenshot layout) */}
        <div className="bg-[#1f222d] border-b border-[#262937] px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-[#14151b] p-1 rounded-lg border border-[#2f3445]">
            {filters.map((f) => (
              <button
                key={f.id}
                onClick={() => setActiveMediaFilter(f.id as any)}
                className={`px-3.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                  activeMediaFilter === f.id
                    ? 'bg-indigo-600 text-white shadow-sm font-bold'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#252936]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Search and Import Media Controls */}
          <div className="flex items-center gap-2.5 flex-1 max-w-md justify-end">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search media by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#14151b] border border-[#2f3445] rounded-lg pl-8 pr-7 py-1 text-xs text-gray-200 placeholder-gray-500 focus:outline-hidden focus:border-emerald-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,video/*,audio/*"
              multiple
              className="hidden"
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-[#2a3040] hover:bg-[#343b4f] border border-[#3e465c] text-white px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-xs active:scale-95 shrink-0"
            >
              <Upload size={13} className="text-cyan-400" />
              <span>Import Media</span>
            </button>
          </div>
        </div>

        {/* Media Grid View */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 custom-scrollbar bg-[#13141a]">
          {filteredAssets.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-[#272b38] rounded-xl text-gray-500">
              <Film size={44} className="mb-3 text-[#33384a]" />
              <h3 className="text-sm font-semibold text-gray-300 mb-1">No media files found</h3>
              <p className="text-xs text-gray-500 max-w-md mb-4">
                {searchQuery
                  ? `No media matches your search "${searchQuery}". Try different keywords.`
                  : 'Import images, video loops, or audio pads to enrich your worship presentation.'}
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow cursor-pointer"
              >
                <Upload size={13} />
                <span>Upload Media Now</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
              {filteredAssets.map((asset) => {
                const isSelected = selectedAssetId === asset.id;
                const isAudioPlaying = playingAudioId === asset.id;

                return (
                  <div
                    key={asset.id}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, asset)}
                    onClick={() => setSelectedAssetId(asset.id)}
                    onDoubleClick={() => handleAddToSchedule(asset)}
                    onContextMenu={(e) => handleContextMenu(e, asset)}
                    className={`group aspect-video rounded-xl border relative overflow-hidden cursor-grab active:cursor-grabbing transition-all flex flex-col justify-between p-2.5 shadow-md ${
                      isSelected
                        ? 'border-emerald-400 ring-2 ring-emerald-500/40 bg-[#1e2330]'
                        : 'border-[#282c3a] bg-[#1a1c24] hover:border-[#3d4458] hover:bg-[#20232e]'
                    }`}
                  >
                    {/* Media Background / Preview */}
                    {asset.type === 'video' || asset.type === 'motion' ? (
                      <div className="absolute inset-0 w-full h-full opacity-75 group-hover:opacity-95 transition-opacity pointer-events-none">
                        <LazyVideoThumbnail
                          src={asset.url}
                          poster={asset.thumbnailUrl}
                          alt={asset.name}
                        />
                      </div>
                    ) : asset.type === 'audio' ? (
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 flex flex-col items-center justify-center p-2 text-indigo-200">
                        <Music 
                          size={28} 
                          className={`text-cyan-400 mb-1 ${isAudioPlaying ? 'animate-bounce text-emerald-400' : 'animate-pulse'}`} 
                        />
                        <span className="text-[10px] font-mono text-indigo-300 tracking-wider uppercase font-semibold">
                          Audio Track
                        </span>
                      </div>
                    ) : (
                      <div
                        className="absolute inset-0 bg-cover bg-center opacity-75 group-hover:opacity-90 transition-opacity"
                        style={{ backgroundImage: `url(${asset.url})` }}
                      />
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/60 pointer-events-none"></div>

                    {/* Top Row: Type Pill & Quick Hover Actions */}
                    <div className="relative z-10 flex items-center justify-between">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/65 backdrop-blur-sm border border-white/10 uppercase tracking-wider flex items-center gap-1 text-gray-200">
                        {asset.type === 'video' || asset.type === 'motion' ? (
                          <>
                            <Film size={10} className="text-cyan-400" />
                            <span>VIDEO</span>
                          </>
                        ) : asset.type === 'audio' ? (
                          <>
                            <Music size={10} className="text-purple-400" />
                            <span>AUDIO</span>
                          </>
                        ) : (
                          <>
                            <ImageIcon size={10} className="text-amber-400" />
                            <span>IMAGE</span>
                          </>
                        )}
                      </span>

                      {/* Top Right Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {asset.type === 'audio' && (
                          <button
                            onClick={(e) => handleToggleAudio(asset, e)}
                            className="p-1 rounded-md bg-black/70 hover:bg-emerald-600 text-gray-200 hover:text-white transition-colors"
                            title={isAudioPlaying ? 'Pause Audio' : 'Preview Audio'}
                          >
                            {isAudioPlaying ? <Pause size={11} /> : <Play size={11} />}
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(asset, e)}
                          className="p-1 rounded-md bg-black/70 hover:bg-rose-600 text-gray-300 hover:text-white transition-colors cursor-pointer"
                          title="Delete Asset"
                        >
                          <Trash2 size={11} />
                        </button>
                        <div className="text-gray-400 p-0.5">
                          <GripVertical size={13} />
                        </div>
                      </div>
                    </div>

                    {/* Center Overlay Controls on Hover */}
                    <div className="relative z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 py-1">
                      <button
                        onClick={(e) => handleAddToSchedule(asset, e)}
                        className="flex items-center gap-1 bg-[#1a1f2b]/90 hover:bg-cyan-600 text-cyan-200 hover:text-white border border-cyan-500/40 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm transition-all cursor-pointer active:scale-95"
                        title="Add to current worship schedule"
                      >
                        <Plus size={10} />
                        <span>Sched</span>
                      </button>

                      <button
                        onClick={(e) => handleSendToLive(asset, e)}
                        className="flex items-center gap-1 bg-[#1a1f2b]/90 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm transition-all cursor-pointer active:scale-95"
                        title="Send directly to live projector output"
                      >
                        <Tv size={10} />
                        <span>Go Live</span>
                      </button>
                    </div>

                    {/* Bottom Row: Name and Set As Default BG Menu Button */}
                    <div className="relative z-10 flex flex-col gap-0.5">
                      {(() => {
                        const badges = getActiveDefaultBadges(asset, assetsList);
                        if (badges.length === 0) return null;
                        return (
                          <div className="flex flex-wrap gap-0.5">
                            {badges.map(b => (
                              <span key={b.scope} className={`text-[7px] font-extrabold px-1 py-0.2 rounded shadow-xs uppercase tracking-tight flex items-center gap-0.5 ${b.color}`}>
                                <Lock size={6} /> {b.label}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                      <div className="flex items-center justify-between gap-1">
                        <div className="text-[11px] font-semibold text-white truncate drop-shadow-sm flex-1" title={asset.name}>
                          {asset.name}
                        </div>

                        {/* Options Button (Also opens context menu) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const menuWidth = 230;
                            const menuHeight = 330;
                            const x = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 10);
                            const y = Math.min(rect.bottom + 4, window.innerHeight - menuHeight - 10);
                            setSelectedAssetId(asset.id);
                            setContextMenu({ x: Math.max(10, x), y: Math.max(10, y), asset });
                          }}
                          className="text-[10px] p-0.5 rounded bg-black/60 hover:bg-[#343a4e] text-gray-300 hover:text-cyan-300 border border-white/10 flex items-center gap-0.5 cursor-pointer"
                          title="Options / Set as Default (Right-click card)"
                        >
                          <ChevronDown size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer Bar */}
        <div className="bg-[#181a23] border-t border-[#252836] px-5 py-2.5 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center gap-2 text-gray-400 text-[11px]">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>
              Tip: Drag any card to the Schedule or Live outputs, or double-click to add to schedule immediately.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (playingAudioId && audioRef.current) {
                  audioRef.current.pause();
                }
                onClose();
              }}
              className="px-4 py-1.5 bg-[#272b38] hover:bg-[#32384a] text-gray-200 hover:text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer border border-[#393e50]"
            >
              Close
            </button>
            {onSelect && selectedAssetId && (
              <button
                onClick={() => {
                  const asset = assetsList.find((a) => a.id === selectedAssetId);
                  if (asset) {
                    if (playingAudioId && audioRef.current) audioRef.current.pause();
                    onSelect(asset);
                  }
                }}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-xs transition-colors cursor-pointer border border-emerald-500"
              >
                Select Selected Media
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Floating Right-Click Context Menu (Portaled/Fixed, completely immune to card overflow constraints) */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            zIndex: 999999,
          }}
          className="w-56 bg-[#181a24] border border-[#31374a] rounded-lg shadow-2xl py-1 text-xs text-gray-200 select-none animate-in fade-in duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 font-bold text-gray-300 border-b border-[#2a2e3d] flex items-center justify-between text-[11px] bg-[#12141c]">
            <span className="truncate max-w-[140px] font-semibold">{contextMenu.asset.name}</span>
            <span className="uppercase text-[9px] bg-[#222635] px-1.5 py-0.5 rounded text-gray-300 font-mono">
              {contextMenu.asset.type}
            </span>
          </div>

          <button
            onClick={() => {
              handleSendToLive(contextMenu.asset);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#252b3d] flex items-center gap-2 text-emerald-400 font-medium cursor-pointer"
          >
            <Tv size={13} className="text-emerald-400" />
            <span>Send to Live</span>
          </button>

          <button
            onClick={() => {
              handleAddToSchedule(contextMenu.asset);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#252b3d] flex items-center gap-2 text-indigo-300 font-medium cursor-pointer"
          >
            <Plus size={13} className="text-indigo-400" />
            <span>Add to Schedule</span>
          </button>

          <div className="border-t border-[#272b3a] my-1"></div>

          <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
            <span>Set Default Lock</span>
            <span className="text-[9px] text-gray-500 font-normal lowercase">1 file per category</span>
          </div>

          {/* Scope: Songs */}
          <div className="px-2 py-0.5">
            <div className={`w-full px-2 py-1 rounded flex items-center justify-between transition-colors ${
              isDefaultBgFor(contextMenu.asset, 'songs') ? 'bg-cyan-950/40 border border-cyan-500/40 text-cyan-300' : 'hover:bg-[#222738] text-gray-300'
            }`}>
              <button
                onClick={() => handleLockDefaultBg(contextMenu.asset, 'songs')}
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
                    onClick={(e) => handleUnlockDefaultBg(contextMenu.asset, 'songs', e)}
                    className="p-0.5 rounded text-gray-400 hover:text-rose-300 hover:bg-rose-950/50"
                    title="Unlock Default"
                  >
                    <Unlock size={10} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleLockDefaultBg(contextMenu.asset, 'songs')}
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
              isDefaultBgFor(contextMenu.asset, 'scriptures') ? 'bg-amber-950/40 border border-amber-500/40 text-amber-300' : 'hover:bg-[#222738] text-gray-300'
            }`}>
              <button
                onClick={() => handleLockDefaultBg(contextMenu.asset, 'scriptures')}
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
                    onClick={(e) => handleUnlockDefaultBg(contextMenu.asset, 'scriptures', e)}
                    className="p-0.5 rounded text-gray-400 hover:text-rose-300 hover:bg-rose-950/50"
                    title="Unlock Default"
                  >
                    <Unlock size={10} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleLockDefaultBg(contextMenu.asset, 'scriptures')}
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
              isDefaultBgFor(contextMenu.asset, 'logo') ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300' : 'hover:bg-[#222738] text-gray-300'
            }`}>
              <button
                onClick={() => handleLockDefaultBg(contextMenu.asset, 'logo')}
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
                    onClick={(e) => handleUnlockDefaultBg(contextMenu.asset, 'logo', e)}
                    className="p-0.5 rounded text-gray-400 hover:text-rose-300 hover:bg-rose-950/50"
                    title="Unlock Default"
                  >
                    <Unlock size={10} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleLockDefaultBg(contextMenu.asset, 'logo')}
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
              isDefaultBgFor(contextMenu.asset, 'timers') ? 'bg-teal-950/40 border border-teal-500/40 text-teal-300' : 'hover:bg-[#222738] text-gray-300'
            }`}>
              <button
                onClick={() => handleLockDefaultBg(contextMenu.asset, 'timers')}
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
                    onClick={(e) => handleUnlockDefaultBg(contextMenu.asset, 'timers', e)}
                    className="p-0.5 rounded text-gray-400 hover:text-rose-300 hover:bg-rose-950/50"
                    title="Unlock Default"
                  >
                    <Unlock size={10} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleLockDefaultBg(contextMenu.asset, 'timers')}
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
              isDefaultBgFor(contextMenu.asset, 'presentations') ? 'bg-purple-950/40 border border-purple-500/40 text-purple-300' : 'hover:bg-[#222738] text-gray-300'
            }`}>
              <button
                onClick={() => handleLockDefaultBg(contextMenu.asset, 'presentations')}
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
                    onClick={(e) => handleUnlockDefaultBg(contextMenu.asset, 'presentations', e)}
                    className="p-0.5 rounded text-gray-400 hover:text-rose-300 hover:bg-rose-950/50"
                    title="Unlock Default"
                  >
                    <Unlock size={10} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleLockDefaultBg(contextMenu.asset, 'presentations')}
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
              isDefaultBgFor(contextMenu.asset, 'announcements') ? 'bg-rose-950/40 border border-rose-500/40 text-rose-300' : 'hover:bg-[#222738] text-gray-300'
            }`}>
              <button
                onClick={() => handleLockDefaultBg(contextMenu.asset, 'announcements')}
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
                    onClick={(e) => handleUnlockDefaultBg(contextMenu.asset, 'announcements', e)}
                    className="p-0.5 rounded text-gray-400 hover:text-rose-300 hover:bg-rose-950/50"
                    title="Unlock Default"
                  >
                    <Unlock size={10} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleLockDefaultBg(contextMenu.asset, 'announcements')}
                  className="text-[10px] text-gray-400 hover:text-rose-300 font-semibold px-1 rounded hover:bg-rose-950/50"
                >
                  Set Lock
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-[#272b3a] my-1"></div>

          <button
            onClick={() => {
              handleDelete(contextMenu.asset, { stopPropagation: () => {} } as any);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-rose-600 hover:text-white flex items-center gap-2 text-rose-400 transition-colors cursor-pointer"
          >
            <Trash2 size={12} />
            <span>Delete Media</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default withPortal(MediaLibraryModal);

