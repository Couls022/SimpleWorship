const fs = require('fs');
let code = fs.readFileSync('src/components/MonitorPreviewCanvas.tsx', 'utf8');

if (!code.includes("useMediaProgressStore")) {
  code = code.replace(
    "import { useStore } from '../store/useStore';",
    "import { useStore } from '../store/useStore';\nimport { useMediaProgressStore } from '../store/useMediaProgressStore';"
  );
}

// Fix handleTimeUpdate
code = code.replace(
  `  const handleTimeUpdate = () => {
    if (isProjectorMode) return;
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const now = Date.now();
    if (now - lastVideoTimeUpdateRef.current >= 200) {
      lastVideoTimeUpdateRef.current = now;
      if (setStagedGroupState) {
        setStagedGroupState(groupId, {
          videoCurrentTime: videoEl.currentTime,
          videoDuration: videoEl.duration || 0,
        });
      }
    }
  };`,
  `  const handleTimeUpdate = () => {
    if (isProjectorMode) return;
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const now = Date.now();
    
    // Update fast UI store every 250ms (doesn't trigger massive re-renders)
    if (now - (videoEl as any)._lastFastUpdate > 250 || !(videoEl as any)._lastFastUpdate) {
      (videoEl as any)._lastFastUpdate = now;
      useMediaProgressStore.getState().setProgress(groupId, videoEl.currentTime, videoEl.duration || 0);
    }
    
    // Update global drift sync store only every 4 seconds
    if (now - lastVideoTimeUpdateRef.current >= 4000) {
      lastVideoTimeUpdateRef.current = now;
      if (setStagedGroupState) {
        setStagedGroupState(groupId, {
          videoCurrentTime: videoEl.currentTime,
          videoDuration: videoEl.duration || 0,
        });
      }
    }
  };`
);

// Fix handleAudioTimeUpdate
code = code.replace(
  `  const handleAudioTimeUpdate = () => {
    if (isProjectorMode) return;
    const audioEl = audioRef.current;
    if (!audioEl) return;
    const now = Date.now();
    if (now - lastAudioTimeUpdateRef.current >= 200) {
      lastAudioTimeUpdateRef.current = now;
      if (setStagedGroupState) {
        setStagedGroupState(groupId, {
          videoCurrentTime: audioEl.currentTime,
          videoDuration: audioEl.duration || 0,
        });
      }
    }
  };`,
  `  const handleAudioTimeUpdate = () => {
    if (isProjectorMode) return;
    const audioEl = audioRef.current;
    if (!audioEl) return;
    const now = Date.now();
    
    if (now - (audioEl as any)._lastFastUpdate > 250 || !(audioEl as any)._lastFastUpdate) {
      (audioEl as any)._lastFastUpdate = now;
      useMediaProgressStore.getState().setProgress(groupId, audioEl.currentTime, audioEl.duration || 0);
    }

    if (now - lastAudioTimeUpdateRef.current >= 4000) {
      lastAudioTimeUpdateRef.current = now;
      if (setStagedGroupState) {
        setStagedGroupState(groupId, {
          videoCurrentTime: audioEl.currentTime,
          videoDuration: audioEl.duration || 0,
        });
      }
    }
  };`
);

fs.writeFileSync('src/components/MonitorPreviewCanvas.tsx', code);
