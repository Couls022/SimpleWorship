/**
 * Local System Font Scanner & IndexedDB Registry Service
 * 
 * Automatically detects, probes, and catalogs locally installed operating system fonts
 * (Windows, Office 365/2021, macOS, and custom installed desktop fonts) and registers
 * them into the permanent IndexedDB registry.
 * 
 * Ensures the entire application gives absolute priority to local font binaries,
 * preventing unnecessary web requests, downloads, or online font fetching.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { inMemoryInstalledFonts } from '../utils/fontStorage';
import { SYSTEM_UNIVERSAL_FONTS } from '../utils/universalFontList';

export interface LocalSystemFontRecord {
  family: string;
  familyLower: string;
  postscriptName?: string;
  fullName?: string;
  style?: string;
  weight?: string | number;
  category?: 'windows' | 'office' | 'macos' | 'worship' | 'system' | 'custom';
  detectionMethod: 'native_query' | 'canvas_probe' | 'document_fonts' | 'system_catalog';
  scannedAt: number;
  isAvailableLocally: boolean;
}

interface LocalFontDBSchema extends DBSchema {
  installed_fonts: {
    key: string;
    value: any;
    indexes: {
      'by_family_lower': string;
    };
  };
  local_system_fonts: {
    key: string;
    value: LocalSystemFontRecord;
    indexes: {
      'by_family_lower': string;
      'by_category': string;
      'by_detection_method': string;
    };
  };
}

const DB_NAME = 'SimpleWorship_Fonts_DB';
const DB_VERSION = 3;

// In-memory set for 0ms synchronous lookups during 60FPS presentation rendering
export const localSystemFontsRegistry = new Set<string>();
export const localSystemFontsMap = new Map<string, LocalSystemFontRecord>();

// Pre-populate system universal set into memory for 0ms startup availability
for (const font of SYSTEM_UNIVERSAL_FONTS) {
  localSystemFontsRegistry.add(font.toLowerCase());
  inMemoryInstalledFonts.add(font.toLowerCase());
}

let isScanInProgress = false;
let isInitialized = false;
let dbInstancePromise: Promise<IDBPDatabase<LocalFontDBSchema> | null> | null = null;

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function getDB(): Promise<IDBPDatabase<LocalFontDBSchema> | null> {
  if (!isIndexedDBAvailable()) return Promise.resolve(null);
  if (!dbInstancePromise) {
    dbInstancePromise = openDB<LocalFontDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('installed_fonts')) {
          const store = db.createObjectStore('installed_fonts', { keyPath: 'familyLower' });
          store.createIndex('by_family_lower', 'familyLower', { unique: true });
        }
        if (!db.objectStoreNames.contains('local_system_fonts')) {
          const store = db.createObjectStore('local_system_fonts', { keyPath: 'familyLower' });
          store.createIndex('by_family_lower', 'familyLower', { unique: true });
          store.createIndex('by_category', 'category', { unique: false });
          store.createIndex('by_detection_method', 'detectionMethod', { unique: false });
        }
      },
    }).catch(err => {
      console.warn('[LocalSystemFontScanner] IndexedDB open error:', err);
      return null;
    });
  }
  return dbInstancePromise;
}

// Self-contained baseline canvas probe without circular dependencies
function probePhysicalLocalFont(familyName: string): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const testStr = 'mmmmmmmmmmlliÑñ123WM!@#';
    const testSize = '72px';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    // Test across distinct standard baseline fonts
    ctx.font = `${testSize} monospace`;
    const monoWidth = ctx.measureText(testStr).width;
    ctx.font = `${testSize} "${familyName}", monospace`;
    const probedMonoWidth = ctx.measureText(testStr).width;

    ctx.font = `${testSize} sans-serif`;
    const sansWidth = ctx.measureText(testStr).width;
    ctx.font = `${testSize} "${familyName}", sans-serif`;
    const probedSansWidth = ctx.measureText(testStr).width;

    ctx.font = `${testSize} serif`;
    const serifWidth = ctx.measureText(testStr).width;
    ctx.font = `${testSize} "${familyName}", serif`;
    const probedSerifWidth = ctx.measureText(testStr).width;

    const diffCount = (Math.abs(monoWidth - probedMonoWidth) > 0.8 ? 1 : 0) +
                      (Math.abs(sansWidth - probedSansWidth) > 0.8 ? 1 : 0) +
                      (Math.abs(serifWidth - probedSerifWidth) > 0.8 ? 1 : 0);

    return diffCount >= 2;
  } catch {
    return false;
  }
}

/**
 * Curated Comprehensive System & Office Fonts Catalog (200+ fonts)
 */
