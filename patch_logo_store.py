import re

with open('src/store/useStore.ts', 'r') as f:
    content = f.read()

old_sys = """      if (scope === 'logo') {
        const sysOptsForDb = {
          ...state.systemOptions,
          mainOutput: {
            ...state.systemOptions?.mainOutput,
            general: {
              ...(state.systemOptions?.mainOutput?.general || {}),
              defaultLogoUrl: finalAssetId,
            } as any
          },
          general: {
            ...((state.systemOptions as any)?.general || {}),
            defaultLogoUrl: finalAssetId,
          } as any
        };
        nextSystemOptions = {
          ...sysOptsForDb,
          mainOutput: {
            ...sysOptsForDb.mainOutput,
            general: { ...sysOptsForDb.mainOutput.general, defaultLogoUrl: finalAssetBlobUrl } as any
          },
          general: { ...sysOptsForDb.general, defaultLogoUrl: finalAssetBlobUrl } as any
        };"""

new_sys = """      if (scope === 'logo') {
        const sysOptsForDb = {
          ...state.systemOptions,
          mainOutput: {
            ...state.systemOptions?.mainOutput,
            general: {
              ...(state.systemOptions?.mainOutput?.general || {}),
              defaultLogoUrl: finalAssetId,
              logoUrl: finalAssetId,
            } as any
          },
          general: {
            ...((state.systemOptions as any)?.general || {}),
            defaultLogoUrl: finalAssetId,
          } as any
        };
        nextSystemOptions = {
          ...sysOptsForDb,
          mainOutput: {
            ...sysOptsForDb.mainOutput,
            general: { ...sysOptsForDb.mainOutput.general, defaultLogoUrl: finalAssetBlobUrl, logoUrl: finalAssetBlobUrl } as any
          },
          general: { ...sysOptsForDb.general, defaultLogoUrl: finalAssetBlobUrl } as any
        };"""

content = content.replace(old_sys, new_sys)

with open('src/store/useStore.ts', 'w') as f:
    f.write(content)
