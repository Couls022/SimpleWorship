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
      className={`relative flex items-center justify-center bg-[#18191d] hover:bg-[#343842] active:bg-[#404655] transition-colors z-10 ${
        isHorizontal ? 'w-1.5 cursor-col-resize h-full' : 'h-1.5 cursor-row-resize w-full'
      } ${className}`}
    >
      <div className={`flex items-center justify-center text-gray-500 opacity-0 hover:opacity-100 transition-opacity pointer-events-none ${isHorizontal ? 'h-8' : 'w-8'}`}>
        {isHorizontal ? <GripVertical size={12} /> : <GripHorizontal size={12} />}
      </div>
    </PanelResizeHandle>
  );
}
