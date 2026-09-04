/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { cameraManager } from '../core/CameraManager';

interface CameraLiveRendererProps {
  deviceId: string;
  isBlack?: boolean;
  isClear?: boolean;
  showLogo?: boolean;
  logoUrl?: string;
  className?: string;
  isLiveOutput?: boolean; // Determines if it's the main live projector vs a preview
}

export default function CameraLiveRenderer({ 
  deviceId, 
  isBlack = false, 
  isClear = false, 
  showLogo = false, 
  logoUrl,
  className = '',
  isLiveOutput = true 
}: CameraLiveRendererProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isMounted = true;

    const initStream = async () => {
      try {
        setError(null);
        // Acquire stream independently. If it's a live output, get a dedicated stream.
        const stream = isLiveOutput 
          ? await cameraManager.getLiveStream(deviceId)
          : await cameraManager.getPreviewStream(deviceId);
          
        if (isMounted && videoRef.current) {
          videoRef.current.srcObject = stream;
          activeStream = stream;
        } else {
          // If unmounted before we got here, stop the stream
          if (isLiveOutput && stream) {
            stream.getTracks().forEach(t => t.stop());
          }
        }
      } catch (err: any) {
        if (isMounted) {
          console.error("Camera acquisition error:", err);
          setError(err.message || 'Failed to start camera');
        }
      }
    };

    if (deviceId) {
      initStream();
    }

    return () => {
      isMounted = false;
      if (isLiveOutput && activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      } else if (!isLiveOutput) {
        cameraManager.stopPreviewStream();
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [deviceId, isLiveOutput]);

  return (
    <div className={`relative w-full h-full bg-black flex items-center justify-center overflow-hidden ${className}`}>
      {error ? (
        <div className="flex flex-col items-center justify-center p-4 text-center">
          <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center mb-3">
            <span className="text-red-500 text-xl font-bold">!</span>
          </div>
          <span className="text-gray-400 text-sm">Camera Disconnected / Signal Lost</span>
          <span className="text-gray-500 text-xs mt-1">{error}</span>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-contain"
          style={{ transform: 'translateZ(0)' }}
        />
      )}

      {/* Black State Overlay */}
      <div 
        className={`absolute inset-0 bg-black z-40 transition-opacity duration-300 pointer-events-none ${isBlack ? 'opacity-100' : 'opacity-0'}`} 
      />
      
      {/* Logo Overlay */}
      {showLogo && logoUrl && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <img 
            src={logoUrl} 
            alt="Logo" 
            className="w-[60%] h-[60%] object-contain drop-shadow-2xl opacity-90 transition-opacity duration-500" 
          />
        </div>
      )}
    </div>
  );
}
