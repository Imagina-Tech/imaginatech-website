/*
=================================================
ARQUIVO: estoque/script.js
MÓDULO: Gestão de Estoque (Filamentos)
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 1.0
IMPORTANTE: NÃO REMOVER ESTE CABEÇALHO DE IDENTIFICAÇÃO
=================================================
*/

// ===========================
// FIREBASE CONFIGURATION
// ===========================
const firebaseConfig = {
    apiKey: "AIzaSyDZxuazTrmimr0951TmTCKckI4Ede2hdn4",
    authDomain: "imaginatech-servicos.firebaseapp.com",
    projectId: "imaginatech-servicos",
    storageBucket: "imaginatech-servicos.firebasestorage.app",
    messagingSenderId: "321455309872",
    appId: "1:321455309872:web:e7ba49a0f020bbae1159f5"
};

// ===========================
// AUTHORIZED USERS
// ===========================
const AUTHORIZED_EMAILS = [
    '3d3printers@gmail.com',
    'netrindademarcus@gmail.com',
    'allanedg01@gmail.com',
    'quequell1010@gmail.com',
    'igor.butter@gmail.com'
];

// ===========================
// GLOBAL STATE
// ===========================
let db, auth, storage;
let filaments = [];
let currentFilter = 'todos';
let currentStockFilter = null;
let selectedImage = null;
let editingFilamentId = null;

// ===========================
// INITIALIZATION
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
    setupAuthListener();
});

function initializeFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        storage = firebase.storage();
        console.log('Firebase initialized successfully');
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        showToast('Erro ao conectar com o servidor', 'error');
    }
}

// ===========================
// AUTHENTICATION
// ===========================
function setupAuthListener() {
    auth.onAuthStateChanged(user => {
        hideLoading();
        if (user && AUTHORIZED_EMAILS.includes(user.email)) {
            showDashboard(user);
            loadFilaments();
        } else {
            if (user) {
                showToast('Acesso não autorizado', 'error');
                auth.signOut();
            }
            showLoginScreen();
        }
    });
}

function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(error => {
        console.error('Login error:', error);
        showToast('Erro ao fazer login', 'error');
    });
}

function signOut() {
    auth.signOut().then(() => {
        showToast('Logout realizado com sucesso', 'success');
        showLoginScreen();
    });
}

function showDashboard(user) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('userName').textContent = user.displayName || user.email;
    document.getElementById('userPhoto').src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=00D4FF&color=fff`;
    updateConnectionStatus(true);
}

function showLoginScreen() {
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
}

// ===========================
// LOAD FILAMENTS
// ===========================
function loadFilaments() {
    showLoading('Carregando filamentos...');

    db.collection('filaments')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            filaments = [];
            snapshot.forEach(doc => {
                filaments.push({ id: doc.id, ...doc.data() });
            });
            renderFilaments();
            updateStats();
            hideLoading();
        }, error => {
            console.error('Error loading filaments:', error);
            showToast('Erro ao carregar filamentos', 'error');
            hideLoading();
        });
}

// ===========================
// RENDER FILAMENTS
// ===========================
function renderFilaments() {
    const grid = document.getElementById('filamentsGrid');
    const emptyState = document.getElementById('emptyState');

    // Apply filters
    let filtered = filaments.filter(f => {
        if (currentFilter !== 'todos' && f.type !== currentFilter) return false;
        if (currentStockFilter === 'low' && f.weight >= 0.6) return false;
        if (currentStockFilter === 'ok' && f.weight < 0.8) return false;
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';
    grid.innerHTML = filtered.map(filament => createFilamentCard(filament)).join('');
}

function createFilamentCard(filament) {
    const weightInGrams = filament.weight * 1000;
    const stockClass = weightInGrams < 600 ? 'low' : (weightInGrams > 800 ? 'ok' : '');
    const outOfStock = weightInGrams <= 0 ? 'out-of-stock' : '';

    return `
        <div class="filament-card ${outOfStock}" data-id="${filament.id}">
            ${stockClass ? `<div class="stock-indicator ${stockClass}"></div>` : ''}
            <img src="${filament.imageUrl || '/iconwpp.jpg'}" alt="${filament.name}" class="filament-image">
            <div class="filament-info">
                <div class="filament-type">${filament.type}</div>
                <div class="filament-name">${filament.name}</div>
                <div class="filament-color">${filament.color}</div>
                <div class="filament-weight ${weightInGrams < 600 ? 'low' : ''}">${weightInGrams.toFixed(0)}g</div>
            </div>
            <div class="filament-actions">
                <button class="action-btn-small" onclick="editFilament('${filament.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn-small delete" onclick="deleteFilament('${filament.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

