/*
==================================================
ARQUIVO: financas/finance-core.js
MÓDULO: Core - Configuração, Autenticação e Estado Global
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 3.0 - Refatoração Modular
IMPORTANTE: NÃO REMOVER ESTE CABEÇALHO DE IDENTIFICAÇÃO
==================================================
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
// ADMIN USERS (têm acesso à conta da empresa)
// ===========================
const ADMIN_EMAILS = window.ENV_CONFIG?.AUTHORIZED_ADMINS?.map(a => a.email) || [
    '3d3printers@gmail.com',
    'netrindademarcus@gmail.com',
    'allanedg01@gmail.com',
    'quequell1010@gmail.com',
    'igor.butter@gmail.com'
];

// ID fixo da conta da empresa (DEVE ser o mesmo do painel de serviços)
const COMPANY_USER_ID = window.ENV_CONFIG?.COMPANY_USER_ID || 'BdmqXJFgMja4SY6DRXdf3dMyzaq1';

// Verifica se o usuário atual é admin
function isAdminUser(email) {
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
    'Presentes',
    'Doações',
    'Impostos',
    'Outros'
];

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
// (permite migração gradual sem quebrar funcionalidades)
let db, auth;
let currentUser = null;
let transactions = FinanceState.data.transactions;
let subscriptions = FinanceState.data.subscriptions;
let installments = FinanceState.data.installments;
let projections = FinanceState.data.projections;
let creditCards = FinanceState.data.creditCards;
let cardExpenses = FinanceState.data.cardExpenses;
let currentTransactionType = 'income';
let currentPaymentMethod = 'debit';
let editingTransactionId = null;
let editingSubscriptionId = null;
let editingInstallmentId = null;
let editingCardId = null;
let editingProjectionId = null;
let editingInvestmentId = null;
let currentProjectionType = 'income';
let creditCardPayments = FinanceState.data.creditCardPayments;
let investments = FinanceState.data.investments;
let services = FinanceState.data.services;
let userSettings = FinanceState.settings;
let activeUserId = null;
let activeUserEmail = null;
const COMPANY_EMAIL = '3d3printers@gmail.com';

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
    console.log('Firebase inicializado com sucesso');
} catch (error) {
    console.error('Erro ao inicializar Firebase:', error);
    alert('Erro ao conectar com o servidor. Recarregue a página.');
}

// ===========================
// AUTHENTICATION
// ===========================
auth.onAuthStateChanged(user => {
    console.log('Auth state changed:', user ? user.email : 'Não autenticado');
    hideLoading(); // IMPORTANTE: Sempre esconde o loading primeiro

    if (user) {
        currentUser = user;

        if (isAdminUser(user.email)) {
            // Admin: mostrar modal de seleção (pessoal ou empresa)
            showAccountSelectionModal(user);
        } else {
            // Usuário comum: ir direto para conta pessoal
            console.log('Usuário comum - acesso direto à conta pessoal');
            selectAccount('personal');
        }
    } else {
        showLoginScreen();
    }
});

// 🔐 Autentica usuário via Google OAuth
function signInWithGoogle() {
    showLoading('Autenticando...');
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .catch(error => {
            hideLoading();
            console.error('Erro no login:', error);
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

// 🎨 Exibe tela de login
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('dashboard').classList.add('hidden');
    hideLoading(); // IMPORTANTE: Esconde loading na tela de login
}

// 🎨 Exibe dashboard principal após autenticação
function showDashboard(user) {
    const loginScreen = document.getElementById('loginScreen');
    const dashboard = document.getElementById('dashboard');
    const userName = document.getElementById('userName');
    const userPhoto = document.getElementById('userPhoto');

    if (loginScreen) loginScreen.style.display = 'none';
    if (dashboard) dashboard.classList.remove('hidden');
    if (userName) userName.textContent = user.displayName || 'Usuário';
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
    document.getElementById('loginScreen').style.display = 'none';

    // Mostrar modal de seleção
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
        console.log('Usando UID da empresa (fixo):', activeUserId);

        // Garantir que o systemConfig esteja atualizado com o ID correto
        try {
            const configDoc = await db.collection('systemConfig').doc('companyAccount').get();

            if (!configDoc.exists || configDoc.data().userId !== COMPANY_USER_ID) {
                // Criar ou atualizar configuração com o ID correto
                console.log('Atualizando systemConfig com COMPANY_USER_ID correto...');
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
            console.warn('Aviso: não foi possível atualizar systemConfig:', error);
        }
    } else {
        showLoading('Carregando dados...');
        // Acessar como conta pessoal
        activeUserId = currentUser.uid;
        activeUserEmail = currentUser.email;
        console.log('Usando conta pessoal com UID:', activeUserId);
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
    console.log('[updateAllDisplays] Atualizando todos os componentes...');

    // Atualizar KPIs
    if (typeof updateKPIs === 'function') {
        updateKPIs();
    }

    // Atualizar gráficos
    if (typeof updateCharts === 'function') {
        updateCharts();
    }

    console.log('[updateAllDisplays] Todos os componentes atualizados!');
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

console.log('✅ Finance Core v3.0 - Loaded');
