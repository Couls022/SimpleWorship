import React, { useState, useEffect, useRef } from 'react';
import { X, FolderOpen, Upload, Trash2, Check, Clock, FileText, Search, Plus, Calendar, Download, Sparkles, PackageCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import { dbApi } from '../db';
import { Schedule } from '../types';
import { readSwsFile, downloadSwsFile } from '../services/swsService';
import SimpleWorshipLogo from './SimpleWorshipLogo';

interface OpenScheduleModalProps {
  onClose: () => void;
}

export default function OpenScheduleModal({ onClose }: OpenScheduleModalProps) {
  const store = useStore();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSchedules();
  }, []);

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const list = await dbApi.getAllSchedules();
      // Also include active store schedule if not saved yet
      if (store.activeSchedule && !list.find(s => s.id === store.activeSchedule?.id)) {
        list.push(store.activeSchedule);
      }
      setSchedules(list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    } catch (e) {
      console.error('Error fetching schedules:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSchedule = async (schedule: Schedule) => {
    store.setActiveSchedule(schedule);
    await dbApi.addSchedule(schedule).catch(() => {});
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: `Loaded schedule "${schedule.name}" with ${schedule.items.length} items!`
      })
    );
    onClose();
  };

  const handleDeleteSchedule = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const db = await (await import('../db')).getDB();
      await db.delete('schedules', id);
      setSchedules(prev => prev.filter(s => s.id !== id));
      if (store.activeSchedule?.id === id) {
        store.setActiveSchedule({
          id: `sched-${Date.now()}`,
          name: 'Blank Schedule',
          createdAt: Date.now(),
          items: []
        });
      }
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { detail: `Deleted schedule "${name}"` })
      );
    } catch (e) {
      console.error('Error deleting schedule', e);
    }
  };

  const processFile = async (file: File) => {
    try {
      const { schedule, bundledSongs, bundledThemes, systemOptions, outputGroups } = await readSwsFile(file);

      // Save imported bundled songs if any
      if (bundledSongs && bundledSongs.length > 0) {
        for (const song of bundledSongs) {
          await dbApi.addSong(song).catch(() => {});
        }
      }

      // Save imported bundled themes if any
      if (bundledThemes && bundledThemes.length > 0) {
        for (const thm of bundledThemes) {
          await dbApi.addTheme(thm).catch(() => {});
        }
      }
      
      if (systemOptions) {
        store.updateSystemOptions(systemOptions);
      }
      
      if (outputGroups && outputGroups.length > 0) {
        store.setOutputGroups(outputGroups);
      }

      await dbApi.addSchedule(schedule);
      store.setActiveSchedule(schedule);
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', {
          detail: `Successfully imported .sws schedule "${schedule.name}" (${schedule.items.length} items)!`
        })
      );
      onClose();
    } catch (err: any) {
      console.error('Failed to import file:', err);
      alert(`Could not open file: ${err.message || 'Invalid format'}`);
    }
  };

  const handleImportClick = async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.openSwsFile) {
      try {
        const res = await window.electronAPI.openSwsFile();
        if (!res.canceled && res.data) {
          const fileName = res.filePath ? res.filePath.split(/[/\\]/).pop() || 'Imported.sws' : 'Imported.sws';
          const blob = new Blob([res.data]);
          const file = new File([blob], fileName);
          await processFile(file);
          return;
        }
        if (res.canceled) return;
      } catch (e) {
        console.warn('Native open failed, falling back to input', e);
      }
    }
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const filtered = schedules.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/75 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-[#1c1e24] border border-[#2d313c] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150 select-none text-gray-200"
        onClick={(e) => e.stopPropagation()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {/* Hidden File Input for .sws and .json import */}
        <input 
          ref={fileInputRef}
          type="file"
          accept=".sws"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d313c] bg-[#22252e]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <FolderOpen size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Open Saved Schedule (.sws)</h2>
              <p className="text-xs text-gray-400">Manage, preview, or import worship schedules from database & disk</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-[#343844] rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search & Actions Bar */}
        <div className="flex items-center justify-between gap-3 px-6 py-3 border-b border-[#2d313c] bg-[#1a1c22]">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search saved schedules..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#121317] border border-[#2d313c] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors font-medium"
            />
          </div>

          <button
            onClick={handleImportClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#252834] hover:bg-[#303545] border border-[#373c4d] text-cyan-300 rounded-lg text-xs font-semibold transition-colors shrink-0"
            title="Import .sws schedule file from computer"
          >
            <Upload size={13} />
            <span>Import .sws File</span>
          </button>
        </div>

        {/* Drag & Drop Overlay indicator */}
        {dragOver && (
          <div className="bg-cyan-950/80 border-2 border-dashed border-cyan-400 p-6 text-center text-cyan-200 text-xs font-bold animate-pulse">
            Drop your .sws schedule file here to import immediately!
          </div>
        )}

        {/* Schedule List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-[#161820]">
          {loading ? (
            <div className="text-center py-12 text-gray-500 text-xs">Loading schedules...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <p className="text-gray-400 text-xs font-medium">No saved schedules found.</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-cyan-400 hover:text-cyan-300 underline font-medium"
              >
                Import a .sws schedule file from your computer
              </button>
            </div>
          ) : (
            filtered.map((sched) => {
              const isActive = store.activeSchedule?.id === sched.id;
              const dateStr = sched.createdAt 
                ? new Date(sched.createdAt).toLocaleDateString(undefined, { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) 
                : 'Unknown date';

              return (
                <div
                  key={sched.id}
                  onClick={() => handleSelectSchedule(sched)}
                  className={`group flex items-center justify-between p-3.5 rounded-lg border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-cyan-950/40 border-cyan-500/60 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                      : 'bg-[#1e2029] border-[#292d37] hover:border-[#3d4251] hover:bg-[#252834]'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border relative overflow-hidden transition-all ${
                      isActive 
                        ? 'bg-cyan-500/20 border-cyan-400 shadow-md shadow-cyan-500/20' 
                        : 'bg-[#12141a] border-[#2c3240] group-hover:border-cyan-500/50 group-hover:bg-[#1a1e28]'
                    }`}>
                      <SimpleWorshipLogo size={24} showText={false} variant="icon" />
                      <span className="absolute bottom-0 right-0 left-0 bg-[#061e29] text-[7px] font-black text-cyan-300 font-mono text-center tracking-tighter border-t border-cyan-500/40 uppercase">
                        SWS
                      </span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-xs text-white truncate group-hover:text-cyan-300 transition-colors">
                          {sched.name}
                        </h3>
                        <span className="px-1.5 py-0.2 rounded bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 font-mono text-[9px] font-bold">
                          .sws
                        </span>
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-bold">
                            Active
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-1 text-[11px] text-gray-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock size={11} className="text-gray-500" />
                          {dateStr}
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="font-mono text-gray-300 font-semibold">
                          {sched.items.length} {sched.items.length === 1 ? 'item' : 'items'}
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="text-[10px] text-cyan-400/90 font-medium">
                          Enterprise Archive
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                    {/* Quick export .sws button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadSwsFile(sched);
                        window.dispatchEvent(
                          new CustomEvent('simpleworship:notify', { detail: `Exported "${sched.name}.sws"` })
                        );
                      }}
                      className="p-1.5 rounded-md text-gray-400 hover:text-cyan-300 hover:bg-cyan-950/50 transition-colors"
                      title="Download as .sws file"
                    >
                      <Download size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDeleteSchedule(sched.id, sched.name, e)}
                      className="p-1.5 rounded-md text-gray-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                      title="Delete Schedule from Database"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#2d313c] bg-[#1e2029] flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {schedules.length} saved {schedules.length === 1 ? 'schedule' : 'schedules'} in offline database
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-[#2b2e3a] hover:bg-[#373b4a] text-gray-300 text-xs font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
