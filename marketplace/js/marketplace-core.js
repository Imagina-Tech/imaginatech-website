/*
==================================================
ARQUIVO: marketplace/js/marketplace-core.js
MODULO: Firebase, Autenticacao e State Management
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 1.0
==================================================
*/

// ========== CONFIGURACAO FIREBASE ==========
const firebaseConfig = {
    apiKey: window.ENV_CONFIG?.FIREBASE_API_KEY || "AIzaSyDZxuazTrmimr0951TmTCKckI4Ede2hdn4",
    authDomain: window.ENV_CONFIG?.FIREBASE_AUTH_DOMAIN || "imaginatech-servicos.firebaseapp.com",
    projectId: window.ENV_CONFIG?.FIREBASE_PROJECT_ID || "imaginatech-servicos",
    storageBucket: window.ENV_CONFIG?.FIREBASE_STORAGE_BUCKET || "imaginatech-servicos.firebasestorage.app",
    messagingSenderId: window.ENV_CONFIG?.FIREBASE_MESSAGING_SENDER_ID || "1044827662498",
    appId: window.ENV_CONFIG?.FIREBASE_APP_ID || "1:1044827662498:web:b3a2f3a4c5d6e7f8g9h0i1"
};

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
const auth = firebase.auth();

// ========== CONSTANTES ==========
const COMPANY_USER_ID = window.ENV_CONFIG?.COMPANY_USER_ID || 'BdmqXJFgMja4SY6DRXdf3dMyzaq1';
const AUTHORIZED_ADMINS = window.ENV_CONFIG?.AUTHORIZED_ADMINS || [
    { email: '3d3printers@gmail.com', name: 'ADMIN' },
    { email: 'netrindademarcus@gmail.com', name: 'Trindade' },
    { email: 'quequell1010@gmail.com', name: 'Raquel' },
    { email: 'igor.butter@gmail.com', name: 'Leao' },
    { email: 'contato.elainesas@gmail.com', name: 'Elaine' }
];

// Lista de emails autorizados
const AUTHORIZED_EMAILS = AUTHORIZED_ADMINS.map(admin => admin.email);

// ========== OPCOES DE PRODUCAO ==========
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
});

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

function isAuthorizedAdmin(email) {
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
        await auth.signInWithPopup(provider);
    } catch (error) {
        console.error('Erro no login:', error);
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
        console.error('Erro ao sair:', error);
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
        <span>${message}</span>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========== CARREGAR EQUIPAMENTOS DO FIRESTORE ==========
function loadEquipment() {
    db.collection('equipment')
        .orderBy('name', 'asc')
        .onSnapshot(snapshot => {
            equipment = [];
            snapshot.forEach(doc => {
                equipment.push({ id: doc.id, ...doc.data() });
            });
            console.log('[EQUIPMENT] Carregados:', equipment.length, 'equipamentos');
            populatePrinterDropdown();
        }, error => {
            console.error('[EQUIPMENT] Erro ao carregar:', error);
        });
}

// Popular dropdown de maquinas com equipamentos do Firestore
function populatePrinterDropdown() {
    const printerMachine = document.getElementById('printerMachine');
    if (!printerMachine) return;

    // Limpar opcoes existentes (manter apenas a primeira "Selecione...")
    const firstOption = printerMachine.options[0];
    printerMachine.innerHTML = '';
    if (firstOption) {
        printerMachine.appendChild(firstOption);
    } else {
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = 'Selecione...';
        printerMachine.appendChild(defaultOpt);
    }

    // Adicionar equipamentos
    equipment.forEach(eq => {
        const option = document.createElement('option');
        option.value = eq.name;
        option.textContent = eq.name;
        option.dataset.imageUrl = eq.imageUrl || '';
        printerMachine.appendChild(option);
    });

    // Disparar evento para sincronizar CustomSelect
    setTimeout(() => {
        printerMachine.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);
}

// Atualizar preview da maquina selecionada
function updateMachinePreview(machineName) {
    const previewContainer = document.getElementById('machinePreview');
    if (!previewContainer) return;

    if (!machineName) {
        previewContainer.innerHTML = `
            <div class="machine-preview-placeholder">
                <i class="fas fa-print"></i>
                <span>Selecione uma maquina</span>
            </div>
        `;
        return;
    }

    const machine = equipment.find(eq => eq.name === machineName);
    if (machine && machine.imageUrl) {
        previewContainer.innerHTML = `
            <img src="${machine.imageUrl}" alt="${machine.name}" class="machine-preview-image">
            <span class="machine-preview-name">${machine.name}</span>
        `;
    } else {
        previewContainer.innerHTML = `
            <div class="machine-preview-placeholder">
                <i class="fas fa-print"></i>
                <span>${machineName}</span>
            </div>
        `;
    }
}

// ========== POPULAR DROPDOWNS ==========
function populateDropdownOptions() {
    // Materiais no filtro
    const filterMaterial = document.getElementById('filterMaterial');
    if (filterMaterial) {
        MATERIALS.forEach(mat => {
            const option = document.createElement('option');
            option.value = mat;
            option.textContent = mat;
            filterMaterial.appendChild(option);
        });
    }

    // Materiais no modal
    const materialType = document.getElementById('materialType');
    if (materialType) {
        MATERIALS.forEach(mat => {
            const option = document.createElement('option');
            option.value = mat;
            option.textContent = mat;
            materialType.appendChild(option);
        });
    }

    // Cores no modal
    const printColor = document.getElementById('printColor');
    if (printColor) {
        PRINT_COLORS.forEach(color => {
            const option = document.createElement('option');
            option.value = color;
            option.textContent = color;
            printColor.appendChild(option);
        });
    }

    // Maquinas - serao populadas dinamicamente via loadEquipment()

    // Listener para atualizar preview da maquina
    const printerMachine = document.getElementById('printerMachine');
    if (printerMachine) {
        printerMachine.addEventListener('change', (e) => {
            updateMachinePreview(e.target.value);
        });
    }

    // Inicializar CustomSelects apos popular opcoes
    setTimeout(() => {
        if (window.initCustomSelects) {
            window.initCustomSelects();
        }
    }, 100);

    // Carregar equipamentos do Firestore
    loadEquipment();
}

// ========== LISTENER DE PRODUTOS ==========
function stopProductsListener() {
    if (productsListener) {
        productsListener();
        productsListener = null;
    }
}

// ========== EXPORTAR PARA GLOBAL ==========
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
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
window.updateMachinePreview = updateMachinePreview;
window.loadEquipment = loadEquipment;
