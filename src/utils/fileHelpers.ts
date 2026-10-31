import { FileCategory, FolderColor, FolderItem } from '../types';

/**
 * Generates an ID strictly matching ^[a-zA-Z0-9_\-]+$ and <= 48 chars
 * to satisfy hardened Firestore security rules.
 */
export function generateSafeId(prefix = 'item'): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'id';
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 20)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `${cleanPrefix}_${rand}`.slice(0, 64);
}

/**
 * Normalizes root/index folder IDs strictly to empty string ""
 * so root folder checks never break due to null/undefined mismatches.
 */
export function normalizeFolderId(id?: string | null): string {
  if (!id) return '';
  const trimmed = id.trim();
  if (!trimmed || trimmed === 'root' || trimmed === 'index') return '';
  return trimmed.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
}

export function sanitizeString(value: unknown, maxLength: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLength);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, idx);
  return `${idx === 0 ? Math.round(value) : value.toFixed(1)} ${units[idx]}`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatShortDate(timestampMs: number): string {
  if (!timestampMs) return 'Just now';
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(timestampMs));
  } catch {
    return 'Recent';
  }
}

export function getExtensionFromName(fileName: string): string {
  const parts = fileName.trim().split('.');
  if (parts.length < 2) return '';
  return (parts.pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
}

export function inferMimeType(file: File): string {
  if (file.type && file.type.trim()) return file.type.slice(0, 120);
  const ext = getExtensionFromName(file.name);
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    txt: 'text/plain',
    md: 'text/markdown',
    csv: 'text/csv',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    wav: 'audio/wav',
    mp3: 'audio/mpeg',
  };
  return map[ext] || 'application/octet-stream';
}

export function getFileCategory(mimeType: string, extension: string): FileCategory {
  const ext = extension.toLowerCase();
  const mime = mimeType.toLowerCase();
  if (ext === 'pdf' || mime.includes('pdf')) return 'pdf';
  if (['doc', 'docx', 'rtf'].includes(ext) || mime.includes('word')) return 'doc';
  if (['ppt', 'pptx'].includes(ext) || mime.includes('presentation') || mime.includes('powerpoint')) return 'slide';
  if (['xls', 'xlsx', 'csv'].includes(ext) || mime.includes('spreadsheet') || mime.includes('excel')) return 'sheet';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || mime.startsWith('image/')) return 'image';
  if (['wav', 'mp3', 'm4a', 'ogg'].includes(ext) || mime.startsWith('audio/')) return 'audio';
  if (['txt', 'md', 'json', 'html'].includes(ext) || mime.startsWith('text/')) return 'text';
  return 'other';
}

export interface BreadcrumbNode {
  id: string;
  name: string;
}

/**
 * Cycle-safe breadcrumb builder from root ("My Library") down to currentFolderId.
 */
export function getBreadcrumbTrail(folders: FolderItem[], currentFolderId: string): BreadcrumbNode[] {
  const normalizedTarget = normalizeFolderId(currentFolderId);
  const rootCrumb: BreadcrumbNode = { id: '', name: 'My Library' };
  if (!normalizedTarget) return [rootCrumb];

  const byId = new Map<string, FolderItem>();
  for (const f of folders) {
    if (!f.isTrash) byId.set(f.id, f);
  }

  const chain: BreadcrumbNode[] = [];
  const visited = new Set<string>();
  let cursorId = normalizedTarget;

  while (cursorId && !visited.has(cursorId)) {
    visited.add(cursorId);
    const folder = byId.get(cursorId);
    if (!folder) break;
    chain.unshift({ id: folder.id, name: folder.name });
    cursorId = normalizeFolderId(folder.parentId);
  }

  return [rootCrumb, ...chain];
}

/**
 * Checks if candidateParentId is folderId itself or a descendant of folderId,
 * preventing circular folder moves.
 */
