/* ==================================================
ARQUIVO: js/env-config.js
MÓDULO: Configurações de Ambiente Centralizadas
SISTEMA: ImaginaTech - Gestão de Impressão 3D
IMPORTANTE: Este arquivo deve ser carregado ANTES dos outros scripts
==================================================
*/

window.ENV_CONFIG = {
    // ===========================
    // CLOUD FUNCTIONS URL
    // ===========================
    FUNCTIONS_URL: 'https://us-central1-imaginatech-servicos.cloudfunctions.net',

    // ===========================
    // FIREBASE CONFIGURATION
    // NOTA DE SEGURANCA: Estas chaves sao publicas por design do Firebase.
    // A seguranca depende EXCLUSIVAMENTE das Firestore Security Rules.
    // Verifique se as rules estao configuradas corretamente no Firebase Console.
    // Docs: https://firebase.google.com/docs/rules
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
    // BYPASS_PASSWORD removido - verificacao feita via Cloud Function por seguranca

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
    // SEGURANCA: Lista vazia - DEVE ser carregada do Firestore
    // Nao ha fallback hardcoded para evitar exposicao de emails
    // ===========================
    AUTHORIZED_ADMINS: [],

    // Flag para indicar se admins foram carregados do Firestore
    _adminsLoaded: false,

    // Flag para indicar falha no carregamento
    _adminsLoadFailed: false,

    // ===========================
    // FUNCAO PARA CARREGAR ADMINS DO FIRESTORE
    // Deve ser chamada apos inicializar o Firebase
    // SEGURANCA: Falha explicita se nao conseguir carregar
    // ===========================
    loadAdmins: async function(db) {
        try {
            const snapshot = await db.collection('admins')
                .where('active', '==', true)
                .get();

            if (!snapshot.empty) {
                this.AUTHORIZED_ADMINS = snapshot.docs.map(doc => ({
                    uid: doc.id,
                    email: doc.data().email,
                    name: doc.data().name,
                    photoURL: doc.data().photoURL || null
                }));
                this._adminsLoaded = true;
                this._adminsLoadFailed = false;
                console.log('[ENV_CONFIG] Admins carregados do Firestore:', this.AUTHORIZED_ADMINS.length);
                return this.AUTHORIZED_ADMINS;
            } else {
                // SEGURANCA: Sem fallback - falha explicita
                console.error('[ENV_CONFIG] ERRO CRITICO: Nenhum admin encontrado no Firestore');
                this._adminsLoadFailed = true;
                this.AUTHORIZED_ADMINS = [];
                return [];
            }
        } catch (error) {
            // SEGURANCA: Sem fallback - falha explicita
            console.error('[ENV_CONFIG] ERRO CRITICO ao carregar admins:', error);
            this._adminsLoadFailed = true;
            this.AUTHORIZED_ADMINS = [];
            return [];
        }
    },

    // Verifica se um email e de admin
    // SEGURANCA: Retorna false se admins nao foram carregados corretamente
    isAdmin: function(email) {
        if (!email) return false;
        if (!this._adminsLoaded || this._adminsLoadFailed) {
            console.warn('[ENV_CONFIG] isAdmin chamado antes de carregar admins do Firestore');
            return false;
        }
        return this.AUTHORIZED_ADMINS.some(admin => admin.email === email);
    },

    // Obtem nome do admin pelo email
    getAdminName: function(email) {
        if (!email) return null;
        if (!this._adminsLoaded) return null;
        const admin = this.AUTHORIZED_ADMINS.find(a => a.email === email);
        return admin ? admin.name : null;
    }
};

// Exportar para uso em módulos ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.ENV_CONFIG;
}
