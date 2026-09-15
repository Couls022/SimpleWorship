import React, { useState, useRef, useEffect } from 'react';
import { Film } from 'lucide-react';
import { resolveAssetUrl } from '../../db';

interface LazyVideoThumbnailProps {
  src: string;
  poster?: string;
  alt?: string;
  className?: string;
  autoPlayOnHover?: boolean;
}

// In-memory poster frame cache (video URL -> data URL)
const posterCache = new Map<string, string>();

/**
 * High-performance Video Thumbnail Component
 * - Prevents GPU decoder exhaustion on Windows / real devices by using static poster frames
 * - Avoids concurrent video stream decoding in grids and list views
 * - Supports smooth hover-to-play with clean decoder release on mouse leave
 */
export const LazyVideoThumbnail: React.FC<LazyVideoThumbnailProps> = React.memo(({
  src,
  poster,
  alt = 'Video thumbnail',
  className = 'w-full h-full object-cover pointer-events-none',
  autoPlayOnHover = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const resolvedSrc = resolveAssetUrl(src) || src;
  const [posterUrl, setPosterUrl] = useState<string | null>(() => {
    if (poster) return poster;
    if (resolvedSrc && posterCache.has(resolvedSrc)) return posterCache.get(resolvedSrc)!;
    return null;
  });
  const videoRef = useRef<HTMLVideoElement>(null);

  // Immediately release hardware decoder when hover ends
  useEffect(() => {
    if (!isHovered && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
    }
  }, [isHovered]);

  // Lazy snapshot extraction for first frame if no poster is provided
  useEffect(() => {
    if (posterUrl || !resolvedSrc || !resolvedSrc.startsWith('blob:') && !resolvedSrc.startsWith('http') && !resolvedSrc.startsWith('/')) return;

    let isMounted = true;
    let video: HTMLVideoElement | null = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';
    video.src = resolvedSrc;

    const handleLoadedData = () => {
      if (!video) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(video.videoWidth || 320, 480);
        canvas.height = Math.min(video.videoHeight || 180, 270);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          posterCache.set(resolvedSrc, dataUrl);
          if (isMounted) setPosterUrl(dataUrl);
        }
      } catch {
        // CORS or sandbox restriction - fallback gracefully
      } finally {
        if (video) {
          video.removeAttribute('src');
          video.load();
          video = null;
        }
      }
    };

    video.addEventListener('loadeddata', handleLoadedData);
    video.currentTime = 0.1;

    return () => {
      isMounted = false;
      if (video) {
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeAttribute('src');
        video.load();
        video = null;
      }
    };
  }, [resolvedSrc, posterUrl]);

  return (
    <div 
      className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center"
      onMouseEnter={() => autoPlayOnHover && setIsHovered(true)}
      onMouseLeave={() => autoPlayOnHover && setIsHovered(false)}
    >
      {isHovered && resolvedSrc ? (
        <video
          ref={videoRef}
          src={resolvedSrc}
          muted
          loop
          autoPlay
          playsInline
          preload="none"
          className={className}
          style={{
            transform: 'translate3d(0, 0, 0)',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        />
      ) : posterUrl ? (
        <img
          src={posterUrl}
          alt={alt}
          referrerPolicy="no-referrer"
          className={className}
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-[#121620] flex flex-col items-center justify-center text-cyan-400/80 select-none">
          <Film size={22} className="opacity-70 mb-0.5" />
          <span className="text-[8px] font-mono uppercase text-gray-400 font-semibold tracking-wider">Video</span>
        </div>
      )}
    </div>
  );
});
