import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useWorkspace } from '../context/WorkspaceContext';
import { PresentationContentResolver } from '../core/PresentationContentResolver';
import { isValidPptxBinary } from '../utils/pptxValidator';
import { 
  Layers, 
  Tv, 
  Monitor, 
  FolderOpen, 
  Clock, 
  FileText,
  Film 
} from 'lucide-react';
import TopToolbar from './TopToolbar';
import LayoutManager from './workspace/LayoutManager';
import SchedulePanel from './SchedulePanel';
import LivePanel from './LivePanel';
import MultiGroupPreviewBar from './MultiGroupPreviewBar';
import FloatingPanel from './workspace/FloatingPanel';
import StageMonitorContent from './workspace/StageMonitorContent';
import QuickNotesContent from './workspace/QuickNotesContent';
import MediaLibraryPanel from './workspace/MediaLibraryPanel';
import MediaLibraryModal from './MediaLibraryModal';
import SongEditorModal from './SongEditorModal';
import AlertModal from './AlertModal';
import OptionsDialog from './options/OptionsDialog';
import CenterShortcutSettingsModal from './CenterShortcutSettingsModal';
import QuickSongSearchModal from './QuickSongSearchModal';
import TargetSelectionModal from './TargetSelectionModal';
import SystemDiagnosticsModal from './SystemDiagnosticsModal';
import NewScheduleModal from './NewScheduleModal';
import OpenScheduleModal from './OpenScheduleModal';
import WebBrowserModal from './WebBrowserModal';
import RemoteControlModal from './RemoteControlModal';
import { Song, PresentationItem, Asset } from '../types';
import { PresentationEditorModal } from './PresentationEditorModal';
import { matchesShortcut } from '../utils/keyboardShortcuts';

