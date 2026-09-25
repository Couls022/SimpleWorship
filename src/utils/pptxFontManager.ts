/**
 * SimpleWorship PPTX & Canva Font Auto-Detection, Downloader & Responsive Auto-Fit Engine
 * 
 * Solves:
 * 1. Missing fonts on presentation PCs (Canva PPTX exports using Montserrat, Bebas Neue, Poppins,
 *    League Spartan, Playfair Display, etc. that are not installed in the Windows/Mac OS font directory).
 * 2. Automatic detection of all fonts embedded or referenced in PPTX OpenXML packages.
 * 3. Dynamic background web-downloading of missing fonts from Google Fonts with seamless browser registration.
 * 4. Metric-compatible fallback font stacks (matching aspect ratios, x-heights, letter-spacing)
 *    when offline or for proprietary fonts.
 * 5. Auto-fit / text shrink-on-overflow calculation to prevent broken line wrapping, clipping, and location shifts.
 */

import JSZip from 'jszip';
import { inMemoryInstalledFonts, fetchAndInstallGoogleFont, initFontStorage } from './fontStorage';
import { FontValidationService } from '../services/fontValidationService';

export type FontArchetype = 
  | 'condensed' 
  | 'geometric-sans' 
  | 'modern-sans' 
  | 'editorial-serif' 
  | 'classic-serif' 
  | 'script' 
  | 'slab-serif' 
  | 'monospace';

export interface NormalizedFontInfo {
  originalName: string;
  baseFamily: string;
  suggestedWeight?: 'normal' | 'bold' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
  suggestedStyle?: 'normal' | 'italic';
  archetype: FontArchetype;
  fontStack: string;
  isGoogleFont: boolean;
}

// Built-in operating system fonts that are universally available on Windows/Mac and don't need downloading
export const SYSTEM_UNIVERSAL_FONTS = new Set([
  'arial',
  'arial black',
  'calibri',
  'cambria',
  'candara',
  'comic sans ms',
  'consolas',
  'constantia',
  'corbel',
  'courier new',
  'franklin gothic medium',
  'gabriola',
  'georgia',
  'impact',
  'lucida console',
  'lucida sans',
  'lucida sans unicode',
  'microsoft sans serif',
  'palatino linotype',
  'segoe ui',
  'segoe script',
  'segoe print',
  'symbol',
  'tahoma',
  'times new roman',
  'trebuchet ms',
  'verdana',
  'wingdings',
  'aptos',
  'aptos display',
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'fantasy',
]);

