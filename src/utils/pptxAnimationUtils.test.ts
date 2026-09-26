import { describe, it, expect } from 'vitest';
import { 
  getSlideEntranceElementIds, 
  buildMergedPresentationElementStates,
  ElementAnimationState
} from './pptxAnimationUtils';

describe('pptxAnimationUtils', () => {
  it('identifies entrance animations from nativeAnimations OpenXML timing', () => {
    const mockSlide = {
      id: 'slide-1',
      elements: [
        { id: 'title-1', text: 'Welcome' },
        { id: 'bullet-box', text: 'Point 1\nPoint 2\nPoint 3' }
      ],
      nativeAnimations: [
        {
          presetClass: 'entr',
          targetId: 'bullet-box',
          trigger: 'onClick',
          durationMs: 500
        }
      ]
    };

    const ids = getSlideEntranceElementIds(mockSlide);
    expect(ids.has('bullet-box')).toBe(true);
    // Sub-paragraph builds should also be registered
    expect(ids.has('bullet-box::p0')).toBe(true);
    expect(ids.has('bullet-box::p1')).toBe(true);
    expect(ids.has('bullet-box::p2')).toBe(true);
    // Title without animation should NOT be in entrance ids
    expect(ids.has('title-1')).toBe(false);
  });

  it('identifies entrance animations from slide.animations array', () => {
    const mockSlide = {
      id: 'slide-2',
      elements: [
        { id: 'shape-a', text: 'Item A' },
        { id: 'shape-b', text: 'Item B' }
      ],
      animations: [
        {
          elementId: 'shape-a',
          entrance: true,
          action: 'fade-in',
          durationMs: 400
        }
      ]
    };

    const ids = getSlideEntranceElementIds(mockSlide);
    expect(ids.has('shape-a')).toBe(true);
    expect(ids.has('shape-b')).toBe(false);
  });

  it('identifies entrance animations from slide.objects with animation property', () => {
    const mockSlide = {
      id: 'slide-3',
      objects: [
        {
          id: 'obj-header',
          type: 'text',
          text: 'Title'
        },
        {
          id: 'obj-animated',
          type: 'text',
          text: 'Animated Text',
          animation: {
            type: 'entrance',
            action: 'appear'
          }
        }
      ]
    };

    const ids = getSlideEntranceElementIds(mockSlide);
    expect(ids.has('obj-animated')).toBe(true);
    expect(ids.has('obj-header')).toBe(false);
  });

  it('handles background animation targets (pptx-bg)', () => {
    const mockSlide = {
      id: 'slide-bg',
      nativeAnimations: [
        {
          presetClass: 'entr',
          targetId: 'shape-bg-box',
          target: { type: 'shape', backgroundOnly: true }
        }
      ]
    };

    const ids = getSlideEntranceElementIds(mockSlide);
    expect(ids.has('shape-bg-box')).toBe(true);
    expect(ids.has('shape-bg-box::pptx-bg')).toBe(true);
  });

  it('builds merged presentation element states guaranteeing frame-0 hidden state', () => {
    const entranceIds = new Set(['bullet-box', 'bullet-box::p0', 'bullet-box::p1']);
    
    // Scenario 1: Initial slide load before timeline controller reveals anything
    const emptyControllerStates = new Map<string, ElementAnimationState>();
    const merged1 = buildMergedPresentationElementStates(emptyControllerStates, entranceIds, false);
    
    expect(merged1).toBeDefined();
    expect(merged1?.get('bullet-box')?.visible).toBe(false);
    expect(merged1?.get('bullet-box::p0')?.visible).toBe(false);
    expect(merged1?.get('bullet-box::p1')?.visible).toBe(false);

    // Scenario 2: Controller has advanced and revealed 'bullet-box'
    const updatedControllerStates = new Map<string, ElementAnimationState>([
      ['bullet-box', { visible: true, cssAnimation: 'pptx-fade-in 0.5s ease' }]
    ]);
    const merged2 = buildMergedPresentationElementStates(updatedControllerStates, entranceIds, false);
    
    // Revealed element should be visible with animation
    expect(merged2?.get('bullet-box')?.visible).toBe(true);
    expect(merged2?.get('bullet-box')?.cssAnimation).toBe('pptx-fade-in 0.5s ease');
    // Unrevealed paragraph should still remain hidden
    expect(merged2?.get('bullet-box::p0')?.visible).toBe(false);
  });

  it('returns undefined for thumbnails so thumbnails always show full content', () => {
    const entranceIds = new Set(['bullet-box']);
    const controllerStates = new Map<string, ElementAnimationState>();
    const merged = buildMergedPresentationElementStates(controllerStates, entranceIds, true);
    
    expect(merged).toBeUndefined();
  });

  it('correctly associates shapeId and paragraph builds from nativeAnimations', () => {
    const mockSlideWithShapeId = {
      id: 'slide-complex',
      elements: [
        { id: 'shape-4', shapeId: '4', text: 'Point 1\nPoint 2\nPoint 3' }
      ],
      nativeAnimations: [
        {
          presetClass: 'entr',
          targetId: 'shape-4',
          target: { shapeId: '4', paragraphIndex: 0 },
          trigger: 'onClick',
          action: 'fly-in'
        },
        {
          presetClass: 'entr',
          targetId: 'shape-4',
          target: { shapeId: '4', paragraphIndex: 1 },
          trigger: 'onClick',
          action: 'fly-in'
        }
      ]
    };

    const ids = getSlideEntranceElementIds(mockSlideWithShapeId);
    expect(ids.has('shape-4')).toBe(true);
    expect(ids.has('4')).toBe(true);
    expect(ids.has('shape-4::p0')).toBe(true);
    expect(ids.has('shape-4::p1')).toBe(true);
  });
});
