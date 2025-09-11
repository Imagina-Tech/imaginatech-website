// ===========================
// IMAGINATECH - PAINEL DE SERVIÇOS
// Sistema de Gerenciamento com Firebase
// Versão Otimizada - Correções Aplicadas
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
let currentView = 'welcome';
let clientAttempts = 0;
let clientUser = null;
let currentOrderCode = null;
let orderListener = null;
let pendingStatusUpdate = null;
let productionListener = null; // FIX 9: Store production listener
let lastNotificationTime = {}; // FIX 1: Track last notification times
let notificationDebounce = null; // FIX 1: Debounce timer

// ===========================
// UTILITY FUNCTIONS
// ===========================

// FIX 4: Timezone-aware date functions for Brazil
function getBrazilTime() {
    const now = new Date();
    const brazilOffset = -3; // UTC-3 for Brasília
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * brazilOffset));
}

// FIX 5: Correct date handling without timezone issues
function getLocalDateString(date) {
    // Create date at noon to avoid timezone shifts
    const d = new Date(date + 'T12:00:00');
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// FIX 4: Calculate days remaining with Brazil timezone
function daysRemaining(dueDate) {
    const brazilNow = getBrazilTime();
    // Set to start of day in Brazil time
    brazilNow.setHours(0, 0, 0, 0);
    
    // Parse due date at noon to avoid timezone issues
    const due = new Date(dueDate + 'T12:00:00');
    due.setHours(0, 0, 0, 0);
    
    const diff = Math.ceil((due - brazilNow) / (1000 * 60 * 60 * 24));
    return diff;
}

// FIX 1: Debounced toast notification
function showToast(message, type = 'info') {
    // Prevent duplicate notifications
    const now = Date.now();
    const key = `${message}_${type}`;
    
    if (lastNotificationTime[key] && (now - lastNotificationTime[key]) < 3000) {
        return; // Skip if same notification within 3 seconds
    }
    
    lastNotificationTime[key] = now;
    
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

// Generate Order Code
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
    if (!code) return true;
    
    const snapshot = await db.collection('services')
        .where('orderCode', '==', code)
        .limit(1)
        .get();
    
    if (editingServiceId && !snapshot.empty) {
        const doc = snapshot.docs[0];
        return doc.id === editingServiceId;
    }
    
    return snapshot.empty;
}

// FIX 2: Enhanced validation for order code
function validateOrderCode(code) {
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

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('pt-BR');
}

// ===========================
// PERSISTENCE & AUTH
// ===========================

// FIX 7: Persistence of login
function saveAuthState(user, type) {
    try {
        const authData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            type: type, // 'client' or 'production'
            timestamp: Date.now()
        };
        localStorage.setItem('imaginatech_auth', JSON.stringify(authData));
    } catch (error) {
        console.error('Error saving auth state:', error);
    }
}

function clearAuthState() {
    try {
        localStorage.removeItem('imaginatech_auth');
    } catch (error) {
        console.error('Error clearing auth state:', error);
    }
}

function getAuthState() {
    try {
        const authData = localStorage.getItem('imaginatech_auth');
        if (authData) {
            const parsed = JSON.parse(authData);
            // Check if auth is less than 7 days old
            if (Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000) {
                return parsed;
            } else {
                clearAuthState();
            }
        }
    } catch (error) {
        console.error('Error getting auth state:', error);
    }
    return null;
}

// ===========================
// CONFIRMATION MODAL FUNCTIONS
// ===========================

function showSedexConfirmation(serviceId) {
    pendingStatusUpdate = { id: serviceId, status: 'concluido' };
    document.getElementById('sedexConfirmModal').classList.add('active');
}

function closeSedexConfirm() {
    document.getElementById('sedexConfirmModal').classList.remove('active');
    pendingStatusUpdate = null;
}

async function confirmSedexCompletion() {
    if (!pendingStatusUpdate) return;
    
    const serviceId = pendingStatusUpdate.id;
    const newStatus = pendingStatusUpdate.status;
    
    closeSedexConfirm();
    
    await executeStatusUpdate(serviceId, newStatus);
    
    const serviceIndex = services.findIndex(s => s.id === serviceId);
    if (serviceIndex !== -1) {
        services[serviceIndex].status = newStatus;
        services[serviceIndex].updatedAt = new Date().toISOString();
        services[serviceIndex].updatedBy = currentUser.email;
    }
    
    renderServices();
    updateStats();
    
    pendingStatusUpdate = null;
}

