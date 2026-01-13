/*
==================================================
ARQUIVO: financas/finance-ui.js
MÃ“DULO: UI - GrÃ¡ficos ApexCharts, Modais e Event Listeners
SISTEMA: ImaginaTech - GestÃ£o de ImpressÃ£o 3D
VERSÃƒO: 3.0 - RefatoraÃ§Ã£o Modular
IMPORTANTE: NÃƒO REMOVER ESTE CABEÃ‡ALHO DE IDENTIFICAÃ‡ÃƒO
==================================================
*/
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

    // Obter data de corte das configurações
    const cutoffDate = userSettings.cutoffDate || null;

    // Criar data de referência baseada no mês selecionado
    const referenceDate = new Date(displayYear, displayMonth, 1);

    // Get last 12 months from the selected month
    for (let i = 11; i >= 0; i--) {
        const date = new Date(referenceDate);
        date.setMonth(date.getMonth() - i);

        const monthName = date.toLocaleDateString('pt-BR', { month: 'short' });
        months.push(monthName.charAt(0).toUpperCase() + monthName.slice(1));

        const monthTransactions = transactions.filter(t => {
            // Filtrar por data de corte
            if (cutoffDate && t.date < cutoffDate) return false;
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

    // Obter data de corte das configurações
    const cutoffDate = userSettings.cutoffDate || null;

    const monthTransactions = transactions.filter(t => {
        // Filtrar por data de corte
        if (cutoffDate && t.date < cutoffDate) return false;
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

    // Sincronizar dropdowns customizados após reset
    const categorySelect = document.getElementById('category');
    if (categorySelect) categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
    if (transactionCardSelect) transactionCardSelect.dispatchEvent(new Event('change', { bubbles: true }));

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

    // Define o tipo de transação PRIMEIRO (para popular categorias corretas)
    currentTransactionType = transaction.type;
    selectTransactionType(transaction.type);

    // Define o método de pagamento (tanto para entrada quanto para saída)
    currentPaymentMethod = transaction.paymentMethod || 'debit';
    selectPaymentMethod(currentPaymentMethod);

    // Define o cartão se for crédito
    if (transaction.paymentMethod === 'credit' && transaction.cardId) {
        const cardSelect = document.getElementById('transactionCard');
        cardSelect.value = transaction.cardId;
        cardSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Preenche os campos DEPOIS de popular as categorias
    document.getElementById('description').value = transaction.description;
    document.getElementById('value').value = formatCurrencyValue(transaction.value);

    const categorySelect = document.getElementById('category');
    categorySelect.value = transaction.category;
    categorySelect.dispatchEvent(new Event('change', { bubbles: true }));

    document.getElementById('date').value = transaction.date;
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

    // Sincronizar dropdowns customizados após reset
    const subCategorySelect = document.getElementById('subCategory');
    const subStatusSelect = document.getElementById('subStatus');
    if (cardSelect) cardSelect.dispatchEvent(new Event('change', { bubbles: true }));
    if (subCategorySelect) subCategorySelect.dispatchEvent(new Event('change', { bubbles: true }));
    if (subStatusSelect) subStatusSelect.dispatchEvent(new Event('change', { bubbles: true }));
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
    cardSelect.dispatchEvent(new Event('change', { bubbles: true }));

    // Preenche os campos
    document.getElementById('subName').value = subscription.name;
    document.getElementById('subValue').value = formatCurrencyValue(subscription.value);
    document.getElementById('subDueDay').value = subscription.dueDay;

    const subCategorySelect = document.getElementById('subCategory');
    subCategorySelect.value = subscription.category;
    subCategorySelect.dispatchEvent(new Event('change', { bubbles: true }));

    const subStatusSelect = document.getElementById('subStatus');
    subStatusSelect.value = subscription.status;
    subStatusSelect.dispatchEvent(new Event('change', { bubbles: true }));
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

    // Sincronizar dropdown customizado
    if (cardSelect) cardSelect.dispatchEvent(new Event('change', { bubbles: true }));
}

// 🎨 Fecha modal de parcelamento
function closeInstallmentModal() {
    editingInstallmentId = null;
    document.getElementById('installmentModal').classList.remove('active');
    document.getElementById('installmentForm').reset();
    // Reset para valor total como padrão
    selectInstallmentValueType('total');
}

// 🎨 Abre modal de gasto avulso no cartao
function openCardExpenseModal() {
    const modal = document.getElementById('cardExpenseModal');
    if (!modal) return;

    // Reset do formulario
    const form = document.getElementById('cardExpenseForm');
    if (form) form.reset();

    // Popular dropdown de cartoes
    const cardSelect = document.getElementById('expenseCard');
    if (cardSelect && typeof creditCards !== 'undefined') {
        cardSelect.innerHTML = '<option value="">Selecione um cartao</option>' +
            creditCards.map(card =>
                `<option value="${card.id}">${card.name} - ${card.institution}</option>`
            ).join('');
    }

    // Popular dropdown de categorias com icones e ordenacao por frequencia
    const categorySelect = document.getElementById('expenseCategory');
    if (categorySelect && typeof populateCategoryDropdown === 'function') {
        populateCategoryDropdown(categorySelect);

        // Inicializar CustomSelect se ainda nao foi
        setTimeout(() => {
            if (!categorySelect.dataset.customized && window.CustomSelect) {
                new window.CustomSelect(categorySelect);
                categorySelect.dataset.customized = 'true';
            }
        }, 0);
    }

    // Definir data atual como padrao
    const dateInput = document.getElementById('expenseDate');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('active');
}

// 🎨 Fecha modal de gasto avulso no cartao
function closeCardExpenseModal() {
    const modal = document.getElementById('cardExpenseModal');
    if (modal) {
        modal.classList.remove('active');
    }
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

    // Sincronizar CustomSelect após popular opções
    // Usar setTimeout para aguardar MutationObserver processar
    setTimeout(() => {
        cardSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);

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
    const projStatusSelect = document.getElementById('projStatus');
    projStatusSelect.value = 'pending';
    projStatusSelect.dispatchEvent(new Event('change', { bubbles: true }));
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

    const projStatusSelect = document.getElementById('projStatus');
    projStatusSelect.value = projection.status || 'pending';
    projStatusSelect.dispatchEvent(new Event('change', { bubbles: true }));

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
        // Sincronizar CustomSelect após popular opções
        setTimeout(() => {
            transactionCardSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }, 0);
    } else {
        creditCardGroup.style.display = 'none';
        transactionCardSelect.required = false;
        // Clear dropdown when switching away from credit
        transactionCardSelect.innerHTML = '<option value="">Selecione um cartão</option>';
        transactionCardSelect.value = '';
        // Sincronizar CustomSelect
        transactionCardSelect.dispatchEvent(new Event('change', { bubbles: true }));
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

// 📝 Mantém a data atual ao selecionar cartão (transações geralmente ocorrem no dia atual)
function updateDefaultDateForCard(cardId) {
    // Sempre manter a data atual quando o cartão for selecionado
    // A maioria das transações acontece no dia de hoje
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;

    console.log(`📅 [updateDefaultDateForCard] Data mantida como hoje: ${today}`);
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
        // Se for o modal de seleção de conta, restaurar o dashboard ao fechar
        if (e.target.id === 'accountSelectionModal') {
            e.target.classList.remove('active');
            document.getElementById('dashboard').classList.remove('hidden');
        } else {
            e.target.classList.remove('active');
        }
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

    // Obter data de corte das configurações
    const cutoffDate = userSettings.cutoffDate || null;

    for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthTransactions = transactions.filter(t => {
            // Filtrar por data de corte
            if (cutoffDate && t.date < cutoffDate) return false;
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

    // Obter data de corte das configurações
    const cutoffDate = userSettings.cutoffDate || null;

    for (let i = 6; i >= 0; i--) {
        const date = new Date(currentDate);
        date.setDate(date.getDate() - i);
        const dayExpenses = transactions.filter(t => {
            // Filtrar por data de corte
            if (cutoffDate && t.date < cutoffDate) return false;
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

    // Obter data de corte das configurações
    const cutoffDate = userSettings.cutoffDate || null;

    // Pegar o último dia do mês selecionado
    const lastDayOfMonth = new Date(displayYear, displayMonth + 1, 0);
    const referenceDate = lastDayOfMonth;

    for (let i = 6; i >= 0; i--) {
        const date = new Date(referenceDate);
        date.setDate(date.getDate() - i);
        const dayExpenses = transactions.filter(t => {
            // Filtrar por data de corte
            if (cutoffDate && t.date < cutoffDate) return false;
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

        // Posicionar dropdown com position fixed
        const triggerRect = this.trigger.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - triggerRect.bottom;
        const spaceAbove = triggerRect.top;

        // Calcular se abre para cima ou para baixo
        const dropdownHeight = 300;
        const openUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

        // Aplicar estilos base ANTES de mover para o body (invisível)
        this.dropdown.style.position = 'fixed';
        this.dropdown.style.width = `${triggerRect.width}px`;
        this.dropdown.style.left = `${triggerRect.left}px`;
        this.dropdown.style.zIndex = '999999';
        this.dropdown.style.pointerEvents = 'auto';
        this.dropdown.style.background = 'linear-gradient(180deg, rgba(26, 26, 46, 0.98) 0%, rgba(16, 24, 39, 0.98) 100%)';
        this.dropdown.style.backdropFilter = 'blur(15px)';
        this.dropdown.style.border = '1px solid rgba(0, 212, 255, 0.3)';
        this.dropdown.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 212, 255, 0.2)';
        this.dropdown.style.overflow = 'auto';

        // Estado inicial da animação (invisível e comprimido)
        this.dropdown.style.opacity = '0';
        this.dropdown.style.transformOrigin = openUp ? 'bottom center' : 'top center';
        this.dropdown.style.transform = openUp ? 'scaleY(0.8) translateY(10px)' : 'scaleY(0.8) translateY(-10px)';
        this.dropdown.style.transition = 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';

        // Posição vertical
        if (openUp) {
            this.dropdown.style.bottom = `${viewportHeight - triggerRect.top}px`;
            this.dropdown.style.top = 'auto';
            this.dropdown.style.maxHeight = `${Math.min(300, spaceAbove - 10)}px`;
            this.dropdown.style.borderRadius = '12px 12px 0 0';
            this.customSelect.classList.add('open-up');
        } else {
            this.dropdown.style.top = `${triggerRect.bottom}px`;
            this.dropdown.style.bottom = 'auto';
            this.dropdown.style.maxHeight = `${Math.min(300, spaceBelow - 10)}px`;
            this.dropdown.style.borderRadius = '0 0 12px 12px';
            this.customSelect.classList.remove('open-up');
        }

        // Mover para o body
        document.body.appendChild(this.dropdown);

        // Animar entrada (próximo frame)
        requestAnimationFrame(() => {
            this.dropdown.style.opacity = '1';
            this.dropdown.style.transform = 'scaleY(1) translateY(0)';
        });

        // Scroll para opção selecionada
        const selectedOption = this.dropdown.querySelector('.selected');
        if (selectedOption) {
            setTimeout(() => {
                selectedOption.scrollIntoView({ block: 'nearest' });
            }, 100);
        }
    }

    close() {
        if (!this.isOpen) return;

        this.isOpen = false;
        this.customSelect.classList.remove('open');
        this.trigger.setAttribute('aria-expanded', 'false');

        const openUp = this.customSelect.classList.contains('open-up');

        // Animar saída
        this.dropdown.style.opacity = '0';
        this.dropdown.style.transform = openUp ? 'scaleY(0.8) translateY(10px)' : 'scaleY(0.8) translateY(-10px)';

        // Após animação, mover de volta e limpar estilos
        setTimeout(() => {
            this.customSelect.classList.remove('open-up');
            this.customSelect.appendChild(this.dropdown);
            this.dropdown.style.cssText = '';
        }, 200);
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

// ===========================
// FUNÇÃO ADMINISTRATIVA - LIMPAR DADOS
// ===========================
/**
 * 🧹 Função administrativa para limpar todos os dados da conta da empresa
 * ATENÇÃO: Esta função DELETARÁ permanentemente todos os dados!
 * Para executar, abra o console do navegador e digite: cleanCompanyData()
 */
async function cleanCompanyData() {
    try {
        // 1. Buscar UID da empresa
        console.log('🔍 Buscando UID da conta da empresa...');
        const configDoc = await db.collection('systemConfig').doc('companyAccount').get();

        if (!configDoc.exists) {
            console.error('❌ Configuração da empresa não encontrada!');
            return;
        }

        const companyUserId = configDoc.data().userId;
        console.log('✅ UID da empresa encontrado:', companyUserId);

        // 2. Confirmar ação
        const confirmation = confirm(
            '⚠️ ATENÇÃO: Esta ação irá DELETAR PERMANENTEMENTE todos os dados da conta da empresa!\n\n' +
            'Serão deletados:\n' +
            '• Serviços\n' +
            '• Transações\n' +
            '• Assinaturas\n' +
            '• Parcelamentos\n' +
            '• Projeções\n' +
            '• Cartões de crédito\n' +
            '• Despesas de cartão\n' +
            '• Pagamentos de cartão\n' +
            '• Investimentos\n\n' +
            'Deseja continuar?'
        );

        if (!confirmation) {
            console.log('❌ Operação cancelada pelo usuário');
            return;
        }

        // 3. Segundo nível de confirmação
        const finalConfirmation = prompt(
            'Digite "DELETAR TUDO" para confirmar a exclusão permanente de todos os dados da empresa:'
        );

        if (finalConfirmation !== 'DELETAR TUDO') {
            console.log('❌ Confirmação inválida. Operação cancelada.');
            return;
        }

        console.log('🧹 Iniciando limpeza dos dados...');
        showLoading('Limpando dados da empresa...');

        // 4. Deletar dados de cada coleção
        const collections = [
            'services',
            'transactions',
            'subscriptions',
            'installments',
            'projections',
            'creditCards',
            'cardExpenses',
            'creditCardPayments',
            'investments'
        ];

        let totalDeleted = 0;

        for (const collectionName of collections) {
            console.log(`🗑️ Deletando ${collectionName}...`);

            const snapshot = await db.collection(collectionName)
                .where('userId', '==', companyUserId)
                .get();

            const batch = db.batch();
            let count = 0;

            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
                count++;
            });

            if (count > 0) {
                await batch.commit();
                console.log(`✅ ${count} documento(s) deletado(s) de ${collectionName}`);
                totalDeleted += count;
            } else {
                console.log(`ℹ️ Nenhum documento encontrado em ${collectionName}`);
            }
        }

        hideLoading();

        console.log(`✅ Limpeza concluída! Total de ${totalDeleted} documento(s) deletado(s).`);
        showToast(`✅ Limpeza concluída! ${totalDeleted} registros removidos.`, 'success');

        // 5. Recarregar dashboard
        setTimeout(() => {
            console.log('🔄 Recarregando dashboard...');
            location.reload();
        }, 2000);

    } catch (error) {
        hideLoading();
        console.error('❌ Erro ao limpar dados:', error);
        showToast('Erro ao limpar dados: ' + error.message, 'error');
    }
}

// Exportar função para console
window.cleanCompanyData = cleanCompanyData;
console.log('✅ Função administrativa carregada: cleanCompanyData()');
console.log('📝 Para limpar os dados da empresa, digite no console: cleanCompanyData()');

console.log('âœ… Finance UI v3.0 - Loaded');
// ===========================
// PRIVACY TOGGLE (Investimentos)
// ===========================
/**
 * Alterna a visibilidade do valor de investimentos
 * Útil para abrir o painel em público sem expor valores sensíveis
 */
function toggleInvestmentVisibility(event) {
    // Prevenir que o clique abra o modal
    event.stopPropagation();

    const valueElement = document.getElementById('totalInvestments');
    const buttonElement = document.getElementById('btnToggleInvestments');
    const iconElement = buttonElement.querySelector('i');

    // Toggle classe blurred
    valueElement.classList.toggle('blurred');
    buttonElement.classList.toggle('revealed');

    // Trocar ícone
    if (valueElement.classList.contains('blurred')) {
        // Valor está escondido - mostrar ícone de olho cortado
        iconElement.className = 'fas fa-eye-slash';
        buttonElement.title = 'Revelar valor';
    } else {
        // Valor está visível - mostrar ícone de olho aberto
        iconElement.className = 'fas fa-eye';
        buttonElement.title = 'Ocultar valor';
    }

    // Salvar preferência no localStorage
    localStorage.setItem('investmentsHidden', valueElement.classList.contains('blurred'));
}

// Carregar estado salvo ao inicializar
window.addEventListener('DOMContentLoaded', () => {
    const isHidden = localStorage.getItem('investmentsHidden') === 'true';

    if (!isHidden) {
        // Se não está escondido, remover blur inicial e ajustar ícone
        const valueElement = document.getElementById('totalInvestments');
        const buttonElement = document.getElementById('btnToggleInvestments');
        const iconElement = buttonElement?.querySelector('i');

        if (valueElement && buttonElement && iconElement) {
            valueElement.classList.remove('blurred');
            buttonElement.classList.add('revealed');
            iconElement.className = 'fas fa-eye';
            buttonElement.title = 'Ocultar valor';
        }
    }
});

console.log('✅ Privacy Toggle - Loaded');
