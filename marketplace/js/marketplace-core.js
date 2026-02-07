/*
==================================================
ARQUIVO: marketplace/js/marketplace-core.js
MODULO: Firebase, Autenticacao e State Management
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 2.0 - Security Hardened (2026-01-25)
==================================================
*/

// ========== LOGGER CENTRALIZADO (FIRESTORE) ==========
// Carregado via /shared/firestore-logger.js
const logger = window.logger || {
    log: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
};

// ========== SEGURANCA: MASCARA LGPD ==========
function maskEmail(email) {
    if (!email) return '[sem email]';
    const parts = email.split('@');
    if (parts.length !== 2) return '[email invalido]';
    const name = parts[0];
    const masked = name.length > 2 ? name.substring(0, 2) + '***' : '***';
    return `${masked}@${parts[1]}`;
}
window.maskEmail = maskEmail;

// ========== SEGURANCA: SANITIZAR URL DE IMAGEM ==========
// NAO usar escapeHtml em URLs - converte & para &amp; e quebra a URL
function sanitizeImageUrl(url) {
    if (!url) return '';
    // Permitir data: e blob: URLs
    if (url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }
    try {
        const parsed = new URL(url);
        // Apenas permitir http e https
        if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
            // Forcar HTTPS para seguranca
            parsed.protocol = 'https:';
            return parsed.href;
        }
        logger.warn('[FOTO] Protocolo nao permitido:', parsed.protocol);
        return '';
    } catch (e) {
        logger.error('[FOTO] URL invalida:', url?.substring(0, 50));
        return '';
    }
}
window.sanitizeImageUrl = sanitizeImageUrl;

// ========== CONFIGURACAO FIREBASE (SEGURANCA: Fail-secure) ==========
if (!window.ENV_CONFIG) {
    logger.error('[FATAL] ENV_CONFIG nao carregado. Verifique env-config.js');
    document.body.innerHTML = '<div style="color:red;padding:2rem;text-align:center;font-family:sans-serif;"><h1>Erro de Configuracao</h1><p>Configuracoes do sistema nao carregadas. Contate o suporte.</p></div>';
    throw new Error('ENV_CONFIG required - no hardcoded credentials allowed');
}

// Validar campos obrigatorios
const requiredKeys = ['FIREBASE_API_KEY', 'FIREBASE_AUTH_DOMAIN', 'FIREBASE_PROJECT_ID'];
const missingKeys = requiredKeys.filter(key => !window.ENV_CONFIG[key]);
if (missingKeys.length > 0) {
    logger.error('[FATAL] Chaves Firebase ausentes:', missingKeys.join(', '));
    throw new Error('Firebase config incomplete');
}

const firebaseConfig = {
    apiKey: window.ENV_CONFIG.FIREBASE_API_KEY,
    authDomain: window.ENV_CONFIG.FIREBASE_AUTH_DOMAIN,
    projectId: window.ENV_CONFIG.FIREBASE_PROJECT_ID,
    storageBucket: window.ENV_CONFIG.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: window.ENV_CONFIG.FIREBASE_MESSAGING_SENDER_ID,
    appId: window.ENV_CONFIG.FIREBASE_APP_ID
};

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();

// ========== CONSTANTES ==========
const COMPANY_USER_ID = window.ENV_CONFIG?.COMPANY_USER_ID || '';

// SEGURANCA: Admins carregados EXCLUSIVAMENTE do Firestore - sem fallback hardcoded
let AUTHORIZED_ADMINS = [];
let AUTHORIZED_EMAILS = [];
let adminsLoaded = false;
let adminsLoadFailed = false;

