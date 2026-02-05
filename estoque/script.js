/*
=================================================
ARQUIVO: estoque/script.js
MÓDULO: Gestão de Estoque (Filamentos)
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 2.0 - Security Hardened
IMPORTANTE: NÃO REMOVER ESTE CABEÇALHO DE IDENTIFICAÇÃO
=================================================
*/

// ===========================
// SECURITY UTILITIES
// ===========================

/**
 * Escapa HTML para prevenir XSS
 * SEMPRE usar ao renderizar dados de usuario
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

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

/**
 * Gera ID seguro usando crypto
 * Substitui Math.random() que e previsivel
 */
function generateSecureId(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, n => chars[n % chars.length]).join('');
}

/**
 * Valida magic bytes de imagem
 * NAO confiar apenas na extensao/MIME
 */
async function validateImageMagicBytes(file) {
    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
    // GIF: 47 49 46 38
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true;
    // WebP: 52 49 46 46 ... 57 45 42 50
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true;

    return false;
}

/**
 * Sanitiza nome de arquivo
 * Previne path traversal e caracteres invalidos
 */
function sanitizeFileName(name) {
    return name
        .replace(/\.\./g, '')           // Path traversal
        .replace(/[\/\\:*?"<>|]/g, '_') // Caracteres invalidos
        .slice(0, 200);                 // Tamanho maximo
}

// ===========================
// FIREBASE CONFIGURATION (carregado de ENV_CONFIG)
// SEGURANCA: Sem fallback hardcoded - ENV_CONFIG obrigatorio
// ===========================
const firebaseConfig = {
    apiKey: window.ENV_CONFIG?.FIREBASE_API_KEY,
    authDomain: window.ENV_CONFIG?.FIREBASE_AUTH_DOMAIN,
    projectId: window.ENV_CONFIG?.FIREBASE_PROJECT_ID,
    storageBucket: window.ENV_CONFIG?.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: window.ENV_CONFIG?.FIREBASE_MESSAGING_SENDER_ID,
    appId: window.ENV_CONFIG?.FIREBASE_APP_ID
};

// ===========================
// AUTHORIZED USERS (carregado EXCLUSIVAMENTE do Firestore)
// SEGURANCA: Nenhum fallback hardcoded - admins devem vir do Firestore
// ===========================
let AUTHORIZED_EMAILS = [];
let adminsLoadFailed = false;

// Carrega admins do Firestore (OBRIGATORIO antes de verificar autorizacao)
async function loadAuthorizedEmails() {
    try {
        if (window.ENV_CONFIG?.loadAdmins && db) {
            const admins = await window.ENV_CONFIG.loadAdmins(db);
            if (admins && admins.length > 0) {
                AUTHORIZED_EMAILS = admins.map(a => a.email);
                logger.log('Admins carregados:', AUTHORIZED_EMAILS.length);
            } else {
                logger.error('ERRO: Nenhum admin retornado do Firestore');
                adminsLoadFailed = true;
            }
        } else {
            logger.error('ERRO: ENV_CONFIG.loadAdmins nao disponivel');
            adminsLoadFailed = true;
        }
    } catch (error) {
        logger.error('Erro ao carregar admins:', error);
        adminsLoadFailed = true;
    }
}

// Verifica se usuario e autorizado (SEGURO: retorna false se admins nao carregados)
function isAuthorizedUser(email) {
    if (adminsLoadFailed || AUTHORIZED_EMAILS.length === 0) {
        logger.warn('Verificacao de autorizacao antes de carregar admins');
        return false;
    }
    return AUTHORIZED_EMAILS.includes(email);
}

/**
 * Garante que o admin autenticado tenha o custom claim 'admin: true'
 * Chama a Cloud Function ensureMyAdminClaim para configurar se necessario
 * Depois faz refresh do token local para refletir o claim
 * @returns {Promise<boolean>} true se claim esta configurado
 */
async function ensureAdminClaim() {
    try {
        const user = auth.currentUser;
        if (!user) {
            logger.warn('ensureAdminClaim: Nenhum usuario autenticado');
            return false;
        }

        const idToken = await user.getIdToken(false);
        const functionsUrl = window.ENV_CONFIG?.FUNCTIONS_URL;
        if (!functionsUrl) {
            logger.error('ensureAdminClaim: FUNCTIONS_URL nao configurada');
            return false;
        }

        const response = await fetch(`${functionsUrl}/ensureMyAdminClaim`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            }
        });

        if (!response.ok) {
            logger.warn('ensureAdminClaim: Resposta nao-ok:', response.status);
            return false;
        }

        const data = await response.json();

        if (data.success && !data.alreadySet) {
            // Claim foi configurado agora - forcar refresh do token local
            logger.log('Custom claim configurado pelo backend, atualizando token local...');
            await user.getIdToken(true);
            logger.log('Token atualizado com custom claim admin');
        } else if (data.alreadySet) {
            logger.log('Custom claim admin ja estava configurado');
        }

        return data.success;
    } catch (error) {
        logger.error('Erro ao garantir admin claim:', error);
        return false;
    }
}

// ===========================
// GLOBAL STATE
// ===========================
let db, auth, storage;
let filaments = [];
let pendingServices = []; // Serviços aguardando compra de material
let currentFilter = 'todos';
let currentStockFilter = null;
let currentBrandFilter = null;
let selectedImage = null;
let editingFilamentId = null;
let editingFilamentUpdatedAt = null; // Para bloqueio otimista
let selectedFilamentId = null;

// Equipamentos (Inventário)
let equipment = [];
let selectedEquipmentId = null;
let editingEquipmentId = null;
let selectedEquipmentImage = null;
let equipmentSortOrder = 'price-desc'; // Ordenação padrão: preço maior → menor

// ===========================
// INITIALIZATION
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
    setupAuthListener();
    setupDragAndDrop(); // Configurar drag & drop para upload de imagem
    setupGlobalEventDelegation(); // Handler seguro para data-action
});

// ===========================
// GLOBAL EVENT DELEGATION (Seguranca: evita onclick inline)
// ===========================
function setupGlobalEventDelegation() {
    // Handler para clicks em elementos com data-action
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;

        const action = el.dataset.action;
        const value = el.dataset.value;

        // Mapeamento de acoes
        const handlers = {
            // Autenticacao
            'sign-in-google': () => signInWithGoogle(),
            'sign-out': () => signOut(),

            // Navegacao mobile
            'toggle-mobile-menu': () => {
                if (typeof toggleMobileMenu === 'function') {
                    toggleMobileMenu();
                }
            },

            // Secoes
            'switch-section': () => switchSection(value),

            // Filtros filamentos
            'filter-stat-card': () => filterByStatCard(value),
            'filter-type': () => filterByType(el.dataset.value),
            'filter-stock': () => filterByStock(el.dataset.value),
            'filter-brand': () => {
                if (el.dataset.value === 'todas') {
                    clearBrandFilter();
                } else {
                    filterByBrand(el.dataset.value);
                }
            },

            // Modal filamento
            'open-add-filament-modal': () => openAddFilamentModal(),
            'close-filament-modal': () => closeFilamentModal(),
            'trigger-filament-upload': () => document.getElementById('filamentImage')?.click(),
            'paste-filament-image': () => pasteImageFromClipboard('filament'),

            // Acoes card filamento
            'close-card-actions-modal': () => closeCardActionsModal(),
            'quick-deduction': () => handleQuickDeduction(),
            'restock-1kg': () => handleRestock1kg(),
            'add-fractional': () => handleAddFractional(),
            'edit-filament': () => handleEditFilament(),
            'delete-filament': () => handleDeleteFilament(),

            // Modal equipamento
            'open-add-equipment-modal': () => openAddEquipmentModal(),
            'close-equipment-modal': () => closeEquipmentModal(),
            'trigger-equipment-upload': () => document.getElementById('equipmentImage')?.click(),
            'paste-equipment-image': () => pasteImageFromClipboard('equipment'),
            'select-equipment-status': () => selectEquipmentStatus(value),

            // Acoes card equipamento
            'close-equipment-actions-modal': () => closeEquipmentActionsModal(),
            'edit-equipment': () => handleEditEquipment(),
            'delete-equipment': () => handleDeleteEquipment()
        };

        if (handlers[action]) {
            e.preventDefault();
            handlers[action]();
        }
    });

    // Handler para change em elementos com data-action
    document.addEventListener('change', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;

        const action = el.dataset.action;

        const changeHandlers = {
            'sort-equipment': () => sortEquipment(el.value),
            'preview-filament-image': () => previewImage(e),
            'preview-equipment-image': () => previewEquipmentImage(e)
        };

        if (changeHandlers[action]) {
            changeHandlers[action]();
        }
    });

    // Handler para submit em forms com data-form
    document.addEventListener('submit', (e) => {
        const form = e.target.closest('[data-form]');
        if (!form) return;

        e.preventDefault();
        const formType = form.dataset.form;

        if (formType === 'filament') {
            saveFilament(e);
        } else if (formType === 'equipment') {
            saveEquipment(e);
        }
    });

    logger.log('Event delegation configurado');
}

