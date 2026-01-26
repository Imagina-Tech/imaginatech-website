/*
==================================================
ARQUIVO: servicos/js/event-handlers.js
MODULO: Sistema de Delegacao de Eventos
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 1.0
DESCRICAO: Substitui onclick inline por delegacao de eventos
==================================================
*/

import { state, logger } from './config.js';
import {
    signInWithGoogle,
    signOut,
    closeModal,
    openAddModal,
    closeStatusModal,
    closeTrackingModal,
    closeDeliveryModal,
    closeBypassModal,
    closeClientsModal,
    closeImageModal,
    closeFilesModal,
    confirmTrackingCode,
    confirmBypassPassword,
    copyClientDataToPickup,
    copyClientDataToDelivery,
    prevImage,
    nextImage,
    selectServiceType,
    closeServiceTypeModal,
    // Input handlers
    formatCPFCNPJ,
    formatEmailInput,
    toggleDeliveryFields,
    toggleDateInput,
    handleFileSelect,
    handleImageSelect,
    buscarCEP,
    handleInstagramPhotoSelect,
    handlePackagedPhotoSelect,
    // Preview handlers
    removePreviewImage,
    removeFilePreview,
    // Service actions
    showServiceImages,
    showServiceFiles,
    showDeliveryInfo,
    contactClient,
    openEditModal,
    // Photo removal (exportados globalmente)
    removeInstagramPhoto,
    removePackagedPhoto,
    // Client actions (SEGURANCA: migrado de onclick inline)
    selectClient,
    copyToClipboard,
    toggleClientDetails,
    viewClientHistory,
    closeClientHistoryModal,
    navigateToServiceByCode
} from './auth-ui.js';

// Alias para compatibilidade
const signOutGlobal = signOut;

// toggleMobileMenu vem do /shared/navbar-mobile.js (carregado globalmente)
const toggleMobileMenu = () => {
    if (typeof window.toggleMobileMenu === 'function') {
        window.toggleMobileMenu();
    }
};

import {
    filterServices,
    addColorEntry,
    openUpModal,
    closeUpModal,
    showUpForm,
    saveToPortfolio,
    removeUpPhoto,
    removeUpLogo,
    generateOrderCode,
    confirmStatusChange,
    // Input handlers from services.js
    toggleMultiColorMode,
    toggleCategoryField,
    handleUpPhotoSelect,
    handleUpLogoSelect,
    // Service card actions
    deleteService,
    updateStatus,
    removeColorEntry,
    removeExtraPhoto,
    handleExtraPhotoSelect,
    // Multi-color handlers
    handleColorEntryChange,
    handleWeightEntryChange
} from './services.js';

// regenerateOrderCode usa generateOrderCode internamente
const regenerateOrderCode = () => {
    const orderCodeInput = document.getElementById('orderCode');
    if (orderCodeInput) {
        orderCodeInput.value = generateOrderCode();
    }
};

// ===========================
// MAPEAMENTO DE ACOES
// ===========================

