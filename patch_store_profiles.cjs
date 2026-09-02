const fs = require('fs');
let code = fs.readFileSync('src/store/useStore.ts', 'utf8');

if (!code.includes('profiles: Profile[]')) {
    code = code.replace(
        'interface AppState {',
        `interface AppState {
  // Profiles
  profiles: Profile[];
  activeProfileId: string;
  addProfile: (profile: Profile) => void;
  updateProfile: (id: string, updates: Partial<Profile>) => void;
  removeProfile: (id: string) => void;
  setActiveProfile: (id: string) => void;
`
    );

    code = code.replace(
        'export const useStore = create<AppState>((set, get) => ({',
        `export const useStore = create<AppState>((set, get) => ({
  profiles: [{ id: 'default', name: 'Default', isDefault: true }],
  activeProfileId: 'default',
  addProfile: (profile) => set((state) => ({ profiles: [...state.profiles, profile] })),
  updateProfile: (id, updates) => set((state) => ({ profiles: state.profiles.map(p => p.id === id ? { ...p, ...updates } : p) })),
  removeProfile: (id) => set((state) => ({ profiles: state.profiles.filter(p => p.id !== id), activeProfileId: state.activeProfileId === id ? 'default' : state.activeProfileId })),
  setActiveProfile: (id) => set({ activeProfileId: id }),
`
    );

    fs.writeFileSync('src/store/useStore.ts', code, 'utf8');
    console.log('patched');
}
