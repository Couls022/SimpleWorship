import React, { useState, useEffect, useMemo } from 'react';
import { 
  Type, 
  Zap, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  Layers, 
  Flame, 
  Search, 
  Cpu, 
  Sparkles, 
  FileText, 
  Sliders, 
  ExternalLink,
  Info,
  Check,
  Play
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getAllPresentations } from '../../db/presentations';
import { 
  getFontCacheStats, 
  FontCacheStats, 
  prewarmFontGlyphs, 
  prewarmFontBatch, 
  getCuratedWorshipFontGroups, 
  scanLibraryAllFonts, 
  purgeFontCacheAndDomLinks, 
  getFontCachePreferences, 
  saveFontCachePreferences,
  FontCachePreferences,
  normalizeFontName,
  probePhysicalLocalFont,
  isFontInstalledLocally
} from '../../utils/pptxFontManager';

interface FontCacheManagerPanelProps {
  onNotify?: (message: string) => void;
}

export default function FontCacheManagerPanel({ onNotify }: FontCacheManagerPanelProps) {
  const songsList = useStore(state => state.songsList);
  const themesList = useStore(state => state.themesList);
  const activeSchedule = useStore(state => state.activeSchedule);
  const systemOptions = useStore(state => state.systemOptions);
  const assetsList = useStore(state => state.assetsList);

  const [stats, setStats] = useState<FontCacheStats>(getFontCacheStats());
  const [preferences, setPreferences] = useState<FontCachePreferences>(getFontCachePreferences());
  const [libraryPresentations, setLibraryPresentations] = useState<any[]>([]);
  const [isScanningLibrary, setIsScanningLibrary] = useState(false);

  // Pre-warming state
  const [isPrewarming, setIsPrewarming] = useState(false);
  const [prewarmProgress, setPrewarmProgress] = useState<{
    completed: number;
    total: number;
    currentFont: string;
    percent: number;
  }>({ completed: 0, total: 0, currentFont: '', percent: 0 });

  // Custom font input
  const [customFontInput, setCustomFontInput] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'prewarmed' | 'cached' | 'library'>('all');
  const [previewSampleText, setPreviewSampleText] = useState('Holy, Holy, Holy is the Lord God Almighty');
  const [previewSize, setPreviewSize] = useState<number>(20);

  // Load stats and scan library on mount
  useEffect(() => {
    refreshStats();

    const loadPresentations = async () => {
      setIsScanningLibrary(true);
      try {
        const pres = await getAllPresentations();
        setLibraryPresentations(pres);
      } catch (e) {
        console.error('Failed to load presentations for font scan:', e);
      } finally {
        setIsScanningLibrary(false);
      }
    };

    loadPresentations();

    const handleUpdate = () => {
      refreshStats();
    };

    window.addEventListener('simpleworship:font-cache-updated', handleUpdate);
    window.addEventListener('simpleworship:fonts-updated', handleUpdate);
    return () => {
      window.removeEventListener('simpleworship:font-cache-updated', handleUpdate);
      window.removeEventListener('simpleworship:fonts-updated', handleUpdate);
    };
  }, []);

  const refreshStats = () => {
    setStats(getFontCacheStats());
  };

  // Discovered Library Fonts
  const libraryScanResult = useMemo(() => {
    return scanLibraryAllFonts(libraryPresentations, themesList, songsList, {
      activeSchedule,
      systemOptions,
      assets: assetsList,
    });
  }, [libraryPresentations, themesList, songsList, activeSchedule, systemOptions, assetsList]);

  // Curated Groups
  const curatedGroups = useMemo(() => {
    return getCuratedWorshipFontGroups();
  }, []);

  const allCuratedFontsList = useMemo(() => {
    const list: string[] = [];
    curatedGroups.forEach(g => list.push(...g.fonts));
    return Array.from(new Set(list));
  }, [curatedGroups]);

  // Combined Directory of known fonts
  const allKnownFontsDirectory = useMemo(() => {
    const directory = new Map<string, {
      family: string;
      archetype: string;
      isPrewarmed: boolean;
      isCachedInMemory: boolean;
      isSystemLocal: boolean;
      isInLibrary: boolean;
      isCurated: boolean;
    }>();

    // 1. Add all from cached
    for (const fam of stats.cachedFamilies) {
      const norm = normalizeFontName(fam);
      directory.set(norm.baseFamily.toLowerCase(), {
        family: norm.baseFamily,
        archetype: norm.archetype,
        isPrewarmed: stats.prewarmedFamilies.includes(norm.baseFamily),
        isCachedInMemory: true,
        isSystemLocal: isFontInstalledLocally(norm.baseFamily),
        isInLibrary: libraryScanResult.allUniqueFonts.some(f => f.toLowerCase() === norm.baseFamily.toLowerCase()),
        isCurated: allCuratedFontsList.some(f => f.toLowerCase() === norm.baseFamily.toLowerCase()),
      });
    }

    // 2. Add all from prewarmed
    for (const fam of stats.prewarmedFamilies) {
      const norm = normalizeFontName(fam);
      const key = norm.baseFamily.toLowerCase();
      if (!directory.has(key)) {
        directory.set(key, {
          family: norm.baseFamily,
          archetype: norm.archetype,
          isPrewarmed: true,
          isCachedInMemory: stats.cachedFamilies.includes(norm.baseFamily),
          isSystemLocal: isFontInstalledLocally(norm.baseFamily),
          isInLibrary: libraryScanResult.allUniqueFonts.some(f => f.toLowerCase() === norm.baseFamily.toLowerCase()),
          isCurated: allCuratedFontsList.some(f => f.toLowerCase() === norm.baseFamily.toLowerCase()),
        });
      }
    }

    // 3. Add all from library
    for (const fam of libraryScanResult.allUniqueFonts) {
      const norm = normalizeFontName(fam);
      const key = norm.baseFamily.toLowerCase();
      if (!directory.has(key)) {
        directory.set(key, {
          family: norm.baseFamily,
          archetype: norm.archetype,
          isPrewarmed: stats.prewarmedFamilies.includes(norm.baseFamily),
          isCachedInMemory: stats.cachedFamilies.includes(norm.baseFamily),
          isSystemLocal: isFontInstalledLocally(norm.baseFamily),
          isInLibrary: true,
          isCurated: allCuratedFontsList.some(f => f.toLowerCase() === norm.baseFamily.toLowerCase()),
        });
      }
    }

    // 4. Add all from curated
    for (const fam of allCuratedFontsList) {
      const norm = normalizeFontName(fam);
      const key = norm.baseFamily.toLowerCase();
      if (!directory.has(key)) {
        directory.set(key, {
          family: norm.baseFamily,
          archetype: norm.archetype,
          isPrewarmed: stats.prewarmedFamilies.includes(norm.baseFamily),
          isCachedInMemory: stats.cachedFamilies.includes(norm.baseFamily),
          isSystemLocal: isFontInstalledLocally(norm.baseFamily),
          isInLibrary: libraryScanResult.allUniqueFonts.some(f => f.toLowerCase() === norm.baseFamily.toLowerCase()),
          isCurated: true,
        });
      }
    }

    return Array.from(directory.values());
  }, [stats, libraryScanResult, allCuratedFontsList]);

  // Filtered Font List
  const filteredFonts = useMemo(() => {
    return allKnownFontsDirectory.filter(item => {
      if (searchFilter) {
        const query = searchFilter.toLowerCase().trim();
        const matchesName = item.family.toLowerCase().includes(query);
        const matchesArchetype = item.archetype.toLowerCase().includes(query);
        if (!matchesName && !matchesArchetype) return false;
      }

      if (filterTab === 'prewarmed') return item.isPrewarmed;
      if (filterTab === 'cached') return item.isCachedInMemory;
      if (filterTab === 'library') return item.isInLibrary;
      return true;
    });
  }, [allKnownFontsDirectory, searchFilter, filterTab]);

  // Action: Pre-warm a single font
  const handlePrewarmSingle = async (fontFamily: string) => {
    if (!fontFamily.trim()) return;
    const norm = normalizeFontName(fontFamily).baseFamily;
    setIsPrewarming(true);
    setPrewarmProgress({ completed: 0, total: 1, currentFont: norm, percent: 50 });

    const ok = await prewarmFontGlyphs(norm);
    setIsPrewarming(false);
    refreshStats();

    const msg = ok 
      ? `✓ Pre-warmed & cached font: "${norm}" (0ms Live Readiness)` 
      : `⚠️ Could not download font "${norm}" (Archetype fallback active)`;
    
    if (onNotify) onNotify(msg);
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: msg }));
  };

  // Action: Pre-warm a batch of fonts
  const handlePrewarmBatch = async (fonts: string[], label: string) => {
    if (fonts.length === 0) {
      const msg = 'No fonts to pre-warm in this category.';
      if (onNotify) onNotify(msg);
      return;
    }

    setIsPrewarming(true);
    setPrewarmProgress({ completed: 0, total: fonts.length, currentFont: 'Starting...', percent: 0 });

    const result = await prewarmFontBatch(fonts, (completed, total, current) => {
      const percent = Math.round((completed / total) * 100);
      setPrewarmProgress({ completed, total, currentFont: current, percent });
    });

    setIsPrewarming(false);
    refreshStats();

    const msg = `⚡ Pre-warmed ${result.successful.length} ${label} fonts successfully into GPU text cache!`;
    if (onNotify) onNotify(msg);
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: msg }));
  };

  // Action: Clear Font Cache
  const handleClearCache = () => {
    const res = purgeFontCacheAndDomLinks();
    refreshStats();
    const msg = `🧹 Purged font cache (${res.clearedCacheCount} entries cleared, ${res.removedLinksCount} stylesheet links reset)`;
    if (onNotify) onNotify(msg);
    window.dispatchEvent(new CustomEvent('simpleworship:notify', { detail: msg }));
  };

  // Action: Update Preferences
  const handleUpdatePreference = (key: keyof FontCachePreferences, value: boolean) => {
    const updated = saveFontCachePreferences({ [key]: value });
    setPreferences(updated);
  };

  return (
    <div className="space-y-4 text-xs select-none">
      
      {/* 1. Header Banner & High-Level Purpose */}
      <div className="bg-[#181a22] border border-[#323644] rounded-md p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[#2b3040] pb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded text-amber-400">
              <Type size={20} />
            </div>
            <div>
              <h2 className="font-bold text-gray-100 text-sm flex items-center gap-1.5">
                <span>Font Cache Manager</span>
                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono px-1.5 py-0.2 rounded">
                  Live Worship Engine
                </span>
              </h2>
              <p className="text-gray-400 text-[11px] mt-0.5">
                Pre-compile and rasterize presentation typefaces into RAM/GPU cache to ensure 0ms latency and prevent text reflow glitches during live services.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleClearCache}
              className="px-3 py-1.5 bg-[#2a2e3b] hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-600/50 border border-[#3c4254] text-gray-300 rounded font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Purge all loaded web fonts and injected links from memory"
            >
              <Trash2 size={13} className="text-rose-400" />
              <span>Clear Font Cache</span>
            </button>

            <button
              type="button"
              disabled={isPrewarming}
              onClick={() => {
                const allToWarm = Array.from(new Set([
                  ...allCuratedFontsList,
                  ...libraryScanResult.allUniqueFonts
                ]));
                handlePrewarmBatch(allToWarm, 'Worship & Library');
              }}
              className="px-4 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold rounded shadow flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Zap size={14} className={isPrewarming ? "animate-spin" : "fill-current"} />
              <span>{isPrewarming ? 'Pre-Warming...' : 'Pre-Warm All Fonts (Sunday Prep)'}</span>
            </button>
          </div>
        </div>

        {/* 2. Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="bg-[#12141a] border border-[#272b38] rounded p-2.5">
            <div className="text-[10px] text-gray-400 uppercase font-bold flex items-center justify-between">
              <span>In-Memory Fonts</span>
              <Layers size={12} className="text-cyan-400" />
            </div>
            <div className="text-xl font-mono font-bold text-cyan-300 mt-1">
              {stats.totalInMemory}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              Typefaces in RAM
            </div>
          </div>

          <div className="bg-[#12141a] border border-[#272b38] rounded p-2.5">
            <div className="text-[10px] text-gray-400 uppercase font-bold flex items-center justify-between">
              <span>Pre-Warmed & Primed</span>
              <Flame size={12} className="text-amber-400" />
            </div>
            <div className="text-xl font-mono font-bold text-amber-300 mt-1">
              {stats.prewarmedFamilies.length}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              0ms Glyph-Ready
            </div>
          </div>

          <div className="bg-[#12141a] border border-[#272b38] rounded p-2.5">
            <div className="text-[10px] text-gray-400 uppercase font-bold flex items-center justify-between">
              <span>DOM Stylesheets</span>
              <FileText size={12} className="text-purple-400" />
            </div>
            <div className="text-xl font-mono font-bold text-purple-300 mt-1">
              {stats.injectedLinks.length}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              Active CSS Links
            </div>
          </div>

          <div className="bg-[#12141a] border border-[#272b38] rounded p-2.5">
            <div className="text-[10px] text-gray-400 uppercase font-bold flex items-center justify-between">
              <span>Library Discovered</span>
              <Sparkles size={12} className="text-emerald-400" />
            </div>
            <div className="text-xl font-mono font-bold text-emerald-300 mt-1">
              {libraryScanResult.allUniqueFonts.length}
            </div>
            <div className="text-[10px] text-gray-400 mt-0.5">
              Songs, Decks & Themes
            </div>
          </div>
        </div>

        {/* 3. Live Pre-Warming Progress Bar (Active state) */}
        {isPrewarming && (
          <div className="bg-[#131722] border border-amber-500/40 rounded-md p-3 space-y-2 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                <Zap size={13} className="animate-spin text-amber-400" />
                <span>Pre-Warming & Rasterizing Glyphs: <strong>{prewarmProgress.currentFont}</strong></span>
              </span>
              <span className="font-mono text-amber-200">
                {prewarmProgress.completed} / {prewarmProgress.total} ({prewarmProgress.percent}%)
              </span>
            </div>
            <div className="w-full bg-[#202534] h-2 rounded-full overflow-hidden">
              <div 
                className="bg-gradient-to-r from-amber-500 to-amber-300 h-full transition-all duration-150 rounded-full"
                style={{ width: `${Math.max(5, prewarmProgress.percent)}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-400">
              Generating GPU glyph textures across regular, bold, and italic weights...
            </p>
          </div>
        )}
      </div>

      {/* 4. Pre-Warm Preset Suites */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        
        {/* Card 1: Curated Worship & Canva Suite */}
        <div className="bg-[#181a22] border border-[#323644] rounded-md p-3.5 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between border-b border-[#2b3040] pb-2">
              <div className="flex items-center gap-1.5 font-bold text-gray-200">
                <Sparkles size={14} className="text-amber-400" />
                <span>Curated Worship Suite</span>
              </div>
              <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/40">
                {allCuratedFontsList.length} Fonts
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Pre-warms the top Canva & worship presentation fonts (Montserrat, Bebas Neue, Poppins, Playfair Display, Cinzel, League Spartan, Outfit, etc.).
            </p>
            <div className="flex flex-wrap gap-1 mt-2.5">
              {['Bebas Neue', 'Montserrat', 'Poppins', 'Cinzel', 'Playfair Display', 'Outfit'].map((fn) => (
                <span key={fn} className="text-[9px] bg-[#12141a] border border-[#2b3040] text-gray-300 px-1.5 py-0.5 rounded font-mono">
                  {fn}
                </span>
              ))}
              <span className="text-[9px] text-gray-400 self-center">+{allCuratedFontsList.length - 6} more</span>
            </div>
          </div>

          <button
            type="button"
            disabled={isPrewarming}
            onClick={() => handlePrewarmBatch(allCuratedFontsList, 'Curated Worship')}
            className="w-full py-1.5 bg-[#272b38] hover:bg-amber-600 hover:text-black text-gray-200 rounded font-semibold border border-[#3c4254] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Flame size={13} className="text-amber-400 group-hover:text-black" />
            <span>Pre-Warm Curated Suite</span>
          </button>
        </div>

        {/* Card 2: Church Library Decks & Presentations */}
        <div className="bg-[#181a22] border border-[#323644] rounded-md p-3.5 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between border-b border-[#2b3040] pb-2">
              <div className="flex items-center gap-1.5 font-bold text-gray-200">
                <FileText size={14} className="text-cyan-400" />
                <span>Presentation Decks</span>
              </div>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/40">
                {libraryScanResult.presentationFonts.length} Fonts
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Scans all saved PPTX presentations and Canva slides in your database and pre-warms every embedded typeface.
            </p>
            <div className="text-[11px] text-gray-400 mt-2 bg-[#12141a] p-2 rounded border border-[#272b38] flex items-center justify-between">
              <span>Saved Presentations:</span>
              <strong className="text-white font-mono">{libraryPresentations.length} decks</strong>
            </div>
          </div>

          <button
            type="button"
            disabled={isPrewarming || libraryScanResult.presentationFonts.length === 0}
            onClick={() => handlePrewarmBatch(libraryScanResult.presentationFonts, 'Presentation Deck')}
            className="w-full py-1.5 bg-[#272b38] hover:bg-cyan-600 hover:text-black text-gray-200 rounded font-semibold border border-[#3c4254] flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Zap size={13} className="text-cyan-400" />
            <span>Pre-Warm Deck Fonts</span>
          </button>
        </div>

        {/* Card 3: Custom Font Pre-Warm */}
        <div className="bg-[#181a22] border border-[#323644] rounded-md p-3.5 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between border-b border-[#2b3040] pb-2">
              <div className="flex items-center gap-1.5 font-bold text-gray-200">
                <Sliders size={14} className="text-emerald-400" />
                <span>Custom Font Pre-Warm</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                Manual
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-2">
              Enter any Google Font or custom typeface name to download and pre-warm into local browser memory.
            </p>
            <div className="mt-2.5">
              <input
                type="text"
                value={customFontInput}
                onChange={(e) => setCustomFontInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handlePrewarmSingle(customFontInput);
                }}
                placeholder="e.g. Montserrat, Prata, Caveat..."
                className="w-full bg-[#12141a] border border-[#353a4b] rounded px-2.5 py-1.5 text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 text-xs font-mono"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={isPrewarming || !customFontInput.trim()}
            onClick={() => handlePrewarmSingle(customFontInput)}
            className="w-full py-1.5 bg-[#272b38] hover:bg-emerald-600 hover:text-black text-gray-200 rounded font-semibold border border-[#3c4254] flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>Pre-Warm Single Font</span>
          </button>
        </div>

      </div>

      {/* 5. Font Cache Directory & Live Visual Preview Table */}
      <div className="bg-[#181a22] border border-[#323644] rounded-md p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2b3040] pb-3">
          <div className="flex items-center gap-2">
            <Type size={16} className="text-amber-400" />
            <span className="font-bold text-gray-100 text-xs">Font Cache Directory & Glyph Previews</span>
            <span className="text-[10px] text-gray-400 font-mono">({filteredFonts.length} fonts shown)</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Pills */}
            <div className="flex items-center bg-[#12141a] rounded p-0.5 border border-[#2b3040]">
              {(
                [
                  { id: 'all', label: 'All Fonts' },
                  { id: 'prewarmed', label: 'Pre-Warmed' },
                  { id: 'cached', label: 'Cached RAM' },
                  { id: 'library', label: 'In Library' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    filterTab === tab.id
                      ? 'bg-amber-500 text-black font-bold'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-2 text-gray-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter by font name..."
                className="bg-[#12141a] border border-[#2e3342] rounded pl-7 pr-2.5 py-1 text-xs text-white placeholder-gray-500 w-44 focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>
        </div>

        {/* Live Preview Text & Font Size Slider Bar */}
        <div className="bg-[#12141a] border border-[#262936] rounded p-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <span className="text-[10px] text-gray-400 uppercase font-bold shrink-0">Sample Text:</span>
            <input
              type="text"
              value={previewSampleText}
              onChange={(e) => setPreviewSampleText(e.target.value)}
              className="flex-1 bg-[#1a1d26] border border-[#353a4b] rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-gray-400 uppercase font-bold">Size:</span>
            <input
              type="range"
              min={14}
              max={36}
              value={previewSize}
              onChange={(e) => setPreviewSize(Number(e.target.value))}
              className="w-24 accent-amber-500 cursor-pointer"
            />
            <span className="text-xs font-mono text-amber-300 w-8">{previewSize}px</span>
          </div>
        </div>

        {/* Scrollable Font Cards List */}
        <div className="max-h-80 overflow-y-auto custom-scrollbar space-y-2 pr-1">
          {filteredFonts.length === 0 ? (
            <div className="p-8 text-center text-gray-500 bg-[#12141a] rounded border border-[#262936]">
              No fonts matched your search filter "{searchFilter}".
            </div>
          ) : (
            filteredFonts.map((item) => {
              const isPrewarmed = item.isPrewarmed;
              const isCached = item.isCachedInMemory;
              const isLocal = item.isSystemLocal;

              return (
                <div
                  key={item.family}
                  className={`bg-[#14161e] border rounded-md p-3 transition-colors ${
                    isPrewarmed
                      ? 'border-amber-500/40 bg-amber-950/10'
                      : isCached
                      ? 'border-cyan-500/30'
                      : 'border-[#2a2e3d]'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-[#232734] pb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-100 text-xs font-mono">{item.family}</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.2 rounded font-mono bg-[#202432] text-gray-300 border border-[#343a4e]">
                        {item.archetype}
                      </span>
                      {item.isInLibrary && (
                        <span className="text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-700/50 px-1.5 py-0.2 rounded font-mono">
                          In Library
                        </span>
                      )}
                      {item.isCurated && (
                        <span className="text-[9px] bg-amber-950 text-amber-300 border border-amber-700/50 px-1.5 py-0.2 rounded font-mono">
                          Worship Preset
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isPrewarmed ? (
                        <span className="flex items-center gap-1 text-[10px] text-amber-300 font-semibold bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                          <Check size={11} className="text-amber-400" />
                          <span>0ms Pre-Warmed</span>
                        </span>
                      ) : isCached ? (
                        <span className="flex items-center gap-1 text-[10px] text-cyan-300 font-semibold bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded">
                          <span>In RAM Cache</span>
                        </span>
                      ) : isLocal ? (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-300 font-semibold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                          <span>System Local</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400 font-mono">
                          Not Cached
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handlePrewarmSingle(item.family)}
                        className={`px-2.5 py-0.5 rounded text-[10px] font-semibold border transition-colors cursor-pointer ${
                          isPrewarmed
                            ? 'bg-[#222736] text-gray-300 border-[#383f54] hover:border-amber-400'
                            : 'bg-amber-600 hover:bg-amber-500 text-black border-amber-500 font-bold'
                        }`}
                      >
                        {isPrewarmed ? 'Re-Prime' : 'Pre-Warm Now'}
                      </button>
                    </div>
                  </div>

                  {/* Live Render in Actual Family */}
                  <div className="pt-2">
                    <div 
                      style={{ 
                        fontFamily: `"${item.family}", sans-serif`,
                        fontSize: `${previewSize}px`,
                        lineHeight: 1.3
                      }}
                      className="text-white truncate font-medium tracking-normal"
                    >
                      {previewSampleText}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 6. Automation & Performance Preferences */}
      <div className="bg-[#181a22] border border-[#323644] rounded-md p-4 space-y-3">
        <h3 className="font-bold text-gray-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5 border-b border-[#2b3040] pb-2">
          <Sliders size={14} className="text-cyan-400" />
          <span>Performance & Auto Pre-Warming Preferences</span>
        </h3>

        <div className="space-y-2.5 pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.autoPrewarmOnStartup}
              onChange={(e) => handleUpdatePreference('autoPrewarmOnStartup', e.target.checked)}
              className="mt-0.5 rounded text-amber-500 bg-[#252a3a] border-gray-600 focus:ring-amber-500 accent-amber-500"
            />
            <div>
              <div className="font-semibold text-gray-100">Auto Pre-Warm Church Library Presentations on Startup</div>
              <div className="text-[11px] text-gray-400">
                Automatically scans all saved PPTX slides and pre-loads missing fonts into browser memory when SimpleWorship opens.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.autoPrewarmOnImport}
              onChange={(e) => handleUpdatePreference('autoPrewarmOnImport', e.target.checked)}
              className="mt-0.5 rounded text-amber-500 bg-[#252a3a] border-gray-600 focus:ring-amber-500 accent-amber-500"
            />
            <div>
              <div className="font-semibold text-gray-100">Auto Pre-Warm Fonts on PPTX / Canva Presentation Import</div>
              <div className="text-[11px] text-gray-400">
                Immediately compiles and registers all slide fonts when importing new presentation files.
              </div>
            </div>
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.prewarmCuratedSuiteOnStartup}
              onChange={(e) => handleUpdatePreference('prewarmCuratedSuiteOnStartup', e.target.checked)}
              className="mt-0.5 rounded text-amber-500 bg-[#252a3a] border-gray-600 focus:ring-amber-500 accent-amber-500"
            />
            <div>
              <div className="font-semibold text-gray-100">Pre-Warm Curated Canva & Worship Font Suite on Startup</div>
              <div className="text-[11px] text-gray-400">
                Pre-fetches the complete Canva font set (30+ fonts) in the background on startup.
              </div>
            </div>
          </label>
        </div>

        {/* Informational Guidance Box */}
        <div className="bg-[#131722] border border-cyan-800/40 rounded p-3 flex items-start gap-2 text-cyan-200 text-[11px] mt-2">
          <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
          <p>
            <strong>Why pre-warming matters:</strong> When going live on projectors or stage foldback monitors during worship, on-demand font fetching can cause a 100–300ms text reflow or Flash of Unstyled Text (FOUT). Pre-warming forces the browser to download and pre-render font glyphs into GPU memory in advance, ensuring instant, seamless slide transitions.
          </p>
        </div>
      </div>

    </div>
  );
}
