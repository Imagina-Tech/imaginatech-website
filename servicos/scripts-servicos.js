// ===========================
// IMAGINATECH - PAINEL ADMINISTRATIVO
// Sistema de Gerenciamento com Firebase
// Versão com Correção do Loading
// ===========================

console.log('🚀 Iniciando script-servicos.js...');

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDZxuazTrmimr0951TmTCKckI4Ede2hdn4",
    authDomain: "imaginatech-servicos.firebaseapp.com",
    projectId: "imaginatech-servicos",
    storageBucket: "imaginatech-servicos.firebasestorage.app",
    messagingSenderId: "321455309872",
    appId: "1:321455309872:web:e7ba49a0f020bbae1159f5"
};

// Authorized Admin Emails
const AUTHORIZED_EMAILS = [
    "3d3printers@gmail.com",
    "igor.butter@gmail.com"
];

// Variáveis globais
let db = null;
let auth = null;
let services = [];
let currentFilter = 'todos';
let searchTerm = '';
let editingServiceId = null;
let currentUser = null;
let isAuthorized = false;
let servicesListener = null;
let pendingStatusUpdate = null;

// ===========================
// HIDE LOADING IMMEDIATELY
// ===========================
function hideLoadingOverlay() {
    console.log('🔄 Escondendo loading overlay...');
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
        console.log('✅ Loading overlay escondido');
    } else {
        console.error('❌ Loading overlay não encontrado');
    }
}

// ===========================
// INITIALIZATION
// ===========================

// Inicializar Firebase imediatamente
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    console.log('✅ Firebase inicializado com sucesso');
} catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error);
    hideLoadingOverlay();
    alert('Erro ao conectar com o servidor. Recarregue a página.');
}

// Configurar listeners quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMReady);
} else {
    onDOMReady();
}

function onDOMReady() {
    console.log('📄 DOM carregado, configurando sistema...');
    
    // IMPORTANTE: Esconder loading IMEDIATAMENTE após auth check
    auth.onAuthStateChanged((user) => {
        console.log('👤 Estado de autenticação:', user ? user.email : 'Não logado');
        
        // Esconder loading assim que soubermos o estado do auth
        hideLoadingOverlay();
        
        if (user) {
            currentUser = user;
            checkAuthorization(user);
        } else {
            currentUser = null;
            isAuthorized = false;
            showLoginScreen();
        }
    });
    
    // Configurar campos de data
    const today = new Date().toISOString().split('T')[0];
    const startDateInput = document.getElementById('startDate');
    const dueDateInput = document.getElementById('dueDate');
    
    if (startDateInput) {
        startDateInput.value = today;
        startDateInput.addEventListener('change', () => {
            if (dueDateInput && dueDateInput.value < startDateInput.value) {
                dueDateInput.value = startDateInput.value;
            }
        });
    }
    
    // Formatação de telefone
    const phoneInput = document.getElementById('clientPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', formatPhoneNumber);
    }
    
    // Monitorar conexão
    monitorConnection();
}

// ===========================
// AUTHENTICATION
// ===========================

async function signInWithGoogle() {
    console.log('🔐 Iniciando login com Google...');
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        console.log('✅ Login realizado:', user.email);
        
        if (!AUTHORIZED_EMAILS.includes(user.email)) {
            console.warn('⚠️ Email não autorizado:', user.email);
            await auth.signOut();
            showToast(`Acesso negado! O email ${user.email} não está autorizado.`, 'error');
            return;
        }
        
        currentUser = user;
        isAuthorized = true;
        showToast(`Bem-vindo, ${user.displayName}!`, 'success');
        
    } catch (error) {
        console.error('❌ Erro no login:', error);
        showToast('Erro ao fazer login. Tente novamente.', 'error');
    }
}

async function signOut() {
    console.log('🔐 Fazendo logout...');
    
    try {
        await auth.signOut();
        showToast('Logout realizado com sucesso!', 'info');
    } catch (error) {
        console.error('❌ Erro no logout:', error);
        showToast('Erro ao fazer logout.', 'error');
    }
}

function checkAuthorization(user) {
    console.log('🔍 Verificando autorização para:', user.email);
    
    if (AUTHORIZED_EMAILS.includes(user.email)) {
        isAuthorized = true;
        console.log('✅ Usuário autorizado');
        showAdminDashboard(user);
        startServicesListener();
    } else {
        isAuthorized = false;
        console.warn('⚠️ Usuário não autorizado');
        auth.signOut();
        showToast('Acesso negado! Email não autorizado.', 'error');
    }
}

