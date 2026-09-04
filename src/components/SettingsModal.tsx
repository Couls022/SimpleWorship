import React, { useState, useEffect } from 'react';
import { X, Monitor, Plus, Trash2, ExternalLink, Settings, Check, Search } from 'lucide-react';
import { useStore } from '../store/useStore';
import { OutputGroup } from '../types';
import { DisplayManager } from '../core/DisplayManager';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const store = useStore();
  const { outputGroups, addOutputGroup, removeOutputGroup, updateOutputGroup, themesList, systemOptions, updateSystemOptions } = store;

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupRole, setNewGroupRole] = useState<'primary' | 'confidence' | 'broadcast' | 'lobby'>('confidence');
  const [newGroupThemeId, setNewGroupThemeId] = useState(themesList[0]?.id || 'theme-stage');
  
  const [screens, setScreens] = useState<any[]>([]);
  const [screenPermissionGranted, setScreenPermissionGranted] = useState(false);

  useEffect(() => {
    // Check if permission is already granted
    if ('getScreenDetails' in window) {
      navigator.permissions.query({ name: 'window-management' as PermissionName })
        .then((result) => {
          if (result.state === 'granted') {
            setScreenPermissionGranted(true);
            fetchScreens();
          }
        })
        .catch(console.error);
    }
  }, []);

  const fetchScreens = async () => {
    try {
      const screenDetails = await (window as any).getScreenDetails();
      setScreens(screenDetails.screens);
      
      screenDetails.addEventListener('screenschange', () => {
        setScreens(screenDetails.screens);
      });
    } catch (e) {
      console.error(e);
    }
  };

  const requestScreenAccess = async () => {
    if (!('getScreenDetails' in window)) {
      alert('Your browser does not support the Multi-Screen Window Placement API.');
      return;
    }
    try {
      await fetchScreens();
      setScreenPermissionGranted(true);
    } catch (err) {
      console.error('Failed to get screen details:', err);
      alert('Permission to access screen details was denied.');
    }
  };

  const handleAddGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    const newGroup: OutputGroup = {
      id: `group-${Date.now()}`,
      name: newGroupName.trim(),
      role: newGroupRole,
      themeId: newGroupThemeId,
      aspectRatio: '16:9',
    };

    addOutputGroup(newGroup);
    setNewGroupName('');
  };

  const handleLaunchGroup = (groupId: string) => {
    const group = outputGroups.find(g => g.id === groupId);
    const assignedScreenLabel = group?.displayIds?.[0];
    DisplayManager.openProjector(groupId, assignedScreenLabel);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#1c1f26] border border-[#2d313d] rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden text-gray-200 animate-in fade-in zoom-in-95 duration-150 text-xs">
        {/* Header */}
        <div className="px-4 py-3 bg-[#242833] border-b border-[#181a20] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-indigo-400" />
            <h2 className="font-bold text-sm text-gray-100">
              Output Groups & Projection Displays Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#343946]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[75vh] custom-scrollbar">
          <div>
            <h3 className="font-bold text-xs text-gray-200 mb-1">Registered Output Groups</h3>
            <p className="text-[11px] text-gray-400 mb-3">
              Configure multi-screen targets (Congregation projector, Stage confidence monitor, Lobby display, Live stream lower-thirds).
            </p>

            <div className="space-y-2">
              {outputGroups.map((g) => {
                const groupTheme = themesList.find(t => t.id === g.themeId);
                const assignedDisplayId = g.displayIds?.[0]; // Assume 1 for now

                return (
                  <div
                    key={g.id}
                    className="flex flex-col gap-2 p-3 rounded-lg bg-[#141519] border border-[#2b2e38]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-indigo-900/40 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                          <Monitor size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-gray-100 flex items-center gap-2">
                            <span>{g.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#252834] text-cyan-300 uppercase">
                              {g.role}
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400">
                            Theme: <span className="text-gray-200 font-semibold">{groupTheme?.name || 'Default'}</span> • Aspect Ratio: 16:9
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleLaunchGroup(g.id)}
                          className="flex items-center gap-1 bg-[#252936] hover:bg-[#303546] border border-[#3b4155] text-indigo-300 hover:text-white px-2.5 py-1 rounded text-[11px] transition-colors"
                        >
                          <ExternalLink size={12} />
                          <span>Launch Window</span>
                        </button>

                        {outputGroups.length > 1 && (
                          <button
                            onClick={() => removeOutputGroup(g.id)}
                            className="p-1 hover:bg-rose-900/60 text-gray-500 hover:text-rose-300 rounded transition-colors"
                            title="Delete Group"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Display Mapping */}
                    <div className="flex flex-col gap-1 mt-1 pt-2 border-t border-[#252834]">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Assigned Display</label>
                        {!screenPermissionGranted && (
                          <button 
                            onClick={requestScreenAccess}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-900/20 px-2 py-0.5 rounded"
                          >
                            <Search size={10} /> Detect Displays
                          </button>
                        )}
                      </div>
                      <select
                        value={assignedDisplayId || ''}
                        onChange={(e) => updateOutputGroup(g.id, { displayIds: e.target.value ? [e.target.value] : [] })}
                        className="bg-[#0f1013] border border-[#323642] rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-indigo-500 max-w-sm"
                      >
                        <option value="">No dedicated display assigned (Windowed)</option>
                        {screenPermissionGranted && screens.map((screen, idx) => (
                          <option key={screen.label || idx} value={screen.label}>
                            Display {idx + 1}: {screen.label || `Unknown (${screen.width}x${screen.height})`} {screen.isPrimary ? '(Primary)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add New Output Group Form */}
          <form onSubmit={handleAddGroup} className="p-3 rounded-lg bg-[#22252e] border border-[#2e323e] space-y-3">
            <div className="font-bold text-xs text-indigo-300 flex items-center gap-1.5">
              <Plus size={13} />
              <span>Add Output Group</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-gray-400 block mb-1 font-semibold">Group Name *</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. Nursery Monitor"
                  className="w-full bg-[#141519] border border-[#323642] rounded px-2.5 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-semibold">Role</label>
                <select
                  value={newGroupRole}
                  onChange={(e) => setNewGroupRole(e.target.value as any)}
                  className="w-full bg-[#141519] border border-[#323642] rounded px-2.5 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="primary">Primary (Congregation)</option>
                  <option value="confidence">Confidence Monitor (Stage)</option>
                  <option value="broadcast">Broadcast / Lower-Thirds</option>
                  <option value="lobby">Lobby / Overflow</option>
                </select>
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-semibold">Assigned Theme</label>
                <select
                  value={newGroupThemeId}
                  onChange={(e) => setNewGroupThemeId(e.target.value)}
                  className="w-full bg-[#141519] border border-[#323642] rounded px-2.5 py-1 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                >
                  {themesList.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
            >
              Add Group
            </button>
          </form>

          {/* Global Transition Settings */}
          <div className="pt-2 border-t border-[#2e323e] mt-4">
            <h3 className="text-gray-300 font-bold mb-2 flex items-center gap-1.5">
              <Settings size={14} className="text-gray-500" />
              Global Transition Settings
            </h3>
            <div className="bg-[#141519] border border-[#2e323e] rounded-lg p-3 flex flex-col gap-3">
              <div>
                <label className="text-gray-400 block mb-1 font-semibold text-xs">Transition Duration ({systemOptions.mainOutput.transitions.duration}ms)</label>
                <input
                  type="range"
                  min="0"
                  max="2000"
                  step="50"
                  value={systemOptions.mainOutput.transitions.duration}
                  onChange={(e) => {
                    const duration = parseInt(e.target.value);
                    updateSystemOptions((opts) => ({
                      ...opts,
                      mainOutput: {
                        ...opts.mainOutput,
                        transitions: {
                          ...opts.mainOutput.transitions,
                          duration
                        }
                      }
                    }));
                  }}
                  className="w-full accent-indigo-500"
                />
                <div className="flex justify-between text-[9px] text-gray-500 mt-1">
                  <span>0ms (Cut)</span>
                  <span>1000ms</span>
                  <span>2000ms</span>
                </div>
              </div>

              <div>
                <label className="text-gray-400 block mb-1 font-semibold text-xs">Easing Function</label>
                <select
                  value={systemOptions.mainOutput.transitions.easing || 'easeInOut'}
                  onChange={(e) => {
                    const easing = e.target.value;
                    updateSystemOptions((opts) => ({
                      ...opts,
                      mainOutput: {
                        ...opts.mainOutput,
                        transitions: {
                          ...opts.mainOutput.transitions,
                          easing
                        }
                      }
                    }));
                  }}
                  className="w-full bg-[#0f1013] border border-[#323642] rounded px-2.5 py-1.5 text-xs text-gray-100 focus:outline-none focus:border-indigo-500"
                >
                  <option value="easeInOut">Ease In Out (Smooth)</option>
                  <option value="easeIn">Ease In (Accelerate)</option>
                  <option value="easeOut">Ease Out (Decelerate)</option>
                  <option value="linear">Linear (Constant)</option>
                  <option value="circIn">Circ In</option>
                  <option value="circOut">Circ Out</option>
                  <option value="backIn">Back In</option>
                  <option value="backOut">Back Out</option>
                </select>
              </div>
            </div>
          </div>

          {/* Workspace Settings */}
          <div className="pt-2 border-t border-[#2e323e] mt-4">
            <h3 className="text-gray-300 font-bold mb-2 flex items-center gap-1.5">
              <Settings size={14} className="text-gray-500" />
              Workspace Configuration
            </h3>
            <div className="bg-[#141519] border border-[#2e323e] rounded-lg p-3 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-gray-200">Reset Workspace Layout</h4>
                <p className="text-gray-500 text-[10px] mt-0.5">
                  Restores all panels, sizes, and splitters to their factory default positions.
                </p>
              </div>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to reset the workspace layout to default?')) {
                    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Resetting workspace layout...' }));
                    onClose();
                  }
                }}
                className="px-3 py-1.5 bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/40 hover:text-white rounded transition-colors font-bold whitespace-nowrap"
              >
                Reset Layout
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#242833] border-t border-[#181a20] flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-[#272b36] hover:bg-[#323744] text-gray-300 font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
