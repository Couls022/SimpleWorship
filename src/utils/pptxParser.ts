import JSZip from 'jszip';
import { DOMParser as XmldomParser } from '@xmldom/xmldom';
import { Slide, SlideElement, SlideObject, ShapeType, SlideTransition, TextRun, ParagraphRun } from '../types';
import { 
  getCompatibleFontStack, 
  extractFontsFromPptx, 
  ensurePptxFontsLoaded, 
  calculateAutoFitTextScale,
  cleanPptxFontName 
} from './pptxFontManager';
import { PresentationCoordinateSystem, GroupTransformContext } from './pptxCoordinateSystem';

export interface ParsedSlide extends Slide {
  notes?: string;
  elements?: SlideElement[];
  objects?: SlideObject[];
}

export function createXmlParser(): { parseFromString: (xml: string, mimeType?: string) => Document } {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser();
  }
  return new XmldomParser() as any;
}

function findRelationshipTarget(relsDoc: Document | null, options: { id?: string; typeSubstring?: string }): string | undefined {
  if (!relsDoc) return undefined;
  const rels = Array.from(relsDoc.getElementsByTagName('Relationship'));
  for (const rel of rels) {
    if (options.id && rel.getAttribute('Id') === options.id) {
      return rel.getAttribute('Target') || undefined;
    }
    if (options.typeSubstring) {
      const typeAttr = rel.getAttribute('Type') || '';
      if (typeAttr.toLowerCase().includes(options.typeSubstring.toLowerCase())) {
        return rel.getAttribute('Target') || undefined;
      }
    }
  }
  return undefined;
}

