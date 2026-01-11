/* ==================================================
   PROJETOS PAGE - JavaScript
   ImaginaTech Portfolio
   ================================================== */

// ============================================
// INICIALIZACAO
// ============================================

let db = null;
let allProjects = [];
let currentFilter = 'todos';

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
    });
}

// ============================================
// FIREBASE INITIALIZATION
// ============================================

function initializeFirebase() {
    if (typeof firebase === 'undefined' || !window.ENV_CONFIG) {
        console.warn('Firebase SDK ou ENV_CONFIG nao carregado');
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
        const snapshot = await db.collection('portfolio')
            .where('active', '==', true)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            grid.innerHTML = '';
            showEmptyState('Nenhum projeto disponivel ainda');
            return;
        }

        allProjects = [];
        snapshot.forEach(doc => {
            allProjects.push({ id: doc.id, ...doc.data() });
        });

        // Render projects
        renderProjects(allProjects);
        emptyState.style.display = 'none';

        console.log(`Carregados ${allProjects.length} projetos`);
    } catch (error) {
        console.error('Erro ao carregar projetos:', error);
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

    const categoryDisplay = categoryMap[project.category] || project.category || 'Projeto';
    const categoryClass = project.category || 'outros';

    // Logo overlay se disponivel
    const logoOverlay = project.logo && project.logo.url ? `
        <div class="projeto-logo-overlay">
            <img src="${project.logo.url}" alt="Logo" class="projeto-logo-img">
        </div>
    ` : '';

    const imageUrl = project.mainPhoto?.url || 'https://via.placeholder.com/400x300/0a1420/00D4FF?text=Projeto';

    return `
        <div class="projeto-card"
             data-category="${categoryClass}"
             data-aos="fade-up"
             data-aos-delay="${delay}"
             onclick="openModal('${project.id}')">
            <div class="projeto-image">
                <img src="${imageUrl}" alt="${project.title}" loading="lazy">
                <div class="projeto-overlay">
                    <span class="projeto-category">${categoryDisplay}</span>
                </div>
                ${logoOverlay}
            </div>
            <div class="projeto-info">
                <h3>${project.title}</h3>
                <div class="projeto-specs">
                    <span class="spec-badge"><i class="fas fa-cube"></i> ${project.material || 'PLA'}</span>
                    <span class="spec-badge"><i class="fas fa-palette"></i> ${project.color || 'Variado'}</span>
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
    const closeBtn = document.getElementById('modal-close');
    const prevBtn = document.getElementById('modal-prev');
    const nextBtn = document.getElementById('modal-next');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
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
        modalSpecs.innerHTML = `
            <span class="spec-badge"><i class="fas fa-cube"></i> ${project.material || 'PLA'}</span>
            <span class="spec-badge"><i class="fas fa-palette"></i> ${project.color || 'Variado'}</span>
        `;
    }

    // Configurar navegacao baseado no numero de fotos
    setupPhotoNavigation();
    showPhoto(0);

    if (overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

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

    // Criar miniaturas
    if (thumbnails && hasMultiple) {
        thumbnails.innerHTML = modalPhotos.map((url, index) => `
            <div class="modal-thumbnail ${index === 0 ? 'active' : ''}" onclick="goToPhoto(${index})">
                <img src="${url}" alt="Foto ${index + 1}" loading="lazy">
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
        document.body.style.overflow = '';
    }
    modalPhotos = [];
    currentPhotoIndex = 0;
}

// Make functions available globally
window.openModal = openModal;
window.goToPhoto = goToPhoto;

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

console.log(
    '%cImaginaTech - Portfolio de Projetos',
    'color: #00D4FF; font-size: 18px; font-weight: bold;'
);
