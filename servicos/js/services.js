/* ==================================================
ARQUIVO: servicos/js/services.js
MÓDULO: Lógica de Serviços (CRUD, Status, Upload, Renderização)
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 3.1 - Lógica de Status Corrigida
IMPORTANTE: NÃO REMOVER ESTE CABEÇALHO DE IDENTIFICAÇÃO
==================================================
*/

import { state } from './config.js';
import {
    showToast,
    escapeHtml,
    formatDate,
    formatMoney,
    formatColorName,
    formatDaysText,
    getDaysColor,
    getDeliveryMethodName,
    getDeliveryIcon,
    getStatusLabel,
    getStatusIcon,
    isStatusCompleted,
    parseDateBrazil,
    calculateDaysRemaining,
    sendWhatsAppMessage,
    sendEmailNotification
} from './auth-ui.js';

// Define a ordem hierárquica dos status para validação de fluxo
const STATUS_ORDER = ['pendente', 'producao', 'concluido', 'retirada', 'entregue'];

// ===========================
// SERVICE MANAGEMENT
// ===========================
export const generateOrderCode = () => Array(5).fill(0).map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789' [Math.floor(Math.random() * 36)]).join('');

export function startServicesListener() {
    if (!state.db) return console.error('Firestore não está disponível');

    state.servicesListener?.();

    state.servicesListener = state.db.collection('services').onSnapshot(snapshot => {
        state.services = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || '',
                client: data.client || '',
                clientEmail: data.clientEmail || '',
                clientPhone: data.clientPhone || '',
                description: data.description || '',
                material: data.material || '',
                color: data.color || '',
                priority: data.priority || 'media',
                startDate: data.startDate || '',
                dueDate: data.dueDate || '',
                dateUndefined: data.dateUndefined || false,
                value: data.value || '',
                weight: data.weight || '',
                observations: data.observations || '',
                deliveryMethod: data.deliveryMethod || '',
                status: data.status || 'pendente',
                fileUrl: data.fileUrl || '',
                fileName: data.fileName || '',
                fileSize: data.fileSize || '',
                fileUploadedAt: data.fileUploadedAt || '',
                imageUrl: data.imageUrl || '',
                images: data.images || [],
                imageUploadedAt: data.imageUploadedAt || '',
                instagramPhoto: data.instagramPhoto || '',
                trackingCode: data.trackingCode || '',
                deliveryAddress: data.deliveryAddress || {},
                pickupInfo: data.pickupInfo || {},
                orderCode: data.orderCode || '',
                serviceId: data.serviceId || '',
                createdAt: data.createdAt || '',
                createdBy: data.createdBy || '',
                updatedAt: data.updatedAt || '',
                updatedBy: data.updatedBy || '',
                productionStartedAt: data.productionStartedAt || '',
                completedAt: data.completedAt || '',
                readyAt: data.readyAt || '',
                deliveredAt: data.deliveredAt || '',
                postedAt: data.postedAt || '',
                lastStatusChange: data.lastStatusChange || ''
            };
        }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        updateStats();
        renderServices();
    }, error => {
        console.error('Erro ao carregar serviços:', error);
        showToast(error.code === 'permission-denied' ? 'Sem permissão para acessar serviços' : 'Erro ao carregar serviços', 'error');
    });
}

