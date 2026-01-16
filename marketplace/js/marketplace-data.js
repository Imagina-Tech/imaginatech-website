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

// ========== OBTER PROXIMO ID ==========
async function getNextProductId() {
    try {
        const snapshot = await window.db.collection('products')
            .where('userId', '==', window.COMPANY_USER_ID)
            .orderBy('productId', 'desc')
            .limit(1)
            .get();

        if (snapshot.empty) {
            return 1;
        }

        const lastProduct = snapshot.docs[0].data();
        return (lastProduct.productId || 0) + 1;
    } catch (error) {
        console.error('Erro ao obter proximo ID:', error);
        // Fallback: contar produtos existentes
        return window.products.length + 1;
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
    if (!confirm('Deseja realmente excluir este produto? Esta acao nao pode ser desfeita.')) {
        return;
    }

    try {
        window.showLoading();

        await window.db.collection('products').doc(productId).delete();

        window.showToast('Produto excluido com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao excluir produto:', error);
        window.showToast('Erro ao excluir produto', 'error');
    } finally {
        window.hideLoading();
    }
}

// URL da Cloud Function de upload
const UPLOAD_FUNCTION_URL = 'https://us-central1-imaginatech-servicos.cloudfunctions.net/uploadImages';

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

    try {
        window.showToast(`Enviando ${needsUpload.length} imagem(ns)...`, 'info');

        const response = await fetch(UPLOAD_FUNCTION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ images: needsUpload })
        });

        const data = await response.json();

        if (data.success || data.urls?.length > 0) {
            console.log(`[UPLOAD] Sucesso: ${data.urls.length} imagens enviadas`);
            // Combina URLs existentes com novas URLs do Cloudinary
            return [...existingUrls, ...data.urls];
        } else {
            console.error('[UPLOAD] Erro:', data.error);
            window.showToast('Erro ao enviar algumas imagens', 'warning');
            return existingUrls; // Retorna pelo menos as URLs existentes
        }
    } catch (error) {
        console.error('[UPLOAD] Erro de rede:', error);
        window.showToast('Erro ao enviar imagens para o servidor', 'error');
        return existingUrls;
    }
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

    const productData = {
        name: document.getElementById('productName').value.trim(),
        description: document.getElementById('productDescription').value.trim(),
        labelCode: document.getElementById('labelCode').value.trim(),
        internalCode: document.getElementById('internalCode').value.trim(),
        category: document.getElementById('productCategory').value,
        subcategory: document.getElementById('productSubcategory').value,
        saleType: document.getElementById('saleType').value,
        minStockQuantity: parseInt(document.getElementById('minStockQuantity').value) || 0,
        isCompetitor: document.getElementById('isCompetitor').checked,
        materialType: document.getElementById('materialType').value,
        printColor: document.getElementById('printColor').value,
        printerMachine: document.getElementById('printerMachine').value,
        needsGluing: document.getElementById('needsGluing').checked,
        dimensions: {
            length: parseFloat(document.getElementById('dimLength').value) || 0,
            width: parseFloat(document.getElementById('dimWidth').value) || 0,
            height: parseFloat(document.getElementById('dimHeight').value) || 0
        },
        packagingDimensions: {
            length: parseFloat(document.getElementById('packLength').value) || 0,
            width: parseFloat(document.getElementById('packWidth').value) || 0,
            height: parseFloat(document.getElementById('packHeight').value) || 0
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
        // Garantia
        mlWarrantyType: document.getElementById('mlWarrantyType')?.value || 'seller',
        mlWarrantyDays: parseInt(document.getElementById('mlWarrantyDays')?.value) || 90,
        photos: photos
    };

    // Validacoes
    if (!productData.name) {
        window.showToast('Nome do produto e obrigatorio', 'warning');
        return;
    }

    if (!productData.category) {
        window.showToast('Categoria e obrigatoria', 'warning');
        return;
    }

    if (!productData.saleType) {
        window.showToast('Tipo de venda e obrigatorio', 'warning');
        return;
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
