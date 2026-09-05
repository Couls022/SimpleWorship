import { getDB } from './index';
import { Asset } from '../types';

/**
 * Computes a SHA-256 hash of a File or Blob.
 */
export async function computeFileHash(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
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
 * Processes a File into an Asset object, preferring Blob storage and ObjectURLs for heavy media.
 */
export async function processAssetFile(file: File): Promise<Asset> {
  const isVideo = file.type.startsWith('video');
  const isAudio = file.type.startsWith('audio');
  const isLarge = file.size > 2 * 1024 * 1024; // 2MB

  let assetType: 'image' | 'video' | 'audio' = 'image';
  if (isVideo) assetType = 'video';
  else if (isAudio) assetType = 'audio';

  const baseAsset: Partial<Asset> = {
    id: `asset-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: file.name.replace(/\.[^/.]+$/, ''),
    type: assetType,
    tags: ['uploaded', assetType],
  };

  if (isVideo || isAudio || isLarge) {
    const objectUrl = URL.createObjectURL(file);
    return {
      ...(baseAsset as Asset),
      url: objectUrl,
      thumbnailUrl: (isVideo || isAudio) ? undefined : objectUrl,
      blob: file,
    };
  } else {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        resolve({
          ...(baseAsset as Asset),
          url: url,
          thumbnailUrl: (isVideo || isAudio) ? undefined : url,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}
