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
    if (typeof logger !== 'undefined') logger.log('Destruindo graficos existentes...');

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
    // Liquid Fill Gauges - limpar SVG ao inves de .destroy()
    if (savingsGoalChart) {
        const savingsEl = document.querySelector("#savingsGoalChart");
        if (savingsEl) savingsEl.innerHTML = '';
        savingsGoalChart = null;
    }
    if (expenseLimitChart) {
        const expenseEl = document.querySelector("#expenseLimitChart");
        if (expenseEl) expenseEl.innerHTML = '';
        expenseLimitChart = null;
    }
}

// 🔄 Inicializa todos os gráficos do dashboard
function initializeCharts() {
    try {
        // Destruir gráficos existentes antes de criar novos
        destroyAllCharts();

        // Verificar se ApexCharts esta disponivel (CDN pode falhar)
        if (typeof ApexCharts === 'undefined') {
            if (typeof logger !== 'undefined') logger.error('ApexCharts nao carregado - CDN indisponivel. Graficos ApexCharts desabilitados.');
        } else {
            initializeCashFlowChart();
            initializeCategoryChart();
            initializePaymentMethodChart();
            initializeComparisonChart();
            initializeGrowthSparkline();
            initializeExpenseTrendSparkline();
            initializeTopCategoriesChart();
            initializeWeeklyTrendChart();
        }

        // Verificar se D3 esta disponivel para Liquid Fill Gauges
        if (typeof d3 === 'undefined') {
            if (typeof logger !== 'undefined') logger.error('D3.js nao carregado - CDN indisponivel. Liquid Fill Gauges desabilitados.');
        } else {
            initializeSavingsGoalChart();
            initializeExpenseLimitChart();
        }

        if (typeof logger !== 'undefined') logger.log('Graficos inicializados');
    } catch (error) {
        if (typeof logger !== 'undefined') logger.error('Erro ao inicializar graficos:', error);
    }
}