export async function saveService(event) {
    event.preventDefault();
    window.toggleModalLoading(true); // Ativa o spinner

    try {
        if (!state.isAuthorized || !state.db || !state.currentUser)
            throw new Error(!state.isAuthorized ? 'Sem permissão' : 'Sistema não está pronto');

        const deliveryMethod = document.getElementById('deliveryMethod').value;
        if (!deliveryMethod) throw new Error('Selecione um método de entrega');

        const dateUndefined = document.getElementById('dateUndefined');
        const dueDateInput = document.getElementById('dueDate');

        const getFieldValue = (elementId, isNumeric = false) => {
            const element = document.getElementById(elementId);
            if (!element) return '';
            const value = element.value.trim();
            if (isNumeric) {
                const parsed = parseFloat(value);
                return isNaN(parsed) || parsed === 0 ? '' : parsed;
            }
            return value;
        };

        const service = {
            name: getFieldValue('serviceName'),
            client: getFieldValue('clientName'),
            clientEmail: getFieldValue('clientEmail'),
            clientPhone: getFieldValue('clientPhone'),
            description: getFieldValue('serviceDescription'),
            material: document.getElementById('serviceMaterial').value,
            color: getFieldValue('serviceColor'),
            priority: document.getElementById('servicePriority').value,
            startDate: document.getElementById('startDate').value,
            dueDate: dateUndefined?.checked ? '' : (dueDateInput?.value || ''),
            dateUndefined: dateUndefined?.checked || false,
            value: getFieldValue('serviceValue', true),
            weight: getFieldValue('serviceWeight', true),
            observations: getFieldValue('serviceObservations'),
            deliveryMethod,
            status: document.getElementById('serviceStatus').value,
            updatedAt: new Date().toISOString(),
            updatedBy: state.currentUser.email
        };

        if (state.editingServiceId) {
            const currentService = state.services.find(s => s.id === state.editingServiceId);
            if (deliveryMethod === 'sedex') {
                const trackingCodeInput = document.getElementById('editTrackingCode');
                if (trackingCodeInput) service.trackingCode = trackingCodeInput.value.trim().toUpperCase();
            } else if (currentService?.trackingCode) {
                service.trackingCode = '';
            }
            if (currentService) {
                if (!state.selectedFile && currentService.fileUrl) Object.assign(service, { fileUrl: currentService.fileUrl, fileName: currentService.fileName || '', fileSize: currentService.fileSize || '', fileUploadedAt: currentService.fileUploadedAt || '' });
                if (state.selectedImages.length === 0 && currentService.images?.length > 0) Object.assign(service, { images: currentService.images, imageUploadedAt: currentService.imageUploadedAt || '' });
                if (!state.selectedImage && currentService.imageUrl) service.imageUrl = currentService.imageUrl;
                if (currentService.instagramPhoto) service.instagramPhoto = currentService.instagramPhoto;
                Object.assign(service, { createdAt: currentService.createdAt, createdBy: currentService.createdBy, orderCode: currentService.orderCode, serviceId: currentService.serviceId });
                if (currentService.productionStartedAt) service.productionStartedAt = currentService.productionStartedAt;
                if (currentService.completedAt) service.completedAt = currentService.completedAt;
                if (currentService.readyAt) service.readyAt = currentService.readyAt;
                if (currentService.deliveredAt) service.deliveredAt = currentService.deliveredAt;
                if (currentService.postedAt) service.postedAt = currentService.postedAt;
            }
        }

        if (state.editingServiceId) {
            const currentService = state.services.find(s => s.id === state.editingServiceId);
            if (currentService?.trackingCode && currentService.deliveryMethod === 'sedex' && (currentService.status === 'retirada' || currentService.status === 'entregue') && deliveryMethod !== 'sedex') {
                document.getElementById('deliveryMethod').value = 'sedex';
                window.toggleDeliveryFields();
                throw new Error('ERRO: Pedido já foi postado! Não é possível alterar o método de entrega.');
            }
        }

        if (!service.dateUndefined && service.dueDate && parseDateBrazil(service.dueDate) < parseDateBrazil(service.startDate))
            throw new Error('Data de entrega não pode ser anterior à data de início');

        if (deliveryMethod === 'retirada') {
            const pickupName = document.getElementById('pickupName').value.trim();
            const pickupWhatsapp = document.getElementById('pickupWhatsapp').value.trim();
            if (!pickupName || !pickupWhatsapp) throw new Error('Preencha todos os campos de retirada');
            service.pickupInfo = { name: pickupName, whatsapp: pickupWhatsapp };
        } else if (deliveryMethod === 'sedex') {
            const fields = ['fullName', 'cpfCnpj', 'email', 'telefone', 'cep', 'estado', 'cidade', 'bairro', 'rua', 'numero'];
            const addr = {};
            fields.forEach(field => { addr[field] = document.getElementById(field)?.value.trim() || ''; });
            addr.complemento = document.getElementById('complemento')?.value.trim() || '';
            if (fields.some(f => !addr[f])) throw new Error('Preencha todos os campos obrigatórios de entrega');
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.email)) throw new Error('E-mail inválido');
            service.deliveryAddress = addr;
        }

        let serviceDocId = state.editingServiceId;
        if (state.editingServiceId) {
            await state.db.collection('services').doc(state.editingServiceId).update(service);
            showToast('Serviço atualizado com sucesso!', 'success');
        } else {
            Object.assign(service, { createdAt: new Date().toISOString(), createdBy: state.currentUser.email, orderCode: generateOrderCode(), serviceId: 'SRV-' + Date.now(), fileUrl: '', fileName: '', fileSize: '', fileUploadedAt: '', imageUrl: '', images: [], imageUploadedAt: '', instagramPhoto: '', trackingCode: '' });
            const docRef = await state.db.collection('services').add(service);
            serviceDocId = docRef.id;
            document.getElementById('orderCodeDisplay').style.display = 'block';
            document.getElementById('orderCodeValue').textContent = service.orderCode;
            showToast(`Serviço criado! Código: ${service.orderCode}`, 'success');
            const sendWhatsapp = document.getElementById('sendWhatsappOnCreate')?.checked || false;
            const sendEmail = document.getElementById('sendEmailOnCreate')?.checked || false;
            if (service.clientPhone && sendWhatsapp) {
                const dueDateText = service.dateUndefined ? 'A definir' : formatDate(service.dueDate);
                const message = `Olá ${service.client}!\nSeu pedido foi registrado com sucesso.\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}\n» Prazo: ${dueDateText}\n» Entrega: ${getDeliveryMethodName(service.deliveryMethod)}\n\nAcompanhe seu pedido em:\nhttps://imaginatech.com.br/acompanhar-pedido/`;
                sendWhatsAppMessage(service.clientPhone, message);
            }
            if (service.clientEmail && sendEmail) await sendEmailNotification(service);
        }

        if (state.selectedFile && serviceDocId) {
            showToast('Fazendo upload do arquivo 3D...', 'info');
            const fileData = await uploadFile(state.selectedFile, serviceDocId);
            if (fileData) await state.db.collection('services').doc(serviceDocId).update({ fileUrl: fileData.url, fileName: fileData.name, fileSize: fileData.size, fileUploadedAt: fileData.uploadedAt });
        }

        if (state.selectedImages.length > 0 && serviceDocId) {
            showToast(`Fazendo upload de ${state.selectedImages.length} ${state.selectedImages.length > 1 ? 'imagens' : 'imagem'}...`, 'info');
            const currentService = state.services.find(s => s.id === serviceDocId);
            const existingImages = (state.editingServiceId && currentService?.images) ? currentService.images : [];
            const newImageUrls = [];
            for (const imageFile of state.selectedImages) {
                const imageData = await uploadFile(imageFile, serviceDocId);
                if (imageData) newImageUrls.push({ url: imageData.url, name: imageFile.name, uploadedAt: imageData.uploadedAt });
            }
            if (newImageUrls.length > 0) {
                const allImages = [...existingImages, ...newImageUrls];
                await state.db.collection('services').doc(serviceDocId).update({ images: allImages, imageUploadedAt: new Date().toISOString() });
                showToast(`✅ ${newImageUrls.length} ${newImageUrls.length > 1 ? 'imagens enviadas' : 'imagem enviada'}!`, 'success');
            }
        }
        window.closeModal();

    } catch (error) {
        console.error('Erro ao salvar:', error);
        showToast(error.message || 'Erro ao salvar serviço', 'error');
    } finally {
        window.toggleModalLoading(false); // Desativa o spinner
    }
}

