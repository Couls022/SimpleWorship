import React, { useState, useEffect } from 'react';
import { 
  Type, 
  Download, 
  RefreshCw, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Zap, 
  WifiOff, 
  Globe, 
  Clock, 
  Sliders, 
  Eye, 
  Layers,
  ArrowRight,
  Sparkles,
  Search,
  Plus,
  X
} from 'lucide-react';
import { 
  getFontSimulationConfig, 
  setFontSimulationConfig, 
  getFontDebugLogs, 
  clearFontDebugLogs, 
  purgeFontCacheAndDomLinks, 
  testFontPipeline, 
  calculateAutoFitTextScale,
  CANVA_FONT_ARCHETYPES,
  FontSimulationConfig,
  FontDebugLogEntry,
  FontTestResult
} from '../../utils/pptxFontManager';

const QUICK_TEST_PRESETS = [
  { name: 'Bebas Neue', archetype: 'Condensed Display', origin: 'Canva / Presentation' },
  { name: 'Montserrat', archetype: 'Geometric Sans', origin: 'Canva / Modern Clean' },
  { name: 'League Spartan', archetype: 'Geometric Sans', origin: 'Canva Titles' },
  { name: 'Canva Sans', archetype: 'Modern Sans', origin: 'Canva Default' },
  { name: 'Playfair Display', archetype: 'Editorial Serif', origin: 'Luxury / Classic' },
  { name: 'Cinzel', archetype: 'Editorial Serif', origin: 'Worship / Elegant' },
  { name: 'Caveat', archetype: 'Handwritten Script', origin: 'Script / Quotes' },
  { name: 'Outfit', archetype: 'Geometric Sans', origin: 'Modern Slides' },
  { name: 'Prata', archetype: 'Editorial Serif', origin: 'Canva Fashion' },
  { name: 'Syne', archetype: 'Geometric Sans', origin: 'Modern Display' },
  { name: 'Anton', archetype: 'Condensed Impact', origin: 'Bold Posters' },
  { name: 'Dancing Script', archetype: 'Cursive Script', origin: 'Inspirational' },
];

