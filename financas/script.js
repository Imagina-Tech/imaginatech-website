/*
=================================================
ARQUIVO: financas/script.js
MÓDULO: Dashboard Financeiro Pessoal
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
let transactions = [];
let currentUser = null;
let currentFilter = 'all';
let currentTransactionType = 'income';
let categoryChart = null;
let comparisonChart = null;

// ===========================
// INITIALIZATION
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    initializeFirebase();
    setupAuthListener();
    setupEventListeners();
});

function initializeFirebase() {
    try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
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
            currentUser = user;
            showDashboard(user);
            loadTransactions();
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
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('userPhoto').src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=6366F1&color=fff`;
}

function showLoginScreen() {
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
}

// ===========================
// EVENT LISTENERS
// ===========================
function setupEventListeners() {
    // Transaction form
    document.getElementById('transactionForm').addEventListener('submit', handleTransactionSubmit);

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
}

// ===========================
// LOAD TRANSACTIONS
// ===========================
function loadTransactions() {
    if (!currentUser) return;

    showLoading('Carregando transações...');

    db.collection('transactions')
        .where('userId', '==', currentUser.uid)
        .orderBy('date', 'desc')
        .onSnapshot(snapshot => {
            transactions = [];
            snapshot.forEach(doc => {
                transactions.push({ id: doc.id, ...doc.data() });
            });
            renderTransactions();
            updateKPIs();
            updateCharts();
            hideLoading();
        }, error => {
            console.error('Error loading transactions:', error);
            showToast('Erro ao carregar transações', 'error');
            hideLoading();
        });
}

// ===========================
// RENDER TRANSACTIONS
// ===========================
function renderTransactions() {
    const tbody = document.getElementById('transactionsTableBody');
    const emptyState = document.getElementById('emptyState');

    let filteredTransactions = transactions;

    // Apply filter
    if (currentFilter === 'income') {
        filteredTransactions = transactions.filter(t => t.type === 'income');
    } else if (currentFilter === 'expense') {
        filteredTransactions = transactions.filter(t => t.type === 'expense');
    }

    if (filteredTransactions.length === 0) {
        tbody.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    tbody.style.display = 'table-row-group';
    emptyState.style.display = 'none';

    tbody.innerHTML = filteredTransactions.map(transaction => `
        <tr>
            <td>${transaction.description}</td>
            <td>
                <span class="category-badge">${transaction.category}</span>
            </td>
            <td>${formatDate(transaction.date)}</td>
            <td class="${transaction.type === 'income' ? 'value-income' : 'value-expense'}">
                ${transaction.type === 'income' ? '+' : '-'} ${formatCurrencyDisplay(transaction.value)}
            </td>
            <td>
                <button class="btn-delete" onclick="deleteTransaction('${transaction.id}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// ===========================
// UPDATE KPIs
// ===========================
function updateKPIs() {
    const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.value, 0);

    const expense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.value, 0);

    const balance = income - expense;

    document.getElementById('totalIncome').textContent = formatCurrencyDisplay(income);
    document.getElementById('totalExpense').textContent = formatCurrencyDisplay(expense);
    document.getElementById('totalBalance').textContent = formatCurrencyDisplay(balance);
}

// ===========================
// UPDATE CHARTS
// ===========================
function updateCharts() {
    updateCategoryChart();
    updateComparisonChart();
}

function updateCategoryChart() {
    const ctx = document.getElementById('categoryChart').getContext('2d');

    // Calculate expenses by category
    const expensesByCategory = {};
    transactions
        .filter(t => t.type === 'expense')
        .forEach(t => {
            expensesByCategory[t.category] = (expensesByCategory[t.category] || 0) + t.value;
        });

    const labels = Object.keys(expensesByCategory);
    const data = Object.values(expensesByCategory);

    // Destroy previous chart
    if (categoryChart) {
        categoryChart.destroy();
    }

    // Create new chart
    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: [
                    '#EF4444',
                    '#F59E0B',
                    '#10B981',
                    '#3B82F6',
                    '#8B5CF6',
                    '#EC4899',
                    '#14B8A6',
                    '#F97316',
                    '#6366F1'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            family: 'Inter'
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = formatCurrencyDisplay(context.parsed);
                            return `${label}: ${value}`;
                        }
                    }
                }
            }
        }
    });
}

function updateComparisonChart() {
    const ctx = document.getElementById('comparisonChart').getContext('2d');

    const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.value, 0);

    const expense = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + t.value, 0);

    // Destroy previous chart
    if (comparisonChart) {
        comparisonChart.destroy();
    }

    // Create new chart
    comparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Entradas', 'Saídas'],
            datasets: [{
                data: [income, expense],
                backgroundColor: ['#10B981', '#EF4444'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatCurrencyDisplay(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR');
                        }
                    }
                }
            }
        }
    });
}

// ===========================
// TRANSACTION MODAL
// ===========================
function openTransactionModal() {
    document.getElementById('transactionModal').classList.add('active');
    document.getElementById('transactionForm').reset();

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;

    // Set default type to income
    selectTransactionType('income');
}

function closeTransactionModal() {
    document.getElementById('transactionModal').classList.remove('active');
}

function selectTransactionType(type) {
    currentTransactionType = type;

    // Update button states
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === type) {
            btn.classList.add('active');
        }
    });

    // Update category options
    const categorySelect = document.getElementById('category');
    const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

    categorySelect.innerHTML = '<option value="">Selecione uma categoria</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
    });
}

// ===========================
// HANDLE TRANSACTION SUBMIT
// ===========================
async function handleTransactionSubmit(e) {
    e.preventDefault();

    if (!currentUser) {
        showToast('Usuário não autenticado', 'error');
        return;
    }

    const description = document.getElementById('description').value.trim();
    const valueStr = document.getElementById('value').value.replace(/\D/g, '');
    const value = parseFloat(valueStr) / 100;
    const category = document.getElementById('category').value;
    const dateStr = document.getElementById('date').value;

    if (!description || !value || !category || !dateStr) {
        showToast('Preencha todos os campos', 'error');
        return;
    }

    const transaction = {
        userId: currentUser.uid,
        type: currentTransactionType,
        description,
        value,
        category,
        date: dateStr,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        showLoading('Salvando transação...');
        await db.collection('transactions').add(transaction);
        showToast('Transação adicionada com sucesso!', 'success');
        closeTransactionModal();
    } catch (error) {
        console.error('Error adding transaction:', error);
        showToast('Erro ao adicionar transação', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// DELETE TRANSACTION
// ===========================
async function deleteTransaction(id) {
    if (!confirm('Tem certeza que deseja excluir esta transação?')) {
        return;
    }

    try {
        showLoading('Excluindo transação...');
        await db.collection('transactions').doc(id).delete();
        showToast('Transação excluída com sucesso!', 'success');
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showToast('Erro ao excluir transação', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// FILTER TRANSACTIONS
// ===========================
function filterTransactions(filter) {
    currentFilter = filter;

    // Update button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        }
    });

    renderTransactions();
}

// ===========================
// UTILITY FUNCTIONS
// ===========================
function formatCurrency(input) {
    let value = input.value.replace(/\D/g, '');
    value = (parseInt(value) / 100).toFixed(2);
    value = value.replace('.', ',');
    value = value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    input.value = value;
}

function formatCurrencyDisplay(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDate(dateStr) {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
}

function showLoading(message = 'Carregando...') {
    const overlay = document.getElementById('loadingOverlay');
    const text = overlay.querySelector('.loading-text');
    text.textContent = message;
    overlay.style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = toast.querySelector('.toast-message');
    const toastIcon = toast.querySelector('.toast-icon');

    toastMessage.textContent = message;
    toast.className = 'toast ' + type;

    if (type === 'success') {
        toastIcon.className = 'toast-icon fas fa-check-circle';
    } else if (type === 'error') {
        toastIcon.className = 'toast-icon fas fa-exclamation-circle';
    }

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('transactionModal');
    if (e.target === modal) {
        closeTransactionModal();
    }
});
