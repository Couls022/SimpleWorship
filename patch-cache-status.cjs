const fs = require('fs');
let code = fs.readFileSync('src/utils/SlideRenderCache.ts', 'utf8');

code = code.replace(
  `export function useSlideRenderCache(
  presKey: string,
  activeSlideIndex: number
) {
  const [cachedFrame, setCachedFrame] = useState<OffscreenSlideFrame | null>(() =>
    slideRenderCache.getFrameSync(presKey, activeSlideIndex)
  );`,
  `export function useSlideRenderCache(
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
`
);

code = code.replace(
  `  useEffect(() => {
    const frame = slideRenderCache.getFrameSync(presKey, activeSlideIndex);
    if (frame) {
      setCachedFrame(frame);
    } else {
      setCachedFrame(null);
    }`,
  `  useEffect(() => {
    const frame = slideRenderCache.getFrameSync(presKey, activeSlideIndex);
    if (frame) {
      setCachedFrame(frame);
      setStatus('ready');
    } else {
      setCachedFrame(null);
      setStatus(getInitialStatus());
    }`
);

code = code.replace(
  `    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.key === \`\${presKey}_slide_\${activeSlideIndex}\`) {
        const syncedFrame = slideRenderCache.getFrameSync(presKey, activeSlideIndex);
        if (syncedFrame) {
          setCachedFrame(syncedFrame);
        }
      }
    };`,
  `    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.key === \`\${presKey}_slide_\${activeSlideIndex}\`) {
        const entry = slideRenderCache.getEntrySync(presKey, activeSlideIndex);
        if (entry) {
          if (entry.status === 'ready' && entry.frame) {
             setCachedFrame(entry.frame);
          }
          setStatus(entry.status);
        }
      }
    };`
);

code = code.replace(
  `        window.dispatchEvent(new CustomEvent('pptx_frame_synced', { detail: { key, slideIndex } }));
      }

      this.evictIfNeeded();`,
  `        window.dispatchEvent(new CustomEvent('pptx_frame_synced', { detail: { key, slideIndex } }));
      } else {
        window.dispatchEvent(new CustomEvent('pptx_frame_synced', { detail: { key, slideIndex } }));
      }

      this.evictIfNeeded();`
);

code = code.replace(
  `      } catch (err) {
        this.cache.set(key, { status: 'error', error: err });
        return null;
      }`,
  `      } catch (err) {
        this.cache.set(key, { status: 'error', error: err });
        if (typeof window !== 'undefined') {
           window.dispatchEvent(new CustomEvent('pptx_frame_synced', { detail: { key, slideIndex: slideIndex } }));
        }
        return null;
      }`
);

code = code.replace(
  `    this.cache.set(key, {
      status: 'rendering',
      promise
    });

    return promise;`,
  `    this.cache.set(key, {
      status: 'rendering',
      promise
    });
    if (typeof window !== 'undefined') {
       window.dispatchEvent(new CustomEvent('pptx_frame_synced', { detail: { key, slideIndex } }));
    }

    return promise;`
);

code = code.replace(
  `  public getFrameSync(presKey: string, slideIndex: number): OffscreenSlideFrame | null {`,
  `  public getEntrySync(presKey: string, slideIndex: number): CacheEntry | null {
    if (!presKey) return null;
    const key = this.buildKey(presKey, slideIndex);
    return this.cache.get(key) || null;
  }

  public getFrameSync(presKey: string, slideIndex: number): OffscreenSlideFrame | null {`
);

code = code.replace(
  `  return {
    cachedFrame,
    registerRenderedFrame
  };`,
  `  return {
    cachedFrame,
    status,
    registerRenderedFrame
  };`
);

fs.writeFileSync('src/utils/SlideRenderCache.ts', code);
