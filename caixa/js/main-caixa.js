/*
==================================================
ARQUIVO: caixa/js/main-caixa.js
MÓDULO: Gestão Financeira (Caixa) - Dashboard Completo
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 4.0 - Dashboard Financeiro Moderno
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

const AUTHORIZED_EMAILS = ["3d3printers@gmail.com", "netrindademarcus@gmail.com", "allanedg01@gmail.com", "igor.butter@gmail.com"];

const state = {
    db: null,
    auth: null,
    currentUser: null,
    isAuthorized: false,
    transactions: [],
    services: [],
    goals: { receita: 5000, despesa: 3000 },
    currentPeriod: 'month',
    currentFilter: 'todos',
    flowChartCanvas: null,
    categoryChartCanvas: null
};

const CATEGORIES = {
    entrada: ['Venda de Produto', 'Serviço Prestado', 'Outras Receitas'],
    saida: ['Matéria-Prima', 'Energia', 'Aluguel', 'Manutenção', 'Marketing', 'Outras Despesas']
};

const COLORS = {
    entrada: '#00FF88',
    saida: '#FF0055',
    blue: '#00D4FF',
    purple: '#9945FF',
    yellow: '#FFD700',
    orange: '#FF6B35',
    categories: ['#00D4FF', '#9945FF', '#FF6B35', '#FFD700', '#00FF88', '#FF0055'],
    grid: 'rgba(255, 255, 255, 0.06)',
    text: '#9ca3af'
};

// ===========================
// FIREBASE INIT
// ===========================
try {
    firebase.initializeApp(firebaseConfig);
    state.db = firebase.firestore();
    state.auth = firebase.auth();
} catch (error) {
    console.error('Erro ao inicializar Firebase:', error);
}

// ===========================
// DOM READY
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    if (!state.auth) {
        hideLoading();
        return alert('Erro ao inicializar autenticação.');
    }

    state.auth.onAuthStateChanged(user => {
        hideLoading();
        state.currentUser = user;

        if (user) {
            if (AUTHORIZED_EMAILS.includes(user.email)) {
                state.isAuthorized = true;
                showDashboard(user);
                startListeners();
                loadGoals();
                initCharts();
                updatePeriodDisplay();
            } else {
                state.isAuthorized = false;
                showToast('Acesso negado. Área restrita.', 'error');
                setTimeout(() => state.auth.signOut(), 2000);
            }
        } else {
            state.isAuthorized = false;
            showLoginScreen();
        }
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
        showToast('Erro ao fazer login', 'error');
    }
};

window.signOut = async () => {
    try {
        await state.auth.signOut();
        showToast('Logout realizado', 'info');
    } catch (error) {
        console.error('Erro no logout:', error);
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
        userPhoto.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=00D4FF&color=fff`;
    }

    monitorConnection();
};

// ===========================
// FIREBASE LISTENERS
// ===========================
const startListeners = () => {
    state.db.collection('transactions')
        .orderBy('date', 'desc')
        .onSnapshot(snapshot => {
            state.transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateDashboard();
        });

    state.db.collection('services')
        .where('value', '>', 0)
        .onSnapshot(snapshot => {
            state.services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            updateDashboard();
        });
};

// ===========================
// GOALS
// ===========================
const loadGoals = async () => {
    try {
        const doc = await state.db.collection('settings').doc('goals').get();
        if (doc.exists) {
            state.goals = doc.data();
        }
        updateGoalsDisplay();
    } catch (error) {
        console.error('Erro ao carregar metas:', error);
    }
};

window.openGoalModal = () => {
    document.getElementById('goalReceita').value = state.goals.receita;
    document.getElementById('goalDespesa').value = state.goals.despesa;
    document.getElementById('goalModal')?.classList.add('active');
};

window.closeGoalModal = () => {
    document.getElementById('goalModal')?.classList.remove('active');
};

window.saveGoals = async e => {
    e.preventDefault();

    const receita = parseFloat(document.getElementById('goalReceita').value);
    const despesa = parseFloat(document.getElementById('goalDespesa').value);

    try {
        await state.db.collection('settings').doc('goals').set({ receita, despesa });
        state.goals = { receita, despesa };
        closeGoalModal();
        updateGoalsDisplay();
        showToast('Metas atualizadas!', 'success');
    } catch (error) {
        console.error('Erro ao salvar metas:', error);
        showToast('Erro ao salvar metas', 'error');
    }
};

const updateGoalsDisplay = () => {
    document.getElementById('receitaMeta').textContent = formatCurrency(state.goals.receita);
    document.getElementById('despesaLimite').textContent = formatCurrency(state.goals.despesa);
};

// ===========================
// DASHBOARD UPDATE
// ===========================
const updateDashboard = () => {
    const { start, end } = getPeriodDates();
    const { start: prevStart, end: prevEnd } = getPreviousPeriodDates();

    // Filter current period
    const currentTransactions = state.transactions.filter(t => {
        const date = new Date(t.date);
        return date >= start && date <= end;
    });

    // Filter previous period for comparison
    const previousTransactions = state.transactions.filter(t => {
        const date = new Date(t.date);
        return date >= prevStart && date <= prevEnd;
    });

    // Service entries
    const serviceEntries = state.services
        .filter(s => {
            if (!s.createdAt || !s.value) return false;
            const date = new Date(s.createdAt);
            return date >= start && date <= end && s.value > 0;
        })
        .map(s => ({
            type: 'entrada',
            value: parseFloat(s.value),
            date: s.createdAt,
            description: `Venda: ${s.name || 'Serviço'}`,
            category: 'Venda de Produto',
            source: 'service',
            scheduled: false,
            serviceId: s.id
        }));

    const allEntries = [...currentTransactions, ...serviceEntries];

    // Calculate current period
    const realizadas = allEntries.filter(t => !t.scheduled);
    const programadas = allEntries.filter(t => t.scheduled);

    const entradasRealizadas = realizadas.filter(t => t.type === 'entrada').reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    const saidasRealizadas = realizadas.filter(t => t.type === 'saida').reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    const saldoReal = entradasRealizadas - saidasRealizadas;

    const entradasProg = programadas.filter(t => t.type === 'entrada').reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    const saidasProg = programadas.filter(t => t.type === 'saida').reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    const saldoProjetado = saldoReal + entradasProg - saidasProg;

    // Calculate previous period
    const prevEntradas = previousTransactions.filter(t => t.type === 'entrada' && !t.scheduled).reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    const prevSaidas = previousTransactions.filter(t => t.type === 'saida' && !t.scheduled).reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    const prevSaldo = prevEntradas - prevSaidas;
    const prevResultado = prevEntradas - prevSaidas;

    // Update KPIs
    document.getElementById('saldoAtual').textContent = formatCurrency(saldoReal);
    document.getElementById('totalEntradas').textContent = formatCurrency(entradasRealizadas);
    document.getElementById('totalSaidas').textContent = formatCurrency(saidasRealizadas);
    document.getElementById('resultado').textContent = formatCurrency(saldoReal);

    // Update counts
    const entradasCount = realizadas.filter(t => t.type === 'entrada').length;
    const saidasCount = realizadas.filter(t => t.type === 'saida').length;
    document.getElementById('entradasCount').textContent = `${entradasCount} transações`;
    document.getElementById('saidasCount').textContent = `${saidasCount} transações`;

    // Update margin
    const margem = entradasRealizadas > 0 ? ((saldoReal / entradasRealizadas) * 100).toFixed(1) : 0;
    document.getElementById('margemLucro').textContent = `Margem: ${margem}%`;

    // Update trends
    updateTrend('saldoTrend', saldoReal, prevSaldo);
    updateTrend('entradasTrend', entradasRealizadas, prevEntradas);
    updateTrend('saidasTrend', saidasRealizadas, prevSaidas, true);
    updateTrend('resultadoTrend', saldoReal, prevResultado);

    // Update projections
    document.getElementById('saldoProjetado').textContent = formatCurrency(saldoProjetado);
    document.getElementById('entradasProgramadas').textContent = formatCurrency(entradasProg);
    document.getElementById('saidasProgramadas').textContent = formatCurrency(saidasProg);
    document.getElementById('entradasProgramadasCount').textContent = `${programadas.filter(t => t.type === 'entrada').length} pendentes`;
    document.getElementById('saidasProgramadasCount').textContent = `${programadas.filter(t => t.type === 'saida').length} pendentes`;

    // Update goals
    const receitaPercent = Math.min((entradasRealizadas / state.goals.receita) * 100, 100);
    const despesaPercent = Math.min((saidasRealizadas / state.goals.despesa) * 100, 100);

    document.getElementById('receitaAtual').textContent = formatCurrency(entradasRealizadas);
    document.getElementById('despesaAtual').textContent = formatCurrency(saidasRealizadas);
    document.getElementById('receitaBar').style.width = `${receitaPercent}%`;
    document.getElementById('despesaBar').style.width = `${despesaPercent}%`;
    document.getElementById('receitaPercent').textContent = `${receitaPercent.toFixed(0)}%`;
    document.getElementById('despesaPercent').textContent = `${despesaPercent.toFixed(0)}%`;

    // Update charts
    updateCharts(realizadas);

    // Update transactions list
    renderTransactions(allEntries);
};

const updateTrend = (elementId, current, previous, inverse = false) => {
    const element = document.getElementById(elementId);
    if (!element) return;

    let percent = 0;
    if (previous > 0) {
        percent = ((current - previous) / previous) * 100;
    } else if (current > 0) {
        percent = 100;
    }

    const isPositive = inverse ? percent <= 0 : percent >= 0;
    element.className = `kpi-trend ${isPositive ? 'positive' : 'negative'}`;
    element.innerHTML = `<i class="fas fa-arrow-up"></i><span>${Math.abs(percent).toFixed(0)}%</span>`;
};

// ===========================
// CHARTS
// ===========================
const initCharts = () => {
    const flowCanvas = document.getElementById('flowChart');
    const categoryCanvas = document.getElementById('categoryChart');

    if (flowCanvas) {
        state.flowChartCanvas = flowCanvas.getContext('2d');
        setupCanvas(flowCanvas);
    }

    if (categoryCanvas) {
        state.categoryChartCanvas = categoryCanvas.getContext('2d');
        setupCanvas(categoryCanvas);
    }

    window.addEventListener('resize', () => {
        if (flowCanvas) setupCanvas(flowCanvas);
        if (categoryCanvas) setupCanvas(categoryCanvas);
        updateDashboard();
    });
};

const setupCanvas = canvas => {
    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = container.clientWidth * dpr;
    canvas.height = container.clientHeight * dpr;
    canvas.style.width = container.clientWidth + 'px';
    canvas.style.height = container.clientHeight + 'px';
    canvas.getContext('2d').scale(dpr, dpr);
};

const updateCharts = entries => {
    drawFlowChart(entries);
    drawCategoryChart(entries);
};

const drawFlowChart = entries => {
    const ctx = state.flowChartCanvas;
    if (!ctx) return;

    const canvas = ctx.canvas;
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    const grouped = groupByPeriod(entries);
    const labels = Object.keys(grouped).sort();

    if (labels.length === 0) {
        drawEmptyState(ctx, width, height, 'Sem dados no período');
        return;
    }

    const entradasData = labels.map(l => grouped[l].entradas);
    const saidasData = labels.map(l => grouped[l].saidas);
    const maxValue = Math.max(...entradasData, ...saidasData, 100) * 1.1;

    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Grid
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
    }

    // Y labels
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px Inter';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        const value = maxValue - (maxValue / 4) * i;
        const y = padding.top + (chartHeight / 4) * i;
        ctx.fillText(formatCompact(value), padding.left - 8, y + 3);
    }

    // Bars
    const barWidth = Math.min(chartWidth / labels.length / 3, 20);
    const groupWidth = chartWidth / labels.length;

    labels.forEach((label, i) => {
        const x = padding.left + groupWidth * i + groupWidth / 2;

        // Entradas
        const eh = (entradasData[i] / maxValue) * chartHeight;
        if (eh > 0) {
            ctx.fillStyle = COLORS.entrada;
            roundedRect(ctx, x - barWidth - 2, padding.top + chartHeight - eh, barWidth, eh, 3);
        }

        // Saídas
        const sh = (saidasData[i] / maxValue) * chartHeight;
        if (sh > 0) {
            ctx.fillStyle = COLORS.saida;
            roundedRect(ctx, x + 2, padding.top + chartHeight - sh, barWidth, sh, 3);
        }

        // X label
        ctx.fillStyle = COLORS.text;
        ctx.font = '9px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, height - padding.bottom + 15);
    });
};

const drawCategoryChart = entries => {
    const ctx = state.categoryChartCanvas;
    if (!ctx) return;

    const canvas = ctx.canvas;
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    // Group by category (only saidas)
    const saidas = entries.filter(e => e.type === 'saida');
    const byCategory = {};

    saidas.forEach(s => {
        const cat = s.category || 'Outras Despesas';
        byCategory[cat] = (byCategory[cat] || 0) + parseFloat(s.value || 0);
    });

    const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    const total = categories.reduce((sum, [, val]) => sum + val, 0);

    if (total === 0) {
        drawEmptyState(ctx, width, height, 'Sem despesas');
        return;
    }

    const centerX = width / 2;
    const centerY = height / 2 - 20;
    const radius = Math.min(width, height) / 3;
    const innerRadius = radius * 0.6;

    let currentAngle = -Math.PI / 2;

    categories.forEach(([cat, value], i) => {
        const angle = (value / total) * Math.PI * 2;
        ctx.fillStyle = COLORS.categories[i % COLORS.categories.length];
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + angle);
        ctx.closePath();
        ctx.fill();
        currentAngle += angle;
    });

    // Center hole
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Center text
    ctx.fillStyle = COLORS.text;
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('DESPESAS', centerX, centerY - 5);
    ctx.font = 'bold 12px Orbitron';
    ctx.fillText(formatCompact(total), centerX, centerY + 12);

    // Legend
    const legendY = height - 40;
    const legendX = 10;
    const itemWidth = width / Math.min(categories.length, 3);

    categories.slice(0, 3).forEach(([cat, value], i) => {
        const x = legendX + itemWidth * i;
        ctx.fillStyle = COLORS.categories[i % COLORS.categories.length];
        ctx.fillRect(x, legendY - 6, 8, 8);
        ctx.fillStyle = COLORS.text;
        ctx.font = '9px Inter';
        ctx.textAlign = 'left';
        const shortCat = cat.length > 12 ? cat.substring(0, 10) + '...' : cat;
        ctx.fillText(shortCat, x + 12, legendY);
    });
};

const groupByPeriod = entries => {
    const grouped = {};

    entries.forEach(entry => {
        const date = new Date(entry.date);
        let key;

        if (state.currentPeriod === 'week') {
            key = date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
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

const roundedRect = (ctx, x, y, w, h, r) => {
    if (h < r * 2) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
};

const drawEmptyState = (ctx, width, height, message) => {
    ctx.fillStyle = COLORS.text;
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(message, width / 2, height / 2);
};

// ===========================
// TRANSACTIONS
// ===========================
const renderTransactions = entries => {
    const container = document.getElementById('transactionsList');
    if (!container) return;

    let filtered = entries;

    if (state.currentFilter === 'entrada') {
        filtered = entries.filter(e => e.type === 'entrada');
    } else if (state.currentFilter === 'saida') {
        filtered = entries.filter(e => e.type === 'saida');
    } else if (state.currentFilter === 'scheduled') {
        filtered = entries.filter(e => e.scheduled);
    }

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhuma transação encontrada</p></div>';
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

    const badges = [];
    if (t.source === 'service') badges.push('<span class="transaction-badge badge-service">Serviço</span>');
    if (t.scheduled) badges.push('<span class="transaction-badge badge-scheduled">Programada</span>');

    const actions = t.source !== 'service' ? `
        <div class="transaction-actions">
            <button class="btn-action" onclick="editTransaction('${t.id}')" title="Editar">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn-action delete" onclick="deleteTransaction('${t.id}')" title="Excluir">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    ` : '';

    return `
        <div class="transaction-item ${t.type}">
            <div class="transaction-icon">
                <i class="fas ${icon}"></i>
            </div>
            <div class="transaction-details">
                <div class="transaction-desc">${escapeHtml(t.description)}</div>
                <div class="transaction-meta">
                    <span><i class="fas fa-calendar"></i> ${date}</span>
                    ${t.category ? `<span><i class="fas fa-tag"></i> ${escapeHtml(t.category)}</span>` : ''}
                    ${badges.join(' ')}
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
// CRUD
// ===========================
window.openTransactionModal = type => {
    document.getElementById('transactionId').value = '';
    document.getElementById('transactionType').value = type;
    document.getElementById('transactionForm').reset();
    setTodayDate();

    const title = type === 'entrada' ? 'Nova Entrada' : 'Nova Saída';
    const icon = type === 'entrada' ? 'fa-plus' : 'fa-minus';
    document.getElementById('modalTitle').innerHTML = `<i class="fas ${icon}"></i> ${title}`;

    populateCategories(type);
    document.getElementById('transactionModal')?.classList.add('active');
};

window.closeModal = () => {
    document.getElementById('transactionModal')?.classList.remove('active');
};

window.saveTransaction = async e => {
    e.preventDefault();

    if (!state.isAuthorized) {
        return showToast('Sem permissão', 'error');
    }

    const id = document.getElementById('transactionId').value;
    const type = document.getElementById('transactionType').value;
    const description = document.getElementById('description').value.trim();
    const value = parseFloat(document.getElementById('value').value);
    const date = document.getElementById('date').value;
    const category = document.getElementById('category').value;
    const notes = document.getElementById('notes').value.trim();
    const scheduled = document.getElementById('scheduled')?.checked || false;

    if (!description || !value || !date) {
        return showToast('Preencha os campos obrigatórios', 'error');
    }

    const transaction = {
        type, description, value, date, category, notes, scheduled,
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
        showToast('Erro ao salvar', 'error');
    }
};

window.editTransaction = id => {
    const t = state.transactions.find(t => t.id === id);
    if (!t) return;

    document.getElementById('transactionId').value = id;
    document.getElementById('transactionType').value = t.type;
    document.getElementById('description').value = t.description;
    document.getElementById('value').value = t.value;
    document.getElementById('date').value = t.date;
    document.getElementById('category').value = t.category || '';
    document.getElementById('notes').value = t.notes || '';
    document.getElementById('scheduled').checked = t.scheduled || false;

    const title = t.type === 'entrada' ? 'Editar Entrada' : 'Editar Saída';
    document.getElementById('modalTitle').innerHTML = `<i class="fas fa-edit"></i> ${title}`;

    populateCategories(t.type);
    document.getElementById('transactionModal')?.classList.add('active');
};

window.deleteTransaction = async id => {
    if (!state.isAuthorized) return showToast('Sem permissão', 'error');
    if (!confirm('Excluir esta transação?')) return;

    try {
        await state.db.collection('transactions').doc(id).delete();
        showToast('Transação excluída!', 'success');
    } catch (error) {
        console.error('Erro ao excluir:', error);
        showToast('Erro ao excluir', 'error');
    }
};

// ===========================
// FILTERS & PERIOD
// ===========================
window.changePeriod = period => {
    state.currentPeriod = period;

    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.period === period);
    });

    updatePeriodDisplay();
    updateDashboard();
};

window.filterTransactions = filter => {
    state.currentFilter = filter;

    document.querySelectorAll('.filter-chip').forEach(btn => btn.classList.remove('active'));
    event.target.closest('.filter-chip').classList.add('active');

    updateDashboard();
};

const getPeriodDates = () => {
    const now = new Date();
    let start, end;

    if (state.currentPeriod === 'week') {
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        end = new Date(start);
        end.setDate(start.getDate() + 6);
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

const getPreviousPeriodDates = () => {
    const now = new Date();
    let start, end;

    if (state.currentPeriod === 'week') {
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay() - 7);
        end = new Date(start);
        end.setDate(start.getDate() + 6);
    } else if (state.currentPeriod === 'month') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else {
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
};

const updatePeriodDisplay = () => {
    const now = new Date();
    let text;

    if (state.currentPeriod === 'week') {
        const weekNum = getWeekNumber(now);
        text = `Semana ${weekNum}`;
    } else if (state.currentPeriod === 'month') {
        text = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        text = text.charAt(0).toUpperCase() + text.slice(1);
    } else {
        text = `Ano ${now.getFullYear()}`;
    }

    document.getElementById('periodText').textContent = text;
};

// ===========================
// UTILITIES
// ===========================
const formatCurrency = value => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatCompact = value => {
    if (value >= 1000) return 'R$ ' + (value / 1000).toFixed(1) + 'k';
    return 'R$ ' + Math.round(value);
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
    document.getElementById('date').value = today;
};

const populateCategories = type => {
    const select = document.getElementById('category');
    if (!select) return;

    select.innerHTML = '<option value="">Selecione</option>';
    CATEGORIES[type].forEach(cat => {
        select.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
};

// ===========================
// CONNECTION & TOAST
// ===========================
const monitorConnection = () => {
    const update = connected => {
        const el = document.getElementById('connectionStatus');
        const text = document.getElementById('statusText');
        if (el && text) {
            el.classList.toggle('offline', !connected);
            text.textContent = connected ? 'Conectado' : 'Offline';
        }
    };

    window.addEventListener('online', () => { update(true); showToast('Conexão restaurada', 'success'); });
    window.addEventListener('offline', () => { update(false); showToast('Sem conexão', 'error'); });
    update(navigator.onLine);
};

const showToast = (message, type = 'info') => {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => container.contains(toast) && container.removeChild(toast), 300);
    }, 3000);
};
