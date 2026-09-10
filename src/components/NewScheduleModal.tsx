import React, { useState } from 'react';
import { X, Calendar, Plus, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Schedule } from '../types';

interface NewScheduleModalProps {
  onClose: () => void;
}

const PRESETS = [
  {
    id: 'blank',
    title: 'Blank Service Schedule',
    desc: 'Clean, empty slate to build your custom worship service flow from scratch.',
    badge: 'Custom',
    icon: Plus,
    color: 'from-gray-700 to-gray-800',
    itemTypes: []
  }
];

export default function NewScheduleModal({ onClose }: NewScheduleModalProps) {
  const store = useStore();
  const [scheduleName, setScheduleName] = useState('Sunday Morning Service');
  const [selectedPreset, setSelectedPreset] = useState('blank');

  const handleCreateSchedule = () => {
    if (!scheduleName.trim()) return;

    const newSchedule: Schedule = {
      id: `sched-${Date.now()}`,
      name: scheduleName.trim(),
      createdAt: Date.now(),
      items: []
    };

    store.setActiveSchedule(newSchedule);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: `Created new schedule "${newSchedule.name}"!`
      })
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/75 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-[#1c1e24] border border-[#2d313c] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d313c] bg-gradient-to-r from-[#22252e] to-[#1c1e24]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-600/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Create New Worship Schedule</h2>
              <p className="text-xs text-gray-400">Set up service layout presets and active schedule timeline</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-[#343844] rounded-lg text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Schedule Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 uppercase tracking-wider">
              Schedule Title
            </label>
            <input
              type="text"
              value={scheduleName}
              onChange={(e) => setScheduleName(e.target.value)}
              placeholder="e.g. Sunday Morning Service - Aug 31"
              className="w-full bg-[#14151a] border border-[#343846] focus:border-cyan-500 rounded-lg px-3.5 py-2.5 text-sm text-white font-medium placeholder:text-gray-500 focus:outline-none transition-colors"
              autoFocus
            />
          </div>

          {/* Service Template Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">
              Service Template
            </label>
            <div className="grid grid-cols-1 gap-3">
              {PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isSelected = selectedPreset === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => setSelectedPreset(preset.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                      isSelected 
                        ? 'bg-[#252834] border-cyan-500 ring-2 ring-cyan-500/30 shadow-lg' 
                        : 'bg-[#181a20] border-[#2c2f3b] hover:border-gray-600 hover:bg-[#1f222b]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${preset.color} flex items-center justify-center text-white shadow`}>
                          <Icon size={16} />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/40 text-gray-300 border border-white/10">
                          {preset.badge}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white mb-1">{preset.title}</h3>
                      <p className="text-xs text-gray-400 leading-snug">{preset.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2d313c] bg-[#17191f]">
          <span className="text-xs text-gray-400">
            Current Schedule: <strong className="text-gray-200">{store.activeSchedule?.name || 'Untitled'}</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#272a34] hover:bg-[#323644] text-gray-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateSchedule}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={14} />
              <span>Create Schedule</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
