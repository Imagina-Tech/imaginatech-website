// ==========================================
// ADMIN PORTFOLIO - SCRIPT
// ==========================================

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
        console.error('Erro ao inicializar Firebase:', error);
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
        .catch(error => {
            console.error('Erro no login:', error);
            showToast('Erro ao fazer login: ' + error.message, 'error');
            hideLoading();
        });
}

function signOut() {
    auth.signOut()
        .then(() => {
            showToast('Logout realizado com sucesso', 'success');
        })
        .catch(error => {
            console.error('Erro no logout:', error);
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
    document.getElementById('deniedUserEmail').textContent = email;
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

        console.log(`Carregados ${allServices.length} servicos para dropdown`);
    } catch (error) {
        console.error('Erro ao carregar servicos:', error);
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

    // Handle dropped files
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length > 0) {
            const file = files[0];
            // Verificar se e uma imagem
            if (file.type.startsWith('image/')) {
                // Criar evento fake para o handler
                const fakeEvent = {
                    target: {
                        files: [file]
                    }
                };
                handler(fakeEvent);
            } else {
                showToast('Por favor, selecione apenas arquivos de imagem', 'error');
            }
        }
    }, false);

    // Handle click to open file dialog
    dropZone.addEventListener('click', (e) => {
        // Nao abrir se clicou no botao de remover
        if (e.target.closest('.btn-remove-img')) return;
        document.getElementById(inputId).click();
    });
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
        console.error('Erro ao carregar portfolio:', error);
        showToast('Erro ao carregar items', 'error');
        hideLoading();
    }
}

// ==========================================
// UPDATE STATS
// ==========================================

function updateStats() {
    const total = portfolioItems.length;
    const carrossel = portfolioItems.filter(i => i.destination === 'carrossel').length;
    const projetos = portfolioItems.filter(i => i.destination === 'projetos').length;
    const orphan = portfolioItems.filter(i => !i.serviceId).length;

    document.getElementById('totalItems').textContent = total;
    document.getElementById('carrosselItems').textContent = carrossel;
    document.getElementById('projetosItems').textContent = projetos;
    document.getElementById('orphanItems').textContent = orphan;
}

// ==========================================
// RENDER PORTFOLIO ITEMS
// ==========================================

