import { AudioBriefing, FileItem, FolderItem } from '../types';

const DB_NAME = 'studyvault_hybrid_cache_v2';
const DB_VERSION = 1;
const BLOB_STORE = 'blobs';
const LOCAL_META_STORE = 'local_meta';

function openLocalDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE);
      }
      if (!db.objectStoreNames.contains(LOCAL_META_STORE)) {
        db.createObjectStore(LOCAL_META_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCachedBlob(fileId: string, blob: Blob): Promise<void> {
  try {
    const db = await openLocalDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BLOB_STORE, 'readwrite');
      tx.objectStore(BLOB_STORE).put(blob, fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB blob cache write skipped:', err);
  }
}

export async function getCachedBlob(fileId: string): Promise<Blob | null> {
  try {
    const db = await openLocalDb();
    return await new Promise<Blob | null>((resolve, reject) => {
      const tx = db.transaction(BLOB_STORE, 'readonly');
      const req = tx.objectStore(BLOB_STORE).get(fileId);
      req.onsuccess = () => resolve((req.result as Blob) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteCachedBlob(fileId: string): Promise<void> {
  try {
    const db = await openLocalDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BLOB_STORE, 'readwrite');
      tx.objectStore(BLOB_STORE).delete(fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore cleanup errors
  }
}

export interface LocalLibrarySnapshot {
  folders: FolderItem[];
  files: FileItem[];
  briefings: AudioBriefing[];
}

const SNAPSHOT_KEY = 'guest_library_v2';

export async function loadLocalLibrarySnapshot(): Promise<LocalLibrarySnapshot> {
  try {
    const db = await openLocalDb();
    return await new Promise<LocalLibrarySnapshot>((resolve) => {
      const tx = db.transaction(LOCAL_META_STORE, 'readonly');
      const req = tx.objectStore(LOCAL_META_STORE).get(SNAPSHOT_KEY);
      req.onsuccess = () => {
        const val = req.result as LocalLibrarySnapshot | undefined;
        resolve({
          folders: Array.isArray(val?.folders) ? val.folders : [],
          files: Array.isArray(val?.files) ? val.files : [],
          briefings: Array.isArray(val?.briefings) ? val.briefings : [],
        });
      };
      req.onerror = () => resolve({ folders: [], files: [], briefings: [] });
    });
  } catch {
    return { folders: [], files: [], briefings: [] };
  }
}

export async function saveLocalLibrarySnapshot(snapshot: LocalLibrarySnapshot): Promise<void> {
  try {
    const db = await openLocalDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(LOCAL_META_STORE, 'readwrite');
      tx.objectStore(LOCAL_META_STORE).put(snapshot, SNAPSHOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB local metadata write skipped:', err);
  }
}
