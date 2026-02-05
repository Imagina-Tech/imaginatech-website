// ==========================================
// ADMIN PORTFOLIO - SCRIPT
// ==========================================

// ==========================================
// SECURITY UTILITIES
// ==========================================

/**
 * Logger - usa o logger centralizado do Firestore
 * Carregado via /shared/firestore-logger.js
 */
const logger = window.logger || {
    log: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
};

// Escape HTML para prevenir XSS
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Gerar ID seguro com crypto.getRandomValues
function generateSecureId(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, n => chars[n % chars.length]).join('');
}

// Validar magic bytes de imagens
async function validateImageMagicBytes(file) {
    try {
        const buffer = await file.slice(0, 12).arrayBuffer();
        const bytes = new Uint8Array(buffer);

        // JPEG: FF D8 FF
        if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
            return 'image/jpeg';
        }

        // PNG: 89 50 4E 47 0D 0A 1A 0A
        if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
            return 'image/png';
        }

        // GIF: 47 49 46 38 (GIF8)
        if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
            return 'image/gif';
        }

        // WebP: 52 49 46 46 ... 57 45 42 50 (RIFF...WEBP)
        if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
            bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
            return 'image/webp';
        }

        return false;
    } catch (e) {
        logger.error('Erro ao validar magic bytes:', e);
        return false;
    }
}

// Sanitizar nome de arquivo
function sanitizeFileName(name) {
    if (!name) return 'file';
    return name
        .replace(/\.\./g, '')           // Path traversal
        .replace(/[\/\\:*?"<>|]/g, '_') // Caracteres invalidos
        .replace(/\s+/g, '_')           // Espacos
        .slice(0, 200);                 // Tamanho maximo
}

// Tipos de imagem permitidos (SEM SVG - risco de XSS)
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_LOGO_TYPES = ['image/png', 'image/webp']; // Logo sem SVG

// Firebase instance
let db, auth, storage;
let currentUser = null;
let portfolioItems = [];
let currentFilter = 'todos';
let currentSearch = '';
let allServices = []; // Lista de servicos para o dropdown
let isAddMode = false; // Modo de adicao vs edicao
let selectedServicePhoto = null; // Foto do servico selecionado para herdar

// Emails autorizados (carregados do ENV_CONFIG)
function getAuthorizedEmails() {
    if (window.ENV_CONFIG && window.ENV_CONFIG.AUTHORIZED_ADMINS) {
        return window.ENV_CONFIG.AUTHORIZED_ADMINS.map(admin => admin.email);
    }
    return [];
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    initializeFirebase();

    // SEGURANCA: Handler para fallback de imagens (substitui onerror inline)
    document.addEventListener('error', (e) => {
        if (e.target.tagName === 'IMG' && e.target.dataset.fallback) {
            e.target.src = e.target.dataset.fallback;
            e.target.removeAttribute('data-fallback'); // Evita loop infinito
        }
    }, true);
});

function initializeFirebase() {
    try {
        // Check if already initialized
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
        auth = firebase.auth();
        storage = firebase.storage();

        // Listen for auth state changes
        auth.onAuthStateChanged(handleAuthStateChange);

    } catch (error) {
        logger.error('Erro ao inicializar Firebase:', error);
        showToast('Erro ao conectar com o servidor', 'error');
        hideLoading();
    }
}

function handleAuthStateChange(user) {
    if (user) {
        // Check if authorized
        const authorizedEmails = getAuthorizedEmails();
        if (authorizedEmails.includes(user.email)) {
            currentUser = user;
            showDashboard();
            loadPortfolioItems();
        } else {
            // Not authorized - show access denied
            currentUser = user;
            showAccessDenied(user.email);
        }
    } else {
        currentUser = null;
        showLoginScreen();
    }
}

// ==========================================
// AUTHENTICATION
// ==========================================

function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    showLoading('Entrando...');

    auth.signInWithPopup(provider)
        .then(result => {
            // SEGURANCA: Verificar se o email foi verificado
            if (result.user && !result.user.emailVerified) {
                logger.warn('[Auth] Email nao verificado:', result.user.email);
                auth.signOut();
                hideLoading();
                showToast('Seu email precisa ser verificado. Verifique sua caixa de entrada.', 'error');
                return;
            }
        })
        .catch(error => {
            logger.error('Erro no login:', error);
            showToast('Erro ao fazer login', 'error');
            hideLoading();
        });
}

function signOut() {
    auth.signOut()
        .then(() => {
            showToast('Logout realizado com sucesso', 'success');
        })
        .catch(error => {
            logger.error('Erro no logout:', error);
            showToast('Erro ao sair', 'error');
        });
}

// ==========================================
// UI STATE
// ==========================================

function showLoading(text = 'Carregando...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingOverlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showLoginScreen() {
    hideLoading();
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('accessDeniedScreen').classList.remove('active');
    document.getElementById('dashboard').classList.add('hidden');
}

function showAccessDenied(email) {
    hideLoading();
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('accessDeniedScreen').classList.add('active');
    document.getElementById('dashboard').classList.add('hidden');
    // Usar textContent e seguro contra XSS
    const emailEl = document.getElementById('deniedUserEmail');
    if (emailEl) emailEl.textContent = email || '';
}

function showDashboard() {
    hideLoading();
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('accessDeniedScreen').classList.remove('active');
    document.getElementById('dashboard').classList.remove('hidden');

    // Update user info
    document.getElementById('userPhoto').src = currentUser.photoURL || '/iconwpp.jpg';
    document.getElementById('userName').textContent = currentUser.displayName || currentUser.email;

    // Setup event listeners
    setupEventListeners();

    // Carregar lista de servicos para o dropdown
    loadServicesForDropdown();
}

// ==========================================
// LOAD SERVICES FOR DROPDOWN
// ==========================================

async function loadServicesForDropdown() {
    try {
        const snapshot = await db.collection('services')
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();

        allServices = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // mainPhoto pode ser objeto {url, path} ou string direta
            const mainPhotoUrl = data.mainPhoto?.url || data.mainPhoto || data.instagramPhoto || null;
            // images pode ser array de objetos ou strings
            const photos = data.images || data.packagedPhotos || [];

            allServices.push({
                id: doc.id,
                name: data.name || 'Sem nome',
                client: data.client || '',
                orderCode: data.orderCode || '',
                mainImage: mainPhotoUrl,
                photos: photos,
                createdAt: data.createdAt
            });
        });

        logger.log(`Carregados ${allServices.length} servicos para dropdown`);
    } catch (error) {
        logger.error('Erro ao carregar servicos:', error);
    }
}

function populateServicesDropdown(selectedServiceId = '') {
    const select = document.getElementById('editServiceLink');
    if (!select) return;

    // Manter a primeira opcao
    select.innerHTML = '<option value="">Nenhum - Item avulso</option>';

    // Adicionar servicos
    allServices.forEach(service => {
        const displayName = service.orderCode
            ? `[${service.orderCode}] ${service.name} - ${service.client}`
            : `${service.name} - ${service.client}`;

        const option = document.createElement('option');
        option.value = service.id;
        option.textContent = displayName;
        if (service.id === selectedServiceId) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    // Disparar evento para sincronizar CustomSelect
    setTimeout(() => {
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }, 50);
}

function setupEventListeners() {
    // Filter buttons (stat cards)
    document.querySelectorAll('.stat-card[data-filter]').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.stat-card[data-filter]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentFilter = this.dataset.filter;
            renderPortfolioItems();
        });
    });

    // Search input
    document.getElementById('searchInput').addEventListener('input', function() {
        currentSearch = this.value.toLowerCase().trim();
        renderPortfolioItems();
    });

    // Setup drag and drop for upload areas
    setupDragAndDrop();

    // SEGURANCA: Event delegation global para data-action
    setupGlobalEventDelegation();
}

// ==========================================
// GLOBAL EVENT DELEGATION - SEGURANCA
// ==========================================

function setupGlobalEventDelegation() {
    // Handler de click global para data-action
    document.addEventListener('click', handleGlobalClick);

    // Handler de change global para inputs/selects com data-action
    document.addEventListener('change', handleGlobalChange);

    // Handler de input global para campos de busca
    document.addEventListener('input', handleGlobalInput);
}

function handleGlobalClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;

    // Mapear acoes para funcoes
    const actions = {
        'sign-in-google': () => signInWithGoogle(),
        'sign-out': () => signOut(),
        'toggle-mobile-menu': () => typeof toggleMobileMenu === 'function' && toggleMobileMenu(),
        'open-add-modal': () => openAddModal(),
        'close-edit-modal': () => closeEditModal(),
        'save-item': () => saveItem(),
        'remove-photo': (el) => { e.stopPropagation(); removePhoto(); },
        'remove-logo': (el) => { e.stopPropagation(); removeLogo(); },
        'open-gallery': (el) => openGalleryModal(el.dataset.mode || 'main'),
        'add-extra-photo-slot': () => addExtraPhotoSlotAdmin(),
        'close-delete-modal': () => closeDeleteModal(),
        'confirm-delete': () => confirmDelete(),
        'close-gallery-modal': () => closeGalleryModal(),
        'add-selected-photos': () => addSelectedPhotosFromGallery(),
        'edit-item': (el) => openEditModal(el.dataset.id),
        'delete-item': (el) => openDeleteModal(el.dataset.id),
        'remove-new-extra-photo': (el) => { e.stopPropagation(); removeNewExtraPhoto(parseInt(el.dataset.slotId)); },
        'remove-existing-extra-photo': (el) => {
            e.stopPropagation();
            const item = el.closest('.extra-photo-item');
            if (item) {
                removeExistingExtraPhoto(el, item.dataset.url, item.dataset.path);
            }
        },
        'remove-gallery-extra-photo': (el) => { e.stopPropagation(); removeGalleryExtraPhoto(el); },
        'trigger-extra-photo-input': (el) => {
            const slotId = el.dataset.slotId;
            const input = document.getElementById(`adminExtraInput_${slotId}`);
            if (input) input.click();
        }
    };

    if (actions[action]) {
        actions[action](target);
    }
}

function handleGlobalChange(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;

    const actions = {
        'service-link-change': () => onServiceLinkChange(),
        'toggle-inherit-photo': () => toggleInheritPhoto(),
        'photo-select': () => handleMultiplePhotosSelect(e),
        'logo-select': () => handleLogoSelect(e),
        'publication-level-change': () => onPublicationLevelChange(),
        'extra-photo-select': () => {
            const slotId = parseInt(target.dataset.slotId);
            handleExtraPhotoSelectAdmin(e, slotId);
        }
    };

    if (actions[action]) {
        actions[action]();
    }
}

function handleGlobalInput(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;

    if (action === 'filter-gallery') {
        filterGalleryPhotos();
    }
}

// ==========================================
// DRAG AND DROP SETUP
// ==========================================

function setupDragAndDrop() {
    // Photo upload area
    const photoArea = document.getElementById('editPhotoArea');
    if (photoArea) {
        setupDropZone(photoArea, 'editPhoto', handlePhotoSelect);
    }

    // Logo upload area
    const logoArea = document.getElementById('editLogoArea');
    if (logoArea) {
        setupDropZone(logoArea, 'editLogo', handleLogoSelect);
    }
}

function setupDropZone(dropZone, inputId, handler) {
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-over');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-over');
        }, false);
    });

    // Handle dropped files - SUPORTE A MULTIPLAS FOTOS
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = Array.from(dt.files).filter(f => f.type.startsWith('image/'));

        if (files.length === 0) {
            showToast('Por favor, selecione apenas arquivos de imagem', 'error');
            return;
        }

        // Se for a area de foto principal e tiver multiplas fotos
        if (inputId === 'editPhoto' && files.length > 1) {
            // Primeira foto vai para principal
            const fakeEvent = {
                target: {
                    files: [files[0]]
                }
            };
            handler(fakeEvent);

            // Demais fotos vao para fotos extras
            for (let i = 1; i < files.length && i < 6; i++) {
                addExtraPhotoFromFile(files[i]);
            }

            showToast(`${files.length} foto(s) adicionada(s): 1 principal + ${Math.min(files.length - 1, 5)} extra(s)`, 'success');
        } else {
            // Comportamento padrao: uma foto
            const fakeEvent = {
                target: {
                    files: [files[0]]
                }
            };
            handler(fakeEvent);
        }
    }, false);

    // Handle click to open file dialog
    dropZone.addEventListener('click', (e) => {
        // Nao abrir se clicou no botao de remover
        if (e.target.closest('.btn-remove-img')) return;
        document.getElementById(inputId).click();
    });
}

