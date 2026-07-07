import React from 'react';
import { ProcessingSummary } from '../../../shared/types.js';
import { Play, XCircle, Trash2, Download, Upload, Clock, Hourglass } from 'lucide-react';
import { api } from '../services/api.js';

interface SummaryPanelProps {
  summary: ProcessingSummary;
  processing: boolean;
  onProcess: () => void;
  onCancel: () => void;
  onClearAll: () => void;
  onTriggerUpload: () => void;
  hasFiles: boolean;
  hasOutputs: boolean;
}

// Utility to format durations
const formatTime = (ms: number) => {
  if (ms <= 0) return '00:00';
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

  const pad = (num: number) => String(num).padStart(2, '0');
  
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(minutes)}:${pad(seconds)}`;
};

export const SummaryPanel: React.FC<SummaryPanelProps> = ({
  summary,
  processing,
  onProcess,
  onCancel,
  onClearAll,
  onTriggerUpload,
  hasFiles,
  hasOutputs,
}) => {
  const { totalFiles, processed, failed, remaining, elapsedTime, estimatedRemainingTime } = summary;
  const doneCount = processed + failed;
  const progressPercent = totalFiles > 0 ? Math.round((doneCount / totalFiles) * 100) : 0;

  return (
    <div className="w-full p-6 rounded-2xl border border-gray-800/60 glass-panel flex flex-col gap-6">
      <h3 className="text-lg font-semibold text-gray-200 border-b border-gray-800 pb-3">
        Processing Status
      </h3>

      {/* Counters Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <div className="p-4 rounded-xl border border-gray-800 bg-gray-950/40">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Total Files</span>
          <p className="text-2xl font-bold text-gray-100 mt-1 glow-text">{totalFiles}</p>
        </div>

        {/* Processed */}
        <div className="p-4 rounded-xl border border-green-950 bg-green-950/5">
          <span className="text-[10px] uppercase tracking-wider text-green-500 font-semibold">Processed</span>
          <p className="text-2xl font-bold text-green-400 mt-1">{processed}</p>
        </div>

        {/* Failed */}
        <div className="p-4 rounded-xl border border-red-950 bg-red-950/5">
          <span className="text-[10px] uppercase tracking-wider text-red-500 font-semibold">Failed</span>
          <p className="text-2xl font-bold text-red-400 mt-1">{failed}</p>
        </div>

        {/* Remaining */}
        <div className="p-4 rounded-xl border border-blue-950 bg-blue-950/5">
          <span className="text-[10px] uppercase tracking-wider text-blue-500 font-semibold">Remaining</span>
          <p className="text-2xl font-bold text-blue-400 mt-1">{remaining}</p>
        </div>
      </div>

      {/* Progress Bar & Durations */}
      <div className="flex flex-col gap-3.5 p-4 rounded-xl border border-gray-800/40 bg-gray-950/20">
        <div className="flex justify-between items-center text-xs text-gray-400">
          <span>Batch Progress</span>
          <span className="font-semibold text-blue-400">{progressPercent}%</span>
        </div>

        {/* Overall progress bar */}
        <div className="w-full h-2.5 bg-gray-900 border border-gray-800/60 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-400 transition-all duration-500 blue-glow"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-4 mt-1 border-t border-gray-900 pt-3">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5 text-gray-500" />
            <span>Elapsed:</span>
            <span className="font-semibold text-gray-300 font-mono">{formatTime(elapsedTime)}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Hourglass className="w-3.5 h-3.5 text-gray-500" />
            <span>Remaining (Est):</span>
            <span className="font-semibold text-gray-300 font-mono">
              {processing && remaining > 0 ? formatTime(estimatedRemainingTime) : '--:--'}
            </span>
          </div>
        </div>
      </div>

      {/* Controls Footer */}
      <div className="flex flex-wrap gap-3 items-center justify-between mt-2 pt-4 border-t border-gray-800">
        <div className="flex gap-2">
          {/* Upload trigger */}
          <button
            onClick={onTriggerUpload}
            disabled={processing}
            className="flex items-center gap-2 px-4.5 py-2.5 rounded-xl border border-gray-800 bg-gray-900 text-gray-200 text-sm font-semibold hover:bg-gray-800/80 hover:text-white hover:border-gray-700 disabled:opacity-40 disabled:hover:bg-gray-900 active:scale-95 transition-all duration-200"
          >
            <Upload className="w-4 h-4" />
            <span>Upload</span>
          </button>

          {/* Clear All */}
          <button
            onClick={onClearAll}
            disabled={!hasFiles || processing}
            className="flex items-center gap-2 px-4.5 py-2.5 rounded-xl border border-gray-800 bg-gray-900/40 text-gray-400 text-sm font-semibold hover:bg-red-950/20 hover:text-red-400 hover:border-red-500/20 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-gray-400 active:scale-95 transition-all duration-200"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear All</span>
          </button>
        </div>

        <div className="flex gap-2.5">
          {/* Cancel */}
          {processing && (
            <button
              onClick={onCancel}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-500/20 bg-red-950/30 text-red-400 text-sm font-semibold hover:bg-red-950/50 hover:border-red-500/40 active:scale-95 transition-all duration-200"
            >
              <XCircle className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          )}

          {/* Process */}
          {!processing && (
            <button
              onClick={onProcess}
              disabled={!hasFiles}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 active:scale-95 disabled:opacity-40 disabled:hover:bg-blue-600 shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-200"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Process</span>
            </button>
          )}

          {/* Download Results */}
          {hasOutputs && !processing && (
            <a
              href={api.getZipDownloadUrl()}
              download
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-500 active:scale-95 shadow-lg shadow-green-500/10 hover:shadow-green-500/20 transition-all duration-200"
            >
              <Download className="w-4 h-4" />
              <span>Download Results</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
export default SummaryPanel;
