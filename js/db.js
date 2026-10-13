const DB_NAME = 'ParcelTrackMultiStoreDB';
const DB_VERSION = 4; // Versión con soporte multi-tienda y storeId

class LocalDB {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error);
      req.onsuccess = async () => {
        this.db = req.result;
        await this.seedDefaultData();
        resolve();
      };
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('packages')) {
          const store = db.createObjectStore('packages', { keyPath: 'packageId' });
          store.createIndex('storeId', 'storeId', { unique: false });
          store.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains('syncQueue')) {
          const store = db.createObjectStore('syncQueue', { keyPath: 'id' });
          store.createIndex('storeId', 'storeId', { unique: false });
        }
        if (!db.objectStoreNames.contains('settings')) {
          const store = db.createObjectStore('settings', { keyPath: 'key' });
          store.createIndex('storeId', 'storeId', { unique: false });
        }
        if (!db.objectStoreNames.contains('users')) {
          const store = db.createObjectStore('users', { keyPath: 'username' });
          store.createIndex('storeId', 'storeId', { unique: false });
        }
        if (!db.objectStoreNames.contains('stores')) {
          db.createObjectStore('stores', { keyPath: 'storeId' });
        }
      };
    });
  }

  async seedDefaultData() {
    const stores = await this.getAll('stores');
    if (stores.length === 0) {
      await this.put('stores', { storeId: 'LAPAZ', name: 'Sucursal La Paz', backupFile: 'Backup_Tienda_LaPaz.json' });
      await this.put('stores', { storeId: 'SANTACRUZ', name: 'Sucursal Santa Cruz', backupFile: 'Backup_Tienda_SantaCruz.json' });
    }
    const users = await this.getAll('users');
    if (users.length === 0) {
      await this.put('users', {
        username: 'admin',
        pin: '1234',
        fullName: 'Administrador General',
        role: 'ADMIN',
        storeId: 'LAPAZ',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      });
    }
  }

  async get(storeName, key) {
    return new Promise((resolve) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
    });
  }

  async getAll(storeName) {
    return new Promise((resolve) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
    });
  }

  async getAllByStore(storeName, storeId) {
    const all = await this.getAll(storeName);
    if (!storeId) return all;
    return all.filter(item => item.storeId === storeId || !item.storeId);
  }

  async put(storeName, data) {
    return new Promise((resolve) => {
      const activeStoreId = (typeof storeManager !== 'undefined' && storeManager.getCurrentStoreId()) ? storeManager.getCurrentStoreId() : 'LAPAZ';
      if (data && typeof data === 'object' && !data.storeId && storeName !== 'stores' && storeName !== 'users') {
        data.storeId = activeStoreId;
      }
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.put(data);
      tx.oncomplete = () => resolve();
    });
  }

  async delete(storeName, id) {
    return new Promise((resolve) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(id);
      tx.oncomplete = () => resolve();
    });
  }
}

const db = new LocalDB();