function initializeFirebase() {
    try {
        // Validar configuracao antes de inicializar
        if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
            throw new Error('ENV_CONFIG nao carregado corretamente');
        }
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        storage = firebase.storage();
        logger.log('Firebase inicializado');
    } catch (error) {
        logger.error('Erro ao inicializar Firebase:', error);
        showToast('Erro ao conectar com o servidor', 'error');
    }
}

// ===========================
// AUTHENTICATION
// ===========================
function setupAuthListener() {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Carregar admins do Firestore antes de verificar
            await loadAuthorizedEmails();
        }

        hideLoading();
        if (user && isAuthorizedUser(user.email)) {
            // Garantir que o custom claim 'admin' esteja configurado para Storage
            ensureAdminClaim();
            showDashboard(user);
            loadFilaments();
        } else {
            if (user) {
                // Mostrar tela de acesso negado com dados do usuario
                showAccessDeniedScreen(user);
            } else {
                showLoginScreen();
            }
        }
    });
}

function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then(result => {
            const user = result.user;
            // SEGURANCA: Verificar se o email foi verificado
            if (!user.emailVerified) {
                logger.warn('Email nao verificado:', user.email);
                auth.signOut();
                showToast('Seu email precisa ser verificado. Verifique sua caixa de entrada.', 'error');
                return;
            }
        })
        .catch(error => {
            logger.error('Erro no login:', error);
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
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('accessDeniedScreen').classList.remove('active');
    document.getElementById('userName').textContent = user.displayName || user.email;
    document.getElementById('userPhoto').src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=00D4FF&color=fff`;
    updateConnectionStatus(true);
    loadPendingServices(); // Carregar servicos aguardando material
    loadEquipment(); // Carregar equipamentos do inventario
}

function showLoginScreen() {
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('accessDeniedScreen').classList.remove('active');
}

function showAccessDeniedScreen(user) {
    document.getElementById('loginScreen').classList.remove('active');
    document.getElementById('dashboard').classList.add('hidden');

    // Atualizar informacoes do usuario na tela
    const displayName = user.displayName || 'Usuario';
    document.getElementById('deniedMessage').textContent =
        `Ola ${displayName}, esta area e exclusiva para administradores.`;
    document.getElementById('deniedUserEmail').textContent = user.email;

    // Mostrar tela de acesso negado
    document.getElementById('accessDeniedScreen').classList.add('active');
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
            updateBrandFilters();
            hideLoading();
        }, error => {
            logger.error('Erro ao carregar filamentos:', error);
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
            logger.log(pendingServices.length + ' servicos aguardando compra de material');
            renderFilaments(); // Re-renderizar cards com as informações atualizadas
        }, error => {
            logger.error('Erro ao carregar servicos pendentes:', error);
        });
}

// ===========================
// AUTO-FULFILL PENDING SERVICES
// ===========================

/**
 * Verifica servicos pendentes para um tipo+cor e deduz automaticamente se possivel
 * USA TRANSACAO FIRESTORE para evitar race conditions
 * @param {string} type - Tipo do material (PLA, ABS, etc)
 * @param {string} color - Cor do material
 */
async function checkAndFulfillPendingServices(type, color) {
    if (!type || !color) return;

    const typeLower = type.trim().toLowerCase();
    const colorLower = color.trim().toLowerCase();

    // Filtrar servicos pendentes para este tipo+cor (da memoria, so para saber se vale a pena continuar)
    const matchingServices = pendingServices.filter(s =>
        s.material?.trim().toLowerCase() === typeLower &&
        s.color?.trim().toLowerCase() === colorLower
    );

    if (matchingServices.length === 0) return;

    // Ordenar servicos por peso (menores primeiro - otimiza atendimento)
    matchingServices.sort((a, b) => (a.weight || 0) - (b.weight || 0));

    let fulfilledCount = 0;

    // Processar cada servico em transacao separada para evitar conflitos
    for (const service of matchingServices) {
        try {
            const success = await fulfillServiceWithTransaction(service, typeLower, colorLower);
            if (success) {
                fulfilledCount++;
                logger.log('Material deduzido para servico #' + service.orderCode);
            }
        } catch (error) {
            logger.error('Erro ao deduzir material para ' + service.orderCode + ':', error);
            // Continua para o proximo servico
        }
    }

    if (fulfilledCount > 0) {
        showToast(`${fulfilledCount} servico(s) atendido(s) automaticamente!`, 'success');
    }
}

/**
 * Processa um servico usando transacao Firestore para garantir atomicidade
 * Le dados frescos do banco (nao da memoria) para evitar race conditions
 */
async function fulfillServiceWithTransaction(service, typeLower, colorLower) {
    const neededGrams = service.weight || 0;
    if (neededGrams <= 0) return false;

    return await db.runTransaction(async (transaction) => {
        // 0. Verificar se servico AINDA precisa de material (evita deducao duplicada)
        const serviceRef = db.collection('services').doc(service.id);
        const serviceDoc = await transaction.get(serviceRef);

        if (!serviceDoc.exists) {
            return false; // Servico foi deletado
        }

        const serviceData = serviceDoc.data();
        if (!serviceData.needsMaterialPurchase) {
            return false; // Ja foi atendido por outro usuario
        }

        // 1. Buscar filamentos FRESCOS do banco (nao da memoria!)
        const filamentsSnapshot = await transaction.get(
            db.collection('filaments')
                .where('type', '==', service.material) // Busca exata primeiro
        );

        // Filtrar por cor e peso > 0, ordenar por peso decrescente
        const matchingFilaments = [];
        filamentsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.color?.trim().toLowerCase() === colorLower &&
                (parseFloat(data.weight) || 0) > 0) {
                matchingFilaments.push({ id: doc.id, ref: doc.ref, ...data });
            }
        });

        // Se busca exata falhou, tentar case-insensitive
        if (matchingFilaments.length === 0) {
            const allFilamentsSnapshot = await transaction.get(db.collection('filaments'));
            allFilamentsSnapshot.forEach(doc => {
                const data = doc.data();
                if (data.type?.trim().toLowerCase() === typeLower &&
                    data.color?.trim().toLowerCase() === colorLower &&
                    (parseFloat(data.weight) || 0) > 0) {
                    matchingFilaments.push({ id: doc.id, ref: doc.ref, ...data });
                }
            });
        }

        if (matchingFilaments.length === 0) {
            return false; // Sem estoque disponivel
        }

        // Ordenar por peso decrescente (maior estoque primeiro)
        matchingFilaments.sort((a, b) => (parseFloat(b.weight) || 0) - (parseFloat(a.weight) || 0));

        // Calcular estoque total disponivel
        const totalStockGrams = matchingFilaments.reduce((sum, f) =>
            sum + Math.round((parseFloat(f.weight) || 0) * 1000), 0
        );

        if (totalStockGrams < neededGrams) {
            return false; // Estoque insuficiente
        }

        // 2. Deduzir do filamento com maior estoque
        const best = matchingFilaments[0];
        const currentWeightKg = parseFloat(best.weight) || 0;
        const deductKg = neededGrams / 1000;
        const newWeightKg = Math.max(0, currentWeightKg - deductKg);

        // Arredondar para evitar erros de ponto flutuante
        const newWeightRounded = Math.round(newWeightKg * 1000) / 1000;

        // 3. Atualizar filamento E servico na mesma transacao
        transaction.update(best.ref, {
            weight: newWeightRounded,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        transaction.update(serviceRef, {
            needsMaterialPurchase: false
        });

        return true;
    });
}

// ===========================
// RENDER FILAMENTS
// ===========================

// Flag para garantir que event delegation seja configurado apenas uma vez
let gridEventDelegationSetup = false;

function renderFilaments() {
    const grid = document.getElementById('filamentsGrid');
    const emptyState = document.getElementById('emptyState');

    // Configurar event delegation UMA VEZ (evita memory leak)
    if (!gridEventDelegationSetup) {
        setupGridEventDelegation(grid);
        gridEventDelegationSetup = true;
    }

    // Apply filters
    // CORRIGIDO: Garantir que weight seja numero antes de comparar
    const mainTypes = ['PLA', 'ABS', 'PETG', 'TPU']; // Tipos principais (nao sao "outros")
    let filtered = filaments.filter(f => {
        const weight = parseFloat(f.weight) || 0;
        // Filtro por tipo
        if (currentFilter !== 'todos') {
            if (currentFilter === 'outros') {
                // "Outros" = qualquer tipo que NAO seja PLA, ABS, PETG ou TPU
                if (mainTypes.includes(f.type)) return false;
            } else {
                if (f.type !== currentFilter) return false;
            }
        }
        if (currentBrandFilter && f.brand !== currentBrandFilter) return false;
        if (currentStockFilter === 'low' && weight > 0.6) return false;
        if (currentStockFilter === 'ok' && weight <= 0.8) return false;
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

/**
 * Configura event delegation no grid - UM listener para todos os cards
 * Isso evita memory leak de adicionar listeners a cada render
 */
function setupGridEventDelegation(grid) {
    if (!grid) return;

    grid.addEventListener('click', function(e) {
        // Encontrar o card clicado (pode ser o card ou um elemento filho)
        const card = e.target.closest('.filament-card');
        if (!card) return;

        const id = card.getAttribute('data-filament-id');
        if (id) {
            openCardActionsModal(id);
        }
    });

    // Handler para imagens carregadas (substitui onload/onerror inline)
    grid.addEventListener('load', function(e) {
        if (e.target.tagName === 'IMG' && e.target.classList.contains('filament-image')) {
            const container = e.target.closest('.filament-image-container');
            if (container) {
                container.classList.remove('loading');
                container.classList.add('loaded');
            }
        }
    }, true); // Capture phase para pegar eventos de load

    grid.addEventListener('error', function(e) {
        if (e.target.tagName === 'IMG' && e.target.classList.contains('filament-image')) {
            const container = e.target.closest('.filament-image-container');
            if (container) {
                container.classList.remove('loading');
                container.classList.add('loaded');
            }
        }
    }, true);
}

function createFilamentCard(filament) {
    // Garantir que weight seja número válido
    const weightInGrams = (parseFloat(filament.weight) || 0) * 1000;
    const stockClass = weightInGrams <= 600 ? 'low' : (weightInGrams > 800 ? 'ok' : '');
    const outOfStock = weightInGrams <= 0 ? 'out-of-stock' : '';

    // SEGURANCA: Escapar dados de usuario
    const filamentType = escapeHtml(filament.type || '');
    const filamentColor = escapeHtml(filament.color || '');
    const brand = escapeHtml(filament.brand || 'Nao especificada');
    const safeId = escapeHtml(filament.id);

    // Buscar serviços pendentes para este filamento (comparacao case-insensitive)
    const typeRaw = (filament.type || '').toLowerCase();
    const colorRaw = (filament.color || '').toLowerCase();
    const servicesForThisFilament = (typeRaw && colorRaw) ? pendingServices.filter(s =>
        s.material && s.color &&
        s.material.toLowerCase() === typeRaw &&
        s.color.toLowerCase() === colorRaw
    ) : [];

    // Calcular quantidade total necessária
    const totalNeeded = servicesForThisFilament.reduce((sum, s) => sum + (s.weight || 0), 0);
    const serviceCount = servicesForThisFilament.length;

    // Calcular estoque TOTAL para este tipo+cor (todas as marcas)
    const totalStockForColor = filaments
        .filter(f =>
            f.type?.toLowerCase() === typeRaw &&
            f.color?.toLowerCase() === colorRaw
        )
        .reduce((sum, f) => sum + (parseFloat(f.weight) || 0) * 1000, 0);

    // Só mostrar badge se estoque TOTAL for insuficiente
    const showBadge = serviceCount > 0 && totalStockForColor < totalNeeded;

    return `
        <div class="filament-card ${outOfStock}" data-filament-id="${safeId}">
            ${stockClass ? `<div class="stock-indicator ${stockClass}"></div>` : ''}

            ${showBadge ? `
            <div class="pending-services-badge">
                <i class="fas fa-exclamation-triangle"></i>
                <div class="badge-content">
                    <div class="badge-title">SERVICOS AGUARDANDO</div>
                    <div class="badge-details">
                        ${serviceCount} ${serviceCount === 1 ? 'pedido' : 'pedidos'} - ${totalNeeded.toFixed(0)}g necessarios
                    </div>
                    <div class="badge-services">
                        ${servicesForThisFilament.map(s =>
                            `<div class="service-item">
                                <span class="service-code">#${escapeHtml(s.orderCode)}</span>
                                <span class="service-name">${escapeHtml(s.name)}</span>
                                <span class="service-weight">${s.weight}g</span>
                            </div>`
                        ).join('')}
                    </div>
                </div>
            </div>` : ''}

            <div class="filament-image-container loading" id="filament-img-${safeId}" data-filament-id="${safeId}">
                <img src="${filament.imageUrl || '/iconwpp.jpg'}" alt="${filamentType} ${filamentColor}" class="filament-image" onerror="this.onerror=null; this.src='/iconwpp.jpg';">
            </div>
            <div class="filament-info">
                <div class="filament-type">${filamentType || 'N/A'}</div>
                <div class="filament-color">${filamentColor || 'N/A'}</div>
                <div class="filament-brand"><i class="fas fa-copyright"></i> ${brand}</div>
                <div class="filament-weight ${weightInGrams <= 600 ? 'low' : ''}">${weightInGrams.toFixed(0)}g</div>
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
        return w <= 0.6 && w > 0;
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
    document.querySelectorAll('#filterGroupType .filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderFilaments();
}

function filterByStock(stockLevel) {
    if (currentStockFilter === stockLevel) {
        currentStockFilter = null;
        event.target.classList.remove('active');
    } else {
        currentStockFilter = stockLevel;
        document.querySelectorAll('#filterGroupStock .filter-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
    }
    renderFilaments();
    updateStatCardsActiveState();
}

function filterByBrand(brand) {
    if (currentBrandFilter === brand) {
        // Desativar filtro se clicar no mesmo
        currentBrandFilter = null;
        event.target.classList.remove('active');
    } else {
        currentBrandFilter = brand;
        document.querySelectorAll('#filterGroupBrand .filter-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');
    }
    renderFilaments();
}

// Atualizar botoes de marca dinamicamente baseado nos filamentos cadastrados
function updateBrandFilters() {
    const container = document.getElementById('filterGroupBrand');
    if (!container) return;

    // Extrair marcas unicas dos filamentos
    const brands = [...new Set(filaments.map(f => f.brand).filter(Boolean))].sort();

    if (brands.length === 0) {
        container.innerHTML = '';
        return;
    }

    // SEGURANCA: Usar data-action ao inves de onclick inline
    let html = `<button class="filter-btn ${!currentBrandFilter ? 'active' : ''}" data-filter="brand" data-value="todas" data-action="filter-brand">
        <i class="fas fa-copyright"></i> Todas
    </button>`;

    brands.forEach(brand => {
        const isActive = currentBrandFilter === brand ? 'active' : '';
        const safeBrand = escapeHtml(brand);
        html += `<button class="filter-btn ${isActive}" data-filter="brand" data-value="${safeBrand}" data-action="filter-brand">
            ${safeBrand}
        </button>`;
    });

    container.innerHTML = html;
}

function clearBrandFilter() {
    currentBrandFilter = null;
    document.querySelectorAll('#filterGroupBrand .filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderFilaments();
}

// Filtro via cards de estatísticas
function filterByStatCard(statType) {
    // Resetar filtro de tipo
    currentFilter = 'todos';
    document.querySelectorAll('#filterGroupType .filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('#filterGroupType .filter-btn')?.classList.add('active'); // Primeiro botão "Todos"

    // Resetar filtro de marca
    currentBrandFilter = null;
    document.querySelectorAll('#filterGroupBrand .filter-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector('#filterGroupBrand .filter-btn')?.classList.add('active'); // Botão "Todas"

    // Resetar filtros de estoque nos botões
    document.querySelectorAll('#filterGroupStock .filter-btn').forEach(btn => btn.classList.remove('active'));

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
    editingFilamentUpdatedAt = null;

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
    logger.log('editFilament chamado com ID:', id);

    const filament = filaments.find(f => f.id === id);

    if (!filament) {
        logger.error('Filamento nao encontrado com ID:', id);
        showToast('Filamento nao encontrado', 'error');
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
    editingFilamentUpdatedAt = filament.updatedAt || null; // Guardar timestamp para bloqueio otimista

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
 * SEGURANCA: Valida magic bytes, bloqueia SVG
 */
async function handleImageFile(file) {
    // SEGURANCA: Bloquear SVG (pode conter JavaScript)
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        showToast('SVG nao permitido por seguranca. Use PNG, JPEG ou WebP.', 'error');
        return;
    }

    // Validar tipo de arquivo
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
        showToast('Formato invalido! Use PNG, JPEG ou WebP.', 'error');
        return;
    }

    // SEGURANCA: Validar magic bytes
    const isValidImage = await validateImageMagicBytes(file);
    if (!isValidImage) {
        showToast('Arquivo invalido. O conteudo nao corresponde a uma imagem.', 'error');
        return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Imagem muito grande (max 5MB)', 'error');
        return;
    }

    // Processar remoção de fundo branco automaticamente
    let processedFile = file;
    try {
        showToast('Processando imagem...', 'info');
        processedFile = await removeWhiteBackground(file);
        if (processedFile !== file) {
            showToast('Fundo branco removido automaticamente!', 'success');
        }
    } catch (error) {
        logger.error('Erro ao remover fundo:', error);
        // Continuar com arquivo original se falhar
        processedFile = file;
    }

    selectedImage = processedFile;
    const reader = new FileReader();
    reader.onload = e => {
        const preview = document.getElementById('imagePreview');
        const placeholder = document.getElementById('uploadPlaceholder');
        if (preview) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';
    };
    reader.readAsDataURL(processedFile);

    if (processedFile === file) {
        showToast('Imagem carregada com sucesso!', 'success');
    }
}

// ===========================
// REMOÇÃO DE FUNDO BRANCO
// ===========================

/**
 * Remove fundo branco de uma imagem automaticamente
 * Usa Canvas API para processar pixels e tornar brancos transparentes
 * @param {File} file - Arquivo de imagem original
 * @returns {Promise<File>} - Arquivo processado com fundo transparente (PNG)
 */
async function removeWhiteBackground(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                // Criar canvas com dimensões da imagem
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;

                // Desenhar imagem no canvas
                ctx.drawImage(img, 0, 0);

                // Obter dados dos pixels
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                // Configurações de detecção de branco (ajustadas para maior tolerância)
                const WHITE_THRESHOLD = 230;  // Pixels claros (reduzido de 240 para detectar mais fundos)
                const EDGE_TOLERANCE = 40;    // Tolerância para suavização de bordas (aumentado para transição mais suave)
                const COLOR_TOLERANCE = 30;   // Tolerância para variação de cor (aumentado para fundos levemente coloridos)

                // Analisar cantos para detectar cor de fundo
                const cornerSamples = [
                    getPixelAt(data, canvas.width, 0, 0),                           // Top-left
                    getPixelAt(data, canvas.width, canvas.width - 1, 0),            // Top-right
                    getPixelAt(data, canvas.width, 0, canvas.height - 1),           // Bottom-left
                    getPixelAt(data, canvas.width, canvas.width - 1, canvas.height - 1) // Bottom-right
                ];

                // Função auxiliar para verificar se pixel é "branco" (inclui off-white e cinza claro)
                const isWhiteish = (p) => {
                    if (!p) return false;
                    const brightness = (p.r + p.g + p.b) / 3;
                    const maxDiff = Math.max(Math.abs(p.r - p.g), Math.abs(p.g - p.b), Math.abs(p.r - p.b));
                    // Pixel é branco se: é claro E tem pouca variação de cor
                    return brightness > WHITE_THRESHOLD && maxDiff < COLOR_TOLERANCE;
                };

                // Verificar se a maioria dos cantos é branca
                const whiteCorners = cornerSamples.filter(isWhiteish).length;

                // Se menos de 3 cantos são brancos, provavelmente não tem fundo branco
                if (whiteCorners < 3) {
                    logger.log('Imagem não parece ter fundo branco, mantendo original');
                    resolve(file);
                    return;
                }

                logger.log('Fundo branco detectado, processando remoção...');

                // Processar cada pixel
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    // Calcular "brancura" do pixel
                    const brightness = (r + g + b) / 3;
                    const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
                    const isNeutral = maxDiff < COLOR_TOLERANCE; // Pixel é neutro (branco, cinza, off-white)

                    if (isNeutral && brightness > WHITE_THRESHOLD) {
                        // Pixel é branco/cinza claro - tornar totalmente transparente
                        data[i + 3] = 0;
                    } else if (isNeutral && brightness > (WHITE_THRESHOLD - EDGE_TOLERANCE)) {
                        // Pixel está na zona de transição - aplicar transparência gradual
                        // Isso suaviza as bordas e evita serrilhado
                        const alpha = Math.round(((WHITE_THRESHOLD - brightness) / EDGE_TOLERANCE) * 255);
                        data[i + 3] = Math.min(data[i + 3], alpha);
                    }
                }

                // Aplicar os dados processados
                ctx.putImageData(imageData, 0, 0);

                // Converter canvas para blob PNG (suporta transparência)
                canvas.toBlob((blob) => {
                    if (blob) {
                        const processedFile = new File(
                            [blob],
                            file.name.replace(/\.[^.]+$/, '.png'),
                            { type: 'image/png' }
                        );
                        logger.log(`Fundo removido: ${file.size} bytes -> ${processedFile.size} bytes`);
                        resolve(processedFile);
                    } else {
                        reject(new Error('Falha ao converter imagem'));
                    }
                }, 'image/png', 1.0);

            } catch (error) {
                logger.error('Erro ao processar imagem:', error);
                reject(error);
            }
        };

        img.onerror = () => reject(new Error('Falha ao carregar imagem'));

        // Carregar imagem do file
        const reader = new FileReader();
        reader.onload = (e) => { img.src = e.target.result; };
        reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
        reader.readAsDataURL(file);
    });
}

/**
 * Obtém valores RGB de um pixel específico
 * @param {Uint8ClampedArray} data - Array de pixels
 * @param {number} width - Largura da imagem
 * @param {number} x - Coordenada X
 * @param {number} y - Coordenada Y
 * @returns {Object} - {r, g, b, a}
 */
function getPixelAt(data, width, x, y) {
    const idx = (y * width + x) * 4;
    return {
        r: data[idx],
        g: data[idx + 1],
        b: data[idx + 2],
        a: data[idx + 3]
    };
}

/**
 * Configura drag & drop nas áreas de upload
 * Usa contador para lidar com elementos aninhados
 */
let dragCounter = 0;
let equipmentDragCounter = 0;

function setupDragAndDrop() {
    // Prevenir comportamento padrão do browser em toda a página
    document.addEventListener('dragover', preventDefaults, false);
    document.addEventListener('drop', preventDefaults, false);

    // Configurar área de upload de filamentos
    const filamentUploadArea = document.getElementById('imageUploadArea');
    if (filamentUploadArea) {
        filamentUploadArea.addEventListener('dragenter', handleFilamentDragEnter, false);
        filamentUploadArea.addEventListener('dragover', handleFilamentDragOver, false);
        filamentUploadArea.addEventListener('dragleave', handleFilamentDragLeave, false);
        filamentUploadArea.addEventListener('drop', handleFilamentDrop, false);
        logger.log('Drag & Drop configurado para filamentos');
    }

    // Configurar área de upload de equipamentos
    const equipmentUploadArea = document.getElementById('equipmentImageUpload');
    if (equipmentUploadArea) {
        equipmentUploadArea.addEventListener('dragenter', handleEquipmentDragEnter, false);
        equipmentUploadArea.addEventListener('dragover', handleEquipmentDragOver, false);
        equipmentUploadArea.addEventListener('dragleave', handleEquipmentDragLeave, false);
        equipmentUploadArea.addEventListener('drop', handleEquipmentDrop, false);
        logger.log('Drag & Drop configurado para equipamentos');
    }

    // Configurar Ctrl+V para colar imagens
    setupPasteUpload();
}

/**
 * Configura Ctrl+V para colar imagens do clipboard nos modais
 */
function setupPasteUpload() {
    document.addEventListener('paste', async (e) => {
        // Verificar se algum modal de edição está aberto
        const filamentModal = document.getElementById('filamentModal');
        const equipmentModal = document.getElementById('equipmentModal');

        const isFilamentModalOpen = filamentModal?.classList.contains('active');
        const isEquipmentModalOpen = equipmentModal?.classList.contains('active');

        // Se nenhum modal estiver aberto, ignorar
        if (!isFilamentModalOpen && !isEquipmentModalOpen) {
            return;
        }

        // Obter itens do clipboard
        const items = e.clipboardData?.items;
        if (!items) return;

        // Primeiro, verificar se há uma imagem no clipboard
        let imageItem = null;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                imageItem = item;
                break;
            }
        }

        // Se não há imagem, deixar o comportamento padrão (colar texto em inputs)
        if (!imageItem) {
            return;
        }

        // Há uma imagem - processar o upload
        e.preventDefault();

        const file = imageItem.getAsFile();
        if (!file) return;

        // Chamar o handler apropriado baseado no modal aberto
        if (isFilamentModalOpen) {
            logger.log('Ctrl+V: Colando imagem no modal de filamento');
            handleImageFile(file);
        } else if (isEquipmentModalOpen) {
            logger.log('Ctrl+V: Colando imagem no modal de equipamento');
            handleEquipmentImageFile(file);
        }
    });

    logger.log('Ctrl+V paste configurado para upload de imagens');
}

