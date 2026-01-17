/*
==================================================
ARQUIVO: marketplace/js/marketplace-data.js
MODULO: CRUD Firestore para Produtos
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 1.0
==================================================
*/

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

                    renderProducts();
                    updateStats();

                    // Atualizar status de conexao
                    updateConnectionStatus(true);
                },
                (error) => {
                    console.error('Erro ao carregar produtos:', error);
                    updateConnectionStatus(false);
                    window.showToast('Erro ao carregar produtos', 'error');
                }
            );
    } catch (error) {
        console.error('Erro ao configurar listener:', error);
        window.showToast('Erro ao conectar com banco de dados', 'error');
    }
}

// ========== OBTER PROXIMO ID (RANGE 1-200) ==========
const MAX_PRODUCT_ID = 200;

async function getNextProductId() {
    try {
        // Buscar todos os IDs usados
        const snapshot = await window.db.collection('products')
            .where('userId', '==', window.COMPANY_USER_ID)
            .get();

        const usedIds = new Set();
        snapshot.forEach(doc => {
            const productId = doc.data().productId;
            if (productId) usedIds.add(productId);
        });

        // Encontrar o primeiro ID disponivel no range 1-200
        for (let id = 1; id <= MAX_PRODUCT_ID; id++) {
            if (!usedIds.has(id)) {
                return id;
            }
        }

        // Se todos os IDs estao ocupados
        throw new Error('Limite de 200 produtos atingido');
    } catch (error) {
        console.error('Erro ao obter proximo ID:', error);
        throw error;
    }
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

        if (window.editingProductId) {
            // Atualizar produto existente
            await window.db.collection('products')
                .doc(window.editingProductId)
                .update(data);

            window.showToast('Produto atualizado com sucesso!', 'success');
        } else {
            // Criar novo produto
            data.productId = await getNextProductId();
            data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            data.createdBy = window.auth.currentUser.email;

            await window.db.collection('products').add(data);

            window.showToast('Produto criado com sucesso!', 'success');
        }

        closeProductModal();
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        window.showToast('Erro ao salvar produto', 'error');
    } finally {
        window.hideLoading();
    }
}

// ========== EXCLUIR PRODUTO ==========
async function deleteProduct(productId) {
    // Buscar produto para verificar se tem mlbId
    const product = window.products.find(p => p.id === productId);

    let confirmMsg = 'Deseja realmente excluir este produto?';
    if (product?.mlbId) {
        confirmMsg += '\n\nATENCAO: O anuncio no Mercado Livre tambem sera FINALIZADO.';
    }
    confirmMsg += '\n\nEsta acao nao pode ser desfeita.';

    if (!confirm(confirmMsg)) {
        return;
    }

    try {
        window.showLoading();

        // Se tem mlbId, finalizar anuncio no ML primeiro
        if (product?.mlbId) {
            try {
                window.showToast('Finalizando anuncio no Mercado Livre...', 'info');
                const response = await fetch('https://us-central1-imaginatech-servicos.cloudfunctions.net/deleteMLItem', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mlbId: product.mlbId })
                });

                const data = await response.json();
                if (!data.success) {
                    console.warn('Aviso: Erro ao finalizar no ML:', data.error);
                    // Continua com a exclusao local mesmo se falhar no ML
                }
            } catch (mlError) {
                console.warn('Aviso: Erro ao finalizar no ML:', mlError);
                // Continua com a exclusao local mesmo se falhar no ML
            }
        }

        // Excluir do Firestore
        await window.db.collection('products').doc(productId).delete();

        window.showToast('Produto excluido com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        window.showToast('Erro ao excluir produto', 'error');
    } finally {
        window.hideLoading();
    }
}

// Cloudinary - Upload direto do frontend (unsigned)
const CLOUDINARY_CLOUD_NAME = 'ds2x4wiy5';
const CLOUDINARY_UPLOAD_PRESET = 'imaginatech_unsigned'; // Criar no Cloudinary Dashboard

