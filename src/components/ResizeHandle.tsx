import React from 'react';
import { PanelResizeHandle } from 'react-resizable-panels';

interface ResizeHandleProps {
  direction?: 'horizontal' | 'vertical';
  className?: string;
  id?: string;
}

export default function ResizeHandle({ 
  direction = 'horizontal', 
  className = '',
  id
}: ResizeHandleProps) {
  const isHorizontal = direction === 'horizontal';

  const handleDoubleClick = () => {
    window.dispatchEvent(new CustomEvent('simpleworship:reset-layout'));
  };

  return (
    <PanelResizeHandle
      id={id}
      onDoubleClick={handleDoubleClick}
      title="Drag to adjust panel width • Double-click to reset proportions"
      className={`group relative flex items-center justify-center transition-colors duration-150 select-none touch-none shrink-0 ${
        isHorizontal
          ? 'w-[6px] cursor-col-resize h-full bg-[#141620] hover:bg-sky-500/80 active:bg-sky-400 data-[resize-handle-state=drag]:bg-sky-400 after:absolute after:inset-y-0 after:-left-2 after:-right-2 after:z-30'
          : 'h-[6px] cursor-row-resize w-full bg-[#141620] hover:bg-sky-500/80 active:bg-sky-400 data-[resize-handle-state=drag]:bg-sky-400 after:absolute after:inset-x-0 after:-top-2 after:-bottom-2 after:z-30'
      } ${className}`}
    >
      {/* Sleek Minimalist Subtle Center Grip Notch with dots */}
      <div
        className={`pointer-events-none absolute z-40 rounded-full bg-[#2f3549] group-hover:bg-sky-200 group-data-[resize-handle-state=drag]:bg-sky-100 group-active:bg-sky-100 transition-all duration-150 flex items-center justify-center ${
          isHorizontal
            ? 'w-[3px] h-9 -translate-x-1/2 left-1/2 opacity-60 group-hover:opacity-100 group-data-[resize-handle-state=drag]:opacity-100 group-hover:h-12'
            : 'h-[3px] w-9 -translate-y-1/2 top-1/2 opacity-60 group-hover:opacity-100 group-data-[resize-handle-state=drag]:opacity-100 group-hover:w-12'
        }`}
      />
    </PanelResizeHandle>
  );
}
