import { describe, it, expect } from 'vitest';
import { 
  normalizeFontName, 
  cleanPptxFontName, 
  splitCamelCaseFont,
  getCompatibleFontStack
} from './pptxFontManager';

describe('pptxFontManager typography normalization', () => {
  it('correctly extracts single family name from full CSS font stacks', () => {
    const raw = '"Grandview", "Inter", "Roboto", "Open Sans", "Lato", "Segoe UI", "Calibri", "Aptos", Arial, sans serif';
    const norm = normalizeFontName(raw);
    expect(norm.baseFamily).toBe('Grandview');
    expect(norm.archetype).toBe('modern-sans');
  });

  it('correctly normalizes Windows & Microsoft fonts to authentic archetypes', () => {
    const grandview = normalizeFontName('Grandview');
    expect(grandview.baseFamily).toBe('Grandview');

    const garet = normalizeFontName('Garet');
    expect(garet.baseFamily).toBe('Garet');

    const gillSans = normalizeFontName('Gill Sans MT');
    expect(gillSans.baseFamily).toBe('Gill Sans MT');
  });

  it('cleans OpenXML tags, quotes, and themes properly', () => {
    expect(cleanPptxFontName('"Montserrat" (Headings)', 'Montserrat', 'Open Sans')).toBe('Montserrat');
    expect(cleanPptxFontName('+mj-lt', 'Inter', 'Roboto')).toBe('Inter');
    expect(cleanPptxFontName('+mn-lt', 'Inter', 'Roboto')).toBe('Roboto');
  });

  it('splits CamelCase Canva font names properly', () => {
    expect(splitCamelCaseFont('BebasNeue')).toBe('Bebas Neue');
    expect(splitCamelCaseFont('LeagueSpartan')).toBe('League Spartan');
  });
});