// ========== UPLOAD DE IMAGENS PARA CLOUDINARY ==========
async function uploadImagesToCloudinary(images) {
    if (!images || images.length === 0) {
        return [];
    }

    // Separar URLs existentes de base64 que precisam upload
    const existingUrls = [];
    const needsUpload = [];

    images.forEach(img => {
        if (!img) return;

        // Se ja e URL (http), nao precisa upload
        if (img.startsWith('http')) {
            existingUrls.push(img);
        } else if (img.startsWith('data:')) {
            // Base64 precisa upload
            needsUpload.push(img);
        }
    });

    console.log(`[UPLOAD] ${existingUrls.length} URLs existentes, ${needsUpload.length} para upload`);

    // Se nao tem nada para upload, retorna URLs existentes
    if (needsUpload.length === 0) {
        return existingUrls;
    }

    window.showToast(`Enviando ${needsUpload.length} imagem(ns)...`, 'info');

    // Upload direto para Cloudinary (unsigned upload)
    const uploadedUrls = [];

    for (let i = 0; i < needsUpload.length; i++) {
        try {
            const formData = new FormData();
            formData.append('file', needsUpload[i]);
            formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
            formData.append('folder', 'imaginatech/marketplace');

            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
                { method: 'POST', body: formData }
            );

            const data = await response.json();

            if (data.secure_url) {
                console.log(`[UPLOAD] Imagem ${i + 1} enviada:`, data.secure_url);
                uploadedUrls.push(data.secure_url);
            } else {
                console.error(`[UPLOAD] Erro na imagem ${i + 1}:`, data.error?.message);
            }
        } catch (error) {
            console.error(`[UPLOAD] Erro na imagem ${i + 1}:`, error);
        }
    }

    console.log(`[UPLOAD] ${uploadedUrls.length}/${needsUpload.length} imagens enviadas`);

    if (uploadedUrls.length > 0) {
        window.showToast(`${uploadedUrls.length} imagem(ns) enviada(s)!`, 'success');
    } else {
        window.showToast('Erro ao enviar imagens. Verifique o upload preset.', 'error');
    }

    return [...existingUrls, ...uploadedUrls];
}

