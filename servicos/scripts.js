// ===========================
// IMAGINATECH - PAINEL DE SERVIÇOS
// Sistema de Gerenciamento com Firebase
// Versão Corrigida - Modais Customizados para Confirmações
// ===========================

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDZxuazTrmimr0951TmTCKckI4Ede2hdn4",
    authDomain: "imaginatech-servicos.firebaseapp.com",
    projectId: "imaginatech-servicos",
    storageBucket: "imaginatech-servicos.firebasestorage.app",
    messagingSenderId: "321455309872",
    appId: "1:321455309872:web:e7ba49a0f020bbae1159f5"
};

// Authorized Emails for Production
const AUTHORIZED_EMAILS = [
    "3d3printers@gmail.com",
    "igor.butter@gmail.com"
];

// Color Options Configuration
const COLOR_OPTIONS = [
    { value: 'preto', label: 'Preto' },
    { value: 'branco', label: 'Branco' },
    { value: 'vermelho', label: 'Vermelho' },
    { value: 'azul', label: 'Azul' },
    { value: 'verde', label: 'Verde' },
    { value: 'amarelo', label: 'Amarelo' },
    { value: 'laranja', label: 'Laranja' },
    { value: 'roxo', label: 'Roxo' },
    { value: 'outros', label: 'Outros' }
];

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Global Variables
let services = [];
let currentFilter = 'todos';
let editingServiceId = null;
let currentUser = null;
let isAuthorized = false;
let currentView = 'welcome'; // welcome, client, production
let clientAttempts = 0;
let clientUser = null;
let currentOrderCode = null;
let orderListener = null; // Store listener reference
let pendingStatusUpdate = null; // Store pending status update info

// ===========================
// UTILITY FUNCTIONS
// ===========================

// Generate Order Code - 5 CHARACTERS ONLY
function generateOrderCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

// Generate New Code Button Function
async function generateNewCode() {
    const codeInput = document.getElementById('serviceOrderCode');
    const newCode = await generateUniqueCode();
    codeInput.value = newCode;
    showToast('Novo código gerado: ' + newCode, 'success');
}

// Check if code exists in database
async function isCodeUnique(code) {
    // Empty code is always valid (will be generated automatically)
    if (!code) return true;
    
    const snapshot = await db.collection('services')
        .where('orderCode', '==', code)
        .limit(1)
        .get();
    
    // If editing, check if the code belongs to the current service
    if (editingServiceId && !snapshot.empty) {
        const doc = snapshot.docs[0];
        return doc.id === editingServiceId;
    }
    
    return snapshot.empty;
}

// Validate Order Code Format
function validateOrderCode(code) {
    // Allow empty (will generate automatically)
    if (!code) return true;
    
    // Must be exactly 5 characters, alphanumeric only
    const pattern = /^[A-Z0-9]{5}$/;
    return pattern.test(code);
}

// Generate unique code with retry logic
async function generateUniqueCode() {
    let code;
    let attempts = 0;
    const maxAttempts = 100;
    
    do {
        code = generateOrderCode();
        attempts++;
        
        if (attempts >= maxAttempts) {
            throw new Error('Unable to generate unique code');
        }
    } while (!(await isCodeUnique(code)));
    
    return code;
}

// Show Toast Notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type]} toast-icon"></i>
        <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

// Calculate days remaining
function daysRemaining(dueDate) {
    const today = new Date();
    const due = new Date(dueDate);
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    return diff;
}

// ===========================
// CONFIRMATION MODAL FUNCTIONS - CORRIGIDO
// ===========================

// Show SEDEX Confirmation Modal
function showSedexConfirmation(serviceId) {
    pendingStatusUpdate = { id: serviceId, status: 'concluido' };
    document.getElementById('sedexConfirmModal').classList.add('active');
}

// Close SEDEX Confirmation Modal
function closeSedexConfirm() {
    document.getElementById('sedexConfirmModal').classList.remove('active');
    pendingStatusUpdate = null;
}

// Confirm SEDEX Completion - CORRIGIDO
async function confirmSedexCompletion() {
    if (!pendingStatusUpdate) return;
    
    const serviceId = pendingStatusUpdate.id;
    const newStatus = pendingStatusUpdate.status;
    
    closeSedexConfirm();
    
    // Executar atualização e aguardar conclusão
    await executeStatusUpdate(serviceId, newStatus);
    
    // Atualizar lista local imediatamente
    const serviceIndex = services.findIndex(s => s.id === serviceId);
    if (serviceIndex !== -1) {
        services[serviceIndex].status = newStatus;
        services[serviceIndex].updatedAt = new Date().toISOString();
        services[serviceIndex].updatedBy = currentUser.email;
    }
    
    // Re-renderizar interface
    renderServices();
    updateStats();
    
    pendingStatusUpdate = null;
}

// Show RETIRADA Confirmation Modal
function showRetiradaConfirmation(serviceId) {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    pendingStatusUpdate = { 
        id: serviceId, 
        status: 'concluido',
        service: service 
    };
    
    // Update client name in modal
    const clientName = service.pickupInfo?.name || service.client || 'Cliente';
    document.getElementById('retiradaClientName').textContent = clientName;
    
    document.getElementById('retiradaConfirmModal').classList.add('active');
}

// Close RETIRADA Confirmation Modal
function closeRetiradaConfirm() {
    document.getElementById('retiradaConfirmModal').classList.remove('active');
    pendingStatusUpdate = null;
}

// Confirm RETIRADA Without WhatsApp - CORRIGIDO
async function confirmRetiradaWithoutWhatsapp() {
    if (!pendingStatusUpdate) return;
    
    const serviceId = pendingStatusUpdate.id;
    const newStatus = pendingStatusUpdate.status;
    
    closeRetiradaConfirm();
    
    // Executar atualização e aguardar conclusão
    await executeStatusUpdate(serviceId, newStatus);
    
    // Atualizar lista local imediatamente
    const serviceIndex = services.findIndex(s => s.id === serviceId);
    if (serviceIndex !== -1) {
        services[serviceIndex].status = newStatus;
        services[serviceIndex].updatedAt = new Date().toISOString();
        services[serviceIndex].updatedBy = currentUser.email;
    }
    
    // Re-renderizar interface
    renderServices();
    updateStats();
    
    pendingStatusUpdate = null;
}

