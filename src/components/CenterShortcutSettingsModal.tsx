import { withPortal } from './common/withPortal';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Edit2,
  RotateCw,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { CustomKeyMappings, ShortcutSettings } from '../types';
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

interface EvaluatedAction {
  actionName: string;
  category: string;
  ruleExplanation: string;
  isFunctional: boolean;
  execute?: () => void;
}

function CenterShortcutSettingsModal({ onClose }: CenterShortcutSettingsModalProps) {
  const store = useStore();
  const { shortcutSettings, updateShortcutSettings, resetShortcutSettings } = store;

  // Snapshot initial settings so "Cancel" can revert if needed
  const [initialSettings] = useState<ShortcutSettings>(() => JSON.parse(JSON.stringify(shortcutSettings)));

  const [activeTab, setActiveTab] = useState<'shortcuts' | 'behavior' | 'tester'>('shortcuts');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Interactive Live Key Tester State
  const [pressedKey, setPressedKey] = useState<string>('Space');
  const [testerResult, setTesterResult] = useState<EvaluatedAction | null>(null);
  const [lastExecutedMessage, setLastExecutedMessage] = useState<string | null>(null);

  // Recording state for custom key rebinding
  const [editingMappingKey, setEditingMappingKey] = useState<keyof CustomKeyMappings | null>(null);

  const mappings: CustomKeyMappings = shortcutSettings.keyMappings || DEFAULT_SIMPLEWORSHIP_MAPPINGS;

  // Evaluates any key event or simulated key against all active mappings and behavior settings
  const evaluateKeyAction = useCallback((
    keyName: string, 
    syntheticEvent?: Partial<KeyboardEvent>
  ): EvaluatedAction => {
    const key = syntheticEvent?.key || keyName;
    const keyLower = key.toLowerCase();
    const isNoModifier = !syntheticEvent?.ctrlKey && !syntheticEvent?.metaKey && !syntheticEvent?.altKey && !syntheticEvent?.shiftKey;
    const hasCtrl = Boolean(syntheticEvent?.ctrlKey || syntheticEvent?.metaKey);

    // Mock KeyboardEvent for matchesShortcut
    const mockEvent = {
      key,
      ctrlKey: Boolean(syntheticEvent?.ctrlKey),
      metaKey: Boolean(syntheticEvent?.metaKey),
      altKey: Boolean(syntheticEvent?.altKey),
      shiftKey: Boolean(syntheticEvent?.shiftKey),
    } as KeyboardEvent;

    // 1. GO LIVE controls
    if (
      matchesShortcut(mockEvent, mappings.goLive) ||
      (mappings.goLive === 'F5' && key === 'F5') ||
      (shortcutSettings.enterGoesLive && (key === 'Enter' || key === 'F5')) ||
      (hasCtrl && key === 'Enter')
    ) {
      return {
        actionName: 'GO LIVE (Send to Output Screen)',
        category: 'Live Control',
        ruleExplanation: matchesShortcut(mockEvent, mappings.goLive)
          ? `Matched configured shortcut [${mappings.goLive}]`
          : (shortcutSettings.enterGoesLive ? 'Active via "Enter Key & F5 instantly Go Live" setting' : 'Ctrl+Enter Go Live hotkey'),
        isFunctional: true,
        execute: () => {
          store.goLive();
        }
      };
    }

    // 2. Next Slide controls
    if (
      matchesShortcut(mockEvent, mappings.nextSlide) ||
      (shortcutSettings.arrowControlsLive && (key === 'ArrowDown' || key === 'Down')) ||
      (shortcutSettings.spacebarAdvancesLive && (key === ' ' || key === 'Space' || keyLower === 'space')) ||
      key === 'PageDown'
    ) {
      let rule = `Matched configured shortcut [${mappings.nextSlide}]`;
      if (shortcutSettings.spacebarAdvancesLive && (key === ' ' || key === 'Space' || keyLower === 'space')) {
        rule = 'Active via "Spacebar advances to the Next Live Slide" setting';
      } else if (shortcutSettings.arrowControlsLive && (key === 'ArrowDown' || key === 'Down')) {
        rule = 'Active via "Arrow Down & Up advance Live Screen" setting';
      } else if (key === 'PageDown') {
        rule = 'Presentation standard PageDown key';
      }

      return {
        actionName: 'NEXT LIVE SLIDE (Advance)',
        category: 'Navigation',
        ruleExplanation: rule,
        isFunctional: true,
        execute: () => {
          store.goLiveNext();
        }
      };
    }

    // 3. Previous Slide controls
    if (
      matchesShortcut(mockEvent, mappings.previousSlide) ||
      (shortcutSettings.arrowControlsLive && (key === 'ArrowUp' || key === 'Up')) ||
      key === 'PageUp'
    ) {
      let rule = `Matched configured shortcut [${mappings.previousSlide}]`;
      if (shortcutSettings.arrowControlsLive && (key === 'ArrowUp' || key === 'Up')) {
        rule = 'Active via "Arrow Down & Up advance Live Screen" setting';
      } else if (key === 'PageUp') {
        rule = 'Presentation standard PageUp key';
      }

      return {
        actionName: 'PREVIOUS LIVE SLIDE (Rewind)',
        category: 'Navigation',
        ruleExplanation: rule,
        isFunctional: true,
        execute: () => {
          store.goLivePrev();
        }
      };
    }

    // 4. Clear Output controls
    if (
      matchesShortcut(mockEvent, mappings.clearOutput) ||
      (mappings.clearOutput === 'F7' && key === 'F7') ||
      (shortcutSettings.quickKeysBcl && isNoModifier && keyLower === 'c')
    ) {
      return {
        actionName: 'CLEAR OUTPUT (Text Off, Background Remains)',
        category: 'Screen Mute',
        ruleExplanation: shortcutSettings.quickKeysBcl && isNoModifier && keyLower === 'c'
          ? 'Active via "B, C, L Quick Keys" setting'
          : `Matched configured shortcut [${mappings.clearOutput}]`,
        isFunctional: true,
        execute: () => {
          const targetId = store.activeControlGroupId || store.outputGroups[0]?.id || 'group-congregation';
          store.toggleClear(targetId);
        }
      };
    }

    // 5. Blackout Screen controls
    if (
      matchesShortcut(mockEvent, mappings.blackout) ||
      (mappings.blackout === 'F6' && key === 'F6') ||
      (shortcutSettings.quickKeysBcl && isNoModifier && keyLower === 'b')
    ) {
      return {
        actionName: 'BLACKOUT SCREEN (Mute Screen to Black)',
        category: 'Screen Mute',
        ruleExplanation: shortcutSettings.quickKeysBcl && isNoModifier && keyLower === 'b'
          ? 'Active via "B, C, L Quick Keys" setting'
          : `Matched configured shortcut [${mappings.blackout}]`,
        isFunctional: true,
        execute: () => {
          const targetId = store.activeControlGroupId || store.outputGroups[0]?.id || 'group-congregation';
          store.toggleBlack(targetId);
        }
      };
    }

    // 6. Show Church Logo controls
    if (
      matchesShortcut(mockEvent, mappings.logo) ||
      (mappings.logo === 'F8' && key === 'F8') ||
      (shortcutSettings.quickKeysBcl && isNoModifier && keyLower === 'l')
    ) {
      return {
        actionName: 'SHOW CHURCH LOGO (Display Logo Splash)',
        category: 'Screen Mute',
        ruleExplanation: shortcutSettings.quickKeysBcl && isNoModifier && keyLower === 'l'
          ? 'Active via "B, C, L Quick Keys" setting'
          : `Matched configured shortcut [${mappings.logo}]`,
        isFunctional: true,
        execute: () => {
          const targetId = store.activeControlGroupId || store.outputGroups[0]?.id || 'group-congregation';
          store.toggleLogo(targetId);
        }
      };
    }

    // 7. Schedule Navigation
    if (
      matchesShortcut(mockEvent, mappings.nextItem) ||
      (isNoModifier && (keyLower === 'n' || key === 'ArrowRight'))
    ) {
      return {
        actionName: 'NEXT SCHEDULE ITEM',
        category: 'Schedule',
        ruleExplanation: `Matched shortcut [${mappings.nextItem || 'ArrowRight'}]`,
        isFunctional: true,
        execute: () => {
          store.goNextScheduleItem();
        }
      };
    }
    if (
      matchesShortcut(mockEvent, mappings.previousItem) ||
      (isNoModifier && (keyLower === 'p' || key === 'ArrowLeft'))
    ) {
      return {
        actionName: 'PREVIOUS SCHEDULE ITEM',
        category: 'Schedule',
        ruleExplanation: `Matched shortcut [${mappings.previousItem || 'ArrowLeft'}]`,
        isFunctional: true,
        execute: () => {
          store.goPrevScheduleItem();
        }
      };
    }

    // 8. Direct Verse Jump (1-9)
    if (['1','2','3','4','5','6','7','8','9'].includes(key) && isNoModifier) {
      const num = parseInt(key, 10);
      if (shortcutSettings.numericQuickJump) {
        return {
          actionName: `DIRECT JUMP TO VERSE / SLIDE #${num}`,
          category: 'Quick Jump',
          ruleExplanation: 'Active via "Number Keys (1-9) Direct Verse Jump" setting',
          isFunctional: true,
          execute: () => {
            const targetId = store.activeControlGroupId || store.outputGroups[0]?.id || 'group-congregation';
            store.goLiveSlide(num - 1, targetId);
          }
        };
      } else {
        return {
          actionName: `Number Key [${key}] (Disabled in Behavior Settings)`,
          category: 'Quick Jump',
          ruleExplanation: 'Enable "Number Keys (1-9) Direct Verse Jump" in Live & Arrow Move Behavior tab to use',
          isFunctional: false
        };
      }
    }

    // 9. Escape Key
    if (key === 'Escape') {
      return {
        actionName: 'ESCAPE (Restore Live Presentation / Dismiss Overlays)',
        category: 'System',
        ruleExplanation: 'Cancels active Blackout, Clear, or Logo and restores live slide text',
        isFunctional: true,
        execute: () => {
          const targetId = store.activeControlGroupId || store.outputGroups[0]?.id || 'group-congregation';
          const activeGroup = store.groupStates[targetId];
          if (activeGroup?.isBlack) store.toggleBlack(targetId);
          if (activeGroup?.isClear) store.toggleClear(targetId);
          if (activeGroup?.showLogo) store.toggleLogo(targetId);
        }
      };
    }

    // 10. System shortcuts
    if (hasCtrl && keyLower === 'f') {
      return {
        actionName: 'FOCUS SEARCH BAR',
        category: 'Library',
        ruleExplanation: 'Focuses Song and Scripture search bar instantly',
        isFunctional: true,
        execute: () => {
          window.dispatchEvent(new CustomEvent('simpleworship:focus-search', { detail: { target: 'songs' } }));
        }
      };
    }
    if (hasCtrl && keyLower === 'n') {
      return {
        actionName: 'CREATE NEW SONG',
        category: 'Library',
        ruleExplanation: 'Opens Song Authoring modal',
        isFunctional: true
      };
    }
    if (hasCtrl && keyLower === 's') {
      return {
        actionName: 'SAVE SCHEDULE',
        category: 'System',
        ruleExplanation: 'Persists active schedule to local database',
        isFunctional: true,
        execute: () => {
          window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Schedule saved to local database!' }));
        }
      };
    }

    return {
      actionName: 'Unassigned Key',
      category: 'General',
      ruleExplanation: 'This key combination is not mapped to any active live presentation action',
      isFunctional: false
    };
  }, [mappings, shortcutSettings, store]);

  // Update initial tester state
  useEffect(() => {
    if (activeTab === 'tester' && (!testerResult || pressedKey === 'Space')) {
      const initialEval = evaluateKeyAction('Space', { key: ' ' });
      setTesterResult(initialEval);
    }
  }, [activeTab, evaluateKeyAction, pressedKey, testerResult]);

  // Listener for key press when recording a mapping or in tester mode
  useEffect(() => {
    const handleKeyRecord = (e: KeyboardEvent) => {
      // If user is actively recording a key for a mapping
      if (editingMappingKey) {
        e.preventDefault();
        e.stopPropagation();

        // Escape cancels recording
        if (e.key === 'Escape') {
          setEditingMappingKey(null);
          return;
        }

        // Backspace or Delete unbinds the key
        if (e.key === 'Backspace' || e.key === 'Delete') {
          const updatedMappings: CustomKeyMappings = {
            ...mappings,
            [editingMappingKey]: ''
          };
          updateShortcutSettings({
            presetName: 'Custom',
            keyMappings: updatedMappings
          });
          setEditingMappingKey(null);
          window.dispatchEvent(new CustomEvent('simpleworship:notify', { 
            detail: `Cleared shortcut for ${editingMappingKey}` 
          }));
          return;
        }

        // Ignore modifier-only key presses
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
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

      // If user is in the Live Key Tester tab
      if (activeTab === 'tester') {
        e.preventDefault();
        e.stopPropagation();

        const formatted = formatKeyEvent(e) || e.key;
        setPressedKey(formatted);
        const evaluated = evaluateKeyAction(formatted, e);
        setTesterResult(evaluated);
        setLastExecutedMessage(null);
      }
    };

    window.addEventListener('keydown', handleKeyRecord, true);
    return () => window.removeEventListener('keydown', handleKeyRecord, true);
  }, [editingMappingKey, activeTab, mappings, updateShortcutSettings, evaluateKeyAction]);

  const configurableActions: { key: keyof CustomKeyMappings; action: string; desc: string; category: string; badge: string; defaultKey: string }[] = [
    { key: 'goLive', action: 'Go Live', desc: 'Push selected item or preview slide directly to the Live Output screen', category: 'Live Control', badge: 'Critical', defaultKey: DEFAULT_SIMPLEWORSHIP_MAPPINGS.goLive },
    { key: 'nextSlide', action: 'Next Slide', desc: 'Advance to the next slide in active Live presentation', category: 'Navigation', badge: 'Primary', defaultKey: DEFAULT_SIMPLEWORSHIP_MAPPINGS.nextSlide },
    { key: 'previousSlide', action: 'Previous Slide', desc: 'Go back to previous slide in active Live presentation', category: 'Navigation', badge: 'Primary', defaultKey: DEFAULT_SIMPLEWORSHIP_MAPPINGS.previousSlide },
    { key: 'clearOutput', action: 'Clear Output', desc: 'Hide lyrics/text on live screen while retaining background', category: 'Screen Mute', badge: 'Live FX', defaultKey: DEFAULT_SIMPLEWORSHIP_MAPPINGS.clearOutput },
    { key: 'blackout', action: 'Blackout Screen', desc: 'Mute entire projector screen to black', category: 'Screen Mute', badge: 'Live FX', defaultKey: DEFAULT_SIMPLEWORSHIP_MAPPINGS.blackout },
    { key: 'logo', action: 'Show Church Logo', desc: 'Display default church logo splash screen', category: 'Screen Mute', badge: 'Live FX', defaultKey: DEFAULT_SIMPLEWORSHIP_MAPPINGS.logo },
    { key: 'nextItem', action: 'Next Schedule Item', desc: 'Advance to next song, scripture, or presentation in service order', category: 'Schedule', badge: 'Workflow', defaultKey: DEFAULT_SIMPLEWORSHIP_MAPPINGS.nextItem },
    { key: 'previousItem', action: 'Previous Schedule Item', desc: 'Go back to previous item in service order', category: 'Schedule', badge: 'Workflow', defaultKey: DEFAULT_SIMPLEWORSHIP_MAPPINGS.previousItem },
  ];

  const fixedShortcuts = [
    { key: 'Spacebar', action: 'Spacebar Advance', desc: 'Advance live slide forward (configurable in Behavior tab)', category: 'Navigation', badge: 'Fast Action' },
    { key: '1 to 9 Keys', action: 'Direct Verse Jump', desc: 'Jump directly to Verse 1-9 or Chorus without navigating sequentially', category: 'Quick Jump', badge: 'Pro' },
    { key: 'Ctrl + F', action: 'Focus Search Bar', desc: 'Instantly jump to search bar in Songs & Scriptures', category: 'Library', badge: 'Shortcut' },
    { key: 'Ctrl + N', action: 'New Song Editor', desc: 'Open modal to author a new song', category: 'Library', badge: 'Shortcut' },
    { key: 'Ctrl + S', action: 'Save Schedule', desc: 'Save current order of service to local database', category: 'System', badge: 'Shortcut' },
    { key: 'F1 or Ctrl+/', action: 'Center Settings Modal', desc: 'Open this settings and shortcuts manager anytime', category: 'System', badge: 'Help' },
  ];

  const filteredActions = configurableActions.filter(a => 
    !searchQuery || 
    a.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
    a.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (mappings[a.key] || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const applyPreset = (preset: 'SimpleWorship' | 'ProPresenter') => {
    if (preset === 'SimpleWorship') {
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
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { 
      detail: `Switched to ${preset === 'ProPresenter' ? 'ProPresenter Style' : 'SimpleWorship Classic'} key profile!` 
    }));
  };

  const handleTestKeyChipClick = (keyName: string, synthEvent: Partial<KeyboardEvent>) => {
    setPressedKey(keyName);
    const evaluated = evaluateKeyAction(keyName, synthEvent);
    setTesterResult(evaluated);
    setLastExecutedMessage(null);
  };

  const handleExecuteTestAction = () => {
    if (testerResult?.execute) {
      testerResult.execute();
      setLastExecutedMessage(`Successfully executed live action: ${testerResult.actionName}`);
      window.dispatchEvent(new CustomEvent('simpleworship:notify', {
        detail: `Executed: ${testerResult.actionName}`
      }));
    }
  };

  const handleResetSingleKey = (key: keyof CustomKeyMappings, defaultKey: string) => {
    const updatedMappings: CustomKeyMappings = {
      ...mappings,
      [key]: defaultKey
    };
    updateShortcutSettings({
      keyMappings: updatedMappings
    });
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { 
      detail: `Reset ${key} to default [${defaultKey}]` 
    }));
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 select-none animate-in fade-in duration-150">
      <div className="bg-[#1a1c24] border border-[#323646] rounded-xl shadow-2xl w-[94vw] max-w-4xl h-[86vh] max-h-[740px] flex flex-col overflow-hidden text-gray-200">
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
              className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${
                shortcutSettings.presetName === 'SimpleWorship'
                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm'
                  : 'bg-[#262a37] border-[#373c4d] text-gray-300 hover:text-white'
              }`}
            >
              SimpleWorship Classic
            </button>
            <button
              onClick={() => applyPreset('ProPresenter')}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-all ${
                shortcutSettings.presetName === 'ProPresenter'
                  ? 'bg-indigo-600 border-indigo-400 text-white shadow-sm'
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
                className="w-full bg-[#141519] border border-[#343948] focus:border-cyan-500 rounded-lg pl-9 pr-8 py-1.5 text-xs text-gray-100 placeholder-gray-500 focus:outline-none transition-colors"
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
              <div className="bg-[#1b1e28] px-3 py-1.5 text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex justify-between items-center sticky top-0 z-10 border-b border-[#2b3040]">
                <span>Customizable Live Hotkeys</span>
                <span className="text-[10px] text-gray-400 font-normal">Click any key badge to rebind; press Backspace to unassign</span>
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
                        title="Click to rebind this key. Press Backspace to clear, or Esc to cancel."
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
                      <button
                        onClick={() => handleResetSingleKey(item.key, item.defaultKey)}
                        className="p-1 hover:bg-[#2d3244] text-gray-400 hover:text-cyan-300 rounded transition-colors"
                        title={`Reset to default [${item.defaultKey}]`}
                      >
                        <RotateCcw size={12} />
                      </button>
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
              <div className="bg-[#1b1e28] px-3 py-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider sticky top-0 z-10 border-b border-[#2b3040]">
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
            <div className="bg-[#14161c] border border-[#2b3040] rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2 pb-1 border-b border-[#242938]">
                <Play size={13} />
                <span>Live Panel Navigation & Direct Action Rules</span>
              </h3>

              {/* Setting 1: Arrow Down & Up */}
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
                    <span className="text-[10px] bg-emerald-600/30 text-emerald-300 px-1.5 py-0.2 rounded font-medium">Active & Functional</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    When active, pressing the Down (↓) or Up (↑) arrow key immediately steps through the lyrics or scripture slides on the active projector screen without needing to click with the mouse.
                  </p>
                </div>
              </label>

              {/* Setting 2: Spacebar */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#1e2230] cursor-pointer transition-colors border border-transparent hover:border-[#343a4e]">
                <input
                  type="checkbox"
                  checked={shortcutSettings.spacebarAdvancesLive}
                  onChange={(e) => updateShortcutSettings({ spacebarAdvancesLive: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-cyan-600 bg-[#252a3a] border-gray-600 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-bold text-xs text-gray-100 flex items-center gap-1.5">
                    <span>Spacebar advances to the Next Live Slide</span>
                    <span className="text-[10px] bg-emerald-600/30 text-emerald-300 px-1.5 py-0.2 rounded font-medium">Standard</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Allows operators to comfortably keep their thumb on the spacebar to flow through verses in worship services seamlessly.
                  </p>
                </div>
              </label>

              {/* Setting 3: Enter & F5 Go Live */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#1e2230] cursor-pointer transition-colors border border-transparent hover:border-[#343a4e]">
                <input
                  type="checkbox"
                  checked={shortcutSettings.enterGoesLive}
                  onChange={(e) => updateShortcutSettings({ enterGoesLive: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-cyan-600 bg-[#252a3a] border-gray-600 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-bold text-xs text-gray-100 flex items-center gap-1.5">
                    <span>Enter Key & F5 instantly Go Live</span>
                    <span className="text-[10px] bg-emerald-600/30 text-emerald-300 px-1.5 py-0.2 rounded font-medium">Direct Push</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Instantly commits whichever song or item is staged or previewed straight to the live projector screen, bypassing intermediate confirmation prompts.
                  </p>
                </div>
              </label>

              {/* Setting 4: Numeric Direct Verse Jump */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#1e2230] cursor-pointer transition-colors border border-transparent hover:border-[#343a4e]">
                <input
                  type="checkbox"
                  checked={shortcutSettings.numericQuickJump}
                  onChange={(e) => updateShortcutSettings({ numericQuickJump: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-cyan-600 bg-[#252a3a] border-gray-600 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-bold text-xs text-gray-100 flex items-center gap-1.5">
                    <span>Number Keys (1-9) Direct Verse Jump</span>
                    <span className="text-[10px] bg-indigo-600/30 text-indigo-300 px-1.5 py-0.2 rounded font-medium">Quick Jump</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Pressing 1 jumps directly to Verse 1, 2 jumps to Verse 2, etc., allowing quick improvisation when the worship leader repeats or skips a section.
                  </p>
                </div>
              </label>

              {/* Setting 5: B, C, L Quick Keys */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#1e2230] cursor-pointer transition-colors border border-transparent hover:border-[#343a4e]">
                <input
                  type="checkbox"
                  checked={shortcutSettings.quickKeysBcl}
                  onChange={(e) => updateShortcutSettings({ quickKeysBcl: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-cyan-600 bg-[#252a3a] border-gray-600 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-bold text-xs text-gray-100 flex items-center gap-1.5">
                    <span>B, C, L Quick Keys for Blackout, Clear Text, and Logo</span>
                    <span className="text-[10px] bg-amber-600/30 text-amber-300 px-1.5 py-0.2 rounded font-medium">Mute FX</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Single keystroke shortcuts to black out the display (B), clear lyric words while keeping background motion (C), or display the church logo (L).
                  </p>
                </div>
              </label>

              {/* Setting 6: Wrap Around Slides */}
              <label className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#1e2230] cursor-pointer transition-colors border border-transparent hover:border-[#343a4e]">
                <input
                  type="checkbox"
                  checked={shortcutSettings.wrapAroundSlides}
                  onChange={(e) => updateShortcutSettings({ wrapAroundSlides: e.target.checked })}
                  className="mt-0.5 w-4 h-4 rounded text-cyan-600 bg-[#252a3a] border-gray-600 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-bold text-xs text-gray-100 flex items-center gap-1.5">
                    <span>Loop / Wrap Around at End of Song</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Advancing on the last verse loops back to the first verse smoothly rather than stopping at the final slide.
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Tab 3: Interactive Live Key Tester */}
        {activeTab === 'tester' && (
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-4 overflow-y-auto custom-scrollbar">
            <div className="max-w-md space-y-1.5">
              <h3 className="text-base font-bold text-gray-100 flex items-center justify-center gap-2">
                <Zap size={18} className="text-cyan-400" />
                <span>Interactive Live Key Tester</span>
              </h3>
              <p className="text-xs text-gray-400">
                Press any key on your keyboard or click the interactive hotkey chips below to confirm SimpleWorship detects it and see its exact live action.
              </p>
            </div>

            {/* Visual Feedback Display */}
            <div className="w-full max-w-md bg-[#12141a] border-2 border-cyan-500/40 rounded-2xl flex flex-col items-center justify-center p-5 shadow-2xl relative overflow-hidden">
              <div className="absolute top-2 right-3 flex items-center gap-1.5">
                {testerResult?.isFunctional ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/40">
                    <ShieldCheck size={11} />
                    <span>Active & Functional</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-gray-800/60 px-2 py-0.5 rounded-full border border-gray-600/40">
                    <span>Unassigned</span>
                  </span>
                )}
              </div>

              {pressedKey ? (
                <>
                  <div className="my-1">
                    <span className="font-mono text-3xl font-extrabold text-cyan-300 bg-[#202534] px-5 py-2 rounded-xl border border-cyan-500/60 shadow-lg tracking-wider">
                      {pressedKey}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1">
                    <div className="text-sm font-extrabold text-emerald-300 flex items-center justify-center gap-1.5">
                      <Check size={14} />
                      <span>{testerResult?.actionName || 'Key Detected'}</span>
                    </div>
                    <div className="text-[11px] text-gray-400 max-w-xs">
                      {testerResult?.ruleExplanation}
                    </div>
                  </div>

                  {testerResult?.isFunctional && testerResult.execute && (
                    <button
                      onClick={handleExecuteTestAction}
                      className="mt-4 flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-md active:scale-95"
                    >
                      <Play size={12} />
                      <span>Execute Action Live on Screen</span>
                    </button>
                  )}

                  {lastExecutedMessage && (
                    <div className="mt-2 text-[11px] text-cyan-300 font-semibold bg-cyan-950/70 border border-cyan-500/30 px-3 py-1 rounded-md animate-in fade-in duration-100">
                      ✓ {lastExecutedMessage}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-gray-500 text-xs flex flex-col items-center gap-2 py-4">
                  <Keyboard size={32} className="text-gray-600 animate-pulse" />
                  <span>Press any key on your keyboard now...</span>
                </div>
              )}
            </div>

            {/* Clickable Quick Test Chips */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-gray-400">Click to test live hotkey reaction:</div>
              <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-lg">
                <button 
                  onClick={() => handleTestKeyChipClick('Space', { key: ' ' })} 
                  className="px-2.5 py-1 bg-[#232734] hover:bg-[#2c3244] border border-[#3c4256] hover:border-cyan-400 rounded text-cyan-300 font-mono text-[11px] font-bold transition-all"
                >
                  Space (Next)
                </button>
                <button 
                  onClick={() => handleTestKeyChipClick('ArrowDown', { key: 'ArrowDown' })} 
                  className="px-2.5 py-1 bg-[#232734] hover:bg-[#2c3244] border border-[#3c4256] hover:border-cyan-400 rounded text-cyan-300 font-mono text-[11px] font-bold transition-all"
                >
                  ↓ Down (Next)
                </button>
                <button 
                  onClick={() => handleTestKeyChipClick('ArrowUp', { key: 'ArrowUp' })} 
                  className="px-2.5 py-1 bg-[#232734] hover:bg-[#2c3244] border border-[#3c4256] hover:border-cyan-400 rounded text-cyan-300 font-mono text-[11px] font-bold transition-all"
                >
                  ↑ Up (Prev)
                </button>
                <button 
                  onClick={() => handleTestKeyChipClick('F5', { key: 'F5' })} 
                  className="px-2.5 py-1 bg-[#232734] hover:bg-[#2c3244] border border-[#3c4256] hover:border-cyan-400 rounded text-cyan-300 font-mono text-[11px] font-bold transition-all"
                >
                  F5 (Go Live)
                </button>
                <button 
                  onClick={() => handleTestKeyChipClick('Enter', { key: 'Enter' })} 
                  className="px-2.5 py-1 bg-[#232734] hover:bg-[#2c3244] border border-[#3c4256] hover:border-cyan-400 rounded text-cyan-300 font-mono text-[11px] font-bold transition-all"
                >
                  Enter (Go Live)
                </button>
                <button 
                  onClick={() => handleTestKeyChipClick('B', { key: 'b' })} 
                  className="px-2.5 py-1 bg-[#232734] hover:bg-[#2c3244] border border-[#3c4256] hover:border-cyan-400 rounded text-cyan-300 font-mono text-[11px] font-bold transition-all"
                >
                  B (Blackout)
                </button>
                <button 
                  onClick={() => handleTestKeyChipClick('C', { key: 'c' })} 
                  className="px-2.5 py-1 bg-[#232734] hover:bg-[#2c3244] border border-[#3c4256] hover:border-cyan-400 rounded text-cyan-300 font-mono text-[11px] font-bold transition-all"
                >
                  C (Clear)
                </button>
                <button 
                  onClick={() => handleTestKeyChipClick('L', { key: 'l' })} 
                  className="px-2.5 py-1 bg-[#232734] hover:bg-[#2c3244] border border-[#3c4256] hover:border-cyan-400 rounded text-cyan-300 font-mono text-[11px] font-bold transition-all"
                >
                  L (Logo)
                </button>
                <button 
                  onClick={() => handleTestKeyChipClick('1', { key: '1' })} 
                  className="px-2.5 py-1 bg-[#232734] hover:bg-[#2c3244] border border-[#3c4256] hover:border-cyan-400 rounded text-cyan-300 font-mono text-[11px] font-bold transition-all"
                >
                  1 (Verse 1)
                </button>
                <button 
                  onClick={() => handleTestKeyChipClick('Escape', { key: 'Escape' })} 
                  className="px-2.5 py-1 bg-[#232734] hover:bg-[#2c3244] border border-[#3c4256] hover:border-cyan-400 rounded text-cyan-300 font-mono text-[11px] font-bold transition-all"
                >
                  Esc (Restore)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="h-12 bg-[#1f222d] border-t border-[#2a2f3e] flex items-center justify-between px-4 shrink-0">
          <button
            onClick={() => {
              if (confirm('Reset all shortcuts and live navigation behavior to factory defaults?')) {
                resetShortcutSettings();
                window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Shortcuts reset to factory defaults' }));
              }
            }}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-rose-400 px-3 py-1.5 rounded hover:bg-[#292e3f] transition-colors"
          >
            <RotateCcw size={12} />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Revert any changes made during this dialog session
                updateShortcutSettings(initialSettings);
                onClose();
              }}
              className="px-4 py-1.5 bg-[#2a2f3f] hover:bg-[#353b4f] text-gray-200 rounded-lg text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Shortcut settings applied and active!' }));
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
