/* ==================================================
ARQUIVO: servicos/js/auth-ui.js
MÓDULO: Autenticação, Interface e Utilities
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 3.5 - Correção de Redundâncias
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
    uploadFile
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

// ===========================
// UI MANAGEMENT
// ===========================

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
                        createdAt: service.createdAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                } else {
                    const existing = clientsToMigrate.get(clientKey);
                    if (!existing.cpf && service.clientCPF) existing.cpf = service.clientCPF;
                    if (!existing.email && service.clientEmail) existing.email = service.clientEmail;
                    if (!existing.phone && service.clientPhone) existing.phone = service.clientPhone;
                    if (!existing.address && service.deliveryMethod === 'sedex' && service.deliveryAddress) {
                        existing.address = service.deliveryAddress;
                    }
                }
            }
        });
        
        let migratedCount = 0;
        
        for (const [key, clientData] of clientsToMigrate) {
            let existingClient = null;
            
            if (clientData.cpf) {
                const cpfClean = clientData.cpf.replace(/\D/g, '');
                existingClient = await state.db.collection('clients')
                    .where('cpf', '==', cpfClean)
                    .limit(1)
                    .get();
            }
            
            if (!existingClient || existingClient.empty) {
                existingClient = await state.db.collection('clients')
                    .where('name', '==', clientData.name)
                    .limit(1)
                    .get();
            }
            
            if (existingClient && !existingClient.empty) {
                continue;
            }
            
            const docToSave = { ...clientData };
            if (docToSave.cpf) {
                docToSave.cpf = docToSave.cpf.replace(/\D/g, '');
            }
            
            await state.db.collection('clients').add(docToSave);
            migratedCount++;
        }
        
        localStorage.setItem(migrationKey, 'true');
        console.log(`✅ Migração concluída: ${migratedCount} clientes migrados`);
        
        if (migratedCount > 0) {
            await loadClientsFromFirestore();
            showToast(`✅ ${migratedCount} clientes migrados automaticamente!`, 'success');
        }
        
    } catch (error) {
        console.error('Erro na migração de clientes:', error);
    }
}

export function handleClientNameInput(event) {
    const value = event.target.value.trim().toLowerCase();
    const suggestionsDiv = document.getElementById('clientSuggestions');
    
    if (!value || value.length < 2) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    const matches = clientsCache.filter(client => 
        client.name.toLowerCase().includes(value)
    );
    
    if (matches.length === 0) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    suggestionsDiv.innerHTML = matches.map(client => `
        <div class="client-suggestion-item" onclick="window.selectClient('${client.id}')">
            <div class="client-suggestion-name">${escapeHtml(client.name)}</div>
            <div class="client-suggestion-details">
                ${client.cpf ? `CPF: ${client.cpf}` : ''}
                ${client.email ? ` • ${client.email}` : ''}
            </div>
        </div>
    `).join('');
    
    suggestionsDiv.style.display = 'block';
}

export function selectClient(clientId) {
    const client = clientsCache.find(c => c.id === clientId);
    if (!client) return;
    
    document.getElementById('clientName').value = client.name || '';
    document.getElementById('clientCPF').value = client.cpf || '';
    document.getElementById('clientEmail').value = client.email || '';
    document.getElementById('clientPhone').value = client.phone || '';
    
    document.getElementById('clientSuggestions').style.display = 'none';
    
    showToast('✅ Dados do cliente preenchidos!', 'success');
}

export async function saveClientToFirestore(clientData) {
    if (!state.db || !clientData.name) return;
    
    try {
        const clientDoc = {
            name: clientData.name,
            cpf: clientData.cpf ? clientData.cpf.replace(/\D/g, '') : '',
            email: clientData.email || '',
            phone: clientData.phone || '',
            address: clientData.address || null,
            updatedAt: new Date().toISOString()
        };
        
        let existingClient = null;
        
        if (clientData.cpf) {
            const cpfClean = clientData.cpf.replace(/\D/g, '');
            existingClient = await state.db.collection('clients')
                .where('cpf', '==', cpfClean)
                .limit(1)
                .get();
        }
        
        if (!existingClient || existingClient.empty) {
            const nameLower = clientData.name.toLowerCase().trim();
            existingClient = await state.db.collection('clients')
                .where('name', '==', clientData.name)
                .limit(1)
                .get();
        }
        
        if (existingClient && !existingClient.empty) {
            const docId = existingClient.docs[0].id;
            await state.db.collection('clients').doc(docId).update(clientDoc);
            console.log('✅ Cliente atualizado:', clientData.name);
        } else {
            clientDoc.createdAt = new Date().toISOString();
            await state.db.collection('clients').add(clientDoc);
            console.log('✅ Novo cliente salvo:', clientData.name);
        }
        
        await loadClientsFromFirestore();
        
    } catch (error) {
        console.error('Erro ao salvar cliente:', error);
    }
}

// ===========================
// MODALS
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
    document.getElementById('orderCodeDisplay') && (document.getElementById('orderCodeDisplay').style.display = 'none');
    
    Object.entries({
        serviceName: service.name,
        clientName: service.client,
        clientCPF: service.clientCPF || '',
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
    
    const notificationSection = document.getElementById('notificationSection');
    if (notificationSection) notificationSection.style.display = 'none';
    
    const dateUndefined = document.getElementById('dateUndefined');
    const dueDateInput = document.getElementById('dueDate');
    if (dateUndefined) {
        dateUndefined.checked = service.dateUndefined === true;
        if (service.dateUndefined && dueDateInput) {
            dueDateInput.disabled = true;
            dueDateInput.value = '';
        }
    }
    
    const filesPreview = document.getElementById('filesPreview');
    const filesPreviewContainer = document.getElementById('filesPreviewContainer');
    
    if (filesPreviewContainer) filesPreviewContainer.innerHTML = '';
    
    if ((service.files && service.files.length > 0) || service.fileUrl) {
        const filesToShow = service.files && service.files.length > 0 ? service.files : 
                           service.fileUrl ? [{ url: service.fileUrl, name: service.fileName || 'Arquivo' }] : [];
        
        filesToShow.forEach((file, index) => {
            const fileWrapper = document.createElement('div');
            fileWrapper.className = 'file-item-wrapper existing-file';
            fileWrapper.innerHTML = `
                <div class="file-item-info">
                    <i class="fas fa-file"></i>
                    <span>${file.name || `Arquivo ${index + 1}`}</span>
                </div>
                <span class="existing-badge">Existente</span>
            `;
            filesPreviewContainer.appendChild(fileWrapper);
        });
        
        if (filesPreview) filesPreview.style.display = 'block';
    }
    
    const preview = document.getElementById('imagePreview');
    const previewContainer = document.getElementById('imagePreviewContainer');
    
    if (previewContainer) previewContainer.innerHTML = '';
    
    const allImagesToShow = [];
    
    if (service.images && service.images.length > 0) {
        service.images.forEach(img => allImagesToShow.push({ ...img, type: 'regular' }));
    }
    
    if (service.imageUrl && !(service.images && service.images.find(img => img.url === service.imageUrl))) {
        allImagesToShow.push({ url: service.imageUrl, name: 'Imagem', type: 'regular' });
    }
    
    if (service.instagramPhoto && !(service.images && service.images.find(img => img.url === service.instagramPhoto))) {
        allImagesToShow.push({ url: service.instagramPhoto, name: 'Foto Instagramável', type: 'instagram' });
    }
    
    if (service.packagedPhotos && service.packagedPhotos.length > 0) {
        service.packagedPhotos.forEach(photo => allImagesToShow.push({ ...photo, type: 'packaged' }));
    }
    
    if (allImagesToShow.length > 0) {
        allImagesToShow.forEach((img, index) => {
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'preview-image-wrapper existing-image';
            
            let badgeText = 'Existente';
            let badgeClass = 'existing-badge';
            
            if (img.type === 'instagram') {
                badgeText = '📸 Instagramável';
                badgeClass = 'existing-badge badge-instagram';
            } else if (img.type === 'packaged') {
                badgeText = '📦 Embalado';
                badgeClass = 'existing-badge badge-packaged';
            }
            
            imgWrapper.innerHTML = `
                <img src="${img.url}" alt="Imagem ${index + 1}">
                <span class="${badgeClass}">${badgeText}</span>
            `;
            previewContainer.appendChild(imgWrapper);
        });
        
        if (preview) preview.style.display = 'block';
    }
    
    if (service.deliveryMethod) {
        toggleDeliveryFields();
        
        if (service.deliveryMethod === 'retirada' && service.pickupInfo) {
            document.getElementById('pickupName') && (document.getElementById('pickupName').value = service.pickupInfo.name || '');
            document.getElementById('pickupWhatsapp') && (document.getElementById('pickupWhatsapp').value = service.pickupInfo.whatsapp || '');
        } else if (service.deliveryMethod === 'sedex') {
            if (service.deliveryAddress) {
                const addr = service.deliveryAddress;
                Object.entries(addr).forEach(([key, value]) => {
                    const el = document.getElementById(key);
                    el && (el.value = value || '');
                });
            }
            
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
    
    document.getElementById('clientSuggestions').style.display = 'none';
    
    document.getElementById('serviceModal')?.classList.add('active');
}

export function closeModal() {
    document.getElementById('serviceModal')?.classList.remove('active');
    state.editingServiceId = null;
    state.selectedFiles = [];
    const trackingField = document.getElementById('trackingCodeField');
    const trackingInput = document.getElementById('editTrackingCode');
    if (trackingField) trackingField.style.display = 'none';
    if (trackingInput) trackingInput.value = '';
    
    document.getElementById('clientSuggestions').style.display = 'none';
}

export function closeStatusModal() {
    document.getElementById('statusModal')?.classList.remove('active');
    state.pendingStatusUpdate = null;
    
    const photoField = document.getElementById('instagramPhotoField');
    if (photoField) photoField.style.display = 'none';
    const photoInput = document.getElementById('instagramPhotoInput');
    if (photoInput) photoInput.value = '';
    
    const packagedField = document.getElementById('packagedPhotoField');
    if (packagedField) packagedField.style.display = 'none';
    const packagedInput = document.getElementById('packagedPhotoInput');
    if (packagedInput) packagedInput.value = '';
    
    const trackingField = document.getElementById('statusTrackingCodeField');
    if (trackingField) trackingField.style.display = 'none';
    const trackingInput = document.getElementById('statusTrackingCodeInput');
    if (trackingInput) {
    trackingInput.value = '';
    trackingInput.required = false;
    }
    
    const photoPreview = document.getElementById('instagramPhotoPreview');
    const photoPreviewGrid = document.getElementById('instagramPhotoPreviewGrid');
    if (photoPreview) photoPreview.style.display = 'none';
    if (photoPreviewGrid) photoPreviewGrid.innerHTML = '';
    state.pendingInstagramPhotos = [];
    
    const packagedPreview = document.getElementById('packagedPhotoPreview');
    const packagedPreviewGrid = document.getElementById('packagedPhotoPreviewGrid');
    if (packagedPreview) packagedPreview.style.display = 'none';
    if (packagedPreviewGrid) packagedPreviewGrid.innerHTML = '';
    state.pendingPackagedPhotos = [];
}

export function showTrackingCodeModal() {
    const modal = document.getElementById('trackingModal');
    modal?.classList.add('active');
    const input = document.getElementById('trackingCode');
    input && (input.value = '', input.focus());
}

export const closeTrackingModal = () => {
    document.getElementById('trackingModal')?.classList.remove('active');
    state.pendingStatusUpdate = null;
};

export async function confirmTrackingCode() {
    const trackingInput = document.getElementById('trackingCode');
    if (!trackingInput?.value.trim()) return showToast('Insira o código de rastreio', 'error');
    if (!state.pendingStatusUpdate) return;
    
    const { serviceId, service } = state.pendingStatusUpdate;
    const trackingCode = trackingInput.value.trim().toUpperCase();
    
    try {
        await state.db.collection('services').doc(serviceId).update({
            status: 'retirada',
            trackingCode,
            postedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updatedBy: state.currentUser.email
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

export function showStatusModalWithPhoto(service, newStatus) {
    document.getElementById('statusModalMessage') && 
        (document.getElementById('statusModalMessage').textContent = `Para marcar como Concluído, é obrigatório anexar uma ou mais fotos do serviço "${service.name}"`);
    
    const photoField = document.getElementById('instagramPhotoField');
    if (photoField) {
        photoField.style.display = 'block';
        const photoInput = document.getElementById('instagramPhotoInput');
        if (photoInput) photoInput.value = '';
        
        const photoPreview = document.getElementById('instagramPhotoPreview');
        const photoPreviewGrid = document.getElementById('instagramPhotoPreviewGrid');
        if (photoPreview) photoPreview.style.display = 'none';
        if (photoPreviewGrid) photoPreviewGrid.innerHTML = '';
        state.pendingInstagramPhotos = [];
    }
    
    const emailOption = document.getElementById('emailOption');
    if (emailOption) {
        const hasEmail = service.clientEmail && service.clientEmail.trim().length > 0;
        if (hasEmail) {
            emailOption.style.display = 'block';
            const emailCheckbox = document.getElementById('sendEmailNotification');
            if (emailCheckbox) emailCheckbox.checked = true;
        } else {
            emailOption.style.display = 'none';
        }
    }
    
    const whatsappOption = document.getElementById('whatsappOption');
    if (whatsappOption) whatsappOption.style.display = 'none';
    
    document.getElementById('statusModal')?.classList.add('active');
}

export function showStatusModalWithPackagedPhoto(service, newStatus) {
    const modalMessage = document.getElementById('statusModalMessage');
    if (modalMessage) {
        if (service.deliveryMethod === 'sedex' && !service.trackingCode) {
            modalMessage.textContent = `Para marcar como Postado, é obrigatório anexar fotos do produto embalado E informar o código de rastreio dos Correios`;
        } else {
            modalMessage.textContent = `Para marcar como Pronto/Postado, é obrigatório anexar uma ou mais fotos do produto embalado "${service.name}"`;
        }
    }
    
    const packagedField = document.getElementById('packagedPhotoField');
    if (packagedField) {
        packagedField.style.display = 'block';
        const packagedInput = document.getElementById('packagedPhotoInput');
        if (packagedInput) packagedInput.value = '';
        
        const packagedPreview = document.getElementById('packagedPhotoPreview');
        const packagedPreviewGrid = document.getElementById('packagedPhotoPreviewGrid');
        if (packagedPreview) packagedPreview.style.display = 'none';
        if (packagedPreviewGrid) packagedPreviewGrid.innerHTML = '';
        state.pendingPackagedPhotos = [];
    }
    
    const trackingField = document.getElementById('statusTrackingCodeField');
    if (trackingField) {
        if (service.deliveryMethod === 'sedex' && !service.trackingCode) {
            trackingField.style.display = 'block';
            const trackingInput = document.getElementById('statusTrackingCodeInput');
            if (trackingInput) {
                trackingInput.value = '';
                trackingInput.required = true;
            }
        } else {
            trackingField.style.display = 'none';
        }
    }
    
    const emailOption = document.getElementById('emailOption');
    if (emailOption) emailOption.style.display = 'none';
    
    const whatsappOption = document.getElementById('whatsappOption');
    if (whatsappOption) {
        const hasPhone = service.clientPhone && service.clientPhone.trim().length > 0;
        if (hasPhone) {
            whatsappOption.style.display = 'block';
            const whatsappCheckbox = document.getElementById('sendWhatsappNotification');
            if (whatsappCheckbox) whatsappCheckbox.checked = true;
        } else {
            whatsappOption.style.display = 'none';
        }
    }
    
    document.getElementById('statusModal')?.classList.add('active');
}

export function showDeliveryInfo(serviceId) {
    const service = state.services.find(s => s.id === serviceId);
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

export const closeDeliveryModal = () => document.getElementById('deliveryInfoModal')?.classList.remove('active');

export function showServiceImages(serviceId) {
    const service = state.services.find(s => s.id === serviceId);
    if (!service) return;
    
    const allImages = [];
    
    // 1. images[] - mantém compatibilidade
    if (service.images && service.images.length > 0) {
        service.images.forEach((img, index) => {
            allImages.push({
                url: img.url,
                name: img.name || 'Imagem',
                type: 'regular',
                imageIndex: index,
                imageSource: 'images', // ✅ NOVO
                serviceId: serviceId
            });
        });
    }
    
    // 2. imageUrl legado
    if (service.imageUrl && !(service.images && service.images.find(img => img.url === service.imageUrl))) {
        allImages.push({
            url: service.imageUrl,
            name: 'Imagem',
            type: 'regular',
            imageIndex: 0,
            imageSource: 'imageUrl', // ✅ NOVO
            serviceId: serviceId
        });
    }
    
    // 3. instagramPhoto
    if (service.instagramPhoto && !(service.images && service.images.find(img => img.url === service.instagramPhoto))) {
        allImages.push({
            url: service.instagramPhoto,
            name: 'Foto Instagramável',
            type: 'instagram',
            imageIndex: 0,
            imageSource: 'instagramPhoto', // ✅ NOVO
            serviceId: serviceId
        });
    }
    
    // 4. packagedPhotos[]
    if (service.packagedPhotos && service.packagedPhotos.length > 0) {
        service.packagedPhotos.forEach((photo, index) => {
            allImages.push({
                url: photo.url,
                name: photo.name || 'Produto Embalado',
                type: 'packaged',
                imageIndex: index,
                imageSource: 'packagedPhotos', // ✅ NOVO
                serviceId: serviceId
            });
        });
    }
    
    if (allImages.length > 0) {
        showImagesGallery(allImages, service.name || 'Serviço', serviceId);
    }
}

function showImagesGallery(images, serviceName, serviceId) {
    const modal = document.getElementById('imageViewerModal');
    if (!modal) return;
    
    const modalContent = modal.querySelector('.modal-content');
    if (!modalContent) return;
    
    const galleryHTML = `
        <div class="modal-header">
            <h2><i class="fas fa-images"></i> ${serviceName} - ${images.length} Imagem(ns)</h2>
            <button class="modal-close" onclick="closeImageModal()">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="modal-body">
            <div class="images-gallery-grid">
                ${images.map((img, index) => `
                    <div class="gallery-image-item">
                        <img 
                            src="${img.url}" 
                            alt="${img.name}"
                            onclick="window.viewFullImageFromGallery(${index})"
                        >
                        ${state.isAuthorized ? `
                            <button 
                                class="btn-remove-gallery-item" 
                                onclick="event.stopPropagation(); window.removeImageFromGallery('${serviceId}', ${img.imageIndex}, '${img.imageSource}', '${img.url}')"
                                title="Remover imagem"
                            >
                                <i class="fas fa-times"></i>
                            </button>
                        ` : ''}
                        ${img.type === 'instagram' ? '<span class="instagram-badge"><i class="fab fa-instagram"></i></span>' : ''}
                        ${img.type === 'packaged' ? '<span class="packaged-badge">📦</span>' : ''}
                    </div>
                `).join('')}
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-primary" onclick="closeImageModal()">
                <i class="fas fa-check"></i> Fechar
            </button>
        </div>
    `;
    
    modalContent.innerHTML = galleryHTML;
    modal.classList.add('active');
    
    // ✅ NOVO: Armazena galeria no estado global
    state.currentImageGallery = images;
    state.currentImageIndex = 0;
}

window.viewFullImageFromGallery = function(imageIndex) {
    if (!state.currentImageGallery || state.currentImageGallery.length === 0) {
        console.error('❌ Nenhuma galeria carregada');
        return;
    }
    
    console.log('📸 Abrindo imagem', imageIndex + 1, 'de', state.currentImageGallery.length);
    
    state.currentImageIndex = imageIndex;
    
    // 1. Fecha modal de galeria
    const galleryModal = document.getElementById('imageViewerModal');
    if (galleryModal) {
        galleryModal.classList.remove('active');
    }
    
    // 2. Aguarda animação + RESTAURA estrutura do modal
    setTimeout(() => {
        const modal = document.getElementById('imageViewerModal');
        if (!modal) {
            console.error('❌ Modal não encontrado');
            return;
        }
        
        // ✅ CRÍTICO: Restaurar estrutura HTML original
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.innerHTML = `
                <div class="modal-header">
                    <h2 id="viewerTitle">Imagem</h2>
                    <button class="modal-close" onclick="closeImageModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body modal-image-body">
                    <button class="image-nav-btn prev-btn" id="prevImageBtn" onclick="prevImage()">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <img id="viewerImage" src="" alt="Imagem do Serviço">
                    <button class="image-nav-btn next-btn" id="nextImageBtn" onclick="nextImage()">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                    <div class="image-counter" id="imageCounter">1 / 1</div>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" id="downloadImageBtn">
                        <i class="fas fa-download"></i> Baixar Imagem
                    </button>
                    <button class="btn-secondary" onclick="window.open(document.getElementById('viewerImage').src, '_blank')">
                        <i class="fas fa-external-link-alt"></i> Abrir em Nova Aba
                    </button>
                    <button class="btn-secondary" onclick="closeImageModal()">
                        <i class="fas fa-times"></i> Fechar
                    </button>
                </div>
            `;
        }
        
        // 3. Atualiza estado e interface
        updateImageViewer();
        
        // 4. Reabre modal com estrutura correta
        modal.classList.add('active');
        
        console.log('✅ Modal de visualização aberto');
    }, 350); // 350ms para garantir fechamento completo
};

// ✅ MANTÉM: Para compatibilidade com outros módulos
window.viewFullImage = function(url, name) {
    showImageModal([{url, name}], name, 0);
};

window.removeImageFromGallery = async function(serviceId, imageIndex, imageSource, imageUrl) {
    const { removeImageFromService } = await import('./services.js');
    await removeImageFromService(serviceId, imageIndex, imageSource, imageUrl);
    
    setTimeout(() => {
        const service = state.services.find(s => s.id === serviceId);
        if (service) {
            showServiceImages(serviceId);
        }
    }, 500);
};

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
    
    modal.classList.add('active');
}

export const closeFilesModal = () => document.getElementById('filesViewerModal')?.classList.remove('active');

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
    const modal = document.getElementById('imageViewerModal');
    if (!modal) return;
    
    modal.classList.remove('active');
    state.currentImageGallery = [];
    state.currentImageIndex = 0;
    
    setTimeout(() => {
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent) {
            modalContent.innerHTML = `
                <div class="modal-header">
                    <h2 id="viewerTitle">Imagem</h2>
                    <button class="modal-close" onclick="closeImageModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body image-viewer-body">
                    <img id="viewerImage" src="" alt="Imagem do Serviço">
                    <button class="image-nav-btn prev-btn" id="prevImageBtn" onclick="prevImage()">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <button class="image-nav-btn next-btn" id="nextImageBtn" onclick="nextImage()">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                    <div class="image-counter" id="imageCounter">1 / 1</div>
                </div>
                <div class="modal-footer">
                    <button class="btn-primary" id="downloadImageBtn">
                        <i class="fas fa-download"></i> Baixar Imagem
                    </button>
                    <button class="btn-secondary" onclick="window.open(document.getElementById('viewerImage').src, '_blank')">
                        <i class="fas fa-external-link-alt"></i> Abrir em Nova Aba
                    </button>
                    <button class="btn-secondary" onclick="closeImageModal()">
                        <i class="fas fa-times"></i> Fechar
                    </button>
                </div>
            `;
        }
    }, 300);
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
        const previewContainer = document.getElementById('imagePreviewContainer');
        if (previewContainer) {
            previewContainer.innerHTML = '';
            state.selectedImages.forEach((file, idx) => {
                const reader = new FileReader();
                reader.onload = e => {
                    const imgWrapper = document.createElement('div');
                    imgWrapper.className = 'preview-image-wrapper';
                    imgWrapper.innerHTML = `
                        <img src="${e.target.result}" alt="Preview ${idx + 1}">
                        <button type="button" class="btn-remove-preview" onclick="window.removePreviewImage(${idx})">
                            <i class="fas fa-times"></i>
                        </button>
                    `;
                    previewContainer.appendChild(imgWrapper);
                };
                reader.readAsDataURL(file);
            });
        }
    }
}

export function removeFilePreview(index) {
    state.selectedFiles.splice(index, 1);
    const fileInput = document.getElementById('serviceFiles');
    if (fileInput) fileInput.value = '';
    
    if (state.selectedFiles.length === 0) {
        const preview = document.getElementById('filesPreview');
        if (preview) preview.style.display = 'none';
    } else {
        const previewContainer = document.getElementById('filesPreviewContainer');
        if (previewContainer) {
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
            showToast(`Foto muito grande: ${file.name}. Máximo: 5MB.`, 'error');
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

state.pendingPackagedPhotos = [];

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
        dateInput.required = !checkbox.checked;
    }
}

export function toggleDeliveryFields() {
    const method = document.getElementById('deliveryMethod')?.value;
    
    if (state.editingServiceId) {
        const service = state.services.find(s => s.id === state.editingServiceId);
        if (service && service.trackingCode && service.deliveryMethod === 'sedex' && method !== 'sedex') {
            showToast('ATENÇÃO: Este pedido já foi postado! Não é possível mudar o método de entrega.', 'error');
            document.getElementById('deliveryMethod').value = 'sedex';
            hideAllDeliveryFields();
            document.getElementById('deliveryFields')?.classList.add('active');
            
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
        if (state.editingServiceId) {
            const trackingField = document.getElementById('trackingCodeField');
            if (trackingField) {
                trackingField.style.display = 'block';
            }
        }
    }
    
    if (method !== 'sedex') {
        const trackingField = document.getElementById('trackingCodeField');
        if (trackingField) {
            trackingField.style.display = 'none';
        }
    }
}

export const hideAllDeliveryFields = () => {
    ['pickupFields', 'deliveryFields'].forEach(id => 
        document.getElementById(id)?.classList.remove('active')
    );
};

export function updateNotificationOptions() {
    const phone = document.getElementById('clientPhone')?.value.trim();
    const email = document.getElementById('clientEmail')?.value.trim();
    const notificationSection = document.getElementById('notificationSection');
    const whatsappOption = document.getElementById('createWhatsappOption');
    const emailOption = document.getElementById('createEmailOption');
    
    if (!state.editingServiceId && (phone || email)) {
        if (notificationSection) notificationSection.style.display = 'block';
        
        if (whatsappOption) {
            whatsappOption.style.display = phone ? 'block' : 'none';
        }
        
        if (emailOption) {
            emailOption.style.display = email ? 'block' : 'none';
        }
    } else if (notificationSection) {
        notificationSection.style.display = 'none';
    }
}

export function formatPhoneNumber(e) {
    let value = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (value.length > 6) value = `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    else if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
    else if (value.length > 0) value = `(${value}`;
    e.target.value = value;
}

export function formatCPF(e) {
    let value = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (value.length > 9) value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
    else if (value.length > 6) value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
    else if (value.length > 3) value = `${value.slice(0, 3)}.${value.slice(3)}`;
    e.target.value = value;
}

export function formatCEP(e) {
    let value = e.target.value.replace(/\D/g, '').slice(0, 8);
    if (value.length > 5) value = `${value.slice(0, 5)}-${value.slice(5)}`;
    e.target.value = value;
}

export function copyClientDataToDelivery() {
    const clientName = document.getElementById('clientName')?.value.trim();
    const clientCPF = document.getElementById('clientCPF')?.value.trim();
    const clientEmail = document.getElementById('clientEmail')?.value.trim();
    const clientPhone = document.getElementById('clientPhone')?.value.trim();
    
    if (!clientName && !clientCPF && !clientEmail && !clientPhone) {
        return showToast('Preencha os dados do cliente primeiro', 'warning');
    }
    
    if (clientName) document.getElementById('fullName').value = clientName;
    if (clientCPF) document.getElementById('cpfCnpj').value = clientCPF;
    if (clientEmail) document.getElementById('email').value = clientEmail;
    if (clientPhone) document.getElementById('telefone').value = clientPhone;
    
    showToast('✅ Dados copiados para a entrega!', 'success');
}

export async function buscarCEP() {
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
// DATE UTILITIES
// ===========================
export function getTodayBrazil() {
    const now = new Date();
    const brazilTime = new Date(now.getTime() - (now.getTimezoneOffset() + 180) * 60000);
    brazilTime.setHours(0, 0, 0, 0);
    return brazilTime.toISOString().split('T')[0];
}

export function parseDateBrazil(dateString) {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
}

export function calculateDaysRemaining(dueDate) {
    if (!dueDate) return null;
    const due = parseDateBrazil(dueDate);
    const today = parseDateBrazil(getTodayBrazil());
    return due && today ? Math.round((due - today) / 86400000) : null;
}

// ===========================
// FORMATTING UTILITIES
// ===========================
export const escapeHtml = text => text ? text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])) : '';

export const formatDaysText = days => days === null ? 'Sem prazo' : days === 0 ? 'Entrega hoje' : days === 1 ? 'Entrega amanhã' : days < 0 ? `${Math.abs(days)} dias atrás` : `${days} dias`;

export const getDaysColor = days => days === null ? 'var(--text-secondary)' : days < 0 ? 'var(--neon-red)' : days === 0 ? 'var(--neon-orange)' : days <= 2 ? 'var(--neon-yellow)' : 'var(--text-secondary)';

export const formatDate = dateString => dateString ? new Date(dateString).toLocaleDateString('pt-BR') : 'N/A';

export const formatColorName = color => ({
    'preto': 'Preto', 'branco': 'Branco', 'vermelho': 'Vermelho', 'azul': 'Azul',
    'verde': 'Verde', 'amarelo': 'Amarelo', 'laranja': 'Laranja', 'roxo': 'Roxo',
    'cinza': 'Cinza', 'transparente': 'Transparente', 'colorido': 'Colorido', 'outros': 'Outras'
}[color] || color);

export const formatMoney = value => (!value || isNaN(value)) ? '0,00' : value.toFixed(2).replace('.', ',');

export const formatFileSize = bytes => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export const getDeliveryMethodName = method => ({
    'retirada': 'Retirada no Local', 'sedex': 'Sedex/Correios',
    'uber': 'Uber Flash', 'definir': 'A Definir'
}[method] || method);

export const getDeliveryIcon = method => ({
    'retirada': 'fa-store', 'sedex': 'fa-shipping-fast',
    'uber': 'fa-motorcycle', 'definir': 'fa-question-circle'
}[method] || 'fa-truck');

export const getStatusLabel = status => ({
    'todos': 'Ativos', 'pendente': 'Pendentes', 'producao': 'Em Produção',
    'concluido': 'Concluídos', 'retirada': 'Em Processo de Entrega', 'entregue': 'Entregues'
}[status] || status);

export const getStatusIcon = status => ({
    'pendente': 'fa-clock', 'producao': 'fa-cogs', 'concluido': 'fa-check',
    'retirada': 'fa-box-open', 'entregue': 'fa-handshake'
}[status] || 'fa-question');

export const isStatusCompleted = (currentStatus, checkStatus) => {
    const statusOrder = ['pendente', 'producao', 'concluido', 'retirada', 'entregue'];
    return statusOrder.indexOf(currentStatus) > statusOrder.indexOf(checkStatus);
};

// ===========================
// NOTIFICATIONS
// ===========================
export function showToast(message, type = 'info') {
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

export const sendWhatsAppMessage = (phone, message) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
};

export const contactClient = (phone, serviceName, orderCode) => {
    const message = `Olá!\n\nSobre seu pedido:\n\n» Serviço: ${serviceName}\n» Código: #${orderCode}\n\nPode falar agora?`;
    sendWhatsAppMessage(phone, message);
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
// CONNECTION MONITORING
// ===========================
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
window.removeFileFromService = async (serviceId, fileIndex, fileUrl) => {
    const { removeFileFromService } = await import('./services.js');
    await removeFileFromService(serviceId, fileIndex, fileUrl);
};
