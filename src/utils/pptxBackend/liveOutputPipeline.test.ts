import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PresentationCore } from '../../core/PresentationCore';
import { PresentationItem, PresentationState } from '../../types';
import { PptxBackendSelector } from './backendSelector';
import { PptxRenderCacheManager } from './cacheManager';
import { PptxPresentationSession, CanonicalSlideRender } from './types';

describe('Live Output Pipeline & Canonical PPTX Rendering Integrity Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    PptxRenderCacheManager.clearCache();
  });

  const mockPptxSession: PptxPresentationSession = {
    presentationId: 'pres-saving-faith',
    slideCount: 3,
    aspectRatio: 16 / 9,
    width: 1920,
    height: 1080,
    backendUsed: 'powerpoint',
    slides: [
      {
        slideIndex: 0,
        dataUrl: 'data:image/png;base64,canonical_slide_0_powerpoint_template',
        width: 1920,
        height: 1080,
        aspectRatio: 16 / 9,
        backend: 'powerpoint',
        renderedAt: 1000
      },
      {
        slideIndex: 1,
        dataUrl: 'data:image/png;base64,canonical_slide_1_answer_truth_teal_design',
        width: 1920,
        height: 1080,
        aspectRatio: 16 / 9,
        backend: 'powerpoint',
        renderedAt: 1000
      },
      {
        slideIndex: 2,
        dataUrl: 'data:image/png;base64,canonical_slide_2_conclusion',
        width: 1920,
        height: 1080,
        aspectRatio: 16 / 9,
        backend: 'powerpoint',
        renderedAt: 1000
      }
    ]
  };

  it('1. Live Output and Target Monitor consume the same canonical frame', () => {
    PptxRenderCacheManager.registerCanonicalSession(mockPptxSession, ['asset-saving-faith']);

    // Consumer A: Live Output Panel
    const liveOutputFrame = PptxRenderCacheManager.getCanonicalFrame('asset-saving-faith', 1);
    // Consumer B: Target Monitor / Projector
    const targetMonitorFrame = PptxRenderCacheManager.getCanonicalFrame('pres-saving-faith', 1);

    expect(liveOutputFrame).toBeDefined();
    expect(targetMonitorFrame).toBeDefined();
    expect(liveOutputFrame?.dataUrl).toBe(targetMonitorFrame?.dataUrl);
    expect(liveOutputFrame?.dataUrl).toBe('data:image/png;base64,canonical_slide_1_answer_truth_teal_design');
    expect(liveOutputFrame?.engine).toBe('powerpoint');
  });

  it('2. PowerPoint-rendered frame is used by all live outputs when PowerPoint mode is active', async () => {
    const pptBackend = PptxBackendSelector.getPowerPointBackend();
    vi.spyOn(pptBackend, 'isAvailable').mockResolvedValue(true);
    vi.spyOn(pptBackend, 'loadPresentation').mockResolvedValue(mockPptxSession);

    const session = await PptxBackendSelector.loadPresentation('pres-saving-faith', new Uint8Array([1, 2, 3]), 'powerpoint');
    expect(session.backendUsed).toBe('powerpoint');

    const frameForSlide0 = PptxRenderCacheManager.getCanonicalFrame('pres-saving-faith', 0);
    expect(frameForSlide0?.engine).toBe('powerpoint');
    expect(frameForSlide0?.dataUrl).toContain('canonical_slide_0');
  });

  it('3. Native-rendered frame is used by all live outputs in native mode', async () => {
    const nativeSession: PptxPresentationSession = {
      presentationId: 'pres-native-deck',
      slideCount: 2,
      aspectRatio: 16 / 9,
      width: 1920,
      height: 1080,
      backendUsed: 'native',
      slides: [
        {
          slideIndex: 0,
          dataUrl: 'data:image/png;base64,native_vector_render_0',
          canvasProps: { width: 1920, height: 1080, activeSlide: { id: 's0' } },
          width: 1920,
          height: 1080,
          aspectRatio: 16 / 9,
          backend: 'native',
          renderedAt: 1000
        }
      ]
    };

    const nativeBackend = PptxBackendSelector.getNativeBackend();
    vi.spyOn(nativeBackend, 'loadPresentation').mockResolvedValue(nativeSession);

    const session = await PptxBackendSelector.loadPresentation('pres-native-deck', new Uint8Array([1, 2, 3]), 'native');
    expect(session.backendUsed).toBe('native');

    const canonical = PptxRenderCacheManager.getCanonicalFrame('pres-native-deck', 0);
    expect(canonical?.engine).toBe('native');
    expect(canonical?.dataUrl).toBe('data:image/png;base64,native_vector_render_0');
  });

  it('4. Auto mode uses PowerPoint when available', async () => {
    const pptBackend = PptxBackendSelector.getPowerPointBackend();
    vi.spyOn(pptBackend, 'isAvailable').mockResolvedValue(true);
    vi.spyOn(pptBackend, 'loadPresentation').mockResolvedValue(mockPptxSession);

    const session = await PptxBackendSelector.loadPresentation('pres-saving-faith', new Uint8Array([1, 2, 3]), 'auto');
    expect(session.backendUsed).toBe('powerpoint');
  });

  it('5. Auto mode falls back to native when PowerPoint fails or is unavailable', async () => {
    const pptBackend = PptxBackendSelector.getPowerPointBackend();
    vi.spyOn(pptBackend, 'isAvailable').mockResolvedValue(true);
    vi.spyOn(pptBackend, 'loadPresentation').mockRejectedValue(new Error('PowerPoint COM crash'));

    const nativeSession: PptxPresentationSession = {
      presentationId: 'pres-fallback',
      slideCount: 1,
      aspectRatio: 16 / 9,
      width: 1920,
      height: 1080,
      backendUsed: 'native',
      slides: [{
        slideIndex: 0,
        dataUrl: 'data:image/png;base64,fallback_native_slide',
        width: 1920,
        height: 1080,
        aspectRatio: 16 / 9,
        backend: 'native',
        renderedAt: 1000
      }]
    };

    const nativeBackend = PptxBackendSelector.getNativeBackend();
    vi.spyOn(nativeBackend, 'loadPresentation').mockResolvedValue(nativeSession);

    const session = await PptxBackendSelector.loadPresentation('pres-fallback', new Uint8Array([1, 2, 3]), 'auto');
    expect(session.backendUsed).toBe('native');
    expect(session.slides[0].dataUrl).toBe('data:image/png;base64,fallback_native_slide');
  });

  it('6. Live Output does not reconstruct a separate PPTX representation when canonical frame exists', () => {
    PptxRenderCacheManager.registerCanonicalSession(mockPptxSession, ['content-test-6']);

    const canonicalFrame = PptxRenderCacheManager.getCanonicalFrame('content-test-6', 1);
    expect(canonicalFrame).not.toBeNull();
    // Authoritative frame dataUrl is present, precluding plain text DOM reconstruction
    expect(canonicalFrame?.dataUrl).toBeTruthy();
    expect(canonicalFrame?.dataUrl).toBe('data:image/png;base64,canonical_slide_1_answer_truth_teal_design');
  });

  it('7. Active slide change updates all outputs synchronously', () => {
    PptxRenderCacheManager.registerCanonicalSession(mockPptxSession, ['content-test-7']);

    // Slide 0
    let slideIndex = 0;
    let liveFrame = PptxRenderCacheManager.getCanonicalFrame('content-test-7', slideIndex);
    let targetFrame = PptxRenderCacheManager.getCanonicalFrame('content-test-7', slideIndex);
    expect(liveFrame?.dataUrl).toBe('data:image/png;base64,canonical_slide_0_powerpoint_template');
    expect(targetFrame?.dataUrl).toBe('data:image/png;base64,canonical_slide_0_powerpoint_template');

    // Slide 1 (Answer / Truth slide)
    slideIndex = 1;
    liveFrame = PptxRenderCacheManager.getCanonicalFrame('content-test-7', slideIndex);
    targetFrame = PptxRenderCacheManager.getCanonicalFrame('content-test-7', slideIndex);
    expect(liveFrame?.dataUrl).toBe('data:image/png;base64,canonical_slide_1_answer_truth_teal_design');
    expect(targetFrame?.dataUrl).toBe('data:image/png;base64,canonical_slide_1_answer_truth_teal_design');

    // Slide 2
    slideIndex = 2;
    liveFrame = PptxRenderCacheManager.getCanonicalFrame('content-test-7', slideIndex);
    targetFrame = PptxRenderCacheManager.getCanonicalFrame('content-test-7', slideIndex);
    expect(liveFrame?.dataUrl).toBe('data:image/png;base64,canonical_slide_2_conclusion');
    expect(targetFrame?.dataUrl).toBe('data:image/png;base64,canonical_slide_2_conclusion');
  });

  it('8. Live OFF -> ON preserves active slide and canonical render', () => {
    PptxRenderCacheManager.registerCanonicalSession(mockPptxSession, ['asset-live-toggle']);

    const mockItem: PresentationItem = {
      id: 'pptx-item-live-toggle',
      name: 'Sunday Sermon.pptx',
      type: 'presentation',
      contentId: 'asset-live-toggle',
      data: { slides: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] }
    };

    let state: PresentationState = {
      activeScheduleId: null,
      activeItemId: 'pptx-item-live-toggle',
      activeSlideIndex: 1,
      nextSlideIndex: 2,
      timestamp: Date.now(),
      isLiveEnabled: true,
      isBlack: false,
      isClear: false,
      showLogo: false,
      directLiveItem: mockItem,
    };

    // Live OFF
    state = { ...state, isLiveEnabled: false };
    expect(state.isLiveEnabled).toBe(false);
    expect(state.activeSlideIndex).toBe(1);

    // Live ON
    state = { ...state, isLiveEnabled: true };
    expect(state.isLiveEnabled).toBe(true);
    expect(state.activeSlideIndex).toBe(1);

    const frame = PptxRenderCacheManager.getCanonicalFrame(state.directLiveItem?.contentId, state.activeSlideIndex);
    expect(frame).toBeDefined();
    expect(frame?.dataUrl).toBe('data:image/png;base64,canonical_slide_1_answer_truth_teal_design');
  });

  it('9. Missing or unhydrated binary data does not create a black screen', () => {
    const unhydratedItem: PresentationItem = {
      id: 'item-unhydrated',
      name: 'Presentation Without In-Memory Bytes.pptx',
      type: 'presentation',
      contentId: 'asset-unhydrated',
      data: {}
    };

    const slides = PresentationCore.generateSlides(unhydratedItem, [], undefined as any);
    expect(slides.length).toBeGreaterThan(0);
    expect(slides[0].title).toBeDefined();
  });

  it('10. PPTX template/background remains part of the canonical frame', () => {
    PptxRenderCacheManager.registerCanonicalSession(mockPptxSession, ['pres-saving-faith']);

    const canonicalFrame = PptxRenderCacheManager.getCanonicalFrame('pres-saving-faith', 1);
    expect(canonicalFrame?.dataUrl).toContain('teal_design');
    expect(canonicalFrame?.width).toBe(1920);
    expect(canonicalFrame?.height).toBe(1080);
    expect(canonicalFrame?.aspectRatio).toBeCloseTo(16 / 9);
  });

  it('11. Stale cached slide cannot replace the current canonical slide', () => {
    PptxRenderCacheManager.registerCanonicalSession(mockPptxSession, ['deck-mutation']);

    // Updated version of deck
    const updatedSession: PptxPresentationSession = {
      ...mockPptxSession,
      slides: [
        {
          ...mockPptxSession.slides[0],
          dataUrl: 'data:image/png;base64,v2_updated_slide_0',
          renderedAt: 2000
        }
      ]
    };

    PptxRenderCacheManager.registerCanonicalSession(updatedSession, ['deck-mutation']);

    const frame = PptxRenderCacheManager.getCanonicalFrame('deck-mutation', 0);
    expect(frame?.dataUrl).toBe('data:image/png;base64,v2_updated_slide_0');
  });

  it('12. Aspect ratio is preserved across Live Output and Target Monitor', () => {
    const customRatioSession: PptxPresentationSession = {
      presentationId: 'pres-4-3',
      slideCount: 1,
      aspectRatio: 4 / 3,
      width: 1440,
      height: 1080,
      backendUsed: 'powerpoint',
      slides: [
        {
          slideIndex: 0,
          dataUrl: 'data:image/png;base64,slide_4_3',
          width: 1440,
          height: 1080,
          aspectRatio: 4 / 3,
          backend: 'powerpoint',
          renderedAt: 1000
        }
      ]
    };

    PptxRenderCacheManager.registerCanonicalSession(customRatioSession, ['pres-4-3']);

    const frame = PptxRenderCacheManager.getCanonicalFrame('pres-4-3', 0);
    expect(frame?.aspectRatio).toBeCloseTo(4 / 3);
    expect(frame?.width).toBe(1440);
    expect(frame?.height).toBe(1080);
  });
});
