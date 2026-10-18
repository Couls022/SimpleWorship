/**
 * System & Installed Font Auto-Detection Engine
 * 
 * Capabilities:
 * 1. Native Chromium Local Font Access API (`window.queryLocalFonts()`) to retrieve all installed fonts from Windows / macOS / Linux.
 * 2. Canvas-based baseline probe fallback to test 150+ popular Windows OS, macOS, and church presentation fonts.
 * 3. LocalStorage persistence for user-scanned fonts and custom user font definitions.
 * 4. Reactive notification system (`simpleworship:fonts-updated`) across all modals and inspectors.
 */

export interface SystemFontEntry {
  family: string;
  category: 'system' | 'windows' | 'google' | 'custom';
  installed?: boolean;
  sample?: string;
}

const STORAGE_KEY = 'simpleworship_installed_fonts_cache';
const CUSTOM_FONTS_KEY = 'simpleworship_custom_user_fonts';

// Standard Curated System & Church Presentation Fonts
export const POPULAR_PRESENTATION_FONTS: SystemFontEntry[] = [
  // Microsoft Modern & Windows Core Fonts
  { family: 'Aptos', category: 'windows' },
  { family: 'Segoe UI', category: 'windows' },
  { family: 'Calibri', category: 'windows' },
  { family: 'Tahoma', category: 'windows' },
  { family: 'Trebuchet MS', category: 'windows' },
  { family: 'Georgia', category: 'windows' },
  { family: 'Times New Roman', category: 'windows' },
  { family: 'Verdana', category: 'windows' },
  { family: 'Arial', category: 'windows' },
  { family: 'Arial Black', category: 'windows' },
  { family: 'Impact', category: 'windows' },
  { family: 'Century Gothic', category: 'windows' },
  { family: 'Franklin Gothic Medium', category: 'windows' },
  { family: 'Bahnschrift', category: 'windows' },
  { family: 'Cambria', category: 'windows' },
  { family: 'Constantia', category: 'windows' },
  { family: 'Corbel', category: 'windows' },
  { family: 'Candara', category: 'windows' },
  { family: 'Consolas', category: 'windows' },
  { family: 'Comic Sans MS', category: 'windows' },
  { family: 'Courier New', category: 'windows' },
  { family: 'Lucida Sans', category: 'windows' },
  { family: 'Book Antiqua', category: 'windows' },
  { family: 'Palatino Linotype', category: 'windows' },
  { family: 'Garamond', category: 'windows' },
  { family: 'Gabriola', category: 'windows' },
  { family: 'Ink Free', category: 'windows' },
  { family: 'Segoe Script', category: 'windows' },
  { family: 'Segoe Print', category: 'windows' },
  { family: 'Sitka Text', category: 'windows' },
  { family: 'Sylfaen', category: 'windows' },
  { family: 'Ebrima', category: 'windows' },
  { family: 'Malgun Gothic', category: 'windows' },
  { family: 'Microsoft YaHei', category: 'windows' },

  // Worship & Modern Presentation Fonts
  { family: 'Montserrat', category: 'google' },
  { family: 'Playfair Display', category: 'google' },
  { family: 'Plus Jakarta Sans', category: 'google' },
  { family: 'Inter', category: 'google' },
  { family: 'Roboto', category: 'google' },
  { family: 'Open Sans', category: 'google' },
  { family: 'Lato', category: 'google' },
  { family: 'Poppins', category: 'google' },
  { family: 'Cinzel', category: 'google' },
  { family: 'Oswald', category: 'google' },
  { family: 'Bebas Neue', category: 'google' },
  { family: 'Merriweather', category: 'google' },
  { family: 'Lora', category: 'google' },
  { family: 'Raleway', category: 'google' },
  { family: 'Nunito', category: 'google' },
  { family: 'Rubik', category: 'google' },
  { family: 'Cinzel Decorative', category: 'google' },
  { family: 'Cormorant Garamond', category: 'google' },
  { family: 'DM Sans', category: 'google' },
  { family: 'Outfit', category: 'google' },
  { family: 'Manrope', category: 'google' },
  { family: 'Cabinet Grotesk', category: 'google' },
  { family: 'Satoshi', category: 'google' },
  { family: 'Clash Display', category: 'google' },
];

