/*
==================================================
ARQUIVO: financas/finance-core.js
MÓDULO: Core - Configuração, Autenticação e Estado Global
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 3.1 - Security Hardening
IMPORTANTE: NÃO REMOVER ESTE CABEÇALHO DE IDENTIFICAÇÃO
==================================================
*/

// ===========================
// SECURITY UTILITIES
// ===========================

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

// Exportar funcoes de seguranca globalmente
window.escapeHtml = escapeHtml;
window.generateSecureId = generateSecureId;
// Logger centralizado ja esta em window.logger via /shared/firestore-logger.js

// ===========================
// FIREBASE CONFIGURATION (carregado de ENV_CONFIG)
// SEGURANCA: SEM fallback hardcoded - fail-secure
// ===========================

// Validar que ENV_CONFIG existe e tem todas as chaves necessarias
function validateEnvConfig() {
    const required = [
        'FIREBASE_API_KEY',
        'FIREBASE_AUTH_DOMAIN',
        'FIREBASE_PROJECT_ID',
        'FIREBASE_STORAGE_BUCKET',
        'FIREBASE_MESSAGING_SENDER_ID',
        'FIREBASE_APP_ID'
    ];

    if (!window.ENV_CONFIG) {
        throw new Error('ENV_CONFIG nao encontrado. Verifique se env-config.js foi carregado.');
    }

    const missing = required.filter(key => !window.ENV_CONFIG[key]);
    if (missing.length > 0) {
        throw new Error(`ENV_CONFIG incompleto. Chaves faltando: ${missing.join(', ')}`);
    }

    return true;
}

// SEGURANCA: Validar antes de usar
let firebaseConfig;
try {
    validateEnvConfig();
    firebaseConfig = {
        apiKey: window.ENV_CONFIG.FIREBASE_API_KEY,
        authDomain: window.ENV_CONFIG.FIREBASE_AUTH_DOMAIN,
        projectId: window.ENV_CONFIG.FIREBASE_PROJECT_ID,
        storageBucket: window.ENV_CONFIG.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: window.ENV_CONFIG.FIREBASE_MESSAGING_SENDER_ID,
        appId: window.ENV_CONFIG.FIREBASE_APP_ID
    };
} catch (error) {
    logger.error('Erro de configuracao:', error);
    alert('Erro de configuracao do sistema. Contate o administrador.');
    throw error; // Impedir execucao com config invalida
}

// ===========================
// ADMIN USERS (tem acesso a conta da empresa)
// SEGURANCA: Carregado EXCLUSIVAMENTE do Firestore - sem fallback hardcoded
// ===========================
let ADMIN_EMAILS = [];
let adminsLoadFailed = false;

// ID fixo da conta da empresa (DEVE ser o mesmo do painel de servicos)
// SEGURANCA: Sem fallback - se nao existir, funcionalidade de empresa fica desativada
const COMPANY_USER_ID = window.ENV_CONFIG?.COMPANY_USER_ID || '';
const COMPANY_EMAIL = window.ENV_CONFIG?.COMPANY_EMAIL || '';

// Carrega admins do Firestore (OBRIGATORIO antes de verificar autorizacao)
async function loadAdminEmails(db) {
    try {
        // Usar ENV_CONFIG.loadAdmins
        if (window.ENV_CONFIG?.loadAdmins) {
            const admins = await window.ENV_CONFIG.loadAdmins(db);
            if (admins && admins.length > 0) {
                ADMIN_EMAILS = admins.map(a => a.email);
                logger.log('[finance-core] Admins carregados:', ADMIN_EMAILS.length);
                return ADMIN_EMAILS;
            } else {
                logger.error('[finance-core] ERRO: Nenhum admin retornado do Firestore');
                adminsLoadFailed = true;
                return [];
            }
        }

        // Fallback: carregar diretamente do Firestore (sem lista hardcoded)
        const snapshot = await db.collection('admins')
            .where('active', '==', true)
            .get();

        if (!snapshot.empty) {
            ADMIN_EMAILS = snapshot.docs.map(doc => doc.data().email);
            logger.log('[finance-core] Admins carregados do Firestore:', ADMIN_EMAILS.length);
            return ADMIN_EMAILS;
        } else {
            logger.error('[finance-core] ERRO: Nenhum admin encontrado no Firestore');
            adminsLoadFailed = true;
            return [];
        }
    } catch (error) {
        logger.error('[finance-core] Erro ao carregar admins:', error);
        adminsLoadFailed = true;
        return [];
    }
}