// Confirm RETIRADA With WhatsApp - CORRIGIDO
async function confirmRetiradaWithWhatsapp() {
    if (!pendingStatusUpdate) return;
    
    const service = pendingStatusUpdate.service;
    const serviceId = pendingStatusUpdate.id;
    const newStatus = pendingStatusUpdate.status;
    
    // Abrir WhatsApp se disponível
    if (service && service.pickupInfo && service.pickupInfo.whatsapp) {
        const whatsappNumber = service.pickupInfo.whatsapp.replace(/\D/g, '');
        const message = encodeURIComponent(
            'Olá, Tudo bem? Meu nome é Igor e falo em nome da ImaginaTech. ' +
            'Vou ser o responsável pela sua entrega no método RETIRADA, ' +
            'podemos combinar horário e local?'
        );
        const whatsappLink = `https://wa.me/55${whatsappNumber}?text=${message}`;
        window.open(whatsappLink, '_blank');
    }
    
    closeRetiradaConfirm();
    
    // Executar atualização e aguardar conclusão
    await executeStatusUpdate(serviceId, newStatus);
    
    // Atualizar lista local imediatamente
    const serviceIndex = services.findIndex(s => s.id === serviceId);
    if (serviceIndex !== -1) {
        services[serviceIndex].status = newStatus;
        services[serviceIndex].updatedAt = new Date().toISOString();
        services[serviceIndex].updatedBy = currentUser.email;
    }
    
    // Re-renderizar interface
    renderServices();
    updateStats();
    
    pendingStatusUpdate = null;
}

// Execute Status Update - CORRIGIDO
async function executeStatusUpdate(id, status) {
    try {
        const updates = { 
            status: status,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.email
        };
        
        if (status === 'entregue') {
            updates.deliveredDate = new Date().toISOString();
        }
        
        // Atualizar no Firebase
        await db.collection('services').doc(id).update(updates);
        
        // Atualizar lista local imediatamente para resposta mais rápida
        const serviceIndex = services.findIndex(s => s.id === id);
        if (serviceIndex !== -1) {
            services[serviceIndex] = { ...services[serviceIndex], ...updates };
        }
        
        showToast('Status atualizado com sucesso!', 'success');
        
        // Re-renderizar interface
        if (currentView === 'production') {
            renderServices();
            updateStats();
        }
        
    } catch (error) {
        console.error('Error updating status:', error);
        showToast('Erro ao atualizar status', 'error');
    }
}

// ===========================
// MOBILE MENU FUNCTIONS
// ===========================

// Toggle Mobile Menu for Client View
function toggleMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggle');
    const navbar = document.getElementById('navbar');
    
    toggle.classList.toggle('active');
    navbar.classList.toggle('mobile-menu-open');
}

// Toggle Mobile Menu for Production View
function toggleMobileMenuProd() {
    const toggle = document.getElementById('mobileMenuToggleProd');
    const dropdown = document.getElementById('mobileMenuDropdown');
    
    toggle.classList.toggle('active');
    dropdown.classList.toggle('active');
    
    // Update mobile menu user info
    if (currentUser) {
        document.getElementById('mobileUserAvatar').src = currentUser.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.displayName || 'User');
        document.getElementById('mobileUserName').textContent = currentUser.displayName || currentUser.email;
    }
    
    // Update mobile connection status
    const isOnline = navigator.onLine;
    const mobileStatus = document.getElementById('mobileConnectionStatus');
    const mobileStatusText = document.getElementById('mobileStatusText');
    
    if (isOnline) {
        mobileStatus.classList.remove('offline');
        mobileStatusText.textContent = 'Conectado';
    } else {
        mobileStatus.classList.add('offline');
        mobileStatusText.textContent = 'Offline';
    }
}

// Close Mobile Menu
function closeMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggleProd');
    const dropdown = document.getElementById('mobileMenuDropdown');
    
    toggle.classList.remove('active');
    dropdown.classList.remove('active');
}

// ===========================
// WELCOME SCREEN FUNCTIONS
// ===========================

function openClientLogin() {
    document.getElementById('clientLoginModal').classList.add('active');
}

function closeClientLogin() {
    document.getElementById('clientLoginModal').classList.remove('active');
    document.getElementById('clientLoginStep').style.display = 'block';
    document.getElementById('clientCodeStep').style.display = 'none';
    document.getElementById('orderCode').value = '';
    document.getElementById('attemptsWarning').classList.remove('show');
    clientAttempts = 0;
}

// Client Google Login - FIXED: No auth restrictions for clients
async function clientGoogleLogin() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        clientUser = result.user;
        
        // Save client data for marketing
        await saveClientData(clientUser);
        
        // Show code input step
        document.getElementById('clientLoginStep').style.display = 'none';
        document.getElementById('clientCodeStep').style.display = 'block';
        
        showToast(`Bem-vindo, ${clientUser.displayName}!`, 'success');
    } catch (error) {
        console.error('Error in client login:', error);
        showToast('Erro ao fazer login. Tente novamente.', 'error');
    }
}

// Save Client Data for Marketing
async function saveClientData(user) {
    try {
        const clientRef = db.collection('clients').doc(user.uid);
        const clientDoc = await clientRef.get();
        
        const clientData = {
            email: user.email,
            name: user.displayName,
            photoURL: user.photoURL,
            lastAccess: new Date().toISOString(),
            accessCount: clientDoc.exists ? (clientDoc.data().accessCount || 0) + 1 : 1,
            uid: user.uid,
            provider: user.providerData[0]?.providerId || 'google'
        };
        
        if (clientDoc.exists) {
            await clientRef.update(clientData);
        } else {
            clientData.firstAccess = new Date().toISOString();
            clientData.orders = [];
            await clientRef.set(clientData);
        }
        
        // Log access
        await db.collection('client_access_logs').add({
            clientId: user.uid,
            email: user.email,
            name: user.displayName,
            timestamp: new Date().toISOString(),
            action: 'login'
        });
        
    } catch (error) {
        console.error('Error saving client data:', error);
    }
}

