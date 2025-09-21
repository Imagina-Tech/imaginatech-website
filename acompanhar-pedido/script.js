// ===========================
// ARQUIVO: script.js
// MÓDULO: Acompanhar Pedido (Portal do Cliente)
// SISTEMA: ImaginaTech - Gestão de Impressão 3D
// VERSÃO: 3.0 - Enhanced com Rastreamento
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

// Global Variables
let currentUser = null;
let currentOrderCode = null;
let currentOrderId = null;
let orderListener = null;
let clientAttempts = 0;
const MAX_ATTEMPTS = 3;

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
    
    // Auth state observer
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            showCodeSection();
            loadUserOrders();
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
            
            // Log user login
            await logUserActivity('login', {
                uid: result.user.uid,
                email: result.user.email,
                name: result.user.displayName
            });
        }
    } catch (error) {
        console.error('Erro no login:', error);
        showToast('Erro ao fazer login. Tente novamente.', 'error');
    }
}

async function logout() {
    try {
        await auth.signOut();
        currentUser = null;
        currentOrderCode = null;
        currentOrderId = null;
        if (orderListener) {
            orderListener();
            orderListener = null;
        }
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
    
    // Update user info
    if (currentUser) {
        document.getElementById('userName').textContent = currentUser.displayName || 'Usuário';
        document.getElementById('userPhoto').src = currentUser.photoURL || '/assets/default-avatar.png';
    }
    
    // Reset attempts
    clientAttempts = 0;
    document.getElementById('orderCode').value = '';
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
    
    if (!currentUser) {
        showToast('Faça login primeiro', 'error');
        return;
    }
    
    if (clientAttempts >= MAX_ATTEMPTS) {
        showToast('Limite de tentativas excedido. Tente novamente mais tarde.', 'error');
        return;
    }
    
    clientAttempts++;
    
    try {
        // Search for order with this code
        const snapshot = await db.collection('services')
            .where('orderCode', '==', code)
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            currentOrderId = doc.id;
            currentOrderCode = code;
            
            // Save order to user's history
            await saveOrderToHistory(code);
            
            // Show order details
            showOrderDetails(doc.id, doc.data());
            
            // Listen for real-time updates
            startOrderListener(doc.id);
            
            showToast('Pedido encontrado!', 'success');
            
            // Log successful access
            await logUserActivity('order_viewed', {
                orderCode: code,
                orderId: doc.id
            });
            
        } else {
            handleInvalidCode();
        }
    } catch (error) {
        console.error('Erro ao verificar código:', error);
        showToast('Erro ao buscar pedido. Tente novamente.', 'error');
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
    
    const statusInfo = STATUS_MESSAGES[orderData.status] || STATUS_MESSAGES['pendente'];
    
    // Verificar se a data está indefinida
    const days = orderData.dateUndefined ? null : calculateDaysRemaining(orderData.dueDate);
    const daysText = orderData.dateUndefined ? 'Prazo a definir' : formatDaysText(days);
    const daysColor = orderData.dateUndefined ? 'var(--text-secondary)' : getDaysColor(days);
    
    // Formatar método de entrega
    const deliveryIcon = DELIVERY_ICONS[orderData.deliveryMethod] || DELIVERY_ICONS['definir'];
    const deliveryText = formatDeliveryMethod(orderData.deliveryMethod);
    
    let trackingSection = '';
    
    // Se for SEDEX e tiver código de rastreio, adicionar seção de rastreamento
    if (orderData.deliveryMethod === 'sedex' && orderData.trackingCode) {
        trackingSection = `
            <div class="tracking-section" style="
                margin-top: 1.5rem;
                padding: 1rem;
                background: rgba(0, 212, 255, 0.1);
                border: 1px solid var(--neon-blue);
                border-radius: 10px;
            ">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="color: var(--neon-blue); font-weight: 600; margin-bottom: 0.5rem;">
                            <i class="fas fa-shipping-fast"></i>
                            Rastreamento SEDEX
                        </div>
                        <div style="font-family: 'Orbitron', monospace; font-size: 1.2rem;">
                            ${orderData.trackingCode}
                        </div>
                    </div>
                    <button class="btn-tracking" onclick="trackOrder('${orderData.trackingCode}')">
                        <i class="fas fa-external-link-alt"></i>
                        Rastrear
                    </button>
                </div>
                <div id="trackingInfo" style="margin-top: 1rem;">
                    <!-- Info de rastreamento aparece aqui -->
                </div>
            </div>
        `;
        
        // Buscar informações de rastreamento automaticamente
        setTimeout(() => trackOrder(orderData.trackingCode), 500);
    }
    
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
            <div class="status-badge status-${orderData.status}">
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
            ${statusInfo.message}
        </div>
        
        ${trackingSection}
        
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
        <div style="
            margin-top: 1.5rem;
            padding: 1rem;
            background: rgba(153, 69, 255, 0.1);
            border: 1px solid var(--neon-purple);
            border-radius: 10px;
        ">
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
    
    // Add posted event (SEDEX)
    if (orderData.postedAt && orderData.deliveryMethod === 'sedex') {
        events.push({
            date: formatDateTime(orderData.postedAt),
            text: 'Postado nos Correios',
            icon: 'fas fa-shipping-fast',
            completed: true
        });
    }
    
    // Add ready event
    if (orderData.readyAt) {
        events.push({
            date: formatDateTime(orderData.readyAt),
            text: 'Pronto para retirada',
            icon: 'fas fa-box-open',
            completed: true
        });
    }
    
    // Add delivered event
    if (orderData.deliveredAt) {
        events.push({
            date: formatDateTime(orderData.deliveredAt),
            text: 'Entregue',
            icon: 'fas fa-handshake',
            completed: true
        });
    }
    
    // Add current status as last event if not delivered
    if (orderData.status !== 'entregue') {
        const statusInfo = STATUS_MESSAGES[orderData.status];
        events.push({
            date: 'Status atual',
            text: statusInfo.text,
            icon: statusInfo.icon,
            completed: false,
            current: true
        });
    }
    
    // Render timeline
    timeline.innerHTML = events.map(event => `
        <div class="timeline-item ${event.completed ? 'completed' : ''} ${event.current ? 'current' : ''}">
            <div class="timeline-date">
                ${event.current ? '<strong>Agora</strong>' : event.date}
            </div>
            <div class="timeline-content">
                <i class="${event.icon}" style="margin-right: 0.5rem;"></i>
                ${event.text}
            </div>
        </div>
    `).join('');
}

// ===========================
// TRACKING FUNCTIONS (CORREIOS)
// ===========================

async function trackOrder(trackingCode) {
    if (!trackingCode) return;
    
    const trackingInfo = document.getElementById('trackingInfo');
    if (!trackingInfo) return;
    
    trackingInfo.innerHTML = `
        <div style="text-align: center; padding: 1rem;">
            <div class="loading-spinner" style="
                width: 30px;
                height: 30px;
                border: 3px solid rgba(0, 212, 255, 0.2);
                border-top-color: var(--neon-blue);
                border-radius: 50%;
                animation: spin 1s ease-in-out infinite;
                margin: 0 auto 0.5rem;
            "></div>
            <p style="color: var(--text-secondary);">Buscando informações de rastreamento...</p>
        </div>
    `;
    
    try {
        // Usando BrasilAPI - API gratuita e confiável para rastreamento dos Correios
        const response = await fetch(`https://brasilapi.com.br/api/cep/v2/rastreio?codigo=${trackingCode}`);
        
        if (response.status === 404) {
            // Código não encontrado ainda
            trackingInfo.innerHTML = `
                <div style="
                    padding: 1rem;
                    background: rgba(255, 215, 0, 0.1);
                    border: 1px solid var(--neon-yellow);
                    border-radius: 8px;
                ">
                    <div style="color: var(--neon-yellow); margin-bottom: 0.5rem;">
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>Aguardando postagem</strong>
                    </div>
                    <p style="color: var(--text-secondary); margin: 0;">
                        O código de rastreamento ainda não foi registrado no sistema dos Correios.
                        Isso é normal se o pedido foi postado recentemente. Tente novamente em algumas horas.
                    </p>
                </div>
                <div style="margin-top: 1rem; text-align: center;">
                    <a href="https://rastreamento.correios.com.br/app/index.php?objeto=${trackingCode}" 
                       target="_blank" 
                       style="color: var(--neon-blue); text-decoration: none;">
                        <i class="fas fa-external-link-alt"></i>
                        Verificar no site dos Correios
                    </a>
                </div>
            `;
            return;
        }
        
        if (!response.ok) {
            throw new Error('Erro ao buscar rastreamento');
        }
        
        const data = await response.json();
        
        if (data.eventos && data.eventos.length > 0) {
            // Mapear status para ícones e cores
            const getEventStyle = (descricao) => {
                const desc = descricao.toLowerCase();
                if (desc.includes('postado') || desc.includes('coletado')) {
                    return { icon: 'fas fa-box', color: 'var(--neon-blue)' };
                } else if (desc.includes('encaminhado') || desc.includes('trânsito')) {
                    return { icon: 'fas fa-truck', color: 'var(--neon-yellow)' };
                } else if (desc.includes('saiu para entrega')) {
                    return { icon: 'fas fa-shipping-fast', color: 'var(--neon-orange)' };
                } else if (desc.includes('entregue')) {
                    return { icon: 'fas fa-check-circle', color: 'var(--neon-green)' };
                } else {
                    return { icon: 'fas fa-info-circle', color: 'var(--neon-blue)' };
                }
            };
            
            // Renderizar eventos de rastreamento
            const eventos = data.eventos.map((evento, index) => {
                const style = getEventStyle(evento.descricao);
                const isFirst = index === 0;
                
                return `
                    <div style="
                        padding: 1rem;
                        margin-bottom: 0.75rem;
                        background: ${isFirst ? 'rgba(0, 212, 255, 0.05)' : 'var(--glass-bg)'};
                        border-radius: 8px;
                        border-left: 3px solid ${style.color};
                        ${isFirst ? 'box-shadow: 0 2px 10px rgba(0, 212, 255, 0.2);' : ''}
                    ">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <i class="${style.icon}" style="color: ${style.color};"></i>
                                <strong style="${isFirst ? 'color: var(--neon-blue);' : ''}">${evento.descricao}</strong>
                            </div>
                            ${isFirst ? '<span style="background: var(--neon-blue); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">ÚLTIMO STATUS</span>' : ''}
                        </div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">
                            <i class="far fa-clock" style="margin-right: 0.25rem;"></i>
                            ${formatEventDate(evento.data)} às ${evento.hora || '00:00'}
                        </div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.25rem;">
                            <i class="fas fa-map-marker-alt" style="margin-right: 0.25rem;"></i>
                            ${evento.local || 'Local não informado'}
                            ${evento.cidade ? ` - ${evento.cidade}` : ''}
                            ${evento.uf ? `/${evento.uf}` : ''}
                        </div>
                        ${evento.destino ? `
                            <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.5rem; padding-left: 1rem;">
                                <i class="fas fa-route" style="margin-right: 0.25rem;"></i>
                                Destino: ${evento.destino.local} - ${evento.destino.cidade}/${evento.destino.uf}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');
            
            trackingInfo.innerHTML = `
                <div style="max-height: 400px; overflow-y: auto; padding-right: 0.5rem;">
                    ${eventos}
                </div>
                <div style="
                    margin-top: 1rem; 
                    padding-top: 1rem; 
                    border-top: 1px solid var(--glass-border);
                    text-align: center;
                ">
                    <a href="https://rastreamento.correios.com.br/app/index.php?objeto=${trackingCode}" 
                       target="_blank" 
                       style="color: var(--text-secondary); text-decoration: none; font-size: 0.9rem;">
                        <i class="fas fa-external-link-alt"></i>
                        Ver detalhes completos no site dos Correios
                    </a>
                </div>
            `;
        } else {
            // Sem eventos ainda - tentar API alternativa
            await trackOrderAlternative(trackingCode, trackingInfo);
        }
    } catch (error) {
        console.error('Erro ao buscar rastreamento:', error);
        
        // Tentar API alternativa em caso de erro
        await trackOrderAlternative(trackingCode, trackingInfo);
    }
}

// Função alternativa de rastreamento usando proxy CORS
async function trackOrderAlternative(trackingCode, trackingInfo) {
    try {
        // Usar proxy CORS para acessar a API dos Correios
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const correiosUrl = `https://proxyapp.correios.com.br/v1/sro-rastro/${trackingCode}`;
        
        // Nota: cors-anywhere pode estar desabilitado, então vamos para o fallback direto
        throw new Error('Usar fallback');
        
    } catch (error) {
        // Fallback final - mostrar informações básicas e link
        trackingInfo.innerHTML = `
            <div style="
                padding: 1rem;
                background: var(--glass-bg);
                border-radius: 8px;
                text-align: center;
            ">
                <div style="margin-bottom: 1rem;">
                    <i class="fas fa-shipping-fast" style="font-size: 2rem; color: var(--neon-blue);"></i>
                </div>
                <p style="color: var(--text-primary); margin-bottom: 0.5rem;">
                    <strong>Código de Rastreamento:</strong>
                </p>
                <p style="
                    font-family: 'Orbitron', monospace;
                    font-size: 1.5rem;
                    color: var(--neon-blue);
                    margin-bottom: 1rem;
                ">
                    ${trackingCode}
                </p>
                <p style="color: var(--text-secondary); margin-bottom: 1rem; font-size: 0.9rem;">
                    Para acompanhar seu pedido em tempo real, clique no botão abaixo:
                </p>
                <a href="https://rastreamento.correios.com.br/app/index.php?objeto=${trackingCode}" 
                   target="_blank" 
                   class="btn-tracking"
                   style="
                       display: inline-flex;
                       padding: 0.75rem 1.5rem;
                       text-decoration: none;
                   ">
                    <i class="fas fa-search"></i>
                    Rastrear nos Correios
                </a>
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--glass-border);">
                    <p style="color: var(--text-secondary); font-size: 0.85rem;">
                        <i class="fas fa-info-circle"></i>
                        Dica: O rastreamento pode demorar até 24h após a postagem para aparecer no sistema.
                    </p>
                </div>
            </div>
        `;
    }
}

// Função auxiliar para formatar data do evento
function formatEventDate(dateString) {
    if (!dateString) return 'Data não informada';
    
    // Tentar diferentes formatos de data
    let date;
    
    // Formato: DD/MM/YYYY
    if (dateString.includes('/')) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
            date = new Date(parts[2], parts[1] - 1, parts[0]);
        }
    }
    // Formato: YYYY-MM-DD
    else if (dateString.includes('-')) {
        date = new Date(dateString);
    }
    // Formato ISO
    else {
        date = new Date(dateString);
    }
    
    if (date && !isNaN(date.getTime())) {
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
    
    return dateString; // Retornar como está se não conseguir formatar
}

// ===========================
// REAL-TIME UPDATES
// ===========================

function startOrderListener(orderId) {
    if (orderListener) {
        orderListener();
    }
    
    orderListener = db.collection('services').doc(orderId)
        .onSnapshot((doc) => {
            if (doc.exists) {
                const data = doc.data();
                showOrderDetails(doc.id, data);
                
                // Show notification if status changed
                if (data.lastStatusChange && 
                    new Date(data.lastStatusChange) > new Date(Date.now() - 5000)) {
                    showToast('Status do pedido atualizado!', 'info');
                }
            } else {
                showToast('Pedido não encontrado', 'error');
                backToCode();
            }
        }, (error) => {
            console.error('Erro ao escutar mudanças:', error);
        });
}

function refreshOrder() {
    if (currentOrderId) {
        showToast('Atualizando...', 'info');
        
        // Force refresh by restarting listener
        startOrderListener(currentOrderId);
    }
}

// ===========================
// USER ORDERS HISTORY
// ===========================

async function loadUserOrders() {
    if (!currentUser) return;
    
    try {
        const clientDoc = await db.collection('clients').doc(currentUser.uid).get();
        
        if (clientDoc.exists) {
            const clientData = clientDoc.data();
            const orderCodes = clientData.orders || [];
            
            if (orderCodes.length > 0) {
                displayUserOrders(orderCodes);
            }
        }
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
    }
}

async function displayUserOrders(orderCodes) {
    const ordersList = document.getElementById('ordersList');
    const myOrdersSection = document.getElementById('myOrdersSection');
    
    if (!orderCodes || orderCodes.length === 0) {
        myOrdersSection.style.display = 'none';
        return;
    }
    
    myOrdersSection.style.display = 'block';
    
    // Get order details for each code
    const orders = [];
    for (const code of orderCodes.slice(0, 5)) { // Show max 5 recent orders
        const snapshot = await db.collection('services')
            .where('orderCode', '==', code)
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            orders.push({
                code: code,
                data: doc.data()
            });
        }
    }
    
    // Render orders list
    ordersList.innerHTML = orders.map(order => `
        <div class="order-item" onclick="quickLoadOrder('${order.code}')">
            <div>
                <div class="order-item-code">#${order.code}</div>
                <div class="order-item-date">${order.data.name || 'Sem nome'}</div>
            </div>
            <div class="status-badge status-${order.data.status}" style="font-size: 0.8rem; padding: 0.25rem 0.75rem;">
                ${STATUS_MESSAGES[order.data.status].text}
            </div>
        </div>
    `).join('');
}

async function quickLoadOrder(code) {
    document.getElementById('orderCode').value = code;
    await verifyCode();
}

async function saveOrderToHistory(code) {
    if (!currentUser) return;
    
    try {
        const clientRef = db.collection('clients').doc(currentUser.uid);
        
        await clientRef.set({
            uid: currentUser.uid,
            email: currentUser.email,
            name: currentUser.displayName,
            photoURL: currentUser.photoURL,
            orders: firebase.firestore.FieldValue.arrayUnion(code),
            lastOrderViewed: code,
            lastOrderViewedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }, { merge: true });
        
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
        console.error('Erro ao registrar atividade:', error);
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
