import React, { useState } from 'react';
import { Plus, Trash2, Copy, ChevronUp, ChevronDown, Eye, EyeOff, Layout, Type, List, BookOpen, Quote, Split, Calendar } from 'lucide-react';
import { Slide } from '../../types';
import { PresentationSlideView } from '../PresentationSlideView';

interface SlideThumbnailsDeckProps {
  slides: Slide[];
  activeSlideIndex: number;
  onSelectSlide: (index: number) => void;
  onAddSlide: (layoutType: string) => void;
  onDuplicateSlide: (index: number) => void;
  onDeleteSlide: (index: number) => void;
  onMoveSlide: (index: number, direction: 'up' | 'down') => void;
  aspectRatioLabel?: string;
}

export const SlideThumbnailsDeck: React.FC<SlideThumbnailsDeckProps> = ({
  slides,
  activeSlideIndex,
  onSelectSlide,
  onAddSlide,
  onDuplicateSlide,
  onDeleteSlide,
  onMoveSlide,
  aspectRatioLabel = '16:9 Widescreen',
}) => {
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);

  const layouts = [
    { id: 'title', label: 'Title Slide', icon: <Type size={13} className="text-cyan-400" /> },
    { id: 'title-content', label: 'Title & Content', icon: <List size={13} className="text-emerald-400" /> },
    { id: 'scripture-focus', label: 'Scripture Verse', icon: <BookOpen size={13} className="text-amber-400" /> },
    { id: 'quote', label: 'Quote / Reflection', icon: <Quote size={13} className="text-purple-400" /> },
    { id: 'two-column', label: 'Two Column', icon: <Split size={13} className="text-indigo-400" /> },
    { id: 'announcement', label: 'Announcement', icon: <Calendar size={13} className="text-rose-400" /> },
    { id: 'blank', label: 'Blank Canvas', icon: <Layout size={13} className="text-slate-400" /> },
    { id: 'gallery', label: 'Browse Gallery...', icon: <Plus size={13} className="text-sky-400" /> },
  ];

  return (
    <div className="w-full h-full bg-slate-900 border-r border-slate-800/80 flex flex-col text-slate-200 select-none overflow-hidden">
      {/* Header Bar */}
      <div className="p-2.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between relative">
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">Slides ({slides.length})</span>
          <span className="text-[10px] text-sky-400 font-medium">{aspectRatioLabel}</span>
        </div>

        {/* Add Slide Button & Layout Dropdown */}
        <div className="relative">
          <button
            className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-2.5 py-1 rounded-md font-medium flex items-center gap-1 transition-colors shadow-sm"
            onClick={() => setShowLayoutMenu(!showLayoutMenu)}
          >
            <Plus size={14} />
            <span>New Slide</span>
          </button>

          {showLayoutMenu && (
            <div className="absolute top-full right-0 mt-1 w-52 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl py-1 z-50 text-xs space-y-0.5">
              <div className="px-3 py-1 font-semibold text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800">Choose Layout</div>
              {layouts.map((l) => (
                <button
                  key={l.id}
                  className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-800 text-slate-200 text-left transition-colors"
                  onClick={() => {
                    onAddSlide(l.id);
                    setShowLayoutMenu(false);
                  }}
                >
                  {l.icon}
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Thumbnails Scroll Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {slides.map((slide, idx) => {
          const isActive = idx === activeSlideIndex;
          return (
            <div
              key={slide.id || idx}
              className={`group relative rounded-lg border-2 transition-all duration-150 cursor-pointer overflow-hidden ${
                isActive ? 'border-sky-500 ring-2 ring-sky-500/30 bg-slate-800' : 'border-slate-800 hover:border-slate-700 bg-slate-950'
              }`}
              onClick={() => onSelectSlide(idx)}
            >
              {/* Slide Index Badge */}
              <div className="absolute top-1.5 left-1.5 z-20 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-300">
                {idx + 1}
              </div>

              {/* Action Toolbar on Hover */}
              <div className="absolute top-1.5 right-1.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900/90 backdrop-blur-md border border-slate-700/60 rounded p-0.5 flex items-center gap-0.5 shadow-md">
                <button
                  className="p-1 hover:bg-slate-800 rounded text-slate-300 disabled:opacity-30"
                  disabled={idx === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveSlide(idx, 'up');
                  }}
                  title="Move Up"
                >
                  <ChevronUp size={12} />
                </button>
                <button
                  className="p-1 hover:bg-slate-800 rounded text-slate-300 disabled:opacity-30"
                  disabled={idx === slides.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMoveSlide(idx, 'down');
                  }}
                  title="Move Down"
                >
                  <ChevronDown size={12} />
                </button>
                <button
                  className="p-1 hover:bg-slate-800 rounded text-slate-300"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateSlide(idx);
                  }}
                  title="Duplicate Slide"
                >
                  <Copy size={12} />
                </button>
                <button
                  className="p-1 hover:bg-rose-900/50 rounded text-rose-400 disabled:opacity-30"
                  disabled={slides.length <= 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSlide(idx);
                  }}
                  title="Delete Slide"
                >
                  <Trash2 size={12} />
                </button>
              </div>

              {/* Slide Canvas Thumbnail */}
              <div className="w-full aspect-video bg-white pointer-events-none relative overflow-hidden">
                <PresentationSlideView slide={slide} slideIndex={idx} mode="thumbnail" />
              </div>

              {/* Title / Label Bar */}
              <div className="px-2 py-1 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-300 font-medium truncate">
                <span className="truncate">{slide.title || `Slide ${idx + 1}`}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
