/*
==================================================
ARQUIVO: financas/finance-data.js
MÃ“DULO: Data - CRUD, IntegraÃ§Ã£o com Firestore e KPIs
SISTEMA: ImaginaTech - GestÃ£o de ImpressÃ£o 3D
VERSÃƒO: 3.0 - RefatoraÃ§Ã£o Modular
IMPORTANTE: NÃƒO REMOVER ESTE CABEÃ‡ALHO DE IDENTIFICAÃ‡ÃƒO
==================================================
*/
// ===========================
// TRANSACTIONS CRUD
// ===========================
// ðŸ—„ï¸ Carrega todas as transaÃ§Ãµes do Firestore
async function loadTransactions() {
    try {
        console.log('Carregando transaÃ§Ãµes...');
        const snapshot = await db.collection('transactions')
            .where('userId', '==', activeUserId)
            .orderBy('date', 'desc')
            .get();

        transactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${transactions.length} transaÃ§Ãµes carregadas`);
    } catch (error) {
        console.error('Erro ao carregar transaÃ§Ãµes:', error);
        // NÃ£o mostra toast aqui para nÃ£o poluir - jÃ¡ mostra no catch principal
        transactions = []; // Garante array vazio
    }
}

// ðŸ›ï¸ Array global para armazenar serviÃ§os
let services = [];

// ðŸ“¦ FunÃ§Ã£o para carregar serviÃ§os
async function loadServices() {
    try {
        if (!activeUserId) {
            console.warn('activeUserId nÃ£o definido, pulando carregamento de serviÃ§os');
            return;
        }

        const snapshot = await db.collection('services')
            .where('userId', '==', activeUserId)
            .get();

        services = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${services.length} serviÃ§os carregados`);
    } catch (error) {
        console.error('Erro ao carregar serviÃ§os:', error);
        services = [];
    }
}

// ðŸ’° FunÃ§Ã£o para criar transaÃ§Ã£o a partir de serviÃ§o
async function createTransactionFromService(service) {
    try {
        // VerificaÃ§Ãµes de seguranÃ§a
        if (!service.value || service.value <= 0) {
            console.log('ServiÃ§o sem valor, ignorando:', service.id);
            return;
        }

        if (!service.userId || service.userId !== activeUserId) {
            console.log('ServiÃ§o nÃ£o pertence ao usuÃ¡rio ativo, ignorando:', service.id);
            return;
        }

        // Verificar se jÃ¡ existe transaÃ§Ã£o para este serviÃ§o
        const existingTransactions = await db.collection('transactions')
            .where('userId', '==', activeUserId)
            .where('serviceId', '==', service.id)
            .get();

        if (!existingTransactions.empty) {
            console.log('TransaÃ§Ã£o jÃ¡ existe para este serviÃ§o:', service.id);
            return;
        }

        // Extrair data do serviÃ§o (usar createdAt que estÃ¡ em formato ISO)
        let transactionDate;
        if (service.createdAt) {
            // createdAt estÃ¡ em formato ISO, extrair apenas a data
            transactionDate = service.createdAt.split('T')[0];
        } else {
            transactionDate = new Date().toISOString().split('T')[0];
        }

        // Criar transaÃ§Ã£o de entrada
        const transactionData = {
            userId: activeUserId,
            type: 'income',
            description: `ServiÃ§o: ${service.name || 'Sem nome'}`,
            value: parseFloat(service.value),
            category: 'Vendas',
            date: transactionDate,
            paymentMethod: 'debit',
            cardId: null,
            serviceId: service.id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('transactions').add(transactionData);
        console.log('âœ… TransaÃ§Ã£o criada para serviÃ§o:', service.id, 'Data:', transactionDate);

        // Recarregar transaÃ§Ãµes
        await loadTransactions();
        updateAllDisplays();

    } catch (error) {
        console.error('Erro ao criar transaÃ§Ã£o de serviÃ§o:', error);
    }
}

// ðŸ‘‚ Listener em tempo real para serviÃ§os
let servicesListener = null;

function startServicesListener() {
    if (!activeUserId) {
        console.warn('activeUserId nÃ£o definido, nÃ£o iniciando listener de serviÃ§os');
        return;
    }

    // Parar listener anterior se existir
    if (servicesListener) {
        servicesListener();
    }

    servicesListener = db.collection('services')
        .where('userId', '==', activeUserId)
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                const service = { id: change.doc.id, ...change.doc.data() };

                // Criar transaÃ§Ã£o quando serviÃ§o for adicionado ou modificado
                if (change.type === 'added' || change.type === 'modified') {
                    createTransactionFromService(service);
                }
            });
        });

    console.log('Listener de serviÃ§os iniciado');
}

// ðŸ•°ï¸ Processar serviÃ§os histÃ³ricos (executar uma vez apÃ³s implementaÃ§Ã£o)
async function processHistoricalServices() {
    if (!activeUserId) return;

    console.log('Processando serviÃ§os histÃ³ricos...');

    const servicesSnapshot = await db.collection('services')
        .where('userId', '==', activeUserId)
        .get();

    console.log(`${servicesSnapshot.size} serviÃ§os encontrados`);

    for (const doc of servicesSnapshot.docs) {
        const service = { id: doc.id, ...doc.data() };
        await createTransactionFromService(service);
    }

    console.log('âœ… Processamento de serviÃ§os histÃ³ricos concluÃ­do');
}

