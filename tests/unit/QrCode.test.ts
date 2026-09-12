import { describe, it, expect } from 'vitest';
import { QRCode, generateQrMatrix, generateQrSvg, toDataURL } from '../../src/utils/qrCode';

describe('QRCode Generator (Zero-dependency)', () => {
  it('generates a valid QR matrix for remote pairing URL', () => {
    const url = 'http://localhost:3000/?remote=true&pin=8492';
    const matrix = generateQrMatrix(url);
    expect(matrix).toBeDefined();
    expect(matrix.length).toBeGreaterThanOrEqual(21);
    expect(matrix[0].length).toBe(matrix.length);
    // Finder pattern top-left must have dark corner
    expect(matrix[0][0]).toBe(true);
    expect(matrix[0][6]).toBe(true);
    expect(matrix[6][0]).toBe(true);
  });

  it('generates a valid SVG representation', () => {
    const url = 'https://myserver.org/?remote=true&pin=1234';
    const svg = generateQrSvg(url, { margin: 2, color: { dark: '#000', light: '#fff' } });
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox');
    expect(svg).toContain('<rect');
  });

  it('generates a valid Data URL asynchronously', async () => {
    const url = 'http://192.168.1.100:3000/?remote=true&pin=9999';
    const dataUrl = await QRCode.toDataURL(url);
    expect(dataUrl).toBeDefined();
    expect(typeof dataUrl).toBe('string');
    expect(dataUrl.startsWith('data:')).toBe(true);
  });

  it('handles long pairing URLs up to 150+ characters', async () => {
    const longUrl = 'https://ais-dev-g64u646wtwreprzotbnuc3-343881880269.asia-southeast1.run.app/?remote=true&pin=8492&session=longtokenstringhere1234567890';
    const dataUrl = await toDataURL(longUrl);
    expect(dataUrl).toBeDefined();
    expect(dataUrl.length).toBeGreaterThan(100);
  });
});
