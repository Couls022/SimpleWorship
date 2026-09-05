import JSZip from 'jszip';
import { SlideElement, SlideTransition, SlideTransitionType } from '../types';

export interface ParsedSlide {
  title: string;
  text: string;
  subtitle?: string;
  bullets?: string[];
  isTitleSlide?: boolean;
  backgroundUrl?: string;
  backgroundColor?: string;
  fontColor?: string;
  fontFamily?: string;
  fontSize?: number;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  titleColor?: string;
  titleFontFamily?: string;
  titleFontSize?: number;
  accentColor?: string;
  headerBarColor?: string;
  elements?: SlideElement[];
  transition?: SlideTransition;
  aspectRatio?: number;
  aspectRatioLabel?: string;
  widthEmu?: number;
  heightEmu?: number;
}

/**
 * Parses OpenXML slide transition specifications (<p:transition>)
 */
function parseSlideTransition(transElem: Element | null): SlideTransition | undefined {
  if (!transElem) return undefined;

  let durationMs = 500;
  const durAttr = transElem.getAttribute('dur');
  const spdAttr = transElem.getAttribute('spd');

  if (durAttr) {
    const parsedDur = parseInt(durAttr, 10);
    if (!isNaN(parsedDur) && parsedDur >= 0) {
      durationMs = parsedDur;
    }
  } else if (spdAttr) {
    if (spdAttr === 'fast') durationMs = 400;
    else if (spdAttr === 'med' || spdAttr === 'medium') durationMs = 800;
    else if (spdAttr === 'slow') durationMs = 1500;
  }

  let advanceAfterTimeMs: number | undefined;
  const advTmAttr = transElem.getAttribute('advTm');
  if (advTmAttr) {
    const parsedAdv = parseInt(advTmAttr, 10);
    if (!isNaN(parsedAdv) && parsedAdv > 0) {
      advanceAfterTimeMs = parsedAdv;
    }
  }

  let advanceOnClick: boolean = true;
  const advClickAttr = transElem.getAttribute('advClick');
  if (advClickAttr === '0' || advClickAttr === 'false') {
    advanceOnClick = false;
  }

  let transitionType: SlideTransitionType = 'fade';
  let direction: 'left' | 'right' | 'up' | 'down' | 'in' | 'out' | undefined;

  // Inspect child transition element tags
  for (let i = 0; i < transElem.children.length; i++) {
    const child = transElem.children[i];
    const nodeName = (child.localName || child.nodeName.replace(/^[a-z0-9]+:/i, '')).toLowerCase();

    if (nodeName === 'cut') {
      transitionType = 'cut';
      durationMs = 0;
      break;
    } else if (nodeName === 'fade') {
      const thruBlk = child.getAttribute('thruBlk');
      if (thruBlk === '1' || thruBlk === 'true') {
        transitionType = 'fade-through-black';
      } else {
        transitionType = 'fade';
      }
      break;
    } else if (nodeName === 'push') {
      const dir = (child.getAttribute('dir') || 'l').toLowerCase();
      if (dir === 'r') { transitionType = 'push-right'; direction = 'right'; }
      else if (dir === 'u') { transitionType = 'push-up'; direction = 'up'; }
      else if (dir === 'd') { transitionType = 'push-down'; direction = 'down'; }
      else { transitionType = 'push-left'; direction = 'left'; }
      break;
    } else if (nodeName === 'wipe') {
      const dir = (child.getAttribute('dir') || 'l').toLowerCase();
      if (dir === 'r') { transitionType = 'wipe-right'; direction = 'right'; }
      else if (dir === 'u') { transitionType = 'wipe-up'; direction = 'up'; }
      else if (dir === 'd') { transitionType = 'wipe-down'; direction = 'down'; }
      else { transitionType = 'wipe-left'; direction = 'left'; }
      break;
    } else if (nodeName === 'split') {
      const orient = (child.getAttribute('orient') || 'horz').toLowerCase();
      transitionType = orient === 'vert' ? 'split-vertical' : 'split-horizontal';
      break;
    } else if (nodeName === 'zoom') {
      const dir = (child.getAttribute('dir') || 'in').toLowerCase();
      transitionType = dir === 'out' ? 'zoom-out' : 'zoom-in';
      direction = dir === 'out' ? 'out' : 'in';
      break;
    } else if (nodeName === 'dissolve') {
      transitionType = 'dissolve';
      break;
    } else if (nodeName === 'morph') {
      transitionType = 'morph';
      break;
    } else if (nodeName === 'flip') {
      const dir = (child.getAttribute('dir') || 'l').toLowerCase();
      transitionType = dir === 'r' ? 'flip-right' : 'flip-left';
      break;
    } else if (nodeName === 'cube') {
      const dir = (child.getAttribute('dir') || 'l').toLowerCase();
      transitionType = dir === 'r' ? 'cube-right' : 'cube-left';
      break;
    } else if (nodeName === 'gallery') {
      transitionType = 'gallery';
      break;
    } else if (nodeName === 'cover' || nodeName === 'pull') {
      const dir = (child.getAttribute('dir') || 'l').toLowerCase();
      transitionType = dir === 'r' ? 'push-right' : dir === 'u' ? 'push-up' : dir === 'd' ? 'push-down' : 'push-left';
      break;
    }
  }

  return {
    type: transitionType,
    durationMs,
    easing: 'ease-in-out',
    direction,
    advanceOnClick,
    advanceAfterTimeMs,
  };
}

