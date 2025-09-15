// ===========================
// IMAGINATECH - PAINEL ADMINISTRATIVO
// Sistema de Gerenciamento com Firebase
// Versão Final Corrigida
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
let authInitialized = false;

// ===========================
// HIDE LOADING IMMEDIATELY
// ===========================
function hideLoadingOverlay() {
    console.log('🔄 Escondendo loading overlay...');
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        // Usar ambos os métodos para garantir
        loadingOverlay.classList.add('hidden');
        loadingOverlay.style.display = 'none';
        loadingOverlay.style.opacity = '0';
        loadingOverlay.style.pointerEvents = 'none';
        console.log('✅ Loading overlay escondido');
    }
}

// ===========================
// INITIALIZATION
// ===========================

// Timeout de segurança - remove loading após 3 segundos independentemente
setTimeout(() => {
    if (!authInitialized) {
        console.warn('⚠️ Timeout de segurança - removendo loading');
        hideLoadingOverlay();
        showLoginScreen();
    }
}, 3000);

// Inicializar Firebase
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
    
    // Verificar se auth existe antes de usar
    if (!auth) {
        console.error('❌ Auth não está disponível');
        hideLoadingOverlay();
        alert('Erro ao inicializar autenticação. Recarregue a página.');
        return;
    }
    
    // Auth state observer
    auth.onAuthStateChanged((user) => {
        console.log('👤 Estado de autenticação:', user ? user.email : 'Não logado');
        
        authInitialized = true;
        
        // SEMPRE esconder loading quando auth responder
        hideLoadingOverlay();
        
        if (user) {
            currentUser = user;
            checkAuthorization(user);
        } else {
            currentUser = null;
            isAuthorized = false;
            showLoginScreen();
        }
    }, (error) => {
        console.error('❌ Erro no auth state:', error);
        hideLoadingOverlay();
        showLoginScreen();
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
    
    if (!auth) {
        showToast('Sistema não está pronto. Recarregue a página.', 'error');
        return;
    }
    
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
        if (error.code === 'auth/popup-closed-by-user') {
            showToast('Login cancelado', 'info');
        } else {
            showToast('Erro ao fazer login. Tente novamente.', 'error');
        }
    }
}

async function signOut() {
    console.log('🔐 Fazendo logout...');
    
    try {
        if (auth) {
            await auth.signOut();
            showToast('Logout realizado com sucesso!', 'info');
        }
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
        showLoginScreen();
    }
}

// ===========================
// UI MANAGEMENT
// ===========================

function showLoginScreen() {
    console.log('📱 Mostrando tela de login');
    
    const loginScreen = document.getElementById('loginScreen');
    const adminDashboard = document.getElementById('adminDashboard');
    
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (adminDashboard) adminDashboard.classList.add('hidden');
    
    if (servicesListener) {
        servicesListener();
        servicesListener = null;
    }
}

function showAdminDashboard(user) {
    console.log('📱 Mostrando dashboard admin');
    
    const loginScreen = document.getElementById('loginScreen');
    const adminDashboard = document.getElementById('adminDashboard');
    
    if (loginScreen) loginScreen.classList.add('hidden');
    if (adminDashboard) adminDashboard.classList.remove('hidden');
    
    // Atualizar info do usuário
    const userName = document.getElementById('userName');
    const userPhoto = document.getElementById('userPhoto');
    
    if (userName) userName.textContent = user.displayName || user.email;
    if (userPhoto) userPhoto.src = user.photoURL || '/assets/default-avatar.png';
}

// ===========================
// FIREBASE LISTENERS
// ===========================