// Curated dictionary of popular Canva, Google Slides, and presentation fonts mapped to archetypes and Google Fonts availability
export const CANVA_FONT_ARCHETYPES: Record<string, { base: string; archetype: FontArchetype; isGoogle: boolean; defaultWeight?: string }> = {
  // Condensed / Tall Display
  'bebas neue': { base: 'Bebas Neue', archetype: 'condensed', isGoogle: true, defaultWeight: '400' },
  'bebas': { base: 'Bebas Neue', archetype: 'condensed', isGoogle: true, defaultWeight: '400' },
  'oswald': { base: 'Oswald', archetype: 'condensed', isGoogle: true },
  'anton': { base: 'Anton', archetype: 'condensed', isGoogle: true, defaultWeight: '400' },
  'teko': { base: 'Teko', archetype: 'condensed', isGoogle: true },
  'fjalla one': { base: 'Fjalla One', archetype: 'condensed', isGoogle: true, defaultWeight: '400' },
  'barlow condensed': { base: 'Barlow Condensed', archetype: 'condensed', isGoogle: true },
  'league gothic': { base: 'League Gothic', archetype: 'condensed', isGoogle: true, defaultWeight: '400' },
  'pathway gothic one': { base: 'Pathway Gothic One', archetype: 'condensed', isGoogle: true, defaultWeight: '400' },
  'pathway extreme': { base: 'Pathway Extreme', archetype: 'condensed', isGoogle: true },
  'archivo narrow': { base: 'Archivo Narrow', archetype: 'condensed', isGoogle: true },
  'dosis': { base: 'Dosis', archetype: 'condensed', isGoogle: true },
  'yanone kaffeesatz': { base: 'Yanone Kaffeesatz', archetype: 'condensed', isGoogle: true },
  'six caps': { base: 'Six Caps', archetype: 'condensed', isGoogle: true, defaultWeight: '400' },
  'horizon': { base: 'Teko', archetype: 'condensed', isGoogle: true },
  'gagalin': { base: 'Anton', archetype: 'condensed', isGoogle: true, defaultWeight: '400' },
  'bernard mt condensed': { base: 'Bebas Neue', archetype: 'condensed', isGoogle: true },
  'impact': { base: 'Impact', archetype: 'condensed', isGoogle: false },

  // Geometric Sans (Canva staple headers and clean text)
  'montserrat': { base: 'Montserrat', archetype: 'geometric-sans', isGoogle: true },
  'montserrat classic': { base: 'Montserrat', archetype: 'geometric-sans', isGoogle: true },
  'poppins': { base: 'Poppins', archetype: 'geometric-sans', isGoogle: true },
  'league spartan': { base: 'League Spartan', archetype: 'geometric-sans', isGoogle: true },
  'spartan': { base: 'League Spartan', archetype: 'geometric-sans', isGoogle: true },
  'century gothic': { base: 'Century Gothic', archetype: 'geometric-sans', isGoogle: false },
  'futura': { base: 'Futura', archetype: 'geometric-sans', isGoogle: false },
  'avenir': { base: 'Avenir', archetype: 'geometric-sans', isGoogle: false },
  'nunito': { base: 'Nunito', archetype: 'geometric-sans', isGoogle: true },
  'nunito sans': { base: 'Nunito Sans', archetype: 'geometric-sans', isGoogle: true },
  'quicksand': { base: 'Quicksand', archetype: 'geometric-sans', isGoogle: true },
  'comfortaa': { base: 'Comfortaa', archetype: 'geometric-sans', isGoogle: true },
  'josefin sans': { base: 'Josefin Sans', archetype: 'geometric-sans', isGoogle: true },
  'outfit': { base: 'Outfit', archetype: 'geometric-sans', isGoogle: true },
  'plus jakarta sans': { base: 'Plus Jakarta Sans', archetype: 'geometric-sans', isGoogle: true },
  'jakarta': { base: 'Plus Jakarta Sans', archetype: 'geometric-sans', isGoogle: true },
  'urbanist': { base: 'Urbanist', archetype: 'geometric-sans', isGoogle: true },
  'figtree': { base: 'Figtree', archetype: 'geometric-sans', isGoogle: true },
  'sora': { base: 'Sora', archetype: 'geometric-sans', isGoogle: true },
  'syne': { base: 'Syne', archetype: 'geometric-sans', isGoogle: true },
  'lexend': { base: 'Lexend', archetype: 'geometric-sans', isGoogle: true },
  'lexend deca': { base: 'Lexend Deca', archetype: 'geometric-sans', isGoogle: true },
  'albert sans': { base: 'Albert Sans', archetype: 'geometric-sans', isGoogle: true },
  'glacial indifference': { base: 'Glacial Indifference', archetype: 'geometric-sans', isGoogle: false },
  'canva student font': { base: 'Quicksand', archetype: 'geometric-sans', isGoogle: true },
  'agrandir': { base: 'Syne', archetype: 'geometric-sans', isGoogle: true },
  'tan nimbus': { base: 'Playfair Display', archetype: 'editorial-serif', isGoogle: true },
  'tan mon cheri': { base: 'Playfair Display', archetype: 'editorial-serif', isGoogle: true },
  'tan pearl': { base: 'Prata', archetype: 'editorial-serif', isGoogle: true, defaultWeight: '400' },

  // High-Contrast Editorial Serif / Fashion / Luxury
  'playfair display': { base: 'Playfair Display', archetype: 'editorial-serif', isGoogle: true },
  'playfair': { base: 'Playfair Display', archetype: 'editorial-serif', isGoogle: true },
  'playfair display sc': { base: 'Playfair Display SC', archetype: 'editorial-serif', isGoogle: true },
  'cinzel': { base: 'Cinzel', archetype: 'editorial-serif', isGoogle: true },
  'cinzel decorative': { base: 'Cinzel Decorative', archetype: 'editorial-serif', isGoogle: true },
  'bodoni moda': { base: 'Bodoni Moda', archetype: 'editorial-serif', isGoogle: true },
  'bodoni mt': { base: 'Bodoni MT', archetype: 'editorial-serif', isGoogle: false },
  'cormorant': { base: 'Cormorant', archetype: 'editorial-serif', isGoogle: true },
  'cormorant garamond': { base: 'Cormorant Garamond', archetype: 'editorial-serif', isGoogle: true },
  'cormorant infant': { base: 'Cormorant Infant', archetype: 'editorial-serif', isGoogle: true },
  'abril fatface': { base: 'Abril Fatface', archetype: 'editorial-serif', isGoogle: true, defaultWeight: '400' },
  'fraunces': { base: 'Fraunces', archetype: 'editorial-serif', isGoogle: true },
  'dm serif display': { base: 'DM Serif Display', archetype: 'editorial-serif', isGoogle: true, defaultWeight: '400' },
  'dm serif text': { base: 'DM Serif Text', archetype: 'editorial-serif', isGoogle: true, defaultWeight: '400' },
  'prata': { base: 'Prata', archetype: 'editorial-serif', isGoogle: true, defaultWeight: '400' },
  'marcellus': { base: 'Marcellus', archetype: 'editorial-serif', isGoogle: true, defaultWeight: '400' },
  'marcellus sc': { base: 'Marcellus SC', archetype: 'editorial-serif', isGoogle: true, defaultWeight: '400' },
  'yeseva one': { base: 'Yeseva One', archetype: 'editorial-serif', isGoogle: true, defaultWeight: '400' },
  'italiana': { base: 'Italiana', archetype: 'editorial-serif', isGoogle: true, defaultWeight: '400' },
  'tenor sans': { base: 'Tenor Sans', archetype: 'editorial-serif', isGoogle: true, defaultWeight: '400' },
  'gilda display': { base: 'Gilda Display', archetype: 'editorial-serif', isGoogle: true, defaultWeight: '400' },
  'abhaya libre': { base: 'Abhaya Libre', archetype: 'editorial-serif', isGoogle: true },
  'cardo': { base: 'Cardo', archetype: 'editorial-serif', isGoogle: true },
  'castoro': { base: 'Castoro', archetype: 'editorial-serif', isGoogle: true },

  // Modern Clean UI / Humanist Sans
  'inter': { base: 'Inter', archetype: 'modern-sans', isGoogle: true },
  'inter tight': { base: 'Inter Tight', archetype: 'modern-sans', isGoogle: true },
  'roboto': { base: 'Roboto', archetype: 'modern-sans', isGoogle: true },
  'roboto flex': { base: 'Roboto Flex', archetype: 'modern-sans', isGoogle: true },
  'open sans': { base: 'Open Sans', archetype: 'modern-sans', isGoogle: true },
  'lato': { base: 'Lato', archetype: 'modern-sans', isGoogle: true },
  'raleway': { base: 'Raleway', archetype: 'modern-sans', isGoogle: true },
  'dm sans': { base: 'DM Sans', archetype: 'modern-sans', isGoogle: true },
  'work sans': { base: 'Work Sans', archetype: 'modern-sans', isGoogle: true },
  'rubik': { base: 'Rubik', archetype: 'modern-sans', isGoogle: true },
  'manrope': { base: 'Manrope', archetype: 'modern-sans', isGoogle: true },
  'kanit': { base: 'Kanit', archetype: 'modern-sans', isGoogle: true },
  'barlow': { base: 'Barlow', archetype: 'modern-sans', isGoogle: true },
  'archivo': { base: 'Archivo', archetype: 'modern-sans', isGoogle: true },
  'cabin': { base: 'Cabin', archetype: 'modern-sans', isGoogle: true },
  'titillium web': { base: 'Titillium Web', archetype: 'modern-sans', isGoogle: true },
  'pt sans': { base: 'PT Sans', archetype: 'modern-sans', isGoogle: true },
  'ubuntu': { base: 'Ubuntu', archetype: 'modern-sans', isGoogle: true },
  'source sans pro': { base: 'Source Sans 3', archetype: 'modern-sans', isGoogle: true },
  'source sans 3': { base: 'Source Sans 3', archetype: 'modern-sans', isGoogle: true },
  'canva sans': { base: 'Inter', archetype: 'modern-sans', isGoogle: true },
  'canva sans light': { base: 'Inter', archetype: 'modern-sans', isGoogle: true, defaultWeight: '300' },
  'canva sans bold': { base: 'Inter', archetype: 'modern-sans', isGoogle: true, defaultWeight: '700' },
  'noto sans': { base: 'Noto Sans', archetype: 'modern-sans', isGoogle: true },
  'overpass': { base: 'Overpass', archetype: 'modern-sans', isGoogle: true },
  'space grotesk': { base: 'Space Grotesk', archetype: 'modern-sans', isGoogle: true },

  // Script & Handwritten (Canva titles & inspirational quotes)
  'dancing script': { base: 'Dancing Script', archetype: 'script', isGoogle: true },
  'caveat': { base: 'Caveat', archetype: 'script', isGoogle: true },
  'caveat brush': { base: 'Caveat Brush', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'pacifico': { base: 'Pacifico', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'great vibes': { base: 'Great Vibes', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'sacramento': { base: 'Sacramento', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'yellowtail': { base: 'Yellowtail', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'alex brush': { base: 'Alex Brush', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'allura': { base: 'Allura', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'satisfy': { base: 'Satisfy', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'lobster': { base: 'Lobster', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'lobster two': { base: 'Lobster Two', archetype: 'script', isGoogle: true },
  'kalam': { base: 'Kalam', archetype: 'script', isGoogle: true },
  'courgette': { base: 'Courgette', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'parisienne': { base: 'Parisienne', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'marck script': { base: 'Marck Script', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'shadows into light': { base: 'Shadows Into Light', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'shadows into light two': { base: 'Shadows Into Light Two', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'gloria hallelujah': { base: 'Gloria Hallelujah', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'indie flower': { base: 'Indie Flower', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'gochi hand': { base: 'Gochi Hand', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'amatic sc': { base: 'Amatic SC', archetype: 'script', isGoogle: true },
  'permanent marker': { base: 'Permanent Marker', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'rock salt': { base: 'Rock Salt', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'kaushan script': { base: 'Kaushan Script', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'pinyon script': { base: 'Pinyon Script', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'tangerine': { base: 'Tangerine', archetype: 'script', isGoogle: true },
  'cookie': { base: 'Cookie', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'architects daughter': { base: 'Architects Daughter', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'covered by your grace': { base: 'Covered By Your Grace', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'bryndan write': { base: 'Caveat', archetype: 'script', isGoogle: true },
  'kolker brush': { base: 'Great Vibes', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'moontime': { base: 'Dancing Script', archetype: 'script', isGoogle: true },

  // Slab Serif
  'alfa slab one': { base: 'Alfa Slab One', archetype: 'slab-serif', isGoogle: true, defaultWeight: '400' },
  'rockwell': { base: 'Rockwell', archetype: 'slab-serif', isGoogle: false },
  'roboto slab': { base: 'Roboto Slab', archetype: 'slab-serif', isGoogle: true },
  'arvo': { base: 'Arvo', archetype: 'slab-serif', isGoogle: true },
  'bitter': { base: 'Bitter', archetype: 'slab-serif', isGoogle: true },
  'glegoo': { base: 'Glegoo', archetype: 'slab-serif', isGoogle: true },
  'kreon': { base: 'Kreon', archetype: 'slab-serif', isGoogle: true },
  'zillaslab': { base: 'Zilla Slab', archetype: 'slab-serif', isGoogle: true },
  'zilla slab': { base: 'Zilla Slab', archetype: 'slab-serif', isGoogle: true },

  // Classic Reading Serif
  'merriweather': { base: 'Merriweather', archetype: 'classic-serif', isGoogle: true },
  'lora': { base: 'Lora', archetype: 'classic-serif', isGoogle: true },
  'libre baskerville': { base: 'Libre Baskerville', archetype: 'classic-serif', isGoogle: true },
  'baskerville': { base: 'Libre Baskerville', archetype: 'classic-serif', isGoogle: true },
  'pt serif': { base: 'PT Serif', archetype: 'classic-serif', isGoogle: true },
  'source serif pro': { base: 'Source Serif 4', archetype: 'classic-serif', isGoogle: true },
  'source serif 4': { base: 'Source Serif 4', archetype: 'classic-serif', isGoogle: true },
  'noto serif': { base: 'Noto Serif', archetype: 'classic-serif', isGoogle: true },
  'eb garamond': { base: 'EB Garamond', archetype: 'classic-serif', isGoogle: true },
  'garamond': { base: 'EB Garamond', archetype: 'classic-serif', isGoogle: true },
  'vollkorn': { base: 'Vollkorn', archetype: 'classic-serif', isGoogle: true },
  'spectral': { base: 'Spectral', archetype: 'classic-serif', isGoogle: true },

  // Microsoft & System Windows Fonts with clean metric equivalents
  'grandview': { base: 'Inter', archetype: 'modern-sans', isGoogle: true },
  'garet': { base: 'Outfit', archetype: 'geometric-sans', isGoogle: true },
  'gill sans mt': { base: 'Lato', archetype: 'modern-sans', isGoogle: true },
  'gill sans': { base: 'Lato', archetype: 'modern-sans', isGoogle: true },
  'franklin gothic medium': { base: 'Libre Franklin', archetype: 'modern-sans', isGoogle: true },
  'segoe ui': { base: 'Segoe UI', archetype: 'modern-sans', isGoogle: false },
  'aptos': { base: 'Aptos', archetype: 'modern-sans', isGoogle: false },
  'aptos display': { base: 'Aptos Display', archetype: 'modern-sans', isGoogle: false },

  // Canva Brand & Display Fonts with Metric-Compatible Fallback Targets
  'lovelo': { base: 'League Spartan', archetype: 'geometric-sans', isGoogle: true },
  'dream avenue': { base: 'Playfair Display', archetype: 'editorial-serif', isGoogle: true },
  'brusher': { base: 'Caveat Brush', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'sunday': { base: 'Indie Flower', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'vintage': { base: 'Playfair Display', archetype: 'editorial-serif', isGoogle: true },
  'hero': { base: 'Montserrat', archetype: 'geometric-sans', isGoogle: true },
  'norwester': { base: 'Oswald', archetype: 'condensed', isGoogle: true },
  'gusto': { base: 'Alfa Slab One', archetype: 'slab-serif', isGoogle: true, defaultWeight: '400' },
  'aleo': { base: 'Aleo', archetype: 'slab-serif', isGoogle: true },
  'fredoka': { base: 'Fredoka', archetype: 'geometric-sans', isGoogle: true },
  'fredoka one': { base: 'Fredoka', archetype: 'geometric-sans', isGoogle: true },
  'righteous': { base: 'Righteous', archetype: 'geometric-sans', isGoogle: true, defaultWeight: '400' },
  'bungee': { base: 'Bungee', archetype: 'condensed', isGoogle: true, defaultWeight: '400' },
  'bungee inline': { base: 'Bungee Inline', archetype: 'condensed', isGoogle: true, defaultWeight: '400' },
  'bangers': { base: 'Bangers', archetype: 'condensed', isGoogle: true, defaultWeight: '400' },
  'special elite': { base: 'Special Elite', archetype: 'slab-serif', isGoogle: true, defaultWeight: '400' },
  'luckiest guy': { base: 'Luckiest Guy', archetype: 'condensed', isGoogle: true, defaultWeight: '400' },
  'shrikhand': { base: 'Shrikhand', archetype: 'editorial-serif', isGoogle: true, defaultWeight: '400' },
  'changa one': { base: 'Changa One', archetype: 'condensed', isGoogle: true, defaultWeight: '400' },
  'ultra': { base: 'Ultra', archetype: 'slab-serif', isGoogle: true, defaultWeight: '400' },
  'paytone one': { base: 'Paytone One', archetype: 'geometric-sans', isGoogle: true, defaultWeight: '400' },
  'russo one': { base: 'Russo One', archetype: 'condensed', isGoogle: true, defaultWeight: '400' },
  'black ops one': { base: 'Black Ops One', archetype: 'condensed', isGoogle: true, defaultWeight: '400' },
  'sniglet': { base: 'Sniglet', archetype: 'geometric-sans', isGoogle: true, defaultWeight: '400' },
  'chewy': { base: 'Chewy', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'playball': { base: 'Playball', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'rouge script': { base: 'Rouge Script', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'herr von muellerhoff': { base: 'Herr Von Muellerhoff', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'monsieur la doulaise': { base: 'Monsieur La Doulaise', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'reenie beanie': { base: 'Reenie Beanie', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'nanum pen script': { base: 'Nanum Pen Script', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'nanum brush script': { base: 'Nanum Brush Script', archetype: 'script', isGoogle: true, defaultWeight: '400' },
  'castoro titling': { base: 'Castoro Titling', archetype: 'editorial-serif', isGoogle: true, defaultWeight: '400' },
  'sarabun': { base: 'Sarabun', archetype: 'modern-sans', isGoogle: true },
  'prompt': { base: 'Prompt', archetype: 'modern-sans', isGoogle: true },
  'mitr': { base: 'Mitr', archetype: 'modern-sans', isGoogle: true },
  'chakra petch': { base: 'Chakra Petch', archetype: 'condensed', isGoogle: true },
  'noto sans thai': { base: 'Noto Sans Thai', archetype: 'modern-sans', isGoogle: true },
};

/**
 * Known Google Fonts that only provide single weight 400 (no multi-weight axes).
 * Querying these with :ital,wght@... results in HTTP 400 Bad Request.
 */
export const SINGLE_WEIGHT_GOOGLE_FONTS = new Set<string>([
  'bebas neue', 'anton', 'abril fatface', 'pacifico', 'alfa slab one', 'bangers',
  'righteous', 'satisfy', 'courgette', 'parisienne', 'marck script', 'gloria hallelujah',
  'indie flower', 'gochi hand', 'permanent marker', 'rock salt', 'kaushan script',
  'pinyon script', 'cookie', 'architects daughter', 'covered by your grace', 'luckiest guy',
  'special elite', 'shrikhand', 'changa one', 'ultra', 'paytone one', 'russo one',
  'black ops one', 'sniglet', 'chewy', 'playball', 'rouge script', 'herr von muellerhoff',
  'monsieur la doulaise', 'reenie beanie', 'nanum pen script', 'nanum brush script',
  'six caps', 'pathway gothic one', 'fjalla one', 'prata', 'marcellus', 'marcellus sc',
  'yeseva one', 'italiana', 'tenor sans', 'gilda display', 'dm serif display',
  'dm serif text', 'caveat brush', 'great vibes', 'sacramento', 'yellowtail', 'alex brush',
  'allura', 'kolker brush', 'bungee', 'bungee inline', 'league gothic'
]);

/**
 * Splits CamelCase font strings from Canva exports (e.g. "BebasNeue" -> "Bebas Neue")
 */
export function splitCamelCaseFont(str: string): string {
  if (!str || typeof str !== 'string') return '';
  if (!str.includes(' ') && /[a-z][A-Z]/.test(str)) {
    return str.replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  }
  return str;
}

/**
 * Normalizes a font name from Canva / PPTX into clean family and suggested attributes
 */
export function normalizeFontName(rawName: string): NormalizedFontInfo {
  if (!rawName || typeof rawName !== 'string') {
    return {
      originalName: '',
      baseFamily: 'Aptos',
      archetype: 'modern-sans',
      fontStack: 'Aptos, Calibri, "Segoe UI", -apple-system, sans-serif',
      isGoogleFont: false,
    };
  }

  // If rawName is a multi-font stack list (e.g. '"Grandview", "Inter", "Roboto"...'), extract the primary font
  let input = rawName;
  if (input.includes(',')) {
    const parts = input.split(',');
    for (const part of parts) {
      const cleanPart = part.replace(/^["'\s]+|["'\s]+$/g, '').trim();
      const lowerPart = cleanPart.toLowerCase();
      // Skip generic CSS keywords
      if (cleanPart && lowerPart !== 'sans-serif' && lowerPart !== 'serif' && lowerPart !== 'monospace' && lowerPart !== 'cursive' && lowerPart !== '-apple-system') {
        input = cleanPart;
        break;
      }
    }
  }

  // Strip OpenXML prefixes, quotes, and clean whitespace
  let clean = input
    .replace(/^["']+|["']+$/g, '')
    .replace(/^\+mn-lt|\+mj-lt|\+mn-ea|\+mj-ea|\+mn-cs|\+mj-cs/gi, '')
    .trim();

  // If empty after stripping
  if (!clean) {
    return {
      originalName: rawName,
      baseFamily: 'Aptos',
      archetype: 'modern-sans',
      fontStack: 'Aptos, Calibri, "Segoe UI", -apple-system, sans-serif',
      isGoogleFont: false,
    };
  }

  let suggestedWeight: NormalizedFontInfo['suggestedWeight'] = undefined;
  let suggestedStyle: NormalizedFontInfo['suggestedStyle'] = 'normal';

  // Detect style/weight modifiers attached to the font name by Canva or PowerPoint
  const lower = clean.toLowerCase();
  if (lower.includes('italic') || lower.includes('oblique')) {
    suggestedStyle = 'italic';
  }
  if (lower.includes('black') || lower.includes('heavy') || lower.includes('extra bold') || lower.includes('extrabold') || lower.includes('extra-bold')) {
    suggestedWeight = '900';
  } else if (lower.includes('bold')) {
    suggestedWeight = '700';
  } else if (lower.includes('semibold') || lower.includes('semi bold') || lower.includes('demi') || lower.includes('semi-bold')) {
    suggestedWeight = '600';
  } else if (lower.includes('medium')) {
    suggestedWeight = '500';
  } else if (lower.includes('light') || lower.includes('thin')) {
    suggestedWeight = '300';
  }

  // Strip weight/style suffixes and clean delimiters (hyphens/underscores/trailing spaces)
  let strippedFamily = clean
    .replace(/[-_]?(Black|Heavy|ExtraBold|Extra Bold|Extra-Bold|SemiBold|Semi Bold|Semi-Bold|Bold|Medium|Regular|Light|Thin|Italic|Oblique)[-_]?/gi, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  // Handle CamelCase font names exported by Canva without spaces (e.g. "BebasNeue" -> "Bebas Neue")
  const separatedFamily = splitCamelCaseFont(strippedFamily || clean);
  const familyKey = (separatedFamily || strippedFamily || clean).toLowerCase();

  const baseFamily = separatedFamily || strippedFamily || clean;

  // Check known dictionary
  if (CANVA_FONT_ARCHETYPES[familyKey]) {
    const entry = CANVA_FONT_ARCHETYPES[familyKey];
    return {
      originalName: clean,
      baseFamily: baseFamily,
      suggestedWeight: suggestedWeight || (entry.defaultWeight as any),
      suggestedStyle,
      archetype: entry.archetype,
      fontStack: getCompatibleFontStackForArchetype(clean, entry.base, entry.archetype),
      isGoogleFont: entry.isGoogle,
    };
  }

  // Check direct lower match
  if (CANVA_FONT_ARCHETYPES[lower]) {
    const entry = CANVA_FONT_ARCHETYPES[lower];
    return {
      originalName: clean,
      baseFamily: baseFamily,
      suggestedWeight: suggestedWeight || (entry.defaultWeight as any),
      suggestedStyle,
      archetype: entry.archetype,
      fontStack: getCompatibleFontStackForArchetype(clean, entry.base, entry.archetype),
      isGoogleFont: entry.isGoogle,
    };
  }

  // If not in known dictionary, infer archetype
  let inferredArchetype: FontArchetype = 'modern-sans';
  if (lower.includes('condensed') || lower.includes('narrow') || lower.includes('gothic') || lower.includes('impact') || lower.includes('anton') || lower.includes('teko')) {
    inferredArchetype = 'condensed';
  } else if (lower.includes('serif') || lower.includes('roman') || lower.includes('garamond') || lower.includes('baskerville') || lower.includes('bodoni') || lower.includes('didot')) {
    inferredArchetype = 'classic-serif';
  } else if (lower.includes('script') || lower.includes('hand') || lower.includes('brush') || lower.includes('calligraphy') || lower.includes('cursive')) {
    inferredArchetype = 'script';
  } else if (lower.includes('slab')) {
    inferredArchetype = 'slab-serif';
  } else if (lower.includes('mono') || lower.includes('code')) {
    inferredArchetype = 'monospace';
  }

  // Determine system status
  const isSystem = SYSTEM_UNIVERSAL_FONTS.has(familyKey);

  return {
    originalName: clean,
    baseFamily,
    suggestedWeight,
    suggestedStyle,
    archetype: inferredArchetype,
    fontStack: getCompatibleFontStackForArchetype(clean, baseFamily, inferredArchetype),
    isGoogleFont: !isSystem,
  };
}

/**
 * Constructs an intelligent metric-compatible fallback font stack
 * This ensures that if the computer is offline or doesn't have the font,
 * text character widths and line heights closely match, preventing layout distortion.
 */
function getCompatibleFontStackForArchetype(originalName: string, baseFamily: string, archetype: FontArchetype): string {
  const primary = originalName !== baseFamily 
    ? `"${originalName}", "${baseFamily}"` 
    : `"${originalName}"`;

  switch (archetype) {
    case 'condensed':
      // Narrow aspect ratio (~0.35 - 0.40 width)
      return `${primary}, "Bebas Neue", "Oswald", "Impact", "Arial Narrow", "Haettenschweiler", "Franklin Gothic Medium", sans-serif-condensed, sans-serif`;

    case 'geometric-sans':
      // Wide circular geometric curves (~0.55 - 0.60 width)
      return `${primary}, "Montserrat", "Poppins", "League Spartan", "Century Gothic", "Segoe UI", -apple-system, sans-serif`;

    case 'editorial-serif':
      // High-contrast vertical thick/thins
      return `${primary}, "Playfair Display", "Bodoni MT", "Didot", "Georgia", "Baskerville", serif`;

    case 'classic-serif':
      // Traditional readable book serif
      return `${primary}, "Merriweather", "Lora", "Georgia", "Cambria", "Times New Roman", serif`;

    case 'script':
      // Cursive script flourishes
      return `${primary}, "Dancing Script", "Pacifico", "Caveat", "Brush Script MT", "Segoe Script", cursive`;

    case 'slab-serif':
      // Blocky robust slab serifs
      return `${primary}, "Alfa Slab One", "Rockwell", "Roboto Slab", "Arvo", "Georgia", serif`;

    case 'monospace':
      return `${primary}, "Consolas", "Courier New", "Lucida Console", monospace`;

    case 'modern-sans':
    default:
      // Clean neutral sans-serif
      return `${primary}, "Inter", "Roboto", "Open Sans", "Lato", "Segoe UI", "Calibri", "Aptos", Arial, sans-serif`;
  }
}

/**
 * Public helper to get the compatible font stack for any font name
 */
export function getCompatibleFontStack(fontFamily: string): string {
  const info = normalizeFontName(fontFamily);
  return info.fontStack;
}

const registeredAliases = new Set<string>();
let aliasStyleSheet: HTMLStyleElement | null = null;

/**
 * Injects dynamic @font-face fallback aliases into the DOM.
 * This guarantees that when pptx-react-viewer or custom components use font names
 * like "Canva Sans", "Montserrat-Bold", "BebasNeue", or custom fonts:
 * 1. The browser immediately aliases them to local metric-compatible fonts.
 * 2. It NEVER flashes or falls back to Times New Roman.
 * 3. As soon as the web font finishes loading, the alias points to the downloaded font.
 */
export function registerFontAliasesInDom(rawFontNames: string[]): void {
  if (typeof document === 'undefined') return;
  if (!Array.isArray(rawFontNames) || rawFontNames.length === 0) return;

  if (!aliasStyleSheet) {
    aliasStyleSheet = document.getElementById('sw-dynamic-font-fallbacks') as HTMLStyleElement;
    if (!aliasStyleSheet) {
      aliasStyleSheet = document.createElement('style');
      aliasStyleSheet.id = 'sw-dynamic-font-fallbacks';
      document.head.appendChild(aliasStyleSheet);
    }
  }

  let newRules = '';
  for (const raw of rawFontNames) {
    if (!raw || typeof raw !== 'string') continue;
    const cleanRaw = raw.replace(/^["']+|["']+$/g, '').trim();
    if (!cleanRaw || registeredAliases.has(cleanRaw.toLowerCase())) continue;
    registeredAliases.add(cleanRaw.toLowerCase());

    const info = normalizeFontName(cleanRaw);
    const base = info.baseFamily;
    const archetype = info.archetype;
    const weight = info.suggestedWeight || 'normal';
    const style = info.suggestedStyle || 'normal';

    let localFallbacks: string[] = [];
    switch (archetype) {
      case 'condensed':
        localFallbacks = [base, 'Bebas Neue', 'Oswald', 'Anton', 'Impact', 'Arial Narrow', 'Haettenschweiler', 'Franklin Gothic Medium', 'sans-serif-condensed'];
        break;
      case 'geometric-sans':
        localFallbacks = [base, 'League Spartan', 'Montserrat', 'Poppins', 'Outfit', 'Century Gothic', 'Segoe UI', 'Arial'];
        break;
      case 'editorial-serif':
        localFallbacks = [base, 'Playfair Display', 'Bodoni MT', 'Prata', 'Didot', 'Georgia', 'Baskerville', 'Times New Roman'];
        break;
      case 'classic-serif':
        localFallbacks = [base, 'Merriweather', 'Lora', 'Georgia', 'Cambria', 'Times New Roman'];
        break;
      case 'script':
        localFallbacks = [base, 'Dancing Script', 'Pacifico', 'Caveat', 'Brush Script MT', 'Segoe Script', 'cursive'];
        break;
      case 'slab-serif':
        localFallbacks = [base, 'Alfa Slab One', 'Rockwell', 'Roboto Slab', 'Arvo', 'Georgia'];
        break;
      case 'monospace':
        localFallbacks = [base, 'Consolas', 'Courier New', 'Lucida Console', 'monospace'];
        break;
      case 'modern-sans':
      default:
        localFallbacks = [base, 'Inter', 'Roboto', 'Open Sans', 'Lato', 'Segoe UI', 'Calibri', 'Aptos', 'Arial'];
        break;
    }

    const uniqueLocal = Array.from(new Set(localFallbacks.map(f => f.trim()))).filter(Boolean);
    const srcList = uniqueLocal.map(f => `local("${f}")`).join(', ');

    newRules += `
@font-face {
  font-family: "${cleanRaw}";
  src: ${srcList};
  font-display: swap;
  ${weight !== 'normal' ? `font-weight: ${weight};` : ''}
  ${style !== 'normal' ? `font-style: ${style};` : ''}
}
`;

    if (base && base.toLowerCase() !== cleanRaw.toLowerCase() && !registeredAliases.has(base.toLowerCase())) {
      registeredAliases.add(base.toLowerCase());
      const baseSrcList = uniqueLocal.map(f => `local("${f}")`).join(', ');
      newRules += `
@font-face {
  font-family: "${base}";
  src: ${baseSrcList};
  font-display: swap;
  ${weight !== 'normal' ? `font-weight: ${weight};` : ''}
  ${style !== 'normal' ? `font-style: ${style};` : ''}
}
`;
    }
  }

  if (newRules && aliasStyleSheet) {
    aliasStyleSheet.textContent += newRules;
  }
}

const extractedFontsCache = new WeakMap<object, string[]>();

/**
 * Decodes XML character entities safely
 */
export function decodeXmlEntities(str: string): string {
  if (!str || !str.includes('&')) return str;
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Robustly cleans and sanitizes raw font name strings extracted from PPTX OpenXML packages.
 * Strips outer quotes, theme modifiers, PowerPoint bracketed role tags like "(Body)", "(Headings)",
 * and resolves +mj-lt (Theme Major) / +mn-lt (Theme Minor) aliases.
 */
export function cleanPptxFontName(raw: string, themeMajor?: string | null, themeMinor?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  let s = decodeXmlEntities(raw).replace(/[\u00A0\s]+/g, ' ').trim();
  s = s.replace(/\s*\((?:Body|Headings|Theme|Major|Minor|East Asian|Complex Script)\)/gi, '').trim();
  s = s.replace(/^["']+|["']+$/g, '').trim();

  // If raw contains comma-separated font stack, pick the primary font
  if (s.includes(',')) {
    const parts = s.split(',');
    for (const part of parts) {
      const cleanPart = part.replace(/^["'\s]+|["'\s]+$/g, '').trim();
      const lowerPart = cleanPart.toLowerCase();
      if (cleanPart && lowerPart !== 'sans-serif' && lowerPart !== 'serif' && lowerPart !== 'monospace' && lowerPart !== 'cursive' && lowerPart !== '-apple-system') {
        s = cleanPart;
        break;
      }
    }
  }

  // Strip quotes again in case the extracted part had them
  s = s.replace(/^["']+|["']+$/g, '').trim();

  // Resolve theme aliases
  if (/^\+mj-(?:lt|ea|cs)$/i.test(s)) {
    return themeMajor ? themeMajor.trim() : '';
  }
  if (/^\+mn-(?:lt|ea|cs)$/i.test(s)) {
    return themeMinor ? themeMinor.trim() : '';
  }

  // Filter unresolved theme tokens or non-font artifacts
  if (s.startsWith('+') || s.length <= 1) return '';
  // Avoid common non-font OpenXML values
  const lower = s.toLowerCase();
  if (lower === 'none' || lower === 'inherit' || lower === 'auto' || lower === 'transparent') return '';

  return s;
}

/**
 * Detects and extracts embedded TrueType/OpenType font binaries from a PPTX file.
 * Automatically loads them into document.fonts and memory cache.
 */
async function extractAndInstallEmbeddedPptxFonts(loadedZip: JSZip): Promise<string[]> {
  const installed: string[] = [];
  try {
    // 1. Check ppt/presentation.xml for <p:embeddedFontLst>
    const presFile = Object.keys(loadedZip.files).find(k => /^ppt[\/\\]presentation\.xml$/i.test(k));
    const embeddedNames = new Map<string, string>(); // relId -> fontName
    if (presFile) {
      const presXml = await loadedZip.files[presFile].async('text');
      const fontBlockRegex = /<p:embeddedFont>([\s\S]*?)<\/p:embeddedFont>/gi;
      let fbMatch: RegExpExecArray | null;
      while ((fbMatch = fontBlockRegex.exec(presXml)) !== null) {
        const block = fbMatch[1];
        const tfMatch = /<p:font\s+[^>]*typeface=["']([^"']+)["']/i.exec(block);
        const relMatch = /<p:(?:regular|bold|italic|bi)\s+[^>]*r:id=["']([^"']+)["']/i.exec(block);
        if (tfMatch && tfMatch[1] && relMatch && relMatch[1]) {
          const fontName = cleanPptxFontName(tfMatch[1]);
          if (fontName) embeddedNames.set(relMatch[1], fontName);
        }
      }
    }

    // 2. Check ppt/_rels/presentation.xml.rels for font paths
    const relsFile = Object.keys(loadedZip.files).find(k => /^ppt[\/\\]_rels[\/\\]presentation\.xml\.rels$/i.test(k));
    const relPathMap = new Map<string, string>(); // relId -> zipPath
    if (relsFile) {
      const relsXml = await loadedZip.files[relsFile].async('text');
      const relRegex = /<Relationship\s+[^>]*Id=["']([^"']+)["'][^>]*Target=["']([^"']+)["']/gi;
      let rMatch: RegExpExecArray | null;
      while ((rMatch = relRegex.exec(relsXml)) !== null) {
        const id = rMatch[1];
        let target = rMatch[2];
        if (target.toLowerCase().includes('font')) {
          if (!target.startsWith('ppt/')) target = 'ppt/' + target.replace(/^\.\.\/|^\//, '');
          relPathMap.set(id, target);
        }
      }
    }

    // 3. Scan ppt/fonts/ files
    const fontFiles = Object.keys(loadedZip.files).filter(k => /^ppt[\/\\]fonts[\/\\]/i.test(k));
    for (const fPath of fontFiles) {
      try {
        let fontName: string | undefined;
        for (const [rId, target] of relPathMap.entries()) {
          if (target.toLowerCase() === fPath.toLowerCase() || fPath.toLowerCase().endsWith(target.toLowerCase())) {
            fontName = embeddedNames.get(rId);
            break;
          }
        }
        
        const fileData = await loadedZip.files[fPath].async('uint8array');
        if (fileData && fileData.length > 32) {
          // Validate font integrity and magic byte signatures (TrueType/OpenType/WOFF)
          const integrity = FontValidationService.validateFontSync(fileData, { strictTableValidation: false });
          const effectiveName = fontName || integrity.fontFamilyName;

          if (integrity.isValid && effectiveName && typeof FontFace !== 'undefined') {
            const fontFace = new FontFace(effectiveName, fileData);
            await fontFace.load();
            document.fonts.add(fontFace);
            inMemoryInstalledFonts.add(effectiveName.toLowerCase());
            installed.push(effectiveName);
          }
        }
      } catch {}
    }
  } catch {}
  return installed;
}

/**
 * Extracts all unique font names used across a PPTX archive
 */
export async function extractFontsFromPptx(file: File | Blob | ArrayBuffer | Uint8Array): Promise<string[]> {
  if (!file) return [];

  const cacheKey = typeof file === 'object' ? file : null;
  if (cacheKey && extractedFontsCache.has(cacheKey)) {
    return extractedFontsCache.get(cacheKey)!;
  }

  let zipData: ArrayBuffer | Uint8Array;
  if (file instanceof Blob) {
    if (file.size === 0) return [];
    zipData = await file.arrayBuffer();
  } else {
    zipData = file;
  }

  const zip = new JSZip();
  let loadedZip: JSZip;
  try {
    loadedZip = await zip.loadAsync(zipData);
  } catch (err) {
    console.warn('[pptxFontManager] Unable to open ZIP container:', err);
    return [];
  }

  const uniqueFonts = new Set<string>();
  let themeMajorLatin: string | null = null;
  let themeMinorLatin: string | null = null;

  // 1. Scan Themes and capture Major & Minor theme fonts
  const themeFiles = Object.keys(loadedZip.files).filter(k => /^ppt[\/\\]theme[\/\\]/i.test(k));
  for (const tPath of themeFiles) {
    try {
      const xml = await loadedZip.files[tPath].async('text');
      
      const majorMatch = /<a:majorFont>[\s\S]*?<a:latin\s+typeface=["']([^"']+)["']/i.exec(xml);
      if (majorMatch && majorMatch[1]) {
        themeMajorLatin = cleanPptxFontName(majorMatch[1]);
        if (themeMajorLatin) uniqueFonts.add(themeMajorLatin);
      }
      const minorMatch = /<a:minorFont>[\s\S]*?<a:latin\s+typeface=["']([^"']+)["']/i.exec(xml);
      if (minorMatch && minorMatch[1]) {
        themeMinorLatin = cleanPptxFontName(minorMatch[1]);
        if (themeMinorLatin) uniqueFonts.add(themeMinorLatin);
      }
      // Scan script-specific theme fonts (e.g. <a:font script="Thai" typeface="..."/>)
      const scriptFontRegex = /<a:font\b[^>]*?\btypeface=["']([^"']+)["']/gi;
      let sfMatch: RegExpExecArray | null;
      while ((sfMatch = scriptFontRegex.exec(xml)) !== null) {
        const cleaned = cleanPptxFontName(sfMatch[1], themeMajorLatin, themeMinorLatin);
        if (cleaned) uniqueFonts.add(cleaned);
      }
    } catch {}
  }

  const addFontClean = (raw: string) => {
    const cleaned = cleanPptxFontName(raw, themeMajorLatin, themeMinorLatin);
    if (cleaned) uniqueFonts.add(cleaned);
  };

  const extractFromXml = (xml: string) => {
    // 1. Strict regex for DrawingML & PresentationML font definitions
    // Matches typeface attribute in <a:latin>, <a:ea>, <a:cs>, <a:sym>, <a:font>, <p:font>, <a:rPr>, <a:defRPr>, <a:endParaRPr>
    const typefaceRegex = /\btypeface=["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = typefaceRegex.exec(xml)) !== null) {
      addFontClean(match[1]);
    }
    // 2. Legacy VML / HTML font face: <font face="...">
    const fontFaceTagRegex = /<font\b[^>]*?\bface=["']([^"']+)["']/gi;
    while ((match = fontFaceTagRegex.exec(xml)) !== null) {
      addFontClean(match[1]);
    }
  };

  // 2. Scan Presentation Defaults & Embedded Fonts
  const presFile = Object.keys(loadedZip.files).find(k => /^ppt[\/\\]presentation\.xml$/i.test(k));
  if (presFile && loadedZip.files[presFile]) {
    try {
      const xml = await loadedZip.files[presFile].async('text');
      extractFromXml(xml);
    } catch {}
  }

  // 3. Scan Slides
  const slideFiles = Object.keys(loadedZip.files).filter(k => /^ppt[\/\\]slides[\/\\]slide\d+\.xml$/i.test(k));
  for (const sPath of slideFiles) {
    try {
      const xml = await loadedZip.files[sPath].async('text');
      extractFromXml(xml);
    } catch {}
  }

  // 4. Scan Slide Layouts & Masters
  const layoutFiles = Object.keys(loadedZip.files).filter(k => 
    /^ppt[\/\\](?:slideLayouts|slideMasters|notesSlides)[\/\\]/i.test(k)
  );
  for (const lPath of layoutFiles) {
    try {
      const xml = await loadedZip.files[lPath].async('text');
      extractFromXml(xml);
    } catch {}
  }

  // 5. Scan Diagrams / SmartArt and Charts
  const diagramFiles = Object.keys(loadedZip.files).filter(k => 
    /^ppt[\/\\](?:diagrams|charts)[\/\\]/i.test(k)
  );
  for (const dPath of diagramFiles) {
    try {
      const xml = await loadedZip.files[dPath].async('text');
      extractFromXml(xml);
    } catch {}
  }

  // 6. Extract any embedded font binaries directly from PPTX package
  try {
    await extractAndInstallEmbeddedPptxFonts(loadedZip);
  } catch {}

  const extractedList = Array.from(uniqueFonts).filter(f => f && f.length > 1);
  if (cacheKey) {
    extractedFontsCache.set(cacheKey, extractedList);
  }
  registerFontAliasesInDom(extractedList);
  return extractedList;
}

export interface DetectedFontScanItem {
  fontName: string;
  normalizedFamily: string;
  isInstalledLocally: boolean;
  isUniversalSystemFont: boolean;
  isAppInstalled: boolean;
  status: 'installed' | 'missing';
  googleFontAvailable: boolean;
  archetype: FontArchetype;
  slidesUsed: number[];
  sampleText?: string;
}

export interface PptxFontScanResult {
  allFonts: DetectedFontScanItem[];
  missingFonts: DetectedFontScanItem[];
  installedFonts: DetectedFontScanItem[];
  totalFonts: number;
  totalSlides: number;
}

/**
 * In-depth scan of all fonts and text across a PPTX presentation
 * Detects missing fonts not present in the system unit or app registry.
 */
export async function scanPptxFontsDetailed(file: File | Blob | ArrayBuffer | Uint8Array): Promise<PptxFontScanResult> {
  if (!file) {
    return { allFonts: [], missingFonts: [], installedFonts: [], totalFonts: 0, totalSlides: 0 };
  }

  try {
    await initFontStorage();
  } catch {}

  let zipData: ArrayBuffer | Uint8Array;
  if (file instanceof Blob) {
    if (file.size === 0) {
      return { allFonts: [], missingFonts: [], installedFonts: [], totalFonts: 0, totalSlides: 0 };
    }
    zipData = await file.arrayBuffer();
  } else {
    zipData = file;
  }

  const zip = new JSZip();
  let loadedZip: JSZip;
  try {
    loadedZip = await zip.loadAsync(zipData);
  } catch (err) {
    console.warn('[pptxFontManager] Unable to open ZIP container for detailed scan:', err);
    return { allFonts: [], missingFonts: [], installedFonts: [], totalFonts: 0, totalSlides: 0 };
  }

  let themeMajorLatin: string | null = null;
  let themeMinorLatin: string | null = null;

  interface FontUsageEntry {
    name: string;
    slides: Set<number>;
    sampleText?: string;
  }

  const fontUsageMap = new Map<string, FontUsageEntry>();

  const recordFont = (rawName: string, slideNum: number, text?: string) => {
    const effective = cleanPptxFontName(rawName, themeMajorLatin, themeMinorLatin);
    if (!effective || effective.length <= 1) return;

    const key = effective.toLowerCase();
    let entry = fontUsageMap.get(key);
    if (!entry) {
      entry = { name: effective, slides: new Set<number>() };
      fontUsageMap.set(key, entry);
    }
    if (slideNum > 0) entry.slides.add(slideNum);
    if (text && text.trim().length > 1 && !entry.sampleText) {
      entry.sampleText = text.trim().slice(0, 70);
    }
  };

  // 1. Scan Themes
  const themeFiles = Object.keys(loadedZip.files).filter(k => /^ppt[\/\\]theme[\/\\]/i.test(k));
  for (const tPath of themeFiles) {
    try {
      const xml = await loadedZip.files[tPath].async('text');
      const majorMatch = /<a:majorFont>[\s\S]*?<a:latin\s+typeface=["']([^"']+)["']/i.exec(xml);
      if (majorMatch && majorMatch[1]) {
        themeMajorLatin = cleanPptxFontName(majorMatch[1]);
        if (themeMajorLatin) {
          recordFont(themeMajorLatin, 0, 'Presentation Theme Headings (Major Font)');
        }
      }
      const minorMatch = /<a:minorFont>[\s\S]*?<a:latin\s+typeface=["']([^"']+)["']/i.exec(xml);
      if (minorMatch && minorMatch[1]) {
        themeMinorLatin = cleanPptxFontName(minorMatch[1]);
        if (themeMinorLatin) {
          recordFont(themeMinorLatin, 0, 'Presentation Theme Body (Minor Font)');
        }
      }
      const scriptFontRegex = /<a:font\b[^>]*?\btypeface=["']([^"']+)["']/gi;
      let sfMatch: RegExpExecArray | null;
      while ((sfMatch = scriptFontRegex.exec(xml)) !== null) {
        recordFont(sfMatch[1], 0, 'Presentation Theme Script Font');
      }
    } catch {}
  }

  // 2. Scan Slides
  const slideFileRegex = /^ppt[\/\\]slides[\/\\]slide(\d+)\.xml$/i;
  const slideFiles = Object.keys(loadedZip.files)
    .filter(k => slideFileRegex.test(k))
    .sort((a, b) => {
      const numA = parseInt(a.match(slideFileRegex)?.[1] || '0', 10);
      const numB = parseInt(b.match(slideFileRegex)?.[1] || '0', 10);
      return numA - numB;
    });

  const totalSlides = slideFiles.length;

  for (const sPath of slideFiles) {
    const sMatch = sPath.match(slideFileRegex);
    const slideNum = sMatch ? parseInt(sMatch[1], 10) : 1;

    try {
      const xml = await loadedZip.files[sPath].async('text');

      // Match paragraphs <a:p> to link fonts with text
      const paraRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/gi;
      let pMatch: RegExpExecArray | null;

      while ((pMatch = paraRegex.exec(xml)) !== null) {
        const paraXml = pMatch[1];
        
        // Extract paragraph text
        const tMatches: string[] = [];
        const tRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/gi;
        let tMatch: RegExpExecArray | null;
        while ((tMatch = tRegex.exec(paraXml)) !== null) {
          tMatches.push(tMatch[1]);
        }
        const fullParaText = decodeXmlEntities(tMatches.join(''));

        // Extract runs inside paragraph
        const runRegex = /<a:r\b[^>]*>([\s\S]*?)<\/a:r>/gi;
        let rMatch: RegExpExecArray | null;
        let foundRunFont = false;

        while ((rMatch = runRegex.exec(paraXml)) !== null) {
          const runXml = rMatch[1];
          const runTextMatch = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/i.exec(runXml);
          const runText = runTextMatch ? decodeXmlEntities(runTextMatch[1]) : fullParaText;

          // Scan all typeface attributes within this run (<a:latin>, <a:ea>, <a:cs>, <a:sym>)
          const runTypefaceRegex = /\btypeface=["']([^"']+)["']/gi;
          let rtfMatch: RegExpExecArray | null;
          while ((rtfMatch = runTypefaceRegex.exec(runXml)) !== null) {
            recordFont(rtfMatch[1], slideNum, runText);
            foundRunFont = true;
          }
        }

        // If no explicit run font, check paragraph default / defRPr / endParaRPr
        if (!foundRunFont) {
          const defTypefaceRegex = /\btypeface=["']([^"']+)["']/gi;
          let defMatch: RegExpExecArray | null;
          while ((defMatch = defTypefaceRegex.exec(paraXml)) !== null) {
            recordFont(defMatch[1], slideNum, fullParaText);
          }
        }
      }

      // Also general typeface scan across slide XML for shapes, tables, connectors
      const typefaceRegex = /\btypeface=["']([^"']+)["']/gi;
      let m: RegExpExecArray | null;
      while ((m = typefaceRegex.exec(xml)) !== null) {
        recordFont(m[1], slideNum);
      }
      const fontFaceRegex = /<font\b[^>]*?\bface=["']([^"']+)["']/gi;
      while ((m = fontFaceRegex.exec(xml)) !== null) {
        recordFont(m[1], slideNum);
      }
    } catch {}
  }

  // 2b. Also scan Slide Layouts, Masters, Diagrams, Charts, and Presentation Defaults
  const secondaryFiles = Object.keys(loadedZip.files).filter(k => 
    /^ppt[\/\\](?:slideLayouts|slideMasters|notesSlides|diagrams|charts)[\/\\]/i.test(k) ||
    /^ppt[\/\\]presentation\.xml$/i.test(k)
  );

  for (const mPath of secondaryFiles) {
    try {
      const xml = await loadedZip.files[mPath].async('text');
      const typefaceRegex = /\btypeface=["']([^"']+)["']/gi;
      let m: RegExpExecArray | null;
      while ((m = typefaceRegex.exec(xml)) !== null) {
        recordFont(m[1], 0);
      }
      const fontFaceRegex = /<font\b[^>]*?\bface=["']([^"']+)["']/gi;
      while ((m = fontFaceRegex.exec(xml)) !== null) {
        recordFont(m[1], 0);
      }
    } catch {}
  }

  // 2c. Check for embedded font binaries inside the PPTX package and register them
  try {
    await extractAndInstallEmbeddedPptxFonts(loadedZip);
  } catch {}

  // 3. Process scan results
  const allFonts: DetectedFontScanItem[] = [];
  const missingFonts: DetectedFontScanItem[] = [];
  const installedFonts: DetectedFontScanItem[] = [];

  for (const entry of fontUsageMap.values()) {
    const rawName = entry.name;
    const info = normalizeFontName(rawName);
    const baseFamily = info.baseFamily;
    const lower = baseFamily.toLowerCase();
    const rawLower = rawName.toLowerCase();

    const isUniversal = SYSTEM_UNIVERSAL_FONTS.has(lower) || SYSTEM_UNIVERSAL_FONTS.has(rawLower);
    const isLocal = isUniversal || isFontInstalledLocally(rawName) || isFontInstalledLocally(baseFamily);
    const isAppCached = inMemoryInstalledFonts.has(lower) || inMemoryInstalledFonts.has(rawLower) || loadedFontsCache.has(baseFamily) || loadedFontsCache.has(rawName);

    const isInstalled = isUniversal || isLocal || isAppCached;
    const status = isInstalled ? 'installed' : 'missing';

    const slidesList = Array.from(entry.slides).sort((a, b) => a - b);
    const effectiveSlides = slidesList.length > 0 ? slidesList : (totalSlides > 0 ? [1] : [1]);

    const item: DetectedFontScanItem = {
      fontName: rawName,
      normalizedFamily: baseFamily,
      isInstalledLocally: isLocal,
      isUniversalSystemFont: isUniversal,
      isAppInstalled: isAppCached,
      status,
      googleFontAvailable: info.isGoogleFont || Boolean(CANVA_FONT_ARCHETYPES[lower]?.isGoogle),
      archetype: info.archetype,
      slidesUsed: effectiveSlides,
      sampleText: entry.sampleText || `${rawName} (Slide Master / Theme)`,
    };

    allFonts.push(item);
    if (status === 'missing') {
      missingFonts.push(item);
    } else {
      installedFonts.push(item);
    }
  }

  registerFontAliasesInDom(allFonts.map(f => f.fontName));

  return {
    allFonts,
    missingFonts,
    installedFonts,
    totalFonts: allFonts.length,
    totalSlides,
  };
}

/// In-memory cache of already loaded or attempted web fonts
const loadedFontsCache = new Set<string>();
const inFlightPromises = new Map<string, Promise<boolean>>();
const prewarmedFontsCache = new Set<string>();

export interface FontCachePreferences {
  autoPrewarmOnStartup: boolean;
  autoPrewarmOnImport: boolean;
  prewarmCuratedSuiteOnStartup: boolean;
}

const DEFAULT_FONT_CACHE_PREFERENCES: FontCachePreferences = {
  autoPrewarmOnStartup: true,
  autoPrewarmOnImport: true,
  prewarmCuratedSuiteOnStartup: false,
};

let cachedPreferences: FontCachePreferences = { ...DEFAULT_FONT_CACHE_PREFERENCES };

if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const raw = window.localStorage.getItem('sw_font_cache_preferences');
    if (raw) {
      cachedPreferences = { ...DEFAULT_FONT_CACHE_PREFERENCES, ...JSON.parse(raw) };
    }
  } catch {}
}

export function getFontCachePreferences(): FontCachePreferences {
  return { ...cachedPreferences };
}

export function saveFontCachePreferences(partial: Partial<FontCachePreferences>): FontCachePreferences {
  cachedPreferences = { ...cachedPreferences, ...partial };
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem('sw_font_cache_preferences', JSON.stringify(cachedPreferences));
    } catch {}
    window.dispatchEvent(new CustomEvent('simpleworship:font-cache-prefs-changed', { detail: cachedPreferences }));
  }
  return getFontCachePreferences();
}

/**
 * Developer Simulation Mode Configuration
 * Allows force-simulating 'missing font' scenarios to rigorously test the auto-adapt engine,
 * fallback stacks, and Google Fonts background downloading.
 */
export interface FontSimulationConfig {
  enabled: boolean;
  simulateAllNonUniversalMissing: boolean;
  simulatedMissingFonts: string[];
  simulateOfflineFallback: boolean;
  simulatedDownloadDelayMs: number;
}

export interface FontDebugLogEntry {
  id: string;
  timestamp: number;
  fontFamily: string;
  type: 'probe-local' | 'probe-simulated-missing' | 'download-start' | 'download-success' | 'download-failed' | 'fallback-applied' | 'cache-purge';
  message: string;
  details?: Record<string, any>;
}

export interface FontTestResult {
  fontName: string;
  normalized: NormalizedFontInfo;
  isUniversalSystemFont: boolean;
  isLocallyInstalledReal: boolean;
  isLocallyInstalledEffective: boolean;
  simulationApplied: boolean;
  downloadAttempted: boolean;
  downloadSuccess: boolean;
  resolvedFontStack: string;
  fallbackUsed: boolean;
  durationMs: number;
  apiUrl?: string;
}

// Initial simulation state
let fontSimulationConfig: FontSimulationConfig = {
  enabled: false,
  simulateAllNonUniversalMissing: false,
  simulatedMissingFonts: [],
  simulateOfflineFallback: false,
  simulatedDownloadDelayMs: 0,
};

// Try to restore simulation configuration from sessionStorage for persistent dev workflow
if (typeof window !== 'undefined' && window.sessionStorage) {
  try {
    const saved = window.sessionStorage.getItem('sw_font_simulation_config');
    if (saved) {
      fontSimulationConfig = { ...fontSimulationConfig, ...JSON.parse(saved) };
    }
  } catch {}
}

const debugLogs: FontDebugLogEntry[] = [];
const MAX_DEBUG_LOGS = 100;

function addDebugLog(type: FontDebugLogEntry['type'], fontFamily: string, message: string, details?: Record<string, any>) {
  const entry: FontDebugLogEntry = {
    id: `flog-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    fontFamily,
    type,
    message,
    details,
  };
  debugLogs.unshift(entry);
  if (debugLogs.length > MAX_DEBUG_LOGS) {
    debugLogs.pop();
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('simpleworship:font-debug-logged', { detail: entry }));
  }
}

/**
 * Returns the current simulation configuration
 */
export function getFontSimulationConfig(): FontSimulationConfig {
  return { ...fontSimulationConfig, simulatedMissingFonts: [...fontSimulationConfig.simulatedMissingFonts] };
}

/**
 * Updates developer mode simulation configuration
 */
export function setFontSimulationConfig(partial: Partial<FontSimulationConfig>): FontSimulationConfig {
  fontSimulationConfig = {
    ...fontSimulationConfig,
    ...partial,
  };

  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.setItem('sw_font_simulation_config', JSON.stringify(fontSimulationConfig));
    } catch {}
    window.dispatchEvent(new CustomEvent('simpleworship:font-simulation-changed', { detail: fontSimulationConfig }));
  }

  addDebugLog('probe-simulated-missing', 'CONFIG', `Simulation config updated: Enabled=${fontSimulationConfig.enabled}`, fontSimulationConfig);
  return getFontSimulationConfig();
}

/**
 * Gets all recent font debug logs
 */
export function getFontDebugLogs(): FontDebugLogEntry[] {
  return [...debugLogs];
}

/**
 * Clears the debug log history
 */
export function clearFontDebugLogs(): void {
  debugLogs.length = 0;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('simpleworship:font-debug-cleared'));
  }
}

export interface FontCacheStats {
  totalInMemory: number;
  cachedFamilies: string[];
  prewarmedFamilies: string[];
  injectedLinks: Array<{ id: string; href: string; family: string }>;
  systemUniversalCount: number;
  isFontFaceSupported: boolean;
  documentFontsCount: number;
}

/**
 * Returns real-time metrics and state of the in-memory font cache and registered DOM stylesheets
 */
export function getFontCacheStats(): FontCacheStats {
  const cachedFamilies = Array.from(loadedFontsCache);
  const prewarmedFamilies = Array.from(prewarmedFontsCache);
  const injectedLinks: Array<{ id: string; href: string; family: string }> = [];

  if (typeof document !== 'undefined') {
    const links = document.querySelectorAll('link[id^="sw-font-"]');
    links.forEach((l) => {
      const el = l as HTMLLinkElement;
      const id = el.id || '';
      const rawFam = id.replace(/^sw-font-/, '').replace(/-fallback$/, '').replace(/-/g, ' ');
      injectedLinks.push({
        id,
        href: el.href || '',
        family: rawFam,
      });
    });
  }

  let documentFontsCount = 0;
  if (typeof document !== 'undefined' && (document as any).fonts) {
    try {
      documentFontsCount = (document as any).fonts.size || 0;
    } catch {}
  }

  return {
    totalInMemory: cachedFamilies.length,
    cachedFamilies,
    prewarmedFamilies,
    injectedLinks,
    systemUniversalCount: SYSTEM_UNIVERSAL_FONTS.size,
    isFontFaceSupported: typeof document !== 'undefined' && 'fonts' in document,
    documentFontsCount,
  };
}

/**
 * Pre-warms and compiles glyphs into the browser/GPU text cache in advance.
 * Solves runtime rendering lag and FOUT (Flash of Unstyled Text) during live presentation transitions.
 */
export async function prewarmFontGlyphs(fontFamily: string): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const info = normalizeFontName(fontFamily);
  const baseFamily = info.baseFamily;
  if (!baseFamily) return false;

  try {
    // 1. Ensure font is registered in DOM or downloaded
    const downloaded = await downloadAndRegisterWebFont(baseFamily);
    if (!downloaded && !isFontInstalledLocally(baseFamily)) {
      return false;
    }

    // 2. Pre-load standard weights using document.fonts API if available
    if (document.fonts) {
      const weights = ['400', '700', '300', '600'];
      const loadPromises = weights.map(w => 
        document.fonts.load(`${w} 24px "${baseFamily}"`).catch(() => null)
      );
      await Promise.all(loadPromises);
      await document.fonts.ready.catch(() => {});
    }

    // 3. Offscreen canvas rasterization test to prime the browser/GPU glyph cache
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.font = `400 24px "${baseFamily}", sans-serif`;
        ctx.fillText('ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 Amazing Grace', 0, 20);
        ctx.font = `700 24px "${baseFamily}", sans-serif`;
        ctx.fillText('Worship Live Holy Scripture Presentation Slide', 0, 20);
      }
    } catch {}

    prewarmedFontsCache.add(baseFamily);
    loadedFontsCache.add(baseFamily);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('simpleworship:font-cache-updated', { detail: { family: baseFamily } }));
    }
    return true;
  } catch (err) {
    console.warn(`[pptxFontManager] Pre-warm failed for ${baseFamily}:`, err);
    return false;
  }
}

/**
 * Pre-warms a list of fonts in controlled parallel batches
 */
export async function prewarmFontBatch(
  fontFamilies: string[],
  onProgress?: (completed: number, total: number, currentFont: string, success: boolean) => void
): Promise<{ successful: string[]; failed: string[] }> {
  // Deduplicate and normalize
  const uniqueFamilies: string[] = [];
  const seen = new Set<string>();

  for (const raw of fontFamilies) {
    if (!raw) continue;
    const base = normalizeFontName(raw).baseFamily;
    if (base && !seen.has(base.toLowerCase())) {
      seen.add(base.toLowerCase());
      uniqueFamilies.push(base);
    }
  }

  const total = uniqueFamilies.length;
  const successful: string[] = [];
  const failed: string[] = [];
  let completed = 0;

  // Process in chunks of 4 concurrent font loads
  const CHUNK_SIZE = 4;
  for (let i = 0; i < total; i += CHUNK_SIZE) {
    const chunk = uniqueFamilies.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (fam) => {
        const ok = await prewarmFontGlyphs(fam);
        if (ok) {
          successful.push(fam);
        } else {
          failed.push(fam);
        }
        completed += 1;
        if (onProgress) {
          onProgress(completed, total, fam, ok);
        }
      })
    );
  }

  return { successful, failed };
}

/**
 * Curated list of popular Canva, PowerPoint, and worship presentation fonts categorized by display archetype
 */
export function getCuratedWorshipFontGroups(): {
  category: string;
  description: string;
  fonts: string[];
}[] {
  return [
    {
      category: 'Bold & Condensed Display (Canva Titles & Posters)',
      description: 'High-impact, condensed typefaces for lyric headers, sermon themes, and countdown banners.',
      fonts: ['Bebas Neue', 'Oswald', 'Anton', 'Teko', 'Fjalla One', 'Barlow Condensed', 'League Gothic'],
    },
    {
      category: 'Geometric Sans (Modern Worship & Clean Slide Text)',
      description: 'The standard for contemporary church presentations, Canva graphics, and multi-line lyrics.',
      fonts: ['Montserrat', 'Poppins', 'League Spartan', 'Outfit', 'Plus Jakarta Sans', 'Urbanist', 'Quicksand', 'Figtree', 'Nunito'],
    },
    {
      category: 'Editorial & Luxury Serifs (Scripture & Elegance)',
      description: 'High-contrast, sophisticated serifs suited for Bible passages, liturgical readings, and sermon quotes.',
      fonts: ['Playfair Display', 'Cinzel', 'Bodoni Moda', 'Cormorant Garamond', 'Prata', 'Fraunces', 'Abril Fatface', 'DM Serif Display', 'Merriweather', 'Lora'],
    },
    {
      category: 'Modern Humanist & UI Sans (Crystal-Clear Body Text)',
      description: 'Ultra-legible, balanced sans-serifs engineered for stage monitors, lower thirds, and congregation displays.',
      fonts: ['Inter', 'Roboto', 'Open Sans', 'Lato', 'Raleway', 'DM Sans', 'Work Sans', 'Space Grotesk'],
    },
    {
      category: 'Script & Handwritten (Inspirational Quotes & Callouts)',
      description: 'Graceful calligraphy and brush lettering for fellowship slides, event announcements, and prayer banners.',
      fonts: ['Great Vibes', 'Dancing Script', 'Caveat', 'Pacifico', 'Sacramento', 'Alex Brush', 'Satisfy', 'Lobster', 'Parisienne'],
    },
  ];
}

/**
 * Scans slide elements and objects from presentation slides to extract all referenced fonts
 */
export function scanFontsFromPresentationSlides(slides: any[]): string[] {
  const fonts = new Set<string>();
  if (!Array.isArray(slides)) return [];

  for (const slide of slides) {
    if (!slide) continue;

    // 1. Direct slide font properties
    if (slide.fontFamily && typeof slide.fontFamily === 'string') {
      const norm = normalizeFontName(slide.fontFamily).baseFamily;
      if (norm) fonts.add(norm);
    }
    if (slide.titleFontFamily && typeof slide.titleFontFamily === 'string') {
      const norm = normalizeFontName(slide.titleFontFamily).baseFamily;
      if (norm) fonts.add(norm);
    }
    if (slide.themeOverride?.fontFamily && typeof slide.themeOverride.fontFamily === 'string') {
      const norm = normalizeFontName(slide.themeOverride.fontFamily).baseFamily;
      if (norm) fonts.add(norm);
    }

    // 2. Elements array (PPTX / Canva parsed items)
    if (Array.isArray(slide.elements)) {
      for (const el of slide.elements) {
        if (el?.fontFamily && typeof el.fontFamily === 'string') {
          const norm = normalizeFontName(el.fontFamily).baseFamily;
          if (norm) fonts.add(norm);
        }
      }
    }

    // 3. Objects array (Slide editor elements)
    if (Array.isArray(slide.objects)) {
      for (const obj of slide.objects) {
        if (obj?.style?.fontFamily && typeof obj.style.fontFamily === 'string') {
          const norm = normalizeFontName(obj.style.fontFamily).baseFamily;
          if (norm) fonts.add(norm);
        } else if (obj?.fontFamily && typeof obj.fontFamily === 'string') {
          const norm = normalizeFontName(obj.fontFamily).baseFamily;
          if (norm) fonts.add(norm);
        }
      }
    }
  }

  return Array.from(fonts);
}

/**
 * Scans the entire church library (saved presentations, active themes, songs, schedules, system options) to discover all fonts in use
 */
export function scanLibraryAllFonts(
  presentations?: any[],
  themes?: any[],
  songs?: any[],
  extraSources?: {
    activeSchedule?: any;
    schedules?: any[];
    systemOptions?: any;
    assets?: any[];
  }
): {
  allUniqueFonts: string[];
  presentationFonts: string[];
  themeFonts: string[];
  songFonts: string[];
  systemFonts: string[];
} {
  const presentationFontsSet = new Set<string>();
  const themeFontsSet = new Set<string>();
  const songFontsSet = new Set<string>();
  const systemFontsSet = new Set<string>();

  const addFont = (set: Set<string>, rawFont?: string) => {
    if (!rawFont || typeof rawFont !== 'string') return;
    const norm = normalizeFontName(rawFont).baseFamily;
    if (norm) set.add(norm);
  };

  // 1. Scan Presentations from DB and props
  if (Array.isArray(presentations)) {
    for (const p of presentations) {
      const slides = p?.data?.slides || p?.slides || [];
      const pFonts = scanFontsFromPresentationSlides(slides);
      pFonts.forEach(f => presentationFontsSet.add(f));
    }
  }

  // 1b. Scan Assets list for presentations/documents
  if (Array.isArray(extraSources?.assets)) {
    for (const asset of extraSources.assets) {
      if (asset?.data?.slides) {
        const pFonts = scanFontsFromPresentationSlides(asset.data.slides);
        pFonts.forEach(f => presentationFontsSet.add(f));
      }
    }
  }

  // 2. Scan Themes
  if (Array.isArray(themes)) {
    for (const t of themes) {
      addFont(themeFontsSet, t?.fontFamily);
      addFont(themeFontsSet, t?.headerFont);
      addFont(themeFontsSet, t?.bodyFont);
      addFont(themeFontsSet, t?.scriptureFont);
      addFont(themeFontsSet, t?.referenceFont);
      addFont(themeFontsSet, t?.font?.family);
      addFont(themeFontsSet, t?.styles?.fontFamily);
    }
  }

  // 3. Scan Songs
  if (Array.isArray(songs)) {
    for (const s of songs) {
      addFont(songFontsSet, s?.customFontFamily);
      addFont(songFontsSet, s?.theme?.fontFamily);
      addFont(songFontsSet, s?.themeOverride?.fontFamily);
    }
  }

  // 4. Scan Schedules (Active schedule and saved schedules)
  const scanScheduleItems = (items: any[]) => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (item?.themeOverride?.fontFamily) {
        addFont(themeFontsSet, item.themeOverride.fontFamily);
      }
      if (item?.data?.slides) {
        const pFonts = scanFontsFromPresentationSlides(item.data.slides);
        pFonts.forEach(f => presentationFontsSet.add(f));
      }
      if (item?.slides) {
        const pFonts = scanFontsFromPresentationSlides(item.slides);
        pFonts.forEach(f => presentationFontsSet.add(f));
      }
    }
  };

  if (extraSources?.activeSchedule?.items) {
    scanScheduleItems(extraSources.activeSchedule.items);
  }
  if (Array.isArray(extraSources?.schedules)) {
    for (const sch of extraSources.schedules) {
      scanScheduleItems(sch?.items || []);
    }
  }

  // 5. Scan System Options
  const sys = extraSources?.systemOptions;
  if (sys) {
    addFont(systemFontsSet, sys?.mainOutput?.general?.defaultFont?.family);
    addFont(systemFontsSet, sys?.mainOutput?.song?.songFont?.family);
    addFont(systemFontsSet, sys?.mainOutput?.song?.labelFont?.family);
    addFont(systemFontsSet, sys?.mainOutput?.song?.copyrightFont?.family);
    addFont(systemFontsSet, sys?.mainOutput?.scripture?.scriptureFont?.family);
    addFont(systemFontsSet, sys?.mainOutput?.scripture?.verseFont?.family);
    addFont(systemFontsSet, sys?.mainOutput?.scripture?.referenceFont?.family);
    addFont(systemFontsSet, sys?.mainOutput?.presentations?.titleFont?.family);
    addFont(systemFontsSet, sys?.mainOutput?.presentations?.subTitleFont?.family);
    addFont(systemFontsSet, sys?.mainOutput?.presentations?.contentFont?.family);
    addFont(systemFontsSet, sys?.mainOutput?.alerts?.nursery?.font?.family);
    addFont(systemFontsSet, sys?.mainOutput?.alerts?.message?.font?.family);
    addFont(systemFontsSet, sys?.foldback?.primaryFont?.family);
    addFont(systemFontsSet, sys?.foldback?.clockFont?.family);
    addFont(systemFontsSet, sys?.foldback?.nurseryFont?.family);
    addFont(systemFontsSet, sys?.foldback?.alertFont?.family);
    addFont(systemFontsSet, sys?.foldback?.nextItemFont?.family);
    addFont(systemFontsSet, sys?.alternateOutput?.font?.family);
  }

  const allSet = new Set<string>([
    ...Array.from(presentationFontsSet),
    ...Array.from(themeFontsSet),
    ...Array.from(songFontsSet),
    ...Array.from(systemFontsSet),
  ]);

  return {
    allUniqueFonts: Array.from(allSet).filter(Boolean),
    presentationFonts: Array.from(presentationFontsSet).filter(Boolean),
    themeFonts: Array.from(themeFontsSet).filter(Boolean),
    songFonts: Array.from(songFontsSet).filter(Boolean),
    systemFonts: Array.from(systemFontsSet).filter(Boolean),
  };
}

/**
 * Completely resets and purges the web font cache and removes all dynamically injected <link> stylesheet tags
 * Allows developers and users to re-test font downloads and fallback behaviors from a pristine state
 */
export function purgeFontCacheAndDomLinks(): { removedLinksCount: number; clearedCacheCount: number } {
  const clearedCacheCount = loadedFontsCache.size + prewarmedFontsCache.size;
  loadedFontsCache.clear();
  prewarmedFontsCache.clear();
  inFlightPromises.clear();

  registeredAliases.clear();
  if (aliasStyleSheet) {
    aliasStyleSheet.textContent = '';
  }

  let removedLinksCount = 0;
  if (typeof document !== 'undefined') {
    const injectedLinks = document.querySelectorAll('link[id^="sw-font-"]');
    injectedLinks.forEach((el) => {
      el.parentNode?.removeChild(el);
      removedLinksCount += 1;
    });
  }

  addDebugLog('cache-purge', 'ALL', `Purged font cache (${clearedCacheCount} entries) and removed ${removedLinksCount} DOM <link> tags`);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('simpleworship:fonts-updated'));
    window.dispatchEvent(new CustomEvent('simpleworship:font-cache-updated'));
    window.dispatchEvent(new Event('resize'));
  }

  return { removedLinksCount, clearedCacheCount };
}

// High-performance reusable canvas and memoization cache for font probing
let reusableProbeCtx: CanvasRenderingContext2D | null = null;
const probedPhysicalCache = new Map<string, boolean>();

if (typeof window !== 'undefined') {
  window.addEventListener('simpleworship:fonts-updated', () => {
    probedPhysicalCache.clear();
  });
}

function getProbeContext(): CanvasRenderingContext2D | null {
  if (reusableProbeCtx) return reusableProbeCtx;
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 100;
    reusableProbeCtx = canvas.getContext('2d', { willReadFrequently: true });
    return reusableProbeCtx;
  } catch {
    return null;
  }
}

/**
 * Checks the true physical availability of a font on the local OS/browser (ignoring simulation flags)
 */
export function probePhysicalLocalFont(testFamily: string): boolean {
  if (typeof document === 'undefined') return false;
  if (!testFamily) return false;

  const info = normalizeFontName(testFamily);
  const cleanFamily = info.baseFamily || testFamily.replace(/^["']+|["']+$/g, '').trim();
  const lower = cleanFamily.toLowerCase();

  // 1. Check system universal list (pre-installed by default on Windows/Mac)
  if (SYSTEM_UNIVERSAL_FONTS.has(lower)) {
    return true;
  }

  // 2. Check memoized session cache
  if (probedPhysicalCache.has(lower)) {
    return probedPhysicalCache.get(lower)!;
  }

  // 3. Check in-memory registered font store
  if (inMemoryInstalledFonts.has(lower)) {
    probedPhysicalCache.set(lower, true);
    return true;
  }

  // 4. High-precision canvas baseline probe against monospace, sans-serif, and serif
  try {
    const ctx = getProbeContext();
    if (!ctx) return false;

    const testStr = 'mmmmmmmmmmlliÑñ123WM!@#';
    const testSize = '72px';

    // Baseline 1: monospace
    ctx.font = `${testSize} monospace`;
    const monoWidth = ctx.measureText(testStr).width;
    ctx.font = `${testSize} "${cleanFamily}", monospace`;
    const probedMonoWidth = ctx.measureText(testStr).width;
    const diffMono = Math.abs(monoWidth - probedMonoWidth);

    // Baseline 2: sans-serif
    ctx.font = `${testSize} sans-serif`;
    const sansWidth = ctx.measureText(testStr).width;
    ctx.font = `${testSize} "${cleanFamily}", sans-serif`;
    const probedSansWidth = ctx.measureText(testStr).width;
    const diffSans = Math.abs(sansWidth - probedSansWidth);

    // Baseline 3: serif
    ctx.font = `${testSize} serif`;
    const serifWidth = ctx.measureText(testStr).width;
    ctx.font = `${testSize} "${cleanFamily}", serif`;
    const probedSerifWidth = ctx.measureText(testStr).width;
    const diffSerif = Math.abs(serifWidth - probedSerifWidth);

    // If cleanFamily is NOT installed on Windows:
    // It falls back to monospace, sans-serif, and serif respectively, so all 3 diffs are ~0!
    // If it is installed on Windows, it will differ from at least 2 generic fallbacks.
    const diffCount = (diffMono > 0.8 ? 1 : 0) + (diffSans > 0.8 ? 1 : 0) + (diffSerif > 0.8 ? 1 : 0);
    let isInstalled = diffCount >= 2;

    // Edge case tie-breaker using secondary glyph set
    if (diffCount === 1) {
      const testStr2 = 'abcdefghijklmnopqrstuvwxyz0123456789';
      ctx.font = `${testSize} monospace`;
      const m2 = ctx.measureText(testStr2).width;
      ctx.font = `${testSize} "${cleanFamily}", monospace`;
      const pM2 = ctx.measureText(testStr2).width;

      ctx.font = `${testSize} serif`;
      const s2 = ctx.measureText(testStr2).width;
      ctx.font = `${testSize} "${cleanFamily}", serif`;
      const pS2 = ctx.measureText(testStr2).width;

      isInstalled = (Math.abs(m2 - pM2) > 0.8 || Math.abs(s2 - pS2) > 0.8);
    }

    probedPhysicalCache.set(lower, isInstalled);
    return isInstalled;
  } catch {
    return false;
  }
}

/**
 * Checks if a font is accessible locally in the browser/OS without downloading.
 * Respects Developer Simulation Mode rules when active.
 */
export function isFontInstalledLocally(fontFamily: string): boolean {
  if (typeof document === 'undefined') return false;

  const info = normalizeFontName(fontFamily);
  const testFamily = info.baseFamily;
  if (!testFamily) return false;

  const lowerFamily = testFamily.toLowerCase();

  // Developer Simulation Mode Interception
  if (fontSimulationConfig.enabled) {
    if (fontSimulationConfig.simulateAllNonUniversalMissing && !SYSTEM_UNIVERSAL_FONTS.has(lowerFamily)) {
      addDebugLog('probe-simulated-missing', testFamily, `[DEV SIMULATION] "${testFamily}" forced to MISSING (All Non-Universal mode)`);
      return false;
    }

    if (fontSimulationConfig.simulatedMissingFonts.some(f => f.toLowerCase() === lowerFamily)) {
      addDebugLog('probe-simulated-missing', testFamily, `[DEV SIMULATION] "${testFamily}" forced to MISSING (Selective rule)`);
      return false;
    }
  }

  const rawClean = fontFamily.replace(/^["']+|["']+$/g, '').trim();
  const rawLower = rawClean.toLowerCase();

  // Universal check on both raw name and normalized family
  if (SYSTEM_UNIVERSAL_FONTS.has(lowerFamily) || SYSTEM_UNIVERSAL_FONTS.has(rawLower)) {
    return true;
  }

  // Check if previously hydrated from IndexedDB or installed into document.fonts
  if (inMemoryInstalledFonts.has(lowerFamily) || inMemoryInstalledFonts.has(rawLower)) {
    addDebugLog('probe-local', testFamily, `Font "${testFamily}" detected from local IndexedDB storage`);
    return true;
  }

  const isRealLocal = probePhysicalLocalFont(testFamily) || (rawClean !== testFamily && probePhysicalLocalFont(rawClean));
  if (isRealLocal) {
    addDebugLog('probe-local', testFamily, `Font "${testFamily}" detected locally on PC`);
  }
  return isRealLocal;
}

/**
 * Dynamically downloads and registers a web font from Google Fonts into the browser
 */
export async function downloadAndRegisterWebFont(fontFamily: string): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  const info = normalizeFontName(fontFamily);
  const baseFamily = info.baseFamily;
  if (!baseFamily) return false;

  if (loadedFontsCache.has(baseFamily)) {
    return true;
  }

  if (inFlightPromises.has(baseFamily)) {
    return inFlightPromises.get(baseFamily)!;
  }

  const promise = (async () => {
    try {
      // Check if already available locally
      if (isFontInstalledLocally(baseFamily)) {
        loadedFontsCache.add(baseFamily);
        return true;
      }

      // Developer Simulation: Offline fallback mode forces download failure
      if (fontSimulationConfig.enabled && fontSimulationConfig.simulateOfflineFallback) {
        addDebugLog('download-failed', baseFamily, `[DEV SIMULATION] Download blocked (Offline Mode Active) -> using archetype fallback: ${info.archetype}`);
        return false;
      }

      // Developer Simulation: Simulated network latency
      if (fontSimulationConfig.enabled && fontSimulationConfig.simulatedDownloadDelayMs > 0) {
        await new Promise(r => setTimeout(r, fontSimulationConfig.simulatedDownloadDelayMs));
      }

      addDebugLog('download-start', baseFamily, `Initiating background download for missing font "${baseFamily}" from Google Fonts...`);

      // Check if this font element was already injected in DOM
      const elementId = `sw-font-${baseFamily.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
      if (document.getElementById(elementId)) {
        loadedFontsCache.add(baseFamily);
        addDebugLog('download-success', baseFamily, `Font "${baseFamily}" link element was already in DOM and registered.`);
        return true;
      }

      // Construct Google Fonts CSS2 URL
      const formattedFamily = encodeURIComponent(baseFamily).replace(/%20/g, '+');
      const isSingleWeightOnly = info.suggestedWeight === '400' || 
        CANVA_FONT_ARCHETYPES[baseFamily.toLowerCase()]?.defaultWeight === '400' ||
        SINGLE_WEIGHT_GOOGLE_FONTS.has(baseFamily.toLowerCase());
      
      const primaryUrl = isSingleWeightOnly
        ? `https://fonts.googleapis.com/css2?family=${formattedFamily}&display=swap`
        : `https://fonts.googleapis.com/css2?family=${formattedFamily}:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700&display=swap`;

      const link = document.createElement('link');
      link.id = elementId;
      link.rel = 'stylesheet';
      link.href = primaryUrl;

      // Wrap in promise with timeout so failure never blocks presentation rendering
      const fontLoadPromise = new Promise<boolean>((resolve) => {
        link.onload = async () => {
          try {
            if (document.fonts) {
              await document.fonts.load(`16px "${baseFamily}"`).catch(() => {});
              await document.fonts.ready.catch(() => {});
            }
            loadedFontsCache.add(baseFamily);
            addDebugLog('download-success', baseFamily, `✓ Successfully downloaded & registered "${baseFamily}" via Google Fonts API`, { url: primaryUrl });
            resolve(true);
          } catch {
            loadedFontsCache.add(baseFamily);
            addDebugLog('download-success', baseFamily, `✓ Font link active for "${baseFamily}"`);
            resolve(true);
          }
        };

        link.onerror = () => {
          // If multi-weight failed, attempt simpler query (e.g. for display fonts that only have weight 400)
          if (!isSingleWeightOnly) {
            const fallbackUrl = `https://fonts.googleapis.com/css2?family=${formattedFamily}&display=swap`;
            const fallbackLink = document.createElement('link');
            fallbackLink.id = `${elementId}-fallback`;
            fallbackLink.rel = 'stylesheet';
            fallbackLink.href = fallbackUrl;
            fallbackLink.onload = async () => {
              if (document.fonts) {
                await document.fonts.load(`16px "${baseFamily}"`).catch(() => {});
              }
              loadedFontsCache.add(baseFamily);
              addDebugLog('download-success', baseFamily, `✓ Successfully loaded single-weight variant for "${baseFamily}"`, { url: fallbackUrl });
              resolve(true);
            };
            fallbackLink.onerror = () => {
              addDebugLog('download-failed', baseFamily, `Failed to load web font "${baseFamily}" from Google Fonts. Fallback stack applied.`);
              resolve(false);
            };
            document.head.appendChild(fallbackLink);
          } else {
            addDebugLog('download-failed', baseFamily, `Failed to load web font "${baseFamily}". Fallback stack applied.`);
            resolve(false);
          }
        };
      });

      document.head.appendChild(link);

      // 3.5s safety timeout
      const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3500));

      const success = await Promise.race([fontLoadPromise, timeoutPromise]);
      if (success) {
        loadedFontsCache.add(baseFamily);
        // Persist binary into IndexedDB in background so font is 100% available offline forever
        fetchAndInstallGoogleFont(baseFamily).catch(() => {});
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('resize'));
        }
      }
      return success;
    } catch (err) {
      addDebugLog('download-failed', baseFamily, `Error downloading web font "${baseFamily}"`, { error: String(err) });
      console.warn('[pptxFontManager] Failed to load web font:', baseFamily, err);
      return false;
    } finally {
      inFlightPromises.delete(baseFamily);
    }
  })();

  inFlightPromises.set(baseFamily, promise);
  return promise;
}

/**
 * Developer Sandbox Tool: Runs an end-to-end diagnostic and download test for any font name
 */
export async function testFontPipeline(fontFamily: string): Promise<FontTestResult> {
  const startTime = performance.now();
  const normalized = normalizeFontName(fontFamily);
  const baseFamily = normalized.baseFamily;
  const isUniversal = SYSTEM_UNIVERSAL_FONTS.has(baseFamily.toLowerCase());
  const isRealLocal = probePhysicalLocalFont(baseFamily);
  const isEffectiveLocal = isFontInstalledLocally(baseFamily);
  const isSimulationActive = isRealLocal && !isEffectiveLocal;

  let downloadAttempted = false;
  let downloadSuccess = false;
  let apiUrl: string | undefined;

  if (!isEffectiveLocal) {
    downloadAttempted = true;
    const formattedFamily = encodeURIComponent(baseFamily).replace(/%20/g, '+');
    apiUrl = `https://fonts.googleapis.com/css2?family=${formattedFamily}&display=swap`;
    downloadSuccess = await downloadAndRegisterWebFont(baseFamily);
  } else {
    downloadSuccess = true;
  }

  const durationMs = Math.round(performance.now() - startTime);

  return {
    fontName: fontFamily,
    normalized,
    isUniversalSystemFont: isUniversal,
    isLocallyInstalledReal: isRealLocal,
    isLocallyInstalledEffective: isEffectiveLocal,
    simulationApplied: isSimulationActive,
    downloadAttempted,
    downloadSuccess,
    resolvedFontStack: normalized.fontStack,
    fallbackUsed: !downloadSuccess,
    durationMs,
    apiUrl,
  };
}

/**
 * Ensures all fonts used in a PPTX deck are detected, normalized, and downloaded/ready
 */
export async function ensurePptxFontsLoaded(fonts: string[]): Promise<{ loaded: string[]; fallbacks: string[] }> {
  if (!Array.isArray(fonts) || fonts.length === 0) {
    return { loaded: [], fallbacks: [] };
  }

  // Instantly inject dynamic metric-compatible @font-face aliases for all detected fonts
  registerFontAliasesInDom(fonts);

  const loaded: string[] = [];
  const fallbacks: string[] = [];

  const promises = fonts.map(async (rawFont) => {
    const info = normalizeFontName(rawFont);
    if (!info.baseFamily) return;

    if (SYSTEM_UNIVERSAL_FONTS.has(info.baseFamily.toLowerCase())) {
      loaded.push(info.baseFamily);
      return;
    }

    const success = await downloadAndRegisterWebFont(info.baseFamily);
    if (success) {
      loaded.push(info.baseFamily);
    } else {
      fallbacks.push(info.baseFamily);
    }
  });

  await Promise.all(promises);

  if (typeof window !== 'undefined' && loaded.length > 0) {
    window.dispatchEvent(new CustomEvent('simpleworship:fonts-updated'));
    window.dispatchEvent(new CustomEvent('simpleworship:pptx-fonts-loaded', { detail: { loaded, fallbacks } }));
    window.dispatchEvent(new Event('resize'));
  }

  return { loaded, fallbacks };
}

// Shared offscreen canvas context for accurate sub-pixel text measurement
let sharedMeasureCanvas: HTMLCanvasElement | null = null;
let sharedMeasureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!sharedMeasureCtx) {
    try {
      sharedMeasureCanvas = document.createElement('canvas');
      sharedMeasureCanvas.width = 10;
      sharedMeasureCanvas.height = 10;
      sharedMeasureCtx = sharedMeasureCanvas.getContext('2d');
    } catch {
      sharedMeasureCtx = null;
    }
  }
  return sharedMeasureCtx;
}

/**
 * Responsive Auto-Fit Text Engine
 * Calculates an optimal auto-adjust scale factor (0.45 - 1.0) so text never overflows,
 * breaks layout boundaries, or shifts location when rendered on different PC resolutions or font sizes.
 */
export function calculateAutoFitTextScale(params: {
  text?: string;
  boxWidth: number;   // In canvas coordinate units (e.g. out of 1920)
  boxHeight: number;  // In canvas coordinate units (e.g. out of 1080)
  fontSize: number;   // In px for the canvas
  fontFamily?: string;
  fontWeight?: string | number;
  lineHeightRatio?: number;
  padding?: number;
}): number {
  const { text, boxWidth, boxHeight, fontSize, fontFamily, fontWeight = 'normal', lineHeightRatio = 1.2, padding = 8 } = params;

  if (!text || boxWidth <= 0 || boxHeight <= 0 || fontSize <= 0) {
    return 1;
  }

  const cleanText = text.trim();
  if (cleanText.length === 0) return 1;

  // Available inner dimensions
  const innerW = Math.max(10, boxWidth - padding * 2);
  const innerH = Math.max(10, boxHeight - padding * 2);

  const ctx = getMeasureContext();
  let maxWordWidth = 0;
  let estimatedTotalHeight = 0;
  const singleLineH = fontSize * lineHeightRatio;

  const info = normalizeFontName(fontFamily || '');
  let metricCorrectionFactor = 1.0;
  if (typeof document !== 'undefined' && document.fonts && info.baseFamily) {
    try {
      const isLoaded = document.fonts.check(`${fontWeight} ${Math.round(fontSize)}px "${info.baseFamily}"`);
      if (!isLoaded) {
        // Fallback or offline: adjust measured width according to archetype geometry
        if (info.archetype === 'condensed') {
          metricCorrectionFactor = 0.72; // condensed font is narrower than standard system sans
        } else if (info.archetype === 'geometric-sans') {
          metricCorrectionFactor = 1.10; // wide geometric font is wider than standard system sans
        } else if (info.archetype === 'script') {
          metricCorrectionFactor = 0.92;
        }
      }
    } catch {}
  }

  if (ctx) {
    ctx.font = `${fontWeight} ${Math.round(fontSize)}px ${fontFamily || 'sans-serif'}`;
    const paragraphs = cleanText.split('\n');

    let totalLines = 0;
    for (const para of paragraphs) {
      if (para.length === 0) {
        totalLines += 1;
        continue;
      }
      
      const words = para.split(/\s+/).filter(Boolean);
      let currentLineWidth = 0;
      const spaceW = ctx.measureText(' ').width * metricCorrectionFactor;

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordW = ctx.measureText(word).width * metricCorrectionFactor;
        if (wordW > maxWordWidth) {
          maxWordWidth = wordW;
        }

        if (currentLineWidth === 0) {
          currentLineWidth = wordW;
          totalLines += 1;
        } else if (currentLineWidth + spaceW + wordW <= innerW) {
          currentLineWidth += spaceW + wordW;
        } else {
          // Wrapped to next line
          currentLineWidth = wordW;
          totalLines += 1;
        }
      }
    }
    estimatedTotalHeight = totalLines * singleLineH;
  } else {
    // Mathematical estimation when canvas 2D is unavailable
    const info = normalizeFontName(fontFamily || '');
    let charWidthFactor = 0.52;
    if (info.archetype === 'condensed') charWidthFactor = 0.38;
    else if (info.archetype === 'geometric-sans') charWidthFactor = 0.56;
    else if (info.archetype === 'editorial-serif') charWidthFactor = 0.54;

    const charPxWidth = fontSize * charWidthFactor;
    const paragraphs = cleanText.split('\n');
    let totalLines = 0;

    for (const para of paragraphs) {
      if (para.length === 0) {
        totalLines += 1;
        continue;
      }
      const words = para.split(/\s+/).filter(Boolean);
      for (const w of words) {
        const wWidth = w.length * charPxWidth;
        if (wWidth > maxWordWidth) maxWordWidth = wWidth;
      }
      const paraWidth = para.length * charPxWidth;
      totalLines += Math.max(1, Math.ceil(paraWidth / innerW));
    }
    estimatedTotalHeight = totalLines * singleLineH;
  }

  // Check if text already fits comfortably
  if (estimatedTotalHeight <= innerH && maxWordWidth <= innerW) {
    return 1;
  }

  // 1. Scale required to fit height
  // For single-line titles/headings where the text fits horizontally within the box width
  // but Canva exported an arbitrarily shallow box height (e.g. 40px box for 72px font),
  // do NOT crush the font height. In PowerPoint/Canva, the box expands vertically.
  const isSingleLine = !cleanText.includes('\n') && maxWordWidth <= innerW;
  const effectiveHeightScale = isSingleLine && innerH < singleLineH * 1.35
    ? 1.0
    : innerH / Math.max(1, estimatedTotalHeight);

  // 2. Scale required so long words don't overflow the box horizontally
  const wordScale = maxWordWidth > innerW ? (innerW / maxWordWidth) * 0.96 : 1;

  let optimalScale = Math.min(effectiveHeightScale, wordScale);

  // Floor at 0.45 (maximum 55% reduction to maintain legibility) and cap at 1.0
  optimalScale = Math.max(0.45, Math.min(1, optimalScale));

  // Round to 3 decimal places for stability
  return Math.round(optimalScale * 1000) / 1000;
}
