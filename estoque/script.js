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
let pendingServices = []; // Serviços aguardando compra de material
let currentFilter = 'todos';
let currentStockFilter = null;
let selectedImage = null;
let editingFilamentId = null;
let selectedFilamentId = null;

// ===========================
// INITIALIZATION
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
    setupAuthListener();
    setupDragAndDrop(); // Configurar drag & drop para upload de imagem
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
    loadPendingServices(); // Carregar serviços aguardando material
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
// LOAD PENDING SERVICES
// ===========================
function loadPendingServices() {
    db.collection('services')
        .where('needsMaterialPurchase', '==', true)
        .onSnapshot(snapshot => {
            pendingServices = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                pendingServices.push({
                    id: doc.id,
                    name: data.name || 'Sem nome',
                    client: data.client || 'Cliente não informado',
                    material: data.material || '',
                    color: data.color || '',
                    weight: data.weight || 0,
                    orderCode: data.orderCode || 'N/A'
                });
            });
            console.log(`📦 ${pendingServices.length} serviços aguardando compra de material`);
            renderFilaments(); // Re-renderizar cards com as informações atualizadas
        }, error => {
            console.error('Error loading pending services:', error);
        });
}

// ===========================
// RENDER FILAMENTS
// ===========================
function renderFilaments() {
    const grid = document.getElementById('filamentsGrid');
    const emptyState = document.getElementById('emptyState');

    // Apply filters
    // CORRIGIDO: Garantir que weight seja número antes de comparar
    let filtered = filaments.filter(f => {
        const weight = parseFloat(f.weight) || 0;
        if (currentFilter !== 'todos' && f.type !== currentFilter) return false;
        if (currentStockFilter === 'low' && weight >= 0.6) return false;
        if (currentStockFilter === 'ok' && weight < 0.8) return false;
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';
    grid.innerHTML = filtered.map(filament => createFilamentCard(filament)).join('');

    // Adicionar event listeners aos cards
    attachCardEventListeners();
}

function attachCardEventListeners() {
    const cards = document.querySelectorAll('.filament-card');
    console.log('Anexando event listeners a', cards.length, 'cards');

    cards.forEach(card => {
        const filamentId = card.getAttribute('data-filament-id');
        console.log('Card com ID:', filamentId);

        card.addEventListener('click', function(e) {
            const id = this.getAttribute('data-filament-id');
            console.log('Card clicado! ID:', id);
            if (id) {
                openCardActionsModal(id);
            } else {
                console.error('Card não tem data-filament-id');
            }
        });
    });
}

function createFilamentCard(filament) {
    // CORRIGIDO: Garantir que weight seja número válido
    const weightInGrams = (parseFloat(filament.weight) || 0) * 1000;
    const stockClass = weightInGrams < 600 ? 'low' : (weightInGrams > 800 ? 'ok' : '');
    const outOfStock = weightInGrams <= 0 ? 'out-of-stock' : '';

    // CORRIGIDO: Tratar valores undefined/null
    const filamentType = filament.type || '';
    const filamentColor = filament.color || '';
    const displayName = `${filamentType} ${filamentColor}`.trim() || 'Sem nome';
    const brand = filament.brand || 'Não especificada';

    // Buscar serviços pendentes para este filamento
    // CORRIGIDO: Verificar se filament tem type e color antes de comparar
    const servicesForThisFilament = (filamentType && filamentColor) ? pendingServices.filter(s =>
        s.material && s.color &&
        s.material.toLowerCase() === filamentType.toLowerCase() &&
        s.color.toLowerCase() === filamentColor.toLowerCase()
    ) : [];

    // Calcular quantidade total necessária
    const totalNeeded = servicesForThisFilament.reduce((sum, s) => sum + (s.weight || 0), 0);
    const serviceCount = servicesForThisFilament.length;

    return `
        <div class="filament-card ${outOfStock}" data-filament-id="${filament.id}">
            ${stockClass ? `<div class="stock-indicator ${stockClass}"></div>` : ''}

            ${serviceCount > 0 ? `
            <div class="pending-services-badge">
                <i class="fas fa-exclamation-triangle"></i>
                <div class="badge-content">
                    <div class="badge-title">SERVIÇOS AGUARDANDO</div>
                    <div class="badge-details">
                        ${serviceCount} ${serviceCount === 1 ? 'pedido' : 'pedidos'} • ${totalNeeded.toFixed(0)}g necessários
                    </div>
                    <div class="badge-services">
                        ${servicesForThisFilament.map(s =>
                            `<div class="service-item">
                                <span class="service-code">#${s.orderCode}</span>
                                <span class="service-name">${s.name}</span>
                                <span class="service-weight">${s.weight}g</span>
                            </div>`
                        ).join('')}
                    </div>
                </div>
            </div>` : ''}

            <img src="${filament.imageUrl || '/iconwpp.jpg'}" alt="${displayName}" class="filament-image">
            <div class="filament-info">
                <div class="filament-type">${filamentType || 'N/A'}</div>
                <div class="filament-name">${displayName}</div>
                <div class="filament-brand"><i class="fas fa-copyright"></i> ${brand}</div>
                <div class="filament-color">${filamentColor || 'N/A'}</div>
                <div class="filament-weight ${weightInGrams < 600 ? 'low' : ''}">${weightInGrams.toFixed(0)}g</div>
            </div>
        </div>
    `;
}

// ===========================
// STATISTICS
// ===========================
function updateStats() {
    const total = filaments.length;
    // CORRIGIDO: Garantir que weight seja número antes de comparar
    const stockOk = filaments.filter(f => (parseFloat(f.weight) || 0) > 0.8).length;
    const stockLow = filaments.filter(f => {
        const w = parseFloat(f.weight) || 0;
        return w < 0.6 && w > 0;
    }).length;
    const totalWeight = filaments.reduce((sum, f) => sum + (parseFloat(f.weight) || 0), 0);

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
    // Resetar estado
    selectedImage = null;
    editingFilamentId = null;

    // Limpar formulário
    document.getElementById('filamentForm').reset();
    document.getElementById('filamentId').value = '';

    // Resetar preview de imagem
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('imagePreview').src = '';
    document.getElementById('uploadPlaceholder').style.display = 'flex';

    // Atualizar título
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-plus"></i> Adicionar Filamento';

    // Abrir modal
    document.getElementById('filamentModal').classList.add('active');
}

function editFilament(id) {
    console.log('editFilament chamado com ID:', id);
    console.log('Buscando filamento com ID:', id, 'em', filaments.length, 'filamentos');

    const filament = filaments.find(f => f.id === id);

    console.log('Resultado da busca:', filament);

    if (!filament) {
        console.error('Filamento não encontrado com ID:', id);
        showToast('Filamento não encontrado', 'error');
        return;
    }

    // Resetar imagem primeiro
    selectedImage = null;
    document.getElementById('imagePreview').style.display = 'none';
    document.getElementById('uploadPlaceholder').style.display = 'flex';

    // Preencher campos do formulário
    document.getElementById('modalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Filamento';
    document.getElementById('filamentId').value = filament.id;

    // Preencher selects nativos primeiro
    const typeSelect = document.getElementById('filamentType');
    const brandSelect = document.getElementById('filamentBrand');

    typeSelect.value = filament.type || '';
    brandSelect.value = filament.brand || '';

    // Preencher campos de texto
    document.getElementById('filamentColor').value = filament.color || '';
    document.getElementById('filamentWeight').value = filament.weight || 0;
    document.getElementById('filamentNotes').value = filament.notes || '';

    // Carregar imagem se existir
    if (filament.imageUrl) {
        document.getElementById('imagePreview').src = filament.imageUrl;
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('uploadPlaceholder').style.display = 'none';
    }

    editingFilamentId = id;

    // Abrir modal
    document.getElementById('filamentModal').classList.add('active');
}

function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    handleImageFile(file);
}

// ===========================
// DRAG & DROP UPLOAD
// ===========================

/**
 * Processa arquivo de imagem e exibe preview
 * Reutilizado por click upload e drag & drop
 */
function handleImageFile(file) {
    // Validar tipo de arquivo
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showToast('Formato inválido! Use PNG, JPEG ou WebP.', 'error');
        return;
    }

    selectedImage = file;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('imagePreview').src = e.target.result;
        document.getElementById('imagePreview').style.display = 'block';
        document.getElementById('uploadPlaceholder').style.display = 'none';
    };
    reader.readAsDataURL(file);

    showToast('Imagem carregada com sucesso!', 'success');
}

