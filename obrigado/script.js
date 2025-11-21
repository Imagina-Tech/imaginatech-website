// ===========================
// PÁGINA DE AGRADECIMENTO
// ImaginaTech - Pós-Compra
// ===========================

document.addEventListener('DOMContentLoaded', () => {
    initPage();
    createConfetti();
});

// ===========================
// INICIALIZAÇÃO
// ===========================
function initPage() {
    // Obter código do pedido da URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderCode = urlParams.get('pedido') || urlParams.get('order') || urlParams.get('code');

    if (orderCode) {
        document.getElementById('orderCode').textContent = `#${orderCode.toUpperCase()}`;
    } else {
        // Se não houver código, mostrar mensagem genérica
        document.getElementById('orderCode').textContent = 'Confira seu e-mail';
    }

    // Event listeners
    document.getElementById('newsletterForm')?.addEventListener('submit', handleNewsletter);
}

// ===========================
// CONFETTI ANIMATION
// ===========================
function createConfetti() {
    const container = document.getElementById('confettiContainer');
    if (!container) return;

    const colors = ['#00D4FF', '#9945FF', '#00FF88', '#FFD700', '#FF0055'];
    const shapes = ['square', 'circle'];

    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';

            const color = colors[Math.floor(Math.random() * colors.length)];
            const shape = shapes[Math.floor(Math.random() * shapes.length)];
            const left = Math.random() * 100;
            const delay = Math.random() * 0.5;
            const duration = 2 + Math.random() * 2;

            confetti.style.cssText = `
                left: ${left}%;
                background: ${color};
                border-radius: ${shape === 'circle' ? '50%' : '2px'};
                animation-delay: ${delay}s;
                animation-duration: ${duration}s;
            `;

            container.appendChild(confetti);

            // Remover após animação
            setTimeout(() => confetti.remove(), (delay + duration) * 1000);
        }, i * 50);
    }
}

// ===========================
// SOCIAL SHARING
// ===========================
function shareOnInstagram() {
    // Instagram não tem API de share direto, abrir perfil
    window.open('https://www.instagram.com/imaginatech3d/', '_blank');
    showToast('Siga-nos no Instagram!', 'success');
}

function shareOnFacebook() {
    const url = encodeURIComponent('https://imaginatech.com.br');
    const text = encodeURIComponent('Acabei de fazer um pedido na ImaginaTech! Impressão 3D de qualidade.');
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`, '_blank', 'width=600,height=400');
}

function shareOnTwitter() {
    const url = encodeURIComponent('https://imaginatech.com.br');
    const text = encodeURIComponent('Acabei de fazer um pedido na @ImaginaTech3D! Impressão 3D de qualidade. 🚀');
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank', 'width=600,height=400');
}

function copyLink() {
    navigator.clipboard.writeText('https://imaginatech.com.br').then(() => {
        showToast('Link copiado!', 'success');
    }).catch(() => {
        showToast('Erro ao copiar link', 'error');
    });
}

// ===========================
// NEWSLETTER
// ===========================
function handleNewsletter(e) {
    e.preventDefault();

    const form = e.target;
    const email = form.querySelector('input[type="email"]').value;

    if (!email) {
        showToast('Digite seu e-mail', 'error');
        return;
    }

    // Aqui você pode integrar com seu serviço de e-mail marketing
    // Por enquanto, apenas mostra mensagem de sucesso
    showToast('E-mail cadastrado com sucesso!', 'success');
    form.reset();

    // Opcional: Salvar no localStorage para não mostrar novamente
    localStorage.setItem('newsletter_subscribed', 'true');
}

// ===========================
// TOAST NOTIFICATIONS
// ===========================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? 'fa-check-circle' :
                 type === 'error' ? 'fa-exclamation-circle' :
                 'fa-info-circle';

    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Auto-remove após 3 segundos
    setTimeout(() => {
        toast.style.animation = 'toast-in 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Expor funções globalmente
window.shareOnInstagram = shareOnInstagram;
window.shareOnFacebook = shareOnFacebook;
window.shareOnTwitter = shareOnTwitter;
window.copyLink = copyLink;