// Carrega admins do Firestore (OBRIGATORIO antes de verificar autorizacao)
async function loadAuthorizedAdmins() {
    if (adminsLoaded) return;
    try {
        if (window.ENV_CONFIG?.loadAdmins) {
            const admins = await window.ENV_CONFIG.loadAdmins(db);
            if (admins && admins.length > 0) {
                AUTHORIZED_ADMINS = admins;
                AUTHORIZED_EMAILS = admins.map(a => a.email);
                adminsLoaded = true;
                logger.log('[marketplace] Admins carregados:', AUTHORIZED_ADMINS.length);
                return;
            }
        }
        // Fallback: carregar diretamente do Firestore
        const snapshot = await db.collection('admins')
            .where('active', '==', true)
            .get();

        if (!snapshot.empty) {
            AUTHORIZED_ADMINS = snapshot.docs.map(doc => ({
                uid: doc.id,
                email: doc.data().email,
                name: doc.data().name
            }));
            AUTHORIZED_EMAILS = AUTHORIZED_ADMINS.map(a => a.email);
            adminsLoaded = true;
            logger.log('[marketplace] Admins carregados do Firestore:', AUTHORIZED_ADMINS.length);
        } else {
            logger.error('[marketplace] ERRO: Nenhum admin encontrado no Firestore');
            adminsLoadFailed = true;
        }
    } catch (error) {
        logger.error('[marketplace] Erro ao carregar admins:', error);
        adminsLoadFailed = true;
    }
}

// ========== ESTOQUE (FILAMENTOS E IMPRESSORAS) ==========
let availableFilaments = [];
let filamentsListener = null;
let printerEquipment = [];
let equipmentListener = null;

// ========== OPCOES DE PRODUCAO (FALLBACK) ==========
const PRINT_COLORS = [
    'Branco',
    'Preto',
    'Cinza Claro',
    'Cinza Escuro',
    'Prata',
    'Vermelho',
    'Vermelho Metalico',
    'Vermelho Translucido',
    'Rosa',
    'Rosa Metalico',
    'Rosa Pastel',
    'Laranja',
    'Laranja Metalico',
    'Amarelo',
    'Amarelo Metalico',
    'Dourado',
    'Verde',
    'Verde Claro',
    'Verde Escuro',
    'Verde Metalico',
    'Verde Translucido',
    'Azul',
    'Azul Claro',
    'Azul Marinho',
    'Azul Royal',
    'Azul Metalico',
    'Azul Translucido',
    'Ciano',
    'Turquesa',
    'Roxo',
    'Roxo Metalico',
    'Lilas',
    'Magenta',
    'Marrom',
    'Marrom Escuro',
    'Bege',
    'Nude',
    'Pele Clara',
    'Pele Media',
    'Pele Escura',
    'Madeira Clara',
    'Madeira Escura',
    'Madeira Cerejeira',
    'Marmore Branco',
    'Marmore Preto',
    'Transparente',
    'Transparente Azul',
    'Transparente Vermelho',
    'Transparente Verde',
    'Fosforescente Verde',
    'Fosforescente Azul',
    'Arco-iris',
    'Multicolor',
    'Glitter Prata',
    'Glitter Dourado',
    'Cromado',
    'Bronze',
    'Cobre',
    'Personalizado'
];

const MATERIALS = [
    'PLA',
    'PLA+',
    'PLA Silk',
    'PLA Matte',
    'PLA Wood',
    'PLA Marble',
    'PLA Glow',
    'PLA Flex',
    'ABS',
    'ABS+',
    'ASA',
    'PETG',
    'PETG Translucido',
    'TPU 95A',
    'TPU 85A',
    'TPE',
    'Nylon PA6',
    'Nylon PA12',
    'PC (Policarbonato)',
    'PP (Polipropileno)',
    'PVA',
    'HIPS',
    'Resina Standard',
    'Resina ABS-Like',
    'Resina Flexivel',
    'Resina Dental',
    'Resina Castable',
    'Resina Transparente',
    'Outros'
];

// Equipamentos (carregados do Firestore)
let equipment = [];