// ========== HANDLER DO FORMULARIO ==========
async function handleProductSubmit(event) {
    event.preventDefault();

    // Coletar fotos do mlFormState (URLs e arquivos base64)
    let photos = [];
    if (window.mlFormState && window.mlFormState.photos && window.mlFormState.photos.length > 0) {
        console.log('[SAVE] Fotos no mlFormState:', window.mlFormState.photos.length);

        // Coletar todas as fotos (URLs e base64 de arquivos)
        photos = window.mlFormState.photos.map(p => {
            const preview = p.data?.substring(0, 50) || 'vazio';
            console.log(`[SAVE] Foto tipo=${p.type}, data=${preview}...`);
            return p.data;
        }).filter(data => data && data.trim());

        console.log('[SAVE] Total de fotos coletadas:', photos.length);
    }

    // Fallback para input hidden (se mlFormState vazio)
    if (photos.length === 0) {
        const photosInput = document.getElementById('productPhotos');
        if (photosInput && photosInput.value.trim()) {
            photos = photosInput.value.split(',').map(url => url.trim()).filter(url => url);
            console.log('[SAVE] Fotos do input hidden:', photos.length);
        }
    }

    // ========== UPLOAD DAS IMAGENS PARA CLOUDINARY ==========
    if (photos.length > 0) {
        console.log('[SAVE] Iniciando upload de imagens...');
        photos = await uploadImagesToCloudinary(photos);
        console.log('[SAVE] Fotos apos upload:', photos.length, photos);
    }

    // Coletar atributos ML
    const mlAttributes = window.collectMlAttributes ? window.collectMlAttributes() : [];

    // Pegar nome da categoria selecionada
    const mlCategoryName = window.mlFormState?.selectedCategory?.name || '';

    // Coletar impressoras selecionadas
    let printerMachines = [];
    const selectedPrintersInput = document.getElementById('selectedPrinters');
    if (selectedPrintersInput && selectedPrintersInput.value) {
        try {
            printerMachines = JSON.parse(selectedPrintersInput.value);
        } catch (e) {
            console.warn('[SAVE] Erro ao parsear impressoras selecionadas:', e);
        }
    }

    const productData = {
        name: document.getElementById('productName').value.trim(),
        description: document.getElementById('productDescription').value.trim(),
        // Codigos de identificacao
        sku: document.getElementById('productSku')?.value.trim() || '',
        gtin: document.getElementById('productGtin')?.value.trim() || '',
        labelCode: document.getElementById('labelCode').value.trim(),
        internalCode: document.getElementById('internalCode').value.trim(),
        // Producao
        saleType: document.getElementById('saleType').value,
        materialType: document.getElementById('materialType').value,
        printColor: document.getElementById('printColor').value,
        printerMachines: printerMachines,
        // Dimensoes
        dimensions: {
            length: parseFloat(document.getElementById('dimLength').value) || 0,
            width: parseFloat(document.getElementById('dimWidth').value) || 0,
            height: parseFloat(document.getElementById('dimHeight').value) || 0
        },
        packagingDimensions: {
            length: parseFloat(document.getElementById('packLength').value) || 0,
            width: parseFloat(document.getElementById('packWidth').value) || 0,
            height: parseFloat(document.getElementById('packHeight').value) || 0,
            weight: parseFloat(document.getElementById('packWeight').value) || 0
        },
        weight: parseFloat(document.getElementById('productWeight').value) || 0,
        // Campos Mercado Livre
        price: parseFloat(document.getElementById('productPrice').value) || 0,
        condition: document.getElementById('productCondition').value || 'new',
        listingType: document.getElementById('listingType').value || 'gold_special',
        mlCategoryId: document.getElementById('mlCategoryId').value,
        mlCategoryName: mlCategoryName,
        mlAttributes: mlAttributes,
        mlQuantity: parseInt(document.getElementById('mlQuantity')?.value) || 1,
        // Envio
        mlShippingMode: document.getElementById('mlShippingMode')?.value || 'me2',
        mlFreeShipping: document.getElementById('mlFreeShipping')?.value === 'true',
        mlLocalPickup: document.getElementById('mlLocalPickup')?.value === 'true',
        mlShippingDays: parseInt(document.getElementById('mlShippingDays')?.value) || 2,
        mlManufacturingTime: parseInt(document.getElementById('mlManufacturingTime')?.value) || 0,
        // Garantia
        mlWarrantyType: document.getElementById('mlWarrantyType')?.value || 'seller',
        mlWarrantyDays: parseInt(document.getElementById('mlWarrantyDays')?.value) || 90,
        photos: photos,
        // Video
        videoUrl: document.getElementById('productVideo')?.value.trim() || '',
        // Variacoes
        variations: window.collectVariations ? window.collectVariations() : null
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

    // Validar atributos ML obrigatorios (somente se tiver categoria selecionada)
    if (productData.mlCategoryId) {
        const requiredFields = document.querySelectorAll('[data-ml-required="true"]');
        for (const field of requiredFields) {
            if (!field.value || field.value.trim() === '') {
                const label = field.closest('.ml-attribute-field')?.querySelector('label')?.textContent?.replace('*', '').trim();
                window.showToast(`Preencha o campo obrigatorio: ${label || 'Atributo ML'}`, 'warning');
                field.focus();
                // Scroll para o campo
                field.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
        }
    }

    await saveProduct(productData);
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
}

// ========== EXPORTAR PARA GLOBAL ==========
window.loadProducts = loadProducts;
window.saveProduct = saveProduct;
window.deleteProduct = deleteProduct;
window.handleProductSubmit = handleProductSubmit;
window.updateStats = updateStats;
window.getNextProductId = getNextProductId;
