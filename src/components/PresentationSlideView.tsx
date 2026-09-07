import React from 'react';
import { Slide, SlideObject, ThemeStyles } from '../types';

interface PresentationSlideViewProps {
  slide: Slide;
  slideIndex: number;
  totalSlides?: number;
  mode?: 'thumbnail' | 'full';
  themeStyles?: ThemeStyles;
}

export const PresentationSlideView: React.FC<PresentationSlideViewProps> = ({
  slide,
  slideIndex,
  totalSlides,
  mode = 'full',
  themeStyles,
}) => {
  const isThumbnail = mode === 'thumbnail';
  
  // Clean paragraphs and bullets
  const paragraphs = React.useMemo(() => {
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
  const bgStyle: React.CSSProperties = React.useMemo(() => {
    // 1. Direct slide background URL (PPTX background or custom slide background)
    if (slide.backgroundUrl) {
      return {
        backgroundImage: `url(${slide.backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    }
    // 2. Direct slide background gradient or color
    if (slide.backgroundColor) {
      if (slide.backgroundColor.startsWith('linear-gradient') || slide.backgroundColor.startsWith('radial-gradient')) {
        return { background: slide.backgroundColor };
      }
      return { backgroundColor: slide.backgroundColor };
    }
    // 3. Fallback to active theme background image ONLY for native song/verse slides (not PPTX decks)
    if (!isPptxOrDeck && themeStyles?.backgroundImageUrl) {
      return {
        backgroundImage: `url(${themeStyles.backgroundImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
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
    // 5. Presentation default canvas
    return { backgroundColor: '#111827' };
  }, [slide.backgroundUrl, slide.backgroundColor, themeStyles, isPptxOrDeck]);

  // Determine light vs dark background
  const isDarkBg = Boolean(
    slide.backgroundUrl ||
    (!isPptxOrDeck && themeStyles?.backgroundImageUrl) ||
    (slide.backgroundColor && (slide.backgroundColor.startsWith('#0') || slide.backgroundColor.startsWith('#1') || slide.backgroundColor.startsWith('#2') || slide.backgroundColor.toLowerCase().includes('black'))) ||
    (!isPptxOrDeck && themeStyles?.backgroundColor && (themeStyles.backgroundColor.startsWith('#0') || themeStyles.backgroundColor.startsWith('#1') || themeStyles.backgroundColor.startsWith('#2') || themeStyles.backgroundColor.toLowerCase().includes('black'))) ||
    (!slide.backgroundColor && (isPptxOrDeck || !themeStyles?.backgroundColor))
  );

  const titleFont = slide.titleFontFamily || themeStyles?.fontFamily || 'Aptos, Calibri, "Segoe UI", -apple-system, sans-serif';
  const bodyFont = slide.fontFamily || themeStyles?.fontFamily || 'Aptos, Calibri, "Segoe UI", -apple-system, sans-serif';
  const titleColor = slide.titleColor || themeStyles?.fontColor || (isDarkBg ? '#FFFFFF' : '#0F172A');
  const bodyColor = slide.fontColor || themeStyles?.fontColor || (isDarkBg ? '#E2E8F0' : '#334155');
  const accentColor = slide.accentColor || slide.headerBarColor || (themeStyles as any)?.accentColor || '#3B82F6';
  const textAlign = slide.textAlign || (themeStyles?.textAlign as any) || (isTitleSlide ? 'center' : 'left');

  const getBaseDimensions = () => {
    if (slide.aspectRatioLabel?.includes('4:3') || (slide.aspectRatio && Math.abs(slide.aspectRatio - 4/3) < 0.05)) {
      return { baseWidth: 1440, baseHeight: 1080 };
    }
    if (slide.aspectRatioLabel?.includes('16:10') || (slide.aspectRatio && Math.abs(slide.aspectRatio - 16/10) < 0.05)) {
      return { baseWidth: 1920, baseHeight: 1200 };
    }
    if (slide.aspectRatioLabel?.includes('21:9') || (slide.aspectRatio && Math.abs(slide.aspectRatio - 21/9) < 0.05)) {
      return { baseWidth: 2560, baseHeight: 1080 };
    }
    if (slide.aspectRatioLabel?.includes('1:1') || (slide.aspectRatio && Math.abs(slide.aspectRatio - 1) < 0.05)) {
      return { baseWidth: 1080, baseHeight: 1080 };
    }
    if (slide.aspectRatioLabel?.includes('9:16') || (slide.aspectRatio && Math.abs(slide.aspectRatio - 9/16) < 0.05)) {
      return { baseWidth: 1080, baseHeight: 1920 };
    }
    return { baseWidth: 1920, baseHeight: 1080 };
  };

  const { baseWidth, baseHeight } = getBaseDimensions();

  const hasObjects = Array.isArray(slide.objects) && slide.objects.length > 0;

  return (
    <div 
      className="w-full h-full relative flex flex-col justify-between overflow-hidden select-none"
      style={{ ...bgStyle, containerType: 'size' }}
    >
      {/* Background Overlay */}
      {(slide.backgroundUrl || themeStyles?.backgroundImageUrl) && (
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
            height: isThumbnail ? '3px' : '8px', 
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
                    className="w-full h-full leading-relaxed break-words whitespace-pre-wrap flex flex-col"
                    style={{
                      fontFamily: style.fontFamily || titleFont,
                      fontSize: `${fontSz}cqh`,
                      color: style.fontColor || bodyColor,
                      fontWeight: style.fontWeight || 'normal',
                      fontStyle: style.fontStyle || 'normal',
                      textDecoration: style.textDecoration || 'none',
                      textAlign: style.textAlign || 'left',
                      justifyContent: style.alignVertical === 'bottom' ? 'flex-end' : style.alignVertical === 'middle' ? 'center' : 'flex-start',
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
                    className="w-full h-full flex items-center justify-center font-semibold text-center leading-normal"
                    style={{
                      borderRadius: obj.shapeType === 'ellipse' || obj.shapeType === 'circle' ? '50%' : obj.shapeType === 'rounded-rectangle' ? '12px' : undefined,
                      backgroundColor: style.backgroundColor || accentColor,
                      color: style.fontColor || '#FFFFFF',
                      fontSize: `${fontSz}cqh`,
                      fontFamily: style.fontFamily || bodyFont,
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
                  <div className="w-full h-full flex flex-col items-center justify-center bg-blue-600/20 border border-blue-400/30 rounded p-2 text-blue-200 text-center font-medium">
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
        <div className={`relative z-10 w-full h-full flex flex-col ${
          isThumbnail ? 'p-3' : 'p-8 md:p-12 lg:p-16'
        } ${isTitleSlide ? 'justify-center' : 'justify-start'}`}>

          {isTitleSlide ? (
            /* Title Slide Layout */
            <div className="flex flex-col justify-center h-full max-w-5xl w-full">
              <h1 
                className={`font-bold tracking-tight leading-tight ${
                  isThumbnail ? 'text-xs mb-1' : 'text-3xl md:text-5xl lg:text-6xl mb-4'
                }`}
                style={{
                  fontFamily: titleFont,
                  color: titleColor,
                  textAlign: textAlign,
                }}
              >
                {slide.title || 'Presentation Slide'}
              </h1>

              {paragraphs.length > 0 && (
                <div 
                  className={`font-normal leading-relaxed ${
                    isThumbnail ? 'text-[8.5px] mt-0.5' : 'text-base md:text-2xl mt-2 max-w-3xl'
                  }`}
                  style={{
                    fontFamily: bodyFont,
                    color: bodyColor,
                    textAlign: textAlign,
                  }}
                >
                  {paragraphs[0]}
                </div>
              )}

              {/* Template Buttons / Badges / Shapes */}
              {slide.elements && slide.elements.length > 0 && (
                <div className={`flex flex-wrap items-center gap-1.5 ${isThumbnail ? 'mt-1.5' : 'mt-6'}`}>
                  {slide.elements.map((elem, eIdx) => {
                    if (elem.type === 'badge') {
                      return (
                        <span
                          key={eIdx}
                          className={`inline-flex items-center justify-center font-semibold rounded ${
                            isThumbnail ? 'px-1.5 py-0.5 text-[7px]' : 'px-4 py-2 text-sm'
                          }`}
                          style={{
                            backgroundColor: elem.backgroundColor || accentColor,
                            color: elem.fontColor || '#FFFFFF',
                            borderRadius: elem.borderRadius ?? (isThumbnail ? 3 : 6),
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
                          className={`object-contain ${isThumbnail ? 'max-h-4' : 'max-h-16'}`}
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
                <div className={`border-b ${isDarkBg ? 'border-white/15' : 'border-gray-200'} pb-1.5 ${isThumbnail ? 'mb-1' : 'mb-4'} flex items-center justify-between`}>
                  <h2 
                    className={`font-bold tracking-tight truncate ${
                      isThumbnail ? 'text-[10px]' : 'text-2xl md:text-3xl lg:text-4xl'
                    }`}
                    style={{
                      fontFamily: titleFont,
                      color: titleColor,
                      textAlign: textAlign,
                    }}
                  >
                    {slide.title}
                  </h2>
                </div>
              )}

              {/* Slide Body / Bullets */}
              <div 
                className={`flex-1 flex flex-col ${isThumbnail ? 'space-y-0.5' : 'space-y-3'} overflow-hidden justify-center`}
                style={{ textAlign }}
              >
                {paragraphs.map((para, pIdx) => (
                  <div 
                    key={pIdx} 
                    className={`flex items-start gap-1.5 ${textAlign === 'center' ? 'justify-center' : textAlign === 'right' ? 'justify-end' : 'justify-start'}`}
                  >
                    {slide.bullets && slide.bullets.length > 0 && (
                      <span 
                        className={`rounded-full shrink-0 ${
                          isThumbnail ? 'w-1 h-1 mt-1' : 'w-2 h-2 mt-2.5'
                        }`}
                        style={{ backgroundColor: accentColor }}
                      />
                    )}
                    <p 
                      className={`font-normal leading-relaxed ${
                        isThumbnail ? 'text-[8px]' : 'text-sm md:text-xl'
                      }`}
                      style={{
                        fontFamily: bodyFont,
                        color: bodyColor,
                      }}
                    >
                      {para}
                    </p>
                  </div>
                ))}
              </div>

              {/* Badges / Shapes on Content Slides */}
              {slide.elements && slide.elements.length > 0 && (
                <div className={`flex flex-wrap items-center gap-1.5 ${isThumbnail ? 'mt-1' : 'mt-4'}`}>
                  {slide.elements.map((elem, eIdx) => {
                    if (elem.type === 'badge') {
                      return (
                        <span
                          key={eIdx}
                          className={`inline-flex items-center justify-center font-semibold rounded ${
                            isThumbnail ? 'px-1 py-0.5 text-[6.5px]' : 'px-3 py-1.5 text-xs'
                          }`}
                          style={{
                            backgroundColor: elem.backgroundColor || accentColor,
                            color: elem.fontColor || '#FFFFFF',
                            borderRadius: elem.borderRadius ?? (isThumbnail ? 2 : 4),
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

      {/* Slide Footer Tag for Full mode */}
      {!isThumbnail && totalSlides && totalSlides > 1 && (
        <div className={`relative z-10 px-8 py-1.5 flex items-center justify-between text-xs font-mono ${
          isDarkBg ? 'text-white/50 bg-black/20' : 'text-gray-500 bg-gray-50/80 border-t border-gray-200'
        }`}>
          <span>{slide.title || 'Slide'}</span>
          <span>{slideIndex + 1} / {totalSlides}</span>
        </div>
      )}
    </div>
  );
};
