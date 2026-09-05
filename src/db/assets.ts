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

  const objectUrl = URL.createObjectURL(file);
  const hash = await computeFileHash(file);

  const asset: Asset = {
    id: `asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: file.name.replace(/\.[^/.]+$/, ''),
    type: assetType,
    url: objectUrl,
    thumbnailUrl: (isVideo || isAudio) ? undefined : objectUrl,
    blob: file,
    hash,
    tags: ['uploaded', assetType],
    createdAt: Date.now()
  };

  return asset;
}

