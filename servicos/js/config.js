/* 
=================================================
ARQUIVO: servicos/js/config.js
MÓDULO: Configuração e Inicialização
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 3.0 - Modular
IMPORTANTE: NÃO REMOVER ESTE CABEÇALHO DE IDENTIFICAÇÃO
=================================================
*/

// ===========================
// FIREBASE CONFIGURATION
// ===========================
export const firebaseConfig = {
    apiKey: "AIzaSyDZxuazTrmimr0951TmTCKckI4Ede2hdn4",
    authDomain: "imaginatech-servicos.firebaseapp.com",
    projectId: "imaginatech-servicos",
    storageBucket: "imaginatech-servicos.firebasestorage.app",
    messagingSenderId: "321455309872",
    appId: "1:321455309872:web:e7ba49a0f020bbae1159f5"
};

// ===========================
// CONSTANTS
// ===========================
export const AUTHORIZED_EMAILS = ["3d3printers@gmail.com", "netrindademarcus@gmail.com", "igor.butter@gmail.com"];

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
    selectedFile: null,
    selectedImages: [],
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
            emailjs.init("VIytMLn6VW-lDYhYL");
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