// Adicionar foto extra a partir de um arquivo - com validacao
async function addExtraPhotoFromFile(file) {
    if (!file || !ALLOWED_IMAGE_TYPES.includes(file.type)) return;

    // SEGURANCA: Validar magic bytes
    const detectedType = await validateImageMagicBytes(file);
    if (!detectedType) return;

    const grid = document.getElementById('editExtraPhotosGrid');
    if (!grid) return;

    // Verificar limite de 5 fotos extras
    const existingCount = grid.querySelectorAll('.extra-photo-item.existing:not(.to-delete)').length;
    const newCount = newExtraPhotosFiles.filter(f => f !== null).length;
    const fromGalleryCount = grid.querySelectorAll('.extra-photo-item.from-gallery').length;

    if (existingCount + newCount + fromGalleryCount >= 5) {
        return; // Silenciosamente ignorar se ja atingiu o limite
    }

    const slotId = extraPhotoSlotCounterAdmin++;

    // Expandir array
    while (newExtraPhotosFiles.length <= slotId) {
        newExtraPhotosFiles.push(null);
    }
    newExtraPhotosFiles[slotId] = file;

    const slot = document.createElement('div');
    slot.className = 'extra-photo-item has-file';
    slot.id = `adminExtraSlot_${slotId}`;

    const reader = new FileReader();
    reader.onload = (e) => {
        // SEGURANCA: Usar data-action ao inves de onclick inline
        slot.innerHTML = `
            <img src="${e.target.result}" alt="Nova foto">
            <button type="button" class="btn-remove-extra" data-action="remove-new-extra-photo" data-slot-id="${slotId}">
                <i class="fas fa-times"></i>
            </button>
        `;
    };
    reader.readAsDataURL(file);

    grid.appendChild(slot);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// ==========================================
// LOAD PORTFOLIO ITEMS
// ==========================================

async function loadPortfolioItems() {
    showLoading('Carregando portfolio...');

    try {
        const snapshot = await db.collection('portfolio')
            .orderBy('createdAt', 'desc')
            .get();

        portfolioItems = [];
        snapshot.forEach(doc => {
            portfolioItems.push({
                id: doc.id,
                ...doc.data()
            });
        });

        updateStats();
        renderPortfolioItems();
        hideLoading();

    } catch (error) {
        logger.error('Erro ao carregar portfolio:', error);
        showToast('Erro ao carregar items', 'error');
        hideLoading();
    }
}

// ==========================================
// UPDATE STATS - NOVO SISTEMA DE NIVEIS
// ==========================================

function updateStats() {
    const total = portfolioItems.length;
    // QAP = nao publicado (rascunho)
    const qap = portfolioItems.filter(i => !i.published).length;
    // Publicados em /projetos/
    const published = portfolioItems.filter(i => i.published).length;
    // Grid = publicados que aparecem no grid da home
    const grid = portfolioItems.filter(i => i.published && i.showInGrid).length;
    // Featured = publicados que aparecem no carrossel hero
    const featured = portfolioItems.filter(i => i.published && i.featured).length;

    document.getElementById('totalItems').textContent = total;
    document.getElementById('qapItems').textContent = qap;
    document.getElementById('publishedItems').textContent = published;
    document.getElementById('gridItems').textContent = grid;
    document.getElementById('featuredItems').textContent = featured;
}

// ==========================================
// RENDER PORTFOLIO ITEMS
// ==========================================

function renderPortfolioItems() {
    const grid = document.getElementById('portfolioGrid');
    const emptyState = document.getElementById('emptyState');

    // Filter items - SISTEMA DE 3 NIVEIS INDEPENDENTES
    let filtered = portfolioItems;

    if (currentFilter === 'qap') {
        // QAP = rascunhos nao publicados
        filtered = filtered.filter(i => !i.published);
    } else if (currentFilter === 'published') {
        // Publicados em /projetos/
        filtered = filtered.filter(i => i.published);
    } else if (currentFilter === 'grid') {
        // Aparecem no grid da home
        filtered = filtered.filter(i => i.published && i.showInGrid);
    } else if (currentFilter === 'featured') {
        // Aparecem no carrossel hero
        filtered = filtered.filter(i => i.published && i.featured);
    }

    // Search filter
    if (currentSearch) {
        filtered = filtered.filter(i =>
            (i.title && i.title.toLowerCase().includes(currentSearch)) ||
            (i.category && i.category.toLowerCase().includes(currentSearch))
        );
    }

    // Render
    if (filtered.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';
    grid.innerHTML = filtered.map(item => createPortfolioCard(item)).join('');
}

function createPortfolioCard(item) {
    // SEGURANCA: Escape de todos os dados do usuario
    const safeId = escapeHtml(item.id);
    const safeTitle = escapeHtml(item.title) || 'Sem titulo';
    const safeCategory = escapeHtml(item.category);
    const imageUrl = escapeHtml(item.mainPhoto?.url || item.imageUrl || '/iconwpp.jpg');
    const logoUrl = item.logo?.url ? escapeHtml(item.logo.url) : '';

    // SISTEMA DE 3 NIVEIS INDEPENDENTES
    // Badge principal: QAP ou Publicado
    let badgeClass, badgeText;
    if (item.published) {
        badgeClass = 'published';
        badgeText = '/projetos/';
    } else {
        badgeClass = 'qap';
        badgeText = 'QAP';
    }

    const createdDate = item.createdAt ? formatDate(item.createdAt) : '-';

    let logoHtml = '';
    if (logoUrl) {
        logoHtml = `<div class="card-logo"><img src="${logoUrl}" alt="Logo"></div>`;
    }

    let categoryHtml = '';
    if (safeCategory) {
        categoryHtml = `<span class="card-category">${safeCategory}</span>`;
    }

    // Badge NOVO
    let newBadgeHtml = '';
    if (item.isNew) {
        newBadgeHtml = `<span class="card-badge-new"><i class="fas fa-certificate"></i> NOVO</span>`;
    }

    // Indicador de galeria
    let galleryBadgeHtml = '';
    const extraPhotosCount = item.extraPhotos?.length || 0;
    if (extraPhotosCount > 0) {
        galleryBadgeHtml = `<span class="gallery-badge"><i class="fas fa-images"></i> ${1 + extraPhotosCount}</span>`;
    }

    // Badge de grid (aparece no grid da home)
    let gridBadgeHtml = '';
    if (item.published && item.showInGrid) {
        gridBadgeHtml = `<span class="card-badge-grid" title="Grid da Home"><i class="fas fa-th-large"></i></span>`;
    }

    // Badge de destaque (aparece no carrossel hero)
    let featuredBadgeHtml = '';
    if (item.published && item.featured) {
        featuredBadgeHtml = `<span class="card-badge-featured" title="Carrossel Hero"><i class="fas fa-star"></i></span>`;
    }

    // SEGURANCA: Usar data-action ao inves de onclick inline
    return `
        <div class="portfolio-card" data-id="${safeId}">
            <div class="card-image">
                <img src="${imageUrl}" alt="${safeTitle}" data-fallback="/iconwpp.jpg">
                <span class="card-badge ${badgeClass}">${badgeText}</span>
                ${newBadgeHtml}
                ${galleryBadgeHtml}
                ${gridBadgeHtml}
                ${featuredBadgeHtml}
                ${logoHtml}
            </div>
            <div class="card-body">
                <h3 class="card-title">${safeTitle}</h3>
                <div class="card-meta">
                    <span><i class="fas fa-calendar"></i> ${createdDate}</span>
                    ${item.serviceId ? `<span><i class="fas fa-link"></i> Vinculado</span>` : `<span><i class="fas fa-unlink"></i> Avulso</span>`}
                </div>
                ${categoryHtml}
                <div class="card-actions">
                    <button class="btn-action edit" data-action="edit-item" data-id="${safeId}">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-action delete" data-action="delete-item" data-id="${safeId}">
                        <i class="fas fa-trash"></i> Excluir
                    </button>
                </div>
            </div>
        </div>
    `;
}

function formatDate(timestamp) {
    if (!timestamp) return '-';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// ==========================================
// ADD/EDIT MODAL
// ==========================================

let editingItem = null;
let newPhotoFile = null;
let newLogoFile = null;
let newExtraPhotosFiles = []; // Novas fotos extras a adicionar
let extraPhotosToDelete = []; // URLs das fotos extras a deletar
let extraPhotoSlotCounterAdmin = 0;

// ==========================================
// OPEN ADD MODAL (novo item)
// ==========================================

function openAddModal() {
    isAddMode = true;
    editingItem = null;
    selectedServicePhoto = null;

    // Atualizar titulo do modal
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus"></i> Novo Item';

    // Limpar formulario
    document.getElementById('editItemId').value = '';
    document.getElementById('editTitle').value = '';
    document.getElementById('editDescription').value = '';
    document.getElementById('editCategory').value = '';
    document.getElementById('editMaterial').value = '';
    document.getElementById('editColor').value = '';
    document.getElementById('editIsNew').checked = true; // Novo por padrao

    // SISTEMA DE 3 NIVEIS INDEPENDENTES
    document.getElementById('editPublished').checked = false;
    document.getElementById('editShowInGrid').checked = false;
    document.getElementById('editFeatured').checked = false;

    // Reset photo
    document.getElementById('editPhotoPreview').style.display = 'none';
    document.getElementById('editPhotoPlaceholder').style.display = 'flex';
    document.getElementById('editPhotoImg').src = '';
    document.getElementById('editPhotoPreview').dataset.galleryUrl = '';
    newPhotoFile = null;

    // Reset logo
    document.getElementById('editLogoPreview').style.display = 'none';
    document.getElementById('editLogoPlaceholder').style.display = 'flex';
    document.getElementById('editLogoImg').src = '';
    newLogoFile = null;

    // Reset extra photos
    newExtraPhotosFiles = [];
    extraPhotosToDelete = [];
    extraPhotoSlotCounterAdmin = 0;
    document.getElementById('editExtraPhotosGrid').innerHTML = '';

    // Atualizar status de publicacao
    onPublicationLevelChange();

    // Populate and reset service dropdown
    populateServicesDropdown('');
    document.getElementById('inheritServicePhoto').checked = false;
    document.getElementById('inheritPhotoSection').style.display = 'none';
    document.getElementById('inheritPhotoPreview').style.display = 'none';

    // Show modal e atualizar ARIA
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    }

    // Sync custom selects
    setTimeout(() => {
        document.getElementById('editCategory').dispatchEvent(new Event('change', { bubbles: true }));
    }, 50);
}

// ==========================================
// SERVICE LINK HANDLERS
// ==========================================

function onServiceLinkChange() {
    const serviceId = document.getElementById('editServiceLink').value;
    const inheritSection = document.getElementById('inheritPhotoSection');
    const inheritCheckbox = document.getElementById('inheritServicePhoto');
    const inheritPreview = document.getElementById('inheritPhotoPreview');

    if (!serviceId) {
        // Nenhum servico selecionado
        inheritSection.style.display = 'none';
        inheritCheckbox.checked = false;
        inheritPreview.style.display = 'none';
        selectedServicePhoto = null;
        return;
    }

    // Encontrar servico selecionado
    const service = allServices.find(s => s.id === serviceId);
    if (!service) return;

    // Verificar se o servico tem foto
    const servicePhotoUrl = service.mainImage || (service.photos && service.photos[0]?.url);

    if (servicePhotoUrl) {
        selectedServicePhoto = servicePhotoUrl;
        document.getElementById('inheritPhotoImg').src = servicePhotoUrl;
        inheritSection.style.display = 'block';
    } else {
        selectedServicePhoto = null;
        inheritSection.style.display = 'none';
        inheritCheckbox.checked = false;
    }
}

function toggleInheritPhoto() {
    const inheritCheckbox = document.getElementById('inheritServicePhoto');
    const inheritPreview = document.getElementById('inheritPhotoPreview');
    const photoArea = document.getElementById('editPhotoArea');

    if (inheritCheckbox.checked && selectedServicePhoto) {
        // Mostrar preview da foto herdada
        inheritPreview.style.display = 'flex';
        // Esconder area de upload manual
        photoArea.style.opacity = '0.5';
        photoArea.style.pointerEvents = 'none';
    } else {
        inheritPreview.style.display = 'none';
        photoArea.style.opacity = '1';
        photoArea.style.pointerEvents = 'auto';
    }
}

function openEditModal(itemId) {
    isAddMode = false;
    editingItem = portfolioItems.find(i => i.id === itemId);
    if (!editingItem) {
        showToast('Item nao encontrado', 'error');
        return;
    }

    // Atualizar titulo do modal
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Item';

    // Fill form
    document.getElementById('editItemId').value = itemId;
    document.getElementById('editTitle').value = editingItem.title || '';
    document.getElementById('editDescription').value = editingItem.description || '';
    document.getElementById('editCategory').value = editingItem.category || '';
    document.getElementById('editMaterial').value = editingItem.material || '';
    document.getElementById('editColor').value = editingItem.color || '';
    document.getElementById('editIsNew').checked = editingItem.isNew || false;

    // SISTEMA DE 3 NIVEIS INDEPENDENTES
    // Compatibilidade retroativa com campos antigos
    const isPublished = editingItem.published !== undefined ? editingItem.published : (editingItem.destination === 'projetos');
    const isInGrid = editingItem.showInGrid !== undefined ? editingItem.showInGrid : editingItem.showOnLanding;
    const isFeatured = editingItem.featured !== undefined ? editingItem.featured : false;

    document.getElementById('editPublished').checked = isPublished;
    document.getElementById('editShowInGrid').checked = isInGrid;
    document.getElementById('editFeatured').checked = isFeatured;

    // Atualizar status de publicacao
    onPublicationLevelChange();

    // Populate service dropdown and select current service if linked
    populateServicesDropdown(editingItem.serviceId || '');

    // Reset inherit photo section
    selectedServicePhoto = null;
    document.getElementById('inheritServicePhoto').checked = false;
    document.getElementById('inheritPhotoSection').style.display = 'none';
    document.getElementById('inheritPhotoPreview').style.display = 'none';
    document.getElementById('editPhotoArea').style.opacity = '1';
    document.getElementById('editPhotoArea').style.pointerEvents = 'auto';

    // Trigger service link change to show inherit option if applicable
    setTimeout(() => {
        onServiceLinkChange();
    }, 100);

    // Photo preview
    const photoPreview = document.getElementById('editPhotoPreview');
    const photoPlaceholder = document.getElementById('editPhotoPlaceholder');
    const photoUrl = editingItem.mainPhoto?.url || editingItem.imageUrl;

    // Reset gallery URL
    photoPreview.dataset.galleryUrl = '';

    if (photoUrl) {
        document.getElementById('editPhotoImg').src = photoUrl;
        photoPreview.style.display = 'block';
        photoPlaceholder.style.display = 'none';
    } else {
        photoPreview.style.display = 'none';
        photoPlaceholder.style.display = 'flex';
    }

    // Logo preview
    const logoPreview = document.getElementById('editLogoPreview');
    const logoPlaceholder = document.getElementById('editLogoPlaceholder');

    if (editingItem.logo?.url) {
        document.getElementById('editLogoImg').src = editingItem.logo.url;
        logoPreview.style.display = 'block';
        logoPlaceholder.style.display = 'none';
    } else {
        logoPreview.style.display = 'none';
        logoPlaceholder.style.display = 'flex';
    }

    // Reset file inputs
    newPhotoFile = null;
    newLogoFile = null;
    newExtraPhotosFiles = [];
    extraPhotosToDelete = [];
    extraPhotoSlotCounterAdmin = 0;
    document.getElementById('editPhoto').value = '';
    document.getElementById('editLogo').value = '';

    // Load extra photos
    loadExtraPhotosInEditModal();

    // Show modal e atualizar ARIA
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    }

    // Sync custom selects after a small delay
    setTimeout(() => {
        document.getElementById('editCategory').dispatchEvent(new Event('change', { bubbles: true }));
    }, 50);
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }
    editingItem = null;
    newPhotoFile = null;
    newLogoFile = null;
    newExtraPhotosFiles = [];
    extraPhotosToDelete = [];
    extraPhotoSlotCounterAdmin = 0;
}

