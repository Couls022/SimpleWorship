import React from 'react';
import { 
  Music, 
  BookOpen, 
  Image as ImageIcon, 
  Film, 
  Volume2, 
  FileText, 
  MonitorUp, 
  Tv 
} from 'lucide-react';
import { Slide, PresentationItem, ThemeStyles } from '../types';
import { ResolvedContentType } from '../core/PresentationContentResolver';
import { formatVerseNumber } from '../utils/scriptureFormatter';
import { PresentationSlideView } from './PresentationSlideView';
import { PptxSlideThumbnail } from './PptxSlideThumbnail';
import { SlideTransitionManager } from '../core/SlideTransitionManager';

export interface LiveSlideCardProps {
  slide: Slide;
  idx: number;
  totalSlides: number;
  isSelected: boolean;
  viewMode: 'large' | 'medium' | 'small' | 'summary';
  liveItem: PresentationItem | null;
  liveContentType: ResolvedContentType;
  mediaFormat: string;
  resolvedStyles: ThemeStyles;
  systemOptions: any;
  activeControlState?: any;
  isPublicLive?: boolean;
  onSelect: (idx: number) => void;
}

export const LiveSlideCard: React.FC<LiveSlideCardProps> = React.memo(({
  slide,
  idx,
  totalSlides,
  isSelected,
  viewMode,
  liveItem,
  liveContentType,
  mediaFormat,
  resolvedStyles,
  systemOptions,
  activeControlState,
  isPublicLive,
  onSelect,
}) => {
  const isScripture = liveContentType === 'bible';
  const isSong = liveContentType === 'song';
  const isImage = liveContentType === 'image';
  const isVideo = liveContentType === 'video';
  const isAudio = liveContentType === 'audio';
  const isPptx = liveContentType === 'pptx' || liveItem?.type === 'presentation' || liveItem?.type === 'ppt';
  const isCamera = liveContentType === 'camera';

  const isMediaOrVisual = isImage || isVideo || isAudio || isPptx || isCamera;

  // Format video/audio time
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getHeaderColor = () => {
    if (isScripture) return 'bg-[#5f171d] text-rose-100 border-rose-900/60';
    if (isAudio) return 'bg-[#2a1b42] text-purple-200 border-purple-800/60';
    if (isVideo) return 'bg-[#14263e] text-cyan-200 border-cyan-800/60';
    if (isImage) return 'bg-[#132c24] text-emerald-200 border-emerald-800/60';
    if (isPptx) return 'bg-[#332214] text-amber-200 border-amber-800/60';
    if (isCamera) return 'bg-[#143325] text-emerald-200 border-emerald-800/60';

    if (isSong) {
      const t = (slide.title || liveItem?.name || '').toLowerCase();
      if (t.includes('chorus') || t.includes('koro') || t.includes('refrain')) return 'bg-emerald-900 text-emerald-100 border-emerald-700/50';
      if (t.includes('bridge') || t.includes('tulay')) return 'bg-purple-900 text-purple-100 border-purple-700/50';
      if (t.includes('pre-chorus')) return 'bg-amber-900 text-amber-100 border-amber-700/50';
      if (t.includes('tag') || t.includes('ending') || t.includes('coda')) return 'bg-rose-900 text-rose-100 border-rose-700/50';
      if (t.includes('verse') || t.includes('talatâ') || t.match(/^v\d+$/)) return 'bg-indigo-900 text-indigo-100 border-indigo-700/50';
    }

    return 'bg-[#1e2a44] text-blue-100 border-blue-800/60';
  };

  const renderLeftIcon = () => {
    const size = viewMode === 'large' ? 14 : viewMode === 'small' ? 10 : 12;
    if (isSong) return <Music size={size} className="text-gray-400 mt-1" />;
    if (isScripture) return <BookOpen size={size} className="text-rose-400 mt-1" />;
    if (isImage) return <ImageIcon size={size} className="text-emerald-400 mt-1" />;
    if (isVideo) return <Film size={size} className="text-cyan-400 mt-1" />;
    if (isAudio) return <Volume2 size={size} className="text-purple-400 mt-1" />;
    if (isPptx) return <FileText size={size} className="text-amber-400 mt-1" />;
    if (isCamera) return <MonitorUp size={size} className="text-emerald-400 mt-1" />;
    return <Tv size={size} className="text-gray-400 mt-1" />;
  };

  const mediaSourceUrl = slide.backgroundUrl || liveItem?.data?.url || liveItem?.customBackgroundUrl || '';

  return (
    <div
      onClick={() => onSelect(idx)}
      className={`w-full min-w-0 flex rounded-xs border cursor-pointer select-none transition-all text-left overflow-hidden group ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/60 bg-[#1e2533] shadow-lg'
          : 'border-[#2d3039] bg-[#20222a] hover:border-[#424859]'
      }`}
    >
      {/* Left Number & Icon Column */}
      {viewMode !== 'summary' && (
        <div className={`bg-[#15161b] border-r border-[#2a2c36] flex flex-col items-center justify-start shrink-0 ${
          viewMode === 'large' ? 'w-11 py-2.5' : viewMode === 'small' ? 'w-8 py-1' : 'w-9 py-1.5'
        }`}>
          <span className={`${viewMode === 'large' ? 'text-xs' : 'text-[11px]'} font-mono font-bold text-gray-300`}>
            {idx + 1}
          </span>
          {renderLeftIcon()}
        </div>
      )}

      {/* Main Slide Card Area */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Card Header Bar */}
        <div className={`${
          viewMode === 'large' ? 'px-2.5 py-1 text-xs' : viewMode === 'small' || viewMode === 'summary' ? 'px-2 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
        } font-bold truncate border-b flex items-center justify-between gap-1.5 ${getHeaderColor()}`}>
          <div className="flex items-center gap-1.5 truncate min-w-0">
            {viewMode === 'summary' && (
              <span className="text-gray-400 font-mono shrink-0">{idx + 1}.</span>
            )}
            <span className="truncate">
              {isPptx 
                ? (slide.title ? `Slide ${idx + 1}: ${slide.title}` : `Slide ${idx + 1} of ${totalSlides}`)
                : (slide.title || liveItem?.name || `Slide ${idx + 1}`)
              }
            </span>
          </div>

          {/* Slide Transition Badge */}
          {slide.transition && slide.transition.type !== 'none' && (
            <span 
              className="shrink-0 text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1"
              title={`Slide Transition: ${SlideTransitionManager.getTransitionLabel(slide.transition.type)} (${slide.transition.durationMs ?? 500}ms)${slide.transition.advanceAfterTimeMs ? ` • Auto: ${Math.round(slide.transition.advanceAfterTimeMs / 1000)}s` : ''}`}
            >
              <span>⚡ {SlideTransitionManager.getTransitionLabel(slide.transition.type)}</span>
              {slide.transition.durationMs !== undefined && <span>{slide.transition.durationMs}ms</span>}
              {slide.transition.advanceAfterTimeMs ? <span>⏱ {Math.round(slide.transition.advanceAfterTimeMs / 1000)}s</span> : null}
            </span>
          )}

          {/* Media type badge in header */}
          {mediaFormat && (
            <span className="shrink-0 text-[9px] font-mono font-extrabold px-1.5 py-0.2 rounded bg-black/40 border border-white/10 uppercase tracking-wider">
              {mediaFormat}
            </span>
          )}

          {/* Staged & Live Badges */}
          {isPublicLive && (
            <span className="shrink-0 text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-red-600 text-white border border-red-400 uppercase tracking-widest flex items-center gap-1 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse">
              ● LIVE
            </span>
          )}
          {isSelected && !isPublicLive && (
            <span className="shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-600/90 text-white border border-blue-400/80 uppercase tracking-wider">
              STAGED
            </span>
          )}
        </div>

        {/* Card Body */}
        {viewMode !== 'summary' && (
          <div className="bg-[#17191f] relative overflow-hidden flex-1">
            {/* Visual Media Layouts */}
            {isImage ? (
              <div className="w-full aspect-video min-h-[100px] max-h-56 bg-black/90 relative flex items-center justify-center overflow-hidden">
                {mediaSourceUrl ? (
                  <img 
                    src={mediaSourceUrl} 
                    alt={liveItem?.name || 'Image'} 
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-3 text-center text-gray-500">
                    <ImageIcon size={28} className="mb-1 text-emerald-500/60" />
                    <span className="text-[11px] font-mono text-gray-400">{liveItem?.name || 'Image Item'}</span>
                  </div>
                )}
                <div className="absolute top-1.5 left-2 px-1.5 py-0.5 bg-black/70 rounded text-[9px] font-mono text-emerald-300 border border-emerald-500/30">
                  IMAGE {mediaFormat ? `• ${mediaFormat}` : ''}
                </div>
              </div>
            ) : isVideo ? (
              <div className="w-full aspect-video min-h-[100px] max-h-56 bg-black relative flex items-center justify-center overflow-hidden">
                {mediaSourceUrl ? (
                  <video
                    src={mediaSourceUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-contain pointer-events-none"
                    style={{
                      transform: 'translateZ(0)',
                      willChange: 'transform',
                      contain: 'strict',
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-3 text-center text-gray-500">
                    <Film size={28} className="mb-1 text-cyan-500/60" />
                    <span className="text-[11px] font-mono text-gray-400">{liveItem?.name || 'Video Track'}</span>
                  </div>
                )}
                <div className="absolute top-1.5 left-2 px-1.5 py-0.5 bg-black/70 rounded text-[9px] font-mono text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                  <Film size={10} />
                  <span>VIDEO {mediaFormat ? `• ${mediaFormat}` : ''}</span>
                </div>
                <div className="absolute bottom-1.5 right-2 px-1.5 py-0.5 bg-black/80 rounded text-[9px] font-mono text-gray-300">
                  {formatTime(activeControlState?.videoDuration || 0)}
                </div>
              </div>
            ) : isAudio ? (
              <div className="w-full aspect-video min-h-[100px] max-h-56 bg-gradient-to-br from-[#12141c] via-[#1b172a] to-[#0f1017] p-3 flex flex-col items-center justify-center relative overflow-hidden border-t border-purple-900/30">
                {/* Audio visualizer ambient glow */}
                <div className="absolute inset-0 bg-purple-500/5 blur-lg" />
                
                {/* Visualizer bars */}
                <div className="flex items-end justify-center gap-1.5 h-10 mb-2 z-10">
                  {[1, 2, 3, 4, 5, 6, 7].map((bar) => {
                    const heights = ['h-3', 'h-6', 'h-9', 'h-5', 'h-8', 'h-4', 'h-7'];
                    return (
                      <div
                        key={bar}
                        className={`w-1.5 rounded-t-sm bg-gradient-to-t from-purple-600 to-purple-400 shadow-[0_0_6px_rgba(168,85,247,0.6)] ${heights[bar - 1]} ${
                          activeControlState?.isVideoPlaying !== false ? 'animate-pulse' : 'opacity-40'
                        }`}
                        style={{ animationDuration: `${0.6 + (bar % 3) * 0.2}s` }}
                      />
                    );
                  })}
                </div>

                <span className="text-[11px] font-bold text-gray-200 z-10 text-center truncate max-w-full px-2">
                  {liveItem?.name || 'Audio Track'}
                </span>

                <div className="flex items-center gap-2 mt-1.5 z-10">
                  <span className="px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-700/60 text-purple-300 text-[9px] font-mono font-extrabold uppercase">
                    {mediaFormat || 'AUDIO'}
                  </span>
                  <span className={`text-[9px] font-mono font-semibold flex items-center gap-1 ${
                    activeControlState?.isVideoPlaying !== false ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      activeControlState?.isVideoPlaying !== false ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                    }`} />
                    {activeControlState?.isVideoPlaying !== false ? 'PLAYING' : 'PAUSED'}
                  </span>
                </div>
              </div>
            ) : isPptx ? (
              <div 
                className="w-full min-h-[110px] max-h-56 bg-black relative flex items-center justify-center overflow-hidden border border-white/5"
                style={{ aspectRatio: slide.aspectRatio ? `${slide.aspectRatio}` : '16/9' }}
              >
                <PptxSlideThumbnail 
                  slide={slide} 
                  slideIndex={idx} 
                  totalSlides={totalSlides} 
                  liveItem={liveItem}
                  themeStyles={undefined} 
                />
              </div>
            ) : isCamera ? (
              <div className="w-full aspect-video min-h-[100px] max-h-56 bg-[#0c1310] relative flex flex-col items-center justify-center p-3 text-center border-t border-emerald-900/30">
                <MonitorUp size={30} className="mb-1 text-emerald-400 animate-pulse" />
                <span className="text-[11px] font-bold text-gray-200 truncate max-w-full px-2">
                  {liveItem?.name || 'Live Camera Feed'}
                </span>
                <span className="mt-1 px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-[9px] font-mono font-bold tracking-widest uppercase">
                  CAMERA LIVE
                </span>
              </div>
            ) : (
              /* Text Slide Layout (Song / Scripture / Announcements) */
              <div 
                className={`${
                  viewMode === 'large' ? 'p-3 text-sm min-h-[64px]' : viewMode === 'small' ? 'p-1.5 text-[10px] min-h-[32px]' : 'p-2 text-[11px] min-h-[48px]'
                } leading-relaxed font-sans whitespace-pre-line bg-[#1c1e24] relative overflow-hidden`}
              >
                {/* Background image or video preview overlay */}
                {resolvedStyles.backgroundType === 'video' && (resolvedStyles.backgroundVideoUrl || slide.backgroundUrl || liveItem?.customBackgroundUrl) ? (
                  <video
                    src={slide.backgroundUrl || liveItem?.customBackgroundUrl || resolvedStyles.backgroundVideoUrl}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none z-0"
                  />
                ) : (slide.backgroundUrl || liveItem?.customBackgroundUrl || resolvedStyles.backgroundImageUrl) ? (
                  <img
                    src={slide.backgroundUrl || liveItem?.customBackgroundUrl || resolvedStyles.backgroundImageUrl}
                    alt="background"
                    className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none z-0"
                  />
                ) : null}

                <div 
                  className="relative z-10"
                  style={{
                    textTransform: resolvedStyles.textTransform || (
                      isSong 
                        ? ((systemOptions?.mainOutput?.song?.allCapsLyrics || systemOptions?.mainOutput?.song?.songFont?.casing === 'uppercase') ? 'uppercase' : undefined)
                        : (isScripture && systemOptions?.mainOutput?.scripture?.scriptureFont?.casing === 'uppercase' ? 'uppercase' : undefined)
                    ),
                    color: resolvedStyles.fontColor || '#ffffff',
                    textShadow: resolvedStyles.textShadow ? `${resolvedStyles.shadowOffsetX || 0}px ${resolvedStyles.shadowOffsetY || 2}px ${resolvedStyles.shadowBlur || 4}px ${resolvedStyles.shadowColor || 'rgba(0,0,0,0.85)'}` : undefined,
                    textAlign: (resolvedStyles.textAlign as any) || 'center',
                    fontWeight: resolvedStyles.fontWeight || (
                      isSong 
                        ? (systemOptions?.mainOutput?.song?.songFont?.bold ? '700' : '400')
                        : (isScripture ? (systemOptions?.mainOutput?.scripture?.scriptureFont?.bold ? '700' : '400') : '700')
                    ),
                    fontStyle: resolvedStyles.fontStyle || (
                      isSong 
                        ? (systemOptions?.mainOutput?.song?.songFont?.italic ? 'italic' : 'normal')
                        : (isScripture ? (systemOptions?.mainOutput?.scripture?.scriptureFont?.italic ? 'italic' : 'normal') : 'normal')
                    ),
                    fontFamily: resolvedStyles.fontFamily || (
                      isSong 
                        ? (systemOptions?.mainOutput?.song?.songFont?.family || 'Tahoma, sans-serif')
                        : (isScripture ? (systemOptions?.mainOutput?.scripture?.scriptureFont?.family || 'Tahoma, sans-serif') : 'Tahoma, sans-serif')
                    ),
                    lineHeight: resolvedStyles.lineHeight || (
                      isSong 
                        ? (systemOptions?.mainOutput?.song?.lineSpacing || 1.3)
                        : (isScripture ? (systemOptions?.mainOutput?.scripture?.lineSpacing || 1.35) : 1.35)
                    ),
                  }}
                >
                  {isScripture && slide.verses && slide.verses.length > 0 ? (
                    slide.verses.map((v: any, vIdx: number) => (
                      <span key={v.verse || vIdx} className="inline">
                        {(systemOptions?.mainOutput?.scripture?.showVerseNumbers ?? true) && (
                          <span 
                            className="inline-block mr-1.5 select-none"
                            style={{ 
                              color: systemOptions?.mainOutput?.scripture?.verseLabelColor || systemOptions?.mainOutput?.scripture?.verseFont?.color || systemOptions?.mainOutput?.scripture?.verseColor || '#F6E05E',
                              fontFamily: systemOptions?.mainOutput?.scripture?.verseFont?.family || resolvedStyles.fontFamily || 'Tahoma, sans-serif',
                              fontWeight: systemOptions?.mainOutput?.scripture?.verseFont?.bold ? '700' : '400',
                              fontStyle: systemOptions?.mainOutput?.scripture?.verseFont?.italic ? 'italic' : 'normal',
                              textDecoration: systemOptions?.mainOutput?.scripture?.verseFont?.underline ? 'underline' : 'none',
                            }}
                          >
                            {formatVerseNumber(v.verse, systemOptions?.mainOutput?.scripture?.verseNumberStyle)}
                          </span>
                        )}
                        <span>{v.text}</span>
                        {vIdx < slide.verses!.length - 1 && ' '}
                      </span>
                    ))
                  ) : (
                    slide.text || (
                      <span className="italic text-gray-500 text-[10px]">
                        {slide.title || 'Slide Content'}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.idx === nextProps.idx &&
    prevProps.totalSlides === nextProps.totalSlides &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.liveContentType === nextProps.liveContentType &&
    prevProps.mediaFormat === nextProps.mediaFormat &&
    prevProps.liveItem?.id === nextProps.liveItem?.id &&
    prevProps.liveItem?.contentId === nextProps.liveItem?.contentId &&
    prevProps.slide === nextProps.slide &&
    prevProps.systemOptions === nextProps.systemOptions
  );
});