// ===========================
// STATISTICS
// ===========================
function updateStats() {
    const total = filaments.length;
    const stockOk = filaments.filter(f => f.weight > 0.8).length;
    const stockLow = filaments.filter(f => f.weight < 0.6 && f.weight > 0).length;
    const totalWeight = filaments.reduce((sum, f) => sum + (f.weight || 0), 0);

    document.getElementById('totalFilaments').textContent = total;
    document.getElementById('stockOk').textContent = stockOk;
    document.getElementById('stockLow').textContent = stockLow;
    document.getElementById('totalWeight').textContent = totalWeight.toFixed(2) + ' kg';
}

// ===========================
// FILTERS
// ===========================
function filterByType(type) {
    currentFilter = type;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderFilaments();
}

function filterByStock(stockLevel) {
    if (currentStockFilter === stockLevel) {
        currentStockFilter = null;
        event.target.classList.remove('active');
    } else {
        currentStockFilter = stockLevel;
        document.querySelectorAll('.filter-group:last-child .filter-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
    }
    renderFilaments();
}

// ===========================
// ADD/EDIT FILAMENT
// ===========================
function openAddFilamentModal() {
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus"></i> Adicionar Filamento';
    document.getElementById('filamentForm').reset();
    document.getElementById('filamentId').value = '';
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('uploadPlaceholder').style.display = 'flex';
    selectedImage = null;
    editingFilamentId = null;
    document.getElementById('filamentModal').classList.add('active');
}

function editFilament(id) {
    const filament = filaments.find(f => f.id === id);
    if (!filament) return;

    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Filamento';
    document.getElementById('filamentId').value = filament.id;
    document.getElementById('filamentName').value = filament.name;
    document.getElementById('filamentType').value = filament.type;
    document.getElementById('filamentColor').value = filament.color;
    document.getElementById('filamentWeight').value = filament.weight;
    document.getElementById('filamentNotes').value = filament.notes || '';

    if (filament.imageUrl) {
        document.getElementById('imagePreview').src = filament.imageUrl;
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('uploadPlaceholder').style.display = 'none';
    }

    editingFilamentId = id;
    document.getElementById('filamentModal').classList.add('active');
}

function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    selectedImage = file;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('imagePreview').src = e.target.result;
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('uploadPlaceholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

async function saveFilament(event) {
    event.preventDefault();

    const name = document.getElementById('filamentName').value.trim();
    const type = document.getElementById('filamentType').value;
    const color = document.getElementById('filamentColor').value.trim();
    const weight = parseFloat(document.getElementById('filamentWeight').value);
    const notes = document.getElementById('filamentNotes').value.trim();
    const id = document.getElementById('filamentId').value;

    if (!name || !type || !color || weight < 0) {
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }

    showLoading('Salvando filamento...');

    try {
        let imageUrl = null;

        // Upload image if selected
        if (selectedImage) {
            const storageRef = storage.ref(`filaments/${Date.now()}_${selectedImage.name}`);
            const snapshot = await storageRef.put(selectedImage);
            imageUrl = await snapshot.ref.getDownloadURL();
        } else if (editingFilamentId) {
            // Keep existing image
            const existing = filaments.find(f => f.id === editingFilamentId);
            imageUrl = existing?.imageUrl || null;
        }

        const filamentData = {
            name,
            type,
            color,
            weight,
            notes,
            imageUrl,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (id) {
            // Update
            await db.collection('filaments').doc(id).update(filamentData);
            showToast('Filamento atualizado com sucesso!', 'success');
        } else {
            // Create
            filamentData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('filaments').add(filamentData);
            showToast('Filamento adicionado com sucesso!', 'success');
        }

        closeFilamentModal();
    } catch (error) {
        console.error('Error saving filament:', error);
        showToast('Erro ao salvar filamento', 'error');
    } finally {
        hideLoading();
    }
}

function closeFilamentModal() {
    document.getElementById('filamentModal').classList.remove('active');
    selectedImage = null;
    editingFilamentId = null;
}

// ===========================
// DELETE FILAMENT
// ===========================
async function deleteFilament(id) {
    if (!confirm('Tem certeza que deseja excluir este filamento?')) return;

    showLoading('Excluindo...');
    try {
        await db.collection('filaments').doc(id).delete();
        showToast('Filamento excluído com sucesso!', 'success');
    } catch (error) {
        console.error('Error deleting filament:', error);
        showToast('Erro ao excluir filamento', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// GENERATE PRINT
// ===========================
function openPrintModal() {
    document.getElementById('printModal').classList.add('active');
}

function closePrintModal() {
    document.getElementById('printModal').classList.remove('active');
}

function generateColorPrint() {
    const requiredWeight = parseFloat(document.getElementById('requiredWeight').value);
    const filterType = document.getElementById('printFilterType').value;

    if (!requiredWeight || requiredWeight <= 0) {
        showToast('Digite uma quantidade válida', 'error');
        return;
    }

    const requiredInKg = requiredWeight / 1000;

    // Filter available colors
    let available = filaments.filter(f => {
        if (f.weight < requiredInKg) return false;
        if (filterType && f.type !== filterType) return false;
        return true;
    });

    if (available.length === 0) {
        showToast('Nenhuma cor disponível com essa quantidade', 'warning');
        return;
    }

    // Show print preview
    document.getElementById('printRequiredAmount').textContent = requiredWeight + 'g';
    document.getElementById('printAvailableCount').textContent = available.length;

    const printPreview = document.getElementById('printPreview');
    printPreview.innerHTML = available.map(f => `
        <div class="print-item">
            <img src="${f.imageUrl || '/iconwpp.jpg'}" alt="${f.name}" class="print-item-image">
            <div class="print-item-name">${f.type} - ${f.name}</div>
            <div class="print-item-color">${f.color}</div>
            <div class="print-item-weight">${(f.weight * 1000).toFixed(0)}g disponível</div>
        </div>
    `).join('');

    closePrintModal();
    document.getElementById('printResultModal').classList.add('active');
}

function closePrintResultModal() {
    document.getElementById('printResultModal').classList.remove('active');
}

async function downloadPrint() {
    const printArea = document.getElementById('printPreview');

    try {
        showLoading('Gerando imagem...');
        const canvas = await html2canvas(printArea, {
            backgroundColor: '#ffffff',
            scale: 2
        });

        const link = document.createElement('a');
        link.download = `cores-disponiveis-${Date.now()}.png`;
        link.href = canvas.toDataURL();
        link.click();

        showToast('Imagem baixada com sucesso!', 'success');
    } catch (error) {
        console.error('Error generating print:', error);
        showToast('Erro ao gerar imagem', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// UTILITY FUNCTIONS
// ===========================
function showLoading(text = 'Carregando...') {
    const overlay = document.getElementById('loadingOverlay');
    const loadingText = overlay.querySelector('.loading-text');
    loadingText.textContent = text;
    overlay.style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function updateConnectionStatus(connected) {
    const statusDot = document.querySelector('.status-dot');
    const statusText = document.getElementById('statusText');

    if (connected) {
        statusDot.classList.add('connected');
        statusText.textContent = 'Conectado';
    } else {
        statusDot.classList.remove('connected');
        statusText.textContent = 'Desconectado';
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = type === 'success' ? 'fa-check-circle' :
                 type === 'error' ? 'fa-exclamation-circle' :
                 type === 'warning' ? 'fa-exclamation-triangle' :
                 'fa-info-circle';

    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===========================
// GLOBAL FUNCTIONS FOR ONCLICK
// ===========================
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.openAddFilamentModal = openAddFilamentModal;
window.closeFilamentModal = closeFilamentModal;
window.saveFilament = saveFilament;
window.editFilament = editFilament;
window.deleteFilament = deleteFilament;
window.filterByType = filterByType;
window.filterByStock = filterByStock;
window.previewImage = previewImage;
window.openPrintModal = openPrintModal;
window.closePrintModal = closePrintModal;
window.generateColorPrint = generateColorPrint;
window.closePrintResultModal = closePrintResultModal;
window.downloadPrint = downloadPrint;
