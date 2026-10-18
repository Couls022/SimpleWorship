import { withPortal } from './common/withPortal';
import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { X, Clock, Save, Image as ImageIcon, Check, Play, Pause, RotateCcw, Minus, Plus, RefreshCw, Type, Sliders } from 'lucide-react';
import MediaLibraryModal from './MediaLibraryModal';
import { Asset } from '../types';
import { SystemFontPicker } from './common/SystemFontPicker';
import { queryNativeSystemFonts } from '../utils/systemFonts';

interface ServiceIntervalsModalProps {
  onClose: () => void;
}

const MAIN_SIZE_PRESETS = [
  { label: 'S', value: 200, desc: '200px' },
  { label: 'M', value: 320, desc: '320px' },
  { label: 'L', value: 440, desc: '440px (Default)' },
  { label: 'XL', value: 540, desc: '540px' },
  { label: 'MAX', value: 640, desc: '640px' },
];

const STAGE_SIZE_PRESETS = [
  { label: 'S', value: 14, desc: '14px' },
  { label: 'M', value: 20, desc: '20px' },
  { label: 'L', value: 28, desc: '28px' },
  { label: 'XL', value: 42, desc: '42px' },
  { label: 'MAX', value: 64, desc: '64px' },
];

function ServiceIntervalsModal({ onClose }: ServiceIntervalsModalProps) {
  const systemOptions = useStore(state => state.systemOptions);

  const currentOpts = systemOptions?.serviceIntervals || {
    countdownEnabled: false,
    countdownTime: '05:00',
    intervalType: 'Pre-Service Countdown',
    showOnMainDisplay: false,
    backgroundAssetId: '',
    isRunning: false,
    targetTimestamp: null,
    pausedRemainingSecs: null,
    fontFamily: 'Segoe UI, sans-serif',
    fontColor: '#ffffff',
    fontSize: 440,
    independentStageSize: false,
    stageTimerSize: 16,
  };

  const [enabled, setEnabled] = useState(currentOpts.countdownEnabled ?? false);
  const [duration, setDuration] = useState(currentOpts.countdownTime || '05:00');
  const [label, setLabel] = useState(currentOpts.intervalType || 'Pre-Service Countdown');
  const [showMain, setShowMain] = useState(currentOpts.showOnMainDisplay ?? false);
  const [bgAssetId, setBgAssetId] = useState(currentOpts.backgroundAssetId || '');
  const [fontFamily, setFontFamily] = useState(currentOpts.fontFamily || 'Segoe UI, sans-serif');
  const [fontColor, setFontColor] = useState(currentOpts.fontColor || '#ffffff');
  const [fontSize, setFontSize] = useState<number>(Number(currentOpts.fontSize) || 440);
  const [independentStageSize, setIndependentStageSize] = useState<boolean>(Boolean(currentOpts.independentStageSize));
  const [stageTimerSize, setStageTimerSize] = useState<number>(Number(currentOpts.stageTimerSize) || 16);
  const [isScanningFonts, setIsScanningFonts] = useState(false);

  const [isMediaBrowserOpen, setIsMediaBrowserOpen] = useState(false);

  // Sync state if options change outside this modal (e.g. from OptionsDialog or BroadcastChannel)
  useEffect(() => {
    setEnabled(currentOpts.countdownEnabled ?? false);
    setDuration(currentOpts.countdownTime || '05:00');
    setLabel(currentOpts.intervalType || 'Pre-Service Countdown');
    setShowMain(currentOpts.showOnMainDisplay ?? false);
    setBgAssetId(currentOpts.backgroundAssetId || '');
    setFontFamily(currentOpts.fontFamily || 'Segoe UI, sans-serif');
    setFontColor(currentOpts.fontColor || '#ffffff');
    setFontSize(Number(currentOpts.fontSize) || 440);
    setIndependentStageSize(Boolean(currentOpts.independentStageSize));
    setStageTimerSize(Number(currentOpts.stageTimerSize) || 16);
  }, [
    currentOpts.countdownEnabled,
    currentOpts.countdownTime,
    currentOpts.intervalType,
    currentOpts.showOnMainDisplay,
    currentOpts.backgroundAssetId,
    currentOpts.fontFamily,
    currentOpts.fontColor,
    currentOpts.fontSize,
    currentOpts.independentStageSize,
    currentOpts.stageTimerSize,
  ]);

  // Auto-scan Windows & OS fonts on modal open
  useEffect(() => {
    queryNativeSystemFonts().catch(() => {});
  }, []);

  const updateLiveConfig = (patch: Partial<typeof currentOpts>) => {
    useStore.getState().setServiceIntervalConfig(patch);
  };

  const handleMainFontSizeChange = (nextVal: number) => {
    const clamped = Math.max(60, Math.min(720, Math.round(nextVal) || 440));
    setFontSize(clamped);
    updateLiveConfig({ fontSize: clamped });
  };

  const handleStageSizeChange = (nextVal: number) => {
    const clamped = Math.max(10, Math.min(96, Math.round(nextVal) || 16));
    setStageTimerSize(clamped);
    updateLiveConfig({ stageTimerSize: clamped });
  };

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

  const [, setTimerNow] = useState(() => Date.now());
  useEffect(() => {
    if (!currentOpts.isRunning || !currentOpts.targetTimestamp) return;
    if (Date.now() >= currentOpts.targetTimestamp) {
      useStore.getState().completeServiceTimerToLogo();
      return;
    }
    const interval = setInterval(() => {
      const now = Date.now();
      setTimerNow(now);
      if (currentOpts.targetTimestamp && now >= currentOpts.targetTimestamp) {
        clearInterval(interval);
        useStore.getState().completeServiceTimerToLogo();
      }
    }, 200);
    return () => clearInterval(interval);
  }, [currentOpts.isRunning, currentOpts.targetTimestamp]);

  const calcCurrentRemaining = () => {
    if (currentOpts.pausedRemainingSecs !== null && currentOpts.pausedRemainingSecs !== undefined) {
      return Math.max(0, currentOpts.pausedRemainingSecs);
    }
    if (!currentOpts.isRunning || !currentOpts.targetTimestamp) {
      return parseSeconds(duration);
    }
    const diff = currentOpts.targetTimestamp - Date.now();
    return diff > 0 ? Math.ceil(diff / 1000) : 0;
  };

  const liveSecs = calcCurrentRemaining();
  const liveMins = Math.floor(liveSecs / 60);
  const liveRemainSecs = liveSecs % 60;
  const liveFormatted = `${liveMins < 10 ? '0' : ''}${liveMins}:${liveRemainSecs < 10 ? '0' : ''}${liveRemainSecs}`;

  const handleStartPause = () => {
    if (currentOpts.isRunning) {
      useStore.getState().pauseServiceTimer();
    } else {
      useStore.getState().startServiceTimer(duration, label);
    }
  };

  const handleReset = (overrideDuration?: string) => {
    useStore.getState().resetServiceTimer(overrideDuration || duration);
  };

  const handleApply = () => {
    useStore.getState().setServiceIntervalConfig({
      countdownEnabled: enabled,
      countdownTime: duration,
      intervalType: label,
      showOnMainDisplay: showMain,
      backgroundAssetId: bgAssetId,
      fontFamily,
      fontColor,
      fontSize,
      independentStageSize,
      stageTimerSize,
    });
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Service interval timer settings saved' }));
    onClose();
  };

  const presets = ['03:00', '05:00', '10:00', '15:00', '30:00'];
  const quickLabels = ['Pre-Service Countdown', 'Sermon Timer', 'Offering Interval', 'Worship Transition'];

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-[#121317] border border-[#2a2d36] rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] relative" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#181a20] px-4 py-3 border-b border-[#2a2d36] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2 text-gray-200">
            <Clock size={16} className="text-amber-400" />
            <h2 className="text-sm font-bold tracking-wide">Service Interval Timer & Size / Font Controls</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#252833] text-gray-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm bg-[#121317] overflow-y-auto min-h-0 flex-1 custom-scrollbar">
          {/* Main Controls */}
          <div className="flex justify-between items-center bg-[#18191f] border border-[#323642] p-3 rounded-md">
             <div className="flex flex-col gap-1">
               <div className="flex items-center gap-2 text-sm font-bold text-gray-200">
                 <span>Timer Status:</span>
                 {currentOpts.isRunning ? (
                   <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 font-mono text-xs tabular-nums">
                     <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                     Running ({liveFormatted})
                   </span>
                 ) : currentOpts.pausedRemainingSecs !== null ? (
                   <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/90 border border-amber-500/60 text-amber-300 font-mono text-xs tabular-nums">
                     <span className="w-2 h-2 rounded-full bg-amber-400" />
                     Paused ({liveFormatted})
                   </span>
                 ) : (
                   <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs tabular-nums">
                     Stopped ({duration})
                   </span>
                 )}
               </div>
               <span className="text-xs text-gray-400">Controls sync instantly to Main Display & Stage Monitors</span>
             </div>
             <div className="flex items-center gap-2">
               <button 
                 onClick={handleStartPause}
                 className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all shadow-sm cursor-pointer ${
                   currentOpts.isRunning 
                     ? 'bg-amber-600/30 border border-amber-500/60 text-amber-400 hover:bg-amber-600/50' 
                     : 'bg-emerald-600/30 border border-emerald-500/60 text-emerald-400 hover:bg-emerald-600/50'
                 }`}
               >
                 {currentOpts.isRunning ? <Pause size={12} /> : <Play size={12} />}
                 {currentOpts.isRunning ? 'Pause' : 'Start Timer'}
               </button>
               <button 
                 onClick={() => handleReset()}
                 className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold bg-rose-600/30 border border-rose-500/60 text-rose-400 hover:bg-rose-600/50 transition-colors cursor-pointer"
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
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEnabled(checked);
                    updateLiveConfig({ countdownEnabled: checked });
                  }}
                  className="rounded accent-amber-500 w-4 h-4"
                />
                <span>Enable Countdowns on Foldback Stage Display</span>
              </label>
              <span className="text-[10px] text-gray-400 font-mono">Stage Sync</span>
            </div>

            <div className="flex flex-wrap items-start gap-x-6 gap-y-4 pt-1">
              <div className="min-w-[200px] flex-1">
                <label className="text-gray-400 block mb-1 text-xs">Duration (mm:ss)</label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => {
                    setDuration(e.target.value);
                    updateLiveConfig({ countdownTime: e.target.value });
                  }}
                  placeholder="05:00"
                  className="w-full bg-[#121317] border border-[#3b404d] rounded px-3 py-1.5 text-white font-mono text-sm focus:border-amber-500 outline-none tabular-nums"
                />
                
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-gray-400">Presets:</span>
                  {presets.map((time) => (
                    <button
                      key={time}
                      type="button"
                      onClick={() => {
                        setDuration(time);
                        updateLiveConfig({ countdownTime: time });
                        if (!currentOpts.isRunning) {
                          handleReset(time);
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                        duration === time 
                          ? 'bg-amber-600/30 text-amber-300 border-amber-500/60 font-bold'
                          : 'bg-[#252833] hover:bg-[#353949] text-gray-300 border-[#383c4b]'
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-w-[200px] flex-1">
                <label className="text-gray-400 block mb-1 text-xs">Interval Label / Header</label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    updateLiveConfig({ intervalType: e.target.value });
                  }}
                  placeholder="Pre-Service Countdown"
                  className="w-full bg-[#121317] border border-[#3b404d] rounded px-3 py-1.5 text-white text-sm focus:border-amber-500 outline-none"
                />
                
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] text-gray-400">Quick Labels:</span>
                  {quickLabels.map((lbl) => (
                    <button
                      key={lbl}
                      type="button"
                      onClick={() => {
                        setLabel(lbl);
                        updateLiveConfig({ intervalType: lbl });
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] border transition-all cursor-pointer ${
                        label === lbl 
                          ? 'bg-amber-600/30 text-amber-300 border-amber-500/60 font-semibold' 
                          : 'bg-[#252833] hover:bg-[#353949] text-gray-300 border-[#383c4b]'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Display & Manual Timer Size + Windows/System Font Configuration */}
          <div className="bg-[#18191f] border border-[#323642] rounded-md p-3.5 space-y-4">
            <div className="flex items-center justify-between border-b border-[#292c36] pb-2">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-200 text-sm">
                <input
                  type="checkbox"
                  checked={showMain}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setShowMain(checked);
                    updateLiveConfig({ showOnMainDisplay: checked });
                  }}
                  className="rounded accent-amber-500 w-4 h-4"
                />
                <span>Render Countdown on Live Display Canvas (Main Target Monitors)</span>
              </label>
              <span className="text-[10px] text-gray-400 font-mono">Main Sync</span>
            </div>

            {/* System & Windows Font + Text Color Row (Always Accessible) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-[#2a2d36] pb-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-300 text-xs font-semibold flex items-center gap-1">
                    <Type size={12} className="text-amber-400" />
                    <span>System & Windows Font</span>
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsScanningFonts(true);
                      try {
                        await queryNativeSystemFonts();
                      } finally {
                        setIsScanningFonts(false);
                      }
                    }}
                    className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
                    title="Auto-detect all installed Windows & System fonts"
                  >
                    <RefreshCw size={10} className={isScanningFonts ? 'animate-spin' : ''} />
                    <span>{isScanningFonts ? 'Scanning...' : 'Scan OS Fonts'}</span>
                  </button>
                </div>
                <SystemFontPicker
                  value={fontFamily}
                  onChange={(val) => {
                    setFontFamily(val);
                    updateLiveConfig({ fontFamily: val });
                  }}
                  previewSample={liveFormatted}
                  previewColor={fontColor}
                  className="w-full"
                  title="Select any installed Windows or System Font for the Timer"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-gray-300 text-xs font-semibold">Timer Text Color</label>
                  <span className="text-[10px] text-emerald-400/90 font-medium">Consistent to 00:00</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(fontColor) ? fontColor : '#ffffff'}
                    onInput={(e) => {
                      const val = (e.target as HTMLInputElement).value;
                      setFontColor(val);
                      updateLiveConfig({ fontColor: val });
                    }}
                    onChange={(e) => {
                      setFontColor(e.target.value);
                      updateLiveConfig({ fontColor: e.target.value });
                    }}
                    className="w-8 h-8 rounded border border-[#3b404d] bg-transparent cursor-pointer shrink-0"
                    title="Pick Timer Font Color"
                  />
                  <input
                    type="text"
                    value={fontColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFontColor(val);
                      if (/^#[0-9A-Fa-f]{3,6}$/.test(val.trim())) {
                        updateLiveConfig({ fontColor: val.trim() });
                      }
                    }}
                    className="w-20 bg-[#121317] border border-[#3b404d] rounded px-2 py-1 font-mono text-xs text-gray-200 tabular-nums focus:border-amber-500 outline-none"
                    placeholder="#ffffff"
                  />
                  <div
                    className="ml-auto px-2.5 py-1 rounded bg-[#121317] border border-[#2a2d36] font-black tabular-nums text-xs shadow-inner"
                    style={{ fontFamily, color: fontColor }}
                  >
                    {liveFormatted}
                  </div>
                </div>
                {/* Quick Color Swatches for Instant 1-Click Color Change */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {[
                    { hex: '#ffffff', name: 'White' },
                    { hex: '#fbbf24', name: 'Amber Gold' },
                    { hex: '#facc15', name: 'Yellow' },
                    { hex: '#38bdf8', name: 'Sky Cyan' },
                    { hex: '#34d399', name: 'Emerald' },
                    { hex: '#fb7185', name: 'Rose' },
                    { hex: '#f97316', name: 'Orange' },
                    { hex: '#a78bfa', name: 'Violet' },
                    { hex: '#60a5fa', name: 'Blue' },
                    { hex: '#000000', name: 'Black' },
                  ].map((swatch) => (
                    <button
                      key={swatch.hex}
                      type="button"
                      onClick={() => {
                        setFontColor(swatch.hex);
                        updateLiveConfig({ fontColor: swatch.hex });
                      }}
                      title={`Set Timer Color: ${swatch.name} (${swatch.hex})`}
                      className={`w-5 h-5 rounded-full border transition-transform cursor-pointer ${
                        fontColor.toLowerCase() === swatch.hex.toLowerCase()
                          ? 'scale-115 ring-2 ring-amber-400 border-white'
                          : 'border-white/25 hover:scale-110'
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Manual Timer Size Adjustment Control Suite (Main Display) */}
            <div className="space-y-2.5 border-b border-[#2a2d36] pb-4">
              <div className="flex items-center justify-between">
                <label className="text-gray-200 text-xs font-bold flex items-center gap-1.5">
                  <Sliders size={13} className="text-amber-400" />
                  <span>Main Display Timer Size (Manual Adjust)</span>
                </label>
                <span className="text-[11px] font-mono font-bold text-amber-400 tabular-nums">{fontSize}px</span>
              </div>

              {/* Slider + +/- Buttons + Numeric Input */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMainFontSizeChange(fontSize - 15)}
                  className="p-1.5 rounded bg-[#252833] hover:bg-[#353949] border border-[#383c4b] text-gray-200 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Decrease Main Timer Size (-15px)"
                >
                  <Minus size={13} />
                </button>
                <input
                  type="range"
                  min={60}
                  max={720}
                  step={5}
                  value={fontSize}
                  onChange={(e) => handleMainFontSizeChange(Number(e.target.value))}
                  className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-[#121317] rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => handleMainFontSizeChange(fontSize + 15)}
                  className="p-1.5 rounded bg-[#252833] hover:bg-[#353949] border border-[#383c4b] text-gray-200 hover:text-white transition-colors cursor-pointer shrink-0"
                  title="Increase Main Timer Size (+15px)"
                >
                  <Plus size={13} />
                </button>
                <div className="flex items-center bg-[#121317] border border-[#3b404d] rounded px-2 py-1 w-20 shrink-0">
                  <input
                    type="number"
                    min={60}
                    max={720}
                    value={fontSize}
                    onChange={(e) => handleMainFontSizeChange(Number(e.target.value))}
                    className="w-full bg-transparent text-white font-mono text-xs tabular-nums outline-none text-right"
                  />
                  <span className="text-[10px] text-gray-400 font-mono ml-0.5">px</span>
                </div>
              </div>

              {/* Size Presets */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] text-gray-400">Size Presets:</span>
                {MAIN_SIZE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleMainFontSizeChange(preset.value)}
                    title={preset.desc}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                      fontSize === preset.value
                        ? 'bg-amber-600/30 text-amber-300 border-amber-500/60 font-bold'
                        : 'bg-[#252833] hover:bg-[#353949] text-gray-300 border-[#383c4b]'
                    }`}
                  >
                    {preset.label} ({preset.value}px)
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleMainFontSizeChange(440)}
                  className="ml-auto px-2 py-0.5 rounded text-[10px] bg-[#1e222d] hover:bg-[#2c3242] text-gray-400 hover:text-white border border-[#323846] cursor-pointer whitespace-nowrap shrink-0"
                >
                  Reset (440px)
                </button>
              </div>
            </div>

            {/* Stage Display Timer Size (Linked or Independent Option) */}
            <div className="space-y-2.5 border-b border-[#2a2d36] pb-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-gray-200">
                  <input
                    type="checkbox"
                    checked={independentStageSize}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIndependentStageSize(checked);
                      updateLiveConfig({ independentStageSize: checked });
                    }}
                    className="rounded accent-sky-500 w-3.5 h-3.5"
                  />
                  <span>Independent Stage Display Timer Size</span>
                </label>
                <span className="text-[10px] font-mono text-sky-400 tabular-nums">
                  {independentStageSize
                    ? `Stage Manual: ${stageTimerSize}px`
                    : `Linked to Main (${Math.max(11, Math.round((fontSize / 440) * 15))}px)`}
                </span>
              </div>

              {independentStageSize && (
                <div className="space-y-2 pt-1 pl-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleStageSizeChange(stageTimerSize - 2)}
                      className="p-1.5 rounded bg-[#252833] hover:bg-[#353949] border border-[#383c4b] text-gray-200 hover:text-white transition-colors cursor-pointer shrink-0"
                      title="Decrease Stage Timer Size (-2px)"
                    >
                      <Minus size={12} />
                    </button>
                    <input
                      type="range"
                      min={10}
                      max={96}
                      step={1}
                      value={stageTimerSize}
                      onChange={(e) => handleStageSizeChange(Number(e.target.value))}
                      className="flex-1 accent-sky-500 cursor-pointer h-1.5 bg-[#121317] rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => handleStageSizeChange(stageTimerSize + 2)}
                      className="p-1.5 rounded bg-[#252833] hover:bg-[#353949] border border-[#383c4b] text-gray-200 hover:text-white transition-colors cursor-pointer shrink-0"
                      title="Increase Stage Timer Size (+2px)"
                    >
                      <Plus size={12} />
                    </button>
                    <div className="flex items-center bg-[#121317] border border-[#3b404d] rounded px-2 py-1 w-20 shrink-0">
                      <input
                        type="number"
                        min={10}
                        max={96}
                        value={stageTimerSize}
                        onChange={(e) => handleStageSizeChange(Number(e.target.value))}
                        className="w-full bg-transparent text-white font-mono text-xs tabular-nums outline-none text-right"
                      />
                      <span className="text-[10px] text-gray-400 font-mono ml-0.5">px</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-gray-400">Stage Presets:</span>
                    {STAGE_SIZE_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleStageSizeChange(preset.value)}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                          stageTimerSize === preset.value
                            ? 'bg-sky-600/30 text-sky-300 border-sky-500/60 font-bold'
                            : 'bg-[#252833] hover:bg-[#353949] text-gray-300 border-[#383c4b]'
                        }`}
                      >
                        {preset.label} ({preset.value}px)
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Background Image / Video */}
            <div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-xs">Background Image / Video</span>
                <button 
                  className="text-xs bg-[#252833] hover:bg-[#353949] border border-[#383c4b] text-gray-200 px-2.5 py-1 rounded flex items-center gap-1.5 cursor-pointer"
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
                  <button
                    className="ml-auto text-red-400 hover:text-red-300 cursor-pointer"
                    onClick={() => {
                      setBgAssetId('');
                      updateLiveConfig({ backgroundAssetId: '' });
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-[#181a20] px-4 py-3 border-t border-[#2a2d36] flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium text-gray-300 hover:text-white transition-colors cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded transition-colors flex items-center gap-1.5 cursor-pointer"
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
            updateLiveConfig({ backgroundAssetId: asset.id });
            setIsMediaBrowserOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default withPortal(ServiceIntervalsModal);