export default function ModeratorView() {
  const store = useStore();
  const { loadAllData, shortcutSettings, outputGroups } = store;
  const workspace = useWorkspace();
  const { resetLayout } = workspace;

  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [isSongEditorOpen, setIsSongEditorOpen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [isNewScheduleOpen, setIsNewScheduleOpen] = useState(false);
  const [isOpenScheduleOpen, setIsOpenScheduleOpen] = useState(false);
  const [isWebBrowserOpen, setIsWebBrowserOpen] = useState(false);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [isRemoteControlOpen, setIsRemoteControlOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  const [editingScheduleItem, setEditingScheduleItem] = useState<PresentationItem | null>(null);
  const [isPresentationEditorOpen, setIsPresentationEditorOpen] = useState(false);
  const [editingPresentationAsset, setEditingPresentationAsset] = useState<Asset | null>(null);
  const [editingSchedulePresentationItem, setEditingSchedulePresentationItem] = useState<PresentationItem | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Global listener for opening presentation editor
  useEffect(() => {
    const handleOpenPresentationEditor = (e: CustomEvent) => {
      if (e.detail?.presentation) {
        setEditingPresentationAsset(e.detail.presentation);
      } else {
        setEditingPresentationAsset(null);
      }
      setEditingSchedulePresentationItem(null);
      setIsPresentationEditorOpen(true);
    };

    window.addEventListener('simpleworship:open-presentation-editor' as any, handleOpenPresentationEditor);
    return () => {
      window.removeEventListener('simpleworship:open-presentation-editor' as any, handleOpenPresentationEditor);
    };
  }, []);

  // Proactive Caching Mechanism for PPTX Binary Data
  // Removed proactive PPTX hydration to prevent heavy binary data in the global state.
  // PptxRenderOverlay now dynamically fetches binaries when needed.
  useEffect(() => {
    // Keep the dependency array but no-op, or just remove the effect contents.
  }, [store.activeSchedule?.items]);

  useEffect(() => {
    loadAllData();

    // Listen to custom notify events
    const handleNotification = (e: any) => {
      if (e.detail === 'Resetting workspace layout...') {
        resetLayout();
      } else {
        setNotification(e.detail);
        setTimeout(() => setNotification(null), 3500);
      }
    };

    const handleIdentifyDisplays = () => {
      // Check if Electron is handling it natively. If not, show browser fallback.
      if (window.electronAPI && typeof window.electronAPI.identifyDisplays === 'function') {
        return; // Handled natively by Electron
      }

      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100vw';
      overlay.style.height = '100vh';
      overlay.style.zIndex = '999999';
      overlay.style.backgroundColor = 'rgba(10, 11, 14, 0.45)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.pointerEvents = 'none';
      overlay.style.transition = 'opacity 0.5s ease';
      
      const card = document.createElement('div');
      card.style.background = 'rgba(18, 19, 23, 0.95)';
      card.style.border = '2px solid #06b6d4';
      card.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(6, 182, 212, 0.3)';
      card.style.borderRadius = '16px';
      card.style.padding = '40px 60px';
      card.style.textAlign = 'center';
      
      const num = document.createElement('div');
      num.style.fontSize = '140px';
      num.style.fontWeight = '900';
      num.style.color = '#06b6d4';
      num.style.lineHeight = '1';
      num.style.margin = '0';
      num.style.textShadow = '0 0 20px rgba(6, 182, 212, 0.4)';
      num.textContent = '1';
      
      const label = document.createElement('div');
      label.style.fontSize = '16px';
      label.style.fontWeight = '700';
      label.style.color = '#94a3b8';
      label.style.textTransform = 'uppercase';
      label.style.letterSpacing = '2px';
      label.style.marginTop = '10px';
      label.textContent = `${window.innerWidth}x${window.innerHeight} Primary (Browser Preview)`;
      
      card.appendChild(num);
      card.appendChild(label);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      
      setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 500);
      }, 2500);
    };

    const handleOpenDiagnostics = () => setIsDiagnosticsOpen(true);

    window.addEventListener('simpleworship:notify', handleNotification);
    window.addEventListener('simpleworship:identify-displays', handleIdentifyDisplays);
    window.addEventListener('simpleworship:open-diagnostics', handleOpenDiagnostics);
    return () => {
      window.removeEventListener('simpleworship:notify', handleNotification);
      window.removeEventListener('simpleworship:identify-displays', handleIdentifyDisplays);
      window.removeEventListener('simpleworship:open-diagnostics', handleOpenDiagnostics);
    };
  }, [loadAllData, resetLayout]);

  // Global Keyboard Shortcuts (Dynamic based on shortcutSettings)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputActive = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      const mappings = shortcutSettings?.keyMappings;

      // F1 or Ctrl+/ opens Center Shortcuts settings dialog from anywhere
      if (e.key === 'F1' || ((e.ctrlKey || e.metaKey) && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      // Don't trigger standard presentation shortcuts while actively typing in text fields
      if (isInputActive) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement)?.blur();
        }
        return;
      }

      // 1. GO LIVE controls
      if (
        matchesShortcut(e, mappings?.goLive) ||
        e.key === 'F5' || 
        (e.key === 'Enter' && (e.ctrlKey || e.metaKey || shortcutSettings?.enterGoesLive))
      ) {
        e.preventDefault();
        store.goLive();
        return;
      }

      // 2. Clear Output controls
      if (
        matchesShortcut(e, mappings?.clearOutput) ||
        e.key === 'F7' || 
        (shortcutSettings?.quickKeysBcl && e.key.toLowerCase() === 'c' && !e.altKey && !e.ctrlKey && !e.metaKey)
      ) {
        e.preventDefault();
        store.toggleClear();
        return;
      }

      // 3. Next Live Slide controls
      if (
        matchesShortcut(e, mappings?.nextSlide) ||
        (shortcutSettings?.arrowControlsLive && e.key === 'ArrowDown') ||
        e.key === 'PageDown' ||
        (shortcutSettings?.spacebarAdvancesLive && e.key === ' ')
      ) {
        e.preventDefault();
        store.goLiveNext();
        return;
      }

      // 4. Previous Live Slide controls
      if (
        matchesShortcut(e, mappings?.previousSlide) ||
        (shortcutSettings?.arrowControlsLive && e.key === 'ArrowUp') ||
        e.key === 'PageUp'
      ) {
        e.preventDefault();
        store.goLivePrev();
        return;
      }

      // 5. Schedule Navigation (Next / Previous Item)
      if (
        matchesShortcut(e, mappings?.nextItem) ||
        (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'n')
      ) {
        e.preventDefault();
        store.goNextScheduleItem();
        return;
      }
      if (
        matchesShortcut(e, mappings?.previousItem) ||
        (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'p')
      ) {
        e.preventDefault();
        store.goPrevScheduleItem();
        return;
      }

      // 6. Screen Mute Controls (Blackout / Logo)
      if (
        matchesShortcut(e, mappings?.blackout) ||
        e.key === 'F6' || 
        (shortcutSettings?.quickKeysBcl && e.key.toLowerCase() === 'b' && !e.altKey && !e.ctrlKey && !e.metaKey)
      ) {
        e.preventDefault();
        store.toggleBlack();
        return;
      }
      if (
        matchesShortcut(e, mappings?.logo) ||
        e.key === 'F8' || 
        (shortcutSettings?.quickKeysBcl && e.key.toLowerCase() === 'l' && !e.altKey && !e.ctrlKey && !e.metaKey)
      ) {
        e.preventDefault();
        store.toggleLogo();
        return;
      }


      // Slide Annotation Shortcuts
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        store.toggleAnnotationMode();
        return;
      }

      if (store.annotationState?.enabled) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
          e.preventDefault();
          store.undoAnnotation();
          return;
        }
        if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')) {
          e.preventDefault();
          store.redoAnnotation();
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
          e.preventDefault();
          store.clearAnnotations();
          return;
        }
      }

      // Quick Search
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsQuickSearchOpen(true);
        return;
      }
      // 6. Escape Key (Restore normal presentation or close popups)
      if (e.key === 'Escape') {
        const activeGroup = store.activeControlGroupId ? store.groupStates[store.activeControlGroupId] : null;
        if (activeGroup && (activeGroup.isBlack || activeGroup.isClear || activeGroup.showLogo)) {
          if (activeGroup.isBlack) store.toggleBlack();
          if (activeGroup.isClear) store.toggleClear();
          if (activeGroup.showLogo) store.toggleLogo();
        }
        setIsShortcutsOpen(false);
        setIsQuickSearchOpen(false);
        setIsAlertsOpen(false);
        setIsSettingsOpen(false);
        return;
      }

      // 7. Numeric Direct Verse Jump (1-9)
      if (shortcutSettings?.numericQuickJump && ['1','2','3','4','5','6','7','8','9'].includes(e.key)) {
        const num = parseInt(e.key, 10);
        if (store.activeControlGroupId) {
          e.preventDefault();
          store.setGroupState(store.activeControlGroupId, { activeSlideIndex: num - 1 });
          window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Jumped to Slide #${num}` }));
        }
        return;
      }

      // 8. Ctrl+F / Cmd+F -> Focus Search Bar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('simpleworship:focus-search', { detail: { target: 'songs' } }));
        return;
      }

      // 9. Ctrl+N -> New Song Editor
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setEditingSong(null);
        setIsSongEditorOpen(true);
        return;
      }

      // 10. Ctrl+S -> Save Schedule
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Schedule saved to local database!' }));
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store, shortcutSettings]);

  return (
    <div className="enterprise-workspace bg-[#141519] text-gray-200 overflow-hidden font-sans select-none relative">
      {/* 1. Top Command & Menu Toolbar */}
      <TopToolbar
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenQuickSearch={() => setIsQuickSearchOpen(true)}
        onOpenDiagnostics={() => setIsDiagnosticsOpen(true)}
        onOpenNewSchedule={() => setIsNewScheduleOpen(true)}
        onOpenOpenSchedule={() => setIsOpenScheduleOpen(true)}
        onOpenWebBrowser={() => setIsWebBrowserOpen(true)}
        onOpenMediaLibrary={() => setIsMediaLibraryOpen(true)}
        onOpenRemoteControl={() => setIsRemoteControlOpen(true)}
        onOpenNewSong={() => {
          setEditingSong(null);
          setIsSongEditorOpen(true);
        }}
      />

      {/* 2. Flexible Resizable Workspace Grid (Managed by LayoutManager) */}
      <LayoutManager
        onOpenNewSong={() => {
          setEditingSong(null);
          setIsSongEditorOpen(true);
        }}
        onEditSong={(song) => {
          setEditingSong(song);
          setIsSongEditorOpen(true);
        }}
        onEditScheduleItem={(item) => {
          if (item.type === 'presentation' || item.type === 'ppt') {
            const presAsset: Asset = {
              id: item.contentId || item.id,
              name: item.name,
              type: 'document',
              hash: '',
              url: '',
              data: item.data || {},
              createdAt: Date.now()
            };
            setEditingPresentationAsset(presAsset);
            setEditingSchedulePresentationItem(item);
            setIsPresentationEditorOpen(true);
          } else {
            setEditingScheduleItem(item);
          }
        }}
      />

      {/* 3. Draggable / Floating Windows Layer */}
      <FloatingPanel id="schedule" icon={<Layers size={13} />}>
        <SchedulePanel 
          onEditSlide={(item) => {
            if (item.type === 'presentation' || item.type === 'ppt') {
              const presAsset: Asset = {
                id: item.contentId || item.id,
                name: item.name,
                type: 'document',
                hash: '',
                url: '',
                data: item.data || {},
                createdAt: Date.now()
              };
              setEditingPresentationAsset(presAsset);
              setEditingSchedulePresentationItem(item);
              setIsPresentationEditorOpen(true);
            } else {
              setEditingScheduleItem(item);
            }
          }}
          onOpenNewSong={() => {
            setEditingSong(null);
            setIsSongEditorOpen(true);
          }}
          onEditSong={(song) => {
            setEditingSong(song);
            setIsSongEditorOpen(true);
          }}
        />
      </FloatingPanel>

      {/* Fixed primary Live panel via Workspace Layout (if floating, LayoutManager hides its fixed one) */}
      <FloatingPanel id="live" icon={<Tv size={13} />}>
        <div className="flex h-full w-full">
          {store.routerPanels[0] ? (
            <div className="flex-1 h-full overflow-hidden">
              <LivePanel 
                groupId={store.routerPanels[0].targetOutputGroupId || outputGroups[0]?.id} 
                routerId={store.routerPanels[0].routerId}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 text-xs">
              No active router panel
            </div>
          )}
        </div>
      </FloatingPanel>

      {/* Dynamic Additional Router Panels */}
      {store.routerPanels.slice(1).map(router => (
        <FloatingPanel key={router.routerId} id={`live-${router.routerId}`} icon={<Tv size={13} />}>
          <div className="flex h-full w-full">
            <div className="flex-1 h-full overflow-hidden">
              <LivePanel 
                groupId={router.targetOutputGroupId || outputGroups[0]?.id} 
                routerId={router.routerId}
              />
            </div>
          </div>
        </FloatingPanel>
      ))}

      <FloatingPanel id="multiGroup" icon={<Monitor size={13} />}>
        <MultiGroupPreviewBar />
      </FloatingPanel>

      <FloatingPanel id="stageMonitor" icon={<Clock size={13} />}>
        <StageMonitorContent />
      </FloatingPanel>

      <FloatingPanel id="quickNotes" icon={<FileText size={13} />}>
        <QuickNotesContent />
      </FloatingPanel>

      <FloatingPanel id="mediaLibrary" icon={<Film size={13} />}>
        <MediaLibraryPanel />
      </FloatingPanel>

      {/* 4. Popups & Modals */}
      {isNewScheduleOpen && (
        <NewScheduleModal onClose={() => setIsNewScheduleOpen(false)} />
      )}

      {isOpenScheduleOpen && (
        <OpenScheduleModal onClose={() => setIsOpenScheduleOpen(false)} />
      )}

      {isWebBrowserOpen && (
        <WebBrowserModal onClose={() => setIsWebBrowserOpen(false)} />
      )}

      {isMediaLibraryOpen && (
        <MediaLibraryModal onClose={() => setIsMediaLibraryOpen(false)} />
      )}

      {isRemoteControlOpen && (
        <RemoteControlModal onClose={() => setIsRemoteControlOpen(false)} />
      )}

      {isQuickSearchOpen && (
        <QuickSongSearchModal onClose={() => setIsQuickSearchOpen(false)} />
      )}

      {isShortcutsOpen && (
        <CenterShortcutSettingsModal onClose={() => setIsShortcutsOpen(false)} />
      )}

      {isAlertsOpen && (
        <AlertModal onClose={() => setIsAlertsOpen(false)} />
      )}

      {isSettingsOpen && (
        <OptionsDialog onClose={() => setIsSettingsOpen(false)} />
      )}

      {isSongEditorOpen && (
        <SongEditorModal
          mode="library"
          song={editingSong}
          onClose={() => {
            setIsSongEditorOpen(false);
            setEditingSong(null);
          }}
        />
      )}

      {isPresentationEditorOpen && (
        <PresentationEditorModal
          presentation={editingPresentationAsset}
          onClose={() => {
            setIsPresentationEditorOpen(false);
            setEditingPresentationAsset(null);
            setEditingSchedulePresentationItem(null);
          }}
          onSaved={(savedAsset) => {
            store.loadAllData();
            if (editingSchedulePresentationItem) {
              store.updateScheduleItem(editingSchedulePresentationItem.id, {
                name: savedAsset.name,
                data: savedAsset.data
              });
            }
          }}
        />
      )}

      {editingScheduleItem && (
        <SongEditorModal
          mode="schedule-item"
          scheduleItem={editingScheduleItem}
          onClose={() => {
            setEditingScheduleItem(null);
          }}
          onSaveScheduleItem={(updatedFields, updateMasterToo) => {
            store.updateScheduleItem(editingScheduleItem.id, updatedFields);
          }}
        />
      )}

      <TargetSelectionModal />

      {/* 5. System Architecture Diagnostics Modal */}
      {isDiagnosticsOpen && (
        <SystemDiagnosticsModal onClose={() => setIsDiagnosticsOpen(false)} />
      )}

      {/* 7. Toast Notification */}
      {notification && (
        <div className="fixed bottom-12 right-6 z-50 bg-[#1c2230] border border-indigo-500/60 text-white px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          <span>{notification}</span>
        </div>
      )}
    </div>
  );
}
