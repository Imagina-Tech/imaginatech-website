// ===========================
// ARQUIVO: script.js
// MÓDULO: Acompanhar Pedido (Portal do Cliente)
// SISTEMA: ImaginaTech - Gestão de Impressão 3D
// VERSÃO: 4.1 - Mobile Responsivo
// IMPORTANTE: NÃO REMOVER ESTE CABEÇALHO DE IDENTIFICAÇÃO
// ===========================

// Firebase Configuration (mesma do sistema principal)
const firebaseConfig = {
    apiKey: "AIzaSyDZxuazTrmimr0951TmTCKckI4Ede2hdn4",
    authDomain: "imaginatech-servicos.firebaseapp.com",
    projectId: "imaginatech-servicos",
    storageBucket: "imaginatech-servicos.firebasestorage.app",
    messagingSenderId: "321455309872",
    appId: "1:321455309872:web:e7ba49a0f020bbae1159f5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Configurar persistência de sessão ANTES de qualquer operação
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
        console.log('Persistência de sessão configurada');
        
        // Verificar se já existe usuário após configurar persistência
        const user = auth.currentUser;
        if (user) {
            console.log('Usuário já estava logado:', user.email);
            currentUser = user;
        }
    })
    .catch((error) => {
        console.error('Erro ao configurar persistência:', error);
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

// WhatsApp da ImaginaTech
const WHATSAPP_NUMBER = '5521968972539';

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
        message: 'Seu pedido foi postado e está em transporte pelos Correios.'
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

// ===========================
// INITIALIZATION
// ===========================

document.addEventListener('DOMContentLoaded', () => {
    // Hide loading after DOM ready
    setTimeout(() => {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }, 1000);

    // Verificar se há código na URL (ex: /acompanhar-pedido/?codigo=KJ4FE)
    const urlParams = new URLSearchParams(window.location.search);
    const urlOrderCode = urlParams.get('codigo')?.toUpperCase() || null;

    if (urlOrderCode && urlOrderCode.length === 5) {
        console.log('📋 Código do pedido encontrado na URL:', urlOrderCode);
        pendingUrlOrderCode = urlOrderCode; // Armazenar globalmente
    }

    // Auth state observer simplificado
    auth.onAuthStateChanged(async (user) => {
        console.log('Estado de autenticação:', user ? `Logado como ${user.email}` : 'Não logado');

        if (user) {
            currentUser = user;
            showCodeSection();

            // Se há código pendente da URL, preencher e verificar automaticamente
            if (pendingUrlOrderCode) {
                const codeInput = document.getElementById('orderCode');
                if (codeInput) {
                    codeInput.value = pendingUrlOrderCode;
                    console.log('📋 Preenchendo código da URL:', pendingUrlOrderCode);
                    // Limpar o código pendente e verificar
                    const codeToVerify = pendingUrlOrderCode;
                    pendingUrlOrderCode = null;
                    // Delay para garantir que o DOM está pronto
                    setTimeout(() => {
                        console.log('🔍 Verificando código automaticamente:', codeToVerify);
                        verifyCode();
                    }, 800);
                }
            }

            // Carregar histórico de pedidos
            try {
                await loadUserOrders();
            } catch (error) {
                console.warn('Erro ao carregar histórico:', error);
                document.getElementById('myOrdersSection').style.display = 'none';
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
            console.log('Janela ganhou foco - recarregando histórico');
            loadUserOrders().catch(err => {
                console.warn('Erro ao recarregar histórico:', err);
            });
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
                console.warn('Log opcional não registrado:', error.message);
            }
        }
    } catch (error) {
        console.error('Erro no login:', error);
        if (error.code === 'auth/popup-blocked') {
            showToast('Pop-up bloqueado. Permita pop-ups para este site.', 'error');
        } else {
            showToast('Erro ao fazer login. Tente novamente.', 'error');
        }
    }
}

async function logout() {
    try {
        // Limpar todos os listeners antes de fazer logout
        if (orderListener) {
            orderListener();
            orderListener = null;
        }
        
        if (historyListeners.length > 0) {
            historyListeners.forEach(listener => {
                try {
                    listener();
                } catch (e) {
                    console.warn('Erro ao limpar listener:', e);
                }
            });
            historyListeners = [];
        }
        
        await auth.signOut();
        currentUser = null;
        currentOrderCode = null;
        currentOrderId = null;
        
        showToast('Logout realizado com sucesso!', 'info');
        showLoginSection();
    } catch (error) {
        console.error('Erro no logout:', error);
        showToast('Erro ao fazer logout.', 'error');
    }
}

// ===========================
// UI FUNCTIONS
// ===========================

function showLoginSection() {
    document.getElementById('loginSection').classList.remove('hidden');
    document.getElementById('codeSection').classList.add('hidden');
    document.getElementById('orderView').classList.add('hidden');
}

function showCodeSection() {
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('codeSection').classList.remove('hidden');
    document.getElementById('orderView').classList.add('hidden');

    // Update user info - verificar se currentUser existe
    const user = currentUser || auth.currentUser;
    if (user) {
        document.getElementById('userName').textContent = user.displayName || 'Usuário';
        document.getElementById('userPhoto').src = user.photoURL || '/assets/default-avatar.png';

        // Garantir que currentUser está definido
        currentUser = user;
    }

    // Reset attempts
    clientAttempts = 0;
    // Só limpar o input se não houver código pendente da URL
    if (!pendingUrlOrderCode) {
        document.getElementById('orderCode').value = '';
    }
    document.getElementById('attemptsWarning').classList.remove('show');
}

function showOrderView() {
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('orderView').classList.remove('hidden');
}

function backToCode() {
    document.getElementById('orderView').classList.add('hidden');
    document.getElementById('welcomeScreen').classList.remove('hidden');
    
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
    document.getElementById('orderCode').value = '';
    document.getElementById('attemptsWarning').classList.remove('show');
}

// ===========================
// ORDER VERIFICATION
// ===========================

async function verifyCode() {
    const code = document.getElementById('orderCode').value.trim().toUpperCase();
    
    if (!code || code.length !== 5) {
        showToast('Digite um código válido de 5 caracteres', 'error');
        return;
    }
    
    // Verificar se está realmente autenticado
    const user = auth.currentUser;
    if (!user) {
        console.log('Usuário não autenticado ao verificar código');
        showToast('Faça login primeiro', 'error');
        return;
    }
    
    // Debug: mostrar informações do usuário
    console.log('Verificando código como:', user.email);
    
    if (clientAttempts >= MAX_ATTEMPTS) {
        showToast('Limite de tentativas excedido. Tente novamente mais tarde.', 'error');
        return;
    }
    
    clientAttempts++;
    
    try {
        console.log('Buscando pedido com código:', code);
        
        // Tentar buscar o pedido
        const snapshot = await db.collection('services')
            .where('orderCode', '==', code)
            .limit(1)
            .get();
        
        console.log('Resultado da busca:', snapshot.empty ? 'Nenhum pedido encontrado' : 'Pedido encontrado');
        
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            currentOrderId = doc.id;
            currentOrderCode = code;
            const orderData = doc.data();

            console.log('Pedido encontrado:', doc.id);

            // Save order to user's history - usar try-catch
            try {
                await saveOrderToHistory(code);
            } catch (error) {
                console.warn('Erro ao salvar no histórico:', error.message);
                // Continuar mesmo se falhar ao salvar histórico
            }

            // Update client tracking access
            try {
                await updateClientTrackingAccess(code, orderData);
            } catch (error) {
                console.warn('Erro ao registrar acesso do cliente:', error.message);
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
                console.warn('Log opcional não registrado:', error.message);
            }
            
        } else {
            handleInvalidCode();
        }
    } catch (error) {
        console.error('Erro detalhado ao verificar código:', error);
        console.error('Código do erro:', error.code);
        console.error('Mensagem:', error.message);
        
        // Verificar diferentes tipos de erro
        if (error.code === 'permission-denied' || error.message.includes('permission')) {
            // Tentar re-autenticar
            const currentAuth = auth.currentUser;
            if (!currentAuth) {
                showToast('Sessão expirada. Faça login novamente.', 'error');
                showLoginSection();
            } else {
                showToast('Erro de permissão. Recarregue a página e tente novamente.', 'error');
                console.log('Usuário autenticado mas sem permissão:', currentAuth.email);
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
        document.getElementById('orderCode').classList.add('error');
        document.getElementById('attemptsWarning').classList.add('show');
        document.getElementById('attemptsText').textContent = 
            `Código inválido. ${remainingAttempts} tentativa(s) restante(s).`;
        
        showToast('Código não encontrado', 'error');
        
        setTimeout(() => {
            document.getElementById('orderCode').classList.remove('error');
        }, 500);
    } else {
        showToast('Limite de tentativas excedido', 'error');
        setTimeout(() => {
            clientAttempts = 0;
            document.getElementById('orderCode').value = '';
            document.getElementById('attemptsWarning').classList.remove('show');
        }, 5000);
    }
}

// ===========================
// ORDER DISPLAY
// ===========================

function showOrderDetails(orderId, orderData) {
    showOrderView();
    
    // Update order code display
    document.getElementById('displayCode').textContent = orderData.orderCode || 'N/A';
    
    // Create order card content
    const orderCard = document.getElementById('orderCard');
    
    // Lógica especial para SEDEX com status retirada (que na verdade é transporte)
    let actualStatus = orderData.status;
    if (orderData.deliveryMethod === 'sedex' && orderData.status === 'retirada') {
        actualStatus = 'transporte';
    }
    
    const statusInfo = STATUS_MESSAGES[actualStatus] || STATUS_MESSAGES['pendente'];
    
    // Criar mensagem personalizada baseada no status e método de entrega
    let customMessage = statusInfo.message;
    
    // Se o pedido está concluído, personalizar mensagem por método de entrega
    if (orderData.status === 'concluido') {
        if (orderData.deliveryMethod === 'sedex') {
            // Para SEDEX - aguardando postagem
            customMessage = 'Seu pedido foi concluído e está aguardando postagem nos Correios.';
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
        customMessage = 'Seu pedido foi postado e está em transporte pelos Correios.';
    }
    
    // Verificar se a data está indefinida
    const days = orderData.dateUndefined ? null : calculateDaysRemaining(orderData.dueDate);
    const daysText = orderData.dateUndefined ? 'Prazo a definir' : formatDaysText(days);
    const daysColor = orderData.dateUndefined ? 'var(--text-secondary)' : getDaysColor(days);
    
    // Formatar método de entrega
    const deliveryIcon = DELIVERY_ICONS[orderData.deliveryMethod] || DELIVERY_ICONS['definir'];
    const deliveryText = formatDeliveryMethod(orderData.deliveryMethod);
    
    // Informações de retirada
    let pickupSection = '';
    if (orderData.deliveryMethod === 'retirada' && orderData.pickupInfo) {
        pickupSection = `
            <div class="detail-item" style="grid-column: 1 / -1;">
                <div class="detail-label">
                    <i class="fas fa-user-check"></i>
                    Quem vai retirar
                </div>
                <div class="detail-value">
                    ${orderData.pickupInfo.name || 'Não informado'}
                    ${orderData.pickupInfo.whatsapp ? `<br><small>WhatsApp: ${orderData.pickupInfo.whatsapp}</small>` : ''}
                </div>
            </div>
        `;
    }
    
    orderCard.innerHTML = `
        <div class="order-status-header">
            <div>
                <h3>${orderData.name || 'Serviço sem nome'}</h3>
                <p style="color: var(--text-secondary); margin-top: 0.5rem;">
                    Cliente: ${orderData.client || 'Não informado'}
                </p>
            </div>
            <div class="status-badge status-${actualStatus}">
                <i class="${statusInfo.icon}"></i>
                ${statusInfo.text}
            </div>
        </div>
        
        <div class="status-message" style="
            background: var(--glass-bg);
            padding: 1rem;
            border-radius: 10px;
            margin: 1.5rem 0;
            border-left: 3px solid var(--neon-blue);
        ">
            <i class="${statusInfo.icon}" style="color: var(--neon-blue); margin-right: 0.5rem;"></i>
            ${customMessage}
        </div>

        ${orderData.images && orderData.images.length > 0 ? `
        <div class="product-photos-section">
            <div class="photos-header">
                <i class="fas fa-camera"></i>
                <h4>Fotos do Produto Finalizado</h4>
            </div>
            <div class="photos-gallery">
                ${orderData.images.map((image, index) => `
                    <div class="photo-item" onclick="openPhotoModal('${image.url}', ${index}, ${orderData.images.length})">
                        <img src="${image.url}" alt="Foto do produto ${index + 1}" loading="lazy">
                        <div class="photo-overlay">
                            <i class="fas fa-search-plus"></i>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        ` : ''}

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
                        ${daysText}
                    </small>
                </div>
            </div>
            
            <div class="detail-item">
                <div class="detail-label">
                    <i class="fas fa-cube"></i>
                    Material
                </div>
                <div class="detail-value">
                    ${orderData.material || 'Não especificado'}
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
                    <i class="${deliveryIcon}"></i>
                    Método de Entrega
                </div>
                <div class="detail-value">
                    ${deliveryText}
                </div>
            </div>
            
            ${orderData.weight ? `
            <div class="detail-item">
                <div class="detail-label">
                    <i class="fas fa-weight"></i>
                    Peso
                </div>
                <div class="detail-value">
                    ${orderData.weight}g
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
                    ${orderData.description}
                </div>
            </div>
            ` : ''}
            
            ${pickupSection}
        </div>
        
        ${orderData.deliveryMethod === 'sedex' && orderData.deliveryAddress ? `
        <div class="delivery-address-container">
            <div style="color: var(--neon-purple); margin-bottom: 0.5rem;">
                <i class="fas fa-map-marked-alt"></i>
                <strong>Endereço de Entrega:</strong>
            </div>
            <p>${orderData.deliveryAddress.fullName}<br>
            ${orderData.deliveryAddress.rua}, ${orderData.deliveryAddress.numero} ${orderData.deliveryAddress.complemento ? '- ' + orderData.deliveryAddress.complemento : ''}<br>
            ${orderData.deliveryAddress.bairro}<br>
            ${orderData.deliveryAddress.cidade} - ${orderData.deliveryAddress.estado}<br>
            CEP: ${orderData.deliveryAddress.cep}</p>
        </div>
        ` : ''}
    `;
    
    // Update timeline
    updateTimeline(orderData);
}

function updateTimeline(orderData) {
    const timeline = document.getElementById('timeline');
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
        // Para SEDEX - adicionar postado nos Correios
        if (orderData.postedAt) {
            events.push({
                date: formatDateTime(orderData.postedAt),
                text: 'Postado nos Correios',
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
        
        // Para SEDEX com status entregue
        if (orderData.status === 'entregue' && orderData.deliveredAt) {
            events.push({
                date: formatDateTime(orderData.deliveredAt),
                text: 'Entregue pelos Correios',
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
                        <a href="https://rastreamento.correios.com.br/app/index.php?objeto=${event.trackingCode}" 
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
                            <i class="fas fa-external-link-alt"></i>
                            Rastrear nos Correios
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
            console.warn('Erro ao limpar listener anterior:', e);
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
                    console.error('Erro no listener do pedido:', error);
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
        console.error('Erro ao criar listener:', error);
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
                document.getElementById('myOrdersSection').style.display = 'none';
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
            document.getElementById('myOrdersSection').style.display = 'none';
        }
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
        document.getElementById('myOrdersSection').style.display = 'none';
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
                console.warn('Erro ao limpar listener:', e);
            }
        });
        historyListeners = [];
    }
    
    if (!orderCodes || orderCodes.length === 0) {
        myOrdersSection.style.display = 'none';
        return;
    }
    
    myOrdersSection.style.display = 'block';
    
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
                                    
                                    // Atualizar o item específico no DOM
                                    const orderElement = document.querySelector(`[data-order-code="${code}"]`);
                                    if (orderElement) {
                                        const statusBadge = orderElement.querySelector('.status-badge');
                                        if (statusBadge) {
                                            statusBadge.className = `status-badge status-${updatedStatus}`;
                                            statusBadge.style.cssText = 'font-size: 0.8rem; padding: 0.25rem 0.75rem;';
                                            statusBadge.innerHTML = STATUS_MESSAGES[updatedStatus]?.text || 'Status desconhecido';
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
                                console.warn(`Listener do pedido ${code} desabilitado:`, error.message);
                                // Não propagar o erro
                            }
                        );
                    
                    historyListeners.push(listener);
                } catch (error) {
                    console.warn(`Não foi possível criar listener para ${code}:`, error.message);
                    // Continuar sem o listener - não é crítico
                }
            }
        } catch (error) {
            console.warn(`Erro ao buscar pedido ${code}:`, error.message);
        }
    }
    
    if (orders.length === 0) {
        myOrdersSection.style.display = 'none';
        return;
    }
    
    // Renderizar lista de pedidos com status correto e data-attribute para identificação
    ordersList.innerHTML = orders.map(order => `
        <div class="order-item" onclick="quickLoadOrder('${order.code}')" data-order-code="${order.code}">
            <div>
                <div class="order-item-code">${order.code}</div>
                <div class="order-item-date">${order.data.name || 'Sem nome'}</div>
            </div>
            <div class="status-badge status-${order.displayStatus}" style="font-size: 0.8rem; padding: 0.25rem 0.75rem;">
                ${STATUS_MESSAGES[order.displayStatus]?.text || 'Status desconhecido'}
            </div>
        </div>
    `).join('');
}

async function quickLoadOrder(code) {
    document.getElementById('orderCode').value = code;
    await verifyCode();
}

async function saveOrderToHistory(code) {
    if (!currentUser || !code) return;
    
    try {
        const userRef = db.collection('user_orders').doc(currentUser.uid);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            let orderCodes = userData.orderCodes || [];
            
            // Adicionar código apenas se não existir
            if (!orderCodes.includes(code)) {
                orderCodes.push(code);
                
                // Manter apenas os últimos 20 pedidos
                if (orderCodes.length > 20) {
                    orderCodes = orderCodes.slice(-20);
                }
                
                await userRef.update({
                    orderCodes: orderCodes,
                    lastOrderViewed: code,
                    lastOrderViewedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
                
                // Recarregar lista de pedidos
                await loadUserOrders();
            }
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
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            
            // Recarregar lista de pedidos
            await loadUserOrders();
        }
    } catch (error) {
        console.error('Erro ao salvar no histórico:', error);
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

function formatDeliveryMethod(method) {
    if (!method) return 'A definir';
    
    const methods = {
        'retirada': 'Retirada no Local',
        'sedex': 'SEDEX (Correios)',
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
        <span class="toast-message">${message}</span>
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
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalMessage').textContent = message;
    
    const confirmBtn = document.getElementById('modalConfirm');
    confirmBtn.onclick = () => {
        onConfirm();
        closeModal();
    };
    
    modal.classList.add('active');
}

function closeModal() {
    document.getElementById('confirmModal').classList.remove('active');
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
        photoModal.innerHTML = `
            <div class="photo-modal-overlay" onclick="closePhotoModal()"></div>
            <div class="photo-modal-content">
                <button class="photo-modal-close" onclick="closePhotoModal()">
                    <i class="fas fa-times"></i>
                </button>
                ${total > 1 ? `
                <button class="photo-nav-btn prev" onclick="navigatePhoto(-1)">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <button class="photo-nav-btn next" onclick="navigatePhoto(1)">
                    <i class="fas fa-chevron-right"></i>
                </button>
                ` : ''}
                <img id="photoModalImage" src="${photoUrl}" alt="Foto do produto">
                ${total > 1 ? `<div class="photo-counter" id="photoCounter">${index + 1} / ${total}</div>` : ''}
            </div>
        `;
        document.body.appendChild(photoModal);
    } else {
        document.getElementById('photoModalImage').src = photoUrl;
        if (total > 1) {
            document.getElementById('photoCounter').textContent = `${index + 1} / ${total}`;
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
    const images = Array.from(orderCard.querySelectorAll('.photo-item img'));

    currentPhotoIndex += direction;

    // Circular navigation
    if (currentPhotoIndex < 0) currentPhotoIndex = images.length - 1;
    if (currentPhotoIndex >= images.length) currentPhotoIndex = 0;

    const newPhotoUrl = images[currentPhotoIndex].src;
    document.getElementById('photoModalImage').src = newPhotoUrl;
    document.getElementById('photoCounter').textContent = `${currentPhotoIndex + 1} / ${images.length}`;
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
        console.warn('Log de atividade opcional:', error.message);
    }
}

// ===========================
// CLIENT ACCESS TRACKING
// ===========================
async function updateClientTrackingAccess(orderCode, orderData) {
    if (!currentUser) return;

    try {
        // Get photo URL from Google - use same logic as admin photos
        const photoURL = currentUser.photoURL ||
                         `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.displayName || currentUser.email)}&background=00D4FF&color=fff&bold=true&size=128`;

        // Check if the logged user matches the order's client email
        const isOrderClient = orderData.clientEmail &&
                              currentUser.email &&
                              orderData.clientEmail.toLowerCase() === currentUser.email.toLowerCase();

        // Try to find existing client by logged user's email
        let clientRef = null;
        let clientDoc = null;

        const emailQuery = await db.collection('clients')
            .where('email', '==', currentUser.email.toLowerCase())
            .limit(1)
            .get();

        if (!emailQuery.empty) {
            clientDoc = emailQuery.docs[0];
            clientRef = clientDoc.ref;
        }

        // If not found by email, try by googleEmail
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

        // If still not found, create new client with Google user info
        if (!clientRef) {
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
            console.log('✅ Novo cliente criado com acesso registrado:', newClientData.name);
            return;
        }

        // Update existing client
        const existingData = clientDoc.data();
        const existingOrderCodes = existingData.orderCodes || [];

        // Add order code if not already present
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

        // Update missing fields if this is the order's client
        if (isOrderClient) {
            if (!existingData.phone && orderData.clientPhone) {
                updateData.phone = orderData.clientPhone;
            }
            if (!existingData.cpf && orderData.clientCPF) {
                updateData.cpf = orderData.clientCPF.replace(/\D/g, '');
            }
        }

        // Update name if we have a better one from Google
        if (currentUser.displayName && (!existingData.name || existingData.name === existingData.email.split('@')[0])) {
            updateData.name = currentUser.displayName;
        }

        await clientRef.update(updateData);
        console.log('✅ Acesso do cliente registrado:', existingData.name || currentUser.email);

    } catch (error) {
        console.warn('Erro ao registrar acesso do cliente:', error.message);
    }
}

// ===========================
// ERROR HANDLING
// ===========================

window.addEventListener('error', (e) => {
    console.error('Erro global:', e);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Promise rejeitada:', e);
});