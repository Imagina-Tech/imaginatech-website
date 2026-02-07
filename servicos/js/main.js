/*
==================================================
ARQUIVO: servicos/js/main.js
MODULO: Inicializador Principal
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 3.4 - Event Delegation
==================================================
*/

import { initializeFirebase, onDOMReady, setupErrorHandlers, state, loadAuthorizedAdmins, logger } from './config.js';
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
import { initEventDelegation } from './event-handlers.js';

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
    
    state.auth.onAuthStateChanged(async (user) => {
        hideLoadingOverlay();
        state.currentUser = user;

        if (user) {
            // ===========================
            // SEGURANCA: Carregar admins ANTES de verificar autorizacao
            // ===========================
            await loadAuthorizedAdmins(state.db);

            // Verificar autorizacao DEPOIS de carregar admins
            checkAuthorization(user);

            // ===========================
            // REGISTRO DE ULTIMO ACESSO
            // ===========================
            // Chamar diretamente para garantir registro em cada carregamento
            updateLastAccess(user);

            // Injetar botao Clientes na navbar desktop
            createClientsButton();

        } else {
            state.isAuthorized = false;
            showLoginScreen();
        }
    }, error => {
        logger.error('Erro no auth state:', error);
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

    // Inicializar sistema de delegacao de eventos
    initEventDelegation();
});

// ===========================
// BOTAO CLIENTES NA NAVBAR
// ===========================
function createClientsButton() {
    const navbarRight = document.querySelector('.navbar-right');
    if (!navbarRight || document.getElementById('btnClientes')) return;

    const btn = document.createElement('button');
    btn.className = 'btn-nav';
    btn.id = 'btnClientes';
    btn.title = 'Clientes';
    btn.addEventListener('click', () => window.openClientsModal && window.openClientsModal());
    btn.innerHTML = '<i class="fas fa-users"></i>';

    const userInfo = navbarRight.querySelector('.user-info');
    if (userInfo) {
        navbarRight.insertBefore(btn, userInfo);
    } else {
        navbarRight.appendChild(btn);
    }
}

// ===========================
// EXPÕE FUNÇÕES GLOBAIS
// Namespace principal disponivel globalmente
window.ImaginaTech = window.ImaginaTech || {};
window.ImaginaTech.state = state;
window.ImaginaTech.logger = logger;