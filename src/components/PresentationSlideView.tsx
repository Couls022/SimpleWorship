import React, { useMemo, useEffect } from 'react';
import { Slide, SlideObject, ThemeStyles } from '../types';
import { resolveAssetUrl } from '../db';
import { 
  getCompatibleFontStack, 
  ensurePptxFontsLoaded, 
  calculateAutoFitTextScale 
} from '../utils/pptxFontManager';
import { deconflictAndDeduplicateSlideObjects } from '../utils/pptxParser';

interface PresentationSlideViewProps {
  slide: Slide;
  slideIndex: number;
  totalSlides?: number;
  mode?: 'thumbnail' | 'full' | 'live' | 'preview';
  themeStyles?: ThemeStyles;
  targetWidth?: number;
  targetHeight?: number;
  isProjectorMode?: boolean;
  isOverlayLayer?: boolean;
  presentationElementStates?: Map<string, any>;
}

export const PresentationSlideView: React.FC<PresentationSlideViewProps> = React.memo(({
  slide,
  slideIndex,
  totalSlides,
  mode = 'full',
  themeStyles,
  targetWidth,
  targetHeight,
  isProjectorMode,
  isOverlayLayer,
  presentationElementStates,
}) => {
  const [containerSize, setContainerSize] = React.useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [, setFontLoadTick] = React.useState<number>(0);
  const roRef = React.useRef<ResizeObserver | null>(null);

  // Re-render when fonts are downloaded or installed into IndexedDB / document.fonts
  useEffect(() => {
    const handler = () => {
      setFontLoadTick(t => t + 1);
    };
    window.addEventListener('simpleworship:fonts-updated', handler);
    window.addEventListener('simpleworship:pptx-fonts-loaded', handler);
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(handler).catch(() => {});
    }
    return () => {
      window.removeEventListener('simpleworship:fonts-updated', handler);
      window.removeEventListener('simpleworship:pptx-fonts-loaded', handler);
    };
  }, []);

  const containerCallbackRef = React.useCallback((el: HTMLDivElement | null) => {
    if (roRef.current) {
      roRef.current.disconnect();
      roRef.current = null;
    }
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const w = el.clientWidth || Math.round(rect.width);
    const h = el.clientHeight || Math.round(rect.height);
    if (w > 0 && h > 0) {
      setContainerSize(prev => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    }

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const width = Math.round(entry.contentRect.width);
        const height = Math.round(entry.contentRect.height);
        if (width > 0 && height > 0) {
          setContainerSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
        }
      });
      ro.observe(el);
      roRef.current = ro;
    }
  }, []);
  // Clean paragraphs and bullets
  const paragraphs = useMemo(() => {
    let rawList: string[] = [];
    if (Array.isArray(slide.bullets) && slide.bullets.length > 0) {
      rawList = slide.bullets.filter(b => typeof b === 'string' && b.trim().length > 0);
    } else if (slide.text) {
      rawList = slide.text
        .split('\n\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);
    }
    // Clean out duplicate title if slide.text repeated the title as first paragraph
    if (slide.title && rawList.length > 0) {
      const cleanTitle = slide.title.trim().toLowerCase().replace(/[:.]/g, '');
      const firstPara = rawList[0].trim().toLowerCase().replace(/[:.]/g, '');
      if (cleanTitle && (firstPara === cleanTitle || firstPara.startsWith(cleanTitle + '\n'))) {
        if (firstPara === cleanTitle) {
          rawList = rawList.slice(1);
        } else {
          rawList[0] = rawList[0].slice(slide.title.length).trim();
        }
      }
    }
    return rawList;
  }, [slide.title, slide.text, slide.bullets]);

  const isTitleSlide = Boolean(slide.isTitleSlide || (slideIndex === 0 && paragraphs.length <= 1));

  // Determine if this slide is from a PPTX or structured deck vs a standard song/verse slide
  const isPptxOrDeck = Boolean(
    slide.objects || 
    slide.elements || 
    slide.aspectRatio || 
    slide.notes !== undefined || 
    (slide as any).isPptx
  );

  // Background styling using slide background or active theme background
  const bgStyle: React.CSSProperties = useMemo(() => {
    // If in projector overlay mode and no explicit media background, stay 100% transparent
    if (isProjectorMode && isOverlayLayer && !slide.backgroundUrl) {
      return { backgroundColor: 'transparent' };
    }

    // 1. Direct slide background URL (PPTX background or custom slide background)
    const resolvedSlideBg = resolveAssetUrl(slide.backgroundUrl);
    if (resolvedSlideBg) {
      return {
        backgroundImage: `url(${resolvedSlideBg})`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: slide.backgroundColor || '#0F172A',
      };
    }
    // 2. Direct slide background gradient or color
    if (slide.backgroundColor) {
      if (slide.backgroundColor.startsWith('linear-gradient') || slide.backgroundColor.startsWith('radial-gradient')) {
        return { background: slide.backgroundColor };
      }
      return { backgroundColor: slide.backgroundColor };
    }
    // 3. Fallback to active theme background image ONLY for native song/verse slides
    if (!isPptxOrDeck && themeStyles?.backgroundImageUrl) {
      const resolvedThemeBg = resolveAssetUrl(themeStyles.backgroundImageUrl);
      return {
        backgroundImage: `url(${resolvedThemeBg})`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        backgroundColor: themeStyles?.backgroundColor || '#0F172A',
      };
    }
    // 4. Fallback to active theme gradient or color ONLY for native song/verse slides
    if (!isPptxOrDeck) {
      const bgGrad = themeStyles?.backgroundGradient;
      if (bgGrad && (bgGrad.startsWith('linear-gradient') || bgGrad.startsWith('radial-gradient'))) {
        return { background: bgGrad };
      }
      if (themeStyles?.backgroundColor) {
        return { backgroundColor: themeStyles.backgroundColor };
      }
    }
    // 5. Default canvas: if PPTX slide has no explicit bg, default to clean #FFFFFF; for native blackout canvas, use #000000
    return { backgroundColor: isPptxOrDeck ? '#FFFFFF' : '#000000' };
  }, [slide.backgroundUrl, slide.backgroundColor, themeStyles, isPptxOrDeck, isProjectorMode, isOverlayLayer]);

  // Determine light vs dark background
  const isDarkBg = Boolean(
    slide.backgroundUrl ||
    (!isPptxOrDeck && themeStyles?.backgroundImageUrl) ||
    (slide.backgroundColor && (slide.backgroundColor.startsWith('#0') || slide.backgroundColor.startsWith('#1') || slide.backgroundColor.startsWith('#2') || slide.backgroundColor.toLowerCase().includes('black'))) ||
    (!isPptxOrDeck && themeStyles?.backgroundColor && (themeStyles.backgroundColor.startsWith('#0') || themeStyles.backgroundColor.startsWith('#1') || themeStyles.backgroundColor.startsWith('#2') || themeStyles.backgroundColor.toLowerCase().includes('black'))) ||
    (!isPptxOrDeck && !slide.backgroundColor)
  );

function ensureContrast(color: string | undefined, isDark: boolean): string {
  if (!color) return isDark ? '#FFFFFF' : '#0F172A';
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (isDark && luminance < 0.45) return '#FFFFFF';
      if (!isDark && luminance > 0.85) return '#0F172A';
    }
  }
  return color;
}

  // Proactive font background loading for custom Canva/Google fonts (only on full/live views to prevent thumbnail gallery spam)
  useEffect(() => {
    if (mode === 'thumbnail') return;
    const fonts = new Set<string>();
    if (slide.fontFamily) fonts.add(slide.fontFamily);
    if (slide.titleFontFamily) fonts.add(slide.titleFontFamily);
    if (slide.themeOverride?.fontFamily) fonts.add(slide.themeOverride.fontFamily);
    if (Array.isArray(slide.objects)) {
      for (const o of slide.objects) {
        if (o.style?.fontFamily) fonts.add(o.style.fontFamily);
        if ((o as any).fontFamily) fonts.add((o as any).fontFamily);
      }
    }
    if (Array.isArray(slide.elements)) {
      for (const el of slide.elements) {
        if (el?.fontFamily) fonts.add(el.fontFamily);
      }
    }
    if (themeStyles?.fontFamily) fonts.add(themeStyles.fontFamily);
    if (fonts.size > 0) {
      ensurePptxFontsLoaded(Array.from(fonts)).catch(() => {});
    }
  }, [slide, themeStyles, mode]);

  const titleFont = getCompatibleFontStack(slide.titleFontFamily || themeStyles?.fontFamily || 'Aptos, Calibri, "Segoe UI", -apple-system, sans-serif');
  const bodyFont = getCompatibleFontStack(slide.fontFamily || themeStyles?.fontFamily || 'Aptos, Calibri, "Segoe UI", -apple-system, sans-serif');
  const titleColor = ensureContrast(slide.titleColor || themeStyles?.fontColor, isDarkBg);
  const bodyColor = ensureContrast(slide.fontColor || themeStyles?.fontColor, isDarkBg);
  const accentColor = slide.accentColor || slide.headerBarColor || (themeStyles as any)?.accentColor || '#38BDF8';
  const textAlign = slide.textAlign || (themeStyles?.textAlign as any) || (isTitleSlide ? 'center' : 'left');

  const getBaseDimensions = () => {
    let ratio = 16 / 9;
    if (slide.aspectRatioLabel?.includes('4:3') || (slide.aspectRatio && Math.abs(slide.aspectRatio - 4 / 3) < 0.05)) {
      return { baseWidth: 1440, baseHeight: 1080, ratio: 4 / 3 };
    }
    if (slide.aspectRatioLabel?.includes('16:10') || (slide.aspectRatio && Math.abs(slide.aspectRatio - 16 / 10) < 0.05)) {
      return { baseWidth: 1920, baseHeight: 1200, ratio: 16 / 10 };
    }
    if (slide.aspectRatioLabel?.includes('21:9') || (slide.aspectRatio && Math.abs(slide.aspectRatio - 21 / 9) < 0.05)) {
      return { baseWidth: 2560, baseHeight: 1080, ratio: 21 / 9 };
    }
    if (slide.aspectRatioLabel?.includes('1:1') || (slide.aspectRatio && Math.abs(slide.aspectRatio - 1) < 0.05)) {
      return { baseWidth: 1080, baseHeight: 1080, ratio: 1 };
    }
    if (slide.aspectRatioLabel?.includes('9:16') || (slide.aspectRatio && Math.abs(slide.aspectRatio - 9 / 16) < 0.05)) {
      return { baseWidth: 1080, baseHeight: 1920, ratio: 9 / 16 };
    }
    if (slide.aspectRatio) {
      ratio = slide.aspectRatio;
    } else if (slide.widthEmu && slide.heightEmu && slide.heightEmu > 0) {
      ratio = slide.widthEmu / slide.heightEmu;
    }
    const baseHeight = 1080;
    const baseWidth = Math.round(baseHeight * ratio);
    return { baseWidth, baseHeight, ratio };
  };

  const { baseWidth, baseHeight } = getBaseDimensions();

  // Authoritative container sizing: priority given to explicit target display bounds, followed by measured element size
  const effectiveContainerW = targetWidth || (containerSize.width > 0 ? containerSize.width : (mode === 'thumbnail' ? 280 : 1920));
  const effectiveContainerH = targetHeight || (containerSize.height > 0 ? containerSize.height : (mode === 'thumbnail' ? 158 : 1080));

  // Compute uniform fit scale and fitted dimensions (pillarbox / letterbox auto-fit)
  const fitScale = useMemo(() => {
    if (effectiveContainerW <= 0 || effectiveContainerH <= 0 || baseWidth <= 0 || baseHeight <= 0) return 1;
    return Math.min(effectiveContainerW / baseWidth, effectiveContainerH / baseHeight);
  }, [effectiveContainerW, effectiveContainerH, baseWidth, baseHeight]);

  const fittedWidth = Math.round(baseWidth * fitScale);
  const fittedHeight = Math.round(baseHeight * fitScale);

  const sanitizedObjects = useMemo(() => {
    if (!Array.isArray(slide.objects) || slide.objects.length === 0) return [];
    return deconflictAndDeduplicateSlideObjects(slide.objects);
  }, [slide.objects]);

  const hasObjects = sanitizedObjects.length > 0;

  // Auto-fit calculation for traditional slide layouts to prevent text overflow & distortion
  const titleFitFactor = useMemo(() => {
    if (!slide.title) return 1;
    return calculateAutoFitTextScale({
      text: slide.title,
      boxWidth: isTitleSlide ? 1600 : 1700,
      boxHeight: isTitleSlide ? 320 : 140,
      fontSize: isTitleSlide ? 60 : 38,
      fontFamily: titleFont,
      fontWeight: 'bold',
      lineHeightRatio: 1.15,
      padding: 16,
    });
  }, [slide.title, isTitleSlide, titleFont]);

  const bodyFitFactor = useMemo(() => {
    const fullText = paragraphs.join('\n');
    if (!fullText) return 1;
    return calculateAutoFitTextScale({
      text: fullText,
      boxWidth: 1600,
      boxHeight: isTitleSlide ? 250 : 650,
      fontSize: isTitleSlide ? 30 : 24,
      fontFamily: bodyFont,
      fontWeight: 'normal',
      lineHeightRatio: 1.3,
      padding: 16,
    });
  }, [paragraphs, isTitleSlide, bodyFont]);

  return (
    <div 
      ref={containerCallbackRef}
      className={`w-full h-full relative flex items-center justify-center overflow-hidden select-none ${isProjectorMode ? 'bg-transparent' : 'bg-black'}`}
    >
      {/* Aspect-Preserved Auto-Fitted Slide Stage */}
      <div 
        className="relative flex flex-col justify-between overflow-hidden shrink-0 shadow-2xl"
        style={{
          width: `${fittedWidth}px`,
          height: `${fittedHeight}px`,
          ...bgStyle,
        }}
      >
      {/* Background Overlay for native song/verse slides */}
      {!isPptxOrDeck && (slide.backgroundUrl || themeStyles?.backgroundImageUrl) && (
        <div 
          className="absolute inset-0 z-0 pointer-events-none" 
          style={{ 
            backgroundColor: themeStyles?.backgroundOverlayColor || '#000000',
            opacity: themeStyles?.backgroundOverlayOpacity ?? 0.35 
          }} 
        />
      )}
      {/* Top Header Accent Stripe / Bar if present */}
      {slide.headerBarColor && (
        <div 
          className="absolute top-0 left-0 right-0 z-20"
          style={{ 
            height: `${Math.max(2, Math.round(8 * fitScale))}px`, 
            backgroundColor: slide.headerBarColor 
          }} 
        />
      )}

      {/* Render Object Canvas if objects exist */}
      {hasObjects ? (
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
          {sanitizedObjects.filter(obj => {
            if (mode === 'thumbnail') return true;
            const animState = presentationElementStates?.get(obj.id)
              ?? (obj.shapeId ? presentationElementStates?.get(obj.shapeId) : undefined)
              ?? (obj.shapeId ? presentationElementStates?.get(`shape-${obj.shapeId}`) : undefined);
            if (animState && animState.visible !== undefined) {
              return animState.visible !== false;
            }
            return obj.visible !== false;
          }).map((obj) => {
            const leftPx = Math.round(obj.x * fitScale);
            const topPx = Math.round(obj.y * fitScale);
            const widthPx = Math.round(obj.width * fitScale);
            const heightPx = Math.round(obj.height * fitScale);

            const animState = presentationElementStates?.get(obj.id)
              ?? (obj.shapeId ? presentationElementStates?.get(obj.shapeId) : undefined)
              ?? (obj.shapeId ? presentationElementStates?.get(`shape-${obj.shapeId}`) : undefined);

            const style = obj.style || {};
            const objFont = getCompatibleFontStack(style.fontFamily || (obj.type === 'shape' ? bodyFont : titleFont));

            const baseFontSz = (style as any).rawFontSize || style.fontSize || 36;
            // Auto-adjust scale calculation to prevent overflow, line jumps and collision
            const autoFitFactor = (obj.type === 'text' || obj.type === 'shape') && obj.text && obj.width > 0 && obj.height > 0
              ? calculateAutoFitTextScale({
                  text: obj.text,
                  boxWidth: obj.width,
                  boxHeight: obj.height,
                  fontSize: baseFontSz,
                  fontFamily: objFont,
                  fontWeight: style.fontWeight || (obj.type === 'text' ? 'bold' : 'normal'),
                  lineHeightRatio: style.lineSpacing || 1.2,
                  padding: style.padding || 8,
                })
              : 1;

            const fontPx = Math.max(6, Math.round(baseFontSz * fitScale * autoFitFactor));
            const paddingPx = Math.max(0, Math.round((style.padding || 8) * fitScale));
            const paddingTopPx = style.paddingTop !== undefined ? Math.round(style.paddingTop * fitScale) : paddingPx;
            const paddingBottomPx = style.paddingBottom !== undefined ? Math.round(style.paddingBottom * fitScale) : paddingPx;
            const paddingLeftPx = style.paddingLeft !== undefined ? Math.round(style.paddingLeft * fitScale) : paddingPx;
            const paddingRightPx = style.paddingRight !== undefined ? Math.round(style.paddingRight * fitScale) : paddingPx;

            const shadowCss = style.shadowEnabled
              ? `${Math.round((style.shadowOffsetX || 0) * fitScale)}px ${Math.round((style.shadowOffsetY || 4) * fitScale)}px ${Math.round((style.shadowBlur || 8) * fitScale)}px ${style.shadowColor || 'rgba(0,0,0,0.3)'}`
              : 'none';

            const objColor = ensureContrast(style.fontColor, isDarkBg);

            return (
              <div
                key={obj.id}
                className={`absolute flex flex-col box-border ${obj.type === 'text' ? 'overflow-visible' : 'overflow-hidden'}`}
                style={{
                  left: `${leftPx}px`,
                  top: `${topPx}px`,
                  width: `${widthPx}px`,
                  height: `${heightPx}px`,
                  transform: `rotate(${obj.rotation || 0}deg)`,
                  zIndex: obj.zIndex ?? (obj.type === 'text' ? 2 : 1),
                  opacity: (obj.opacity ?? 1) * (style.opacity ?? 1),
                  backgroundColor: style.backgroundColor || 'transparent',
                  borderColor: style.borderColor || 'transparent',
                  borderWidth: style.borderWidth ? `${Math.max(1, Math.round(style.borderWidth * fitScale))}px` : 0,
                  borderStyle: style.borderColor ? 'solid' : 'none',
                  borderRadius: style.borderRadius ? `${Math.round(style.borderRadius * fitScale)}px` : undefined,
                  boxShadow: shadowCss,
                  paddingTop: `${paddingTopPx}px`,
                  paddingBottom: `${paddingBottomPx}px`,
                  paddingLeft: `${paddingLeftPx}px`,
                  paddingRight: `${paddingRightPx}px`,
                  animation: animState?.cssAnimation || undefined,
                }}
              >
                {obj.type === 'text' && (
                  <div
                    className="w-full h-full break-words flex flex-col antialiased"
                    style={{
                      fontFamily: objFont,
                      fontSize: `${fontPx}px`,
                      color: objColor,
                      fontWeight: style.fontWeight || 'bold',
                      fontStyle: style.fontStyle || 'normal',
                      textDecoration: style.textDecoration || 'none',
                      letterSpacing: style.letterSpacing ? `${style.letterSpacing * fitScale}px` : undefined,
                      textAlign: style.textAlign || 'left',
                      lineHeight: style.lineSpacing ? `${style.lineSpacing}` : '1.2',
                      justifyContent: style.alignVertical === 'bottom' ? 'flex-end' : style.alignVertical === 'middle' ? 'center' : 'flex-start',
                      textShadow: isDarkBg ? '0 1px 3px rgba(0,0,0,0.7)' : 'none',
                      wordBreak: 'normal',
                      overflowWrap: 'break-word',
                    }}
                  >
                    {obj.paragraphs && obj.paragraphs.length > 0 ? (
                      obj.paragraphs.map((para, pIdx) => (
                        <div 
                          key={pIdx} 
                          className="w-full"
                          style={{ 
                            textAlign: para.textAlign || style.textAlign || 'left',
                            marginBottom: pIdx < obj.paragraphs!.length - 1 ? `${Math.round(8 * fitScale)}px` : 0 
                          }}
                        >
                          {para.runs && para.runs.length > 0 ? (
                            para.runs.map((r, rIdx) => {
                              const rFont = r.fontFamily ? getCompatibleFontStack(r.fontFamily) : objFont;
                              const rFontPx = r.fontSize ? Math.max(6, Math.round(r.fontSize * fitScale * autoFitFactor)) : fontPx;
                              return (
                                <span
                                  key={rIdx}
                                  style={{
                                    color: r.color ? ensureContrast(r.color, isDarkBg) : objColor,
                                    fontWeight: r.bold ? 'bold' : (style.fontWeight || 'normal'),
                                    fontStyle: r.italic ? 'italic' : 'normal',
                                    textDecoration: r.underline ? 'underline' : 'none',
                                    fontFamily: rFont,
                                    fontSize: `${rFontPx}px`,
                                  }}
                                >
                                  {r.text}
                                </span>
                              );
                            })
                          ) : (
                            <span>{obj.text}</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="w-full whitespace-pre-wrap">{obj.text}</div>
                    )}
                  </div>
                )}

                {obj.type === 'image' && obj.imageUrl && (
                  <img
                    src={obj.imageUrl}
                    alt=""
                    className="w-full h-full object-contain pointer-events-none"
                    style={{ borderRadius: style.borderRadius ? `${Math.round(style.borderRadius * fitScale)}px` : undefined }}
                  />
                )}

                {obj.type === 'shape' && (
                  <div
                    className="w-full h-full flex items-center justify-center font-semibold text-center leading-[1.2] antialiased overflow-hidden"
                    style={{
                      borderRadius: obj.shapeType === 'ellipse' || obj.shapeType === 'circle' ? '50%' : obj.shapeType === 'rounded-rectangle' ? `${Math.round(12 * fitScale)}px` : undefined,
                      backgroundColor: style.backgroundColor || accentColor,
                      color: style.fontColor || '#FFFFFF',
                      fontSize: `${fontPx}px`,
                      fontFamily: objFont,
                      textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                    }}
                  >
                    {obj.text}
                  </div>
                )}

                {obj.type === 'line' && (
                  <div className="w-full h-full flex items-center">
                    <div className="w-full" style={{ height: `${Math.max(1, Math.round((style.borderWidth || 2) * fitScale))}px`, backgroundColor: style.borderColor || accentColor }} />
                  </div>
                )}

                {obj.type === 'table' && obj.tableData && (
                  <div className="w-full h-full flex flex-col overflow-hidden">
                    <table className="w-full h-full border-collapse table-fixed">
                      <tbody>
                        {obj.tableData.rows.map((row, rIdx) => (
                          <tr key={rIdx}>
                            {row.cells.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                colSpan={cell.colSpan}
                                rowSpan={cell.rowSpan}
                                style={{
                                  backgroundColor: cell.backgroundColor || 'transparent',
                                  borderColor: cell.borderColor || 'rgba(255,255,255,0.2)',
                                  borderWidth: cell.borderWidth ? `${Math.max(1, Math.round(cell.borderWidth * fitScale))}px` : '1px',
                                  borderStyle: 'solid',
                                  color: cell.fontColor ? ensureContrast(cell.fontColor, isDarkBg) : objColor,
                                  fontSize: cell.fontSize ? `${Math.max(6, Math.round(cell.fontSize * fitScale))}px` : `${fontPx}px`,
                                  fontWeight: (cell.fontWeight as any) || 'normal',
                                  textAlign: cell.textAlign || 'left',
                                  verticalAlign: cell.alignVertical === 'bottom' ? 'bottom' : cell.alignVertical === 'middle' ? 'middle' : 'top',
                                  padding: `${Math.round(4 * fitScale)}px`,
                                }}
                              >
                                {cell.runs && cell.runs.length > 0 ? (
                                  cell.runs.map((r, runIdx) => (
                                    <span
                                      key={runIdx}
                                      style={{
                                        color: r.color ? ensureContrast(r.color, isDarkBg) : undefined,
                                        fontWeight: r.bold ? 'bold' : undefined,
                                        fontStyle: r.italic ? 'italic' : undefined,
                                        textDecoration: r.underline ? 'underline' : undefined,
                                        fontSize: r.fontSize ? `${Math.max(6, Math.round(r.fontSize * fitScale))}px` : undefined,
                                      }}
                                    >
                                      {r.text}
                                    </span>
                                  ))
                                ) : (
                                  cell.text
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {obj.type === 'placeholder' && (
                  <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-sky-400/50 bg-sky-500/10 text-sky-300 font-medium p-2 text-center text-xs">
                    {obj.placeholderLabel || obj.text || 'Placeholder'}
                  </div>
                )}

                {(obj.type === 'scripture' || obj.type === 'song' || obj.type === 'camera') && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-600/20 border border-indigo-400/30 rounded p-2 text-blue-200 text-center font-medium">
                    <span className="capitalize text-xs font-bold">{obj.type} Content</span>
                    <span className="text-[10px] opacity-80">{obj.text || 'Live Feed Stream'}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Main Slide Content Area */
        <div 
          className={`relative z-10 w-full h-full flex flex-col ${isTitleSlide ? 'justify-center' : 'justify-start'}`}
          style={{
            padding: `${Math.round((isTitleSlide ? 48 : 36) * fitScale)}px`,
          }}
        >

          {isTitleSlide ? (
            /* Title Slide Layout */
            <div className="flex flex-col justify-center h-full w-full">
              <h1 
                className="font-bold tracking-tight leading-tight antialiased"
                style={{
                  fontFamily: titleFont,
                  fontSize: `${Math.max(10, Math.round(58 * fitScale * titleFitFactor))}px`,
                  color: titleColor,
                  textAlign: textAlign,
                  marginBottom: `${Math.round(16 * fitScale)}px`,
                  textShadow: isDarkBg ? '0 2px 4px rgba(0,0,0,0.7)' : 'none',
                }}
              >
                {slide.title || 'Presentation Slide'}
              </h1>

              {paragraphs.length > 0 && (
                <div 
                  className="font-normal leading-relaxed antialiased"
                  style={{
                    fontFamily: bodyFont,
                    fontSize: `${Math.max(8, Math.round(28 * fitScale * bodyFitFactor))}px`,
                    color: bodyColor,
                    textAlign: textAlign,
                    marginTop: `${Math.round(8 * fitScale)}px`,
                    textShadow: isDarkBg ? '0 1px 3px rgba(0,0,0,0.6)' : 'none',
                  }}
                >
                  {paragraphs[0]}
                </div>
              )}

              {/* Template Buttons / Badges / Shapes */}
              {slide.elements && slide.elements.length > 0 && (
                <div className="flex flex-wrap items-center gap-2" style={{ marginTop: `${Math.round(20 * fitScale)}px` }}>
                  {slide.elements.map((elem, eIdx) => {
                    if (elem.type === 'badge') {
                      return (
                        <span
                          key={eIdx}
                          className="inline-flex items-center justify-center font-semibold shadow-md"
                          style={{
                            backgroundColor: elem.backgroundColor || accentColor,
                            color: elem.fontColor || '#FFFFFF',
                            borderRadius: elem.borderRadius ? `${Math.round(elem.borderRadius * fitScale)}px` : `${Math.round(6 * fitScale)}px`,
                            padding: `${Math.round(6 * fitScale)}px ${Math.round(14 * fitScale)}px`,
                            fontSize: `${Math.max(8, Math.round(14 * fitScale))}px`,
                          }}
                        >
                          {elem.text}
                        </span>
                      );
                    }
                    if (elem.type === 'image' && elem.imageUrl) {
                      return (
                        <img
                          key={eIdx}
                          src={elem.imageUrl}
                          alt=""
                          className="object-contain"
                          style={{ maxHeight: `${Math.round(64 * fitScale)}px` }}
                        />
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Content Slide Layout with Header & Body */
            <div className="flex flex-col h-full w-full">
              {/* Slide Header */}
              {slide.title && (
                <div 
                  className={`border-b ${isDarkBg ? 'border-white/20' : 'border-gray-200'} flex items-center justify-between`}
                  style={{
                    paddingBottom: `${Math.round(8 * fitScale)}px`,
                    marginBottom: `${Math.round(16 * fitScale)}px`,
                  }}
                >
                  <h2 
                    className="font-bold tracking-tight antialiased"
                    style={{
                      fontFamily: titleFont,
                      fontSize: `${Math.max(10, Math.round(40 * fitScale * titleFitFactor))}px`,
                      color: titleColor,
                      textAlign: textAlign,
                      textShadow: isDarkBg ? '0 2px 4px rgba(0,0,0,0.7)' : 'none',
                    }}
                  >
                    {slide.title}
                  </h2>
                </div>
              )}

              {/* Slide Body / Bullets */}
              <div 
                className="flex-1 flex flex-col overflow-hidden justify-center"
                style={{ 
                  textAlign,
                  gap: `${Math.round(12 * fitScale)}px`,
                }}
              >
                {paragraphs.map((para, pIdx) => (
                  <div 
                    key={pIdx} 
                    className={`flex items-start ${textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start'}`}
                    style={{ gap: `${Math.round(8 * fitScale)}px` }}
                  >
                    {slide.bullets && slide.bullets.length > 0 && (
                      <span 
                        className="rounded-full shrink-0"
                        style={{ 
                          backgroundColor: accentColor,
                          width: `${Math.max(3, Math.round(7 * fitScale))}px`,
                          height: `${Math.max(3, Math.round(7 * fitScale))}px`,
                          marginTop: `${Math.round(6 * fitScale)}px`,
                        }}
                      />
                    )}
                    <p 
                      className="font-normal leading-relaxed antialiased"
                      style={{
                        fontFamily: bodyFont,
                        fontSize: `${Math.max(8, Math.round(24 * fitScale * bodyFitFactor))}px`,
                        color: bodyColor,
                        textShadow: isDarkBg ? '0 1px 3px rgba(0,0,0,0.6)' : 'none',
                      }}
                    >
                      {para}
                    </p>
                  </div>
                ))}
              </div>

              {/* Badges / Shapes on Content Slides */}
              {slide.elements && slide.elements.length > 0 && (
                <div className="flex flex-wrap items-center gap-2" style={{ marginTop: `${Math.round(16 * fitScale)}px` }}>
                  {slide.elements.map((elem, eIdx) => {
                    if (elem.type === 'badge') {
                      return (
                        <span
                          key={eIdx}
                          className="inline-flex items-center justify-center font-semibold shadow-md"
                          style={{
                            backgroundColor: elem.backgroundColor || accentColor,
                            color: elem.fontColor || '#FFFFFF',
                            borderRadius: elem.borderRadius ? `${Math.round(elem.borderRadius * fitScale)}px` : `${Math.round(4 * fitScale)}px`,
                            padding: `${Math.round(4 * fitScale)}px ${Math.round(10 * fitScale)}px`,
                            fontSize: `${Math.max(7, Math.round(12 * fitScale))}px`,
                          }}
                        >
                          {elem.text}
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
});
