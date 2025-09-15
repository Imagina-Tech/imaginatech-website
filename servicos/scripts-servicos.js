// ===========================
// IMAGINATECH - PAINEL ADMINISTRATIVO
// Sistema de Gerenciamento com Firebase
// Versão Corrigida com Debug Completo
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

// Verificar se Firebase está disponível
if (typeof firebase === 'undefined') {
    console.error('❌ Firebase não está definido! Aguardando carregamento...');
    // Aguardar Firebase carregar
    let waitCount = 0;
    const waitForFirebase = setInterval(() => {
        waitCount++;
        if (typeof firebase !== 'undefined') {
            console.log('✅ Firebase carregou após espera');
            clearInterval(waitForFirebase);
            initializeApp();
        } else if (waitCount > 10) {
            console.error('❌ Firebase não carregou após 10 tentativas');
            clearInterval(waitForFirebase);
            alert('Erro ao carregar Firebase. Recarregue a página.');
        }
    }, 500);
} else {
    console.log('✅ Firebase já está disponível');
    initializeApp();
}

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

// Função para inicializar o app
function initializeApp() {
    try {
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        
        console.log('✅ Firebase inicializado com sucesso');
        
        // Configurar listeners após inicialização
        setupEventListeners();
        
    } catch (error) {
        console.error('❌ Erro ao inicializar Firebase:', error);
        showToast('Erro ao conectar com o servidor. Recarregue a página.', 'error');
    }
}

// ===========================
// INITIALIZATION
// ===========================

function setupEventListeners() {
    console.log('🔧 Configurando event listeners...');
    
    // Aguardar DOM carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onDOMReady);
    } else {
        onDOMReady();
    }
}

function onDOMReady() {
    console.log('📄 DOM carregado, configurando sistema...');
    
    try {
        // Esconder loading overlay após inicialização
        setTimeout(() => {
            const loadingOverlay = document.getElementById('loadingOverlay');
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
                console.log('✅ Loading overlay escondido');
            }
        }, 1000);
        
        // Check auth state
        if (auth) {
            auth.onAuthStateChanged((user) => {
                console.log('👤 Estado de autenticação mudou:', user ? user.email : 'Não logado');
                
                if (user) {
                    currentUser = user;
                    checkAuthorization(user);
                } else {
                    currentUser = null;
                    isAuthorized = false;
                    showLoginScreen();
                }
            });
        } else {
            console.error('❌ Auth não está inicializado');
        }
        
        // Set today's date as default for new services
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
        
        // Format phone input
        const phoneInput = document.getElementById('clientPhone');
        if (phoneInput) {
            phoneInput.addEventListener('input', formatPhoneNumber);
        }
        
        // Initialize connection monitoring
        monitorConnection();
        
        console.log('✅ Sistema configurado com sucesso');
        
    } catch (error) {
        console.error('❌ Erro na configuração inicial:', error);
        showToast('Erro na inicialização do sistema', 'error');
    }
}

// ===========================
// AUTHENTICATION
// ===========================

async function signInWithGoogle() {
    console.log('🔐 Iniciando login com Google...');
    
    if (!auth) {
        console.error('❌ Auth não está inicializado');
        showToast('Sistema não está pronto. Aguarde e tente novamente.', 'error');
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
        showToast('Erro ao fazer login. Tente novamente.', 'error');
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
    }
}

// ===========================
// UI MANAGEMENT
// ===========================

function showLoginScreen() {
    console.log('📱 Mostrando tela de login');
    
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loginScreen = document.getElementById('loginScreen');
    const adminDashboard = document.getElementById('adminDashboard');
    
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    if (loginScreen) loginScreen.classList.remove('hidden');
    if (adminDashboard) adminDashboard.classList.add('hidden');
    
    if (servicesListener) {
        servicesListener();
        servicesListener = null;
    }
}

function showAdminDashboard(user) {
    console.log('📱 Mostrando dashboard admin para:', user.email);
    
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loginScreen = document.getElementById('loginScreen');
    const adminDashboard = document.getElementById('adminDashboard');
    
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
    if (loginScreen) loginScreen.classList.add('hidden');
    if (adminDashboard) adminDashboard.classList.remove('hidden');
    
    // Update user info
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
        console.error('❌ Firestore não está inicializado');
        return;
    }
    
    if (servicesListener) {
        servicesListener();
    }
    
    try {
        servicesListener = db.collection('services')
            .orderBy('createdAt', 'desc')
            .onSnapshot((snapshot) => {
                services = [];
                snapshot.forEach(doc => {
                    services.push({ 
                        id: doc.id, 
                        ...doc.data() 
                    });
                });
                
                console.log(`✅ ${services.length} serviços carregados`);
                updateStats();
                renderServices();
                
            }, (error) => {
                console.error('❌ Erro ao carregar serviços:', error);
                
                // Se for erro de permissão, tentar sem ordenação
                if (error.code === 'permission-denied') {
                    console.log('🔄 Tentando carregar sem ordenação...');
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
                            
                            console.log(`✅ ${services.length} serviços carregados (sem índice)`);
                            updateStats();
                            renderServices();
                        });
                } else {
                    showToast('Erro ao carregar serviços', 'error');
                }
            });
    } catch (error) {
        console.error('❌ Erro ao configurar listener:', error);
    }
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
    console.log('🔑 Código gerado:', code);
    return code;
}