// ========== STATE GLOBAL ==========
let currentUser = null;
let products = [];
let productsListener = null;
let editingProductId = null;
let currentFilters = {
    search: '',
    saleType: '',
    material: ''
};

// ========== ELEMENTOS DOM ==========
const elements = {
    loadingOverlay: null,
    loginScreen: null,
    accessDeniedScreen: null,
    dashboard: null,
    userPhoto: null,
    userName: null,
    userRole: null,
    deniedUserEmail: null,
    productModal: null,
    productForm: null,
    productsTableBody: null,
    emptyState: null,
    toastContainer: null
};

// ========== INICIALIZACAO ==========
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    setupAuthListener();
    populateDropdownOptions();
    setupEventDelegation();
});

// ========== SEGURANCA: EVENT DELEGATION ==========
function setupEventDelegation() {
    // Handler global para data-action (evita onclick inline)
    document.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;

        // Mapa de acoes -> funcoes
        const actions = {
            // Autenticacao
            'sign-in-google': () => signInWithGoogle(),
            'sign-out': () => signOut(),

            // Navegacao
            'toggle-mobile-menu': () => window.toggleMobileMenu?.(),
            'switch-tab': () => {
                const tab = actionEl.dataset.tab;
                if (tab && window.switchTab) window.switchTab(tab);
            },

            // Mercado Livre
            'connect-ml': () => window.connectMl?.(),
            'close-link-mlb-modal': () => window.closeLinkMlbModal?.(),
            'save-mlb-link': () => window.saveMlbLink?.(),

            // Produtos
            'new-product': () => window.openNewProductChoiceModal?.(),
            'close-product-modal': () => window.closeProductModal?.(),
            'clear-filters': () => window.clearFilters?.(),
            'copy-pending-to-description': () => window.copyPendingToDescription?.(),

            // 3MF Manager
            'upload-3mf': () => {
                const printerName = actionEl.dataset.printer;
                if (printerName && window.triggerThreeMfUpload) window.triggerThreeMfUpload(printerName);
            },
            'remove-3mf': () => {
                const printerName = actionEl.dataset.printer;
                if (printerName && window.removeThreeMf) window.removeThreeMf(printerName);
            },
            'download-3mf': () => {
                const printerName = actionEl.dataset.printer;
                if (printerName && window.downloadThreeMf) window.downloadThreeMf(printerName);
            },

            // Modal Novo Produto
            'close-new-product-choice-modal': () => window.closeNewProductChoiceModal?.(),
            'create-blank-product': () => window.createBlankProduct?.(),
            'show-ml-import-list': () => window.showMlImportList?.(),
            'hide-ml-import-list': () => window.hideMlImportList?.(),
            'import-from-ml': () => {
                const mlbId = actionEl.dataset.mlbId;
                if (mlbId && window.importFromMl) window.importFromMl(mlbId);
            },

            // Pedidos
            'load-pending-orders': () => window.loadPendingOrders?.(),
            'load-sales-history': () => window.loadSalesHistory?.(),
            'close-order-details-modal': () => window.closeOrderDetailsModal?.(),
            'view-order-details': () => {
                const orderId = actionEl.dataset.orderId;
                if (orderId && window.viewOrderDetails) window.viewOrderDetails(orderId);
            },

            // Modais
            'close-material-details-modal': () => window.closeMaterialDetailsModal?.(),
            'close-description-editor-modal': () => window.closeDescriptionEditorModal?.(),

            // Editor de Descricao
            'copy-draft-to-published': () => window.copyDraftToPublished?.(),
            'copy-published-to-draft': () => window.copyPublishedToDraft?.(),
            'swap-descriptions': () => window.swapDescriptions?.(),
            'sync-description-from-editor': () => window.syncDescriptionFromEditor?.(),
            'open-desc-editor': () => {
                const productId = actionEl.dataset.id;
                if (productId && window.openDescriptionEditor) window.openDescriptionEditor(productId);
            },

            // Fotos
            'set-photo-main': () => {
                const index = parseInt(actionEl.dataset.index);
                if (!isNaN(index) && window.setPhotoAsMain) window.setPhotoAsMain(index);
            },
            'remove-photo': () => {
                const index = parseInt(actionEl.dataset.index);
                if (!isNaN(index) && window.removePhoto) window.removePhoto(index);
            },
            'open-photo': () => {
                const url = actionEl.dataset.url;
                if (url && window.openPhotoFullscreen) window.openPhotoFullscreen(url);
            },

            // Acoes de produto na tabela
            'edit-product': () => {
                const productId = actionEl.dataset.id;
                if (productId && window.editProduct) window.editProduct(productId);
            },
            'delete-product': () => {
                const productId = actionEl.dataset.id;
                if (productId && window.deleteProduct) window.deleteProduct(productId);
            },
            'link-mlb': () => {
                const productId = actionEl.dataset.id;
                if (productId && window.openLinkMlbModal) window.openLinkMlbModal(productId);
            },
            'unlink-mlb': () => {
                const productId = actionEl.dataset.id;
                if (productId && window.unlinkMlb) window.unlinkMlb(productId);
            },

            // MLB Items selection (data-mlb-id vem do elemento pai .mlb-item)
            'select-mlb-item': () => {
                const mlbItem = actionEl.closest('.mlb-item') || actionEl;
                const mlbId = mlbItem.dataset.mlbId;
                if (mlbId && window.selectMlbItem) window.selectMlbItem(mlbId);
            },

            // Abrir pedido no ML
            'open-ml-order': () => {
                const orderId = actionEl.dataset.orderId;
                if (orderId) {
                    window.open(`https://www.mercadolivre.com.br/vendas/${orderId}/detalhe`, '_blank');
                }
            },

            // Printer grid toggle
            'toggle-printer': () => {
                const printerName = actionEl.dataset.printer;
                if (printerName) togglePrinterSelection(printerName);
            }
        };

        // Executar acao se existir
        const handler = actions[action];
        if (handler) {
            handler();
        } else {
            logger.warn('[EventDelegation] Acao nao reconhecida:', action);
        }
    });

    // Handler para change events (selects)
    document.addEventListener('change', (e) => {
        const actionEl = e.target.closest('[data-action-change]');
        if (!actionEl) return;

        const action = actionEl.dataset.actionChange;

        if (action === 'load-sales-history' && window.loadSalesHistory) {
            window.loadSalesHistory();
        }
    });

    // Handler para form submit (produto)
    const productForm = document.getElementById('productForm');
    if (productForm) {
        productForm.addEventListener('submit', (e) => {
            if (window.handleProductSubmit) {
                window.handleProductSubmit(e);
            }
        });
    }
}

