/*
==================================================
ARQUIVO: marketplace/js/marketplace-ml.js
MODULO: Integracao Mercado Livre
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 1.0
==================================================
*/

// URL base das Cloud Functions
const ML_FUNCTIONS_URL = 'https://us-central1-imaginatech-servicos.cloudfunctions.net';

// Estado da conexao ML
let mlConnected = false;
let mlNickname = null;

// ========== INICIALIZACAO ==========
document.addEventListener('DOMContentLoaded', () => {
    // Verificar parametros de URL (retorno do OAuth)
    checkOAuthReturn();

    // Verificar status da conexao ML
    checkMlStatus();
});

// ========== VERIFICAR RETORNO OAUTH ==========
function checkOAuthReturn() {
    const urlParams = new URLSearchParams(window.location.search);

    if (urlParams.get('ml_connected') === 'true') {
        window.showToast('Mercado Livre conectado com sucesso!', 'success');
        // Limpar URL
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (urlParams.get('ml_error') === 'true') {
        window.showToast('Erro ao conectar com Mercado Livre', 'error');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// ========== VERIFICAR STATUS ML ==========
async function checkMlStatus() {
    try {
        const response = await fetch(`${ML_FUNCTIONS_URL}/mlStatus`);
        const data = await response.json();

        updateMlStatusUI(data);
    } catch (error) {
        console.error('Erro ao verificar status ML:', error);
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
        statusText.innerHTML = `<strong>${status.nickname || 'Conectado'}</strong>`;
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
    // Abrir popup de autorizacao
    const authUrl = `${ML_FUNCTIONS_URL}/mlAuth`;

    // Abrir em nova janela
    const popup = window.open(authUrl, 'mlAuth', 'width=600,height=700,scrollbars=yes');

    if (!popup) {
        // Popup bloqueado, redirecionar
        window.location.href = authUrl;
    }
}

// ========== SINCRONIZAR PRODUTO COM ML ==========
async function syncProductToML(productId) {
    if (!mlConnected) {
        window.showToast('Conecte ao Mercado Livre primeiro', 'warning');
        return;
    }

    try {
        window.showLoading();

        const response = await fetch(`${ML_FUNCTIONS_URL}/syncProductToML`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId })
        });

        const data = await response.json();

        if (data.success) {
            window.showToast('Produto sincronizado com ML!', 'success');
        } else {
            window.showToast(data.error || 'Erro ao sincronizar', 'error');
        }
    } catch (error) {
        console.error('Erro ao sincronizar produto:', error);
        window.showToast('Erro ao sincronizar com ML', 'error');
    } finally {
        window.hideLoading();
    }
}

// ========== VINCULAR PRODUTO AO ANUNCIO ML ==========
async function linkProductToML(productId) {
    if (!mlConnected) {
        window.showToast('Conecte ao Mercado Livre primeiro', 'warning');
        return;
    }

    // Abrir modal para selecionar anuncio ML
    openMlLinkModal(productId);
}

// ========== MODAL PARA VINCULAR ANUNCIO ==========
async function openMlLinkModal(productId) {
    // Buscar produto para verificar dados
    const product = window.products.find(p => p.id === productId);
    const missingFields = [];

    if (!product.price || product.price <= 0) missingFields.push('Preco');
    if (!product.mlCategoryId) missingFields.push('Categoria ML');
    if (!product.photos || product.photos.length === 0) missingFields.push('Fotos');

    // Criar modal dinamicamente
    const existingModal = document.getElementById('mlLinkModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'mlLinkModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-container">
            <div class="modal-header">
                <h2><img src="https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/6.6.73/mercadolibre/favicon.svg" alt="ML" style="width:24px;height:24px;margin-right:8px;"> Publicar no Mercado Livre</h2>
                <button class="modal-close" onclick="closeMlLinkModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body" style="padding:20px;">
                <!-- Opcao 1: Criar novo anuncio -->
                <div class="ml-create-new" style="margin-bottom:24px;padding:20px;background:rgba(0,255,148,0.08);border:1px solid rgba(0,255,148,0.3);border-radius:12px;">
                    <h3 style="margin:0 0 12px;color:var(--neon-green);font-size:1rem;display:flex;align-items:center;gap:8px;">
                        <i class="fas fa-plus-circle"></i> Criar Novo Anuncio
                    </h3>
                    ${missingFields.length > 0 ? `
                        <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:12px;">
                            <i class="fas fa-exclamation-triangle" style="color:var(--neon-orange);margin-right:6px;"></i>
                            Campos faltando: <strong style="color:var(--neon-orange);">${missingFields.join(', ')}</strong>
                        </p>
                        <button class="btn-secondary" onclick="openEditFromMlModal('${productId}')" style="width:100%;">
                            <i class="fas fa-edit"></i> Completar dados do produto
                        </button>
                    ` : `
                        <p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:12px;">
                            <i class="fas fa-check-circle" style="color:var(--neon-green);margin-right:6px;"></i>
                            Produto pronto para publicar: <strong>R$ ${product.price?.toFixed(2) || '0,00'}</strong>
                        </p>
                        <button class="btn-primary" onclick="publishFromMlModal('${productId}')" style="width:100%;background:linear-gradient(135deg, var(--neon-green), #00cc7a);">
                            <i class="fas fa-cloud-upload-alt"></i> Criar Anuncio no ML
                        </button>
                    `}
                </div>

                <!-- Separador -->
                <div style="display:flex;align-items:center;gap:15px;margin-bottom:24px;">
                    <div style="flex:1;height:1px;background:var(--glass-border);"></div>
                    <span style="color:var(--text-muted);font-size:0.85rem;">OU</span>
                    <div style="flex:1;height:1px;background:var(--glass-border);"></div>
                </div>

                <!-- Opcao 2: Vincular anuncio existente -->
                <div class="ml-link-existing">
                    <h3 style="margin:0 0 16px;color:#FFE600;font-size:1rem;display:flex;align-items:center;gap:8px;">
                        <i class="fas fa-link"></i> Vincular a Anuncio Existente
                    </h3>
                    <div class="ml-loading" style="text-align:center;padding:30px;">
                        <div class="loading-spinner"></div>
                        <p style="margin-top:15px;color:var(--text-secondary);">Carregando seus anuncios...</p>
                    </div>
                    <div class="ml-items-list" style="display:none;max-height:250px;overflow-y:auto;"></div>
                    <div class="ml-manual-input" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--glass-border);">
                        <p style="color:var(--text-muted);margin-bottom:10px;font-size:0.85rem;">Ou insira o MLB ID manualmente:</p>
                        <div style="display:flex;gap:10px;">
                            <input type="text" id="mlbIdInput" class="form-input" placeholder="MLB1234567890" style="flex:1;">
                            <button class="btn-primary" onclick="saveMlbId('${productId}')" style="background:linear-gradient(135deg, #FFE600, #FFC400);color:#000;">
                                <i class="fas fa-link"></i> Vincular
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Carregar anuncios do ML se estiver conectado
    if (mlConnected) {
        loadMlItems(productId);
    } else {
        const loadingDiv = document.querySelector('#mlLinkModal .ml-loading');
        if (loadingDiv) {
            loadingDiv.innerHTML = `
                <p style="color:var(--text-muted);text-align:center;">
                    <i class="fas fa-plug" style="font-size:2rem;margin-bottom:10px;display:block;opacity:0.5;"></i>
                    Conecte sua conta do Mercado Livre para ver seus anuncios
                </p>
            `;
        }
    }
}

// ========== CARREGAR ANUNCIOS DO ML ==========
async function loadMlItems(productId) {
    try {
        const response = await fetch(`${ML_FUNCTIONS_URL}/mlListItems`);
        const data = await response.json();

        const loadingDiv = document.querySelector('#mlLinkModal .ml-loading');
        const listDiv = document.querySelector('#mlLinkModal .ml-items-list');

        if (loadingDiv) loadingDiv.style.display = 'none';
        if (listDiv) {
            listDiv.style.display = 'block';

            if (data.items && data.items.length > 0) {
                listDiv.innerHTML = data.items.map(item => `
                    <div class="ml-item" onclick="selectMlItem('${productId}', '${item.id}')" style="
                        display:flex;
                        align-items:center;
                        gap:15px;
                        padding:12px;
                        border-radius:8px;
                        cursor:pointer;
                        transition:background 0.2s;
                        border:1px solid var(--glass-stroke);
                        margin-bottom:8px;
                    " onmouseover="this.style.background='var(--glass-bg)'" onmouseout="this.style.background='transparent'">
                        <img src="${item.thumbnail}" alt="" style="width:50px;height:50px;object-fit:contain;border-radius:4px;background:#fff;">
                        <div style="flex:1;min-width:0;">
                            <p style="margin:0;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.title}</p>
                            <p style="margin:4px 0 0;font-size:0.85rem;color:var(--text-secondary);">${item.id} - R$ ${item.price.toFixed(2)}</p>
                        </div>
                        <span class="badge badge-${item.status === 'active' ? 'estoque' : 'personalizacao'}" style="font-size:0.75rem;">
                            ${item.status === 'active' ? 'Ativo' : item.status}
                        </span>
                    </div>
                `).join('');
            } else {
                listDiv.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:20px;">Nenhum anuncio encontrado no Mercado Livre</p>';
            }
        }
    } catch (error) {
        console.error('Erro ao carregar anuncios ML:', error);
        const loadingDiv = document.querySelector('#mlLinkModal .ml-loading');
        if (loadingDiv) {
            loadingDiv.innerHTML = '<p style="color:var(--danger);">Erro ao carregar anuncios</p>';
        }
    }
}

// ========== SELECIONAR ANUNCIO ML ==========
function selectMlItem(productId, mlbId) {
    document.getElementById('mlbIdInput').value = mlbId;
    saveMlbId(productId);
}

// ========== SALVAR MLB ID NO PRODUTO ==========
async function saveMlbId(productId) {
    const mlbId = document.getElementById('mlbIdInput').value.trim();

    if (!mlbId) {
        window.showToast('Insira o MLB ID', 'warning');
        return;
    }

    try {
        window.showLoading();

        await window.db.collection('products').doc(productId).update({
            mlbId: mlbId,
            mlLinkedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        window.showToast('Produto vinculado ao ML!', 'success');
        closeMlLinkModal();
    } catch (error) {
        console.error('Erro ao vincular produto:', error);
        window.showToast('Erro ao vincular produto', 'error');
    } finally {
        window.hideLoading();
    }
}

// ========== FECHAR MODAL ML ==========
function closeMlLinkModal() {
    const modal = document.getElementById('mlLinkModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

// ========== ABRIR EDICAO A PARTIR DO MODAL ML ==========
// Fecha o modal ML primeiro, depois abre o modal de edicao
function openEditFromMlModal(productId) {
    const modal = document.getElementById('mlLinkModal');
    if (modal) {
        modal.classList.remove('active');
        modal.remove(); // Remove imediatamente para evitar conflitos
    }

    // Pequeno delay para garantir que o DOM esta limpo
    setTimeout(() => {
        console.log('[ML-MODAL] Abrindo edicao do produto:', productId);
        window.editProduct(productId);
    }, 100);
}

// ========== PUBLICAR A PARTIR DO MODAL ML ==========
function publishFromMlModal(productId) {
    const modal = document.getElementById('mlLinkModal');
    if (modal) {
        modal.classList.remove('active');
        modal.remove();
    }

    setTimeout(() => {
        publishToML(productId);
    }, 100);
}

// ========== PUBLICAR NOVO ANUNCIO NO ML ==========
async function publishToML(productId) {
    if (!mlConnected) {
        window.showToast('Conecte ao Mercado Livre primeiro', 'warning');
        return;
    }

    // Buscar produto localmente
    const product = window.products.find(p => p.id === productId);
    if (!product) {
        window.showToast('Produto nao encontrado', 'error');
        return;
    }

    // Validar campos obrigatorios para publicacao
    if (!product.name || !product.price || !product.mlCategoryId) {
        window.showToast('Preencha nome, preco e categoria ML antes de publicar', 'warning');
        // Abrir modal de edicao
        window.editProduct(productId);
        return;
    }

    if (!product.photos || product.photos.length === 0) {
        window.showToast('Adicione pelo menos uma foto antes de publicar', 'warning');
        window.editProduct(productId);
        return;
    }

    // Confirmar publicacao
    if (!confirm(`Deseja publicar "${product.name}" no Mercado Livre por R$ ${product.price.toFixed(2)}?`)) {
        return;
    }

    try {
        window.showLoading();

        const response = await fetch(`${ML_FUNCTIONS_URL}/createMLItem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId })
        });

        const data = await response.json();

        if (data.success) {
            window.showToast(`Anuncio criado com sucesso! MLB ID: ${data.mlbId}`, 'success');

            // Atualizar produto local com mlbId
            await window.db.collection('products').doc(productId).update({
                mlbId: data.mlbId,
                mlPublishedAt: firebase.firestore.FieldValue.serverTimestamp(),
                mlPermalink: data.permalink
            });

        } else {
            window.showToast(data.error || 'Erro ao criar anuncio', 'error');
            console.error('Erro ML:', data);
        }
    } catch (error) {
        console.error('Erro ao publicar no ML:', error);
        window.showToast('Erro ao publicar no Mercado Livre', 'error');
    } finally {
        window.hideLoading();
    }
}

// ========== PAUSAR/ATIVAR ANUNCIO NO ML ==========
async function toggleListingStatus() {
    // Buscar produto sendo editado
    const productId = window.editingProductId;
    if (!productId) {
        window.showToast('Nenhum produto selecionado', 'warning');
        return;
    }

    const product = window.products.find(p => p.id === productId);
    if (!product || !product.mlbId) {
        window.showToast('Produto nao esta publicado no ML', 'warning');
        return;
    }

    const isPaused = product.mlStatus === 'paused';
    const newStatus = isPaused ? 'active' : 'paused';
    const actionText = isPaused ? 'ativar' : 'pausar';

    if (!confirm(`Deseja ${actionText} o anuncio "${product.name}" no Mercado Livre?`)) {
        return;
    }

    try {
        window.showLoading();
        window.showToast(`${isPaused ? 'Ativando' : 'Pausando'} anuncio...`, 'info');

        const response = await fetch(`${ML_FUNCTIONS_URL}/updateMLItemStatus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mlbId: product.mlbId,
                status: newStatus
            })
        });

        const data = await response.json();

        if (data.success) {
            // Atualizar status no Firestore
            await window.db.collection('products').doc(productId).update({
                mlStatus: newStatus,
                mlStatusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            window.showToast(`Anuncio ${isPaused ? 'ativado' : 'pausado'} com sucesso!`, 'success');

            // Atualizar UI
            const btnPause = document.getElementById('btnPauseListing');
            const mlStatusDiv = document.getElementById('mlProductStatus');

            if (btnPause) {
                if (newStatus === 'paused') {
                    btnPause.classList.add('paused');
                    btnPause.innerHTML = '<i class="fas fa-play"></i><span>Ativar</span>';
                    btnPause.title = 'Ativar anuncio';
                } else {
                    btnPause.classList.remove('paused');
                    btnPause.innerHTML = '<i class="fas fa-pause"></i><span>Pausar</span>';
                    btnPause.title = 'Pausar anuncio';
                }
            }

            if (mlStatusDiv) {
                const statusText = newStatus === 'paused' ? 'Pausado' : 'Ativo';
                const statusClass = newStatus === 'paused' ? 'ml-paused' : 'ml-published';
                const statusIcon = newStatus === 'paused' ? 'fa-pause-circle' : 'fa-check-circle';

                mlStatusDiv.innerHTML = `
                    <span class="ml-badge ${statusClass}">
                        <i class="fas ${statusIcon}"></i> ${statusText}: ${product.mlbId}
                    </span>
                    <a href="https://produto.mercadolivre.com.br/${product.mlbId}" target="_blank" class="btn-icon" title="Ver no ML">
                        <i class="fas fa-external-link-alt"></i>
                    </a>
                `;
            }

        } else {
            window.showToast(data.error || `Erro ao ${actionText} anuncio`, 'error');
            console.error('Erro ML:', data);
        }
    } catch (error) {
        console.error('Erro ao alterar status do anuncio:', error);
        window.showToast(`Erro ao ${actionText} anuncio`, 'error');
    } finally {
        window.hideLoading();
    }
}

// ========== EXPORTAR PARA GLOBAL ==========
window.connectMercadoLivre = connectMercadoLivre;
window.connectMl = connectMercadoLivre; // Alias para o botao do HTML
window.syncProductToML = syncProductToML;
window.linkProductToML = linkProductToML;
window.checkMlStatus = checkMlStatus;
window.closeMlLinkModal = closeMlLinkModal;
window.openEditFromMlModal = openEditFromMlModal;
window.publishFromMlModal = publishFromMlModal;
window.publishToML = publishToML;
window.saveMlbId = saveMlbId;
window.selectMlItem = selectMlItem;
window.toggleListingStatus = toggleListingStatus;
