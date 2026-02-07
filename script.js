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
// SEGURANCA: Handler delegado para data-actions
// ============================================
document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    const action = el.dataset.action;

    switch (action) {
        case 'carousel-prev':
            if (typeof moveCarousel === 'function') moveCarousel(-1);
            break;
        case 'carousel-next':
            if (typeof moveCarousel === 'function') moveCarousel(1);
            break;
        case 'scroll-to':
            const target = el.dataset.target;
            if (target) {
                const targetEl = document.querySelector(target);
                if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth' });
            }
            break;
        case 'portfolio-thumb':
            const index = parseInt(el.dataset.index, 10);
            if (!isNaN(index) && typeof goToPortfolioPhoto === 'function') {
                goToPortfolioPhoto(index);
            }
            break;
        case 'open-portfolio':
            const projectId = el.dataset.projectId;
            if (projectId) {
                window.location.href = '/projetos/?projeto=' + encodeURIComponent(projectId);
            }
            break;
    }
});

// Loading Screen Animation
window.addEventListener('load', () => {
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.classList.add('hidden');
        }
    }, 1000);
});

// Cube video: show spinner placeholder until video is ready
document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('cube-video');
    const placeholder = document.getElementById('cube-loading-placeholder');
    const staticImg = document.getElementById('cube-static');
    if (!video || !placeholder) return;

    let shown = false;

    function showVideo() {
        if (shown) return;
        shown = true;
        video.classList.add('loaded');
        placeholder.classList.add('hidden');
    }

    // If video already has enough data (cached/fast load)
    if (video.readyState >= 2) {
        showVideo();
        return;
    }

    // Listen to multiple events - whichever fires first
    video.addEventListener('canplay', showVideo, { once: true });
    video.addEventListener('playing', showVideo, { once: true });

    // Fallback: if video fails, show static image
    setTimeout(() => {
        if (!shown && staticImg) {
            staticImg.style.display = '';
            placeholder.classList.add('hidden');
        }
    }, 8000);
});

