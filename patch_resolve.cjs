const fs = require('fs');
let file = fs.readFileSync('src/components/ProjectorView.tsx', 'utf8');

const regex = /const resolveUrl = async \(url: string, contentId\?: string\): Promise<string> => \{[\s\S]*?return url;\s*\};/m;

const replacement = `const resolveUrl = async (url: string, contentId?: string): Promise<string> => {
      if (!url || !url.startsWith('blob:')) return url;
      
      let targetId = contentId;
      // Try to reverse lookup if contentId is missing (e.g. for theme backgrounds)
      if (!targetId) {
        const assetsList = useStore.getState().assetsList || [];
        const matched = assetsList.find(a => a.url === url);
        if (matched) {
          targetId = matched.id;
        }
      }
      
      if (!targetId) return url;
      
      try {
        const cachedUrl = dbApi.getCachedUrl(targetId);
        if (cachedUrl) return cachedUrl;
        
        // Slow path: hit IndexedDB
        const asset = await dbApi.getAsset(targetId);
        if (asset?.url) return asset.url;
      } catch (e) {}
      return url;
    };`;

file = file.replace(regex, replacement);
fs.writeFileSync('src/components/ProjectorView.tsx', file);
console.log('Patched resolveUrl');
