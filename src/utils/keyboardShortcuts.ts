import { CustomKeyMappings } from '../types';

export const DEFAULT_SIMPLEWORSHIP_MAPPINGS: CustomKeyMappings = {
  goLive: 'F5',
  nextSlide: 'ArrowDown',
  previousSlide: 'ArrowUp',
  clearOutput: 'F7',
  blackout: 'F6',
  logo: 'F8',
  nextItem: 'ArrowRight',
  previousItem: 'ArrowLeft',
};

export const DEFAULT_EASYWORSHIP_MAPPINGS = DEFAULT_SIMPLEWORSHIP_MAPPINGS;

export const DEFAULT_PROPRESENTER_MAPPINGS: CustomKeyMappings = {
  goLive: 'Enter',
  nextSlide: 'Space',
  previousSlide: 'ArrowUp',
  clearOutput: 'F1',
  blackout: 'F2',
  logo: 'F3',
  nextItem: 'ArrowRight',
  previousItem: 'ArrowLeft',
};

/**
 * Formats a KeyboardEvent into a standard string representation
 * e.g., "Ctrl+Enter", "F5", "ArrowDown", "Space", "Alt+C"
 */
export function formatKeyEvent(e: KeyboardEvent | { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; shiftKey?: boolean }): string {
  const parts: string[] = [];

  if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey && !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) parts.push('Shift');

  let key = e.key;

  // Normalize key names
  if (key === ' ') key = 'Space';
  else if (key === 'ArrowDown') key = 'ArrowDown';
  else if (key === 'ArrowUp') key = 'ArrowUp';
  else if (key === 'ArrowLeft') key = 'ArrowLeft';
  else if (key === 'ArrowRight') key = 'ArrowRight';
  else if (key === 'Escape') key = 'Escape';
  else if (key === 'Enter') key = 'Enter';
  else if (key === 'Tab') key = 'Tab';
  else if (key === 'PageDown') key = 'PageDown';
  else if (key === 'PageUp') key = 'PageUp';
  else if (key.length === 1) {
    key = key.toUpperCase();
  }

  // Avoid adding "Ctrl+Control" or "Shift+Shift"
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
    return parts.join('+');
  }

  if (parts.length > 0 && !parts.includes(key)) {
    return `${parts.join('+')}+${key}`;
  }

  return key;
}

/**
 * Returns a human-friendly display label for a key mapping string
 */
export function getFriendlyKeyName(keyStr: string): string {
  if (!keyStr) return 'Unassigned';
  return keyStr
    .replace(/ArrowDown/gi, '↓ Down Arrow')
    .replace(/ArrowUp/gi, '↑ Up Arrow')
    .replace(/ArrowLeft/gi, '← Left Arrow')
    .replace(/ArrowRight/gi, '→ Right Arrow')
    .replace(/Space/gi, 'Spacebar')
    .replace(/Escape/gi, 'Esc');
}

/**
 * Checks if a KeyboardEvent matches a configured key mapping string
 * Supports compound alternatives separated by "/" or "," e.g. "F5 / Enter" or "ArrowDown, PageDown"
 */
export function matchesShortcut(e: KeyboardEvent, mappingStr?: string): boolean {
  if (!mappingStr || !mappingStr.trim()) return false;

  const currentFormatted = formatKeyEvent(e).toLowerCase().replace(/\s+/g, '');
  const currentKey = (e.key === ' ' ? 'Space' : e.key).toLowerCase();
  
  // Split multiple possible mappings (e.g. "F5 / Ctrl+Enter" or "ArrowDown, PageDown")
  const candidates = mappingStr
    .split(/[\/,]/)
    .map(s => s.trim().toLowerCase().replace(/\s+/g, ''))
    .filter(Boolean);

  for (const candidate of candidates) {
    // Exact match with modifiers
    if (currentFormatted === candidate) return true;

    // Check without modifiers if candidate is a simple key and no modifier was held
    const requiresCtrl = candidate.includes('ctrl') || candidate.includes('cmd') || candidate.includes('meta');
    const requiresAlt = candidate.includes('alt');
    const requiresShift = candidate.includes('shift');

    const hasCtrl = e.ctrlKey || e.metaKey;
    const hasAlt = e.altKey;
    const hasShift = e.shiftKey;

    if (requiresCtrl === hasCtrl && requiresAlt === hasAlt && requiresShift === hasShift) {
      // Strip modifiers from candidate to get the base key
      const baseKey = candidate
        .replace(/(ctrl|cmd|meta|alt|shift)\+/g, '')
        .replace(/\+/g, '');

      if (baseKey === currentKey) return true;
      if (baseKey === 'arrowdown' && (currentKey === 'arrowdown' || currentKey === 'down')) return true;
      if (baseKey === 'arrowup' && (currentKey === 'arrowup' || currentKey === 'up')) return true;
      if (baseKey === 'arrowleft' && (currentKey === 'arrowleft' || currentKey === 'left')) return true;
      if (baseKey === 'arrowright' && (currentKey === 'arrowright' || currentKey === 'right')) return true;
      if (baseKey === 'space' && (currentKey === 'space' || currentKey === ' ')) return true;
      if (baseKey === 'spacebar' && (currentKey === 'space' || currentKey === ' ')) return true;
      if (baseKey === 'esc' && currentKey === 'escape') return true;
      if (baseKey === 'escape' && currentKey === 'escape') return true;
      if (baseKey === 'pagedown' && (currentKey === 'pagedown' || currentKey === 'pgdn')) return true;
      if (baseKey === 'pageup' && (currentKey === 'pageup' || currentKey === 'pgup')) return true;
      if (baseKey === 'return' && currentKey === 'enter') return true;
      if (baseKey === 'enter' && currentKey === 'enter') return true;
    }
  }

  return false;
}
