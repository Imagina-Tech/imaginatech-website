/**
 * =============================================
 * CONFIRM MODAL - Componente Compartilhado
 * /shared/confirm-modal.js
 *
 * Modal de confirmacao customizado com glassmorphism
 * Substitui o confirm() nativo do navegador
 * Usado em: estoque, financas, marketplace, servicos
 * =============================================
 */

/**
 * Escapa caracteres HTML para prevenir XSS
 * @param {string} str - String para escapar
 * @returns {string} String escapada
 */
function escapeHtmlConfirm(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Exibe um modal de confirmacao customizado e retorna uma Promise<boolean>
 * @param {Object} options - Opcoes do modal
 * @param {string} [options.title='Confirmar'] - Titulo do modal
 * @param {string} options.message - Mensagem de confirmacao
 * @param {string} [options.confirmText='Confirmar'] - Texto do botao de confirmacao
 * @param {string} [options.cancelText='Cancelar'] - Texto do botao de cancelar
 * @param {boolean} [options.danger=true] - Se true, botao de confirmar e vermelho (para acoes destrutivas)
 * @returns {Promise<boolean>} true se confirmado, false se cancelado
 */
export async function confirmModal({
    title = 'Confirmar',
    message = '',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    danger = true
} = {}) {
    return new Promise((resolve) => {
        // Determinar icone baseado no tipo
        let iconClass = 'fas fa-question-circle';
        let iconType = 'info';
        if (danger) {
            iconClass = 'fas fa-exclamation-triangle';
            iconType = 'danger';
        }

        // Determinar classe do botao de confirmacao
        const confirmBtnClass = danger
            ? 'confirm-modal-btn confirm-modal-btn-danger'
            : 'confirm-modal-btn confirm-modal-btn-primary';

        // Criar overlay
        const overlay = document.createElement('div');
        overlay.className = 'confirm-modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'confirmModalTitle');

        // Criar HTML do modal
        overlay.innerHTML = `
            <div class="confirm-modal-box">
                <h3 class="confirm-modal-title" id="confirmModalTitle">
                    <i class="confirm-modal-icon ${iconType} ${escapeHtmlConfirm(iconClass)}"></i>
                    ${escapeHtmlConfirm(title)}
                </h3>
                <p class="confirm-modal-message">${escapeHtmlConfirm(message)}</p>
                <div class="confirm-modal-buttons">
                    <button class="confirm-modal-btn confirm-modal-btn-cancel" data-confirm-action="cancel">
                        ${escapeHtmlConfirm(cancelText)}
                    </button>
                    <button class="${confirmBtnClass}" data-confirm-action="confirm">
                        ${escapeHtmlConfirm(confirmText)}
                    </button>
                </div>
            </div>
        `;

        // Funcao de cleanup e resolucao
        function cleanup(result) {
            // Animar saida
            overlay.classList.remove('confirm-modal-visible');
            setTimeout(() => {
                overlay.remove();
                document.removeEventListener('keydown', handleKeydown);
            }, 200);
            resolve(result);
        }

        // Handler de teclado (Escape para cancelar)
        function handleKeydown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                cleanup(false);
            }
        }

        // Clique no overlay (fora do modal) para cancelar
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cleanup(false);
            }
        });

        // Clique nos botoes via delegacao de eventos
        overlay.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-confirm-action]');
            if (!btn) return;

            const action = btn.dataset.confirmAction;
            if (action === 'confirm') {
                cleanup(true);
            } else if (action === 'cancel') {
                cleanup(false);
            }
        });

        // Registrar handler de teclado
        document.addEventListener('keydown', handleKeydown);

        // Adicionar ao DOM
        document.body.appendChild(overlay);

        // Trigger de animacao (precisa de um frame para a transicao funcionar)
        requestAnimationFrame(() => {
            overlay.classList.add('confirm-modal-visible');
            // Focar no botao de cancelar por padrao (acao mais segura)
            const cancelBtn = overlay.querySelector('[data-confirm-action="cancel"]');
            if (cancelBtn) cancelBtn.focus();
        });
    });
}