const actionHandlers = {
    // Autenticacao
    'signInWithGoogle': signInWithGoogle,
    'signOutGlobal': signOutGlobal,

    // Modais - Fechar
    'closeModal': closeModal,
    'closeStatusModal': closeStatusModal,
    'closeTrackingModal': closeTrackingModal,
    'closeDeliveryModal': closeDeliveryModal,
    'closeBypassModal': closeBypassModal,
    'closeClientsModal': closeClientsModal,
    'closeImageModal': closeImageModal,
    'closeFilesModal': closeFilesModal,
    'closeServiceTypeModal': closeServiceTypeModal,
    'closeUpModal': closeUpModal,

    // Modais - Abrir/Confirmar
    'openAddModal': openAddModal,
    'confirmStatusChange': confirmStatusChange,
    'confirmTrackingCode': confirmTrackingCode,
    'confirmBypassPassword': confirmBypassPassword,

    // Servicos
    'selectServiceTypeImpressao': () => selectServiceType('impressao'),
    'selectServiceTypeModelagem': () => selectServiceType('modelagem'),
    'addColorEntry': addColorEntry,
    'regenerateOrderCode': regenerateOrderCode,

    // Filtros
    'filterTodos': () => filterServices('todos'),
    'filterPendente': () => filterServices('pendente'),
    'filterProducao': () => filterServices('producao'),
    'filterConcluido': () => filterServices('concluido'),
    'filterRetirada': () => filterServices('retirada'),
    'filterEntregue': () => filterServices('entregue'),

    // Navegacao de imagens
    'prevImage': prevImage,
    'nextImage': nextImage,

    // Copiar dados
    'copyClientDataToPickup': copyClientDataToPickup,
    'copyClientDataToDelivery': copyClientDataToDelivery,

    // Portfolio Up
    'showUpForm': showUpForm,
    'saveToPortfolio': saveToPortfolio,
    'removeUpPhoto': removeUpPhoto,
    'removeUpLogo': removeUpLogo,

    // Triggers de input
    'triggerUpPhoto': () => document.getElementById('upPhoto')?.click(),
    'triggerUpLogo': () => document.getElementById('upLogo')?.click(),
    'triggerUpExtraPhotos': () => document.getElementById('upExtraPhotosInput')?.click(),

    // Mobile
    'toggleMobileMenu': toggleMobileMenu,

    // Viewer
    'openImageInNewTab': () => {
        const img = document.getElementById('viewerImage');
        if (img?.src) window.open(img.src, '_blank');
    },

    // Service Card Actions (migrados de onclick inline)
    'openUpModal': (event, element) => {
        const serviceId = element.dataset.serviceId;
        if (serviceId) openUpModal(serviceId);
    },
    'openEditModal': (event, element) => {
        const serviceId = element.dataset.serviceId;
        if (serviceId) openEditModal(serviceId);
    },
    'deleteService': (event, element) => {
        const serviceId = element.dataset.serviceId;
        if (serviceId) deleteService(serviceId);
    },
    'updateStatus': (event, element) => {
        const serviceId = element.dataset.serviceId;
        const status = element.dataset.status;
        if (serviceId && status) updateStatus(serviceId, status);
    },
    'showServiceFiles': (event, element) => {
        const serviceId = element.dataset.serviceId;
        if (serviceId) showServiceFiles(serviceId);
    },
    'showServiceImages': (event, element) => {
        const serviceId = element.dataset.serviceId;
        if (serviceId) showServiceImages(serviceId);
    },
    'showDeliveryInfo': (event, element) => {
        const serviceId = element.dataset.serviceId;
        if (serviceId) showDeliveryInfo(serviceId);
    },
    'contactClient': (event, element) => {
        const phone = element.dataset.phone;
        const serviceName = element.dataset.serviceName;
        const orderCode = element.dataset.orderCode;
        const clientName = element.dataset.clientName;
        if (phone) contactClient(phone, serviceName, orderCode, clientName);
    },

    // Image Gallery Actions
    'viewFullImageFromGallery': (event, element) => {
        const imageIndex = parseInt(element.dataset.imageIndex, 10);
        if (!isNaN(imageIndex) && window.viewFullImageFromGallery) {
            window.viewFullImageFromGallery(imageIndex);
        }
    },
    'removeImageFromGallery': async (event, element) => {
        event.stopPropagation();
        const { serviceId, imageIndex, imageSource, imageUrl } = element.dataset;
        if (window.removeImageFromGallery) {
            await window.removeImageFromGallery(serviceId, parseInt(imageIndex, 10), imageSource, imageUrl);
        }
    },

    // File Modal Actions
    'openFileInNewTab': (event, element) => {
        const fileUrl = element.dataset.fileUrl;
        if (fileUrl) window.open(fileUrl, '_blank');
    },
    'removeFileFromService': async (event, element) => {
        const { serviceId, fileIndex, fileUrl } = element.dataset;
        if (window.removeFileFromService) {
            await window.removeFileFromService(serviceId, parseInt(fileIndex, 10), fileUrl);
        }
    },

    // Preview Removal Actions
    'removePreviewImage': (event, element) => {
        const imageIndex = parseInt(element.dataset.imageIndex, 10);
        if (!isNaN(imageIndex)) removePreviewImage(imageIndex);
    },
    'removeFilePreview': (event, element) => {
        const fileIndex = parseInt(element.dataset.fileIndex, 10);
        if (!isNaN(fileIndex)) removeFilePreview(fileIndex);
    },
    'removeInstagramPhoto': (event, element) => {
        const photoIndex = parseInt(element.dataset.photoIndex, 10);
        if (!isNaN(photoIndex)) removeInstagramPhoto(photoIndex);
    },
    'removePackagedPhoto': (event, element) => {
        const photoIndex = parseInt(element.dataset.photoIndex, 10);
        if (!isNaN(photoIndex)) removePackagedPhoto(photoIndex);
    },

    // Multi-Color Actions
    'removeColorEntry': (event, element) => {
        const index = parseInt(element.dataset.index, 10);
        if (!isNaN(index)) removeColorEntry(index);
    },

    // Extra Photo Slots (Portfolio Up)
    'triggerExtraPhotoInput': (event, element) => {
        // Evitar disparar se clicou no botao de remover
        if (event.target.closest('.btn-remove-slot')) return;
        const slotId = element.dataset.slotId;
        document.getElementById(`extraPhotoInput_${slotId}`)?.click();
    },
    'removeExtraPhotoSlot': (event, element) => {
        event.stopPropagation();
        const slotId = parseInt(element.dataset.slotId, 10);
        if (!isNaN(slotId)) removeExtraPhoto(slotId);
    },

    // ===========================
    // SEGURANCA: Handlers migrados de onclick inline (Auditoria 2026-01-24)
    // ===========================

    // Client Suggestions (autocomplete)
    'selectClient': (event, element) => {
        const clientId = element.dataset.clientId;
        if (clientId) selectClient(clientId);
    },

    // Copy to Clipboard (delivery info)
    'copyToClipboard': (event, element) => {
        const value = element.dataset.value;
        if (value) copyToClipboard(value, element);
    },

    // WhatsApp Fallback Modal
    'closeWhatsappModal': (event, element) => {
        const modal = element.closest('.whatsapp-fallback-modal');
        if (modal) modal.remove();
    },
    'openWhatsappAndClose': (event, element) => {
        // O link ja abre em nova aba via href/target
        // Apenas fechar o modal apos um delay
        setTimeout(() => {
            const modal = element.closest('.whatsapp-fallback-modal');
            if (modal) modal.remove();
        }, 500);
    },

    // Client List Actions
    'toggleClientDetails': (event, element) => {
        const clientId = element.dataset.clientId;
        if (clientId) toggleClientDetails(clientId);
    },
    'viewClientHistory': (event, element) => {
        event.stopPropagation();
        const email = element.dataset.email;
        const clientName = element.dataset.clientName;
        if (email) viewClientHistory(email, clientName || '');
    },
    'closeClientHistoryModal': () => {
        closeClientHistoryModal();
    },

    // Navigate to Service by Order Code
    'navigateToServiceByCode': (event, element) => {
        event.stopPropagation();
        const orderCode = element.dataset.orderCode;
        if (orderCode) navigateToServiceByCode(orderCode);
    }
};

