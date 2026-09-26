import { 
  PptxRenderingBackend, 
  PptxBackendCapabilities, 
  PptxRenderOptions, 
  PptxRenderedSlide, 
  PptxPresentationSession 
} from './types';
import { PptxRenderCacheManager } from './cacheManager';

export class PowerPointPptxBackend implements PptxRenderingBackend {
  public readonly id = 'powerpoint';
  public readonly name = 'Microsoft PowerPoint Hardware-Accelerated Backend';

  private activeSessions = new Map<string, PptxPresentationSession>();
  private capabilitiesCache: PptxBackendCapabilities | null = null;

  public async isAvailable(): Promise<boolean> {
    const caps = await this.getCapabilities();
    return caps.available;
  }

  public async getCapabilities(): Promise<PptxBackendCapabilities> {
    if (this.capabilitiesCache) {
      return this.capabilitiesCache;
    }

    if (typeof window === 'undefined' || !window.electronAPI) {
      this.capabilitiesCache = {
        backendType: 'powerpoint',
        available: false,
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'browser',
        supportsNativeTypography: false,
        supportsHardwareRasterization: false,
        supportsVectorFallback: false,
        reason: 'Electron runtime required for Microsoft PowerPoint automation'
      };
      return this.capabilitiesCache;
    }

    try {
      if (typeof window.electronAPI.detectPowerPoint === 'function') {
        const res = await window.electronAPI.detectPowerPoint();
        this.capabilitiesCache = {
          backendType: 'powerpoint',
          available: Boolean(res?.available),
          platform: res?.platform || 'win32',
          executablePath: res?.executablePath,
          version: res?.version,
          reason: res?.reason || (res?.available ? 'Microsoft PowerPoint is detected and ready' : 'PowerPoint not found on this system'),
          supportsNativeTypography: true,
          supportsHardwareRasterization: true,
          supportsVectorFallback: false,
        };
        return this.capabilitiesCache;
      }
    } catch (e: any) {
      console.warn('[PowerPointPptxBackend] Error querying PowerPoint capabilities:', e);
    }

    this.capabilitiesCache = {
      backendType: 'powerpoint',
      available: false,
      platform: 'win32',
      supportsNativeTypography: false,
      supportsHardwareRasterization: false,
      supportsVectorFallback: false,
      reason: 'PowerPoint detection IPC not available'
    };
    return this.capabilitiesCache;
  }

  public async loadPresentation(
    presentationId: string, 
    fileBytes: Uint8Array | ArrayBuffer | string,
    options?: PptxRenderOptions
  ): Promise<PptxPresentationSession> {
    const hash = await PptxRenderCacheManager.computeHash(fileBytes);
    const cacheKey = `ppt_${hash}`;

    if (!options?.forceRefresh) {
      const cached = await PptxRenderCacheManager.getSessionFromDB(cacheKey);
      if (cached && cached.slides && cached.slides.length > 0) {
        this.activeSessions.set(presentationId, cached);
        return cached;
      }
    }

    const isAvail = await this.isAvailable();
    if (!isAvail) {
      throw new Error('Microsoft PowerPoint is not installed or available on this system.');
    }

    if (!window.electronAPI?.renderPptxWithPowerPoint) {
      throw new Error('PowerPoint rendering IPC bridge not found in Electron preload.');
    }

    // Convert file data to Base64 or pass safely to IPC
    let dataToSend: string | Uint8Array;
    if (typeof fileBytes === 'string') {
      dataToSend = fileBytes;
    } else if (fileBytes instanceof Uint8Array) {
      dataToSend = fileBytes;
    } else {
      dataToSend = new Uint8Array(fileBytes);
    }

    const renderResult = await window.electronAPI.renderPptxWithPowerPoint({
      presentationId,
      fileData: dataToSend,
      hash,
      options: {
        width: options?.width || 1920,
        height: options?.height || 1080,
      }
    });

    if (!renderResult || !renderResult.success || !Array.isArray(renderResult.slides) || renderResult.slides.length === 0) {
      throw new Error(renderResult?.error || 'PowerPoint rendering did not produce any slide images.');
    }

    const aspectRatio = renderResult.aspectRatio || (16 / 9);
    const width = renderResult.width || 1920;
    const height = renderResult.height || Math.round(width / aspectRatio);

    const slides: PptxRenderedSlide[] = renderResult.slides.map((sUrl: string, idx: number) => ({
      slideIndex: idx,
      dataUrl: sUrl,
      width,
      height,
      aspectRatio,
      backend: 'powerpoint',
      renderedAt: Date.now()
    }));

    const session: PptxPresentationSession = {
      presentationId,
      slideCount: slides.length,
      aspectRatio,
      width,
      height,
      slides,
      backendUsed: 'powerpoint'
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
