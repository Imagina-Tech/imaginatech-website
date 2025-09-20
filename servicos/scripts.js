/* 
==================================================
ARQUIVO: servicos/scripts.js
MÓDULO: Serviços/Produção (Painel Administrativo)
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 2.1 - Complete Fixed
IMPORTANTE: NÃO REMOVER ESTE CABEÇALHO DE IDENTIFICAÇÃO
==================================================
*/

// ===========================
// FIREBASE CONFIGURATION
// ===========================
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

// ===========================
// GLOBAL VARIABLES
// ===========================
let db = null;
let auth = null;
let storage = null;
let services = [];
let currentFilter = 'todos';
let editingServiceId = null;
let currentUser = null;
let isAuthorized = false;
let servicesListener = null;
let pendingStatusUpdate = null;
let currentActiveCard = null;
let selectedFile = null;
let selectedImage = null;

// ===========================
// INITIALIZATION
// ===========================
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    storage = firebase.storage();
} catch (error) {
    console.error('Erro ao inicializar Firebase:', error);
    alert('Erro ao conectar com o servidor. Recarregue a página.');
}

// DOM Ready Handler
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMReady);
} else {
    onDOMReady();
}

function onDOMReady() {
    if (!auth) {
        console.error('Auth não está disponível');
        hideLoadingOverlay();
        alert('Erro ao inicializar autenticação. Recarregue a página.');
        return;
    }
    
    // Auth state observer
    auth.onAuthStateChanged((user) => {
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
        console.error('Erro no auth state:', error);
        hideLoadingOverlay();
        showLoginScreen();
    });
    
    // Setup date fields
    setupDateFields();
    
    // Setup phone formatting
    const phoneInput = document.getElementById('clientPhone');
    if (phoneInput) {
        phoneInput.addEventListener('input', formatPhoneNumber);
    }
    
    // Setup pickup phone formatting
    const pickupPhoneInput = document.getElementById('pickupWhatsapp');
    if (pickupPhoneInput) {
        pickupPhoneInput.addEventListener('input', formatPhoneNumber);
    }
    
    // Setup CEP formatting
    const cepInput = document.getElementById('cep');
    if (cepInput) {
        cepInput.addEventListener('input', formatCEP);
    }
    
    // Monitor connection
    monitorConnection();
}

// ===========================
// DATE UTILITIES - CORREÇÃO BRASIL
// ===========================
function getTodayBrazil() {
    const now = new Date();
    // Ajusta para o horário de Brasília (UTC-3)
    const brazilOffset = -3 * 60; // -3 horas em minutos
    const localOffset = now.getTimezoneOffset();
    const totalOffset = (localOffset + brazilOffset) * 60 * 1000;
    
    const brazilTime = new Date(now.getTime() - totalOffset);
    brazilTime.setHours(0, 0, 0, 0);
    
    // Retorna no formato YYYY-MM-DD
    const year = brazilTime.getFullYear();
    const month = String(brazilTime.getMonth() + 1).padStart(2, '0');
    const day = String(brazilTime.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

function parseDateBrazil(dateString) {
    if (!dateString) return null;
    
    // Parse a date string and ensure it's at 00:00:00 Brazil time
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0); // Set to noon to avoid timezone issues
    
    return date;
}

function calculateDaysRemaining(dueDate) {
    if (!dueDate) return null;
    
    const due = parseDateBrazil(dueDate);
    const today = parseDateBrazil(getTodayBrazil());
    
    if (!due || !today) return null;
    
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
}

// ===========================
// UI UTILITIES
// ===========================
function hideLoadingOverlay() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}

function setupDateFields() {
    const today = getTodayBrazil();
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
    
    if (dueDateInput) {
        dueDateInput.value = today;
    }
}

// ===========================
// FILE HANDLING
// ===========================
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) {
        selectedFile = null;
        return;
    }
    
    // Verificar extensão
    const validExtensions = ['.stl', '.obj', '.step', '.stp', '.3mf'];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
        showToast('Formato de arquivo inválido. Use: STL, OBJ, STEP ou 3MF', 'error');
        event.target.value = '';
        selectedFile = null;
        return;
    }
    
    // Verificar tamanho (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
        showToast('Arquivo muito grande. Máximo: 50MB', 'error');
        event.target.value = '';
        selectedFile = null;
        return;
    }
    
    selectedFile = file;
    
    // Mostrar info do arquivo
    const fileInfo = document.getElementById('fileInfo');
    const fileName2 = document.getElementById('fileName');
    if (fileInfo && fileName2) {
        fileName2.textContent = file.name;
        fileInfo.style.display = 'flex';
    }
}

