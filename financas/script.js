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
    'Supermercado',
    'Restaurantes',
    'Transporte',
    'Combustível',
    'Uber/Taxi',
    'Moradia',
    'Aluguel',
    'Condomínio',
    'Água',
    'Luz',
    'Internet',
    'Gás',
    'IPTU',
    'Saúde',
    'Plano de Saúde',
    'Farmácia',
    'Consultas',
    'Educação',
    'Cursos',
    'Livros',
    'Material Escolar',
    'Lazer',
    'Streaming',
    'Cinema',
    'Viagens',
    'Compras',
    'Roupas',
    'Eletrônicos',
    'Casa e Decoração',
    'Beleza e Cuidados',
    'Pet',
    'Serviços',
    'Academia',
    'Seguros',
    'Investimentos',
    'Presentes',
    'Doações',
    'Impostos',
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
let creditCards = [];
let cardExpenses = [];
let currentFilter = 'all';
let currentTransactionType = 'income';
let currentPaymentMethod = 'debit';
let editingTransactionId = null;
let editingSubscriptionId = null;
let editingInstallmentId = null;
let editingCardId = null;

// Multi-user system
let activeUserId = null; // ID do usuário ativo (pode ser diferente de activeUserId)
let activeUserEmail = null; // Email do usuário ativo
const COMPANY_EMAIL = '3d3printers@gmail.com';

// ApexCharts instances
let cashFlowChart = null;
let categoryChart = null;
let comparisonChart = null;
let topCategoriesChart = null;
let weeklyTrendChart = null;
let savingsGoalChart = null;
let expenseLimitChart = null;

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
            // Mostrar modal de seleção de conta
            showAccountSelectionModal(user);
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
// ACCOUNT SELECTION (Multi-User System)
// ===========================
function showAccountSelectionModal(user) {
    // Verificar se existe preferência salva
    const savedAccountType = localStorage.getItem('selectedAccountType');

    if (savedAccountType) {
        // Usar conta salva automaticamente
        selectAccount(savedAccountType);
        return;
    }

    // Atualizar email pessoal no modal
    document.getElementById('personalAccountEmail').textContent = user.email;

    // Esconder login screen
    document.getElementById('loginScreen').style.display = 'none';

    // Mostrar modal de seleção
    document.getElementById('accountSelectionModal').classList.add('active');
}

async function selectAccount(accountType) {
    showLoading('Carregando dados...');

    // Fechar modal
    document.getElementById('accountSelectionModal').classList.remove('active');

    if (accountType === 'company') {
        // Acessar como conta da empresa
        // Buscar UID da conta da empresa no systemConfig
        try {
            const configDoc = await db.collection('systemConfig').doc('companyAccount').get();

            if (configDoc.exists) {
                // Usar UID salvo na configuração
                activeUserId = configDoc.data().userId;
                activeUserEmail = COMPANY_EMAIL;
                console.log('Usando UID da empresa do systemConfig:', activeUserId);
            } else {
                // Se não existe configuração, criar automaticamente
                // Isso só acontecerá quando 3d3printers@gmail.com fizer login
                if (currentUser.email === COMPANY_EMAIL) {
                    showToast('Configurando conta da empresa pela primeira vez...', 'info');
                    await db.collection('systemConfig').doc('companyAccount').set({
                        userId: currentUser.uid,
                        email: COMPANY_EMAIL,
                        displayName: 'ImaginaTech - Caixa Interno',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                        createdBy: currentUser.email
                    });
                    activeUserId = currentUser.uid;
                    activeUserEmail = COMPANY_EMAIL;
                    console.log('Configuração da empresa criada com UID:', activeUserId);
                } else {
                    // Admin tentando acessar empresa, mas configuração não existe
                    showToast('Conta da empresa ainda não foi configurada. Entre primeiro com 3d3printers@gmail.com', 'error');
                    // Voltar para seleção
                    localStorage.removeItem('selectedAccountType');
                    showAccountSelectionModal(currentUser);
                    hideLoading();
                    return;
                }
            }
        } catch (error) {
            console.error('Erro ao buscar conta da empresa:', error);
            showToast('Erro ao acessar conta da empresa', 'error');
            hideLoading();
            return;
        }
    } else {
        // Acessar como conta pessoal
        activeUserId = currentUser.uid;
        activeUserEmail = currentUser.email;
        console.log('Usando conta pessoal com UID:', activeUserId);
    }

    // Salvar preferência no localStorage
    localStorage.setItem('selectedAccountType', accountType);

    // Atualizar display da conta ativa
    updateAccountDisplay(accountType);

    // Mostrar dashboard e inicializar
    showDashboard(currentUser);
    initializeDashboard();
}

function switchAccount() {
    // Limpar preferência salva
    localStorage.removeItem('selectedAccountType');

    // Esconder dashboard
    document.getElementById('dashboard').classList.add('hidden');

    // Mostrar modal de seleção novamente
    showAccountSelectionModal(currentUser);
}

function updateAccountDisplay(accountType) {
    const userRole = document.getElementById('userRole');
    if (userRole) {
        if (accountType === 'company') {
            userRole.textContent = 'Caixa Interno da Empresa';
        } else {
            userRole.textContent = 'Conta Pessoal';
        }
    }
}