/**
 * Lê imagem do clipboard e processa o upload
 * @param {string} target - 'filament' ou 'equipment'
 */
async function pasteImageFromClipboard(target) {
    try {
        // Verificar se a API de Clipboard está disponível
        if (!navigator.clipboard || !navigator.clipboard.read) {
            showToast('Seu navegador não suporta colar imagens. Tente arrastar a imagem.', 'error');
            return;
        }

        // Ler conteúdo do clipboard
        const clipboardItems = await navigator.clipboard.read();

        for (const item of clipboardItems) {
            // Procurar por tipo de imagem
            const imageType = item.types.find(type => type.startsWith('image/'));

            if (imageType) {
                const blob = await item.getType(imageType);
                const file = new File([blob], `pasted-image.${imageType.split('/')[1]}`, { type: imageType });

                logger.log(`Imagem colada do clipboard: ${file.type}, ${file.size} bytes`);

                // Chamar o handler apropriado
                if (target === 'filament') {
                    handleImageFile(file);
                } else if (target === 'equipment') {
                    handleEquipmentImageFile(file);
                }

                return; // Processar apenas a primeira imagem
            }
        }

        // Nenhuma imagem encontrada
        showToast('Nenhuma imagem encontrada no clipboard. Copie uma imagem primeiro.', 'warning');

    } catch (error) {
        logger.error('Erro ao colar imagem:', error);

        // Erro de permissão
        if (error.name === 'NotAllowedError') {
            showToast('Permissão negada para acessar o clipboard. Permita o acesso nas configurações do navegador.', 'error');
        } else {
            showToast('Erro ao colar imagem. Tente arrastar a imagem ao invés de colar.', 'error');
        }
    }
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// === FILAMENTOS DRAG & DROP ===
function handleFilamentDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    const uploadArea = document.getElementById('imageUploadArea');
    if (uploadArea) uploadArea.classList.add('drag-over');
}

function handleFilamentDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const uploadArea = document.getElementById('imageUploadArea');
    if (uploadArea && !uploadArea.classList.contains('drag-over')) {
        uploadArea.classList.add('drag-over');
    }
}

function handleFilamentDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) {
        const uploadArea = document.getElementById('imageUploadArea');
        if (uploadArea) uploadArea.classList.remove('drag-over');
    }
}

function handleFilamentDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    const uploadArea = document.getElementById('imageUploadArea');
    if (uploadArea) uploadArea.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleImageFile(files[0]);
    }
}

// === EQUIPAMENTOS DRAG & DROP ===
function handleEquipmentDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    equipmentDragCounter++;
    const uploadArea = document.getElementById('equipmentImageUpload');
    if (uploadArea) uploadArea.classList.add('drag-over');
}

function handleEquipmentDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    const uploadArea = document.getElementById('equipmentImageUpload');
    if (uploadArea && !uploadArea.classList.contains('drag-over')) {
        uploadArea.classList.add('drag-over');
    }
}

function handleEquipmentDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    equipmentDragCounter--;
    if (equipmentDragCounter === 0) {
        const uploadArea = document.getElementById('equipmentImageUpload');
        if (uploadArea) uploadArea.classList.remove('drag-over');
    }
}

function handleEquipmentDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    equipmentDragCounter = 0;
    const uploadArea = document.getElementById('equipmentImageUpload');
    if (uploadArea) uploadArea.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleEquipmentImageFile(files[0]);
    }
}

