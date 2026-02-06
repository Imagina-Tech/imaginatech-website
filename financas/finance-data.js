/*
==================================================
ARQUIVO: financas/finance-data.js
MODULO: Data - CRUD, Integracao com Firestore e KPIs
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 3.0 - Refatoracao Modular
IMPORTANTE: NAO REMOVER ESTE CABECALHO DE IDENTIFICACAO
==================================================

!!! AVISO DE SINCRONIZACAO - LEIA ANTES DE EDITAR !!!
=====================================================
Este arquivo contem a logica de calculo dos KPIs do dashboard financeiro.
A MESMA LOGICA esta duplicada no backend em:

  functions/index.js -> funcao buildFinancialOverview()

O bot WhatsApp (Gemini) usa essa funcao para responder perguntas financeiras.
Se voce editar os calculos aqui (especialmente updateKPIs), DEVE editar
tambem no backend para manter os valores consistentes.

Calculos criticos que devem estar sincronizados:
- totalIncomeAllTime (linha ~2295)
- totalDebitAllTime (linha ~2307)
- totalBalance (linha ~2329)
- cutoffDate filtering
- paymentMethod === 'credit' exclusion

Ultima sincronizacao: 2026-01-24
=====================================================
*/

// ===========================
// UTILITY FUNCTIONS
// ===========================

/**
 * Flag global para prevenir submissoes duplicadas (race condition)
 * Usada pelos handlers de formularios para evitar cliques multiplos
 */
let isFormSubmitting = false;

/**
 * Sanitiza string para prevenir XSS ao inserir em HTML
 * @param {string} str - String a ser sanitizada
 * @returns {string} String segura para uso em innerHTML
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Retorna o ultimo dia valido de um mes (trata meses com 28, 29, 30, 31 dias)
 * @param {number} year - Ano
 * @param {number} month - Mes (0-11)
 * @returns {number} Ultimo dia do mes
 */
function getLastDayOfMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

/**
 * Cria uma data com dia ajustado para o ultimo dia valido do mes se necessario
 * Resolve edge case de dia 31 em meses com 30 dias (ex: abril, junho, setembro, novembro)
 * @param {number} year - Ano
 * @param {number} month - Mes (0-11)
 * @param {number} day - Dia desejado
 * @returns {Date} Data com dia ajustado
 */
function createSafeDate(year, month, day) {
    const lastDay = getLastDayOfMonth(year, month);
    const safeDay = Math.min(day, lastDay);
    return new Date(year, month, safeDay);
}

/**
 * Calcula o período de fatura de um cartão de crédito
 * @param {Object} card - Objeto do cartão com closingDay
 * @param {number|null} overrideMonth - Mês específico (0-11) ou null para usar atual
 * @param {number|null} overrideYear - Ano específico ou null para usar atual
 * @returns {Object} { startDate, endDate, billMonth, billYear, isNavigating }
 */
function getBillPeriod(card, overrideMonth = null, overrideYear = null) {
    const today = new Date();
    const currentMonth = overrideMonth !== null ? overrideMonth :
                        (typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : today.getMonth());
    const currentYear = overrideYear !== null ? overrideYear :
                       (typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : today.getFullYear());

    let startDate, endDate, billMonth, billYear;
    const isNavigating = (currentMonth !== today.getMonth() || currentYear !== today.getFullYear());

    // NOTA: startDate usa closingDay (nao closingDay+1) para que compras feitas
    // NO dia do fechamento caiam na fatura seguinte. Isso funciona porque:
    // - endDate = closingDay a meia-noite (00:00)
    // - transactionDate usa T12:00:00
    // - Compra no closingDay: 12:00 > 00:00 = NAO entra no periodo atual (endDate)
    // - Compra no closingDay: 12:00 >= 00:00 = ENTRA no periodo seguinte (startDate)

    if (isNavigating) {
        // Navegando entre meses: mostrar fatura do mês visualizado
        let prevMonth = currentMonth - 1;
        let prevYear = currentYear;
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear--;
        }
        startDate = createSafeDate(prevYear, prevMonth, card.closingDay);
        endDate = createSafeDate(currentYear, currentMonth, card.closingDay);
        billMonth = currentMonth;
        billYear = currentYear;
    } else {
        // Mês atual: usar lógica baseada no dia de fechamento
        if (today.getDate() < card.closingDay) {
            // Ainda no período atual
            startDate = createSafeDate(currentYear, currentMonth - 1, card.closingDay);
            endDate = createSafeDate(currentYear, currentMonth, card.closingDay);
            billMonth = currentMonth;
            billYear = currentYear;

            if (currentMonth === 0) {
                startDate = createSafeDate(currentYear - 1, 11, card.closingDay);
            }
        } else {
            // Já passou do fechamento
            startDate = createSafeDate(currentYear, currentMonth, card.closingDay);
            let nextMonth = currentMonth + 1;
            let nextYear = currentYear;
            if (nextMonth > 11) {
                nextMonth = 0;
                nextYear++;
            }
            endDate = createSafeDate(nextYear, nextMonth, card.closingDay);
            billMonth = currentMonth;
            billYear = currentYear;
        }
    }

    return { startDate, endDate, billMonth, billYear, isNavigating };
}

/**
 * Verifica se uma assinatura deve ser incluida na fatura do periodo.
 * A assinatura so entra na fatura quando seu dueDay cai dentro do periodo
 * E (para fatura aberta/real-time) o dia da cobranca ja chegou.
 * Para faturas passadas (navegando), inclui se dueDay esta no periodo.
 * @param {Object} sub - Assinatura com dueDay, cardId, status
 * @param {Date} billStartDate - Inicio do periodo da fatura
 * @param {Date} billEndDate - Fim do periodo da fatura
 * @param {boolean} isNavigating - Se o usuario esta navegando entre meses
 * @returns {boolean}
 */
function isSubscriptionDueInPeriod(sub, billStartDate, billEndDate, isNavigating) {
    const subDay = sub.dueDay || 1;
    const today = new Date();

    // O periodo da fatura pode abranger 2 meses (ex: 2/fev a 2/mar)
    // Precisamos verificar se o dueDay cai em algum dos meses do periodo
    const startMonth = billStartDate.getMonth();
    const startYear = billStartDate.getFullYear();
    const endMonth = billEndDate.getMonth();
    const endYear = billEndDate.getFullYear();

    // Verificar cobranca no mes do startDate
    const chargeInStartMonth = createSafeDate(startYear, startMonth, subDay);
    chargeInStartMonth.setHours(12, 0, 0, 0);

    if (chargeInStartMonth >= billStartDate && chargeInStartMonth <= billEndDate) {
        // Fatura aberta: so incluir se hoje >= dia da cobranca
        if (!isNavigating && today < chargeInStartMonth) return false;
        return true;
    }

    // Verificar cobranca no mes do endDate (se diferente)
    if (startMonth !== endMonth || startYear !== endYear) {
        const chargeInEndMonth = createSafeDate(endYear, endMonth, subDay);
        chargeInEndMonth.setHours(12, 0, 0, 0);

        if (chargeInEndMonth >= billStartDate && chargeInEndMonth <= billEndDate) {
            if (!isNavigating && today < chargeInEndMonth) return false;
            return true;
        }
    }

    return false;
}

// ===========================
// INITIALIZATION
// ===========================