/**
 * Configura drag & drop na área de upload
 * Usa contador para lidar com elementos aninhados
 */
let dragCounter = 0;

function setupDragAndDrop() {
    const uploadArea = document.getElementById('imageUploadArea');
    if (!uploadArea) {
        console.log('⚠️ Elemento imageUploadArea não encontrado');
        return;
    }

    // Prevenir comportamento padrão do browser em toda a página
    // Isso evita que o browser abra a imagem em nova aba
    document.addEventListener('dragover', preventDefaults, false);
    document.addEventListener('drop', preventDefaults, false);

    // Eventos na área de upload
    uploadArea.addEventListener('dragenter', handleDragEnter, false);
    uploadArea.addEventListener('dragover', handleDragOver, false);
    uploadArea.addEventListener('dragleave', handleDragLeave, false);
    uploadArea.addEventListener('drop', handleDrop, false);

    console.log('🖼️ Drag & Drop configurado para upload de imagem');
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;

    const uploadArea = document.getElementById('imageUploadArea');
    if (uploadArea) {
        uploadArea.classList.add('drag-over');
    }
}

function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();

    // Manter o highlight durante o drag
    const uploadArea = document.getElementById('imageUploadArea');
    if (uploadArea && !uploadArea.classList.contains('drag-over')) {
        uploadArea.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;

    // Só remove o highlight quando realmente sair da área
    // (não quando passar sobre elementos filhos)
    if (dragCounter === 0) {
        const uploadArea = document.getElementById('imageUploadArea');
        if (uploadArea) {
            uploadArea.classList.remove('drag-over');
        }
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;

    const uploadArea = document.getElementById('imageUploadArea');
    if (uploadArea) {
        uploadArea.classList.remove('drag-over');
    }

    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length > 0) {
        const file = files[0];
        handleImageFile(file);
    }
}

