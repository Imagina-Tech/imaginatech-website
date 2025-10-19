/* ==================================================
ARQUIVO: servicos/js/auth-ui.js
MÓDULO: Autenticação, Interface e Utilities
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 3.4 - Remoção Individual de Arquivos
IMPORTANTE: NÃO REMOVER ESTE CABEÇALHO DE IDENTIFICAÇÃO
==================================================
*/

import { state, AUTHORIZED_EMAILS } from './config.js';
import { 
    startServicesListener, 
    saveService, 
    deleteService, 
    updateStatus, 
    confirmStatusChange, 
    renderServices, 
    filterServices, 
    uploadFile,
    removeFileFromService
} from './services.js';

// ===========================
// AUTHENTICATION
// ===========================

export async function signInWithGoogle() {
    if (!state.auth) return showToast('Sistema não está pronto. Recarregue a página.', 'error');
    
    try {
        let user;
        
        if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
            console.log('🚀 Login no app nativo - usando Google Auth plugin');
            
            const { GoogleAuth } = Capacitor.Plugins;
            
            if (!GoogleAuth) {
                console.error('❌ Plugin GoogleAuth não encontrado');
                alert('DEBUG: Plugin GoogleAuth não encontrado');
                throw new Error('Plugin de autenticação não disponível');
            }
            
            try {
                console.log('🔧 Inicializando GoogleAuth...');
                await GoogleAuth.initialize();
                console.log('✅ GoogleAuth inicializado');
            } catch (initError) {
                console.log('⚠️ Plugin já inicializado:', initError);
            }
            
            console.log('📱 Chamando GoogleAuth.signIn()...');
            const googleUser = await GoogleAuth.signIn();
            
            console.log('✅ Google Auth retornou:', googleUser);
            
            alert('DEBUG: Google retornou:\n' + JSON.stringify({
                email: googleUser.email,
                name: googleUser.name,
                hasAuth: !!googleUser.authentication,
                hasIdToken: !!googleUser.authentication?.idToken,
                hasAccessToken: !!googleUser.authentication?.accessToken
            }, null, 2));
            
            if (!googleUser.authentication) {
                alert('DEBUG: googleUser.authentication é NULL ou UNDEFINED');
                throw new Error('Resposta do Google Auth inválida - authentication missing');
            }
            
            const idToken = googleUser.authentication.idToken;
            const accessToken = googleUser.authentication.accessToken;
            
            if (!idToken && !accessToken) {
                alert('DEBUG: Nenhum token encontrado!\nidToken: ' + idToken + '\naccessToken: ' + accessToken);
                throw new Error('Tokens de autenticação não encontrados');
            }
            
            console.log('🔥 Criando credencial do Firebase...');
            
            let credential;
            if (idToken) {
                console.log('🔐 Usando idToken');
                credential = firebase.auth.GoogleAuthProvider.credential(idToken, accessToken);
            } else {
                console.log('🔓 Usando apenas accessToken');
                credential = firebase.auth.GoogleAuthProvider.credential(null, accessToken);
            }
            
            console.log('🔥 Fazendo signInWithCredential...');
            const result = await state.auth.signInWithCredential(credential);
            
            user = result.user;
            console.log('👤 Usuário logado:', user.email);
            
        } else {
            console.log('🌐 Login no navegador web - usando Firebase popup');
            
            const result = await state.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
            user = result.user;
        }
        
        if (!AUTHORIZED_EMAILS.includes(user.email)) {
            state.currentUser = user;
            state.isAuthorized = false;
            showAccessDeniedScreen(user);
            showToast(`Olá ${user.displayName}! Esta área é restrita aos administradores.`, 'info');
            return;
        }
        
        state.currentUser = user;
        state.isAuthorized = true;
        showToast(`Bem-vindo, ${user.displayName}!`, 'success');
        
    } catch (error) {
        console.error('❌ ERRO COMPLETO:', error);
        
        alert('ERRO AO FAZER LOGIN:\n\n' + 
              'Mensagem: ' + (error.message || 'Sem mensagem') + '\n' +
              'Code: ' + (error.code || 'Sem código') + '\n' +
              'Error: ' + (error.error || 'Sem error'));
        
        if (error.code === 'auth/popup-closed-by-user' || error.message?.includes('popup_closed_by_user')) {
            showToast('Login cancelado', 'info');
        } else if (error.error === '12501') {
            showToast('Login cancelado pelo usuário', 'info');
        } else {
            showToast('Erro ao fazer login: ' + (error.message || 'Tente novamente'), 'error');
        }
    }
}

export async function signOut() {
    try {
        state.auth && await state.auth.signOut();
        showToast('Logout realizado com sucesso!', 'info');
    } catch (error) {
        console.error('Erro no logout:', error);
        showToast('Erro ao fazer logout.', 'error');
    }
}

export function checkAuthorization(user) {
    if (AUTHORIZED_EMAILS.includes(user.email)) {
        state.isAuthorized = true;
        showAdminDashboard(user);
        startServicesListener();
        loadClientsFromFirestore();
        migrateExistingClientsOnce();
    } else {
        state.isAuthorized = false;
        showAccessDeniedScreen(user);
    }
}

// ===========================
// UI MANAGEMENT
// ===========================
export function showLoginScreen() {
    document.getElementById('loginScreen')?.classList.remove('hidden');
    document.getElementById('adminDashboard')?.classList.add('hidden');
    document.getElementById('accessDeniedScreen')?.classList.add('hidden');
    state.servicesListener?.();
    state.servicesListener = null;
}

export function showAdminDashboard(user) {
    document.getElementById('loginScreen')?.classList.add('hidden');
    document.getElementById('adminDashboard')?.classList.remove('hidden');
    document.getElementById('accessDeniedScreen')?.classList.add('hidden');
    document.getElementById('userName') && (document.getElementById('userName').textContent = user.displayName || user.email);
    document.getElementById('userPhoto') && (document.getElementById('userPhoto').src = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || user.email) + '&background=00D4FF&color=fff');
}

