
import { withPortal } from './common/withPortal';
import React, { useState, useEffect } from 'react';
import { X, Monitor, Plus, Trash2, Settings, Type, AlignLeft, Music, Book } from 'lucide-react';
import { useStore } from '../store/useStore';
import { OutputGroup, FontStyleOptions } from '../types';
import { DisplayManager } from '../core/DisplayManager';

interface SettingsModalProps {
  onClose: () => void;
}

function FontPicker({ label, value, onChange }: { label: string, value: FontStyleOptions, onChange: (v: FontStyleOptions) => void }) {
  return (
    <div className="flex flex-col gap-2 p-3 bg-[#181a20] rounded border border-[#2d313d]">
      <label className="text-xs font-bold text-gray-300">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <select 
          value={value.family}
          onChange={(e) => onChange({ ...value, family: e.target.value })}
          className="bg-[#2a2f3a] text-xs text-white border border-[#3f4554] rounded p-1.5 outline-none"
        >
          <option value="Arial">Arial</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
          <option value="Inter">Inter</option>
          <option value="Roboto">Roboto</option>
          <option value="Open Sans">Open Sans</option>
          <option value="system-ui">System Default</option>
        </select>
        
        <div className="flex items-center gap-2">
          <input 
            type="color" 
            value={value.color}
            onChange={(e) => onChange({ ...value, color: e.target.value })}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
          />
          <input 
            type="number"
            min={10} max={200}
            value={value.maxSize}
            onChange={(e) => onChange({ ...value, maxSize: parseInt(e.target.value) || 40 })}
            className="w-16 bg-[#2a2f3a] text-xs text-white border border-[#3f4554] rounded p-1.5 outline-none"
          />
          <span className="text-xs text-gray-400">px</span>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <button onClick={() => onChange({ ...value, bold: !value.bold })} className={`px-2 py-1 text-xs rounded border ${value.bold ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#2a2f3a] border-[#3f4554] text-gray-400'}`}>B</button>
        <button onClick={() => onChange({ ...value, italic: !value.italic })} className={`px-2 py-1 text-xs italic rounded border ${value.italic ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#2a2f3a] border-[#3f4554] text-gray-400'}`}>I</button>
        <button onClick={() => onChange({ ...value, underline: !value.underline })} className={`px-2 py-1 text-xs underline rounded border ${value.underline ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-[#2a2f3a] border-[#3f4554] text-gray-400'}`}>U</button>
      </div>
    </div>
  );
}

