import React, { useState, useRef, useEffect } from 'react';
import { Monitor } from 'lucide-react';
import { SystemOptions } from '../../types';
import { ThemeEngine } from '../../core/ThemeEngine';
import { formatScriptureReference, formatVerseNumber } from '../../utils/scriptureFormatter';

interface ScriptureLivePreviewProps {
  generalOptions: SystemOptions['mainOutput']['general'];
  scriptureOptions: SystemOptions['mainOutput']['scripture'];
  onUpdateGeneral?: (updates: Partial<SystemOptions['mainOutput']['general']>) => void;
  onUpdateScripture?: (updates: Partial<SystemOptions['mainOutput']['scripture']>) => void;
  onUpdateBackdrop?: (bgGradient: string) => void;
}

interface SamplePassage {
  id: string;
  label: string;
  book: string;
  chapter: number;
  translation: string;
  verses: Array<{ verse: number; text: string }>;
}

const SAMPLE_PASSAGES: SamplePassage[] = [
  {
    id: 'john-3-16',
    label: 'John 3:16 (KJV)',
    book: 'John',
    chapter: 3,
    translation: 'KJV',
    verses: [
      {
        verse: 16,
        text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'
      }
    ]
  },
  {
    id: 'psalm-23',
    label: 'Psalm 23:1-2 (KJV)',
    book: 'Psalms',
    chapter: 23,
    translation: 'KJV',
    verses: [
      { verse: 1, text: 'The LORD is my shepherd; I shall not want.' },
      { verse: 2, text: 'He maketh me to lie down in green pastures: he leadeth me beside the still waters.' }
    ]
  },
  {
    id: 'romans-8-28',
    label: 'Romans 8:28 (KJV)',
    book: 'Romans',
    chapter: 8,
    translation: 'KJV',
    verses: [
      {
        verse: 28,
        text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.'
      }
    ]
  },
  {
    id: 'genesis-1-1',
    label: 'Genesis 1:1-3 (KJV)',
    book: 'Genesis',
    chapter: 1,
    translation: 'KJV',
    verses: [
      { verse: 1, text: 'In the beginning God created the heaven and the earth.' },
      { verse: 2, text: 'And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.' },
      { verse: 3, text: 'And God said, Let there be light: and there was light.' }
    ]
  }
];

const PREVIEW_BACKGROUNDS = [
  {
    id: 'nebula',
    name: 'Nebula Glow',
    gradient: 'linear-gradient(135deg, #090c1f 0%, #151a3a 50%, #080914 100%)',
    overlay: 'rgba(0, 0, 0, 0.4)'
  },
  {
    id: 'deep-blue',
    name: 'Midnight Blue',
    gradient: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
    overlay: 'rgba(0, 0, 0, 0.2)'
  },
  {
    id: 'worship-warm',
    name: 'Atmosphere Gold',
    gradient: 'linear-gradient(135deg, #1c1409 0%, #291d0c 50%, #0a0805 100%)',
    overlay: 'rgba(0, 0, 0, 0.35)'
  },
  {
    id: 'pure-black',
    name: 'True Blackout',
    gradient: '#000000',
    overlay: 'rgba(0, 0, 0, 0)'
  }
];

const RESOLUTION_PRESETS = [
  { label: '16:9 Full HD (1920 × 1080)', width: 1920, height: 1080, ratio: '16:9' },
  { label: '16:9 HD (1366 × 768)', width: 1366, height: 768, ratio: '16:9' },
  { label: '16:9 HD (1280 × 720)', width: 1280, height: 720, ratio: '16:9' },
  { label: '16:9 4K UHD (3840 × 2160)', width: 3840, height: 2160, ratio: '16:9' },
  { label: '4:3 Standard Projector (1024 × 768)', width: 1024, height: 768, ratio: '4:3' },
  { label: '16:10 WUXGA (1920 × 1200)', width: 1920, height: 1200, ratio: '16:10' }
];