export function showAccessDeniedScreen(user) {
    document.getElementById('loginScreen')?.classList.add('hidden');
    document.getElementById('adminDashboard')?.classList.add('hidden');
    
    let accessDeniedScreen = document.getElementById('accessDeniedScreen');
    if (!accessDeniedScreen) {
        accessDeniedScreen = document.createElement('div');
        accessDeniedScreen.id = 'accessDeniedScreen';
        accessDeniedScreen.className = 'access-denied-screen';
        accessDeniedScreen.innerHTML = `
            <div class="access-denied-container">
                <div class="access-denied-icon">
                    <i class="fas fa-lock"></i>
                </div>
                <h1>Acesso Restrito</h1>
                <p class="access-denied-message">
                    Olá ${user.displayName || user.email}, esta área é exclusiva para administradores.
                </p>
                <p class="access-denied-info">
                    Você está logado com: <strong>${user.email}</strong>
                </p>
                <div class="access-denied-actions">
                    <a href="/" class="btn-primary">
                        <i class="fas fa-home"></i>
                        Voltar ao Início
                    </a>
                    <a href="/acompanhar-pedido/" class="btn-secondary">
                        <i class="fas fa-cube"></i>
                        Acompanhar Pedido
                    </a>
                </div>
                <button class="btn-logout-denied" onclick="window.signOutGlobal()">
                    <i class="fas fa-sign-out-alt"></i>
                    Fazer Logout
                </button>
            </div>
        `;
        document.body.appendChild(accessDeniedScreen);
    } else {
        const message = accessDeniedScreen.querySelector('.access-denied-message');
        const info = accessDeniedScreen.querySelector('.access-denied-info');
        if (message) message.innerHTML = `Olá ${user.displayName || user.email}, esta área é exclusiva para administradores.`;
        if (info) info.innerHTML = `Você está logado com: <strong>${user.email}</strong>`;
    }
    
    accessDeniedScreen.classList.remove('hidden');
}

export const hideLoadingOverlay = () => document.getElementById('loadingOverlay')?.classList.add('hidden');

// ===========================
// CLIENT AUTOCOMPLETE
// ===========================
let clientsCache = [];

export async function loadClientsFromFirestore() {
    if (!state.db) return;
    
    try {
        const snapshot = await state.db.collection('clients').get();
        clientsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`✅ ${clientsCache.length} clientes carregados do Firestore`);
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
    }
}

async function migrateExistingClientsOnce() {
    const migrationKey = 'imaginatech_clients_migrated_v2';
    
    if (localStorage.getItem(migrationKey)) {
        console.log('✅ Migração de clientes já realizada anteriormente');
        return;
    }
    
    console.log('🔄 Iniciando migração de clientes existentes...');
    
    try {
        const servicesSnapshot = await state.db.collection('services').get();
        const clientsToMigrate = new Map();
        
        servicesSnapshot.forEach(doc => {
            const service = doc.data();
            if (service.client && service.client.trim()) {
                const clientKey = service.client.toLowerCase().trim();
                
                if (!clientsToMigrate.has(clientKey)) {
                    clientsToMigrate.set(clientKey, {
                        name: service.client,
                        cpf: service.clientCPF || '',
                        email: service.clientEmail || '',
                        phone: service.clientPhone || '',
                        address: service.deliveryMethod === 'sedex' && service.deliveryAddress ? service.deliveryAddress : null,
                        createdAt: new Date().toISOString()
                    });
                }
            }
        });
        
        console.log(`📊 ${clientsToMigrate.size} clientes únicos encontrados`);
        
        for (const [key, clientData] of clientsToMigrate) {
            try {
                await state.db.collection('clients').doc(key).set(clientData, { merge: true });
            } catch (error) {
                console.error(`Erro ao migrar cliente ${clientData.name}:`, error);
            }
        }
        
        localStorage.setItem(migrationKey, 'true');
        console.log('✅ Migração concluída com sucesso!');
        
        await loadClientsFromFirestore();
        
    } catch (error) {
        console.error('Erro na migração de clientes:', error);
    }
}

export async function saveClientToFirestore(clientData) {
    if (!state.db || !clientData.name) return;
    
    try {
        const clientKey = clientData.name.toLowerCase().trim();
        
        const dataToSave = {
            name: clientData.name,
            cpf: clientData.cpf || '',
            email: clientData.email || '',
            phone: clientData.phone || '',
            lastUpdated: new Date().toISOString()
        };
        
        if (clientData.address) {
            dataToSave.address = clientData.address;
        }
        
        await state.db.collection('clients').doc(clientKey).set(dataToSave, { merge: true });
        
        const index = clientsCache.findIndex(c => c.id === clientKey);
        if (index >= 0) {
            clientsCache[index] = { id: clientKey, ...dataToSave };
        } else {
            clientsCache.push({ id: clientKey, ...dataToSave });
        }
        
    } catch (error) {
        console.error('Erro ao salvar cliente:', error);
    }
}

