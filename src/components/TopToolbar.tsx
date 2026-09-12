import React, { useState, useRef, useEffect } from 'react';
import { 
  FilePlus, 
  FolderOpen, 
  Save, 
  Globe, 
  Radio, 
  Play, 
  Bell, 
  Image as ImageIcon, 
  Square, 
  EyeOff, 
  Tv, 
  Settings,
  Search, 
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Minus,
  Check,
  X,
  Maximize2,
  Copy,
  Layout,
  Layers,
  Pin,
  Keyboard,
  Sliders,
  ShieldCheck,
  Calendar,
  Clock,
  Printer,
  Info,
  Package,
  BookOpen,
  Film,
  Trash2,
  Plus,
  Timer
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { useWorkspace } from '../context/WorkspaceContext';
import { dbApi } from '../db';
import { Schedule } from '../types';
import ProfilesManagerModal from './ProfilesManagerModal';
import SimpleWorshipLogo from './SimpleWorshipLogo';
import AboutModal from './AboutModal';
import PrintScheduleModal from './PrintScheduleModal';
import UnsavedChangesModal from './UnsavedChangesModal';
import SaveScheduleAsModal from './SaveScheduleAsModal';
import ThemeTemplateModal from './ThemeTemplateModal';
import { downloadSwsFile, readSwsFile, encodeSwsPackage } from '../services/swsService';
import { forceSyncNow } from '../store/sync';

interface TopToolbarProps {
  onOpenAlerts: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts?: () => void;
  onOpenNewSchedule?: () => void;
  onOpenOpenSchedule?: () => void;
  onOpenWebBrowser?: () => void;
  onOpenMediaLibrary?: () => void;
  onOpenRemoteControl?: () => void;
  onOpenQuickSearch: () => void;
  onOpenDiagnostics?: () => void;
  onOpenNewSong?: () => void;
  onOpenTimers?: () => void;
}

export default function TopToolbar({ 
  onOpenAlerts, 
  onOpenSettings,
  onOpenShortcuts, 
  onOpenNewSchedule, 
  onOpenOpenSchedule,
  onOpenWebBrowser,
  onOpenMediaLibrary,
  onOpenRemoteControl,
  onOpenQuickSearch, 
  onOpenDiagnostics,
  onOpenNewSong,
  onOpenTimers
}: TopToolbarProps) {
  const store = useStore();
  const workspace = useWorkspace();
  const { 
    activeControlGroupId, 
    groupStates, 
    outputGroups, 
    goLive, 
    goLivePrev,
    toggleBlack, 
    toggleClear, 
    toggleLogo, 
    toggleMasterLive,
    alert: alertState
  } = store;

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showProfilesModal, setShowProfilesModal] = useState(false);
  const [initialCreateInProfilesModal, setInitialCreateInProfilesModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [showThemeTemplateModal, setShowThemeTemplateModal] = useState(false);
  const [isWindowMaximized, setIsWindowMaximized] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [recentSchedules, setRecentSchedules] = useState<Schedule[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timer active tracking (highlights only when actively in use: running or showing on main display)
  const serviceIntervals = store.systemOptions?.serviceIntervals;
  const [timerNow, setTimerNow] = useState(() => Date.now());

  useEffect(() => {
    if (!serviceIntervals?.isRunning || !serviceIntervals?.targetTimestamp) return;
    const interval = setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [serviceIntervals?.isRunning, serviceIntervals?.targetTimestamp]);

  const isTimerRunning = Boolean(
    serviceIntervals?.isRunning &&
    (!serviceIntervals.targetTimestamp || serviceIntervals.targetTimestamp > timerNow)
  );
  const isTimerShowing = Boolean(serviceIntervals?.showOnMainDisplay);
  const isTimerActive = isTimerRunning || isTimerShowing;

  // Monitor window maximized and fullscreen states
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.isWindowMaximized) {
      window.electronAPI.isWindowMaximized().then(setIsWindowMaximized).catch(() => {});
    }

    if (typeof window !== 'undefined' && window.electronAPI?.onWindowStateChanged) {
      const unsub = window.electronAPI.onWindowStateChanged((maximized) => {
        setIsWindowMaximized(maximized);
      });
      return () => {
        if (typeof unsub === 'function') unsub();
      };
    }

    const handleFullscreenChange = () => {
      setIsWindowMaximized(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleMinimizeWindow = async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.minimizeWindow) {
      try {
        await window.electronAPI.minimizeWindow();
        return;
      } catch (err) {
        console.error('Failed to minimize electron window:', err);
      }
    }
    handleNotify('Main window minimized');
  };

  const handleToggleMaximizeWindow = async () => {
    if (typeof window !== 'undefined' && window.electronAPI?.toggleMaximizeWindow) {
      try {
        const nextState = await window.electronAPI.toggleMaximizeWindow();
        setIsWindowMaximized(nextState);
        return;
      } catch (err) {
        console.error('Failed to toggle maximize in electron:', err);
      }
    }
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsWindowMaximized(true);
      } else {
        await document.exitFullscreen();
        setIsWindowMaximized(false);
      }
    } catch (err) {
      setIsWindowMaximized(!isWindowMaximized);
    }
  };

  const handleCloseWindow = () => {
    setShowExitModal(true);
  };

  const handleConfirmExit = async () => {
    setShowExitModal(false);
    if (typeof window !== 'undefined' && window.electronAPI?.closeWindow) {
      try {
        await window.electronAPI.closeWindow();
        return;
      } catch (err) {
        console.error('Failed to close electron window:', err);
      }
    }
    handleNotify('Session closed');
    try {
      window.close();
    } catch (e) {
      // Browser sandbox may restrict window.close
    }
  };

  const activeControlState = activeControlGroupId && groupStates[activeControlGroupId] 
    ? groupStates[activeControlGroupId] 
    : null;

  // Load recent schedules when opening dropdown
  const loadRecentSchedules = async () => {
    try {
      const all = await dbApi.getAllSchedules();
      setRecentSchedules(all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8));
    } catch (e) {
      console.error('Error fetching recent schedules:', e);
    }
  };

  const handleSaveSchedule = async () => {
    if (!store.activeSchedule) {
      handleNotify('No active schedule to save');
      return;
    }

    try {
      await dbApi.addSchedule(store.activeSchedule);
      const allSongs = await dbApi.getAllSongs();
      const allThemes = await dbApi.getAllThemes();
      const usedSongIds = new Set(
        store.activeSchedule.items.filter(it => it.type === 'song').map(it => it.contentId || it.id)
      );
      const bundledSongs = allSongs.filter(s => usedSongIds.has(s.id));
      await downloadSwsFile(store.activeSchedule, undefined, bundledSongs, allThemes, store.systemOptions, store.outputGroups);
      handleNotify(`Enterprise schedule "${store.activeSchedule.name}.sws" saved with embedded SimpleWorship icon & assets!`);
    } catch (err) {
      console.error('Failed to save schedule:', err);
      handleNotify('Error saving schedule');
    }
  };

  const handleSaveScheduleAs = async () => {
    const defaultName = store.activeSchedule?.name || 'Sunday Morning Service';
    const newName = prompt('Save Schedule As:', defaultName);
    if (!newName) return;

    try {
      const updated: Schedule = {
        ...(store.activeSchedule || { id: `sched-${Date.now()}`, items: [] }),
        id: `sched-${Date.now()}`,
        name: newName,
        createdAt: Date.now()
      };
      await dbApi.addSchedule(updated);
      store.setActiveSchedule(updated);
      const allSongs = await dbApi.getAllSongs();
      const allThemes = await dbApi.getAllThemes();
      const usedSongIds = new Set(
        updated.items.filter(it => it.type === 'song').map(it => it.contentId || it.id)
      );
      const bundledSongs = allSongs.filter(s => usedSongIds.has(s.id));
      await downloadSwsFile(updated, newName, bundledSongs, allThemes, store.systemOptions, store.outputGroups);
      handleNotify(`Schedule saved as "${newName}.sws" with SimpleWorship branding!`);
    } catch (err) {
      console.error('Save As failed:', err);
    }
  };

  const handleExportStandalone = async () => {
    if (!store.activeSchedule) return;
    try {
      const allSongs = await dbApi.getAllSongs();
      const allThemes = await dbApi.getAllThemes();

      // Collect only songs and themes used in schedule
      const usedSongIds = new Set(
        store.activeSchedule.items.filter(it => it.type === 'song').map(it => it.contentId || it.id)
      );
      const bundledSongs = allSongs.filter(s => usedSongIds.has(s.id));
      
      const safeName = store.activeSchedule.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      await downloadSwsFile(store.activeSchedule, `${safeName}_standalone`, bundledSongs, allThemes, store.systemOptions, store.outputGroups);

      handleNotify(`Standalone package "${safeName}_standalone.sws" exported with embedded icons, songs & themes!`);
    } catch (err) {
      console.error('Export standalone failed:', err);
      handleNotify('Export failed');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { schedule, bundledSongs, bundledThemes, systemOptions, outputGroups } = await readSwsFile(file);

      if (bundledSongs && bundledSongs.length > 0) {
        for (const s of bundledSongs) {
          await dbApi.addSong(s).catch(() => {});
        }
      }
      if (bundledThemes && bundledThemes.length > 0) {
        for (const t of bundledThemes) {
          await dbApi.addTheme(t).catch(() => {});
        }
      }
      
      if (systemOptions) {
        store.updateSystemOptions(systemOptions);
      }
      
      if (outputGroups && outputGroups.length > 0) {
        store.setOutputGroups(outputGroups);
      }

      await dbApi.addSchedule(schedule);
      store.setActiveSchedule(schedule);
      handleNotify(`Imported schedule "${schedule.name}" (${schedule.items.length} items)!`);
    } catch (err: any) {
      console.error('Failed to parse schedule file:', err);
      alert(`Invalid schedule file: ${err.message}`);
    }
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
        setActiveSubmenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotify = (msg: string) => {
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: msg }));
    setActiveMenu(null);
    setActiveSubmenu(null);
  };

  // Edit actions
  const handleEditCopy = () => {
    if (store.activeSchedule && store.previewItemId) {
      const item = store.activeSchedule.items.find(it => it.id === store.previewItemId);
      if (item) {
        navigator.clipboard?.writeText(JSON.stringify(item)).catch(() => {});
        handleNotify(`Copied "${item.name}" to clipboard`);
        return;
      }
    }
    if (store.activeSchedule && store.activeSchedule.items.length > 0) {
      const item = store.activeSchedule.items[0];
      navigator.clipboard?.writeText(JSON.stringify(item)).catch(() => {});
      handleNotify(`Copied "${item.name}" to clipboard`);
      return;
    }
    handleNotify('No schedule item to copy');
  };

  const handleEditPaste = async () => {
    try {
      const text = await navigator.clipboard?.readText();
      if (text && store.activeSchedule) {
        const item = JSON.parse(text);
        if (item && item.name && item.type) {
          const newItem = { ...item, id: `item-${Date.now()}` };
          const updatedItems = [...store.activeSchedule.items, newItem];
          store.setActiveSchedule({ ...store.activeSchedule, items: updatedItems });
          handleNotify(`Pasted "${newItem.name}" into schedule`);
          return;
        }
      }
    } catch (e) {}
    handleNotify('Clipboard is empty or contains non-schedule data');
  };

  const handleEditDelete = () => {
    if (store.activeSchedule && store.previewItemId) {
      const item = store.activeSchedule.items.find(it => it.id === store.previewItemId);
      if (item) {
        store.removeScheduleItem(item.id);
        handleNotify(`Removed "${item.name}" from schedule`);
        return;
      }
    }
    handleNotify('Select an item in schedule to delete');
  };

  return (
    <header className="bg-gradient-to-b from-[#383c44] via-[#2a2d34] to-[#22242a] border-b border-[#151619] select-none text-gray-200" ref={menuRef}>
      {/* 1. Window Title Bar (SimpleWorship - Clean Modern Branding) */}
      <div className="app-drag-region flex items-center justify-between px-3 py-1 text-xs border-b border-[#18191c] bg-[#1a1c22] text-gray-300 select-none min-w-0">
        <div className="app-no-drag flex items-center gap-2 min-w-0 mr-auto">
          {/* SimpleWorship Modern Vector Logo */}
          <SimpleWorshipLogo size={18} showText={false} />
          <span className="font-semibold text-xs tracking-tight text-white flex items-center gap-1.5 min-w-0">
            <span className="shrink-0">SimpleWorship</span>
            <span className="text-[10px] text-cyan-400 font-mono font-normal shrink-0">v7.4</span>
            <span className="text-gray-500 font-normal shrink-0">•</span>
            <span className="text-gray-400 font-normal truncate max-w-[140px] sm:max-w-[260px]" title={store.activeSchedule?.name || 'Default Service'}>{store.activeSchedule?.name || 'Default Service'}</span>
          </span>
        </div>

        {/* Window controls */}
        <div className="app-no-drag flex items-center h-full -mr-3 -my-1 shrink-0">
          <button 
            id="btn-window-minimize"
            onClick={handleMinimizeWindow}
            className="w-10 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#2e323b] active:bg-[#3d424e] transition-colors cursor-pointer select-none"
            title="Minimize (Ctrl+M)"
            aria-label="Minimize Window"
          >
            <Minus size={13} strokeWidth={2} />
          </button>
          <button 
            id="btn-window-maximize"
            onClick={handleToggleMaximizeWindow}
            className="w-10 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#2e323b] active:bg-[#3d424e] transition-colors cursor-pointer select-none"
            title={isWindowMaximized ? "Restore Down (F11)" : "Maximize (F11)"}
            aria-label={isWindowMaximized ? "Restore Window" : "Maximize Window"}
          >
            {isWindowMaximized ? (
              <Copy size={11} className="rotate-90" strokeWidth={2} />
            ) : (
              <Square size={11} strokeWidth={2} />
            )}
          </button>
          <button 
            id="btn-window-close"
            onClick={handleCloseWindow}
            className="w-11 h-7 flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#e81123] active:bg-[#c4101e] transition-colors cursor-pointer select-none"
            title="Close SimpleWorship (Alt+F4)"
            aria-label="Close Window"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* 2. Standard Dropdown Menu Bar (File, Edit, Live, Profiles, View, Help) */}
      <div className="relative flex items-center px-2 py-0.5 text-xs bg-[#24272f] border-b border-[#1c1d22] text-gray-300">
        <div className="flex items-center space-x-0.5">
          {/* FILE MENU */}
          <div className="relative">
            <button
              onClick={() => {
                if (activeMenu !== 'File') loadRecentSchedules();
                setActiveMenu(activeMenu === 'File' ? null : 'File');
              }}
              onMouseEnter={() => activeMenu && (loadRecentSchedules(), setActiveMenu('File'))}
              className={`px-2.5 py-0.5 rounded-xs text-[11px] transition-colors ${
                activeMenu === 'File' ? 'bg-[#3b404d] text-white' : 'hover:bg-[#313540]'
              }`}
            >
              File
            </button>

            {activeMenu === 'File' && (
              <div className="absolute left-0 top-full mt-0.5 w-64 bg-[#22252c] border border-[#3b404d] rounded-xs shadow-2xl z-50 text-[11px] py-1 text-gray-200 animate-in fade-in zoom-in-95 duration-100">
                {/* New Submenu */}
                <div 
                  className="relative group"
                  onMouseEnter={() => setActiveSubmenu('new')}
                >
                  <button className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white text-left cursor-pointer">
                    <span className="flex items-center gap-1.5">
                      <FilePlus size={12} className="text-cyan-400" />
                      <span>New</span>
                    </span>
                    <ChevronRight size={12} className="text-gray-400" />
                  </button>
                  {activeSubmenu === 'new' && (
                    <div className="absolute left-full top-0 ml-0.5 w-52 bg-[#22252c] border border-[#3b404d] rounded-xs shadow-2xl py-1 text-[11px] z-50">
                      <button 
                        type="button"
                        onClick={() => {
                          if (onOpenNewSchedule) onOpenNewSchedule();
                          setActiveMenu(null);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#323744] hover:text-white flex items-center gap-1.5 text-cyan-300 font-medium cursor-pointer"
                      >
                        <Calendar size={12} />
                        <span>Schedule...</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => { 
                          if (onOpenNewSong) {
                            onOpenNewSong();
                          } else {
                            window.dispatchEvent(new CustomEvent('simpleworship:switch-sidebar-tab', { detail: 'songs' }));
                            workspace.updatePanelCollapsed('schedule', false);
                          }
                          setActiveMenu(null);
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#323744] hover:text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        <FilePlus size={12} className="text-emerald-400" />
                        <span>Song...</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => { 
                          window.dispatchEvent(new CustomEvent('simpleworship:switch-sidebar-tab', { detail: 'scriptures' }));
                          workspace.updatePanelCollapsed('schedule', false);
                          setActiveMenu(null); 
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#323744] hover:text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        <BookOpen size={12} className="text-amber-400" />
                        <span>Scripture...</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => { 
                          window.dispatchEvent(new CustomEvent('simpleworship:open-presentation-editor'));
                          setActiveMenu(null); 
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#323744] hover:text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        <Layout size={12} className="text-purple-400" />
                        <span>Presentation...</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => { 
                          setShowThemeTemplateModal(true); 
                          setActiveMenu(null); 
                          setActiveSubmenu(null);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-[#323744] hover:text-white flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sliders size={12} className="text-indigo-400" />
                        <span>Theme Template...</span>
                      </button>
                    </div>
                  )}
                </div>

                <button 
                  type="button"
                  onClick={() => {
                    if (onOpenOpenSchedule) onOpenOpenSchedule();
                    setActiveMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white text-left cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <FolderOpen size={12} className="text-cyan-400" />
                    <span>Open Schedule (.sws)</span>
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">Ctrl+O</span>
                </button>

                {/* Open Recent Submenu */}
                <div 
                  className="relative group"
                  onMouseEnter={() => { setActiveSubmenu('recent'); loadRecentSchedules(); }}
                >
                  <button className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white text-left cursor-pointer">
                    <span className="flex items-center gap-1.5">
                      <Clock size={12} className="text-gray-400" />
                      <span>Open Recent</span>
                    </span>
                    <ChevronRight size={12} className="text-gray-400" />
                  </button>
                  {activeSubmenu === 'recent' && (
                    <div className="absolute left-full top-0 ml-0.5 w-60 bg-[#22252c] border border-[#3b404d] rounded-xs shadow-2xl py-1 text-[11px] max-h-64 overflow-y-auto z-50">
                      {recentSchedules.length === 0 ? (
                        <div className="px-3 py-1.5 text-gray-500 italic">No recent schedules</div>
                      ) : (
                        recentSchedules.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              store.setActiveSchedule(s);
                              handleNotify(`Loaded "${s.name}"`);
                              setActiveMenu(null);
                              setActiveSubmenu(null);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-[#323744] hover:text-white flex items-center justify-between text-gray-300 cursor-pointer"
                          >
                            <span className="truncate max-w-[150px]">{s.name}</span>
                            <span className="text-[10px] text-gray-500 font-mono">{s.items.length} items</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-[#313540] my-1"></div>

                <button 
                  type="button"
                  onClick={() => {
                    handleSaveSchedule();
                    setActiveMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white text-left cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Save size={12} className="text-blue-400" />
                    <span>Save Schedule (.sws)</span>
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">Ctrl+S</span>
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    setShowSaveAsModal(true);
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#323744] hover:text-white cursor-pointer"
                >
                  Save Schedule As (.sws)...
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    handleExportStandalone();
                    setActiveMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white text-left cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 text-cyan-300 font-medium">
                    <Package size={12} />
                    <span>Export Standalone Package...</span>
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">.sws</span>
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    store.setActiveSchedule({ id: `sched-${Date.now()}`, name: 'Blank Schedule', createdAt: Date.now(), items: [] });
                    handleNotify('Schedule closed');
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#323744] hover:text-white text-gray-400 hover:text-white cursor-pointer"
                >
                  Close Schedule
                </button>

                <div className="border-t border-[#313540] my-1"></div>

                <button 
                  type="button"
                  onClick={() => {
                    setShowPrintModal(true);
                    setActiveMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white text-left cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Printer size={12} className="text-amber-400" />
                    <span>Reports and Printing...</span>
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">Print</span>
                </button>

                <div className="border-t border-[#313540] my-1"></div>

                <button 
                  type="button"
                  onClick={() => {
                    setShowExitModal(true);
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-rose-950 hover:text-rose-300 text-rose-400 cursor-pointer"
                >
                  Exit
                </button>
              </div>
            )}
          </div>

          {/* EDIT MENU */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'Edit' ? null : 'Edit')}
              onMouseEnter={() => activeMenu && setActiveMenu('Edit')}
              className={`px-2.5 py-0.5 rounded-xs text-[11px] transition-colors ${
                activeMenu === 'Edit' ? 'bg-[#3b404d] text-white' : 'hover:bg-[#313540]'
              }`}
            >
              Edit
            </button>

            {activeMenu === 'Edit' && (
              <div className="absolute left-0 top-full mt-0.5 w-56 bg-[#22252c] border border-[#3b404d] rounded-xs shadow-2xl z-50 text-[11px] py-1 text-gray-200 animate-in fade-in zoom-in-95 duration-100">
                <button onClick={handleEditCopy} className="w-full flex justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white">
                  <span>Copy Selected Item</span>
                  <span className="text-[10px] text-gray-400 font-mono">Ctrl+C</span>
                </button>
                <button onClick={handleEditPaste} className="w-full flex justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white">
                  <span>Paste Item</span>
                  <span className="text-[10px] text-gray-400 font-mono">Ctrl+V</span>
                </button>
                <button onClick={handleEditDelete} className="w-full flex justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white text-rose-300">
                  <span>Delete Selected Item</span>
                  <span className="text-[10px] text-gray-400 font-mono">Del</span>
                </button>
                <div className="border-t border-[#313540] my-1"></div>
                <button 
                  onClick={() => { 
                    onOpenSettings(); 
                    setActiveMenu(null); 
                  }} 
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white text-cyan-300"
                >
                  <span className="flex items-center gap-1.5">
                    <Settings size={12} />
                    <span>Options & Preferences...</span>
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono">F2</span>
                </button>
              </div>
            )}
          </div>

          {/* LIVE MENU */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'Live' ? null : 'Live')}
              onMouseEnter={() => activeMenu && setActiveMenu('Live')}
              className={`px-2.5 py-0.5 rounded-xs text-[11px] transition-colors ${
                activeMenu === 'Live' ? 'bg-[#3b404d] text-white' : 'hover:bg-[#313540]'
              }`}
            >
              Live
            </button>

            {activeMenu === 'Live' && (
              <div className="absolute left-0 top-full mt-0.5 w-64 bg-[#22252c] border border-[#3b404d] rounded-xs shadow-2xl z-50 text-[11px] py-1 text-gray-200 animate-in fade-in zoom-in-95 duration-100">
                <button 
                  onClick={() => { 
                    goLive(); 
                    setActiveMenu(null); 
                  }} 
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white font-semibold text-emerald-400 cursor-pointer"
                >
                  <span>Go Live</span>
                  <span className="text-[10px] font-mono text-emerald-500">F5</span>
                </button>
                <button 
                  onClick={() => { 
                    goLivePrev(); 
                    setActiveMenu(null); 
                  }} 
                  className="w-full text-left px-3 py-1.5 hover:bg-[#323744] hover:text-white cursor-pointer"
                >
                  Go Back to Previous Slide
                </button>
                <div className="border-t border-[#313540] my-1"></div>
                <button 
                  onClick={() => { 
                    toggleLogo(activeControlGroupId || store.outputGroups[0]?.id || ""); 
                    setActiveMenu(null); 
                  }} 
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white cursor-pointer"
                >
                  <span className={activeControlState?.showLogo ? 'text-cyan-300 font-semibold' : ''}>
                    Show Logo on Live Output
                  </span>
                  <div className="flex items-center gap-1.5">
                    {activeControlState?.showLogo && <Check size={12} className="text-cyan-400" />}
                    <span className="text-[10px] font-mono text-cyan-400">F8 / L</span>
                  </div>
                </button>
                <button 
                  onClick={() => { 
                    toggleBlack(activeControlGroupId || store.outputGroups[0]?.id || ""); 
                    setActiveMenu(null); 
                  }} 
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white cursor-pointer"
                >
                  <span className={activeControlState?.isBlack ? 'text-rose-400 font-semibold' : ''}>
                    Black on Live Output
                  </span>
                  <div className="flex items-center gap-1.5">
                    {activeControlState?.isBlack && <Check size={12} className="text-rose-400" />}
                    <span className="text-[10px] font-mono text-rose-400">F6 / B</span>
                  </div>
                </button>
                <button 
                  onClick={() => { 
                    toggleClear(activeControlGroupId || store.outputGroups[0]?.id || ""); 
                    setActiveMenu(null); 
                  }} 
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white cursor-pointer"
                >
                  <span className={activeControlState?.isClear ? 'text-amber-300 font-semibold' : ''}>
                    Clear Text on Live Output
                  </span>
                  <div className="flex items-center gap-1.5">
                    {activeControlState?.isClear && <Check size={12} className="text-amber-400" />}
                    <span className="text-[10px] font-mono text-amber-400">F7 / C</span>
                  </div>
                </button>
                <div className="border-t border-[#313540] my-1"></div>
                <button 
                  onClick={() => { 
                    onOpenAlerts(); 
                    setActiveMenu(null); 
                  }} 
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <Bell size={12} />
                    <span>Nursery & Screen Alert...</span>
                  </span>
                  {alertState?.active && <span className="text-[9px] px-1 bg-amber-500 text-black font-bold rounded">LIVE</span>}
                </button>
                <button 
                  onClick={() => { 
                    if (onOpenRemoteControl) onOpenRemoteControl(); 
                    setActiveMenu(null); 
                  }} 
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 text-purple-300">
                    <Radio size={12} />
                    <span>Mobile Remote Control Hub...</span>
                  </span>
                  <span className="text-[10px] font-mono text-gray-400">QR / PIN</span>
                </button>
                <div className="border-t border-[#313540] my-1"></div>
                <button 
                  onClick={() => { 
                    toggleMasterLive(activeControlGroupId || store.outputGroups[0]?.id || ""); 
                    setActiveMenu(null); 
                  }} 
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white font-bold cursor-pointer"
                >
                  <span className={activeControlState?.isLiveEnabled ? 'text-emerald-400' : ''}>
                    Show Target Live Output
                  </span>
                  {activeControlState?.isLiveEnabled && <Check size={13} className="text-cyan-400" />}
                </button>
              </div>
            )}
          </div>

          {/* PROFILES MENU */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'Profiles' ? null : 'Profiles')}
              onMouseEnter={() => activeMenu && setActiveMenu('Profiles')}
              className={`px-2.5 py-0.5 rounded-xs text-[11px] transition-colors ${
                activeMenu === 'Profiles' ? 'bg-[#3b404d] text-white' : 'hover:bg-[#313540]'
              }`}
            >
              Profiles
            </button>

            {activeMenu === 'Profiles' && (
              <div className="absolute left-0 top-full mt-0.5 w-56 bg-[#22252c] border border-[#3b404d] rounded-xs shadow-2xl z-50 text-[11px] py-1 text-gray-200 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Profiles
                </div>

                {store.profiles?.map(p => {
                  const isSelected = store.activeProfileId === p.id;
                  return (
                    <button 
                      key={p.id}
                      onClick={() => { 
                        store.setActiveProfile(p.id); 
                        setActiveMenu(null); 
                      }} 
                      className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#323744] hover:text-white cursor-pointer ${
                        isSelected ? 'text-cyan-300 font-semibold bg-[#2a2f3b]' : ''
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      {isSelected && <Check size={12} className="text-cyan-400 shrink-0 ml-1" />}
                    </button>
                  );
                })}

                <button
                  onClick={() => {
                    setInitialCreateInProfilesModal(true);
                    setShowProfilesModal(true);
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[#323744] text-gray-300 hover:text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus size={12} className="text-cyan-400" />
                  <span>New Profile</span>
                </button>

                <div className="border-t border-[#313540] my-1"></div>

                <button 
                  onClick={() => { 
                    setInitialCreateInProfilesModal(false);
                    setShowProfilesModal(true); 
                    setActiveMenu(null); 
                  }} 
                  className="w-full text-left px-3 py-1.5 hover:bg-[#323744] hover:text-cyan-200 text-cyan-400 font-medium cursor-pointer"
                >
                  Profiles Manager...
                </button>
              </div>
            )}
          </div>

          {/* VIEW MENU */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'View' ? null : 'View')}
              onMouseEnter={() => activeMenu && setActiveMenu('View')}
              className={`px-2.5 py-0.5 rounded-xs text-[11px] transition-colors ${
                activeMenu === 'View' ? 'bg-[#3b404d] text-white' : 'hover:bg-[#313540]'
              }`}
            >
              View
            </button>

            {activeMenu === 'View' && (
              <div className="absolute left-0 top-full mt-0.5 w-64 bg-[#22252c] border border-[#3b404d] rounded-xs shadow-2xl z-50 text-[11px] py-1 text-gray-200 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Live Output Panels</span>
                  <span className="text-[9px] font-mono text-cyan-400">({store.routerPanels.length})</span>
                </div>

                {store.routerPanels.map((router, index) => {
                  const isSelected = store.activeRouterId === router.routerId;
                  const targetGroup = store.outputGroups.find(g => g.id === router.targetOutputGroupId);
                  return (
                    <div
                      key={router.routerId}
                      className="w-full flex items-center justify-between px-3 py-1 hover:bg-[#323744] text-left group/panel"
                    >
                      <button
                        onClick={() => {
                          store.setActiveRouterId(router.routerId);
                          workspace.setPanelVisibility('live', true);
                          window.dispatchEvent(
                            new CustomEvent('simpleworship:notify', { 
                              detail: `Focused Output Panel: R-${index + 1} (${targetGroup?.name || 'Main Display'})` 
                            })
                          );
                          setActiveMenu(null);
                        }}
                        className="flex-1 flex items-center gap-1.5 truncate text-gray-200 hover:text-white cursor-pointer"
                      >
                        <span className="text-[10px] text-gray-500 font-mono">R-{index + 1}</span>
                        <span className="truncate">{targetGroup?.name || `Target: Display ${index + 1}`}</span>
                        {isSelected && <Check size={12} className="text-cyan-400 shrink-0 ml-1" />}
                      </button>

                      {store.routerPanels.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            store.removeRouterPanel(router.routerId);
                            window.dispatchEvent(
                              new CustomEvent('simpleworship:notify', { detail: `Removed Router Panel R-${index + 1}` })
                            );
                          }}
                          className="p-1 text-gray-500 hover:text-rose-400 opacity-0 group-hover/panel:opacity-100 transition-opacity ml-1 cursor-pointer"
                          title={`Remove Router Panel R-${index + 1}`}
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}

                <div className="flex items-center gap-1 px-3 py-1 mt-0.5">
                  <button
                    onClick={() => {
                      const nextIndex = store.routerPanels.length + 1;
                      const targetGroup = store.outputGroups[(nextIndex - 1) % store.outputGroups.length] || store.outputGroups[0];
                      store.addRouterPanel({
                        routerId: `router-${Date.now()}`,
                        targetOutputGroupId: targetGroup?.id || 'group-congregation',
                        active: true,
                        visible: true,
                        focused: true
                      });
                      window.dispatchEvent(
                        new CustomEvent('simpleworship:notify', { detail: `Added Live Output Panel R-${nextIndex}` })
                      );
                      setActiveMenu(null);
                    }}
                    className="flex-1 text-left py-0.5 text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>Add Panel</span>
                  </button>

                  {store.routerPanels.length > 1 && (
                    <button
                      onClick={() => {
                        const lastRouter = store.routerPanels[store.routerPanels.length - 1];
                        if (lastRouter) {
                          store.removeRouterPanel(lastRouter.routerId);
                          window.dispatchEvent(
                            new CustomEvent('simpleworship:notify', { detail: 'Removed last Router Panel' })
                          );
                        }
                        setActiveMenu(null);
                      }}
                      className="py-0.5 px-2 text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 text-[11px] cursor-pointer"
                      title="Remove last Router Panel"
                    >
                      <Minus size={12} />
                      <span>Remove Panel</span>
                    </button>
                  )}
                </div>
                <div className="border-t border-[#3b404d] my-1"></div>
                
                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Workspace Presets
                </div>

                {workspace.presets.map((preset) => {
                  const isSelected = workspace.activePresetId === preset.id;
                  return (
                    <div 
                      key={preset.id}
                      className="w-full flex items-center justify-between px-3 py-1 hover:bg-[#323744] text-left group/preset"
                    >
                      <button
                        onClick={() => {
                          workspace.applyPreset(preset.id);
                          setActiveMenu(null);
                        }}
                        className="flex-1 text-left truncate text-gray-200 hover:text-white cursor-pointer"
                      >
                        {preset.name}
                      </button>
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        {isSelected && <Check size={12} className="text-cyan-400" />}
                        {!preset.isBuiltIn && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm(`Are you sure you want to delete custom preset "${preset.name}"?`)) {
                                workspace.deleteCustomPreset(preset.id);
                              }
                            }}
                            className="text-gray-500 hover:text-rose-400 p-0.5 rounded opacity-0 group-hover/preset:opacity-100 transition-opacity cursor-pointer"
                            title="Delete Custom Preset"
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="border-t border-[#313540] my-1"></div>

                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Panels & Windows
                </div>

                {(
                  [
                    { id: 'schedule', label: 'Schedule Panel' },
                    { id: 'live', label: 'Live Output Panel' },
                    { id: 'multiGroup', label: 'Multi-Group Displays' },
                    { id: 'quickNotes', label: 'Quick Notes & Script' },
                  ] as const
                ).map(({ id, label }) => {
                  const p = workspace.panels[id];
                  const isVisible = p?.visible;
                  const isDocked = p?.isDocked;

                  return (
                    <div key={id} className="flex items-center justify-between px-3 py-0.5 hover:bg-[#323744]">
                      <button
                        onClick={() => workspace.togglePanelVisibility(id)}
                        className="flex items-center gap-1.5 flex-1 text-left py-0.5 text-gray-200 hover:text-white cursor-pointer"
                      >
                        <span className="w-3.5 h-3.5 flex items-center justify-center">
                          {isVisible ? <Check size={11} className="text-cyan-400" /> : null}
                        </span>
                        <span className="truncate">{label}</span>
                      </button>

                      <button
                        onClick={() => workspace.togglePanelDock(id)}
                        className={`text-[9px] px-1.5 py-0.2 rounded border font-mono transition-colors cursor-pointer ${
                          isDocked
                            ? 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
                            : 'bg-cyan-950 border-cyan-700 text-cyan-300 hover:bg-cyan-900'
                        }`}
                        title={isDocked ? 'Docked (Click to Float Window)' : 'Floating Window (Click to Dock)'}
                      >
                        {isDocked ? 'Docked' : 'Float'}
                      </button>
                    </div>
                  );
                })}

                <div className="border-t border-[#313540] my-1"></div>

                <button
                  onClick={() => {
                    workspace.resetLayout();
                    setActiveMenu(null);
                  }}
                  className="w-full text-left px-3 py-1 hover:bg-rose-950 hover:text-rose-300 text-rose-400 font-medium cursor-pointer"
                >
                  Reset Workspace Layout to Default
                </button>
              </div>
            )}
          </div>

          {/* HELP MENU */}
          <div className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === 'Help' ? null : 'Help')}
              onMouseEnter={() => activeMenu && setActiveMenu('Help')}
              className={`px-2.5 py-0.5 rounded-xs text-[11px] transition-colors ${
                activeMenu === 'Help' ? 'bg-[#3b404d] text-white' : 'hover:bg-[#313540]'
              }`}
            >
              Help
            </button>

            {activeMenu === 'Help' && (
              <div className="absolute left-0 top-full mt-0.5 w-60 bg-[#22252c] border border-[#3b404d] rounded-xs shadow-2xl z-50 text-[11px] py-1 text-gray-200 animate-in fade-in zoom-in-95 duration-100">
                <button 
                  onClick={() => {
                    if (onOpenShortcuts) onOpenShortcuts();
                    setActiveMenu(null);
                  }} 
                  className="w-full text-left px-3 py-1.5 hover:bg-[#323744] hover:text-white flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <Keyboard size={12} className="text-cyan-400" />
                    <span>Keyboard Shortcuts & Center</span>
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">F1</span>
                </button>
                <div className="border-t border-[#313540] my-1"></div>
                <button 
                  onClick={async () => {
                    const res = await forceSyncNow();
                    window.dispatchEvent(new CustomEvent('simpleworship:notify', { 
                      detail: `✓ System Synchronized with Backend & Displays (${res.latency}ms latency)` 
                    }));
                    setActiveMenu(null);
                  }} 
                  className="w-full text-left px-3 py-1.5 hover:bg-[#323744] hover:text-white flex items-center justify-between text-emerald-300"
                >
                  <span className="flex items-center gap-1.5">
                    <Radio size={12} className="text-emerald-400" />
                    <span>Synchronize with Backend Now</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">Sync</span>
                </button>
                <button 
                  onClick={() => {
                    if (onOpenDiagnostics) onOpenDiagnostics();
                    setActiveMenu(null);
                  }} 
                  className="w-full text-left px-3 py-1.5 hover:bg-[#323744] hover:text-white flex items-center justify-between text-cyan-300"
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck size={12} />
                    <span>Backend Engine & System Diagnostics...</span>
                  </span>
                  <span className="text-[10px] text-cyan-400 font-mono">Hub</span>
                </button>

                <div className="border-t border-[#313540] my-1"></div>
                <button 
                  onClick={() => {
                    setShowAboutModal(true);
                    setActiveMenu(null);
                  }} 
                  className="w-full text-left px-3 py-1.5 hover:bg-[#323744] hover:text-white flex items-center gap-1.5 text-white font-medium"
                >
                  <Info size={12} className="text-cyan-400" />
                  <span>About SimpleWorship...</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hidden File Input for .sws import */}
      <input 
        ref={fileInputRef}
        type="file"
        accept=".sws"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* 3. Main Command Bar with EasyWorship Icons */}
      <div className="flex items-center justify-between px-3 py-1.5 gap-2 bg-gradient-to-b from-[#33373f] to-[#25282f] overflow-x-auto custom-scrollbar min-w-0 flex-nowrap">
        {/* Left Side: Schedule & File Tools */}
        <div className="flex items-center space-x-1 shrink-0 flex-nowrap">
          {/* NEW BUTTON */}
          <button
            onClick={onOpenNewSchedule}
            className="flex items-center gap-1.5 justify-center p-1.5 rounded-md hover:bg-[#3c414d] border border-transparent hover:border-[#4c5261] text-gray-300 hover:text-white transition-all cursor-pointer active:scale-95"
            title="New Schedule (Ctrl+N)"
          >
            <div className="w-6 h-6 rounded bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-xs relative shrink-0">
              <Play size={10} className="fill-cyan-400 text-cyan-400 ml-0.5" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[8px] border border-[#222]">
                +
              </div>
            </div>
            <span className="text-[10px] font-bold tracking-wide uppercase select-none hidden min-[1150px]:inline pr-1">New</span>
          </button>

          {/* OPEN BUTTON */}
          <button
            onClick={onOpenOpenSchedule}
            className="flex items-center gap-1.5 justify-center p-1.5 rounded-md hover:bg-[#3c414d] border border-transparent hover:border-[#4c5261] text-gray-300 hover:text-white transition-all cursor-pointer active:scale-95"
            title="Open Saved Schedule (Ctrl+O)"
          >
            <div className="w-6 h-6 rounded bg-cyan-600/30 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-xs shrink-0">
              <FolderOpen size={14} />
            </div>
            <span className="text-[10px] font-bold tracking-wide uppercase select-none hidden min-[1150px]:inline pr-1">Open</span>
          </button>

          {/* SAVE BUTTON */}
          <button
            onClick={handleSaveSchedule}
            className="flex items-center gap-1.5 justify-center p-1.5 rounded-md hover:bg-[#3c414d] border border-transparent hover:border-[#4c5261] text-gray-300 hover:text-white transition-all cursor-pointer active:scale-95"
            title="Save Schedule to DB & Download .sws (Ctrl+S)"
          >
            <div className="w-6 h-6 rounded bg-blue-700/30 border border-blue-400/40 flex items-center justify-center text-blue-300 shadow-xs shrink-0">
              <Save size={14} />
            </div>
            <span className="text-[10px] font-bold tracking-wide uppercase select-none hidden min-[1150px]:inline pr-1">Save</span>
          </button>

          <div className="w-px h-6 bg-[#3d424e] mx-1"></div>

          {/* MEDIA BUTTON - Opens centered Media Library overlay modal */}
          <button
            onClick={() => {
              if (onOpenMediaLibrary) onOpenMediaLibrary();
            }}
            className="flex items-center gap-1.5 justify-center p-1.5 rounded-md hover:bg-[#3c414d] border border-transparent hover:border-[#4c5261] text-gray-300 hover:text-white transition-all cursor-pointer active:scale-95"
            title="Media Library (Backgrounds, Audio, Video Loops)"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-600/30 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shadow-xs shrink-0">
              <Film size={14} />
            </div>
            <span className="text-[10px] font-bold tracking-wide uppercase select-none hidden min-[1150px]:inline pr-1">Media</span>
          </button>

          {/* REMOTE BUTTON */}
          <button
            onClick={onOpenRemoteControl}
            className="flex items-center gap-1.5 justify-center p-1.5 rounded-md hover:bg-[#3c414d] border border-transparent hover:border-[#4c5261] text-gray-300 hover:text-white transition-all cursor-pointer active:scale-95"
            title="Mobile Smartphone & Tablet Remote Control Hub"
          >
            <div className="w-6 h-6 rounded bg-purple-700/30 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-xs shrink-0">
              <Radio size={14} />
            </div>
            <span className="text-[10px] font-bold tracking-wide uppercase select-none hidden min-[1150px]:inline pr-1">Remote</span>
          </button>
        </div>



        {/* Right Side: Presentation Master Controls (Go Live, Alerts, Logo, Black, Clear, Master Live) */}
        <div className="flex items-center space-x-1 shrink-0 flex-nowrap">

          {/* TIMER BUTTON */}
          {onOpenTimers && (
            <div className={`flex items-center rounded-md border transition-all ${
              isTimerActive
                ? 'bg-amber-600/30 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'hover:bg-[#3c414d] border-transparent hover:border-[#4c5261] text-gray-300 hover:text-white'
            }`}>
              <button
                onClick={onOpenTimers}
                className="flex items-center gap-1.5 justify-center p-1.5 cursor-pointer"
                title={isTimerActive ? "Service Interval Timer Active (Click to configure)" : "Service Interval Timer & Stage Countdown"}
              >
                <div className={`w-6 h-6 rounded flex items-center justify-center border shrink-0 ${
                  isTimerActive ? 'bg-amber-500 text-black border-amber-300' : 'bg-transparent text-gray-400 border-transparent'
                }`}>
                  <Timer size={13} />
                </div>
                <span className="text-[10px] font-bold tracking-wide uppercase select-none hidden min-[1150px]:inline pr-1">Timer</span>
              </button>
            </div>
          )}

          {/* ALERTS BUTTON */}
          <div className={`flex items-center rounded-md border transition-all ${
            alertState?.active
              ? 'bg-blue-600/30 text-cyan-300 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
              : 'hover:bg-[#3c414d] border-transparent hover:border-[#4c5261] text-gray-300 hover:text-white'
          }`}>
            <button
              onClick={onOpenAlerts}
              className="flex items-center gap-1.5 justify-center p-1.5"
              title="Nursery & Message Alert Banner"
            >
              <div className={`w-6 h-6 rounded flex items-center justify-center border shrink-0 ${
                alertState?.active ? 'bg-cyan-500 text-black border-cyan-300' : 'bg-cyan-700/30 text-cyan-300 border-cyan-500/40'
              }`}>
                <Bell size={13} />
              </div>
              <span className="text-[10px] font-bold tracking-wide uppercase select-none hidden min-[1150px]:inline pr-1">Alerts</span>
            </button>
          </div>

          {/* LOGO */}
          <button
            onClick={() => toggleLogo(activeControlGroupId || store.outputGroups[0]?.id || "")}
            className={`flex items-center gap-1.5 justify-center p-1.5 rounded-md border transition-all ${
              activeControlState?.showLogo
                ? 'bg-blue-600/30 text-cyan-300 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                : 'hover:bg-[#3c414d] border-transparent hover:border-[#4c5261] text-gray-300 hover:text-white'
            }`}
            title="Display Logo Overlay (F8 or L)"
          >
            <div className={`w-6 h-6 rounded flex items-center justify-center border shrink-0 ${
              activeControlState?.showLogo ? 'bg-cyan-500 text-black border-cyan-300' : 'bg-white/10 text-white border-white/20'
            }`}>
              <ImageIcon size={12} />
            </div>
            <span className="text-[10px] font-bold tracking-wide uppercase select-none hidden min-[1150px]:inline pr-1">Logo</span>
          </button>

          {/* BLACK */}
          <button
            onClick={() => toggleBlack(activeControlGroupId || store.outputGroups[0]?.id || "")}
            className={`flex items-center gap-1.5 justify-center p-1.5 rounded-md border transition-all ${
              activeControlState?.isBlack
                ? 'bg-rose-600/30 text-rose-300 border-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                : 'hover:bg-[#3c414d] border-transparent hover:border-[#4c5261] text-gray-300 hover:text-white'
            }`}
            title="Blackout Live Screen (F6 or B)"
          >
            <div className={`w-6 h-6 rounded flex items-center justify-center border shrink-0 ${
              activeControlState?.isBlack ? 'bg-rose-600 text-white border-rose-400' : 'bg-black text-white border-white/30'
            }`}>
              <Square size={10} className="fill-black text-black" />
            </div>
            <span className="text-[10px] font-bold tracking-wide uppercase select-none hidden min-[1150px]:inline pr-1">Black</span>
          </button>

          {/* CLEAR */}
          <button
            onClick={() => toggleClear(activeControlGroupId || store.outputGroups[0]?.id || "")}
            className={`flex items-center gap-1.5 justify-center p-1.5 rounded-md border transition-all ${
              activeControlState?.isClear
                ? 'bg-amber-500/30 text-amber-300 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'hover:bg-[#3c414d] border-transparent hover:border-[#4c5261] text-gray-300 hover:text-white'
            }`}
            title="Clear Text on Live Output (F7 or C)"
          >
            <div className={`w-6 h-6 rounded flex items-center justify-center border shrink-0 ${
              activeControlState?.isClear ? 'bg-amber-500 text-black border-amber-400' : 'bg-white/10 text-white border-white/20'
            }`}>
              <EyeOff size={12} />
            </div>
            <span className="text-[10px] font-bold tracking-wide uppercase select-none hidden min-[1150px]:inline pr-1">Clear</span>
          </button>


          {/* MASTER LIVE SWITCH (MAIN SOURCE OF TRUTH) */}
          <button
            onClick={() => toggleMasterLive(activeControlGroupId || store.outputGroups[0]?.id || "")}
            className={`flex items-center gap-2 justify-center px-2.5 py-1.5 rounded-md border transition-all cursor-pointer ${
              activeControlState?.isLiveEnabled
                ? 'bg-gradient-to-r from-emerald-900/60 to-emerald-700/60 text-emerald-200 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
                : 'bg-[#20232a] text-gray-400 border-[#373a43] hover:text-gray-200 hover:bg-[#282c35]'
            }`}
            title="Master Live Switch: The main source of truth for projector display. Turn ON to actively mirror Live Display Canvas to target projector. Turn OFF for Standby/Black."
          >
            {/* TV Test Pattern Color Bars Graphic */}
            <div className="w-5 h-5 rounded overflow-hidden flex border border-white/40 shadow-xs shrink-0">
              <div className="h-full w-[2.8px] bg-white"></div>
              <div className="h-full w-[2.8px] bg-yellow-400"></div>
              <div className="h-full w-[2.8px] bg-cyan-400"></div>
              <div className="h-full w-[2.8px] bg-emerald-500"></div>
              <div className="h-full w-[2.8px] bg-fuchsia-500"></div>
              <div className="h-full w-[2.8px] bg-rose-600"></div>
              <div className="h-full w-[2.8px] bg-blue-700"></div>
            </div>
            <span className={`text-[10px] font-extrabold tracking-wide uppercase select-none pr-0.5 hidden min-[1150px]:inline flex items-center gap-1.5 ${activeControlState?.isLiveEnabled ? 'text-emerald-300' : 'text-gray-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${activeControlState?.isLiveEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-amber-500'}`} />
              {activeControlState?.isLiveEnabled ? 'Live On' : 'Live Off'}
            </span>
          </button>
        </div>
      </div>
      {showProfilesModal && (
        <ProfilesManagerModal 
          initialCreateOpen={initialCreateInProfilesModal}
          onClose={() => {
            setShowProfilesModal(false);
            setInitialCreateInProfilesModal(false);
          }} 
        />
      )}
      {showAboutModal && (
        <AboutModal 
          onClose={() => setShowAboutModal(false)} 
          onOpenShortcuts={onOpenShortcuts}
          onOpenDiagnostics={onOpenDiagnostics}
        />
      )}
      {showPrintModal && <PrintScheduleModal onClose={() => setShowPrintModal(false)} />}
      {showSaveAsModal && <SaveScheduleAsModal onClose={() => setShowSaveAsModal(false)} />}
      {showThemeTemplateModal && <ThemeTemplateModal onClose={() => setShowThemeTemplateModal(false)} />}
      {showExitModal && (
        <UnsavedChangesModal
          isOpen={showExitModal}
          actionName="exiting SimpleWorship"
          onSave={async () => {
            await handleSaveSchedule();
            await handleConfirmExit();
          }}
          onDiscard={handleConfirmExit}
          onCancel={() => setShowExitModal(false)}
        />
      )}
    </header>
  );
}
