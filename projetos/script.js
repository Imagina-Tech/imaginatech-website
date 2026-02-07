/* ==================================================
   PROJETOS PAGE - JavaScript
   ImaginaTech Portfolio
   ================================================== */

// ============================================
// SEGURANCA: Funcao para escape de HTML (previne XSS)
// ============================================
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ============================================
// Logger - usa o logger centralizado do Firestore
// Carregado via /shared/firestore-logger.js
// ============================================
const logger = window.logger || {
    log: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
};

// ============================================
// INICIALIZACAO
// ============================================

let db = null;
let allProjects = [];
let currentFilter = 'todos';

// ============================================
// SEGURANCA: Handler delegado para data-actions
// ============================================
document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    const action = el.dataset.action;

    switch (action) {
        case 'open-modal':
            const projectId = el.dataset.projectId;
            if (projectId && typeof openModal === 'function') {
                openModal(projectId);
            }
            break;
        case 'switch-project':
            const switchId = el.dataset.projectId;
            if (switchId && typeof switchToProject === 'function') {
                switchToProject(switchId);
            }
            break;
        case 'go-to-photo':
            const photoIndex = parseInt(el.dataset.index, 10);
            if (!isNaN(photoIndex) && typeof goToPhoto === 'function') {
                goToPhoto(photoIndex);
            }
            break;
    }
});

// Esconder loading apos carregamento
window.addEventListener('load', () => {
    setTimeout(() => {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.add('hidden');
    }, 800);
});

// Inicializar AOS
document.addEventListener('DOMContentLoaded', () => {
    // AOS Animation
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            easing: 'ease-in-out',
            once: true,
            offset: 100
        });
    }

    // Create particles
    createParticles();

    // Scroll progress
    initScrollProgress();

    // Initialize Firebase and load projects
    initializeApp();

    // Initialize filters
    initializeFilters();

    // Initialize modal
    initializeModal();
});

// ============================================
// PARTICLES ANIMATION
// ============================================

function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;

    const particleCount = 50;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = -(Math.random() * 20) + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        particlesContainer.appendChild(particle);
    }
}

// ============================================
// SCROLL PROGRESS
// ============================================

function initScrollProgress() {
    window.addEventListener('scroll', function() {
        const scrollProgress = document.getElementById('scroll-progress');
        if (!scrollProgress) return;

        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrollPercentage = (scrollTop / scrollHeight) * 100;
        scrollProgress.style.width = scrollPercentage + '%';
    }, { passive: true });
}

// ============================================
// FIREBASE INITIALIZATION
// ============================================

function initializeFirebase() {
    if (typeof firebase === 'undefined' || !window.ENV_CONFIG) {
        logger.warn('Firebase SDK ou ENV_CONFIG nao carregado');
        return false;
    }

    // Verificar se ja foi inicializado
    if (firebase.apps.length === 0) {
        const firebaseConfig = {
            apiKey: window.ENV_CONFIG.FIREBASE_API_KEY,
            authDomain: window.ENV_CONFIG.FIREBASE_AUTH_DOMAIN,
            projectId: window.ENV_CONFIG.FIREBASE_PROJECT_ID,
            storageBucket: window.ENV_CONFIG.FIREBASE_STORAGE_BUCKET,
            messagingSenderId: window.ENV_CONFIG.FIREBASE_MESSAGING_SENDER_ID,
            appId: window.ENV_CONFIG.FIREBASE_APP_ID
        };
        firebase.initializeApp(firebaseConfig);
    }

    db = firebase.firestore();
    return true;
}

// ============================================
// MAIN APP INITIALIZATION
// ============================================

async function initializeApp() {
    // Aguardar Firebase carregar
    setTimeout(async () => {
        if (initializeFirebase()) {
            await loadProjects();
        } else {
            showEmptyState('Erro ao conectar com o servidor');
        }
    }, 100);
}

// ============================================
// LOAD PROJECTS
// ============================================

