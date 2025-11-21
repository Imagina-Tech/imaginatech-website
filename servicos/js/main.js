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
    monitorConnection,
    updateLastAccess
} from './auth-ui.js';

// ===========================
// PUSH NOTIFICATIONS - DESABILITADO
// ===========================
// 🔔 INSTRUÇÕES PARA IMPLEMENTAÇÃO FUTURA:
// 1. Descomentar a linha abaixo
// 2. Corrigir o path para: '../push-system/push-notifications.js'
// 3. Descomentar linhas 68-73 (inicialização)
// 4. Ver documentação completa em: /servicos/push-system/README.md
// ===========================
// import { initPushNotifications } from '../push-system/push-notifications.js';

// ===========================
// NOVO: IMPORTAR SISTEMA DE TAREFAS
// ===========================
import { initTasksSystem } from './tasks.js';

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
            // REGISTRO DE ÚLTIMO ACESSO
            // ===========================
            // Chamar diretamente para garantir registro em cada carregamento
            updateLastAccess(user);

            // ===========================
            // NOVO: INICIALIZAR SISTEMA DE TAREFAS
            // ===========================
            initTasksSystem();

            // ===========================
            // PUSH NOTIFICATIONS - DESABILITADO
            // ===========================
            // 🔔 DESCOMENTAR APÓS IMPLEMENTAR (ver /servicos/push-system/README.md)
            // if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
            //     console.log('🚀 App nativo detectado - Inicializando notificações push');
            //     initPushNotifications();
            // } else {
            //     console.log('🌐 Rodando no navegador web - Push notifications desabilitadas');
            // }
        } else {
            state.isAuthorized = false;
            showLoginScreen();
        }
    }, error => {
        console.error('Erro no auth state:', error);
        hideLoadingOverlay();
        showLoginScreen();
    });

    // ===========================
    // ATUALIZAR ACESSO AO VOLTAR À ABA
    // ===========================
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && state.currentUser && state.isAuthorized) {
            updateLastAccess(state.currentUser);
        }
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