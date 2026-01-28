/*
==================================================
ARQUIVO: marketplace/js/marketplace-ui.js
MODULO: Renderizacao, Filtros e UI
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 2.1 - Com ProductEditContext (isolamento de estado)
==================================================
*/

// ========== DEBOUNCE PARA BUSCA ==========
let searchDebounceTimer = null;

// ========================================
// PRODUCT EDIT CONTEXT
// Gerencia estado de edicao isolado por produto
// Resolve race condition de variaveis globais
// ========================================
class ProductEditContext {
    constructor() {
        this.contexts = new Map();
        this.currentProductId = null;
    }

    // Inicia contexto para um produto
    startEditing(productId) {
        this.currentProductId = productId || '__new__';
        if (!this.contexts.has(this.currentProductId)) {
            this.contexts.set(this.currentProductId, {
                editingPhotos: [],
                originalMlPhotos: [],
                mlOriginalValues: null,
                hasMlb: false
            });
        }
        return this.getContext();
    }

    // Obtem contexto atual
    getContext() {
        if (!this.currentProductId) return null;
        return this.contexts.get(this.currentProductId);
    }

    // Limpa contexto ao fechar modal
    clearCurrent() {
        if (this.currentProductId) {
            this.contexts.delete(this.currentProductId);
            this.currentProductId = null;
        }
    }

    // Limpa todos os contextos
    clearAll() {
        this.contexts.clear();
        this.currentProductId = null;
    }

    // Getters para compatibilidade com codigo legado
    get editingPhotos() {
        return this.getContext()?.editingPhotos || [];
    }

    set editingPhotos(value) {
        const ctx = this.getContext();
        if (ctx) ctx.editingPhotos = value;
    }

    get originalMlPhotos() {
        return this.getContext()?.originalMlPhotos || [];
    }

    set originalMlPhotos(value) {
        const ctx = this.getContext();
        if (ctx) ctx.originalMlPhotos = value;
    }

    get mlOriginalValues() {
        return this.getContext()?.mlOriginalValues || null;
    }

    set mlOriginalValues(value) {
        const ctx = this.getContext();
        if (ctx) ctx.mlOriginalValues = value;
    }

    get hasMlb() {
        return this.getContext()?.hasMlb || false;
    }

    set hasMlb(value) {
        const ctx = this.getContext();
        if (ctx) ctx.hasMlb = value;
    }
}

// Instancia global do gerenciador de contexto
const productEditContext = new ProductEditContext();

// Compatibilidade: expor via window para acesso em outros arquivos
window.productEditContext = productEditContext;

// ========== ESTADO DAS FOTOS NO FORMULARIO (LEGADO - Redirecionado para Context) ==========
// DEPRECATED: Usar productEditContext diretamente
Object.defineProperty(window, 'editingPhotos', {
    get: () => productEditContext.editingPhotos,
    set: (value) => { productEditContext.editingPhotos = value; }
});

Object.defineProperty(window, 'originalMlPhotos', {
    get: () => productEditContext.originalMlPhotos,
    set: (value) => { productEditContext.originalMlPhotos = value; }
});

Object.defineProperty(window, 'mlOriginalValues', {
    get: () => productEditContext.mlOriginalValues,
    set: (value) => { productEditContext.mlOriginalValues = value; }
});

Object.defineProperty(window, 'currentProductHasMlb', {
    get: () => productEditContext.hasMlb,
    set: (value) => { productEditContext.hasMlb = value; }
});

let draggedPhotoIndex = null;

// ========== INICIALIZACAO UI ==========
document.addEventListener('DOMContentLoaded', () => {
    setupFilterListeners();
    setupPhotosDropzone();
    setupAutoResizeTextareas();
    setupGcodeManager();
    setupColumnResize();
    setupUIEventDelegation();
});

// ========== SEGURANCA: EVENT DELEGATION PARA UI ==========
function setupUIEventDelegation() {
    document.addEventListener('click', (e) => {
        const actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;

        const action = actionEl.dataset.action;
        const id = actionEl.dataset.id;
        const index = actionEl.dataset.index;

        // Product actions
        if (action === 'edit-product' && id) {
            editProduct(id);
            return;
        }
        if (action === 'delete-product' && id) {
            deleteProduct(id);
            return;
        }

        // ML Link actions
        if (action === 'unlink-mlb' && id) {
            unlinkMlb(id);
            return;
        }
        if (action === 'open-link-mlb' && id) {
            openLinkMlbModal(id);
            return;
        }

        // Material details
        if (action === 'show-material-details' && id) {
            e.stopPropagation();
            showMaterialDetails(id);
            return;
        }

        // Description editor
        if (action === 'open-desc-editor' && id) {
            openDescriptionEditor(id);
            return;
        }

        // Photo actions
        if (action === 'open-photo') {
            const url = actionEl.dataset.url;
            if (url) openPhotoFullscreen(url);
            return;
        }
        if (action === 'set-photo-main' && index !== undefined) {
            e.stopPropagation();
            setPhotoAsMain(parseInt(index, 10));
            return;
        }
        if (action === 'remove-photo' && index !== undefined) {
            e.stopPropagation();
            removePhoto(parseInt(index, 10));
            return;
        }

        // Import from ML
        if (action === 'import-from-ml') {
            const mlbId = actionEl.dataset.mlbId;
            if (mlbId) importFromMl(mlbId);
            return;
        }
    });

    // SEGURANCA: Handler para fallback de imagens (substitui onerror inline)
    document.addEventListener('error', (e) => {
        if (e.target.tagName === 'IMG') {
            // Fallback simples: troca src
            if (e.target.dataset.fallback) {
                e.target.src = e.target.dataset.fallback;
                e.target.removeAttribute('data-fallback');
            }
            // Fallback especial: esconde img e mostra placeholder sibling
            if (e.target.dataset.fallbackAction === 'show-placeholder') {
                e.target.style.display = 'none';
                const placeholder = e.target.nextElementSibling;
                if (placeholder) placeholder.style.display = 'flex';
                e.target.removeAttribute('data-fallback-action');
            }
        }
    }, true);
}

// ========== AUTO-RESIZE TEXTAREAS ==========
function setupAutoResizeTextareas() {
    // Event delegation para funcionar com elementos dinamicos
    document.addEventListener('input', (e) => {
        if (e.target.matches('textarea.auto-resize')) {
            autoResizeTextarea(e.target);
        }
    });
}

function autoResizeTextarea(textarea) {
    if (!textarea) return;
    // Reset para calcular corretamente
    textarea.style.height = '0';
    textarea.style.overflow = 'hidden';
    // Calcular nova altura
    const newHeight = Math.max(80, Math.min(textarea.scrollHeight, 400));
    textarea.style.height = newHeight + 'px';
    // Se atingiu max, mostrar scroll
    if (textarea.scrollHeight > 400) {
        textarea.style.overflow = 'auto';
    }
}

// Ajusta altura ao carregar conteudo no modal
function triggerAutoResize(textarea) {
    if (textarea && textarea.classList.contains('auto-resize')) {
        autoResizeTextarea(textarea);
    }
}

// ========== REDIMENSIONAMENTO DE COLUNAS (Estilo Excel) ==========
// Classe TableColumnResizer: Gerencia redimensionamento independente via <colgroup>
// Usa table-layout: fixed + <col> elements para garantir independencia das colunas
class TableColumnResizer {
    constructor(options = {}) {
        this.tableId = options.tableId || 'productsTable';
        this.storageKey = 'marketplace_column_widths';
        this.minWidthFallback = 40;  // Fallback se nao conseguir medir
        this.fixedColumns = ['id'];  // Colunas NAO redimensionaveis (spacer nao e mapeada)
        this.defaultWidths = {
            id: 55, name: 150, price: 100, type: 100,
            description: 180, machines: 100, material: 100,
            dimensions: 90, packaging: 90, weight: 70,
            'gcode': 70, actions: 130
        };
        this.minWidths = {};  // Largura minima por coluna (baseada no texto do cabecalho)
        this.columns = new Map();
        this.isResizing = false;
        this.rafId = null;
        this.currentColId = null;
        this.startX = 0;
        this.startWidth = 0;

        // Bind methods para preservar contexto
        this._onMove = this._onMove.bind(this);
        this._onEnd = this._onEnd.bind(this);
    }

    init() {
        this.table = document.getElementById(this.tableId);
        if (!this.table) return;

        this.colgroup = this.table.querySelector('colgroup');
        if (!this.colgroup) return;

        this._calculateMinWidths();  // Calcula largura minima baseada no cabecalho
        this._mapColumns();
        this._loadSavedWidths();
        this._applyWidths();
        this._createHandles();
    }

    // Calcula largura minima de cada coluna baseada no texto do cabecalho
    _calculateMinWidths() {
        const headers = this.table.querySelectorAll('thead th');
        const cols = this.colgroup.querySelectorAll('col');

        headers.forEach((th, index) => {
            const col = cols[index];
            if (!col) return;

            const colId = col.dataset.colId;
            if (!colId || colId === 'spacer') return;

            // Mede a largura do texto + padding
            const style = window.getComputedStyle(th);
            const paddingLeft = parseFloat(style.paddingLeft) || 10;
            const paddingRight = parseFloat(style.paddingRight) || 10;

            // Cria elemento temporario para medir texto
            const measureSpan = document.createElement('span');
            measureSpan.style.cssText = `
                position: absolute;
                visibility: hidden;
                white-space: nowrap;
                font-size: ${style.fontSize};
                font-weight: ${style.fontWeight};
                font-family: ${style.fontFamily};
                letter-spacing: ${style.letterSpacing};
            `;
            measureSpan.textContent = th.textContent.trim();
            document.body.appendChild(measureSpan);

            const textWidth = measureSpan.offsetWidth;
            document.body.removeChild(measureSpan);

            // Largura minima = texto + padding + margem para handle de resize
            this.minWidths[colId] = Math.ceil(textWidth + paddingLeft + paddingRight + 12);
        });
    }

    _mapColumns() {
        const cols = this.colgroup.querySelectorAll('col');
        cols.forEach((col, index) => {
            const colId = col.dataset.colId;
            if (!colId) return;
            // Spacer NAO entra no mapeamento - ela absorve espaco automaticamente
            if (colId === 'spacer') return;
            this.columns.set(colId, {
                element: col,
                index,
                width: this.defaultWidths[colId] || 100,
                isFixed: this.fixedColumns.includes(colId)
            });
        });
    }