export async function deleteService(serviceId) {
    if (!state.isAuthorized) return showToast('Sem permissão', 'error');

    const service = state.services.find(s => s.id === serviceId);
    if (!service || !confirm(`Excluir o serviço "${service.name}"?\n\nTodos os arquivos e imagens serão deletados permanentemente.`)) return;

    try {
        const filesToDelete = [];
        if (service.fileUrl) filesToDelete.push(service.fileUrl);
        if (service.images?.length > 0) service.images.forEach(img => img.url && filesToDelete.push(img.url));
        if (service.imageUrl) filesToDelete.push(service.imageUrl);
        if (service.instagramPhoto) filesToDelete.push(service.instagramPhoto);

        if (filesToDelete.length > 0) {
            showToast('Deletando arquivos...', 'info');
            for (const fileUrl of filesToDelete) {
                try {
                    await state.storage.refFromURL(fileUrl).delete();
                } catch (error) {
                    console.error('Erro ao deletar arquivo:', fileUrl, error);
                }
            }
        }

        await state.db.collection('services').doc(serviceId).delete();
        showToast('Serviço e arquivos excluídos!', 'success');
    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro ao excluir', 'error');
    }
}

// ===========================
// FILE UPLOAD
// ===========================
export async function uploadFile(file, serviceId) {
    if (!file || !state.storage) return null;
    try {
        const fileName = `${serviceId}_${Date.now()}_${file.name}`;
        const storageRef = state.storage.ref(`services/${serviceId}/${fileName}`);
        const snapshot = await storageRef.put(file);
        const url = await snapshot.ref.getDownloadURL();
        return { url, name: file.name, size: file.size, uploadedAt: new Date().toISOString() };
    } catch (error) {
        console.error('Erro ao fazer upload:', error);
        if (error.code === 'storage/unauthorized' || error.message.includes('CORS')) {
            showToast('⚠️ Erro de permissão no Firebase Storage. Configure CORS no console do Firebase.', 'error');
            console.error('SOLUÇÃO: Configure CORS no Firebase Storage para o domínio imaginatech.com.br');
        } else {
            showToast('Erro ao fazer upload do arquivo: ' + error.message, 'error');
        }
        return null;
    }
}

