// ==========================================
// ADMIN PORTFOLIO - SCRIPT
// ==========================================

// Firebase instance
let db, auth, storage;
let currentUser = null;
let portfolioItems = [];
let currentFilter = 'todos';
let currentSearch = '';

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
            // Not authorized
            auth.signOut();
            showToast('Acesso negado. Email nao autorizado.', 'error');
            showLoginScreen();
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
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
}

function showDashboard() {
    hideLoading();
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    // Update user info
    document.getElementById('userPhoto').src = currentUser.photoURL || '../iconwpp.jpg';
    document.getElementById('userName').textContent = currentUser.displayName || currentUser.email;

    // Setup event listeners
    setupEventListeners();
}

function setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
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
    const imageUrl = item.mainPhoto?.url || item.imageUrl || '../iconwpp.jpg';
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

    return `
        <div class="portfolio-card" data-id="${item.id}">
            <div class="card-image">
                <img src="${imageUrl}" alt="${item.title || 'Portfolio item'}" onerror="this.src='../iconwpp.jpg'">
                <span class="card-badge ${badgeClass}${isOrphan ? ' orphan' : ''}">${badgeText}</span>
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
// EDIT MODAL
// ==========================================

let editingItem = null;
let newPhotoFile = null;
let newLogoFile = null;

function openEditModal(itemId) {
    editingItem = portfolioItems.find(i => i.id === itemId);
    if (!editingItem) {
        showToast('Item nao encontrado', 'error');
        return;
    }

    // Fill form
    document.getElementById('editItemId').value = itemId;
    document.getElementById('editTitle').value = editingItem.title || '';
    document.getElementById('editDestination').value = editingItem.destination || '';
    document.getElementById('editCategory').value = editingItem.category || '';

    // Show/hide category based on destination
    toggleCategory();

    // Show service link info if linked
    const linkInfo = document.getElementById('serviceLinkInfo');
    if (editingItem.serviceId) {
        linkInfo.style.display = 'block';
        document.getElementById('linkedServiceName').textContent = editingItem.serviceName || editingItem.serviceId;
    } else {
        linkInfo.style.display = 'none';
    }

    // Photo preview
    const photoPreview = document.getElementById('editPhotoPreview');
    const photoPlaceholder = document.getElementById('editPhotoPlaceholder');
    const photoUrl = editingItem.mainPhoto?.url || editingItem.imageUrl;

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
    document.getElementById('editPhoto').value = '';
    document.getElementById('editLogo').value = '';

    // Show modal
    document.getElementById('editModal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    editingItem = null;
    newPhotoFile = null;
    newLogoFile = null;
}

function toggleCategory() {
    const destination = document.getElementById('editDestination').value;
    const categoryGroup = document.getElementById('editCategoryGroup');

    if (destination === 'projetos') {
        categoryGroup.style.display = 'block';
    } else {
        categoryGroup.style.display = 'none';
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
// SAVE ITEM
// ==========================================

async function saveItem() {
    const itemId = document.getElementById('editItemId').value;
    const title = document.getElementById('editTitle').value.trim();
    const destination = document.getElementById('editDestination').value;
    const category = document.getElementById('editCategory').value;

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

    showLoading('Salvando...');

    try {
        const updateData = {
            title: title,
            destination: destination,
            category: destination === 'projetos' ? category : null,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // Upload new photo if changed
        if (newPhotoFile && newPhotoFile !== 'remove') {
            // Delete old photo if exists
            if (editingItem.mainPhoto?.path) {
                try {
                    await storage.ref(editingItem.mainPhoto.path).delete();
                } catch (e) {
                    console.warn('Erro ao deletar foto antiga:', e);
                }
            }

            // Upload new
            const photoPath = `portfolio/${itemId}/photo_${Date.now()}`;
            const photoRef = storage.ref(photoPath);
            await photoRef.put(newPhotoFile);
            const photoUrl = await photoRef.getDownloadURL();

            updateData.mainPhoto = { url: photoUrl, path: photoPath };
            updateData.imageUrl = photoUrl; // Backward compatibility
        }

        // Handle logo
        if (newLogoFile === 'remove') {
            // Delete logo
            if (editingItem.logo?.path) {
                try {
                    await storage.ref(editingItem.logo.path).delete();
                } catch (e) {
                    console.warn('Erro ao deletar logo:', e);
                }
            }
            updateData.logo = null;
        } else if (newLogoFile) {
            // Upload new logo
            if (editingItem.logo?.path) {
                try {
                    await storage.ref(editingItem.logo.path).delete();
                } catch (e) {
                    console.warn('Erro ao deletar logo antigo:', e);
                }
            }

            const logoPath = `portfolio/${itemId}/logo_${Date.now()}`;
            const logoRef = storage.ref(logoPath);
            await logoRef.put(newLogoFile);
            const logoUrl = await logoRef.getDownloadURL();

            updateData.logo = { url: logoUrl, path: logoPath };
        }

        // Save to Firestore
        await db.collection('portfolio').doc(itemId).update(updateData);

        // Update local array
        const index = portfolioItems.findIndex(i => i.id === itemId);
        if (index !== -1) {
            portfolioItems[index] = { ...portfolioItems[index], ...updateData };
        }

        closeEditModal();
        updateStats();
        renderPortfolioItems();
        showToast('Item atualizado com sucesso', 'success');

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
// EXPOSE GLOBAL FUNCTIONS
// ==========================================

window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
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
