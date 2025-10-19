/* ==================================================
ARQUIVO: servicos/js/services.js
MÓDULO: Lógica de Serviços (CRUD, Status, Upload, Renderização)
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 3.4 - Remoção Individual de Arquivos
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
    sendEmailNotification,
    saveClientToFirestore
} from './auth-ui.js';

// ===========================
// CONSTANTS
// ===========================
const STATUS_ORDER = ['pendente', 'producao', 'concluido', 'retirada', 'entregue'];

// ===========================
// UTILITY FUNCTIONS
// ===========================
export const generateOrderCode = () => Array(5).fill(0).map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');

// ===========================
// FIRESTORE LISTENER
// ===========================
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
                clientCPF: data.clientCPF || '',
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
                files: data.files || [],
                fileUrl: data.fileUrl || '',
                fileName: data.fileName || '',
                fileSize: data.fileSize || '',
                fileUploadedAt: data.fileUploadedAt || '',
                imageUrl: data.imageUrl || '',
                images: data.images || [],
                imageUploadedAt: data.imageUploadedAt || '',
                instagramPhoto: data.instagramPhoto || '',
                packagedPhotos: data.packagedPhotos || [],
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

// ===========================
// CRUD OPERATIONS
// ===========================
export async function saveService(event) {
    event.preventDefault();
    
    if (!state.isAuthorized || !state.db || !state.currentUser) 
        return showToast(!state.isAuthorized ? 'Sem permissão' : 'Sistema não está pronto', 'error');
    
    const deliveryMethod = document.getElementById('deliveryMethod').value;
    if (!deliveryMethod) return showToast('Selecione um método de entrega', 'error');
    
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
        clientCPF: getFieldValue('clientCPF'),
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
            if (trackingCodeInput) {
                service.trackingCode = trackingCodeInput.value.trim().toUpperCase();
            }
        } else {
            if (currentService && currentService.trackingCode) {
                service.trackingCode = '';
            }
        }
        
        if (currentService) {
            if (state.selectedFiles.length === 0 && currentService.files && currentService.files.length > 0) {
                service.files = currentService.files;
            }
            if (state.selectedFiles.length === 0 && !currentService.files && currentService.fileUrl) {
                service.fileUrl = currentService.fileUrl;
                service.fileName = currentService.fileName || '';
                service.fileSize = currentService.fileSize || '';
                service.fileUploadedAt = currentService.fileUploadedAt || '';
            }
            
            if (state.selectedImages.length === 0 && currentService.images && currentService.images.length > 0) {
                service.images = currentService.images;
                service.imageUploadedAt = currentService.imageUploadedAt || '';
            }
            if (!state.selectedImage && currentService.imageUrl) {
                service.imageUrl = currentService.imageUrl;
            }
            
            if (currentService.instagramPhoto) {
                service.instagramPhoto = currentService.instagramPhoto;
            }
            
            if (currentService.packagedPhotos && currentService.packagedPhotos.length > 0) {
                service.packagedPhotos = currentService.packagedPhotos;
            }
            
            service.createdAt = currentService.createdAt;
            service.createdBy = currentService.createdBy;
            service.orderCode = currentService.orderCode;
            service.serviceId = currentService.serviceId;
            
            if (currentService.productionStartedAt) service.productionStartedAt = currentService.productionStartedAt;
            if (currentService.completedAt) service.completedAt = currentService.completedAt;
            if (currentService.readyAt) service.readyAt = currentService.readyAt;
            if (currentService.deliveredAt) service.deliveredAt = currentService.deliveredAt;
            if (currentService.postedAt) service.postedAt = currentService.postedAt;
        }
    }
    
    if (state.editingServiceId) {
        const currentService = state.services.find(s => s.id === state.editingServiceId);
        if (currentService && currentService.trackingCode && currentService.deliveryMethod === 'sedex' && 
            (currentService.status === 'retirada' || currentService.status === 'entregue')) {
            
            if (deliveryMethod !== 'sedex') {
                showToast('ERRO: Pedido já foi postado nos Correios! Não é possível alterar o método de entrega.', 'error');
                return;
            }
        }
    }
    
    if (deliveryMethod === 'sedex') {
        const requiredFields = ['street', 'number', 'neighborhood', 'city', 'state', 'cep'];
        const addressFields = {};
        
        requiredFields.forEach(field => {
            const value = document.getElementById(field)?.value?.trim();
            addressFields[field] = value || '';
        });
        
        addressFields.complement = document.getElementById('complement')?.value?.trim() || '';
        
        const missingFields = requiredFields.filter(field => !addressFields[field]);
        if (missingFields.length > 0) {
            return showToast('Preencha todos os campos obrigatórios do endereço de entrega', 'error');
        }
        
        service.deliveryAddress = addressFields;
    } else if (deliveryMethod === 'retirada') {
        service.pickupInfo = {
            location: document.getElementById('pickupLocation')?.value?.trim() || '',
            whatsapp: document.getElementById('pickupWhatsapp')?.value?.trim() || ''
        };
    }
    
    try {
        let serviceDocId;
        
        if (state.editingServiceId) {
            await state.db.collection('services').doc(state.editingServiceId).update(service);
            serviceDocId = state.editingServiceId;
            showToast('Serviço atualizado!', 'success');
        } else {
            const orderCode = generateOrderCode();
            const newService = {
                ...service,
                orderCode,
                serviceId: orderCode,
                createdAt: new Date().toISOString(),
                createdBy: state.currentUser.email
            };
            
            const docRef = await state.db.collection('services').add(newService);
            serviceDocId = docRef.id;
            showToast(`Serviço criado! Código: ${orderCode}`, 'success');
            
            const sendWhatsapp = document.getElementById('sendWhatsappOnCreate')?.checked || false;
            const sendEmail = document.getElementById('sendEmailOnCreate')?.checked || false;
            
            if (service.clientPhone && sendWhatsapp) {
                const dueDateText = service.dateUndefined ? 'A definir' : formatDate(service.dueDate);
                const message = `Olá ${service.client}!\nSeu pedido foi registrado com sucesso.\n\n» Serviço: ${service.name}\n» Código: ${orderCode}\n» Prazo: ${dueDateText}\n» Entrega: ${getDeliveryMethodName(service.deliveryMethod)}\n\nAcompanhe seu pedido em:\nhttps://imaginatech.com.br/acompanhar-pedido/`;
                sendWhatsAppMessage(service.clientPhone, message);
            }
            
            if (service.clientEmail && sendEmail) {
                await sendEmailNotification(service);
            }
        }
        
        if (service.client) {
            const clientData = {
                name: service.client,
                cpf: service.clientCPF,
                email: service.clientEmail,
                phone: service.clientPhone
            };
            
            if (service.deliveryMethod === 'sedex' && service.deliveryAddress) {
                clientData.address = service.deliveryAddress;
            }
            
            await saveClientToFirestore(clientData);
        }
        
        if (state.selectedFiles.length > 0 && serviceDocId) {
            showToast(`Fazendo upload de ${state.selectedFiles.length} ${state.selectedFiles.length > 1 ? 'arquivos' : 'arquivo'}...`, 'info');
            
            const currentService = state.services.find(s => s.id === serviceDocId);
            const existingFiles = (state.editingServiceId && currentService && currentService.files) ? currentService.files : [];
            
            const newFiles = [];
            for (const file of state.selectedFiles) {
                const fileData = await uploadFile(file, serviceDocId);
                if (fileData) {
                    newFiles.push({
                        url: fileData.url,
                        name: file.name,
                        size: fileData.size,
                        uploadedAt: fileData.uploadedAt
                    });
                }
            }
            
            if (newFiles.length > 0) {
                const allFiles = [...existingFiles, ...newFiles];
                await state.db.collection('services').doc(serviceDocId).update({
                    files: allFiles,
                    fileUploadedAt: new Date().toISOString()
                });
                showToast(`✅ ${newFiles.length} ${newFiles.length > 1 ? 'arquivos enviados' : 'arquivo enviado'}!`, 'success');
            }
        }
        
        if (state.selectedImages.length > 0 && serviceDocId) {
            showToast(`Fazendo upload de ${state.selectedImages.length} ${state.selectedImages.length > 1 ? 'imagens' : 'imagem'}...`, 'info');
            
            const currentService = state.services.find(s => s.id === serviceDocId);
            const existingImages = (state.editingServiceId && currentService && currentService.images) ? currentService.images : [];
            
            const newImageUrls = [];
            for (const imageFile of state.selectedImages) {
                const imageData = await uploadFile(imageFile, serviceDocId);
                if (imageData) {
                    newImageUrls.push({
                        url: imageData.url,
                        name: imageFile.name,
                        uploadedAt: imageData.uploadedAt
                    });
                }
            }
            
            if (newImageUrls.length > 0) {
                const allImages = [...existingImages, ...newImageUrls];
                await state.db.collection('services').doc(serviceDocId).update({
                    images: allImages,
                    imageUploadedAt: new Date().toISOString()
                });
                showToast(`✅ ${newImageUrls.length} ${newImageUrls.length > 1 ? 'imagens enviadas' : 'imagem enviada'}!`, 'success');
            }
        }
        
        window.closeModal();
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showToast('Erro ao salvar serviço', 'error');
    }
}

export async function deleteService(serviceId) {
    if (!state.isAuthorized) return showToast('Sem permissão', 'error');
    
    const service = state.services.find(s => s.id === serviceId);
    if (!service || !confirm(`Excluir o serviço "${service.name}"?\n\nTodos os arquivos e imagens serão deletados permanentemente.`)) return;
    
    try {
        const filesToDelete = [];
        
        if (service.files && service.files.length > 0) {
            service.files.forEach(file => file.url && filesToDelete.push(file.url));
        }
        if (service.fileUrl) filesToDelete.push(service.fileUrl);
        
        if (service.images && service.images.length > 0) {
            service.images.forEach(img => img.url && filesToDelete.push(img.url));
        }
        if (service.imageUrl) filesToDelete.push(service.imageUrl);
        if (service.instagramPhoto) filesToDelete.push(service.instagramPhoto);
        
        if (service.packagedPhotos && service.packagedPhotos.length > 0) {
            service.packagedPhotos.forEach(photo => photo.url && filesToDelete.push(photo.url));
        }
        
        if (filesToDelete.length > 0) {
            showToast('Deletando arquivos...', 'info');
            
            for (const fileUrl of filesToDelete) {
                try {
                    const fileRef = state.storage.refFromURL(fileUrl);
                    await fileRef.delete();
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
// NOVA FUNCIONALIDADE: REMOVER ARQUIVO INDIVIDUAL
// ===========================
export async function removeFileFromService(serviceId, fileIndex, fileUrl) {
    if (!state.isAuthorized) return showToast('Sem permissão para remover arquivos', 'error');
    
    const service = state.services.find(s => s.id === serviceId);
    if (!service || !service.files || !service.files[fileIndex]) {
        return showToast('Arquivo não encontrado', 'error');
    }
    
    if (!confirm('Deseja realmente remover este arquivo?\n\nEsta ação não pode ser desfeita.')) return;
    
    try {
        showToast('Removendo arquivo...', 'info');
        
        // Deletar do Storage
        try {
            const fileRef = state.storage.refFromURL(fileUrl);
            await fileRef.delete();
        } catch (storageError) {
            console.error('Erro ao deletar do Storage:', storageError);
        }
        
        // Atualizar Firestore
        const updatedFiles = service.files.filter((_, index) => index !== fileIndex);
        
        await state.db.collection('services').doc(serviceId).update({
            files: updatedFiles,
            lastModified: new Date().toISOString()
        });
        
        showToast('Arquivo removido com sucesso!', 'success');
        
        // Atualizar modal se estiver aberto
        const modal = document.getElementById('filesViewerModal');
        if (modal && modal.classList.contains('show')) {
            setTimeout(() => {
                if (window.showFilesModal && typeof window.showFilesModal === 'function') {
                    window.showFilesModal(service.name, updatedFiles, serviceId);
                }
            }, 300);
        }
        
    } catch (error) {
        console.error('Erro ao remover arquivo:', error);
        showToast('Erro ao remover arquivo: ' + error.message, 'error');
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
    
    const currentIndex = STATUS_ORDER.indexOf(service.status);
    const newIndex = STATUS_ORDER.indexOf(newStatus);
    
    if (newIndex > currentIndex) {
        const nextAllowedStatus = STATUS_ORDER[currentIndex + 1];
        
        if (newStatus !== nextAllowedStatus) {
            const statusNames = {
                'pendente': 'Pendente',
                'producao': 'Produção',
                'concluido': 'Concluído',
                'retirada': 'Processo de Entrega',
                'entregue': 'Entregue'
            };
            showToast(`❌ Você deve seguir a ordem: ${statusNames[service.status]} → ${statusNames[nextAllowedStatus]}`, 'error');
            return;
        }
    }
    
    if (newStatus === 'concluido' && !service.instagramPhoto && (!service.images || service.images.length === 0)) {
        state.pendingStatusUpdate = { serviceId, newStatus, service, requiresInstagramPhoto: true };
        window.showStatusModalWithPhoto(service, newStatus);
        return;
    }
    
    if (newStatus === 'retirada') {
        if (!service.instagramPhoto && (!service.images || service.images.length === 0)) {
            showToast('❌ Para marcar como Pronto/Postado, é necessário ter fotos do produto finalizado', 'error');
            return;
        }
        
        if (!service.packagedPhotos || service.packagedPhotos.length === 0) {
            state.pendingStatusUpdate = { serviceId, newStatus, service, requiresPackagedPhoto: true };
            window.showStatusModalWithPackagedPhoto(service, newStatus);
            return;
        }
    }
    
    if (newStatus === 'entregue') {
        if (!service.instagramPhoto && (!service.images || service.images.length === 0)) {
            showToast('❌ Para marcar como Entregue, é necessário ter fotos do produto finalizado', 'error');
            return;
        }
        
        if (!service.packagedPhotos || service.packagedPhotos.length === 0) {
            showToast('❌ Para marcar como Entregue, é necessário ter fotos do produto embalado', 'error');
            return;
        }
    }
    
    if (newStatus === 'retirada' && service.deliveryMethod === 'sedex') {
        state.pendingStatusUpdate = { serviceId, newStatus, service };
        window.showTrackingCodeModal(service);
        return;
    }
    
    state.pendingStatusUpdate = { serviceId, newStatus, service };
    window.showStatusModalWithPhoto(service, newStatus);
}

export async function confirmStatusChange() {
    if (!state.pendingStatusUpdate) return;
    
    const { serviceId, newStatus, service, requiresInstagramPhoto, requiresPackagedPhoto } = state.pendingStatusUpdate;
    
    const sendWhatsapp = document.getElementById('sendWhatsappNotification')?.checked || false;
    const sendEmail = document.getElementById('sendEmailNotification')?.checked || false;
    
    if (requiresPackagedPhoto) {
        if (state.pendingPackagedPhotos.length === 0) {
            return showToast('Selecione pelo menos uma foto do produto embalado antes de confirmar.', 'error');
        }

        try {
            showToast(`Fazendo upload de ${state.pendingPackagedPhotos.length} foto(s) embalada(s)...`, 'info');

            const newPackagedPhotos = [];
            for (const photoFile of state.pendingPackagedPhotos) {
                const photoData = await uploadFile(photoFile, serviceId);
                if (photoData) {
                    newPackagedPhotos.push({
                        url: photoData.url,
                        name: photoFile.name,
                        uploadedAt: photoData.uploadedAt
                    });
                }
            }

            if (newPackagedPhotos.length === 0) {
                return showToast('Erro ao fazer upload das fotos embaladas.', 'error');
            }

            const existingPackaged = service.packagedPhotos || [];
            const allPackaged = [...existingPackaged, ...newPackagedPhotos];

            await state.db.collection('services').doc(serviceId).update({
                packagedPhotos: allPackaged,
                status: 'retirada',
                readyAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                updatedBy: state.currentUser.email,
                lastStatusChange: new Date().toISOString()
            });

            showToast(`✅ ${newPackagedPhotos.length} foto(s) embalada(s) anexada(s)! Status alterado.`, 'success');

            if (sendEmail && service.clientEmail) {
                await sendEmailNotification(service);
            }

            window.closeStatusModal();
            return;
        } catch (error) {
            console.error('Erro ao confirmar fotos embaladas:', error);
            showToast('Erro ao processar as fotos embaladas.', 'error');
            return;
        }
    }
    
    if (requiresInstagramPhoto) {
        if (state.pendingInstagramPhotos.length === 0) {
            return showToast('Selecione pelo menos uma foto antes de confirmar.', 'error');
        }

        try {
            showToast(`Fazendo upload de ${state.pendingInstagramPhotos.length} foto(s)...`, 'info');

            const newImageUrls = [];
            for (const photoFile of state.pendingInstagramPhotos) {
                const photoData = await uploadFile(photoFile, serviceId);
                if (photoData) {
                    newImageUrls.push({
                        url: photoData.url,
                        name: photoFile.name,
                        uploadedAt: photoData.uploadedAt,
                        isInstagram: true
                    });
                }
            }

            if (newImageUrls.length === 0) {
                return showToast('Erro ao fazer upload das fotos.', 'error');
            }

            const existingImages = service.images || [];
            const allImages = [...existingImages, ...newImageUrls];

            await state.db.collection('services').doc(serviceId).update({
                images: allImages,
                status: newStatus,
                completedAt: newStatus === 'concluido' ? new Date().toISOString() : service.completedAt,
                updatedAt: new Date().toISOString(),
                updatedBy: state.currentUser.email,
                lastStatusChange: new Date().toISOString()
            });

            showToast(`✅ ${newImageUrls.length} foto(s) anexada(s)! Status alterado para ${getStatusLabel(newStatus)}.`, 'success');

            if (sendWhatsapp && service.clientPhone) {
                const messages = {
                    'concluido': `🎉 Seu pedido está pronto!\n\n📦 ${service.name}\n📖 Código: ${service.orderCode}`,
                };
                messages[newStatus] && sendWhatsAppMessage(service.clientPhone, messages[newStatus]);
            }

            if (sendEmail && service.clientEmail) {
                await sendEmailNotification(service);
            }

            window.closeStatusModal();
            return;
        } catch (error) {
            console.error('Erro ao confirmar fotos:', error);
            showToast('Erro ao processar as fotos.', 'error');
            return;
        }
    }
    
    try {
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
            
            if (timestampField) {
                updates[timestampField] = new Date().toISOString();
            }
        } 
        else if (newStatusIndex < currentStatusIndex) {
            const timestampsToDelete = [];
            
            if (newStatusIndex < STATUS_ORDER.indexOf('entregue')) {
                timestampsToDelete.push('deliveredAt');
            }
            if (newStatusIndex < STATUS_ORDER.indexOf('retirada')) {
                timestampsToDelete.push('readyAt');
                if (service.deliveryMethod === 'sedex' && service.trackingCode) {
                    updates.trackingCode = firebase.firestore.FieldValue.delete();
                    updates.postedAt = firebase.firestore.FieldValue.delete();
                }
            }
            if (newStatusIndex < STATUS_ORDER.indexOf('concluido')) {
                timestampsToDelete.push('completedAt');
            }
            if (newStatusIndex < STATUS_ORDER.indexOf('producao')) {
                timestampsToDelete.push('productionStartedAt');
            }
            
            timestampsToDelete.forEach(field => {
                updates[field] = firebase.firestore.FieldValue.delete();
            });
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
        
        if (sendEmail && service.clientEmail) {
            sendEmailNotification(service);
        }
    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro ao atualizar status', 'error');
    }
    window.closeStatusModal();
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
    
    if (state.currentFilter === 'concluido') {
        filtered.sort((a, b) => {
            const dateA = new Date(a.completedAt || a.createdAt || 0);
            const dateB = new Date(b.completedAt || b.createdAt || 0);
            return dateB - dateA;
        });
    } else if (state.currentFilter === 'entregue') {
        filtered.sort((a, b) => {
            const dateA = new Date(a.deliveredAt || a.createdAt || 0);
            const dateB = new Date(b.deliveredAt || b.createdAt || 0);
            return dateB - dateA;
        });
    } else {
        filtered.sort((a, b) => {
            const priority = { urgente: 4, alta: 3, media: 2, baixa: 1 };
            const diff = (priority[b.priority] || 0) - (priority[a.priority] || 0);
            if (diff !== 0) return diff;
            
            if (a.dateUndefined !== b.dateUndefined) return a.dateUndefined ? 1 : -1;
            return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
        });
    }
    
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
    
    const hasImages = (service.images && service.images.length > 0) || service.imageUrl || service.instagramPhoto || (service.packagedPhotos && service.packagedPhotos.length > 0);
    
    const getTotalImagesCount = (svc) => {
        let count = 0;
        if (svc.images && svc.images.length > 0) count += svc.images.length;
        if (svc.imageUrl && !(svc.images && svc.images.find(img => img.url === svc.imageUrl))) count += 1;
        if (svc.instagramPhoto && !(svc.images && svc.images.find(img => img.url === svc.instagramPhoto))) count +=1;
        if (svc.packagedPhotos && svc.packagedPhotos.length > 0) count += svc.packagedPhotos.length;
        return count;
    };
    
    const filesCount = (service.files && service.files.length > 0) ? service.files.length : (service.fileUrl ? 1 : 0);
    
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
            <div class="delivery-badge" style="background: ${service.deliveryMethod === 'sedex' ? 'linear-gradient(135deg, #9945FF, #B845FF)' : service.deliveryMethod === 'retirada' ? 'linear-gradient(135deg, #00FF88, #00D4AA)' : service.deliveryMethod === 'uber' ? 'linear-gradient(135deg, #FF6B35, #F7931E)' : 'linear-gradient(135deg, #FFD700, #FFA500)'};">
                <div class="delivery-info">
                    <i class="fas ${getDeliveryIcon(service.deliveryMethod)}"></i>
                    <span>${getDeliveryMethodName(service.deliveryMethod)}</span>
                </div>
                <div class="delivery-time" style="background: ${daysColor};">
                    <i class="fas fa-clock"></i>
                    <span>${daysText}</span>
                </div>
            </div>
            ` : ''}
            
            <div class="service-description">
                <p>${escapeHtml(service.description || 'Sem descrição')}</p>
            </div>
            
            <div class="info-grid">
                <div class="info-item">
                    <i class="fas fa-user"></i>
                    <span>${escapeHtml(service.client || 'N/A')}</span>
                </div>
                <div class="info-item">
                    <i class="fas fa-phone"></i>
                    <span>${service.clientPhone || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <i class="fas fa-cube"></i>
                    <span>${service.material || 'N/A'}</span>
                </div>
                <div class="info-item">
                    <i class="fas fa-palette"></i>
                    <span>${formatColorName(service.color) || 'N/A'}</span>
                </div>
                ${service.value ? `
                <div class="info-item">
                    <i class="fas fa-dollar-sign"></i>
                    <span>${formatMoney(service.value)}</span>
                </div>
                ` : ''}
                ${service.weight ? `
                <div class="info-item">
                    <i class="fas fa-weight-hanging"></i>
                    <span>${service.weight}g</span>
                </div>
                ` : ''}
                ${filesCount > 0 ? `
                <div class="info-item clickable" onclick="window.showServiceFiles('${service.id}')" style="cursor: pointer;">
                    <i class="fas fa-file"></i>
                    <span>${filesCount} arquivo${filesCount > 1 ? 's' : ''}</span>
                </div>
                ` : ''}
                ${hasImages ? `
                <div class="info-item clickable" onclick="window.showServiceImages('${service.id}')" style="cursor: pointer;">
                    <i class="fas fa-images"></i>
                    <span>${getTotalImagesCount(service)} foto${getTotalImagesCount(service) > 1 ? 's' : ''}</span>
                </div>
                ` : ''}
            </div>
            
            <div class="service-status">
                <div class="status-timeline">
                    ${renderTimeline(service)}
                </div>
            </div>
            
            <div class="service-footer">
                ${service.clientPhone ? `
                <button class="btn-whatsapp" onclick="window.contactClient('${service.clientPhone}', '${escapeHtml(service.name)}', '${service.orderCode}')">
                    <i class="fab fa-whatsapp"></i>
                    <span>WhatsApp</span>
                </button>
                ` : ''}
                ${service.deliveryMethod ? `
                <button class="btn-delivery" onclick="window.showDeliveryInfo('${service.id}')">
                    <i class="fas ${getDeliveryIcon(service.deliveryMethod)}"></i>
                    <span>Ver Entrega</span>
                </button>
                ` : ''}
            </div>
        </div>
    `;
}

function renderTimeline(service) {
    return STATUS_ORDER.map(status => {
        const isActive = service.status === status;
        const isCompleted = isStatusCompleted(service.status, status);
        const label = getStatusLabel(status);
        
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