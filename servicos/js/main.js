/*
==================================================
ARQUIVO: servicos/js/main.js
MODULO: Inicializador Principal
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 3.2 - Modular
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
    updateLastAccess,
    setupUpModalDragDrop
} from './auth-ui.js';
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

            // Inicializar sistema de tarefas
            initTasksSystem();
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

    // Setup drag & drop para modal Up Portfolio
    setupUpModalDragDrop();
});

// ===========================
// EXPÕE FUNÇÕES GLOBAIS
// ===========================
window.saveService = saveService;