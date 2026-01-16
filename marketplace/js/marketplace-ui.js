/*
==================================================
ARQUIVO: marketplace/js/marketplace-ui.js
MODULO: Renderizacao, Filtros e UI
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 1.0
==================================================
*/

// ========== DEBOUNCE PARA BUSCA ==========
let searchDebounceTimer = null;

// ========== INICIALIZACAO UI ==========
document.addEventListener('DOMContentLoaded', () => {
    setupFilterListeners();
});

// ========== CONFIGURAR LISTENERS DE FILTRO ==========
function setupFilterListeners() {
    // Busca com debounce
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                window.currentFilters.search = e.target.value.toLowerCase().trim();
                renderProducts();
            }, 300);
        });
    }

    // Filtro de tipo de venda
    const filterSaleType = document.getElementById('filterSaleType');
    if (filterSaleType) {
        filterSaleType.addEventListener('change', (e) => {
            window.currentFilters.saleType = e.target.value;
            renderProducts();
        });
    }

    // Filtro de material
    const filterMaterial = document.getElementById('filterMaterial');
    if (filterMaterial) {
        filterMaterial.addEventListener('change', (e) => {
            window.currentFilters.material = e.target.value;
            renderProducts();
        });
    }
}

// ========== LIMPAR FILTROS ==========
function clearFilters() {
    // Resetar estado
    window.currentFilters = {
        search: '',
        saleType: '',
        material: ''
    };

    // Resetar elementos
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    const filterSaleType = document.getElementById('filterSaleType');
    if (filterSaleType) {
        filterSaleType.value = '';
        filterSaleType.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const filterMaterial = document.getElementById('filterMaterial');
    if (filterMaterial) {
        filterMaterial.value = '';
        filterMaterial.dispatchEvent(new Event('change', { bubbles: true }));
    }

    renderProducts();
    window.showToast('Filtros limpos', 'success');
}

// ========== APLICAR FILTROS ==========
function applyFilters(productsList) {
    return productsList.filter(product => {
        // Filtro de busca
        if (window.currentFilters.search) {
            const search = window.currentFilters.search;
            const matchName = product.name?.toLowerCase().includes(search);
            const matchLabel = product.labelCode?.toLowerCase().includes(search);
            const matchInternal = product.internalCode?.toLowerCase().includes(search);
            const matchDescription = product.description?.toLowerCase().includes(search);
            const matchId = String(product.productId).includes(search);

            if (!matchName && !matchLabel && !matchInternal && !matchDescription && !matchId) {
                return false;
            }
        }

        // Filtro de tipo de venda
        if (window.currentFilters.saleType && product.saleType !== window.currentFilters.saleType) {
            return false;
        }

        // Filtro de material
        if (window.currentFilters.material && product.materialType !== window.currentFilters.material) {
            return false;
        }

        return true;
    });
}

// ========== RENDERIZAR PRODUTOS ==========
function renderProducts() {
    const tbody = document.getElementById('productsTableBody');
    const emptyState = document.getElementById('emptyState');

    if (!tbody) return;

    const filtered = applyFilters(window.products);

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = filtered.map(product => `
        <tr data-id="${product.id}">
            <td class="sticky-col col-id">
                <strong>${String(product.productId || 0).padStart(3, '0')}</strong>
            </td>
            <td class="sticky-col col-name">
                ${escapeHtml(product.name || '-')}
            </td>
            <td>
                ${getSaleTypeBadge(product.saleType)}
            </td>
            <td class="col-price">
                ${product.price ? 'R$ ' + product.price.toFixed(2) : '-'}
            </td>
            <td>${escapeHtml(product.materialType || '-')}</td>
            <td>
                ${getColorChip(product.printColor)}
            </td>
            <td>${escapeHtml(product.printerMachine || '-')}</td>
            <td>${formatDimensions(product.dimensions)}</td>
            <td>${formatDimensions(product.packagingDimensions)}</td>
            <td>${product.weight ? product.weight + 'g' : '-'}</td>
            <td>${escapeHtml(product.labelCode || '-')}</td>
            <td>${escapeHtml(product.internalCode || '-')}</td>
            <td>
                ${getMlStatusBadge(product)}
            </td>
            <td class="col-actions">
                <div class="actions-cell">
                    <button class="btn-icon" onclick="editProduct('${product.id}')" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${getMlActionButton(product)}
                    <button class="btn-icon btn-danger" onclick="deleteProduct('${product.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ========== HELPERS DE FORMATACAO ==========
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========== HELPERS MERCADO LIVRE ==========
function getMlStatusBadge(product) {
    if (product.mlbId) {
        return `<span class="badge badge-ml-linked" title="${product.mlbId}">
            <i class="fas fa-link"></i> ${product.mlbId.substring(0, 10)}...
        </span>`;
    }
    return '<span class="badge badge-ml-unlinked"><i class="fas fa-unlink"></i></span>';
}

function getMlActionButton(product) {
    if (product.mlbId) {
        // Produto ja publicado - mostrar botao de sincronizar
        return `<button class="btn-icon btn-ml-sync" onclick="syncProductToML('${product.id}')" title="Sincronizar com ML">
            <i class="fas fa-sync"></i>
        </button>`;
    }

    // Verificar se tem dados para publicar
    const canPublish = product.price && product.mlCategoryId && product.photos && product.photos.length > 0;

    if (canPublish) {
        // Pronto para publicar - mostrar botao verde
        return `<button class="btn-icon btn-publish-ml" onclick="publishToML('${product.id}')" title="Publicar no Mercado Livre">
            <i class="fas fa-cloud-upload-alt"></i>
        </button>`;
    }

    // Nao tem dados completos - mostrar botao de vincular
    return `<button class="btn-icon btn-ml-link" onclick="linkProductToML('${product.id}')" title="Vincular ao ML">
        <i class="fas fa-plug"></i>
    </button>`;
}

function getSaleTypeBadge(saleType) {
    if (!saleType) return '-';

    if (saleType === 'estoque') {
        return '<span class="badge badge-estoque"><i class="fas fa-box"></i> Estoque</span>';
    } else if (saleType === 'personalizacao') {
        return '<span class="badge badge-personalizacao"><i class="fas fa-palette"></i> Personaliz.</span>';
    }

    return escapeHtml(saleType);
}

function getColorChip(color) {
    if (!color) return '-';

    const colorHex = getColorHex(color);
    return `<span class="color-chip" style="--chip-color: ${colorHex}">${escapeHtml(color)}</span>`;
}

function getColorHex(colorName) {
    const colorMap = {
        'Branco': '#FFFFFF',
        'Preto': '#1a1a1a',
        'Cinza Claro': '#B0B0B0',
        'Cinza Escuro': '#4A4A4A',
        'Prata': '#C0C0C0',
        'Vermelho': '#FF0000',
        'Vermelho Metalico': '#B22222',
        'Rosa': '#FF69B4',
        'Rosa Metalico': '#DB7093',
        'Rosa Pastel': '#FFD1DC',
        'Laranja': '#FF6B00',
        'Laranja Metalico': '#CC5500',
        'Amarelo': '#FFD700',
        'Amarelo Metalico': '#DAA520',
        'Dourado': '#FFD700',
        'Verde': '#00AA00',
        'Verde Claro': '#90EE90',
        'Verde Escuro': '#006400',
        'Verde Metalico': '#228B22',
        'Azul': '#0066FF',
        'Azul Claro': '#87CEEB',
        'Azul Marinho': '#000080',
        'Azul Royal': '#4169E1',
        'Azul Metalico': '#4682B4',
        'Ciano': '#00FFFF',
        'Turquesa': '#40E0D0',
        'Roxo': '#8B00FF',
        'Roxo Metalico': '#663399',
        'Lilas': '#C8A2C8',
        'Magenta': '#FF00FF',
        'Marrom': '#8B4513',
        'Marrom Escuro': '#5C4033',
        'Bege': '#F5F5DC',
        'Nude': '#E3BC9A',
        'Madeira Clara': '#DEB887',
        'Madeira Escura': '#8B4513',
        'Marmore Branco': '#F5F5F5',
        'Marmore Preto': '#2F2F2F',
        'Transparente': 'rgba(200, 200, 200, 0.3)',
        'Fosforescente Verde': '#39FF14',
        'Fosforescente Azul': '#00BFFF',
        'Bronze': '#CD7F32',
        'Cobre': '#B87333'
    };

    return colorMap[colorName] || '#888888';
}

function formatDimensions(dims) {
    if (!dims) return '-';

    const { length, width, height } = dims;

    if (!length && !width && !height) return '-';

    return `${length || 0}x${width || 0}x${height || 0}`;
}

// ========== MODAL DE PRODUTO ==========
function openProductModal(productId = null) {
    window.editingProductId = productId;

    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
    const modalTitle = document.getElementById('modalTitle');

    if (!modal || !form) return;

    // Mostrar modal primeiro
    modal.classList.add('active');

    if (productId) {
        // Modo edicao
        const product = window.products.find(p => p.id === productId);
        if (!product) {
            window.showToast('Produto nao encontrado', 'error');
            modal.classList.remove('active');
            return;
        }

        console.log('[EDIT] Carregando produto:', product.name, product);

        modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Produto';

        // Reset form DEPOIS de mostrar modal, ANTES de popular
        form.reset();

        // Popular com pequeno delay para garantir que o DOM esteja pronto
        setTimeout(() => {
            populateFormWithProduct(product);
        }, 50);

    } else {
        // Modo criacao - reset completo
        modalTitle.innerHTML = '<i class="fas fa-box"></i> Novo Produto';
        form.reset();

        document.getElementById('productIdField').value = 'Auto';

        // Reset formulario ML (categoria, fotos, atributos)
        if (window.resetMlForm) {
            window.resetMlForm();
        }

        // Reset status ML
        const mlStatusDiv = document.getElementById('mlProductStatus');
        if (mlStatusDiv) {
            mlStatusDiv.innerHTML = `
                <span class="ml-badge ml-not-published">
                    <i class="fas fa-cloud-upload-alt"></i> Nao publicado no ML
                </span>
            `;
        }
    }
}

function populateFormWithProduct(product) {
    console.log('[POPULATE] Iniciando preenchimento do formulario:', product);

    // Helper para definir valor com seguranca
    function setFieldValue(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.value = value;
            console.log(`[POPULATE] ${id} = "${value}"`);
        } else {
            console.warn(`[POPULATE] Campo nao encontrado: ${id}`);
        }
    }

    // Helper para definir checkbox
    function setCheckbox(id, checked) {
        const el = document.getElementById(id);
        if (el) {
            el.checked = !!checked;
        }
    }

    // Helper para definir select com sincronizacao CustomSelect
    function setSelectValue(id, value, delay = 0) {
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) {
                el.value = value || '';
                el.dispatchEvent(new Event('change', { bubbles: true }));
                console.log(`[POPULATE] SELECT ${id} = "${value}"`);
            }
        }, delay);
    }

    // ========== CAMPOS DE TEXTO ==========
    setFieldValue('productIdField', String(product.productId || 0).padStart(3, '0'));
    setFieldValue('productName', product.name || '');
    setFieldValue('productDescription', product.description || '');
    setFieldValue('labelCode', product.labelCode || '');
    setFieldValue('internalCode', product.internalCode || '');

    // ========== DIMENSOES ==========
    if (product.dimensions) {
        setFieldValue('dimLength', product.dimensions.length || '');
        setFieldValue('dimWidth', product.dimensions.width || '');
        setFieldValue('dimHeight', product.dimensions.height || '');
    }

    if (product.packagingDimensions) {
        setFieldValue('packLength', product.packagingDimensions.length || '');
        setFieldValue('packWidth', product.packagingDimensions.width || '');
        setFieldValue('packHeight', product.packagingDimensions.height || '');
        setFieldValue('packWeight', product.packagingDimensions.weight || '');
    }

    setFieldValue('productWeight', product.weight || '');

    // Recalcular peso para frete
    setTimeout(() => {
        if (window.calculateShippingWeight) {
            window.calculateShippingWeight();
        }
    }, 100);

    // ========== DROPDOWNS ==========
    setSelectValue('saleType', product.saleType, 10);
    setSelectValue('materialType', product.materialType, 20);
    setSelectValue('printColor', product.printColor, 30);
    setSelectValue('printerMachine', product.printerMachine, 40);

    // ========== CAMPOS MERCADO LIVRE ==========
    setFieldValue('productPrice', product.price || '');

    // Quantidade ML
    const qtyField = document.getElementById('mlQuantity');
    if (qtyField) {
        qtyField.value = product.mlQuantity || product.minStockQuantity || 1;
    }

    // Selects ML
    setSelectValue('productCondition', product.condition || 'new', 60);
    setSelectValue('listingType', product.listingType || 'gold_special', 70);
    setSelectValue('mlShippingMode', product.mlShippingMode || 'me2', 80);
    setSelectValue('mlFreeShipping', product.mlFreeShipping ? 'true' : 'false', 90);
    setSelectValue('mlLocalPickup', product.mlLocalPickup ? 'true' : 'false', 100);
    setSelectValue('mlShippingDays', product.mlShippingDays || '2', 110);
    setSelectValue('mlWarrantyType', product.mlWarrantyType || 'seller', 120);
    setSelectValue('mlWarrantyDays', product.mlWarrantyDays || '90', 130);

    // ========== FORMULARIO ML (categoria, fotos, atributos) ==========
    setTimeout(() => {
        if (window.populateMlFormWithProduct) {
            console.log('[POPULATE] Chamando populateMlFormWithProduct');
            window.populateMlFormWithProduct(product);
        } else {
            console.warn('[POPULATE] populateMlFormWithProduct nao disponivel');
        }
    }, 150);

    // ========== STATUS ML ==========
    const mlStatusDiv = document.getElementById('mlProductStatus');
    if (mlStatusDiv) {
        if (product.mlbId) {
            mlStatusDiv.innerHTML = `
                <span class="ml-badge ml-published">
                    <i class="fas fa-check-circle"></i> Publicado: ${product.mlbId}
                </span>
                <a href="https://produto.mercadolivre.com.br/${product.mlbId}" target="_blank" class="btn-icon" title="Ver no ML">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            `;
        } else {
            mlStatusDiv.innerHTML = `
                <span class="ml-badge ml-not-published">
                    <i class="fas fa-cloud-upload-alt"></i> Nao publicado no ML
                </span>
            `;
        }
    }

    console.log('[POPULATE] Preenchimento concluido');
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) {
        modal.classList.remove('active');
    }
    window.editingProductId = null;
}

function editProduct(productId) {
    openProductModal(productId);
}

// ========== FECHAR MODAL COM ESC ==========
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeProductModal();
    }
});

// ========== FECHAR MODAL CLICANDO FORA ==========
document.addEventListener('click', (e) => {
    const modal = document.getElementById('productModal');
    if (e.target === modal) {
        closeProductModal();
    }
});

// ========== EXPORTAR PARA GLOBAL ==========
window.clearFilters = clearFilters;
window.renderProducts = renderProducts;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.editProduct = editProduct;
window.applyFilters = applyFilters;
