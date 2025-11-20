/* 
==================================================
ARQUIVO: caixa/js/main-caixa.js
MÓDULO: Gestão Financeira (Caixa) - Canvas Nativo
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 2.1 - Gráficos Nativos (Zero Deps)
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
    flowChartCanvas: null,
    pieChartCanvas: null,
    transactionsListener: null,
    servicesListener: null
};

const CATEGORIES = {
    entrada: ['Venda de Produto', 'Serviço Prestado', 'Outras Receitas'],
    saida: ['Matéria-Prima', 'Energia', 'Aluguel', 'Manutenção', 'Outras Despesas']
};

const COLORS = {
    entrada: '#00FF88',
    entradaGradient: ['#00FF88', '#00cc70'],
    saida: '#FF0055',
    saidaGradient: ['#FF0055', '#cc0044'],
    grid: 'rgba(255, 255, 255, 0.06)',
    text: '#9ca3af',
    textLight: '#6b7280',
    background: 'rgba(0, 0, 0, 0.3)',
    accent: '#00D4FF'
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
    alert('Erro crítico ao conectar ao Firebase.');
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
                setTodayDate();
                initCanvasCharts();
            } else {
                state.isAuthorized = false;
                showToast('Acesso negado. Área restrita aos administradores.', 'error');
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

    monitorConnection();
};

// ===========================
// FIREBASE LISTENERS
// ===========================
const startListeners = () => {
    state.transactionsListener = state.db.collection('transactions')
        .orderBy('date', 'desc')
        .onSnapshot(
            snapshot => {
                state.transactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                updateDashboard();
            },
            error => {
                console.error('Erro no listener de transactions:', error);
            }
        );
    
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
            scheduled: false,
            serviceId: s.id
        }));
    
    const allEntries = [...filteredTransactions, ...serviceEntries];
    
    const realizadas = allEntries.filter(t => !t.scheduled);
    const programadas = allEntries.filter(t => t.scheduled);
    
    const entradasRealizadas = realizadas.filter(t => t.type === 'entrada').reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    const saidasRealizadas = realizadas.filter(t => t.type === 'saida').reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    const saldoReal = entradasRealizadas - saidasRealizadas;
    
    const entradasProgramadas = programadas.filter(t => t.type === 'entrada').reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    const saidasProgramadas = programadas.filter(t => t.type === 'saida').reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
    const saldoProjetado = saldoReal + entradasProgramadas - saidasProgramadas;
    
    const totalEntradasEl = document.getElementById('totalEntradas');
    const totalSaidasEl = document.getElementById('totalSaidas');
    const resultadoEl = document.getElementById('resultado');
    
    if (totalEntradasEl) totalEntradasEl.textContent = formatCurrency(entradasRealizadas);
    if (totalSaidasEl) totalSaidasEl.textContent = formatCurrency(saidasRealizadas);
    if (resultadoEl) resultadoEl.textContent = formatCurrency(saldoReal);
    
    const balanceValueEl = document.getElementById('balanceValue');
    const balanceProjectedEl = document.getElementById('balanceProjected');
    
    if (balanceValueEl) {
        balanceValueEl.textContent = formatCurrency(saldoReal);
        balanceValueEl.className = 'balance-value';
        if (saldoReal < 0) balanceValueEl.classList.add('negative');
    }
    
    if (balanceProjectedEl) {
        balanceProjectedEl.textContent = formatCurrency(saldoProjetado);
        balanceProjectedEl.className = 'balance-projected';
        if (saldoProjetado < 0) balanceProjectedEl.classList.add('negative');
    }
    
    const trend = document.getElementById('balanceTrend');
    if (trend) {
        const diff = saldoProjetado - saldoReal;
        if (diff > 0) {
            trend.className = 'balance-trend positive';
            trend.innerHTML = `<i class="fas fa-arrow-up"></i><span>+${formatCurrency(diff)} projetado</span>`;
        } else if (diff < 0) {
            trend.className = 'balance-trend negative';
            trend.innerHTML = `<i class="fas fa-arrow-down"></i><span>${formatCurrency(Math.abs(diff))} a pagar</span>`;
        } else {
            trend.className = 'balance-trend';
            trend.innerHTML = `<i class="fas fa-check"></i><span>Sem pendências</span>`;
        }
    }
    
    updateNativeCharts(realizadas);
    renderTransactions(allEntries);
};

// ===========================
// NATIVE CANVAS CHARTS
// ===========================
const initCanvasCharts = () => {
    const flowCanvas = document.getElementById('flowChart');
    const pieCanvas = document.getElementById('pieChart');
    
    if (!flowCanvas || !pieCanvas) {
        console.warn('Canvas não encontrado');
        return;
    }
    
    state.flowChartCanvas = flowCanvas.getContext('2d');
    state.pieChartCanvas = pieCanvas.getContext('2d');
    
    // Set canvas resolution
    const setCanvasSize = (canvas) => {
        const container = canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = container.clientWidth * dpr;
        canvas.height = container.clientHeight * dpr;
        canvas.style.width = container.clientWidth + 'px';
        canvas.style.height = container.clientHeight + 'px';
        canvas.getContext('2d').scale(dpr, dpr);
    };
    
    setCanvasSize(flowCanvas);
    setCanvasSize(pieCanvas);
    
    window.addEventListener('resize', () => {
        setCanvasSize(flowCanvas);
        setCanvasSize(pieCanvas);
        updateDashboard();
    });
    
    console.log('✅ Canvas charts inicializados');
};

const updateNativeCharts = entries => {
    if (!state.flowChartCanvas || !state.pieChartCanvas) {
        console.warn('Canvas não inicializado');
        return;
    }
    
    const grouped = groupByPeriod(entries);
    drawBarChart(grouped);
    drawPieChart(entries);
};

const drawBarChart = grouped => {
    const ctx = state.flowChartCanvas;
    const canvas = ctx.canvas;
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    const labels = Object.keys(grouped).sort();
    if (labels.length === 0) {
        drawEmptyState(ctx, width, height, 'Sem dados no período');
        return;
    }

    const entradasData = labels.map(l => grouped[l].entradas);
    const saidasData = labels.map(l => grouped[l].saidas);
    const maxValue = Math.max(...entradasData, ...saidasData, 100) * 1.1;

    const padding = { top: 50, right: 20, bottom: 45, left: 65 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Draw grid lines
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
    }

    // Draw Y axis labels
    ctx.fillStyle = COLORS.textLight;
    ctx.font = '10px Inter';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) {
        const value = maxValue - (maxValue / 4) * i;
        const y = padding.top + (chartHeight / 4) * i;
        ctx.fillText(formatCompactCurrency(value), padding.left - 10, y + 3);
    }

    // Draw bars with gradients
    const barWidth = Math.min(chartWidth / labels.length / 3, 25);
    const groupWidth = chartWidth / labels.length;
    const barRadius = 4;

    labels.forEach((label, i) => {
        const x = padding.left + groupWidth * i + groupWidth / 2;

        // Entradas (green) with gradient
        const entradaHeight = (entradasData[i] / maxValue) * chartHeight;
        if (entradaHeight > 0) {
            const gradient1 = ctx.createLinearGradient(0, padding.top + chartHeight - entradaHeight, 0, padding.top + chartHeight);
            gradient1.addColorStop(0, COLORS.entradaGradient[0]);
            gradient1.addColorStop(1, COLORS.entradaGradient[1]);
            ctx.fillStyle = gradient1;
            drawRoundedBar(ctx, x - barWidth - 3, padding.top + chartHeight - entradaHeight, barWidth, entradaHeight, barRadius);
        }

        // Saídas (red) with gradient
        const saidaHeight = (saidasData[i] / maxValue) * chartHeight;
        if (saidaHeight > 0) {
            const gradient2 = ctx.createLinearGradient(0, padding.top + chartHeight - saidaHeight, 0, padding.top + chartHeight);
            gradient2.addColorStop(0, COLORS.saidaGradient[0]);
            gradient2.addColorStop(1, COLORS.saidaGradient[1]);
            ctx.fillStyle = gradient2;
            drawRoundedBar(ctx, x + 3, padding.top + chartHeight - saidaHeight, barWidth, saidaHeight, barRadius);
        }

        // X axis label
        ctx.fillStyle = COLORS.textLight;
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, height - padding.bottom + 18);
    });

    // Legend with icons
    const legendY = 18;
    ctx.font = '11px Inter';

    // Entrada legend
    ctx.fillStyle = COLORS.entrada;
    drawRoundedBar(ctx, padding.left, legendY - 10, 12, 12, 3);
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'left';
    ctx.fillText('Entradas', padding.left + 18, legendY);

    // Saída legend
    ctx.fillStyle = COLORS.saida;
    drawRoundedBar(ctx, padding.left + 90, legendY - 10, 12, 12, 3);
    ctx.fillStyle = COLORS.text;
    ctx.fillText('Saídas', padding.left + 108, legendY);
};

// Helper function to draw rounded bars
const drawRoundedBar = (ctx, x, y, width, height, radius) => {
    if (height < radius * 2) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
};

// Helper to format compact currency
const formatCompactCurrency = value => {
    if (value >= 1000) {
        return 'R$ ' + (value / 1000).toFixed(1) + 'k';
    }
    return 'R$ ' + Math.round(value);
};

const drawPieChart = entries => {
    const ctx = state.pieChartCanvas;
    const canvas = ctx.canvas;
    const width = canvas.width / (window.devicePixelRatio || 1);
    const height = canvas.height / (window.devicePixelRatio || 1);

    ctx.clearRect(0, 0, width, height);

    const entradas = entries.filter(e => e.type === 'entrada').reduce((sum, e) => sum + parseFloat(e.value || 0), 0);
    const saidas = entries.filter(e => e.type === 'saida').reduce((sum, e) => sum + parseFloat(e.value || 0), 0);
    const total = entradas + saidas;

    if (total === 0) {
        drawEmptyState(ctx, width, height, 'Sem movimentações');
        return;
    }

    const centerX = width / 2;
    const centerY = height / 2 - 30;
    const radius = Math.min(width, height) / 3.2;
    const innerRadius = radius * 0.65;

    // Draw pie segments with gradients
    let currentAngle = -Math.PI / 2;

    // Entradas segment
    const entradasAngle = (entradas / total) * Math.PI * 2;
    if (entradasAngle > 0) {
        const gradient1 = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, radius);
        gradient1.addColorStop(0, COLORS.entradaGradient[1]);
        gradient1.addColorStop(1, COLORS.entradaGradient[0]);
        ctx.fillStyle = gradient1;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + entradasAngle);
        ctx.closePath();
        ctx.fill();
    }

    // Saídas segment
    currentAngle += entradasAngle;
    const saidasAngle = (saidas / total) * Math.PI * 2;
    if (saidasAngle > 0) {
        const gradient2 = ctx.createRadialGradient(centerX, centerY, innerRadius, centerX, centerY, radius);
        gradient2.addColorStop(0, COLORS.saidaGradient[1]);
        gradient2.addColorStop(1, COLORS.saidaGradient[0]);
        ctx.fillStyle = gradient2;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + saidasAngle);
        ctx.closePath();
        ctx.fill();
    }

    // Center hole (donut) with gradient
    const holeGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, innerRadius);
    holeGradient.addColorStop(0, '#1a1a2e');
    holeGradient.addColorStop(1, '#0d0d1a');
    ctx.fillStyle = holeGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Center text - Total
    ctx.fillStyle = COLORS.textLight;
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    ctx.fillText('TOTAL', centerX, centerY - 8);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 14px Orbitron';
    ctx.fillText(formatCompactCurrency(total), centerX, centerY + 12);

    // Legend with better styling
    const legendY = height - 55;
    const legendSpacing = 22;
    const legendX = width / 2;

    // Entradas legend
    ctx.fillStyle = COLORS.entrada;
    drawRoundedBar(ctx, legendX - 85, legendY - 8, 10, 10, 2);
    ctx.fillStyle = COLORS.text;
    ctx.font = '11px Inter';
    ctx.textAlign = 'left';
    ctx.fillText('Entradas', legendX - 70, legendY);
    ctx.fillStyle = COLORS.entrada;
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round((entradas / total) * 100) + '%', legendX + 85, legendY);

    // Saídas legend
    ctx.fillStyle = COLORS.saida;
    drawRoundedBar(ctx, legendX - 85, legendY + legendSpacing - 8, 10, 10, 2);
    ctx.fillStyle = COLORS.text;
    ctx.font = '11px Inter';
    ctx.textAlign = 'left';
    ctx.fillText('Saídas', legendX - 70, legendY + legendSpacing);
    ctx.fillStyle = COLORS.saida;
    ctx.font = 'bold 11px Inter';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round((saidas / total) * 100) + '%', legendX + 85, legendY + legendSpacing);
};

const drawEmptyState = (ctx, width, height, message) => {
    ctx.fillStyle = COLORS.text;
    ctx.font = '14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(message, width / 2, height / 2);
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
    
    const badges = [];
    if (t.source === 'service') badges.push('<span class="transaction-badge badge-service">Do Painel</span>');
    if (t.scheduled) badges.push('<span class="transaction-badge badge-scheduled">Programada</span>');
    
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
        <div class="transaction-item ${t.type} ${t.scheduled ? 'scheduled' : ''}">
            <div class="transaction-info">
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
    
    const scheduledField = document.getElementById('scheduledField');
    if (scheduledField) scheduledField.style.display = 'block';
    
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
    const scheduled = document.getElementById('scheduled')?.checked || false;
    
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
        scheduled,
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
        showToast('Erro ao salvar transação', 'error');
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
    
    const scheduledCheckbox = document.getElementById('scheduled');
    if (scheduledCheckbox) {
        scheduledCheckbox.checked = transaction.scheduled || false;
    }
    
    const scheduledField = document.getElementById('scheduledField');
    if (scheduledField) scheduledField.style.display = 'block';
    
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
        showToast('Erro ao excluir transação', 'error');
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
    
    document.querySelectorAll('.btn-filter').forEach(btn => {
        btn.classList.remove('active');
    });
    
    event.target.classList.add('active');
    updateDashboard();
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

// ===========================
// CONNECTION MONITORING
// ===========================
const monitorConnection = () => {
    const updateStatus = connected => {
        const statusEl = document.getElementById('connectionStatus');
        const statusText = document.getElementById('statusText');
        if (statusEl && statusText) {
            connected ? statusEl.classList.remove('offline') : statusEl.classList.add('offline');
            statusText.textContent = connected ? 'Conectado' : 'Offline';
        }
    };

    window.addEventListener('online', () => {
        updateStatus(true);
        showToast('Conexão restaurada', 'success');
    });

    window.addEventListener('offline', () => {
        updateStatus(false);
        showToast('Sem conexão', 'error');
    });

    updateStatus(navigator.onLine);
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
