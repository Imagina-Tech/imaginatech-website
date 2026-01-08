/* ==================================================
ARQUIVO: js/env-config.js
MÓDULO: Configurações de Ambiente Centralizadas
SISTEMA: ImaginaTech - Gestão de Impressão 3D
IMPORTANTE: Este arquivo deve ser carregado ANTES dos outros scripts
==================================================
*/

window.ENV_CONFIG = {
    // ===========================
    // FIREBASE CONFIGURATION
    // ===========================
    FIREBASE_API_KEY: 'AIzaSyDZxuazTrmimr0951TmTCKckI4Ede2hdn4',
    FIREBASE_AUTH_DOMAIN: 'imaginatech-servicos.firebaseapp.com',
    FIREBASE_PROJECT_ID: 'imaginatech-servicos',
    FIREBASE_STORAGE_BUCKET: 'imaginatech-servicos.firebasestorage.app',
    FIREBASE_MESSAGING_SENDER_ID: '321455309872',
    FIREBASE_APP_ID: '1:321455309872:web:e7ba49a0f020bbae1159f5',

    // ===========================
    // EMAILJS CONFIGURATION
    // ===========================
    EMAILJS_PUBLIC_KEY: 'VIytMLn6VW-lDYhYL',
    EMAILJS_SERVICE_ID: 'service_vxndoi5',
    EMAILJS_TEMPLATE_ID: 'template_cwrmts1',

    // ===========================
    // SECURITY
    // ===========================
    BYPASS_PASSWORD: 'Trin2234@',

    // ===========================
    // COMPANY INFO
    // ===========================
    COMPANY_USER_ID: 'BdmqXJFgMja4SY6DRXdf3dMyzaq1',
    WHATSAPP_NUMBER: '5521968972539',
    ADMIN_EMAIL: '3d3printers@gmail.com',

    // ===========================
    // URLS
    // ===========================
    SITE_URL: 'https://imaginatech.com.br',
    TRACKING_URL: 'https://imaginatech.com.br/acompanhar-pedido/',
    VIACEP_URL: 'https://viacep.com.br/ws/',

    // ===========================
    // PARÂMETROS CONFIGURÁVEIS
    // ===========================
    MAX_ATTEMPTS: 3,
    TOAST_DURATION: 3000,
    WHATSAPP_FALLBACK_TIMEOUT: 500,
    MAX_FILE_SIZE: 5242880, // 5MB em bytes

    // ===========================
    // LISTA DE ADMINS AUTORIZADOS
    // ===========================
    AUTHORIZED_ADMINS: [
        { email: '3d3printers@gmail.com', name: 'ADMIN' },
        { email: 'netrindademarcus@gmail.com', name: 'Trindade' },
        { email: 'allanedg01@gmail.com', name: 'Gonçalves' },
        { email: 'quequell1010@gmail.com', name: 'Raquel' },
        { email: 'igor.butter@gmail.com', name: 'Leão' }
    ]
};

// Exportar para uso em módulos ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.ENV_CONFIG;
}