export const FontSimulationDevPanel: React.FC = () => {
  const [config, setConfig] = useState<FontSimulationConfig>(getFontSimulationConfig());
  const [logs, setLogs] = useState<FontDebugLogEntry[]>(getFontDebugLogs());
  const [selectedFont, setSelectedFont] = useState<string>('Bebas Neue');
  const [customFontInput, setCustomFontInput] = useState<string>('');
  const [specificFontInput, setSpecificFontInput] = useState<string>('');
  const [isRunningTest, setIsRunningTest] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<FontTestResult | null>(null);
  const [sampleText, setSampleText] = useState<string>('HOLY, HOLY, HOLY • LORD GOD ALMIGHTY\nWho Was And Is And Is To Come');
  const [sampleFontSize, setSampleFontSize] = useState<number>(44);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Sync state with global events
  useEffect(() => {
    const handleLog = (e: any) => {
      if (e.detail) {
        setLogs((prev) => [e.detail, ...prev.slice(0, 99)]);
      } else {
        setLogs(getFontDebugLogs());
      }
    };

    const handleCleared = () => {
      setLogs([]);
    };

    const handleConfigChanged = (e: any) => {
      if (e.detail) {
        setConfig(e.detail);
      }
    };

    window.addEventListener('simpleworship:font-debug-logged', handleLog);
    window.addEventListener('simpleworship:font-debug-cleared', handleCleared);
    window.addEventListener('simpleworship:font-simulation-changed', handleConfigChanged);

    return () => {
      window.removeEventListener('simpleworship:font-debug-logged', handleLog);
      window.removeEventListener('simpleworship:font-debug-cleared', handleCleared);
      window.removeEventListener('simpleworship:font-simulation-changed', handleConfigChanged);
    };
  }, []);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const handleToggleSimulation = (enabled: boolean) => {
    const updated = setFontSimulationConfig({ enabled });
    setConfig(updated);
    showNotice(enabled ? '✓ Developer Font Simulation ENABLED' : 'Font Simulation Disabled');
  };

  const handleToggleAllNonUniversal = (simulateAll: boolean) => {
    const updated = setFontSimulationConfig({ 
      enabled: true, 
      simulateAllNonUniversalMissing: simulateAll 
    });
    setConfig(updated);
    showNotice(simulateAll ? '✓ Forcing ALL non-system fonts to simulate as MISSING on PC' : 'Non-universal missing simulation turned off');
  };

  const handleToggleOfflineFallback = (simulateOffline: boolean) => {
    const updated = setFontSimulationConfig({ 
      enabled: true, 
      simulateOfflineFallback: simulateOffline 
    });
    setConfig(updated);
    showNotice(simulateOffline ? '✓ Offline Mode Active: Downloads blocked to test fallback font stacks' : 'Offline simulation turned off');
  };

  const handleSetLatency = (delayMs: number) => {
    const updated = setFontSimulationConfig({ 
      enabled: true, 
      simulatedDownloadDelayMs: delayMs 
    });
    setConfig(updated);
    showNotice(`✓ Simulated network latency set to ${delayMs}ms`);
  };

  const handleAddSpecificMissingFont = (fontName: string) => {
    const trimmed = fontName.trim();
    if (!trimmed) return;
    if (config.simulatedMissingFonts.some(f => f.toLowerCase() === trimmed.toLowerCase())) return;

    const updatedList = [...config.simulatedMissingFonts, trimmed];
    const updated = setFontSimulationConfig({ 
      enabled: true, 
      simulatedMissingFonts: updatedList 
    });
    setConfig(updated);
    setSpecificFontInput('');
    showNotice(`✓ Added "${trimmed}" to simulated missing font list`);
  };

  const handleRemoveSpecificMissingFont = (fontName: string) => {
    const updatedList = config.simulatedMissingFonts.filter(f => f.toLowerCase() !== fontName.toLowerCase());
    const updated = setFontSimulationConfig({ simulatedMissingFonts: updatedList });
    setConfig(updated);
  };

  const handlePurgeCache = () => {
    const res = purgeFontCacheAndDomLinks();
    setTestResult(null);
    showNotice(`✓ Purged ${res.clearedCacheCount} cache entries & removed ${res.removedLinksCount} DOM <link> stylesheets`);
  };

  const handleRunTest = async (fontName: string) => {
    setIsRunningTest(true);
    try {
      const res = await testFontPipeline(fontName);
      setTestResult(res);
      setSelectedFont(fontName);
      showNotice(`✓ Completed font pipeline test for "${fontName}" (${res.durationMs}ms)`);
    } catch (e: any) {
      showNotice(`Failed to test font pipeline: ${e?.message || e}`);
    } finally {
      setIsRunningTest(false);
    }
  };

  // Calculate live auto-fit scale
  const autoFitScale = calculateAutoFitTextScale({
    text: sampleText,
    boxWidth: 700,
    boxHeight: 180,
    fontSize: sampleFontSize,
    fontFamily: selectedFont,
    padding: 12,
  });

  return (
    <div className="space-y-6">
      {/* Header & Status Banner */}
      <div className={`p-4 rounded-xl border transition-all ${
        config.enabled
          ? 'bg-amber-950/40 border-amber-500/50 shadow-lg shadow-amber-950/30'
          : 'bg-[#14161c] border-[#2b303e]'
      }`}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-md ${
              config.enabled ? 'bg-gradient-to-tr from-amber-600 to-orange-500 animate-pulse' : 'bg-[#252a36] text-gray-400'
            }`}>
              <Sliders size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white">Developer Mode: Auto-Adapt Font & Missing Font Simulator</h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  config.enabled 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                    : 'bg-gray-800 text-gray-400 border border-gray-700'
                }`}>
                  {config.enabled ? 'Simulation Mode ACTIVE' : 'Standard Production Mode'}
                </span>
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Simulate presentation PCs with zero custom fonts to verify background Google Fonts downloading and archetype fallback stacks.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleToggleSimulation(!config.enabled)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1.5 ${
                config.enabled
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/40'
                  : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-900/40'
              }`}
            >
              <Zap size={13} />
              <span>{config.enabled ? 'Disable Simulation' : 'Enable Dev Simulation'}</span>
            </button>
            <button
              onClick={handlePurgeCache}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#222734] hover:bg-rose-950/60 hover:text-rose-300 text-gray-300 border border-[#343b4d] hover:border-rose-700/50 transition-all flex items-center gap-1.5"
              title="Purge all loaded web fonts from memory and DOM <link> tags"
            >
              <Trash2 size={13} />
              <span>Purge Font Cache</span>
            </button>
          </div>
        </div>

        {actionNotice && (
          <div className="mt-3 py-1.5 px-3 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in duration-150">
            <CheckCircle2 size={13} />
            <span>{actionNotice}</span>
          </div>
        )}
      </div>

      {/* Control Switches Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Toggle 1: Force All Custom Fonts Missing */}
        <div className={`p-3.5 rounded-xl border transition-all ${
          config.simulateAllNonUniversalMissing && config.enabled
            ? 'bg-purple-950/40 border-purple-500/50'
            : 'bg-[#14161c] border-[#2b303e]'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-bold text-white text-xs">
              <Type size={14} className="text-purple-400" />
              <span>Force Missing (All Custom)</span>
            </div>
            <input
              type="checkbox"
              checked={config.simulateAllNonUniversalMissing && config.enabled}
              onChange={(e) => handleToggleAllNonUniversal(e.target.checked)}
              className="accent-purple-500 w-4 h-4 cursor-pointer"
            />
          </div>
          <p className="text-[11px] text-gray-400">
            Treats the PC as having <strong className="text-purple-300">0 non-standard fonts</strong>. Every Canva/PowerPoint font will trigger an auto-download test.
          </p>
        </div>

        {/* Toggle 2: Simulate Offline Fallback Mode */}
        <div className={`p-3.5 rounded-xl border transition-all ${
          config.simulateOfflineFallback && config.enabled
            ? 'bg-rose-950/40 border-rose-500/50'
            : 'bg-[#14161c] border-[#2b303e]'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-bold text-white text-xs">
              <WifiOff size={14} className="text-rose-400" />
              <span>Simulate Offline PC</span>
            </div>
            <input
              type="checkbox"
              checked={config.simulateOfflineFallback && config.enabled}
              onChange={(e) => handleToggleOfflineFallback(e.target.checked)}
              className="accent-rose-500 w-4 h-4 cursor-pointer"
            />
          </div>
          <p className="text-[11px] text-gray-400">
            Blocks all web font downloads. Allows testing <strong className="text-rose-300">metric archetype fallback stacks</strong> & text containment without internet.
          </p>
        </div>

        {/* Toggle 3: Simulated Download Latency */}
        <div className="p-3.5 rounded-xl bg-[#14161c] border border-[#2b303e]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 font-bold text-white text-xs">
              <Clock size={14} className="text-cyan-400" />
              <span>Simulated Latency</span>
            </div>
            <span className="text-[10px] font-mono text-cyan-300 font-bold">
              {config.simulatedDownloadDelayMs}ms
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {[
              { label: '0ms', value: 0 },
              { label: '500ms', value: 500 },
              { label: '1.5s', value: 1500 },
              { label: '3.0s', value: 3000 },
            ].map((item) => (
              <button
                key={item.value}
                onClick={() => handleSetLatency(item.value)}
                className={`py-1 rounded text-[10px] font-semibold border transition-all ${
                  config.simulatedDownloadDelayMs === item.value && config.enabled
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500 font-bold'
                    : 'bg-[#1e2330] text-gray-400 border-transparent hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Selective Missing Font List */}
      <div className="p-4 rounded-xl bg-[#14161c] border border-[#2b303e] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Layers size={14} className="text-amber-400" />
            <span>Selective Missing Font Rules ({config.simulatedMissingFonts.length})</span>
          </div>
          <span className="text-[11px] text-gray-400">Force specific fonts to simulate missing without affecting others</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="e.g. League Spartan, Montserrat, Anton..."
              value={specificFontInput}
              onChange={(e) => setSpecificFontInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddSpecificMissingFont(specificFontInput);
              }}
              className="w-full bg-[#1b1f2b] border border-[#31384a] rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            onClick={() => handleAddSpecificMissingFont(specificFontInput)}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors flex items-center gap-1"
          >
            <Plus size={13} />
            <span>Add Rule</span>
          </button>
        </div>

        {config.simulatedMissingFonts.length > 0 ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {config.simulatedMissingFonts.map((font) => (
              <span
                key={font}
                className="px-2.5 py-1 rounded-md bg-amber-950/80 border border-amber-700/60 text-amber-200 text-xs flex items-center gap-1.5 shadow-sm"
              >
                <span>{font}</span>
                <button
                  onClick={() => handleRemoveSpecificMissingFont(font)}
                  className="p-0.5 hover:text-white rounded hover:bg-amber-800/60 transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <div className="text-[11px] text-gray-500 italic">
            No selective missing font rules. (Turn on "Force Missing All Custom" above or add font names here).
          </div>
        )}
      </div>

      {/* Interactive Font Pipeline Sandbox */}
      <div className="p-5 rounded-xl bg-[#14161c] border border-[#2b303e] space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#242938] pb-3">
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <Sparkles size={14} className="text-cyan-400" />
              <span>Interactive Font Testing Sandbox</span>
            </h4>
            <p className="text-[11px] text-gray-400">
              Select a Canva preset or test any custom font to observe real-time detection, download, and archetype fallback.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Custom font name..."
              value={customFontInput}
              onChange={(e) => setCustomFontInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customFontInput) handleRunTest(customFontInput);
              }}
              className="bg-[#1b1f2b] border border-[#31384a] rounded-lg px-2.5 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 w-36"
            />
            <button
              onClick={() => customFontInput && handleRunTest(customFontInput)}
              disabled={!customFontInput || isRunningTest}
              className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold disabled:opacity-50 transition-colors"
            >
              Test
            </button>
          </div>
        </div>

        {/* Quick Presets */}
        <div>
          <div className="text-[11px] font-semibold text-gray-400 mb-2">Canva & Presentation Font Presets:</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {QUICK_TEST_PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => handleRunTest(p.name)}
                disabled={isRunningTest}
                className={`p-2 rounded-lg border text-left transition-all ${
                  selectedFont.toLowerCase() === p.name.toLowerCase()
                    ? 'bg-cyan-950/60 border-cyan-400/80 text-cyan-200'
                    : 'bg-[#1b1f2a] border-[#293040] hover:border-gray-500 text-gray-300 hover:text-white'
                }`}
              >
                <div className="font-bold text-xs truncate">{p.name}</div>
                <div className="text-[10px] text-gray-400 truncate">{p.archetype}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Test Result Inspector Card */}
        {testResult && (
          <div className="p-4 rounded-xl bg-[#181c26] border border-cyan-500/40 space-y-3 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2b3346] pb-2.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">Target: "{testResult.fontName}"</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/50">
                  {testResult.normalized.archetype}
                </span>
                {testResult.isUniversalSystemFont && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-300">
                    Universal OS Font
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="text-gray-400">Duration:</span>
                <span className="text-emerald-400 font-bold">{testResult.durationMs}ms</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-[#12141a] border border-[#272d3e]">
                <div className="text-gray-400 text-[10px] mb-0.5">Physical PC Probe</div>
                <div className={`font-bold ${testResult.isLocallyInstalledReal ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {testResult.isLocallyInstalledReal ? 'Installed on PC' : 'Not on PC (Missing)'}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#12141a] border border-[#272d3e]">
                <div className="text-gray-400 text-[10px] mb-0.5">Effective Pipeline State</div>
                <div className={`font-bold ${testResult.isLocallyInstalledEffective ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {testResult.simulationApplied 
                    ? 'Simulated MISSING (Dev Mode)' 
                    : (testResult.isLocallyInstalledEffective ? 'Local Available' : 'Missing -> Download')}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#12141a] border border-[#272d3e]">
                <div className="text-gray-400 text-[10px] mb-0.5">Web Font Download</div>
                <div className={`font-bold ${
                  testResult.downloadSuccess ? 'text-emerald-400' : (testResult.downloadAttempted ? 'text-rose-400' : 'text-gray-400')
                }`}>
                  {testResult.downloadSuccess ? 'Downloaded & Active' : (testResult.downloadAttempted ? 'Download Blocked / Failed' : 'Skipped (Local)')}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#12141a] border border-[#272d3e]">
                <div className="text-gray-400 text-[10px] mb-0.5">Fallback Resolution</div>
                <div className={`font-bold ${testResult.fallbackUsed ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {testResult.fallbackUsed ? 'Archetype Stack Applied' : 'Native Web Typeface'}
                </div>
              </div>
            </div>

            {testResult.apiUrl && (
              <div className="p-2 rounded bg-[#101217] border border-[#222736] text-[11px] font-mono text-cyan-300 truncate">
                <span className="text-gray-500 mr-2">Google Fonts API URL:</span>
                <span>{testResult.apiUrl}</span>
              </div>
            )}
          </div>
        )}

        {/* Live Visual Canvas Preview */}
        <div className="p-4 rounded-xl bg-[#0e1015] border border-[#252b3a] space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-200">
              <Eye size={14} className="text-emerald-400" />
              <span>Live Visual Output Preview</span>
              <span className="text-gray-500 font-normal">({selectedFont})</span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-400">Font Size:</span>
                <input
                  type="range"
                  min="24"
                  max="84"
                  value={sampleFontSize}
                  onChange={(e) => setSampleFontSize(Number(e.target.value))}
                  className="w-24 accent-cyan-400 cursor-pointer"
                />
                <span className="font-mono text-cyan-300 text-[11px] w-8">{sampleFontSize}px</span>
              </div>
              <div className="px-2 py-0.5 rounded bg-[#1b202c] border border-[#2e374c] text-[10px] text-gray-300">
                Auto-Fit: <strong className="text-emerald-400">{(autoFitScale * 100).toFixed(0)}%</strong>
              </div>
            </div>
          </div>

          <div 
            className="w-full min-h-[160px] p-6 rounded-lg bg-[#141822] border border-[#2a3142] flex flex-col justify-center items-center text-center shadow-inner relative overflow-hidden"
          >
            <div 
              style={{
                fontFamily: `"${selectedFont}", sans-serif`,
                fontSize: `${sampleFontSize * autoFitScale}px`,
                lineHeight: 1.2,
                letterSpacing: selectedFont.toLowerCase().includes('bebas') ? '0.05em' : 'normal',
                textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                whiteSpace: 'pre-line',
                wordBreak: 'normal',
                overflowWrap: 'break-word',
              }}
              className="text-white font-bold transition-all max-w-full"
            >
              {sampleText}
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Font Engine Event Audit Log */}
      <div className="p-4 rounded-xl bg-[#14161c] border border-[#2b303e] space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Clock size={14} className="text-cyan-400" />
            <span>Real-Time Font Event & Intercept Audit Log ({logs.length})</span>
          </div>

          <button
            onClick={() => {
              clearFontDebugLogs();
              setLogs([]);
              showNotice('Audit log cleared');
            }}
            className="px-2.5 py-1 rounded bg-[#202532] hover:bg-rose-900/40 text-gray-400 hover:text-rose-300 text-[11px] transition-colors"
          >
            Clear Log
          </button>
        </div>

        <div className="h-48 overflow-y-auto custom-scrollbar rounded-lg bg-[#0e1015] border border-[#222736] p-2 space-y-1.5 font-mono text-[11px]">
          {logs.length > 0 ? (
            logs.map((log) => (
              <div 
                key={log.id} 
                className={`p-1.5 rounded flex items-start justify-between gap-2 ${
                  log.type === 'probe-simulated-missing' 
                    ? 'bg-amber-950/40 text-amber-300 border border-amber-800/40' 
                    : log.type === 'download-success'
                    ? 'bg-emerald-950/30 text-emerald-300'
                    : log.type === 'download-failed'
                    ? 'bg-rose-950/40 text-rose-300 border border-rose-800/40'
                    : 'bg-[#151922] text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="text-gray-500 text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                    log.type.startsWith('download') ? 'bg-cyan-900/60 text-cyan-300' : 'bg-gray-800 text-gray-400'
                  }`}>
                    {log.type}
                  </span>
                  <span className="truncate">{log.message}</span>
                </div>
                <span className="text-gray-500 text-[10px] shrink-0">{log.fontFamily}</span>
              </div>
            ))
          ) : (
            <div className="h-full flex items-center justify-center text-gray-600 text-xs italic">
              No font engine events logged yet. Trigger a font test or open a presentation to generate events.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FontSimulationDevPanel;
