// Loading Screen Animati
window.addEventListener('load', () => {
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.classList.add('hidden');
        }
    }, 1000);
});

// Create Animated Particles
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

// Initialize particles when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    initializeAnimations();
    initializeTracking();
});

// Navbar Scroll Effect
window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    if (navbar) {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }
});

// Smooth Scrolling for Anchor Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const target = document.querySelector(targetId);
        
        if (target) {
            const offsetTop = target.offsetTop - 80; // Account for fixed navbar
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// Initialize Scroll Animations
function initializeAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    // Observe all service cards
    document.querySelectorAll('.service-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'all 0.6s ease';
        observer.observe(card);
    });

    // Observe tech items
    document.querySelectorAll('.tech-item').forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(30px)';
        item.style.transition = `all 0.6s ease ${index * 0.1}s`;
        observer.observe(item);
    });
}

// Initialize Event Tracking
function initializeTracking() {
    // WhatsApp FAB Click Tracking
    const fabWhatsapp = document.getElementById('fab-whatsapp');
    if (fabWhatsapp) {
        fabWhatsapp.addEventListener('click', function() {
            trackEvent('whatsapp_click', 'engagement', 'fab_whatsapp_contact');
            trackMetaPixel('Contact', {
                contact_method: 'whatsapp',
                button_location: 'fab'
            });
        });
    }

    // Main CTA WhatsApp Button Tracking
    const ctaPrimary = document.querySelector('.cta-primary');
    if (ctaPrimary) {
        ctaPrimary.addEventListener('click', function() {
            trackEvent('whatsapp_click', 'engagement', 'hero_whatsapp_contact');
            trackMetaPixel('Contact', {
                contact_method: 'whatsapp',
                button_location: 'hero'
            });
        });
    }

    // Instagram Click Tracking
    document.querySelectorAll('a[href*="instagram"]').forEach(link => {
        link.addEventListener('click', function() {
            trackEvent('instagram_click', 'engagement', 'instagram_profile');
            trackMetaPixel('InstagramClick');
        });
    });

    // Service Card Click Tracking
    document.querySelectorAll('.service-card').forEach((card, index) => {
        card.addEventListener('click', function() {
            const serviceTitle = this.querySelector('.service-title').textContent;
            trackEvent('service_view', 'engagement', serviceTitle);
            trackMetaPixel('ViewContent', {
                content_type: 'service',
                content_name: serviceTitle
            });
        });
    });
}

// Google Analytics Event Tracking Helper
function trackEvent(eventName, category, label) {
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, {
            'event_category': category,
            'event_label': label,
            'transport_type': 'beacon'
        });
    }
}

// Meta Pixel Event Tracking Helper
function trackMetaPixel(eventName, parameters = {}) {
    if (typeof fbq !== 'undefined') {
        if (parameters && Object.keys(parameters).length > 0) {
            fbq('track', eventName, parameters);
        } else {
            fbq('trackCustom', eventName);
        }
    }
}

// Dynamic Copyright Year
function updateCopyrightYear() {
    const currentYear = new Date().getFullYear();
    document.querySelectorAll('footer p').forEach(el => {
        el.innerHTML = el.innerHTML.replace(/\d{4}/, currentYear);
    });
}
updateCopyrightYear();

// Parallax Effect for Hero Section
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const parallaxElements = document.querySelectorAll('.cube-container');
    
    parallaxElements.forEach(el => {
        const speed = 0.5;
        el.style.transform = `translateY(${scrolled * speed}px)`;
    });
});

// Add Hover Effect to Service Cards with Mouse Position
document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const rotateX = (y - centerY) / 10;
        const rotateY = (centerX - x) / 10;
        
        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
    });
});

// Add Typing Effect to Hero Title (optional enhancement)
function typewriterEffect() {
    const element = document.querySelector('.glitch-text');
    if (!element) return;
    
    const text = element.textContent;
    element.textContent = '';
    element.style.visibility = 'visible';
    
    let index = 0;
    const speed = 100;
    
    function type() {
        if (index < text.length) {
            element.textContent += text.charAt(index);
            index++;
            setTimeout(type, speed);
        }
    }
    
    // Start typing after loader disappears
    setTimeout(type, 1500);
}

// Initialize typing effect on load
window.addEventListener('load', () => {
    setTimeout(typewriterEffect, 500);
});