// Safari/iOS Detection - WebGL Chroma Key para video com transparencia
// WebM com alpha nao funciona no Safari, usamos WebGL shader para remover fundo verde
(function initSafariWebGLChromaKey() {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
                     (navigator.userAgent.includes('AppleWebKit') && !navigator.userAgent.includes('Chrome'));
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    if (!isSafari && !isIOS) return;

    const videoWebM = document.getElementById('cube-video');
    const videoSafari = document.getElementById('cube-video-safari');
    const canvas = document.getElementById('cube-canvas-webgl');
    const staticImg = document.getElementById('cube-static');

    if (!videoWebM || !canvas) return;

    // Esconde video WebM e placeholder (Safari usa canvas WebGL)
    videoWebM.style.display = 'none';
    videoWebM.pause();
    videoWebM.removeAttribute('src');
    videoWebM.load();

    const placeholder = document.getElementById('cube-loading-placeholder');
    if (placeholder) placeholder.classList.add('hidden');

    // Tenta inicializar WebGL
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, alpha: true });

    if (!gl || !videoSafari) {
        // Fallback para imagem estatica se WebGL nao disponivel
        if (staticImg) staticImg.style.display = 'block';
        if (placeholder) placeholder.classList.add('hidden');
        return;
    }

    // Vertex Shader
    const vertexShaderSrc = `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        varying vec2 v_texCoord;
        void main() {
            gl_Position = vec4(a_position, 0.0, 1.0);
            v_texCoord = a_texCoord;
        }
    `;

    // Fragment Shader - Chroma Key com despill (baseado em OBS Studio)
    const fragmentShaderSrc = `
        precision mediump float;
        uniform sampler2D u_video;
        uniform vec3 u_keyColor;
        uniform float u_similarity;
        uniform float u_smoothness;
        uniform float u_spill;
        varying vec2 v_texCoord;

        vec2 RGBtoUV(vec3 rgb) {
            return vec2(
                rgb.r * -0.169 + rgb.g * -0.331 + rgb.b * 0.5 + 0.5,
                rgb.r * 0.5 + rgb.g * -0.419 + rgb.b * -0.081 + 0.5
            );
        }

        void main() {
            vec4 color = texture2D(u_video, v_texCoord);

            // Calcula distancia no espaco de cor UV (mais preciso que RGB)
            float chromaDist = distance(RGBtoUV(color.rgb), RGBtoUV(u_keyColor));

            // Mascara base para verde
            float baseMask = chromaDist - u_similarity;
            float alpha = pow(clamp(baseMask / u_smoothness, 0.0, 1.0), 1.5);

            // Despill - remove residuo verde das bordas
            float spillVal = pow(clamp(baseMask / u_spill, 0.0, 1.0), 1.5);
            float desat = clamp(color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722, 0.0, 1.0);
            vec3 finalColor = mix(vec3(desat), color.rgb, spillVal);

            gl_FragColor = vec4(finalColor, alpha);
        }
    `;

    // Compila shaders
    function compileShader(src, type) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            logger.error('Shader error:', gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    const vertexShader = compileShader(vertexShaderSrc, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fragmentShaderSrc, gl.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) {
        if (staticImg) staticImg.style.display = 'block';
        return;
    }

    // Cria programa
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        logger.error('Program error:', gl.getProgramInfoLog(program));
        if (staticImg) staticImg.style.display = 'block';
        return;
    }

    gl.useProgram(program);

    // Configura geometria (quad fullscreen)
    const positions = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
    const texCoords = new Float32Array([0,1, 1,1, 0,0, 1,0]);

    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    const texLoc = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    // Cria textura para video
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Uniforms
    const keyColorLoc = gl.getUniformLocation(program, 'u_keyColor');
    const similarityLoc = gl.getUniformLocation(program, 'u_similarity');
    const smoothnessLoc = gl.getUniformLocation(program, 'u_smoothness');
    const spillLoc = gl.getUniformLocation(program, 'u_spill');

    // Cor verde do chroma key (ajustado para o video)
    gl.uniform3f(keyColorLoc, 0.09, 0.63, 0.08); // Verde do fundo
    gl.uniform1f(similarityLoc, 0.12);
    gl.uniform1f(smoothnessLoc, 0.08);
    gl.uniform1f(spillLoc, 0.12);

    // Habilita blending para transparencia
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    let isRendering = false;

    function render() {
        if (!isRendering) return;

        // Garante que video esta tocando
        if (videoSafari.paused) {
            videoSafari.play().catch(() => {});
        }

        if (videoSafari.readyState >= videoSafari.HAVE_CURRENT_DATA) {
            // Atualiza textura com frame do video
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoSafari);

            // Limpa e desenha
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        }

        requestAnimationFrame(render);
    }

    function startRendering() {
        if (isRendering) return;

        // Define tamanho do canvas
        canvas.width = videoSafari.videoWidth || 600;
        canvas.height = videoSafari.videoHeight || 330;
        gl.viewport(0, 0, canvas.width, canvas.height);

        canvas.style.display = 'block';
        isRendering = true;
        videoSafari.play().catch(() => {});
        render();
    }

    // Inicia quando video estiver pronto
    videoSafari.addEventListener('loadedmetadata', () => {
        canvas.width = videoSafari.videoWidth;
        canvas.height = videoSafari.videoHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
        startRendering();
    });

    // Visibilidade da pagina - pausa/resume
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            videoSafari.pause();
        } else {
            videoSafari.play().catch(() => {});
        }
    });

    // Se video ja carregou, inicia imediatamente
    if (videoSafari.readyState >= videoSafari.HAVE_METADATA) {
        startRendering();
    }
})();

