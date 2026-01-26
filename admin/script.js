/*
==================================================
ARQUIVO: admin/script.js
MODULO: Logica do Painel de Administradores
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 2.0 - Security Hardened
IMPORTANTE: NAO REMOVER ESTE CABECALHO DE IDENTIFICACAO
==================================================
*/

// ===========================
// SECURITY UTILITIES
// ===========================

/**
 * Logger condicional - so exibe em desenvolvimento
 */
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const logger = {
    log: (...args) => isDev && console.log('[admin]', ...args),
    warn: (...args) => isDev && console.warn('[admin]', ...args),
    error: (msg, err) => {
        if (isDev) {
            console.error('[admin]', msg, err);
        } else {
            console.error('[admin]', typeof msg === 'string' ? msg.split('\n')[0] : msg);
        }
    }
};

/**
 * Gera ID seguro usando crypto
 */
function generateSecureId(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, n => chars[n % chars.length]).join('');
}

// ===========================
// FIREBASE CONFIGURATION
// SEGURANCA: Sem fallback hardcoded
// ===========================
const firebaseConfig = {
    apiKey: window.ENV_CONFIG?.FIREBASE_API_KEY,
    authDomain: window.ENV_CONFIG?.FIREBASE_AUTH_DOMAIN,
    projectId: window.ENV_CONFIG?.FIREBASE_PROJECT_ID,
    storageBucket: window.ENV_CONFIG?.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: window.ENV_CONFIG?.FIREBASE_MESSAGING_SENDER_ID,
    appId: window.ENV_CONFIG?.FIREBASE_APP_ID
};

// ===========================
// CONSTANTS
// ===========================
const SUPER_ADMIN_EMAIL = '3d3printers@gmail.com';
const COMPANY_USER_ID = window.ENV_CONFIG?.COMPANY_USER_ID || 'BdmqXJFgMja4SY6DRXdf3dMyzaq1';
const FUNCTIONS_URL = 'https://us-central1-imaginatech-servicos.cloudfunctions.net';

// ===========================
// STATE
// ===========================
const state = {
    db: null,
    auth: null,
    currentUser: null,
    admins: [],
    whatsappUsers: [],
    adminsListener: null,
    whatsappListener: null,
    pendingRemove: null // { type: 'admin'|'whatsapp', id: string }
};

// ===========================
// INITIALIZATION
// ===========================
function initializeFirebase() {
    try {
        // Validar configuracao antes de inicializar
        if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
            throw new Error('ENV_CONFIG nao carregado corretamente');
        }
        firebase.initializeApp(firebaseConfig);
        state.db = firebase.firestore();
        state.auth = firebase.auth();
        logger.log('Firebase inicializado');
        return true;
    } catch (error) {
        logger.error('Erro ao inicializar Firebase:', error);
        showToast('Erro ao conectar com o servidor', 'error');
        return false;
    }
}

// ===========================
// AUTHENTICATION
// ===========================
function setupAuthListener() {
    state.auth.onAuthStateChanged(async (user) => {
        hideLoading();

        if (!user) {
            showScreen('login');
            return;
        }

        state.currentUser = user;

        // Verificar se e Super Admin
        if (user.email !== SUPER_ADMIN_EMAIL) {
            showAccessDenied(user.email);
            return;
        }

        // Super Admin autorizado
        showScreen('dashboard');
        updateUserInfo(user);
        setupRealtimeListeners();
        loadSystemInfo();
    });
}

function signInWithGoogle() {
    showLoading('Autenticando...');
    const provider = new firebase.auth.GoogleAuthProvider();
    state.auth.signInWithPopup(provider)
        .then(result => {
            // SEGURANCA: Verificar se o email foi verificado
            if (result.user && !result.user.emailVerified) {
                logger.warn('Email nao verificado:', result.user.email);
                state.auth.signOut();
                hideLoading();
                showToast('Seu email precisa ser verificado. Verifique sua caixa de entrada.', 'error');
                return;
            }
        })
        .catch((error) => {
            hideLoading();
            logger.error('Erro no login:', error);
            showToast('Erro ao fazer login', 'error');
        });
}