// Mobile Menu Toggle (for future enhancement)
function initializeMobileMenu() {
    const menuToggle = document.getElementById('menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            mobileMenu.classList.toggle('active');
            menuToggle.classList.toggle('active');
        });
    }
}

// Performance Optimization: Debounce scroll events
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Optimized scroll handler
const optimizedScrollHandler = debounce(() => {
    // Navbar scroll effect
    const navbar = document.getElementById('navbar');
    if (navbar) {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }
    
    // Parallax effect
    const scrolled = window.pageYOffset;
    const parallaxElements = document.querySelectorAll('.cube-container');
    parallaxElements.forEach(el => {
        const speed = 0.5;
        el.style.transform = `translateY(${scrolled * speed}px)`;
    });
}, 10);

// Replace individual scroll listeners with optimized version
window.removeEventListener('scroll', () => {});
window.addEventListener('scroll', optimizedScrollHandler);

// Page Visibility API - Pause animations when page is not visible
document.addEventListener('visibilitychange', () => {
    const cube = document.querySelector('.cube');
    const particles = document.querySelectorAll('.particle');
    
    if (document.hidden) {
        // Pause animations
        if (cube) cube.style.animationPlayState = 'paused';
        particles.forEach(p => p.style.animationPlayState = 'paused');
    } else {
        // Resume animations
        if (cube) cube.style.animationPlayState = 'running';
        particles.forEach(p => p.style.animationPlayState = 'running');
    }
});

// Console Easter Egg
console.log(
    '%c🚀 ImaginaTech - O Futuro da Impressão 3D',
    'color: #00D4FF; font-size: 20px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);'
);
console.log(
    '%c📧 contato@imaginatech.com.br | 📱 (21) 96897-2539',
    'color: #57D4CA; font-size: 14px;'
);

// Error Handling for Images
document.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', function() {
        this.style.display = 'none';
        console.warn(`Failed to load image: ${this.src}`);
    });
});

// Preload critical images
function preloadImages() {
    const imageUrls = [
        '../imaginatech_logo.jpeg'
    ];

    imageUrls.forEach(url => {
        const img = new Image();
        img.src = url;
    });
}
preloadImages();

// ============================================
// NAVEGACAO DO CARROSSEL DE PROJETOS
// ============================================

let carouselPosition = 0;

function moveCarousel(direction) {
    const track = document.querySelector('.projetos-track');
    if (!track) return;

    const cards = track.querySelectorAll('.projeto-card');
    if (cards.length === 0) return;

    // Calcular largura do card + gap
    const cardStyle = getComputedStyle(cards[0]);
    const cardWidth = cards[0].offsetWidth + 30; // 30 = gap
    const totalWidth = cardWidth * cards.length;
    const visibleWidth = track.parentElement.offsetWidth;
    const maxPosition = totalWidth - visibleWidth;

    // Pausar animacao automatica
    track.style.animation = 'none';

    // Calcular nova posicao
    carouselPosition += direction * cardWidth;

    // Loop infinito
    if (carouselPosition < 0) {
        carouselPosition = maxPosition - cardWidth;
    } else if (carouselPosition >= maxPosition) {
        carouselPosition = 0;
    }

    // Aplicar transformacao
    track.style.transform = `translateX(${-carouselPosition}px)`;
    track.style.transition = 'transform 0.4s ease';

    // Retomar animacao apos 8 segundos de inatividade
    clearTimeout(window.carouselTimeout);
    window.carouselTimeout = setTimeout(() => {
        track.style.transition = 'none';
        track.style.transform = 'translateX(0)';
        carouselPosition = 0;
        setTimeout(() => {
            track.style.animation = 'scroll-projetos 40s linear infinite';
        }, 50);
    }, 8000);
}

// Expor funcao globalmente
window.moveCarousel = moveCarousel;

// ============================================
// PORTFOLIO DINAMICO - Firebase Integration
// ============================================

// Inicializar Firebase para pagina publica
let db = null;
let portfolioItems = []; // Armazena os projetos carregados
let portfolioModalPhotos = []; // Fotos do projeto atual no modal
let portfolioModalCurrentIndex = 0; // Indice da foto atual