// ===========================
// UI MANAGEMENT
// ===========================

function showLoginScreen() {
    console.log('📱 Mostrando tela de login');
    
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('adminDashboard').classList.add('hidden');
    
    if (servicesListener) {
        servicesListener();
        servicesListener = null;
    }
}

function showAdminDashboard(user) {
    console.log('📱 Mostrando dashboard admin');
    
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminDashboard').classList.remove('hidden');
    
    // Atualizar info do usuário
    document.getElementById('userName').textContent = user.displayName || user.email;
    document.getElementById('userPhoto').src = user.photoURL || '/assets/default-avatar.png';
}

// ===========================
// FIREBASE LISTENERS
// ===========================

function startServicesListener() {
    console.log('🔄 Iniciando listener de serviços...');
    
    if (servicesListener) {
        servicesListener();
    }
    
    servicesListener = db.collection('services')
        .onSnapshot((snapshot) => {
            services = [];
            snapshot.forEach(doc => {
                services.push({ 
                    id: doc.id, 
                    ...doc.data() 
                });
            });
            
            // Ordenar manualmente se não houver índice
            services.sort((a, b) => {
                const dateA = new Date(a.createdAt || 0);
                const dateB = new Date(b.createdAt || 0);
                return dateB - dateA;
            });
            
            console.log(`✅ ${services.length} serviços carregados`);
            updateStats();
            renderServices();
            
        }, (error) => {
            console.error('❌ Erro ao carregar serviços:', error);
            showToast('Erro ao carregar serviços', 'error');
        });
}

// ===========================
// SERVICE MANAGEMENT
// ===========================

function generateOrderCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function saveService(event) {
    event.preventDefault();
    
    if (!isAuthorized) {
        showToast('Você não tem permissão para esta ação', 'error');
        return;
    }
    
    const service = {
        name: document.getElementById('serviceName').value,
        client: document.getElementById('clientName').value,
        clientPhone: document.getElementById('clientPhone').value || null,
        description: document.getElementById('serviceDescription').value || null,
        material: document.getElementById('serviceMaterial').value,
        color: document.getElementById('serviceColor').value || null,
        priority: document.getElementById('servicePriority').value,
        startDate: document.getElementById('startDate').value,
        dueDate: document.getElementById('dueDate').value,
        value: parseFloat(document.getElementById('serviceValue').value) || null,
        observations: document.getElementById('serviceObservations').value || null,
        status: document.getElementById('serviceStatus').value,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.email
    };
    
    try {
        if (editingServiceId) {
            await db.collection('services').doc(editingServiceId).update(service);
            showToast('Serviço atualizado com sucesso!', 'success');
        } else {
            service.createdAt = new Date().toISOString();
            service.createdBy = currentUser.email;
            service.orderCode = generateOrderCode();
            service.serviceId = 'SRV-' + Date.now();
            
            const docRef = await db.collection('services').add(service);
            showToast(`Serviço criado! Código: ${service.orderCode}`, 'success');
            
            if (service.clientPhone) {
                sendWhatsAppMessage(service.clientPhone, 
                    `Olá ${service.client}! Seu pedido foi registrado com sucesso.\n\n` +
                    `📦 Serviço: ${service.name}\n` +
                    `🔖 Código: ${service.orderCode}\n` +
                    `📅 Prazo: ${formatDate(service.dueDate)}\n\n` +
                    `Acompanhe seu pedido em:\nhttps://imaginatech.com.br/acompanhar-pedido`
                );
            }
        }
        
        closeModal();
        
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showToast('Erro ao salvar serviço', 'error');
    }
}

async function updateStatus(serviceId, newStatus) {
    if (!isAuthorized) {
        showToast('Você não tem permissão para esta ação', 'error');
        return;
    }
    
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    pendingStatusUpdate = { serviceId, newStatus, service };
    
    const statusMessages = {
        'pendente': 'Marcar como Pendente',
        'producao': 'Iniciar Produção',
        'concluido': 'Marcar como Concluído',
        'retirada': 'Pronto para Retirada',
        'entregue': 'Confirmar Entrega'
    };
    
    document.getElementById('statusModalMessage').textContent = 
        `Deseja ${statusMessages[newStatus]} para o serviço "${service.name}"?`;
    
    const whatsappOption = document.getElementById('whatsappOption');
    if (service.clientPhone && (newStatus === 'producao' || newStatus === 'retirada' || newStatus === 'entregue')) {
        whatsappOption.style.display = 'block';
        document.getElementById('sendWhatsappNotification').checked = true;
    } else {
        whatsappOption.style.display = 'none';
    }
    
    document.getElementById('statusModal').classList.add('active');
}