function removeFile() {
    selectedFile = null;
    const fileInput = document.getElementById('serviceFile');
    const fileInfo = document.getElementById('fileInfo');
    
    if (fileInput) fileInput.value = '';
    if (fileInfo) fileInfo.style.display = 'none';
    
    // Se estiver editando, limpar o arquivo atual
    const currentFileUrl = document.getElementById('currentFileUrl');
    const currentFileName = document.getElementById('currentFileName');
    if (currentFileUrl) currentFileUrl.value = '';
    if (currentFileName) currentFileName.value = '';
}

function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) {
        selectedImage = null;
        return;
    }
    
    // Verificar se é imagem
    if (!file.type.startsWith('image/')) {
        showToast('Por favor, selecione uma imagem', 'error');
        event.target.value = '';
        selectedImage = null;
        return;
    }
    
    // Verificar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Imagem muito grande. Máximo: 5MB', 'error');
        event.target.value = '';
        selectedImage = null;
        return;
    }
    
    selectedImage = file;
    
    // Mostrar preview
    const reader = new FileReader();
    reader.onload = function(e) {
        const imagePreview = document.getElementById('imagePreview');
        const previewImg = document.getElementById('previewImg');
        if (imagePreview && previewImg) {
            previewImg.src = e.target.result;
            imagePreview.style.display = 'block';
        }
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    selectedImage = null;
    const imageInput = document.getElementById('serviceImage');
    const imagePreview = document.getElementById('imagePreview');
    
    if (imageInput) imageInput.value = '';
    if (imagePreview) imagePreview.style.display = 'none';
    
    // Se estiver editando, limpar a imagem atual
    const currentImageUrl = document.getElementById('currentImageUrl');
    if (currentImageUrl) currentImageUrl.value = '';
}

