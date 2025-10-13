/* 
==================================================
ARQUIVO: caixa/js/main-caixa.js
MÓDULO: Gestão Financeira (Caixa) - Main
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 1.1 - Corrigido (Chart.js + Permissions)
IMPORTANTE: NÃO REMOVER ESTE CABEÇALHO DE IDENTIFICAÇÃO
==================================================
*/

// ===========================
// FIREBASE CONFIG & STATE
// ===========================
const firebaseConfig = {
    apiKey: "AIzaSyDZxuazTrmimr0951TmTCKckI4Ede2hdn4",
    authDomain: "imaginatech-servicos.firebaseapp.com",
    projectId: "imaginatech-servicos",
    storageBucket: "imaginatech-servicos.firebasestorage.app",
    messagingSenderId: "321455309872",
    appId: "1:321455309872:web:e7ba49a0f020bbae1159f5"
};

const AUTHORIZED_EMAILS = ["3d3printers@gmail.com", "netrindademarcus@gmail.com", "igor.butter@gmail.com"];

const state = {
    db: null,
    auth: null,
    currentUser: null,
    isAuthorized: false,
    transactions: [],
    services: [],
    currentPeriod: 'month',
    currentFilter: 'todos',
    flowChart: null,
    pieChart: null,
    transactionsListener: null,
    servicesListener: null,
    chartJsReady: false
};

const CATEGORIES = {
    entrada: ['Venda de Produto', 'Serviço Prestado', 'Outras Receitas'],
    saida: ['Matéria-Prima', 'Energia', 'Aluguel', 'Manutenção', 'Outras Despesas']
};

// ===========================
// INITIALIZATION
// ===========================
try {
    firebase.initializeApp(firebaseConfig);
    state.db = firebase.firestore();
    state.auth = firebase.auth();
} catch (error) {
    console.error('Erro ao inicializar Firebase:', error);
    alert('Erro crítico ao conectar ao Firebase.');
}

// ===========================
// CHART.JS READY CHECK
// ===========================
const waitForChart = () => {
    return new Promise((resolve) => {
        if (typeof Chart !== 'undefined') {
            state.chartJsReady = true;
            resolve();
        } else {
            const checkInterval = setInterval(() => {
                if (typeof Chart !== 'undefined') {
                    clearInterval(checkInterval);
                    state.chartJsReady = true;
                    resolve();
                }
            }, 100);
            
            // Timeout após 5 segundos
            setTimeout(() => {
                clearInterval(checkInterval);
                console.error('Chart.js não carregou em 5 segundos');
                showToast('Erro ao carregar gráficos. Recarregue a página.', 'error');
                resolve(); // Resolve mesmo com erro para não travar
            }, 5000);
        }
    });
};

// ===========================
// DOM READY
// ===========================
document.addEventListener('DOMContentLoaded', async () => {
    if (!state.auth) {
        hideLoading();
        return alert('Erro ao inicializar autenticação.');
    }
    
    // Aguarda Chart.js carregar
    await waitForChart();
    
    state.auth.onAuthStateChanged(user => {
        hideLoading();
        state.currentUser = user;
        
        if (user) {
            if (AUTHORIZED_EMAILS.includes(user.email)) {
                state.isAuthorized = true;
                showDashboard(user);
                startListeners();
                if (state.chartJsReady) {
                    initCharts();
                }
                setTodayDate();
            } else {
                state.isAuthorized = false;
                showToast('Acesso negado. Esta área é restrita aos administradores.', 'error');
                setTimeout(() => state.auth.signOut(), 2000);
            }
        } else {
            state.isAuthorized = false;
            showLoginScreen();
        }
    }, error => {
        console.error('Erro no auth state:', error);
        hideLoading();
        showLoginScreen();
    });
});

// ===========================
// AUTH
// ===========================
window.signInWithGoogle = async () => {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await state.auth.signInWithPopup(provider);
    } catch (error) {
        console.error('Erro no login:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            showToast('Login cancelado', 'info');
        } else {
            showToast('Erro ao fazer login', 'error');
        }
    }
};

window.signOut = async () => {
    try {
        await state.auth.signOut();
        showToast('Logout realizado com sucesso', 'info');
    } catch (error) {
        console.error('Erro no logout:', error);
        showToast('Erro ao fazer logout', 'error');
    }
};

// ===========================
// UI MANAGEMENT
// ===========================
const hideLoading = () => document.getElementById('loadingOverlay')?.classList.add('hidden');

const showLoginScreen = () => {
    document.getElementById('loginScreen')?.classList.remove('hidden');
    document.getElementById('dashboard')?.classList.add('hidden');
};

