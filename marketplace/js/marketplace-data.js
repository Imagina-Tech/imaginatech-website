/*
==================================================
ARQUIVO: marketplace/js/marketplace-data.js
MODULO: CRUD Firestore para Produtos
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 2.1 - Security Hardened (2026-01-25)
==================================================
*/

// Usar logger do marketplace-core.js (ja carregado)
// window.logger deve estar disponivel

// ========== OVERLAY DE UPLOAD ==========
function showUploadOverlay(text = 'Enviando fotos...') {
    const overlay = document.getElementById('uploadOverlay');
    const textEl = document.getElementById('uploadText');
    const progressBar = document.getElementById('uploadProgressBar');
    const detailEl = document.getElementById('uploadDetail');

    if (overlay) {
        overlay.classList.remove('hidden');
        if (textEl) textEl.textContent = text;
        if (progressBar) progressBar.style.width = '0%';
        if (detailEl) detailEl.textContent = '';
    }
}

function updateUploadProgress(current, total, fileName) {
    const progressBar = document.getElementById('uploadProgressBar');
    const detailEl = document.getElementById('uploadDetail');

    const percent = Math.round((current / total) * 100);

    if (progressBar) {
        progressBar.style.width = `${percent}%`;
    }
    if (detailEl) {
        detailEl.textContent = `${current} de ${total} - ${fileName || ''}`;
    }
}

