import re

with open('src/db/index.ts', 'r') as f:
    content = f.read()

# 1. Add unresolveAssetUrl
new_funcs = """export function resolveAssetUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  return assetUrlMap.get(url) || url;
}

export function unresolveAssetUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  for (const [id, cachedUrl] of objectUrlCache.entries()) {
    if (cachedUrl === url) return id;
  }
  return url;
}"""
content = content.replace("export function resolveAssetUrl(url: string | undefined): string | undefined {\n  if (!url) return undefined;\n  return assetUrlMap.get(url) || url;\n}", new_funcs)


# 2. Patch addTheme
old_addTheme = """  async addTheme(theme: Theme) {
    const db = await getDB();
    await db.put('themes', theme);
  },"""
new_addTheme = """  async addTheme(theme: Theme) {
    const db = await getDB();
    const cloned = JSON.parse(JSON.stringify(theme)) as Theme;
    if (cloned.styles) {
      cloned.styles.backgroundImageUrl = unresolveAssetUrl(cloned.styles.backgroundImageUrl);
      cloned.styles.backgroundVideoUrl = unresolveAssetUrl(cloned.styles.backgroundVideoUrl);
      cloned.styles.logoUrl = unresolveAssetUrl(cloned.styles.logoUrl);
    }
    await db.put('themes', cloned);
  },"""
content = content.replace(old_addTheme, new_addTheme)

# 3. Patch addSong
old_addSong = """  async addSong(song: Song) {
    const db = await getDB();
    await db.put('songs', song);
  },"""
new_addSong = """  async addSong(song: Song) {
    const db = await getDB();
    const cloned = JSON.parse(JSON.stringify(song)) as Song;
    cloned.defaultBackgroundUrl = unresolveAssetUrl(cloned.defaultBackgroundUrl);
    if (cloned.themeOverride) {
      cloned.themeOverride.backgroundImageUrl = unresolveAssetUrl(cloned.themeOverride.backgroundImageUrl);
      cloned.themeOverride.backgroundVideoUrl = unresolveAssetUrl(cloned.themeOverride.backgroundVideoUrl);
      cloned.themeOverride.logoUrl = unresolveAssetUrl(cloned.themeOverride.logoUrl);
    }
    await db.put('songs', cloned);
  },"""
content = content.replace(old_addSong, new_addSong)

# 4. Patch Schedules
old_addSchedule = """  async addSchedule(schedule: Schedule) {
    const db = await getDB();
    await db.put('schedules', schedule);
  },"""
new_addSchedule = """  async addSchedule(schedule: Schedule) {
    const db = await getDB();
    const cloned = JSON.parse(JSON.stringify(schedule)) as Schedule;
    cloned.items = cloned.items.map(item => ({
      ...item,
      customBackgroundUrl: unresolveAssetUrl(item.customBackgroundUrl) || item.customBackgroundUrl,
      themeOverride: item.themeOverride ? {
        ...item.themeOverride,
        backgroundImageUrl: unresolveAssetUrl(item.themeOverride.backgroundImageUrl) || item.themeOverride.backgroundImageUrl,
        backgroundVideoUrl: unresolveAssetUrl(item.themeOverride.backgroundVideoUrl) || item.themeOverride.backgroundVideoUrl,
        logoUrl: unresolveAssetUrl(item.themeOverride.logoUrl) || item.themeOverride.logoUrl
      } : undefined
    }));
    await db.put('schedules', cloned);
  },"""
content = content.replace(old_addSchedule, new_addSchedule)

old_saveSchedule = """  async saveSchedule(schedule: Schedule) {
    const db = await getDB();
    await db.put('schedules', schedule);
  },"""
new_saveSchedule = """  async saveSchedule(schedule: Schedule) {
    const db = await getDB();
    const cloned = JSON.parse(JSON.stringify(schedule)) as Schedule;
    cloned.items = cloned.items.map(item => ({
      ...item,
      customBackgroundUrl: unresolveAssetUrl(item.customBackgroundUrl) || item.customBackgroundUrl,
      themeOverride: item.themeOverride ? {
        ...item.themeOverride,
        backgroundImageUrl: unresolveAssetUrl(item.themeOverride.backgroundImageUrl) || item.themeOverride.backgroundImageUrl,
        backgroundVideoUrl: unresolveAssetUrl(item.themeOverride.backgroundVideoUrl) || item.themeOverride.backgroundVideoUrl,
        logoUrl: unresolveAssetUrl(item.themeOverride.logoUrl) || item.themeOverride.logoUrl
      } : undefined
    }));
    await db.put('schedules', cloned);
  },"""
content = content.replace(old_saveSchedule, new_saveSchedule)


# 5. Patch saveSystemOptions
old_saveSysOpts = """  async saveSystemOptions(options: SystemOptions) {
    const db = await getDB();
    await db.put('settings', { id: 'system_options', ...options });
  },"""
new_saveSysOpts = """  async saveSystemOptions(options: SystemOptions) {
    const db = await getDB();
    const cloned = JSON.parse(JSON.stringify(options)) as SystemOptions;
    if (cloned.general?.defaultLogoUrl) cloned.general.defaultLogoUrl = unresolveAssetUrl(cloned.general.defaultLogoUrl);
    if (cloned.mainOutput?.general?.defaultLogoUrl) cloned.mainOutput.general.defaultLogoUrl = unresolveAssetUrl(cloned.mainOutput.general.defaultLogoUrl);
    await db.put('settings', { id: 'system_options', ...cloned });
  },"""
content = content.replace(old_saveSysOpts, new_saveSysOpts)

with open('src/db/index.ts', 'w') as f:
    f.write(content)

print("db/index.ts patched successfully.")
