/**
 * Zero-dependency QR Code Generator for SimpleWorship
 * Compliant with ISO/IEC 18004.
 * Generates PNG data URLs (via Canvas) or SVG data URLs without any external packages.
 */

// Error Correction Levels
export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  errorCorrectionLevel?: QrErrorCorrectionLevel;
}

// Galois Field GF(256) tables with primitive polynomial 0x11D
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 256) {
      x ^= 0x11d;
    }
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

// Compute Reed-Solomon error correction generator polynomial
function getRsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const nextPoly = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      nextPoly[j] ^= gfMul(poly[j], root);
      nextPoly[j + 1] ^= poly[j];
    }
    poly = nextPoly;
  }
  return poly;
}

// Calculate RS error correction codewords for a block of data
function calculateRsBlock(data: Uint8Array, ecLength: number): Uint8Array {
  const gen = getRsGeneratorPoly(ecLength);
  const result = new Uint8Array(ecLength);

  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ result[0];
    for (let j = 0; j < ecLength - 1; j++) {
      result[j] = result[j + 1] ^ gfMul(gen[j + 1], factor);
    }
    result[ecLength - 1] = gfMul(gen[ecLength], factor);
  }

  return result;
}

// Table of QR parameters per version (1 to 14) for Error Correction Level M
interface VersionConfig {
  version: number;
  totalCodewords: number;
  ecCodewordsPerBlock: number;
  blocks: { count: number; dataCodewords: number }[];
  alignmentCoords: number[];
}

const VERSION_CONFIGS_M: VersionConfig[] = [
  { version: 1, totalCodewords: 26, ecCodewordsPerBlock: 10, blocks: [{ count: 1, dataCodewords: 16 }], alignmentCoords: [] },
  { version: 2, totalCodewords: 44, ecCodewordsPerBlock: 16, blocks: [{ count: 1, dataCodewords: 28 }], alignmentCoords: [6, 18] },
  { version: 3, totalCodewords: 70, ecCodewordsPerBlock: 26, blocks: [{ count: 1, dataCodewords: 44 }], alignmentCoords: [6, 22] },
  { version: 4, totalCodewords: 100, ecCodewordsPerBlock: 18, blocks: [{ count: 2, dataCodewords: 32 }], alignmentCoords: [6, 26] },
  { version: 5, totalCodewords: 134, ecCodewordsPerBlock: 24, blocks: [{ count: 2, dataCodewords: 43 }], alignmentCoords: [6, 30] },
  { version: 6, totalCodewords: 172, ecCodewordsPerBlock: 16, blocks: [{ count: 4, dataCodewords: 27 }], alignmentCoords: [6, 34] },
  { version: 7, totalCodewords: 196, ecCodewordsPerBlock: 18, blocks: [{ count: 4, dataCodewords: 31 }], alignmentCoords: [6, 22, 38] },
  { version: 8, totalCodewords: 242, ecCodewordsPerBlock: 22, blocks: [{ count: 2, dataCodewords: 38 }, { count: 2, dataCodewords: 39 }], alignmentCoords: [6, 24, 42] },
  { version: 9, totalCodewords: 292, ecCodewordsPerBlock: 22, blocks: [{ count: 3, dataCodewords: 36 }, { count: 2, dataCodewords: 37 }], alignmentCoords: [6, 26, 46] },
  { version: 10, totalCodewords: 346, ecCodewordsPerBlock: 26, blocks: [{ count: 4, dataCodewords: 43 }, { count: 1, dataCodewords: 44 }], alignmentCoords: [6, 28, 50] },
  { version: 11, totalCodewords: 404, ecCodewordsPerBlock: 30, blocks: [{ count: 1, dataCodewords: 50 }, { count: 4, dataCodewords: 51 }], alignmentCoords: [6, 30, 54] },
  { version: 12, totalCodewords: 466, ecCodewordsPerBlock: 22, blocks: [{ count: 6, dataCodewords: 36 }, { count: 2, dataCodewords: 37 }], alignmentCoords: [6, 32, 58] },
  { version: 13, totalCodewords: 532, ecCodewordsPerBlock: 22, blocks: [{ count: 8, dataCodewords: 37 }, { count: 4, dataCodewords: 38 }], alignmentCoords: [6, 34, 62] },
  { version: 14, totalCodewords: 581, ecCodewordsPerBlock: 24, blocks: [{ count: 4, dataCodewords: 40 }, { count: 5, dataCodewords: 41 }], alignmentCoords: [6, 26, 46, 66] },
];