/**
 * Fast Canvas-based Font Availability Detector
 */
function isFontAvailableOnMachine(fontFamily: string): boolean {
  if (typeof document === 'undefined') return false;

  // 1. If document.fonts.check supports it
  try {
    if (document.fonts && document.fonts.check(`16px "${fontFamily}"`)) {
      // document.fonts.check can return true for fallbacks, so verify via canvas measurement
    }
  } catch {
    // Ignore error
  }

  // 2. Measure against 3 distinct fallback base fonts
  const testString = 'mmmmmmmmmmlliWWWWWWWWW@#$1234567890';
  const testSize = '72px';
  const baseFonts = ['monospace', 'sans-serif', 'serif'];

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return false;

  for (const baseFont of baseFonts) {
    context.font = `${testSize} ${baseFont}`;
    const baseWidth = context.measureText(testString).width;

    context.font = `${testSize} "${fontFamily}", ${baseFont}`;
    const fontWidth = context.measureText(testString).width;

    if (baseWidth !== fontWidth) {
      return true;
    }
  }

  return false;
}

import {
  LocalSystemFontScannerService,
  localSystemFontsMap,
  COMPREHENSIVE_SYSTEM_FONTS,
} from '../services/localSystemFontScannerService';

/**
 * Query Local Fonts via Native Web API or Comprehensive Probe and register in IndexedDB
 */
export async function queryNativeSystemFonts(): Promise<string[]> {
  if (typeof window === 'undefined') return [];

  const scanResult = await LocalSystemFontScannerService.scanAndRegisterLocalSystemFonts();
  if (scanResult.allLocalFonts.length > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scanResult.allLocalFonts));
    } catch {}
    notifyFontsUpdated();
    return scanResult.allLocalFonts;
  }

  // Fallback: Scan installed fonts via canvas baseline test across comprehensive catalog
  const detected: string[] = [];
  const allToTest = [
    ...POPULAR_PRESENTATION_FONTS.map(f => f.family),
    ...COMPREHENSIVE_SYSTEM_FONTS.map(f => f.family),
  ];
  const seen = new Set<string>();

  for (const family of allToTest) {
    const lower = family.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    if (isFontAvailableOnMachine(family) || LocalSystemFontScannerService.isLocalFontAvailable(family)) {
      detected.push(family);
    }
  }

  if (detected.length > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(detected));
    } catch {}
    notifyFontsUpdated();
  }

  return detected;
}

/**
 * Get all available fonts combining detected Windows/OS system fonts, comprehensive Microsoft/Windows catalog, and user custom additions
 */