const showDashboard = user => {
    document.getElementById('loginScreen')?.classList.add('hidden');
    document.getElementById('dashboard')?.classList.remove('hidden');
    
    const userName = document.getElementById('userName');
    const userPhoto = document.getElementById('userPhoto');
    
    if (userName) userName.textContent = user.displayName || user.email;
    if (userPhoto) {
        userPhoto.src = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || user.email) + '&background=00D4FF&color=fff';
    }
};

// ===========================
// FIREBASE LISTENERS
// ===========================
const startListeners = () => {
    // Listener para transações manuais
    state.transactionsListener = state.db.collection('transactions')
        .orderBy('date', 'desc')
        .onSnapshot(
            snapshot => {
                state.transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                updateDashboard();
            },
            error => {
                console.error('Erro no listener de transactions:', error);
                if (error.code === 'permission-denied') {
                    showToast('Sem permissão para acessar transações. Configure o Firestore.', 'error');
                }
            }
        );
    
    // Listener para serviços (entradas automáticas)
    state.servicesListener = state.db.collection('services')
        .where('value', '>', 0)
        .onSnapshot(
            snapshot => {
                state.services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                updateDashboard();
            },
            error => {
                console.error('Erro no listener de services:', error);
            }
        );
};

// ===========================
// DASHBOARD UPDATE
// ===========================
const updateDashboard = () => {
    const { start, end } = getPeriodDates();
    
    const filteredTransactions = state.transactions.filter(t => {
        const tDate = new Date(t.date);
        return tDate >= start && tDate <= end;
    });
    
    const serviceEntries = state.services
        .filter(s => {
            if (!s.createdAt || !s.value) return false;
            const sDate = new Date(s.createdAt);
            return sDate >= start && sDate <= end && s.value > 0;
        })
        .map(s => ({
            type: 'entrada',
            value: parseFloat(s.value),
            date: s.createdAt,
            description: `Venda: ${s.name || 'Sem nome'}`,
            category: 'Venda de Produto',
            source: 'service',
            serviceId: s.id
        }));
    
    const allEntries = [...filteredTransactions, ...serviceEntries];
    
    const entradas = allEntries.filter(t => t.type === 'entrada').reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    const saidas = allEntries.filter(t => t.type === 'saida').reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    const resultado = entradas - saidas;
    
    const totalEntradasEl = document.getElementById('totalEntradas');
    const totalSaidasEl = document.getElementById('totalSaidas');
    const resultadoEl = document.getElementById('resultado');
    const balanceValueEl = document.getElementById('balanceValue');
    
    if (totalEntradasEl) totalEntradasEl.textContent = formatCurrency(entradas);
    if (totalSaidasEl) totalSaidasEl.textContent = formatCurrency(saidas);
    if (resultadoEl) resultadoEl.textContent = formatCurrency(resultado);
    if (balanceValueEl) balanceValueEl.textContent = formatCurrency(resultado);
    
    const trend = document.getElementById('balanceTrend');
    if (trend) {
        if (resultado > 0) {
            trend.className = 'balance-trend positive';
            trend.innerHTML = `<i class="fas fa-arrow-up"></i><span>+${formatCurrency(resultado)}</span>`;
        } else if (resultado < 0) {
            trend.className = 'balance-trend negative';
            trend.innerHTML = `<i class="fas fa-arrow-down"></i><span>${formatCurrency(Math.abs(resultado))}</span>`;
        } else {
            trend.className = 'balance-trend';
            trend.innerHTML = `<i class="fas fa-minus"></i><span>R$ 0,00</span>`;
        }
    }
    
    if (state.chartJsReady) {
        updateCharts(allEntries);
    }
    renderTransactions(allEntries);
};

// ===========================
// CHARTS
// ===========================
const initCharts = () => {
    if (!state.chartJsReady || typeof Chart === 'undefined') {
        console.warn('Chart.js não disponível, pulando inicialização');
        return;
    }
    
    const flowCtx = document.getElementById('flowChart')?.getContext('2d');
    const pieCtx = document.getElementById('pieChart')?.getContext('2d');
    
    if (!flowCtx || !pieCtx) {
        console.warn('Canvas não encontrado para gráficos');
        return;
    }
    
    Chart.defaults.color = '#9ca3af';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
    
    state.flowChart = new Chart(flowCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Entradas',
                data: [],
                backgroundColor: 'rgba(0, 255, 136, 0.7)',
                borderColor: '#00FF88',
                borderWidth: 2
            }, {
                label: 'Saídas',
                data: [],
                backgroundColor: 'rgba(255, 0, 85, 0.7)',
                borderColor: '#FF0055',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'top' }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: { 
                        callback: v => 'R$ ' + v.toFixed(0)
                    }
                }
            }
        }
    });
    
    state.pieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: ['Entradas', 'Saídas'],
            datasets: [{
                data: [0, 0],
                backgroundColor: ['rgba(0, 255, 136, 0.7)', 'rgba(255, 0, 85, 0.7)'],
                borderColor: ['#00FF88', '#FF0055'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true, position: 'bottom' }
            }
        }
    });
};