    _loadSavedWidths() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const widths = JSON.parse(saved);
                for (const [colId, width] of Object.entries(widths)) {
                    if (this.columns.has(colId)) {
                        this.columns.get(colId).width = width;
                    }
                }
            }
        } catch (e) {
            // Ignora erros de localStorage
        }
    }

    _saveWidths() {
        try {
            const widths = {};
            for (const [colId, data] of this.columns) {
                widths[colId] = data.width;
            }
            localStorage.setItem(this.storageKey, JSON.stringify(widths));
        } catch (e) {
            // Ignora erros de localStorage
        }
    }

    _applyWidths() {
        for (const [colId, data] of this.columns) {
            data.element.style.width = `${data.width}px`;
        }
        this._updateTableWidth();
    }

    // Define largura da tabela: 100% com min-width = soma das colunas
    // Spacer (nao mapeada) absorve espaco extra automaticamente via table-layout: fixed
    _updateTableWidth() {
        let totalWidth = 0;
        for (const [, data] of this.columns) {
            totalWidth += data.width;
        }
        // min-width garante que colunas nao encolhem alem do definido
        // width: 100% permite que spacer absorva espaco extra do container
        this.table.style.minWidth = `${totalWidth}px`;
        this.table.style.width = '100%';
    }

    _createHandles() {
        // Remove handles existentes
        this.table.querySelectorAll('.resize-handle').forEach(h => h.remove());

        const headers = this.table.querySelectorAll('thead th');
        const headersArray = Array.from(headers);

        headersArray.forEach((th, index) => {
            const colId = th.dataset.colId;
            if (!colId || colId === 'spacer') return;

            const colData = this.columns.get(colId);

            // Pula colunas fixas
            if (colData && colData.isFixed) return;

            // Coluna de acoes: handle a esquerda
            if (colId === 'actions') {
                const handle = document.createElement('div');
                handle.className = 'resize-handle resize-handle-left';
                handle.dataset.colId = colId;
                handle.addEventListener('mousedown', (e) => this._startResize(e, colId, true));
                th.appendChild(handle);
                return;
            }

            // Demais colunas: handle a direita
            // Pula se proxima coluna for spacer (nao faz sentido resize antes do gap)
            const nextTh = headersArray[index + 1];
            const nextColId = nextTh?.dataset.colId;
            if (nextColId === 'spacer') return;

            if (colData) {
                const handle = document.createElement('div');
                handle.className = 'resize-handle';
                handle.dataset.colId = colId;
                handle.addEventListener('mousedown', (e) => this._startResize(e, colId));
                th.appendChild(handle);
            }
        });
    }

    _startResize(e, colId, isLeftHandle = false) {
        e.preventDefault();
        e.stopPropagation();

        this.isResizing = true;
        this.currentColId = colId;
        this.startX = e.clientX;
        this.startWidth = this.columns.get(colId).width;
        this.isLeftHandle = isLeftHandle;  // Handle a esquerda inverte a direcao

        document.body.classList.add('resizing-column');
        const handle = e.target;
        handle.classList.add('active');

        document.addEventListener('mousemove', this._onMove);
        document.addEventListener('mouseup', this._onEnd);
    }

    _onMove(e) {
        if (!this.isResizing) return;

        if (this.rafId) cancelAnimationFrame(this.rafId);

        this.rafId = requestAnimationFrame(() => {
            let diff = e.clientX - this.startX;
            // Handle a esquerda: inverte direcao (arrastar esquerda = aumentar)
            if (this.isLeftHandle) diff = -diff;
            // Usa largura minima especifica da coluna (baseada no texto do cabecalho)
            const minWidth = this.minWidths[this.currentColId] || this.minWidthFallback;
            const newWidth = Math.max(minWidth, this.startWidth + diff);
            const colData = this.columns.get(this.currentColId);
            if (colData) {
                colData.width = newWidth;
                colData.element.style.width = `${newWidth}px`;
                // CRITICO: Atualizar largura total da tabela para evitar redistribuicao
                this._updateTableWidth();
            }
        });
    }

    _onEnd() {
        this.isResizing = false;

        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }

        document.body.classList.remove('resizing-column');

        const handle = this.table.querySelector(`.resize-handle[data-col-id="${this.currentColId}"]`);
        if (handle) handle.classList.remove('active');

        document.removeEventListener('mousemove', this._onMove);
        document.removeEventListener('mouseup', this._onEnd);

        this._saveWidths();
        this.currentColId = null;
    }

    reinit() {
        this._createHandles();
    }

    // Metodo para resetar todas as larguras para os valores padrao
    resetWidths() {
        for (const [colId, data] of this.columns) {
            data.width = this.defaultWidths[colId] || 100;
        }
        this._applyWidths();
        this._saveWidths();
    }
}

// ========== REORDENACAO DE COLUNAS (Drag and Drop) ==========
// Classe TableColumnReorder: Permite arrastar colunas para reordenar
class TableColumnReorder {
    constructor(options = {}) {
        this.tableId = options.tableId || 'productsTable';
        this.storageKey = 'marketplace_column_order';
        this.fixedColumns = ['id', 'spacer', 'actions'];  // Colunas que NAO podem ser movidas
        this.draggedColId = null;
        this.draggedIndex = null;

        // Bind methods
        this._onDragStart = this._onDragStart.bind(this);
        this._onDragOver = this._onDragOver.bind(this);
        this._onDragLeave = this._onDragLeave.bind(this);
        this._onDrop = this._onDrop.bind(this);
        this._onDragEnd = this._onDragEnd.bind(this);
    }

    init() {
        this.table = document.getElementById(this.tableId);
        if (!this.table) return;

        this.colgroup = this.table.querySelector('colgroup');
        this.thead = this.table.querySelector('thead');
        if (!this.colgroup || !this.thead) return;

        this._loadSavedOrder();
        this._setupDragListeners();
    }

    _getColumnIds() {
        const cols = this.colgroup.querySelectorAll('col');
        return Array.from(cols).map(col => col.dataset.colId).filter(Boolean);
    }

    _loadSavedOrder() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const savedOrder = JSON.parse(saved);
                this._applyOrder(savedOrder);
            }
        } catch (e) {
            // Ignora erros
        }
    }

    _saveOrder() {
        try {
            const order = this._getColumnIds();
            localStorage.setItem(this.storageKey, JSON.stringify(order));
        } catch (e) {
            // Ignora erros
        }
    }

    _applyOrder(newOrder) {
        const currentOrder = this._getColumnIds();

        // Verifica se a ordem e valida (mesmas colunas)
        if (newOrder.length !== currentOrder.length) return;
        const currentSet = new Set(currentOrder);
        const allMatch = newOrder.every(id => currentSet.has(id));
        if (!allMatch) return;

        // Reordena colgroup
        const colsMap = {};
        this.colgroup.querySelectorAll('col').forEach(col => {
            colsMap[col.dataset.colId] = col;
        });
        newOrder.forEach(colId => {
            if (colsMap[colId]) {
                this.colgroup.appendChild(colsMap[colId]);
            }
        });

        // Reordena thead (usa data-col-id)
        const headerRow = this.thead.querySelector('tr');
        const thsMap = {};
        headerRow.querySelectorAll('th').forEach(th => {
            thsMap[th.dataset.colId] = th;
        });
        newOrder.forEach(colId => {
            if (thsMap[colId]) {
                headerRow.appendChild(thsMap[colId]);
            }
        });

        // Reordena tbody (todas as linhas, usa data-col-id)
        const tbody = this.table.querySelector('tbody');
        if (tbody) {
            tbody.querySelectorAll('tr').forEach(row => {
                const cellsMap = {};
                row.querySelectorAll('td').forEach(td => {
                    cellsMap[td.dataset.colId] = td;
                });
                newOrder.forEach(colId => {
                    if (cellsMap[colId]) {
                        row.appendChild(cellsMap[colId]);
                    }
                });
            });
        }
    }

    _setupDragListeners() {
        const headers = this.thead.querySelectorAll('th');

        headers.forEach((th) => {
            const colId = th.dataset.colId;
            if (!colId || this.fixedColumns.includes(colId)) {
                th.draggable = false;
                return;
            }

            th.draggable = true;

            th.addEventListener('dragstart', this._onDragStart);
            th.addEventListener('dragover', this._onDragOver);
            th.addEventListener('dragleave', this._onDragLeave);
            th.addEventListener('drop', this._onDrop);
            th.addEventListener('dragend', this._onDragEnd);
        });
    }

    _onDragStart(e) {
        const th = e.target.closest('th');
        if (!th) return;

        const colId = th.dataset.colId;
        if (this.fixedColumns.includes(colId)) {
            e.preventDefault();
            return;
        }

        this.draggedColId = colId;
        this.draggedIndex = this._getColumnIds().indexOf(colId);

        th.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', colId);
    }

    _onDragOver(e) {
        e.preventDefault();
        const th = e.target.closest('th');
        if (!th) return;

        const colId = th.dataset.colId;
        if (this.fixedColumns.includes(colId) || colId === this.draggedColId) return;

        e.dataTransfer.dropEffect = 'move';
        th.classList.add('drag-over');
    }

    _onDragLeave(e) {
        const th = e.target.closest('th');
        if (th) {
            th.classList.remove('drag-over');
        }
    }

    _onDrop(e) {
        e.preventDefault();
        const th = e.target.closest('th');
        if (!th) return;

        th.classList.remove('drag-over');

        const targetColId = th.dataset.colId;
        if (this.fixedColumns.includes(targetColId) || targetColId === this.draggedColId) return;

        const currentOrder = this._getColumnIds();
        const fromIndex = currentOrder.indexOf(this.draggedColId);
        const toIndex = currentOrder.indexOf(targetColId);

        if (fromIndex === -1 || toIndex === -1) return;

        // Move a coluna na ordem
        const newOrder = [...currentOrder];
        newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, this.draggedColId);

        this._applyOrder(newOrder);
        this._saveOrder();

        // Reinicializa resize e reorder
        if (tableResizer) {
            tableResizer.init();
        }
        this._setupDragListeners();

        window.showToast?.('Coluna reordenada', 'success');
    }

    _onDragEnd(e) {
        const th = e.target.closest('th');
        if (th) {
            th.classList.remove('dragging');
        }

        // Remove classe drag-over de todos
        this.thead.querySelectorAll('th').forEach(h => {
            h.classList.remove('drag-over');
        });

        this.draggedColId = null;
        this.draggedIndex = null;
    }

    reinit() {
        this._setupDragListeners();
    }
}

// Instancias globais
let tableResizer = null;
let tableReorder = null;

// Funcao de inicializacao das colunas (resize + reorder)
function setupColumnResize() {
    // Resizer
    if (!tableResizer) {
        tableResizer = new TableColumnResizer();
    }
    tableResizer.init();

    // Reorder (drag and drop)
    if (!tableReorder) {
        tableReorder = new TableColumnReorder();
    }
    tableReorder.init();
}