function initializeElements() {
    elements.loadingOverlay = document.getElementById('loadingOverlay');
    elements.loginScreen = document.getElementById('loginScreen');
    elements.accessDeniedScreen = document.getElementById('accessDeniedScreen');
    elements.dashboard = document.getElementById('dashboard');
    elements.userPhoto = document.getElementById('userPhoto');
    elements.userName = document.getElementById('userName');
    elements.userRole = document.getElementById('userRole');
    elements.deniedUserEmail = document.getElementById('deniedUserEmail');
    elements.productModal = document.getElementById('productModal');
    elements.productForm = document.getElementById('productForm');
    elements.productsTableBody = document.getElementById('productsTableBody');
    elements.emptyState = document.getElementById('emptyState');
    elements.toastContainer = document.getElementById('toastContainer');
}

// ========== AUTENTICACAO ==========
function setupAuthListener() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // SEGURANCA: Carregar admins do Firestore antes de verificar autorizacao
            await loadAuthorizedAdmins();

            // Verificar se e admin
            if (isAuthorizedAdmin(user.email)) {
                currentUser = user;
                showDashboard(user);
                await loadProducts();
            } else {
                showAccessDenied(user);
            }
        } else {
            showLoginScreen();
        }
        hideLoading();
    });
}

// SEGURANCA: Retorna false se admins nao foram carregados corretamente
function isAuthorizedAdmin(email) {
    if (adminsLoadFailed || !adminsLoaded || AUTHORIZED_EMAILS.length === 0) {
        logger.warn('[marketplace] Verificacao de autorizacao antes de carregar admins');
        return false;
    }
    return AUTHORIZED_EMAILS.includes(email);
}