const updateCharts = entries => {
    if (!state.flowChart || !state.pieChart || !state.chartJsReady) return;
    
    const grouped = groupByPeriod(entries);
    const labels = Object.keys(grouped).sort();
    
    const entradasData = labels.map(l => grouped[l].entradas);
    const saidasData = labels.map(l => grouped[l].saidas);
    
    state.flowChart.data.labels = labels;
    state.flowChart.data.datasets[0].data = entradasData;
    state.flowChart.data.datasets[1].data = saidasData;
    state.flowChart.update();
    
    const totalEntradas = entradasData.reduce((a, b) => a + b, 0);
    const totalSaidas = saidasData.reduce((a, b) => a + b, 0);
    
    state.pieChart.data.datasets[0].data = [totalEntradas, totalSaidas];
    state.pieChart.update();
};

const groupByPeriod = entries => {
    const grouped = {};
    
    entries.forEach(entry => {
        let key;
        const date = new Date(entry.date);
        
        if (state.currentPeriod === 'week') {
            const week = getWeekNumber(date);
            key = `Sem ${week}`;
        } else if (state.currentPeriod === 'month') {
            key = date.getDate().toString().padStart(2, '0');
        } else {
            key = date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        }
        
        if (!grouped[key]) grouped[key] = { entradas: 0, saidas: 0 };
        
        if (entry.type === 'entrada') {
            grouped[key].entradas += parseFloat(entry.value || 0);
        } else {
            grouped[key].saidas += parseFloat(entry.value || 0);
        }
    });
    
    return grouped;
};

// ===========================
// TRANSACTIONS RENDER
// ===========================
const renderTransactions = entries => {
    const container = document.getElementById('transactionsList');
    if (!container) return;
    
    let filtered = entries;
    if (state.currentFilter !== 'todos') {
        filtered = entries.filter(e => e.type === state.currentFilter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhuma transação no período</p></div>';
        return;
    }
    
    container.innerHTML = filtered
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(t => createTransactionCard(t))
        .join('');
};

const createTransactionCard = t => {
    const icon = t.type === 'entrada' ? 'fa-arrow-up' : 'fa-arrow-down';
    const date = new Date(t.date).toLocaleDateString('pt-BR');
    const source = t.source === 'service' ? '<span class="transaction-badge">Do Painel</span>' : '';
    const actions = t.source !== 'service' ? `
        <div class="transaction-actions">
            <button class="btn-icon-small" onclick="editTransaction('${t.id}')" title="Editar">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn-icon-small delete" onclick="deleteTransaction('${t.id}')" title="Excluir">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    ` : '';
    
    return `
        <div class="transaction-item ${t.type}">
            <div class="transaction-info">
                <div class="transaction-icon">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="transaction-details">
                    <div class="transaction-desc">${escapeHtml(t.description)}</div>
                    <div class="transaction-meta">
                        <span><i class="fas fa-calendar"></i> ${date}</span>
                        ${t.category ? `<span><i class="fas fa-tag"></i> ${escapeHtml(t.category)}</span>` : ''}
                        ${source}
                    </div>
                </div>
            </div>
            <div class="transaction-value">
                ${t.type === 'entrada' ? '+' : '-'} ${formatCurrency(t.value)}
            </div>
            ${actions}
        </div>
    `;
};

// ===========================
// CRUD OPERATIONS
// ===========================
window.openTransactionModal = type => {
    document.getElementById('transactionId').value = '';
    document.getElementById('transactionType').value = type;
    document.getElementById('transactionForm').reset();
    setTodayDate();
    
    const title = type === 'entrada' ? 'Nova Entrada' : 'Nova Despesa';
    const icon = type === 'entrada' ? 'fa-plus-circle' : 'fa-minus-circle';
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) {
        modalTitle.innerHTML = `<i class="fas ${icon}"></i> ${title}`;
    }
    
    populateCategories(type);
    document.getElementById('transactionModal')?.classList.add('active');
};

window.closeModal = () => {
    document.getElementById('transactionModal')?.classList.remove('active');
};

