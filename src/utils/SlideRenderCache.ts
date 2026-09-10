import { useState, useEffect, useCallback } from 'react';
import html2canvas from 'html2canvas';

export interface OffscreenSlideFrame {
  key: string;
  slideIndex: number;
  canvas: HTMLCanvasElement | null;
  imageBitmap?: ImageBitmap | null;
  objectUrl?: string;
  base64Url?: string;
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

export class SlideRenderCache {
  private cache = new Map<string, CacheEntry>();
  // Memory-conscious cache size dynamically scaled to real device hardware
  private maxCacheSize = 16;
  public setMaxCacheSize(size: number) { this.maxCacheSize = size; }
  private frontCanvas: HTMLCanvasElement | null = null;
  private backCanvas: HTMLCanvasElement | null = null;
  private syncChannel: BroadcastChannel | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      try {
        this.frontCanvas = document.createElement('canvas');
        this.frontCanvas.width = 1920;
        this.frontCanvas.height = 1080;
        this.backCanvas = document.createElement('canvas');
        this.backCanvas.width = 1920;
        this.backCanvas.height = 1080;
        
        // Listen for pre-rendered frames from the main window using a persistent channel
        if (typeof BroadcastChannel !== 'undefined') {
          this.syncChannel = new BroadcastChannel('pptx_render_sync');
          this.syncChannel.onmessage = (event) => {
            if (event.data && event.data.type === 'FRAME_RENDERED') {
              const { key, slideIndex, base64Url } = event.data;
              if (key && base64Url) {
                this.cache.set(key, {
                  status: 'ready',
                  frame: {
                    key,
                    slideIndex,
                    canvas: null,
                    objectUrl: base64Url,
                    base64Url,
                    renderedAt: Date.now(),
                    width: 1920,
                    height: 1080
                  }
                });
                
                // Notify React state listeners
                window.dispatchEvent(new CustomEvent('pptx_frame_synced', { detail: { key, slideIndex } }));
              }
            }
          };
        }
      } catch (e) {
        console.warn('[SlideRenderCache] Could not instantiate buffers:', e);
      }
    }
  }

  private buildKey(presKey: string, slideIndex: number): string {
    return `${presKey}_slide_${slideIndex}`;
  }

  public getEntrySync(presKey: string, slideIndex: number): CacheEntry | null {
    if (!presKey) return null;
    const key = this.buildKey(presKey, slideIndex);
    return this.cache.get(key) || null;
  }

  public getFrameSync(presKey: string, slideIndex: number): OffscreenSlideFrame | null {
    if (!presKey) return null;
    const key = this.buildKey(presKey, slideIndex);
    const entry = this.cache.get(key);
    if (entry && entry.status === 'ready' && entry.frame) {
      return entry.frame;
    }
    return null;
  }

  public async putFrame(
    presKey: string,
    slideIndex: number,
    sourceCanvasOrElement: HTMLCanvasElement | HTMLElement | string,
    width = 1920,
    height = 1080
  ): Promise<OffscreenSlideFrame | null> {
    if (!presKey || typeof document === 'undefined') return null;
    const key = this.buildKey(presKey, slideIndex);
    
    console.log('[SlideRenderCache] 🎬 Capture started for', { presKey, slideIndex, key, width, height });

    try {
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = width;
      offscreenCanvas.height = height;
      const ctx = offscreenCanvas.getContext('2d');

      let objectUrl: string | undefined;
      let base64Url: string | undefined;

      if (typeof sourceCanvasOrElement === 'string') {
        objectUrl = sourceCanvasOrElement;
        if (sourceCanvasOrElement.startsWith('data:image/')) {
          base64Url = sourceCanvasOrElement;
        }
      } else if (sourceCanvasOrElement instanceof HTMLCanvasElement) {
        if (ctx) {
          ctx.drawImage(sourceCanvasOrElement, 0, 0, width, height);
        }
        try {
          base64Url = offscreenCanvas.toDataURL('image/jpeg', 0.85);
          const blob = await new Promise<Blob | null>(res => offscreenCanvas.toBlob(res, 'image/jpeg', 0.85));
          if (blob) {
            objectUrl = URL.createObjectURL(blob);
          }
        } catch {
          // ignore
        }
      } else if (sourceCanvasOrElement instanceof HTMLElement) {
        // Fast-path: If the element already contains an internal rendered canvas, copy it directly without html2canvas
        const innerCanvas = sourceCanvasOrElement.querySelector('canvas');
        if (innerCanvas && ctx) {
          try {
            ctx.drawImage(innerCanvas, 0, 0, width, height);
            base64Url = offscreenCanvas.toDataURL('image/jpeg', 0.8);
            const blob = await new Promise<Blob | null>(res => offscreenCanvas.toBlob(res, 'image/jpeg', 0.8));
            if (blob) {
              objectUrl = URL.createObjectURL(blob);
            }
          } catch {
            // fallback to html2canvas if cross-origin tainted
          }
        }

        if (!base64Url) {
          try {
            if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
               await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1000))]);
            }

            const captureCanvas = await Promise.race([
               html2canvas(sourceCanvasOrElement, {
                 scale: 1,
                 useCORS: true,
                 allowTaint: true,
                 backgroundColor: null,
                 logging: false
               }),
               new Promise<null>((_, reject) => setTimeout(() => reject(new Error("html2canvas timeout")), 3000))
            ]);
            
            if (captureCanvas && ctx) {
              base64Url = captureCanvas.toDataURL('image/jpeg', 0.8);
              const blob = await new Promise<Blob | null>(res => captureCanvas.toBlob(res, 'image/jpeg', 0.8));
              if (blob) {
                objectUrl = URL.createObjectURL(blob);
              }
            }
          } catch (captureErr) {
            console.warn('[SlideRenderCache] html2canvas capture skipped or timed out', captureErr);
          }
        }
      }

      const existingEntry = this.cache.get(key);
      if (existingEntry?.frame?.objectUrl && existingEntry.frame.objectUrl !== existingEntry.frame.base64Url) {
        URL.revokeObjectURL(existingEntry.frame.objectUrl);
      }
      if (existingEntry?.frame?.canvas) {
        existingEntry.frame.canvas.width = 1;
        existingEntry.frame.canvas.height = 1;
        existingEntry.frame.canvas = null;
      }

      const frame: OffscreenSlideFrame = {
        key,
        slideIndex,
        canvas: offscreenCanvas,
        objectUrl,
        base64Url,
        renderedAt: Date.now(),
        width,
        height
      };

      this.cache.set(key, {
        status: 'ready',
        frame
      });

      if (base64Url && typeof window !== 'undefined') {
        try {
          if (!this.syncChannel && typeof BroadcastChannel !== 'undefined') {
            this.syncChannel = new BroadcastChannel('pptx_render_sync');
          }
          if (this.syncChannel) {
            this.syncChannel.postMessage({
              type: 'FRAME_RENDERED',
              key,
              slideIndex,
              base64Url
            });
          }
        } catch (e) {
          // ignore
        }
        window.dispatchEvent(new CustomEvent('pptx_frame_synced', { detail: { key, slideIndex } }));
      } else {
        window.dispatchEvent(new CustomEvent('pptx_frame_synced', { detail: { key, slideIndex } }));
      }

      this.evictIfNeeded();
      return frame;
    } catch (e) {
      console.warn('[SlideRenderCache] Error buffering offscreen slide:', e);
      return null;
    }
  }

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
          return this.putFrame(presKey, slideIndex, result);
        }
        return null;
      } catch (err) {
        this.cache.set(key, { status: 'error', error: err });
        if (typeof window !== 'undefined') {
           window.dispatchEvent(new CustomEvent('pptx_frame_synced', { detail: { key, slideIndex: slideIndex } }));
        }
        return null;
      }
    })();

    this.cache.set(key, {
      status: 'rendering',
      promise
    });
    if (typeof window !== 'undefined') {
       window.dispatchEvent(new CustomEvent('pptx_frame_synced', { detail: { key, slideIndex } }));
    }

    return promise;
  }

  public preloadBackgroundSlides(
    presKey: string,
    currentIndex: number,
    totalSlides: number,
    renderTaskForIndex: (idx: number) => Promise<HTMLCanvasElement | HTMLElement | string | null>
  ): void {
    if (!presKey || totalSlides <= 1) return;
    
    // Preload outwards from current slide
    const targetIndices: number[] = [];
    for (let offset = 1; offset < totalSlides; offset++) {
       if (currentIndex + offset < totalSlides) targetIndices.push(currentIndex + offset);
       if (currentIndex - offset >= 0) targetIndices.push(currentIndex - offset);
    }

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

  private evictIfNeeded() {
    while (this.cache.size > this.maxCacheSize) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      
      for (const [k, v] of this.cache.entries()) {
        const time = v.frame ? v.frame.renderedAt : 0;
        if (time < oldestTime) {
          oldestTime = time;
          oldestKey = k;
        }
      }
      
      if (oldestKey) {
        const entry = this.cache.get(oldestKey);
        if (entry?.frame?.objectUrl && entry.frame.objectUrl !== entry.frame.base64Url) {
          URL.revokeObjectURL(entry.frame.objectUrl);
        }
        if (entry?.frame?.canvas) {
          entry.frame.canvas.width = 1;
          entry.frame.canvas.height = 1;
          entry.frame.canvas = null;
        }
        this.cache.delete(oldestKey);
      } else {
        break;
      }
    }
  }

  public getCacheSize(): number {
    return this.cache.size;
  }

  public clear(presKey?: string): number {
    let clearedCount = 0;
    if (presKey) {
      for (const k of Array.from(this.cache.keys())) {
        if (k.startsWith(`${presKey}_`)) {
          const entry = this.cache.get(k);
          if (entry?.frame?.objectUrl && entry.frame.objectUrl !== entry.frame.base64Url) {
            URL.revokeObjectURL(entry.frame.objectUrl);
          }
          if (entry?.frame?.canvas) {
            entry.frame.canvas.width = 1;
            entry.frame.canvas.height = 1;
            entry.frame.canvas = null;
          }
          this.cache.delete(k);
          clearedCount++;
        }
      }
    } else {
      clearedCount = this.cache.size;
      for (const entry of this.cache.values()) {
        if (entry.frame?.objectUrl && entry.frame.objectUrl !== entry.frame.base64Url) {
          URL.revokeObjectURL(entry.frame.objectUrl);
        }
        if (entry.frame?.canvas) {
          entry.frame.canvas.width = 1;
          entry.frame.canvas.height = 1;
          entry.frame.canvas = null;
        }
      }
      this.cache.clear();
    }
    return clearedCount;
  }
}