// ===========================
// STATUS MANAGEMENT
// ===========================
export async function updateStatus(serviceId, newStatus) {
    if (!state.isAuthorized) return showToast('Sem permissão', 'error');

    const service = state.services.find(s => s.id === serviceId);
    if (!service || service.status === newStatus) return;

    // --- LÓGICA CORRIGIDA ---
    // Verifica se a foto é necessária para o status atual ou qualquer status futuro.
    const newStatusIndex = STATUS_ORDER.indexOf(newStatus);
    const completedStatusIndex = STATUS_ORDER.indexOf('concluido');
    const photoIsRequired = newStatusIndex >= completedStatusIndex;
    const photosAreMissing = !service.instagramPhoto && (!service.images || service.images.length === 0);

    if (photoIsRequired && photosAreMissing) {
        state.pendingStatusUpdate = { serviceId, newStatus, service, requiresInstagramPhoto: true };
        window.showStatusModalWithPhoto(service, newStatus);
        return;
    }
    // --- FIM DA LÓGICA CORRIGIDA ---

    const currentStatusIndex = STATUS_ORDER.indexOf(service.status);

    if (service.trackingCode && service.deliveryMethod === 'sedex' && newStatusIndex < STATUS_ORDER.indexOf('retirada')) {
        if (!confirm(`ATENÇÃO: Este pedido já foi postado nos Correios!\nRegredir o status irá REMOVER o código de rastreio: ${service.trackingCode}\n\nDeseja continuar?`)) {
            return;
        }
    }

    if (service.deliveryMethod === 'sedex' && newStatus === 'retirada' && !service.trackingCode) {
        state.pendingStatusUpdate = { serviceId, newStatus, service };
        return window.showTrackingCodeModal();
    }

    state.pendingStatusUpdate = { serviceId, newStatus, service };

    const statusMessages = {
        'pendente': 'Marcar como Pendente',
        'producao': 'Iniciar Produção',
        'concluido': 'Marcar como Concluído',
        'retirada': service.deliveryMethod === 'retirada' ? 'Pronto para Retirada' :
            service.deliveryMethod === 'sedex' ? 'Marcar como Postado' :
            service.deliveryMethod === 'uber' ? 'Marcar como Postado' :
            service.deliveryMethod === 'definir' ? 'Marcar como Combinado' :
            'Marcar Processo de Entrega',
        'entregue': 'Confirmar Entrega'
    };

    document.getElementById('statusModalMessage') &&
        (document.getElementById('statusModalMessage').textContent = `Deseja ${statusMessages[newStatus]} para o serviço "${service.name}"?`);

    const whatsappOption = document.getElementById('whatsappOption');
    if (whatsappOption) {
        const hasPhone = service.clientPhone && service.clientPhone.trim().length > 0;
        if (hasPhone && ['producao', 'retirada', 'entregue'].includes(newStatus)) {
            whatsappOption.style.display = 'block';
            const whatsappCheckbox = document.getElementById('sendWhatsappNotification');
            if (whatsappCheckbox) whatsappCheckbox.checked = true;
        } else {
            whatsappOption.style.display = 'none';
        }
    }

    const emailOption = document.getElementById('emailOption');
    if (emailOption) {
        const hasEmail = service.clientEmail && service.clientEmail.trim().length > 0;
        if (hasEmail && ['producao', 'concluido', 'retirada', 'entregue'].includes(newStatus)) {
            emailOption.style.display = 'block';
            const emailCheckbox = document.getElementById('sendEmailNotification');
            if (emailCheckbox) emailCheckbox.checked = true;
        } else {
            emailOption.style.display = 'none';
        }
    }

    const photoField = document.getElementById('instagramPhotoField');
    if (photoField) photoField.style.display = 'none';

    document.getElementById('statusModal')?.classList.add('active');
}

