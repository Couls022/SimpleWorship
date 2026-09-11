import re

with open('src/store/useStore.ts', 'r') as f:
    content = f.read()

old_add = """  addAsset: async (asset) => {
    await dbApi.addAsset(asset);
    set((state) => ({ assetsList: [...state.assetsList.filter(a => a.id !== asset.id), asset] }));
  },"""

new_add = """  addAsset: async (asset) => {
    await dbApi.addAsset(asset);
    const { blob, ...assetWithoutBlob } = asset;
    set((state) => ({ assetsList: [...state.assetsList.filter(a => a.id !== asset.id), assetWithoutBlob as any] }));
  },"""

content = content.replace(old_add, new_add)

with open('src/store/useStore.ts', 'w') as f:
    f.write(content)

print("patched usestore add")
