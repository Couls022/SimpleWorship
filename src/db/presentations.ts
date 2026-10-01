import { getDB, resolveAssetUrl } from './index';
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
  try {
    const db = await getDB();
    const allAssets: Asset[] = [];
    const seenIds = new Set<string>();

    const processAsset = (asset: Asset) => {
      if (!asset || !asset.id || seenIds.has(asset.id)) return;
      seenIds.add(asset.id);

      let returnData = asset.data;
      if (asset.data && asset.data.fileBytes) {
        const { fileBytes, ...restData } = asset.data;
        returnData = restData;
      }
          
      // Resolve slide background URLs
      if (returnData && returnData.slides && Array.isArray(returnData.slides)) {
        returnData.slides = returnData.slides.map((slide: any) => ({
          ...slide,
          backgroundUrl: resolveAssetUrl(slide.backgroundUrl) || slide.backgroundUrl
        }));
      }

      allAssets.push({ ...asset, data: returnData });
    };

    const tx = db.transaction('assets', 'readonly');
    const index = tx.store.index('by-type');

    // 1. Check 'document' type
    try {
      let cursor = await index.openCursor('document');
      while (cursor) {
        processAsset(cursor.value);
        cursor = await cursor.continue();
      }
    } catch (e) {
      console.warn('[presentations] Error querying document index:', e);
    }

    // 2. Check 'presentation' type
    try {
      let cursor2 = await index.openCursor('presentation');
      while (cursor2) {
        processAsset(cursor2.value);
        cursor2 = await cursor2.continue();
      }
    } catch (e) {
      // index might only have document
    }

    // 3. Fallback: if empty, scan all assets to find any containing slide decks
    if (allAssets.length === 0) {
      try {
        const all = await tx.store.getAll();
        for (const item of all) {
          if (item?.data?.slides && Array.isArray(item.data.slides)) {
            processAsset(item);
          }
        }
      } catch (e) {}
    }
    
    return allAssets;
  } catch (err) {
    console.error('[presentations] getAllPresentations error:', err);
    return [];
  }
}

export async function getPresentationById(id: string): Promise<Asset | null> {
  if (!id) return null;
  try {
    const db = await getDB();
    let asset = await db.get('assets', id);
    if (!asset && id.startsWith('asset-')) {
      asset = await db.get('assets', id.replace('asset-', ''));
    } else if (!asset && !id.startsWith('asset-')) {
      asset = await db.get('assets', `asset-${id}`);
    }
    return asset || null;
  } catch (err) {
    console.warn('[presentations] getPresentationById error:', err);
    return null;
  }
}

export async function getPptxFileBytes(idOrContentId: string): Promise<Uint8Array | null> {
  if (!idOrContentId) return null;
  try {
    const db = await getDB();
    const cleanId = idOrContentId.replace(/^(sched-item-|live-item-|pres-drag-)/, '');
    const candidateKeys = [
      idOrContentId,
      cleanId,
      `pres-${cleanId}`,
      `asset-${cleanId}`,
      `asset-${idOrContentId}`,
      idOrContentId.replace(/^asset-/, ''),
      idOrContentId.replace(/^pres-/, ''),
    ];

    for (const key of candidateKeys) {
      const asset = await db.get('assets', key);
      if (asset?.data?.fileBytes && isValidPptxBinary(asset.data.fileBytes)) {
        return asset.data.fileBytes instanceof Uint8Array 
          ? asset.data.fileBytes 
          : new Uint8Array(asset.data.fileBytes);
      }
      if (asset?.blob) {
        const buf = await asset.blob.arrayBuffer();
        if (isValidPptxBinary(buf)) {
          return new Uint8Array(buf);
        }
      }
    }

    // Fallback: search all assets if not found by primary keys
    const all = await db.getAll('assets');
    for (const a of all) {
      if ((a.id === idOrContentId || a.name === idOrContentId || a.hash === idOrContentId) && a.data?.fileBytes) {
        if (isValidPptxBinary(a.data.fileBytes)) {
          return a.data.fileBytes instanceof Uint8Array ? a.data.fileBytes : new Uint8Array(a.data.fileBytes);
        }
      }
    }
    return null;
  } catch (err) {
    console.warn('[presentations] getPptxFileBytes error:', err);
    return null;
  }
}

export async function deletePresentation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('assets', id);
}