function initializeFirebasePublic() {
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

// Carregar itens do carrossel de PROJETOS (hero)
async function loadCarouselItems() {
    if (!db) return;

    try {
        const snapshot = await db.collection('portfolio')
            .where('destination', '==', 'carrossel')
            .where('active', '==', true)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            console.log('Nenhum projeto no carrossel - mantendo estaticos');
            return;
        }

        const items = [];
        snapshot.forEach(doc => {
            items.push({ id: doc.id, ...doc.data() });
        });

        // Duplicar itens para efeito infinito (minimo 8 itens)
        let carouselItems = [...items];
        while (carouselItems.length < 8) {
            carouselItems = [...carouselItems, ...items];
        }

        // Atualizar DOM do carrossel de PROJETOS
        const projetosTrack = document.querySelector('.projetos-track');
        if (projetosTrack) {
            projetosTrack.innerHTML = carouselItems.map(item => createProjetoCard(item)).join('');

            // Reinicializar shimmer loading para novos elementos
            if (typeof initShimmerLoading === 'function') {
                initShimmerLoading();
            }
        }

        // Se tem logo, adicionar ao carrossel de EMPRESAS
        const itemsComLogo = items.filter(item => item.logo && item.logo.url);
        if (itemsComLogo.length > 0) {
            addLogosToClientsCarousel(itemsComLogo);
        }

        console.log(`Carrossel de projetos atualizado com ${items.length} item(s)`);
    } catch (error) {
        console.error('Erro ao carregar carrossel:', error);
    }
}

// Criar card de projeto (para o carrossel do hero)
function createProjetoCard(item) {
    const photoUrl = item.mainPhoto?.url || 'assets/images/projetos/projeto-1.svg';
    const logoUrl = item.logo?.url;
    const title = item.title || 'Projeto';

    const logoHtml = logoUrl ? `
        <div class="projeto-logo">
            <img src="${logoUrl}" alt="Logo">
        </div>
    ` : '';

    return `
        <div class="projeto-card">
            <div class="projeto-image loading">
                <img src="${photoUrl}" alt="${title}" onload="this.parentElement.classList.remove('loading'); this.parentElement.classList.add('loaded');" onerror="this.parentElement.classList.remove('loading'); this.parentElement.classList.add('loaded');">
                ${logoHtml}
            </div>
            <div class="projeto-info">
                <h3 class="projeto-nome">${title}</h3>
            </div>
        </div>
    `;
}

// Adicionar logos ao carrossel de empresas
function addLogosToClientsCarousel(items) {
    const clientsTrack = document.querySelector('.clients-track');
    if (!clientsTrack) return;

    // Criar HTML dos novos logos
    const newLogosHtml = items.map(item => `
        <div class="client-logo client-logo-dynamic">
            <img src="${item.logo.url}" alt="${item.title}" class="client-logo-img">
        </div>
    `).join('');

    // Adicionar ao inicio do carrossel (antes dos estaticos)
    clientsTrack.insertAdjacentHTML('afterbegin', newLogosHtml);
    // Duplicar no final para manter o loop
    clientsTrack.insertAdjacentHTML('beforeend', newLogosHtml);

    console.log(`${items.length} logo(s) adicionado(s) ao carrossel de empresas`);
}

// Carregar grid de portfolio (projetos anteriores)
async function loadPortfolioGrid() {
    if (!db) return;

    try {
        // Query simplificada para evitar necessidade de indice composto
        // Filtramos showOnLanding no cliente
        const snapshot = await db.collection('portfolio')
            .where('destination', '==', 'projetos')
            .where('active', '==', true)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            console.log('Nenhum projeto no portfolio - mantendo estaticos');
            return;
        }

        // Filtrar apenas projetos marcados para landing e limitar a 6
        portfolioItems = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`Projeto: ${data.title}, showOnLanding: ${data.showOnLanding}`);
            if (data.showOnLanding === true && portfolioItems.length < 6) {
                portfolioItems.push({ id: doc.id, ...data });
            }
        });

        // Se nao houver projetos marcados para landing, manter estaticos
        if (portfolioItems.length === 0) {
            console.log('Nenhum projeto marcado para landing - mantendo estaticos');
            return;
        }

        // Atualizar DOM do portfolio
        const portfolioGrid = document.querySelector('.portfolio-grid');
        if (portfolioGrid) {
            portfolioGrid.innerHTML = portfolioItems.map((item, index) => createPortfolioCard(item, index)).join('');

            // Reinicializar AOS para novos elementos
            if (typeof AOS !== 'undefined') {
                AOS.refresh();
            }

            // Reinicializar shimmer loading para novos elementos
            if (typeof initShimmerLoading === 'function') {
                initShimmerLoading();
            }
        }

        // Inicializar modal do portfolio
        initPortfolioModal();

        console.log(`Portfolio landing atualizado com ${portfolioItems.length} projeto(s) marcados`);
    } catch (error) {
        console.error('Erro ao carregar portfolio:', error);
    }
}

