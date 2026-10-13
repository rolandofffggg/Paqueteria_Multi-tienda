class AuthManager {
  constructor() {
    this.currentUser = null;
  }

  async init() {
    const storedUser = sessionStorage.getItem('pt_user') || localStorage.getItem('pt_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        const dbUser = await db.get('users', user.username.toLowerCase());
        if (dbUser && dbUser.status === 'ACTIVE') {
          this.currentUser = dbUser;
          this.applyRolePermissions();
          return true;
        }
      } catch (e) {
        console.error('Error al restaurar sesión:', e);
      }
    }
    this.logout();
    return false;
  }

  async login(usernameInput, pinInput, remember = false) {
    const username = (usernameInput || '').toLowerCase().trim();
    const pin = (pinInput || '').trim();

    if (!username || !pin) {
      return { success: false, message: 'Ingrese usuario y clave/PIN.' };
    }

    // 1. S sincronizar y purgar usuarios obsoletos desde el servidor remoto si hay conexión
    if (navigator.onLine) {
      try {
        const remoteUsers = await api.getRemoteUsers();
        if (Array.isArray(remoteUsers) && remoteUsers.length > 0) {
          const remoteUsernames = remoteUsers.map(u => u.username.toLowerCase());
          const localUsers = await db.getAll('users');
          
          // Eliminar de IndexedDB local los usuarios que ya no existen en la planilla remota
          for (const locUser of localUsers) {
            if (!remoteUsernames.includes(locUser.username.toLowerCase())) {
              await db.delete('users', locUser.username);
            }
          }

          // Guardar / actualizar los usuarios vigentes de la nube
          for (const u of remoteUsers) {
            await db.put('users', u);
          }
        }
      } catch (err) {
        console.warn('No se pudo sincronizar usuarios en línea:', err);
      }
    }

    // 2. Buscar usuario en IndexedDB local ya actualizado
    let user = await db.get('users', username);

    if (!user) {
      return { success: false, message: 'Usuario no encontrado. Verifique el nombre.' };
    }

    // Convertir ambos a String para evitar errores de comparación entre números y texto
    if (String(user.pin).trim() !== String(pin).trim()) {
      return { success: false, message: 'Clave / PIN incorrecto.' };
    }

    if (user.status === 'BLOCKED') {
      return { success: false, message: 'Cuenta bloqueada. Contacte al administrador.' };
    }

    this.currentUser = user;
    const sessionData = JSON.stringify({ 
      username: user.username, 
      role: user.role, 
      fullName: user.fullName 
    });
    
    if (remember) {
      localStorage.setItem('pt_user', sessionData);
    } else {
      sessionStorage.setItem('pt_user', sessionData);
    }

    this.applyRolePermissions();
    return { success: true, user };
  }

  logout() {
    this.currentUser = null;
    sessionStorage.removeItem('pt_user');
    localStorage.removeItem('pt_user');
    
    // Ocultar vistas principales y mostrar el login
    const viewLogin = document.getElementById('view-login');
    if (viewLogin) viewLogin.classList.remove('hidden');

    const userLabel = document.getElementById('session-user-label');
    if (userLabel) userLabel.textContent = 'Sin Sesión';
  }

  getUser() {
    return this.currentUser;
  }

  isAdmin() {
    return this.currentUser && (this.currentUser.role === 'ADMIN' || this.currentUser.role === 'ADM');
  }

  hasAccess(tabId) {
    if (!this.currentUser) return false;

    // Si es Administrador, tiene acceso total a todos los módulos
    if (this.isAdmin()) {
      return true;
    }

    // Si es Operador, restringir exclusivamente a los 5 módulos permitidos:
    // Dashboard, Recepción, Notificar, Ubicación y Entrega.
    const allowedTabsForOperator = [
      'sec-dashboard',     // Dashboard
      'sec-manage', // Si deseas permitir gestion básica o restringir módulos específicos
      'sec-reception',     // Recepción
      'sec-print-notify',  // Notificar
      'sec-inventory',     // Ubicación
      'sec-delivery'       // Entrega
    ];

    return allowedTabsForOperator.includes(tabId);
  }

  getUserShortLabel() {
    if (!this.currentUser) return '';
    const isAdminRole = this.isAdmin();
    const roleShort = isAdminRole ? 'Adm.' : 'Ope.';
    const firstName = (this.currentUser.fullName || this.currentUser.username).split(' ')[0];
    return `${roleShort} ${firstName}`;
  }

  applyRolePermissions() {
    const adminNavButtons = document.querySelectorAll('.nav-admin-only');
    const isAdminRole = this.isAdmin();

    adminNavButtons.forEach(btn => {
      if (isAdminRole) {
        btn.classList.remove('hidden');
      } else {
        btn.classList.add('hidden');
      }
    });

    const userLabel = document.getElementById('session-user-label');
    if (userLabel && this.currentUser) {
      userLabel.textContent = this.getUserShortLabel();
    }
  }
}

const auth = new AuthManager();