// Reinicializa apos renderizar produtos
function reinitColumnResize() {
    if (tableResizer) {
        tableResizer.reinit();
    }
    if (tableReorder) {
        tableReorder.reinit();
    }
    if (!tableResizer && !tableReorder) {
        setupColumnResize();
    }
}

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
    window.currentFilters = {
        search: '',
        saleType: '',
        material: ''
    };

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
        if (window.currentFilters.search) {
            const search = window.currentFilters.search;
            const matchName = product.name?.toLowerCase().includes(search);
            const matchDescription = product.description?.toLowerCase().includes(search);
            const matchId = String(product.productId).includes(search);
            const matchSku = product.sku?.toLowerCase().includes(search);
            const matchMlb = product.mlbId?.toLowerCase().includes(search);

            if (!matchName && !matchDescription && !matchId && !matchSku && !matchMlb) {
                return false;
            }
        }

        if (window.currentFilters.saleType && product.saleType !== window.currentFilters.saleType) {
            return false;
        }

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
            <td data-col-id="id" class="sticky-col col-id">
                <strong>${String(product.productId || 0).padStart(3, '0')}</strong>
            </td>
            <td data-col-id="name" class="col-name">
                ${escapeHtml(product.name || '-')}
            </td>
            <td data-col-id="price" class="col-price">
                ${product.price ? 'R$ ' + formatPrice(product.price) : '-'}
            </td>
            <td data-col-id="type">
                ${getSaleTypeBadge(product.saleType, product.quantity)}
            </td>
            <td data-col-id="description" class="col-description">
                ${getDescriptionPreview(product)}
            </td>
            <td data-col-id="machines">${formatPrinterNames(product.printerMachines, product.printerMachine)}</td>
            <td data-col-id="material" class="col-material">${getMaterialCell(product)}</td>
            <td data-col-id="dimensions">${formatDimensions(product.dimensions)}</td>
            <td data-col-id="packaging">${formatDimensions(product.packagingDimensions)}</td>
            <td data-col-id="weight">${product.weight ? product.weight + 'g' : '-'}</td>
            <td data-col-id="gcode" class="col-gcode">
                ${getGcodeColumnDisplay(product)}
            </td>
            <td data-col-id="spacer" class="col-spacer"></td>
            <td data-col-id="actions" class="col-actions">
                <div class="actions-cell">
                    <button class="btn-icon" data-action="edit-product" data-id="${escapeHtml(product.id)}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${getMlLinkButton(product)}
                    <button class="btn-icon btn-danger" data-action="delete-product" data-id="${escapeHtml(product.id)}" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // Reinicializa handles de redimensionamento
    reinitColumnResize();
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
            <i class="fas fa-link"></i> ${product.mlbId}
        </span>`;
    }
    return '<span class="badge badge-ml-unlinked"><i class="fas fa-unlink"></i> -</span>';
}

function getMlLinkButton(product) {
    if (product.mlbId) {
        // Produto vinculado - mostrar botao para desvincular (SEGURANCA: data-action)
        return `<button class="btn-icon btn-ml-linked" data-action="unlink-mlb" data-id="${escapeHtml(product.id)}" title="Desvincular do ML">
            <i class="fas fa-unlink"></i>
        </button>`;
    }
    // Produto nao vinculado - mostrar botao para vincular (SEGURANCA: data-action)
    return `<button class="btn-icon btn-ml-link" data-action="open-link-mlb" data-id="${escapeHtml(product.id)}" title="Vincular ao ML">
        <i class="fas fa-link"></i>
    </button>`;
}

function getSaleTypeBadge(saleType, quantity) {
    if (!saleType) return '-';

    if (saleType === 'estoque') {
        // Mostrar apenas a quantidade para produtos de estoque
        const qty = quantity || 0;
        return `<span class="quantity-display">${qty} un</span>`;
    } else if (saleType === 'personalizacao') {
        return '<span class="badge badge-personalizacao"><i class="fas fa-palette"></i> Personaliz.</span>';
    }

    return escapeHtml(saleType);
}

// ========== COLUNA MATERIAL COM BOTAO DETALHES ==========
function getMaterialCell(product) {
    const material = product.materialType || '';
    if (!material) return '-';

    // Se tem estimativas, mostrar botao de detalhes
    const hasDetails = product.printColor || product.printTimeEstimate || product.materialEstimate;

    if (hasDetails) {
        // SEGURANCA: Usar data-action ao inves de onclick inline
        return `
            <div class="material-cell">
                <span class="material-name">${escapeHtml(material)}</span>
                <button class="btn-material-details" data-action="show-material-details" data-id="${escapeHtml(product.id)}" title="Ver detalhes">
                    <i class="fas fa-info-circle"></i>
                </button>
            </div>
        `;
    }

    return `<span class="material-name">${escapeHtml(material)}</span>`;
}

function showMaterialDetails(productId) {
    const product = window.products.find(p => p.id === productId);
    if (!product) {
        window.showToast('Produto nao encontrado', 'error');
        return;
    }

    const modal = document.getElementById('materialDetailsModal');
    const content = document.getElementById('materialDetailsContent');

    if (!modal || !content) return;

    content.innerHTML = `
        <div class="detail-card">
            <div class="detail-icon"><i class="fas fa-cube"></i></div>
            <span class="detail-label">Material</span>
            <span class="detail-value">${escapeHtml(product.materialType) || '-'}</span>
        </div>
        <div class="detail-card">
            <div class="detail-icon"><i class="fas fa-palette"></i></div>
            <span class="detail-label">Cor</span>
            <span class="detail-value">${escapeHtml(product.printColor) || '-'}</span>
        </div>
        <div class="detail-card">
            <div class="detail-icon"><i class="fas fa-clock"></i></div>
            <span class="detail-label">Tempo</span>
            <span class="detail-value">${product.printTimeEstimate ? product.printTimeEstimate + 'h' : '-'}</span>
        </div>
        <div class="detail-card">
            <div class="detail-icon"><i class="fas fa-weight-hanging"></i></div>
            <span class="detail-label">Material</span>
            <span class="detail-value">${product.materialEstimate ? product.materialEstimate + 'g' : '-'}</span>
        </div>
    `;

    modal.classList.add('active');
}

function closeMaterialDetailsModal() {
    const modal = document.getElementById('materialDetailsModal');
    if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }
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

// Formatar preco com 2 casas decimais
function formatPrice(price) {
    return parseFloat(price).toFixed(2).replace('.', ',');
}

// Preview da descricao com botao de copiar
function getDescriptionPreview(product) {
    const description = product.description || '';
    const hasDraft = !!(product.pendingDescription);

    if (!description && !hasDraft) return '<span class="text-muted">-</span>';

    const maxLength = 40;
    const preview = description.length > maxLength
        ? description.substring(0, maxLength) + '...'
        : description || '(vazio)';

    // SEGURANCA: Usar data-action ao inves de onclick inline
    return `
        <div class="description-cell">
            <span class="description-preview" title="${escapeHtml(description)}">${escapeHtml(preview)}</span>
            <button class="btn-desc-editor" data-action="open-desc-editor" data-id="${escapeHtml(product.id)}" title="Editar descricao">
                <i class="fas fa-edit"></i>
            </button>
        </div>
    `;
}

// ========== MODAL EDITOR DE DESCRICAO ==========
let descriptionEditorProductId = null;
let descriptionEditorOriginalValues = null;

function openDescriptionEditor(productId) {
    const product = window.products.find(p => p.id === productId);
    if (!product) {
        window.showToast('Produto nao encontrado', 'error');
        return;
    }

    descriptionEditorProductId = productId;
    descriptionEditorOriginalValues = {
        description: product.description || '',
        pendingDescription: product.pendingDescription || '',
        mlbId: product.mlbId || null
    };

    const modal = document.getElementById('descriptionEditorModal');
    const productNameEl = document.getElementById('descEditorProductName');
    const draftTextarea = document.getElementById('descEditorDraft');
    const publishedTextarea = document.getElementById('descEditorPublished');
    const mlBadge = document.getElementById('descEditorMlBadge');

    if (!modal) return;

    // Preencher nome do produto
    if (productNameEl) {
        productNameEl.textContent = product.name || 'Produto';
    }

    // Preencher textareas
    if (draftTextarea) {
        draftTextarea.value = product.pendingDescription || '';
        updateCharCount('draftCharCount', draftTextarea.value.length);
    }

    if (publishedTextarea) {
        publishedTextarea.value = product.description || '';
        updateCharCount('publishedCharCount', publishedTextarea.value.length);
    }

    // Mostrar badge ML se vinculado
    if (mlBadge) {
        mlBadge.style.display = product.mlbId ? 'inline-flex' : 'none';
    }

    // Setup listeners para contador de caracteres
    draftTextarea?.addEventListener('input', () => updateCharCount('draftCharCount', draftTextarea.value.length));
    publishedTextarea?.addEventListener('input', () => updateCharCount('publishedCharCount', publishedTextarea.value.length));

    modal.classList.add('active');
}

function closeDescriptionEditorModal() {
    const modal = document.getElementById('descriptionEditorModal');
    if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }
    descriptionEditorProductId = null;
    descriptionEditorOriginalValues = null;
}

function updateCharCount(elementId, count) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = `${count} caracteres`;
    }
}

function copyDraftToPublished() {
    const draftTextarea = document.getElementById('descEditorDraft');
    const publishedTextarea = document.getElementById('descEditorPublished');

    if (draftTextarea && publishedTextarea) {
        publishedTextarea.value = draftTextarea.value;
        updateCharCount('publishedCharCount', publishedTextarea.value.length);

        // Efeito visual
        publishedTextarea.style.background = 'rgba(139, 92, 246, 0.2)';
        setTimeout(() => {
            publishedTextarea.style.background = '';
        }, 300);

        window.showToast('Rascunho copiado para o anuncio', 'success');
    }
}

function copyPublishedToDraft() {
    const draftTextarea = document.getElementById('descEditorDraft');
    const publishedTextarea = document.getElementById('descEditorPublished');

    if (draftTextarea && publishedTextarea) {
        draftTextarea.value = publishedTextarea.value;
        updateCharCount('draftCharCount', draftTextarea.value.length);

        // Efeito visual
        draftTextarea.style.background = 'rgba(0, 212, 255, 0.2)';
        setTimeout(() => {
            draftTextarea.style.background = '';
        }, 300);

        window.showToast('Descricao salva como rascunho', 'success');
    }
}

function swapDescriptions() {
    const draftTextarea = document.getElementById('descEditorDraft');
    const publishedTextarea = document.getElementById('descEditorPublished');

    if (draftTextarea && publishedTextarea) {
        const temp = draftTextarea.value;
        draftTextarea.value = publishedTextarea.value;
        publishedTextarea.value = temp;

        updateCharCount('draftCharCount', draftTextarea.value.length);
        updateCharCount('publishedCharCount', publishedTextarea.value.length);

        window.showToast('Descricoes trocadas', 'info');
    }
}

async function syncDescriptionFromEditor() {
    if (!descriptionEditorProductId) {
        window.showToast('Produto nao identificado', 'error');
        return;
    }

    const draftTextarea = document.getElementById('descEditorDraft');
    const publishedTextarea = document.getElementById('descEditorPublished');
    const btnSync = document.getElementById('btnSyncDescription');

    const newDraft = draftTextarea?.value.trim() || '';
    const newDescription = publishedTextarea?.value.trim() || '';

    // Verificar se houve mudancas
    const draftChanged = newDraft !== descriptionEditorOriginalValues.pendingDescription;
    const descriptionChanged = newDescription !== descriptionEditorOriginalValues.description;

    if (!draftChanged && !descriptionChanged) {
        window.showToast('Nenhuma alteracao para salvar', 'info');
        return;
    }

    // Desabilitar botao durante o processo
    if (btnSync) {
        btnSync.disabled = true;
        btnSync.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
    }

    try {
        window.showLoading();

        // Salvar no Firebase
        const updateData = {
            pendingDescription: newDraft,
            description: newDescription,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await window.db.collection('products').doc(descriptionEditorProductId).update(updateData);

        // Sincronizar com ML se vinculado e descricao mudou
        if (descriptionChanged && descriptionEditorOriginalValues.mlbId) {
            if (window.isMlConnected && window.isMlConnected() && window.syncDescriptionToMl) {
                await window.syncDescriptionToMl(descriptionEditorOriginalValues.mlbId, newDescription);
            }
        }

        window.showToast('Descricao salva com sucesso!', 'success');

        // Recarregar produtos
        if (typeof window.loadProducts === 'function') {
            await window.loadProducts();
        }

        closeDescriptionEditorModal();

    } catch (error) {
        window.logger?.error('Erro ao salvar descricao:', error);
        window.showToast('Erro ao salvar descricao', 'error');
    } finally {
        window.hideLoading();
        if (btnSync) {
            btnSync.disabled = false;
            btnSync.innerHTML = '<i class="fas fa-sync-alt"></i> Salvar e Sincronizar';
        }
    }
}

// Copiar descricao para clipboard (funcao legada mantida)
function copyDescription(productId) {
    const product = window.products.find(p => p.id === productId);
    if (!product || !product.description) {
        window.showToast('Sem descricao para copiar', 'warning');
        return;
    }

    navigator.clipboard.writeText(product.description).then(() => {
        window.showToast('Descricao copiada!', 'success');
    }).catch(err => {
        window.logger?.error('Erro ao copiar:', err);
        window.showToast('Erro ao copiar', 'error');
    });
}

// Formatar nomes das impressoras (apenas abreviacoes: K2, S2, K1M, etc)
function formatPrinterNames(printerMachines, printerMachine) {
    let printers = [];
    if (Array.isArray(printerMachines) && printerMachines.length > 0) {
        printers = printerMachines;
    } else if (printerMachine) {
        printers = [printerMachine];
    }

    if (printers.length === 0) return '-';

    // Extrair apenas a abreviacao (K2, S2, K1M, K1, A1, P1S, X1C, etc)
    const abbreviations = printers.map(p => {
        if (!p) return '';
        // Se ja for uma abreviacao curta (menos de 5 chars), retorna como esta
        if (p.length <= 4) return p;
        // Extrai a parte final apos espaco (ex: "Bambu Lab K2" -> "K2")
        const parts = p.trim().split(/\s+/);
        return parts[parts.length - 1];
    }).filter(Boolean);

    return `<span class="printers-list">${abbreviations.map(p => escapeHtml(p)).join(', ')}</span>`;
}

// Manter funcao antiga para compatibilidade (deprecated)
function formatPrinters(printerMachines, printerMachine) {
    return formatPrinterNames(printerMachines, printerMachine);
}

// ========== FUNCOES DE MIDIA (Fotos ML + Video YouTube) ==========
function renderMlPhotos(photos) {
    // CORRIGIDO: Usar IDs corretos do HTML (photosGrid, nao mlPhotosGrid)
    const grid = document.getElementById('photosGrid');
    const empty = document.getElementById('photosEmpty');

    if (!grid) return;

    if (!photos || photos.length === 0) {
        grid.innerHTML = '';
        if (empty) {
            empty.style.display = 'flex';
            grid.appendChild(empty);
        }
        return;
    }

    if (empty) empty.style.display = 'none';

    // SEGURANCA: Usar data-action ao inves de onclick inline
    grid.innerHTML = photos.map((url, index) => `
        <div class="ml-photo-item ${index === 0 ? 'main-photo' : ''}" data-action="open-photo" data-url="${escapeHtml(url)}">
            <img src="${escapeHtml(url)}" alt="Foto ${index + 1}" data-fallback="true">
            <span class="photo-badge">${index === 0 ? 'Principal' : index + 1}</span>
        </div>
    `).join('');

    // SEGURANCA: Event handlers para imagens com erro
    grid.querySelectorAll('img[data-fallback]').forEach(img => {
        img.onerror = function() {
            this.parentElement.style.display = 'none';
        };
    });
}

function openPhotoFullscreen(url) {
    window.open(url, '_blank');
}

function updateYoutubePreview(url) {
    const preview = document.getElementById('youtubePreview');
    const iframe = document.getElementById('youtubeIframe');

    if (!preview || !iframe) return;

    const videoId = extractYoutubeVideoId(url);

    if (videoId) {
        iframe.src = `https://www.youtube.com/embed/${videoId}`;
        preview.classList.remove('hidden');
    } else {
        iframe.src = '';
        preview.classList.add('hidden');
    }
}

