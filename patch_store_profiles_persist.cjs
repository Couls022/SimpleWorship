const fs = require('fs');
let code = fs.readFileSync('src/store/useStore.ts', 'utf8');

if (!code.includes('const getStoredProfiles = ()')) {
    code = code.replace(
        "const getStoredShortcuts = (): ShortcutSettings => {",
        `const getStoredProfiles = () => {
  try {
    const saved = localStorage.getItem('simpleworship_profiles_v1');
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Error loading profiles', e);
  }
  return [{ id: 'default', name: 'Default', isDefault: true }];
};

const getStoredActiveProfile = () => {
  try {
    const saved = localStorage.getItem('simpleworship_active_profile_v1');
    if (saved) return saved;
  } catch (e) {}
  return 'default';
};

const getStoredShortcuts = (): ShortcutSettings => {`
    );

    code = code.replace(
        "profiles: [{ id: 'default', name: 'Default', isDefault: true }],",
        "profiles: getStoredProfiles(),"
    );
    
    code = code.replace(
        "activeProfileId: 'default',",
        "activeProfileId: getStoredActiveProfile(),"
    );

    code = code.replace(
        "addProfile: (profile) => set((state) => ({ profiles: [...state.profiles, profile] })),",
        `addProfile: (profile) => set((state) => {
    const next = [...state.profiles, profile];
    localStorage.setItem('simpleworship_profiles_v1', JSON.stringify(next));
    return { profiles: next };
  }),`
    );

    code = code.replace(
        "updateProfile: (id, updates) => set((state) => ({ profiles: state.profiles.map(p => p.id === id ? { ...p, ...updates } : p) })),",
        `updateProfile: (id, updates) => set((state) => {
    const next = state.profiles.map(p => p.id === id ? { ...p, ...updates } : p);
    localStorage.setItem('simpleworship_profiles_v1', JSON.stringify(next));
    return { profiles: next };
  }),`
    );

    code = code.replace(
        "removeProfile: (id) => set((state) => ({ profiles: state.profiles.filter(p => p.id !== id), activeProfileId: state.activeProfileId === id ? 'default' : state.activeProfileId })),",
        `removeProfile: (id) => set((state) => {
    const next = state.profiles.filter(p => p.id !== id);
    const nextActive = state.activeProfileId === id ? 'default' : state.activeProfileId;
    localStorage.setItem('simpleworship_profiles_v1', JSON.stringify(next));
    localStorage.setItem('simpleworship_active_profile_v1', nextActive);
    return { profiles: next, activeProfileId: nextActive };
  }),`
    );

    code = code.replace(
        "setActiveProfile: (id) => set({ activeProfileId: id }),",
        `setActiveProfile: (id) => set((state) => {
    localStorage.setItem('simpleworship_active_profile_v1', id);
    return { activeProfileId: id };
  }),`
    );

    fs.writeFileSync('src/store/useStore.ts', code, 'utf8');
    console.log('patched profiles persist');
}
