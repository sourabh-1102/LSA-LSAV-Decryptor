import React from 'react';
import { ProcessingSummary, FileRecord } from '../../../shared/types.js';
import { CheckCircle2, Download, Eye, RotateCcw, AlertTriangle, ArrowRight } from 'lucide-react';
import { api } from '../services/api.js';

interface SuccessScreenProps {
  isOpen: boolean;
  onClose: () => void;
  summary: ProcessingSummary;
  files: FileRecord[];
  onPreviewAll: () => void;
  onClearAll: () => void;
}

const formatTime = (ms: number) => {
  const seconds = (ms / 1000) % 60;
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds.toFixed(1)}s`;
  }
  return `${seconds.toFixed(2)}s`;
};

export const SuccessScreen: React.FC<SuccessScreenProps> = ({
  isOpen,
  onClose,
  summary,
  files,
  onPreviewAll,
  onClearAll,
}) => {
  if (!isOpen) return null;

  const { processed, failed, elapsedTime } = summary;
  const completedFiles = files.filter(f => f.status === 'Completed');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg p-8 rounded-3xl border border-blue-500/20 bg-gray-950 shadow-2xl overflow-hidden glass-panel blue-glow text-center">
        
        {/* Decorative backdrop glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl" />

        {/* Success Icon */}
        <div className="relative inline-flex p-5 rounded-full bg-blue-950/40 border border-blue-500/30 text-blue-400 mb-6">
          <CheckCircle2 className="w-12 h-12" />
        </div>

        <h2 className="text-2xl font-bold text-gray-100 glow-text">Batch Processing Complete</h2>
        <p className="text-sm text-gray-400 mt-2">
          Your files have been processed locally and offline.
        </p>

        {/* Stats Summary Card */}
        <div className="grid grid-cols-3 gap-3.5 my-6 p-4 rounded-2xl border border-gray-900 bg-gray-950/50">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Processed</span>
            <p className="text-xl font-bold text-green-400 mt-1">{processed}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Failed</span>
            <p className="text-xl font-bold text-red-400 mt-1">{failed}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500">Total Time</span>
            <p className="text-xl font-bold text-gray-200 mt-1 font-mono">{formatTime(elapsedTime)}</p>
          </div>
        </div>

        {/* Failed items warning if any */}
        {failed > 0 && (
          <div className="mb-6 flex items-start gap-2.5 p-3.5 rounded-xl border border-red-500/10 bg-red-950/10 text-red-300 text-xs text-left">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">{failed} file(s) failed during processing.</span> Check individual cards to review structural error logs.
            </div>
          </div>
        )}

        {/* Main Action Call */}
        {completedFiles.length > 0 && (
          <a
            href={api.getZipDownloadUrl()}
            download
            className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-2xl bg-blue-600 text-white font-semibold hover:bg-blue-500 active:scale-98 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/35 transition-all duration-200 mb-4"
          >
            <Download className="w-5 h-5" />
            <span>Download All Results (ZIP)</span>
          </a>
        )}

        {/* Secondary Actions */}
        <div className="flex gap-2.5">
          {completedFiles.length > 0 && (
            <button
              onClick={onPreviewAll}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-gray-800 bg-gray-900 text-gray-300 text-xs font-semibold hover:bg-gray-800 hover:text-white transition-colors duration-200"
            >
              <Eye className="w-4 h-4" />
              <span>Preview All</span>
            </button>
          )}

          <button
            onClick={onClearAll}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-gray-800 bg-gray-900/40 text-gray-400 text-xs font-semibold hover:bg-red-950/20 hover:text-red-400 hover:border-red-500/20 transition-all duration-200"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Start Fresh</span>
          </button>
        </div>

        {/* Close Link */}
        <button
          onClick={onClose}
          className="mt-6 text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mx-auto transition-colors duration-200"
        >
          <span>View Detailed Queue</span>
          <ArrowRight className="w-3 h-3" />
        </button>

      </div>
    </div>
  );
};
export default SuccessScreen;