function showRetiradaConfirmation(serviceId) {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    pendingStatusUpdate = { 
        id: serviceId, 
        status: 'concluido',
        service: service 
    };
    
    const clientName = service.pickupInfo?.name || service.client || 'Cliente';
    document.getElementById('retiradaClientName').textContent = clientName;
    
    document.getElementById('retiradaConfirmModal').classList.add('active');
}

function closeRetiradaConfirm() {
    document.getElementById('retiradaConfirmModal').classList.remove('active');
    pendingStatusUpdate = null;
}

async function confirmRetiradaWithoutWhatsapp() {
    if (!pendingStatusUpdate) return;
    
    const serviceId = pendingStatusUpdate.id;
    const newStatus = pendingStatusUpdate.status;
    
    closeRetiradaConfirm();
    
    await executeStatusUpdate(serviceId, newStatus);
    
    const serviceIndex = services.findIndex(s => s.id === serviceId);
    if (serviceIndex !== -1) {
        services[serviceIndex].status = newStatus;
        services[serviceIndex].updatedAt = new Date().toISOString();
        services[serviceIndex].updatedBy = currentUser.email;
    }
    
    renderServices();
    updateStats();
    
    pendingStatusUpdate = null;
}

async function confirmRetiradaWithWhatsapp() {
    if (!pendingStatusUpdate) return;
    
    const service = pendingStatusUpdate.service;
    const serviceId = pendingStatusUpdate.id;
    const newStatus = pendingStatusUpdate.status;
    
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
    
    await executeStatusUpdate(serviceId, newStatus);
    
    const serviceIndex = services.findIndex(s => s.id === serviceId);
    if (serviceIndex !== -1) {
        services[serviceIndex].status = newStatus;
        services[serviceIndex].updatedAt = new Date().toISOString();
        services[serviceIndex].updatedBy = currentUser.email;
    }
    
    renderServices();
    updateStats();
    
    pendingStatusUpdate = null;
}

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
        
        await db.collection('services').doc(id).update(updates);
        
        const serviceIndex = services.findIndex(s => s.id === id);
        if (serviceIndex !== -1) {
            services[serviceIndex] = { ...services[serviceIndex], ...updates };
        }
        
        showToast('Status atualizado com sucesso!', 'success');
        
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
// MOBILE MENU FUNCTIONS - FIX 3
// ===========================

function toggleMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggle');
    const navbar = document.getElementById('navbar');
    const clientView = document.getElementById('clientView');
    
    toggle.classList.toggle('active');
    navbar.classList.toggle('mobile-menu-open');
    
    // FIX 3: Add padding to content when menu is open
    if (navbar.classList.contains('mobile-menu-open')) {
        clientView.style.paddingTop = '150px';
    } else {
        clientView.style.paddingTop = '100px';
    }
}

function toggleMobileMenuProd() {
    const toggle = document.getElementById('mobileMenuToggleProd');
    const dropdown = document.getElementById('mobileMenuDropdown');
    const mainContainer = document.getElementById('mainContainer');
    
    toggle.classList.toggle('active');
    dropdown.classList.toggle('active');
    
    // FIX 3: Adjust main container padding
    if (dropdown.classList.contains('active')) {
        const dropdownHeight = dropdown.scrollHeight;
        mainContainer.style.marginTop = `${dropdownHeight}px`;
    } else {
        mainContainer.style.marginTop = '0';
    }
    
    if (currentUser) {
        document.getElementById('mobileUserAvatar').src = currentUser.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.displayName || 'User');
        document.getElementById('mobileUserName').textContent = currentUser.displayName || currentUser.email;
    }
    
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

function closeMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggleProd');
    const dropdown = document.getElementById('mobileMenuDropdown');
    const mainContainer = document.getElementById('mainContainer');
    
    toggle.classList.remove('active');
    dropdown.classList.remove('active');
    mainContainer.style.marginTop = '0';
}

