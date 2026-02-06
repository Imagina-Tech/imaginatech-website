// ===========================
// ARQUIVO: script.js
// MÓDULO: Acompanhar Pedido (Portal do Cliente)
// SISTEMA: ImaginaTech - Gestão de Impressão 3D
// VERSÃO: 5.0 - Security Hardened
// IMPORTANTE: NÃO REMOVER ESTE CABEÇALHO DE IDENTIFICAÇÃO
// ===========================

// ===========================
// SEGURANCA: Funcoes de sanitizacao
// ===========================

/**
 * Escapa caracteres HTML para prevenir XSS
 * @param {string} str - String a ser escapada
 * @returns {string} String segura para innerHTML
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Mascara email para logs (LGPD)
 * @param {string} email - Email a ser mascarado
 * @returns {string} Email mascarado
 */
function maskEmail(email) {
    if (!email) return '[sem email]';
    const parts = email.split('@');
    if (parts.length !== 2) return '[email invalido]';
    const name = parts[0];
    const domain = parts[1];
    const masked = name.length > 2
        ? name.substring(0, 2) + '***'
        : '***';
    return `${masked}@${domain}`;
}

/**
 * Logger - usa o logger centralizado do Firestore
 * Carregado via /shared/firestore-logger.js
 */
const logger = window.logger || {
    log: () => {},
    warn: () => {},
    error: () => {},
    info: () => {},
    debug: () => {}
};

// ===========================
// SEGURANCA: Validacao de configuracao
// ===========================

// Firebase Configuration (OBRIGATORIO de ENV_CONFIG - sem fallback)
if (!window.ENV_CONFIG) {
    logger.error('[FATAL] ENV_CONFIG nao carregado. Verifique env-config.js');
    document.body.innerHTML = '<div style="color:red;padding:2rem;text-align:center;">Erro de configuracao. Contate o suporte.</div>';
    throw new Error('ENV_CONFIG required');
}

const firebaseConfig = {
    apiKey: window.ENV_CONFIG.FIREBASE_API_KEY,
    authDomain: window.ENV_CONFIG.FIREBASE_AUTH_DOMAIN,
    projectId: window.ENV_CONFIG.FIREBASE_PROJECT_ID,
    storageBucket: window.ENV_CONFIG.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: window.ENV_CONFIG.FIREBASE_MESSAGING_SENDER_ID,
    appId: window.ENV_CONFIG.FIREBASE_APP_ID
};

// Validar que todas as chaves existem
const requiredKeys = ['apiKey', 'authDomain', 'projectId'];
for (const key of requiredKeys) {
    if (!firebaseConfig[key]) {
        logger.error(`[FATAL] Firebase config missing: ${key}`);
        throw new Error(`Firebase config incomplete: ${key}`);
    }
}

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Configurar persistência de sessão ANTES de qualquer operação
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        logger.log('Persistencia de sessao configurada');

        // Verificar se já existe usuário após configurar persistência
        const user = auth.currentUser;
        if (user) {
            logger.log('Usuario ja estava logado:', maskEmail(user.email));
            currentUser = user;
        }
    })
    .catch((error) => {
        logger.error('Erro ao configurar persistencia:', error);
    });

// Global Variables
let currentUser = null;
let currentOrderCode = null;
let currentOrderId = null;
let orderListener = null;
let historyListeners = []; // Array para armazenar listeners do histórico
let clientAttempts = 0;
const MAX_ATTEMPTS = 3;
let pendingUrlOrderCode = null; // Código da URL aguardando processamento

// ========================================
// CLEANUP DE LISTENERS AO SAIR DA PAGINA
// Previne memory leaks e listeners orfaos
// ========================================
function cleanupAllListeners() {
    if (orderListener) {
        try {
            orderListener();
            orderListener = null;
        } catch (e) {
            logger.warn('Erro ao limpar orderListener:', e);
        }
    }

    if (historyListeners.length > 0) {
        historyListeners.forEach(listener => {
            try {
                if (typeof listener === 'function') {
                    listener();
                }
            } catch (e) {
                logger.warn('Erro ao limpar historyListener:', e);
            }
        });
        historyListeners = [];
    }
}

// Limpar ao sair da pagina (navegar, fechar, recarregar)
window.addEventListener('beforeunload', cleanupAllListeners);
window.addEventListener('pagehide', cleanupAllListeners);

// WhatsApp da ImaginaTech (carregado de ENV_CONFIG)
const WHATSAPP_NUMBER = window.ENV_CONFIG?.WHATSAPP_NUMBER || '5521968972539';

// Status Messages in Portuguese
const STATUS_MESSAGES = {
    'pendente': {
        text: 'Pedido Recebido',
        icon: 'fas fa-clock',
        message: 'Seu pedido foi recebido e está aguardando início da produção.'
    },
    'producao': {
        text: 'Em Produção',
        icon: 'fas fa-cogs',
        message: 'Seu pedido está sendo produzido! Em breve estará pronto.'
    },
    'concluido': {
        text: 'Concluído',
        icon: 'fas fa-check-circle',
        message: 'Seu pedido foi concluído e está aguardando retirada.'
    },
    'retirada': {
        text: 'Pronto para Retirada',
        icon: 'fas fa-box-open',
        message: 'Seu pedido está pronto! Você já pode retirá-lo.'
    },
    'transporte': {
        text: 'Em Transporte',
        icon: 'fas fa-truck',
        message: 'Seu pedido foi postado e está a caminho!'
    },
    'entregue': {
        text: 'Entregue',
        icon: 'fas fa-handshake',
        message: 'Pedido entregue com sucesso! Obrigado pela preferência.'
    }
};

// Delivery Method Icons
const DELIVERY_ICONS = {
    'retirada': 'fas fa-store',
    'sedex': 'fas fa-shipping-fast',
    'uber': 'fas fa-car',
    'definir': 'fas fa-question-circle'
};

// Helper para detectar transportadora pelo código de rastreamento
// Letra (A-Z) = Correios | Número (0-9) = Jadlog
function getCarrierInfo(trackingCode) {
    if (!trackingCode) {
        return { name: 'transportadora', preposition: 'pela', article: 'a' };
    }
    const firstChar = trackingCode.charAt(0);
    const isCorreios = /[a-zA-Z]/.test(firstChar);
    return isCorreios
        ? { name: 'Correios', preposition: 'pelos', article: 'os' }
        : { name: 'Jadlog', preposition: 'pela', article: 'a' };
}

// ===========================
// INITIALIZATION
// ===========================

