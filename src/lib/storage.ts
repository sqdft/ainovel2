// IndexedDB 存储工具：主存储 IndexedDB（大容量），备份 localStorage（快速回退）

const DB_NAME = 'ai_novel_db';
const DB_VERSION = 1;
const STORE_NAME = 'app_data';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (error) {
    console.warn(`IndexedDB 写入失败：${key}`, error);
  }
}

// localStorage 辅助
function lsGet<T>(key: string): T | null {
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}

function lsSet<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`localStorage 写入失败：${key}`, error);
  }
}

// 双层读取：优先 IndexedDB，回退 localStorage
export async function dualGet<T>(key: string, fallback: T): Promise<T> {
  const idbVal = await idbGet<T>(key);
  if (idbVal !== null) return idbVal;
  const lsVal = lsGet<T>(key);
  if (lsVal !== null) return lsVal;
  return fallback;
}

// 双层写入：同时写 IndexedDB + localStorage
export function dualSet<T>(key: string, value: T): void {
  lsSet(key, value);   // 同步写 localStorage（快速回退）
  idbSet(key, value);  // 异步写 IndexedDB（大容量主存储）
}