function extractYoutubeVideoId(url) {
    if (!url) return null;

    // Patterns: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
    const patterns = [
        /(?:youtube\.com\/watch\?v=)([^&\n]+)/,
        /(?:youtu\.be\/)([^?\n]+)/,
        /(?:youtube\.com\/embed\/)([^?\n]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }

    return null;
}

// Listener para preview do YouTube ao digitar
document.addEventListener('DOMContentLoaded', () => {
    const youtubeInput = document.getElementById('youtubeVideoUrl');
    if (youtubeInput) {
        youtubeInput.addEventListener('input', (e) => {
            updateYoutubePreview(e.target.value);
        });
    }
});

// ========== VALORES ORIGINAIS DO ML (para comparar ao salvar) ==========
window.mlOriginalValues = null;
window.currentProductHasMlb = false;  // Flag para saber se produto atual tem vinculo ML

// ========== AVISO DE TITULO DE CATALOGO ==========
let catalogWarningShown = false;  // Evitar multiplos toasts

function showCatalogTitleWarning() {
    if (!catalogWarningShown) {
        catalogWarningShown = true;
        window.showToast('O titulo so pode ser editado no Mercado Livre', 'warning');

        // Reset apos 3 segundos para permitir novo aviso
        setTimeout(() => {
            catalogWarningShown = false;
        }, 3000);
    }
}

// ========== MODAL DE ESCOLHA NOVO PRODUTO ==========
function openNewProductChoiceModal() {
    const modal = document.getElementById('newProductChoiceModal');
    const choiceOptions = document.getElementById('choiceOptions');
    const mlImportSection = document.getElementById('mlImportSection');

    if (!modal) return;

    // Reset para estado inicial
    if (choiceOptions) choiceOptions.classList.remove('hidden');
    if (mlImportSection) mlImportSection.classList.add('hidden');

    modal.classList.add('active');
}

function closeNewProductChoiceModal() {
    const modal = document.getElementById('newProductChoiceModal');
    if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }
}

function createBlankProduct() {
    closeNewProductChoiceModal();
    openProductModal(null);  // Abrir modal vazio
}

async function showMlImportList() {
    const choiceOptions = document.getElementById('choiceOptions');
    const mlImportSection = document.getElementById('mlImportSection');
    const loadingEl = document.getElementById('mlImportLoading');
    const emptyEl = document.getElementById('mlImportEmpty');
    const listEl = document.getElementById('mlImportList');

    // Mostrar secao de importacao
    if (choiceOptions) choiceOptions.classList.add('hidden');
    if (mlImportSection) mlImportSection.classList.remove('hidden');
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');
    if (listEl) listEl.innerHTML = '';

    // Verificar se ML esta conectado
    if (!window.isMlConnected || !window.isMlConnected()) {
        if (loadingEl) loadingEl.classList.add('hidden');
        if (emptyEl) {
            emptyEl.classList.remove('hidden');
            emptyEl.innerHTML = `
                <i class="fas fa-plug"></i>
                <span>Conecte ao Mercado Livre primeiro</span>
            `;
        }
        return;
    }

    try {
        // Buscar anuncios do ML
        const response = await fetch(`${window.ML_FUNCTIONS_URL || 'https://us-central1-imaginatech-servicos.cloudfunctions.net'}/mlListItems`);

        // CRITICO: Validar response antes de parse JSON
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (loadingEl) loadingEl.classList.add('hidden');

        if (data.items && data.items.length > 0) {
            // Filtrar anuncios nao vinculados
            const linkedMlbIds = new Set(
                (window.products || [])
                    .filter(p => p.mlbId)
                    .map(p => p.mlbId)
            );

            const unlinkedItems = data.items.filter(item => !linkedMlbIds.has(item.id));

            if (unlinkedItems.length === 0) {
                if (emptyEl) {
                    emptyEl.classList.remove('hidden');
                    emptyEl.innerHTML = `
                        <i class="fas fa-check-circle"></i>
                        <span>Todos os anuncios ja estao vinculados!</span>
                    `;
                }
                return;
            }

            // Renderizar lista (SEGURANCA: data-action ao inves de onclick)
            if (listEl) {
                listEl.innerHTML = unlinkedItems.map(item => `
                    <div class="ml-import-item" data-action="import-from-ml" data-mlb-id="${escapeHtml(item.id)}">
                        <div class="ml-import-thumb">
                            ${item.thumbnail ? `<img src="${escapeHtml(item.thumbnail.replace(/^http:\/\//i, 'https://'))}" alt="">` : '<i class="fas fa-box"></i>'}
                        </div>
                        <div class="ml-import-info">
                            <div class="ml-import-title">${escapeHtml(item.title || 'Sem titulo')}</div>
                            <div class="ml-import-meta">
                                <span class="ml-import-id">${escapeHtml(item.id)}</span>
                                <span class="ml-import-price">R$ ${(item.price || 0).toFixed(2)}</span>
                            </div>
                        </div>
                        <div class="ml-import-arrow">
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </div>
                `).join('');
            }
        } else {
            if (emptyEl) {
                emptyEl.classList.remove('hidden');
                emptyEl.innerHTML = `
                    <i class="fas fa-inbox"></i>
                    <span>Nenhum anuncio encontrado</span>
                `;
            }
        }
    } catch (error) {
        window.logger?.error('[ML] Erro ao buscar anuncios:', error);
        if (loadingEl) loadingEl.classList.add('hidden');
        if (emptyEl) {
            emptyEl.classList.remove('hidden');
            emptyEl.innerHTML = `
                <i class="fas fa-exclamation-circle"></i>
                <span>Erro ao carregar anuncios</span>
            `;
        }
    }
}

