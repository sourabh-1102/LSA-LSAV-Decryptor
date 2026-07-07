import { useState, useEffect, useRef } from 'react';
import { FileRecord, ProcessingSummary, SseMessage } from '../../shared/types.js';
import { UploadZone } from './components/UploadZone.tsx';
import { FileList } from './components/FileList.tsx';
import { SummaryPanel } from './components/SummaryPanel.tsx';
import { SuccessScreen } from './components/SuccessScreen.tsx';
import { PreviewModal } from './components/PreviewModal.tsx';
import { api } from './services/api.js';
import { ShieldCheck, Cpu, HardDrive, RefreshCw } from 'lucide-react';

function App() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [summary, setSummary] = useState<ProcessingSummary>({
    totalFiles: 0,
    processed: 0,
    failed: 0,
    remaining: 0,
    elapsedTime: 0,
    estimatedRemainingTime: 0,
  });

  // Modal States
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  // Hidden File Input Ref (for triggering from SummaryPanel or UploadZone)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // SSE Subscription Cleanup Ref
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Sync event source when processing status is active
  useEffect(() => {
    // Keep an event listener open to monitor state
    const unsubscribe = api.subscribeToEvents(
      (msg: SseMessage) => {
        if (msg.type === 'status_update' && msg.file) {
          setFiles((prevFiles) =>
            prevFiles.map((f) => (f.id === msg.file!.id ? msg.file! : f))
          );
        } else if (msg.type === 'summary_update' && msg.summary) {
          setSummary(msg.summary);
        } else if (msg.type === 'finished') {
          if (msg.summary) setSummary(msg.summary);
          setProcessing(false);
          setIsSuccessOpen(true);
        } else if (msg.type === 'cancelled') {
          if (msg.summary) setSummary(msg.summary);
          setProcessing(false);
        }
      },
      (err) => {
        console.error('SSE connection error:', err);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  // Load session files on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        const existingFiles = await api.getFiles();
        setFiles(existingFiles);
      } catch (err) {
        console.error('Failed to load existing session files:', err);
      }
    };
    loadSession();
  }, []);

  // Recalculate summary count locally whenever files change and we are NOT processing
  useEffect(() => {
    if (!processing) {
      const total = files.length;
      const completed = files.filter((f) => f.status === 'Completed').length;
      const failed = files.filter((f) => f.status === 'Failed').length;
      const skipped = files.filter((f) => f.status === 'Skipped').length;
      const done = completed + failed + skipped;

      setSummary((prev) => ({
        ...prev,
        totalFiles: total,
        processed: completed,
        failed: failed,
        remaining: total - done,
      }));
    }
  }, [files, processing]);

  // File Picker Selection
  const handleFilesSelected = async (selectedFiles: File[]) => {
    setUploadProgress(0);
    
    // Create local metadata record objects
    const newRecords: FileRecord[] = selectedFiles.map((file) => {
      const nameParts = file.name.split('.');
      const ext = nameParts.pop()?.toLowerCase() || '';
      return {
        id: 'file_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now(),
        name: file.name,
        size: file.size,
        extension: ext,
        status: 'Queued',
        progress: 0,
      };
    });

    try {
      const serverFiles = await api.uploadFiles(selectedFiles, newRecords, (percent) => {
        setUploadProgress(percent);
      });
      setFiles(serverFiles);
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploadProgress(null);
    }
  };

  const handleRemoveFile = async (fileId: string) => {
    try {
      const updatedFiles = await api.removeFile(fileId);
      setFiles(updatedFiles);
    } catch (err: any) {
      console.error('Failed to remove file:', err);
    }
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setIsSuccessOpen(false);

    try {
      await api.startProcessing();
    } catch (err: any) {
      alert(`Failed to start processing: ${err.message}`);
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    try {
      await api.cancelProcessing();
    } catch (err: any) {
      console.error('Cancellation failed:', err);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear all files and results?')) {
      try {
        await api.clearSession();
        setFiles([]);
        setIsSuccessOpen(false);
        setSummary({
          totalFiles: 0,
          processed: 0,
          failed: 0,
          remaining: 0,
          elapsedTime: 0,
          estimatedRemainingTime: 0,
        });
      } catch (err: any) {
        console.error('Failed to clear session:', err);
      }
    }
  };

  const handlePreviewFile = (fileId: string) => {
    setPreviewFileId(fileId);
    setIsPreviewOpen(true);
  };

  const handlePreviewAll = () => {
    setPreviewFileId(null);
    setIsPreviewOpen(true);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const completedFilesForPreview = files.filter((f) => f.status === 'Completed');
  const hasFiles = files.length > 0;
  const hasOutputs = files.some((f) => f.status === 'Completed');

  return (
    <div className="min-h-screen py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col gap-8">
      {/* Hidden File Picker Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".lsa,.lsav"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesSelected(Array.from(e.target.files));
          }
        }}
        disabled={processing || uploadProgress !== null}
        className="hidden"
      />

      {/* Header Panel */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-center p-6 rounded-3xl border border-gray-800/40 glass-panel shadow-2xl relative overflow-hidden shrink-0">
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl" />
        
        {/* Title */}
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-blue-950/40 border border-blue-500/20 text-blue-400 blue-glow">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white glow-text">
              LSA & LSAV Processing Suite
            </h1>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <HardDrive className="w-3.5 h-3.5 text-blue-500/80" />
              <span>Offline Analytical Engine</span>
            </p>
          </div>
        </div>

        {/* Offline Badge & Upload State */}
        <div className="mt-4 md:mt-0 flex flex-wrap items-center gap-3">
          {uploadProgress !== null && (
            <div className="flex items-center gap-3 bg-gray-900 border border-gray-800 px-4 py-2 rounded-xl text-xs">
              <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
              <span className="text-gray-300">Uploading: {uploadProgress}%</span>
            </div>
          )}

          <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-green-500/20 bg-green-950/20 text-green-400 text-xs font-semibold tracking-wide">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>OFFLINE SECURE GATEWAY</span>
          </div>
        </div>
      </header>

      {/* Workspace Dashboard */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Upload zone + global status summary */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          <UploadZone
            onFilesSelected={handleFilesSelected}
            disabled={processing || uploadProgress !== null}
            currentCount={files.length}
            currentSize={files.reduce((sum, f) => sum + f.size, 0)}
          />

          <SummaryPanel
            summary={summary}
            processing={processing}
            onProcess={handleProcess}
            onCancel={handleCancel}
            onClearAll={handleClearAll}
            onTriggerUpload={triggerFileInput}
            hasFiles={hasFiles}
            hasOutputs={hasOutputs}
          />
        </section>

        {/* Right Side: Detailed queue/list cards */}
        <section className="lg:col-span-7 p-6 rounded-3xl border border-gray-800/40 glass-panel shadow-xl min-h-[400px]">
          <FileList
            files={files}
            onRemoveFile={handleRemoveFile}
            onPreviewFile={handlePreviewFile}
            onPreviewAll={handlePreviewAll}
            processing={processing}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-600 border-t border-gray-900/60 mt-auto">
        <p>© 2026 LSA Secure Processing Environment. All processing is executed locally on client device.</p>
      </footer>

      {/* Modals */}
      <PreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        files={completedFilesForPreview}
        initialFileId={previewFileId}
      />

      <SuccessScreen
        isOpen={isSuccessOpen}
        onClose={() => setIsSuccessOpen(false)}
        summary={summary}
        files={files}
        onPreviewAll={handlePreviewAll}
        onClearAll={handleClearAll}
      />
    </div>
  );
}

export default App;
