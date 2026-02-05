/**
 * NAVBAR MOBILE - JavaScript Compartilhado
 * /shared/navbar-mobile.js
 *
 * Sistema responsivo que gerencia o dropdown de navegacao em telas pequenas.
 *
 * Uso:
 * 1. Adicionar <script src="/shared/navbar-mobile.js"></script> no HTML (antes do </body>)
 * 2. Usar os IDs: btnMobileMenu (botao) e mobileNavDropdown (dropdown)
 * 3. O botao deve ter onclick="toggleMobileMenu()"
 *
 * Funcionalidades:
 * - Toggle do dropdown ao clicar no botao
 * - Fecha automaticamente ao clicar fora
 * - Rotaciona icone chevron (classe .open no botao)
 */

/**
 * Alterna a visibilidade do menu dropdown mobile
 */
function toggleMobileMenu() {
    const dropdown = document.getElementById('mobileNavDropdown');
    const btn = document.getElementById('btnMobileMenu');

    if (!dropdown || !btn) {
        (window.logger || console).warn('Navbar Mobile: Elementos nao encontrados (mobileNavDropdown ou btnMobileMenu)');
        return;
    }

    const isOpen = dropdown.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
}

/**
 * Fecha o menu mobile
 */
function closeMobileMenu() {
    const dropdown = document.getElementById('mobileNavDropdown');
    const btn = document.getElementById('btnMobileMenu');

    if (dropdown) dropdown.classList.remove('open');
    if (btn) btn.classList.remove('open');
}

/**
 * Event listener para fechar menu ao clicar fora
 */
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('mobileNavDropdown');
    const btn = document.getElementById('btnMobileMenu');

    // Se os elementos nao existem, sair
    if (!dropdown || !btn) return;

    // Se o clique foi fora do dropdown E fora do botao, fechar
    if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
        closeMobileMenu();
    }
});

/**
 * Fecha o menu ao clicar em qualquer item de navegacao
 * (util para SPAs ou quando o link e para a mesma pagina)
 */
document.addEventListener('DOMContentLoaded', function() {
    const dropdown = document.getElementById('mobileNavDropdown');

    if (!dropdown) return;

    // Adicionar listener em todos os itens do menu
    const items = dropdown.querySelectorAll('.mobile-nav-item');
    items.forEach(function(item) {
        item.addEventListener('click', function() {
            // Pequeno delay para permitir navegacao antes de fechar
            setTimeout(closeMobileMenu, 100);
        });
    });
});