export default function ScriptureLivePreview({
  generalOptions,
  scriptureOptions,
  onUpdateGeneral,
  onUpdateScripture,
  onUpdateBackdrop
}: ScriptureLivePreviewProps) {
  const [selectedPassageId, setSelectedPassageId] = useState<string>('john-3-16');
  const [activeBgIndex, setActiveBgIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(0.3);

  const width = generalOptions?.position?.width || 1920;
  const height = generalOptions?.position?.height || 1080;
  const rawRatio = width / height;

  useEffect(() => {
    const updateScale = () => {
      if (containerRef.current) {
        const currentWidth = containerRef.current.clientWidth;
        setScale(currentWidth / width);
      }
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [width]);

  let ratioBadge = '16:9';
  if (Math.abs(rawRatio - 16 / 9) < 0.05) {
    ratioBadge = '16:9';
  } else if (Math.abs(rawRatio - 4 / 3) < 0.05) {
    ratioBadge = '4:3';
  } else if (Math.abs(rawRatio - 16 / 10) < 0.05) {
    ratioBadge = '16:10';
  } else if (Math.abs(rawRatio - 21 / 9) < 0.05) {
    ratioBadge = '21:9';
  } else {
    ratioBadge = `${width}:${height}`;
  }

  const selectedPassage = SAMPLE_PASSAGES.find(p => p.id === selectedPassageId) || SAMPLE_PASSAGES[0];
  const activeBg = PREVIEW_BACKGROUNDS[activeBgIndex] || PREVIEW_BACKGROUNDS[0];

  const scriptureThemeStyles = ThemeEngine.fontStyleToThemeStyles(scriptureOptions?.scriptureFont);
  const referenceThemeStyles = ThemeEngine.fontStyleToThemeStyles(scriptureOptions?.referenceFont);
  const verseThemeStyles = ThemeEngine.fontStyleToThemeStyles(scriptureOptions?.verseFont);

  const referenceTitle = formatScriptureReference({
    book: selectedPassage.book,
    chapter: selectedPassage.chapter,
    verses: selectedPassage.verses,
    translation: selectedPassage.translation,
    options: scriptureOptions
  });

  const margins = scriptureOptions?.margins
    ? scriptureOptions.margins
    : (generalOptions?.margins || { left: 0, top: 0, right: 0, bottom: 0 });

  const showReference = scriptureOptions?.showReference ?? true;
  const refLocation = scriptureOptions?.referenceLocation || 'After Each Slide';
  const showVerseNumbers = scriptureOptions?.showVerseNumbers ?? true;
  const verseNumberStyle = scriptureOptions?.verseNumberStyle || 'superscript';
  const verseColor = scriptureOptions?.verseLabelColor || scriptureOptions?.verseFont?.color || scriptureOptions?.verseColor || '#F6E05E';

  return (
    <div className="bg-[#12141a] border border-[#2d3240] rounded-xl p-3.5 space-y-3 shadow-2xl">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#252a36] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span className="font-bold text-gray-100 text-xs flex items-center gap-1.5">
            <Monitor size={14} className="text-cyan-400" />
            Live Scripture Output Preview
          </span>
          <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-mono text-[10px] font-bold">
            {ratioBadge} Widescreen ({width} × {height})
          </span>
        </div>

        {/* Resolution Switcher */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-gray-400">Resolution:</span>
          <select
            value={`${width}x${height}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split('x').map(Number);
              if (w && h && onUpdateGeneral) {
                onUpdateGeneral({
                  position: {
                    ...generalOptions.position,
                    width: w,
                    height: h
                  }
                });
              }
            }}
            className="bg-[#1a1d26] border border-[#3e4454] text-gray-200 rounded px-2 py-1 text-xs focus:border-cyan-500 outline-none cursor-pointer"
          >
            {RESOLUTION_PRESETS.map(res => (
              <option key={`${res.width}x${res.height}`} value={`${res.width}x${res.height}`}>
                {res.label}
              </option>
            ))}
            {!RESOLUTION_PRESETS.some(r => r.width === width && r.height === height) && (
              <option value={`${width}x${height}`}>
                Custom: {width} × {height} ({ratioBadge})
              </option>
            )}
          </select>
        </div>
      </div>

      {/* Interactive Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-[#171922] p-2 rounded-lg border border-[#2b303d]">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400 font-medium">Sample Scripture:</span>
          <div className="flex items-center gap-1">
            {SAMPLE_PASSAGES.map(passage => (
              <button
                key={passage.id}
                type="button"
                onClick={() => setSelectedPassageId(passage.id)}
                className={`px-2 py-0.5 rounded text-[10.5px] transition-all ${
                  selectedPassageId === passage.id
                    ? 'bg-blue-600 text-white font-bold shadow'
                    : 'bg-[#222632] hover:bg-[#2e3444] text-gray-300'
                }`}
              >
                {passage.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-gray-400 font-medium">Stage Backdrop:</span>
          <div className="flex items-center gap-1">
            {PREVIEW_BACKGROUNDS.map((bg, idx) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => {
                  setActiveBgIndex(idx);
                  if (onUpdateBackdrop) {
                    onUpdateBackdrop(bg.gradient);
                  }
                }}
                title={bg.name}
                className={`px-2 py-0.5 rounded text-[10.5px] transition-all flex items-center gap-1 ${
                  activeBgIndex === idx
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'bg-[#222632] hover:bg-[#2e3444] text-gray-300'
                }`}
              >
                <span>{bg.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Monitor Stage Frame */}
      <div className="relative w-full max-w-2xl mx-auto rounded-xl bg-black/90 p-2 shadow-2xl border border-cyan-500/20">
        <div className="flex items-center justify-between text-[10px] text-gray-400 px-2 pb-1.5 select-none">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="font-semibold text-gray-300">Projector Canvas #{generalOptions?.outputMonitor || 'Main'}</span>
          </div>
          <div className="font-mono text-cyan-400/90 font-bold">
            {ratioBadge} • {width} × {height} px
          </div>
        </div>

        <div 
          ref={containerRef}
          className="relative w-full rounded-lg overflow-hidden border border-white/10 select-none bg-black"
          style={{ aspectRatio: `${width} / ${height}` }}
        >
          <div
            data-canvas-preview="true"
            className="absolute top-0 left-0 origin-top-left overflow-hidden flex flex-col justify-between select-none pointer-events-none projector-canvas"
            style={{
              width: `${width}px`,
              height: `${height}px`,
              transform: `scale(${scale})`,
              background: activeBg.gradient,
              paddingLeft: `${margins?.left !== undefined ? margins.left : 40}px`,
              paddingRight: `${margins?.right !== undefined ? margins.right : 40}px`,
              paddingTop: `${margins?.top !== undefined ? margins.top : 30}px`,
              paddingBottom: `${margins?.bottom !== undefined ? margins.bottom : 30}px`,
            }}
          >
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{ backgroundColor: activeBg.overlay }}
            />

            {showReference && referenceTitle && (
              <>
                {refLocation === 'Top Right' && (
                  <div 
                    className="absolute top-8 right-10 z-20 px-5 py-2 rounded-lg bg-black/55 backdrop-blur-md border border-white/15 drop-shadow-xl font-bold"
                    style={{
                      ...ThemeEngine.getTextStyle(referenceThemeStyles, 1),
                      fontSize: referenceThemeStyles.fontSize ? `${referenceThemeStyles.fontSize}px` : '32px',
                      color: referenceThemeStyles.fontColor || '#E2E8F0',
                    }}
                  >
                    {referenceTitle}
                  </div>
                )}
                {refLocation === 'Top Left' && (
                  <div 
                    className="absolute top-8 left-10 z-20 px-5 py-2 rounded-lg bg-black/55 backdrop-blur-md border border-white/15 drop-shadow-xl font-bold"
                    style={{
                      ...ThemeEngine.getTextStyle(referenceThemeStyles, 1),
                      fontSize: referenceThemeStyles.fontSize ? `${referenceThemeStyles.fontSize}px` : '32px',
                      color: referenceThemeStyles.fontColor || '#E2E8F0',
                    }}
                  >
                    {referenceTitle}
                  </div>
                )}
              </>
            )}

            {showReference && refLocation === 'Before Each Slide' && referenceTitle && (
              <div 
                className="relative z-10 text-center font-bold uppercase tracking-wider mb-4 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] max-w-full"
                style={{
                  ...ThemeEngine.getTextStyle(referenceThemeStyles, 1),
                  fontSize: referenceThemeStyles.fontSize ? `${referenceThemeStyles.fontSize}px` : '36px',
                  color: referenceThemeStyles.fontColor || '#67E8F9',
                  textAlign: (referenceThemeStyles.textAlign as any) || 'center',
                }}
              >
                {referenceTitle}
              </div>
            )}

            {(() => {
              const rawCombinedText = selectedPassage.verses.map(v => v.text).join(' ');
              const autoFitSize = ThemeEngine.calculateAutoFitFontSize({
                text: rawCombinedText,
                baseFontSize: ThemeEngine.normalizeFontSize(scriptureThemeStyles.fontSize || scriptureOptions?.scriptureFont?.maxSize),
                fontFamily: scriptureThemeStyles.fontFamily,
                fontWeight: scriptureThemeStyles.fontWeight || (scriptureOptions?.scriptureFont?.bold ? '700' : '400'),
                fontStyle: scriptureThemeStyles.fontStyle || (scriptureOptions?.scriptureFont?.italic ? 'italic' : 'normal'),
                hasHeader: showReference && refLocation === 'Before Each Slide',
                hasFooter: showReference && refLocation === 'After Each Slide',
                scale: 1,
                minFontSize: scriptureOptions?.minFontSize || 24,
                maxFontSize: 160,
                isUppercase: scriptureOptions?.scriptureFont?.casing === 'uppercase' || scriptureThemeStyles.textTransform === 'uppercase',
                lineSpacing: scriptureOptions?.lineSpacing || scriptureOptions?.scriptureFont?.lineSpacing || scriptureThemeStyles.lineHeight || 1.35,
                widthPercent: scriptureThemeStyles.widthPercent,
                margins: margins,
                containerWidth: width,
                containerHeight: height,
              });

              return (
                <div className="relative z-10 my-auto flex flex-col justify-center items-center w-full px-6 py-2 overflow-hidden">
                  <div 
                    className="font-bold leading-snug max-w-full drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] whitespace-pre-line"
                    style={{
                      ...ThemeEngine.getTextStyle(scriptureThemeStyles, 1),
                      fontSize: `${autoFitSize}px`,
                      lineHeight: scriptureOptions?.lineSpacing || scriptureOptions?.scriptureFont?.lineSpacing || 1.35,
                      fontFamily: scriptureThemeStyles.fontFamily || 'Tahoma, sans-serif',
                      textAlign: (scriptureThemeStyles.textAlign as any) || 'center',
                      color: scriptureThemeStyles.fontColor || '#FFFFFF',
                      textTransform: scriptureOptions?.scriptureFont?.casing === 'uppercase' ? 'uppercase' : undefined,
                      fontWeight: scriptureThemeStyles.fontWeight || (scriptureOptions?.scriptureFont?.bold ? '700' : '400'),
                      fontStyle: scriptureThemeStyles.fontStyle || (scriptureOptions?.scriptureFont?.italic ? 'italic' : 'normal'),
                      textDecoration: scriptureThemeStyles.textDecoration || (scriptureOptions?.scriptureFont?.underline ? 'underline' : 'none'),
                    }}
                  >
                    {selectedPassage.verses.map((v, idx) => {
                      const isSuper = verseNumberStyle === 'superscript';
                      return (
                        <span key={v.verse} className="inline">
                          {showVerseNumbers && (
                            <span 
                              className={`inline-block select-none transition-colors ${isSuper ? 'mr-1.5 align-super' : 'mr-2.5'}`}
                              style={{ 
                                color: verseColor,
                                fontFamily: scriptureOptions?.verseFont?.family || scriptureOptions?.scriptureFont?.family || 'Tahoma, sans-serif',
                                fontSize: verseThemeStyles?.fontSize 
                                  ? `${verseThemeStyles.fontSize}px` 
                                  : isSuper 
                                    ? `${Math.max(12, Math.round(autoFitSize * 0.72))}px` 
                                    : `${Math.max(14, Math.round(autoFitSize * 0.85))}px`,
                                fontWeight: verseThemeStyles?.fontWeight || (scriptureOptions?.verseFont?.bold ? '700' : '400'),
                                fontStyle: verseThemeStyles?.fontStyle || (scriptureOptions?.verseFont?.italic ? 'italic' : 'normal'),
                                textDecoration: verseThemeStyles?.textDecoration || (scriptureOptions?.verseFont?.underline ? 'underline' : 'none'),
                                verticalAlign: isSuper ? 'super' : 'baseline',
                                lineHeight: 1,
                              }}
                            >
                              {formatVerseNumber(v.verse, verseNumberStyle)}
                            </span>
                          )}
                          <span>{v.text}</span>
                          {idx < selectedPassage.verses.length - 1 && ' '}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {showReference && refLocation === 'After Each Slide' && referenceTitle && (
              <div 
                className="relative z-10 font-bold max-w-full pt-2 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]"
                style={{
                  ...ThemeEngine.getTextStyle(referenceThemeStyles, 1),
                  fontSize: referenceThemeStyles.fontSize ? `${referenceThemeStyles.fontSize}px` : '32px',
                  color: referenceThemeStyles.fontColor || '#E2E8F0',
                  textAlign: (referenceThemeStyles.textAlign as any) || 'right',
                }}
              >
                {referenceTitle}
              </div>
            )}

            {showReference && referenceTitle && (
              <>
                {refLocation === 'Bottom Right' && (
                  <div 
                    className="absolute bottom-8 right-10 z-20 px-5 py-2 rounded-lg bg-black/55 backdrop-blur-md border border-white/15 drop-shadow-xl font-bold"
                    style={{
                      ...ThemeEngine.getTextStyle(referenceThemeStyles, 1),
                      fontSize: referenceThemeStyles.fontSize ? `${referenceThemeStyles.fontSize}px` : '32px',
                      color: referenceThemeStyles.fontColor || '#E2E8F0',
                    }}
                  >
                    {referenceTitle}
                  </div>
                )}
                {refLocation === 'Bottom Left' && (
                  <div 
                    className="absolute bottom-8 left-10 z-20 px-5 py-2 rounded-lg bg-black/55 backdrop-blur-md border border-white/15 drop-shadow-xl font-bold"
                    style={{
                      ...ThemeEngine.getTextStyle(referenceThemeStyles, 1),
                      fontSize: referenceThemeStyles.fontSize ? `${referenceThemeStyles.fontSize}px` : '32px',
                      color: referenceThemeStyles.fontColor || '#E2E8F0',
                    }}
                  >
                    {referenceTitle}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div className="w-16 h-1 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent mx-auto mt-2 rounded-full" />
      </div>
    </div>
  );
}
