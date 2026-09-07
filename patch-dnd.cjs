const fs = require('fs');
let code = fs.readFileSync('src/components/SongEditorModal.tsx', 'utf-8');

// 1. Add imports
const imports = `import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';\n`;

code = code.replace(/import React[^;]+;/, match => match + '\n' + imports);

// 2. Define SortableSlideItem
const sortableItemCode = `
interface SortableSlideItemProps {
  slide: { label: string; text: string };
  idx: number;
  activeSlideIndex: number;
  setActiveSlideIndex: (idx: number) => void;
  id: string;
}

function SortableSlideItem({ slide, idx, activeSlideIndex, setActiveSlideIndex, id }: SortableSlideItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => setActiveSlideIndex(idx)}
      className={\`p-2.5 rounded cursor-pointer transition-all border \${
        activeSlideIndex === idx
          ? 'bg-[#293245] border-cyan-400 shadow-md ring-1 ring-cyan-400'
          : 'bg-[#141519] border-[#292c36] hover:bg-[#1e222b]'
      }\`}
    >
      <div className="flex items-center justify-between text-[11px] font-bold mb-1">
        <span className={\`px-1.5 py-0.5 rounded \${
          (() => {
            const t = slide.label.toLowerCase();
            if (t.includes('chorus') || t.includes('koro') || t.includes('refrain')) return 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50';
            if (t.includes('bridge') || t.includes('tulay')) return 'bg-purple-900/50 text-purple-300 border border-purple-700/50';
            if (t.includes('pre-chorus')) return 'bg-amber-900/50 text-amber-300 border border-amber-700/50';
            if (t.includes('tag') || t.includes('ending') || t.includes('coda')) return 'bg-rose-900/50 text-rose-300 border border-rose-700/50';
            if (t.includes('verse') || t.includes('talatâ') || t.match(/^v\\d+$/)) return 'bg-indigo-900/50 text-indigo-300 border border-indigo-700/50';
            return 'bg-[#293245] text-cyan-300 border border-cyan-700/50';
          })()
        }\`}>{slide.label}</span>
        <span className="text-gray-500 text-[10px] font-mono">#{idx + 1}</span>
      </div>
      <p className="text-[11px] text-gray-200 line-clamp-3 font-serif leading-tight">
        {slide.text}
      </p>
    </div>
  );
}
`;

code = code.replace(/export default function SongEditorModal/, match => sortableItemCode + '\n' + match);

// 3. Add sensors and drag end handler
const dragLogic = `  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIndex = parsedSlides.findIndex((_, i) => \`slide-\${i}\` === active.id);
      const newIndex = parsedSlides.findIndex((_, i) => \`slide-\${i}\` === over.id);
      
      const newSlides = arrayMove(parsedSlides, oldIndex, newIndex);
      
      const newLyrics = newSlides.map(s => \`[\${s.label}]\\n\${s.text}\`).join('\\n\\n');
      setRawLyrics(newLyrics);
      
      if (activeSlideIndex === oldIndex) {
         setActiveSlideIndex(newIndex);
      } else if (activeSlideIndex > oldIndex && activeSlideIndex <= newIndex) {
         setActiveSlideIndex(activeSlideIndex - 1);
      } else if (activeSlideIndex < oldIndex && activeSlideIndex >= newIndex) {
         setActiveSlideIndex(activeSlideIndex + 1);
      }
    }
  };`;

code = code.replace(/const activeSlide = parsedSlides\[activeSlideIndex\] \|\| parsedSlides\[0\];/, match => dragLogic + '\n\n  ' + match);

// 4. Replace the map logic with DndContext
const originalMap = `<div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {parsedSlides.map((slide, idx) => (
                    <div
                      key={idx}
                      onClick={() => setActiveSlideIndex(idx)}
                      className={\`p-2.5 rounded cursor-pointer transition-all border \${
                        activeSlideIndex === idx
                          ? 'bg-[#293245] border-cyan-400 shadow-md ring-1 ring-cyan-400'
                          : 'bg-[#141519] border-[#292c36] hover:bg-[#1e222b]'
                      }\`}
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                        <span className={\`px-1.5 py-0.5 rounded \${
                          (() => {
                            const t = slide.label.toLowerCase();
                            if (t.includes('chorus') || t.includes('koro') || t.includes('refrain')) return 'bg-emerald-900/50 text-emerald-300 border border-emerald-700/50';
                            if (t.includes('bridge') || t.includes('tulay')) return 'bg-purple-900/50 text-purple-300 border border-purple-700/50';
                            if (t.includes('pre-chorus')) return 'bg-amber-900/50 text-amber-300 border border-amber-700/50';
                            if (t.includes('tag') || t.includes('ending') || t.includes('coda')) return 'bg-rose-900/50 text-rose-300 border border-rose-700/50';
                            if (t.includes('verse') || t.includes('talatâ') || t.match(/^v\\d+$/)) return 'bg-indigo-900/50 text-indigo-300 border border-indigo-700/50';
                            return 'bg-[#293245] text-cyan-300 border border-cyan-700/50';
                          })()
                        }\`}>{slide.label}</span>
                        <span className="text-gray-500 text-[10px] font-mono">#{idx + 1}</span>
                      </div>
                      <p className="text-[11px] text-gray-200 line-clamp-3 font-serif leading-tight">
                        {slide.text}
                      </p>
                    </div>
                  ))}
                </div>`;

const newMap = `<div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext 
                      items={parsedSlides.map((_, i) => \`slide-\${i}\`)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {parsedSlides.map((slide, idx) => (
                          <SortableSlideItem
                            key={\`slide-\${idx}\`}
                            id={\`slide-\${idx}\`}
                            slide={slide}
                            idx={idx}
                            activeSlideIndex={activeSlideIndex}
                            setActiveSlideIndex={setActiveSlideIndex}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>`;

code = code.replace(originalMap, newMap);

fs.writeFileSync('src/components/SongEditorModal.tsx', code);
console.log("Done adding DnD");