export function isDescendantOrSelf(
  folders: FolderItem[],
  folderId: string,
  candidateParentId: string
): boolean {
  const normFolder = normalizeFolderId(folderId);
  const normCandidate = normalizeFolderId(candidateParentId);
  if (!normCandidate) return false;
  if (normFolder === normCandidate) return true;

  const byId = new Map(folders.map((f) => [f.id, f]));
  const visited = new Set<string>();
  let cursor = normCandidate;

  while (cursor && !visited.has(cursor)) {
    visited.add(cursor);
    if (cursor === normFolder) return true;
    const node = byId.get(cursor);
    cursor = node ? normalizeFolderId(node.parentId) : '';
  }

  return false;
}

/**
 * Converts an ArrayBuffer to clean base64 slices (~600KB each) safely below Firestore's 1MB limit.
 */
export function arrayBufferToBase64Chunks(buffer: ArrayBuffer, maxCharsPerChunk = 580000): string[] {
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) return [''];

  // Must align binary slice size to multiple of 3 bytes so each chunk is valid standalone base64
  const bytesPerChunk = Math.floor((maxCharsPerChunk * 3) / 4 / 3) * 3;
  const chunks: string[] = [];

  for (let offset = 0; offset < bytes.length; offset += bytesPerChunk) {
    const slice = bytes.subarray(offset, Math.min(offset + bytesPerChunk, bytes.length));
    let binary = '';
    const step = 0x8000;
    for (let i = 0; i < slice.length; i += step) {
      binary += String.fromCharCode(...slice.subarray(i, i + step));
    }
    chunks.push(btoa(binary));
  }

  return chunks;
}

export function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export function reassembleChunksToBlob(base64Chunks: string[], mimeType: string): Blob {
  const parts: BlobPart[] = base64Chunks.map((b64) => {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      arr[i] = bin.charCodeAt(i);
    }
    return arr;
  });
  return new Blob(parts, { type: mimeType });
}

/**
 * Extracts plain text from uploaded TXT, MD, CSV, JSON, HTML, and PDF files
 * so they are searchable and ready for 1-click Commute Audio Summary generation.
 */
export async function extractReadableTextFromFile(file: File, maxChars = 24000): Promise<string> {
  const ext = getExtensionFromName(file.name);
  const mime = inferMimeType(file);

  try {
    if (
      ['txt', 'md', 'csv', 'json', 'html'].includes(ext) ||
      mime.startsWith('text/')
    ) {
      const raw = await file.text();
      return raw.replace(/\0/g, '').trim().slice(0, maxChars);
    }

    if (ext === 'pdf' || mime.includes('pdf')) {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString();

      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      const maxPages = Math.min(pdf.numPages, 25);
      const pageTexts: string[] = [];
      let totalLen = 0;

      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        const strings = content.items
          .map((item) => ('str' in item ? item.str : ''))
          .filter(Boolean);
        const joined = strings.join(' ').replace(/\s+/g, ' ').trim();
        if (joined) {
          pageTexts.push(joined);
          totalLen += joined.length;
        }
        if (totalLen >= maxChars) break;
      }

      return pageTexts.join('\n\n').slice(0, maxChars);
    }
  } catch (err) {
    console.warn('Text extraction skipped for', file.name, err);
  }

  return '';
}

export const FOLDER_COLOR_CLASSES: Record<
  FolderColor,
  { icon: string; swatch: string; label: string }
> = {
  blue: {
    icon: 'text-blue-600 dark:text-blue-400',
    swatch: 'bg-blue-600',
    label: 'Ocean Blue',
  },
  emerald: {
    icon: 'text-emerald-600 dark:text-emerald-400',
    swatch: 'bg-emerald-600',
    label: 'Emerald',
  },
  amber: {
    icon: 'text-amber-600 dark:text-amber-400',
    swatch: 'bg-amber-500',
    label: 'Amber',
  },
  rose: {
    icon: 'text-rose-600 dark:text-rose-400',
    swatch: 'bg-rose-600',
    label: 'Crimson Rose',
  },
  violet: {
    icon: 'text-violet-600 dark:text-violet-400',
    swatch: 'bg-violet-600',
    label: 'Indigo Violet',
  },
  slate: {
    icon: 'text-slate-600 dark:text-slate-400',
    swatch: 'bg-slate-600',
    label: 'Slate',
  },
};
