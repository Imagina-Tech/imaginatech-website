/*
==================================================
ARQUIVO: financas/dashboard-enhanced.js
FUNCIONALIDADES ADICIONAIS DO DASHBOARD
Sistema de navegação mensal e popups de KPIs
==================================================
*/

// ===========================
// SELETOR DE MÊS E NAVEGAÇÃO
// ===========================
let currentDisplayMonth = new Date().getMonth(); // 0-11
let currentDisplayYear = new Date().getFullYear();

function updateMonthDisplay() {
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const el = document.getElementById('monthName');
    if (el) {
        el.textContent = `${monthNames[currentDisplayMonth]} ${currentDisplayYear}`;
    }
}

function changeMonth(direction) {
    currentDisplayMonth += direction;

    if (currentDisplayMonth > 11) {
        currentDisplayMonth = 0;
        currentDisplayYear++;
    } else if (currentDisplayMonth < 0) {
        currentDisplayMonth = 11;
        currentDisplayYear--;
    }

    updateMonthDisplay();

    // Fechar qualquer modal aberto para garantir que dados sejam atualizados
    const cardBillDetailsModal = document.getElementById('cardBillDetailsModal');
    if (cardBillDetailsModal) {
        cardBillDetailsModal.classList.remove('active');
    }

    // Recarregar TODOS os dados do mês selecionado
    if (typeof updateKPIs === 'function') {
        updateKPIs();
    }
    if (typeof updateCharts === 'function') {
        updateCharts();
    }
    if (typeof updateDashboard === 'function') {
        updateDashboard();
    }

    // Reinicializar mini-charts após navegação
    if (typeof savingsGoalChart !== 'undefined' && savingsGoalChart) {
        savingsGoalChart.destroy();
        savingsGoalChart = null;
    }
    if (typeof initializeSavingsGoalChart === 'function') {
        initializeSavingsGoalChart();
    }

    if (typeof expenseLimitChart !== 'undefined' && expenseLimitChart) {
        expenseLimitChart.destroy();
        expenseLimitChart = null;
    }
    if (typeof initializeExpenseLimitChart === 'function') {
        initializeExpenseLimitChart();
    }
}

// ===========================
// MODAIS DE LISTA DOS KPIs
// ===========================
function openKPIList(type) {
    switch(type) {
        case 'income':
            showTransactionsList('income');
            break;
        case 'expense':
            showTransactionsList('expense');
            break;
        case 'subscriptions':
            showSubscriptionsList();
            break;
        case 'installments':
            showInstallmentsList();
            break;
        case 'projections':
            showProjectionsList();
            break;
        case 'creditCards':
            showCreditCardsList();
            break;
    }
}