document.addEventListener('DOMContentLoaded', () => {
    // Hide loading after DOM ready
    setTimeout(() => {
        document.getElementById('loadingOverlay')?.classList.add('hidden');
    }, 1000);

    // Verificar se há código na URL (ex: /acompanhar-pedido/?codigo=KJ4FE)
    const urlParams = new URLSearchParams(window.location.search);
    const urlOrderCode = urlParams.get('codigo')?.toUpperCase() || null;

    if (urlOrderCode && urlOrderCode.length === 5) {
        logger.log('Codigo do pedido encontrado na URL:', urlOrderCode);
        pendingUrlOrderCode = urlOrderCode; // Armazenar globalmente
    }

    // Auth state observer simplificado
    auth.onAuthStateChanged(async (user) => {
        logger.log('Estado de autenticacao:', user ? `Logado como ${maskEmail(user.email)}` : 'Nao logado');

        if (user) {
            currentUser = user;
            showCodeSection();

            // Se há código pendente da URL, preencher e verificar automaticamente
            if (pendingUrlOrderCode) {
                const codeInput = document.getElementById('orderCode');
                if (codeInput) {
                    codeInput.value = pendingUrlOrderCode;
                    logger.log('Preenchendo codigo da URL:', pendingUrlOrderCode);
                    // Limpar o código pendente e verificar
                    const codeToVerify = pendingUrlOrderCode;
                    pendingUrlOrderCode = null;
                    // Delay para garantir que o DOM está pronto
                    setTimeout(() => {
                        logger.log('Verificando codigo automaticamente:', codeToVerify);
                        verifyCode();
                    }, 800);
                }
            }

            // Carregar histórico de pedidos
            try {
                await loadUserOrders();
            } catch (error) {
                logger.warn('Erro ao carregar historico:', error);
                { const el = document.getElementById('myOrdersSection'); if (el) el.style.display = 'none'; }
            }
        } else {
            currentUser = null;
            showLoginSection();
        }
    });
    
    // Code input formatter
    const codeInput = document.getElementById('orderCode');
    if (codeInput) {
        codeInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        });
        
        codeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                verifyCode();
            }
        });
    }
    
    // Listener para quando a janela ganhar foco - sincronizar estado
    window.addEventListener('focus', () => {
        if (currentUser && auth.currentUser) {
            // Recarregar histórico quando voltar o foco
            logger.log('Janela ganhou foco - recarregando historico');
            loadUserOrders().catch(err => {
                logger.warn('Erro ao recarregar historico:', err);
            });
        }
    });

    // ===========================
    // EVENT DELEGATION - Handlers seguros (sem onclick inline)
    // ===========================
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const handlers = {
            'login': () => loginWithGoogle(),
            'logout': () => logout(),
            'verify-code': () => verifyCode(),
            'back-to-code': () => backToCode(),
            'refresh-order': () => refreshOrder(),
            'print-order': () => printOrder(),
            'close-modal': () => closeModal(),
            'toggle-mobile-menu': () => typeof toggleMobileMenu === 'function' && toggleMobileMenu(),
            'open-photo': () => {
                const url = target.dataset.url;
                const index = parseInt(target.dataset.index, 10);
                const total = parseInt(target.dataset.total, 10);
                if (url) openPhotoModal(url, index, total);
            },
            'close-photo-modal': () => closePhotoModal(),
            'navigate-photo': () => {
                const direction = parseInt(target.dataset.direction, 10);
                navigatePhoto(direction);
            },
            'quick-load-order': () => {
                const code = target.dataset.code;
                if (code) quickLoadOrder(code);
            }
        };

        if (handlers[action]) {
            e.preventDefault();
            handlers[action]();
        }
    });
});

// ===========================
// AUTHENTICATION FUNCTIONS
// ===========================

async function loginWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);

        if (result.user) {
            // SEGURANCA: Verificar se o email foi verificado
            if (!result.user.emailVerified) {
                logger.warn('[Auth] Email nao verificado:', maskEmail(result.user.email));
                await auth.signOut();
                showToast('Seu email precisa ser verificado. Verifique sua caixa de entrada.', 'error');
                return;
            }

            currentUser = result.user;
            showToast('Login realizado com sucesso!', 'success');

            // Log opcional de atividade
            try {
                await logUserActivity('login', {
                    uid: result.user.uid,
                    email: result.user.email,
                    name: result.user.displayName
                });
            } catch (error) {
                logger.warn('Log opcional nao registrado:', error.message);
            }
        }
    } catch (error) {
        logger.error('Erro no login:', error);
        if (error.code === 'auth/popup-blocked') {
            showToast('Pop-up bloqueado. Permita pop-ups para este site.', 'error');
        } else {
            showToast('Erro ao fazer login. Tente novamente.', 'error');
        }
    }
}

async function logout() {
    try {
        // Usar funcao centralizada de cleanup
        cleanupAllListeners();

        await auth.signOut();
        currentUser = null;
        currentOrderCode = null;
        currentOrderId = null;

        showToast('Logout realizado com sucesso!', 'info');
        showLoginSection();
    } catch (error) {
        logger.error('Erro no logout:', error);
        showToast('Erro ao fazer logout.', 'error');
    }
}

// ===========================
// UI FUNCTIONS
// ===========================

function showLoginSection() {
    // Mostrar tela de login fullscreen
    document.getElementById('loginScreen')?.classList.add('active');
    // Esconder conteudo principal
    document.getElementById('mainNavbar')?.classList.add('hidden');
    document.getElementById('mainContainer')?.classList.add('hidden');
    document.getElementById('orderView')?.classList.add('hidden');
}

function showCodeSection() {
    // Esconder tela de login
    document.getElementById('loginScreen')?.classList.remove('active');
    // Mostrar conteudo principal
    document.getElementById('mainNavbar')?.classList.remove('hidden');
    document.getElementById('mainContainer')?.classList.remove('hidden');
    // Configurar secoes internas
    document.getElementById('loginSection')?.classList.add('hidden');
    document.getElementById('codeSection')?.classList.remove('hidden');
    document.getElementById('orderView')?.classList.add('hidden');

    // Update user info - verificar se currentUser existe
    const user = currentUser || auth.currentUser;
    if (user) {
        { const el = document.getElementById('userName'); if (el) el.textContent = user.displayName || 'Usuario'; }
        { const el = document.getElementById('userPhoto'); if (el) el.src = user.photoURL || '/assets/default-avatar.png'; }

        // Garantir que currentUser esta definido
        currentUser = user;
    }

    // Reset attempts
    clientAttempts = 0;
    // So limpar o input se nao houver codigo pendente da URL
    if (!pendingUrlOrderCode) {
        { const el = document.getElementById('orderCode'); if (el) el.value = ''; }
    }
    document.getElementById('attemptsWarning')?.classList.remove('show');
}

function showOrderView() {
    document.getElementById('welcomeScreen')?.classList.add('hidden');
    document.getElementById('orderView')?.classList.remove('hidden');

    // Atualizar link do WhatsApp com codigo do pedido (SEGURO: sem onclick inline)
    const whatsappLink = document.getElementById('whatsappLink');
    const displayCode = document.getElementById('displayCode');
    if (whatsappLink && displayCode) {
        const code = displayCode.textContent || '';
        const safeCode = encodeURIComponent(code);
        whatsappLink.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Olá! Gostaria de informações sobre o pedido código: ')}${safeCode}`;
    }
}

