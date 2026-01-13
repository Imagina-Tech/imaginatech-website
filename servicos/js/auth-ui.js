/* ==================================================
ARQUIVO: servicos/js/auth-ui.js
MÓDULO: Autenticação, Interface e Utilities
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 3.5 - Correção de Redundâncias
IMPORTANTE: NÃO REMOVER ESTE CABEÇALHO DE IDENTIFICAÇÃO
==================================================
*/

import { state, AUTHORIZED_EMAILS, AUTHORIZED_ADMINS, BYPASS_PASSWORD, EMAILJS_CONFIG, WHATSAPP_NUMBER } from './config.js';
import {
    startServicesListener,
    saveService,
    deleteService,
    updateStatus,
    confirmStatusChange,
    renderServices,
    filterServices,
    uploadFile,
    loadAvailableFilaments,
    updateMaterialDropdown,
    updateColorDropdown,
    generateOrderCode,
    // Portfolio Up Functions
    openUpModal,
    closeUpModal,
    showUpForm,
    toggleCategoryField,
    handleUpPhotoSelect,
    removeUpPhoto,
    handleUpLogoSelect,
    removeUpLogo,
    saveToPortfolio,
    setupUpModalDragDrop,
    // Extra Photos (Galeria)
    removeExtraPhoto,
    // Multi-Cor
    loadMultiColorData,
    resetMultiColorState
} from './services.js';

// Importar utilitários do utils.js
import {
    escapeHtml,
    formatDate,
    formatDateBrazil,
    formatDaysText,
    getDaysColor,
    formatMoney,
    formatFileSize,
    formatColorName,
    getDeliveryMethodName,
    getDeliveryIcon,
    getStatusLabel,
    getStatusIcon,
    isStatusCompleted,
    getTodayBrazil,
    parseDateBrazil,
    calculateDaysRemaining,
    formatTimeAgo,
    isRecentAccess,
    STATUS_ORDER,
    PRIORITY_CONFIG
} from './utils.js';

// Re-exportar utilitários para manter compatibilidade com services.js
export {
    escapeHtml,
    formatDate,
    formatDateBrazil,
    formatDaysText,
    getDaysColor,
    formatMoney,
    formatFileSize,
    formatColorName,
    getDeliveryMethodName,
    getDeliveryIcon,
    getStatusLabel,
    getStatusIcon,
    isStatusCompleted,
    getTodayBrazil,
    parseDateBrazil,
    calculateDaysRemaining,
    // Portfolio Up Drag & Drop
    setupUpModalDragDrop
};

// ===========================
// AUTHENTICATION
// ===========================

export async function signInWithGoogle() {
    if (!state.auth) return showToast('Sistema não está pronto. Recarregue a página.', 'error');

    try {
        const result = await state.auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
        const user = result.user;

        if (!AUTHORIZED_EMAILS.includes(user.email)) {
            state.currentUser = user;
            state.isAuthorized = false;
            showAccessDeniedScreen(user);
            showToast(`Ola ${user.displayName}! Esta area e restrita aos administradores.`, 'info');
            return;
        }

        state.currentUser = user;
        state.isAuthorized = true;
        showToast(`Bem-vindo, ${user.displayName}!`, 'success');

    } catch (error) {
        console.error('Erro no login:', error);

        if (error.code === 'auth/popup-closed-by-user') {
            showToast('Login cancelado', 'info');
        } else {
            showToast('Erro ao fazer login: ' + (error.message || 'Tente novamente'), 'error');
        }
    }
}
export async function signOut() {
    try {
        // Destruir listeners antes do logout para evitar erros de permissão
        if (window.destroyTasksSystem) {
            window.destroyTasksSystem();
        }
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

        // CORRIGIDO: Iniciar listener de filamentos imediatamente
        // Isso garante que o estoque esteja sincronizado em real-time
        loadAvailableFilaments().then(() => {
            console.log('📦 Listener de estoque iniciado');
        }).catch(err => {
            console.error('❌ Erro ao iniciar listener de estoque:', err);
        });

        // Nota: updateLastAccess é chamado diretamente no main.js
    } else {
        state.isAuthorized = false;
        showAccessDeniedScreen(user);
    }
}