export function handleClientNameInput(event) {
    const input = event.target;
    const value = input.value.trim().toLowerCase();
    const suggestionsDiv = document.getElementById('clientSuggestions');
    
    if (!suggestionsDiv) return;
    
    if (value.length < 2) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    const matches = clientsCache.filter(client => 
        client.name.toLowerCase().includes(value)
    ).slice(0, 5);
    
    if (matches.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    suggestionsDiv.innerHTML = matches.map(client => `
        <div class="client-suggestion-item" onclick="window.selectClient('${escapeHtml(client.id)}')">
            <div class="client-suggestion-name">${escapeHtml(client.name)}</div>
            <div class="client-suggestion-details">
                ${client.phone ? `📱 ${client.phone}` : ''}
                ${client.email ? ` • 📧 ${client.email}` : ''}
                ${client.cpf ? ` • 🆔 ${formatCPFDisplay(client.cpf)}` : ''}
            </div>
        </div>
    `).join('');
    
    suggestionsDiv.style.display = 'block';
}

export function selectClient(clientId) {
    const client = clientsCache.find(c => c.id === clientId);
    if (!client) return;
    
    document.getElementById('clientName').value = client.name;
    document.getElementById('clientCPF') && (document.getElementById('clientCPF').value = client.cpf || '');
    document.getElementById('clientEmail') && (document.getElementById('clientEmail').value = client.email || '');
    document.getElementById('clientPhone') && (document.getElementById('clientPhone').value = client.phone || '');
    
    if (client.address && document.getElementById('deliveryMethod')?.value === 'sedex') {
        document.getElementById('street') && (document.getElementById('street').value = client.address.street || '');
        document.getElementById('number') && (document.getElementById('number').value = client.address.number || '');
        document.getElementById('complement') && (document.getElementById('complement').value = client.address.complement || '');
        document.getElementById('neighborhood') && (document.getElementById('neighborhood').value = client.address.neighborhood || '');
        document.getElementById('city') && (document.getElementById('city').value = client.address.city || '');
        document.getElementById('state') && (document.getElementById('state').value = client.address.state || '');
        document.getElementById('cep') && (document.getElementById('cep').value = client.address.cep || '');
    }
    
    document.getElementById('clientSuggestions').style.display = 'none';
    
    updateNotificationOptions();
}

export function copyClientDataToDelivery() {
    const clientName = document.getElementById('clientName')?.value || '';
    const clientPhone = document.getElementById('clientPhone')?.value || '';
    
    const pickupLocation = document.getElementById('pickupLocation');
    const pickupWhatsapp = document.getElementById('pickupWhatsapp');
    
    if (pickupLocation && !pickupLocation.value) {
        pickupLocation.value = clientName;
    }
    
    if (pickupWhatsapp && !pickupWhatsapp.value) {
        pickupWhatsapp.value = clientPhone;
    }
}

export function formatCPF(event) {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 9) {
        value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (value.length > 6) {
        value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    } else if (value.length > 3) {
        value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    }
    
    event.target.value = value;
}

function formatCPFDisplay(cpf) {
    if (!cpf) return '';
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length === 11) {
        return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cpf;
}

// ===========================
// MODAL MANAGEMENT
// ===========================
export function openAddModal() {
    state.editingServiceId = null;
    state.selectedFiles = [];
    state.selectedImages = [];
    
    document.getElementById('modalTitle') && (document.getElementById('modalTitle').textContent = 'Novo Serviço');
    document.getElementById('saveButtonText') && (document.getElementById('saveButtonText').textContent = 'Salvar Serviço');
    document.getElementById('serviceForm')?.reset();
    document.getElementById('orderCodeDisplay') && (document.getElementById('orderCodeDisplay').style.display = 'none');
    
    setupDateFields();
    ['filesInfo', 'imagePreview'].forEach(id => {
        const el = document.getElementById(id);
        el && (el.style.display = 'none');
    });
    
    const previewContainer = document.getElementById('imagePreviewContainer');
    if (previewContainer) previewContainer.innerHTML = '';
    
    const filesPreviewContainer = document.getElementById('filesPreviewContainer');
    if (filesPreviewContainer) filesPreviewContainer.innerHTML = '';
    
    document.getElementById('servicePriority') && (document.getElementById('servicePriority').value = 'media');
    document.getElementById('serviceStatus') && (document.getElementById('serviceStatus').value = 'pendente');
    document.getElementById('dateUndefined') && (document.getElementById('dateUndefined').checked = false);
    
    const notificationSection = document.getElementById('notificationSection');
    if (notificationSection) notificationSection.style.display = 'none';
    
    document.getElementById('clientSuggestions').style.display = 'none';
    
    hideAllDeliveryFields();
    document.getElementById('serviceModal')?.classList.add('active');
}

export function openEditModal(serviceId) {
    const service = state.services.find(s => s.id === serviceId);
    if (!service) return;
    
    state.editingServiceId = serviceId;
    state.selectedFiles = [];
    state.selectedImages = [];
    
    document.getElementById('modalTitle') && (document.getElementById('modalTitle').textContent = 'Editar Serviço');
    document.getElementById('saveButtonText') && (document.getElementById('saveButtonText').textContent = 'Atualizar Serviço');
    
    const form = document.getElementById('serviceForm');
    if (form) {
        document.getElementById('serviceName') && (document.getElementById('serviceName').value = service.name || '');
        document.getElementById('clientName') && (document.getElementById('clientName').value = service.client || '');
        document.getElementById('clientCPF') && (document.getElementById('clientCPF').value = service.clientCPF || '');
        document.getElementById('clientEmail') && (document.getElementById('clientEmail').value = service.clientEmail || '');
        document.getElementById('clientPhone') && (document.getElementById('clientPhone').value = service.clientPhone || '');
        document.getElementById('serviceDescription') && (document.getElementById('serviceDescription').value = service.description || '');
        document.getElementById('serviceMaterial') && (document.getElementById('serviceMaterial').value = service.material || '');
        document.getElementById('serviceColor') && (document.getElementById('serviceColor').value = service.color || '');
        document.getElementById('servicePriority') && (document.getElementById('servicePriority').value = service.priority || 'media');
        document.getElementById('startDate') && (document.getElementById('startDate').value = service.startDate || '');
        document.getElementById('dueDate') && (document.getElementById('dueDate').value = service.dueDate || '');
        document.getElementById('dateUndefined') && (document.getElementById('dateUndefined').checked = service.dateUndefined || false);
        document.getElementById('serviceValue') && (document.getElementById('serviceValue').value = service.value || '');
        document.getElementById('serviceWeight') && (document.getElementById('serviceWeight').value = service.weight || '');
        document.getElementById('serviceObservations') && (document.getElementById('serviceObservations').value = service.observations || '');
        document.getElementById('deliveryMethod') && (document.getElementById('deliveryMethod').value = service.deliveryMethod || '');
        document.getElementById('serviceStatus') && (document.getElementById('serviceStatus').value = service.status || 'pendente');
        
        toggleDateInput();
        toggleDeliveryFields();
        
        if (service.deliveryMethod === 'sedex' && service.deliveryAddress) {
            Object.entries(service.deliveryAddress).forEach(([key, value]) => {
                const field = document.getElementById(key);
                field && (field.value = value || '');
            });
            
            if (service.trackingCode && (service.status === 'retirada' || service.status === 'entregue')) {
                const trackingField = document.getElementById('editTrackingCode');
                if (trackingField) {
                    trackingField.value = service.trackingCode;
                    trackingField.parentElement.style.display = 'block';
                }
            }
        } else if (service.deliveryMethod === 'retirada' && service.pickupInfo) {
            document.getElementById('pickupLocation') && (document.getElementById('pickupLocation').value = service.pickupInfo.location || '');
            document.getElementById('pickupWhatsapp') && (document.getElementById('pickupWhatsapp').value = service.pickupInfo.whatsapp || '');
        }
    }
    
    const orderCodeDisplay = document.getElementById('orderCodeDisplay');
    if (orderCodeDisplay) {
        orderCodeDisplay.style.display = 'block';
        const codeValue = document.getElementById('orderCodeValue');
        codeValue && (codeValue.textContent = service.orderCode || 'N/A');
    }
    
    const filesPreview = document.getElementById('filesPreview');
    const filesPreviewContainer = document.getElementById('filesPreviewContainer');
    
    if (service.files && service.files.length > 0 && filesPreview && filesPreviewContainer) {
        filesPreviewContainer.innerHTML = service.files.map((file, idx) => `
            <div class="file-item-wrapper existing-file">
                <div class="file-item-info">
                    <i class="fas fa-file"></i>
                    <span>${escapeHtml(file.name)}</span>
                </div>
                <span class="existing-badge">Anexado</span>
            </div>
        `).join('');
        filesPreview.style.display = 'block';
    }
    
    const imagePreview = document.getElementById('imagePreview');
    const imagePreviewContainer = document.getElementById('imagePreviewContainer');
    
    if (service.images && service.images.length > 0 && imagePreview && imagePreviewContainer) {
        imagePreviewContainer.innerHTML = service.images.map((img, idx) => `
            <div class="preview-image-wrapper existing-image">
                <img src="${img.url}" alt="Imagem ${idx + 1}">
                <span class="existing-badge">Anexada</span>
            </div>
        `).join('');
        imagePreview.style.display = 'block';
    }
    
    if (service.instagramPhoto && imagePreview && imagePreviewContainer) {
        const instagramHTML = `
            <div class="preview-image-wrapper existing-image">
                <img src="${service.instagramPhoto}" alt="Foto Instagram">
                <span class="existing-badge badge-instagram">Instagram</span>
            </div>
        `;
        imagePreviewContainer.insertAdjacentHTML('beforeend', instagramHTML);
        imagePreview.style.display = 'block';
    }
    
    if (service.packagedPhotos && service.packagedPhotos.length > 0 && imagePreview && imagePreviewContainer) {
        service.packagedPhotos.forEach((photo, idx) => {
            const packagedHTML = `
                <div class="preview-image-wrapper existing-image">
                    <img src="${photo.url}" alt="Produto Embalado ${idx + 1}">
                    <span class="existing-badge badge-packaged">Embalado</span>
                </div>
            `;
            imagePreviewContainer.insertAdjacentHTML('beforeend', packagedHTML);
        });
        imagePreview.style.display = 'block';
    }
    
    const notificationSection = document.getElementById('notificationSection');
    if (notificationSection) notificationSection.style.display = 'none';
    
    document.getElementById('clientSuggestions').style.display = 'none';
    
    document.getElementById('serviceModal')?.classList.add('active');
}

export const closeModal = () => {
    document.getElementById('serviceModal')?.classList.remove('active');
    state.editingServiceId = null;
    state.selectedFiles = [];
    state.selectedImages = [];
};

export const closeStatusModal = () => {
    document.getElementById('statusModal')?.classList.remove('active');
    state.pendingStatusUpdate = null;
    state.pendingInstagramPhotos = [];
    state.pendingPackagedPhotos = [];
    
    const instagramPreview = document.getElementById('instagramPhotoPreview');
    const packagedPreview = document.getElementById('packagedPhotoPreview');
    
    if (instagramPreview) instagramPreview.style.display = 'none';
    if (packagedPreview) packagedPreview.style.display = 'none';
};

export const closeTrackingModal = () => document.getElementById('trackingModal')?.classList.remove('active');
export const closeDeliveryModal = () => document.getElementById('deliveryModal')?.classList.remove('active');

// ===========================
// DELIVERY INFO
// ===========================
export function showDeliveryInfo(serviceId) {
    const service = state.services.find(s => s.id === serviceId);
    if (!service) return;
    
    const modal = document.getElementById('deliveryModal');
    const content = document.getElementById('deliveryInfoContent');
    
    if (!modal || !content) return;
    
    let html = `<h3><i class="fas ${getDeliveryIcon(service.deliveryMethod)}"></i> ${getDeliveryMethodName(service.deliveryMethod)}</h3>`;
    
    if (service.deliveryMethod === 'sedex' && service.deliveryAddress) {
        const addr = service.deliveryAddress;
        html += `
            <div class="delivery-details">
                <p><strong>Endereço de Entrega:</strong></p>
                <p>${addr.street}, ${addr.number}${addr.complement ? ' - ' + addr.complement : ''}</p>
                <p>${addr.neighborhood}</p>
                <p>${addr.city} - ${addr.state}</p>
                <p>CEP: ${addr.cep}</p>
                ${service.trackingCode ? `
                    <p style="margin-top: 1rem;"><strong>Código de Rastreio:</strong></p>
                    <p style="font-family: 'Orbitron', monospace; font-size: 1.1rem; color: var(--neon-purple);">${service.trackingCode}</p>
                    <a href="https://rastreamento.correios.com.br/app/index.php" target="_blank" class="btn-primary" style="margin-top: 1rem; display: inline-flex;">
                        <i class="fas fa-external-link-alt"></i> Rastrear nos Correios
                    </a>
                ` : ''}
            </div>
        `;
    } else if (service.deliveryMethod === 'retirada' && service.pickupInfo) {
        html += `
            <div class="delivery-details">
                <p><strong>Local de Retirada:</strong></p>
                <p>${service.pickupInfo.location || 'Não especificado'}</p>
                ${service.pickupInfo.whatsapp ? `
                    <p style="margin-top: 1rem;"><strong>Contato:</strong></p>
                    <p>${service.pickupInfo.whatsapp}</p>
                ` : ''}
            </div>
        `;
    } else if (service.deliveryMethod === 'uber') {
        html += `
            <div class="delivery-details">
                <p><i class="fas fa-motorcycle"></i> <strong>Entrega via Uber Flash</strong></p>
                <p>Entrega rápida por motoboy</p>
            </div>
        `;
    } else if (service.deliveryMethod === 'definir') {
        html += `
            <div class="delivery-details">
                <p><i class="fas fa-handshake"></i> <strong>Entrega a Combinar</strong></p>
                <p>Forma de entrega será definida diretamente com o cliente</p>
            </div>
        `;
    }
    
    content.innerHTML = html;
    modal.classList.add('active');
}

// ===========================
// STATUS MODAL
// ===========================
export function showStatusModalWithPhoto(service, newStatus) {
    const modal = document.getElementById('statusModal');
    const message = document.getElementById('statusModalMessage');
    const instagramField = document.getElementById('instagramPhotoField');
    const packagedField = document.getElementById('packagedPhotoField');
    const whatsappOption = document.getElementById('whatsappOption');
    const emailOption = document.getElementById('emailOption');
    
    if (!modal) return;
    
    if (message) {
        message.textContent = `Confirmar mudança de status para "${getStatusLabel(newStatus)}"?`;
    }
    
    if (instagramField) instagramField.style.display = 'none';
    if (packagedField) packagedField.style.display = 'none';
    
    if (whatsappOption) whatsappOption.style.display = service.clientPhone ? 'block' : 'none';
    if (emailOption) emailOption.style.display = service.clientEmail ? 'block' : 'none';
    
    modal.classList.add('active');
}

export function showStatusModalWithPackagedPhoto(service, newStatus) {
    const modal = document.getElementById('statusModal');
    const message = document.getElementById('statusModalMessage');
    const packagedField = document.getElementById('packagedPhotoField');
    const instagramField = document.getElementById('instagramPhotoField');
    const whatsappOption = document.getElementById('whatsappOption');
    const emailOption = document.getElementById('emailOption');
    
    if (!modal) return;
    
    if (message) {
        message.textContent = `Anexe foto(s) do produto embalado para marcar como "${getStatusLabel(newStatus)}"`;
    }
    
    if (packagedField) packagedField.style.display = 'block';
    if (instagramField) instagramField.style.display = 'none';
    
    if (whatsappOption) whatsappOption.style.display = service.clientPhone ? 'block' : 'none';
    if (emailOption) emailOption.style.display = service.clientEmail ? 'block' : 'none';
    
    modal.classList.add('active');
}

export function showTrackingCodeModal(service) {
    const modal = document.getElementById('trackingModal');
    const input = document.getElementById('trackingCode');
    
    if (!modal || !input) return;
    
    input.value = service.trackingCode || '';
    modal.classList.add('active');
}

export async function confirmTrackingCode() {
    if (!state.pendingStatusUpdate) return;
    
    const trackingCode = document.getElementById('trackingCode')?.value.trim().toUpperCase();
    
    if (!trackingCode) {
        return showToast('Digite o código de rastreio', 'error');
    }
    
    const { serviceId, newStatus } = state.pendingStatusUpdate;
    
    try {
        await state.db.collection('services').doc(serviceId).update({
            trackingCode,
            status: newStatus,
            readyAt: new Date().toISOString(),
            postedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updatedBy: state.currentUser.email
        });
        
        showToast('Código de rastreio salvo!', 'success');
        closeTrackingModal();
        state.pendingStatusUpdate = null;
    } catch (error) {
        console.error('Erro ao salvar código:', error);
        showToast('Erro ao salvar código de rastreio', 'error');
    }
}

// ===========================
// IMAGE & FILE VIEWERS
// ===========================
export function showServiceImages(serviceId) {
    const service = state.services.find(s => s.id === serviceId);
    if (!service) return;
    
    const allImages = [];
    
    if (service.images && service.images.length > 0) {
        service.images.forEach(img => {
            allImages.push({
                url: img.url,
                name: img.name || 'Imagem',
                type: 'regular'
            });
        });
    }
    
    if (service.imageUrl) {
        allImages.push({
            url: service.imageUrl,
            name: 'Imagem',
            type: 'regular'
        });
    }
    
    if (service.instagramPhoto) {
        allImages.push({
            url: service.instagramPhoto,
            name: 'Foto Instagramável',
            type: 'instagram'
        });
    }
    
    if (service.packagedPhotos && service.packagedPhotos.length > 0) {
        service.packagedPhotos.forEach(photo => {
            allImages.push({
                url: photo.url,
                name: photo.name || 'Produto Embalado',
                type: 'packaged'
            });
        });
    }
    
    if (allImages.length > 0) {
        showImageModal(allImages, service.name || 'Serviço');
    }
}

export function showServiceFiles(serviceId) {
    const service = state.services.find(s => s.id === serviceId);
    if (!service) return;
    
    const allFiles = [];
    
    if (service.files && service.files.length > 0) {
        allFiles.push(...service.files);
    } else if (service.fileUrl) {
        allFiles.push({
            url: service.fileUrl,
            name: service.fileName || 'Arquivo',
            size: service.fileSize || 0
        });
    }
    
    if (allFiles.length > 0) {
        showFilesModal(service.name || 'Serviço', allFiles, serviceId);
    }
}

export function showFilesModal(serviceName, files, serviceId) {
    const modal = document.getElementById('filesViewerModal');
    const title = document.getElementById('filesViewerTitle');
    const container = document.getElementById('filesListContainer');
    
    if (!modal || !title || !container) return;
    
    title.innerHTML = `<i class="fas fa-file"></i> Arquivos de ${escapeHtml(serviceName)}`;
    
    if (!files || files.length === 0) {
        container.innerHTML = '<p class="no-files-message">Nenhum arquivo anexado</p>';
    } else {
        container.innerHTML = files.map((file, index) => {
            const fileName = file.name || 'arquivo-sem-nome';
            const fileSize = file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Tamanho desconhecido';
            const uploadDate = file.uploadedAt ? new Date(file.uploadedAt).toLocaleDateString('pt-BR') : '';
            const fileExtension = fileName.split('.').pop().toLowerCase();
            
            let fileIcon = 'fa-file';
            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension)) fileIcon = 'fa-file-image';
            else if (['pdf'].includes(fileExtension)) fileIcon = 'fa-file-pdf';
            else if (['stl', 'obj', '3mf', 'gcode'].includes(fileExtension)) fileIcon = 'fa-cube';
            else if (['zip', 'rar', '7z'].includes(fileExtension)) fileIcon = 'fa-file-zipper';
            
            return `
                <div class="file-item">
                    <div class="file-icon-wrapper">
                        <i class="fas ${fileIcon}"></i>
                    </div>
                    <div class="file-info">
                        <div class="file-name">${escapeHtml(fileName)}</div>
                        <div class="file-meta">
                            <span>${fileSize}</span>
                            ${uploadDate ? `<span>• ${uploadDate}</span>` : ''}
                        </div>
                    </div>
                    <div class="file-actions">
                        <button class="btn-icon-action" onclick="window.open('${file.url}', '_blank')" title="Abrir arquivo">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                        <a href="${file.url}" download="${fileName}" class="btn-icon-action" title="Baixar arquivo">
                            <i class="fas fa-download"></i>
                        </a>
                        ${state.isAuthorized ? `
                        <button class="btn-icon-action btn-remove-file" 
                                onclick="window.removeFileFromService('${serviceId}', ${index}, '${file.url}')" 
                                title="Remover arquivo">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    modal.classList.add('show');
}

export const closeFilesModal = () => {
    const modal = document.getElementById('filesViewerModal');
    if (modal) modal.classList.remove('show');
};

export function showImageModal(images, serviceName, startIndex = 0) {
    if (typeof images === 'string') {
        images = [{ url: images, name: serviceName }];
    }
    
    state.currentImageGallery = images;
    state.currentImageIndex = startIndex;
    
    const modal = document.getElementById('imageViewerModal');
    if (!modal) return;
    
    preloadAdjacentImages();
    updateImageViewer();
    modal.classList.add('active');
}

function preloadAdjacentImages() {
    const gallery = state.currentImageGallery;
    const currentIdx = state.currentImageIndex;
    
    [currentIdx - 1, currentIdx + 1].forEach(idx => {
        if (idx >= 0 && idx < gallery.length) {
            const img = new Image();
            img.src = gallery[idx].url;
        }
    });
}

export function updateImageViewer() {
    const img = document.getElementById('viewerImage');
    const title = document.getElementById('viewerTitle');
    const counter = document.getElementById('imageCounter');
    const prevBtn = document.getElementById('prevImageBtn');
    const nextBtn = document.getElementById('nextImageBtn');
    const downloadBtn = document.getElementById('downloadImageBtn');
    
    if (!img || !state.currentImageGallery.length) return;
    
    const currentImage = state.currentImageGallery[state.currentImageIndex];
    img.src = currentImage.url;
    
    if (title) {
        let imageLabel = currentImage.name || `Imagem ${state.currentImageIndex + 1}`;
        
        if (currentImage.type === 'instagram') {
            imageLabel += ' 📸 (Instagramável)';
        } else if (currentImage.type === 'packaged') {
            imageLabel += ' 📦 (Produto Embalado)';
        }
        
        title.textContent = imageLabel;
    }
    
    if (counter) {
        counter.textContent = `${state.currentImageIndex + 1} / ${state.currentImageGallery.length}`;
        counter.style.display = state.currentImageGallery.length > 1 ? 'block' : 'none';
    }
    
    if (prevBtn) {
        prevBtn.style.display = state.currentImageGallery.length > 1 ? 'block' : 'none';
        prevBtn.disabled = state.currentImageIndex === 0;
    }
    
    if (nextBtn) {
        nextBtn.style.display = state.currentImageGallery.length > 1 ? 'block' : 'none';
        nextBtn.disabled = state.currentImageIndex === state.currentImageGallery.length - 1;
    }
    
    if (downloadBtn) {
        downloadBtn.onclick = () => downloadFile(currentImage.url, currentImage.name || 'imagem');
    }
    
    preloadAdjacentImages();
}

export function prevImage() {
    if (state.currentImageIndex > 0) {
        state.currentImageIndex--;
        updateImageViewer();
    }
}

export function nextImage() {
    if (state.currentImageIndex < state.currentImageGallery.length - 1) {
        state.currentImageIndex++;
        updateImageViewer();
    }
}

export const closeImageModal = () => {
    document.getElementById('imageViewerModal')?.classList.remove('active');
    state.currentImageGallery = [];
    state.currentImageIndex = 0;
};

// ===========================
// FILE & IMAGE HANDLING
// ===========================
export function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return state.selectedFiles = [];
    
    const validExts = ['.stl', '.obj', '.step', '.stp', '.3mf', '.zip', '.txt', '.mtl', '.rar', '.7z', '.pdf'];
    const maxSize = 52428800;
    
    const validFiles = files.filter(file => {
        const fileName = file.name.toLowerCase();
        const isValid = validExts.some(ext => fileName.endsWith(ext));
        
        if (!isValid) {
            showToast(`Formato inválido: ${file.name}`, 'error');
            return false;
        }
        if (file.size > maxSize) {
            showToast(`Arquivo muito grande: ${file.name}. Máximo: 50MB`, 'error');
            return false;
        }
        return true;
    });
    
    state.selectedFiles = validFiles;
    
    const preview = document.getElementById('filesPreview');
    const previewContainer = document.getElementById('filesPreviewContainer');
    
    if (validFiles.length > 0 && preview && previewContainer) {
        previewContainer.innerHTML = '';
        
        validFiles.forEach((file, index) => {
            const fileWrapper = document.createElement('div');
            fileWrapper.className = 'file-item-wrapper';
            fileWrapper.innerHTML = `
                <div class="file-item-info">
                    <i class="fas fa-file"></i>
                    <span>${escapeHtml(file.name)}</span>
                </div>
                <button type="button" class="btn-remove-preview" onclick="window.removeFilePreview(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            previewContainer.appendChild(fileWrapper);
        });
        
        preview.style.display = 'block';
    }
}

export function handleImageSelect(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return state.selectedImages = [];
    
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
    const maxSize = 5242880;
    
    const validFiles = files.filter(file => {
        if (!validTypes.includes(file.type)) {
            showToast(`Formato inválido: ${file.name}. Use JPEG, PNG, GIF, WebP, BMP ou SVG`, 'error');
            return false;
        }
        if (file.size > maxSize) {
            showToast(`Arquivo muito grande: ${file.name}. Máximo: 5MB`, 'error');
            return false;
        }
        return true;
    });
    
    state.selectedImages = validFiles;
    
    const preview = document.getElementById('imagePreview');
    const previewContainer = document.getElementById('imagePreviewContainer');
    
    if (validFiles.length > 0 && preview && previewContainer) {
        previewContainer.innerHTML = '';
        
        validFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = e => {
                const imgWrapper = document.createElement('div');
                imgWrapper.className = 'preview-image-wrapper';
                imgWrapper.innerHTML = `
                    <img src="${e.target.result}" alt="Preview ${index + 1}">
                    <button type="button" class="btn-remove-preview" onclick="window.removePreviewImage(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                previewContainer.appendChild(imgWrapper);
            };
            reader.readAsDataURL(file);
        });
        
        preview.style.display = 'block';
    }
}