// SISTEMA DE 3 NIVEIS INDEPENDENTES: Handler de niveis de publicacao
function onPublicationLevelChange() {
    const isPublished = document.getElementById('editPublished').checked;
    const isInGrid = document.getElementById('editShowInGrid').checked;
    const isFeatured = document.getElementById('editFeatured').checked;

    const statusEl = document.getElementById('publicationStatus');
    const descReqBadge = document.getElementById('descRequiredBadge');
    const catReqBadge = document.getElementById('catRequiredBadge');
    const matReqBadge = document.getElementById('matRequiredBadge');
    const colorReqBadge = document.getElementById('colorRequiredBadge');

    // Grid e Featured requerem que esteja publicado
    if ((isInGrid || isFeatured) && !isPublished) {
        document.getElementById('editPublished').checked = true;
    }

    // Se desmarcar publicado, desmarca os outros
    if (!isPublished) {
        document.getElementById('editShowInGrid').checked = false;
        document.getElementById('editFeatured').checked = false;
    }

    // Reler valores apos ajustes
    const finalPublished = document.getElementById('editPublished').checked;
    const finalInGrid = document.getElementById('editShowInGrid').checked;
    const finalFeatured = document.getElementById('editFeatured').checked;

    // Atualizar status visual - mostrar onde vai aparecer
    statusEl.classList.remove('qap', 'published', 'featured');

    if (!finalPublished) {
        statusEl.className = 'form-hint publication-status qap';
        statusEl.innerHTML = '<i class="fas fa-clock"></i> Status: <strong>QAP (Rascunho)</strong> - Salvo mas nao publicado';
    } else {
        // Construir lista de onde aparece
        let locations = ['/projetos/'];
        if (finalInGrid) locations.push('Grid Home');
        if (finalFeatured) locations.push('Carrossel Hero');

        const locationText = locations.join(' + ');
        const iconClass = finalFeatured ? 'fa-star' : (finalInGrid ? 'fa-th-large' : 'fa-globe');
        const statusClass = finalFeatured ? 'featured' : (finalInGrid ? 'grid' : 'published');

        statusEl.className = `form-hint publication-status ${statusClass}`;
        statusEl.innerHTML = `<i class="fas ${iconClass}"></i> Visivel em: <strong>${locationText}</strong>`;
    }

    // Descricao obrigatoria para destaque hero
    if (descReqBadge) descReqBadge.style.display = finalFeatured ? 'inline' : 'none';

    // Mostrar badges de obrigatorio quando publicado
    const showRequired = finalPublished;
    if (catReqBadge) catReqBadge.style.display = showRequired ? 'inline' : 'none';
    if (matReqBadge) matReqBadge.style.display = showRequired ? 'inline' : 'none';
    if (colorReqBadge) colorReqBadge.style.display = showRequired ? 'inline' : 'none';
}

// Manter funcao antiga para compatibilidade (pode ser removida depois)
function toggleCategory() {
    onPublicationLevelChange();
}

// Photo handling - com validacao de magic bytes
async function handlePhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar MIME type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        showToast('Formato nao permitido. Use JPG, PNG, WebP ou GIF', 'error');
        return;
    }

    // Validar tamanho
    if (file.size > 10 * 1024 * 1024) {
        showToast('Imagem muito grande (max 10MB)', 'error');
        return;
    }

    // SEGURANCA: Validar magic bytes
    const detectedType = await validateImageMagicBytes(file);
    if (!detectedType) {
        showToast('Arquivo de imagem invalido ou corrompido', 'error');
        return;
    }

    newPhotoFile = file;

    // Preview
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('editPhotoImg').src = e.target.result;
        document.getElementById('editPhotoPreview').style.display = 'block';
        document.getElementById('editPhotoPlaceholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

// Handler para selecao de multiplas fotos via clique - com validacao de magic bytes
async function handleMultiplePhotosSelect(event) {
    const allFiles = Array.from(event.target.files);
    const validFiles = [];

    // Filtrar apenas tipos permitidos
    for (const file of allFiles) {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            continue;
        }
        if (file.size > 10 * 1024 * 1024) {
            showToast(`Imagem ${sanitizeFileName(file.name)} muito grande (max 10MB)`, 'error');
            event.target.value = '';
            return;
        }
        // SEGURANCA: Validar magic bytes
        const detectedType = await validateImageMagicBytes(file);
        if (detectedType) {
            validFiles.push(file);
        }
    }

    if (validFiles.length === 0) {
        showToast('Nenhuma imagem valida selecionada', 'error');
        event.target.value = '';
        return;
    }

    // Primeira foto vai para principal
    newPhotoFile = validFiles[0];

    // Preview da foto principal
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('editPhotoImg').src = e.target.result;
        document.getElementById('editPhotoPreview').style.display = 'block';
        document.getElementById('editPhotoPlaceholder').style.display = 'none';
    };
    reader.readAsDataURL(validFiles[0]);

    // Demais fotos vao para extras (maximo 5)
    if (validFiles.length > 1) {
        let addedCount = 0;
        for (let i = 1; i < validFiles.length && i < 6; i++) {
            addExtraPhotoFromFile(validFiles[i]);
            addedCount++;
        }

        if (addedCount > 0) {
            showToast(`${validFiles.length} foto(s): 1 principal + ${addedCount} extra(s)`, 'success');
        }
    }

    // Limpar o input para permitir selecionar as mesmas fotos novamente
    event.target.value = '';
}

