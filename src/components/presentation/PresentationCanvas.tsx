import React from 'react';
import { RenderFrame } from '../../types';
import { ThemeEngine } from '../../core/ThemeEngine';
import { formatVerseNumber } from '../../utils/scriptureFormatter';

interface PresentationCanvasProps {
  frame: RenderFrame;
  scale?: number;
  systemOptions: any;
}

export const PresentationCanvas: React.FC<PresentationCanvasProps> = ({ frame, scale = 1, systemOptions }) => {
  const {
    activeItem,
    activeSlide,
    resolvedStyles,
    autoFitFontSize,
    hasHeader,
    headerText,
    isUpper,
    lineSpacing,
    targetWidth,
    targetHeight,
    margins
  } = frame;

  if (!activeSlide) return null;

  const isBible = activeItem?.type === 'bible';
  const isSong = activeItem?.type === 'song';

  const songOpts = systemOptions?.mainOutput?.song;
  const scriptureOpts = systemOptions?.mainOutput?.scripture;
  
  const referenceThemeStyles = isBible && scriptureOpts?.referenceFont 
    ? ThemeEngine.fontStyleToThemeStyles(scriptureOpts.referenceFont) 
    : undefined;
  const verseThemeStyles = isBible && scriptureOpts?.verseFont
    ? ThemeEngine.fontStyleToThemeStyles(scriptureOpts.verseFont)
    : undefined;
  const labelThemeStyles = isSong && songOpts?.labelFont 
    ? ThemeEngine.fontStyleToThemeStyles(songOpts.labelFont) 
    : undefined;
  const copyrightThemeStyles = isSong && songOpts?.copyrightFont 
    ? ThemeEngine.fontStyleToThemeStyles(songOpts.copyrightFont) 
    : undefined;

  const referenceCss = referenceThemeStyles ? ThemeEngine.getTextStyle(referenceThemeStyles, 1) : {};
  const verseCss = verseThemeStyles ? ThemeEngine.getTextStyle(verseThemeStyles, 1) : {};
  const labelCss = labelThemeStyles ? ThemeEngine.getTextStyle(labelThemeStyles, 1) : {};
  const copyrightCss = copyrightThemeStyles ? ThemeEngine.getTextStyle(copyrightThemeStyles, 1) : {};

  const showCopyright = isSong && songOpts?.displayCopyrightInfo && activeItem?.data?.copyright;

  const refLocation = scriptureOpts?.referenceLocation || 'Before Each Slide';
  const songLabelLoc = songOpts?.verseChorusLabelLocation || 'Header';

  const formatSongLabel = (title: string) => {
    if (!title) return '';
    const parts = title.split(':');
    return parts[0].trim();
  };

  const containerAlignmentStyle = ThemeEngine.getContainerAlignmentStyle(resolvedStyles, margins);
  const cardStyle = ThemeEngine.getCardStyle(resolvedStyles);

  return (
    <div 
      className="absolute inset-0 z-10 w-full h-full"
      style={{
        ...containerAlignmentStyle,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: `${targetWidth}px`,
        height: `${targetHeight}px`
      }}
    >
      <div 
        className={cardStyle.className}
        style={cardStyle.style}
      >
        {/* Header */}
        {hasHeader && (
          <h2 
            className="mb-4 text-cyan-300 font-bold tracking-wider opacity-90 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] max-w-full"
            style={{
              ...(isBible && referenceThemeStyles ? referenceCss : (labelThemeStyles ? labelCss : {})),
              fontSize: (isBible && referenceThemeStyles?.fontSize)
                ? `${referenceThemeStyles.fontSize}px`
                : (labelThemeStyles?.fontSize ? `${labelThemeStyles.fontSize}px` : '32px'),
              fontFamily: (isBible && referenceThemeStyles?.fontFamily)
                ? referenceThemeStyles.fontFamily
                : (labelThemeStyles?.fontFamily || resolvedStyles.fontFamily),
              textAlign: (isBible && referenceThemeStyles?.textAlign)
                ? referenceThemeStyles.textAlign
                : (resolvedStyles.textAlign || 'center'),
            }}
          >
            {isSong ? formatSongLabel(headerText) : headerText}
          </h2>
        )}

        {/* Main Text */}
        <div 
          className="whitespace-pre-line font-bold max-w-full leading-snug drop-shadow-[0_2px_12px_rgba(0,0,0,0.95)]"
          style={{
            ...ThemeEngine.getTextStyle(resolvedStyles, 1),
            fontSize: `${autoFitFontSize}px`,
            textTransform: isUpper ? 'uppercase' : undefined,
            lineHeight: lineSpacing,
          }}
        >
          {isBible && activeSlide.verses && activeSlide.verses.length > 0 ? (
            activeSlide.verses.map((v, idx) => (
              <span key={v.verse} className="inline">
                {(scriptureOpts?.showVerseNumbers ?? true) && (
                  <span 
                    className="inline-block mr-3 select-none transition-colors"
                    style={{ 
                      ...verseCss,
                      color: scriptureOpts?.verseLabelColor || verseThemeStyles?.fontColor || scriptureOpts?.verseFont?.color || scriptureOpts?.verseColor || '#F6E05E',
                      fontFamily: verseThemeStyles?.fontFamily || scriptureOpts?.verseFont?.family || scriptureOpts?.scriptureFont?.family || resolvedStyles.fontFamily || 'Tahoma, sans-serif',
                      fontSize: verseThemeStyles?.fontSize ? `${verseThemeStyles.fontSize}px` : `${Math.max(14, autoFitFontSize * 0.85)}px`,
                      fontWeight: verseThemeStyles?.fontWeight || (scriptureOpts?.verseFont?.bold ? '700' : '400'),
                      fontStyle: verseThemeStyles?.fontStyle || (scriptureOpts?.verseFont?.italic ? 'italic' : 'normal'),
                      textDecoration: verseThemeStyles?.textDecoration || (scriptureOpts?.verseFont?.underline ? 'underline' : 'none'),
                    }}
                  >
                    {formatVerseNumber(v.verse, scriptureOpts?.verseNumberStyle)}
                  </span>
                )}
                <span>{v.text}</span>
                {idx < activeSlide.verses!.length - 1 && '  '}
              </span>
            ))
          ) : (
            activeSlide.text
          )}
        </div>

        {/* Footer Reference (After Each Slide) */}
        {isBible && scriptureOpts?.showReference && refLocation === 'After Each Slide' && headerText && (
          <div 
            className="mt-6 pt-2 font-bold max-w-full opacity-90"
            style={{
              ...referenceCss,
              fontSize: referenceThemeStyles?.fontSize ? `${referenceThemeStyles.fontSize}px` : '32px',
              fontFamily: referenceThemeStyles?.fontFamily || resolvedStyles.fontFamily,
              textAlign: referenceThemeStyles?.textAlign || (resolvedStyles.textAlign === 'left' ? 'left' : resolvedStyles.textAlign === 'right' ? 'right' : 'center'),
            }}
          >
            {headerText}
          </div>
        )}

        {/* Top Left Reference */}
        {isBible && scriptureOpts?.showReference && refLocation === 'Top Left' && headerText && (
          <div 
            className="absolute top-10 left-10 max-w-xl z-50 text-left opacity-90 font-bold"
            style={{
              ...referenceCss,
              fontSize: referenceThemeStyles?.fontSize ? `${referenceThemeStyles.fontSize}px` : '32px',
              fontFamily: referenceThemeStyles?.fontFamily || resolvedStyles.fontFamily,
            }}
          >
            {headerText}
          </div>
        )}

        {/* Top Right Reference */}
        {isBible && scriptureOpts?.showReference && refLocation === 'Top Right' && headerText && (
          <div 
            className="absolute top-10 right-10 max-w-xl z-50 text-right opacity-90 font-bold"
            style={{
              ...referenceCss,
              fontSize: referenceThemeStyles?.fontSize ? `${referenceThemeStyles.fontSize}px` : '32px',
              fontFamily: referenceThemeStyles?.fontFamily || resolvedStyles.fontFamily,
            }}
          >
            {headerText}
          </div>
        )}

        {/* Bottom Left Reference */}
        {isBible && scriptureOpts?.showReference && refLocation === 'Bottom Left' && headerText && (
          <div 
            className="absolute bottom-10 left-10 max-w-xl z-50 text-left opacity-90 font-bold"
            style={{
              ...referenceCss,
              fontSize: referenceThemeStyles?.fontSize ? `${referenceThemeStyles.fontSize}px` : '32px',
              fontFamily: referenceThemeStyles?.fontFamily || resolvedStyles.fontFamily,
            }}
          >
            {headerText}
          </div>
        )}

        {/* Bottom Right Reference */}
        {isBible && scriptureOpts?.showReference && refLocation === 'Bottom Right' && headerText && (
          <div 
            className="absolute bottom-10 right-10 max-w-xl z-50 text-right opacity-90 font-bold"
            style={{
              ...referenceCss,
              fontSize: referenceThemeStyles?.fontSize ? `${referenceThemeStyles.fontSize}px` : '32px',
              fontFamily: referenceThemeStyles?.fontFamily || resolvedStyles.fontFamily,
            }}
          >
            {headerText}
          </div>
        )}

        {/* Translation Badge */}
        {isBible && scriptureOpts?.displayTranslationBadge && activeItem?.data?.translation && (
          <div className="absolute top-8 right-8 z-50">
            <span className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 text-white/90 text-sm font-bold tracking-wider shadow-lg">
              {activeItem.data.translation}
            </span>
          </div>
        )}

        {/* Song Copyright */}
        {showCopyright && (
          <div 
            className="absolute bottom-6 w-full px-12 text-center flex flex-col gap-1 z-20 opacity-85"
            style={{
              ...copyrightCss,
              fontSize: copyrightThemeStyles?.fontSize ? `${copyrightThemeStyles.fontSize}px` : '18px',
              fontFamily: copyrightThemeStyles?.fontFamily || resolvedStyles.fontFamily,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <div className="max-w-4xl mx-auto break-words leading-tight flex items-center justify-center gap-2">
              <span className="opacity-80">©</span> 
              <span>{activeItem.data.copyright}</span>
            </div>
            {activeItem.data.ccli && (
              <div className="max-w-4xl mx-auto opacity-75 text-sm flex items-center gap-1.5 justify-center">
                <span className="font-semibold text-xs tracking-widest uppercase">CCLI</span>
                <span>{activeItem.data.ccli}</span>
              </div>
            )}
          </div>
        )}

        {/* Song Label Footer */}
        {isSong && songOpts?.showVerseChorusLabel && songLabelLoc === 'Footer' && headerText && (
          <div 
            className="mt-6 pt-2 font-bold max-w-full opacity-90 text-cyan-300"
            style={{
              ...labelCss,
              fontSize: labelThemeStyles?.fontSize ? `${labelThemeStyles.fontSize}px` : '32px',
              fontFamily: labelThemeStyles?.fontFamily || resolvedStyles.fontFamily,
              textAlign: labelThemeStyles?.textAlign || resolvedStyles.textAlign || 'center',
            }}
          >
            {formatSongLabel(headerText)}
          </div>
        )}
      </div>
    </div>
  );
};
