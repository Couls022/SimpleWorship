/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import ModeratorView from './components/ModeratorView';
import ProjectorView from './components/ProjectorView';
import RemoteView from './components/RemoteView';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { initSync } from './store/sync';
import { getDB, dbApi } from './db';
import { readSwsFile } from './services/swsService';
import { useStore } from './store/useStore';
import { applyAppearanceSettings, initSystemThemeListener } from './utils/themeManager';
import { hardwareProfile } from './core/HardwareProfile';
import { initAndLoadStoredFonts } from './utils/fontStorage';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';

export default function App() {
  const [isReady, setIsReady] = useState(true);
  
  const searchParams = new URLSearchParams(window.location.search);
  let hashQueryString = '';
  if (window.location.hash.includes('?')) {
    hashQueryString = window.location.hash.split('?')[1] || '';
  } else if (window.location.hash.includes('projector')) {
    hashQueryString = window.location.hash.replace(/^#\/?projector\/?\??/, '');
  } else if (window.location.hash.includes('remote')) {
    hashQueryString = window.location.hash.replace(/^#\/?remote\/?\??/, '');
  }

  const hashParams = new URLSearchParams(hashQueryString);

  const isStage =
    searchParams.get('stage') === 'true' ||
    hashParams.get('stage') === 'true' ||
    window.location.hash.includes('stage') ||
    searchParams.get('foldback') === 'true' ||
    hashParams.get('foldback') === 'true' ||
    window.location.hash.includes('foldback');

  const isProjector =
    searchParams.get('projector') === 'true' ||
    hashParams.get('projector') === 'true' ||
    window.location.hash.includes('projector') ||
    isStage;

  const isRemote =
    searchParams.get('remote') === 'true' ||
    hashParams.get('remote') === 'true' ||
    window.location.hash.includes('remote');

  const pinFromUrl = searchParams.get('pin') || hashParams.get('pin') || '';

  const rawGroupId =
    searchParams.get('groupId') ||
    searchParams.get('group') ||
    hashParams.get('groupId') ||
    hashParams.get('group') ||
    (isStage ? 'group-stage' : undefined);

  const displayId =
    searchParams.get('displayId') ||
    hashParams.get('displayId') ||
    undefined;

  const groupId = rawGroupId;

  useEffect(() => {
    // 1. Init IndexedDB in background & hydrate saved custom fonts
    getDB().catch((e) => console.warn('[App] DB init warning:', e));
    initAndLoadStoredFonts().catch((e) => console.warn('[App] Font hydration warning:', e));
    
    // 2. Init Broadcast Channel
    initSync(isProjector);

    // 3. Auto-detect Hardware Drivers & Profile (CPU, RAM, GPU) to optimize render caches
    hardwareProfile.detectHardware().catch((e) => console.warn('[App] Hardware detection warning:', e));

    // 4. Apply initial workspace theme & appearance
    const initialOptions = useStore.getState().systemOptions;
    applyAppearanceSettings(initialOptions?.appearance);

    // Listen for OS system theme changes
    const cleanupThemeListener = initSystemThemeListener(() => useStore.getState().systemOptions);

    // Subscribe to store updates with change check to avoid DOM thrashing
    let lastAppearance = initialOptions?.appearance;
    const unsubscribeStore = useStore.subscribe((state) => {
      const current = state.systemOptions?.appearance;
      if (current !== lastAppearance) {
        lastAppearance = current;
        applyAppearanceSettings(current);
      }
    });

    // Listen for Native File Association Opening (.sws double-click on Windows)
    if (typeof window !== 'undefined' && (window as any).electronAPI?.onFileAssociationOpened) {
      (window as any).electronAPI.onFileAssociationOpened(async (filePath: string) => {
        try {
          if ((window as any).electronAPI.readSwsFromPath) {
            const res = await (window as any).electronAPI.readSwsFromPath(filePath);
            if (res && !res.canceled && res.data) {
              const blob = new Blob([res.data]);
              const fileName = filePath.split(/[/\\]/).pop() || 'Imported.sws';
              const file = new File([blob], fileName);
              const result = await readSwsFile(file);
              if (result.schedule) {
                if (result.bundledSongs && result.bundledSongs.length > 0) {
                  await Promise.all(result.bundledSongs.map(song => dbApi.addSong(song).catch(() => {})));
                }
                if (result.bundledThemes && result.bundledThemes.length > 0) {
                  await Promise.all(result.bundledThemes.map(thm => dbApi.addTheme(thm).catch(() => {})));
                }
                await dbApi.addSchedule(result.schedule).catch(() => {});
                useStore.getState().setActiveSchedule(result.schedule);
                window.dispatchEvent(new CustomEvent('simpleworship:notify', {
                  detail: `Opened Service: ${result.schedule.name}`
                }));
              }
            }
          }
        } catch (err) {
          console.error('Failed to open SWS file from Windows association:', err);
        }
      });
    }

    // Listen for Native Display Hot-Plug changes
    if (typeof window !== 'undefined' && (window as any).electronAPI?.onDisplayChanged) {
      (window as any).electronAPI.onDisplayChanged(() => {
        window.dispatchEvent(new CustomEvent('simpleworship:displays-changed'));
      });
    }

    // Global dragover & drop handler to prevent browser navigation when dropping files outside drop zones
    const preventGlobalDrop = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener('dragover', preventGlobalDrop);
    window.addEventListener('drop', preventGlobalDrop);

    // Operator window shutdown & reload cleanup: ensure all live states disengage and displays close cleanly
    const handleAppShutdown = () => {
      if (isProjector || isRemote) return;
      try {
        const currentStates = useStore.getState().groupStates || {};
        const resetStates: Record<string, any> = {};
        for (const [gid, st] of Object.entries(currentStates)) {
          resetStates[gid] = {
            ...(st as any),
            isLiveEnabled: false,
            activeItemId: null,
            activeSlideIndex: 0,
            renderFrame: undefined
          };
        }
        localStorage.setItem('simpleworship_group_states_v1', JSON.stringify(resetStates));
        localStorage.setItem('simpleworship_route_stack_v1', JSON.stringify(['group-congregation', 'group-r2', 'group-stage']));
      } catch (e) {}

      // Proactively close all projector windows on app quit
      if (typeof window !== 'undefined' && (window as any).electronAPI?.syncProjectorDisplays) {
        try {
          (window as any).electronAPI.syncProjectorDisplays([]);
        } catch (e) {}
      }
    };
    window.addEventListener('beforeunload', handleAppShutdown);
    window.addEventListener('unload', handleAppShutdown);

    // Projector live transparency management (Ensures Moderator window NEVER becomes transparent/white)
    const applyOverlayTransparency = (overlayActive: boolean) => {
      if (isProjector) {
        document.documentElement.classList.add('projector-mode');
        document.body.classList.add('projector-mode');
        const rootEl = document.getElementById('root');
        if (rootEl) {
          rootEl.classList.add('projector-mode');
        }
        if (overlayActive) {
          document.documentElement.style.backgroundColor = 'transparent';
          document.body.style.backgroundColor = 'transparent';
          if (rootEl) rootEl.style.backgroundColor = 'transparent';
        } else {
          document.documentElement.style.backgroundColor = '#000000';
          document.body.style.backgroundColor = '#000000';
          if (rootEl) rootEl.style.backgroundColor = '#000000';
        }
      } else {
        // Moderator & Remote windows always maintain solid dark workspace background
        document.documentElement.classList.remove('projector-mode', 'system-overlay-mode');
        document.body.classList.remove('projector-mode', 'system-overlay-mode');
        document.documentElement.style.backgroundColor = '#0c0d10';
        document.body.style.backgroundColor = '#0c0d10';
        const rootEl = document.getElementById('root');
        if (rootEl) {
          rootEl.classList.remove('projector-mode', 'system-overlay-mode');
          rootEl.style.backgroundColor = '#0c0d10';
        }
      }
    };

    applyOverlayTransparency(useStore.getState().isSystemOverlayMode);

    const handleSystemOverlayChanged = (e: any) => {
      applyOverlayTransparency(Boolean(e.detail?.isOverlayMode));
    };
    window.addEventListener('simpleworship:system-overlay-changed', handleSystemOverlayChanged);

    return () => {
      window.removeEventListener('dragover', preventGlobalDrop);
      window.removeEventListener('drop', preventGlobalDrop);
      window.removeEventListener('beforeunload', handleAppShutdown);
      window.removeEventListener('unload', handleAppShutdown);
      window.removeEventListener('simpleworship:system-overlay-changed', handleSystemOverlayChanged);
      cleanupThemeListener?.();
      unsubscribeStore();
    };
  }, [isProjector]);

  if (isProjector) {
    return (
      <AppErrorBoundary fallbackType="projector">
        <ProjectorView groupId={groupId} displayId={displayId} />
      </AppErrorBoundary>
    );
  }

  if (isRemote) {
    return (
      <AppErrorBoundary fallbackType="moderator">
        <RemoteView pinFromUrl={pinFromUrl} />
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary fallbackType="moderator">
      <WorkspaceProvider>
        <ModeratorView />
      </WorkspaceProvider>
    </AppErrorBoundary>
  );
}
