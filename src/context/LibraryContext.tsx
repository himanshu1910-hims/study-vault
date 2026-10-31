import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import {
  deleteCachedBlob,
  getCachedBlob,
  loadLocalLibrarySnapshot,
  saveCachedBlob,
  saveLocalLibrarySnapshot,
} from '../lib/localBlobStore';
import {
  AudioBriefing,
  FileItem,
  FolderColor,
  FolderItem,
  OperationType,
  UploadTask,
  ViewSection,
} from '../types';
import {
  arrayBufferToBase64Chunks,
  base64ToBlob,
  extractReadableTextFromFile,
  generateSafeId,
  getExtensionFromName,
  inferMimeType,
  isDescendantOrSelf,
  normalizeFolderId,
  reassembleChunksToBlob,
  sanitizeString,
} from '../utils/fileHelpers';
import { useAuth } from './AuthContext';

function parseTimestampMs(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }
  if (val && typeof val === 'object' && 'seconds' in val) {
    return Number((val as { seconds: number }).seconds) * 1000;
  }
  return Date.now();
}

export interface SaveBriefingInput {
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
  audioBase64: string;
}

export interface BackupArchivePayload {
  version: number;
  exportedAt: string;
  folders: FolderItem[];
  files: FileItem[];
  briefings: AudioBriefing[];
}