// ===========================
// WELCOME SCREEN FUNCTIONS
// ===========================

function openClientLogin() {
    // FIX 7: Check for saved auth first
    const savedAuth = getAuthState();
    if (savedAuth && savedAuth.type === 'client') {
        // Auto-login with saved credentials
        clientUser = savedAuth;
        document.getElementById('clientLoginStep').style.display = 'none';
        document.getElementById('clientCodeStep').style.display = 'block';
        showToast(`Bem-vindo de volta, ${savedAuth.displayName}!`, 'success');
    }
    
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

// FIX 8: Handle Safari sessionStorage issue
async function clientGoogleLogin() {
    try {
        // FIX 8: Use signInWithPopup instead of redirect for Safari
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        
        const result = await auth.signInWithPopup(provider);
        clientUser = result.user;
        
        // FIX 7: Save auth state
        saveAuthState(clientUser, 'client');
        
        await saveClientData(clientUser);
        
        document.getElementById('clientLoginStep').style.display = 'none';
        document.getElementById('clientCodeStep').style.display = 'block';
        
        showToast(`Bem-vindo, ${clientUser.displayName}!`, 'success');
    } catch (error) {
        console.error('Error in client login:', error);
        // FIX 8: Better error handling for Safari
        if (error.code === 'auth/popup-blocked') {
            showToast('Por favor, permita pop-ups para fazer login', 'error');
        } else {
            showToast('Erro ao fazer login. Tente novamente.', 'error');
        }
    }
}

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
        
        // FIX 9: Don't create unnecessary logs
        // Only log important actions
        
    } catch (error) {
        console.error('Error saving client data:', error);
    }
}