// Processar arquivo de imagem de equipamento (drag & drop)
async function handleEquipmentImageFile(file) {
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
        showToast('Formato inválido! Use PNG, JPEG ou WebP.', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast('Imagem muito grande (máx 5MB)', 'error');
        return;
    }

    // Processar remoção de fundo branco automaticamente
    let processedFile = file;
    try {
        showToast('Processando imagem...', 'info');
        processedFile = await removeWhiteBackground(file);
        if (processedFile !== file) {
            showToast('Fundo branco removido automaticamente!', 'success');
        }
    } catch (error) {
        logger.error('Erro ao remover fundo:', error);
        processedFile = file;
    }

    selectedEquipmentImage = processedFile;
    const reader = new FileReader();
    reader.onload = function(e) {
        const placeholder = document.getElementById('equipmentUploadPlaceholder');
        const preview = document.getElementById('equipmentImagePreview');

        if (placeholder) placeholder.style.display = 'none';
        if (preview) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        }
    };
    reader.readAsDataURL(processedFile);

    if (processedFile === file) {
        showToast('Imagem carregada com sucesso!', 'success');
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
            // Garantir custom claim admin antes do upload ao Storage
            await ensureAdminClaim();

            // SEGURANCA: Sanitizar nome do arquivo antes do upload
            const safeName = sanitizeFileName(selectedImage.name);
            const storageRef = storage.ref(`filaments/${Date.now()}_${safeName}`);
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
            // Update com bloqueio otimista
            await db.runTransaction(async (transaction) => {
                const docRef = db.collection('filaments').doc(id);
                const doc = await transaction.get(docRef);

                if (!doc.exists) {
                    throw new Error('DELETED');
                }

                // Verificar se documento foi modificado por outro usuario
                const currentUpdatedAt = doc.data().updatedAt;
                if (editingFilamentUpdatedAt && currentUpdatedAt) {
                    const originalTime = editingFilamentUpdatedAt.toMillis ? editingFilamentUpdatedAt.toMillis() : 0;
                    const currentTime = currentUpdatedAt.toMillis ? currentUpdatedAt.toMillis() : 0;

                    if (currentTime > originalTime) {
                        throw new Error('CONFLICT');
                    }
                }

                transaction.update(docRef, filamentData);
            });
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
        logger.error('Erro ao salvar filamento:', error);

        if (error.message === 'CONFLICT') {
            showToast('Este filamento foi modificado por outro usuario. Recarregue e tente novamente.', 'error');
        } else if (error.message === 'DELETED') {
            showToast('Este filamento foi excluido por outro usuario.', 'error');
            closeFilamentModal();
        } else {
            showToast('Erro ao salvar filamento', 'error');
        }
    } finally {
        hideLoading();
    }
}

function closeFilamentModal() {
    document.getElementById('filamentModal').classList.remove('active');
    selectedImage = null;
    editingFilamentId = null;
    editingFilamentUpdatedAt = null;

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
    logger.log('deleteFilament chamado com ID:', id);

    if (!id) {
        logger.error('ID esta vazio ou undefined');
        showToast('ID do filamento não encontrado', 'error');
        return;
    }

    logger.log('Buscando filamento com ID:', id);
    const filament = filaments.find(f => f.id === id);

    if (!filament) {
        logger.error('Filamento nao encontrado com ID:', id);
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
                logger.warn('Erro ao excluir imagem, mas continuando com exclusao do filamento:', imgError);
            }
        }

        // Excluir o documento do Firestore
        await db.collection('filaments').doc(id).delete();

        showToast(`Filamento "${displayName}" excluído com sucesso!`, 'success');
    } catch (error) {
        logger.error('Erro ao excluir filamento:', error);

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

    // SEGURANCA: Escapar mensagem para prevenir XSS
    toast.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${escapeHtml(message)}</span>
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
    logger.log('openCardActionsModal chamado com ID:', filamentId);

    if (!filamentId) {
        logger.error('ID do filamento esta vazio ou undefined');
        showToast('ID do filamento nao encontrado', 'error');
        return;
    }

    selectedFilamentId = filamentId;

    const filament = filaments.find(f => f.id === filamentId);

    if (!filament) {
        logger.error('Filamento nao encontrado com ID:', filamentId);
        showToast('Filamento nao encontrado', 'error');
        return;
    }

    // SEGURANCA: Escapar dados de usuario
    const displayName = `${escapeHtml(filament.type)} ${escapeHtml(filament.color)}`;
    const weightInGrams = (filament.weight * 1000).toFixed(0);
    const brand = escapeHtml(filament.brand || 'Nao especificada');

    document.getElementById('cardInfoSummary').innerHTML = `
        <h3>${displayName}</h3>
        <p><strong>Marca:</strong> ${brand}</p>
        <p><strong>Estoque atual:</strong> ${weightInGrams}g</p>
    `;

    // Limpar campo de deducao rapida
    const deductionInput = document.getElementById('quickDeductionAmount');
    if (deductionInput) {
        deductionInput.value = '';
    }

    document.getElementById('cardActionsModal').classList.add('active');
}

