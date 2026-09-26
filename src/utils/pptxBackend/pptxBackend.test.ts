import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PptxBackendSelector } from './backendSelector';
import { NativePptxBackend } from './nativeBackend';
import { PowerPointPptxBackend } from './powerPointBackend';
import { PptxRenderCacheManager } from './cacheManager';
import JSZip from 'jszip';

describe('PPTX Rendering Backend Architecture Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Backend Interface & Capabilities', () => {
    it('NativePptxBackend implements PptxRenderingBackend contract and is universally available', async () => {
      const native = new NativePptxBackend();
      expect(native.id).toBe('native');
      expect(await native.isAvailable()).toBe(true);

      const caps = await native.getCapabilities();
      expect(caps.available).toBe(true);
      expect(caps.backendType).toBe('native');
      expect(caps.supportsVectorFallback).toBe(true);
    });

    it('PowerPointPptxBackend safely reports unavailable in non-Windows/browser runtime without crashing', async () => {
      const ppt = new PowerPointPptxBackend();
      expect(ppt.id).toBe('powerpoint');
      
      const isAvail = await ppt.isAvailable();
      expect(typeof isAvail).toBe('boolean');

      const caps = await ppt.getCapabilities();
      expect(caps.backendType).toBe('powerpoint');
      expect(typeof caps.available).toBe('boolean');
    });
  });

  describe('2. Backend Selector & Mode Policy', () => {
    it('resolves Native backend when mode is explicitly "native"', async () => {
      const backend = await PptxBackendSelector.resolveActiveBackend('native');
      expect(backend.id).toBe('native');
    });

    it('falls back to Native backend when "powerpoint" is requested but unavailable on the host', async () => {
      const pptBackend = PptxBackendSelector.getPowerPointBackend();
      vi.spyOn(pptBackend, 'isAvailable').mockResolvedValue(false);

      const backend = await PptxBackendSelector.resolveActiveBackend('powerpoint');
      expect(backend.id).toBe('native');
    });

    it('chooses PowerPoint backend in "auto" mode when PowerPoint is available', async () => {
      const pptBackend = PptxBackendSelector.getPowerPointBackend();
      vi.spyOn(pptBackend, 'isAvailable').mockResolvedValue(true);

      const backend = await PptxBackendSelector.resolveActiveBackend('auto');
      expect(backend.id).toBe('powerpoint');
    });

    it('chooses Native backend in "auto" mode when PowerPoint is not available', async () => {
      const pptBackend = PptxBackendSelector.getPowerPointBackend();
      vi.spyOn(pptBackend, 'isAvailable').mockResolvedValue(false);

      const backend = await PptxBackendSelector.resolveActiveBackend('auto');
      expect(backend.id).toBe('native');
    });
  });

  describe('3. Cache Manager & Deterministic Keys', () => {
    it('computes deterministic cache hashes for byte arrays and string inputs', async () => {
      const sampleBytes1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const sampleBytes2 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const differentBytes = new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]);

      const hash1 = await PptxRenderCacheManager.computeHash(sampleBytes1);
      const hash2 = await PptxRenderCacheManager.computeHash(sampleBytes2);
      const hash3 = await PptxRenderCacheManager.computeHash(differentBytes);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });

    it('stores and clears session in memory cache safely', async () => {
      const testKey = 'test_deck_123';
      const mockSession = {
        presentationId: 'deck1',
        slideCount: 2,
        aspectRatio: 16 / 9,
        width: 1920,
        height: 1080,
        slides: [],
        backendUsed: 'native' as const
      };

      PptxRenderCacheManager.setSessionInMemory(testKey, mockSession);
      expect(PptxRenderCacheManager.getSessionFromMemory(testKey)).toEqual(mockSession);

      await PptxRenderCacheManager.clearCache(testKey);
      expect(PptxRenderCacheManager.getSessionFromMemory(testKey)).toBeNull();
    });
  });

  describe('4. Resilient Multi-Backend Loading & Graceful Fallback', () => {
    it('seamlessly falls back to Native backend if PowerPoint backend fails with an error', async () => {
      const pptBackend = PptxBackendSelector.getPowerPointBackend();
      vi.spyOn(pptBackend, 'isAvailable').mockResolvedValue(true);
      vi.spyOn(pptBackend, 'loadPresentation').mockRejectedValue(new Error('PowerPoint COM crash simulation'));

      const zip = new JSZip();
      zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`);
      zip.file('ppt/slides/slide1.xml', `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="1" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100000" cy="50000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>Fallback Slide</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
      
      const buffer = await zip.generateAsync({ type: 'arraybuffer' });

      const session = await PptxBackendSelector.loadPresentation('deck-fallback-test', buffer, 'powerpoint');
      expect(session).toBeDefined();
      expect(session.backendUsed).toBe('native');
      expect(session.slideCount).toBe(1);
    });

    it('PowerPoint precedence: PowerPoint rendered slide is authoritative when PowerPoint backend succeeds', async () => {
      const pptBackend = PptxBackendSelector.getPowerPointBackend();
      vi.spyOn(pptBackend, 'isAvailable').mockResolvedValue(true);
      vi.spyOn(pptBackend, 'loadPresentation').mockResolvedValue({
        presentationId: 'ppt-deck-1',
        slideCount: 3,
        aspectRatio: 16 / 9,
        width: 1920,
        height: 1080,
        slides: [
          { slideIndex: 0, dataUrl: 'data:image/png;base64,slide0', width: 1920, height: 1080, aspectRatio: 16/9, backend: 'powerpoint', renderedAt: 100 },
          { slideIndex: 1, dataUrl: 'data:image/png;base64,slide1', width: 1920, height: 1080, aspectRatio: 16/9, backend: 'powerpoint', renderedAt: 100 },
          { slideIndex: 2, dataUrl: 'data:image/png;base64,slide2', width: 1920, height: 1080, aspectRatio: 16/9, backend: 'powerpoint', renderedAt: 100 }
        ],
        backendUsed: 'powerpoint'
      });

      const session = await PptxBackendSelector.loadPresentation('ppt-deck-1', new Uint8Array([80, 75, 3, 4]), 'powerpoint');
      expect(session.backendUsed).toBe('powerpoint');
      expect(session.slides[0].dataUrl).toBe('data:image/png;base64,slide0');
    });

    it('Native precedence: Native backend is authoritative when native mode is chosen', async () => {
      const pptBackend = PptxBackendSelector.getPowerPointBackend();
      const pptLoadSpy = vi.spyOn(pptBackend, 'loadPresentation');

      const zip = new JSZip();
      zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`);
      zip.file('ppt/slides/slide1.xml', `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="1" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100000" cy="50000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>Slide 1</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
      const buffer = await zip.generateAsync({ type: 'arraybuffer' });

      const session = await PptxBackendSelector.loadPresentation('deck-native-mode', buffer, 'native');
      expect(session.backendUsed).toBe('native');
      expect(pptLoadSpy).not.toHaveBeenCalled();
    });

    it('Failed PowerPoint render does not poison the cache and does not crash Live output', async () => {
      const pptBackend = PptxBackendSelector.getPowerPointBackend();
      vi.spyOn(pptBackend, 'isAvailable').mockResolvedValue(true);
      vi.spyOn(pptBackend, 'loadPresentation').mockRejectedValue(new Error('Process terminated'));

      const cacheKey = 'ppt_failed_deck';
      expect(PptxRenderCacheManager.getSessionFromMemory(cacheKey)).toBeNull();

      const zip = new JSZip();
      zip.file('ppt/presentation.xml', `<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldSz cx="12192000" cy="6858000"/></p:presentation>`);
      zip.file('ppt/slides/slide1.xml', `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:cNvPr id="1" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="100000" cy="50000"/></a:xfrm></p:spPr><p:txBody><a:bodyPr/><a:p><a:r><a:t>Safe Fallback</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`);
      const buffer = await zip.generateAsync({ type: 'arraybuffer' });

      const session = await PptxBackendSelector.loadPresentation('deck-safe', buffer, 'auto');
      expect(session).toBeDefined();
      expect(session.backendUsed).toBe('native');
      expect(PptxRenderCacheManager.getSessionFromMemory(cacheKey)).toBeNull();
    });
  });
});
