import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { translationsEn } from 'pptx-react-viewer/i18n';
import { useEffect, useState, useCallback } from 'react';

// ==========================================
// 1. i18n Global Initialization for Viewer
// ==========================================
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: {
        translation: translationsEn || {}
      }
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });
} else {
  if (!i18n.hasResourceBundle('en', 'translation')) {
    i18n.addResourceBundle('en', 'translation', translationsEn || {}, true, true);
  }
}

export default i18n;

// ============================================================================
// 2. OFF-SCREEN CANVAS BUFFER & ASYNCHRONOUS RENDERING CACHE ARCHITECTURE
// ============================================================================

export interface OffscreenSlideFrame {
  key: string;
  slideIndex: number;
  canvas: HTMLCanvasElement | null;
  imageBitmap?: ImageBitmap | null;
  dataUrl?: string;
  renderedAt: number;
  width: number;
  height: number;
}

interface CacheEntry {
  status: 'rendering' | 'ready' | 'error';
  frame?: OffscreenSlideFrame;
  promise?: Promise<OffscreenSlideFrame | null>;
  error?: any;
}

class OffscreenPptxCacheManager {
  private cache = new Map<string, CacheEntry>();
  private maxCacheSize = 120;

  // Off-screen canvas double-buffers for thread-safe off-screen rendering
  private frontCanvas: HTMLCanvasElement | null = null;
  private backCanvas: HTMLCanvasElement | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      try {
        this.frontCanvas = document.createElement('canvas');
        this.frontCanvas.width = 1920;
        this.frontCanvas.height = 1080;

        this.backCanvas = document.createElement('canvas');
        this.backCanvas.width = 1920;
        this.backCanvas.height = 1080;
      } catch (e) {
        console.warn('[initPptxViewer] Could not instantiate off-screen canvas buffers:', e);
      }
    }
  }

  private buildKey(presKey: string, slideIndex: number): string {
    return `${presKey}_slide_${slideIndex}`;
  }

  /**
   * Synchronously retrieves a pre-rendered off-screen slide frame from cache if available.
   */
  public getFrameSync(presKey: string, slideIndex: number): OffscreenSlideFrame | null {
    if (!presKey) return null;
    const key = this.buildKey(presKey, slideIndex);
    const entry = this.cache.get(key);
    if (entry && entry.status === 'ready' && entry.frame) {
      return entry.frame;
    }
    return null;
  }

  /**
   * Puts a rendered slide canvas or element into the off-screen cache buffer.
   */
  public putFrame(
    presKey: string,
    slideIndex: number,
    sourceCanvasOrElement: HTMLCanvasElement | HTMLElement | string,
    width = 1920,
    height = 1080
  ): OffscreenSlideFrame | null {
    if (!presKey || typeof document === 'undefined') return null;
    const key = this.buildKey(presKey, slideIndex);

    try {
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;
      const ctx = offscreenCanvas.getContext('2d');

      let dataUrl: string | undefined;

      if (typeof sourceCanvasOrElement === 'string') {
        dataUrl = sourceCanvasOrElement;
      } else if (sourceCanvasOrElement instanceof HTMLCanvasElement) {
        if (ctx) {
          ctx.drawImage(sourceCanvasOrElement, 0, 0, width, height);
        }
        try {
          dataUrl = offscreenCanvas.toDataURL('image/png');
        } catch {
          // ignore potential canvas taint
        }
      } else if (sourceCanvasOrElement instanceof HTMLElement) {
        // Find inner canvas inside PPTX container
        const innerCanvas = sourceCanvasOrElement.querySelector('canvas');
        if (innerCanvas && ctx) {
          ctx.drawImage(innerCanvas, 0, 0, width, height);
          try {
            dataUrl = offscreenCanvas.toDataURL('image/png');
          } catch {
            // ignore
          }
        }
      }

      const frame: OffscreenSlideFrame = {
        key,
        slideIndex,
        canvas: offscreenCanvas,
        dataUrl,
        renderedAt: Date.now(),
        width,
        height
      };

      this.cache.set(key, {
        status: 'ready',
        frame
      });

      this.evictIfNeeded();
      return frame;
    } catch (e) {
      console.warn('[initPptxViewer] Error buffering offscreen slide canvas:', e);
      return null;
    }
  }

  /**
   * Asynchronously retrieves or renders slide off-screen buffer.
   */
  public async getOrRenderFrame(
    presKey: string,
    slideIndex: number,
    renderTask: () => Promise<HTMLCanvasElement | HTMLElement | string | null>
  ): Promise<OffscreenSlideFrame | null> {
    if (!presKey) return null;
    const key = this.buildKey(presKey, slideIndex);
    const existing = this.cache.get(key);

    if (existing) {
      if (existing.status === 'ready' && existing.frame) {
        return existing.frame;
      }
      if (existing.status === 'rendering' && existing.promise) {
        return existing.promise;
      }
    }

    const promise = (async () => {
      try {
        const result = await renderTask();
        if (result) {
          const frame = this.putFrame(presKey, slideIndex, result);
          return frame;
        }
        return null;
      } catch (err) {
        this.cache.set(key, { status: 'error', error: err });
        return null;
      }
    })();

    this.cache.set(key, {
      status: 'rendering',
      promise
    });

    return promise;
  }

  /**
   * Prefetches and warms up adjacent slides asynchronously in background microtasks.
   */
  public prefetchAdjacentSlides(
    presKey: string,
    currentIndex: number,
    totalSlides: number,
    renderTaskForIndex: (idx: number) => Promise<HTMLCanvasElement | HTMLElement | string | null>
  ): void {
    if (!presKey || totalSlides <= 1) return;

    const targetIndices = [
      currentIndex + 1,
      currentIndex - 1,
      currentIndex + 2,
      currentIndex - 2
    ].filter(idx => idx >= 0 && idx < totalSlides);

    const scheduleNext = (i: number) => {
      if (i >= targetIndices.length) return;
      const targetIdx = targetIndices[i];
      const key = this.buildKey(presKey, targetIdx);

      if (!this.cache.has(key)) {
        const run = () => {
          this.getOrRenderFrame(presKey, targetIdx, () => renderTaskForIndex(targetIdx))
            .then(() => scheduleNext(i + 1))
            .catch(() => scheduleNext(i + 1));
        };

        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          (window as any).requestIdleCallback(run, { timeout: 1000 });
        } else {
          setTimeout(run, 50);
        }
      } else {
        scheduleNext(i + 1);
      }
    };

    scheduleNext(0);
  }

  /**
   * LRU eviction to maintain optimal memory consumption.
   */
  private evictIfNeeded() {
    if (this.cache.size <= this.maxCacheSize) return;

    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [k, v] of this.cache.entries()) {
      if (v.status === 'ready' && v.frame && v.frame.renderedAt < oldestTime) {
        oldestTime = v.frame.renderedAt;
        oldestKey = k;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Clears off-screen buffer cache.
   */
  public clear(presKey?: string) {
    if (presKey) {
      for (const k of Array.from(this.cache.keys())) {
        if (k.startsWith(`${presKey}_`)) {
          this.cache.delete(k);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}

// Global Singleton Instance
export const pptxCacheManager = new OffscreenPptxCacheManager();

// ==========================================
// 3. EXPORTED CACHE & BUFFER API HELPERS
// ==========================================

export function getCachedSlideFrame(presKey: string, slideIndex: number): OffscreenSlideFrame | null {
  return pptxCacheManager.getFrameSync(presKey, slideIndex);
}

export function cacheSlideFrame(
  presKey: string,
  slideIndex: number,
  source: HTMLCanvasElement | HTMLElement | string,
  width?: number,
  height?: number
): OffscreenSlideFrame | null {
  return pptxCacheManager.putFrame(presKey, slideIndex, source, width, height);
}

export function prefetchSlideFrames(
  presKey: string,
  currentIndex: number,
  totalSlides: number,
  renderFn: (idx: number) => Promise<HTMLCanvasElement | HTMLElement | string | null>
) {
  pptxCacheManager.prefetchAdjacentSlides(presKey, currentIndex, totalSlides, renderFn);
}

export function clearSlideFrameCache(presKey?: string) {
  pptxCacheManager.clear(presKey);
}

// ==========================================
// 4. CUSTOM REACT HOOK FOR FAST SLIDE SWAP
// ==========================================

export function useOffscreenPptxCache(
  presKey: string,
  activeSlideIndex: number
) {
  const [cachedFrame, setCachedFrame] = useState<OffscreenSlideFrame | null>(() =>
    pptxCacheManager.getFrameSync(presKey, activeSlideIndex)
  );

  useEffect(() => {
    // Synchronous immediate check from off-screen canvas buffer
    const frame = pptxCacheManager.getFrameSync(presKey, activeSlideIndex);
    if (frame) {
      setCachedFrame(frame);
    } else {
      setCachedFrame(null);
    }
  }, [presKey, activeSlideIndex]);

  const registerRenderedFrame = useCallback(
    (source: HTMLCanvasElement | HTMLElement | string) => {
      if (!presKey) return null;
      const frame = pptxCacheManager.putFrame(presKey, activeSlideIndex, source);
      if (frame) {
        setCachedFrame(frame);
      }
      return frame;
    },
    [presKey, activeSlideIndex]
  );

  return {
    cachedFrame,
    registerRenderedFrame
  };
}