// Verifica se o usuario atual e admin
// SEGURANCA: Retorna false se admins nao foram carregados corretamente
function isAdminUser(email) {
    if (adminsLoadFailed || ADMIN_EMAILS.length === 0) {
        logger.warn('[finance-core] Verificacao de admin antes de carregar admins');
        return false;
    }
    // Verificar primeiro no ENV_CONFIG (mais atualizado)
    if (window.ENV_CONFIG?.isAdmin && window.ENV_CONFIG._adminsLoaded) {
        return window.ENV_CONFIG.isAdmin(email);
    }
    return ADMIN_EMAILS.includes(email);
}

// ===========================
// CATEGORIES
// ===========================
const INCOME_CATEGORIES = [
    'Salário',
    'Freelance',
    'Vendas',
    'Investimentos',
    'Bonificação',
    'Outros'
];

const EXPENSE_CATEGORIES = [
    'Alimentação',
    'Supermercado',
    'Restaurantes',
    'Transporte',
    'Combustível',
    'Uber/Taxi',
    'Moradia',
    'Aluguel',
    'Condomínio',
    'Água',
    'Luz',
    'Internet',
    'Gás',
    'IPTU',
    'Saúde',
    'Plano de Saúde',
    'Farmácia',
    'Consultas',
    'Educação',
    'Cursos',
    'Livros',
    'Material Escolar',
    'Lazer',
    'Streaming',
    'Cinema',
    'Viagens',
    'Compras',
    'Roupas',
    'Eletrônicos',
    'Casa e Decoração',
    'Beleza e Cuidados',
    'Pet',
    'Serviços',
    'Academia',
    'Seguros',
    'Investimentos',
    'Poupança',
    'Reserva de Emergência',
    'Previdência',
    'Presentes',
    'Doações',
    'Impostos',
    'Outros'
];

// ===========================
// CATEGORIAS QUE CONTAM COMO ECONOMIA/RESERVA
// Transacoes nessas categorias sao consideradas "dinheiro guardado"
// ===========================
const SAVINGS_CATEGORIES = [
    'Investimentos',
    'Poupança',
    'Reserva de Emergência',
    'Previdência'
];

// ===========================
// CATEGORIAS COM ICONES (para dropdown customizado)
// ===========================
const CARD_EXPENSE_CATEGORIES = [
    { name: 'Alimentacao', icon: 'fa-utensils' },
    { name: 'Supermercado', icon: 'fa-shopping-cart' },
    { name: 'Restaurantes', icon: 'fa-hamburger' },
    { name: 'iFood/Delivery', icon: 'fa-motorcycle' },
    { name: 'Transporte', icon: 'fa-car' },
    { name: 'Combustivel', icon: 'fa-gas-pump' },
    { name: 'Uber/Taxi', icon: 'fa-taxi' },
    { name: 'Estacionamento', icon: 'fa-parking' },
    { name: 'Compras', icon: 'fa-shopping-bag' },
    { name: 'Roupas', icon: 'fa-tshirt' },
    { name: 'Eletronicos', icon: 'fa-laptop' },
    { name: 'Casa e Decoracao', icon: 'fa-couch' },
    { name: 'Mercado', icon: 'fa-store' },
    { name: 'Saude', icon: 'fa-heartbeat' },
    { name: 'Farmacia', icon: 'fa-pills' },
    { name: 'Consultas', icon: 'fa-stethoscope' },
    { name: 'Plano de Saude', icon: 'fa-hospital' },
    { name: 'Educacao', icon: 'fa-graduation-cap' },
    { name: 'Cursos', icon: 'fa-book-open' },
    { name: 'Livros', icon: 'fa-book' },
    { name: 'Lazer', icon: 'fa-gamepad' },
    { name: 'Streaming', icon: 'fa-tv' },
    { name: 'Cinema', icon: 'fa-film' },
    { name: 'Jogos', icon: 'fa-dice' },
    { name: 'Viagens', icon: 'fa-plane' },
    { name: 'Hospedagem', icon: 'fa-hotel' },
    { name: 'Academia', icon: 'fa-dumbbell' },
    { name: 'Beleza', icon: 'fa-spa' },
    { name: 'Barbearia', icon: 'fa-cut' },
    { name: 'Pet', icon: 'fa-paw' },
    { name: 'Assinaturas', icon: 'fa-repeat' },
    { name: 'Servicos', icon: 'fa-tools' },
    { name: 'Manutencao', icon: 'fa-wrench' },
    { name: 'Presentes', icon: 'fa-gift' },
    { name: 'Impostos', icon: 'fa-file-invoice-dollar' },
    { name: 'Contas', icon: 'fa-file-alt' },
    { name: 'Internet', icon: 'fa-wifi' },
    { name: 'Celular', icon: 'fa-mobile-alt' },
    { name: 'Seguros', icon: 'fa-shield-alt' },
    { name: 'Investimentos', icon: 'fa-chart-line' },
    { name: 'Poupanca', icon: 'fa-piggy-bank' },
    { name: 'Reserva de Emergencia', icon: 'fa-life-ring' },
    { name: 'Previdencia', icon: 'fa-umbrella-beach' },
    { name: 'Outros', icon: 'fa-ellipsis-h' }
];

