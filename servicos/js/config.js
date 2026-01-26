/*
=================================================
ARQUIVO: servicos/js/config.js
MÓDULO: Configuração e Inicialização
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 3.3 - Segurança e Logger
IMPORTANTE: NÃO REMOVER ESTE CABEÇALHO DE IDENTIFICAÇÃO
=================================================
*/

import logger from './logger.js';

// ===========================
// FIREBASE CONFIGURATION
// ===========================

// SEGURANCA: Credenciais devem vir exclusivamente do ENV_CONFIG
// Fallbacks removidos para evitar exposicao de chaves no codigo fonte
const ENV = window.ENV_CONFIG || {};

if (!ENV.FIREBASE_API_KEY) {
    logger.error('ENV_CONFIG nao configurado. Verifique /js/env-config.js');
}

export const firebaseConfig = {
    apiKey: ENV.FIREBASE_API_KEY,
    authDomain: ENV.FIREBASE_AUTH_DOMAIN,
    projectId: ENV.FIREBASE_PROJECT_ID,
    storageBucket: ENV.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: ENV.FIREBASE_MESSAGING_SENDER_ID,
    appId: ENV.FIREBASE_APP_ID
};

// ===========================
// CONSTANTS
// ===========================
// SEGURANCA: Admins sao carregados EXCLUSIVAMENTE do Firestore
// Nenhum email deve ser hardcoded no codigo fonte
// Array inicializado vazio - preenchido por loadAuthorizedAdmins()
export let AUTHORIZED_ADMINS = [];

// Flag para indicar se admins foram carregados
let adminsLoaded = false;

// Lista simples de emails para verificacao rapida
export let AUTHORIZED_EMAILS = [];

// Verifica se admins ja foram carregados
export function isAdminsLoaded() {
    return adminsLoaded;
}

// Funcao para carregar admins do Firestore (OBRIGATORIO antes de verificar autorizacao)
export async function loadAuthorizedAdmins(db) {
    if (adminsLoaded && AUTHORIZED_ADMINS.length > 0) {
        return AUTHORIZED_ADMINS; // Ja carregado
    }

    try {
        // Carregar do Firestore - fonte unica de verdade
        const snapshot = await db.collection('admins')
            .where('active', '==', true)
            .get();

        if (snapshot.empty) {
            logger.error('SEGURANCA: Nenhum admin encontrado no Firestore!');
            adminsLoaded = true;
            return [];
        }

        AUTHORIZED_ADMINS = snapshot.docs.map(doc => ({
            uid: doc.id,
            email: doc.data().email,
            name: doc.data().name,
            photoURL: doc.data().photoURL || null
        }));
        AUTHORIZED_EMAILS = AUTHORIZED_ADMINS.map(admin => admin.email);
        adminsLoaded = true;
        logger.log('Admins carregados do Firestore:', AUTHORIZED_ADMINS.length);

        return AUTHORIZED_ADMINS;
    } catch (error) {
        logger.error('Erro ao carregar admins do Firestore:', error);
        adminsLoaded = true; // Marcar como tentado para evitar loop
        return [];
    }
}

// Configurações exportadas do ENV_CONFIG
export const FUNCTIONS_URL = ENV.FUNCTIONS_URL || 'https://us-central1-imaginatech-servicos.cloudfunctions.net';
export const COMPANY_USER_ID = ENV.COMPANY_USER_ID || '';
export const WHATSAPP_NUMBER = ENV.WHATSAPP_NUMBER || '';
// BYPASS_PASSWORD removido do frontend - verificacao feita via Cloud Function
export const EMAILJS_CONFIG = {
    publicKey: ENV.EMAILJS_PUBLIC_KEY || '',
    serviceId: ENV.EMAILJS_SERVICE_ID || '',
    templateId: ENV.EMAILJS_TEMPLATE_ID || ''
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
        // Verificar se ENV_CONFIG foi carregado
        if (!firebaseConfig.apiKey) {
            throw new Error('Firebase API Key nao configurada');
        }

        firebase.initializeApp(firebaseConfig);
        state.db = firebase.firestore();
        state.auth = firebase.auth();
        state.storage = firebase.storage();

        // Initialize EmailJS
        if (typeof emailjs !== 'undefined' && EMAILJS_CONFIG.publicKey) {
            emailjs.init(EMAILJS_CONFIG.publicKey);
            logger.log('EmailJS inicializado');
        } else if (!EMAILJS_CONFIG.publicKey) {
            logger.warn('EmailJS publicKey nao configurada');
        } else {
            logger.error('Biblioteca EmailJS nao carregada');
        }

        logger.log('Firebase inicializado com sucesso');
        return true;
    } catch (error) {
        logger.error('Erro ao inicializar Firebase:', error);
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
    window.addEventListener('error', e => logger.error('Erro global:', e.message, e.filename, e.lineno));
    window.addEventListener('unhandledrejection', e => logger.error('Promise rejeitada:', e.reason));
}

// Exportar logger para uso em outros modulos
export { default as logger } from './logger.js';