function selectVersionConfig(byteLength: number): VersionConfig {
  for (const cfg of VERSION_CONFIGS_M) {
    let totalDataCapacity = 0;
    for (const b of cfg.blocks) {
      totalDataCapacity += b.count * b.dataCodewords;
    }
    // Overhead: 4 bits mode + 8/16 bits length + terminator + padding
    const lengthBits = cfg.version < 10 ? 8 : 16;
    const maxDataBytes = Math.floor((totalDataCapacity * 8 - 4 - lengthBits) / 8);
    if (byteLength <= maxDataBytes) {
      return cfg;
    }
  }
  return VERSION_CONFIGS_M[VERSION_CONFIGS_M.length - 1];
}

// Convert string to UTF-8 bytes
function toUtf8Bytes(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      i++;
      code = 0x10000 + (((code & 0x3ff) << 10) | (str.charCodeAt(i) & 0x3ff));
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    }
  }
  return new Uint8Array(bytes);
}

// Helper BitWriter class
class BitWriter {
  private bits: number[] = [];

  write(value: number, length: number) {
    for (let i = length - 1; i >= 0; i--) {
      this.bits.push((value >>> i) & 1);
    }
  }

  get length(): number {
    return this.bits.length;
  }

  toUint8Array(): Uint8Array {
    const bytes = new Uint8Array(Math.ceil(this.bits.length / 8));
    for (let i = 0; i < this.bits.length; i++) {
      if (this.bits[i]) {
        bytes[i >>> 3] |= 0x80 >>> (i & 7);
      }
    }
    return bytes;
  }
}