function removePhoto() {
    newPhotoFile = null;
    document.getElementById('editPhoto').value = '';
    document.getElementById('editPhotoPreview').style.display = 'none';
    document.getElementById('editPhotoPlaceholder').style.display = 'flex';
    document.getElementById('editPhotoImg').src = '';
    document.getElementById('editPhotoPreview').dataset.galleryUrl = '';
}

// Logo handling - SEM SVG (risco de XSS) e com validacao de magic bytes
async function handleLogoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // SEGURANCA: SVG REMOVIDO - pode conter scripts maliciosos
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
        showToast('Logo deve ser PNG ou WebP (SVG nao permitido por seguranca)', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast('Logo muito grande (max 5MB)', 'error');
        return;
    }

    // SEGURANCA: Validar magic bytes
    const detectedType = await validateImageMagicBytes(file);
    if (!detectedType) {
        showToast('Arquivo de imagem invalido ou corrompido', 'error');
        return;
    }

    newLogoFile = file;

    // Preview
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('editLogoImg').src = e.target.result;
        document.getElementById('editLogoPreview').style.display = 'block';
        document.getElementById('editLogoPlaceholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function removeLogo() {
    newLogoFile = 'remove'; // Special flag to remove
    document.getElementById('editLogo').value = '';
    document.getElementById('editLogoPreview').style.display = 'none';
    document.getElementById('editLogoPlaceholder').style.display = 'flex';
    document.getElementById('editLogoImg').src = '';
}

// ==========================================
// EXTRA PHOTOS HANDLING
// ==========================================

