import React, { useState, useEffect } from 'react';
import { FileRecord } from '../../../shared/types.js';
import { X, Copy, Check, Download, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../services/api.js';

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: FileRecord[]; // Completed files that can be previewed
  initialFileId: string | null;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  onClose,
  files,
  initialFileId,
}) => {
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  // Sync initial file ID
  useEffect(() => {
    if (initialFileId) {
      setActiveFileId(initialFileId);
    } else if (files.length > 0) {
      setActiveFileId(files[0].id);
    }
  }, [initialFileId, files]);

  // Load preview when active file changes
  useEffect(() => {
    if (!activeFileId || !isOpen) return;

    const activeFile = files.find(f => f.id === activeFileId);
    if (!activeFile || !activeFile.outputName) return;

    // Check if it is a media file to skip fetching text
    const ext = activeFile.outputName.split('.').pop()?.toLowerCase() || '';
    const isMedia = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'mp4', 'mov', 'avi', 'mkv', 'webm', 'pdf'].includes(ext);

    if (isMedia) {
      return; // Handled directly by browser media components
    }

    if (previews[activeFileId] || loading[activeFileId] || errors[activeFileId]) return;

    const fetchPreview = async () => {
      setLoading(prev => ({ ...prev, [activeFileId]: true }));
      try {
        const text = await api.getPreview(activeFileId);
        setPreviews(prev => ({ ...prev, [activeFileId]: text }));
      } catch (err: any) {
        setErrors(prev => ({ ...prev, [activeFileId]: err.message || 'Failed to load preview.' }));
      } finally {
        setLoading(prev => ({ ...prev, [activeFileId]: false }));
      }
    };

    fetchPreview();
  }, [activeFileId, isOpen, files, previews, loading, errors]);

  if (!isOpen || !activeFileId) return null;

  const activeFile = files.find(f => f.id === activeFileId);
  const content = previews[activeFileId] || '';
  const isLoading = loading[activeFileId];
  const error = errors[activeFileId];

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isMulti = files.length > 1;

  // Determine media classifications
  const ext = activeFile?.outputName?.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext);
  const isVideo = ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext);
  const isPdf = ext === 'pdf';
  const isMediaFile = isImage || isVideo || isPdf;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-sm animate-fade-in animate-duration-150">
      <div className="relative w-full max-w-5xl h-[80vh] flex flex-col rounded-2xl border border-gray-800 bg-gray-950/95 shadow-2xl overflow-hidden glass-panel">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-900 shrink-0">
          <div>
            <h3 className="text-base font-bold text-gray-100">
              {isMulti ? 'Results Dashboard Preview' : 'File Preview'}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeFile?.name || 'Loading...'}
            </p>
          </div>
          
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-gray-900 border border-transparent hover:border-gray-800 transition-all duration-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Workspace: Sidebar + Viewer */}
        <div className="flex-1 min-h-0 flex">
          {/* Left Sidebar (Only visible if multi-file previewing) */}
          {isMulti && (
            <div className="w-64 border-r border-gray-900 overflow-y-auto bg-gray-950/50 shrink-0 hidden md:block">
              <div className="p-3 text-[10px] uppercase font-bold tracking-wider text-gray-500 border-b border-gray-900">
                Completed Results ({files.length})
              </div>
              <div className="p-2 flex flex-col gap-1">
                {files.map((file) => {
                  const isActive = file.id === activeFileId;
                  return (
                    <button
                      key={file.id}
                      onClick={() => setActiveFileId(file.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold truncate transition-all duration-200 ${
                        isActive
                          ? 'bg-blue-600/10 border border-blue-500/20 text-blue-400'
                          : 'text-gray-400 border border-transparent hover:bg-gray-900/50 hover:text-gray-200'
                      }`}
                    >
                      {file.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Right Viewer */}
          <div className="flex-1 flex flex-col min-w-0 bg-gray-950/30">
            {/* Viewer Action Bar */}
            <div className="flex justify-between items-center px-6 py-2 border-b border-gray-900/60 text-xs shrink-0">
              <div className="text-gray-500 font-mono">
                {ext.toUpperCase()} file • {isMediaFile ? 'Media Stream' : `${content.length} characters`}
              </div>
              
              <div className="flex gap-2">
                {!isMediaFile && (
                  <button
                    onClick={handleCopy}
                    disabled={!content || isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-800 bg-gray-900 text-gray-300 font-semibold hover:bg-gray-800 hover:text-white disabled:opacity-40 transition-all duration-200"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-green-400" />
                        <span className="text-green-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}

                <a
                  href={api.getDownloadUrl(activeFileId)}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-800 bg-gray-900 text-gray-300 font-semibold hover:bg-gray-800 hover:text-white transition-all duration-200"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              </div>
            </div>

            {/* Code Content */}
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center font-mono text-xs leading-relaxed text-gray-300 select-text">
              {isImage ? (
                <div className="w-full h-full flex items-center justify-center">
                  <img
                    key={activeFileId}
                    src={`/api/preview/${api.getSessionId()}/${activeFileId}`}
                    alt={activeFile?.name}
                    className="max-h-[60vh] max-w-full object-contain rounded-lg border border-gray-900 shadow-2xl animate-fade-in"
                  />
                </div>
              ) : isVideo ? (
                <div className="w-full h-full flex items-center justify-center">
                  <video
                    key={activeFileId}
                    src={`/api/preview/${api.getSessionId()}/${activeFileId}`}
                    controls
                    className="max-h-[60vh] max-w-full rounded-lg border border-gray-900 shadow-2xl bg-black animate-fade-in"
                  />
                </div>
              ) : isPdf ? (
                <iframe
                  key={activeFileId}
                  src={`/api/preview/${api.getSessionId()}/${activeFileId}`}
                  className="w-full h-[60vh] rounded-lg border border-gray-900 shadow-2xl bg-white animate-fade-in"
                />
              ) : isLoading ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3.5 text-gray-500">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span>Reading processed output...</span>
                </div>
              ) : error ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3.5 text-red-400">
                  <AlertCircle className="w-8 h-8" />
                  <span>{error}</span>
                </div>
              ) : (
                <pre className="w-full h-full whitespace-pre-wrap text-left align-top">{content}</pre>
              )}
            </div>
          </div>
        </div>

        {/* Small Screen Tab List */}
        {isMulti && (
          <div className="border-t border-gray-900 overflow-x-auto py-2.5 px-4 flex gap-2 md:hidden bg-gray-950 shrink-0">
            {files.map((file) => {
              const isActive = file.id === activeFileId;
              return (
                <button
                  key={file.id}
                  onClick={() => setActiveFileId(file.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap border shrink-0 transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600/10 border-blue-500/20 text-blue-400'
                      : 'text-gray-400 border-transparent hover:bg-gray-900 hover:text-gray-200'
                  }`}
                >
                  {file.name}
                </button>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
};
export default PreviewModal;
