import React, { useRef, useState } from 'react';
import { CheckCircle2, FileUp, Trash2, UploadCloud, X } from 'lucide-react';
import { FolderItem, UploadTask } from '../../types';
import { formatBytes, normalizeFolderId } from '../../utils/fileHelpers';

interface UploadModalProps {
  isOpen: boolean;
  initialFolderId: string;
  folders: FolderItem[];
  uploadTasks: UploadTask[];
  onClose: () => void;
  onUpload: (files: File[], targetFolderId: string) => Promise<void>;
}

export function UploadModal({
  isOpen,
  initialFolderId,
  folders,
  uploadTasks,
  onClose,
  onUpload,
}: UploadModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [targetFolderId, setTargetFolderId] = useState<string>(normalizeFolderId(initialFolderId));
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setTargetFolderId(normalizeFolderId(initialFolderId));
      setSelectedFiles([]);
    }
  }, [isOpen, initialFolderId]);

  if (!isOpen) return null;

  const activeFolders = folders.filter((f) => !f.isTrash);

  const addFiles = (incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    setSelectedFiles((prev) => [...prev, ...arr]);
  };

  const removeQueued = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleStartUpload = async () => {
    if (selectedFiles.length === 0) return;
    setIsUploading(true);
    try {
      const batch = [...selectedFiles];
      setSelectedFiles([]);
      await onUpload(batch, normalizeFolderId(targetFolderId));
      onClose();
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <FileUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Upload Study Notes &amp; Articles
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Save to Folder
            </label>
            <select
              value={targetFolderId}
              onChange={(e) => setTargetFolderId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-600 focus:outline-none"
            >
              <option value="">My Library (Root Index)</option>
              {activeFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.length) {
                addFiles(e.dataTransfer.files);
              }
            }}
            onClick={() => inputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-7 text-center transition-colors ${
              isDragging
                ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/30'
                : 'border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-slate-50/60 dark:bg-slate-950/40'
            }`}
          >
            <UploadCloud className="mx-auto h-9 w-9 text-blue-600 dark:text-blue-400" />
            <p className="mt-2.5 text-sm font-medium text-slate-900 dark:text-slate-100">
              Drop PDFs, Notes, Docs, Slides, or Images here
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Supports PDF · DOCX · PPTX · XLSX · TXT · MD · PNG · JPG (up to 50 MB each)
            </p>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.wav,.mp3"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) {
                  addFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="max-h-44 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-800">
              {selectedFiles.map((file, idx) => (
                <div
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between px-3.5 py-2 text-xs"
                >
                  <div className="min-w-0 pr-3">
                    <p className="truncate font-medium text-slate-900 dark:text-slate-100">
                      {file.name}
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      {formatBytes(file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeQueued(idx)}
                    className="rounded p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                    aria-label="Remove file"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploadTasks.some((t) => t.status === 'uploading') && (
            <div className="space-y-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
              {uploadTasks
                .filter((t) => t.status === 'uploading')
                .map((task) => (
                  <div key={task.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                        {task.fileName}
                      </span>
                      <span className="font-mono tabular-nums text-blue-600 dark:text-blue-400">
                        {task.progress}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full bg-blue-600 transition-all duration-150"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            PDF text auto-indexed for AI audio summaries
          </span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={selectedFiles.length === 0 || isUploading}
              onClick={handleStartUpload}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {isUploading
                ? 'Uploading...'
                : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