function hideMlImportList() {
    const choiceOptions = document.getElementById('choiceOptions');
    const mlImportSection = document.getElementById('mlImportSection');

    if (choiceOptions) choiceOptions.classList.remove('hidden');
    if (mlImportSection) mlImportSection.classList.add('hidden');
}

async function importFromMl(mlbId) {
    closeNewProductChoiceModal();
    window.showLoading();

    try {
        // Buscar detalhes completos do anuncio
        const response = await fetch(`${window.ML_FUNCTIONS_URL || 'https://us-central1-imaginatech-servicos.cloudfunctions.net'}/mlGetItemDetails?mlbId=${mlbId}`);

        // CRITICO: Validar response antes de parse JSON
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.success || !data.item) {
            throw new Error(data.error || 'Erro ao buscar dados do anuncio');
        }

        const mlItem = data.item;

        // Criar produto no Firebase com vinculo automatico
        const newProductData = {
            name: mlItem.title || '',
            description: mlItem.description || '',
            price: mlItem.price || 0,
            quantity: mlItem.availableQuantity || 1,
            saleType: 'estoque',
            mlbId: mlbId,  // Vinculo automatico
            mlLinkedAt: firebase.firestore.FieldValue.serverTimestamp(),
            mlPhotos: mlItem.pictures ? mlItem.pictures.map(p => (p.url || p.secure_url || '').replace(/^http:\/\//i, 'https://')) : [],
            mlPhotosWithIds: mlItem.pictures ? mlItem.pictures.map(p => ({
                id: p.id,
                url: (p.url || p.secure_url || '').replace(/^http:\/\//i, 'https://')
            })) : [],
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Buscar proximo productId disponivel (usa funcao de marketplace-data.js)
        const nextId = window.getNextProductId();
        newProductData.productId = nextId;

        // Salvar no Firebase
        const docRef = await window.db.collection('products').add(newProductData);
        window.logger?.log('[ML Import] Produto criado:', docRef.id);

        window.hideLoading();
        window.showToast('Produto importado e vinculado ao ML!', 'success');

        // Recarregar produtos e abrir modal para edicao
        await window.loadProducts();
        openProductModal(docRef.id);

    } catch (error) {
        window.logger?.error('[ML Import] Erro:', error);
        window.hideLoading();
        window.showToast('Erro ao importar do ML: ' + error.message, 'error');
    }
}

// NOTA: getNextProductId() esta definida em marketplace-data.js
// e exportada para window.getNextProductId
// Usa window.products (tempo real) para encontrar primeiro ID vago

// ========== MODAL DE PRODUTO ==========
async function openProductModal(productId = null) {
    window.editingProductId = productId;

    // Iniciar contexto isolado para este produto (resolve race condition)
    productEditContext.startEditing(productId);

    // Reset estado via contexto (automaticamente isolado por produto)
    productEditContext.mlOriginalValues = null;
    productEditContext.editingPhotos = [];
    productEditContext.originalMlPhotos = [];
    productEditContext.hasMlb = false;

    const modal = document.getElementById('productModal');
    const form = document.getElementById('productForm');
    const modalTitle = document.getElementById('productModalTitle');
    const syncOverlay = document.getElementById('syncOverlay');

    if (!modal || !form) return;

    // Esconder overlay de sincronizacao
    if (syncOverlay) syncOverlay.classList.add('hidden');

    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');

    if (productId) {
        const product = window.products.find(p => p.id === productId);
        if (!product) {
            window.showToast('Produto nao encontrado', 'error');
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            return;
        }

        // Definir flag de vinculo ML
        window.currentProductHasMlb = !!product.mlbId;

        if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Produto';
        form.reset();

        // Inicializar array de fotos com fotos locais existentes
        if (product.localPhotos && product.localPhotos.length > 0) {
            product.localPhotos.forEach(photo => {
                window.editingPhotos.push({ type: 'local', url: photo.url, name: photo.name || 'foto' });
            });
        }

        // Adicionar fotos do ML se existirem (no inicio) - com IDs se disponiveis
        if (product.mlPhotos && product.mlPhotos.length > 0) {
            // Tentar usar mlPhotosWithIds se existir
            const mlPhotosWithIds = product.mlPhotosWithIds || product.mlPhotos.map(url => ({ id: null, url }));

            const mlPhotoObjects = mlPhotosWithIds.map(p => ({
                type: 'ml',
                id: p.id || null,
                url: typeof p === 'string' ? p : p.url
            }));
            window.editingPhotos = [...mlPhotoObjects, ...window.editingPhotos];

            // Guardar fotos originais para comparacao
            window.originalMlPhotos = mlPhotosWithIds.map(p => ({
                id: p.id || null,
                url: typeof p === 'string' ? p : p.url
            }));
        }

        // Se produto vinculado ao ML e conectado, buscar dados atualizados
        if (product.mlbId && window.isMlConnected && window.isMlConnected()) {
            await syncFromMl(product);
        } else {
            populateFormWithProduct(product);
            renderPhotosGrid(window.editingPhotos);
        }

    } else {
        if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-box"></i> Novo Produto';
        form.reset();
        document.getElementById('productIdField').value = 'Auto (1-200)';

        if (window.clearSelectedPrinters) {
            window.clearSelectedPrinters();
        }

        // Limpar midia
        window.editingPhotos = [];
        renderPhotosGrid([]);
        updateYoutubePreview('');

        // Limpar gerenciador de GCODE
        resetGcodeManager();
    }
}

// ========== SINCRONIZAR DADOS DO ML PARA O FORMULARIO ==========
async function syncFromMl(product) {
    const syncOverlay = document.getElementById('syncOverlay');
    const syncProgressBar = document.getElementById('syncProgressBar');

    // Mostrar overlay de sincronizacao
    if (syncOverlay) {
        syncOverlay.classList.remove('hidden');
        if (syncProgressBar) syncProgressBar.style.width = '10%';
    }

    // Preencher formulario com dados locais primeiro
    populateFormWithProduct(product);
    if (syncProgressBar) syncProgressBar.style.width = '30%';

    // Inicializar array de fotos com fotos locais existentes
    window.editingPhotos = [];
    if (product.localPhotos && product.localPhotos.length > 0) {
        product.localPhotos.forEach(photo => {
            window.editingPhotos.push({ type: 'local', url: photo.url, name: photo.name || 'foto' });
        });
    }

    try {
        // Buscar dados atualizados do ML
        if (syncProgressBar) syncProgressBar.style.width = '50%';
        const response = await fetch(`${window.ML_FUNCTIONS_URL || 'https://us-central1-imaginatech-servicos.cloudfunctions.net'}/mlGetItemDetails?mlbId=${product.mlbId}`);

        // CRITICO: Validar response antes de parse JSON
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (syncProgressBar) syncProgressBar.style.width = '70%';

        if (data.success && data.item) {
            const mlItem = data.item;

            // Guardar valores originais do ML para comparar ao salvar
            window.mlOriginalValues = {
                price: mlItem.price,
                stock: mlItem.availableQuantity,
                description: mlItem.description || '',
                title: mlItem.title || '',
                isCatalogItem: mlItem.isCatalogItem || false
            };

            // Atualizar nome do formulario com valor do ML
            const nameInput = document.getElementById('productName');
            if (nameInput && mlItem.title) {
                nameInput.value = mlItem.title;
                nameInput.classList.add('ml-synced-field');

                // Se for item de catalogo, bloquear edicao do nome
                if (mlItem.isCatalogItem) {
                    nameInput.readOnly = true;
                    nameInput.classList.add('ml-catalog-locked');
                    nameInput.title = 'Titulo gerenciado pelo catalogo do Mercado Livre';

                    // Adicionar listener para mostrar toast ao clicar
                    nameInput.addEventListener('click', showCatalogTitleWarning);
                    nameInput.addEventListener('focus', showCatalogTitleWarning);
                    window.logger?.log('[ML] Nome bloqueado - item de catalogo');
                } else {
                    nameInput.readOnly = false;
                    nameInput.classList.remove('ml-catalog-locked');
                    nameInput.removeEventListener('click', showCatalogTitleWarning);
                    nameInput.removeEventListener('focus', showCatalogTitleWarning);
                }

                window.logger?.log('[ML] Nome atualizado do ML');
            }

            // Atualizar descricao do formulario com valor do ML (sempre prioriza ML)
            const descriptionInput = document.getElementById('productDescription');
            if (descriptionInput && mlItem.description) {
                descriptionInput.value = mlItem.description;
                window.logger?.log('[ML] Descricao atualizada do ML');
            }

            // Atualizar fotos do ML (sincronizacao de volta)
            if (mlItem.pictures && mlItem.pictures.length > 0) {
                // Guardar fotos originais do ML com IDs para comparacao ao salvar
                window.originalMlPhotos = mlItem.pictures.map(pic => ({
                    id: pic.id,
                    url: (pic.url || pic.secure_url || '').replace(/^http:\/\//i, 'https://')
                }));

                const mlPhotos = window.originalMlPhotos.map(p => p.url);

                // Adicionar fotos do ML no INICIO do array (prioridade) - COM ID
                const mlPhotoObjects = window.originalMlPhotos.map(p => ({
                    type: 'ml',
                    id: p.id,
                    url: p.url
                }));
                window.editingPhotos = [...mlPhotoObjects, ...window.editingPhotos.filter(p => p.type === 'local')];

                // Atualizar no Firestore se as fotos mudaram
                if (JSON.stringify(mlPhotos) !== JSON.stringify(product.mlPhotos || [])) {
                    await window.db.collection('products').doc(product.id).update({
                        mlPhotos: mlPhotos,
                        mlPhotosWithIds: window.originalMlPhotos  // Salvar com IDs para sync futuro
                    });
                    window.logger?.log('[ML] Fotos atualizadas do ML:', mlPhotos.length);
                }

                window.logger?.log('[ML] Fotos originais salvas para comparacao:', window.originalMlPhotos.length);
            } else {
                // ML nao tem fotos - limpar TODAS as fotos (locais ja foram sincronizadas anteriormente)
                window.originalMlPhotos = [];
                window.editingPhotos = [];  // Limpar tudo - se ML nao tem, nao devemos mostrar

                // Atualizar Firestore - limpar mlPhotos e localPhotos
                const updates = {};
                if (product.mlPhotos && product.mlPhotos.length > 0) {
                    updates.mlPhotos = [];
                    updates.mlPhotosWithIds = [];
                }
                if (product.localPhotos && product.localPhotos.length > 0) {
                    updates.localPhotos = [];  // Fotos locais ja foram pro ML e foram deletadas la
                }
                if (Object.keys(updates).length > 0) {
                    await window.db.collection('products').doc(product.id).update(updates);
                    window.logger?.log('[ML] Fotos removidas - Firestore limpo (mlPhotos e localPhotos)');
                }
            }

            if (syncProgressBar) syncProgressBar.style.width = '85%';

            // Atualizar preco e estoque se diferentes (ML -> Local)
            const priceInput = document.getElementById('productPrice');
            const quantityInput = document.getElementById('productQuantity');

            if (priceInput && mlItem.price && mlItem.price !== product.price) {
                priceInput.value = mlItem.price;
                window.logger?.log('[ML] Preco atualizado do ML:', mlItem.price);
            }

            if (quantityInput && mlItem.availableQuantity !== undefined && mlItem.availableQuantity !== product.quantity) {
                quantityInput.value = mlItem.availableQuantity;
                window.logger?.log('[ML] Estoque atualizado do ML:', mlItem.availableQuantity);
            }

            if (syncProgressBar) syncProgressBar.style.width = '100%';

            // Esconder overlay com delay para animacao
            setTimeout(() => {
                if (syncOverlay) syncOverlay.classList.add('hidden');
            }, 300);

            window.showToast('Dados sincronizados do ML', 'success');
        } else {
            // Fallback para fotos salvas localmente
            if (product.mlPhotos && product.mlPhotos.length > 0) {
                // Usar mlPhotosWithIds se existir, senao criar sem IDs
                const mlPhotosWithIds = product.mlPhotosWithIds || product.mlPhotos.map(url => ({ id: null, url }));
                window.originalMlPhotos = mlPhotosWithIds;

                const mlPhotoObjects = mlPhotosWithIds.map(p => ({
                    type: 'ml',
                    id: p.id || null,
                    url: typeof p === 'string' ? p : p.url
                }));
                window.editingPhotos = [...mlPhotoObjects, ...window.editingPhotos.filter(p => p.type === 'local')];
            }

            if (syncProgressBar) syncProgressBar.style.width = '100%';
            setTimeout(() => {
                if (syncOverlay) syncOverlay.classList.add('hidden');
            }, 300);
        }
    } catch (error) {
        window.logger?.error('[ML] Erro ao sincronizar do ML:', error);

        // Fallback para fotos salvas localmente
        if (product.mlPhotos && product.mlPhotos.length > 0) {
            const mlPhotosWithIds = product.mlPhotosWithIds || product.mlPhotos.map(url => ({ id: null, url }));
            window.originalMlPhotos = mlPhotosWithIds;

            const mlPhotoObjects = mlPhotosWithIds.map(p => ({
                type: 'ml',
                id: p.id || null,
                url: typeof p === 'string' ? p : p.url
            }));
            window.editingPhotos = [...mlPhotoObjects, ...window.editingPhotos.filter(p => p.type === 'local')];
        }

        if (syncOverlay) syncOverlay.classList.add('hidden');
    }

    // Renderizar grid de fotos
    renderPhotosGrid(window.editingPhotos);
}

function populateFormWithProduct(product) {
    function setFieldValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    function setSelectValue(id, value, delay = 0) {
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) {
                el.value = value || '';
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, delay);
    }

    // Campos de texto
    setFieldValue('productIdField', String(product.productId || 0).padStart(3, '0'));
    setFieldValue('productName', product.name || '');
    setFieldValue('productDescription', product.description || '');
    setFieldValue('productSku', product.sku || '');
    setFieldValue('productGtin', product.gtin || '');

    // Dimensoes
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

    // Dropdowns
    setSelectValue('saleType', product.saleType, 10);
    setSelectValue('materialType', product.materialType, 20);
    setSelectValue('printColor', product.printColor, 30);

    // Impressoras
    setTimeout(() => {
        if (window.setSelectedPrinters) {
            const printers = product.printerMachines || (product.printerMachine ? [product.printerMachine] : []);
            window.setSelectedPrinters(printers);
        }
    }, 50);

    // Preco e quantidade
    setFieldValue('productPrice', product.price || '');
    setFieldValue('productQuantity', product.quantity || 1);

    // MLB ID (somente leitura se tiver)
    const mlbField = document.getElementById('productMlbId');
    if (mlbField) {
        mlbField.value = product.mlbId || '';
    }

    // Fotos do ML
    renderMlPhotos(product.mlPhotos || []);

    // Video YouTube
    setFieldValue('youtubeVideoUrl', product.youtubeVideoUrl || '');
    updateYoutubePreview(product.youtubeVideoUrl || '');

    // Descricao Pendente (nao sincroniza com ML)
    setFieldValue('pendingDescription', product.pendingDescription || '');

    // Estimativas de impressao (campos locais)
    setFieldValue('printTimeEstimate', product.printTimeEstimate || '');
    setFieldValue('materialEstimate', product.materialEstimate || '');

    // Auto-resize textareas apos carregar conteudo
    setTimeout(() => {
        triggerAutoResize(document.getElementById('productDescription'));
        triggerAutoResize(document.getElementById('pendingDescription'));
    }, 50);

    // Carregar GCODEs existentes
    loadGcodesForEdit(product);
}

function closeProductModal() {
    const modal = document.getElementById('productModal');
    if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }
    window.editingProductId = null;

    // Limpar contexto de edicao (libera memoria e previne race conditions)
    productEditContext.clearCurrent();

    // Limpar estado do campo de nome (remover bloqueio de catalogo)
    const nameInput = document.getElementById('productName');
    if (nameInput) {
        nameInput.readOnly = false;
        nameInput.classList.remove('ml-catalog-locked', 'ml-synced-field');
        nameInput.removeEventListener('click', showCatalogTitleWarning);
        nameInput.removeEventListener('focus', showCatalogTitleWarning);
    }
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
    const productModal = document.getElementById('productModal');
    const materialModal = document.getElementById('materialDetailsModal');
    const descModal = document.getElementById('descriptionEditorModal');
    const choiceModal = document.getElementById('newProductChoiceModal');

    if (e.target === productModal) {
        closeProductModal();
    }
    if (e.target === materialModal) {
        closeMaterialDetailsModal();
    }
    if (e.target === descModal) {
        closeDescriptionEditorModal();
    }
    if (e.target === choiceModal) {
        closeNewProductChoiceModal();
    }
});

// ========== TABS NAVIGATION ==========
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const tabContent = document.getElementById('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
    if (tabContent) {
        tabContent.classList.add('active');
    }

    // Load data for specific tabs
    if (tabName === 'pending' && window.loadPendingOrders) {
        window.loadPendingOrders();
    } else if (tabName === 'history' && window.loadSalesHistory) {
        window.loadSalesHistory();
    }
}

// ========== UPDATE PENDING BADGE ==========
function updatePendingBadge(count) {
    const badge = document.getElementById('pendingBadge');
    const countEl = document.getElementById('pendingOrdersCount');

    if (badge) {
        badge.textContent = count || 0;
        badge.style.display = count > 0 ? 'inline-flex' : 'none';
    }

    if (countEl) {
        countEl.textContent = count || 0;
    }
}

// ========== RENDERIZAR GRID DE FOTOS (ML + LOCAIS) ==========
function renderPhotosGrid(photos) {
    const grid = document.getElementById('photosGrid');
    const empty = document.getElementById('photosEmpty');

    if (!grid) return;

    // Adicionar/remover classe de borda amarela se produto vinculado ao ML
    if (window.currentProductHasMlb) {
        grid.classList.add('ml-synced-container');
    } else {
        grid.classList.remove('ml-synced-container');
    }

    if (!photos || photos.length === 0) {
        grid.innerHTML = '';
        if (empty) {
            empty.style.display = 'flex';
            grid.appendChild(empty);
        }
        return;
    }

    if (empty) empty.style.display = 'none';

    // SEGURANCA: Usar data-action ao inves de onclick inline
    grid.innerHTML = photos.map((photo, index) => `
        <div class="photo-item ${index === 0 ? 'is-main' : ''}"
             data-index="${index}"
             data-type="${escapeHtml(photo.type)}"
             draggable="true">
            <img src="${escapeHtml(photo.url)}" alt="Foto ${index + 1}" data-fallback="true">
            <span class="photo-source ${escapeHtml(photo.type)}">${photo.type === 'ml' ? 'ML' : 'Local'}</span>
            <span class="photo-badge">${index === 0 ? 'Principal' : index + 1}</span>
            <div class="photo-actions">
                ${index !== 0 ? `<button class="photo-action-btn btn-set-main"
                    data-action="set-photo-main" data-index="${index}"
                    title="Definir como principal">
                    <i class="fas fa-star"></i>
                </button>` : ''}
                <button class="photo-action-btn btn-remove-photo"
                    data-action="remove-photo" data-index="${index}"
                    title="Remover foto">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    // SEGURANCA: Event handlers para imagens com erro
    grid.querySelectorAll('img[data-fallback]').forEach(img => {
        img.onerror = function() {
            this.src = '/assets/photo-error.png';
        };
    });

    setupPhotoDragDrop();
}

// ========== SETUP DROPZONE PARA UPLOAD ==========
function setupPhotosDropzone() {
    const dropzone = document.getElementById('photosDropzone');
    const input = document.getElementById('photoUploadInput');

    if (!dropzone || !input) return;

    // Click para selecionar
    dropzone.addEventListener('click', () => input.click());

    // Drag events
    ['dragenter', 'dragover'].forEach(event => {
        dropzone.addEventListener(event, (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(event => {
        dropzone.addEventListener(event, (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        });
    });

    // Drop
    dropzone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        handlePhotoFiles(files);
    });

    // Input change
    input.addEventListener('change', (e) => {
        handlePhotoFiles(e.target.files);
        input.value = ''; // Reset para permitir mesmo arquivo
    });
}

// ========== UPLOAD DE FOTOS (base64) ==========
const MAX_PHOTOS = 10;  // Limite de fotos por produto

async function handlePhotoFiles(files) {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 5 * 1024 * 1024; // 5MB
    let addedCount = 0;

    // Verificar limite total de fotos
    const currentCount = window.editingPhotos?.length || 0;
    const availableSlots = MAX_PHOTOS - currentCount;

    if (availableSlots <= 0) {
        window.showToast(`Maximo de ${MAX_PHOTOS} fotos atingido`, 'warning');
        return;
    }

    if (files.length > availableSlots) {
        window.showToast(`Apenas ${availableSlots} foto(s) podem ser adicionadas`, 'warning');
    }

    for (const file of files) {
        // Verificar limite a cada iteracao
        if (window.editingPhotos.length >= MAX_PHOTOS) {
            window.showToast(`Limite de ${MAX_PHOTOS} fotos atingido`, 'warning');
            break;
        }

        if (!validTypes.includes(file.type)) {
            window.showToast(`${file.name}: Formato invalido`, 'error');
            continue;
        }

        if (file.size > maxSize) {
            window.showToast(`${file.name}: Arquivo muito grande (max 5MB)`, 'error');
            continue;
        }

        try {
            // Converter para base64 (temporario)
            const base64 = await fileToBase64(file);

            window.editingPhotos.push({
                type: 'local',
                url: base64,
                file: file,
                name: file.name
            });
            addedCount++;
        } catch (error) {
            window.logger?.error('Erro ao processar foto:', error);
            window.showToast(`${file.name}: Erro ao processar`, 'error');
        }
    }

    if (addedCount > 0) {
        renderPhotosGrid(window.editingPhotos);
        window.showToast(`${addedCount} foto(s) adicionada(s)`, 'success');
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ========== DRAG AND DROP PARA REORDENAR ==========
// Flag para evitar setup duplicado de event delegation
let photoDragDropInitialized = false;

function setupPhotoDragDrop() {
    const grid = document.getElementById('photosGrid');
    if (!grid) return;

    // Usar event delegation - setup apenas uma vez
    if (photoDragDropInitialized) return;
    photoDragDropInitialized = true;

    grid.addEventListener('dragstart', (e) => {
        const item = e.target.closest('.photo-item[draggable="true"]');
        if (!item) return;
        draggedPhotoIndex = parseInt(item.dataset.index);
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    });

    grid.addEventListener('dragend', (e) => {
        const item = e.target.closest('.photo-item');
        if (item) item.classList.remove('dragging');
        grid.querySelectorAll('.photo-item').forEach(i => {
            i.classList.remove('drag-over');
        });
    });

    grid.addEventListener('dragover', (e) => {
        e.preventDefault();
        const item = e.target.closest('.photo-item[draggable="true"]');
        if (!item) return;
        e.dataTransfer.dropEffect = 'move';
        const targetIndex = parseInt(item.dataset.index);
        if (targetIndex !== draggedPhotoIndex) {
            item.classList.add('drag-over');
        }
    });

    grid.addEventListener('dragleave', (e) => {
        const item = e.target.closest('.photo-item');
        if (item) item.classList.remove('drag-over');
    });

    grid.addEventListener('drop', (e) => {
        e.preventDefault();
        const item = e.target.closest('.photo-item[draggable="true"]');
        if (!item) return;
        const targetIndex = parseInt(item.dataset.index);

        if (targetIndex !== draggedPhotoIndex && draggedPhotoIndex !== null) {
            // Reordenar array
            const [moved] = window.editingPhotos.splice(draggedPhotoIndex, 1);
            window.editingPhotos.splice(targetIndex, 0, moved);

            // Re-renderizar
            renderPhotosGrid(window.editingPhotos);
            window.showToast('Foto reordenada', 'success');
        }
        draggedPhotoIndex = null;
    });

    // Click para abrir fullscreen (event delegation)
    grid.addEventListener('click', (e) => {
        if (e.target.closest('.photo-action-btn')) return;
        const item = e.target.closest('.photo-item');
        if (!item) return;
        const url = item.querySelector('img')?.src;
        if (url) openPhotoFullscreen(url);
    });
}

// ========== ACOES NAS FOTOS ==========
function setPhotoAsMain(index) {
    if (index === 0 || index >= window.editingPhotos.length) return;

    const [photo] = window.editingPhotos.splice(index, 1);
    window.editingPhotos.unshift(photo);

    renderPhotosGrid(window.editingPhotos);
    window.showToast('Foto definida como principal', 'success');
}

function removePhoto(index) {
    if (index < 0 || index >= window.editingPhotos.length) return;

    window.editingPhotos.splice(index, 1);
    renderPhotosGrid(window.editingPhotos);
    window.showToast('Foto removida', 'success');
}

// ========== COPIAR DESCRICAO PENDENTE PARA DESCRICAO ==========
function copyPendingToDescription() {
    const pendingInput = document.getElementById('pendingDescription');
    const descriptionInput = document.getElementById('productDescription');

    if (!pendingInput || !descriptionInput) return;

    const pendingValue = pendingInput.value.trim();

    if (!pendingValue) {
        window.showToast('Descricao pendente esta vazia', 'warning');
        return;
    }

    // Copiar valor
    descriptionInput.value = pendingValue;

    // Efeito visual de feedback
    descriptionInput.style.transition = 'background 0.3s ease';
    descriptionInput.style.background = 'rgba(245, 158, 11, 0.3)';
    setTimeout(() => {
        descriptionInput.style.background = '';
    }, 500);

    window.showToast('Descricao copiada! Salve para sincronizar com ML', 'success');
}

// ========== GERENCIADOR DE GCODE ==========

// Estado global dos GCODEs em edicao
let pendingGcodeFiles = [];  // Arquivos GCODE pendentes para upload
let editingGcodes = [];      // GCODEs existentes (do banco) + pendentes
let currentGcodeEditIndex = null;  // Indice do GCODE sendo editado (para selecionar impressoras)
let selectedGcodePrinters = [];    // Impressoras selecionadas no modal

// Exibicao na coluna da tabela
function getGcodeColumnDisplay(product) {
    const gcodes = product.gcodeFiles || [];
    if (gcodes.length === 0) {
        return '<span class="text-muted">-</span>';
    }
    return `<span class="gcode-count-badge" title="${gcodes.length} arquivo(s) GCode">${gcodes.length}</span>`;
}

// Inicializar gerenciador de GCODE
function setupGcodeManager() {
    const dropzone = document.getElementById('gcodeDropzone');
    const input = document.getElementById('gcodeFileInput');

    if (!dropzone || !input) return;

    // Click para selecionar
    dropzone.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        input.click();
    });

    // Drag events
    ['dragenter', 'dragover'].forEach(event => {
        dropzone.addEventListener(event, (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(event => {
        dropzone.addEventListener(event, (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        });
    });

    // Drop - multiplos arquivos
    dropzone.addEventListener('drop', (e) => {
        const files = Array.from(e.dataTransfer.files);
        handleGcodeFiles(files);
    });

    // Input change - multiplos arquivos
    input.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        handleGcodeFiles(files);
        input.value = ''; // Reset para permitir mesmos arquivos
    });
}

// Processar arquivos GCODE selecionados
function handleGcodeFiles(files) {
    const validExtensions = ['.gcode', '.gc', '.g'];
    const maxSize = 100 * 1024 * 1024; // 100MB

    let addedCount = 0;

    files.forEach(file => {
        const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

        // Validar extensao
        if (!validExtensions.includes(ext)) {
            window.showToast(`${file.name}: Extensao invalida`, 'warning');
            return;
        }

        // Validar tamanho
        if (file.size > maxSize) {
            window.showToast(`${file.name}: Muito grande (max 100MB)`, 'warning');
            return;
        }

        // Verificar duplicata
        const isDuplicate = editingGcodes.some(g => g.name === file.name && g.isPending);
        if (isDuplicate) {
            window.showToast(`${file.name}: Ja adicionado`, 'info');
            return;
        }

        // Gerar ID temporario seguro
        const tempId = generateSecureId();

        // Adicionar a lista
        const gcodeEntry = {
            id: tempId,
            name: file.name,
            file: file,
            printers: [],
            uploadedAt: new Date().toISOString(),
            isPending: true
        };

        editingGcodes.push(gcodeEntry);
        pendingGcodeFiles.push({ id: tempId, file: file });
        addedCount++;

        // Abrir modal de impressoras para o novo arquivo
        openGcodePrinterModal(editingGcodes.length - 1);
    });

    if (addedCount > 0) {
        renderGcodeList();
    }
}

// Gerar ID seguro
function generateSecureId(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    return 'gcode_' + Array.from(array, n => chars[n % chars.length]).join('');
}

// Renderizar lista de GCODEs
function renderGcodeList() {
    const list = document.getElementById('gcodeList');
    const emptyState = document.getElementById('gcodeEmptyState');

    if (!list) return;

    if (editingGcodes.length === 0) {
        list.innerHTML = '';
        if (emptyState) {
            list.appendChild(emptyState);
            emptyState.style.display = 'flex';
        }
        updateGcodeHiddenInput();
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    list.innerHTML = editingGcodes.map((gcode, index) => {
        const hasPrinters = gcode.printers && gcode.printers.length > 0;
        const dateFormatted = formatGcodeDate(gcode.uploadedAt);

        // Renderizar tags de impressoras
        const printerTags = hasPrinters
            ? gcode.printers.map(p => `
                <span class="gcode-printer-tag">
                    <i class="fas fa-print"></i>
                    ${escapeHtml(extractPrinterShortName(p))}
                </span>
            `).join('')
            : `<span class="gcode-no-printers"><i class="fas fa-exclamation-triangle"></i> Sem impressora</span>`;

        return `
            <div class="gcode-item" data-index="${index}">
                <div class="gcode-item-icon">
                    <i class="fas fa-file-code"></i>
                </div>
                <div class="gcode-item-info">
                    <div class="gcode-item-name" title="${escapeHtml(gcode.name)}">${escapeHtml(gcode.name)}</div>
                    <div class="gcode-item-meta">
                        <span class="gcode-item-date"><i class="fas fa-calendar-alt"></i> ${dateFormatted}</span>
                        <div class="gcode-item-printers">${printerTags}</div>
                    </div>
                </div>
                <div class="gcode-item-actions">
                    <button type="button" class="gcode-action-btn btn-edit-printers"
                            data-action="edit-gcode-printers" data-index="${index}"
                            title="Editar impressoras">
                        <i class="fas fa-print"></i>
                    </button>
                    ${!gcode.isPending && gcode.url ? `
                        <button type="button" class="gcode-action-btn btn-download-gcode"
                                data-action="download-gcode" data-index="${index}"
                                title="Baixar GCode">
                            <i class="fas fa-download"></i>
                        </button>
                    ` : ''}
                    <button type="button" class="gcode-action-btn btn-remove-gcode"
                            data-action="remove-gcode" data-index="${index}"
                            title="Remover">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    updateGcodeHiddenInput();
}

// Formatar data do GCODE
function formatGcodeDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
        return '-';
    }
}

