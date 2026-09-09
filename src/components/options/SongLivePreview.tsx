import React, { useState, useRef, useEffect } from 'react';
import { Music, Monitor } from 'lucide-react';
import { SystemOptions } from '../../types';
import { ThemeEngine } from '../../core/ThemeEngine';

interface SongLivePreviewProps {
  generalOptions: SystemOptions['mainOutput']['general'];
  songOptions: SystemOptions['mainOutput']['song'];
  onUpdateGeneral?: (updates: Partial<SystemOptions['mainOutput']['general']>) => void;
  onUpdateSong?: (updates: Partial<SystemOptions['mainOutput']['song']>) => void;
  onUpdateBackdrop?: (bgGradient: string) => void;
}

interface SampleSongSlide {
  label: string;
  lines: string[];
}

interface SampleSong {
  id: string;
  title: string;
  author: string;
  ccliNumber: string;
  slides: SampleSongSlide[];
}

const SAMPLE_SONGS: SampleSong[] = [
  {
    id: 'amazing-grace',
    title: 'Amazing Grace',
    author: 'John Newton',
    ccliNumber: 'CCLI #27145',
    slides: [
      {
        label: 'Verse 1',
        lines: [
          'Amazing grace, how sweet the sound',
          'That saved a wretch like me!',
          'I once was lost, but now am found,',
          'Was blind, but now I see.'
        ]
      },
      {
        label: 'Verse 2',
        lines: [
          '\'Twas grace that taught my heart to fear,',
          'And grace my fears relieved;',
          'How precious did that grace appear',
          'The hour I first believed!'
        ]
      }
    ]
  },
  {
    id: '10000-reasons',
    title: '10,000 Reasons (Bless The Lord)',
    author: 'Jonas Myrin, Matt Redman',
    ccliNumber: 'CCLI #6016351',
    slides: [
      {
        label: 'Chorus',
        lines: [
          'Bless the Lord, O my soul, O my soul,',
          'Worship His holy name.',
          'Sing like never before, O my soul,',
          'I\'ll worship Your holy name.'
        ]
      },
      {
        label: 'Verse 1',
        lines: [
          'The sun comes up, it\'s a new day dawning;',
          'It\'s time to sing Your song again.',
          'Whatever may pass, and whatever lies before me,',
          'Let me be singing when the evening comes.'
        ]
      },
      {
        label: 'Bridge',
        lines: [
          'And on that day when my strength is failing,',
          'The end draws near and my time has come;',
          'Still my soul will sing Your praise unending,',
          'Ten thousand years and then forevermore!'
        ]
      }
    ]
  },
  {
    id: 'how-great-is-our-god',
    title: 'How Great Is Our God',
    author: 'Chris Tomlin, Ed Cash, Jesse Reeves',
    ccliNumber: 'CCLI #4348399',
    slides: [
      {
        label: 'Chorus',
        lines: [
          'How great is our God! Sing with me,',
          'How great is our God! And all will see',
          'How great, how great is our God!'
        ]
      },
      {
        label: 'Verse 1',
        lines: [
          'The splendor of a King, clothed in majesty;',
          'Let all the earth rejoice, all the earth rejoice.',
          'He wraps Himself in light, and darkness tries to hide,',
          'And trembles at His voice, and trembles at His voice.'
        ]
      }
    ]
  },
  {
    id: 'tanging-alay',
    title: 'Tanging Alay (Tagalog Worship)',
    author: 'Traditional Filipino Worship',
    ccliNumber: 'Public Domain',
    slides: [
      {
        label: 'Verse 1',
        lines: [
          'Salamat sa Iyo, aming Panginoong Hesus',
          'Ako\'y inibig Mo, at inangking lubos.',
          'Ang tanging alay ko sa Iyo ay ang buhay ko',
          'Ito lamang Ama, wala nang iba pa akong maihahandog.'
        ]
      },
      {
        label: 'Koro',
        lines: [
          'Di ko akalain na ako ay bibigyang pansin',
          'Ang taong tulad ko\'y di dapat mahalin',
          'Salamat sa Iyo, O Hesus!'
        ]
      }
    ]
  }
];

