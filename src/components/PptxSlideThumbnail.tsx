import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Slide, PresentationItem, ThemeStyles } from '../types';
import { PptxRenderOverlay } from './PptxRenderOverlay';
import { getCachedPptxSlides, getOrParsePptxSlides } from '../utils/pptxParser';
import { getDB } from '../db';

interface PptxSlideThumbnailProps {
  slide: Slide;
  slideIndex: number;
  totalSlides: number;
  liveItem?: PresentationItem | null;
  themeStyles?: ThemeStyles;
}

export const PptxSlideThumbnail: React.FC<PptxSlideThumbnailProps> = React.memo(({
  slide,
  slideIndex,
  totalSlides,
  liveItem,
  themeStyles,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasIntersected, setHasIntersected] = useState(false);
  const [asyncSlide, setAsyncSlide] = useState<Slide | null>(null);

  const contentId = liveItem?.contentId || (slide as any).presentationId || (slide as any).deckId;
  const fileBytes = liveItem?.data?.fileBytes;

  // 1. Check if full parsed slide is already in memory cache or in slide prop
  const currentSlide = useMemo(() => {
    if (asyncSlide) return asyncSlide;
    if (slide.backgroundUrl || slide.backgroundColor || (slide.objects && slide.objects.length > 0)) {
      return slide;
    }
    if (contentId) {
      const cached = getCachedPptxSlides(contentId);
      if (cached && cached[slideIndex]) {
        return {
          ...slide,
          ...cached[slideIndex],
        };
      }
    }
    return slide;
  }, [slide, asyncSlide, contentId, slideIndex]);

  // 2. Lazy hydration when visible
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setHasIntersected(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setHasIntersected(true);
        observer.disconnect();
      }
    }, { rootMargin: "300px" });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 3. Asynchronous single-instance parsing from IndexedDB if not yet cached
  useEffect(() => {
    if (!hasIntersected) return;
    if (currentSlide.backgroundUrl || currentSlide.backgroundColor || (currentSlide.objects && currentSlide.objects.length > 0)) {
      return;
    }
    if (!contentId) return;

    let isMounted = true;
    (async () => {
      try {
        const cached = getCachedPptxSlides(contentId);
        if (cached && cached[slideIndex]) {
          if (isMounted) setAsyncSlide({ ...slide, ...cached[slideIndex] });
          return;
        }

        const db = await getDB();
        const asset = await db.get('assets', contentId);
        const bytes = asset?.data?.fileBytes || liveItem?.data?.fileBytes;
        if (bytes) {
          const parsed = await getOrParsePptxSlides(contentId, bytes);
          if (isMounted && parsed && parsed[slideIndex]) {
            setAsyncSlide({ ...slide, ...parsed[slideIndex] });
          }
        }
      } catch (err) {
        console.warn('[PptxSlideThumbnail] Async hydration warning:', err);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [hasIntersected, contentId, slideIndex, slide, liveItem?.data?.fileBytes, currentSlide.backgroundUrl, currentSlide.backgroundColor, currentSlide.objects]);

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-black relative overflow-hidden select-none flex items-center justify-center pointer-events-none"
      style={{
        contain: 'strict',
        transform: 'translateZ(0)',
      }}
    >
      {hasIntersected ? (
        <div className="w-full h-full relative overflow-hidden flex items-center justify-center shrink-0">
          <PptxRenderOverlay
            fileBytes={fileBytes}
            contentId={contentId}
            activeSlideIndex={slideIndex}
            isThumbnail={true}
            currentSlide={currentSlide}
            themeStyles={themeStyles}
          />
        </div>
      ) : (
        <div className="w-full h-full bg-black flex items-center justify-center text-gray-600 text-xs font-mono select-none">
          Slide {slideIndex + 1}
        </div>
      )}
      <div className="absolute bottom-1 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-mono font-bold text-amber-300 border border-amber-500/30 pointer-events-none z-20 shadow-sm">
        Slide {slideIndex + 1}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.slideIndex === nextProps.slideIndex &&
    prevProps.totalSlides === nextProps.totalSlides &&
    prevProps.liveItem?.id === nextProps.liveItem?.id &&
    prevProps.liveItem?.contentId === nextProps.liveItem?.contentId &&
    prevProps.liveItem?.data?.fileBytes === nextProps.liveItem?.data?.fileBytes &&
    prevProps.slide === nextProps.slide
  );
});
