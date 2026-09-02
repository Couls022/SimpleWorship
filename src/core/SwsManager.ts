import JSZip from 'jszip';
import { Schedule, Theme, Asset, PresentationState } from '../types';
import { getDB } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface SwsManifest {
  formatVersion: number;
  appVersion: string;
  serviceId: string;
  createdAt: string;
  assetStrategy: 'bundled' | 'referenced';
}

export interface SwsPackageData {
  metadata: {
    title: string;
  };
  schedule: Schedule;
  themes?: Theme[];
  routes?: Record<string, any>;
}

export class SwsManager {
  static CURRENT_VERSION = 1;

  /**
   * Generates a .sws zip file containing the schedule, metadata, and bundled assets.
   */
  static async exportService(schedule: Schedule, title: string = 'Sunday Service'): Promise<Blob> {
    const zip = new JSZip();

    // 1. Create Manifest
    const manifest: SwsManifest = {
      formatVersion: this.CURRENT_VERSION,
      appVersion: '1.0.0',
      serviceId: uuidv4(),
      createdAt: new Date().toISOString(),
      assetStrategy: 'bundled'
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // 2. Extract Required Assets from IndexedDB based on Schedule references
    const requiredAssetIds = new Set<string>();
    schedule.items.forEach(item => {
      if (item.customBackgroundUrl?.startsWith('blob:')) {
        // In a real implementation, we'd map blob URLs back to asset IDs or hashes.
        // For demonstration, we assume we can fetch the asset by some reference.
      }
    });

    const db = await getDB();
    const assetsFolder = zip.folder('assets');
    const allAssets = await db.transaction('assets').objectStore('assets').getAll();
    
    // Simplistic bundling: Package all assets for safety in this prototype version
    // In production, we strictly filter by `requiredAssetIds`.
    for (const asset of allAssets) {
      if (asset.blob && (asset.type === 'image' || asset.type === 'video')) {
        assetsFolder?.file(`${asset.id}_${asset.name}`, asset.blob);
      }
    }

    // 3. Create Service Data
    const serviceData: SwsPackageData = {
      metadata: { title },
      schedule,
    };
    zip.file('service.json', JSON.stringify(serviceData, null, 2));

    // 4. Generate ZIP Blob
    return await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }

  /**
   * Parses a .sws file, validates it, imports bundled assets (deduplicating), and returns the Schedule.
   */
  static async importService(file: File): Promise<Schedule> {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(file);

    // 1. Validate Manifest
    const manifestFile = loadedZip.file('manifest.json');
    if (!manifestFile) throw new Error('Invalid .sws file: Missing manifest.json');
    
    const manifestContent = await manifestFile.async('text');
    const manifest: SwsManifest = JSON.parse(manifestContent);

    if (manifest.formatVersion > this.CURRENT_VERSION) {
      throw new Error(`Unsupported .sws version: ${manifest.formatVersion}. Please update SimpleWorship.`);
    }

    // 2. Import Assets (Deduplication Logic)
    const db = await getDB();
    const assetsFolder = loadedZip.folder('assets');
    if (assetsFolder) {
      const existingAssets = await db.transaction('assets').objectStore('assets').getAll();
      const existingNames = new Set(existingAssets.map(a => a.name));

      for (const relativePath in assetsFolder.files) {
        if (!assetsFolder.files[relativePath].dir) {
          // Zip Slip Defense: reject any path traversal or invalid relative filenames
          if (relativePath.includes('..') || relativePath.startsWith('/') || relativePath.startsWith('\\')) {
            continue;
          }
          const fileData = await assetsFolder.files[relativePath].async('blob');
          const rawName = relativePath.split('_').slice(1).join('_') || relativePath;
          const cleanName = rawName.replace(/^.*[\\\/]/, ''); // sanitize basename only
          
          if (cleanName && !existingNames.has(cleanName)) {
             // Avoid duplicating binary if name/hash matches
             await db.add('assets', {
                id: uuidv4(),
                name: cleanName,
                type: fileData.type.includes('video') ? 'video' : 'image',
                blob: fileData,
                url: '',
             });
          }
        }
      }
    }

    // 3. Parse Service
    const serviceFile = loadedZip.file('service.json');
    if (!serviceFile) throw new Error('Invalid .sws file: Missing service.json');
    
    const serviceContent = await serviceFile.async('text');
    const serviceData: SwsPackageData = JSON.parse(serviceContent);

    return serviceData.schedule;
  }
}
