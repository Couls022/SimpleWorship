import re

with open('src/store/useStore.ts', 'r') as f:
    content = f.read()

old_add = """  addAsset: (asset) => {
    const assetToSave = { ...asset };
    dbApi.addAsset(assetToSave).catch(() => {});
    set((state) => ({ assetsList: [...state.assetsList, asset] }));
  },"""

new_add = """  addAsset: (asset) => {
    const assetToSave = { ...asset };
    dbApi.addAsset(assetToSave).catch(() => {});
    // Strip blob before storing in state to prevent memory leaks
    const { blob, ...assetWithoutBlob } = asset;
    set((state) => ({ assetsList: [...state.assetsList, assetWithoutBlob as any] }));
  },"""

content = content.replace(old_add, new_add)

with open('src/store/useStore.ts', 'w') as f:
    f.write(content)

print("patched store addAsset")