export function getAvailableSystemFonts(): SystemFontEntry[] {
  const result: SystemFontEntry[] = [];
  const addedFamilies = new Set<string>();

  const addFont = (family: string, category: SystemFontEntry['category'], installed?: boolean) => {
    const clean = family.trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (addedFamilies.has(key)) return;
    addedFamilies.add(key);
    result.push({ family: clean, category, installed });
  };

  // 1. Custom user-registered fonts first
  try {
    const rawCustom = localStorage.getItem(CUSTOM_FONTS_KEY);
    if (rawCustom) {
      const customList: string[] = JSON.parse(rawCustom);
      for (const family of customList) {
        addFont(family, 'custom', true);
      }
    }
  } catch (e) {
    console.error('Failed to parse custom user fonts', e);
  }

  // 2. Load registered local system fonts from LocalSystemFontScannerService (window.queryLocalFonts + canvas probe)
  for (const [, record] of localSystemFontsMap.entries()) {
    const mappedCat: SystemFontEntry['category'] =
      record.category === 'windows' || record.category === 'office'
        ? 'windows'
        : record.category === 'worship'
        ? 'google'
        : 'system';
    addFont(record.family, mappedCat, true);
  }

  // 3. Load cached system scanned fonts from LocalStorage
  try {
    const rawCached = localStorage.getItem(STORAGE_KEY);
    if (rawCached) {
      const cachedList: string[] = JSON.parse(rawCached);
      for (const family of cachedList) {
        addFont(family, 'windows', true);
      }
    }
  } catch (e) {
    console.error('Failed to parse cached system fonts', e);
  }

  // 4. Add Core Windows & System Timer/Display Defaults
  const coreSystemDefaults: SystemFontEntry[] = [
    { family: 'Segoe UI', category: 'windows', installed: true },
    { family: 'Segoe UI Black', category: 'windows', installed: true },
    { family: 'Aptos', category: 'windows', installed: true },
    { family: 'Aptos Display', category: 'windows', installed: true },
    { family: 'Calibri', category: 'windows', installed: true },
    { family: 'Arial', category: 'windows', installed: true },
    { family: 'Arial Black', category: 'windows', installed: true },
    { family: 'Impact', category: 'windows', installed: true },
    { family: 'Bahnschrift', category: 'windows', installed: true },
    { family: 'Consolas', category: 'windows', installed: true },
    { family: 'Cascadia Mono', category: 'windows', installed: true },
    { family: 'Cascadia Code', category: 'windows', installed: true },
    { family: 'Century Gothic', category: 'windows', installed: true },
    { family: 'Franklin Gothic Medium', category: 'windows', installed: true },
    { family: 'Tahoma', category: 'windows', installed: true },
    { family: 'Trebuchet MS', category: 'windows', installed: true },
    { family: 'Verdana', category: 'windows', installed: true },
    { family: 'Georgia', category: 'windows', installed: true },
    { family: 'Times New Roman', category: 'windows', installed: true },
    { family: 'Courier New', category: 'windows', installed: true },
    { family: 'monospace', category: 'system', installed: true },
    { family: 'sans-serif', category: 'system', installed: true },
    { family: 'serif', category: 'system', installed: true },
    { family: 'system-ui', category: 'system', installed: true },
  ];

  for (const item of coreSystemDefaults) {
    addFont(item.family, item.category, item.installed);
  }

  // 5. Add Comprehensive Windows, Office, macOS & Worship Catalog (200+ fonts)
  for (const item of COMPREHENSIVE_SYSTEM_FONTS) {
    const cat: SystemFontEntry['category'] =
      item.category === 'windows' || item.category === 'office'
        ? 'windows'
        : item.category === 'worship'
        ? 'google'
        : 'system';
    addFont(item.family, cat, true);
  }

  // 6. Add Popular Presentation Fonts
  for (const preset of POPULAR_PRESENTATION_FONTS) {
    addFont(preset.family, preset.category, preset.installed);
  }

  return result;
}

/**
 * Add a custom font name
 */
export function addCustomUserFont(fontFamily: string): boolean {
  const trimmed = fontFamily.trim();
  if (!trimmed) return false;

  try {
    const rawCustom = localStorage.getItem(CUSTOM_FONTS_KEY);
    const customList: string[] = rawCustom ? JSON.parse(rawCustom) : [];
    if (!customList.some(f => f.toLowerCase() === trimmed.toLowerCase())) {
      customList.push(trimmed);
      localStorage.setItem(CUSTOM_FONTS_KEY, JSON.stringify(customList));
      notifyFontsUpdated();
      return true;
    }
  } catch (e) {
    console.error('Failed to save custom user font', e);
  }
  return false;
}

/**
 * Dispatch reactive font update event across the whole app
 */
function notifyFontsUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('simpleworship:fonts-updated'));
  }
}

/**
 * Auto-detect on application boot
 */
if (typeof window !== 'undefined') {
  setTimeout(() => {
    // Background light probe if no cache exists
    if (!localStorage.getItem(STORAGE_KEY)) {
      queryNativeSystemFonts().catch(() => {});
    }
  }, 1000);
}