interface LibraryContextValue {
  folders: FolderItem[];
  files: FileItem[];
  briefings: AudioBriefing[];
  activeSection: ViewSection;
  setActiveSection: (section: ViewSection) => void;
  currentFolderId: string;
  openFolder: (folderId?: string | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isLoadingLibrary: boolean;
  isCloudSynced: boolean;
  hasUnsyncedLocalData: boolean;
  isSyncingLocalToCloud: boolean;
  syncLocalDataToCloud: () => Promise<number>;
  uploadTasks: UploadTask[];
  dismissUploadTasks: () => void;
  toastMessage: { text: string; tone: 'success' | 'error' | 'info' } | null;
  notify: (text: string, tone?: 'success' | 'error' | 'info') => void;
  createFolder: (name: string, parentId?: string | null, color?: FolderColor) => Promise<FolderItem>;
  renameFolder: (folderId: string, newName: string, newColor?: FolderColor) => Promise<void>;
  moveFolder: (folderId: string, targetParentId: string) => Promise<void>;
  toggleFolderFavorite: (folderId: string) => Promise<void>;
  trashFolder: (folderId: string) => Promise<void>;
  restoreFolder: (folderId: string) => Promise<void>;
  permanentlyDeleteFolder: (folderId: string) => Promise<void>;
  uploadFiles: (fileList: File[] | FileList, targetFolderId?: string | null) => Promise<void>;
  renameFile: (fileId: string, newName: string) => Promise<void>;
  moveFiles: (fileIds: string[], targetFolderId: string) => Promise<void>;
  toggleFileFavorite: (fileId: string) => Promise<void>;
  trashFiles: (fileIds: string[]) => Promise<void>;
  restoreFile: (fileId: string) => Promise<void>;
  permanentlyDeleteFile: (fileId: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  resolveFileBlob: (file: FileItem) => Promise<Blob>;
  downloadFile: (file: FileItem) => Promise<void>;
  saveGeneratedBriefing: (input: SaveBriefingInput) => Promise<{ briefing: AudioBriefing; audioBlob: Blob }>;
  toggleBriefingFavorite: (briefingId: string) => Promise<void>;
  deleteBriefing: (briefingId: string) => Promise<void>;
  exportLibraryBackup: () => BackupArchivePayload;
  restoreLibraryBackup: (archive: BackupArchivePayload) => Promise<{ foldersRestored: number; filesRestored: number }>;
  totalStorageUsedBytes: number;
}

const LibraryContext = createContext<LibraryContextValue | undefined>(undefined);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthReady } = useAuth();
  const isCloudMode = Boolean(user && user.emailVerified);

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [briefings, setBriefings] = useState<AudioBriefing[]>([]);
  const [activeSection, setActiveSection] = useState<ViewSection>('dashboard');
  const [currentFolderId, setCurrentFolderId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoadingLibrary, setIsLoadingLibrary] = useState<boolean>(true);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [hasUnsyncedLocalData, setHasUnsyncedLocalData] = useState<boolean>(false);
  const [isSyncingLocalToCloud, setIsSyncingLocalToCloud] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    tone: 'success' | 'error' | 'info';
  } | null>(null);

  const notify = useCallback((text: string, tone: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, tone });
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Navigate cleanly into root ("Index" = "") or any valid subfolder
  const openFolder = useCallback((folderId?: string | null) => {
    const normalized = normalizeFolderId(folderId);
    setCurrentFolderId(normalized);
    setActiveSection('library');
  }, []);

  // Ensure if currentFolderId ever points to a deleted/trashed folder, we safely fall back to root ""
  useEffect(() => {
    if (!currentFolderId) return;
    if (isLoadingLibrary) return;
    const existsActive = folders.some((f) => f.id === currentFolderId && !f.isTrash);
    if (!existsActive) {
      setCurrentFolderId('');
    }
  }, [currentFolderId, folders, isLoadingLibrary]);

  // Attach Firestore real-time listeners when authenticated, or load fast IndexedDB snapshot in local mode
  useEffect(() => {
    if (!isAuthReady) return;

    if (!isCloudMode || !user) {
      let cancelled = false;
      setIsLoadingLibrary(true);
      loadLocalLibrarySnapshot().then((snap) => {
        if (cancelled) return;
        setFolders(snap.folders);
        setFiles(snap.files);
        setBriefings(snap.briefings);
        setHasUnsyncedLocalData(false);
        setIsLoadingLibrary(false);
      });
      return () => {
        cancelled = true;
      };
    }

    setIsLoadingLibrary(true);

    // Check if there are local guest items that can be synced to Firebase
    loadLocalLibrarySnapshot().then((snap) => {
      const count = snap.folders.length + snap.files.length + snap.briefings.length;
      setHasUnsyncedLocalData(count > 0);
    });

    const uid = user.uid;
    let foldersLoaded = false;
    let filesLoaded = false;

    const markReadyIfBoth = () => {
      if (foldersLoaded && filesLoaded) {
        setIsLoadingLibrary(false);
      }
    };

    const foldersQuery = query(collection(db, 'folders'), where('userId', '==', uid));
    const unsubFolders = onSnapshot(
      foldersQuery,
      (snapshot) => {
        const list: FolderItem[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId || uid),
            name: String(data.name || 'Untitled Folder'),
            parentId: normalizeFolderId(data.parentId),
            color: (['slate', 'blue', 'emerald', 'amber', 'rose', 'violet'].includes(data.color)
              ? data.color
              : 'blue') as FolderColor,
            isFavorite: Boolean(data.isFavorite),
            isTrash: Boolean(data.isTrash),
            createdAtMs: parseTimestampMs(data.createdAt),
            updatedAtMs: parseTimestampMs(data.updatedAt),
          };
        });
        list.sort((a, b) => a.name.localeCompare(b.name));
        setFolders(list);
        foldersLoaded = true;
        markReadyIfBoth();
      },
      (error) => {
        setIsLoadingLibrary(false);
        try {
          handleFirestoreError(error, OperationType.LIST, 'folders');
        } catch {
          notify('Unable to sync folders from Firebase.', 'error');
        }
      }
    );

    const filesQuery = query(collection(db, 'files'), where('userId', '==', uid));
    const unsubFiles = onSnapshot(
      filesQuery,
      (snapshot) => {
        const list: FileItem[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId || uid),
            folderId: normalizeFolderId(data.folderId),
            name: String(data.name || 'Document'),
            originalName: String(data.originalName || data.name || 'Document'),
            size: Number(data.size) || 0,
            mimeType: String(data.mimeType || 'application/octet-stream'),
            extension: String(data.extension || ''),
            chunkCount: Number(data.chunkCount) || 0,
            textExcerpt: String(data.textExcerpt || ''),
            isFavorite: Boolean(data.isFavorite),
            isTrash: Boolean(data.isTrash),
            createdAtMs: parseTimestampMs(data.createdAt),
            updatedAtMs: parseTimestampMs(data.updatedAt),
          };
        });
        list.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setFiles(list);
        filesLoaded = true;
        markReadyIfBoth();
      },
      (error) => {
        setIsLoadingLibrary(false);
        try {
          handleFirestoreError(error, OperationType.LIST, 'files');
        } catch {
          notify('Unable to sync files from Firebase.', 'error');
        }
      }
    );

    const briefingsQuery = query(collection(db, 'briefings'), where('userId', '==', uid));
    const unsubBriefings = onSnapshot(
      briefingsQuery,
      (snapshot) => {
        const list: AudioBriefing[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            userId: String(data.userId || uid),
            folderId: normalizeFolderId(data.folderId),
            title: String(data.title || 'Commute Briefing'),
            sourceTitle: String(data.sourceTitle || ''),
            mode: data.mode === 'single' ? 'single' : 'podcast',
            voiceInfo: String(data.voiceInfo || 'Kore'),
            language: String(data.language || 'English'),
            durationSeconds: Number(data.durationSeconds) || 0,
            summaryText: String(data.summaryText || ''),
            keyTakeaways: Array.isArray(data.keyTakeaways)
              ? data.keyTakeaways.map((item) => String(item))
              : [],
            scriptText: String(data.scriptText || ''),
            audioFileId: normalizeFolderId(data.audioFileId),
            isFavorite: Boolean(data.isFavorite),
            createdAtMs: parseTimestampMs(data.createdAt),
            updatedAtMs: parseTimestampMs(data.updatedAt),
          };
        });
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setBriefings(list);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'briefings');
        } catch {
          // Logged via handleFirestoreError
        }
      }
    );

    return () => {
      unsubFolders();
      unsubFiles();
      unsubBriefings();
    };
  }, [isAuthReady, isCloudMode, user, notify]);

  // Persist local guest snapshot whenever state changes in guest mode
  const persistLocalIfGuest = useCallback(
    async (nextFolders: FolderItem[], nextFiles: FileItem[], nextBriefings: AudioBriefing[]) => {
      if (!isCloudMode) {
        await saveLocalLibrarySnapshot({
          folders: nextFolders,
          files: nextFiles,
          briefings: nextBriefings,
        });
      }
    },
    [isCloudMode]
  );

  // Validate that a parent folder ID actually exists in active folders; otherwise normalize to root ""
  const ensureValidExistingFolderId = useCallback(
    (candidateId?: string | null): string => {
      const norm = normalizeFolderId(candidateId);
      if (!norm) return '';
      const found = folders.some((f) => f.id === norm && !f.isTrash);
      return found ? norm : '';
    },
    [folders]
  );

  const createFolder = useCallback(
    async (
      rawName: string,
      rawParentId?: string | null,
      color: FolderColor = 'blue'
    ): Promise<FolderItem> => {
      const safeName = sanitizeString(rawName, 120, '');
      if (!safeName) {
        throw new Error('Folder name cannot be empty.');
      }
      const safeParentId = ensureValidExistingFolderId(rawParentId);
      const safeColor: FolderColor = ['slate', 'blue', 'emerald', 'amber', 'rose', 'violet'].includes(color)
        ? color
        : 'blue';
      const id = generateSafeId('fld');
      const now = Date.now();
      const ownerId = isCloudMode && user ? user.uid : 'local_scholar';

      const newFolder: FolderItem = {
        id,
        userId: ownerId,
        name: safeName,
        parentId: safeParentId,
        color: safeColor,
        isFavorite: false,
        isTrash: false,
        createdAtMs: now,
        updatedAtMs: now,
      };

      // Optimistic state update for instant 0ms UI response
      setFolders((prev) => {
        const next = [...prev, newFolder].sort((a, b) => a.name.localeCompare(b.name));
        void persistLocalIfGuest(next, files, briefings);
        return next;
      });

      if (isCloudMode && user) {
        const path = `folders/${id}`;
        try {
          await setDoc(doc(db, 'folders', id), {
            id,
            userId: user.uid,
            name: safeName,
            parentId: safeParentId,
            color: safeColor,
            isFavorite: false,
            isTrash: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          setFolders((prev) => prev.filter((f) => f.id !== id));
          notify('Failed to create folder in Firebase.', 'error');
          handleFirestoreError(err, OperationType.CREATE, path);
        }
      }

      notify(`Folder "${safeName}" created.`, 'success');
      return newFolder;
    },
    [ensureValidExistingFolderId, isCloudMode, user, persistLocalIfGuest, files, briefings, notify]
  );

  const renameFolder = useCallback(
    async (folderId: string, rawName: string, newColor?: FolderColor) => {
      const safeName = sanitizeString(rawName, 120, '');
      if (!safeName) return;
      const target = folders.find((f) => f.id === folderId);
      if (!target) return;
      const safeColor = newColor || target.color;

      setFolders((prev) => {
        const next = prev
          .map((f) =>
            f.id === folderId
              ? { ...f, name: safeName, color: safeColor, updatedAtMs: Date.now() }
              : f
          )
          .sort((a, b) => a.name.localeCompare(b.name));
        void persistLocalIfGuest(next, files, briefings);
        return next;
      });

      if (isCloudMode && user) {
        const path = `folders/${folderId}`;
        try {
          await updateDoc(doc(db, 'folders', folderId), {
            name: safeName,
            color: safeColor,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
      notify('Folder updated.', 'success');
    },
    [folders, isCloudMode, user, persistLocalIfGuest, files, briefings, notify]
  );

  const moveFolder = useCallback(
    async (folderId: string, targetParentId: string) => {
      const safeTarget = ensureValidExistingFolderId(targetParentId);
      if (isDescendantOrSelf(folders, folderId, safeTarget)) {
        notify('Cannot move a folder inside itself or one of its subfolders.', 'error');
        return;
      }

      setFolders((prev) => {
        const next = prev.map((f) =>
          f.id === folderId ? { ...f, parentId: safeTarget, updatedAtMs: Date.now() } : f
        );
        void persistLocalIfGuest(next, files, briefings);
        return next;
      });

      if (isCloudMode && user) {
        const path = `folders/${folderId}`;
        try {
          await updateDoc(doc(db, 'folders', folderId), {
            parentId: safeTarget,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, path);
        }
      }
      notify('Folder moved.', 'success');
    },
    [ensureValidExistingFolderId, folders, isCloudMode, user, persistLocalIfGuest, files, briefings, notify]
  );

  const toggleFolderFavorite = useCallback(
    async (folderId: string) => {
      const target = folders.find((f) => f.id === folderId);
      if (!target) return;
      const nextFav = !target.isFavorite;

      setFolders((prev) => {
        const next = prev.map((f) =>
          f.id === folderId ? { ...f, isFavorite: nextFav, updatedAtMs: Date.now() } : f
        );
        void persistLocalIfGuest(next, files, briefings);
        return next;
      });

      if (isCloudMode && user) {
        try {
          await updateDoc(doc(db, 'folders', folderId), {
            isFavorite: nextFav,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `folders/${folderId}`);
        }
      }
    },
    [folders, isCloudMode, user, persistLocalIfGuest, files, briefings]
  );

  const trashFolder = useCallback(
    async (folderId: string) => {
      // Collect folderId and all nested descendant folders so trashing is clean
      const affectedFolderIds = folders
        .filter((f) => isDescendantOrSelf(folders, folderId, f.id))
        .map((f) => f.id);
      const affectedSet = new Set(affectedFolderIds);
      const affectedFiles = files.filter((fl) => affectedSet.has(fl.folderId) && !fl.isTrash);

      if (affectedSet.has(currentFolderId)) {
        setCurrentFolderId('');
      }

      const nextFolders = folders.map((f) =>
        affectedSet.has(f.id) ? { ...f, isTrash: true, updatedAtMs: Date.now() } : f
      );
      const nextFiles = files.map((fl) =>
        affectedSet.has(fl.folderId) ? { ...fl, isTrash: true, updatedAtMs: Date.now() } : fl
      );

      setFolders(nextFolders);
      setFiles(nextFiles);
      void persistLocalIfGuest(nextFolders, nextFiles, briefings);

      if (isCloudMode && user) {
        try {
          await Promise.all([
            ...affectedFolderIds.map((id) =>
              updateDoc(doc(db, 'folders', id), { isTrash: true, updatedAt: serverTimestamp() })
            ),
            ...affectedFiles.map((fl) =>
              updateDoc(doc(db, 'files', fl.id), { isTrash: true, updatedAt: serverTimestamp() })
            ),
          ]);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `folders/${folderId}`);
        }
      }
      notify('Moved folder to Recycle Bin.', 'info');
    },
    [folders, files, currentFolderId, persistLocalIfGuest, briefings, isCloudMode, user, notify]
  );

  const restoreFolder = useCallback(
    async (folderId: string) => {
      const target = folders.find((f) => f.id === folderId);
      if (!target) return;
      const parentStillActive =
        !target.parentId || folders.some((f) => f.id === target.parentId && !f.isTrash);

      const nextFolders = folders.map((f) =>
        f.id === folderId
          ? {
              ...f,
              isTrash: false,
              parentId: parentStillActive ? f.parentId : '',
              updatedAtMs: Date.now(),
            }
          : f
      );
      setFolders(nextFolders);
      void persistLocalIfGuest(nextFolders, files, briefings);

      if (isCloudMode && user) {
        try {
          if (!parentStillActive && target.parentId !== '') {
            await updateDoc(doc(db, 'folders', folderId), {
              parentId: '',
              updatedAt: serverTimestamp(),
            });
          }
          await updateDoc(doc(db, 'folders', folderId), {
            isTrash: false,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `folders/${folderId}`);
        }
      }
      notify('Folder restored.', 'success');
    },
    [folders, files, briefings, persistLocalIfGuest, isCloudMode, user, notify]
  );

  const permanentlyDeleteFileInternal = useCallback(
    async (file: FileItem) => {
      await deleteCachedBlob(file.id);
      if (isCloudMode && user) {
        const chunkIndexes = Array.from({ length: file.chunkCount }, (_, i) => i);
        await Promise.all(
          chunkIndexes.map((idx) =>
            deleteDoc(doc(db, 'files', file.id, 'chunks', `chunk_${idx}`)).catch(() => undefined)
          )
        );
        await deleteDoc(doc(db, 'files', file.id));
      }
    },
    [isCloudMode, user]
  );

  const permanentlyDeleteFolder = useCallback(
    async (folderId: string) => {
      const affectedFolderIds = folders
        .filter((f) => isDescendantOrSelf(folders, folderId, f.id))
        .map((f) => f.id);
      const affectedSet = new Set(affectedFolderIds);
      const containedFiles = files.filter((fl) => affectedSet.has(fl.folderId));

      const nextFolders = folders.filter((f) => !affectedSet.has(f.id));
      const nextFiles = files.filter((fl) => !affectedSet.has(fl.folderId));
      setFolders(nextFolders);
      setFiles(nextFiles);
      void persistLocalIfGuest(nextFolders, nextFiles, briefings);

      if (isCloudMode && user) {
        try {
          for (const fl of containedFiles) {
            await permanentlyDeleteFileInternal(fl);
          }
          for (const id of affectedFolderIds.reverse()) {
            await deleteDoc(doc(db, 'folders', id));
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `folders/${folderId}`);
        }
      }
      notify('Folder permanently deleted.', 'info');
    },
    [folders, files, briefings, persistLocalIfGuest, isCloudMode, user, permanentlyDeleteFileInternal, notify]
  );

  const uploadSingleFile = useCallback(
    async (file: File, safeFolderId: string, taskId: string) => {
      const MAX_BYTES = 50 * 1024 * 1024;
      if (file.size > MAX_BYTES) {
        throw new Error(`"${file.name}" exceeds the 50 MB per-file limit.`);
      }

      const updateTask = (patch: Partial<UploadTask>) => {
        setUploadTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...patch } : t)));
      };

      updateTask({ progress: 8 });

      const fileId = generateSafeId('doc');
      const safeName = sanitizeString(file.name, 255, 'Untitled_Document');
      const mimeType = inferMimeType(file);
      const extension = getExtensionFromName(safeName);

      // 1. Cache binary Blob locally in IndexedDB immediately so opening is 0ms
      await saveCachedBlob(fileId, file);
      updateTask({ progress: 20 });

      // 2. Extract searchable/summarizable text for PDFs & text notes
      const textExcerpt = await extractReadableTextFromFile(file, 24000);
      updateTask({ progress: 32 });

      const ownerId = isCloudMode && user ? user.uid : 'local_scholar';
      const now = Date.now();

      if (isCloudMode && user) {
        const buffer = await file.arrayBuffer();
        const chunks = arrayBufferToBase64Chunks(buffer);
        const chunkCount = chunks.length;

        // Create parent /files/{fileId} metadata FIRST so Master Gate rules on /chunks pass
        try {
          await setDoc(doc(db, 'files', fileId), {
            id: fileId,
            userId: user.uid,
            folderId: safeFolderId,
            name: safeName,
            originalName: safeName,
            size: file.size,
            mimeType,
            extension,
            chunkCount,
            textExcerpt,
            isFavorite: false,
            isTrash: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `files/${fileId}`);
        }

        updateTask({ progress: 45 });

        // Upload chunks in parallel batches of 3 with smooth progress updates
        let completedChunks = 0;
        const BATCH_SIZE = 3;
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
          const slice = chunks.slice(i, i + BATCH_SIZE);
          await Promise.all(
            slice.map(async (chunkData, offset) => {
              const index = i + offset;
              const chunkDocId = `chunk_${index}`;
              try {
                await setDoc(doc(db, 'files', fileId, 'chunks', chunkDocId), {
                  id: chunkDocId,
                  fileId,
                  userId: user.uid,
                  index,
                  data: chunkData || 'AA==',
                  createdAt: serverTimestamp(),
                });
              } catch (err) {
                handleFirestoreError(
                  err,
                  OperationType.CREATE,
                  `files/${fileId}/chunks/${chunkDocId}`
                );
              }
              completedChunks += 1;
              const pct = 45 + Math.round((completedChunks / Math.max(1, chunkCount)) * 55);
              updateTask({ progress: Math.min(100, pct) });
            })
          );
        }
      } else {
        const localFile: FileItem = {
          id: fileId,
          userId: ownerId,
          folderId: safeFolderId,
          name: safeName,
          originalName: safeName,
          size: file.size,
          mimeType,
          extension,
          chunkCount: 0,
          textExcerpt,
          isFavorite: false,
          isTrash: false,
          createdAtMs: now,
          updatedAtMs: now,
        };
        setFiles((prev) => {
          const next = [localFile, ...prev];
          void saveLocalLibrarySnapshot({ folders, files: next, briefings });
          return next;
        });
      }

      updateTask({ progress: 100, status: 'completed' });
    },
    [isCloudMode, user, folders, briefings]
  );

  const uploadFiles = useCallback(
    async (fileList: File[] | FileList, targetFolderId?: string | null) => {
      const incomingFiles = Array.from(fileList);
      if (incomingFiles.length === 0) return;

      const safeFolderId = ensureValidExistingFolderId(
        targetFolderId !== undefined ? targetFolderId : currentFolderId
      );

      const newTasks: UploadTask[] = incomingFiles.map((file) => ({
        id: generateSafeId('upl'),
        fileName: file.name,
        size: file.size,
        progress: 2,
        status: 'uploading',
      }));

      setUploadTasks((prev) => [...newTasks, ...prev].slice(0, 25));

      let successCount = 0;
      for (let idx = 0; idx < incomingFiles.length; idx++) {
        const file = incomingFiles[idx];
        const task = newTasks[idx];
        try {
          await uploadSingleFile(file, safeFolderId, task.id);
          successCount += 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload failed';
          setUploadTasks((prev) =>
            prev.map((t) =>
              t.id === task.id ? { ...t, status: 'error', errorMessage: msg } : t
            )
          );
          notify(`Upload failed for "${file.name}".`, 'error');
        }
      }

      if (successCount > 0) {
        notify(
          successCount === 1
            ? `"${incomingFiles[0].name}" uploaded.`
            : `${successCount} files uploaded.`,
          'success'
        );
      }
    },
    [ensureValidExistingFolderId, currentFolderId, uploadSingleFile, notify]
  );

  const dismissUploadTasks = useCallback(() => {
    setUploadTasks((prev) => prev.filter((t) => t.status === 'uploading'));
  }, []);

  const renameFile = useCallback(
    async (fileId: string, rawName: string) => {
      const safeName = sanitizeString(rawName, 255, '');
      if (!safeName) return;

      setFiles((prev) => {
        const next = prev.map((fl) =>
          fl.id === fileId ? { ...fl, name: safeName, updatedAtMs: Date.now() } : fl
        );
        void persistLocalIfGuest(folders, next, briefings);
        return next;
      });

      if (isCloudMode && user) {
        try {
          await updateDoc(doc(db, 'files', fileId), {
            name: safeName,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `files/${fileId}`);
        }
      }
      notify('File renamed.', 'success');
    },
    [folders, briefings, persistLocalIfGuest, isCloudMode, user, notify]
  );

  const moveFiles = useCallback(
    async (fileIds: string[], targetFolderId: string) => {
      const safeTarget = ensureValidExistingFolderId(targetFolderId);
      const idSet = new Set(fileIds);

      setFiles((prev) => {
        const next = prev.map((fl) =>
          idSet.has(fl.id) ? { ...fl, folderId: safeTarget, updatedAtMs: Date.now() } : fl
        );
        void persistLocalIfGuest(folders, next, briefings);
        return next;
      });

      if (isCloudMode && user) {
        try {
          await Promise.all(
            fileIds.map((id) =>
              updateDoc(doc(db, 'files', id), {
                folderId: safeTarget,
                updatedAt: serverTimestamp(),
              })
            )
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, 'files');
        }
      }
      notify(fileIds.length === 1 ? 'File moved.' : `${fileIds.length} files moved.`, 'success');
    },
    [ensureValidExistingFolderId, folders, briefings, persistLocalIfGuest, isCloudMode, user, notify]
  );

  const toggleFileFavorite = useCallback(
    async (fileId: string) => {
      const target = files.find((f) => f.id === fileId);
      if (!target) return;
      const nextFav = !target.isFavorite;

      setFiles((prev) => {
        const next = prev.map((fl) =>
          fl.id === fileId ? { ...fl, isFavorite: nextFav, updatedAtMs: Date.now() } : fl
        );
        void persistLocalIfGuest(folders, next, briefings);
        return next;
      });

      if (isCloudMode && user) {
        try {
          await updateDoc(doc(db, 'files', fileId), {
            isFavorite: nextFav,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `files/${fileId}`);
        }
      }
    },
    [files, folders, briefings, persistLocalIfGuest, isCloudMode, user]
  );

  const trashFiles = useCallback(
    async (fileIds: string[]) => {
      const idSet = new Set(fileIds);
      setFiles((prev) => {
        const next = prev.map((fl) =>
          idSet.has(fl.id) ? { ...fl, isTrash: true, updatedAtMs: Date.now() } : fl
        );
        void persistLocalIfGuest(folders, next, briefings);
        return next;
      });

      if (isCloudMode && user) {
        try {
          await Promise.all(
            fileIds.map((id) =>
              updateDoc(doc(db, 'files', id), {
                isTrash: true,
                updatedAt: serverTimestamp(),
              })
            )
          );
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, 'files');
        }
      }
      notify(
        fileIds.length === 1 ? 'Moved file to Recycle Bin.' : `${fileIds.length} files moved to Recycle Bin.`,
        'info'
      );
    },
    [folders, briefings, persistLocalIfGuest, isCloudMode, user, notify]
  );

  const restoreFile = useCallback(
    async (fileId: string) => {
      const target = files.find((f) => f.id === fileId);
      if (!target) return;
      const folderStillActive =
        !target.folderId || folders.some((f) => f.id === target.folderId && !f.isTrash);

      setFiles((prev) => {
        const next = prev.map((fl) =>
          fl.id === fileId
            ? {
                ...fl,
                isTrash: false,
                folderId: folderStillActive ? fl.folderId : '',
                updatedAtMs: Date.now(),
              }
            : fl
        );
        void persistLocalIfGuest(folders, next, briefings);
        return next;
      });

      if (isCloudMode && user) {
        try {
          if (!folderStillActive && target.folderId !== '') {
            await updateDoc(doc(db, 'files', fileId), {
              folderId: '',
              updatedAt: serverTimestamp(),
            });
          }
          await updateDoc(doc(db, 'files', fileId), {
            isTrash: false,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `files/${fileId}`);
        }
      }
      notify('File restored.', 'success');
    },
    [files, folders, briefings, persistLocalIfGuest, isCloudMode, user, notify]
  );

  const permanentlyDeleteFile = useCallback(
    async (fileId: string) => {
      const target = files.find((f) => f.id === fileId);
      if (!target) return;

      const nextFiles = files.filter((f) => f.id !== fileId);
      setFiles(nextFiles);
      void persistLocalIfGuest(folders, nextFiles, briefings);

      try {
        await permanentlyDeleteFileInternal(target);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `files/${fileId}`);
      }
      notify('File permanently deleted.', 'info');
    },
    [files, folders, briefings, persistLocalIfGuest, permanentlyDeleteFileInternal, notify]
  );

  const emptyTrash = useCallback(async () => {
    const trashedFiles = files.filter((f) => f.isTrash);
    const trashedFolders = folders.filter((f) => f.isTrash);

    const nextFiles = files.filter((f) => !f.isTrash);
    const nextFolders = folders.filter((f) => !f.isTrash);
    setFiles(nextFiles);
    setFolders(nextFolders);
    void persistLocalIfGuest(nextFolders, nextFiles, briefings);

    if (isCloudMode && user) {
      try {
        for (const fl of trashedFiles) {
          await permanentlyDeleteFileInternal(fl);
        }
        for (const fd of trashedFolders) {
          await deleteDoc(doc(db, 'folders', fd.id));
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'trash');
      }
    }
    notify('Recycle Bin emptied.', 'success');
  }, [files, folders, briefings, persistLocalIfGuest, isCloudMode, user, permanentlyDeleteFileInternal, notify]);

  // Fast 0ms IndexedDB lookup with automatic Firestore chunk reassembly fallback
  const resolveFileBlob = useCallback(
    async (file: FileItem): Promise<Blob> => {
      const cached = await getCachedBlob(file.id);
      if (cached && cached.size > 0) {
        return cached;
      }

      if (isCloudMode && user && file.chunkCount > 0) {
        const chunkPromises = Array.from({ length: file.chunkCount }, (_, idx) =>
          getDoc(doc(db, 'files', file.id, 'chunks', `chunk_${idx}`))
        );
        let snaps;
        try {
          snaps = await Promise.all(chunkPromises);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `files/${file.id}/chunks`);
        }
        const base64Chunks = snaps.map((snap) => {
          if (!snap.exists()) {
            throw new Error(`Missing cloud chunk for "${file.name}".`);
          }
          return String(snap.data().data || '');
        });
        const reassembled = reassembleChunksToBlob(base64Chunks, file.mimeType);
        await saveCachedBlob(file.id, reassembled);
        return reassembled;
      }

      if (file.textExcerpt) {
        return new Blob([file.textExcerpt], { type: 'text/plain;charset=utf-8' });
      }

      throw new Error('File binary content is not available on this device.');
    },
    [isCloudMode, user]
  );

  const downloadFile = useCallback(
    async (file: FileItem) => {
      try {
        const blob = await resolveFileBlob(file);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.name;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Download failed';
        notify(msg, 'error');
      }
    },
    [resolveFileBlob, notify]
  );

  // Save AI Commute Audio Summary WAV + metadata to StudyVault & Firestore
  const saveGeneratedBriefing = useCallback(
    async (input: SaveBriefingInput): Promise<{ briefing: AudioBriefing; audioBlob: Blob }> => {
      const safeFolderId = ensureValidExistingFolderId(input.folderId);
      const audioBlob = base64ToBlob(input.audioBase64, 'audio/wav');
      const audioFileId = generateSafeId('aud');
      const briefingId = generateSafeId('brf');
      const cleanTitle = sanitizeString(input.title, 190, 'Commute Audio Summary');
      const wavFileName = `${cleanTitle.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 80) || 'Commute_Summary'}.wav`;
      const ownerId = isCloudMode && user ? user.uid : 'local_scholar';
      const now = Date.now();

      await saveCachedBlob(audioFileId, audioBlob);

      const safeTakeaways = input.keyTakeaways
        .slice(0, 10)
        .map((t) => sanitizeString(t, 490, ''))
        .filter(Boolean);
      const safeSummary = sanitizeString(input.summaryText, 9900, cleanTitle);
      const safeScript = sanitizeString(input.scriptText, 19900, safeSummary);
      const safeSourceTitle = sanitizeString(input.sourceTitle, 290, '');
      const safeVoice = sanitizeString(input.voiceInfo, 115, 'Kore');
      const safeLanguage = sanitizeString(input.language, 38, 'English');

      if (isCloudMode && user) {
        const buffer = await audioBlob.arrayBuffer();
        const chunks = arrayBufferToBase64Chunks(buffer);

        // 1. Write WAV FileItem metadata first (so ownsReferencedFile passes!)
        try {
          await setDoc(doc(db, 'files', audioFileId), {
            id: audioFileId,
            userId: user.uid,
            folderId: safeFolderId,
            name: wavFileName,
            originalName: wavFileName,
            size: audioBlob.size,
            mimeType: 'audio/wav',
            extension: 'wav',
            chunkCount: chunks.length,
            textExcerpt: `${safeSummary}\n\n${safeScript}`.slice(0, 24000),
            isFavorite: false,
            isTrash: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // 2. Upload WAV binary chunks
          const BATCH = 3;
          for (let i = 0; i < chunks.length; i += BATCH) {
            const slice = chunks.slice(i, i + BATCH);
            await Promise.all(
              slice.map((chunkData, offset) => {
                const idx = i + offset;
                const chunkDocId = `chunk_${idx}`;
                return setDoc(doc(db, 'files', audioFileId, 'chunks', chunkDocId), {
                  id: chunkDocId,
                  fileId: audioFileId,
                  userId: user.uid,
                  index: idx,
                  data: chunkData || 'AA==',
                  createdAt: serverTimestamp(),
                });
              })
            );
          }

          // 3. Create AudioBriefing document
          await setDoc(doc(db, 'briefings', briefingId), {
            id: briefingId,
            userId: user.uid,
            folderId: safeFolderId,
            title: cleanTitle,
            sourceTitle: safeSourceTitle,
            mode: input.mode,
            voiceInfo: safeVoice,
            language: safeLanguage,
            durationSeconds: Math.max(1, Math.min(7200, Math.round(input.durationSeconds))),
            summaryText: safeSummary,
            keyTakeaways: safeTakeaways,
            scriptText: safeScript,
            audioFileId,
            isFavorite: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `briefings/${briefingId}`);
        }
      } else {
        const localWavFile: FileItem = {
          id: audioFileId,
          userId: ownerId,
          folderId: safeFolderId,
          name: wavFileName,
          originalName: wavFileName,
          size: audioBlob.size,
          mimeType: 'audio/wav',
          extension: 'wav',
          chunkCount: 0,
          textExcerpt: `${safeSummary}\n\n${safeScript}`.slice(0, 24000),
          isFavorite: false,
          isTrash: false,
          createdAtMs: now,
          updatedAtMs: now,
        };
        const localBriefing: AudioBriefing = {
          id: briefingId,
          userId: ownerId,
          folderId: safeFolderId,
          title: cleanTitle,
          sourceTitle: safeSourceTitle,
          mode: input.mode,
          voiceInfo: safeVoice,
          language: safeLanguage,
          durationSeconds: Math.max(1, Math.round(input.durationSeconds)),
          summaryText: safeSummary,
          keyTakeaways: safeTakeaways,
          scriptText: safeScript,
          audioFileId,
          isFavorite: false,
          createdAtMs: now,
          updatedAtMs: now,
        };

        const nextFiles = [localWavFile, ...files];
        const nextBriefings = [localBriefing, ...briefings];
        setFiles(nextFiles);
        setBriefings(nextBriefings);
        await saveLocalLibrarySnapshot({ folders, files: nextFiles, briefings: nextBriefings });
      }

      const createdBriefing: AudioBriefing = {
        id: briefingId,
        userId: ownerId,
        folderId: safeFolderId,
        title: cleanTitle,
        sourceTitle: safeSourceTitle,
        mode: input.mode,
        voiceInfo: safeVoice,
        language: safeLanguage,
        durationSeconds: Math.max(1, Math.round(input.durationSeconds)),
        summaryText: safeSummary,
        keyTakeaways: safeTakeaways,
        scriptText: safeScript,
        audioFileId,
        isFavorite: false,
        createdAtMs: now,
        updatedAtMs: now,
      };

      notify('Commute audio summary saved to library.', 'success');
      return { briefing: createdBriefing, audioBlob };
    },
    [ensureValidExistingFolderId, isCloudMode, user, files, briefings, folders, notify]
  );

  const toggleBriefingFavorite = useCallback(
    async (briefingId: string) => {
      const target = briefings.find((b) => b.id === briefingId);
      if (!target) return;
      const nextFav = !target.isFavorite;

      setBriefings((prev) => {
        const next = prev.map((b) =>
          b.id === briefingId ? { ...b, isFavorite: nextFav, updatedAtMs: Date.now() } : b
        );
        void persistLocalIfGuest(folders, files, next);
        return next;
      });

      if (isCloudMode && user) {
        try {
          await updateDoc(doc(db, 'briefings', briefingId), {
            isFavorite: nextFav,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `briefings/${briefingId}`);
        }
      }
    },
    [briefings, folders, files, persistLocalIfGuest, isCloudMode, user]
  );

  const deleteBriefing = useCallback(
    async (briefingId: string) => {
      const nextBriefings = briefings.filter((b) => b.id !== briefingId);
      setBriefings(nextBriefings);
      void persistLocalIfGuest(folders, files, nextBriefings);

      if (isCloudMode && user) {
        try {
          await deleteDoc(doc(db, 'briefings', briefingId));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `briefings/${briefingId}`);
        }
      }
      notify('Audio briefing removed.', 'info');
    },
    [briefings, folders, files, persistLocalIfGuest, isCloudMode, user, notify]
  );

  // Sync any items created in local guest mode up to Firebase Cloud once signed in
  const syncLocalDataToCloud = useCallback(async (): Promise<number> => {
    if (!isCloudMode || !user) return 0;
    setIsSyncingLocalToCloud(true);
    try {
      const snap = await loadLocalLibrarySnapshot();
      let migrated = 0;

      // Topologically order folders so parent folders exist before child folders
      const pending = [...snap.folders];
      const createdIds = new Set<string>(['']);
      let safety = 0;
      while (pending.length > 0 && safety < 200) {
        safety += 1;
        const idx = pending.findIndex((f) => createdIds.has(normalizeFolderId(f.parentId)));
        const folder = idx >= 0 ? pending.splice(idx, 1)[0] : pending.shift()!;
        const safeParent = createdIds.has(normalizeFolderId(folder.parentId))
          ? normalizeFolderId(folder.parentId)
          : '';
        const safeId = normalizeFolderId(folder.id) || generateSafeId('fld');
        await setDoc(doc(db, 'folders', safeId), {
          id: safeId,
          userId: user.uid,
          name: sanitizeString(folder.name, 120, 'Folder'),
          parentId: safeParent,
          color: folder.color || 'blue',
          isFavorite: Boolean(folder.isFavorite),
          isTrash: Boolean(folder.isTrash),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        createdIds.add(safeId);
        migrated += 1;
      }

      for (const fl of snap.files) {
        const safeId = normalizeFolderId(fl.id) || generateSafeId('doc');
        const blob = await getCachedBlob(fl.id);
        let chunks: string[] = [];
        if (blob) {
          const buf = await blob.arrayBuffer();
          chunks = arrayBufferToBase64Chunks(buf);
          if (safeId !== fl.id) await saveCachedBlob(safeId, blob);
        }
        await setDoc(doc(db, 'files', safeId), {
          id: safeId,
          userId: user.uid,
          folderId: createdIds.has(normalizeFolderId(fl.folderId)) ? normalizeFolderId(fl.folderId) : '',
          name: sanitizeString(fl.name, 255, 'Document'),
          originalName: sanitizeString(fl.originalName || fl.name, 255, 'Document'),
          size: Number(fl.size) || 0,
          mimeType: sanitizeString(fl.mimeType, 120, 'application/octet-stream'),
          extension: sanitizeString(fl.extension, 20, ''),
          chunkCount: chunks.length,
          textExcerpt: sanitizeString(fl.textExcerpt, 24000, ''),
          isFavorite: Boolean(fl.isFavorite),
          isTrash: Boolean(fl.isTrash),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        for (let i = 0; i < chunks.length; i++) {
          const chunkDocId = `chunk_${i}`;
          await setDoc(doc(db, 'files', safeId, 'chunks', chunkDocId), {
            id: chunkDocId,
            fileId: safeId,
            userId: user.uid,
            index: i,
            data: chunks[i] || 'AA==',
            createdAt: serverTimestamp(),
          });
        }
        migrated += 1;
      }

      for (const br of snap.briefings) {
        const safeId = normalizeFolderId(br.id) || generateSafeId('brf');
        await setDoc(doc(db, 'briefings', safeId), {
          id: safeId,
          userId: user.uid,
          folderId: createdIds.has(normalizeFolderId(br.folderId)) ? normalizeFolderId(br.folderId) : '',
          title: sanitizeString(br.title, 190, 'Commute Briefing'),
          sourceTitle: sanitizeString(br.sourceTitle, 290, ''),
          mode: br.mode === 'single' ? 'single' : 'podcast',
          voiceInfo: sanitizeString(br.voiceInfo, 115, 'Kore'),
          language: sanitizeString(br.language, 38, 'English'),
          durationSeconds: Math.max(1, Math.min(7200, Math.round(br.durationSeconds || 60))),
          summaryText: sanitizeString(br.summaryText, 9900, br.title),
          keyTakeaways: Array.isArray(br.keyTakeaways)
            ? br.keyTakeaways.slice(0, 10).map((t) => sanitizeString(t, 490, '')).filter(Boolean)
            : [],
          scriptText: sanitizeString(br.scriptText, 19900, br.summaryText || br.title),
          audioFileId: '',
          isFavorite: Boolean(br.isFavorite),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        migrated += 1;
      }

      await saveLocalLibrarySnapshot({ folders: [], files: [], briefings: [] });
      setHasUnsyncedLocalData(false);
      notify(`Synced ${migrated} local items to Firebase Cloud.`, 'success');
      return migrated;
    } catch (err) {
      notify('Error syncing local items to Firebase.', 'error');
      throw err;
    } finally {
      setIsSyncingLocalToCloud(false);
    }
  }, [isCloudMode, user, notify]);

  const exportLibraryBackup = useCallback((): BackupArchivePayload => {
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      folders,
      files,
      briefings,
    };
  }, [folders, files, briefings]);

  const restoreLibraryBackup = useCallback(
    async (
      archive: BackupArchivePayload
    ): Promise<{ foldersRestored: number; filesRestored: number }> => {
      const rawFolders = Array.isArray(archive?.folders) ? archive.folders : [];
      const rawFiles = Array.isArray(archive?.files) ? archive.files : [];

      if (!isCloudMode || !user) {
        const mergedFolders = [...folders];
        for (const f of rawFolders) {
          if (!mergedFolders.some((x) => x.id === f.id)) {
            mergedFolders.push({
              ...f,
              id: normalizeFolderId(f.id) || generateSafeId('fld'),
              parentId: normalizeFolderId(f.parentId),
              color: f.color || 'blue',
              isFavorite: Boolean(f.isFavorite),
              isTrash: Boolean(f.isTrash),
              createdAtMs: f.createdAtMs || Date.now(),
              updatedAtMs: Date.now(),
            });
          }
        }
        const mergedFiles = [...files];
        for (const fl of rawFiles) {
          if (!mergedFiles.some((x) => x.id === fl.id)) {
            mergedFiles.push({
              ...fl,
              id: normalizeFolderId(fl.id) || generateSafeId('doc'),
              folderId: normalizeFolderId(fl.folderId),
              chunkCount: Number(fl.chunkCount) || 0,
              textExcerpt: String(fl.textExcerpt || ''),
              isFavorite: Boolean(fl.isFavorite),
              isTrash: Boolean(fl.isTrash),
              createdAtMs: fl.createdAtMs || Date.now(),
              updatedAtMs: Date.now(),
            });
          }
        }
        setFolders(mergedFolders);
        setFiles(mergedFiles);
        await saveLocalLibrarySnapshot({ folders: mergedFolders, files: mergedFiles, briefings });
        notify(`Restored ${rawFolders.length} folders and ${rawFiles.length} file records.`, 'success');
        return { foldersRestored: rawFolders.length, filesRestored: rawFiles.length };
      }

      // Cloud top-down ordered restore
      const knownFolderIds = new Set<string>(['', ...folders.map((f) => f.id)]);
      const pendingFolders = [...rawFolders];
      let foldersRestored = 0;
      let guard = 0;

      while (pendingFolders.length > 0 && guard < 500) {
        guard += 1;
        const idx = pendingFolders.findIndex((f) => knownFolderIds.has(normalizeFolderId(f.parentId)));
        const f = idx >= 0 ? pendingFolders.splice(idx, 1)[0] : pendingFolders.shift()!;
        const safeId = normalizeFolderId(f.id) || generateSafeId('fld');
        const safeParent = knownFolderIds.has(normalizeFolderId(f.parentId))
          ? normalizeFolderId(f.parentId)
          : '';
        await setDoc(doc(db, 'folders', safeId), {
          id: safeId,
          userId: user.uid,
          name: sanitizeString(f.name, 120, 'Restored Folder'),
          parentId: safeParent,
          color: (['slate', 'blue', 'emerald', 'amber', 'rose', 'violet'].includes(f.color)
            ? f.color
            : 'blue') as FolderColor,
          isFavorite: Boolean(f.isFavorite),
          isTrash: Boolean(f.isTrash),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        knownFolderIds.add(safeId);
        foldersRestored += 1;
      }

      let filesRestored = 0;
      for (const fl of rawFiles) {
        const safeId = normalizeFolderId(fl.id) || generateSafeId('doc');
        const safeFolder = knownFolderIds.has(normalizeFolderId(fl.folderId))
          ? normalizeFolderId(fl.folderId)
          : '';
        await setDoc(doc(db, 'files', safeId), {
          id: safeId,
          userId: user.uid,
          folderId: safeFolder,
          name: sanitizeString(fl.name, 255, 'Restored Document'),
          originalName: sanitizeString(fl.originalName || fl.name, 255, 'Restored Document'),
          size: Math.max(0, Number(fl.size) || 0),
          mimeType: sanitizeString(fl.mimeType, 120, 'application/octet-stream'),
          extension: sanitizeString(fl.extension, 20, ''),
          chunkCount: 0,
          textExcerpt: sanitizeString(fl.textExcerpt, 24000, ''),
          isFavorite: Boolean(fl.isFavorite),
          isTrash: Boolean(fl.isTrash),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        filesRestored += 1;
      }

      notify(`Restored ${foldersRestored} folders and ${filesRestored} files to Firebase.`, 'success');
      return { foldersRestored, filesRestored };
    },
    [isCloudMode, user, folders, files, briefings, notify]
  );

  const totalStorageUsedBytes = useMemo(() => {
    return files.reduce((sum, fl) => sum + (Number(fl.size) || 0), 0);
  }, [files]);

  // Keep user profile totalStorageUsed updated cleanly when signed in
  useEffect(() => {
    if (!isCloudMode || !user || isLoadingLibrary) return;
    const timer = setTimeout(() => {
      updateDoc(doc(db, 'users', user.uid), {
        totalStorageUsed: totalStorageUsedBytes,
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);
    }, 1500);
    return () => clearTimeout(timer);
  }, [isCloudMode, user, isLoadingLibrary, totalStorageUsedBytes]);

  return (
    <LibraryContext.Provider
      value={{
        folders,
        files,
        briefings,
        activeSection,
        setActiveSection,
        currentFolderId,
        openFolder,
        searchQuery,
        setSearchQuery,
        isLoadingLibrary,
        isCloudSynced: isCloudMode,
        hasUnsyncedLocalData,
        isSyncingLocalToCloud,
        syncLocalDataToCloud,
        uploadTasks,
        dismissUploadTasks,
        toastMessage,
        notify,
        createFolder,
        renameFolder,
        moveFolder,
        toggleFolderFavorite,
        trashFolder,
        restoreFolder,
        permanentlyDeleteFolder,
        uploadFiles,
        renameFile,
        moveFiles,
        toggleFileFavorite,
        trashFiles,
        restoreFile,
        permanentlyDeleteFile,
        emptyTrash,
        resolveFileBlob,
        downloadFile,
        saveGeneratedBriefing,
        toggleBriefingFavorite,
        deleteBriefing,
        exportLibraryBackup,
        restoreLibraryBackup,
        totalStorageUsedBytes,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used within LibraryProvider');
  return ctx;
}