// Global Singleton Instance
export const slideRenderCache = new SlideRenderCache();

export function useSlideRenderCache(
  presKey: string,
  activeSlideIndex: number
) {
  const getInitialStatus = () => {
    if (!presKey) return 'idle';
    const entry = slideRenderCache.getEntrySync(presKey, activeSlideIndex);
    return entry ? entry.status : 'idle';
  };

  const [cachedFrame, setCachedFrame] = useState<OffscreenSlideFrame | null>(() =>
    slideRenderCache.getFrameSync(presKey, activeSlideIndex)
  );
  const [status, setStatus] = useState<'idle' | 'rendering' | 'ready' | 'error'>(getInitialStatus);


  useEffect(() => {
    const frame = slideRenderCache.getFrameSync(presKey, activeSlideIndex);
    if (frame) {
      setCachedFrame(frame);
      setStatus('ready');
    } else {
      setCachedFrame(null);
      setStatus(getInitialStatus());
    }

    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.key === `${presKey}_slide_${activeSlideIndex}`) {
        const entry = slideRenderCache.getEntrySync(presKey, activeSlideIndex);
        if (entry) {
          if (entry.status === 'ready' && entry.frame) {
             setCachedFrame(entry.frame);
          }
          setStatus(entry.status);
        }
      }
    };
    
    window.addEventListener('pptx_frame_synced', handleSync);
    return () => window.removeEventListener('pptx_frame_synced', handleSync);
  }, [presKey, activeSlideIndex]);

  const registerRenderedFrame = useCallback(
    async (source: HTMLCanvasElement | HTMLElement | string) => {
      if (!presKey) return null;
      const frame = await slideRenderCache.putFrame(presKey, activeSlideIndex, source);
      if (frame) {
        setCachedFrame(frame);
      }
      return frame;
    },
    [presKey, activeSlideIndex]
  );

  return {
    cachedFrame,
    status,
    registerRenderedFrame
  };
}

export function getSlideRenderKey(contentId?: string, bytes?: Uint8Array | null): string {
  if (contentId) {
    return `pptx_item_${contentId}`;
  }
  if (bytes) {
    const len = bytes.length;
    return `pptx_bytes_${len}_${bytes.slice(0, 32).join('_')}`;
  }
  return '';
}