// Verify Order Code - FIXED: Works for any authenticated user
async function verifyOrderCode() {
    const code = document.getElementById('orderCode').value.toUpperCase().trim();
    
    if (!code) {
        showToast('Digite o código do pedido', 'error');
        return;
    }
    
    if (!clientUser) {
        showToast('Faça login primeiro', 'error');
        return;
    }
    
    clientAttempts++;
    
    try {
        // Search for service with this code - No authorization check needed
        const snapshot = await db.collection('services')
            .where('orderCode', '==', code)
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            const service = snapshot.docs[0];
            currentOrderCode = code;
            
            // Update client's order list
            try {
                await db.collection('clients').doc(clientUser.uid).update({
                    orders: firebase.firestore.FieldValue.arrayUnion(code),
                    lastOrderViewed: code,
                    lastOrderViewedAt: new Date().toISOString()
                });
            } catch (updateError) {
                console.log('Could not update client order list:', updateError);
                // Continue anyway - this is not critical
            }
            
            // Log order view
            try {
                await db.collection('client_access_logs').add({
                    clientId: clientUser.uid,
                    email: clientUser.email,
                    orderCode: code,
                    timestamp: new Date().toISOString(),
                    action: 'view_order'
                });
            } catch (logError) {
                console.log('Could not log order view:', logError);
                // Continue anyway - this is not critical
            }
            
            // Show client view
            showClientOrder(service.id, service.data());
            closeClientLogin();
            showToast('Pedido encontrado!', 'success');
            
        } else {
            const remainingAttempts = 3 - clientAttempts;
            
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
                    closeClientLogin();
                }, 2000);
            }
        }
    } catch (error) {
        console.error('Error verifying code:', error);
        showToast('Erro ao verificar código. Tente novamente.', 'error');
    }
}

// Show Client Order View
function showClientOrder(serviceId, service) {
    currentView = 'client';
    
    // Hide welcome screen
    document.getElementById('welcomeScreen').classList.add('hidden');
    
    // Show navbar and client view
    document.getElementById('navbar').classList.add('active');
    document.getElementById('clientView').classList.add('active');
    
    // Update client name
    document.getElementById('clientName').textContent = clientUser.displayName.split(' ')[0];
    
    // Render order card
    const container = document.getElementById('clientOrderCard');
    
    // Calculate days
    const days = daysRemaining(service.dueDate);
    const daysText = days === 0 ? 'Hoje' : 
                   days === 1 ? 'Amanhã' : 
                   days < 0 ? `${Math.abs(days)} dias atrás` : 
                   `${days} dias`;
    const daysColor = days < 0 ? 'var(--neon-red)' : 
                     days <= 2 ? 'var(--neon-yellow)' : 
                     'var(--secondary-blue)';
    
    // Calculate timeline progress
    const statusProgress = {
        'pendente': 25,
        'producao': 50,
        'concluido': 75,
        'entregue': 100
    };
    
    const progress = statusProgress[service.status] || 0;
    
    const deliveryLabels = {
        'retirada': 'Retirada',
        'sedex': 'Sedex',
        'uber': 'Uber Flash',
        'definir': 'A definir'
    };
    
    container.innerHTML = `
        <div class="order-status-timeline">
            <div class="timeline-line">
                <div class="timeline-progress" style="width: ${progress}%"></div>
            </div>
            
            <div class="timeline-step ${service.status !== 'pendente' ? 'completed' : ''} ${service.status === 'pendente' ? 'active' : ''}">
                <div class="timeline-dot">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="timeline-label">Pendente</div>
            </div>
            
            <div class="timeline-step ${['concluido', 'entregue'].includes(service.status) ? 'completed' : ''} ${service.status === 'producao' ? 'active' : ''}">
                <div class="timeline-dot">
                    <i class="fas fa-cogs"></i>
                </div>
                <div class="timeline-label">Em Produção</div>
            </div>
            
            <div class="timeline-step ${service.status === 'entregue' ? 'completed' : ''} ${service.status === 'concluido' ? 'active' : ''}">
                <div class="timeline-dot">
                    <i class="fas fa-check"></i>
                </div>
                <div class="timeline-label">Concluído</div>
            </div>
            
            <div class="timeline-step ${service.status === 'entregue' ? 'active completed' : ''}">
                <div class="timeline-dot">
                    <i class="fas fa-box"></i>
                </div>
                <div class="timeline-label">Entregue</div>
            </div>
        </div>
        
        <div class="service-card priority-${service.priority}" style="max-width: 600px; margin: 40px auto;">
            <div class="service-header">
                <span class="service-id">${service.orderCode}</span>
                <span class="service-priority priority-${service.priority}">
                    ${service.priority.toUpperCase()}
                </span>
            </div>
            
            <h3 class="service-title">${service.name}</h3>
            
            ${service.deliveryMethod ? `
                <div class="delivery-badge">
                    <i class="fas fa-truck"></i>
                    ${deliveryLabels[service.deliveryMethod] || 'Não informado'}
                </div>
            ` : ''}
            
            ${service.description || service.material || service.color ? `
                <div class="service-details">
                    ${service.description ? `<p><strong>Descrição:</strong> ${service.description}</p>` : ''}
                    ${service.material ? `<p><strong>Material:</strong> ${service.material}</p>` : ''}
                    ${service.color ? `<p><strong>Cor:</strong> ${service.color === 'outros' ? 'Outras cores' : service.color.charAt(0).toUpperCase() + service.color.slice(1)}</p>` : ''}
                </div>
            ` : ''}
            
            <div class="service-dates">
                <div class="date-box">
                    <div class="date-label">Entrada</div>
                    <div class="date-value">${formatDate(service.startDate)}</div>
                </div>
                <div class="date-box">
                    <div class="date-label">Prazo</div>
                    <div class="date-value" style="color: ${daysColor}">
                        ${daysText}
                    </div>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px; padding: 15px; background: rgba(0, 255, 136, 0.1); border-radius: 10px;">
                <p style="font-size: 1.1rem; font-weight: 600; color: var(--neon-green);">
                    Status Atual: ${service.status.toUpperCase().replace('PRODUCAO', 'EM PRODUÇÃO')}
                </p>
            </div>
        </div>
    `;
    
    // Setup real-time updates for this order
    setupClientOrderListener(serviceId);
}

