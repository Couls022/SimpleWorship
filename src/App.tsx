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
import { v4 as uuidv4 } from 'uuid';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  
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

  const isProjector =
    searchParams.get('projector') === 'true' ||
    hashParams.get('projector') === 'true' ||
    window.location.hash.includes('projector');

  const isRemote =
    searchParams.get('remote') === 'true' ||
    hashParams.get('remote') === 'true' ||
    window.location.hash.includes('remote');

  const pinFromUrl = searchParams.get('pin') || hashParams.get('pin') || '';

  const rawGroupId =
    searchParams.get('groupId') ||
    searchParams.get('group') ||
    hashParams.get('groupId') ||
    hashParams.get('group');

  const displayId =
    searchParams.get('displayId') ||
    hashParams.get('displayId') ||
    undefined;

  const groupId = rawGroupId || (isProjector ? 'group-congregation' : undefined);

  useEffect(() => {
    async function init() {
      // Init IndexedDB
      await getDB();
      
      // Init Broadcast Channel
      initSync(isProjector);

      // Apply initial workspace theme & appearance
      const initialOptions = useStore.getState().systemOptions;
      applyAppearanceSettings(initialOptions?.appearance);

      // Listen for OS system theme changes
      const cleanupThemeListener = initSystemThemeListener(() => useStore.getState().systemOptions);

      // Subscribe to store updates to keep theme updated live
      const unsubscribeStore = useStore.subscribe((state) => {
        applyAppearanceSettings(state.systemOptions?.appearance);
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
                  // Ingest bundled songs into offline database
                  if (result.bundledSongs && result.bundledSongs.length > 0) {
                    for (const song of result.bundledSongs) {
                      await dbApi.addSong(song).catch(() => {});
                    }
                  }
                  // Ingest bundled themes into offline database
                  if (result.bundledThemes && result.bundledThemes.length > 0) {
                    for (const thm of result.bundledThemes) {
                      await dbApi.addTheme(thm).catch(() => {});
                    }
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

      setIsReady(true);
    }
    
    init();
  }, [isProjector]);

  if (!isReady) {
    return <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">Loading SimpleWorship...</div>;
  }

  if (isProjector && groupId) {
    return <ProjectorView groupId={groupId} displayId={displayId} />;
  }

  if (isRemote) {
    return <RemoteView pinFromUrl={pinFromUrl} />;
  }

  return (
    <WorkspaceProvider>
      <ModeratorView />
    </WorkspaceProvider>
  );
}

