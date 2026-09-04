import React, { useState } from 'react';
import { FileText, Sparkles, ChevronUp, ChevronDown, Play, Trash2, Clock } from 'lucide-react';
import { Slide, SlideObject, ObjectAnimation } from '../../types';

interface NotesAndTimelineDrawerProps {
  slide: Slide;
  onUpdateNotes: (notes: string) => void;
  onUpdateObjects: (objects: SlideObject[]) => void;
}

type BottomTab = 'notes' | 'timeline';

export const NotesAndTimelineDrawer: React.FC<NotesAndTimelineDrawerProps> = ({
  slide,
  onUpdateNotes,
  onUpdateObjects,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<BottomTab>('notes');

  const objects = slide.objects || [];

  // Collect all animations from all objects on this slide
  const allAnimations: { obj: SlideObject; anim: ObjectAnimation }[] = [];
  objects.forEach((obj) => {
    if (obj.animations && obj.animations.length > 0) {
      obj.animations.forEach((anim) => {
        allAnimations.push({ obj, anim });
      });
    }
  });

  return (
    <div className={`w-full bg-slate-900 border-t border-slate-800 transition-all duration-200 flex flex-col text-slate-200 select-none ${isOpen ? 'h-36' : 'h-8'}`}>
      {/* Header / Drawer Handle */}
      <div className="h-8 bg-slate-950 px-3 flex items-center justify-between border-b border-slate-800 text-xs font-medium shrink-0">
        <div className="flex items-center gap-2">
          <button
            className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors ${
              activeTab === 'notes' ? 'bg-sky-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => {
              setActiveTab('notes');
              setIsOpen(true);
            }}
          >
            <FileText size={13} />
            <span>Speaker Notes</span>
          </button>

          <button
            className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition-colors ${
              activeTab === 'timeline' ? 'bg-sky-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
            onClick={() => {
              setActiveTab('timeline');
              setIsOpen(true);
            }}
          >
            <Sparkles size={13} />
            <span>Animation Timeline ({allAnimations.length})</span>
          </button>
        </div>

        <button
          className="text-slate-400 hover:text-slate-200 p-1 rounded"
          onClick={() => setIsOpen(!isOpen)}
          title={isOpen ? 'Collapse Drawer' : 'Expand Drawer'}
        >
          {isOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      {/* Drawer Body */}
      {isOpen && (
        <div className="flex-1 p-2 bg-slate-900 overflow-hidden">
          {activeTab === 'notes' ? (
            <textarea
              className="w-full h-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 text-xs font-sans outline-none focus:border-sky-500 resize-none leading-relaxed"
              placeholder="Type presenter / speaker notes here for this slide..."
              value={slide.notes || ''}
              onChange={(e) => onUpdateNotes(e.target.value)}
            />
          ) : (
            <div className="w-full h-full overflow-y-auto custom-scrollbar">
              {allAnimations.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs space-x-2">
                  <Clock size={16} />
                  <span>No animations set on this slide yet. Select an object and use Inspector &gt; Animate.</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {allAnimations.map(({ obj, anim }, idx) => (
                    <div key={anim.id} className="flex items-center justify-between bg-slate-950 border border-slate-800/80 rounded px-3 py-1.5 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 font-mono text-[10px] flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-200 capitalize">{anim.type.replace('-', ' ')}</span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[200px]">
                            Target: {obj.text || obj.type}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
                        <span>Duration: {anim.durationMs}ms</span>
                        <span>Delay: {anim.delayMs}ms</span>
                        <button
                          className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                          onClick={() => {
                            const updatedAnims = (obj.animations || []).filter((a) => a.id !== anim.id);
                            onUpdateObjects(objects.map((o) => (o.id === obj.id ? { ...o, animations: updatedAnims } : o)));
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