function backToCode() {
    document.getElementById('orderView')?.classList.add('hidden');
    document.getElementById('welcomeScreen')?.classList.remove('hidden');

    // Stop listening to order updates
    if (orderListener) {
        orderListener();
        orderListener = null;
    }

    // Recarregar histórico para garantir que os listeners estejam ativos
    if (currentUser) {
        loadUserOrders();
    }

    // Clear code input
    { const el = document.getElementById('orderCode'); if (el) el.value = ''; }
    document.getElementById('attemptsWarning')?.classList.remove('show');
}

// ===========================
// ORDER VERIFICATION
// ===========================

async function verifyCode() {
    const code = (document.getElementById('orderCode')?.value || '').trim().toUpperCase();
    
    if (!code || code.length !== 5) {
        showToast('Digite um código válido de 5 caracteres', 'error');
        return;
    }
    
    // Verificar se está realmente autenticado
    const user = auth.currentUser;
    if (!user) {
        logger.log('Usuario nao autenticado ao verificar codigo');
        showToast('Faça login primeiro', 'error');
        return;
    }

    // Debug: mostrar informações do usuário (mascarado)
    logger.log('Verificando codigo como:', maskEmail(user.email));
    
    if (clientAttempts >= MAX_ATTEMPTS) {
        showToast('Limite de tentativas excedido. Tente novamente mais tarde.', 'error');
        return;
    }
    
    clientAttempts++;
    
    try {
        logger.log('Buscando pedido com codigo:', code);

        // Tentar buscar o pedido
        const snapshot = await db.collection('services')
            .where('orderCode', '==', code)
            .limit(1)
            .get();

        logger.log('Resultado da busca:', snapshot.empty ? 'Nenhum pedido encontrado' : 'Pedido encontrado');

        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            currentOrderId = doc.id;
            currentOrderCode = code;
            const orderData = doc.data();

            logger.log('Pedido encontrado:', doc.id);

            // Save order to user's history - usar try-catch
            try {
                await saveOrderToHistory(code);
            } catch (error) {
                logger.warn('Erro ao salvar no historico:', error.message);
                // Continuar mesmo se falhar ao salvar histórico
            }

            // Update client tracking access
            try {
                await updateClientTrackingAccess(code, orderData);
            } catch (error) {
                logger.warn('Erro ao registrar acesso do cliente:', error.message);
            }

            // Show order details
            showOrderDetails(doc.id, orderData);

            // Listen for real-time updates
            startOrderListener(doc.id);

            showToast('Pedido encontrado!', 'success');

            // Log successful access - usar try-catch
            try {
                await logUserActivity('order_viewed', {
                    orderCode: code,
                    orderId: doc.id
                });
            } catch (error) {
                logger.warn('Log opcional nao registrado:', error.message);
            }

        } else {
            handleInvalidCode();
        }
    } catch (error) {
        logger.error('Erro ao verificar codigo:', error);

        // Verificar diferentes tipos de erro
        if (error.code === 'permission-denied' || error.message.includes('permission')) {
            // Tentar re-autenticar
            const currentAuth = auth.currentUser;
            if (!currentAuth) {
                showToast('Sessão expirada. Faça login novamente.', 'error');
                showLoginSection();
            } else {
                showToast('Erro de permissão. Recarregue a página e tente novamente.', 'error');
                logger.log('Usuario autenticado mas sem permissao:', maskEmail(currentAuth.email));
            }
        } else if (error.code === 'unavailable') {
            showToast('Serviço temporariamente indisponível. Tente novamente.', 'error');
        } else {
            showToast('Erro ao buscar pedido. Tente novamente.', 'error');
        }
    }
}

function handleInvalidCode() {
    const remainingAttempts = MAX_ATTEMPTS - clientAttempts;

    if (remainingAttempts > 0) {
        document.getElementById('orderCode')?.classList.add('error');
        document.getElementById('attemptsWarning')?.classList.add('show');
        { const el = document.getElementById('attemptsText'); if (el) el.textContent = `Codigo invalido. ${remainingAttempts} tentativa(s) restante(s).`; }

        showToast('Codigo nao encontrado', 'error');

        setTimeout(() => {
            document.getElementById('orderCode')?.classList.remove('error');
        }, 500);
    } else {
        showToast('Limite de tentativas excedido', 'error');
        setTimeout(() => {
            clientAttempts = 0;
            { const el = document.getElementById('orderCode'); if (el) el.value = ''; }
            document.getElementById('attemptsWarning')?.classList.remove('show');
        }, 5000);
    }
}

// ===========================
// ORDER DISPLAY
// ===========================