// ===========================
// FUNCOES DE FREQUENCIA DE USO
// ===========================

/**
 * Incrementa o contador de uso de uma categoria
 * @param {string} category - Nome da categoria
 */
function incrementCategoryUsage(category) {
    const usage = JSON.parse(localStorage.getItem('categoryUsageCount') || '{}');
    usage[category] = (usage[category] || 0) + 1;
    localStorage.setItem('categoryUsageCount', JSON.stringify(usage));
}

/**
 * Retorna as categorias ordenadas por frequencia de uso
 * @returns {Array} Categorias ordenadas
 */
function getCategoriesSortedByUsage() {
    const usage = JSON.parse(localStorage.getItem('categoryUsageCount') || '{}');
    // Criar copia para nao modificar o original
    const sorted = [...CARD_EXPENSE_CATEGORIES].sort((a, b) => {
        return (usage[b.name] || 0) - (usage[a.name] || 0);
    });
    return sorted;
}

/**
 * Popula um dropdown de categoria com icones e ordenacao por frequencia
 * @param {HTMLSelectElement} selectElement - Elemento select a popular
 * @param {string} selectedValue - Valor pre-selecionado (opcional)
 */
function populateCategoryDropdown(selectElement, selectedValue = '') {
    const categories = getCategoriesSortedByUsage();

    selectElement.innerHTML = '<option value="">Selecione uma categoria</option>';

    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat.name;
        option.textContent = cat.name;
        option.dataset.icon = cat.icon;

        if (cat.name === selectedValue) {
            option.selected = true;
        }

        selectElement.appendChild(option);
    });

    // Se o select ja foi customizado, forcar atualizacao
    if (selectElement.dataset.customized === 'true') {
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

// Exportar funcoes globalmente
window.incrementCategoryUsage = incrementCategoryUsage;
window.getCategoriesSortedByUsage = getCategoriesSortedByUsage;
window.populateCategoryDropdown = populateCategoryDropdown;
window.CARD_EXPENSE_CATEGORIES = CARD_EXPENSE_CATEGORIES;
window.SAVINGS_CATEGORIES = SAVINGS_CATEGORIES;

// ===========================
// GLOBAL STATE (Encapsulado)
// ===========================

/**
 * Estado centralizado da aplicação de finanças
 * Agrupa todas as variáveis de estado em um único objeto organizado
 */
const FinanceState = {
    // Firebase instances
    firebase: {
        db: null,
        auth: null
    },

    // Dados do usuário
    user: {
        current: null,
        activeId: null,
        activeEmail: null
    },

    // Coleções de dados (carregadas do Firestore)
    data: {
        transactions: [],
        subscriptions: [],
        installments: [],
        projections: [],
        creditCards: [],
        cardExpenses: [],
        creditCardPayments: [],
        investments: [],
        services: []
    },

    // Estado da UI (formulários)
    ui: {
        currentTransactionType: 'income',
        currentPaymentMethod: 'debit',
        currentProjectionType: 'income',
        editingTransactionId: null,
        editingSubscriptionId: null,
        editingInstallmentId: null,
        editingCardId: null,
        editingProjectionId: null,
        editingInvestmentId: null
    },

    // Configurações do usuário
    settings: {
        savingsGoal: 2000,
        expenseLimit: 3000,
        cutoffDate: null
    },

    // Instâncias dos gráficos ApexCharts
    charts: {
        cashFlow: null,
        category: null,
        comparison: null,
        topCategories: null,
        weeklyTrend: null,
        savingsGoal: null,
        expenseLimit: null,
        paymentMethod: null
    },

    // Método para resetar estado (útil ao trocar de conta)
    reset() {
        this.data.transactions = [];
        this.data.subscriptions = [];
        this.data.installments = [];
        this.data.projections = [];
        this.data.creditCards = [];
        this.data.cardExpenses = [];
        this.data.creditCardPayments = [];
        this.data.investments = [];
        this.data.services = [];
        this.settings = { savingsGoal: 2000, expenseLimit: 3000, cutoffDate: null };
    }
};

// Aliases para compatibilidade com código existente
// CORRIGIDO: Usar getters/setters para manter sincronização com FinanceState
// (permite migração gradual sem quebrar funcionalidades)
let db, auth;
let currentUser = null;

// Arrays de dados - usar getters para sempre retornar referência atual
// Isso garante que modificações em FinanceState.data sejam refletidas
Object.defineProperty(window, 'transactions', {
    get: () => FinanceState.data.transactions,
    set: (v) => { FinanceState.data.transactions = v; }
});
Object.defineProperty(window, 'subscriptions', {
    get: () => FinanceState.data.subscriptions,
    set: (v) => { FinanceState.data.subscriptions = v; }
});
Object.defineProperty(window, 'installments', {
    get: () => FinanceState.data.installments,
    set: (v) => { FinanceState.data.installments = v; }
});
Object.defineProperty(window, 'projections', {
    get: () => FinanceState.data.projections,
    set: (v) => { FinanceState.data.projections = v; }
});
Object.defineProperty(window, 'creditCards', {
    get: () => FinanceState.data.creditCards,
    set: (v) => { FinanceState.data.creditCards = v; }
});
Object.defineProperty(window, 'cardExpenses', {
    get: () => FinanceState.data.cardExpenses,
    set: (v) => { FinanceState.data.cardExpenses = v; }
});
Object.defineProperty(window, 'creditCardPayments', {
    get: () => FinanceState.data.creditCardPayments,
    set: (v) => { FinanceState.data.creditCardPayments = v; }
});
Object.defineProperty(window, 'investments', {
    get: () => FinanceState.data.investments,
    set: (v) => { FinanceState.data.investments = v; }
});
Object.defineProperty(window, 'services', {
    get: () => FinanceState.data.services,
    set: (v) => { FinanceState.data.services = v; }
});
Object.defineProperty(window, 'userSettings', {
    get: () => FinanceState.settings,
    set: (v) => { FinanceState.settings = v; }
});

// Variáveis de estado (não precisam de getter)
let currentTransactionType = 'income';
let currentPaymentMethod = 'debit';
let editingTransactionId = null;
let editingSubscriptionId = null;
let editingInstallmentId = null;
let editingCardId = null;
let editingProjectionId = null;
let editingInvestmentId = null;
let currentProjectionType = 'income';
let activeUserId = null;
let activeUserEmail = null;
// COMPANY_EMAIL agora e carregado do ENV_CONFIG (definido acima)

// ApexCharts instances (aliases)
let cashFlowChart = null;
let categoryChart = null;
let comparisonChart = null;
let topCategoriesChart = null;
let weeklyTrendChart = null;
let savingsGoalChart = null;
let expenseLimitChart = null;
let paymentMethodChart = null;

// ===========================
// FIREBASE INITIALIZATION
// ===========================
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
    logger.log('Firebase inicializado com sucesso');
} catch (error) {
    logger.error('Erro ao inicializar Firebase:', error);
    alert('Erro ao conectar com o servidor. Recarregue a página.');
}

