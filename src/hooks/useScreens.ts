import { useState, useEffect } from 'react';
import { DisplayManager } from '../core/DisplayManager';

export function useScreens() {
  const [screens, setScreens] = useState<any[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    async function initDisplays() {
      // 1. Electron or DisplayManager
      if (DisplayManager.isElectron() || typeof (window as any).electronAPI?.getDisplays === 'function') {
        const displays = await DisplayManager.getDisplays();
        const formatted = displays.map((d) => ({
          label: d.name,
          isPrimary: d.isPrimary,
          id: d.id,
          displayId: d.displayId,
          bounds: d.bounds
        }));
        setScreens(formatted);
        setPermissionGranted(true);

        cleanup = DisplayManager.listenToDisplays((updated) => {
          setScreens(
            updated.map((d) => ({
              label: d.name,
              isPrimary: d.isPrimary,
              id: d.id,
              displayId: d.displayId,
              bounds: d.bounds
            }))
          );
        });
        return;
      }

      // 2. Web Multi-Screen API
      if ('getScreenDetails' in window) {
        navigator.permissions
          .query({ name: 'window-management' as PermissionName })
          .then((result) => {
            if (result.state === 'granted') {
              setPermissionGranted(true);
              fetchScreens();
            }
          })
          .catch(console.error);
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
        setScreens(
          displays.map((d) => ({
            label: d.name,
            isPrimary: d.isPrimary,
            id: d.id,
            displayId: d.displayId,
            bounds: d.bounds
          }))
        );
        setPermissionGranted(true);
        return;
      }

      if ('getScreenDetails' in window) {
        const screenDetails = await (window as any).getScreenDetails();
        setScreens(screenDetails.screens);
        screenDetails.addEventListener('screenschange', () => {
          setScreens(screenDetails.screens);
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

  return { screens, permissionGranted, requestAccess };
}
