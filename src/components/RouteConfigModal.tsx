import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Monitor, MonitorUp, ArrowLeft, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useScreens } from '../hooks/useScreens';
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
  const [displayIds, setDisplayIds] = useState<string[]>(group?.displayIds || []);

  useEffect(() => {
    if (group) {
      setName(group.name);
      setThemeId(group.themeId || 'theme-global');
      setAspectRatio(group.aspectRatio || '16:9');
      setDisplayIds(group.displayIds || []);
    }
  }, [groupId]);

  if (!group) return null;

  // Available real screens
  const availableDisplays = screens;

  const handleToggleDisplay = (dispObj: any) => {
    const label = dispObj.label || dispObj.name;
    let newDisplays = [...displayIds];
    if (newDisplays.includes(label)) {
      newDisplays = newDisplays.filter(id => id !== label);
    } else {
      newDisplays.push(label);
      // Auto detect native screen resolution from physical monitor
      const w = dispObj.width || dispObj.bounds?.width;
      const h = dispObj.height || dispObj.bounds?.height;
      if (w && h) {
        setAspectRatio(`${w}x${h}`);
      }
    }
    setDisplayIds(newDisplays);
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

    // 1. Update Output Group in store
    updateOutputGroup(groupId, {
      name,
      themeId,
      aspectRatio,
      displayIds,
      customResolution: { width: targetW, height: targetH }
    });

    // 2. Fully sync systemOptions.mainOutput.general
    updateSystemOptions((prev) => ({
      ...prev,
      mainOutput: {
        ...prev.mainOutput,
        general: {
          ...prev.mainOutput.general,
          outputMonitor: displayIds[0] || prev.mainOutput.general.outputMonitor,
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
            <label className="block text-xs font-bold text-gray-300 mb-2">Display Resolution / Aspect Ratio</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: '16:9', label: '16:9 Widescreen', sub: '1920×1080 Full HD' },
                { val: '4:3', label: '4:3 Standard', sub: '1024×768 Projector' },
                { val: '1366x768', label: '16:9 HD', sub: '1366×768 Display' },
                { val: '1280x720', label: '16:9 720p', sub: '1280×720 HD' },
                { val: '16:10', label: '16:10 WUXGA', sub: '1920×1200' },
                { val: 'options', label: 'Inherit Default', sub: 'From General Options' },
              ].map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setAspectRatio(opt.val)}
                  className={`text-left px-3 py-2 text-xs rounded border transition-colors ${
                    aspectRatio === opt.val 
                      ? 'bg-cyan-900/30 border-cyan-500 text-cyan-300 font-bold' 
                      : 'bg-[#141519] border-[#323642] text-gray-300 hover:bg-[#1a1c23]'
                  }`}
                >
                  <div className="truncate">{opt.label}</div>
                  <div className="text-[10px] text-gray-500 truncate">{opt.sub}</div>
                </button>
              ))}
            </div>
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
            
            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
              {availableDisplays.map((disp, i) => {
                const label = disp.label || disp.name;
                const w = disp.width || disp.bounds?.width;
                const h = disp.height || disp.bounds?.height;
                const resText = w && h ? `${w}×${h}` : '';

                return (
                  <label key={i} className="flex items-center justify-between p-2 rounded border border-[#2d313d] bg-[#141519] cursor-pointer hover:bg-[#1a1c23] transition-colors">
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox"
                        checked={displayIds.includes(label)}
                        onChange={() => handleToggleDisplay(disp)}
                        className="w-4 h-4 rounded border-gray-500 bg-transparent accent-indigo-500 text-indigo-500"
                      />
                      <Monitor size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-200">{label} {disp.isPrimary ? '(Primary)' : ''}</span>
                    </div>
                    {resText && (
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#252834] text-cyan-400 border border-[#3b4155]">
                        {resText}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            
            <div className="flex items-center gap-2 mt-2">
               <button onClick={() => setDisplayIds(availableDisplays.map(d => d.label || d.name || d.id))} className="text-[10px] text-indigo-400 hover:text-indigo-300">Select All</button>
               <span className="text-gray-600">|</span>
               <button onClick={() => setDisplayIds([])} className="text-[10px] text-gray-400 hover:text-gray-300">Clear All</button>
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
                  displayIds: [...displayIds]
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