function showOrderDetails(orderId, orderData) {
    showOrderView();

    // Update order code display
    { const el = document.getElementById('displayCode'); if (el) el.textContent = orderData.orderCode || 'N/A'; }

    // Create order card content
    const orderCard = document.getElementById('orderCard');
    if (!orderCard) return;
    
    // Lógica especial para SEDEX com status retirada (que na verdade é transporte)
    let actualStatus = orderData.status;
    if (orderData.deliveryMethod === 'sedex' && orderData.status === 'retirada') {
        actualStatus = 'transporte';
    }
    
    const statusInfo = STATUS_MESSAGES[actualStatus] || STATUS_MESSAGES['pendente'];
    
    // Criar mensagem personalizada baseada no status e método de entrega
    let customMessage = statusInfo.message;
    
    // Detectar transportadora pelo código de rastreamento (se existir)
    const carrier = getCarrierInfo(orderData.trackingCode);

    // Se o pedido está concluído, personalizar mensagem por método de entrega
    if (orderData.status === 'concluido') {
        if (orderData.deliveryMethod === 'sedex') {
            // Para envio - aguardando postagem
            customMessage = 'Seu pedido foi concluído e está aguardando postagem.';
        } else if (orderData.deliveryMethod === 'retirada') {
            // Para retirada - aguardando liberação
            customMessage = 'Seu pedido foi concluído e está sendo preparado para retirada.';
        } else if (orderData.deliveryMethod === 'uber') {
            // Para Uber/99 - aguardando envio
            customMessage = 'Seu pedido foi concluído e está aguardando envio via Uber/99.';
        } else {
            // Método indefinido
            customMessage = 'Seu pedido foi concluído e está aguardando definição do método de entrega.';
        }
    }

    // Se está em "retirada" e é SEDEX, está em transporte
    if (orderData.status === 'retirada' && orderData.deliveryMethod === 'sedex') {
        customMessage = `Seu pedido foi postado e está em transporte ${carrier.preposition} ${carrier.name}.`;
    }
    
    // Verificar se a data está indefinida
    const days = orderData.dateUndefined ? null : calculateDaysRemaining(orderData.dueDate);
    const daysText = orderData.dateUndefined ? 'Prazo a definir' : formatDaysText(days);
    const daysColor = orderData.dateUndefined ? 'var(--text-secondary)' : getDaysColor(days);
    
    // Formatar método de entrega
    const deliveryIcon = DELIVERY_ICONS[orderData.deliveryMethod] || DELIVERY_ICONS['definir'];
    const deliveryText = formatDeliveryMethod(orderData.deliveryMethod, orderData.trackingCode);
    
    // Informações de retirada (com escape XSS)
    let pickupSection = '';
    if (orderData.deliveryMethod === 'retirada' && orderData.pickupInfo) {
        pickupSection = `
            <div class="detail-item" style="grid-column: 1 / -1;">
                <div class="detail-label">
                    <i class="fas fa-user-check"></i>
                    Quem vai retirar
                </div>
                <div class="detail-value">
                    ${escapeHtml(orderData.pickupInfo.name) || 'Não informado'}
                    ${orderData.pickupInfo.whatsapp ? `<br><small>WhatsApp: ${escapeHtml(orderData.pickupInfo.whatsapp)}</small>` : ''}
                </div>
            </div>
        `;
    }

    // Gerar galeria de fotos SEGURA (usando data-attributes ao inves de onclick)
    let photosGalleryHtml = '';
    if (orderData.images && orderData.images.length > 0) {
        const totalImages = orderData.images.length;
        photosGalleryHtml = `
        <div class="product-photos-section">
            <div class="photos-header">
                <i class="fas fa-camera"></i>
                <h4>Fotos do Produto Finalizado</h4>
            </div>
            <div class="photos-gallery">
                ${orderData.images.map((image, index) => `
                    <div class="photo-item loading" id="photo-item-${index}"
                         data-action="open-photo"
                         data-url="${escapeHtml(image.url)}"
                         data-index="${index}"
                         data-total="${totalImages}">
                        <img src="${escapeHtml(image.url)}" alt="Foto do produto ${index + 1}" loading="lazy"
                             data-photo-index="${index}">
                        <div class="photo-overlay">
                            <i class="fas fa-search-plus"></i>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        `;
    }

    // Endereco de entrega (com escape XSS)
    let deliveryAddressHtml = '';
    if (orderData.deliveryMethod === 'sedex' && orderData.deliveryAddress) {
        const addr = orderData.deliveryAddress;
        deliveryAddressHtml = `
        <div class="delivery-address-container">
            <div style="color: var(--neon-purple); margin-bottom: 0.5rem;">
                <i class="fas fa-map-marked-alt"></i>
                <strong>Endereço de Entrega:</strong>
            </div>
            <p>${escapeHtml(addr.fullName)}<br>
            ${escapeHtml(addr.rua)}, ${escapeHtml(addr.numero)} ${addr.complemento ? '- ' + escapeHtml(addr.complemento) : ''}<br>
            ${escapeHtml(addr.bairro)}<br>
            ${escapeHtml(addr.cidade)} - ${escapeHtml(addr.estado)}<br>
            CEP: ${escapeHtml(addr.cep)}</p>
        </div>
        `;
    }

    orderCard.innerHTML = `
        <div class="order-status-header">
            <div>
                <h3>${escapeHtml(orderData.name) || 'Serviço sem nome'}</h3>
                <p style="color: var(--text-secondary); margin-top: 0.5rem;">
                    Cliente: ${escapeHtml(orderData.client) || 'Não informado'}
                </p>
            </div>
            <div class="status-badge status-${escapeHtml(actualStatus)}">
                <i class="${escapeHtml(statusInfo.icon)}"></i>
                ${escapeHtml(statusInfo.text)}
            </div>
        </div>

        <div class="status-message" style="
            background: var(--glass-bg);
            padding: 1rem;
            border-radius: 10px;
            margin: 1.5rem 0;
            border-left: 3px solid var(--neon-blue);
        ">
            <i class="${escapeHtml(statusInfo.icon)}" style="color: var(--neon-blue); margin-right: 0.5rem;"></i>
            ${escapeHtml(customMessage)}
        </div>

        ${photosGalleryHtml}

        <div class="order-details">
            <div class="detail-item">
                <div class="detail-label">
                    <i class="fas fa-calendar-check"></i>
                    Data de Início
                </div>
                <div class="detail-value">
                    ${formatDate(orderData.startDate)}
                </div>
            </div>

            <div class="detail-item">
                <div class="detail-label">
                    <i class="fas fa-calendar-alt"></i>
                    Prazo de Entrega
                </div>
                <div class="detail-value" style="color: ${daysColor}">
                    ${orderData.dateUndefined ?
                        '<span style="color: var(--text-secondary);">A definir</span>' :
                        formatDate(orderData.dueDate)
                    }
                    <small style="display: block; margin-top: 0.25rem;">
                        ${escapeHtml(daysText)}
                    </small>
                </div>
            </div>

            <div class="detail-item">
                <div class="detail-label">
                    <i class="fas fa-cube"></i>
                    Material
                </div>
                <div class="detail-value">
                    ${escapeHtml(orderData.material) || 'Não especificado'}
                </div>
            </div>

            <div class="detail-item">
                <div class="detail-label">
                    <i class="fas fa-palette"></i>
                    Cor
                </div>
                <div class="detail-value">
                    ${formatColor(orderData.color)}
                </div>
            </div>

            <div class="detail-item">
                <div class="detail-label">
                    <i class="${escapeHtml(deliveryIcon)}"></i>
                    Método de Entrega
                </div>
                <div class="detail-value">
                    ${escapeHtml(deliveryText)}
                </div>
            </div>

            ${orderData.weight ? `
            <div class="detail-item">
                <div class="detail-label">
                    <i class="fas fa-weight"></i>
                    Peso
                </div>
                <div class="detail-value">
                    ${escapeHtml(orderData.weight)}g
                </div>
            </div>
            ` : ''}

            ${orderData.value ? `
            <div class="detail-item">
                <div class="detail-label">
                    <i class="fas fa-dollar-sign"></i>
                    Valor
                </div>
                <div class="detail-value" style="color: var(--neon-green);">
                    R$ ${formatMoney(orderData.value)}
                </div>
            </div>
            ` : ''}

            ${orderData.description ? `
            <div class="detail-item" style="grid-column: 1 / -1;">
                <div class="detail-label">
                    <i class="fas fa-info-circle"></i>
                    Descrição
                </div>
                <div class="detail-value">
                    ${escapeHtml(orderData.description)}
                </div>
            </div>
            ` : ''}

            ${pickupSection}
        </div>

        ${deliveryAddressHtml}
    `;

    // Adicionar listeners para carregar fotos (substituindo onload/onerror inline)
    orderCard.querySelectorAll('.photo-item img').forEach(img => {
        const index = img.dataset.photoIndex;
        img.addEventListener('load', () => handleProductPhotoLoaded(parseInt(index, 10)));
        img.addEventListener('error', () => handleProductPhotoLoaded(parseInt(index, 10)));
    });
    
    // Update timeline
    updateTimeline(orderData);
}

function updateTimeline(orderData) {
    const timeline = document.getElementById('timeline');
    if (!timeline) return;
    const events = [];
    
    // Add creation event
    if (orderData.createdAt) {
        events.push({
            date: formatDateTime(orderData.createdAt),
            text: 'Pedido criado',
            icon: 'fas fa-plus-circle',
            completed: true
        });
    }
    
    // Add production started event
    if (orderData.productionStartedAt) {
        events.push({
            date: formatDateTime(orderData.productionStartedAt),
            text: 'Produção iniciada',
            icon: 'fas fa-play-circle',
            completed: true
        });
    }
    
    // Add completed event
    if (orderData.completedAt) {
        events.push({
            date: formatDateTime(orderData.completedAt),
            text: 'Produção concluída',
            icon: 'fas fa-check-circle',
            completed: true
        });
    }
    
    // Lógica específica por método de entrega
    if (orderData.deliveryMethod === 'sedex') {
        // Detectar transportadora pelo código de rastreamento
        const timelineCarrier = getCarrierInfo(orderData.trackingCode);

        // Para envio - adicionar postado na transportadora
        if (orderData.postedAt) {
            events.push({
                date: formatDateTime(orderData.postedAt),
                text: `Postado n${timelineCarrier.article} ${timelineCarrier.name}`,
                icon: 'fas fa-shipping-fast',
                completed: true
            });
        }

        // Adicionar código de rastreamento se existir
        if (orderData.trackingCode) {
            events.push({
                date: 'Rastreamento disponível',
                text: 'Código de Rastreamento',
                icon: 'fas fa-barcode',
                completed: true,
                special: 'tracking',
                trackingCode: orderData.trackingCode
            });
        }

        // Para envio com status entregue
        if (orderData.status === 'entregue' && orderData.deliveredAt) {
            events.push({
                date: formatDateTime(orderData.deliveredAt),
                text: `Entregue ${timelineCarrier.preposition} ${timelineCarrier.name}`,
                icon: 'fas fa-handshake',
                completed: true
            });
        }
        
    } else if (orderData.deliveryMethod === 'retirada') {
        // Para RETIRADA - adicionar pronto para retirada somente se for retirada
        if (orderData.readyAt || orderData.status === 'retirada') {
            events.push({
                date: orderData.readyAt ? formatDateTime(orderData.readyAt) : 'Status atual',
                text: 'Pronto para retirada',
                icon: 'fas fa-box-open',
                completed: !!orderData.readyAt
            });
        }
        
        // Para RETIRADA com status entregue
        if (orderData.status === 'entregue' && orderData.deliveredAt) {
            events.push({
                date: formatDateTime(orderData.deliveredAt),
                text: 'Retirado pelo cliente',
                icon: 'fas fa-handshake',
                completed: true
            });
        }
        
    } else if (orderData.deliveryMethod === 'uber') {
        // Para UBER/99
        if (orderData.deliveredAt) {
            events.push({
                date: formatDateTime(orderData.deliveredAt),
                text: 'Entregue via Uber/99',
                icon: 'fas fa-car',
                completed: true
            });
        }
    } else {
        // Para outros métodos ou não definido
        if (orderData.status === 'entregue' && orderData.deliveredAt) {
            events.push({
                date: formatDateTime(orderData.deliveredAt),
                text: 'Entregue',
                icon: 'fas fa-handshake',
                completed: true
            });
        }
    }
    
    // Add current status as last event if not delivered
    if (orderData.status !== 'entregue') {
        // Verificar status especial para SEDEX
        let currentStatusKey = orderData.status;
        let currentStatusText = STATUS_MESSAGES[orderData.status].text;
        
        if (orderData.deliveryMethod === 'sedex' && orderData.status === 'retirada') {
            currentStatusText = 'Em Transporte';
            currentStatusKey = 'transporte';
        }
        
        const statusInfo = STATUS_MESSAGES[currentStatusKey];
        events.push({
            date: 'Status atual',
            text: currentStatusText,
            icon: statusInfo.icon,
            completed: false,
            current: true
        });
    }
    
    // Render timeline
    timeline.innerHTML = events.map(event => {
        // Se for evento de código de rastreamento, renderizar especial
        if (event.special === 'tracking' && event.trackingCode) {
            // Detectar transportadora pelo primeiro caractere
            // Letra (A-Z) = Correios | Número (0-9) = Jadlog
            const firstChar = event.trackingCode.charAt(0);
            const isCorreios = /[a-zA-Z]/.test(firstChar);

            const trackingUrl = isCorreios
                ? `https://rastreamento.correios.com.br/app/index.php?objeto=${event.trackingCode}`
                : `https://www.jadlog.com.br/siteInstitucional/tracking.jad?cte=${event.trackingCode}`;

            const trackingLabel = isCorreios ? 'Rastrear nos Correios' : 'Rastrear na Jadlog';
            const trackingIcon = isCorreios ? 'fa-truck' : 'fa-shipping-fast';

            return `
                <div class="timeline-item completed" style="
                    background: rgba(0, 212, 255, 0.1);
                    border: 1px solid var(--neon-blue);
                ">
                    <div class="timeline-date">
                        <strong>${event.date}</strong>
                    </div>
                    <div class="timeline-content">
                        <i class="${event.icon}" style="margin-right: 0.5rem; color: var(--neon-blue);"></i>
                        ${event.text}
                    </div>
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-top: 0.75rem;
                        padding-top: 0.75rem;
                        border-top: 1px solid var(--glass-border);
                    ">
                        <code class="tracking-code">${event.trackingCode}</code>
                        <a href="${trackingUrl}"
                           target="_blank"
                           style="
                               padding: 0.4rem 0.8rem;
                               background: linear-gradient(135deg, var(--neon-blue), var(--secondary-blue));
                               color: white;
                               border-radius: 6px;
                               text-decoration: none;
                               font-size: 0.85rem;
                               display: inline-flex;
                               align-items: center;
                               gap: 0.5rem;
                               transition: all 0.3s ease;
                           ">
                            <i class="fas ${trackingIcon}"></i>
                            ${trackingLabel}
                        </a>
                    </div>
                </div>
            `;
        }
        
        // Renderização normal para outros eventos
        return `
            <div class="timeline-item ${event.completed ? 'completed' : ''} ${event.current ? 'current' : ''}">
                <div class="timeline-date">
                    ${event.current ? '<strong>Agora</strong>' : event.date}
                </div>
                <div class="timeline-content">
                    <i class="${event.icon}" style="margin-right: 0.5rem;"></i>
                    ${event.text}
                </div>
            </div>
        `;
    }).join('');
}

