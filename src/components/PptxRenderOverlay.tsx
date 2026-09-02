import React, { useEffect, useRef, useState } from 'react';
import { SlideCanvas, useViewerBuildingBlocks, PowerPointViewerHandle } from 'pptx-react-viewer';
import 'pptx-react-viewer/styles';

interface PptxRenderOverlayProps {
  fileBytes: Uint8Array | ArrayBuffer;
  activeSlideIndex: number;
}

export const PptxRenderOverlay: React.FC<PptxRenderOverlayProps> = ({ fileBytes, activeSlideIndex }) => {
  const viewerRef = useRef<PowerPointViewerHandle>(null);
  
  // Need to ensure the content is always a Uint8Array
  const [content] = useState(() => fileBytes instanceof Uint8Array ? fileBytes : new Uint8Array(fileBytes));

  const { canvasProps, loading, mode } = useViewerBuildingBlocks({
    content,
    canEdit: false,
    handle: viewerRef
  });

  useEffect(() => {
    if (viewerRef.current && !loading) {
      if (viewerRef.current.getMode() !== 'present') {
        viewerRef.current.setMode('present');
      }
      // Give a tiny delay for state to settle before navigating
      const t = setTimeout(() => {
         viewerRef.current?.goTo(activeSlideIndex);
      }, 50);
      return () => clearTimeout(t);
    }
  }, [activeSlideIndex, loading, mode]);

  if (loading) {
    return <div className="w-full h-full bg-black flex items-center justify-center text-white/50 text-sm font-mono">Loading Presentation...</div>;
  }

  return (
    <div className="w-full h-full bg-black overflow-hidden relative">
      <SlideCanvas {...canvasProps} />
    </div>
  );
};

