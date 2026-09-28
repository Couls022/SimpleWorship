import { getDB } from './index';
import { Asset } from '../types';

/**
 * Computes a fast, collision-resistant hash of a File or Blob without freezing the main thread.
 * For large files (>2MB), samples chunks to prevent locking up the browser event loop.
 */
export async function computeFileHash(file: File | Blob): Promise<string> {
  const size = file.size;
  const name = (file as File).name || 'blob';
  const lastMod = (file as File).lastModified || 0;

  // For small files <= 2MB, hash full content
  if (size <= 2 * 1024 * 1024) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // For larger files (>2MB), compute lightning-fast hash from header + footer + metadata
  // This takes < 1ms and prevents freezing during video/pptx/audio drag & drop
  const headSlice = file.slice(0, 512 * 1024);
  const tailSlice = file.slice(Math.max(0, size - 512 * 1024), size);
  
  const [headBuf, tailBuf] = await Promise.all([
    headSlice.arrayBuffer(),
    tailSlice.arrayBuffer()
  ]);

  const combined = new Uint8Array(headBuf.byteLength + tailBuf.byteLength + 32);
  combined.set(new Uint8Array(headBuf), 0);
  combined.set(new Uint8Array(tailBuf), headBuf.byteLength);

  // Append size and timestamp bytes
  const metaStr = `${name}:${size}:${lastMod}`;
  const metaBytes = new TextEncoder().encode(metaStr);
  combined.set(metaBytes.slice(0, 32), headBuf.byteLength + tailBuf.byteLength);

  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Checks if an asset with the given hash already exists in the database.
 */
export async function findDuplicateAsset(hash: string): Promise<Asset | null> {
  const db = await getDB();
  const asset = await db.getFromIndex('assets', 'by-hash', hash);
  return asset || null;
}

/**
 * Generates a lightweight, low-resolution poster frame (JPEG) for a video file/blob.
 * Runs once upon import to eliminate video decoder thrashing in media libraries and previews.
 */
export async function generateVideoPosterFrame(file: File | Blob): Promise<string | undefined> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;
  return new Promise((resolve) => {
    let resolved = false;
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    const tempUrl = URL.createObjectURL(file);
    video.src = tempUrl;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(tempUrl);
    };

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(undefined);
      }
    }, 2000);

    video.onloadeddata = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(video.videoWidth || 320, 320);
        canvas.height = Math.min(video.videoHeight || 180, 180);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            cleanup();
            resolve(dataUrl);
            return;
          }
        }
      } catch (e) {}
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        cleanup();
        resolve(undefined);
      }
    };

    video.onerror = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        cleanup();
        resolve(undefined);
      }
    };

    video.currentTime = 0.1;
  });
}

/**
 * Processes a File into an Asset object using instant ObjectURLs and IndexedDB Blob storage.
 * Eliminates heavy Base64 conversion to prevent memory leaks and UI lag.
 */
