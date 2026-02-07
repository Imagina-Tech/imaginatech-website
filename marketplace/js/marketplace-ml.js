/*
==================================================
ARQUIVO: marketplace/js/marketplace-ml.js
MODULO: Monitor de Vendas Mercado Livre
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 2.1 - Security Hardened (2026-01-25)
==================================================
*/

// SEGURANCA: Helper para escapar HTML (fallback se nao existir)
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// URL base das Cloud Functions
const ML_FUNCTIONS_URL = 'https://us-central1-imaginatech-servicos.cloudfunctions.net';

// Estado da conexao ML
let mlConnected = false;
let mlNickname = null;

// Cache de dados
let pendingOrders = [];
let salesHistory = [];

// AbortControllers para cancelar requisicoes pendentes
let mlItemsAbortController = null;
let pendingOrdersAbortController = null;
let salesHistoryAbortController = null;

// ========== INICIALIZACAO ==========
document.addEventListener('DOMContentLoaded', () => {
    checkOAuthReturn();
    checkMlStatus();
});

// ========== VERIFICAR RETORNO OAUTH ==========
function checkOAuthReturn() {
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get('ml_connected') === 'true') {
        // Se estamos em um popup, notificar a janela original e fechar
        if (window.opener && !window.opener.closed) {
            try {
                window.opener.postMessage({ type: 'ML_OAUTH_SUCCESS' }, '*');
                window.close();
                return; // Nao continuar se conseguir fechar
            } catch (e) {
                // Se falhar, continuar normalmente (pode ser cross-origin)
                window.logger?.warn('Nao foi possivel notificar janela original:', e);
            }
        }
        // Se nao for popup ou nao conseguir fechar, mostrar toast
        window.showToast('Mercado Livre conectado com sucesso!', 'success');
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (urlParams.get('ml_error') === 'true') {
        const reason = urlParams.get('reason') || 'unknown';
        // Se estamos em um popup, notificar a janela original e fechar
        if (window.opener && !window.opener.closed) {
            try {
                window.opener.postMessage({ type: 'ML_OAUTH_ERROR', reason }, '*');
                window.close();
                return;
            } catch (e) {
                window.logger?.warn('Nao foi possivel notificar janela original:', e);
            }
        }
        window.showToast('Erro ao conectar com Mercado Livre', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// ========== VERIFICAR STATUS ML ==========
async function checkMlStatus() {
    try {
        const response = await fetch(`${ML_FUNCTIONS_URL}/mlStatus`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        updateMlStatusUI(data);
    } catch (error) {
        window.logger?.error('Erro ao verificar status ML:', error);
        updateMlStatusUI({ connected: false });
    }
}

// ========== ATUALIZAR UI STATUS ML ==========
function updateMlStatusUI(status) {
    const statusCard = document.getElementById('mlStatusCard');
    const statusText = document.getElementById('mlStatusText');
    const connectBtn = document.getElementById('mlConnectBtn');

    if (!statusCard) return;

    mlConnected = status.connected;
    mlNickname = status.nickname;

    if (status.connected) {
        statusCard.classList.add('connected');
        statusText.innerHTML = `<strong>${escapeHtml(status.nickname || 'Conectado')}</strong>`;
        if (connectBtn) {
            connectBtn.innerHTML = '<i class="fas fa-check"></i>';
            connectBtn.title = 'Conectado - Clique para reconectar';
        }
    } else {
        statusCard.classList.remove('connected');
        statusText.textContent = 'Nao conectado';
        if (connectBtn) {
            connectBtn.innerHTML = '<i class="fas fa-plug"></i>';
            connectBtn.title = 'Conectar ao Mercado Livre';
        }
    }
}

// ========== CONECTAR MERCADO LIVRE ==========
function connectMercadoLivre() {
    const authUrl = `${ML_FUNCTIONS_URL}/mlAuth`;
    const popup = window.open(authUrl, 'mlAuth', 'width=600,height=700,scrollbars=yes');

    if (!popup) {
        // Popup bloqueado - redirecionar diretamente
        window.location.href = authUrl;
        return;
    }

    // Listener para receber mensagem do popup apos OAuth
    const messageHandler = (event) => {
        // Aceitar mensagens de qualquer origem (o redirect pode vir de diferentes dominios)
        if (event.data?.type === 'ML_OAUTH_SUCCESS') {
            window.removeEventListener('message', messageHandler);
            window.showToast('Mercado Livre conectado com sucesso!', 'success');
            // Atualizar status e recarregar dados
            checkMlStatus();
            // Recarregar pedidos pendentes e historico
            if (typeof loadPendingOrders === 'function') loadPendingOrders();
            if (typeof loadSalesHistory === 'function') loadSalesHistory();
        } else if (event.data?.type === 'ML_OAUTH_ERROR') {
            window.removeEventListener('message', messageHandler);
            window.showToast('Erro ao conectar com Mercado Livre', 'error');
        }
    };

    window.addEventListener('message', messageHandler);

    // Remover listener apos 5 minutos (timeout de seguranca)
    setTimeout(() => {
        window.removeEventListener('message', messageHandler);
    }, 5 * 60 * 1000);
}

// ========================================
// MONITORAMENTO DE VENDAS
// ========================================

// ========== CARREGAR PEDIDOS PENDENTES ==========
async function loadPendingOrders() {
    const container = document.getElementById('pendingOrdersList');
    const emptyState = document.getElementById('emptyPending');
    const loadingState = document.getElementById('pendingLoading');

    if (!mlConnected) {
        if (container) container.innerHTML = '';
        if (emptyState) {
            emptyState.classList.remove('hidden');
            // SEGURANCA: Usar data-action ao inves de onclick inline
            emptyState.innerHTML = `
                <i class="fas fa-plug"></i>
                <h3>Conecte ao Mercado Livre</h3>
                <p>Para ver os pedidos pendentes</p>
                <button class="btn-refresh" data-action="connect-ml" style="margin-top:1rem;">
                    <i class="fas fa-link"></i> Conectar
                </button>
            `;
        }
        if (window.updatePendingBadge) window.updatePendingBadge(0);
        return;
    }

    // Cancelar requisicao anterior se existir
    if (pendingOrdersAbortController) {
        pendingOrdersAbortController.abort();
    }
    pendingOrdersAbortController = new AbortController();

    try {
        if (container) container.innerHTML = '';
        if (emptyState) emptyState.classList.add('hidden');
        if (loadingState) loadingState.classList.remove('hidden');

        const response = await fetch(`${ML_FUNCTIONS_URL}/mlGetPendingOrders`, {
            signal: pendingOrdersAbortController.signal
        });

        // Validar resposta HTTP
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (loadingState) loadingState.classList.add('hidden');

        if (data.success) {
            pendingOrders = data.orders || [];
            renderPendingOrders(pendingOrders);
            if (window.updatePendingBadge) window.updatePendingBadge(pendingOrders.length);
        } else {
            throw new Error(data.error || 'Erro ao carregar pedidos');
        }
    } catch (error) {
        // Ignorar erro de abort
        if (error.name === 'AbortError') {
            window.logger?.log('[ML] Requisicao de pedidos cancelada');
            return;
        }
        window.logger?.error('Erro ao carregar pedidos pendentes:', error);
        if (loadingState) loadingState.classList.add('hidden');
        if (emptyState) {
            emptyState.classList.remove('hidden');
            emptyState.innerHTML = `
                <i class="fas fa-exclamation-circle"></i>
                <h3>Erro ao carregar</h3>
                <p>Nao foi possivel carregar os pedidos</p>
            `;
        }
    }
}

// ========== RENDERIZAR PEDIDOS PENDENTES ==========
function renderPendingOrders(orders) {
    const container = document.getElementById('pendingOrdersList');
    const emptyState = document.getElementById('emptyPending');

    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = '';
        if (emptyState) {
            emptyState.classList.remove('hidden');
            emptyState.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <h3>Nenhum pedido pendente</h3>
                <p>Todos os pedidos foram enviados!</p>
            `;
        }
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    container.innerHTML = orders.map(order => {
        const item = order.items[0] || {};
        const buyer = order.buyer || {};

        // SEGURANCA: Escapar todos os dados de usuario/API
        return `
            <div class="order-card">
                <div class="order-card-header">
                    <span class="order-id"><i class="fas fa-receipt"></i> #${escapeHtml(String(order.id))}</span>
                    <span class="order-date">${escapeHtml(formatDate(order.dateCreated))}</span>
                </div>
                <div class="order-card-body">
                    <div class="order-product">
                        <div class="order-product-image">
                            ${item.thumbnail ? `<img src="${ensureHttps(item.thumbnail)}" alt="">` : '<i class="fas fa-box" style="font-size:2rem;color:var(--text-muted);"></i>'}
                        </div>
                        <div class="order-product-info">
                            <div class="order-product-title">${escapeHtml(item.title || 'Produto')}</div>
                            <div class="order-product-qty">Quantidade: ${parseInt(item.quantity) || 1}</div>
                            <div class="order-product-price">R$ ${(parseFloat(order.totalAmount) || 0).toFixed(2)}</div>
                        </div>
                    </div>
                    <div class="order-buyer">
                        <div class="order-buyer-icon"><i class="fas fa-user"></i></div>
                        <div class="order-buyer-info">
                            <div class="order-buyer-name">${escapeHtml(buyer.firstName || buyer.nickname || 'Comprador')}</div>
                            <div class="order-buyer-location">${escapeHtml(buyer.city || '')} ${buyer.state ? '- ' + escapeHtml(buyer.state) : ''}</div>
                        </div>
                    </div>
                </div>
                <div class="order-card-footer">
                    <button class="btn-order-action" data-action="view-order-details" data-order-id="${escapeHtml(String(order.id))}">
                        <i class="fas fa-eye"></i> Detalhes
                    </button>
                    <button class="btn-order-action btn-primary-action" data-action="open-ml-order" data-order-id="${escapeHtml(String(order.id))}">
                        <i class="fas fa-external-link-alt"></i> Abrir no ML
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ========== CARREGAR HISTORICO DE VENDAS ==========
async function loadSalesHistory() {
    const daysSelect = document.getElementById('historyDays');
    const days = daysSelect ? parseInt(daysSelect.value) || 30 : 30;

    const tableBody = document.getElementById('historyTableBody');
    const emptyState = document.getElementById('emptyHistory');
    const loadingState = document.getElementById('historyLoading');
    const summaryEl = document.getElementById('salesSummary');

    if (!mlConnected) {
        if (tableBody) tableBody.innerHTML = '';
        if (emptyState) {
            emptyState.classList.remove('hidden');
            emptyState.innerHTML = `
                <i class="fas fa-plug"></i>
                <h3>Conecte ao Mercado Livre</h3>
                <p>Para ver o historico de vendas</p>
            `;
        }
        updateSalesSummary(0, 0, 0);
        return;
    }

    // Cancelar requisicao anterior se existir
    if (salesHistoryAbortController) {
        salesHistoryAbortController.abort();
    }
    salesHistoryAbortController = new AbortController();

    try {
        if (tableBody) tableBody.innerHTML = '';
        if (emptyState) emptyState.classList.add('hidden');
        if (loadingState) loadingState.classList.remove('hidden');

        const response = await fetch(`${ML_FUNCTIONS_URL}/mlGetSalesHistory?days=${days}`, {
            signal: salesHistoryAbortController.signal
        });

        // Validar resposta HTTP
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (loadingState) loadingState.classList.add('hidden');

        if (data.success) {
            salesHistory = data.orders || [];
            renderSalesHistory(salesHistory);
            updateSalesSummary(data.totalOrders || salesHistory.length, data.totalRevenue || 0, data.totalItems || 0);
        } else {
            throw new Error(data.error || 'Erro ao carregar historico');
        }
    } catch (error) {
        // Ignorar erro de abort
        if (error.name === 'AbortError') {
            window.logger?.log('[ML] Requisicao de historico cancelada');
            return;
        }
        window.logger?.error('Erro ao carregar historico:', error);
        if (loadingState) loadingState.classList.add('hidden');
        if (emptyState) {
            emptyState.classList.remove('hidden');
            emptyState.innerHTML = `
                <i class="fas fa-exclamation-circle"></i>
                <h3>Erro ao carregar</h3>
                <p>Nao foi possivel carregar o historico</p>
            `;
        }
    }
}

// ========== ATUALIZAR RESUMO DE VENDAS ==========
function updateSalesSummary(totalSales, totalRevenue, totalItems) {
    const salesEl = document.getElementById('totalSales');
    const revenueEl = document.getElementById('totalRevenue');
    const itemsEl = document.getElementById('totalItems');

    if (salesEl) salesEl.textContent = totalSales || 0;
    if (revenueEl) revenueEl.textContent = 'R$ ' + (totalRevenue || 0).toFixed(2).replace('.', ',');
    if (itemsEl) itemsEl.textContent = totalItems || 0;
}

// ========== RENDERIZAR HISTORICO DE VENDAS ==========
function renderSalesHistory(orders) {
    const tableBody = document.getElementById('historyTableBody');
    const emptyState = document.getElementById('emptyHistory');

    if (!tableBody) return;

    if (orders.length === 0) {
        tableBody.innerHTML = '';
        if (emptyState) {
            emptyState.classList.remove('hidden');
            emptyState.innerHTML = `
                <i class="fas fa-inbox"></i>
                <h3>Nenhuma venda encontrada</h3>
                <p>Nao ha vendas no periodo selecionado</p>
            `;
        }
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tableBody.innerHTML = orders.map(order => {
        const item = order.items[0] || {};
        const buyer = order.buyer || {};
        const status = order.status || 'delivered';

        // SEGURANCA: Escapar todos os dados de usuario/API
        return `
            <tr>
                <td>${escapeHtml(formatDate(order.dateCreated))}</td>
                <td><span style="font-family:'Orbitron',monospace;color:#FFE600;">#${escapeHtml(String(order.id))}</span></td>
                <td>
                    <div class="history-product">
                        <div class="history-product-thumb">
                            ${item.thumbnail ? `<img src="${ensureHttps(item.thumbnail)}" alt="">` : ''}
                        </div>
                        <span class="history-product-name">${escapeHtml(item.title || 'Produto')}</span>
                    </div>
                </td>
                <td>
                    <div class="history-buyer">
                        <span class="history-buyer-name">${escapeHtml(buyer.firstName || buyer.nickname || 'Comprador')}</span>
                        <span class="history-buyer-location">${escapeHtml(buyer.city || '')}</span>
                    </div>
                </td>
                <td>${parseInt(item.quantity) || 1}</td>
                <td><span class="history-price">R$ ${(parseFloat(order.totalAmount) || 0).toFixed(2)}</span></td>
                <td><span class="history-status delivered"><i class="fas fa-check"></i> Entregue</span></td>
                <td>
                    <button class="btn-view-details" data-action="view-order-details" data-order-id="${escapeHtml(String(order.id))}">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// ========== VER DETALHES DO PEDIDO ==========
async function viewOrderDetails(orderId) {
    try {
        window.showLoading();

        const response = await fetch(`${ML_FUNCTIONS_URL}/mlGetOrderDetails?orderId=${orderId}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
            showOrderDetailsModal(data.order, data.shipping);
        } else {
            window.showToast(data.error || 'Erro ao carregar detalhes', 'error');
        }
    } catch (error) {
        window.logger?.error('Erro ao carregar detalhes do pedido:', error);
        window.showToast('Erro ao carregar detalhes', 'error');
    } finally {
        window.hideLoading();
    }
}

// ========== MODAL DETALHES DO PEDIDO ==========
function showOrderDetailsModal(order, shipping) {
    const modal = document.getElementById('orderDetailsModal');
    const content = document.getElementById('orderDetailsContent');
    const loading = document.getElementById('orderDetailsLoading');

    if (!modal || !content) return;

    if (loading) loading.classList.add('hidden');

    const buyer = order.buyer || {};
    const items = order.items || [];

    // SEGURANCA: Escapar todos os dados de usuario/API
    content.innerHTML = `
        <div class="order-detail-section">
            <h4><i class="fas fa-receipt"></i> Pedido #${escapeHtml(String(order.id))}</h4>
            <div class="order-detail-row">
                <span class="order-detail-label">Data</span>
                <span class="order-detail-value">${escapeHtml(formatDateTime(order.dateCreated))}</span>
            </div>
            <div class="order-detail-row">
                <span class="order-detail-label">Status</span>
                <span class="order-detail-value">${escapeHtml(order.status || '-')}</span>
            </div>
        </div>

        <div class="order-detail-section">
            <h4><i class="fas fa-user"></i> Comprador</h4>
            <div class="order-detail-row">
                <span class="order-detail-label">Nome</span>
                <span class="order-detail-value">${escapeHtml(buyer.firstName || '')} ${escapeHtml(buyer.lastName || '')}</span>
            </div>
            <div class="order-detail-row">
                <span class="order-detail-label">Nickname</span>
                <span class="order-detail-value">${escapeHtml(buyer.nickname || '-')}</span>
            </div>
        </div>

        <div class="order-detail-section">
            <h4><i class="fas fa-box"></i> Itens</h4>
            ${items.map(item => `
                <div class="order-detail-row">
                    <span class="order-detail-label">${escapeHtml(item.title || 'Produto')}</span>
                    <span class="order-detail-value">${parseInt(item.quantity) || 1}x R$ ${(parseFloat(item.unitPrice) || 0).toFixed(2)}</span>
                </div>
            `).join('')}
            <div class="order-detail-row" style="border-top:1px solid var(--glass-border);padding-top:0.75rem;margin-top:0.5rem;">
                <span class="order-detail-label" style="font-weight:600;">Total</span>
                <span class="order-detail-value" style="color:var(--neon-green);font-weight:700;">R$ ${(parseFloat(order.totalAmount) || 0).toFixed(2)}</span>
            </div>
        </div>

        ${shipping ? `
        <div class="order-detail-section">
            <h4><i class="fas fa-truck"></i> Envio</h4>
            <div class="order-detail-row">
                <span class="order-detail-label">Status</span>
                <span class="order-detail-value">${escapeHtml(shipping.status || '-')}</span>
            </div>
            ${shipping.trackingNumber ? `
            <div class="order-detail-row">
                <span class="order-detail-label">Rastreio</span>
                <span class="order-detail-value">${escapeHtml(shipping.trackingNumber)}</span>
            </div>
            ` : ''}
            ${shipping.receiverAddress ? `
            <div class="order-detail-row">
                <span class="order-detail-label">Endereco</span>
                <span class="order-detail-value">
                    ${escapeHtml(shipping.receiverAddress.streetName || '')}, ${escapeHtml(shipping.receiverAddress.streetNumber || '')}<br>
                    ${escapeHtml(shipping.receiverAddress.city || '')} - ${escapeHtml(shipping.receiverAddress.state || '')}<br>
                    CEP: ${escapeHtml(shipping.receiverAddress.zipCode || '')}
                </span>
            </div>
            ` : ''}
        </div>
        ` : ''}
    `;

    modal.classList.add('active');
}

function closeOrderDetailsModal() {
    const modal = document.getElementById('orderDetailsModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ========================================
// VINCULACAO SIMPLIFICADA
// ========================================

// ========== MODAL VINCULAR MLB ==========
let linkingProductId = null;
let mlItems = [];
let selectedMlbId = null;
let mlItemsSearchTimer = null;

function openLinkMlbModal(productId) {
    if (!mlConnected) {
        window.showToast('Conecte ao Mercado Livre primeiro', 'warning');
        return;
    }

    linkingProductId = productId;
    selectedMlbId = null;

    const modal = document.getElementById('linkMlbModal');
    const productIdInput = document.getElementById('linkingProductId');
    const selectedMlbInput = document.getElementById('selectedMlbId');
    const saveBtn = document.getElementById('btnSaveMlbLink');
    const searchInput = document.getElementById('mlbSearchInput');
    const productNameEl = document.getElementById('linkingProductName');

    // Get product name
    const product = window.products.find(p => p.id === productId);
    if (productNameEl && product) {
        productNameEl.textContent = product.name || 'Produto';
    }

    if (productIdInput) productIdInput.value = productId;
    if (selectedMlbInput) selectedMlbInput.value = '';
    if (saveBtn) saveBtn.disabled = true;
    if (searchInput) searchInput.value = '';

    if (modal) {
        modal.classList.add('active');
        loadMlItems();
    }

    // Setup search listener
    if (searchInput) {
        searchInput.removeEventListener('input', handleMlbSearch);
        searchInput.addEventListener('input', handleMlbSearch);
    }
}

function closeLinkMlbModal() {
    const modal = document.getElementById('linkMlbModal');
    if (modal) {
        modal.classList.remove('active');
    }
    linkingProductId = null;
    selectedMlbId = null;
}

// ========== CARREGAR ANUNCIOS DO ML ==========
async function loadMlItems() {
    const list = document.getElementById('mlbItemsList');
    const loading = document.getElementById('mlbItemsLoading');
    const empty = document.getElementById('mlbItemsEmpty');

    // Cancelar requisicao anterior se existir
    if (mlItemsAbortController) {
        mlItemsAbortController.abort();
    }
    mlItemsAbortController = new AbortController();

    if (list) list.innerHTML = '';
    if (empty) empty.classList.add('hidden');
    if (loading) loading.classList.remove('hidden');

    try {
        const response = await fetch(`${ML_FUNCTIONS_URL}/mlListItems`, {
            signal: mlItemsAbortController.signal
        });

        // Validar resposta HTTP
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (loading) loading.classList.add('hidden');

        if (data.items && data.items.length > 0) {
            mlItems = data.items;
            renderMlItems(mlItems);
        } else {
            mlItems = [];
            if (empty) empty.classList.remove('hidden');
        }
    } catch (error) {
        // Ignorar erro de abort (usuario cancelou)
        if (error.name === 'AbortError') {
            window.logger?.log('[ML] Requisicao de anuncios cancelada');
            return;
        }
        window.logger?.error('Erro ao carregar anuncios:', error);
        if (loading) loading.classList.add('hidden');
        if (empty) {
            empty.classList.remove('hidden');
            empty.innerHTML = `
                <i class="fas fa-exclamation-circle"></i>
                <span>Erro ao carregar anuncios</span>
            `;
        }
    }
}

// ========== RENDERIZAR ANUNCIOS ==========
function renderMlItems(items) {
    const list = document.getElementById('mlbItemsList');
    const empty = document.getElementById('mlbItemsEmpty');

    if (!list) return;

    if (items.length === 0) {
        list.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');

    // Get linked MLB IDs from products
    const linkedMlbIds = new Set(
        (window.products || [])
            .filter(p => p.mlbId)
            .map(p => p.mlbId)
    );

    list.innerHTML = items.map(item => {
        const isLinked = linkedMlbIds.has(item.id);
        const isSelected = selectedMlbId === item.id;
        const statusClass = item.status === 'active' ? 'active' : 'paused';
        const statusText = item.status === 'active' ? 'Ativo' : 'Pausado';

        // SEGURANCA: Usar data-action ao inves de onclick inline
        return `
            <div class="mlb-item ${isSelected ? 'selected' : ''} ${isLinked ? 'already-linked' : ''}"
                 data-mlb-id="${escapeHtml(item.id)}"
                 ${isLinked ? '' : `data-action="select-mlb-item"`}>
                <div class="mlb-item-image">
                    <img src="${ensureHttps(item.thumbnail)}" alt="">
                </div>
                <div class="mlb-item-info">
                    <div class="mlb-item-title">${escapeHtml(item.title || 'Sem titulo')}</div>
                    <div class="mlb-item-meta">
                        <span class="mlb-item-price">R$ ${(item.price || 0).toFixed(2)}</span>
                        <span class="mlb-item-id">${escapeHtml(item.id)}</span>
                        <span class="mlb-item-status ${statusClass}">${statusText}</span>
                        ${isLinked ? '<span class="mlb-item-linked-badge"><i class="fas fa-link"></i> Ja vinculado</span>' : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ========== SELECIONAR ANUNCIO ==========
function selectMlbItem(mlbId) {
    selectedMlbId = mlbId;

    const selectedInput = document.getElementById('selectedMlbId');
    const saveBtn = document.getElementById('btnSaveMlbLink');

    if (selectedInput) selectedInput.value = mlbId;
    if (saveBtn) saveBtn.disabled = false;

    // Update UI
    document.querySelectorAll('.mlb-item').forEach(el => {
        el.classList.remove('selected');
        if (el.dataset.mlbId === mlbId) {
            el.classList.add('selected');
        }
    });
}

// ========== BUSCA DE ANUNCIOS ==========
function handleMlbSearch(e) {
    clearTimeout(mlItemsSearchTimer);
    mlItemsSearchTimer = setTimeout(() => {
        const searchTerm = e.target.value.toLowerCase().trim();
        if (!searchTerm) {
            renderMlItems(mlItems);
            return;
        }

        const filtered = mlItems.filter(item =>
            item.title.toLowerCase().includes(searchTerm) ||
            item.id.toLowerCase().includes(searchTerm)
        );
        renderMlItems(filtered);
    }, 300);
}

// ========== SALVAR VINCULACAO ==========
async function saveMlbLink() {
    const productIdInput = document.getElementById('linkingProductId');
    const productId = productIdInput ? productIdInput.value : linkingProductId;

    if (!productId) {
        window.showToast('Produto nao identificado', 'error');
        return;
    }

    const selectedInput = document.getElementById('selectedMlbId');
    const mlbId = selectedInput ? selectedInput.value : selectedMlbId;

    if (!mlbId) {
        window.showToast('Selecione um anuncio', 'warning');
        return;
    }

    try {
        window.showLoading();

        // Buscar detalhes do anuncio para pegar as fotos com IDs
        let mlPhotos = [];
        let mlPhotosWithIds = [];
        try {
            const detailsResponse = await fetch(`${ML_FUNCTIONS_URL}/mlGetItemDetails?mlbId=${mlbId}`);

            if (!detailsResponse.ok) {
                throw new Error(`HTTP ${detailsResponse.status}: ${detailsResponse.statusText}`);
            }

            const detailsData = await detailsResponse.json();

            if (detailsData.success && detailsData.item && detailsData.item.pictures) {
                // Guardar URLs e IDs das fotos
                mlPhotosWithIds = detailsData.item.pictures.map(pic => ({
                    id: pic.id,
                    url: ensureHttps(pic.url)
                }));
                mlPhotos = mlPhotosWithIds.map(p => p.url);
                window.logger?.log('[ML] Fotos sincronizadas:', mlPhotos.length, 'com IDs');
            }
        } catch (photoError) {
            window.logger?.warn('[ML] Nao foi possivel buscar fotos:', photoError);
        }

        // Salvar vinculo e fotos
        const updateData = {
            mlbId: mlbId,
            mlLinkedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (mlPhotos.length > 0) {
            updateData.mlPhotos = mlPhotos;
            updateData.mlPhotosWithIds = mlPhotosWithIds;  // Guardar com IDs para sync futuro
        }

        await window.db.collection('products').doc(productId).update(updateData);

        window.showToast('Produto vinculado ao ML!', 'success');
        closeLinkMlbModal();

        // Recarregar produtos se a funcao existir
        if (typeof window.loadProducts === 'function') {
            window.loadProducts();
        }
    } catch (error) {
        window.logger?.error('Erro ao vincular:', error);
        window.showToast('Erro ao vincular produto', 'error');
    } finally {
        window.hideLoading();
    }
}

// ========== DESVINCULAR MLB ==========
async function unlinkMlb(productId) {
    const { confirmModal } = await import('/shared/confirm-modal.js');
    const confirmed = await confirmModal({
        title: 'Desvincular Mercado Livre',
        message: 'Deseja desvincular este produto do Mercado Livre?',
        confirmText: 'Desvincular',
        danger: true
    });
    if (!confirmed) return;

    try {
        window.showLoading();

        await window.db.collection('products').doc(productId).update({
            mlbId: firebase.firestore.FieldValue.delete(),
            mlLinkedAt: firebase.firestore.FieldValue.delete()
        });

        window.showToast('Produto desvinculado', 'success');

        if (typeof window.loadProducts === 'function') {
            window.loadProducts();
        }
    } catch (error) {
        window.logger?.error('Erro ao desvincular:', error);
        window.showToast('Erro ao desvincular', 'error');
    } finally {
        window.hideLoading();
    }
}

// ========== ATUALIZAR ESTOQUE ML ==========
async function updateMlStock(mlbId, newQuantity) {
    try {
        const response = await fetch(`${ML_FUNCTIONS_URL}/mlUpdateStock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mlbId, quantity: newQuantity })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success) {
            window.logger?.log('[ML] Estoque atualizado:', mlbId, '->', newQuantity);
            return true;
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        window.logger?.error('Erro ao atualizar estoque ML:', error);
        return false;
    }
}

// ========== ATUALIZAR PRECO ML ==========
async function updateMlPrice(mlbId, newPrice) {
    try {
        const response = await fetch(`${ML_FUNCTIONS_URL}/mlUpdatePrice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mlbId, price: newPrice })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.success) {
            window.logger?.log('[ML] Preco atualizado:', mlbId, '->', newPrice);
            return true;
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        window.logger?.error('Erro ao atualizar preco ML:', error);
        return false;
    }
}

// ========== SINCRONIZAR PRODUTO COM ML ==========
async function syncProductToMl(productId, price, stock) {
    // Buscar produto para verificar se tem mlbId
    const product = window.products.find(p => p.id === productId);
    if (!product || !product.mlbId) {
        window.logger?.log('[ML] Produto sem vinculo ML, ignorando sync');
        return;
    }

    if (!mlConnected) {
        window.logger?.log('[ML] ML nao conectado, ignorando sync');
        return;
    }

    window.logger?.log('[ML] Sincronizando produto', productId, 'com ML', product.mlbId);

    let syncResults = [];

    // Atualizar estoque se fornecido
    if (stock !== undefined && stock !== null) {
        const stockOk = await updateMlStock(product.mlbId, stock);
        syncResults.push({ type: 'estoque', success: stockOk });
    }

    // Atualizar preco se fornecido
    if (price !== undefined && price !== null && price > 0) {
        const priceOk = await updateMlPrice(product.mlbId, price);
        syncResults.push({ type: 'preco', success: priceOk });
    }

    // Mostrar toast com resultado
    const successCount = syncResults.filter(r => r.success).length;
    if (syncResults.length > 0) {
        if (successCount === syncResults.length) {
            window.showToast('Produto sincronizado com ML!', 'success');
        } else if (successCount > 0) {
            window.showToast('Sincronizacao parcial com ML', 'warning');
        } else {
            window.showToast('Erro ao sincronizar com ML', 'error');
        }
    }

    return syncResults;
}

// ========== SINCRONIZAR FOTOS COM ML (BIDIRECIONAL) ==========
/**
 * Sincroniza fotos do produto com o Mercado Livre
 * - Fotos locais novas -> Upload para ML
 * - Fotos removidas -> Removidas do ML
 * - Reordenacao -> Atualiza ordem no ML
 *
 * @param {string} mlbId - ID do anuncio no ML (ex: MLB123456789)
 * @param {Array} editingPhotos - Array de fotos atuais [{ type: 'ml'|'local', url, id? }]
 * @param {Array} originalMlPhotos - Array de fotos originais do ML [{ id, url }]
 * @returns {Array|null} - Array de fotos atualizadas ou null se nao sincronizou
 */
async function syncPhotosToMl(mlbId, editingPhotos, originalMlPhotos = []) {
    if (!mlConnected) {
        window.logger?.log('[ML] Sync fotos ignorado - ML nao conectado');
        return null;
    }

    if (!mlbId) {
        window.logger?.log('[ML] Sync fotos ignorado - sem mlbId');
        return null;
    }

    // Verificar se houve mudanca nas fotos
    const hasChanges = detectPhotoChanges(editingPhotos, originalMlPhotos);

    if (!hasChanges) {
        window.logger?.log('[ML] Fotos nao mudaram, sync ignorado');
        return null;
    }

    window.logger?.log('[ML] Sincronizando fotos com ML...');
    window.logger?.log('[ML] Fotos atuais:', editingPhotos.length);
    window.logger?.log('[ML] Fotos originais ML:', originalMlPhotos.length);

    try {
        // Preparar array de fotos para enviar
        const pictures = editingPhotos.map(photo => {
            if (photo.type === 'ml') {
                // Foto do ML - enviar com ID para manter
                return {
                    type: 'ml',
                    id: photo.id || null,
                    url: photo.url
                };
            } else {
                // Foto local - enviar URL (base64) para upload
                return {
                    type: 'local',
                    url: photo.url
                };
            }
        });

        const response = await fetch(`${ML_FUNCTIONS_URL}/mlUpdateItemPhotos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mlbId, pictures })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
            window.logger?.log('[ML] Fotos sincronizadas com sucesso:', data.count);
            window.logger?.log('[ML] Upload results:', data.uploadResults);
            return data.photos; // Array com { id, url } atualizados
        } else {
            window.logger?.error('[ML] Erro ao sincronizar fotos:', data.error);
            if (data.details) {
                window.logger?.error('[ML] Detalhes:', data.details);
            }
            window.showToast('Erro ao sincronizar fotos com ML', 'error');
            return null;
        }

    } catch (error) {
        window.logger?.error('[ML] Erro na requisicao sync fotos:', error);
        window.showToast('Erro de conexao ao sincronizar fotos', 'error');
        return null;
    }
}

/**
 * Detecta se houve mudanca nas fotos (adicao, remocao ou reordenacao)
 */
function detectPhotoChanges(editingPhotos, originalMlPhotos) {
    // Se nao tinha fotos e agora tem
    if (originalMlPhotos.length === 0 && editingPhotos.length > 0) {
        // Verificar se tem fotos locais novas
        const hasLocalPhotos = editingPhotos.some(p => p.type === 'local');
        if (hasLocalPhotos) {
            window.logger?.log('[ML] Mudanca detectada: fotos locais novas adicionadas');
            return true;
        }
    }

    // Comparar quantidade de fotos ML
    const currentMlPhotos = editingPhotos.filter(p => p.type === 'ml');
    if (currentMlPhotos.length !== originalMlPhotos.length) {
        window.logger?.log('[ML] Mudanca detectada: quantidade de fotos ML diferente');
        return true;
    }

    // Verificar se alguma foto ML foi removida (IDs diferentes)
    const currentMlIds = new Set(currentMlPhotos.map(p => p.id).filter(Boolean));
    const originalMlIds = new Set(originalMlPhotos.map(p => p.id).filter(Boolean));

    for (const id of originalMlIds) {
        if (!currentMlIds.has(id)) {
            window.logger?.log('[ML] Mudanca detectada: foto ML removida', id);
            return true;
        }
    }

    // Verificar se tem fotos locais novas
    const localPhotos = editingPhotos.filter(p => p.type === 'local');
    if (localPhotos.length > 0) {
        window.logger?.log('[ML] Mudanca detectada: fotos locais para upload');
        return true;
    }

    // Verificar se a ordem mudou (comparar sequencia de IDs)
    const currentMlIdsArray = currentMlPhotos.map(p => p.id);
    const originalMlIdsArray = originalMlPhotos.map(p => p.id);

    for (let i = 0; i < currentMlIdsArray.length; i++) {
        if (currentMlIdsArray[i] !== originalMlIdsArray[i]) {
            window.logger?.log('[ML] Mudanca detectada: ordem das fotos alterada');
            return true;
        }
    }

    return false;
}

// ========== SINCRONIZAR CAMPOS SELETIVOS COM ML ==========
async function syncProductToMlSelective(mlbId, price, stock) {
    if (!mlConnected) {
        window.logger?.log('[ML] ML nao conectado, ignorando sync');
        return;
    }

    if (!mlbId) {
        window.logger?.log('[ML] Sem mlbId, ignorando sync');
        return;
    }

    window.logger?.log('[ML] Sincronizando seletivamente:', { mlbId, price, stock });

    let syncResults = [];
    let syncMessages = [];

    // Atualizar estoque apenas se especificado (nao null)
    if (stock !== null && stock !== undefined) {
        const stockOk = await updateMlStock(mlbId, stock);
        syncResults.push({ type: 'estoque', success: stockOk });
        if (stockOk) syncMessages.push('estoque');
    }

    // Atualizar preco apenas se especificado (nao null)
    if (price !== null && price !== undefined && price > 0) {
        const priceOk = await updateMlPrice(mlbId, price);
        syncResults.push({ type: 'preco', success: priceOk });
        if (priceOk) syncMessages.push('preco');
    }

    // Mostrar toast com resultado especifico
    const successCount = syncResults.filter(r => r.success).length;
    if (syncResults.length > 0) {
        if (successCount === syncResults.length) {
            window.showToast(`ML atualizado: ${syncMessages.join(' e ')}`, 'success');
        } else if (successCount > 0) {
            window.showToast('Sincronizacao parcial com ML', 'warning');
        } else {
            window.showToast('Erro ao sincronizar com ML', 'error');
        }
    }

    return syncResults;
}

// ========== SINCRONIZAR DESCRICAO ==========
async function syncDescriptionToMl(mlbId, description) {
    if (!mlConnected) {
        window.logger?.log('[ML] ML nao conectado, ignorando sync de descricao');
        return false;
    }

    if (!mlbId) {
        window.logger?.log('[ML] Sem mlbId, ignorando sync de descricao');
        return false;
    }

    window.logger?.log('[ML] Sincronizando descricao:', { mlbId, descriptionLength: description?.length });

    try {
        const response = await fetch(`${ML_FUNCTIONS_URL}/mlUpdateDescription`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mlbId, description: description || '' })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success) {
            window.showToast('Descricao sincronizada com ML', 'success');
            window.logger?.log('[ML] Descricao sincronizada com sucesso');
            return true;
        } else {
            throw new Error(data.error || 'Erro desconhecido');
        }
    } catch (error) {
        window.logger?.error('[ML] Erro ao sincronizar descricao:', error);
        window.showToast('Erro ao sincronizar descricao com ML', 'error');
        return false;
    }
}

// ========== SINCRONIZAR TITULO ==========
async function syncTitleToMl(mlbId, title) {
    if (!mlConnected) {
        window.logger?.log('[ML] ML nao conectado, ignorando sync de titulo');
        return false;
    }

    if (!mlbId) {
        window.logger?.log('[ML] Sem mlbId, ignorando sync de titulo');
        return false;
    }

    if (!title || title.trim().length === 0) {
        window.logger?.log('[ML] Titulo vazio, ignorando sync');
        return false;
    }

    window.logger?.log('[ML] Sincronizando titulo:', { mlbId, title });

    try {
        const response = await fetch(`${ML_FUNCTIONS_URL}/mlUpdateTitle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mlbId, title: title.trim() })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.success) {
            window.showToast('Titulo sincronizado com ML', 'success');
            window.logger?.log('[ML] Titulo sincronizado com sucesso');
            return true;
        } else {
            // Verificar se e erro de catalogo
            if (data.reason === 'catalog_item') {
                window.showToast('Titulo gerenciado pelo catalogo ML', 'warning');
                window.logger?.log('[ML] Titulo nao pode ser alterado - item de catalogo');
                return false;
            }
            throw new Error(data.error || 'Erro desconhecido');
        }
    } catch (error) {
        window.logger?.error('[ML] Erro ao sincronizar titulo:', error);
        window.showToast('Erro ao sincronizar titulo com ML', 'error');
        return false;
    }
}

// ========== UTILITARIOS ==========
function ensureHttps(url) {
    if (!url) return '';
    return url.replace(/^http:\/\//i, 'https://');
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
}

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('pt-BR');
}

// ========== EXPORTAR PARA GLOBAL ==========
window.connectMercadoLivre = connectMercadoLivre;
window.connectMl = connectMercadoLivre;
window.checkMlStatus = checkMlStatus;
window.loadPendingOrders = loadPendingOrders;
window.loadSalesHistory = loadSalesHistory;
window.viewOrderDetails = viewOrderDetails;
window.closeOrderDetailsModal = closeOrderDetailsModal;
window.openLinkMlbModal = openLinkMlbModal;
window.closeLinkMlbModal = closeLinkMlbModal;
window.loadMlItems = loadMlItems;
window.selectMlbItem = selectMlbItem;
window.saveMlbLink = saveMlbLink;
window.unlinkMlb = unlinkMlb;
window.updateMlStock = updateMlStock;
window.updateMlPrice = updateMlPrice;
window.syncProductToMl = syncProductToMl;
window.syncProductToMlSelective = syncProductToMlSelective;
window.syncDescriptionToMl = syncDescriptionToMl;
window.syncTitleToMl = syncTitleToMl;
window.syncPhotosToMl = syncPhotosToMl;
window.detectPhotoChanges = detectPhotoChanges;
window.isMlConnected = () => mlConnected;
window.ML_FUNCTIONS_URL = ML_FUNCTIONS_URL;
