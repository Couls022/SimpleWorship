import React, { useState } from 'react';
import { X, Save } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Song } from '../types';

interface SimpleSongEditorProps {
  song?: Song | null;
  onClose: () => void;
}

export default function SimpleSongEditor({ song, onClose }: SimpleSongEditorProps) {
  const store = useStore();
  const [title, setTitle] = useState(song?.title || '');
  const [author, setAuthor] = useState(song?.author || '');
  const [musicalKey, setMusicalKey] = useState(song?.key || '');
  const [ccli, setCcli] = useState(song?.ccliNumber || song?.ccli || '');
  const [lyrics, setLyrics] = useState(() => {
    if (song?.lyrics) return song.lyrics;
    if (song?.sections && song.sections.length > 0) {
      return song.sections.map(s => `[${s.name}]\n${s.text}`).join('\n\n');
    }
    return '';
  });

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Title is required');
      return;
    }

    const updatedSong: Song = {
      ...song,
      id: song?.id || `song-${Date.now()}`,
      title: title.trim(),
      author: author.trim(),
      key: musicalKey.trim(),
      ccliNumber: ccli.trim(),
      ccli: ccli.trim(),
      lyrics: lyrics.trim(),
      // Auto-parse sections for the existing player logic
      sections: parseLyricsToSections(lyrics.trim())
    };

    await store.addSong(updatedSong);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Song "${updatedSong.title}" saved successfully!` 
      })
    );
    onClose();
  };

  const parseLyricsToSections = (raw: string) => {
    const lines = raw.split('\n');
    const sections = [];
    let currentLabel = 'Verse 1';
    let currentLines: string[] = [];

    const flush = () => {
      const text = currentLines.join('\n').trim();
      if (text) {
        sections.push({ id: `sec-${Date.now()}-${Math.random()}`, name: currentLabel, text });
      }
      currentLines = [];
    };

    for (const line of lines) {
      const match = line.trim().match(/^\[(.*?)\]$/);
      if (match) {
        flush();
        currentLabel = match[1];
      } else {
        currentLines.push(line);
      }
    }
    flush();
    return sections;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#1c1e24] border border-[#2d313e] rounded-xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden text-gray-200 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d313e] bg-[#22252c]">
          <h2 className="text-lg font-bold text-cyan-400">
            {song ? 'Edit Song' : 'Add New Song'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-[#343844] rounded-md text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[80vh] custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-400">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Amazing Grace"
                className="bg-[#141519] border border-[#323644] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-400">Author</label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. John Newton"
                className="bg-[#141519] border border-[#323644] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-400">Musical Key</label>
              <input
                type="text"
                value={musicalKey}
                onChange={(e) => setMusicalKey(e.target.value)}
                placeholder="e.g. G"
                className="bg-[#141519] border border-[#323644] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-400">CCLI / Copyright</label>
              <input
                type="text"
                value={ccli}
                onChange={(e) => setCcli(e.target.value)}
                placeholder="e.g. 123456"
                className="bg-[#141519] border border-[#323644] rounded-md px-3 py-2 text-sm focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mt-2 flex-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-400">Lyrics</label>
              <span className="text-[10px] text-gray-500">Use [Verse 1], [Chorus] to separate slides</span>
            </div>
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder="[Verse 1]\nAmazing grace how sweet the sound...\n\n[Chorus]\n..."
              className="w-full bg-[#141519] border border-[#323644] rounded-md px-3 py-3 text-sm font-mono resize-none focus:outline-none focus:border-cyan-500 transition-colors min-h-[300px] custom-scrollbar"
            />
          </div>
        </div>

        <div className="flex items-center justify-end px-6 py-4 border-t border-[#2d313e] bg-[#22252c] gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-transparent hover:bg-[#343844] rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors flex items-center gap-2 shadow-lg shadow-cyan-900/20"
          >
            <Save size={16} />
            Save Song
          </button>
        </div>
      </div>
    </div>
  );
}
