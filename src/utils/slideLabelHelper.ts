import { SlideLabelConfig } from '../types';

/**
 * Slide Label Matching & Navigation Engine
 * Bridges Options -> Slide Labels configuration with:
 * 1. UI Badges in LiveSlideCard, Schedule sub-slides, Stage/Foldback display
 * 2. Real-time keyboard navigation (jump to Verse, Chorus, Bridge, Ending, etc.)
 */

// Normalized helper to escape regex special characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Common alternative terminology mapping (e.g. Tagalog, Spanish, or alternate hymnal tags)
 */
const ALIAS_MAP: Record<string, string[]> = {
  CHORUS: ['KORO', 'REFRAIN', 'CORO', 'CHO'],
  VERSE: ['TALATA', 'TALATÂ', 'STANZA', 'ESTROFA', 'VER'],
  BRIDGE: ['TULAY', 'PUENTE', 'BRG'],
  ENDING: ['KATAPUSAN', 'CODA', 'OUTRO', 'END'],
  'PRE-CHORUS': ['PRE-CHOR', 'PRECHORUS', 'PRE KORO', 'PRE-CORO'],
  INTRO: ['PAMBUNGAD', 'INTRODUCTION'],
  TAG: ['PABALIK', 'REPRISE'],
};

/**
 * Matches a slide title against user-configured SlideLabelConfig list.
 * Prioritizes:
 * 1. Exact match
 * 2. Prefix / word-boundary match with numbering (e.g. "Verse 1", "Chorus 2")
 * 3. Longer label names first (so "PRE-CHORUS" matches before "CHORUS", "ENDING" before "END")
 * 4. Language alias matching (Koro -> Chorus, Tulay -> Bridge)
 * 5. Fallback to <OTHER> or <EMPTY> if configured
 */
export function matchSlideLabel(
  rawTitle: string | undefined | null,
  slideLabels: SlideLabelConfig[] | undefined | null
): SlideLabelConfig | null {
  if (!slideLabels || slideLabels.length === 0) return null;

  const title = (rawTitle || '').trim();
  if (!title) {
    // If title is empty, check for <EMPTY> label
    return slideLabels.find((l) => l.name.toUpperCase() === '<EMPTY>') || null;
  }

  const titleUpper = title.toUpperCase();

  // Sort labels by name length descending so longer compound names match first
  const validLabels = slideLabels
    .filter((l) => l.name && l.name !== '<EMPTY>' && l.name !== '<OTHER>')
    .sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));

  // 1. Exact match
  for (const label of validLabels) {
    const nameUpper = label.name.toUpperCase().trim();
    if (titleUpper === nameUpper) {
      return label;
    }
  }

  // 2. Prefix / Word boundary match with number or punctuation (e.g., "Verse 1", "Chorus 2", "Chorus: 1", "Bridge - Part 2")
  for (const label of validLabels) {
    const nameUpper = label.name.toUpperCase().trim();
    const regex = new RegExp(`^${escapeRegExp(nameUpper)}(\\b|\\s*\\d+|\\s*[:\\-]|$)`, 'i');
    if (regex.test(titleUpper)) {
      return label;
    }
  }

  // 3. Substring word-boundary match (e.g., "Song Title - Chorus", "1. Verse 1")
  for (const label of validLabels) {
    const nameUpper = label.name.toUpperCase().trim();
    const regex = new RegExp(`\\b${escapeRegExp(nameUpper)}\\b`, 'i');
    if (regex.test(titleUpper)) {
      return label;
    }
  }

  // 4. Language / Hymnal alias match (e.g., "Koro 1" -> CHORUS, "Tulay" -> BRIDGE)
  for (const label of validLabels) {
    const nameUpper = label.name.toUpperCase().trim();
    const aliases = ALIAS_MAP[nameUpper];
    if (aliases && aliases.length > 0) {
      for (const alias of aliases) {
        const regex = new RegExp(`(^|\\b)${escapeRegExp(alias)}(\\b|\\s*\\d+|\\s*[:\\-]|$)`, 'i');
        if (regex.test(titleUpper)) {
          return label;
        }
      }
    }
  }

  // 5. Short code match (e.g. title is "V1", "V2", "C1", "C2", "B1")
  for (const label of validLabels) {
    const nameUpper = label.name.toUpperCase().trim();
    if (nameUpper === 'VERSE' && /^V\s*\d+$/i.test(titleUpper)) {
      return label;
    }
    if (nameUpper === 'CHORUS' && /^C\s*\d+$/i.test(titleUpper)) {
      return label;
    }
    if (nameUpper === 'BRIDGE' && /^B\s*\d+$/i.test(titleUpper)) {
      return label;
    }
  }

  // 6. Check for <OTHER> fallback label
  const otherLabel = slideLabels.find((l) => l.name.toUpperCase() === '<OTHER>');
  if (otherLabel && otherLabel.bgColor && otherLabel.bgColor !== '#273F6C') {
    return otherLabel;
  }

  return null;
}

