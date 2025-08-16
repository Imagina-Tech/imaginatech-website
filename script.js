// =========================
// Interações e Animações
// =========================
document.addEventListener('DOMContentLoaded', () => {
  // Progresso de scroll
  const progress = document.getElementById('scroll-progress');
  const updateProgress = () => {
    const doc = document.documentElement;
    const scrolled = doc.scrollTop / (doc.scrollHeight - doc.clientHeight);
    progress.style.setProperty('--progress', `${scrolled * 100}%`);
    // Mostrar/esconder FAB de topo
    const toTop = document.getElementById('toTop');
    if (doc.scrollTop > 280) toTop.classList.add('show'); else toTop.classList.remove('show');
  };
  updateProgress();
  document.addEventListener('scroll', updateProgress, { passive: true });

  // Botão voltar ao topo
  const toTopBtn = document.getElementById('toTop');
  if (toTopBtn) {
    toTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }

  // Aparição ao rolar (IntersectionObserver)
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('is-inview');
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // Toggle "Nossos Serviços" – preservando função + acessibilidade
  const toggleBtn = document.getElementById('services-toggle');
  const panel = document.getElementById('services-content');
  if (toggleBtn && panel) {
    // Remover display inline do HTML original para permitir transição
    panel.style.removeProperty('display');
    panel.hidden = true;
    panel.style.maxHeight = '0px';

    toggleBtn.addEventListener('click', () => {
      const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      toggleBtn.setAttribute('aria-expanded', String(!expanded));
      if (!expanded) {
        panel.hidden = false;
        // força recálculo para transição
        // eslint-disable-next-line no-unused-expressions
        panel.offsetHeight;
        panel.style.maxHeight = panel.scrollHeight + 'px';
      } else {
        panel.style.maxHeight = '0px';
        const onEnd = (e) => {
          if (e.propertyName === 'max-height') {
            panel.hidden = true;
            panel.removeEventListener('transitionend', onEnd);
          }
        };
        panel.addEventListener('transitionend', onEnd);
      }
    });
  }

  // Efeito ripple em botões
  const addRipple = (el) => {
    el.addEventListener('pointerdown', (ev) => {
      const rect = el.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      ripple.style.left = (ev.clientX - rect.left) + 'px';
      ripple.style.top = (ev.clientY - rect.top) + 'px';
      el.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    }, { passive: true });
  };
  document.querySelectorAll('.link-button, .float-btn').forEach(addRipple);
});
