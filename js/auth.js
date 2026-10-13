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

    let user = await db.get('users', username);

    if (!user) {
      return { success: false, message: 'Usuario no encontrado. Verifique el nombre.' };
    }

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
    if (this.isAdmin()) return true;

    const allowedTabsForOperator = [
      'sec-dashboard',
      'sec-reception',
      'sec-print-notify',
      'sec-inventory',
      'sec-delivery'
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
