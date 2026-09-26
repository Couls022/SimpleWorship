import { 
  PptxRenderingBackend, 
  PptxBackendCapabilities, 
  PptxRenderOptions, 
  PptxRenderedSlide, 
  PptxPresentationSession 
} from './types';
import { parsePptx } from '../pptxParser';
import { PptxRenderCacheManager } from './cacheManager';

export class NativePptxBackend implements PptxRenderingBackend {
  public readonly id = 'native';
  public readonly name = 'Native SimpleWorship PPTX Engine';

  private activeSessions = new Map<string, PptxPresentationSession>();

  public async isAvailable(): Promise<boolean> {
    return true; // Native engine is universally available on all platforms
  }

  public async getCapabilities(): Promise<PptxBackendCapabilities> {
    return {
      backendType: 'native',
      available: true,
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'browser',
      supportsNativeTypography: true,
      supportsHardwareRasterization: false,
      supportsVectorFallback: true,
      version: '2.0.0-canonical-ooxml',
      reason: 'Universal offline OpenXML parser & vector canvas renderer'
    };
  }

  public async loadPresentation(
    presentationId: string, 
    fileBytes: Uint8Array | ArrayBuffer | string,
    options?: PptxRenderOptions
  ): Promise<PptxPresentationSession> {
    const hash = await PptxRenderCacheManager.computeHash(fileBytes);
    const cacheKey = `native_${hash}`;

    if (!options?.forceRefresh) {
      const cached = await PptxRenderCacheManager.getSessionFromDB(cacheKey);
      if (cached) {
        this.activeSessions.set(presentationId, cached);
        return cached;
      }
    }

    let rawData: Uint8Array | ArrayBuffer;
    if (typeof fileBytes === 'string') {
      if (fileBytes.startsWith('data:')) {
        const base64 = fileBytes.split(',')[1] || '';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        rawData = bytes;
      } else {
        throw new Error('Unsupported string format for PPTX binary in NativePptxBackend');
      }
    } else {
      rawData = fileBytes;
    }

    const parsedSlides = await parsePptx(rawData);
    if (!parsedSlides || parsedSlides.length === 0) {
      throw new Error('No slides could be parsed from the PPTX presentation.');
    }

    const aspectRatio = parsedSlides[0]?.aspectRatio || (16 / 9);
    const baseW = 1920;
    const baseH = Math.round(baseW / aspectRatio);

    const slides: PptxRenderedSlide[] = parsedSlides.map((s, idx) => ({
      slideIndex: idx,
      dataUrl: s.backgroundUrl || '',
      width: baseW,
      height: baseH,
      aspectRatio,
      backend: 'native',
      renderedAt: Date.now()
    }));

    const session: PptxPresentationSession = {
      presentationId,
      slideCount: parsedSlides.length,
      aspectRatio,
      width: baseW,
      height: baseH,
      slides,
      backendUsed: 'native'
    };

    this.activeSessions.set(presentationId, session);
    await PptxRenderCacheManager.saveSessionToDB(cacheKey, session);

    return session;
  }

  public async renderSlide(
    presentationId: string, 
    slideIndex: number, 
    options?: PptxRenderOptions
  ): Promise<PptxRenderedSlide | null> {
    const session = this.activeSessions.get(presentationId);
    if (!session || !session.slides[slideIndex]) return null;
    return session.slides[slideIndex];
  }

  public async renderThumbnail(
    presentationId: string, 
    slideIndex: number, 
    options?: PptxRenderOptions
  ): Promise<PptxRenderedSlide | null> {
    return this.renderSlide(presentationId, slideIndex, options);
  }

  public async clearCache(presentationId?: string): Promise<void> {
    if (presentationId) {
      this.activeSessions.delete(presentationId);
    } else {
      this.activeSessions.clear();
    }
  }

  public async dispose(): Promise<void> {
    this.activeSessions.clear();
  }
}
