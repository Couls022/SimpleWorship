import { withPortal } from './common/withPortal';
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Keyboard, 
  Sliders, 
  ArrowRight, 
  ArrowLeft, 
  ArrowDown, 
  ArrowUp, 
  Tv, 
  Play, 
  Check, 
  RotateCcw, 
  Zap, 
  Search, 
  Sparkles,
  Layers,
  Radio,
  FileText,
  Volume2,
  Edit2
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { CustomKeyMappings } from '../types';
import { 
  DEFAULT_SIMPLEWORSHIP_MAPPINGS,
  DEFAULT_EASYWORSHIP_MAPPINGS, 
  DEFAULT_PROPRESENTER_MAPPINGS, 
  formatKeyEvent, 
  getFriendlyKeyName, 
  matchesShortcut 
} from '../utils/keyboardShortcuts';

interface CenterShortcutSettingsModalProps {
  onClose: () => void;
}

function CenterShortcutSettingsModal({ onClose }: CenterShortcutSettingsModalProps) {
  const store = useStore();
  const { shortcutSettings, updateShortcutSettings, resetShortcutSettings } = store;

  const [activeTab, setActiveTab] = useState<'shortcuts' | 'behavior' | 'tester'>('shortcuts');
  const [searchQuery, setSearchQuery] = useState('');
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [detectedAction, setDetectedAction] = useState<string | null>(null);

  // Recording state for key customization
  const [editingMappingKey, setEditingMappingKey] = useState<keyof CustomKeyMappings | null>(null);

  const mappings: CustomKeyMappings = shortcutSettings.keyMappings || DEFAULT_SIMPLEWORSHIP_MAPPINGS;

  // Listener for key press when editing a mapping or in tester mode
  useEffect(() => {
    const handleKeyRecord = (e: KeyboardEvent) => {
      if (editingMappingKey) {
        e.preventDefault();
        e.stopPropagation();

        if (e.key === 'Escape') {
          setEditingMappingKey(null);
          return;
        }

        const formatted = formatKeyEvent(e);
        if (formatted) {
          const updatedMappings: CustomKeyMappings = {
            ...mappings,
            [editingMappingKey]: formatted
          };
          updateShortcutSettings({
            presetName: 'Custom',
            keyMappings: updatedMappings
          });
          setEditingMappingKey(null);
          window.dispatchEvent(new CustomEvent('simpleworship:notify', { 
            detail: `Updated shortcut for ${editingMappingKey} to [${formatted}]` 
          }));
        }
        return;
      }

      if (activeTab === 'tester') {
        e.preventDefault();
        const formatted = formatKeyEvent(e);
        setPressedKey(formatted);

        if (matchesShortcut(e, mappings.goLive)) {
          setDetectedAction('GO LIVE (Send to Output Screen)');
        } else if (matchesShortcut(e, mappings.nextSlide)) {
          setDetectedAction('NEXT SLIDE (Advance Live Slide)');
        } else if (matchesShortcut(e, mappings.previousSlide)) {
          setDetectedAction('PREVIOUS SLIDE (Rewind Live Slide)');
        } else if (matchesShortcut(e, mappings.clearOutput)) {
          setDetectedAction('CLEAR OUTPUT (Hide Lyrics / Scriptures)');
        } else if (matchesShortcut(e, mappings.blackout)) {
          setDetectedAction('BLACKOUT (Mute Screen)');
        } else if (matchesShortcut(e, mappings.logo)) {
          setDetectedAction('SHOW LOGO (Display Church Logo)');
        } else if (matchesShortcut(e, mappings.nextItem)) {
          setDetectedAction('NEXT ITEM (Next Schedule Item)');
        } else if (matchesShortcut(e, mappings.previousItem)) {
          setDetectedAction('PREVIOUS ITEM (Previous Schedule Item)');
        } else if (['1','2','3','4','5','6','7','8','9'].includes(e.key)) {
          setDetectedAction(`JUMP TO VERSE / SLIDE #${e.key}`);
        } else if (e.key.toLowerCase() === 'f' && (e.ctrlKey || e.metaKey)) {
          setDetectedAction('FOCUS SEARCH');
        } else if (e.key.toLowerCase() === 'n' && (e.ctrlKey || e.metaKey)) {
          setDetectedAction('CREATE NEW SONG');
        } else if (e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)) {
          setDetectedAction('SAVE SCHEDULE');
        } else {
          setDetectedAction('Unassigned Key');
        }
      }
    };

    window.addEventListener('keydown', handleKeyRecord, true);
    return () => window.removeEventListener('keydown', handleKeyRecord, true);
  }, [editingMappingKey, activeTab, mappings, updateShortcutSettings]);

  const configurableActions: { key: keyof CustomKeyMappings; action: string; desc: string; category: string; badge: string }[] = [
    { key: 'goLive', action: 'Go Live', desc: 'Push selected item or preview slide directly to the Live Output screen', category: 'Live Control', badge: 'Critical' },
    { key: 'nextSlide', action: 'Next Slide', desc: 'Advance to the next slide in active Live presentation', category: 'Navigation', badge: 'Primary' },
    { key: 'previousSlide', action: 'Previous Slide', desc: 'Go back to previous slide in active Live presentation', category: 'Navigation', badge: 'Primary' },
    { key: 'clearOutput', action: 'Clear Output', desc: 'Hide lyrics/text on live screen while retaining background', category: 'Screen Mute', badge: 'Live FX' },
    { key: 'blackout', action: 'Blackout Screen', desc: 'Mute entire projector screen to black', category: 'Screen Mute', badge: 'Live FX' },
    { key: 'logo', action: 'Show Church Logo', desc: 'Display default church logo splash screen', category: 'Screen Mute', badge: 'Live FX' },
    { key: 'nextItem', action: 'Next Schedule Item', desc: 'Advance to next song, scripture, or presentation in service order', category: 'Schedule', badge: 'Workflow' },
    { key: 'previousItem', action: 'Previous Schedule Item', desc: 'Go back to previous item in service order', category: 'Schedule', badge: 'Workflow' },
  ];

  const fixedShortcuts = [
    { key: 'Spacebar', action: 'Spacebar Advance', desc: 'Advance live slide forward (configurable in Behavior tab)', category: 'Navigation', badge: 'Fast Action' },
    { key: '1 to 9 Keys', action: 'Direct Verse Jump', desc: 'Jump directly to Verse 1-9 or Chorus without navigating sequentially', category: 'Quick Jump', badge: 'Pro' },
    { key: 'Ctrl + F', action: 'Focus Search Bar', desc: 'Instantly jump to search bar in Songs & Scriptures', category: 'Library', badge: 'Shortcut' },
    { key: 'Ctrl + N', action: 'New Song Editor', desc: 'Open modal to author a new song', category: 'Library', badge: 'Shortcut' },
    { key: 'Ctrl + S', action: 'Save Schedule', desc: 'Save current order of service to local database', category: 'System', badge: 'Shortcut' },
    { key: 'F1 or Ctrl+/', action: 'Center Settings Modal', desc: 'Open this settings dialog anytime', category: 'System', badge: 'Help' },
  ];

  const filteredActions = configurableActions.filter(a => 
    !searchQuery || 
    a.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (mappings[a.key] || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const applyPreset = (preset: 'SimpleWorship' | 'EasyWorship' | 'ProPresenter') => {
    if (preset === 'SimpleWorship' || preset === 'EasyWorship') {
      updateShortcutSettings({
        presetName: 'SimpleWorship',
        arrowControlsLive: true,
        spacebarAdvancesLive: true,
        enterGoesLive: true,
        singleClickGoLive: false,
        numericQuickJump: true,
        quickKeysBcl: true,
        wrapAroundSlides: false,
        keyMappings: { ...DEFAULT_SIMPLEWORSHIP_MAPPINGS }
      });
    } else if (preset === 'ProPresenter') {
      updateShortcutSettings({
        presetName: 'ProPresenter',
        arrowControlsLive: true,
        spacebarAdvancesLive: true,
        enterGoesLive: true,
        singleClickGoLive: true,
        numericQuickJump: true,
        quickKeysBcl: true,
        wrapAroundSlides: true,
        keyMappings: { ...DEFAULT_PROPRESENTER_MAPPINGS }
      });
    }
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Switched to ${preset === 'ProPresenter' ? 'ProPresenter' : 'SimpleWorship'} key profile!` }));
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 select-none animate-in fade-in duration-150">
      <div className="bg-[#1a1c24] border border-[#323646] rounded-xl shadow-2xl w-[92vw] max-w-4xl h-[85vh] max-h-[720px] flex flex-col overflow-hidden text-gray-200">
        {/* Modal Top Bar */}
        <div className="h-12 bg-[#232732] border-b border-[#2d3242] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-cyan-600/20 text-cyan-400 rounded border border-cyan-500/30">
              <Keyboard size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-100 flex items-center gap-2">
                <span>Center Settings & Shortcut Keys</span>
                <span className="text-[10px] bg-indigo-600/40 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                  Live Output Speed Control
                </span>
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-[#343949] rounded-lg text-gray-400 hover:text-white transition-colors"
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Selector & Presets */}
        <div className="bg-[#1f222d] border-b border-[#2a2f3e] px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('shortcuts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'shortcuts'
                  ? 'bg-cyan-600 text-white shadow-sm font-bold'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#2a2f3f]'
              }`}
            >
              <Keyboard size={13} />
              <span>Key Bindings List</span>
            </button>

            <button
              onClick={() => setActiveTab('behavior')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'behavior'
                  ? 'bg-cyan-600 text-white shadow-sm font-bold'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#2a2f3f]'
              }`}
            >
              <Sliders size={13} />
              <span>Live & Arrow Move Behavior</span>
            </button>

            <button
              onClick={() => setActiveTab('tester')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'tester'
                  ? 'bg-cyan-600 text-white shadow-sm font-bold'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#2a2f3f]'
              }`}
            >
              <Zap size={13} />
              <span>Live Key Tester</span>
            </button>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-400 text-[11px]">Preset:</span>
            <button
              onClick={() => applyPreset('SimpleWorship')}
              className={`px-2 py-1 rounded text-[11px] font-semibold border ${
                shortcutSettings.presetName === 'SimpleWorship' || shortcutSettings.presetName === 'EasyWorship'
                  ? 'bg-indigo-600 border-indigo-400 text-white'
                  : 'bg-[#262a37] border-[#373c4d] text-gray-300 hover:text-white'
              }`}
            >
              SimpleWorship Classic
            </button>
            <button
              onClick={() => applyPreset('ProPresenter')}
              className={`px-2 py-1 rounded text-[11px] font-semibold border ${
                shortcutSettings.presetName === 'ProPresenter'
                  ? 'bg-indigo-600 border-indigo-400 text-white'
                  : 'bg-[#262a37] border-[#373c4d] text-gray-300 hover:text-white'
              }`}
            >
              ProPresenter Style
            </button>
          </div>
        </div>

        {/* Tab 1: Key Bindings List */}
        {activeTab === 'shortcuts' && (
          <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3">
            {/* Search Filter */}
            <div className="relative max-w-md">
              <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search shortcut key or action (e.g., arrow, live, black, verse)..."
                className="w-full bg-[#141519] border border-[#343948] focus:border-cyan-500 rounded-lg pl-9 pr-3 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2 text-gray-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto rounded-lg border border-[#2b3040] bg-[#14161c] divide-y divide-[#222634] custom-scrollbar">
              {/* Customizable Actions */}
              <div className="bg-[#1b1e28] px-3 py-1.5 text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex justify-between items-center">
                <span>Customizable Live Hotkeys</span>
                <span className="text-[10px] text-gray-400 font-normal">Click any key badge or edit icon to rebind</span>
              </div>
              
              {filteredActions.map((item) => {
                const currentKey = mappings[item.key] || 'Unassigned';
                const isRecording = editingMappingKey === item.key;

                return (
                  <div key={item.key} className="p-2.5 flex items-center justify-between hover:bg-[#1b1f2b] transition-colors gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => setEditingMappingKey(item.key)}
                        className={`font-mono border px-3 py-1.5 rounded text-xs font-bold shadow-sm shrink-0 flex items-center gap-1.5 transition-all ${
                          isRecording 
                            ? 'bg-rose-600 border-rose-400 text-white animate-pulse shadow-rose-900/50' 
                            : 'bg-[#232734] border-[#3c4256] text-cyan-300 hover:border-cyan-400 hover:bg-[#2c3244]'
                        }`}
                        title="Click to change shortcut key"
                      >
                        {isRecording ? (
                          <span>Press key now...</span>
                        ) : (
                          <>
                            <span>{getFriendlyKeyName(currentKey)}</span>
                            <Edit2 size={11} className="text-gray-400" />
                          </>
                        )}
                      </button>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-gray-100">{item.action}</span>
                          <span className="text-[10px] bg-[#292e3f] text-gray-300 px-1.5 py-0.5 rounded font-medium">
                            {item.category}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 truncate">{item.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        item.badge === 'Critical' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                        item.badge === 'Primary' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                        item.badge === 'Live FX' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}>
                        {item.badge}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Fixed System Shortcuts */}
              <div className="bg-[#1b1e28] px-3 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                System & Navigation Hotkeys
              </div>

              {fixedShortcuts.map((s, idx) => (
                <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-[#1b1f2b] transition-colors gap-3 opacity-90">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono bg-[#232734] border border-[#3c4256] text-gray-300 px-2.5 py-1 rounded text-xs font-bold shadow-sm shrink-0">
                      {s.key}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-gray-200">{s.action}</span>
                        <span className="text-[10px] bg-[#292e3f] text-gray-400 px-1.5 py-0.5 rounded font-medium">
                          {s.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 truncate">{s.desc}</p>
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-gray-700/40 text-gray-400 border border-gray-600/30 shrink-0">
                    {s.badge}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 2: Live & Arrow Move Behavior Settings */}
        {activeTab === 'behavior' && (
          <div className="flex-1 p-5 overflow-y-auto space-y-4 custom-scrollbar">
            <div className="bg-[#14161c] border border-[#2b3040] rounded-xl p-4 space-y-4">
              <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                <Play size={13} />
                <span>Live Panel Navigation & Arrow Keys</span>
              </h3>

              {/* Setting 1 */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#1e2230] cursor-pointer transition-colors border border-transparent hover:border-[#343a4e]">
                <input
                  type="checkbox"
                  checked={shortcutSettings.arrowControlsLive}
                  onChange={(e) => updateShortcutSettings({ arrowControlsLive: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-cyan-600 bg-[#252a3a] border-gray-600 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-bold text-xs text-gray-100 flex items-center gap-1.5">
                    <span>Arrow Down (↓) & Up (↑) directly advance Live Screen</span>
                    <span className="text-[10px] bg-emerald-600/30 text-emerald-300 px-1.5 py-0.2 rounded">Recommended</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    When active, pressing the Down or Up arrow key will immediately step through the lyrics or scripture slides on the active projector screen.
                  </p>
                </div>
              </label>

              {/* Setting 2 */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#1e2230] cursor-pointer transition-colors border border-transparent hover:border-[#343a4e]">
                <input
                  type="checkbox"
                  checked={shortcutSettings.spacebarAdvancesLive}
                  onChange={(e) => updateShortcutSettings({ spacebarAdvancesLive: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-cyan-600 bg-[#252a3a] border-gray-600 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-bold text-xs text-gray-100">
                    Spacebar advances to the Next Live Slide
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Allows operators to comfortably keep their hand on the spacebar to flow through verses in worship services.
                  </p>
                </div>
              </label>

              {/* Setting 3 */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#1e2230] cursor-pointer transition-colors border border-transparent hover:border-[#343a4e]">
                <input
                  type="checkbox"
                  checked={shortcutSettings.enterGoesLive}
                  onChange={(e) => updateShortcutSettings({ enterGoesLive: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-cyan-600 bg-[#252a3a] border-gray-600 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-bold text-xs text-gray-100">
                    Enter Key & F5 instantly Go Live
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Transfers whichever song or item is currently loaded in the Preview pane to the live projector screen.
                  </p>
                </div>
              </label>

              {/* Setting 4 */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#1e2230] cursor-pointer transition-colors border border-transparent hover:border-[#343a4e]">
                <input
                  type="checkbox"
                  checked={shortcutSettings.numericQuickJump}
                  onChange={(e) => updateShortcutSettings({ numericQuickJump: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-cyan-600 bg-[#252a3a] border-gray-600 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-bold text-xs text-gray-100">
                    Number Keys (1-9) Direct Verse Jump
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Pressing 1 jumps directly to Verse 1, 2 jumps to Verse 2, etc., allowing quick improvisation when the pastor or song leader repeats a verse.
                  </p>
                </div>
              </label>

              {/* Setting 5 */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#1e2230] cursor-pointer transition-colors border border-transparent hover:border-[#343a4e]">
                <input
                  type="checkbox"
                  checked={shortcutSettings.quickKeysBcl}
                  onChange={(e) => updateShortcutSettings({ quickKeysBcl: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-cyan-600 bg-[#252a3a] border-gray-600 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-bold text-xs text-gray-100">
                    B, C, L Quick Keys for Blackout, Clear Text, Logo
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Single keystroke shortcuts to black out (B), clear words (C), or display church logo (L).
                  </p>
                </div>
              </label>

              {/* Setting 6 */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#1e2230] cursor-pointer transition-colors border border-transparent hover:border-[#343a4e]">
                <input
                  type="checkbox"
                  checked={shortcutSettings.wrapAroundSlides}
                  onChange={(e) => updateShortcutSettings({ wrapAroundSlides: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-cyan-600 bg-[#252a3a] border-gray-600 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-bold text-xs text-gray-100">
                    Loop / Wrap Around at End of Song
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Advancing on the last verse loops back to the first verse rather than stopping at the end.
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Tab 3: Interactive Live Key Tester */}
        {activeTab === 'tester' && (
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-4">
            <div className="max-w-md space-y-2">
              <h3 className="text-base font-bold text-gray-100">Interactive Shortcut Key Tester</h3>
              <p className="text-xs text-gray-400">
                Press any key or shortcut combination on your keyboard to verify that SimpleWorship detects it and see the corresponding live action.
              </p>
            </div>

            <div className="w-72 h-36 bg-[#12141a] border-2 border-dashed border-cyan-500/40 rounded-2xl flex flex-col items-center justify-center p-4 shadow-xl">
              {pressedKey ? (
                <>
                  <span className="font-mono text-3xl font-extrabold text-cyan-400 bg-[#202534] px-4 py-1.5 rounded-xl border border-cyan-500/50 shadow-lg animate-in zoom-in-95 duration-100">
                    {pressedKey}
                  </span>
                  <span className="mt-3 text-xs font-bold text-emerald-300">
                    {detectedAction || 'Key Detected'}
                  </span>
                </>
              ) : (
                <div className="text-gray-500 text-xs flex flex-col items-center gap-2">
                  <Keyboard size={28} className="text-gray-600 animate-pulse" />
                  <span>Press any key now...</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-gray-400 bg-[#212431] px-3 py-1.5 rounded-lg border border-[#303546]">
              <span>Try pressing:</span>
              <kbd className="px-1.5 py-0.5 bg-[#2c3144] rounded text-cyan-300 font-mono text-[10px]">Space</kbd>
              <kbd className="px-1.5 py-0.5 bg-[#2c3144] rounded text-cyan-300 font-mono text-[10px]">↓ Down</kbd>
              <kbd className="px-1.5 py-0.5 bg-[#2c3144] rounded text-cyan-300 font-mono text-[10px]">F5</kbd>
              <kbd className="px-1.5 py-0.5 bg-[#2c3144] rounded text-cyan-300 font-mono text-[10px]">B</kbd>
              <kbd className="px-1.5 py-0.5 bg-[#2c3144] rounded text-cyan-300 font-mono text-[10px]">1</kbd>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="h-12 bg-[#1f222d] border-t border-[#2a2f3e] flex items-center justify-between px-4 shrink-0">
          <button
            onClick={() => {
              if (confirm('Reset all shortcuts and live navigation behavior to factory defaults?')) {
                resetShortcutSettings();
                window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Shortcuts reset to factory default' }));
              }
            }}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-rose-400 px-3 py-1.5 rounded hover:bg-[#292e3f] transition-colors"
          >
            <RotateCcw size={12} />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-[#2a2f3f] hover:bg-[#353b4f] text-gray-200 rounded-lg text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Shortcut settings applied successfully!' }));
                onClose();
              }}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-bold transition-all shadow-md"
            >
              <Check size={14} />
              <span>Done & Apply</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withPortal(CenterShortcutSettingsModal);