export const COMPREHENSIVE_SYSTEM_FONTS: Array<{ family: string; category: LocalSystemFontRecord['category'] }> = [
  // Microsoft Modern & Windows Core
  { family: 'Aptos', category: 'office' },
  { family: 'Aptos Display', category: 'office' },
  { family: 'Aptos Narrow', category: 'office' },
  { family: 'Aptos Serif', category: 'office' },
  { family: 'Aptos Mono', category: 'office' },
  { family: 'Segoe UI', category: 'windows' },
  { family: 'Segoe UI Variable', category: 'windows' },
  { family: 'Segoe UI Variable Display', category: 'windows' },
  { family: 'Segoe UI Variable Text', category: 'windows' },
  { family: 'Segoe UI Variable Small', category: 'windows' },
  { family: 'Segoe UI Semibold', category: 'windows' },
  { family: 'Segoe UI Light', category: 'windows' },
  { family: 'Segoe UI Black', category: 'windows' },
  { family: 'Segoe Script', category: 'windows' },
  { family: 'Segoe Print', category: 'windows' },
  { family: 'Calibri', category: 'office' },
  { family: 'Calibri Light', category: 'office' },
  { family: 'Grandview', category: 'office' },
  { family: 'Tenorite', category: 'office' },
  { family: 'Skeena', category: 'office' },
  { family: 'Bierstadt', category: 'office' },
  { family: 'Bahnschrift', category: 'windows' },
  { family: 'Arial', category: 'windows' },
  { family: 'Arial Black', category: 'windows' },
  { family: 'Arial Narrow', category: 'windows' },
  { family: 'Arial Rounded MT Bold', category: 'windows' },
  { family: 'Tahoma', category: 'windows' },
  { family: 'Trebuchet MS', category: 'windows' },
  { family: 'Verdana', category: 'windows' },
  { family: 'Impact', category: 'windows' },
  { family: 'Century Gothic', category: 'office' },
  { family: 'Franklin Gothic Medium', category: 'windows' },
  { family: 'Franklin Gothic', category: 'windows' },
  { family: 'Cambria', category: 'office' },
  { family: 'Cambria Math', category: 'office' },
  { family: 'Constantia', category: 'office' },
  { family: 'Corbel', category: 'office' },
  { family: 'Candara', category: 'office' },
  { family: 'Consolas', category: 'windows' },
  { family: 'Comic Sans MS', category: 'windows' },
  { family: 'Courier New', category: 'windows' },
  { family: 'Georgia', category: 'windows' },
  { family: 'Times New Roman', category: 'windows' },
  { family: 'Palatino Linotype', category: 'windows' },
  { family: 'Book Antiqua', category: 'windows' },
  { family: 'Garamond', category: 'office' },
  { family: 'Gabriola', category: 'windows' },
  { family: 'Lucida Sans', category: 'windows' },
  { family: 'Lucida Sans Unicode', category: 'windows' },
  { family: 'Lucida Console', category: 'windows' },
  { family: 'Lucida Handwriting', category: 'office' },
  { family: 'Lucida Calligraphy', category: 'office' },
  { family: 'Ink Free', category: 'windows' },
  { family: 'Sitka Text', category: 'windows' },
  { family: 'Sitka Display', category: 'windows' },
  { family: 'Sylfaen', category: 'windows' },
  { family: 'Ebrima', category: 'windows' },
  { family: 'Malgun Gothic', category: 'windows' },
  { family: 'Microsoft YaHei', category: 'windows' },
  { family: 'Microsoft JhengHei', category: 'windows' },
  { family: 'SimSun', category: 'windows' },
  { family: 'NSimSun', category: 'windows' },
  { family: 'SimHei', category: 'windows' },
  { family: 'Yu Gothic', category: 'windows' },
  { family: 'Meiryo', category: 'windows' },
  { family: 'Batang', category: 'windows' },
  { family: 'Gulim', category: 'windows' },
  { family: 'Dotum', category: 'windows' },
  
  // Microsoft Office Expanded Typography
  { family: 'Agency FB', category: 'office' },
  { family: 'Algerian', category: 'office' },
  { family: 'Bauhaus 93', category: 'office' },
  { family: 'Bell MT', category: 'office' },
  { family: 'Berlin Sans FB', category: 'office' },
  { family: 'Bernard MT Condensed', category: 'office' },
  { family: 'Blackadder ITC', category: 'office' },
  { family: 'Bodoni MT', category: 'office' },
  { family: 'Bodoni MT Black', category: 'office' },
  { family: 'Bodoni MT Condensed', category: 'office' },
  { family: 'Bookman Old Style', category: 'office' },
  { family: 'Bradley Hand ITC', category: 'office' },
  { family: 'Britannic Bold', category: 'office' },
  { family: 'Broadway', category: 'office' },
  { family: 'Brush Script MT', category: 'office' },
  { family: 'Californian FB', category: 'office' },
  { family: 'Castellar', category: 'office' },
  { family: 'Centaur', category: 'office' },
  { family: 'Century', category: 'office' },
  { family: 'Century Schoolbook', category: 'office' },
  { family: 'Chiller', category: 'office' },
  { family: 'Colonna MT', category: 'office' },
  { family: 'Cooper Black', category: 'office' },
  { family: 'Copperplate Gothic Bold', category: 'office' },
  { family: 'Copperplate Gothic Light', category: 'office' },
  { family: 'Curlz MT', category: 'office' },
  { family: 'Edwardian Script ITC', category: 'office' },
  { family: 'Elephant', category: 'office' },
  { family: 'Engravers MT', category: 'office' },
  { family: 'Eras Bold ITC', category: 'office' },
  { family: 'Eras Demi ITC', category: 'office' },
  { family: 'Eras Light ITC', category: 'office' },
  { family: 'Eras Medium ITC', category: 'office' },
  { family: 'Felix Titling', category: 'office' },
  { family: 'Footlight MT Light', category: 'office' },
  { family: 'Forte', category: 'office' },
  { family: 'Freestyle Script', category: 'office' },
  { family: 'French Script MT', category: 'office' },
  { family: 'Gigi', category: 'office' },
  { family: 'Gill Sans MT', category: 'office' },
  { family: 'Gloucester MT Extra Condensed', category: 'office' },
  { family: 'Goudy Old Style', category: 'office' },
  { family: 'Goudy Stout', category: 'office' },
  { family: 'Haettenschweiler', category: 'office' },
  { family: 'Harlow Solid Italic', category: 'office' },
  { family: 'Harrington', category: 'office' },
  { family: 'High Tower Text', category: 'office' },
  { family: 'Jokerman', category: 'office' },
  { family: 'Juice ITC', category: 'office' },
  { family: 'Kristen ITC', category: 'office' },
  { family: 'Kunstler Script', category: 'office' },
  { family: 'Magneto', category: 'office' },
  { family: 'Maiandra GD', category: 'office' },
  { family: 'Matura MT Script Capitals', category: 'office' },
  { family: 'Mistral', category: 'office' },
  { family: 'Modern No. 20', category: 'office' },
  { family: 'Monotype Corsiva', category: 'office' },
  { family: 'Niagara Engraved', category: 'office' },
  { family: 'Niagara Solid', category: 'office' },
  { family: 'OCR A Extended', category: 'office' },
  { family: 'Old English Text MT', category: 'office' },
  { family: 'Onyx', category: 'office' },
  { family: 'Palace Script MT', category: 'office' },
  { family: 'Papyrus', category: 'office' },
  { family: 'Parchment', category: 'office' },
  { family: 'Perpetua', category: 'office' },
  { family: 'Perpetua Titling MT', category: 'office' },
  { family: 'Playbill', category: 'office' },
  { family: 'Poor Richard', category: 'office' },
  { family: 'Pristina', category: 'office' },
  { family: 'Rage Italic', category: 'office' },
  { family: 'Ravie', category: 'office' },
  { family: 'Rockwell', category: 'office' },
  { family: 'Rockwell Condensed', category: 'office' },
  { family: 'Rockwell Extra Bold', category: 'office' },
  { family: 'Showcard Gothic', category: 'office' },
  { family: 'Snap ITC', category: 'office' },
  { family: 'Stencil', category: 'office' },
  { family: 'Tempus Sans ITC', category: 'office' },
  { family: 'Tw Cen MT', category: 'office' },
  { family: 'Tw Cen MT Condensed', category: 'office' },
  { family: 'Viner Hand ITC', category: 'office' },
  { family: 'Vivaldi', category: 'office' },
  { family: 'Vladimir Script', category: 'office' },
  { family: 'Wide Latin', category: 'office' },

  // macOS / iOS Core Fonts
  { family: 'Helvetica', category: 'macos' },
  { family: 'Helvetica Neue', category: 'macos' },
  { family: 'Futura', category: 'macos' },
  { family: 'Avenir', category: 'macos' },
  { family: 'Avenir Next', category: 'macos' },
  { family: 'Baskerville', category: 'macos' },
  { family: 'Didot', category: 'macos' },
  { family: 'Optima', category: 'macos' },
  { family: 'Gill Sans', category: 'macos' },
  { family: 'Menlo', category: 'macos' },
  { family: 'Monaco', category: 'macos' },
  { family: 'San Francisco', category: 'macos' },

  // Common Church Worship & Presentation Fonts
  { family: 'Montserrat', category: 'worship' },
  { family: 'Poppins', category: 'worship' },
  { family: 'Inter', category: 'worship' },
  { family: 'Roboto', category: 'worship' },
  { family: 'Open Sans', category: 'worship' },
  { family: 'Lato', category: 'worship' },
  { family: 'Bebas Neue', category: 'worship' },
  { family: 'Oswald', category: 'worship' },
  { family: 'Playfair Display', category: 'worship' },
  { family: 'Cinzel', category: 'worship' },
  { family: 'Plus Jakarta Sans', category: 'worship' },
  { family: 'League Spartan', category: 'worship' },
  { family: 'League Gothic', category: 'worship' },
  { family: 'Outfit', category: 'worship' },
  { family: 'Urbanist', category: 'worship' },
  { family: 'Figtree', category: 'worship' },
  { family: 'DM Sans', category: 'worship' },
  { family: 'DM Serif Display', category: 'worship' },
  { family: 'Merriweather', category: 'worship' },
  { family: 'Lora', category: 'worship' },
  { family: 'Raleway', category: 'worship' },
  { family: 'Nunito', category: 'worship' },
  { family: 'Rubik', category: 'worship' },
  { family: 'Manrope', category: 'worship' },
  { family: 'Sora', category: 'worship' },
  { family: 'Syne', category: 'worship' },
  { family: 'Lexend', category: 'worship' },
];