function renderPortfolioItems() {
    const grid = document.getElementById('portfolioGrid');
    const emptyState = document.getElementById('emptyState');

    // Filter items
    let filtered = portfolioItems;

    if (currentFilter === 'carrossel') {
        filtered = filtered.filter(i => i.destination === 'carrossel');
    } else if (currentFilter === 'projetos') {
        filtered = filtered.filter(i => i.destination === 'projetos');
    } else if (currentFilter === 'orphan') {
        filtered = filtered.filter(i => !i.serviceId);
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
    const imageUrl = item.mainPhoto?.url || item.imageUrl || '/iconwpp.jpg';
    const badgeClass = item.destination || 'orphan';
    const badgeText = item.destination === 'carrossel' ? 'Carrossel' :
                      item.destination === 'projetos' ? 'Projetos' : 'Sem Destino';

    const isOrphan = !item.serviceId;
    const createdDate = item.createdAt ? formatDate(item.createdAt) : '-';

    let logoHtml = '';
    if (item.logo?.url) {
        logoHtml = `<div class="card-logo"><img src="${item.logo.url}" alt="Logo"></div>`;
    }

    let categoryHtml = '';
    if (item.category) {
        categoryHtml = `<span class="card-category">${item.category}</span>`;
    }

    // Badge NOVO
    let newBadgeHtml = '';
    if (item.isNew) {
        newBadgeHtml = `<span class="card-badge-new"><i class="fas fa-star"></i> NOVO</span>`;
    }

    // Indicador de galeria
    let galleryBadgeHtml = '';
    const extraPhotosCount = item.extraPhotos?.length || 0;
    if (extraPhotosCount > 0) {
        galleryBadgeHtml = `<span class="gallery-badge"><i class="fas fa-images"></i> ${1 + extraPhotosCount}</span>`;
    }

    // Badge de landing page
    let landingBadgeHtml = '';
    if (item.destination === 'projetos' && item.showOnLanding) {
        landingBadgeHtml = `<span class="landing-badge"><i class="fas fa-home"></i></span>`;
    }

    return `
        <div class="portfolio-card" data-id="${item.id}">
            <div class="card-image">
                <img src="${imageUrl}" alt="${item.title || 'Portfolio item'}" onerror="this.src='/iconwpp.jpg'">
                <span class="card-badge ${badgeClass}${isOrphan ? ' orphan' : ''}">${badgeText}</span>
                ${newBadgeHtml}
                ${galleryBadgeHtml}
                ${landingBadgeHtml}
                ${logoHtml}
            </div>
            <div class="card-body">
                <h3 class="card-title">${item.title || 'Sem titulo'}</h3>
                <div class="card-meta">
                    <span><i class="fas fa-calendar"></i> ${createdDate}</span>
                    ${item.serviceId ? `<span><i class="fas fa-link"></i> Vinculado</span>` : `<span><i class="fas fa-unlink"></i> Sem vinculo</span>`}
                </div>
                ${categoryHtml}
                <div class="card-actions">
                    <button class="btn-action edit" onclick="openEditModal('${item.id}')">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="btn-action delete" onclick="openDeleteModal('${item.id}')">
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
    document.getElementById('editDestination').value = '';
    document.getElementById('editCategory').value = '';
    document.getElementById('editMaterial').value = '';
    document.getElementById('editColor').value = '';
    document.getElementById('editIsNew').checked = true; // Novo por padrao
    document.getElementById('editShowOnLanding').checked = false;

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

    // Hide category and extra options until destination is selected
    toggleCategory();

    // Populate and reset service dropdown
    populateServicesDropdown('');
    document.getElementById('inheritServicePhoto').checked = false;
    document.getElementById('inheritPhotoSection').style.display = 'none';
    document.getElementById('inheritPhotoPreview').style.display = 'none';

    // Show modal
    document.getElementById('editModal').classList.add('active');

    // Sync custom selects
    setTimeout(() => {
        document.getElementById('editDestination').dispatchEvent(new Event('change', { bubbles: true }));
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
    document.getElementById('editDestination').value = editingItem.destination || '';
    document.getElementById('editCategory').value = editingItem.category || '';
    document.getElementById('editMaterial').value = editingItem.material || '';
    document.getElementById('editColor').value = editingItem.color || '';
    document.getElementById('editIsNew').checked = editingItem.isNew || false;
    document.getElementById('editShowOnLanding').checked = editingItem.showOnLanding || false;

    // Show/hide category based on destination
    toggleCategory();

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

    // Show modal
    document.getElementById('editModal').classList.add('active');

    // Sync custom selects after a small delay
    setTimeout(() => {
        document.getElementById('editDestination').dispatchEvent(new Event('change', { bubbles: true }));
        document.getElementById('editCategory').dispatchEvent(new Event('change', { bubbles: true }));
    }, 50);
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    editingItem = null;
    newPhotoFile = null;
    newLogoFile = null;
    newExtraPhotosFiles = [];
    extraPhotosToDelete = [];
    extraPhotoSlotCounterAdmin = 0;
}

function toggleCategory() {
    const destination = document.getElementById('editDestination').value;
    const categoryGroup = document.getElementById('editCategoryGroup');
    const extraPhotosGroup = document.getElementById('editExtraPhotosGroup');
    const showOnLandingGroup = document.getElementById('editShowOnLandingGroup');
    const descriptionGroup = document.getElementById('editDescriptionGroup');
    const materialGroup = document.getElementById('editMaterialGroup');
    const colorGroup = document.getElementById('editColorGroup');

    if (destination === 'projetos') {
        categoryGroup.style.display = 'block';
        if (extraPhotosGroup) extraPhotosGroup.style.display = 'block';
        if (showOnLandingGroup) showOnLandingGroup.style.display = 'block';
        if (descriptionGroup) descriptionGroup.style.display = 'block';
        if (materialGroup) materialGroup.style.display = 'block';
        if (colorGroup) colorGroup.style.display = 'block';
    } else {
        categoryGroup.style.display = 'none';
        if (extraPhotosGroup) extraPhotosGroup.style.display = 'none';
        if (showOnLandingGroup) showOnLandingGroup.style.display = 'none';
        if (descriptionGroup) descriptionGroup.style.display = 'none';
        if (materialGroup) materialGroup.style.display = 'none';
        if (colorGroup) colorGroup.style.display = 'none';
    }
}

// Photo handling
function handlePhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith('image/')) {
        showToast('Selecione uma imagem valida', 'error');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showToast('Imagem muito grande (max 10MB)', 'error');
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

function removePhoto() {
    newPhotoFile = null;
    document.getElementById('editPhoto').value = '';
    document.getElementById('editPhotoPreview').style.display = 'none';
    document.getElementById('editPhotoPlaceholder').style.display = 'flex';
    document.getElementById('editPhotoImg').src = '';
    document.getElementById('editPhotoPreview').dataset.galleryUrl = '';
}

// Logo handling
function handleLogoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate - only PNG, SVG, WebP
    const validTypes = ['image/png', 'image/svg+xml', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showToast('Logo deve ser PNG, SVG ou WebP', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast('Logo muito grande (max 5MB)', 'error');
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
                item.dataset.url = photo.url;
                item.dataset.path = photo.path || '';
                item.innerHTML = `
                    <img src="${photo.url}" alt="Foto ${index + 1}">
                    <button type="button" class="btn-remove-extra" onclick="event.stopPropagation(); removeExistingExtraPhoto(this, '${photo.url}', '${photo.path || ''}')">
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
    slot.onclick = () => document.getElementById(`adminExtraInput_${slotId}`).click();
    slot.innerHTML = `
        <input type="file" id="adminExtraInput_${slotId}" accept="image/jpeg,image/jpg,image/png,image/webp"
               onchange="handleExtraPhotoSelectAdmin(event, ${slotId})" style="display: none;">
        <i class="fas fa-plus"></i>
        <span>Adicionar</span>
    `;

    grid.appendChild(slot);

    // Expandir array
    while (newExtraPhotosFiles.length <= slotId) {
        newExtraPhotosFiles.push(null);
    }
}

function handleExtraPhotoSelectAdmin(event, slotId) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.match(/image\/(jpeg|jpg|png|webp)/)) {
        showToast('Formato invalido. Use JPG, PNG ou WebP', 'error');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showToast('Imagem muito grande. Maximo 10MB', 'error');
        return;
    }

    newExtraPhotosFiles[slotId] = file;

    const slot = document.getElementById(`adminExtraSlot_${slotId}`);
    if (slot) {
        slot.classList.remove('new-slot');
        slot.classList.add('has-file');

        const reader = new FileReader();
        reader.onload = (e) => {
            slot.innerHTML = `
                <img src="${e.target.result}" alt="Nova foto">
                <button type="button" class="btn-remove-extra" onclick="event.stopPropagation(); removeNewExtraPhoto(${slotId})">
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
    const destination = document.getElementById('editDestination').value;
    const category = document.getElementById('editCategory').value;
    const material = document.getElementById('editMaterial')?.value.trim() || '';
    const color = document.getElementById('editColor')?.value.trim() || '';
    const isNew = document.getElementById('editIsNew').checked;
    const showOnLanding = document.getElementById('editShowOnLanding').checked;
    const serviceId = document.getElementById('editServiceLink').value;
    const inheritPhoto = document.getElementById('inheritServicePhoto').checked;

    // Validation
    if (!title) {
        showToast('Titulo e obrigatorio', 'error');
        return;
    }

    if (!destination) {
        showToast('Selecione um destino', 'error');
        return;
    }

    if (destination === 'projetos' && !category) {
        showToast('Selecione uma categoria', 'error');
        return;
    }

    if (destination === 'projetos' && !material) {
        showToast('Informe o material utilizado', 'error');
        return;
    }

    if (destination === 'projetos' && !color) {
        showToast('Informe a cor do projeto', 'error');
        return;
    }

    // Validar foto (obrigatoria para novos itens, exceto se herdando)
    if (isAddMode && !newPhotoFile && !inheritPhoto) {
        showToast('Selecione uma foto ou herde do servico', 'error');
        return;
    }

    showLoading('Salvando...');

    try {
        // Encontrar servico vinculado para nome
        const linkedService = serviceId ? allServices.find(s => s.id === serviceId) : null;

        const saveData = {
            title: title,
            description: destination === 'projetos' ? description : null,
            destination: destination,
            category: destination === 'projetos' ? category : null,
            material: destination === 'projetos' ? material : null,
            color: destination === 'projetos' ? color : null,
            isNew: isNew,
            showOnLanding: destination === 'projetos' ? showOnLanding : false,
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
                    console.warn('Erro ao deletar foto antiga:', e);
                }
            }

            // Upload new
            const photoPath = `portfolio/${docId}/photo_${Date.now()}`;
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
                    console.warn('Erro ao deletar logo:', e);
                }
            }
            saveData.logo = null;
        } else if (newLogoFile) {
            // Upload new logo
            if (!isAddMode && editingItem?.logo?.path) {
                try {
                    await storage.ref(editingItem.logo.path).delete();
                } catch (e) {
                    console.warn('Erro ao deletar logo antigo:', e);
                }
            }

            const logoPath = `portfolio/${docId}/logo_${Date.now()}`;
            const logoRef = storage.ref(logoPath);
            await logoRef.put(newLogoFile);
            const logoUrl = await logoRef.getDownloadURL();

            saveData.logo = { url: logoUrl, path: logoPath };
        }

        // Handle extra photos (only for projetos)
        if (destination === 'projetos') {
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
                        console.warn('Erro ao deletar foto extra:', e);
                    }
                }
            }

            // Upload new extra photos
            const newFiles = getNewExtraPhotosFiles();
            if (newFiles.length > 0) {
                showLoading(`Enviando ${newFiles.length} foto(s) extra(s)...`);
                for (let i = 0; i < newFiles.length; i++) {
                    const file = newFiles[i];
                    const timestamp = Date.now();
                    const ext = file.name.split('.').pop();
                    const path = `portfolio/${docId}/extra_${timestamp}_${i}.${ext}`;
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
        }

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
        console.error('Erro ao salvar:', error);
        showToast('Erro ao salvar: ' + error.message, 'error');
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

    // Fill preview
    const imageUrl = item.mainPhoto?.url || item.imageUrl || '../iconwpp.jpg';
    document.getElementById('deletePreviewImg').src = imageUrl;
    document.getElementById('deleteItemTitle').textContent = item.title || 'Sem titulo';
    document.getElementById('deleteItemId').value = itemId;

    // Show modal
    document.getElementById('deleteModal').classList.add('active');
}

function closeDeleteModal() {
    document.getElementById('deleteModal').classList.remove('active');
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
                storage.ref(item.mainPhoto.path).delete().catch(e => console.warn('Erro ao deletar foto:', e))
            );
        }

        // Logo
        if (item.logo?.path) {
            deletePromises.push(
                storage.ref(item.logo.path).delete().catch(e => console.warn('Erro ao deletar logo:', e))
            );
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
        console.error('Erro ao excluir:', error);
        showToast('Erro ao excluir: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-times-circle';
    if (type === 'warning') icon = 'fa-exclamation-circle';

    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
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

    // Reset UI
    document.getElementById('gallerySearch').value = '';
    document.getElementById('selectedPhotosCount').textContent = '0';
    document.getElementById('btnAddSelectedPhotos').disabled = true;

    // Mostrar modal
    document.getElementById('galleryModal').classList.add('active');

    // Carregar fotos
    await loadGalleryPhotos();
}

// Fechar modal da galeria
function closeGalleryModal() {
    document.getElementById('galleryModal').classList.remove('active');
    selectedGalleryPhotos = [];
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

            // Foto principal (mainPhoto)
            if (data.mainPhoto?.url) {
                galleryPhotos.push({
                    url: data.mainPhoto.url,
                    serviceName: displayName,
                    serviceId: doc.id,
                    type: 'main'
                });
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
            if (data.instagramPhoto) {
                galleryPhotos.push({
                    url: data.instagramPhoto,
                    serviceName: `${displayName} (Finalizado)`,
                    serviceId: doc.id,
                    type: 'instagram'
                });
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

        console.log(`Carregadas ${galleryPhotos.length} fotos da galeria`);
        renderGalleryPhotos();

    } catch (error) {
        console.error('Erro ao carregar galeria:', error);
        grid.innerHTML = `
            <div class="gallery-empty">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Erro ao carregar fotos</p>
            </div>
        `;
    }
}

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

    // Renderizar fotos
    grid.innerHTML = filtered.map((photo, index) => `
        <div class="gallery-photo-item ${selectedGalleryPhotos.includes(photo.url) ? 'selected' : ''}"
             data-url="${photo.url}"
             data-index="${index}"
             onclick="toggleGalleryPhotoSelection('${photo.url}')">
            <img src="${photo.url}" alt="${photo.serviceName}" loading="lazy">
            <div class="photo-service-name">${photo.serviceName}</div>
        </div>
    `).join('');
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
    // Atualizar contador
    document.getElementById('selectedPhotosCount').textContent = selectedGalleryPhotos.length;

    // Atualizar botao
    document.getElementById('btnAddSelectedPhotos').disabled = selectedGalleryPhotos.length === 0;

    // Atualizar visual dos itens
    document.querySelectorAll('.gallery-photo-item').forEach(item => {
        const url = item.dataset.url;
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

    // Criar item da galeria
    const item = document.createElement('div');
    item.className = 'extra-photo-item from-gallery';
    item.dataset.url = url;
    item.innerHTML = `
        <img src="${url}" alt="Foto da galeria">
        <button type="button" class="btn-remove-extra" onclick="event.stopPropagation(); removeGalleryExtraPhoto(this)">
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
window.handlePhotoSelect = handlePhotoSelect;
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
