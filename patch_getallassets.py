import re

with open('src/db/index.ts', 'r') as f:
    content = f.read()

old_getAll = """  async getAllAssets() {
    const db = await getDB();
    // Getting all assets can be slow if there are massive blobs.
    // However, IndexedDB mostly returns references.
    const assets = await db.getAll('assets');
    return assets.map(a => {
      if (a.blob && a.url && a.url.startsWith('blob:')) {
        if (!objectUrlCache.has(a.id)) {
          objectUrlCache.set(a.id, URL.createObjectURL(a.blob));
        }
        (a as any)._oldUrl = a.url;
        a.url = objectUrlCache.get(a.id)!;
        assetUrlMap.set((a as any)._oldUrl, a.url);
        assetUrlMap.set(a.id, a.url);
        if (a.thumbnailUrl && a.thumbnailUrl.startsWith('blob:')) {
          a.thumbnailUrl = a.url;
        }
      }
      return a;
    });
  },"""

new_getAll = """  async getAllAssets() {
    const db = await getDB();
    // Getting all assets can be slow if there are massive blobs.
    const assets = await db.getAll('assets');
    return assets.map(a => {
      if (a.blob && a.url && a.url.startsWith('blob:')) {
        if (!objectUrlCache.has(a.id)) {
          objectUrlCache.set(a.id, URL.createObjectURL(a.blob));
        }
        (a as any)._oldUrl = a.url;
        a.url = objectUrlCache.get(a.id)!;
        assetUrlMap.set((a as any)._oldUrl, a.url);
        assetUrlMap.set(a.id, a.url);
        if (a.thumbnailUrl && a.thumbnailUrl.startsWith('blob:')) {
          a.thumbnailUrl = a.url;
        }
      }
      // Strip blob to prevent JS heap exhaustion and GC lags
      const { blob, ...assetWithoutBlob } = a;
      return assetWithoutBlob as Asset;
    });
  },"""

content = content.replace(old_getAll, new_getAll)

old_addAsset = """  async addAsset(asset: Asset) {
    if (asset.url && asset.url.startsWith('blob:')) {
      objectUrlCache.set(asset.id, asset.url);
    }
    const db = await getDB();
    await db.put('assets', asset);
  },"""

new_addAsset = """  async addAsset(asset: Asset) {
    if (asset.url && asset.url.startsWith('blob:')) {
      objectUrlCache.set(asset.id, asset.url);
    }
    const db = await getDB();
    
    // If saving an asset from state (which has blob stripped), preserve the existing blob in DB
    if (!asset.blob) {
      const existing = await db.get('assets', asset.id);
      if (existing && existing.blob) {
        asset.blob = existing.blob;
      }
    }
    
    await db.put('assets', asset);
  },"""

content = content.replace(old_addAsset, new_addAsset)

with open('src/db/index.ts', 'w') as f:
    f.write(content)

print("patched")