async function saveFilament(event) {
    event.preventDefault();

    const type = document.getElementById('filamentType').value;
    const brand = document.getElementById('filamentBrand').value;
    const color = document.getElementById('filamentColor').value.trim();
    const weight = parseFloat(document.getElementById('filamentWeight').value);
    const notes = document.getElementById('filamentNotes').value.trim();
    const id = document.getElementById('filamentId').value;

    if (!type || !brand || !color || weight < 0) {
        showToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }

    // Gerar nome automaticamente
    const name = `${type} ${color}`;

    // Validar duplicatas (tipo + cor + marca) - apenas para novos registros ou ao mudar esses campos
    if (!id) {
        const duplicate = filaments.find(f =>
            f.type?.toLowerCase() === type?.toLowerCase() &&
            f.color?.toLowerCase() === color?.toLowerCase() &&
            (f.brand || '').toLowerCase() === (brand || '').toLowerCase()
        );

        if (duplicate) {
            showToast(`Já existe um filamento ${type} ${color} da marca ${brand}. Use a opção de recompra para adicionar estoque.`, 'error');
            return;
        }
    } else {
        // Se estiver editando, verificar se mudou tipo/cor/marca
        const current = filaments.find(f => f.id === id);
        const typeChanged = current?.type !== type;
        const colorChanged = current?.color !== color;
        const brandChanged = (current?.brand || '') !== (brand || '');

        if (current && (typeChanged || colorChanged || brandChanged)) {
            const duplicate = filaments.find(f =>
                f.id !== id &&
                f.type?.toLowerCase() === type?.toLowerCase() &&
                f.color?.toLowerCase() === color?.toLowerCase() &&
                (f.brand || '').toLowerCase() === (brand || '').toLowerCase()
            );

            if (duplicate) {
                showToast(`Já existe um filamento ${type} ${color} da marca ${brand}.`, 'error');
                return;
            }
        }
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
            brand,
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

    // Resetar formulário
    setTimeout(() => {
        document.getElementById('filamentForm').reset();
        document.getElementById('imagePreview').style.display = 'none';
        document.getElementById('uploadPlaceholder').style.display = 'flex';
    }, 300); // Aguardar animação de fechamento
}

// ===========================
// DELETE FILAMENT
// ===========================
async function deleteFilament(id) {
    console.log('deleteFilament chamado com ID:', id);

    if (!id) {
        console.error('ID está vazio ou undefined');
        showToast('ID do filamento não encontrado', 'error');
        return;
    }

    console.log('Buscando filamento com ID:', id, 'em', filaments.length, 'filamentos');
    const filament = filaments.find(f => f.id === id);

    console.log('Resultado da busca:', filament);

    if (!filament) {
        console.error('Filamento não encontrado com ID:', id);
        showToast('Filamento não encontrado', 'error');
        return;
    }

    const displayName = `${filament.type} ${filament.color}`;
    const confirmMessage = `Tem certeza que deseja excluir o filamento "${displayName}" da marca ${filament.brand || 'N/A'}?\n\nEsta ação não pode ser desfeita.`;

    if (!confirm(confirmMessage)) {
        return;
    }

    showLoading('Excluindo filamento...');

    try {
        // Tentar excluir a imagem do storage se existir
        if (filament.imageUrl && filament.imageUrl.includes('firebasestorage')) {
            try {
                const imageRef = storage.refFromURL(filament.imageUrl);
                await imageRef.delete();
            } catch (imgError) {
                console.warn('Erro ao excluir imagem, mas continuando com exclusão do filamento:', imgError);
            }
        }

        // Excluir o documento do Firestore
        await db.collection('filaments').doc(id).delete();

        showToast(`Filamento "${displayName}" excluído com sucesso!`, 'success');
    } catch (error) {
        console.error('Erro ao excluir filamento:', error);

        // Mensagens de erro mais específicas
        let errorMessage = 'Erro ao excluir filamento';
        if (error.code === 'permission-denied') {
            errorMessage = 'Você não tem permissão para excluir este filamento';
        } else if (error.code === 'not-found') {
            errorMessage = 'Filamento não encontrado no banco de dados';
        } else if (error.message) {
            errorMessage = `Erro: ${error.message}`;
        }

        showToast(errorMessage, 'error');
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
        showLoading('Convertendo imagens...');

        // Converter todas as imagens para base64 antes de gerar o canvas
        // Isso resolve o problema de CORS com imagens do Firebase Storage
        const images = printArea.querySelectorAll('img');
        await Promise.all(Array.from(images).map(img => convertImageToBase64(img)));

        showLoading('Gerando imagem...');
        const canvas = await html2canvas(printArea, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false
        });

        const link = document.createElement('a');
        link.download = `cores-disponiveis-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        showToast('Imagem baixada com sucesso!', 'success');
    } catch (error) {
        console.error('Error generating print:', error);
        showToast('Erro ao gerar imagem', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Converte uma imagem externa para base64 para evitar problemas de CORS
 */
async function convertImageToBase64(imgElement) {
    return new Promise((resolve) => {
        // Se já é base64 ou data URL, não precisa converter
        if (imgElement.src.startsWith('data:')) {
            resolve();
            return;
        }

        // Criar imagem temporária para carregar com CORS
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                // Converter para base64 e atualizar o src original
                const base64 = canvas.toDataURL('image/png');
                imgElement.src = base64;
                resolve();
            } catch (e) {
                console.warn('Não foi possível converter imagem:', e);
                resolve(); // Continua mesmo se falhar
            }
        };

        img.onerror = () => {
            console.warn('Erro ao carregar imagem:', imgElement.src);
            resolve(); // Continua mesmo se falhar
        };

        // Adicionar timestamp para evitar cache
        const separator = imgElement.src.includes('?') ? '&' : '?';
        img.src = imgElement.src + separator + 't=' + Date.now();
    });
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
// CARD ACTIONS MODAL
// ===========================
function openCardActionsModal(filamentId) {
    console.log('openCardActionsModal chamado com ID:', filamentId);
    console.log('Tipo do ID:', typeof filamentId);
    console.log('Filamentos disponíveis:', filaments.length);

    if (!filamentId) {
        console.error('ID do filamento está vazio ou undefined');
        showToast('ID do filamento não encontrado', 'error');
        return;
    }

    selectedFilamentId = filamentId;

    // Log dos IDs disponíveis para debug
    console.log('IDs dos filamentos:', filaments.map(f => ({ id: f.id, type: typeof f.id, name: f.type + ' ' + f.color })));

    const filament = filaments.find(f => f.id === filamentId);

    console.log('Filamento encontrado:', filament);

    if (!filament) {
        console.error('Filamento não encontrado com ID:', filamentId);
        showToast('Filamento não encontrado', 'error');
        return;
    }

    const displayName = `${filament.type} ${filament.color}`;
    const weightInGrams = (filament.weight * 1000).toFixed(0);
    const brand = filament.brand || 'Não especificada';

    document.getElementById('cardInfoSummary').innerHTML = `
        <h3>${displayName}</h3>
        <p><strong>Marca:</strong> ${brand}</p>
        <p><strong>Estoque atual:</strong> ${weightInGrams}g</p>
    `;

    document.getElementById('cardActionsModal').classList.add('active');
}

function closeCardActionsModal() {
    document.getElementById('cardActionsModal').classList.remove('active');
    selectedFilamentId = null;
}

async function handleRestock1kg() {
    if (!selectedFilamentId) {
        showToast('Erro: ID do filamento não selecionado', 'error');
        return;
    }

    // Guardar ID em variável local
    const filamentId = selectedFilamentId;

    const filament = filaments.find(f => f.id === filamentId);
    if (!filament) {
        showToast('Filamento não encontrado', 'error');
        return;
    }

    const newWeight = filament.weight + 1.0; // Adiciona 1kg

    // Fechar modal antes da operação
    closeCardActionsModal();

    try {
        showLoading('Adicionando 1kg ao estoque...');
        await db.collection('filaments').doc(filamentId).update({
            weight: newWeight,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('1kg adicionado ao estoque com sucesso!', 'success');
    } catch (error) {
        console.error('Error restocking:', error);
        showToast('Erro ao adicionar estoque', 'error');
    } finally {
        hideLoading();
    }
}

async function handleAddFractional() {
    if (!selectedFilamentId) {
        showToast('Erro: ID do filamento não selecionado', 'error');
        return;
    }

    // Guardar ID em variável local
    const filamentId = selectedFilamentId;

    const filament = filaments.find(f => f.id === filamentId);
    if (!filament) {
        showToast('Filamento não encontrado', 'error');
        return;
    }

    // Fechar modal antes do prompt para melhor UX
    closeCardActionsModal();

    const amount = prompt('Digite a quantidade em gramas a adicionar:');

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        if (amount !== null) {
            showToast('Digite uma quantidade válida', 'error');
        }
        return;
    }

    const amountInKg = parseFloat(amount) / 1000;
    const newWeight = filament.weight + amountInKg;

    try {
        showLoading('Adicionando quantidade ao estoque...');
        await db.collection('filaments').doc(filamentId).update({
            weight: newWeight,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast(`${amount}g adicionados ao estoque com sucesso!`, 'success');
    } catch (error) {
        console.error('Error adding fractional:', error);
        showToast('Erro ao adicionar estoque', 'error');
    } finally {
        hideLoading();
    }
}

function handleEditFilament() {
    console.log('handleEditFilament chamado. selectedFilamentId:', selectedFilamentId);
    if (!selectedFilamentId) {
        console.error('selectedFilamentId está vazio');
        showToast('Erro: ID do filamento não selecionado', 'error');
        return;
    }

    // Guardar ID em variável local ANTES de fechar o modal
    const filamentId = selectedFilamentId;
    closeCardActionsModal();
    editFilament(filamentId);
}

function handleDeleteFilament() {
    console.log('handleDeleteFilament chamado. selectedFilamentId:', selectedFilamentId);
    if (!selectedFilamentId) {
        console.error('selectedFilamentId está vazio');
        showToast('Erro: ID do filamento não selecionado', 'error');
        return;
    }

    // Guardar ID em variável local ANTES de fechar o modal
    const filamentId = selectedFilamentId;
    closeCardActionsModal();
    deleteFilament(filamentId);
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
window.openCardActionsModal = openCardActionsModal;
window.closeCardActionsModal = closeCardActionsModal;
window.handleRestock1kg = handleRestock1kg;
window.handleAddFractional = handleAddFractional;
window.handleEditFilament = handleEditFilament;
window.handleDeleteFilament = handleDeleteFilament;