// Inicializa dashboard e carrega todos os dados do Firestore
async function initializeDashboard() {
    showLoading('Carregando dados...');
    logger.log('Iniciando dashboard...');

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
        logger.log('Carregando dados do Firestore...');
        const loadResults = await Promise.allSettled([
            loadTransactions(),
            loadSubscriptions(),
            loadInstallments(),
            loadProjections(),
            loadCreditCards(),
            loadCreditCardPayments(),
            loadInvestments(),
            loadUserSettings(),
            loadServices()
        ]);

        // CORRIGIDO: Verificar status de cada promise e logar erros
        const loadNames = ['transactions', 'subscriptions', 'installments', 'projections',
                          'creditCards', 'creditCardPayments', 'investments', 'userSettings', 'services'];
        loadResults.forEach((result, index) => {
            if (result.status === 'rejected') {
                logger.error(`Falha ao carregar ${loadNames[index]}:`, result.reason);
            }
        });

        // Iniciar listeners em tempo real
        startServicesListener();
        startTransactionsListener();

        logger.log('Dados carregados:', {
            transactions: transactions.length,
            subscriptions: subscriptions.length,
            installments: installments.length,
            projections: projections.length,
            creditCardPayments: creditCardPayments.length,
            services: services.length,
            investments: investments.length
        });

        // Initialize charts (com dados ou sem)
        initializeCharts();

        // Update KPIs
        updateKPIs();

        // Migrar parcelamentos antigos automaticamente (se necessÃ¡rio)
        // Fazemos isso em background para nÃ£o bloquear a interface
        setTimeout(() => {
            const oldInstallments = installments.filter(i =>
                i.startMonth === undefined || i.startYear === undefined
            );
            if (oldInstallments.length > 0) {
                logger.log('[initializeDashboard] Detectados parcelamentos antigos, iniciando migraÃ§Ã£o automÃ¡tica...');
                migrateOldInstallments();
            }
        }, 1000);

        hideLoading();
        showToast('Dashboard carregado com sucesso', 'success');
    } catch (error) {
        hideLoading();
        logger.error('Erro ao inicializar dashboard:', error);
        showToast('Erro ao carregar dados: ' + error.message, 'error');
    }
}

// ðŸ“ Popula dropdown de categorias com base no tipo de transaÃ§Ã£o
function populateCategories() {
    const categorySelect = document.getElementById('category');
    if (!categorySelect) return;

    categorySelect.innerHTML = '<option value="">Selecione uma categoria</option>';

    // Para saidas, usar categorias com icones e ordenacao por frequencia
    if (currentTransactionType === 'expense' && typeof CARD_EXPENSE_CATEGORIES !== 'undefined') {
        const usage = JSON.parse(localStorage.getItem('categoryUsageCount') || '{}');
        const sortedCategories = [...CARD_EXPENSE_CATEGORIES].sort((a, b) => {
            return (usage[b.name] || 0) - (usage[a.name] || 0);
        });

        sortedCategories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.name;
            option.textContent = cat.name;
            option.dataset.icon = cat.icon;
            categorySelect.appendChild(option);
        });
    } else {
        // Para entradas, usar categorias simples
        const categories = currentTransactionType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            categorySelect.appendChild(option);
        });
    }

    // Inicializar ou atualizar CustomSelect
    setTimeout(() => {
        if (categorySelect.dataset.customized === 'true') {
            // Ja foi customizado, apenas disparar evento para sincronizar
            categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (window.CustomSelect) {
            // Ainda nao foi customizado, inicializar agora
            new window.CustomSelect(categorySelect);
            categorySelect.dataset.customized = 'true';
        }
    }, 0);
}
// ===========================
// TRANSACTIONS CRUD
// ===========================
// 🗄️ Carrega todas as transações do Firestore
async function loadTransactions() {
    try {
        logger.log('Carregando transações...');
        const snapshot = await db.collection('transactions')
            .where('userId', '==', activeUserId)
            .orderBy('date', 'desc')
            .get();

        transactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        logger.log(`${transactions.length} transações carregadas`);
    } catch (error) {
        logger.error('Erro ao carregar transações:', error);
        // Não mostra toast aqui para não poluir - já mostra no catch principal
        transactions = []; // Garante array vazio
    }
}

// 🛍️ Array global para armazenar serviços

// 📦 Função para carregar serviços
async function loadServices() {
    try {
        if (!activeUserId) {
            logger.warn('activeUserId não definido, pulando carregamento de serviços');
            return;
        }

        const snapshot = await db.collection('services')
            .where('userId', '==', activeUserId)
            .get();

        services = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        logger.log(`${services.length} serviços carregados`);
    } catch (error) {
        logger.error('Erro ao carregar serviços:', error);
        services = [];
    }
}