// Extrair nome curto da impressora (ex: "Bambu Lab K2 Plus" -> "K2 Plus")
function extractPrinterShortName(fullName) {
    if (!fullName) return '?';
    // Remove prefixos comuns
    const name = fullName.replace(/^(Bambu Lab|Creality|Anycubic|Prusa)\s*/i, '');
    // Limita tamanho
    return name.length > 12 ? name.slice(0, 10) + '..' : name;
}

// Abrir modal de selecao de impressoras para um GCODE
function openGcodePrinterModal(index) {
    const modal = document.getElementById('gcodePrinterModal');
    const fileNameDisplay = document.getElementById('gcodeFileNameDisplay');
    const grid = document.getElementById('gcodePrintersGrid');

    if (!modal) return;

    currentGcodeEditIndex = index;
    const gcode = editingGcodes[index];

    if (!gcode) return;

    // Exibir nome do arquivo
    if (fileNameDisplay) {
        fileNameDisplay.textContent = gcode.name;
    }

    // Copiar impressoras atuais
    selectedGcodePrinters = [...(gcode.printers || [])];

    // Renderizar grid de impressoras
    renderGcodePrinterGrid();

    // Mostrar modal
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
}

// Fechar modal de impressoras
function closeGcodePrinterModal() {
    const modal = document.getElementById('gcodePrinterModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.setAttribute('aria-hidden', 'true');
    }
    currentGcodeEditIndex = null;
    selectedGcodePrinters = [];
}

