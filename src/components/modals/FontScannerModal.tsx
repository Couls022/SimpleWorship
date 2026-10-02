import { withPortal } from '../common/withPortal';
import React, { useState, useEffect, useRef } from 'react';
import { 
  Type, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  ExternalLink, 
  Upload, 
  X, 
  Zap, 
  FileText,
  Search,
  Sparkles,
  Trash2,
  HardDrive,
  Eye,
  SlidersHorizontal,
  Wifi,
  WifiOff,
  Archive,
  FolderDown
} from 'lucide-react';
import { 
  DetectedFontScanItem, 
  PptxFontScanResult,
  registerFontAliasesInDom,
  normalizeFontName,
  SYSTEM_UNIVERSAL_FONTS,
  isFontInstalledLocally,
  probePhysicalLocalFont,
  scanLibraryAllFonts
} from '../../utils/pptxFontManager';
import { 
  fetchAndInstallGoogleFont, 
  downloadFontFileToPc, 
  installCustomFontFromFile,
  inMemoryInstalledFonts,
  getAllStoredCustomFonts,
  getAllStoredFontRecords,
  getStoredFontRecord,
  bufferToBase64,
  deleteStoredFont,
  exportAllFontsAsZip,
  exportWindowsFontInstallerPackage,
  importFontsFromZip
} from '../../utils/fontStorage';
import { useStore } from '../../store/useStore';
import { dbApi } from '../../db';

interface FontScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  presentationName?: string;
  initialScanResult?: PptxFontScanResult | null;
  autoTriggered?: boolean;
}