// Luminance calculation to enforce WCAG accessibility & crystal clear readability
function getLuminance(hex: string): number {
  if (!hex || typeof hex !== 'string') return 0.5;
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return 0.5;
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  if (isNaN(r) || isNaN(g) || isNaN(b)) return 0.5;
  const a = [r, g, b].map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function ensureHighContrast(textColor: string | undefined, isDarkBackground: boolean, bgHex?: string): string {
  if (!textColor) return isDarkBackground ? '#FFFFFF' : '#0F172A';
  
  if (isDarkBackground) {
    if (textColor.startsWith('#') && textColor.length === 7) {
      const lum = getLuminance(textColor);
      if (lum < 0.35) {
        return '#FFFFFF';
      }
    } else if (textColor.toLowerCase().includes('black') || textColor === '#000000' || textColor === '#1F2421') {
      return '#FFFFFF';
    }
    return textColor;
  } else {
    if (textColor.startsWith('#') && textColor.length === 7) {
      const lum = getLuminance(textColor);
      if (lum > 0.65) {
        return '#0F172A';
      }
    } else if (textColor.toLowerCase().includes('white') || textColor === '#FFFFFF') {
      return '#0F172A';
    }
    return textColor;
  }
}

/**
 * High-performance, Third-Party Compatible PPTX Presentation Engine Parser
 * Decodes slides, backgrounds, OpenXML master/layout inheritance chains, 
 * DrawingML shapes, vector graphics, tables, typography runs, and animations.
 */
export async function parsePptx(file: File | Blob | ArrayBuffer | Uint8Array): Promise<ParsedSlide[]> {
  if (!file) return [];

  let zipData: ArrayBuffer | Uint8Array;
  if (file instanceof Blob) {
    if (file.size === 0) {
      console.warn('[pptxParser] Empty file blob provided (0 bytes)');
      return [];
    }
    zipData = await file.arrayBuffer();
  } else {
    zipData = file;
  }

  if (!zipData || (zipData instanceof ArrayBuffer && zipData.byteLength < 4) || (zipData instanceof Uint8Array && zipData.byteLength < 4)) {
    console.warn('[pptxParser] Insufficient binary data for PPTX parsing');
    return [];
  }

  const zip = new JSZip();
  let loadedZip: JSZip;
  try {
    loadedZip = await zip.loadAsync(zipData);
  } catch (zipErr) {
    console.warn('[pptxParser] Failed to load ZIP container:', zipErr);
    return [];
  }
  const parser = createXmlParser();

  // Trigger proactive background font loading from Google Fonts for Canva & external PPTX files
  extractFontsFromPptx(zipData).then((fonts) => {
    if (fonts.length > 0) {
      ensurePptxFontsLoaded(fonts).catch(() => {});
    }
  }).catch(() => {});

  // 1. Extract Canonical Slide Dimensions & Aspect Ratio from presentation.xml
  let sldWidthEmu = 12192000;  // Standard 16:9 1920x1080 in EMUs (13.333 inches)
  let sldHeightEmu = 6858000;  // Standard 16:9 in EMUs (7.5 inches)

  if (loadedZip.files['ppt/presentation.xml']) {
    try {
      const presXml = await loadedZip.files['ppt/presentation.xml'].async('text');
      const presDoc = parser.parseFromString(presXml, 'text/xml');
      const sldSz = presDoc.getElementsByTagName('p:sldSz')[0];
      if (sldSz) {
        const cx = parseInt(sldSz.getAttribute('cx') || '0', 10);
        const cy = parseInt(sldSz.getAttribute('cy') || '0', 10);
        if (cx > 0 && cy > 0) {
          sldWidthEmu = cx;
          sldHeightEmu = cy;
        }
      }
    } catch (e) {
      console.warn('[pptxParser] Could not parse presentation.xml dimensions:', e);
    }
  }

  const coordSystem = new PresentationCoordinateSystem(sldWidthEmu, sldHeightEmu, 1920, 1080);

  // 2. Extract Embedded Media (Images, Vectors & Media)
  const mediaMap = new Map<string, string>();
  const mediaFiles = Object.keys(loadedZip.files).filter(name => name.startsWith('ppt/media/'));

  await Promise.all(mediaFiles.map(async (mediaPath) => {
    try {
      const fileObj = loadedZip.files[mediaPath];
      const blob = await fileObj.async('blob');
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const relativePath = mediaPath.replace('ppt/', '');
      const baseName = mediaPath.split('/').pop() || '';

      mediaMap.set(mediaPath, dataUrl);
      mediaMap.set(relativePath, dataUrl);
      mediaMap.set(`../${relativePath}`, dataUrl);
      mediaMap.set(baseName, dataUrl);
    } catch (e) {
      console.warn('[pptxParser] Media extraction warning for:', mediaPath, e);
    }
  }));

  // 3. Extract Theme Colors & Typography from ppt/theme/theme1.xml
  const themeColors: Record<string, string> = {
    dk1: '#000000',
    lt1: '#FFFFFF',
    dk2: '#1F2421',
    lt2: '#F4F4F9',
    accent1: '#0078D4',
    accent2: '#2B579A',
    accent3: '#008272',
    accent4: '#D83B01',
    accent5: '#E81123',
    accent6: '#B4009E',
    hlink: '#0078D4',
    folHlink: '#6B2D5C',
  };
  let themeMajorFont = 'Aptos, Calibri, "Segoe UI", sans-serif';
  let themeMinorFont = 'Aptos, Calibri, "Segoe UI", sans-serif';

  if (loadedZip.files['ppt/theme/theme1.xml']) {
    try {
      const themeXml = await loadedZip.files['ppt/theme/theme1.xml'].async('text');
      const themeDoc = parser.parseFromString(themeXml, 'text/xml');
      
      const clrScheme = themeDoc.getElementsByTagName('a:clrScheme')[0];
      if (clrScheme) {
        for (let i = 0; i < clrScheme.children.length; i++) {
          const child = clrScheme.children[i];
          const nodeName = child.localName || child.nodeName.replace('a:', '');
          const srgb = child.getElementsByTagName('a:srgbClr')[0]?.getAttribute('val');
          const sysClr = child.getElementsByTagName('a:sysClr')[0]?.getAttribute('lastClr');
          if (srgb) {
            themeColors[nodeName] = `#${srgb}`;
          } else if (sysClr) {
            themeColors[nodeName] = `#${sysClr}`;
          }
        }
      }

      const majorFontElem = themeDoc.getElementsByTagName('a:majorFont')[0] || themeDoc.getElementsByTagName('majorFont')[0];
      const majorLatin = majorFontElem ? (majorFontElem.getElementsByTagName('a:latin')[0] || majorFontElem.getElementsByTagName('latin')[0]) : null;
      const minorFontElem = themeDoc.getElementsByTagName('a:minorFont')[0] || themeDoc.getElementsByTagName('minorFont')[0];
      const minorLatin = minorFontElem ? (minorFontElem.getElementsByTagName('a:latin')[0] || minorFontElem.getElementsByTagName('latin')[0]) : null;
      if (majorLatin?.getAttribute('typeface')) {
        themeMajorFont = cleanPptxFontName(majorLatin.getAttribute('typeface') || '');
      }
      if (minorLatin?.getAttribute('typeface')) {
        themeMinorFont = cleanPptxFontName(minorLatin.getAttribute('typeface') || '');
      }
    } catch (e) {
      console.warn('[pptxParser] Theme parsing warning:', e);
    }
  }

  // 4. Extract Master Color Maps (<p:clrMap>) and Documents from slideMasters
  const masterColorMaps: Record<string, Record<string, string>> = {};
  const masterDocsMap: Record<string, Document> = {};
  const masterFiles = Object.keys(loadedZip.files).filter(f => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(f));
  for (const mf of masterFiles) {
    try {
      const mXml = await loadedZip.files[mf].async('text');
      const mDoc = parser.parseFromString(mXml, 'text/xml');
      masterDocsMap[mf] = mDoc;
      const clrMapElem = mDoc.getElementsByTagName('p:clrMap')[0] || mDoc.getElementsByTagName('clrMap')[0];
      if (clrMapElem) {
        const mapping: Record<string, string> = {};
        for (let i = 0; i < clrMapElem.attributes.length; i++) {
          const attr = clrMapElem.attributes[i];
          mapping[attr.name] = attr.value;
        }
        masterColorMaps[mf] = mapping;
      }
    } catch (e) {}
  }

  const defaultClrMap: Record<string, string> = Object.values(masterColorMaps)[0] || {
    bg1: 'lt1',
    tx1: 'dk1',
    bg2: 'lt2',
    tx2: 'dk2',
    accent1: 'accent1',
    accent2: 'accent2',
    accent3: 'accent3',
    accent4: 'accent4',
    accent5: 'accent5',
    accent6: 'accent6',
    hlink: 'hlink',
    folHlink: 'folHlink',
  };

  // Helper to resolve color node (srgbClr, schemeClr, sysClr, etc.)
  const resolveColor = (parentElem: Element | null, activeClrMap: Record<string, string> = defaultClrMap): string | undefined => {
    if (!parentElem) return undefined;
    const srgb = parentElem.getElementsByTagName('a:srgbClr')[0]?.getAttribute('val');
    if (srgb) return `#${srgb}`;
    
    const scheme = parentElem.getElementsByTagName('a:schemeClr')[0]?.getAttribute('val');
    if (scheme) {
      const mappedKey = activeClrMap[scheme] || scheme;
      if (themeColors[mappedKey]) return themeColors[mappedKey];
      if (themeColors[scheme]) return themeColors[scheme];
      
      if (mappedKey === 'tx1' || scheme === 'tx1') return themeColors.dk1 || '#000000';
      if (mappedKey === 'tx2' || scheme === 'tx2') return themeColors.dk2 || '#1F2421';
      if (mappedKey === 'bg1' || scheme === 'bg1') return themeColors.lt1 || '#FFFFFF';
      if (mappedKey === 'bg2' || scheme === 'bg2') return themeColors.lt2 || '#EEE5E9';
      if (mappedKey === 'lt1') return themeColors.lt1 || '#FFFFFF';
      if (mappedKey === 'dk1') return themeColors.dk1 || '#000000';
      if (mappedKey === 'lt2') return themeColors.lt2 || '#EEE5E9';
      if (mappedKey === 'dk2') return themeColors.dk2 || '#1F2421';
    }
    
    const sys = parentElem.getElementsByTagName('a:sysClr')[0]?.getAttribute('lastClr');
    if (sys) return `#${sys}`;

    return undefined;
  };

  // Helper to resolve background fill
  const resolveBgFill = async (
    bgElem: Element | null, 
    relsDoc: Document | null,
    activeClrMap: Record<string, string> = defaultClrMap
  ): Promise<{ backgroundUrl?: string, backgroundColor?: string }> => {
    if (!bgElem) return {};
    
    const blips = Array.from(bgElem.getElementsByTagName('a:blip'));
    for (const blip of blips) {
      if (blip && relsDoc) {
        const rId = blip.getAttribute('r:embed') || blip.getAttribute('embed') || '';
        if (rId) {
          const relTarget = findRelationshipTarget(relsDoc, { id: rId });
          if (relTarget) {
            const cleanTarget = relTarget.replace(/^(\.\.\/)+/, '').replace(/^ppt\//, '');
            const baseName = cleanTarget.split('/').pop() || '';

            if (mediaMap.has(relTarget)) return { backgroundUrl: mediaMap.get(relTarget) };
            if (mediaMap.has(cleanTarget)) return { backgroundUrl: mediaMap.get(cleanTarget) };
            if (mediaMap.has(`media/${baseName}`)) return { backgroundUrl: mediaMap.get(`media/${baseName}`) };
            if (mediaMap.has(`../media/${baseName}`)) return { backgroundUrl: mediaMap.get(`../media/${baseName}`) };
            if (mediaMap.has(baseName)) return { backgroundUrl: mediaMap.get(baseName) };
          }
        }
      }
    }

    const solidFill = bgElem.getElementsByTagName('a:solidFill')[0];
    if (solidFill) {
      const color = resolveColor(solidFill, activeClrMap);
      if (color) return { backgroundColor: color };
    }

    const gradFill = bgElem.getElementsByTagName('a:gradFill')[0];
    if (gradFill) {
      const gsList = Array.from(gradFill.getElementsByTagName('a:gs'));
      const stops: string[] = [];
      for (const gs of gsList) {
        const c = resolveColor(gs, activeClrMap);
        const pos = parseInt(gs.getAttribute('pos') || '0', 10) / 1000;
        if (c) stops.push(`${c} ${pos}%`);
      }
      if (stops.length > 1) {
        return { backgroundColor: `linear-gradient(135deg, ${stops.join(', ')})` };
      }
    }

    const bgRef = bgElem.getElementsByTagName('p:bgRef')[0] || (bgElem.nodeName === 'p:bgRef' || bgElem.localName === 'bgRef' ? bgElem : null);
    if (bgRef) {
      const color = resolveColor(bgRef, activeClrMap);
      if (color) return { backgroundColor: color };
    }

    return {};
  };

  // 5. Find and sort slide files
  const slideFiles = Object.keys(loadedZip.files).filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name));

  if (slideFiles.length === 0) {
    throw new Error('No slides found in PPTX archive.');
  }

  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
    const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || '0', 10);
    return numA - numB;
  });

  const slides: ParsedSlide[] = [];

  for (let sIdx = 0; sIdx < slideFiles.length; sIdx++) {
    if (sIdx > 0 && sIdx % 3 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }

    const fileName = slideFiles[sIdx];
    const xmlString = await loadedZip.files[fileName].async('text');
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Parse slide relationships
    const relsFileName = fileName.replace('ppt/slides/', 'ppt/slides/_rels/').concat('.rels');
    let relsDoc: Document | null = null;
    let layoutFileName = '';
    let notesFileName = '';
    
    if (loadedZip.files[relsFileName]) {
      try {
        const relsXml = await loadedZip.files[relsFileName].async('text');
        relsDoc = parser.parseFromString(relsXml, 'text/xml');

        const layoutTarget = findRelationshipTarget(relsDoc, { typeSubstring: 'slideLayout' });
        if (layoutTarget) {
          let target = layoutTarget.replace(/^(\.\.\/)+/, '').replace(/^ppt\//, '');
          layoutFileName = `ppt/${target}`;
        }

        const notesTarget = findRelationshipTarget(relsDoc, { typeSubstring: 'notesSlide' });
        if (notesTarget) {
          let target = notesTarget.replace(/^(\.\.\/)+/, '').replace(/^ppt\//, '');
          notesFileName = `ppt/${target}`;
        }
      } catch (e) {
        console.warn('[pptxParser] Rel parsing warning for:', relsFileName, e);
      }
    }

    let layoutDoc: Document | null = null;
    let layoutRelsDoc: Document | null = null;
    let masterDoc: Document | null = null;
    if (layoutFileName && loadedZip.files[layoutFileName]) {
      try {
        const layoutXml = await loadedZip.files[layoutFileName].async('text');
        layoutDoc = parser.parseFromString(layoutXml, 'text/xml');
        const layoutRelsFile = layoutFileName.replace('ppt/slideLayouts/', 'ppt/slideLayouts/_rels/').concat('.rels');
        if (loadedZip.files[layoutRelsFile]) {
          const layoutRelsXml = await loadedZip.files[layoutRelsFile].async('text');
          layoutRelsDoc = parser.parseFromString(layoutRelsXml, 'text/xml');

          const masterTarget = findRelationshipTarget(layoutRelsDoc, { typeSubstring: 'slideMaster' });
          if (masterTarget) {
            let mTarget = masterTarget.replace(/^(\.\.\/)+/, '').replace(/^ppt\//, '');
            const mKey = `ppt/${mTarget}`;
            if (masterDocsMap[mKey]) {
              masterDoc = masterDocsMap[mKey];
            }
          }
        }
      } catch (e) {}
    }
    if (!masterDoc) {
      masterDoc = Object.values(masterDocsMap)[0] || null;
    }

    // Determine active color mapping for this slide
    let activeClrMap: Record<string, string> = { ...defaultClrMap };
    const slideClrMapOvr = xmlDoc.getElementsByTagName('p:overrideClrMapping')[0] || xmlDoc.getElementsByTagName('overrideClrMapping')[0];
    if (slideClrMapOvr) {
      for (let i = 0; i < slideClrMapOvr.attributes.length; i++) {
        activeClrMap[slideClrMapOvr.attributes[i].name] = slideClrMapOvr.attributes[i].value;
      }
    } else if (layoutDoc) {
      const layoutClrMapOvr = layoutDoc.getElementsByTagName('p:overrideClrMapping')[0] || layoutDoc.getElementsByTagName('overrideClrMapping')[0];
      if (layoutClrMapOvr) {
        for (let i = 0; i < layoutClrMapOvr.attributes.length; i++) {
          activeClrMap[layoutClrMapOvr.attributes[i].name] = layoutClrMapOvr.attributes[i].value;
        }
      }
    }

    // Parse slide notes if present
    let slideNotes = '';
    if (notesFileName && loadedZip.files[notesFileName]) {
      try {
        const notesXml = await loadedZip.files[notesFileName].async('text');
        const notesDoc = parser.parseFromString(notesXml, 'text/xml');
        const noteTexts = Array.from(notesDoc.getElementsByTagName('a:t')).map(t => t.textContent || '');
        slideNotes = noteTexts.join(' ').trim();
      } catch (e) {}
    }

    // Parse slide transitions
    let slideTransition: SlideTransition | undefined;
    const transitionElem = xmlDoc.getElementsByTagName('p:transition')[0];
    if (transitionElem) {
      const durAttr = transitionElem.getAttribute('dur') || transitionElem.getAttribute('spd');
      let durMs = 600;
      if (durAttr) {
        durMs = durAttr === 'slow' ? 1000 : durAttr === 'fast' ? 300 : parseInt(durAttr, 10) || 600;
      }
      const transType = transitionElem.firstElementChild?.localName || 'fade';
      slideTransition = {
        type: transType === 'push' ? 'push-left' : transType === 'wipe' ? 'wipe-left' : transType === 'zoom' ? 'zoom-in' : 'fade',
        durationMs: durMs,
      };
    }

    // Resolve Slide Background (Slide -> Layout -> Master -> Fallback)
    let slideBackgroundUrl: string | undefined;
    let slideBackgroundColor: string | undefined;
    let headerBarColor: string | undefined;

    const slideBg = xmlDoc.getElementsByTagName('p:bg')[0] || xmlDoc.getElementsByTagName('bg')[0];
    if (slideBg) {
      const bgResult = await resolveBgFill(slideBg, relsDoc, activeClrMap);
      slideBackgroundUrl = bgResult.backgroundUrl;
      slideBackgroundColor = bgResult.backgroundColor;
    }

    if (!slideBackgroundUrl && !slideBackgroundColor && layoutDoc) {
      try {
        const layoutBg = layoutDoc.getElementsByTagName('p:bg')[0] || layoutDoc.getElementsByTagName('bg')[0];
        if (layoutBg) {
          const bgResult = await resolveBgFill(layoutBg, layoutRelsDoc, activeClrMap);
          slideBackgroundUrl = bgResult.backgroundUrl;
          slideBackgroundColor = bgResult.backgroundColor;
        }
      } catch (e) {}
    }

    if (!slideBackgroundUrl && !slideBackgroundColor) {
      const bgKey = activeClrMap.bg1 || 'lt1';
      slideBackgroundColor = themeColors[bgKey] || (bgKey === 'dk1' ? '#0F172A' : '#FFFFFF');
    }

    const isDarkBg = Boolean(
      slideBackgroundUrl ||
      (slideBackgroundColor && (
        slideBackgroundColor.startsWith('#0') || 
        slideBackgroundColor.startsWith('#1') || 
        slideBackgroundColor.startsWith('#2') || 
        slideBackgroundColor.toLowerCase().includes('black') ||
        (slideBackgroundColor.startsWith('#') && getLuminance(slideBackgroundColor) < 0.45)
      ))
    );

    let titleText = '';
    let subtitleText = '';
    let titleColor: string | undefined = isDarkBg ? '#FFFFFF' : '#0F172A';
    let titleFontFamily: string | undefined = themeMajorFont;
    let titleFontSize: number | undefined;
    let bodyFontColor: string | undefined = isDarkBg ? '#FFFFFF' : '#1E293B';
    let bodyFontFamily: string | undefined = themeMinorFont;
    let bodyFontSize: number | undefined;
    let slideTextAlign: 'left' | 'center' | 'right' | 'justify' | undefined;

    const bodyParagraphs: string[] = [];
    const bulletItems: string[] = [];
    const slideElements: SlideElement[] = [];
    const slideObjects: SlideObject[] = [];

    // Helper: Parse a single picture element <p:pic>
    const processPicNode = (pic: Element, nodeZIndex: number, groupCtx?: GroupTransformContext) => {
      const blip = pic.getElementsByTagName('a:blip')[0];
      const rId = blip?.getAttribute('r:embed') || blip?.getAttribute('embed') || '';
      let imgUrl: string | undefined;
      if (rId && relsDoc) {
        const relTarget = findRelationshipTarget(relsDoc, { id: rId });
        if (relTarget) {
          const cleanTarget = relTarget.replace(/^(\.\.\/)+/, '').replace(/^ppt\//, '');
          const baseName = cleanTarget.split('/').pop() || '';
          imgUrl = mediaMap.get(relTarget) || mediaMap.get(cleanTarget) || mediaMap.get(`media/${baseName}`) || mediaMap.get(`../media/${baseName}`) || mediaMap.get(baseName);
        }
      }

      const xfrm = pic.getElementsByTagName('a:xfrm')[0];
      if (xfrm && imgUrl) {
        const rawX = parseInt(xfrm.getElementsByTagName('a:off')[0]?.getAttribute('x') || '0', 10);
        const rawY = parseInt(xfrm.getElementsByTagName('a:off')[0]?.getAttribute('y') || '0', 10);
        const rawW = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cx') || '0', 10);
        const rawH = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cy') || '0', 10);
        const rotAttr = xfrm.getAttribute('rot');
        const rotDeg = rotAttr ? Math.round(parseInt(rotAttr, 10) / 60000) : 0;

        const bounds = coordSystem.toLogicalBounds({
          offX: rawX,
          offY: rawY,
          extCx: rawW,
          extCy: rawH,
          rotationDeg: rotDeg,
        }, groupCtx);

        const leftPct = (bounds.x / 1920) * 100;
        const topPct = (bounds.y / 1080) * 100;
        const widthPct = (bounds.width / 1920) * 100;
        const heightPct = (bounds.height / 1080) * 100;

        if (!slideBackgroundUrl && (widthPct >= 80 && heightPct >= 80)) {
          slideBackgroundUrl = imgUrl;
        }

        slideElements.push({
          type: 'image',
          imageUrl: imgUrl,
          leftPercent: leftPct,
          topPercent: topPct,
          widthPercent: widthPct,
          heightPercent: heightPct,
        });

        const picNvPr = pic.getElementsByTagName('p:cNvPr')[0] || pic.getElementsByTagName('cNvPr')[0];
        const rawPicSpid = picNvPr?.getAttribute('id') || '';

        slideObjects.push({
          id: rawPicSpid ? `shape-${rawPicSpid}` : `pic-${sIdx}-${nodeZIndex}`,
          shapeId: rawPicSpid || undefined,
          spid: rawPicSpid || undefined,
          type: 'image',
          imageUrl: imgUrl,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          rotation: bounds.rotation,
          zIndex: nodeZIndex,
        });
      }
    };

    // Helper: Parse a shape or text box element <p:sp>
    const processShapeNode = (shape: Element, nodeZIndex: number, groupCtx?: GroupTransformContext) => {
      const phElem = shape.getElementsByTagName('p:ph')[0] || shape.getElementsByTagName('ph')[0];
      const phType = phElem ? (phElem.getAttribute('type') || '').toLowerCase() : '';
      const phIdx = phElem ? phElem.getAttribute('idx') : null;

      const isTitlePlaceholder = phType === 'title' || phType === 'ctrtitle' || phType === 'header' || phIdx === '0';
      const isBodyPlaceholder = phType === 'body' || phType === 'sub' || phType === 'subtitle' || phType === 'obj' || phIdx === '1';
      const effectivePhType = phType || (phIdx === '0' ? 'title' : (phIdx === '1' || phElem ? 'body' : ''));

      let xfrm = shape.getElementsByTagName('a:xfrm')[0];
      let inheritedBodyPr: Element | null = null;

      if ((phType || phIdx !== null || phElem) && layoutDoc) {
        const layoutShapes = Array.from(layoutDoc.getElementsByTagName('p:sp'));
        for (const lSp of layoutShapes) {
          const lPh = lSp.getElementsByTagName('p:ph')[0] || lSp.getElementsByTagName('ph')[0];
          if (lPh) {
            const rawLPhType = (lPh.getAttribute('type') || '').toLowerCase();
            const lPhIdx = lPh.getAttribute('idx');
            const lPhType = rawLPhType || (lPhIdx === '0' ? 'title' : (lPhIdx === '1' || lPh ? 'body' : ''));
            
            const isMatch = (phIdx !== null && lPhIdx !== null && phIdx === lPhIdx) ||
                            (phIdx !== null && lPhIdx === null && ((phIdx === '0' && (lPhType === 'title' || lPhType === 'ctrtitle')) || (phIdx === '1' && (lPhType === 'body' || lPhType === 'obj')))) ||
                            (effectivePhType && lPhType && (
                              effectivePhType === lPhType ||
                              ((effectivePhType === 'title' || effectivePhType === 'ctrtitle') && (lPhType === 'title' || lPhType === 'ctrtitle')) ||
                              ((effectivePhType === 'body' || effectivePhType === 'sub' || effectivePhType === 'subtitle' || effectivePhType === 'obj') && (lPhType === 'body' || lPhType === 'sub' || lPhType === 'subtitle' || lPhType === 'obj'))
                            ));
            if (isMatch) {
              if (!xfrm) xfrm = lSp.getElementsByTagName('a:xfrm')[0];
              if (!inheritedBodyPr) inheritedBodyPr = lSp.getElementsByTagName('a:bodyPr')[0];
              break;
            }
          }
        }
      }

      if ((!xfrm || !inheritedBodyPr) && (phType || phIdx !== null || phElem) && masterDoc) {
        const masterShapes = Array.from(masterDoc.getElementsByTagName('p:sp'));
        for (const mSp of masterShapes) {
          const mPh = mSp.getElementsByTagName('p:ph')[0] || mSp.getElementsByTagName('ph')[0];
          if (mPh) {
            const rawMPhType = (mPh.getAttribute('type') || '').toLowerCase();
            const mPhIdx = mPh.getAttribute('idx');
            const mPhType = rawMPhType || (mPhIdx === '0' ? 'title' : (mPhIdx === '1' || mPh ? 'body' : ''));
            
            const isMatch = (phIdx !== null && mPhIdx !== null && phIdx === mPhIdx) ||
                            (phIdx !== null && mPhIdx === null && ((phIdx === '0' && (mPhType === 'title' || mPhType === 'ctrtitle')) || (phIdx === '1' && (mPhType === 'body' || mPhType === 'obj')))) ||
                            (effectivePhType && mPhType && (
                              effectivePhType === mPhType ||
                              ((effectivePhType === 'title' || effectivePhType === 'ctrtitle') && (mPhType === 'title' || mPhType === 'ctrtitle')) ||
                              ((effectivePhType === 'body' || effectivePhType === 'sub' || effectivePhType === 'subtitle' || effectivePhType === 'obj') && (mPhType === 'body' || mPhType === 'sub' || mPhType === 'subtitle' || mPhType === 'obj'))
                            ));
            if (isMatch) {
              if (!xfrm) xfrm = mSp.getElementsByTagName('a:xfrm')[0];
              if (!inheritedBodyPr) inheritedBodyPr = mSp.getElementsByTagName('a:bodyPr')[0];
              break;
            }
          }
        }
      }

      let rawX = 0;
      let rawY = 0;
      let rawW = 0;
      let rawH = 0;
      let rotDeg = 0;

      if (xfrm) {
        rawX = parseInt(xfrm.getElementsByTagName('a:off')[0]?.getAttribute('x') || '0', 10);
        rawY = parseInt(xfrm.getElementsByTagName('a:off')[0]?.getAttribute('y') || '0', 10);
        rawW = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cx') || '0', 10);
        rawH = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cy') || '0', 10);
        const rotAttr = xfrm.getAttribute('rot');
        if (rotAttr) rotDeg = Math.round(parseInt(rotAttr, 10) / 60000);
      }

      // Fallback canonical layout bounds for placeholders missing explicit geometry
      if (rawW <= 0 || rawH <= 0) {
        if (isTitlePlaceholder) {
          rawX = Math.round(sldWidthEmu * 0.08);
          rawY = Math.round(sldHeightEmu * 0.08);
          rawW = Math.round(sldWidthEmu * 0.84);
          rawH = Math.round(sldHeightEmu * 0.18);
        } else if (isBodyPlaceholder || phElem) {
          rawX = Math.round(sldWidthEmu * 0.08);
          rawY = Math.round(sldHeightEmu * 0.32);
          rawW = Math.round(sldWidthEmu * 0.84);
          rawH = Math.round(sldHeightEmu * 0.58);
        }
      }

      const bounds = coordSystem.toLogicalBounds({
        offX: rawX,
        offY: rawY,
        extCx: rawW,
        extCy: rawH,
        rotationDeg: rotDeg,
      }, groupCtx);

      // Check Shape Geometry Preset
      const spPr = shape.getElementsByTagName('p:spPr')[0];
      const prstGeom = spPr?.getElementsByTagName('a:prstGeom')[0]?.getAttribute('prst') || 'rect';
      let shapeType: ShapeType = 'rectangle';
      let borderRadius: number | undefined;
      if (prstGeom === 'roundRect' || prstGeom === 'round1Rect' || prstGeom === 'round2SameRect') {
        shapeType = 'rounded-rectangle';
        borderRadius = 12;
      } else if (prstGeom === 'ellipse' || prstGeom === 'circle') {
        shapeType = 'ellipse';
        borderRadius = 999;
      } else if (prstGeom === 'triangle') {
        shapeType = 'triangle';
      } else if (prstGeom === 'line') {
        shapeType = 'line';
      }

      const shapeSolidFill = spPr?.getElementsByTagName('a:solidFill')[0];
      const shapeFillColor = shapeSolidFill ? resolveColor(shapeSolidFill, activeClrMap) : undefined;

      const ln = spPr?.getElementsByTagName('a:ln')[0];
      let borderColor: string | undefined;
      let borderWidth: number | undefined;
      if (ln) {
        const lnSolidFill = ln.getElementsByTagName('a:solidFill')[0];
        if (lnSolidFill) borderColor = resolveColor(lnSolidFill, activeClrMap);
        const wAttr = ln.getAttribute('w');
        if (wAttr) borderWidth = Math.max(1, Math.round(parseInt(wAttr, 10) / 12700));
      }

      const bodyPr = shape.getElementsByTagName('a:bodyPr')[0] || inheritedBodyPr;
      const anchorAttr = bodyPr?.getAttribute('anchor') || 't';
      let alignVertical: 'top' | 'middle' | 'bottom' = anchorAttr === 'ctr' || anchorAttr === 'mid' ? 'middle' : anchorAttr === 'b' ? 'bottom' : 'top';

      // Text box vertical anchoring rule:
      // In PowerPoint, for text boxes and header/title placeholders without solid shape backgrounds,
      // title/header text is top-anchored within its header region, preventing middle-anchoring
      // across an oversized bounding box from dropping down and colliding with body paragraphs.
      if (isTitlePlaceholder || (!shapeSolidFill && bounds.y < 300 && bounds.height > 160)) {
        alignVertical = 'top';
      }

      let normAutofitScale = 1;
      const normAutofit = bodyPr?.getElementsByTagName('a:normAutofit')[0];
      if (normAutofit) {
        const fontScaleStr = normAutofit.getAttribute('fontScale');
        if (fontScaleStr) {
          const sVal = parseInt(fontScaleStr, 10);
          if (!isNaN(sVal) && sVal > 0) normAutofitScale = sVal / 100000;
        }
      }

      let shapePadding = 8;
      let paddingTop: number | undefined;
      let paddingBottom: number | undefined;
      let paddingLeft: number | undefined;
      let paddingRight: number | undefined;

      if (bodyPr) {
        const lIns = bodyPr.getAttribute('lIns');
        const tIns = bodyPr.getAttribute('tIns');
        const rIns = bodyPr.getAttribute('rIns');
        const bIns = bodyPr.getAttribute('bIns');

        if (tIns) paddingTop = Math.round((parseInt(tIns, 10) / sldHeightEmu) * 1080);
        if (bIns) paddingBottom = Math.round((parseInt(bIns, 10) / sldHeightEmu) * 1080);
        if (lIns) paddingLeft = Math.round((parseInt(lIns, 10) / sldWidthEmu) * 1920);
        if (rIns) paddingRight = Math.round((parseInt(rIns, 10) / sldWidthEmu) * 1920);

        if (lIns || tIns) {
          const lVal = lIns ? Math.round(parseInt(lIns, 10) / 9525) : 8;
          const tVal = tIns ? Math.round(parseInt(tIns, 10) / 9525) : 4;
          shapePadding = Math.max(2, Math.max(lVal, tVal));
        }
      }

      // Extract paragraphs & runs
      const paragraphs = Array.from(shape.getElementsByTagName('a:p'));
      const shapeParagraphTexts: string[] = [];
      const structuredParagraphs: ParagraphRun[] = [];
      let shapeFontColor: string | undefined;
      let shapeFontFamily: string | undefined;
      let shapeFontSize: number | undefined;
      let shapeFontWeight: 'normal' | 'bold' | '500' | '600' | '700' | '800' = 'normal';
      let shapeLetterSpacing: number | undefined;
      let shapeTextAlign: 'left' | 'center' | 'right' | 'justify' = 'left';

      for (const p of paragraphs) {
        const pPr = p.getElementsByTagName('a:pPr')[0];
        const algn = pPr?.getAttribute('algn');
        const currentAlign = algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : algn === 'just' ? 'justify' : 'left';
        shapeTextAlign = currentAlign;

        const defRPr = pPr?.getElementsByTagName('a:defRPr')[0] || p?.getElementsByTagName('a:endParaRPr')[0];
        if (defRPr) {
          const color = resolveColor(defRPr, activeClrMap);
          const sz = defRPr.getAttribute('sz');
          const typeface = defRPr.getElementsByTagName('a:latin')[0]?.getAttribute('typeface');
          const isB = defRPr.getAttribute('b') === '1' || defRPr.getAttribute('b') === 'true';
          const spcAttr = defRPr.getAttribute('spc');

          if (isB && shapeFontWeight === 'normal') shapeFontWeight = 'bold';
          if (color && !shapeFontColor) shapeFontColor = color;
          if (typeface && !shapeFontFamily) shapeFontFamily = cleanPptxFontName(typeface, themeMajorFont, themeMinorFont) || typeface.trim();
          if (sz && !shapeFontSize) shapeFontSize = Math.round(parseInt(sz, 10) / 100);
          if (spcAttr && shapeLetterSpacing === undefined) {
            const spcVal = parseInt(spcAttr, 10);
            if (!isNaN(spcVal) && spcVal !== 0) {
              shapeLetterSpacing = Math.round((spcVal / 100) * 1.333 * 10) / 10;
            }
          }
        }

        const runs = Array.from(p.getElementsByTagName('a:r'));
        let paragraphText = '';
        const paragraphRuns: TextRun[] = [];

        for (const run of runs) {
          const tElem = run.getElementsByTagName('a:t')[0];
          const text = tElem?.textContent || '';
          if (!text) continue;
          paragraphText += text;

          const rPr = run.getElementsByTagName('a:rPr')[0];
          let runColor: string | undefined;
          let runFontFamily: string | undefined;
          let runFontSize: number | undefined;
          let runBold: boolean | undefined;
          let runItalic: boolean | undefined;
          let runUnderline: boolean | undefined;

          if (rPr) {
            const color = resolveColor(rPr, activeClrMap);
            const sz = rPr.getAttribute('sz');
            const typeface = rPr.getElementsByTagName('a:latin')[0]?.getAttribute('typeface');
            const isB = rPr.getAttribute('b') === '1' || rPr.getAttribute('b') === 'true';
            const isI = rPr.getAttribute('i') === '1' || rPr.getAttribute('i') === 'true';
            const isU = rPr.getAttribute('u') === 'sng' || rPr.getAttribute('u') === 'true';
            const spcAttr = rPr.getAttribute('spc');

            if (isB) { shapeFontWeight = 'bold'; runBold = true; }
            if (isI) runItalic = true;
            if (isU) runUnderline = true;
            if (color) {
              runColor = color;
              if (!shapeFontColor) shapeFontColor = color;
            }
            if (typeface) {
              runFontFamily = cleanPptxFontName(typeface, themeMajorFont, themeMinorFont) || typeface.trim();
              if (!shapeFontFamily) shapeFontFamily = runFontFamily;
            }
            if (sz) {
              runFontSize = Math.round(parseInt(sz, 10) / 100);
              if (!shapeFontSize) shapeFontSize = runFontSize;
            }
            if (spcAttr && shapeLetterSpacing === undefined) {
              const spcVal = parseInt(spcAttr, 10);
              if (!isNaN(spcVal) && spcVal !== 0) {
                shapeLetterSpacing = Math.round((spcVal / 100) * 1.333 * 10) / 10;
              }
            }

            if (phType === 'title' || phType === 'ctrtitle') {
              if (color) titleColor = color;
              if (typeface) titleFontFamily = cleanPptxFontName(typeface, themeMajorFont, themeMinorFont) || typeface.trim();
              if (sz) titleFontSize = Math.round(parseInt(sz, 10) / 100);
            } else {
              if (color && !bodyFontColor) bodyFontColor = color;
              if (typeface) bodyFontFamily = cleanPptxFontName(typeface, themeMajorFont, themeMinorFont) || typeface.trim();
              if (sz) bodyFontSize = Math.round(parseInt(sz, 10) / 100);
            }
          }

          paragraphRuns.push({
            text,
            color: runColor,
            fontFamily: runFontFamily,
            fontSize: runFontSize,
            bold: runBold,
            italic: runItalic,
            underline: runUnderline,
          });
        }

        if (!paragraphText) {
          const textNodes = Array.from(p.getElementsByTagName('a:t'));
          paragraphText = textNodes.map(node => node.textContent || '').join('');
          if (paragraphText) {
            paragraphRuns.push({ text: paragraphText });
          }
        }

        const trimmed = paragraphText.trim();
        if (trimmed.length > 0) {
          shapeParagraphTexts.push(trimmed);
          structuredParagraphs.push({
            runs: paragraphRuns,
            textAlign: currentAlign,
          });

          if (!slideTextAlign && currentAlign) {
            slideTextAlign = currentAlign;
          }

          const hasBullet = pPr && (
            pPr.getElementsByTagName('a:buChar').length > 0 ||
            pPr.getElementsByTagName('a:buAutoNum').length > 0 ||
            pPr.getElementsByTagName('a:buFont').length > 0
          );

          if (hasBullet) {
            bulletItems.push(trimmed);
          } else {
            bodyParagraphs.push(trimmed);
          }
        }
      }

      const fullText = shapeParagraphTexts.join('\n');

      if (bounds.width > 0 && bounds.height > 0) {
        if (shapeFillColor || fullText.length > 0 || borderColor) {
          const isShapeWithFill = Boolean(shapeFillColor);
          
          const effectiveFontColor = ensureHighContrast(
            shapeFontColor || (phType === 'title' || phType === 'ctrtitle' ? titleColor : bodyFontColor),
            shapeFillColor ? Boolean(getLuminance(shapeFillColor) < 0.5) : isDarkBg,
            shapeFillColor || slideBackgroundColor
          );

          const targetFontFamily = shapeFontFamily || (phType === 'title' || phType === 'ctrtitle' ? themeMajorFont : themeMinorFont);
          const rawBaseFontSize = shapeFontSize ? Math.round(shapeFontSize * 1.33 * normAutofitScale) : undefined;
          let calculatedFontSize = rawBaseFontSize;

          if (rawBaseFontSize && fullText && bounds.width > 0 && bounds.height > 0) {
            const fitFactor = calculateAutoFitTextScale({
              text: fullText,
              boxWidth: bounds.width,
              boxHeight: bounds.height,
              fontSize: rawBaseFontSize,
              fontFamily: targetFontFamily,
              fontWeight: shapeFontWeight,
              lineHeightRatio: 1.2,
              padding: shapePadding,
            });
            if (fitFactor < 1) {
              calculatedFontSize = Math.max(14, Math.round(rawBaseFontSize * fitFactor));
            }
          }

          const cNvPr = shape.getElementsByTagName('p:cNvPr')[0] || shape.getElementsByTagName('cNvPr')[0];
          const rawSpid = cNvPr?.getAttribute('id') || '';
          const shapeName = cNvPr?.getAttribute('name') || '';

          slideObjects.push({
            id: rawSpid ? `shape-${rawSpid}` : `sp-${sIdx}-${nodeZIndex}`,
            shapeId: rawSpid || undefined,
            spid: rawSpid || undefined,
            placeholderLabel: shapeName || undefined,
            type: isShapeWithFill ? 'shape' : 'text',
            shapeType: isShapeWithFill ? shapeType : undefined,
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            rotation: bounds.rotation,
            zIndex: nodeZIndex,
            text: fullText || undefined,
            paragraphs: structuredParagraphs.length > 0 ? structuredParagraphs : undefined,
            style: {
              backgroundColor: shapeFillColor || 'transparent',
              borderColor: borderColor || undefined,
              borderWidth: borderWidth || (borderColor ? 1 : 0),
              borderRadius: borderRadius,
              fontColor: effectiveFontColor,
              fontFamily: targetFontFamily,
              fontSize: calculatedFontSize,
              rawFontSize: rawBaseFontSize,
              fontWeight: shapeFontWeight,
              letterSpacing: shapeLetterSpacing,
              textAlign: shapeTextAlign,
              alignVertical: alignVertical,
              padding: shapePadding,
              paddingTop: paddingTop,
              paddingBottom: paddingBottom,
              paddingLeft: paddingLeft,
              paddingRight: paddingRight,
            }
          });
        }
      }

      if (phType === 'title' || phType === 'ctrtitle' || (!titleText && nodeZIndex <= 2 && fullText.length > 0 && fullText.length < 160)) {
        if (!titleText) {
          titleText = fullText;
        }
      } else if (phType === 'sub' || phType === 'subtitle') {
        if (!subtitleText) {
          subtitleText = fullText;
        }
      }
    };

    // Helper: Parse a table / graphicFrame <p:graphicFrame>
    const processGraphicFrameNode = (gf: Element, nodeZIndex: number, groupCtx?: GroupTransformContext) => {
      const tbl = gf.getElementsByTagName('a:tbl')[0];
      const xfrm = gf.getElementsByTagName('p:xfrm')[0] || gf.getElementsByTagName('a:xfrm')[0];
      if (!xfrm) return;

      const rawX = parseInt(xfrm.getElementsByTagName('a:off')[0]?.getAttribute('x') || '0', 10);
      const rawY = parseInt(xfrm.getElementsByTagName('a:off')[0]?.getAttribute('y') || '0', 10);
      const rawW = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cx') || '0', 10);
      const rawH = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cy') || '0', 10);

      const bounds = coordSystem.toLogicalBounds({
        offX: rawX,
        offY: rawY,
        extCx: rawW,
        extCy: rawH,
      }, groupCtx);

      if (tbl) {
        const gridCols = Array.from(tbl.getElementsByTagName('a:gridCol')).map(col => {
          const w = parseInt(col.getAttribute('w') || '0', 10);
          return Math.round((w / sldWidthEmu) * 1920);
        });

        const rows = Array.from(tbl.getElementsByTagName('a:tr')).map(tr => {
          const hAttr = tr.getAttribute('h');
          const hVal = hAttr ? Math.round((parseInt(hAttr, 10) / sldHeightEmu) * 1080) : undefined;
          const cells = Array.from(tr.getElementsByTagName('a:tc')).map(tc => {
            const tcPr = tc.getElementsByTagName('a:tcPr')[0];
            const fillSolid = tcPr?.getElementsByTagName('a:solidFill')[0];
            const cellBg = fillSolid ? resolveColor(fillSolid, activeClrMap) : undefined;
            const textNodes = Array.from(tc.getElementsByTagName('a:t'));
            const cellText = textNodes.map(t => t.textContent || '').join(' ').trim();
            const gridSpan = parseInt(tc.getAttribute('gridSpan') || '1', 10);
            const rowSpan = parseInt(tc.getAttribute('rowSpan') || '1', 10);

            return {
              text: cellText,
              backgroundColor: cellBg,
              colSpan: gridSpan > 1 ? gridSpan : undefined,
              rowSpan: rowSpan > 1 ? rowSpan : undefined,
            };
          });

          return {
            height: hVal,
            cells
          };
        });

        const cNvPr = gf.getElementsByTagName('p:cNvPr')[0] || gf.getElementsByTagName('cNvPr')[0];
        const rawGfSpid = cNvPr?.getAttribute('id') || '';

        slideObjects.push({
          id: rawGfSpid ? `shape-${rawGfSpid}` : `tbl-${sIdx}-${nodeZIndex}`,
          shapeId: rawGfSpid || undefined,
          spid: rawGfSpid || undefined,
          type: 'table',
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          zIndex: nodeZIndex,
          tableData: {
            columns: gridCols,
            rows
          }
        });
      }
    };

    // Helper: Recursively traverse group shape <p:grpSp>
    const processGroupNode = (grp: Element, startZIndex: number, parentGroupCtx?: GroupTransformContext): number => {
      const grpXfrm = grp.getElementsByTagName('p:grpSpPr')[0]?.getElementsByTagName('a:xfrm')[0];
      let currentCtx = parentGroupCtx;
      if (grpXfrm) {
        const off = grpXfrm.getElementsByTagName('a:off')[0];
        const ext = grpXfrm.getElementsByTagName('a:ext')[0];
        const chOff = grpXfrm.getElementsByTagName('a:chOff')[0];
        const chExt = grpXfrm.getElementsByTagName('a:chExt')[0];

        const gx = parseInt(off?.getAttribute('x') || '0', 10);
        const gy = parseInt(off?.getAttribute('y') || '0', 10);
        const gw = parseInt(ext?.getAttribute('cx') || '0', 10);
        const gh = parseInt(ext?.getAttribute('cy') || '0', 10);
        const chx = parseInt(chOff?.getAttribute('x') || '0', 10);
        const chy = parseInt(chOff?.getAttribute('y') || '0', 10);
        const chw = parseInt(chExt?.getAttribute('cx') || '0', 10) || gw;
        const chh = parseInt(chExt?.getAttribute('cy') || '0', 10) || gh;

        currentCtx = coordSystem.computeGroupTransform(gx, gy, gw, gh, chx, chy, chw, chh, parentGroupCtx);
      }

      let curZ = startZIndex;
      const childNodes = Array.from(grp.children);
      for (const child of childNodes) {
        const tag = child.localName || child.nodeName.replace('p:', '');
        if (tag === 'sp') {
          processShapeNode(child, ++curZ, currentCtx);
        } else if (tag === 'pic') {
          processPicNode(child, ++curZ, currentCtx);
        } else if (tag === 'graphicFrame') {
          processGraphicFrameNode(child, ++curZ, currentCtx);
        } else if (tag === 'grpSp') {
          curZ = processGroupNode(child, curZ, currentCtx);
        }
      }
      return curZ;
    };

    // 6. Sequential Document-Order Traversal of <p:spTree>
    const spTree = xmlDoc.getElementsByTagName('p:spTree')[0] || xmlDoc.getElementsByTagName('spTree')[0];
    let sequentialZIndex = 0;

    if (spTree) {
      const topLevelNodes = Array.from(spTree.children);
      for (const node of topLevelNodes) {
        const tag = node.localName || node.nodeName.replace('p:', '');
        if (tag === 'sp') {
          processShapeNode(node, ++sequentialZIndex);
        } else if (tag === 'pic') {
          processPicNode(node, ++sequentialZIndex);
        } else if (tag === 'graphicFrame') {
          processGraphicFrameNode(node, ++sequentialZIndex);
        } else if (tag === 'grpSp') {
          sequentialZIndex = processGroupNode(node, sequentialZIndex);
        }
      }
    }

    const processedObjects = deconflictAndDeduplicateSlideObjects(slideObjects);

    // 7. Parse OpenXML Animations & Timing Tree (<p:timing>)
    const { nativeAnimations, animations } = parseOpenXmlTiming(xmlDoc, sIdx, processedObjects);

    const fullBodyText = bodyParagraphs.join('\n\n');
    const isTitleSlide = sIdx === 0 || (bodyParagraphs.length === 0 && Boolean(subtitleText || titleText));

    const numericAspectRatio = (sldWidthEmu && sldHeightEmu && sldHeightEmu > 0) 
      ? sldWidthEmu / sldHeightEmu 
      : 16 / 9;
    const labelAspectRatio = Math.abs(numericAspectRatio - (16 / 9)) < 0.05 ? '16:9' : Math.abs(numericAspectRatio - (4 / 3)) < 0.05 ? '4:3' : `${Math.round(numericAspectRatio * 100) / 100}:1`;

    slides.push({
      id: `pptx-slide-${sIdx}`,
      slideNumber: sIdx + 1,
      title: titleText || (isTitleSlide ? 'Title Slide' : `Slide ${sIdx + 1}`),
      subtitle: subtitleText || undefined,
      text: fullBodyText || titleText || '',
      bullets: bulletItems.length > 0 ? bulletItems : undefined,
      backgroundUrl: slideBackgroundUrl,
      backgroundColor: slideBackgroundColor,
      headerBarColor: headerBarColor,
      titleColor: titleColor,
      titleFontFamily: titleFontFamily,
      titleFontSize: titleFontSize,
      bodyFontColor: bodyFontColor,
      bodyFontFamily: bodyFontFamily,
      bodyFontSize: bodyFontSize,
      textAlign: slideTextAlign || 'left',
      aspectRatio: numericAspectRatio,
      aspectRatioLabel: labelAspectRatio,
      isTitleSlide: isTitleSlide,
      notes: slideNotes || undefined,
      elements: slideElements.length > 0 ? slideElements : undefined,
      objects: processedObjects.length > 0 ? processedObjects : undefined,
      transition: slideTransition,
      nativeAnimations: nativeAnimations.length > 0 ? nativeAnimations : undefined,
      animations: animations.length > 0 ? animations : undefined,
      isPptx: true,
    } as ParsedSlide);
  }

  return slides;
}

/**
 * OpenXML Timing Tree Parser (<p:timing>)
 */
function parseOpenXmlTiming(xmlDoc: Document, sIdx: number, slideObjects: SlideObject[]) {
  const nativeAnimations: any[] = [];
  const animations: any[] = [];
  const timing = xmlDoc.getElementsByTagName('p:timing')[0];
  if (!timing) return { nativeAnimations, animations };

  try {
    const cTnList = Array.from(timing.getElementsByTagName('p:cTn'));
    let animOrder = 0;

    for (const cTn of cTnList) {
      const nodeType = cTn.getAttribute('nodeType');
      if (nodeType === 'clickEffect' || nodeType === 'withEffect' || nodeType === 'afterEffect') {
        const spTarget = cTn.getElementsByTagName('p:spTarget')[0];
        const spid = spTarget?.getAttribute('spid') || '';
        if (spid) {
          const matchingObj = slideObjects.find(o => o.shapeId === spid || o.spid === spid || o.id === `shape-${spid}`);
          const pCount = matchingObj?.text ? matchingObj.text.split('\n').length : 1;
          for (let p = 0; p < pCount; p++) {
            nativeAnimations.push({
              presetClass: 'entr',
              targetId: `shape-${spid}`,
              target: {
                shapeId: spid,
                subShapeId: spid,
                spid: spid,
                id: spid,
                paragraphIndex: p,
                type: 'shape'
              },
              trigger: nodeType === 'clickEffect' ? 'onClick' : nodeType === 'withEffect' ? 'withPrevious' : 'afterPrevious',
              durationMs: 500,
              delayMs: 0,
              action: 'appear',
              order: animOrder++,
              isEntrance: true
            });
            animations.push({
              id: `anim-bld-${spid}-p${p}`,
              elementId: `shape-${spid}`,
              shapeId: spid,
              targetId: `shape-${spid}`,
              type: 'entrance',
              category: 'entrance',
              action: 'appear',
              entrance: true,
              durationMs: 500,
              delayMs: 0,
              order: animOrder,
              trigger: nodeType === 'clickEffect' ? 'onClick' : 'withPrevious',
              paragraphIndex: p
            });
          }
        }
      }
    }
  } catch (e) {}

  return { nativeAnimations, animations };
}

/**
 * Non-destructive de-duplication engine:
 * Preserves authentic PowerPoint & Canva coordinates without artificial repositioning.
 */
export function deconflictAndDeduplicateSlideObjects(objects: SlideObject[]): SlideObject[] {
  if (!objects || objects.length <= 1) return objects || [];

  const cleaned: SlideObject[] = [];
  const removedIds = new Set<string>();

  for (let i = 0; i < objects.length; i++) {
    const a = objects[i];
    if (removedIds.has(a.id)) continue;

    const aText = (a.text || '').trim();
    if (!aText) {
      if (a.type === 'shape' || a.type === 'image' || a.type === 'line' || a.type === 'table' || (a.style?.backgroundColor && a.style.backgroundColor !== 'transparent') || a.style?.borderColor) {
        cleaned.push(a);
      }
      continue;
    }

    let isDuplicate = false;
    for (let j = 0; j < objects.length; j++) {
      if (i === j) continue;
      const b = objects[j];
      if (removedIds.has(b.id)) continue;

      const bText = (b.text || '').trim();
      if (!bText || aText !== bText) continue;

      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);

      // Exact pixel overlap clone from layered export
      if (dx <= 4 && dy <= 4) {
        removedIds.add(b.id);
        continue;
      }
    }

    if (!isDuplicate && !removedIds.has(a.id)) {
      cleaned.push(a);
    }
  }

  return cleaned;
}

class LRUCache<K, V> {
  private max: number;
  private cache: Map<K, V>;

  constructor(max = 5) {
    this.max = max;
    this.cache = new Map();
  }

  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      const val = this.cache.get(key)!;
      this.cache.delete(key);
      this.cache.set(key, val);
      return val;
    }
    return undefined;
  }

  set(key: K, val: V) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.max) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, val);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K) {
    return this.cache.delete(key);
  }
}