// ===========================
// REAL-TIME UPDATES
// ===========================

function startOrderListener(orderId) {
    if (orderListener) {
        try {
            orderListener();
        } catch (e) {
            logger.warn('Erro ao limpar listener anterior:', e);
        }
        orderListener = null;
    }

    try {
        orderListener = db.collection('services').doc(orderId)
            .onSnapshot(
                (doc) => {
                    if (doc.exists) {
                        const data = doc.data();
                        showOrderDetails(doc.id, data);

                        // Atualizar também o histórico de pedidos se estiver visível
                        if (currentUser) {
                            // Usar setTimeout para evitar conflitos
                            setTimeout(() => loadUserOrders(), 100);
                        }

                        // Show notification if status changed
                        if (data.lastStatusChange &&
                            new Date(data.lastStatusChange) > new Date(Date.now() - 5000)) {
                            showToast('Status do pedido atualizado!', 'info');
                        }
                    } else {
                        showToast('Pedido não encontrado', 'error');
                        backToCode();
                    }
                },
                (error) => {
                    // Tratar erro de permissão sem forçar logout
                    logger.error('Erro no listener do pedido:', error);
                    if (error.code === 'permission-denied') {
                        showToast('Erro de permissão ao monitorar pedido. Recarregue a página.', 'error');
                        // Não fazer logout, apenas parar o listener
                        if (orderListener) {
                            orderListener();
                            orderListener = null;
                        }
                    } else {
                        showToast('Erro ao monitorar pedido', 'error');
                    }
                }
            );
    } catch (error) {
        logger.error('Erro ao criar listener:', error);
        showToast('Erro ao monitorar atualizações', 'error');
    }
}

