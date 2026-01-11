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

function initializeModal() {
    const overlay = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');

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

    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

function openModal(projectId) {
    const project = allProjects.find(p => p.id === projectId);
    if (!project) return;

    const overlay = document.getElementById('modal-overlay');
    const modalImage = document.getElementById('modal-image');
    const modalTitle = document.getElementById('modal-title');
    const modalSpecs = document.getElementById('modal-specs');

    if (modalImage) {
        modalImage.src = project.mainPhoto?.url || 'https://via.placeholder.com/800x600/0a1420/00D4FF?text=Projeto';
        modalImage.alt = project.title;
    }

    if (modalTitle) {
        modalTitle.textContent = project.title;
    }

    if (modalSpecs) {
        modalSpecs.innerHTML = `
            <span class="spec-badge"><i class="fas fa-cube"></i> ${project.material || 'PLA'}</span>
            <span class="spec-badge"><i class="fas fa-palette"></i> ${project.color || 'Variado'}</span>
        `;
    }

    if (overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Make openModal available globally
window.openModal = openModal;

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
