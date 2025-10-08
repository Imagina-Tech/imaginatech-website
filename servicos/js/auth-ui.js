/* ==================================================
ARQUIVO: servicos/js/auth-ui.js
MÓDULO: Autenticação, Interface e Utilities
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 3.2 - Lógica de Status e Feedback Corrigida
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
// ... (COLE A SEÇÃO DE AUTENTICAÇÃO DO SEU ARQUIVO auth-ui.js AQUI, ELA NÃO PRECISA DE MUDANÇAS) ...
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
    } else {
        state.isAuthorized = false;
        showAccessDeniedScreen(user);
    }
}

// ===========================
// UI MANAGEMENT
// ===========================
// ... (COLE A SEÇÃO DE UI MANAGEMENT DO SEU ARQUIVO auth-ui.js AQUI, ELA NÃO PRECISA DE MUDANÇAS) ...
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
                <div class="access-denied-icon"><i class="fas fa-lock"></i></div>
                <h1>Acesso Restrito</h1>
                <p class="access-denied-message">Olá ${user.displayName || user.email}, esta área é exclusiva para administradores.</p>
                <p class="access-denied-info">Você está logado com: <strong>${user.email}</strong></p>
                <div class="access-denied-actions">
                    <a href="/" class="btn-primary"><i class="fas fa-home"></i> Voltar ao Início</a>
                    <a href="/acompanhar-pedido/" class="btn-secondary"><i class="fas fa-cube"></i> Acompanhar Pedido</a>
                </div>
                <button class="btn-logout-denied" onclick="window.signOutGlobal()"><i class="fas fa-sign-out-alt"></i> Fazer Logout</button>
            </div>`;
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

// --- NOVA FUNÇÃO DE FEEDBACK ---
/**
 * Alterna o estado de carregamento de botões em modais.
 * @param {boolean} isLoading - True para mostrar o spinner, false para reverter ao normal.
 */
export function toggleModalLoading(isLoading) {
    const modals = ['#statusModal', '#trackingModal', '#serviceModal'];
    modals.forEach(modalSelector => {
        const button = document.querySelector(`${modalSelector} .btn-confirm, ${modalSelector} .btn-save`);
        if (!button) return;

        const btnText = button.querySelector('.btn-text');
        const spinner = button.querySelector('.spinner');

        button.disabled = isLoading;
        if (btnText) btnText.style.display = isLoading ? 'none' : 'inline-flex';
        if (spinner) spinner.style.display = isLoading ? 'block' : 'none';
    });
}


// ===========================
// MODALS
// ===========================
// ... (COLE A SEÇÃO DE MODALS DO SEU ARQUIVO auth-ui.js AQUI, COM AS SEGUINTES MODIFICAÇÕES) ...
export function openAddModal() {
    state.editingServiceId = state.selectedFile = null;
    state.selectedImages = [];

    document.getElementById('modalTitle') && (document.getElementById('modalTitle').textContent = 'Novo Serviço');
    document.getElementById('saveButtonText') && (document.getElementById('saveButtonText').textContent = 'Salvar Serviço');
    document.getElementById('serviceForm')?.reset();
    document.getElementById('orderCodeDisplay') && (document.getElementById('orderCodeDisplay').style.display = 'none');

    setupDateFields();
    ['fileInfo', 'imagePreview'].forEach(id => {
        const el = document.getElementById(id);
        el && (el.style.display = 'none');
    });

    const previewContainer = document.getElementById('imagePreviewContainer');
    if (previewContainer) previewContainer.innerHTML = '';

    document.getElementById('servicePriority') && (document.getElementById('servicePriority').value = 'media');
    document.getElementById('serviceStatus') && (document.getElementById('serviceStatus').value = 'pendente');
    document.getElementById('dateUndefined') && (document.getElementById('dateUndefined').checked = false);

    const notificationSection = document.getElementById('notificationSection');
    if (notificationSection) notificationSection.style.display = 'none';

    hideAllDeliveryFields();
    document.getElementById('serviceModal')?.classList.add('active');
}