function refreshOrder() {
    if (currentOrderId) {
        showToast('Atualizando...', 'info');
        
        // Force refresh by restarting listener
        startOrderListener(currentOrderId);
    }
}

// ===========================
// USER ORDERS HISTORY - REVISADO
// ===========================

async function loadUserOrders() {
    if (!currentUser) return;
    
    try {
        // Buscar documento do usuário específico pela conta Google
        const userRef = db.collection('user_orders').doc(currentUser.uid);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            const orderCodes = userData.orderCodes || [];
            
            if (orderCodes.length > 0) {
                await displayUserOrders(orderCodes);
            } else {
                // Esconder seção se não houver pedidos
                { const el = document.getElementById('myOrdersSection'); if (el) el.style.display = 'none'; }
            }
        } else {
            // Criar documento do usuário se não existir
            await userRef.set({
                uid: currentUser.uid,
                email: currentUser.email,
                name: currentUser.displayName,
                photoURL: currentUser.photoURL,
                orderCodes: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            { const el = document.getElementById('myOrdersSection'); if (el) el.style.display = 'none'; }
        }
    } catch (error) {
        logger.error('Erro ao carregar pedidos:', error);
        { const el = document.getElementById('myOrdersSection'); if (el) el.style.display = 'none'; }
    }
}

async function displayUserOrders(orderCodes) {
    const ordersList = document.getElementById('ordersList');
    const myOrdersSection = document.getElementById('myOrdersSection');
    
    // Limpar listeners anteriores
    if (historyListeners.length > 0) {
        historyListeners.forEach(listener => {
            try {
                listener();
            } catch (e) {
                logger.warn('Erro ao limpar listener:', e);
            }
        });
        historyListeners = [];
    }
    
    if (!orderCodes || orderCodes.length === 0) {
        if (myOrdersSection) myOrdersSection.style.display = 'none';
        return;
    }

    if (myOrdersSection) myOrdersSection.style.display = 'block';
    
    // Buscar detalhes de cada pedido (máximo 5 mais recentes)
    const orders = [];
    const recentCodes = orderCodes.slice(-5).reverse(); // Pegar últimos 5 e inverter para mostrar mais recente primeiro
    
    for (const code of recentCodes) {
        try {
            const snapshot = await db.collection('services')
                .where('orderCode', '==', code)
                .limit(1)
                .get();
            
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                const orderData = doc.data();
                
                // Aplicar lógica especial para SEDEX
                let displayStatus = orderData.status;
                if (orderData.deliveryMethod === 'sedex' && orderData.status === 'retirada') {
                    displayStatus = 'transporte';
                }
                
                orders.push({
                    code: code,
                    data: orderData,
                    displayStatus: displayStatus,
                    id: doc.id
                });
                
                // Adicionar listener em tempo real com tratamento de erro
                try {
                    const listener = db.collection('services').doc(doc.id)
                        .onSnapshot(
                            (docSnapshot) => {
                                if (docSnapshot.exists) {
                                    const updatedData = docSnapshot.data();
                                    let updatedStatus = updatedData.status;
                                    if (updatedData.deliveryMethod === 'sedex' && updatedData.status === 'retirada') {
                                        updatedStatus = 'transporte';
                                    }

                                    // Atualizar o item específico no DOM (com escape XSS)
                                    const orderElement = document.querySelector(`[data-order-code="${code}"]`);
                                    if (orderElement) {
                                        const statusBadge = orderElement.querySelector('.status-badge');
                                        if (statusBadge) {
                                            statusBadge.className = `status-badge status-${escapeHtml(updatedStatus)}`;
                                            statusBadge.style.cssText = 'font-size: 0.8rem; padding: 0.25rem 0.75rem;';
                                            statusBadge.textContent = STATUS_MESSAGES[updatedStatus]?.text || 'Status desconhecido';
                                        }
                                        const nameElement = orderElement.querySelector('.order-item-date');
                                        if (nameElement) {
                                            nameElement.textContent = updatedData.name || 'Sem nome';
                                        }
                                    }
                                }
                            },
                            (error) => {
                                // Tratar erro silenciosamente - não forçar logout
                                logger.warn(`Listener do pedido ${code} desabilitado:`, error.message);
                                // Não propagar o erro
                            }
                        );

                    historyListeners.push(listener);
                } catch (error) {
                    logger.warn(`Nao foi possivel criar listener para ${code}:`, error.message);
                    // Continuar sem o listener - não é crítico
                }
            }
        } catch (error) {
            logger.warn(`Erro ao buscar pedido ${code}:`, error.message);
        }
    }
    
    if (orders.length === 0) {
        if (myOrdersSection) myOrdersSection.style.display = 'none';
        return;
    }

    // Renderizar lista de pedidos com data-action SEGURO (sem onclick inline)
    if (!ordersList) return;
    ordersList.innerHTML = orders.map(order => `
        <div class="order-item" data-action="quick-load-order" data-code="${escapeHtml(order.code)}" data-order-code="${escapeHtml(order.code)}">
            <div>
                <div class="order-item-code">${escapeHtml(order.code)}</div>
                <div class="order-item-date">${escapeHtml(order.data.name) || 'Sem nome'}</div>
            </div>
            <div class="status-badge status-${escapeHtml(order.displayStatus)}" style="font-size: 0.8rem; padding: 0.25rem 0.75rem;">
                ${escapeHtml(STATUS_MESSAGES[order.displayStatus]?.text) || 'Status desconhecido'}
            </div>
        </div>
    `).join('');
}

async function quickLoadOrder(code) {
    { const el = document.getElementById('orderCode'); if (el) el.value = code; }
    await verifyCode();
}

