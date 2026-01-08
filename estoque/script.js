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
// FIREBASE CONFIGURATION (carregado de ENV_CONFIG)
// ===========================
const firebaseConfig = {
    apiKey: window.ENV_CONFIG?.FIREBASE_API_KEY || "AIzaSyDZxuazTrmimr0951TmTCKckI4Ede2hdn4",
    authDomain: window.ENV_CONFIG?.FIREBASE_AUTH_DOMAIN || "imaginatech-servicos.firebaseapp.com",
    projectId: window.ENV_CONFIG?.FIREBASE_PROJECT_ID || "imaginatech-servicos",
    storageBucket: window.ENV_CONFIG?.FIREBASE_STORAGE_BUCKET || "imaginatech-servicos.firebasestorage.app",
    messagingSenderId: window.ENV_CONFIG?.FIREBASE_MESSAGING_SENDER_ID || "321455309872",
    appId: window.ENV_CONFIG?.FIREBASE_APP_ID || "1:321455309872:web:e7ba49a0f020bbae1159f5"
};

// ===========================
// AUTHORIZED USERS (carregado de ENV_CONFIG)
// ===========================
const AUTHORIZED_EMAILS = window.ENV_CONFIG?.AUTHORIZED_ADMINS?.map(a => a.email) || [
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
// AUTO-FULFILL PENDING SERVICES
// ===========================

/**
 * Verifica serviços pendentes para um tipo+cor e deduz automaticamente se possível
 * @param {string} type - Tipo do material (PLA, ABS, etc)
 * @param {string} color - Cor do material
 */
async function checkAndFulfillPendingServices(type, color) {
    if (!type || !color) return;

    // 1. Filtrar serviços pendentes para este tipo+cor
    const matchingServices = pendingServices.filter(s =>
        s.material?.toLowerCase() === type?.toLowerCase() &&
        s.color?.toLowerCase() === color?.toLowerCase()
    );

    if (matchingServices.length === 0) return;

    // 2. Calcular estoque total combinado (todas as marcas)
    const matchingFilaments = filaments.filter(f =>
        f.type?.toLowerCase() === type?.toLowerCase() &&
        f.color?.toLowerCase() === color?.toLowerCase()
    );

    const totalStockGrams = matchingFilaments.reduce((sum, f) =>
        sum + (parseFloat(f.weight) || 0) * 1000, 0
    );

    // 3. Ordenar serviços por peso (menores primeiro - otimiza atendimento)
    matchingServices.sort((a, b) => (a.weight || 0) - (b.weight || 0));

    let remainingStock = totalStockGrams;
    const servicesToFulfill = [];

    // 4. Identificar quais serviços podem ser atendidos
    for (const service of matchingServices) {
        const needed = service.weight || 0;
        if (needed <= remainingStock) {
            servicesToFulfill.push(service);
            remainingStock -= needed;
        }
    }

    if (servicesToFulfill.length === 0) return;

    // 5. Para cada serviço, deduzir material e limpar flag
    for (const service of servicesToFulfill) {
        try {
            // Deduzir do filamento com maior estoque
            await deductFromBestFilament(type, color, service.weight);

            // Atualizar serviço no Firestore
            await db.collection('services').doc(service.id).update({
                needsMaterialPurchase: false
            });

            console.log(`✅ Material deduzido para serviço #${service.orderCode}`);
        } catch (error) {
            console.error(`Erro ao deduzir material para ${service.orderCode}:`, error);
        }
    }

    // 6. Mostrar feedback
    if (servicesToFulfill.length > 0) {
        showToast(`✅ ${servicesToFulfill.length} serviço(s) atendido(s) automaticamente!`, 'success');
    }
}

/**
 * Deduz material do filamento com maior estoque
 */
async function deductFromBestFilament(type, color, weightInGrams) {
    // Encontrar filamento com maior estoque
    const matching = filaments
        .filter(f =>
            f.type?.toLowerCase() === type?.toLowerCase() &&
            f.color?.toLowerCase() === color?.toLowerCase() &&
            (parseFloat(f.weight) || 0) > 0
        )
        .sort((a, b) => (parseFloat(b.weight) || 0) - (parseFloat(a.weight) || 0));

    if (matching.length === 0) {
        throw new Error('Nenhum filamento disponível');
    }

    const best = matching[0];
    const weightInKg = weightInGrams / 1000;
    const currentWeight = parseFloat(best.weight) || 0;
    const newWeight = Math.max(0, currentWeight - weightInKg);

    await db.collection('filaments').doc(best.id).update({
        weight: newWeight,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
    // Garantir que weight seja número válido
    const weightInGrams = (parseFloat(filament.weight) || 0) * 1000;
    const stockClass = weightInGrams < 600 ? 'low' : (weightInGrams > 800 ? 'ok' : '');
    const outOfStock = weightInGrams <= 0 ? 'out-of-stock' : '';

    // Tratar valores undefined/null
    const filamentType = filament.type || '';
    const filamentColor = filament.color || '';
    const brand = filament.brand || 'Não especificada';

    // Buscar serviços pendentes para este filamento
    const servicesForThisFilament = (filamentType && filamentColor) ? pendingServices.filter(s =>
        s.material && s.color &&
        s.material.toLowerCase() === filamentType.toLowerCase() &&
        s.color.toLowerCase() === filamentColor.toLowerCase()
    ) : [];

    // Calcular quantidade total necessária
    const totalNeeded = servicesForThisFilament.reduce((sum, s) => sum + (s.weight || 0), 0);
    const serviceCount = servicesForThisFilament.length;

    // Calcular estoque TOTAL para este tipo+cor (todas as marcas)
    const totalStockForColor = filaments
        .filter(f =>
            f.type?.toLowerCase() === filamentType?.toLowerCase() &&
            f.color?.toLowerCase() === filamentColor?.toLowerCase()
        )
        .reduce((sum, f) => sum + (parseFloat(f.weight) || 0) * 1000, 0);

    // Só mostrar badge se estoque TOTAL for insuficiente
    const showBadge = serviceCount > 0 && totalStockForColor < totalNeeded;

    return `
        <div class="filament-card ${outOfStock}" data-filament-id="${filament.id}">
            ${stockClass ? `<div class="stock-indicator ${stockClass}"></div>` : ''}

            ${showBadge ? `
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

            <img src="${filament.imageUrl || '/iconwpp.jpg'}" alt="${filamentType} ${filamentColor}" class="filament-image">
            <div class="filament-info">
                <div class="filament-type">${filamentType || 'N/A'}</div>
                <div class="filament-color">${filamentColor || 'N/A'}</div>
                <div class="filament-brand"><i class="fas fa-copyright"></i> ${brand}</div>
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
    updateStatCardsActiveState();
}

// Filtro via cards de estatísticas
function filterByStatCard(statType) {
    // Resetar filtro de tipo
    currentFilter = 'todos';
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('.filter-btn')?.classList.add('active'); // Primeiro botão "Todos"

    // Resetar filtros de estoque nos botões
    document.querySelectorAll('.filter-group:last-child .filter-btn').forEach(btn => btn.classList.remove('active'));

    // Aplicar filtro baseado no card clicado
    switch (statType) {
        case 'total':
            currentStockFilter = null;
            break;
        case 'ok':
            currentStockFilter = 'ok';
            break;
        case 'low':
            currentStockFilter = 'low';
            break;
        case 'weight':
            currentStockFilter = null;
            break;
        default:
            currentStockFilter = null;
    }

    renderFilaments();
    updateStatCardsActiveState();
}

// Atualizar estado visual dos cards de estatísticas
function updateStatCardsActiveState() {
    document.querySelectorAll('.stat-card').forEach(card => card.classList.remove('active'));

    if (currentStockFilter === 'ok') {
        document.getElementById('statCardOk')?.classList.add('active');
    } else if (currentStockFilter === 'low') {
        document.getElementById('statCardLow')?.classList.add('active');
    } else {
        document.getElementById('statCardTotal')?.classList.add('active');
    }
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

    // Sincronizar CustomSelects após reset (para mostrar "Selecione..." novamente)
    const typeSelect = document.getElementById('filamentType');
    const brandSelect = document.getElementById('filamentBrand');
    typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    brandSelect.dispatchEvent(new Event('change', { bubbles: true }));

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

    // Preencher selects nativos e sincronizar CustomSelects
    const typeSelect = document.getElementById('filamentType');
    const brandSelect = document.getElementById('filamentBrand');

    typeSelect.value = filament.type || '';
    brandSelect.value = filament.brand || '';

    // Disparar evento change para sincronizar os CustomSelects visuais
    // Isso notifica os wrappers CustomSelect para atualizarem sua exibição
    typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    brandSelect.dispatchEvent(new Event('change', { bubbles: true }));

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

        // Verificar se pode atender serviços pendentes para este tipo+cor
        setTimeout(() => {
            checkAndFulfillPendingServices(type, color);
        }, 500);
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

    // Resetar formulário após animação de fechamento
    setTimeout(() => {
        document.getElementById('filamentForm').reset();
        document.getElementById('imagePreview').style.display = 'none';
        document.getElementById('uploadPlaceholder').style.display = 'flex';

        // Sincronizar CustomSelects após reset
        const typeSelect = document.getElementById('filamentType');
        const brandSelect = document.getElementById('filamentBrand');
        if (typeSelect) typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        if (brandSelect) brandSelect.dispatchEvent(new Event('change', { bubbles: true }));
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

        // Verificar se pode atender serviços pendentes
        setTimeout(() => {
            checkAndFulfillPendingServices(filament.type, filament.color);
        }, 500);
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

        // Verificar se pode atender serviços pendentes
        setTimeout(() => {
            checkAndFulfillPendingServices(filament.type, filament.color);
        }, 500);
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
window.filterByStatCard = filterByStatCard;
window.previewImage = previewImage;
window.openCardActionsModal = openCardActionsModal;
window.closeCardActionsModal = closeCardActionsModal;
window.handleRestock1kg = handleRestock1kg;
window.handleAddFractional = handleAddFractional;
window.handleEditFilament = handleEditFilament;
window.handleDeleteFilament = handleDeleteFilament;
