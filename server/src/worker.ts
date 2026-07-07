import { parentPort, workerData } from 'worker_threads';
import * as path from 'path';
import { LsaProcessor } from './processor/lsaProcessor.js';
import { LsavProcessor } from './processor/lsavProcessor.js';

if (!parentPort) {
  throw new Error('Worker must be spawned from a parent thread.');
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function run() {
  const { filePath, outputDir, fileId, fileName, extension, simulatedDelayMs } = workerData;

  try {
    // 1. Reading
    parentPort!.postMessage({ type: 'progress', status: 'Reading', progress: 10 });
    if (simulatedDelayMs > 0) await sleep(simulatedDelayMs * 0.2);

    // Instantiate appropriate processor
    const processor = extension === 'lsav' ? new LsavProcessor() : new LsaProcessor();

    const buffer = await processor.read(filePath);
    parentPort!.postMessage({ type: 'progress', status: 'Reading', progress: 30 });
    if (simulatedDelayMs > 0) await sleep(simulatedDelayMs * 0.1);

    // 2. Validate
    const isValid = await processor.validate(buffer);
    if (!isValid) {
      throw new Error(`File validation failed: File format invalid or corrupted.`);
    }
    parentPort!.postMessage({ type: 'progress', status: 'Processing', progress: 50 });
    if (simulatedDelayMs > 0) await sleep(simulatedDelayMs * 0.2);

    // 3. Parse (Decrypt)
    const decryptedBytes = await processor.parse(buffer);
    parentPort!.postMessage({ type: 'progress', status: 'Processing', progress: 70 });
    if (simulatedDelayMs > 0) await sleep(simulatedDelayMs * 0.2);

    // 4. Transform (Guess extension and construct structure)
    const transformedData = await processor.transform(decryptedBytes);
    parentPort!.postMessage({ type: 'progress', status: 'Processing', progress: 85 });
    if (simulatedDelayMs > 0) await sleep(simulatedDelayMs * 0.2);

    // 5. Write Output with the dynamic guessed extension
    const baseName = path.parse(fileName).name;
    const finalOutputName = `${fileId}_${baseName}.${transformedData.extension}`;
    const finalOutputPath = path.join(outputDir, finalOutputName);

    await processor.write(finalOutputPath, transformedData);

    parentPort!.postMessage({
      type: 'progress',
      status: 'Completed',
      progress: 100,
      outputName: finalOutputName,
    });
  } catch (error: any) {
    console.error(`Worker execution failed for file ${fileName}:`, error);
    parentPort!.postMessage({
      type: 'error',
      status: 'Failed',
      error: error.message || 'Unknown processing error',
    });
  }
}

run();
