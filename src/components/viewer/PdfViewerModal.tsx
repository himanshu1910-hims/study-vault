import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Headphones,
  Loader2,
  Maximize2,
  RotateCw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { FileItem } from '../../types';
import { formatBytes } from '../../utils/fileHelpers';

interface PdfViewerModalProps {
  file: FileItem | null;
  resolveBlob: (file: FileItem) => Promise<Blob>;
  onDownload: (file: FileItem) => Promise<void>;
  onSummarizeToAudio: (file: FileItem) => void;
  onClose: () => void;
}

export function PdfViewerModal({
  file,
  resolveBlob,
  onDownload,
  onSummarizeToAudio,
  onClose,
}: PdfViewerModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<unknown>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [zoom, setZoom] = useState(1.2);
  const [rotation, setRotation] = useState(0);
  const [docReadyTick, setDocReadyTick] = useState(0);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setPageNumber(1);
    setZoom(1.2);
    setRotation(0);

    (async () => {
      try {
        const blob = await resolveBlob(file);
        if (cancelled) return;
        const arrayBuffer = await blob.arrayBuffer();
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString();

        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
        const pdfDoc = await loadingTask.promise;
        if (cancelled) return;
        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages || 1);
        setDocReadyTick((n) => n + 1);
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Unable to render PDF document.');
        setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      pdfDocRef.current = null;
    };
  }, [file, resolveBlob]);

  useEffect(() => {
    if (!file || isLoading || error || !pdfDocRef.current || !canvasRef.current) return;
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfDoc = pdfDocRef.current as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let renderTask: any = null;

    (async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: zoom * dpr, rotation });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${Math.round(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.round(viewport.height / dpr)}px`;

        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch {
        // Ignore cancelled page render transitions
      }
    })();

    return () => {
      cancelled = true;
      if (renderTask?.cancel) {
        try {
          renderTask.cancel();
        } catch {
          // Ignore
        }
      }
    };
  }, [file, isLoading, error, pageNumber, zoom, rotation, docReadyTick]);

  if (!file) return null;

  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().catch(() => undefined);
    } else {
      document.exitFullscreen?.().catch(() => undefined);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 text-slate-100" ref={containerRef}>
      {/* Top Reader Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-slate-100">{file.name}</h2>
          <p className="text-xs text-slate-400 font-mono tabular-nums">
            PDF · {formatBytes(file.size)} · Page {pageNumber} of {numPages}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="px-2 text-xs font-mono tabular-nums text-slate-300 whitespace-nowrap">
            {pageNumber} / {numPages}
          </span>
          <button
            type="button"
            disabled={pageNumber >= numPages}
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="mx-1.5 h-5 w-px bg-slate-700" />

          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.2).toFixed(2))))}
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-200 hover:bg-slate-700"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1.2)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-200 hover:bg-slate-700 whitespace-nowrap"
            title="Reset Zoom"
          >
            {Math.round((zoom / 1.2) * 100)}%
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.6, Number((z + 0.2).toFixed(2))))}
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-200 hover:bg-slate-700"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-200 hover:bg-slate-700"
            title="Rotate 90° Clockwise"
          >
            <RotateCw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handleToggleFullscreen}
            className="rounded-lg border border-slate-700 bg-slate-800 p-2 text-slate-200 hover:bg-slate-700"
            title="Fullscreen Reader"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          <div className="mx-1.5 h-5 w-px bg-slate-700" />

          <button
            type="button"
            onClick={() => {
              onSummarizeToAudio(file);
              onClose();
            }}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap shrink-0"
          >
            <Headphones className="h-3.5 w-3.5" />
            Audio Summary
          </button>

          <button
            type="button"
            onClick={() => void onDownload(file)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            Download
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
            aria-label="Close PDF Reader"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Canvas Viewport */}
      <div className="flex-1 overflow-auto p-6 flex items-start justify-center bg-slate-950">
        {isLoading ? (
          <div className="my-auto flex flex-col items-center gap-3 text-slate-300">
            <Loader2 className="h-7 w-7 animate-spin text-blue-400" />
            <p className="text-sm">Loading PDF pages...</p>
          </div>
        ) : error ? (
          <div className="my-auto max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
            <p className="text-sm text-rose-400">{error}</p>
            <button
              type="button"
              onClick={() => void onDownload(file)}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Download Original PDF
            </button>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            className="rounded bg-white shadow-2xl transition-transform duration-150"
          />
        )}
      </div>
    </div>
  );
}
