/*
==================================================
ARQUIVO: servicos/js/accessibility.js
MODULO: Acessibilidade e Keyboard Navigation
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 1.0
DESCRICAO: Focus trap, keyboard navigation, ARIA management
==================================================
*/

// =========================
// FOCUS TRAP PARA MODAIS
// =========================

const focusableSelectors = [
    'button:not([disabled]):not([tabindex="-1"])',
    'a[href]:not([tabindex="-1"])',
    'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
    'select:not([disabled]):not([tabindex="-1"])',
    'textarea:not([disabled]):not([tabindex="-1"])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]'
].join(', ');

let activeModal = null;
let previousFocus = null;
let focusTrapHandler = null;

/**
 * Ativa focus trap em um modal
 * @param {HTMLElement} modal - Elemento do modal
 */
export function activateFocusTrap(modal) {
    if (!modal) return;

    // Salvar elemento com foco antes do modal
    previousFocus = document.activeElement;
    activeModal = modal;

    // Mostrar modal e atualizar ARIA
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';

    // Encontrar elementos focaveis dentro do modal
    const focusableElements = modal.querySelectorAll(focusableSelectors);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Focar no primeiro elemento
    if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 50);
    }

    // Handler para trap de foco
    focusTrapHandler = (e) => {
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                // Shift + Tab
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable?.focus();
                }
            } else {
                // Tab
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable?.focus();
                }
            }
        }

        // Escape fecha o modal
        if (e.key === 'Escape') {
            deactivateFocusTrap();
            // Procurar funcao de fechar no data-action do botao close
            const closeBtn = modal.querySelector('[data-action]');
            if (closeBtn) {
                const action = closeBtn.dataset.action;
                if (typeof window[action] === 'function') {
                    window[action]();
                }
            }
        }
    };

    modal.addEventListener('keydown', focusTrapHandler);
}

/**
 * Desativa focus trap e restaura foco anterior
 */
export function deactivateFocusTrap() {
    if (activeModal) {
        activeModal.removeEventListener('keydown', focusTrapHandler);
        activeModal.setAttribute('aria-hidden', 'true');
        activeModal.style.display = 'none';
        activeModal = null;
    }

    // Restaurar foco anterior
    if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus();
    }
    previousFocus = null;
    focusTrapHandler = null;
}

// =========================
// MODAL MANAGEMENT
// =========================

/**
 * Abre modal com acessibilidade completa
 * @param {string} modalId - ID do modal
 * @param {HTMLElement} triggerElement - Elemento que abriu o modal (para restaurar foco)
 */
export function openModalAccessible(modalId, triggerElement = null) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    if (triggerElement) {
        previousFocus = triggerElement;
    }

    activateFocusTrap(modal);

    // Prevenir scroll do body
    document.body.style.overflow = 'hidden';
}

/**
 * Fecha modal com acessibilidade completa
 * @param {string} modalId - ID do modal
 */
export function closeModalAccessible(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    deactivateFocusTrap();

    // Restaurar scroll do body
    document.body.style.overflow = '';
}

// =========================
// ARIA LIVE REGIONS
// =========================

/**
 * Anuncia mensagem para leitores de tela
 * @param {string} message - Mensagem a anunciar
 * @param {string} priority - 'polite' ou 'assertive'
 */
export function announce(message, priority = 'polite') {
    // Usar toast container existente ou criar elemento temporario
    let announcer = document.getElementById('a11y-announcer');

    if (!announcer) {
        announcer = document.createElement('div');
        announcer.id = 'a11y-announcer';
        announcer.setAttribute('aria-live', priority);
        announcer.setAttribute('aria-atomic', 'true');
        announcer.className = 'visually-hidden';
        document.body.appendChild(announcer);
    }

    // Limpar e depois adicionar mensagem (forca leitura)
    announcer.textContent = '';
    setTimeout(() => {
        announcer.textContent = message;
    }, 100);
}

// =========================
// KEYBOARD NAVIGATION
// =========================

/**
 * Inicializa navegacao por teclado para elementos customizados
 */
export function initKeyboardNavigation() {
    // Stat cards - permitir Enter/Space para ativar
    document.querySelectorAll('.stat-card.clickable').forEach(card => {
        card.setAttribute('tabindex', '0');
        card.setAttribute('role', 'button');

        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                card.click();
            }
        });
    });

    // Service cards - permitir navegacao
    document.addEventListener('keydown', (e) => {
        // Ctrl+N = Novo servico
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            if (typeof window.openAddModal === 'function') {
                window.openAddModal();
            }
        }

        // ? = Ajuda (se implementado)
        if (e.key === '?' && !e.ctrlKey && !e.altKey) {
            const target = e.target;
            if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                // Mostrar ajuda de atalhos
                announce('Atalhos disponiveis: Ctrl+N para novo servico, Escape para fechar modais');
            }
        }
    });
}

// =========================
// ROVING TABINDEX
// =========================

/**
 * Implementa roving tabindex para grupos de elementos
 * @param {string} containerSelector - Seletor do container
 * @param {string} itemSelector - Seletor dos items
 */
export function initRovingTabindex(containerSelector, itemSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const items = container.querySelectorAll(itemSelector);
    if (items.length === 0) return;

    // Definir primeiro item como tabbable
    items.forEach((item, index) => {
        item.setAttribute('tabindex', index === 0 ? '0' : '-1');
    });

    container.addEventListener('keydown', (e) => {
        const currentIndex = Array.from(items).findIndex(item => item === document.activeElement);
        if (currentIndex === -1) return;

        let nextIndex = currentIndex;

        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                e.preventDefault();
                nextIndex = (currentIndex + 1) % items.length;
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                e.preventDefault();
                nextIndex = (currentIndex - 1 + items.length) % items.length;
                break;
            case 'Home':
                e.preventDefault();
                nextIndex = 0;
                break;
            case 'End':
                e.preventDefault();
                nextIndex = items.length - 1;
                break;
            default:
                return;
        }

        items[currentIndex].setAttribute('tabindex', '-1');
        items[nextIndex].setAttribute('tabindex', '0');
        items[nextIndex].focus();
    });
}

// =========================
// AUTO-INIT
// =========================

/**
 * Inicializa todas as funcionalidades de acessibilidade
 */
export function initAccessibility() {
    // Keyboard navigation
    initKeyboardNavigation();

    // Roving tabindex para stat cards
    initRovingTabindex('.stats-grid', '.stat-card.clickable');

    // Adicionar classe para indicar JS habilitado
    document.documentElement.classList.add('js-enabled');

    // Listener para clique fora do modal (fecha modal)
    document.addEventListener('click', (e) => {
        if (activeModal && e.target === activeModal) {
            const closeBtn = activeModal.querySelector('[data-action]');
            if (closeBtn) {
                const action = closeBtn.dataset.action;
                if (typeof window[action] === 'function') {
                    window[action]();
                }
            }
        }
    });
}

// Auto-init quando DOM carregado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccessibility);
} else {
    initAccessibility();
}

// Exportar para uso global
window.ImaginaTech = window.ImaginaTech || {};
window.ImaginaTech.accessibility = {
    activateFocusTrap,
    deactivateFocusTrap,
    openModalAccessible,
    closeModalAccessible,
    announce,
    initKeyboardNavigation
};
