import React, { useState, useRef } from 'react';
import { Upload, FileCode, AlertCircle } from 'lucide-react';

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled: boolean;
  currentCount: number;
  currentSize: number;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFilesSelected,
  disabled,
  currentCount,
  currentSize,
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILES = 100;
  const MAX_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

  const validateAndAddFiles = (filesList: FileList) => {
    setError(null);
    const validFiles: File[] = [];
    let sizeSum = currentSize;
    let countSum = currentCount;

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const ext = file.name.split('.').pop()?.toLowerCase();

      // Check extension
      if (ext !== 'lsa' && ext !== 'lsav') {
        setError('Unsupported file type. Only .lsa and .lsav files are accepted.');
        return;
      }

      // Check individual size limit
      if (file.size > MAX_SIZE_BYTES) {
        setError(`File ${file.name} is too large. Max file size is 2 GB.`);
        return;
      }

      sizeSum += file.size;
      countSum += 1;

      if (countSum > MAX_FILES) {
        setError(`Maximum file limit of ${MAX_FILES} exceeded.`);
        return;
      }

      if (sizeSum > MAX_SIZE_BYTES) {
        setError(`Total size limit of 2 GB exceeded.`);
        return;
      }

      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;

    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (disabled) return;

    if (e.target.files && e.target.files[0]) {
      validateAndAddFiles(e.target.files);
    }
  };

  const triggerInput = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerInput}
        className={`relative w-full py-10 px-6 flex flex-col items-center justify-center border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 glass-card ${
          disabled
            ? 'opacity-40 cursor-not-allowed border-gray-800'
            : isDragActive
            ? 'border-blue-500 bg-blue-950/20 scale-[1.01] blue-glow'
            : 'border-gray-700 hover:border-blue-500/50 hover:bg-gray-900/30'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".lsa,.lsav"
          onChange={handleChange}
          disabled={disabled}
          className="hidden"
        />

        <div className={`p-4 rounded-full bg-blue-950/40 border border-blue-500/20 text-blue-400 mb-4 transition-all duration-300 ${
          isDragActive ? 'scale-110 text-blue-300 border-blue-500/40' : ''
        }`}>
          <Upload className="w-8 h-8 animate-pulse" />
        </div>

        <p className="text-lg font-medium text-gray-200 text-center mb-1">
          {isDragActive ? 'Drop your files here' : 'Drag & Drop files here, or click to browse'}
        </p>
        <p className="text-sm text-gray-400 text-center mb-6">
          Supports <span className="text-blue-400 font-semibold">.lsa</span> and <span className="text-blue-400 font-semibold">.lsav</span> files (up to 100 files, 2 GB total size)
        </p>

        <div className="flex gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900/60 border border-gray-800">
            <FileCode className="w-3.5 h-3.5" />
            <span>Files: {currentCount} / {MAX_FILES}</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-900/60 border border-gray-800">
            <FileCode className="w-3.5 h-3.5" />
            <span>Size: {(currentSize / (1024 * 1024)).toFixed(1)} MB / 2048 MB</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2.5 p-3.5 rounded-xl border border-red-500/20 bg-red-950/20 text-red-300 text-sm animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
export default UploadZone;