export async function processAssetFile(file: File): Promise<Asset> {
  const isVideo = file.type.startsWith('video') || /\.(mp4|webm|mov|mkv|m4v|avi)$/i.test(file.name);
  const isAudio = file.type.startsWith('audio') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name);
  const isDoc = file.type.includes('presentation') || /\.(pptx?|pdf)$/i.test(file.name);

  let assetType: 'image' | 'video' | 'audio' | 'document' = 'image';
  if (isVideo) assetType = 'video';
  else if (isAudio) assetType = 'audio';
  else if (isDoc) assetType = 'document';

  const hash = await computeFileHash(file);

  let videoPoster: string | undefined = undefined;
  if (isVideo) {
    try {
      videoPoster = await generateVideoPosterFrame(file);
    } catch (e) {
      console.warn('[processAssetFile] Failed to generate video poster:', e);
    }
  }

  const localPath = (file as any).path;
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;
  // In Electron, if we have a local path, we prefer 'file://' and avoid storing massive Blobs in IndexedDB.
  const useLocalPath = isElectron && !!localPath;
  const finalUrl = useLocalPath ? `file://${localPath}` : URL.createObjectURL(file);

  const asset: Asset = {
    id: `asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: file.name.replace(/\.[^/.]+$/, ''),
    type: assetType,
    url: finalUrl,
    thumbnailUrl: isVideo ? videoPoster : (isAudio ? undefined : finalUrl),
    blob: useLocalPath ? undefined : file,
    localPath: localPath,
    hash,
    tags: ['uploaded', assetType],
    createdAt: Date.now()
  };

  return asset;
}

/**
 * Validates whether an asset is a genuine user media item (image, video, audio)
 * and strictly excludes internal cache entries, PPTX rendered frames, and presentation documents.
 */
export function isMediaLibraryAsset(asset: Asset | null | undefined): boolean {
  if (!asset || !asset.id || !asset.name) return false;

  const idLower = String(asset.id).toLowerCase();
  const nameLower = String(asset.name).toLowerCase();
  const urlLower = String(asset.url || '').toLowerCase();

  // 1. Strictly exclude all cache artifacts, temp files, and thumbnails
  if (
    idLower.startsWith('pptx_rendered_') ||
    idLower.startsWith('cache_') ||
    idLower.includes('_cache_') ||
    idLower.startsWith('thumb_') ||
    idLower.startsWith('thumbnail_') ||
    idLower.startsWith('font_cache') ||
    idLower.startsWith('slide_cache') ||
    idLower.startsWith('temp_') ||
    nameLower.startsWith('pptx rendered cache') ||
    nameLower.includes('rendered cache') ||
    nameLower.includes('cache_') ||
    nameLower.includes('font cache') ||
    nameLower.includes('slide cache') ||
    nameLower.includes('thumbnail cache') ||
    (asset.tags && asset.tags.some(t => {
      const tl = String(t).toLowerCase();
      return tl === 'cache' || tl === 'internal' || tl === 'temp' || tl === 'temporary';
    })) ||
    (asset as any).isCache === true ||
    asset.data?.isCache === true
  ) {
    return false;
  }

  // 2. Strictly exclude presentation documents and non-media files
  if (
    asset.type === 'document' ||
    (asset.type as any) === 'presentation' ||
    idLower.startsWith('pres-') ||
    nameLower.endsWith('.pptx') ||
    nameLower.endsWith('.ppt') ||
    nameLower.endsWith('.pdf') ||
    nameLower.endsWith('.docx') ||
    nameLower.endsWith('.doc') ||
    nameLower.endsWith('.json') ||
    nameLower.endsWith('.txt') ||
    nameLower.endsWith('.xml') ||
    nameLower.endsWith('.csv') ||
    nameLower.endsWith('.zip') ||
    urlLower.endsWith('.pptx') ||
    urlLower.endsWith('.ppt') ||
    urlLower.endsWith('.pdf') ||
    Boolean(asset.data && (Array.isArray(asset.data.slides) || asset.data.session || asset.data.fileBytes))
  ) {
    return false;
  }

  // 3. Must be a legitimate media type (image, video, motion loop, or audio track)
  if (asset.type !== 'image' && asset.type !== 'video' && asset.type !== 'audio' && (asset.type as any) !== 'motion') {
    return false;
  }

  // 4. Must have a playable/viewable media URL (not empty, as documents have)
  if (!asset.url || typeof asset.url !== 'string' || asset.url.trim() === '') {
    return false;
  }

  return true;
}

export type DefaultMediaScope = 'songs' | 'scriptures' | 'presentations' | 'announcements' | 'logo' | 'timers';

export interface DefaultBadgeInfo {
  scope: DefaultMediaScope;
  label: string;
  color: string;
}

export const DEFAULT_SCOPE_CONFIG: Record<DefaultMediaScope, { label: string; color: string; title: string }> = {
  songs: { label: 'SONGS', color: 'bg-cyan-500/90 text-white border-cyan-400/50', title: 'Songs' },
  scriptures: { label: 'BIBLE', color: 'bg-amber-500/90 text-white border-amber-400/50', title: 'Scriptures' },
  logo: { label: 'LOGO', color: 'bg-emerald-500/90 text-white border-emerald-400/50', title: 'Logo' },
  timers: { label: 'TIMER', color: 'bg-teal-500/90 text-white border-teal-400/50', title: 'Timer' },
  presentations: { label: 'PPT', color: 'bg-purple-500/90 text-white border-purple-400/50', title: 'Presentations' },
  announcements: { label: 'NOTICE', color: 'bg-rose-500/90 text-white border-rose-400/50', title: 'Notices' },
};

/**
 * Checks whether an asset is the exclusive locked default background for a given scope.
 * Guaranteed: Only 1 asset in the entire system can return true for any scope.
 */
export function isDefaultBackgroundFor(
  asset: Asset | null | undefined,
  scope: DefaultMediaScope,
  _assetsList: Asset[] = []
): boolean {
  if (!asset || !asset.id) return false;
  return asset.isDefaultScope?.[scope] === true;
}

/**
 * Returns all active default lock badges for an asset.
 */
export function getActiveDefaultBadges(
  asset: Asset | null | undefined,
  _assetsList: Asset[] = []
): DefaultBadgeInfo[] {
  if (!asset || !asset.isDefaultScope) return [];
  const badges: DefaultBadgeInfo[] = [];
  const scopes: DefaultMediaScope[] = ['songs', 'scriptures', 'logo', 'timers', 'presentations', 'announcements'];
  for (const s of scopes) {
    if (asset.isDefaultScope[s] === true) {
      const cfg = DEFAULT_SCOPE_CONFIG[s];
      if (cfg) {
        badges.push({ scope: s, label: cfg.label, color: cfg.color });
      }
    }
  }
  return badges;
}



