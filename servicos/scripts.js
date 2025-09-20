/* 
==================================================
ARQUIVO: servicos/scripts.js
MÓDULO: Serviços/Produção (Painel Administrativo)
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 2.2 - Optimized
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

const AUTHORIZED_EMAILS = ["3d3printers@gmail.com", "igor.butter@gmail.com"];

// ===========================
// GLOBAL VARIABLES
// ===========================
let db, auth, storage, services = [], currentFilter = 'todos', editingServiceId = null;
let currentUser = null, isAuthorized = false, servicesListener = null;
let pendingStatusUpdate = null, selectedFile = null, selectedImage = null;

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
document.readyState === 'loading' 
    ? document.addEventListener('DOMContentLoaded', onDOMReady)
    : onDOMReady();

function onDOMReady() {
    if (!auth) {
        hideLoadingOverlay();
        return alert('Erro ao inicializar autenticação. Recarregue a página.');
    }
    
    auth.onAuthStateChanged(user => {
        hideLoadingOverlay();
        currentUser = user;
        user ? checkAuthorization(user) : (isAuthorized = false, showLoginScreen());
    }, error => {
        console.error('Erro no auth state:', error);
        hideLoadingOverlay();
        showLoginScreen();
    });
    
    setupDateFields();
    ['clientPhone', 'pickupWhatsapp'].forEach(id => {
        const input = document.getElementById(id);
        input?.addEventListener('input', formatPhoneNumber);
    });
    document.getElementById('cep')?.addEventListener('input', formatCEP);
    monitorConnection();
}

// ===========================
// DATE UTILITIES - BRASIL
// ===========================
function getTodayBrazil() {
    const now = new Date();
    const brazilTime = new Date(now.getTime() - (now.getTimezoneOffset() + 180) * 60000);
    brazilTime.setHours(0, 0, 0, 0);
    return brazilTime.toISOString().split('T')[0];
}

function parseDateBrazil(dateString) {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
}

function calculateDaysRemaining(dueDate) {
    if (!dueDate) return null;
    const due = parseDateBrazil(dueDate);
    const today = parseDateBrazil(getTodayBrazil());
    return due && today ? Math.round((due - today) / 86400000) : null;
}

// ===========================
// UI UTILITIES
// ===========================
const hideLoadingOverlay = () => document.getElementById('loadingOverlay')?.classList.add('hidden');

function setupDateFields() {
    const today = getTodayBrazil();
    const startDate = document.getElementById('startDate');
    const dueDate = document.getElementById('dueDate');
    
    if (startDate) {
        startDate.value = today;
        startDate.addEventListener('change', () => {
            if (dueDate && dueDate.value < startDate.value) dueDate.value = startDate.value;
        });
    }
    dueDate && (dueDate.value = today);
}

function toggleDateInput() {
    const dateInput = document.getElementById('dueDate');
    const checkbox = document.getElementById('dateUndefined');
    if (dateInput && checkbox) {
        dateInput.disabled = dateInput.required = checkbox.checked;
        dateInput.value = checkbox.checked ? '' : getTodayBrazil();
        dateInput.required = !checkbox.checked;
    }
}

// ===========================
// FILE HANDLING
// ===========================
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return selectedFile = null;
    
    const validExts = ['.stl', '.obj', '.step', '.stp', '.3mf'];
    const isValid = validExts.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isValid || file.size > 52428800) {
        showToast(!isValid ? 'Formato inválido. Use: STL, OBJ, STEP ou 3MF' : 'Arquivo muito grande. Máximo: 50MB', 'error');
        event.target.value = '';
        return selectedFile = null;
    }
    
    selectedFile = file;
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    if (fileInfo && fileName) {
        fileName.textContent = file.name;
        fileInfo.style.display = 'flex';
    }
}

function handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return selectedImage = null;
    
    if (!file.type.startsWith('image/') || file.size > 5242880) {
        showToast(!file.type.startsWith('image/') ? 'Selecione uma imagem' : 'Imagem muito grande. Máximo: 5MB', 'error');
        event.target.value = '';
        return selectedImage = null;
    }
    
    selectedImage = file;
    const reader = new FileReader();
    reader.onload = e => {
        const preview = document.getElementById('imagePreview');
        const img = document.getElementById('previewImg');
        if (preview && img) {
            img.src = e.target.result;
            preview.style.display = 'block';
        }
    };
    reader.readAsDataURL(file);
}

const removeFile = () => {
    selectedFile = null;
    ['serviceFile', 'currentFileUrl', 'currentFileName'].forEach(id => {
        const el = document.getElementById(id);
        el && (el.value = '');
    });
    const fileInfo = document.getElementById('fileInfo');
    fileInfo && (fileInfo.style.display = 'none');
};

const removeImage = () => {
    selectedImage = null;
    ['serviceImage', 'currentImageUrl'].forEach(id => {
        const el = document.getElementById(id);
        el && (el.value = '');
    });
    const preview = document.getElementById('imagePreview');
    preview && (preview.style.display = 'none');
};

async function uploadFile(file, serviceId) {
    if (!file || !storage) return null;
    try {
        const fileName = `${serviceId}_${Date.now()}_${file.name}`;
        const snapshot = await storage.ref(`services/${serviceId}/${fileName}`).put(file);
        const url = await snapshot.ref.getDownloadURL();
        return { url, name: file.name, size: file.size, uploadedAt: new Date().toISOString() };
    } catch (error) {
        console.error('Erro ao fazer upload:', error);
        showToast('Erro ao fazer upload do arquivo', 'error');
        return null;
    }
}

function downloadFile(url, fileName) {
    const link = Object.assign(document.createElement('a'), { href: url, download: fileName || 'arquivo', target: '_blank' });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ===========================
// AUTHENTICATION
// ===========================
async function signInWithGoogle() {
    if (!auth) return showToast('Sistema não está pronto. Recarregue a página.', 'error');
    
    try {
        const result = await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
        const user = result.user;
        
        if (!AUTHORIZED_EMAILS.includes(user.email)) {
            await auth.signOut();
            return showToast(`Acesso negado! O email ${user.email} não está autorizado.`, 'error');
        }
        
        currentUser = user;
        isAuthorized = true;
        showToast(`Bem-vindo, ${user.displayName}!`, 'success');
    } catch (error) {
        console.error('Erro no login:', error);
        showToast(error.code === 'auth/popup-closed-by-user' ? 'Login cancelado' : 'Erro ao fazer login', error.code === 'auth/popup-closed-by-user' ? 'info' : 'error');
    }
}

const signOut = async () => {
    try {
        auth && await auth.signOut();
        showToast('Logout realizado com sucesso!', 'info');
    } catch (error) {
        console.error('Erro no logout:', error);
        showToast('Erro ao fazer logout.', 'error');
    }
};

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
    document.getElementById('loginScreen')?.classList.remove('hidden');
    document.getElementById('adminDashboard')?.classList.add('hidden');
    servicesListener?.();
    servicesListener = null;
}

function showAdminDashboard(user) {
    document.getElementById('loginScreen')?.classList.add('hidden');
    document.getElementById('adminDashboard')?.classList.remove('hidden');
    document.getElementById('userName') && (document.getElementById('userName').textContent = user.displayName || user.email);
    document.getElementById('userPhoto') && (document.getElementById('userPhoto').src = user.photoURL || '/assets/default-avatar.png');
}

// ===========================
// FIREBASE LISTENERS
// ===========================
function startServicesListener() {
    if (!db) return console.error('Firestore não está disponível');
    
    servicesListener?.();
    
    servicesListener = db.collection('services').onSnapshot(snapshot => {
        services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        updateStats();
        renderServices();
    }, error => {
        console.error('Erro ao carregar serviços:', error);
        showToast(error.code === 'permission-denied' ? 'Sem permissão para acessar serviços' : 'Erro ao carregar serviços', 'error');
    });
}

// ===========================
// SERVICE MANAGEMENT
// ===========================
const generateOrderCode = () => Array(5).fill(0).map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');

async function saveService(event) {
    event.preventDefault();
    
    if (!isAuthorized || !db || !currentUser) 
        return showToast(!isAuthorized ? 'Sem permissão' : 'Sistema não está pronto', 'error');
    
    const deliveryMethod = document.getElementById('deliveryMethod').value;
    if (!deliveryMethod) return showToast('Selecione um método de entrega', 'error');
    
    const dateUndefined = document.getElementById('dateUndefined');
    const dueDateInput = document.getElementById('dueDate');
    
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
        dueDate: dateUndefined?.checked ? null : dueDateInput.value,
        dateUndefined: dateUndefined?.checked || false,
        value: parseFloat(document.getElementById('serviceValue').value) || null,
        weight: parseFloat(document.getElementById('serviceWeight').value) || null,
        observations: document.getElementById('serviceObservations').value.trim() || null,
        deliveryMethod,
        status: document.getElementById('serviceStatus').value,
        updatedAt: new Date().toISOString(),
        updatedBy: currentUser.email
    };
    
    // Tratamento especial para código de rastreio ao editar
    if (editingServiceId) {
        if (deliveryMethod === 'sedex') {
            const trackingCodeInput = document.getElementById('editTrackingCode');
            if (trackingCodeInput) {
                const trackingValue = trackingCodeInput.value.trim();
                if (trackingValue) {
                    // Se tem valor, salva/atualiza
                    service.trackingCode = trackingValue.toUpperCase();
                } else {
                    // Se está vazio, marca para deletar do Firebase
                    service.trackingCode = firebase.firestore.FieldValue.delete();
                }
            }
        } else {
            // Se não é SEDEX, remove código de rastreio se existir
            const currentService = services.find(s => s.id === editingServiceId);
            if (currentService && currentService.trackingCode) {
                service.trackingCode = firebase.firestore.FieldValue.delete();
            }
        }
    }
    
    if (!service.dateUndefined && service.dueDate && parseDateBrazil(service.dueDate) < parseDateBrazil(service.startDate))
        return showToast('Data de entrega não pode ser anterior à data de início', 'error');
    
    // Handle delivery methods
    if (deliveryMethod === 'retirada') {
        const pickupName = document.getElementById('pickupName').value.trim();
        const pickupWhatsapp = document.getElementById('pickupWhatsapp').value.trim();
        if (!pickupName || !pickupWhatsapp) return showToast('Preencha todos os campos de retirada', 'error');
        service.pickupInfo = { name: pickupName, whatsapp: pickupWhatsapp };
    } else if (deliveryMethod === 'sedex') {
        const fields = ['fullName', 'cpfCnpj', 'email', 'telefone', 'cep', 'estado', 'cidade', 'bairro', 'rua', 'numero'];
        const addr = Object.fromEntries(fields.map(f => [f, document.getElementById(f).value.trim()]));
        addr.complemento = document.getElementById('complemento').value.trim() || null;
        
        if (fields.some(f => !addr[f])) return showToast('Preencha todos os campos obrigatórios de entrega', 'error');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.email)) return showToast('E-mail inválido', 'error');
        
        service.deliveryAddress = addr;
    }
    
    try {
        let serviceDocId = editingServiceId;
        
        if (editingServiceId) {
            // Preserve existing files
            const currentFileUrl = document.getElementById('currentFileUrl');
            const currentFileName = document.getElementById('currentFileName');
            const currentImageUrl = document.getElementById('currentImageUrl');
            
            if (currentFileUrl?.value && !selectedFile) {
                service.fileUrl = currentFileUrl.value;
                service.fileName = currentFileName.value;
            }
            if (currentImageUrl?.value && !selectedImage) service.imageUrl = currentImageUrl.value;
            
            await db.collection('services').doc(editingServiceId).update(service);
            showToast('Serviço atualizado com sucesso!', 'success');
        } else {
            Object.assign(service, {
                createdAt: new Date().toISOString(),
                createdBy: currentUser.email,
                orderCode: generateOrderCode(),
                serviceId: 'SRV-' + Date.now()
            });
            
            const docRef = await db.collection('services').add(service);
            serviceDocId = docRef.id;
            
            document.getElementById('orderCodeDisplay').style.display = 'block';
            document.getElementById('orderCodeValue').textContent = service.orderCode;
            showToast(`Serviço criado! Código: ${service.orderCode}`, 'success');
            
            if (service.clientPhone) {
                const dueDateText = service.dateUndefined ? 'A definir' : formatDate(service.dueDate);
                const message = `Olá ${service.client}!\nSeu pedido foi registrado com sucesso.\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}\n» Prazo: ${dueDateText}\n» Entrega: ${getDeliveryMethodName(service.deliveryMethod)}\n\nAcompanhe seu pedido em:\nhttps://imaginatech.com.br/acompanhar-pedido/`;
                sendWhatsAppMessage(service.clientPhone, message);
            }
        }
        
        // Upload files
        if (selectedFile && serviceDocId) {
            const fileData = await uploadFile(selectedFile, serviceDocId);
            fileData && await db.collection('services').doc(serviceDocId).update({
                fileUrl: fileData.url,
                fileName: fileData.name,
                fileSize: fileData.size,
                fileUploadedAt: fileData.uploadedAt
            });
        }
        
        if (selectedImage && serviceDocId) {
            const imageData = await uploadFile(selectedImage, serviceDocId);
            imageData && await db.collection('services').doc(serviceDocId).update({
                imageUrl: imageData.url,
                imageUploadedAt: imageData.uploadedAt
            });
        }
        
        setTimeout(closeModal, editingServiceId ? 0 : 3000);
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showToast('Erro ao salvar serviço', 'error');
    }
}

// ===========================
// STATUS & TRACKING
// ===========================
function showTrackingCodeModal() {
    const modal = document.getElementById('trackingModal');
    modal?.classList.add('active');
    const input = document.getElementById('trackingCode');
    input && (input.value = '', input.focus());
}

const closeTrackingModal = () => {
    document.getElementById('trackingModal')?.classList.remove('active');
    pendingStatusUpdate = null;
};

async function confirmTrackingCode() {
    const trackingInput = document.getElementById('trackingCode');
    if (!trackingInput?.value.trim()) return showToast('Insira o código de rastreio', 'error');
    if (!pendingStatusUpdate) return;
    
    const { serviceId, service } = pendingStatusUpdate;
    const trackingCode = trackingInput.value.trim().toUpperCase();
    
    try {
        await db.collection('services').doc(serviceId).update({
            status: 'retirada',
            trackingCode,
            postedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.email
        });
        
        showToast('Pedido marcado como postado!', 'success');
        
        if (service.clientPhone) {
            const message = `Seu pedido foi postado nos Correios!\n\n» ${service.name}\n» Código: ${service.orderCode}\n» Rastreio: ${trackingCode}\n\nRastreie em:\nhttps://rastreamento.correios.com.br/app/index.php\n\nPrazo estimado: 3-7 dias úteis`;
            sendWhatsAppMessage(service.clientPhone, message);
        }
    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro ao atualizar status', 'error');
    }
    closeTrackingModal();
}

async function updateStatus(serviceId, newStatus) {
    if (!isAuthorized) return showToast('Sem permissão', 'error');
    
    const service = services.find(s => s.id === serviceId);
    if (!service || service.status === newStatus) return;
    
    if (service.deliveryMethod === 'sedex' && newStatus === 'retirada' && !service.trackingCode) {
        pendingStatusUpdate = { serviceId, newStatus, service };
        return showTrackingCodeModal();
    }
    
    pendingStatusUpdate = { serviceId, newStatus, service };
    
    const statusMessages = {
        'pendente': 'Marcar como Pendente',
        'producao': 'Iniciar Produção',
        'concluido': 'Marcar como Concluído',
        'retirada': service.deliveryMethod === 'sedex' ? 'Marcar como Postado' : 'Pronto para Retirada',
        'entregue': 'Confirmar Entrega'
    };
    
    document.getElementById('statusModalMessage') && 
        (document.getElementById('statusModalMessage').textContent = `Deseja ${statusMessages[newStatus]} para o serviço "${service.name}"?`);
    
    const whatsappOption = document.getElementById('whatsappOption');
    if (whatsappOption && service.clientPhone && ['producao', 'retirada', 'entregue'].includes(newStatus)) {
        whatsappOption.style.display = 'block';
        document.getElementById('sendWhatsappNotification') && (document.getElementById('sendWhatsappNotification').checked = true);
    } else if (whatsappOption) {
        whatsappOption.style.display = 'none';
    }
    
    document.getElementById('statusModal')?.classList.add('active');
}

async function confirmStatusChange() {
    if (!pendingStatusUpdate || !db) return;
    
    const { serviceId, newStatus, service } = pendingStatusUpdate;
    const sendWhatsapp = document.getElementById('sendWhatsappNotification')?.checked || false;
    
    try {
        const updates = {
            status: newStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser.email,
            lastStatusChange: new Date().toISOString(),
            [`${newStatus}At`]: newStatus === 'producao' ? 'productionStartedAt' : 
                              newStatus === 'concluido' ? 'completedAt' :
                              newStatus === 'retirada' ? 'readyAt' :
                              newStatus === 'entregue' ? 'deliveredAt' : null
        };
        if (updates[`${newStatus}At`]) updates[updates[`${newStatus}At`]] = new Date().toISOString();
        delete updates[`${newStatus}At`];
        
        await db.collection('services').doc(serviceId).update(updates);
        showToast('Status atualizado!', 'success');
        
        if (sendWhatsapp && service.clientPhone) {
            const messages = {
                'producao': `✅ Iniciamos a produção!\n\n📦 ${service.name}\n📖 Código: ${service.orderCode}`,
                'retirada': service.deliveryMethod === 'retirada' ? 
                    `🎉 Pronto para retirada!\n\n📦 ${service.name}\n📖 Código: ${service.orderCode}` :
                    `📦 Postado nos Correios!\n\n📦 ${service.name}\n📖 Código: ${service.orderCode}${service.trackingCode ? `\n🔍 Rastreio: ${service.trackingCode}` : ''}`,
                'entregue': `✅ Entregue com sucesso!\n\n📦 ${service.name}\n📖 Código: ${service.orderCode}\n\nObrigado! 😊`
            };
            messages[newStatus] && sendWhatsAppMessage(service.clientPhone, messages[newStatus]);
        }
    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro ao atualizar status', 'error');
    }
    closeStatusModal();
}

async function deleteService(serviceId) {
    if (!isAuthorized) return showToast('Sem permissão', 'error');
    
    const service = services.find(s => s.id === serviceId);
    if (!service || !confirm(`Excluir o serviço "${service.name}"?`)) return;
    
    try {
        await db.collection('services').doc(serviceId).delete();
        showToast('Serviço excluído!', 'success');
    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro ao excluir', 'error');
    }
}

// ===========================
// UI RENDERING
// ===========================
function renderServices() {
    const grid = document.getElementById('servicesGrid');
    const emptyState = document.getElementById('emptyState');
    if (!grid || !emptyState) return;
    
    let filtered = currentFilter === 'todos' ? 
        services.filter(s => s.status !== 'entregue') : 
        services.filter(s => s.status === currentFilter);
    
    filtered.sort((a, b) => {
        const priority = { urgente: 4, alta: 3, media: 2, baixa: 1 };
        const diff = (priority[b.priority] || 0) - (priority[a.priority] || 0);
        if (diff !== 0) return diff;
        
        if (a.dateUndefined !== b.dateUndefined) return a.dateUndefined ? 1 : -1;
        return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
    });
    
    if (filtered.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
        const emptyText = document.getElementById('emptyText');
        emptyText && (emptyText.textContent = currentFilter === 'todos' ? 
            'Nenhum serviço ativo encontrado' : 
            `Nenhum serviço ${getStatusLabel(currentFilter).toLowerCase()} encontrado`);
    } else {
        grid.style.display = 'grid';
        emptyState.style.display = 'none';
        grid.innerHTML = filtered.map(service => {
            const days = service.dateUndefined ? null : calculateDaysRemaining(service.dueDate);
            const daysText = service.dateUndefined ? 'Data a definir' : formatDaysText(days);
            const daysColor = service.dateUndefined ? 'var(--neon-yellow)' : getDaysColor(days);
            
            return `
                <div class="service-card priority-${service.priority || 'media'}">
                    <div class="service-header">
                        <div class="service-title">
                            <h3>${escapeHtml(service.name || 'Sem nome')}</h3>
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
                    
                    ${service.imageUrl ? `<div class="service-image"><img src="${service.imageUrl}" alt="Imagem" onclick="window.open('${service.imageUrl}', '_blank')"></div>` : ''}
                    
                    ${service.deliveryMethod ? `
                    <div class="delivery-badge ${days !== null && days < 0 ? 'badge-late' : days !== null && days <= 2 ? 'badge-urgent' : ''}">
                        <div class="delivery-info">
                            <i class="fas ${getDeliveryIcon(service.deliveryMethod)}"></i>
                            ${getDeliveryMethodName(service.deliveryMethod)}${service.trackingCode ? ` - ${service.trackingCode}` : ''}
                        </div>
                        <div class="delivery-time ${days !== null && days < 0 ? 'time-late' : days !== null && days <= 2 ? 'time-urgent' : days !== null && days <= 5 ? 'time-warning' : 'time-normal'}">
                            <i class="fas fa-clock"></i>
                            ${daysText}
                        </div>
                    </div>` : ''}
                    
                    <div class="service-info">
                        <div class="info-item"><i class="fas fa-user"></i><span>${escapeHtml(service.client || 'Cliente não informado')}</span></div>
                        ${service.clientPhone ? `<div class="info-item"><i class="fas fa-phone"></i><span>${escapeHtml(service.clientPhone)}</span></div>` : ''}
                        <div class="info-item"><i class="fas fa-layer-group"></i><span>${service.material || 'N/A'}</span></div>
                        ${service.color ? `<div class="info-item"><i class="fas fa-palette"></i><span>${formatColorName(service.color)}</span></div>` : ''}
                        <div class="info-item"><i class="fas fa-calendar"></i><span>${formatDate(service.startDate)}</span></div>
                        ${service.value ? `<div class="info-item"><i class="fas fa-dollar-sign"></i><span>R$ ${formatMoney(service.value)}</span></div>` : ''}
                        ${service.weight ? `<div class="info-item"><i class="fas fa-weight"></i><span>${service.weight}g</span></div>` : ''}
                        ${service.fileUrl ? `<div class="info-item"><button class="btn-download" onclick="downloadFile('${service.fileUrl}', '${escapeHtml(service.fileName || 'arquivo')}')" title="Baixar"><i class="fas fa-download"></i><span>${escapeHtml(service.fileName || 'Arquivo')}</span></button></div>` : ''}
                    </div>
                    
                    ${service.description ? `<div class="service-description"><p>${escapeHtml(service.description)}</p></div>` : ''}
                    
                    <div class="service-status">
                        <div class="status-timeline">
                            ${['pendente', 'producao', 'concluido', 'retirada', 'entregue'].map((status, index) => {
                                const isActive = service.status === status;
                                const isCompleted = isStatusCompleted(service.status, status);
                                const label = status === 'retirada' && service.deliveryMethod === 'sedex' ? 'Postado' : 
                                             status === 'pendente' ? 'Pendente' :
                                             status === 'producao' ? 'Produção' :
                                             status === 'concluido' ? 'Concluído' :
                                             status === 'retirada' ? 'Retirada' :
                                             'Entregue';
                                
                                return `
                                    <div class="timeline-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}">
                                        <button class="step-button" 
                                                onclick="updateStatus('${service.id}', '${status}')"
                                                ${isActive ? 'disabled' : ''}>
                                            <span class="step-icon">
                                                <i class="fas ${getStatusIcon(status)}"></i>
                                            </span>
                                            <span class="step-text">${label}</span>
                                        </button>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    
                    <div class="service-footer">
                        ${service.clientPhone ? `<button class="btn-whatsapp" onclick="contactClient('${escapeHtml(service.clientPhone)}', '${escapeHtml(service.name || '')}', '${service.orderCode || 'N/A'}')"><i class="fab fa-whatsapp"></i> Contatar</button>` : ''}
                        ${service.deliveryMethod ? `<button class="btn-delivery" onclick="showDeliveryInfo('${service.id}')"><i class="fas fa-truck"></i> Ver Entrega</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
}

function updateStats() {
    const stats = {
        active: services.filter(s => s.status !== 'entregue').length,
        pendente: services.filter(s => s.status === 'pendente').length,
        producao: services.filter(s => s.status === 'producao').length,
        concluido: services.filter(s => s.status === 'concluido').length,
        retirada: services.filter(s => s.status === 'retirada').length,
        entregue: services.filter(s => s.status === 'entregue').length
    };
    
    Object.entries({
        'stat-active': stats.active,
        'stat-pending': stats.pendente,
        'stat-production': stats.producao,
        'stat-completed': stats.concluido,
        'stat-ready': stats.retirada,
        'stat-delivered': stats.entregue
    }).forEach(([id, value]) => {
        const el = document.getElementById(id);
        el && (el.textContent = value);
    });
}

// ===========================
// FILTER & MODALS
// ===========================
function filterServices(filter) {
    currentFilter = filter;
    document.querySelectorAll('.stat-card').forEach(card => card.classList.remove('active'));
    event?.currentTarget?.classList.add('active');
    renderServices();
}

function openAddModal() {
    editingServiceId = selectedFile = selectedImage = null;
    
    document.getElementById('modalTitle') && (document.getElementById('modalTitle').textContent = 'Novo Serviço');
    document.getElementById('saveButtonText') && (document.getElementById('saveButtonText').textContent = 'Salvar Serviço');
    document.getElementById('serviceForm')?.reset();
    document.getElementById('orderCodeDisplay') && (document.getElementById('orderCodeDisplay').style.display = 'none');
    
    setupDateFields();
    ['fileInfo', 'imagePreview'].forEach(id => {
        const el = document.getElementById(id);
        el && (el.style.display = 'none');
    });
    
    document.getElementById('servicePriority') && (document.getElementById('servicePriority').value = 'media');
    document.getElementById('serviceStatus') && (document.getElementById('serviceStatus').value = 'pendente');
    document.getElementById('dateUndefined') && (document.getElementById('dateUndefined').checked = false);
    
    hideAllDeliveryFields();
    document.getElementById('serviceModal')?.classList.add('active');
}

function openEditModal(serviceId) {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    editingServiceId = serviceId;
    selectedFile = selectedImage = null;
    
    document.getElementById('modalTitle') && (document.getElementById('modalTitle').textContent = 'Editar Serviço');
    document.getElementById('saveButtonText') && (document.getElementById('saveButtonText').textContent = 'Atualizar Serviço');
    document.getElementById('orderCodeDisplay') && (document.getElementById('orderCodeDisplay').style.display = 'none');
    
    // Fill form
    Object.entries({
        serviceName: service.name,
        clientName: service.client,
        clientEmail: service.clientEmail,
        clientPhone: service.clientPhone,
        serviceDescription: service.description,
        serviceMaterial: service.material,
        serviceColor: service.color,
        servicePriority: service.priority || 'media',
        startDate: service.startDate,
        dueDate: service.dueDate,
        serviceValue: service.value,
        serviceWeight: service.weight,
        serviceObservations: service.observations,
        serviceStatus: service.status || 'pendente',
        deliveryMethod: service.deliveryMethod
    }).forEach(([id, value]) => {
        const el = document.getElementById(id);
        el && (el.value = value || '');
    });
    
    // Handle dates
    const dateUndefined = document.getElementById('dateUndefined');
    const dueDateInput = document.getElementById('dueDate');
    if (dateUndefined) {
        dateUndefined.checked = service.dateUndefined === true;
        if (service.dateUndefined && dueDateInput) {
            dueDateInput.disabled = true;
            dueDateInput.value = '';
        }
    }
    
    // Handle files
    if (service.fileUrl) {
        document.getElementById('currentFileUrl') && (document.getElementById('currentFileUrl').value = service.fileUrl);
        document.getElementById('currentFileName') && (document.getElementById('currentFileName').value = service.fileName || '');
        const fileInfo = document.getElementById('fileInfo');
        const fileName = document.getElementById('fileName');
        if (fileInfo && fileName) {
            fileName.textContent = service.fileName || 'Arquivo anexado';
            fileInfo.style.display = 'flex';
        }
    }
    
    if (service.imageUrl) {
        document.getElementById('currentImageUrl') && (document.getElementById('currentImageUrl').value = service.imageUrl);
        const preview = document.getElementById('imagePreview');
        const img = document.getElementById('previewImg');
        if (preview && img) {
            img.src = service.imageUrl;
            preview.style.display = 'block';
        }
    }
    
    // Handle delivery
    if (service.deliveryMethod) {
        toggleDeliveryFields();
        
        if (service.deliveryMethod === 'retirada' && service.pickupInfo) {
            document.getElementById('pickupName') && (document.getElementById('pickupName').value = service.pickupInfo.name || '');
            document.getElementById('pickupWhatsapp') && (document.getElementById('pickupWhatsapp').value = service.pickupInfo.whatsapp || '');
        } else if (service.deliveryMethod === 'sedex') {
            // Preenche endereço de entrega
            if (service.deliveryAddress) {
                const addr = service.deliveryAddress;
                Object.entries(addr).forEach(([key, value]) => {
                    const el = document.getElementById(key);
                    el && (el.value = value || '');
                });
            }
            
            // Mostra campo de código de rastreio e preenche se existir
            const trackingField = document.getElementById('trackingCodeField');
            const trackingInput = document.getElementById('editTrackingCode');
            if (trackingField) {
                trackingField.style.display = 'block';
                if (trackingInput) {
                    trackingInput.value = service.trackingCode || '';
                }
            }
        }
    }
    
    document.getElementById('serviceModal')?.classList.add('active');
}

const closeModal = () => {
    document.getElementById('serviceModal')?.classList.remove('active');
    editingServiceId = selectedFile = selectedImage = null;
    // Limpa e oculta campo de código de rastreio
    const trackingField = document.getElementById('trackingCodeField');
    const trackingInput = document.getElementById('editTrackingCode');
    if (trackingField) trackingField.style.display = 'none';
    if (trackingInput) trackingInput.value = '';
};

const closeStatusModal = () => {
    document.getElementById('statusModal')?.classList.remove('active');
    pendingStatusUpdate = null;
};

const closeDeliveryModal = () => document.getElementById('deliveryInfoModal')?.classList.remove('active');

// ===========================
// DELIVERY MANAGEMENT
// ===========================
function toggleDeliveryFields() {
    const method = document.getElementById('deliveryMethod')?.value;
    
    // Se estiver editando e tem código de rastreio, não permite mudar de SEDEX
    if (editingServiceId) {
        const service = services.find(s => s.id === editingServiceId);
        if (service && service.trackingCode && service.deliveryMethod === 'sedex' && method !== 'sedex') {
            showToast('ATENÇÃO: Este pedido já foi postado! Não é possível mudar o método de entrega.', 'error');
            // Volta para SEDEX
            document.getElementById('deliveryMethod').value = 'sedex';
            hideAllDeliveryFields();
            document.getElementById('deliveryFields')?.classList.add('active');
            
            // Mantém campo de código de rastreio visível
            const trackingField = document.getElementById('trackingCodeField');
            if (trackingField) {
                trackingField.style.display = 'block';
                const trackingInput = document.getElementById('editTrackingCode');
                if (trackingInput && service.trackingCode) {
                    trackingInput.value = service.trackingCode;
                }
            }
            return;
        }
    }
    
    hideAllDeliveryFields();
    
    if (method === 'retirada') {
        document.getElementById('pickupFields')?.classList.add('active');
    } else if (method === 'sedex') {
        document.getElementById('deliveryFields')?.classList.add('active');
        // Mostra campo de código de rastreio se estiver editando
        if (editingServiceId) {
            const trackingField = document.getElementById('trackingCodeField');
            if (trackingField) {
                trackingField.style.display = 'block';
            }
        }
    }
    
    // Oculta campo de código de rastreio se não for sedex
    if (method !== 'sedex') {
        const trackingField = document.getElementById('trackingCodeField');
        if (trackingField) {
            trackingField.style.display = 'none';
        }
    }
}

const hideAllDeliveryFields = () => {
    ['pickupFields', 'deliveryFields'].forEach(id => 
        document.getElementById(id)?.classList.remove('active')
    );
};

function showDeliveryInfo(serviceId) {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    const content = document.getElementById('deliveryInfoContent');
    if (!content) return;
    
    let html = `
        <div class="info-section">
            <h3 class="info-title"><i class="fas fa-truck"></i> Método de Entrega</h3>
            <div class="info-row">
                <span class="info-label">Tipo</span>
                <span class="info-value">${getDeliveryMethodName(service.deliveryMethod)}</span>
            </div>
        </div>`;
    
    if (service.deliveryMethod === 'retirada' && service.pickupInfo) {
        const pickup = service.pickupInfo;
        const whatsappNumber = pickup.whatsapp.replace(/\D/g, '');
        const message = encodeURIComponent(`Olá ${pickup.name}!\n\nSeu pedido está pronto para retirada!\n\n» Pedido: ${service.name}\n» Código: ${service.orderCode}\n\nPodemos confirmar o horário de retirada?`);
        
        html += `
            <div class="info-section">
                <h3 class="info-title"><i class="fas fa-user-check"></i> Informações para Retirada</h3>
                <div class="info-row">
                    <span class="info-label">Nome</span>
                    <span class="info-value">${pickup.name || '-'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">WhatsApp</span>
                    <span class="info-value">
                        <a href="https://wa.me/55${whatsappNumber}?text=${message}" target="_blank" style="color: var(--neon-green);">
                            <i class="fab fa-whatsapp"></i> ${pickup.whatsapp}
                        </a>
                    </span>
                </div>
            </div>`;
    }
    
    if (service.deliveryMethod === 'sedex' && service.deliveryAddress) {
        const addr = service.deliveryAddress;
        html += `
            <div class="info-section">
                <h3 class="info-title"><i class="fas fa-user"></i> Destinatário</h3>
                <div class="info-row"><span class="info-label">Nome</span><span class="info-value">${addr.fullName || '-'}</span></div>
                <div class="info-row"><span class="info-label">CPF/CNPJ</span><span class="info-value">${addr.cpfCnpj || '-'}</span></div>
                <div class="info-row"><span class="info-label">E-mail</span><span class="info-value">${addr.email || '-'}</span></div>
                <div class="info-row"><span class="info-label">Telefone</span><span class="info-value">${addr.telefone || '-'}</span></div>
            </div>
            
            <div class="info-section">
                <h3 class="info-title"><i class="fas fa-map-marker-alt"></i> Endereço</h3>
                <div class="info-row"><span class="info-label">CEP</span><span class="info-value">${addr.cep || '-'}</span></div>
                <div class="info-row"><span class="info-label">Endereço</span><span class="info-value">${addr.rua || ''}, ${addr.numero || 's/n'}</span></div>
                ${addr.complemento ? `<div class="info-row"><span class="info-label">Complemento</span><span class="info-value">${addr.complemento}</span></div>` : ''}
                <div class="info-row"><span class="info-label">Bairro</span><span class="info-value">${addr.bairro || '-'}</span></div>
                <div class="info-row"><span class="info-label">Cidade/Estado</span><span class="info-value">${addr.cidade || '-'} / ${addr.estado || '-'}</span></div>
            </div>`;
    }
    
    content.innerHTML = html;
    document.getElementById('deliveryInfoModal')?.classList.add('active');
}

async function buscarCEP() {
    const cep = document.getElementById('cep')?.value.replace(/\D/g, '');
    if (!cep || cep.length !== 8) return;
    
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
            ['rua', 'bairro', 'cidade', 'estado'].forEach(field => {
                const el = document.getElementById(field);
                const value = field === 'rua' ? data.logradouro : 
                              field === 'cidade' ? data.localidade : 
                              field === 'estado' ? data.uf : data[field];
                el && (el.value = value || '');
            });
        }
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
    }
}

// ===========================
// UTILITY FUNCTIONS
// ===========================
const escapeHtml = text => text ? text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])) : '';

const formatDaysText = days => days === null ? 'Sem prazo' : days === 0 ? 'Entrega hoje' : days === 1 ? 'Entrega amanhã' : days < 0 ? `${Math.abs(days)} dias atrás` : `${days} dias`;

const getDaysColor = days => days === null ? 'var(--text-secondary)' : days < 0 ? 'var(--neon-red)' : days === 0 ? 'var(--neon-orange)' : days <= 2 ? 'var(--neon-yellow)' : 'var(--text-secondary)';

const formatDate = dateString => dateString ? new Date(dateString).toLocaleDateString('pt-BR') : 'N/A';

const formatColorName = color => ({
    'preto': 'Preto', 'branco': 'Branco', 'vermelho': 'Vermelho', 'azul': 'Azul',
    'verde': 'Verde', 'amarelo': 'Amarelo', 'laranja': 'Laranja', 'roxo': 'Roxo',
    'cinza': 'Cinza', 'transparente': 'Transparente', 'outros': 'Outras'
}[color] || color);

const formatMoney = value => (!value || isNaN(value)) ? '0,00' : value.toFixed(2).replace('.', ',');

function formatPhoneNumber(e) {
    let value = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (value.length > 6) value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    else if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    else if (value.length > 0) value = `(${value}`;
    e.target.value = value;
}

function formatCEP(e) {
    let value = e.target.value.replace(/\D/g, '').slice(0, 8);
    if (value.length > 5) value = `${value.slice(0, 5)}-${value.slice(5)}`;
    e.target.value = value;
}

const getDeliveryMethodName = method => ({
    'retirada': 'Retirada no Local', 'sedex': 'Sedex/Correios',
    'uber': 'Uber Flash', 'definir': 'A Definir'
}[method] || method);

const getDeliveryIcon = method => ({
    'retirada': 'fa-store', 'sedex': 'fa-shipping-fast',
    'uber': 'fa-motorcycle', 'definir': 'fa-question-circle'
}[method] || 'fa-truck');

const getStatusLabel = status => ({
    'todos': 'Ativos', 'pendente': 'Pendentes', 'producao': 'Em Produção',
    'concluido': 'Concluídos', 'retirada': 'Para Retirada', 'entregue': 'Entregues'
}[status] || status);

const getStatusIcon = status => ({
    'pendente': 'fa-clock', 'producao': 'fa-cogs', 'concluido': 'fa-check',
    'retirada': 'fa-box-open', 'entregue': 'fa-handshake'
}[status] || 'fa-question');

// Helper function to check if a status is completed
const isStatusCompleted = (currentStatus, checkStatus) => {
    const statusOrder = ['pendente', 'producao', 'concluido', 'retirada', 'entregue'];
    return statusOrder.indexOf(currentStatus) > statusOrder.indexOf(checkStatus);
};

// ===========================
// WHATSAPP INTEGRATION
// ===========================
const sendWhatsAppMessage = (phone, message) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
};

const contactClient = (phone, serviceName, orderCode) => {
    const message = `Olá!\n\nSobre seu pedido:\n\n» Serviço: ${serviceName}\n» Código: #${orderCode}\n\nPode falar agora?`;
    sendWhatsAppMessage(phone, message);
};

// ===========================
// TOAST NOTIFICATIONS
// ===========================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle' };
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${escapeHtml(message)}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => container.contains(toast) && container.removeChild(toast), 300);
    }, 3000);
}

// ===========================
// CONNECTION MONITORING
// ===========================
function monitorConnection() {
    const updateStatus = connected => {
        const statusEl = document.getElementById('connectionStatus');
        const statusText = document.getElementById('statusText');
        if (statusEl && statusText) {
            connected ? statusEl.classList.remove('offline') : statusEl.classList.add('offline');
            statusText.textContent = connected ? 'Conectado' : 'Offline';
        }
    };
    
    window.addEventListener('online', () => { updateStatus(true); showToast('Conexão restaurada', 'success'); });
    window.addEventListener('offline', () => { updateStatus(false); showToast('Sem conexão', 'warning'); });
    updateStatus(navigator.onLine);
}

// Error Handlers
window.addEventListener('error', e => console.error('Erro:', e));
window.addEventListener('unhandledrejection', e => console.error('Promise rejeitada:', e.reason));
