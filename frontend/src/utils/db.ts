class LocalDB {
  private dbName = 'free_council_store';
  private storeName = 'settings';

  private getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      if (typeof window !== 'undefined') {
        console.warn('IndexedDB read failed, falling back to localStorage:', e);
        const val = localStorage.getItem(key);
        if (!val) return null;
        try { return JSON.parse(val); } catch { return val as any; }
      }
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.getDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(this.storeName, 'readwrite');
        const store = tx.objectStore(this.storeName);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      if (typeof window !== 'undefined') {
        console.warn('IndexedDB write failed, falling back to localStorage:', e);
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
    }
  }
}

export const localDB = new LocalDB();
export default localDB;
