const PARCELTRACK_API_URL = 'https://script.google.com/macros/s/AKfycbyOZpnkHZUu13TURsRMx4cuwkpN5JqPzHE2Fc6bBe_yyAAwIV9pGQqmwWoN8220aqMGgA/exec';

class SyncEngine {
  constructor() {
    this.isSyncing = false;
  }

  async processQueue() {
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;

    try {
      const storeId = storeManager.getCurrentStoreId();
      const queue = await db.getAll('syncQueue');
      const storeQueue = queue.filter(item => item.storeId === storeId || !item.storeId);

      if (storeQueue.length > 0) {
        for (const item of storeQueue) {
          try {
            item.storeId = storeId;
            await this.sendToDrive(item);
            await db.delete('syncQueue', item.id);
          } catch (err) {
            console.error('Error al sincronizar item con Google Drive:', err);
            break;
          }
        }
      }

      await this.pullRemoteChangesForStore(storeId);
    } catch (e) {
      console.error('Error general en motor de sincronización:', e);
    } finally {
      this.isSyncing = false;
      if (typeof app !== 'undefined') {
        app.loadDashboard();
      }
    }
  }

  async sendToDrive(syncItem) {
    if (!PARCELTRACK_API_URL || PARCELTRACK_API_URL.includes('TU_SCRIPT_ID_AQUI')) return;
    const storeId = storeManager.getCurrentStoreId();
    const payload = {
      storeId: storeId,
      action: 'syncItem',
      item: syncItem
    };
    const response = await fetch(PARCELTRACK_API_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    return await response.json();
  }

  async pullRemoteChangesForStore(storeId) {
    if (!PARCELTRACK_API_URL || PARCELTRACK_API_URL.includes('TU_SCRIPT_ID_AQUI')) return;
    try {
      const response = await fetch(`${PARCELTRACK_API_URL}?storeId=${storeId}&action=getBackup`, { method: 'GET', mode: 'cors' });
      const remoteData = await response.json();

      if (remoteData && Array.isArray(remoteData.packages)) {
        for (const remotePkg of remoteData.packages) {
          remotePkg.storeId = storeId;
          const localPkg = await db.get('packages', remotePkg.packageId);
          if (!localPkg || (remotePkg.updatedAt && new Date(remotePkg.updatedAt) > new Date(localPkg.updatedAt || localPkg.createdAt))) {
            await db.put('packages', remotePkg);
          }
        }
      }
    } catch (e) {
      console.warn('No se pudo descargar el respaldo remoto de Google Drive:', e);
    }
  }
}

const syncEngine = new SyncEngine();
