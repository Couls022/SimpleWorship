/**
 * SimpleWorship Server-Side Font Downloader & Resolver
 * Provides reliable, CORS-free font discovery and binary streaming for offline desktop presentation
 */

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

export async function downloadFontBinary(family: string): Promise<FontDownloadResult> {
  if (!family) {
    return { success: false, family: '', error: 'Missing font family' };
  }

  const cleanFamily = family.replace(/^["']+|["']+$/g, '').trim();
  const formatted = encodeURIComponent(cleanFamily).replace(/%20/g, '+');

  // 1. Primary: Google Fonts CSS -> woff2 binary
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
