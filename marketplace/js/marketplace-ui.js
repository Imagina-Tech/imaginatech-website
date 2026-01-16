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

    // Filtro de categoria
    const filterCategory = document.getElementById('filterCategory');
    if (filterCategory) {
        filterCategory.addEventListener('change', (e) => {
            window.currentFilters.category = e.target.value;
            renderProducts();
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

    // Filtro de concorrente
    const filterCompetitor = document.getElementById('filterCompetitor');
    if (filterCompetitor) {
        filterCompetitor.addEventListener('change', (e) => {
            window.currentFilters.competitor = e.target.checked;
            renderProducts();
        });
    }
}

// ========== LIMPAR FILTROS ==========
function clearFilters() {
    // Resetar estado
    window.currentFilters = {
        search: '',
        category: '',
        saleType: '',
        material: '',
        competitor: false
    };

    // Resetar elementos
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    const filterCategory = document.getElementById('filterCategory');
    if (filterCategory) {
        filterCategory.value = '';
        filterCategory.dispatchEvent(new Event('change', { bubbles: true }));
    }

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

    const filterCompetitor = document.getElementById('filterCompetitor');
    if (filterCompetitor) filterCompetitor.checked = false;

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

        // Filtro de categoria
        if (window.currentFilters.category && product.category !== window.currentFilters.category) {
            return false;
        }

        // Filtro de tipo de venda
        if (window.currentFilters.saleType && product.saleType !== window.currentFilters.saleType) {
            return false;
        }

        // Filtro de material
        if (window.currentFilters.material && product.materialType !== window.currentFilters.material) {
            return false;
        }

        // Filtro de concorrente
        if (window.currentFilters.competitor && !product.isCompetitor) {
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
            <td>${escapeHtml(product.category || '-')}</td>
            <td>${escapeHtml(product.subcategory || '-')}</td>
            <td>
                ${getSaleTypeBadge(product.saleType)}
            </td>
            <td>${escapeHtml(product.materialType || '-')}</td>
            <td>
                ${getColorChip(product.printColor)}
            </td>
            <td>${escapeHtml(product.printerMachine || '-')}</td>
            <td>
                ${product.isCompetitor ? '<i class="fas fa-check text-warning"></i>' : '-'}
            </td>
            <td>
                ${product.needsGluing ? '<i class="fas fa-check text-info"></i>' : '-'}
            </td>
            <td>${formatDimensions(product.dimensions)}</td>
            <td>${formatDimensions(product.packagingDimensions)}</td>
            <td>${product.weight ? product.weight + 'g' : '-'}</td>
            <td>${product.minStockQuantity || 0}</td>
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

    // Reset form
    form.reset();

    if (productId) {
        // Modo edicao
        const product = window.products.find(p => p.id === productId);
        if (!product) {
            window.showToast('Produto nao encontrado', 'error');
            return;
        }

        modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Produto';
        populateFormWithProduct(product);
    } else {
        // Modo criacao
        modalTitle.innerHTML = '<i class="fas fa-box"></i> Novo Produto';
        document.getElementById('productIdField').value = 'Auto';

        // Reset subcategorias
        const subcatSelect = document.getElementById('productSubcategory');
        if (subcatSelect) {
            subcatSelect.innerHTML = '<option value="">Selecione categoria primeiro</option>';
            setTimeout(() => {
                subcatSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }, 0);
        }
    }

    modal.classList.add('active');
}

function populateFormWithProduct(product) {
    // Campos de texto
    document.getElementById('productIdField').value = String(product.productId || 0).padStart(3, '0');
    document.getElementById('productName').value = product.name || '';
    document.getElementById('productDescription').value = product.description || '';
    document.getElementById('labelCode').value = product.labelCode || '';
    document.getElementById('internalCode').value = product.internalCode || '';
    document.getElementById('minStockQuantity').value = product.minStockQuantity || 0;

    // Checkboxes
    document.getElementById('isCompetitor').checked = product.isCompetitor || false;
    document.getElementById('needsGluing').checked = product.needsGluing || false;

    // Dimensoes
    if (product.dimensions) {
        document.getElementById('dimLength').value = product.dimensions.length || '';
        document.getElementById('dimWidth').value = product.dimensions.width || '';
        document.getElementById('dimHeight').value = product.dimensions.height || '';
    }

    if (product.packagingDimensions) {
        document.getElementById('packLength').value = product.packagingDimensions.length || '';
        document.getElementById('packWidth').value = product.packagingDimensions.width || '';
        document.getElementById('packHeight').value = product.packagingDimensions.height || '';
    }

    document.getElementById('productWeight').value = product.weight || '';

    // IMPORTANTE: Dropdowns com setTimeout para sincronizar CustomSelect
    // Categoria
    const categorySelect = document.getElementById('productCategory');
    setTimeout(() => {
        categorySelect.value = product.category || '';
        categorySelect.dispatchEvent(new Event('change', { bubbles: true }));

        // Atualizar subcategorias apos categoria
        if (product.category) {
            window.updateSubcategories(product.category);

            // Subcategoria (esperar subcategorias serem populadas)
            setTimeout(() => {
                const subcatSelect = document.getElementById('productSubcategory');
                subcatSelect.value = product.subcategory || '';
                subcatSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }, 50);
        }
    }, 0);

    // Tipo de venda
    const saleTypeSelect = document.getElementById('saleType');
    setTimeout(() => {
        saleTypeSelect.value = product.saleType || '';
        saleTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);

    // Material
    const materialSelect = document.getElementById('materialType');
    setTimeout(() => {
        materialSelect.value = product.materialType || '';
        materialSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);

    // Cor
    const colorSelect = document.getElementById('printColor');
    setTimeout(() => {
        colorSelect.value = product.printColor || '';
        colorSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);

    // Maquina
    const printerSelect = document.getElementById('printerMachine');
    setTimeout(() => {
        printerSelect.value = product.printerMachine || '';
        printerSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);

    // ========== CAMPOS MERCADO LIVRE ==========
    document.getElementById('productPrice').value = product.price || '';
    document.getElementById('productPhotos').value = (product.photos || []).join(', ');

    // Condicao
    const conditionSelect = document.getElementById('productCondition');
    setTimeout(() => {
        conditionSelect.value = product.condition || 'new';
        conditionSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);

    // Tipo de listagem
    const listingSelect = document.getElementById('listingType');
    setTimeout(() => {
        listingSelect.value = product.listingType || 'gold_special';
        listingSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);

    // Categoria ML
    const mlCategorySelect = document.getElementById('mlCategoryId');
    setTimeout(() => {
        mlCategorySelect.value = product.mlCategoryId || '';
        mlCategorySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);

    // Status ML
    const mlStatusDiv = document.getElementById('mlProductStatus');
    if (mlStatusDiv) {
        if (product.mlbId) {
            mlStatusDiv.innerHTML = `
                <span class="ml-badge ml-published">
                    <i class="fas fa-check-circle"></i> Publicado: ${product.mlbId}
                </span>
                <a href="https://www.mercadolivre.com.br/p/${product.mlbId}" target="_blank" class="btn-icon" title="Ver no ML">
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
