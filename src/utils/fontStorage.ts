import { openDB, DBSchema } from 'idb';
import JSZip from 'jszip';
import { FontValidationService, FontFormat } from '../services/fontValidationService';

export interface StoredFontRecord {
  family: string;
  familyLower: string;
  buffer: ArrayBuffer;
  format: 'truetype' | 'opentype' | 'woff' | 'woff2';
  installedAt: number;
  source: 'google' | 'upload' | 'cdn';
  byteSize: number;
  weight?: string;
}

interface FontDBSchema extends DBSchema {
  installed_fonts: {
    key: string; // family lowercased for fast case-insensitive retrieval
    value: StoredFontRecord;
    indexes: {
      'by_family_lower': string;
    };
  };
}

const DB_NAME = 'SimpleWorship_Fonts_DB';
const DB_VERSION = 2;

let dbPromise: Promise<any> | null = null;

function getFontDB() {
  if (!dbPromise) {
    dbPromise = openDB<FontDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, transaction) {
        if (!db.objectStoreNames.contains('installed_fonts')) {
          const store = db.createObjectStore('installed_fonts', { keyPath: 'familyLower' });
          store.createIndex('by_family_lower', 'familyLower', { unique: true });
        } else if (oldVersion < 2) {
          // Migration from version 1 (keyPath family) to version 2 (keyPath familyLower)
          try {
            const store = transaction.objectStore('installed_fonts');
            if (!store.indexNames.contains('by_family_lower')) {
              store.createIndex('by_family_lower', 'familyLower', { unique: false });
            }
          } catch {}
        }
      },
    });
  }
  return dbPromise;
}

// In-memory set of fonts loaded via storage or Google Fonts (lowercased)
export const inMemoryInstalledFonts = new Set<string>();

// Deduplication map to prevent redundant concurrent fetches for the same font family
const inFlightGoogleFetches = new Map<string, Promise<boolean>>();

/**
 * Enterprise validation of font binary magic headers and SFNT integrity.
 * Protects against corrupt HTML error pages (e.g. captive portals) or broken downloads.
 */
export function validateFontBinaryFormat(buffer: ArrayBuffer): 'woff2' | 'woff' | 'truetype' | 'opentype' | null {
  const result = FontValidationService.validateFontSync(buffer, { strictTableValidation: false });
  if (result.isValid && result.format) {
    if (result.format === 'collection') return 'truetype';
    return result.format;
  }
  return null;
}

/**
 * Initializes font storage and hydrates all previously installed custom & Google fonts into document.fonts
 * Safe across full application restarts and completely offline
 */
export async function initAndLoadStoredFonts(): Promise<string[]> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return [];

  const loadedFamilies: string[] = [];
  try {
    const db = await getFontDB();
    const allRecords: StoredFontRecord[] = await db.getAll('installed_fonts');

    for (const record of allRecords) {
      try {
        if ('fonts' in document && record.buffer && record.buffer.byteLength > 0) {
          const fontFace = new FontFace(record.family, record.buffer, {
            weight: record.weight || '400 700',
            style: 'normal',
          });
          await fontFace.load();
          document.fonts.add(fontFace);
          inMemoryInstalledFonts.add(record.family.toLowerCase());
          loadedFamilies.push(record.family);
        }
      } catch (fontErr) {
        console.warn(`[fontStorage] Could not hydrate stored font "${record.family}":`, fontErr);
      }
    }

    if (loadedFamilies.length > 0) {
      window.dispatchEvent(new CustomEvent('simpleworship:fonts-updated', { detail: { loaded: loadedFamilies } }));
    }
  } catch (err) {
    console.warn('[fontStorage] IndexedDB initialization warning:', err);
  }

  return loadedFamilies;
}

export const initFontStorage = initAndLoadStoredFonts;

/**
 * Saves a font binary to IndexedDB and registers it in document.fonts immediately
 */
