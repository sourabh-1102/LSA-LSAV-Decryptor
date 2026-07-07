import React from 'react';
import { FileRecord } from '../../../shared/types.js';
import { File, Trash2, Eye, Download, Play, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../services/api.js';

interface FileListProps {
  files: FileRecord[];
  onRemoveFile: (fileId: string) => void;
  onPreviewFile: (fileId: string) => void;
  onPreviewAll: () => void;
  processing: boolean;
}

// Utility to format sizes
const formatBytes = (bytes: number, decimals = 1) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const FileList: React.FC<FileListProps> = ({
  files,
  onRemoveFile,
  onPreviewFile,
  onPreviewAll,
  processing,
}) => {
  const completedFiles = files.filter(f => f.status === 'Completed');

  const getStatusColor = (status: FileRecord['status']) => {
    switch (status) {
      case 'Queued':
        return 'text-gray-400 border-gray-700 bg-gray-900/40';
      case 'Reading':
        return 'text-cyan-400 border-cyan-800 bg-cyan-950/20 animate-pulse';
      case 'Processing':
        return 'text-blue-400 border-blue-800 bg-blue-950/20';
      case 'Completed':
        return 'text-green-400 border-green-800 bg-green-950/20';
      case 'Failed':
        return 'text-red-400 border-red-800 bg-red-950/20';
      case 'Skipped':
        return 'text-yellow-400 border-yellow-800 bg-yellow-950/20';
      default:
        return 'text-gray-400 border-gray-700 bg-gray-900/40';
    }
  };

  const getStatusIcon = (status: FileRecord['status']) => {
    switch (status) {
      case 'Queued':
        return <Play className="w-3.5 h-3.5" />;
      case 'Reading':
      case 'Processing':
        return <RefreshCw className="w-3.5 h-3.5 animate-spin" />;
      case 'Completed':
        return <CheckCircle className="w-3.5 h-3.5" />;
      case 'Failed':
        return <XCircle className="w-3.5 h-3.5" />;
      case 'Skipped':
        return <AlertCircle className="w-3.5 h-3.5" />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex justify-between items-center px-1">
        <h2 className="text-xl font-semibold text-gray-200 flex items-center gap-2">
          <File className="w-5 h-5 text-blue-500" />
          <span>Files Queue ({files.length})</span>
        </h2>
        {completedFiles.length > 0 && (
          <button
            onClick={onPreviewAll}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl text-blue-400 border border-blue-500/20 bg-blue-950/30 hover:bg-blue-950/50 hover:border-blue-500/40 active:scale-95 transition-all duration-200"
          >
            <Eye className="w-4 h-4" />
            <span>Preview All ({completedFiles.length})</span>
          </button>
        )}
      </div>

      {files.length === 0 ? (
        <div className="w-full py-12 px-4 border border-gray-800/40 rounded-2xl glass-card text-center text-gray-400 flex flex-col items-center justify-center gap-3">
          <File className="w-10 h-10 text-gray-600 animate-bounce" />
          <p className="text-sm">No files uploaded yet. Drag and drop files above to start.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[500px] overflow-y-auto pr-1">
          {files.map((file) => {
            const isDone = file.status === 'Completed';
            const isFailed = file.status === 'Failed';
            const isProcessing = file.status === 'Processing' || file.status === 'Reading';
            const showPreviewAndDownload = isDone;

            return (
              <div
                key={file.id}
                className={`relative flex flex-col p-4 rounded-2xl border transition-all duration-300 glass-card ${
                  isProcessing ? 'border-blue-500/30 bg-blue-950/5' : 'border-gray-800/60'
                }`}
              >
                {/* Header */}
                <div className="flex justify-between items-start gap-2.5 mb-2.5">
                  <div className="flex gap-2.5 min-w-0">
                    <div className="p-2.5 rounded-xl bg-gray-900 border border-gray-800 text-blue-400 shrink-0">
                      <File className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-gray-200 truncate" title={file.name}>
                        {file.name}
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatBytes(file.size)} • <span className="uppercase text-blue-400 font-medium">{file.extension}</span>
                      </p>
                    </div>
                  </div>

                  {/* Actions (Pre-processing delete or post-processing view) */}
                  <div className="flex gap-1.5 shrink-0">
                    {showPreviewAndDownload && (
                      <>
                        <button
                          onClick={() => onPreviewFile(file.id)}
                          className="p-1.5 text-gray-400 hover:text-blue-400 bg-gray-900/60 border border-gray-800 hover:border-blue-500/30 rounded-lg transition-colors duration-200"
                          title="Preview Output"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <a
                          href={api.getDownloadUrl(file.id)}
                          download
                          className="p-1.5 text-gray-400 hover:text-green-400 bg-gray-900/60 border border-gray-800 hover:border-green-500/30 rounded-lg transition-colors duration-200"
                          title="Download Output"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      </>
                    )}

                    {!processing && file.status === 'Queued' && (
                      <button
                        onClick={() => onRemoveFile(file.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 bg-gray-900/60 border border-gray-800 hover:border-red-500/30 rounded-lg transition-colors duration-200"
                        title="Remove File"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Info and Progress Bar */}
                <div className="mt-auto flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-semibold tracking-wide ${getStatusColor(file.status)}`}>
                      {getStatusIcon(file.status)}
                      <span className="capitalize">{file.status}</span>
                    </span>

                    {/* Show time elapsed or error */}
                    {file.processingTime !== undefined && (isDone || isFailed) && (
                      <span className="text-[10px] text-gray-500 font-medium">
                        {(file.processingTime / 1000).toFixed(2)}s
                      </span>
                    )}
                  </div>

                  {/* Progress Bar Container */}
                  <div className="w-full h-1.5 bg-gray-900 border border-gray-800/40 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isFailed
                          ? 'bg-red-500'
                          : file.status === 'Skipped'
                          ? 'bg-yellow-500'
                          : file.status === 'Completed'
                          ? 'bg-green-500'
                          : 'bg-gradient-to-r from-blue-600 to-cyan-500'
                      }`}
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>

                  {isFailed && file.error && (
                    <div className="text-[10px] text-red-400/90 leading-normal truncate" title={file.error}>
                      Error: {file.error}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
export default FileList;