// Renderizar grid de impressoras no modal de GCODE
function renderGcodePrinterGrid() {
    const grid = document.getElementById('gcodePrintersGrid');
    if (!grid) return;

    const printers = window.getPrinters ? window.getPrinters() : [];

    if (printers.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;"><i class="fas fa-spinner fa-spin"></i> Carregando impressoras...</div>';
        return;
    }

    grid.innerHTML = printers.map(printer => {
        const isSelected = selectedGcodePrinters.includes(printer.name);
        const hasImage = printer.imageUrl;
        const safeImageUrl = hasImage ? escapeHtml(printer.imageUrl) : '';

        const imageHtml = hasImage
            ? `<img src="${safeImageUrl}" class="gcode-printer-card-image" alt="${escapeHtml(printer.name)}" data-fallback-action="show-placeholder">
               <div class="gcode-printer-card-placeholder" style="display:none;"><i class="fas fa-print"></i></div>`
            : `<div class="gcode-printer-card-placeholder"><i class="fas fa-print"></i></div>`;

        return `
            <div class="gcode-printer-card ${isSelected ? 'selected' : ''}"
                 data-printer="${escapeHtml(printer.name)}"
                 data-action="toggle-gcode-printer">
                <div class="gcode-printer-card-check"><i class="fas fa-check"></i></div>
                ${imageHtml}
                <span class="gcode-printer-card-name">${escapeHtml(printer.name)}</span>
            </div>
        `;
    }).join('');
}

