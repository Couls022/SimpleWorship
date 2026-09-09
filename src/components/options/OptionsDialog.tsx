import { withPortal } from '../common/withPortal';
import React, { useState } from 'react';
import { 
  X, 
  Monitor, 
  Tv, 
  RotateCcw, 
  Check, 
  Plus, 
  Trash2, 
  Sliders, 
  HelpCircle, 
  Layout, 
  Layers, 
  Clock, 
  Tag, 
  Settings, 
  Radio, 
  ChevronDown,
  Keyboard,
  Play,
  Database,
  BookOpen,
  Music,
  Sparkles,
  Sun,
  Moon,
  SunMoon,
  Laptop,
  Palette,
  FolderArchive,
  Download,
  Upload
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { dbApi } from '../../db';
import { SystemOptions, FontStyleOptions, SlideLabelConfig } from '../../types';
import { applyAppearanceSettings } from '../../utils/themeManager';
import { useScreens } from '../../hooks/useScreens';
import { broadcastStateChange } from '../../utils/broadcastSync';
import { exportPortableProfile, downloadPortableProfilePackage } from '../../utils/profileManager';
import FontInspectorPopup from './FontInspectorPopup';
import ScriptureLivePreview from './ScriptureLivePreview';
import SongLivePreview from './SongLivePreview';

interface OptionsDialogProps {
  onClose: () => void;
}

type MainCategory = 'Main Output' | 'Alternate Output' | 'Foldback' | 'Service Intervals' | 'Slide Labels' | 'Appearance' | 'Advanced';
type OutputTab = 'General' | 'Song' | 'Scripture' | 'Transitions' | 'Alerts';

function OptionsDialog({ onClose }: OptionsDialogProps) {
  const store = useStore();
  const { systemOptions, updateSystemOptions, resetSystemOptions, shortcutSettings, updateShortcutSettings } = store;

  // Local working state clone
  const [localOptions, setLocalOptions] = useState<SystemOptions>(JSON.parse(JSON.stringify(systemOptions)));

  // Navigation state
  const [activeCategory, setActiveCategory] = useState<MainCategory>('Main Output');
  const [activeOutputTab, setActiveOutputTab] = useState<OutputTab>('General');
  const [activeAlertSubTab, setActiveAlertSubTab] = useState<'Nursery' | 'Message'>('Nursery');

  // Font Inspector Popup State
  const [editingFontTarget, setEditingFontTarget] = useState<{
    title: string;
    font: FontStyleOptions;
    apply: (f: FontStyleOptions) => void;
  } | null>(null);

  // Database Seeding State
  const [seedingProgress, setSeedingProgress] = useState<string>('');
  const [isSeeding, setIsSeeding] = useState<boolean>(false);

  const handleRunSeeder = async () => {
    setIsSeeding(true);
    setSeedingProgress('Initializing database seeder...');
    const res = await dbApi.reseedDatabase(true, (msg) => {
      setSeedingProgress(msg);
    });
    setIsSeeding(false);
    setSeedingProgress(res.message);
    await store.loadAllData();
  };

  const categories: { id: MainCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'Main Output', label: 'Main Output', icon: <Monitor size={15} className="text-cyan-400" /> },
    { id: 'Alternate Output', label: 'Alternate Output', icon: <Tv size={15} className="text-blue-400" /> },
    { id: 'Foldback', label: 'Foldback', icon: <Tv size={15} className="text-emerald-400" /> },
    { id: 'Service Intervals', label: 'Service Intervals', icon: <Clock size={15} className="text-amber-400" /> },
    { id: 'Slide Labels', label: 'Slide Labels', icon: <Tag size={15} className="text-purple-400" /> },
    { id: 'Appearance', label: 'UI Theme & Appearance', icon: <SunMoon size={15} className="text-amber-400" /> },
    { id: 'Advanced', label: 'Advanced', icon: <Settings size={15} className="text-gray-400" /> },
  ];

  const outputTabs: OutputTab[] = ['General', 'Song', 'Scripture', 'Transitions', 'Alerts'];

  const { screens, refreshScreens } = useScreens();

  React.useEffect(() => {
    if (screens.length > 0) {
      // 1. Sync Main Output Monitor
      const currentMainMonitor = localOptions.mainOutput.general.outputMonitor;
      const matchedMain = screens.find((s: any) => s.label === currentMainMonitor || s.name === currentMainMonitor || s.id === currentMainMonitor);
      if (!matchedMain) {
        const primaryScr = screens.find((s: any) => s.isPrimary) || screens[0];
        if (primaryScr) {
          const w = primaryScr.bounds?.width || 1920;
          const h = primaryScr.bounds?.height || 1080;
          const x = primaryScr.bounds?.x ?? 0;
          const y = primaryScr.bounds?.y ?? 0;
          setLocalOptions((prev) => ({
            ...prev,
            mainOutput: {
              ...prev.mainOutput,
              general: {
                ...prev.mainOutput.general,
                outputMonitor: primaryScr.label || primaryScr.name,
                position: { ...prev.mainOutput.general.position, left: x, top: y, width: w, height: h }
              }
            }
          }));
        }
      }

      // 2. Sync Alternate Output Monitor
      const currentAltMonitor = localOptions.alternateOutput.outputMonitor;
      const matchedAlt = screens.find((s: any) => s.label === currentAltMonitor || s.name === currentAltMonitor || s.id === currentAltMonitor);
      if (!matchedAlt && screens.length > 1) {
        const secondaryScr = screens.find((s: any) => !s.isPrimary) || screens[1];
        if (secondaryScr) {
          const w = secondaryScr.bounds?.width || 1920;
          const h = secondaryScr.bounds?.height || 1080;
          const x = secondaryScr.bounds?.x ?? 0;
          const y = secondaryScr.bounds?.y ?? 0;
          setLocalOptions((prev) => ({
            ...prev,
            alternateOutput: {
              ...prev.alternateOutput,
              outputMonitor: secondaryScr.label || secondaryScr.name,
              position: { ...prev.alternateOutput.position, left: x, top: y, width: w, height: h }
            }
          }));
        }
      }

      // 3. Sync Foldback Monitor
      const currentFoldbackMonitor = localOptions.foldback.outputMonitor;
      const matchedFoldback = screens.find((s: any) => s.label === currentFoldbackMonitor || s.name === currentFoldbackMonitor || s.id === currentFoldbackMonitor);
      if (!matchedFoldback && screens.length > 2) {
        const stageScr = screens.filter((s: any) => !s.isPrimary)[1] || screens[2];
        if (stageScr) {
          const w = stageScr.bounds?.width || 1920;
          const h = stageScr.bounds?.height || 1080;
          const x = stageScr.bounds?.x ?? 0;
          const y = stageScr.bounds?.y ?? 0;
          setLocalOptions((prev) => ({
            ...prev,
            foldback: {
              ...prev.foldback,
              outputMonitor: stageScr.label || stageScr.name,
              position: { ...prev.foldback.position, left: x, top: y, width: w, height: h }
            }
          }));
        }
      }
    }
  }, [screens]);

  const renderDisplayLayoutVisualizer = () => {
    if (screens.length === 0) return null;

    return (
      <div className="space-y-2 mb-3 bg-[#13141a] border border-[#2b2e3a] rounded-lg p-3">
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span className="font-semibold text-gray-300">Detected Windows Display Layout:</span>
          <button
            type="button"
            onClick={async () => {
              window.dispatchEvent(new CustomEvent('simpleworship:identify-displays'));
              
              if (window.electronAPI && typeof window.electronAPI.identifyDisplays === 'function') {
                try {
                  await window.electronAPI.identifyDisplays();
                } catch (e) {
                  console.error("Failed to run native identify displays:", e);
                }
              }
            }}
            className="text-[10px] px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded flex items-center gap-1.5 transition-colors shadow"
          >
            <Sparkles size={11} />
            <span>Identify Displays (1, 2, 3...)</span>
          </button>
        </div>
        
        <div className="flex flex-wrap gap-2.5 pt-1.5">
          {screens.map((scr: any, idx: number) => {
            const label = scr.label || scr.name || `Monitor ${idx + 1}`;
            const w = scr.bounds?.width || 1920;
            const h = scr.bounds?.height || 1080;
            const isSelectedForMain = localOptions.mainOutput.general.outputMonitor === label || 
              (localOptions.mainOutput.general.outputMonitor && (
                localOptions.mainOutput.general.outputMonitor.toLowerCase().includes(label.toLowerCase()) ||
                label.toLowerCase().includes(localOptions.mainOutput.general.outputMonitor.toLowerCase()) ||
                (idx === 0 && localOptions.mainOutput.general.outputMonitor.toLowerCase().includes('primary'))
              ));
              
            const isSelectedForAlt = localOptions.alternateOutput.outputMonitor === label ||
              (localOptions.alternateOutput.outputMonitor && (
                localOptions.alternateOutput.outputMonitor.toLowerCase().includes(label.toLowerCase()) ||
                label.toLowerCase().includes(localOptions.alternateOutput.outputMonitor.toLowerCase()) ||
                (idx === 1 && (
                  localOptions.alternateOutput.outputMonitor.toLowerCase().includes('monitor 2') ||
                  localOptions.alternateOutput.outputMonitor.toLowerCase().includes('secondary')
                ))
              ));
              
            const isSelectedForFoldback = localOptions.foldback.outputMonitor === label ||
              (localOptions.foldback.outputMonitor && (
                localOptions.foldback.outputMonitor.toLowerCase().includes(label.toLowerCase()) ||
                label.toLowerCase().includes(localOptions.foldback.outputMonitor.toLowerCase()) ||
                (idx === 2 && (
                  localOptions.foldback.outputMonitor.toLowerCase().includes('monitor 3') ||
                  localOptions.foldback.outputMonitor.toLowerCase().includes('stage') ||
                  localOptions.foldback.outputMonitor.toLowerCase().includes('foldback')
                ))
              ));
            
            const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
            const divisor = gcd(w, h);
            const aspectString = `${w / divisor}:${h / divisor}`;
            
            let isActiveForCurrent = false;
            let activeColorClass = '';
            if (activeCategory === 'Main Output') {
              isActiveForCurrent = isSelectedForMain;
              activeColorClass = 'border-cyan-500 bg-cyan-950/20 shadow-[0_0_8px_rgba(6,182,212,0.1)]';
            } else if (activeCategory === 'Alternate Output') {
              isActiveForCurrent = isSelectedForAlt;
              activeColorClass = 'border-purple-500 bg-purple-950/20 shadow-[0_0_8px_rgba(168,85,247,0.1)]';
            } else if (activeCategory === 'Foldback') {
              isActiveForCurrent = isSelectedForFoldback;
              activeColorClass = 'border-amber-500 bg-amber-950/20 shadow-[0_0_8px_rgba(245,158,11,0.1)]';
            }
            
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  const x = scr.bounds?.x ?? 0;
                  const y = scr.bounds?.y ?? 0;
                  
                  if (activeCategory === 'Main Output') {
                    updateMainGeneral({
                      outputMonitor: label,
                      position: { left: x, top: y, width: w, height: h }
                    });
                  } else if (activeCategory === 'Alternate Output') {
                    setLocalOptions((prev) => ({
                      ...prev,
                      alternateOutput: {
                        ...prev.alternateOutput,
                        outputMonitor: label,
                        position: { left: x, top: y, width: w, height: h }
                      }
                    }));
                  } else if (activeCategory === 'Foldback') {
                    setLocalOptions((prev) => ({
                      ...prev,
                      foldback: {
                        ...prev.foldback,
                        outputMonitor: label,
                        position: { left: x, top: y, width: w, height: h }
                      }
                    }));
                  }
                }}
                className={`flex-1 min-w-[120px] p-2.5 rounded text-left border transition-all relative ${
                  isActiveForCurrent
                    ? activeColorClass
                    : 'border-[#2d313c] bg-[#16171d] hover:border-gray-500'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-bold text-gray-500 font-mono">MONITOR {idx + 1}</span>
                  <div className="flex gap-0.5">
                    {scr.isPrimary && (
                      <span className="text-[7px] bg-blue-500/20 text-blue-300 font-extrabold px-1 rounded uppercase">Primary</span>
                    )}
                    {isSelectedForMain && (
                      <span className="text-[7px] bg-cyan-500/20 text-cyan-300 font-extrabold px-1 rounded uppercase">Main</span>
                    )}
                    {isSelectedForAlt && (
                      <span className="text-[7px] bg-purple-500/20 text-purple-300 font-extrabold px-1 rounded uppercase">Alt</span>
                    )}
                    {isSelectedForFoldback && (
                      <span className="text-[7px] bg-amber-500/20 text-amber-300 font-extrabold px-1 rounded uppercase">Stage</span>
                    )}
                  </div>
                </div>
                <div className="text-[11px] font-bold text-gray-200 truncate">{label}</div>
                <div className="text-[9px] font-mono text-cyan-400/80 mt-0.5">
                  {w} × {h} ({aspectString})
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const handleCancel = () => {
    applyAppearanceSettings(systemOptions.appearance);
    onClose();
  };

  const handleApply = () => {
    updateSystemOptions(localOptions);
    applyAppearanceSettings(localOptions.appearance);

    // Bi-directionally sync with active output group(s)
    const pos = localOptions.mainOutput?.general?.position;
    if (pos && pos.width > 0 && pos.height > 0) {
      const primaryGroup = store.outputGroups.find(g => g.id === 'group-congregation') || store.outputGroups[0];
      if (primaryGroup) {
        store.updateOutputGroup(primaryGroup.id, {
          aspectRatio: `${pos.width}x${pos.height}`,
          customResolution: { width: pos.width, height: pos.height },
          displayIds: localOptions.mainOutput.general.outputMonitor ? [localOptions.mainOutput.general.outputMonitor] : primaryGroup.displayIds,
          targetDisplayId: localOptions.mainOutput.general.outputMonitor || ''
        });
      }
    }

    const stageGroup = store.outputGroups.find(g => g.id === 'group-stage');
    if (stageGroup) {
      store.updateOutputGroup(stageGroup.id, {
        displayIds: localOptions.foldback.outputMonitor ? [localOptions.foldback.outputMonitor] : stageGroup.displayIds,
        targetDisplayId: localOptions.foldback.outputMonitor || ''
      });
    }

    const altGroup = store.outputGroups.find(g => g.id === 'group-alternate');
    if (altGroup && localOptions.alternateOutput.enabled) {
      store.updateOutputGroup(altGroup.id, {
        displayIds: localOptions.alternateOutput.outputMonitor ? [localOptions.alternateOutput.outputMonitor] : altGroup.displayIds,
        targetDisplayId: localOptions.alternateOutput.outputMonitor || ''
      });
    }

    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Options saved successfully' }));
  };

  const handleOk = () => {
    handleApply();
    onClose();
  };

  const handleResetCurrentSection = () => {
    resetSystemOptions();
    applyAppearanceSettings(systemOptions.appearance);
    onClose();
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Settings reset to defaults' }));
  };

  const updateAppearance = (patch: Partial<NonNullable<SystemOptions['appearance']>>) => {
    setLocalOptions((prev) => {
      const current = prev.appearance || { themeMode: 'dark', accentColor: 'cyan', compactMode: false, highContrast: false };
      const nextAppearance = { ...current, ...patch };
      applyAppearanceSettings(nextAppearance);
      return {
        ...prev,
        appearance: nextAppearance,
      };
    });
  };

  // Helper updater for deep properties
  const updateMainGeneral = (patch: Partial<SystemOptions['mainOutput']['general']>) => {
    setLocalOptions((prev) => ({
      ...prev,
      mainOutput: { ...prev.mainOutput, general: { ...prev.mainOutput.general, ...patch } }
    }));
  };

  const updateMainSong = (patch: Partial<SystemOptions['mainOutput']['song']>) => {
    setLocalOptions((prev) => ({
      ...prev,
      mainOutput: { ...prev.mainOutput, song: { ...prev.mainOutput.song, ...patch } }
    }));
  };

  const updateMainScripture = (patch: Partial<SystemOptions['mainOutput']['scripture']>) => {
    setLocalOptions((prev) => ({
      ...prev,
      mainOutput: { ...prev.mainOutput, scripture: { ...prev.mainOutput.scripture, ...patch } }
    }));
  };

  const updateMainTransitions = (patch: Partial<SystemOptions['mainOutput']['transitions']>) => {
    setLocalOptions((prev) => ({
      ...prev,
      mainOutput: { ...prev.mainOutput, transitions: { ...prev.mainOutput.transitions, ...patch } }
    }));
  };

  const updateMainAlertsNursery = (patch: Partial<SystemOptions['mainOutput']['alerts']['nursery']>) => {
    setLocalOptions((prev) => ({
      ...prev,
      mainOutput: {
        ...prev.mainOutput,
        alerts: {
          ...prev.mainOutput.alerts,
          nursery: { ...prev.mainOutput.alerts.nursery, ...patch }
        }
      }
    }));
  };

  const updateMainAlertsMessage = (patch: Partial<SystemOptions['mainOutput']['alerts']['message']>) => {
    setLocalOptions((prev) => ({
      ...prev,
      mainOutput: {
        ...prev.mainOutput,
        alerts: {
          ...prev.mainOutput.alerts,
          message: { ...prev.mainOutput.alerts.message, ...patch }
        }
      }
    }));
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/75 flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="bg-[#242730] border border-[#3d4251] rounded-lg shadow-2xl w-full max-w-4xl h-[620px] flex flex-col text-xs text-gray-200 overflow-hidden select-none animate-in fade-in zoom-in-95 duration-100">
        
        {/* Title Bar */}
        <div className="h-9 bg-[#1c1e24] border-b border-[#303440] flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={15} className="text-cyan-400" />
            <span className="font-bold text-gray-100 text-xs tracking-wide">Options</span>
          </div>
          <button
            onClick={handleCancel}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#343844] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Main Body Grid: Left Category Sidebar + Right Content Area */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Category Sidebar */}
          <div className="w-52 bg-[#1b1c22] border-r border-[#303440] p-2 space-y-1 overflow-y-auto custom-scrollbar shrink-0">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-left font-medium transition-all ${
                  activeCategory === cat.id
                    ? 'bg-[#2b303d] text-white shadow-sm border-l-2 border-l-cyan-400 font-semibold'
                    : 'text-gray-400 hover:bg-[#23262e] hover:text-gray-200'
                }`}
              >
                {cat.icon}
                <span className="truncate">{cat.label}</span>
              </button>
            ))}
          </div>

          {/* Right Configuration Panel */}
          <div className="flex-1 flex flex-col bg-[#20222a] overflow-hidden">
            
            {/* Top Tabs (if Main Output, Alternate Output, or Foldback) */}
            {(activeCategory === 'Main Output' || activeCategory === 'Alternate Output' || activeCategory === 'Foldback') && (
              <div className="h-8 bg-[#181a20] border-b border-[#303440] flex items-center px-2 shrink-0 space-x-1">
                {outputTabs.map((tab) => {
                  if (activeCategory === 'Foldback' && tab === 'Transitions') return null;
                  const label = tab === 'Song' ? 'Songs' : tab === 'Scripture' ? 'Scriptures' : tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveOutputTab(tab)}
                      className={`px-3 py-1.5 rounded-t text-xs font-semibold transition-all ${
                        activeOutputTab === tab
                          ? 'bg-[#20222a] text-white border-t-2 border-t-cyan-400 -mb-px shadow-sm'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-[#282b34]'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Scrollable Settings Form */}
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-4">
              
              {/* ================= MAIN OUTPUT -> GENERAL ================= */}
              {activeCategory === 'Main Output' && activeOutputTab === 'General' && (
                <div className="space-y-4">
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-3 space-y-3">
                    <div className="text-gray-300 font-bold border-b border-[#292c36] pb-1.5 flex items-center justify-between">
                      <span>Select Output Monitor</span>
                      <span className="text-[10px] text-gray-400 font-normal">Controls projection target</span>
                    </div>

                    {renderDisplayLayoutVisualizer()}

                    <div className="flex items-center gap-3">
                      <select
                        value={localOptions.mainOutput.general.outputMonitor}
                        onChange={(e) => {
                          const selectedVal = e.target.value;
                          const matched = screens.find((s: any) => (s.label || s.name) === selectedVal);
                          if (matched) {
                            const x = matched.bounds?.x ?? 0;
                            const y = matched.bounds?.y ?? 0;
                            const w = matched.bounds?.width ?? 1920;
                            const h = matched.bounds?.height ?? 1080;
                            updateMainGeneral({
                              outputMonitor: selectedVal,
                              position: { left: x, top: y, width: w, height: h }
                            });
                          } else {
                            updateMainGeneral({ outputMonitor: selectedVal });
                          }
                        }}
                        className="flex-1 bg-[#121317] border border-[#3b404d] rounded px-2.5 py-1.5 text-xs text-white"
                      >
                        {screens.length > 0 ? (
                          screens.map((scr: any, idx: number) => {
                            const label = scr.label || scr.name || `Monitor ${idx + 1}`;
                            const w = scr.bounds?.width || 1920;
                            const h = scr.bounds?.height || 1080;
                            return (
                              <option key={idx} value={label}>
                                {label} {scr.isPrimary ? '(Primary Desktop)' : '(Secondary Screen)'} [{w}×{h}]
                              </option>
                            );
                          })
                        ) : (
                          <option value="Primary Display">Generic Monitor 1 (1920×1080)</option>
                        )}
                      </select>

                      <button
                        onClick={() => {
                          updateMainGeneral({
                            position: { left: 1920, top: 0, width: 1920, height: 1080 },
                            margins: { left: 0, top: 0, right: 0, bottom: 0 }
                          });
                        }}
                        className="px-2.5 py-1.5 bg-[#2a2d36] hover:bg-[#383d47] text-gray-200 rounded border border-[#3e4350] text-xs font-semibold"
                      >
                        Reset Position
                      </button>
                    </div>

                    <div className="pt-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-gray-300">Resolution Preset / Aspect Ratio</span>
                        <span className="text-[10px] text-indigo-400 font-mono">
                          {localOptions.mainOutput.general.position.width} × {localOptions.mainOutput.general.position.height}
                        </span>
                      </div>
                      <select
                        value={
                          localOptions.mainOutput.general.position.width === 1920 && localOptions.mainOutput.general.position.height === 1080
                            ? '1920x1080'
                            : localOptions.mainOutput.general.position.width === 1366 && localOptions.mainOutput.general.position.height === 768
                            ? '1366x768'
                            : localOptions.mainOutput.general.position.width === 1280 && localOptions.mainOutput.general.position.height === 720
                            ? '1280x720'
                            : localOptions.mainOutput.general.position.width === 1920 && localOptions.mainOutput.general.position.height === 1200
                            ? '1920x1200'
                            : localOptions.mainOutput.general.position.width === 1024 && localOptions.mainOutput.general.position.height === 768
                            ? '1024x768'
                            : localOptions.mainOutput.general.position.width === 3840 && localOptions.mainOutput.general.position.height === 2160
                            ? '3840x2160'
                            : 'custom'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '1920x1080') updateMainGeneral({ position: { ...localOptions.mainOutput.general.position, width: 1920, height: 1080 } });
                          else if (val === '1366x768') updateMainGeneral({ position: { ...localOptions.mainOutput.general.position, width: 1366, height: 768 } });
                          else if (val === '1280x720') updateMainGeneral({ position: { ...localOptions.mainOutput.general.position, width: 1280, height: 720 } });
                          else if (val === '1920x1200') updateMainGeneral({ position: { ...localOptions.mainOutput.general.position, width: 1920, height: 1200 } });
                          else if (val === '1024x768') updateMainGeneral({ position: { ...localOptions.mainOutput.general.position, width: 1024, height: 768 } });
                          else if (val === '3840x2160') updateMainGeneral({ position: { ...localOptions.mainOutput.general.position, width: 3840, height: 2160 } });
                        }}
                        className="w-full bg-[#121317] border border-[#3b404d] rounded px-2.5 py-1.5 text-xs text-white"
                      >
                        <option value="1920x1080">1920 × 1080 (16:9 Full HD - Recommended)</option>
                        <option value="1366x768">1366 × 768 (16:9 HD Display)</option>
                        <option value="1280x720">1280 × 720 (16:9 720p HD)</option>
                        <option value="1920x1200">1920 × 1200 (16:10 WUXGA)</option>
                        <option value="1024x768">1024 × 768 (4:3 Standard Projector)</option>
                        <option value="3840x2160">3840 × 2160 (16:9 4K UHD)</option>
                        <option value="custom">Custom Dimensions</option>
                      </select>
                    </div>

                    {/* ASPECT RATIO & RESOLUTION CUSTOMIZER */}
                    <div className="bg-[#1b1c24] border border-[#3b4050] rounded-md p-3 space-y-2 mt-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-gray-300 border-b border-[#2d313d] pb-1">
                        <span>Aspect Ratio & Resolution Scale Guard</span>
                        <span className="text-[10px] text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/30">Fact-Check Mode</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-relaxed font-normal">
                        Lower your projection's aspect ratio or resolution below to match other standard devices. This prevents truncated or cropped displays on physical screens.
                      </p>
                      
                      {(() => {
                        const selectedLabel = localOptions.mainOutput.general.outputMonitor;
                        const matchedScr = screens.find((s: any) => (s.label || s.name) === selectedLabel);
                        const originalW = matchedScr?.bounds?.width || 1920;
                        const originalH = matchedScr?.bounds?.height || 1080;
                        
                        const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
                        const div = gcd(originalW, originalH);
                        const physicalAspect = `${originalW / div}:${originalH / div}`;
                        
                        const currentW = localOptions.mainOutput.general.position.width;
                        const currentH = localOptions.mainOutput.general.position.height;
                        const isLowered = currentW < originalW || currentH < originalH;
                        
                        const suggestions = [
                          { w: 1920, h: 1080, aspect: '16:9', label: '1080p Full HD' },
                          { w: 1366, h: 768, aspect: '16:9', label: '768p HD' },
                          { w: 1280, h: 720, aspect: '16:9', label: '720p HD' },
                          { w: 1024, h: 768, aspect: '4:3', label: '768p XGA' },
                          { w: 800, h: 600, aspect: '4:3', label: '600p SVGA' },
                        ].filter(s => s.w <= originalW && s.h <= originalH);
                        
                        return (
                          <div className="space-y-2 pt-1 text-[11px]">
                            <div className="grid grid-cols-2 gap-2 text-gray-300 bg-[#121317] p-2 rounded">
                              <div>
                                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Device Driver Name:</div>
                                <div className="font-semibold truncate">{matchedScr?.label || 'Generic Display'}</div>
                              </div>
                              <div>
                                <div className="text-[9px] text-gray-500 uppercase tracking-wider">Original Aspect:</div>
                                <div className="font-bold text-cyan-400 font-mono">{physicalAspect} ({originalW}x{originalH})</div>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <span className="text-gray-400 font-medium">Quick Scale Down & Equalize Aspect:</span>
                              <div className="flex flex-wrap gap-1.5">
                                {suggestions.map((sug, i) => {
                                  const isActive = currentW === sug.w && currentH === sug.h;
                                  return (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => {
                                        updateMainGeneral({
                                          position: {
                                            ...localOptions.mainOutput.general.position,
                                            width: sug.w,
                                            height: sug.h
                                          }
                                        });
                                      }}
                                      className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
                                        isActive
                                          ? 'bg-cyan-500 text-black border-cyan-400'
                                          : 'bg-[#1e2029] hover:bg-[#282a36] text-gray-300 border-[#2d313e]'
                                      }`}
                                    >
                                      {sug.w}x{sug.h} ({sug.aspect})
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            
                            {isLowered && (
                              <div className="bg-yellow-950/20 border border-yellow-800/30 text-yellow-300/90 text-[10px] p-2 rounded leading-normal flex items-start gap-1.5">
                                <span className="mt-0.5">⚠️</span>
                                <span>
                                  <strong>Output Resolution Scaled Down:</strong> Display is lowered to <strong>{currentW}x{currentH}</strong>. The output will automatically scale to fit the physical {originalW}x{originalH} screen while keeping content fully aligned!
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-[11px] pt-1">
                      <div>
                        <span className="text-gray-400 block mb-0.5">Left:</span>
                        <input
                          type="number"
                          value={localOptions.mainOutput.general.position.left}
                          onChange={(e) => updateMainGeneral({ position: { ...localOptions.mainOutput.general.position, left: Number(e.target.value) } })}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                        />
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Top:</span>
                        <input
                          type="number"
                          value={localOptions.mainOutput.general.position.top}
                          onChange={(e) => updateMainGeneral({ position: { ...localOptions.mainOutput.general.position, top: Number(e.target.value) } })}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                        />
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Width:</span>
                        <input
                          type="number"
                          value={localOptions.mainOutput.general.position.width}
                          onChange={(e) => updateMainGeneral({ position: { ...localOptions.mainOutput.general.position, width: Number(e.target.value) } })}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                        />
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Height:</span>
                        <input
                          type="number"
                          value={localOptions.mainOutput.general.position.height}
                          onChange={(e) => updateMainGeneral({ position: { ...localOptions.mainOutput.general.position, height: Number(e.target.value) } })}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Margins */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-3 space-y-3">
                    <div className="text-gray-300 font-bold border-b border-[#292c36] pb-1.5">
                      Output Margins
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-[11px]">
                      <div>
                        <span className="text-gray-400 block mb-0.5">Left:</span>
                        <input
                          type="number"
                          value={localOptions.mainOutput.general.margins.left}
                          onChange={(e) => updateMainGeneral({ margins: { ...localOptions.mainOutput.general.margins, left: Number(e.target.value) } })}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                        />
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Top:</span>
                        <input
                          type="number"
                          value={localOptions.mainOutput.general.margins.top}
                          onChange={(e) => updateMainGeneral({ margins: { ...localOptions.mainOutput.general.margins, top: Number(e.target.value) } })}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                        />
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Right:</span>
                        <input
                          type="number"
                          value={localOptions.mainOutput.general.margins.right}
                          onChange={(e) => updateMainGeneral({ margins: { ...localOptions.mainOutput.general.margins, right: Number(e.target.value) } })}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                        />
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Bottom:</span>
                        <input
                          type="number"
                          value={localOptions.mainOutput.general.margins.bottom}
                          onChange={(e) => updateMainGeneral({ margins: { ...localOptions.mainOutput.general.margins, bottom: Number(e.target.value) } })}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= MAIN OUTPUT -> SONG ================= */}
              {activeCategory === 'Main Output' && activeOutputTab === 'Song' && (
                <div className="space-y-4">
                  {/* 1. Song Lyrics Font & Typography Presentation */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-lg p-3.5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-gray-100 flex items-center gap-1.5">
                          <Music size={15} className="text-blue-400" />
                          <span>Song Lyrics Font</span>
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {localOptions.mainOutput.song.songFont.family} ({localOptions.mainOutput.song.songFont.maxSize}pt) •{' '}
                          <span className="capitalize">{localOptions.mainOutput.song.songFont.alignHorizontal || 'center'}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFontTarget({
                            title: 'Song Lyrics Font',
                            font: localOptions.mainOutput.song.songFont,
                            apply: (f) => updateMainSong({ songFont: f })
                          });
                        }}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded flex items-center gap-1.5 shadow"
                      >
                        <span>Song Font</span>
                        <ChevronDown size={12} />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5 border-t border-[#272b36] text-xs">
                      {/* All Caps Lyrics Toggle */}
                      <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white">
                        <input
                          type="checkbox"
                          checked={localOptions.mainOutput.song.allCapsLyrics || false}
                          onChange={(e) => updateMainSong({ allCapsLyrics: e.target.checked })}
                          className="rounded accent-blue-500"
                        />
                        <span>UPPERCASE Lyrics</span>
                      </label>

                      {/* Line Spacing */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400">Line Height:</span>
                        <select
                          value={localOptions.mainOutput.song.lineSpacing || 1.25}
                          onChange={(e) => updateMainSong({ lineSpacing: parseFloat(e.target.value) })}
                          className="bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-gray-200 text-xs focus:border-blue-500 outline-none"
                        >
                          <option value="1.0">1.0 (Tight)</option>
                          <option value="1.15">1.15 (Compact)</option>
                          <option value="1.25">1.25 (Standard)</option>
                          <option value="1.4">1.4 (Spacious)</option>
                          <option value="1.5">1.5 (Relaxed)</option>
                        </select>
                      </div>

                      {/* Min Font Size Floor */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400">Min Font Size:</span>
                        <input
                          type="number"
                          min="16"
                          max="90"
                          value={localOptions.mainOutput.song.minFontSize || 32}
                          onChange={(e) => updateMainSong({ minFontSize: parseInt(e.target.value) || 32 })}
                          className="w-16 bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-gray-200 text-xs focus:border-blue-500 outline-none text-center"
                        />
                        <span className="text-gray-500">pt</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Verse / Chorus / Section Label Formatting */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-lg p-3.5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-100 text-sm">
                        <input
                          type="checkbox"
                          checked={localOptions.mainOutput.song.showVerseChorusLabel}
                          onChange={(e) => updateMainSong({ showVerseChorusLabel: e.target.checked })}
                          className="rounded accent-blue-500"
                        />
                        <span>Display Verse / Chorus Labels</span>
                      </label>

                      {localOptions.mainOutput.song.showVerseChorusLabel && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFontTarget({
                              title: 'Verse / Chorus Label Font',
                              font: localOptions.mainOutput.song.labelFont,
                              apply: (f) => updateMainSong({ labelFont: f })
                            });
                          }}
                          className="px-2.5 py-1 bg-[#252833] hover:bg-[#323746] text-gray-200 text-xs rounded border border-[#3e4456] flex items-center gap-1"
                        >
                          <span>Label Font</span>
                          <ChevronDown size={11} />
                        </button>
                      )}
                    </div>

                    {localOptions.mainOutput.song.showVerseChorusLabel && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5 border-t border-[#272b36] text-xs">
                        {/* Label Position */}
                        <div>
                          <label className="text-gray-400 block mb-1">Label Position:</label>
                          <select
                            value={localOptions.mainOutput.song.labelLocation || 'Header'}
                            onChange={(e) => updateMainSong({ labelLocation: e.target.value as any })}
                            className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-gray-200 focus:border-blue-500 outline-none"
                          >
                            <option value="Header">Header (Above Lyrics)</option>
                            <option value="Top Left">Top Left Corner</option>
                            <option value="Top Right">Top Right Corner</option>
                            <option value="Bottom Left">Bottom Left Corner</option>
                            <option value="Bottom Right">Bottom Right Corner</option>
                          </select>
                        </div>

                        {/* Label Style */}
                        <div>
                          <label className="text-gray-400 block mb-1">Label Style:</label>
                          <select
                            value={localOptions.mainOutput.song.labelStyle || 'uppercase'}
                            onChange={(e) => updateMainSong({ labelStyle: e.target.value as any })}
                            className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-gray-200 focus:border-blue-500 outline-none"
                          >
                            <option value="uppercase">UPPERCASE (e.g. VERSE 1)</option>
                            <option value="badge">[ BADGE ] (e.g. [ Verse 1 ])</option>
                            <option value="parentheses">(Parentheses) (e.g. (Chorus))</option>
                            <option value="plain">Plain Text (e.g. Verse 1)</option>
                          </select>
                        </div>

                        {/* Optional Prefix */}
                        <div>
                          <label className="text-gray-400 block mb-1">Prefix / Icon:</label>
                          <input
                            type="text"
                            value={localOptions.mainOutput.song.labelPrefix || ''}
                            onChange={(e) => updateMainSong({ labelPrefix: e.target.value })}
                            placeholder="e.g. 🎵 or Section: "
                            className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-gray-200 focus:border-blue-500 outline-none placeholder:text-gray-600"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. Copyright Notice & CCLI Information */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-lg p-3.5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-100 text-sm">
                        <input
                          type="checkbox"
                          checked={localOptions.mainOutput.song.displayCopyrightInfo}
                          onChange={(e) => updateMainSong({ displayCopyrightInfo: e.target.checked })}
                          className="rounded accent-blue-500"
                        />
                        <span>Display Copyright / CCLI Information</span>
                      </label>

                      {localOptions.mainOutput.song.displayCopyrightInfo && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFontTarget({
                              title: 'Copyright Font',
                              font: localOptions.mainOutput.song.copyrightFont,
                              apply: (f) => updateMainSong({ copyrightFont: f })
                            });
                          }}
                          className="px-2.5 py-1 bg-[#252833] hover:bg-[#323746] text-gray-200 text-xs rounded border border-[#3e4456] flex items-center gap-1"
                        >
                          <span>Copyright Font</span>
                          <ChevronDown size={11} />
                        </button>
                      )}
                    </div>

                    {localOptions.mainOutput.song.displayCopyrightInfo && (
                      <div className="space-y-3 pt-2.5 border-t border-[#272b36] text-xs">
                        <div>
                          <label className="text-gray-400 block mb-1">License & Church Attribution Text:</label>
                          <input
                            type="text"
                            value={localOptions.mainOutput.song.licenseInfo}
                            onChange={(e) => updateMainSong({ licenseInfo: e.target.value })}
                            placeholder="e.g. CCLI License #1234567 | Words & Music by Author"
                            className="w-full bg-[#121317] border border-[#3b404d] rounded px-2.5 py-1.5 text-white focus:border-blue-500 outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Display Timing Rule */}
                          <div>
                            <label className="text-gray-400 block mb-1">Display Rule:</label>
                            <select
                              value={
                                localOptions.mainOutput.song.showOnFirstSlideOnly
                                  ? 'first-only'
                                  : localOptions.mainOutput.song.showOnLastSlideOnly
                                  ? 'last-only'
                                  : 'all-slides'
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                updateMainSong({
                                  showOnFirstSlideOnly: val === 'first-only',
                                  showOnLastSlideOnly: val === 'last-only'
                                });
                              }}
                              className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-gray-200 focus:border-blue-500 outline-none"
                            >
                              <option value="all-slides">Display on All Song Slides</option>
                              <option value="first-only">Show on First Slide Only</option>
                              <option value="last-only">Show on Last Slide Only</option>
                            </select>
                          </div>

                          {/* Position on Screen */}
                          <div>
                            <label className="text-gray-400 block mb-1">Copyright Position:</label>
                            <select
                              value={localOptions.mainOutput.song.copyrightPosition || 'Bottom Left'}
                              onChange={(e) => updateMainSong({ copyrightPosition: e.target.value as any })}
                              className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-gray-200 focus:border-blue-500 outline-none"
                            >
                              <option value="Bottom Left">Bottom Left Corner</option>
                              <option value="Bottom Right">Bottom Right Corner</option>
                              <option value="Bottom Center">Bottom Center</option>
                              <option value="Top Left">Top Left Corner</option>
                              <option value="Top Right">Top Right Corner</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. Song Margins ("Marging") */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-lg p-3.5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between border-b border-[#292c36] pb-2">
                      <div className="font-bold text-gray-100 text-sm flex items-center gap-1.5">
                        <span>Song Display Margins</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          updateMainSong({
                            margins: { ...localOptions.mainOutput.general.margins }
                          });
                        }}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline"
                      >
                        Copy from General Margins
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="text-gray-400 block mb-1">Left (px):</label>
                        <input
                          type="number"
                          value={localOptions.mainOutput.song.margins?.left ?? localOptions.mainOutput.general.margins.left}
                          onChange={(e) => {
                            const current = localOptions.mainOutput.song.margins || { ...localOptions.mainOutput.general.margins };
                            updateMainSong({ margins: { ...current, left: Number(e.target.value) } });
                          }}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white text-center focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400 block mb-1">Top (px):</label>
                        <input
                          type="number"
                          value={localOptions.mainOutput.song.margins?.top ?? localOptions.mainOutput.general.margins.top}
                          onChange={(e) => {
                            const current = localOptions.mainOutput.song.margins || { ...localOptions.mainOutput.general.margins };
                            updateMainSong({ margins: { ...current, top: Number(e.target.value) } });
                          }}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white text-center focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400 block mb-1">Right (px):</label>
                        <input
                          type="number"
                          value={localOptions.mainOutput.song.margins?.right ?? localOptions.mainOutput.general.margins.right}
                          onChange={(e) => {
                            const current = localOptions.mainOutput.song.margins || { ...localOptions.mainOutput.general.margins };
                            updateMainSong({ margins: { ...current, right: Number(e.target.value) } });
                          }}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white text-center focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400 block mb-1">Bottom (px):</label>
                        <input
                          type="number"
                          value={localOptions.mainOutput.song.margins?.bottom ?? localOptions.mainOutput.general.margins.bottom}
                          onChange={(e) => {
                            const current = localOptions.mainOutput.song.margins || { ...localOptions.mainOutput.general.margins };
                            updateMainSong({ margins: { ...current, bottom: Number(e.target.value) } });
                          }}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white text-center focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5. Auto Adjustment */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-lg p-3.5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between border-b border-[#292c36] pb-2">
                      <div className="font-bold text-gray-100 text-sm flex items-center gap-1.5">
                        <span>Auto Adjustment</span>
                      </div>
                      <span className="text-[10px] text-gray-400">Dynamic Font Scaling</span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer text-gray-200 hover:text-white">
                        <input
                          type="checkbox"
                          checked={localOptions.mainOutput.song.autoAdjust ?? true}
                          onChange={(e) => updateMainSong({ autoAdjust: e.target.checked })}
                          className="rounded accent-blue-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="font-medium">Enable Dynamic Auto-Fit Font Sizing to Canvas</span>
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-[#252833] text-[11px]">
                        <div>
                          <label className="text-gray-400 block mb-1">Min Font Size (Floor):</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="16"
                              max="90"
                              value={localOptions.mainOutput.song.minFontSize || 32}
                              onChange={(e) => updateMainSong({ minFontSize: parseInt(e.target.value) || 32 })}
                              className="w-20 bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white text-center focus:border-blue-500 outline-none"
                            />
                            <span className="text-gray-400">pt</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-gray-400 block mb-1">Line Spacing / Height:</label>
                          <select
                            value={localOptions.mainOutput.song.lineSpacing || 1.35}
                            onChange={(e) => updateMainSong({ lineSpacing: parseFloat(e.target.value) })}
                            className="w-full bg-[#121317] border border-[#3b404d] rounded px-2.5 py-1 text-white focus:border-blue-500 outline-none"
                          >
                            <option value="1.0">1.0 (Tight)</option>
                            <option value="1.15">1.15 (Compact)</option>
                            <option value="1.25">1.25 (Standard)</option>
                            <option value="1.35">1.35 (Worship Slide Standard)</option>
                            <option value="1.5">1.5 (Spacious)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 6. Live Interactive Song Slide Preview (16:9 Widescreen & Output Resolution Based) */}
                  <SongLivePreview
                    generalOptions={localOptions.mainOutput.general}
                    songOptions={localOptions.mainOutput.song}
                    onUpdateGeneral={updateMainGeneral}
                    onUpdateSong={updateMainSong}
                    onUpdateBackdrop={(bg) => store.setDefaultBackground(bg, 'songs', false)}
                  />
                </div>
              )}

              {/* ================= MAIN OUTPUT -> SCRIPTURE ================= */}
              {activeCategory === 'Main Output' && activeOutputTab === 'Scripture' && (
                <div className="space-y-4">
                  {/* 1. Scripture Text Font */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-3 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-200 text-sm">Scripture Text Font</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {localOptions.mainOutput.scripture.scriptureFont.family} ({localOptions.mainOutput.scripture.scriptureFont.maxSize}pt, {localOptions.mainOutput.scripture.scriptureFont.color || '#FFFFFF'})
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFontTarget({
                          title: 'Scripture Body Text Font',
                          font: localOptions.mainOutput.scripture.scriptureFont,
                          apply: (f) => updateMainScripture({ scriptureFont: f })
                        });
                      }}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded text-xs flex items-center gap-1.5 cursor-pointer shadow"
                    >
                      <span>Scripture Font</span>
                      <ChevronDown size={12} />
                    </button>
                  </div>

                  {/* 2. Book, Chapter & Reference Label Settings */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-3.5 space-y-3">
                    <div className="flex items-center justify-between border-b border-[#292c36] pb-2">
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-100 text-sm">
                          <input
                            type="checkbox"
                            checked={localOptions.mainOutput.scripture.showReference ?? true}
                            onChange={(e) => updateMainScripture({ showReference: e.target.checked })}
                            className="rounded accent-blue-500 w-4 h-4 cursor-pointer"
                          />
                          <span>Book & Chapter Reference Label</span>
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFontTarget({
                            title: 'Reference / Book & Chapter Label Font',
                            font: localOptions.mainOutput.scripture.referenceFont,
                            apply: (f) => updateMainScripture({ referenceFont: f })
                          });
                        }}
                        className="px-2.5 py-1 bg-[#2a2d36] hover:bg-[#383d47] text-gray-200 text-xs rounded border border-[#3e4350] flex items-center gap-1 cursor-pointer"
                      >
                        <span>Reference Font ▾</span>
                      </button>
                    </div>

                    {(localOptions.mainOutput.scripture.showReference ?? true) && (
                      <div className="space-y-3 pt-1 text-[11px]">
                        <div className="grid grid-cols-2 gap-3">
                          {/* Reference Location */}
                          <div>
                            <label className="text-gray-300 font-semibold block mb-1">Reference Location:</label>
                            <select
                              value={localOptions.mainOutput.scripture.referenceLocation || 'After Each Slide'}
                              onChange={(e) => updateMainScripture({ referenceLocation: e.target.value as any })}
                              className="w-full bg-[#121317] border border-[#3b404d] rounded px-2.5 py-1.5 text-white focus:border-blue-500 outline-none"
                            >
                              <option value="After Each Slide">After Each Slide (Footer)</option>
                              <option value="Before Each Slide">Before Each Slide (Header)</option>
                              <option value="Top Right">Top Right Corner</option>
                              <option value="Top Left">Top Left Corner</option>
                              <option value="Bottom Right">Bottom Right Corner</option>
                              <option value="Bottom Left">Bottom Left Corner</option>
                            </select>
                          </div>

                          {/* Reference Format / Pattern */}
                          <div>
                            <label className="text-gray-300 font-semibold block mb-1">Reference Format Template:</label>
                            <select
                              value={localOptions.mainOutput.scripture.referenceFormat || 'Book Chapter:Verse (Translation)'}
                              onChange={(e) => updateMainScripture({ referenceFormat: e.target.value as any })}
                              className="w-full bg-[#121317] border border-[#3b404d] rounded px-2.5 py-1.5 text-white focus:border-blue-500 outline-none"
                            >
                              <option value="Book Chapter:Verse (Translation)">Book Chapter:Verse (Translation) (e.g. John 3:16 (KJV))</option>
                              <option value="Book Chapter:Verse">Book Chapter:Verse (e.g. John 3:16)</option>
                              <option value="Book Chapter, Verse">Book Chapter, Verse (e.g. John Chapter 3, Verse 16)</option>
                              <option value="Chapter:Verse - Book">Chapter:Verse - Book (e.g. 3:16 - John)</option>
                            </select>
                          </div>
                        </div>

                        {/* Label Customization Options */}
                        <div className="grid grid-cols-2 gap-3 pt-1">
                          <div>
                            <label className="text-gray-300 font-semibold block mb-1">Reference Casing:</label>
                            <select
                              value={localOptions.mainOutput.scripture.referenceCasing || 'none'}
                              onChange={(e) => updateMainScripture({ referenceCasing: e.target.value as any })}
                              className="w-full bg-[#121317] border border-[#3b404d] rounded px-2.5 py-1.5 text-white focus:border-blue-500 outline-none"
                            >
                              <option value="none">Standard / Original (e.g. John 3:16)</option>
                              <option value="uppercase">UPPERCASE (e.g. JOHN 3:16)</option>
                              <option value="lowercase">lowercase (e.g. john 3:16)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-gray-300 font-semibold block mb-1">Custom Prefix / Icon:</label>
                            <input
                              type="text"
                              value={localOptions.mainOutput.scripture.referencePrefix || ''}
                              onChange={(e) => updateMainScripture({ referencePrefix: e.target.value })}
                              placeholder="e.g. 📖 or Ref: "
                              className="w-full bg-[#121317] border border-[#3b404d] rounded px-2.5 py-1 text-white placeholder-gray-600 focus:border-blue-500 outline-none"
                            />
                          </div>
                        </div>

                        {/* Toggles for book/chapter/translation parts */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#252833]">
                          <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white">
                            <input
                              type="checkbox"
                              checked={localOptions.mainOutput.scripture.abbreviateBookNames ?? false}
                              onChange={(e) => updateMainScripture({ abbreviateBookNames: e.target.checked })}
                              className="rounded accent-blue-500 cursor-pointer"
                            />
                            <span>Abbreviate book names (e.g. Jn. vs John, Rom. vs Romans)</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white">
                            <input
                              type="checkbox"
                              checked={localOptions.mainOutput.scripture.showTranslationBadge ?? true}
                              onChange={(e) => updateMainScripture({ showTranslationBadge: e.target.checked })}
                              className="rounded accent-blue-500 cursor-pointer"
                            />
                            <span>Show Translation badge (e.g. (KJV))</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3. In-Text Verse Number Labels */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-3.5 space-y-3">
                    <div className="flex items-center justify-between border-b border-[#292c36] pb-2">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-100 text-sm">
                        <input
                          type="checkbox"
                          checked={localOptions.mainOutput.scripture.showVerseNumbers ?? true}
                          onChange={(e) => updateMainScripture({ showVerseNumbers: e.target.checked })}
                          className="rounded accent-blue-500 w-4 h-4 cursor-pointer"
                        />
                        <span>In-Text Verse Number Labels</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFontTarget({
                            title: 'Verse Number Font',
                            font: localOptions.mainOutput.scripture.verseFont,
                            apply: (f) => updateMainScripture({ verseFont: f })
                          });
                        }}
                        className="px-2.5 py-1 bg-[#2a2d36] hover:bg-[#383d47] text-gray-200 text-xs rounded border border-[#3e4350] flex items-center gap-1 cursor-pointer"
                      >
                        <span>Verse Font ▾</span>
                      </button>
                    </div>

                    {(localOptions.mainOutput.scripture.showVerseNumbers ?? true) && (
                      <div className="grid grid-cols-2 gap-3 pt-1 text-[11px]">
                        <div>
                          <label className="text-gray-300 font-semibold block mb-1">Verse Number Style:</label>
                          <select
                            value={localOptions.mainOutput.scripture.verseNumberStyle || 'superscript'}
                            onChange={(e) => updateMainScripture({ verseNumberStyle: e.target.value as any })}
                            className="w-full bg-[#121317] border border-[#3b404d] rounded px-2.5 py-1.5 text-white focus:border-blue-500 outline-none"
                          >
                            <option value="superscript">Superscript (e.g. ¹⁶ For God so loved...)</option>
                            <option value="bracket">Brackets (e.g. [16] For God so loved...)</option>
                            <option value="parenthesis">Parentheses (e.g. (16) For God so loved...)</option>
                            <option value="period">Numbered with Period (e.g. 16. For God so loved...)</option>
                            <option value="plain">Plain Number (e.g. 16 For God so loved...)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-gray-300 font-semibold block mb-1">Verse Label Color:</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={localOptions.mainOutput.scripture.verseFont?.color || '#F6E05E'}
                              onChange={(e) => {
                                const newColor = e.target.value;
                                updateMainScripture({
                                  verseFont: {
                                    ...localOptions.mainOutput.scripture.verseFont,
                                    color: newColor
                                  }
                                });
                              }}
                              className="w-8 h-7 rounded border border-[#3b404d] bg-transparent cursor-pointer"
                            />
                            <span className="font-mono text-xs text-yellow-300">
                              {localOptions.mainOutput.scripture.verseFont?.color || '#F6E05E'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 4. Scripture Margins ("Marging") */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-lg p-3.5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between border-b border-[#292c36] pb-2">
                      <div className="font-bold text-gray-100 text-sm flex items-center gap-1.5">
                        <span>Scripture Display Margins</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          updateMainScripture({
                            margins: { ...localOptions.mainOutput.general.margins }
                          });
                        }}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline"
                      >
                        Copy from General Margins
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="text-gray-400 block mb-1">Left (px):</label>
                        <input
                          type="number"
                          value={localOptions.mainOutput.scripture.margins?.left ?? localOptions.mainOutput.general.margins.left}
                          onChange={(e) => {
                            const current = localOptions.mainOutput.scripture.margins || { ...localOptions.mainOutput.general.margins };
                            updateMainScripture({ margins: { ...current, left: Number(e.target.value) } });
                          }}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white text-center focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400 block mb-1">Top (px):</label>
                        <input
                          type="number"
                          value={localOptions.mainOutput.scripture.margins?.top ?? localOptions.mainOutput.general.margins.top}
                          onChange={(e) => {
                            const current = localOptions.mainOutput.scripture.margins || { ...localOptions.mainOutput.general.margins };
                            updateMainScripture({ margins: { ...current, top: Number(e.target.value) } });
                          }}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white text-center focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400 block mb-1">Right (px):</label>
                        <input
                          type="number"
                          value={localOptions.mainOutput.scripture.margins?.right ?? localOptions.mainOutput.general.margins.right}
                          onChange={(e) => {
                            const current = localOptions.mainOutput.scripture.margins || { ...localOptions.mainOutput.general.margins };
                            updateMainScripture({ margins: { ...current, right: Number(e.target.value) } });
                          }}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white text-center focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400 block mb-1">Bottom (px):</label>
                        <input
                          type="number"
                          value={localOptions.mainOutput.scripture.margins?.bottom ?? localOptions.mainOutput.general.margins.bottom}
                          onChange={(e) => {
                            const current = localOptions.mainOutput.scripture.margins || { ...localOptions.mainOutput.general.margins };
                            updateMainScripture({ margins: { ...current, bottom: Number(e.target.value) } });
                          }}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white text-center focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5. Auto Adjustment */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-[#292c36] pb-1">
                      <div className="font-bold text-gray-200 text-xs">
                        Auto Adjustment & Scripture Slide Flow
                      </div>
                      <span className="text-[10px] text-gray-400">Dynamic Font Scaling & Layout</span>
                    </div>

                    <div className="space-y-2.5 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer text-gray-200 hover:text-white text-xs">
                        <input
                          type="checkbox"
                          checked={localOptions.mainOutput.scripture.autoAdjust ?? true}
                          onChange={(e) => updateMainScripture({ autoAdjust: e.target.checked })}
                          className="rounded accent-blue-500 w-4 h-4 cursor-pointer"
                        />
                        <span className="font-medium">Enable Dynamic Auto-Fit Font Sizing to Canvas</span>
                      </label>

                      <div className="grid grid-cols-2 gap-3 pt-1 text-[11px]">
                        <div>
                          <label className="text-gray-400 block mb-1">Min Font Size (Auto-flow scale floor):</label>
                          <input
                            type="number"
                            value={localOptions.mainOutput.scripture.minFontSize || 40}
                            onChange={(e) => updateMainScripture({ minFontSize: Number(e.target.value) })}
                            className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white text-center"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5 pt-1 border-t border-[#252833]">
                        <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white text-xs">
                          <input
                            type="checkbox"
                            checked={localOptions.mainOutput.scripture.breakOnNewVerse ?? false}
                            onChange={(e) => updateMainScripture({ breakOnNewVerse: e.target.checked })}
                            className="rounded accent-blue-500 cursor-pointer"
                          />
                          <span>Break on new verse (create a separate slide for each verse)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-gray-300 hover:text-white text-xs">
                          <input
                            type="checkbox"
                            checked={localOptions.mainOutput.scripture.automaticallyFlow ?? true}
                            onChange={(e) => updateMainScripture({ automaticallyFlow: e.target.checked })}
                            className="rounded accent-blue-500 cursor-pointer"
                          />
                          <span>Automatically flow text to next slide when length exceeds limit</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* 6. Live Interactive Preview of Scripture Configuration (16:9 Widescreen & Output Resolution Based) */}
                  <ScriptureLivePreview
                    generalOptions={localOptions.mainOutput.general}
                    scriptureOptions={localOptions.mainOutput.scripture}
                    onUpdateGeneral={updateMainGeneral}
                    onUpdateScripture={updateMainScripture}
                    onUpdateBackdrop={(bg) => store.setDefaultBackground(bg, 'scriptures', false)}
                  />
                </div>
              )}

              {/* ================= MAIN OUTPUT -> TRANSITIONS ================= */}
              {activeCategory === 'Main Output' && activeOutputTab === 'Transitions' && (
                <div className="space-y-4">
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-3 space-y-4">
                    <div className="flex space-x-2 border-b border-[#292c36] pb-2">
                      {(['Slide', 'Black', 'Clear', 'Logo'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => updateMainTransitions({ activeTab: t })}
                          className={`px-3 py-1 rounded text-xs font-semibold ${
                            localOptions.mainOutput.transitions.activeTab === t
                              ? 'bg-blue-600 text-white'
                              : 'bg-[#121317] text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          {t} Transition
                        </button>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-gray-400 block mb-1 font-semibold">Transition Blend Style</label>
                        <select
                          value={localOptions.mainOutput.transitions.blend}
                          onChange={(e) => updateMainTransitions({ blend: e.target.value as any })}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2.5 py-1.5 text-white"
                        >
                          <option value="Blend">Blend (Smooth Crossfade)</option>
                          <option value="Cut">Cut (Instant)</option>
                          <option value="Wipe Left">Wipe Left</option>
                          <option value="Wipe Right">Wipe Right</option>
                          <option value="Fade Black">Fade through Black</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-gray-400 font-semibold">Transition Duration</span>
                          <span className="font-mono text-cyan-300 font-bold">{localOptions.mainOutput.transitions.duration} ms</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="2000"
                          step="50"
                          value={localOptions.mainOutput.transitions.duration}
                          onChange={(e) => updateMainTransitions({ duration: Number(e.target.value) })}
                          className="w-full accent-blue-500 h-1.5 bg-[#121317] rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= MAIN OUTPUT -> ALERTS ================= */}
              {activeCategory === 'Main Output' && activeOutputTab === 'Alerts' && (
                <div className="space-y-4">
                  {/* Alert Subtabs: Nursery Alert vs Message Alert matching EasyWorship screenshot */}
                  <div className="flex space-x-2 border-b border-[#303440] pb-2">
                    <button
                      onClick={() => setActiveAlertSubTab('Nursery')}
                      className={`px-3 py-1 rounded text-xs font-semibold ${
                        activeAlertSubTab === 'Nursery'
                          ? 'bg-blue-600 text-white'
                          : 'bg-[#18191f] text-gray-400 hover:text-white'
                      }`}
                    >
                      Nursery Alert
                    </button>
                    <button
                      onClick={() => setActiveAlertSubTab('Message')}
                      className={`px-3 py-1 rounded text-xs font-semibold ${
                        activeAlertSubTab === 'Message'
                          ? 'bg-blue-600 text-white'
                          : 'bg-[#18191f] text-gray-400 hover:text-white'
                      }`}
                    >
                      Message Alert
                    </button>
                  </div>

                  {activeAlertSubTab === 'Nursery' && (
                    <div className="bg-[#18191f] border border-[#323642] rounded-md p-3 space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-200">
                        <input
                          type="checkbox"
                          checked={localOptions.mainOutput.alerts.nursery.enabled}
                          onChange={(e) => updateMainAlertsNursery({ enabled: e.target.checked })}
                          className="rounded accent-blue-500"
                        />
                        <span>Enable Nursery Ticker & Alert Badges</span>
                      </label>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="text-gray-400 block mb-1">Badge Location</label>
                          <select
                            value={localOptions.mainOutput.alerts.nursery.location}
                            onChange={(e) => updateMainAlertsNursery({ location: e.target.value as any })}
                            className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                          >
                            <option value="Top Right">Top Right</option>
                            <option value="Top Left">Top Left</option>
                            <option value="Bottom Right">Bottom Right</option>
                            <option value="Bottom Left">Bottom Left</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-gray-400 block mb-1">Background Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={localOptions.mainOutput.alerts.nursery.backgroundColor}
                              onChange={(e) => updateMainAlertsNursery({ backgroundColor: e.target.value })}
                              className="w-7 h-7 rounded border border-[#3b404d] bg-transparent cursor-pointer"
                            />
                            <span className="font-mono text-[11px]">{localOptions.mainOutput.alerts.nursery.backgroundColor}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-[#292c36] pt-3">
                        <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                          <input
                            type="checkbox"
                            checked={localOptions.mainOutput.alerts.nursery.autoRemove}
                            onChange={(e) => updateMainAlertsNursery({ autoRemove: e.target.checked })}
                            className="rounded accent-blue-500"
                          />
                          <span>Auto Remove after:</span>
                          <input
                            type="text"
                            value={localOptions.mainOutput.alerts.nursery.autoRemoveDuration}
                            onChange={(e) => updateMainAlertsNursery({ autoRemoveDuration: e.target.value })}
                            className="w-16 bg-[#121317] border border-[#3b404d] rounded px-1.5 py-0.5 text-center text-white"
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingFontTarget({
                              title: 'Nursery Alert Font',
                              font: localOptions.mainOutput.alerts.nursery.font,
                              apply: (f) => updateMainAlertsNursery({ font: f })
                            });
                          }}
                          className="px-3 py-1 bg-[#2a2d36] hover:bg-[#383d47] text-gray-200 rounded border border-[#3e4350]"
                        >
                          Nursery Font ▾
                        </button>
                      </div>

                      {/* Live Test Nursery Code */}
                      <div className="bg-black/40 border border-[#2a2d38] p-2.5 rounded flex items-center justify-between">
                        <div>
                          <span className="text-gray-400 block text-[11px]">Active Nursery Code on Live Output:</span>
                          <span className="font-mono text-amber-300 font-bold">{localOptions.mainOutput.alerts.nursery.currentCode || 'None'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const code = prompt('Enter nursery alert numbers (e.g. 12, 5):', localOptions.mainOutput.alerts.nursery.currentCode || '12, 5');
                            if (code !== null) {
                              updateMainAlertsNursery({ currentCode: code });
                              store.setAlert({ nurseryText: code, showNursery: !!code }, store.activeControlGroupId || store.outputGroups[0]?.id || "");
                            }
                          }}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded"
                        >
                          Update Code
                        </button>
                      </div>
                    </div>
                  )}

                  {activeAlertSubTab === 'Message' && (
                    <div className="bg-[#18191f] border border-[#323642] rounded-md p-3 space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-200">
                        <input
                          type="checkbox"
                          checked={localOptions.mainOutput.alerts.message.enabled}
                          onChange={(e) => updateMainAlertsMessage({ enabled: e.target.checked })}
                          className="rounded accent-blue-500"
                        />
                        <span>Enable Scrolling Message Ticker Alert</span>
                      </label>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="text-gray-400 block mb-1">Location</label>
                          <select
                            value={localOptions.mainOutput.alerts.message.location}
                            onChange={(e) => updateMainAlertsMessage({ location: e.target.value as any })}
                            className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                          >
                            <option value="Bottom">Bottom Ticker</option>
                            <option value="Top">Top Banner</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-gray-400 block mb-1">Scroll Speed</label>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={localOptions.mainOutput.alerts.message.scrollSpeed}
                            onChange={(e) => updateMainAlertsMessage({ scrollSpeed: Number(e.target.value) })}
                            className="w-full accent-blue-500 h-1.5 bg-[#121317] rounded cursor-pointer mt-2"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-[#292c36] pt-3">
                        <span className="text-gray-400">Message Typography</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFontTarget({
                              title: 'Message Alert Font',
                              font: localOptions.mainOutput.alerts.message.font,
                              apply: (f) => updateMainAlertsMessage({ font: f })
                            });
                          }}
                          className="px-3 py-1 bg-[#2a2d36] hover:bg-[#383d47] text-gray-200 rounded border border-[#3e4350]"
                        >
                          Message Font ▾
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ================= ALTERNATE OUTPUT ================= */}
              {activeCategory === 'Alternate Output' && (
                <div className="space-y-4">
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-3 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-200">
                      <input
                        type="checkbox"
                        checked={localOptions.alternateOutput.enabled}
                        onChange={(e) => setLocalOptions((prev) => ({
                          ...prev,
                          alternateOutput: { ...prev.alternateOutput, enabled: e.target.checked }
                        }))}
                        className="rounded accent-blue-500"
                      />
                      <span>Enable Alternate Output (Foyer / Lobby / Broadcast Stream)</span>
                    </label>

                    {localOptions.alternateOutput.enabled && (
                      <div className="space-y-3 pt-2 border-t border-[#292c36]">
                        {renderDisplayLayoutVisualizer()}

                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-gray-400 block mb-1 font-semibold text-xs">Select Output Display</label>
                            <select
                              value={localOptions.alternateOutput.outputMonitor}
                              onChange={(e) => {
                                const selectedVal = e.target.value;
                                const matched = screens.find((s: any) => (s.label || s.name) === selectedVal);
                                if (matched) {
                                  const x = matched.bounds?.x ?? 0;
                                  const y = matched.bounds?.y ?? 0;
                                  const w = matched.bounds?.width ?? 1920;
                                  const h = matched.bounds?.height ?? 1080;
                                  setLocalOptions((prev) => ({
                                    ...prev,
                                    alternateOutput: {
                                      ...prev.alternateOutput,
                                      outputMonitor: selectedVal,
                                      position: { left: x, top: y, width: w, height: h }
                                    }
                                  }));
                                } else {
                                  setLocalOptions((prev) => ({
                                    ...prev,
                                    alternateOutput: { ...prev.alternateOutput, outputMonitor: selectedVal }
                                  }));
                                }
                              }}
                              className="w-full bg-[#121317] border border-[#3b404d] rounded px-2.5 py-1.5 text-xs text-white"
                            >
                              {screens.length > 0 ? (
                                screens.map((scr: any, idx: number) => {
                                  const label = scr.label || scr.name || `Monitor ${idx + 1}`;
                                  const w = scr.bounds?.width || 1920;
                                  const h = scr.bounds?.height || 1080;
                                  return (
                                    <option key={idx} value={label}>
                                      {label} {scr.isPrimary ? '(Primary Desktop)' : '(Secondary Screen)'} [{w}×{h}]
                                    </option>
                                  );
                                })
                              ) : (
                                <>
                                  <option value="Monitor 2">Monitor 2 (Secondary Display / HDMI - 1920×1080)</option>
                                  <option value="Monitor 3">Monitor 3 (Lobby / Overflow - 1366×768)</option>
                                  <option value="NDI Broadcast">NDI Broadcast Feed (1920×1080)</option>
                                </>
                              )}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => setLocalOptions((prev) => ({
                              ...prev,
                              alternateOutput: {
                                ...prev.alternateOutput,
                                position: { left: 1920, top: 0, width: 1920, height: 1080 },
                                margins: { left: 0, top: 0, right: 0, bottom: 0 }
                              }
                            }))}
                            className="mt-5 px-2.5 py-1.5 bg-[#2a2d36] hover:bg-[#383d47] text-gray-200 rounded border border-[#3e4350] text-xs font-semibold"
                          >
                            Reset Position
                          </button>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-gray-300">Resolution Preset / Aspect Ratio</span>
                            <span className="text-[10px] text-indigo-400 font-mono">
                              {localOptions.alternateOutput.position?.width || 1920} × {localOptions.alternateOutput.position?.height || 1080}
                            </span>
                          </div>
                          <select
                            value={
                              (localOptions.alternateOutput.position?.width === 1920 && localOptions.alternateOutput.position?.height === 1080)
                                ? '1920x1080'
                                : (localOptions.alternateOutput.position?.width === 1024 && localOptions.alternateOutput.position?.height === 768)
                                ? '1024x768'
                                : (localOptions.alternateOutput.position?.width === 1366 && localOptions.alternateOutput.position?.height === 768)
                                ? '1366x768'
                                : (localOptions.alternateOutput.position?.width === 1280 && localOptions.alternateOutput.position?.height === 720)
                                ? '1280x720'
                                : (localOptions.alternateOutput.position?.width === 1920 && localOptions.alternateOutput.position?.height === 1200)
                                ? '1920x1200'
                                : 'custom'
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              let w = 1920, h = 1080;
                              if (val === '1024x768') { w = 1024; h = 768; }
                              else if (val === '1366x768') { w = 1366; h = 768; }
                              else if (val === '1280x720') { w = 1280; h = 720; }
                              else if (val === '1920x1200') { w = 1920; h = 1200; }
                              setLocalOptions((prev) => ({
                                ...prev,
                                alternateOutput: {
                                  ...prev.alternateOutput,
                                  position: { ...(prev.alternateOutput.position || { left: 0, top: 0 }), width: w, height: h }
                                }
                              }));
                            }}
                            className="w-full bg-[#121317] border border-[#3b404d] rounded px-2.5 py-1.5 text-xs text-white"
                          >
                            <option value="1920x1080">1920 × 1080 (16:9 Full HD - Recommended)</option>
                            <option value="1024x768">1024 × 768 (4:3 Standard Projector / Monitor)</option>
                            <option value="1366x768">1366 × 768 (16:9 HD Display)</option>
                            <option value="1280x720">1280 × 720 (16:9 720p HD)</option>
                            <option value="1920x1200">1920 × 1200 (16:10 WUXGA)</option>
                            <option value="custom">Custom Dimensions</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-[11px]">
                          <div>
                            <span className="text-gray-400 block mb-0.5">Left:</span>
                            <input
                              type="number"
                              value={localOptions.alternateOutput.position?.left ?? 0}
                              onChange={(e) => setLocalOptions((prev) => ({
                                ...prev,
                                alternateOutput: { ...prev.alternateOutput, position: { ...(prev.alternateOutput.position || { top: 0, width: 1920, height: 1080 }), left: Number(e.target.value) } }
                              }))}
                              className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                            />
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5">Top:</span>
                            <input
                              type="number"
                              value={localOptions.alternateOutput.position?.top ?? 0}
                              onChange={(e) => setLocalOptions((prev) => ({
                                ...prev,
                                alternateOutput: { ...prev.alternateOutput, position: { ...(prev.alternateOutput.position || { left: 0, width: 1920, height: 1080 }), top: Number(e.target.value) } }
                              }))}
                              className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                            />
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5">Width:</span>
                            <input
                              type="number"
                              value={localOptions.alternateOutput.position?.width ?? 1920}
                              onChange={(e) => setLocalOptions((prev) => ({
                                ...prev,
                                alternateOutput: { ...prev.alternateOutput, position: { ...(prev.alternateOutput.position || { left: 0, top: 0, height: 1080 }), width: Number(e.target.value) } }
                              }))}
                              className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                            />
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5">Height:</span>
                            <input
                              type="number"
                              value={localOptions.alternateOutput.position?.height ?? 1080}
                              onChange={(e) => setLocalOptions((prev) => ({
                                ...prev,
                                alternateOutput: { ...prev.alternateOutput, position: { ...(prev.alternateOutput.position || { left: 0, top: 0, width: 1920 }), height: Number(e.target.value) } }
                              }))}
                              className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-[#292c36]">
                          <span className="text-xs text-gray-300 font-semibold">Alternate Output Font</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFontTarget({
                                title: 'Alternate Output Font',
                                font: localOptions.alternateOutput.defaultFont,
                                apply: (f) => setLocalOptions((prev) => ({
                                  ...prev,
                                  alternateOutput: { ...prev.alternateOutput, defaultFont: f }
                                }))
                              });
                            }}
                            className="px-3 py-1 bg-[#2a2d36] hover:bg-[#383d47] text-gray-200 rounded border border-[#3e4350] text-xs"
                          >
                            Default Font ▾
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ================= FOLDBACK (STAGE DISPLAY) ================= */}
              {activeCategory === 'Foldback' && (
                <div className="space-y-4">
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-3 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-200">
                      <input
                        type="checkbox"
                        checked={localOptions.foldback.enabled}
                        onChange={(e) => setLocalOptions((prev) => ({
                          ...prev,
                          foldback: { ...prev.foldback, enabled: e.target.checked }
                        }))}
                        className="rounded accent-blue-500"
                      />
                      <span>Enable Foldback (Confidence Stage Monitor)</span>
                    </label>

                    {localOptions.foldback.enabled && (
                      <div className="space-y-3 pt-2 border-t border-[#292c36]">
                        {renderDisplayLayoutVisualizer()}

                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-gray-400 block mb-1 font-semibold text-xs">Select Output Display</label>
                            <select
                              value={localOptions.foldback.outputMonitor}
                              onChange={(e) => {
                                const selectedVal = e.target.value;
                                const matched = screens.find((s: any) => (s.label || s.name) === selectedVal);
                                if (matched) {
                                  const x = matched.bounds?.x ?? 0;
                                  const y = matched.bounds?.y ?? 0;
                                  const w = matched.bounds?.width ?? 1920;
                                  const h = matched.bounds?.height ?? 1080;
                                  setLocalOptions((prev) => ({
                                    ...prev,
                                    foldback: {
                                      ...prev.foldback,
                                      outputMonitor: selectedVal,
                                      position: { left: x, top: y, width: w, height: h }
                                    }
                                  }));
                                } else {
                                  setLocalOptions((prev) => ({
                                    ...prev,
                                    foldback: { ...prev.foldback, outputMonitor: selectedVal }
                                  }));
                                }
                              }}
                              className="w-full bg-[#121317] border border-[#3b404d] rounded px-2.5 py-1.5 text-xs text-white"
                            >
                              {screens.length > 0 ? (
                                screens.map((scr: any, idx: number) => {
                                  const label = scr.label || scr.name || `Monitor ${idx + 1}`;
                                  const w = scr.bounds?.width || 1920;
                                  const h = scr.bounds?.height || 1080;
                                  return (
                                    <option key={idx} value={label}>
                                      {label} {scr.isPrimary ? '(Primary Desktop)' : '(Secondary Screen)'} [{w}×{h}]
                                    </option>
                                  );
                                })
                              ) : (
                                <>
                                  <option value="Monitor 3 (Stage)">Monitor 3 (Stage Confidence Screen - 1920×1080)</option>
                                  <option value="Monitor 2">Monitor 2 (HDMI - 1366×768)</option>
                                  <option value="NDI Stage">NDI Stage Display Feed (1920×1080)</option>
                                </>
                              )}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={() => setLocalOptions((prev) => ({
                              ...prev,
                              foldback: {
                                ...prev.foldback,
                                position: { left: 1920, top: 0, width: 1920, height: 1080 },
                                margins: { left: 0, top: 0, right: 0, bottom: 0 }
                              }
                            }))}
                            className="mt-5 px-2.5 py-1.5 bg-[#2a2d36] hover:bg-[#383d47] text-gray-200 rounded border border-[#3e4350] text-xs font-semibold"
                          >
                            Reset Position
                          </button>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-semibold text-gray-300">Resolution Preset / Aspect Ratio</span>
                            <span className="text-[10px] text-indigo-400 font-mono">
                              {localOptions.foldback.position?.width || 1920} × {localOptions.foldback.position?.height || 1080}
                            </span>
                          </div>
                          <select
                            value={
                              (localOptions.foldback.position?.width === 1920 && localOptions.foldback.position?.height === 1080)
                                ? '1920x1080'
                                : (localOptions.foldback.position?.width === 1024 && localOptions.foldback.position?.height === 768)
                                ? '1024x768'
                                : (localOptions.foldback.position?.width === 1366 && localOptions.foldback.position?.height === 768)
                                ? '1366x768'
                                : (localOptions.foldback.position?.width === 1280 && localOptions.foldback.position?.height === 720)
                                ? '1280x720'
                                : (localOptions.foldback.position?.width === 1920 && localOptions.foldback.position?.height === 1200)
                                ? '1920x1200'
                                : 'custom'
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              let w = 1920, h = 1080;
                              if (val === '1024x768') { w = 1024; h = 768; }
                              else if (val === '1366x768') { w = 1366; h = 768; }
                              else if (val === '1280x720') { w = 1280; h = 720; }
                              else if (val === '1920x1200') { w = 1920; h = 1200; }
                              setLocalOptions((prev) => ({
                                ...prev,
                                foldback: {
                                  ...prev.foldback,
                                  position: { ...(prev.foldback.position || { left: 0, top: 0 }), width: w, height: h }
                                }
                              }));
                            }}
                            className="w-full bg-[#121317] border border-[#3b404d] rounded px-2.5 py-1.5 text-xs text-white"
                          >
                            <option value="1920x1080">1920 × 1080 (16:9 Full HD - Recommended)</option>
                            <option value="1024x768">1024 × 768 (4:3 Standard Stage Monitor)</option>
                            <option value="1366x768">1366 × 768 (16:9 HD Display)</option>
                            <option value="1280x720">1280 × 720 (16:9 720p HD)</option>
                            <option value="1920x1200">1920 × 1200 (16:10 WUXGA)</option>
                            <option value="custom">Custom Dimensions</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-[11px]">
                          <div>
                            <span className="text-gray-400 block mb-0.5">Left:</span>
                            <input
                              type="number"
                              value={localOptions.foldback.position?.left ?? 0}
                              onChange={(e) => setLocalOptions((prev) => ({
                                ...prev,
                                foldback: { ...prev.foldback, position: { ...(prev.foldback.position || { top: 0, width: 1920, height: 1080 }), left: Number(e.target.value) } }
                              }))}
                              className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                            />
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5">Top:</span>
                            <input
                              type="number"
                              value={localOptions.foldback.position?.top ?? 0}
                              onChange={(e) => setLocalOptions((prev) => ({
                                ...prev,
                                foldback: { ...prev.foldback, position: { ...(prev.foldback.position || { left: 0, width: 1920, height: 1080 }), top: Number(e.target.value) } }
                              }))}
                              className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                            />
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5">Width:</span>
                            <input
                              type="number"
                              value={localOptions.foldback.position?.width ?? 1920}
                              onChange={(e) => setLocalOptions((prev) => ({
                                ...prev,
                                foldback: { ...prev.foldback, position: { ...(prev.foldback.position || { left: 0, top: 0, height: 1080 }), width: Number(e.target.value) } }
                              }))}
                              className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                            />
                          </div>
                          <div>
                            <span className="text-gray-400 block mb-0.5">Height:</span>
                            <input
                              type="number"
                              value={localOptions.foldback.position?.height ?? 1080}
                              onChange={(e) => setLocalOptions((prev) => ({
                                ...prev,
                                foldback: { ...prev.foldback, position: { ...(prev.foldback.position || { left: 0, top: 0, width: 1920 }), height: Number(e.target.value) } }
                              }))}
                              className="w-full bg-[#121317] border border-[#3b404d] rounded px-2 py-1 text-white"
                            />
                          </div>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer text-gray-300 pt-1">
                          <input
                            type="checkbox"
                            checked={localOptions.foldback.clockEnabled}
                            onChange={(e) => setLocalOptions((prev) => ({
                              ...prev,
                              foldback: { ...prev.foldback, clockEnabled: e.target.checked }
                            }))}
                            className="rounded accent-blue-500"
                          />
                          <span className="text-xs">Show Real-Time Clock & Service Countdown on Stage Display</span>
                        </label>

                        <div className="flex items-center justify-between pt-2 border-t border-[#292c36]">
                          <span className="text-xs text-gray-300 font-semibold">Foldback Text Font</span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingFontTarget({
                                title: 'Foldback Font',
                                font: localOptions.foldback.defaultFont,
                                apply: (f) => setLocalOptions((prev) => ({
                                  ...prev,
                                  foldback: { ...prev.foldback, defaultFont: f }
                                }))
                              });
                            }}
                            className="px-3 py-1 bg-[#2a2d36] hover:bg-[#383d47] text-gray-200 rounded border border-[#3e4350] text-xs"
                          >
                            Foldback Font ▾
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ================= SERVICE INTERVALS ================= */}
              {activeCategory === 'Service Intervals' && (
                <div className="space-y-4">
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-3 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-200">
                      <input
                        type="checkbox"
                        checked={localOptions.serviceIntervals.countdownEnabled}
                        onChange={(e) => setLocalOptions((prev) => ({
                          ...prev,
                          serviceIntervals: { ...prev.serviceIntervals, countdownEnabled: e.target.checked }
                        }))}
                        className="rounded accent-blue-500"
                      />
                      <span>Enable Service Interval Countdowns</span>
                    </label>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="text-gray-400 block mb-1">Countdown Time (mm:ss)</label>
                        <input
                          type="text"
                          value={localOptions.serviceIntervals.countdownTime}
                          onChange={(e) => setLocalOptions((prev) => ({
                            ...prev,
                            serviceIntervals: { ...prev.serviceIntervals, countdownTime: e.target.value }
                          }))}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2.5 py-1 text-white font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-gray-400 block mb-1">Interval Label</label>
                        <input
                          type="text"
                          value={localOptions.serviceIntervals.intervalType}
                          onChange={(e) => setLocalOptions((prev) => ({
                            ...prev,
                            serviceIntervals: { ...prev.serviceIntervals, intervalType: e.target.value }
                          }))}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2.5 py-1 text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= SLIDE LABELS ================= */}
              {activeCategory === 'Slide Labels' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-200">Slide Labels Configuration</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newLabel: SlideLabelConfig = {
                          id: `lbl-${Date.now()}`,
                          name: 'NEW LABEL',
                          bgColor: '#2E384D',
                          textColor: '#FFFFFF',
                          shortcut: 'N'
                        };
                        setLocalOptions((prev) => ({
                          ...prev,
                          slideLabels: [...prev.slideLabels, newLabel]
                        }));
                      }}
                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center gap-1 font-semibold"
                    >
                      <Plus size={12} />
                      <span>Add Label</span>
                    </button>
                  </div>

                  {/* Slide Labels Table matching EasyWorship screenshot */}
                  <div className="border border-[#323642] rounded-md overflow-hidden bg-[#18191f]">
                    <div className="grid grid-cols-12 bg-[#252833] border-b border-[#303440] px-3 py-1.5 font-bold text-gray-400 text-[11px]">
                      <div className="col-span-4">Label Name</div>
                      <div className="col-span-3">Background</div>
                      <div className="col-span-3">Text Color</div>
                      <div className="col-span-2 text-right">Action</div>
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-[#222530] custom-scrollbar">
                      {localOptions.slideLabels.map((lbl, index) => (
                        <div key={lbl.id} className="grid grid-cols-12 px-3 py-1.5 items-center hover:bg-[#1f2129]">
                          <div className="col-span-4 flex items-center gap-2">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border border-black/30"
                              style={{ backgroundColor: lbl.bgColor, color: lbl.textColor }}
                            >
                              {lbl.name}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">[{lbl.shortcut}]</span>
                          </div>

                          <div className="col-span-3 flex items-center gap-1.5">
                            <input
                              type="color"
                              value={lbl.bgColor}
                              onChange={(e) => {
                                const updated = [...localOptions.slideLabels];
                                updated[index].bgColor = e.target.value;
                                setLocalOptions({ ...localOptions, slideLabels: updated });
                              }}
                              className="w-5 h-5 rounded border border-[#3b404d] bg-transparent cursor-pointer"
                            />
                            <span className="font-mono text-[10px] text-gray-300">{lbl.bgColor}</span>
                          </div>

                          <div className="col-span-3 flex items-center gap-1.5">
                            <input
                              type="color"
                              value={lbl.textColor}
                              onChange={(e) => {
                                const updated = [...localOptions.slideLabels];
                                updated[index].textColor = e.target.value;
                                setLocalOptions({ ...localOptions, slideLabels: updated });
                              }}
                              className="w-5 h-5 rounded border border-[#3b404d] bg-transparent cursor-pointer"
                            />
                            <span className="font-mono text-[10px] text-gray-300">{lbl.textColor}</span>
                          </div>

                          <div className="col-span-2 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                const filtered = localOptions.slideLabels.filter((_, i) => i !== index);
                                setLocalOptions({ ...localOptions, slideLabels: filtered });
                              }}
                              className="p-1 text-gray-400 hover:text-rose-400 rounded transition-colors"
                              title="Delete label"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ================= ADVANCED ================= */}
              {activeCategory === 'Advanced' && (
                <div className="space-y-4">
                  {/* Live Options */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-3 space-y-2">
                    <div className="font-bold text-gray-200 border-b border-[#292c36] pb-1">
                      Live Options
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                      <input
                        type="checkbox"
                        checked={localOptions.advanced.showLiveOnStartup}
                        onChange={(e) => setLocalOptions((prev) => ({
                          ...prev,
                          advanced: { ...prev.advanced, showLiveOnStartup: e.target.checked }
                        }))}
                        className="rounded accent-blue-500"
                      />
                      <span>Show Live screen on startup</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                      <input
                        type="checkbox"
                        checked={localOptions.advanced.advanceScheduleOnGoLive}
                        onChange={(e) => setLocalOptions((prev) => ({
                          ...prev,
                          advanced: { ...prev.advanced, advanceScheduleOnGoLive: e.target.checked }
                        }))}
                        className="rounded accent-blue-500"
                      />
                      <span>Advance Schedule after Go Live is pressed</span>
                    </label>
                  </div>

                  {/* Remote Control Settings */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-3 space-y-3">
                    <div className="font-bold text-gray-200 border-b border-[#292c36] pb-1">
                      Remote Control Settings
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-gray-300">
                      <input
                        type="checkbox"
                        checked={localOptions.advanced.enableRemoteControl}
                        onChange={(e) => setLocalOptions((prev) => ({
                          ...prev,
                          advanced: { ...prev.advanced, enableRemoteControl: e.target.checked }
                        }))}
                        className="rounded accent-blue-500"
                      />
                      <span>Enable Mobile App / Remote Control</span>
                    </label>

                    {localOptions.advanced.enableRemoteControl && (
                      <div>
                        <label className="text-gray-400 block mb-1">Server Name Broadcast:</label>
                        <input
                          type="text"
                          value={localOptions.advanced.remoteName}
                          onChange={(e) => setLocalOptions((prev) => ({
                            ...prev,
                            advanced: { ...prev.advanced, remoteName: e.target.value }
                          }))}
                          className="w-full bg-[#121317] border border-[#3b404d] rounded px-2.5 py-1 text-white font-mono"
                        />
                      </div>
                    )}
                  </div>

                  {/* Reset Workspace Layout */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-3 space-y-2">
                    <div className="font-bold text-gray-200 border-b border-[#292c36] pb-1 flex items-center justify-between">
                      <span>Workspace & Panel Layout</span>
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.removeItem('workspace-layout-v1-main');
                          localStorage.removeItem('workspace-layout-v1-top');
                          localStorage.removeItem('workspace-layout-v1-bottom');
                          localStorage.removeItem('workspace-layout-v1-preview');
                          localStorage.removeItem('workspace-layout-v1-live');
                          localStorage.removeItem('workspace-layout-v1-resources-tree');
                          localStorage.removeItem('workspace-layout-v1-songs-tree');
                          localStorage.removeItem('workspace-layout-v1-scriptures-tree');
                          window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Workspace layout reset to default' }));
                          window.dispatchEvent(new CustomEvent('simpleworship:reset-layout'));
                        }}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-semibold flex items-center gap-1"
                      >
                        <RotateCcw size={12} />
                        <span>Reset Workspace Layout</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Restores all resizable panel splitters, drawer sizes, and preview/live dividers to default proportion.
                    </p>
                  </div>

                  {/* Profiles & Portable Plug-and-Play Data */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-3 space-y-2">
                    <div className="font-bold text-gray-200 border-b border-[#292c36] pb-1 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-cyan-300">
                        <FolderArchive size={14} />
                        <span>Profiles & Portable Backup Package</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={async () => {
                            const activeProfile = store.profiles.find(p => p.id === store.activeProfileId) || store.profiles[0];
                            const pkg = await exportPortableProfile(activeProfile, {
                              activeSchedule: store.activeSchedule,
                              shortcutSettings: store.shortcutSettings
                            });
                            downloadPortableProfilePackage(pkg);
                            window.dispatchEvent(
                              new CustomEvent('simpleworship:notify', { 
                                detail: `Exported portable profile package: "${pkg.profile.name}"` 
                              })
                            );
                          }}
                          className="px-2.5 py-1 bg-cyan-700 hover:bg-cyan-600 text-white rounded font-semibold flex items-center gap-1 text-[11px] transition-colors"
                        >
                          <Download size={12} />
                          <span>Export Portable (.swprofile)</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Current Active Profile: <span className="text-cyan-300 font-semibold">{store.profiles.find(p => p.id === store.activeProfileId)?.name || 'Default'}</span>. Export complete songs, themes, schedules, and custom settings as a portable bundle to transfer to USB or other computers.
                    </p>
                  </div>

                  {/* Baptist Hymnal & Full Scripture Database Seeding */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-3 space-y-2">
                    <div className="font-bold text-gray-200 border-b border-[#292c36] pb-1 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-cyan-300">
                        <Database size={14} />
                        <span>Baptist Hymnal & Bible Data Seeder</span>
                      </div>
                      <button
                        type="button"
                        disabled={isSeeding}
                        onClick={handleRunSeeder}
                        className="px-3 py-1 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white rounded font-semibold flex items-center gap-1.5 transition-colors"
                      >
                        <Sparkles size={12} className={isSeeding ? "animate-spin" : ""} />
                        <span>{isSeeding ? 'Seeding Database...' : 'Run Data Seeder'}</span>
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400">
                      Populates IndexedDB with the complete Baptist Hymnal collection (50+ hymns) and the full 66-book King James Version (KJV) & Tagalog (Ang Biblia 1905) Scripture text for offline search and projection.
                    </p>
                    {seedingProgress && (
                      <div className="bg-[#101216] border border-[#2b3040] p-2 rounded text-[11px] font-mono text-emerald-400">
                        {seedingProgress}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* CATEGORY: UI THEME & WORKSPACE APPEARANCE */}
              {/* ========================================================= */}
              {activeCategory === 'Appearance' && (
                <div className="space-y-4 text-xs">
                  {/* Theme Mode Selection */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-4 space-y-3">
                    <h3 className="font-bold text-amber-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-[#2b3040] pb-2">
                      <SunMoon size={14} />
                      <span>Workspace Theme & Color Mode</span>
                    </h3>

                    <p className="text-gray-400 text-[11px]">
                      Select your preferred SimpleWorship interface theme. You can switch between Studio Dark, Clean White Light, or automatic OS system detection.
                    </p>

                    <div className="grid grid-cols-3 gap-3 pt-1">
                      {/* Dark Mode */}
                      <button
                        type="button"
                        onClick={() => updateAppearance({ themeMode: 'dark' })}
                        className={`p-3 rounded-md border text-left flex flex-col justify-between transition-all keep-dark ${
                          (localOptions.appearance?.themeMode || 'dark') === 'dark'
                            ? 'bg-[#1e2330] border-cyan-500 ring-1 ring-cyan-500'
                            : 'bg-[#131418] border-[#2d313e] hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Moon size={18} className="text-cyan-400" />
                          {(localOptions.appearance?.themeMode || 'dark') === 'dark' && (
                            <span className="bg-cyan-500 text-black font-bold text-[9px] px-1.5 py-0.5 rounded">ACTIVE</span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-gray-100 text-xs">Dark Mode</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Studio Charcoal canvas. Optimized for low-light worship control rooms.</div>
                        </div>
                      </button>

                      {/* Light Mode */}
                      <button
                        type="button"
                        onClick={() => updateAppearance({ themeMode: 'light' })}
                        className={`p-3 rounded-md border text-left flex flex-col justify-between transition-all ${
                          localOptions.appearance?.themeMode === 'light'
                            ? 'bg-[#2a303c] border-amber-400 ring-1 ring-amber-400'
                            : 'bg-[#131418] border-[#2d313e] hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Sun size={18} className="text-amber-400" />
                          {localOptions.appearance?.themeMode === 'light' && (
                            <span className="bg-amber-400 text-black font-bold text-[9px] px-1.5 py-0.5 rounded">ACTIVE</span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-gray-100 text-xs">Light Mode (White)</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Crisp light canvas. Best for day services & illuminated media booths.</div>
                        </div>
                      </button>

                      {/* Auto System Detect */}
                      <button
                        type="button"
                        onClick={() => updateAppearance({ themeMode: 'system' })}
                        className={`p-3 rounded-md border text-left flex flex-col justify-between transition-all ${
                          localOptions.appearance?.themeMode === 'system'
                            ? 'bg-[#1e2330] border-emerald-400 ring-1 ring-emerald-400'
                            : 'bg-[#131418] border-[#2d313e] hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Laptop size={18} className="text-emerald-400" />
                          {localOptions.appearance?.themeMode === 'system' && (
                            <span className="bg-emerald-400 text-black font-bold text-[9px] px-1.5 py-0.5 rounded">AUTO</span>
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-gray-100 text-xs">Auto System Detect</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">Dynamically syncs with your Windows / macOS theme preferences.</div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Accent Color Customization */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-4 space-y-3">
                    <h3 className="font-bold text-gray-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-[#2b3040] pb-2">
                      <Palette size={14} className="text-purple-400" />
                      <span>Interface Accent Color</span>
                    </h3>

                    <div className="flex items-center gap-2 pt-1">
                      {[
                        { id: 'cyan', name: 'Cyan (Default)', bg: 'bg-cyan-500' },
                        { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-500' },
                        { id: 'blue', name: 'Royal Blue', bg: 'bg-blue-500' },
                        { id: 'purple', name: 'Purple', bg: 'bg-purple-500' },
                        { id: 'amber', name: 'Amber', bg: 'bg-amber-500' },
                      ].map((accent) => {
                        const isSelected = (localOptions.appearance?.accentColor || 'cyan') === accent.id;
                        return (
                          <button
                            key={accent.id}
                            type="button"
                            onClick={() => updateAppearance({ accentColor: accent.id })}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-all ${
                              isSelected
                                ? 'bg-[#222736] border-cyan-400 ring-1 ring-cyan-400 text-white font-semibold'
                                : 'bg-[#131418] border-[#2e3342] hover:border-gray-500 text-gray-300'
                            }`}
                          >
                            <span className={`w-3 h-3 rounded-full ${accent.bg}`} />
                            <span className="text-xs">{accent.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Density & Visual Settings */}
                  <div className="bg-[#18191f] border border-[#323642] rounded-md p-4 space-y-3">
                    <h3 className="font-bold text-gray-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-[#2b3040] pb-2">
                      <Sliders size={14} className="text-cyan-400" />
                      <span>Workspace Density & Visibility</span>
                    </h3>

                    <div className="space-y-3 pt-1">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={localOptions.appearance?.compactMode || false}
                          onChange={(e) => updateAppearance({ compactMode: e.target.checked })}
                          className="mt-0.5 rounded text-cyan-600 bg-[#252a3a] border-gray-600 focus:ring-cyan-500"
                        />
                        <div>
                          <div className="font-semibold text-gray-100">Compact Workspace Layout</div>
                          <div className="text-[11px] text-gray-400">Tightens toolbar and panel padding for maximum control screen density</div>
                        </div>
                      </label>

                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={localOptions.appearance?.highContrast || false}
                          onChange={(e) => updateAppearance({ highContrast: e.target.checked })}
                          className="mt-0.5 rounded text-cyan-600 bg-[#252a3a] border-gray-600 focus:ring-cyan-500"
                        />
                        <div>
                          <div className="font-semibold text-gray-100">High-Contrast Text & Slide Badges</div>
                          <div className="text-[11px] text-gray-400">Enhances text visibility on slide labels and status tags</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Redirection banner for Central Shortcuts */}
                  <div className="bg-[#17202d] border border-cyan-800/60 rounded-md p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-cyan-200 text-xs">
                      <Keyboard size={16} className="text-cyan-400 shrink-0" />
                      <span>Looking for Keyboard Shortcuts? Key bindings are now centrally managed in <strong>Center Settings & Shortcut Keys</strong>.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F1', code: 'F1', bubbles: true }));
                      }}
                      className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-black font-bold text-[11px] rounded transition-colors shrink-0"
                    >
                      Open Shortcuts (F1)
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Footer Actions matching EasyWorship Options window */}
        <div className="h-11 bg-[#1c1e24] px-4 border-t border-[#303440] flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={handleResetCurrentSection}
            className="flex items-center gap-1 text-gray-400 hover:text-white px-2.5 py-1 rounded hover:bg-[#2f333f] transition-colors"
          >
            <RotateCcw size={12} />
            <span>Reset Factory Defaults</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-1.5 bg-[#2b303d] hover:bg-[#383e4e] text-gray-200 rounded font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-1.5 bg-[#3b4254] hover:bg-[#4a5369] text-gray-100 rounded font-medium transition-colors"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={handleOk}
              className="flex items-center gap-1 px-5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded shadow transition-colors"
            >
              <Check size={13} />
              <span>OK</span>
            </button>
          </div>
        </div>

      </div>

      {/* Embedded Font Inspector Popup */}
      {editingFontTarget && (
        <FontInspectorPopup
          title={editingFontTarget.title}
          font={editingFontTarget.font}
          onChange={editingFontTarget.apply}
          onClose={() => setEditingFontTarget(null)}
        />
      )}
    </div>
  );
}

export default withPortal(OptionsDialog);