function getAdminName(email) {
    const admin = AUTHORIZED_ADMINS.find(a => a.email === email);
    return admin ? admin.name : email.split('@')[0];
}

async function signInWithGoogle() {
    try {
        showLoading();
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await auth.signInWithPopup(provider);

        // SEGURANCA: Verificar se o email foi verificado
        if (result.user && !result.user.emailVerified) {
            logger.warn('[Auth] Email nao verificado:', maskEmail(result.user.email));
            await auth.signOut();
            hideLoading();
            showToast('Seu email precisa ser verificado. Verifique sua caixa de entrada.', 'error');
            return;
        }
    } catch (error) {
        logger.error('Erro no login:', error);
        showToast('Erro ao fazer login', 'error');
        hideLoading();
    }
}

async function signOut() {
    try {
        showLoading();
        stopProductsListener();
        await auth.signOut();
        currentUser = null;
        products = [];
    } catch (error) {
        logger.error('Erro ao sair:', error);
        showToast('Erro ao sair', 'error');
        hideLoading();
    }
}

// ========== TELAS ==========
function showLoginScreen() {
    elements.loginScreen.classList.add('active');
    elements.accessDeniedScreen.classList.remove('active');
    elements.dashboard.classList.add('hidden');
}

function showAccessDenied(user) {
    elements.loginScreen.classList.remove('active');
    elements.accessDeniedScreen.classList.add('active');
    elements.dashboard.classList.add('hidden');
    elements.deniedUserEmail.textContent = user.email;
}

function showDashboard(user) {
    elements.loginScreen.classList.remove('active');
    elements.accessDeniedScreen.classList.remove('active');
    elements.dashboard.classList.remove('hidden');

    // Atualizar info do usuario
    elements.userPhoto.src = user.photoURL || '/assets/default-avatar.png';
    elements.userName.textContent = getAdminName(user.email);
    elements.userRole.textContent = 'Administrador';
}

// ========== LOADING ==========
function showLoading() {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.classList.remove('hidden');
    }
}

function hideLoading() {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.classList.add('hidden');
    }
}

// ========== TOAST ==========
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-times-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';

    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========== CARREGAR FILAMENTOS DO ESTOQUE ==========
function loadAvailableFilaments() {
    if (filamentsListener) {
        filamentsListener();
        filamentsListener = null;
    }

    filamentsListener = db.collection('filaments')
        .onSnapshot(snapshot => {
            availableFilaments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            logger.log('[FILAMENTS] Estoque atualizado:', availableFilaments.length, 'filamentos');
            updateMaterialDropdownFromStock();
        }, error => {
            logger.error('[FILAMENTS] Erro ao carregar:', error);
        });
}

// Atualiza dropdown de materiais baseado no estoque
function updateMaterialDropdownFromStock() {
    const materialSelect = document.getElementById('materialType');
    if (!materialSelect) return;

    // Filtrar apenas filamentos com estoque disponivel
    const inStock = availableFilaments.filter(f => f.weight > 0);

    // Obter tipos unicos de materiais
    const materials = [...new Set(inStock.map(f => f.type))].sort();

    const currentValue = materialSelect.value;

    // Limpar e popular
    materialSelect.innerHTML = '<option value="">Selecione o material</option>';

    if (materials.length === 0) {
        materialSelect.innerHTML += '<option value="" disabled>Sem materiais em estoque</option>';
    } else {
        materials.forEach(material => {
            const option = document.createElement('option');
            option.value = material;
            option.textContent = material;
            materialSelect.appendChild(option);
        });
    }

    // Restaurar valor se ainda existir
    if (currentValue && materials.includes(currentValue)) {
        setTimeout(() => {
            materialSelect.value = currentValue;
            materialSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }, 0);
    }
}

