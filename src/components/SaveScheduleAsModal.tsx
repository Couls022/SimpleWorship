import { withPortal } from './common/withPortal';
import React, { useState, useEffect, useRef } from 'react';
import { X, Save, FileText, Check, Download } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Schedule } from '../types';
import { dbApi } from '../db';
import { downloadSwsFile } from '../services/swsService';

interface SaveScheduleAsModalProps {
  onClose: () => void;
}

function SaveScheduleAsModal({ onClose }: SaveScheduleAsModalProps) {
  const store = useStore();
  const { activeSchedule, setActiveSchedule, systemOptions, outputGroups } = store;
  
  const [scheduleName, setScheduleName] = useState(
    activeSchedule?.name || 'Sunday Morning Service'
  );
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = scheduleName.trim() || 'Worship Schedule';
    
    setIsSaving(true);
    try {
      const updated: Schedule = {
        ...(activeSchedule || { id: `sched-${Date.now()}`, items: [] }),
        id: `sched-${Date.now()}`,
        name: finalName,
        createdAt: Date.now()
      };
      
      await dbApi.addSchedule(updated);
      setActiveSchedule(updated);
      
      const allSongs = await dbApi.getAllSongs();
      const allThemes = await dbApi.getAllThemes();
      const usedSongIds = new Set(
        updated.items.filter(it => it.type === 'song').map(it => it.contentId || it.id)
      );
      const bundledSongs = allSongs.filter(s => usedSongIds.has(s.id));
      
      await downloadSwsFile(updated, finalName, bundledSongs, allThemes, systemOptions, outputGroups);
      
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', {
          detail: `Schedule saved as "${finalName}.sws" with all assets & branding!`
        })
      );
      onClose();
    } catch (err: any) {
      console.error('Save schedule as error:', err);
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', {
          detail: `Failed to save schedule: ${err.message || err}`
        })
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#1c1f26] border border-[#2d313a] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2d313a] bg-[#16181e]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-950/80 border border-blue-700/60 text-blue-400">
              <Save size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Save Schedule As</h3>
              <p className="text-[11px] text-gray-400">Export and store with a new service name</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1 rounded text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Service Schedule Name
            </label>
            <input
              ref={inputRef}
              type="text"
              value={scheduleName}
              onChange={(e) => setScheduleName(e.target.value)}
              placeholder="e.g. Sunday Morning Service"
              className="w-full bg-[#14161c] border border-[#3b404d] focus:border-blue-400 rounded-lg px-3.5 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div className="p-3 rounded-lg bg-[#22252e] border border-[#2e3340] text-xs text-gray-300 space-y-1">
            <div className="flex items-center gap-1.5 text-blue-300 font-medium">
              <Download size={13} />
              <span>Embedded Package (.sws)</span>
            </div>
            <p className="text-[11px] text-gray-400">
              The schedule will be stored in your local library and downloaded as a standalone portable <code className="text-cyan-300 font-mono">.sws</code> file with songs, backgrounds, and themes included.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2d313a]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-[#2a2e38] text-gray-300 hover:text-white text-xs font-medium cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md cursor-pointer transition-all active:scale-95 disabled:opacity-50"
            >
              <Save size={13} />
              <span>{isSaving ? 'Saving...' : 'Save & Download (.sws)'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}

export default withPortal(SaveScheduleAsModal);