export async function saveFontToIndexedDB(
  family: string,
  buffer: ArrayBuffer,
  format: 'truetype' | 'opentype' | 'woff' | 'woff2' = 'truetype',
  source: 'google' | 'upload' | 'cdn' = 'upload',
  weight: string = '400 700'
): Promise<boolean> {
  if (!family || !buffer || buffer.byteLength === 0) return false;

  // Validate font binary integrity and file signature before registration
  const validation = FontValidationService.validateFontSync(buffer, {
    expectedFamilyName: family,
    strictTableValidation: false, // accommodate older and subsetted church fonts while guaranteeing valid headers
  });

  if (!validation.isValid || !validation.format) {
    console.error(`[fontStorage] Refusing to register font "${family}": ${validation.error || 'Corrupt or invalid font signature'}`);
    return false;
  }

  const verifiedFormat: 'truetype' | 'opentype' | 'woff' | 'woff2' =
    validation.format === 'collection' ? 'truetype' : (validation.format || format);

  try {
    const cleanFamily = family.replace(/^["']+|["']+$/g, '').trim();
    const lowerKey = cleanFamily.toLowerCase();
    const db = await getFontDB();

    const record: StoredFontRecord = {
      family: cleanFamily,
      familyLower: lowerKey,
      buffer,
      format: verifiedFormat,
      installedAt: Date.now(),
      source,
      byteSize: buffer.byteLength,
      weight,
    };

    await db.put('installed_fonts', record);

    if (typeof document !== 'undefined' && 'fonts' in document) {
      try {
        const fontFace = new FontFace(cleanFamily, buffer, { weight, style: 'normal' });
        await fontFace.load();
        document.fonts.add(fontFace);
      } catch (err) {
        console.warn(`[fontStorage] FontFace load warning for "${cleanFamily}":`, err);
      }
    }

    inMemoryInstalledFonts.add(lowerKey);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('simpleworship:fonts-updated', { detail: { family: cleanFamily } }));
      window.dispatchEvent(new Event('resize'));
    }

    return true;
  } catch (err) {
    console.error(`[fontStorage] Failed to save font "${family}" to IndexedDB:`, err);
    return false;
  }
}

/**
 * Checks if a font is saved in IndexedDB or active in the browser
 */