async function loadProjects() {
    if (!db) return;

    const grid = document.getElementById('projetos-grid');
    const emptyState = document.getElementById('empty-state');

    try {
        // NOVO SISTEMA: Busca todos os projetos ativos e filtra no cliente
        // Aceita: published=true OU destination='projetos' (compatibilidade retroativa)
        const snapshot = await db.collection('portfolio')
            .where('active', '==', true)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            grid.innerHTML = '';
            showEmptyState('Nenhum projeto disponivel ainda');
            return;
        }

        // Processar projetos - filtra por published=true OU destination='projetos'
        allProjects = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Novo sistema: published=true, OU sistema antigo: destination='projetos'
            if (data.published === true || data.destination === 'projetos') {
                allProjects.push({ id: doc.id, ...data });
            }
        });

        if (allProjects.length === 0) {
            grid.innerHTML = '';
            showEmptyState('Nenhum projeto disponivel ainda');
            return;
        }

        // Render projects
        renderProjects(allProjects);
        emptyState.style.display = 'none';

        logger.log(`Carregados ${allProjects.length} projetos`);

        // Verificar se há projeto para abrir via URL (vindo do /dev)
        checkUrlForProject();
    } catch (error) {
        logger.error('Erro ao carregar projetos:', error);
        showEmptyState('Erro ao carregar projetos');
    }
}

// ============================================
// RENDER PROJECTS
// ============================================