function signOut() {
    // Remover listeners
    if (state.adminsListener) state.adminsListener();
    if (state.whatsappListener) state.whatsappListener();

    state.auth.signOut()
        .then(() => {
            state.currentUser = null;
            state.admins = [];
            state.whatsappUsers = [];
            showScreen('login');
        })
        .catch((error) => {
            logger.error('Erro no logout:', error);
            showToast('Erro ao fazer logout', 'error');
        });
}

// ===========================
// SCREEN MANAGEMENT
// ===========================
function showScreen(screen) {
    // Login e Access Denied usam .active (CSS compartilhado)
    document.getElementById('loginScreen').classList.toggle('active', screen === 'login');
    document.getElementById('accessDeniedScreen').classList.toggle('active', screen === 'denied');
    // Dashboard usa .hidden
    document.getElementById('dashboard').classList.toggle('hidden', screen !== 'dashboard');
}

function showAccessDenied(email) {
    document.getElementById('deniedUserEmail').textContent = email;
    showScreen('denied');
}

function updateUserInfo(user) {
    document.getElementById('userName').textContent = user.displayName || 'Super Admin';
    const photoEl = document.getElementById('userPhoto');
    if (user.photoURL) {
        photoEl.src = user.photoURL;
    } else {
        photoEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'SA')}&background=00D4FF&color=fff&bold=true&size=128`;
    }
}

// ===========================
// LOADING & TOAST
// ===========================
function showLoading(text = 'Carregando...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = overlay.querySelector('.loading-text');
    if (loadingText) loadingText.textContent = text;
    overlay.classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===========================
// TABS
// ===========================
function switchTab(tabName) {
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
}

// ===========================
// REALTIME LISTENERS
// ===========================
function setupRealtimeListeners() {
    // Listener para admins
    state.adminsListener = state.db.collection('admins')
        .onSnapshot((snapshot) => {
            state.admins = snapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data()
            }));
            renderAdmins();
            updateStats();
        }, (error) => {
            logger.error('Erro no listener de admins:', error);
        });

    // Listener para whatsappUsers
    state.whatsappListener = state.db.collection('whatsappUsers')
        .onSnapshot((snapshot) => {
            state.whatsappUsers = snapshot.docs.map(doc => ({
                number: doc.id,
                ...doc.data()
            }));
            renderWhatsAppUsers();
            updateStats();
        }, (error) => {
            logger.error('Erro no listener de WhatsApp:', error);
        });
}

// ===========================
// RENDER ADMINS
// ===========================
function renderAdmins() {
    const grid = document.getElementById('adminsGrid');
    const emptyState = document.getElementById('adminsEmptyState');

    if (state.admins.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    // Ordenar: Super Admin primeiro, depois por nome
    const sorted = [...state.admins].sort((a, b) => {
        if (a.email === SUPER_ADMIN_EMAIL) return -1;
        if (b.email === SUPER_ADMIN_EMAIL) return 1;
        return (a.name || '').localeCompare(b.name || '');
    });

    grid.innerHTML = sorted.map(admin => {
        const isSuperAdmin = admin.email === SUPER_ADMIN_EMAIL;
        const photoURL = admin.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(admin.name || 'A')}&background=00D4FF&color=fff&bold=true&size=128`;
        const createdAt = admin.createdAt?.toDate?.() || new Date();
        const dateStr = createdAt.toLocaleDateString('pt-BR');

        return `
            <div class="admin-card">
                <div class="admin-card-header">
                    <img src="${photoURL}" alt="${escapeHtml(admin.name || '')}" class="admin-avatar" data-fallback="https://ui-avatars.com/api/?name=${encodeURIComponent(admin.name || 'A')}&background=00D4FF&color=fff&bold=true&size=128">
                    <div class="admin-info">
                        <div class="admin-name">
                            ${escapeHtml(admin.name || 'Sem nome')}
                            ${isSuperAdmin ? '<span class="admin-badge"><i class="fas fa-crown"></i> Super</span>' : ''}
                        </div>
                        <div class="admin-email">${escapeHtml(admin.email)}</div>
                    </div>
                </div>
                <div class="admin-card-footer">
                    <div class="admin-date">
                        <i class="fas fa-calendar"></i>
                        Adicionado em ${dateStr}
                    </div>
                    <button class="btn-remove-admin" data-action="remove-admin" data-id="${escapeHtml(admin.uid)}" ${isSuperAdmin ? 'disabled title="Super Admin nao pode ser removido"' : ''}>
                        <i class="fas fa-trash"></i>
                        Remover
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ===========================
// RENDER WHATSAPP USERS
// ===========================
function renderWhatsAppUsers() {
    const list = document.getElementById('whatsappList');
    const emptyState = document.getElementById('whatsappEmptyState');

    if (state.whatsappUsers.length === 0) {
        list.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    list.innerHTML = state.whatsappUsers.map(user => {
        const createdAt = user.createdAt?.toDate?.() || new Date();
        const dateStr = createdAt.toLocaleDateString('pt-BR');

        return `
            <div class="whatsapp-item">
                <div class="whatsapp-icon">
                    <i class="fab fa-whatsapp"></i>
                </div>
                <div class="whatsapp-info">
                    <div class="whatsapp-number">${formatPhoneNumber(user.number)}</div>
                    <div class="whatsapp-user">${escapeHtml(user.userName || 'Sem nome')} (${escapeHtml(user.email || '-')})</div>
                    <div class="whatsapp-date">Vinculado em ${dateStr}</div>
                </div>
                <button class="btn-remove-whatsapp" data-action="remove-whatsapp" data-id="${escapeHtml(user.number)}">
                    <i class="fas fa-unlink"></i>
                    Desvincular
                </button>
            </div>
        `;
    }).join('');
}

// ===========================
// SYSTEM INFO
// ===========================
function loadSystemInfo() {
    document.getElementById('companyUserId').textContent = COMPANY_USER_ID;
    document.getElementById('companyEmail').textContent = SUPER_ADMIN_EMAIL;
}

function updateStats() {
    document.getElementById('statAdmins').textContent = state.admins.filter(a => a.active !== false).length;
    document.getElementById('statWhatsApp').textContent = state.whatsappUsers.length;
}

// ===========================
// ADMIN CRUD
// ===========================
function openAddAdminModal() {
    document.getElementById('addAdminForm').reset();
    document.getElementById('addAdminModal').classList.add('show');
}

function closeAddAdminModal() {
    document.getElementById('addAdminModal').classList.remove('show');
}

async function handleAddAdmin(event) {
    event.preventDefault();

    const email = document.getElementById('adminEmail').value.trim().toLowerCase();
    const name = document.getElementById('adminName').value.trim();

    if (!email || !name) {
        showToast('Preencha todos os campos', 'warning');
        return;
    }

    // Verificar se ja existe admin com esse email
    const existingAdmin = state.admins.find(a => a.email === email);
    if (existingAdmin) {
        showToast('Ja existe um admin com este email', 'warning');
        return;
    }

    const btnSave = document.getElementById('btnSaveAdmin');
    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adicionando...';

    try {
        // Buscar o UID do usuario pelo email usando a API Admin
        // Como nao temos acesso direto ao Admin SDK no cliente,
        // vamos criar o documento usando o email como referencia temporaria
        // e depois o sistema pode atualizar quando o usuario logar

        // Gerar um UID temporario baseado no email (sera atualizado no primeiro login)
        const tempUid = 'pending_' + btoa(email).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);

        await state.db.collection('admins').doc(tempUid).set({
            email: email,
            name: name,
            active: true,
            photoURL: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdBy: state.currentUser.email,
            pendingUidUpdate: true // Flag para indicar que o UID precisa ser atualizado
        });

        showToast(`Admin ${name} adicionado com sucesso`, 'success');
        closeAddAdminModal();

    } catch (error) {
        logger.error('Erro ao adicionar admin:', error);
        showToast('Erro ao adicionar administrador', 'error');
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = '<i class="fas fa-plus"></i> Adicionar';
    }
}

function requestRemoveAdmin(uid) {
    const admin = state.admins.find(a => a.uid === uid);
    if (!admin) return;

    if (admin.email === SUPER_ADMIN_EMAIL) {
        showToast('Super Admin nao pode ser removido', 'warning');
        return;
    }

    state.pendingRemove = { type: 'admin', id: uid };
    document.getElementById('confirmMessage').textContent = `Deseja remover ${admin.name || admin.email} da lista de administradores?`;
    document.getElementById('confirmRemoveModal').classList.add('show');
}

// ===========================
// WHATSAPP CRUD
// ===========================
function openAddWhatsAppModal() {
    document.getElementById('addWhatsAppForm').reset();
    document.getElementById('addWhatsAppModal').classList.add('show');
}

function closeAddWhatsAppModal() {
    document.getElementById('addWhatsAppModal').classList.remove('show');
}

async function handleAddWhatsApp(event) {
    event.preventDefault();

    const number = document.getElementById('whatsappNumber').value.trim().replace(/\D/g, '');
    const email = document.getElementById('whatsappEmail').value.trim().toLowerCase();
    const name = document.getElementById('whatsappName').value.trim();

    if (!number || !email) {
        showToast('Preencha os campos obrigatorios', 'warning');
        return;
    }

    if (number.length < 12 || number.length > 13) {
        showToast('Numero invalido. Use formato: 5521999999999', 'warning');
        return;
    }

    // Verificar se ja existe
    if (state.whatsappUsers.find(u => u.number === number)) {
        showToast('Este numero ja esta vinculado', 'warning');
        return;
    }

    const btnSave = document.getElementById('btnSaveWhatsApp');
    btnSave.disabled = true;
    btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vinculando...';

    try {
        // Chamar a Cloud Function para registrar
        const token = await state.currentUser.getIdToken();

        const response = await fetch(`${FUNCTIONS_URL}/registerWhatsAppUser`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                whatsappNumber: number,
                email: email,
                userName: name || email.split('@')[0]
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || result.error || 'Erro ao vincular numero');
        }

        showToast('Numero vinculado com sucesso', 'success');
        closeAddWhatsAppModal();

    } catch (error) {
        logger.error('Erro ao vincular WhatsApp:', error);
        showToast(error.message || 'Erro ao vincular numero', 'error');
    } finally {
        btnSave.disabled = false;
        btnSave.innerHTML = '<i class="fas fa-link"></i> Vincular';
    }
}

function requestRemoveWhatsApp(number) {
    const user = state.whatsappUsers.find(u => u.number === number);
    if (!user) return;

    state.pendingRemove = { type: 'whatsapp', id: number };
    document.getElementById('confirmMessage').textContent = `Deseja desvincular o numero ${formatPhoneNumber(number)}?`;
    document.getElementById('confirmRemoveModal').classList.add('show');
}

// ===========================
// CONFIRM REMOVE
// ===========================
function closeConfirmRemoveModal() {
    document.getElementById('confirmRemoveModal').classList.remove('show');
    state.pendingRemove = null;
}

async function confirmRemove() {
    if (!state.pendingRemove) return;

    const { type, id } = state.pendingRemove;
    const btnConfirm = document.getElementById('btnConfirmRemove');

    btnConfirm.disabled = true;
    btnConfirm.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Removendo...';

    try {
        if (type === 'admin') {
            await state.db.collection('admins').doc(id).delete();
            showToast('Administrador removido', 'success');
        } else if (type === 'whatsapp') {
            // Chamar Cloud Function para remover
            const token = await state.currentUser.getIdToken();

            const response = await fetch(`${FUNCTIONS_URL}/registerWhatsAppUser?whatsappNumber=${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.message || 'Erro ao desvincular');
            }

            showToast('Numero desvinculado', 'success');
        }

        closeConfirmRemoveModal();

    } catch (error) {
        logger.error('Erro ao remover:', error);
        showToast(error.message || 'Erro ao remover', 'error');
    } finally {
        btnConfirm.disabled = false;
        btnConfirm.innerHTML = '<i class="fas fa-trash"></i> Remover';
    }
}

