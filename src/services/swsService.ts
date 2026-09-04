import { Schedule, PresentationItem, Song, Theme, SystemOptions, OutputGroup } from '../types';
import { dbApi } from '../db';
import JSZip from 'jszip';

export interface SwsPackage {
  format: 'SimpleWorshipSchedule';
  version: '1.0';
  app: 'SimpleWorship';
  timestamp: number;
  schedule: Schedule;
  bundledSongs?: Song[];
  bundledThemes?: Theme[];
  systemOptions?: SystemOptions;
  outputGroups?: OutputGroup[];
  checksum?: string;
  metadata?: {
    appVersion: string;
    generator: string;
    totalItems: number;
    hasIcon: boolean;
  };
}

/**
 * Standard High-Resolution Vector Emblem SVG for SimpleWorship
 */
export const SIMPLE_WORSHIP_SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#141824"/>
      <stop offset="50%" stop-color="#0c101a"/>
      <stop offset="100%" stop-color="#06080d"/>
    </linearGradient>
    <linearGradient id="swGradLeft" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#2563EB"/>
    </linearGradient>
    <linearGradient id="swGradCenter" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#60A5FA"/>
      <stop offset="100%" stop-color="#06B6D4"/>
    </linearGradient>
    <linearGradient id="swGradRight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06B6D4"/>
      <stop offset="100%" stop-color="#4F46E5"/>
    </linearGradient>
    <linearGradient id="swBeam" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#38BDF8" stop-opacity="0.05"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Container Tile with Rounded Corners -->
  <rect width="512" height="512" rx="96" fill="url(#bgGrad)" stroke="#06b6d4" stroke-width="8" stroke-opacity="0.4"/>

  <!-- Sanctuary Ambient Beam in background -->
  <polygon points="256,60 440,430 72,430" fill="url(#swBeam)" opacity="0.3"/>

  <!-- Left Wing of 'W' -->
  <path d="M 85 140 L 165 410 L 225 410 L 165 140 Z" fill="url(#swGradLeft)" filter="url(#glow)"/>

  <!-- Center Cross Diamond Apex -->
  <polygon points="256,68 296,128 256,188 216,128" fill="#FFFFFF"/>

  <!-- Center Peak of 'W' -->
  <path d="M 200 210 L 256 390 L 312 210 L 278 210 L 256 290 L 234 210 Z" fill="url(#swGradCenter)" filter="url(#glow)"/>

  <!-- Right Wing of 'W' -->
  <path d="M 347 140 L 287 410 L 347 410 L 427 140 Z" fill="url(#swGradRight)" filter="url(#glow)"/>

  <!-- Sanctuary Base Accent -->
  <rect x="100" y="435" width="312" height="18" rx="9" fill="#38BDF8" opacity="0.9"/>
  
  <!-- File Type Badge Footer -->
  <rect x="160" y="465" width="192" height="24" rx="6" fill="#06b6d4" fill-opacity="0.2" stroke="#38bdf8" stroke-width="2"/>
  <text x="256" y="482" fill="#38bdf8" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="900" text-anchor="middle" letter-spacing="3">SIMPLEWORSHIP .SWS</text>
