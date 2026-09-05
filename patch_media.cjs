const fs = require('fs');
let file = fs.readFileSync('src/core/MediaStreamController.ts', 'utf8');
if (!file.includes('useStore.getState().assetsList')) {
  file = file.replace(
    /import \{ Asset, PresentationItem \} from '\.\.\/types';/,
    "import { Asset, PresentationItem } from '../types';\nimport { useStore } from '../store/useStore';"
  );
  file = file.replace(
    /if \(fallbackUrl && fallbackUrl\.startsWith\('blob:'\)\) \{/,
    `if (fallbackUrl && fallbackUrl.startsWith('blob:')) {
        // [FIX] Try to reverse-lookup the asset ID from the Blob URL using the global assetsList!
        // This allows projectors to find the blob in their local IndexedDB even if only the URL was passed.
        try {
          const assetsList = useStore.getState().assetsList || [];
          const matchedAsset = assetsList.find(a => a.url === fallbackUrl);
          if (matchedAsset && matchedAsset.id) {
            console.log('[MediaStreamController] Recovered asset ID from blob URL:', matchedAsset.id);
            return this.load(matchedAsset.id, fallbackUrl);
          }
        } catch (e) {}
`
  );
  fs.writeFileSync('src/core/MediaStreamController.ts', file);
  console.log('Patched MediaStreamController');
}