function hideUploadOverlay() {
    const overlay = document.getElementById('uploadOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// ========== CARREGAR PRODUTOS ==========
async function loadProducts() {
    try {
        // Parar listener anterior se existir
        if (window.productsListener) {
            window.productsListener();
        }

        // Criar listener em tempo real
        window.productsListener = window.db.collection('products')
            .where('userId', '==', window.COMPANY_USER_ID)
            .orderBy('productId', 'asc')
            .onSnapshot(
                (snapshot) => {
                    window.products = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    // DEBUG: Log extensivo dos dados carregados
                    logger.debug('[DEBUG FOTOS] Produtos carregados:', window.products.length);
                    window.products.forEach((p, i) => {
                        logger.debug(`[DEBUG FOTOS] Produto ${i} (${p.name}):`, {
                            id: p.id,
                            mlPhotos: p.mlPhotos,
                            mlPhotosLength: p.mlPhotos?.length,
                            localPhotos: p.localPhotos,
                            localPhotosLength: p.localPhotos?.length,
                            mlPhotosWithIds: p.mlPhotosWithIds?.length,
                            mlbId: p.mlbId
                        });
                    });

                    renderProducts();
                    updateStats();
                    updateConnectionStatus(true);
                },
                (error) => {
                    window.logger?.error('Erro ao carregar produtos:', error);
                    updateConnectionStatus(false);
                    window.showToast('Erro ao carregar produtos', 'error');
                }
            );
    } catch (error) {
        window.logger?.error('Erro ao configurar listener:', error);
        window.showToast('Erro ao conectar com banco de dados', 'error');
    }
}

// ========== OBTER PROXIMO ID (RANGE 1-200) ==========
const MAX_PRODUCT_ID = 200;

function getNextProductId() {
    // Usar window.products (atualizado em tempo real pelo listener)
    const products = window.products || [];

    // Coletar IDs em uso (converter para numero para garantir comparacao correta)
    const usedIds = new Set();
    products.forEach(product => {
        if (product.productId !== undefined && product.productId !== null) {
            // Converter para numero para garantir consistencia
            const id = parseInt(product.productId, 10);
            if (!isNaN(id)) {
                usedIds.add(id);
            }
        }
    });

    // Debug: mostrar IDs em uso
    const sortedIds = Array.from(usedIds).sort((a, b) => a - b);
    window.logger?.log('[ID] IDs em uso:', sortedIds.join(', '));

    // Encontrar o primeiro ID vago (reutiliza IDs de produtos excluidos)
    for (let id = 1; id <= MAX_PRODUCT_ID; id++) {
        if (!usedIds.has(id)) {
            window.logger?.log('[ID] Proximo ID disponivel:', id);
            return id;
        }
    }

    throw new Error('Limite de 200 produtos atingido');
}

// ========== SALVAR PRODUTO ==========
async function saveProduct(productData) {
    try {
        window.showLoading();

        const data = {
            ...productData,
            userId: window.COMPANY_USER_ID,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: window.auth.currentUser.email
        };

        let productIdForSync = null;

        if (window.editingProductId) {
            await window.db.collection('products')
                .doc(window.editingProductId)
                .update(data);
            window.showToast('Produto atualizado com sucesso!', 'success');
            productIdForSync = window.editingProductId;
        } else {
            data.productId = getNextProductId();
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            data.createdBy = window.auth.currentUser.email;
            const docRef = await window.db.collection('products').add(data);
            window.showToast('Produto criado com sucesso!', 'success');
            productIdForSync = docRef.id;
        }

        closeProductModal();

        // Sincronizar com Mercado Livre se produto vinculado
        if (productIdForSync && window.isMlConnected && window.isMlConnected()) {
            // Buscar produto atualizado para verificar mlbId
            const product = window.products.find(p => p.id === productIdForSync);
            if (product && product.mlbId) {
                // Comparar com valores originais do ML para enviar apenas o que mudou
                const mlOriginal = window.mlOriginalValues || {};
                const priceChanged = mlOriginal.price !== undefined && productData.price !== mlOriginal.price;
                const stockChanged = mlOriginal.stock !== undefined && productData.quantity !== mlOriginal.stock;
                const descriptionChanged = mlOriginal.description !== undefined && productData.description !== mlOriginal.description;
                const titleChanged = mlOriginal.title !== undefined && productData.name !== mlOriginal.title;

                window.logger?.log('[ML] Verificando mudancas:', {
                    precoOriginal: mlOriginal.price,
                    precoNovo: productData.price,
                    precoMudou: priceChanged,
                    estoqueOriginal: mlOriginal.stock,
                    estoqueNovo: productData.quantity,
                    estoqueMudou: stockChanged,
                    descricaoMudou: descriptionChanged,
                    tituloOriginal: mlOriginal.title,
                    tituloNovo: productData.name,
                    tituloMudou: titleChanged
                });

                // Enviar apenas campos que mudaram
                if (priceChanged || stockChanged) {
                    await window.syncProductToMlSelective(
                        product.mlbId,
                        priceChanged ? productData.price : null,
                        stockChanged ? productData.quantity : null
                    );
                } else {
                    window.logger?.log('[ML] Nenhuma mudanca de preco/estoque para sincronizar');
                }

                // Sincronizar descricao se mudou
                if (descriptionChanged) {
                    await window.syncDescriptionToMl(product.mlbId, productData.description);
                }

                // Sincronizar titulo se mudou (apenas se NAO for item de catalogo)
                if (titleChanged && window.syncTitleToMl && !mlOriginal.isCatalogItem) {
                    await window.syncTitleToMl(product.mlbId, productData.name);
                } else if (titleChanged && mlOriginal.isCatalogItem) {
                    window.logger?.log('[ML] Titulo nao sincronizado - item de catalogo');
                }

                // Sincronizar fotos com ML (bidirecional)
                // IMPORTANTE: Criar copia para evitar race condition se usuario abrir outro modal
                const editingPhotos = [...(window.editingPhotos || [])];
                const originalMlPhotos = [...(window.originalMlPhotos || [])];

                window.logger?.log('[ML] Verificando mudancas de fotos:', {
                    fotosAtuais: editingPhotos.length,
                    fotosOriginaisML: originalMlPhotos.length
                });

                // Chamar sync de fotos se tiver fotos para processar
                if (editingPhotos.length > 0 || originalMlPhotos.length > 0) {
                    if (window.syncPhotosToMl) {
                        const syncedPhotos = await window.syncPhotosToMl(
                            product.mlbId,
                            editingPhotos,
                            originalMlPhotos
                        );

                        // Se sincronizou, atualizar Firestore com novas URLs/IDs
                        if (syncedPhotos && syncedPhotos.length > 0) {
                            window.logger?.log('[ML] Fotos sincronizadas, atualizando Firestore...');

                            // Limpar localPhotos pois agora todas as fotos estao no ML
                            await window.db.collection('products').doc(productIdForSync).update({
                                mlPhotos: syncedPhotos.map(p => p.url),
                                mlPhotosWithIds: syncedPhotos.map(p => ({ id: p.id, url: p.url })),
                                localPhotos: []  // Fotos locais foram enviadas para ML
                            });

                            window.showToast('Fotos sincronizadas com ML!', 'success');
                        } else if (syncedPhotos && syncedPhotos.length === 0) {
                            // ML nao tem mais fotos - limpar tudo
                            await window.db.collection('products').doc(productIdForSync).update({
                                mlPhotos: [],
                                mlPhotosWithIds: [],
                                localPhotos: []
                            });
                            window.logger?.log('[ML] Todas as fotos removidas');
                        }
                    }
                }

                // Limpar valores originais
                window.mlOriginalValues = null;
                window.originalMlPhotos = [];
            }
        }
    } catch (error) {
        window.logger?.error('Erro ao salvar produto:', error);
        window.showToast('Erro ao salvar produto', 'error');
    } finally {
        window.hideLoading();
    }
}

// ========== EXCLUIR PRODUTO ==========
async function deleteProduct(productId) {
    const product = window.products.find(p => p.id === productId);

    let confirmMsg = 'Deseja realmente excluir este produto?';
    if (product?.mlbId) {
        confirmMsg += '\n\nNota: O produto esta vinculado ao MLB ID: ' + product.mlbId;
    }
    confirmMsg += '\n\nEsta acao nao pode ser desfeita.';

    const { confirmModal } = await import('/shared/confirm-modal.js');
    const confirmed = await confirmModal({
        title: 'Excluir Produto',
        message: confirmMsg,
        confirmText: 'Excluir',
        danger: true
    });
    if (!confirmed) {
        return;
    }

    try {
        window.showLoading();
        await window.db.collection('products').doc(productId).delete();
        window.showToast('Produto excluido com sucesso!', 'success');
    } catch (error) {
        window.logger?.error('Erro ao excluir produto:', error);
        window.showToast('Erro ao excluir produto', 'error');
    } finally {
        window.hideLoading();
    }
}

// ========== UPLOAD FOTO PARA STORAGE ==========
async function uploadPhotoToStorage(photo, productId) {
    if (!photo || !photo.file) return null;

    try {
        const storage = firebase.storage();
        // Nome seguro: sanitizar nome do arquivo
        const safeName = (photo.name || 'foto.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
        const timestamp = Date.now();
        // SEGURANCA: Usar crypto.getRandomValues ao inves de Math.random()
        const randomId = (() => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            const array = new Uint32Array(6);
            crypto.getRandomValues(array);
            return Array.from(array, n => chars[n % chars.length]).join('');
        })();
        const fileName = `${productId}_${timestamp}_${randomId}_${safeName}`;
        const storageRef = storage.ref(`products/photos/${fileName}`);

        // Upload do arquivo
        const snapshot = await storageRef.put(photo.file);
        const downloadUrl = await snapshot.ref.getDownloadURL();

        window.logger?.log('[PHOTO] Foto enviada:', fileName);
        return {
            url: downloadUrl,
            storagePath: `products/photos/${fileName}`,
            name: photo.name || safeName
        };
    } catch (error) {
        window.logger?.error('[PHOTO] Erro ao fazer upload:', error);
        throw error;
    }
}

// Upload multiplas fotos locais para Storage
// Se upload falhar (ex: 403), faz fallback salvando base64 no Firestore
// onProgress: callback(current, total, fileName) para atualizar UI
async function uploadLocalPhotosToStorage(localPhotos, productId, onProgress) {
    const results = [];
    const total = localPhotos.filter(p => p.file).length;
    let current = 0;

    for (const photo of localPhotos) {
        try {
            // Apenas fotos que tem file (locais com arquivo)
            if (photo.file) {
                current++;
                // Atualizar progresso antes do upload
                if (onProgress) onProgress(current, total, photo.name || 'foto');

                const uploadResult = await uploadPhotoToStorage(photo, productId);
                if (uploadResult) {
                    results.push({
                        url: uploadResult.url,
                        storagePath: uploadResult.storagePath,
                        name: uploadResult.name,
                        type: 'storage' // Marcar como foto do Storage
                    });
                }
            } else if (photo.url && !photo.url.startsWith('data:')) {
                // Foto ja tem URL (nao e base64) - manter como esta
                results.push({
                    url: photo.url,
                    name: photo.name || 'foto',
                    type: 'storage'
                });
            }
        } catch (error) {
            window.logger?.error(`[PHOTO] Erro ao enviar ${photo.name}:`, error);

            // FALLBACK: Se upload falhou e temos base64, salvar como base64
            // Isso garante que a foto persista mesmo sem Storage funcionando
            if (photo.url && photo.url.startsWith('data:')) {
                window.logger?.warn(`[PHOTO] Fallback: salvando ${photo.name} como base64`);
                results.push({
                    url: photo.url, // base64
                    name: photo.name || 'foto',
                    type: 'base64' // Marcar como base64 para futura migracao
                });
                window.showToast?.('Foto salva localmente (Storage indisponivel)', 'warning');
            }
        }
    }

    return results;
}

// ========== UPLOAD ARQUIVO 3MF PARA STORAGE ==========
async function uploadGcodeFile(file, gcodeId, productId) {
    if (!file) return null;

    try {
        const storage = firebase.storage();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const fileName = `${productId}_${gcodeId}_${Date.now()}_${safeName}`;
        const storageRef = storage.ref(`products/3mf/${fileName}`);

        const snapshot = await storageRef.put(file);
        const downloadUrl = await snapshot.ref.getDownloadURL();

        window.logger?.log('[3MF] Arquivo enviado:', fileName);
        return {
            url: downloadUrl,
            storagePath: `products/3mf/${fileName}`
        };
    } catch (error) {
        window.logger?.error('[3MF] Erro ao fazer upload:', error);
        throw error;
    }
}

// Upload multiplos 3MFs
async function uploadPendingGcodes(pendingFiles, productId) {
    const results = [];

    for (const pending of pendingFiles) {
        try {
            const uploadResult = await uploadGcodeFile(pending.file, pending.id, productId);
            if (uploadResult) {
                results.push({
                    id: pending.id,
                    url: uploadResult.url,
                    storagePath: uploadResult.storagePath
                });
            }
        } catch (error) {
            window.logger?.error(`[3MF] Erro ao enviar ${pending.file.name}:`, error);
        }
    }

    return results;
}

// ========== HANDLER DO FORMULARIO ==========
let _isSubmitting = false;  // Guard contra duplo-submit

async function handleProductSubmit(event) {
    event.preventDefault();

    // Impedir duplo-submit (previne criacao de clone)
    if (_isSubmitting) {
        window.logger?.warn('[SAVE] Submit bloqueado - ja em andamento');
        return;
    }
    _isSubmitting = true;

    try {
    // Coletar impressoras selecionadas
    let printerMachines = [];
    const selectedPrintersInput = document.getElementById('selectedPrinters');
    if (selectedPrintersInput && selectedPrintersInput.value) {
        try {
            printerMachines = JSON.parse(selectedPrintersInput.value);
        } catch (e) {
            window.logger?.warn('[SAVE] Erro ao parsear impressoras selecionadas:', e);
        }
    }

    // Coletar URL do video YouTube
    const youtubeVideoUrl = document.getElementById('youtubeVideoUrl')?.value.trim() || '';

    // Separar fotos por tipo (ML e Local)
    const editingPhotos = window.editingPhotos || [];
    const mlPhotos = editingPhotos
        .filter(p => p.type === 'ml')
        .map(p => p.url);

    // Fotos locais que precisam de upload (tem file associado)
    const localPhotosToUpload = editingPhotos
        .filter(p => p.type === 'local' && p.file);

    // Fotos locais ja com URL do Storage (sem base64)
    const localPhotosWithUrl = editingPhotos
        .filter(p => p.type === 'local' && !p.file && p.url && !p.url.startsWith('data:'))
        .map(p => ({ url: p.url, name: p.name || 'foto', type: 'storage' }));

    // Fotos locais ja salvas como base64 (sem file) - manter para nao perder
    const localPhotosBase64Existing = editingPhotos
        .filter(p => p.type === 'local' && !p.file && p.url && p.url.startsWith('data:'))
        .map(p => ({ url: p.url, name: p.name || 'foto', type: 'base64' }));

    // Fotos locais serao preenchidas apos upload (inclui base64 existentes)
    let localPhotos = [...localPhotosWithUrl, ...localPhotosBase64Existing];

    // Ordem das fotos para referencia
    const photosOrder = editingPhotos.map((p, i) => ({
        type: p.type,
        index: i,
        isMain: i === 0
    }));

    const productData = {
        name: (document.getElementById('productName')?.value || '').trim(),
        description: (document.getElementById('productDescription')?.value || '').trim(),
        sku: document.getElementById('productSku')?.value.trim() || '',
        gtin: document.getElementById('productGtin')?.value.trim() || '',
        saleType: document.getElementById('saleType')?.value || '',
        materialType: document.getElementById('materialType')?.value || '',
        printColor: document.getElementById('printColor')?.value || '',
        printerMachines: printerMachines,
        dimensions: {
            length: parseFloat(document.getElementById('dimLength')?.value) || 0,
            width: parseFloat(document.getElementById('dimWidth')?.value) || 0,
            height: parseFloat(document.getElementById('dimHeight')?.value) || 0
        },
        packagingDimensions: {
            length: parseFloat(document.getElementById('packLength')?.value) || 0,
            width: parseFloat(document.getElementById('packWidth')?.value) || 0,
            height: parseFloat(document.getElementById('packHeight')?.value) || 0,
            weight: parseFloat(document.getElementById('packWeight')?.value) || 0
        },
        weight: parseFloat(document.getElementById('productWeight')?.value) || 0,
        price: parseFloat(document.getElementById('productPrice')?.value) || 0,
        quantity: parseInt(document.getElementById('productQuantity')?.value) || 1,
        youtubeVideoUrl: youtubeVideoUrl,
        mlPhotos: mlPhotos,
        localPhotos: localPhotos,
        photosOrder: photosOrder,
        pendingDescription: document.getElementById('pendingDescription')?.value.trim() || '',
        printTimeEstimate: parseFloat(document.getElementById('printTimeEstimate')?.value) || 0,
        materialEstimate: parseFloat(document.getElementById('materialEstimate')?.value) || 0
    };

    // Validacoes basicas
    if (!productData.name) {
        window.showToast('Nome do produto e obrigatorio', 'warning');
        document.getElementById('productName')?.focus();
        return;
    }

    if (!productData.saleType) {
        window.showToast('Tipo de venda e obrigatorio', 'warning');
        return;
    }

    // Validar 3MFs
    if (window.validateGcodes && !window.validateGcodes()) {
        return;
    }

    // Upload de fotos locais para Firebase Storage (evita limite de 1MB do Firestore)
    if (localPhotosToUpload.length > 0) {
        try {
            // Mostrar overlay de upload com progresso
            showUploadOverlay(`Enviando ${localPhotosToUpload.length} foto(s)...`);

            const productIdForUpload = window.editingProductId || 'new_' + Date.now();
            window.logger?.log('[PHOTO] Iniciando upload de', localPhotosToUpload.length, 'foto(s)...');

            const uploadedPhotos = await uploadLocalPhotosToStorage(
                localPhotosToUpload,
                productIdForUpload,
                updateUploadProgress // Callback de progresso
            );

            // Adicionar fotos uploaded ao array de localPhotos
            localPhotos.push(...uploadedPhotos);

            hideUploadOverlay();
            window.logger?.log('[PHOTO] Upload concluido:', uploadedPhotos.length, 'foto(s) enviada(s)');
            if (uploadedPhotos.length > 0) {
                window.showToast(`${uploadedPhotos.length} foto(s) enviada(s)!`, 'success');
            }
        } catch (error) {
            hideUploadOverlay();
            window.logger?.error('[PHOTO] Erro no upload de fotos:', error);
            window.showToast('Erro ao enviar fotos. Tente novamente.', 'error');
            return;
        }
    }

    // Atualizar productData com fotos processadas (URLs do Storage, nao base64)
    productData.localPhotos = localPhotos;

    // Coletar dados dos 3MFs
    const threeMfData = window.getGcodesData ? window.getGcodesData() : [];
    const pendingThreeMf = window.getPendingGcodeFiles ? window.getPendingGcodeFiles() : [];

    // Upload de 3MFs pendentes
    if (pendingThreeMf.length > 0) {
        try {
            showUploadOverlay(`Enviando ${pendingThreeMf.length} arquivo(s) 3MF...`);
            const productIdForUpload = window.editingProductId || 'new_' + Date.now();
            const uploadResults = await uploadPendingGcodes(pendingThreeMf, productIdForUpload);

            uploadResults.forEach(result => {
                const idx = threeMfData.findIndex(f => f.id === result.id);
                if (idx !== -1) {
                    threeMfData[idx].url = result.url;
                    threeMfData[idx].storagePath = result.storagePath;
                    threeMfData[idx].isPending = false;
                }
            });

            hideUploadOverlay();
            window.showToast?.(`${uploadResults.length} arquivo(s) 3MF enviado(s)!`, 'success');
        } catch (error) {
            hideUploadOverlay();
            window.showToast?.('Erro ao enviar arquivos 3MF', 'error');
            return;
        }
    }

    // Adicionar 3MFs ao productData (remover isPending dos dados salvos)
    productData.gcodeFiles = threeMfData.map(f => ({
        id: f.id,
        printerName: f.printerName,
        fileName: f.fileName,
        uploadedAt: f.uploadedAt,
        url: f.url,
        storagePath: f.storagePath
    }));

    await saveProduct(productData);

    // Limpar gerenciador de 3MF apos salvar
    if (window.resetGcodeManager) window.resetGcodeManager();

    } finally {
        _isSubmitting = false;
    }
}

// ========== ATUALIZAR STATUS CONEXAO ==========
function updateConnectionStatus(connected) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.getElementById('statusText');

    if (statusDot && statusText) {
        if (connected) {
            statusDot.classList.remove('disconnected');
            statusText.textContent = 'Conectado';
        } else {
            statusDot.classList.add('disconnected');
            statusText.textContent = 'Desconectado';
        }
    }
}

// ========== ATUALIZAR ESTATISTICAS ==========
function updateStats() {
    const totalProducts = document.getElementById('totalProducts');
    const stockProducts = document.getElementById('stockProducts');
    const customProducts = document.getElementById('customProducts');
    const linkedProducts = document.getElementById('linkedProducts');

    if (totalProducts) {
        totalProducts.textContent = window.products.length;
    }

    if (stockProducts) {
        const count = window.products.filter(p => p.saleType === 'estoque').length;
        stockProducts.textContent = count;
    }

    if (customProducts) {
        const count = window.products.filter(p => p.saleType === 'personalizacao').length;
        customProducts.textContent = count;
    }

    if (linkedProducts) {
        const count = window.products.filter(p => p.mlbId).length;
        linkedProducts.textContent = count;
    }
}

// ========== EXPORTAR PARA GLOBAL ==========
window.loadProducts = loadProducts;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.handleProductSubmit = handleProductSubmit;
window.updateStats = updateStats;
window.getNextProductId = getNextProductId;
window.uploadGcodeFile = uploadGcodeFile;
window.uploadPendingGcodes = uploadPendingGcodes;
window.uploadPhotoToStorage = uploadPhotoToStorage;
window.uploadLocalPhotosToStorage = uploadLocalPhotosToStorage;