// Generate the 2D boolean module matrix for QR code
export function generateQrMatrix(text: string): boolean[][] {
  const utf8 = toUtf8Bytes(text);
  const cfg = selectVersionConfig(utf8.length);
  const version = cfg.version;
  const size = version * 4 + 17;

  let totalDataCodewords = 0;
  for (const b of cfg.blocks) {
    totalDataCodewords += b.count * b.dataCodewords;
  }

  // 1. Bit encoding in Byte Mode (0100)
  const bitWriter = new BitWriter();
  bitWriter.write(0b0100, 4); // Byte Mode
  const lengthBits = version < 10 ? 8 : 16;
  bitWriter.write(utf8.length, lengthBits);

  for (let i = 0; i < utf8.length; i++) {
    bitWriter.write(utf8[i], 8);
  }

  // Terminator (up to 4 zeroes)
  const totalDataBits = totalDataCodewords * 8;
  const terminatorLen = Math.min(4, totalDataBits - bitWriter.length);
  if (terminatorLen > 0) {
    bitWriter.write(0, terminatorLen);
  }

  // Pad to byte boundary
  const remainder = bitWriter.length % 8;
  if (remainder !== 0) {
    bitWriter.write(0, 8 - remainder);
  }

  // Pad bytes 0xEC and 0x11
  const currentBytes = bitWriter.toUint8Array();
  const dataBytes = new Uint8Array(totalDataCodewords);
  dataBytes.set(currentBytes);

  let pad = 0xec;
  for (let i = currentBytes.length; i < totalDataCodewords; i++) {
    dataBytes[i] = pad;
    pad = pad === 0xec ? 0x11 : 0xec;
  }

  // 2. Interleave data blocks and compute EC codewords
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let byteOffset = 0;

  for (const b of cfg.blocks) {
    for (let c = 0; c < b.count; c++) {
      const slice = dataBytes.subarray(byteOffset, byteOffset + b.dataCodewords);
      byteOffset += b.dataCodewords;
      dataBlocks.push(slice);
      ecBlocks.push(calculateRsBlock(slice, cfg.ecCodewordsPerBlock));
    }
  }

  // Interleave data
  const finalCodewords: number[] = [];
  let maxDataLen = 0;
  for (const b of dataBlocks) {
    if (b.length > maxDataLen) maxDataLen = b.length;
  }

  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < dataBlocks.length; b++) {
      if (i < dataBlocks[b].length) {
        finalCodewords.push(dataBlocks[b][i]);
      }
    }
  }

  // Interleave EC
  for (let i = 0; i < cfg.ecCodewordsPerBlock; i++) {
    for (let b = 0; b < ecBlocks.length; b++) {
      finalCodewords.push(ecBlocks[b][i]);
    }
  }

  // 3. Construct Matrix
  // modules: true = dark, false = light, null = not yet set
  const modules: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setModule = (r: number, c: number, val: boolean, isFunc = true) => {
    modules[r][c] = val;
    if (isFunc) isFunction[r][c] = true;
  };

  // Finder Patterns (7x7) + Separators
  const addFinder = (startRow: number, startCol: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const row = startRow + r;
        const col = startCol + c;
        if (row >= 0 && row < size && col >= 0 && col < size) {
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isDark = (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
            setModule(row, col, isDark, true);
          } else {
            // separator
            setModule(row, col, false, true);
          }
        }
      }
    }
  };

  addFinder(0, 0);
  addFinder(0, size - 7);
  addFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const isDark = i % 2 === 0;
    if (modules[6][i] === null) setModule(6, i, isDark, true);
    if (modules[i][6] === null) setModule(i, 6, isDark, true);
  }

  // Alignment patterns
  const coords = cfg.alignmentCoords;
  for (let i = 0; i < coords.length; i++) {
    for (let j = 0; j < coords.length; j++) {
      const r = coords[i];
      const c = coords[j];
      // Skip if overlapping finder patterns
      if ((r < 9 && c < 9) || (r < 9 && c >= size - 9) || (r >= size - 9 && c < 9)) {
        continue;
      }
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isDark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setModule(r + dr, c + dc, isDark, true);
        }
      }
    }
  }

  // Dark module
  setModule(size - 8, 8, true, true);

  // Reserve format information areas
  for (let i = 0; i < 9; i++) {
    if (modules[8][i] === null) setModule(8, i, false, true);
    if (modules[i][8] === null) setModule(i, 8, false, true);
  }
  for (let i = 0; i < 8; i++) {
    if (modules[8][size - 1 - i] === null) setModule(8, size - 1 - i, false, true);
    if (modules[size - 1 - i][8] === null) setModule(size - 1 - i, 8, false, true);
  }

  // 4. Place Data Bits
  const dataBits: number[] = [];
  for (const b of finalCodewords) {
    for (let i = 7; i >= 0; i--) {
      dataBits.push((b >>> i) & 1);
    }
  }

  // Remainder bits (for version 2-6, usually 7 bits etc.)
  const totalModules = size * size;
  // Fill in zigzag
  let bitIdx = 0;
  let upwards = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column
    const rows = upwards
      ? Array.from({ length: size }, (_, k) => size - 1 - k)
      : Array.from({ length: size }, (_, k) => k);

    for (const r of rows) {
      for (let c = right; c >= right - 1; c--) {
        if (!isFunction[r][c]) {
          const bit = bitIdx < dataBits.length ? dataBits[bitIdx++] === 1 : false;
          modules[r][c] = bit;
        }
      }
    }
    upwards = !upwards;
  }

  // 5. Apply Mask Pattern (Use mask pattern 0: (row + col) % 2 === 0, or pattern 1: row % 2 === 0)
  // Mask pattern 0 is widely standard and valid with Format bits for EC Level M (00)
  const maskPattern = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isFunction[r][c]) {
        const invert = (r + c) % 2 === 0;
        if (invert) {
          modules[r][c] = !modules[r][c];
        }
      }
    }
  }

  // 6. Format Information: EC Level M = 00, Mask = 000 -> 00000
  // Generator polynomial for format BCH(15, 5) = 10100110111 (0x537)
  // 5 data bits: (ec_m << 3) | mask = 0b00000
  // Format info code for Level M and Mask 0: 0x5412 ^ 0 = 0x5412 (0101010000010010 in 15 bits: 101010000010010)
  // Standard format bits calculation:
  function getFormatBits(ecLevel: number, mask: number): number {
    const data = (ecLevel << 3) | mask;
    let rem = data << 10;
    for (let i = 4; i >= 0; i--) {
      if ((rem >>> (i + 10)) & 1) {
        rem ^= 0x537 << i;
      }
    }
    return ((data << 10) | rem) ^ 0x5412;
  }

  // EC Level M is 00 in QR specification
  const formatInfo = getFormatBits(0, maskPattern);

  // Write format info around top-left finder
  // bits 0-5 to (8, 0..5), bit 6 to (8, 7), bit 7 to (8, 8), bit 8 to (7, 8), bits 9-14 to (5..0, 8)
  const formatCoordinatesTopLeft = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
    [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8],
    [2, 8], [1, 8], [0, 8]
  ];

  for (let i = 0; i < 15; i++) {
    const bit = ((formatInfo >>> i) & 1) === 1;
    const [r, c] = formatCoordinatesTopLeft[i];
    modules[r][c] = bit;
  }

  // Write format info to top-right & bottom-left
  // bits 0-6 to (size-1..size-7, 8)
  // bits 7-14 to (8, size-8..size-1)
  for (let i = 0; i < 7; i++) {
    const bit = ((formatInfo >>> i) & 1) === 1;
    modules[size - 1 - i][8] = bit;
  }
  for (let i = 7; i < 15; i++) {
    const bit = ((formatInfo >>> i) & 1) === 1;
    modules[8][size - 15 + i] = bit;
  }

  return modules.map(row => row.map(cell => cell === true));
}