async function confirmStatusChange() {
    if (!pendingStatusUpdate) return;
    
    const { serviceId, newStatus, service } = pendingStatusUpdate;
    const sendWhatsapp = document.getElementById('sendWhatsappNotification').checked;
    
    try {
        const updates = {
            status: newStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.email,
            lastStatusChange: new Date().toISOString()
        };
        
        if (newStatus === 'producao') {
            updates.productionStartedAt = new Date().toISOString();
        } else if (newStatus === 'concluido') {
            updates.completedAt = new Date().toISOString();
        } else if (newStatus === 'retirada') {
            updates.readyAt = new Date().toISOString();
        } else if (newStatus === 'entregue') {
            updates.deliveredAt = new Date().toISOString();
        }
        
        await db.collection('services').doc(serviceId).update(updates);
        showToast('Status atualizado com sucesso!', 'success');
        
        if (sendWhatsapp && service.clientPhone) {
            const messages = {
                'producao': `✅ Ótima notícia! Iniciamos a produção do seu pedido:\n\n📦 ${service.name}\n🔖 Código: ${service.orderCode}\n\nAcompanhe: https://imaginatech.com.br/acompanhar-pedido`,
                'retirada': `🎉 Seu pedido está PRONTO para retirada!\n\n📦 ${service.name}\n🔖 Código: ${service.orderCode}\n\nVenha buscar seu pedido!`,
                'entregue': `✅ Pedido entregue com sucesso!\n\n📦 ${service.name}\n🔖 Código: ${service.orderCode}\n\nObrigado pela preferência! 😊`
            };
            
            if (messages[newStatus]) {
                sendWhatsAppMessage(service.clientPhone, messages[newStatus]);
            }
        }
        
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        showToast('Erro ao atualizar status', 'error');
    }
    
    closeStatusModal();
}

async function deleteService(serviceId) {
    if (!isAuthorized) {
        showToast('Você não tem permissão para esta ação', 'error');
        return;
    }
    
    const service = services.find(s => s.id === serviceId);
    
    if (confirm(`Tem certeza que deseja excluir o serviço "${service.name}"?`)) {
        try {
            await db.collection('services').doc(serviceId).delete();
            showToast('Serviço excluído com sucesso!', 'success');
        } catch (error) {
            console.error('Erro ao excluir:', error);
            showToast('Erro ao excluir serviço', 'error');
        }
    }
}

// ===========================
// UI RENDERING
// ===========================