function renderProjects(projects) {
    const grid = document.getElementById('projetos-grid');
    const emptyState = document.getElementById('empty-state');

    if (projects.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    grid.innerHTML = projects.map((project, index) => createProjectCard(project, index)).join('');

    // Refresh AOS for new elements
    if (typeof AOS !== 'undefined') {
        AOS.refresh();
    }
}

// ============================================
// IMAGE LOAD HANDLER (via Event Delegation)
// ============================================

function initImageLoadHandlers() {
    // Usar event delegation para load/error de imagens
    document.addEventListener('load', (e) => {
        if (e.target.tagName === 'IMG' && e.target.dataset.projectId) {
            handleImageLoaded(e.target.dataset.projectId);
        }
    }, true); // Capture phase para eventos de load

    document.addEventListener('error', (e) => {
        if (e.target.tagName === 'IMG' && e.target.dataset.projectId) {
            handleImageLoaded(e.target.dataset.projectId);
        }
    }, true);
}

function handleImageLoaded(projectId) {
    const container = document.getElementById(`img-container-${projectId}`);
    if (container) {
        container.classList.remove('loading');
        container.classList.add('loaded');
    }
}

// Inicializar handlers de imagem
initImageLoadHandlers();

// ============================================
// CREATE PROJECT CARD
// ============================================

function createProjectCard(project, index) {
    const delay = (index % 3) * 100;

    // Mapear categoria para display bonito
    const categoryMap = {
        'industrial': 'Industrial',
        'personalizado': 'Personalizado',
        'prototipagem': 'Prototipagem',
        'reposicao': 'Reposicao',
        'decorativo': 'Decorativo',
        'tecnico': 'Tecnico'
    };

    // SEGURANCA: Escapar todos os dados dinamicos
    const title = escapeHtml(project.title || 'Projeto');
    const material = escapeHtml(project.material || 'PLA');
    const color = escapeHtml(project.color || 'Variado');
    const categoryDisplay = escapeHtml(categoryMap[project.category] || project.category || 'Projeto');
    const categoryClass = escapeHtml(project.category || 'outros');
    const projectId = escapeHtml(project.id);
    const imageUrl = escapeHtml(project.mainPhoto?.url || 'https://via.placeholder.com/400x300/0a1420/00D4FF?text=Projeto');

    // Logo overlay se disponivel
    const logoOverlay = project.logo && project.logo.url ? `
        <div class="projeto-logo-overlay">
            <img src="${escapeHtml(project.logo.url)}" alt="Logo" class="projeto-logo-img">
        </div>
    ` : '';

    // Calcular quantidade de fotos
    let photoCount = 0;
    if (project.mainPhoto?.url) photoCount++;
    if (project.extraPhotos && Array.isArray(project.extraPhotos)) {
        photoCount += project.extraPhotos.filter(p => p?.url).length;
    }

    // Badge de quantidade de fotos (so mostra se > 1)
    const photoCountBadge = photoCount > 1 ? `
        <div class="projeto-photo-count">
            <i class="fas fa-images"></i>
            <span>${photoCount} fotos</span>
        </div>
    ` : '';

    // Overlay de hover com descricao ou call-to-action
    const description = escapeHtml(project.description || '');
    const truncatedDesc = description.length > 100 ? description.substring(0, 100) + '...' : description;
    const overlayContent = description
        ? `<p class="projeto-hover-desc">${truncatedDesc}</p>`
        : '';

    const descriptionOverlay = `
        <div class="projeto-hover-overlay">
            ${overlayContent}
            <span class="projeto-hover-cta"><i class="fas fa-expand"></i> Clique para ver detalhes</span>
        </div>
    `;

    // SEGURANCA: Usar data-action ao inves de onclick
    return `
        <div class="projeto-card"
             data-category="${categoryClass}"
             data-aos="fade-up"
             data-aos-delay="${delay}"
             data-action="open-modal"
             data-project-id="${projectId}"
             style="cursor: pointer;">
            <div class="projeto-image loading" id="img-container-${projectId}">
                <img src="${imageUrl}" alt="${title}" loading="lazy" data-project-id="${projectId}">
                <div class="projeto-overlay">
                    <span class="projeto-category">${categoryDisplay}</span>
                </div>
                ${descriptionOverlay}
                ${logoOverlay}
                ${photoCountBadge}
            </div>
            <div class="projeto-info">
                <h3>${title}</h3>
                <div class="projeto-specs">
                    <span class="spec-badge"><i class="fas fa-cube"></i> ${material}</span>
                    <span class="spec-badge"><i class="fas fa-palette"></i> ${color}</span>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// FILTER FUNCTIONALITY
// ============================================

function initializeFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all
            filterBtns.forEach(b => b.classList.remove('active'));
            // Add active to clicked
            btn.classList.add('active');

            // Get filter value
            currentFilter = btn.dataset.filter;

            // Filter projects
            filterProjects(currentFilter);
        });
    });
}

function filterProjects(filter) {
    let filteredProjects;

    if (filter === 'todos') {
        filteredProjects = allProjects;
    } else {
        filteredProjects = allProjects.filter(project => project.category === filter);
    }

    renderProjects(filteredProjects);
}

// ============================================
// MODAL FUNCTIONALITY
// ============================================

let modalPhotos = []; // Array de fotos do projeto atual
let currentPhotoIndex = 0; // Indice da foto atual

function initializeModal() {
    const overlay = document.getElementById('modal-overlay');
    const prevBtn = document.getElementById('modal-prev');
    const nextBtn = document.getElementById('modal-next');

    if (overlay) {
        // Fechar ao clicar fora do conteudo
        overlay.addEventListener('click', (e) => {
            // Fecha se clicar no overlay ou em areas vazias
            if (e.target === overlay || e.target.closest('.modal-content') === null) {
                closeModal();
            }
        });
    }

    // Navegacao
    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigatePhoto(-1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigatePhoto(1);
        });
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        const overlay = document.getElementById('modal-overlay');
        if (!overlay || !overlay.classList.contains('active')) return;

        if (e.key === 'Escape') {
            closeModal();
        } else if (e.key === 'ArrowLeft') {
            navigatePhoto(-1);
        } else if (e.key === 'ArrowRight') {
            navigatePhoto(1);
        }
    });

    // Touch gestures para navegacao no modal (mobile)
    const imageContainer = document.querySelector('.modal-image-container');
    if (imageContainer && 'ontouchstart' in window) {
        let touchStartX = 0;
        let touchStartY = 0;
        const minSwipeDistance = 50;

        imageContainer.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        imageContainer.addEventListener('touchend', (e) => {
            const touchEndX = e.changedTouches[0].screenX;
            const touchEndY = e.changedTouches[0].screenY;

            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;

            // Verifica se foi swipe horizontal (nao vertical)
            if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
                if (deltaX < 0) {
                    navigatePhoto(1); // Swipe esquerda = proximo
                } else {
                    navigatePhoto(-1); // Swipe direita = anterior
                }
            }
        }, { passive: true });
    }
}

function openModal(projectId) {
    const project = allProjects.find(p => p.id === projectId);
    if (!project) return;

    // Construir array de todas as fotos
    modalPhotos = [];
    if (project.mainPhoto?.url) {
        modalPhotos.push(project.mainPhoto.url);
    }
    if (project.extraPhotos && Array.isArray(project.extraPhotos)) {
        project.extraPhotos.forEach(photo => {
            if (photo?.url) {
                modalPhotos.push(photo.url);
            }
        });
    }

    // Se nao houver fotos, usar placeholder
    if (modalPhotos.length === 0) {
        modalPhotos.push('https://via.placeholder.com/800x600/0a1420/00D4FF?text=Projeto');
    }

    currentPhotoIndex = 0;

    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalSpecs = document.getElementById('modal-specs');

    if (modalTitle) {
        modalTitle.textContent = project.title;
    }

    if (modalSpecs) {
        // SEGURANCA: Escapar dados dinamicos
        let specsHtml = `
            <span class="spec-badge"><i class="fas fa-cube"></i> ${escapeHtml(project.material || 'PLA')}</span>
            <span class="spec-badge"><i class="fas fa-palette"></i> ${escapeHtml(project.color || 'Variado')}</span>
        `;
        modalSpecs.innerHTML = specsHtml;
    }

    // Mostrar descricao no modal se existir
    const modalDescription = document.getElementById('modal-description');
    const descriptionContainer = document.querySelector('.modal-description-container');
    if (modalDescription && descriptionContainer) {
        if (project.description) {
            modalDescription.textContent = project.description;
            descriptionContainer.style.display = 'block';
        } else {
            descriptionContainer.style.display = 'none';
        }
    }

    // Configurar navegacao baseado no numero de fotos
    setupPhotoNavigation();
    showPhoto(0);

    // Carregar projetos relacionados
    loadRelatedProjects(projectId, project.category);

    if (overlay) {
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        // Scroll para o topo do modal
        overlay.scrollTop = 0;
    }
}

function loadRelatedProjects(currentProjectId, currentCategory) {
    const relatedGrid = document.getElementById('related-grid');
    if (!relatedGrid) return;

    // Filtrar projetos: mesma categoria primeiro, depois outros, excluindo o atual
    let related = allProjects
        .filter(p => p.id !== currentProjectId)
        .sort((a, b) => {
            // Priorizar mesma categoria
            if (a.category === currentCategory && b.category !== currentCategory) return -1;
            if (b.category === currentCategory && a.category !== currentCategory) return 1;
            return 0;
        })
        .slice(0, 4); // Limitar a 4 projetos

    if (related.length === 0) {
        document.getElementById('modal-related').style.display = 'none';
        return;
    }

    document.getElementById('modal-related').style.display = 'block';

    const categoryMap = {
        'industrial': 'Industrial',
        'personalizado': 'Personalizado',
        'prototipagem': 'Prototipagem',
        'reposicao': 'Reposicao',
        'decorativo': 'Decorativo',
        'tecnico': 'Tecnico'
    };

    relatedGrid.innerHTML = related.map(project => {
        // SEGURANCA: Escapar todos os dados dinamicos
        const imageUrl = escapeHtml(project.mainPhoto?.url || 'https://via.placeholder.com/300x200/0a1420/00D4FF?text=Projeto');
        const categoryDisplay = escapeHtml(categoryMap[project.category] || project.category || 'Projeto');
        const title = escapeHtml(project.title || 'Projeto');
        const projectId = escapeHtml(project.id);

        // SEGURANCA: Usar data-action ao inves de onclick
        return `
            <div class="related-card" data-action="switch-project" data-project-id="${projectId}" style="cursor: pointer;">
                <div class="related-card-image">
                    <img src="${imageUrl}" alt="${title}" loading="lazy">
                </div>
                <div class="related-card-info">
                    <h5>${title}</h5>
                    <span>${categoryDisplay}</span>
                </div>
            </div>
        `;
    }).join('');
}

function switchToProject(projectId) {
    // Scroll suave para o topo antes de trocar
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Pequeno delay para o scroll acontecer
    setTimeout(() => {
        openModal(projectId);
    }, 200);
}

window.switchToProject = switchToProject;

function setupPhotoNavigation() {
    const prevBtn = document.getElementById('modal-prev');
    const nextBtn = document.getElementById('modal-next');
    const counter = document.getElementById('modal-photo-counter');
    const thumbnails = document.getElementById('modal-thumbnails');
    const totalPhotos = document.getElementById('modal-total-photos');

    const hasMultiple = modalPhotos.length > 1;

    // Mostrar/esconder navegacao
    if (prevBtn) prevBtn.style.display = hasMultiple ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = hasMultiple ? 'flex' : 'none';
    if (counter) counter.style.display = hasMultiple ? 'block' : 'none';
    if (thumbnails) thumbnails.style.display = hasMultiple ? 'flex' : 'none';
    if (totalPhotos) totalPhotos.textContent = modalPhotos.length;

    // Criar miniaturas - SEGURANCA: Usar data-action ao inves de onclick
    if (thumbnails && hasMultiple) {
        thumbnails.innerHTML = modalPhotos.map((url, index) => `
            <div class="modal-thumbnail ${index === 0 ? 'active' : ''}" data-action="go-to-photo" data-index="${index}" style="cursor: pointer;">
                <img src="${escapeHtml(url)}" alt="Foto ${index + 1}" loading="lazy">
            </div>
        `).join('');
    }
}

function showPhoto(index) {
    if (index < 0 || index >= modalPhotos.length) return;

    currentPhotoIndex = index;

    const modalImage = document.getElementById('modal-image');
    const currentPhotoEl = document.getElementById('modal-current-photo');
    const thumbnails = document.querySelectorAll('.modal-thumbnail');

    if (modalImage) {
        modalImage.src = modalPhotos[index];
    }

    if (currentPhotoEl) {
        currentPhotoEl.textContent = index + 1;
    }

    // Atualizar miniaturas ativas
    thumbnails.forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
}

function navigatePhoto(direction) {
    let newIndex = currentPhotoIndex + direction;

    // Loop infinito
    if (newIndex < 0) {
        newIndex = modalPhotos.length - 1;
    } else if (newIndex >= modalPhotos.length) {
        newIndex = 0;
    }

    showPhoto(newIndex);
}

function goToPhoto(index) {
    showPhoto(index);
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    }
    modalPhotos = [];
    currentPhotoIndex = 0;
}

// Make functions available globally
window.openModal = openModal;
window.goToPhoto = goToPhoto;

// ============================================
// URL PARAMETER - Abrir projeto via link direto
// ============================================

function checkUrlForProject() {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('projeto');

    if (projectId) {
        // Pequeno delay para garantir que o DOM esta pronto
        setTimeout(() => {
            openModal(projectId);
            // Limpar o parametro da URL sem recarregar a pagina
            window.history.replaceState({}, document.title, window.location.pathname);
        }, 300);
    }
}

// ============================================
// EMPTY STATE
// ============================================

function showEmptyState(message) {
    const grid = document.getElementById('projetos-grid');
    const emptyState = document.getElementById('empty-state');

    if (grid) {
        grid.innerHTML = '';
    }

    if (emptyState) {
        emptyState.style.display = 'block';
        const emptyMessage = emptyState.querySelector('p');
        if (emptyMessage) {
            emptyMessage.textContent = message;
        }
    }
}

// ============================================
// COPYRIGHT YEAR
// ============================================

function updateCopyrightYear() {
    const currentYear = new Date().getFullYear();
    document.querySelectorAll('footer p').forEach(el => {
        el.innerHTML = el.innerHTML.replace(/\d{4}/, currentYear);
    });
}
updateCopyrightYear();

// ============================================
// CONSOLE BRANDING
// ============================================

logger.brand(
    '%cImaginaTech - Portfolio de Projetos',
    'color: #00D4FF; font-size: 18px; font-weight: bold;'
);