// Setup Real-time Updates for Client Order - FIXED: Removed spam notifications
function setupClientOrderListener(serviceId) {
    // Cancel previous listener if exists
    if (orderListener) {
        orderListener();
        orderListener = null;
    }
    
    // Setup new listener without notifications
    orderListener = db.collection('services').doc(serviceId).onSnapshot((doc) => {
        if (doc.exists && currentView === 'client') {
            const service = doc.data();
            showClientOrder(serviceId, service);
            // REMOVED: showToast notification to prevent spam
        }
    }, (error) => {
        console.error('Error listening to order updates:', error);
    });
}

// Exit to Welcome Screen - FIXED: Proper cleanup
function exitToWelcome() {
    currentView = 'welcome';
    currentOrderCode = null;
    
    // Cancel order listener if exists
    if (orderListener) {
        orderListener();
        orderListener = null;
    }
    
    // Clear client user but keep auth for potential production login
    clientUser = null;
    
    // Only sign out if not in production mode
    if (!isAuthorized && auth.currentUser) {
        auth.signOut().catch(error => {
            console.log('Sign out error:', error);
        });
    }
    
    // Hide all views
    document.getElementById('navbar').classList.remove('active');
    document.getElementById('clientView').classList.remove('active');
    document.getElementById('header').classList.remove('active');
    document.getElementById('mainContainer').classList.remove('active');
    
    // Show welcome screen
    document.getElementById('welcomeScreen').classList.remove('hidden');
    
    // Close mobile menus if open
    closeMobileMenu();
}

// ===========================
// PRODUCTION FUNCTIONS
// ===========================

// Production Login
async function openProductionLogin() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        if (AUTHORIZED_EMAILS.includes(user.email)) {
            currentUser = user;
            isAuthorized = true;
            currentView = 'production';
            
            // Hide welcome screen
            document.getElementById('welcomeScreen').classList.add('hidden');
            
            // Show production view
            document.getElementById('header').classList.add('active');
            document.getElementById('mainContainer').classList.add('active');
            
            // Update UI
            updateUIForUser(user);
            
            showToast(`Bem-vindo ao módulo de produção, ${user.displayName}!`, 'success');
        } else {
            await auth.signOut();
            showToast(`Acesso negado! Email ${user.email} não autorizado.`, 'error');
        }
    } catch (error) {
        console.error('Error in production login:', error);
        showToast('Erro ao fazer login', 'error');
    }
}

// Sign Out
async function signOut() {
    try {
        await auth.signOut();
        currentUser = null;
        isAuthorized = false;
        exitToWelcome();
        showToast('Logout realizado com sucesso', 'success');
    } catch (error) {
        console.error('Error signing out:', error);
    }
}

// Update UI for Authenticated User
function updateUIForUser(user) {
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('userAvatar').src = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || 'User');
    document.getElementById('userName').textContent = user.displayName || user.email;
    
    renderServices();
}

// Connection Status
function updateConnectionStatus(connected) {
    const statusEl = document.getElementById('connectionStatus');
    const statusDot = statusEl.querySelector('.status-dot');
    const statusText = document.getElementById('statusText');
    
    if (connected) {
        statusEl.classList.remove('offline');
        statusDot.classList.remove('offline');
        statusText.textContent = 'Conectado';
        statusEl.title = 'Conectado ao servidor';
    } else {
        statusEl.classList.add('offline');
        statusDot.classList.add('offline');
        statusText.textContent = 'Offline';
        statusEl.title = 'Sem conexão com o servidor';
    }
}

// ===========================
// SERVICE MANAGEMENT
// ===========================

// Toggle Delivery Fields
function toggleDeliveryFields() {
    const method = document.getElementById('deliveryMethod').value;
    const deliveryFields = document.getElementById('deliveryFields');
    const pickupFields = document.getElementById('pickupFields');
    
    // Hide all fields first
    deliveryFields.classList.remove('active');
    pickupFields.classList.remove('active');
    
    // Reset required attributes
    const deliveryInputs = deliveryFields.querySelectorAll('input, select, textarea');
    const pickupInputs = pickupFields.querySelectorAll('input');
    
    deliveryInputs.forEach(input => input.required = false);
    pickupInputs.forEach(input => input.required = false);
    
    if (method === 'sedex') {
        deliveryFields.classList.add('active');
        // Set required fields for Sedex
        document.getElementById('fullName').required = true;
        document.getElementById('cpfCnpj').required = true;
        document.getElementById('telefone').required = true;
        document.getElementById('email').required = true;
        document.getElementById('saleValue').required = true;
        document.getElementById('cep').required = true;
        document.getElementById('numero').required = true;
        document.getElementById('rua').required = true;
        document.getElementById('bairro').required = true;
        document.getElementById('cidade').required = true;
        document.getElementById('estado').required = true;
    } else if (method === 'retirada') {
        pickupFields.classList.add('active');
        // Set required fields for pickup
        document.getElementById('pickupName').required = true;
        document.getElementById('pickupWhatsapp').required = true;
    }
}

// Format WhatsApp number
function formatWhatsApp(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 0) {
        if (value.length <= 2) {
            value = `(${value}`;
        } else if (value.length <= 7) {
            value = `(${value.slice(0,2)}) ${value.slice(2)}`;
        } else if (value.length <= 11) {
            value = `(${value.slice(0,2)}) ${value.slice(2,7)}-${value.slice(7)}`;
        }
    }
    input.value = value;
}

// Format CPF/CNPJ
function formatCpfCnpj(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length <= 11) {
        // CPF
        if (value.length > 9) {
            value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        } else if (value.length > 6) {
            value = value.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
        } else if (value.length > 3) {
            value = value.replace(/(\d{3})(\d{3})/, '$1.$2');
        }
    } else {
        // CNPJ
        if (value.length > 12) {
            value = value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        } else if (value.length > 8) {
            value = value.replace(/(\d{2})(\d{3})(\d{3})(\d{4})/, '$1.$2.$3/$4');
        } else if (value.length > 5) {
            value = value.replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2.$3');
        } else if (value.length > 2) {
            value = value.replace(/(\d{2})(\d{3})/, '$1.$2');
        }
    }
    input.value = value;
}