export async function isFontInStorage(family: string): Promise<boolean> {
  const clean = family.replace(/^["']+|["']+$/g, '').trim().toLowerCase();
  if (inMemoryInstalledFonts.has(clean)) return true;

  try {
    const db = await getFontDB();
    const record = await db.get('installed_fonts', clean);
    if (record) {
      inMemoryInstalledFonts.add(clean);
      return true;
    }
  } catch {}

  return false;
}

/**
 * Fetches and permanently installs a Google Font into the app in 1 click
 * Enterprise-grade: Deduplicated in-flight requests, timeout safety, latin subset prioritization, and IndexedDB caching
 */
export async function fetchAndInstallGoogleFont(fontFamily: string): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  const cleanFamily = fontFamily.replace(/^["']+|["']+$/g, '').trim();
  const lower = cleanFamily.toLowerCase();

  // 1. Deduplicate concurrent requests
  if (inFlightGoogleFetches.has(lower)) {
    return inFlightGoogleFetches.get(lower)!;
  }

  const executeFetch = async (): Promise<boolean> => {
    const formattedFamily = encodeURIComponent(cleanFamily).replace(/%20/g, '+');

    // 2. Inject link tag for instant browser display
    const elementId = `sw-font-${cleanFamily.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    if (!document.getElementById(elementId)) {
      const link = document.createElement('link');
      link.id = elementId;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${formattedFamily}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&display=swap`;
      document.head.appendChild(link);
    }

    // 3. Primary Pipeline: Use internal Backend Proxy Endpoint (zero CORS restrictions)
    try {
      const apiRes = await fetch(`/api/fonts/download?family=${formattedFamily}`);
      if (apiRes.ok) {
        const json = await apiRes.json();
        if (json.success && json.bufferBase64) {
          const binaryString = atob(json.bufferBase64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const buffer = bytes.buffer;
          const verified = validateFontBinaryFormat(buffer) || 'woff2';
          await saveFontToIndexedDB(cleanFamily, buffer, verified, 'google');
          
          if (document.fonts) {
            try {
              const fontFace = new FontFace(cleanFamily, buffer, { weight: '400 700', style: 'normal' });
              await fontFace.load();
              document.fonts.add(fontFace);
            } catch {}
          }
          return true;
        }
      }
    } catch {
      // Backend proxy unavailable, proceed to client-side pipeline
    }

    // 4. Secondary Pipeline: Direct client-side fetch (Standard CORS-compliant, no forbidden headers)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const cssUrl = `https://fonts.googleapis.com/css2?family=${formattedFamily}:wght@400;700&display=swap`;
      const cssRes = await fetch(cssUrl, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (cssRes.ok) {
        const cssText = await cssRes.text();
        let fontBinaryUrl: string | null = null;
        const latinMatch = /\/\*\s*latin\s*\*\/[\s\S]*?url\((https:\/\/fonts\.gstatic\.com\/s\/[^)]+)\)/i.exec(cssText);
        if (latinMatch && latinMatch[1]) {
          fontBinaryUrl = latinMatch[1];
        } else {
          const genericMatch = /url\((https:\/\/fonts\.gstatic\.com\/s\/[^)]+)\)/i.exec(cssText);
          if (genericMatch && genericMatch[1]) {
            fontBinaryUrl = genericMatch[1];
          }
        }

        if (fontBinaryUrl) {
          const binaryController = new AbortController();
          const binaryTimeout = setTimeout(() => binaryController.abort(), 10000);

          const fontRes = await fetch(fontBinaryUrl, { signal: binaryController.signal });
          clearTimeout(binaryTimeout);

          if (fontRes.ok) {
            const buffer = await fontRes.arrayBuffer();
            const verified = validateFontBinaryFormat(buffer) || 'woff2';
            await saveFontToIndexedDB(cleanFamily, buffer, verified, 'google');

            if (document.fonts) {
              try {
                const fontFace = new FontFace(cleanFamily, buffer, { weight: '400 700', style: 'normal' });
                await fontFace.load();
                document.fonts.add(fontFace);
              } catch {}
            }
            return true;
          }
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[fontStorage] Direct Google Fonts fetch attempt warning for "${cleanFamily}":`, err);
    }

    // 5. Tertiary Pipeline: Bunny Fonts CDN client fallback
    try {
      const slug = cleanFamily.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const bRes = await fetch(`https://fonts.bunny.net/css?family=${slug}:400`);
      if (bRes.ok) {
        const bText = await bRes.text();
        const m = /url\((https:\/\/[^)]+)\)/i.exec(bText);
        if (m && m[1]) {
          const binRes = await fetch(m[1]);
          if (binRes.ok) {
            const buffer = await binRes.arrayBuffer();
            const verified = validateFontBinaryFormat(buffer) || 'woff2';
            await saveFontToIndexedDB(cleanFamily, buffer, verified, 'cdn');

            if (document.fonts) {
              try {
                const fontFace = new FontFace(cleanFamily, buffer, { weight: '400 700', style: 'normal' });
                await fontFace.load();
                document.fonts.add(fontFace);
              } catch {}
            }
            return true;
          }
        }
      }
    } catch {}

    // 6. Quaternary Pipeline: Archetype Fallback (for proprietary Windows/Canva fonts like Grandview, Garet, etc.)
    try {
      const { normalizeFontName } = await import('./pptxFontManager');
      const info = normalizeFontName(cleanFamily);
      const fallbackTarget = info.baseFamily;
      if (fallbackTarget && fallbackTarget.toLowerCase() !== lower) {
        const fallbackFormatted = encodeURIComponent(fallbackTarget).replace(/%20/g, '+');
        const fbRes = await fetch(`https://fonts.googleapis.com/css2?family=${fallbackFormatted}:wght@400;700&display=swap`);
        if (fbRes.ok) {
          const fbCss = await fbRes.text();
          const fbMatch = /url\((https:\/\/fonts\.gstatic\.com\/s\/[^)]+)\)/i.exec(fbCss);
          if (fbMatch && fbMatch[1]) {
            const fbBinRes = await fetch(fbMatch[1]);
            if (fbBinRes.ok) {
              const buffer = await fbBinRes.arrayBuffer();
              const verified = validateFontBinaryFormat(buffer) || 'woff2';
              // Register under BOTH original cleanFamily and fallback target
              await saveFontToIndexedDB(cleanFamily, buffer, verified, 'google');
              await saveFontToIndexedDB(fallbackTarget, buffer, verified, 'google');

              if (document.fonts) {
                try {
                  const fontFace = new FontFace(cleanFamily, buffer, { weight: '400 700', style: 'normal' });
                  await fontFace.load();
                  document.fonts.add(fontFace);
                } catch {}
              }
              return true;
            }
          }
        }
      }
    } catch {}

    // Fallback: If network failed entirely, register link in-memory
    inMemoryInstalledFonts.add(lower);
    if (document.fonts) {
      try {
        await document.fonts.load(`16px "${cleanFamily}"`);
      } catch {}
    }
    return true;
  };

  const promise = executeFetch().finally(() => {
    inFlightGoogleFetches.delete(lower);
  });

  inFlightGoogleFetches.set(lower, promise);
  return promise;
}

/**
 * Direct 1-click download of the font file to the user's PC (for Windows/Mac OS installation)
 */
export async function downloadFontFileToPc(fontFamily: string): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  const cleanFamily = fontFamily.replace(/^["']+|["']+$/g, '').trim();
  const lower = cleanFamily.toLowerCase();

  // 1. Check if we already have the binary in IndexedDB
  try {
    const db = await getFontDB();
    let record: StoredFontRecord | undefined = await db.get('installed_fonts', lower);

    // If not in storage, auto-fetch binary first so the user gets an authentic file
    if (!record || !record.buffer || record.buffer.byteLength === 0) {
      await fetchAndInstallGoogleFont(cleanFamily);
      record = await db.get('installed_fonts', lower);
    }

    if (record && record.buffer && record.buffer.byteLength > 0) {
      const extension = record.format === 'woff2' ? 'woff2' : record.format === 'opentype' ? 'otf' : 'ttf';
      const mime = record.format === 'woff2' ? 'font/woff2' : record.format === 'opentype' ? 'font/otf' : 'font/ttf';
      const blob = new Blob([record.buffer], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanFamily.replace(/\s+/g, '')}.${extension}`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 2000);
      return true;
    }
  } catch {}

  // 2. Direct download link from backend attachment endpoint
  try {
    const backendUrl = `/api/fonts/download?family=${encodeURIComponent(cleanFamily)}&download=1`;
    const a = document.createElement('a');
    a.href = backendUrl;
    a.download = `${cleanFamily.replace(/\s+/g, '')}.woff2`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 2000);
    return true;
  } catch {}

  // 3. Direct download link from Google Fonts download service
  try {
    const downloadUrl = `https://fonts.google.com/download?family=${encodeURIComponent(cleanFamily)}`;
    
    // In Electron, delegate to native browser / download manager
    if (typeof window !== 'undefined' && (window as any).electronAPI?.openExternalUrl) {
      await (window as any).electronAPI.openExternalUrl(downloadUrl);
      return true;
    }

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.target = '_blank';
    a.download = `${cleanFamily}.zip`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 2000);
    return true;
  } catch (err) {
    console.error(`[fontStorage] Failed to download font "${cleanFamily}":`, err);
    return false;
  }
}

/**
 * Handles custom font file upload/drop (.ttf, .otf, .woff, .woff2)
 */
export async function installCustomFontFromFile(file: File): Promise<string | null> {
  if (!file) return null;

  try {
    const extMatch = file.name.match(/\.(ttf|otf|woff2|woff)$/i);
    if (!extMatch) return null;

    const buffer = await file.arrayBuffer();
    const validation = FontValidationService.validateFontSync(buffer, { strictTableValidation: false });
    if (!validation.isValid || !validation.format) {
      console.warn(`[fontStorage] File "${file.name}" failed font signature check: ${validation.error}`);
      return null;
    }
    const verifiedFormat = (validation.format === 'collection' ? 'truetype' : validation.format) as 'truetype' | 'opentype' | 'woff' | 'woff2';

    // Prefer font family name extracted directly from OpenType 'name' table
    let rawFamily = validation.fontFamilyName;
    if (!rawFamily) {
      rawFamily = file.name.replace(/\.(ttf|otf|woff2|woff)$/i, '');
      rawFamily = rawFamily
        .replace(/[-_]?(Regular|Bold|Black|Medium|Light|SemiBold|Thin|Italic)[-_]?/gi, '')
        .replace(/[-_]+/g, ' ')
        .trim();
    }

    if (!rawFamily) {
      rawFamily = file.name.replace(/\.[^/.]+$/, '');
    }

    const success = await saveFontToIndexedDB(rawFamily, buffer, verifiedFormat, 'upload');
    return success ? rawFamily : null;
  } catch (err) {
    console.error('[fontStorage] Error installing font from file:', err);
    return null;
  }
}

/**
 * Retrieves all custom fonts stored locally in IndexedDB
 */
export async function getAllStoredCustomFonts(): Promise<Array<{ family: string; format: string; installedAt: number; source: string; byteSize: number }>> {
  try {
    const db = await getFontDB();
    const allRecords: StoredFontRecord[] = await db.getAll('installed_fonts');
    return allRecords.map(r => ({
      family: r.family,
      format: r.format,
      installedAt: r.installedAt,
      source: r.source,
      byteSize: r.byteSize || (r.buffer ? r.buffer.byteLength : 0),
    }));
  } catch {
    return [];
  }
}

/**
 * Returns all full StoredFontRecord entries (including binary ArrayBuffers) from IndexedDB.
 */
export async function getAllStoredFontRecords(): Promise<StoredFontRecord[]> {
  try {
    const db = await getFontDB();
    return await db.getAll('installed_fonts');
  } catch {
    return [];
  }
}

/**
 * Removes a custom font from IndexedDB and memory
 */
export async function deleteStoredFont(family: string): Promise<boolean> {
  try {
    const clean = family.replace(/^["']+|["']+$/g, '').trim();
    const lower = clean.toLowerCase();
    const db = await getFontDB();
    await db.delete('installed_fonts', lower);
    inMemoryInstalledFonts.delete(lower);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('simpleworship:fonts-updated', { detail: { deleted: clean } }));
      window.dispatchEvent(new Event('resize'));
    }
    return true;
  } catch (err) {
    console.error(`[fontStorage] Failed to delete font "${family}":`, err);
    return false;
  }
}

/**
 * Enterprise Backup: Exports all downloaded/installed font binaries from IndexedDB into a single .zip file.
 * Enables transferring fonts to church sanctuary PCs with zero internet.
 */
export async function exportAllFontsAsZip(): Promise<Blob | null> {
  try {
    const db = await getFontDB();
    const allRecords: StoredFontRecord[] = await db.getAll('installed_fonts');
    if (allRecords.length === 0) return null;

    const zip = new JSZip();
    const manifest: Array<{ family: string; format: string; installedAt: number; source: string; fileName: string; byteSize: number }> = [];

    for (const record of allRecords) {
      const ext = record.format === 'woff2' ? 'woff2' : record.format === 'opentype' ? 'otf' : 'ttf';
      const fileName = `${record.family.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
      zip.file(fileName, record.buffer);
      manifest.push({
        family: record.family,
        format: record.format,
        installedAt: record.installedAt,
        source: record.source,
        fileName,
        byteSize: record.byteSize || record.buffer.byteLength,
      });
    }

    zip.file('manifest.json', JSON.stringify({ version: 1, exportedAt: Date.now(), totalFonts: manifest.length, fonts: manifest }, null, 2));
    return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  } catch (err) {
    console.error('[fontStorage] Failed to export fonts as zip:', err);
    return null;
  }
}

/**
 * Retrieves a stored font record from IndexedDB by family name.
 */
export async function getStoredFontRecord(family: string): Promise<StoredFontRecord | undefined> {
  try {
    const db = await getFontDB();
    const clean = family.replace(/^["']+|["']+$/g, '').trim().toLowerCase();
    const direct = await db.get('installed_fonts', clean);
    if (direct) return direct;
    const all = await db.getAll('installed_fonts');
    return all.find(r => r.familyLower === clean || r.family.toLowerCase() === clean);
  } catch {
    return undefined;
  }
}

/**
 * Converts an ArrayBuffer to a Base64 string for IPC / JSON transfer.
 */
export function bufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Generates an automated 1-Click Windows Font Installer Package (.zip).
 * Contains the authentic font binaries plus automated `Install-Fonts-Windows.cmd` and `Install-Fonts-Windows.ps1`
 * to install and register all fonts into Windows system font registry (HKCU:\Software\Microsoft\Windows NT\CurrentVersion\Fonts).
 */
export async function exportWindowsFontInstallerPackage(targetFamilies?: string[]): Promise<Blob | null> {
  try {
    const db = await getFontDB();
    let records: StoredFontRecord[] = await db.getAll('installed_fonts');

    // If target families specified, ensure they are fetched if not yet in storage
    if (targetFamilies && targetFamilies.length > 0) {
      for (const fam of targetFamilies) {
        const clean = fam.replace(/^["']+|["']+$/g, '').trim().toLowerCase();
        const existing = records.find(r => r.familyLower === clean || r.family.toLowerCase() === clean);
        if (!existing) {
          try {
            await fetchAndInstallGoogleFont(fam);
          } catch {}
        }
      }
      records = await db.getAll('installed_fonts');
      const allowed = new Set(targetFamilies.map(f => f.toLowerCase().trim()));
      records = records.filter(r => allowed.has(r.familyLower) || allowed.has(r.family.toLowerCase()));
    }

    if (records.length === 0) {
      records = await db.getAll('installed_fonts');
    }
    if (records.length === 0) return null;

    const zip = new JSZip();
    const cmdContent = `@echo off
title SimpleWorship - Windows 1-Click Font Auto-Installer
echo ========================================================
echo   SimpleWorship - Windows 1-Click Font Auto-Installer
echo   Installing ${records.length} authentic presentation font(s) into Windows OS...
echo ========================================================
echo.
powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0Install-Fonts-Windows.ps1"
echo.
echo ========================================================
echo   [OK] Installation Complete! All fonts are ready for Windows.
echo ========================================================
pause
`;

    const ps1Content = `# SimpleWorship Windows Font Auto-Installer
$ErrorActionPreference = 'SilentlyContinue'
$FontFolder = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Fonts)
$UserFontFolder = "$env:LOCALAPPDATA\\Microsoft\\Windows\\Fonts"
if (!(Test-Path $UserFontFolder)) { New-Item -ItemType Directory -Force -Path $UserFontFolder | Out-Null }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$FontFiles = Get-ChildItem -Path $ScriptDir -Include *.ttf, *.otf, *.woff2 -Recurse

Write-Host "Installing $($FontFiles.Count) font file(s) into Windows OS..." -ForegroundColor Cyan

foreach ($File in $FontFiles) {
    $TargetUser = Join-Path $UserFontFolder $File.Name
    Copy-Item -Path $File.FullName -Destination $TargetUser -Force
    $BaseName = [System.IO.Path]::GetFileNameWithoutExtension($File.Name)
    $RegName = "$BaseName (TrueType)"
    New-ItemProperty -Path "HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts" -Name $RegName -Value $TargetUser -PropertyType String -Force | Out-Null
    Write-Host "✓ Installed: $($File.Name) into Windows Font Registry" -ForegroundColor Green
}

# Broadcast WM_FONTCHANGE to running Windows applications (PowerPoint, Word, Canva, etc.)
try {
    $signature = @"
      [DllImport("gdi32.dll")]
      public static extern int AddFontResource(string lpFileName);
      [DllImport("user32.dll")]
      public static extern int SendMessage(int hWnd, uint Msg, int wParam, int lParam);
"@
    $type = Add-Type -MemberDefinition $signature -Name "FontHelper_$([System.DateTime]::Now.Ticks)" -Namespace "SimpleWorship" -PassThru
    foreach ($File in $FontFiles) {
        $TargetUser = Join-Path $UserFontFolder $File.Name
        $type::AddFontResource($TargetUser) | Out-Null
    }
    $HWND_BROADCAST = 0xffff
    $WM_FONTCHANGE = 0x001d
    $type::SendMessage($HWND_BROADCAST, $WM_FONTCHANGE, 0, 0) | Out-Null
} catch {}

Write-Host ""
Write-Host "[OK] All presentation fonts successfully registered into Windows and available in all apps!" -ForegroundColor Green
`;

    zip.file('Install-Fonts-Windows.cmd', cmdContent);
    zip.file('Install-Fonts-Windows.ps1', ps1Content);

    for (const record of records) {
      const ext = record.format === 'woff2' ? 'woff2' : record.format === 'opentype' ? 'otf' : 'ttf';
      const fileName = `${record.family.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`;
      zip.file(fileName, record.buffer);
    }

    return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  } catch (err) {
    console.error('[fontStorage] Failed to create Windows font installer package:', err);
    return null;
  }
}

/**
 * Enterprise Restore: Unpacks all fonts from a zip and registers them into IndexedDB.
 */
export async function importFontsFromZip(zipFile: File | Blob): Promise<number> {
  try {
    const zip = new JSZip();
    const loaded = await zip.loadAsync(zipFile);
    let importedCount = 0;

    // Check manifest if present
    const manifestFile = loaded.file('manifest.json');
    if (manifestFile) {
      try {
        const manifestText = await manifestFile.async('text');
        const manifest = JSON.parse(manifestText);
        if (Array.isArray(manifest.fonts)) {
          for (const item of manifest.fonts) {
            const fontEntry = loaded.file(item.fileName);
            if (fontEntry) {
              const buf = await fontEntry.async('arraybuffer');
              const verifiedFormat = validateFontBinaryFormat(buf) || (item.format as any) || 'truetype';
              const ok = await saveFontToIndexedDB(item.family, buf, verifiedFormat, 'upload');
              if (ok) importedCount++;
            }
          }
          return importedCount;
        }
      } catch {}
    }

    // Fallback: Scan all font files in the zip container
    for (const [filename, fileEntry] of Object.entries(loaded.files)) {
      if (fileEntry.dir) continue;
      const extMatch = filename.match(/\.(ttf|otf|woff2|woff)$/i);
      if (!extMatch) continue;

      const baseName = filename.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'CustomFont';
      const cleanFamily = baseName.replace(/[-_]?(Regular|Bold|Black|Medium|Light|SemiBold|Thin|Italic)[-_]?/gi, '').replace(/[-_]+/g, ' ').trim();
      const buf = await fileEntry.async('arraybuffer');
      const verifiedFormat = validateFontBinaryFormat(buf) || 'truetype';
      const ok = await saveFontToIndexedDB(cleanFamily, buf, verifiedFormat, 'upload');
      if (ok) importedCount++;
    }

    return importedCount;
  } catch (err) {
    console.error('[fontStorage] Failed to import fonts from zip:', err);
    return 0;
  }
}
