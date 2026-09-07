import { Song, Theme, Schedule, Asset, OutputGroup, SystemOptions, ShortcutSettings } from '../types';
import { dbApi } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface ProfileMetadata {
  id: string;
  name: string;
  isDefault?: boolean;
  description?: string;
  createdAt?: number;
  lastUsedAt?: number;
}

export interface PortableProfilePackage {
  format: 'simpleworship-profile-v1';
  version: '1.0.0';
  exportedAt: string;
  profile: ProfileMetadata;
  stats: {
    songCount: number;
    themeCount: number;
    scheduleCount: number;
    assetCount: number;
    outputGroupCount: number;
  };
  data: {
    songs: Song[];
    themes: Theme[];
    schedules: Schedule[];
    activeSchedule?: Schedule | null;
    assets: Omit<Asset, 'blob'>[];
    outputGroups: OutputGroup[];
    systemOptions?: SystemOptions | null;
    shortcutSettings?: ShortcutSettings | null;
    workspaceLayout?: any;
  };
}

/**
 * Creates a portable, standalone package containing all data for a given profile
 */
export async function exportPortableProfile(
  profile: ProfileMetadata, 
  options?: {
    activeSchedule?: Schedule | null;
    shortcutSettings?: ShortcutSettings | null;
    workspaceLayout?: any;
  }
): Promise<PortableProfilePackage> {
  const songs = await dbApi.getAllSongs();
  const themes = await dbApi.getAllThemes();
  const schedules = await dbApi.getAllSchedules();
  const rawAssets = await dbApi.getAllAssets();
  const outputGroups = await dbApi.getOutputGroups();
  const systemOptions = await dbApi.getSystemOptions();

  // Strip large memory blobs from assets for lightweight portable export
  const assets: Omit<Asset, 'blob'>[] = rawAssets.map(a => {
    const { blob, ...rest } = a;
    return rest;
  });

  const pkg: PortableProfilePackage = {
    format: 'simpleworship-profile-v1',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    profile: {
      id: profile.id,
      name: profile.name,
      description: profile.description || `Exported from SimpleWorship on ${new Date().toLocaleDateString()}`,
      isDefault: profile.isDefault,
      createdAt: profile.createdAt || Date.now(),
      lastUsedAt: Date.now()
    },
    stats: {
      songCount: songs.length,
      themeCount: themes.length,
      scheduleCount: schedules.length,
      assetCount: assets.length,
      outputGroupCount: outputGroups.length
    },
    data: {
      songs,
      themes,
      schedules,
      activeSchedule: options?.activeSchedule || null,
      assets,
      outputGroups,
      systemOptions,
      shortcutSettings: options?.shortcutSettings || null,
      workspaceLayout: options?.workspaceLayout || null
    }
  };

  return pkg;
}

/**
 * Triggers browser download of the portable profile bundle (.swprofile / .swp)
 */
export function downloadPortableProfilePackage(pkg: PortableProfilePackage) {
  const jsonStr = JSON.stringify(pkg, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const sanitizedName = pkg.profile.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${sanitizedName}_Profile.swprofile`;
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Validates and parses an imported portable profile package (.swprofile, .swp, .json)
 */
export function parsePortableProfilePackage(jsonString: string): PortableProfilePackage {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid JSON format');
    }
    
    // Support SimpleWorship profile format or fallback standard JSON
    if (parsed.format !== 'simpleworship-profile-v1' && !parsed.profile && !parsed.data) {
      // Check if it's an EasyWorship schedule or raw data export
      if (Array.isArray(parsed.songs) || Array.isArray(parsed.items)) {
        return {
          format: 'simpleworship-profile-v1',
          version: '1.0.0',
          exportedAt: new Date().toISOString(),
          profile: {
            id: uuidv4(),
            name: parsed.name || 'Imported Profile',
            isDefault: false
          },
          stats: {
            songCount: parsed.songs?.length || 0,
            themeCount: parsed.themes?.length || 0,
            scheduleCount: 1,
            assetCount: 0,
            outputGroupCount: 0
          },
          data: {
            songs: parsed.songs || [],
            themes: parsed.themes || [],
            schedules: parsed.schedule ? [parsed.schedule] : [],
            assets: [],
            outputGroups: []
          }
        };
      }
      throw new Error('Unrecognized Profile Package schema');
    }

    return parsed as PortableProfilePackage;
  } catch (err: any) {
    throw new Error(`Failed to parse profile package: ${err.message || err}`);
  }
}

/**
 * Imports all data from a portable profile package into the database
 */
export async function importPortableProfileToDatabase(
  pkg: PortableProfilePackage,
  overrideName?: string
): Promise<{ profile: ProfileMetadata; summary: string }> {
  const profileId = uuidv4();
  const profileName = overrideName || pkg.profile.name || 'Imported Portable Profile';
  
  const newProfile: ProfileMetadata = {
    id: profileId,
    name: profileName,
    isDefault: false,
    description: pkg.profile.description || `Imported on ${new Date().toLocaleDateString()}`,
    createdAt: Date.now(),
    lastUsedAt: Date.now()
  };

  let importedSongsCount = 0;
  let importedThemesCount = 0;
  let importedSchedulesCount = 0;

  // 1. Import Songs
  if (Array.isArray(pkg.data.songs)) {
    for (const song of pkg.data.songs) {
      if (song && song.id && song.title) {
        await dbApi.addSong(song);
        importedSongsCount++;
      }
    }
  }

  // 2. Import Themes
  if (Array.isArray(pkg.data.themes)) {
    for (const theme of pkg.data.themes) {
      if (theme && theme.id && theme.name) {
        await dbApi.addTheme(theme);
        importedThemesCount++;
      }
    }
  }

  // 3. Import Schedules
  if (Array.isArray(pkg.data.schedules)) {
    for (const sched of pkg.data.schedules) {
      if (sched && sched.id && sched.name) {
        await dbApi.addSchedule(sched);
        importedSchedulesCount++;
      }
    }
  }

  // 4. Import Output Groups if provided
  if (Array.isArray(pkg.data.outputGroups) && pkg.data.outputGroups.length > 0) {
    for (const group of pkg.data.outputGroups) {
      if (group && group.id) {
        await dbApi.saveOutputGroup(group);
      }
    }
  }

  // 5. Import System Options
  if (pkg.data.systemOptions) {
    await dbApi.saveSystemOptions(pkg.data.systemOptions);
  }

  const summary = `Imported ${importedSongsCount} songs, ${importedThemesCount} themes, and ${importedSchedulesCount} schedules into profile "${profileName}".`;
  return { profile: newProfile, summary };
}