// Create Animated Particles - OTIMIZADO PARA MOBILE
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;

    // Detecta se e mobile ou se usuario prefere menos movimento
    const isMobile = window.innerWidth <= 768;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Nao cria particulas se reduced motion ou mobile pequeno
    if (prefersReducedMotion || window.innerWidth <= 480) {
        return;
    }

    // Menos particulas em mobile para melhor performance
    const particleCount = isMobile ? 15 : 50;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = -(Math.random() * 20) + 's';
        // Animacao mais lenta em mobile = menos processamento
        const duration = isMobile ? (25 + Math.random() * 15) : (15 + Math.random() * 10);
        particle.style.animationDuration = duration + 's';
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
// NOTA: Este listener eh redundante - existe versao otimizada abaixo (optimizedScrollHandler)
// e outra no inline script do index.html. Mantido comentado para referencia.
// O efeito de scroll da navbar eh tratado pelo inline script em index.html

// Smooth Scrolling for Anchor Links
// CORRIGIDO: Usa event delegation para capturar links dinamicos tambem
document.addEventListener('click', function(e) {
    const anchor = e.target.closest('a[href^="#"]');
    if (!anchor) return;

    const targetId = anchor.getAttribute('href');
    if (!targetId || targetId === '#') return;

    const target = document.querySelector(targetId);
    if (target) {
        e.preventDefault();
        const navbarHeight = 80;
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - navbarHeight;

        window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
        });
    }
});