// ===========================
// HANDLERS DE INPUT/CHANGE/BLUR
// ===========================

const inputHandlers = {
    'formatCPFCNPJ': formatCPFCNPJ,
    'formatEmailInput': formatEmailInput,
    // Multi-color weight input
    'handleWeightEntryChange': (event, element) => {
        const index = parseInt(element.dataset.index, 10);
        if (!isNaN(index)) handleWeightEntryChange(index);
    }
};

const changeHandlers = {
    'toggleMultiColorMode': toggleMultiColorMode,
    'toggleDeliveryFields': toggleDeliveryFields,
    'toggleDateInput': toggleDateInput,
    'handleFileSelect': handleFileSelect,
    'handleImageSelect': handleImageSelect,
    'handleInstagramPhotoSelect': handleInstagramPhotoSelect,
    'handlePackagedPhotoSelect': handlePackagedPhotoSelect,
    'handleUpPhotoSelect': handleUpPhotoSelect,
    'toggleCategoryField': toggleCategoryField,
    'handleUpLogoSelect': handleUpLogoSelect,
    // Multi-color dropdown
    'handleColorEntryChange': (event, element) => {
        const index = parseInt(element.dataset.index, 10);
        if (!isNaN(index)) handleColorEntryChange(index);
    },
    // Extra photo select
    'handleExtraPhotoSelect': (event, element) => {
        const slotId = parseInt(element.dataset.slotId, 10);
        if (!isNaN(slotId)) handleExtraPhotoSelect(event, slotId);
    }
};

const blurHandlers = {
    'buscarCEP': buscarCEP
};

const keydownHandlers = {
    'confirmBypassOnEnter': (event, element) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            confirmBypassPassword();
        }
    }
};

// ===========================
// DELEGACAO DE EVENTOS
// ===========================

/**
 * Handler principal de cliques delegados
 * Procura por data-action no elemento clicado ou seus pais
 */
function handleDelegatedClick(event) {
    // Procurar elemento com data-action
    const actionElement = event.target.closest('[data-action]');
    if (!actionElement) return;

    const action = actionElement.dataset.action;
    const handler = actionHandlers[action];

    if (handler) {
        event.preventDefault();
        event.stopPropagation();

        try {
            handler(event, actionElement);
        } catch (error) {
            logger.error(`Erro ao executar acao "${action}":`, error);
        }
    } else {
        logger.warn(`Acao nao encontrada: ${action}`);
    }
}