// 🔄 Atualiza dados de todos os gráficos existentes
function updateCharts() {
    try {
        if (typeof ApexCharts === 'undefined') return;
        if (typeof logger !== 'undefined') logger.log('[updateCharts] Atualizando todos os graficos...');
        updateCashFlowChart();
        updateCategoryChart();
        updatePaymentMethodChart();
        updateComparisonChart();
        updateTopCategoriesChart();
        updateWeeklyTrendChart();
        if (typeof logger !== 'undefined') logger.log('[updateCharts] Graficos atualizados!');
    } catch (error) {
        if (typeof logger !== 'undefined') logger.error('Erro ao atualizar graficos:', error);
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
            const transactionDate = new Date(t.date + 'T12:00:00');
            return transactionDate.getMonth() === date.getMonth() &&
                   transactionDate.getFullYear() === date.getFullYear();
        });

        const monthIncome = monthTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.value, 0);

        const monthExpense = monthTransactions
            .filter(t => t.type === 'expense' && t.paymentMethod !== 'credit')
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

    // Obter data de corte das configurações (consistente com getCashFlowData)
    const cutoffDate = userSettings.cutoffDate || null;

    transactions.forEach(t => {
        // Filtrar por data de corte
        if (cutoffDate && t.date < cutoffDate) return;

        if (t.type === 'expense') {
            const transactionDate = new Date(t.date + 'T12:00:00');
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

    // Se nao ha dados, mostra mensagem
    if (!data.hasData || data.values.length === 0) {
        chartEl.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #94a3b8;">Sem dados para exibir</div>';
        return;
    }

    const options = {
        series: data.values,
        chart: {
            type: 'donut',
            height: '100%',
            background: 'transparent',
            fontFamily: 'Inter, sans-serif'
        },
        labels: data.labels,
        colors: data.colors,
        plotOptions: {
            pie: {
                donut: {
                    size: '65%',
                    labels: {
                        show: true,
                        name: {
                            show: true,
                            fontSize: '11px',
                            fontWeight: 500,
                            color: '#94a3b8',
                            offsetY: -5
                        },
                        value: {
                            show: true,
                            fontSize: '16px',
                            fontWeight: 700,
                            color: '#fff',
                            offsetY: 5,
                            formatter: function(val) {
                                return formatCurrencyCompact(parseFloat(val));
                            }
                        },
                        total: {
                            show: true,
                            label: 'Total',
                            fontSize: '11px',
                            fontWeight: 500,
                            color: '#94a3b8',
                            formatter: function(w) {
                                const total = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                return formatCurrencyCompact(total);
                            }
                        }
                    }
                }
            }
        },
        stroke: {
            width: 2,
            colors: ['#0f172a']
        },
        fill: {
            opacity: 0.9
        },
        legend: {
            show: true,
            position: 'bottom',
            fontSize: '10px',
            fontWeight: 500,
            labels: {
                colors: '#94a3b8'
            },
            markers: {
                width: 8,
                height: 8,
                radius: 2
            },
            itemMargin: {
                horizontal: 8,
                vertical: 4
            },
            formatter: function(seriesName, opts) {
                const pct = data.percentages[opts.seriesIndex];
                return seriesName + ' (' + pct + '%)';
            }
        },
        dataLabels: {
            enabled: false
        },
        tooltip: {
            y: {
                formatter: function(value, { seriesIndex }) {
                    const pct = data.percentages[seriesIndex];
                    return formatCurrencyDisplay(value) + ' (' + pct + '%)';
                }
            }
        },
        responsive: [{
            breakpoint: 1400,
            options: {
                legend: {
                    fontSize: '9px'
                },
                plotOptions: {
                    pie: {
                        donut: {
                            labels: {
                                value: { fontSize: '14px' }
                            }
                        }
                    }
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

// ========================================
// ANALISE DE PAGAMENTOS
// Mostra como as despesas foram pagas: Credito, Debito, Pix/Dinheiro
// SEM contagem dupla - credito vem apenas de calculateCurrentBill
// ========================================
function getPaymentMethodData() {
    const displayMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
    const displayYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();

    let creditTotal = 0;
    let debitTotal = 0;
    let pixTotal = 0;

    // 1. CREDITO: Soma apenas via faturas dos cartoes (evita contagem dupla)
    // calculateCurrentBill ja inclui transacoes de credito + parcelas + assinaturas
    if (typeof creditCards !== 'undefined' && creditCards.length > 0) {
        creditCards.forEach(card => {
            if (typeof calculateCurrentBill === 'function') {
                const billValue = calculateCurrentBill(card, displayMonth, displayYear);
                creditTotal += billValue;
            }
        });
    }

    // 2. DEBITO e PIX/DINHEIRO: Transacoes do mes (exclui credito que ja foi contado)
    transactions.forEach(t => {
        if (t.type === 'expense') {
            const transactionDate = new Date(t.date + 'T12:00:00');
            if (transactionDate.getMonth() === displayMonth &&
                transactionDate.getFullYear() === displayYear) {

                // Ignorar transacoes de credito (ja contadas na fatura)
                if (t.paymentMethod === 'credit') {
                    return; // Skip - ja incluido em calculateCurrentBill
                }

                if (t.paymentMethod === 'debit') {
                    debitTotal += t.value;
                } else {
                    // Pix, dinheiro, ou sem metodo definido
                    pixTotal += t.value;
                }
            }
        }
    });

    // Preparar dados com 3 categorias separadas
    const allData = [
        { label: 'Cartao de Credito', value: Math.round(creditTotal * 100) / 100, color: '#3b82f6' },
        { label: 'Cartao de Debito', value: Math.round(debitTotal * 100) / 100, color: '#22c55e' },
        { label: 'Pix / Dinheiro', value: Math.round(pixTotal * 100) / 100, color: '#a855f7' }
    ];

    // Filtrar apenas valores positivos
    const filteredData = allData.filter(d => d.value > 0);

    // Calcular total para percentuais
    const total = filteredData.reduce((sum, d) => sum + d.value, 0);

    return {
        labels: filteredData.map(d => d.label),
        values: filteredData.map(d => d.value),
        colors: filteredData.map(d => d.color),
        percentages: filteredData.map(d => total > 0 ? ((d.value / total) * 100).toFixed(1) : 0),
        total: total,
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

    // Estilo clean e minimalista
    const options = {
        series: [
            {
                name: 'Entradas',
                data: [data.previous.income, data.current.income]
            },
            {
                name: 'Gastos',
                data: [data.previous.expense, data.current.expense]
            }
        ],
        chart: {
            type: 'bar',
            height: '100%',
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false },
            background: 'transparent'
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '45%',
                borderRadius: 4,
                borderRadiusApplication: 'end'
            }
        },
        colors: ['#22c55e', '#ef4444'],
        fill: {
            opacity: 0.85
        },
        dataLabels: { enabled: false },
        stroke: {
            show: true,
            width: 2,
            colors: ['transparent']
        },
        xaxis: {
            categories: data.labels,
            labels: {
                style: {
                    colors: '#94a3b8',
                    fontSize: '11px',
                    fontWeight: 500
                }
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#64748b',
                    fontSize: '10px'
                },
                formatter: function(val) {
                    return formatCurrencyCompact(val);
                }
            }
        },
        grid: {
            borderColor: 'rgba(255,255,255,0.04)',
            strokeDashArray: 3,
            xaxis: { lines: { show: false } }
        },
        legend: {
            show: true,
            position: 'top',
            horizontalAlign: 'right',
            fontSize: '10px',
            labels: { colors: '#94a3b8' },
            markers: { width: 8, height: 8, radius: 2 },
            itemMargin: { horizontal: 10 }
        },
        tooltip: {
            y: {
                formatter: function(value) {
                    return formatCurrencyDisplay(value);
                }
            },
            theme: 'dark'
        }
    };

    comparisonChart = new ApexCharts(chartEl, options);
    comparisonChart.render();

    updateComparisonIndicators(data);
}

// Atualiza indicadores de variação (setas de aumento/diminuição)
function updateComparisonIndicators(data) {
    const headerEl = document.querySelector('#comparisonChart')?.closest('.chart-card')?.querySelector('.chart-header');
    if (!headerEl) return;

    // Remover indicador anterior se existir
    const oldIndicator = headerEl.querySelector('.comparison-indicator');
    if (oldIndicator) oldIndicator.remove();

    // Criar indicador de variação dos gastos
    const expenseChange = data.expenseChange;
    let indicatorHtml = '';

    if (Math.abs(expenseChange) >= 1) {
        const isUp = expenseChange > 0;
        const color = isUp ? '#ef4444' : '#10b981'; // Vermelho se gastou mais, verde se menos
        const icon = isUp ? 'fa-arrow-up' : 'fa-arrow-down';
        const text = isUp ? 'mais' : 'menos';

        indicatorHtml = `
            <span class="comparison-indicator" style="
                font-size: 0.7rem;
                color: ${color};
                display: flex;
                align-items: center;
                gap: 4px;
                margin-left: 8px;
            ">
                <i class="fas ${icon}" style="font-size: 0.6rem;"></i>
                ${Math.abs(expenseChange).toFixed(0)}% ${text}
            </span>
        `;
    }

    // Adicionar ao header
    const h3 = headerEl.querySelector('h3');
    if (h3 && indicatorHtml) {
        h3.insertAdjacentHTML('afterend', indicatorHtml);
    }
}

// Atualiza gráfico de comparação mês atual vs anterior
function updateComparisonChart() {
    if (!comparisonChart) return;

    const data = getComparisonData();

    comparisonChart.updateOptions({
        xaxis: { categories: data.labels }
    });

    comparisonChart.updateSeries([
        { name: 'Entradas', data: [data.previous.income, data.current.income] },
        { name: 'Gastos', data: [data.previous.expense, data.current.expense] }
    ]);

    updateComparisonIndicators(data);
}

// ========================================
// COMPARATIVO: MES ATUAL VS MES ANTERIOR
// Mostra se você está gastando mais ou menos
// Gastos Reais = Débito + Crédito - Reservas
// ========================================
function getComparisonData() {
    const month = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
    const year = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();

    // Calcular mês anterior
    let prevMonth = month - 1;
    let prevYear = year;
    if (prevMonth < 0) {
        prevMonth = 11;
        prevYear = year - 1;
    }

    // Categorias de reserva (não são gastos reais)
    const savingsCategories = window.SAVINGS_CATEGORIES || [
        'Investimentos', 'Poupança', 'Poupanca',
        'Reserva de Emergência', 'Reserva de Emergencia',
        'Previdência', 'Previdencia'
    ];

    const normalizeStr = (str) => {
        return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
    };

    const isSavingsCategory = (category) => {
        if (!category) return false;
        const normalized = normalizeStr(category);
        return savingsCategories.some(sc => normalizeStr(sc) === normalized);
    };

    // Função para calcular totais de um mês específico
    const getMonthTotals = (m, y) => {
        // Entradas (income)
        const income = transactions
            .filter(t => {
                const d = new Date(t.date + 'T12:00:00');
                return t.type === 'income' &&
                       d.getMonth() === m &&
                       d.getFullYear() === y;
            })
            .reduce((sum, t) => sum + t.value, 0);

        // Saídas em débito (excluindo reservas)
        const expenseDebit = transactions
            .filter(t => {
                const d = new Date(t.date + 'T12:00:00');
                return t.type === 'expense' &&
                       t.paymentMethod !== 'credit' &&
                       !isSavingsCategory(t.category) &&
                       d.getMonth() === m &&
                       d.getFullYear() === y;
            })
            .reduce((sum, t) => sum + t.value, 0);

        // Saídas em cartão de crédito (excluindo reservas)
        const expenseCredit = creditCards.reduce((sum, card) => {
            if (!card.transactions) return sum;
            return sum + card.transactions
                .filter(t => {
                    const d = new Date(t.date + 'T12:00:00');
                    return !isSavingsCategory(t.category) &&
                           d.getMonth() === m &&
                           d.getFullYear() === y;
                })
                .reduce((s, t) => s + t.value, 0);
        }, 0);

        return {
            income,
            expense: expenseDebit + expenseCredit
        };
    };

    const current = getMonthTotals(month, year);
    const previous = getMonthTotals(prevMonth, prevYear);

    // Calcular variação percentual
    const incomeChange = previous.income > 0
        ? ((current.income - previous.income) / previous.income) * 100
        : (current.income > 0 ? 100 : 0);

    const expenseChange = previous.expense > 0
        ? ((current.expense - previous.expense) / previous.expense) * 100
        : (current.expense > 0 ? 100 : 0);

    // Nomes dos meses
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    return {
        labels: [monthNames[prevMonth], monthNames[month]],
        current: current,
        previous: previous,
        incomeChange: incomeChange,
        expenseChange: expenseChange,
        currentMonthName: monthNames[month],
        prevMonthName: monthNames[prevMonth]
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

// 🎨 Edita transação de crédito (a partir do modal de detalhes da fatura)
function editCreditTransaction(id) {
    // Fecha o modal de detalhes da fatura
    document.getElementById('cardBillDetailsModal').classList.remove('active');

    // Abre o modal de edição usando a função existente
    editTransaction(id);
}

// 🎨 Exclui transação de crédito (a partir do modal de detalhes da fatura)
async function deleteCreditTransaction(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    if (!confirm(`Excluir "${transaction.description}"?`)) return;

    showLoading('Excluindo transação...');

    try {
        await db.collection('transactions').doc(id).delete();
        showToast('Transação excluída com sucesso', 'success');

        // Recarrega dados e atualiza displays
        await loadTransactions();
        updateAllDisplays();

        // Se o modal de detalhes da fatura ainda estiver aberto, atualiza ele
        const billModal = document.getElementById('cardBillDetailsModal');
        if (billModal.classList.contains('active') && transaction.cardId) {
            // Reexibe os detalhes da fatura com dados atualizados
            showCardBillDetails(transaction.cardId);
        }
    } catch (error) {
        logger.error('Erro ao excluir transação:', error);
        showToast('Erro ao excluir transação', 'error');
    } finally {
        hideLoading();
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
// Exportada para window para acesso em finance-data.js
let installmentValueType = 'total';
window.installmentValueType = installmentValueType;

// 📝 Alterna entre entrada de valor total ou valor por parcela
function selectInstallmentValueType(type) {
    installmentValueType = type;
    window.installmentValueType = type; // Sincroniza com window para finance-data.js

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
    logger.log('📋 [populateTransactionCardOptions] Cartões disponíveis:', creditCards.map(c => ({ id: c.id, name: c.name })));

    if (!creditCards || creditCards.length === 0) {
        logger.warn('⚠️ Nenhum cartão disponível para seleção');
        return;
    }

    creditCards.forEach(card => {
        if (!card.id || !card.name) {
            logger.error('❌ Cartão inválido:', card);
            return;
        }
        const option = document.createElement('option');
        option.value = card.id;
        option.textContent = `${card.name}${card.institution ? ' - ' + card.institution : ''}`;
        select.appendChild(option);
    });

    logger.log('✅ Dropdown preenchido com', select.options.length - 1, 'cartões');
}

// 📝 Mantém a data atual ao selecionar cartão (transações geralmente ocorrem no dia atual)
function updateDefaultDateForCard(cardId) {
    // Sempre manter a data atual quando o cartão for selecionado
    // A maioria das transações acontece no dia de hoje
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;

    logger.log(`📅 [updateDefaultDateForCard] Data mantida como hoje: ${today}`);
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
// CORRIGIDO: Verificação de segurança para evitar erros em elementos nulos
document.addEventListener('click', (e) => {
    if (e.target?.classList?.contains('modal-overlay')) {
        // Se for o modal de seleção de conta, restaurar o dashboard ao fechar
        if (e.target.id === 'accountSelectionModal') {
            e.target.classList.remove('active');
            const dashboard = document.getElementById('dashboard');
            if (dashboard) dashboard.classList.remove('hidden');
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
    if (typeof logger !== 'undefined') {
        logger.log('DOM carregado, configurando event listeners...');
    }

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

    // ===========================
    // GLOBAL EVENT DELEGATION - SECURITY HARDENED
    // Handles all data-action attributes instead of inline onclick
    // ===========================
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;

        const action = el.dataset.action;
        const id = el.dataset.id;
        const value = el.dataset.value;
        const modal = el.dataset.modal;
        const status = el.dataset.status;
        const account = el.dataset.account;
        const direction = el.dataset.direction;
        const type = el.dataset.type;

        // Map of actions to handlers
        const actionHandlers = {
            // Auth & Account
            'sign-in-google': () => typeof signInWithGoogle === 'function' && signInWithGoogle(),
            'select-account': () => typeof selectAccount === 'function' && selectAccount(account),
            'close-access-denied': () => typeof closeAccessDeniedModal === 'function' && closeAccessDeniedModal(),
            'switch-account': () => typeof switchAccount === 'function' && switchAccount(),
            'sign-out': () => typeof signOut === 'function' && signOut(),

            // Navigation
            'change-month': () => typeof changeMonth === 'function' && changeMonth(parseInt(direction)),
            'toggle-mobile-menu': () => typeof toggleMobileMenu === 'function' && toggleMobileMenu(),

            // KPI Lists
            'open-kpi-list': () => typeof openKPIList === 'function' && openKPIList(type),

            // Modal Open Actions
            'open-transaction-modal': () => typeof openTransactionModal === 'function' && openTransactionModal(),
            'open-subscription-modal': () => typeof openSubscriptionModal === 'function' && openSubscriptionModal(),
            'open-installment-modal': () => typeof openInstallmentModal === 'function' && openInstallmentModal(),
            'open-projection-modal': () => typeof openProjectionModal === 'function' && openProjectionModal(),
            'open-settings': () => typeof openSettingsModal === 'function' && openSettingsModal(),
            'open-investments-modal': () => typeof openInvestmentsModal === 'function' && openInvestmentsModal(),

            // Modal Close Actions
            'close-transaction-modal': () => typeof closeTransactionModal === 'function' && closeTransactionModal(),
            'close-subscription-modal': () => typeof closeSubscriptionModal === 'function' && closeSubscriptionModal(),
            'close-installment-modal': () => typeof closeInstallmentModal === 'function' && closeInstallmentModal(),
            'close-projection-modal': () => typeof closeProjectionModal === 'function' && closeProjectionModal(),
            'close-credit-card-modal': () => typeof closeCreditCardModal === 'function' && closeCreditCardModal(),
            'close-card-expense-modal': () => typeof closeCardExpenseModal === 'function' && closeCardExpenseModal(),
            'close-settings-modal': () => typeof closeSettingsModal === 'function' && closeSettingsModal(),
            'close-investments-modal': () => typeof closeInvestmentsModal === 'function' && closeInvestmentsModal(),
            'close-list-modal': () => typeof closeListModal === 'function' && closeListModal(modal),
            'close-modal': () => typeof closeModal === 'function' && closeModal(modal),

            // Transaction Type Selectors
            'select-transaction-type': () => typeof selectTransactionType === 'function' && selectTransactionType(value),
            'select-payment-method': () => typeof selectPaymentMethod === 'function' && selectPaymentMethod(value),
            'select-installment-value-type': () => typeof selectInstallmentValueType === 'function' && selectInstallmentValueType(value),
            'select-projection-type': () => typeof selectProjectionType === 'function' && selectProjectionType(value),

            // CRUD Operations (from list modals)
            'edit-transaction': () => typeof editTransactionAndRefresh === 'function' && editTransactionAndRefresh(id),
            'delete-transaction': () => typeof deleteTransactionAndRefresh === 'function' && deleteTransactionAndRefresh(id),
            'edit-subscription': () => typeof editSubscriptionAndRefresh === 'function' && editSubscriptionAndRefresh(id),
            'delete-subscription': () => typeof deleteSubscriptionAndRefresh === 'function' && deleteSubscriptionAndRefresh(id),
            'edit-installment': () => typeof editInstallmentAndRefresh === 'function' && editInstallmentAndRefresh(id),
            'delete-installment': () => typeof deleteInstallmentAndRefresh === 'function' && deleteInstallmentAndRefresh(id),
            'edit-projection': () => typeof editProjectionAndRefresh === 'function' && editProjectionAndRefresh(id),
            'delete-projection': () => typeof deleteProjectionAndRefresh === 'function' && deleteProjectionAndRefresh(id),
            'toggle-projection-status': () => typeof toggleProjectionStatus === 'function' && toggleProjectionStatus(id, status),
            'delete-credit-card': () => typeof deleteCreditCardAndRefresh === 'function' && deleteCreditCardAndRefresh(id),
            'show-card-bill-details': () => {
                if (typeof closeListModal === 'function') closeListModal('creditCardsListModal');
                if (typeof showCardBillDetails === 'function') showCardBillDetails(id);
            },
            'add-credit-card-from-list': () => {
                if (typeof closeListModal === 'function') closeListModal('creditCardsListModal');
                if (typeof openCreditCardModal === 'function') openCreditCardModal();
            },

            // Investment visibility toggle
            'toggle-investment-visibility': () => typeof toggleInvestmentVisibility === 'function' && toggleInvestmentVisibility(),

            // Investment CRUD
            'edit-investment': () => typeof editInvestment === 'function' && editInvestment(id),
            'delete-investment': () => typeof deleteInvestment === 'function' && deleteInvestment(id),

            // Credit Card Bill Actions
            'mark-bill-paid': () => {
                const cardId = el.dataset.cardId;
                const month = parseInt(el.dataset.month);
                const year = parseInt(el.dataset.year);
                const total = parseFloat(el.dataset.total);
                if (typeof markBillAsPaid === 'function') markBillAsPaid(cardId, month, year, total);
            },
            'unmark-bill-paid': () => typeof unmarkBillAsPaid === 'function' && unmarkBillAsPaid(id),

            // Credit Transaction CRUD
            'edit-credit-transaction': () => typeof editCreditTransaction === 'function' && editCreditTransaction(id),
            'delete-credit-transaction': () => typeof deleteCreditTransaction === 'function' && deleteCreditTransaction(id),

            // WhatsApp link/unlink
            'link-whatsapp': () => typeof linkMyWhatsApp === 'function' && linkMyWhatsApp(),
            'unlink-whatsapp': () => typeof unlinkMyWhatsApp === 'function' && unlinkMyWhatsApp()
        };

        // Execute the action if handler exists
        if (actionHandlers[action]) {
            e.preventDefault();
            actionHandlers[action]();
        }
    });

    // ===========================
    // INPUT EVENT DELEGATION - Currency formatting
    // Handles data-format="currency" and data-calculate="installment"
    // ===========================
    document.addEventListener('keyup', (e) => {
        const el = e.target;

        // Currency formatting
        if (el.dataset.format === 'currency') {
            formatCurrency(el);
        }

        // Installment calculation
        if (el.dataset.calculate === 'installment') {
            if (typeof calculateInstallmentValues === 'function') {
                calculateInstallmentValues();
            }
        }
    });

    document.addEventListener('change', (e) => {
        const el = e.target;

        // Installment calculation on change (for number inputs)
        if (el.dataset.calculate === 'installment') {
            if (typeof calculateInstallmentValues === 'function') {
                calculateInstallmentValues();
            }
        }
    });
});

// ===========================
// HELPER FUNCTIONS FOR CHARTS
// ===========================
// 🔄 Calcula total de entradas ou saídas do mês atual
/**
 * Retorna o total de transacoes do mes EXIBIDO (nao o mes atual)
 * @param {string} type - 'income' ou 'expense'
 * @param {object} options - Opcoes adicionais
 * @param {boolean} options.excludeSavings - Se true, exclui categorias de reserva
 * @returns {number} - Total do mes
 */
function getDisplayedMonthTotal(type, options = {}) {
    const month = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
    const year = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();

    // Categorias de reserva (nao sao "gastos" reais)
    const savingsCategories = window.SAVINGS_CATEGORIES || [
        'Investimentos', 'Poupança', 'Poupanca',
        'Reserva de Emergência', 'Reserva de Emergencia',
        'Previdência', 'Previdencia'
    ];

    const normalizeStr = (str) => {
        return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
    };

    const isSavingsCategory = (category) => {
        if (!category) return false;
        const normalized = normalizeStr(category);
        return savingsCategories.some(sc => normalizeStr(sc) === normalized);
    };

    return transactions
        .filter(t => {
            const tDate = new Date(t.date + 'T12:00:00');
            const matchesType = t.type === type;
            const matchesMonth = tDate.getMonth() === month && tDate.getFullYear() === year;

            // Se excludeSavings, ignora categorias de reserva
            if (options.excludeSavings && isSavingsCategory(t.category)) {
                return false;
            }

            return matchesType && matchesMonth;
        })
        .reduce((sum, t) => sum + t.value, 0);
}

// Alias para compatibilidade (usa mes exibido agora)
function getCurrentMonthTotal(type) {
    return getDisplayedMonthTotal(type);
}

// ===========================
// MINI CHARTS - SAVINGS GOAL (LIQUID FILL GAUGE)
// ===========================
// Cria grafico Liquid Fill de progresso de meta de economia
function initializeSavingsGoalChart() {
    const chartEl = document.querySelector("#savingsGoalChart");
    if (!chartEl) return;

    const currentMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
    const currentYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();

    // ========================================
    // CALCULO CORRETO: Economia = dinheiro efetivamente guardado
    // Soma transacoes em categorias de reserva/investimento
    // ========================================
    const savingsCategories = window.SAVINGS_CATEGORIES || [
        'Investimentos', 'Poupança', 'Poupanca',
        'Reserva de Emergência', 'Reserva de Emergencia',
        'Previdência', 'Previdencia'
    ];

    // Normaliza string para comparacao (remove acentos e lowercase)
    const normalizeStr = (str) => {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    };

    const isSavingsCategory = (category) => {
        if (!category) return false;
        const normalized = normalizeStr(category);
        return savingsCategories.some(sc => normalizeStr(sc) === normalized);
    };

    // 1. Transacoes de debito/pix em categorias de poupanca
    const savingsFromDebit = transactions
        .filter(t => {
            const d = new Date(t.date + 'T12:00:00');
            return t.type === 'expense' &&
                   t.paymentMethod !== 'credit' &&
                   isSavingsCategory(t.category) &&
                   d.getMonth() === currentMonth &&
                   d.getFullYear() === currentYear;
        })
        .reduce((sum, t) => sum + t.value, 0);

    // 2. Transacoes de cartao de credito em categorias de poupanca
    const savingsFromCredit = transactions
        .filter(t => {
            const d = new Date(t.date + 'T12:00:00');
            return t.type === 'expense' &&
                   t.paymentMethod === 'credit' &&
                   isSavingsCategory(t.category) &&
                   d.getMonth() === currentMonth &&
                   d.getFullYear() === currentYear;
        })
        .reduce((sum, t) => sum + (t.value || 0), 0);

    // Total guardado = debito + credito em categorias de economia
    const saved = savingsFromDebit + savingsFromCredit;
    const goal = userSettings.savingsGoal || 2000;
    const percentage = goal > 0 ? Math.min((saved / goal) * 100, 100) : 0;

    // Cor baseada no progresso
    let gaugeColor = '#00D4FF'; // azul - em progresso
    if (saved >= goal) {
        gaugeColor = '#10b981'; // verde - meta atingida!
    } else if (percentage >= 50) {
        gaugeColor = '#f59e0b'; // laranja - mais da metade
    }

    // Configuracao do Liquid Fill Gauge (texto no cabecalho)
    const config = liquidFillGaugeDefaultSettings();
    config.circleColor = gaugeColor;
    config.waveColor = gaugeColor;
    config.waveHeight = 0.10;
    config.waveCount = 2;
    config.waveRiseTime = 1200;
    config.waveAnimateTime = 2000;
    config.circleThickness = 0.03;
    config.circleFillGap = 0.02;
    config.displayPercent = false;
    config.textSize = 0;

    // Atualiza ou cria gauge
    if (savingsGoalChart && savingsGoalChart.update) {
        savingsGoalChart.update(percentage);
    } else {
        savingsGoalChart = loadLiquidFillGauge("savingsGoalChart", percentage, config);
    }

    // Porcentagem no cabecalho
    const percentEl = document.getElementById('savingsGoalPercent');
    if (percentEl) {
        percentEl.textContent = `${Math.round(percentage)}%`;
        percentEl.style.color = gaugeColor;
    }

    // Valor abaixo do gauge
    const valueEl = document.getElementById('savingsGoalValue');
    if (valueEl) {
        valueEl.textContent = `${formatCurrencyDisplay(saved)} / ${formatCurrencyDisplay(goal)}`;
    }
}

// ===========================
// MINI CHARTS - EXPENSE LIMIT (LIQUID FILL GAUGE)
// ===========================
// Cria grafico Liquid Fill de limite de despesas
// LOGICA CORRETA: Gastos reais = Debito + Credito - Reservas
function initializeExpenseLimitChart() {
    const chartEl = document.querySelector("#expenseLimitChart");
    if (!chartEl) return;

    const month = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
    const year = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();

    // ========================================
    // CALCULO CORRETO: Gastos Reais
    // = Despesas em debito/PIX (exceto reservas)
    // + Despesas em cartao de credito (exceto reservas)
    // ========================================

    const savingsCategories = window.SAVINGS_CATEGORIES || [
        'Investimentos', 'Poupança', 'Poupanca',
        'Reserva de Emergência', 'Reserva de Emergencia',
        'Previdência', 'Previdencia'
    ];

    const normalizeStr = (str) => {
        return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
    };

    const isSavingsCategory = (category) => {
        if (!category) return false;
        const normalized = normalizeStr(category);
        return savingsCategories.some(sc => normalizeStr(sc) === normalized);
    };

    // 1. Gastos em debito/PIX (excluindo reservas)
    const expensesDebit = transactions
        .filter(t => {
            const d = new Date(t.date + 'T12:00:00');
            return t.type === 'expense' &&
                   t.paymentMethod !== 'credit' &&
                   !isSavingsCategory(t.category) &&
                   d.getMonth() === month &&
                   d.getFullYear() === year;
        })
        .reduce((sum, t) => sum + t.value, 0);

    // 2. Gastos em cartao de credito (excluindo reservas)
    const expensesCredit = transactions
        .filter(t => {
            const d = new Date(t.date + 'T12:00:00');
            return t.type === 'expense' &&
                   t.paymentMethod === 'credit' &&
                   !isSavingsCategory(t.category) &&
                   d.getMonth() === month &&
                   d.getFullYear() === year;
        })
        .reduce((sum, t) => sum + (t.value || 0), 0);

    // Total de gastos REAIS (consumo, nao reservas)
    const totalExpense = expensesDebit + expensesCredit;
    const limit = userSettings.expenseLimit || 3000;
    const percentage = limit > 0 ? Math.min((totalExpense / limit) * 100, 100) : 0;

    // Cores baseadas na saude financeira
    let gaugeColor, statusText;
    if (percentage > 100) {
        gaugeColor = '#dc2626'; // vermelho forte - estourou!
        statusText = 'Limite estourado!';
    } else if (percentage > 90) {
        gaugeColor = '#ef4444'; // vermelho - perigo
        statusText = 'Quase no limite';
    } else if (percentage > 75) {
        gaugeColor = '#f59e0b'; // laranja - atencao
        statusText = 'Fique atento';
    } else if (percentage > 50) {
        gaugeColor = '#eab308'; // amarelo - ok
        statusText = 'Sob controle';
    } else {
        gaugeColor = '#10b981'; // verde - otimo
        statusText = 'Excelente!';
    }

    // Configuracao do Liquid Fill Gauge (texto no cabecalho)
    const config = liquidFillGaugeDefaultSettings();
    config.circleColor = gaugeColor;
    config.waveColor = gaugeColor;
    config.waveHeight = 0.10;
    config.waveCount = 2;
    config.waveRiseTime = 1200;
    config.waveAnimateTime = 2000;
    config.circleThickness = 0.03;
    config.circleFillGap = 0.02;
    config.displayPercent = false;
    config.textSize = 0;

    // Atualiza ou cria gauge
    if (expenseLimitChart && expenseLimitChart.update) {
        expenseLimitChart.update(Math.min(percentage, 100));
    } else {
        expenseLimitChart = loadLiquidFillGauge("expenseLimitChart", Math.min(percentage, 100), config);
    }

    // Porcentagem no cabecalho
    const percentEl = document.getElementById('expenseLimitPercent');
    if (percentEl) {
        percentEl.textContent = `${Math.round(percentage)}%`;
        percentEl.style.color = gaugeColor;
    }

    // Valor abaixo do gauge
    const valueEl = document.getElementById('expenseLimitValue');
    if (valueEl) {
        valueEl.textContent = `${formatCurrencyDisplay(totalExpense)} / ${formatCurrencyDisplay(limit)}`;
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
            const tDate = new Date(t.date + 'T12:00:00');
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
            const tDate = new Date(t.date + 'T12:00:00');
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
// Grafico de barras horizontais com top 5 categorias de despesas
function initializeTopCategoriesChart() {
    const chartEl = document.querySelector("#topCategoriesChart");
    if (!chartEl) return;

    const data = getCategoryData();
    const topCategories = data.categories.slice(0, 5);
    const topValues = data.values.slice(0, 5);

    // Paleta clean - cores suaves e distintas
    const cleanColors = ['#f87171', '#fb923c', '#fbbf24', '#34d399', '#60a5fa'];

    const options = {
        series: [{ name: 'Valor', data: topValues }],
        chart: {
            type: 'bar',
            height: '100%',
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false },
            background: 'transparent'
        },
        plotOptions: {
            bar: {
                horizontal: true,
                distributed: true,
                barHeight: '60%',
                borderRadius: 4,
                borderRadiusApplication: 'end'
            }
        },
        fill: {
            opacity: 0.85
        },
        colors: cleanColors,
        dataLabels: {
            enabled: true,
            formatter: function(val) {
                return formatCurrencyCompact(val);
            },
            textAnchor: 'end',
            offsetX: -6,
            style: {
                fontSize: '10px',
                fontWeight: 600,
                colors: ['#fff']
            }
        },
        stroke: {
            show: true,
            width: 1,
            colors: ['transparent']
        },
        xaxis: {
            categories: topCategories,
            labels: { show: false },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#94a3b8',
                    fontSize: '11px',
                    fontWeight: 500
                },
                offsetX: -5
            }
        },
        grid: {
            show: false
        },
        legend: { show: false },
        tooltip: {
            enabled: true,
            y: {
                formatter: function(value) {
                    return formatCurrencyDisplay(value);
                }
            },
            theme: 'dark'
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

    // Cores clean - destaca a semana com maior gasto em vermelho suave
    const barColors = data.values.map((val, idx) => {
        if (idx === data.maxIndex && val > 0) {
            return '#f87171'; // Vermelho suave para maior gasto
        }
        return '#818cf8'; // Indigo suave padrao
    });

    const options = {
        series: [{
            name: 'Gastos',
            data: data.values
        }],
        chart: {
            type: 'bar',
            height: '100%',
            fontFamily: 'Inter, sans-serif',
            toolbar: { show: false },
            background: 'transparent'
        },
        plotOptions: {
            bar: {
                borderRadius: 4,
                columnWidth: '50%',
                distributed: true,
                borderRadiusApplication: 'end'
            }
        },
        fill: {
            opacity: 0.85
        },
        colors: barColors,
        dataLabels: {
            enabled: true,
            formatter: function(val) {
                if (val === 0) return '';
                return formatCurrencyCompact(val);
            },
            offsetY: -18,
            style: {
                fontSize: '10px',
                fontWeight: 500,
                colors: ['#94a3b8']
            }
        },
        legend: { show: false },
        stroke: {
            show: true,
            width: 1,
            colors: ['transparent']
        },
        xaxis: {
            categories: data.labels,
            labels: {
                style: {
                    colors: '#94a3b8',
                    fontSize: '11px',
                    fontWeight: 500
                }
            },
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#64748b',
                    fontSize: '10px'
                },
                formatter: function(val) {
                    return formatCurrencyCompact(val);
                }
            }
        },
        grid: {
            borderColor: 'rgba(255,255,255,0.04)',
            strokeDashArray: 3,
            yaxis: { lines: { show: true } },
            xaxis: { lines: { show: false } }
        },
        tooltip: {
            enabled: true,
            y: {
                formatter: function(value) {
                    return formatCurrencyDisplay(value);
                }
            },
            theme: 'dark'
        }
    };

    weeklyTrendChart = new ApexCharts(chartEl, options);
    weeklyTrendChart.render();
}

// Formata valor monetario de forma compacta (1.5k, 2.3k, etc)
function formatCurrencyCompact(value) {
    if (value >= 1000) {
        return 'R$' + (value / 1000).toFixed(1) + 'k';
    }
    return 'R$' + value.toFixed(0);
}

// ========================================
// COMPARATIVO SEMANAL DO MES
// Divide o mes em semanas e compara gastos reais
// Gastos Reais = Debito + Credito - Reservas
// ========================================
function getWeeklyTrendData() {
    const month = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
    const year = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();

    // Categorias de reserva (nao sao gastos)
    const savingsCategories = window.SAVINGS_CATEGORIES || [
        'Investimentos', 'Poupança', 'Poupanca',
        'Reserva de Emergência', 'Reserva de Emergencia',
        'Previdência', 'Previdencia'
    ];

    const normalizeStr = (str) => {
        return str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
    };

    const isSavingsCategory = (category) => {
        if (!category) return false;
        const normalized = normalizeStr(category);
        return savingsCategories.some(sc => normalizeStr(sc) === normalized);
    };

    // Definir semanas do mes (1-7, 8-14, 15-21, 22-28, 29+)
    const weeks = [
        { label: 'Sem 1', start: 1, end: 7 },
        { label: 'Sem 2', start: 8, end: 14 },
        { label: 'Sem 3', start: 15, end: 21 },
        { label: 'Sem 4', start: 22, end: 28 },
        { label: 'Sem 5', start: 29, end: 31 }
    ];

    const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
    const values = [];
    const labels = [];

    weeks.forEach(week => {
        // Pular semana 5 se o mes nao tiver dias 29+
        if (week.start > lastDayOfMonth) return;

        const weekEnd = Math.min(week.end, lastDayOfMonth);

        // 1. Gastos em debito/PIX (excluindo reservas)
        const debitExpenses = transactions
            .filter(t => {
                const d = new Date(t.date + 'T12:00:00');
                const day = d.getDate();
                return t.type === 'expense' &&
                       t.paymentMethod !== 'credit' &&
                       !isSavingsCategory(t.category) &&
                       d.getMonth() === month &&
                       d.getFullYear() === year &&
                       day >= week.start &&
                       day <= weekEnd;
            })
            .reduce((sum, t) => sum + t.value, 0);

        // 2. Gastos em cartao de credito (excluindo reservas)
        const creditExpenses = creditCards.reduce((sum, card) => {
            if (!card.transactions) return sum;

            const cardExpenses = card.transactions
                .filter(t => {
                    const d = new Date(t.date + 'T12:00:00');
                    const day = d.getDate();
                    return !isSavingsCategory(t.category) &&
                           d.getMonth() === month &&
                           d.getFullYear() === year &&
                           day >= week.start &&
                           day <= weekEnd;
                })
                .reduce((s, t) => s + t.value, 0);

            return sum + cardExpenses;
        }, 0);

        const totalWeek = debitExpenses + creditExpenses;
        values.push(totalWeek);

        // Label com intervalo de dias
        const labelWithDays = `${week.label}\n(${week.start}-${weekEnd})`;
        labels.push(week.label);
    });

    // Calcular qual semana teve maior gasto (para destacar)
    const maxValue = Math.max(...values);
    const maxIndex = values.indexOf(maxValue);

    return {
        values,
        labels,
        maxIndex,
        totalMonth: values.reduce((a, b) => a + b, 0)
    };
}

// Atualiza grafico de comparativo semanal
function updateWeeklyTrendChart() {
    if (!weeklyTrendChart) return;

    const data = getWeeklyTrendData();

    // Atualiza cores clean (destaca semana com maior gasto)
    const barColors = data.values.map((val, idx) => {
        if (idx === data.maxIndex && val > 0) {
            return '#f87171'; // Vermelho suave para maior gasto
        }
        return '#818cf8'; // Indigo suave padrao
    });

    weeklyTrendChart.updateOptions({
        xaxis: { categories: data.labels },
        colors: barColors
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
// CORRIGIDO: Debounce + verificacao de altura minima para evitar erros foreignObject negativo
let resizeTimeout = null;
const MIN_CHART_HEIGHT = 100; // Altura minima em pixels para atualizar graficos

function safeUpdateChart(chart, containerId) {
    if (!chart || typeof chart.updateOptions !== 'function') return;

    const container = document.getElementById(containerId);
    if (!container) return;

    const rect = container.getBoundingClientRect();
    // So atualiza se o container tem altura suficiente
    if (rect.height >= MIN_CHART_HEIGHT) {
        try {
            chart.updateOptions({});
        } catch (e) {
            // Ignora erros de altura negativa do ApexCharts
            console.debug('Chart resize skipped:', containerId);
        }
    }
}

window.addEventListener('resize', () => {
    // Debounce: aguarda 150ms apos o ultimo resize
    if (resizeTimeout) clearTimeout(resizeTimeout);

    resizeTimeout = setTimeout(() => {
        safeUpdateChart(cashFlowChart, 'cashFlowChart');
        safeUpdateChart(categoryChart, 'categoryChart');
        safeUpdateChart(paymentMethodChart, 'paymentMethodChart');
        safeUpdateChart(comparisonChart, 'comparisonChart');
        safeUpdateChart(topCategoriesChart, 'topCategoriesChart');
        safeUpdateChart(weeklyTrendChart, 'weeklyTrendChart');
    }, 150);
});

logger.log('Dashboard Financeiro v2.3 - Script carregado (fix resize errors)');

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
        this.customSelect.setAttribute('tabindex', '0'); // Permite receber foco e eventos de teclado

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
            optionElement.dataset.value = option.value;
            optionElement.dataset.index = index;

            // Suporte a icones (para dropdown de categorias)
            const icon = option.dataset.icon;
            if (icon) {
                optionElement.innerHTML = `<i class="fas ${icon} option-icon"></i><span>${option.textContent}</span>`;
            } else {
                optionElement.textContent = option.textContent;
            }

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
                // Se tem opcao highlighted, seleciona ela
                const highlighted = this.dropdown.querySelector('.custom-select-option.highlighted');
                if (highlighted && this.isOpen) {
                    const index = parseInt(highlighted.dataset.index);
                    this.selectOption(index);
                } else {
                    this.toggle();
                }
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

        // Navegacao por digitacao - pula para opcao que comeca com a letra
        this.searchBuffer = '';
        this.searchTimeout = null;
        this.lastSearchChar = '';
        this.lastMatchIndex = -1;
        this.customSelect.addEventListener('keypress', (e) => {
            const char = e.key.toLowerCase();
            if (/[a-zA-Z0-9]/.test(char)) {
                e.preventDefault();

                // Limpar timeout anterior
                if (this.searchTimeout) clearTimeout(this.searchTimeout);

                // Abrir dropdown se fechado
                if (!this.isOpen) this.open();

                // Se for a mesma letra repetida, pular para proxima opcao
                if (char === this.lastSearchChar && this.searchBuffer.length <= 1) {
                    this.jumpToNextMatch(char);
                } else {
                    // Adicionar ao buffer e buscar
                    this.searchBuffer += char;
                    this.lastSearchChar = char;
                    this.lastMatchIndex = -1;
                    this.jumpToText(this.searchBuffer);
                }

                // Limpar buffer apos 1 segundo
                this.searchTimeout = setTimeout(() => {
                    this.searchBuffer = '';
                    this.lastSearchChar = '';
                    this.lastMatchIndex = -1;
                }, 1000);
            }
        });

        // Observar mudanças no select original
        // CORRIGIDO: Armazenar referência para cleanup posterior (memory leak fix)
        this.observer = new MutationObserver(() => {
            this.updateDropdownOptions();
        });
        this.observer.observe(this.selectElement, { childList: true, subtree: true });

        // Observar mudanças de valor
        this._changeHandler = () => this.updateSelected();
        this.selectElement.addEventListener('change', this._changeHandler);
    }

    // NOVO: Método destroy para cleanup de listeners e observer
    destroy() {
        // Desconectar MutationObserver
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        // Remover event listener
        if (this._changeHandler) {
            this.selectElement.removeEventListener('change', this._changeHandler);
            this._changeHandler = null;
        }

        // Remover elemento customizado do DOM
        if (this.customSelect && this.customSelect.parentNode) {
            this.customSelect.parentNode.removeChild(this.customSelect);
        }

        // Mostrar select original novamente
        if (this.selectElement) {
            this.selectElement.style.display = '';
            delete this.selectElement.dataset.customized;
        }
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

        if (selectedOption && selectedOption.value) {
            // Suporte a icones no valor selecionado
            const icon = selectedOption.dataset.icon;
            if (icon) {
                valueSpan.innerHTML = `<i class="fas ${icon} option-icon"></i><span>${selectedOption.textContent}</span>`;
            } else {
                valueSpan.textContent = selectedOption.textContent;
            }
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
            optionElement.dataset.value = option.value;
            optionElement.dataset.index = index;

            // Suporte a icones (para dropdown de categorias)
            const icon = option.dataset.icon;
            if (icon) {
                optionElement.innerHTML = `<i class="fas ${icon} option-icon"></i><span>${option.textContent}</span>`;
            } else {
                optionElement.textContent = option.textContent;
            }

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

    jumpToText(text) {
        const options = Array.from(this.dropdown.querySelectorAll('.custom-select-option:not(.disabled)'));
        const searchText = text.toLowerCase();

        for (let i = 0; i < options.length; i++) {
            const optionText = options[i].textContent.trim().toLowerCase();
            if (optionText.startsWith(searchText)) {
                // Armazenar indice para navegacao repetida
                this.lastMatchIndex = i;
                // Highlight visual
                options.forEach(opt => opt.classList.remove('highlighted'));
                options[i].classList.add('highlighted');
                options[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                return;
            }
        }

        // Se nao encontrou e tem mais de 1 caractere, tenta so com o ultimo
        if (text.length > 1) {
            this.searchBuffer = text.charAt(text.length - 1);
            this.lastSearchChar = this.searchBuffer;
            this.lastMatchIndex = -1;
            this.jumpToText(this.searchBuffer);
        }
    }

    jumpToNextMatch(char) {
        const options = Array.from(this.dropdown.querySelectorAll('.custom-select-option:not(.disabled)'));
        const searchChar = char.toLowerCase();

        // Encontrar todas as opcoes que comecam com a letra
        const matches = [];
        options.forEach((opt, idx) => {
            if (opt.textContent.trim().toLowerCase().startsWith(searchChar)) {
                matches.push(idx);
            }
        });

        if (matches.length === 0) return;

        // Encontrar o proximo indice apos o atual
        let nextIdx = matches.find(idx => idx > this.lastMatchIndex);

        // Se nao encontrou, volta pro primeiro (ciclo)
        if (nextIdx === undefined) {
            nextIdx = matches[0];
        }

        this.lastMatchIndex = nextIdx;

        // Highlight visual
        options.forEach(opt => opt.classList.remove('highlighted'));
        options[nextIdx].classList.add('highlighted');
        options[nextIdx].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
        logger.log('🔍 Buscando UID da conta da empresa...');
        const configDoc = await db.collection('systemConfig').doc('companyAccount').get();

        if (!configDoc.exists) {
            logger.error('❌ Configuração da empresa não encontrada!');
            return;
        }

        const companyUserId = configDoc.data().userId;
        logger.log('✅ UID da empresa encontrado:', companyUserId);

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
            logger.log('❌ Operação cancelada pelo usuário');
            return;
        }

        // 3. Segundo nível de confirmação
        const finalConfirmation = prompt(
            'Digite "DELETAR TUDO" para confirmar a exclusão permanente de todos os dados da empresa:'
        );

        if (finalConfirmation !== 'DELETAR TUDO') {
            logger.log('❌ Confirmação inválida. Operação cancelada.');
            return;
        }

        logger.log('🧹 Iniciando limpeza dos dados...');
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
            logger.log(`🗑️ Deletando ${collectionName}...`);

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
                logger.log(`✅ ${count} documento(s) deletado(s) de ${collectionName}`);
                totalDeleted += count;
            } else {
                logger.log(`ℹ️ Nenhum documento encontrado em ${collectionName}`);
            }
        }

        hideLoading();

        logger.log(`✅ Limpeza concluída! Total de ${totalDeleted} documento(s) deletado(s).`);
        showToast(`✅ Limpeza concluída! ${totalDeleted} registros removidos.`, 'success');

        // 5. Recarregar dashboard
        setTimeout(() => {
            logger.log('🔄 Recarregando dashboard...');
            location.reload();
        }, 2000);

    } catch (error) {
        hideLoading();
        logger.error('❌ Erro ao limpar dados:', error);
        showToast('Erro ao limpar dados: ' + error.message, 'error');
    }
}

// Exportar função para console
window.cleanCompanyData = cleanCompanyData;
logger.log('✅ Função administrativa carregada: cleanCompanyData()');
logger.log('📝 Para limpar os dados da empresa, digite no console: cleanCompanyData()');

logger.log('âœ… Finance UI v3.0 - Loaded');
// ===========================
// PRIVACY TOGGLE (Investimentos)
// ===========================
/**
 * Alterna a visibilidade do valor de investimentos
 * Útil para abrir o painel em público sem expor valores sensíveis
 */
function toggleInvestmentVisibility() {
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

logger.log('✅ Privacy Toggle - Loaded');

// ===========================
// ATALHOS DE TECLADO DO DASHBOARD
// ===========================
/**
 * Atalhos de teclado para navegacao rapida no dashboard financeiro:
 * - T: Abre modal de nova transacao
 * - Escape: Fecha modais abertos
 */
document.addEventListener('keydown', (e) => {
    // Ignorar se estiver digitando em input, textarea ou contenteditable
    const activeElement = document.activeElement;
    const isTyping = activeElement.tagName === 'INPUT' ||
                     activeElement.tagName === 'TEXTAREA' ||
                     activeElement.isContentEditable;

    if (isTyping) return;

    // Verificar se algum modal esta aberto
    const anyModalOpen = document.querySelector('.modal-overlay.active');

    switch (e.key.toLowerCase()) {
        case 't':
            // T: Abrir modal de nova transacao (apenas se nenhum modal estiver aberto)
            if (!anyModalOpen && typeof openTransactionModal === 'function') {
                e.preventDefault();
                openTransactionModal();
            }
            break;

        case 'escape':
            // Escape: Fechar modal ativo
            if (anyModalOpen) {
                e.preventDefault();
                // Tentar fechar na ordem: transacao, lista, cartao, investimento, etc
                const transactionModal = document.getElementById('transactionModal');
                if (transactionModal?.classList.contains('active')) {
                    closeTransactionModal();
                    return;
                }

                // Fechar outros modais de lista
                const listModals = document.querySelectorAll('.modal-list.active');
                if (listModals.length > 0) {
                    listModals.forEach(modal => modal.classList.remove('active'));
                    return;
                }

                // Fechar qualquer modal generico
                anyModalOpen.classList.remove('active');
            }
            break;
    }
});

logger.log('[OK] Keyboard Shortcuts - Loaded (T: Nova Transacao, Esc: Fechar)');

logger.log('[OK] Finance UI v3.0 - Loaded');

// Notificar finance-core.js que todos os scripts carregaram
// Isso desbloqueia o processamento de usuarios autenticados
if (typeof window.notifyScriptsLoaded === 'function') {
    window.notifyScriptsLoaded();
}