// ðŸ“² Processa envio do formulÃ¡rio de transaÃ§Ã£o (criar/editar)
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

    // Validar cartÃ£o de crÃ©dito se for transaÃ§Ã£o no crÃ©dito (tanto saÃ­da quanto entrada/reembolso)
    let selectedCardId = null;
    let selectedCard = null;
    if (currentPaymentMethod === 'credit') {
        selectedCardId = document.getElementById('transactionCard').value;
        if (!selectedCardId) {
            showToast('Selecione um cartÃ£o de crÃ©dito', 'error');
            return;
        }
        // Validar que o cartÃ£o existe
        selectedCard = creditCards.find(c => c.id === selectedCardId);
        if (!selectedCard) {
            console.error('âŒ CartÃ£o selecionado nÃ£o encontrado:', selectedCardId);
            showToast('CartÃ£o invÃ¡lido. Recarregue a pÃ¡gina e tente novamente', 'error');
            return;
        }

        // âš ï¸ Validar se a data estÃ¡ dentro do perÃ­odo da fatura
        // Fatura aberta: DIA (closingDay+1) do MÃŠS ANTERIOR atÃ© DIA FECHAMENTO do MÃŠS ATUAL
        const transactionDate = new Date(date + 'T12:00:00');
        const today = new Date();
        const currentMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : today.getMonth();
        const currentYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : today.getFullYear();

        let billStartDate, billEndDate;

        // Verificar se estÃ¡ navegando para um mÃªs diferente do atual
        const isNavigating = (currentMonth !== today.getMonth() || currentYear !== today.getFullYear());

        if (isNavigating) {
            // Navegando: fatura aberta no mÃªs visualizado
            let prevMonth = currentMonth - 1;
            let prevYear = currentYear;
            if (prevMonth < 0) {
                prevMonth = 11;
                prevYear--;
            }
            billStartDate = new Date(prevYear, prevMonth, selectedCard.closingDay + 1);
            billEndDate = new Date(currentYear, currentMonth, selectedCard.closingDay);
        } else {
            // MÃªs atual: verificar se jÃ¡ passou do fechamento
            if (today.getDate() < selectedCard.closingDay) {
                // Fatura aberta Ã© do mÃªs atual
                billStartDate = new Date(currentYear, currentMonth - 1, selectedCard.closingDay + 1);
                billEndDate = new Date(currentYear, currentMonth, selectedCard.closingDay);
                if (currentMonth === 0) {
                    billStartDate = new Date(currentYear - 1, 11, selectedCard.closingDay + 1);
                }
            } else {
                // Fatura aberta Ã© do prÃ³ximo mÃªs
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

        // Avisar se a data estÃ¡ fora do perÃ­odo
        if (transactionDate < billStartDate || transactionDate > billEndDate) {
            const startStr = billStartDate.toLocaleDateString('pt-BR');
            const endStr = billEndDate.toLocaleDateString('pt-BR');
            const warningMsg = `âš ï¸ ATENÃ‡ÃƒO: A data (${new Date(date).toLocaleDateString('pt-BR')}) estÃ¡ FORA do perÃ­odo da fatura de "${selectedCard.name}" (${startStr} a ${endStr}). A transaÃ§Ã£o nÃ£o aparecerÃ¡ na fatura! Deseja continuar?`;

            console.warn(`âš ï¸ [DATA FORA DO PERÃODO] TransaÃ§Ã£o de ${date} para cartÃ£o "${selectedCard.name}"`);

            if (!confirm(warningMsg)) {
                return;
            }
        }
    }

    const value = parseCurrencyInput(valueStr);
    if (value <= 0) {
        showToast('Valor invÃ¡lido', 'error');
        return;
    }

    showLoading(editingTransactionId ? 'Atualizando transaÃ§Ã£o...' : 'Salvando transaÃ§Ã£o...');

    try {
        const transactionData = {
            userId: activeUserId,
            type: currentTransactionType,
            description,
            value,
            category,
            date
        };

        // Adicionar informaÃ§Ãµes de pagamento (para despesas e reembolsos no crÃ©dito)
        transactionData.paymentMethod = currentPaymentMethod;
        if (currentPaymentMethod === 'credit' && selectedCardId) {
            transactionData.cardId = selectedCardId;
            console.log(`ðŸ“ [handleTransactionSubmit] Salvando transaÃ§Ã£o no cartÃ£o:`, selectedCardId, 'Nome:', creditCards.find(c => c.id === selectedCardId)?.name);
        }

        if (editingTransactionId) {
            // Editando transaÃ§Ã£o existente
            console.log(`âœï¸ Atualizando transaÃ§Ã£o ID: ${editingTransactionId}`);
            await db.collection('transactions').doc(editingTransactionId).update({
                ...transactionData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('TransaÃ§Ã£o atualizada com sucesso', 'success');
        } else {
            // Criando nova transaÃ§Ã£o
            console.log(`âœ¨ Criando nova transaÃ§Ã£o:`, { description, type: currentTransactionType, paymentMethod: currentPaymentMethod, cardId: selectedCardId });
            await db.collection('transactions').add({
                ...transactionData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('TransaÃ§Ã£o adicionada com sucesso', 'success');
        }

        await loadTransactions();
        updateAllDisplays();
        closeTransactionModal();
    } catch (error) {
        console.error('Erro ao salvar transaÃ§Ã£o:', error);
        showToast('Erro ao salvar transaÃ§Ã£o', 'error');
    } finally {
        hideLoading();
    }
}

// ðŸ—„ï¸ Deleta uma transaÃ§Ã£o do Firestore
async function deleteTransaction(id) {
    if (!confirm('Deseja realmente deletar esta transaÃ§Ã£o?')) return;

    showLoading('Deletando...');

    try {
        await db.collection('transactions').doc(id).delete();
        await loadTransactions();
        updateAllDisplays();
        showToast('TransaÃ§Ã£o deletada com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao deletar transaÃ§Ã£o:', error);
        showToast('Erro ao deletar transaÃ§Ã£o', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// SUBSCRIPTIONS CRUD
// ===========================
// ðŸ—„ï¸ Carrega todas as assinaturas do Firestore
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

// ðŸ“² Processa envio do formulÃ¡rio de assinatura (criar/editar)
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
        showToast('Valor invÃ¡lido', 'error');
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

// ðŸ—„ï¸ Deleta uma assinatura do Firestore
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
// ðŸ”„ Migra parcelamentos antigos adicionando startMonth e startYear
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
            // Calcular o mÃªs de inÃ­cio baseado em currentInstallment ou paidInstallments
            const current = inst.currentInstallment || (inst.paidInstallments ? inst.paidInstallments + 1 : 1);

            // Se a parcela atual Ã© X, significa que comeÃ§ou hÃ¡ (X - 1) meses atrÃ¡s
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
        console.log('[migrateOldInstallments] MigraÃ§Ã£o concluÃ­da!');
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
// ðŸ—„ï¸ Carrega todos os parcelamentos do Firestore
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

// ðŸ”„ Corrige startMonth de parcelamentos com dados inconsistentes
async function fixInstallmentsStartMonth() {
    try {
        const displayMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
        const displayYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();

        console.log(`\nðŸ” [MIGRAÃ‡ÃƒO] Verificando parcelamentos... (ref: mÃªs ${displayMonth + 1}/${displayYear})`);

        const toFix = installments.filter(inst => {
            // Verifica se precisa correÃ§Ã£o: se startMonth estÃ¡ definido mas parece errado
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

            // Se estÃ¡ diferente, precisa corrigir
            const needsFix = (inst.startMonth !== correctStartMonth || inst.startYear !== correctStartYear);

            if (needsFix) {
                console.log(`   ðŸ”§ "${inst.description}": ${inst.startMonth + 1}/${inst.startYear} â†’ ${correctStartMonth + 1}/${correctStartYear} (parcela ${inst.currentInstallment}/${inst.totalInstallments})`);
            }

            return needsFix;
        });

        if (toFix.length === 0) {
            console.log(`   âœ… Todos os parcelamentos estÃ£o corretos!\n`);
            return;
        }

        console.log(`\nðŸ”§ Corrigindo ${toFix.length} parcelamentos com startMonth incorreto...`);

        for (const inst of toFix) {
            const monthsBack = inst.currentInstallment - 1;
            let startMonth = displayMonth - monthsBack;
            let startYear = displayYear;

            while (startMonth < 0) {
                startMonth += 12;
                startYear--;
            }

            console.log(`   Corrigindo "${inst.description}": ${inst.startMonth + 1}/${inst.startYear} â†’ ${startMonth + 1}/${startYear}`);

            await db.collection('installments').doc(inst.id).update({
                startMonth,
                startYear,
                migratedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Atualizar no array local
            inst.startMonth = startMonth;
            inst.startYear = startYear;
        }

        console.log(`âœ… ${toFix.length} parcelamentos corrigidos!\n`);
    } catch (error) {
        console.error('Erro ao corrigir parcelamentos:', error);
    }
}

// ðŸ”„ Calcula qual parcela estÃ¡ ativa baseada no mÃªs/ano de referÃªncia
function calculateCurrentInstallment(installment, targetMonth = null, targetYear = null) {
    // Fallback para valor salvo ou paidInstallments (para parcelamentos antigos)
    const savedCurrent = installment.currentInstallment || (installment.paidInstallments ? installment.paidInstallments + 1 : 1);

    // Se nÃ£o tem startMonth/startYear, usar valor salvo
    if (installment.startMonth === undefined || installment.startYear === undefined) {
        return savedCurrent;
    }

    // Usar mÃªs/ano informado, senÃ£o usar display global, senÃ£o usar data atual
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

    // Calcular quantos meses se passaram desde o inÃ­cio
    const monthsDiff = (refYear - installment.startYear) * 12 + (refMonth - installment.startMonth);

    // Se ainda nÃ£o comeÃ§ou, retornar 1
    if (monthsDiff < 0) {
        return 1;
    }

    // Calcular parcela atual: parcela 1 no mÃªs de inÃ­cio + meses que se passaram
    const calculatedCurrent = 1 + monthsDiff;

    // NÃ£o ultrapassar o total de parcelas
    return Math.min(calculatedCurrent, installment.totalInstallments);
}

// ðŸ“² Processa envio do formulÃ¡rio de parcelamento (criar/editar)
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
        showToast('Valor invÃ¡lido', 'error');
        return;
    }

    if (totalInstallments < 2 || totalInstallments > 99) {
        showToast('Total de parcelas deve estar entre 2 e 99', 'error');
        return;
    }

    if (currentInstallment < 1 || currentInstallment > totalInstallments) {
        showToast('Parcela atual invÃ¡lida', 'error');
        return;
    }

    showLoading(editingInstallmentId ? 'Atualizando parcelamento...' : 'Salvando parcelamento...');

    try {
        // Usar mÃªs selecionado na navegaÃ§Ã£o ou mÃªs atual
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
            // Criar novo parcelamento - calcula mÃªs/ano de inÃ­cio baseado na parcela atual
            // Se estÃ¡ visualizando dezembro e na parcela 9, a parcela 1 foi 8 meses atrÃ¡s (abril)
            const monthsBack = currentInstallment - 1;
            let startMonth = displayMonth - monthsBack;
            let startYear = displayYear;

            // Ajusta ano se necessÃ¡rio (quando atravessa anos)
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

// ðŸ”„ Atualiza progresso da parcela atual de um parcelamento
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

// ðŸ—„ï¸ Deleta um parcelamento do Firestore
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
// ðŸ—„ï¸ Carrega todas as projeÃ§Ãµes do Firestore
async function loadProjections() {
    try {
        console.log('Carregando projeÃ§Ãµes...');
        const snapshot = await db.collection('projections')
            .where('userId', '==', activeUserId)
            .orderBy('date', 'asc')
            .get();

        projections = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${projections.length} projeÃ§Ãµes carregadas`);
    } catch (error) {
        console.error('Erro ao carregar projeÃ§Ãµes:', error);
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

// Verifica se uma fatura especÃ­fica estÃ¡ paga
function isBillPaid(cardId, month, year) {
    return creditCardPayments.find(p =>
        p.cardId === cardId &&
        p.month === month &&
        p.year === year
    );
}

// Marca uma fatura como paga (cria transaÃ§Ã£o automÃ¡tica)
async function markBillAsPaid(cardId, month, year, billAmount) {
    const card = creditCards.find(c => c.id === cardId);
    if (!card) {
        showToast('CartÃ£o nÃ£o encontrado', 'error');
        return;
    }

    // Verifica se jÃ¡ estÃ¡ paga
    if (isBillPaid(cardId, month, year)) {
        showToast('Esta fatura jÃ¡ estÃ¡ marcada como paga', 'warning');
        return;
    }

    showLoading('Registrando pagamento...');

    try {
        const monthNames = ['Janeiro', 'Fevereiro', 'MarÃ§o', 'Abril', 'Maio', 'Junho',
                            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // 1. Criar transaÃ§Ã£o de dÃ©bito automÃ¡tica
        const transactionRef = await db.collection('transactions').add({
            userId: activeUserId,
            type: 'expense',
            description: `Pagamento Fatura ${card.name} - ${monthNames[month]}/${year}`,
            value: billAmount,
            category: 'Fatura CartÃ£o',
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

        showToast('Fatura marcada como paga! TransaÃ§Ã£o de dÃ©bito criada.', 'success');

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
    if (!confirm('Deseja realmente desfazer este pagamento? A transaÃ§Ã£o de dÃ©bito serÃ¡ removida.')) {
        return;
    }

    const payment = creditCardPayments.find(p => p.id === paymentId);
    if (!payment) {
        showToast('Pagamento nÃ£o encontrado', 'error');
        return;
    }

    showLoading('Removendo pagamento...');

    try {
        // 1. Deletar transaÃ§Ã£o vinculada
        if (payment.transactionId) {
            await db.collection('transactions').doc(payment.transactionId).delete();
        }

        // 2. Deletar registro de pagamento
        await db.collection('creditCardPayments').doc(paymentId).delete();

        // 3. Recarregar dados
        await loadTransactions();
        await loadCreditCardPayments();
        updateAllDisplays();

        showToast('Pagamento desfeito! TransaÃ§Ã£o removida.', 'success');

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
        console.log('Carregando configuraÃ§Ãµes do usuÃ¡rio...');
        const doc = await db.collection('userSettings').doc(activeUserId).get();

        if (doc.exists) {
            userSettings = { ...userSettings, ...doc.data() };
        }

        console.log('ConfiguraÃ§Ãµes carregadas:', userSettings);
    } catch (error) {
        console.error('Erro ao carregar configuraÃ§Ãµes:', error);
        // MantÃ©m valores padrÃ£o
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
        showToast('ConfiguraÃ§Ãµes salvas!', 'success');
        return true;
    } catch (error) {
        console.error('Erro ao salvar configuraÃ§Ãµes:', error);
        showToast('Erro ao salvar configuraÃ§Ãµes', 'error');
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
        showToast('Valor invÃ¡lido', 'error');
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

        // Limpar formulÃ¡rio
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
        showToast('Investimento excluÃ­do!', 'success');
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
        showToast('Valores invÃ¡lidos', 'error');
        return;
    }

    showLoading('Salvando...');

    const success = await saveUserSettings({ savingsGoal, expenseLimit });

    if (success) {
        closeSettingsModal();
        initializeCharts(); // Atualizar grÃ¡ficos com novos valores
    }

    hideLoading();
}

// ðŸ“² Processa envio do formulÃ¡rio de projeÃ§Ã£o
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
        showToast('Valor invÃ¡lido', 'error');
        return;
    }

    showLoading(editingProjectionId ? 'Atualizando projeÃ§Ã£o...' : 'Salvando projeÃ§Ã£o...');

    try {
        if (editingProjectionId) {
            // Atualizar projeÃ§Ã£o existente
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
            showToast('ProjeÃ§Ã£o atualizada com sucesso', 'success');
        } else {
            // Criar nova projeÃ§Ã£o
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
            showToast('ProjeÃ§Ã£o adicionada com sucesso', 'success');
        }
    } catch (error) {
        console.error('Erro ao salvar projeÃ§Ã£o:', error);
        showToast('Erro ao salvar projeÃ§Ã£o', 'error');
    } finally {
        hideLoading();
    }
}

// ðŸ”„ Atualiza status de uma projeÃ§Ã£o
// Quando marca como "received", cria uma transaÃ§Ã£o correspondente (entrada ou despesa)
async function updateProjectionStatus(id, newStatus) {
    showLoading('Atualizando status...');

    try {
        const projection = projections.find(p => p.id === id);
        if (!projection) {
            showToast('ProjeÃ§Ã£o nÃ£o encontrada', 'error');
            return;
        }

        const oldStatus = projection.status;
        const projType = projection.type || 'income'; // default: income para projeÃ§Ãµes antigas
        console.log(`[ProjeÃ§Ã£o Status] ID: ${id}, Tipo: ${projType}, Status anterior: ${oldStatus}, Novo status: ${newStatus}`);

        // Se marcando como "received" (ou "pago" para expense), criar transaÃ§Ã£o
        if (newStatus === 'received' && oldStatus !== 'received') {
            console.log(`[ProjeÃ§Ã£o] Procurando transaÃ§Ã£o vinculada a: "${projection.description}"`);

            // Verificar se jÃ¡ existe transaÃ§Ã£o vinculada a esta projeÃ§Ã£o
            let existingTransaction = transactions.find(t => t.projectionId === id);

            // Fallback: procurar por descriÃ§Ã£o, data, valor e categoria
            if (!existingTransaction) {
                const expectedType = projType === 'income' ? 'income' : 'expense';
                const expectedCategory = projType === 'income' ? 'ProjeÃ§Ã£o Recebida' : 'ProjeÃ§Ã£o Paga';
                existingTransaction = transactions.find(t =>
                    t.type === expectedType &&
                    t.category === expectedCategory &&
                    t.date === projection.date &&
                    t.value === projection.value &&
                    (t.description === projection.description || t.description === `[ProjeÃ§Ã£o] ${projection.description}`)
                );
            }

            if (existingTransaction) {
                console.log(`[ProjeÃ§Ã£o] TransaÃ§Ã£o jÃ¡ existe: ${existingTransaction.id}`);
            } else {
                // Criar nova transaÃ§Ã£o baseada no tipo da projeÃ§Ã£o
                if (projType === 'income') {
                    console.log(`[ProjeÃ§Ã£o] Criando nova transaÃ§Ã£o de ENTRADA para: "${projection.description}"`);
                    const newTransaction = {
                        userId: activeUserId,
                        type: 'income',
                        description: `[ProjeÃ§Ã£o] ${projection.description}`,
                        value: projection.value,
                        category: 'ProjeÃ§Ã£o Recebida',
                        date: projection.date,
                        paymentMethod: 'debit',
                        cardId: null,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        projectionId: id
                    };
                    const docRef = await db.collection('transactions').add(newTransaction);
                    console.log(`[ProjeÃ§Ã£o] TransaÃ§Ã£o de entrada criada com sucesso: ${docRef.id}`);
                } else {
                    console.log(`[ProjeÃ§Ã£o] Criando nova transaÃ§Ã£o de SAÃDA para: "${projection.description}"`);
                    const newTransaction = {
                        userId: activeUserId,
                        type: 'expense',
                        description: `[ProjeÃ§Ã£o] ${projection.description}`,
                        value: projection.value,
                        category: 'ProjeÃ§Ã£o Paga',
                        date: projection.date,
                        paymentMethod: 'debit',
                        cardId: null,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        projectionId: id
                    };
                    const docRef = await db.collection('transactions').add(newTransaction);
                    console.log(`[ProjeÃ§Ã£o] TransaÃ§Ã£o de despesa criada com sucesso: ${docRef.id}`);
                }
            }
        }
        // Se marcando como "pending", remover transaÃ§Ã£o vinculada (se houver)
        else if (newStatus === 'pending' && oldStatus === 'received') {
            console.log(`[ProjeÃ§Ã£o] Procurando transaÃ§Ã£o vinculada para deletar`);

            // Procurar e deletar transaÃ§Ã£o vinculada
            let linkedTransaction = transactions.find(t => t.projectionId === id);

            // Fallback: procurar por descriÃ§Ã£o, data, valor e categoria
            if (!linkedTransaction) {
                const expectedType = projType === 'income' ? 'income' : 'expense';
                const expectedCategory = projType === 'income' ? 'ProjeÃ§Ã£o Recebida' : 'ProjeÃ§Ã£o Paga';
                linkedTransaction = transactions.find(t =>
                    t.type === expectedType &&
                    t.category === expectedCategory &&
                    t.date === projection.date &&
                    t.value === projection.value &&
                    (t.description === projection.description || t.description === `[ProjeÃ§Ã£o] ${projection.description}`)
                );
            }

            if (linkedTransaction) {
                console.log(`[ProjeÃ§Ã£o] Deletando transaÃ§Ã£o: ${linkedTransaction.id}`);
                await db.collection('transactions').doc(linkedTransaction.id).delete();
            } else {
                console.log(`[ProjeÃ§Ã£o] Nenhuma transaÃ§Ã£o vinculada encontrada`);
            }
        }

        // Atualizar status da projeÃ§Ã£o
        console.log(`[ProjeÃ§Ã£o] Atualizando status no Firestore para: ${newStatus}`);
        await db.collection('projections').doc(id).update({ status: newStatus });

        // Recarregar dados e atualizar displays
        console.log(`[ProjeÃ§Ã£o] Recarregando dados...`);
        await loadTransactions();
        await loadProjections();

        console.log(`[ProjeÃ§Ã£o] Atualizando KPIs...`);
        updateAllDisplays();

        let message;
        if (projType === 'income') {
            message = newStatus === 'received'
                ? 'ProjeÃ§Ã£o marcada como recebida! TransaÃ§Ã£o de entrada criada.'
                : 'ProjeÃ§Ã£o marcada como pendente. TransaÃ§Ã£o removida.';
        } else {
            message = newStatus === 'received'
                ? 'ProjeÃ§Ã£o marcada como paga! TransaÃ§Ã£o de despesa criada.'
                : 'ProjeÃ§Ã£o marcada como pendente. TransaÃ§Ã£o removida.';
        }
        showToast(message, 'success');
    } catch (error) {
        console.error('Erro ao atualizar projeÃ§Ã£o:', error);
        showToast('Erro ao atualizar status', 'error');
    } finally {
        hideLoading();
    }
}

// ðŸ—„ï¸ Deleta uma projeÃ§Ã£o do Firestore
async function deleteProjection(id) {
    if (!confirm('Deseja realmente deletar esta projeÃ§Ã£o?')) return;

    showLoading('Deletando...');

    try {
        await db.collection('projections').doc(id).delete();
        await loadProjections();
        updateAllDisplays();
        showToast('ProjeÃ§Ã£o deletada com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao deletar projeÃ§Ã£o:', error);
        showToast('Erro ao deletar projeÃ§Ã£o', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// CREDIT CARDS - LOAD & RENDER
// ===========================
// ðŸ—„ï¸ Carrega todos os cartÃµes de crÃ©dito do Firestore
async function loadCreditCards() {
    try {
        console.log('Carregando cartÃµes de crÃ©dito...');
        const snapshot = await db.collection('creditCards')
            .where('userId', '==', activeUserId)
            .orderBy('createdAt', 'desc')
            .get();

        creditCards = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${creditCards.length} cartÃµes carregados`);
        await loadCardExpenses();
    } catch (error) {
        console.error('Erro ao carregar cartÃµes:', error);
        creditCards = [];
    }
}

// ðŸ—„ï¸ Carrega gastos avulsos de cartÃµes de crÃ©dito
async function loadCardExpenses() {
    try {
        const snapshot = await db.collection('cardExpenses')
            .where('userId', '==', activeUserId)
            .get();

        cardExpenses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${cardExpenses.length} gastos de cartÃ£o carregados`);
    } catch (error) {
        console.error('Erro ao carregar gastos:', error);
        cardExpenses = [];
    }
}

// Contador de chamadas (para debug)
let calculateBillCallCount = 0;

// ðŸ”„ Calcula valor total da fatura do cartÃ£o para o mÃªs especificado
function calculateCurrentBill(card, overrideMonth = null, overrideYear = null) {
    calculateBillCallCount++;
    console.log(`\nðŸ” [CHAMADA #${calculateBillCallCount}] calculateCurrentBill("${card.name}")`);

    const today = new Date();
    // Usar mÃªs/ano passados como parÃ¢metro, ou mÃªs selecionado no display, ou mÃªs atual
    const currentMonth = overrideMonth !== null ? overrideMonth :
                        (typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : today.getMonth());
    const currentYear = overrideYear !== null ? overrideYear :
                       (typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : today.getFullYear());

    // Determinar perÃ­odo da fatura
    let billStartDate, billEndDate, billMonth, billYear;

    // Se estÃ¡ navegando para um mÃªs DIFERENTE do mÃªs atual
    // Comparar o mÃªs/ano calculados com o dia de hoje
    const isNavigating = (currentMonth !== today.getMonth() || currentYear !== today.getFullYear());

    if (isNavigating) {
        // Navegando entre meses: mostrar fatura ABERTA no mÃªs visualizado
        // Fatura aberta = perÃ­odo que estÃ¡ sendo construÃ­do no mÃªs
        // DIA (closingDay+1) do MÃŠS ANTERIOR atÃ© DIA FECHAMENTO do MÃŠS ATUAL
        // Se visualiza dezembro (mÃªs 11) com closingDay 20: 21/novembro atÃ© 20/dezembro
        // Se visualiza dezembro (mÃªs 11) com closingDay 2: 03/novembro atÃ© 02/dezembro
        let prevMonth = currentMonth - 1;
        let prevYear = currentYear;
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear--;
        }
        billStartDate = new Date(prevYear, prevMonth, card.closingDay + 1);    // Dia apÃ³s fechamento do mÃªs anterior
        billEndDate = new Date(currentYear, currentMonth, card.closingDay);      // Dia de fechamento do mÃªs atual

        billMonth = currentMonth;
        billYear = currentYear;
    } else {
        // MÃªs atual (real-time): usar lÃ³gica baseada no dia de fechamento
        // Se hoje Ã© 09/12 e fechamento Ã© 20: fatura aberta Ã© de 21/11 atÃ© 20/12
        // Se hoje Ã© 09/12 e fechamento Ã© 2: fatura aberta Ã© de 03/12 atÃ© 02/01 (jÃ¡ passou!)

        if (today.getDate() < card.closingDay) {
            // Ainda estamos no perÃ­odo: DIA (closingDay+1)/(mÃªs-1) atÃ© dia_fechamento/mÃªs
            billStartDate = new Date(currentYear, currentMonth - 1, card.closingDay + 1);    // Dia apÃ³s fechamento anterior
            billEndDate = new Date(currentYear, currentMonth, card.closingDay);           // Dia de fechamento deste mÃªs
            billMonth = currentMonth;
            billYear = currentYear;

            // Ajustar se estiver em janeiro
            if (currentMonth === 0) {
                billStartDate = new Date(currentYear - 1, 11, card.closingDay + 1); // Dia apÃ³s fechamento no dezembro anterior
            }
        } else {
            // JÃ¡ passou do fechamento: DIA (closingDay+1)/mÃªs atÃ© dia_fechamento/(mÃªs+1)
            billStartDate = new Date(currentYear, currentMonth, card.closingDay + 1);      // Dia apÃ³s fechamento deste mÃªs
            let nextMonth = currentMonth + 1;
            let nextYear = currentYear;
            if (nextMonth > 11) {
                nextMonth = 0;
                nextYear++;
            }
            billEndDate = new Date(nextYear, nextMonth, card.closingDay);        // Dia de fechamento do prÃ³ximo mÃªs
            // billMonth Ã© SEMPRE o mÃªs atual para cÃ¡lculo de parcelamentos
            billMonth = currentMonth;
            billYear = currentYear;
        }
    }

    // Somar gastos do perÃ­odo (cardExpenses antigos + transaÃ§Ãµes de crÃ©dito)
    const expensesTotal = cardExpenses
        .filter(expense => {
            if (expense.cardId !== card.id) return false;
            const expenseDate = new Date(expense.date);
            return expenseDate >= billStartDate && expenseDate <= billEndDate;
        })
        .reduce((sum, expense) => sum + expense.value, 0);

    // Somar transaÃ§Ãµes de crÃ©dito do perÃ­odo (saÃ­das e reembolsos)
    const transactionsInPeriod = transactions.filter(t => {
        if (t.paymentMethod !== 'credit' || t.cardId !== card.id) return false;
        const transactionDate = new Date(t.date + 'T12:00:00');

        if (isNavigating) {
            // Ao navegar, mostrar apenas transaÃ§Ãµes do mÃªs visualizado
            return transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;
        } else {
            // Modo real-time: usar o perÃ­odo da fatura
            return transactionDate >= billStartDate && transactionDate <= billEndDate;
        }
    });

    const creditTransactionsTotal = transactionsInPeriod.reduce((sum, t) => {
        // Expense soma, income subtrai (reembolso)
        return sum + (t.type === 'expense' ? t.value : -t.value);
    }, 0);

    // Log das transaÃ§Ãµes incluÃ­das
    if (transactionsInPeriod.length > 0) {
        console.log(`   TransaÃ§Ãµes no perÃ­odo: ${transactionsInPeriod.length}`);
        transactionsInPeriod.forEach(t => {
            const tDate = new Date(t.date + 'T12:00:00');
            console.log(`     ${t.type === 'expense' ? '+' : '-'} ${t.description} em ${tDate.toLocaleDateString('pt-BR')}`);
        });
    }

    // Log simples do perÃ­odo e dados da fatura
    console.log(`ðŸ“… [FATURA ${card.name}] MÃªs: ${billMonth + 1}/${billYear}`);
    console.log(`   PerÃ­odo: ${billStartDate.toLocaleDateString('pt-BR')} atÃ© ${billEndDate.toLocaleDateString('pt-BR')}`);
    console.log(`   isNavigating: ${isNavigating}`);
    console.log(`   TransaÃ§Ãµes de crÃ©dito incluÃ­das: R$ ${creditTransactionsTotal.toFixed(2)}`);

    // Somar parcelas ativas deste cartÃ£o no mÃªs da fatura
    const installmentsFiltered = installments.filter(inst => {
        if (inst.cardId !== card.id) return false;

        // Para parcelamentos antigos sem startMonth/startYear, usar lÃ³gica antiga
        if (inst.startMonth === undefined || inst.startYear === undefined) {
            return inst.currentInstallment <= inst.totalInstallments;
        }

        // Calcular quantos meses se passaram desde o inÃ­cio do parcelamento (parcela 1)
        const monthsSinceStart = (billYear - inst.startYear) * 12 + (billMonth - inst.startMonth);

        // Se o mÃªs da fatura Ã© antes do inÃ­cio do parcelamento, nÃ£o incluir
        if (monthsSinceStart < 0) {
            return false;
        }

        // Calcular qual parcela estÃ¡ vencendo neste mÃªs
        // startMonth Ã© o mÃªs da PARCELA 1, entÃ£o:
        // parcela deste mÃªs = 1 + meses desde o inÃ­cio
        const installmentForThisMonth = 1 + monthsSinceStart;

        const installmentValue = inst.totalValue / inst.totalInstallments;
        const isValid = installmentForThisMonth >= 1 && installmentForThisMonth <= inst.totalInstallments;

        return isValid;
    });

    const installmentsTotal = installmentsFiltered.reduce((sum, inst) => {
        const installmentValue = inst.installmentValue || (inst.totalValue / inst.totalInstallments);
        return sum + installmentValue;
    }, 0);

    // Somar assinaturas ativas deste cartÃ£o
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
// ðŸŽ¨ Abre modal para adicionar/editar cartÃ£o de crÃ©dito
function openCreditCardModal() {
    editingCardId = null;
    document.getElementById('creditCardModal').classList.add('active');
    document.getElementById('creditCardForm').reset();
    document.querySelector('#creditCardModal .modal-header h2').textContent = 'Novo CartÃ£o de CrÃ©dito';
}

// ðŸŽ¨ Fecha modal de cartÃ£o de crÃ©dito
function closeCreditCardModal() {
    editingCardId = null;
    document.getElementById('creditCardModal').classList.remove('active');
    document.getElementById('creditCardForm').reset();
}

// ðŸŽ¨ Exibe detalhes completos da fatura do cartÃ£o em modal
function showCardBillDetails(cardId) {
    const card = creditCards.find(c => c.id === cardId);
    if (!card) return;

    const today = new Date();
    const currentMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : today.getMonth();
    const currentYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : today.getFullYear();

    // Calcular perÃ­odo da fatura (mesmo cÃ¡lculo do calculateCurrentBill)
    // Se estÃ¡ navegando para um mÃªs diferente do atual
    const isNavigating = (currentMonth !== today.getMonth() || currentYear !== today.getFullYear());

    let billStartDate, billEndDate, billMonth, billYear;

    if (isNavigating) {
        // Navegando: mostrar fatura ABERTA no mÃªs visualizado
        // DIA (closingDay+1) do MÃŠS ANTERIOR atÃ© DIA FECHAMENTO do MÃŠS ATUAL
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
            // Fatura aberta Ã© do prÃ³ximo mÃªs (perÃ­odo), mas billMonth Ã© sempre currentMonth
            billStartDate = new Date(currentYear, currentMonth, card.closingDay + 1);
            let nextMonth = currentMonth + 1;
            let nextYear = currentYear;
            if (nextMonth > 11) {
                nextMonth = 0;
                nextYear++;
            }
            billEndDate = new Date(nextYear, nextMonth, card.closingDay);
            // billMonth Ã© SEMPRE o mÃªs atual para cÃ¡lculo de parcelamentos
            billMonth = currentMonth;
            billYear = currentYear;
        } else {
            // Fatura aberta Ã© do mÃªs atual
            billStartDate = new Date(currentYear, currentMonth - 1, card.closingDay + 1);
            billEndDate = new Date(currentYear, currentMonth, card.closingDay);
            billMonth = currentMonth;
            billYear = currentYear;
            if (currentMonth === 0) {
                billStartDate = new Date(currentYear - 1, 11, card.closingDay + 1);
            }
        }
    }

    // CorreÃ§Ã£o 8: Filtrar transaÃ§Ãµes pelo mÃªs correto quando navegando
    const creditExpenses = transactions.filter(t => {
        if (t.type !== 'expense' || t.paymentMethod !== 'credit' || t.cardId !== card.id) return false;
        const transactionDate = new Date(t.date + 'T12:00:00');

        if (isNavigating) {
            // Ao navegar, mostrar apenas transaÃ§Ãµes do mÃªs visualizado
            return transactionDate.getMonth() === currentMonth &&
                   transactionDate.getFullYear() === currentYear;
        } else {
            // Modo real-time: usar perÃ­odo da fatura
            return transactionDate >= billStartDate && transactionDate <= billEndDate;
        }
    });

    const creditRefunds = transactions.filter(t => {
        if (t.type !== 'income' || t.paymentMethod !== 'credit' || t.cardId !== card.id) return false;
        const transactionDate = new Date(t.date + 'T12:00:00');

        if (isNavigating) {
            // Ao navegar, mostrar apenas transaÃ§Ãµes do mÃªs visualizado
            return transactionDate.getMonth() === currentMonth &&
                   transactionDate.getFullYear() === currentYear;
        } else {
            // Modo real-time: usar perÃ­odo da fatura
            return transactionDate >= billStartDate && transactionDate <= billEndDate;
        }
    });

    // Coletar parcelas do perÃ­odo
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

    // Verificar se a fatura estÃ¡ paga
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
                        <div>PerÃ­odo: ${billStartDate.toLocaleDateString('pt-BR')} a ${billEndDate.toLocaleDateString('pt-BR')}</div>
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
                    Compras (${creditExpenses.length}) ${creditRefunds.length > 0 ? `â€¢ Reembolsos (${creditRefunds.length})` : ''}
                    <span style="margin-left: auto; font-size: 0.75rem;">${formatCurrencyDisplay(creditExpensesTotal - creditRefundsTotal)}</span>
                </h3>
                <div style="background: var(--color-bg-tertiary); border-radius: 8px; border: 1px solid var(--color-border); overflow-y: auto; flex: 1; max-height: 400px;">
                    ${creditExpenses.length === 0 && creditRefunds.length === 0
                        ? '<div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.875rem;">Nenhuma transaÃ§Ã£o</div>'
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
                                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.25rem;">${new Date(t.date).toLocaleDateString('pt-BR')} â€¢ Reembolso</div>
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
// ðŸ“² Processa envio do formulÃ¡rio de cartÃ£o de crÃ©dito
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
        showToast('Limite invÃ¡lido', 'error');
        return;
    }

    if (closingDay < 1 || closingDay > 31 || dueDay < 1 || dueDay > 31) {
        showToast('Dias devem estar entre 1 e 31', 'error');
        return;
    }

    showLoading(editingCardId ? 'Atualizando cartÃ£o...' : 'Salvando cartÃ£o...');

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
            showToast('CartÃ£o atualizado com sucesso', 'success');
        } else {
            await db.collection('creditCards').add({
                ...cardData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('CartÃ£o adicionado com sucesso', 'success');
        }

        await loadCreditCards();
        updateAllDisplays();
        closeCreditCardModal();
    } catch (error) {
        console.error('Erro ao salvar cartÃ£o:', error);
        showToast('Erro ao salvar cartÃ£o', 'error');
    } finally {
        hideLoading();
    }
}

// ðŸ“² Processa envio de gasto avulso no cartÃ£o (sistema antigo)
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
        showToast('Valor invÃ¡lido', 'error');
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

// ðŸ—„ï¸ Deleta um cartÃ£o de crÃ©dito do Firestore
async function deleteCreditCard(id) {
    if (!confirm('Deseja realmente deletar este cartÃ£o? Todos os gastos associados serÃ£o mantidos.')) return;

    showLoading('Deletando...');

    try {
        await db.collection('creditCards').doc(id).delete();
        await loadCreditCards();
        updateAllDisplays();
        showToast('CartÃ£o deletado com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao deletar cartÃ£o:', error);
        showToast('Erro ao deletar cartÃ£o', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// INSTALLMENT HELPER FUNCTIONS
// ===========================
// ðŸ”„ Verifica se um parcelamento estÃ¡ ativo em determinado mÃªs
function isInstallmentActiveInMonth(installment, targetMonth, targetYear) {
    // Para parcelamentos antigos sem startMonth/startYear, usar valor salvo
    if (installment.startMonth === undefined || installment.startYear === undefined) {
        const savedCurrent = installment.currentInstallment || (installment.paidInstallments ? installment.paidInstallments + 1 : 1);
        return savedCurrent <= installment.totalInstallments;
    }

    // Calcular quantos meses se passaram desde o inÃ­cio atÃ© o mÃªs alvo
    const monthsDiff = (targetYear - installment.startYear) * 12 + (targetMonth - installment.startMonth);

    // Se o mÃªs selecionado Ã© antes do inÃ­cio, nÃ£o mostrar
    if (monthsDiff < 0) {
        return false;
    }

    // Calcular qual parcela estaria sendo cobrada no mÃªs selecionado
    // Parcela 1 no mÃªs de inÃ­cio, entÃ£o: 1 + meses que se passaram
    const calculatedInstallment = 1 + monthsDiff;

    // SÃ³ mostrar se a parcela calculada ainda estÃ¡ dentro do total
    return calculatedInstallment <= installment.totalInstallments;
}

// ===========================
// KPI CALCULATIONS
// ===========================
// ðŸ”„ Atualiza todos os indicadores (KPIs) do dashboard
function updateKPIs() {
    // Usar mÃªs selecionado se disponÃ­vel, senÃ£o mÃªs atual
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

    // Total Income (current month) - exclui reembolsos no crÃ©dito
    const totalIncome = currentMonthTransactions
        .filter(t => t.type === 'income' && t.paymentMethod !== 'credit')
        .reduce((sum, t) => sum + t.value, 0);

    // Total Expense (current month) - apenas dÃ©bito direto (crÃ©dito Ã© contado na fatura do cartÃ£o)
    // NOTA: Isso jÃ¡ inclui pagamentos de fatura (que sÃ£o transaÃ§Ãµes de dÃ©bito automÃ¡ticas)
    const totalExpenseDebit = currentMonthTransactions
        .filter(t => t.type === 'expense' && t.paymentMethod !== 'credit')
        .reduce((sum, t) => sum + t.value, 0);

    // Total Credit Cards (current bills) - calculado antes para usar no totalExpense
    console.log(`\nðŸ’³ðŸ’³ðŸ’³ Calculando TOTAL de faturas de ${creditCards.length} cartÃµes:`);
    const totalCreditCards = creditCards.reduce((sum, card) => {
        const billValue = calculateCurrentBill(card, currentMonth, currentYear);
        console.log(`   ðŸ“Œ "${card.name}": R$ ${billValue.toFixed(2)}`);
        return sum + billValue;
    }, 0);
    console.log(`   ðŸ§¾ SOMA TOTAL DAS FATURAS: R$ ${totalCreditCards.toFixed(2)}\n`);

    // Calcular faturas pagas e nÃ£o pagas do mÃªs atual
    const paidBillsThisMonth = creditCardPayments.filter(p =>
        p.month === currentMonth && p.year === currentYear
    );
    const totalPaidBills = paidBillsThisMonth.reduce((sum, p) => sum + (p.paidAmount || 0), 0);

    // Faturas nÃ£o pagas = Total das faturas - Faturas que jÃ¡ foram pagas
    // Calculamos para cada cartÃ£o se a fatura do mÃªs estÃ¡ paga
    const totalUnpaidBills = creditCards.reduce((sum, card) => {
        const billValue = calculateCurrentBill(card, currentMonth, currentYear);
        const isPaid = isBillPaid(card.id, currentMonth, currentYear);
        return sum + (isPaid ? 0 : billValue);
    }, 0);

    // ProjeÃ§Ãµes de saÃ­da pendentes do mÃªs atual
    const pendingExpenseProjections = projections
        .filter(p => {
            if (p.status !== 'pending') return false;
            if (p.type !== 'expense') return false; // Apenas projeÃ§Ãµes de saÃ­da
            const projDate = new Date(p.date + 'T12:00:00');
            return projDate.getMonth() === currentMonth && projDate.getFullYear() === currentYear;
        })
        .reduce((sum, p) => sum + p.value, 0);

    // ProjeÃ§Ãµes de entrada pendentes do mÃªs atual
    const pendingIncomeProjections = projections
        .filter(p => {
            if (p.status !== 'pending') return false;
            // Aceita 'income' explÃ­cito ou ausÃªncia de type (compatibilidade)
            if (p.type && p.type !== 'income') return false;
            const projDate = new Date(p.date + 'T12:00:00');
            return projDate.getMonth() === currentMonth && projDate.getFullYear() === currentYear;
        })
        .reduce((sum, p) => sum + p.value, 0);

    // Total Expense = dÃ©bito (saÃ­das efetivas)
    // SaÃ­das Efetivas = dÃ©bito direto (jÃ¡ inclui pagamentos de faturas via transaÃ§Ã£o automÃ¡tica)
    const totalExpenseActual = totalExpenseDebit;

    // ProjeÃ§Ã£o de SaÃ­da = faturas nÃ£o pagas + projeÃ§Ãµes de saÃ­da pendentes
    const totalExpenseProjection = totalUnpaidBills + pendingExpenseProjections;

    // Total geral de saÃ­das (atual + projeÃ§Ã£o)
    const totalExpense = totalExpenseActual + totalExpenseProjection;

    // SALDO BANCÃRIO REAL = Entradas - SaÃ­das em dÃ©bito - Investimentos
    const totalIncomeAllTime = transactions
        .filter(t => t.type === 'income' && t.paymentMethod !== 'credit')
        .reduce((sum, t) => sum + t.value, 0);

    const totalDebitAllTime = transactions
        .filter(t => t.type === 'expense' && t.paymentMethod !== 'credit')
        .reduce((sum, t) => sum + t.value, 0);

    // Total de investimentos
    const totalInvestments = investments.reduce((sum, inv) => sum + inv.value, 0);

    // SALDO = Entradas - SaÃ­das(dÃ©bito) - Investimentos
    // NOTA: As saÃ­das de dÃ©bito jÃ¡ incluem pagamentos de fatura (via transaÃ§Ã£o automÃ¡tica)
    // EntÃ£o o saldo desconta automaticamente quando a fatura Ã© paga
    const totalBalance = totalIncomeAllTime - totalDebitAllTime - totalInvestments;

    // Log de debug para verificar cÃ¡lculos
    console.log('[KPIs] CÃ¡lculos do mÃªs:', {
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
        // Verifica se a parcela estÃ¡ ativa no mÃªs selecionado
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

    // Atualiza projeÃ§Ã£o de entradas
    const incomeProjectionEl = document.getElementById('totalIncomeProjection');
    if (incomeProjectionEl) {
        const totalIncomeTotal = totalIncome + pendingIncomeProjections;
        incomeProjectionEl.textContent = `= ${formatCurrencyDisplay(totalIncomeTotal)}`;
        incomeProjectionEl.style.display = pendingIncomeProjections > 0 ? 'block' : 'none';
    }

    // Card de SaÃ­das com dois valores
    // CorreÃ§Ã£o 3: ProjeÃ§Ã£o mostra total = atual + faturas nÃ£o pagas + projeÃ§Ãµes de saÃ­da pendentes
    const totalExpenseTotal = totalExpenseActual + totalUnpaidBills + pendingExpenseProjections;
    if (expenseEl) expenseEl.textContent = formatCurrencyDisplay(totalExpenseActual);
    if (expenseProjectionEl) {
        expenseProjectionEl.textContent = `= ${formatCurrencyDisplay(totalExpenseTotal)}`;
        expenseProjectionEl.style.display = totalExpenseProjection > 0 ? 'block' : 'none';
    }

    // ProjeÃ§Ã£o de saldo = saldo atual + entradas pendentes - faturas nÃ£o pagas - projeÃ§Ãµes de saÃ­da pendentes
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

// Fechar funÃ§Ã£o updateKPIs
}

console.log('âœ… Finance Data v3.0 - Loaded');
