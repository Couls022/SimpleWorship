import { PptxRenderedSlide, PptxPresentationSession, CanonicalSlideRender } from './types';
import { getDB } from '../../db';

export class PptxRenderCacheManager {
  private static memoryCache = new Map<string, PptxPresentationSession>();
  private static canonicalFrames = new Map<string, CanonicalSlideRender>();
  private static sessionAliases = new Map<string, string>();

  public static async computeHash(data: Uint8Array | ArrayBuffer | string): Promise<string> {
    if (typeof data === 'string') {
      let hash = 0;
      for (let i = 0; i < data.length; i++) {
        hash = (hash << 5) - hash + data.charCodeAt(i);
        hash |= 0;
      }
      return `str_${Math.abs(hash).toString(16)}`;
    }

    try {
      const buffer = data instanceof ArrayBuffer ? data : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
        const hashBuf = await crypto.subtle.digest('SHA-256', buffer);
        const hashArr = Array.from(new Uint8Array(hashBuf));
        return hashArr.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
      }
    } catch (e) {}

    // Fallback fast hash
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    const len = Math.min(bytes.length, 65536); // sample up to 64KB for speed
    for (let i = 0; i < len; i++) {
      h1 = Math.imul(h1 ^ bytes[i], 2654435761);
      h2 = Math.imul(h2 ^ bytes[i], 1597334677);
    }
    return `fast_${(Math.abs(h1 ^ h2)).toString(16)}_${bytes.length}`;
  }

  public static getSessionFromMemory(cacheKey: string): PptxPresentationSession | null {
    if (this.memoryCache.has(cacheKey)) {
      return this.memoryCache.get(cacheKey)!;
    }
    const resolvedKey = this.sessionAliases.get(cacheKey);
    if (resolvedKey && this.memoryCache.has(resolvedKey)) {
      return this.memoryCache.get(resolvedKey)!;
    }
    return null;
  }

  public static setSessionInMemory(cacheKey: string, session: PptxPresentationSession): void {
    this.memoryCache.set(cacheKey, session);
    if (session.presentationId) {
      this.sessionAliases.set(session.presentationId, cacheKey);
      this.memoryCache.set(session.presentationId, session);
    }
    // Limit memory cache size to 15 decks
    if (this.memoryCache.size > 15) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) this.memoryCache.delete(firstKey);
    }
  }

  /**
   * Register authoritative canonical presentation session and its rendered frames
   */
  public static registerCanonicalSession(session: PptxPresentationSession, aliases: string[] = []): void {
    const primaryId = session.presentationId;
    this.setSessionInMemory(primaryId, session);

    const allKeys = new Set<string>([primaryId, ...aliases]);
    for (const alias of allKeys) {
      if (!alias) continue;
      this.sessionAliases.set(alias, primaryId);
      this.memoryCache.set(alias, session);
    }

    if (Array.isArray(session.slides)) {
      session.slides.forEach((slide) => {
        const canonical: CanonicalSlideRender = {
          presentationId: primaryId,
          slideIndex: slide.slideIndex,
          width: slide.width || session.width || 1920,
          height: slide.height || session.height || 1080,
          aspectRatio: slide.aspectRatio || session.aspectRatio || (16 / 9),
          aspectRatioLabel: (session as any).aspectRatioLabel,
          engine: session.backendUsed,
          dataUrl: slide.dataUrl,
          canvasProps: slide.canvasProps,
          renderVersion: Date.now(),
          timestamp: Date.now(),
        };

        for (const key of allKeys) {
          if (!key) continue;
          this.canonicalFrames.set(`${key}_slide_${slide.slideIndex}`, canonical);
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('simpleworship:canonical-frame-updated', {
          detail: {
            presentationId: primaryId,
            aliases: Array.from(allKeys),
            slideCount: session.slides?.length || 0,
            engine: session.backendUsed,
            timestamp: Date.now(),
          },
        })
      );
    }
  }

  public static getCanonicalFrame(identifier: string | undefined, slideIndex: number): CanonicalSlideRender | null {
    if (!identifier) return null;
    const directKey = `${identifier}_slide_${slideIndex}`;
    if (this.canonicalFrames.has(directKey)) {
      return this.canonicalFrames.get(directKey)!;
    }
    const resolvedAlias = this.sessionAliases.get(identifier);
    if (resolvedAlias) {
      const aliasKey = `${resolvedAlias}_slide_${slideIndex}`;
      if (this.canonicalFrames.has(aliasKey)) {
        return this.canonicalFrames.get(aliasKey)!;
      }
    }
    // Also check clean identifier (e.g. without asset- prefix or with asset- prefix)
    const cleanId = identifier.startsWith('asset-') ? identifier.replace('asset-', '') : `asset-${identifier}`;
    const cleanKey = `${cleanId}_slide_${slideIndex}`;
    if (this.canonicalFrames.has(cleanKey)) {
      return this.canonicalFrames.get(cleanKey)!;
    }
    return null;
  }

  public static getCanonicalSession(identifier: string | undefined): PptxPresentationSession | null {
    if (!identifier) return null;
    return this.getSessionFromMemory(identifier);
  }

  public static async getSessionFromDB(cacheKey: string): Promise<PptxPresentationSession | null> {
    try {
      const mem = this.getSessionFromMemory(cacheKey);
      if (mem) return mem;
      const db = await getDB();
      const cached = await db.get('assets', `pptx_rendered_${cacheKey}`);
      if (cached && cached.data?.session) {
        this.setSessionInMemory(cacheKey, cached.data.session);
        return cached.data.session;
      }
    } catch (e) {}
    return null;
  }

  public static async saveSessionToDB(cacheKey: string, session: PptxPresentationSession): Promise<void> {
    this.setSessionInMemory(cacheKey, session);
    try {
      const db = await getDB();
      await db.put('assets', {
        id: `pptx_rendered_${cacheKey}`,
        name: `PPTX Rendered Cache ${cacheKey}`,
        type: 'image',
        url: session.slides[0]?.dataUrl || '',
        createdAt: Date.now(),
        data: { session }
      });
    } catch (e) {}
  }

  public static async clearCache(cacheKey?: string): Promise<void> {
    if (cacheKey) {
      this.memoryCache.delete(cacheKey);
      this.sessionAliases.delete(cacheKey);
      // Remove any canonical frames matching this cacheKey
      for (const [key] of Array.from(this.canonicalFrames.entries())) {
        if (key.startsWith(`${cacheKey}_slide_`)) {
          this.canonicalFrames.delete(key);
        }
      }
      try {
        const db = await getDB();
        await db.delete('assets', `pptx_rendered_${cacheKey}`);
      } catch (e) {}
    } else {
      this.memoryCache.clear();
      this.canonicalFrames.clear();
      this.sessionAliases.clear();
    }
  }
}
