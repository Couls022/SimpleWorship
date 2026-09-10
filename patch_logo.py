import re

with open('src/store/useStore.ts', 'r') as f:
    content = f.read()

old_sys = """    if (storedOptions) {
      if (storedOptions.general?.defaultLogoUrl) {
        storedOptions.general.defaultLogoUrl = mapUrl(storedOptions.general.defaultLogoUrl);
      }
      if (storedOptions.mainOutput?.general?.defaultLogoUrl) {
        storedOptions.mainOutput.general.defaultLogoUrl = mapUrl(storedOptions.mainOutput.general.defaultLogoUrl);
      }
      set(state => ({"""

new_sys = """    if (storedOptions) {
      if (storedOptions.general?.defaultLogoUrl) {
        storedOptions.general.defaultLogoUrl = mapUrl(storedOptions.general.defaultLogoUrl);
      }
      if (storedOptions.mainOutput?.general?.defaultLogoUrl) {
        storedOptions.mainOutput.general.defaultLogoUrl = mapUrl(storedOptions.mainOutput.general.defaultLogoUrl);
      }
      if (storedOptions.mainOutput?.general?.logoUrl) {
        storedOptions.mainOutput.general.logoUrl = mapUrl(storedOptions.mainOutput.general.logoUrl);
      }
      set(state => ({"""

content = content.replace(old_sys, new_sys)

with open('src/store/useStore.ts', 'w') as f:
    f.write(content)
