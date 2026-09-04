import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { AnnotationStroke, AnnotationPoint, AnnotationToolType, LaserPointerState } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface SlideAnnotationLayerProps {
  interactive?: boolean;
  className?: string;
  stageWidth?: number;
  stageHeight?: number;
}

export const SlideAnnotationLayer: React.FC<SlideAnnotationLayerProps> = ({
  interactive = false,
  className = '',
  stageWidth = 1920,
  stageHeight = 1080,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { 
    annotationState, 
    addAnnotationStroke, 
    updateLaserPointer,
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
    strokes, 
    laserPointer 
  } = annotationState;

  // Active in-progress stroke
  const [currentStroke, setCurrentStroke] = useState<AnnotationStroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [containerBounds, setContainerBounds] = useState<{ width: number; height: number; left: number; top: number }>({
    width: stageWidth,
    height: stageHeight,
    left: 0,
    top: 0,
  });

  // Keep track of container bounds for normalized coordinate calculation
  const updateBounds = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setContainerBounds({
          width: rect.width,
          height: rect.height,
          left: rect.left,
          top: rect.top,
        });
      }
    }
  }, []);

  useEffect(() => {
    updateBounds();
    const handleResize = () => updateBounds();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [updateBounds]);

  const getNormalizedPoint = useCallback((e: React.PointerEvent | PointerEvent): AnnotationPoint => {
    const el = containerRef.current;
    if (!el) return { x: 0.5, y: 0.5 };
    const rect = el.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
    return { x, y };
  }, []);

  // Eraser stroke check
  const checkEraserCollision = useCallback((p: AnnotationPoint) => {
    const threshold = 0.03; // ~3% of screen distance
    const remainingStrokes = strokes.filter(stroke => {
      return !stroke.points.some(pt => {
        const dx = pt.x - p.x;
        const dy = pt.y - p.y;
        return Math.sqrt(dx * dx + dy * dy) < threshold;
      });
    });

    if (remainingStrokes.length !== strokes.length) {
      useStore.setState((prev) => ({
        annotationState: {
          ...prev.annotationState,
          strokes: remainingStrokes,
          redoStack: []
        }
      }));
    }
  }, [strokes]);

  // Pointer event handlers for drawing
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || !enabled) return;
    e.preventDefault();
    e.stopPropagation();

    // Capture pointer
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    const pt = getNormalizedPoint(e);

    if (activeTool === 'laser') {
      updateLaserPointer({
        active: true,
        x: pt.x,
        y: pt.y,
        color: activeColor,
        size: strokeSize * 2,
        lastUpdated: Date.now()
      });
      setIsDrawing(true);
      return;
    }

    if (activeTool === 'eraser') {
      checkEraserCollision(pt);
      setIsDrawing(true);
      return;
    }

    const newStroke: AnnotationStroke = {
      id: uuidv4(),
      tool: activeTool as any,
      color: activeColor,
      size: strokeSize,
      opacity: activeTool === 'highlighter' ? Math.min(0.45, opacity) : (activeTool === 'spotlight' ? 0.8 : opacity),
      points: [pt],
      createdAt: Date.now(),
    };

    setCurrentStroke(newStroke);
    setIsDrawing(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || !enabled) return;

    const pt = getNormalizedPoint(e);

    if (activeTool === 'laser') {
      updateLaserPointer({
        active: true,
        x: pt.x,
        y: pt.y,
        color: activeColor,
        size: strokeSize * 2,
        lastUpdated: Date.now()
      });
      return;
    }

    if (!isDrawing) return;

    if (activeTool === 'eraser') {
      checkEraserCollision(pt);
      return;
    }

    if (!currentStroke) return;

    if (activeTool === 'pen' || activeTool === 'highlighter') {
      // Append point for freehand drawing
      setCurrentStroke(prev => {
        if (!prev) return null;
        const lastPt = prev.points[prev.points.length - 1];
        // Minimal distance threshold to avoid redundant points
        if (lastPt) {
          const dx = pt.x - lastPt.x;
          const dy = pt.y - lastPt.y;
          if (dx * dx + dy * dy < 0.000004) return prev;
        }
        return {
          ...prev,
          points: [...prev.points, pt]
        };
      });
    } else if (activeTool === 'rectangle' || activeTool === 'arrow' || activeTool === 'spotlight') {
      // Start point + current drag point
      setCurrentStroke(prev => {
        if (!prev) return null;
        const startPt = prev.points[0] || pt;
        return {
          ...prev,
          points: [startPt, pt]
        };
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || !enabled) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (activeTool === 'laser') {
      setIsDrawing(false);
      return;
    }

    if (currentStroke && currentStroke.points.length > 0) {
      addAnnotationStroke(currentStroke);
    }

    setCurrentStroke(null);
    setIsDrawing(false);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool === 'laser') {
      updateLaserPointer(null);
    }
  };

  // Convert points to SVG path / elements in SVG viewBox coords (0 0 1000 1000)
  const renderStroke = (stroke: AnnotationStroke, isLivePreview = false) => {
    const { id, tool, color, size, opacity: strokeOpacity, points } = stroke;
    if (!points || points.length === 0) return null;

    // Scale stroke width to 1000-unit viewBox
    const strokeWidth = (size / 1000) * 1000 * 2.5;

    if (tool === 'pen' || tool === 'highlighter') {
      if (points.length === 1) {
        const p = points[0];
        return (
          <circle
            key={id}
            cx={p.x * 1000}
            cy={p.y * 1000}
            r={tool === 'highlighter' ? strokeWidth * 1.5 : strokeWidth / 2}
            fill={color}
            opacity={strokeOpacity}
            style={tool === 'highlighter' ? { mixBlendMode: 'screen' } : undefined}
          />
        );
      }

      // Generate smooth SVG curve through points
      let d = `M ${points[0].x * 1000} ${points[0].y * 1000}`;
      for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        const midX = ((p1.x + p2.x) / 2) * 1000;
        const midY = ((p1.y + p2.y) / 2) * 1000;
        d += ` Q ${p1.x * 1000} ${p1.y * 1000}, ${midX} ${midY}`;
      }
      const last = points[points.length - 1];
      d += ` L ${last.x * 1000} ${last.y * 1000}`;

      return (
        <path
          key={id}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={tool === 'highlighter' ? strokeWidth * 2.8 : strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={strokeOpacity}
          style={tool === 'highlighter' ? { 
            mixBlendMode: 'screen',
            filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.4))'
          } : {
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))'
          }}
        />
      );
    }

    if (tool === 'rectangle') {
      const p1 = points[0];
      const p2 = points[1] || p1;
      const minX = Math.min(p1.x, p2.x) * 1000;
      const minY = Math.min(p1.y, p2.y) * 1000;
      const width = Math.abs(p2.x - p1.x) * 1000;
      const height = Math.abs(p2.y - p1.y) * 1000;

      return (
        <g key={id}>
          {/* Semi-transparent highlight fill */}
          <rect
            x={minX}
            y={minY}
            width={width}
            height={height}
            rx={8}
            ry={8}
            fill={color}
            opacity={Math.min(0.25, strokeOpacity * 0.35)}
          />
          {/* Border line */}
          <rect
            x={minX}
            y={minY}
            width={width}
            height={height}
            rx={8}
            ry={8}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth * 1.2}
            strokeDasharray={isLivePreview ? '8 4' : undefined}
            opacity={strokeOpacity}
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}
          />
        </g>
      );
    }

    if (tool === 'arrow') {
      const p1 = points[0];
      const p2 = points[1] || p1;
      const x1 = p1.x * 1000;
      const y1 = p1.y * 1000;
      const x2 = p2.x * 1000;
      const y2 = p2.y * 1000;

      const angle = Math.atan2(y2 - y1, x2 - x1);
      const headLength = Math.max(16, strokeWidth * 3.5);

      const arrowP1X = x2 - headLength * Math.cos(angle - Math.PI / 6);
      const arrowP1Y = y2 - headLength * Math.sin(angle - Math.PI / 6);
      const arrowP2X = x2 - headLength * Math.cos(angle + Math.PI / 6);
      const arrowP2Y = y2 - headLength * Math.sin(angle + Math.PI / 6);

      return (
        <g key={id} opacity={strokeOpacity} style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.7))' }}>
          {/* Arrow Shaft */}
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={color}
            strokeWidth={strokeWidth * 1.2}
            strokeLinecap="round"
          />
          {/* Arrow Head */}
          <polygon
            points={`${x2},${y2} ${arrowP1X},${arrowP1Y} ${arrowP2X},${arrowP2Y}`}
            fill={color}
          />
        </g>
      );
    }

    if (tool === 'spotlight') {
      const p1 = points[0];
      const p2 = points[1] || p1;
      const centerX = ((p1.x + p2.x) / 2) * 1000;
      const centerY = ((p1.y + p2.y) / 2) * 1000;
      const rx = Math.max(30, (Math.abs(p2.x - p1.x) / 2) * 1000);
      const ry = Math.max(30, (Math.abs(p2.y - p1.y) / 2) * 1000);

      const maskId = `spotlight-mask-${id}`;

      return (
        <g key={id}>
          <defs>
            <mask id={maskId}>
              <rect x="0" y="0" width="1000" height="1000" fill="white" />
              <ellipse cx={centerX} cy={centerY} rx={rx} ry={ry} fill="black" />
            </mask>
          </defs>
          {/* Darkened mask over entire slide except the spotlight */}
          <rect
            x="0"
            y="0"
            width="1000"
            height="1000"
            fill="black"
            opacity={0.6}
            mask={`url(#${maskId})`}
          />
          {/* Spotlight glowing border ring */}
          <ellipse
            cx={centerX}
            cy={centerY}
            rx={rx}
            ry={ry}
            fill="none"
            stroke={color || '#FFD700'}
            strokeWidth={strokeWidth * 0.8}
            opacity={0.85}
            style={{ filter: 'drop-shadow(0 0 12px rgba(255,215,0,0.8))' }}
          />
        </g>
      );
    }

    return null;
  };

  // Cursor styling based on active tool
  const getCursorStyle = () => {
    if (!interactive || !enabled) return 'default';
    if (activeTool === 'laser') return 'crosshair';
    if (activeTool === 'eraser') return 'cell';
    if (activeTool === 'highlighter') return 'crosshair';
    if (activeTool === 'pen') return 'crosshair';
    if (activeTool === 'rectangle' || activeTool === 'arrow' || activeTool === 'spotlight') return 'crosshair';
    return 'default';
  };

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 z-35 overflow-hidden select-none pointer-events-auto ${className}`}
      style={{
        cursor: getCursorStyle(),
        pointerEvents: (interactive && enabled) ? 'auto' : 'none',
        touchAction: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      {/* SVG Canvas for High-Precision Normalized Vector Annotations */}
      <svg
        ref={svgRef}
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        className="w-full h-full absolute inset-0 pointer-events-none"
      >
        {/* Render Saved Strokes */}
        {strokes.map((stroke) => renderStroke(stroke, false))}

        {/* Render Active In-Progress Stroke */}
        {currentStroke && renderStroke(currentStroke, true)}

        {/* Laser Pointer Render */}
        {laserPointer && laserPointer.active && (
          <g style={{ filter: 'drop-shadow(0 0 10px rgba(255,42,77,0.9))' }}>
            {/* Outer Pulsing Halo */}
            <circle
              cx={laserPointer.x * 1000}
              cy={laserPointer.y * 1000}
              r={(laserPointer.size / 1000) * 1000 * 2.2}
              fill={laserPointer.color || '#FF2A4D'}
              opacity={0.35}
              className="animate-ping"
              style={{ transformOrigin: `${laserPointer.x * 1000}px ${laserPointer.y * 1000}px` }}
            />
            {/* Middle Glow Ring */}
            <circle
              cx={laserPointer.x * 1000}
              cy={laserPointer.y * 1000}
              r={(laserPointer.size / 1000) * 1000 * 1.2}
              fill={laserPointer.color || '#FF2A4D'}
              opacity={0.7}
            />
            {/* Center High-Intensity Laser Dot */}
            <circle
              cx={laserPointer.x * 1000}
              cy={laserPointer.y * 1000}
              r={(laserPointer.size / 1000) * 1000 * 0.6}
              fill="#FFFFFF"
            />
          </g>
        )}
      </svg>
    </div>
  );
};

export default SlideAnnotationLayer;
