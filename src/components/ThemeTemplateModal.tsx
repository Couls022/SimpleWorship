import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sliders, 
  Sparkles, 
  Check, 
  Layers, 
  Type, 
  Palette, 
  Layout, 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Save, 
  Copy,
  Eye
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Theme, ThemeStyles, ThemeType } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { dbApi } from '../db';
import { SystemFontPicker } from './common/SystemFontPicker';

interface ThemeTemplateModalProps {
  onClose: () => void;
  initialThemeId?: string;
}

const PRESET_TEMPLATES: { name: string; type: ThemeType; styles: ThemeStyles }[] = [
  {
    name: 'Modern Gradient Glow',
    type: 'global',
    styles: {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: 52,
      fontColor: '#ffffff',
      fontWeight: '700',
      textAlign: 'center',
      alignVertical: 'middle',
      textShadow: true,
      shadowColor: 'rgba(0, 0, 0, 0.85)',
      shadowBlur: 14,
      textOutline: true,
      outlineColor: '#000000',
      outlineSize: 2,
      backgroundType: 'gradient',
      backgroundColor: '#0a0f24',
      backgroundGradient: 'linear-gradient(135deg, #091a38 0%, #1e1338 50%, #08242b 100%)',
      layoutPreset: 'center',
      boxStyle: 'none',
      paddingHorizontal: 48,
      paddingVertical: 36
    }
  },
  {
    name: 'Classic Hymnal Gold',
    type: 'song',
    styles: {
      fontFamily: 'Playfair Display, serif',
      fontSize: 48,
      fontColor: '#fef3c7',
      fontWeight: '600',
      textAlign: 'center',
      alignVertical: 'middle',
      textShadow: true,
      shadowColor: 'rgba(0, 0, 0, 0.9)',
      shadowBlur: 16,
      textOutline: false,
      backgroundType: 'gradient',
      backgroundColor: '#0f172a',
      backgroundGradient: 'radial-gradient(ellipse at center, #1e293b 0%, #020617 100%)',
      layoutPreset: 'center',
      boxStyle: 'border',
      paddingHorizontal: 56,
      paddingVertical: 40
    }
  },
  {
    name: 'Scripture Reading Glass',
    type: 'bible',
    styles: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 44,
      fontColor: '#ffffff',
      fontWeight: '500',
      textAlign: 'left',
      alignVertical: 'middle',
      textShadow: true,
      shadowColor: 'rgba(0, 0, 0, 0.7)',
      shadowBlur: 8,
      textOutline: false,
      backgroundType: 'gradient',
      backgroundColor: '#0f172a',
      backgroundGradient: 'linear-gradient(180deg, #0b132b 0%, #1c2541 100%)',
      layoutPreset: 'glass-card',
      boxStyle: 'glass',
      paddingHorizontal: 40,
      paddingVertical: 32
    }
  },
  {
    name: 'Lower-Third Streamer',
    type: 'presentation',
    styles: {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: 38,
      fontColor: '#ffffff',
      fontWeight: '700',
      textAlign: 'left',
      alignVertical: 'bottom',
      textShadow: true,
      shadowColor: 'rgba(0,0,0,0.9)',
      shadowBlur: 10,
      textOutline: true,
      outlineColor: '#000000',
      outlineSize: 2,
      backgroundType: 'color',
      backgroundColor: 'transparent',
      layoutPreset: 'lower-third',
      boxStyle: 'solid',
      paddingHorizontal: 36,
      paddingVertical: 24
    }
  }
];

