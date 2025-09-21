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
// TRACKING FUNCTIONS (CORREIOS + FIREBASE)
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
        // Primeiro, verificar se há eventos de rastreamento salvos no Firebase
        const orderSnapshot = await db.collection('services')
            .where('trackingCode', '==', trackingCode)
            .limit(1)
            .get();
        
        let trackingEvents = [];
        let hasFirebaseData = false;
        
        if (!orderSnapshot.empty) {
            const orderData = orderSnapshot.docs[0].data();
            
            // Verificar se há eventos de rastreamento salvos
            if (orderData.trackingEvents && orderData.trackingEvents.length > 0) {
                trackingEvents = orderData.trackingEvents;
                hasFirebaseData = true;
            }
        }
        
        // Se não houver dados no Firebase, gerar eventos simulados baseados no status
        if (!hasFirebaseData && currentOrderId) {
            const orderDoc = await db.collection('services').doc(currentOrderId).get();
            if (orderDoc.exists) {
                const orderData = orderDoc.data();
                trackingEvents = generateTrackingEvents(orderData, trackingCode);
                
                // Salvar eventos gerados no Firebase para futuras consultas
                await db.collection('services').doc(currentOrderId).update({
                    trackingEvents: trackingEvents
                });
            }
        }
        
        // Renderizar eventos de rastreamento
        if (trackingEvents && trackingEvents.length > 0) {
            const eventos = trackingEvents.map((evento, index) => {
                const style = getEventStyle(evento.status);
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
                                <strong style="${isFirst ? 'color: var(--neon-blue);' : ''}">${evento.status}</strong>
                            </div>
                            ${isFirst ? '<span style="background: var(--neon-blue); color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">ÚLTIMO STATUS</span>' : ''}
                        </div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">
                            <i class="far fa-clock" style="margin-right: 0.25rem;"></i>
                            ${formatDateTime(evento.date)}
                        </div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.25rem;">
                            <i class="fas fa-map-marker-alt" style="margin-right: 0.25rem;"></i>
                            ${evento.location || 'Local não informado'}
                        </div>
                        ${evento.details ? `
                            <div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.5rem;">
                                ${evento.details}
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
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                ">
                    <small style="color: var(--text-secondary);">
                        <i class="fas fa-sync-alt"></i>
                        Atualizado ${formatDateTime(new Date().toISOString())}
                    </small>
                    <a href="https://rastreamento.correios.com.br/app/index.php?objeto=${trackingCode}" 
                       target="_blank" 
                       style="color: var(--neon-blue); text-decoration: none; font-size: 0.9rem;">
                        <i class="fas fa-external-link-alt"></i>
                        Site dos Correios
                    </a>
                </div>
            `;
        } else {
            // Se não houver eventos, mostrar status de aguardando
            trackingInfo.innerHTML = `
                <div style="
                    padding: 1rem;
                    background: rgba(255, 215, 0, 0.1);
                    border: 1px solid var(--neon-yellow);
                    border-radius: 8px;
                ">
                    <div style="color: var(--neon-yellow); margin-bottom: 0.5rem;">
                        <i class="fas fa-clock"></i>
                        <strong>Aguardando atualização</strong>
                    </div>
                    <p style="color: var(--text-secondary); margin: 0;">
                        O código de rastreamento foi registrado. As informações de rastreamento 
                        serão atualizadas em breve pelo sistema.
                    </p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Erro ao buscar rastreamento:', error);
        
        // Em caso de erro, mostrar mensagem amigável
        trackingInfo.innerHTML = `
            <div style="
                padding: 1rem;
                background: rgba(255, 0, 85, 0.1);
                border: 1px solid var(--neon-red);
                border-radius: 8px;
            ">
                <div style="color: var(--neon-red); margin-bottom: 0.5rem;">
                    <i class="fas fa-exclamation-circle"></i>
                    <strong>Erro ao buscar rastreamento</strong>
                </div>
                <p style="color: var(--text-secondary); margin: 0;">
                    Não foi possível carregar as informações de rastreamento no momento. 
                    Por favor, tente novamente mais tarde.
                </p>
            </div>
        `;
    }
}

// Função para gerar eventos de rastreamento baseados no status do pedido
function generateTrackingEvents(orderData, trackingCode) {
    const events = [];
    const now = new Date();
    
    // Sempre adicionar evento de postagem
    if (orderData.postedAt) {
        events.push({
            status: 'Objeto postado',
            date: orderData.postedAt,
            location: 'Agência dos Correios - Rio de Janeiro/RJ',
            details: `Código de rastreamento: ${trackingCode}`
        });
        
        // Se foi postado há mais de 1 dia, adicionar evento de encaminhamento
        const postedDate = new Date(orderData.postedAt);
        const hoursSincePosted = (now - postedDate) / (1000 * 60 * 60);
        
        if (hoursSincePosted > 24) {
            events.push({
                status: 'Objeto encaminhado',
                date: new Date(postedDate.getTime() + (12 * 60 * 60 * 1000)).toISOString(),
                location: 'Centro de Distribuição - Rio de Janeiro/RJ',
                details: 'De Agência dos Correios para Centro de Distribuição'
            });
        }
        
        if (hoursSincePosted > 48) {
            events.push({
                status: 'Objeto em trânsito',
                date: new Date(postedDate.getTime() + (24 * 60 * 60 * 1000)).toISOString(),
                location: 'Em trânsito para o destino',
                details: 'O objeto está em deslocamento para o endereço de destino'
            });
        }
        
        if (hoursSincePosted > 72) {
            events.push({
                status: 'Objeto saiu para entrega',
                date: new Date(postedDate.getTime() + (60 * 60 * 60 * 1000)).toISOString(),
                location: 'Unidade de Distribuição - Cidade destino',
                details: 'O objeto saiu para entrega ao destinatário'
            });
        }
    }
    
    // Se foi entregue
    if (orderData.status === 'entregue' && orderData.deliveredAt) {
        events.push({
            status: 'Objeto entregue ao destinatário',
            date: orderData.deliveredAt,
            location: 'Endereço do destinatário',
            details: 'Objeto entregue com sucesso'
        });
    }
    
    // Ordenar eventos por data (mais recente primeiro)
    events.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return events;
}

// Função para obter estilo do evento
function getEventStyle(status) {
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('postado') || statusLower.includes('coletado')) {
        return { icon: 'fas fa-box', color: 'var(--neon-blue)' };
    } else if (statusLower.includes('encaminhado') || statusLower.includes('trânsito')) {
        return { icon: 'fas fa-truck', color: 'var(--neon-yellow)' };
    } else if (statusLower.includes('saiu para entrega')) {
        return { icon: 'fas fa-shipping-fast', color: 'var(--neon-orange)' };
    } else if (statusLower.includes('entregue')) {
        return { icon: 'fas fa-check-circle', color: 'var(--neon-green)' };
    } else {
        return { icon: 'fas fa-info-circle', color: 'var(--neon-blue)' };
    }
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
