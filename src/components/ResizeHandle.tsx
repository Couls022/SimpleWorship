import React from 'react';
import { PanelResizeHandle } from 'react-resizable-panels';
import { GripVertical, GripHorizontal } from 'lucide-react';

interface ResizeHandleProps {
  direction?: 'horizontal' | 'vertical';
  className?: string;
}

export default function ResizeHandle({ direction = 'horizontal', className = '' }: ResizeHandleProps) {
  const isHorizontal = direction === 'horizontal';
  return (
    <PanelResizeHandle
      className={`group relative flex items-center justify-center bg-[#181a22] transition-all duration-150 z-20 select-none touch-none ${
        isHorizontal
          ? 'w-[3px] cursor-col-resize h-full hover:bg-cyan-400 active:bg-cyan-400 data-[resize-handle-state=drag]:bg-cyan-400 data-[resize-handle-state=drag]:shadow-[0_0_10px_rgba(34,211,238,0.7)] after:absolute after:inset-y-0 after:-left-1.5 after:-right-1.5 after:z-30'
          : 'h-[3px] cursor-row-resize w-full hover:bg-cyan-400 active:bg-cyan-400 data-[resize-handle-state=drag]:bg-cyan-400 data-[resize-handle-state=drag]:shadow-[0_0_10px_rgba(34,211,238,0.7)] after:absolute after:inset-x-0 after:-top-1.5 after:-bottom-1.5 after:z-30'
      } ${className}`}
    >
      {/* Enterprise Central Grip Pill */}
      <div
        className={`pointer-events-none absolute z-40 flex items-center justify-center rounded-full bg-[#1e2330] border border-cyan-500/40 text-cyan-300 shadow-md opacity-0 group-hover:opacity-100 group-data-[resize-handle-state=drag]:opacity-100 group-active:opacity-100 transition-opacity duration-150 ${
          isHorizontal ? 'w-3 h-8 -translate-x-1/2 left-1/2' : 'h-3 w-8 -translate-y-1/2 top-1/2'
        }`}
      >
        {isHorizontal ? (
          <GripVertical size={10} className="text-cyan-400" />
        ) : (
          <GripHorizontal size={10} className="text-cyan-400" />
        )}
      </div>
    </PanelResizeHandle>
  );
}