async function saveService(event) {
    event.preventDefault();
    console.log('💾 Salvando serviço...');
    
    if (!isAuthorized) {
        showToast('Você não tem permissão para esta ação', 'error');
        return;
    }
    
    if (!db) {
        console.error('❌ Firestore não está inicializado');
        showToast('Sistema não está pronto. Recarregue a página.', 'error');
        return;
    }
    
    try {
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
        
        if (editingServiceId) {
            // Update existing service
            await db.collection('services').doc(editingServiceId).update(service);
            console.log('✅ Serviço atualizado:', editingServiceId);
            showToast('Serviço atualizado com sucesso!', 'success');
            
        } else {
            // Create new service
            service.createdAt = new Date().toISOString();
            service.createdBy = currentUser.email;
            service.orderCode = generateOrderCode();
            service.serviceId = 'SRV-' + Date.now();
            
            const docRef = await db.collection('services').add(service);
            console.log('✅ Serviço criado:', docRef.id);
            showToast(`Serviço criado! Código: ${service.orderCode}`, 'success');
            
            // Send WhatsApp if phone provided
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
        console.error('❌ Erro ao salvar serviço:', error);
        showToast('Erro ao salvar serviço: ' + error.message, 'error');
    }
}

async function updateStatus(serviceId, newStatus) {
    console.log('🔄 Atualizando status:', serviceId, '→', newStatus);
    
    if (!isAuthorized) {
        showToast('Você não tem permissão para esta ação', 'error');
        return;
    }
    
    const service = services.find(s => s.id === serviceId);
    if (!service) {
        console.error('❌ Serviço não encontrado:', serviceId);
        return;
    }
    
    pendingStatusUpdate = { serviceId, newStatus, service };
    
    // Show confirmation modal
    const statusMessages = {
        'pendente': 'Marcar como Pendente',
        'producao': 'Iniciar Produção',
        'concluido': 'Marcar como Concluído',
        'retirada': 'Pronto para Retirada',
        'entregue': 'Confirmar Entrega'
    };
    
    const statusModalMessage = document.getElementById('statusModalMessage');
    if (statusModalMessage) {
        statusModalMessage.textContent = 
            `Deseja ${statusMessages[newStatus]} para o serviço "${service.name}"?`;
    }
    
    // Show WhatsApp option if phone available
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
    console.log('✅ Confirmando mudança de status...');
    
    if (!pendingStatusUpdate || !db) return;
    
    const { serviceId, newStatus, service } = pendingStatusUpdate;
    const sendWhatsapp = document.getElementById('sendWhatsappNotification')?.checked || false;
    
    try {
        const updates = {
            status: newStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.email,
            lastStatusChange: new Date().toISOString()
        };
        
        // Add specific timestamps
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
        
        console.log('✅ Status atualizado com sucesso');
        showToast('Status atualizado com sucesso!', 'success');
        
        // Send WhatsApp notification if requested
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
        console.error('❌ Erro ao atualizar status:', error);
        showToast('Erro ao atualizar status: ' + error.message, 'error');
    }
    
    closeStatusModal();
}

async function deleteService(serviceId) {
    console.log('🗑️ Excluindo serviço:', serviceId);
    
    if (!isAuthorized) {
        showToast('Você não tem permissão para esta ação', 'error');
        return;
    }
    
    if (!db) {
        console.error('❌ Firestore não está inicializado');
        return;
    }
    
    const service = services.find(s => s.id === serviceId);
    
    if (confirm(`Tem certeza que deseja excluir o serviço "${service?.name || serviceId}"?`)) {
        try {
            await db.collection('services').doc(serviceId).delete();
            console.log('✅ Serviço excluído com sucesso');
            showToast('Serviço excluído com sucesso!', 'success');
            
        } catch (error) {
            console.error('❌ Erro ao excluir serviço:', error);
            showToast('Erro ao excluir serviço: ' + error.message, 'error');
        }
    }
}

// ===========================
// UI RENDERING
// ===========================

function renderServices() {
    console.log('🎨 Renderizando serviços...');
    
    const grid = document.getElementById('servicesGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (!grid || !emptyState) {
        console.error('❌ Elementos da UI não encontrados');
        return;
    }
    
    // Apply filters
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
    
    // Sort by priority and date
    filteredServices.sort((a, b) => {
        const priorityOrder = { alta: 3, media: 2, baixa: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return new Date(a.dueDate) - new Date(b.dueDate);
    });
    
    console.log(`📊 Mostrando ${filteredServices.length} de ${services.length} serviços`);
    
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
    console.log('📊 Atualizando estatísticas...');
    
    const stats = {
        total: services.length,
        pendente: services.filter(s => s.status === 'pendente').length,
        producao: services.filter(s => s.status === 'producao').length,
        concluido: services.filter(s => s.status === 'concluido').length,
        retirada: services.filter(s => s.status === 'retirada').length,
        entregue: services.filter(s => s.status === 'entregue').length
    };
    
    // Update DOM
    Object.keys(stats).forEach(key => {
        const element = document.getElementById(`stat-${key === 'total' ? 'total' : key === 'pendente' ? 'pending' : key === 'producao' ? 'production' : key === 'concluido' ? 'completed' : key === 'retirada' ? 'ready' : 'delivered'}`);
        if (element) {
            element.textContent = stats[key];
        }
    });
    
    console.log('📊 Estatísticas:', stats);
}

// ===========================
// MODAL MANAGEMENT
// ===========================

function openAddModal() {
    console.log('📝 Abrindo modal para novo serviço');
    
    editingServiceId = null;
    
    const modalTitle = document.getElementById('modalTitle');
    const saveButtonText = document.getElementById('saveButtonText');
    const serviceForm = document.getElementById('serviceForm');
    
    if (modalTitle) modalTitle.textContent = 'Novo Serviço';
    if (saveButtonText) saveButtonText.textContent = 'Salvar Serviço';
    if (serviceForm) serviceForm.reset();
    
    // Set defaults
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
    console.log('📝 Abrindo modal para editar:', serviceId);
    
    const service = services.find(s => s.id === serviceId);
    if (!service) {
        console.error('❌ Serviço não encontrado:', serviceId);
        return;
    }
    
    editingServiceId = serviceId;
    
    const modalTitle = document.getElementById('modalTitle');
    const saveButtonText = document.getElementById('saveButtonText');
    
    if (modalTitle) modalTitle.textContent = 'Editar Serviço';
    if (saveButtonText) saveButtonText.textContent = 'Atualizar Serviço';
    
    // Fill form with service data
    const fields = {
        'serviceName': service.name,
        'clientName': service.client,
        'clientPhone': service.clientPhone || '',
        'serviceDescription': service.description || '',
        'serviceMaterial': service.material,
        'serviceColor': service.color || '',
        'servicePriority': service.priority,
        'startDate': service.startDate,
        'dueDate': service.dueDate,
        'serviceValue': service.value || '',
        'serviceObservations': service.observations || '',
        'serviceStatus': service.status
    };
    
    Object.keys(fields).forEach(fieldId => {
        const element = document.getElementById(fieldId);
        if (element) {
            element.value = fields[fieldId];
        }
    });
    
    const modal = document.getElementById('serviceModal');
    if (modal) modal.classList.add('active');
}

function closeModal() {
    console.log('🚪 Fechando modal');
    
    const modal = document.getElementById('serviceModal');
    if (modal) modal.classList.remove('active');
    editingServiceId = null;
}

function closeStatusModal() {
    console.log('🚪 Fechando modal de status');
    
    const modal = document.getElementById('statusModal');
    if (modal) modal.classList.remove('active');
    pendingStatusUpdate = null;
}

// ===========================
// FILTERS AND SEARCH
// ===========================

function filterServices(filter) {
    console.log('🔍 Filtrando por:', filter);
    
    currentFilter = filter;
    
    // Update active button
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
        searchTerm = input.value;
        console.log('🔍 Buscando:', searchTerm);
        renderServices();
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
    console.log('📱 Enviando WhatsApp para:', phone);
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
    console.log(`🔔 Toast [${type}]:`, message);
    
    const container = document.getElementById('toastContainer');
    if (!container) {
        console.error('❌ Toast container não encontrado');
        return;
    }
    
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
    console.log('📡 Monitorando conexão...');
    
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
    
    // Monitor online/offline
    window.addEventListener('online', () => {
        console.log('✅ Conexão restaurada');
        updateConnectionStatus(true);
        showToast('Conexão restaurada', 'success');
    });
    
    window.addEventListener('offline', () => {
        console.log('❌ Sem conexão');
        updateConnectionStatus(false);
        showToast('Sem conexão com a internet', 'warning');
    });
}

// ===========================
// ERROR HANDLING GLOBAL
// ===========================

window.addEventListener('error', (e) => {
    console.error('❌ Erro global capturado:', e);
    
    // Evitar loop infinito de erros
    if (e.message && !e.message.includes('showToast')) {
        showToast('Ocorreu um erro inesperado', 'error');
    }
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('❌ Promise rejeitada:', e);
});

console.log('✅ script-servicos.js carregado completamente');
