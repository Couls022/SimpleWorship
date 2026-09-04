/**
 * SimpleWorship PPTX Binary Validation & Normalization Utility
 *
 * Validates that an object or buffer is a genuine, non-empty, non-truncated
 * OpenXML / ZIP presentation binary (.pptx) before passing it to pptx-react-viewer.
 */

export function isValidPptxBinary(data: unknown): boolean {
  if (!data) return false;

  // Plain objects like {} or empty arrays are not valid binaries
  if (typeof data === 'object' && !(data instanceof ArrayBuffer) && !(data instanceof Uint8Array) && !Array.isArray(data)) {
    // Check if it's a typed array or Buffer-like structure
    const candidate = data as any;
    if (candidate.buffer instanceof ArrayBuffer && typeof candidate.byteLength === 'number') {
      if (candidate.byteLength < 4) return false;
      const u8 = new Uint8Array(candidate.buffer, candidate.byteOffset || 0, candidate.byteLength);
      return checkZipMagic(u8);
    }
    // Check if it's a serialized Uint8Array with numeric keys { '0': 80, '1': 75, ... }
    if ('0' in candidate && '1' in candidate && '2' in candidate && '3' in candidate) {
      const vals = Object.values(candidate) as number[];
      if (vals.length < 4) return false;
      const u8 = new Uint8Array(vals);
      return checkZipMagic(u8);
    }
    return false;
  }

  let bytes: Uint8Array | null = null;
  if (data instanceof Uint8Array) {
    bytes = data;
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else if (Array.isArray(data) && data.length >= 4) {
    bytes = new Uint8Array(data);
  }

  if (!bytes || bytes.byteLength < 4) {
    return false;
  }

  return checkZipMagic(bytes);
}

function checkZipMagic(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 4) return false;
  // ZIP / OpenXML container magic bytes: 'PK\x03\x04', 'PK\x05\x06', or 'PK\x07\x08'
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08))
  );
}

const bytesCache = new WeakMap<object, Uint8Array>();
let lastRawArrayRef: any = null;
let lastConvertedBytes: Uint8Array | null = null;

export function toValidPptxUint8Array(data: unknown): Uint8Array | null {
  if (!isValidPptxBinary(data)) {
    return null;
  }

  if (data instanceof Uint8Array) {
    return data;
  }

  if (typeof data === 'object' && data !== null) {
    const cached = bytesCache.get(data);
    if (cached) {
      return cached;
    }
  }

  if (data === lastRawArrayRef && lastConvertedBytes) {
    return lastConvertedBytes;
  }

  let result: Uint8Array | null = null;

  if (data instanceof ArrayBuffer) {
    result = new Uint8Array(data);
  } else if (Array.isArray(data)) {
    result = new Uint8Array(data);
  } else {
    const candidate = data as any;
    if (candidate && candidate.buffer instanceof ArrayBuffer) {
      result = new Uint8Array(candidate.buffer, candidate.byteOffset || 0, candidate.byteLength);
    } else if (candidate && typeof candidate === 'object' && '0' in candidate) {
      const vals = Object.values(candidate) as number[];
      result = new Uint8Array(vals);
    }
  }

  if (result && typeof data === 'object' && data !== null) {
    try {
      bytesCache.set(data, result);
    } catch {
      // Ignore if not extensible
    }
    lastRawArrayRef = data;
    lastConvertedBytes = result;
  }

  return result;
}