// ===========================
// AUTHENTICATION
// ===========================

// Flag para rastrear se todos os scripts carregaram
let scriptsLoaded = false;
let pendingAuthUser = null;

// Funcao para processar usuario autenticado (chamada quando scripts estao prontos)
async function processAuthenticatedUser(user) {
    currentUser = user;

    // Carregar admins do Firestore antes de verificar permissao
    await loadAdminEmails(db);

    hideLoading(); // IMPORTANTE: Esconde loading apos carregar admins

    if (isAdminUser(user.email)) {
        // Admin: mostrar modal de selecao (pessoal ou empresa)
        showAccountSelectionModal(user);
    } else {
        // Usuario comum: ir direto para conta pessoal
        logger.log('Usuario comum - acesso direto a conta pessoal');
        selectAccount('personal');
    }
}

// Funcao chamada por finance-data.js quando carrega
window.notifyScriptsLoaded = function() {
    scriptsLoaded = true;
    logger.log('Todos os scripts carregados');

    // Se havia um usuario pendente, processar agora
    if (pendingAuthUser) {
        logger.log('Processando usuario pendente:', pendingAuthUser.email);
        processAuthenticatedUser(pendingAuthUser);
        pendingAuthUser = null;
    }
};

auth.onAuthStateChanged(async (user) => {
    logger.log('Auth state changed:', user ? user.email : 'Nao autenticado');

    if (user) {
        if (scriptsLoaded) {
            // Scripts ja carregaram, processar imediatamente
            await processAuthenticatedUser(user);
        } else {
            // Scripts ainda nao carregaram, aguardar
            logger.log('Scripts ainda carregando, aguardando...');
            pendingAuthUser = user;
        }
    } else {
        hideLoading(); // IMPORTANTE: Sempre esconde o loading primeiro
        showLoginScreen();
    }
});

