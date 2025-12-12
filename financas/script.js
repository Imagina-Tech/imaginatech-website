/*
==================================================
ARQUIVO: financas/script.js
MÓDULO: Dashboard Financeiro Pessoal Profissional
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 2.1 - Correção de Loading Infinito
IMPORTANTE: NÃO REMOVER ESTE CABEÇALHO DE IDENTIFICAÇÃO
==================================================
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
// GLOBAL STATE
// ===========================
let db, auth;
let currentUser = null;
let transactions = [];
let subscriptions = [];
let installments = [];
let projections = [];
let creditCards = [];
let cardExpenses = [];
let currentFilter = 'all';
let currentTransactionType = 'income';
let currentPaymentMethod = 'debit';
let editingTransactionId = null;
let editingSubscriptionId = null;
let editingInstallmentId = null;
let editingCardId = null;
let editingProjectionId = null;
let editingInvestmentId = null;
let currentProjectionType = 'income'; // Tipo de projeção: 'income' ou 'expense'

// Credit card payments tracking
let creditCardPayments = [];

// Investments
let investments = [];

// User settings (meta economia, limite gastos)
let userSettings = {
    savingsGoal: 2000,
    expenseLimit: 3000
};

// Multi-user system
let activeUserId = null; // ID do usuário ativo (pode ser diferente de activeUserId)
let activeUserEmail = null; // Email do usuário ativo
const COMPANY_EMAIL = '3d3printers@gmail.com';

// ApexCharts instances
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
        if (AUTHORIZED_EMAILS.includes(user.email)) {
            currentUser = user;
            // Mostrar modal de seleção de conta
            showAccountSelectionModal(user);
        } else {
            showToast('Acesso não autorizado!', 'error');
            signOut();
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
    showLoading('Carregando dados...');

    // Fechar modal
    document.getElementById('accountSelectionModal').classList.remove('active');

    if (accountType === 'company') {
        // Acessar como conta da empresa
        // Buscar UID da conta da empresa no systemConfig
        try {
            const configDoc = await db.collection('systemConfig').doc('companyAccount').get();

            if (configDoc.exists) {
                // Usar UID salvo na configuração
                activeUserId = configDoc.data().userId;
                activeUserEmail = COMPANY_EMAIL;
                console.log('Usando UID da empresa do systemConfig:', activeUserId);
            } else {
                // Se não existe configuração, criar automaticamente
                // Isso só acontecerá quando 3d3printers@gmail.com fizer login
                if (currentUser.email === COMPANY_EMAIL) {
                    showToast('Configurando conta da empresa pela primeira vez...', 'info');
                    await db.collection('systemConfig').doc('companyAccount').set({
                        userId: currentUser.uid,
                        email: COMPANY_EMAIL,
                        displayName: 'ImaginaTech - Caixa Interno',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        createdBy: currentUser.email
                    });
                    activeUserId = currentUser.uid;
                    activeUserEmail = COMPANY_EMAIL;
                    console.log('Configuração da empresa criada com UID:', activeUserId);
                } else {
                    // Admin tentando acessar empresa, mas configuração não existe
                    showToast('Conta da empresa ainda não foi configurada. Entre primeiro com 3d3printers@gmail.com', 'error');
                    // Voltar para seleção
                    localStorage.removeItem('selectedAccountType');
                    showAccountSelectionModal(currentUser);
                    hideLoading();
                    return;
                }
            }
        } catch (error) {
            console.error('Erro ao buscar conta da empresa:', error);
            showToast('Erro ao acessar conta da empresa', 'error');
            hideLoading();
            return;
        }
    } else {
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
// INITIALIZATION
// ===========================
// 🔄 Inicializa dashboard e carrega todos os dados do Firestore
async function initializeDashboard() {
    showLoading('Carregando dados...');
    console.log('Iniciando dashboard...');

    try {
        // Set default date to today
        const today = new Date().toISOString().split('T')[0];
        const dateInput = document.getElementById('date');
        const projDateInput = document.getElementById('projDate');

        if (dateInput) dateInput.value = today;
        if (projDateInput) projDateInput.value = today;

        // Populate category options
        populateCategories();

        // Load all data with individual error handling
        console.log('Carregando dados do Firestore...');
        await Promise.allSettled([
            loadTransactions(),
            loadSubscriptions(),
            loadInstallments(),
            loadProjections(),
            loadCreditCards(),
            loadCreditCardPayments(),
            loadInvestments(),
            loadUserSettings()
        ]);

        console.log('Dados carregados:', {
            transactions: transactions.length,
            subscriptions: subscriptions.length,
            installments: installments.length,
            projections: projections.length,
            creditCardPayments: creditCardPayments.length,
            investments: investments.length
        });

        // Initialize charts (com dados ou sem)
        initializeCharts();

        // Update KPIs
        updateKPIs();

        // Migrar parcelamentos antigos automaticamente (se necessário)
        // Fazemos isso em background para não bloquear a interface
        setTimeout(() => {
            const oldInstallments = installments.filter(i =>
                i.startMonth === undefined || i.startYear === undefined
            );
            if (oldInstallments.length > 0) {
                console.log('[initializeDashboard] Detectados parcelamentos antigos, iniciando migração automática...');
                migrateOldInstallments();
            }
        }, 1000);

        hideLoading();
        showToast('Dashboard carregado com sucesso', 'success');
    } catch (error) {
        hideLoading();
        console.error('Erro ao inicializar dashboard:', error);
        showToast('Erro ao carregar dados: ' + error.message, 'error');
    }
}

// 📝 Popula dropdown de categorias com base no tipo de transação
function populateCategories() {
    const categorySelect = document.getElementById('category');
    if (!categorySelect) return;

    categorySelect.innerHTML = '<option value="">Selecione uma categoria</option>';

    const categories = currentTransactionType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categorySelect.appendChild(option);
    });
}

// ===========================
// TRANSACTIONS CRUD
// ===========================
// 🗄️ Carrega todas as transações do Firestore
async function loadTransactions() {
    try {
        console.log('Carregando transações...');
        const snapshot = await db.collection('transactions')
            .where('userId', '==', activeUserId)
            .orderBy('date', 'desc')
            .get();

        transactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${transactions.length} transações carregadas`);
    } catch (error) {
        console.error('Erro ao carregar transações:', error);
        // Não mostra toast aqui para não poluir - já mostra no catch principal
        transactions = []; // Garante array vazio
    }
}

// 📲 Processa envio do formulário de transação (criar/editar)
async function handleTransactionSubmit(e) {
    e.preventDefault();

    const description = document.getElementById('description').value.trim();
    const valueStr = document.getElementById('value').value;
    const category = document.getElementById('category').value;
    const date = document.getElementById('date').value;

    if (!description || !valueStr || !category || !date) {
        showToast('Preencha todos os campos', 'error');
        return;
    }

    // Validar cartão de crédito se for transação no crédito (tanto saída quanto entrada/reembolso)
    let selectedCardId = null;
    let selectedCard = null;
    if (currentPaymentMethod === 'credit') {
        selectedCardId = document.getElementById('transactionCard').value;
        if (!selectedCardId) {
            showToast('Selecione um cartão de crédito', 'error');
            return;
        }
        // Validar que o cartão existe
        selectedCard = creditCards.find(c => c.id === selectedCardId);
        if (!selectedCard) {
            console.error('❌ Cartão selecionado não encontrado:', selectedCardId);
            showToast('Cartão inválido. Recarregue a página e tente novamente', 'error');
            return;
        }

        // ⚠️ Validar se a data está dentro do período da fatura
        // Fatura aberta: DIA (closingDay+1) do MÊS ANTERIOR até DIA FECHAMENTO do MÊS ATUAL
        const transactionDate = new Date(date + 'T12:00:00');
        const today = new Date();
        const currentMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : today.getMonth();
        const currentYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : today.getFullYear();

        let billStartDate, billEndDate;

        // Verificar se está navegando para um mês diferente do atual
        const isNavigating = (currentMonth !== today.getMonth() || currentYear !== today.getFullYear());

        if (isNavigating) {
            // Navegando: fatura aberta no mês visualizado
            let prevMonth = currentMonth - 1;
            let prevYear = currentYear;
            if (prevMonth < 0) {
                prevMonth = 11;
                prevYear--;
            }
            billStartDate = new Date(prevYear, prevMonth, selectedCard.closingDay + 1);
            billEndDate = new Date(currentYear, currentMonth, selectedCard.closingDay);
        } else {
            // Mês atual: verificar se já passou do fechamento
            if (today.getDate() < selectedCard.closingDay) {
                // Fatura aberta é do mês atual
                billStartDate = new Date(currentYear, currentMonth - 1, selectedCard.closingDay + 1);
                billEndDate = new Date(currentYear, currentMonth, selectedCard.closingDay);
                if (currentMonth === 0) {
                    billStartDate = new Date(currentYear - 1, 11, selectedCard.closingDay + 1);
                }
            } else {
                // Fatura aberta é do próximo mês
                billStartDate = new Date(currentYear, currentMonth, selectedCard.closingDay + 1);
                let nextMonth = currentMonth + 1;
                let nextYear = currentYear;
                if (nextMonth > 11) {
                    nextMonth = 0;
                    nextYear++;
                }
                billEndDate = new Date(nextYear, nextMonth, selectedCard.closingDay);
            }
        }

        // Avisar se a data está fora do período
        if (transactionDate < billStartDate || transactionDate > billEndDate) {
            const startStr = billStartDate.toLocaleDateString('pt-BR');
            const endStr = billEndDate.toLocaleDateString('pt-BR');
            const warningMsg = `⚠️ ATENÇÃO: A data (${new Date(date).toLocaleDateString('pt-BR')}) está FORA do período da fatura de "${selectedCard.name}" (${startStr} a ${endStr}). A transação não aparecerá na fatura! Deseja continuar?`;

            console.warn(`⚠️ [DATA FORA DO PERÍODO] Transação de ${date} para cartão "${selectedCard.name}"`);

            if (!confirm(warningMsg)) {
                return;
            }
        }
    }

    const value = parseCurrencyInput(valueStr);
    if (value <= 0) {
        showToast('Valor inválido', 'error');
        return;
    }

    showLoading(editingTransactionId ? 'Atualizando transação...' : 'Salvando transação...');

    try {
        const transactionData = {
            userId: activeUserId,
            type: currentTransactionType,
            description,
            value,
            category,
            date
        };

        // Adicionar informações de pagamento (para despesas e reembolsos no crédito)
        transactionData.paymentMethod = currentPaymentMethod;
        if (currentPaymentMethod === 'credit' && selectedCardId) {
            transactionData.cardId = selectedCardId;
            console.log(`📝 [handleTransactionSubmit] Salvando transação no cartão:`, selectedCardId, 'Nome:', creditCards.find(c => c.id === selectedCardId)?.name);
        }

        if (editingTransactionId) {
            // Editando transação existente
            console.log(`✏️ Atualizando transação ID: ${editingTransactionId}`);
            await db.collection('transactions').doc(editingTransactionId).update({
                ...transactionData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Transação atualizada com sucesso', 'success');
        } else {
            // Criando nova transação
            console.log(`✨ Criando nova transação:`, { description, type: currentTransactionType, paymentMethod: currentPaymentMethod, cardId: selectedCardId });
            await db.collection('transactions').add({
                ...transactionData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Transação adicionada com sucesso', 'success');
        }

        await loadTransactions();
        updateAllDisplays();
        closeTransactionModal();
    } catch (error) {
        console.error('Erro ao salvar transação:', error);
        showToast('Erro ao salvar transação', 'error');
    } finally {
        hideLoading();
    }
}

// 🗄️ Deleta uma transação do Firestore
async function deleteTransaction(id) {
    if (!confirm('Deseja realmente deletar esta transação?')) return;

    showLoading('Deletando...');

    try {
        await db.collection('transactions').doc(id).delete();
        await loadTransactions();
        updateAllDisplays();
        showToast('Transação deletada com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao deletar transação:', error);
        showToast('Erro ao deletar transação', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// SUBSCRIPTIONS CRUD
// ===========================
// 🗄️ Carrega todas as assinaturas do Firestore
async function loadSubscriptions() {
    try {
        console.log('Carregando assinaturas...');
        const snapshot = await db.collection('subscriptions')
            .where('userId', '==', activeUserId)
            .orderBy('createdAt', 'desc')
            .get();

        subscriptions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${subscriptions.length} assinaturas carregadas`);
    } catch (error) {
        console.error('Erro ao carregar assinaturas:', error);
        subscriptions = [];
    }
}

// 📲 Processa envio do formulário de assinatura (criar/editar)
async function handleSubscriptionSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('subName').value.trim();
    const valueStr = document.getElementById('subValue').value;
    const dueDay = parseInt(document.getElementById('subDueDay').value);
    const category = document.getElementById('subCategory').value;
    const status = document.getElementById('subStatus').value;
    const cardId = document.getElementById('subCard').value;

    if (!name || !valueStr || !dueDay || !category) {
        showToast('Preencha todos os campos', 'error');
        return;
    }

    if (dueDay < 1 || dueDay > 31) {
        showToast('Dia do vencimento deve estar entre 1 e 31', 'error');
        return;
    }

    const value = parseCurrencyInput(valueStr);
    if (value <= 0) {
        showToast('Valor inválido', 'error');
        return;
    }

    showLoading(editingSubscriptionId ? 'Atualizando assinatura...' : 'Salvando assinatura...');

    try {
        const subscriptionData = {
            userId: activeUserId,
            name,
            value,
            dueDay,
            category,
            status,
            cardId: cardId || null
        };

        if (editingSubscriptionId) {
            // Editando assinatura existente
            await db.collection('subscriptions').doc(editingSubscriptionId).update({
                ...subscriptionData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Assinatura atualizada com sucesso', 'success');
        } else {
            // Criando nova assinatura
            await db.collection('subscriptions').add({
                ...subscriptionData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Assinatura adicionada com sucesso', 'success');
        }

        await loadSubscriptions();
        updateAllDisplays();
        closeSubscriptionModal();
    } catch (error) {
        console.error('Erro ao salvar assinatura:', error);
        showToast('Erro ao salvar assinatura', 'error');
    } finally {
        hideLoading();
    }
}

// 🗄️ Deleta uma assinatura do Firestore
async function deleteSubscription(id) {
    if (!confirm('Deseja realmente deletar esta assinatura?')) return;

    showLoading('Deletando...');

    try {
        await db.collection('subscriptions').doc(id).delete();
        await loadSubscriptions();
        updateAllDisplays();
        showToast('Assinatura deletada com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao deletar assinatura:', error);
        showToast('Erro ao deletar assinatura', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// INSTALLMENTS - MIGRATION
// ===========================
// 🔄 Migra parcelamentos antigos adicionando startMonth e startYear
async function migrateOldInstallments() {
    showLoading('Migrando parcelamentos antigos...');

    try {
        const snapshot = await db.collection('installments')
            .where('userId', '==', activeUserId)
            .get();

        const installmentsToMigrate = [];
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            // Identificar parcelamentos sem startMonth/startYear
            if (data.startMonth === undefined || data.startYear === undefined) {
                installmentsToMigrate.push({
                    id: doc.id,
                    ...data
                });
            }
        });

        if (installmentsToMigrate.length === 0) {
            showToast('Nenhum parcelamento precisa ser migrado!', 'success');
            hideLoading();
            return;
        }

        console.log(`[migrateOldInstallments] Encontrados ${installmentsToMigrate.length} parcelamentos para migrar`);

        // Migrar cada parcelamento
        const batch = db.batch();
        const today = new Date();

        installmentsToMigrate.forEach(inst => {
            // Calcular o mês de início baseado em currentInstallment ou paidInstallments
            const current = inst.currentInstallment || (inst.paidInstallments ? inst.paidInstallments + 1 : 1);

            // Se a parcela atual é X, significa que começou há (X - 1) meses atrás
            const monthsAgo = current - 1;

            const startDate = new Date(today);
            startDate.setMonth(startDate.getMonth() - monthsAgo);

            const startMonth = startDate.getMonth();
            const startYear = startDate.getFullYear();

            console.log(`[migrateOldInstallments] Parcelamento "${inst.description}": currentInstallment=${current}, startMonth=${startMonth}, startYear=${startYear}`);

            const docRef = db.collection('installments').doc(inst.id);
            batch.update(docRef, {
                startMonth,
                startYear,
                currentInstallment: current // Garantir que currentInstallment existe
            });
        });

        await batch.commit();

        await loadInstallments();
        updateAllDisplays();

        showToast(`${installmentsToMigrate.length} parcelamento(s) migrado(s) com sucesso!`, 'success');
        console.log('[migrateOldInstallments] Migração concluída!');
    } catch (error) {
        console.error('Erro ao migrar parcelamentos:', error);
        showToast('Erro ao migrar parcelamentos: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// INSTALLMENTS CRUD
// ===========================
// 🗄️ Carrega todos os parcelamentos do Firestore
async function loadInstallments() {
    try {
        console.log('Carregando parcelamentos...');
        const snapshot = await db.collection('installments')
            .where('userId', '==', activeUserId)
            .orderBy('createdAt', 'desc')
            .get();

        installments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${installments.length} parcelamentos carregados`);

        // Recalcular startMonth de parcelamentos com dados inconsistentes (apenas uma vez)
        await fixInstallmentsStartMonth();
    } catch (error) {
        console.error('Erro ao carregar parcelamentos:', error);
        installments = [];
    }
}

// 🔄 Corrige startMonth de parcelamentos com dados inconsistentes
async function fixInstallmentsStartMonth() {
    try {
        const displayMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
        const displayYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();

        console.log(`\n🔍 [MIGRAÇÃO] Verificando parcelamentos... (ref: mês ${displayMonth + 1}/${displayYear})`);

        const toFix = installments.filter(inst => {
            // Verifica se precisa correção: se startMonth está definido mas parece errado
            if (inst.startMonth === undefined && inst.startMonth !== 0) return false;
            if (!inst.currentInstallment) return false;
            if (!inst.totalInstallments) return false;

            // Recalcular o que deveria ser
            const monthsBack = inst.currentInstallment - 1;
            let correctStartMonth = displayMonth - monthsBack;
            let correctStartYear = displayYear;

            while (correctStartMonth < 0) {
                correctStartMonth += 12;
                correctStartYear--;
            }
            while (correctStartMonth > 11) {
                correctStartMonth -= 12;
                correctStartYear++;
            }

            // Se está diferente, precisa corrigir
            const needsFix = (inst.startMonth !== correctStartMonth || inst.startYear !== correctStartYear);

            if (needsFix) {
                console.log(`   🔧 "${inst.description}": ${inst.startMonth + 1}/${inst.startYear} → ${correctStartMonth + 1}/${correctStartYear} (parcela ${inst.currentInstallment}/${inst.totalInstallments})`);
            }

            return needsFix;
        });

        if (toFix.length === 0) {
            console.log(`   ✅ Todos os parcelamentos estão corretos!\n`);
            return;
        }

        console.log(`\n🔧 Corrigindo ${toFix.length} parcelamentos com startMonth incorreto...`);

        for (const inst of toFix) {
            const monthsBack = inst.currentInstallment - 1;
            let startMonth = displayMonth - monthsBack;
            let startYear = displayYear;

            while (startMonth < 0) {
                startMonth += 12;
                startYear--;
            }

            console.log(`   Corrigindo "${inst.description}": ${inst.startMonth + 1}/${inst.startYear} → ${startMonth + 1}/${startYear}`);

            await db.collection('installments').doc(inst.id).update({
                startMonth,
                startYear,
                migratedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Atualizar no array local
            inst.startMonth = startMonth;
            inst.startYear = startYear;
        }

        console.log(`✅ ${toFix.length} parcelamentos corrigidos!\n`);
    } catch (error) {
        console.error('Erro ao corrigir parcelamentos:', error);
    }
}

// 🔄 Calcula qual parcela está ativa baseada no mês/ano de referência
function calculateCurrentInstallment(installment, targetMonth = null, targetYear = null) {
    // Fallback para valor salvo ou paidInstallments (para parcelamentos antigos)
    const savedCurrent = installment.currentInstallment || (installment.paidInstallments ? installment.paidInstallments + 1 : 1);

    // Se não tem startMonth/startYear, usar valor salvo
    if (installment.startMonth === undefined || installment.startYear === undefined) {
        return savedCurrent;
    }

    // Usar mês/ano informado, senão usar display global, senão usar data atual
    let refMonth, refYear;
    if (targetMonth !== null && targetYear !== null) {
        refMonth = targetMonth;
        refYear = targetYear;
    } else if (typeof currentDisplayMonth !== 'undefined' && typeof currentDisplayYear !== 'undefined') {
        refMonth = currentDisplayMonth;
        refYear = currentDisplayYear;
    } else {
        const today = new Date();
        refMonth = today.getMonth();
        refYear = today.getFullYear();
    }

    // Calcular quantos meses se passaram desde o início
    const monthsDiff = (refYear - installment.startYear) * 12 + (refMonth - installment.startMonth);

    // Se ainda não começou, retornar 1
    if (monthsDiff < 0) {
        return 1;
    }

    // Calcular parcela atual: parcela 1 no mês de início + meses que se passaram
    const calculatedCurrent = 1 + monthsDiff;

    // Não ultrapassar o total de parcelas
    return Math.min(calculatedCurrent, installment.totalInstallments);
}

// 📲 Processa envio do formulário de parcelamento (criar/editar)
async function handleInstallmentSubmit(e) {
    e.preventDefault();

    const description = document.getElementById('instDescription').value.trim();
    const cardId = document.getElementById('instCard').value;
    const totalInstallments = parseInt(document.getElementById('instTotalInstallments').value);
    const currentInstallment = parseInt(document.getElementById('instCurrentInstallment').value);

    // Pega o valor correto dependendo do tipo selecionado
    let totalValue = 0;
    if (installmentValueType === 'total') {
        const totalValueStr = document.getElementById('instTotalValue').value;
        if (!totalValueStr) {
            showToast('Preencha o valor total', 'error');
            return;
        }
        totalValue = parseCurrencyInput(totalValueStr);
    } else {
        const installmentValueStr = document.getElementById('instInstallmentValue').value;
        if (!installmentValueStr) {
            showToast('Preencha o valor da parcela', 'error');
            return;
        }
        const installmentValue = parseCurrencyInput(installmentValueStr);
        totalValue = installmentValue * totalInstallments;
    }

    if (!description || !cardId || !totalInstallments || !currentInstallment) {
        showToast('Preencha todos os campos', 'error');
        return;
    }

    if (totalValue <= 0) {
        showToast('Valor inválido', 'error');
        return;
    }

    if (totalInstallments < 2 || totalInstallments > 99) {
        showToast('Total de parcelas deve estar entre 2 e 99', 'error');
        return;
    }

    if (currentInstallment < 1 || currentInstallment > totalInstallments) {
        showToast('Parcela atual inválida', 'error');
        return;
    }

    showLoading(editingInstallmentId ? 'Atualizando parcelamento...' : 'Salvando parcelamento...');

    try {
        // Usar mês selecionado na navegação ou mês atual
        const displayMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
        const displayYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();

        const installmentData = {
            userId: activeUserId,
            cardId,
            description,
            totalValue,
            totalInstallments,
            currentInstallment
        };

        if (editingInstallmentId) {
            // Editando parcelamento existente
            await db.collection('installments').doc(editingInstallmentId).update({
                ...installmentData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Parcelamento atualizado com sucesso', 'success');
        } else {
            // Criar novo parcelamento - calcula mês/ano de início baseado na parcela atual
            // Se está visualizando dezembro e na parcela 9, a parcela 1 foi 8 meses atrás (abril)
            const monthsBack = currentInstallment - 1;
            let startMonth = displayMonth - monthsBack;
            let startYear = displayYear;

            // Ajusta ano se necessário (quando atravessa anos)
            while (startMonth < 0) {
                startMonth += 12;
                startYear--;
            }

            await db.collection('installments').add({
                ...installmentData,
                startMonth,
                startYear,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Parcelamento adicionado com sucesso', 'success');
        }

        await loadInstallments();
        updateAllDisplays();
        closeInstallmentModal();
    } catch (error) {
        console.error('Erro ao salvar parcelamento:', error);
        showToast('Erro ao salvar parcelamento', 'error');
    } finally {
        hideLoading();
    }
}

// 🔄 Atualiza progresso da parcela atual de um parcelamento
async function updateInstallmentProgress(id, current) {
    const currentInstallment = parseInt(current);

    showLoading('Atualizando...');

    try {
        await db.collection('installments').doc(id).update({
            currentInstallment
        });

        await loadInstallments();
        updateAllDisplays();
        showToast('Progresso atualizado', 'success');
    } catch (error) {
        console.error('Erro ao atualizar parcelamento:', error);
        showToast('Erro ao atualizar', 'error');
    } finally {
        hideLoading();
    }
}

// 🗄️ Deleta um parcelamento do Firestore
async function deleteInstallment(id) {
    if (!confirm('Deseja realmente deletar este parcelamento?')) return;

    showLoading('Deletando...');

    try {
        await db.collection('installments').doc(id).delete();
        await loadInstallments();
        updateAllDisplays();
        showToast('Parcelamento deletado com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao deletar parcelamento:', error);
        showToast('Erro ao deletar parcelamento', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// PROJECTIONS CRUD
// ===========================
// 🗄️ Carrega todas as projeções do Firestore
async function loadProjections() {
    try {
        console.log('Carregando projeções...');
        const snapshot = await db.collection('projections')
            .where('userId', '==', activeUserId)
            .orderBy('date', 'asc')
            .get();

        projections = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${projections.length} projeções carregadas`);
    } catch (error) {
        console.error('Erro ao carregar projeções:', error);
        projections = [];
    }
}

// ===========================
// CREDIT CARD PAYMENTS - LOAD
// ===========================
async function loadCreditCardPayments() {
    try {
        console.log('Carregando pagamentos de faturas...');
        const snapshot = await db.collection('creditCardPayments')
            .where('userId', '==', activeUserId)
            .get();

        creditCardPayments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${creditCardPayments.length} pagamentos de fatura carregados`);
    } catch (error) {
        console.error('Erro ao carregar pagamentos de faturas:', error);
        creditCardPayments = [];
    }
}

// Verifica se uma fatura específica está paga
function isBillPaid(cardId, month, year) {
    return creditCardPayments.find(p =>
        p.cardId === cardId &&
        p.month === month &&
        p.year === year
    );
}

// Marca uma fatura como paga (cria transação automática)
async function markBillAsPaid(cardId, month, year, billAmount) {
    const card = creditCards.find(c => c.id === cardId);
    if (!card) {
        showToast('Cartão não encontrado', 'error');
        return;
    }

    // Verifica se já está paga
    if (isBillPaid(cardId, month, year)) {
        showToast('Esta fatura já está marcada como paga', 'warning');
        return;
    }

    showLoading('Registrando pagamento...');

    try {
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // 1. Criar transação de débito automática
        const transactionRef = await db.collection('transactions').add({
            userId: activeUserId,
            type: 'expense',
            description: `Pagamento Fatura ${card.name} - ${monthNames[month]}/${year}`,
            value: billAmount,
            category: 'Fatura Cartão',
            date: todayStr,
            paymentMethod: 'debit',
            cardId: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 2. Criar registro de pagamento
        await db.collection('creditCardPayments').add({
            userId: activeUserId,
            cardId: cardId,
            month: month,
            year: year,
            paidAmount: billAmount,
            paidDate: todayStr,
            billAmount: billAmount,
            transactionId: transactionRef.id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // 3. Recarregar dados
        await loadTransactions();
        await loadCreditCardPayments();
        updateAllDisplays();

        showToast('Fatura marcada como paga! Transação de débito criada.', 'success');

        // Fechar e reabrir modal para atualizar
        document.getElementById('cardBillDetailsModal').classList.remove('active');
        setTimeout(() => showCardBillDetails(cardId), 300);

    } catch (error) {
        console.error('Erro ao marcar fatura como paga:', error);
        showToast('Erro ao registrar pagamento', 'error');
    } finally {
        hideLoading();
    }
}

// Desfaz pagamento de fatura
async function unmarkBillAsPaid(paymentId) {
    if (!confirm('Deseja realmente desfazer este pagamento? A transação de débito será removida.')) {
        return;
    }

    const payment = creditCardPayments.find(p => p.id === paymentId);
    if (!payment) {
        showToast('Pagamento não encontrado', 'error');
        return;
    }

    showLoading('Removendo pagamento...');

    try {
        // 1. Deletar transação vinculada
        if (payment.transactionId) {
            await db.collection('transactions').doc(payment.transactionId).delete();
        }

        // 2. Deletar registro de pagamento
        await db.collection('creditCardPayments').doc(paymentId).delete();

        // 3. Recarregar dados
        await loadTransactions();
        await loadCreditCardPayments();
        updateAllDisplays();

        showToast('Pagamento desfeito! Transação removida.', 'success');

        // Fechar e reabrir modal para atualizar
        const cardId = payment.cardId;
        document.getElementById('cardBillDetailsModal').classList.remove('active');
        setTimeout(() => showCardBillDetails(cardId), 300);

    } catch (error) {
        console.error('Erro ao desfazer pagamento:', error);
        showToast('Erro ao remover pagamento', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// INVESTMENTS - LOAD
// ===========================
async function loadInvestments() {
    try {
        console.log('Carregando investimentos...');
        const snapshot = await db.collection('investments')
            .where('userId', '==', activeUserId)
            .orderBy('date', 'desc')
            .get();

        investments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${investments.length} investimentos carregados`);
    } catch (error) {
        console.error('Erro ao carregar investimentos:', error);
        investments = [];
    }
}

// ===========================
// USER SETTINGS - LOAD
// ===========================
async function loadUserSettings() {
    try {
        console.log('Carregando configurações do usuário...');
        const doc = await db.collection('userSettings').doc(activeUserId).get();

        if (doc.exists) {
            userSettings = { ...userSettings, ...doc.data() };
        }

        console.log('Configurações carregadas:', userSettings);
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
        // Mantém valores padrão
    }
}

async function saveUserSettings(newSettings) {
    try {
        await db.collection('userSettings').doc(activeUserId).set({
            ...userSettings,
            ...newSettings,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        userSettings = { ...userSettings, ...newSettings };
        showToast('Configurações salvas!', 'success');
        return true;
    } catch (error) {
        console.error('Erro ao salvar configurações:', error);
        showToast('Erro ao salvar configurações', 'error');
        return false;
    }
}

// ===========================
// INVESTMENTS - CRUD & MODAL
// ===========================
function openInvestmentsModal() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('investmentDate').value = today;
    document.getElementById('investmentName').value = '';
    document.getElementById('investmentValue').value = '';
    editingInvestmentId = null;

    renderInvestmentsList();
    document.getElementById('investmentsModal').classList.add('active');
}

function closeInvestmentsModal() {
    document.getElementById('investmentsModal').classList.remove('active');
    editingInvestmentId = null;
}

function renderInvestmentsList() {
    const listEl = document.getElementById('investmentsList');
    const totalEl = document.getElementById('investmentsTotalDisplay');

    const total = investments.reduce((sum, inv) => sum + inv.value, 0);
    if (totalEl) totalEl.textContent = formatCurrencyDisplay(total);

    if (!investments || investments.length === 0) {
        listEl.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-piggy-bank"></i>
                <p>Nenhum investimento cadastrado</p>
            </div>
        `;
        return;
    }

    listEl.innerHTML = investments.map(inv => `
        <div class="list-item" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--color-bg-tertiary); border-radius: 8px; margin-bottom: 0.5rem; border: 1px solid var(--color-border);">
            <div>
                <div style="font-weight: 500; color: #fff;">${inv.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(inv.date)}</div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="font-weight: 600; color: #10B981;">${formatCurrencyDisplay(inv.value)}</div>
                <button class="btn-icon" onclick="editInvestment('${inv.id}')" title="Editar" style="color: var(--color-neutral);">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon danger" onclick="deleteInvestment('${inv.id}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

async function handleInvestmentSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('investmentName').value.trim();
    const valueStr = document.getElementById('investmentValue').value;
    const date = document.getElementById('investmentDate').value;

    if (!name || !valueStr || !date) {
        showToast('Preencha todos os campos', 'error');
        return;
    }

    const value = parseCurrencyInput(valueStr);
    if (value <= 0) {
        showToast('Valor inválido', 'error');
        return;
    }

    showLoading(editingInvestmentId ? 'Atualizando...' : 'Salvando...');

    try {
        if (editingInvestmentId) {
            await db.collection('investments').doc(editingInvestmentId).update({
                name,
                value,
                date,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Investimento atualizado!', 'success');
        } else {
            await db.collection('investments').add({
                userId: activeUserId,
                name,
                value,
                date,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Investimento adicionado!', 'success');
        }

        // Limpar formulário
        document.getElementById('investmentName').value = '';
        document.getElementById('investmentValue').value = '';
        document.getElementById('investmentDate').value = new Date().toISOString().split('T')[0];
        editingInvestmentId = null;

        await loadInvestments();
        renderInvestmentsList();
        updateAllDisplays();

    } catch (error) {
        console.error('Erro ao salvar investimento:', error);
        showToast('Erro ao salvar investimento', 'error');
    } finally {
        hideLoading();
    }
}

function editInvestment(id) {
    const inv = investments.find(i => i.id === id);
    if (!inv) return;

    document.getElementById('investmentName').value = inv.name;
    document.getElementById('investmentValue').value = inv.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    document.getElementById('investmentDate').value = inv.date;
    editingInvestmentId = id;
}

async function deleteInvestment(id) {
    if (!confirm('Deseja realmente excluir este investimento?')) return;

    showLoading('Excluindo...');

    try {
        await db.collection('investments').doc(id).delete();
        await loadInvestments();
        renderInvestmentsList();
        updateAllDisplays();
        showToast('Investimento excluído!', 'success');
    } catch (error) {
        console.error('Erro ao excluir investimento:', error);
        showToast('Erro ao excluir investimento', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// SETTINGS MODAL
// ===========================
function openSettingsModal() {
    // Preencher com valores atuais
    document.getElementById('savingsGoalInput').value = userSettings.savingsGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    document.getElementById('expenseLimitInput').value = userSettings.expenseLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    document.getElementById('settingsModal').classList.add('active');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.remove('active');
}

async function handleSettingsSubmit(e) {
    e.preventDefault();

    const savingsGoalStr = document.getElementById('savingsGoalInput').value;
    const expenseLimitStr = document.getElementById('expenseLimitInput').value;

    const savingsGoal = parseCurrencyInput(savingsGoalStr);
    const expenseLimit = parseCurrencyInput(expenseLimitStr);

    if (savingsGoal <= 0 || expenseLimit <= 0) {
        showToast('Valores inválidos', 'error');
        return;
    }

    showLoading('Salvando...');

    const success = await saveUserSettings({ savingsGoal, expenseLimit });

    if (success) {
        closeSettingsModal();
        initializeCharts(); // Atualizar gráficos com novos valores
    }

    hideLoading();
}

// 📲 Processa envio do formulário de projeção
async function handleProjectionSubmit(e) {
    e.preventDefault();

    const description = document.getElementById('projDescription').value.trim();
    const valueStr = document.getElementById('projValue').value;
    const date = document.getElementById('projDate').value;
    const status = document.getElementById('projStatus').value;
    const type = currentProjectionType; // 'income' ou 'expense'

    if (!description || !valueStr || !date) {
        showToast('Preencha todos os campos', 'error');
        return;
    }

    const value = parseCurrencyInput(valueStr);
    if (value <= 0) {
        showToast('Valor inválido', 'error');
        return;
    }

    showLoading(editingProjectionId ? 'Atualizando projeção...' : 'Salvando projeção...');

    try {
        if (editingProjectionId) {
            // Atualizar projeção existente
            await db.collection('projections').doc(editingProjectionId).update({
                description,
                value,
                date,
                status,
                type
            });

            await loadProjections();
            updateAllDisplays();
            closeProjectionModal();
            showToast('Projeção atualizada com sucesso', 'success');
        } else {
            // Criar nova projeção
            await db.collection('projections').add({
                userId: activeUserId,
                description,
                value,
                date,
                status,
                type,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await loadProjections();
            updateAllDisplays();
            closeProjectionModal();
            showToast('Projeção adicionada com sucesso', 'success');
        }
    } catch (error) {
        console.error('Erro ao salvar projeção:', error);
        showToast('Erro ao salvar projeção', 'error');
    } finally {
        hideLoading();
    }
}

// 🔄 Atualiza status de uma projeção
// Quando marca como "received", cria uma transação correspondente (entrada ou despesa)
async function updateProjectionStatus(id, newStatus) {
    showLoading('Atualizando status...');

    try {
        const projection = projections.find(p => p.id === id);
        if (!projection) {
            showToast('Projeção não encontrada', 'error');
            return;
        }

        const oldStatus = projection.status;
        const projType = projection.type || 'income'; // default: income para projeções antigas
        console.log(`[Projeção Status] ID: ${id}, Tipo: ${projType}, Status anterior: ${oldStatus}, Novo status: ${newStatus}`);

        // Se marcando como "received" (ou "pago" para expense), criar transação
        if (newStatus === 'received' && oldStatus !== 'received') {
            console.log(`[Projeção] Procurando transação vinculada a: "${projection.description}"`);

            // Verificar se já existe transação vinculada a esta projeção
            let existingTransaction = transactions.find(t => t.projectionId === id);

            // Fallback: procurar por descrição, data, valor e categoria
            if (!existingTransaction) {
                const expectedType = projType === 'income' ? 'income' : 'expense';
                const expectedCategory = projType === 'income' ? 'Projeção Recebida' : 'Projeção Paga';
                existingTransaction = transactions.find(t =>
                    t.type === expectedType &&
                    t.category === expectedCategory &&
                    t.date === projection.date &&
                    t.value === projection.value &&
                    (t.description === projection.description || t.description === `[Projeção] ${projection.description}`)
                );
            }

            if (existingTransaction) {
                console.log(`[Projeção] Transação já existe: ${existingTransaction.id}`);
            } else {
                // Criar nova transação baseada no tipo da projeção
                if (projType === 'income') {
                    console.log(`[Projeção] Criando nova transação de ENTRADA para: "${projection.description}"`);
                    const newTransaction = {
                        userId: activeUserId,
                        type: 'income',
                        description: `[Projeção] ${projection.description}`,
                        value: projection.value,
                        category: 'Projeção Recebida',
                        date: projection.date,
                        paymentMethod: 'debit',
                        cardId: null,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        projectionId: id
                    };
                    const docRef = await db.collection('transactions').add(newTransaction);
                    console.log(`[Projeção] Transação de entrada criada com sucesso: ${docRef.id}`);
                } else {
                    console.log(`[Projeção] Criando nova transação de SAÍDA para: "${projection.description}"`);
                    const newTransaction = {
                        userId: activeUserId,
                        type: 'expense',
                        description: `[Projeção] ${projection.description}`,
                        value: projection.value,
                        category: 'Projeção Paga',
                        date: projection.date,
                        paymentMethod: 'debit',
                        cardId: null,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        projectionId: id
                    };
                    const docRef = await db.collection('transactions').add(newTransaction);
                    console.log(`[Projeção] Transação de despesa criada com sucesso: ${docRef.id}`);
                }
            }
        }
        // Se marcando como "pending", remover transação vinculada (se houver)
        else if (newStatus === 'pending' && oldStatus === 'received') {
            console.log(`[Projeção] Procurando transação vinculada para deletar`);

            // Procurar e deletar transação vinculada
            let linkedTransaction = transactions.find(t => t.projectionId === id);

            // Fallback: procurar por descrição, data, valor e categoria
            if (!linkedTransaction) {
                const expectedType = projType === 'income' ? 'income' : 'expense';
                const expectedCategory = projType === 'income' ? 'Projeção Recebida' : 'Projeção Paga';
                linkedTransaction = transactions.find(t =>
                    t.type === expectedType &&
                    t.category === expectedCategory &&
                    t.date === projection.date &&
                    t.value === projection.value &&
                    (t.description === projection.description || t.description === `[Projeção] ${projection.description}`)
                );
            }

            if (linkedTransaction) {
                console.log(`[Projeção] Deletando transação: ${linkedTransaction.id}`);
                await db.collection('transactions').doc(linkedTransaction.id).delete();
            } else {
                console.log(`[Projeção] Nenhuma transação vinculada encontrada`);
            }
        }

        // Atualizar status da projeção
        console.log(`[Projeção] Atualizando status no Firestore para: ${newStatus}`);
        await db.collection('projections').doc(id).update({ status: newStatus });

        // Recarregar dados e atualizar displays
        console.log(`[Projeção] Recarregando dados...`);
        await loadTransactions();
        await loadProjections();

        console.log(`[Projeção] Atualizando KPIs...`);
        updateAllDisplays();

        let message;
        if (projType === 'income') {
            message = newStatus === 'received'
                ? 'Projeção marcada como recebida! Transação de entrada criada.'
                : 'Projeção marcada como pendente. Transação removida.';
        } else {
            message = newStatus === 'received'
                ? 'Projeção marcada como paga! Transação de despesa criada.'
                : 'Projeção marcada como pendente. Transação removida.';
        }
        showToast(message, 'success');
    } catch (error) {
        console.error('Erro ao atualizar projeção:', error);
        showToast('Erro ao atualizar status', 'error');
    } finally {
        hideLoading();
    }
}

// 🗄️ Deleta uma projeção do Firestore
async function deleteProjection(id) {
    if (!confirm('Deseja realmente deletar esta projeção?')) return;

    showLoading('Deletando...');

    try {
        await db.collection('projections').doc(id).delete();
        await loadProjections();
        updateAllDisplays();
        showToast('Projeção deletada com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao deletar projeção:', error);
        showToast('Erro ao deletar projeção', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// CREDIT CARDS - LOAD & RENDER
// ===========================
// 🗄️ Carrega todos os cartões de crédito do Firestore
async function loadCreditCards() {
    try {
        console.log('Carregando cartões de crédito...');
        const snapshot = await db.collection('creditCards')
            .where('userId', '==', activeUserId)
            .orderBy('createdAt', 'desc')
            .get();

        creditCards = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${creditCards.length} cartões carregados`);
        await loadCardExpenses();
    } catch (error) {
        console.error('Erro ao carregar cartões:', error);
        creditCards = [];
    }
}

// 🗄️ Carrega gastos avulsos de cartões de crédito
async function loadCardExpenses() {
    try {
        const snapshot = await db.collection('cardExpenses')
            .where('userId', '==', activeUserId)
            .get();

        cardExpenses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${cardExpenses.length} gastos de cartão carregados`);
    } catch (error) {
        console.error('Erro ao carregar gastos:', error);
        cardExpenses = [];
    }
}

// Contador de chamadas (para debug)
let calculateBillCallCount = 0;

// 🔄 Calcula valor total da fatura do cartão para o mês especificado
function calculateCurrentBill(card, overrideMonth = null, overrideYear = null) {
    calculateBillCallCount++;
    console.log(`\n🔍 [CHAMADA #${calculateBillCallCount}] calculateCurrentBill("${card.name}")`);

    const today = new Date();
    // Usar mês/ano passados como parâmetro, ou mês selecionado no display, ou mês atual
    const currentMonth = overrideMonth !== null ? overrideMonth :
                        (typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : today.getMonth());
    const currentYear = overrideYear !== null ? overrideYear :
                       (typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : today.getFullYear());

    // Determinar período da fatura
    let billStartDate, billEndDate, billMonth, billYear;

    // Se está navegando para um mês DIFERENTE do mês atual
    // Comparar o mês/ano calculados com o dia de hoje
    const isNavigating = (currentMonth !== today.getMonth() || currentYear !== today.getFullYear());

    if (isNavigating) {
        // Navegando entre meses: mostrar fatura ABERTA no mês visualizado
        // Fatura aberta = período que está sendo construído no mês
        // DIA (closingDay+1) do MÊS ANTERIOR até DIA FECHAMENTO do MÊS ATUAL
        // Se visualiza dezembro (mês 11) com closingDay 20: 21/novembro até 20/dezembro
        // Se visualiza dezembro (mês 11) com closingDay 2: 03/novembro até 02/dezembro
        let prevMonth = currentMonth - 1;
        let prevYear = currentYear;
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear--;
        }
        billStartDate = new Date(prevYear, prevMonth, card.closingDay + 1);    // Dia após fechamento do mês anterior
        billEndDate = new Date(currentYear, currentMonth, card.closingDay);      // Dia de fechamento do mês atual

        billMonth = currentMonth;
        billYear = currentYear;
    } else {
        // Mês atual (real-time): usar lógica baseada no dia de fechamento
        // Se hoje é 09/12 e fechamento é 20: fatura aberta é de 21/11 até 20/12
        // Se hoje é 09/12 e fechamento é 2: fatura aberta é de 03/12 até 02/01 (já passou!)

        if (today.getDate() < card.closingDay) {
            // Ainda estamos no período: DIA (closingDay+1)/(mês-1) até dia_fechamento/mês
            billStartDate = new Date(currentYear, currentMonth - 1, card.closingDay + 1);    // Dia após fechamento anterior
            billEndDate = new Date(currentYear, currentMonth, card.closingDay);           // Dia de fechamento deste mês
            billMonth = currentMonth;
            billYear = currentYear;

            // Ajustar se estiver em janeiro
            if (currentMonth === 0) {
                billStartDate = new Date(currentYear - 1, 11, card.closingDay + 1); // Dia após fechamento no dezembro anterior
            }
        } else {
            // Já passou do fechamento: DIA (closingDay+1)/mês até dia_fechamento/(mês+1)
            billStartDate = new Date(currentYear, currentMonth, card.closingDay + 1);      // Dia após fechamento deste mês
            let nextMonth = currentMonth + 1;
            let nextYear = currentYear;
            if (nextMonth > 11) {
                nextMonth = 0;
                nextYear++;
            }
            billEndDate = new Date(nextYear, nextMonth, card.closingDay);        // Dia de fechamento do próximo mês
            // billMonth é SEMPRE o mês atual para cálculo de parcelamentos
            billMonth = currentMonth;
            billYear = currentYear;
        }
    }

    // Somar gastos do período (cardExpenses antigos + transações de crédito)
    const expensesTotal = cardExpenses
        .filter(expense => {
            if (expense.cardId !== card.id) return false;
            const expenseDate = new Date(expense.date);
            return expenseDate >= billStartDate && expenseDate <= billEndDate;
        })
        .reduce((sum, expense) => sum + expense.value, 0);

    // Somar transações de crédito do período (saídas e reembolsos)
    const transactionsInPeriod = transactions.filter(t => {
        if (t.paymentMethod !== 'credit' || t.cardId !== card.id) return false;
        const transactionDate = new Date(t.date + 'T12:00:00');

        if (isNavigating) {
            // Ao navegar, mostrar apenas transações do mês visualizado
            return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
        } else {
            // Modo real-time: usar o período da fatura
            return transactionDate >= billStartDate && transactionDate <= billEndDate;
        }
    });

    const creditTransactionsTotal = transactionsInPeriod.reduce((sum, t) => {
        // Expense soma, income subtrai (reembolso)
        return sum + (t.type === 'expense' ? t.value : -t.value);
    }, 0);

    // Log das transações incluídas
    if (transactionsInPeriod.length > 0) {
        console.log(`   Transações no período: ${transactionsInPeriod.length}`);
        transactionsInPeriod.forEach(t => {
            const tDate = new Date(t.date + 'T12:00:00');
            console.log(`     ${t.type === 'expense' ? '+' : '-'} ${t.description} em ${tDate.toLocaleDateString('pt-BR')}`);
        });
    }

    // Log simples do período e dados da fatura
    console.log(`📅 [FATURA ${card.name}] Mês: ${billMonth + 1}/${billYear}`);
    console.log(`   Período: ${billStartDate.toLocaleDateString('pt-BR')} até ${billEndDate.toLocaleDateString('pt-BR')}`);
    console.log(`   isNavigating: ${isNavigating}`);
    console.log(`   Transações de crédito incluídas: R$ ${creditTransactionsTotal.toFixed(2)}`);

    // Somar parcelas ativas deste cartão no mês da fatura
    const installmentsFiltered = installments.filter(inst => {
        if (inst.cardId !== card.id) return false;

        // Para parcelamentos antigos sem startMonth/startYear, usar lógica antiga
        if (inst.startMonth === undefined || inst.startYear === undefined) {
            return inst.currentInstallment <= inst.totalInstallments;
        }

        // Calcular quantos meses se passaram desde o início do parcelamento (parcela 1)
        const monthsSinceStart = (billYear - inst.startYear) * 12 + (billMonth - inst.startMonth);

        // Se o mês da fatura é antes do início do parcelamento, não incluir
        if (monthsSinceStart < 0) {
            return false;
        }

        // Calcular qual parcela está vencendo neste mês
        // startMonth é o mês da PARCELA 1, então:
        // parcela deste mês = 1 + meses desde o início
        const installmentForThisMonth = 1 + monthsSinceStart;

        const installmentValue = inst.totalValue / inst.totalInstallments;
        const isValid = installmentForThisMonth >= 1 && installmentForThisMonth <= inst.totalInstallments;

        return isValid;
    });

    const installmentsTotal = installmentsFiltered.reduce((sum, inst) => {
        const installmentValue = inst.installmentValue || (inst.totalValue / inst.totalInstallments);
        return sum + installmentValue;
    }, 0);

    // Somar assinaturas ativas deste cartão
    const subscriptionsFiltered = subscriptions.filter(sub => sub.cardId === card.id && sub.status === 'active');
    const subscriptionsTotal = subscriptionsFiltered.reduce((sum, sub) => sum + sub.value, 0);

    const totalBill = expensesTotal + creditTransactionsTotal + installmentsTotal + subscriptionsTotal;

    // Resumo final da fatura
    console.log(`   Parcelas: R$ ${installmentsTotal.toFixed(2)} (${installmentsFiltered.length})`);
    console.log(`   Assinaturas: R$ ${subscriptionsTotal.toFixed(2)} (${subscriptionsFiltered.length})`);
    console.log(`   TOTAL FATURA: R$ ${totalBill.toFixed(2)}`);

    return totalBill;
}

// ===========================
// CREDIT CARDS - MODALS
// ===========================
// 🎨 Abre modal para adicionar/editar cartão de crédito
function openCreditCardModal() {
    editingCardId = null;
    document.getElementById('creditCardModal').classList.add('active');
    document.getElementById('creditCardForm').reset();
    document.querySelector('#creditCardModal .modal-header h2').textContent = 'Novo Cartão de Crédito';
}

// 🎨 Fecha modal de cartão de crédito
function closeCreditCardModal() {
    editingCardId = null;
    document.getElementById('creditCardModal').classList.remove('active');
    document.getElementById('creditCardForm').reset();
}

// 🎨 Exibe detalhes completos da fatura do cartão em modal
function showCardBillDetails(cardId) {
    const card = creditCards.find(c => c.id === cardId);
    if (!card) return;

    const today = new Date();
    const currentMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : today.getMonth();
    const currentYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : today.getFullYear();

    // Calcular período da fatura (mesmo cálculo do calculateCurrentBill)
    // Se está navegando para um mês diferente do atual
    const isNavigating = (currentMonth !== today.getMonth() || currentYear !== today.getFullYear());

    let billStartDate, billEndDate, billMonth, billYear;

    if (isNavigating) {
        // Navegando: mostrar fatura ABERTA no mês visualizado
        // DIA (closingDay+1) do MÊS ANTERIOR até DIA FECHAMENTO do MÊS ATUAL
        let prevMonth = currentMonth - 1;
        let prevYear = currentYear;
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear--;
        }
        billStartDate = new Date(prevYear, prevMonth, card.closingDay + 1);
        billEndDate = new Date(currentYear, currentMonth, card.closingDay);
        billMonth = currentMonth;
        billYear = currentYear;
    } else {
        if (today.getDate() >= card.closingDay) {
            // Fatura aberta é do próximo mês (período), mas billMonth é sempre currentMonth
            billStartDate = new Date(currentYear, currentMonth, card.closingDay + 1);
            let nextMonth = currentMonth + 1;
            let nextYear = currentYear;
            if (nextMonth > 11) {
                nextMonth = 0;
                nextYear++;
            }
            billEndDate = new Date(nextYear, nextMonth, card.closingDay);
            // billMonth é SEMPRE o mês atual para cálculo de parcelamentos
            billMonth = currentMonth;
            billYear = currentYear;
        } else {
            // Fatura aberta é do mês atual
            billStartDate = new Date(currentYear, currentMonth - 1, card.closingDay + 1);
            billEndDate = new Date(currentYear, currentMonth, card.closingDay);
            billMonth = currentMonth;
            billYear = currentYear;
            if (currentMonth === 0) {
                billStartDate = new Date(currentYear - 1, 11, card.closingDay + 1);
            }
        }
    }

    // Correção 8: Filtrar transações pelo mês correto quando navegando
    const creditExpenses = transactions.filter(t => {
        if (t.type !== 'expense' || t.paymentMethod !== 'credit' || t.cardId !== card.id) return false;
        const transactionDate = new Date(t.date + 'T12:00:00');

        if (isNavigating) {
            // Ao navegar, mostrar apenas transações do mês visualizado
            return transactionDate.getMonth() === currentMonth &&
                   transactionDate.getFullYear() === currentYear;
        } else {
            // Modo real-time: usar período da fatura
            return transactionDate >= billStartDate && transactionDate <= billEndDate;
        }
    });

    const creditRefunds = transactions.filter(t => {
        if (t.type !== 'income' || t.paymentMethod !== 'credit' || t.cardId !== card.id) return false;
        const transactionDate = new Date(t.date + 'T12:00:00');

        if (isNavigating) {
            // Ao navegar, mostrar apenas transações do mês visualizado
            return transactionDate.getMonth() === currentMonth &&
                   transactionDate.getFullYear() === currentYear;
        } else {
            // Modo real-time: usar período da fatura
            return transactionDate >= billStartDate && transactionDate <= billEndDate;
        }
    });

    // Coletar parcelas do período
    const activeInstallments = installments.filter(inst => {
        if (inst.cardId !== card.id) return false;
        if (inst.startMonth === undefined || inst.startYear === undefined) {
            return inst.currentInstallment <= inst.totalInstallments;
        }
        const monthsSinceStart = (billYear - inst.startYear) * 12 + (billMonth - inst.startMonth);
        if (monthsSinceStart < 0) return false;
        const installmentForThisMonth = 1 + monthsSinceStart;
        return installmentForThisMonth >= 1 && installmentForThisMonth <= inst.totalInstallments;
    });

    // Coletar assinaturas ativas
    const activeSubscriptions = subscriptions.filter(sub => sub.cardId === card.id && sub.status === 'active');

    // Calcular totais
    const creditExpensesTotal = creditExpenses.reduce((sum, t) => sum + t.value, 0);
    const creditRefundsTotal = creditRefunds.reduce((sum, t) => sum + t.value, 0);
    const installmentsTotal = activeInstallments.reduce((sum, inst) => {
        const installmentValue = inst.installmentValue || (inst.totalValue / inst.totalInstallments);
        return sum + installmentValue;
    }, 0);
    const subscriptionsTotal = activeSubscriptions.reduce((sum, sub) => sum + sub.value, 0);
    const grandTotal = creditExpensesTotal - creditRefundsTotal + installmentsTotal + subscriptionsTotal;

    // Montar o HTML do modal em 3 colunas
    const monthName = new Date(billYear, billMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    document.getElementById('cardBillDetailsTitle').textContent = `Fatura ${card.name} - ${monthName}`;

    // Verificar se a fatura está paga
    const billPayment = isBillPaid(cardId, billMonth, billYear);
    const isPaid = !!billPayment;

    let html = `
        <div style="margin-bottom: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: ${isPaid ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)'}; border-radius: 12px; border: 1px solid ${isPaid ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'};">
                <div>
                    <div style="font-size: 0.875rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.5rem;">
                        Total da Fatura
                        ${isPaid ? `<span style="background: #10b981; color: #fff; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.65rem; font-weight: 600;">PAGO</span>` : ''}
                    </div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: ${isPaid ? '#10b981' : '#3b82f6'};">${formatCurrencyDisplay(grandTotal)}</div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                    <div style="text-align: right; font-size: 0.75rem; color: var(--text-muted);">
                        <div>Período: ${billStartDate.toLocaleDateString('pt-BR')} a ${billEndDate.toLocaleDateString('pt-BR')}</div>
                        <div>Vencimento: ${card.dueDay}/${billMonth === 11 ? '01' : String(billMonth + 2).padStart(2, '0')}</div>
                    </div>
                    ${grandTotal > 0 ? (isPaid
                        ? `<button onclick="unmarkBillAsPaid('${billPayment.id}')" style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #ef4444; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;">
                            <i class="fas fa-undo"></i> Desfazer Pagamento
                           </button>`
                        : `<button onclick="markBillAsPaid('${cardId}', ${billMonth}, ${billYear}, ${grandTotal})" style="background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #10b981; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;">
                            <i class="fas fa-check"></i> Pagar Fatura
                           </button>`
                    ) : ''}
                </div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
            <!-- Coluna 1: Compras e Reembolsos -->
            <div style="display: flex; flex-direction: column;">
                <h3 style="font-size: 0.875rem; margin-bottom: 0.75rem; color: #3b82f6; display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                    <i class="fas fa-credit-card"></i>
                    Compras (${creditExpenses.length}) ${creditRefunds.length > 0 ? `• Reembolsos (${creditRefunds.length})` : ''}
                    <span style="margin-left: auto; font-size: 0.75rem;">${formatCurrencyDisplay(creditExpensesTotal - creditRefundsTotal)}</span>
                </h3>
                <div style="background: var(--color-bg-tertiary); border-radius: 8px; border: 1px solid var(--color-border); overflow-y: auto; flex: 1; max-height: 400px;">
                    ${creditExpenses.length === 0 && creditRefunds.length === 0
                        ? '<div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.875rem;">Nenhuma transação</div>'
                        : `
                            ${creditExpenses.map(t => `
                                <div style="padding: 0.75rem; border-bottom: 1px solid var(--color-border);">
                                    <div style="font-weight: 500; color: #fff; font-size: 0.875rem; margin-bottom: 0.25rem;">${t.description}</div>
                                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.25rem;">${new Date(t.date).toLocaleDateString('pt-BR')}</div>
                                    <div style="font-weight: 600; color: #3b82f6; font-size: 0.875rem;">${formatCurrencyDisplay(t.value)}</div>
                                </div>
                            `).join('')}
                            ${creditRefunds.map(t => `
                                <div style="padding: 0.75rem; border-bottom: 1px solid var(--color-border); background: rgba(16, 185, 129, 0.05);">
                                    <div style="font-weight: 500; color: #fff; font-size: 0.875rem; margin-bottom: 0.25rem;">
                                        <i class="fas fa-undo" style="color: #10b981; font-size: 0.7rem; margin-right: 0.25rem;"></i>
                                        ${t.description}
                                    </div>
                                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.25rem;">${new Date(t.date).toLocaleDateString('pt-BR')} • Reembolso</div>
                                    <div style="font-weight: 600; color: #10b981; font-size: 0.875rem;">- ${formatCurrencyDisplay(t.value)}</div>
                                </div>
                            `).join('')}
                        `
                    }
                </div>
            </div>

            <!-- Coluna 2: Parcelamentos -->
            <div style="display: flex; flex-direction: column;">
                <h3 style="font-size: 0.875rem; margin-bottom: 0.75rem; color: #f59e0b; display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                    <i class="fas fa-calendar-alt"></i>
                    Parcelas (${activeInstallments.length})
                    <span style="margin-left: auto; font-size: 0.75rem;">${formatCurrencyDisplay(installmentsTotal)}</span>
                </h3>
                <div style="background: var(--color-bg-tertiary); border-radius: 8px; border: 1px solid var(--color-border); overflow-y: auto; flex: 1; max-height: 400px;">
                    ${activeInstallments.length > 0 ? activeInstallments.map(inst => {
                        let currentInstallmentNum;
                        if (inst.startMonth !== undefined && inst.startYear !== undefined) {
                            const monthsSinceStart = (billYear - inst.startYear) * 12 + (billMonth - inst.startMonth);
                            currentInstallmentNum = 1 + monthsSinceStart;
                        } else {
                            currentInstallmentNum = inst.currentInstallment || 1;
                        }
                        const installmentValue = inst.installmentValue || (inst.totalValue / inst.totalInstallments);
                        return `
                            <div style="padding: 0.75rem; border-bottom: 1px solid var(--color-border);">
                                <div style="font-weight: 500; color: #fff; font-size: 0.875rem; margin-bottom: 0.25rem;">${inst.description}</div>
                                <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.25rem;">Parcela ${currentInstallmentNum}/${inst.totalInstallments}</div>
                                <div style="font-weight: 600; color: #f59e0b; font-size: 0.875rem;">${formatCurrencyDisplay(installmentValue)}</div>
                            </div>
                        `;
                    }).join('') : '<div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.875rem;">Nenhuma parcela</div>'}
                </div>
            </div>

            <!-- Coluna 3: Assinaturas -->
            <div style="display: flex; flex-direction: column;">
                <h3 style="font-size: 0.875rem; margin-bottom: 0.75rem; color: #8b5cf6; display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                    <i class="fas fa-sync-alt"></i>
                    Assinaturas (${activeSubscriptions.length})
                    <span style="margin-left: auto; font-size: 0.75rem;">${formatCurrencyDisplay(subscriptionsTotal)}</span>
                </h3>
                <div style="background: var(--color-bg-tertiary); border-radius: 8px; border: 1px solid var(--color-border); overflow-y: auto; flex: 1; max-height: 400px;">
                    ${activeSubscriptions.length > 0 ? activeSubscriptions.map(sub => `
                        <div style="padding: 0.75rem; border-bottom: 1px solid var(--color-border);">
                            <div style="font-weight: 500; color: #fff; font-size: 0.875rem; margin-bottom: 0.25rem;">${sub.name}</div>
                            <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.25rem;">${sub.category}</div>
                            <div style="font-weight: 600; color: #8b5cf6; font-size: 0.875rem;">${formatCurrencyDisplay(sub.value)}</div>
                        </div>
                    `).join('') : '<div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.875rem;">Nenhuma assinatura</div>'}
                </div>
            </div>
        </div>
    `;

    document.getElementById('cardBillDetailsContent').innerHTML = html;
    document.getElementById('cardBillDetailsModal').classList.add('active');
}

let selectedCardId = null;

// ===========================
// CREDIT CARDS - CRUD
// ===========================
// 📲 Processa envio do formulário de cartão de crédito
async function handleCreditCardSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('cardName').value.trim();
    const institution = document.getElementById('cardInstitution').value.trim();
    const limitStr = document.getElementById('cardLimit').value;
    const closingDay = parseInt(document.getElementById('cardClosingDay').value);
    const dueDay = parseInt(document.getElementById('cardDueDay').value);

    if (!name || !institution || !limitStr) {
        showToast('Preencha todos os campos', 'error');
        return;
    }

    const limit = parseCurrencyInput(limitStr);
    if (limit <= 0) {
        showToast('Limite inválido', 'error');
        return;
    }

    if (closingDay < 1 || closingDay > 31 || dueDay < 1 || dueDay > 31) {
        showToast('Dias devem estar entre 1 e 31', 'error');
        return;
    }

    showLoading(editingCardId ? 'Atualizando cartão...' : 'Salvando cartão...');

    try {
        const cardData = {
            userId: activeUserId,
            name,
            institution,
            limit,
            closingDay,
            dueDay
        };

        if (editingCardId) {
            await db.collection('creditCards').doc(editingCardId).update({
                ...cardData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Cartão atualizado com sucesso', 'success');
        } else {
            await db.collection('creditCards').add({
                ...cardData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Cartão adicionado com sucesso', 'success');
        }

        await loadCreditCards();
        updateAllDisplays();
        closeCreditCardModal();
    } catch (error) {
        console.error('Erro ao salvar cartão:', error);
        showToast('Erro ao salvar cartão', 'error');
    } finally {
        hideLoading();
    }
}

// 📲 Processa envio de gasto avulso no cartão (sistema antigo)
async function handleCardExpenseSubmit(e) {
    e.preventDefault();

    const cardId = document.getElementById('expenseCard').value;
    const description = document.getElementById('expenseDescription').value.trim();
    const valueStr = document.getElementById('expenseValue').value;
    const date = document.getElementById('expenseDate').value;
    const category = document.getElementById('expenseCategory').value;

    if (!cardId || !description || !valueStr || !date || !category) {
        showToast('Preencha todos os campos', 'error');
        return;
    }

    const value = parseCurrencyInput(valueStr);
    if (value <= 0) {
        showToast('Valor inválido', 'error');
        return;
    }

    showLoading('Salvando gasto...');

    try {
        await db.collection('cardExpenses').add({
            userId: activeUserId,
            cardId,
            description,
            value,
            date,
            category,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await loadCardExpenses();
        updateAllDisplays();
        closeCardExpenseModal();
        showToast('Gasto adicionado com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao salvar gasto:', error);
        showToast('Erro ao salvar gasto', 'error');
    } finally {
        hideLoading();
    }
}

// 🗄️ Deleta um cartão de crédito do Firestore
async function deleteCreditCard(id) {
    if (!confirm('Deseja realmente deletar este cartão? Todos os gastos associados serão mantidos.')) return;

    showLoading('Deletando...');

    try {
        await db.collection('creditCards').doc(id).delete();
        await loadCreditCards();
        updateAllDisplays();
        showToast('Cartão deletado com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao deletar cartão:', error);
        showToast('Erro ao deletar cartão', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// INSTALLMENT HELPER FUNCTIONS
// ===========================
// 🔄 Verifica se um parcelamento está ativo em determinado mês
function isInstallmentActiveInMonth(installment, targetMonth, targetYear) {
    // Para parcelamentos antigos sem startMonth/startYear, usar valor salvo
    if (installment.startMonth === undefined || installment.startYear === undefined) {
        const savedCurrent = installment.currentInstallment || (installment.paidInstallments ? installment.paidInstallments + 1 : 1);
        return savedCurrent <= installment.totalInstallments;
    }

    // Calcular quantos meses se passaram desde o início até o mês alvo
    const monthsDiff = (targetYear - installment.startYear) * 12 + (targetMonth - installment.startMonth);

    // Se o mês selecionado é antes do início, não mostrar
    if (monthsDiff < 0) {
        return false;
    }

    // Calcular qual parcela estaria sendo cobrada no mês selecionado
    // Parcela 1 no mês de início, então: 1 + meses que se passaram
    const calculatedInstallment = 1 + monthsDiff;

    // Só mostrar se a parcela calculada ainda está dentro do total
    return calculatedInstallment <= installment.totalInstallments;
}

// ===========================
// KPI CALCULATIONS
// ===========================
// 🔄 Atualiza todos os indicadores (KPIs) do dashboard
function updateKPIs() {
    // Usar mês selecionado se disponível, senão mês atual
    const displayMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
    const displayYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();
    const currentMonth = displayMonth;
    const currentYear = displayYear;

    // Filter transactions for current month
    const currentMonthTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === currentMonth &&
               transactionDate.getFullYear() === currentYear;
    });

    // Total Income (current month) - exclui reembolsos no crédito
    const totalIncome = currentMonthTransactions
        .filter(t => t.type === 'income' && t.paymentMethod !== 'credit')
        .reduce((sum, t) => sum + t.value, 0);

    // Total Expense (current month) - apenas débito direto (crédito é contado na fatura do cartão)
    // NOTA: Isso já inclui pagamentos de fatura (que são transações de débito automáticas)
    const totalExpenseDebit = currentMonthTransactions
        .filter(t => t.type === 'expense' && t.paymentMethod !== 'credit')
        .reduce((sum, t) => sum + t.value, 0);

    // Total Credit Cards (current bills) - calculado antes para usar no totalExpense
    console.log(`\n💳💳💳 Calculando TOTAL de faturas de ${creditCards.length} cartões:`);
    const totalCreditCards = creditCards.reduce((sum, card) => {
        const billValue = calculateCurrentBill(card, currentMonth, currentYear);
        console.log(`   📌 "${card.name}": R$ ${billValue.toFixed(2)}`);
        return sum + billValue;
    }, 0);
    console.log(`   🧾 SOMA TOTAL DAS FATURAS: R$ ${totalCreditCards.toFixed(2)}\n`);

    // Calcular faturas pagas e não pagas do mês atual
    const paidBillsThisMonth = creditCardPayments.filter(p =>
        p.month === currentMonth && p.year === currentYear
    );
    const totalPaidBills = paidBillsThisMonth.reduce((sum, p) => sum + (p.paidAmount || 0), 0);

    // Faturas não pagas = Total das faturas - Faturas que já foram pagas
    // Calculamos para cada cartão se a fatura do mês está paga
    const totalUnpaidBills = creditCards.reduce((sum, card) => {
        const billValue = calculateCurrentBill(card, currentMonth, currentYear);
        const isPaid = isBillPaid(card.id, currentMonth, currentYear);
        return sum + (isPaid ? 0 : billValue);
    }, 0);

    // Projeções de saída pendentes do mês atual
    const pendingExpenseProjections = projections
        .filter(p => {
            if (p.status !== 'pending') return false;
            if (p.type !== 'expense') return false; // Apenas projeções de saída
            const projDate = new Date(p.date + 'T12:00:00');
            return projDate.getMonth() === currentMonth && projDate.getFullYear() === currentYear;
        })
        .reduce((sum, p) => sum + p.value, 0);

    // Projeções de entrada pendentes do mês atual
    const pendingIncomeProjections = projections
        .filter(p => {
            if (p.status !== 'pending') return false;
            // Aceita 'income' explícito ou ausência de type (compatibilidade)
            if (p.type && p.type !== 'income') return false;
            const projDate = new Date(p.date + 'T12:00:00');
            return projDate.getMonth() === currentMonth && projDate.getFullYear() === currentYear;
        })
        .reduce((sum, p) => sum + p.value, 0);

    // Total Expense = débito (saídas efetivas)
    // Saídas Efetivas = débito direto (já inclui pagamentos de faturas via transação automática)
    const totalExpenseActual = totalExpenseDebit;

    // Projeção de Saída = faturas não pagas + projeções de saída pendentes
    const totalExpenseProjection = totalUnpaidBills + pendingExpenseProjections;

    // Total geral de saídas (atual + projeção)
    const totalExpense = totalExpenseActual + totalExpenseProjection;

    // SALDO BANCÁRIO REAL = Entradas - Saídas em débito - Investimentos
    const totalIncomeAllTime = transactions
        .filter(t => t.type === 'income' && t.paymentMethod !== 'credit')
        .reduce((sum, t) => sum + t.value, 0);

    const totalDebitAllTime = transactions
        .filter(t => t.type === 'expense' && t.paymentMethod !== 'credit')
        .reduce((sum, t) => sum + t.value, 0);

    // Total de investimentos
    const totalInvestments = investments.reduce((sum, inv) => sum + inv.value, 0);

    // SALDO = Entradas - Saídas(débito) - Investimentos
    // NOTA: As saídas de débito já incluem pagamentos de fatura (via transação automática)
    // Então o saldo desconta automaticamente quando a fatura é paga
    const totalBalance = totalIncomeAllTime - totalDebitAllTime - totalInvestments;

    // Log de debug para verificar cálculos
    console.log('[KPIs] Cálculos do mês:', {
        mes: `${currentMonth + 1}/${currentYear}`,
        entradas: totalIncome,
        saidasDebito: totalExpenseDebit,
        saidasEfetivas: totalExpenseActual,
        projecaoSaidas: totalExpenseProjection,
        projecoesSaidaPendentes: pendingExpenseProjections,
        faturaCartoes: totalCreditCards,
        faturasPagas: totalPaidBills,
        faturasNaoPagas: totalUnpaidBills,
        saidasTotal: totalExpense,
        investimentos: totalInvestments,
        saldo: totalBalance
    });

    console.log('[KPIs] Componentes do saldo:', {
        entradasHistoricas: totalIncomeAllTime,
        saidasDebito: totalDebitAllTime,
        investimentos: totalInvestments,
        saldoCalculado: totalBalance
    });

    // Total Active Subscriptions
    const totalSubscriptions = subscriptions
        .filter(s => s.status === 'active')
        .reduce((sum, s) => sum + s.value, 0);

    // Total Pending Installments (all remaining)
    const totalInstallments = installments.reduce((sum, inst) => {
        const current = calculateCurrentInstallment(inst);
        const remaining = inst.totalInstallments - current + 1;
        const installmentValue = inst.totalValue / inst.totalInstallments;
        return sum + (installmentValue * remaining);
    }, 0);

    // Monthly Installments (only current selected month)
    const monthlyInstallments = installments.reduce((sum, inst) => {
        // Verifica se a parcela está ativa no mês selecionado
        const isActive = isInstallmentActiveInMonth(inst, currentMonth, currentYear);
        console.log(`Parcelamento "${inst.description}": ativo=${isActive}, currentInstallment=${inst.currentInstallment}, total=${inst.totalInstallments}, startMonth=${inst.startMonth}, startYear=${inst.startYear}`);

        if (isActive) {
            const installmentValue = inst.totalValue / inst.totalInstallments;
            return sum + installmentValue;
        }
        return sum;
    }, 0);

    // Projection for Current Month (mudado de Next Month)
    const totalProjection = projections
        .filter(p => {
            if (p.status !== 'pending') return false;
            const projDate = new Date(p.date + 'T12:00:00');
            return projDate.getMonth() === currentMonth && projDate.getFullYear() === currentYear;
        })
        .reduce((sum, p) => sum + p.value, 0);

    // Update DOM
    const incomeEl = document.getElementById('totalIncome');
    const expenseEl = document.getElementById('totalExpense');
    const expenseProjectionEl = document.getElementById('totalExpenseProjection');
    const balanceEl = document.getElementById('totalBalance');
    const subscriptionsEl = document.getElementById('totalSubscriptions');
    const installmentsEl = document.getElementById('totalInstallments');
    const installmentsMonthlyEl = document.getElementById('installmentsMonthly');
    const installmentsTotalEl = document.getElementById('installmentsTotal');
    const projectionEl = document.getElementById('totalProjection');
    const creditCardsEl = document.getElementById('totalCreditCards');
    const investmentsEl = document.getElementById('totalInvestments');

    if (incomeEl) incomeEl.textContent = formatCurrencyDisplay(totalIncome);

    // Atualiza projeção de entradas
    const incomeProjectionEl = document.getElementById('totalIncomeProjection');
    if (incomeProjectionEl) {
        const totalIncomeTotal = totalIncome + pendingIncomeProjections;
        incomeProjectionEl.textContent = `= ${formatCurrencyDisplay(totalIncomeTotal)}`;
        incomeProjectionEl.style.display = pendingIncomeProjections > 0 ? 'block' : 'none';
    }

    // Card de Saídas com dois valores
    // Correção 3: Projeção mostra total = atual + faturas não pagas + projeções de saída pendentes
    const totalExpenseTotal = totalExpenseActual + totalUnpaidBills + pendingExpenseProjections;
    if (expenseEl) expenseEl.textContent = formatCurrencyDisplay(totalExpenseActual);
    if (expenseProjectionEl) {
        expenseProjectionEl.textContent = `= ${formatCurrencyDisplay(totalExpenseTotal)}`;
        expenseProjectionEl.style.display = totalExpenseProjection > 0 ? 'block' : 'none';
    }

    // Projeção de saldo = saldo atual + entradas pendentes - faturas não pagas - projeções de saída pendentes
    const balanceProjection = totalBalance + pendingIncomeProjections - totalUnpaidBills - pendingExpenseProjections;
    if (balanceEl) balanceEl.textContent = formatCurrencyDisplay(totalBalance);
    const balanceProjectionEl = document.getElementById('balanceProjection');
    if (balanceProjectionEl) {
        balanceProjectionEl.textContent = `Proj: ${formatCurrencyDisplay(balanceProjection)}`;
        balanceProjectionEl.style.display = totalExpenseProjection > 0 ? 'block' : 'none';
    }
    if (subscriptionsEl) subscriptionsEl.textContent = formatCurrencyDisplay(totalSubscriptions);

    // Atualiza o card de parcelamentos com ambos os valores
    if (installmentsEl) installmentsEl.textContent = formatCurrencyDisplay(monthlyInstallments);
    if (installmentsMonthlyEl) installmentsMonthlyEl.textContent = formatCurrencyDisplay(monthlyInstallments);
    if (installmentsTotalEl) installmentsTotalEl.textContent = formatCurrencyDisplay(totalInstallments);

    if (projectionEl) projectionEl.textContent = formatCurrencyDisplay(totalProjection);
    if (creditCardsEl) creditCardsEl.textContent = formatCurrencyDisplay(totalCreditCards);
    if (investmentsEl) investmentsEl.textContent = formatCurrencyDisplay(totalInvestments);
}

// ===========================
// APEXCHARTS - INITIALIZATION
// ===========================

// 🔄 Destrói todas as instâncias de gráficos antes de recriar
function destroyAllCharts() {
    console.log('Destruindo gráficos existentes...');

    if (cashFlowChart) {
        cashFlowChart.destroy();
        cashFlowChart = null;
    }
    if (categoryChart) {
        categoryChart.destroy();
        categoryChart = null;
    }
    if (paymentMethodChart) {
        paymentMethodChart.destroy();
        paymentMethodChart = null;
    }
    if (comparisonChart) {
        comparisonChart.destroy();
        comparisonChart = null;
    }
    if (topCategoriesChart) {
        topCategoriesChart.destroy();
        topCategoriesChart = null;
    }
    if (weeklyTrendChart) {
        weeklyTrendChart.destroy();
        weeklyTrendChart = null;
    }
    if (savingsGoalChart) {
        savingsGoalChart.destroy();
        savingsGoalChart = null;
    }
    if (expenseLimitChart) {
        expenseLimitChart.destroy();
        expenseLimitChart = null;
    }
}

// 🔄 Inicializa todos os gráficos do dashboard
function initializeCharts() {
    try {
        // Destruir gráficos existentes antes de criar novos
        destroyAllCharts();

        initializeCashFlowChart();
        initializeCategoryChart();
        initializePaymentMethodChart();
        initializeComparisonChart();
        initializeSavingsGoalChart();
        initializeExpenseLimitChart();
        initializeGrowthSparkline();
        initializeExpenseTrendSparkline();
        initializeTopCategoriesChart();
        initializeWeeklyTrendChart();
        console.log('Gráficos inicializados');
    } catch (error) {
        console.error('Erro ao inicializar gráficos:', error);
    }
}

// 🔄 Atualiza dados de todos os gráficos existentes
function updateCharts() {
    try {
        console.log('[updateCharts] Atualizando todos os gráficos...');
        updateCashFlowChart();
        updateCategoryChart();
        updatePaymentMethodChart();
        updateComparisonChart();
        updateTopCategoriesChart();
        updateWeeklyTrendChart();
        console.log('[updateCharts] Gráficos atualizados!');
    } catch (error) {
        console.error('Erro ao atualizar gráficos:', error);
    }
}

// ===========================
// CASH FLOW CHART
// ===========================
// 🎨 Cria gráfico de fluxo de caixa (entradas vs saídas)
function initializeCashFlowChart() {
    const chartEl = document.querySelector("#cashFlowChart");
    if (!chartEl) return;

    const data = getCashFlowData();

    const options = {
        series: [
            {
                name: 'Entradas',
                data: data.incomes
            },
            {
                name: 'Saídas',
                data: data.expenses
            }
        ],
        chart: {
            type: 'area',
            height: '100%',
            parentHeightOffset: 0,
            toolbar: {
                show: true,
                tools: {
                    download: true,
                    zoom: true,
                    zoomin: true,
                    zoomout: true,
                    pan: true,
                    reset: true
                }
            },
            fontFamily: 'Inter, sans-serif',
            redrawOnParentResize: true
        },
        colors: ['#10b981', '#ef4444'],
        dataLabels: {
            enabled: false
        },
        stroke: {
            curve: 'smooth',
            width: 2
        },
        fill: {
            type: 'gradient',
            gradient: {
                opacityFrom: 0.6,
                opacityTo: 0.1
            }
        },
        xaxis: {
            categories: data.months,
            labels: {
                style: {
                    colors: '#64748b',
                    fontSize: '12px'
                }
            }
        },
        yaxis: {
            labels: {
                formatter: function (value) {
                    return 'R$ ' + value.toFixed(0);
                },
                style: {
                    colors: '#64748b',
                    fontSize: '12px'
                }
            }
        },
        tooltip: {
            y: {
                formatter: function (value) {
                    return formatCurrencyDisplay(value);
                }
            }
        },
        grid: {
            borderColor: '#e2e8f0',
            strokeDashArray: 4
        },
        legend: {
            show: false
        }
    };

    cashFlowChart = new ApexCharts(chartEl, options);
    cashFlowChart.render();
}

// 🔄 Atualiza dados do gráfico de fluxo de caixa
function updateCashFlowChart() {
    const data = getCashFlowData();
    // Atualizar tanto as séries quanto as categorias do eixo X
    cashFlowChart.updateOptions({
        xaxis: {
            categories: data.months
        }
    });
    cashFlowChart.updateSeries([
        { name: 'Entradas', data: data.incomes },
        { name: 'Saídas', data: data.expenses }
    ]);
}

// 📊 Obtém dados de entradas e saídas dos últimos 12 meses (baseado no mês selecionado)
function getCashFlowData() {
    const months = [];
    const incomes = [];
    const expenses = [];

    // Usar mês/ano selecionado como referência (em vez da data atual)
    const displayMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
    const displayYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();

    // Criar data de referência baseada no mês selecionado
    const referenceDate = new Date(displayYear, displayMonth, 1);

    // Get last 12 months from the selected month
    for (let i = 11; i >= 0; i--) {
        const date = new Date(referenceDate);
        date.setMonth(date.getMonth() - i);

        const monthName = date.toLocaleDateString('pt-BR', { month: 'short' });
        months.push(monthName.charAt(0).toUpperCase() + monthName.slice(1));

        const monthTransactions = transactions.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate.getMonth() === date.getMonth() &&
                   transactionDate.getFullYear() === date.getFullYear();
        });

        const monthIncome = monthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.value, 0);

        const monthExpense = monthTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + t.value, 0);

        incomes.push(monthIncome);
        expenses.push(monthExpense);
    }

    return { months, incomes, expenses };
}

// ===========================
// CATEGORY CHART (DONUT)
// ===========================
// 🎨 Cria gráfico de pizza com distribuição de despesas por categoria
function initializeCategoryChart() {
    const chartEl = document.querySelector("#categoryChart");
    if (!chartEl) return;

    const data = getCategoryData();

    // Se não há dados, mostra mensagem
    if (data.values.length === 0) {
        chartEl.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 350px; color: #94a3b8;">Sem dados para exibir</div>';
        return;
    }

    const options = {
        series: data.values,
        chart: {
            type: 'pie',
            height: '100%',
            background: 'transparent',
            fontFamily: 'Inter, sans-serif'
        },
        labels: data.categories,
        colors: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'],
        plotOptions: {
            pie: {
                offsetY: 0,
                customScale: 0.85,
                dataLabels: {
                    offset: -5,
                    minAngleToShowLabel: 10
                }
            }
        },
        legend: {
            show: true,
            position: 'right',
            fontSize: '10px',
            labels: {
                colors: '#94a3b8'
            },
            itemMargin: {
                vertical: 2
            },
            formatter: function(seriesName, opts) {
                return seriesName.length > 12 ? seriesName.substring(0, 12) + '...' : seriesName;
            }
        },
        stroke: {
            width: 1,
            colors: ['#1e293b']
        },
        dataLabels: {
            enabled: true,
            formatter: function(val, opts) {
                return val.toFixed(0) + '%';
            },
            style: {
                fontSize: '10px',
                fontWeight: 600,
                colors: ['#fff']
            },
            dropShadow: {
                enabled: true,
                blur: 2,
                opacity: 0.8
            }
        },
        tooltip: {
            y: {
                formatter: function (value) {
                    return formatCurrencyDisplay(value);
                }
            }
        },
        responsive: [{
            breakpoint: 1400,
            options: {
                legend: {
                    position: 'bottom',
                    fontSize: '9px'
                }
            }
        }]
    };

    categoryChart = new ApexCharts(chartEl, options);
    categoryChart.render();
}

// 🔄 Atualiza dados do gráfico de categorias
function updateCategoryChart() {
    const data = getCategoryData();
    const chartEl = document.querySelector("#categoryChart");

    if (data.values.length === 0) {
        // Destroi o chart se não há dados
        if (categoryChart) {
            categoryChart.destroy();
            categoryChart = null;
        }
        if (chartEl) {
            chartEl.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #94a3b8;">Sem dados para exibir</div>';
        }
        return;
    }

    // Se há dados mas gráfico não existe, limpa o elemento e recria
    if (!categoryChart) {
        if (chartEl) {
            chartEl.innerHTML = ''; // Limpa mensagem de "sem dados"
        }
        initializeCategoryChart();
        return;
    }

    // Atualiza gráfico existente
    categoryChart.updateOptions({
        labels: data.categories,
        series: data.values
    });
}

// 📊 Obtém dados de despesas agrupadas por categoria do mês atual
function getCategoryData() {
    const categoryMap = {};

    // Usar mês selecionado se disponível
    const displayMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
    const displayYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();

    transactions.forEach(t => {
        if (t.type === 'expense') {
            const transactionDate = new Date(t.date);
            if (transactionDate.getMonth() === displayMonth &&
                transactionDate.getFullYear() === displayYear) {
                categoryMap[t.category] = (categoryMap[t.category] || 0) + t.value;
            }
        }
    });

    const categories = Object.keys(categoryMap);
    const values = Object.values(categoryMap);

    return { categories, values };
}

// ===========================
// PAYMENT METHOD CHART (POLAR AREA)
// ===========================
// 🎨 Cria gráfico polar area com análise de métodos de pagamento
function initializePaymentMethodChart() {
    const chartEl = document.querySelector("#paymentMethodChart");
    if (!chartEl) return;

    const data = getPaymentMethodData();

    // Se não há dados, mostra mensagem
    if (!data.hasData || data.values.length === 0) {
        chartEl.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #94a3b8;">Sem dados para exibir</div>';
        return;
    }

    // Mapear cores para cada tipo de pagamento
    const colorMap = {
        'Débito/Pix': '#22c55e',
        'Crédito': '#3b82f6'
    };
    const colors = data.labels.map(label => colorMap[label] || '#94a3b8');

    const options = {
        series: data.values,
        chart: {
            type: 'polarArea',
            height: '100%',
            background: 'transparent',
            fontFamily: 'Inter, sans-serif'
        },
        labels: data.labels,
        colors: colors,
        plotOptions: {
            polarArea: {
                rings: {
                    strokeWidth: 1,
                    strokeColor: 'rgba(255,255,255,0.1)'
                },
                spokes: {
                    strokeWidth: 1,
                    connectorColors: 'rgba(255,255,255,0.1)'
                }
            }
        },
        stroke: {
            width: 1,
            colors: ['#1e293b']
        },
        fill: {
            opacity: 0.8
        },
        legend: {
            show: true,
            position: 'bottom',
            fontSize: '10px',
            labels: {
                colors: '#94a3b8'
            },
            markers: {
                width: 10,
                height: 10
            }
        },
        dataLabels: {
            enabled: false
        },
        tooltip: {
            y: {
                formatter: function (value) {
                    return formatCurrencyDisplay(value);
                }
            }
        },
        yaxis: {
            show: false
        },
        responsive: [{
            breakpoint: 1400,
            options: {
                legend: {
                    fontSize: '9px'
                }
            }
        }]
    };

    paymentMethodChart = new ApexCharts(chartEl, options);
    paymentMethodChart.render();
}

// 🔄 Atualiza dados do gráfico de métodos de pagamento
function updatePaymentMethodChart() {
    const data = getPaymentMethodData();
    const chartEl = document.querySelector("#paymentMethodChart");

    if (!data.hasData || data.values.length === 0) {
        // Destroi o chart se não há dados
        if (paymentMethodChart) {
            paymentMethodChart.destroy();
            paymentMethodChart = null;
        }
        if (chartEl) {
            chartEl.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #94a3b8;">Sem dados para exibir</div>';
        }
        return;
    }

    // Se há dados mas gráfico não existe, limpa o elemento e recria
    if (!paymentMethodChart) {
        if (chartEl) {
            chartEl.innerHTML = ''; // Limpa mensagem de "sem dados"
        }
        initializePaymentMethodChart();
        return;
    }

    // Atualiza gráfico existente - destruir e recriar para evitar problemas com labels dinâmicos
    paymentMethodChart.destroy();
    paymentMethodChart = null;
    if (chartEl) {
        chartEl.innerHTML = '';
    }
    initializePaymentMethodChart();
}

// 📊 Obtém dados de métodos de pagamento do mês atual
function getPaymentMethodData() {
    const displayMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
    const displayYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();

    let debitTotal = 0;
    let creditTotal = 0;
    let pixDinheiroTotal = 0;

    // Transações do mês
    transactions.forEach(t => {
        if (t.type === 'expense') {
            const transactionDate = new Date(t.date);
            if (transactionDate.getMonth() === displayMonth &&
                transactionDate.getFullYear() === displayYear) {
                if (t.paymentMethod === 'credit') {
                    creditTotal += t.value;
                } else if (t.paymentMethod === 'debit') {
                    debitTotal += t.value;
                } else {
                    // Transações sem método definido são consideradas Pix/Dinheiro
                    pixDinheiroTotal += t.value;
                }
            }
        }
    });

    // Adicionar valores de cartões de crédito (parcelamentos e assinaturas)
    if (typeof creditCards !== 'undefined' && creditCards.length > 0) {
        creditCards.forEach(card => {
            if (typeof calculateCurrentBill === 'function') {
                const billValue = calculateCurrentBill(card, displayMonth, displayYear);
                creditTotal += billValue;
            }
        });
    }

    // Preparar valores - filtrar apenas os que têm valor > 0
    const allData = [
        { label: 'Débito/Pix', value: Math.round((debitTotal + pixDinheiroTotal) * 100) / 100 },
        { label: 'Crédito', value: Math.round(creditTotal * 100) / 100 }
    ];

    // Filtrar apenas valores positivos para evitar erro de altura negativa no gráfico
    const filteredData = allData.filter(d => d.value > 0);

    return {
        labels: filteredData.map(d => d.label),
        values: filteredData.map(d => d.value),
        hasData: filteredData.length > 0
    };
}

// ===========================
// COMPARISON CHART (BARS)
// ===========================
// 🎨 Cria gráfico de barras comparando receitas e despesas mensais
function initializeComparisonChart() {
    const chartEl = document.querySelector("#comparisonChart");
    if (!chartEl) return;

    const data = getComparisonData();

    const options = {
        series: [
            {
                name: 'Valor',
                data: data.values
            }
        ],
        chart: {
            type: 'bar',
            height: '100%',
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false }
        },
        plotOptions: {
            bar: {
                horizontal: true,
                distributed: true,
                barHeight: '55%',
                dataLabels: {
                    position: 'center'
                }
            }
        },
        colors: ['#10b981', '#ef4444'],
        dataLabels: {
            enabled: true,
            formatter: function (val) {
                return formatCurrencyDisplay(val);
            },
            offsetX: 0,
            style: {
                fontSize: '13px',
                fontWeight: 700,
                colors: ['#fff']
            },
            dropShadow: {
                enabled: true,
                blur: 2,
                opacity: 0.5
            }
        },
        xaxis: {
            categories: data.labels,
            labels: {
                show: false
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: {
                    colors: ['#10b981', '#ef4444'],
                    fontSize: '12px',
                    fontWeight: 600
                }
            }
        },
        grid: {
            show: false
        },
        tooltip: {
            enabled: false
        },
        legend: {
            show: false
        }
    };

    comparisonChart = new ApexCharts(chartEl, options);
    comparisonChart.render();
}

// 🔄 Atualiza dados do gráfico de comparação
function updateComparisonChart() {
    const data = getComparisonData();
    comparisonChart.updateSeries([{
        name: 'Valor',
        data: data.values
    }]);
}

// 📊 Obtém dados de comparação entre receitas e despesas por mês
function getComparisonData() {
    // Usar mês selecionado se disponível
    const currentMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
    const currentYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();

    const monthTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === currentMonth &&
               transactionDate.getFullYear() === currentYear;
    });

    const totalIncome = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.value, 0);

    const totalExpense = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.value, 0);

    return {
        labels: ['Entradas', 'Saídas'],
        values: [totalIncome, totalExpense]
    };
}

// ===========================
// MODALS
// ===========================
// 🎨 Abre modal para adicionar nova transação
function openTransactionModal() {
    editingTransactionId = null;
    document.getElementById('transactionModal').classList.add('active');
    document.getElementById('transactionForm').reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;

    // Reset payment method state
    currentTransactionType = 'income';
    currentPaymentMethod = 'debit';

    // Reset credit card dropdown explicitly and populate with cards
    const transactionCardSelect = document.getElementById('transactionCard');
    transactionCardSelect.value = '';
    populateTransactionCardOptions();

    selectTransactionType('income');
    document.querySelector('#transactionModal .modal-header h2').textContent = 'Nova Transação';
}

// 🎨 Fecha qualquer modal pelo ID
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// 🎨 Fecha modal de transação e reseta formulário
function closeTransactionModal() {
    editingTransactionId = null;
    currentPaymentMethod = 'debit';
    document.getElementById('transactionModal').classList.remove('active');
    document.getElementById('transactionForm').reset();
    // Ocultar campos condicionais
    document.getElementById('paymentMethodGroup').style.display = 'none';
    document.getElementById('creditCardGroup').style.display = 'none';
}

// 🎨 Abre modal para editar transação existente
function editTransaction(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    editingTransactionId = id;

    // Abre o modal
    document.getElementById('transactionModal').classList.add('active');

    // Atualiza título do modal
    document.querySelector('#transactionModal .modal-header h2').textContent = 'Editar Transação';

    // Preenche os campos
    document.getElementById('description').value = transaction.description;
    document.getElementById('value').value = formatCurrencyValue(transaction.value);
    document.getElementById('category').value = transaction.category;
    document.getElementById('date').value = transaction.date;

    // Define o tipo de transação
    currentTransactionType = transaction.type;
    selectTransactionType(transaction.type);

    // Define o método de pagamento (tanto para entrada quanto para saída)
    currentPaymentMethod = transaction.paymentMethod || 'debit';
    selectPaymentMethod(currentPaymentMethod);

    // Define o cartão se for crédito
    if (transaction.paymentMethod === 'credit' && transaction.cardId) {
        document.getElementById('transactionCard').value = transaction.cardId;
    }
}

// 🎨 Abre modal para adicionar nova assinatura
function openSubscriptionModal() {
    editingSubscriptionId = null;
    document.getElementById('subscriptionModal').classList.add('active');
    document.getElementById('subscriptionForm').reset();
    document.querySelector('#subscriptionModal .modal-header h2').textContent = 'Nova Assinatura';

    // Preenche dropdown de cartões
    const cardSelect = document.getElementById('subCard');
    cardSelect.innerHTML = '<option value="">Sem cartão</option>' +
        creditCards.map(card =>
            `<option value="${card.id}">${card.name} - ${card.institution}</option>`
        ).join('');
}

// 🎨 Fecha modal de assinatura
function closeSubscriptionModal() {
    editingSubscriptionId = null;
    document.getElementById('subscriptionModal').classList.remove('active');
    document.getElementById('subscriptionForm').reset();
}

// 🎨 Abre modal para editar assinatura existente
function editSubscription(id) {
    const subscription = subscriptions.find(s => s.id === id);
    if (!subscription) return;

    editingSubscriptionId = id;

    // Abre o modal
    document.getElementById('subscriptionModal').classList.add('active');

    // Atualiza título do modal
    document.querySelector('#subscriptionModal .modal-header h2').textContent = 'Editar Assinatura';

    // Preenche dropdown de cartões
    const cardSelect = document.getElementById('subCard');
    cardSelect.innerHTML = '<option value="">Sem cartão</option>' +
        creditCards.map(card =>
            `<option value="${card.id}" ${card.id === subscription.cardId ? 'selected' : ''}>${card.name} - ${card.institution}</option>`
        ).join('');

    // Preenche os campos
    document.getElementById('subName').value = subscription.name;
    document.getElementById('subValue').value = formatCurrencyValue(subscription.value);
    document.getElementById('subDueDay').value = subscription.dueDay;
    document.getElementById('subCategory').value = subscription.category;
    document.getElementById('subStatus').value = subscription.status;
}

// 🎨 Abre modal para adicionar novo parcelamento
function openInstallmentModal() {
    editingInstallmentId = null;
    document.getElementById('installmentModal').classList.add('active');
    document.getElementById('installmentForm').reset();
    document.getElementById('instCurrentInstallment').value = 1;
    // Define valor total como padrão
    selectInstallmentValueType('total');
    // Atualiza título do modal
    document.querySelector('#installmentModal .modal-header h2').textContent = 'Novo Parcelamento';

    // Preenche dropdown de cartões
    const cardSelect = document.getElementById('instCard');
    cardSelect.innerHTML = '<option value="">Selecione um cartão</option>' +
        creditCards.map(card =>
            `<option value="${card.id}">${card.name} - ${card.institution}</option>`
        ).join('');
}

// 🎨 Fecha modal de parcelamento
function closeInstallmentModal() {
    editingInstallmentId = null;
    document.getElementById('installmentModal').classList.remove('active');
    document.getElementById('installmentForm').reset();
    // Reset para valor total como padrão
    selectInstallmentValueType('total');
}

// 🎨 Abre modal para editar parcelamento existente
function editInstallment(id) {
    const installment = installments.find(inst => inst.id === id);
    if (!installment) return;

    editingInstallmentId = id;

    // Abre o modal
    document.getElementById('installmentModal').classList.add('active');

    // Atualiza título do modal
    document.querySelector('#installmentModal .modal-header h2').textContent = 'Editar Parcelamento';

    // Preenche dropdown de cartões
    const cardSelect = document.getElementById('instCard');
    cardSelect.innerHTML = '<option value="">Selecione um cartão</option>' +
        creditCards.map(card =>
            `<option value="${card.id}" ${card.id === installment.cardId ? 'selected' : ''}>${card.name} - ${card.institution}</option>`
        ).join('');

    // Preenche os campos
    document.getElementById('instDescription').value = installment.description;
    document.getElementById('instTotalInstallments').value = installment.totalInstallments;
    document.getElementById('instCurrentInstallment').value = installment.currentInstallment || 1;

    // Define como valor total e preenche
    selectInstallmentValueType('total');
    document.getElementById('instTotalValue').value = formatCurrencyValue(installment.totalValue);

    // Calcula e mostra o valor da parcela
    calculateInstallmentValues();
}

// Variável global para rastrear o tipo de valor selecionado no parcelamento
let installmentValueType = 'total';

// 📝 Alterna entre entrada de valor total ou valor por parcela
function selectInstallmentValueType(type) {
    installmentValueType = type;

    // Remove active de todos os botões
    const buttons = document.querySelectorAll('#installmentModal .type-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    // Adiciona active no botão clicado
    const activeButton = document.querySelector(`#installmentModal .type-btn[data-type="${type}"]`);
    if (activeButton) {
        activeButton.classList.add('active');
    }

    // Mostra/esconde os campos apropriados
    const totalValueGroup = document.getElementById('totalValueGroup');
    const installmentValueGroup = document.getElementById('installmentValueGroup');
    const totalValueInput = document.getElementById('instTotalValue');
    const installmentValueInput = document.getElementById('instInstallmentValue');

    if (type === 'total') {
        totalValueGroup.classList.remove('hidden');
        installmentValueGroup.classList.add('hidden');
        totalValueInput.required = true;
        installmentValueInput.required = false;
        installmentValueInput.value = '';
    } else {
        totalValueGroup.classList.add('hidden');
        installmentValueGroup.classList.remove('hidden');
        totalValueInput.required = false;
        installmentValueInput.required = true;
        totalValueInput.value = '';
    }
}

// 🔄 Calcula e exibe valor por parcela baseado no valor total
function calculateInstallmentValues() {
    const totalInstallments = parseInt(document.getElementById('instTotalInstallments').value) || 0;

    if (totalInstallments < 2) return;

    if (installmentValueType === 'total') {
        // Usuário digitou valor total, calcular valor da parcela
        const totalValueStr = document.getElementById('instTotalValue').value;
        if (!totalValueStr) return;

        const totalValue = parseCurrencyInput(totalValueStr);
        if (totalValue > 0) {
            const installmentValue = totalValue / totalInstallments;
            const installmentValueInput = document.getElementById('instInstallmentValue');
            installmentValueInput.value = formatCurrencyValue(installmentValue);
        }
    } else {
        // Usuário digitou valor da parcela, calcular valor total
        const installmentValueStr = document.getElementById('instInstallmentValue').value;
        if (!installmentValueStr) return;

        const installmentValue = parseCurrencyInput(installmentValueStr);
        if (installmentValue > 0) {
            const totalValue = installmentValue * totalInstallments;
            const totalValueInput = document.getElementById('instTotalValue');
            totalValueInput.value = formatCurrencyValue(totalValue);
        }
    }
}

// 🎨 Abre modal para adicionar nova projeção
function openProjectionModal() {
    editingProjectionId = null;
    currentProjectionType = 'income';
    document.getElementById('projectionModal').classList.add('active');
    document.getElementById('projectionForm').reset();
    document.querySelector('#projectionModal .modal-header h2').textContent = 'Nova Projeção';
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('projDate').value = today;
    document.getElementById('projStatus').value = 'pending';
    // Reset tipo para entrada
    selectProjectionType('income');
}

// 🎨 Abre modal para editar projeção existente
function editProjection(id) {
    const projection = projections.find(p => p.id === id);
    if (!projection) return;

    editingProjectionId = id;

    // Abre o modal
    document.getElementById('projectionModal').classList.add('active');

    // Atualiza título do modal
    document.querySelector('#projectionModal .modal-header h2').textContent = 'Editar Projeção';

    // Preenche os campos
    document.getElementById('projDescription').value = projection.description;
    document.getElementById('projValue').value = formatCurrencyValue(projection.value);
    document.getElementById('projDate').value = projection.date;
    document.getElementById('projStatus').value = projection.status || 'pending';

    // Seleciona o tipo correto (default: income para projeções antigas)
    const projType = projection.type || 'income';
    selectProjectionType(projType);
}

// 🎨 Fecha modal de projeção
function closeProjectionModal() {
    editingProjectionId = null;
    currentProjectionType = 'income';
    document.getElementById('projectionModal').classList.remove('active');
    document.getElementById('projectionForm').reset();
}

// 📝 Alterna tipo de projeção (entrada/saída) e atualiza labels
function selectProjectionType(type) {
    currentProjectionType = type;

    // Update active button dentro do modal de projeção
    document.querySelectorAll('#projectionForm .type-btn[data-type]').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === type) {
            btn.classList.add('active');
        }
    });

    // Atualiza label do status baseado no tipo
    const statusSelect = document.getElementById('projStatus');
    if (statusSelect) {
        const options = statusSelect.options;
        if (type === 'income') {
            options[0].textContent = 'Pendente';
            options[1].textContent = 'Recebido';
        } else {
            options[0].textContent = 'Pendente';
            options[1].textContent = 'Pago';
        }
    }
}

// 📝 Alterna tipo de transação (entrada/saída) e atualiza categorias
function selectTransactionType(type) {
    currentTransactionType = type;

    // Update active button
    document.querySelectorAll('.type-btn[data-type]').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === type) {
            btn.classList.add('active');
        }
    });

    // Sempre mostrar método de pagamento (para reembolsos em cartão também)
    const paymentMethodGroup = document.getElementById('paymentMethodGroup');
    paymentMethodGroup.style.display = 'block';
    // Reset to debit quando trocar de tipo
    selectPaymentMethod('debit');

    // Update categories
    populateCategories();
}

// 📝 Alterna método de pagamento (débito/crédito) e exibe campos apropriados
function selectPaymentMethod(method) {
    currentPaymentMethod = method;

    // Update active button
    document.querySelectorAll('.type-btn[data-method]').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.method === method) {
            btn.classList.add('active');
        }
    });

    // Show/hide credit card selector
    const creditCardGroup = document.getElementById('creditCardGroup');
    const transactionCardSelect = document.getElementById('transactionCard');

    if (method === 'credit') {
        creditCardGroup.style.display = 'block';
        transactionCardSelect.required = true;
        // Always repopulate with fresh data
        populateTransactionCardOptions();
        // Reset selection to empty (force user to choose)
        transactionCardSelect.value = '';
    } else {
        creditCardGroup.style.display = 'none';
        transactionCardSelect.required = false;
        // Clear dropdown when switching away from credit
        transactionCardSelect.innerHTML = '<option value="">Selecione um cartão</option>';
        transactionCardSelect.value = '';
    }
}

// 📝 Popula dropdown de cartões no formulário de transação
function populateTransactionCardOptions() {
    const select = document.getElementById('transactionCard');
    select.innerHTML = '<option value="">Selecione um cartão</option>';

    // Debug: Log card data before populating
    console.log('📋 [populateTransactionCardOptions] Cartões disponíveis:', creditCards.map(c => ({ id: c.id, name: c.name })));

    if (!creditCards || creditCards.length === 0) {
        console.warn('⚠️ Nenhum cartão disponível para seleção');
        return;
    }

    creditCards.forEach(card => {
        if (!card.id || !card.name) {
            console.error('❌ Cartão inválido:', card);
            return;
        }
        const option = document.createElement('option');
        option.value = card.id;
        option.textContent = `${card.name}${card.institution ? ' - ' + card.institution : ''}`;
        select.appendChild(option);
    });

    console.log('✅ Dropdown preenchido com', select.options.length - 1, 'cartões');
}

// 📝 Sugere data padrão baseada no período da fatura do cartão selecionado
function updateDefaultDateForCard(cardId) {
    if (!cardId) {
        // Se nenhum cartão selecionado, usar hoje
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('date').value = today;
        return;
    }

    const card = creditCards.find(c => c.id === cardId);
    if (!card) return;

    // Calcular o período da fatura deste cartão
    const today = new Date();
    const currentMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : today.getMonth();
    const currentYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : today.getFullYear();

    let billStartDate;

    // Se está navegando para um mês diferente do atual
    const isNavigating = (currentMonth !== today.getMonth() || currentYear !== today.getFullYear());

    if (isNavigating) {
        // Navegando: Fatura aberta é DIA (closingDay+1) do mês anterior até fechamento do mês visualizado
        let prevMonth = currentMonth - 1;
        let prevYear = currentYear;
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear--;
        }
        billStartDate = new Date(prevYear, prevMonth, card.closingDay + 1);
    } else {
        // Usando lógica do mês atual
        if (today.getDate() < card.closingDay) {
            // Fatura aberta é do mês atual
            billStartDate = new Date(currentYear, currentMonth - 1, card.closingDay + 1);
            if (currentMonth === 0) {
                billStartDate = new Date(currentYear - 1, 11, card.closingDay + 1);
            }
        } else {
            // Fatura aberta é do próximo mês
            billStartDate = new Date(currentYear, currentMonth, card.closingDay + 1);
        }
    }

    // Usar primeira data válida do período
    const defaultDate = billStartDate.toISOString().split('T')[0];
    document.getElementById('date').value = defaultDate;

    console.log(`📅 [updateDefaultDateForCard] Cartão "${card.name}" - Período começa em: ${defaultDate}`);
}

// Adicionar event listener ao dropdown de cartões
document.addEventListener('change', (e) => {
    if (e.target.id === 'transactionCard') {
        const cardId = e.target.value;
        if (cardId) {
            updateDefaultDateForCard(cardId);
        }
    }
}, true);

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// ===========================
// UTILITY FUNCTIONS
// ===========================
// 📝 Formata valor numérico para exibição (R$ 1.234,56)
function formatCurrencyDisplay(value) {
    if (!value && value !== 0) return 'R$ 0,00';

    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

// 📝 Formata input de moeda conforme o usuário digita (onkeyup event)
function formatCurrency(inputElement) {
    // Remove tudo que não for número
    let value = inputElement.value.replace(/\D/g, '');

    if (!value) {
        inputElement.value = '';
        return;
    }

    // Converte para número e divide por 100 (para adicionar os centavos)
    let numValue = parseInt(value, 10) / 100;

    // Formata para moeda brasileira
    inputElement.value = numValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// 📝 Formata valor numérico para input (1234.56)
function formatCurrencyValue(value) {
    // Converte um número para o formato do input (1.234,56)
    if (!value && value !== 0) return '';

    let formatted = value.toFixed(2);
    formatted = formatted.replace('.', ',');
    formatted = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return formatted;
}

// 📝 Converte string formatada (1.234,56) para número
function parseCurrencyInput(str) {
    if (!str) return 0;

    // Remove R$ and spaces
    str = str.replace(/[R$\s]/g, '');

    // Replace dots and convert comma to dot
    str = str.replace(/\./g, '').replace(',', '.');

    return parseFloat(str) || 0;
}

// 📝 Formata string de data para exibição local
function formatDate(dateStr) {
    if (!dateStr) return '';

    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

// 🎨 Exibe overlay de carregamento com mensagem personalizada
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

// ===========================
// EVENT LISTENERS
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado, configurando event listeners...');

    // Transaction form submit
    const transactionForm = document.getElementById('transactionForm');
    if (transactionForm) {
        transactionForm.addEventListener('submit', handleTransactionSubmit);
    }

    // Subscription form submit
    const subscriptionForm = document.getElementById('subscriptionForm');
    if (subscriptionForm) {
        subscriptionForm.addEventListener('submit', handleSubscriptionSubmit);
    }

    // Installment form submit
    const installmentForm = document.getElementById('installmentForm');
    if (installmentForm) {
        installmentForm.addEventListener('submit', handleInstallmentSubmit);
    }

    // Projection form submit
    const projectionForm = document.getElementById('projectionForm');
    if (projectionForm) {
        projectionForm.addEventListener('submit', handleProjectionSubmit);
    }

    // Credit card form submit
    const creditCardForm = document.getElementById('creditCardForm');
    if (creditCardForm) {
        creditCardForm.addEventListener('submit', handleCreditCardSubmit);
    }

    // Card expense form submit
    const cardExpenseForm = document.getElementById('cardExpenseForm');
    if (cardExpenseForm) {
        cardExpenseForm.addEventListener('submit', handleCardExpenseSubmit);
    }

    // Investment form submit
    const investmentForm = document.getElementById('investmentForm');
    if (investmentForm) {
        investmentForm.addEventListener('submit', handleInvestmentSubmit);
    }

    // Settings form submit
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', handleSettingsSubmit);
    }

    // Enter key to submit forms
    document.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
            const form = e.target.closest('form');
            if (form) {
                e.preventDefault();
                form.dispatchEvent(new Event('submit'));
            }
        }
    });
});

// ===========================
// HELPER FUNCTIONS FOR CHARTS
// ===========================
// 🔄 Calcula total de entradas ou saídas do mês atual
function getCurrentMonthTotal(type) {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    return transactions
        .filter(t => {
            const tDate = new Date(t.date);
            return t.type === type &&
                   tDate.getMonth() === currentMonth &&
                   tDate.getFullYear() === currentYear;
        })
        .reduce((sum, t) => sum + t.value, 0);
}

// ===========================
// MINI CHARTS - SAVINGS GOAL (RADIAL)
// ===========================
// 🎨 Cria gráfico radial de progresso de meta de economia
function initializeSavingsGoalChart() {
    const chartEl = document.querySelector("#savingsGoalChart");
    if (!chartEl) return;

    // Correção 5: Considerar faturas de cartão nas saídas
    const currentMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
    const currentYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();

    // Calcular entradas do mês (excluindo crédito)
    const totalIncome = transactions
        .filter(t => {
            const d = new Date(t.date);
            return t.type === 'income' && t.paymentMethod !== 'credit' &&
                   d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .reduce((sum, t) => sum + t.value, 0);

    // Calcular saídas em débito do mês
    const totalExpenseDebit = transactions
        .filter(t => {
            const d = new Date(t.date);
            return t.type === 'expense' && t.paymentMethod !== 'credit' &&
                   d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        })
        .reduce((sum, t) => sum + t.value, 0);

    // Incluir faturas de cartão (pagas e não pagas) no total de saídas
    const totalCreditCards = creditCards.reduce((sum, card) => {
        return sum + calculateCurrentBill(card, currentMonth, currentYear);
    }, 0);

    const totalExpense = totalExpenseDebit + totalCreditCards;
    const saved = totalIncome - totalExpense;
    const goal = userSettings.savingsGoal || 2000; // Meta de economia configurável
    const percentage = goal > 0 ? Math.min(Math.max((saved / goal) * 100, 0), 100) : 0;

    const options = {
        series: [percentage],
        chart: {
            type: 'radialBar',
            height: '100%',
            sparkline: { enabled: true }
        },
        plotOptions: {
            radialBar: {
                hollow: {
                    size: '50%'
                },
                dataLabels: {
                    show: true,
                    name: {
                        show: false
                    },
                    value: {
                        show: true,
                        fontSize: '10px',
                        fontWeight: 600,
                        color: '#fff',
                        formatter: () => Math.round(percentage) + '%'
                    }
                }
            }
        },
        fill: {
            colors: [saved >= goal ? '#10b981' : '#f59e0b'] // Verde se atingiu meta, laranja se não
        }
    };

    savingsGoalChart = new ApexCharts(chartEl, options);
    savingsGoalChart.render();

    // Mostra quanto economizou e a meta
    const valueEl = document.getElementById('savingsGoalValue');
    if (valueEl) {
        valueEl.innerHTML = `${formatCurrencyDisplay(saved)} <small style="color: var(--text-muted); font-size: 0.65rem;">/ ${formatCurrencyDisplay(goal)}</small>`;
    }
}

// ===========================
// MINI CHARTS - EXPENSE LIMIT (RADIAL)
// ===========================
// 🎨 Cria gráfico radial de limite de despesas
function initializeExpenseLimitChart() {
    const chartEl = document.querySelector("#expenseLimitChart");
    if (!chartEl) return;

    const totalExpense = getCurrentMonthTotal('expense');
    const limit = userSettings.expenseLimit || 3000; // Limite de gastos configurável
    const percentage = limit > 0 ? Math.min((totalExpense / limit) * 100, 100) : 0;

    // Cores baseadas em porcentagem: verde < 60%, laranja 60-80%, vermelho > 80%
    let fillColor = '#10b981'; // verde
    if (percentage > 80) {
        fillColor = '#ef4444'; // vermelho
    } else if (percentage > 60) {
        fillColor = '#f59e0b'; // laranja
    }

    const options = {
        series: [percentage],
        chart: {
            type: 'radialBar',
            height: '100%',
            sparkline: { enabled: true }
        },
        plotOptions: {
            radialBar: {
                hollow: {
                    size: '50%'
                },
                dataLabels: {
                    show: true,
                    name: {
                        show: false
                    },
                    value: {
                        show: true,
                        fontSize: '10px',
                        fontWeight: 600,
                        color: '#fff',
                        formatter: () => Math.round(percentage) + '%'
                    }
                }
            }
        },
        fill: {
            colors: [fillColor]
        }
    };

    expenseLimitChart = new ApexCharts(chartEl, options);
    expenseLimitChart.render();

    // Mostra quanto gastou e o limite
    const valueEl = document.getElementById('expenseLimitValue');
    if (valueEl) {
        valueEl.innerHTML = `${formatCurrencyDisplay(totalExpense)} <small style="color: var(--text-muted); font-size: 0.65rem;">/ ${formatCurrencyDisplay(limit)}</small>`;
    }
}

// ===========================
// MINI CHARTS - GROWTH SPARKLINE
// ===========================
// 🎨 Cria mini gráfico de linha de crescimento de receitas
function initializeGrowthSparkline() {
    const chartEl = document.querySelector("#growthSparkline");
    if (!chartEl) return;

    const last6Months = [];
    const currentDate = new Date();

    for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthTransactions = transactions.filter(t => {
            const tDate = new Date(t.date);
            return tDate.getMonth() === date.getMonth() && tDate.getFullYear() === date.getFullYear();
        });
        const income = monthTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.value, 0);
        const expense = monthTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.value, 0);
        last6Months.push(income - expense);
    }

    const growth = last6Months.length > 1 ?
        ((last6Months[5] - last6Months[4]) / (last6Months[4] || 1)) * 100 : 0;

    const options = {
        series: [{ data: last6Months }],
        chart: {
            type: 'line',
            height: 60,
            sparkline: { enabled: true }
        },
        stroke: {
            width: 2,
            curve: 'smooth'
        },
        colors: [growth >= 0 ? '#10b981' : '#ef4444'],
        tooltip: {
            enabled: false
        }
    };

    new ApexCharts(chartEl, options).render();
    document.getElementById('growthValue').textContent = (growth >= 0 ? '+' : '') + growth.toFixed(1) + '%';
}

// ===========================
// MINI CHARTS - EXPENSE TREND SPARKLINE
// ===========================
// 🎨 Cria mini gráfico de linha de tendência de despesas
function initializeExpenseTrendSparkline() {
    const chartEl = document.querySelector("#expenseTrendSparkline");
    if (!chartEl) return;

    const last7Days = [];
    const currentDate = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(currentDate);
        date.setDate(date.getDate() - i);
        const dayExpenses = transactions.filter(t => {
            const tDate = new Date(t.date);
            return t.type === 'expense' &&
                   tDate.toDateString() === date.toDateString();
        }).reduce((sum, t) => sum + t.value, 0);
        last7Days.push(dayExpenses);
    }

    const trend = last7Days[6] > last7Days[0] ? 'Crescente' : 'Decrescente';

    const options = {
        series: [{ data: last7Days }],
        chart: {
            type: 'area',
            height: 60,
            sparkline: { enabled: true }
        },
        stroke: {
            width: 2,
            curve: 'smooth'
        },
        fill: {
            opacity: 0.3
        },
        colors: ['#f97316'],
        tooltip: {
            enabled: false
        }
    };

    new ApexCharts(chartEl, options).render();
    document.getElementById('trendValue').textContent = trend;
}

// ===========================
// TOP CATEGORIES CHART (BAR)
// ===========================
// 🎨 Cria gráfico de barras com top 5 categorias de despesas
function initializeTopCategoriesChart() {
    const chartEl = document.querySelector("#topCategoriesChart");
    if (!chartEl) return;

    const data = getCategoryData();
    const topCategories = data.categories.slice(0, 5);
    const topValues = data.values.slice(0, 5);

    const options = {
        series: [{ name: 'Valor', data: topValues }],
        chart: {
            type: 'bar',
            height: '100%',
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false }
        },
        plotOptions: {
            bar: {
                horizontal: true,
                distributed: true,
                barHeight: '60%'
            }
        },
        dataLabels: { enabled: false },
        xaxis: {
            categories: topCategories,
            labels: {
                style: {
                    colors: '#64748b',
                    fontSize: '10px'
                }
            }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#64748b',
                    fontSize: '10px'
                }
            }
        },
        colors: ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16'],
        grid: {
            borderColor: 'rgba(255,255,255,0.1)'
        }
    };

    topCategoriesChart = new ApexCharts(chartEl, options);
    topCategoriesChart.render();
}

// ===========================
// WEEKLY TREND CHART (AREA)
// ===========================
// 🎨 Cria gráfico de área com despesas diárias da última semana do mês selecionado
function initializeWeeklyTrendChart() {
    const chartEl = document.querySelector("#weeklyTrendChart");
    if (!chartEl) return;

    const data = getWeeklyTrendData();

    const options = {
        series: [{ name: 'Gastos', data: data.values }],
        chart: {
            type: 'area',
            height: '100%',
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false }
        },
        stroke: {
            width: 2,
            curve: 'smooth'
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.4,
                opacityTo: 0.1
            }
        },
        dataLabels: { enabled: false },
        xaxis: {
            categories: data.labels,
            labels: {
                style: {
                    colors: '#64748b',
                    fontSize: '10px'
                }
            }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#64748b',
                    fontSize: '10px'
                }
            }
        },
        colors: ['#8b5cf6'],
        grid: {
            borderColor: 'rgba(255,255,255,0.1)'
        },
        tooltip: {
            y: {
                formatter: function (value) {
                    return formatCurrencyDisplay(value);
                }
            }
        }
    };

    weeklyTrendChart = new ApexCharts(chartEl, options);
    weeklyTrendChart.render();
}

// 📊 Obtém dados de despesas diárias da última semana do mês selecionado
function getWeeklyTrendData() {
    const last7Days = [];
    const labels = [];

    // Usar mês/ano selecionado como referência
    const displayMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
    const displayYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();

    // Pegar o último dia do mês selecionado
    const lastDayOfMonth = new Date(displayYear, displayMonth + 1, 0);
    const referenceDate = lastDayOfMonth;

    for (let i = 6; i >= 0; i--) {
        const date = new Date(referenceDate);
        date.setDate(date.getDate() - i);
        const dayExpenses = transactions.filter(t => {
            const tDate = new Date(t.date);
            return t.type === 'expense' &&
                   tDate.toDateString() === date.toDateString();
        }).reduce((sum, t) => sum + t.value, 0);
        last7Days.push(dayExpenses);
        labels.push(date.toLocaleDateString('pt-BR', { weekday: 'short' }));
    }

    return { values: last7Days, labels: labels };
}

// 🔄 Atualiza dados do gráfico de evolução semanal
function updateWeeklyTrendChart() {
    if (!weeklyTrendChart) return;
    const data = getWeeklyTrendData();
    weeklyTrendChart.updateOptions({
        xaxis: {
            categories: data.labels
        }
    });
    weeklyTrendChart.updateSeries([{ name: 'Gastos', data: data.values }]);
}

// 🔄 Atualiza dados do gráfico de top categorias
function updateTopCategoriesChart() {
    if (!topCategoriesChart) return;
    const data = getCategoryData();
    const topCategories = data.categories.slice(0, 5);
    const topValues = data.values.slice(0, 5);
    topCategoriesChart.updateOptions({
        xaxis: {
            categories: topCategories
        }
    });
    topCategoriesChart.updateSeries([{ name: 'Valor', data: topValues }]);
}


// ===========================
// RESPONSIVE CHARTS
// ===========================
window.addEventListener('resize', () => {
    if (cashFlowChart) cashFlowChart.updateOptions({});
    if (categoryChart) categoryChart.updateOptions({});
    if (paymentMethodChart) paymentMethodChart.updateOptions({});
    if (comparisonChart) comparisonChart.updateOptions({});
});

console.log('Dashboard Financeiro v2.2 - Script carregado');

// ===========================
// DROPDOWN CUSTOMIZADO
// ===========================
class CustomSelect {
    constructor(selectElement) {
        this.selectElement = selectElement;
        this.selectedIndex = selectElement.selectedIndex;
        this.isOpen = false;
        this.init();
    }

    init() {
        // Criar estrutura customizada
        this.createCustomSelect();
        this.bindEvents();

        // Esconder select original
        this.selectElement.style.display = 'none';

        // Adicionar após o select original
        this.selectElement.parentNode.insertBefore(this.customSelect, this.selectElement.nextSibling);

        // Sincronizar valor inicial
        this.updateSelected();
    }

    createCustomSelect() {
        // Container principal
        this.customSelect = document.createElement('div');
        this.customSelect.className = 'custom-select';

        // Trigger (botão que abre/fecha)
        this.trigger = document.createElement('div');
        this.trigger.className = 'custom-select-trigger';
        this.trigger.innerHTML = `
            <span class="custom-select-value">Selecione...</span>
            <svg class="custom-select-arrow" viewBox="0 0 10 6" fill="none">
                <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;

        // Lista de opções
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'custom-select-dropdown';

        // Criar opções
        const options = Array.from(this.selectElement.options);
        options.forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.className = 'custom-select-option';
            optionElement.textContent = option.textContent;
            optionElement.dataset.value = option.value;
            optionElement.dataset.index = index;

            if (option.disabled) {
                optionElement.classList.add('disabled');
            }

            if (option.selected) {
                optionElement.classList.add('selected');
            }

            this.dropdown.appendChild(optionElement);
        });

        this.customSelect.appendChild(this.trigger);
        this.customSelect.appendChild(this.dropdown);
    }

    bindEvents() {
        // Toggle dropdown
        this.trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });

        // Selecionar opção
        this.dropdown.addEventListener('click', (e) => {
            e.preventDefault();
            const option = e.target.closest('.custom-select-option');
            if (option && !option.classList.contains('disabled')) {
                this.selectOption(parseInt(option.dataset.index));
            }
        });

        // Fechar ao clicar fora
        document.addEventListener('click', (e) => {
            if (!this.customSelect.contains(e.target)) {
                this.close();
            }
        });

        // Keyboard navigation
        this.customSelect.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateOptions(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateOptions(-1);
            } else if (e.key === 'Escape') {
                this.close();
            }
        });

        // Observar mudanças no select original
        const observer = new MutationObserver(() => {
            this.updateDropdownOptions();
        });
        observer.observe(this.selectElement, { childList: true, subtree: true });

        // Observar mudanças de valor
        this.selectElement.addEventListener('change', () => {
            this.updateSelected();
        });
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        this.isOpen = true;
        this.customSelect.classList.add('open');
        this.trigger.setAttribute('aria-expanded', 'true');

        // Scroll para opção selecionada
        const selectedOption = this.dropdown.querySelector('.selected');
        if (selectedOption) {
            selectedOption.scrollIntoView({ block: 'nearest' });
        }
    }

    close() {
        this.isOpen = false;
        this.customSelect.classList.remove('open');
        this.trigger.setAttribute('aria-expanded', 'false');
    }

    selectOption(index) {
        this.selectedIndex = index;
        this.selectElement.selectedIndex = index;

        // Disparar evento change
        const event = new Event('change', { bubbles: true });
        this.selectElement.dispatchEvent(event);

        this.updateSelected();
        this.close();
    }

    updateSelected() {
        const selectedOption = this.selectElement.options[this.selectElement.selectedIndex];
        const valueSpan = this.trigger.querySelector('.custom-select-value');

        if (selectedOption) {
            valueSpan.textContent = selectedOption.textContent;
            valueSpan.classList.remove('placeholder');
        } else {
            valueSpan.textContent = 'Selecione...';
            valueSpan.classList.add('placeholder');
        }

        // Atualizar classe selected nas opções
        this.dropdown.querySelectorAll('.custom-select-option').forEach((opt, index) => {
            opt.classList.toggle('selected', index === this.selectElement.selectedIndex);
        });
    }

    updateDropdownOptions() {
        // Recriar lista de opções quando o select original muda
        this.dropdown.innerHTML = '';

        const options = Array.from(this.selectElement.options);
        options.forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.className = 'custom-select-option';
            optionElement.textContent = option.textContent;
            optionElement.dataset.value = option.value;
            optionElement.dataset.index = index;

            if (option.disabled) {
                optionElement.classList.add('disabled');
            }

            if (index === this.selectElement.selectedIndex) {
                optionElement.classList.add('selected');
            }

            this.dropdown.appendChild(optionElement);
        });

        this.updateSelected();
    }

    navigateOptions(direction) {
        const options = Array.from(this.dropdown.querySelectorAll('.custom-select-option:not(.disabled)'));
        const currentIndex = options.findIndex(opt => opt.classList.contains('selected'));
        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = 0;
        if (newIndex >= options.length) newIndex = options.length - 1;

        if (options[newIndex]) {
            const actualIndex = parseInt(options[newIndex].dataset.index);
            this.selectOption(actualIndex);

            if (this.isOpen) {
                options[newIndex].scrollIntoView({ block: 'nearest' });
            }
        }
    }
}

// 📝 Inicializa componentes de select personalizados para todos os dropdowns
function initCustomSelects() {
    const selects = document.querySelectorAll('.form-select, select');
    selects.forEach(select => {
        if (!select.dataset.customized) {
            new CustomSelect(select);
            select.dataset.customized = 'true';
        }
    });
}

// Auto-inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCustomSelects);
} else {
    initCustomSelects();
}

// Exportar para uso global
window.initCustomSelects = initCustomSelects;
window.CustomSelect = CustomSelect;