// ===========================
// CENTRAL UPDATE FUNCTION
// ===========================
function updateAllDisplays() {
    console.log('[updateAllDisplays] Atualizando todos os componentes...');

    // Atualizar KPIs
    if (typeof updateKPIs === 'function') {
        updateKPIs();
    }

    // Atualizar gráficos
    if (typeof updateCharts === 'function') {
        updateCharts();
    }

    console.log('[updateAllDisplays] Todos os componentes atualizados!');
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
            loadProjections(),
            loadCreditCards()
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

        // Migrar parcelamentos antigos automaticamente (se necessário)
        // Fazemos isso em background para não bloquear a interface
        setTimeout(() => {
            const oldInstallments = installments.filter(i =>
                i.startMonth === undefined || i.startYear === undefined
            );
            if (oldInstallments.length > 0) {
                console.log('[initializeDashboard] Detectados parcelamentos antigos, iniciando migração automática...');
                migrateOldInstallments();
            }
        }, 1000);

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
            .where('userId', '==', activeUserId)
            .orderBy('date', 'desc')
            .get();

        transactions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${transactions.length} transações carregadas`);
    } catch (error) {
        console.error('Erro ao carregar transações:', error);
        // Não mostra toast aqui para não poluir - já mostra no catch principal
        transactions = []; // Garante array vazio
    }
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

    // Validar cartão de crédito se for despesa no crédito
    if (currentTransactionType === 'expense' && currentPaymentMethod === 'credit') {
        const cardId = document.getElementById('transactionCard').value;
        if (!cardId) {
            showToast('Selecione um cartão de crédito', 'error');
            return;
        }
    }

    const value = parseCurrencyInput(valueStr);
    if (value <= 0) {
        showToast('Valor inválido', 'error');
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

        // Adicionar informações de pagamento apenas para despesas
        if (currentTransactionType === 'expense') {
            transactionData.paymentMethod = currentPaymentMethod;
            if (currentPaymentMethod === 'credit') {
                transactionData.cardId = document.getElementById('transactionCard').value;
            }
        }

        if (editingTransactionId) {
            // Editando transação existente
            await db.collection('transactions').doc(editingTransactionId).update({
                ...transactionData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Transação atualizada com sucesso', 'success');
        } else {
            // Criando nova transação
            await db.collection('transactions').add({
                ...transactionData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showToast('Transação adicionada com sucesso', 'success');
        }

        await loadTransactions();
        updateAllDisplays();
        closeTransactionModal();
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
        updateAllDisplays();
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
            // Calcular o mês de início baseado em currentInstallment ou paidInstallments
            const current = inst.currentInstallment || (inst.paidInstallments ? inst.paidInstallments + 1 : 1);

            // Se a parcela atual é X, significa que começou há (X - 1) meses atrás
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
        console.log('[migrateOldInstallments] Migração concluída!');
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

// Função para corrigir startMonth de parcelamentos existentes
async function fixInstallmentsStartMonth() {
    try {
        const displayMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : new Date().getMonth();
        const displayYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : new Date().getFullYear();

        console.log(`\n🔍 [MIGRAÇÃO] Verificando parcelamentos... (ref: mês ${displayMonth + 1}/${displayYear})`);

        const toFix = installments.filter(inst => {
            // Verifica se precisa correção: se startMonth está definido mas parece errado
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

            // Se está diferente, precisa corrigir
            const needsFix = (inst.startMonth !== correctStartMonth || inst.startYear !== correctStartYear);

            if (needsFix) {
                console.log(`   🔧 "${inst.description}": ${inst.startMonth + 1}/${inst.startYear} → ${correctStartMonth + 1}/${correctStartYear} (parcela ${inst.currentInstallment}/${inst.totalInstallments})`);
            }

            return needsFix;
        });

        if (toFix.length === 0) {
            console.log(`   ✅ Todos os parcelamentos estão corretos!\n`);
            return;
        }

        console.log(`\n🔧 Corrigindo ${toFix.length} parcelamentos com startMonth incorreto...`);

        for (const inst of toFix) {
            const monthsBack = inst.currentInstallment - 1;
            let startMonth = displayMonth - monthsBack;
            let startYear = displayYear;

            while (startMonth < 0) {
                startMonth += 12;
                startYear--;
            }

            console.log(`   Corrigindo "${inst.description}": ${inst.startMonth + 1}/${inst.startYear} → ${startMonth + 1}/${startYear}`);

            await db.collection('installments').doc(inst.id).update({
                startMonth,
                startYear,
                migratedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Atualizar no array local
            inst.startMonth = startMonth;
            inst.startYear = startYear;
        }

        console.log(`✅ ${toFix.length} parcelamentos corrigidos!\n`);
    } catch (error) {
        console.error('Erro ao corrigir parcelamentos:', error);
    }
}

// Função auxiliar para calcular a parcela atual baseada na data
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
        console.error('Erro ao salvar parcelamento:', error);
        showToast('Erro ao salvar parcelamento', 'error');
    } finally {
        hideLoading();
    }
}

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
async function loadProjections() {
    try {
        console.log('Carregando projeções...');
        const snapshot = await db.collection('projections')
            .where('userId', '==', activeUserId)
            .orderBy('date', 'asc')
            .get();

        projections = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${projections.length} projeções carregadas`);
    } catch (error) {
        console.error('Erro ao carregar projeções:', error);
        projections = [];
    }
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
            userId: activeUserId,
            description,
            value,
            date,
            status,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        await loadProjections();
        updateAllDisplays();
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
        updateAllDisplays();
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
        updateAllDisplays();
        showToast('Projeção deletada com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao deletar projeção:', error);
        showToast('Erro ao deletar projeção', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// CREDIT CARDS - LOAD & RENDER
// ===========================
async function loadCreditCards() {
    try {
        console.log('Carregando cartões de crédito...');
        const snapshot = await db.collection('creditCards')
            .where('userId', '==', activeUserId)
            .orderBy('createdAt', 'desc')
            .get();

        creditCards = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${creditCards.length} cartões carregados`);
        await loadCardExpenses();
    } catch (error) {
        console.error('Erro ao carregar cartões:', error);
        creditCards = [];
    }
}

async function loadCardExpenses() {
    try {
        const snapshot = await db.collection('cardExpenses')
            .where('userId', '==', activeUserId)
            .get();

        cardExpenses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`${cardExpenses.length} gastos de cartão carregados`);
    } catch (error) {
        console.error('Erro ao carregar gastos:', error);
        cardExpenses = [];
    }
}

// Contador de chamadas (para debug)
let calculateBillCallCount = 0;

function calculateCurrentBill(card, overrideMonth = null, overrideYear = null) {
    calculateBillCallCount++;
    console.log(`\n🔍 [CHAMADA #${calculateBillCallCount}] calculateCurrentBill("${card.name}")`);

    const today = new Date();
    // Usar mês/ano passados como parâmetro, ou mês selecionado no display, ou mês atual
    const currentMonth = overrideMonth !== null ? overrideMonth :
                        (typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : today.getMonth());
    const currentYear = overrideYear !== null ? overrideYear :
                       (typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : today.getFullYear());

    // Determinar período da fatura
    let billStartDate, billEndDate, billMonth, billYear;

    // Se há navegação de mês (currentDisplayMonth definido OU overrideMonth passado),
    // sempre usar a lógica de navegação, independente do dia atual
    const isNavigating = (overrideMonth !== null || typeof currentDisplayMonth !== 'undefined');

    if (isNavigating) {
        // Navegando entre meses: mostrar fatura ABERTA (sendo construída) no mês selecionado
        // Esta é a fatura DO MÊS visualizado, que fecha no mês seguinte
        billStartDate = new Date(currentYear, currentMonth, card.closingDay);
        billEndDate = new Date(currentYear, currentMonth + 1, card.closingDay - 1);
        // A fatura É DO MÊS visualizado (ex: fatura de dezembro que fecha em janeiro)
        billMonth = currentMonth;
        billYear = currentYear;
    } else {
        // Mês atual: usar lógica baseada no dia de fechamento
        if (today.getDate() >= card.closingDay) {
            // Período atual: dia de fechamento do mês atual até dia de fechamento do próximo mês
            billStartDate = new Date(currentYear, currentMonth, card.closingDay);
            billEndDate = new Date(currentYear, currentMonth + 1, card.closingDay - 1);
            // A fatura fecha no próximo mês
            billMonth = currentMonth + 1;
            billYear = currentYear;
            if (billMonth > 11) {
                billMonth = 0;
                billYear++;
            }
        } else {
            // Período anterior: dia de fechamento do mês anterior até dia de fechamento do mês atual
            billStartDate = new Date(currentYear, currentMonth - 1, card.closingDay);
            billEndDate = new Date(currentYear, currentMonth, card.closingDay - 1);
            // A fatura fecha no mês atual
            billMonth = currentMonth;
            billYear = currentYear;
        }
    }

    // Somar gastos do período (cardExpenses antigos + transações de crédito)
    const expensesTotal = cardExpenses
        .filter(expense => {
            if (expense.cardId !== card.id) return false;
            const expenseDate = new Date(expense.date);
            return expenseDate >= billStartDate && expenseDate <= billEndDate;
        })
        .reduce((sum, expense) => sum + expense.value, 0);

    // Somar transações de crédito do período
    const allCreditTransactions = transactions.filter(t => t.type === 'expense' && t.paymentMethod === 'credit');

    console.log(`\n💰 [DEBUG TRANSAÇÕES CRÉDITO] Total de transações de crédito: ${allCreditTransactions.length}`);
    allCreditTransactions.forEach(t => {
        const tDate = new Date(t.date + 'T12:00:00');
        const matchesCard = t.cardId === card.id;
        const inPeriod = tDate >= billStartDate && tDate <= billEndDate;
        console.log(`   ${matchesCard && inPeriod ? '✅' : '❌'} "${t.description}": R$ ${t.value.toFixed(2)} em ${tDate.toLocaleDateString('pt-BR')}`);
        console.log(`      cardId: ${t.cardId} ${matchesCard ? '✅' : `❌ (esperado: ${card.id})`}`);
        console.log(`      Período: ${inPeriod ? '✅' : `❌ (fora de ${billStartDate.toLocaleDateString('pt-BR')} - ${billEndDate.toLocaleDateString('pt-BR')})`}`);
    });

    const creditTransactionsTotal = transactions
        .filter(t => {
            if (t.type !== 'expense' || t.paymentMethod !== 'credit' || t.cardId !== card.id) return false;
            const transactionDate = new Date(t.date + 'T12:00:00');
            return transactionDate >= billStartDate && transactionDate <= billEndDate;
        })
        .reduce((sum, t) => sum + t.value, 0);

    console.log(`   💵 TOTAL TRANSAÇÕES CRÉDITO INCLUÍDAS: R$ ${creditTransactionsTotal.toFixed(2)}\n`);

    // Log detalhado do período da fatura
    console.log(`📅 [FATURA ${card.name}] Calculando fatura do mês ${billMonth + 1}/${billYear}`);
    console.log(`   Período: ${billStartDate.toLocaleDateString('pt-BR')} até ${billEndDate.toLocaleDateString('pt-BR')}`);
    console.log(`   Dia de fechamento: ${card.closingDay}`);

    // Somar parcelas ativas deste cartão no mês da fatura
    console.log(`\n💳 Analisando ${installments.filter(i => i.cardId === card.id).length} parcelamentos do cartão "${card.name}":`);

    const installmentsFiltered = installments.filter(inst => {
        if (inst.cardId !== card.id) return false;

        // Para parcelamentos antigos sem startMonth/startYear, usar lógica antiga
        if (inst.startMonth === undefined || inst.startYear === undefined) {
            console.log(`   ⚠️ "${inst.description}": SEM DATA DE INÍCIO - usando lógica antiga`);
            return inst.currentInstallment <= inst.totalInstallments;
        }

        // Calcular quantos meses se passaram desde o início do parcelamento (parcela 1)
        const monthsSinceStart = (billYear - inst.startYear) * 12 + (billMonth - inst.startMonth);

        // Se o mês da fatura é antes do início do parcelamento, não incluir
        if (monthsSinceStart < 0) {
            console.log(`   ❌ "${inst.description}": Ainda não começou (início: ${inst.startMonth + 1}/${inst.startYear})`);
            return false;
        }

        // Calcular qual parcela está vencendo neste mês
        // startMonth é o mês da PARCELA 1, então:
        // parcela deste mês = 1 + meses desde o início
        const installmentForThisMonth = 1 + monthsSinceStart;

        const installmentValue = inst.totalValue / inst.totalInstallments;
        const isValid = installmentForThisMonth >= 1 && installmentForThisMonth <= inst.totalInstallments;

        if (isValid) {
            console.log(`   ✅ "${inst.description}": Parcela ${installmentForThisMonth}/${inst.totalInstallments} = R$ ${installmentValue.toFixed(2)}`);
            console.log(`      Início: ${inst.startMonth + 1}/${inst.startYear}, Meses desde início: ${monthsSinceStart}`);
        } else {
            console.log(`   ❌ "${inst.description}": Parcela ${installmentForThisMonth}/${inst.totalInstallments} - FORA DO RANGE`);
        }

        return isValid;
    });

    const installmentsTotal = installmentsFiltered.reduce((sum, inst) => {
        const installmentValue = inst.installmentValue || (inst.totalValue / inst.totalInstallments);
        return sum + installmentValue;
    }, 0);
    console.log(`\n💰 TOTAL PARCELAS: R$ ${installmentsTotal.toFixed(2)} (${installmentsFiltered.length} parcelas ativas)`);

    // Somar assinaturas ativas deste cartão
    const subscriptionsFiltered = subscriptions.filter(sub => sub.cardId === card.id && sub.status === 'active');
    const subscriptionsTotal = subscriptionsFiltered.reduce((sum, sub) => sum + sub.value, 0);

    if (subscriptionsFiltered.length > 0) {
        console.log(`\n🔄 Assinaturas ativas: ${subscriptionsFiltered.length}`);
        subscriptionsFiltered.forEach(sub => {
            console.log(`   ✅ "${sub.name}": R$ ${sub.value.toFixed(2)}/mês`);
        });
    }

    const totalBill = expensesTotal + creditTransactionsTotal + installmentsTotal + subscriptionsTotal;

    // Resumo final da fatura
    console.log(`\n📊 ===== RESUMO DA FATURA ${card.name} - ${billMonth + 1}/${billYear} =====`);
    console.log(`   💵 Gastos avulsos (cardExpenses): R$ ${expensesTotal.toFixed(2)}`);
    console.log(`   💳 Compras em crédito: R$ ${creditTransactionsTotal.toFixed(2)}`);
    console.log(`   📦 Parcelas (${installmentsFiltered.length}): R$ ${installmentsTotal.toFixed(2)}`);
    console.log(`   🔄 Assinaturas (${subscriptionsFiltered.length}): R$ ${subscriptionsTotal.toFixed(2)}`);
    console.log(`   🧾 TOTAL DA FATURA: R$ ${totalBill.toFixed(2)}`);
    console.log(`========================================\n`);

    return totalBill;
}

// ===========================
// CREDIT CARDS - MODALS
// ===========================
function openCreditCardModal() {
    editingCardId = null;
    document.getElementById('creditCardModal').classList.add('active');
    document.getElementById('creditCardForm').reset();
    document.querySelector('#creditCardModal .modal-header h2').textContent = 'Novo Cartão de Crédito';
}

function closeCreditCardModal() {
    editingCardId = null;
    document.getElementById('creditCardModal').classList.remove('active');
    document.getElementById('creditCardForm').reset();
}

function editCreditCard(id) {
    const card = creditCards.find(c => c.id === id);
    if (!card) return;

    editingCardId = id;
    document.getElementById('creditCardModal').classList.add('active');
    document.querySelector('#creditCardModal .modal-header h2').textContent = 'Editar Cartão';

    document.getElementById('cardName').value = card.name;
    document.getElementById('cardInstitution').value = card.institution;
    document.getElementById('cardLimit').value = formatCurrencyValue(card.limit);
    document.getElementById('cardClosingDay').value = card.closingDay;
    document.getElementById('cardDueDay').value = card.dueDay;
}

function showCardBillDetails(cardId) {
    const card = creditCards.find(c => c.id === cardId);
    if (!card) return;

    const today = new Date();
    const currentMonth = typeof currentDisplayMonth !== 'undefined' ? currentDisplayMonth : today.getMonth();
    const currentYear = typeof currentDisplayYear !== 'undefined' ? currentDisplayYear : today.getFullYear();

    // Calcular período da fatura (mesmo cálculo do calculateCurrentBill)
    // Se currentDisplayMonth está definido, sempre usar lógica de navegação
    const isNavigating = (typeof currentDisplayMonth !== 'undefined');

    let billStartDate, billEndDate, billMonth, billYear;

    if (isNavigating) {
        billStartDate = new Date(currentYear, currentMonth, card.closingDay);
        billEndDate = new Date(currentYear, currentMonth + 1, card.closingDay - 1);
        billMonth = currentMonth;
        billYear = currentYear;
    } else {
        if (today.getDate() >= card.closingDay) {
            billStartDate = new Date(currentYear, currentMonth, card.closingDay);
            billEndDate = new Date(currentYear, currentMonth + 1, card.closingDay - 1);
            billMonth = currentMonth + 1;
            billYear = currentYear;
            if (billMonth > 11) {
                billMonth = 0;
                billYear++;
            }
        } else {
            billStartDate = new Date(currentYear, currentMonth - 1, card.closingDay);
            billEndDate = new Date(currentYear, currentMonth, card.closingDay - 1);
            billMonth = currentMonth;
            billYear = currentYear;
        }
    }

    // Coletar todas as transações de crédito do período
    const creditTransactions = transactions.filter(t => {
        if (t.type !== 'expense' || t.paymentMethod !== 'credit' || t.cardId !== card.id) return false;
        const transactionDate = new Date(t.date + 'T12:00:00');
        return transactionDate >= billStartDate && transactionDate <= billEndDate;
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

    // Coletar assinaturas ativas
    const activeSubscriptions = subscriptions.filter(sub => sub.cardId === card.id && sub.status === 'active');

    // Calcular totais
    const creditTotal = creditTransactions.reduce((sum, t) => sum + t.value, 0);
    const installmentsTotal = activeInstallments.reduce((sum, inst) => {
        const installmentValue = inst.installmentValue || (inst.totalValue / inst.totalInstallments);
        return sum + installmentValue;
    }, 0);
    const subscriptionsTotal = activeSubscriptions.reduce((sum, sub) => sum + sub.value, 0);
    const grandTotal = creditTotal + installmentsTotal + subscriptionsTotal;

    // Montar o HTML do modal
    const monthName = new Date(billYear, billMonth).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    document.getElementById('cardBillDetailsTitle').textContent = `Fatura ${card.name} - ${monthName}`;

    let html = `
        <div style="margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(59, 130, 246, 0.1); border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.3);">
                <div>
                    <div style="font-size: 0.875rem; color: var(--text-muted);">Total da Fatura</div>
                    <div style="font-size: 1.5rem; font-weight: 700; color: #3b82f6;">${formatCurrencyDisplay(grandTotal)}</div>
                </div>
                <div style="text-align: right; font-size: 0.75rem; color: var(--text-muted);">
                    <div>Período: ${billStartDate.toLocaleDateString('pt-BR')} a ${billEndDate.toLocaleDateString('pt-BR')}</div>
                    <div>Vencimento: ${card.dueDay}/${billMonth === 11 ? '01' : String(billMonth + 2).padStart(2, '0')}</div>
                </div>
            </div>
        </div>
    `;

    // Seção de Compras no Crédito
    if (creditTransactions.length > 0) {
        html += `
            <div style="margin-bottom: 1.5rem;">
                <h3 style="font-size: 1rem; margin-bottom: 0.75rem; color: #fff; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-credit-card" style="color: #3b82f6;"></i>
                    Compras no Crédito (${creditTransactions.length})
                    <span style="margin-left: auto; font-size: 0.875rem; color: #3b82f6;">${formatCurrencyDisplay(creditTotal)}</span>
                </h3>
                <div style="background: var(--color-bg-tertiary); border-radius: 8px; border: 1px solid var(--color-border); overflow: hidden;">
                    ${creditTransactions.map(t => `
                        <div style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 500; color: #fff;">${t.description}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(t.date).toLocaleDateString('pt-BR')} • ${t.category}</div>
                            </div>
                            <div style="font-weight: 600; color: #3b82f6;">${formatCurrencyDisplay(t.value)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Seção de Parcelamentos
    if (activeInstallments.length > 0) {
        html += `
            <div style="margin-bottom: 1.5rem;">
                <h3 style="font-size: 1rem; margin-bottom: 0.75rem; color: #fff; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-calendar-alt" style="color: #f59e0b;"></i>
                    Parcelamentos (${activeInstallments.length})
                    <span style="margin-left: auto; font-size: 0.875rem; color: #f59e0b;">${formatCurrencyDisplay(installmentsTotal)}</span>
                </h3>
                <div style="background: var(--color-bg-tertiary); border-radius: 8px; border: 1px solid var(--color-border); overflow: hidden;">
                    ${activeInstallments.map(inst => {
                        // Calcular número da parcela atual
                        let currentInstallmentNum;
                        if (inst.startMonth !== undefined && inst.startYear !== undefined) {
                            const monthsSinceStart = (billYear - inst.startYear) * 12 + (billMonth - inst.startMonth);
                            currentInstallmentNum = 1 + monthsSinceStart;
                        } else {
                            // Para parcelamentos antigos, usar currentInstallment
                            currentInstallmentNum = inst.currentInstallment || 1;
                        }

                        // Calcular valor da parcela
                        const installmentValue = inst.installmentValue || (inst.totalValue / inst.totalInstallments);

                        // Categoria (pode não existir em parcelamentos antigos)
                        const category = inst.category || '';

                        return `
                            <div style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 500; color: #fff;">${inst.description}</div>
                                    <div style="font-size: 0.75rem; color: var(--text-muted);">Parcela ${currentInstallmentNum}/${inst.totalInstallments}${category ? ' • ' + category : ''}</div>
                                </div>
                                <div style="font-weight: 600; color: #f59e0b;">${formatCurrencyDisplay(installmentValue)}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // Seção de Assinaturas
    if (activeSubscriptions.length > 0) {
        html += `
            <div style="margin-bottom: 1.5rem;">
                <h3 style="font-size: 1rem; margin-bottom: 0.75rem; color: #fff; display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-sync-alt" style="color: #8b5cf6;"></i>
                    Assinaturas Recorrentes (${activeSubscriptions.length})
                    <span style="margin-left: auto; font-size: 0.875rem; color: #8b5cf6;">${formatCurrencyDisplay(subscriptionsTotal)}</span>
                </h3>
                <div style="background: var(--color-bg-tertiary); border-radius: 8px; border: 1px solid var(--color-border); overflow: hidden;">
                    ${activeSubscriptions.map(sub => `
                        <div style="padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <div style="font-weight: 500; color: #fff;">${sub.name}</div>
                                <div style="font-size: 0.75rem; color: var(--text-muted);">${sub.category}</div>
                            </div>
                            <div style="font-weight: 600; color: #8b5cf6;">${formatCurrencyDisplay(sub.value)}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Se não houver nenhum item
    if (creditTransactions.length === 0 && activeInstallments.length === 0 && activeSubscriptions.length === 0) {
        html += `
            <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
                <p>Nenhum lançamento nesta fatura</p>
            </div>
        `;
    }

    document.getElementById('cardBillDetailsContent').innerHTML = html;
    document.getElementById('cardBillDetailsModal').classList.add('active');
}

let selectedCardId = null;

function openCardExpenseModal(cardId = null) {
    selectedCardId = cardId;
    document.getElementById('cardExpenseModal').classList.add('active');
    document.getElementById('cardExpenseForm').reset();

    // Preencher dropdown de cartões
    const select = document.getElementById('expenseCard');
    select.innerHTML = '<option value="">Selecione um cartão</option>' +
        creditCards.map(card =>
            `<option value="${card.id}" ${card.id === cardId ? 'selected' : ''}>${card.name} - ${card.institution}</option>`
        ).join('');

    // Data padrão: hoje
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('expenseDate').value = today;
}

function closeCardExpenseModal() {
    selectedCardId = null;
    document.getElementById('cardExpenseModal').classList.remove('active');
    document.getElementById('cardExpenseForm').reset();
}

// ===========================
// CREDIT CARDS - CRUD
// ===========================
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
        console.error('Erro ao salvar cartão:', error);
        showToast('Erro ao salvar cartão', 'error');
    } finally {
        hideLoading();
    }
}

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

async function deleteCreditCard(id) {
    if (!confirm('Deseja realmente deletar este cartão? Todos os gastos associados serão mantidos.')) return;

    showLoading('Deletando...');

    try {
        await db.collection('creditCards').doc(id).delete();
        await loadCreditCards();
        updateAllDisplays();
        showToast('Cartão deletado com sucesso', 'success');
    } catch (error) {
        console.error('Erro ao deletar cartão:', error);
        showToast('Erro ao deletar cartão', 'error');
    } finally {
        hideLoading();
    }
}

// ===========================
// INSTALLMENT HELPER FUNCTIONS
// ===========================
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
function updateKPIs() {
    // Usar mês selecionado se disponível, senão mês atual
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

    // Total Income (current month)
    const totalIncome = currentMonthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.value, 0);

    // Total Expense (current month) - apenas débito direto (crédito é contado na fatura do cartão)
    const totalExpenseDebit = currentMonthTransactions
        .filter(t => t.type === 'expense' && t.paymentMethod !== 'credit')
        .reduce((sum, t) => sum + t.value, 0);

    // Total Credit Cards (current bills) - calculado antes para usar no totalExpense
    console.log(`\n💳💳💳 Calculando TOTAL de faturas de ${creditCards.length} cartões:`);
    const totalCreditCards = creditCards.reduce((sum, card) => {
        const billValue = calculateCurrentBill(card, currentMonth, currentYear);
        console.log(`   📌 "${card.name}": R$ ${billValue.toFixed(2)}`);
        return sum + billValue;
    }, 0);
    console.log(`   🧾 SOMA TOTAL DAS FATURAS: R$ ${totalCreditCards.toFixed(2)}\n`);

    // Total Expense = débito + faturas dos cartões de crédito
    const totalExpense = totalExpenseDebit + totalCreditCards;

    // SALDO BANCÁRIO REAL = Entradas - Saídas em débito
    const totalIncomeAllTime = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.value, 0);

    const totalDebitAllTime = transactions
        .filter(t => t.type === 'expense' && t.paymentMethod !== 'credit')
        .reduce((sum, t) => sum + t.value, 0);
    // NÃO inclui cartão de crédito porque:
    // - Parcelas ficam no cartão (não saem da conta)
    // - Assinaturas ficam no cartão
    // - Você paga a FATURA total mensalmente, não cada parcela
    const totalBalance = totalIncomeAllTime - totalDebitAllTime;

    // Log de debug para verificar cálculos
    console.log('[KPIs] Cálculos do mês:', {
        mes: `${currentMonth + 1}/${currentYear}`,
        entradas: totalIncome,
        saidasDebito: totalExpenseDebit,
        faturaCartoes: totalCreditCards,
        saidasTotal: totalExpense,
        saldo: totalBalance
    });

    console.log('[KPIs] Componentes do saldo:', {
        entradasHistoricas: totalIncomeAllTime,
        saidasDebito: totalDebitAllTime,
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
        // Verifica se a parcela está ativa no mês selecionado
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
    const balanceEl = document.getElementById('totalBalance');
    const subscriptionsEl = document.getElementById('totalSubscriptions');
    const installmentsEl = document.getElementById('totalInstallments');
    const installmentsMonthlyEl = document.getElementById('installmentsMonthly');
    const installmentsTotalEl = document.getElementById('installmentsTotal');
    const projectionEl = document.getElementById('totalProjection');
    const creditCardsEl = document.getElementById('totalCreditCards');

    if (incomeEl) incomeEl.textContent = formatCurrencyDisplay(totalIncome);
    if (expenseEl) expenseEl.textContent = formatCurrencyDisplay(totalExpense);
    if (balanceEl) balanceEl.textContent = formatCurrencyDisplay(totalBalance);
    if (subscriptionsEl) subscriptionsEl.textContent = formatCurrencyDisplay(totalSubscriptions);

    // Atualiza o card de parcelamentos com ambos os valores
    if (installmentsEl) installmentsEl.textContent = formatCurrencyDisplay(monthlyInstallments);
    if (installmentsMonthlyEl) installmentsMonthlyEl.textContent = formatCurrencyDisplay(monthlyInstallments);
    if (installmentsTotalEl) installmentsTotalEl.textContent = formatCurrencyDisplay(totalInstallments);

    if (projectionEl) projectionEl.textContent = formatCurrencyDisplay(totalProjection);
    if (creditCardsEl) creditCardsEl.textContent = formatCurrencyDisplay(totalCreditCards);
}

// ===========================
// APEXCHARTS - INITIALIZATION
// ===========================

// Função para destruir todos os gráficos existentes
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

function initializeCharts() {
    try {
        // Destruir gráficos existentes antes de criar novos
        destroyAllCharts();

        initializeCashFlowChart();
        initializeCategoryChart();
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
            height: 200,
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
            height: 280,
            background: 'transparent',
            fontFamily: 'Inter, sans-serif'
        },
        labels: data.categories,
        colors: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'],
        plotOptions: {
            pie: {
                donut: {
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            color: '#fff'
                        }
                    }
                }
            }
        },
        legend: {
            position: 'bottom',
            labels: {
                colors: '#94a3b8'
            }
        },
        stroke: {
            show: false
        },
        dataLabels: {
            enabled: true,
            style: {
                colors: ['#1e293b']
            }
        },
        tooltip: {
            y: {
                formatter: function (value) {
                    return formatCurrencyDisplay(value);
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
            height: 200,
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
    editingTransactionId = null;
    document.getElementById('transactionModal').classList.add('active');
    document.getElementById('transactionForm').reset();
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    currentTransactionType = 'income';
    currentPaymentMethod = 'debit';
    selectTransactionType('income');
    document.querySelector('#transactionModal .modal-header h2').textContent = 'Nova Transação';
}

function closeTransactionModal() {
    editingTransactionId = null;
    currentPaymentMethod = 'debit';
    document.getElementById('transactionModal').classList.remove('active');
    document.getElementById('transactionForm').reset();
    // Ocultar campos condicionais
    document.getElementById('paymentMethodGroup').style.display = 'none';
    document.getElementById('creditCardGroup').style.display = 'none';
}

function editTransaction(id) {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;

    editingTransactionId = id;

    // Abre o modal
    document.getElementById('transactionModal').classList.add('active');

    // Atualiza título do modal
    document.querySelector('#transactionModal .modal-header h2').textContent = 'Editar Transação';

    // Preenche os campos
    document.getElementById('description').value = transaction.description;
    document.getElementById('value').value = formatCurrencyValue(transaction.value);
    document.getElementById('category').value = transaction.category;
    document.getElementById('date').value = transaction.date;

    // Define o tipo de transação
    currentTransactionType = transaction.type;
    selectTransactionType(transaction.type);

    // Define o método de pagamento se for despesa
    if (transaction.type === 'expense') {
        currentPaymentMethod = transaction.paymentMethod || 'debit';
        selectPaymentMethod(currentPaymentMethod);

        // Define o cartão se for crédito
        if (transaction.paymentMethod === 'credit' && transaction.cardId) {
            document.getElementById('transactionCard').value = transaction.cardId;
        }
    }
}

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
}

function closeSubscriptionModal() {
    editingSubscriptionId = null;
    document.getElementById('subscriptionModal').classList.remove('active');
    document.getElementById('subscriptionForm').reset();
}

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

    // Preenche os campos
    document.getElementById('subName').value = subscription.name;
    document.getElementById('subValue').value = formatCurrencyValue(subscription.value);
    document.getElementById('subDueDay').value = subscription.dueDay;
    document.getElementById('subCategory').value = subscription.category;
    document.getElementById('subStatus').value = subscription.status;
}

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
}

function closeInstallmentModal() {
    editingInstallmentId = null;
    document.getElementById('installmentModal').classList.remove('active');
    document.getElementById('installmentForm').reset();
    // Reset para valor total como padrão
    selectInstallmentValueType('total');
}

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
    document.querySelectorAll('.type-btn[data-type]').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type === type) {
            btn.classList.add('active');
        }
    });

    // Show/hide payment method group (only for expenses)
    const paymentMethodGroup = document.getElementById('paymentMethodGroup');
    if (type === 'expense') {
        paymentMethodGroup.style.display = 'block';
        // Reset to debit when switching to expense
        selectPaymentMethod('debit');
    } else {
        paymentMethodGroup.style.display = 'none';
        document.getElementById('creditCardGroup').style.display = 'none';
    }

    // Update categories
    populateCategories();
}

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
        populateTransactionCardOptions();
    } else {
        creditCardGroup.style.display = 'none';
        transactionCardSelect.required = false;
        transactionCardSelect.value = '';
    }
}