// Initialize Scroll Animations
// CORRIGIDO: Usa classes CSS ao inves de inline styles para evitar conflito com hover 3D
function initializeAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Usar classe ao inves de inline style para nao conflitar com hover 3D
                entry.target.classList.add('visible');
                entry.target.classList.remove('hidden-initial');
            }
        });
    }, observerOptions);

    // Observe all service cards - usar classes CSS
    document.querySelectorAll('.service-card').forEach(card => {
        card.classList.add('hidden-initial');
        observer.observe(card);
    });

    // Observe tech items - usar classes CSS
    document.querySelectorAll('.tech-item').forEach((item, index) => {
        item.classList.add('hidden-initial');
        item.style.transitionDelay = `${index * 0.1}s`;
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
// REMOVIDO: Ano agora eh renderizado inline no HTML via document.write()
// Isso elimina flash de ano errado e simplifica o codigo

// Parallax Effect for Hero Section
// NOTA: Movido para optimizedScrollHandler com debounce para melhor performance

// Add Hover Effect to Service Cards with Mouse Position
// CORRIGIDO: Efeito 3D apenas quando card estiver visivel (apos scroll animation)
// OTIMIZADO: Desabilitado em mobile e touch devices
document.addEventListener('DOMContentLoaded', () => {
    // Nao aplica efeito 3D em touch devices ou mobile
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isMobile = window.innerWidth <= 768;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isTouchDevice || isMobile || prefersReducedMotion) {
        return; // Sai da funcao, nao aplica efeito 3D
    }

    document.querySelectorAll('.service-card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            // Apenas aplicar efeito 3D se o card ja estiver visivel
            if (!card.classList.contains('visible')) return;

            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = (y - centerY) / 15; // Suavizado
            const rotateY = (centerX - x) / 15;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`;
        });

        card.addEventListener('mouseleave', () => {
            if (!card.classList.contains('visible')) return;
            card.style.transform = '';
        });
    });
});

// Add Typing Effect to Hero Title (optional enhancement)
// DESATIVADO: Conflita com animacao CSS glitch que eh mais impactante visualmente
// O efeito glitch eh parte da identidade visual futuristica da marca
// Mantido comentado para referencia caso queira reativar no futuro
/*
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

    setTimeout(type, 1500);
}

window.addEventListener('load', () => {
    setTimeout(typewriterEffect, 500);
});
*/

// Mobile Menu Toggle
// TODO: Implementar menu hamburguer quando necessario para mobile
// A navbar atual usa layout responsivo que esconde itens em telas pequenas
// Para implementar, adicionar ao HTML:
//   <button id="menu-toggle" aria-label="Menu">...</button>
//   <nav id="mobile-menu">...</nav>

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

// Optimized scroll handler - apenas para parallax
// NOTA: Navbar scroll eh tratado pelo inline script em index.html para evitar duplicacao
// OTIMIZADO: Desabilitado em mobile para performance

const isMobileDevice = window.innerWidth <= 768;
const prefersReducedMotionGlobal = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Parallax apenas em desktop e sem reduced motion
if (!isMobileDevice && !prefersReducedMotionGlobal) {
    const optimizedScrollHandler = debounce(() => {
        // Parallax effect para cube-container (se existir)
        const scrolled = window.pageYOffset;
        const parallaxElements = document.querySelectorAll('.cube-container');
        parallaxElements.forEach(el => {
            const speed = 0.3;
            el.style.transform = `translateY(${scrolled * speed}px)`;
        });
    }, 16); // 16ms = ~60fps

    // Registrar handler otimizado para parallax
    window.addEventListener('scroll', optimizedScrollHandler, { passive: true });
}

// Scroll Indicator Fixo - esconde apos scroll
(function initScrollIndicatorFixed() {
    const indicator = document.getElementById('scroll-indicator-main');
    if (!indicator) return;

    window.addEventListener('scroll', function() {
        if (window.scrollY > 150) {
            indicator.classList.add('hidden');
        } else {
            indicator.classList.remove('hidden');
        }
    }, { passive: true });
})();

// Recarrega particulas ao mudar orientacao (mobile)
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        const particlesContainer = document.getElementById('particles');
        if (particlesContainer) {
            particlesContainer.innerHTML = ''; // Limpa particulas
            createParticles(); // Recria com novo tamanho de tela
        }
    }, 100);
});

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

// Console Easter Egg (sempre exibe - branding)
logger.brand(
    '%c🚀 ImaginaTech - O Futuro da Impressão 3D',
    'color: #00D4FF; font-size: 20px; font-weight: bold; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);'
);
logger.brand(
    '%c📧 contato@imaginatech.com.br | 📱 (21) 96897-2539',
    'color: #57D4CA; font-size: 14px;'
);

// Error Handling for Images
document.querySelectorAll('img').forEach(img => {
    img.addEventListener('error', function() {
        this.style.display = 'none';
        logger.warn(`Failed to load image: ${this.src}`);
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
// TOUCH GESTURES PARA CARROSSEL (MOBILE)
// ============================================
(function initCarouselTouch() {
    const carousel = document.querySelector('.projetos-carousel');
    if (!carousel) return;

    // Apenas ativa em touch devices
    if (!('ontouchstart' in window)) return;

    let touchStartX = 0;
    let touchEndX = 0;
    let touchStartTime = 0;
    const minSwipeDistance = 50; // pixels minimos para considerar swipe
    const maxSwipeTime = 300; // tempo maximo em ms para swipe rapido

    carousel.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartTime = Date.now();
    }, { passive: true });

    carousel.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        const touchEndTime = Date.now();
        const swipeTime = touchEndTime - touchStartTime;

        handleSwipe(swipeTime);
    }, { passive: true });

    function handleSwipe(swipeTime) {
        const distance = touchEndX - touchStartX;
        const isQuickSwipe = swipeTime < maxSwipeTime;

        // Swipe para esquerda (proximo)
        if (distance < -minSwipeDistance) {
            if (isQuickSwipe) {
                moveCarousel(1);
            }
        }

        // Swipe para direita (anterior)
        if (distance > minSwipeDistance) {
            if (isQuickSwipe) {
                moveCarousel(-1);
            }
        }
    }
})();

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

// Carregar itens do carrossel de PROJETOS (hero) - NOVO SISTEMA: featured
// Armazena projetos featured para uso no modal
let featuredProjects = [];

async function loadCarouselItems() {
    if (!db) return;

    try {
        // NOVO SISTEMA: Busca projetos com featured=true OU showOnLanding=true (compatibilidade)
        // Primeiro tenta o novo campo, depois fallback para o antigo
        let snapshot = await db.collection('portfolio')
            .where('active', '==', true)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            logger.log('Nenhum projeto no carrossel - mantendo estaticos');
            return;
        }

        // Filtrar no cliente: APENAS featured=true para o carrossel hero
        // showOnLanding agora eh usado apenas para compatibilidade quando featured nao existe
        const items = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Prioridade: featured=true (novo sistema)
            // Fallback: showOnLanding=true E showInGrid nao definido (projeto antigo pre-refatoracao)
            const isFeatured = data.featured === true;
            const isLegacyHero = data.showOnLanding === true && data.showInGrid === undefined && data.featured === undefined;

            if (isFeatured || isLegacyHero) {
                items.push({ id: doc.id, ...data });
            }
        });

        if (items.length === 0) {
            logger.log('Nenhum projeto com destaque - mantendo estaticos');
            return;
        }

        // Armazenar para uso no modal
        featuredProjects = items;

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

            // Adicionar event listeners para redirecionar para /projetos/
            projetosTrack.querySelectorAll('.projeto-card').forEach(card => {
                card.addEventListener('click', function() {
                    const projectId = this.dataset.projectId;
                    if (projectId) {
                        window.location.href = `/projetos/?projeto=${projectId}`;
                    }
                });
            });
        }

        logger.log(`Carrossel de projetos atualizado com ${items.length} item(s) com destaque`);
    } catch (error) {
        logger.error('Erro ao carregar carrossel:', error);
    }
}

// Abrir modal do projeto a partir do carrossel hero
function openProjectModalFromCarousel(projectId) {
    // Buscar projeto nos featured ou no portfolioData
    let project = featuredProjects.find(p => p.id === projectId);
    if (!project) {
        project = portfolioData.find(p => p.id === projectId);
    }
    if (project) {
        openPortfolioModal(project);
    }
}

// Criar card de projeto (para o carrossel do hero) - COM HOVER OVERLAY
function createProjetoCard(item) {
    const photoUrl = item.mainPhoto?.url || 'assets/images/projetos/projeto-1.svg';
    const logoUrl = item.logo?.url;
    const title = escapeHtml(item.title || 'Projeto');
    const description = escapeHtml(item.description || '');

    const logoHtml = logoUrl ? `
        <div class="projeto-logo">
            <img src="${escapeHtml(logoUrl)}" alt="Logo">
        </div>
    ` : '';

    // Truncar descricao para 100 caracteres no hover
    const shortDesc = description.length > 100 ? description.substring(0, 97) + '...' : description;

    // Indicador de galeria
    const extraCount = item.extraPhotos?.length || 0;
    const galleryHtml = extraCount > 0 ? `
        <span class="projeto-gallery-badge"><i class="fas fa-images"></i> ${1 + extraCount}</span>
    ` : '';

    // Hover overlay com descricao e botao
    const hoverOverlay = `
        <div class="projeto-hover-overlay">
            ${shortDesc ? `<p class="projeto-hover-desc">${shortDesc}</p>` : ''}
            <span class="projeto-hover-cta">
                <i class="fas fa-expand"></i> Ver Projeto
            </span>
        </div>
    `;

    return `
        <div class="projeto-card" data-project-id="${escapeHtml(item.id)}" style="cursor: pointer;">
            <div class="projeto-image loading">
                <img src="${escapeHtml(photoUrl)}" alt="${title}">
                ${logoHtml}
                ${galleryHtml}
                ${hoverOverlay}
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
    if (!clientsTrack || items.length === 0) return;

    // Criar HTML de um logo (com escape para seguranca)
    const createLogoHtml = (item) => `
        <div class="client-logo client-logo-dynamic">
            <img src="${escapeHtml(item.logo.url)}" alt="${escapeHtml(item.title)}" class="client-logo-img">
        </div>
    `;

    // Calcular quantas vezes duplicar para preencher a tela + margem para loop
    // Assumindo ~350px por logo, precisamos de pelo menos 2x a largura da tela
    const screenWidth = window.innerWidth;
    const logoWidth = 350;
    const totalLogosWidth = items.length * logoWidth;
    const duplications = Math.max(4, Math.ceil((screenWidth * 3) / totalLogosWidth));

    // Criar HTML com duplicacoes suficientes para loop infinito
    let allLogosHtml = '';
    for (let i = 0; i < duplications; i++) {
        allLogosHtml += items.map(createLogoHtml).join('');
    }

    // Limpar e adicionar ao carrossel
    clientsTrack.innerHTML = allLogosHtml;

    // Ajustar velocidade da animacao baseado na quantidade de logos
    const totalWidth = items.length * logoWidth * duplications;
    const duration = Math.max(10, (totalWidth / 100)); // ~100px por segundo
    clientsTrack.style.animationDuration = `${duration}s`;

    logger.log(`${items.length} logo(s) adicionado(s) ao carrossel (${duplications}x duplicado)`);
}

// Carregar logos de TODOS os projetos ativos para o carrossel de empresas
async function loadAllLogosToCarousel() {
    if (!db) return;

    try {
        // Buscar TODOS os projetos ativos
        const snapshot = await db.collection('portfolio')
            .where('active', '==', true)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            logger.log('Nenhum projeto para logos');
            return;
        }

        // Filtrar apenas projetos que tem logo
        const itemsComLogo = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.logo && data.logo.url) {
                itemsComLogo.push({ id: doc.id, ...data });
            }
        });

        if (itemsComLogo.length > 0) {
            addLogosToClientsCarousel(itemsComLogo);
        }

        logger.log(`${itemsComLogo.length} logo(s) de projetos carregado(s)`);
    } catch (error) {
        logger.error('Erro ao carregar logos:', error);
    }
}