function loadExtraPhotosInEditModal() {
    const grid = document.getElementById('editExtraPhotosGrid');
    if (!grid) return;

    grid.innerHTML = '';

    // Carregar fotos extras existentes
    if (editingItem?.extraPhotos && Array.isArray(editingItem.extraPhotos)) {
        editingItem.extraPhotos.forEach((photo, index) => {
            if (photo?.url) {
                const item = document.createElement('div');
                item.className = 'extra-photo-item existing';
                // SEGURANCA: Guardar dados em dataset para uso posterior
                item.dataset.url = photo.url;
                item.dataset.path = photo.path || '';
                // SEGURANCA: Usar data-action ao inves de onclick inline
                item.innerHTML = `
                    <img src="${escapeHtml(photo.url)}" alt="Foto ${index + 1}">
                    <button type="button" class="btn-remove-extra" data-action="remove-existing-extra-photo" aria-label="Remover foto">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                grid.appendChild(item);
            }
        });
    }
}

function addExtraPhotoSlotAdmin() {
    const grid = document.getElementById('editExtraPhotosGrid');
    if (!grid) return;

    // Limitar a 5 fotos extras
    const existingCount = grid.querySelectorAll('.extra-photo-item.existing:not(.to-delete)').length;
    const newCount = newExtraPhotosFiles.filter(f => f !== null).length;

    if (existingCount + newCount >= 5) {
        showToast('Maximo de 5 fotos extras', 'warning');
        return;
    }

    const slotId = extraPhotoSlotCounterAdmin++;
    const slot = document.createElement('div');
    slot.className = 'extra-photo-item new-slot';
    slot.id = `adminExtraSlot_${slotId}`;
    slot.dataset.slotId = slotId;
    slot.dataset.action = 'trigger-extra-photo-input';
    // SEGURANCA: Tipos de arquivo restritos e data-action
    slot.innerHTML = `
        <input type="file" id="adminExtraInput_${slotId}" accept="image/jpeg,image/png,image/webp,image/gif"
               data-action="extra-photo-select" data-slot-id="${slotId}" style="display: none;">
        <i class="fas fa-plus"></i>
        <span>Adicionar</span>
    `;

    grid.appendChild(slot);

    // Expandir array
    while (newExtraPhotosFiles.length <= slotId) {
        newExtraPhotosFiles.push(null);
    }
}

async function handleExtraPhotoSelectAdmin(event, slotId) {
    const file = event.target.files[0];
    if (!file) return;

    // SEGURANCA: Validar tipo de arquivo
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        showToast('Formato invalido. Use JPG, PNG, WebP ou GIF', 'error');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showToast('Imagem muito grande. Maximo 10MB', 'error');
        return;
    }

    // SEGURANCA: Validar magic bytes
    const detectedType = await validateImageMagicBytes(file);
    if (!detectedType) {
        showToast('Arquivo de imagem invalido ou corrompido', 'error');
        return;
    }

    newExtraPhotosFiles[slotId] = file;

    const slot = document.getElementById(`adminExtraSlot_${slotId}`);
    if (slot) {
        slot.classList.remove('new-slot');
        slot.classList.add('has-file');

        const reader = new FileReader();
        reader.onload = (e) => {
            // SEGURANCA: Usar data-action ao inves de onclick inline
            slot.innerHTML = `
                <img src="${e.target.result}" alt="Nova foto">
                <button type="button" class="btn-remove-extra" data-action="remove-new-extra-photo" data-slot-id="${slotId}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            slot.onclick = null;
        };
        reader.readAsDataURL(file);
    }
}

function removeNewExtraPhoto(slotId) {
    newExtraPhotosFiles[slotId] = null;
    const slot = document.getElementById(`adminExtraSlot_${slotId}`);
    if (slot) {
        slot.remove();
    }
}

function removeExistingExtraPhoto(button, url, path) {
    const item = button.closest('.extra-photo-item');
    if (item) {
        item.classList.add('to-delete');
        item.style.opacity = '0.3';
        item.style.pointerEvents = 'none';
    }
    extraPhotosToDelete.push({ url, path });
}

function getNewExtraPhotosFiles() {
    return newExtraPhotosFiles.filter(f => f !== null);
}

// ==========================================
// SAVE ITEM
// ==========================================

async function saveItem() {
    const itemId = document.getElementById('editItemId').value;
    const title = document.getElementById('editTitle').value.trim();
    const description = document.getElementById('editDescription')?.value.trim() || '';
    const category = document.getElementById('editCategory').value;
    const material = document.getElementById('editMaterial')?.value.trim() || '';
    const color = document.getElementById('editColor')?.value.trim() || '';
    const isNew = document.getElementById('editIsNew').checked;

    // SISTEMA DE 3 NIVEIS INDEPENDENTES
    const isPublished = document.getElementById('editPublished').checked;
    const isInGrid = document.getElementById('editShowInGrid').checked;
    const isFeatured = document.getElementById('editFeatured').checked;

    const serviceId = document.getElementById('editServiceLink').value;
    const inheritPhoto = document.getElementById('inheritServicePhoto').checked;

    // Validation
    if (!title) {
        showToast('Titulo e obrigatorio', 'error');
        return;
    }

    // Validacoes quando publicado
    if (isPublished) {
        if (!category) {
            showToast('Selecione uma categoria para publicar', 'error');
            return;
        }
        if (!material) {
            showToast('Informe o material para publicar', 'error');
            return;
        }
        if (!color) {
            showToast('Informe a cor para publicar', 'error');
            return;
        }
    }

    // Validacao para destaque: precisa de descricao
    if (isFeatured && !description) {
        showToast('Descricao e obrigatoria para destaque no hero', 'error');
        return;
    }

    // Verificar se tem foto da galeria selecionada
    const galleryMainPhotoUrl = document.getElementById('editPhotoPreview')?.dataset?.galleryUrl;

    // Validar foto (obrigatoria para novos itens, exceto se herdando ou usando galeria)
    if (isAddMode && !newPhotoFile && !inheritPhoto && !galleryMainPhotoUrl) {
        showToast('Selecione uma foto, herde do servico ou escolha do banco de dados', 'error');
        return;
    }

    showLoading('Salvando...');

    try {
        // Encontrar servico vinculado para nome
        const linkedService = serviceId ? allServices.find(s => s.id === serviceId) : null;

        const saveData = {
            title: title,
            description: description || null,
            category: category || null,
            material: material || null,
            color: color || null,
            isNew: isNew,
            // SISTEMA DE 3 NIVEIS INDEPENDENTES
            published: isPublished,
            showInGrid: isInGrid,
            featured: isFeatured,
            // Manter campos antigos para compatibilidade (migracao gradual)
            destination: isPublished ? 'projetos' : null,
            showOnLanding: isFeatured, // apenas hero, nao grid
            // Dados do servico
            serviceId: serviceId || null,
            serviceName: linkedService ? `${linkedService.name} - ${linkedService.client}` : null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Determinar o ID do documento (novo ou existente)
        let docId = itemId;
        if (isAddMode) {
            // Criar novo documento
            const docRef = await db.collection('portfolio').doc();
            docId = docRef.id;
            saveData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            saveData.active = true;
        }

        // Handle photo - galeria, herdar do servico ou fazer upload
        const galleryUrl = document.getElementById('editPhotoPreview')?.dataset?.galleryUrl;

        if (galleryUrl && !newPhotoFile) {
            // Usar foto da galeria (URL ja existente)
            saveData.mainPhoto = { url: galleryUrl, fromGallery: true };
            saveData.imageUrl = galleryUrl;
        } else if (inheritPhoto && selectedServicePhoto) {
            // Usar foto do servico (apenas referencia a URL, nao copia o arquivo)
            saveData.mainPhoto = { url: selectedServicePhoto, inherited: true };
            saveData.imageUrl = selectedServicePhoto;
        } else if (newPhotoFile && newPhotoFile !== 'remove') {
            // Delete old photo if exists (apenas no modo edicao)
            if (!isAddMode && editingItem?.mainPhoto?.path) {
                try {
                    await storage.ref(editingItem.mainPhoto.path).delete();
                } catch (e) {
                    logger.warn('Erro ao deletar foto antiga:', e);
                }
            }

            // SEGURANCA: Upload com ID seguro
            const secureId = generateSecureId(16);
            const photoPath = `portfolio/${docId}/photo_${secureId}`;
            const photoRef = storage.ref(photoPath);
            await photoRef.put(newPhotoFile);
            const photoUrl = await photoRef.getDownloadURL();

            saveData.mainPhoto = { url: photoUrl, path: photoPath };
            saveData.imageUrl = photoUrl;
        }

        // Handle logo
        if (newLogoFile === 'remove') {
            // Delete logo (apenas no modo edicao)
            if (!isAddMode && editingItem?.logo?.path) {
                try {
                    await storage.ref(editingItem.logo.path).delete();
                } catch (e) {
                    logger.warn('Erro ao deletar logo:', e);
                }
            }
            saveData.logo = null;
        } else if (newLogoFile) {
            // Upload new logo
            if (!isAddMode && editingItem?.logo?.path) {
                try {
                    await storage.ref(editingItem.logo.path).delete();
                } catch (e) {
                    logger.warn('Erro ao deletar logo antigo:', e);
                }
            }

            // SEGURANCA: Upload com ID seguro
            const secureId = generateSecureId(16);
            const logoPath = `portfolio/${docId}/logo_${secureId}`;
            const logoRef = storage.ref(logoPath);
            await logoRef.put(newLogoFile);
            const logoUrl = await logoRef.getDownloadURL();

            saveData.logo = { url: logoUrl, path: logoPath };
        }

        // Handle extra photos (sempre, independente de publicacao)
        // Start with existing photos (filtering out deleted ones)
        let currentExtraPhotos = [];
        if (!isAddMode && editingItem?.extraPhotos && Array.isArray(editingItem.extraPhotos)) {
            const deletedUrls = extraPhotosToDelete.map(d => d.url);
            currentExtraPhotos = editingItem.extraPhotos.filter(p => !deletedUrls.includes(p.url));
        }

        // Delete marked photos from storage
        for (const photo of extraPhotosToDelete) {
            if (photo.path) {
                try {
                    await storage.ref(photo.path).delete();
                } catch (e) {
                    logger.warn('Erro ao deletar foto extra:', e);
                }
            }
        }

        // Upload new extra photos
        const newFiles = getNewExtraPhotosFiles();
        if (newFiles.length > 0) {
            showLoading(`Enviando ${newFiles.length} foto(s) extra(s)...`);
            for (let i = 0; i < newFiles.length; i++) {
                const file = newFiles[i];
                // SEGURANCA: ID seguro e extensao sanitizada
                const secureId = generateSecureId(16);
                const ext = sanitizeFileName(file.name.split('.').pop() || 'jpg');
                const path = `portfolio/${docId}/extra_${secureId}_${i}.${ext}`;
                const ref = storage.ref(path);
                await ref.put(file);
                const url = await ref.getDownloadURL();
                currentExtraPhotos.push({ url, path });
            }
        }

        // Adicionar fotos extras da galeria (URLs ja existentes)
        const galleryExtraUrls = getGalleryExtraPhotosUrls();
        galleryExtraUrls.forEach(url => {
            currentExtraPhotos.push({ url, fromGallery: true });
        });

        saveData.extraPhotos = currentExtraPhotos.length > 0 ? currentExtraPhotos : null;

        // Save to Firestore
        if (isAddMode) {
            // Criar novo documento
            await db.collection('portfolio').doc(docId).set(saveData);
            portfolioItems.unshift({ id: docId, ...saveData });
            showToast('Item criado com sucesso!', 'success');
        } else {
            // Atualizar documento existente
            await db.collection('portfolio').doc(docId).update(saveData);
            const index = portfolioItems.findIndex(i => i.id === docId);
            if (index !== -1) {
                portfolioItems[index] = { ...portfolioItems[index], ...saveData };
            }
            showToast('Item atualizado com sucesso!', 'success');
        }

        closeEditModal();
        updateStats();
        renderPortfolioItems();

    } catch (error) {
        logger.error('Erro ao salvar:', error);
        showToast('Erro ao salvar item', 'error');
    } finally {
        hideLoading();
    }
}

// ==========================================
// DELETE MODAL
// ==========================================

let deletingItemId = null;

function openDeleteModal(itemId) {
    const item = portfolioItems.find(i => i.id === itemId);
    if (!item) {
        showToast('Item nao encontrado', 'error');
        return;
    }

    deletingItemId = itemId;

    // SEGURANCA: Fill preview com escape
    const imageUrl = item.mainPhoto?.url || item.imageUrl || '../iconwpp.jpg';
    const previewImg = document.getElementById('deletePreviewImg');
    const titleEl = document.getElementById('deleteItemTitle');
    const idInput = document.getElementById('deleteItemId');

    if (previewImg) previewImg.src = imageUrl;
    // SEGURANCA: Usar textContent para titulo (seguro contra XSS)
    if (titleEl) titleEl.textContent = item.title || 'Sem titulo';
    if (idInput) idInput.value = itemId;

    // Show modal e atualizar aria-hidden
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeDeleteModal() {
    const modal = document.getElementById('deleteModal');
    if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }
    deletingItemId = null;
}

async function confirmDelete() {
    if (!deletingItemId) return;

    const item = portfolioItems.find(i => i.id === deletingItemId);
    if (!item) {
        showToast('Item nao encontrado', 'error');
        closeDeleteModal();
        return;
    }

    showLoading('Excluindo...');

    try {
        // Delete images from Storage
        const deletePromises = [];

        // Main photo
        if (item.mainPhoto?.path) {
            deletePromises.push(
                storage.ref(item.mainPhoto.path).delete().catch(e => logger.warn('Erro ao deletar foto:', e))
            );
        }

        // Logo
        if (item.logo?.path) {
            deletePromises.push(
                storage.ref(item.logo.path).delete().catch(e => logger.warn('Erro ao deletar logo:', e))
            );
        }

        // Extra photos
        if (item.extraPhotos && Array.isArray(item.extraPhotos)) {
            item.extraPhotos.forEach(photo => {
                if (photo?.path) {
                    deletePromises.push(
                        storage.ref(photo.path).delete().catch(e => logger.warn('Erro ao deletar foto extra:', e))
                    );
                }
            });
        }

        // Wait for storage deletions
        await Promise.all(deletePromises);

        // Delete document
        await db.collection('portfolio').doc(deletingItemId).delete();

        // Update local array
        portfolioItems = portfolioItems.filter(i => i.id !== deletingItemId);

        closeDeleteModal();
        updateStats();
        renderPortfolioItems();
        showToast('Item excluido com sucesso', 'success');

    } catch (error) {
        logger.error('Erro ao excluir:', error);
        showToast('Erro ao excluir item', 'error');
    } finally {
        hideLoading();
    }
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${escapeHtml(type)}`;

    let icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-times-circle';
    if (type === 'warning') icon = 'fa-exclamation-circle';
    if (type === 'info') icon = 'fa-info-circle';

    // SEGURANCA: Escape da mensagem para prevenir XSS
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ==========================================
// GALLERY MODAL - Fotos do Banco de Dados
// ==========================================

let galleryPhotos = []; // Todas as fotos carregadas
let selectedGalleryPhotos = []; // Fotos selecionadas
let galleryMode = 'main'; // 'main' ou 'extra'
let gallerySearchTerm = '';

// Abrir modal da galeria
async function openGalleryModal(mode = 'main') {
    galleryMode = mode;
    selectedGalleryPhotos = [];
    gallerySearchTerm = '';

    // Reset UI basico
    document.getElementById('gallerySearch').value = '';
    document.getElementById('btnAddSelectedPhotos').disabled = true;

    // Atualizar titulo e info do modal baseado no modo
    const modalTitle = document.querySelector('#galleryModal .modal-header h2');
    const selectionInfo = document.getElementById('gallerySelectionInfo');

    if (mode === 'main') {
        modalTitle.innerHTML = '<i class="fas fa-photo-video"></i> Galeria - Foto Principal';
        selectionInfo.innerHTML = '<span class="gallery-mode-badge main"><i class="fas fa-image"></i> Selecione 1 foto</span>';
    } else {
        modalTitle.innerHTML = '<i class="fas fa-photo-video"></i> Galeria - Fotos Extras';
        selectionInfo.innerHTML = '<span id="selectedPhotosCount">0</span> de 5 foto(s) selecionada(s) <span class="gallery-mode-badge extra"><i class="fas fa-images"></i> Multiplas</span>';
    }

    // Mostrar modal e atualizar ARIA
    const modal = document.getElementById('galleryModal');
    if (modal) {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    }

    // Carregar fotos
    await loadGalleryPhotos();
}

// Fechar modal da galeria
function closeGalleryModal() {
    const modal = document.getElementById('galleryModal');
    if (modal) {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
    }
    selectedGalleryPhotos = [];

    // Limpar observer
    if (galleryObserver) {
        galleryObserver.disconnect();
        galleryObserver = null;
    }
}

// Carregar todas as fotos dos servicos
async function loadGalleryPhotos() {
    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = `
        <div class="gallery-loading">
            <div class="loading-spinner"></div>
            <p>Carregando fotos dos servicos...</p>
        </div>
    `;

    try {
        // Buscar todos os servicos com fotos
        const snapshot = await db.collection('services')
            .orderBy('createdAt', 'desc')
            .get();

        galleryPhotos = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const serviceName = data.name || 'Servico sem nome';
            const client = data.client || '';
            const displayName = client ? `${serviceName} - ${client}` : serviceName;

            // Foto principal (mainPhoto - objeto com url)
            if (data.mainPhoto?.url) {
                galleryPhotos.push({
                    url: data.mainPhoto.url,
                    serviceName: displayName,
                    serviceId: doc.id,
                    type: 'main'
                });
            }

            // Foto legada (imageUrl - string direta, formato antigo)
            if (data.imageUrl && typeof data.imageUrl === 'string') {
                // Evitar duplicatas se ja foi adicionada como mainPhoto
                const alreadyAdded = galleryPhotos.some(p => p.url === data.imageUrl && p.serviceId === doc.id);
                if (!alreadyAdded) {
                    galleryPhotos.push({
                        url: data.imageUrl,
                        serviceName: displayName,
                        serviceId: doc.id,
                        type: 'legacy'
                    });
                }
            }

            // Imagens gerais (images)
            if (data.images && Array.isArray(data.images)) {
                data.images.forEach((img, index) => {
                    const imgUrl = typeof img === 'string' ? img : img?.url;
                    if (imgUrl) {
                        galleryPhotos.push({
                            url: imgUrl,
                            serviceName: displayName,
                            serviceId: doc.id,
                            type: 'image',
                            index: index
                        });
                    }
                });
            }

            // Foto Instagram (produto finalizado)
            if (data.instagramPhoto && typeof data.instagramPhoto === 'string') {
                // Evitar duplicatas
                const alreadyAdded = galleryPhotos.some(p => p.url === data.instagramPhoto && p.serviceId === doc.id);
                if (!alreadyAdded) {
                    galleryPhotos.push({
                        url: data.instagramPhoto,
                        serviceName: `${displayName} (Finalizado)`,
                        serviceId: doc.id,
                        type: 'instagram'
                    });
                }
            }

            // Fotos embaladas
            if (data.packagedPhotos && Array.isArray(data.packagedPhotos)) {
                data.packagedPhotos.forEach((photo, index) => {
                    const photoUrl = typeof photo === 'string' ? photo : photo?.url;
                    if (photoUrl) {
                        galleryPhotos.push({
                            url: photoUrl,
                            serviceName: `${displayName} (Embalado)`,
                            serviceId: doc.id,
                            type: 'packaged',
                            index: index
                        });
                    }
                });
            }

            // Fotos extras do portfolio (extraPhotos)
            if (data.extraPhotos && Array.isArray(data.extraPhotos)) {
                data.extraPhotos.forEach((photo, index) => {
                    if (photo?.url) {
                        galleryPhotos.push({
                            url: photo.url,
                            serviceName: displayName,
                            serviceId: doc.id,
                            type: 'extra',
                            index: index
                        });
                    }
                });
            }
        });

        logger.log(`Carregadas ${galleryPhotos.length} fotos da galeria de ${snapshot.size} servicos`);
        if (galleryPhotos.length === 0) {
            logger.log('Nenhuma foto encontrada. Estrutura do primeiro servico:', snapshot.docs[0]?.data());
        }
        renderGalleryPhotos();

    } catch (error) {
        logger.error('Erro ao carregar galeria:', error);
        grid.innerHTML = `
            <div class="gallery-empty">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erro ao carregar fotos</p>
            </div>
        `;
    }
}

// Observer para lazy loading
let galleryObserver = null;

// Renderizar fotos na galeria
function renderGalleryPhotos() {
    const grid = document.getElementById('galleryGrid');

    // Filtrar por busca
    let filtered = galleryPhotos;
    if (gallerySearchTerm) {
        filtered = galleryPhotos.filter(p =>
            p.serviceName.toLowerCase().includes(gallerySearchTerm.toLowerCase())
        );
    }

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="gallery-empty">
                <i class="fas fa-images"></i>
                <p>Nenhuma foto encontrada</p>
            </div>
        `;
        return;
    }

    // SEGURANCA: Renderizar fotos com lazy loading e escape de dados
    grid.innerHTML = filtered.map((photo, index) => `
        <div class="gallery-photo-item lazy ${selectedGalleryPhotos.includes(photo.url) ? 'selected' : ''}"
             data-url="${encodeURIComponent(photo.url)}"
             data-index="${index}">
            <img data-src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.serviceName)}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">
            <div class="photo-service-name">${escapeHtml(photo.serviceName)}</div>
        </div>
    `).join('');

    // Adicionar event listeners via delegation
    setupGalleryClickHandlers();

    // Iniciar lazy loading com Intersection Observer
    setupLazyLoading();
}

// Configurar click handlers da galeria via event delegation
function setupGalleryClickHandlers() {
    const grid = document.getElementById('galleryGrid');

    // Remover listener anterior se existir
    grid.removeEventListener('click', handleGalleryClick);

    // Adicionar novo listener
    grid.addEventListener('click', handleGalleryClick);
}

// Handler de click na galeria
function handleGalleryClick(e) {
    const item = e.target.closest('.gallery-photo-item');
    if (!item) return;

    const encodedUrl = item.dataset.url;
    if (!encodedUrl) return;

    const url = decodeURIComponent(encodedUrl);
    toggleGalleryPhotoSelection(url);
}

// Configurar Intersection Observer para lazy loading
function setupLazyLoading() {
    // Desconectar observer anterior se existir
    if (galleryObserver) {
        galleryObserver.disconnect();
    }

    // Criar novo observer
    galleryObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const item = entry.target;
                const img = item.querySelector('img');
                const src = img.dataset.src;

                if (src) {
                    // Carregar imagem
                    img.src = src;
                    img.onload = () => {
                        item.classList.remove('lazy');
                        item.classList.add('loaded');
                    };
                    img.onerror = () => {
                        item.classList.remove('lazy');
                        item.classList.add('loaded');
                        img.src = '/iconwpp.jpg'; // Fallback
                    };
                }

                // Parar de observar este item
                observer.unobserve(item);
            }
        });
    }, {
        root: document.getElementById('galleryGrid'),
        rootMargin: '100px', // Carregar 100px antes de aparecer
        threshold: 0
    });

    // Observar todos os itens da galeria
    document.querySelectorAll('.gallery-photo-item.lazy').forEach(item => {
        galleryObserver.observe(item);
    });
}