</svg>`;

/**
 * Generates a PNG raster icon data URL from the SVG icon using an HTML5 Canvas
 */
export async function generateSwsPngBlob(): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      const svgBlob = new Blob([SIMPLE_WORSHIP_SVG_ICON], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(svgBlob);
          return;
        }
        ctx.drawImage(img, 0, 0, 512, 512);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            resolve(svgBlob);
          }
        }, 'image/png');
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(svgBlob);
      };

      img.src = url;
    } catch (err) {
      resolve(new Blob([SIMPLE_WORSHIP_SVG_ICON], { type: 'image/svg+xml' }));
    }
  });
}

/**
 * Validates and parses an SWS text, JSON string, or raw schedule data into a Schedule object
 */
export function parseSwsContent(content: string): { 
  schedule: Schedule; 
  bundledSongs?: Song[]; 
  bundledThemes?: Theme[];
  systemOptions?: SystemOptions;
  outputGroups?: OutputGroup[];
  metadata?: SwsPackage['metadata'];
} {
  try {
    const data = JSON.parse(content);

    // Format 1: SWS Package format
    if (data.format === 'SimpleWorshipSchedule' && data.schedule) {
      const sched = data.schedule;
      return {
        schedule: {
          id: sched.id || `sched-${Date.now()}`,
          name: sched.name || 'Imported Schedule',
          createdAt: sched.createdAt || Date.now(),
          items: Array.isArray(sched.items) ? sched.items : []
        },
        bundledSongs: data.bundledSongs,
        bundledThemes: data.bundledThemes,
        systemOptions: data.systemOptions,
        outputGroups: data.outputGroups,
        metadata: data.metadata
      };
    }

    // Format 2: Direct schedule object (.sws or .json)
    if (data.name && Array.isArray(data.items)) {
      return {
        schedule: {
          id: data.id || `sched-${Date.now()}`,
          name: data.name,
          createdAt: data.createdAt || Date.now(),
          items: data.items
        }
      };
    }

    // Format 3: Raw array of items
    if (Array.isArray(data)) {
      return {
        schedule: {
          id: `sched-${Date.now()}`,
          name: 'Imported Service Set',
          createdAt: Date.now(),
          items: data
        }
      };
    }

    throw new Error('Unsupported SimpleWorship file structure');
  } catch (err: any) {
    throw new Error(`Corrupted or invalid .sws file: ${err.message}`);
  }
}

/**
 * Encodes a schedule into standard .sws JSON package
 */
export function encodeSwsPackage(
  schedule: Schedule, 
  bundledSongs: Song[] = [], 
  bundledThemes: Theme[] = [],
  systemOptions?: SystemOptions,
  outputGroups?: OutputGroup[]
): SwsPackage {
  return {
    format: 'SimpleWorshipSchedule',
    version: '1.0',
    app: 'SimpleWorship',
    timestamp: Date.now(),
    schedule,
    bundledSongs,
    bundledThemes,
    systemOptions,
    outputGroups,
    metadata: {
      appVersion: '1.0.0',
      generator: 'SimpleWorship Presentation Suite',
      totalItems: schedule.items.length,
      hasIcon: true
    }
  };
}

/**
 * Creates an enterprise-grade zipped SWS archive containing:
 * - schedule.json (The manifest & schedule details)
 * - icon.svg (SimpleWorship Brand Vector Emblem)
 * - icon.png (Raster thumbnail icon for OS file systems)
 * - thumbnail.svg (Visual schedule cover preview)
 * - README.txt (File standard & description)
 * 
 * Falls back cleanly to standalone JSON if zip generation encounters any constraints.
 */
export async function buildEnterpriseSwsBundle(
  schedule: Schedule,
  bundledSongs: Song[] = [],
  bundledThemes: Theme[] = [],
  systemOptions?: SystemOptions,
  outputGroups?: OutputGroup[]
): Promise<Blob> {
  const pkg = encodeSwsPackage(schedule, bundledSongs, bundledThemes, systemOptions, outputGroups);
  
  try {
    const zip = new JSZip();

    // 1. Core manifest schedule payload
    zip.file('schedule.json', JSON.stringify(pkg, null, 2));

    // 2. SimpleWorship Emblem vector icon
    zip.file('icon.svg', SIMPLE_WORSHIP_SVG_ICON);

    // 3. SimpleWorship PNG raster thumbnail
    try {
      const pngBlob = await generateSwsPngBlob();
      zip.file('icon.png', pngBlob);
    } catch (e) {
      console.warn('Could not generate PNG icon for .sws package, continuing with SVG only', e);
    }

    // 4. Visual cover / preview card representation
    const scheduleItemsSummary = schedule.items.slice(0, 5).map((it, idx) => 
      `<text x="40" y="${280 + idx * 30}" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="14">${idx + 1}. [${it.type.toUpperCase()}] ${escapeXml(it.name)}</text>`
    ).join('\n');

    const previewSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
      <rect width="800" height="500" fill="#0f172a"/>
      <rect x="20" y="20" width="760" height="460" rx="16" fill="#1e293b" stroke="#0ea5e9" stroke-width="2"/>
      <text x="40" y="80" fill="#38bdf8" font-family="system-ui, sans-serif" font-size="28" font-weight="bold">SimpleWorship Schedule Package</text>
      <text x="40" y="120" fill="#ffffff" font-family="system-ui, sans-serif" font-size="20" font-weight="bold">${escapeXml(schedule.name)}</text>
      <text x="40" y="150" fill="#64748b" font-family="system-ui, sans-serif" font-size="13">Items: ${schedule.items.length} | Created: ${new Date().toLocaleDateString()}</text>
      <line x1="40" y1="180" x2="740" y2="180" stroke="#334155" stroke-width="2"/>
      <text x="40" y="220" fill="#38bdf8" font-family="system-ui, sans-serif" font-size="16" font-weight="bold">SERVICE RUNDOWN</text>
      ${scheduleItemsSummary}
    </svg>`;

    zip.file('preview.svg', previewSvg);

    // 5. Enterprise file metadata manifest
    const readme = `SimpleWorship Schedule File (.sws)
======================================================
Format: SimpleWorship Schedule Package v1.0
App: SimpleWorship Pro Presentation Suite
Schedule: ${schedule.name}
Total Items: ${schedule.items.length}
Bundled Songs: ${bundledSongs.length}
Bundled Themes: ${bundledThemes.length}
Generated: ${new Date().toISOString()}

This file is an official SimpleWorship archive designed for worship projection and multi-screen broadcasting.
`;
    zip.file('README.txt', readme);

    return await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.simpleworship.schedule',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });
  } catch (err) {
    console.warn('Zip package builder failed, falling back to structured JSON .sws', err);
    return new Blob([JSON.stringify(pkg, null, 2)], { 
      type: 'application/vnd.simpleworship.schedule+json;charset=utf-8' 
    });
  }
}