function showTransactionsList(filterType) {
    const modal = document.getElementById('transactionsListModal');
    const content = document.getElementById('transactionsListContent');

    if (!transactions || transactions.length === 0) {
        content.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhuma transação neste mês</p></div>';
        modal.classList.add('active');
        return;
    }

    const filtered = transactions.filter(t => {
        const d = new Date(t.date + 'T12:00:00');
        const match = d.getMonth() === currentDisplayMonth && d.getFullYear() === currentDisplayYear;

        // Se for filtro de expenses, excluir transações de crédito (elas aparecem no modal do cartão)
        if (filterType === 'expense') {
            return match && t.type === 'expense' && t.paymentMethod !== 'credit';
        }

        // Se for filtro de income, excluir reembolsos no crédito (eles aparecem no modal do cartão)
        if (filterType === 'income') {
            return match && t.type === 'income' && t.paymentMethod !== 'credit';
        }

        return filterType === 'all' ? match : (match && t.type === filterType);
    });

    if (filtered.length === 0) {
        content.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhuma transação encontrada</p></div>';
    } else {
        content.innerHTML = filtered.map(t => `
            <div class="list-item">
                <div class="list-item-info">
                    <div class="list-item-title">${t.description}</div>
                    <div class="list-item-subtitle">${t.category} • ${formatDate(t.date)}</div>
                </div>
                <div class="list-item-value ${t.type}">${t.type === 'income' ? '+' : '-'} ${formatCurrencyDisplay(t.value)}</div>
                <div class="list-item-actions">
                    <button class="btn-icon" onclick="editTransactionAndRefresh('${t.id}')" title="Editar" style="color: var(--color-neutral);">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon danger" onclick="deleteTransactionAndRefresh('${t.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    modal.classList.add('active');
}

function showSubscriptionsList() {
    const modal = document.getElementById('subscriptionsListModal');
    const content = document.getElementById('subscriptionsListContent');

    if (!subscriptions || subscriptions.length === 0) {
        content.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhuma assinatura cadastrada</p></div>';
        modal.classList.add('active');
        return;
    }

    const active = subscriptions.filter(s => s.status === 'active');

    if (active.length === 0) {
        content.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhuma assinatura ativa</p></div>';
    } else {
        content.innerHTML = active.map(s => {
            // Encontra o cartão associado
            const card = creditCards.find(c => c.id === s.cardId);
            const cardName = card ? `${card.name} - ${card.institution}` : '';

            return `
            <div class="list-item">
                <div class="list-item-info">
                    <div class="list-item-title">${s.name}</div>
                    <div class="list-item-subtitle">
                        ${s.category} • Vence dia ${s.dueDay}
                        ${cardName ? `<br><i class="fas fa-credit-card"></i> ${cardName}` : ''}
                    </div>
                </div>
                <div class="list-item-value expense">${formatCurrencyDisplay(s.value)}/mês</div>
                <div class="list-item-actions">
                    <button class="btn-icon" onclick="editSubscriptionAndRefresh('${s.id}')" title="Editar" style="color: var(--color-neutral);">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon danger" onclick="deleteSubscriptionAndRefresh('${s.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `}).join('');
    }

    modal.classList.add('active');
}

function showInstallmentsList() {
    const modal = document.getElementById('installmentsListModal');
    const content = document.getElementById('installmentsListContent');

    if (!installments || installments.length === 0) {
        content.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum parcelamento cadastrado</p></div>';
        modal.classList.add('active');
        return;
    }

    // Filtra parcelas ativas no mês selecionado
    const active = installments.filter(i => {
        if (typeof isInstallmentActiveInMonth === 'function') {
            return isInstallmentActiveInMonth(i, currentDisplayMonth, currentDisplayYear);
        }
        // Fallback: usa calculateCurrentInstallment se disponível
        const current = typeof calculateCurrentInstallment === 'function'
            ? calculateCurrentInstallment(i)
            : i.currentInstallment || (i.paidInstallments ? i.paidInstallments + 1 : 1);
        return current <= i.totalInstallments;
    });

    if (active.length === 0) {
        content.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum parcelamento ativo neste mês</p></div>';
    } else {
        content.innerHTML = active.map(i => {
            // Usa função global calculateCurrentInstallment se disponível, senão calcula aqui
            const current = typeof calculateCurrentInstallment === 'function'
                ? calculateCurrentInstallment(i)
                : i.currentInstallment || (i.paidInstallments ? i.paidInstallments + 1 : 1);
            const remaining = i.totalInstallments - current + 1;
            const installmentValue = i.totalValue / i.totalInstallments;
            return `
                <div class="list-item">
                    <div class="list-item-info">
                        <div class="list-item-title">${i.description}</div>
                        <div class="list-item-subtitle">
                            Parcela ${current}/${i.totalInstallments} • ${remaining} restantes
                        </div>
                    </div>
                    <div class="list-item-value expense">${formatCurrencyDisplay(installmentValue)}/mês</div>
                    <div class="list-item-actions">
                        <button class="btn-icon" onclick="editInstallmentAndRefresh('${i.id}')" title="Editar" style="color: var(--color-neutral);">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon danger" onclick="deleteInstallmentAndRefresh('${i.id}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    modal.classList.add('active');
}

function showProjectionsList() {
    const modal = document.getElementById('projectionsListModal');
    const content = document.getElementById('projectionsListContent');

    const currentMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
    const currentYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();

    // Filtrar projeções do mês
    const monthProj = projections ? projections.filter(p => {
        const d = new Date(p.date + 'T12:00:00');
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }) : [];

    // Separar projeções de entrada e saída
    const incomeProj = monthProj.filter(p => !p.type || p.type === 'income');
    const expenseProj = monthProj.filter(p => p.type === 'expense');

    // Calcular projeção de saídas (faturas não pagas)
    const unpaidBillsTotal = creditCards ? creditCards.reduce((sum, card) => {
        const billValue = typeof calculateCurrentBill === 'function'
            ? calculateCurrentBill(card, currentMonth, currentYear) : 0;
        const isPaid = typeof isBillPaid === 'function'
            ? isBillPaid(card.id, currentMonth, currentYear) : false;
        return sum + (isPaid ? 0 : billValue);
    }, 0) : 0;

    // Total de projeções de saída pendentes
    const pendingExpenseProjections = expenseProj
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + p.value, 0);

    // Construir HTML com seções separadas
    let html = '';

    // Seção: Projeção de Saídas (faturas a pagar + projeções de saída)
    const totalPendingExpenses = unpaidBillsTotal + pendingExpenseProjections;
    if (totalPendingExpenses > 0 || expenseProj.length > 0) {
        html += `
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px;">
                <h3 style="font-size: 0.875rem; margin-bottom: 0.75rem; color: #ef4444; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-arrow-down"></i> Projeções de Saída
                </h3>
                <div style="font-size: 1.25rem; font-weight: 700; color: #ef4444; margin-bottom: 0.5rem;">
                    ${formatCurrencyDisplay(totalPendingExpenses)}
                </div>
                <small style="color: var(--text-muted);">Total pendente este mês</small>
        `;

        // Faturas de cartão
        if (creditCards && creditCards.length > 0 && unpaidBillsTotal > 0) {
            html += `
                <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(239, 68, 68, 0.2);">
                    <small style="color: var(--text-muted); font-weight: 600;">Faturas de Cartão:</small>
                    <div style="margin-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted);">
                        ${creditCards.map(card => {
                            const billValue = typeof calculateCurrentBill === 'function'
                                ? calculateCurrentBill(card, currentMonth, currentYear) : 0;
                            const isPaid = typeof isBillPaid === 'function'
                                ? isBillPaid(card.id, currentMonth, currentYear) : false;
                            if (billValue === 0) return '';
                            return `<div style="margin-bottom: 0.25rem;">${card.name}: ${formatCurrencyDisplay(billValue)} ${isPaid ? '<span style="color: #10b981;">(pago)</span>' : ''}</div>`;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        html += `</div>`;

        // Lista de projeções de saída manuais
        if (expenseProj.length > 0) {
            html += expenseProj.map(p => {
                const statusLabel = p.status === 'pending' ? 'Pendente' : 'Pago';
                const actionLabel = p.status === 'pending' ? 'Marcar como Pago' : 'Marcar como Pendente';
                return `
                <div class="list-item" style="border-left: 3px solid #ef4444;">
                    <div class="list-item-info">
                        <div class="list-item-title">${p.description}</div>
                        <div class="list-item-subtitle">
                            ${formatDate(p.date)} • <span class="status-badge ${p.status === 'pending' ? 'pending' : 'received'}">${statusLabel}</span>
                        </div>
                    </div>
                    <div class="list-item-value expense">- ${formatCurrencyDisplay(p.value)}</div>
                    <div class="list-item-actions">
                        <button class="btn-icon" onclick="editProjectionAndRefresh('${p.id}')" title="Editar" style="color: var(--color-neutral);">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon ${p.status === 'pending' ? 'success' : 'warning'}" onclick="toggleProjectionStatus('${p.id}', '${p.status}')" title="${actionLabel}">
                            <i class="fas ${p.status === 'pending' ? 'fa-check-circle' : 'fa-clock'}"></i>
                        </button>
                        <button class="btn-icon danger" onclick="deleteProjectionAndRefresh('${p.id}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `}).join('');
        }
    }

    // Seção: Projeções de Entrada (Receita)
    html += `
        <h3 style="font-size: 0.875rem; margin: 1.5rem 0 0.75rem 0; color: #10b981; display: flex; align-items: center; gap: 0.5rem;">
            <i class="fas fa-arrow-up"></i> Projeções de Entrada
        </h3>
    `;

    if (incomeProj.length === 0) {
        html += '<div class="empty-state" style="padding: 1rem;"><i class="fas fa-inbox"></i><p>Nenhuma projeção de entrada para este mês</p></div>';
    } else {
        html += incomeProj.map(p => {
            const statusLabel = p.status === 'pending' ? 'Pendente' : 'Recebido';
            const actionLabel = p.status === 'pending' ? 'Marcar como Recebido' : 'Marcar como Pendente';
            return `
            <div class="list-item" style="border-left: 3px solid #10b981;">
                <div class="list-item-info">
                    <div class="list-item-title">${p.description}</div>
                    <div class="list-item-subtitle">
                        ${formatDate(p.date)} • <span class="status-badge ${p.status === 'pending' ? 'pending' : 'received'}">${statusLabel}</span>
                    </div>
                </div>
                <div class="list-item-value income">+ ${formatCurrencyDisplay(p.value)}</div>
                <div class="list-item-actions">
                    <button class="btn-icon" onclick="editProjectionAndRefresh('${p.id}')" title="Editar" style="color: var(--color-neutral);">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon ${p.status === 'pending' ? 'success' : 'warning'}" onclick="toggleProjectionStatus('${p.id}', '${p.status}')" title="${actionLabel}">
                        <i class="fas ${p.status === 'pending' ? 'fa-check-circle' : 'fa-clock'}"></i>
                    </button>
                    <button class="btn-icon danger" onclick="deleteProjectionAndRefresh('${p.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `}).join('');
    }

    content.innerHTML = html;
    modal.classList.add('active');
}

function showCreditCardsList() {
    const modal = document.getElementById('creditCardsListModal');
    const content = document.getElementById('creditCardsListContent');

    if (!creditCards || creditCards.length === 0) {
        content.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Nenhum cartão cadastrado</p></div>';
        modal.classList.add('active');
        return;
    }

    content.innerHTML = creditCards.map(card => {
        const bill = calculateCurrentBill ? calculateCurrentBill(card, currentDisplayMonth, currentDisplayYear) : 0;
        const percentage = card.limit > 0 ? (bill / card.limit) * 100 : 0;
        return `
            <div class="list-item">
                <div class="list-item-info">
                    <div class="list-item-title">${card.name}</div>
                    <div class="list-item-subtitle">
                        ${card.institution} • Limite: ${formatCurrencyDisplay(card.limit)}<br>
                        Fecha dia ${card.closingDay} • Vence dia ${card.dueDay}
                        <div style="margin-top: 0.5rem;">
                            <div style="background: rgba(255,255,255,0.1); height: 6px; border-radius: 3px; overflow: hidden;">
                                <div style="width: ${Math.min(percentage, 100)}%; height: 100%; background: ${percentage > 80 ? '#FF0055' : '#00D4FF'};"></div>
                            </div>
                            <small style="color: rgba(255,255,255,0.6); font-size: 0.75rem;">${percentage.toFixed(1)}% do limite</small>
                        </div>
                    </div>
                </div>
                <div class="list-item-value expense">${formatCurrencyDisplay(bill)}</div>
                <div class="list-item-actions">
                    <button class="btn-icon" onclick="closeListModal('creditCardsListModal'); showCardBillDetails('${card.id}');" title="Ver Detalhes" style="color: var(--color-neutral);">
                        <i class="fas fa-list"></i>
                    </button>
                    <button class="btn-icon danger" onclick="deleteCreditCardAndRefresh('${card.id}')" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    modal.classList.add('active');
}

function closeListModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// ===========================
// FUNÇÕES DE DELETE E EDIT COM REFRESH
// ===========================
async function editTransactionAndRefresh(id) {
    if (typeof editTransaction === 'function') {
        // Fecha o modal de lista
        closeListModal('transactionsListModal');
        // Abre o modal de edição
        editTransaction(id);
    }
}

async function deleteTransactionAndRefresh(id) {
    if (typeof deleteTransaction === 'function') {
        await deleteTransaction(id);
        showTransactionsList('all');
    }
}

async function editSubscriptionAndRefresh(id) {
    if (typeof editSubscription === 'function') {
        // Fecha o modal de lista
        closeListModal('subscriptionsListModal');
        // Abre o modal de edição
        editSubscription(id);
    }
}

async function deleteSubscriptionAndRefresh(id) {
    if (typeof deleteSubscription === 'function') {
        await deleteSubscription(id);
        showSubscriptionsList();
    }
}

async function editInstallmentAndRefresh(id) {
    if (typeof editInstallment === 'function') {
        // Fecha o modal de lista
        closeListModal('installmentsListModal');
        // Abre o modal de edição
        editInstallment(id);
    }
}

async function deleteInstallmentAndRefresh(id) {
    if (typeof deleteInstallment === 'function') {
        await deleteInstallment(id);
        showInstallmentsList();
    }
}

async function editProjectionAndRefresh(id) {
    if (typeof editProjection === 'function') {
        // Fecha o modal de lista
        closeListModal('projectionsListModal');
        // Abre o modal de edição
        editProjection(id);
    }
}

async function deleteProjectionAndRefresh(id) {
    if (typeof deleteProjection === 'function') {
        await deleteProjection(id);
        showProjectionsList();
    }
}

async function toggleProjectionStatus(id, currentStatus) {
    if (typeof updateProjectionStatus === 'function') {
        // Alterna entre pending e received
        const newStatus = currentStatus === 'pending' ? 'received' : 'pending';
        await updateProjectionStatus(id, newStatus);
        showProjectionsList();
    }
}

async function deleteCreditCardAndRefresh(id) {
    if (typeof deleteCreditCard === 'function') {
        await deleteCreditCard(id);
        showCreditCardsList();
    }
}

// Inicializar quando DOM carregar
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateMonthDisplay);
} else {
    updateMonthDisplay();
}

console.log('Dashboard Enhanced v1.0 - Loaded');