/**
 * Checks if a keypress matches the shortcut definition of a slide label.
 * Supports single keys ('C', 'V', 'B'), multi-tokens ('E, NUM .', 'T, NUM .'), and number keys.
 */
export function matchesLabelShortcut(pressedKey: string, shortcutDef: string): boolean {
  if (!pressedKey || !shortcutDef) return false;

  const keyClean = pressedKey.trim().toUpperCase();
  const tokens = shortcutDef
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  for (const token of tokens) {
    if (token === keyClean) return true;

    // Handle Numpad period / dot tokens
    if (token === 'NUM .' || token === 'NUMPAD .' || token === '.') {
      if (keyClean === '.' || keyClean === 'DECIMAL' || pressedKey === '.') return true;
    }

    // Handle NUM 1..9
    if (token.startsWith('NUM ') || token.startsWith('NUMPAD ')) {
      const numChar = token.replace(/^(NUM|NUMPAD)\s*/, '').trim();
      if (numChar === keyClean) return true;
    }

    // Handle single letter match inside compound token
    if (token === keyClean) return true;
  }

  return false;
}

export interface ShortcutNavigationResult {
  slideIndex: number;
  matchedLabel: SlideLabelConfig;
  slideTitle: string;
  totalMatches: number;
  matchIndex: number;
}

/**
 * Finds the target slide index when a shortcut key is pressed.
 * If multiple slides match (e.g. Verse 1, Verse 2, Verse 3), cycles to the next matching slide.
 */
export function getSlideForShortcut(
  key: string,
  slides: Array<{ title?: string; text?: string }> | undefined | null,
  currentSlideIndex: number,
  slideLabels: SlideLabelConfig[] | undefined | null
): ShortcutNavigationResult | null {
  if (!slides || slides.length === 0 || !slideLabels || slideLabels.length === 0) {
    return null;
  }

  // Find all configured labels whose shortcut matches the pressed key
  const matchingLabels = slideLabels.filter((label) =>
    matchesLabelShortcut(key, label.shortcut)
  );

  if (matchingLabels.length === 0) return null;

  // Search through slides for any slide that matches one of these labels
  const matchedSlideIndices: { index: number; label: SlideLabelConfig; title: string }[] = [];

  slides.forEach((slide, idx) => {
    const matchedLabel = matchSlideLabel(slide.title, slideLabels);
    if (matchedLabel && matchingLabels.some((l) => l.id === matchedLabel.id || l.name === matchedLabel.name)) {
      matchedSlideIndices.push({
        index: idx,
        label: matchedLabel,
        title: slide.title || `Slide ${idx + 1}`,
      });
    }
  });

  if (matchedSlideIndices.length === 0) return null;

  // If currently on one of the matched slides, cycle to the NEXT matching slide
  const currentMatchPos = matchedSlideIndices.findIndex((m) => m.index === currentSlideIndex);

  let selected: { index: number; label: SlideLabelConfig; title: string };
  let matchIndex = 0;

  if (currentMatchPos >= 0) {
    matchIndex = (currentMatchPos + 1) % matchedSlideIndices.length;
    selected = matchedSlideIndices[matchIndex];
  } else {
    // Jump to the first matching slide
    matchIndex = 0;
    selected = matchedSlideIndices[0];
  }

  return {
    slideIndex: selected.index,
    matchedLabel: selected.label,
    slideTitle: selected.title,
    totalMatches: matchedSlideIndices.length,
    matchIndex: matchIndex + 1,
  };
}
