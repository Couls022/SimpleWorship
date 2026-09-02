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
