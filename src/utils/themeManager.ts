import { SystemOptions } from '../types';

export interface AppearanceConfig {
  themeMode?: 'dark' | 'light' | 'system';
  accentColor?: string;
  compactMode?: boolean;
  highContrast?: boolean;
}

export function applyAppearanceSettings(appearance?: AppearanceConfig) {
  if (typeof document === 'undefined') return;

  const config: AppearanceConfig = {
    themeMode: appearance?.themeMode || 'dark',
    accentColor: appearance?.accentColor || 'cyan',
    compactMode: appearance?.compactMode ?? false,
    highContrast: appearance?.highContrast ?? false,
  };

  const root = document.documentElement;

  // 1. Theme Mode (Dark, Light, System)
  let activeMode: 'dark' | 'light' = 'dark';
  if (config.themeMode === 'light') {
    activeMode = 'light';
  } else if (config.themeMode === 'system') {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    activeMode = prefersDark ? 'dark' : 'light';
  } else {
    activeMode = 'dark';
  }

  root.setAttribute('data-theme', activeMode);
  if (activeMode === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
  }

  // 2. Accent Color
  const accent = config.accentColor || 'cyan';
  root.setAttribute('data-accent', accent);
  root.classList.remove('theme-cyan', 'theme-emerald', 'theme-blue', 'theme-purple', 'theme-amber');
  root.classList.add(`theme-${accent}`);

  // 3. Compact Mode
  root.setAttribute('data-compact', String(config.compactMode));
  if (config.compactMode) {
    root.classList.add('compact-layout');
  } else {
    root.classList.remove('compact-layout');
  }

  // 4. High Contrast
  root.setAttribute('data-high-contrast', String(config.highContrast));
  if (config.highContrast) {
    root.classList.add('high-contrast');
  } else {
    root.classList.remove('high-contrast');
  }
}

/**
 * Attaches system theme media query listener for 'system' mode automatic switching
 */
export function initSystemThemeListener(getSystemOptions: () => SystemOptions) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    const currentOptions = getSystemOptions();
    if (currentOptions?.appearance?.themeMode === 'system') {
      applyAppearanceSettings(currentOptions.appearance);
    }
  };

  try {
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  } catch (e) {
    // Fallback for older browsers
    mediaQuery.addListener(handler);
    return () => mediaQuery.removeListener(handler);
  }
}
