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
        particle.style.animationDelay = Math.random() * 20 + 's';
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
        'imaginatech_logo.jpeg'
    ];
    
    imageUrls.forEach(url => {
        const img = new Image();
        img.src = url;
    });
}
preloadImages();
