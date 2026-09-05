import { getDB } from './index';
import { Asset } from '../types';
import { ParsedSlide } from '../utils/pptxParser';
import { computeFileHash } from './assets';
import { isValidPptxBinary } from '../utils/pptxValidator';

export async function savePresentation(
  name: string, 
  slides: ParsedSlide[], 
  file?: File | Blob,
  existingId?: string,
  existingFileBytes?: Uint8Array | ArrayBuffer
): Promise<Asset> {
  const db = await getDB();
  
  let hash = `hash_${Date.now()}`;
  let fileBuffer: ArrayBuffer | undefined = undefined;
  
  if (file && file.size >= 4) {
    try {
      hash = await computeFileHash(file);
      const buf = await file.arrayBuffer();
      if (isValidPptxBinary(buf)) {
        fileBuffer = buf;
      }
    } catch (e) {
      console.warn('[presentations] Error reading presentation binary:', e);
    }
  } else if (existingFileBytes && isValidPptxBinary(existingFileBytes)) {
    fileBuffer = existingFileBytes instanceof ArrayBuffer ? existingFileBytes : existingFileBytes.buffer;
  } else if (existingId) {
    // Attempt to recover existing file bytes if not explicitly provided
    const existingAsset = await db.get('assets', existingId);
    if (existingAsset?.data?.fileBytes && isValidPptxBinary(existingAsset.data.fileBytes)) {
      fileBuffer = existingAsset.data.fileBytes;
      if (existingAsset.hash) {
        hash = existingAsset.hash;
      }
    }
  }

  const asset: Asset = {
    id: existingId || `pres-${Date.now()}`,
    name,
    type: 'document',
    hash,
    url: '',
    data: {
      slides,
      fileBytes: fileBuffer
    },
    createdAt: Date.now()
  };

  await db.put('assets', asset);
  return asset;
}

export async function getAllPresentations(): Promise<Asset[]> {
  const db = await getDB();
  const allAssets = await db.getAllFromIndex('assets', 'by-type', 'document');
  // Strip heavy fileBytes to prevent massive memory consumption when listing presentations
  return allAssets.map(asset => {
    if (asset.data && asset.data.fileBytes) {
      const { fileBytes, ...restData } = asset.data;
      return { ...asset, data: restData };
    }
    return asset;
  });
}

export async function deletePresentation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('assets', id);
}
