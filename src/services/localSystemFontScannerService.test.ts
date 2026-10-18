import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalSystemFontScannerService, localSystemFontsRegistry, localSystemFontsMap } from './localSystemFontScannerService';
import { SYSTEM_UNIVERSAL_FONTS } from '../utils/pptxFontManager';

describe('LocalSystemFontScannerService', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
  });

  it('initializes and populates system universal fonts in registry', async () => {
    const result = await LocalSystemFontScannerService.init();
    expect(result).toBeDefined();
    expect(result.count).toBeGreaterThan(0);

    // Universal fonts like Arial, Calibri, Segoe UI should be registered immediately
    expect(LocalSystemFontScannerService.isLocalFontAvailable('Arial')).toBe(true);
    expect(LocalSystemFontScannerService.isLocalFontAvailable('Calibri')).toBe(true);
    expect(LocalSystemFontScannerService.isLocalFontAvailable('Segoe UI')).toBe(true);
    expect(LocalSystemFontScannerService.isLocalFontAvailable('Aptos')).toBe(true);
  });

  it('correctly identifies available local fonts and handles case/whitespace normalization', () => {
    expect(LocalSystemFontScannerService.isLocalFontAvailable('  "Arial"  ')).toBe(true);
    expect(LocalSystemFontScannerService.isLocalFontAvailable('segoe ui')).toBe(true);
    expect(LocalSystemFontScannerService.isLocalFontAvailable('times new roman')).toBe(true);
    expect(LocalSystemFontScannerService.isLocalFontAvailable('Georgia')).toBe(true);
    
    // Non-existent synthetic font should return false
    expect(LocalSystemFontScannerService.isLocalFontAvailable('NonExistentCrazyFont_123456789')).toBe(false);
  });

  it('manually registers a local font into the registry', async () => {
    const testFamily = 'ChurchWorshipModernDisplay';
    const success = await LocalSystemFontScannerService.registerLocalFont({
      family: testFamily,
      category: 'worship',
      detectionMethod: 'canvas_probe'
    });

    expect(success).toBe(true);
    expect(LocalSystemFontScannerService.isLocalFontAvailable(testFamily)).toBe(true);
    expect(LocalSystemFontScannerService.isLocalFontAvailable(testFamily.toLowerCase())).toBe(true);
  });

  it('scans and registers system fonts without throwing errors', async () => {
    const scanResult = await LocalSystemFontScannerService.scanAndRegisterLocalSystemFonts();
    expect(scanResult).toBeDefined();
    expect(scanResult.allLocalFonts.length).toBeGreaterThan(0);
    expect(scanResult.scannedCount).toBeGreaterThanOrEqual(0);
  });

  it('retrieves all registered local system fonts', async () => {
    const records = await LocalSystemFontScannerService.getAllRegisteredLocalFonts();
    expect(Array.isArray(records)).toBe(true);
  });
});