async function verifyOrderCode() {
    const code = document.getElementById('orderCode').value.toUpperCase().trim();
    
    // FIX 2: Enhanced validation
    if (!code) {
        showToast('Digite o código do pedido', 'error');
        return;
    }
    
    if (!validateOrderCode(code)) {
        showToast('Código inválido! Use 5 caracteres alfanuméricos', 'error');
        return;
    }
    
    if (!clientUser) {
        showToast('Faça login primeiro', 'error');
        return;
    }
    
    clientAttempts++;
    
    try {
        const snapshot = await db.collection('services')
            .where('orderCode', '==', code)
            .limit(1)
            .get();
        
        if (!snapshot.empty) {
            const service = snapshot.docs[0];
            currentOrderCode = code;
            
            // Update client's order list (without creating logs)
            try {
                await db.collection('clients').doc(clientUser.uid).update({
                    orders: firebase.firestore.FieldValue.arrayUnion(code),
                    lastOrderViewed: code,
                    lastOrderViewedAt: new Date().toISOString()
                });
            } catch (updateError) {
                console.log('Could not update client order list:', updateError);
            }
            
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

function showClientOrder(serviceId, service) {
    currentView = 'client';
    
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('navbar').classList.add('active');
    document.getElementById('clientView').classList.add('active');
    
    document.getElementById('clientName').textContent = clientUser.displayName.split(' ')[0];
    
    const container = document.getElementById('clientOrderCard');
    
    const days = daysRemaining(service.dueDate);
    const daysText = days === 0 ? 'Hoje' : 
                   days === 1 ? 'Amanhã' : 
                   days < 0 ? `${Math.abs(days)} dias atrás` : 
                   `${days} dias`;
    const daysColor = days < 0 ? 'var(--neon-red)' : 
                     days <= 2 ? 'var(--neon-yellow)' : 
                     'var(--secondary-blue)';
    
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
    
    setupClientOrderListener(serviceId);
}

// FIX 9: Optimized listener
function setupClientOrderListener(serviceId) {
    // Cancel previous listener if exists
    if (orderListener) {
        orderListener();
        orderListener = null;
    }
    
    // FIX 1: Debounced updates
    let lastUpdate = null;
    
    orderListener = db.collection('services').doc(serviceId).onSnapshot((doc) => {
        if (doc.exists && currentView === 'client') {
            const service = doc.data();
            
            // FIX 1: Only update if data actually changed
            const currentUpdate = JSON.stringify(service);
            if (currentUpdate !== lastUpdate) {
                lastUpdate = currentUpdate;
                showClientOrder(serviceId, service);
            }
        }
    }, (error) => {
        console.error('Error listening to order updates:', error);
    });
}

function exitToWelcome() {
    currentView = 'welcome';
    currentOrderCode = null;
    
    // FIX 9: Properly cleanup listeners
    if (orderListener) {
        orderListener();
        orderListener = null;
    }
    
    clientUser = null;
    
    // Clear auth state when exiting
    clearAuthState();
    
    if (!isAuthorized && auth.currentUser) {
        auth.signOut().catch(error => {
            console.log('Sign out error:', error);
        });
    }
    
    document.getElementById('navbar').classList.remove('active');
    document.getElementById('clientView').classList.remove('active');
    document.getElementById('header').classList.remove('active');
    document.getElementById('mainContainer').classList.remove('active');
    
    document.getElementById('welcomeScreen').classList.remove('hidden');
    
    closeMobileMenu();
}

// ===========================
// PRODUCTION FUNCTIONS
// ===========================

// FIX 7 & 8: Enhanced production login
async function openProductionLogin() {
    try {
        // Check for saved auth first
        const savedAuth = getAuthState();
        if (savedAuth && savedAuth.type === 'production' && AUTHORIZED_EMAILS.includes(savedAuth.email)) {
            // Verify the user is still authorized
            currentUser = savedAuth;
            isAuthorized = true;
            currentView = 'production';
            
            document.getElementById('welcomeScreen').classList.add('hidden');
            document.getElementById('header').classList.add('active');
            document.getElementById('mainContainer').classList.add('active');
            
            updateUIForUser(savedAuth);
            showToast(`Bem-vindo de volta, ${savedAuth.displayName}!`, 'success');
            return;
        }
        
        // FIX 8: Use popup for Safari compatibility
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        if (AUTHORIZED_EMAILS.includes(user.email)) {
            currentUser = user;
            isAuthorized = true;
            currentView = 'production';
            
            // FIX 7: Save auth state
            saveAuthState(user, 'production');
            
            document.getElementById('welcomeScreen').classList.add('hidden');
            document.getElementById('header').classList.add('active');
            document.getElementById('mainContainer').classList.add('active');
            
            updateUIForUser(user);
            
            showToast(`Bem-vindo ao módulo de produção, ${user.displayName}!`, 'success');
        } else {
            await auth.signOut();
            clearAuthState();
            showToast(`Acesso negado! Email ${user.email} não autorizado.`, 'error');
        }
    } catch (error) {
        console.error('Error in production login:', error);
        // FIX 8: Better error handling
        if (error.code === 'auth/popup-blocked') {
            showToast('Por favor, permita pop-ups para fazer login', 'error');
        } else {
            showToast('Erro ao fazer login', 'error');
        }
    }
}

async function signOut() {
    try {
        // FIX 9: Clean up all listeners
        if (productionListener) {
            productionListener();
            productionListener = null;
        }
        if (orderListener) {
            orderListener();
            orderListener = null;
        }
        
        await auth.signOut();
        clearAuthState();
        currentUser = null;
        isAuthorized = false;
        exitToWelcome();
        showToast('Logout realizado com sucesso', 'success');
    } catch (error) {
        console.error('Error signing out:', error);
    }
}

function updateUIForUser(user) {
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('userAvatar').src = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || 'User');
    document.getElementById('userName').textContent = user.displayName || user.email;
    
    renderServices();
}

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

function toggleDeliveryFields() {
    const method = document.getElementById('deliveryMethod').value;
    const deliveryFields = document.getElementById('deliveryFields');
    const pickupFields = document.getElementById('pickupFields');
    
    deliveryFields.classList.remove('active');
    pickupFields.classList.remove('active');
    
    const deliveryInputs = deliveryFields.querySelectorAll('input, select, textarea');
    const pickupInputs = pickupFields.querySelectorAll('input');
    
    deliveryInputs.forEach(input => input.required = false);
    pickupInputs.forEach(input => input.required = false);
    
    if (method === 'sedex') {
        deliveryFields.classList.add('active');
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
        document.getElementById('pickupName').required = true;
        document.getElementById('pickupWhatsapp').required = true;
    }
}

// FIX 2: Enhanced WhatsApp validation
function formatWhatsApp(input) {
    let value = input.value.replace(/\D/g, '');
    
    // Limit to 11 digits
    value = value.substring(0, 11);
    
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

// FIX 2: Enhanced CPF/CNPJ validation
function formatCpfCnpj(input) {
    let value = input.value.replace(/\D/g, '');
    
    // Limit to 14 digits (CNPJ max)
    value = value.substring(0, 14);
    
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

// FIX 2: Enhanced CEP validation
function formatCEP(input) {
    let value = input.value.replace(/\D/g, '');
    value = value.substring(0, 8);
    
    if (value.length > 5) {
        value = value.slice(0, 5) + '-' + value.slice(5, 8);
    }
    input.value = value;
}

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

function openAddModal() {
    if (!isAuthorized) {
        showToast('Você não tem permissão para adicionar serviços', 'error');
        return;
    }
    
    editingServiceId = null;
    document.getElementById('modalTitle').textContent = 'Novo Serviço';
    document.getElementById('saveButtonText').textContent = 'Salvar Serviço';
    document.getElementById('serviceForm').reset();
    document.getElementById('serviceOrderCode').value = '';
    
    // FIX 5: Set current date correctly
    const today = new Date();
    const todayString = getLocalDateString(today.toISOString().split('T')[0]);
    document.getElementById('startDate').value = todayString;
    
    document.getElementById('deliveryFields').classList.remove('active');
    document.getElementById('pickupFields').classList.remove('active');
    document.getElementById('orderCodeDisplay').style.display = 'none';
    document.getElementById('serviceModal').classList.add('active');
    
    closeMobileMenu();
}

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
    
    document.getElementById('serviceOrderCode').value = service.orderCode || '';
    document.getElementById('serviceNameInput').value = service.name;
    document.getElementById('clientNameInput').value = service.client;
    document.getElementById('serviceDescription').value = service.description || '';
    document.getElementById('serviceMaterial').value = service.material || '';
    document.getElementById('serviceColor').value = service.color || '';
    document.getElementById('servicePriority').value = service.priority;
    
    // FIX 5: Handle dates correctly
    document.getElementById('startDate').value = service.startDate;
    document.getElementById('dueDate').value = service.dueDate;
    document.getElementById('deliveryMethod').value = service.deliveryMethod || '';
    
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

function closeModal() {
    document.getElementById('serviceModal').classList.remove('active');
    document.getElementById('serviceForm').reset();
    document.getElementById('deliveryFields').classList.remove('active');
    document.getElementById('pickupFields').classList.remove('active');
    document.getElementById('orderCodeDisplay').style.display = 'none';
    editingServiceId = null;
}

// FIX 2 & 5: Enhanced save with validations
async function saveService(event) {
    event.preventDefault();
    
    if (!isAuthorized) {
        showToast('Você não tem permissão para salvar serviços', 'error');
        return;
    }
    
    const serviceName = document.getElementById('serviceNameInput').value.trim();
    const clientName = document.getElementById('clientNameInput').value.trim();
    let orderCode = document.getElementById('serviceOrderCode').value.toUpperCase().trim();
    
    // FIX 2: Enhanced validation
    if (!serviceName || !clientName) {
        showToast('Por favor, preencha todos os campos obrigatórios', 'error');
        return;
    }
    
    if (serviceName.length < 3 || clientName.length < 3) {
        showToast('Nome do serviço e cliente devem ter pelo menos 3 caracteres', 'error');
        return;
    }
    
    if (orderCode && !validateOrderCode(orderCode)) {
        showToast('Código inválido! Use apenas 5 caracteres alfanuméricos', 'error');
        return;
    }
    
    if (orderCode && !(await isCodeUnique(orderCode))) {
        showToast('Este código já existe! Use outro código', 'error');
        return;
    }
    
    const deliveryMethod = document.getElementById('deliveryMethod').value;
    
    // FIX 2: Validate delivery method
    if (!deliveryMethod) {
        showToast('Por favor, selecione um método de entrega', 'error');
        return;
    }
    
    // FIX 5: Get dates correctly
    const startDate = document.getElementById('startDate').value;
    const dueDate = document.getElementById('dueDate').value;
    
    if (!startDate || !dueDate) {
        showToast('Por favor, preencha as datas', 'error');
        return;
    }
    
    // FIX 5: Validate dates
    if (new Date(dueDate) < new Date(startDate)) {
        showToast('A data de entrega não pode ser anterior à data de entrada', 'error');
        return;
    }
    
    const service = {
        name: serviceName,
        client: clientName,
        description: document.getElementById('serviceDescription').value.trim(),
        material: document.getElementById('serviceMaterial').value,
        color: document.getElementById('serviceColor').value,
        priority: document.getElementById('servicePriority').value,
        startDate: startDate,
        dueDate: dueDate,
        status: editingServiceId ? 
            services.find(s => s.id === editingServiceId)?.status || 'pendente' : 
            'pendente',
        deliveryMethod: deliveryMethod,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.email
    };
    
    // FIX 2: Enhanced validation for delivery fields
    if (deliveryMethod === 'sedex') {
        const clientEmail = document.getElementById('email').value.trim();
        const clientNameDelivery = document.getElementById('fullName').value.trim();
        const telefone = document.getElementById('telefone').value.trim();
        const cpfCnpj = document.getElementById('cpfCnpj').value.trim();
        
        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(clientEmail)) {
            showToast('Email inválido', 'error');
            return;
        }
        
        // Validate phone
        const phoneDigits = telefone.replace(/\D/g, '');
        if (phoneDigits.length !== 10 && phoneDigits.length !== 11) {
            showToast('Telefone inválido', 'error');
            return;
        }
        
        // Validate CPF/CNPJ
        const cpfCnpjDigits = cpfCnpj.replace(/\D/g, '');
        if (cpfCnpjDigits.length !== 11 && cpfCnpjDigits.length !== 14) {
            showToast('CPF/CNPJ inválido', 'error');
            return;
        }
        
        // Save marketing contact (FIX 9: Only save, don't create logs)
        if (clientEmail) {
            try {
                await db.collection('marketing_contacts').doc(clientEmail).set({
                    email: clientEmail,
                    name: clientNameDelivery,
                    phone: telefone,
                    cpfCnpj: cpfCnpj,
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
            cpfCnpj: cpfCnpj,
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
        const pickupName = document.getElementById('pickupName').value.trim();
        const pickupWhatsapp = document.getElementById('pickupWhatsapp').value.trim();
        
        // FIX 2: Validate pickup fields
        if (!pickupName || pickupName.length < 3) {
            showToast('Nome para retirada deve ter pelo menos 3 caracteres', 'error');
            return;
        }
        
        const whatsappDigits = pickupWhatsapp.replace(/\D/g, '');
        if (whatsappDigits.length !== 10 && whatsappDigits.length !== 11) {
            showToast('WhatsApp inválido', 'error');
            return;
        }
        
        service.pickupInfo = {
            name: pickupName,
            whatsapp: pickupWhatsapp
        };
    }

    try {
        if (editingServiceId) {
            service.orderCode = orderCode || services.find(s => s.id === editingServiceId)?.orderCode;
            
            if (!service.orderCode) {
                service.orderCode = await generateUniqueCode();
            }
            
            await db.collection('services').doc(editingServiceId).update(service);
            showToast('Serviço atualizado com sucesso!', 'success');
            closeModal();
        } else {
            service.createdAt = new Date().toISOString();
            service.orderCode = orderCode || await generateUniqueCode();
            service.createdBy = currentUser.email;
            
            await db.collection('services').add(service);
            
            document.getElementById('orderCodeDisplay').style.display = 'block';
            document.getElementById('orderCodeValue').textContent = service.orderCode;
            
            showToast(`Serviço criado! Código: ${service.orderCode}`, 'success');
            
            setTimeout(() => {
                closeModal();
            }, 3000);
        }
    } catch (error) {
        console.error('Error saving service:', error);
        showToast('Erro ao salvar serviço: ' + error.message, 'error');
    }
}

async function updateStatus(id, status) {
    if (!isAuthorized) {
        showToast('Você não tem permissão para atualizar status', 'error');
        return;
    }
    
    const service = services.find(s => s.id === id);
    if (!service) return;
    
    if (status === 'concluido') {
        if (service.deliveryMethod === 'sedex') {
            showSedexConfirmation(id);
            return;
        } else if (service.deliveryMethod === 'retirada' && service.pickupInfo) {
            showRetiradaConfirmation(id);
            return;
        }
    }
    
    await executeStatusUpdate(id, status);
    
    const serviceIndex = services.findIndex(s => s.id === id);
    if (serviceIndex !== -1) {
        services[serviceIndex].status = status;
        services[serviceIndex].updatedAt = new Date().toISOString();
        services[serviceIndex].updatedBy = currentUser.email;
    }
    
    renderServices();
    updateStats();
}

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
    
    if (service.deliveryMethod === 'retirada' && service.pickupInfo) {
        const pickup = service.pickupInfo;
        const whatsappNumber = pickup.whatsapp.replace(/\D/g, '');
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

function closeDeliveryModal() {
    document.getElementById('deliveryInfoModal').classList.remove('active');
}

// ===========================
// DATA LOADING & RENDERING
// ===========================

// FIX 9: Single load function without creating listeners
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

// FIX 9: Optimized real-time listener
function setupProductionListener() {
    // Clean up existing listener
    if (productionListener) {
        productionListener();
        productionListener = null;
    }
    
    // FIX 1: Debounce updates
    let updateTimeout = null;
    
    productionListener = db.collection('services').onSnapshot((snapshot) => {
        // Clear existing timeout
        if (updateTimeout) {
            clearTimeout(updateTimeout);
        }
        
        // Debounce the update
        updateTimeout = setTimeout(() => {
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
        }, 500); // Wait 500ms before updating
        
    }, (error) => {
        console.error('Real-time update error:', error);
        updateConnectionStatus(false);
    });
}

function filterServices(filter) {
    currentFilter = filter;
    
    document.querySelectorAll('.stat-card').forEach(card => {
        card.classList.remove('active');
    });
    document.getElementById(`filter-${filter}`).classList.add('active');
    
    renderServices();
}

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

function renderServices() {
    const grid = document.getElementById('servicesGrid');
    const emptyState = document.getElementById('emptyState');
    
    let filteredServices = services;
    
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

function hideLoading() {
    setTimeout(() => {
        document.getElementById('loadingOverlay').style.display = 'none';
    }, 1000);
}

// FIX 6: Reduced particle count for better performance
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 15; // Reduced from 30
    
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

// FIX 7: Check for saved auth on load
window.addEventListener('DOMContentLoaded', () => {
    createParticles();
    
    // FIX 7: Check for saved auth
    const savedAuth = getAuthState();
    if (savedAuth) {
        if (savedAuth.type === 'production' && AUTHORIZED_EMAILS.includes(savedAuth.email)) {
            // Auto-login to production
            currentUser = savedAuth;
            isAuthorized = true;
            currentView = 'production';
            
            document.getElementById('welcomeScreen').classList.add('hidden');
            document.getElementById('header').classList.add('active');
            document.getElementById('mainContainer').classList.add('active');
            
            updateUIForUser(savedAuth);
            loadServices();
            setupProductionListener();
        }
    } else {
        loadServices();
        setupProductionListener();
    }
    
    hideLoading();
    
    // Add format listeners with debounce
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
    
    const orderCodeInput = document.getElementById('orderCode');
    if (orderCodeInput) {
        orderCodeInput.addEventListener('input', function() {
            this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
        });
    }
    
    const serviceOrderCodeInput = document.getElementById('serviceOrderCode');
    if (serviceOrderCodeInput) {
        serviceOrderCodeInput.addEventListener('input', function() {
            this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
        });
    }
    
    window.addEventListener('online', () => updateConnectionStatus(true));
    window.addEventListener('offline', () => updateConnectionStatus(false));
});

// FIX 8: Handle auth state changes
auth.onAuthStateChanged((user) => {
    if (user && currentView === 'production' && AUTHORIZED_EMAILS.includes(user.email)) {
        currentUser = user;
        updateUIForUser(user);
    }
});