export async function confirmStatusChange() {
    if (!state.pendingStatusUpdate || !state.db) return;

    window.toggleModalLoading(true); // Ativa o spinner

    const { serviceId, newStatus, service, requiresInstagramPhoto } = state.pendingStatusUpdate;

    try {
        const sendWhatsapp = document.getElementById('sendWhatsappNotification')?.checked || false;
        const sendEmail = document.getElementById('sendEmailNotification')?.checked || false;

        if (requiresInstagramPhoto) {
            if (state.pendingInstagramPhotos.length === 0) {
                throw new Error('Selecione pelo menos uma foto antes de confirmar.');
            }
            showToast(`Fazendo upload de ${state.pendingInstagramPhotos.length} foto(s)...`, 'info');
            const newImageUrls = [];
            for (const photoFile of state.pendingInstagramPhotos) {
                const photoData = await uploadFile(photoFile, serviceId);
                if (photoData) newImageUrls.push({ url: photoData.url, name: photoFile.name, uploadedAt: photoData.uploadedAt, isInstagram: true });
            }
            if (newImageUrls.length === 0) throw new Error('Erro ao fazer upload das fotos.');

            const existingImages = service.images || [];
            const allImages = [...existingImages, ...newImageUrls];

            await state.db.collection('services').doc(serviceId).update({
                images: allImages,
                instagramPhoto: newImageUrls[0].url,
                status: newStatus, // Usa o status pendente
                completedAt: service.completedAt || (newStatus === 'concluido' ? new Date().toISOString() : ''),
                updatedAt: new Date().toISOString(),
                updatedBy: state.currentUser.email,
                lastStatusChange: new Date().toISOString()
            });
            showToast(`✅ ${newImageUrls.length} foto(s) anexada(s)! Status alterado para ${getStatusLabel(newStatus)}.`, 'success');
            if (sendEmail && service.clientEmail) await sendEmailNotification(service);
            return; // Encerra a função aqui
        }

        const updates = {
            status: newStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: state.currentUser.email,
            lastStatusChange: new Date().toISOString()
        };

        const currentStatusIndex = STATUS_ORDER.indexOf(service.status);
        const newStatusIndex = STATUS_ORDER.indexOf(newStatus);

        if (newStatusIndex > currentStatusIndex) {
            const timestampField = newStatus === 'producao' ? 'productionStartedAt' :
                newStatus === 'concluido' ? 'completedAt' :
                newStatus === 'retirada' ? 'readyAt' :
                newStatus === 'entregue' ? 'deliveredAt' : null;
            if (timestampField) updates[timestampField] = new Date().toISOString();
        } else if (newStatusIndex < currentStatusIndex) {
            const timestampsToDelete = [];
            if (newStatusIndex < STATUS_ORDER.indexOf('entregue')) timestampsToDelete.push('deliveredAt');
            if (newStatusIndex < STATUS_ORDER.indexOf('retirada')) {
                timestampsToDelete.push('readyAt');
                if (service.deliveryMethod === 'sedex' && service.trackingCode) {
                    updates.trackingCode = firebase.firestore.FieldValue.delete();
                    updates.postedAt = firebase.firestore.FieldValue.delete();
                }
            }
            if (newStatusIndex < STATUS_ORDER.indexOf('concluido')) timestampsToDelete.push('completedAt');
            if (newStatusIndex < STATUS_ORDER.indexOf('producao')) timestampsToDelete.push('productionStartedAt');
            timestampsToDelete.forEach(field => { updates[field] = firebase.firestore.FieldValue.delete(); });
        }

        await state.db.collection('services').doc(serviceId).update(updates);
        showToast('Status atualizado!', 'success');

        if (sendWhatsapp && service.clientPhone) {
            const messages = {
                'producao': `✅ Iniciamos a produção!\n\n📦 ${service.name}\n📖 Código: ${service.orderCode}`,
                'retirada': service.deliveryMethod === 'retirada' ?
                    `🎉 Pronto para retirada!\n\n📦 ${service.name}\n📖 Código: ${service.orderCode}\n\nVenha buscar seu pedido!` :
                    service.deliveryMethod === 'sedex' ?
                    `📦 Postado nos Correios!\n\n📦 ${service.name}\n📖 Código: ${service.orderCode}${service.trackingCode ? `\n🔍 Rastreio: ${service.trackingCode}` : ''}` :
                    service.deliveryMethod === 'uber' ?
                    `📦 Postado via Uber Flash!\n\n📦 ${service.name}\n📖 Código: ${service.orderCode}\n\nEm breve chegará até você!` :
                    service.deliveryMethod === 'definir' ?
                    `📦 Entrega combinada!\n\n📦 ${service.name}\n📖 Código: ${service.orderCode}\n\nConforme combinado com você!` :
                    `📦 Em processo de entrega!\n\n📦 ${service.name}\n📖 Código: ${service.orderCode}`,
                'entregue': `✅ Entregue com sucesso!\n\n📦 ${service.name}\n📖 Código: ${service.orderCode}\n\nObrigado! 😊`
            };
            messages[newStatus] && sendWhatsAppMessage(service.clientPhone, messages[newStatus]);
        }
        if (sendEmail && service.clientEmail) sendEmailNotification(service);

    } catch (error) {
        console.error('Erro ao confirmar mudança de status:', error);
        showToast(error.message || 'Erro ao atualizar status', 'error');
    } finally {
        window.toggleModalLoading(false); // Desativa o spinner
        window.closeStatusModal();
    }
}

