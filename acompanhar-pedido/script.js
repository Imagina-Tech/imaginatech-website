// ===========================
// ARQUIVO: script.js
// MÓDULO: Acompanhar Pedido (Portal do Cliente)
// SISTEMA: ImaginaTech - Gestão de Impressão 3D
// VERSÃO: 4.0 - Simplificado sem API de Rastreamento
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
    
    // Se for SEDEX e tiver código de rastreio, mostrar código com botão para Correios
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
                            Código de Rastreamento SEDEX
                        </div>
                        <div style="font-family: 'Orbitron', monospace; font-size: 1.2rem;">
                            ${orderData.trackingCode}
                        </div>
                    </div>
                    <a href="https://rastreamento.correios.com.br/app/index.php?objeto=${orderData.trackingCode}" 
                       target="_blank"
                       class="btn-tracking"
                       style="
                           text-decoration: none;
                           display: inline-flex;
                           align-items: center;
                           gap: 0.5rem;
                       ">
                        <i class="fas fa-external-link-alt"></i>
                        Rastrear nos Correios
                    </a>
                </div>
            </div>
        `;
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
