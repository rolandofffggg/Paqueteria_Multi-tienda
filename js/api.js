const PARCELTRACK_API_URL = 'https://script.google.com/macros/s/AKfycbyOZpnkHZUu13TURsRMx4cuwkpN5JqPzHE2Fc6bBe_yyAAwIV9pGQqmwWoN8220aqMGgA/exec';

class ApiService {
  async sendSyncItem(syncItem) {
    if (!PARCELTRACK_API_URL || PARCELTRACK_API_URL.includes('TU_SCRIPT_ID_AQUI')) return;
    try {
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
    } catch (error) {
      console.error('Error enviando item a Google Drive:', error);
      throw error;
    }
  }

  async getRemoteBackup() {
    if (!PARCELTRACK_API_URL || PARCELTRACK_API_URL.includes('TU_SCRIPT_ID_AQUI')) return null;
    try {
      const storeId = storeManager.getCurrentStoreId();
      const response = await fetch(`${PARCELTRACK_API_URL}?storeId=${storeId}&action=getBackup`, { method: 'GET', mode: 'cors' });
      return await response.json();
    } catch (error) {
      console.error('Error obteniendo respaldo remoto:', error);
      return null;
    }
  }
}

const api = new ApiService();
