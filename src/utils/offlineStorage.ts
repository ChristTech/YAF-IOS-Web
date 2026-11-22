import type { SpiritualResource, UploadedBibleDoc } from '../types/fellowship';

const DB_NAME = 'gideonites_spiritual_offline_db';
const DB_VERSION = 2;
const STORE_RESOURCES = 'bookmarked_resources';
const STORE_BIBLE_DOCS = 'bible_editions';
const STORE_PDF_BLOBS = 'bible_pdf_binaries';
const STORE_AUDIO_BLOBS = 'sermon_audio_blobs';

const LS_BOOKMARKS_PREFIX = 'gideonites_offline_bookmarks_';
const LS_IOS_EVICTION_TIP_KEY = 'gideonites_ios_eviction_tip_shown';

function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_RESOURCES)) {
          db.createObjectStore(STORE_RESOURCES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_BIBLE_DOCS)) {
          db.createObjectStore(STORE_BIBLE_DOCS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_PDF_BLOBS)) {
          db.createObjectStore(STORE_PDF_BLOBS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_AUDIO_BLOBS)) {
          db.createObjectStore(STORE_AUDIO_BLOBS, { keyPath: 'audioCloudId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function requestPersistentOfflineStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // ignore permission / browser support errors
  }
  return false;
}

export function isNonStandaloneIosSafari(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIOS) return false;
  const standaloneNav = Boolean(
    (navigator as unknown as { standalone?: boolean }).standalone
  );
  const standaloneDisplay =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;
  return !standaloneNav && !standaloneDisplay;
}

export function shouldShowIosStorageEvictionTip(): boolean {
  if (!isNonStandaloneIosSafari()) return false;
  try {
    if (localStorage.getItem(LS_IOS_EVICTION_TIP_KEY) === '1') {
      return false;
    }
    localStorage.setItem(LS_IOS_EVICTION_TIP_KEY, '1');
    return true;
  } catch {
    return true;
  }
}