export default function ThemeTemplateModal({ onClose, initialThemeId }: ThemeTemplateModalProps) {
  const store = useStore();
  const { themesList, saveTheme, deleteTheme, activeSchedule } = store;

  const [selectedThemeId, setSelectedThemeId] = useState<string>(() => {
    if (initialThemeId && themesList.some(t => t.id === initialThemeId)) {
      return initialThemeId;
    }
    return themesList[0]?.id || 'theme-song';
  });

  const activeTheme = themesList.find(t => t.id === selectedThemeId) || themesList[0] || PRESET_TEMPLATES[0];

  const [themeName, setThemeName] = useState(activeTheme.name);
  const [themeType, setThemeType] = useState<ThemeType>(activeTheme.type || 'global');
  const [styles, setStyles] = useState<ThemeStyles>(activeTheme.styles || {});

  // Update form when selected theme changes
  useEffect(() => {
    const thm = themesList.find(t => t.id === selectedThemeId);
    if (thm) {
      setThemeName(thm.name);
      setThemeType(thm.type || 'global');
      setStyles(thm.styles || {});
    }
  }, [selectedThemeId, themesList]);

  // Handle saving current changes
  const handleSaveCurrentTheme = async () => {
    const updated: Theme = {
      id: selectedThemeId,
      name: themeName.trim() || 'Custom Theme Template',
      type: themeType,
      styles: { ...styles }
    };
    await saveTheme(updated);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: `Saved Theme Template "${updated.name}"`
      })
    );
  };

  // Create new theme
  const handleCreateNewTheme = async () => {
    const newId = `theme-${uuidv4().substring(0, 8)}`;
    const newTheme: Theme = {
      id: newId,
      name: `New Theme Template ${themesList.length + 1}`,
      type: 'global',
      styles: {
        fontFamily: 'Montserrat, sans-serif',
        fontSize: 48,
        fontColor: '#ffffff',
        fontWeight: '700',
        textAlign: 'center',
        alignVertical: 'middle',
        textShadow: true,
        shadowColor: 'rgba(0,0,0,0.8)',
        shadowBlur: 10,
        textOutline: true,
        outlineColor: '#000000',
        outlineSize: 2,
        backgroundType: 'gradient',
        backgroundColor: '#0f172a',
        backgroundGradient: 'linear-gradient(135deg, #0c1a30 0%, #192b47 100%)',
        layoutPreset: 'center',
        boxStyle: 'none',
        paddingHorizontal: 40,
        paddingVertical: 32
      }
    };
    await saveTheme(newTheme);
    setSelectedThemeId(newId);
    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: `Created Theme Template "${newTheme.name}"`
      })
    );
  };

  // Apply template preset
  const handleApplyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setThemeName(preset.name);
    setThemeType(preset.type);
    setStyles({ ...preset.styles });
  };

  // Apply to active schedule
  const handleApplyToActiveSchedule = () => {
    if (!activeSchedule || !activeSchedule.items || activeSchedule.items.length === 0) {
      window.dispatchEvent(
        new CustomEvent('simpleworship:notify', { detail: 'Active schedule is empty.' })
      );
      return;
    }

    const updatedItems = activeSchedule.items.map(it => ({
      ...it,
      themeId: selectedThemeId
    }));

    store.setActiveSchedule({
      ...activeSchedule,
      items: updatedItems
    });

    window.dispatchEvent(
      new CustomEvent('simpleworship:notify', {
        detail: `Applied Theme "${themeName}" to all ${updatedItems.length} schedule items!`
      })
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-[99999] p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#1a1d24] border border-[#2e3340] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d323e] bg-[#14161c]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-950/80 border border-indigo-700/60 text-indigo-400">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white leading-tight">Theme Template Designer</h2>
              <p className="text-xs text-gray-400">Custom display styles, backgrounds, typography & layout presets</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-lg hover:bg-[#2d323e] text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          
          {/* Left Sidebar: Theme List & Presets */}
          <div className="w-64 border-r border-[#2d323e] bg-[#16181e] flex flex-col p-3 space-y-3 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Themes ({themesList.length})</span>
              <button
                type="button"
                onClick={handleCreateNewTheme}
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-indigo-600/30 border border-indigo-500/50 text-indigo-300 hover:bg-indigo-600/50 transition-colors cursor-pointer"
              >
                <Plus size={12} />
                <span>New</span>
              </button>
            </div>

            <div className="space-y-1">
              {themesList.map(thm => (
                <button
                  key={thm.id}
                  type="button"
                  onClick={() => setSelectedThemeId(thm.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between cursor-pointer ${
                    selectedThemeId === thm.id
                      ? 'bg-indigo-950/80 border border-indigo-500/70 text-white shadow-xs'
                      : 'text-gray-300 hover:bg-[#222631] hover:text-white border border-transparent'
                  }`}
                >
                  <span className="truncate">{thm.name}</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-black/40 text-gray-400 uppercase font-mono">
                    {thm.type || 'global'}
                  </span>
                </button>
              ))}
            </div>

            <div className="border-t border-[#2d323e] pt-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">Preset Inspiration</span>
              <div className="space-y-1.5">
                {PRESET_TEMPLATES.map((pst, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(pst)}
                    className="w-full text-left p-2 rounded-lg bg-[#20232b] hover:bg-[#262b36] border border-[#2e3340] text-gray-300 hover:text-white text-[11px] transition-colors cursor-pointer"
                  >
                    <div className="font-medium text-white">{pst.name}</div>
                    <div className="text-[10px] text-gray-400 truncate">{pst.styles.fontFamily} • {pst.styles.backgroundType}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Center/Right: Live Preview & Style Controls */}
          <div className="flex-1 flex flex-col overflow-y-auto p-5 space-y-5 bg-[#1a1d24]">
            
            {/* Live WYSIWYG Preview Box */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-gray-300">
                <span className="font-semibold flex items-center gap-1.5">
                  <Eye size={14} className="text-cyan-400" />
                  Live Display Projection Preview
                </span>
                <span className="text-[10px] text-gray-500 font-mono">16:9 Aspect Ratio</span>
              </div>
              <div 
                className="w-full aspect-video rounded-xl border border-[#3b4152] shadow-2xl overflow-hidden relative flex flex-col justify-center items-center p-6 text-center transition-all"
                style={{
                  backgroundColor: styles.backgroundColor || '#0a0f24',
                  backgroundImage: styles.backgroundType === 'gradient' 
                    ? styles.backgroundGradient || 'linear-gradient(135deg, #091a38 0%, #1e1338 100%)' 
                    : styles.backgroundType === 'image' && styles.backgroundImageUrl 
                      ? `url(${styles.backgroundImageUrl})` 
                      : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                <div 
                  className={`w-full max-w-xl transition-all ${
                    styles.boxStyle === 'glass' 
                      ? 'bg-black/40 backdrop-blur-md border border-white/20 p-6 rounded-2xl'
                      : styles.boxStyle === 'border'
                        ? 'border-2 border-amber-400/60 p-6 rounded-xl'
                        : styles.boxStyle === 'solid'
                          ? 'bg-black/75 p-4 rounded-lg'
                          : ''
                  }`}
                  style={{
                    textAlign: styles.textAlign || 'center',
                    fontFamily: styles.fontFamily || 'Montserrat, sans-serif',
                    color: styles.fontColor || '#ffffff',
                    fontSize: `${Math.max(16, (styles.fontSize || 48) * 0.45)}px`,
                    fontWeight: styles.fontWeight || '700',
                    lineHeight: styles.lineHeight || 1.25,
                    textShadow: styles.textShadow 
                      ? `${styles.shadowOffsetX || 0}px ${styles.shadowOffsetY || 2}px ${styles.shadowBlur || 10}px ${styles.shadowColor || 'rgba(0,0,0,0.8)'}` 
                      : 'none',
                    WebkitTextStroke: styles.textOutline 
                      ? `${styles.outlineSize || 1}px ${styles.outlineColor || '#000000'}` 
                      : 'none'
                  }}
                >
                  <p className="font-bold">Amazing grace how sweet the sound</p>
                  <p className="text-[0.75em] opacity-90 mt-1 font-normal">That saved a wretch like me</p>
                </div>
              </div>
            </div>

            {/* Editing Controls Tabs/Grid */}
            <div className="grid grid-cols-2 gap-4">
              
              {/* General & Typography */}
              <div className="p-4 rounded-xl bg-[#20232b] border border-[#2e3340] space-y-3">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wide flex items-center gap-1.5">
                  <Type size={14} className="text-indigo-400" />
                  Typography & Theme Info
                </span>

                <div>
                  <label className="block text-[11px] text-gray-400 mb-1">Theme Name</label>
                  <input
                    type="text"
                    value={themeName}
                    onChange={(e) => setThemeName(e.target.value)}
                    className="w-full bg-[#14161c] border border-[#3b404d] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Target Category</label>
                    <select
                      value={themeType}
                      onChange={(e) => setThemeType(e.target.value as ThemeType)}
                      className="w-full bg-[#14161c] border border-[#3b404d] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="global">Global Default</option>
                      <option value="song">Songs & Hymns</option>
                      <option value="bible">Scripture</option>
                      <option value="presentation">Presentation</option>
                      <option value="announcement">Announcements</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Font Family</label>
                    <SystemFontPicker
                      value={styles.fontFamily || 'Montserrat, sans-serif'}
                      onChange={(fontFamily) => setStyles({ ...styles, fontFamily })}
                      className="w-full"
                      buttonClassName="w-full justify-between py-1.5 px-2.5 bg-[#14161c] border-[#3b404d] text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Font Size ({styles.fontSize || 48}px)</label>
                    <input
                      type="range"
                      min="24"
                      max="96"
                      value={styles.fontSize || 48}
                      onChange={(e) => setStyles({ ...styles, fontSize: Number(e.target.value) })}
                      className="w-full accent-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Font Color</label>
                    <input
                      type="color"
                      value={styles.fontColor || '#ffffff'}
                      onChange={(e) => setStyles({ ...styles, fontColor: e.target.value })}
                      className="w-full h-7 bg-transparent cursor-pointer rounded border border-[#3b404d]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Text Align</label>
                    <select
                      value={styles.textAlign || 'center'}
                      onChange={(e) => setStyles({ ...styles, textAlign: e.target.value as any })}
                      className="w-full bg-[#14161c] border border-[#3b404d] rounded px-2 py-1 text-xs text-white focus:outline-none"
                    >
                      <option value="center">Center</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Background & Effects */}
              <div className="p-4 rounded-xl bg-[#20232b] border border-[#2e3340] space-y-3">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wide flex items-center gap-1.5">
                  <Palette size={14} className="text-cyan-400" />
                  Background & Effects
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Background Type</label>
                    <select
                      value={styles.backgroundType || 'gradient'}
                      onChange={(e) => setStyles({ ...styles, backgroundType: e.target.value as any })}
                      className="w-full bg-[#14161c] border border-[#3b404d] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="gradient">Gradient Glow</option>
                      <option value="color">Solid Color</option>
                      <option value="image">Stock Image</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">Box / Frame Style</label>
                    <select
                      value={styles.boxStyle || 'none'}
                      onChange={(e) => setStyles({ ...styles, boxStyle: e.target.value as any })}
                      className="w-full bg-[#14161c] border border-[#3b404d] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                    >
                      <option value="none">No Container Box</option>
                      <option value="glass">Frosted Glass Card</option>
                      <option value="border">Gold Highlight Border</option>
                      <option value="solid">High-Contrast Solid</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(styles.textShadow)}
                      onChange={(e) => setStyles({ ...styles, textShadow: e.target.checked })}
                      className="rounded text-indigo-500"
                    />
                    <span>High-Contrast Text Shadow</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(styles.textOutline)}
                      onChange={(e) => setStyles({ ...styles, textOutline: e.target.checked })}
                      className="rounded text-indigo-500"
                    />
                    <span>Crisp Text Outline / Stroke</span>
                  </label>
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#2d323e] bg-[#14161c] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApplyToActiveSchedule}
              className="px-3.5 py-1.5 rounded-lg bg-[#262a35] hover:bg-[#323847] border border-[#3b4152] text-gray-200 text-xs font-medium cursor-pointer transition-colors"
            >
              Apply to All Items in Active Schedule
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[#2b2f3a] text-gray-300 hover:text-white text-xs cursor-pointer transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSaveCurrentTheme}
              className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg cursor-pointer transition-all active:scale-95"
            >
              <Save size={14} />
              <span>Save Theme Template</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