// 🔐 Autentica usuario via Google OAuth
function signInWithGoogle() {
    showLoading('Autenticando...');
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then(result => {
            const user = result.user;
            // SEGURANCA: Verificar se o email foi verificado
            if (!user.emailVerified) {
                logger.warn('[Auth] Email nao verificado:', user.email);
                auth.signOut();
                hideLoading();
                showToast('Seu email precisa ser verificado. Verifique sua caixa de entrada.', 'error');
                return;
            }
        })
        .catch(error => {
            hideLoading();
            logger.error('Erro no login:', error);
            showToast('Erro ao fazer login', 'error');
        });
}

// 🔐 Realiza logout do usuário
function signOut() {
    auth.signOut().then(() => {
        showToast('Logout realizado com sucesso', 'success');
        location.reload();
    });
}

// Exibe tela de login
function showLoginScreen() {
    document.getElementById('loginScreen').classList.add('active');
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('accessDeniedScreen')?.classList.remove('active');
    hideLoading(); // IMPORTANTE: Esconde loading na tela de login
}

// Exibe dashboard principal apos autenticacao
function showDashboard(user) {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('dashboard');
    const userName = document.getElementById('userName');
    const userPhoto = document.getElementById('userPhoto');

    if (loginScreen) loginScreen.classList.remove('active');
    if (dashboard) dashboard.classList.remove('hidden');
    if (userName) userName.textContent = user.displayName || 'Usuario';
    if (userPhoto) userPhoto.src = user.photoURL || 'https://via.placeholder.com/40';
}

// ===========================
// ACCOUNT SELECTION (Multi-User System)
// ===========================
// 🎨 Abre modal para seleção entre conta pessoal e empresarial
function showAccountSelectionModal(user) {
    // Verificar se existe preferência salva
    const savedAccountType = localStorage.getItem('selectedAccountType');

    if (savedAccountType) {
        // Usar conta salva automaticamente
        selectAccount(savedAccountType);
        return;
    }

    // Atualizar email pessoal no modal
    document.getElementById('personalAccountEmail').textContent = user.email;

    // Esconder login screen
    document.getElementById('loginScreen').classList.remove('active');

    // Mostrar modal de selecao
    document.getElementById('accountSelectionModal').classList.add('active');
}

// 🔐 Seleciona e carrega dados da conta escolhida (pessoal ou empresa)
async function selectAccount(accountType) {
    // Fechar modal de seleção se estiver aberto
    document.getElementById('accountSelectionModal').classList.remove('active');

    if (accountType === 'company') {
        // Verificar se é admin antes de permitir acesso à empresa
        if (!isAdminUser(currentUser.email)) {
            // Mostrar modal de acesso negado
            showAccessDeniedModal();
            return;
        }

        showLoading('Carregando dados...');

        // Usar o COMPANY_USER_ID fixo para garantir consistência com o painel de serviços
        activeUserId = COMPANY_USER_ID;
        activeUserEmail = COMPANY_EMAIL;
        logger.log('Usando UID da empresa (fixo):', activeUserId);

        // Garantir que o systemConfig esteja atualizado com o ID correto
        try {
            const configDoc = await db.collection('systemConfig').doc('companyAccount').get();

            if (!configDoc.exists || configDoc.data().userId !== COMPANY_USER_ID) {
                // Criar ou atualizar configuração com o ID correto
                logger.log('Atualizando systemConfig com COMPANY_USER_ID correto...');
                await db.collection('systemConfig').doc('companyAccount').set({
                    userId: COMPANY_USER_ID,
                    email: COMPANY_EMAIL,
                    displayName: 'ImaginaTech - Caixa Interno',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedBy: currentUser.email
                }, { merge: true });
            }
        } catch (error) {
            // Erro ao atualizar config não deve impedir o acesso
            logger.warn('Aviso: não foi possível atualizar systemConfig:', error);
        }
    } else {
        showLoading('Carregando dados...');
        // Acessar como conta pessoal
        activeUserId = currentUser.uid;
        activeUserEmail = currentUser.email;
        logger.log('Usando conta pessoal com UID:', activeUserId);
    }

    // Salvar preferência no localStorage
    localStorage.setItem('selectedAccountType', accountType);

    // Atualizar display da conta ativa
    updateAccountDisplay(accountType);

    // Mostrar dashboard e inicializar
    showDashboard(currentUser);
    initializeDashboard();
}

