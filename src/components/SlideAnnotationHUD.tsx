import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { 
  Pen, 
  Highlighter, 
  Radio, 
  Square, 
  ArrowUpRight, 
  SunMedium, 
  Eraser, 
  Undo2, 
  Redo2, 
  Trash2, 
  Pin, 
  PinOff, 
  X, 
  Sparkles,
  Layers,
  Check
} from 'lucide-react';
import { AnnotationToolType } from '../types';

const PRESET_COLORS = [
  { name: 'Laser Red', hex: '#FF2A4D' },
  { name: 'Bright Yellow', hex: '#FFE600' },
  { name: 'Neon Cyan', hex: '#00E5FF' },
  { name: 'Vivid Green', hex: '#00E676' },
  { name: 'Pure White', hex: '#FFFFFF' },
  { name: 'Orange Glow', hex: '#FF9100' },
  { name: 'Electric Purple', hex: '#D500F9' },
];

const PRESET_SIZES = [
  { label: 'Fine', value: 3 },
  { label: 'Medium', value: 6 },
  { label: 'Thick', value: 12 },
  { label: 'Bold', value: 20 },
];

interface SlideAnnotationHUDProps {
  className?: string;
  onClose?: () => void;
}

export const SlideAnnotationHUD: React.FC<SlideAnnotationHUDProps> = ({
  className = '',
  onClose,
}) => {
  const { 
    annotationState, 
    setAnnotationTool, 
    setAnnotationColor, 
    setAnnotationSize, 
    setAnnotationOpacity, 
    setAnnotationPersist,
    toggleAnnotationMode,
    clearAnnotations, 
    undoAnnotation, 
    redoAnnotation 
  } = useStore();

  const {
    enabled,
    activeTool,
    activeColor,
    strokeSize,
    opacity,
    persistAcrossSlides,
    strokes,
    redoStack
  } = annotationState;

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const tools: { id: AnnotationToolType; label: string; icon: React.ReactNode; shortcut: string }[] = [
    { id: 'pen', label: 'Pen', icon: <Pen className="w-4 h-4" />, shortcut: 'P' },
    { id: 'highlighter', label: 'Highlighter', icon: <Highlighter className="w-4 h-4" />, shortcut: 'H' },
    { id: 'laser', label: 'Laser Pointer', icon: <Radio className="w-4 h-4" />, shortcut: 'L' },
    { id: 'rectangle', label: 'Box Area', icon: <Square className="w-4 h-4" />, shortcut: 'B' },
    { id: 'arrow', label: 'Arrow', icon: <ArrowUpRight className="w-4 h-4" />, shortcut: 'A' },
    { id: 'spotlight', label: 'Spotlight', icon: <SunMedium className="w-4 h-4" />, shortcut: 'S' },
    { id: 'eraser', label: 'Eraser', icon: <Eraser className="w-4 h-4" />, shortcut: 'E' },
  ];

  if (!enabled) {
    return (
      <button
        id="btn-open-annotation-hud"
        onClick={() => toggleAnnotationMode(true)}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 transition-all shadow-sm ${className}`}
        title="Activate Live Slide Drawing & Highlighter Tool"
      >
        <Pen className="w-3.5 h-3.5 text-amber-400" />
        <span>Live Draw</span>
      </button>
    );
  }

  return (
    <div 
      id="slide-annotation-hud-panel"
      className={`relative z-40 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl p-2.5 text-white transition-all select-none ${className}`}
    >
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-3 pb-2 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Live Annotation
          </span>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono border border-slate-700">
            {strokes.length} stroke{strokes.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Persist Across Slides Toggle */}
          <button
            id="btn-toggle-persist-annotations"
            onClick={() => setAnnotationPersist(!persistAcrossSlides)}
            className={`flex items-center gap-1 px-2 py-0.5 text-[11px] rounded border transition-colors ${
              persistAcrossSlides 
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60 hover:bg-emerald-900/80' 
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
            title={persistAcrossSlides ? "Annotations persist across slide transitions (Active)" : "Annotations clear when slide changes"}
          >
            {persistAcrossSlides ? <Pin className="w-3 h-3 text-emerald-400" /> : <PinOff className="w-3 h-3 text-slate-400" />}
            <span>Persist: {persistAcrossSlides ? 'ON' : 'OFF'}</span>
          </button>

          {/* Close / Deactivate */}
          <button
            id="btn-close-annotation-hud"
            onClick={() => {
              toggleAnnotationMode(false);
              onClose?.();
            }}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Exit Annotation Mode"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Tool Selection Row */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
        {tools.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              id={`tool-btn-${tool.id}`}
              onClick={() => setAnnotationTool(tool.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/20'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700 hover:text-white'
              }`}
              title={`${tool.label} (${tool.shortcut})`}
            >
              {tool.icon}
              <span className="hidden sm:inline">{tool.label}</span>
            </button>
          );
        })}
      </div>

      {/* Control Strip: Colors, Sizes, Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
        {/* Color Palette */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase font-semibold text-slate-400 mr-0.5">Color</span>
          {PRESET_COLORS.map((c) => {
            const isSelected = activeColor.toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.hex}
                onClick={() => setAnnotationColor(c.hex)}
                className={`w-5 h-5 rounded-full border transition-all relative ${
                  isSelected ? 'border-white scale-110 shadow-md ring-2 ring-white/40' : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              >
                {isSelected && (
                  <Check className={`w-3 h-3 absolute inset-0 m-auto ${c.hex === '#FFFFFF' || c.hex === '#FFE600' ? 'text-black' : 'text-white'}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Thickness Sizes */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase font-semibold text-slate-400 mr-0.5">Size</span>
          {PRESET_SIZES.map((s) => {
            const isSelected = strokeSize === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setAnnotationSize(s.value)}
                className={`px-1.5 py-0.5 text-[11px] rounded font-medium border transition-all ${
                  isSelected
                    ? 'bg-slate-700 text-white border-slate-500'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200'
                }`}
                title={`${s.label} (${s.value}px)`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Undo / Redo / Clear Actions */}
        <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
          <button
            id="btn-undo-annotation"
            onClick={() => undoAnnotation()}
            disabled={strokes.length === 0}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Undo Last Stroke (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>

          <button
            id="btn-redo-annotation"
            onClick={() => redoAnnotation()}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Redo Stroke (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <button
            id="btn-clear-annotations"
            onClick={() => clearAnnotations()}
            disabled={strokes.length === 0}
            className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 hover:text-red-300 hover:bg-red-950/50 border border-transparent hover:border-red-800/50 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Clear All Annotations on Screen"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SlideAnnotationHUD;