// Criar card do portfolio
function createPortfolioCard(item, index) {
    const delay = (index % 3) * 100; // Delay escalonado para animacao

    // Mapear categoria para display bonito
    const categoryMap = {
        'industrial': 'Peca Industrial',
        'personalizado': 'Personalizado',
        'prototipagem': 'Prototipagem',
        'reposicao': 'Reposicao',
        'decorativo': 'Decorativo',
        'tecnico': 'Tecnico'
    };

    const categoryDisplay = categoryMap[item.category] || item.category || 'Projeto';

    // Logo overlay se disponivel
    const logoOverlay = item.logo && item.logo.url ? `
        <div class="portfolio-logo-overlay">
            <img src="${item.logo.url}" alt="Logo" class="portfolio-logo-img">
        </div>
    ` : '';

    // Indicador de galeria se tiver fotos extras
    const hasGallery = item.extraPhotos && item.extraPhotos.length > 0;
    const galleryIndicator = hasGallery ? `
        <div class="portfolio-gallery-indicator">
            <i class="fas fa-images"></i> ${1 + item.extraPhotos.length}
        </div>
    ` : '';

    return `
        <div class="portfolio-card" data-aos="fade-up" data-aos-delay="${delay}" onclick="openPortfolioModal('${item.id}')">
            <div class="portfolio-image loading">
                <img src="${item.mainPhoto?.url || 'https://placehold.co/400x300/0a1420/00D4FF?text=Projeto'}" alt="${item.title}" loading="lazy" onload="this.parentElement.classList.remove('loading'); this.parentElement.classList.add('loaded');" onerror="this.parentElement.classList.remove('loading'); this.parentElement.classList.add('loaded');">
                <div class="portfolio-overlay">
                    <span class="portfolio-category">${categoryDisplay}</span>
                </div>
                ${logoOverlay}
                ${galleryIndicator}
            </div>
            <div class="portfolio-info">
                <h3>${item.title}</h3>
                <div class="portfolio-specs">
                    <span class="spec-badge"><i class="fas fa-cube"></i> ${item.material || 'PLA'}</span>
                    <span class="spec-badge"><i class="fas fa-palette"></i> ${item.color || 'Variado'}</span>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// PORTFOLIO MODAL FUNCTIONS
// ============================================

function initPortfolioModal() {
    const overlay = document.getElementById('portfolio-modal-overlay');
    const closeBtn = document.getElementById('portfolio-modal-close');
    const prevBtn = document.getElementById('portfolio-modal-prev');
    const nextBtn = document.getElementById('portfolio-modal-next');

    if (closeBtn) {
        closeBtn.addEventListener('click', closePortfolioModal);
    }

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closePortfolioModal();
            }
        });
    }

    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigatePortfolioPhoto(-1);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigatePortfolioPhoto(1);
        });
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        const overlay = document.getElementById('portfolio-modal-overlay');
        if (!overlay || !overlay.classList.contains('active')) return;

        if (e.key === 'Escape') {
            closePortfolioModal();
        } else if (e.key === 'ArrowLeft') {
            navigatePortfolioPhoto(-1);
        } else if (e.key === 'ArrowRight') {
            navigatePortfolioPhoto(1);
        }
    });
}

function openPortfolioModal(projectId) {
    const project = portfolioItems.find(p => p.id === projectId);
    if (!project) return;

    // Construir array de todas as fotos
    portfolioModalPhotos = [];
    if (project.mainPhoto?.url) {
        portfolioModalPhotos.push(project.mainPhoto.url);
    }
    if (project.extraPhotos && Array.isArray(project.extraPhotos)) {
        project.extraPhotos.forEach(photo => {
            if (photo?.url) {
                portfolioModalPhotos.push(photo.url);
            }
        });
    }

    if (portfolioModalPhotos.length === 0) {
        portfolioModalPhotos.push('https://placehold.co/800x600/0a1420/00D4FF?text=Projeto');
    }

    portfolioModalCurrentIndex = 0;

    const modalTitle = document.getElementById('portfolio-modal-title');
    const modalSpecs = document.getElementById('portfolio-modal-specs');

    if (modalTitle) {
        modalTitle.textContent = project.title;
    }

    if (modalSpecs) {
        modalSpecs.innerHTML = `
            <span class="spec-badge"><i class="fas fa-cube"></i> ${project.material || 'PLA'}</span>
            <span class="spec-badge"><i class="fas fa-palette"></i> ${project.color || 'Variado'}</span>
        `;
    }

    setupPortfolioPhotoNavigation();
    showPortfolioPhoto(0);

    const overlay = document.getElementById('portfolio-modal-overlay');
    if (overlay) {
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function setupPortfolioPhotoNavigation() {
    const prevBtn = document.getElementById('portfolio-modal-prev');
    const nextBtn = document.getElementById('portfolio-modal-next');
    const counter = document.getElementById('portfolio-modal-counter');
    const thumbnails = document.getElementById('portfolio-modal-thumbnails');
    const totalPhotos = document.getElementById('portfolio-modal-total');

    const hasMultiple = portfolioModalPhotos.length > 1;

    if (prevBtn) prevBtn.style.display = hasMultiple ? 'flex' : 'none';
    if (nextBtn) nextBtn.style.display = hasMultiple ? 'flex' : 'none';
    if (counter) counter.style.display = hasMultiple ? 'block' : 'none';
    if (thumbnails) thumbnails.style.display = hasMultiple ? 'flex' : 'none';
    if (totalPhotos) totalPhotos.textContent = portfolioModalPhotos.length;

    if (thumbnails && hasMultiple) {
        thumbnails.innerHTML = portfolioModalPhotos.map((url, index) => `
            <div class="portfolio-modal-thumb ${index === 0 ? 'active' : ''}" onclick="goToPortfolioPhoto(${index})">
                <img src="${url}" alt="Foto ${index + 1}" loading="lazy">
            </div>
        `).join('');
    }
}

function showPortfolioPhoto(index) {
    if (index < 0 || index >= portfolioModalPhotos.length) return;

    portfolioModalCurrentIndex = index;

    const modalImage = document.getElementById('portfolio-modal-image');
    const currentPhotoEl = document.getElementById('portfolio-modal-current');
    const thumbnails = document.querySelectorAll('.portfolio-modal-thumb');

    if (modalImage) {
        modalImage.src = portfolioModalPhotos[index];
    }

    if (currentPhotoEl) {
        currentPhotoEl.textContent = index + 1;
    }

    thumbnails.forEach((thumb, i) => {
        thumb.classList.toggle('active', i === index);
    });
}

function navigatePortfolioPhoto(direction) {
    let newIndex = portfolioModalCurrentIndex + direction;

    if (newIndex < 0) {
        newIndex = portfolioModalPhotos.length - 1;
    } else if (newIndex >= portfolioModalPhotos.length) {
        newIndex = 0;
    }

    showPortfolioPhoto(newIndex);
}

function goToPortfolioPhoto(index) {
    showPortfolioPhoto(index);
}

function closePortfolioModal() {
    const overlay = document.getElementById('portfolio-modal-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    portfolioModalPhotos = [];
    portfolioModalCurrentIndex = 0;
}

// Expor funcoes globalmente
window.openPortfolioModal = openPortfolioModal;
window.goToPortfolioPhoto = goToPortfolioPhoto;
window.closePortfolioModal = closePortfolioModal;

// Inicializar carregamento dinamico quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    // Aguardar um momento para garantir que Firebase SDK carregou
    setTimeout(async () => {
        if (initializeFirebasePublic()) {
            await Promise.all([
                loadCarouselItems(),
                loadPortfolioGrid()
            ]);

            // Fallback final: garantir todas as imagens visiveis apos Firebase carregar
            setTimeout(() => {
                document.querySelectorAll('.projeto-image.loading, .portfolio-image.loading').forEach(el => {
                    el.classList.remove('loading');
                    el.classList.add('loaded');
                });
            }, 1000);
        }
    }, 100);
});