// 💰 Função para criar transação a partir de serviço
async function createTransactionFromService(service) {
    try {
        // Verificações de segurança
        if (!service.value || service.value <= 0) {
            logger.log('Serviço sem valor, ignorando:', service.id);
            return;
        }

        if (!service.userId || service.userId !== activeUserId) {
            logger.log('Serviço não pertence ao usuário ativo, ignorando:', service.id);
            return;
        }

        // Filtrar serviços anteriores a 01/01/2026
        const cutoffServiceDate = '2026-01-01';
        const serviceDate = service.createdAt ? service.createdAt.split('T')[0] : null;
        if (!serviceDate || serviceDate < cutoffServiceDate) {
            logger.log('Serviço anterior a 2026, ignorando:', service.id, 'Data:', serviceDate);
            return;
        }

        // Verificar se já existe transação para este serviço
        const existingTransactions = await db.collection('transactions')
            .where('userId', '==', activeUserId)
            .where('serviceId', '==', service.id)
            .get();

        if (!existingTransactions.empty) {
            // Transação já existe - ATUALIZAR ao invés de ignorar
            const existingDoc = existingTransactions.docs[0];
            const existingData = existingDoc.data();

            // Verificar se houve mudança no valor ou descrição
            const newValue = parseFloat(service.value);
            const newDescription = `Serviço: ${service.name || 'Sem nome'}`;

            if (existingData.value !== newValue || existingData.description !== newDescription) {
                logger.log('Serviço editado, atualizando transação:', service.id);
                logger.log('Valor anterior:', existingData.value, '-> Novo valor:', newValue);

                await db.collection('transactions').doc(existingDoc.id).update({
                    value: newValue,
                    description: newDescription,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                logger.log('Transação atualizada para serviço:', service.id);

                // Recarregar transações
                await loadTransactions();
                updateAllDisplays();
            } else {
                logger.log('Serviço sem alterações relevantes:', service.id);
            }
            return;
        }

        // Extrair data do serviço (usar createdAt que está em formato ISO)
        let transactionDate;
        if (service.createdAt) {
            // createdAt está em formato ISO, extrair apenas a data
            transactionDate = service.createdAt.split('T')[0];
        } else {
            transactionDate = new Date().toISOString().split('T')[0];
        }

        // Criar transação de entrada
        const transactionData = {
            userId: activeUserId,
            type: 'income',
            description: `Serviço: ${service.name || 'Sem nome'}`,
            value: parseFloat(service.value),
            category: 'Vendas',
            date: transactionDate,
            paymentMethod: 'debit',
            cardId: null,
            serviceId: service.id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('transactions').add(transactionData);
        logger.log('✅ Transação criada para serviço:', service.id, 'Data:', transactionDate);

        // Recarregar transações
        await loadTransactions();
        updateAllDisplays();

    } catch (error) {
        logger.error('Erro ao criar transação de serviço:', error);
    }
}

// 🗑️ Função para excluir transação quando serviço for removido
async function deleteTransactionByServiceId(serviceId) {
    try {
        // Buscar transação associada ao serviço
        const transactionsToDelete = await db.collection('transactions')
            .where('userId', '==', activeUserId)
            .where('serviceId', '==', serviceId)
            .get();

        if (transactionsToDelete.empty) {
            logger.log('Nenhuma transação encontrada para serviço removido:', serviceId);
            return;
        }

        // Excluir cada transação encontrada
        const batch = db.batch();
        transactionsToDelete.docs.forEach(doc => {
            batch.delete(doc.ref);
            logger.log('🗑️ Marcando transação para exclusão:', doc.id);
        });

        await batch.commit();
        logger.log('✅ Transação(ões) excluída(s) para serviço:', serviceId);

        // Recarregar transações
        await loadTransactions();
        updateAllDisplays();

    } catch (error) {
        logger.error('Erro ao excluir transação de serviço:', error);
    }
}

// 👂 Listener em tempo real para serviços
let servicesListener = null;

// 👂 Listener em tempo real para transações (sincroniza com WhatsApp bot)
let transactionsListener = null;
let transactionsListenerRetryCount = 0;
const TRANSACTIONS_LISTENER_MAX_RETRIES = 3;

// Para o listener de transações (chamado ao trocar de conta)
function stopTransactionsListener() {
    if (transactionsListener) {
        transactionsListener();
        transactionsListener = null;
        logger.log('Listener de transações parado');
    }
}

// Inicia listener em tempo real para transações
function startTransactionsListener() {
    if (!activeUserId) {
        logger.warn('activeUserId não definido, não iniciando listener de transações');
        return;
    }

    // Parar listener anterior se existir
    stopTransactionsListener();

    logger.log('Iniciando listener de transações em tempo real...');

    transactionsListener = db.collection('transactions')
        .where('userId', '==', activeUserId)
        .orderBy('date', 'desc')
        .onSnapshot(
            // Callback de sucesso
            snapshot => {
                // Reset retry count on success
                transactionsListenerRetryCount = 0;

                // Não processar se dashboard escondido
                const dashboard = document.getElementById('dashboard');
                if (dashboard?.classList.contains('hidden')) {
                    return;
                }

                // Atualizar array global de transações
                transactions = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                logger.log(`[Realtime] ${transactions.length} transações sincronizadas`);

                // Atualizar KPIs, gráficos e gauges
                if (typeof updateKPIs === 'function') {
                    updateKPIs();
                }
                if (typeof updateCharts === 'function') {
                    updateCharts();
                }
            },
            // Callback de erro
            error => {
                logger.error('Erro no listener de transações:', error);

                // Tentar reconectar se não excedeu limite
                if (transactionsListenerRetryCount < TRANSACTIONS_LISTENER_MAX_RETRIES) {
                    transactionsListenerRetryCount++;
                    const delay = Math.min(1000 * Math.pow(2, transactionsListenerRetryCount), 30000);
                    logger.log(`Tentando reconectar listener de transações (${transactionsListenerRetryCount}/${TRANSACTIONS_LISTENER_MAX_RETRIES}) em ${delay}ms...`);
                    setTimeout(() => startTransactionsListener(), delay);
                } else {
                    logger.error('Máximo de tentativas de reconexão atingido para transações');
                }
            }
        );
}

// Para o listener de serviços (chamado ao trocar de conta)
function stopServicesListener() {
    if (servicesListener) {
        servicesListener();
        servicesListener = null;
        logger.log('Listener de serviços parado');
    }
}

// Contador de tentativas de reconexao do listener
let servicesListenerRetryCount = 0;
const SERVICES_LISTENER_MAX_RETRIES = 3;

function startServicesListener() {
    if (!activeUserId) {
        logger.warn('activeUserId não definido, não iniciando listener de serviços');
        return;
    }

    // Parar listener anterior se existir
    if (servicesListener) {
        servicesListener();
        servicesListener = null;
    }

    servicesListener = db.collection('services')
        .where('userId', '==', activeUserId)
        .onSnapshot(
            // Callback de sucesso
            async snapshot => {
                // Reset retry count on success
                servicesListenerRetryCount = 0;

                // Nao processar se tela de acesso negado estiver visivel ou dashboard escondido
                const accessDeniedScreen = document.getElementById('accessDeniedScreen');
                const dashboard = document.getElementById('dashboard');
                if (accessDeniedScreen?.classList.contains('active') || dashboard?.classList.contains('hidden')) {
                    logger.log('Listener ignorado: tela de acesso negado ou dashboard escondido');
                    return;
                }

                // Usar for...of para aguardar cada operação async corretamente
                // CORRIGIDO: Verificação de nulidade antes de destructuring
                for (const change of snapshot.docChanges()) {
                    if (!change?.doc?.data) continue;

                    const docData = change.doc.data();
                    if (!docData) continue;

                    const service = { id: change.doc.id, ...docData };

                    try {
                        // Criar/atualizar transação quando serviço for adicionado ou modificado
                        if (change.type === 'added' || change.type === 'modified') {
                            await createTransactionFromService(service);
                        }

                        // Excluir transação quando serviço for removido
                        if (change.type === 'removed') {
                            await deleteTransactionByServiceId(service.id);
                        }
                    } catch (error) {
                        logger.error(`Erro ao processar servico ${service.id}:`, error);
                        // Continua processando outros servicos mesmo se um falhar
                    }
                }
            },
            // Callback de erro - CRITICO: previne falhas silenciosas
            error => {
                logger.error('Erro no listener de serviços:', error);

                // Tentar reconectar se nao excedeu limite
                if (servicesListenerRetryCount < SERVICES_LISTENER_MAX_RETRIES) {
                    servicesListenerRetryCount++;
                    logger.log(`Tentando reconectar listener (${servicesListenerRetryCount}/${SERVICES_LISTENER_MAX_RETRIES})...`);

                    // Aguardar antes de tentar novamente (backoff exponencial)
                    const delay = Math.pow(2, servicesListenerRetryCount) * 1000;
                    setTimeout(() => startServicesListener(), delay);
                } else {
                    // Notificar usuario apos esgotar tentativas
                    if (typeof showToast === 'function') {
                        showToast('Erro ao sincronizar serviços. Recarregue a página.', 'error');
                    }
                }
            }
        );

    logger.log('Listener de serviços iniciado');
}

// 📲 Processa envio do formulário de transação (criar/editar)
async function handleTransactionSubmit(e) {
    e.preventDefault();

    // Prevenir submissoes duplicadas (race condition)
    if (isFormSubmitting) return;
    isFormSubmitting = true;

    const descriptionEl = document.getElementById('description');
    const valueEl = document.getElementById('value');
    const categoryEl = document.getElementById('category');
    const dateEl = document.getElementById('date');
    const description = descriptionEl ? descriptionEl.value.trim() : '';
    const valueStr = valueEl ? valueEl.value : '';
    const category = categoryEl ? categoryEl.value : '';
    const date = dateEl ? dateEl.value : '';

    if (!description || !valueStr || !category || !date) {
        showToast('Preencha todos os campos', 'error');
        isFormSubmitting = false;
        return;
    }

    // Validar cartão de crédito se for transação no crédito (tanto saída quanto entrada/reembolso)
    let selectedCardId = null;
    let selectedCard = null;
    if (currentPaymentMethod === 'credit') {
        const transactionCardEl = document.getElementById('transactionCard');
        selectedCardId = transactionCardEl ? transactionCardEl.value : '';
        if (!selectedCardId) {
            showToast('Selecione um cartão de crédito', 'error');
            isFormSubmitting = false;
            return;
        }
        // Validar que o cartão existe
        selectedCard = creditCards.find(c => c.id === selectedCardId);
        if (!selectedCard) {
            logger.error('❌ Cartão selecionado não encontrado:', selectedCardId);
            showToast('Cartão inválido. Recarregue a página e tente novamente', 'error');
            isFormSubmitting = false;
            return;
        }

        // Validar se a data está dentro do período da fatura
        const transactionDate = new Date(date + 'T12:00:00');
        const { startDate: billStartDate, endDate: billEndDate } = getBillPeriod(selectedCard);

        // Avisar se a data está fora do período
        if (transactionDate < billStartDate || transactionDate > billEndDate) {
            const startStr = billStartDate.toLocaleDateString('pt-BR');
            const endStr = billEndDate.toLocaleDateString('pt-BR');
            const warningMsg = `⚠️ ATENÇÃO: A data (${new Date(date).toLocaleDateString('pt-BR')}) está FORA do período da fatura de "${selectedCard.name}" (${startStr} a ${endStr}). A transação não aparecerá na fatura! Deseja continuar?`;

            logger.warn(`⚠️ [DATA FORA DO PERÍODO] Transação de ${date} para cartão "${selectedCard.name}"`);

            if (!confirm(warningMsg)) {
                isFormSubmitting = false;
                return;
            }
        }
    }

    const value = parseCurrencyInput(valueStr);
    if (value <= 0) {
        showToast('Valor inválido', 'error');
        isFormSubmitting = false;
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
            logger.log(`📝 [handleTransactionSubmit] Salvando transação no cartão:`, selectedCardId, 'Nome:', creditCards.find(c => c.id === selectedCardId)?.name);
        }

        if (editingTransactionId) {
            // Editando transação existente
            logger.log(`✏️ Atualizando transação ID: ${editingTransactionId}`);
            await db.collection('transactions').doc(editingTransactionId).update({
                ...transactionData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Transação atualizada com sucesso', 'success');
        } else {
            // Criando nova transação
            logger.log(`✨ Criando nova transação:`, { description, type: currentTransactionType, paymentMethod: currentPaymentMethod, cardId: selectedCardId });
            await db.collection('transactions').add({
                ...transactionData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Incrementar contador de uso da categoria (apenas para saidas)
            if (currentTransactionType === 'expense' && typeof incrementCategoryUsage === 'function') {
                incrementCategoryUsage(category);
            }

            showToast('Transação adicionada com sucesso', 'success');
        }

        await loadTransactions();
        updateAllDisplays();
        closeTransactionModal();
    } catch (error) {
        logger.error('Erro ao salvar transação:', error);
        showToast('Erro ao salvar transação', 'error');
    } finally {
        hideLoading();
        isFormSubmitting = false;
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
        logger.error('Erro ao deletar transação:', error);
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
        logger.log('Carregando assinaturas...');
        const snapshot = await db.collection('subscriptions')
            .where('userId', '==', activeUserId)
            .orderBy('createdAt', 'desc')
            .get();

        subscriptions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        logger.log(`${subscriptions.length} assinaturas carregadas`);
    } catch (error) {
        logger.error('Erro ao carregar assinaturas:', error);
        subscriptions = [];
    }
}

// 📲 Processa envio do formulário de assinatura (criar/editar)
async function handleSubscriptionSubmit(e) {
    e.preventDefault();

    const subNameEl = document.getElementById('subName');
    const subValueEl = document.getElementById('subValue');
    const subDueDayEl = document.getElementById('subDueDay');
    const subCategoryEl = document.getElementById('subCategory');
    const subStatusEl = document.getElementById('subStatus');
    const subCardEl = document.getElementById('subCard');
    const name = subNameEl ? subNameEl.value.trim() : '';
    const valueStr = subValueEl ? subValueEl.value : '';
    const dueDay = parseInt(subDueDayEl ? subDueDayEl.value : '0');
    const category = subCategoryEl ? subCategoryEl.value : '';
    const status = subStatusEl ? subStatusEl.value : '';
    const cardId = subCardEl ? subCardEl.value : '';

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
        logger.error('Erro ao salvar assinatura:', error);
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
        logger.error('Erro ao deletar assinatura:', error);
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

        logger.log(`[migrateOldInstallments] Encontrados ${installmentsToMigrate.length} parcelamentos para migrar`);

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

            logger.log(`[migrateOldInstallments] Parcelamento "${inst.description}": currentInstallment=${current}, startMonth=${startMonth}, startYear=${startYear}`);

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
        logger.log('[migrateOldInstallments] Migração concluída!');
    } catch (error) {
        logger.error('Erro ao migrar parcelamentos:', error);
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
        logger.log('Carregando parcelamentos...');
        const snapshot = await db.collection('installments')
            .where('userId', '==', activeUserId)
            .orderBy('createdAt', 'desc')
            .get();

        installments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        logger.log(`${installments.length} parcelamentos carregados`);
    } catch (error) {
        logger.error('Erro ao carregar parcelamentos:', error);
        installments = [];
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

    const instDescEl = document.getElementById('instDescription');
    const instCardEl = document.getElementById('instCard');
    const instTotalEl = document.getElementById('instTotalInstallments');
    const instCurrentEl = document.getElementById('instCurrentInstallment');
    const description = instDescEl ? instDescEl.value.trim() : '';
    const cardId = instCardEl ? instCardEl.value : '';
    const totalInstallments = parseInt(instTotalEl ? instTotalEl.value : '0');
    const currentInstallment = parseInt(instCurrentEl ? instCurrentEl.value : '0');

    // Pega o valor correto dependendo do tipo selecionado
    // Usa window.installmentValueType que é definido em finance-ui.js
    let totalValue = 0;
    const valueType = window.installmentValueType || 'total';
    if (valueType === 'total') {
        const instTotalValueEl = document.getElementById('instTotalValue');
        const totalValueStr = instTotalValueEl ? instTotalValueEl.value : '';
        if (!totalValueStr) {
            showToast('Preencha o valor total', 'error');
            return;
        }
        totalValue = parseCurrencyInput(totalValueStr);
    } else {
        const instInstValueEl = document.getElementById('instInstallmentValue');
        const installmentValueStr = instInstValueEl ? instInstValueEl.value : '';
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
            currentInstallment,
            installmentValue: totalValue / totalInstallments
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
        logger.error('Erro ao salvar parcelamento:', error);
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
        logger.error('Erro ao atualizar parcelamento:', error);
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
        logger.error('Erro ao deletar parcelamento:', error);
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
        logger.log('Carregando projeções...');
        const snapshot = await db.collection('projections')
            .where('userId', '==', activeUserId)
            .orderBy('date', 'asc')
            .get();

        projections = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        logger.log(`${projections.length} projeções carregadas`);
    } catch (error) {
        logger.error('Erro ao carregar projeções:', error);
        projections = [];
    }
}

// ===========================
// CREDIT CARD PAYMENTS - LOAD
// ===========================
async function loadCreditCardPayments() {
    try {
        logger.log('Carregando pagamentos de faturas...');
        const snapshot = await db.collection('creditCardPayments')
            .where('userId', '==', activeUserId)
            .get();

        creditCardPayments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        logger.log(`${creditCardPayments.length} pagamentos de fatura carregados`);
    } catch (error) {
        logger.error('Erro ao carregar pagamentos de faturas:', error);
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
        document.getElementById('cardBillDetailsModal')?.classList.remove('active');
        setTimeout(() => showCardBillDetails(cardId), 300);

    } catch (error) {
        logger.error('Erro ao marcar fatura como paga:', error);
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
        document.getElementById('cardBillDetailsModal')?.classList.remove('active');
        setTimeout(() => showCardBillDetails(cardId), 300);

    } catch (error) {
        logger.error('Erro ao desfazer pagamento:', error);
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
        logger.log('Carregando investimentos...');
        const snapshot = await db.collection('investments')
            .where('userId', '==', activeUserId)
            .orderBy('date', 'desc')
            .get();

        investments = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        logger.log(`${investments.length} investimentos carregados`);
    } catch (error) {
        logger.error('Erro ao carregar investimentos:', error);
        investments = [];
    }
}

// ===========================
// USER SETTINGS - LOAD
// ===========================
async function loadUserSettings() {
    try {
        logger.log('Carregando configurações do usuário...');

        // Resetar userSettings para valores padrão antes de carregar (importante ao trocar de conta)
        userSettings = {
            savingsGoal: 2000,
            expenseLimit: 3000,
            cutoffDate: null
        };

        const doc = await db.collection('userSettings').doc(activeUserId).get();

        if (doc.exists) {
            userSettings = { ...userSettings, ...doc.data() };

            // Forçar atualização da data de corte para 2026 APENAS na conta da empresa
            if (activeUserEmail === COMPANY_EMAIL && userSettings.cutoffDate !== '2026-01-01') {
                logger.log('Atualizando data de corte da empresa para 2026-01-01 (anterior:', userSettings.cutoffDate, ')');
                userSettings.cutoffDate = '2026-01-01';
                await db.collection('userSettings').doc(activeUserId).update({
                    cutoffDate: '2026-01-01',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            // Garantir que contas pessoais NÃO tenham data de corte (a menos que configurado manualmente)
            if (activeUserEmail !== COMPANY_EMAIL && userSettings.cutoffDate === '2026-01-01') {
                logger.log('Removendo data de corte indevida da conta pessoal');
                userSettings.cutoffDate = null;
                await db.collection('userSettings').doc(activeUserId).update({
                    cutoffDate: null,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
        } else {
            // Se não existe configuração E é a conta da empresa
            // Definir data de corte padrão como 01/01/2026
            if (activeUserEmail === COMPANY_EMAIL) {
                userSettings.cutoffDate = '2026-01-01';
                logger.log('Definindo data de corte padrão para empresa: 2026-01-01');

                // Salvar configuração padrão
                await saveUserSettings({
                    cutoffDate: '2026-01-01',
                    savingsGoal: 2000,
                    expenseLimit: 3000
                });
            }
        }

        logger.log('Configurações carregadas:', userSettings);
    } catch (error) {
        logger.error('Erro ao carregar configurações:', error);
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
        logger.error('Erro ao salvar configurações:', error);
        showToast('Erro ao salvar configurações', 'error');
        return false;
    }
}

// ===========================
// INVESTMENTS - CRUD & MODAL
// ===========================
function openInvestmentsModal() {
    const today = new Date().toISOString().split('T')[0];
    const invDateEl = document.getElementById('investmentDate');
    const invNameEl = document.getElementById('investmentName');
    const invValueEl = document.getElementById('investmentValue');
    if (invDateEl) invDateEl.value = today;
    if (invNameEl) invNameEl.value = '';
    if (invValueEl) invValueEl.value = '';
    editingInvestmentId = null;

    renderInvestmentsList();
    document.getElementById('investmentsModal')?.classList.add('active');
}

function closeInvestmentsModal() {
    document.getElementById('investmentsModal')?.classList.remove('active');
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
                <button class="btn-icon" data-action="edit-investment" data-id="${escapeHtml(inv.id)}" title="Editar" style="color: var(--color-neutral);">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-icon danger" data-action="delete-investment" data-id="${escapeHtml(inv.id)}" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

async function handleInvestmentSubmit(e) {
    e.preventDefault();

    const invNameEl2 = document.getElementById('investmentName');
    const invValueEl2 = document.getElementById('investmentValue');
    const invDateEl2 = document.getElementById('investmentDate');
    const name = invNameEl2 ? invNameEl2.value.trim() : '';
    const valueStr = invValueEl2 ? invValueEl2.value : '';
    const date = invDateEl2 ? invDateEl2.value : '';

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
        const clearInvName = document.getElementById('investmentName');
        const clearInvValue = document.getElementById('investmentValue');
        const clearInvDate = document.getElementById('investmentDate');
        if (clearInvName) clearInvName.value = '';
        if (clearInvValue) clearInvValue.value = '';
        if (clearInvDate) clearInvDate.value = new Date().toISOString().split('T')[0];
        editingInvestmentId = null;

        await loadInvestments();
        renderInvestmentsList();
        updateAllDisplays();

    } catch (error) {
        logger.error('Erro ao salvar investimento:', error);
        showToast('Erro ao salvar investimento', 'error');
    } finally {
        hideLoading();
    }
}

function editInvestment(id) {
    const inv = investments.find(i => i.id === id);
    if (!inv) return;

    const editInvName = document.getElementById('investmentName');
    const editInvValue = document.getElementById('investmentValue');
    const editInvDate = document.getElementById('investmentDate');
    if (editInvName) editInvName.value = inv.name;
    if (editInvValue) editInvValue.value = inv.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    if (editInvDate) editInvDate.value = inv.date;
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
        logger.error('Erro ao excluir investimento:', error);
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
    const savingsGoalEl = document.getElementById('savingsGoalInput');
    const expenseLimitEl = document.getElementById('expenseLimitInput');
    const cutoffDateEl = document.getElementById('cutoffDateInput');
    if (savingsGoalEl) savingsGoalEl.value = userSettings.savingsGoal.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    if (expenseLimitEl) expenseLimitEl.value = userSettings.expenseLimit.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    if (cutoffDateEl) cutoffDateEl.value = userSettings.cutoffDate || '';

    document.getElementById('settingsModal')?.classList.add('active');

    // Carregar status do WhatsApp
    loadWhatsAppStatus();
}

function closeSettingsModal() {
    document.getElementById('settingsModal')?.classList.remove('active');
}

async function handleSettingsSubmit(e) {
    e.preventDefault();

    const savingsGoalInputEl = document.getElementById('savingsGoalInput');
    const expenseLimitInputEl = document.getElementById('expenseLimitInput');
    const cutoffDateInputEl = document.getElementById('cutoffDateInput');
    const savingsGoalStr = savingsGoalInputEl ? savingsGoalInputEl.value : '';
    const expenseLimitStr = expenseLimitInputEl ? expenseLimitInputEl.value : '';
    const cutoffDate = cutoffDateInputEl ? cutoffDateInputEl.value : '';

    const savingsGoal = parseCurrencyInput(savingsGoalStr);
    const expenseLimit = parseCurrencyInput(expenseLimitStr);

    if (savingsGoal <= 0 || expenseLimit <= 0) {
        showToast('Valores inválidos', 'error');
        return;
    }

    showLoading('Salvando...');

    const success = await saveUserSettings({
        savingsGoal,
        expenseLimit,
        cutoffDate: cutoffDate || null
    });

    if (success) {
        closeSettingsModal();
        initializeCharts(); // Atualizar gráficos com novos valores
    }

    hideLoading();
}

// 📲 Processa envio do formulário de projeção
async function handleProjectionSubmit(e) {
    e.preventDefault();

    const projDescEl = document.getElementById('projDescription');
    const projValueEl = document.getElementById('projValue');
    const projDateEl = document.getElementById('projDate');
    const projStatusEl = document.getElementById('projStatus');
    const description = projDescEl ? projDescEl.value.trim() : '';
    const valueStr = projValueEl ? projValueEl.value : '';
    const date = projDateEl ? projDateEl.value : '';
    const status = projStatusEl ? projStatusEl.value : '';
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
        logger.error('Erro ao salvar projeção:', error);
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
        logger.log(`[Projeção Status] ID: ${id}, Tipo: ${projType}, Status anterior: ${oldStatus}, Novo status: ${newStatus}`);

        // Se marcando como "received" (ou "pago" para expense), criar transação
        if (newStatus === 'received' && oldStatus !== 'received') {
            logger.log(`[Projeção] Procurando transação vinculada a: "${projection.description}"`);

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
                logger.log(`[Projeção] Transação já existe: ${existingTransaction.id}`);
            } else {
                // Criar nova transação baseada no tipo da projeção
                if (projType === 'income') {
                    logger.log(`[Projeção] Criando nova transação de ENTRADA para: "${projection.description}"`);
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
                    logger.log(`[Projeção] Transação de entrada criada com sucesso: ${docRef.id}`);
                } else {
                    logger.log(`[Projeção] Criando nova transação de SAÍDA para: "${projection.description}"`);
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
                    logger.log(`[Projeção] Transação de despesa criada com sucesso: ${docRef.id}`);
                }
            }
        }
        // Se marcando como "pending", remover transação vinculada (se houver)
        else if (newStatus === 'pending' && oldStatus === 'received') {
            logger.log(`[Projeção] Procurando transação vinculada para deletar`);

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
                logger.log(`[Projeção] Deletando transação: ${linkedTransaction.id}`);
                await db.collection('transactions').doc(linkedTransaction.id).delete();
            } else {
                logger.log(`[Projeção] Nenhuma transação vinculada encontrada`);
            }
        }

        // Atualizar status da projeção
        logger.log(`[Projeção] Atualizando status no Firestore para: ${newStatus}`);
        await db.collection('projections').doc(id).update({ status: newStatus });

        // Recarregar dados e atualizar displays
        logger.log(`[Projeção] Recarregando dados...`);
        await loadTransactions();
        await loadProjections();

        logger.log(`[Projeção] Atualizando KPIs...`);
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
        logger.error('Erro ao atualizar projeção:', error);
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
        logger.error('Erro ao deletar projeção:', error);
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
        logger.log('Carregando cartões de crédito...');
        const snapshot = await db.collection('creditCards')
            .where('userId', '==', activeUserId)
            .orderBy('createdAt', 'desc')
            .get();

        creditCards = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        logger.log(`${creditCards.length} cartões carregados`);
        await loadCardExpenses();
    } catch (error) {
        logger.error('Erro ao carregar cartões:', error);
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

        logger.log(`${cardExpenses.length} gastos de cartão carregados`);
    } catch (error) {
        logger.error('Erro ao carregar gastos:', error);
        cardExpenses = [];
    }
}

// Contador de chamadas (para debug)
let calculateBillCallCount = 0;

// 🔄 Calcula valor total da fatura do cartão para o mês especificado
function calculateCurrentBill(card, overrideMonth = null, overrideYear = null) {
    calculateBillCallCount++;
    logger.log(`\n🔍 [CHAMADA #${calculateBillCallCount}] calculateCurrentBill("${card.name}")`);

    // Usar função centralizada para calcular período da fatura
    const { startDate: billStartDate, endDate: billEndDate, billMonth, billYear, isNavigating } = getBillPeriod(card, overrideMonth, overrideYear);

    // Somar gastos do período (cardExpenses antigos + transações de crédito)
    const expensesTotal = cardExpenses
        .filter(expense => {
            if (expense.cardId !== card.id) return false;
            const expenseDate = new Date(expense.date + 'T12:00:00');
            return expenseDate >= billStartDate && expenseDate <= billEndDate;
        })
        .reduce((sum, expense) => sum + expense.value, 0);

    // Somar transações de crédito do período (saídas e reembolsos)
    const transactionsInPeriod = transactions.filter(t => {
        if (t.paymentMethod !== 'credit' || t.cardId !== card.id) return false;
        const transactionDate = new Date(t.date + 'T12:00:00');

        if (isNavigating) {
            // Ao navegar, mostrar apenas transações do mês visualizado
            return transactionDate.getMonth() === billMonth && transactionDate.getFullYear() === billYear;
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
        logger.log(`   Transações no período: ${transactionsInPeriod.length}`);
        transactionsInPeriod.forEach(t => {
            const tDate = new Date(t.date + 'T12:00:00');
            logger.log(`     ${t.type === 'expense' ? '+' : '-'} ${t.description} em ${tDate.toLocaleDateString('pt-BR')}`);
        });
    }

    // Log simples do período e dados da fatura
    logger.log(`📅 [FATURA ${card.name}] Mês: ${billMonth + 1}/${billYear}`);
    logger.log(`   Período: ${billStartDate.toLocaleDateString('pt-BR')} até ${billEndDate.toLocaleDateString('pt-BR')}`);
    logger.log(`   isNavigating: ${isNavigating}`);
    logger.log(`   Transações de crédito incluídas: R$ ${creditTransactionsTotal.toFixed(2)}`);

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

    // Somar assinaturas ativas deste cartao que ja foram cobradas no periodo
    const subscriptionsFiltered = subscriptions.filter(sub =>
        sub.cardId === card.id && sub.status === 'active' &&
        isSubscriptionDueInPeriod(sub, billStartDate, billEndDate, isNavigating)
    );
    const subscriptionsTotal = subscriptionsFiltered.reduce((sum, sub) => sum + (sub.value || 0), 0);

    const totalBill = expensesTotal + creditTransactionsTotal + installmentsTotal + subscriptionsTotal;

    // Resumo final da fatura
    logger.log(`   Parcelas: R$ ${installmentsTotal.toFixed(2)} (${installmentsFiltered.length})`);
    logger.log(`   Assinaturas: R$ ${subscriptionsTotal.toFixed(2)} (${subscriptionsFiltered.length})`);
    logger.log(`   TOTAL FATURA: R$ ${totalBill.toFixed(2)}`);

    return totalBill;
}

// ===========================
// CREDIT CARDS - MODALS
// ===========================
// 🎨 Abre modal para adicionar/editar cartão de crédito
function openCreditCardModal() {
    editingCardId = null;
    document.getElementById('creditCardModal')?.classList.add('active');
    document.getElementById('creditCardForm')?.reset();
    document.querySelector('#creditCardModal .modal-header h2').textContent = 'Novo Cartão de Crédito';
}

// 🎨 Fecha modal de cartão de crédito
function closeCreditCardModal() {
    editingCardId = null;
    document.getElementById('creditCardModal')?.classList.remove('active');
    document.getElementById('creditCardForm')?.reset();
}

// 🎨 Exibe detalhes completos da fatura do cartão em modal
function showCardBillDetails(cardId) {
    const card = creditCards.find(c => c.id === cardId);
    if (!card) return;

    const today = new Date();
    const currentMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : today.getMonth();
    const currentYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : today.getFullYear();

    // Usar função centralizada para calcular período da fatura
    const { startDate: billStartDate, endDate: billEndDate, billMonth, billYear, isNavigating } = getBillPeriod(card);

    // Filtrar transações pelo mês correto quando navegando
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

    // Coletar assinaturas ativas que ja foram cobradas no periodo
    const activeSubscriptions = subscriptions.filter(sub =>
        sub.cardId === card.id && sub.status === 'active' &&
        isSubscriptionDueInPeriod(sub, billStartDate, billEndDate, isNavigating)
    );

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
    const billTitleEl = document.getElementById('cardBillDetailsTitle');
    if (billTitleEl) billTitleEl.textContent = `Fatura ${card.name} - ${monthName}`;

    // Usar endDate para referencia consistente da fatura (BUG 5 fix)
    const billRefMonth = billEndDate.getMonth();
    const billRefYear = billEndDate.getFullYear();

    // Calcular data de vencimento baseado no endDate (BUG 3 fix)
    let dueMonth = billEndDate.getMonth();
    let dueYear = billEndDate.getFullYear();
    if (card.dueDay < card.closingDay) {
        dueMonth = dueMonth + 1;
        if (dueMonth > 11) { dueMonth = 0; dueYear++; }
    }
    const dueMonthStr = String(dueMonth + 1).padStart(2, '0');

    // Verificar se a fatura está paga
    const billPayment = isBillPaid(cardId, billRefMonth, billRefYear);
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
                        <div>Vencimento: ${card.dueDay}/${dueMonthStr}/${dueYear}</div>
                    </div>
                    ${grandTotal > 0 ? (isPaid
                        ? `<button data-action="unmark-bill-paid" data-id="${escapeHtml(billPayment.id)}" style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #ef4444; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;">
                            <i class="fas fa-undo"></i> Desfazer Pagamento
                           </button>`
                        : `<button data-action="mark-bill-paid" data-card-id="${escapeHtml(cardId)}" data-month="${billRefMonth}" data-year="${billRefYear}" data-total="${grandTotal}" style="background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #10b981; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;">
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
                                <div style="padding: 0.75rem; border-bottom: 1px solid var(--color-border); display: flex; align-items: center; gap: 0.75rem;">
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-weight: 500; color: #fff; font-size: 0.875rem; margin-bottom: 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(t.description)}</div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.25rem;">${new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
                                        <div style="font-weight: 600; color: #3b82f6; font-size: 0.875rem;">${formatCurrencyDisplay(t.value)}</div>
                                    </div>
                                    <div style="display: flex; gap: 0.25rem; flex-shrink: 0;">
                                        <button class="btn-icon btn-icon-sm" data-action="edit-credit-transaction" data-id="${escapeHtml(t.id)}" title="Editar" style="color: var(--color-neutral);">
                                            <i class="fas fa-edit" style="font-size: 0.75rem;"></i>
                                        </button>
                                        <button class="btn-icon btn-icon-sm danger" data-action="delete-credit-transaction" data-id="${escapeHtml(t.id)}" title="Excluir">
                                            <i class="fas fa-trash" style="font-size: 0.75rem;"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                            ${creditRefunds.map(t => `
                                <div style="padding: 0.75rem; border-bottom: 1px solid var(--color-border); background: rgba(16, 185, 129, 0.05); display: flex; align-items: center; gap: 0.75rem;">
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="font-weight: 500; color: #fff; font-size: 0.875rem; margin-bottom: 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                            <i class="fas fa-undo" style="color: #10b981; font-size: 0.7rem; margin-right: 0.25rem;"></i>
                                            ${escapeHtml(t.description)}
                                        </div>
                                        <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.25rem;">${new Date(t.date + 'T12:00:00').toLocaleDateString('pt-BR')} • Reembolso</div>
                                        <div style="font-weight: 600; color: #10b981; font-size: 0.875rem;">- ${formatCurrencyDisplay(t.value)}</div>
                                    </div>
                                    <div style="display: flex; gap: 0.25rem; flex-shrink: 0;">
                                        <button class="btn-icon btn-icon-sm" data-action="edit-credit-transaction" data-id="${escapeHtml(t.id)}" title="Editar" style="color: var(--color-neutral);">
                                            <i class="fas fa-edit" style="font-size: 0.75rem;"></i>
                                        </button>
                                        <button class="btn-icon btn-icon-sm danger" data-action="delete-credit-transaction" data-id="${escapeHtml(t.id)}" title="Excluir">
                                            <i class="fas fa-trash" style="font-size: 0.75rem;"></i>
                                        </button>
                                    </div>
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
                                <div style="font-weight: 500; color: #fff; font-size: 0.875rem; margin-bottom: 0.25rem;">${escapeHtml(inst.description)}</div>
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
                            <div style="font-weight: 500; color: #fff; font-size: 0.875rem; margin-bottom: 0.25rem;">${escapeHtml(sub.name)}</div>
                            <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.25rem;">${escapeHtml(sub.category)}</div>
                            <div style="font-weight: 600; color: #8b5cf6; font-size: 0.875rem;">${formatCurrencyDisplay(sub.value)}</div>
                        </div>
                    `).join('') : '<div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.875rem;">Nenhuma assinatura</div>'}
                </div>
            </div>
        </div>
    `;

    const billContentEl = document.getElementById('cardBillDetailsContent');
    if (billContentEl) billContentEl.innerHTML = html;
    document.getElementById('cardBillDetailsModal')?.classList.add('active');
}

let selectedCardId = null;

// ===========================
// CREDIT CARDS - CRUD
// ===========================
// 📲 Processa envio do formulário de cartão de crédito
async function handleCreditCardSubmit(e) {
    e.preventDefault();

    const cardNameEl = document.getElementById('cardName');
    const cardInstEl = document.getElementById('cardInstitution');
    const cardLimitEl = document.getElementById('cardLimit');
    const cardClosingEl = document.getElementById('cardClosingDay');
    const cardDueEl = document.getElementById('cardDueDay');
    const name = cardNameEl ? cardNameEl.value.trim() : '';
    const institution = cardInstEl ? cardInstEl.value.trim() : '';
    const limitStr = cardLimitEl ? cardLimitEl.value : '';
    const closingDay = parseInt(cardClosingEl ? cardClosingEl.value : '0');
    const dueDay = parseInt(cardDueEl ? cardDueEl.value : '0');

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
        logger.error('Erro ao salvar cartão:', error);
        showToast('Erro ao salvar cartão', 'error');
    } finally {
        hideLoading();
    }
}

// 📲 Processa envio de gasto avulso no cartão (sistema antigo)
async function handleCardExpenseSubmit(e) {
    e.preventDefault();

    const expCardEl = document.getElementById('expenseCard');
    const expDescEl = document.getElementById('expenseDescription');
    const expValueEl = document.getElementById('expenseValue');
    const expDateEl = document.getElementById('expenseDate');
    const expCatEl = document.getElementById('expenseCategory');
    const cardId = expCardEl ? expCardEl.value : '';
    const description = expDescEl ? expDescEl.value.trim() : '';
    const valueStr = expValueEl ? expValueEl.value : '';
    const date = expDateEl ? expDateEl.value : '';
    const category = expCatEl ? expCatEl.value : '';

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

        // Incrementar contador de uso da categoria
        if (typeof incrementCategoryUsage === 'function') {
            incrementCategoryUsage(category);
        }

        await loadCardExpenses();
        updateAllDisplays();
        closeCardExpenseModal();
        showToast('Gasto adicionado com sucesso', 'success');
    } catch (error) {
        logger.error('Erro ao salvar gasto:', error);
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
        logger.error('Erro ao deletar cartão:', error);
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
// !!! SINCRONIZADO COM: functions/index.js -> buildFinancialOverview() !!!
// Se editar os calculos aqui, edite tambem no backend para manter
// os valores consistentes entre dashboard e bot WhatsApp.
// Linhas criticas: 2316-2350 (calculo do saldo)
// ===========================
// Atualiza todos os indicadores (KPIs) do dashboard
function updateKPIs() {
    // Usar mês selecionado se disponível, senão mês atual
    const displayMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
    const displayYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();
    const currentMonth = displayMonth;
    const currentYear = displayYear;

    // Obter data de corte das configurações
    const cutoffDate = userSettings.cutoffDate || null;

    // Filter transactions for current month (aplicando data de corte)
    const currentMonthTransactions = transactions.filter(t => {
        // Filtrar por data de corte
        if (cutoffDate && t.date < cutoffDate) return false;
        const transactionDate = new Date(t.date + 'T12:00:00');
        return transactionDate.getMonth() === currentMonth &&
               transactionDate.getFullYear() === currentYear;
    });

    // Total Income (current month) - exclui reembolsos no crédito
    const totalIncome = currentMonthTransactions
        .filter(t => t.type === 'income' && t.paymentMethod !== 'credit')
        .reduce((sum, t) => sum + (t.value || 0), 0);

    // Total Expense (current month) - apenas débito direto (crédito é contado na fatura do cartão)
    // NOTA: Isso já inclui pagamentos de fatura (que são transações de débito automáticas)
    const totalExpenseDebit = currentMonthTransactions
        .filter(t => t.type === 'expense' && t.paymentMethod !== 'credit')
        .reduce((sum, t) => sum + (t.value || 0), 0);

    // Total Credit Cards (current bills) - calculado antes para usar no totalExpense
    logger.log(`\n💳💳💳 Calculando TOTAL de faturas de ${creditCards.length} cartões:`);
    const totalCreditCards = creditCards.reduce((sum, card) => {
        const billValue = calculateCurrentBill(card, currentMonth, currentYear);
        logger.log(`   📌 "${card.name}": R$ ${billValue.toFixed(2)}`);
        return sum + billValue;
    }, 0);
    logger.log(`   🧾 SOMA TOTAL DAS FATURAS: R$ ${totalCreditCards.toFixed(2)}\n`);

    // Calcular faturas pagas e não pagas do mês atual
    const paidBillsThisMonth = creditCardPayments.filter(p =>
        p.month === currentMonth && p.year === currentYear
    );
    const totalPaidBills = paidBillsThisMonth.reduce((sum, p) => sum + (p.paidAmount || 0), 0);

    // Faturas não pagas = Total das faturas - Faturas que já foram pagas
    // Calculamos para cada cartão se a fatura do mês está paga
    const totalUnpaidBills = creditCards.reduce((sum, card) => {
        const billValue = calculateCurrentBill(card, currentMonth, currentYear);
        const { endDate: billEnd } = getBillPeriod(card, currentMonth, currentYear);
        const isPaid = isBillPaid(card.id, billEnd.getMonth(), billEnd.getFullYear());
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

    // SALDO BANCÁRIO REAL = Entradas - Saídas em débito
    // Se houver data de corte (cutoffDate), só conta transações após essa data
    // (cutoffDate já foi declarado no início da função)

    logger.log('[KPIs] Data de corte configurada:', cutoffDate);
    logger.log('[KPIs] Total de transações:', transactions.length);

    const totalIncomeAllTime = transactions
        .filter(t => {
            if (!t.type || t.type !== 'income' || t.paymentMethod === 'credit') return false;
            // Se há data de corte, só conta transações após essa data
            if (cutoffDate && t.date < cutoffDate) {
                logger.log('[KPIs] Transação de entrada IGNORADA por data:', t.date, '<', cutoffDate, '- Valor:', t.value);
                return false;
            }
            return true;
        })
        .reduce((sum, t) => sum + (t.value || 0), 0);

    const totalDebitAllTime = transactions
        .filter(t => {
            if (!t.type || t.type !== 'expense' || t.paymentMethod === 'credit') return false;
            // Se há data de corte, só conta transações após essa data
            if (cutoffDate && t.date < cutoffDate) {
                logger.log('[KPIs] Transação de saída IGNORADA por data:', t.date, '<', cutoffDate, '- Valor:', t.value);
                return false;
            }
            return true;
        })
        .reduce((sum, t) => sum + (t.value || 0), 0);

    logger.log('[KPIs] Saldo calculado - Entradas:', totalIncomeAllTime, 'Saídas:', totalDebitAllTime, 'Saldo:', totalIncomeAllTime - totalDebitAllTime);

    // Total de investimentos (separado, não afeta o saldo)
    const totalInvestments = investments.reduce((sum, inv) => sum + (inv.value || 0), 0);

    // SALDO = Entradas - Saídas(débito)
    // NOTA: As saídas de débito já incluem pagamentos de fatura (via transação automática)
    // Então o saldo desconta automaticamente quando a fatura é paga
    // IMPORTANTE: Investimentos NÃO afetam o saldo, são mostrados separadamente
    // Se cutoffDate estiver definida, só conta transações após essa data
    const totalBalance = totalIncomeAllTime - totalDebitAllTime;

    // Log de debug para verificar cálculos
    logger.log('[KPIs] Cálculos do mês:', {
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

    logger.log('[KPIs] Componentes do saldo:', {
        entradasHistoricas: totalIncomeAllTime,
        saidasDebito: totalDebitAllTime,
        saldoCalculado: totalBalance
    });

    logger.log('[KPIs] Investimentos (separado):', {
        totalInvestido: totalInvestments
    });

    // Total Active Subscriptions
    const totalSubscriptions = subscriptions
        .filter(s => s.status === 'active')
        .reduce((sum, s) => sum + (s.value || 0), 0);

    // Total Pending Installments (all remaining)
    const totalInstallments = installments.reduce((sum, inst) => {
        // Verificar se o parcelamento ja terminou
        if (inst.startMonth !== undefined && inst.startYear !== undefined) {
            const refMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
            const refYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();
            const monthsDiff = (refYear - inst.startYear) * 12 + (refMonth - inst.startMonth);
            const calculatedCurrent = 1 + monthsDiff;
            if (calculatedCurrent > inst.totalInstallments) return sum; // Ja terminou
        }
        const current = calculateCurrentInstallment(inst);
        const remaining = inst.totalInstallments - current + 1;
        const installmentValue = inst.installmentValue || (inst.totalValue / inst.totalInstallments);
        return sum + (installmentValue * remaining);
    }, 0);

    // Monthly Installments (only current selected month)
    const monthlyInstallments = installments.reduce((sum, inst) => {
        // Verifica se a parcela está ativa no mês selecionado
        const isActive = isInstallmentActiveInMonth(inst, currentMonth, currentYear);
        logger.log(`Parcelamento "${inst.description}": ativo=${isActive}, currentInstallment=${inst.currentInstallment}, total=${inst.totalInstallments}, startMonth=${inst.startMonth}, startYear=${inst.startYear}`);

        if (isActive) {
            const installmentValue = inst.installmentValue || (inst.totalValue / inst.totalInstallments);
            return sum + installmentValue;
        }
        return sum;
    }, 0);

    // Projection for Current Month (mudado de Next Month)
    // Calcula saldo líquido: entradas - saídas
    const totalProjection = projections
        .filter(p => {
            if (p.status !== 'pending') return false;
            const projDate = new Date(p.date + 'T12:00:00');
            return projDate.getMonth() === currentMonth && projDate.getFullYear() === currentYear;
        })
        .reduce((sum, p) => {
            // Se for saída (expense), subtrai; se for entrada (income ou sem tipo), soma
            if (p.type === 'expense') {
                return sum - p.value;
            }
            return sum + p.value;
        }, 0);

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
        // Mostra projeção se houver QUALQUER mudança pendente (entrada, saída ou fatura)
        const hasAnyProjection = pendingIncomeProjections > 0 || totalUnpaidBills > 0 || pendingExpenseProjections > 0;
        balanceProjectionEl.style.display = hasAnyProjection ? 'block' : 'none';
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
// WHATSAPP INTEGRATION
// ===========================

/**
 * Carrega o status do WhatsApp vinculado ao usuario
 */
async function loadWhatsAppStatus() {
    const statusContainer = document.getElementById('whatsappStatus');
    const linkForm = document.getElementById('whatsappLinkForm');

    if (!statusContainer) return;

    // Mostrar loading
    statusContainer.innerHTML = `
        <div class="whatsapp-loading">
            <i class="fas fa-spinner fa-spin"></i> Verificando...
        </div>
    `;
    if (linkForm) linkForm.style.display = 'none';

    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            statusContainer.innerHTML = `
                <div class="whatsapp-not-linked">
                    <i class="fas fa-exclamation-circle"></i>
                    Faca login para vincular seu WhatsApp
                </div>
            `;
            return;
        }

        const token = await user.getIdToken();
        const response = await fetch(`${ENV_CONFIG.FUNCTIONS_URL}/linkMyWhatsApp`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (result.linked) {
            // Numero vinculado - mostrar info e botao de desvincular
            const formattedNumber = formatWhatsAppNumber(result.whatsappNumber);
            statusContainer.innerHTML = `
                <div class="whatsapp-linked">
                    <div class="whatsapp-linked-info">
                        <div class="whatsapp-linked-icon">
                            <i class="fab fa-whatsapp"></i>
                        </div>
                        <div class="whatsapp-linked-details">
                            <span class="whatsapp-linked-number">${formattedNumber}</span>
                            <span class="whatsapp-linked-label">Vinculado ao Claytinho</span>
                        </div>
                    </div>
                    <button class="btn-whatsapp-unlink" data-action="unlink-whatsapp">
                        <i class="fas fa-unlink"></i> Desvincular
                    </button>
                </div>
            `;
            if (linkForm) linkForm.style.display = 'none';
        } else {
            // Nenhum numero vinculado - mostrar form
            statusContainer.innerHTML = `
                <div class="whatsapp-not-linked">
                    <i class="fab fa-whatsapp"></i>
                    Nenhum numero vinculado
                </div>
            `;
            if (linkForm) linkForm.style.display = 'block';
        }

    } catch (error) {
        logger.error('[loadWhatsAppStatus] Erro:', error);
        statusContainer.innerHTML = `
            <div class="whatsapp-not-linked">
                <i class="fas fa-exclamation-triangle"></i>
                Erro ao verificar status
            </div>
        `;
        if (linkForm) linkForm.style.display = 'block';
    }
}

/**
 * Formata numero de WhatsApp para exibicao
 */
function formatWhatsAppNumber(number) {
    if (!number) return '';
    // Formato: +55 (21) 99999-9999
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.length === 13) {
        return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    } else if (cleaned.length === 12) {
        return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return number;
}

/**
 * Vincula numero de WhatsApp a conta do usuario
 */
async function linkMyWhatsApp() {
    const input = document.getElementById('whatsappNumberInput');
    const btn = document.querySelector('.btn-whatsapp-link');

    if (!input || !btn) return;

    const number = input.value.replace(/\D/g, '');

    if (!number || number.length < 12 || number.length > 13) {
        showToast('Numero invalido. Use formato: 5521999999999', 'warning');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Vinculando...';

    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            showToast('Faca login primeiro', 'error');
            return;
        }

        const token = await user.getIdToken();
        const response = await fetch(`${ENV_CONFIG.FUNCTIONS_URL}/linkMyWhatsApp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ whatsappNumber: number })
        });

        const result = await response.json();

        if (response.ok) {
            showToast(result.message || 'Numero vinculado com sucesso!', 'success');
            input.value = '';
            loadWhatsAppStatus(); // Recarregar status
        } else {
            showToast(result.message || result.error || 'Erro ao vincular', 'error');
        }

    } catch (error) {
        logger.error('[linkMyWhatsApp] Erro:', error);
        showToast('Erro ao vincular numero', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-link"></i> Vincular Numero';
    }
}

/**
 * Desvincula numero de WhatsApp da conta do usuario
 */
async function unlinkMyWhatsApp() {
    if (!confirm('Deseja realmente desvincular seu numero do Claytinho?')) {
        return;
    }

    const statusContainer = document.getElementById('whatsappStatus');
    if (statusContainer) {
        statusContainer.innerHTML = `
            <div class="whatsapp-loading">
                <i class="fas fa-spinner fa-spin"></i> Desvinculando...
            </div>
        `;
    }

    try {
        const user = firebase.auth().currentUser;
        if (!user) {
            showToast('Faca login primeiro', 'error');
            loadWhatsAppStatus();
            return;
        }

        const token = await user.getIdToken();
        const response = await fetch(`${ENV_CONFIG.FUNCTIONS_URL}/linkMyWhatsApp`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const result = await response.json();

        if (response.ok) {
            showToast(result.message || 'Numero desvinculado', 'success');
            loadWhatsAppStatus(); // Recarregar status
        } else {
            showToast(result.message || result.error || 'Erro ao desvincular', 'error');
            loadWhatsAppStatus();
        }

    } catch (error) {
        logger.error('[unlinkMyWhatsApp] Erro:', error);
        showToast('Erro ao desvincular numero', 'error');
        loadWhatsAppStatus();
    }
}

// Expor funcoes globalmente
window.loadWhatsAppStatus = loadWhatsAppStatus;
window.linkMyWhatsApp = linkMyWhatsApp;
window.unlinkMyWhatsApp = unlinkMyWhatsApp;

logger.log('[OK] Finance Data v3.0 - Loaded');