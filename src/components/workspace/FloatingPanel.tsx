import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, 
  Maximize2, 
  Minimize2, 
  Pin, 
  GripHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { PanelId } from '../../types';

interface FloatingPanelProps {
  id: PanelId;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export default function FloatingPanel({ id, children, icon }: FloatingPanelProps) {
  const { panels, updateFloatingPosition, bringToFront, togglePanelDock, setPanelVisibility } = useWorkspace();
  const panel = panels[id];

  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ mouseX: number; mouseY: number; panelX: number; panelY: number }>({
    mouseX: 0,
    mouseY: 0,
    panelX: 0,
    panelY: 0
  });

  const resizeStartPos = useRef<{
    mouseX: number;
    mouseY: number;
    width: number;
    height: number;
    panelX: number;
    panelY: number;
  }>({
    mouseX: 0,
    mouseY: 0,
    width: 0,
    height: 0,
    panelX: 0,
    panelY: 0
  });

  // Mouse Move & Mouse Up Listeners
  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaX = e.clientX - dragStartPos.current.mouseX;
        const deltaY = e.clientY - dragStartPos.current.mouseY;

        const newX = Math.max(10, Math.min(window.innerWidth - 100, dragStartPos.current.panelX + deltaX));
        const newY = Math.max(40, Math.min(window.innerHeight - 60, dragStartPos.current.panelY + deltaY));

        updateFloatingPosition(id, { x: newX, y: newY });
      } else if (isResizing && resizeDirection) {
        const deltaX = e.clientX - resizeStartPos.current.mouseX;
        const deltaY = e.clientY - resizeStartPos.current.mouseY;

        let newWidth = resizeStartPos.current.width;
        let newHeight = resizeStartPos.current.height;
        let newX = resizeStartPos.current.panelX;
        let newY = resizeStartPos.current.panelY;

        if (resizeDirection.includes('e')) {
          newWidth = Math.max(280, Math.min(window.innerWidth - newX - 20, resizeStartPos.current.width + deltaX));
        }
        if (resizeDirection.includes('s')) {
          newHeight = Math.max(180, Math.min(window.innerHeight - newY - 20, resizeStartPos.current.height + deltaY));
        }
        if (resizeDirection.includes('w')) {
          const possibleWidth = resizeStartPos.current.width - deltaX;
          if (possibleWidth >= 280) {
            newWidth = possibleWidth;
            newX = resizeStartPos.current.panelX + deltaX;
          }
        }
        if (resizeDirection.includes('n')) {
          const possibleHeight = resizeStartPos.current.height - deltaY;
          if (possibleHeight >= 180) {
            newHeight = possibleHeight;
            newY = resizeStartPos.current.panelY + deltaY;
          }
        }

        updateFloatingPosition(id, {
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDirection(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, resizeDirection, id, updateFloatingPosition]);

  if (!panel || !panel.visible || panel.isDocked) {
    return null;
  }

  const { x, y, width, height, zIndex, isMaximized } = panel.floating;

  // Handle Drag Start
  const handleMouseDownHeader = (e: React.MouseEvent) => {
    // Only drag on left click and not on action buttons
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    if (isMaximized) return;

    bringToFront(id);
    setIsDragging(true);
    dragStartPos.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      panelX: x,
      panelY: y
    };
  };

  // Handle Resize Start
  const handleMouseDownResize = (e: React.MouseEvent, direction: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (isMaximized) return;

    bringToFront(id);
    setIsResizing(true);
    setResizeDirection(direction);
    resizeStartPos.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      width,
      height,
      panelX: x,
      panelY: y
    };
  };

  const toggleMaximize = () => {
    updateFloatingPosition(id, { isMaximized: !isMaximized });
  };

  return (
    <div
      ref={panelRef}
      onMouseDown={() => bringToFront(id)}
      style={{
        position: 'fixed',
        left: isMaximized ? 8 : x,
        top: isMaximized ? 42 : y,
        width: isMaximized ? 'calc(100vw - 16px)' : width,
        height: isMaximized ? 'calc(100vh - 50px)' : (isMinimized ? 'auto' : height),
        zIndex
      }}
      className={`flex flex-col bg-[#1a1c23] border border-[#3b404d] rounded-lg shadow-2xl overflow-hidden backdrop-blur-xs select-none transition-shadow ${
        isDragging ? 'opacity-95 shadow-cyan-500/20' : ''
      }`}
    >
      {/* Draggable Title Bar */}
      <div
        onMouseDown={handleMouseDownHeader}
        className="flex items-center justify-between px-2.5 py-1.5 bg-[#252832] border-b border-[#323644] cursor-move text-xs font-semibold text-gray-200"
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal size={14} className="text-gray-400 shrink-0" />
          {icon && <span className="text-cyan-400 shrink-0">{icon}</span>}
          <span className="truncate text-[12px]">{panel.title}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-cyan-950/60 border border-cyan-700/40 text-cyan-300 font-mono">
            Floating
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1 shrink-0">
          {/* Dock Back into Grid */}
          {!['mediaLibrary', 'quickNotes', 'stageMonitor'].includes(id) && (
            <button
              onClick={() => togglePanelDock(id)}
              className="p-1 hover:bg-[#383d4c] text-gray-400 hover:text-cyan-300 rounded-sm transition-colors"
              title="Dock to Workspace Grid"
            >
              <Pin size={12} className="rotate-45" />
            </button>
          )}

          {/* Minimize / Expand Toggle */}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-[#383d4c] text-gray-400 hover:text-white rounded-sm transition-colors"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>

          {/* Maximize / Restore */}
          <button
            onClick={toggleMaximize}
            className="p-1 hover:bg-[#383d4c] text-gray-400 hover:text-white rounded-sm transition-colors"
            title={isMaximized ? 'Restore Window' : 'Maximize Window'}
          >
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>

          {/* Close Panel */}
          <button
            onClick={() => setPanelVisibility(id, false)}
            className="p-1 hover:bg-rose-600/80 text-gray-400 hover:text-white rounded-sm transition-colors"
            title="Hide Panel"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Panel Content Body */}
      {!isMinimized && (
        <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col bg-[#141519]">
          {children}
        </div>
      )}

      {/* Resize Handles (8 directions) */}
      {!isMaximized && !isMinimized && (
        <>
          <div
            onMouseDown={(e) => handleMouseDownResize(e, 'e')}
            className="absolute top-0 right-0 w-2 h-full cursor-e-resize hover:bg-cyan-500/30"
          />
          <div
            onMouseDown={(e) => handleMouseDownResize(e, 's')}
            className="absolute bottom-0 left-0 h-2 w-full cursor-s-resize hover:bg-cyan-500/30"
          />
          <div
            onMouseDown={(e) => handleMouseDownResize(e, 'se')}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5"
          >
            <div className="w-2 h-2 border-r-2 border-b-2 border-gray-500 hover:border-cyan-400" />
          </div>
          <div
            onMouseDown={(e) => handleMouseDownResize(e, 'w')}
            className="absolute top-0 left-0 w-2 h-full cursor-w-resize hover:bg-cyan-500/30"
          />
        </>
      )}
    </div>
  );
}
