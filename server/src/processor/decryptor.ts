import crypto from 'crypto';

// Secret key and IV bytes retrieved from LsaDecryptor.kt
const secretKeyBytes = Buffer.from([
  0x30, 0x82, 0x04, 0x6C,
  0x30, 0x82, 0x03, 0x54,
  0xA0, 0x03, 0x02, 0x01,
  0x02, 0x02, 0x09, 0x00
]);

const ivBytes = Buffer.from([
  0x11, 0x13, 0x21, 0x23,
  0x31, 0x33, 0x41, 0x43,
  0x51, 0x53, 0x61, 0x66,
  0x67, 0x68, 0x71, 0x72
]);

/**
 * Decrypts an entire LSA buffer using AES-128-CTR.
 */
export function decryptLsa(input: Buffer): Buffer {
  const decipher = crypto.createDecipheriv('aes-128-ctr', secretKeyBytes, ivBytes);
  return Buffer.concat([decipher.update(input), decipher.final()]);
}

/**
 * Decrypts an LSAV buffer (where only the first 1024/16 bytes are encrypted).
 */
export function decryptLsav(input: Buffer): Buffer {
  const size = input.length;
  if (size === 0) return input;

  const headerSize = Math.max(Math.min(1024, size), 16);
  const headerBytes = input.subarray(0, headerSize);

  const decipher = crypto.createDecipheriv('aes-128-ctr', secretKeyBytes, ivBytes);
  const decryptedHeader = Buffer.concat([decipher.update(headerBytes), decipher.final()]);

  const result = Buffer.alloc(size);
  decryptedHeader.copy(result, 0, 0, headerSize);
  if (size > headerSize) {
    input.copy(result, headerSize, headerSize, size);
  }
  return result;
}

/**
 * Identifies file signatures (magic bytes) to guess the original extension.
 */
export function guessExtension(bytes: Buffer): string {
  if (bytes.length < 4) return 'jpg';

  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'jpg';
  }
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'png';
  }
  // GIF: "GIF8" (47 49 46 38)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'gif';
  }
  // BMP: "BM" (42 4D)
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
    return 'bmp';
  }
  // PDF: "%PDF" (25 50 44 46)
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'pdf';
  }
  // WEBP: RIFF...WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50  // WEBP
  ) {
    return 'webp';
  }
  // MP4: ftyp (usually starts at offset 4 with ftyp)
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 // ftyp
  ) {
    return 'mp4';
  }

  return 'jpg'; // default fallback as defined in Android app
}
