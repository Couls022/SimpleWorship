import JSZip from 'jszip';
import { Slide, SlideElement, SlideObject, ShapeType, SlideTransition } from '../types';

export interface ParsedSlide extends Slide {
  notes?: string;
  elements?: SlideElement[];
  objects?: SlideObject[];
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
    // If background is dark, text MUST be light/bright
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
    // If background is light, text MUST be dark
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
 * High-performance PPTX Parser
 * Decodes slides, full-resolution background images, OpenXML color maps, layout placeholders,
 * shapes, typography, and aspect ratios into canonical 1920x1080 slide objects.
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
  const parser = new DOMParser();

  // 1. Extract Slide Dimensions & Aspect Ratio from presentation.xml
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

  // 2. Extract Embedded Media (Images & Vector Graphics)
  const mediaMap = new Map<string, string>();
  const mediaFiles = Object.keys(loadedZip.files).filter(name => name.startsWith('ppt/media/'));

  for (const mediaPath of mediaFiles) {
    try {
      const fileObj = loadedZip.files[mediaPath];
      const blob = await fileObj.async('blob');
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
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
  }

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

      const majorLatin = themeDoc.querySelector('a\\:majorFont a\\:latin, majorFont latin');
      const minorLatin = themeDoc.querySelector('a\\:minorFont a\\:latin, minorFont latin');
      if (majorLatin?.getAttribute('typeface')) {
        themeMajorFont = `${majorLatin.getAttribute('typeface')}, sans-serif`;
      }
      if (minorLatin?.getAttribute('typeface')) {
        themeMinorFont = `${minorLatin.getAttribute('typeface')}, sans-serif`;
      }
    } catch (e) {
      console.warn('[pptxParser] Theme parsing warning:', e);
    }
  }

  // 4. Extract Master Color Maps (<p:clrMap>) from slideMasters
  const masterColorMaps: Record<string, Record<string, string>> = {};
  const masterFiles = Object.keys(loadedZip.files).filter(f => /^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(f));
  for (const mf of masterFiles) {
    try {
      const mXml = await loadedZip.files[mf].async('text');
      const mDoc = parser.parseFromString(mXml, 'text/xml');
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

  // Helper to resolve color node (srgbClr, schemeClr, sysClr, etc.) using active color mapping
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

  // Helper to resolve background fill from a container
  const resolveBgFill = async (
    bgElem: Element | null, 
    relsDoc: Document | null,
    activeClrMap: Record<string, string> = defaultClrMap
  ): Promise<{ backgroundUrl?: string, backgroundColor?: string }> => {
    if (!bgElem) return {};
    
    // 1. Direct blip fill (<a:blipFill>)
    const blips = Array.from(bgElem.getElementsByTagName('a:blip'));
    for (const blip of blips) {
      if (blip && relsDoc) {
        const rId = blip.getAttribute('r:embed') || blip.getAttribute('embed') || '';
        if (rId) {
          const relTarget = relsDoc.querySelector(`Relationship[Id="${rId}"]`)?.getAttribute('Target');
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

    // 2. Solid fill (<a:solidFill>)
    const solidFill = bgElem.getElementsByTagName('a:solidFill')[0];
    if (solidFill) {
      const color = resolveColor(solidFill, activeClrMap);
      if (color) return { backgroundColor: color };
    }

    // 3. Gradient fill (<a:gradFill>)
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

    // 4. Background reference (<p:bgRef>)
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

        const layoutRel = relsDoc.querySelector('Relationship[Type*="slideLayout"]');
        if (layoutRel) {
          let target = layoutRel.getAttribute('Target') || '';
          target = target.replace(/^(\.\.\/)+/, '').replace(/^ppt\//, '');
          layoutFileName = `ppt/${target}`;
        }

        const notesRel = relsDoc.querySelector('Relationship[Type*="notesSlide"]');
        if (notesRel) {
          let target = notesRel.getAttribute('Target') || '';
          target = target.replace(/^(\.\.\/)+/, '').replace(/^ppt\//, '');
          notesFileName = `ppt/${target}`;
        }
      } catch (e) {
        console.warn('[pptxParser] Rel parsing warning for:', relsFileName, e);
      }
    }

    // Load layout document & layout relationships
    let layoutDoc: Document | null = null;
    let layoutRelsDoc: Document | null = null;
    if (layoutFileName && loadedZip.files[layoutFileName]) {
      try {
        const layoutXml = await loadedZip.files[layoutFileName].async('text');
        layoutDoc = parser.parseFromString(layoutXml, 'text/xml');
        const layoutRelsFile = layoutFileName.replace('ppt/slideLayouts/', 'ppt/slideLayouts/_rels/').concat('.rels');
        if (loadedZip.files[layoutRelsFile]) {
          const layoutRelsXml = await loadedZip.files[layoutRelsFile].async('text');
          layoutRelsDoc = parser.parseFromString(layoutRelsXml, 'text/xml');
        }
      } catch (e) {}
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

    // 1. Direct slide background (<p:bg>)
    const slideBg = xmlDoc.getElementsByTagName('p:bg')[0] || xmlDoc.getElementsByTagName('bg')[0];
    if (slideBg) {
      const bgResult = await resolveBgFill(slideBg, relsDoc, activeClrMap);
      slideBackgroundUrl = bgResult.backgroundUrl;
      slideBackgroundColor = bgResult.backgroundColor;
    }

    // 2. Direct slide layout background
    if (!slideBackgroundUrl && !slideBackgroundColor && layoutDoc) {
      try {
        const layoutBg = layoutDoc.getElementsByTagName('p:bg')[0] || layoutDoc.getElementsByTagName('bg')[0];
        if (layoutBg) {
          const bgResult = await resolveBgFill(layoutBg, layoutRelsDoc, activeClrMap);
          slideBackgroundUrl = bgResult.backgroundUrl;
          slideBackgroundColor = bgResult.backgroundColor;
        }

        // Layout pictures that serve as background
        if (!slideBackgroundUrl) {
          const layoutPics = Array.from(layoutDoc.getElementsByTagName('p:pic'));
          for (const lPic of layoutPics) {
            const blip = lPic.getElementsByTagName('a:blip')[0];
            const rId = blip?.getAttribute('r:embed') || blip?.getAttribute('embed') || '';
            if (rId && layoutRelsDoc) {
              const relTarget = layoutRelsDoc.querySelector(`Relationship[Id="${rId}"]`)?.getAttribute('Target');
              if (relTarget) {
                const cleanTarget = relTarget.replace(/^(\.\.\/)+/, '').replace(/^ppt\//, '');
                const baseName = cleanTarget.split('/').pop() || '';
                const img = mediaMap.get(relTarget) || mediaMap.get(cleanTarget) || mediaMap.get(`media/${baseName}`) || mediaMap.get(`../media/${baseName}`) || mediaMap.get(baseName);
                if (img) {
                  slideBackgroundUrl = img;
                  break;
                }
              }
            }
          }
        }

        // Layout full-bleed shape background
        if (!slideBackgroundUrl && !slideBackgroundColor) {
          const layoutShapes = Array.from(layoutDoc.getElementsByTagName('p:sp'));
          for (const lSp of layoutShapes) {
            const xfrm = lSp.getElementsByTagName('a:xfrm')[0];
            const extCx = parseInt(xfrm?.getElementsByTagName('a:ext')[0]?.getAttribute('cx') || '0', 10);
            const extCy = parseInt(xfrm?.getElementsByTagName('a:ext')[0]?.getAttribute('cy') || '0', 10);
            if (extCx >= sldWidthEmu * 0.8 && extCy >= sldHeightEmu * 0.8) {
              const bgRes = await resolveBgFill(lSp.getElementsByTagName('p:spPr')[0], layoutRelsDoc, activeClrMap);
              if (bgRes.backgroundUrl) { slideBackgroundUrl = bgRes.backgroundUrl; break; }
              if (bgRes.backgroundColor) { slideBackgroundColor = bgRes.backgroundColor; break; }
            }
          }
        }

        // Layout header accent bars
        const layoutShapes = Array.from(layoutDoc.getElementsByTagName('p:sp'));
        for (const lSp of layoutShapes) {
          const solid = lSp.getElementsByTagName('a:solidFill')[0];
          const xfrm = lSp.getElementsByTagName('a:xfrm')[0];
          if (solid && xfrm) {
            const offY = parseInt(xfrm.getElementsByTagName('a:off')[0]?.getAttribute('y') || '999999', 10);
            const extCx = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cx') || '0', 10);
            const extCy = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cy') || '0', 10);
            if (offY < sldHeightEmu * 0.15 && extCx > sldWidthEmu * 0.7 && extCy < sldHeightEmu * 0.15) {
              headerBarColor = resolveColor(solid, activeClrMap);
            }
          }
        }
      } catch (e) {
        console.warn('[pptxParser] Layout background check failed:', e);
      }
    }

    // 3. Slide Master background
    if (!slideBackgroundUrl && !slideBackgroundColor) {
      for (const masterFile of masterFiles) {
        try {
          const masterXml = await loadedZip.files[masterFile].async('text');
          const masterDoc = parser.parseFromString(masterXml, 'text/xml');
          const masterRelsFile = masterFile.replace('ppt/slideMasters/', 'ppt/slideMasters/_rels/').concat('.rels');
          let masterRelsDoc: Document | null = null;
          if (loadedZip.files[masterRelsFile]) {
            const masterRelsXml = await loadedZip.files[masterRelsFile].async('text');
            masterRelsDoc = parser.parseFromString(masterRelsXml, 'text/xml');
          }

          const masterBg = masterDoc.getElementsByTagName('p:bg')[0] || masterDoc.getElementsByTagName('bg')[0];
          if (masterBg) {
            const bgResult = await resolveBgFill(masterBg, masterRelsDoc, activeClrMap);
            slideBackgroundUrl = bgResult.backgroundUrl;
            slideBackgroundColor = bgResult.backgroundColor;
          }

          if (!slideBackgroundUrl) {
            const masterPics = Array.from(masterDoc.getElementsByTagName('p:pic'));
            for (const mPic of masterPics) {
              const blip = mPic.getElementsByTagName('a:blip')[0];
              const rId = blip?.getAttribute('r:embed') || blip?.getAttribute('embed') || '';
              if (rId && masterRelsDoc) {
                const relTarget = masterRelsDoc.querySelector(`Relationship[Id="${rId}"]`)?.getAttribute('Target');
                if (relTarget) {
                  const cleanTarget = relTarget.replace(/^(\.\.\/)+/, '').replace(/^ppt\//, '');
                  const baseName = cleanTarget.split('/').pop() || '';
                  const img = mediaMap.get(relTarget) || mediaMap.get(cleanTarget) || mediaMap.get(`media/${baseName}`) || mediaMap.get(`../media/${baseName}`) || mediaMap.get(baseName);
                  if (img) {
                    slideBackgroundUrl = img;
                    break;
                  }
                }
              }
            }
          }

          if (!slideBackgroundUrl && !slideBackgroundColor) {
            const masterShapes = Array.from(masterDoc.getElementsByTagName('p:sp'));
            for (const mSp of masterShapes) {
              const xfrm = mSp.getElementsByTagName('a:xfrm')[0];
              const extCx = parseInt(xfrm?.getElementsByTagName('a:ext')[0]?.getAttribute('cx') || '0', 10);
              const extCy = parseInt(xfrm?.getElementsByTagName('a:ext')[0]?.getAttribute('cy') || '0', 10);
              if (extCx >= sldWidthEmu * 0.8 && extCy >= sldHeightEmu * 0.8) {
                const bgRes = await resolveBgFill(mSp.getElementsByTagName('p:spPr')[0], masterRelsDoc, activeClrMap);
                if (bgRes.backgroundUrl) { slideBackgroundUrl = bgRes.backgroundUrl; break; }
                if (bgRes.backgroundColor) { slideBackgroundColor = bgRes.backgroundColor; break; }
              }
            }
          }

          if (slideBackgroundUrl || slideBackgroundColor) break;
        } catch (e) {
          console.warn('[pptxParser] Master background check failed:', e);
        }
      }
    }

    // Default template background
    if (!slideBackgroundUrl && !slideBackgroundColor) {
      const bgKey = activeClrMap.bg1 || 'lt1';
      slideBackgroundColor = themeColors[bgKey] || (bgKey === 'dk1' ? '#0F172A' : '#FFFFFF');
    }

    // Determine dark vs light background for crystal clear contrast
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

    // 6. Parse Text, Shapes, Buttons, and Layout Elements
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

    // Parse Pictures <p:pic>
    const pictures = Array.from(xmlDoc.getElementsByTagName('p:pic'));
    for (let pIdx = 0; pIdx < pictures.length; pIdx++) {
      const pic = pictures[pIdx];
      const blip = pic.getElementsByTagName('a:blip')[0];
      const rId = blip?.getAttribute('r:embed') || blip?.getAttribute('embed') || '';
      let imgUrl: string | undefined;
      if (rId && relsDoc) {
        const relTarget = relsDoc.querySelector(`Relationship[Id="${rId}"]`)?.getAttribute('Target');
        if (relTarget) {
          const cleanTarget = relTarget.replace(/^(\.\.\/)+/, '').replace(/^ppt\//, '');
          const baseName = cleanTarget.split('/').pop() || '';
          imgUrl = mediaMap.get(relTarget) || mediaMap.get(cleanTarget) || mediaMap.get(`media/${baseName}`) || mediaMap.get(`../media/${baseName}`) || mediaMap.get(baseName);
        }
      }

      const xfrm = pic.getElementsByTagName('a:xfrm')[0];
      if (xfrm && imgUrl) {
        const offX = parseInt(xfrm.getElementsByTagName('a:off')[0]?.getAttribute('x') || '0', 10);
        const offY = parseInt(xfrm.getElementsByTagName('a:off')[0]?.getAttribute('y') || '0', 10);
        const extCx = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cx') || '0', 10);
        const extCy = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cy') || '0', 10);

        const leftPct = Math.max(0, (offX / sldWidthEmu) * 100);
        const topPct = Math.max(0, (offY / sldHeightEmu) * 100);
        const widthPct = Math.min(100, (extCx / sldWidthEmu) * 100);
        const heightPct = Math.min(100, (extCy / sldHeightEmu) * 100);

        if (!slideBackgroundUrl && (widthPct >= 75 && heightPct >= 75)) {
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

        slideObjects.push({
          id: `pic-${sIdx}-${pIdx}`,
          type: 'image',
          imageUrl: imgUrl,
          x: Math.round((offX / sldWidthEmu) * 1920),
          y: Math.round((offY / sldHeightEmu) * 1080),
          width: Math.round((extCx / sldWidthEmu) * 1920),
          height: Math.round((extCy / sldHeightEmu) * 1080),
          zIndex: 1,
        });
      }
    }

    // Helper to process a shape element into SlideObject and extracted text
    const processShapeElement = (shape: Element, shapeIdx: number, groupOffsetX = 0, groupOffsetY = 0) => {
      const phElem = shape.getElementsByTagName('p:ph')[0] || shape.getElementsByTagName('ph')[0];
      const phType = phElem ? (phElem.getAttribute('type') || '').toLowerCase() : '';
      const phIdx = phElem ? phElem.getAttribute('idx') : null;

      // Geometric position
      let xfrm = shape.getElementsByTagName('a:xfrm')[0];

      if (!xfrm && (phType || phIdx !== null) && layoutDoc) {
        const layoutShapes = Array.from(layoutDoc.getElementsByTagName('p:sp'));
        for (const lSp of layoutShapes) {
          const lPh = lSp.getElementsByTagName('p:ph')[0] || lSp.getElementsByTagName('ph')[0];
          if (lPh) {
            const lPhType = (lPh.getAttribute('type') || '').toLowerCase();
            const lPhIdx = lPh.getAttribute('idx');
            if ((phIdx !== null && lPhIdx === phIdx) || (phType && lPhType === phType)) {
              const lXfrm = lSp.getElementsByTagName('a:xfrm')[0];
              if (lXfrm) {
                xfrm = lXfrm;
                break;
              }
            }
          }
        }
      }

      let leftPercent: number | undefined;
      let topPercent: number | undefined;
      let widthPercent: number | undefined;
      let heightPercent: number | undefined;

      let offX = 0;
      let offY = 0;
      let extCx = 0;
      let extCy = 0;
      let rotDeg = 0;

      if (xfrm) {
        offX = parseInt(xfrm.getElementsByTagName('a:off')[0]?.getAttribute('x') || '0', 10) + groupOffsetX;
        offY = parseInt(xfrm.getElementsByTagName('a:off')[0]?.getAttribute('y') || '0', 10) + groupOffsetY;
        extCx = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cx') || '0', 10);
        extCy = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cy') || '0', 10);
        const rotAttr = xfrm.getAttribute('rot');
        if (rotAttr) rotDeg = Math.round(parseInt(rotAttr, 10) / 60000);
      }

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

      // Check Shape Fill
      const shapeSolidFill = spPr?.getElementsByTagName('a:solidFill')[0];
      const shapeFillColor = shapeSolidFill ? resolveColor(shapeSolidFill, activeClrMap) : undefined;

      // Check Shape Outline / Border
      const ln = spPr?.getElementsByTagName('a:ln')[0];
      let borderColor: string | undefined;
      let borderWidth: number | undefined;
      if (ln) {
        const lnSolidFill = ln.getElementsByTagName('a:solidFill')[0];
        if (lnSolidFill) borderColor = resolveColor(lnSolidFill, activeClrMap);
        const wAttr = ln.getAttribute('w');
        if (wAttr) borderWidth = Math.max(1, Math.round(parseInt(wAttr, 10) / 12700));
      }

      // Vertical text alignment
      const bodyPr = shape.getElementsByTagName('a:bodyPr')[0];
      const anchorAttr = bodyPr?.getAttribute('anchor') || 't';
      const alignVertical = anchorAttr === 'ctr' || anchorAttr === 'mid' ? 'middle' : anchorAttr === 'b' ? 'bottom' : 'top';

      // Extract paragraphs & runs
      const paragraphs = Array.from(shape.getElementsByTagName('a:p'));
      const shapeParagraphTexts: string[] = [];
      let shapeFontColor: string | undefined;
      let shapeFontFamily: string | undefined;
      let shapeFontSize: number | undefined;
      let shapeFontWeight: 'normal' | 'bold' | '500' | '600' | '700' | '800' = 'normal';
      let shapeTextAlign: 'left' | 'center' | 'right' | 'justify' = 'left';

      for (const p of paragraphs) {
        const pPr = p.getElementsByTagName('a:pPr')[0];
        const algn = pPr?.getAttribute('algn');
        const currentAlign = algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : algn === 'just' ? 'justify' : 'left';
        shapeTextAlign = currentAlign;

        const runs = Array.from(p.getElementsByTagName('a:r'));
        let paragraphText = '';

        for (const run of runs) {
          const tElem = run.getElementsByTagName('a:t')[0];
          const text = tElem?.textContent || '';
          if (!text) continue;
          paragraphText += text;

          const rPr = run.getElementsByTagName('a:rPr')[0];
          if (rPr) {
            const color = resolveColor(rPr, activeClrMap);
            const sz = rPr.getAttribute('sz');
            const typeface = rPr.getElementsByTagName('a:latin')[0]?.getAttribute('typeface');
            const isB = rPr.getAttribute('b') === '1' || rPr.getAttribute('b') === 'true';

            if (isB) shapeFontWeight = 'bold';
            if (color && !shapeFontColor) shapeFontColor = color;
            if (typeface && !shapeFontFamily) shapeFontFamily = `${typeface}, sans-serif`;
            if (sz && !shapeFontSize) shapeFontSize = Math.round(parseInt(sz, 10) / 100);

            if (phType === 'title' || phType === 'ctrtitle') {
              if (color) titleColor = color;
              if (typeface) titleFontFamily = `${typeface}, sans-serif`;
              if (sz) titleFontSize = Math.round(parseInt(sz, 10) / 100);
            } else {
              if (color && !bodyFontColor) bodyFontColor = color;
              if (typeface) bodyFontFamily = `${typeface}, sans-serif`;
              if (sz) bodyFontSize = Math.round(parseInt(sz, 10) / 100);
            }
          }
        }

        if (!paragraphText) {
          const textNodes = Array.from(p.getElementsByTagName('a:t'));
          paragraphText = textNodes.map(node => node.textContent || '').join('');
        }

        const trimmed = paragraphText.trim();
        if (trimmed.length > 0) {
          shapeParagraphTexts.push(trimmed);

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

      // Check if this is a top accent line or header bar
      if (shapeFillColor && topPercent !== undefined && topPercent < 10 && widthPercent && widthPercent > 80 && heightPercent && heightPercent < 6) {
        headerBarColor = shapeFillColor;
      }

      const fullText = shapeParagraphTexts.join('\n');

      // Default OpenXML fallback coordinate frame if extCx/extCy not found on placeholder shape
      if (extCx <= 0 || extCy <= 0) {
        if (phType === 'title' || phType === 'ctrtitle') {
          offX = Math.round(sldWidthEmu * 0.08);
          offY = Math.round(sldHeightEmu * 0.10);
          extCx = Math.round(sldWidthEmu * 0.84);
          extCy = Math.round(sldHeightEmu * 0.28);
          if (!shapeFontSize) shapeFontSize = 40;
          shapeFontWeight = 'bold';
        } else if (phType === 'subtitle' || phType === 'body') {
          offX = Math.round(sldWidthEmu * 0.08);
          offY = Math.round(sldHeightEmu * 0.40);
          extCx = Math.round(sldWidthEmu * 0.84);
          extCy = Math.round(sldHeightEmu * 0.52);
          if (!shapeFontSize) shapeFontSize = 26;
        } else if (fullText.length > 0 || shapeFillColor) {
          offX = Math.round(sldWidthEmu * 0.08);
          offY = Math.round(sldHeightEmu * 0.15);
          extCx = Math.round(sldWidthEmu * 0.84);
          extCy = Math.round(sldHeightEmu * 0.70);
          if (!shapeFontSize) shapeFontSize = 30;
        }
      }

      if (extCx > 0 && extCy > 0) {
        leftPercent = (offX / sldWidthEmu) * 100;
        topPercent = (offY / sldHeightEmu) * 100;
        widthPercent = (extCx / sldWidthEmu) * 100;
        heightPercent = (extCy / sldHeightEmu) * 100;

        const baseW = 1920;
        const baseH = 1080;
        const objX = Math.round((offX / sldWidthEmu) * baseW);
        const objY = Math.round((offY / sldHeightEmu) * baseH);
        const objW = Math.round((extCx / sldWidthEmu) * baseW);
        const objH = Math.round((extCy / sldHeightEmu) * baseH);

        if (shapeFillColor || fullText.length > 0 || borderColor) {
          const isShapeWithFill = Boolean(shapeFillColor);
          
          // Guarantee high-contrast text color against the slide canvas
          const effectiveFontColor = ensureHighContrast(
            shapeFontColor || (phType === 'title' || phType === 'ctrtitle' ? titleColor : bodyFontColor),
            shapeFillColor ? Boolean(getLuminance(shapeFillColor) < 0.5) : isDarkBg,
            shapeFillColor || slideBackgroundColor
          );

          slideObjects.push({
            id: `sp-${sIdx}-${shapeIdx}`,
            type: isShapeWithFill ? 'shape' : 'text',
            shapeType: isShapeWithFill ? shapeType : undefined,
            x: objX,
            y: objY,
            width: objW,
            height: objH,
            rotation: rotDeg,
            zIndex: shapeFillColor ? 1 : 2,
            text: fullText || undefined,
            style: {
              backgroundColor: shapeFillColor || 'transparent',
              borderColor: borderColor || undefined,
              borderWidth: borderWidth || (borderColor ? 1 : 0),
              borderRadius: borderRadius,
              fontColor: effectiveFontColor,
              fontFamily: shapeFontFamily || (phType === 'title' || phType === 'ctrtitle' ? themeMajorFont : themeMinorFont),
              fontSize: shapeFontSize ? Math.round(shapeFontSize * 1.33) : undefined,
              fontWeight: shapeFontWeight,
              textAlign: shapeTextAlign,
              alignVertical: alignVertical,
              padding: shapeFillColor ? 12 : 4,
            }
          });
        }
      }

      // Badge check for layout compatibility
      if (shapeFillColor && shapeParagraphTexts.length > 0 && widthPercent && widthPercent < 35 && heightPercent && heightPercent < 15) {
        slideElements.push({
          type: 'badge',
          text: shapeParagraphTexts.join(' '),
          leftPercent,
          topPercent,
          widthPercent,
          heightPercent,
          backgroundColor: shapeFillColor,
          fontColor: shapeFontColor || '#FFFFFF',
          borderRadius: borderRadius ?? 6,
        });
      }

      // Title & Subtitle assignment
      if (phType === 'title' || phType === 'ctrtitle' || (!titleText && shapeIdx === 0 && fullText.length > 0 && fullText.length < 160)) {
        if (!titleText) {
          titleText = fullText;
        }
      } else if (phType === 'sub' || phType === 'subtitle') {
        if (!subtitleText) {
          subtitleText = fullText;
        }
      }
    };

    // Parse standard shapes <p:sp>
    const shapes = Array.from(xmlDoc.getElementsByTagName('p:sp'));
    for (let shapeIdx = 0; shapeIdx < shapes.length; shapeIdx++) {
      processShapeElement(shapes[shapeIdx], shapeIdx);
    }

    // Parse group shapes <p:grpSp>
    const groupShapes = Array.from(xmlDoc.getElementsByTagName('p:grpSp'));
    for (let gIdx = 0; gIdx < groupShapes.length; gIdx++) {
      const grp = groupShapes[gIdx];
      const grpXfrm = grp.getElementsByTagName('p:grpSpPr')[0]?.getElementsByTagName('a:xfrm')[0];
      let gOffX = 0;
      let gOffY = 0;
      if (grpXfrm) {
        gOffX = parseInt(grpXfrm.getElementsByTagName('a:off')[0]?.getAttribute('x') || '0', 10);
        gOffY = parseInt(grpXfrm.getElementsByTagName('a:off')[0]?.getAttribute('y') || '0', 10);
      }
      const childShapes = Array.from(grp.getElementsByTagName('p:sp'));
      for (let cIdx = 0; cIdx < childShapes.length; cIdx++) {
        processShapeElement(childShapes[cIdx], 1000 + gIdx * 100 + cIdx, gOffX, gOffY);
      }
    }

    const fullBodyText = bodyParagraphs.join('\n\n');

    const isTitleSlide = sIdx === 0 || (bodyParagraphs.length === 0 && Boolean(subtitleText || titleText));

    const deckAspectRatio = (sldWidthEmu && sldHeightEmu && sldHeightEmu > 0) 
      ? (sldWidthEmu / sldHeightEmu) 
      : (16 / 9);

    const deckAspectLabel = Math.abs(deckAspectRatio - 16 / 9) < 0.05 
      ? '16:9' 
      : Math.abs(deckAspectRatio - 4 / 3) < 0.05 
      ? '4:3' 
      : Math.abs(deckAspectRatio - 16 / 10) < 0.05 
      ? '16:10' 
      : `${Math.round(deckAspectRatio * 100) / 100}:1`;

    slides.push({
      id: `slide-${sIdx + 1}`,
      title: titleText.replace(/\s+/g, ' ').trim(),
      text: fullBodyText,
      subtitle: subtitleText,
      bullets: bulletItems.length > 0 ? bulletItems : undefined,
      isTitleSlide,
      backgroundUrl: slideBackgroundUrl,
      backgroundColor: slideBackgroundColor,
      fontColor: ensureHighContrast(bodyFontColor, isDarkBg, slideBackgroundColor),
      fontFamily: bodyFontFamily,
      fontSize: bodyFontSize,
      textAlign: slideTextAlign || (isTitleSlide ? 'left' : 'left'),
      titleColor: ensureHighContrast(titleColor, isDarkBg, slideBackgroundColor),
      titleFontFamily: titleFontFamily,
      titleFontSize: titleFontSize,
      accentColor: themeColors.accent1 || '#0078D4',
      headerBarColor: headerBarColor || themeColors.accent1 || '#0078D4',
      elements: slideElements.length > 0 ? slideElements : undefined,
      objects: slideObjects.length > 0 ? slideObjects : undefined,
      transition: slideTransition,
      aspectRatio: deckAspectRatio,
      aspectRatioLabel: deckAspectLabel,
      widthEmu: sldWidthEmu,
      heightEmu: sldHeightEmu,
      notes: slideNotes
    });
  }

  return slides;
}

const deckParsedSlidesCache = new Map<string, Promise<ParsedSlide[]>>();
const resolvedSlidesMap = new Map<string, ParsedSlide[]>();

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

