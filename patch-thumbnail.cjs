const fs = require('fs');
const code = `import '../utils/initPptxViewer';
import React, { useMemo, useState, useEffect } from 'react';
import { Slide, PresentationItem, ThemeStyles } from '../types';
import { toValidPptxUint8Array, isValidPptxBinary } from '../utils/pptxValidator';
import { useViewerBuildingBlocks, SlideCanvas } from 'pptx-react-viewer';

interface PptxSlideThumbnailProps {
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  liveItem: PresentationItem | null;
  themeStyles?: ThemeStyles;
}

export const PptxSlideThumbnail: React.FC<PptxSlideThumbnailProps> = ({
  slide,
  slideIndex,
  totalSlides,
  liveItem,
  themeStyles,
}) => {
  const [localBytes, setLocalBytes] = useState<Uint8Array | null>(null);

  useEffect(() => {
    let isMounted = true;
    const slideBytes = (slide as any).fileBytes || liveItem?.data?.fileBytes;
    const contentId = liveItem?.contentId || liveItem?.id;

    if (slideBytes && isValidPptxBinary(slideBytes)) {
      setLocalBytes(toValidPptxUint8Array(slideBytes));
    } else if (contentId) {
      import('../db').then(({ getDB }) => {
        getDB().then(db => db.get('assets', contentId)).then(asset => {
          if (asset?.data?.fileBytes && isValidPptxBinary(asset.data.fileBytes)) {
            const bytes = toValidPptxUint8Array(asset.data.fileBytes);
            if (isMounted) setLocalBytes(bytes);
          }
        }).catch(e => console.error('[PptxSlideThumbnail] Error loading PPTX', e));
      });
    }
    return () => { isMounted = false; };
  }, [slide, liveItem]);

  const blocks = useViewerBuildingBlocks({
    content: localBytes || new Uint8Array(),
    canEdit: false,
  });

  const customZoom = useMemo(() => {
    if (!blocks.canvasProps?.zoom) return undefined;
    // Scale for a thumbnail
    return { ...blocks.canvasProps.zoom, editorScale: 0.2 }; 
  }, [blocks.canvasProps?.zoom]);

  if (!localBytes || blocks.loading || !blocks.canvasProps) {
    return (
      <div className="w-full h-full bg-[#1a1a24] relative flex flex-col items-center justify-center border border-white/5">
        {slide.backgroundUrl && (
           <img src={slide.backgroundUrl} className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm pointer-events-none" />
        )}
        <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin z-10 mb-2" />
      </div>
    );
  }

  if (blocks.error) {
    return (
      <div className="w-full h-full bg-[#1a1a24] relative flex items-center justify-center border border-white/5">
        <span className="text-[9px] font-mono text-red-400 z-10">Render failed</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black relative overflow-hidden select-none flex items-center justify-center">
      <div className="absolute transform" style={{
         transform: \`scale(0.18)\`, // Needs proper scaling based on container
         width: '1920px',
         height: '1080px',
         transformOrigin: 'center center'
      }}>
         <SlideCanvas 
           {...blocks.canvasProps} 
           slideId={slideIndex + 1} 
           showRulers={false} 
           showGrid={false} 
           canEdit={false} 
         />
      </div>
      <div className="absolute bottom-1 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-mono text-amber-300 border border-amber-500/30 pointer-events-none z-10">
        Slide {slideIndex + 1}
      </div>
    </div>
  );
};
`;
fs.writeFileSync('src/components/PptxSlideThumbnail.tsx', code);
