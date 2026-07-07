import { Buffer } from 'buffer';

export interface ProcessorInterface {
  /**
   * Reads the file from disk into a buffer.
   */
  read(filePath: string): Promise<Buffer>;

  /**
   * Validates if the file matches the expected structure/format.
   */
  validate(buffer: Buffer): Promise<boolean>;

  /**
   * Parses the file content into an intermediate representation.
   */
  parse(buffer: Buffer): Promise<any>;

  /**
   * Performs the proprietary transformation logic.
   */
  transform(parsedData: any): Promise<any>;

  /**
   * Writes the processed results to the output path.
   */
  write(outputPath: string, transformedData: any): Promise<void>;
}