const deckParsedSlidesCache = new LRUCache<string, Promise<ParsedSlide[]>>(5);
const resolvedSlidesMap = new LRUCache<string, ParsedSlide[]>(5);

export async function getOrParsePptxSlides(
  contentId: string, 
  bytes: Uint8Array | ArrayBuffer | Blob | File
): Promise<ParsedSlide[]> {
  if (!contentId && !bytes) return [];
  const cacheKey = contentId || (bytes instanceof Blob ? `blob_${bytes.size}` : `bytes_${(bytes as any).byteLength || 0}`);
  
  if (resolvedSlidesMap.has(cacheKey)) {
    return resolvedSlidesMap.get(cacheKey)!;
  }

  if (deckParsedSlidesCache.has(cacheKey)) {
    return deckParsedSlidesCache.get(cacheKey)!;
  }

  const parsePromise = (async () => {
    try {
      const parsed = await parsePptx(bytes);
      resolvedSlidesMap.set(cacheKey, parsed);
      return parsed;
    } catch (err) {
      console.error('[pptxParser] Error parsing PPTX deck:', err);
      deckParsedSlidesCache.delete(cacheKey);
      return [];
    }
  })();

  deckParsedSlidesCache.set(cacheKey, parsePromise);
  return parsePromise;
}

export function cacheParsedPptxSlides(contentId: string, slides: ParsedSlide[]): void {
  if (!contentId || !Array.isArray(slides)) return;
  resolvedSlidesMap.set(contentId, slides);
  deckParsedSlidesCache.set(contentId, Promise.resolve(slides));
}

export function getCachedPptxSlides(contentId: string): ParsedSlide[] | undefined {
  return resolvedSlidesMap.get(contentId);
}

export const parsePptxOffline = parsePptx;
