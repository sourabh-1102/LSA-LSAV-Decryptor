import { ProcessorInterface } from './interface.js';
import { decryptLsav, guessExtension } from './decryptor.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Buffer } from 'buffer';

export class LsavProcessor implements ProcessorInterface {
  async read(filePath: string): Promise<Buffer> {
    return await fs.readFile(filePath);
  }

  async validate(buffer: Buffer): Promise<boolean> {
    return buffer.length > 0;
  }

  async parse(buffer: Buffer): Promise<any> {
    // Perform actual decryption of LSAV file header
    const decrypted = decryptLsav(buffer);
    return decrypted;
  }

  async transform(decryptedBytes: Buffer): Promise<any> {
    // Guess extension from the decrypted bytes
    const ext = guessExtension(decryptedBytes);
    return {
      decryptedBytes,
      extension: ext,
    };
  }

  async write(outputPath: string, data: { decryptedBytes: Buffer; extension: string }): Promise<void> {
    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    // Write the raw decrypted bytes to the output file
    await fs.writeFile(outputPath, data.decryptedBytes);
  }
}