/**
 * Helper to escape XML strings
 */
function escapeXml(unsafe: string): string {
  return (unsafe || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Downloads a schedule file as enterprise-ready .sws package with icons and metadata
 */
export async function downloadSwsFile(
  schedule: Schedule, 
  filename?: string,
  bundledSongs: Song[] = [],
  bundledThemes: Theme[] = [],
  systemOptions?: SystemOptions,
  outputGroups?: OutputGroup[]
) {
  const blob = await buildEnterpriseSwsBundle(schedule, bundledSongs, bundledThemes, systemOptions, outputGroups);
  const safeName = (filename || schedule.name || 'Sunday_Service').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const defaultName = `${safeName}.sws`;

  // Native Electron desktop save dialog support
  if (typeof window !== 'undefined' && window.electronAPI?.saveSwsFile) {
    try {
      const buffer = await blob.arrayBuffer();
      const res = await window.electronAPI.saveSwsFile(defaultName, new Uint8Array(buffer));
      if (res && (!res.canceled || res.filePath)) {
        return;
      }
      if (res && res.canceled) {
        return;
      }
    } catch (e) {
      console.warn('Electron native save dialog failed, falling back to browser download', e);
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = defaultName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Reads a File or Blob object and extracts schedule, automatically handling:
 * 1. Zipped enterprise .sws archives (with icon.png, icon.svg, schedule.json)
 * 2. Standalone JSON .sws packages
 * 3. Legacy worship files (.json, .worship, etc.)
 */
export async function readSwsFile(file: File | Blob): Promise<{ 
  schedule: Schedule; 
  bundledSongs?: Song[]; 
  bundledThemes?: Theme[];
  systemOptions?: SystemOptions;
  outputGroups?: OutputGroup[];
  iconUrl?: string;
}> {
  // First try to check if the file is a zip archive
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(arrayBuffer);

    // Look for schedule.json or .json inside archive
    let scheduleJsonFile = loadedZip.file('schedule.json');
    if (!scheduleJsonFile) {
      const jsonFiles = loadedZip.file(/\.json$/i);
      if (jsonFiles && jsonFiles.length > 0) {
        scheduleJsonFile = jsonFiles[0];
      }
    }

    if (scheduleJsonFile) {
      const jsonText = await scheduleJsonFile.async('text');
      const parsed = parseSwsContent(jsonText);

      let iconUrl: string | undefined;
      const iconSvgFile = loadedZip.file('icon.svg');
      const iconPngFile = loadedZip.file('icon.png');

      if (iconSvgFile) {
        const svgText = await iconSvgFile.async('text');
        iconUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svgText)}`;
      } else if (iconPngFile) {
        const pngBlob = await iconPngFile.async('blob');
        iconUrl = URL.createObjectURL(pngBlob);
      }

      return {
        ...parsed,
        iconUrl
      };
    }
  } catch (zipErr) {
    // If not a valid zip, gracefully continue to plain text reader
  }

  // Fallback: Read as text (JSON .sws)
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const result = parseSwsContent(text);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read .sws file from disk'));
    reader.readAsText(file);
  });
}
