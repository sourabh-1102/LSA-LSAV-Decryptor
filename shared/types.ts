export type FileStatus = 'Queued' | 'Reading' | 'Processing' | 'Completed' | 'Failed' | 'Skipped';

export interface FileRecord {
  id: string;
  name: string;
  size: number;
  extension: string;
  status: FileStatus;
  progress: number; // 0 to 100
  processingTime?: number; // in ms
  error?: string;
  outputName?: string;
}

export interface ProcessingSummary {
  totalFiles: number;
  processed: number;
  failed: number;
  remaining: number;
  elapsedTime: number; // in ms
  estimatedRemainingTime: number; // in ms
}

export interface SseMessage {
  type: 'status_update' | 'summary_update' | 'finished' | 'cancelled' | 'error';
  sessionId: string;
  file?: FileRecord;
  summary?: ProcessingSummary;
  error?: string;
}