async function uploadFile(file, serviceId) {
    if (!file || !storage) return null;
    
    try {
        const timestamp = Date.now();
        const fileName = `${serviceId}_${timestamp}_${file.name}`;
        const storageRef = storage.ref(`services/${serviceId}/${fileName}`);
        
        const snapshot = await storageRef.put(file);
        const downloadURL = await snapshot.ref.getDownloadURL();
        
        return {
            url: downloadURL,
            name: file.name,
            size: file.size,
            uploadedAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('Erro ao fazer upload:', error);
        showToast('Erro ao fazer upload do arquivo', 'error');
        return null;
    }
}

function downloadFile(url, fileName) {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'arquivo';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ===========================
// DATE UNDEFINED TOGGLE - CORRIGIDO
// ===========================
function toggleDateInput() {
    const dateInput = document.getElementById('dueDate'); // CORRIGIDO: era 'deliveryDate'
    const checkbox = document.getElementById('dateUndefined');
    
    if (dateInput && checkbox) {
        if (checkbox.checked) {
            dateInput.disabled = true;
            dateInput.value = '';
            dateInput.required = false;
        } else {
            dateInput.disabled = false;
            dateInput.required = true;
            dateInput.value = getTodayBrazil();
        }
    }
}

// ===========================
// AUTHENTICATION
// ===========================
async function signInWithGoogle() {
    if (!auth) {
        showToast('Sistema não está pronto. Recarregue a página.', 'error');
        return;
    }
    
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        if (!AUTHORIZED_EMAILS.includes(user.email)) {
            await auth.signOut();
            showToast(`Acesso negado! O email ${user.email} não está autorizado.`, 'error');
            return;
        }
        
        currentUser = user;
        isAuthorized = true;
        showToast(`Bem-vindo, ${user.displayName}!`, 'success');
        
    } catch (error) {
        console.error('Erro no login:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            showToast('Login cancelado', 'info');
        } else {
            showToast('Erro ao fazer login. Tente novamente.', 'error');
        }
    }
}

async function signOut() {
    try {
        if (auth) {
            await auth.signOut();
            showToast('Logout realizado com sucesso!', 'info');
        }
    } catch (error) {
        console.error('Erro no logout:', error);
        showToast('Erro ao fazer logout.', 'error');
    }
}

function checkAuthorization(user) {
    if (AUTHORIZED_EMAILS.includes(user.email)) {
        isAuthorized = true;
        showAdminDashboard(user);
        startServicesListener();
    } else {
        isAuthorized = false;
        auth.signOut();
        showToast('Acesso negado! Email não autorizado.', 'error');
        showLoginScreen();
    }
}

// ===========================
// UI MANAGEMENT
// ===========================
function showLoginScreen() {
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
    const loginScreen = document.getElementById('loginScreen');
    const adminDashboard = document.getElementById('adminDashboard');
    
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
    if (!db) {
        console.error('Firestore não está disponível');
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
            
            // Sort by creation date
            services.sort((a, b) => {
                const dateA = new Date(a.createdAt || 0);
                const dateB = new Date(b.createdAt || 0);
                return dateB - dateA;
            });
            
            updateStats();
            renderServices();
            
        }, (error) => {
            console.error('Erro ao carregar serviços:', error);
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
    
    const deliveryMethod = document.getElementById('deliveryMethod').value;
    const dateUndefined = document.getElementById('dateUndefined');
    const dueDateInput = document.getElementById('dueDate');
    
    if (!deliveryMethod) {
        showToast('Por favor, selecione um método de entrega', 'error');
        return;
    }
    
    const service = {
        name: document.getElementById('serviceName').value.trim(),
        client: document.getElementById('clientName').value.trim(),
        clientEmail: document.getElementById('clientEmail').value.trim() || null,
        clientPhone: document.getElementById('clientPhone').value.trim() || null,
        description: document.getElementById('serviceDescription').value.trim() || null,
        material: document.getElementById('serviceMaterial').value,
        color: document.getElementById('serviceColor').value || null,
        priority: document.getElementById('servicePriority').value,
        startDate: document.getElementById('startDate').value,
        dueDate: dateUndefined && dateUndefined.checked ? null : dueDateInput.value,
        dateUndefined: dateUndefined ? dateUndefined.checked : false,
        value: parseFloat(document.getElementById('serviceValue').value) || null,
        weight: parseFloat(document.getElementById('serviceWeight').value) || null,
        observations: document.getElementById('serviceObservations').value.trim() || null,
        deliveryMethod: deliveryMethod,
        status: document.getElementById('serviceStatus').value,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.email
    };
    
    // Validate dates if not undefined
    if (!service.dateUndefined && service.dueDate) {
        const startDate = parseDateBrazil(service.startDate);
        const dueDate = parseDateBrazil(service.dueDate);
        
        if (dueDate < startDate) {
            showToast('A data de entrega não pode ser anterior à data de início', 'error');
            return;
        }
    }
    
    // Handle delivery method specific fields
    if (deliveryMethod === 'retirada') {
        const pickupName = document.getElementById('pickupName').value.trim();
        const pickupWhatsapp = document.getElementById('pickupWhatsapp').value.trim();
        
        if (!pickupName || !pickupWhatsapp) {
            showToast('Preencha todos os campos de retirada', 'error');
            return;
        }
        
        service.pickupInfo = {
            name: pickupName,
            whatsapp: pickupWhatsapp
        };
    } else if (deliveryMethod === 'sedex') {
        const deliveryAddress = {
            fullName: document.getElementById('fullName').value.trim(),
            cpfCnpj: document.getElementById('cpfCnpj').value.trim(),
            email: document.getElementById('email').value.trim(),
            telefone: document.getElementById('telefone').value.trim(),
            cep: document.getElementById('cep').value.trim(),
            estado: document.getElementById('estado').value.trim(),
            cidade: document.getElementById('cidade').value.trim(),
            bairro: document.getElementById('bairro').value.trim(),
            rua: document.getElementById('rua').value.trim(),
            numero: document.getElementById('numero').value.trim(),
            complemento: document.getElementById('complemento').value.trim() || null
        };
        
        // Validate required fields
        const requiredFields = ['fullName', 'cpfCnpj', 'email', 'telefone', 'cep', 'estado', 'cidade', 'bairro', 'rua', 'numero'];
        for (const field of requiredFields) {
            if (!deliveryAddress[field]) {
                showToast('Preencha todos os campos obrigatórios de entrega', 'error');
                return;
            }
        }
        
        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(deliveryAddress.email)) {
            showToast('E-mail inválido', 'error');
            return;
        }
        
        service.deliveryAddress = deliveryAddress;
    }
    
    try {
        let serviceDocId = editingServiceId;
        
        if (editingServiceId) {
            // Preservar arquivos existentes se não houver mudanças
            const currentFileUrl = document.getElementById('currentFileUrl');
            const currentFileName = document.getElementById('currentFileName');
            const currentImageUrl = document.getElementById('currentImageUrl');
            
            if (currentFileUrl && currentFileUrl.value && !selectedFile) {
                service.fileUrl = currentFileUrl.value;
                service.fileName = currentFileName.value;
            }
            
            if (currentImageUrl && currentImageUrl.value && !selectedImage) {
                service.imageUrl = currentImageUrl.value;
            }
            
            await db.collection('services').doc(editingServiceId).update(service);
            showToast('Serviço atualizado com sucesso!', 'success');
        } else {
            service.createdAt = new Date().toISOString();
            service.createdBy = currentUser.email;
            service.orderCode = generateOrderCode();
            service.serviceId = 'SRV-' + Date.now();
            
            const docRef = await db.collection('services').add(service);
            serviceDocId = docRef.id;
            
            // Show order code
            document.getElementById('orderCodeDisplay').style.display = 'block';
            document.getElementById('orderCodeValue').textContent = service.orderCode;
            
            showToast(`Serviço criado! Código: ${service.orderCode}`, 'success');
            
            // Send WhatsApp notification if phone exists
            if (service.clientPhone) {
                const dueDateText = service.dateUndefined ? 'A definir' : formatDate(service.dueDate);
                const message = `Olá ${service.client}! Seu pedido foi registrado com sucesso.\n\n` +
                    `🔹 Serviço: ${service.name}\n` +
                    `🔹 Código: ${service.orderCode}\n` +
                    `🔹 Prazo: ${dueDateText}\n` +
                    `🔹 Entrega: ${getDeliveryMethodName(service.deliveryMethod)}\n\n` +
                    `Acompanhe seu pedido em:\nhttps://imaginatech.com.br/acompanhar-pedido/`;
                sendWhatsAppMessage(service.clientPhone, message);
            }
        }
        
        // Upload de arquivos se houver
        if (selectedFile && serviceDocId) {
            const fileData = await uploadFile(selectedFile, serviceDocId);
            if (fileData) {
                await db.collection('services').doc(serviceDocId).update({
                    fileUrl: fileData.url,
                    fileName: fileData.name,
                    fileSize: fileData.size,
                    fileUploadedAt: fileData.uploadedAt
                });
            }
        }
        
        if (selectedImage && serviceDocId) {
            const imageData = await uploadFile(selectedImage, serviceDocId);
            if (imageData) {
                await db.collection('services').doc(serviceDocId).update({
                    imageUrl: imageData.url,
                    imageUploadedAt: imageData.uploadedAt
                });
            }
        }
        
        // Clear form after 3 seconds if creating new
        if (!editingServiceId) {
            setTimeout(() => {
                closeModal();
            }, 3000);
        } else {
            closeModal();
        }
        
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showToast('Erro ao salvar serviço', 'error');
    }
}


// ===========================
// TRACKING CODE HANDLING
// ===========================
function showTrackingCodeModal() {
    const modal = document.getElementById('trackingModal');
    if (modal) {
        modal.classList.add('active');
        const input = document.getElementById('trackingCode');
        if (input) {
            input.value = '';
            input.focus();
        }
    }
}

function closeTrackingModal() {
    const modal = document.getElementById('trackingModal');
    if (modal) modal.classList.remove('active');
    pendingStatusUpdate = null;
}

async function confirmTrackingCode() {
    const trackingInput = document.getElementById('trackingCode');
    if (!trackingInput || !trackingInput.value.trim()) {
        showToast('Por favor, insira o código de rastreio', 'error');
        return;
    }
    
    if (!pendingStatusUpdate) return;
    
    const { serviceId, service } = pendingStatusUpdate;
    const trackingCode = trackingInput.value.trim().toUpperCase();
    
    try {
        await db.collection('services').doc(serviceId).update({
            status: 'retirada', // Status POSTADO
            trackingCode: trackingCode,
            postedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.email
        });
        
        showToast('Pedido marcado como postado com sucesso!', 'success');
        
        // Send WhatsApp with tracking code
        if (service.clientPhone) {
            const message = `📦 Seu pedido foi postado nos Correios!\n\n` +
                `📦 ${service.name}\n` +
                `📖 Código do pedido: ${service.orderCode}\n` +
                `🔍 Código de rastreio: ${trackingCode}\n\n` +
                `Acompanhe pelo site dos Correios:\n` +
                `https://rastreamento.correios.com.br/app/index.php\n\n` +
                `Prazo estimado: 3-7 dias úteis`;
            sendWhatsAppMessage(service.clientPhone, message);
        }
        
    } catch (error) {
        console.error('Erro ao atualizar status:', error);
        showToast('Erro ao atualizar status', 'error');
    }
    
    closeTrackingModal();
}

async function updateStatus(serviceId, newStatus) {
    if (!isAuthorized) {
        showToast('Você não tem permissão para esta ação', 'error');
        return;
    }
    
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    // If status is the same, do nothing
    if (service.status === newStatus) return;
    
    // Special handling for SEDEX orders going to "retirada" (POSTADO)
    if (service.deliveryMethod === 'sedex' && newStatus === 'retirada' && !service.trackingCode) {
        pendingStatusUpdate = { serviceId, newStatus, service };
        showTrackingCodeModal();
        return;
    }
    
    pendingStatusUpdate = { serviceId, newStatus, service };
    
    const statusMessages = {
        'pendente': 'Marcar como Pendente',
        'producao': 'Iniciar Produção',
        'concluido': 'Marcar como Concluído',
        'retirada': service.deliveryMethod === 'sedex' ? 'Marcar como Postado' : 'Pronto para Retirada',
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
        showToast('Status atualizado com sucesso!', 'success');
        
        if (sendWhatsapp && service.clientPhone) {
            let message = '';
            
            if (newStatus === 'producao') {
                message = `✅ Ótima notícia! Iniciamos a produção do seu pedido:\n\n📦 ${service.name}\n📖 Código: ${service.orderCode}\n\nAcompanhe: https://imaginatech.com.br`;
            } else if (newStatus === 'retirada') {
                if (service.deliveryMethod === 'retirada') {
                    message = `🎉 Seu pedido está PRONTO para retirada!\n\n📦 ${service.name}\n📖 Código: ${service.orderCode}\n\nVenha buscar seu pedido!`;
                } else if (service.deliveryMethod === 'sedex' && service.trackingCode) {
                    message = `📦 Seu pedido foi postado nos Correios!\n\n📦 ${service.name}\n📖 Código: ${service.orderCode}\n🔍 Rastreio: ${service.trackingCode}`;
                } else {
                    message = `🎉 Seu pedido está PRONTO!\n\n📦 ${service.name}\n📖 Código: ${service.orderCode}`;
                }
            } else if (newStatus === 'entregue') {
                message = `✅ Pedido entregue com sucesso!\n\n📦 ${service.name}\n📖 Código: ${service.orderCode}\n\nObrigado pela preferência! 😊`;
            }
            
            if (message) {
                sendWhatsAppMessage(service.clientPhone, message);
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
    
    // Filter services based on current filter
    if (currentFilter === 'todos') {
        // Show all EXCEPT delivered
        filteredServices = filteredServices.filter(s => s.status !== 'entregue');
    } else {
        filteredServices = filteredServices.filter(s => s.status === currentFilter);
    }
    
    // Sort by priority and date
    filteredServices.sort((a, b) => {
        const priorityOrder = { urgente: 4, alta: 3, media: 2, baixa: 1 };
        const aPriority = priorityOrder[a.priority] || 0;
        const bPriority = priorityOrder[b.priority] || 0;
        
        if (aPriority !== bPriority) {
            return bPriority - aPriority;
        }
        
        // Se uma data for indefinida, coloca por último
        if (a.dateUndefined && !b.dateUndefined) return 1;
        if (!a.dateUndefined && b.dateUndefined) return -1;
        if (a.dateUndefined && b.dateUndefined) return 0;
        
        return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
    });
    
    if (filteredServices.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
        
        const emptyText = document.getElementById('emptyText');
        if (emptyText) {
            if (currentFilter === 'todos') {
                emptyText.textContent = 'Nenhum serviço ativo encontrado';
            } else {
                emptyText.textContent = `Nenhum serviço ${getStatusLabel(currentFilter).toLowerCase()} encontrado`;
            }
        }
    } else {
        grid.style.display = 'grid';
        emptyState.style.display = 'none';
        
        grid.innerHTML = filteredServices.map(service => {
            const days = service.dateUndefined ? null : calculateDaysRemaining(service.dueDate);
            const daysText = service.dateUndefined ? 'Data a definir' : formatDaysText(days);
            const daysColor = service.dateUndefined ? 'var(--neon-yellow)' : getDaysColor(days);
            
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
                    
                    ${service.imageUrl ? `
                    <div class="service-image">
                        <img src="${service.imageUrl}" alt="Imagem do serviço" onclick="window.open('${service.imageUrl}', '_blank')">
                    </div>
                    ` : ''}
                    
                    ${service.deliveryMethod ? `
                    <div class="delivery-badge">
                        <i class="fas ${getDeliveryIcon(service.deliveryMethod)}"></i>
                        ${getDeliveryMethodName(service.deliveryMethod)}
                        ${service.trackingCode ? ` - ${service.trackingCode}` : ''}
                    </div>
                    ` : ''}
                    
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
                        ${service.weight ? `
                        <div class="info-item">
                            <i class="fas fa-weight"></i>
                            <span>${service.weight}g</span>
                        </div>
                        ` : ''}
                        ${service.fileUrl ? `
                        <div class="info-item">
                            <button class="btn-download" onclick="downloadFile('${service.fileUrl}', '${escapeHtml(service.fileName || 'arquivo')}')" title="Baixar arquivo">
                                <i class="fas fa-download"></i>
                                <span>${escapeHtml(service.fileName || 'Arquivo')}</span>
                            </button>
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
                                ${service.deliveryMethod === 'sedex' ? 'Postado' : 'Retirada'}
                            </button>
                            <button class="status-btn ${service.status === 'entregue' ? 'active' : ''}" 
                                    onclick="updateStatus('${service.id}', 'entregue')"
                                    ${service.status === 'entregue' ? 'disabled' : ''}>
                                <i class="fas fa-handshake"></i>
                                Entregue
                            </button>
                        </div>
                    </div>
                    
                    <div class="service-footer">
                        ${service.clientPhone ? `
                        <button class="btn-whatsapp" onclick="contactClient('${escapeHtml(service.clientPhone)}', '${safeName}', '${service.orderCode || 'N/A'}')">
                            <i class="fab fa-whatsapp"></i>
                            Contatar
                        </button>
                        ` : ''}
                        ${service.deliveryMethod ? `
                        <button class="btn-delivery" onclick="showDeliveryInfo('${service.id}')">
                            <i class="fas fa-truck"></i>
                            Ver Entrega
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
}

function updateStats() {
    // Calculate statistics excluding delivered for "active"
    const activeServices = services.filter(s => s.status !== 'entregue');
    
    const stats = {
        active: activeServices.length,
        pendente: services.filter(s => s.status === 'pendente').length,
        producao: services.filter(s => s.status === 'producao').length,
        concluido: services.filter(s => s.status === 'concluido').length,
        retirada: services.filter(s => s.status === 'retirada').length,
        entregue: services.filter(s => s.status === 'entregue').length
    };
    
    const elements = {
        'stat-active': stats.active,
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
// FILTER MANAGEMENT
// ===========================
function filterServices(filter) {
    currentFilter = filter;
    
    // Update active state on cards
    document.querySelectorAll('.stat-card').forEach(card => {
        card.classList.remove('active');
    });
    
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
    
    renderServices();
}

// ===========================
// MODAL MANAGEMENT
// ===========================
function openAddModal() {
    editingServiceId = null;
    selectedFile = null;
    selectedImage = null;
    
    const modalTitle = document.getElementById('modalTitle');
    const saveButtonText = document.getElementById('saveButtonText');
    const serviceForm = document.getElementById('serviceForm');
    const orderCodeDisplay = document.getElementById('orderCodeDisplay');
    
    if (modalTitle) modalTitle.textContent = 'Novo Serviço';
    if (saveButtonText) saveButtonText.textContent = 'Salvar Serviço';
    if (serviceForm) serviceForm.reset();
    if (orderCodeDisplay) orderCodeDisplay.style.display = 'none';
    
    // Reset date fields
    setupDateFields();
    
    // Reset file/image displays
    const fileInfo = document.getElementById('fileInfo');
    const imagePreview = document.getElementById('imagePreview');
    if (fileInfo) fileInfo.style.display = 'none';
    if (imagePreview) imagePreview.style.display = 'none';
    
    // Set default values
    const priority = document.getElementById('servicePriority');
    const status = document.getElementById('serviceStatus');
    const dateUndefined = document.getElementById('dateUndefined');
    
    if (priority) priority.value = 'media';
    if (status) status.value = 'pendente';
    if (dateUndefined) dateUndefined.checked = false;
    
    // Hide delivery fields
    hideAllDeliveryFields();
    
    const modal = document.getElementById('serviceModal');
    if (modal) modal.classList.add('active');
}

function openEditModal(serviceId) {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    editingServiceId = serviceId;
    selectedFile = null;
    selectedImage = null;
    
    const modalTitle = document.getElementById('modalTitle');
    const saveButtonText = document.getElementById('saveButtonText');
    const orderCodeDisplay = document.getElementById('orderCodeDisplay');
    
    if (modalTitle) modalTitle.textContent = 'Editar Serviço';
    if (saveButtonText) saveButtonText.textContent = 'Atualizar Serviço';
    if (orderCodeDisplay) orderCodeDisplay.style.display = 'none';
    
    // Fill form fields
    const fields = {
        'serviceName': service.name || '',
        'clientName': service.client || '',
        'clientEmail': service.clientEmail || '',
        'clientPhone': service.clientPhone || '',
        'serviceDescription': service.description || '',
        'serviceMaterial': service.material || '',
        'serviceColor': service.color || '',
        'servicePriority': service.priority || 'media',
        'startDate': service.startDate || '',
        'dueDate': service.dueDate || '',
        'serviceValue': service.value || '',
        'serviceWeight': service.weight || '',
        'serviceObservations': service.observations || '',
        'serviceStatus': service.status || 'pendente',
        'deliveryMethod': service.deliveryMethod || ''
    };
    
    for (const [id, value] of Object.entries(fields)) {
        const element = document.getElementById(id);
        if (element) {
            element.value = value;
        }
    }
    
    // Handle date undefined
    const dateUndefined = document.getElementById('dateUndefined');
    const dueDateInput = document.getElementById('dueDate');
    if (dateUndefined) {
        dateUndefined.checked = service.dateUndefined === true;
        if (service.dateUndefined) {
            if (dueDateInput) {
                dueDateInput.disabled = true;
                dueDateInput.value = '';
            }
        }
    }
    
    // Handle existing files
    const currentFileUrl = document.getElementById('currentFileUrl');
    const currentFileName = document.getElementById('currentFileName');
    const currentImageUrl = document.getElementById('currentImageUrl');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const imagePreview = document.getElementById('imagePreview');
    const previewImg = document.getElementById('previewImg');
    
    if (service.fileUrl) {
        if (currentFileUrl) currentFileUrl.value = service.fileUrl;
        if (currentFileName) currentFileName.value = service.fileName || '';
        if (fileInfo && fileName) {
            fileName.textContent = service.fileName || 'Arquivo anexado';
            fileInfo.style.display = 'flex';
        }
    } else {
        if (fileInfo) fileInfo.style.display = 'none';
    }
    
    if (service.imageUrl) {
        if (currentImageUrl) currentImageUrl.value = service.imageUrl;
        if (imagePreview && previewImg) {
            previewImg.src = service.imageUrl;
            imagePreview.style.display = 'block';
        }
    } else {
        if (imagePreview) imagePreview.style.display = 'none';
    }
    
    // Handle delivery method fields
    if (service.deliveryMethod) {
        toggleDeliveryFields();
        
        if (service.deliveryMethod === 'retirada' && service.pickupInfo) {
            document.getElementById('pickupName').value = service.pickupInfo.name || '';
            document.getElementById('pickupWhatsapp').value = service.pickupInfo.whatsapp || '';
        } else if (service.deliveryMethod === 'sedex' && service.deliveryAddress) {
            const addr = service.deliveryAddress;
            document.getElementById('fullName').value = addr.fullName || '';
            document.getElementById('cpfCnpj').value = addr.cpfCnpj || '';
            document.getElementById('email').value = addr.email || '';
            document.getElementById('telefone').value = addr.telefone || '';
            document.getElementById('cep').value = addr.cep || '';
            document.getElementById('estado').value = addr.estado || '';
            document.getElementById('cidade').value = addr.cidade || '';
            document.getElementById('bairro').value = addr.bairro || '';
            document.getElementById('rua').value = addr.rua || '';
            document.getElementById('numero').value = addr.numero || '';
            document.getElementById('complemento').value = addr.complemento || '';
        }
    }
    
    const modal = document.getElementById('serviceModal');
    if (modal) modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('serviceModal');
    if (modal) modal.classList.remove('active');
    editingServiceId = null;
    selectedFile = null;
    selectedImage = null;
}

function closeStatusModal() {
    const modal = document.getElementById('statusModal');
    if (modal) modal.classList.remove('active');
    pendingStatusUpdate = null;
}

function closeSedexConfirm() {
    const modal = document.getElementById('sedexConfirmModal');
    if (modal) modal.classList.remove('active');
    pendingStatusUpdate = null;
}

function closeDeliveryModal() {
    const modal = document.getElementById('deliveryInfoModal');
    if (modal) modal.classList.remove('active');
}

// ===========================
// DELIVERY MANAGEMENT
// ===========================
function toggleDeliveryFields() {
    const deliveryMethod = document.getElementById('deliveryMethod').value;
    const pickupFields = document.getElementById('pickupFields');
    const deliveryFields = document.getElementById('deliveryFields');
    
    hideAllDeliveryFields();
    
    if (deliveryMethod === 'retirada') {
        if (pickupFields) pickupFields.classList.add('active');
    } else if (deliveryMethod === 'sedex') {
        if (deliveryFields) deliveryFields.classList.add('active');
    }
}

function hideAllDeliveryFields() {
    const pickupFields = document.getElementById('pickupFields');
    const deliveryFields = document.getElementById('deliveryFields');
    
    if (pickupFields) pickupFields.classList.remove('active');
    if (deliveryFields) deliveryFields.classList.remove('active');
}

function showDeliveryInfo(serviceId) {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    const modal = document.getElementById('deliveryInfoModal');
    const content = document.getElementById('deliveryInfoContent');
    
    if (!modal || !content) return;
    
    let html = '';
    
    html += `
        <div class="info-section">
            <h3 class="info-title">
                <i class="fas fa-truck"></i> Método de Entrega
            </h3>
            <div class="info-row">
                <span class="info-label">Tipo</span>
                <span class="info-value">${getDeliveryMethodName(service.deliveryMethod)}</span>
            </div>
        </div>
    `;
    
    if (service.deliveryMethod === 'retirada' && service.pickupInfo) {
        const pickup = service.pickupInfo;
        const whatsappNumber = pickup.whatsapp.replace(/\D/g, '');
        const message = encodeURIComponent(
            `Olá ${pickup.name}! Seu pedido está pronto para retirada.\n\n` +
            `🔹 Pedido: ${service.name}\n` +
            `🔹 Código: ${service.orderCode}\n\n` +
            `Por favor, podemos confirmar o horário de retirada?`
        );
        const whatsappLink = `https://wa.me/55${whatsappNumber}?text=${message}`;
        
        html += `
            <div class="info-section">
                <h3 class="info-title">
                    <i class="fas fa-user-check"></i> Informações para Retirada
                </h3>
                <div class="info-row">
                    <span class="info-label">Nome</span>
                    <span class="info-value">${pickup.name || '-'}</span>
                </div>
                <div class="info-row">
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
                <div class="info-row">
                    <span class="info-label">Nome</span>
                    <span class="info-value">${addr.fullName || '-'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">CPF/CNPJ</span>
                    <span class="info-value">${addr.cpfCnpj || '-'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">E-mail</span>
                    <span class="info-value">${addr.email || '-'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Telefone</span>
                    <span class="info-value">${addr.telefone || '-'}</span>
                </div>
            </div>
            
            <div class="info-section">
                <h3 class="info-title">
                    <i class="fas fa-map-marker-alt"></i> Endereço de Entrega
                </h3>
                <div class="info-row">
                    <span class="info-label">CEP</span>
                    <span class="info-value">${addr.cep || '-'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Endereço</span>
                    <span class="info-value">${addr.rua || ''}, ${addr.numero || 's/n'}</span>
                </div>
                ${addr.complemento ? `
                <div class="info-row">
                    <span class="info-label">Complemento</span>
                    <span class="info-value">${addr.complemento}</span>
                </div>
                ` : ''}
                <div class="info-row">
                    <span class="info-label">Bairro</span>
                    <span class="info-value">${addr.bairro || '-'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Cidade/Estado</span>
                    <span class="info-value">${addr.cidade || '-'} / ${addr.estado || '-'}</span>
                </div>
            </div>
        `;
    }
    
    content.innerHTML = html;
    modal.classList.add('active');
}

async function buscarCEP() {
    const cep = document.getElementById('cep').value.replace(/\D/g, '');
    
    if (cep.length !== 8) return;
    
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
            document.getElementById('rua').value = data.logradouro || '';
            document.getElementById('bairro').value = data.bairro || '';
            document.getElementById('cidade').value = data.localidade || '';
            document.getElementById('estado').value = data.uf || '';
        }
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
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
        'cinza': 'Cinza',
        'transparente': 'Transparente',
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

function formatCEP(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    
    if (value.length > 5) {
        value = `${value.slice(0, 5)}-${value.slice(5)}`;
    }
    
    e.target.value = value;
}

function getDeliveryMethodName(method) {
    const methods = {
        'retirada': 'Retirada no Local',
        'sedex': 'Sedex/Correios',
        'uber': 'Uber Flash',
        'definir': 'A Definir'
    };
    return methods[method] || method;
}

function getDeliveryIcon(method) {
    const icons = {
        'retirada': 'fa-store',
        'sedex': 'fa-shipping-fast',
        'uber': 'fa-motorcycle',
        'definir': 'fa-question-circle'
    };
    return icons[method] || 'fa-truck';
}

function getStatusLabel(status) {
    const labels = {
        'todos': 'Ativos',
        'pendente': 'Pendentes',
        'producao': 'Em Produção',
        'concluido': 'Concluídos',
        'retirada': 'Para Retirada',
        'entregue': 'Entregues'
    };
    return labels[status] || status;
}

// ===========================
// WHATSAPP INTEGRATION
// ===========================
function sendWhatsAppMessage(phone, message) {
    const cleanPhone = phone.replace(/\D/g, '');
    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

function contactClient(phone, serviceName, orderCode) {
    const message = `Olá! \n\nEstamos entrando em contato sobre seu pedido:\n\n` +
        `🔹 Serviço: ${serviceName}\n` +
        `🔹 Código: #${orderCode}\n\n` +
        `Pode falar agora?`;
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
    
    // Check initial status
    updateConnectionStatus(navigator.onLine);
}

// ===========================
// ERROR HANDLING
// ===========================
window.addEventListener('error', (e) => {
    console.error('Erro:', e);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Promise rejeitada:', e.reason);
});