// ===========================
// UTILITY FUNCTIONS
// ===========================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatPhoneNumber(number) {
    if (!number) return '-';
    // Formato: +55 (21) 99999-9999
    const clean = number.replace(/\D/g, '');
    if (clean.length === 13) {
        return `+${clean.substring(0, 2)} (${clean.substring(2, 4)}) ${clean.substring(4, 9)}-${clean.substring(9)}`;
    } else if (clean.length === 12) {
        return `+${clean.substring(0, 2)} (${clean.substring(2, 4)}) ${clean.substring(4, 8)}-${clean.substring(8)}`;
    }
    return number;
}

// ===========================
// MOBILE MENU (from shared)
// ===========================
function toggleMobileMenu() {
    const dropdown = document.getElementById('mobileNavDropdown');
    const btn = document.getElementById('btnMobileMenu');
    if (dropdown && btn) {
        dropdown.classList.toggle('show');
        btn.classList.toggle('active');
    }
}

// ===========================
// INIT
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    if (initializeFirebase()) {
        setupAuthListener();
    }

    // Event delegation para data-action
    setupGlobalEventDelegation();

    // Fechar modais ao clicar fora
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });

    // Fechar modais com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.show').forEach(modal => {
                modal.classList.remove('show');
            });
        }
    });
});

