import { getDB } from './index';
import { Asset } from '../types';
import { ParsedSlide } from '../utils/pptxParser';
import { computeFileHash } from './assets';

export async function savePresentation(name: string, slides: ParsedSlide[], file?: File): Promise<Asset> {
  const db = await getDB();
  
  let hash = `hash_${Date.now()}`;
  let fileBuffer: ArrayBuffer | undefined = undefined;
  
  if (file) {
    hash = await computeFileHash(file);
    fileBuffer = await file.arrayBuffer();
  }

  const asset: Asset = {
    id: `pres-${Date.now()}`,
    name,
    type: 'document',
    hash,
    url: '', // No direct URL for PPTX binary needed right now
    data: {
      slides,
      fileBytes: fileBuffer // Store the actual PPTX binary for native rendering
    },
    createdAt: Date.now()
  };

  await db.put('assets', asset);
  return asset;
}

export async function getAllPresentations(): Promise<Asset[]> {
  const db = await getDB();
  const allAssets = await db.getAllFromIndex('assets', 'by-type', 'document');
  return allAssets;
}

export async function deletePresentation(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('assets', id);
}