export function readLocalBookmarkIds(userId: string): string[] {
  try {
    const raw = localStorage.getItem(`${LS_BOOKMARKS_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function writeLocalBookmarkIds(userId: string, ids: string[]): void {
  try {
    localStorage.setItem(`${LS_BOOKMARKS_PREFIX}${userId}`, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export async function saveResourceOffline(
  userId: string,
  resource: SpiritualResource
): Promise<string[]> {
  await requestPersistentOfflineStorage();
  const current = readLocalBookmarkIds(userId);
  const nextIds = current.includes(resource.id) ? current : [...current, resource.id];
  writeLocalBookmarkIds(userId, nextIds);

  const db = await openOfflineDb();
  if (db) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_RESOURCES, 'readwrite');
        tx.objectStore(STORE_RESOURCES).put({
          id: `${userId}::${resource.id}`,
          userId,
          resourceId: resource.id,
          resource,
          savedAt: Date.now(),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // ignore IndexedDB error; localStorage fallback already updated
    }
  }
  return nextIds;
}

export async function removeResourceOffline(
  userId: string,
  resourceId: string
): Promise<string[]> {
  const nextIds = readLocalBookmarkIds(userId).filter((id) => id !== resourceId);
  writeLocalBookmarkIds(userId, nextIds);

  const db = await openOfflineDb();
  if (db) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_RESOURCES, 'readwrite');
        tx.objectStore(STORE_RESOURCES).delete(`${userId}::${resourceId}`);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    } catch {
      // ignore
    }
  }
  return nextIds;
}

export async function loadOfflineSavedResources(
  userId: string
): Promise<SpiritualResource[]> {
  const db = await openOfflineDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_RESOURCES, 'readonly');
      const req = tx.objectStore(STORE_RESOURCES).getAll();
      req.onsuccess = () => {
        const rows = (req.result || []) as {
          userId?: string;
          resource?: SpiritualResource;
        }[];
        resolve(
          rows
            .filter((r) => r.userId === userId && r.resource)
            .map((r) => r.resource as SpiritualResource)
        );
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function saveBibleEditionOffline(
  edition: UploadedBibleDoc,
  pdfBytes?: Uint8Array
): Promise<void> {
  await requestPersistentOfflineStorage();
  const db = await openOfflineDb();
  if (!db) return;

  try {
    await new Promise<void>((resolve) => {
      const stores = pdfBytes
        ? [STORE_BIBLE_DOCS, STORE_PDF_BLOBS]
        : [STORE_BIBLE_DOCS];
      const tx = db.transaction(stores, 'readwrite');
      tx.objectStore(STORE_BIBLE_DOCS).put({
        ...edition,
        cachedAt: Date.now(),
      });
      if (pdfBytes) {
        tx.objectStore(STORE_PDF_BLOBS).put({
          id: edition.id,
          fileName: edition.fileName,
          bytes: pdfBytes.buffer.slice(
            pdfBytes.byteOffset,
            pdfBytes.byteOffset + pdfBytes.byteLength
          ),
          savedAt: Date.now(),
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore IndexedDB errors
  }
}

export async function savePdfBinaryForBibleDoc(
  docId: string,
  fileName: string,
  bytes: Uint8Array
): Promise<void> {
  await requestPersistentOfflineStorage();
  const db = await openOfflineDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_PDF_BLOBS, 'readwrite');
      tx.objectStore(STORE_PDF_BLOBS).put({
        id: docId,
        fileName,
        bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        savedAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export async function loadPdfBinaryForBibleDoc(
  docId: string
): Promise<Uint8Array | null> {
  const db = await openOfflineDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PDF_BLOBS, 'readonly');
      const req = tx.objectStore(STORE_PDF_BLOBS).get(docId);
      req.onsuccess = () => {
        const res = req.result as { bytes?: ArrayBuffer } | undefined;
        if (res?.bytes) {
          resolve(new Uint8Array(res.bytes));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function getPdfBinary(docId: string): Promise<ArrayBuffer | null> {
  const bytes = await loadPdfBinaryForBibleDoc(docId);
  if (!bytes) return null;
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

export async function loadOfflineBibleEditions(): Promise<UploadedBibleDoc[]> {
  const db = await openOfflineDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_BIBLE_DOCS, 'readonly');
      const req = tx.objectStore(STORE_BIBLE_DOCS).getAll();
      req.onsuccess = () => {
        const rows = (req.result || []) as UploadedBibleDoc[];
        resolve(rows);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function saveAudioSermonBlob(
  audioCloudId: string,
  blob: Blob,
  fileName?: string
): Promise<void> {
  if (!audioCloudId) return;
  await requestPersistentOfflineStorage();
  const db = await openOfflineDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_AUDIO_BLOBS, 'readwrite');
      tx.objectStore(STORE_AUDIO_BLOBS).put({
        audioCloudId,
        blob,
        fileName: fileName || 'sermon-audio.mp3',
        savedAt: Date.now(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore IndexedDB errors
  }
}

export async function loadAudioSermonBlob(audioCloudId: string): Promise<Blob | null> {
  if (!audioCloudId) return null;
  const db = await openOfflineDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_AUDIO_BLOBS, 'readonly');
      const req = tx.objectStore(STORE_AUDIO_BLOBS).get(audioCloudId);
      req.onsuccess = () => {
        const res = req.result as { blob?: Blob } | undefined;
        resolve(res?.blob instanceof Blob && res.blob.size > 0 ? res.blob : null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function deleteAudioSermonBlob(audioCloudId: string): Promise<void> {
  if (!audioCloudId) return;
  const db = await openOfflineDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_AUDIO_BLOBS, 'readwrite');
      tx.objectStore(STORE_AUDIO_BLOBS).delete(audioCloudId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export async function purgeAllAudioSermonBlobsExcept(
  keepAudioCloudId?: string | null
): Promise<void> {
  const db = await openOfflineDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_AUDIO_BLOBS, 'readwrite');
      const store = tx.objectStore(STORE_AUDIO_BLOBS);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = (req.result || []) as string[];
        for (const k of keys) {
          if (!keepAudioCloudId || k !== keepAudioCloudId) {
            store.delete(k);
          }
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

export async function purgeStaleOfflineAudioResources(
  activeAudioCloudId: string | null
): Promise<void> {
  await purgeAllAudioSermonBlobsExcept(activeAudioCloudId);
  const db = await openOfflineDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE_RESOURCES, 'readwrite');
      const store = tx.objectStore(STORE_RESOURCES);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = (req.result || []) as Array<{
          id: string;
          userId?: string;
          resourceId?: string;
          resource?: SpiritualResource;
        }>;
        for (const row of rows) {
          const cloudId = row.resource?.audioCloudId?.trim();
          if (cloudId && (!activeAudioCloudId || cloudId !== activeAudioCloudId)) {
            store.delete(row.id);
            if (row.userId && row.resourceId) {
              const nextIds = readLocalBookmarkIds(row.userId).filter(
                (rid) => rid !== row.resourceId
              );
              writeLocalBookmarkIds(row.userId, nextIds);
            }
          }
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // ignore
  }
}

/**
 * Gesture-gated notification permission request (iOS 16.4+ Web Push / Safari PWA policy).
 * Must ONLY be called inside an explicit user click/tap handler.
 */
export async function requestGestureGatedNotificationPermission(): Promise<
  'granted' | 'denied' | 'default' | 'unsupported'
> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return Notification.permission;
    }
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return 'unsupported';
  }
}