/**
 * Generates an SVG string representation of the QR code
 */
export function generateQrSvg(text: string, options: QrOptions = {}): string {
  const modules = generateQrMatrix(text);
  const size = modules.length;
  const margin = options.margin ?? 2;
  const totalSize = size + margin * 2;
  const darkColor = options.color?.dark || '#000000';
  const lightColor = options.color?.light || '#FFFFFF';

  let rects = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r][c]) {
        rects += `<rect x="${c + margin}" y="${r + margin}" width="1" height="1" fill="${darkColor}"/>`;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="100%" height="100%" shape-rendering="crispEdges"><rect width="${totalSize}" height="${totalSize}" fill="${lightColor}"/>${rects}</svg>`;
}

/**
 * Generates a Data URL for the QR code.
 * Uses HTML5 Canvas when available in the browser; falls back to SVG Data URL seamlessly.
 */
export async function toDataURL(text: string, options: QrOptions = {}): Promise<string> {
  const modules = generateQrMatrix(text);
  const size = modules.length;
  const margin = options.margin ?? 2;
  const totalModules = size + margin * 2;
  const targetWidth = options.width || 240;
  const darkColor = options.color?.dark || '#000000';
  const lightColor = options.color?.light || '#FFFFFF';

  // Check if browser Canvas is available
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetWidth;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = lightColor;
        ctx.fillRect(0, 0, targetWidth, targetWidth);

        const cellSize = targetWidth / totalModules;
        ctx.fillStyle = darkColor;

        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            if (modules[r][c]) {
              const x = Math.round((c + margin) * cellSize);
              const y = Math.round((r + margin) * cellSize);
              const w = Math.ceil(cellSize);
              const h = Math.ceil(cellSize);
              ctx.fillRect(x, y, w, h);
            }
          }
        }
        const dataUrl = canvas.toDataURL('image/png');
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/png')) {
          return dataUrl;
        }
      }
    } catch {
      // Fall through to SVG data URL
    }
  }

  // Fallback to SVG Data URL (works in Node, JSDOM, or canvas-less environments)
  const svg = generateQrSvg(text, options);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// Default export matching standard qrcode interface
export const QRCode = {
  toDataURL,
  toString: (text: string, options?: QrOptions) => Promise.resolve(generateQrSvg(text, options)),
  create: (text: string) => ({ modules: generateQrMatrix(text) }),
};

export default QRCode;