function closeCardActionsModal() {
    document.getElementById('cardActionsModal').classList.remove('active');
    selectedFilamentId = null;
}

async function handleRestock1kg() {
    if (!selectedFilamentId) {
        showToast('Erro: ID do filamento nao selecionado', 'error');
        return;
    }

    // Guardar ID e dados em variavel local antes de fechar modal
    const filamentId = selectedFilamentId;
    const filament = filaments.find(f => f.id === filamentId);

    if (!filament) {
        showToast('Filamento nao encontrado', 'error');
        return;
    }

    const filamentType = filament.type;
    const filamentColor = filament.color;

    // Fechar modal antes da operacao
    closeCardActionsModal();

    try {
        showLoading('Adicionando 1kg ao estoque...');

        // Usar increment() para operacao atomica (evita race condition)
        await db.collection('filaments').doc(filamentId).update({
            weight: firebase.firestore.FieldValue.increment(1.0),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('1kg adicionado ao estoque com sucesso!', 'success');

        // Verificar se pode atender servicos pendentes
        setTimeout(() => {
            checkAndFulfillPendingServices(filamentType, filamentColor);
        }, 500);
    } catch (error) {
        logger.error('Erro ao repor estoque:', error);
        showToast('Erro ao adicionar estoque', 'error');
    } finally {
        hideLoading();
    }
}

async function handleAddFractional() {
    if (!selectedFilamentId) {
        showToast('Erro: ID do filamento nao selecionado', 'error');
        return;
    }

    // Guardar ID e dados em variavel local antes de fechar modal
    const filamentId = selectedFilamentId;
    const filament = filaments.find(f => f.id === filamentId);

    if (!filament) {
        showToast('Filamento nao encontrado', 'error');
        return;
    }

    const filamentType = filament.type;
    const filamentColor = filament.color;

    // Fechar modal antes do prompt para melhor UX
    closeCardActionsModal();

    const amount = prompt('Digite a quantidade em gramas a adicionar:');

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        if (amount !== null) {
            showToast('Digite uma quantidade valida', 'error');
        }
        return;
    }

    const amountInKg = parseFloat(amount) / 1000;

    try {
        showLoading('Adicionando quantidade ao estoque...');

        // Usar increment() para operacao atomica (evita race condition)
        await db.collection('filaments').doc(filamentId).update({
            weight: firebase.firestore.FieldValue.increment(amountInKg),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast(`${amount}g adicionados ao estoque com sucesso!`, 'success');

        // Verificar se pode atender servicos pendentes
        setTimeout(() => {
            checkAndFulfillPendingServices(filamentType, filamentColor);
        }, 500);
    } catch (error) {
        logger.error('Erro ao adicionar fracionado:', error);
        showToast('Erro ao adicionar estoque', 'error');
    } finally {
        hideLoading();
    }
}

function handleEditFilament() {
    logger.log('handleEditFilament chamado. selectedFilamentId:', selectedFilamentId);
    if (!selectedFilamentId) {
        logger.error('selectedFilamentId esta vazio');
        showToast('Erro: ID do filamento não selecionado', 'error');
        return;
    }

    // Guardar ID em variável local ANTES de fechar o modal
    const filamentId = selectedFilamentId;
    closeCardActionsModal();
    editFilament(filamentId);
}

function handleDeleteFilament() {
    logger.log('handleDeleteFilament chamado. selectedFilamentId:', selectedFilamentId);
    if (!selectedFilamentId) {
        logger.error('selectedFilamentId esta vazio');
        showToast('Erro: ID do filamento não selecionado', 'error');
        return;
    }

    // Guardar ID em variável local ANTES de fechar o modal
    const filamentId = selectedFilamentId;
    closeCardActionsModal();
    deleteFilament(filamentId);
}

// ===========================
// DEDUCAO RAPIDA
// ===========================
async function handleQuickDeduction() {
    if (!selectedFilamentId) {
        showToast('Erro: ID do filamento nao selecionado', 'error');
        return;
    }

    const inputElement = document.getElementById('quickDeductionAmount');
    const amount = parseFloat(inputElement.value);

    if (!amount || isNaN(amount) || amount <= 0) {
        showToast('Digite uma quantidade valida em gramas', 'error');
        inputElement.focus();
        return;
    }

    // Guardar ID e dados em variavel local
    const filamentId = selectedFilamentId;
    const filament = filaments.find(f => f.id === filamentId);

    if (!filament) {
        showToast('Filamento nao encontrado', 'error');
        return;
    }

    // Verificar se tem estoque suficiente
    const currentWeightGrams = (parseFloat(filament.weight) || 0) * 1000;
    if (amount > currentWeightGrams) {
        showToast(`Estoque insuficiente! Disponivel: ${currentWeightGrams.toFixed(0)}g`, 'error');
        return;
    }

    // Fechar modal e limpar input
    closeCardActionsModal();
    inputElement.value = '';

    try {
        showLoading('Deduzindo quantidade do estoque...');

        // Usar increment() com valor NEGATIVO para deducao atomica
        const amountInKg = amount / 1000;
        await db.collection('filaments').doc(filamentId).update({
            weight: firebase.firestore.FieldValue.increment(-amountInKg),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast(`${amount.toFixed(0)}g deduzidos do estoque com sucesso!`, 'success');
    } catch (error) {
        logger.error('Erro ao deduzir:', error);
        showToast('Erro ao deduzir do estoque', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// EQUIPMENT (INVENTÁRIO) FUNCTIONS
// ===========================

// Alternar entre seções (Filamentos / Equipamentos)
function switchSection(section) {
    // Atualizar seletor no header
    document.querySelectorAll('.selector-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });

    // Atualizar seções
    document.querySelectorAll('.inventory-section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}-section`).classList.add('active');
}

// Carregar equipamentos do Firebase
function loadEquipment() {
    db.collection('equipment')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            equipment = [];
            snapshot.forEach(doc => {
                equipment.push({ id: doc.id, ...doc.data() });
            });
            renderEquipment();
            updateEquipmentStats();
        }, error => {
            logger.error('Erro ao carregar equipamentos:', error);
        });
}

// Flag para garantir que event delegation do equipment seja configurado apenas uma vez
let equipmentGridEventDelegationSetup = false;

// Renderizar grid de equipamentos
function renderEquipment() {
    const grid = document.getElementById('equipmentGrid');
    const emptyState = document.getElementById('equipmentEmptyState');

    if (!grid || !emptyState) return;

    // Configurar event delegation UMA VEZ
    if (!equipmentGridEventDelegationSetup) {
        setupEquipmentGridEventDelegation(grid);
        equipmentGridEventDelegationSetup = true;
    }

    if (equipment.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    // Aplicar ordenação
    const sortedEquipment = getSortedEquipment();

    emptyState.style.display = 'none';
    grid.innerHTML = sortedEquipment.map(item => createEquipmentCard(item)).join('');
}

/**
 * Configura event delegation no grid de equipamentos
 * Substitui onclick inline nos cards
 */
function setupEquipmentGridEventDelegation(grid) {
    if (!grid) return;

    grid.addEventListener('click', function(e) {
        const card = e.target.closest('.equipment-card');
        if (!card) return;

        const id = card.getAttribute('data-equipment-id');
        if (id) {
            openEquipmentActionsModal(id);
        }
    });

    // Handler para imagens carregadas
    grid.addEventListener('load', function(e) {
        if (e.target.tagName === 'IMG' && e.target.classList.contains('equipment-image')) {
            const container = e.target.closest('.equipment-image-container');
            if (container) {
                container.classList.remove('loading');
                container.classList.add('loaded');
            }
        }
    }, true);

    grid.addEventListener('error', function(e) {
        if (e.target.tagName === 'IMG' && e.target.classList.contains('equipment-image')) {
            const container = e.target.closest('.equipment-image-container');
            if (container) {
                container.classList.remove('loading');
                container.classList.add('loaded');
            }
        }
    }, true);

    logger.log('Event delegation configurado para equipamentos');
}

// Ordenar equipamentos conforme critério selecionado
function getSortedEquipment() {
    const sorted = [...equipment];

    switch (equipmentSortOrder) {
        case 'price-desc':
            sorted.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
            break;
        case 'price-asc':
            sorted.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
            break;
        case 'name-asc':
            sorted.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR'));
            break;
        case 'name-desc':
            sorted.sort((a, b) => (b.name || '').localeCompare(a.name || '', 'pt-BR'));
            break;
        case 'date-desc':
            sorted.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });
            break;
        case 'date-asc':
            sorted.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateA - dateB;
            });
            break;
        default:
            sorted.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
    }

    return sorted;
}

// Mudar ordenação dos equipamentos
function sortEquipment(sortOrder) {
    equipmentSortOrder = sortOrder;
    renderEquipment();
}

// Criar HTML do card de equipamento
function createEquipmentCard(item) {
    // SEGURANCA: Escapar dados de usuario
    const safeName = escapeHtml(item.name || '');
    const safeBrand = escapeHtml(item.brand || '');
    const safeNotes = escapeHtml(item.notes || '');
    const safeId = escapeHtml(item.id);

    const imageHtml = item.imageUrl
        ? `<img src="${item.imageUrl}" class="equipment-image" alt="${safeName}" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\\'fas fa-tools equipment-image-placeholder\\'></i>';">`
        : `<i class="fas fa-tools equipment-image-placeholder"></i>`;

    const notesHtml = safeNotes
        ? `<div class="equipment-notes">${safeNotes}</div>`
        : '';

    // Data de aquisição ou aviso
    let acquisitionHtml = '';
    if (item.acquisitionMonth && item.acquisitionYear) {
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const monthIndex = parseInt(item.acquisitionMonth) - 1;
        const monthName = monthNames[monthIndex] || item.acquisitionMonth;
        acquisitionHtml = `<div class="equipment-acquisition"><i class="fas fa-calendar-alt"></i> ${escapeHtml(monthName)}/${escapeHtml(item.acquisitionYear)}</div>`;
    } else {
        acquisitionHtml = `<div class="equipment-acquisition-warning"><i class="fas fa-exclamation-circle"></i> Preencher data de aquisicao</div>`;
    }

    // Selo de status (operacional ou reparo)
    const status = item.status || 'operational';
    const statusIcon = status === 'operational' ? 'fa-check-circle' : 'fa-tools';
    const statusText = status === 'operational' ? 'Operacional' : 'Reparo';
    const statusBadge = `<div class="equipment-status-badge ${status}"><i class="fas ${statusIcon}"></i> ${statusText}</div>`;

    const hasImage = !!item.imageUrl;
    // SEGURANCA: Usar data-equipment-id ao inves de onclick inline
    return `
        <div class="equipment-card" data-equipment-id="${safeId}">
            ${statusBadge}
            <div class="equipment-image-container ${hasImage ? 'loading' : ''}" id="equipment-img-${safeId}">
                ${imageHtml}
            </div>
            <div class="equipment-info">
                <div class="equipment-name">${safeName}</div>
                <div class="equipment-brand"><i class="fas fa-copyright"></i> ${safeBrand}</div>
                ${acquisitionHtml}
                <div class="equipment-price">R$ ${formatMoney(item.price)}</div>
                ${notesHtml}
            </div>
        </div>
    `;
}

// Atualizar estatísticas de equipamentos (Total Investido)
function updateEquipmentStats() {
    const total = equipment.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
    const countEl = document.getElementById('equipmentCount');
    const totalEl = document.getElementById('totalInvested');

    if (countEl) countEl.textContent = equipment.length;
    if (totalEl) totalEl.textContent = `R$ ${formatMoney(total)}`;
}

// Formatar valor monetário
function formatMoney(value) {
    return parseFloat(value || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Selecionar status do equipamento (operacional ou reparo)
function selectEquipmentStatus(status) {
    // Atualizar botões visuais
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const selectedBtn = document.querySelector(`.status-btn[data-status="${status}"]`);
    if (selectedBtn) selectedBtn.classList.add('active');

    // Atualizar valor do input hidden
    const statusInput = document.getElementById('equipmentStatus');
    if (statusInput) statusInput.value = status;
}

// Preencher o select de anos de aquisição
function populateAcquisitionYears() {
    const yearSelect = document.getElementById('equipmentAcquisitionYear');
    if (!yearSelect) return;

    // Manter apenas a primeira opção (placeholder)
    yearSelect.innerHTML = '<option value="">Ano</option>';

    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= 2015; year--) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    }
}

// Abrir modal para adicionar equipamento
function openAddEquipmentModal() {
    try {
        editingEquipmentId = null;
        selectedEquipmentImage = null;

        const modalTitle = document.getElementById('equipmentModalTitle');
        const equipmentId = document.getElementById('equipmentId');
        const equipmentName = document.getElementById('equipmentName');
        const equipmentBrand = document.getElementById('equipmentBrand');
        const equipmentPrice = document.getElementById('equipmentPrice');
        const equipmentNotes = document.getElementById('equipmentNotes');
        const equipmentMonth = document.getElementById('equipmentAcquisitionMonth');
        const equipmentYear = document.getElementById('equipmentAcquisitionYear');
        const modal = document.getElementById('equipmentModal');

        if (modalTitle) modalTitle.innerHTML = '<i class="fas fa-plus"></i> Adicionar Equipamento';
        if (equipmentId) equipmentId.value = '';
        if (equipmentName) equipmentName.value = '';
        if (equipmentBrand) equipmentBrand.value = '';
        if (equipmentPrice) equipmentPrice.value = '';
        if (equipmentNotes) equipmentNotes.value = '';

        // Preencher anos e resetar campos de data
        populateAcquisitionYears();

        // Resetar dropdowns customizados (precisa disparar evento change para atualizar a UI)
        if (equipmentMonth) {
            equipmentMonth.selectedIndex = 0;
            equipmentMonth.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (equipmentYear) {
            equipmentYear.selectedIndex = 0;
            equipmentYear.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Resetar área de upload (mostrar placeholder, esconder preview)
        const placeholder = document.getElementById('equipmentUploadPlaceholder');
        const preview = document.getElementById('equipmentImagePreview');
        const fileInput = document.getElementById('equipmentImage');

        if (placeholder) placeholder.style.display = 'block';
        if (preview) {
            preview.style.display = 'none';
            preview.src = '';
        }
        if (fileInput) fileInput.value = '';

        // Resetar status para operacional (padrão)
        selectEquipmentStatus('operational');

        if (modal) {
            modal.classList.add('active');
        }
    } catch (error) {
        logger.error('Erro ao abrir modal de equipamento:', error);
    }
}

// Abrir modal para editar equipamento
function openEditEquipmentModal(id) {
    const item = equipment.find(e => e.id === id);
    if (!item) return;

    editingEquipmentId = id;
    selectedEquipmentImage = null;

    document.getElementById('equipmentModalTitle').innerHTML = '<i class="fas fa-edit"></i> Editar Equipamento';
    document.getElementById('equipmentId').value = id;
    document.getElementById('equipmentName').value = item.name || '';
    document.getElementById('equipmentBrand').value = item.brand || '';
    document.getElementById('equipmentPrice').value = item.price || '';
    document.getElementById('equipmentNotes').value = item.notes || '';

    // Preencher anos e definir valores de data de aquisição
    populateAcquisitionYears();
    const monthSelect = document.getElementById('equipmentAcquisitionMonth');
    const yearSelect = document.getElementById('equipmentAcquisitionYear');

    // Definir valores e disparar eventos para sincronizar dropdowns customizados
    // monthSelect é estático, pode definir diretamente
    if (monthSelect) {
        monthSelect.value = item.acquisitionMonth || '';
        monthSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // yearSelect é dinâmico (populado por populateAcquisitionYears)
    // Usar setTimeout para aguardar MutationObserver processar novas opções
    if (yearSelect) {
        setTimeout(() => {
            yearSelect.value = item.acquisitionYear || '';
            yearSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }, 0);
    }

    // Mostrar imagem existente ou placeholder
    const placeholder = document.getElementById('equipmentUploadPlaceholder');
    const preview = document.getElementById('equipmentImagePreview');
    const fileInput = document.getElementById('equipmentImage');

    if (fileInput) fileInput.value = '';

    if (item.imageUrl) {
        if (placeholder) placeholder.style.display = 'none';
        if (preview) {
            preview.src = item.imageUrl;
            preview.style.display = 'block';
        }
    } else {
        if (placeholder) placeholder.style.display = 'block';
        if (preview) {
            preview.style.display = 'none';
            preview.src = '';
        }
    }

    // Carregar status do equipamento (operacional ou reparo)
    selectEquipmentStatus(item.status || 'operational');

    document.getElementById('equipmentModal').classList.add('active');
}

// Fechar modal de equipamento
function closeEquipmentModal() {
    document.getElementById('equipmentModal').classList.remove('active');
    editingEquipmentId = null;
    selectedEquipmentImage = null;
}

// Salvar equipamento (criar ou atualizar)
async function saveEquipment(event) {
    event.preventDefault();

    const name = document.getElementById('equipmentName').value.trim();
    const brand = document.getElementById('equipmentBrand').value.trim();
    const price = parseFloat(document.getElementById('equipmentPrice').value) || 0;
    const notes = document.getElementById('equipmentNotes').value.trim();
    const acquisitionMonth = document.getElementById('equipmentAcquisitionMonth').value;
    const acquisitionYear = document.getElementById('equipmentAcquisitionYear').value;
    const status = document.getElementById('equipmentStatus').value || 'operational';

    if (!name || !brand) {
        showToast('Preencha nome e marca do equipamento', 'error');
        return;
    }

    if (!acquisitionMonth || !acquisitionYear) {
        showToast('Preencha o mês e ano de aquisição', 'error');
        return;
    }

    try {
        showLoading(editingEquipmentId ? 'Atualizando equipamento...' : 'Salvando equipamento...');

        let imageUrl = null;

        // Se tem nova imagem selecionada, fazer upload
        if (selectedEquipmentImage) {
            // Garantir custom claim admin antes do upload ao Storage
            await ensureAdminClaim();

            const timestamp = Date.now();
            // SEGURANCA: Sanitizar nome do arquivo antes do upload
            const safeName = sanitizeFileName(selectedEquipmentImage.name);
            const fileName = `equipment_${timestamp}_${safeName}`;
            const storageRef = storage.ref().child(`equipment/${fileName}`);
            await storageRef.put(selectedEquipmentImage);
            imageUrl = await storageRef.getDownloadURL();
        }

        const equipmentData = {
            name,
            brand,
            price,
            notes,
            acquisitionMonth,
            acquisitionYear,
            status,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (imageUrl) {
            equipmentData.imageUrl = imageUrl;
        }

        if (editingEquipmentId) {
            // Atualizar existente
            await db.collection('equipment').doc(editingEquipmentId).update(equipmentData);
            showToast('Equipamento atualizado com sucesso!', 'success');
        } else {
            // Criar novo
            equipmentData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('equipment').add(equipmentData);
            showToast('Equipamento adicionado com sucesso!', 'success');
        }

        closeEquipmentModal();
    } catch (error) {
        logger.error('Erro ao salvar equipamento:', error);
        showToast('Erro ao salvar equipamento', 'error');
    } finally {
        hideLoading();
    }
}

// Excluir equipamento
async function deleteEquipment(id) {
    if (!confirm('Tem certeza que deseja excluir este equipamento?')) return;

    try {
        showLoading('Excluindo equipamento...');
        await db.collection('equipment').doc(id).delete();
        showToast('Equipamento excluído com sucesso!', 'success');
        closeEquipmentActionsModal();
    } catch (error) {
        logger.error('Erro ao excluir equipamento:', error);
        showToast('Erro ao excluir equipamento', 'error');
    } finally {
        hideLoading();
    }
}

// Abrir modal de ações do equipamento
function openEquipmentActionsModal(id) {
    selectedEquipmentId = id;
    const item = equipment.find(e => e.id === id);
    if (!item) return;

    // SEGURANCA: Escapar dados de usuario
    const safeName = escapeHtml(item.name || '');
    const safeBrand = escapeHtml(item.brand || '');

    // Atualizar resumo do card
    const summaryEl = document.querySelector('#equipmentActionsModal .card-info-summary');
    if (summaryEl) {
        const imageHtml = item.imageUrl
            ? `<img src="${item.imageUrl}" class="summary-image" alt="${safeName}" onerror="this.onerror=null; this.outerHTML='<div class=\\'summary-image\\' style=\\'display: flex; align-items: center; justify-content: center;\\'><i class=\\'fas fa-tools\\' style=\\'font-size: 1.5rem; color: var(--text-secondary);\\'></i></div>';">`
            : `<div class="summary-image" style="display: flex; align-items: center; justify-content: center;"><i class="fas fa-tools" style="font-size: 1.5rem; color: var(--text-secondary);"></i></div>`;

        summaryEl.innerHTML = `
            ${imageHtml}
            <div class="summary-info">
                <h3>${safeName}</h3>
                <p><i class="fas fa-copyright"></i> ${safeBrand}</p>
                <p style="color: var(--neon-green); font-family: 'Orbitron', monospace; font-weight: bold;">R$ ${formatMoney(item.price)}</p>
            </div>
        `;
    }

    document.getElementById('equipmentActionsModal').classList.add('active');
}

// Fechar modal de ações do equipamento
function closeEquipmentActionsModal() {
    document.getElementById('equipmentActionsModal').classList.remove('active');
    selectedEquipmentId = null;
}

// Handlers para ações do modal de equipamento
function handleEditEquipment() {
    if (!selectedEquipmentId) return;
    const id = selectedEquipmentId;
    closeEquipmentActionsModal();
    openEditEquipmentModal(id);
}

function handleDeleteEquipment() {
    if (!selectedEquipmentId) return;
    const id = selectedEquipmentId;
    closeEquipmentActionsModal();
    deleteEquipment(id);
}

// Preview de imagem do equipamento
// SEGURANCA: Valida magic bytes, bloqueia SVG
async function previewEquipmentImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    // SEGURANCA: Bloquear SVG
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
        showToast('SVG nao permitido por seguranca. Use PNG, JPEG ou WebP.', 'error');
        return;
    }

    // Validar tipo
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
        showToast('Formato invalido! Use PNG, JPEG ou WebP.', 'error');
        return;
    }

    // SEGURANCA: Validar magic bytes
    const isValidImage = await validateImageMagicBytes(file);
    if (!isValidImage) {
        showToast('Arquivo invalido. O conteudo nao corresponde a uma imagem.', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showToast('Imagem muito grande (max 5MB)', 'error');
        return;
    }

    selectedEquipmentImage = file;
    const reader = new FileReader();
    reader.onload = function(e) {
        const placeholder = document.getElementById('equipmentUploadPlaceholder');
        const preview = document.getElementById('equipmentImagePreview');

        if (placeholder) placeholder.style.display = 'none';
        if (preview) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        }
    };
    reader.readAsDataURL(file);
}

// ===========================
// SHIMMER IMAGE LOAD HANDLERS
// ===========================
function handleFilamentImageLoaded(filamentId) {
    const container = document.getElementById(`filament-img-${filamentId}`);
    if (container) {
        container.classList.remove('loading');
        container.classList.add('loaded');
    }
}

function handleEquipmentImageLoaded(equipmentId) {
    const container = document.getElementById(`equipment-img-${equipmentId}`);
    if (container) {
        container.classList.remove('loading');
        container.classList.add('loaded');
    }
}

// ===========================
// GLOBAL FUNCTIONS FOR ONCLICK
// ===========================
window.handleFilamentImageLoaded = handleFilamentImageLoaded;
window.handleEquipmentImageLoaded = handleEquipmentImageLoaded;
window.signInWithGoogle = signInWithGoogle;
window.signOut = signOut;
window.openAddFilamentModal = openAddFilamentModal;
window.closeFilamentModal = closeFilamentModal;
window.saveFilament = saveFilament;
window.editFilament = editFilament;
window.deleteFilament = deleteFilament;
window.filterByType = filterByType;
window.filterByStock = filterByStock;
window.filterByBrand = filterByBrand;
window.clearBrandFilter = clearBrandFilter;
window.filterByStatCard = filterByStatCard;
window.previewImage = previewImage;
window.openCardActionsModal = openCardActionsModal;
window.closeCardActionsModal = closeCardActionsModal;
window.handleRestock1kg = handleRestock1kg;
window.handleAddFractional = handleAddFractional;
window.handleEditFilament = handleEditFilament;
window.handleDeleteFilament = handleDeleteFilament;
window.handleQuickDeduction = handleQuickDeduction;

// Equipment (Inventário)
window.switchSection = switchSection;
window.openAddEquipmentModal = openAddEquipmentModal;
window.openEditEquipmentModal = openEditEquipmentModal;
window.closeEquipmentModal = closeEquipmentModal;
window.saveEquipment = saveEquipment;
window.deleteEquipment = deleteEquipment;
window.openEquipmentActionsModal = openEquipmentActionsModal;
window.closeEquipmentActionsModal = closeEquipmentActionsModal;
window.handleEditEquipment = handleEditEquipment;
window.handleDeleteEquipment = handleDeleteEquipment;
window.previewEquipmentImage = previewEquipmentImage;
window.sortEquipment = sortEquipment;
window.selectEquipmentStatus = selectEquipmentStatus;
