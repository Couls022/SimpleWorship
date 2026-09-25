/**
 * PPTX Animation Utilities
 * Provides deterministic calculation and pre-seeding of animation states
 * to eliminate frame-0 flashing and ensure authentic PowerPoint animation behavior.
 */

export interface ElementAnimationState {
  visible: boolean;
  cssAnimation: string | undefined;
  [key: string]: any;
}

/**
 * Extracts all element, shape, and text-build IDs that have entrance animations on a slide.
 */
export function getSlideEntranceElementIds(slide: any): Set<string> {
  const ids = new Set<string>();
  if (!slide) return ids;

  const elements = slide.elements || slide.objects || [];

  const registerTarget = (rawTargetId: string | number, isEntrance: boolean, animObj?: any) => {
    if (!isEntrance || rawTargetId === undefined || rawTargetId === null) return;
    const targetIdStr = String(rawTargetId).trim();
    if (!targetIdStr) return;

    // Register primary target ID and variations
    ids.add(targetIdStr);
    if (!targetIdStr.startsWith('shape-') && /^\d+$/.test(targetIdStr)) {
      ids.add(`shape-${targetIdStr}`);
    } else if (targetIdStr.startsWith('shape-')) {
      ids.add(targetIdStr.replace(/^shape-/, ''));
    }

    // Background animation suffix
    if (animObj?.target?.backgroundOnly === true || animObj?.target?.type === 'background') {
      ids.add(`${targetIdStr}::pptx-bg`);
      ids.add(`shape-${targetIdStr}::pptx-bg`);
    }

    // Paragraph build targets
    if (animObj?.target?.paragraphIndex !== undefined) {
      ids.add(`${targetIdStr}::p${animObj.target.paragraphIndex}`);
      ids.add(`shape-${targetIdStr}::p${animObj.target.paragraphIndex}`);
    }

    // Find any matching slide elements/shapes (exact match, loose numeric match, or shapeId match)
    const matchingElements = Array.isArray(elements) 
      ? elements.filter((e: any) => 
          e && (
            String(e.id) === targetIdStr || 
            String(e.shapeId) === targetIdStr || 
            String(e.spid) === targetIdStr ||
            `shape-${e.id}` === targetIdStr ||
            (typeof e.id === 'string' && e.id.replace(/^shape-/, '') === targetIdStr.replace(/^shape-/, ''))
          )
        )
      : [];

    // Register all paragraph builds for this shape
    const maxParagraphs = matchingElements.reduce((max, el) => {
      const segmentCount = el.textSegments?.length || (typeof el.text === 'string' ? el.text.split('\n').length : 0);
      return Math.max(max, segmentCount);
    }, 20);

    for (let p = 0; p < Math.max(maxParagraphs, 25); p++) {
      ids.add(`${targetIdStr}::p${p}`);
      if (!targetIdStr.startsWith('shape-')) {
        ids.add(`shape-${targetIdStr}::p${p}`);
      }
    }
  };

  // 1. Inspect nativeAnimations (OpenXML timing tree from PPTX)
  if (Array.isArray(slide.nativeAnimations)) {
    for (const anim of slide.nativeAnimations) {
      if (!anim) continue;
      const presetClass = String(anim.presetClass || anim.type || '').toLowerCase();
      const isEntrance = 
        presetClass === 'entr' || 
        presetClass === 'entrance' ||
        anim.entrance === true ||
        Boolean(anim.isEntrance);

      const targetId = anim.target?.subShapeId
        ?? anim.target?.shapeId
        ?? anim.target?.spid
        ?? anim.target?.id
        ?? anim.targetId
        ?? anim.shapeId
        ?? anim.elementId;

      if (targetId !== undefined && targetId !== null) {
        registerTarget(targetId, isEntrance, anim);
      }
    }
  }

  // 2. Inspect slide.animations (parsed/stored animations array)
  if (Array.isArray(slide.animations)) {
    for (const anim of slide.animations) {
      if (!anim) continue;
      const presetClass = String(anim.presetClass || anim.type || anim.category || '').toLowerCase();
      const action = String(anim.action || '').toLowerCase();
      const isEntrance = 
        anim.entrance === true || 
        presetClass === 'entr' || 
        presetClass === 'entrance' ||
        ['appear', 'fade-in', 'fade', 'fly-in', 'fly', 'zoom-in', 'zoom', 'wipe-in', 'wipe', 'float-in', 'rise-up', 'reveal'].includes(action);

      const targetId = anim.elementId ?? anim.targetId ?? anim.shapeId ?? anim.target?.shapeId;
      if (targetId !== undefined && targetId !== null) {
        registerTarget(targetId, isEntrance, anim);
      }
    }
  }

  // 3. Inspect slide.elements directly
  if (Array.isArray(slide.elements)) {
    for (const el of slide.elements) {
      if (!el) continue;
      if (Array.isArray(el.animations)) {
        for (const anim of el.animations) {
          const isEntrance = anim.entrance === true || anim.presetClass === 'entr' || anim.type === 'entrance';
          if (isEntrance) {
            registerTarget(el.id, true, anim);
          }
        }
      }
    }
  }

  // 4. Inspect slide.objects directly
  if (Array.isArray(slide.objects)) {
    for (const obj of slide.objects) {
      if (!obj) continue;
      if (obj.animation) {
        const anim = obj.animation;
        const isEntrance = anim.type === 'entrance' || anim.category === 'entrance' || anim.action === 'appear' || anim.action === 'fade-in';
        if (isEntrance) {
          registerTarget(obj.id, true, anim);
        }
      }
    }
  }

  return ids;
}

/**
 * Builds a merged presentation element state map.
 * Guarantees that any element with an entrance animation starts in a HIDDEN state (visible: false)
 * until it is explicitly revealed by the presentation timeline controller on user click.
 */
export function buildMergedPresentationElementStates(
  presentationElementStates: Map<string, any> | undefined,
  slideEntranceIds: Set<string>,
  isThumbnail: boolean
): Map<string, ElementAnimationState> | undefined {
  if (isThumbnail) {
    return undefined; // Thumbnails show full content
  }

  const result = new Map<string, ElementAnimationState>();

  // 1. Copy over active controller states if available
  if (presentationElementStates && presentationElementStates.size > 0) {
    for (const [key, val] of presentationElementStates.entries()) {
      if (val) {
        result.set(key, {
          ...val,
          visible: val.visible !== false,
          cssAnimation: val.cssAnimation ?? undefined
        });
      }
    }
  }

  // 2. Enforce initial hidden state for all entrance elements that have not been explicitly revealed
  for (const id of slideEntranceIds) {
    const existing = result.get(id);
    if (!existing || existing.visible === undefined) {
      result.set(id, { visible: false, cssAnimation: undefined });
    }
  }

  return result;
}