function startServicesListener() {
    console.log('🔄 Iniciando listener de serviços...');
    
    if (!db) {
        console.error('❌ Firestore não está disponível');
        return;
    }
    
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
            
            // Ordenar manualmente
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
            if (error.code === 'permission-denied') {
                showToast('Sem permissão para acessar serviços', 'error');
            } else {
                showToast('Erro ao carregar serviços', 'error');
            }
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
    
    if (!db || !currentUser) {
        showToast('Sistema não está pronto. Tente novamente.', 'error');
        return;
    }
    
    const service = {
        name: document.getElementById('serviceName').value.trim(),
        client: document.getElementById('clientName').value.trim(),
        clientPhone: document.getElementById('clientPhone').value.trim() || null,
        description: document.getElementById('serviceDescription').value.trim() || null,
        material: document.getElementById('serviceMaterial').value,
        color: document.getElementById('serviceColor').value || null,
        priority: document.getElementById('servicePriority').value,
        startDate: document.getElementById('startDate').value,
        dueDate: document.getElementById('dueDate').value,
        value: parseFloat(document.getElementById('serviceValue').value) || null,
        observations: document.getElementById('serviceObservations').value.trim() || null,
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
            
            await db.collection('services').add(service);
            showToast(`Serviço criado! Código: ${service.orderCode}`, 'success');
            
            if (service.clientPhone) {
                const message = `Olá ${service.client}! Seu pedido foi registrado com sucesso.\n\n` +
                    `📦 Serviço: ${service.name}\n` +
                    `🔖 Código: ${service.orderCode}\n` +
                    `📅 Prazo: ${formatDate(service.dueDate)}\n\n` +
                    `Acompanhe seu pedido em:\nhttps://imaginatech.com.br/acompanhar-pedido`;
                sendWhatsAppMessage(service.clientPhone, message);
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
    
    // Se o status já é o mesmo, não fazer nada
    if (service.status === newStatus) return;
    
    pendingStatusUpdate = { serviceId, newStatus, service };
    
    const statusMessages = {
        'pendente': 'Marcar como Pendente',
        'producao': 'Iniciar Produção',
        'concluido': 'Marcar como Concluído',
        'retirada': 'Pronto para Retirada',
        'entregue': 'Confirmar Entrega'
    };
    
    const modalMessage = document.getElementById('statusModalMessage');
    if (modalMessage) {
        modalMessage.textContent = 
            `Deseja ${statusMessages[newStatus]} para o serviço "${service.name}"?`;
    }
    
    const whatsappOption = document.getElementById('whatsappOption');
    if (whatsappOption) {
        if (service.clientPhone && (newStatus === 'producao' || newStatus === 'retirada' || newStatus === 'entregue')) {
            whatsappOption.style.display = 'block';
            const checkbox = document.getElementById('sendWhatsappNotification');
            if (checkbox) checkbox.checked = true;
        } else {
            whatsappOption.style.display = 'none';
        }
    }
    
    const statusModal = document.getElementById('statusModal');
    if (statusModal) {
        statusModal.classList.add('active');
    }
}

async function confirmStatusChange() {
    if (!pendingStatusUpdate || !db) return;
    
    const { serviceId, newStatus, service } = pendingStatusUpdate;
    const checkbox = document.getElementById('sendWhatsappNotification');
    const sendWhatsapp = checkbox ? checkbox.checked : false;
    
    try {
        const updates = {
            status: newStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.email,
            lastStatusChange: new Date().toISOString()
        };
        
        // Adicionar timestamps específicos
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
    if (!service) return;
    
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
    
    if (!grid || !emptyState) return;
    
    let filteredServices = services;
    
    if (currentFilter !== 'todos') {
        filteredServices = filteredServices.filter(s => s.status === currentFilter);
    }
    
    if (searchTerm) {
        const search = searchTerm.toLowerCase();
        filteredServices = filteredServices.filter(s => 
            (s.name && s.name.toLowerCase().includes(search)) ||
            (s.client && s.client.toLowerCase().includes(search)) ||
            (s.orderCode && s.orderCode.toLowerCase().includes(search))
        );
    }
    
    // Ordenar por prioridade e data
    filteredServices.sort((a, b) => {
        const priorityOrder = { alta: 3, media: 2, baixa: 1 };
        const aPriority = priorityOrder[a.priority] || 0;
        const bPriority = priorityOrder[b.priority] || 0;
        
        if (aPriority !== bPriority) {
            return bPriority - aPriority;
        }
        return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
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
            
            // Escapar valores para evitar problemas de HTML
            const safeName = escapeHtml(service.name || 'Sem nome');
            const safeClient = escapeHtml(service.client || 'Cliente não informado');
            const safeDescription = escapeHtml(service.description || '');
            
            return `
                <div class="service-card priority-${service.priority || 'media'}">
                    <div class="service-header">
                        <div class="service-title">
                            <h3>${safeName}</h3>
                            <span class="service-code">#${service.orderCode || 'N/A'}</span>
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
                            <span>${safeClient}</span>
                        </div>
                        ${service.clientPhone ? `
                        <div class="info-item">
                            <i class="fas fa-phone"></i>
                            <span>${escapeHtml(service.clientPhone)}</span>
                        </div>
                        ` : ''}
                        <div class="info-item">
                            <i class="fas fa-layer-group"></i>
                            <span>${service.material || 'N/A'}</span>
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
                    
                    ${safeDescription ? `
                    <div class="service-description">
                        <p>${safeDescription}</p>
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
                        <button class="btn-whatsapp" onclick="contactClient('${escapeHtml(service.clientPhone)}', '${safeName}', '${service.orderCode || 'N/A'}')">
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
    
    const elements = {
        'stat-total': stats.total,
        'stat-pending': stats.pendente,
        'stat-production': stats.producao,
        'stat-completed': stats.concluido,
        'stat-ready': stats.retirada,
        'stat-delivered': stats.entregue
    };
    
    for (const [id, value] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
}

// ===========================
// MODAL MANAGEMENT
// ===========================

function openAddModal() {
    editingServiceId = null;
    
    const modalTitle = document.getElementById('modalTitle');
    const saveButtonText = document.getElementById('saveButtonText');
    const serviceForm = document.getElementById('serviceForm');
    
    if (modalTitle) modalTitle.textContent = 'Novo Serviço';
    if (saveButtonText) saveButtonText.textContent = 'Salvar Serviço';
    if (serviceForm) serviceForm.reset();
    
    const today = new Date().toISOString().split('T')[0];
    const startDate = document.getElementById('startDate');
    const dueDate = document.getElementById('dueDate');
    const priority = document.getElementById('servicePriority');
    const status = document.getElementById('serviceStatus');
    
    if (startDate) startDate.value = today;
    if (dueDate) dueDate.value = today;
    if (priority) priority.value = 'media';
    if (status) status.value = 'pendente';
    
    const modal = document.getElementById('serviceModal');
    if (modal) modal.classList.add('active');
}

function openEditModal(serviceId) {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    editingServiceId = serviceId;
    
    const modalTitle = document.getElementById('modalTitle');
    const saveButtonText = document.getElementById('saveButtonText');
    
    if (modalTitle) modalTitle.textContent = 'Editar Serviço';
    if (saveButtonText) saveButtonText.textContent = 'Atualizar Serviço';
    
    // Preencher campos com segurança
    const fields = {
        'serviceName': service.name || '',
        'clientName': service.client || '',
        'clientPhone': service.clientPhone || '',
        'serviceDescription': service.description || '',
        'serviceMaterial': service.material || '',
        'serviceColor': service.color || '',
        'servicePriority': service.priority || 'media',
        'startDate': service.startDate || '',
        'dueDate': service.dueDate || '',
        'serviceValue': service.value || '',
        'serviceObservations': service.observations || '',
        'serviceStatus': service.status || 'pendente'
    };
    
    for (const [id, value] of Object.entries(fields)) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value;
        }
    }
    
    const modal = document.getElementById('serviceModal');
    if (modal) modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('serviceModal');
    if (modal) modal.classList.remove('active');
    editingServiceId = null;
}

function closeStatusModal() {
    const modal = document.getElementById('statusModal');
    if (modal) modal.classList.remove('active');
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
    
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    renderServices();
}

function searchServices() {
    const input = document.getElementById('searchInput');
    if (input) {
        searchTerm = input.value.trim();
        renderServices();
    }
}

// ===========================
// UTILITY FUNCTIONS
// ===========================

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text ? text.replace(/[&<>"']/g, m => map[m]) : '';
}

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
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    } catch {
        return dateString;
    }
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
    if (!value || isNaN(value)) return '0,00';
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
        <i class="${icons[type] || icons.info}"></i>
        <span>${escapeHtml(message)}</span>
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
    
    // Verificar status inicial
    updateConnectionStatus(navigator.onLine);
}

// ===========================
// ERROR HANDLING
// ===========================

window.addEventListener('error', (e) => {
    console.error('Erro:', e);
    // Evitar loop de erros
    if (e.message && !e.message.includes('showToast') && !e.message.includes('toast')) {
        console.error('Erro capturado:', e.message);
    }
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Promise rejeitada:', e.reason);
});

console.log('✅ Sistema carregado completamente');
