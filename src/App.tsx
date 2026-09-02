/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import ModeratorView from './components/ModeratorView';
import ProjectorView from './components/ProjectorView';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { initSync } from './store/sync';
import { getDB, dbApi } from './db';
import { readSwsFile } from './services/swsService';
import { useStore } from './store/useStore';
import { applyAppearanceSettings, initSystemThemeListener } from './utils/themeManager';
import { v4 as uuidv4 } from 'uuid';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  
  const searchParams = new URLSearchParams(window.location.search || window.location.hash.replace(/^#\/?\??/, ''));
  const isProjector = searchParams.get('projector') === 'true' || window.location.hash.includes('projector');
  const groupId = searchParams.get('groupId') || searchParams.get('group');

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
    return <ProjectorView groupId={groupId} />;
  }

  return (
    <WorkspaceProvider>
      <ModeratorView />
    </WorkspaceProvider>
  );
}