/**
 * Handler para eventos de input delegados
 * Procura por data-input no elemento
 */
function handleDelegatedInput(event) {
    const inputElement = event.target.closest('[data-input]');
    if (!inputElement) return;

    const action = inputElement.dataset.input;
    const handler = inputHandlers[action];

    if (handler) {
        try {
            handler(event, inputElement);
        } catch (error) {
            logger.error(`Erro ao executar input handler "${action}":`, error);
        }
    }
}

/**
 * Handler para eventos de change delegados
 * Procura por data-change no elemento
 */
function handleDelegatedChange(event) {
    const changeElement = event.target.closest('[data-change]');
    if (!changeElement) return;

    const action = changeElement.dataset.change;
    const handler = changeHandlers[action];

    if (handler) {
        try {
            handler(event, changeElement);
        } catch (error) {
            logger.error(`Erro ao executar change handler "${action}":`, error);
        }
    }
}

/**
 * Handler para eventos de blur delegados
 * Procura por data-blur no elemento
 */
function handleDelegatedBlur(event) {
    const blurElement = event.target.closest('[data-blur]');
    if (!blurElement) return;

    const action = blurElement.dataset.blur;
    const handler = blurHandlers[action];

    if (handler) {
        try {
            handler(event, blurElement);
        } catch (error) {
            logger.error(`Erro ao executar blur handler "${action}":`, error);
        }
    }
}

/**
 * Handler para eventos de keydown delegados
 * Procura por data-keydown no elemento
 */
function handleDelegatedKeydown(event) {
    const keydownElement = event.target.closest('[data-keydown]');
    if (!keydownElement) return;

    const action = keydownElement.dataset.keydown;
    const handler = keydownHandlers[action];

    if (handler) {
        try {
            handler(event, keydownElement);
        } catch (error) {
            logger.error(`Erro ao executar keydown handler "${action}":`, error);
        }
    }
}

/**
 * Handler para fechar modais clicando fora
 */
function handleModalBackdropClick(event) {
    // Se clicou diretamente no modal (backdrop), fechar
    if (event.target.classList.contains('modal') && event.target.classList.contains('active')) {
        const closeBtn = event.target.querySelector('[data-action]');
        if (closeBtn) {
            const action = closeBtn.dataset.action;
            if (actionHandlers[action]) {
                actionHandlers[action]();
            }
        }
    }
}

/**
 * Handler para tecla Escape
 */
function handleEscapeKey(event) {
    if (event.key !== 'Escape') return;

    // Encontrar modal ativo
    const activeModal = document.querySelector('.modal.active');
    if (activeModal) {
        const closeBtn = activeModal.querySelector('[data-action]');
        if (closeBtn) {
            const action = closeBtn.dataset.action;
            if (actionHandlers[action]) {
                event.preventDefault();
                actionHandlers[action]();
            }
        }
    }
}

// ===========================
// INICIALIZACAO
// ===========================

/**
 * Inicializa sistema de delegacao de eventos
 */
export function initEventDelegation() {
    // Delegacao de cliques
    document.addEventListener('click', handleDelegatedClick);

    // Fechar modal clicando no backdrop
    document.addEventListener('click', handleModalBackdropClick);

    // Delegacao de input (oninput)
    document.addEventListener('input', handleDelegatedInput);

    // Delegacao de change (onchange)
    document.addEventListener('change', handleDelegatedChange);

    // Delegacao de blur (onblur) - precisa usar capture para funcionar
    document.addEventListener('blur', handleDelegatedBlur, true);

    // Delegacao de keydown (para Enter em inputs, etc.)
    document.addEventListener('keydown', handleDelegatedKeydown);

    // Tecla Escape
    document.addEventListener('keydown', handleEscapeKey);

    logger.log('Sistema de delegacao de eventos inicializado');
}

/**
 * Registra nova acao no sistema
 * @param {string} name - Nome da acao
 * @param {Function} handler - Funcao handler
 */
export function registerAction(name, handler) {
    if (actionHandlers[name]) {
        logger.warn(`Acao "${name}" ja existe, sobrescrevendo`);
    }
    actionHandlers[name] = handler;
}

/**
 * Registra multiplas acoes
 * @param {Object} actions - Objeto com acoes
 */
export function registerActions(actions) {
    Object.entries(actions).forEach(([name, handler]) => {
        registerAction(name, handler);
    });
}

// Exportar para uso global
window.ImaginaTech = window.ImaginaTech || {};
window.ImaginaTech.events = {
    registerAction,
    registerActions,
    handlers: actionHandlers
};
