import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Grid, 
  Magnet, 
  LayoutGrid, 
  Copy, 
  Scissors, 
  Clipboard, 
  Trash2, 
  ArrowUp, 
  ArrowDown, 
  AlignCenter, 
  Maximize2,
  Edit3,
  Layers,
  RotateCw
} from 'lucide-react';
import { Slide, SlideObject, ShapeType } from '../../types';

interface SlideCanvasProps {
  slide: Slide;
  selectedObjectIds: string[];
  onSelectObjects: (ids: string[]) => void;
  onUpdateObjects: (objects: SlideObject[], pushHistory?: boolean) => void;
  zoom: number;
  showSafeMargins?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  isTransitionPlaying?: boolean;
}

const DEFAULT_CANVAS_WIDTH = 1920;
const DEFAULT_CANVAS_HEIGHT = 1080;

// Persistent clipboard for cut / copy / paste across slides
let globalSlideObjectClipboard: SlideObject[] = [];

// Helper to determine canvas dimensions from slide aspect ratio
function getSlideCanvasDimensions(slide?: Slide): { width: number; height: number } {
  if (!slide) return { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT };
  if (slide.aspectRatioLabel?.includes('4:3') || (slide.aspectRatio && Math.abs(slide.aspectRatio - 4 / 3) < 0.05)) {
    return { width: 1440, height: 1080 };
  }
  if (slide.aspectRatioLabel?.includes('16:10') || (slide.aspectRatio && Math.abs(slide.aspectRatio - 16 / 10) < 0.05)) {
    return { width: 1920, height: 1200 };
  }
  if (slide.aspectRatioLabel?.includes('21:9') || (slide.aspectRatio && Math.abs(slide.aspectRatio - 21 / 9) < 0.05)) {
    return { width: 2560, height: 1080 };
  }
  if (slide.aspectRatioLabel?.includes('1:1') || (slide.aspectRatio && Math.abs(slide.aspectRatio - 1) < 0.05)) {
    return { width: 1080, height: 1080 };
  }
  if (slide.aspectRatioLabel?.includes('9:16') || (slide.aspectRatio && Math.abs(slide.aspectRatio - 9 / 16) < 0.05)) {
    return { width: 1080, height: 1920 };
  }
  return { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT };
}