// Self-contained alias registry in DOM for local fonts
function registerLocalFontAliases(families: string[]): void {
  if (typeof document === 'undefined' || !Array.isArray(families) || families.length === 0) return;
  try {
    let sheet = document.getElementById('sw-local-font-aliases') as HTMLStyleElement;
    if (!sheet) {
      sheet = document.createElement('style');
      sheet.id = 'sw-local-font-aliases';
      document.head.appendChild(sheet);
    }
    let css = '';
    for (const fam of families) {
      const clean = fam.trim().replace(/^["']+|["']+$/g, '');
      if (clean) {
        css += `\n@font-face { font-family: "${clean}"; src: local("${clean}"); font-display: swap; }`;
      }
    }
    if (css) sheet.textContent += css;
  } catch {}
}

/**
 * High-performance service managing local system font discovery and IndexedDB registry
 */
export class LocalSystemFontScannerService {
  /**
   * Initializes the registry by loading previously indexed local fonts from IndexedDB
   * and starting a non-blocking background scan.
   */
  static async init(): Promise<{ count: number; fonts: string[] }> {
    // Always guarantee system universal set is populated
    for (const font of SYSTEM_UNIVERSAL_FONTS) {
      localSystemFontsRegistry.add(font.toLowerCase());
      inMemoryInstalledFonts.add(font.toLowerCase());
    }

    if (isInitialized) {
      return { count: localSystemFontsRegistry.size, fonts: Array.from(localSystemFontsRegistry) };
    }

    try {
      const db = await getDB();
      if (db) {
        const records: LocalSystemFontRecord[] = await db.getAll('local_system_fonts').catch(() => []);
        for (const rec of records) {
          if (rec.isAvailableLocally) {
            const lower = rec.familyLower || rec.family.toLowerCase();
            localSystemFontsRegistry.add(lower);
            localSystemFontsRegistry.add(rec.family);
            inMemoryInstalledFonts.add(lower);
            localSystemFontsMap.set(lower, rec);
          }
        }
      }

      isInitialized = true;

      // Schedule proactive background scan when idle
      if (typeof window !== 'undefined') {
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => {
            LocalSystemFontScannerService.scanAndRegisterLocalSystemFonts().catch(() => {});
          }, { timeout: 3000 });
        } else {
          setTimeout(() => {
            LocalSystemFontScannerService.scanAndRegisterLocalSystemFonts().catch(() => {});
          }, 1500);
        }
      }

      return { count: localSystemFontsRegistry.size, fonts: Array.from(localSystemFontsRegistry) };
    } catch (err) {
      console.warn('[LocalSystemFontScanner] Failed to hydrate local font registry:', err);
      return { count: localSystemFontsRegistry.size, fonts: Array.from(localSystemFontsRegistry) };
    }
  }

  /**
   * Scans the host system for all installed fonts and saves them into IndexedDB registry
   */
  static async scanAndRegisterLocalSystemFonts(_options: { forceDeepScan?: boolean } = {}): Promise<{
    scannedCount: number;
    newlyRegisteredCount: number;
    allLocalFonts: string[];
    nativeApiUsed: boolean;
  }> {
    if (isScanInProgress) {
      return {
        scannedCount: localSystemFontsRegistry.size,
        newlyRegisteredCount: 0,
        allLocalFonts: Array.from(localSystemFontsRegistry),
        nativeApiUsed: false,
      };
    }

    isScanInProgress = true;
    let newlyRegisteredCount = 0;
    let nativeApiUsed = false;
    const detectedRecords: LocalSystemFontRecord[] = [];
    const now = Date.now();

    try {
      // 1. Native Chromium / Electron Local Font Access API (window.queryLocalFonts)
      if (typeof window !== 'undefined' && 'queryLocalFonts' in window && typeof (window as any).queryLocalFonts === 'function') {
        try {
          const nativeFonts = await (window as any).queryLocalFonts();
          if (Array.isArray(nativeFonts) && nativeFonts.length > 0) {
            nativeApiUsed = true;
            for (const item of nativeFonts) {
              const familyName = String(item.family || '').trim();
              if (!familyName) continue;

              const familyLower = familyName.toLowerCase();
              detectedRecords.push({
                family: familyName,
                familyLower,
                fullName: item.fullName,
                postscriptName: item.postscriptName,
                style: item.style,
                weight: item.weight,
                category: 'system',
                detectionMethod: 'native_query',
                scannedAt: now,
                isAvailableLocally: true,
              });
            }
          }
        } catch {
          // Permission denied or dismissed - gracefully fall through to probe scanning
        }
      }

      // 2. Comprehensive Catalog & Canvas Probe Scan
      for (const item of COMPREHENSIVE_SYSTEM_FONTS) {
        const familyName = item.family.trim();
        const familyLower = familyName.toLowerCase();

        // Skip if already captured by native API
        if (detectedRecords.some(r => r.familyLower === familyLower)) {
          continue;
        }

        // Check availability via document.fonts or physical canvas probe
        const isUniversal = SYSTEM_UNIVERSAL_FONTS.has(familyLower);
        let isAvailable = isUniversal;

        if (!isAvailable && typeof document !== 'undefined' && document.fonts && typeof document.fonts.check === 'function') {
          try {
            if (
              document.fonts.check(`16px "${familyName}"`) || 
              document.fonts.check(`700 16px "${familyName}"`)
            ) {
              isAvailable = true;
            }
          } catch {}
        }

        if (!isAvailable) {
          isAvailable = probePhysicalLocalFont(familyName);
        }

        if (isAvailable) {
          detectedRecords.push({
            family: familyName,
            familyLower,
            category: item.category || 'system',
            detectionMethod: isUniversal ? 'system_catalog' : 'canvas_probe',
            scannedAt: now,
            isAvailableLocally: true,
          });
        }
      }

      // Update in-memory registry immediately
      for (const record of detectedRecords) {
        const lower = record.familyLower;
        if (!localSystemFontsRegistry.has(lower)) {
          newlyRegisteredCount++;
        }
        localSystemFontsRegistry.add(lower);
        localSystemFontsRegistry.add(record.family);
        inMemoryInstalledFonts.add(lower);
        localSystemFontsMap.set(lower, record);
      }

      // 3. Batch write all discovered local system fonts into IndexedDB if available
      const db = await getDB();
      if (db && detectedRecords.length > 0) {
        try {
          const tx = db.transaction('local_system_fonts', 'readwrite');
          const store = tx.objectStore('local_system_fonts');

          for (const record of detectedRecords) {
            await store.put(record);
          }

          await tx.done;
        } catch (dbErr) {
          console.warn('[LocalSystemFontScanner] IndexedDB write warning:', dbErr);
        }
      }

      // Register dynamic local font-face fallbacks in DOM
      registerLocalFontAliases(detectedRecords.map(r => r.family));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('simpleworship:local-fonts-scanned', {
          detail: {
            count: localSystemFontsRegistry.size,
            newlyRegistered: newlyRegisteredCount,
            nativeApiUsed,
          }
        }));
        window.dispatchEvent(new CustomEvent('simpleworship:fonts-updated'));
      }

      return {
        scannedCount: detectedRecords.length,
        newlyRegisteredCount,
        allLocalFonts: Array.from(localSystemFontsRegistry),
        nativeApiUsed,
      };
    } catch (err) {
      console.error('[LocalSystemFontScanner] Scan error:', err);
      return {
        scannedCount: localSystemFontsRegistry.size,
        newlyRegisteredCount: 0,
        allLocalFonts: Array.from(localSystemFontsRegistry),
        nativeApiUsed: false,
      };
    } finally {
      isScanInProgress = false;
    }
  }

  /**
   * Synchronously checks if a font is registered as a local system font (0ms latency)
   */
  static isLocalFontAvailable(fontFamily: string): boolean {
    if (!fontFamily || typeof fontFamily !== 'string') return false;
    const clean = fontFamily.trim().replace(/^["']+|["']+$/g, '').trim().toLowerCase();
    if (!clean) return false;

    if (localSystemFontsRegistry.has(clean) || SYSTEM_UNIVERSAL_FONTS.has(clean) || inMemoryInstalledFonts.has(clean)) {
      return true;
    }

    // Check with spaces stripped or CamelCase separated
    const noSpaces = clean.replace(/\s+/g, '');
    if (localSystemFontsRegistry.has(noSpaces) || SYSTEM_UNIVERSAL_FONTS.has(noSpaces)) {
      return true;
    }

    return false;
  }

  /**
   * Retrieves all registered local system fonts from IndexedDB
   */
  static async getAllRegisteredLocalFonts(): Promise<LocalSystemFontRecord[]> {
    try {
      const db = await getDB();
      if (db) {
        return await db.getAll('local_system_fonts');
      }
      return Array.from(localSystemFontsMap.values());
    } catch {
      return Array.from(localSystemFontsMap.values());
    }
  }

  /**
   * Manually registers a specific local font into the IndexedDB registry
   */
  static async registerLocalFont(record: Partial<LocalSystemFontRecord> & { family: string }): Promise<boolean> {
    if (!record.family) return false;
    const familyName = record.family.trim();
    const familyLower = familyName.toLowerCase();

    const fullRecord: LocalSystemFontRecord = {
      family: familyName,
      familyLower,
      category: record.category || 'custom',
      detectionMethod: record.detectionMethod || 'canvas_probe',
      scannedAt: Date.now(),
      isAvailableLocally: true,
      fullName: record.fullName,
      postscriptName: record.postscriptName,
      style: record.style,
      weight: record.weight,
    };

    localSystemFontsRegistry.add(familyLower);
    localSystemFontsRegistry.add(familyName);
    inMemoryInstalledFonts.add(familyLower);
    localSystemFontsMap.set(familyLower, fullRecord);

    registerLocalFontAliases([familyName]);

    try {
      const db = await getDB();
      if (db) {
        await db.put('local_system_fonts', fullRecord);
      }
      return true;
    } catch (err) {
      console.warn('[LocalSystemFontScanner] IndexedDB put warning:', err);
      return true; // Still registered in memory
    }
  }

  /**
   * Clears the local system font cache in IndexedDB
   */
  static async clearLocalFontRegistry(): Promise<void> {
    try {
      const db = await getDB();
      if (db) {
        await db.clear('local_system_fonts');
      }
      localSystemFontsRegistry.clear();
      localSystemFontsMap.clear();

      for (const font of SYSTEM_UNIVERSAL_FONTS) {
        localSystemFontsRegistry.add(font.toLowerCase());
      }
    } catch (err) {
      console.error('[LocalSystemFontScanner] Failed to clear registry:', err);
    }
  }
}

// Auto-initialize when running in browser
if (typeof window !== 'undefined') {
  LocalSystemFontScannerService.init().catch(() => {});
}
