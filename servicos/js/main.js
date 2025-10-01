/* 
==================================================
ARQUIVO: servicos/js/main.js
MÓDULO: Inicializador Principal
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 3.1 - Modular + Push Notifications
==================================================
*/

import { initializeFirebase, onDOMReady, setupErrorHandlers, state } from './config.js';
import { saveService } from './services.js';
import { 
    signInWithGoogle, 
    checkAuthorization, 
    showLoginScreen, 
    hideLoadingOverlay,
    setupDateFields,
    formatPhoneNumber,
    formatCEP,
    updateNotificationOptions,
    monitorConnection
} from './auth-ui.js';

// ===========================
// NOVO: IMPORTAR PUSH NOTIFICATIONS
// ===========================
import { initPushNotifications } from './push-notifications.js';

// ===========================
// INICIALIZA FIREBASE PRIMEIRO
// ===========================
if (!initializeFirebase()) {
    alert('Erro crítico ao conectar ao Firebase. Recarregue a página.');
}

// Setup error handlers
setupErrorHandlers();

// ===========================
// DEPOIS INICIALIZA A APLICAÇÃO
// ===========================
onDOMReady(() => {
    if (!state.auth) {
        hideLoadingOverlay();
        return alert('Erro ao inicializar autenticação. Recarregue a página.');
    }
    
    state.auth.onAuthStateChanged(user => {
        hideLoadingOverlay();
        state.currentUser = user;
        
        if (user) {
            checkAuthorization(user);
            
            // ===========================
            // NOVO: INICIALIZAR PUSH NOTIFICATIONS (SOMENTE NO APP)
            // ===========================
            if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
                console.log('🚀 App nativo detectado - Inicializando notificações push');
                initPushNotifications();
            } else {
                console.log('🌐 Rodando no navegador web - Push notifications desabilitadas');
            }
        } else {
            state.isAuthorized = false;
            showLoginScreen();
        }
    }, error => {
        console.error('Erro no auth state:', error);
        hideLoadingOverlay();
        showLoginScreen();
    });
    
    setupDateFields();
    
    ['clientPhone', 'pickupWhatsapp'].forEach(id => {
        const input = document.getElementById(id);
        input?.addEventListener('input', formatPhoneNumber);
    });
    
    document.getElementById('cep')?.addEventListener('input', formatCEP);
    document.getElementById('clientPhone')?.addEventListener('input', updateNotificationOptions);
    document.getElementById('clientEmail')?.addEventListener('input', updateNotificationOptions);
    
    monitorConnection();
});

// ===========================
// EXPÕE FUNÇÕES GLOBAIS
// ===========================
window.saveService = saveService;