const PREVIEW_BACKGROUNDS = [
  {
    id: 'deep-worship',
    name: 'Nebula Glow',
    gradient: 'linear-gradient(135deg, #0a0e27 0%, #171d45 50%, #060815 100%)',
    overlay: 'rgba(0, 0, 0, 0.4)'
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    gradient: 'linear-gradient(180deg, #0f172a 0%, #020617 100%)',
    overlay: 'rgba(0, 0, 0, 0.25)'
  },
  {
    id: 'warm-amber',
    name: 'Atmosphere Gold',
    gradient: 'linear-gradient(135deg, #1f1406 0%, #2b1d09 50%, #0d0903 100%)',
    overlay: 'rgba(0, 0, 0, 0.35)'
  },
  {
    id: 'royal-purple',
    name: 'Royal Majesty',
    gradient: 'linear-gradient(135deg, #180926 0%, #25103d 50%, #0b0413 100%)',
    overlay: 'rgba(0, 0, 0, 0.3)'
  },
  {
    id: 'blackout',
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

export default function SongLivePreview({
  generalOptions,
  songOptions,
  onUpdateGeneral,
  onUpdateSong,
  onUpdateBackdrop
}: SongLivePreviewProps) {
  const [selectedSongId, setSelectedSongId] = useState<string>('amazing-grace');
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [activeBgIndex, setActiveBgIndex] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(0.3);

  // Dynamic Output Aspect Ratio & Dimensions
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

  const selectedSong = SAMPLE_SONGS.find(s => s.id === selectedSongId) || SAMPLE_SONGS[0];
  const activeBg = PREVIEW_BACKGROUNDS[activeBgIndex] || PREVIEW_BACKGROUNDS[0];

  const validSlideIndex = Math.min(activeSlideIndex, selectedSong.slides.length - 1);
  const currentSlide = selectedSong.slides[validSlideIndex] || selectedSong.slides[0];

  const songThemeStyles = ThemeEngine.fontStyleToThemeStyles(songOptions?.songFont);
  const labelThemeStyles = ThemeEngine.fontStyleToThemeStyles(songOptions?.labelFont);
  const copyrightThemeStyles = ThemeEngine.fontStyleToThemeStyles(songOptions?.copyrightFont);

  const margins = (songOptions?.margins && (songOptions.margins.left || songOptions.margins.top || songOptions.margins.right || songOptions.margins.bottom))
    ? songOptions.margins
    : (generalOptions?.margins || { left: 0, top: 0, right: 0, bottom: 0 });

  const showLabel = songOptions?.showVerseChorusLabel ?? true;
  const labelLoc = songOptions?.labelLocation || 'Header';
  const labelStyle = songOptions?.labelStyle || 'uppercase';
  const labelPrefix = songOptions?.labelPrefix || '';

  const formatSectionLabel = (rawLabel: string) => {
    let result = rawLabel;
    if (labelStyle === 'uppercase') {
      result = rawLabel.toUpperCase();
    } else if (labelStyle === 'badge') {
      result = `[ ${rawLabel} ]`;
    } else if (labelStyle === 'parentheses') {
      result = `(${rawLabel})`;
    }
    return `${labelPrefix}${result}`;
  };

  const formattedLabel = formatSectionLabel(currentSlide.label);

  const showCopyrightOption = songOptions?.displayCopyrightInfo ?? true;
  const showFirstOnly = songOptions?.showOnFirstSlideOnly ?? false;
  const showLastOnly = songOptions?.showOnLastSlideOnly ?? false;

  let isCopyrightVisible = showCopyrightOption;
  if (showFirstOnly && validSlideIndex !== 0) {
    isCopyrightVisible = false;
  }
  if (showLastOnly && validSlideIndex !== selectedSong.slides.length - 1) {
    isCopyrightVisible = false;
  }

  const copyrightPos = songOptions?.copyrightPosition || 'Bottom Left';
  const licenseText = songOptions?.licenseInfo || `${selectedSong.ccliNumber} | ${selectedSong.title} (${selectedSong.author})`;

  const allCapsLyrics = songOptions?.allCapsLyrics ?? false;

  return (
    <div className="bg-[#12141a] border border-[#2d3240] rounded-xl p-3.5 space-y-3 shadow-2xl">
      {/* Top Header: Aspect Ratio & Output Resolution Controller */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#252a36] pb-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
          </span>
          <span className="font-bold text-gray-100 text-xs flex items-center gap-1.5">
            <Music size={14} className="text-cyan-400" />
            Live Song Slide Output Preview
          </span>
          <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-mono text-[10px] font-bold">
            {ratioBadge} Widescreen ({width} × {height})
          </span>
        </div>

        {/* Resolution Preset Switcher */}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] bg-[#171922] p-2 rounded-lg border border-[#2b303d]">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400 font-medium">Song:</span>
          <select
            value={selectedSongId}
            onChange={(e) => {
              setSelectedSongId(e.target.value);
              setActiveSlideIndex(0);
            }}
            className="w-full bg-[#202430] border border-[#3c4354] text-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-blue-500"
          >
            {SAMPLE_SONGS.map(s => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-center gap-1.5">
          <span className="text-gray-400 font-medium">Slide:</span>
          <div className="flex items-center gap-1">
            {selectedSong.slides.map((s, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveSlideIndex(idx)}
                className={`px-2 py-0.5 rounded text-[10.5px] transition-all font-semibold ${
                  validSlideIndex === idx
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-[#222632] hover:bg-[#2e3444] text-gray-300'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5">
          <span className="text-gray-400 font-medium">Backdrop:</span>
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
                className={`px-2 py-0.5 rounded text-[10px] transition-all ${
                  activeBgIndex === idx
                    ? 'bg-cyan-600 text-white font-bold'
                    : 'bg-[#222632] hover:bg-[#2e3444] text-gray-300'
                }`}
              >
                {bg.name.split(' ')[0]}
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
              paddingLeft: `${margins?.left || 40}px`,
              paddingRight: `${margins?.right || 40}px`,
              paddingTop: `${margins?.top || 30}px`,
              paddingBottom: `${margins?.bottom || 30}px`,
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ backgroundColor: activeBg.overlay }}
            />

            {showLabel && formattedLabel && (
              <>
                {labelLoc === 'Top Right' && (
                  <div
                    className="absolute top-8 right-10 z-20 px-5 py-2 rounded-lg bg-black/55 backdrop-blur-md border border-white/15 drop-shadow-xl font-bold"
                    style={{
                      ...ThemeEngine.getTextStyle(labelThemeStyles, 1),
                      fontSize: labelThemeStyles.fontSize ? `${labelThemeStyles.fontSize}px` : '32px',
                      color: labelThemeStyles.fontColor || '#67E8F9',
                    }}
                  >
                    {formattedLabel}
                  </div>
                )}
                {labelLoc === 'Top Left' && (
                  <div
                    className="absolute top-8 left-10 z-20 px-5 py-2 rounded-lg bg-black/55 backdrop-blur-md border border-white/15 drop-shadow-xl font-bold"
                    style={{
                      ...ThemeEngine.getTextStyle(labelThemeStyles, 1),
                      fontSize: labelThemeStyles.fontSize ? `${labelThemeStyles.fontSize}px` : '32px',
                      color: labelThemeStyles.fontColor || '#67E8F9',
                    }}
                  >
                    {formattedLabel}
                  </div>
                )}
              </>
            )}

            {showLabel && labelLoc === 'Header' && formattedLabel && (
              <div
                className="relative z-10 text-center font-bold tracking-wider mb-4 drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] max-w-full"
                style={{
                  ...ThemeEngine.getTextStyle(labelThemeStyles, 1),
                  fontSize: labelThemeStyles.fontSize ? `${labelThemeStyles.fontSize}px` : '36px',
                  color: labelThemeStyles.fontColor || '#67E8F9',
                  textAlign: (labelThemeStyles.textAlign as any) || 'center',
                }}
              >
                {formattedLabel}
              </div>
            )}

            {(() => {
              const rawLyrics = currentSlide.lines.join('\n');
              const autoFitSize = ThemeEngine.calculateAutoFitFontSize({
                text: rawLyrics,
                baseFontSize: ThemeEngine.normalizeFontSize(songThemeStyles.fontSize || songOptions?.songFont?.maxSize),
                fontFamily: songThemeStyles.fontFamily,
                fontWeight: songThemeStyles.fontWeight,
                fontStyle: songThemeStyles.fontStyle,
                hasHeader: showLabel && labelLoc === 'Header',
                hasFooter: isCopyrightVisible,
                scale: 1,
                minFontSize: songOptions?.minFontSize || 24,
                maxFontSize: 160,
                isUppercase: allCapsLyrics || songOptions?.songFont?.casing === 'uppercase' || songThemeStyles.textTransform === 'uppercase',
                lineSpacing: songOptions?.lineSpacing || songOptions?.songFont?.lineSpacing || songThemeStyles.lineHeight || 1.35,
                widthPercent: songThemeStyles.widthPercent,
                margins: margins,
                containerWidth: width,
                containerHeight: height,
              });

              return (
                <div className="relative z-10 my-auto flex flex-col justify-center items-center w-full px-6 py-2 overflow-hidden">
                  <div
                    className="font-bold leading-snug max-w-full drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] whitespace-pre-line"
                    style={{
                      ...ThemeEngine.getTextStyle(songThemeStyles, 1),
                      fontSize: `${autoFitSize}px`,
                      fontFamily: songThemeStyles.fontFamily || 'Tahoma, sans-serif',
                      textAlign: (songThemeStyles.textAlign as any) || 'center',
                      color: songThemeStyles.fontColor || '#FFFFFF',
                      lineHeight: songOptions?.lineSpacing || songOptions?.songFont?.lineSpacing || 1.35,
                      textTransform: (allCapsLyrics || songOptions?.songFont?.casing === 'uppercase') ? 'uppercase' : undefined,
                      fontWeight: songThemeStyles.fontWeight || (songOptions?.songFont?.bold ? '700' : '400'),
                      fontStyle: songThemeStyles.fontStyle || (songOptions?.songFont?.italic ? 'italic' : 'normal'),
                      textDecoration: songThemeStyles.textDecoration || (songOptions?.songFont?.underline ? 'underline' : 'none'),
                    }}
                  >
                    {rawLyrics}
                  </div>
                </div>
              );
            })()}

            {showLabel && formattedLabel && (
              <>
                {labelLoc === 'Bottom Right' && (
                  <div
                    className="absolute bottom-8 right-10 z-20 px-5 py-2 rounded-lg bg-black/55 backdrop-blur-md border border-white/15 drop-shadow-xl font-bold"
                    style={{
                      ...ThemeEngine.getTextStyle(labelThemeStyles, 1),
                      fontSize: labelThemeStyles.fontSize ? `${labelThemeStyles.fontSize}px` : '32px',
                      color: labelThemeStyles.fontColor || '#67E8F9',
                    }}
                  >
                    {formattedLabel}
                  </div>
                )}
                {labelLoc === 'Bottom Left' && (
                  <div
                    className="absolute bottom-8 left-10 z-20 px-5 py-2 rounded-lg bg-black/55 backdrop-blur-md border border-white/15 drop-shadow-xl font-bold"
                    style={{
                      ...ThemeEngine.getTextStyle(labelThemeStyles, 1),
                      fontSize: labelThemeStyles.fontSize ? `${labelThemeStyles.fontSize}px` : '32px',
                      color: labelThemeStyles.fontColor || '#67E8F9',
                    }}
                  >
                    {formattedLabel}
                  </div>
                )}
              </>
            )}

            {isCopyrightVisible && licenseText && (
              <div
                className={`absolute z-20 px-4 py-1.5 rounded-md bg-black/50 backdrop-blur-xs border border-white/10 max-w-xl drop-shadow ${
                  copyrightPos === 'Bottom Right' ? 'bottom-6 right-8 text-right' :
                  copyrightPos === 'Bottom Center' ? 'bottom-6 left-1/2 -translate-x-1/2 text-center' :
                  copyrightPos === 'Top Left' ? 'top-6 left-8 text-left' :
                  copyrightPos === 'Top Right' ? 'top-6 right-8 text-right' :
                  'bottom-6 left-8 text-left'
                }`}
                style={{
                  ...ThemeEngine.getTextStyle(copyrightThemeStyles, 1),
                  fontSize: copyrightThemeStyles.fontSize ? `${copyrightThemeStyles.fontSize}px` : '22px',
                  color: copyrightThemeStyles.fontColor || '#A0AEC0',
                }}
              >
                {licenseText}
              </div>
            )}
          </div>
        </div>

        <div className="w-16 h-1 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent mx-auto mt-2 rounded-full" />
      </div>
    </div>
  );
}