// Alternar selecao de impressora no modal de GCODE
function toggleGcodePrinter(printerName) {
    const index = selectedGcodePrinters.indexOf(printerName);
    if (index === -1) {
        selectedGcodePrinters.push(printerName);
    } else {
        selectedGcodePrinters.splice(index, 1);
    }

    // Atualizar visual
    const card = document.querySelector(`.gcode-printer-card[data-printer="${printerName}"]`);
    if (card) {
        card.classList.toggle('selected', selectedGcodePrinters.includes(printerName));
    }
}

// Confirmar selecao de impressoras
function confirmGcodePrinters() {
    if (currentGcodeEditIndex === null) {
        closeGcodePrinterModal();
        return;
    }

    if (selectedGcodePrinters.length === 0) {
        window.showToast('Selecione pelo menos uma impressora', 'warning');
        return;
    }

    // Atualizar GCODE
    editingGcodes[currentGcodeEditIndex].printers = [...selectedGcodePrinters];

    closeGcodePrinterModal();
    renderGcodeList();

    window.showToast('Impressoras atualizadas!', 'success');
}

// Remover GCODE
function removeGcode(index) {
    const gcode = editingGcodes[index];
    if (!gcode) return;

    // Remover de pendentes se for novo
    if (gcode.isPending) {
        pendingGcodeFiles = pendingGcodeFiles.filter(p => p.id !== gcode.id);
    }

    editingGcodes.splice(index, 1);
    renderGcodeList();

    window.showToast('GCode removido', 'info');
}

// Download de GCODE existente
function downloadGcode(index) {
    const gcode = editingGcodes[index];
    if (!gcode || !gcode.url) {
        window.showToast('Arquivo nao encontrado', 'error');
        return;
    }

    try {
        const link = document.createElement('a');
        link.href = gcode.url;
        link.download = gcode.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.showToast('Download iniciado!', 'success');
    } catch (error) {
        window.logger?.error('Erro ao baixar GCode:', error);
        window.showToast('Erro ao baixar arquivo', 'error');
    }
}

// Atualizar input hidden com dados dos GCODEs
function updateGcodeHiddenInput() {
    const input = document.getElementById('gcodeFilesData');
    if (input) {
        // Serializar apenas dados necessarios (sem o objeto File)
        const data = editingGcodes.map(g => ({
            id: g.id,
            name: g.name,
            printers: g.printers,
            uploadedAt: g.uploadedAt,
            isPending: g.isPending,
            url: g.url || null,
            storagePath: g.storagePath || null
        }));
        input.value = JSON.stringify(data);
    }
}

// Carregar GCODEs existentes ao editar produto
function loadGcodesForEdit(product) {
    editingGcodes = [];
    pendingGcodeFiles = [];

    if (product.gcodeFiles && Array.isArray(product.gcodeFiles)) {
        editingGcodes = product.gcodeFiles.map(g => ({
            id: g.id,
            name: g.name,
            printers: g.printers || [],
            uploadedAt: g.uploadedAt,
            url: g.url,
            storagePath: g.storagePath,
            isPending: false
        }));
    }

    renderGcodeList();
}

// Resetar gerenciador de GCODE
function resetGcodeManager() {
    editingGcodes = [];
    pendingGcodeFiles = [];
    currentGcodeEditIndex = null;
    selectedGcodePrinters = [];

    const list = document.getElementById('gcodeList');
    const emptyState = document.getElementById('gcodeEmptyState');

    if (list) list.innerHTML = '';
    if (emptyState) {
        if (list) list.appendChild(emptyState);
        emptyState.style.display = 'flex';
    }

    updateGcodeHiddenInput();
}

// Validar se todos os GCODEs tem impressoras
function validateGcodes() {
    for (const gcode of editingGcodes) {
        if (!gcode.printers || gcode.printers.length === 0) {
            window.showToast(`O arquivo "${gcode.name}" precisa ter pelo menos uma impressora`, 'warning');
            return false;
        }
    }
    return true;
}

// Obter arquivos pendentes para upload
function getPendingGcodeFiles() {
    return pendingGcodeFiles;
}

// Obter dados dos GCODEs para salvar
function getGcodesData() {
    return editingGcodes.map(g => ({
        id: g.id,
        name: g.name,
        printers: g.printers,
        uploadedAt: g.uploadedAt,
        url: g.url || null,
        storagePath: g.storagePath || null,
        isPending: g.isPending
    }));
}

// ========== EXPORTAR PARA GLOBAL ==========
// TableColumnResizer - Acesso global para debug/extensao
window.TableColumnResizer = TableColumnResizer;
Object.defineProperty(window, 'tableResizer', {
    get: () => tableResizer
});

// TableColumnReorder - Acesso global para debug/extensao
window.TableColumnReorder = TableColumnReorder;
Object.defineProperty(window, 'tableReorder', {
    get: () => tableReorder
});

window.setupColumnResize = setupColumnResize;
window.reinitColumnResize = reinitColumnResize;

// GCODE Manager - Exportar funcoes
window.setupGcodeManager = setupGcodeManager;
window.handleGcodeFiles = handleGcodeFiles;
window.renderGcodeList = renderGcodeList;
window.openGcodePrinterModal = openGcodePrinterModal;
window.closeGcodePrinterModal = closeGcodePrinterModal;
window.toggleGcodePrinter = toggleGcodePrinter;
window.confirmGcodePrinters = confirmGcodePrinters;
window.removeGcode = removeGcode;
window.downloadGcode = downloadGcode;
window.loadGcodesForEdit = loadGcodesForEdit;
window.resetGcodeManager = resetGcodeManager;
window.validateGcodes = validateGcodes;
window.getPendingGcodeFiles = getPendingGcodeFiles;
window.getGcodesData = getGcodesData;
window.getGcodeColumnDisplay = getGcodeColumnDisplay;
window.clearFilters = clearFilters;
window.renderProducts = renderProducts;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.editProduct = editProduct;
window.applyFilters = applyFilters;
window.switchTab = switchTab;
window.updatePendingBadge = updatePendingBadge;
window.copyDescription = copyDescription;
window.formatPrinterNames = formatPrinterNames;
window.renderMlPhotos = renderMlPhotos;
window.updateYoutubePreview = updateYoutubePreview;
window.openPhotoFullscreen = openPhotoFullscreen;
window.syncFromMl = syncFromMl;
window.renderPhotosGrid = renderPhotosGrid;
window.setPhotoAsMain = setPhotoAsMain;
window.removePhoto = removePhoto;
window.copyPendingToDescription = copyPendingToDescription;
window.setupPhotosDropzone = setupPhotosDropzone;
window.showMaterialDetails = showMaterialDetails;
window.closeMaterialDetailsModal = closeMaterialDetailsModal;
window.openDescriptionEditor = openDescriptionEditor;
window.closeDescriptionEditorModal = closeDescriptionEditorModal;
window.copyDraftToPublished = copyDraftToPublished;
window.copyPublishedToDraft = copyPublishedToDraft;
window.swapDescriptions = swapDescriptions;
window.syncDescriptionFromEditor = syncDescriptionFromEditor;
window.openNewProductChoiceModal = openNewProductChoiceModal;
window.closeNewProductChoiceModal = closeNewProductChoiceModal;
window.createBlankProduct = createBlankProduct;
window.showMlImportList = showMlImportList;
window.hideMlImportList = hideMlImportList;
window.importFromMl = importFromMl;
