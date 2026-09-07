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
  
  const referenceStyles = isBible ? scriptureOpts?.referenceFont : undefined;
  const labelStyles = isSong ? songOpts?.labelFont : undefined;
  const copyrightStyles = isSong ? songOpts?.copyrightFont : undefined;

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
              ...(isBible && referenceStyles
                ? ThemeEngine.getTextStyle(referenceStyles, 1)
                : (labelStyles ? ThemeEngine.getTextStyle(labelStyles, 1) : {})),
              fontSize: (isBible && referenceStyles?.fontSize)
                ? `${referenceStyles.fontSize}px`
                : (labelStyles?.fontSize ? `${labelStyles.fontSize}px` : '32px'),
              fontFamily: (isBible && referenceStyles?.fontFamily)
                ? referenceStyles.fontFamily
                : (labelStyles?.fontFamily || resolvedStyles.fontFamily),
              textAlign: resolvedStyles.textAlign || 'center',
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
                    className="font-bold inline-block mr-3 select-none transition-colors"
                    style={{ 
                      color: scriptureOpts?.verseFont?.color || scriptureOpts?.verseColor || '#F6E05E',
                      fontFamily: scriptureOpts?.verseFont?.family || scriptureOpts?.scriptureFont?.family || resolvedStyles.fontFamily || 'Tahoma, sans-serif',
                      fontSize: `${Math.max(14, autoFitFontSize * 0.85)}px`
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

        {/* Footer Reference */}
        {isBible && scriptureOpts?.showReference && refLocation === 'After Each Slide' && headerText && (
          <div 
            className="mt-6 pt-2 font-bold max-w-full opacity-90"
            style={{
              ...(referenceStyles ? ThemeEngine.getTextStyle(referenceStyles, 1) : { color: '#E2E8F0', fontWeight: '700' }),
              fontSize: referenceStyles?.fontSize ? `${referenceStyles.fontSize}px` : '32px',
              fontFamily: referenceStyles?.fontFamily || resolvedStyles.fontFamily,
              textAlign: resolvedStyles.textAlign === 'left' ? 'left' : resolvedStyles.textAlign === 'right' ? 'right' : 'center',
            }}
          >
            {headerText}
          </div>
        )}

        {/* Corner Reference */}
        {isBible && scriptureOpts?.showReference && refLocation === 'Bottom Right' && headerText && (
          <div 
            className="absolute bottom-12 right-12 max-w-lg z-50 text-right opacity-90 font-bold"
            style={{
              ...(referenceStyles ? ThemeEngine.getTextStyle(referenceStyles, 1) : { color: '#E2E8F0', fontWeight: '700' }),
              fontSize: referenceStyles?.fontSize ? `${referenceStyles.fontSize}px` : '32px',
              fontFamily: referenceStyles?.fontFamily || resolvedStyles.fontFamily,
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
              ...(copyrightStyles ? ThemeEngine.getTextStyle(copyrightStyles, 1) : { color: '#E2E8F0', fontWeight: '500' }),
              fontSize: copyrightStyles?.fontSize ? `${copyrightStyles.fontSize}px` : '18px',
              fontFamily: copyrightStyles?.fontFamily || resolvedStyles.fontFamily,
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
              ...(labelStyles ? ThemeEngine.getTextStyle(labelStyles, 1) : {}),
              fontSize: labelStyles?.fontSize ? `${labelStyles.fontSize}px` : '32px',
              fontFamily: labelStyles?.fontFamily || resolvedStyles.fontFamily,
              textAlign: resolvedStyles.textAlign || 'center',
            }}
          >
            {formatSongLabel(headerText)}
          </div>
        )}
      </div>
    </div>
  );
};
