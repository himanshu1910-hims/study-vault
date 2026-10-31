export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export type FolderColor = 'slate' | 'blue' | 'emerald' | 'amber' | 'rose' | 'violet';

export interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  photoURL: string;
  totalStorageUsed: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface FolderItem {
  id: string;
  userId: string;
  name: string;
  /** Always "" for root ("My Library" index folder), or a valid parent folder ID */
  parentId: string;
  color: FolderColor;
  isFavorite: boolean;
  isTrash: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface FileItem {
  id: string;
  userId: string;
  /** Always "" for root ("My Library" index folder), or a valid parent folder ID */
  folderId: string;
  name: string;
  originalName: string;
  size: number;
  mimeType: string;
  extension: string;
  chunkCount: number;
  textExcerpt: string;
  isFavorite: boolean;
  isTrash: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface AudioBriefing {
  id: string;
  userId: string;
  folderId: string;
  title: string;
  sourceTitle: string;
  mode: 'podcast' | 'single';
  voiceInfo: string;
  language: string;
  durationSeconds: number;
  summaryText: string;
  keyTakeaways: string[];
  scriptText: string;
  audioFileId: string;
  isFavorite: boolean;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface UploadTask {
  id: string;
  fileName: string;
  size: number;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  errorMessage?: string;
}

export type ViewSection =
  | 'dashboard'
  | 'library'
  | 'commute'
  | 'favorites'
  | 'trash'
  | 'settings';

export type FileCategory = 'pdf' | 'doc' | 'slide' | 'sheet' | 'image' | 'audio' | 'text' | 'other';
