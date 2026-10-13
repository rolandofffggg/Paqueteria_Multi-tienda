class StoreManager {
  constructor() {
    this.currentStoreId = 'LAPAZ';
  }

  async init() {
    const stored = sessionStorage.getItem('pt_storeId') || localStorage.getItem('pt_storeId');
    if (stored) {
      this.currentStoreId = stored;
    } else {
      this.currentStoreId = 'LAPAZ';
    }
    await this.renderStoreSelector();
    return this.currentStoreId;
  }

  getCurrentStoreId() {
    return this.currentStoreId;
  }

  async setStoreId(storeId) {
    this.currentStoreId = storeId;
    localStorage.setItem('pt_storeId', storeId);
    sessionStorage.setItem('pt_storeId', storeId);
    
    // Disparar recarga de datos en la app
    if (typeof app !== 'undefined') {
      await app.initStoreContext();
    }
  }

  async renderStoreSelector() {
    const stores = await db.getAll('stores');
    const headerTitle = document.getElementById('header-app-title');
    if (!headerTitle) return;

    // Crear o actualizar selector visual de sucursal en el header
    let selectEl = document.getElementById('store-selector-dropdown');
    if (!selectEl) {
      selectEl = document.createElement('select');
      selectEl.id = 'store-selector-dropdown';
      selectEl.className = 'bg-slate-800 text-blue-300 font-bold text-xs px-2 py-1 rounded-lg border border-slate-700 outline-none ml-2';
      selectEl.onchange = async (e) => {
        await this.setStoreId(e.target.value);
        location.reload();
      };
      headerTitle.parentNode.insertBefore(selectEl, headerTitle.nextSibling);
    }

    selectEl.innerHTML = stores.map(s => `
      <option value="${s.storeId}" ${s.storeId === this.currentStoreId ? 'selected' : ''}>🏢 ${s.name}</option>
    `).join('');
  }
}

const storeManager = new StoreManager();
