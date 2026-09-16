import React, { useMemo } from 'react';
import { Slide, SlideObject, ThemeStyles } from '../types';
import { resolveAssetUrl } from '../db';

interface PresentationSlideViewProps {
  slide: Slide;
  slideIndex: number;
  totalSlides?: number;
  mode?: 'thumbnail' | 'full';
  themeStyles?: ThemeStyles;
}

export const PresentationSlideView: React.FC<PresentationSlideViewProps> = React.memo(({
  slide,
  slideIndex,
  totalSlides,
  mode = 'full',
  themeStyles,
}) => {
  // Clean paragraphs and bullets
  const paragraphs = useMemo(() => {
    if (Array.isArray(slide.bullets) && slide.bullets.length > 0) {
      return slide.bullets.filter(b => typeof b === 'string' && b.trim().length > 0);
    }
    if (!slide.text) return [];
    return slide.text
      .split('\n\n')
      .map(p => p.trim())
      .filter(p => p.length > 0);
  }, [slide.text, slide.bullets]);

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
  }, [slide.backgroundUrl, slide.backgroundColor, themeStyles, isPptxOrDeck]);

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

  const titleFont = slide.titleFontFamily || themeStyles?.fontFamily || 'Aptos, Calibri, "Segoe UI", -apple-system, sans-serif';
  const bodyFont = slide.fontFamily || themeStyles?.fontFamily || 'Aptos, Calibri, "Segoe UI", -apple-system, sans-serif';
  const titleColor = ensureContrast(slide.titleColor || themeStyles?.fontColor, isDarkBg);
  const bodyColor = ensureContrast(slide.fontColor || themeStyles?.fontColor, isDarkBg);
  const accentColor = slide.accentColor || slide.headerBarColor || (themeStyles as any)?.accentColor || '#38BDF8';
  const textAlign = slide.textAlign || (themeStyles?.textAlign as any) || (isTitleSlide ? 'center' : 'left');

  const getBaseDimensions = () => {
    const ratio = slide.aspectRatio || (slide.widthEmu && slide.heightEmu && slide.heightEmu > 0 ? slide.widthEmu / slide.heightEmu : 16 / 9);
    const baseHeight = 1080;
    const baseWidth = Math.round(baseHeight * ratio);
    return { baseWidth, baseHeight };
  };

  const { baseWidth, baseHeight } = getBaseDimensions();

  const hasObjects = Array.isArray(slide.objects) && slide.objects.length > 0;

  return (
    <div className="w-full h-full relative flex items-center justify-center overflow-hidden select-none bg-black">
      <div 
        className="relative flex flex-col justify-between overflow-hidden shrink-0 w-full h-full"
        style={{
          ...bgStyle,
          containerType: 'size'
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
            height: '8px', 
            backgroundColor: slide.headerBarColor 
          }} 
        />
      )}

      {/* Render Object Canvas if objects exist */}
      {hasObjects ? (
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
          {slide.objects!.filter(obj => obj.visible !== false).map((obj) => {
            const leftPct = (obj.x / baseWidth) * 100;
            const topPct = (obj.y / baseHeight) * 100;
            const widthPct = (obj.width / baseWidth) * 100;
            const heightPct = (obj.height / baseHeight) * 100;

            const style = obj.style || {};
            // fontSz in cqh (container height percentage)
            const fontSz = style.fontSize ? (style.fontSize / baseHeight) * 100 : 3.5;

            const shadowCss = style.shadowEnabled
              ? `${style.shadowOffsetX || 0}px ${style.shadowOffsetY || 4}px ${style.shadowBlur || 8}px ${style.shadowColor || 'rgba(0,0,0,0.3)'}`
              : 'none';

            const objColor = ensureContrast(style.fontColor, isDarkBg);

            return (
              <div
                key={obj.id}
                className="absolute flex flex-col box-border overflow-hidden"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  transform: `rotate(${obj.rotation || 0}deg)`,
                  zIndex: obj.zIndex ?? 1,
                  opacity: (obj.opacity ?? 1) * (style.opacity ?? 1),
                  backgroundColor: style.backgroundColor || 'transparent',
                  borderColor: style.borderColor || 'transparent',
                  borderWidth: style.borderWidth ? `${style.borderWidth}px` : 0,
                  borderStyle: style.borderColor ? 'solid' : 'none',
                  borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
                  boxShadow: shadowCss,
                  padding: style.padding ? `${(style.padding / 1080) * 100}%` : '0.5%',
                }}
              >
                {obj.type === 'text' && (
                  <div
                    className="w-full h-full leading-relaxed break-words whitespace-pre-wrap flex flex-col antialiased"
                    style={{
                      fontFamily: style.fontFamily || titleFont,
                      fontSize: `${fontSz}cqh`,
                      color: objColor,
                      fontWeight: style.fontWeight || 'bold',
                      fontStyle: style.fontStyle || 'normal',
                      textDecoration: style.textDecoration || 'none',
                      textAlign: style.textAlign || 'left',
                      justifyContent: style.alignVertical === 'bottom' ? 'flex-end' : style.alignVertical === 'middle' ? 'center' : 'flex-start',
                      textShadow: isDarkBg ? '0 1px 3px rgba(0,0,0,0.7)' : 'none',
                    }}
                  >
                    {obj.text}
                  </div>
                )}

                {obj.type === 'image' && obj.imageUrl && (
                  <img
                    src={obj.imageUrl}
                    alt=""
                    className="w-full h-full object-contain pointer-events-none"
                    style={{ borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined }}
                  />
                )}

                {obj.type === 'shape' && (
                  <div
                    className="w-full h-full flex items-center justify-center font-semibold text-center leading-normal antialiased"
                    style={{
                      borderRadius: obj.shapeType === 'ellipse' || obj.shapeType === 'circle' ? '50%' : obj.shapeType === 'rounded-rectangle' ? '12px' : undefined,
                      backgroundColor: style.backgroundColor || accentColor,
                      color: style.fontColor || '#FFFFFF',
                      fontSize: `${fontSz}cqh`,
                      fontFamily: style.fontFamily || bodyFont,
                      textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                    }}
                  >
                    {obj.text}
                  </div>
                )}

                {obj.type === 'line' && (
                  <div className="w-full h-full flex items-center">
                    <div className="w-full" style={{ height: `${style.borderWidth || 2}px`, backgroundColor: style.borderColor || accentColor }} />
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
        <div className={`relative z-10 w-full h-full flex flex-col p-8 md:p-12 lg:p-16 ${isTitleSlide ? 'justify-center' : 'justify-start'}`}>

          {isTitleSlide ? (
            /* Title Slide Layout */
            <div className="flex flex-col justify-center h-full w-full">
              <h1 
                className="font-bold tracking-tight leading-tight text-3xl md:text-5xl lg:text-6xl mb-4 antialiased"
                style={{
                  fontFamily: titleFont,
                  color: titleColor,
                  textAlign: textAlign,
                  textShadow: isDarkBg ? '0 2px 4px rgba(0,0,0,0.7)' : 'none',
                }}
              >
                {slide.title || 'Presentation Slide'}
              </h1>

              {paragraphs.length > 0 && (
                <div 
                  className="font-normal leading-relaxed text-base md:text-2xl mt-2 antialiased"
                  style={{
                    fontFamily: bodyFont,
                    color: bodyColor,
                    textAlign: textAlign,
                    textShadow: isDarkBg ? '0 1px 3px rgba(0,0,0,0.6)' : 'none',
                  }}
                >
                  {paragraphs[0]}
                </div>
              )}

              {/* Template Buttons / Badges / Shapes */}
              {slide.elements && slide.elements.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-6">
                  {slide.elements.map((elem, eIdx) => {
                    if (elem.type === 'badge') {
                      return (
                        <span
                          key={eIdx}
                          className="inline-flex items-center justify-center font-semibold rounded px-4 py-2 text-sm shadow-md"
                          style={{
                            backgroundColor: elem.backgroundColor || accentColor,
                            color: elem.fontColor || '#FFFFFF',
                            borderRadius: elem.borderRadius ?? 6,
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
                          className="object-contain max-h-16"
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
                <div className={`border-b ${isDarkBg ? 'border-white/20' : 'border-gray-200'} pb-2 mb-4 flex items-center justify-between`}>
                  <h2 
                    className="font-bold tracking-tight text-2xl md:text-3xl lg:text-4xl antialiased"
                    style={{
                      fontFamily: titleFont,
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
                className="flex-1 flex flex-col space-y-3 overflow-hidden justify-center"
                style={{ textAlign }}
              >
                {paragraphs.map((para, pIdx) => (
                  <div 
                    key={pIdx} 
                    className={`flex items-start gap-2 ${textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start'}`}
                  >
                    {slide.bullets && slide.bullets.length > 0 && (
                      <span 
                        className="rounded-full shrink-0 w-2 h-2 mt-2.5"
                        style={{ backgroundColor: accentColor }}
                      />
                    )}
                    <p 
                      className="font-normal leading-relaxed text-base md:text-xl lg:text-2xl antialiased"
                      style={{
                        fontFamily: bodyFont,
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
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {slide.elements.map((elem, eIdx) => {
                    if (elem.type === 'badge') {
                      return (
                        <span
                          key={eIdx}
                          className="inline-flex items-center justify-center font-semibold rounded px-3 py-1.5 text-xs shadow-md"
                          style={{
                            backgroundColor: elem.backgroundColor || accentColor,
                            color: elem.fontColor || '#FFFFFF',
                            borderRadius: elem.borderRadius ?? 4,
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
