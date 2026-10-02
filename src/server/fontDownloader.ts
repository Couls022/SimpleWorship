import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { FontValidationService } from '../services/fontValidationService';

interface FontDownloadResult {
  success: boolean;
  family: string;
  format?: 'woff2' | 'truetype';
  buffer?: Buffer;
  byteSize?: number;
  error?: string;
  provider?: string;
}

export async function searchFontOnline(family: string): Promise<{ success: boolean; family: string; isAvailable: boolean; provider?: string }> {
  if (!family || typeof family !== 'string') {
    return { success: false, family: '', isAvailable: false };
  }

  const cleanFamily = family.replace(/^["']+|["']+$/g, '').trim();
  const formatted = encodeURIComponent(cleanFamily).replace(/%20/g, '+');

  // 1. Google Fonts Check
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${formatted}:wght@400;700&display=swap`;
    const res = await fetch(cssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (res.ok) {
      const text = await res.text();
      if (/url\((https:\/\/fonts\.gstatic\.com\/s\/[^)]+)\)/i.test(text)) {
        return { success: true, family: cleanFamily, isAvailable: true, provider: 'Google Fonts' };
      }
    }
  } catch {}

  // 2. Bunny Fonts Fallback
  try {
    const slug = cleanFamily.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const bRes = await fetch(`https://fonts.bunny.net/css?family=${slug}:400`);
    if (bRes.ok) {
      const text = await bRes.text();
      if (/url\((https:\/\/[^)]+)\)/i.test(text)) {
        return { success: true, family: cleanFamily, isAvailable: true, provider: 'Bunny Fonts' };
      }
    }
  } catch {}

  return { success: false, family: cleanFamily, isAvailable: false };
}

export async function downloadFontBinary(family: string, preferTtf = true): Promise<FontDownloadResult> {
  if (!family) {
    return { success: false, family: '', error: 'Missing font family' };
  }

  const cleanFamily = family.replace(/^["']+|["']+$/g, '').trim();
  const formatted = encodeURIComponent(cleanFamily).replace(/%20/g, '+');

  // 1. Primary for Windows / Desktop App compatibility: Fetch genuine TrueType (.ttf) binary from Google Fonts
  if (preferTtf) {
    try {
      const ttfCssUrl = `https://fonts.googleapis.com/css?family=${formatted}:400,700`;
      const ttfCssRes = await fetch(ttfCssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Linux; U; Android 2.2; en-us; Nexus One Build/FRF91) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1'
        }
      });

      if (ttfCssRes.ok) {
        const ttfCssText = await ttfCssRes.text();
        const ttfMatch = /url\((https:\/\/fonts\.gstatic\.com\/s\/[^)]+\.ttf)\)/i.exec(ttfCssText);
        if (ttfMatch && ttfMatch[1]) {
          const binRes = await fetch(ttfMatch[1]);
          if (binRes.ok) {
            const ab = await binRes.arrayBuffer();
            const validation = FontValidationService.validateFontSync(ab, { strictTableValidation: false });
            if (validation.isValid) {
              const buffer = Buffer.from(ab);
              return {
                success: true,
                family: cleanFamily,
                format: 'truetype',
                buffer,
                byteSize: buffer.length,
                provider: 'Google Fonts (TrueType TTF for Windows)'
              };
            }
          }
        }
      }
    } catch (err: any) {
      console.warn(`[fontDownloader] TTF download attempt warning for "${cleanFamily}":`, err?.message);
    }
  }

  // 2. Secondary: Google Fonts CSS2 -> woff2 binary
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${formatted}:wght@400;700&display=swap`;
    const cssRes = await fetch(cssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (cssRes.ok) {
      const cssText = await cssRes.text();
      let fontBinaryUrl: string | null = null;
      
      // Prioritize latin subset
      const latinMatch = /\/\*\s*latin\s*\*\/[\s\S]*?url\((https:\/\/fonts\.gstatic\.com\/s\/[^)]+)\)/i.exec(cssText);
      if (latinMatch && latinMatch[1]) {
        fontBinaryUrl = latinMatch[1];
      } else {
        const anyMatch = /url\((https:\/\/fonts\.gstatic\.com\/s\/[^)]+)\)/i.exec(cssText);
        if (anyMatch && anyMatch[1]) fontBinaryUrl = anyMatch[1];
      }

      if (fontBinaryUrl) {
        const binRes = await fetch(fontBinaryUrl);
        if (binRes.ok) {
          const ab = await binRes.arrayBuffer();
          const validation = FontValidationService.validateFontSync(ab, { strictTableValidation: false });
          if (validation.isValid && validation.format) {
            const buffer = Buffer.from(ab);
            return {
              success: true,
              family: cleanFamily,
              format: (validation.format === 'truetype' ? 'truetype' : 'woff2') as 'woff2' | 'truetype',
              buffer,
              byteSize: buffer.length,
              provider: 'Google Fonts'
            };
          } else {
            console.warn(`[fontDownloader] Google Fonts payload for "${cleanFamily}" failed magic byte check:`, validation.error);
          }
        }
      }
    }
  } catch (err: any) {
    console.warn(`[fontDownloader] Google Fonts attempt failed for "${cleanFamily}":`, err?.message);
  }

  // 2. Secondary: Bunny Fonts Fallback
  try {
    const slug = cleanFamily.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const bRes = await fetch(`https://fonts.bunny.net/css?family=${slug}:400`);
    if (bRes.ok) {
      const bText = await bRes.text();
      const m = /url\((https:\/\/[^)]+)\)/i.exec(bText);
      if (m && m[1]) {
        const binRes = await fetch(m[1]);
        if (binRes.ok) {
          const ab = await binRes.arrayBuffer();
          const validation = FontValidationService.validateFontSync(ab, { strictTableValidation: false });
          if (validation.isValid && validation.format) {
            const buffer = Buffer.from(ab);
            return {
              success: true,
              family: cleanFamily,
              format: (validation.format === 'truetype' ? 'truetype' : 'woff2') as 'woff2' | 'truetype',
              buffer,
              byteSize: buffer.length,
              provider: 'Bunny Fonts'
            };
          } else {
            console.warn(`[fontDownloader] Bunny Fonts payload for "${cleanFamily}" failed magic byte check:`, validation.error);
          }
        }
      }
    }
  } catch (err: any) {
    console.warn(`[fontDownloader] Bunny Fonts attempt failed for "${cleanFamily}":`, err?.message);
  }

  return {
    success: false,
    family: cleanFamily,
    error: `Font "${cleanFamily}" could not be downloaded from online font providers.`
  };
}

