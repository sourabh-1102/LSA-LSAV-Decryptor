import { Worker } from 'worker_threads';
import * as path from 'path';
import * as os from 'os';
import { fileURLToPath } from 'url';
import { FileRecord, FileStatus } from '../../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Task {
  file: FileRecord;
  filePath: string;
  outputDir: string;
}

export class FileProcessingQueue {
  private pending: Task[] = [];
  private activeWorkers = new Map<string, { worker: Worker; startTime: number }>();
  private maxConcurrency: number;
  private isRunning = false;
  private isCancelled = false;

  private onProgress: (
    fileId: string,
    status: FileStatus,
    progress: number,
    processingTime?: number,
    error?: string,
    outputName?: string
  ) => void;
  private onFinished: () => void;
  private onCancelled: () => void;

  constructor(
    options: {
      maxConcurrency?: number;
      onProgress: (
        fileId: string,
        status: FileStatus,
        progress: number,
        processingTime?: number,
        error?: string,
        outputName?: string
      ) => void;
      onFinished: () => void;
      onCancelled: () => void;
    }
  ) {
    this.maxConcurrency = options.maxConcurrency || Math.max(1, os.cpus().length);
    this.onProgress = options.onProgress;
    this.onFinished = options.onFinished;
    this.onCancelled = options.onCancelled;
  }

  public enqueue(task: Task) {
    this.pending.push(task);
  }

  public start(simulatedDelayMs: number = 1500) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isCancelled = false;
    this.processNext(simulatedDelayMs);
  }

  private processNext(simulatedDelayMs: number) {
    if (this.isCancelled) return;

    // Check if everything is finished
    if (this.pending.length === 0 && this.activeWorkers.size === 0) {
      this.isRunning = false;
      this.onFinished();
      return;
    }

    // Process tasks up to max concurrency
    while (this.activeWorkers.size < this.maxConcurrency && this.pending.length > 0) {
      const task = this.pending.shift();
      if (!task) break;

      this.runTask(task, simulatedDelayMs);
    }
  }

  private runTask(task: Task, simulatedDelayMs: number) {
    const fileId = task.file.id;
    const startTime = Date.now();

    // Dynamically resolve worker file path (development .ts vs production .js)
    const ext = path.extname(__filename);
    const workerPath = path.resolve(__dirname, `worker${ext}`);

    // Copy process.execArgv so worker inherits TS/tsx loaders
    const worker = new Worker(workerPath, {
      workerData: {
        filePath: task.filePath,
        outputDir: task.outputDir,
        fileId: task.file.id,
        fileName: task.file.name,
        extension: task.file.extension,
        simulatedDelayMs,
      },
      execArgv: [...process.execArgv],
    });

    this.activeWorkers.set(fileId, { worker, startTime });

    worker.on('message', (msg) => {
      if (this.isCancelled) return;

      const elapsed = Date.now() - startTime;

      if (msg.type === 'progress') {
        this.onProgress(fileId, msg.status, msg.progress, elapsed, undefined, msg.outputName);
      } else if (msg.type === 'error') {
        console.error(`Queue received error from worker for file ${task.file.name}:`, msg.error);
        this.onProgress(fileId, 'Failed', 100, elapsed, msg.error);
        this.cleanupWorker(fileId);
        this.processNext(simulatedDelayMs);
      }
    });

    worker.on('error', (err) => {
      if (this.isCancelled) return;
      console.error(`Worker thread crashed for file ${task.file.name}:`, err);
      const elapsed = Date.now() - startTime;
      this.onProgress(fileId, 'Failed', 100, elapsed, err.message);
      this.cleanupWorker(fileId);
      this.processNext(simulatedDelayMs);
    });

    worker.on('exit', (code) => {
      this.cleanupWorker(fileId);
      if (code !== 0 && !this.isCancelled) {
        // If it exited with error code without posting 'error' message
        const elapsed = Date.now() - startTime;
        this.onProgress(fileId, 'Failed', 100, elapsed, `Worker exited with code ${code}`);
      }
      this.processNext(simulatedDelayMs);
    });
  }

  private cleanupWorker(fileId: string) {
    const item = this.activeWorkers.get(fileId);
    if (item) {
      item.worker.removeAllListeners();
      this.activeWorkers.delete(fileId);
    }
  }

  public cancel() {
    if (!this.isRunning) return;
    this.isCancelled = true;
    this.isRunning = false;

    // Terminate all active workers
    for (const [fileId, item] of this.activeWorkers.entries()) {
      item.worker.terminate();
      const elapsed = Date.now() - item.startTime;
      this.onProgress(fileId, 'Skipped', 100, elapsed, 'Cancelled by user');
    }
    this.activeWorkers.clear();

    // Mark remaining queued items as skipped
    const remaining = [...this.pending];
    this.pending = [];
    for (const task of remaining) {
      this.onProgress(task.file.id, 'Skipped', 0, 0, 'Cancelled by user');
    }

    this.onCancelled();
  }

  public getActiveCount(): number {
    return this.activeWorkers.size;
  }
}
