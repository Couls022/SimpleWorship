import React, { useState } from 'react';
import { 
  Plus, 
  Palette, 
  Check, 
  Type, 
  Image as ImageIcon, 
  Sparkles, 
  Copy, 
  Trash2, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify,
  ArrowUp,
  ArrowDown,
  Maximize2,
  Video,
  Layers,
  Sun,
  GripVertical,
  Sliders,
  Send,
  Eye,
  Tv,
  Film,
  RotateCcw
} from 'lucide-react';
import { Panel, PanelGroup } from 'react-resizable-panels';
import ResizeHandle from '../ResizeHandle';
import { useStore } from '../../store/useStore';
import { Theme, ThemeStyles } from '../../types';
import { ThemeEngine } from '../../core/ThemeEngine';

const PRESET_GRADIENTS = [
  { name: 'Midnight Galaxy', value: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #020617 100%)' },
  { name: 'Celestial Twilight', value: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #0f172a 100%)' },
  { name: 'Warm Liturgical Ember', value: 'linear-gradient(135deg, #451a03 0%, #78350f 50%, #1c1917 100%)' },
  { name: 'Emerald Sanctuary', value: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #022c22 100%)' },
  { name: 'Deep Royal Purple', value: 'linear-gradient(135deg, #3b0764 0%, #581c87 50%, #1e1b4b 100%)' },
  { name: 'Charcoal Minimal', value: 'linear-gradient(135deg, #18181b 0%, #27272a 50%, #09090b 100%)' },
  { name: 'Radiant Sunrise', value: 'linear-gradient(135deg, #7c2d12 0%, #c2410c 50%, #431407 100%)' },
  { name: 'Ocean Depth', value: 'linear-gradient(135deg, #082f49 0%, #0369a1 50%, #0c4a6e 100%)' },
];

const PRESET_BACKGROUND_IMAGES = [
  { name: 'Cosmic Nebula (Motion)', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1920&q=80', isVideo: false },
  { name: 'Majestic Mountain Dawn', url: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&q=80', isVideo: false },
  { name: 'Cross Silhouette Sunset', url: 'https://images.unsplash.com/photo-1507692049790-de58290a4334?auto=format&fit=crop&w=1920&q=80', isVideo: false },
  { name: 'Teal Worship Light Flare', url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&q=80', isVideo: false },
  { name: 'Golden Light Rays', url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1920&q=80', isVideo: false },
  { name: 'Cathedral Stained Glass', url: 'https://images.unsplash.com/photo-1548625361-195feee15f33?auto=format&fit=crop&w=1920&q=80', isVideo: false },
  { name: 'Atmospheric Fog & Haze', url: 'https://images.unsplash.com/photo-1517816743773-6e0fd518b4a6?auto=format&fit=crop&w=1920&q=80', isVideo: false },
];

const PRESET_MOTION_VIDEOS = [
  { name: 'Cosmic Nebula Space Loop', url: 'https://assets.mixkit.co/videos/preview/mixkit-nebula-clouds-and-bright-stars-in-space-41979-large.mp4' },
  { name: 'Golden Light Particles Loop', url: 'https://assets.mixkit.co/videos/preview/mixkit-light-particles-in-motion-41870-large.mp4' },
];

const SAMPLE_TEXTS = {
  verse: {
    title: 'Amazing Grace - Verse 1',
    text: 'Amazing grace! How sweet the sound\nThat saved a wretch like me!\nI once was lost, but now am found;\nWas blind, but now I see.'
  },
  chorus: {
    title: 'Jesus Paid It All - Chorus',
    text: 'Jesus paid it all,\nAll to Him I owe;\nSin had left a crimson stain,\nHe washed it white as snow.'
  },
  bible: {
    title: 'John 3:16 (KJV)',
    text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'
  },
  announcement: {
    title: 'Sunday Worship Service',
    text: 'Welcome to SimpleWorship!\nJoin us for Fellowship Dinner & Prayer\nThis Sunday Evening at 6:00 PM'
  }
};

export default function ThemesTab() {
  const store = useStore();
  const { 
    themesList, 
    saveTheme, 
    assetsList, 
    activeSchedule, 
    updateScheduleItem, 
    setPreviewItem, 
    goLiveItem, 
    previewItemId,
    outputGroups,
    songsList,
    deleteTheme 
  } = store;

  const [selectedThemeId, setSelectedThemeId] = useState<string>(themesList[0]?.id || 'theme-global');
  const selectedTheme = themesList.find(t => t.id === selectedThemeId) || themesList[0] || {
    id: 'theme-default',
    name: 'Custom Theme',
    type: 'global',
    styles: ThemeEngine.getDefaultGlobalTheme()
  };

  const [activeEditorTab, setActiveEditorTab] = useState<'background' | 'typography' | 'alignment' | 'effects' | 'emblem'>('background');
  const [filterType, setFilterType] = useState<string>('all');
  const [sampleMode, setSampleMode] = useState<'verse' | 'chorus' | 'bible' | 'announcement' | 'custom'>('verse');
  const [customSampleText, setCustomSampleText] = useState<string>('Sing like never before, O my soul,\nI\'ll worship Your holy name.');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '4:3' | '21:9'>('16:9');

  const handleUpdateStyle = (key: keyof ThemeStyles, value: any) => {
    const updatedStyles: ThemeStyles = { ...selectedTheme.styles };
    
    if (value === undefined) {
      delete updatedStyles[key];
    } else {
      (updatedStyles as any)[key] = value;
    }

    saveTheme({
      ...selectedTheme,
      styles: updatedStyles
    });
  };

  const ResetButton = ({ field, label }: { field: keyof ThemeStyles, label?: string }) => {
    if (selectedTheme.type === 'global') return null;
    const isCustomized = selectedTheme.styles[field] !== undefined;
    if (!isCustomized) return null;
    return (
      <button 
        onClick={() => handleUpdateStyle(field, undefined)}
        className="ml-2 px-1.5 py-0.5 text-[9px] bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded border border-rose-500/20"
        title={`Reset ${label || field} to inherited value`}
      >
        Clear
      </button>
    );
  };

  const handleCreateNewTheme = () => {
    const name = prompt('Enter new theme name:', 'New Worship Theme');
    if (!name) return;

    const newTheme: Theme = {
      id: `theme-${Date.now()}`,
      name,
      type: 'custom',
      styles: {
        ...selectedTheme.styles,
        fontSize: 90,
        fontFamily: 'Montserrat, sans-serif'
      }
    };
    saveTheme(newTheme);
    setSelectedThemeId(newTheme.id);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Created new theme "${name}"!` 
      })
    );
  };

  const handleDuplicateTheme = (theme: Theme) => {
    const duplicate: Theme = {
      id: `theme-${Date.now()}`,
      name: `${theme.name} (Copy)`,
      type: 'custom',
      styles: { ...theme.styles }
    };
    saveTheme(duplicate);
    setSelectedThemeId(duplicate.id);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Duplicated theme "${duplicate.name}"!` 
      })
    );
  };

  const handleDeleteTheme = (id: string, name: string) => {
    if (themesList.length <= 1) {
      window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Cannot delete the last remaining theme.' }));
      return;
    }

    if (id.startsWith('theme-')) {
      window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'Cannot delete core system themes.' }));
      return;
    }

    // Check dependencies
    const usedByGroups = outputGroups.filter(g => g.themeId === id).map(g => `Output Route: ${g.name}`);
    const usedBySongs = songsList.filter(s => s.themeId === id).map(s => `Song: ${s.title}`);
    const usedBySchedule = activeSchedule?.items.filter(i => i.themeId === id).map(i => `Schedule Item: ${i.name}`) || [];
    
    const dependencies = [...usedByGroups, ...usedBySongs, ...usedBySchedule];
    
    if (dependencies.length > 0) {
      window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: `Cannot delete "${name}" because it is currently in use.` }));
      return;
    }

    // Find another theme to switch to
    const remaining = themesList.filter(t => t.id !== id);
    if (remaining.length > 0) {
      setSelectedThemeId(remaining[0].id);
    }
    
    deleteTheme(id);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Deleted theme "${name}"` 
      })
    );
  };

  // Drag-and-drop start handler
  const handleDragStart = (e: React.DragEvent, theme: Theme) => {
    const payload = {
      type: 'theme',
      theme: {
        id: theme.id,
        name: theme.name,
        type: theme.type,
        styles: theme.styles
      },
      item: {
        id: `theme-slide-${Date.now()}`,
        type: 'presentation',
        name: `${theme.name} Slide`,
        notes: `Styled with ${theme.name}`,
        themeId: theme.id,
        data: {
          slides: [
            {
              title: theme.name,
              text: 'Sing to the Lord a new song;\nSing to the Lord, all the earth.'
            }
          ]
        }
      }
    };
    const jsonStr = JSON.stringify(payload);
    e.dataTransfer.setData('application/json', jsonStr);
    e.dataTransfer.setData('application/x-simpleworship-theme', jsonStr);
    e.dataTransfer.setData('application/x-simpleworship-item', jsonStr);
    e.dataTransfer.setData('text/plain', theme.name);
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  // Apply theme to currently selected schedule item
  const handleApplyToSelectedScheduleItem = () => {
    if (!activeSchedule || !activeSchedule.items || activeSchedule.items.length === 0) {
      window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'No schedule items available.' }));
      return;
    }
    const targetItem = activeSchedule.items.find(i => i.id === previewItemId) || activeSchedule.items[0];
    if (targetItem) {
      updateScheduleItem(targetItem.id, {
        themeId: selectedTheme.id,
        themeOverride: undefined,
        customBackgroundUrl: undefined
      });
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { 
          detail: `Applied "${selectedTheme.name}" to "${targetItem.name}"!` 
        })
      );
    }
  };

  // Apply theme to ALL schedule items
  const handleApplyToAllScheduleItems = () => {
    if (!activeSchedule || !activeSchedule.items || activeSchedule.items.length === 0) {
      window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: 'No schedule items available.' }));
      return;
    }
    activeSchedule.items.forEach(item => {
      updateScheduleItem(item.id, {
        themeId: selectedTheme.id,
        themeOverride: undefined,
        customBackgroundUrl: undefined
      });
    });
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', { 
        detail: `Applied "${selectedTheme.name}" to ALL schedule items!` 
      })
    );
  };

  const filteredThemes = themesList.filter(t => {
    if (filterType === 'all') return true;
    if (filterType === 'global') return t.type === 'global';
    if (filterType === 'songs') return t.type === 'song' || t.type === 'global';
    if (filterType === 'bible') return t.type === 'bible';
    if (filterType === 'stage') return t.type === 'stage';
    if (filterType === 'logo') return t.type === 'logo' || t.id === 'theme-logo';
    if (filterType === 'custom') return t.type === 'custom';
    return true;
  });

  const styles = selectedTheme.styles || ThemeEngine.getDefaultGlobalTheme();

  // Compute resolved styles for accurate live preview of inherited values
  let resolvedStyles = ThemeEngine.getDefaultGlobalTheme();
  const globalThemeStyles = themesList.find(t => t.type === 'global')?.styles || {};
  
  if (selectedTheme.type === 'global') {
    resolvedStyles = ThemeEngine.resolveStyles(resolvedStyles, selectedTheme.styles);
  } else if (['song', 'bible', 'presentation', 'announcement', 'stage', 'logo'].includes(selectedTheme.type)) {
    resolvedStyles = ThemeEngine.resolveStyles(resolvedStyles, globalThemeStyles, selectedTheme.styles);
  } else {
    // Custom item themes
    let typeTheme = {};
    if (sampleMode === 'verse' || sampleMode === 'chorus') typeTheme = themesList.find(t => t.type === 'song')?.styles || {};
    else if (sampleMode === 'bible') typeTheme = themesList.find(t => t.type === 'bible')?.styles || {};
    else if (sampleMode === 'announcement') typeTheme = themesList.find(t => t.type === 'announcement')?.styles || {};
    resolvedStyles = ThemeEngine.resolveStyles(resolvedStyles, globalThemeStyles, typeTheme, selectedTheme.styles);
  }

  const isVideo = resolvedStyles.backgroundType === 'video' && resolvedStyles.backgroundVideoUrl;
  const isGradient = resolvedStyles.backgroundType === 'gradient' && resolvedStyles.backgroundGradient;
  const isImage = (resolvedStyles.backgroundType === 'image' || !resolvedStyles.backgroundType) && resolvedStyles.backgroundImageUrl;

  const currentSample = sampleMode === 'custom'
    ? { title: 'Custom Preview Text', text: customSampleText }
    : SAMPLE_TEXTS[sampleMode];

  return (
    <div className="h-full w-full bg-[#181a1f] text-gray-200 select-none text-xs overflow-hidden">
      <PanelGroup direction="horizontal" autoSaveId="simpleworship-theme-editor-panels-v1" className="h-full w-full">
        {/* LEFT PANEL: Themes List & Management */}
        <Panel defaultSize={24} minSize={16} maxSize={38} collapsible>
          <div className="h-full bg-[#1b1c22] border-r border-[#15161a] p-2.5 flex flex-col justify-between overflow-hidden">
            <div className="flex flex-col h-full overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Palette size={14} className="text-indigo-400" />
                  <span className="font-bold text-xs uppercase tracking-wider text-gray-200">Theme Library</span>
                </div>
                <button
                  onClick={handleCreateNewTheme}
                  className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[11px] font-semibold transition-colors shadow-xs"
                  title="Create New Slide Theme"
                >
                  <Plus size={13} />
                  <span>New Theme</span>
                </button>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 mb-2.5 overflow-x-auto pb-1 shrink-0 custom-scrollbar">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'global', label: 'Global' },
                  { id: 'songs', label: 'Songs' },
                  { id: 'bible', label: 'Bible' },
                  { id: 'logo', label: 'Logo' },
                  { id: 'stage', label: 'Stage' },
                  { id: 'custom', label: 'Custom' },
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilterType(f.id)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors whitespace-nowrap ${
                      filterType === f.id
                        ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-500/50'
                        : 'bg-[#22252e] text-gray-400 hover:text-gray-200 hover:bg-[#2a2e3a] border border-transparent'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Theme Cards List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-0.5">
                {filteredThemes.map((theme) => {
                  const isSelected = selectedTheme.id === theme.id;
                  const isCoreProtected = theme.id === 'theme-global';
                  const thStyles = theme.styles || {};
                  const bgImage = thStyles.backgroundImageUrl;
                  const bgGrad = thStyles.backgroundGradient;
                  const bgColor = thStyles.backgroundColor || '#111216';

                  return (
                    <div
                      key={theme.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, theme)}
                      onClick={() => setSelectedThemeId(theme.id)}
                      className={`group p-2 rounded-md border cursor-grab active:cursor-grabbing transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-[#252b38] border-indigo-400 text-white shadow-md ring-1 ring-indigo-400/40'
                          : 'bg-[#202229] border-[#2c303a] hover:border-[#404656] text-gray-300'
                      }`}
                      title="Click to edit, or Drag directly into Schedule!"
                    >
                      {/* Left: Drag grip & Thumbnail */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="text-gray-500 group-hover:text-gray-300">
                          <GripVertical size={13} />
                        </div>

                        {/* Thumbnail */}
                        <div 
                          className="w-10 h-7 rounded-xs bg-black border border-white/20 relative overflow-hidden flex items-center justify-center shrink-0 shadow-inner"
                          style={{
                            background: bgGrad ? bgGrad : bgColor,
                            backgroundImage: bgImage ? `url(${bgImage})` : undefined,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        >
                          <span 
                            className="text-[8px] font-bold text-white drop-shadow-md truncate max-w-[90%]"
                            style={{ fontFamily: thStyles.fontFamily }}
                          >
                            Aa
                          </span>
                        </div>

                        {/* Info */}
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs truncate text-gray-100">{theme.name}</div>
                          <div className="text-[10px] text-gray-400 flex items-center gap-1.5">
                            <span className="capitalize font-medium">{theme.type}</span>
                            <span>•</span>
                            <span className="truncate">{thStyles.fontFamily?.split(',')[0] || 'Modern'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Actions */}
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateTheme(theme);
                          }}
                          className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#343846] opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Duplicate Theme"
                        >
                          <Copy size={12} />
                        </button>
                        {!isCoreProtected && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTheme(theme.id, theme.name);
                            }}
                            className="p-1 text-gray-400 hover:text-rose-400 rounded hover:bg-[#343846] opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete Theme"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                        {isSelected && <Check size={14} className="text-indigo-400 ml-0.5" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Tip Footer */}
              <div className="pt-2 border-t border-[#232630] mt-2 text-[10px] text-gray-400 flex items-center gap-1.5 shrink-0">
                <GripVertical size={12} className="text-indigo-400" />
                <span>Tip: Drag any theme card directly onto a schedule item to style it!</span>
              </div>
            </div>
          </div>
        </Panel>

        <ResizeHandle direction="horizontal" />

        {/* CENTER PANEL: Style Inspector Tabs */}
        <Panel defaultSize={42} minSize={28}>
          <div className="h-full flex flex-col bg-[#1a1c22] overflow-hidden">
            {/* Top Toolbar for Editor */}
            <div className="h-9 bg-[#22242c] border-b border-[#2d303a] px-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold text-xs text-indigo-300 truncate">
                  Editing: {selectedTheme.name}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2c303c] text-gray-300 capitalize font-mono">
                  {selectedTheme.type}
                </span>
              </div>

              {/* Sub-tab Switcher */}
              <div className="flex items-center gap-1 bg-[#16171c] p-0.5 rounded border border-[#2d303a]">
                {[
                  { id: 'background', label: 'Background', icon: ImageIcon },
                  { id: 'typography', label: 'Typography', icon: Type },
                  { id: 'alignment', label: 'Layout', icon: AlignCenter },
                  { id: 'effects', label: 'Shadow/Stroke', icon: Sparkles },
                  { id: 'emblem', label: 'Scope & Logo', icon: Layers },
                ].map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeEditorTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveEditorTab(tab.id as any)}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-[#252834]'
                      }`}
                    >
                      <Icon size={12} />
                      <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Scrollable Form Body */}
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar space-y-4">
              {/* TAB 1: BACKGROUND & MEDIA */}
              {activeEditorTab === 'background' && (
                <div className="space-y-4">
                  {/* Background Type Mode */}
                  <div className="bg-[#20222a] border border-[#2d313d] p-3 rounded-lg space-y-3">
                    <label className="text-xs font-bold text-gray-200 flex justify-between items-center">Background Type <ResetButton field="backgroundType" /></label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: 'color', label: 'Solid Color', icon: Palette },
                        { id: 'gradient', label: 'Gradient', icon: Sliders },
                        { id: 'image', label: 'Image Wallpaper', icon: ImageIcon },
                        { id: 'video', label: 'Motion Loop', icon: Film },
                      ].map(mode => {
                        const Icon = mode.icon;
                        const isCurrent = (styles.backgroundType || 'image') === mode.id;
                        return (
                          <button
                            key={mode.id}
                            onClick={() => handleUpdateStyle('backgroundType', mode.id)}
                            className={`flex flex-col items-center justify-center p-2.5 rounded border text-center transition-all ${
                              isCurrent
                                ? 'bg-indigo-600/30 border-indigo-400 text-white shadow-xs'
                                : 'bg-[#181920] border-[#2c2f3a] text-gray-400 hover:text-gray-200 hover:bg-[#232630]'
                            }`}
                          >
                            <Icon size={16} className="mb-1 text-indigo-300" />
                            <span className="text-[11px] font-medium">{mode.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mode Specific Controls */}
                  {styles.backgroundType === 'color' && (
                    <div className="bg-[#20222a] border border-[#2d313d] p-3 rounded-lg space-y-3">
                      <label className="text-xs font-bold text-gray-200 flex justify-between items-center">Solid Background Color <ResetButton field="backgroundColor" /></label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={styles.backgroundColor || '#000000'}
                          onChange={(e) => handleUpdateStyle('backgroundColor', e.target.value)}
                          className="w-12 h-10 bg-transparent cursor-pointer rounded border border-[#373c4d]"
                        />
                        <input
                          type="text"
                          value={styles.backgroundColor || '#000000'}
                          onChange={(e) => handleUpdateStyle('backgroundColor', e.target.value)}
                          className="flex-1 bg-[#141519] border border-[#323642] rounded px-3 py-1.5 text-xs text-gray-200 font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {styles.backgroundType === 'gradient' && (
                    <div className="bg-[#20222a] border border-[#2d313d] p-3 rounded-lg space-y-3">
                      <label className="text-xs font-bold text-gray-200 block">Preset Worship Gradients </label>
                      <div className="grid grid-cols-2 gap-2">
                        {PRESET_GRADIENTS.map((g) => (
                          <button
                            key={g.name}
                            onClick={() => handleUpdateStyle('backgroundGradient', g.value)}
                            className={`p-2 rounded border text-left flex items-center gap-2 transition-all ${
                              styles.backgroundGradient === g.value
                                ? 'border-indigo-400 ring-1 ring-indigo-400 bg-[#252a38]'
                                : 'border-[#2d313d] hover:border-gray-500 bg-[#17181f]'
                            }`}
                          >
                            <div 
                              className="w-8 h-8 rounded-xs shrink-0 border border-white/20"
                              style={{ background: g.value }}
                            />
                            <span className="text-[11px] font-medium text-gray-200 truncate">{g.name}</span>
                          </button>
                        ))}
                      </div>

                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">Custom CSS Gradient</label>
                        <input
                          type="text"
                          value={styles.backgroundGradient || ''}
                          onChange={(e) => handleUpdateStyle('backgroundGradient', e.target.value)}
                          placeholder="linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)"
                          className="w-full bg-[#141519] border border-[#323642] rounded px-3 py-1.5 text-xs text-gray-200 font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {(styles.backgroundType === 'image' || !styles.backgroundType) && (
                    <div className="bg-[#20222a] border border-[#2d313d] p-3 rounded-lg space-y-3">
                      <label className="text-xs font-bold text-gray-200 flex justify-between items-center">Preset Wallpaper Backgrounds <ResetButton field="backgroundImageUrl" /></label>
                      <div className="grid grid-cols-3 gap-2">
                        {PRESET_BACKGROUND_IMAGES.map((img) => (
                          <button
                            key={img.name}
                            onClick={() => handleUpdateStyle('backgroundImageUrl', img.url)}
                            className={`p-1.5 rounded border text-left flex flex-col gap-1 transition-all ${
                              styles.backgroundImageUrl === img.url
                                ? 'border-indigo-400 ring-1 ring-indigo-400 bg-[#252a38]'
                                : 'border-[#2d313d] hover:border-gray-500 bg-[#17181f]'
                            }`}
                          >
                            <img
                              src={img.url}
                              alt={img.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-12 object-cover rounded-xs"
                            />
                            <span className="text-[10px] text-gray-300 truncate">{img.name}</span>
                          </button>
                        ))}
                      </div>

                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">Custom Image URL</label>
                        <input
                          type="text"
                          value={styles.backgroundImageUrl || ''}
                          onChange={(e) => handleUpdateStyle('backgroundImageUrl', e.target.value)}
                          placeholder="https://images.unsplash.com/..."
                          className="w-full bg-[#141519] border border-[#323642] rounded px-3 py-1.5 text-xs text-gray-200"
                        />
                      </div>
                    </div>
                  )}

                  {styles.backgroundType === 'video' && (
                    <div className="bg-[#20222a] border border-[#2d313d] p-3 rounded-lg space-y-3">
                      <label className="text-xs font-bold text-gray-200 flex justify-between items-center">Preset Motion Background Loops <ResetButton field="backgroundVideoUrl" /></label>
                      <div className="grid grid-cols-2 gap-2">
                        {PRESET_MOTION_VIDEOS.map((vid) => (
                          <button
                            key={vid.name}
                            onClick={() => handleUpdateStyle('backgroundVideoUrl', vid.url)}
                            className={`p-2 rounded border text-left flex items-center gap-2 transition-all ${
                              styles.backgroundVideoUrl === vid.url
                                ? 'border-indigo-400 ring-1 ring-indigo-400 bg-[#252a38]'
                                : 'border-[#2d313d] hover:border-gray-500 bg-[#17181f]'
                            }`}
                          >
                            <Video size={16} className="text-indigo-400 shrink-0" />
                            <span className="text-[11px] font-medium text-gray-200 truncate">{vid.name}</span>
                          </button>
                        ))}
                      </div>

                      <div>
                        <label className="text-[11px] text-gray-400 block mb-1">Custom MP4 / WebM Motion Loop URL</label>
                        <input
                          type="text"
                          value={styles.backgroundVideoUrl || ''}
                          onChange={(e) => handleUpdateStyle('backgroundVideoUrl', e.target.value)}
                          placeholder="https://assets.mixkit.co/...mp4"
                          className="w-full bg-[#141519] border border-[#323642] rounded px-3 py-1.5 text-xs text-gray-200 font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* Dark Dimmer & Blur Overlay */}
                  <div className="bg-[#20222a] border border-[#2d313d] p-3 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-200">Dark Dimmer / Tint Overlay</label>
                      <span className="text-[11px] font-mono text-indigo-300">
                        {Math.round((styles.backgroundOverlayOpacity ?? 0.35) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={0.9}
                      step={0.05}
                      value={styles.backgroundOverlayOpacity ?? 0.35}
                      onChange={(e) => handleUpdateStyle('backgroundOverlayOpacity', parseFloat(e.target.value))}
                      className="w-full accent-indigo-500"
                    />

                    <div className="flex items-center justify-between pt-1">
                      <label className="text-xs font-bold text-gray-200">Background Blur</label>
                      <span className="text-[11px] font-mono text-indigo-300">
                        {styles.backgroundBlur ?? 0}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={16}
                      step={1}
                      value={styles.backgroundBlur ?? 0}
                      onChange={(e) => handleUpdateStyle('backgroundBlur', parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: TYPOGRAPHY & TEXT */}
              {activeEditorTab === 'typography' && (
                <div className="space-y-4">
                  {/* Font Family Selector */}
                  <div className="bg-[#20222a] border border-[#2d313d] p-3 rounded-lg space-y-3">
                    <label className="text-xs font-bold text-gray-200 flex justify-between items-center">Font Family <ResetButton field="fontFamily" /></label>
                    <select
                      value={styles.fontFamily || 'Montserrat, sans-serif'}
                      onChange={(e) => handleUpdateStyle('fontFamily', e.target.value)}
                      className="w-full bg-[#141519] border border-[#323642] rounded px-3 py-2 text-xs text-gray-100 font-medium"
                    >
                      <option value="Montserrat, sans-serif">Montserrat (Modern Clean Sans)</option>
                      <option value="Inter, sans-serif">Inter (Contemporary Crisp)</option>
                      <option value="'Playfair Display', serif">Playfair Display (Elegant Serif)</option>
                      <option value="'Cinzel', serif">Cinzel (Majestic Liturgical Roman)</option>
                      <option value="Georgia, serif">Georgia (Refined Traditional Serif)</option>
                      <option value="'Merriweather', serif">Merriweather (Warm Literary Serif)</option>
                      <option value="'Oswald', sans-serif">Oswald (Impact Condensed Bold)</option>
                      <option value="'Bebas Neue', sans-serif">Bebas Neue (Heavy Display)</option>
                      <option value="Roboto, sans-serif">Roboto (Neutral Tech Sans)</option>
                      <option value="'Caveat', cursive">Caveat (Acoustic Handwritten)</option>
                    </select>
                  </div>

                  {/* Font Weight & Size */}
                  <div className="bg-[#20222a] border border-[#2d313d] p-3 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-200 flex justify-between items-center">Base Font Size <ResetButton field="fontSize" /></label>
                      <span className="text-[11px] font-mono text-indigo-300">{styles.fontSize || 90} pt</span>
                    </div>
                    <input
                      type="range"
                      min={24}
                      max={160}
                      step={2}
                      value={styles.fontSize || 90}
                      onChange={(e) => handleUpdateStyle('fontSize', parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-500"
                    />

                    <div>
                      <label className="text-[11px] text-gray-400 block mb-1">Font Weight</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { val: '400', label: 'Regular' },
                          { val: '600', label: 'Semi-Bold' },
                          { val: '700', label: 'Bold' },
                          { val: '900', label: 'Black' },
                        ].map(w => (
                          <button
                            key={w.val}
                            onClick={() => handleUpdateStyle('fontWeight', w.val)}
                            className={`py-1 rounded text-center text-xs transition-all ${
                              (styles.fontWeight || '700') === w.val
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-[#181920] text-gray-400 hover:bg-[#282c38]'
                            }`}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Color & Transformations */}
                  <div className="bg-[#20222a] border border-[#2d313d] p-3 rounded-lg space-y-3">
                    <label className="text-xs font-bold text-gray-200 flex justify-between items-center">Text Color & Quick Palette <ResetButton field="fontColor" /></label>
                    <div className="flex items-center gap-3 mb-2">
                      <input
                        type="color"
                        value={styles.fontColor || '#FFFFFF'}
                        onChange={(e) => handleUpdateStyle('fontColor', e.target.value)}
                        className="w-10 h-8 bg-transparent cursor-pointer rounded border border-[#373c4d]"
                      />
                      <input
                        type="text"
                        value={styles.fontColor || '#FFFFFF'}
                        onChange={(e) => handleUpdateStyle('fontColor', e.target.value)}
                        className="flex-1 bg-[#141519] border border-[#323642] rounded px-3 py-1 text-xs text-gray-200 font-mono"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      {[
                        { color: '#FFFFFF', name: 'White' },
                        { color: '#FEF08A', name: 'Pale Gold' },
                        { color: '#FDE047', name: 'Warm Amber' },
                        { color: '#BAE6FD', name: 'Sky Glow' },
                        { color: '#FBCFE8', name: 'Rose Tint' },
                        { color: '#FACC15', name: 'Stage Yellow' },
                      ].map(c => (
                        <button
                          key={c.color}
                          onClick={() => handleUpdateStyle('fontColor', c.color)}
                          className="w-6 h-6 rounded-full border border-white/30 transition-transform hover:scale-110"
                          style={{ backgroundColor: c.color }}
                          title={c.name}
                        />
                      ))}
                    </div>

                    {/* Font Style & Decoration */}
                    <div className="pt-2 border-t border-[#2b2e3a]">
                      <label className="text-[11px] text-gray-400 block mb-1">Font Style & Decoration</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => handleUpdateStyle('fontStyle', (styles.fontStyle === 'italic' ? 'normal' : 'italic'))}
                          className={`py-1 rounded text-center text-xs transition-all ${
                            styles.fontStyle === 'italic'
                              ? 'bg-indigo-600 text-white font-bold italic'
                              : 'bg-[#181920] text-gray-400 hover:bg-[#282c38]'
                          }`}
                        >
                          Italic
                        </button>
                        <button
                          onClick={() => handleUpdateStyle('textDecoration', (styles.textDecoration === 'underline' ? 'none' : 'underline'))}
                          className={`py-1 rounded text-center text-xs transition-all ${
                            styles.textDecoration === 'underline'
                              ? 'bg-indigo-600 text-white font-bold underline'
                              : 'bg-[#181920] text-gray-400 hover:bg-[#282c38]'
                          }`}
                        >
                          Underline
                        </button>
                      </div>
                    </div>

                    {/* Text Transform */}
                    <div className="pt-2 border-t border-[#2b2e3a]">
                      <label className="text-[11px] text-gray-400 block mb-1">Text Casing / Transform</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { val: 'none', label: 'Normal' },
                          { val: 'uppercase', label: 'UPPER' },
                          { val: 'capitalize', label: 'Title Case' },
                          { val: 'lowercase', label: 'lower' },
                        ].map(c => (
                          <button
                            key={c.val}
                            onClick={() => handleUpdateStyle('textTransform', c.val)}
                            className={`py-1 rounded text-center text-xs transition-all ${
                              (styles.textTransform || 'none') === c.val
                                ? 'bg-indigo-600 text-white font-bold'
                                : 'bg-[#181920] text-gray-400 hover:bg-[#282c38]'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Line & Letter Spacing */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <div className="flex items-between justify-between text-[11px] text-gray-400 mb-1">
                          <span>Line Spacing</span>
                          <span className="font-mono text-indigo-300">{styles.lineHeight || 1.35}</span>
                        </div>
                        <input
                          type="range"
                          min={1.0}
                          max={2.0}
                          step={0.05}
                          value={styles.lineHeight || 1.35}
                          onChange={(e) => handleUpdateStyle('lineHeight', parseFloat(e.target.value))}
                          className="w-full accent-indigo-500"
                        />
                      </div>
                      <div>
                        <div className="flex items-between justify-between text-[11px] text-gray-400 mb-1">
                          <span>Letter Tracking</span>
                          <span className="font-mono text-indigo-300">{styles.letterSpacing ?? 0}px</span>
                        </div>
                        <input
                          type="range"
                          min={-2}
                          max={8}
                          step={1}
                          value={styles.letterSpacing ?? 0}
                          onChange={(e) => handleUpdateStyle('letterSpacing', parseInt(e.target.value, 10))}
                          className="w-full accent-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ALIGNMENT & MARGINS */}
              {activeEditorTab === 'alignment' && (
                <div className="space-y-4">
                  {/* Horizontal Alignment */}
                  <div className="bg-[#20222a] border border-[#2d313d] p-3 rounded-lg space-y-3">
                    <label className="text-xs font-bold text-gray-200 flex justify-between items-center">Horizontal Text Alignment <ResetButton field="textAlign" /></label>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { val: 'left', label: 'Left', icon: AlignLeft },
                        { val: 'center', label: 'Center', icon: AlignCenter },
                        { val: 'right', label: 'Right', icon: AlignRight },
                        { val: 'justify', label: 'Justify', icon: AlignJustify },
                      ].map(a => {
                        const Icon = a.icon;
                        const isCurrent = (styles.textAlign || 'center') === a.val;
                        return (
                          <button
                            key={a.val}
                            onClick={() => handleUpdateStyle('textAlign', a.val)}
                            className={`flex flex-col items-center justify-center p-2 rounded border text-center transition-all ${
                              isCurrent
                                ? 'bg-indigo-600 border-indigo-400 text-white'
                                : 'bg-[#181920] border-[#2c2f3a] text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            <Icon size={16} className="mb-1" />
                            <span className="text-[11px] font-medium">{a.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Vertical Alignment */}
                  <div className="bg-[#20222a] border border-[#2d313d] p-3 rounded-lg space-y-3">
                    <label className="text-xs font-bold text-gray-200 flex justify-between items-center">Vertical Text Position <ResetButton field="alignVertical" /></label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { val: 'top', label: 'Top Anchor', icon: ArrowUp },
                        { val: 'middle', label: 'Middle (Center)', icon: AlignCenter },
                        { val: 'bottom', label: 'Bottom Anchor', icon: ArrowDown },
                      ].map(v => {
                        const Icon = v.icon;
                        const isCurrent = (styles.alignVertical || 'middle') === v.val;
                        return (
                          <button
                            key={v.val}
                            onClick={() => handleUpdateStyle('alignVertical', v.val)}
                            className={`flex flex-col items-center justify-center p-2 rounded border text-center transition-all ${
                              isCurrent
                                ? 'bg-indigo-600 border-indigo-400 text-white'
                                : 'bg-[#181920] border-[#2c2f3a] text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            <Icon size={16} className="mb-1" />
                            <span className="text-[11px] font-medium">{v.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Safe Margins */}
                  <div className="bg-[#20222a] border border-[#2d313d] p-3 rounded-lg space-y-3">
                    <label className="text-xs font-bold text-gray-200 block">Safe Margins & Screen Padding </label>
                    
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                        <span>Horizontal Margin</span>
                        <span className="font-mono text-indigo-300">{styles.paddingHorizontal ?? 8}%</span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={25}
                        step={1}
                        value={styles.paddingHorizontal ?? 8}
                        onChange={(e) => handleUpdateStyle('paddingHorizontal', parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                        <span>Vertical Margin</span>
                        <span className="font-mono text-indigo-300">{styles.paddingVertical ?? 5}%</span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={20}
                        step={1}
                        value={styles.paddingVertical ?? 5}
                        onChange={(e) => handleUpdateStyle('paddingVertical', parseInt(e.target.value, 10))}
                        className="w-full accent-indigo-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SHADOW & OUTLINE EFFECTS */}
              {activeEditorTab === 'effects' && (
                <div className="space-y-4">
                  {/* Drop Shadow */}
                  <div className="bg-[#20222a] border border-[#2d313d] p-3 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-200">Text Drop Shadow</label>
                      <button
                        onClick={() => handleUpdateStyle('textShadow', !styles.textShadow)}
                        className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                          styles.textShadow ? 'bg-indigo-600' : 'bg-gray-600'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          styles.textShadow ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {styles.textShadow && (
                      <div className="space-y-2.5 pt-2 border-t border-[#2a2e3a]">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-400">Shadow Color</span>
                          <input
                            type="color"
                            value={styles.shadowColor?.startsWith('#') ? styles.shadowColor : '#000000'}
                            onChange={(e) => handleUpdateStyle('shadowColor', e.target.value)}
                            className="w-8 h-6 bg-transparent cursor-pointer rounded border border-[#373c4d]"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                            <span>Shadow Blur Radius</span>
                            <span className="font-mono text-indigo-300">{styles.shadowBlur ?? 12}px</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={30}
                            step={1}
                            value={styles.shadowBlur ?? 12}
                            onChange={(e) => handleUpdateStyle('shadowBlur', parseInt(e.target.value, 10))}
                            className="w-full accent-indigo-500"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                            <span>Shadow Y-Offset</span>
                            <span className="font-mono text-indigo-300">{styles.shadowOffsetY ?? 3}px</span>
                          </div>
                          <input
                            type="range"
                            min={-10}
                            max={20}
                            step={1}
                            value={styles.shadowOffsetY ?? 3}
                            onChange={(e) => handleUpdateStyle('shadowOffsetY', parseInt(e.target.value, 10))}
                            className="w-full accent-indigo-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Text Stroke / Outline */}
                  <div className="bg-[#20222a] border border-[#2d313d] p-3 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-200">Text Outline / Stroke</label>
                      <button
                        onClick={() => handleUpdateStyle('textOutline', !styles.textOutline)}
                        className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                          styles.textOutline ? 'bg-indigo-600' : 'bg-gray-600'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          styles.textOutline ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {styles.textOutline && (
                      <div className="space-y-2.5 pt-2 border-t border-[#2a2e3a]">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-gray-400">Outline Color</span>
                          <input
                            type="color"
                            value={styles.outlineColor?.startsWith('#') ? styles.outlineColor : '#000000'}
                            onChange={(e) => handleUpdateStyle('outlineColor', e.target.value)}
                            className="w-8 h-6 bg-transparent cursor-pointer rounded border border-[#373c4d]"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                            <span>Outline Stroke Thickness</span>
                            <span className="font-mono text-indigo-300">{styles.outlineSize ?? 2}px</span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={6}
                            step={1}
                            value={styles.outlineSize ?? 2}
                            onChange={(e) => handleUpdateStyle('outlineSize', parseInt(e.target.value, 10))}
                            className="w-full accent-indigo-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: SCOPE & EMBLEM */}
              {activeEditorTab === 'emblem' && (
                <div className="space-y-4">
                  {/* Scope Selector */}
                  <div className="bg-[#20222a] border border-[#2d313d] p-3 rounded-lg space-y-3">
                    <label className="text-xs font-bold text-gray-200 block">Default Theme Scope </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'global', label: 'All Slides (Global)' },
                        { id: 'song', label: 'Songs Default' },
                        { id: 'bible', label: 'Scripture Default' },
                        { id: 'logo', label: 'Default Logo' },
                        { id: 'stage', label: 'Stage Monitor' },
                        { id: 'custom', label: 'Custom / Specific' },
                      ].map(sc => (
                        <button
                          key={sc.id}
                          onClick={() => {
                            saveTheme({
                              ...selectedTheme,
                              type: sc.id as any
                            });
                          }}
                          className={`p-2 rounded border text-left text-xs font-medium transition-all ${
                            selectedTheme.type === sc.id
                              ? 'bg-indigo-600/30 border-indigo-400 text-white'
                              : 'bg-[#181920] border-[#2c2f3a] text-gray-400 hover:text-gray-200'
                          }`}
                        >
                          {sc.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Church Emblem Overlay */}
                  <div className="bg-[#20222a] border border-[#2d313d] p-3 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-gray-200">Church Emblem / Logo Overlay</label>
                      <button
                        onClick={() => handleUpdateStyle('showLogo', !styles.showLogo)}
                        className={`w-9 h-5 rounded-full transition-colors relative p-0.5 ${
                          styles.showLogo ? 'bg-indigo-600' : 'bg-gray-600'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          styles.showLogo ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    {styles.showLogo && (
                      <div className="space-y-2.5 pt-2 border-t border-[#2a2e3a]">
                        <div>
                          <label className="text-[11px] text-gray-400 block mb-1">Logo Placement</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { id: 'top-left', label: 'Top Left' },
                              { id: 'top-right', label: 'Top Right' },
                              { id: 'bottom-left', label: 'Bottom Left' },
                              { id: 'bottom-right', label: 'Bottom Right' },
                              { id: 'top-center', label: 'Top Center' },
                              { id: 'bottom-center', label: 'Bottom Center' },
                            ].map(pos => (
                              <button
                                key={pos.id}
                                onClick={() => handleUpdateStyle('logoPosition', pos.id)}
                                className={`py-1 rounded text-center text-[10px] transition-all ${
                                  (styles.logoPosition || 'bottom-right') === pos.id
                                    ? 'bg-indigo-600 text-white font-bold'
                                    : 'bg-[#181920] text-gray-400 hover:bg-[#282c38]'
                                }`}
                              >
                                {pos.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between text-[11px] text-gray-400 mb-1">
                            <span>Logo Opacity</span>
                            <span className="font-mono text-indigo-300">{Math.round((styles.logoOpacity ?? 0.85) * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min={0.1}
                            max={1.0}
                            step={0.05}
                            value={styles.logoOpacity ?? 0.85}
                            onChange={(e) => handleUpdateStyle('logoOpacity', parseFloat(e.target.value))}
                            className="w-full accent-indigo-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Panel>

        <ResizeHandle direction="horizontal" />

        {/* RIGHT PANEL: Live Interactive Slide Previewer */}
        <Panel defaultSize={34} minSize={24}>
          <div className="h-full bg-[#15161b] p-3 flex flex-col justify-between overflow-hidden">
            <div className="flex flex-col h-full overflow-hidden">
              {/* Preview Header & Controls */}
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Eye size={13} className="text-cyan-400" />
                  <span className="font-bold text-xs uppercase tracking-wider text-gray-200">Real-Time Slide Preview</span>
                </div>

                {/* Aspect Ratio Picker */}
                <div className="flex items-center gap-1 bg-[#20222a] p-0.5 rounded border border-[#2d313d]">
                  {(['16:9', '4:3', '21:9'] as const).map(ar => (
                    <button
                      key={ar}
                      onClick={() => setAspectRatio(ar)}
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono transition-colors ${
                        aspectRatio === ar ? 'bg-cyan-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {ar}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sample Content Switcher */}
              <div className="flex items-center gap-1 mb-2 overflow-x-auto pb-1 shrink-0 custom-scrollbar">
                {[
                  { id: 'verse', label: 'Song Verse' },
                  { id: 'chorus', label: 'Chorus' },
                  { id: 'bible', label: 'Scripture' },
                  { id: 'announcement', label: 'Announcement' },
                  { id: 'custom', label: 'Custom' },
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSampleMode(s.id as any)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors whitespace-nowrap ${
                      sampleMode === s.id
                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/50'
                        : 'bg-[#1f2129] text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {sampleMode === 'custom' && (
                <div className="mb-2 shrink-0">
                  <textarea
                    rows={2}
                    value={customSampleText}
                    onChange={(e) => setCustomSampleText(e.target.value)}
                    placeholder="Enter custom sample lyrics or scripture..."
                    className="w-full bg-[#181a22] border border-[#2e323e] rounded p-1.5 text-xs text-gray-200 resize-none"
                  />
                </div>
              )}

              {/* Rendered Slide Box */}
              <div className="flex-1 flex items-center justify-center p-1 bg-[#101115] rounded-lg border border-[#262832] overflow-hidden min-h-0 relative">
                <div 
                  className={`w-full max-h-full rounded-md shadow-2xl relative overflow-hidden flex flex-col justify-center select-none border border-white/10 ${
                    aspectRatio === '16:9' ? 'aspect-video' : aspectRatio === '4:3' ? 'aspect-4/3' : 'aspect-21/9'
                  }`}
                  style={{
                    background: isGradient ? resolvedStyles.backgroundGradient : resolvedStyles.backgroundColor || '#090a0f',
                  }}
                >
                  {/* Background Media */}
                  {isVideo ? (
                    <video
                      src={resolvedStyles.backgroundVideoUrl}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ filter: resolvedStyles.backgroundBlur ? `blur(${resolvedStyles.backgroundBlur}px)` : 'none' }}
                    />
                  ) : isImage ? (
                    <img
                      src={resolvedStyles.backgroundImageUrl}
                      alt="bg"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ filter: resolvedStyles.backgroundBlur ? `blur(${resolvedStyles.backgroundBlur}px)` : 'none' }}
                    />
                  ) : null}

                  {/* Dark Dimmer / Tint Overlay */}
                  <div 
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundColor: resolvedStyles.backgroundOverlayColor || '#000000',
                      opacity: resolvedStyles.backgroundOverlayOpacity ?? 0.35
                    }}
                  />

                  {/* Slide Text Content Container */}
                  <div 
                    className="relative z-10 w-full h-full flex flex-col"
                    style={ThemeEngine.getContainerAlignmentStyle(resolvedStyles)}
                  >
                    {currentSample.title && (
                      <h4 
                        className="mb-1 font-bold opacity-80 uppercase tracking-wider truncate max-w-full text-cyan-300"
                        style={{
                          fontSize: `clamp(9px, 1.8vw, 13px)`,
                          fontFamily: resolvedStyles.fontFamily,
                          textAlign: resolvedStyles.textAlign || 'center',
                          alignSelf: resolvedStyles.textAlign === 'left' ? 'flex-start' : resolvedStyles.textAlign === 'right' ? 'flex-end' : 'center',
                        }}
                      >
                        {currentSample.title}
                      </h4>
                    )}

                    <p 
                      className="whitespace-pre-line leading-snug drop-shadow-md max-w-full"
                      style={{
                        ...ThemeEngine.getTextStyle(resolvedStyles, 0.45),
                        fontSize: `clamp(11px, 2.6vw, ${Math.min(26, Math.max(12, (resolvedStyles.fontSize || 90) * 0.45))}px)`,
                      }}
                    >
                      {currentSample.text}
                    </p>
                  </div>

                  {/* Logo Overlay */}
                  {resolvedStyles.showLogo && resolvedStyles.logoUrl && (
                    <div 
                      className={`absolute z-20 pointer-events-none p-2 ${
                        resolvedStyles.logoPosition === 'top-left' ? 'top-1 left-1' :
                        resolvedStyles.logoPosition === 'top-right' ? 'top-1 right-1' :
                        resolvedStyles.logoPosition === 'bottom-left' ? 'bottom-1 left-1' :
                        resolvedStyles.logoPosition === 'top-center' ? 'top-1 left-1/2 -translate-x-1/2' :
                        resolvedStyles.logoPosition === 'bottom-center' ? 'bottom-1 left-1/2 -translate-x-1/2' :
                        'bottom-1 right-1'
                      }`}
                      style={{ opacity: resolvedStyles.logoOpacity ?? 0.85 }}
                    >
                      <img src={resolvedStyles.logoUrl} alt="Logo" className="h-6 w-auto object-contain drop-shadow" />
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons & Drag Pill */}
              <div className="pt-3 space-y-2 shrink-0">
                {/* Draggable Theme Card Pill */}
                <div
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, selectedTheme)}
                  className="w-full bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-500/50 hover:border-indigo-400 text-indigo-200 py-1.5 px-3 rounded-md text-xs font-bold flex items-center justify-between cursor-grab active:cursor-grabbing shadow-sm transition-all group"
                  title="Drag this theme pill directly into Schedule items!"
                >
                  <div className="flex items-center gap-2">
                    <GripVertical size={14} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                    <span>Drag Theme: "{selectedTheme.name}"</span>
                  </div>
                  <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded uppercase tracking-wider font-mono">
                    Drop to Schedule
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleApplyToSelectedScheduleItem}
                    className="flex items-center justify-center gap-1.5 bg-[#2c303c] hover:bg-[#383d4c] text-gray-100 py-1.5 px-2 rounded text-xs font-semibold transition-colors border border-[#3e4454]"
                    title="Apply this theme style to currently selected item in schedule"
                  >
                    <Send size={13} className="text-indigo-400" />
                    <span>Apply to Selected Item</span>
                  </button>

                  <button
                    onClick={handleApplyToAllScheduleItems}
                    className="flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 px-2 rounded text-xs font-bold transition-colors shadow-xs"
                    title="Apply this theme style across all schedule items"
                  >
                    <Layers size={13} />
                    <span>Apply to All in Sched</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
