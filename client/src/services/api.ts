import { FileRecord, SseMessage } from '../../../shared/types.js';

// Helper to generate or retrieve session ID
const SESSION_KEY = 'lsa_processor_session_id';
export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = 'sess_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

const sessionId = getSessionId();

export const api = {
  getSessionId: () => sessionId,

  /**
   * Upload multiple files with metadata.
   */
  async uploadFiles(
    files: File[],
    fileRecords: FileRecord[],
    onProgress?: (percent: number) => void
  ): Promise<FileRecord[]> {
    const totalFiles = files.length;
    let completedUploads = 0;
    const progressTrackers = new Array(totalFiles).fill(0);

    const uploadPromises = files.map((file, index) => {
      const record = fileRecords[index];
      const formData = new FormData();
      formData.append('filesMetadata', JSON.stringify([record]));
      formData.append('files', file);

      return new Promise<FileRecord[]>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/upload`);
        xhr.setRequestHeader('x-session-id', sessionId);
        xhr.setRequestHeader('x-file-id', record.id);

        if (onProgress) {
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              progressTrackers[index] = percent;
              
              // Calculate total average progress across all active uploads
              const avgProgress = Math.round(
                progressTrackers.reduce((sum, p) => sum + p, 0) / totalFiles
              );
              onProgress(avgProgress);
            }
          });
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              completedUploads += 1;
              resolve(res.files);
            } catch {
              reject(new Error('Failed to parse upload response'));
            }
          } else {
            try {
              const res = JSON.parse(xhr.responseText);
              reject(new Error(res.error || 'Upload failed'));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      });
    });

    const results = await Promise.all(uploadPromises);
    return results[results.length - 1];
  },

  /**
   * Fetch current session files list.
   */
  async getFiles(): Promise<FileRecord[]> {
    const res = await fetch(`/api/files/${sessionId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to retrieve session files' }));
      throw new Error(err.error || 'Failed to retrieve session files');
    }
    const data = await res.json();
    return data.files;
  },

  /**
   * Remove a single file before processing.
   */
  async removeFile(fileId: string): Promise<FileRecord[]> {
    const res = await fetch(`/api/remove/${sessionId}/${fileId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to remove file' }));
      throw new Error(err.error || 'Failed to remove file');
    }
    const data = await res.json();
    return data.files;
  },

  /**
   * Trigger processing queue on the server.
   */
  async startProcessing(): Promise<void> {
    const res = await fetch(`/api/process/${sessionId}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to start processing' }));
      throw new Error(err.error || 'Failed to start processing');
    }
  },

  /**
   * Request cancellation of the current processing batch.
   */
  async cancelProcessing(): Promise<void> {
    const res = await fetch(`/api/cancel/${sessionId}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to cancel processing' }));
      throw new Error(err.error || 'Failed to cancel processing');
    }
  },

  /**
   * Fetch text preview content for a processed file.
   */
  async getPreview(fileId: string): Promise<string> {
    const res = await fetch(`/api/preview/${sessionId}/${fileId}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Preview unavailable' }));
      throw new Error(err.error || 'Preview unavailable');
    }
    const data = await res.json();
    return data.content;
  },

  /**
   * Clear session uploads and outputs on server.
   */
  async clearSession(): Promise<void> {
    const res = await fetch(`/api/clear/${sessionId}`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to clear session' }));
      throw new Error(err.error || 'Failed to clear session');
    }
  },

  /**
   * Helper to get individual download URL.
   */
  getDownloadUrl(fileId: string): string {
    return `/api/download/${sessionId}/${fileId}`;
  },

  /**
   * Helper to get ZIP download URL.
   */
  getZipDownloadUrl(): string {
    return `/api/download-zip/${sessionId}`;
  },

  /**
   * Subscribe to server-sent events for progress updates.
   */
  subscribeToEvents(
    onMessage: (msg: SseMessage) => void,
    onError: (err: Event) => void
  ): () => void {
    const eventSource = new EventSource(`/api/events/${sessionId}`);

    eventSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as SseMessage;
        onMessage(msg);
      } catch (err) {
        console.error('Error parsing SSE event data:', err);
      }
    };

    eventSource.onerror = (err) => {
      onError(err);
    };

    // Return unsubscribe callback
    return () => {
      eventSource.close();
    };
  },
};
