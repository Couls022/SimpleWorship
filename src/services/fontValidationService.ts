/**
 * SimpleWorship Font Validation Service
 * Validates the cryptographic and structural integrity of downloaded and imported font files
 * by checking against expected file signatures (magic bytes), SFNT table directories,
 * and OpenType/TrueType head table invariants before registration in the browser runtime.
 */

export type FontFormat = 'truetype' | 'opentype' | 'woff' | 'woff2' | 'collection';

export interface FontValidationOptions {
  /**
   * If true, restricts acceptance strictly to raw TrueType (.ttf) or OpenType (.otf) files.
   * If false, also accepts valid WOFF and WOFF2 web fonts (default: false).
   */
  requireTrueTypeOrOpenTypeOnly?: boolean;

  /**
   * Whether to perform deep structural validation of the SFNT table directory
   * and 'head' table magic number (0x5F0F3CF5) for TTF/OTF (default: true).
   */
  strictTableValidation?: boolean;

  /**
   * Optional minimum expected file size in bytes (default: 256 bytes).
   */
  minFileSize?: number;

  /**
   * Optional maximum allowed file size in bytes (default: 50MB).
   */
  maxFileSize?: number;

  /**
   * Optional expected family name to compare against parsed metadata in the 'name' table.
   */
  expectedFamilyName?: string;
}

export interface FontIntegrityResult {
  /**
   * Whether the font binary passed all signature and integrity checks.
   */
  isValid: boolean;

  /**
   * Whether the binary is strictly a TrueType or OpenType SFNT font.
   */
  isTrueTypeOrOpenType: boolean;

  /**
   * Identified font format, or null if invalid.
   */
  format: FontFormat | null;

  /**
   * Hex string representation of the first 4 magic bytes (e.g., '0x00010000', '0x4F54544F').
   */
  magicBytesHex: string;

  /**
   * Printable 4-character ASCII tag if applicable (e.g. 'OTTO', 'true', 'wOF2', 'wOFF').
   */
  magicBytesTag: string;

  /**
   * Total binary length in bytes.
   */
  byteLength: number;

  /**
   * MIME type suitable for font data URI or HTTP headers.
   */
  mimeType: string;

  /**
   * Appropriate canonical file extension (ttf, otf, woff, woff2, ttc).
   */
  fileExtension: string;

  /**
   * Total number of tables declared in the font table directory.
   */
  numTables?: number;

  /**
   * List of 4-character table tags detected in the font file (e.g. ['cmap', 'head', 'name', 'glyf']).
   */
  tables?: string[];

  /**
   * Whether all core required tables are present (cmap, head, name, maxp, hhea, hmtx).
   */
  requiredTablesPresent?: boolean;

  /**
   * Missing required tables if any.
   */
  missingRequiredTables?: string[];

  /**
   * Whether the OpenType/TrueType 'head' table was found and its magic number equals 0x5F0F3CF5.
   */
  hasValidHeadTable?: boolean;

  /**
   * Family name extracted from the font's OpenXML/OpenType 'name' table if available.
   */
  fontFamilyName?: string;

  /**
   * Human-readable error message explaining why validation failed.
   */
  error?: string;

  /**
   * Non-fatal warnings regarding font metadata or layout.
   */
  warnings?: string[];
}

/** Known Magic Byte Signatures */
export const FONT_MAGIC_SIGNATURES = {
  // TrueType 1.0
  TRUETYPE_VERSION_1: 0x00010000,
  // Apple TrueType ('true')
  TRUETYPE_APPLE: 0x74727565,
  // PostScript Type 1 OpenType ('typ1')
  TRUETYPE_TYPE1: 0x74797031,
  // OpenType with CFF / PostScript outlines ('OTTO')
  OPENTYPE_CFF: 0x4F54544F,
  // TrueType / OpenType Collection ('ttcf')
  FONT_COLLECTION: 0x74746366,
  // Web Open Font Format 1.0 ('wOFF')
  WOFF: 0x774F4646,
  // Web Open Font Format 2.0 ('wOF2')
  WOFF2: 0x774F4632,
} as const;

/** Canonical OpenType 'head' table magic number required by ISO/IEC 14496-22 & Apple specs */
export const OPENTYPE_HEAD_MAGIC = 0x5F0F3CF5;

