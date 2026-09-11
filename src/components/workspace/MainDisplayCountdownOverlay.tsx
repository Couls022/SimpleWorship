import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { Asset } from '../../types';
import { resolveAssetUrl } from '../../db';

interface MainDisplayCountdownOverlayProps {
  isBlack: boolean;
}

export const MainDisplayCountdownOverlay: React.FC<MainDisplayCountdownOverlayProps> = ({ isBlack }) => {
  const store = useStore();
  const opts = store.systemOptions?.serviceIntervals;
  const enabled = opts?.showOnMainDisplay ?? false;
  const isRunning = opts?.isRunning ?? false;
  const targetTimestamp = opts?.targetTimestamp || null;
  const initialTimeStr = opts?.countdownTime || '05:00';
  const backgroundAssetId = opts?.backgroundAssetId || '';
  const backgroundAssetUrl = (opts as any)?.backgroundAssetUrl;
  const fontFamily = opts?.fontFamily || 'monospace';
  const fontColor = opts?.fontColor || '#ffffff';

  // 1. Resolve background asset or URL
  // Hierarchy: Explicit selected asset -> Default timer asset from assetsList -> Stored background URL -> Theme timer styles
  const [bgInfo, setBgInfo] = useState<{ url: string; isVideo: boolean } | null>(null);

  useEffect(() => {
    let candidateAsset: Asset | undefined;

    if (backgroundAssetId) {
      candidateAsset = store.assetsList.find(a => a.id === backgroundAssetId || a.url === backgroundAssetId);
    }

    if (!candidateAsset) {
      candidateAsset = store.assetsList.find(a => a.isDefaultScope?.timers === true);
    }

    if (candidateAsset) {
      const url = resolveAssetUrl(candidateAsset.url) || candidateAsset.url;
      const isVideo = candidateAsset.type === 'video' || candidateAsset.type === 'motion' || /\.(mp4|webm|mov|mkv)(\?.*)?$/i.test(url);
      setBgInfo({ url, isVideo });
      return;
    }

    // Check direct stored URL or theme
    const fallbackUrl = backgroundAssetUrl || store.themesList.find(t => t.type === 'timer' || t.id === 'theme-timer')?.styles?.backgroundImageUrl || store.themesList.find(t => t.type === 'timer' || t.id === 'theme-timer')?.styles?.backgroundVideoUrl;
    if (fallbackUrl) {
      const resolved = resolveAssetUrl(fallbackUrl) || fallbackUrl;
      const isVideo = /\.(mp4|webm|mov|mkv)(\?.*)?$/i.test(resolved);
      setBgInfo({ url: resolved, isVideo });
      return;
    }

    setBgInfo(null);
  }, [backgroundAssetId, backgroundAssetUrl, store.assetsList, store.themesList]);

  const parseSeconds = (timeStr: string): number => {
    if (!timeStr) return 300;
    const parts = timeStr.trim().split(':');
    if (parts.length === 2) {
      const mins = parseInt(parts[0], 10) || 0;
      const secs = parseInt(parts[1], 10) || 0;
      return mins * 60 + secs;
    }
    const num = parseInt(timeStr, 10);
    return isNaN(num) ? 300 : num * 60;
  };

  const calculateRemaining = () => {
    if (!targetTimestamp) return parseSeconds(initialTimeStr);
    const diff = targetTimestamp - Date.now();
    return diff > 0 ? Math.ceil(diff / 1000) : 0;
  };

  const [remainingSecs, setRemainingSecs] = useState<number>(calculateRemaining());

  useEffect(() => {
    setRemainingSecs(calculateRemaining());
    if (!enabled || !isRunning || !targetTimestamp || isBlack) return;

    const timer = setInterval(() => {
      setRemainingSecs((prev) => {
        const current = calculateRemaining();
        if (current <= 0) {
          clearInterval(timer);
          return 0;
        }
        return current;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [enabled, isRunning, targetTimestamp, isBlack, initialTimeStr]);

  if (!enabled || isBlack) return null;

  const mins = Math.floor(remainingSecs / 60);
  const secs = remainingSecs % 60;
  const formattedTime = `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  const isExpired = remainingSecs === 0 && targetTimestamp !== null;

  return (
    <div 
      className={`absolute inset-0 z-45 flex flex-col items-center justify-center overflow-hidden select-none ${
        bgInfo ? 'bg-black' : 'bg-transparent'
      }`}
    >
      {/* Dynamic Background: Full-screen video or image */}
      {bgInfo && (
        bgInfo.isVideo ? (
          <video
            src={bgInfo.url}
            className="absolute inset-0 w-full h-full object-cover z-0"
            autoPlay
            loop
            muted
            playsInline
          />
        ) : (
          <img
            src={bgInfo.url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover z-0"
          />
        )
      )}

      {/* Dim overlay for optimal contrast when background exists */}
      {bgInfo && (
        <div className="absolute inset-0 bg-black/40 z-0 pointer-events-none" />
      )}

      {/* Centered Large Timer Display without label */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full px-8 pointer-events-none">
        <div 
          className={`font-black tabular-nums transition-colors tracking-tight text-center ${
            isExpired ? 'text-amber-400' : remainingSecs <= 60 ? 'text-rose-400 animate-pulse' : ''
          }`}
          style={{ 
            fontSize: '440px',
            fontFamily: fontFamily || 'Montserrat, sans-serif',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            color: isExpired ? '#f59e0b' : remainingSecs <= 60 ? '#f87171' : fontColor,
            textShadow: '0 16px 48px rgba(0,0,0,0.95), 0 4px 16px rgba(0,0,0,0.9)',
            lineHeight: 0.9,
            userSelect: 'none'
          }}
        >
          {formattedTime}
        </div>
      </div>
    </div>
  );
};

