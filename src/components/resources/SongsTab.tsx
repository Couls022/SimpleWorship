import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Music, 
  Edit3, 
  Trash2, 
  GripVertical, 
  Copy, 
  Tag, 
  PlusCircle, 
  Sparkles,
  Download,
  Upload
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Song } from '../../types';
import { handleRangeSelection } from '../../utils/selectionUtils';

interface SongsTabProps {
  onOpenNewSong: () => void;
  onEditSong: (song: Song) => void;
}

const CATEGORIES = ['All', 'Hymns', 'Special Number'] as const;
type CategoryType = typeof CATEGORIES[number];

export default function SongsTab({ onOpenNewSong, onEditSong }: SongsTabProps) {
  const store = useStore();
  const { songsList, addScheduleItem, addSong, deleteSong } = store;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>(() => songsList[0]?.id ? [songsList[0].id] : []);
  const [anchorSongId, setAnchorSongId] = useState<string | null>(() => songsList[0]?.id || null);
  const [activeCategory, setActiveCategory] = useState<CategoryType>('All');

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    song: Song;
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

  const searchInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportSongs = () => {
    try {
      const songsData = JSON.stringify(songsList, null, 2);
      const blob = new Blob([songsData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `simpleworship_songs_${new Date().toISOString().split('T')[0]}.sws`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Exported ${songsList.length} songs successfully.` }));
    } catch (err) {
      console.error('Failed to export songs:', err);
      window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Failed to export songs.' }));
    }
  };

  const handleImportSongs = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const importedSongs: Song[] = JSON.parse(content);
        
        if (!Array.isArray(importedSongs)) {
          throw new Error("Invalid format: expected an array of songs.");
        }

        const validSongs = importedSongs.filter(s => s.id && s.title && Array.isArray(s.sections));

        if (validSongs.length === 0) {
          throw new Error("No valid songs found in the file.");
        }

        for (const song of validSongs) {
          await addSong(song);
        }

        window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Imported ${validSongs.length} songs successfully.` }));
      } catch (err) {
        console.error('Failed to import songs:', err);
        window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Failed to import songs. Please ensure it is a valid .sws file.` }));
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    const handleFocusSearch = (e: CustomEvent) => {
      if (e.detail?.target === 'songs' || !e.detail?.target) {
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('simpleworship:focus-search' as any, handleFocusSearch);
    return () => window.removeEventListener('simpleworship:focus-search' as any, handleFocusSearch);
  }, []);

  const getNormalizedCategory = (song: Song): 'Hymns' | 'Special Number' => {
    const cat = (song.category || '').toLowerCase();
    if (cat === 'special number' || cat === 'special' || (song.tags && song.tags.some(t => t.toLowerCase().includes('special')))) {
      return 'Special Number';
    }
    return 'Hymns';
  };

  const filteredSongs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return songsList.filter((s) => {
      const songCat = getNormalizedCategory(s);

      let matchCat = true;
      if (activeCategory === 'Hymns') {
        matchCat = songCat === 'Hymns';
      } else if (activeCategory === 'Special Number') {
        matchCat = songCat === 'Special Number';
      }

      const matchSearch = !q || 
        s.title.toLowerCase().includes(q) || 
        (s.author && s.author.toLowerCase().includes(q)) || 
        (s.category && s.category.toLowerCase().includes(q)) ||
        (s.lyrics && s.lyrics.toLowerCase().includes(q)) ||
        (s.sections && s.sections.some(sec => sec.text.toLowerCase().includes(q) || sec.name.toLowerCase().includes(q))) ||
        (s.ccli && s.ccli.includes(q)) ||
        (s.ccliNumber && s.ccliNumber.includes(q)) ||
        (s.tags && s.tags.some(tag => tag.toLowerCase().includes(q)));

      return matchCat && matchSearch;
    });
  }, [songsList, activeCategory, searchQuery]);

  const handleAddToSchedule = (song: Song) => {
    store.addScheduleItem({
      type: 'song',
      contentId: song.id,
      name: song.title,
      notes: song.author ? `Key of ${song.key || 'G'} • By ${song.author}` : undefined,
      customBackgroundUrl: song.defaultBackgroundUrl,
      themeOverride: song.themeOverride,
      data: {
        songId: song.id,
        title: song.title,
        author: song.author,
        key: song.key,
        lyrics: song.lyrics,
        sections: song.sections,
        ccliNumber: song.ccliNumber
      }
    });
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Added "${song.title}" to schedule!` 
      })
    );
  };

  // Drag-and-drop start handler with full metadata
  const handleDragStart = (e: React.DragEvent, song: Song) => {
    const payload = {
      type: 'song',
      item: {
        id: `song-${song.id}-${Date.now()}`,
        type: 'song',
        contentId: song.id,
        name: song.title,
        notes: song.author ? `Key of ${song.key || 'G'} • By ${song.author}` : undefined,
        customBackgroundUrl: song.defaultBackgroundUrl,
        themeOverride: song.themeOverride,
        data: {
          songId: song.id,
          title: song.title,
          author: song.author,
          key: song.key,
          lyrics: song.lyrics,
          sections: song.sections,
          ccliNumber: song.ccliNumber
        }
      }
    };
    const jsonStr = JSON.stringify(payload);
    e.dataTransfer.setData('application/json', jsonStr);
    e.dataTransfer.setData('application/x-simpleworship-item', jsonStr);
    e.dataTransfer.setData('text/plain', song.title);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleSongClick = (e: React.MouseEvent, song: Song) => {
    const { selectedIds, anchorId } = handleRangeSelection(
      filteredSongs,
      selectedSongIds,
      song.id,
      e,
      anchorSongId
    );
    setSelectedSongIds(selectedIds);
    setAnchorSongId(anchorId);
  };

  const handleContextMenu = (e: React.MouseEvent, song: Song) => {
    e.preventDefault();
    if (!selectedSongIds.includes(song.id)) {
      setSelectedSongIds([song.id]);
      setAnchorSongId(song.id);
    }
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 220),
      y: Math.min(e.clientY, window.innerHeight - 240),
      song
    });
  };

  return (
    <div className="flex flex-col h-full bg-[#181a1f] text-gray-200 select-none text-xs relative">
      {/* Top Search & Category Filter Bar */}
      <div className="h-10 bg-[#22252c] border-b border-[#15161a] flex items-center justify-between px-3 gap-3 shrink-0">
        <div className="flex items-center gap-3 flex-1 overflow-hidden">
          {/* 1. Song Search Input */}
          <div className="relative w-64 sm:w-80 md:w-96 shrink-0">
            <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search song title, author, lyrics, CCLI#..."
              className="w-full bg-[#141519] border border-[#373c49] focus:border-cyan-500 rounded pl-8 pr-7 py-1 text-xs text-gray-100 placeholder-gray-500 focus:outline-none transition-colors shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-gray-400 hover:text-white p-0.5 text-[10px]"
                title="Clear Search"
              >
                ✕
              </button>
            )}
          </div>

          {/* 2. + New Song Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenNewSong();
            }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-3 py-1.5 rounded text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer"
            title="Create New Song in SimpleWorship Slide Editor (Ctrl+N)"
          >
            <Plus size={13} strokeWidth={2.5} />
            <span>New Song</span>
          </button>

          {/* 3. Category Filter Buttons: Strictly All, Hymns, Special Number */}
          <div className="flex items-center gap-1 shrink-0 bg-[#16181e] p-1 rounded-lg border border-[#2d3240]">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-cyan-600 text-white shadow-xs font-bold'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-[#252936]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* 4. Import / Export Data */}
          <div className="flex items-center gap-1.5 shrink-0 ml-1 relative z-10">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-[#252833] hover:bg-[#2c303d] active:bg-[#1e2029] border border-[#383d4e] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all text-gray-300 cursor-pointer pointer-events-auto"
              title="Import Songs Data (.sws)"
            >
              <Upload size={13} className="text-cyan-400 pointer-events-none" />
              <span className="pointer-events-none">Import</span>
            </button>
            <input 
              type="file" 
              accept=".sws" 
              ref={fileInputRef} 
              onChange={handleImportSongs} 
              className="hidden" 
            />
            <button
              type="button"
              onClick={handleExportSongs}
              className="flex items-center gap-1.5 bg-[#252833] hover:bg-[#2c303d] active:bg-[#1e2029] border border-[#383d4e] px-3 py-1.5 rounded-lg text-xs font-semibold transition-all text-gray-300 cursor-pointer pointer-events-auto"
              title="Export Songs Data (.sws)"
            >
              <Download size={13} className="text-indigo-400 pointer-events-none" />
              <span className="pointer-events-none">Export</span>
            </button>
          </div>
        </div>

        {/* Right side song count badge */}
        <div className="text-[11px] text-gray-400 font-mono shrink-0 hidden sm:flex items-center gap-1.5 bg-[#171920] px-2.5 py-1 rounded border border-[#2b2f3d]">
          <span className="text-cyan-400 font-bold">{filteredSongs.length}</span>
          <span>/</span>
          <span>{songsList.length} songs</span>
        </div>
      </div>

      {/* Main Full-Width Song Table (Right preview pane removed as requested) */}
      <div className="flex-1 flex flex-col bg-[#141519] overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 h-8 bg-[#20232a] border-b border-[#282b34] text-[11px] font-bold text-gray-400 px-3 items-center shrink-0">
          <div className="col-span-1 flex items-center justify-center">#</div>
          <div className="col-span-4">Title (Drag to Schedule)</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2">Author / Composer</div>
          <div className="col-span-1 text-center">Key</div>
          <div className="col-span-2 text-right pr-2">Actions</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#1e2027] custom-scrollbar">
          {filteredSongs.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-xs flex flex-col items-center justify-center gap-2">
              <Music size={28} className="text-gray-600" />
              <span>No songs found in "{activeCategory}".</span>
              <button
                onClick={onOpenNewSong}
                className="mt-2 text-cyan-400 hover:underline font-semibold"
              >
                + Create new song in this category
              </button>
            </div>
          ) : (
            filteredSongs.map((song, idx) => {
              const isSelected = selectedSongIds.includes(song.id);
              const normalizedCat = getNormalizedCategory(song);

              return (
                <div
                  key={song.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, song)}
                  onClick={(e) => handleSongClick(e, song)}
                  onDoubleClick={() => handleAddToSchedule(song)}
                  onContextMenu={(e) => handleContextMenu(e, song)}
                  className={`grid grid-cols-12 px-3 py-2 cursor-grab active:cursor-grabbing text-xs transition-colors items-center group ${
                    isSelected
                      ? 'bg-[#22334d] text-white font-medium border-l-2 border-l-cyan-400 ring-1 ring-cyan-500/30'
                      : 'hover:bg-[#1c1e25] text-gray-300'
                  }`}
                >
                  {/* Grip & Index */}
                  <div className="col-span-1 flex items-center gap-1.5 text-gray-500 group-hover:text-gray-300">
                    <GripVertical size={13} className="shrink-0" />
                    <span className="font-mono text-[10px] text-gray-500">{idx + 1}</span>
                  </div>

                  {/* Title */}
                  <div className="col-span-4 flex items-center gap-2 font-semibold text-cyan-200 truncate pr-2">
                    <Music size={13} className="text-cyan-400 shrink-0" />
                    <span className="truncate">{song.title}</span>
                  </div>

                  {/* Category Badge */}
                  <div className="col-span-2 truncate">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border truncate max-w-full ${
                      normalizedCat === 'Special Number'
                        ? 'bg-purple-950/80 text-purple-300 border-purple-800/80'
                        : 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80'
                    }`}>
                      {normalizedCat}
                    </span>
                  </div>

                  {/* Author */}
                  <div className="col-span-2 text-gray-400 truncate pr-2">{song.author || '—'}</div>

                  {/* Key */}
                  <div className="col-span-1 text-center">
                    {song.key ? (
                      <span className="px-1.5 py-0.5 rounded bg-[#1e222d] text-amber-300 font-mono text-[10px] border border-[#303547]">
                        {song.key}
                      </span>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="col-span-2 flex items-center justify-end gap-1.5 pr-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToSchedule(song);
                      }}
                      className="px-2 py-1 bg-[#232734] hover:bg-indigo-600 hover:text-white text-gray-300 rounded text-[10px] font-bold transition-colors cursor-pointer border border-[#343b4f]"
                      title="Add to Service Schedule"
                    >
                      + Sched
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditSong(song);
                      }}
                      className="p-1 hover:bg-[#343a4d] text-gray-400 hover:text-cyan-300 rounded transition-colors cursor-pointer"
                      title="Edit Song"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSong(song.id);
                        window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Deleted "${song.title}"` }));
                      }}
                      className="p-1 hover:bg-rose-600 text-gray-400 hover:text-white rounded transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                      title="Delete Song"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right-Click Context Menu for Songs */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-[#1c1f28] border border-[#373c4d] rounded-md shadow-2xl py-1 w-52 text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
        >
          <div className="px-3 py-1 font-bold text-cyan-300 border-b border-[#2a2e3d] text-[11px] truncate">
            {contextMenu.song.title}
          </div>

          <button
            onClick={() => {
              onEditSong(contextMenu.song);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2"
          >
            <Edit3 size={12} className="text-cyan-400" />
            <span>Edit in Song Editor</span>
          </button>

          <button
            onClick={() => {
              handleAddToSchedule(contextMenu.song);
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
              const dup: Song = {
                ...contextMenu.song,
                id: `song-${Date.now()}`,
                title: `${contextMenu.song.title} (Copy)`
              };
              addSong(dup);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-[#2e3447] flex items-center gap-2"
          >
            <Copy size={12} className="text-gray-400" />
            <span>Duplicate Song</span>
          </button>

          <button
            onClick={() => {
              deleteSong(contextMenu.song.id);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-rose-600 hover:text-white flex items-center gap-2 text-rose-300"
          >
            <Trash2 size={12} />
            <span>Delete Song</span>
          </button>
        </div>
      )}
    </div>
  );
}