async function saveOrderToHistory(code, orderData = null) {
    if (!currentUser || !code) return;

    try {
        const userRef = db.collection('user_orders').doc(currentUser.uid);
        const userDoc = await userRef.get();

        // Dados do acesso de tracking para registro
        const trackingAccess = {
            orderCode: code,
            accessedAt: new Date().toISOString(),
            device: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop'
        };

        if (userDoc.exists) {
            const userData = userDoc.data();
            let orderCodes = userData.orderCodes || [];
            let trackingHistory = userData.trackingHistory || [];

            // Adicionar código apenas se não existir
            if (!orderCodes.includes(code)) {
                orderCodes.push(code);

                // Manter apenas os últimos 20 pedidos
                if (orderCodes.length > 20) {
                    orderCodes = orderCodes.slice(-20);
                }
            }

            // Adicionar ao histórico de tracking
            trackingHistory.push(trackingAccess);
            // Manter últimos 50 acessos
            if (trackingHistory.length > 50) {
                trackingHistory = trackingHistory.slice(-50);
            }

            await userRef.update({
                orderCodes: orderCodes,
                lastOrderViewed: code,
                lastOrderViewedAt: new Date().toISOString(),
                trackingHistory: trackingHistory,
                // Atualizar dados do usuário Google
                email: currentUser.email,
                name: currentUser.displayName,
                photoURL: currentUser.photoURL,
                updatedAt: new Date().toISOString()
            });

            // Recarregar lista de pedidos
            await loadUserOrders();
        } else {
            // Criar documento se não existir
            await userRef.set({
                uid: currentUser.uid,
                email: currentUser.email,
                name: currentUser.displayName,
                photoURL: currentUser.photoURL,
                orderCodes: [code],
                lastOrderViewed: code,
                lastOrderViewedAt: new Date().toISOString(),
                trackingHistory: [trackingAccess],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            // Recarregar lista de pedidos
            await loadUserOrders();
        }

        logger.log('Historico salvo em user_orders para:', maskEmail(currentUser.email));
    } catch (error) {
        logger.error('Erro ao salvar no historico:', error);
    }
}

// ===========================
// UTILITY FUNCTIONS
// ===========================

function calculateDaysRemaining(dueDate) {
    if (!dueDate) return null;
    
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}

function formatDaysText(days) {
    if (days === null) return 'Prazo não definido';
    if (days === 0) return 'Entrega hoje!';
    if (days === 1) return 'Entrega amanhã';
    if (days < 0) return `${Math.abs(days)} dias atrás`;
    return `${days} dias restantes`;
}

function getDaysColor(days) {
    if (days === null) return 'var(--text-secondary)';
    if (days < 0) return 'var(--neon-red)';
    if (days <= 2) return 'var(--neon-orange)';
    if (days <= 5) return 'var(--neon-yellow)';
    return 'var(--neon-green)';
}

function formatDate(dateString) {
    if (!dateString) return 'Não informado';
    
    const date = new Date(dateString);
    const options = { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    };
    
    return date.toLocaleDateString('pt-BR', options);
}

function formatDateTime(dateString) {
    if (!dateString) return 'Não informado';
    
    const date = new Date(dateString);
    const dateOptions = { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    };
    const timeOptions = {
        hour: '2-digit',
        minute: '2-digit'
    };
    
    return `${date.toLocaleDateString('pt-BR', dateOptions)} às ${date.toLocaleTimeString('pt-BR', timeOptions)}`;
}

function formatColor(color) {
    if (!color) return 'Não especificada';
    
    const colors = {
        'preto': '⚫ Preto',
        'branco': '⚪ Branco',
        'vermelho': '🔴 Vermelho',
        'azul': '🔵 Azul',
        'verde': '🟢 Verde',
        'amarelo': '🟡 Amarelo',
        'laranja': '🟠 Laranja',
        'roxo': '🟣 Roxo',
        'cinza': '⚪ Cinza',
        'transparente': '💎 Transparente',
        'outros': '🎨 Outras'
    };
    
    return colors[color] || color;
}

function formatDeliveryMethod(method, trackingCode = null) {
    if (!method) return 'A definir';

    // Para envio postal, detectar transportadora pelo código
    if (method === 'sedex') {
        const carrier = getCarrierInfo(trackingCode);
        return `Envio ${carrier.preposition} ${carrier.name}`;
    }

    const methods = {
        'retirada': 'Retirada no Local',
        'uber': 'Uber/99',
        'definir': 'A definir'
    };

    return methods[method] || method;
}

function formatMoney(value) {
    if (!value) return '0,00';
    
    const number = parseFloat(value);
    return number.toFixed(2).replace('.', ',');
}

// ===========================
// TOAST NOTIFICATIONS
// ===========================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="toast-icon ${icons[type]}"></i>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, 3000);
}

// ===========================
// PRINT FUNCTION
// ===========================

function printOrder() {
    window.print();
}

// ===========================
// MODAL FUNCTIONS
// ===========================

function showModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    { const el = document.getElementById('modalTitle'); if (el) el.textContent = title; }
    { const el = document.getElementById('modalMessage'); if (el) el.textContent = message; }

    const confirmBtn = document.getElementById('modalConfirm');
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            onConfirm();
            closeModal();
        };
    }

    modal?.classList.add('active');
}

function closeModal() {
    document.getElementById('confirmModal')?.classList.remove('active');
}

// ===========================
// PHOTO MODAL
// ===========================

let currentPhotoIndex = 0;
let totalPhotos = 0;
let currentPhotos = [];