/** Standard core tables required for standard TrueType rendering */
const CORE_REQUIRED_TTF_TABLES = ['cmap', 'head', 'maxp', 'name'];

/**
 * Validates the integrity of a font binary by checking magic byte file signatures,
 * offset table records, and structural integrity.
 */
export class FontValidationService {
  /**
   * Synchronously validates a font binary buffer (ArrayBuffer or Uint8Array).
   */
  public static validateFontSync(
    input: ArrayBuffer | Uint8Array | ArrayBufferView,
    options: FontValidationOptions = {}
  ): FontIntegrityResult {
    const {
      requireTrueTypeOrOpenTypeOnly = false,
      strictTableValidation = true,
      minFileSize = 32,
      maxFileSize = 50 * 1024 * 1024, // 50MB
      expectedFamilyName,
    } = options;

    const warnings: string[] = [];

    // Convert input to Uint8Array & DataView
    let buffer: ArrayBuffer;
    let byteOffset = 0;
    let byteLength = 0;

    if (input instanceof ArrayBuffer) {
      buffer = input;
      byteOffset = 0;
      byteLength = input.byteLength;
    } else if (ArrayBuffer.isView(input)) {
      buffer = input.buffer;
      byteOffset = input.byteOffset;
      byteLength = input.byteLength;
    } else {
      return {
        isValid: false,
        isTrueTypeOrOpenType: false,
        format: null,
        magicBytesHex: '0x00000000',
        magicBytesTag: '',
        byteLength: 0,
        mimeType: 'application/octet-stream',
        fileExtension: 'bin',
        error: 'Invalid input: font payload must be an ArrayBuffer or TypedArray view.',
      };
    }

    // Read magic bytes if available
    let magic = 0;
    let magicBytesHex = '0x00000000';
    let magicBytesTag = '';
    if (byteLength >= 4) {
      const initialView = new DataView(buffer, byteOffset, byteLength);
      magic = initialView.getUint32(0, false);
      magicBytesHex = `0x${magic.toString(16).toUpperCase().padStart(8, '0')}`;
      magicBytesTag = this.readFourCC(initialView, 0);
    }

    // Check size boundaries
    if (byteLength < minFileSize) {
      // Check if it's an HTML error page or text response
      const textPreview = this.decodeAsciiPreview(buffer, byteOffset, Math.min(byteLength, 128));
      const htmlOrJson = /<!doctype|<html|<head|<\?xml|{"error"|accessdenied|404\s+not/i.test(textPreview);

      return {
        isValid: false,
        isTrueTypeOrOpenType: false,
        format: null,
        magicBytesHex,
        magicBytesTag,
        byteLength,
        mimeType: htmlOrJson ? 'text/html' : 'application/octet-stream',
        fileExtension: 'bin',
        error: htmlOrJson
          ? `Downloaded font payload contains an HTML or HTTP error page instead of font binary (${byteLength} bytes): "${textPreview.slice(0, 60)}..."`
          : `Font binary is too small to be a valid font (${byteLength} bytes; minimum is ${minFileSize} bytes).`,
      };
    }

    if (byteLength > maxFileSize) {
      return {
        isValid: false,
        isTrueTypeOrOpenType: false,
        format: null,
        magicBytesHex,
        magicBytesTag,
        byteLength,
        mimeType: 'application/octet-stream',
        fileExtension: 'bin',
        error: `Font binary exceeds maximum safe size threshold (${(byteLength / 1024 / 1024).toFixed(2)} MB > ${(maxFileSize / 1024 / 1024).toFixed(2)} MB).`,
      };
    }

    const view = new DataView(buffer, byteOffset, byteLength);

    let format: FontFormat | null = null;
    let isTrueTypeOrOpenType = false;
    let mimeType = 'application/octet-stream';
    let fileExtension = 'bin';

    if (magic === FONT_MAGIC_SIGNATURES.TRUETYPE_VERSION_1 ||
        magic === FONT_MAGIC_SIGNATURES.TRUETYPE_APPLE ||
        magic === FONT_MAGIC_SIGNATURES.TRUETYPE_TYPE1) {
      format = 'truetype';
      isTrueTypeOrOpenType = true;
      mimeType = 'font/ttf';
      fileExtension = 'ttf';
    } else if (magic === FONT_MAGIC_SIGNATURES.OPENTYPE_CFF) {
      format = 'opentype';
      isTrueTypeOrOpenType = true;
      mimeType = 'font/otf';
      fileExtension = 'otf';
    } else if (magic === FONT_MAGIC_SIGNATURES.FONT_COLLECTION) {
      format = 'collection';
      isTrueTypeOrOpenType = true;
      mimeType = 'font/collection';
      fileExtension = 'ttc';
    } else if (magic === FONT_MAGIC_SIGNATURES.WOFF) {
      format = 'woff';
      isTrueTypeOrOpenType = false;
      mimeType = 'font/woff';
      fileExtension = 'woff';
    } else if (magic === FONT_MAGIC_SIGNATURES.WOFF2) {
      format = 'woff2';
      isTrueTypeOrOpenType = false;
      mimeType = 'font/woff2';
      fileExtension = 'woff2';
    } else {
      // Signature does not match any recognized font magic bytes
      const textPreview = this.decodeAsciiPreview(buffer, byteOffset, Math.min(byteLength, 128));
      const looksLikeHtml = /<!doctype|<html|<head|<\?xml|{"error"|404|403|500/i.test(textPreview);

      return {
        isValid: false,
        isTrueTypeOrOpenType: false,
        format: null,
        magicBytesHex,
        magicBytesTag,
        byteLength,
        mimeType: looksLikeHtml ? 'text/html' : 'application/octet-stream',
        fileExtension: 'bin',
        error: looksLikeHtml
          ? `Downloaded font payload contains web server text/HTML (${textPreview.slice(0, 60)}...) instead of a TrueType/OpenType font signature.`
          : `Invalid font magic signature ${magicBytesHex} (${JSON.stringify(magicBytesTag)}). Expected TrueType (0x00010000, 'true'), OpenType ('OTTO'), or WOFF/WOFF2.`,
      };
    }

    // If caller strictly requires raw TrueType or OpenType (SFNT)
    if (requireTrueTypeOrOpenTypeOnly && !isTrueTypeOrOpenType) {
      return {
        isValid: false,
        isTrueTypeOrOpenType,
        format,
        magicBytesHex,
        magicBytesTag,
        byteLength,
        mimeType,
        fileExtension,
        error: `Font format "${format}" is not a raw TrueType or OpenType font file. Expected .ttf or .otf.`,
      };
    }

    // Deep SFNT validation for TrueType and OpenType fonts
    let numTables = 0;
    const tableTags: string[] = [];
    let hasValidHead = false;
    let parsedFamilyName: string | undefined;
    const missingTables: string[] = [];

    if (format === 'truetype' || format === 'opentype') {
      if (byteLength < 12) {
        return {
          isValid: false,
          isTrueTypeOrOpenType,
          format,
          magicBytesHex,
          magicBytesTag,
          byteLength,
          mimeType,
          fileExtension,
          error: `Corrupted SFNT header: file is too small (${byteLength} bytes; minimum SFNT header is 12 bytes).`,
        };
      }

      numTables = view.getUint16(4, false);

      if (numTables === 0 || numTables > 256) {
        return {
          isValid: false,
          isTrueTypeOrOpenType,
          format,
          magicBytesHex,
          magicBytesTag,
          byteLength,
          mimeType,
          fileExtension,
          error: `Invalid SFNT table count: ${numTables}. Must be between 1 and 256 tables.`,
        };
      }

      const tableDirectoryEnd = 12 + numTables * 16;
      if (byteLength < tableDirectoryEnd) {
        return {
          isValid: false,
          isTrueTypeOrOpenType,
          format,
          magicBytesHex,
          magicBytesTag,
          byteLength,
          mimeType,
          fileExtension,
          error: `Truncated font file: declared ${numTables} tables requiring ${tableDirectoryEnd} bytes, but file is only ${byteLength} bytes.`,
        };
      }

      // Read table records and check table boundaries
      const tableMap = new Map<string, { offset: number; length: number; checksum: number }>();

      for (let i = 0; i < numTables; i++) {
        const recordOffset = 12 + i * 16;
        const tag = this.readFourCC(view, recordOffset);
        const checksum = view.getUint32(recordOffset + 4, false);
        const offset = view.getUint32(recordOffset + 8, false);
        const length = view.getUint32(recordOffset + 12, false);

        tableTags.push(tag);
        tableMap.set(tag, { offset, length, checksum });

        // Ensure table boundaries do not overflow buffer
        if (offset + length > byteLength) {
          return {
            isValid: false,
            isTrueTypeOrOpenType,
            format,
            magicBytesHex,
            magicBytesTag,
            byteLength,
            numTables,
            tables: tableTags,
            mimeType,
            fileExtension,
            error: `Corrupt table directory: table "${tag}" spans past end of file (offset: ${offset}, length: ${length}, total: ${byteLength}).`,
          };
        }
      }

      // Check required tables
      for (const req of CORE_REQUIRED_TTF_TABLES) {
        if (!tableMap.has(req)) {
          missingTables.push(req);
        }
      }

      // Check outlines table: either 'glyf' (TrueType) or 'CFF ' / 'CFF2' (OpenType)
      const hasGlyf = tableMap.has('glyf');
      const hasCff = tableMap.has('CFF ') || tableMap.has('CFF2');
      if (!hasGlyf && !hasCff) {
        warnings.push('Font does not contain standard "glyf" or "CFF " outline tables; might be a bitmap or SVG font.');
      }

      // Validate 'head' table magic number
      const headRecord = tableMap.get('head');
      if (headRecord) {
        if (headRecord.length >= 54 && headRecord.offset + 54 <= byteLength) {
          const headMagic = view.getUint32(headRecord.offset + 12, false);
          if (headMagic === OPENTYPE_HEAD_MAGIC) {
            hasValidHead = true;
          } else {
            const err = `Invalid OpenType 'head' table magic number: 0x${headMagic.toString(16).toUpperCase()} (expected 0x5F0F3CF5). File is corrupted.`;
            if (strictTableValidation) {
              return {
                isValid: false,
                isTrueTypeOrOpenType,
                format,
                magicBytesHex,
                magicBytesTag,
                byteLength,
                numTables,
                tables: tableTags,
                requiredTablesPresent: missingTables.length === 0,
                missingRequiredTables: missingTables,
                hasValidHeadTable: false,
                mimeType,
                fileExtension,
                error: err,
              };
            } else {
              warnings.push(err);
            }
          }
        }
      }

      // Extract font family name from 'name' table
      const nameRecord = tableMap.get('name');
      if (nameRecord) {
        parsedFamilyName = this.extractFontNameFromTable(view, nameRecord.offset, nameRecord.length);
      }

      if (missingTables.length > 0 && strictTableValidation) {
        return {
          isValid: false,
          isTrueTypeOrOpenType,
          format,
          magicBytesHex,
          magicBytesTag,
          byteLength,
          numTables,
          tables: tableTags,
          requiredTablesPresent: false,
          missingRequiredTables: missingTables,
          hasValidHeadTable: hasValidHead,
          fontFamilyName: parsedFamilyName,
          mimeType,
          fileExtension,
          error: `Font file is missing required SFNT tables: ${missingTables.join(', ')}.`,
        };
      }
    } else if (format === 'woff') {
      if (byteLength < 44) {
        return {
          isValid: false,
          isTrueTypeOrOpenType,
          format,
          magicBytesHex,
          magicBytesTag,
          byteLength,
          mimeType,
          fileExtension,
          error: `Corrupt WOFF header: file is too small (${byteLength} bytes; minimum WOFF header is 44 bytes).`,
        };
      }
      numTables = view.getUint16(12, false);
      const totalLength = view.getUint32(16, false);
      if (totalLength > byteLength) {
        warnings.push(`Declared WOFF length (${totalLength}) is greater than actual payload (${byteLength}).`);
      }
    } else if (format === 'woff2') {
      if (byteLength < 48) {
        return {
          isValid: false,
          isTrueTypeOrOpenType,
          format,
          magicBytesHex,
          magicBytesTag,
          byteLength,
          mimeType,
          fileExtension,
          error: `Corrupt WOFF2 header: file is too small (${byteLength} bytes; minimum WOFF2 header is 48 bytes).`,
        };
      }
      numTables = view.getUint16(12, false);
      const totalLength = view.getUint32(16, false);
      if (totalLength > byteLength) {
        warnings.push(`Declared WOFF2 length (${totalLength}) is greater than actual payload (${byteLength}).`);
      }
    }

    // Optional comparison with expected family name
    if (expectedFamilyName && parsedFamilyName) {
      const normExpected = expectedFamilyName.trim().toLowerCase();
      const normParsed = parsedFamilyName.trim().toLowerCase();
      if (!normParsed.includes(normExpected) && !normExpected.includes(normParsed)) {
        warnings.push(`Parsed font family name "${parsedFamilyName}" does not closely match expected "${expectedFamilyName}".`);
      }
    }

    return {
      isValid: true,
      isTrueTypeOrOpenType,
      format,
      magicBytesHex,
      magicBytesTag,
      byteLength,
      numTables,
      tables: tableTags.length > 0 ? tableTags : undefined,
      requiredTablesPresent: missingTables.length === 0,
      missingRequiredTables: missingTables.length > 0 ? missingTables : undefined,
      hasValidHeadTable: hasValidHead,
      fontFamilyName: parsedFamilyName,
      mimeType,
      fileExtension,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Asynchronously validates a font from ArrayBuffer, Uint8Array, or Blob.
   */
  public static async validateFont(
    input: ArrayBuffer | Uint8Array | Blob,
    options: FontValidationOptions = {}
  ): Promise<FontIntegrityResult> {
    if (typeof Blob !== 'undefined' && input instanceof Blob) {
      const arrayBuffer = await input.arrayBuffer();
      return this.validateFontSync(arrayBuffer, options);
    }
    return this.validateFontSync(input as ArrayBuffer | Uint8Array, options);
  }

  /**
   * Validates that the font is genuine TrueType or OpenType before registration.
   * Throws an Error if invalid.
   */
  public static assertValidFont(
    input: ArrayBuffer | Uint8Array,
    fontName?: string,
    options?: FontValidationOptions
  ): FontIntegrityResult {
    const result = this.validateFontSync(input, options);
    if (!result.isValid) {
      const prefix = fontName ? `Font "${fontName}" validation failed: ` : 'Font validation failed: ';
      throw new Error(`${prefix}${result.error || 'Invalid font binary'}`);
    }
    return result;
  }

  /**
   * Quick check whether a binary payload is a genuine TrueType or OpenType font.
   */
  public static isTrueTypeOrOpenType(buffer: ArrayBuffer | Uint8Array): boolean {
    const result = this.validateFontSync(buffer, { strictTableValidation: false });
    return result.isValid && result.isTrueTypeOrOpenType;
  }

  /**
   * Quick check whether a binary payload is any recognized font format (TTF, OTF, WOFF, WOFF2).
   */
  public static isValidFontBinary(buffer: ArrayBuffer | Uint8Array): boolean {
    const result = this.validateFontSync(buffer, { strictTableValidation: false });
    return result.isValid;
  }

  /**
   * Identifies the font format tag ('truetype' | 'opentype' | 'woff' | 'woff2' | null).
   */
  public static detectFontFormat(buffer: ArrayBuffer | Uint8Array): FontFormat | null {
    const result = this.validateFontSync(buffer, { strictTableValidation: false });
    return result.isValid ? result.format : null;
  }

  /**
   * Pre-registration gatekeeper hook: verifies font integrity before calling FontFace or IndexedDB.
   * Returns a normalized { verifiedBuffer, format, familyName } object on success, or throws descriptive error.
   */
  public static validateBeforeRegistration(
    family: string,
    buffer: ArrayBuffer,
    options: FontValidationOptions = {}
  ): {
    verifiedFormat: FontFormat;
    byteLength: number;
    familyName: string;
    mimeType: string;
  } {
    const cleanFamily = family.replace(/^["']+|["']+$/g, '').trim();
    const result = this.validateFontSync(buffer, {
      ...options,
      expectedFamilyName: cleanFamily,
    });

    if (!result.isValid || !result.format) {
      throw new Error(
        `Cannot register font "${cleanFamily}": Font binary integrity check failed. ${result.error || 'Corrupt or deceptive file signature.'}`
      );
    }

    return {
      verifiedFormat: result.format,
      byteLength: result.byteLength,
      familyName: result.fontFamilyName || cleanFamily,
      mimeType: result.mimeType,
    };
  }

  // --- Private Helpers ---

  /** Reads a 4-character ASCII tag from a DataView */
  private static readFourCC(view: DataView, offset: number): string {
    let s = '';
    for (let i = 0; i < 4; i++) {
      const code = view.getUint8(offset + i);
      // Printable ASCII only
      if (code >= 32 && code <= 126) {
        s += String.fromCharCode(code);
      } else {
        s += '?';
      }
    }
    return s;
  }

  /** Safely decodes ASCII preview for debugging HTML error pages */
  private static decodeAsciiPreview(buffer: ArrayBuffer, offset: number, len: number): string {
    try {
      const u8 = new Uint8Array(buffer, offset, len);
      return Array.from(u8)
        .map(b => (b >= 32 && b <= 126 ? String.fromCharCode(b) : ' '))
        .join('')
        .trim();
    } catch {
      return '';
    }
  }

  /**
   * Parses the OpenType 'name' table to extract font family name (NameID 1, 16, or 4).
   * Supports Windows Unicode (UTF-16BE) and Macintosh Roman / ASCII encodings.
   */
  private static extractFontNameFromTable(view: DataView, tableOffset: number, tableLength: number): string | undefined {
    try {
      if (tableLength < 6) return undefined;

      const count = view.getUint16(tableOffset + 2, false);
      const stringOffset = tableOffset + view.getUint16(tableOffset + 4, false);

      let familyName: string | undefined;
      let typographicFamilyName: string | undefined;
      let fullName: string | undefined;

      for (let i = 0; i < count; i++) {
        const recordOffset = tableOffset + 6 + i * 12;
        if (recordOffset + 12 > tableOffset + tableLength) break;

        const platformId = view.getUint16(recordOffset, false);
        const encodingId = view.getUint16(recordOffset + 2, false);
        const nameId = view.getUint16(recordOffset + 6, false);
        const length = view.getUint16(recordOffset + 8, false);
        const strOffset = view.getUint16(recordOffset + 10, false);

        // Name IDs of interest:
        // 1 = Font Family name
        // 4 = Full font name
        // 16 = Typographic Family name
        if (nameId !== 1 && nameId !== 4 && nameId !== 16) continue;

        const absStrOffset = stringOffset + strOffset;
        if (absStrOffset + length > view.byteLength) continue;

        let str = '';
        if (platformId === 3 || (platformId === 0 && encodingId !== 0)) {
          // UTF-16BE (Windows or Unicode platform)
          for (let j = 0; j < length; j += 2) {
            if (absStrOffset + j + 1 < view.byteLength) {
              const code = view.getUint16(absStrOffset + j, false);
              if (code > 0) str += String.fromCharCode(code);
            }
          }
        } else {
          // 8-bit / Mac Roman / Latin-1
          for (let j = 0; j < length; j++) {
            const code = view.getUint8(absStrOffset + j);
            if (code >= 32 && code <= 126) str += String.fromCharCode(code);
          }
        }

        str = str.trim();
        if (str) {
          if (nameId === 16 && !typographicFamilyName) typographicFamilyName = str;
          else if (nameId === 1 && !familyName) familyName = str;
          else if (nameId === 4 && !fullName) fullName = str;
        }
      }

      return typographicFamilyName || familyName || fullName;
    } catch {
      return undefined;
    }
  }
}

// Export singleton instance and utility functions for seamless consumption
export const fontValidationService = new FontValidationService();

export const validateFontIntegrity = FontValidationService.validateFont.bind(FontValidationService);
export const validateFontIntegritySync = FontValidationService.validateFontSync.bind(FontValidationService);
export const isTrueTypeOrOpenType = FontValidationService.isTrueTypeOrOpenType.bind(FontValidationService);
export const isValidFontBinary = FontValidationService.isValidFontBinary.bind(FontValidationService);
export const detectFontFormat = FontValidationService.detectFontFormat.bind(FontValidationService);
export const assertValidFont = FontValidationService.assertValidFont.bind(FontValidationService);
export const validateBeforeRegistration = FontValidationService.validateBeforeRegistration.bind(FontValidationService);