export const SlideCanvas: React.FC<SlideCanvasProps> = ({
  slide,
  selectedObjectIds = [],
  onSelectObjects,
  onUpdateObjects,
  zoom = 1,
  showSafeMargins = false,
  onUndo,
  onRedo,
  isTransitionPlaying = false,
}) => {
  if (!slide) {
    return (
      <div className="w-full h-full flex items-center justify-center text-slate-500">
        No active slide
      </div>
    );
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { width: canvasWidth, height: canvasHeight } = getSlideCanvasDimensions(slide);

  // In-line Text Editing State (Double click PowerPoint style)
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState<string>('');

  // Dragging / Resizing State
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragDistance, setDragDistance] = useState<number>(0);
  const [initialObjectsPos, setInitialObjectsPos] = useState<Map<string, { x: number; y: number; width: number; height: number; rotation: number }>>(new Map());
  const [activeHandle, setActiveHandle] = useState<string | null>(null); // 'drag', 'tl', 'tr', 'bl', 'br', 'tm', 'bm', 'ml', 'mr', 'rotate'

  // Marquee (Rubber-Band) Selection State
  const [isMarqueeActive, setIsMarqueeActive] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState<{ x: number; y: number } | null>(null);

  // PowerPoint Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; objId?: string } | null>(null);

  // Snap-to-Grid & Alignment Settings State
  const [showGridOverlay, setShowGridOverlay] = useState<boolean>(true);
  const [snapToGrid, setSnapToGrid] = useState<boolean>(true);
  const [snapToObjects, setSnapToObjects] = useState<boolean>(true);
  const [gridSize, setGridSize] = useState<number>(20);

  // Alignment Guides State
  const [guides, setGuides] = useState<{ x?: number; y?: number; xLabel?: string; yLabel?: string }>({});

  const objects = slide.objects || [];

  // Helper to scale screen mouse coords to canvas coords
  const getCanvasCoords = (e: React.MouseEvent | MouseEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasWidth / rect.width;
    const scaleY = canvasHeight / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  // Close context menu on window click
  useEffect(() => {
    const handleGlobalClick = () => {
      if (contextMenu) setContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [contextMenu]);

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editingTextId && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [editingTextId]);

  // ==========================================
  // CLIPBOARD & OBJECT ACTIONS (PowerPoint Style)
  // ==========================================
  const handleCopy = () => {
    if (selectedObjectIds.length === 0) return;
    const selectedSet = new Set(selectedObjectIds);
    globalSlideObjectClipboard = objects
      .filter((o) => selectedSet.has(o.id))
      .map((o) => ({ ...o }));
  };

  const handleCut = () => {
    if (selectedObjectIds.length === 0) return;
    handleCopy();
    const selectedSet = new Set(selectedObjectIds);
    const remaining = objects.filter((o) => !selectedSet.has(o.id));
    onUpdateObjects(remaining, true);
    onSelectObjects([]);
  };

  const handlePaste = () => {
    if (globalSlideObjectClipboard.length === 0) return;
    const newPasted = globalSlideObjectClipboard.map((o, idx) => ({
      ...o,
      id: `obj-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      x: o.x + 30,
      y: o.y + 30,
    }));
    // Update clipboard so subsequent pastes keep offsetting
    globalSlideObjectClipboard = newPasted;
    onUpdateObjects([...objects, ...newPasted], true);
    onSelectObjects(newPasted.map((o) => o.id));
  };

  const handleDuplicate = () => {
    if (selectedObjectIds.length === 0) return;
    const selectedSet = new Set(selectedObjectIds);
    const duplicated = objects
      .filter((o) => selectedSet.has(o.id))
      .map((o) => ({
        ...o,
        id: `obj-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        x: o.x + 30,
        y: o.y + 30,
      }));
    onUpdateObjects([...objects, ...duplicated], true);
    onSelectObjects(duplicated.map((o) => o.id));
  };

  const handleDelete = () => {
    if (selectedObjectIds.length === 0) return;
    const selectedSet = new Set(selectedObjectIds);
    const remaining = objects.filter((o) => !selectedSet.has(o.id));
    onUpdateObjects(remaining, true);
    onSelectObjects([]);
  };

  const handleSelectAll = () => {
    onSelectObjects(objects.map((o) => o.id));
  };

  const handleBringForward = () => {
    if (selectedObjectIds.length === 0) return;
    const selectedSet = new Set(selectedObjectIds);
    const newObjs = [...objects];
    for (let i = newObjs.length - 2; i >= 0; i--) {
      if (selectedSet.has(newObjs[i].id) && !selectedSet.has(newObjs[i + 1].id)) {
        const temp = newObjs[i];
        newObjs[i] = newObjs[i + 1];
        newObjs[i + 1] = temp;
      }
    }
    onUpdateObjects(newObjs, true);
  };

  const handleSendBackward = () => {
    if (selectedObjectIds.length === 0) return;
    const selectedSet = new Set(selectedObjectIds);
    const newObjs = [...objects];
    for (let i = 1; i < newObjs.length; i++) {
      if (selectedSet.has(newObjs[i].id) && !selectedSet.has(newObjs[i - 1].id)) {
        const temp = newObjs[i];
        newObjs[i] = newObjs[i - 1];
        newObjs[i - 1] = temp;
      }
    }
    onUpdateObjects(newObjs, true);
  };

  const handleBringToFront = () => {
    if (selectedObjectIds.length === 0) return;
    const selectedSet = new Set(selectedObjectIds);
    const unselected = objects.filter((o) => !selectedSet.has(o.id));
    const selected = objects.filter((o) => selectedSet.has(o.id));
    onUpdateObjects([...unselected, ...selected], true);
  };

  const handleSendToBack = () => {
    if (selectedObjectIds.length === 0) return;
    const selectedSet = new Set(selectedObjectIds);
    const unselected = objects.filter((o) => !selectedSet.has(o.id));
    const selected = objects.filter((o) => selectedSet.has(o.id));
    onUpdateObjects([...selected, ...unselected], true);
  };

  const handleCenterHorizontally = () => {
    if (selectedObjectIds.length === 0) return;
    const selectedSet = new Set(selectedObjectIds);
    const updated = objects.map((o) => {
      if (selectedSet.has(o.id)) {
        return { ...o, x: Math.round((canvasWidth - o.width) / 2) };
      }
      return o;
    });
    onUpdateObjects(updated, true);
  };

  const handleCenterVertically = () => {
    if (selectedObjectIds.length === 0) return;
    const selectedSet = new Set(selectedObjectIds);
    const updated = objects.map((o) => {
      if (selectedSet.has(o.id)) {
        return { ...o, y: Math.round((canvasHeight - o.height) / 2) };
      }
      return o;
    });
    onUpdateObjects(updated, true);
  };

  // ==========================================
  // KEYBOARD SHORTCUTS ENGINE
  // ==========================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If currently editing text, handle Escape and Ctrl+Enter specially
      if (editingTextId) {
        if (e.key === 'Escape') {
          handleInlineTextSave();
          e.preventDefault();
        } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          handleInlineTextSave();
          e.preventDefault();
        }
        return;
      }

      // Skip shortcuts if typing inside an external input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Escape: Deselect all
      if (e.key === 'Escape') {
        onSelectObjects([]);
        e.preventDefault();
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          onRedo?.();
        } else {
          onUndo?.();
        }
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        onRedo?.();
        e.preventDefault();
        return;
      }

      // Select All: Ctrl+A / Cmd+A
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        handleSelectAll();
        return;
      }

      // Copy: Ctrl+C / Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopy();
        return;
      }

      // Cut: Ctrl+X / Cmd+X
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        handleCut();
        return;
      }

      // Paste: Ctrl+V / Cmd+V
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePaste();
        return;
      }

      // Duplicate: Ctrl+D / Cmd+D
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicate();
        return;
      }

      // Layer Arrange: Ctrl+Shift+] (Front), Ctrl+] (Forward), Ctrl+[ (Backward), Ctrl+Shift+[ (Back)
      if ((e.ctrlKey || e.metaKey) && e.key === ']') {
        e.preventDefault();
        if (e.shiftKey) {
          handleBringToFront();
        } else {
          handleBringForward();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '[') {
        e.preventDefault();
        if (e.shiftKey) {
          handleSendToBack();
        } else {
          handleSendBackward();
        }
        return;
      }

      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
        return;
      }

      // Arrow Key Nudge (2px or 10px with Shift)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (selectedObjectIds.length > 0) {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 2;
          const selectedSet = new Set(selectedObjectIds);
          let dx = 0;
          let dy = 0;
          if (e.key === 'ArrowUp') dy = -step;
          if (e.key === 'ArrowDown') dy = step;
          if (e.key === 'ArrowLeft') dx = -step;
          if (e.key === 'ArrowRight') dx = step;

          const updated = objects.map((o) => {
            if (selectedSet.has(o.id) && !o.locked) {
              return { ...o, x: o.x + dx, y: o.y + dy };
            }
            return o;
          });
          onUpdateObjects(updated, false);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [objects, selectedObjectIds, editingTextId, onUndo, onRedo, onUpdateObjects, onSelectObjects]);

  // ==========================================
  // OBJECT MOUSE DOWN: 1-CLICK SELECT & START DRAG
  // ==========================================
  const handleObjectMouseDown = (e: React.MouseEvent, objId: string) => {
    e.stopPropagation();
    if (e.button === 2) return; // Ignore right click (handled by context menu)

    // Commit any active text editing
    if (editingTextId && editingTextId !== objId) {
      handleInlineTextSave();
    }

    // Multi-select with Shift or Ctrl
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      if (selectedObjectIds.includes(objId)) {
        onSelectObjects(selectedObjectIds.filter((id) => id !== objId));
      } else {
        onSelectObjects([...selectedObjectIds, objId]);
      }
      return;
    }

    // 1-Click Select: If not selected, select it immediately
    const isAlreadySelected = selectedObjectIds.includes(objId);
    if (!isAlreadySelected) {
      onSelectObjects([objId]);
    }

    // Prepare positions for smooth simultaneous multi-object dragging
    const currentSelected = isAlreadySelected ? selectedObjectIds : [objId];
    const initialMap = new Map();
    objects.forEach((o) => {
      if (currentSelected.includes(o.id)) {
        initialMap.set(o.id, { x: o.x, y: o.y, width: o.width, height: o.height, rotation: o.rotation || 0 });
      }
    });

    setIsDragging(true);
    setActiveHandle('drag');
    setDragDistance(0);
    setDragStartPos(getCanvasCoords(e));
    setInitialObjectsPos(initialMap);
  };

  // Transform Handle Mouse Down (Resize / Rotate)
  const handleTransformHandleMouseDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    if (selectedObjectIds.length === 0) return;

    const initialMap = new Map();
    objects.forEach((o) => {
      if (selectedObjectIds.includes(o.id)) {
        initialMap.set(o.id, { x: o.x, y: o.y, width: o.width, height: o.height, rotation: o.rotation || 0 });
      }
    });

    setIsDragging(true);
    setActiveHandle(handle);
    setDragDistance(0);
    setDragStartPos(getCanvasCoords(e));
    setInitialObjectsPos(initialMap);
  };

  // Canvas Background Mouse Down (Start Marquee Selection or Deselect)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) return; // Right click handled separately

    // If editing text, save & close
    if (editingTextId) {
      handleInlineTextSave();
    }

    const coords = getCanvasCoords(e);
    setIsMarqueeActive(true);
    setMarqueeStart(coords);
    setMarqueeCurrent(coords);

    // If not holding shift/ctrl, clear existing selection
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      onSelectObjects([]);
    }
  };

  // ==========================================
  // MOUSE MOVE: DRAG OBJECTS, RESIZE, OR MARQUEE
  // ==========================================
  const handleMouseMove = (e: React.MouseEvent) => {
    const currentCoords = getCanvasCoords(e);

    // 1. Marquee Selection
    if (isMarqueeActive && marqueeStart) {
      setMarqueeCurrent(currentCoords);
      return;
    }

    // 2. Object Dragging or Resizing
    if (!isDragging || !activeHandle) return;

    const dx = currentCoords.x - dragStartPos.x;
    const dy = currentCoords.y - dragStartPos.y;
    setDragDistance((prev) => prev + Math.abs(dx) + Math.abs(dy));

    const selectedSet = new Set(selectedObjectIds);
    let guideX: number | undefined;
    let guideY: number | undefined;
    let guideXLabel: string | undefined;
    let guideYLabel: string | undefined;

    const SNAP_THRESHOLD = 12;

    const updated = objects.map((obj) => {
      if (!selectedSet.has(obj.id) || obj.locked) return obj;

      const initial = initialObjectsPos.get(obj.id);
      if (!initial) return obj;

      if (activeHandle === 'drag') {
        let newX = initial.x + dx;
        let newY = initial.y + dy;

        const objCX = newX + obj.width / 2;
        const objCY = newY + obj.height / 2;

        // Snapping: 1. Slide Center
        if (Math.abs(objCX - canvasWidth / 2) < SNAP_THRESHOLD) {
          newX = canvasWidth / 2 - obj.width / 2;
          guideX = canvasWidth / 2;
          guideXLabel = 'Slide Center (X)';
        }
        if (Math.abs(objCY - canvasHeight / 2) < SNAP_THRESHOLD) {
          newY = canvasHeight / 2 - obj.height / 2;
          guideY = canvasHeight / 2;
          guideYLabel = 'Slide Center (Y)';
        }

        // Snapping: 2. Other Objects
        if (snapToObjects) {
          const otherObjects = objects.filter((o) => !selectedSet.has(o.id));
          for (const other of otherObjects) {
            const otherCX = other.x + other.width / 2;
            const otherCY = other.y + other.height / 2;

            if (Math.abs(newX - other.x) < SNAP_THRESHOLD) {
              newX = other.x;
              guideX = other.x;
              guideXLabel = 'Align Left';
            } else if (Math.abs(newX + obj.width - (other.x + other.width)) < SNAP_THRESHOLD) {
              newX = other.x + other.width - obj.width;
              guideX = other.x + other.width;
              guideXLabel = 'Align Right';
            } else if (Math.abs(objCX - otherCX) < SNAP_THRESHOLD) {
              newX = otherCX - obj.width / 2;
              guideX = otherCX;
              guideXLabel = 'Center Align';
            }

            if (Math.abs(newY - other.y) < SNAP_THRESHOLD) {
              newY = other.y;
              guideY = other.y;
              guideYLabel = 'Align Top';
            } else if (Math.abs(newY + obj.height - (other.y + other.height)) < SNAP_THRESHOLD) {
              newY = other.y + other.height - obj.height;
              guideY = other.y + other.height;
              guideYLabel = 'Align Bottom';
            } else if (Math.abs(objCY - otherCY) < SNAP_THRESHOLD) {
              newY = otherCY - obj.height / 2;
              guideY = otherCY;
              guideYLabel = 'Center Align';
            }
          }
        }

        // Snapping: 3. Grid
        if (snapToGrid) {
          if (guideX === undefined) {
            const snappedX = Math.round(newX / gridSize) * gridSize;
            if (Math.abs(newX - snappedX) < 8) {
              newX = snappedX;
              guideX = snappedX;
              guideXLabel = `${gridSize}px Grid`;
            }
          }
          if (guideY === undefined) {
            const snappedY = Math.round(newY / gridSize) * gridSize;
            if (Math.abs(newY - snappedY) < 8) {
              newY = snappedY;
              guideY = snappedY;
              guideYLabel = `${gridSize}px Grid`;
            }
          }
        }

        return { ...obj, x: Math.round(newX), y: Math.round(newY) };
      }

      if (activeHandle === 'rotate') {
        const centerX = initial.x + initial.width / 2;
        const centerY = initial.y + initial.height / 2;
        const rad = Math.atan2(currentCoords.y - centerY, currentCoords.x - centerX);
        let deg = Math.round((rad * 180) / Math.PI + 90);
        if (deg < 0) deg += 360;
        if (Math.abs(deg) < 5 || Math.abs(deg - 360) < 5) deg = 0;
        if (Math.abs(deg - 90) < 5) deg = 90;
        if (Math.abs(deg - 180) < 5) deg = 180;
        if (Math.abs(deg - 270) < 5) deg = 270;
        return { ...obj, rotation: deg };
      }

      // Resize handles
      let newX = initial.x;
      let newY = initial.y;
      let newWidth = initial.width;
      let newHeight = initial.height;

      if (activeHandle.includes('r')) newWidth = Math.max(40, initial.width + dx);
      if (activeHandle.includes('b')) newHeight = Math.max(25, initial.height + dy);
      if (activeHandle.includes('l')) {
        const possibleW = initial.width - dx;
        if (possibleW > 40) {
          newX = initial.x + dx;
          newWidth = possibleW;
        }
      }
      if (activeHandle.includes('t')) {
        const possibleH = initial.height - dy;
        if (possibleH > 25) {
          newY = initial.y + dy;
          newHeight = possibleH;
        }
      }

      return {
        ...obj,
        x: Math.round(newX),
        y: Math.round(newY),
        width: Math.round(newWidth),
        height: Math.round(newHeight),
      };
    });

    setGuides({ x: guideX, y: guideY, xLabel: guideXLabel, yLabel: guideYLabel });
    onUpdateObjects(updated, false);
  };

  // ==========================================
  // MOUSE UP: FINALIZE DRAG, RESIZE, OR MARQUEE
  // ==========================================
  const handleMouseUp = () => {
    // 1. Marquee Finish
    if (isMarqueeActive && marqueeStart && marqueeCurrent) {
      const boxLeft = Math.min(marqueeStart.x, marqueeCurrent.x);
      const boxTop = Math.min(marqueeStart.y, marqueeCurrent.y);
      const boxRight = Math.max(marqueeStart.x, marqueeCurrent.x);
      const boxBottom = Math.max(marqueeStart.y, marqueeCurrent.y);
      const boxWidth = boxRight - boxLeft;
      const boxHeight = boxBottom - boxTop;

      // Only treat as marquee if dragged more than 5px
      if (boxWidth > 5 || boxHeight > 5) {
        const enclosedOrIntersected = objects.filter((o) => {
          const oRight = o.x + o.width;
          const oBottom = o.y + o.height;
          return o.x < boxRight && oRight > boxLeft && o.y < boxBottom && oBottom > boxTop;
        });
        onSelectObjects(enclosedOrIntersected.map((o) => o.id));
      } else {
        // Simple click on empty canvas
        onSelectObjects([]);
      }

      setIsMarqueeActive(false);
      setMarqueeStart(null);
      setMarqueeCurrent(null);
      return;
    }

    // 2. Drag / Resize Finish
    if (isDragging || activeHandle) {
      if (dragDistance > 3) {
        onUpdateObjects(objects, true); // Push to undo history
      }
    }

    setIsDragging(false);
    setActiveHandle(null);
    setGuides({});
  };

  // ==========================================
  // DOUBLE CLICK TO EDIT TEXT (PowerPoint Style)
  // ==========================================
  const handleTextDoubleClick = (e: React.MouseEvent, obj: SlideObject) => {
    e.stopPropagation();
    if (obj.type === 'text' || obj.type === 'shape') {
      setEditingTextId(obj.id);
      setEditingTextValue(obj.text || '');
    }
  };

  const handleInlineTextSave = () => {
    if (editingTextId) {
      const updated = objects.map((o) => (o.id === editingTextId ? { ...o, text: editingTextValue } : o));
      onUpdateObjects(updated, true);
      setEditingTextId(null);
    }
  };

  // ==========================================
  // CONTEXT MENU (Right Click)
  // ==========================================
  const handleContextMenu = (e: React.MouseEvent, objId?: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (objId && !selectedObjectIds.includes(objId)) {
      onSelectObjects([objId]);
    }

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    setContextMenu({
      x: e.clientX - containerRect.left,
      y: e.clientY - containerRect.top,
      objId,
    });
  };

  // ==========================================
  // OS DRAG & DROP OF IMAGE FILES ONTO CANVAS
  // ==========================================
  const handleDropFromOS = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const coords = getCanvasCoords(e);
        const reader = new FileReader();
        reader.onload = (evt) => {
          const dataUrl = evt.target?.result as string;
          if (dataUrl) {
            const newImgObj: SlideObject = {
              id: `obj-${Date.now()}-img`,
              type: 'image',
              imageUrl: dataUrl,
              x: Math.max(20, Math.round(coords.x - 300)),
              y: Math.max(20, Math.round(coords.y - 200)),
              width: 640,
              height: 400,
              style: {
                borderRadius: 8,
                shadowEnabled: true,
                shadowBlur: 14,
                shadowOffsetY: 4,
              },
            };
            onUpdateObjects([...objects, newImgObj], true);
            onSelectObjects([newImgObj.id]);
          }
        };
        reader.readAsDataURL(file);
      }
    }
  };

  // Bounding Box Calculation for Selected Object(s)
  const selectedObjects = objects.filter((o) => selectedObjectIds.includes(o.id));
  let bbox = null;
  if (selectedObjects.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    selectedObjects.forEach((o) => {
      minX = Math.min(minX, o.x);
      minY = Math.min(minY, o.y);
      maxX = Math.max(maxX, o.x + o.width);
      maxY = Math.max(maxY, o.y + o.height);
    });
    bbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  // Marquee visual box calculation
  const marqueeBox = useMemo(() => {
    if (!isMarqueeActive || !marqueeStart || !marqueeCurrent) return null;
    const x = Math.min(marqueeStart.x, marqueeCurrent.x);
    const y = Math.min(marqueeStart.y, marqueeCurrent.y);
    const width = Math.abs(marqueeCurrent.x - marqueeStart.x);
    const height = Math.abs(marqueeCurrent.y - marqueeStart.y);
    return { x, y, width, height };
  }, [isMarqueeActive, marqueeStart, marqueeCurrent]);

  // Background style
  const bgStyle: React.CSSProperties = useMemo(() => {
    if (slide.backgroundUrl) {
      return {
        backgroundImage: `url(${slide.backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    if (slide.backgroundColor) {
      return { backgroundColor: slide.backgroundColor };
    }
    return { backgroundColor: '#0f172a' };
  }, [slide.backgroundUrl, slide.backgroundColor]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center bg-slate-950 overflow-auto p-6 relative select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => handleContextMenu(e)}
    >
      {/* FLOATING CANVAS GRID & ALIGNMENT CONTROLS */}
      <div className="absolute top-4 right-6 z-30 flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 rounded-lg p-1 text-xs text-slate-200 shadow-xl backdrop-blur-md">
        <button
          type="button"
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
            showGridOverlay ? 'bg-sky-600/30 text-sky-300 font-semibold border border-sky-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setShowGridOverlay(!showGridOverlay);
          }}
          title="Toggle Visual Grid Pattern"
        >
          <Grid size={13} className={showGridOverlay ? 'text-sky-400' : 'text-slate-400'} />
          <span>Grid</span>
        </button>

        <button
          type="button"
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
            snapToGrid ? 'bg-emerald-600/30 text-emerald-300 font-semibold border border-emerald-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setSnapToGrid(!snapToGrid);
          }}
          title="Toggle Snap to Grid Lines"
        >
          <LayoutGrid size={13} className={snapToGrid ? 'text-emerald-400' : 'text-slate-400'} />
          <span>Snap Grid</span>
        </button>

        <button
          type="button"
          className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
            snapToObjects ? 'bg-indigo-600/30 text-indigo-300 font-semibold border border-indigo-500/40' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            setSnapToObjects(!snapToObjects);
          }}
          title="Toggle Object-to-Object Smart Alignment Guides"
        >
          <Magnet size={13} className={snapToObjects ? 'text-indigo-400' : 'text-slate-400'} />
          <span>Snap Objects</span>
        </button>

        {/* Grid Size */}
        <select
          className="bg-slate-950 border border-slate-700/80 text-slate-300 text-[11px] rounded px-1.5 py-0.5 outline-none focus:border-sky-500"
          value={gridSize}
          onChange={(e) => {
            e.stopPropagation();
            setGridSize(Number(e.target.value));
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <option value={10}>10px</option>
          <option value={20}>20px</option>
          <option value={40}>40px</option>
          <option value={50}>50px</option>
        </select>
      </div>

      {/* SCALED CANVAS CONTAINER */}
      <div
        className={`shrink-0 relative my-auto mx-auto shadow-2xl overflow-hidden rounded-md border border-slate-800 transition-all ${
          isTransitionPlaying ? 'animate-pulse ring-4 ring-sky-500/60' : ''
        }`}
        style={{
          width: `${canvasWidth * zoom}px`,
          height: `${canvasHeight * zoom}px`,
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={handleDropFromOS}
      >
        <div
          ref={canvasRef}
          className="relative overflow-hidden pointer-events-auto"
          style={{
            width: `${canvasWidth}px`,
            height: `${canvasHeight}px`,
            transform: `scale(${zoom})`,
            transformOrigin: 'top left',
            ...bgStyle,
          }}
          onMouseDown={handleCanvasMouseDown}
        >
          {/* Dimmer Overlay */}
          {slide.overlayDimmer && slide.overlayDimmer > 0 ? (
            <div
              className="absolute inset-0 pointer-events-none z-0 bg-black transition-opacity"
              style={{ opacity: slide.overlayDimmer / 100 }}
            />
          ) : null}

          {/* Broadcast Safe Margins */}
          {showSafeMargins && (
            <div className="absolute inset-0 pointer-events-none z-40">
              <div className="absolute inset-[3.5%] border border-amber-500/50 border-dashed rounded flex flex-col justify-between p-1.5">
                <span className="text-[10px] font-mono font-bold text-amber-400 bg-slate-950/80 px-1.5 py-0.5 rounded w-max shadow-sm">
                  Action Safe (93%)
                </span>
              </div>
              <div className="absolute inset-[5%] border border-sky-400/60 border-dashed rounded flex flex-col justify-end items-end p-1.5">
                <span className="text-[10px] font-mono font-bold text-sky-400 bg-slate-950/80 px-1.5 py-0.5 rounded w-max shadow-sm">
                  Title Safe (90%)
                </span>
              </div>
            </div>
          )}

          {/* Grid Overlay */}
          {showGridOverlay && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20 z-0">
              <defs>
                <pattern id={`grid-pattern-${gridSize}`} width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
                  <circle cx={gridSize} cy={gridSize} r={1.2} fill="#38bdf8" />
                  <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="#38bdf8" strokeWidth="0.5" strokeDasharray="2 4" opacity="0.6" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill={`url(#grid-pattern-${gridSize})`} />
            </svg>
          )}

          {/* CANVAS OBJECTS */}
          {objects
            .filter((o) => o.visible !== false)
            .map((obj) => {
              const isSelected = selectedObjectIds.includes(obj.id);
              const isEditing = editingTextId === obj.id;
              const style = obj.style || {};

              const isDarkBg = !slide.backgroundColor || slide.backgroundColor.startsWith('#1') || slide.backgroundColor.startsWith('#0') || slide.backgroundColor.startsWith('#2') || slide.backgroundColor.startsWith('#3') || Boolean(slide.backgroundUrl);
              const fontSz = style.fontSize || 36;
              const fontColor = style.fontColor || (isDarkBg ? '#FFFFFF' : '#0f172a');
              const fontFamily = style.fontFamily || 'sans-serif';

              return (
                <div
                  key={obj.id}
                  className={`absolute cursor-move box-border transition-shadow select-none ${
                    isSelected ? 'ring-2 ring-sky-500 ring-offset-1 ring-offset-slate-900 shadow-xl' : 'hover:ring-1 hover:ring-sky-400/40'
                  }`}
                  style={{
                    left: `${obj.x}px`,
                    top: `${obj.y}px`,
                    width: `${obj.width}px`,
                    height: `${obj.height}px`,
                    transform: `rotate(${obj.rotation || 0}deg)`,
                    zIndex: obj.zIndex ?? 1,
                    opacity: (obj.opacity ?? 1) * (style.opacity ?? 1),
                    backgroundColor: style.backgroundColor || 'transparent',
                    borderColor: style.borderColor || 'transparent',
                    borderWidth: style.borderWidth ? `${style.borderWidth}px` : 0,
                    borderStyle: style.borderColor ? 'solid' : 'none',
                    borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
                    padding: style.padding ? `${style.padding}px` : '4px',
                  }}
                  onMouseDown={(e) => handleObjectMouseDown(e, obj.id)}
                  onDoubleClick={(e) => handleTextDoubleClick(e, obj)}
                  onContextMenu={(e) => handleContextMenu(e, obj.id)}
                >
                  {/* TEXT OBJECT */}
                  {obj.type === 'text' && (
                    isEditing ? (
                      <textarea
                        ref={textareaRef}
                        className="w-full h-full bg-slate-900/90 border-2 border-sky-400 rounded p-2 resize-none outline-none leading-relaxed shadow-2xl focus:ring-2 focus:ring-sky-400"
                        style={{
                          fontFamily,
                          fontSize: `${fontSz}px`,
                          color: fontColor,
                          fontWeight: style.fontWeight || 'normal',
                          fontStyle: style.fontStyle || 'normal',
                          textDecoration: style.textDecoration || 'none',
                          textAlign: style.textAlign || 'left',
                          lineHeight: style.lineSpacing ? `${style.lineSpacing}` : 1.35,
                        }}
                        value={editingTextValue}
                        onChange={(e) => setEditingTextValue(e.target.value)}
                        onBlur={handleInlineTextSave}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div
                        className="w-full h-full leading-relaxed break-words whitespace-pre-wrap flex flex-col pointer-events-none"
                        style={{
                          fontFamily,
                          fontSize: `${fontSz}px`,
                          color: fontColor,
                          fontWeight: style.fontWeight || 'normal',
                          fontStyle: style.fontStyle || 'normal',
                          textDecoration: style.textDecoration || 'none',
                          textAlign: style.textAlign || 'left',
                          letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
                          lineHeight: style.lineSpacing ? `${style.lineSpacing}` : 1.35,
                          textTransform: (style as any).textTransform || undefined,
                          justifyContent: style.alignVertical === 'bottom' ? 'flex-end' : style.alignVertical === 'middle' ? 'center' : 'flex-start',
                          textShadow: style.shadowEnabled ? `${style.shadowOffsetX || 0}px ${style.shadowOffsetY || 4}px ${style.shadowBlur || 8}px ${style.shadowColor || 'rgba(0,0,0,0.85)'}` : undefined,
                        }}
                      >
                        {obj.text || 'Click to edit text'}
                      </div>
                    )
                  )}

                  {/* IMAGE OBJECT */}
                  {obj.type === 'image' && obj.imageUrl && (
                    <img 
                      src={obj.imageUrl} 
                      alt="" 
                      className="w-full h-full object-cover pointer-events-none rounded" 
                      style={{
                        borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
                        filter: style.shadowEnabled ? `drop-shadow(0px 8px 16px ${style.shadowColor || 'rgba(0,0,0,0.6)'})` : undefined,
                      }}
                    />
                  )}

                  {/* SHAPE OBJECT */}
                  {obj.type === 'shape' && (
                    <div className="w-full h-full flex items-center justify-center relative overflow-hidden pointer-events-none">
                      {isEditing ? (
                        <input
                          ref={textareaRef as any}
                          type="text"
                          className="w-full text-center bg-slate-900/90 border border-sky-400 p-1 font-sans outline-none rounded pointer-events-auto"
                          style={{
                            fontSize: `${fontSz}px`,
                            color: style.fontColor || '#FFFFFF',
                            fontFamily,
                            fontWeight: style.fontWeight || 'normal',
                          }}
                          value={editingTextValue}
                          onChange={(e) => setEditingTextValue(e.target.value)}
                          onBlur={handleInlineTextSave}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                      ) : (
                        obj.text && (
                          <span
                            className="z-10 px-2 text-center"
                            style={{
                              fontSize: `${fontSz}px`,
                              color: style.fontColor || '#FFFFFF',
                              fontFamily,
                              fontWeight: style.fontWeight || 'bold',
                              textShadow: '0 2px 4px rgba(0,0,0,0.7)',
                            }}
                          >
                            {obj.text}
                          </span>
                        )
                      )}
                    </div>
                  )}

                  {/* DIVIDER LINE OBJECT */}
                  {obj.type === 'line' && (
                    <div className="w-full h-full flex items-center pointer-events-none">
                      <div className="w-full" style={{ height: `${style.borderWidth || 4}px`, backgroundColor: style.borderColor || '#38bdf8' }} />
                    </div>
                  )}

                  {/* PLACEHOLDER / ENTERPRISE CARDS */}
                  {obj.type === 'placeholder' && (
                    <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-sky-400 bg-sky-500/10 text-sky-200 font-medium p-4 text-center text-lg pointer-events-none">
                      {obj.placeholderLabel || obj.text || 'Click to add content'}
                    </div>
                  )}
                </div>
              );
            })}

          {/* VISUAL SNAP ALIGNMENT GUIDES */}
          {guides.x !== undefined && (
            <div
              className="absolute top-0 bottom-0 border-l-2 border-dashed border-pink-500 z-50 pointer-events-none flex flex-col justify-start items-center"
              style={{ left: `${guides.x}px` }}
            >
              <div className="bg-pink-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg mt-2 whitespace-nowrap opacity-90 tracking-wide border border-pink-400">
                {guides.xLabel ? `${guides.xLabel} • ${Math.round(guides.x)}px` : `${Math.round(guides.x)}px`}
              </div>
            </div>
          )}
          {guides.y !== undefined && (
            <div
              className="absolute left-0 right-0 border-t-2 border-dashed border-pink-500 z-50 pointer-events-none flex justify-start items-center"
              style={{ top: `${guides.y}px` }}
            >
              <div className="bg-pink-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-lg ml-2 -mt-3 whitespace-nowrap opacity-90 tracking-wide border border-pink-400">
                {guides.yLabel ? `${guides.yLabel} • ${Math.round(guides.y)}px` : `${Math.round(guides.y)}px`}
              </div>
            </div>
          )}

          {/* MARQUEE (RUBBER-BAND) SELECTION RECTANGLE */}
          {marqueeBox && (
            <div
              className="absolute border-2 border-sky-400 border-dashed bg-sky-500/15 pointer-events-none z-50 rounded"
              style={{
                left: `${marqueeBox.x}px`,
                top: `${marqueeBox.y}px`,
                width: `${marqueeBox.width}px`,
                height: `${marqueeBox.height}px`,
              }}
            />
          )}

          {/* SELECTION BOUNDING BOX & TRANSFORM HANDLES */}
          {bbox && selectedObjectIds.length > 0 && !editingTextId && (
            <div
              className="absolute border-2 border-sky-500 pointer-events-none z-40"
              style={{
                left: `${bbox.x}px`,
                top: `${bbox.y}px`,
                width: `${bbox.width}px`,
                height: `${bbox.height}px`,
              }}
            >
              {/* Rotation Handle */}
              <div
                className="absolute -top-7 left-1/2 -translate-x-1/2 w-4 h-4 bg-sky-500 border-2 border-white rounded-full cursor-grab pointer-events-auto flex items-center justify-center shadow-md hover:scale-125 transition-transform"
                onMouseDown={(e) => handleTransformHandleMouseDown(e, 'rotate')}
                title="Drag to Rotate"
              >
                <div className="w-1 h-1 bg-white rounded-full" />
              </div>
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-0.5 h-3 bg-sky-500" />

              {/* Corner Handles */}
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-sky-500 cursor-nwse-resize pointer-events-auto shadow-sm" onMouseDown={(e) => handleTransformHandleMouseDown(e, 'tl')} />
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-sky-500 cursor-ns-resize pointer-events-auto shadow-sm" onMouseDown={(e) => handleTransformHandleMouseDown(e, 'tm')} />
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-sky-500 cursor-nesw-resize pointer-events-auto shadow-sm" onMouseDown={(e) => handleTransformHandleMouseDown(e, 'tr')} />

              {/* Middle Handles */}
              <div className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-white border-2 border-sky-500 cursor-ew-resize pointer-events-auto shadow-sm" onMouseDown={(e) => handleTransformHandleMouseDown(e, 'ml')} />
              <div className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-white border-2 border-sky-500 cursor-ew-resize pointer-events-auto shadow-sm" onMouseDown={(e) => handleTransformHandleMouseDown(e, 'mr')} />

              {/* Bottom Handles */}
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-sky-500 cursor-nesw-resize pointer-events-auto shadow-sm" onMouseDown={(e) => handleTransformHandleMouseDown(e, 'bl')} />
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-sky-500 cursor-ns-resize pointer-events-auto shadow-sm" onMouseDown={(e) => handleTransformHandleMouseDown(e, 'bm')} />
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-sky-500 cursor-nwse-resize pointer-events-auto shadow-sm" onMouseDown={(e) => handleTransformHandleMouseDown(e, 'br')} />
            </div>
          )}
        </div>
      </div>

      {/* POWERPOINT RIGHT-CLICK CONTEXT MENU */}
      {contextMenu && (
        <div
          className="absolute z-50 bg-slate-900 border border-slate-700/90 rounded-lg shadow-2xl py-1.5 w-52 text-xs text-slate-200 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.objId && (
            <>
              <button
                className="w-full px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center justify-between text-left transition-colors"
                onClick={() => {
                  const target = objects.find((o) => o.id === contextMenu.objId);
                  if (target) handleTextDoubleClick({ stopPropagation: () => {} } as any, target);
                  setContextMenu(null);
                }}
              >
                <span className="flex items-center gap-2"><Edit3 size={13} /> Edit Text</span>
                <span className="text-[10px] text-slate-400">Dbl-Click</span>
              </button>
              <div className="my-1 border-t border-slate-800" />
            </>
          )}

          <button
            className="w-full px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center justify-between text-left transition-colors"
            onClick={() => {
              handleCut();
              setContextMenu(null);
            }}
          >
            <span className="flex items-center gap-2"><Scissors size={13} /> Cut</span>
            <span className="text-[10px] text-slate-400">Ctrl+X</span>
          </button>

          <button
            className="w-full px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center justify-between text-left transition-colors"
            onClick={() => {
              handleCopy();
              setContextMenu(null);
            }}
          >
            <span className="flex items-center gap-2"><Copy size={13} /> Copy</span>
            <span className="text-[10px] text-slate-400">Ctrl+C</span>
          </button>

          <button
            className="w-full px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center justify-between text-left transition-colors"
            onClick={() => {
              handlePaste();
              setContextMenu(null);
            }}
          >
            <span className="flex items-center gap-2"><Clipboard size={13} /> Paste</span>
            <span className="text-[10px] text-slate-400">Ctrl+V</span>
          </button>

          <button
            className="w-full px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center justify-between text-left transition-colors"
            onClick={() => {
              handleDuplicate();
              setContextMenu(null);
            }}
          >
            <span className="flex items-center gap-2"><Copy size={13} /> Duplicate</span>
            <span className="text-[10px] text-slate-400">Ctrl+D</span>
          </button>

          <div className="my-1 border-t border-slate-800" />

          <button
            className="w-full px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center justify-between text-left transition-colors"
            onClick={() => {
              handleBringToFront();
              setContextMenu(null);
            }}
          >
            <span className="flex items-center gap-2"><ArrowUp size={13} /> Bring to Front</span>
            <span className="text-[10px] text-slate-400">Ctrl+Shift+]</span>
          </button>

          <button
            className="w-full px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center justify-between text-left transition-colors"
            onClick={() => {
              handleSendToBack();
              setContextMenu(null);
            }}
          >
            <span className="flex items-center gap-2"><ArrowDown size={13} /> Send to Back</span>
            <span className="text-[10px] text-slate-400">Ctrl+Shift+[</span>
          </button>

          <button
            className="w-full px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center justify-between text-left transition-colors"
            onClick={() => {
              handleCenterHorizontally();
              setContextMenu(null);
            }}
          >
            <span className="flex items-center gap-2"><AlignCenter size={13} /> Center Horizontally</span>
          </button>

          <button
            className="w-full px-3 py-1.5 hover:bg-sky-600 hover:text-white flex items-center justify-between text-left transition-colors"
            onClick={() => {
              handleCenterVertically();
              setContextMenu(null);
            }}
          >
            <span className="flex items-center gap-2"><Maximize2 size={13} /> Center Vertically</span>
          </button>

          <div className="my-1 border-t border-slate-800" />

          <button
            className="w-full px-3 py-1.5 hover:bg-rose-600 hover:text-white flex items-center justify-between text-left transition-colors text-rose-400"
            onClick={() => {
              handleDelete();
              setContextMenu(null);
            }}
          >
            <span className="flex items-center gap-2"><Trash2 size={13} /> Delete Object</span>
            <span className="text-[10px] opacity-80">Del</span>
          </button>
        </div>
      )}
    </div>
  );
};
