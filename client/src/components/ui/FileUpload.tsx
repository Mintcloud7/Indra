import React, { useRef } from 'react';
import { Upload, File, X } from 'lucide-react';
import Button from './Button';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  label?: string;
  file?: File | null;
  onRemove?: () => void;
  loading?: boolean;
}

export default function FileUpload({
  onFileSelect,
  accept = '*',
  label = 'Upload file',
  file,
  onRemove,
  loading = false,
}: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  if (file) {
    return (
      <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
        <File className="h-5 w-5 text-slate-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
          <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-1 text-slate-400 hover:text-red-600 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
      <div
        onClick={loading ? undefined : handleClick}
        className={`border-2 border-dashed border-slate-300 rounded-lg p-6 text-center transition-colors ${
          loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-400 hover:bg-blue-50'
        }`}
      >
        <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
        <p className="text-sm text-slate-600 mb-1">{loading ? 'Uploading...' : label}</p>
        {!loading && <p className="text-xs text-slate-400">Click to browse</p>}
      </div>
    </div>
  );
}
