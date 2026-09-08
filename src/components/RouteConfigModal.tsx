import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Monitor, MonitorUp, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, CheckCircle2, Play } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useScreens } from '../hooks/useScreens';
import { DisplayManager } from '../core/DisplayManager';
import { OutputGroup } from '../types';

interface RouteConfigModalProps {
  groupId: string;
  onClose: () => void;
}

export default function RouteConfigModal({ groupId, onClose }: RouteConfigModalProps) {
  const store = useStore();
  const { outputGroups, updateOutputGroup, themesList, moveOutputGroup } = store;
  const { screens, permissionGranted, requestAccess } = useScreens();
  const { updateSystemOptions } = store;
  
  const group = outputGroups.find(g => g.id === groupId);
  const groupIndex = outputGroups.findIndex(g => g.id === groupId);
  const isFirst = groupIndex <= 0;
  const isLast = groupIndex === -1 || groupIndex >= outputGroups.length - 1;
  
  const [name, setName] = useState(group?.name || '');
  const [themeId, setThemeId] = useState(group?.themeId || 'theme-global');
  const [aspectRatio, setAspectRatio] = useState(group?.aspectRatio || '16:9');
  const [selectedDisplayIds, setSelectedDisplayIds] = useState<string[]>(() => {
    if (group?.displayIds && group.displayIds.length > 0) return group.displayIds;
    if (group?.targetDisplayId) return [group.targetDisplayId];
    return [];
  });

  useEffect(() => {
    if (group) {
      setName(group.name);
      setThemeId(group.themeId || 'theme-global');
      setAspectRatio(group.aspectRatio || '16:9');
      const initialDisplays = (group.displayIds && group.displayIds.length > 0)
        ? group.displayIds
        : (group.targetDisplayId ? [group.targetDisplayId] : []);
      setSelectedDisplayIds(initialDisplays);
    }
  }, [groupId]);

  if (!group) return null;

  // Available real screens
  const availableDisplays = screens;

  const handleToggleDisplay = (dispObj: any) => {
    const label = dispObj.label || dispObj.name;
    setSelectedDisplayIds(prev => {
      if (prev.includes(label)) {
        return prev.filter(id => id !== label);
      } else {
        return [...prev, label];
      }
    });

    // Auto detect native screen resolution from physical monitor
    const w = dispObj.width || dispObj.bounds?.width;
    const h = dispObj.height || dispObj.bounds?.height;
    if (w && h) {
      setAspectRatio(`${w}x${h}`);
    }
  };

  const handleTestPresentation = async () => {
    try {
      store.setActiveControlGroupId(groupId);
      for (const disp of selectedDisplayIds) {
        await DisplayManager.sendPresentationToTarget(groupId, disp);
      }
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { 
          detail: `1:1 Presentation sent to ${selectedDisplayIds.join(', ')} (Active overlay: ${name})` 
        })
      );
    } catch (err: any) {
      console.error('Failed to send presentation test:', err);
    }
  };

  const handleSave = () => {
    let targetW = 1920;
    let targetH = 1080;

    if (aspectRatio.includes('x')) {
      const parts = aspectRatio.split('x');
      targetW = parseInt(parts[0], 10) || 1920;
      targetH = parseInt(parts[1], 10) || 1080;
    } else if (aspectRatio === '4:3') {
      targetW = 1024;
      targetH = 768;
    } else if (aspectRatio === '16:10') {
      targetW = 1920;
      targetH = 1200;
    }

    const primaryTarget = selectedDisplayIds[0] || '';

    // 1. Update Output Group in store with multi-target 1:1 mapping
    updateOutputGroup(groupId, {
      name,
      themeId,
      aspectRatio,
      targetDisplayId: primaryTarget,
      displayIds: selectedDisplayIds,
      customResolution: { width: targetW, height: targetH }
    });

    // 2. Fully sync systemOptions.mainOutput.general
    updateSystemOptions((prev) => ({
      ...prev,
      mainOutput: {
        ...prev.mainOutput,
        general: {
          ...prev.mainOutput.general,
          outputMonitor: primaryTarget || '',
          position: {
            ...prev.mainOutput.general.position,
            width: targetW,
            height: targetH
          }
        }
      }
    }));

    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/75 z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div 
        className="bg-[#1a1c23] border border-[#2d313d] rounded-xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 bg-[#20222a] border-b border-[#2d313d]">
          <h2 className="text-sm font-bold text-gray-200">Configure Output Route</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        
        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">Route Name (Panel Name)</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#141519] border border-[#323642] rounded px-3 py-2 text-sm text-gray-200"
            />
          </div>


          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-gray-300">Display Targets</label>
              <div className="flex items-center gap-2">
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
                  className="text-[10px] bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-600/50 text-cyan-300 hover:text-white px-2 py-0.5 rounded transition-all font-bold cursor-pointer"
                >
                  Identify Displays (1, 2, 3...)
                </button>
                {!permissionGranted && 'getScreenDetails' in window && (
                  <button 
                    onClick={requestAccess}
                    className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-0.5 rounded transition-colors"
                  >
                    Detect Real Screens
                  </button>
                )}
              </div>
            </div>
            
            {/* Multi-Target 1-to-1 Target Monitor Selection */}
            <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
              {availableDisplays.map((disp, i) => {
                const label = disp.label || disp.name;
                const w = disp.width || disp.bounds?.width;
                const h = disp.height || disp.bounds?.height;
                const resText = w && h ? `${w}×${h}` : '';
                const isSelected = selectedDisplayIds.includes(label);
                const isOperatorScreen = !!disp.isPrimary;

                // Check other route panels targeting this monitor
                const otherSharingGroups = outputGroups.filter(
                  (g) => g.id !== groupId && (g.displayIds?.includes(label) || g.targetDisplayId === label)
                );

                return (
                  <div
                    key={i}
                    onClick={() => handleToggleDisplay(disp)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'border-indigo-500/80 bg-indigo-950/30 shadow-xs ring-1 ring-indigo-500/30'
                        : 'border-[#2d313d] bg-[#141519] hover:bg-[#1a1c23] hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all shrink-0 ${
                        isSelected ? 'border-indigo-400 bg-indigo-600' : 'border-gray-600 bg-transparent'
                      }`}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <Monitor size={16} className={`shrink-0 ${isSelected ? 'text-indigo-400' : 'text-gray-400'}`} />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-gray-200'}`}>
                            {label}
                          </span>
                          {isOperatorScreen && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Operator Primary
                            </span>
                          )}
                          {!isOperatorScreen && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Audience Projector
                            </span>
                          )}
                        </div>

                        {otherSharingGroups.length > 0 ? (
                          <span className="text-[10px] text-amber-400/90 truncate">
                            Shared with: {otherSharingGroups.map(g => g.name).join(', ')} (Active route overlays 1:1)
                          </span>
                        ) : isOperatorScreen ? (
                          <span className="text-[10px] text-gray-500">
                            Operator workspace console display
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-400">
                            Dedicated output monitor (1 is to 1)
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {resText && (
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#252834] text-cyan-400 border border-[#3b4155]">
                          {resText}
                        </span>
                      )}
                      {isSelected && (
                        <span className="text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                          1:1 TARGET
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#2d313d]/60 text-[11px] text-gray-400">
              <span className="text-gray-400 flex items-center gap-1">
                <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                1:1 Presentation: Shared monitors overlay the active route panel cleanly.
              </span>
              <button
                type="button"
                onClick={handleTestPresentation}
                className="flex items-center gap-1 text-sky-400 hover:text-sky-300 font-medium cursor-pointer shrink-0"
                title="Immediately test sending presentation to target monitor(s)"
              >
                <Play size={11} className="text-sky-400" />
                Send Test
              </button>
            </div>
          </div>
        </div>

        <div className="p-3 bg-[#16171c] border-t border-[#2d313d] flex justify-between gap-2 items-center">
          <div className="flex gap-2">
            <button 
              onClick={() => {
                const duplicated = {
                  id: `group-${Date.now()}`,
                  name: `${name} (Copy)`,
                  role: group.role,
                  themeId,
                  targetDisplayId: selectedDisplayIds[0] || '',
                  displayIds: selectedDisplayIds
                };
                store.addOutputGroup(duplicated);
                onClose();
              }}
              className="px-2.5 py-1.5 text-xs text-indigo-400 border border-indigo-500/30 rounded hover:bg-indigo-500/10 transition-colors"
            >
              Duplicate Route
            </button>

            {outputGroups.length > 1 && (
              <button 
                onClick={() => {
                  store.removeOutputGroup(groupId);
                  onClose();
                }}
                className="px-2.5 py-1.5 text-xs text-rose-400 border border-rose-500/30 rounded hover:bg-rose-500/10 transition-colors"
                title="Delete this Live Output Route / Panel"
              >
                Delete Route
              </button>
            )}
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded transition-colors"
            >
              Save Route
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
