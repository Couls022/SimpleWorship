import re

with open('src/db/index.ts', 'r') as f:
    content = f.read()

old_sys = """  async saveSystemOptions(options: SystemOptions) {
    const db = await getDB();
    const cloned = JSON.parse(JSON.stringify(options)) as SystemOptions;
    if (cloned.general?.defaultLogoUrl) cloned.general.defaultLogoUrl = unresolveAssetUrl(cloned.general.defaultLogoUrl);
    if (cloned.mainOutput?.general?.defaultLogoUrl) cloned.mainOutput.general.defaultLogoUrl = unresolveAssetUrl(cloned.mainOutput.general.defaultLogoUrl);
    await db.put('settings', { id: 'system_options', options: cloned });
  },"""

new_sys = """  async saveSystemOptions(options: SystemOptions) {
    const db = await getDB();
    const cloned = JSON.parse(JSON.stringify(options)) as SystemOptions;
    if (cloned.general?.defaultLogoUrl) cloned.general.defaultLogoUrl = unresolveAssetUrl(cloned.general.defaultLogoUrl);
    if (cloned.mainOutput?.general?.defaultLogoUrl) cloned.mainOutput.general.defaultLogoUrl = unresolveAssetUrl(cloned.mainOutput.general.defaultLogoUrl);
    if (cloned.mainOutput?.general?.logoUrl) cloned.mainOutput.general.logoUrl = unresolveAssetUrl(cloned.mainOutput.general.logoUrl);
    await db.put('settings', { id: 'system_options', options: cloned });
  },"""

content = content.replace(old_sys, new_sys)

with open('src/db/index.ts', 'w') as f:
    f.write(content)
