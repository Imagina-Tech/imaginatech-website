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
    const nicknameText = document.getElementById('mlNickname');
    const connectBtn = document.getElementById('btnMlConnect');

    if (!statusCard) return;

    mlConnected = status.connected;
    mlNickname = status.nickname;

    if (status.connected) {
        statusCard.classList.add('connected');
        statusText.textContent = 'Conectado';
        nicknameText.textContent = status.nickname || 'Mercado Livre';
        connectBtn.innerHTML = '<i class="fas fa-check"></i>';
        connectBtn.title = 'Reconectar';
    } else {
        statusCard.classList.remove('connected');
        statusText.textContent = 'Desconectado';
        nicknameText.textContent = 'Mercado Livre';
        connectBtn.innerHTML = '<i class="fas fa-plug"></i>';
        connectBtn.title = 'Conectar ao Mercado Livre';
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
    // Criar modal dinamicamente
    const existingModal = document.getElementById('mlLinkModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'mlLinkModal';
    modal.className = 'modal-overlay active';
    modal.innerHTML = `
        <div class="modal-container">
            <div class="modal-header">
                <h2><img src="https://http2.mlstatic.com/frontend-assets/ml-web-navigation/ui-navigation/6.6.73/mercadolibre/favicon.svg" alt="ML" style="width:24px;height:24px;margin-right:8px;"> Vincular ao Mercado Livre</h2>
                <button class="modal-close" onclick="closeMlLinkModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body" style="padding:20px;">
                <div class="ml-loading" style="text-align:center;padding:40px;">
                    <div class="loading-spinner"></div>
                    <p style="margin-top:15px;color:var(--text-secondary);">Carregando anuncios...</p>
                </div>
                <div class="ml-items-list" style="display:none;max-height:400px;overflow-y:auto;"></div>
                <div class="ml-manual-input" style="margin-top:20px;padding-top:20px;border-top:1px solid var(--glass-stroke);">
                    <p style="color:var(--text-secondary);margin-bottom:10px;font-size:0.9rem;">Ou insira o MLB ID manualmente:</p>
                    <div style="display:flex;gap:10px;">
                        <input type="text" id="mlbIdInput" class="form-input" placeholder="MLB1234567890" style="flex:1;">
                        <button class="btn-primary" onclick="saveMlbId('${productId}')">
                            <i class="fas fa-link"></i> Vincular
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Carregar anuncios do ML
    loadMlItems(productId);
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

// ========== EXPORTAR PARA GLOBAL ==========
window.connectMercadoLivre = connectMercadoLivre;
window.syncProductToML = syncProductToML;
window.linkProductToML = linkProductToML;
window.checkMlStatus = checkMlStatus;
window.closeMlLinkModal = closeMlLinkModal;
