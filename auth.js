// Gestionnaire d'authentification centralisé
class AuthManager {
    constructor() {
        this.checkAuthStatus();
        this.addLogoutButton();
    }

    // Vérifier le statut d'authentification
    checkAuthStatus() {
        const isAdmin = sessionStorage.getItem('admin_authenticated') === 'true';
        const authTime = sessionStorage.getItem('admin_auth_time');
        const currentTime = Date.now();
        
        // Session expire après 4 heures
        if (isAdmin && authTime && (currentTime - parseInt(authTime)) < 14400000) {
            this.showAdminButtons();
            this.showLogoutButton();
        } else {
            this.hideAdminButtons();
            this.hideLogoutButton();
            // Nettoyer si expiré
            if (authTime && (currentTime - parseInt(authTime)) >= 14400000) {
                this.logout();
            }
        }
    }

    // Authentifier depuis la page admin
    authenticate(password) {
        if (password === 'tlm@TLM') {
            sessionStorage.setItem('admin_authenticated', 'true');
            sessionStorage.setItem('admin_auth_time', Date.now().toString());
            this.showAdminButtons();
            this.showLogoutButton();
            return true;
        }
        return false;
    }

    // Déconnexion
    logout() {
        sessionStorage.removeItem('admin_authenticated');
        sessionStorage.removeItem('admin_auth_time');
        this.hideAdminButtons();
        this.hideLogoutButton();
        
        // Rediriger vers navigation si on est sur admin
        if (window.location.pathname.includes('admin.html')) {
            window.location.href = 'navigation.html';
        }
    }

    // Vérifier si admin
    isAdmin() {
        const isAuth = sessionStorage.getItem('admin_authenticated') === 'true';
        const authTime = sessionStorage.getItem('admin_auth_time');
        const currentTime = Date.now();
        
        // Vérifier expiration
        if (isAuth && authTime && (currentTime - parseInt(authTime)) >= 14400000) {
            this.logout();
            return false;
        }
        
        return isAuth;
    }

    // Afficher les boutons admin
    showAdminButtons() {
        document.querySelectorAll('.admin-only').forEach(el => {
            // Utiliser le bon type d'affichage selon l'élément
            if (el.classList.contains('course-admin-actions')) {
                el.style.display = 'flex';
            } else {
                el.style.display = 'inline-block';
            }
        });
        document.querySelectorAll('.admin-section').forEach(el => {
            el.style.display = 'block';
        });
    }

    // Masquer les boutons admin
    hideAdminButtons() {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'none';
        });
        document.querySelectorAll('.admin-section').forEach(el => {
            el.style.display = 'none';
        });
    }

    // Action protégée
    adminAction(callback) {
        if (this.isAdmin()) {
            callback();
        } else {
            alert('🔐 Action réservée aux administrateurs.\nConnectez-vous d\'abord via la page Administration.');
        }
    }

    // Ajouter le bouton de déconnexion
    addLogoutButton() {
        // Éviter les doublons
        if (document.getElementById('adminLogoutBtn')) return;

        const logoutBtn = document.createElement('div');
        logoutBtn.id = 'adminLogoutBtn';
        logoutBtn.className = 'admin-logout-btn';
        logoutBtn.style.display = 'none';
        logoutBtn.innerHTML = `
            <button onclick="authManager.logout()" class="logout-btn" title="Déconnexion administrateur">
                🚪 Déconnexion Admin
            </button>
        `;

        // Ajouter les styles
        const style = document.createElement('style');
        style.textContent = `
            .admin-logout-btn {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
            }
            
            .logout-btn {
                background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
                color: white;
                border: none;
                padding: 0.6rem 1rem;
                border-radius: 8px;
                cursor: pointer;
                font-size: 0.9rem;
                font-weight: 500;
                box-shadow: 0 2px 10px rgba(220, 53, 69, 0.3);
                transition: all 0.3s ease;
            }
            
            .logout-btn:hover {
                background: linear-gradient(135deg, #c82333 0%, #a71e2a 100%);
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(220, 53, 69, 0.4);
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(logoutBtn);
    }

    // Afficher le bouton de déconnexion
    showLogoutButton() {
        const btn = document.getElementById('adminLogoutBtn');
        if (btn) btn.style.display = 'block';
    }

    // Masquer le bouton de déconnexion
    hideLogoutButton() {
        const btn = document.getElementById('adminLogoutBtn');
        if (btn) btn.style.display = 'none';
    }

    // Obtenir le temps restant de session
    getSessionTimeRemaining() {
        const authTime = sessionStorage.getItem('admin_auth_time');
        if (!authTime) return 0;
        
        const elapsed = Date.now() - parseInt(authTime);
        const remaining = 14400000 - elapsed; // 4 heures en ms
        return Math.max(0, remaining);
    }

    // Formater le temps restant
    formatTimeRemaining() {
        const remaining = this.getSessionTimeRemaining();
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        return `${hours}h ${minutes}m`;
    }
}

// Instance globale
const authManager = new AuthManager();

// Vérifier périodiquement l'expiration (toutes les minutes)
setInterval(() => {
    if (authManager.isAdmin()) {
        authManager.checkAuthStatus();
    }
}, 60000);

console.log('🔐 Système d\'authentification initialisé');