// ===========================
// ADMIN ACCESS TRACKING
// ===========================
export async function updateLastAccess(user) {
    if (!state.db || !user) return;

    try {
        const userEmail = user.email;
        const userId = user.uid;

        // Detect device type
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const deviceType = isMobile ? 'Mobile' : 'Computador';

        await state.db.collection('adminAccess').doc(userId).set({
            email: userEmail,
            name: user.displayName || userEmail,
            photoURL: user.photoURL || null,
            lastAccess: new Date().toISOString(),
            device: navigator.userAgent,
            deviceType: deviceType,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log('✅ Último acesso registrado para:', userEmail);
    } catch (error) {
        console.error('❌ Erro ao registrar último acesso:', error);
    }
}

// ===========================
// UI MANAGEMENT
// ===========================
export function showLoginScreen() {
    document.getElementById('loginScreen')?.classList.add('active');
    document.getElementById('adminDashboard')?.classList.add('hidden');
    document.getElementById('accessDeniedScreen')?.classList.remove('active');
    state.servicesListener?.();
    state.servicesListener = null;
}

export function showAdminDashboard(user) {
    document.getElementById('loginScreen')?.classList.remove('active');
    document.getElementById('adminDashboard')?.classList.remove('hidden');
    document.getElementById('accessDeniedScreen')?.classList.remove('active');
    document.getElementById('userName') && (document.getElementById('userName').textContent = user.displayName || user.email);
    document.getElementById('userPhoto') && (document.getElementById('userPhoto').src = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || user.email) + '&background=00D4FF&color=fff');
}

export function showAccessDeniedScreen(user) {
    document.getElementById('loginScreen')?.classList.remove('active');
    document.getElementById('adminDashboard')?.classList.add('hidden');

    let accessDeniedScreen = document.getElementById('accessDeniedScreen');
    if (!accessDeniedScreen) {
        accessDeniedScreen = document.createElement('div');
        accessDeniedScreen.id = 'accessDeniedScreen';
        accessDeniedScreen.className = 'access-denied-screen';
        accessDeniedScreen.innerHTML = `
            <div class="access-denied-content">
                <div class="access-denied-icon">
                    <i class="fas fa-lock"></i>
                </div>
                <h1 class="access-denied-title">Acesso Restrito</h1>
                <p class="access-denied-message">
                    Ola ${user.displayName || 'Usuario'}, esta area e exclusiva para administradores.
                </p>
                <p class="access-denied-submessage">
                    O painel de servicos requer permissao especial de acesso.
                </p>
                <div class="access-denied-user">
                    <i class="fas fa-user-slash"></i>
                    <span>${user.email}</span>
                </div>
                <div class="access-denied-actions">
                    <a href="/" class="access-denied-btn btn-primary">
                        <i class="fas fa-home"></i>
                        Voltar ao Inicio
                    </a>
                    <a href="/acompanhar-pedido/" class="access-denied-btn btn-secondary">
                        <i class="fas fa-cube"></i>
                        Acompanhar Pedido
                    </a>
                </div>
                <button class="access-denied-btn btn-logout" onclick="window.signOutGlobal()">
                    <i class="fas fa-sign-out-alt"></i>
                    Fazer Logout
                </button>
            </div>
        `;
        document.body.appendChild(accessDeniedScreen);
    } else {
        const message = accessDeniedScreen.querySelector('.access-denied-message');
        const userEmail = accessDeniedScreen.querySelector('.access-denied-user span');
        if (message) message.textContent = `Ola ${user.displayName || 'Usuario'}, esta area e exclusiva para administradores.`;
        if (userEmail) userEmail.textContent = user.email;
    }

    accessDeniedScreen.classList.add('active');
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
    const migrationKey = 'imaginatech_clients_migrated_v3';

    if (localStorage.getItem(migrationKey)) {
        console.log('✅ Migração de clientes já realizada anteriormente');
        return;
    }

    console.log('🔄 Iniciando migração completa de clientes existentes...');

    try {
        const servicesSnapshot = await state.db.collection('services').get();
        const clientsToMigrate = new Map();

        // Agrupar todos os serviços por cliente
        servicesSnapshot.forEach(doc => {
            const service = doc.data();
            if (service.client && service.client.trim()) {
                const clientKey = service.client.toLowerCase().trim();

                if (!clientsToMigrate.has(clientKey)) {
                    clientsToMigrate.set(clientKey, {
                        name: service.client,
                        cpf: service.clientCPF || '',
                        email: (service.clientEmail || '').toLowerCase(),
                        phone: service.clientPhone || '',
                        addresses: [],
                        orderCodes: [],
                        createdAt: service.createdAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }

                const clientData = clientsToMigrate.get(clientKey);

                // Adicionar orderCode
                if (service.orderCode && !clientData.orderCodes.includes(service.orderCode)) {
                    clientData.orderCodes.push(service.orderCode);
                }

                // Adicionar endereço se for SEDEX
                if (service.deliveryMethod === 'sedex' && service.deliveryAddress && service.deliveryAddress.cep) {
                    const addressKey = `${service.deliveryAddress.cep}-${service.deliveryAddress.numero}`;
                    const existingAddr = clientData.addresses.find(a => `${a.cep}-${a.numero}` === addressKey);
                    if (!existingAddr) {
                        clientData.addresses.push({
                            ...service.deliveryAddress,
                            usedInOrder: service.orderCode,
                            addedAt: service.createdAt || new Date().toISOString()
                        });
                    }
                }

                // Atualizar dados vazios
                if (!clientData.cpf && service.clientCPF) clientData.cpf = service.clientCPF;
                if (!clientData.email && service.clientEmail) clientData.email = service.clientEmail.toLowerCase();
                if (!clientData.phone && service.clientPhone) clientData.phone = service.clientPhone;
            }
        });

        let migratedCount = 0;
        let updatedCount = 0;

        for (const [key, clientData] of clientsToMigrate) {
            let existingClient = null;
            const cpfClean = clientData.cpf ? clientData.cpf.replace(/\D/g, '') : '';

            // Buscar cliente existente
            if (cpfClean) {
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

            const docToSave = {
                name: clientData.name,
                cpf: cpfClean,
                email: clientData.email,
                phone: clientData.phone,
                addresses: clientData.addresses,
                orderCodes: clientData.orderCodes,
                totalOrders: clientData.orderCodes.length,
                updatedAt: new Date().toISOString()
            };

            if (clientData.addresses.length > 0) {
                docToSave.address = clientData.addresses[clientData.addresses.length - 1];
            }

            if (existingClient && !existingClient.empty) {
                // Atualizar cliente existente mesclando dados
                const existingData = existingClient.docs[0].data();
                const existingOrderCodes = existingData.orderCodes || [];
                const existingAddresses = existingData.addresses || [];

                // Mesclar orderCodes
                const mergedOrderCodes = [...new Set([...existingOrderCodes, ...clientData.orderCodes])];

                // Mesclar addresses
                clientData.addresses.forEach(newAddr => {
                    const addrKey = `${newAddr.cep}-${newAddr.numero}`;
                    if (!existingAddresses.find(a => `${a.cep}-${a.numero}` === addrKey)) {
                        existingAddresses.push(newAddr);
                    }
                });

                await existingClient.docs[0].ref.update({
                    orderCodes: mergedOrderCodes,
                    addresses: existingAddresses,
                    totalOrders: mergedOrderCodes.length,
                    updatedAt: new Date().toISOString()
                });
                updatedCount++;
            } else {
                // Criar novo cliente
                docToSave.createdAt = clientData.createdAt;
                await state.db.collection('clients').add(docToSave);
                migratedCount++;
            }
        }
        
        localStorage.setItem(migrationKey, 'true');
        console.log(`✅ Migração concluída: ${migratedCount} novos, ${updatedCount} atualizados`);

        if (migratedCount > 0 || updatedCount > 0) {
            await loadClientsFromFirestore();
            showToast(`✅ Clientes sincronizados: ${migratedCount} novos, ${updatedCount} atualizados`, 'success');
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

    // Preencher último endereço salvo se existir
    const lastAddress = client.addresses?.length > 0
        ? client.addresses[client.addresses.length - 1]
        : client.address;

    if (lastAddress && lastAddress.cep) {
        // Preencher campos de endereço
        const fullNameField = document.getElementById('fullName');
        const cepField = document.getElementById('cep');
        const estadoField = document.getElementById('estado');
        const cidadeField = document.getElementById('cidade');
        const bairroField = document.getElementById('bairro');
        const ruaField = document.getElementById('rua');
        const numeroField = document.getElementById('numero');
        const complementoField = document.getElementById('complemento');

        if (fullNameField) fullNameField.value = lastAddress.fullName || client.name || '';
        if (cepField) cepField.value = lastAddress.cep || '';
        if (estadoField) estadoField.value = lastAddress.estado || '';
        if (cidadeField) cidadeField.value = lastAddress.cidade || '';
        if (bairroField) bairroField.value = lastAddress.bairro || '';
        if (ruaField) ruaField.value = lastAddress.rua || '';
        if (numeroField) numeroField.value = lastAddress.numero || '';
        if (complementoField) complementoField.value = lastAddress.complemento || '';

        showToast('✅ Dados e endereço do cliente preenchidos!', 'success');
    } else {
        showToast('✅ Dados do cliente preenchidos!', 'success');
    }

    document.getElementById('clientSuggestions').style.display = 'none';
}

export async function saveClientToFirestore(clientData) {
    if (!state.db || !clientData.name) return;

    try {
        const cpfClean = clientData.cpf ? clientData.cpf.replace(/\D/g, '') : '';
        const emailLower = clientData.email ? clientData.email.toLowerCase().trim() : '';

        // Buscar cliente existente por CPF, email ou nome
        let existingClient = null;
        let existingData = null;

        // 1. Buscar por CPF (mais confiável)
        if (cpfClean) {
            existingClient = await state.db.collection('clients')
                .where('cpf', '==', cpfClean)
                .limit(1)
                .get();
        }

        // 2. Se não encontrou por CPF, buscar por email
        if ((!existingClient || existingClient.empty) && emailLower) {
            existingClient = await state.db.collection('clients')
                .where('email', '==', emailLower)
                .limit(1)
                .get();
        }

        // 3. Se não encontrou, buscar por nome
        if (!existingClient || existingClient.empty) {
            existingClient = await state.db.collection('clients')
                .where('name', '==', clientData.name)
                .limit(1)
                .get();
        }

        // Preparar dados existentes
        if (existingClient && !existingClient.empty) {
            existingData = existingClient.docs[0].data();
        }

        // Preparar array de orderCodes
        let orderCodes = existingData?.orderCodes || [];
        if (clientData.orderCode && !orderCodes.includes(clientData.orderCode)) {
            orderCodes.push(clientData.orderCode);
        }

        // Preparar array de endereços (múltiplos endereços)
        let addresses = existingData?.addresses || [];
        if (clientData.address && clientData.address.cep) {
            // Verificar se endereço já existe (por CEP + número)
            const addressKey = `${clientData.address.cep}-${clientData.address.numero}`;
            const existingAddressIndex = addresses.findIndex(addr =>
                `${addr.cep}-${addr.numero}` === addressKey
            );

            const addressWithMeta = {
                ...clientData.address,
                addedAt: new Date().toISOString(),
                usedInOrder: clientData.orderCode || null
            };

            if (existingAddressIndex >= 0) {
                // Atualizar endereço existente
                addresses[existingAddressIndex] = {
                    ...addresses[existingAddressIndex],
                    ...addressWithMeta,
                    updatedAt: new Date().toISOString()
                };
            } else {
                // Adicionar novo endereço
                addresses.push(addressWithMeta);
            }
        }

        // Montar documento do cliente preservando dados existentes
        const clientDoc = {
            name: clientData.name,
            cpf: cpfClean,
            email: emailLower,
            phone: clientData.phone || existingData?.phone || '',
            addresses: addresses,
            orderCodes: orderCodes,
            // Preservar dados do Google se existirem
            googleUid: existingData?.googleUid || null,
            googleEmail: existingData?.googleEmail || null,
            googlePhotoURL: existingData?.googlePhotoURL || null,
            // Preservar histórico de acesso
            lastOrderTrackingAccess: existingData?.lastOrderTrackingAccess || null,
            // Estatísticas
            totalOrders: orderCodes.length,
            updatedAt: new Date().toISOString()
        };

        // Manter endereço principal para compatibilidade
        if (addresses.length > 0) {
            clientDoc.address = addresses[addresses.length - 1];
        }

        if (existingClient && !existingClient.empty) {
            const docId = existingClient.docs[0].id;
            await state.db.collection('clients').doc(docId).update(clientDoc);
            console.log('✅ Cliente atualizado:', clientData.name, '| Pedidos:', orderCodes.length);
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
export async function openAddModal() {
    // Abre o modal de seleção de tipo primeiro
    document.getElementById('serviceTypeModal').classList.add('active');
}

// Fechar modal de seleção de tipo
export function closeServiceTypeModal() {
    document.getElementById('serviceTypeModal').classList.remove('active');
}

// Selecionar tipo de serviço e abrir modal principal
export async function selectServiceType(type) {
    closeServiceTypeModal();

    state.currentServiceType = type; // Armazena o tipo selecionado
    state.editingServiceId = null;
    state.selectedFiles = [];
    state.selectedImages = [];

    document.getElementById('modalTitle') && (document.getElementById('modalTitle').textContent = type === 'modelagem' ? 'Novo Serviço de Modelagem' : 'Novo Serviço de Impressão');
    document.getElementById('saveButtonText') && (document.getElementById('saveButtonText').textContent = 'Salvar Serviço');
    document.getElementById('serviceForm')?.reset();

    // Configurar seção de código do pedido para NOVO serviço
    const orderCodeInput = document.getElementById('orderCodeInput');
    const orderCodeNewInfo = document.getElementById('orderCodeNewInfo');
    const orderCodeEditInfo = document.getElementById('orderCodeEditInfo');
    const btnRegenerate = document.getElementById('btnRegenerateCode');

    if (orderCodeInput) {
        // Gerar código aleatório para preview
        orderCodeInput.value = generateOrderCode();
        orderCodeInput.removeAttribute('readonly');
    }
    if (orderCodeNewInfo) orderCodeNewInfo.style.display = 'inline';
    if (orderCodeEditInfo) orderCodeEditInfo.style.display = 'none';
    if (btnRegenerate) btnRegenerate.style.display = 'flex';

    setupDateFields();
    ['filesInfo', 'imagePreview'].forEach(id => {
        const el = document.getElementById(id);
        el && (el.style.display = 'none');
    });

    const previewContainer = document.getElementById('imagePreviewContainer');
    if (previewContainer) previewContainer.innerHTML = '';

    const filesPreviewContainer = document.getElementById('filesPreviewContainer');
    if (filesPreviewContainer) filesPreviewContainer.innerHTML = '';

    // Definir valores padrão e sincronizar dropdowns customizados
    const prioritySelect = document.getElementById('servicePriority');
    const statusSelect = document.getElementById('serviceStatus');

    if (prioritySelect) {
        prioritySelect.value = 'media';
        prioritySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (statusSelect) {
        statusSelect.value = type === 'modelagem' ? 'modelando' : 'pendente';
        statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    document.getElementById('dateUndefined') && (document.getElementById('dateUndefined').checked = false);

    const notificationSection = document.getElementById('notificationSection');
    if (notificationSection) notificationSection.style.display = 'none';

    document.getElementById('clientSuggestions').style.display = 'none';

    hideAllDeliveryFields();

    // Adaptar formulário baseado no tipo
    adaptFormForServiceType(type);

    if (type === 'impressao') {
        // INTEGRAÇÃO COM ESTOQUE: Carregar filamentos disponíveis
        await loadAvailableFilaments();

        // Atualizar dropdown de materiais com base no estoque
        updateMaterialDropdown();

        // Configurar listener para atualizar cores quando material mudar
        const materialSelect = document.getElementById('serviceMaterial');
        if (materialSelect) {
            materialSelect.removeEventListener('change', handleMaterialChange);
            materialSelect.addEventListener('change', handleMaterialChange);
        }

        // Limpar dropdown de cores ao abrir
        const colorSelect = document.getElementById('serviceColor');
        if (colorSelect) {
            colorSelect.innerHTML = '<option value="">Primeiro selecione o material</option>';
        }
    }

    // Exibir e habilitar campo de telefone ao criar novo serviço
    const phoneInput = document.getElementById('clientPhone');
    if (phoneInput) {
        const phoneFormGroup = phoneInput.closest('.form-group');
        if (phoneFormGroup) {
            phoneFormGroup.style.display = '';
        }
        phoneInput.disabled = false;
        phoneInput.style.cursor = '';
        phoneInput.style.opacity = '';
    }

    document.getElementById('serviceModal')?.classList.add('active');
}

// Adaptar formulário baseado no tipo de serviço
function adaptFormForServiceType(type) {
    const materialGroup = document.getElementById('serviceMaterial')?.closest('.form-group');
    const colorGroup = document.getElementById('serviceColor')?.closest('.form-group');
    const weightGroup = document.getElementById('serviceWeight')?.closest('.form-group');
    const deliveryGroup = document.getElementById('deliveryMethod')?.closest('.form-group');

    if (type === 'modelagem') {
        // Ocultar campos específicos de impressão
        if (materialGroup) materialGroup.style.display = 'none';
        if (colorGroup) colorGroup.style.display = 'none';
        if (weightGroup) weightGroup.style.display = 'none';
        if (deliveryGroup) deliveryGroup.style.display = 'none';

        // Remover required dos campos ocultos
        const materialInput = document.getElementById('serviceMaterial');
        const deliveryInput = document.getElementById('deliveryMethod');
        if (materialInput) materialInput.removeAttribute('required');
        if (deliveryInput) deliveryInput.removeAttribute('required');
    } else {
        // Mostrar todos os campos para impressão
        if (materialGroup) materialGroup.style.display = '';
        if (colorGroup) colorGroup.style.display = '';
        if (weightGroup) weightGroup.style.display = '';
        if (deliveryGroup) deliveryGroup.style.display = '';

        // Adicionar required de volta
        const materialInput = document.getElementById('serviceMaterial');
        const deliveryInput = document.getElementById('deliveryMethod');
        if (materialInput) materialInput.setAttribute('required', 'required');
        if (deliveryInput) deliveryInput.setAttribute('required', 'required');
    }
}

function handleMaterialChange(event) {
    const selectedMaterial = event.target.value;
    updateColorDropdown(selectedMaterial);
}

export async function openEditModal(serviceId) {
    const service = state.services.find(s => s.id === serviceId);
    if (!service) return;

    state.editingServiceId = serviceId;
    state.selectedFiles = [];
    state.selectedImages = [];

    // INTEGRAÇÃO COM ESTOQUE: Carregar filamentos disponíveis
    await loadAvailableFilaments();

    // Atualizar dropdown de materiais com base no estoque
    updateMaterialDropdown();

    document.getElementById('modalTitle') && (document.getElementById('modalTitle').textContent = 'Editar Serviço');
    document.getElementById('saveButtonText') && (document.getElementById('saveButtonText').textContent = 'Atualizar Serviço');

    // Configurar seção de código do pedido para EDIÇÃO
    const orderCodeInput = document.getElementById('orderCodeInput');
    const orderCodeNewInfo = document.getElementById('orderCodeNewInfo');
    const orderCodeEditInfo = document.getElementById('orderCodeEditInfo');
    const btnRegenerate = document.getElementById('btnRegenerateCode');

    if (orderCodeInput) {
        orderCodeInput.value = service.orderCode || '';
    }
    if (orderCodeNewInfo) orderCodeNewInfo.style.display = 'none';
    if (orderCodeEditInfo) orderCodeEditInfo.style.display = 'inline';
    if (btnRegenerate) btnRegenerate.style.display = 'flex';

    // Preencher campos de texto/número (exceto dropdowns customizados)
    Object.entries({
        serviceName: service.name,
        clientName: service.client,
        clientCPF: service.clientCPF || '',
        clientEmail: service.clientEmail,
        clientPhone: service.clientPhone,
        serviceDescription: service.description,
        startDate: service.startDate,
        dueDate: service.dueDate,
        serviceValue: service.value,
        serviceWeight: service.weight,
        serviceObservations: service.observations,
        serviceStatus: service.status || 'pendente'
    }).forEach(([id, value]) => {
        const el = document.getElementById(id);
        el && (el.value = value || '');
    });

    // Ocultar completamente o campo de telefone ao editar
    const phoneInput = document.getElementById('clientPhone');
    if (phoneInput) {
        const phoneFormGroup = phoneInput.closest('.form-group');
        if (phoneFormGroup) {
            phoneFormGroup.style.display = 'none';
        }
    }

    // =====================================================
    // SINCRONIZAÇÃO DE DROPDOWNS CUSTOMIZADOS
    // O CustomSelect usa MutationObserver que é assíncrono.
    // Precisamos usar setTimeout para aguardar o processamento
    // das novas opções antes de definir os valores.
    // =====================================================

    // 1. Material (dropdown dinâmico - opções vêm do estoque)
    if (service.material) {
        // updateMaterialDropdown() já foi chamado acima
        // Aguardar MutationObserver processar antes de definir valor
        const materialSelect = document.getElementById('serviceMaterial');
        if (materialSelect) {
            setTimeout(() => {
                materialSelect.value = service.material;
                materialSelect.dispatchEvent(new Event('change', { bubbles: true }));

                // 2. Cor (dropdown dinâmico - depende do material)
                // IMPORTANTE: NÃO definir cor single se o serviço for multicor!
                // Para multicor, service.color é "Vermelho + Azul" (valor concatenado)
                // que não existe como opção no dropdown single.
                // O loadMultiColorData (chamado abaixo) cuidará das cores.
                if (!service.isMultiColor) {
                    updateColorDropdown(service.material);

                    const colorSelect = document.getElementById('serviceColor');
                    if (colorSelect && service.color) {
                        setTimeout(() => {
                            colorSelect.value = service.color;
                            colorSelect.dispatchEvent(new Event('change', { bubbles: true }));
                        }, 0);
                    }
                }
            }, 0);
        }
    }

    // 3. Prioridade (dropdown estático - mas precisa sincronizar CustomSelect)
    const prioritySelect = document.getElementById('servicePriority');
    if (prioritySelect) {
        prioritySelect.value = service.priority || 'media';
        prioritySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 4. Método de Entrega (dropdown estático - mas precisa sincronizar CustomSelect)
    const deliverySelect = document.getElementById('deliveryMethod');
    if (deliverySelect && service.deliveryMethod) {
        deliverySelect.value = service.deliveryMethod;
        deliverySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
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

    const fileInDrive = document.getElementById('fileInDrive');
    if (fileInDrive) {
        fileInDrive.checked = service.fileInDrive === true;
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

    // INTEGRAÇÃO COM ESTOQUE: Configurar listener para material
    // (Não chamar updateColorDropdown aqui - já é tratado na sincronização acima)
    const materialSelectListener = document.getElementById('serviceMaterial');
    if (materialSelectListener) {
        materialSelectListener.removeEventListener('change', handleMaterialChange);
        materialSelectListener.addEventListener('change', handleMaterialChange);
    }

    // MULTI-COR: Carregar dados se o serviço for multi-cor
    // Usar delay maior para garantir que:
    // 1. Material dropdown está populado e valor definido (setTimeout 0 acima)
    // 2. MutationObserver do CustomSelect processou
    // 3. DOM está completamente renderizado
    if (service.isMultiColor && service.materials && service.materials.length > 0) {
        console.log('🎨 openEditModal - Serviço multicor detectado, agendando loadMultiColorData');
        setTimeout(() => {
            loadMultiColorData(service);
        }, 250); // Delay aumentado para garantir sincronização
    }

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

    // MULTI-COR: Resetar estado ao fechar modal
    resetMultiColorState();
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
            const message = `Olá, ${service.client}!\n\nSeu pedido foi postado nos Correios!\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}\n» Rastreio: ${trackingCode}\n\nRastreie em:\nhttps://rastreamento.correios.com.br/app/index.php\n\nPrazo estimado: 3-7 dias úteis\n\nAcompanhe em:\nhttps://imaginatech.com.br/acompanhar-pedido/?codigo=${service.orderCode}`;
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
        const message = encodeURIComponent(`Olá, ${pickup.name}!\n\nSeu pedido está pronto para retirada!\n\n» Pedido: ${service.name}\n» Código: ${service.orderCode}\n\nAcompanhe em:\nhttps://imaginatech.com.br/acompanhar-pedido/?codigo=${service.orderCode}\n\nPodemos confirmar o horário de retirada?`);
        
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
            const deliverySelect = document.getElementById('deliveryMethod');
            deliverySelect.value = 'sedex';
            deliverySelect.dispatchEvent(new Event('change', { bubbles: true }));
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

    // Alterar label do prazo conforme método de entrega
    const dueDateLabelText = document.getElementById('dueDateLabelText');
    if (dueDateLabelText) {
        dueDateLabelText.textContent = method === 'sedex' ? 'Prazo de Postagem' : 'Prazo de Entrega';
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

// Formata CPF (11 dígitos) ou CNPJ (14 dígitos) automaticamente
export function formatCPFCNPJ(e) {
    let value = e.target.value.replace(/\D/g, '').slice(0, 14);

    if (value.length <= 11) {
        // Formato CPF: XXX.XXX.XXX-XX
        if (value.length > 9) value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6, 9)}-${value.slice(9)}`;
        else if (value.length > 6) value = `${value.slice(0, 3)}.${value.slice(3, 6)}.${value.slice(6)}`;
        else if (value.length > 3) value = `${value.slice(0, 3)}.${value.slice(3)}`;
    } else {
        // Formato CNPJ: XX.XXX.XXX/XXXX-XX
        if (value.length > 12) value = `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8, 12)}-${value.slice(12)}`;
        else if (value.length > 8) value = `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5, 8)}/${value.slice(8)}`;
        else if (value.length > 5) value = `${value.slice(0, 2)}.${value.slice(2, 5)}.${value.slice(5)}`;
        else if (value.length > 2) value = `${value.slice(0, 2)}.${value.slice(2)}`;
    }

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

/**
 * Copia dados do cliente para os campos de retirada
 * Preenche: Nome de quem vai retirar e WhatsApp de contato
 */
export function copyClientDataToPickup() {
    const clientName = document.getElementById('clientName')?.value.trim();
    const clientPhone = document.getElementById('clientPhone')?.value.trim();

    if (!clientName && !clientPhone) {
        return showToast('Preencha o nome ou telefone do cliente primeiro', 'warning');
    }

    if (clientName) document.getElementById('pickupName').value = clientName;
    if (clientPhone) document.getElementById('pickupWhatsapp').value = clientPhone;

    showToast('✅ Dados do cliente copiados para retirada!', 'success');
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
// UTILITIES (movidas para utils.js)
// ===========================

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

    const popup = window.open(whatsappUrl, '_blank');

    // Verifica se o popup foi bloqueado
    setTimeout(() => {
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
            // Popup bloqueado - mostrar modal com link clicável
            showToast('⚠️ Popup bloqueado. Clique no botão abaixo para abrir WhatsApp', 'warning');

            // Remover modal anterior se existir
            const existingModal = document.querySelector('.whatsapp-fallback-modal');
            if (existingModal) existingModal.remove();

            // Criar modal com link clicável como fallback
            const modal = document.createElement('div');
            modal.className = 'whatsapp-fallback-modal modal active';
            modal.innerHTML = `
                <div class="modal-content modal-small">
                    <div class="modal-header">
                        <h2><i class="fab fa-whatsapp"></i> Abrir WhatsApp</h2>
                        <button class="modal-close" onclick="this.closest('.whatsapp-fallback-modal').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <p>O popup foi bloqueado pelo navegador. Clique no botão abaixo para abrir o WhatsApp:</p>
                    </div>
                    <div class="modal-footer">
                        <a href="${whatsappUrl}" target="_blank" class="btn-primary" onclick="setTimeout(() => this.closest('.whatsapp-fallback-modal').remove(), 500)">
                            <i class="fab fa-whatsapp"></i> Abrir WhatsApp
                        </a>
                        <button class="btn-secondary" onclick="this.closest('.whatsapp-fallback-modal').remove()">
                            <i class="fas fa-times"></i> Fechar
                        </button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
    }, 500); // Aguarda 500ms para verificar se o popup foi bloqueado
};

export const contactClient = (phone, serviceName, orderCode, clientName) => {
    const greeting = clientName ? `Olá, ${clientName}!` : 'Olá!';
    const message = `${greeting}\n\nSobre seu pedido:\n\n» Serviço: ${serviceName}\n» Código: ${orderCode}\n\nAcompanhe em:\nhttps://imaginatech.com.br/acompanhar-pedido/?codigo=${orderCode}\n\nPode falar agora?`;
    sendWhatsAppMessage(phone, message);
};

export async function sendEmailNotification(service) {
    if (!service.clientEmail || service.clientEmail.trim().length === 0) return;

    try {
        await emailjs.send(EMAILJS_CONFIG.serviceId, EMAILJS_CONFIG.templateId, {
            to_email: service.clientEmail,
            client_name: service.client || 'Cliente',
            order_code: service.orderCode || 'N/A',
            reply_to: window.ENV_CONFIG?.ADMIN_EMAIL || '3d3printers@gmail.com'
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
window.closeServiceTypeModal = closeServiceTypeModal;
window.selectServiceType = selectServiceType;
window.openEditModal = openEditModal;
window.closeModal = closeModal;
window.saveService = saveService;
window.deleteServiceGlobal = deleteService;
window.regenerateOrderCode = () => {
    const orderCodeInput = document.getElementById('orderCodeInput');
    if (orderCodeInput) {
        orderCodeInput.value = generateOrderCode();
        // Animação de feedback
        orderCodeInput.style.animation = 'none';
        orderCodeInput.offsetHeight; // Trigger reflow
        orderCodeInput.style.animation = 'pulse 0.3s ease';
    }
};
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
window.formatCPFCNPJ = formatCPFCNPJ;
window.copyClientDataToDelivery = copyClientDataToDelivery;
window.copyClientDataToPickup = copyClientDataToPickup;
window.removeFileFromService = async (serviceId, fileIndex, fileUrl) => {
    const { removeFileFromService } = await import('./services.js');
    await removeFileFromService(serviceId, fileIndex, fileUrl);
};

// Portfolio Up Functions
window.openUpModal = openUpModal;
window.closeUpModal = closeUpModal;
window.showUpForm = showUpForm;
window.toggleCategoryField = toggleCategoryField;
window.handleUpPhotoSelect = handleUpPhotoSelect;
window.removeUpPhoto = removeUpPhoto;
window.handleUpLogoSelect = handleUpLogoSelect;
window.removeUpLogo = removeUpLogo;
window.saveToPortfolio = saveToPortfolio;
// Extra Photos (Galeria) - removeExtraPhoto ainda usado nos slots individuais
window.removeExtraPhoto = removeExtraPhoto;

// ===========================
// BYPASS DE FOTO OBRIGATÓRIA
// ===========================
// BYPASS_PASSWORD importado de config.js

export function showBypassPasswordModal() {
    const modal = document.getElementById('bypassPasswordModal');
    const input = document.getElementById('bypassPasswordInput');

    if (modal) {
        modal.classList.add('active');
        if (input) {
            input.value = '';
            setTimeout(() => input.focus(), 100);
        }
    }
}

export function closeBypassModal() {
    const modal = document.getElementById('bypassPasswordModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

export async function confirmBypassPassword() {
    const input = document.getElementById('bypassPasswordInput');
    const password = input?.value || '';

    if (password === BYPASS_PASSWORD) {
        closeBypassModal();
        // Importar e chamar função de bypass
        const { proceedWithStatusChangeWithoutPhoto } = await import('./services.js');
        await proceedWithStatusChangeWithoutPhoto();
    } else {
        showToast('❌ Senha incorreta', 'error');
        if (input) {
            input.value = '';
            input.focus();
        }
    }
}

window.showBypassPasswordModal = showBypassPasswordModal;
window.closeBypassModal = closeBypassModal;
window.confirmBypassPassword = confirmBypassPassword;

// ===========================
// CLIENTS MODAL
// ===========================
export async function openClientsModal() {
    const modal = document.getElementById('clientsModal');
    if (!modal) return;

    modal.classList.add('active');
    await loadClientsForModal();
}

export function closeClientsModal() {
    const modal = document.getElementById('clientsModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

async function loadClientsForModal() {
    if (!state.db) return;

    const container = document.getElementById('clientsListContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="loading-clients">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Carregando clientes...</span>
        </div>
    `;

    try {
        // Carregar de clients
        const clientsSnapshot = await state.db.collection('clients').get();
        const clientsMap = new Map();

        clientsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const email = (data.email || data.googleEmail || '').toLowerCase();
            if (email) {
                clientsMap.set(email, { id: doc.id, ...data, source: 'clients' });
            }
        });

        // Carregar de tracking_access (acessos de clientes não-admin)
        const trackingSnapshot = await state.db.collection('tracking_access')
            .orderBy('accessedAt', 'desc')
            .limit(100)
            .get();

        // Agrupar tracking por email e pegar o mais recente
        trackingSnapshot.docs.forEach(doc => {
            const data = doc.data();
            const email = (data.googleEmail || '').toLowerCase();

            if (email && !clientsMap.has(email)) {
                // Cliente que só existe em tracking_access
                clientsMap.set(email, {
                    id: doc.id,
                    name: data.googleName || email.split('@')[0],
                    email: email,
                    googleEmail: email,
                    googlePhotoURL: data.googlePhotoURL,
                    googleUid: data.googleUid,
                    phone: data.orderClientPhone || '',
                    lastOrderTrackingAccess: data.accessedAt,
                    orderCodes: [data.orderCode],
                    source: 'tracking_access'
                });
            } else if (email && clientsMap.has(email)) {
                // Atualizar último acesso se mais recente
                const existing = clientsMap.get(email);
                if (!existing.lastOrderTrackingAccess ||
                    new Date(data.accessedAt) > new Date(existing.lastOrderTrackingAccess)) {
                    existing.lastOrderTrackingAccess = data.accessedAt;
                }
                // Atualizar foto se não tiver
                if (!existing.googlePhotoURL && data.googlePhotoURL) {
                    existing.googlePhotoURL = data.googlePhotoURL;
                }
                // Adicionar orderCode à lista se não existir
                if (data.orderCode) {
                    if (!existing.orderCodes) {
                        existing.orderCodes = [];
                    }
                    if (!existing.orderCodes.includes(data.orderCode)) {
                        existing.orderCodes.push(data.orderCode);
                    }
                }
            }
        });

        const clients = Array.from(clientsMap.values());

        // Sort by lastOrderTrackingAccess (most recent first)
        clients.sort((a, b) => {
            const dateA = a.lastOrderTrackingAccess ? new Date(a.lastOrderTrackingAccess) : new Date(0);
            const dateB = b.lastOrderTrackingAccess ? new Date(b.lastOrderTrackingAccess) : new Date(0);
            return dateB - dateA;
        });

        if (clients.length === 0) {
            container.innerHTML = `
                <div class="no-clients-message">
                    <i class="fas fa-users-slash"></i>
                    <p>Nenhum cliente cadastrado ainda</p>
                </div>
            `;
            return;
        }

        container.innerHTML = clients.map(client => renderClientItem(client)).join('');

    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        container.innerHTML = `
            <div class="no-clients-message">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erro ao carregar clientes</p>
            </div>
        `;
    }
}

function renderClientItem(client) {
    const photoUrl = client.googlePhotoURL ||
                     `https://ui-avatars.com/api/?name=${encodeURIComponent(client.name || 'Cliente')}&background=00D4FF&color=fff`;

    const lastAccess = client.lastOrderTrackingAccess;
    let lastAccessText = 'Nunca acessou';
    let lastAccessClass = 'never';

    if (lastAccess) {
        const date = new Date(lastAccess);
        // Validar se a data é válida
        if (!isNaN(date.getTime())) {
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) {
                lastAccessText = 'Agora mesmo';
            } else if (diffMins < 60) {
                lastAccessText = `Há ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
            } else if (diffHours < 24) {
                lastAccessText = `Há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
            } else if (diffDays < 7) {
                lastAccessText = `Há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
            } else {
                lastAccessText = date.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            lastAccessClass = '';
        }
    }

    // Format CPF/CNPJ for display
    let cpfDisplay = client.cpf || '-';
    if (client.cpf) {
        const digits = client.cpf.replace(/\D/g, '');
        if (digits.length === 11) {
            // CPF: XXX.XXX.XXX-XX
            cpfDisplay = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
        } else if (digits.length === 14) {
            // CNPJ: XX.XXX.XXX/XXXX-XX
            cpfDisplay = `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;
        }
    }

    // Order codes
    const orderCodes = client.orderCodes || [];
    const orderCodesHtml = orderCodes.length > 0
        ? `<div class="client-orders-section">
            <div class="client-orders-title">
                <i class="fas fa-clipboard-list"></i>
                Pedidos (${orderCodes.length})
            </div>
            <div class="client-order-codes">
                ${orderCodes.map(code => `<span class="client-order-code clickable" onclick="event.stopPropagation(); navigateToServiceByCode('${escapeHtml(code)}')" title="Clique para ir ao pedido">#${code}</span>`).join('')}
            </div>
           </div>`
        : '';

    // Addresses
    const addresses = client.addresses || [];
    const addressesHtml = addresses.length > 0
        ? `<div class="client-addresses-section">
            <div class="client-orders-title">
                <i class="fas fa-map-marker-alt"></i>
                Endereços (${addresses.length})
            </div>
            <div class="client-addresses-list">
                ${addresses.map((addr, idx) => `
                    <div class="client-address-item">
                        <strong>${addr.fullName || client.name}</strong><br>
                        ${addr.rua}, ${addr.numero}${addr.complemento ? ' - ' + addr.complemento : ''}<br>
                        ${addr.bairro} - ${addr.cidade}/${addr.estado}<br>
                        CEP: ${addr.cep}
                        ${addr.usedInOrder ? `<br><small style="color: var(--neon-blue);">Usado no pedido #${addr.usedInOrder}</small>` : ''}
                    </div>
                `).join('')}
            </div>
           </div>`
        : '';

    // Email to search history
    const searchEmail = client.googleEmail || client.email || '';

    return `
        <div class="client-item" id="client-${client.id}">
            <div class="client-item-header" onclick="toggleClientDetails('${client.id}')">
                <img src="${photoUrl}" alt="${escapeHtml(client.name)}" class="client-photo">
                <div class="client-info">
                    <div class="client-name">${escapeHtml(client.name || 'Cliente sem nome')}</div>
                    <div class="client-last-access ${lastAccessClass}">
                        <i class="fas fa-circle"></i>
                        ${lastAccessText}
                    </div>
                </div>
                <i class="fas fa-chevron-down client-expand-icon"></i>
            </div>
            <div class="client-details">
                <div class="client-detail-row">
                    <span class="client-detail-label"><i class="fas fa-id-card"></i> CPF/CNPJ</span>
                    <span class="client-detail-value">${cpfDisplay}</span>
                </div>
                <div class="client-detail-row">
                    <span class="client-detail-label"><i class="fas fa-envelope"></i> Email</span>
                    <span class="client-detail-value">${client.email || '-'}</span>
                </div>
                <div class="client-detail-row">
                    <span class="client-detail-label"><i class="fas fa-phone"></i> Telefone</span>
                    <span class="client-detail-value">
                        ${client.phone ? `<a href="https://wa.me/55${client.phone.replace(/\D/g, '')}" target="_blank">${client.phone}</a>` : '-'}
                    </span>
                </div>
                ${client.googleEmail ? `
                <div class="client-detail-row">
                    <span class="client-detail-label"><i class="fab fa-google"></i> Google</span>
                    <span class="client-detail-value">${client.googleEmail}</span>
                </div>
                ` : ''}
                ${client.lastOrderTrackingAccess ? `
                <div class="client-detail-row">
                    <span class="client-detail-label"><i class="fas fa-clock"></i> Último Acesso</span>
                    <span class="client-detail-value">${new Date(client.lastOrderTrackingAccess).toLocaleString('pt-BR')}</span>
                </div>
                ` : ''}
                ${orderCodesHtml}
                ${addressesHtml}
                ${searchEmail ? `
                <div class="client-history-section">
                    <button class="btn-view-history" onclick="event.stopPropagation(); viewClientHistory('${escapeHtml(searchEmail)}', '${escapeHtml(client.name || '')}')">
                        <i class="fas fa-history"></i>
                        Ver Histórico de Acessos
                    </button>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

export function toggleClientDetails(clientId) {
    const clientItem = document.getElementById(`client-${clientId}`);
    if (clientItem) {
        clientItem.classList.toggle('expanded');
    }
}

// Função para visualizar histórico de acessos do cliente
export async function viewClientHistory(email, clientName) {
    if (!state.db || !email) return;

    try {
        showToast('Carregando histórico...', 'info');

        // Buscar todos os acessos do cliente na collection tracking_access
        const snapshot = await state.db.collection('tracking_access')
            .where('googleEmail', '==', email.toLowerCase())
            .orderBy('accessedAt', 'desc')
            .limit(50)
            .get();

        const accesses = snapshot.docs.map(doc => doc.data());

        // Criar modal de histórico
        let historyModal = document.getElementById('clientHistoryModal');
        if (!historyModal) {
            historyModal = document.createElement('div');
            historyModal.id = 'clientHistoryModal';
            historyModal.className = 'modal';
            historyModal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h2><i class="fas fa-history"></i> <span id="historyClientName"></span></h2>
                        <button class="modal-close" onclick="closeClientHistoryModal()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body" id="clientHistoryContent" style="max-height: 60vh; overflow-y: auto;">
                    </div>
                </div>
            `;
            document.body.appendChild(historyModal);
        }

        document.getElementById('historyClientName').textContent = `Histórico de ${clientName}`;

        const contentDiv = document.getElementById('clientHistoryContent');

        if (accesses.length === 0) {
            contentDiv.innerHTML = `
                <div class="no-history-message" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                    <p>Nenhum acesso registrado</p>
                </div>
            `;
        } else {
            // Agrupar por pedido
            const byOrder = {};
            accesses.forEach(access => {
                const code = access.orderCode || 'sem-codigo';
                if (!byOrder[code]) {
                    byOrder[code] = [];
                }
                byOrder[code].push(access);
            });

            let html = `
                <div class="history-summary" style="margin-bottom: 1rem; padding: 1rem; background: var(--glass-bg); border-radius: 8px;">
                    <strong>Total de acessos:</strong> ${accesses.length}<br>
                    <strong>Pedidos consultados:</strong> ${Object.keys(byOrder).length}
                </div>
            `;

            // Listar todos os acessos cronologicamente
            html += `<div class="history-list">`;
            accesses.forEach(access => {
                const date = new Date(access.accessedAt);
                const formattedDate = date.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });
                const formattedTime = date.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit'
                });

                const orderCodeEscaped = escapeHtml(access.orderCode || '');
                html += `
                    <div class="history-item" style="
                        padding: 0.75rem;
                        border-bottom: 1px solid var(--glass-border);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    ">
                        <div>
                            <span class="history-order-code clickable" style="
                                background: var(--neon-blue);
                                color: white;
                                padding: 0.2rem 0.5rem;
                                border-radius: 4px;
                                font-size: 0.85rem;
                                font-weight: bold;
                                cursor: pointer;
                                transition: all 0.2s ease;
                            " onclick="navigateToServiceByCode('${orderCodeEscaped}')" title="Clique para ir ao pedido">#${access.orderCode || 'N/A'}</span>
                            <span style="margin-left: 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">
                                ${access.device || 'Desktop'}
                            </span>
                        </div>
                        <div style="text-align: right; font-size: 0.85rem;">
                            <div style="color: var(--text-primary);">${formattedDate}</div>
                            <div style="color: var(--text-secondary);">${formattedTime}</div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;

            contentDiv.innerHTML = html;
        }

        historyModal.classList.add('active');

    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        showToast('Erro ao carregar histórico', 'error');
    }
}

export function closeClientHistoryModal() {
    const modal = document.getElementById('clientHistoryModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Função para navegar até um serviço pelo código do pedido
export function navigateToServiceByCode(orderCode) {
    if (!orderCode) return;

    // Fechar todos os modais de clientes
    closeClientHistoryModal();
    closeClientsModal();

    // Buscar o serviço pelo orderCode no state (contém TODOS os serviços)
    const service = state.services.find(s => s.orderCode === orderCode);

    if (!service) {
        showToast(`Pedido #${orderCode} não encontrado`, 'warning');
        return;
    }

    // Determinar qual filtro mostra esse serviço
    const status = service.status;
    let targetFilter;

    if (status === 'entregue') {
        targetFilter = 'entregue';
    } else if (status === 'retirada') {
        targetFilter = 'retirada';
    } else if (['concluido', 'modelagem_concluida'].includes(status)) {
        targetFilter = 'concluido';
    } else if (['producao', 'modelando'].includes(status)) {
        targetFilter = 'producao';
    } else if (status === 'pendente') {
        targetFilter = 'pendente';
    } else {
        targetFilter = 'todos';
    }

    // Mudar o filtro se necessário
    if (state.currentFilter !== targetFilter) {
        // Atualizar o filtro
        state.currentFilter = targetFilter;

        // Atualizar visual dos botões de filtro
        document.querySelectorAll('.stat-card').forEach(card => {
            card.classList.remove('active');
            if (card.dataset.filter === targetFilter) {
                card.classList.add('active');
            }
        });

        // Re-renderizar os serviços
        renderServices();
    }

    // Aguardar a renderização e então navegar
    setTimeout(() => {
        const card = document.querySelector(`[data-service-id="${service.id}"]`);

        if (card) {
            // Scroll suave até o card
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Usar IntersectionObserver para detectar quando o card está visível
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Card está visível, aguardar um pouco para o scroll estabilizar
                        setTimeout(() => {
                            // Adicionar destaque temporário
                            card.classList.add('highlight-card');

                            // Remover destaque após 2 segundos
                            setTimeout(() => {
                                card.classList.remove('highlight-card');
                            }, 2000);
                        }, 300);

                        // Parar de observar
                        observer.disconnect();
                    }
                });
            }, { threshold: 0.5 }); // 50% do card visível

            observer.observe(card);

            // Fallback: se o observer não disparar em 2s, aplicar mesmo assim
            setTimeout(() => {
                observer.disconnect();
                if (!card.classList.contains('highlight-card')) {
                    card.classList.add('highlight-card');
                    setTimeout(() => {
                        card.classList.remove('highlight-card');
                    }, 2000);
                }
            }, 2000);

            showToast(`Pedido #${orderCode} (${getStatusLabel(status)})`, 'success');
        } else {
            showToast(`Pedido #${orderCode} não pôde ser exibido`, 'warning');
        }
    }, 100);
}

window.openClientsModal = openClientsModal;
window.closeClientsModal = closeClientsModal;
window.toggleClientDetails = toggleClientDetails;
window.viewClientHistory = viewClientHistory;
window.closeClientHistoryModal = closeClientHistoryModal;
window.navigateToServiceByCode = navigateToServiceByCode;
