import { 
  PptxRenderingBackend, 
  PptxEngineMode, 
  PptxPresentationSession, 
  PptxRenderOptions, 
  PptxRenderedSlide,
  PptxBackendCapabilities 
} from './types';
import { NativePptxBackend } from './nativeBackend';
import { PowerPointPptxBackend } from './powerPointBackend';
import { PptxRenderCacheManager } from './cacheManager';
import { useStore } from '../../store/useStore';

export class PptxBackendSelector {
  private static nativeBackendInstance = new NativePptxBackend();
  private static powerPointBackendInstance = new PowerPointPptxBackend();

  public static getNativeBackend(): PptxRenderingBackend {
    return this.nativeBackendInstance;
  }

  public static getPowerPointBackend(): PptxRenderingBackend {
    return this.powerPointBackendInstance;
  }

  public static async queryBackendCapabilities(): Promise<{
    native: PptxBackendCapabilities;
    powerpoint: PptxBackendCapabilities;
    recommendedMode: PptxEngineMode;
  }> {
    const nativeCaps = await this.nativeBackendInstance.getCapabilities();
    const pptCaps = await this.powerPointBackendInstance.getCapabilities();

    return {
      native: nativeCaps,
      powerpoint: pptCaps,
      recommendedMode: pptCaps.available ? 'auto' : 'native'
    };
  }

  public static async resolveActiveBackend(mode?: PptxEngineMode): Promise<PptxRenderingBackend> {
    const effectiveMode: PptxEngineMode = mode || useStore.getState().systemOptions?.mainOutput?.presentations?.pptxEngineMode || 'auto';

    if (effectiveMode === 'native') {
      return this.nativeBackendInstance;
    }

    if (effectiveMode === 'powerpoint') {
      const isPptAvail = await this.powerPointBackendInstance.isAvailable();
      if (isPptAvail) {
        return this.powerPointBackendInstance;
      }
      console.warn('[PptxBackendSelector] PowerPoint backend requested but not available. Falling back to native engine.');
      return this.nativeBackendInstance;
    }

    // Auto mode: If PowerPoint is available on this system, use it; otherwise Native
    const isPptAvail = await this.powerPointBackendInstance.isAvailable();
    if (isPptAvail) {
      return this.powerPointBackendInstance;
    }

    return this.nativeBackendInstance;
  }

  /**
   * High-resilience presentation loader:
   * Tries preferred backend first; if it fails for any reason, seamlessly falls back to the native engine without crashing.
   */
  public static async loadPresentation(
    presentationId: string,
    fileBytes: Uint8Array | ArrayBuffer | string,
    mode?: PptxEngineMode,
    options?: PptxRenderOptions
  ): Promise<PptxPresentationSession> {
    const primaryBackend = await this.resolveActiveBackend(mode);

    try {
      const session = await primaryBackend.loadPresentation(presentationId, fileBytes, options);
      // Register canonical session and all slide frames for authoritative consumption across all panels
      PptxRenderCacheManager.registerCanonicalSession(session, [presentationId]);
      return session;
    } catch (err: any) {
      if (primaryBackend.id === 'powerpoint') {
        console.warn('[PptxBackendSelector] Primary PowerPoint backend failed to render slide deck. Executing graceful fallback to Native SimpleWorship PPTX engine:', err);
        const fallbackSession = await this.nativeBackendInstance.loadPresentation(presentationId, fileBytes, options);
        PptxRenderCacheManager.registerCanonicalSession(fallbackSession, [presentationId]);
        return fallbackSession;
      }
      throw err;
    }
  }

  public static async getSlide(
    presentationId: string,
    slideIndex: number,
    mode?: PptxEngineMode,
    options?: PptxRenderOptions
  ): Promise<PptxRenderedSlide | null> {
    const backend = await this.resolveActiveBackend(mode);
    const slide = await backend.renderSlide(presentationId, slideIndex, options);
    if (slide) return slide;
    return await this.nativeBackendInstance.renderSlide(presentationId, slideIndex, options);
  }
}