// ===========================
// RENDERING
// ===========================
export function renderServices() {
    const grid = document.getElementById('servicesGrid');
    const emptyState = document.getElementById('emptyState');
    if (!grid || !emptyState) return;

    let filtered = state.currentFilter === 'todos' ?
        state.services.filter(s => s.status !== 'entregue') :
        state.services.filter(s => s.status === state.currentFilter);

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
        emptyText && (emptyText.textContent = state.currentFilter === 'todos' ?
            'Nenhum serviço ativo encontrado' :
            `Nenhum serviço ${getStatusLabel(state.currentFilter).toLowerCase()} encontrado`);
    } else {
        grid.style.display = 'grid';
        emptyState.style.display = 'none';
        grid.innerHTML = filtered.map(service => createServiceCard(service)).join('');
    }
}

function createServiceCard(service) {
    const days = (service.status === 'entregue' || service.dateUndefined) ? null : calculateDaysRemaining(service.dueDate);
    const daysText = service.status === 'entregue' ? 'Entregue' :
        service.dateUndefined ? 'Data a definir' :
        formatDaysText(days);
    const daysColor = service.status === 'entregue' ? 'var(--neon-green)' :
        service.dateUndefined ? 'var(--neon-yellow)' :
        getDaysColor(days);

    const hasImages = (service.images && service.images.length > 0) || service.imageUrl || service.instagramPhoto;

    const getTotalImagesCount = (svc) => {
        let count = 0;
        if (svc.images && svc.images.length > 0) count += svc.images.length;
        if (svc.imageUrl && !(svc.images && svc.images.find(img => img.url === svc.imageUrl))) count += 1;
        if (svc.instagramPhoto && !(svc.images && svc.images.find(img => img.url === svc.instagramPhoto))) count += 1;
        return count;
    };

    return `
        <div class="service-card priority-${service.priority || 'media'}">
            <div class="service-header">
                <div class="service-title">
                    <h3>${escapeHtml(service.name || 'Sem nome')}</h3>
                    <span class="service-code">#${service.orderCode || 'N/A'}</span>
                </div>
                <div class="service-actions">
                    <button class="btn-icon" onclick="window.openEditModal('${service.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="window.deleteServiceGlobal('${service.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            ${service.deliveryMethod ? `
            <div class="delivery-badge ${service.status !== 'entregue' && days !== null && days < 0 ? 'badge-late' : service.status !== 'entregue' && days !== null && days <= 2 ? 'badge-urgent' : ''}">
                <div class="delivery-info">
                    <i class="fas ${getDeliveryIcon(service.deliveryMethod)}"></i>
                    ${getDeliveryMethodName(service.deliveryMethod)}${service.trackingCode ? ` - ${service.trackingCode}` : ''}
                </div>
                <div class="delivery-time ${service.status === 'entregue' ? 'time-delivered' : days !== null && days < 0 ? 'time-late' : days !== null && days <= 2 ? 'time-urgent' : days !== null && days <= 5 ? 'time-warning' : 'time-normal'}">
                    <i class="fas ${service.status === 'entregue' ? 'fa-check-circle' : 'fa-clock'}"></i>
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
                ${service.fileUrl ? `<div class="info-item"><button class="btn-download" onclick="window.downloadFile('${service.fileUrl}', '${escapeHtml(service.fileName || 'arquivo')}')" title="Download automático"><i class="fas fa-download"></i><span>Arquivo 3D</span></button></div>` : ''}
                ${hasImages ? `<div class="info-item"><button class="btn-image-view" onclick="window.showServiceImages('${service.id}')" title="Ver Imagens"><i class="fas fa-image"></i><span>${getTotalImagesCount(service)} ${getTotalImagesCount(service) > 1 ? 'Imagens' : 'Imagem'}</span></button></div>` : ''}
            </div>
            
            ${service.description ? `<div class="service-description"><p>${escapeHtml(service.description)}</p></div>` : ''}
            
            <div class="service-status">
                <div class="status-timeline">
                    ${createStatusTimeline(service)}
                </div>
            </div>
            
            <div class="service-footer">
                ${service.clientPhone ? `<button class="btn-whatsapp" onclick="window.contactClient('${escapeHtml(service.clientPhone)}', '${escapeHtml(service.name || '')}', '${service.orderCode || 'N/A'}')"><i class="fab fa-whatsapp"></i> Contatar</button>` : ''}
                ${service.deliveryMethod ? `<button class="btn-delivery" onclick="window.showDeliveryInfo('${service.id}')"><i class="fas fa-truck"></i> Ver Entrega</button>` : ''}
            </div>
        </div>
    `;
}

function createStatusTimeline(service) {
    return ['pendente', 'producao', 'concluido', 'retirada', 'entregue'].map(status => {
        const isActive = service.status === status;
        const isCompleted = isStatusCompleted(service.status, status);

        let label;
        if (status === 'pendente') label = 'Pendente';
        else if (status === 'producao') label = 'Produção';
        else if (status === 'concluido') label = 'Concluído';
        else if (status === 'retirada') {
            if (service.deliveryMethod === 'retirada') label = 'Para Retirar';
            else if (service.deliveryMethod === 'sedex') label = 'Postado';
            else if (service.deliveryMethod === 'uber') label = 'Postado';
            else if (service.deliveryMethod === 'definir') label = 'Combinado';
            else label = 'Entrega';
        } else if (status === 'entregue') label = 'Entregue';

        return `
            <div class="timeline-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}">
                <button class="step-button" 
                        onclick="window.updateStatusGlobal('${service.id}', '${status}')"
                        ${isActive ? 'disabled' : ''}>
                    <span class="step-icon">
                        <i class="fas ${getStatusIcon(status)}"></i>
                    </span>
                    <span class="step-text">${label}</span>
                </button>
            </div>
        `;
    }).join('');
}

export function updateStats() {
    const stats = {
        active: state.services.filter(s => s.status !== 'entregue').length,
        pendente: state.services.filter(s => s.status === 'pendente').length,
        producao: state.services.filter(s => s.status === 'producao').length,
        concluido: state.services.filter(s => s.status === 'concluido').length,
        retirada: state.services.filter(s => s.status === 'retirada').length,
        entregue: state.services.filter(s => s.status === 'entregue').length
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

export function filterServices(filter) {
    state.currentFilter = filter;
    document.querySelectorAll('.stat-card').forEach(card => card.classList.remove('active'));
    event?.currentTarget?.classList.add('active');
    renderServices();
}
