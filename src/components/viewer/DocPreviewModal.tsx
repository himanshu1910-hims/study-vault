import React, { useEffect, useState } from 'react';
import {
  Download,
  FileText,
  Headphones,
  Loader2,
  RotateCw,
  Volume2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { FileItem } from '../../types';
import { formatBytes, getFileCategory } from '../../utils/fileHelpers';

interface DocPreviewModalProps {
  file: FileItem | null;
  resolveBlob: (file: FileItem) => Promise<Blob>;
  onDownload: (file: FileItem) => Promise<void>;
  onSummarizeToAudio: (file: FileItem) => void;
  onReadAloudDirect: (title: string, text: string) => Promise<void>;
  onClose: () => void;
}

export function DocPreviewModal({
  file,
  resolveBlob,
  onDownload,
  onSummarizeToAudio,
  onReadAloudDirect,
  onClose,
}: DocPreviewModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSynthesizingTts, setIsSynthesizingTts] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let createdUrl: string | null = null;
    setIsLoading(true);
    setBlobUrl(null);
    setTextContent(file.textExcerpt || '');
    setZoom(1);
    setRotation(0);

    (async () => {
      try {
        const blob = await resolveBlob(file);
        if (cancelled) return;
        const cat = getFileCategory(file.mimeType, file.extension);
        if (cat === 'image' || cat === 'audio') {
          createdUrl = URL.createObjectURL(blob);
          setBlobUrl(createdUrl);
        } else if (cat === 'text') {
          const fullText = await blob.text();
          if (!cancelled) setTextContent(fullText);
        }
      } catch {
        // Fallback to textExcerpt if available
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [file, resolveBlob]);

  if (!file) return null;

  const category = getFileCategory(file.mimeType, file.extension);

  const handleDirectSpeak = async () => {
    const speakable = textContent || file.textExcerpt;
    if (!speakable) return;
    setIsSynthesizingTts(true);
    try {
      await onReadAloudDirect(file.name, speakable.slice(0, 5000));
    } finally {
      setIsSynthesizingTts(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {file.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {(file.extension || 'FILE').toUpperCase()} · {formatBytes(file.size)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {category === 'image' && (
              <>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Rotate"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              </>
            )}

            {(textContent || file.textExcerpt) && (
              <>
                <button
                  type="button"
                  disabled={isSynthesizingTts}
                  onClick={() => void handleDirectSpeak()}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {isSynthesizingTts ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Volume2 className="h-3.5 w-3.5" />
                  )}
                  Read Aloud (TTS)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSummarizeToAudio(file);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
                >
                  <Headphones className="h-3.5 w-3.5" />
                  Commute Summary
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => void onDownload(file)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close Preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950 p-6">
          {isLoading ? (
            <div className="flex h-full items-center justify-center gap-2.5 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              Loading document preview...
            </div>
          ) : category === 'image' && blobUrl ? (
            <div className="flex min-h-full items-center justify-center overflow-auto">
              <img
                src={blobUrl}
                alt={file.name}
                referrerPolicy="no-referrer"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
                className="max-h-[70vh] rounded-lg object-contain shadow-md transition-transform duration-150"
              />
            </div>
          ) : category === 'audio' && blobUrl ? (
            <div className="flex h-full flex-col items-center justify-center gap-5">
              <Headphones className="h-12 w-12 text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{file.name}</p>
              <audio controls src={blobUrl} className="w-full max-w-md" />
            </div>
          ) : textContent ? (
            <pre className="mx-auto max-w-3xl whitespace-pre-wrap rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 font-sans text-sm leading-relaxed text-slate-800 dark:text-slate-200">
              {textContent}
            </pre>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <FileText className="h-12 w-12 text-slate-400" />
              <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
                {file.name}
              </h3>
              <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                This {(file.extension || 'document').toUpperCase()} file is safely stored in your
                StudyVault library. Download it to open in Microsoft Office or your desktop reader.
              </p>
              <button
                type="button"
                onClick={() => void onDownload(file)}
                className="mt-4 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Download className="h-4 w-4" />
                Download Original File
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