// Atualiza dropdown de cores baseado no material selecionado
function updateColorDropdownFromStock(selectedMaterial) {
    const colorSelect = document.getElementById('printColor');
    if (!colorSelect) return;

    // Filtrar filamentos pelo tipo e com estoque
    const filtered = availableFilaments.filter(f => {
        if (!selectedMaterial) return false;
        if (f.type !== selectedMaterial) return false;
        if (f.weight <= 0) return false;
        return true;
    });

    // Ordenar por cor e peso
    filtered.sort((a, b) => {
        const colorCompare = a.color.localeCompare(b.color);
        if (colorCompare !== 0) return colorCompare;
        return b.weight - a.weight;
    });

    // Contar cores para saber se precisa mostrar marca
    const colorCounts = {};
    filtered.forEach(f => {
        colorCounts[f.color] = (colorCounts[f.color] || 0) + 1;
    });

    const currentValue = colorSelect.value;
    colorSelect.innerHTML = '<option value="">Selecione a cor</option>';

    if (filtered.length === 0) {
        colorSelect.innerHTML += '<option value="" disabled>Sem estoque disponivel</option>';
    } else {
        filtered.forEach(filament => {
            const option = document.createElement('option');
            const weightGrams = (filament.weight * 1000).toFixed(0);
            const brand = filament.brand || 'S/marca';

            // Se ha multiplos da mesma cor, mostrar marca
            if (colorCounts[filament.color] > 1) {
                option.textContent = `${filament.color} - ${brand} (${weightGrams}g)`;
            } else {
                option.textContent = `${filament.color} (${weightGrams}g)`;
            }

            option.value = filament.color;
            option.dataset.filamentId = filament.id;
            option.dataset.brand = brand;
            option.dataset.weight = weightGrams;

            colorSelect.appendChild(option);
        });
    }

    // Restaurar valor se ainda existir
    setTimeout(() => {
        if (currentValue) {
            const optionExists = Array.from(colorSelect.options).some(opt => opt.value === currentValue);
            if (optionExists) {
                colorSelect.value = currentValue;
            }
        }
        colorSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);
}

// ========== CARREGAR IMPRESSORAS DO ESTOQUE (COM FOTOS) ==========
// Nomes das impressoras conhecidas (para filtrar equipamentos)
const PRINTER_NAMES = ['K1', 'K1M', 'K2', 'K2 Plus', 'Ender 3', 'Ender 3 V2', 'Ender 3 V3', 'M5', 'M5C', 'M7', 'Mars', 'Elegoo', 'Photon', 'Saturn'];

function loadPrinterEquipment() {
    if (equipmentListener) {
        equipmentListener();
        equipmentListener = null;
    }

    equipmentListener = db.collection('equipment')
        .onSnapshot(snapshot => {
            const allEquipment = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filtrar apenas impressoras (FDM/filamento e resina)
            // Excluir estufas, secadores e outros equipamentos
            printerEquipment = allEquipment.filter(item => {
                const name = (item.name || '').toLowerCase();
                // Excluir estufas/secadores/dryers
                if (name.includes('estufa') || name.includes('dryer') || name.includes('secador') || name.includes('dry box')) {
                    return false;
                }
                // Incluir se parece ser uma impressora
                return PRINTER_NAMES.some(printer => name.toLowerCase().includes(printer.toLowerCase())) ||
                       name.includes('printer') ||
                       name.includes('impressora') ||
                       name.includes('3d');
            });

            logger.log('[PRINTERS] Impressoras carregadas:', printerEquipment.length, 'de', allEquipment.length, 'equipamentos');
            window.printerEquipment = printerEquipment;
            renderPrintersGrid();
        }, error => {
            logger.error('[PRINTERS] Erro ao carregar:', error);
        });
}

// Lista fixa como fallback
const AVAILABLE_PRINTERS = [
    { id: 'k1', name: 'K1' },
    { id: 'k1m', name: 'K1M' },
    { id: 'k2', name: 'K2' },
    { id: 'ender3', name: 'Ender 3' },
    { id: 'm7', name: 'M7' }
];

function loadEquipment() {
    // Carregar do Firestore com fotos
    loadPrinterEquipment();
}

// Obter impressoras disponiveis (do estoque ou fallback)
function getPrinters() {
    if (printerEquipment && printerEquipment.length > 0) {
        return printerEquipment;
    }
    return AVAILABLE_PRINTERS;
}

// Estado das impressoras selecionadas
let selectedPrinters = [];

// Renderizar grid de impressoras COM FOTOS
function renderPrintersGrid() {
    const grid = document.getElementById('printersGrid');
    if (!grid) return;

    const printers = getPrinters();

    if (printers.length === 0) {
        grid.innerHTML = '<div class="ml-printers-loading"><i class="fas fa-spinner fa-spin"></i><span>Carregando impressoras...</span></div>';
        return;
    }

    grid.innerHTML = printers.map(printer => {
        const isSelected = selectedPrinters.includes(printer.name);
        const hasImage = printer.imageUrl;

        // SEGURANCA: Sanitizar URL da imagem (NAO usar escapeHtml - quebra URLs com &)
        const safeImageUrl = hasImage ? sanitizeImageUrl(printer.imageUrl) : '';

        // Imagem ou placeholder (SEGURANCA: sem onerror inline, tratado via CSS)
        const imageHtml = hasImage && safeImageUrl
            ? `<img src="${safeImageUrl}" class="ml-printer-image" alt="${escapeHtml(printer.name)}" data-fallback="true">
               <div class="ml-printer-placeholder" style="display:none;"><i class="fas fa-print"></i></div>`
            : `<div class="ml-printer-placeholder"><i class="fas fa-print"></i></div>`;

        // SEGURANCA: Usar data-action ao inves de onclick inline
        return `
            <div class="ml-printer-card ${isSelected ? 'selected' : ''}"
                 data-printer="${escapeHtml(printer.name)}"
                 data-action="toggle-printer">
                ${imageHtml}
                <span class="ml-printer-name">${escapeHtml(printer.name)}</span>
            </div>
        `;
    }).join('');

    // Event delegation para imagens com erro
    grid.querySelectorAll('img[data-fallback]').forEach(img => {
        img.onerror = function() {
            this.style.display = 'none';
            if (this.nextElementSibling) this.nextElementSibling.style.display = 'flex';
        };
    });

    // Atualizar input hidden
    updateSelectedPrintersInput();
}

// Alternar selecao de impressora
function togglePrinterSelection(printerName) {
    const index = selectedPrinters.indexOf(printerName);
    if (index === -1) {
        selectedPrinters.push(printerName);
    } else {
        selectedPrinters.splice(index, 1);
    }

    // Atualizar UI
    const card = document.querySelector(`.ml-printer-card[data-printer="${printerName}"]`);
    if (card) {
        card.classList.toggle('selected', selectedPrinters.includes(printerName));
    }

    updateSelectedPrintersInput();
}

// Atualizar input hidden com impressoras selecionadas
function updateSelectedPrintersInput() {
    const input = document.getElementById('selectedPrinters');
    if (input) {
        input.value = JSON.stringify(selectedPrinters);
    }
}

// Definir impressoras selecionadas (para edicao)
function setSelectedPrinters(printers) {
    if (Array.isArray(printers)) {
        selectedPrinters = [...printers];
    } else if (typeof printers === 'string' && printers) {
        // Compatibilidade com formato antigo (string unica)
        selectedPrinters = [printers];
    } else {
        selectedPrinters = [];
    }
    renderPrintersGrid();
}

// Limpar selecao de impressoras
function clearSelectedPrinters() {
    selectedPrinters = [];
    renderPrintersGrid();
}

// Helper para escapar HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== POPULAR DROPDOWNS ==========
function populateDropdownOptions() {
    // Materiais no filtro (lista fixa para filtro rapido)
    const filterMaterial = document.getElementById('filterMaterial');
    if (filterMaterial) {
        MATERIALS.forEach(mat => {
            const option = document.createElement('option');
            option.value = mat;
            option.textContent = mat;
            filterMaterial.appendChild(option);
        });
    }

    // Materiais no modal - serao carregados do estoque
    // Listener para atualizar cores quando material muda
    const materialType = document.getElementById('materialType');
    if (materialType) {
        materialType.addEventListener('change', (e) => {
            updateColorDropdownFromStock(e.target.value);
        });
    }

    // Inicializar CustomSelects apos popular opcoes
    setTimeout(() => {
        if (window.initCustomSelects) {
            window.initCustomSelects();
        }
    }, 100);

    // Carregar filamentos do estoque (materiais e cores)
    loadAvailableFilaments();

    // Carregar impressoras do estoque (com fotos)
    loadEquipment();
}

// ========== LISTENER DE PRODUTOS ==========
function stopProductsListener() {
    if (productsListener) {
        productsListener();
        productsListener = null;
    }
}

// ========== TOGGLE PRAZO DE PRODUCAO ==========
// Mostra/oculta o campo de prazo baseado no tipo de venda
function toggleManufacturingTime() {
    const saleType = document.getElementById('saleType');
    const manufacturingGroup = document.getElementById('manufacturingTimeGroup');
    const manufacturingSelect = document.getElementById('mlManufacturingTime');

    if (!saleType || !manufacturingGroup) return;

    if (saleType.value === 'personalizacao') {
        // Personalizacao: mostrar prazo de producao
        manufacturingGroup.classList.remove('hidden');
        if (manufacturingSelect && manufacturingSelect.value === '0') {
            manufacturingSelect.value = '3'; // Default 3 dias
        }
    } else {
        // Estoque imediato ou nao selecionado: ocultar e zerar prazo
        manufacturingGroup.classList.add('hidden');
        if (manufacturingSelect) {
            manufacturingSelect.value = '0';
        }
    }
}

// ========== EXPORTAR PARA GLOBAL ==========
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.toggleManufacturingTime = toggleManufacturingTime;
window.db = db;
window.auth = auth;
window.COMPANY_USER_ID = COMPANY_USER_ID;
window.PRINT_COLORS = PRINT_COLORS;
window.MATERIALS = MATERIALS;
window.equipment = equipment;
window.products = products;
window.currentFilters = currentFilters;
window.editingProductId = editingProductId;
window.elements = elements;
window.loadEquipment = loadEquipment;
// Funcoes de estoque
window.availableFilaments = availableFilaments;
window.printerEquipment = printerEquipment;
window.loadAvailableFilaments = loadAvailableFilaments;
window.loadPrinterEquipment = loadPrinterEquipment;
window.updateMaterialDropdownFromStock = updateMaterialDropdownFromStock;
window.updateColorDropdownFromStock = updateColorDropdownFromStock;
// Funcoes de selecao de impressoras
window.getPrinters = getPrinters;
window.togglePrinterSelection = togglePrinterSelection;
window.AVAILABLE_PRINTERS = AVAILABLE_PRINTERS;
window.setSelectedPrinters = setSelectedPrinters;
window.clearSelectedPrinters = clearSelectedPrinters;
window.renderPrintersGrid = renderPrintersGrid;
window.selectedPrinters = selectedPrinters;