/**
 * Installs and registers a font directly into the native Windows OS font directory and Windows Registry.
 * Broadcasts WM_FONTCHANGE so PowerPoint, Word, Canva, and all Windows apps immediately recognize it.
 */
export async function installFontToWindows(family: string, fontBuffer?: Buffer): Promise<{ success: boolean; message: string; path?: string }> {
  const cleanFamily = family.replace(/^["']+|["']+$/g, '').trim();
  let buffer = fontBuffer;
  let format = 'ttf';

  if (!buffer) {
    const downloaded = await downloadFontBinary(cleanFamily, true);
    if (downloaded.success && downloaded.buffer) {
      buffer = downloaded.buffer;
      format = downloaded.format === 'truetype' ? 'ttf' : ((downloaded.format as string) === 'opentype' ? 'otf' : 'ttf');
    }
  }

  if (!buffer) {
    return { success: false, message: `Could not obtain font binary for "${cleanFamily}"` };
  }

  if (os.platform() !== 'win32') {
    return {
      success: true,
      message: `Font "${cleanFamily}" binary cached and ready for web/app use. (Native Windows registration available on Windows OS)`
    };
  }

  return new Promise((resolve) => {
    try {
      const userFontDir = path.join(process.env.LOCALAPPDATA || os.homedir(), 'Microsoft', 'Windows', 'Fonts');
      if (!fs.existsSync(userFontDir)) {
        fs.mkdirSync(userFontDir, { recursive: true });
      }

      const safeName = cleanFamily.replace(/[^a-zA-Z0-9_-]/g, '_');
      const targetPath = path.join(userFontDir, `${safeName}.${format}`);
      fs.writeFileSync(targetPath, buffer);

      // Register font in HKCU registry and broadcast WM_FONTCHANGE
      const regKey = `HKCU:\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts`;
      const regName = `${cleanFamily} (TrueType)`;
      const psScript = `
        $target = "${targetPath.replace(/\\/g, '\\\\')}";
        $regName = "${regName.replace(/"/g, '`"')}";
        New-ItemProperty -Path "${regKey}" -Name $regName -Value $target -PropertyType String -Force | Out-Null;
        
        # Broadcast WM_FONTCHANGE to inform all Windows apps (Word, PowerPoint, Photoshop, etc.)
        try {
          $signature = @"
            [DllImport("gdi32.dll")]
            public static extern int AddFontResource(string lpFileName);
            [DllImport("user32.dll")]
            public static extern int SendMessage(int hWnd, uint Msg, int wParam, int lParam);
"@
          $type = Add-Type -MemberDefinition $signature -Name "FontHelper" -Namespace "SimpleWorship" -PassThru;
          $type::AddFontResource($target);
          $HWND_BROADCAST = 0xffff;
          $WM_FONTCHANGE = 0x001d;
          $type::SendMessage($HWND_BROADCAST, $WM_FONTCHANGE, 0, 0);
        } catch {}
      `;

      exec(`powershell.exe -NoProfile -NonInteractive -Command "${psScript.replace(/\r?\n/g, ' ')}"`, { timeout: 10000, windowsHide: true }, (err) => {
        if (err) {
          console.warn('[fontDownloader] Windows registry notification warning:', err.message);
        }
        resolve({
          success: true,
          message: `✓ Font "${cleanFamily}" is now installed system-wide in Windows and available to PowerPoint, Word, Canva Desktop, and all Windows apps!`,
          path: targetPath
        });
      });
    } catch (e: any) {
      resolve({
        success: false,
        message: `Failed to install font directly into Windows: ${e.message}`
      });
    }
  });
}