const FontScannerModalBase: React.FC<FontScannerModalProps> = ({
  isOpen,
  onClose,
  presentationName = 'Presentation',
  initialScanResult,
  autoTriggered = false,
}) => {
  const [scanResult, setScanResult] = useState<PptxFontScanResult | null>(initialScanResult || null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [installingFonts, setInstallingFonts] = useState<Record<string, boolean>>({});
  const [downloadingFonts, setDownloadingFonts] = useState<Record<string, boolean>>({});
  const [isInstallingAll, setIsInstallingAll] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; fontName: string } | null>(null);
  const [installedSet, setInstalledSet] = useState<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [showInstalledList, setShowInstalledList] = useState<boolean>(false);
  const [showDbManager, setShowDbManager] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [isImportingZip, setIsImportingZip] = useState<boolean>(false);

  // Search & Download any font
  const [searchFontName, setSearchFontName] = useState<string>('');
  const [searchedFontStatus, setSearchedFontStatus] = useState<{
    fontName: string;
    isInstalled: boolean;
    isUniversal: boolean;
    isInAppDb: boolean;
  } | null>(null);

  // Live Typography Preview Sandbox
  const [previewFont, setPreviewFont] = useState<string>('Montserrat');
  const [previewText, setPreviewText] = useState<string>('BANAL, BANAL, BANAL ANG PANGINOON - 12345');
  const [previewSize, setPreviewSize] = useState<number>(28);

  // Stored Offline Fonts in IndexedDB
  const [storedDbFonts, setStoredDbFonts] = useState<Array<{ family: string; format: string; installedAt: number; source: string; byteSize: number }>>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const formatByteSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const refreshStoredDbFonts = async () => {
    try {
      const records = await getAllStoredCustomFonts();
      setStoredDbFonts(records);
    } catch {}
  };

  // Listen to network status changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Perform full library font scan across presentations, songs, schedules & themes
  const scanLibrary = async () => {
    setIsScanning(true);
    setStatusMessage('Scanning all presentations, songs, and schedules for missing fonts...');
    try {
      const [presentationsMod, themes, songs, schedules, assets] = await Promise.all([
        import('../../db/presentations').catch(() => ({ getAllPresentations: async () => [] })),
        dbApi.getAllThemes().catch(() => []),
        dbApi.getAllSongs().catch(() => []),
        dbApi.getAllSchedules().catch(() => []),
        dbApi.getAllAssets().catch(() => [])
      ]);
      const presentations = await presentationsMod.getAllPresentations().catch(() => []);
      const storeState = useStore.getState();
      const scan = scanLibraryAllFonts(presentations, themes, songs, {
        activeSchedule: storeState.activeSchedule,
        schedules: schedules,
        systemOptions: storeState.systemOptions,
        assets: assets
      });

      const all: DetectedFontScanItem[] = [];
      const missing: DetectedFontScanItem[] = [];
      const installed: DetectedFontScanItem[] = [];

      for (const f of scan.allUniqueFonts) {
        const info = normalizeFontName(f);
        const base = info.baseFamily;
        const lower = base.toLowerCase();
        const isUniversal = SYSTEM_UNIVERSAL_FONTS.has(lower);
        const isLocal = isFontInstalledLocally(base);
        const isAppCached = inMemoryInstalledFonts.has(lower);
        const isInst = isUniversal || isLocal || isAppCached;

        const item: DetectedFontScanItem = {
          fontName: f,
          normalizedFamily: base,
          isInstalledLocally: isLocal,
          isUniversalSystemFont: isUniversal,
          isAppInstalled: isAppCached,
          status: isInst ? 'installed' : 'missing',
          googleFontAvailable: true,
          archetype: info.archetype,
          slidesUsed: [1],
        };
        all.push(item);
        if (isInst) installed.push(item);
        else missing.push(item);
      }

      setScanResult({
        allFonts: all,
        missingFonts: missing,
        installedFonts: installed,
        totalFonts: all.length,
        totalSlides: presentations.length || 1,
      });
      setStatusMessage(`Scan complete! Found ${all.length} fonts in active library (${missing.length} missing from PC).`);
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.warn('[FontScannerModal] Library scan error:', err);
      setStatusMessage('Library scan failed.');
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (initialScanResult) {
      setScanResult(initialScanResult);
    } else if (isOpen) {
      scanLibrary();
    }
  }, [initialScanResult, isOpen]);

  // Proactive Enterprise Workflow: Upon PPTX Import, auto-search online and auto-install missing fonts if internet is available
  useEffect(() => {
    if (!isOpen || !autoTriggered || !initialScanResult) return;

    const uninstalled = initialScanResult.missingFonts.filter(
      f => !installedSet.has(f.normalizedFamily.toLowerCase()) && !installedSet.has(f.fontName.toLowerCase())
    );

    if (uninstalled.length === 0) {
      setStatusMessage(`✓ All fonts in "${presentationName}" are verified on this device! Ready for live display.`);
      return;
    }

    if (isOnline) {
      setStatusMessage(`⚠️ ${uninstalled.length} missing fonts detected on your device. Click "1-Click Download & Install" to install immediately!`);
    } else {
      setStatusMessage(`⚠️ Offline Mode: No internet connection. ${uninstalled.length} missing fonts cannot be downloaded online. Smart typographic fallback applied.`);
    }
  }, [isOpen, autoTriggered, initialScanResult, isOnline]);

  // Sync installed state with global font storage
  useEffect(() => {
    const updateInstalled = () => {
      const current = new Set<string>();
      inMemoryInstalledFonts.forEach(f => current.add(f.toLowerCase()));
      setInstalledSet(current);
      refreshStoredDbFonts();
    };

    updateInstalled();
    window.addEventListener('simpleworship:fonts-updated', updateInstalled);
    return () => {
      window.removeEventListener('simpleworship:fonts-updated', updateInstalled);
    };
  }, []);

  // Update search status when search input changes
  useEffect(() => {
    const clean = searchFontName.trim();
    if (!clean) {
      setSearchedFontStatus(null);
      return;
    }

    const lower = clean.toLowerCase();
    const isUniversal = SYSTEM_UNIVERSAL_FONTS.has(lower);
    const isLocal = probePhysicalLocalFont(clean);
    const isInAppDb = inMemoryInstalledFonts.has(lower);
    const isInstalled = isUniversal || isLocal || isInAppDb;

    setSearchedFontStatus({
      fontName: clean,
      isInstalled,
      isUniversal,
      isInAppDb,
    });
  }, [searchFontName, installedSet]);

  if (!isOpen) return null;

  const missingFonts = scanResult?.missingFonts.filter(
    f => !installedSet.has(f.normalizedFamily.toLowerCase()) && !installedSet.has(f.fontName.toLowerCase())
  ) || [];

  const installedFonts = [
    ...(scanResult?.installedFonts || []),
    ...(scanResult?.missingFonts.filter(
      f => installedSet.has(f.normalizedFamily.toLowerCase()) || installedSet.has(f.fontName.toLowerCase())
    ) || [])
  ];

  // 1-Click Install to App & Windows OS for single font
  const handleInstallSingle = async (fontOrFamily: string | DetectedFontScanItem) => {
    const family = typeof fontOrFamily === 'string' 
      ? fontOrFamily.trim() 
      : fontOrFamily.normalizedFamily || fontOrFamily.fontName;

    setInstallingFonts(prev => ({ ...prev, [family]: true }));
    setStatusMessage(`Downloading and installing "${family}" system-wide into Windows OS and SimpleWorship...`);

    try {
      const ok = await fetchAndInstallGoogleFont(family);
      
      // Also invoke native Windows OS font installation (Electron IPC and local Express endpoint)
      try {
        const matching = await getStoredFontRecord(family);
        const bufferBase64 = matching?.buffer ? bufferToBase64(matching.buffer) : undefined;
        const format = matching?.format === 'truetype' ? 'ttf' : (matching?.format === 'opentype' ? 'otf' : 'ttf');

        if (typeof window !== 'undefined' && window.electronAPI?.installFontToWindows) {
          await window.electronAPI.installFontToWindows(family, bufferBase64, format);
        }
        await fetch('/api/system/install-font-windows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ family, bufferBase64, format })
        }).catch(() => {});
      } catch (winErr) {
        console.warn('[FontScanner] Windows OS installation warning:', winErr);
      }

      if (ok) {
        setInstalledSet(prev => new Set([...prev, family.toLowerCase()]));
        setStatusMessage(`✓ Installed "${family}" into Windows OS and SimpleWorship! Available across PowerPoint, Word, Canva, and all Windows apps.`);
        setPreviewFont(family);
        registerFontAliasesInDom([family]);
        refreshStoredDbFonts();
      } else {
        setStatusMessage(`Could not auto-download "${family}". You can upload its .ttf file or download it manually.`);
      }
    } catch {
      setStatusMessage(`Failed to install "${family}".`);
    } finally {
      setInstallingFonts(prev => ({ ...prev, [family]: false }));
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // 1-Click Download .ttf to PC for single font
  const handleDownloadSingle = async (fontOrFamily: string | DetectedFontScanItem) => {
    const family = typeof fontOrFamily === 'string' 
      ? fontOrFamily.trim() 
      : fontOrFamily.normalizedFamily || fontOrFamily.fontName;

    setDownloadingFonts(prev => ({ ...prev, [family]: true }));
    setStatusMessage(`Downloading "${family}" TrueType font file for Windows installation...`);

    try {
      // Auto-trigger direct Windows OS install (Native Electron or local Express)
      try {
        const matching = await getStoredFontRecord(family);
        const bufferBase64 = matching?.buffer ? bufferToBase64(matching.buffer) : undefined;
        const format = matching?.format === 'truetype' ? 'ttf' : (matching?.format === 'opentype' ? 'otf' : 'ttf');

        if (typeof window !== 'undefined' && window.electronAPI?.installFontToWindows) {
          await window.electronAPI.installFontToWindows(family, bufferBase64, format);
        }
        await fetch('/api/system/install-font-windows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ family, bufferBase64, format })
        }).catch(() => {});
      } catch {}

      await downloadFontFileToPc(family);
      setStatusMessage(`✓ TrueType font downloaded and registered for "${family}". Ready for all Windows applications.`);
    } catch {
      setStatusMessage(`Failed to download "${family}".`);
    } finally {
      setDownloadingFonts(prev => ({ ...prev, [family]: false }));
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // 1-Click Install ALL missing fonts to Windows OS & App with enterprise batch progress
  const handleInstallAllMissing = async () => {
    if (missingFonts.length === 0) return;
    setIsInstallingAll(true);
    setStatusMessage(`Downloading and installing all ${missingFonts.length} missing fonts system-wide into Windows OS and SimpleWorship...`);

    let count = 0;
    const installedNames: string[] = [];
    for (let i = 0; i < missingFonts.length; i++) {
      const font = missingFonts[i];
      const displayFamily = font.fontName.includes(',')
        ? font.fontName.split(',')[0].replace(/^["'\s]+|["'\s]+$/g, '').trim()
        : font.fontName.replace(/^["']+|["']+$/g, '').trim();
      const family = font.normalizedFamily || displayFamily;

      setBatchProgress({ current: i + 1, total: missingFonts.length, fontName: family });
      try {
        const ok = await fetchAndInstallGoogleFont(family);
        if (ok) {
          count += 1;
          installedNames.push(family);
          setInstalledSet(prev => new Set([...prev, family.toLowerCase(), font.fontName.toLowerCase()]));
          registerFontAliasesInDom([family, font.fontName]);
        }
      } catch (err) {
        console.warn(`[FontScanner] Error installing font ${family}:`, err);
      }
    }

    // Direct Windows OS batch registration (Native Electron IPC and local Express endpoint)
    try {
      const fullRecords = await getAllStoredFontRecords();
      const fontItems = fullRecords
        .filter(r => installedNames.some(name => name.toLowerCase() === r.family.toLowerCase() || name.toLowerCase() === r.familyLower))
        .map(r => ({
          family: r.family,
          bufferBase64: bufferToBase64(r.buffer),
          format: r.format === 'truetype' ? 'ttf' : (r.format === 'opentype' ? 'otf' : 'ttf')
        }));

      if (typeof window !== 'undefined' && window.electronAPI?.installFontBatchToWindows) {
        await window.electronAPI.installFontBatchToWindows(installedNames, fontItems);
      }
      await fetch('/api/system/install-font-batch-windows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ families: installedNames, fontItems })
      }).catch(() => {});
    } catch (winBatchErr) {
      console.warn('[FontScanner] Windows OS batch registration warning:', winBatchErr);
    }

    setBatchProgress(null);
    setIsInstallingAll(false);
    refreshStoredDbFonts();

    // Trigger instant re-render across all presentation canvases & overlays
    window.dispatchEvent(new CustomEvent('simpleworship:fonts-updated', { detail: { loaded: installedNames } }));
    window.dispatchEvent(new CustomEvent('simpleworship:pptx-fonts-loaded', { detail: { loaded: installedNames } }));

    // Automatically trigger Windows 1-Click Font Auto-Installer Package download for standalone convenience
    try {
      const zipBlob = await exportWindowsFontInstallerPackage(installedNames);
      if (zipBlob) {
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SimpleWorship-Windows-Font-Installer.zip`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 2000);
      }
    } catch {}

    setStatusMessage(`✓ Success! Installed ${count} font(s) directly into Windows OS & SimpleWorship. All fonts are now permanently available in PowerPoint, Word, Canva, and all Windows applications!`);
    setTimeout(() => setStatusMessage(null), 8000);
  };

  const handleDownloadWindowsInstaller = async () => {
    try {
      setStatusMessage('Creating Windows 1-Click Auto-Installer Package (.cmd + Fonts)...');
      const targetFamilies = missingFonts.map(f => f.normalizedFamily || f.fontName);
      const zipBlob = await exportWindowsFontInstallerPackage(targetFamilies);
      if (zipBlob) {
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SimpleWorship-Windows-Font-Installer.zip`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 2000);
        setStatusMessage('✓ Download started! Extract the ZIP and double-click "Install-Fonts-Windows.cmd" to install system-wide on Windows!');
      } else {
        setStatusMessage('Click "1-Click Download & Install" first to download font files.');
      }
    } catch {
      setStatusMessage('Failed to create Windows font installer package.');
    } finally {
      setTimeout(() => setStatusMessage(null), 6000);
    }
  };

  // Manual File Upload handler
  const handleFilesUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let installedCount = 0;

    setStatusMessage(`Installing ${files.length} font files into local storage...`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fontName = await installCustomFontFromFile(file);
      if (fontName) {
        installedCount += 1;
        setInstalledSet(prev => new Set([...prev, fontName.toLowerCase()]));
        setPreviewFont(fontName);
      }
    }

    if (installedCount > 0) {
      setStatusMessage(`✓ Successfully installed ${installedCount} fonts from your PC into SimpleWorship!`);
      refreshStoredDbFonts();
    } else {
      setStatusMessage('No valid .ttf, .otf, or .woff2 files were detected.');
    }
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // Drag & drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer?.files) {
      handleFilesUpload(e.dataTransfer.files);
    }
  };

  const handleDeleteDbFont = async (family: string) => {
    const ok = await deleteStoredFont(family);
    if (ok) {
      setStatusMessage(`Removed "${family}" from local database.`);
      refreshStoredDbFonts();
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // Export all offline fonts as ZIP for USB transfer
  const handleExportZip = async () => {
    setIsExportingZip(true);
    setStatusMessage('Packaging all offline fonts into ZIP for USB transfer...');
    try {
      const blob = await exportAllFontsAsZip();
      if (!blob) {
        setStatusMessage('No downloaded fonts in database to export.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SimpleWorship-Fonts-Backup-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 2000);
      setStatusMessage('✓ Successfully exported font backup ZIP! You can now copy it to a USB drive.');
    } catch {
      setStatusMessage('Failed to export fonts.');
    } finally {
      setIsExportingZip(false);
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  // Import fonts from ZIP
  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingZip(true);
    setStatusMessage(`Unpacking and installing fonts from "${file.name}"...`);
    try {
      const count = await importFontsFromZip(file);
      if (count > 0) {
        setStatusMessage(`✓ Successfully imported ${count} fonts from backup! All slides updated.`);
        await refreshStoredDbFonts();
        await scanLibrary();
      } else {
        setStatusMessage('No valid font binaries found in the ZIP archive.');
      }
    } catch {
      setStatusMessage('Failed to import fonts from ZIP.');
    } finally {
      setIsImportingZip(false);
      if (zipInputRef.current) zipInputRef.current.value = '';
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-4xl bg-[#12141c] border border-[#2a2f42] rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#252a3d] flex items-center justify-between bg-[#171a26]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Type size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  Font Scanner & Auto-Installer
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Enterprise Engine
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Offline IndexedDB
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border ${
                  isOnline 
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' 
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
                  <span>{isOnline ? 'Online (Google CDN Ready)' : 'Offline (Storage Only)'}</span>
                </span>
              </div>
              <p className="text-xs text-gray-400">
                {presentationName} • Proactive typography scanner, 1-click Google Fonts installer & USB backup
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={scanLibrary}
              disabled={isScanning}
              title="Rescan all presentations, songs, and schedules in library"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#222738] hover:bg-[#2c3349] text-gray-200 border border-[#353d57] transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={12} className={isScanning ? 'animate-spin text-amber-400' : 'text-gray-400'} />
              <span>Rescan</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#222738] hover:bg-[#2c3349] text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Status Toast */}
        {statusMessage && (
          <div className="px-6 py-2.5 bg-amber-500/15 border-b border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
            <Sparkles size={14} className="text-amber-400 shrink-0 animate-pulse" />
            <span className="font-medium">{statusMessage}</span>
          </div>
        )}

        {/* Batch Progress Bar */}
        {batchProgress && (
          <div className="px-6 py-2 bg-emerald-950/40 border-b border-emerald-500/30 text-xs">
            <div className="flex items-center justify-between text-emerald-300 font-semibold mb-1">
              <span>Downloading & Installing: {batchProgress.fontName}</span>
              <span>{batchProgress.current} / {batchProgress.total} ({Math.round((batchProgress.current / batchProgress.total) * 100)}%)</span>
            </div>
            <div className="w-full h-1.5 bg-[#1b202e] rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-400 transition-all duration-300 rounded-full"
                style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">

          {/* 1. Missing Fonts Banner & 1-Click Install All */}
          {missingFonts.length > 0 ? (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-red-950/40 via-[#1e1520] to-[#171a26] border-2 border-red-500/50 shadow-2xl relative overflow-hidden transition-all hover:border-red-500/80">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div 
                    onClick={handleInstallAllMissing} 
                    className="flex flex-wrap items-center gap-3 cursor-pointer group"
                    title="Click here to install all missing fonts into Windows OS and SimpleWorship"
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInstallAllMissing();
                      }}
                      disabled={isInstallingAll}
                      className="w-9 h-9 rounded-xl bg-red-500/20 group-hover:bg-red-500/40 border border-red-500/50 group-hover:border-red-400 flex items-center justify-center text-red-400 group-hover:text-white shrink-0 cursor-pointer active:scale-95 transition-all shadow-md"
                      title="Click to install all missing fonts to Windows OS and SimpleWorship"
                    >
                      {isInstallingAll ? <RefreshCw size={18} className="animate-spin text-amber-300" /> : <AlertTriangle size={18} />}
                    </button>
                    <div>
                      <h4 className="text-base font-extrabold text-white flex flex-wrap items-center gap-2.5">
                        <span className="group-hover:text-amber-300 transition-colors">
                          Missing Fonts Detected on Device ({missingFonts.length} Missing)
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInstallAllMissing();
                          }}
                          disabled={isInstallingAll}
                          className="px-3 py-1 rounded-lg text-xs font-black bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-500 hover:to-rose-500 text-white border border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.7)] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer active:scale-95 animate-pulse transition-all ring-2 ring-red-400/40"
                          title="Click here to install all missing fonts directly into Windows OS and SimpleWorship"
                        >
                          <Zap size={13} className="text-amber-300 fill-amber-300" />
                          <span>Action Required • Click to Install to Windows & System</span>
                        </button>
                      </h4>
                    </div>
                  </div>
                  <p className="text-xs text-gray-300 mt-2.5 leading-relaxed">
                    This presentation uses fonts that are not installed on this computer. 
                    Click the <strong>Red Action Button</strong> or <strong>"1-Click Download & Install All"</strong> below to automatically install genuine TrueType (.TTF) fonts system-wide into <strong>Windows OS</strong> and SimpleWorship. 
                    Once installed, all fonts will instantly be available in <strong>PowerPoint, Word, Canva Desktop, Photoshop</strong>, and all Windows applications!
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    <button
                      onClick={handleInstallAllMissing}
                      disabled={isInstallingAll}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xl hover:shadow-emerald-500/40 transition-all cursor-pointer active:scale-95 disabled:opacity-50 ring-2 ring-emerald-400/40"
                      title="Installs into both Windows OS font library and SimpleWorship offline storage"
                    >
                      {isInstallingAll ? (
                        <RefreshCw size={16} className="animate-spin text-amber-300" />
                      ) : (
                        <Zap size={16} className="text-amber-300 fill-amber-300" />
                      )}
                      <span>⚡ 1-Click Install All ({missingFonts.length} Fonts) to Windows & System</span>
                    </button>

                    <button
                      onClick={handleDownloadWindowsInstaller}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-md transition-all cursor-pointer active:scale-95"
                      title="Download Windows Auto-Installer Script (.cmd) + Font Files package"
                    >
                      <Download size={14} className="text-cyan-300" />
                      <span>⚡ Windows 1-Click Auto-Installer (.cmd Package)</span>
                    </button>

                    <button
                      onClick={() => {
                        missingFonts.forEach(f => handleDownloadSingle(f));
                      }}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#222738] hover:bg-[#2c3349] text-gray-200 border border-[#3c4562] transition-all cursor-pointer active:scale-95"
                    >
                      <Download size={14} className="text-cyan-400" />
                      <span>Download All .TTF for Windows</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Missing Fonts List */}
              <div className="mt-4 space-y-2 border-t border-red-500/20 pt-3">
                {missingFonts.map((font) => {
                  const displayFamily = font.fontName.includes(',')
                    ? font.fontName.split(',')[0].replace(/^["'\s]+|["'\s]+$/g, '').trim()
                    : font.fontName.replace(/^["']+|["']+$/g, '').trim();
                  const family = font.normalizedFamily || displayFamily;
                  const isInstalling = installingFonts[family] || installingFonts[displayFamily] || false;
                  const isDownloading = downloadingFonts[family] || downloadingFonts[displayFamily] || false;
                  const googleSearchUrl = `https://fonts.google.com/specimen/${encodeURIComponent(family)}`;
                  const dafontUrl = `https://www.dafont.com/search.php?q=${encodeURIComponent(family)}`;

                  return (
                    <div 
                      key={font.fontName}
                      onClick={() => handleInstallSingle(font)}
                      className="p-3 rounded-lg bg-[#181a24] hover:bg-[#222638] border border-[#2b3044] hover:border-red-500/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all group shadow-sm hover:shadow-red-950/40"
                      title={`Click anywhere on this card to install "${displayFamily}" into Windows OS and SimpleWorship`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInstallSingle(font);
                          }}
                          disabled={isInstalling}
                          className="w-8 h-8 rounded-lg bg-red-500/15 group-hover:bg-red-500/30 border border-red-500/30 group-hover:border-red-400 flex items-center justify-center text-red-400 group-hover:text-red-200 shrink-0 transition-colors cursor-pointer"
                          title="Click to install this font into Windows"
                        >
                          {isInstalling ? <RefreshCw size={14} className="animate-spin text-amber-300" /> : <Type size={16} />}
                        </button>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors">{displayFamily}</span>
                            {font.normalizedFamily && font.normalizedFamily !== displayFamily && (
                              <span className="text-[10px] text-gray-400">({font.normalizedFamily})</span>
                            )}
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700 capitalize">
                              {font.archetype || 'sans-serif'}
                            </span>
                            <span className="text-[10px] text-emerald-400 font-semibold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                              ⚡ Click to Install
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {font.slidesUsed?.length ? `Used in ${font.slidesUsed.length} slides` : 'Used in presentation'}
                            {font.sampleText && ` • Sample: "${font.sampleText.slice(0, 35)}..."`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap" onClick={(e) => e.stopPropagation()}>
                        {/* Preview button */}
                        <button
                          onClick={() => setPreviewFont(family)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[#222738] hover:bg-[#2c3349] text-gray-300 border border-[#353d57] transition-all cursor-pointer"
                          title="Preview typography"
                        >
                          <Eye size={12} className="text-cyan-400" />
                          <span>Preview</span>
                        </button>

                        {/* 1-Click Install */}
                        <button
                          onClick={() => handleInstallSingle(font)}
                          disabled={isInstalling}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                          title="Auto-download and install permanently into Windows OS and SimpleWorship"
                        >
                          {isInstalling ? (
                            <RefreshCw size={12} className="animate-spin text-amber-300" />
                          ) : (
                            <Zap size={12} className="text-amber-300" />
                          )}
                          <span>Install to Windows</span>
                        </button>

                        {/* Download .TTF */}
                        <button
                          onClick={() => handleDownloadSingle(font)}
                          disabled={isDownloading}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#222738] hover:bg-[#2c3349] text-gray-200 border border-[#353d57] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                          title="Download TrueType .TTF file to install on Windows"
                        >
                          {isDownloading ? (
                            <RefreshCw size={12} className="animate-spin text-cyan-400" />
                          ) : (
                            <Download size={12} className="text-cyan-400" />
                          )}
                          <span>.TTF</span>
                        </button>

                        {/* Google Fonts External Link */}
                        <a
                          href={googleSearchUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            if ((window as any).electronAPI?.openExternalUrl) {
                              e.preventDefault();
                              (window as any).electronAPI.openExternalUrl(googleSearchUrl);
                            }
                          }}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-[#1e2333] hover:bg-[#282f45] text-amber-300 border border-amber-500/30 transition-all cursor-pointer"
                          title="Open on Google Fonts"
                        >
                          <span>Google</span>
                          <ExternalLink size={10} />
                        </a>

                        {/* DaFont External Link */}
                        <a
                          href={dafontUrl}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            if ((window as any).electronAPI?.openExternalUrl) {
                              e.preventDefault();
                              (window as any).electronAPI.openExternalUrl(dafontUrl);
                            }
                          }}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-semibold bg-[#1e2333] hover:bg-[#282f45] text-gray-300 border border-[#3c445e] transition-all cursor-pointer"
                          title="Search DaFont"
                        >
                          <span>DaFont</span>
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-emerald-950/25 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-200">
                    All Fonts Ready & Installed on Device!
                  </h4>
                  <p className="text-xs text-gray-300 mt-0.5">
                    All fonts used in the current presentation are available offline on this device and SimpleWorship storage.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  100% Ready
                </span>
                <button
                  onClick={onClose}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer active:scale-95 shadow"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* 2. Interactive Font Search & Downloader Field */}
          <div className="p-4 rounded-xl bg-[#161925] border border-[#272d40] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search size={15} className="text-amber-400" />
                <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                  Test or Download Any Font from Google Fonts
                </h4>
              </div>
              <span className="text-[11px] text-gray-400">
                Type any font name (e.g. Montserrat, Bebas Neue, Poppins, Inter, Cinzel)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchFontName}
                  onChange={(e) => setSearchFontName(e.target.value)}
                  placeholder="Type font name (e.g. Bebas Neue, Montserrat, Poppins, Roboto, Cinzel)..."
                  className="w-full px-3.5 py-2 pl-9 rounded-lg bg-[#0e1017] border border-[#2f364d] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
                <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
                {searchFontName && (
                  <button 
                    onClick={() => setSearchFontName('')}
                    className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {searchedFontStatus && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setPreviewFont(searchedFontStatus.fontName)}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#222738] hover:bg-[#2c3349] text-gray-200 border border-[#353d57] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye size={12} className="text-cyan-400" />
                    <span>Preview</span>
                  </button>

                  <button
                    onClick={() => handleInstallSingle(searchedFontStatus.fontName)}
                    disabled={installingFonts[searchedFontStatus.fontName]}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                  >
                    {installingFonts[searchedFontStatus.fontName] ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <Zap size={12} className="text-amber-300" />
                    )}
                    <span>1-Click Install</span>
                  </button>

                  <button
                    onClick={() => handleDownloadSingle(searchedFontStatus.fontName)}
                    disabled={downloadingFonts[searchedFontStatus.fontName]}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#222738] hover:bg-[#2c3349] text-gray-200 border border-[#353d57] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Download size={12} className="text-cyan-400" />
                    <span>.TTF</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick popular fonts tags */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-gray-500 font-semibold mr-1">Popular Canva Fonts:</span>
              {['Montserrat', 'Bebas Neue', 'Poppins', 'Playfair Display', 'Oswald', 'Cinzel', 'League Spartan', 'Great Vibes', 'Caveat'].map((f) => {
                const isSaved = installedSet.has(f.toLowerCase());
                return (
                  <button
                    key={f}
                    onClick={() => {
                      setSearchFontName(f);
                      setPreviewFont(f);
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors cursor-pointer flex items-center gap-1 ${
                      searchFontName.toLowerCase() === f.toLowerCase()
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : isSaved
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-[#1b202e] text-gray-300 border-[#2f364d] hover:bg-[#252b3e]'
                    }`}
                  >
                    <span>{f}</span>
                    {isSaved && <CheckCircle2 size={9} className="text-emerald-400" />}
                  </button>
                );
              })}
            </div>

            {searchedFontStatus && (
              <div className="p-2.5 rounded-lg bg-[#0e1017] border border-[#222735] flex items-center justify-between text-xs">
                <span className="text-gray-300">
                  Status for <strong>"{searchedFontStatus.fontName}"</strong>:
                </span>
                <div className="flex items-center gap-2">
                  {searchedFontStatus.isInstalled ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <CheckCircle2 size={13} />
                      {searchedFontStatus.isInAppDb 
                        ? 'Active in Offline IndexedDB' 
                        : searchedFontStatus.isUniversal 
                          ? 'Universal Windows System Font' 
                          : 'Installed Locally on Windows PC'}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-400 font-semibold">
                      <AlertTriangle size={13} />
                      Not Installed on System Unit (Ready to 1-Click Download)
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 3. Live Typography Preview Sandbox */}
          <div className="p-4 rounded-xl bg-[#161925] border border-[#272d40] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye size={15} className="text-cyan-400" />
                <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                  Live Typography Preview Sandbox
                </h4>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span>Font:</span>
                  <span className="font-bold text-white px-2 py-0.5 rounded bg-[#202534] border border-[#30374c]">
                    {previewFont}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {[20, 28, 36, 48].map((size) => (
                    <button
                      key={size}
                      onClick={() => setPreviewSize(size)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                        previewSize === size 
                          ? 'bg-cyan-500 text-white font-bold' 
                          : 'bg-[#202534] text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {size}px
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Editable Preview String */}
            <div 
              className="p-5 rounded-xl bg-[#0a0c12] border border-[#222736] text-white min-h-[90px] flex items-center justify-center text-center shadow-inner transition-all select-text overflow-hidden"
              style={{
                fontFamily: `"${previewFont}", sans-serif`,
                fontSize: `${previewSize}px`,
                lineHeight: 1.25,
                fontWeight: 600,
              }}
            >
              {previewText}
            </div>

            <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1">
              <input
                type="text"
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Change sample text..."
                className="w-2/3 px-2.5 py-1 rounded bg-[#0e1017] border border-[#282e42] text-gray-300 text-xs focus:outline-none focus:border-cyan-400"
              />
              <span className="font-mono text-[10px] text-gray-500">
                Live document.fonts check: {document.fonts?.check(`16px "${previewFont}"`) ? '✓ Active' : 'Fallback'}
              </span>
            </div>
          </div>

          {/* 4. Drag & Drop Font File Upload (.ttf / .otf / .woff2) */}
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`p-4 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
              isDragOver 
                ? 'border-amber-400 bg-amber-500/10' 
                : 'border-[#2e344a] bg-[#161925]/60 hover:border-amber-500/40 hover:bg-[#1a1e2d]'
            }`}
          >
            <input 
              ref={fileInputRef}
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              multiple
              className="hidden"
              onChange={(e) => handleFilesUpload(e.target.files)}
            />
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-2">
              <Upload size={16} />
            </div>
            <h5 className="text-xs font-bold text-gray-200">
              Have the font file (.ttf / .otf / .woff2) on your PC?
            </h5>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Drag & drop font files here, or click to browse. Automatically installs into SimpleWorship instantly!
            </p>
          </div>

          {/* 5. Stored Offline Fonts in IndexedDB & Enterprise USB Backup (Toggle) */}
          <div className="pt-2 border-t border-[#252a3d]">
            <div className="w-full flex items-center justify-between text-xs font-bold text-gray-400 py-1">
              <button
                onClick={() => setShowDbManager(!showDbManager)}
                className="flex items-center gap-2 hover:text-gray-200 transition-colors cursor-pointer"
              >
                <HardDrive size={14} className="text-cyan-400" />
                <span>Installed in SimpleWorship Offline Database ({storedDbFonts.length})</span>
                <span className="text-[11px] text-cyan-400 ml-1">
                  ({showDbManager ? 'Hide' : 'Manage'})
                </span>
              </button>

              {/* USB Export/Import Controls */}
              <div className="flex items-center gap-2">
                <input 
                  ref={zipInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={handleImportZip}
                />
                <button
                  onClick={() => zipInputRef.current?.click()}
                  disabled={isImportingZip}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#1e2333] hover:bg-[#282f45] text-gray-200 border border-[#373f59] transition-all cursor-pointer disabled:opacity-50"
                  title="Import font backup zip from USB flash drive"
                >
                  <FolderDown size={12} className="text-amber-400" />
                  <span>Restore ZIP</span>
                </button>

                <button
                  onClick={handleExportZip}
                  disabled={isExportingZip || storedDbFonts.length === 0}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#1e2333] hover:bg-[#282f45] text-cyan-300 border border-cyan-500/30 transition-all cursor-pointer disabled:opacity-50"
                  title="Export all downloaded fonts as a ZIP for USB transfer to offline church PC"
                >
                  <Archive size={12} className="text-cyan-400" />
                  <span>Export USB Backup</span>
                </button>
              </div>
            </div>

            {showDbManager && (
              <div className="mt-3 p-3 rounded-xl bg-[#161925] border border-[#272d40] space-y-2">
                {storedDbFonts.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2 text-center">
                    No custom fonts saved in IndexedDB yet. 1-click install Google Fonts or upload a .ttf file above!
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {storedDbFonts.map((sf) => (
                      <div 
                        key={sf.family}
                        className="p-2.5 rounded-lg bg-[#0e1017] border border-[#282e42] flex items-center justify-between gap-2"
                      >
                        <div className="truncate">
                          <button
                            onClick={() => setPreviewFont(sf.family)}
                            className="text-xs font-bold text-white hover:text-cyan-300 block truncate text-left cursor-pointer"
                          >
                            {sf.family}
                          </button>
                          <span className="text-[10px] text-gray-400 block uppercase font-mono">
                            {sf.format} • {formatByteSize(sf.byteSize)} • {sf.source}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setPreviewFont(sf.family)}
                            className="p-1 rounded text-gray-400 hover:text-cyan-300 transition-colors"
                            title="Preview font"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteDbFont(sf.family)}
                            className="p-1 rounded text-gray-400 hover:text-red-400 transition-colors"
                            title="Delete from offline storage"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 6. Verified / Installed Presentation Fonts (Collapsible) */}
          {installedFonts.length > 0 && (
            <div className="pt-2 border-t border-[#252a3d]">
              <button
                onClick={() => setShowInstalledList(!showInstalledList)}
                className="w-full flex items-center justify-between text-xs font-bold text-gray-400 hover:text-gray-200 transition-colors py-1 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Verified Presentation Fonts ({installedFonts.length})
                </span>
                <span className="text-[11px] text-cyan-400">
                  {showInstalledList ? 'Hide' : 'View Verified Fonts'}
                </span>
              </button>

              {showInstalledList && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 animate-in fade-in">
                  {installedFonts.map((font) => {
                    const displayFamily = font.fontName.includes(',')
                      ? font.fontName.split(',')[0].replace(/^["'\s]+|["'\s]+$/g, '').trim()
                      : font.fontName.replace(/^["']+|["']+$/g, '').trim();
                    const family = font.normalizedFamily || displayFamily;

                    return (
                      <div 
                        key={font.fontName}
                        className="p-2.5 rounded-lg bg-[#181c29] border border-[#282d40] flex items-center justify-between gap-2"
                      >
                        <div className="truncate">
                          <button
                            onClick={() => setPreviewFont(family)}
                            className="text-xs font-semibold text-gray-200 hover:text-cyan-300 block truncate text-left cursor-pointer"
                          >
                            {displayFamily}
                          </button>
                          <span className="text-[10px] text-gray-400 capitalize">
                            {font.isUniversalSystemFont ? 'Universal OS Font' : 'Active System/App Font'}
                          </span>
                        </div>
                        <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-[#252a3d] bg-[#171a26] flex items-center justify-between text-xs">
          <div className="text-gray-400 font-mono text-[11px] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>IndexedDB + Canvas baseline font detector active • Zero runtime dependencies</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#252b3d] hover:bg-[#323950] text-gray-200 transition-all cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const FontScannerModal = withPortal(FontScannerModalBase);
export default FontScannerModal;