export function openEditModal(serviceId) {
    const service = state.services.find(s => s.id === serviceId);
    if (!service) return;

    state.editingServiceId = serviceId;
    state.selectedFile = null;
    state.selectedImages = [];

    document.getElementById('modalTitle') && (document.getElementById('modalTitle').textContent = 'Editar Serviço');
    document.getElementById('saveButtonText') && (document.getElementById('saveButtonText').textContent = 'Atualizar Serviço');
    document.getElementById('orderCodeDisplay') && (document.getElementById('orderCodeDisplay').style.display = 'none');

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

    const preview = document.getElementById('imagePreview');
    const previewContainer = document.getElementById('imagePreviewContainer');

    if (previewContainer) previewContainer.innerHTML = '';

    if ((service.images && service.images.length > 0) || service.imageUrl) {
        const imagesToShow = service.images && service.images.length > 0 ? service.images : [{ url: service.imageUrl, name: 'Imagem' }];

        imagesToShow.forEach((img, index) => {
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'preview-image-wrapper existing-image';
            imgWrapper.innerHTML = `
                <img src="${img.url}" alt="Imagem ${index + 1}">
                <span class="existing-badge">Existente</span>
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

    document.getElementById('serviceModal')?.classList.add('active');
}

export function closeModal() {
    document.getElementById('serviceModal')?.classList.remove('active');
    state.editingServiceId = state.selectedFile = null;
    const trackingField = document.getElementById('trackingCodeField');
    const trackingInput = document.getElementById('editTrackingCode');
    if (trackingField) trackingField.style.display = 'none';
    if (trackingInput) trackingInput.value = '';
}

export function closeStatusModal() {
    document.getElementById('statusModal')?.classList.remove('active');
    state.pendingStatusUpdate = null;

    const photoField = document.getElementById('instagramPhotoField');
    if (photoField) photoField.style.display = 'none';
    const photoInput = document.getElementById('instagramPhotoInput');
    if (photoInput) photoInput.value = '';

    const photoPreview = document.getElementById('instagramPhotoPreview');
    const photoPreviewGrid = document.getElementById('instagramPhotoPreviewGrid');
    if (photoPreview) photoPreview.style.display = 'none';
    if (photoPreviewGrid) photoPreviewGrid.innerHTML = '';
    state.pendingInstagramPhotos = [];
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
    window.toggleModalLoading(true);
    try {
        const trackingInput = document.getElementById('trackingCode');
        if (!trackingInput?.value.trim()) throw new Error('Insira o código de rastreio');
        if (!state.pendingStatusUpdate) return;

        const { serviceId, service } = state.pendingStatusUpdate;
        const trackingCode = trackingInput.value.trim().toUpperCase();

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
        showToast(error.message || 'Erro ao atualizar status', 'error');
    } finally {
        window.toggleModalLoading(false);
        closeTrackingModal();
    }
}

// --- FUNÇÃO CORRIGIDA ---
export function showStatusModalWithPhoto(service, newStatus) {
    // Mensagem dinâmica baseada no status
    const statusLabel = getStatusLabel(newStatus).replace(/s$/, ''); // Remove o 's' do plural
    document.getElementById('statusModalMessage') &&
        (document.getElementById('statusModalMessage').textContent = `Para marcar como "${statusLabel}", é obrigatório anexar uma ou mais fotos do serviço "${service.name}"`);

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
    
    if (allImages.length > 0) {
        showImageModal(allImages, service.name || 'Serviço');
    }
}

export function showImageModal(images, serviceName, startIndex = 0) {
    if (typeof images === 'string') {
        images = [{ url: images, name: serviceName }];
    }
    
    state.currentImageGallery = images;
    state.currentImageIndex = startIndex;
    
    const modal = document.getElementById('imageViewerModal');
    if (!modal) return;
    
    updateImageViewer();
    modal.classList.add('active');
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
        const imageType = currentImage.type === 'instagram' ? ' 📸 (Instagramável)' : '';
        title.textContent = (currentImage.name || `Imagem ${state.currentImageIndex + 1}`) + imageType;
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
    const file = event.target.files[0];
    if (!file) return state.selectedFile = null;
    
    const validExts = ['.stl', '.obj', '.step', '.stp', '.3mf'];
    const isValid = validExts.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!isValid || file.size > 52428800) {
        showToast(!isValid ? 'Formato inválido. Use: STL, OBJ, STEP ou 3MF' : 'Arquivo muito grande. Máximo: 50MB', 'error');
        event.target.value = '';
        return state.selectedFile = null;
    }
    
    state.selectedFile = file;
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    if (fileInfo && fileName) {
        fileName.textContent = file.name;
        fileInfo.style.display = 'flex';
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

export const removeFile = () => {
    state.selectedFile = null;
    ['serviceFile', 'currentFileUrl', 'currentFileName'].forEach(id => {
        const el = document.getElementById(id);
        el && (el.value = '');
    });
    const fileInfo = document.getElementById('fileInfo');
    fileInfo && (fileInfo.style.display = 'none');
};

export function downloadFile(url, fileName) {
    const link = Object.assign(document.createElement('a'), { href: url, download: fileName || 'arquivo', target: '_blank' });
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// MODIFICADO: Lógica para múltiplas fotos no modal de conclusão
state.pendingInstagramPhotos = [];

export function handleInstagramPhotoSelect(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const maxSize = 5242880; // 5MB

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
    if (fileInput) fileInput.value = ''; // Limpa o input para permitir nova seleção dos mesmos arquivos
    renderInstagramPhotoPreviews();
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

export function formatCEP(e) {
    let value = e.target.value.replace(/\D/g, '').slice(0, 8);
    if (value.length > 5) value = `${value.slice(0, 5)}-${value.slice(5)}`;
    e.target.value = value;
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
    'cinza': 'Cinza', 'transparente': 'Transparente', 'outros': 'Outras'
}[color] || color);

export const formatMoney = value => (!value || isNaN(value)) ? '0,00' : value.toFixed(2).replace('.', ',');

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
window.handleInstagramPhotoSelect = handleInstagramPhotoSelect;
window.removeInstagramPhoto = removeInstagramPhoto; // MODIFICADO: Expor nova função
window.filterServices = filterServices;
window.toggleDateInput = toggleDateInput;
window.toggleDeliveryFields = toggleDeliveryFields;
window.handleFileSelect = handleFileSelect;
window.handleImageSelect = handleImageSelect;
window.removePreviewImage = removePreviewImage;
window.removeFile = removeFile;
window.downloadFile = downloadFile;
window.buscarCEP = buscarCEP;
window.showDeliveryInfo = showDeliveryInfo;
window.closeDeliveryModal = closeDeliveryModal;
window.showServiceImages = showServiceImages;
window.closeImageModal = closeImageModal;
window.prevImage = prevImage;
window.nextImage = nextImage;
window.contactClient = contactClient;