// Format CEP
function formatCEP(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 5) {
        value = value.slice(0, 5) + '-' + value.slice(5, 8);
    }
    input.value = value;
}

// Search CEP
async function searchCEP() {
    const cepInput = document.getElementById('cep');
    const cep = cepInput.value.replace(/\D/g, '');
    
    if (cep.length === 8) {
        try {
            cepInput.style.opacity = '0.5';
            
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();
            
            if (!data.erro) {
                document.getElementById('rua').value = data.logradouro || '';
                document.getElementById('bairro').value = data.bairro || '';
                document.getElementById('cidade').value = data.localidade || '';
                document.getElementById('estado').value = data.uf || '';
                document.getElementById('numero').focus();
            }
        } catch (error) {
            console.error('Erro ao buscar CEP:', error);
        } finally {
            cepInput.style.opacity = '1';
        }
    }
}

// ===========================
// CRUD OPERATIONS
// ===========================

// Open Add Modal
function openAddModal() {
    if (!isAuthorized) {
        showToast('Você não tem permissão para adicionar serviços', 'error');
        return;
    }
    
    editingServiceId = null;
    document.getElementById('modalTitle').textContent = 'Novo Serviço';
    document.getElementById('saveButtonText').textContent = 'Salvar Serviço';
    document.getElementById('serviceForm').reset();
    document.getElementById('serviceOrderCode').value = ''; // Clear code field
    document.getElementById('startDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('deliveryFields').classList.remove('active');
    document.getElementById('pickupFields').classList.remove('active');
    document.getElementById('orderCodeDisplay').style.display = 'none';
    document.getElementById('serviceModal').classList.add('active');
    
    // Close mobile menu if open
    closeMobileMenu();
}

// Open Edit Modal
function openEditModal(id) {
    if (!isAuthorized) {
        showToast('Você não tem permissão para editar serviços', 'error');
        return;
    }
    
    editingServiceId = id;
    const service = services.find(s => s.id === id);
    if (!service) return;

    document.getElementById('modalTitle').textContent = 'Editar Serviço';
    document.getElementById('saveButtonText').textContent = 'Atualizar Serviço';
    
    // Fill form fields including order code
    document.getElementById('serviceOrderCode').value = service.orderCode || '';
    document.getElementById('serviceNameInput').value = service.name;
    document.getElementById('clientNameInput').value = service.client;
    document.getElementById('serviceDescription').value = service.description || '';
    document.getElementById('serviceMaterial').value = service.material || '';
    document.getElementById('serviceColor').value = service.color || '';
    document.getElementById('servicePriority').value = service.priority;
    document.getElementById('startDate').value = service.startDate;
    document.getElementById('dueDate').value = service.dueDate;
    document.getElementById('deliveryMethod').value = service.deliveryMethod || '';
    
    // Show order code if exists
    if (service.orderCode) {
        document.getElementById('orderCodeDisplay').style.display = 'block';
        document.getElementById('orderCodeValue').textContent = service.orderCode;
    }
    
    toggleDeliveryFields();
    
    if (service.deliveryMethod === 'retirada' && service.pickupInfo) {
        const pickup = service.pickupInfo;
        document.getElementById('pickupName').value = pickup.name || '';
        document.getElementById('pickupWhatsapp').value = pickup.whatsapp || '';
    }
    
    if (service.deliveryMethod === 'sedex' && service.deliveryAddress) {
        const addr = service.deliveryAddress;
        document.getElementById('fullName').value = addr.fullName || '';
        document.getElementById('cpfCnpj').value = addr.cpfCnpj || '';
        document.getElementById('email').value = addr.email || '';
        document.getElementById('telefone').value = addr.telefone || '';
        document.getElementById('saleValue').value = service.saleValue || '';
        document.getElementById('cep').value = addr.cep || '';
        document.getElementById('numero').value = addr.numero || '';
        document.getElementById('rua').value = addr.rua || '';
        document.getElementById('complemento').value = addr.complemento || '';
        document.getElementById('bairro').value = addr.bairro || '';
        document.getElementById('cidade').value = addr.cidade || '';
        document.getElementById('estado').value = addr.estado || '';
        document.getElementById('observacoes').value = addr.observacoes || '';
    }
    
    document.getElementById('serviceModal').classList.add('active');
}

// Close Modal
function closeModal() {
    document.getElementById('serviceModal').classList.remove('active');
    document.getElementById('serviceForm').reset();
    document.getElementById('deliveryFields').classList.remove('active');
    document.getElementById('pickupFields').classList.remove('active');
    document.getElementById('orderCodeDisplay').style.display = 'none';
    editingServiceId = null;
}

// Save Service
async function saveService(event) {
    event.preventDefault();
    
    if (!isAuthorized) {
        showToast('Você não tem permissão para salvar serviços', 'error');
        return;
    }
    
    const serviceName = document.getElementById('serviceNameInput').value;
    const clientName = document.getElementById('clientNameInput').value;
    let orderCode = document.getElementById('serviceOrderCode').value.toUpperCase().trim();
    
    if (!serviceName || !clientName) {
        showToast('Por favor, preencha todos os campos obrigatórios', 'error');
        return;
    }
    
    // Validate order code format if provided
    if (orderCode && !validateOrderCode(orderCode)) {
        showToast('Código inválido! Use apenas 5 caracteres alfanuméricos', 'error');
        return;
    }
    
    // Check if code is unique
    if (orderCode && !(await isCodeUnique(orderCode))) {
        showToast('Este código já existe! Use outro código', 'error');
        return;
    }
    
    const deliveryMethod = document.getElementById('deliveryMethod').value;
    
    const service = {
        name: serviceName,
        client: clientName,
        description: document.getElementById('serviceDescription').value,
        material: document.getElementById('serviceMaterial').value,
        color: document.getElementById('serviceColor').value,
        priority: document.getElementById('servicePriority').value,
        startDate: document.getElementById('startDate').value,
        dueDate: document.getElementById('dueDate').value,
        status: editingServiceId ? 
            services.find(s => s.id === editingServiceId)?.status || 'pendente' : 
            'pendente',
        deliveryMethod: deliveryMethod,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.email
    };
    
    // Save client data if sedex
    if (deliveryMethod === 'sedex') {
        const clientEmail = document.getElementById('email').value;
        const clientNameDelivery = document.getElementById('fullName').value;
        const telefone = document.getElementById('telefone').value;
        
        // Save integrated client data
        if (clientEmail) {
            try {
                await db.collection('marketing_contacts').doc(clientEmail).set({
                    email: clientEmail,
                    name: clientNameDelivery,
                    phone: telefone,
                    cpfCnpj: document.getElementById('cpfCnpj').value,
                    address: {
                        cep: document.getElementById('cep').value,
                        rua: document.getElementById('rua').value,
                        numero: document.getElementById('numero').value,
                        complemento: document.getElementById('complemento').value,
                        bairro: document.getElementById('bairro').value,
                        cidade: document.getElementById('cidade').value,
                        estado: document.getElementById('estado').value
                    },
                    lastOrder: service.name,
                    lastOrderDate: new Date().toISOString(),
                    source: 'order_form'
                }, { merge: true });
            } catch (error) {
                console.error('Error saving marketing contact:', error);
            }
        }
        
        service.saleValue = document.getElementById('saleValue').value;
        service.deliveryAddress = {
            fullName: clientNameDelivery,
            cpfCnpj: document.getElementById('cpfCnpj').value,
            email: clientEmail,
            telefone: telefone,
            cep: document.getElementById('cep').value,
            numero: document.getElementById('numero').value,
            rua: document.getElementById('rua').value,
            complemento: document.getElementById('complemento').value,
            bairro: document.getElementById('bairro').value,
            cidade: document.getElementById('cidade').value,
            estado: document.getElementById('estado').value,
            observacoes: document.getElementById('observacoes').value
        };
    }
    
    if (deliveryMethod === 'retirada') {
        service.pickupInfo = {
            name: document.getElementById('pickupName').value,
            whatsapp: document.getElementById('pickupWhatsapp').value
        };
    }

    try {
        if (editingServiceId) {
            // Update existing - use provided code or keep existing
            service.orderCode = orderCode || services.find(s => s.id === editingServiceId)?.orderCode;
            
            // If still no code, generate one
            if (!service.orderCode) {
                service.orderCode = await generateUniqueCode();
            }
            
            await db.collection('services').doc(editingServiceId).update(service);
            showToast('Serviço atualizado com sucesso!', 'success');
            closeModal();
        } else {
            // Create new - generate code if not provided
            service.createdAt = new Date().toISOString();
            service.orderCode = orderCode || await generateUniqueCode();
            service.createdBy = currentUser.email;
            
            await db.collection('services').add(service);
            
            // Show the order code
            document.getElementById('orderCodeDisplay').style.display = 'block';
            document.getElementById('orderCodeValue').textContent = service.orderCode;
            
            showToast(`Serviço criado! Código: ${service.orderCode}`, 'success');
            
            // Keep modal open for 3 seconds to show code
            setTimeout(() => {
                closeModal();
            }, 3000);
        }
    } catch (error) {
        console.error('Error saving service:', error);
        showToast('Erro ao salvar serviço: ' + error.message, 'error');
    }
}

// Update Service Status - CORRIGIDO
async function updateStatus(id, status) {
    if (!isAuthorized) {
        showToast('Você não tem permissão para atualizar status', 'error');
        return;
    }
    
    const service = services.find(s => s.id === id);
    if (!service) return;
    
    // Usar modais customizados para confirmação
    if (status === 'concluido') {
        if (service.deliveryMethod === 'sedex') {
            // Mostrar modal customizado para SEDEX
            showSedexConfirmation(id);
            return; // Aguardar confirmação do modal
            
        } else if (service.deliveryMethod === 'retirada' && service.pickupInfo) {
            // Mostrar modal customizado para RETIRADA
            showRetiradaConfirmation(id);
            return; // Aguardar confirmação do modal
        }
    }
    
    // Para outros casos, executar diretamente
    await executeStatusUpdate(id, status);
    
    // Atualizar lista local imediatamente
    const serviceIndex = services.findIndex(s => s.id === id);
    if (serviceIndex !== -1) {
        services[serviceIndex].status = status;
        services[serviceIndex].updatedAt = new Date().toISOString();
        services[serviceIndex].updatedBy = currentUser.email;
    }
    
    // Re-renderizar interface
    renderServices();
    updateStats();
}

// Delete Service
async function deleteService(id) {
    if (!isAuthorized) {
        showToast('Você não tem permissão para excluir serviços', 'error');
        return;
    }
    
    if (confirm('Tem certeza que deseja excluir este serviço?')) {
        try {
            await db.collection('services').doc(id).delete();
            showToast('Serviço excluído', 'success');
        } catch (error) {
            console.error('Error deleting service:', error);
            showToast('Erro ao excluir serviço', 'error');
        }
    }
}

// Show Delivery Info
function showDeliveryInfo(id) {
    const service = services.find(s => s.id === id);
    if (!service) return;

    const modal = document.getElementById('deliveryInfoModal');
    const content = document.getElementById('deliveryInfoContent');
    
    let html = '';
    
    const deliveryMethods = {
        'retirada': 'Retirada no Local',
        'sedex': 'Sedex',
        'uber': 'Uber Flash',
        'definir': 'A Definir'
    };
    
    html += `
        <div class="info-section">
            <h3 class="info-title">
                <i class="fas fa-truck"></i> Método de Entrega
            </h3>
            <div class="info-item">
                <span class="info-label">Tipo</span>
                <span class="info-value">${deliveryMethods[service.deliveryMethod] || 'Não informado'}</span>
            </div>
        </div>
    `;
    
    // For Retirada
    if (service.deliveryMethod === 'retirada' && service.pickupInfo) {
        const pickup = service.pickupInfo;
        const whatsappNumber = pickup.whatsapp.replace(/\D/g, '');
        // Nova mensagem no link do WhatsApp
        const message = encodeURIComponent(
            'Olá, Tudo bem? Meu nome é Igor e falo em nome da ImaginaTech. ' +
            'Vou ser o responsável pela sua entrega no método RETIRADA, ' +
            'podemos combinar horário e local?'
        );
        const whatsappLink = `https://wa.me/55${whatsappNumber}?text=${message}`;
        
        html += `
            <div class="info-section">
                <h3 class="info-title">
                    <i class="fas fa-user-check"></i> Informações para Retirada
                </h3>
                <div class="info-item">
                    <span class="info-label">Nome</span>
                    <span class="info-value">${pickup.name || '-'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">WhatsApp</span>
                    <span class="info-value">
                        <a href="${whatsappLink}" target="_blank" style="color: var(--neon-green); text-decoration: none;">
                            <i class="fab fa-whatsapp"></i> ${pickup.whatsapp}
                        </a>
                    </span>
                </div>
            </div>
        `;
    }
    
    // For Sedex
    if (service.deliveryMethod === 'sedex' && service.deliveryAddress) {
        const addr = service.deliveryAddress;
        
        html += `
            <div class="info-section">
                <h3 class="info-title">
                    <i class="fas fa-user"></i> Dados do Destinatário
                </h3>
                <div class="info-item">
                    <span class="info-label">Nome</span>
                    <span class="info-value">${addr.fullName || '-'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">CPF/CNPJ</span>
                    <span class="info-value">${addr.cpfCnpj || '-'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">E-mail</span>
                    <span class="info-value">${addr.email || '-'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Telefone</span>
                    <span class="info-value">${addr.telefone || '-'}</span>
                </div>
            </div>
            
            <div class="info-section">
                <h3 class="info-title">
                    <i class="fas fa-map-marker-alt"></i> Endereço de Entrega
                </h3>
                <div class="info-item">
                    <span class="info-label">CEP</span>
                    <span class="info-value">${addr.cep || '-'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Rua</span>
                    <span class="info-value">${addr.rua || '-'}, ${addr.numero || 's/n'}</span>
                </div>
                ${addr.complemento ? `
                    <div class="info-item">
                        <span class="info-label">Complemento</span>
                        <span class="info-value">${addr.complemento}</span>
                    </div>
                ` : ''}
                <div class="info-item">
                    <span class="info-label">Bairro</span>
                    <span class="info-value">${addr.bairro || '-'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Cidade/UF</span>
                    <span class="info-value">${addr.cidade || '-'}/${addr.estado || '-'}</span>
                </div>
            </div>
            
            <div class="info-section">
                <h3 class="info-title">
                    <i class="fas fa-dollar-sign"></i> Valor da Venda
                </h3>
                <div class="info-item">
                    <span class="info-label">Total</span>
                    <span class="info-value price">R$ ${parseFloat(service.saleValue || 0).toFixed(2)}</span>
                </div>
            </div>
        `;
    }
    
    // Order Code
    html += `
        <div class="info-section">
            <h3 class="info-title">
                <i class="fas fa-qrcode"></i> Código do Pedido
            </h3>
            <div class="info-item">
                <span class="info-label">Código para o cliente</span>
                <span class="info-value" style="font-family: 'Orbitron', monospace; font-size: 1.2rem; color: var(--neon-green);">
                    ${service.orderCode || 'N/A'}
                </span>
            </div>
        </div>
    `;
    
    content.innerHTML = html;
    modal.classList.add('active');
}

// Close Delivery Modal
function closeDeliveryModal() {
    document.getElementById('deliveryInfoModal').classList.remove('active');
}

// ===========================
// DATA LOADING & RENDERING
// ===========================

// Load services from Firestore
async function loadServices() {
    try {
        const snapshot = await db.collection('services').get();
        services = [];
        snapshot.forEach(doc => {
            services.push({ id: doc.id, ...doc.data() });
        });
        
        services.sort((a, b) => {
            const aDate = new Date(a.createdAt || 0);
            const bDate = new Date(b.createdAt || 0);
            return bDate - aDate;
        });
        
        renderServices();
        updateStats();
        hideLoading();
    } catch (error) {
        console.error('Error loading services:', error);
        hideLoading();
        updateConnectionStatus(false);
    }
}

// Real-time updates for production
function setupProductionListener() {
    db.collection('services').onSnapshot((snapshot) => {
        services = [];
        snapshot.forEach(doc => {
            services.push({ id: doc.id, ...doc.data() });
        });
        services.sort((a, b) => {
            const aDate = new Date(a.createdAt || 0);
            const bDate = new Date(b.createdAt || 0);
            return bDate - aDate;
        });
        
        if (currentView === 'production') {
            renderServices();
            updateStats();
        }
        updateConnectionStatus(true);
    }, (error) => {
        console.error('Real-time update error:', error);
        updateConnectionStatus(false);
    });
}

// Filter Services
function filterServices(filter) {
    currentFilter = filter;
    
    // Update active state on stat cards
    document.querySelectorAll('.stat-card').forEach(card => {
        card.classList.remove('active');
    });
    document.getElementById(`filter-${filter}`).classList.add('active');
    
    renderServices();
}

// Update Statistics
function updateStats() {
    const stats = {
        total: services.filter(s => s.status !== 'entregue').length,
        pendente: services.filter(s => s.status === 'pendente').length,
        producao: services.filter(s => s.status === 'producao').length,
        concluido: services.filter(s => s.status === 'concluido').length,
        entregue: services.filter(s => s.status === 'entregue').length
    };

    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-pending').textContent = stats.pendente;
    document.getElementById('stat-production').textContent = stats.producao;
    document.getElementById('stat-completed').textContent = stats.concluido;
    document.getElementById('stat-delivered').textContent = stats.entregue;
}

// Render Services
function renderServices() {
    const grid = document.getElementById('servicesGrid');
    const emptyState = document.getElementById('emptyState');
    
    let filteredServices = services;
    
    // Filter
    if (currentFilter === 'todos') {
        filteredServices = services.filter(s => s.status !== 'entregue');
    } else if (currentFilter !== 'todos') {
        filteredServices = services.filter(s => s.status === currentFilter);
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
        emptyState.style.display = 'block';
    } else {
        grid.style.display = 'grid';
        emptyState.style.display = 'none';
        
        grid.innerHTML = filteredServices.map(service => {
            const days = daysRemaining(service.dueDate);
            const daysText = days === 0 ? 'Hoje' : 
                           days === 1 ? 'Amanhã' : 
                           days < 0 ? `${Math.abs(days)} dias atrás` : 
                           `${days} dias`;
            const daysColor = days < 0 ? 'var(--neon-red)' : 
                             days <= 2 ? 'var(--neon-yellow)' : 
                             'var(--secondary-blue)';
            
            const deliveryIcons = {
                'retirada': 'fa-store',
                'sedex': 'fa-mail-bulk',
                'uber': 'fa-motorcycle',
                'definir': 'fa-question-circle'
            };
            
            const deliveryLabels = {
                'retirada': 'Retirada',
                'sedex': 'Sedex',
                'uber': 'Uber Flash',
                'definir': 'A definir'
            };
            
            return `
                <div class="service-card priority-${service.priority}">
                    <div class="service-header">
                        <span class="service-id">${service.orderCode || 'SEM CÓDIGO'}</span>
                        <span class="service-priority priority-${service.priority}">
                            ${service.priority.toUpperCase()}
                        </span>
                    </div>
                    
                    ${service.deliveryMethod ? `
                        <div class="delivery-badge-prominent">
                            <i class="fas ${deliveryIcons[service.deliveryMethod] || 'fa-truck'}"></i>
                            <span>${deliveryLabels[service.deliveryMethod] || 'Não informado'}</span>
                        </div>
                    ` : ''}
                    
                    <h3 class="service-title">${service.name}</h3>
                    
                    <div class="service-client">
                        <i class="fas fa-user"></i>
                        ${service.client}
                    </div>
                    
                    ${service.description || service.material || service.color ? `
                        <div class="service-details">
                            ${service.description ? `<p><strong>Descrição:</strong> ${service.description}</p>` : ''}
                            ${service.material ? `<p><strong>Material:</strong> ${service.material}</p>` : ''}
                            ${service.color ? `<p><strong>Cor:</strong> ${service.color === 'outros' ? 'Outras cores' : service.color.charAt(0).toUpperCase() + service.color.slice(1)}</p>` : ''}
                        </div>
                    ` : ''}
                    
                    <div class="service-dates">
                        <div class="date-box">
                            <div class="date-label">Entrada</div>
                            <div class="date-value">${formatDate(service.startDate)}</div>
                        </div>
                        <div class="date-box">
                            <div class="date-label">Prazo</div>
                            <div class="date-value" style="color: ${daysColor}">
                                ${daysText}
                            </div>
                        </div>
                    </div>
                    
                    <div class="service-status">
                        <div class="status-badge ${service.status === 'pendente' ? 'active' : ''} ${service.status === 'pendente' ? '' : 'completed'}"
                             onclick="updateStatus('${service.id}', 'pendente')">
                            <i class="fas fa-clock"></i> Pendente
                        </div>
                        <div class="status-badge ${service.status === 'producao' ? 'active' : ''} ${['concluido', 'entregue'].includes(service.status) ? 'completed' : ''}"
                             onclick="updateStatus('${service.id}', 'producao')">
                            <i class="fas fa-cogs"></i> Produção
                        </div>
                        <div class="status-badge ${service.status === 'concluido' ? 'active' : ''} ${service.status === 'entregue' ? 'completed' : ''}"
                             onclick="updateStatus('${service.id}', 'concluido')">
                            <i class="fas fa-check"></i> Concluído
                        </div>
                        <div class="status-badge ${service.status === 'entregue' ? 'active' : ''}"
                             onclick="updateStatus('${service.id}', 'entregue')">
                            <i class="fas fa-box"></i> Entregue
                        </div>
                    </div>
                    
                    <div class="service-actions">
                        ${service.deliveryMethod ? `
                            <button class="btn btn-action btn-delivery-info" onclick="showDeliveryInfo('${service.id}')">
                                <i class="fas fa-info-circle"></i> Info
                            </button>
                        ` : ''}
                        <button class="btn btn-action" onclick="openEditModal('${service.id}')">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn btn-action" style="border-color: var(--neon-red); color: var(--neon-red);" 
                                onclick="deleteService('${service.id}')">
                            <i class="fas fa-trash"></i> Excluir
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Hide loading
function hideLoading() {
    setTimeout(() => {
        document.getElementById('loadingOverlay').style.display = 'none';
    }, 1000);
}

// Create Particles
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 30;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        particlesContainer.appendChild(particle);
    }
}

// ===========================
// INITIALIZATION
// ===========================

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    createParticles();
    loadServices();
    setupProductionListener();
    hideLoading();
    
    // Add format listeners
    const cepInput = document.getElementById('cep');
    if (cepInput) {
        cepInput.addEventListener('keyup', function() { formatCEP(this); });
        cepInput.addEventListener('blur', searchCEP);
    }
    
    const pickupWhatsapp = document.getElementById('pickupWhatsapp');
    if (pickupWhatsapp) {
        pickupWhatsapp.addEventListener('keyup', function() { formatWhatsApp(this); });
    }
    
    const telefone = document.getElementById('telefone');
    if (telefone) {
        telefone.addEventListener('keyup', function() { formatWhatsApp(this); });
    }
    
    const cpfCnpj = document.getElementById('cpfCnpj');
    if (cpfCnpj) {
        cpfCnpj.addEventListener('keyup', function() { formatCpfCnpj(this); });
    }
    
    // Order code input - uppercase and 5 chars max
    const orderCodeInput = document.getElementById('orderCode');
    if (orderCodeInput) {
        orderCodeInput.addEventListener('input', function() {
            this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
        });
    }
    
    // Service order code input - uppercase and 5 chars max
    const serviceOrderCodeInput = document.getElementById('serviceOrderCode');
    if (serviceOrderCodeInput) {
        serviceOrderCodeInput.addEventListener('input', function() {
            this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
        });
    }
    
    // Monitor connection status
    window.addEventListener('online', () => updateConnectionStatus(true));
    window.addEventListener('offline', () => updateConnectionStatus(false));
});
