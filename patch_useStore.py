import re

with open('src/store/useStore.ts', 'r') as f:
    content = f.read()

# Replace finalAssetUrl logic
old_logic1 = """      const isTogglingOff = isCurrentlyActiveDefault;

      const finalAssetUrl = isTogglingOff ? '' : assetUrl;

      // 1. Update assetsList so ONLY target asset is marked default for this scope (automatic replacement)"""

new_logic1 = """      const isTogglingOff = isCurrentlyActiveDefault;

      const finalAssetId = isTogglingOff ? undefined : (targetAsset?.id || assetUrl);
      const finalAssetBlobUrl = isTogglingOff ? undefined : (targetAsset?.url || assetUrl);

      // 1. Update assetsList so ONLY target asset is marked default for this scope (automatic replacement)"""

content = content.replace(old_logic1, new_logic1)

old_sys_opts = """      // 2. Persist in SystemOptions if scope is 'logo'
      let nextSystemOptions = state.systemOptions;
      if (scope === 'logo') {
        nextSystemOptions = {
          ...state.systemOptions,
          mainOutput: {
            ...state.systemOptions?.mainOutput,
            general: {
              ...(state.systemOptions?.mainOutput?.general || {}),
              defaultLogoUrl: finalAssetUrl,
            } as any
          },
          general: {
            ...((state.systemOptions as any)?.general || {}),
            defaultLogoUrl: finalAssetUrl,
          } as any
        };
        try {
          localStorage.setItem('simpleworship_system_options_v1', JSON.stringify(nextSystemOptions));
        } catch (e) {}
        dbApi.saveSystemOptions(nextSystemOptions).catch(() => {});
      }"""

new_sys_opts = """      // 2. Persist in SystemOptions if scope is 'logo'
      let nextSystemOptions = state.systemOptions;
      if (scope === 'logo') {
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
        };
        try {
          localStorage.setItem('simpleworship_system_options_v1', JSON.stringify(sysOptsForDb));
        } catch (e) {}
        dbApi.saveSystemOptions(sysOptsForDb).catch(() => {});
      }"""
      
content = content.replace(old_sys_opts, new_sys_opts)

old_themes = """        if (isMatch) {
          themeFound = true;
          return {
            ...t,
            styles: {
              ...t.styles,
              backgroundType: isTogglingOff ? ('color' as const) : (isVideo ? 'video' : 'image'),
              backgroundImageUrl: (!isTogglingOff && !isVideo) ? finalAssetUrl : undefined,
              backgroundVideoUrl: (!isTogglingOff && isVideo) ? finalAssetUrl : undefined,
              logoUrl: scope === 'logo' ? finalAssetUrl : t.styles?.logoUrl,
            }
          };
        }
        return t;
      });

      if (!themeFound && !isTogglingOff) {
        const newTheme: Theme = {
          id: scope === 'logo' ? 'theme-logo' : (scope === 'scriptures' ? 'theme-scripture' : (scope === 'songs' ? 'theme-song' : (scope === 'presentations' ? 'theme-presentation' : `theme-${targetType}`))),
          name: `Default ${scope.charAt(0).toUpperCase() + scope.slice(1)} Theme`,
          type: targetType as any,
          styles: {
            backgroundType: isVideo ? 'video' : 'image',
            backgroundImageUrl: !isVideo ? finalAssetUrl : undefined,
            backgroundVideoUrl: isVideo ? finalAssetUrl : undefined,
            logoUrl: scope === 'logo' && !isVideo ? finalAssetUrl : undefined,
            showLogo: scope === 'logo',
          }
        };
        updatedThemes.push(newTheme);
      }

      // Persist updated themes to DB
      updatedThemes.forEach(t => dbApi.addTheme(t).catch(() => {}));"""

new_themes = """        if (isMatch) {
          themeFound = true;
          const updatedForDb: Theme = {
            ...t,
            styles: {
              ...t.styles,
              backgroundType: isTogglingOff ? ('color' as const) : (isVideo ? 'video' : 'image'),
              backgroundImageUrl: (!isTogglingOff && !isVideo) ? finalAssetId : undefined,
              backgroundVideoUrl: (!isTogglingOff && isVideo) ? finalAssetId : undefined,
              logoUrl: scope === 'logo' ? finalAssetId : t.styles?.logoUrl,
            }
          };
          dbApi.addTheme(updatedForDb).catch(() => {});
          
          return {
            ...updatedForDb,
            styles: {
              ...updatedForDb.styles,
              backgroundImageUrl: (!isTogglingOff && !isVideo) ? finalAssetBlobUrl : undefined,
              backgroundVideoUrl: (!isTogglingOff && isVideo) ? finalAssetBlobUrl : undefined,
              logoUrl: scope === 'logo' ? finalAssetBlobUrl : updatedForDb.styles?.logoUrl,
            }
          };
        }
        return t;
      });

      if (!themeFound && !isTogglingOff) {
        const newThemeForDb: Theme = {
          id: scope === 'logo' ? 'theme-logo' : (scope === 'scriptures' ? 'theme-scripture' : (scope === 'songs' ? 'theme-song' : (scope === 'presentations' ? 'theme-presentation' : `theme-${targetType}`))),
          name: `Default ${scope.charAt(0).toUpperCase() + scope.slice(1)} Theme`,
          type: targetType as any,
          styles: {
            backgroundType: isVideo ? 'video' : 'image',
            backgroundImageUrl: !isVideo ? finalAssetId : undefined,
            backgroundVideoUrl: isVideo ? finalAssetId : undefined,
            logoUrl: scope === 'logo' && !isVideo ? finalAssetId : undefined,
            showLogo: scope === 'logo',
          }
        };
        dbApi.addTheme(newThemeForDb).catch(() => {});
        
        const newThemeForState: Theme = {
          ...newThemeForDb,
          styles: {
            ...newThemeForDb.styles,
            backgroundImageUrl: !isVideo ? finalAssetBlobUrl : undefined,
            backgroundVideoUrl: isVideo ? finalAssetBlobUrl : undefined,
            logoUrl: scope === 'logo' && !isVideo ? finalAssetBlobUrl : undefined,
          }
        };
        updatedThemes.push(newThemeForState);
      }"""
content = content.replace(old_themes, new_themes)

with open('src/store/useStore.ts', 'w') as f:
    f.write(content)

print("Patched useStore.ts")
