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
    'Transporte',
    'Moradia',
    'Saúde',
    'Educação',
    'Lazer',
    'Compras',
    'Contas',
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
let currentFilter = 'all';
let currentTransactionType = 'income';

// ApexCharts instances
let cashFlowChart = null;
let categoryChart = null;
let comparisonChart = null;

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
            showDashboard(user);
            initializeDashboard();
        } else {
            showToast('Acesso não autorizado!', 'error');
            signOut();
        }
    } else {
        showLoginScreen();
    }
});

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

function signOut() {
    auth.signOut().then(() => {
        showToast('Logout realizado com sucesso', 'success');
        location.reload();
    });
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('dashboard').classList.add('hidden');
    hideLoading(); // IMPORTANTE: Esconde loading na tela de login
}

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
// INITIALIZATION
// ===========================
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
            loadProjections()
        ]);

        console.log('Dados carregados:', {
            transactions: transactions.length,
            subscriptions: subscriptions.length,
            installments: installments.length,
            projections: projections.length
        });

        // Initialize charts (com dados ou sem)
        initializeCharts();

        // Update KPIs
        updateKPIs();

        hideLoading();
        showToast('Dashboard carregado com sucesso', 'success');
    } catch (error) {
        hideLoading();
        console.error('Erro ao inicializar dashboard:', error);
        showToast('Erro ao carregar dados: ' + error.message, 'error');
    }
}

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
async function loadTransactions() {
    try {
        console.log('Carregando transações...');
        const snapshot = await db.collection('transactions')
            .where('userId', '==', currentUser.uid)
            .orderBy('date', 'desc')
            .get();

        transactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${transactions.length} transações carregadas`);
        renderTransactions();
    } catch (error) {
        console.error('Erro ao carregar transações:', error);
        // Não mostra toast aqui para não poluir - já mostra no catch principal
        transactions = []; // Garante array vazio
        renderTransactions();
    }
}

function renderTransactions() {
    const tbody = document.getElementById('transactionsTableBody');
    const emptyState = document.getElementById('emptyState');

    if (!tbody || !emptyState) return;

    let filteredTransactions = transactions;
    if (currentFilter !== 'all') {
        filteredTransactions = transactions.filter(t => t.type === currentFilter);
    }

    if (filteredTransactions.length === 0) {
        tbody.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    tbody.innerHTML = filteredTransactions.map(transaction => `
        <tr class="transaction-row ${transaction.type}">
            <td>
                <div class="transaction-description">
                    <i class="fas fa-${transaction.type === 'income' ? 'arrow-up' : 'arrow-down'}"></i>
                    <span>${transaction.description}</span>
                </div>
            </td>
            <td>
                <span class="category-badge">${transaction.category}</span>
            </td>
            <td>${formatDate(transaction.date)}</td>
            <td class="value-${transaction.type}">
                ${transaction.type === 'income' ? '+' : '-'} ${formatCurrencyDisplay(transaction.value)}
            </td>
            <td>
                <button class="btn-delete" onclick="deleteTransaction('${transaction.id}')" title="Deletar">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function filterTransactions(filter) {
    currentFilter = filter;

    // Update active button
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        }
    });

    renderTransactions();
}

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

    const value = parseCurrencyInput(valueStr);
    if (value <= 0) {
        showToast('Valor inválido', 'error');
        return;
    }

    showLoading('Salvando transação...');

    try {
        await db.collection('transactions').add({
            userId: currentUser.uid,
            type: currentTransactionType,
            description,
            value,
            category,
            date,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await loadTransactions();
        updateKPIs();
        updateCharts();
        closeTransactionModal();
        showToast('Transação adicionada com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao salvar transação:', error);
        showToast('Erro ao salvar transação', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteTransaction(id) {
    if (!confirm('Deseja realmente deletar esta transação?')) return;

    showLoading('Deletando...');

    try {
        await db.collection('transactions').doc(id).delete();
        await loadTransactions();
        updateKPIs();
        updateCharts();
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
async function loadSubscriptions() {
    try {
        console.log('Carregando assinaturas...');
        const snapshot = await db.collection('subscriptions')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();

        subscriptions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${subscriptions.length} assinaturas carregadas`);
        renderSubscriptions();
    } catch (error) {
        console.error('Erro ao carregar assinaturas:', error);
        subscriptions = [];
        renderSubscriptions();
    }
}

function renderSubscriptions() {
    const grid = document.getElementById('subscriptionsGrid');
    const emptyState = document.getElementById('emptySubscriptions');

    if (!grid || !emptyState) return;

    if (subscriptions.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    grid.innerHTML = subscriptions.map(sub => {
        const nextDue = calculateNextDue(sub.dueDay);
        return `
            <div class="subscription-card">
                <div class="subscription-header">
                    <div class="subscription-info">
                        <h4>${sub.name}</h4>
                        <span class="subscription-category">${sub.category}</span>
                    </div>
                    <span class="subscription-badge ${sub.status}">
                        ${sub.status === 'active' ? 'Ativa' : 'Inativa'}
                    </span>
                </div>
                <div class="subscription-value">${formatCurrencyDisplay(sub.value)}<small>/mês</small></div>
                <div class="subscription-meta">
                    <span><i class="fas fa-calendar-alt"></i> ${nextDue}</span>
                    <button class="subscription-delete" onclick="deleteSubscription('${sub.id}')" title="Deletar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function calculateNextDue(dueDay) {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    let dueDate = new Date(currentYear, currentMonth, dueDay);

    if (dueDate < today) {
        dueDate = new Date(currentYear, currentMonth + 1, dueDay);
    }

    return dueDate.toLocaleDateString('pt-BR');
}

async function handleSubscriptionSubmit(e) {
    e.preventDefault();

    const name = document.getElementById('subName').value.trim();
    const valueStr = document.getElementById('subValue').value;
    const dueDay = parseInt(document.getElementById('subDueDay').value);
    const category = document.getElementById('subCategory').value;
    const status = document.getElementById('subStatus').value;

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

    showLoading('Salvando assinatura...');

    try {
        await db.collection('subscriptions').add({
            userId: currentUser.uid,
            name,
            value,
            dueDay,
            category,
            status,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await loadSubscriptions();
        updateKPIs();
        closeSubscriptionModal();
        showToast('Assinatura adicionada com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao salvar assinatura:', error);
        showToast('Erro ao salvar assinatura', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteSubscription(id) {
    if (!confirm('Deseja realmente deletar esta assinatura?')) return;

    showLoading('Deletando...');

    try {
        await db.collection('subscriptions').doc(id).delete();
        await loadSubscriptions();
        updateKPIs();
        showToast('Assinatura deletada com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao deletar assinatura:', error);
        showToast('Erro ao deletar assinatura', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// INSTALLMENTS CRUD
// ===========================
async function loadInstallments() {
    try {
        console.log('Carregando parcelamentos...');
        const snapshot = await db.collection('installments')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();

        installments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${installments.length} parcelamentos carregados`);
        renderInstallments();
    } catch (error) {
        console.error('Erro ao carregar parcelamentos:', error);
        installments = [];
        renderInstallments();
    }
}

function renderInstallments() {
    const grid = document.getElementById('installmentsGrid');
    const emptyState = document.getElementById('emptyInstallments');

    if (!grid || !emptyState) return;

    if (installments.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    grid.innerHTML = installments.map(inst => {
        const remaining = inst.totalInstallments - inst.paidInstallments;
        const percentage = (inst.paidInstallments / inst.totalInstallments) * 100;
        const installmentValue = inst.totalValue / inst.totalInstallments;
        const remainingValue = installmentValue * remaining;

        return `
            <div class="installment-card">
                <div class="installment-header">
                    <div class="installment-info">
                        <h4>${inst.description}</h4>
                    </div>
                    <button class="installment-delete" onclick="deleteInstallment('${inst.id}')" title="Deletar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="installment-value">${formatCurrencyDisplay(inst.totalValue)}</div>
                <div class="installment-progress-container">
                    <div class="installment-progress-label">
                        <span class="installment-progress-label-text">${inst.paidInstallments}/${inst.totalInstallments} parcelas</span>
                        <span class="installment-progress-percentage">${percentage.toFixed(0)}%</span>
                    </div>
                    <div class="installment-progress-bar">
                        <div class="installment-progress-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
                <div class="installment-footer">
                    <span>Vencimento: dia ${inst.dueDay}</span>
                    <span>Restante: ${formatCurrencyDisplay(remainingValue)}</span>
                </div>
                <div style="margin-top: 10px;">
                    <label style="font-size: 12px; color: #64748b;">Parcelas pagas:</label>
                    <input
                        type="number"
                        class="form-input"
                        value="${inst.paidInstallments}"
                        min="0"
                        max="${inst.totalInstallments}"
                        onchange="updateInstallmentProgress('${inst.id}', this.value)"
                        style="margin-top: 4px;"
                    >
                </div>
            </div>
        `;
    }).join('');
}

async function handleInstallmentSubmit(e) {
    e.preventDefault();

    const description = document.getElementById('instDescription').value.trim();
    const totalValueStr = document.getElementById('instTotalValue').value;
    const totalInstallments = parseInt(document.getElementById('instTotalInstallments').value);
    const paidInstallments = parseInt(document.getElementById('instPaidInstallments').value);
    const dueDay = parseInt(document.getElementById('instDueDay').value);

    if (!description || !totalValueStr || !totalInstallments || !dueDay) {
        showToast('Preencha todos os campos', 'error');
        return;
    }

    const totalValue = parseCurrencyInput(totalValueStr);
    if (totalValue <= 0) {
        showToast('Valor inválido', 'error');
        return;
    }

    if (totalInstallments < 2 || totalInstallments > 99) {
        showToast('Total de parcelas deve estar entre 2 e 99', 'error');
        return;
    }

    if (paidInstallments < 0 || paidInstallments > totalInstallments) {
        showToast('Parcelas pagas inválidas', 'error');
        return;
    }

    if (dueDay < 1 || dueDay > 31) {
        showToast('Dia do vencimento deve estar entre 1 e 31', 'error');
        return;
    }

    showLoading('Salvando parcelamento...');

    try {
        await db.collection('installments').add({
            userId: currentUser.uid,
            description,
            totalValue,
            totalInstallments,
            paidInstallments,
            dueDay,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await loadInstallments();
        updateKPIs();
        closeInstallmentModal();
        showToast('Parcelamento adicionado com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao salvar parcelamento:', error);
        showToast('Erro ao salvar parcelamento', 'error');
    } finally {
        hideLoading();
    }
}

async function updateInstallmentProgress(id, paid) {
    const paidInstallments = parseInt(paid);

    showLoading('Atualizando...');

    try {
        await db.collection('installments').doc(id).update({
            paidInstallments
        });

        await loadInstallments();
        updateKPIs();
        showToast('Progresso atualizado', 'success');
    } catch (error) {
        console.error('Erro ao atualizar parcelamento:', error);
        showToast('Erro ao atualizar', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteInstallment(id) {
    if (!confirm('Deseja realmente deletar este parcelamento?')) return;

    showLoading('Deletando...');

    try {
        await db.collection('installments').doc(id).delete();
        await loadInstallments();
        updateKPIs();
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
async function loadProjections() {
    try {
        console.log('Carregando projeções...');
        const snapshot = await db.collection('projections')
            .where('userId', '==', currentUser.uid)
            .orderBy('date', 'asc')
            .get();

        projections = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${projections.length} projeções carregadas`);
        renderProjections();
    } catch (error) {
        console.error('Erro ao carregar projeções:', error);
        projections = [];
        renderProjections();
    }
}

function renderProjections() {
    const grid = document.getElementById('projectionsGrid');
    const emptyState = document.getElementById('emptyProjections');

    if (!grid || !emptyState) return;

    if (projections.length === 0) {
        grid.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    grid.innerHTML = projections.map(proj => `
        <div class="projection-card ${proj.status}">
            <div class="projection-header">
                <div class="projection-info">
                    <h4>${proj.description}</h4>
                    <span class="projection-date">
                        <i class="fas fa-calendar-alt"></i>
                        ${formatDate(proj.date)}
                    </span>
                </div>
                <span class="projection-badge ${proj.status}">
                    ${proj.status === 'pending' ? 'Pendente' : 'Recebido'}
                </span>
            </div>
            <div class="projection-value">${formatCurrencyDisplay(proj.value)}</div>
            <div style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
                ${proj.status === 'pending' ? `
                    <button class="btn btn-success btn-sm" onclick="updateProjectionStatus('${proj.id}', 'received')" style="flex: 1;">
                        <i class="fas fa-check"></i> Marcar como Recebido
                    </button>
                ` : ''}
                <button class="btn btn-danger btn-sm" onclick="deleteProjection('${proj.id}')" style="flex: 1;">
                    <i class="fas fa-trash"></i> Deletar
                </button>
            </div>
        </div>
    `).join('');
}

async function handleProjectionSubmit(e) {
    e.preventDefault();

    const description = document.getElementById('projDescription').value.trim();
    const valueStr = document.getElementById('projValue').value;
    const date = document.getElementById('projDate').value;
    const status = document.getElementById('projStatus').value;

    if (!description || !valueStr || !date) {
        showToast('Preencha todos os campos', 'error');
        return;
    }

    const value = parseCurrencyInput(valueStr);
    if (value <= 0) {
        showToast('Valor inválido', 'error');
        return;
    }

    showLoading('Salvando projeção...');

    try {
        await db.collection('projections').add({
            userId: currentUser.uid,
            description,
            value,
            date,
            status,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await loadProjections();
        updateKPIs();
        closeProjectionModal();
        showToast('Projeção adicionada com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao salvar projeção:', error);
        showToast('Erro ao salvar projeção', 'error');
    } finally {
        hideLoading();
    }
}

async function updateProjectionStatus(id, status) {
    showLoading('Atualizando status...');

    try {
        await db.collection('projections').doc(id).update({ status });
        await loadProjections();
        updateKPIs();
        showToast('Status atualizado', 'success');
    } catch (error) {
        console.error('Erro ao atualizar projeção:', error);
        showToast('Erro ao atualizar', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteProjection(id) {
    if (!confirm('Deseja realmente deletar esta projeção?')) return;

    showLoading('Deletando...');

    try {
        await db.collection('projections').doc(id).delete();
        await loadProjections();
        updateKPIs();
        showToast('Projeção deletada com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao deletar projeção:', error);
        showToast('Erro ao deletar projeção', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// KPI CALCULATIONS
// ===========================
function updateKPIs() {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Filter transactions for current month
    const currentMonthTransactions = transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate.getMonth() === currentMonth &&
               transactionDate.getFullYear() === currentYear;
    });

    // Total Income (current month)
    const totalIncome = currentMonthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.value, 0);

    // Total Expense (current month)
    const totalExpense = currentMonthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.value, 0);

    // Total Balance (all time)
    const totalBalance = transactions
        .reduce((sum, t) => {
            return t.type === 'income' ? sum + t.value : sum - t.value;
        }, 0);

    // Total Active Subscriptions
    const totalSubscriptions = subscriptions
        .filter(s => s.status === 'active')
        .reduce((sum, s) => sum + s.value, 0);

    // Total Pending Installments
    const totalInstallments = installments.reduce((sum, inst) => {
        const remaining = inst.totalInstallments - inst.paidInstallments;
        const installmentValue = inst.totalValue / inst.totalInstallments;
        return sum + (installmentValue * remaining);
    }, 0);

    // Projection for Next Month
    const totalProjection = projections
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + p.value, 0);

    // Update DOM
    const incomeEl = document.getElementById('totalIncome');
    const expenseEl = document.getElementById('totalExpense');
    const balanceEl = document.getElementById('totalBalance');
    const subscriptionsEl = document.getElementById('totalSubscriptions');
    const installmentsEl = document.getElementById('totalInstallments');
    const projectionEl = document.getElementById('totalProjection');

    if (incomeEl) incomeEl.textContent = formatCurrencyDisplay(totalIncome);
    if (expenseEl) expenseEl.textContent = formatCurrencyDisplay(totalExpense);
    if (balanceEl) balanceEl.textContent = formatCurrencyDisplay(totalBalance);
    if (subscriptionsEl) subscriptionsEl.textContent = formatCurrencyDisplay(totalSubscriptions);
    if (installmentsEl) installmentsEl.textContent = formatCurrencyDisplay(totalInstallments);
    if (projectionEl) projectionEl.textContent = formatCurrencyDisplay(totalProjection);
}

// ===========================
// APEXCHARTS - INITIALIZATION
// ===========================
function initializeCharts() {
    try {
        initializeCashFlowChart();
        initializeCategoryChart();
        initializeComparisonChart();
        console.log('Gráficos inicializados');
    } catch (error) {
        console.error('Erro ao inicializar gráficos:', error);
    }
}

function updateCharts() {
    try {
        if (cashFlowChart) updateCashFlowChart();
        if (categoryChart) updateCategoryChart();
        if (comparisonChart) updateComparisonChart();
    } catch (error) {
        console.error('Erro ao atualizar gráficos:', error);
    }
}

// ===========================
// CASH FLOW CHART
// ===========================
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
            height: 350,
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
            fontFamily: 'Inter, sans-serif'
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

function updateCashFlowChart() {
    const data = getCashFlowData();
    cashFlowChart.updateSeries([
        { name: 'Entradas', data: data.incomes },
        { name: 'Saídas', data: data.expenses }
    ]);
}

function getCashFlowData() {
    const months = [];
    const incomes = [];
    const expenses = [];

    // Get last 12 months
    for (let i = 11; i >= 0; i--) {
        const date = new Date();
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
            type: 'donut',
            height: 350,
            fontFamily: 'Inter, sans-serif'
        },
        labels: data.categories,
        colors: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'],
        dataLabels: {
            enabled: true,
            formatter: function (val) {
                return val.toFixed(1) + '%';
            }
        },
        legend: {
            position: 'bottom',
            fontSize: '12px',
            labels: {
                colors: '#64748b'
            }
        },
        tooltip: {
            y: {
                formatter: function (value) {
                    return formatCurrencyDisplay(value);
                }
            }
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '65%',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '14px',
                            color: '#1e293b'
                        },
                        value: {
                            show: true,
                            fontSize: '20px',
                            fontWeight: 600,
                            color: '#1e293b',
                            formatter: function (val) {
                                return formatCurrencyDisplay(parseFloat(val));
                            }
                        },
                        total: {
                            show: true,
                            label: 'Total Gastos',
                            fontSize: '14px',
                            color: '#64748b',
                            formatter: function (w) {
                                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                return formatCurrencyDisplay(total);
                            }
                        }
                    }
                }
            }
        }
    };

    categoryChart = new ApexCharts(chartEl, options);
    categoryChart.render();
}

function updateCategoryChart() {
    const data = getCategoryData();

    if (data.values.length === 0) {
        // Destroi o chart se não há dados
        if (categoryChart) {
            categoryChart.destroy();
            categoryChart = null;
        }
        const chartEl = document.querySelector("#categoryChart");
        if (chartEl) {
            chartEl.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 350px; color: #94a3b8;">Sem dados para exibir</div>';
        }
        return;
    }

    if (categoryChart) {
        categoryChart.updateOptions({
            labels: data.categories,
            series: data.values
        });
    } else {
        initializeCategoryChart();
    }
}

function getCategoryData() {
    const categoryMap = {};

    // Get current month expenses
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    transactions.forEach(t => {
        if (t.type === 'expense') {
            const transactionDate = new Date(t.date);
            if (transactionDate.getMonth() === currentMonth &&
                transactionDate.getFullYear() === currentYear) {
                categoryMap[t.category] = (categoryMap[t.category] || 0) + t.value;
            }
        }
    });

    const categories = Object.keys(categoryMap);
    const values = Object.values(categoryMap);

    return { categories, values };
}

// ===========================
// COMPARISON CHART (BARS)
// ===========================
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
            height: 350,
            fontFamily: 'Inter, sans-serif'
        },
        plotOptions: {
            bar: {
                horizontal: true,
                distributed: true,
                dataLabels: {
                    position: 'top'
                }
            }
        },
        colors: ['#10b981', '#ef4444'],
        dataLabels: {
            enabled: true,
            formatter: function (val) {
                return formatCurrencyDisplay(val);
            },
            offsetX: 30,
            style: {
                fontSize: '12px',
                colors: ['#1e293b']
            }
        },
        xaxis: {
            categories: data.labels,
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
            borderColor: '#e2e8f0'
        },
        tooltip: {
            y: {
                formatter: function (value) {
                    return formatCurrencyDisplay(value);
                }
            }
        },
        legend: {
            show: false
        }
    };

    comparisonChart = new ApexCharts(chartEl, options);
    comparisonChart.render();
}

function updateComparisonChart() {
    const data = getComparisonData();
    comparisonChart.updateSeries([{
        name: 'Valor',
        data: data.values
    }]);
}

function getComparisonData() {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

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
function openTransactionModal() {
    document.getElementById('transactionModal').classList.add('active');
    document.getElementById('transactionForm').reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    currentTransactionType = 'income';
    selectTransactionType('income');
}

function closeTransactionModal() {
    document.getElementById('transactionModal').classList.remove('active');
    document.getElementById('transactionForm').reset();
}

function openSubscriptionModal() {
    document.getElementById('subscriptionModal').classList.add('active');
    document.getElementById('subscriptionForm').reset();
}

function closeSubscriptionModal() {
    document.getElementById('subscriptionModal').classList.remove('active');
    document.getElementById('subscriptionForm').reset();
}

function openInstallmentModal() {
    document.getElementById('installmentModal').classList.add('active');
    document.getElementById('installmentForm').reset();
    document.getElementById('instPaidInstallments').value = 0;
}

function closeInstallmentModal() {
    document.getElementById('installmentModal').classList.remove('active');
    document.getElementById('installmentForm').reset();
}

function openProjectionModal() {
    document.getElementById('projectionModal').classList.add('active');
    document.getElementById('projectionForm').reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('projDate').value = today;
}

function closeProjectionModal() {
    document.getElementById('projectionModal').classList.remove('active');
    document.getElementById('projectionForm').reset();
}

function selectTransactionType(type) {
    currentTransactionType = type;

    // Update active button
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === type) {
            btn.classList.add('active');
        }
    });

    // Update categories
    populateCategories();
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// ===========================
// UTILITY FUNCTIONS
// ===========================
function formatCurrency(input) {
    let value = input.value.replace(/\D/g, '');

    if (value === '') {
        input.value = '';
        return;
    }

    value = (parseInt(value) / 100).toFixed(2);
    value = value.replace('.', ',');
    value = value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    input.value = value;
}

function formatCurrencyDisplay(value) {
    if (!value && value !== 0) return 'R$ 0,00';

    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function parseCurrencyInput(str) {
    if (!str) return 0;

    // Remove R$ and spaces
    str = str.replace(/[R$\s]/g, '');

    // Replace dots and convert comma to dot
    str = str.replace(/\./g, '').replace(',', '.');

    return parseFloat(str) || 0;
}

function formatDate(dateStr) {
    if (!dateStr) return '';

    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function showLoading(message = 'Carregando...') {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;

    const text = overlay.querySelector('.loading-text');
    if (text) text.textContent = message;
    overlay.style.display = 'flex';
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.style.display = 'none';
}

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
// RESPONSIVE CHARTS
// ===========================
window.addEventListener('resize', () => {
    if (cashFlowChart) cashFlowChart.updateOptions({});
    if (categoryChart) categoryChart.updateOptions({});
    if (comparisonChart) comparisonChart.updateOptions({});
});

console.log('Dashboard Financeiro v2.1 - Script carregado');
