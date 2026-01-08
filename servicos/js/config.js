/* 
=================================================
ARQUIVO: servicos/js/config.js
MÓDULO: Configuração e Inicialização
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 3.2 - Múltiplos Arquivos + Fotos Embaladas
IMPORTANTE: NÃO REMOVER ESTE CABEÇALHO DE IDENTIFICAÇÃO
=================================================
*/

// ===========================
// FIREBASE CONFIGURATION
// ===========================
export const firebaseConfig = {
    apiKey: window.ENV_CONFIG?.FIREBASE_API_KEY || "AIzaSyDZxuazTrmimr0951TmTCKckI4Ede2hdn4",
    authDomain: window.ENV_CONFIG?.FIREBASE_AUTH_DOMAIN || "imaginatech-servicos.firebaseapp.com",
    projectId: window.ENV_CONFIG?.FIREBASE_PROJECT_ID || "imaginatech-servicos",
    storageBucket: window.ENV_CONFIG?.FIREBASE_STORAGE_BUCKET || "imaginatech-servicos.firebasestorage.app",
    messagingSenderId: window.ENV_CONFIG?.FIREBASE_MESSAGING_SENDER_ID || "321455309872",
    appId: window.ENV_CONFIG?.FIREBASE_APP_ID || "1:321455309872:web:e7ba49a0f020bbae1159f5"
};

// ===========================
// CONSTANTS
// ===========================
export const AUTHORIZED_ADMINS = window.ENV_CONFIG?.AUTHORIZED_ADMINS || [
    { email: '3d3printers@gmail.com', name: 'ADMIN' },
    { email: 'netrindademarcus@gmail.com', name: 'Trindade' },
    { email: 'allanedg01@gmail.com', name: 'Gonçalves' },
    { email: 'quequell1010@gmail.com', name: 'Raquel' },
    { email: 'igor.butter@gmail.com', name: 'Leão' }
];

// Lista simples de emails para verificação rápida
export const AUTHORIZED_EMAILS = AUTHORIZED_ADMINS.map(admin => admin.email);

// Configurações exportadas do ENV_CONFIG
export const BYPASS_PASSWORD = window.ENV_CONFIG?.BYPASS_PASSWORD || 'Trin2234@';
export const COMPANY_USER_ID = window.ENV_CONFIG?.COMPANY_USER_ID || 'BdmqXJFgMja4SY6DRXdf3dMyzaq1';
export const WHATSAPP_NUMBER = window.ENV_CONFIG?.WHATSAPP_NUMBER || '5521968972539';
export const EMAILJS_CONFIG = {
    publicKey: window.ENV_CONFIG?.EMAILJS_PUBLIC_KEY || 'VIytMLn6VW-lDYhYL',
    serviceId: window.ENV_CONFIG?.EMAILJS_SERVICE_ID || 'service_vxndoi5',
    templateId: window.ENV_CONFIG?.EMAILJS_TEMPLATE_ID || 'template_cwrmts1'
};

// ===========================
// GLOBAL STATE
// ===========================
export const state = {
    db: null,
    auth: null,
    storage: null,
    services: [],
    currentFilter: 'todos',
    editingServiceId: null,
    currentUser: null,
    isAuthorized: false,
    servicesListener: null,
    pendingStatusUpdate: null,
    selectedFiles: [], // MODIFICADO: array de múltiplos arquivos
    selectedImages: [],
    pendingInstagramPhotos: [], // Fotos do produto finalizado
    pendingPackagedPhotos: [], // NOVO: Fotos do produto embalado
    currentImageGallery: [],
    currentImageIndex: 0
};

// ===========================
// INITIALIZATION
// ===========================
export function initializeFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        state.db = firebase.firestore();
        state.auth = firebase.auth();
        state.storage = firebase.storage();
        
        // Initialize EmailJS
        if (typeof emailjs !== 'undefined') {
            emailjs.init(EMAILJS_CONFIG.publicKey);
            console.log('EmailJS initialized successfully');
        } else {
            console.error('EmailJS library not loaded');
        }
        
        return true;
    } catch (error) {
        console.error('Erro ao inicializar Firebase:', error);
        alert('Erro ao conectar com o servidor. Recarregue a página.');
        return false;
    }
}

// ===========================
// DOM READY HANDLER
// ===========================
export function onDOMReady(callback) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', callback);
    } else {
        callback();
    }
}

// ===========================
// ERROR HANDLERS
// ===========================
export function setupErrorHandlers() {
    window.addEventListener('error', e => console.error('Erro:', e));
    window.addEventListener('unhandledrejection', e => console.error('Promise rejeitada:', e.reason));
}