function renderServices() {
    const grid = document.getElementById('servicesGrid');
    const emptyState = document.getElementById('emptyState');
    
    let filteredServices = services;
    
    if (currentFilter !== 'todos') {
        filteredServices = filteredServices.filter(s => s.status === currentFilter);
    }
    
    if (searchTerm) {
        filteredServices = filteredServices.filter(s => 
            s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.client?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.orderCode?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }
    
    filteredServices.sort((a, b) => {
        const priorityOrder = { alta: 3, media: 2, baixa: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return new Date(a.dueDate) - new Date(b.dueDate);
    });
    
    if (filteredServices.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
    } else {
        grid.style.display = 'grid';
        emptyState.style.display = 'none';
        
        grid.innerHTML = filteredServices.map(service => {
            const days = calculateDaysRemaining(service.dueDate);
            const daysText = formatDaysText(days);
            const daysColor = getDaysColor(days);
            
            return `
                <div class="service-card priority-${service.priority}">
                    <div class="service-header">
                        <div class="service-title">
                            <h3>${service.name}</h3>
                            <span class="service-code">#${service.orderCode}</span>
                        </div>
                        <div class="service-actions">
                            <button class="btn-icon" onclick="openEditModal('${service.id}')" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon btn-delete" onclick="deleteService('${service.id}')" title="Excluir">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="service-info">
                        <div class="info-item">
                            <i class="fas fa-user"></i>
                            <span>${service.client}</span>
                        </div>
                        ${service.clientPhone ? `
                        <div class="info-item">
                            <i class="fas fa-phone"></i>
                            <span>${service.clientPhone}</span>
                        </div>
                        ` : ''}
                        <div class="info-item">
                            <i class="fas fa-layer-group"></i>
                            <span>${service.material}</span>
                        </div>
                        ${service.color ? `
                        <div class="info-item">
                            <i class="fas fa-palette"></i>
                            <span>${formatColorName(service.color)}</span>
                        </div>
                        ` : ''}
                        <div class="info-item">
                            <i class="fas fa-calendar"></i>
                            <span>${formatDate(service.startDate)}</span>
                        </div>
                        <div class="info-item" style="color: ${daysColor}">
                            <i class="fas fa-clock"></i>
                            <span>${daysText}</span>
                        </div>
                        ${service.value ? `
                        <div class="info-item">
                            <i class="fas fa-dollar-sign"></i>
                            <span>R$ ${formatMoney(service.value)}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    ${service.description ? `
                    <div class="service-description">
                        <p>${service.description}</p>
                    </div>
                    ` : ''}
                    
                    <div class="service-status">
                        <div class="status-buttons">
                            <button class="status-btn ${service.status === 'pendente' ? 'active' : ''}" 
                                    onclick="updateStatus('${service.id}', 'pendente')"
                                    ${service.status === 'pendente' ? 'disabled' : ''}>
                                <i class="fas fa-clock"></i>
                                Pendente
                            </button>
                            <button class="status-btn ${service.status === 'producao' ? 'active' : ''}" 
                                    onclick="updateStatus('${service.id}', 'producao')"
                                    ${service.status === 'producao' ? 'disabled' : ''}>
                                <i class="fas fa-cogs"></i>
                                Produção
                            </button>
                            <button class="status-btn ${service.status === 'concluido' ? 'active' : ''}" 
                                    onclick="updateStatus('${service.id}', 'concluido')"
                                    ${service.status === 'concluido' ? 'disabled' : ''}>
                                <i class="fas fa-check"></i>
                                Concluído
                            </button>
                            <button class="status-btn ${service.status === 'retirada' ? 'active' : ''}" 
                                    onclick="updateStatus('${service.id}', 'retirada')"
                                    ${service.status === 'retirada' ? 'disabled' : ''}>
                                <i class="fas fa-box-open"></i>
                                Retirada
                            </button>
                            <button class="status-btn ${service.status === 'entregue' ? 'active' : ''}" 
                                    onclick="updateStatus('${service.id}', 'entregue')"
                                    ${service.status === 'entregue' ? 'disabled' : ''}>
                                <i class="fas fa-handshake"></i>
                                Entregue
                            </button>
                        </div>
                    </div>
                    
                    ${service.clientPhone ? `
                    <div class="service-footer">
                        <button class="btn-whatsapp" onclick="contactClient('${service.clientPhone}', '${service.client}', '${service.orderCode}')">
                            <i class="fab fa-whatsapp"></i>
                            Contatar Cliente
                        </button>
                    </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }
}

function updateStats() {
    const stats = {
        total: services.length,
        pendente: services.filter(s => s.status === 'pendente').length,
        producao: services.filter(s => s.status === 'producao').length,
        concluido: services.filter(s => s.status === 'concluido').length,
        retirada: services.filter(s => s.status === 'retirada').length,
        entregue: services.filter(s => s.status === 'entregue').length
    };
    
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-pending').textContent = stats.pendente;
    document.getElementById('stat-production').textContent = stats.producao;
    document.getElementById('stat-completed').textContent = stats.concluido;
    document.getElementById('stat-ready').textContent = stats.retirada;
    document.getElementById('stat-delivered').textContent = stats.entregue;
}

// ===========================
// MODAL MANAGEMENT
// ===========================

function openAddModal() {
    editingServiceId = null;
    document.getElementById('modalTitle').textContent = 'Novo Serviço';
    document.getElementById('saveButtonText').textContent = 'Salvar Serviço';
    document.getElementById('serviceForm').reset();
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('startDate').value = today;
    document.getElementById('dueDate').value = today;
    document.getElementById('servicePriority').value = 'media';
    document.getElementById('serviceStatus').value = 'pendente';
    
    document.getElementById('serviceModal').classList.add('active');
}

function openEditModal(serviceId) {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    editingServiceId = serviceId;
    document.getElementById('modalTitle').textContent = 'Editar Serviço';
    document.getElementById('saveButtonText').textContent = 'Atualizar Serviço';
    
    document.getElementById('serviceName').value = service.name;
    document.getElementById('clientName').value = service.client;
    document.getElementById('clientPhone').value = service.clientPhone || '';
    document.getElementById('serviceDescription').value = service.description || '';
    document.getElementById('serviceMaterial').value = service.material;
    document.getElementById('serviceColor').value = service.color || '';
    document.getElementById('servicePriority').value = service.priority;
    document.getElementById('startDate').value = service.startDate;
    document.getElementById('dueDate').value = service.dueDate;
    document.getElementById('serviceValue').value = service.value || '';
    document.getElementById('serviceObservations').value = service.observations || '';
    document.getElementById('serviceStatus').value = service.status;
    
    document.getElementById('serviceModal').classList.add('active');
}

function closeModal() {
    document.getElementById('serviceModal').classList.remove('active');
    editingServiceId = null;
}

function closeStatusModal() {
    document.getElementById('statusModal').classList.remove('active');
    pendingStatusUpdate = null;
}

// ===========================
// FILTERS AND SEARCH
// ===========================

function filterServices(filter) {
    currentFilter = filter;
    
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    renderServices();
}

function searchServices() {
    searchTerm = document.getElementById('searchInput').value;
    renderServices();
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
    if (days === null) return 'Sem prazo';
    if (days === 0) return 'Entrega hoje';
    if (days === 1) return 'Entrega amanhã';
    if (days < 0) return `${Math.abs(days)} dias atrás`;
    return `${days} dias`;
}

function getDaysColor(days) {
    if (days === null) return 'var(--text-secondary)';
    if (days < 0) return 'var(--neon-red)';
    if (days === 0) return 'var(--neon-orange)';
    if (days <= 2) return 'var(--neon-yellow)';
    return 'var(--text-secondary)';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function formatColorName(color) {
    const colors = {
        'preto': 'Preto',
        'branco': 'Branco',
        'vermelho': 'Vermelho',
        'azul': 'Azul',
        'verde': 'Verde',
        'amarelo': 'Amarelo',
        'laranja': 'Laranja',
        'roxo': 'Roxo',
        'outros': 'Outras'
    };
    return colors[color] || color;
}

function formatMoney(value) {
    if (!value) return '0,00';
    return value.toFixed(2).replace('.', ',');
}

function formatPhoneNumber(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 6) {
        value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    } else if (value.length > 2) {
        value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    } else if (value.length > 0) {
        value = `(${value}`;
    }
    
    e.target.value = value;
}

// ===========================
// WHATSAPP INTEGRATION
// ===========================

function sendWhatsAppMessage(phone, message) {
    const cleanPhone = phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

function contactClient(phone, clientName, orderCode) {
    const message = `Olá ${clientName}! \n\nEstamos entrando em contato sobre seu pedido #${orderCode}.\n\nComo podemos ajudar?`;
    sendWhatsAppMessage(phone, message);
}

// ===========================
// TOAST NOTIFICATIONS
// ===========================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle',
        warning: 'fas fa-exclamation-triangle'
    };
    
    toast.innerHTML = `
        <i class="${icons[type]}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// ===========================
// CONNECTION MONITORING
// ===========================

function monitorConnection() {
    const updateConnectionStatus = (connected) => {
        const statusEl = document.getElementById('connectionStatus');
        const statusText = document.getElementById('statusText');
        
        if (statusEl && statusText) {
            if (connected) {
                statusEl.classList.remove('offline');
                statusText.textContent = 'Conectado';
            } else {
                statusEl.classList.add('offline');
                statusText.textContent = 'Offline';
            }
        }
    };
    
    window.addEventListener('online', () => {
        updateConnectionStatus(true);
        showToast('Conexão restaurada', 'success');
    });
    
    window.addEventListener('offline', () => {
        updateConnectionStatus(false);
        showToast('Sem conexão com a internet', 'warning');
    });
}

// ===========================
// ERROR HANDLING
// ===========================

window.addEventListener('error', (e) => {
    console.error('Erro:', e);
    if (e.message && !e.message.includes('showToast')) {
        showToast('Ocorreu um erro inesperado', 'error');
    }
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Promise rejeitada:', e);
});

console.log('✅ Sistema carregado completamente');