// 🔄 Alterna entre contas (pessoal/empresa)
function switchAccount() {
    // Parar listeners para evitar erros durante a troca
    if (typeof stopServicesListener === 'function') {
        stopServicesListener();
    }
    if (typeof stopTransactionsListener === 'function') {
        stopTransactionsListener();
    }

    // Limpar preferência salva
    localStorage.removeItem('selectedAccountType');

    // Esconder dashboard
    document.getElementById('dashboard').classList.add('hidden');

    // Mostrar modal de seleção novamente
    showAccountSelectionModal(currentUser);
}

// 🎨 Atualiza nome da conta exibida na interface
function updateAccountDisplay(accountType) {
    const userRole = document.getElementById('userRole');
    if (userRole) {
        if (accountType === 'company') {
            userRole.textContent = 'Caixa Interno da Empresa';
        } else {
            userRole.textContent = 'Conta Pessoal';
        }
    }
}

// Mostra tela de acesso negado (fullscreen)
function showAccessDeniedModal() {
    // Parar listeners para evitar erros de permissao
    if (typeof stopServicesListener === 'function') {
        stopServicesListener();
    }
    if (typeof stopTransactionsListener === 'function') {
        stopTransactionsListener();
    }

    // Atualizar email do usuario na tela
    const emailEl = document.getElementById('deniedUserEmail');
    if (emailEl && currentUser) {
        emailEl.textContent = currentUser.email;
    }

    // Esconder dashboard se estiver visivel
    document.getElementById('dashboard').classList.add('hidden');

    // Mostrar tela de acesso negado
    document.getElementById('accessDeniedScreen').classList.add('active');
}

// Fecha tela de acesso negado e volta para conta pessoal
function closeAccessDeniedModal() {
    // Fechar tela
    document.getElementById('accessDeniedScreen').classList.remove('active');

    // Voltar para conta pessoal
    selectAccount('personal');
}

// ===========================
// CENTRAL UPDATE FUNCTION
// ===========================
// 🔄 Atualiza todos os componentes da interface (KPIs e gráficos)
function updateAllDisplays() {
    logger.log('[updateAllDisplays] Atualizando todos os componentes...');

    // Atualizar KPIs
    if (typeof updateKPIs === 'function') {
        updateKPIs();
    }

    // Atualizar gráficos
    if (typeof updateCharts === 'function') {
        updateCharts();
    }

    logger.log('[updateAllDisplays] Todos os componentes atualizados!');
}

// ===========================
// UTILITY FUNCTIONS
// ===========================
// 🎨 Exibe overlay de carregamento
function showLoading(message = 'Carregando...') {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;

    const text = overlay.querySelector('.loading-text');
    if (text) text.textContent = message;
    overlay.style.display = 'flex';
}

// 🎨 Esconde overlay de carregamento
function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

// 🎨 Exibe notificação toast temporária (sucesso/erro/info)
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    const icon = toast.querySelector('.toast-icon');
    const messageEl = toast.querySelector('.toast-message');

    if (icon) {
        icon.className = 'toast-icon fas fa-' + (type === 'success' ? 'check-circle' : 'exclamation-circle');
    }

    if (messageEl) {
        messageEl.textContent = message;
    }

    toast.className = 'toast ' + type;
    toast.style.display = 'block';
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(100px)';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, 3000);
}

logger.log('[OK] Finance Core v3.1 - Loaded');