export function removePreviewImage(index) {
    state.selectedImages.splice(index, 1);
    const fileInput = document.getElementById('serviceImage');
    if (fileInput) fileInput.value = '';
    
    if (state.selectedImages.length === 0) {
        const preview = document.getElementById('imagePreview');
        if (preview) preview.style.display = 'none';
    } else {
        const event = { target: { files: state.selectedImages } };
        handleImageSelect(event);
    }
}

export function removeFilePreview(index) {
    state.selectedFiles.splice(index, 1);
    const fileInput = document.getElementById('serviceFiles');
    if (fileInput) fileInput.value = '';
    
    if (state.selectedFiles.length === 0) {
        const filesPreview = document.getElementById('filesPreview');
        if (filesPreview) filesPreview.style.display = 'none';
    } else {
        const filesPreview = document.getElementById('filesPreview');
        const previewContainer = document.getElementById('filesPreviewContainer');
        
        if (previewContainer && filesPreview) {
            previewContainer.innerHTML = '';
            
            state.selectedFiles.forEach((file, idx) => {
                const fileWrapper = document.createElement('div');
                fileWrapper.className = 'file-item-wrapper';
                fileWrapper.innerHTML = `
                    <div class="file-item-info">
                        <i class="fas fa-file"></i>
                        <span>${escapeHtml(file.name)}</span>
                    </div>
                    <button type="button" class="btn-remove-preview" onclick="window.removeFilePreview(${idx})">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                previewContainer.appendChild(fileWrapper);
            });
        }
    }
}

export const removeFile = () => {
    state.selectedFiles = [];
    const fileInput = document.getElementById('serviceFiles');
    if (fileInput) fileInput.value = '';
    
    const filesPreview = document.getElementById('filesPreview');
    if (filesPreview) filesPreview.style.display = 'none';
};

export function downloadFile(url, fileName) {
    const link = Object.assign(document.createElement('a'), { href: url, download: fileName || 'arquivo', target: '_blank' });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

state.pendingInstagramPhotos = [];

export function handleInstagramPhotoSelect(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 5242880;

    const validFiles = files.filter(file => {
        if (!validTypes.includes(file.type)) {
            showToast(`Formato inválido: ${file.name}. Use JPEG ou PNG.`, 'error');
            return false;
        }
        if (file.size > maxSize) {
            showToast(`Foto muito grande: ${file.name}. Máximo: 5MB`, 'error');
            return false;
        }
        return true;
    });

    state.pendingInstagramPhotos.push(...validFiles);
    renderInstagramPhotoPreviews();
}

function renderInstagramPhotoPreviews() {
    const preview = document.getElementById('instagramPhotoPreview');
    const previewGrid = document.getElementById('instagramPhotoPreviewGrid');

    if (!preview || !previewGrid) return;

    if (state.pendingInstagramPhotos.length === 0) {
        preview.style.display = 'none';
        previewGrid.innerHTML = '';
        return;
    }

    preview.style.display = 'block';
    previewGrid.innerHTML = '';

    state.pendingInstagramPhotos.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = e => {
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'preview-image-wrapper';
            imgWrapper.innerHTML = `
                <img src="${e.target.result}" alt="Preview ${index + 1}">
                <button type="button" class="btn-remove-preview" onclick="window.removeInstagramPhoto(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            previewGrid.appendChild(imgWrapper);
        };
        reader.readAsDataURL(file);
    });
}

function removeInstagramPhoto(index) {
    state.pendingInstagramPhotos.splice(index, 1);
    const fileInput = document.getElementById('instagramPhotoInput');
    if (fileInput) fileInput.value = '';
    renderInstagramPhotoPreviews();
}

export function handlePackagedPhotoSelect(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 5242880;

    const validFiles = files.filter(file => {
        if (!validTypes.includes(file.type)) {
            showToast(`Formato inválido: ${file.name}. Use JPEG ou PNG.`, 'error');
            return false;
        }
        if (file.size > maxSize) {
            showToast(`Foto muito grande: ${file.name}. Máximo: 5MB.`, 'error');
            return false;
        }
        return true;
    });

    state.pendingPackagedPhotos.push(...validFiles);
    renderPackagedPhotoPreviews();
}

function renderPackagedPhotoPreviews() {
    const preview = document.getElementById('packagedPhotoPreview');
    const previewGrid = document.getElementById('packagedPhotoPreviewGrid');

    if (!preview || !previewGrid) return;

    if (state.pendingPackagedPhotos.length === 0) {
        preview.style.display = 'none';
        previewGrid.innerHTML = '';
        return;
    }

    preview.style.display = 'block';
    previewGrid.innerHTML = '';

    state.pendingPackagedPhotos.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = e => {
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'preview-image-wrapper';
            imgWrapper.innerHTML = `
                <img src="${e.target.result}" alt="Preview ${index + 1}">
                <button type="button" class="btn-remove-preview" onclick="window.removePackagedPhoto(${index})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            previewGrid.appendChild(imgWrapper);
        };
        reader.readAsDataURL(file);
    });
}

function removePackagedPhoto(index) {
    state.pendingPackagedPhotos.splice(index, 1);
    const fileInput = document.getElementById('packagedPhotoInput');
    if (fileInput) fileInput.value = '';
    renderPackagedPhotoPreviews();
}

// ===========================
// FORM UTILITIES
// ===========================
export function setupDateFields() {
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

export function toggleDateInput() {
    const dateInput = document.getElementById('dueDate');
    const checkbox = document.getElementById('dateUndefined');
    if (dateInput && checkbox) {
        dateInput.disabled = dateInput.required = checkbox.checked;
        dateInput.value = checkbox.checked ? '' : getTodayBrazil();
    }
}

export function toggleDeliveryFields() {
    const method = document.getElementById('deliveryMethod')?.value;
    const deliveryFields = document.getElementById('deliveryFields');
    const pickupFields = document.getElementById('pickupFields');
    
    hideAllDeliveryFields();
    
    if (method === 'sedex' && deliveryFields) {
        deliveryFields.classList.add('active');
    } else if (method === 'retirada' && pickupFields) {
        pickupFields.classList.add('active');
    }
}

function hideAllDeliveryFields() {
    document.getElementById('deliveryFields')?.classList.remove('active');
    document.getElementById('pickupFields')?.classList.remove('active');
}

export function updateNotificationOptions() {
    const phone = document.getElementById('clientPhone')?.value;
    const email = document.getElementById('clientEmail')?.value;
    const notificationSection = document.getElementById('notificationSection');
    
    if (notificationSection && (phone || email)) {
        notificationSection.style.display = 'block';
    } else if (notificationSection) {
        notificationSection.style.display = 'none';
    }
}

export async function buscarCEP() {
    const cepInput = document.getElementById('cep');
    if (!cepInput) return;
    
    const cep = cepInput.value.replace(/\D/g, '');
    
    if (cep.length !== 8) {
        return showToast('CEP inválido', 'error');
    }
    
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        
        if (data.erro) {
            return showToast('CEP não encontrado', 'error');
        }
        
        document.getElementById('street') && (document.getElementById('street').value = data.logradouro || '');
        document.getElementById('neighborhood') && (document.getElementById('neighborhood').value = data.bairro || '');
        document.getElementById('city') && (document.getElementById('city').value = data.localidade || '');
        document.getElementById('state') && (document.getElementById('state').value = data.uf || '');
        
        document.getElementById('number')?.focus();
        
        showToast('CEP encontrado!', 'success');
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        showToast('Erro ao buscar CEP', 'error');
    }
}

export const formatPhoneNumber = event => {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    if (value.length > 10) {
        value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (value.length > 6) {
        value = value.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    } else if (value.length > 2) {
        value = value.replace(/(\d{2})(\d{0,5})/, '($1) $2');
    }
    
    event.target.value = value;
};

export const formatCEP = event => {
    let value = event.target.value.replace(/\D/g, '');
    if (value.length > 8) value = value.slice(0, 8);
    value = value.replace(/(\d{5})(\d)/, '$1-$2');
    event.target.value = value;
};

export const contactClient = (phone, serviceName, orderCode) => {
    const message = `Olá!\n\nSobre seu pedido:\n\n» Serviço: ${serviceName}\n» Código: #${orderCode}\n\nPode falar agora?`;
    sendWhatsAppMessage(phone, message);
};

const sendWhatsAppMessage = (phone, message) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
};

export async function sendEmailNotification(service) {
    if (!service.clientEmail || service.clientEmail.trim().length === 0) return;
    
    try {
        await emailjs.send('service_vxndoi5', 'template_cwrmts1', {
            to_email: service.clientEmail,
            client_name: service.client || 'Cliente',
            order_code: service.orderCode || 'N/A',
            reply_to: '3d3printers@gmail.com'
        });
        console.log('Email enviado com sucesso para:', service.clientEmail);
        showToast('📧 Email de notificação enviado!', 'success');
    } catch (error) {
        console.error('Erro ao enviar email:', error);
        if (window.location.hostname === 'localhost') {
            showToast('Erro ao enviar email', 'error');
        }
    }
}

// ===========================
// UTILITY FUNCTIONS
// ===========================
export const showToast = (message, type = 'info') => {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

export const escapeHtml = text => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

export const getTodayBrazil = () => {
    const now = new Date();
    now.setHours(now.getHours() - 3);
    return now.toISOString().split('T')[0];
};

export const parseDateBrazil = dateStr => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
};

export const calculateDaysRemaining = dueDate => {
    if (!dueDate) return null;
    const due = parseDateBrazil(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
};

export const formatDate = dateStr => {
    if (!dateStr) return 'N/A';
    const date = parseDateBrazil(dateStr);
    return date ? date.toLocaleDateString('pt-BR') : 'N/A';
};

export const formatMoney = value => {
    if (!value) return 'R$ 0,00';
    return `R$ ${parseFloat(value).toFixed(2).replace('.', ',')}`;
};

export const formatColorName = color => {
    if (!color) return '';
    return color.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

export const formatDaysText = days => {
    if (days === null) return 'N/A';
    if (days < 0) return `${Math.abs(days)} dias atrasado`;
    if (days === 0) return 'Vence hoje';
    if (days === 1) return 'Vence amanhã';
    return `${days} dias restantes`;
};

export const getDaysColor = days => {
    if (days === null) return 'var(--text-secondary)';
    if (days < 0) return 'var(--neon-red)';
    if (days === 0) return 'var(--neon-orange)';
    if (days <= 2) return 'var(--neon-yellow)';
    return 'rgba(255, 255, 255, 0.2)';
};

export const getDeliveryMethodName = method => {
    const names = {
        'sedex': 'Correios SEDEX',
        'retirada': 'Retirada no Local',
        'uber': 'Uber Flash',
        'definir': 'A Combinar'
    };
    return names[method] || 'Não definido';
};

export const getDeliveryIcon = method => {
    const icons = {
        'sedex': 'fa-box',
        'retirada': 'fa-store',
        'uber': 'fa-motorcycle',
        'definir': 'fa-handshake'
    };
    return icons[method] || 'fa-truck';
};

export const getStatusLabel = status => {
    const labels = {
        'pendente': 'Pendente',
        'producao': 'Produção',
        'concluido': 'Concluído',
        'retirada': 'Pronto/Postado',
        'entregue': 'Entregue'
    };
    return labels[status] || status;
};

export const getStatusIcon = status => {
    const icons = {
        'pendente': 'fa-clock',
        'producao': 'fa-cogs',
        'concluido': 'fa-check-circle',
        'retirada': 'fa-box-open',
        'entregue': 'fa-handshake'
    };
    return icons[status] || 'fa-question';
};

export const isStatusCompleted = (currentStatus, checkStatus) => {
    const order = ['pendente', 'producao', 'concluido', 'retirada', 'entregue'];
    const currentIndex = order.indexOf(currentStatus);
    const checkIndex = order.indexOf(checkStatus);
    return checkIndex < currentIndex;
};

export function monitorConnection() {
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

// ===========================
// GLOBAL WINDOW FUNCTIONS
// ===========================
window.signInWithGoogle = signInWithGoogle;
window.signOutGlobal = signOut;
window.openAddModal = openAddModal;
window.openEditModal = openEditModal;
window.closeModal = closeModal;
window.saveService = saveService;
window.deleteServiceGlobal = deleteService;
window.updateStatusGlobal = updateStatus;
window.confirmStatusChange = confirmStatusChange;
window.closeStatusModal = closeStatusModal;
window.showTrackingCodeModal = showTrackingCodeModal;
window.closeTrackingModal = closeTrackingModal;
window.confirmTrackingCode = confirmTrackingCode;
window.showStatusModalWithPhoto = showStatusModalWithPhoto;
window.showStatusModalWithPackagedPhoto = showStatusModalWithPackagedPhoto;
window.handleInstagramPhotoSelect = handleInstagramPhotoSelect;
window.removeInstagramPhoto = removeInstagramPhoto;
window.handlePackagedPhotoSelect = handlePackagedPhotoSelect;
window.removePackagedPhoto = removePackagedPhoto;
window.filterServices = filterServices;
window.toggleDateInput = toggleDateInput;
window.toggleDeliveryFields = toggleDeliveryFields;
window.handleFileSelect = handleFileSelect;
window.handleImageSelect = handleImageSelect;
window.removePreviewImage = removePreviewImage;
window.removeFilePreview = removeFilePreview;
window.removeFile = removeFile;
window.downloadFile = downloadFile;
window.buscarCEP = buscarCEP;
window.showDeliveryInfo = showDeliveryInfo;
window.closeDeliveryModal = closeDeliveryModal;
window.showServiceImages = showServiceImages;
window.showServiceFiles = showServiceFiles;
window.closeFilesModal = closeFilesModal;
window.closeImageModal = closeImageModal;
window.prevImage = prevImage;
window.nextImage = nextImage;
window.contactClient = contactClient;
window.handleClientNameInput = handleClientNameInput;
window.selectClient = selectClient;
window.formatCPF = formatCPF;
window.copyClientDataToDelivery = copyClientDataToDelivery;
window.removeFileFromService = removeFileFromService;