// ===========================
// EVENT DELEGATION (Seguranca: evita onclick inline)
// ===========================
function setupGlobalEventDelegation() {
    // Handler para clicks em elementos com data-action
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;

        const action = el.dataset.action;
        const value = el.dataset.value;

        const handlers = {
            // Autenticacao
            'sign-in-google': () => signInWithGoogle(),
            'sign-out': () => signOut(),

            // Navegacao
            'toggle-mobile-menu': () => toggleMobileMenu(),
            'switch-tab': () => switchTab(value),

            // Modal Admin
            'open-add-admin-modal': () => openAddAdminModal(),
            'close-add-admin-modal': () => closeAddAdminModal(),

            // Modal WhatsApp
            'open-add-whatsapp-modal': () => openAddWhatsAppModal(),
            'close-add-whatsapp-modal': () => closeAddWhatsAppModal(),

            // Modal Confirmacao
            'close-confirm-remove-modal': () => closeConfirmRemoveModal(),
            'confirm-remove': () => confirmRemove(),

            // Acoes em cards (delegadas do grid)
            'remove-admin': () => {
                const adminId = el.dataset.id;
                if (adminId) requestRemoveAdmin(adminId);
            },
            'remove-whatsapp': () => {
                const whatsappId = el.dataset.id;
                if (whatsappId) requestRemoveWhatsApp(whatsappId);
            }
        };

        if (handlers[action]) {
            e.preventDefault();
            handlers[action]();
        }
    });

    // Handler para submit em forms com data-form
    document.addEventListener('submit', (e) => {
        const form = e.target.closest('[data-form]');
        if (!form) return;

        e.preventDefault();
        const formType = form.dataset.form;

        if (formType === 'add-admin') {
            handleAddAdmin(e);
        } else if (formType === 'add-whatsapp') {
            handleAddWhatsApp(e);
        }
    });

    // Handler para fallback de imagens (substitui onerror inline)
    document.addEventListener('error', (e) => {
        if (e.target.tagName === 'IMG' && e.target.dataset.fallback) {
            e.target.src = e.target.dataset.fallback;
            e.target.removeAttribute('data-fallback'); // Evita loop infinito
        }
    }, true);

    logger.log('Event delegation configurado');
}

// Expor funcoes globais
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.switchTab = switchTab;
window.openAddAdminModal = openAddAdminModal;
window.closeAddAdminModal = closeAddAdminModal;
window.handleAddAdmin = handleAddAdmin;
window.requestRemoveAdmin = requestRemoveAdmin;
window.openAddWhatsAppModal = openAddWhatsAppModal;
window.closeAddWhatsAppModal = closeAddWhatsAppModal;
window.handleAddWhatsApp = handleAddWhatsApp;
window.requestRemoveWhatsApp = requestRemoveWhatsApp;
window.closeConfirmRemoveModal = closeConfirmRemoveModal;
window.confirmRemove = confirmRemove;
window.toggleMobileMenu = toggleMobileMenu;
