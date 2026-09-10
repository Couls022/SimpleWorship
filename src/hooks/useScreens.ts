import { useState, useEffect } from 'react';
import { DisplayManager } from '../core/DisplayManager';

function formatAndEnsureDisplays(displays: any[]) {
  const formatted = displays.map((d, idx) => ({
    label: d.name || d.label || `Monitor ${idx + 1}`,
    name: d.name || d.label || `Monitor ${idx + 1}`,
    isPrimary: d.isPrimary ?? (idx === 0),
    id: d.id || `monitor-${idx + 1}`,
    displayId: d.displayId || d.id || `monitor-${idx + 1}`,
    bounds: d.bounds || { x: idx * 1920, y: 0, width: 1920, height: 1080 }
  }));

  // Ensure standard names/labels are consistent
  return formatted.map((scr) => {
    if (scr.isPrimary) {
      const baseName = scr.name || scr.label || 'Primary Display';
      const hasPrimary = baseName.toLowerCase().includes('primary');
      const finalName = hasPrimary ? baseName : `${baseName} (Primary)`;
      return {
        ...scr,
        label: finalName,
        name: finalName
      };
    }
    return scr;
  });
}

export function useScreens() {
  const [screens, setScreens] = useState<any[]>(() => {
    const cached = DisplayManager.getCachedDisplays();
    return cached.length > 0 ? formatAndEnsureDisplays(cached) : [];
  });
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function initDisplays() {
      // 1. Electron or DisplayManager
      if (DisplayManager.isElectron() || typeof (window as any).electronAPI?.getDisplays === 'function') {
        const displays = await DisplayManager.getDisplays();
        setScreens(formatAndEnsureDisplays(displays));
        setPermissionGranted(true);

        cleanup = DisplayManager.listenToDisplays((updated) => {
          setScreens(formatAndEnsureDisplays(updated));
        });
        return;
      }

      // 2. Web Multi-Screen API
      if ('getScreenDetails' in window) {
        navigator.permissions
          .query({ name: 'window-management' as PermissionName })
          .then(async (result) => {
            if (result.state === 'granted') {
              setPermissionGranted(true);
              fetchScreens();
            } else {
              // Fallback to basic display
              const displays = await DisplayManager.getDisplays();
              setScreens(formatAndEnsureDisplays(displays));
            }
          })
          .catch(async () => {
            const displays = await DisplayManager.getDisplays();
            setScreens(formatAndEnsureDisplays(displays));
          });
      } else {
        // Fallback for other browsers (Firefox, Safari, etc.)
        const displays = await DisplayManager.getDisplays();
        setScreens(formatAndEnsureDisplays(displays));
      }
    }

    initDisplays();

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  const fetchScreens = async () => {
    try {
      if (DisplayManager.isElectron()) {
        const displays = await DisplayManager.getDisplays();
        setScreens(formatAndEnsureDisplays(displays));
        setPermissionGranted(true);
        return;
      }

      if ('getScreenDetails' in window) {
        const screenDetails = await (window as any).getScreenDetails();
        setScreens(formatAndEnsureDisplays(screenDetails.screens));
        screenDetails.addEventListener('screenschange', () => {
          setScreens(formatAndEnsureDisplays(screenDetails.screens));
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const requestAccess = async () => {
    if (DisplayManager.isElectron()) {
      await fetchScreens();
      setPermissionGranted(true);
      return true;
    }

    if (!('getScreenDetails' in window)) {
      alert('Your browser does not support the Multi-Screen Window Placement API.');
      return false;
    }
    try {
      await fetchScreens();
      setPermissionGranted(true);
      return true;
    } catch (err) {
      console.error('Failed to get screen details:', err);
      alert('Permission to access screen details was denied.');
      return false;
    }
  };

  return { screens, permissionGranted, requestAccess, refreshScreens: fetchScreens };
}
