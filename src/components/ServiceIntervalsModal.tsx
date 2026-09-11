import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { X, Clock, Settings, Save, Image as ImageIcon, Check, Play, Pause, RotateCcw } from 'lucide-react';
import MediaLibraryModal from './MediaLibraryModal';
import { Asset } from '../types';

interface ServiceIntervalsModalProps {
  onClose: () => void;
}

export default function ServiceIntervalsModal({ onClose }: ServiceIntervalsModalProps) {
  const store = useStore();
  const { systemOptions, updateSystemOptions } = store;

  const currentOpts = systemOptions?.serviceIntervals || {
    countdownEnabled: false,
    countdownTime: '05:00',
    intervalType: 'Pre-Service Countdown',
    showOnMainDisplay: false,
    backgroundAssetId: '',
    isRunning: false,
    targetTimestamp: null,
    fontFamily: 'monospace',
    fontColor: '#ffffff',
  };

  const [enabled, setEnabled] = useState(currentOpts.countdownEnabled ?? false);
  const [duration, setDuration] = useState(currentOpts.countdownTime || '05:00');
  const [label, setLabel] = useState(currentOpts.intervalType || 'Pre-Service Countdown');
  const [showMain, setShowMain] = useState(currentOpts.showOnMainDisplay ?? false);
  const [bgAssetId, setBgAssetId] = useState(currentOpts.backgroundAssetId || '');
  const [fontFamily, setFontFamily] = useState(currentOpts.fontFamily || 'monospace');
  const [fontColor, setFontColor] = useState(currentOpts.fontColor || '#ffffff');
  
  const [isMediaBrowserOpen, setIsMediaBrowserOpen] = useState(false);

  const parseSeconds = (timeStr: string): number => {
    if (!timeStr) return 300;
    const parts = timeStr.trim().split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10) || 0;
      const secs = parseInt(parts[1], 10) || 0;
      return mins * 60 + secs;
    }
    const num = parseInt(timeStr, 10);
    return isNaN(num) ? 300 : num * 60;
  };

  const handleStartPause = () => {
    const isRunning = currentOpts.isRunning;
    
    // Auto-save changes when interacting with playback
    updateSystemOptions((prev) => {
      const baseOptions = {
        countdownEnabled: enabled,
        countdownTime: duration,
        intervalType: label,
        showOnMainDisplay: showMain,
        backgroundAssetId: bgAssetId,
        fontFamily,
        fontColor,
      };
      
      let newTargetTimestamp = prev.serviceIntervals?.targetTimestamp;
      if (!isRunning) {
        // Compute new target if it wasn't running
        if (!newTargetTimestamp) {
          const totalSecs = parseSeconds(duration);
          newTargetTimestamp = Date.now() + totalSecs * 1000;
        } else {
           // It was paused, resume it based on whatever remaining time there was
           // (if we wanted to be perfectly precise, we'd store remainingTime, but targetTimestamp is simpler.
           // Actually, if it's paused we should update the target to Date.now() + remainingTime.
           // For simplicity, we just set targetTimestamp anew from current duration if we pause/play.
           const totalSecs = parseSeconds(duration);
           newTargetTimestamp = Date.now() + totalSecs * 1000;
        }
      }

      return {
        ...prev,
        serviceIntervals: {
          ...baseOptions,
          isRunning: !isRunning,
          targetTimestamp: !isRunning ? newTargetTimestamp : prev.serviceIntervals?.targetTimestamp
        }
      };
    });
  };

  const handleReset = () => {
    updateSystemOptions((prev) => ({
      ...prev,
      serviceIntervals: {
        countdownEnabled: enabled,
        countdownTime: duration,
        intervalType: label,
        showOnMainDisplay: showMain,
        backgroundAssetId: bgAssetId,
        fontFamily,
        fontColor,
        isRunning: false,
        targetTimestamp: null
      }
    }));
  };

  const handleApply = () => {
    updateSystemOptions((prev) => ({
      ...prev,
      serviceIntervals: {
        ...prev.serviceIntervals,
        countdownEnabled: enabled,
        countdownTime: duration,
        intervalType: label,
        showOnMainDisplay: showMain,
        backgroundAssetId: bgAssetId,
        fontFamily,
        fontColor,
      }
    }));
    onClose();
  };

  const presets = ['03:00', '05:00', '10:00', '15:00', '30:00'];
  const quickLabels = ['Pre-Service Countdown', 'Sermon Timer', 'Offering Interval', 'Worship Transition'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#121317] border border-[#2a2d36] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col relative" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#181a20] px-4 py-3 border-b border-[#2a2d36] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-gray-200">
            <Clock size={16} className="text-amber-400" />
            <h2 className="text-sm font-bold tracking-wide">Service Interval Timers</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#252833] text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm bg-[#121317] overflow-y-auto">
          {/* Main Controls */}
          <div className="flex justify-between items-center bg-[#18191f] border border-[#323642] p-3 rounded-md">
             <div className="flex flex-col">
               <span className="font-bold text-gray-200">Timer Status: {currentOpts.isRunning ? 'Running' : 'Paused / Stopped'}</span>
               <span className="text-xs text-gray-400">Controls sync instantly to all projectors</span>
             </div>
             <div className="flex items-center gap-2">
               <button 
                 onClick={handleStartPause}
                 className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors ${currentOpts.isRunning ? 'bg-amber-600/30 text-amber-400 hover:bg-amber-600/50' : 'bg-emerald-600/30 text-emerald-400 hover:bg-emerald-600/50'}`}
               >
                 {currentOpts.isRunning ? <Pause size={12} /> : <Play size={12} />}
                 {currentOpts.isRunning ? 'Pause' : 'Start Timer'}
               </button>
               <button 
                 onClick={handleReset}
                 className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold bg-rose-600/30 text-rose-400 hover:bg-rose-600/50 transition-colors"
               >
                 <RotateCcw size={12} />
                 Reset
               </button>
             </div>
          </div>

          {/* Stage Monitor toggle */}
          <div className="bg-[#18191f] border border-[#323642] rounded-md p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-[#292c36] pb-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-200 text-sm">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="rounded accent-amber-500 w-4 h-4"
                />
                <span>Enable Countdowns on Foldback Stage Display</span>
              </label>
              <span className="text-[10px] text-gray-400 font-mono">Stage Sync</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-gray-400 block mb-1 text-xs">Duration (mm:ss)</label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="05:00"
                  className="w-full bg-[#121317] border border-[#3b404d] rounded px-3 py-1.5 text-white font-mono text-sm focus:border-amber-500 outline-none"
                />
                
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-gray-400">Presets:</span>
                  {presets.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => { setDuration(time); handleReset(); }}
                      className="px-2 py-0.5 bg-[#252833] hover:bg-[#353949] rounded text-[10px] text-gray-300 border border-[#383c4b]"
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-gray-400 block mb-1 text-xs">Interval Label / Header</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Pre-Service Countdown"
                  className="w-full bg-[#121317] border border-[#3b404d] rounded px-3 py-1.5 text-white text-sm focus:border-amber-500 outline-none"
                />
                
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-gray-400">Quick Labels:</span>
                  {quickLabels.map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => setLabel(lbl)}
                      className="px-2 py-0.5 bg-[#252833] hover:bg-[#353949] rounded text-[10px] text-gray-300 border border-[#383c4b]"
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Display toggle */}
          <div className="bg-[#18191f] border border-[#323642] rounded-md p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-[#292c36] pb-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-200 text-sm">
                <input
                  type="checkbox"
                  checked={showMain}
                  onChange={(e) => setShowMain(e.target.checked)}
                  className="rounded accent-amber-500 w-4 h-4"
                />
                <span>Render Countdown on Live Display Canvas (Main Target Monitors)</span>
              </label>
              <span className="text-[10px] text-gray-400 font-mono">Main Sync</span>
            </div>

            {showMain && (
              <div className="pt-2 space-y-4">
                <div className="grid grid-cols-2 gap-4 border-b border-[#2a2d36] pb-4">
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Font Family</label>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="w-full bg-[#121317] border border-[#3b404d] rounded-md px-2 py-1.5 text-sm text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="monospace">Monospace</option>
                      <option value="sans-serif">Sans-serif</option>
                      <option value="serif">Serif</option>
                      <option value="Inter">Inter</option>
                      <option value="Roboto">Roboto</option>
                      <option value="Montserrat">Montserrat</option>
                      <option value="Oswald">Oswald</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs block mb-1">Text Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={fontColor}
                        onChange={(e) => setFontColor(e.target.value)}
                        className="w-8 h-8 rounded border border-[#3b404d] bg-transparent cursor-pointer"
                      />
                      <span className="font-mono text-xs text-gray-400">{fontColor}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-xs">Background Image / Video</span>
                    <button 
                      className="text-xs bg-[#252833] hover:bg-[#353949] border border-[#383c4b] text-gray-200 px-2 py-1 rounded flex items-center gap-1"
                      onClick={() => setIsMediaBrowserOpen(true)}
                    >
                      <ImageIcon size={12} />
                      {bgAssetId ? 'Change Background' : 'Set Background'}
                    </button>
                  </div>
                  {bgAssetId && (
                    <div className="mt-2 text-[10px] flex items-center gap-2 bg-[#121317] p-2 border border-[#252833] rounded text-gray-300">
                      <Check size={12} className="text-green-500" />
                      Asset Selected
                      <button className="ml-auto text-red-400 hover:text-red-300" onClick={() => setBgAssetId('')}>Remove</button>
                    </div>
                  )}
                  <div className="text-[10px] text-gray-500 mt-2">
                    When enabled, this timer will render atop the selected background and overlay onto the main presentation canvas dynamically.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#181a20] px-4 py-3 border-t border-[#2a2d36] flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded transition-colors flex items-center gap-1.5"
          >
            <Save size={14} />
            Apply Settings
          </button>
        </div>
      </div>

      {isMediaBrowserOpen && (
        <MediaLibraryModal
          onClose={() => setIsMediaBrowserOpen(false)}
          onSelect={(asset: Asset) => {
            setBgAssetId(asset.id);
            setIsMediaBrowserOpen(false);
          }}
        />
      )}
    </div>
  );
}