window.saveTransaction = async e => {
    e.preventDefault();
    
    if (!state.isAuthorized) {
        return showToast('Sem permissão para salvar', 'error');
    }
    
    const id = document.getElementById('transactionId').value;
    const type = document.getElementById('transactionType').value;
    const description = document.getElementById('description').value.trim();
    const value = parseFloat(document.getElementById('value').value);
    const date = document.getElementById('date').value;
    const category = document.getElementById('category').value;
    const notes = document.getElementById('notes').value.trim();
    
    if (!description || !value || !date) {
        return showToast('Preencha todos os campos obrigatórios', 'error');
    }
    
    if (value <= 0) {
        return showToast('O valor deve ser maior que zero', 'error');
    }
    
    const transaction = {
        type,
        description,
        value,
        date,
        category,
        notes,
        updatedAt: new Date().toISOString(),
        updatedBy: state.currentUser.email
    };
    
    try {
        if (id) {
            await state.db.collection('transactions').doc(id).update(transaction);
            showToast('Transação atualizada!', 'success');
        } else {
            transaction.createdAt = new Date().toISOString();
            transaction.createdBy = state.currentUser.email;
            await state.db.collection('transactions').add(transaction);
            showToast('Transação adicionada!', 'success');
        }
        closeModal();
    } catch (error) {
        console.error('Erro ao salvar:', error);
        if (error.code === 'permission-denied') {
            showToast('Sem permissão. Configure as regras do Firestore.', 'error');
        } else {
            showToast('Erro ao salvar transação', 'error');
        }
    }
};

window.editTransaction = id => {
    const transaction = state.transactions.find(t => t.id === id);
    if (!transaction) return;
    
    document.getElementById('transactionId').value = id;
    document.getElementById('transactionType').value = transaction.type;
    document.getElementById('description').value = transaction.description;
    document.getElementById('value').value = transaction.value;
    document.getElementById('date').value = transaction.date;
    document.getElementById('category').value = transaction.category || '';
    document.getElementById('notes').value = transaction.notes || '';
    
    const title = transaction.type === 'entrada' ? 'Editar Entrada' : 'Editar Despesa';
    const icon = 'fa-edit';
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) {
        modalTitle.innerHTML = `<i class="fas ${icon}"></i> ${title}`;
    }
    
    populateCategories(transaction.type);
    document.getElementById('transactionModal')?.classList.add('active');
};

window.deleteTransaction = async id => {
    if (!state.isAuthorized) {
        return showToast('Sem permissão', 'error');
    }
    
    if (!confirm('Deseja realmente excluir esta transação?')) return;
    
    try {
        await state.db.collection('transactions').doc(id).delete();
        showToast('Transação excluída!', 'success');
    } catch (error) {
        console.error('Erro ao excluir:', error);
        if (error.code === 'permission-denied') {
            showToast('Sem permissão para excluir', 'error');
        } else {
            showToast('Erro ao excluir transação', 'error');
        }
    }
};

// ===========================
// FILTERS & PERIOD
// ===========================
window.changePeriod = period => {
    state.currentPeriod = period;
    
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.period === period);
    });
    
    updatePeriodDisplay();
    updateDashboard();
};

window.filterTransactions = filter => {
    state.currentFilter = filter;
    const { start, end } = getPeriodDates();
    
    const serviceEntries = state.services
        .filter(s => {
            if (!s.createdAt || !s.value) return false;
            const sDate = new Date(s.createdAt);
            return sDate >= start && sDate <= end && s.value > 0;
        })
        .map(s => ({
            type: 'entrada',
            value: s.value,
            date: s.createdAt,
            description: `Venda: ${s.name}`,
            category: 'Venda de Produto',
            source: 'service'
        }));
    
    const entries = [...state.transactions, ...serviceEntries].filter(t => {
        const tDate = new Date(t.date);
        return tDate >= start && tDate <= end;
    });
    
    renderTransactions(entries);
};

const getPeriodDates = () => {
    const now = new Date();
    let start, end = new Date();
    
    if (state.currentPeriod === 'week') {
        start = new Date(now.setDate(now.getDate() - now.getDay()));
        end = new Date(now.setDate(now.getDate() - now.getDay() + 6));
    } else if (state.currentPeriod === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else {
        start = new Date(now.getFullYear(), 0, 1);
        end = new Date(now.getFullYear(), 11, 31);
    }
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
};

const updatePeriodDisplay = () => {
    const now = new Date();
    let text;
    
    if (state.currentPeriod === 'week') {
        text = `Semana ${getWeekNumber(now)} de ${now.getFullYear()}`;
    } else if (state.currentPeriod === 'month') {
        text = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        text = text.charAt(0).toUpperCase() + text.slice(1);
    } else {
        text = `Ano ${now.getFullYear()}`;
    }
    
    const periodText = document.getElementById('periodText');
    if (periodText) periodText.textContent = text;
};

// ===========================
// UTILITIES
// ===========================
const formatCurrency = value => {
    return new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency: 'BRL' 
    }).format(value);
};

const escapeHtml = text => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

const getWeekNumber = date => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
};

const setTodayDate = () => {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('date');
    if (dateInput) dateInput.value = today;
};

const populateCategories = type => {
    const select = document.getElementById('category');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione uma categoria</option>';
    
    CATEGORIES[type].forEach(cat => {
        select.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
};

const showToast = (message, type = 'info') => {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { 
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle'
    };
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${escapeHtml(message)}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    }, 3000);
};