/**
 * Enterprise Offline PPTX Parser
 * Accurately extracts slide shapes, placeholders, background templates (images, gradients, solid fills),
 * theme color schemes, font hierarchies, shapes, badges, and layout coordinates in accordance with ECMA-376 OpenXML standards.
 */
export async function parsePptxOffline(file: File | Blob): Promise<ParsedSlide[]> {
  if (!file || file.size < 4) {
    throw new Error('Invalid PPTX binary: file is empty or truncated.');
  }

  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(file);

  // 1. Extract all media files into Object URLs
  const mediaMap = new Map<string, string>(); // relative target or filename -> ObjectURL
  const mediaFiles = Object.keys(loadedZip.files).filter(name => /^ppt\/media\//.test(name));
  
  for (const mediaName of mediaFiles) {
    try {
      const ext = mediaName.split('.').pop()?.toLowerCase() || 'png';
      const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' 
        : ext === 'png' ? 'image/png' 
        : ext === 'webp' ? 'image/webp' 
        : ext === 'gif' ? 'image/gif' 
        : ext === 'svg' ? 'image/svg+xml' 
        : ext === 'mp4' ? 'video/mp4'
        : ext === 'mp3' ? 'audio/mpeg'
        : ext === 'wav' ? 'audio/wav'
        : 'application/octet-stream';
      
      const blob = await loadedZip.files[mediaName].async('blob');
      const realBlob = new Blob([blob], { type: mimeType });
      const objectUrl = URL.createObjectURL(realBlob);
      mediaMap.set(mediaName, objectUrl);
      
      const simpleName = mediaName.replace('ppt/media/', '');
      mediaMap.set(simpleName, objectUrl);
      mediaMap.set(`../media/${simpleName}`, objectUrl);
      mediaMap.set(`media/${simpleName}`, objectUrl);
    } catch (e) {
      console.warn('[pptxParser] Failed reading media:', mediaName, e);
    }
  }

  const parser = new DOMParser();

  // 2. Parse Presentation Size (default 16:9 widescreen 12192000 x 6858000 EMUs)
  let sldWidthEmu = 12192000;
  let sldHeightEmu = 6858000;

  if (loadedZip.files['ppt/presentation.xml']) {
    try {
      const presXml = await loadedZip.files['ppt/presentation.xml'].async('text');
      const presDoc = parser.parseFromString(presXml, 'text/xml');
      const sldSz = presDoc.getElementsByTagName('p:sldSz')[0];
      if (sldSz) {
        const cx = parseInt(sldSz.getAttribute('cx') || '', 10);
        const cy = parseInt(sldSz.getAttribute('cy') || '', 10);
        if (cx > 0 && cy > 0) {
          sldWidthEmu = cx;
          sldHeightEmu = cy;
        }
      }
    } catch (e) {
      console.warn('[pptxParser] Presentation size parsing warning:', e);
    }
  }

  // 3. Parse Theme Colors and Fonts
  const themeColors: Record<string, string> = {
    dk1: '#000000',
    lt1: '#FFFFFF',
    dk2: '#1F2421',
    lt2: '#EEE5E9',
    accent1: '#0078D4', // Modern Office blue default
    accent2: '#107C41', // Modern Excel green
    accent3: '#D83B01',
    accent4: '#8064A2',
    accent5: '#4BACC6',
    accent6: '#F79646',
    hlink: '#0066CC',
    folHlink: '#800080'
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

  // Helper to resolve color node (srgbClr, schemeClr, sysClr, etc.)
  const resolveColor = (parentElem: Element | null): string | undefined => {
    if (!parentElem) return undefined;
    const srgb = parentElem.getElementsByTagName('a:srgbClr')[0]?.getAttribute('val');
    if (srgb) return `#${srgb}`;
    
    const scheme = parentElem.getElementsByTagName('a:schemeClr')[0]?.getAttribute('val');
    if (scheme && themeColors[scheme]) return themeColors[scheme];
    
    const sys = parentElem.getElementsByTagName('a:sysClr')[0]?.getAttribute('lastClr');
    if (sys) return `#${sys}`;

    return undefined;
  };

  // Helper to resolve background fill from a container
  const resolveBgFill = async (
    bgElem: Element | null, 
    relsDoc: Document | null
  ): Promise<{ backgroundUrl?: string, backgroundColor?: string }> => {
    if (!bgElem) return {};
    
    const blip = bgElem.getElementsByTagName('a:blip')[0];
    if (blip && relsDoc) {
      const rId = blip.getAttribute('r:embed') || blip.getAttribute('embed') || '';
      if (rId) {
        const relTarget = relsDoc.querySelector(`Relationship[Id="${rId}"]`)?.getAttribute('Target');
        if (relTarget && mediaMap.has(relTarget)) {
          return { backgroundUrl: mediaMap.get(relTarget) };
        }
      }
    }

    const solidFill = bgElem.getElementsByTagName('a:solidFill')[0];
    if (solidFill) {
      const color = resolveColor(solidFill);
      if (color) return { backgroundColor: color };
    }

    const gradFill = bgElem.getElementsByTagName('a:gradFill')[0];
    if (gradFill) {
      const gsList = Array.from(gradFill.getElementsByTagName('a:gs'));
      const stops: string[] = [];
      for (const gs of gsList) {
        const c = resolveColor(gs);
        const pos = parseInt(gs.getAttribute('pos') || '0', 10) / 1000;
        if (c) stops.push(`${c} ${pos}%`);
      }
      if (stops.length > 1) {
        return { backgroundColor: `linear-gradient(135deg, ${stops.join(', ')})` };
      }
    }

    return {};
  };

  // 4. Find and sort slide files
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
    const fileName = slideFiles[sIdx];
    const xmlString = await loadedZip.files[fileName].async('text');
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

    // Parse slide relationships
    const relsFileName = fileName.replace('ppt/slides/', 'ppt/slides/_rels/').concat('.rels');
    let relsDoc: Document | null = null;
    let layoutFileName = '';
    
    if (loadedZip.files[relsFileName]) {
      try {
        const relsXml = await loadedZip.files[relsFileName].async('text');
        relsDoc = parser.parseFromString(relsXml, 'text/xml');
        
        const layoutRel = relsDoc.querySelector('Relationship[Type*="slideLayout"]');
        if (layoutRel) {
          const target = layoutRel.getAttribute('Target') || '';
          layoutFileName = target.startsWith('/') ? target.substring(1) : `ppt/${target.replace('../', '')}`;
        }
      } catch (e) {
        console.warn('[pptxParser] rels parse error:', e);
      }
    }

    // 5. Parse Slide Transition (<p:transition>)
    let slideTransition: SlideTransition | undefined;
    const transElem = xmlDoc.getElementsByTagName('p:transition')[0] || xmlDoc.getElementsByTagName('transition')[0];
    if (transElem) {
      slideTransition = parseSlideTransition(transElem);
    }

    // 6. Resolve Background: Slide -> Layout -> Master
    let slideBackgroundUrl: string | undefined;
    let slideBackgroundColor: string | undefined;
    let headerBarColor: string | undefined;

    // Check direct slide background <p:bg>
    const slideBg = xmlDoc.getElementsByTagName('p:bg')[0];
    if (slideBg) {
      const bgResult = await resolveBgFill(slideBg, relsDoc);
      slideBackgroundUrl = bgResult.backgroundUrl;
      slideBackgroundColor = bgResult.backgroundColor;
    }

    // Check layout background
    if (!slideBackgroundUrl && !slideBackgroundColor && layoutFileName && loadedZip.files[layoutFileName]) {
      try {
        const layoutXml = await loadedZip.files[layoutFileName].async('text');
        const layoutDoc = parser.parseFromString(layoutXml, 'text/xml');
        const layoutRelsFile = layoutFileName.replace('ppt/slideLayouts/', 'ppt/slideLayouts/_rels/').concat('.rels');
        let layoutRelsDoc: Document | null = null;
        if (loadedZip.files[layoutRelsFile]) {
          const layoutRelsXml = await loadedZip.files[layoutRelsFile].async('text');
          layoutRelsDoc = parser.parseFromString(layoutRelsXml, 'text/xml');
        }

        const layoutBg = layoutDoc.getElementsByTagName('p:bg')[0];
        if (layoutBg) {
          const bgResult = await resolveBgFill(layoutBg, layoutRelsDoc);
          slideBackgroundUrl = bgResult.backgroundUrl;
          slideBackgroundColor = bgResult.backgroundColor;
        }

        // Check for layout header accent bars or decorations
        const layoutShapes = Array.from(layoutDoc.getElementsByTagName('p:sp'));
        for (const lSp of layoutShapes) {
          const solid = lSp.getElementsByTagName('a:solidFill')[0];
          const xfrm = lSp.getElementsByTagName('a:xfrm')[0];
          if (solid && xfrm) {
            const offY = parseInt(xfrm.getElementsByTagName('a:off')[0]?.getAttribute('y') || '999999', 10);
            const extCx = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cx') || '0', 10);
            const extCy = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cy') || '0', 10);
            if (offY < sldHeightEmu * 0.15 && extCx > sldWidthEmu * 0.7 && extCy < sldHeightEmu * 0.15) {
              headerBarColor = resolveColor(solid);
            }
          }
        }
      } catch (e) {
        console.warn('[pptxParser] Layout background check failed:', e);
      }
    }

    // Check Slide Master background
    if (!slideBackgroundUrl && !slideBackgroundColor && loadedZip.files['ppt/slideMasters/slideMaster1.xml']) {
      try {
        const masterXml = await loadedZip.files['ppt/slideMasters/slideMaster1.xml'].async('text');
        const masterDoc = parser.parseFromString(masterXml, 'text/xml');
        const masterRelsFile = 'ppt/slideMasters/_rels/slideMaster1.xml.rels';
        let masterRelsDoc: Document | null = null;
        if (loadedZip.files[masterRelsFile]) {
          const masterRelsXml = await loadedZip.files[masterRelsFile].async('text');
          masterRelsDoc = parser.parseFromString(masterRelsXml, 'text/xml');
        }

        const masterBg = masterDoc.getElementsByTagName('p:bg')[0];
        if (masterBg) {
          const bgResult = await resolveBgFill(masterBg, masterRelsDoc);
          slideBackgroundUrl = bgResult.backgroundUrl;
          slideBackgroundColor = bgResult.backgroundColor;
        }
      } catch (e) {
        console.warn('[pptxParser] Master background check failed:', e);
      }
    }

    // Default clean template background (standard modern presentation white)
    if (!slideBackgroundUrl && !slideBackgroundColor) {
      slideBackgroundColor = '#FFFFFF';
    }

    // Determine if background is light or dark
    const isDarkBg = Boolean(
      slideBackgroundColor && 
      (slideBackgroundColor.startsWith('#0') || slideBackgroundColor.startsWith('#1') || slideBackgroundColor.startsWith('#2') || slideBackgroundColor.toLowerCase().includes('black'))
    );

    // 6. Parse Text, Shapes, Buttons, and Layout Elements
    let titleText = '';
    let subtitleText = '';
    let titleColor: string | undefined = isDarkBg ? '#FFFFFF' : '#0F172A';
    let titleFontFamily: string | undefined = themeMajorFont;
    let titleFontSize: number | undefined;
    let bodyFontColor: string | undefined = isDarkBg ? '#E2E8F0' : '#334155';
    let bodyFontFamily: string | undefined = themeMinorFont;
    let bodyFontSize: number | undefined;
    let slideTextAlign: 'left' | 'center' | 'right' | 'justify' | undefined;

    const bodyParagraphs: string[] = [];
    const bulletItems: string[] = [];
    const slideElements: SlideElement[] = [];

    // Parse Pictures <p:pic>
    const pictures = Array.from(xmlDoc.getElementsByTagName('p:pic'));
    for (const pic of pictures) {
      const blip = pic.getElementsByTagName('a:blip')[0];
      const rId = blip?.getAttribute('r:embed') || blip?.getAttribute('embed') || '';
      let imgUrl: string | undefined;
      if (rId && relsDoc) {
        const relTarget = relsDoc.querySelector(`Relationship[Id="${rId}"]`)?.getAttribute('Target');
        if (relTarget && mediaMap.has(relTarget)) {
          imgUrl = mediaMap.get(relTarget);
        }
      }

      const xfrm = pic.getElementsByTagName('a:xfrm')[0];
      if (xfrm && imgUrl) {
        const offX = parseInt(xfrm.getElementsByTagName('a:off')[0]?.getAttribute('x') || '0', 10);
        const offY = parseInt(xfrm.getElementsByTagName('a:off')[0]?.getAttribute('y') || '0', 10);
        const extCx = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cx') || '0', 10);
        const extCy = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cy') || '0', 10);

        slideElements.push({
          type: 'image',
          imageUrl: imgUrl,
          leftPercent: Math.max(0, (offX / sldWidthEmu) * 100),
          topPercent: Math.max(0, (offY / sldHeightEmu) * 100),
          widthPercent: Math.min(100, (extCx / sldWidthEmu) * 100),
          heightPercent: Math.min(100, (extCy / sldHeightEmu) * 100),
        });
      }
    }

    // Parse Shapes <p:sp>
    const shapes = Array.from(xmlDoc.getElementsByTagName('p:sp'));

    for (const shape of shapes) {
      const phElem = shape.getElementsByTagName('p:ph')[0] || shape.getElementsByTagName('ph')[0];
      const phType = phElem ? (phElem.getAttribute('type') || '').toLowerCase() : '';

      // Geometric position
      const xfrm = shape.getElementsByTagName('a:xfrm')[0];
      let leftPercent: number | undefined;
      let topPercent: number | undefined;
      let widthPercent: number | undefined;
      let heightPercent: number | undefined;

      if (xfrm) {
        const offX = parseInt(xfrm.getElementsByTagName('a:off')[0]?.getAttribute('x') || '0', 10);
        const offY = parseInt(xfrm.getElementsByTagName('a:off')[0]?.getAttribute('y') || '0', 10);
        const extCx = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cx') || '0', 10);
        const extCy = parseInt(xfrm.getElementsByTagName('a:ext')[0]?.getAttribute('cy') || '0', 10);
        if (extCx > 0 && extCy > 0) {
          leftPercent = (offX / sldWidthEmu) * 100;
          topPercent = (offY / sldHeightEmu) * 100;
          widthPercent = (extCx / sldWidthEmu) * 100;
          heightPercent = (extCy / sldHeightEmu) * 100;
        }
      }

      // Check Shape Fill (Button / Badge / Banner Box)
      const spPr = shape.getElementsByTagName('p:spPr')[0];
      const shapeSolidFill = spPr?.getElementsByTagName('a:solidFill')[0];
      const shapeFillColor = shapeSolidFill ? resolveColor(shapeSolidFill) : undefined;

      // Extract paragraphs
      const paragraphs = Array.from(shape.getElementsByTagName('a:p'));
      const shapeParagraphTexts: string[] = [];

      for (const p of paragraphs) {
        const pPr = p.getElementsByTagName('a:pPr')[0];
        const algn = pPr?.getAttribute('algn');
        const currentAlign = algn === 'ctr' ? 'center' : algn === 'r' ? 'right' : algn === 'just' ? 'justify' : 'left';

        const runs = Array.from(p.getElementsByTagName('a:r'));
        let paragraphText = '';

        for (const run of runs) {
          const tElem = run.getElementsByTagName('a:t')[0];
          const text = tElem?.textContent || '';
          if (!text) continue;
          paragraphText += text;

          const rPr = run.getElementsByTagName('a:rPr')[0];
          if (rPr) {
            const color = resolveColor(rPr);
            const sz = rPr.getAttribute('sz');
            const typeface = rPr.getElementsByTagName('a:latin')[0]?.getAttribute('typeface');

            if (phType === 'title' || phType === 'ctrtitle') {
              if (color) titleColor = color;
              if (typeface) titleFontFamily = `${typeface}, sans-serif`;
              if (sz) titleFontSize = Math.round(parseInt(sz, 10) / 100);
            } else {
              if (color && !bodyFontColor) bodyFontColor = color;
              if (typeface && !bodyFontFamily) bodyFontFamily = `${typeface}, sans-serif`;
              if (sz && !bodyFontSize) bodyFontSize = Math.round(parseInt(sz, 10) / 100);
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
            pPr.getAttribute('lvl') !== null
          );

          if (hasBullet) {
            bulletItems.push(trimmed);
          }
        }
      }

      // Check if this is a pill button / badge (e.g. "For new M365 users", "Business Basic")
      if (shapeFillColor && shapeParagraphTexts.length > 0 && widthPercent && widthPercent < 35 && heightPercent && heightPercent < 15) {
        slideElements.push({
          type: 'badge',
          text: shapeParagraphTexts.join(' '),
          leftPercent,
          topPercent,
          widthPercent,
          heightPercent,
          backgroundColor: shapeFillColor,
          fontColor: '#FFFFFF',
          borderRadius: 6,
          fontWeight: 'bold',
          textAlign: 'center',
        });
        continue;
      }

      // Check if this is a top accent line or header bar
      if (shapeFillColor && topPercent !== undefined && topPercent < 10 && widthPercent && widthPercent > 80 && heightPercent && heightPercent < 6) {
        headerBarColor = shapeFillColor;
        continue;
      }

      if (shapeParagraphTexts.length === 0) continue;

      if (phType === 'title' || phType === 'ctrtitle') {
        titleText = shapeParagraphTexts.join(' ');
      } else if (phType === 'subTitle' || phType === 'sub') {
        subtitleText = shapeParagraphTexts.join('\n');
      } else if (phType === 'body') {
        bodyParagraphs.push(...shapeParagraphTexts);
      } else {
        if (!titleText && shapeParagraphTexts.length === 1 && shapeParagraphTexts[0].length < 100) {
          titleText = shapeParagraphTexts[0];
        } else {
          bodyParagraphs.push(...shapeParagraphTexts);
        }
      }
    }

    if (!titleText && bodyParagraphs.length > 0) {
      titleText = bodyParagraphs.shift() || `Slide ${sIdx + 1}`;
    }

    if (!titleText) {
      titleText = `Slide ${sIdx + 1}`;
    }

    const fullBodyText = bodyParagraphs.length > 0 
      ? bodyParagraphs.join('\n\n') 
      : (subtitleText || '');

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
      title: titleText.replace(/\s+/g, ' ').trim(),
      text: fullBodyText,
      subtitle: subtitleText,
      bullets: bulletItems.length > 0 ? bulletItems : undefined,
      isTitleSlide,
      backgroundUrl: slideBackgroundUrl,
      backgroundColor: slideBackgroundColor,
      fontColor: bodyFontColor,
      fontFamily: bodyFontFamily,
      fontSize: bodyFontSize,
      textAlign: slideTextAlign || (isTitleSlide ? 'left' : 'left'),
      titleColor: titleColor,
      titleFontFamily: titleFontFamily,
      titleFontSize: titleFontSize,
      accentColor: themeColors.accent1 || '#0078D4',
      headerBarColor: headerBarColor || themeColors.accent1 || '#0078D4',
      elements: slideElements.length > 0 ? slideElements : undefined,
      transition: slideTransition,
      aspectRatio: deckAspectRatio,
      aspectRatioLabel: deckAspectLabel,
      widthEmu: sldWidthEmu,
      heightEmu: sldHeightEmu,
    });
  }

  return slides;
}