function SettingsModal({ onClose }: SettingsModalProps) {
  const store = useStore();
  const { outputGroups, addOutputGroup, removeOutputGroup, themesList, systemOptions, updateSystemOptions } = store;
  
  const [activeTab, setActiveTab] = useState<'displays' | 'general' | 'songs' | 'scriptures'>('displays');

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupRole, setNewGroupRole] = useState<'primary' | 'confidence' | 'broadcast' | 'lobby'>('confidence');
  const [newGroupAspectRatio, setNewGroupAspectRatio] = useState('16:9');
  const [newGroupDisplayId, setNewGroupDisplayId] = useState('');
  const [newGroupThemeId, setNewGroupThemeId] = useState(themesList[0]?.id || 'theme-stage');
  const [screens, setScreens] = useState<any[]>([]);

  useEffect(() => {
    if ('getScreenDetails' in window) {
      navigator.permissions.query({ name: 'window-management' as PermissionName })
        .then((result) => {
          if (result.state === 'granted') {
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
    } catch (err) {
      console.error('Failed to get screen details:', err);
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
      aspectRatio: newGroupAspectRatio as any,
      targetDisplayId: newGroupDisplayId || undefined,
    };
    addOutputGroup(newGroup);
    setNewGroupName('');
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/75 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#1c1f26] border border-[#2d313d] rounded-xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden text-gray-200 animate-in fade-in zoom-in-95 duration-150 text-xs" style={{ height: '80vh' }}>
        {/* Header */}
        <div className="px-4 py-3 bg-[#242833] border-b border-[#181a20] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-indigo-400" />
            <h2 className="font-bold text-sm text-gray-100">
              System Options
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#343946]">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-48 bg-[#181a20] border-r border-[#2d313d] flex flex-col p-2 gap-1 overflow-y-auto">
            <button 
              onClick={() => setActiveTab('displays')}
              className={`flex items-center gap-2 px-3 py-2 rounded text-left transition-colors ${activeTab === 'displays' ? 'bg-indigo-500/20 text-indigo-300 font-bold' : 'text-gray-400 hover:bg-[#252937] hover:text-gray-200'}`}
            >
              <Monitor size={14} /> Output / Routers
            </button>
            <button 
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-2 px-3 py-2 rounded text-left transition-colors ${activeTab === 'general' ? 'bg-indigo-500/20 text-indigo-300 font-bold' : 'text-gray-400 hover:bg-[#252937] hover:text-gray-200'}`}
            >
              <Settings size={14} /> General
            </button>
            <button 
              onClick={() => setActiveTab('songs')}
              className={`flex items-center gap-2 px-3 py-2 rounded text-left transition-colors ${activeTab === 'songs' ? 'bg-indigo-500/20 text-indigo-300 font-bold' : 'text-gray-400 hover:bg-[#252937] hover:text-gray-200'}`}
            >
              <Music size={14} /> Songs
            </button>
            <button 
              onClick={() => setActiveTab('scriptures')}
              className={`flex items-center gap-2 px-3 py-2 rounded text-left transition-colors ${activeTab === 'scriptures' ? 'bg-indigo-500/20 text-indigo-300 font-bold' : 'text-gray-400 hover:bg-[#252937] hover:text-gray-200'}`}
            >
              <Book size={14} /> Scriptures
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-5 overflow-y-auto bg-[#1c1f26] custom-scrollbar">
            
            {activeTab === 'displays' && (
              <div className="max-w-2xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2"><Monitor size={16}/> Routers & Output Monitors</h3>
                  <button onClick={requestScreenAccess} className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded flex items-center gap-2">
                    <Monitor size={14} /> Detect Monitors
                  </button>
                </div>
                
                <div className="space-y-4 mb-8">
                  {outputGroups.map(group => (
                    <div key={group.id} className="bg-[#242833] p-4 rounded-lg border border-[#2d313d] flex items-center justify-between">
                      <div>
                        <div className="font-bold text-gray-200 text-sm">{group.name}</div>
                        <div className="text-gray-400 mt-1">Role: <span className="uppercase text-xs">{group.role}</span> | Aspect Ratio: {group.aspectRatio} | Target: {group.targetDisplayId || 'Windowed'}</div>
                      </div>
                      <button onClick={() => removeOutputGroup(group.id)} className="p-2 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="bg-[#242833] p-4 rounded-lg border border-[#2d313d]">
                  
                  <h4 className="font-bold text-gray-200 mb-3">Add New Output Router</h4>
                  <form onSubmit={handleAddGroup} className="grid grid-cols-2 gap-4 items-end">
                    <div className="flex flex-col gap-1">
                      <label className="text-gray-400">Name</label>
                      <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="e.g. Stage Display 2" className="bg-[#1c1f26] border border-[#2d313d] rounded p-2 text-white outline-none" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-gray-400">Role</label>
                      <select value={newGroupRole} onChange={e => setNewGroupRole(e.target.value as any)} className="bg-[#1c1f26] border border-[#2d313d] rounded p-2 text-white outline-none">
                        <option value="primary">Primary Projector</option>
                        <option value="confidence">Confidence Monitor</option>
                        <option value="broadcast">Live Stream / Broadcast</option>
                        <option value="lobby">Lobby Display</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-gray-400">Aspect Ratio</label>
                      <select value={newGroupAspectRatio} onChange={e => setNewGroupAspectRatio(e.target.value as any)} className="bg-[#1c1f26] border border-[#2d313d] rounded p-2 text-white outline-none">
                        <option value="16:9">16:9 Widescreen</option>
                        <option value="4:3">4:3 Standard</option>
                        <option value="16:10">16:10 Computer</option>
                        <option value="21:9">21:9 Ultrawide</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-gray-400">Target Display</label>
                      <select value={newGroupDisplayId} onChange={e => setNewGroupDisplayId(e.target.value)} className="bg-[#1c1f26] border border-[#2d313d] rounded p-2 text-white outline-none">
                        <option value="">(None / Windowed)</option>
                        {screens.map(s => (
                          <option key={s.id || s.label || s.name} value={s.id || s.label || s.name}>
                            {s.label || s.name || 'Display'} ({s.width}x{s.height})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2 mt-2">
                      <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded p-2 font-bold flex justify-center items-center gap-2">
                        <Plus size={16} /> Add Router
                      </button>
                    </div>
                  </form>

                </div>
              </div>
            )}

            {activeTab === 'general' && (
              <div className="max-w-2xl space-y-6">
                <h3 className="font-bold text-lg text-white">General Settings</h3>
                <div className="grid grid-cols-1 gap-4">
                  <FontPicker 
                    label="Default Font" 
                    value={systemOptions.mainOutput.general.defaultFont} 
                    onChange={(v) => updateSystemOptions(prev => ({ ...prev, mainOutput: { ...prev.mainOutput, general: { ...prev.mainOutput.general, defaultFont: v } } }))} 
                  />
                  
                  <div className="flex items-center gap-3 bg-[#242833] p-4 rounded border border-[#2d313d]">
                    <input 
                      type="checkbox" 
                      checked={systemOptions.mainOutput.general.disableLogoOnLive} 
                      onChange={(e) => updateSystemOptions(prev => ({ ...prev, mainOutput: { ...prev.mainOutput, general: { ...prev.mainOutput.general, disableLogoOnLive: e.target.checked } } }))}
                      className="w-4 h-4 rounded border-gray-500"
                    />
                    <div>
                      <div className="font-bold text-gray-200">Disable Logo on Live</div>
                      <div className="text-gray-400">Automatically hide master logo when live output is triggered</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'songs' && (
              <div className="max-w-2xl space-y-6">
                <h3 className="font-bold text-lg text-white">Song Lyrics Format</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FontPicker 
                    label="Song Lyrics Font" 
                    value={systemOptions.mainOutput.song.songFont} 
                    onChange={(v) => updateSystemOptions(prev => ({ ...prev, mainOutput: { ...prev.mainOutput, song: { ...prev.mainOutput.song, songFont: v } } }))} 
                  />
                  <FontPicker 
                    label="Section Label Font" 
                    value={systemOptions.mainOutput.song.labelFont} 
                    onChange={(v) => updateSystemOptions(prev => ({ ...prev, mainOutput: { ...prev.mainOutput, song: { ...prev.mainOutput.song, labelFont: v } } }))} 
                  />
                  <FontPicker 
                    label="Copyright Font" 
                    value={systemOptions.mainOutput.song.copyrightFont} 
                    onChange={(v) => updateSystemOptions(prev => ({ ...prev, mainOutput: { ...prev.mainOutput, song: { ...prev.mainOutput.song, copyrightFont: v } } }))} 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-400">Label Location</label>
                    <select 
                      value={systemOptions.mainOutput.song.labelLocation} 
                      onChange={(e) => updateSystemOptions(prev => ({ ...prev, mainOutput: { ...prev.mainOutput, song: { ...prev.mainOutput.song, labelLocation: e.target.value as any } } }))}
                      className="bg-[#1c1f26] border border-[#2d313d] rounded p-2 text-white outline-none"
                    >
                      <option value="Header">Header</option>
                      <option value="Top Left">Top Left</option>
                      <option value="Top Right">Top Right</option>
                      <option value="Bottom Left">Bottom Left</option>
                      <option value="Bottom Right">Bottom Right</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-400">Copyright Location</label>
                    <select 
                      value={systemOptions.mainOutput.song.copyrightPosition} 
                      onChange={(e) => updateSystemOptions(prev => ({ ...prev, mainOutput: { ...prev.mainOutput, song: { ...prev.mainOutput.song, copyrightPosition: e.target.value as any } } }))}
                      className="bg-[#1c1f26] border border-[#2d313d] rounded p-2 text-white outline-none"
                    >
                      <option value="Bottom Left">Bottom Left</option>
                      <option value="Bottom Right">Bottom Right</option>
                      <option value="Bottom Center">Bottom Center</option>
                      <option value="Top Left">Top Left</option>
                      <option value="Top Right">Top Right</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'scriptures' && (
              <div className="max-w-2xl space-y-6">
                <h3 className="font-bold text-lg text-white">Scripture Format</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FontPicker 
                    label="Scripture Body Font" 
                    value={systemOptions.mainOutput.scripture.scriptureFont} 
                    onChange={(v) => updateSystemOptions(prev => ({ ...prev, mainOutput: { ...prev.mainOutput, scripture: { ...prev.mainOutput.scripture, scriptureFont: v } } }))} 
                  />
                  <FontPicker 
                    label="Reference Font" 
                    value={systemOptions.mainOutput.scripture.referenceFont} 
                    onChange={(v) => updateSystemOptions(prev => ({ ...prev, mainOutput: { ...prev.mainOutput, scripture: { ...prev.mainOutput.scripture, referenceFont: v } } }))} 
                  />
                  <FontPicker 
                    label="Verse Number Font" 
                    value={systemOptions.mainOutput.scripture.verseFont} 
                    onChange={(v) => updateSystemOptions(prev => ({ ...prev, mainOutput: { ...prev.mainOutput, scripture: { ...prev.mainOutput.scripture, verseFont: v } } }))} 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-400">Reference Location</label>
                    <select 
                      value={systemOptions.mainOutput.scripture.referenceLocation} 
                      onChange={(e) => updateSystemOptions(prev => ({ ...prev, mainOutput: { ...prev.mainOutput, scripture: { ...prev.mainOutput.scripture, referenceLocation: e.target.value as any } } }))}
                      className="bg-[#1c1f26] border border-[#2d313d] rounded p-2 text-white outline-none"
                    >
                      <option value="After Each Slide">After Each Slide</option>
                      <option value="Before Each Slide">Before Each Slide</option>
                      <option value="Top Left">Top Left</option>
                      <option value="Top Right">Top Right</option>
                      <option value="Bottom Left">Bottom Left</option>
                      <option value="Bottom Right">Bottom Right</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-gray-400">Verse Number Style</label>
                    <select 
                      value={systemOptions.mainOutput.scripture.verseNumberStyle} 
                      onChange={(e) => updateSystemOptions(prev => ({ ...prev, mainOutput: { ...prev.mainOutput, scripture: { ...prev.mainOutput.scripture, verseNumberStyle: e.target.value as any } } }))}
                      className="bg-[#1c1f26] border border-[#2d313d] rounded p-2 text-white outline-none"
                    >
                      <option value="superscript">Superscript</option>
                      <option value="bracket">Bracket [1]</option>
                      <option value="parenthesis">Parenthesis (1)</option>
                      <option value="period">Period 1.</option>
                      <option value="plain">Plain</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

export default withPortal(SettingsModal);