function openPhotoModal(photoUrl, index, total) {
    currentPhotoIndex = index;
    totalPhotos = total;

    // Criar modal se não existir
    let photoModal = document.getElementById('photoModal');
    if (!photoModal) {
        photoModal = document.createElement('div');
        photoModal.id = 'photoModal';
        photoModal.className = 'photo-modal';
        // SEGURANCA: Usar data-action ao inves de onclick inline
        photoModal.innerHTML = `
            <div class="photo-modal-overlay" data-action="close-photo-modal"></div>
            <div class="photo-modal-content">
                <button class="photo-modal-close" data-action="close-photo-modal" title="Fechar visualizacao">
                    <i class="fas fa-times"></i>
                </button>
                ${total > 1 ? `
                <button class="photo-nav-btn prev" data-action="navigate-photo" data-direction="-1" title="Foto anterior">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <button class="photo-nav-btn next" data-action="navigate-photo" data-direction="1" title="Proxima foto">
                    <i class="fas fa-chevron-right"></i>
                </button>
                ` : ''}
                <img id="photoModalImage" src="${escapeHtml(photoUrl)}" alt="Foto do produto">
                ${total > 1 ? `<div class="photo-counter" id="photoCounter">${index + 1} / ${total}</div>` : ''}
            </div>
        `;
        document.body.appendChild(photoModal);
    } else {
        { const el = document.getElementById('photoModalImage'); if (el) el.src = escapeHtml(photoUrl); }
        if (total > 1) {
            { const el = document.getElementById('photoCounter'); if (el) el.textContent = `${index + 1} / ${total}`; }
        }
    }

    photoModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePhotoModal() {
    const photoModal = document.getElementById('photoModal');
    if (photoModal) {
        photoModal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

function navigatePhoto(direction) {
    // Pegar todas as imagens do pedido atual
    const orderCard = document.getElementById('orderCard');
    if (!orderCard) return;
    const images = Array.from(orderCard.querySelectorAll('.photo-item img'));
    if (images.length === 0) return;

    currentPhotoIndex += direction;

    // Circular navigation
    if (currentPhotoIndex < 0) currentPhotoIndex = images.length - 1;
    if (currentPhotoIndex >= images.length) currentPhotoIndex = 0;

    const newPhotoUrl = images[currentPhotoIndex].src;
    { const el = document.getElementById('photoModalImage'); if (el) el.src = newPhotoUrl; }
    { const el = document.getElementById('photoCounter'); if (el) el.textContent = `${currentPhotoIndex + 1} / ${images.length}`; }
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    const photoModal = document.getElementById('photoModal');
    if (photoModal && photoModal.classList.contains('active')) {
        if (e.key === 'Escape') closePhotoModal();
        if (e.key === 'ArrowLeft') navigatePhoto(-1);
        if (e.key === 'ArrowRight') navigatePhoto(1);
    }
});

// Global functions
window.openPhotoModal = openPhotoModal;
window.closePhotoModal = closePhotoModal;
window.navigatePhoto = navigatePhoto;

// ===========================
// SHIMMER IMAGE LOAD HANDLER
// ===========================
function handleProductPhotoLoaded(index) {
    const container = document.getElementById(`photo-item-${index}`);
    if (container) {
        container.classList.remove('loading');
        container.classList.add('loaded');
    }
}

window.handleProductPhotoLoaded = handleProductPhotoLoaded;

// ===========================
// ACTIVITY LOGGING
// ===========================

async function logUserActivity(action, data) {
    if (!currentUser) return;

    try {
        await db.collection('activity_logs').add({
            userId: currentUser.uid,
            userEmail: currentUser.email,
            action: action,
            data: data,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            platform: 'web_tracking'
        });
    } catch (error) {
        // Log silencioso - não interrompe o fluxo
        logger.warn('Log de atividade opcional:', error.message);
    }
}

// ===========================
// CLIENT ACCESS TRACKING
// ===========================
async function updateClientTrackingAccess(orderCode, orderData) {
    if (!currentUser) return;

    try {
        // Get photo URL from Google
        const photoURL = currentUser.photoURL ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || currentUser.email)}&background=00D4FF&color=fff&bold=true&size=128`;

        // Check if the logged user matches the order's client email
        const isOrderClient = orderData.clientEmail &&
            currentUser.email &&
            orderData.clientEmail.toLowerCase() === currentUser.email.toLowerCase();

        // Dados do acesso de tracking
        const trackingData = {
            // Dados do usuário Google
            googleUid: currentUser.uid,
            googleEmail: currentUser.email.toLowerCase(),
            googleName: currentUser.displayName || currentUser.email.split('@')[0],
            googlePhotoURL: photoURL,
            // Dados do pedido
            orderCode: orderCode,
            orderClientEmail: orderData.clientEmail || null,
            orderClientName: orderData.client || null,
            orderClientPhone: orderData.clientPhone || null,
            isOrderClient: isOrderClient,
            // Metadados
            accessedAt: new Date().toISOString(),
            device: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
            userAgent: navigator.userAgent
        };

        // Registrar em tracking_access (coleção que clientes podem escrever)
        await db.collection('tracking_access').add(trackingData);
        logger.log('Acesso de tracking registrado para:', maskEmail(currentUser.email));

        // Tentar atualizar a coleção clients (pode falhar por permissão - é esperado para não-admins)
        try {
            // Buscar cliente existente
            let clientRef = null;
            let clientDoc = null;

            // Buscar por email do Google
            const emailQuery = await db.collection('clients')
                .where('email', '==', currentUser.email.toLowerCase())
                .limit(1)
                .get();

            if (!emailQuery.empty) {
                clientDoc = emailQuery.docs[0];
                clientRef = clientDoc.ref;
            }

            // Se não encontrou, buscar por googleEmail
            if (!clientRef) {
                const googleEmailQuery = await db.collection('clients')
                    .where('googleEmail', '==', currentUser.email.toLowerCase())
                    .limit(1)
                    .get();

                if (!googleEmailQuery.empty) {
                    clientDoc = googleEmailQuery.docs[0];
                    clientRef = clientDoc.ref;
                }
            }

            // Se não encontrou e é o cliente do pedido, buscar pelo email do pedido
            if (!clientRef && isOrderClient) {
                const orderEmailQuery = await db.collection('clients')
                    .where('email', '==', orderData.clientEmail.toLowerCase())
                    .limit(1)
                    .get();

                if (!orderEmailQuery.empty) {
                    clientDoc = orderEmailQuery.docs[0];
                    clientRef = clientDoc.ref;
                }
            }

            if (clientRef) {
                // Atualizar cliente existente
                const existingData = clientDoc.data();
                const existingOrderCodes = existingData.orderCodes || [];

                if (!existingOrderCodes.includes(orderCode)) {
                    existingOrderCodes.push(orderCode);
                }

                const updateData = {
                    lastOrderTrackingAccess: new Date().toISOString(),
                    googleUid: currentUser.uid,
                    googleEmail: currentUser.email.toLowerCase(),
                    googlePhotoURL: photoURL,
                    orderCodes: existingOrderCodes,
                    updatedAt: new Date().toISOString()
                };

                // Atualizar nome se melhor
                if (currentUser.displayName && (!existingData.name || existingData.name === existingData.email?.split('@')[0])) {
                    updateData.name = currentUser.displayName;
                }

                await clientRef.update(updateData);
                logger.log('Cliente atualizado em clients:', escapeHtml(existingData.name) || maskEmail(currentUser.email));
            } else {
                // Criar novo cliente
                const newClientData = {
                    name: currentUser.displayName || currentUser.email.split('@')[0],
                    email: currentUser.email.toLowerCase(),
                    phone: isOrderClient && orderData.clientPhone ? orderData.clientPhone : '',
                    cpf: isOrderClient && orderData.clientCPF ? orderData.clientCPF.replace(/\D/g, '') : '',
                    googleUid: currentUser.uid,
                    googleEmail: currentUser.email.toLowerCase(),
                    googlePhotoURL: photoURL,
                    orderCodes: [orderCode],
                    lastOrderTrackingAccess: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                await db.collection('clients').add(newClientData);
                logger.log('Novo cliente criado em clients:', escapeHtml(newClientData.name));
            }
        } catch (clientError) {
            // Esperado falhar para usuários não-admin - o registro em tracking_access já foi feito
            logger.log('Registro em clients nao permitido (esperado para clientes):', clientError.code || clientError.message);
        }

    } catch (error) {
        logger.error('Erro ao registrar acesso de tracking:', error);
    }
}

// ===========================
// ERROR HANDLING
// ===========================

window.addEventListener('error', (e) => {
    logger.error('Erro global:', e);
});

window.addEventListener('unhandledrejection', (e) => {
    logger.error('Promise rejeitada:', e);
});