// Carregar grid de portfolio (projetos anteriores)
async function loadPortfolioGrid() {
    if (!db) return;

    try {
        // SISTEMA DE 3 NIVEIS: Busca todos ativos e filtra por showInGrid
        const snapshot = await db.collection('portfolio')
            .where('active', '==', true)
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            logger.log('Nenhum projeto no portfolio - mantendo estaticos');
            return;
        }

        // Filtrar projetos para o grid da home
        portfolioItems = [];
        snapshot.forEach(doc => {
            const data = doc.data();

            // SISTEMA DE 3 NIVEIS: Verificar showInGrid
            // Se showInGrid existe (novo sistema), usar ele
            // Se showInGrid NAO existe (item antigo), usar showOnLanding como fallback
            const isNewSystem = data.showInGrid !== undefined;
            const shouldShowInGrid = isNewSystem
                ? data.showInGrid === true
                : data.showOnLanding === true; // fallback para items antigos

            if (shouldShowInGrid && portfolioItems.length < 6) {
                portfolioItems.push({ id: doc.id, ...data });
            }
        });

        // Se nao houver projetos marcados para o grid, manter estaticos
        if (portfolioItems.length === 0) {
            logger.log('Nenhum projeto marcado para grid - mantendo estaticos');
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

        logger.log(`Grid portfolio atualizado com ${portfolioItems.length} projeto(s)`);
    } catch (error) {
        logger.error('Erro ao carregar portfolio:', error);
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

    const categoryDisplay = escapeHtml(categoryMap[item.category] || item.category || 'Projeto');
    const description = escapeHtml(item.description || '');
    const title = escapeHtml(item.title || 'Projeto');
    const material = escapeHtml(item.material || 'PLA');
    const color = escapeHtml(item.color || 'Variado');
    const photoUrl = escapeHtml(item.mainPhoto?.url || 'https://placehold.co/400x300/0a1420/00D4FF?text=Projeto');
    const itemId = escapeHtml(item.id);

    // Truncar descricao para 100 caracteres
    const shortDesc = description.length > 100 ? description.substring(0, 97) + '...' : description;

    // Logo overlay se disponivel
    const logoOverlay = item.logo && item.logo.url ? `
        <div class="portfolio-logo-overlay">
            <img src="${escapeHtml(item.logo.url)}" alt="Logo" class="portfolio-logo-img">
        </div>
    ` : '';

    // Indicador de galeria se tiver fotos extras
    const hasGallery = item.extraPhotos && item.extraPhotos.length > 0;
    const galleryIndicator = hasGallery ? `
        <div class="portfolio-gallery-indicator">
            <i class="fas fa-images"></i> ${1 + item.extraPhotos.length}
        </div>
    ` : '';

    // Hover overlay com descricao e botao
    const hoverOverlay = `
        <div class="portfolio-hover-overlay">
            ${shortDesc ? `<p class="portfolio-hover-desc">${shortDesc}</p>` : ''}
            <span class="portfolio-hover-cta">
                <i class="fas fa-expand"></i> Ver Projeto
            </span>
        </div>
    `;

    return `
        <div class="portfolio-card" data-aos="fade-up" data-aos-delay="${delay}" data-action="open-portfolio" data-project-id="${itemId}" style="cursor: pointer;">
            <div class="portfolio-image loading">
                <img src="${photoUrl}" alt="${title}" loading="lazy">
                <div class="portfolio-overlay">
                    <span class="portfolio-category">${categoryDisplay}</span>
                </div>
                ${logoOverlay}
                ${galleryIndicator}
                ${hoverOverlay}
            </div>
            <div class="portfolio-info">
                <h3>${title}</h3>
                <div class="portfolio-specs">
                    <span class="spec-badge"><i class="fas fa-cube"></i> ${material}</span>
                    <span class="spec-badge"><i class="fas fa-palette"></i> ${color}</span>
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
    const imageContainer = document.querySelector('.portfolio-modal-image-container');

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

    // TOUCH GESTURES para navegacao no modal (mobile)
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
                    navigatePortfolioPhoto(1); // Swipe esquerda = proximo
                } else {
                    navigatePortfolioPhoto(-1); // Swipe direita = anterior
                }
            }
        }, { passive: true });
    }
}

function openPortfolioModal(projectIdOrObject) {
    // Aceita tanto ID (string) quanto objeto completo
    let project;
    if (typeof projectIdOrObject === 'string') {
        // Busca por ID nos portfolioItems (grid) ou featuredProjects (carrossel)
        project = portfolioItems.find(p => p.id === projectIdOrObject) ||
                  featuredProjects.find(p => p.id === projectIdOrObject);
    } else if (typeof projectIdOrObject === 'object' && projectIdOrObject !== null) {
        // Objeto passado diretamente
        project = projectIdOrObject;
    }

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
    const modalDescription = document.getElementById('portfolio-modal-description');

    if (modalTitle) {
        modalTitle.textContent = project.title;
    }

    if (modalSpecs) {
        modalSpecs.innerHTML = `
            <span class="spec-badge"><i class="fas fa-cube"></i> ${escapeHtml(project.material || 'PLA')}</span>
            <span class="spec-badge"><i class="fas fa-palette"></i> ${escapeHtml(project.color || 'Variado')}</span>
        `;
    }

    if (modalDescription) {
        modalDescription.textContent = project.description || '';
    }

    setupPortfolioPhotoNavigation();
    showPortfolioPhoto(0);

    const overlay = document.getElementById('portfolio-modal-overlay');
    if (overlay) {
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
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
            <div class="portfolio-modal-thumb ${index === 0 ? 'active' : ''}" data-action="portfolio-thumb" data-index="${index}">
                <img src="${escapeHtml(url)}" alt="Foto ${index + 1}" loading="lazy">
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
        overlay.setAttribute('aria-hidden', 'true');
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
                loadPortfolioGrid(),
                loadAllLogosToCarousel()
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