// Filtrar fotos por busca
function filterGalleryPhotos() {
    gallerySearchTerm = document.getElementById('gallerySearch').value.trim();
    renderGalleryPhotos();
}

// Toggle selecao de foto
function toggleGalleryPhotoSelection(url) {
    const index = selectedGalleryPhotos.indexOf(url);

    if (index === -1) {
        // Se for modo 'main' (foto principal), so permite 1 selecao
        if (galleryMode === 'main') {
            // Mostrar aviso se ja tinha uma foto selecionada
            if (selectedGalleryPhotos.length > 0) {
                showToast('Foto principal substituida. Para multiplas fotos, use "Fotos Extras"', 'info');
            }
            selectedGalleryPhotos = [url];
        } else {
            // Modo extra - permite multiplas (max 5)
            if (selectedGalleryPhotos.length >= 5) {
                showToast('Maximo de 5 fotos por vez', 'warning');
                return;
            }
            selectedGalleryPhotos.push(url);
        }
    } else {
        selectedGalleryPhotos.splice(index, 1);
    }

    // Atualizar UI
    updateGallerySelectionUI();
}

// Atualizar UI de selecao
function updateGallerySelectionUI() {
    // Atualizar contador baseado no modo
    const selectionInfo = document.getElementById('gallerySelectionInfo');

    if (galleryMode === 'main') {
        if (selectedGalleryPhotos.length > 0) {
            selectionInfo.innerHTML = '<span class="gallery-mode-badge main selected"><i class="fas fa-check"></i> 1 foto selecionada</span>';
        } else {
            selectionInfo.innerHTML = '<span class="gallery-mode-badge main"><i class="fas fa-image"></i> Selecione 1 foto</span>';
        }
    } else {
        selectionInfo.innerHTML = `<span id="selectedPhotosCount">${selectedGalleryPhotos.length}</span> de 5 foto(s) selecionada(s) <span class="gallery-mode-badge extra"><i class="fas fa-images"></i> Multiplas</span>`;
    }

    // Atualizar botao
    document.getElementById('btnAddSelectedPhotos').disabled = selectedGalleryPhotos.length === 0;

    // Atualizar visual dos itens
    document.querySelectorAll('.gallery-photo-item').forEach(item => {
        const encodedUrl = item.dataset.url;
        const url = encodedUrl ? decodeURIComponent(encodedUrl) : '';
        if (selectedGalleryPhotos.includes(url)) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// Adicionar fotos selecionadas
function addSelectedPhotosFromGallery() {
    if (selectedGalleryPhotos.length === 0) {
        showToast('Selecione pelo menos uma foto', 'warning');
        return;
    }

    if (galleryMode === 'main') {
        // Adicionar como foto principal
        const url = selectedGalleryPhotos[0];
        addPhotoFromGalleryAsMain(url);
    } else {
        // Adicionar como fotos extras
        selectedGalleryPhotos.forEach(url => {
            addPhotoFromGalleryAsExtra(url);
        });
    }

    closeGalleryModal();
    showToast(`${selectedGalleryPhotos.length} foto(s) adicionada(s)`, 'success');
}

// Adicionar foto da galeria como principal
function addPhotoFromGalleryAsMain(url) {
    // Marcar que estamos usando foto da galeria (URL externa)
    newPhotoFile = null; // Limpar arquivo selecionado

    // Mostrar preview
    document.getElementById('editPhotoImg').src = url;
    document.getElementById('editPhotoPreview').style.display = 'block';
    document.getElementById('editPhotoPlaceholder').style.display = 'none';

    // Guardar a URL para salvar depois
    document.getElementById('editPhotoPreview').dataset.galleryUrl = url;
}

// Adicionar foto da galeria como extra
function addPhotoFromGalleryAsExtra(url) {
    const grid = document.getElementById('editExtraPhotosGrid');
    if (!grid) return;

    // Verificar limite
    const existingCount = grid.querySelectorAll('.extra-photo-item.existing:not(.to-delete)').length;
    const fromGalleryCount = grid.querySelectorAll('.extra-photo-item.from-gallery').length;
    const newCount = newExtraPhotosFiles.filter(f => f !== null).length;

    if (existingCount + fromGalleryCount + newCount >= 5) {
        showToast('Maximo de 5 fotos extras', 'warning');
        return;
    }

    // SEGURANCA: Criar item da galeria com escape e data-action
    const item = document.createElement('div');
    item.className = 'extra-photo-item from-gallery';
    item.dataset.url = url;
    item.innerHTML = `
        <img src="${escapeHtml(url)}" alt="Foto da galeria">
        <button type="button" class="btn-remove-extra" data-action="remove-gallery-extra-photo" aria-label="Remover foto">
            <i class="fas fa-times"></i>
        </button>
    `;

    grid.appendChild(item);
}

// Remover foto extra da galeria
function removeGalleryExtraPhoto(button) {
    const item = button.closest('.extra-photo-item');
    if (item) {
        item.remove();
    }
}

// Obter URLs das fotos extras da galeria
function getGalleryExtraPhotosUrls() {
    const grid = document.getElementById('editExtraPhotosGrid');
    if (!grid) return [];

    const urls = [];
    grid.querySelectorAll('.extra-photo-item.from-gallery').forEach(item => {
        const url = item.dataset.url;
        if (url) urls.push(url);
    });
    return urls;
}

// ==========================================
// EXPOSE GLOBAL FUNCTIONS
// ==========================================

window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.openAddModal = openAddModal;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.toggleCategory = toggleCategory;
window.onPublicationLevelChange = onPublicationLevelChange;
window.handlePhotoSelect = handlePhotoSelect;
window.handleMultiplePhotosSelect = handleMultiplePhotosSelect;
window.removePhoto = removePhoto;
window.handleLogoSelect = handleLogoSelect;
window.removeLogo = removeLogo;
window.saveItem = saveItem;
window.openDeleteModal = openDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.confirmDelete = confirmDelete;
// Service link
window.onServiceLinkChange = onServiceLinkChange;
window.toggleInheritPhoto = toggleInheritPhoto;
// Extra photos
window.addExtraPhotoSlotAdmin = addExtraPhotoSlotAdmin;
window.addExtraPhotoFromFile = addExtraPhotoFromFile;
window.handleExtraPhotoSelectAdmin = handleExtraPhotoSelectAdmin;
window.removeNewExtraPhoto = removeNewExtraPhoto;
window.removeExistingExtraPhoto = removeExistingExtraPhoto;
// Gallery
window.openGalleryModal = openGalleryModal;
window.closeGalleryModal = closeGalleryModal;
window.filterGalleryPhotos = filterGalleryPhotos;
window.toggleGalleryPhotoSelection = toggleGalleryPhotoSelection;
window.addSelectedPhotosFromGallery = addSelectedPhotosFromGallery;
window.removeGalleryExtraPhoto = removeGalleryExtraPhoto;