function populateTransactionCardOptions() {
    const select = document.getElementById('transactionCard');
    select.innerHTML = '<option value="">Selecione um cartão</option>';

    creditCards.forEach(card => {
        const option = document.createElement('option');
        option.value = card.id;
        option.textContent = `${card.name} - ${card.institution}`;
        select.appendChild(option);
    });
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

function formatCurrencyValue(value) {
    // Converte um número para o formato do input (1.234,56)
    if (!value && value !== 0) return '';

    let formatted = value.toFixed(2);
    formatted = formatted.replace('.', ',');
    formatted = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return formatted;
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
function initializeSavingsGoalChart() {
    const chartEl = document.querySelector("#savingsGoalChart");
    if (!chartEl) return;

    const totalIncome = getCurrentMonthTotal('income');
    const totalExpense = getCurrentMonthTotal('expense');
    const saved = totalIncome - totalExpense;
    const goal = 2000; // Meta de economia
    const percentage = Math.min((saved / goal) * 100, 100);

    const options = {
        series: [percentage],
        chart: {
            type: 'radialBar',
            height: 80,
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
            colors: ['#10b981']
        }
    };

    savingsGoalChart = new ApexCharts(chartEl, options);
    savingsGoalChart.render();
    document.getElementById('savingsGoalValue').textContent = formatCurrencyDisplay(saved);
}

// ===========================
// MINI CHARTS - EXPENSE LIMIT (RADIAL)
// ===========================
function initializeExpenseLimitChart() {
    const chartEl = document.querySelector("#expenseLimitChart");
    if (!chartEl) return;

    const totalExpense = getCurrentMonthTotal('expense');
    const limit = 3000; // Limite de gastos
    const percentage = Math.min((totalExpense / limit) * 100, 100);

    const options = {
        series: [percentage],
        chart: {
            type: 'radialBar',
            height: 80,
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
            colors: [percentage > 80 ? '#ef4444' : '#f97316']
        }
    };

    expenseLimitChart = new ApexCharts(chartEl, options);
    expenseLimitChart.render();
    document.getElementById('expenseLimitValue').textContent = formatCurrencyDisplay(totalExpense);
}

// ===========================
// MINI CHARTS - GROWTH SPARKLINE
// ===========================
function initializeGrowthSparkline() {
    const chartEl = document.querySelector("#growthSparkline");
    if (!chartEl) return;

    const last6Months = [];
    const currentDate = new Date();

    for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const monthTransactions = transactions.filter(t => {
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
function initializeExpenseTrendSparkline() {
    const chartEl = document.querySelector("#expenseTrendSparkline");
    if (!chartEl) return;

    const last7Days = [];
    const currentDate = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(currentDate);
        date.setDate(date.getDate() - i);
        const dayExpenses = transactions.filter(t => {
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
            height: 200,
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
function initializeWeeklyTrendChart() {
    const chartEl = document.querySelector("#weeklyTrendChart");
    if (!chartEl) return;

    const last7Days = [];
    const labels = [];
    const currentDate = new Date();

    for (let i = 6; i >= 0; i--) {
        const date = new Date(currentDate);
        date.setDate(date.getDate() - i);
        const dayExpenses = transactions.filter(t => {
            const tDate = new Date(t.date);
            return t.type === 'expense' &&
                   tDate.toDateString() === date.toDateString();
        }).reduce((sum, t) => sum + t.value, 0);
        last7Days.push(dayExpenses);
        labels.push(date.toLocaleDateString('pt-BR', { weekday: 'short' }));
    }

    const options = {
        series: [{ name: 'Gastos', data: last7Days }],
        chart: {
            type: 'area',
            height: 200,
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
            categories: labels,
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
                formatter: (val) => formatCurrencyDisplay(val)
            }
        }
    };

    weeklyTrendChart = new ApexCharts(chartEl, options);
    weeklyTrendChart.render();
}

// ===========================
// RESPONSIVE CHARTS
// ===========================
window.addEventListener('resize', () => {
    if (cashFlowChart) cashFlowChart.updateOptions({});
    if (categoryChart) categoryChart.updateOptions({});
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

        // Scroll para opção selecionada
        const selectedOption = this.dropdown.querySelector('.selected');
        if (selectedOption) {
            selectedOption.scrollIntoView({ block: 'nearest' });
        }
    }

    close() {
        this.isOpen = false;
        this.customSelect.classList.remove('open');
        this.trigger.setAttribute('aria-expanded', 'false');
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

// Inicializar todos os selects customizados
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
