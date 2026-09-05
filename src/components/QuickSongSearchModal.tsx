import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Plus, Play, Music, Tv } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Song } from '../types';
import { OfflineSearchEngine } from '../core/OfflineSearchEngine';

interface QuickSongSearchModalProps {
  onClose: () => void;
}

export default function QuickSongSearchModal({ onClose }: QuickSongSearchModalProps) {
  const store = useStore();
  const { songsList, addScheduleItem } = store;
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredSongs = OfflineSearchEngine.filterSongs(songsList, search);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredSongs.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredSongs[selectedIndex]) {
          handleAddToSchedule(filteredSongs[selectedIndex]);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredSongs, selectedIndex, onClose]);

  // Auto-scroll to selected item
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        const parentRect = listRef.current.getBoundingClientRect();
        const elRect = selectedEl.getBoundingClientRect();
        if (elRect.bottom > parentRect.bottom) {
          listRef.current.scrollTop += (elRect.bottom - parentRect.bottom);
        } else if (elRect.top < parentRect.top) {
          listRef.current.scrollTop -= (parentRect.top - elRect.top);
        }
      }
    }
  }, [selectedIndex]);

  const handleAddToSchedule = (song: Song) => {
    store.addScheduleItem({
      type: 'song',
      contentId: song.id,
      name: song.title,
      notes: song.author ? `Key of ${song.key || 'G'} • By ${song.author}` : undefined,
      customBackgroundUrl: song.defaultBackgroundUrl
    });
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Added "${song.title}" to schedule!` 
      })
    );
  };

  const handleSendToLive = (song: Song, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const itemId = `song-${song.id}-${Date.now()}`;
    const item = {
      id: itemId,
      type: 'song' as const,
      contentId: song.id,
      name: song.title,
      notes: song.author ? `Key of ${song.key || 'G'} • By ${song.author}` : undefined,
      customBackgroundUrl: song.defaultBackgroundUrl
    };
    store.setRoutingRequest({ item, isNew: true, slideIndex: 0 });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/75 flex items-start justify-center pt-24 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-[#1c1e24] border border-[#2d3039] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-top-10 zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2d3039] bg-[#22252c]">
          <Search size={20} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search songs by title, lyrics, or author..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-lg text-white font-medium placeholder:text-gray-500 focus:outline-none"
          />
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-[#343844] rounded-md text-gray-400 hover:text-white transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div 
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto"
        >
          {filteredSongs.length > 0 ? (
            <div className="py-2">
              {filteredSongs.map((song, idx) => (
                <div
                  key={song.id}
                  onClick={() => {
                    setSelectedIndex(idx);
                  }}
                  onDoubleClick={() => handleAddToSchedule(song)}
                  className={`flex items-center px-4 py-2 cursor-pointer group border-l-2 ${
                    idx === selectedIndex 
                      ? 'bg-[#2a2e38] border-indigo-500' 
                      : 'border-transparent hover:bg-[#252831]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 mr-3 ${
                    idx === selectedIndex ? 'bg-indigo-600/30 text-indigo-400' : 'bg-[#181a1f] text-gray-500 group-hover:text-gray-400'
                  }`}>
                    <Music size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-gray-100 flex items-center gap-2">
                      {song.title}
                      {song.key && (
                        <span className="px-1.5 py-0.5 bg-[#1e2129] border border-[#2d3039] rounded text-[9px] text-gray-400 font-mono">
                          {song.key}
                        </span>
                      )}
                    </div>
                    {song.lyrics && (
                      <div className="text-[11px] text-gray-400 truncate mt-0.5 font-serif italic">
                        "{song.lyrics.substring(0, 100).replace(/\n/g, ' ')}..."
                      </div>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className={`flex items-center gap-2 shrink-0 ${idx === selectedIndex ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToSchedule(song);
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2d3039] hover:bg-[#3b3f4d] border border-[#404554] text-gray-200 text-xs font-semibold rounded transition-colors"
                    >
                      <Plus size={14} />
                      <span>Add</span>
                    </button>
                    <button
                      onClick={(e) => handleSendToLive(song, e)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded transition-colors shadow-sm"
                    >
                      <Play size={14} className="fill-white" />
                      <span>Live</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center text-gray-500">
              <Search size={32} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">No songs found matching "{search}"</p>
              <p className="text-xs mt-1">Try searching by lyrics or check the Songs tab to add new ones.</p>
            </div>
          )}
        </div>
        
        <div className="px-4 py-2 border-t border-[#2d3039] bg-[#181a1f] flex items-center justify-between text-[10px] text-gray-500 font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><kbd className="bg-[#2d3039] px-1.5 py-0.5 rounded text-gray-300 font-mono">↑</kbd> <kbd className="bg-[#2d3039] px-1.5 py-0.5 rounded text-gray-300 font-mono">↓</kbd> to navigate</span>
            <span className="flex items-center gap-1"><kbd className="bg-[#2d3039] px-1.5 py-0.5 rounded text-gray-300 font-mono">Enter</kbd> to add</span>
          </div>
          <div>
            <kbd className="bg-[#2d3039] px-1.5 py-0.5 rounded text-gray-300 font-mono">Esc</kbd> to close
          </div>
        </div>
      </div>
    </div>
  );
}
