// ==========================
// IMAGINATECH - SISTEMA DE ORÇAMENTO
// JavaScript Principal - Versão com Autenticação
// Arquivo: script-custo.js
// ==========================

// ==========================
// SECURITY UTILITIES
// ==========================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

/**
 * Logger - usa o logger centralizado do Firestore
 * Carregado via /shared/firestore-logger.js
 */
const logger = window.logger || {
    log: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
};

// Firebase Configuration (carregado EXCLUSIVAMENTE de ENV_CONFIG - sem fallbacks)
const firebaseConfig = {
    apiKey: window.ENV_CONFIG?.FIREBASE_API_KEY,
    authDomain: window.ENV_CONFIG?.FIREBASE_AUTH_DOMAIN,
    projectId: window.ENV_CONFIG?.FIREBASE_PROJECT_ID,
    storageBucket: window.ENV_CONFIG?.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: window.ENV_CONFIG?.FIREBASE_MESSAGING_SENDER_ID,
    appId: window.ENV_CONFIG?.FIREBASE_APP_ID
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Authorized Emails (carregado EXCLUSIVAMENTE do Firestore)
// SEGURANCA: Nenhum fallback hardcoded - admins devem vir do Firestore
let AUTHORIZED_EMAILS = [];
let adminsLoadFailed = false;

// Carrega admins do Firestore (OBRIGATORIO antes de verificar autorizacao)
async function loadAuthorizedEmails() {
    try {
        const tempDb = firebase.firestore();

        // Tentar carregar via ENV_CONFIG primeiro
        if (window.ENV_CONFIG?.loadAdmins) {
            const admins = await window.ENV_CONFIG.loadAdmins(tempDb);
            if (admins && admins.length > 0) {
                AUTHORIZED_EMAILS = admins.map(a => a.email);
                logger.log('[custo] Admins carregados via ENV_CONFIG:', AUTHORIZED_EMAILS.length);
                return;
            }
        }

        // Fallback: carregar diretamente do Firestore
        logger.log('[custo] Tentando fallback direto do Firestore...');
        const snapshot = await tempDb.collection('admins')
            .where('active', '==', true)
            .get();

        if (!snapshot.empty) {
            AUTHORIZED_EMAILS = snapshot.docs.map(doc => doc.data().email);
            logger.log('[custo] Admins carregados via fallback Firestore:', AUTHORIZED_EMAILS.length);
            return;
        }

        // Nenhum admin encontrado
        logger.error('[custo] ERRO: Nenhum admin encontrado no Firestore');
        adminsLoadFailed = true;

    } catch (error) {
        logger.error('[custo] Erro ao carregar admins:', error);
        adminsLoadFailed = true;
    }
}

// Verifica se usuario e autorizado (SEGURO: retorna false se admins nao carregados)
function isAuthorizedUser(email) {
    if (adminsLoadFailed || AUTHORIZED_EMAILS.length === 0) {
        logger.warn('Verificacao de autorizacao antes de carregar admins');
        return false;
    }
    return AUTHORIZED_EMAILS.includes(email);
}

// ==========================
// EVENT DELEGATION SETUP
// ==========================
function setupEventDelegation() {
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;

        const action = el.dataset.action;
        const handlers = {
            'login-google': () => loginWithGoogle(),
            'logout': () => logout(),
            'toggle-mobile-menu': () => typeof toggleMobileMenu === 'function' && toggleMobileMenu(),
            'generate-print': () => typeof generatePrint === 'function' && generatePrint(),
            'generate-color-print': () => typeof generateColorPrintFromBudget === 'function' && generateColorPrintFromBudget(),
            'close-color-modal': () => typeof closeColorPrintModal === 'function' && closeColorPrintModal(),
            'download-color-print': () => typeof downloadColorPrint === 'function' && downloadColorPrint()
        };

        if (handlers[action]) {
            e.preventDefault();
            handlers[action]();
        }
    });

    // SEGURANCA: Handler para fallback de imagens (substitui onerror inline)
    document.addEventListener('error', (e) => {
        if (e.target.tagName === 'IMG' && e.target.dataset.fallback) {
            e.target.src = e.target.dataset.fallback;
            e.target.removeAttribute('data-fallback'); // Evita loop infinito
        }
    }, true);

    logger.log('Event delegation configurado');
}

// Global Variables
let currentUser = null;
let isAuthorized = false;
let currentPrinter = null;
let previousPrinterType = null;
let selectedMaterial = null;
let customMaterialPrice = null;
let timeHours = 0;
let timeMinutes = 0;
let materialAmount = 0;
let isCalculatorInitialized = false;

// ===========================
// AUTHENTICATION FUNCTIONS
// ===========================

async function loginWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const user = result.user;

        // SEGURANCA: Verificar se o email foi verificado
        if (!user.emailVerified) {
            logger.warn('Email nao verificado:', user.email);
            await auth.signOut();
            alert('Seu email precisa ser verificado. Verifique sua caixa de entrada.');
            return;
        }

        if (isAuthorizedUser(user.email)) {
            currentUser = user;
            isAuthorized = true;
            showMainApp();
        } else {
            // Mostrar tela de acesso negado com dados do usuario
            showAccessDeniedScreen(user);
        }
    } catch (error) {
        logger.error('Erro no login:', error);
        alert('Erro ao fazer login. Tente novamente.');
    }
}

async function logout() {
    try {
        await auth.signOut();
        currentUser = null;
        isAuthorized = false;
        hideMainApp();
    } catch (error) {
        logger.error('Erro ao fazer logout:', error);
    }
}

function showMainApp() {
    { const el = document.getElementById('loadingOverlay'); if (el) el.style.display = 'none'; }
    document.getElementById('loginScreen')?.classList.remove('active');
    document.getElementById('accessDeniedScreen')?.classList.remove('active');
    { const el = document.getElementById('mainApp'); if (el) el.style.display = 'block'; }

    // Update user info
    if (currentUser) {
        { const el = document.getElementById('userPhoto'); if (el) el.src = currentUser.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.displayName || 'User'); }
        { const el = document.getElementById('userName'); if (el) el.textContent = currentUser.displayName || currentUser.email; }
    }

    // Initialize app
    initializeCalculator();
    monitorConnection();
}

function hideMainApp() {
    { const el = document.getElementById('loadingOverlay'); if (el) el.style.display = 'none'; }
    document.getElementById('loginScreen')?.classList.add('active');
    { const el = document.getElementById('mainApp'); if (el) el.style.display = 'none'; }
    document.getElementById('accessDeniedScreen')?.classList.remove('active');
}

function showAccessDeniedScreen(user) {
    { const el = document.getElementById('loadingOverlay'); if (el) el.style.display = 'none'; }
    document.getElementById('loginScreen')?.classList.remove('active');
    { const el = document.getElementById('mainApp'); if (el) el.style.display = 'none'; }

    // Atualizar informacoes do usuario na tela
    const displayName = user.displayName || 'Usuario';
    { const el = document.getElementById('deniedMessage'); if (el) el.textContent = `Ola ${displayName}, esta area e exclusiva para administradores.`; }
    { const el = document.getElementById('deniedUserEmail'); if (el) el.textContent = user.email; }

    // Mostrar tela de acesso negado
    document.getElementById('accessDeniedScreen')?.classList.add('active');
}

// ===========================
// MATERIAL CONFIGURATIONS
// ===========================

const MATERIALS = {
    fdm: [
        { id: 'abs', name: 'ABS', price: 75 },
        { id: 'pla', name: 'PLA', price: 120 },
        { id: 'tpu', name: 'TPU', price: 150 },
        { id: 'outros', name: 'Outros', price: null }
    ],
    resin: [
        { id: 'resina', name: 'Resina Padrão', price: 150 }
    ],
    laser: [
        { id: 'default', name: 'Sem Material', price: 0 }
    ]
};

// ===========================
// PRINTER CONFIGURATIONS
// ===========================

const printerDefaults = {
    "M7": {
        name: "Elegoo Mars 7",
        type: "resin",
        materialUnit: "ml",
        defaults: {
            materialPrice: 150,      // R$/litro
            profitMargin: 280,       // %
            failureRate: 20,         // %
            machinePower: 400,       // W
            kwhPrice: 1.2,           // R$/kWh
            machineValue: 3800,      // R$
            depreciationTime: 2000,  // horas
            consumables: 2           // R$ - álcool + luva
        }
    },
    "K1": {
        name: "Creality K1",
        type: "fdm",
        materialUnit: "g",
        defaults: {
            materialPrice: 75,       // R$/kg
            profitMargin: 280,       // %
            failureRate: 20,         // %
            machinePower: 400,       // W
            kwhPrice: 1.2,           // R$/kWh
            machineValue: 2600,      // R$
            depreciationTime: 6000,  // horas
            consumables: 0           // Não usa consumíveis extras
        }
    },
    "K1M": {
        name: "Creality K1 Max",
        type: "fdm",
        materialUnit: "g",
        defaults: {
            materialPrice: 70,       // R$/kg
            profitMargin: 280,       // %
            failureRate: 20,         // %
            machinePower: 650,       // W
            kwhPrice: 1.2,           // R$/kWh
            machineValue: 4600,      // R$
            depreciationTime: 6000,  // horas
            consumables: 0
        }
    },
    "K2PLUS": {
        name: "Creality K2 Plus",
        type: "fdm",
        materialUnit: "g",
        defaults: {
            materialPrice: 70,       // R$/kg
            profitMargin: 280,       // %
            failureRate: 20,         // %
            machinePower: 1200,      // W
            kwhPrice: 1.2,           // R$/kWh
            machineValue: 12000,     // R$
            depreciationTime: 10000, // horas
            consumables: 0
        }
    },
    "LASER": {
        name: "Máquina Laser CO2",
        type: "laser",
        materialUnit: "minutos",
        defaults: {
            materialPrice: 0,        // Laser não usa material dessa forma
            profitMargin: 280,       // %
            failureRate: 20,         // %
            machinePower: 60,        // W
            kwhPrice: 1.2,           // R$/kWh
            machineValue: 2000,      // R$
            depreciationTime: 10000, // horas
            consumables: 0
        }
    }
};

// ===========================
// CALCULATOR FUNCTIONS
// ===========================

function initializeCalculator() {
    // Prevent multiple initializations
    if (isCalculatorInitialized) {
        return;
    }
    isCalculatorInitialized = true;

    // DOM Elements
    const resultsOutput = document.getElementById("results-output");
    const materialUnitSpan = document.getElementById("material-unit");
    const customUnitSpan = document.getElementById("custom-unit");

    // Printer buttons
    const printerButtons = document.querySelectorAll(".printer-btn");

    // Time controls
    const timeHoursDisplay = document.getElementById("time-hours-display");
    const timeMinutesDisplay = document.getElementById("time-minutes-display");
    const btnAdd24h = document.getElementById("btn-add-24h");
    const btnSub24h = document.getElementById("btn-sub-24h");
    const btnAdd1h = document.getElementById("btn-add-1h");
    const btnSub1h = document.getElementById("btn-sub-1h");
    const btnAdd15m = document.getElementById("btn-add-15m");
    const btnSub15m = document.getElementById("btn-sub-15m");

    // Material controls
    const materialAmountDisplay = document.getElementById("material-amount-display");
    const materialUnitDisplay = document.getElementById("material-unit-display");
    const btnAdd500 = document.getElementById("btn-add-500");
    const btnSub500 = document.getElementById("btn-sub-500");
    const btnAdd100 = document.getElementById("btn-add-100");
    const btnSub100 = document.getElementById("btn-sub-100");
    const btnAdd10 = document.getElementById("btn-add-10");
    const btnSub10 = document.getElementById("btn-sub-10");

    // Inputs
    const printQuantityInput = document.getElementById("print-quantity");
    const modelNameInput = document.getElementById("model-name");
    const profitMarginInput = document.getElementById("profit-margin");
    const consumablesInput = document.getElementById("consumables");
    const customMaterialPriceInput = document.getElementById("custom-material-price");
    const divideByQuantityCheckbox = document.getElementById("divide-by-quantity");

    // Material Selection
    const materialSelection = document.getElementById("material-selection");
    const materialButtons = document.getElementById("material-buttons");
    const customPriceField = document.getElementById("custom-price-field");
    const consumablesField = document.getElementById("consumables-field");

    // ===========================
    // UTILITY FUNCTIONS
    // ===========================
    
    function getInputValue(element, defaultValue = 0) {
        if (!element) return defaultValue;
        const value = parseFloat(element.value);
        return isNaN(value) || value < 0 ? defaultValue : value;
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    }

    function updateTimeDisplay() {
        if (timeHoursDisplay) {
            timeHoursDisplay.textContent = timeHours;
        }
        if (timeMinutesDisplay) {
            timeMinutesDisplay.textContent = timeMinutes.toString().padStart(2, '0');
        }
    }

    function addTime(hours, minutes) {
        timeMinutes += minutes;
        timeHours += hours;

        // Normalize minutes (handle both positive and negative)
        while (timeMinutes >= 60) {
            timeHours += 1;
            timeMinutes -= 60;
        }

        while (timeMinutes < 0) {
            timeHours -= 1;
            timeMinutes += 60;
        }

        // Prevent negative total time
        if (timeHours < 0) {
            timeHours = 0;
            timeMinutes = 0;
        }

        updateTimeDisplay();
        calculateCost();
    }

    function updateMaterialDisplay() {
        if (materialAmountDisplay) {
            materialAmountDisplay.textContent = materialAmount;
        }
    }

    function addMaterial(amount) {
        materialAmount += amount;

        // Prevent negative values
        if (materialAmount < 0) {
            materialAmount = 0;
        }

        updateMaterialDisplay();
        calculateCost();
    }

    function updateMaterialUnit() {
        if (!currentPrinter) return;

        const unit = currentPrinter.materialUnit;
        if (materialUnitDisplay) {
            materialUnitDisplay.textContent = unit;
        }

        // Update button units
        const materialBtnUnits = document.querySelectorAll('.material-btn-unit');
        materialBtnUnits.forEach(span => {
            span.textContent = unit;
        });
    }

    function clearInputs(clearMaterial = false) {
        if (printQuantityInput) printQuantityInput.value = "1";
        // NÃO zera mais o tempo e material - conforme solicitado
        // Só limpa material se explicitamente solicitado (mudança de tipo de impressora)
        if (clearMaterial) {
            selectedMaterial = null;
            customMaterialPrice = null;
        }
    }

    function updateMaterialButtons() {
        if (!currentPrinter) {
            materialSelection.style.display = 'none';
            return;
        }

        materialSelection.style.display = 'block';
        materialButtons.innerHTML = '';

        const materials = MATERIALS[currentPrinter.type] || [];
        
        materials.forEach(material => {
            const button = document.createElement('button');
            button.className = 'material-btn';
            button.textContent = material.name;
            button.addEventListener('click', () => selectMaterial(material));
            materialButtons.appendChild(button);
        });

        // Show/hide consumables field for resin
        if (currentPrinter.type === 'resin') {
            consumablesField.style.display = 'block';
        } else {
            consumablesField.style.display = 'none';
        }

        // Update units
        if (materialUnitSpan) {
            materialUnitSpan.textContent = currentPrinter.materialUnit;
        }

        // Update custom unit
        if (customUnitSpan) {
            if (currentPrinter.type === 'resin') {
                customUnitSpan.textContent = 'litro';
            } else if (currentPrinter.type === 'laser') {
                customUnitSpan.textContent = 'minuto';
            } else {
                customUnitSpan.textContent = 'kg';
            }
        }

        // Adjust label for laser machine
        const materialUsageLabel = document.getElementById('material-usage-label');
        if (currentPrinter.type === 'laser') {
            materialUsageLabel.innerHTML = '<i class="fas fa-clock"></i> Tempo de Corte (minutos)';
            materialSelection.style.display = 'none'; // Hide material selection for laser
        } else {
            materialUsageLabel.innerHTML = `<i class="fas fa-cube"></i> Material Utilizado (<span id="material-unit">${escapeHtml(currentPrinter.materialUnit)}</span>)`;
        }

        // Update material control unit
        updateMaterialUnit();
    }

    function selectMaterial(material) {
        selectedMaterial = material;
        
        // Update button states
        document.querySelectorAll('.material-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent === material.name) {
                btn.classList.add('active');
            }
        });

        // Show/hide custom price field
        if (material.id === 'outros') {
            customPriceField.style.display = 'block';
            customMaterialPriceInput.focus();
        } else {
            customPriceField.style.display = 'none';
            customMaterialPriceInput.value = '';
            customMaterialPrice = material.price;
        }

        calculateCost();
    }

    // ===========================
    // MAIN CALCULATION
    // ===========================
    
    function calculateCost() {
        if (!currentPrinter) {
            resultsOutput.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calculator"></i>
                    <p>Selecione uma impressora e preencha os dados para calcular</p>
                </div>
            `;
            return;
        }

        // Check if material is selected (except for laser)
        if (currentPrinter.type !== 'laser' && !selectedMaterial) {
            resultsOutput.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Selecione o tipo de material</p>
                </div>
            `;
            return;
        }

        // Get input values
        const totalTimeHoursRaw = timeHours + timeMinutes / 60;
        const materialUsedRaw = materialAmount; // Using global variable
        const printQuantity = getInputValue(printQuantityInput, 1);
        const profitMargin = getInputValue(profitMarginInput, 280) / 100;
        const consumables = getInputValue(consumablesInput, 2);
        const divideByQuantity = divideByQuantityCheckbox && divideByQuantityCheckbox.checked;

        // Se "dividir pela quantidade" estiver marcado, divide material e tempo
        const totalTimeHours = divideByQuantity ? totalTimeHoursRaw / printQuantity : totalTimeHoursRaw;
        const materialUsed = divideByQuantity ? materialUsedRaw / printQuantity : materialUsedRaw;

        // Get material price
        let materialPrice = 0;
        if (currentPrinter.type !== 'laser') {
            if (selectedMaterial && selectedMaterial.id === 'outros') {
                materialPrice = getInputValue(customMaterialPriceInput, 0);
                if (materialPrice === 0) {
                    resultsOutput.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle"></i>
                            <p>Digite o preço do material personalizado</p>
                        </div>
                    `;
                    return;
                }
            } else if (selectedMaterial) {
                materialPrice = selectedMaterial.price;
            }
        }

        // For laser, the "material" is actually time in minutes
        let actualTimeHours = totalTimeHours;
        if (currentPrinter.type === 'laser') {
            actualTimeHours = materialUsed / 60; // Convert minutes to hours
        }

        // Check if there's enough data
        if (currentPrinter.type === 'laser') {
            if (materialUsed === 0) {
                resultsOutput.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Preencha o tempo de corte em minutos</p>
                    </div>
                `;
                return;
            }
        } else {
            if (totalTimeHours === 0 && materialUsed === 0) {
                resultsOutput.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Preencha pelo menos o tempo ou material</p>
                    </div>
                `;
                return;
            }
        }

        // Internal values (not displayed to user)
        const defaults = currentPrinter.defaults;
        const failureRate = defaults.failureRate / 100;
        const machinePower = defaults.machinePower;
        const kwhPrice = defaults.kwhPrice;
        const machineValue = defaults.machineValue;
        const depreciationTime = defaults.depreciationTime;

        // ===========================
        // CALCULATIONS
        // ===========================
        
        const timeForCalc = currentPrinter.type === 'laser' ? actualTimeHours : totalTimeHours;
        
        // 1. Energy cost
        const energyCost = (machinePower / 1000) * timeForCalc * kwhPrice;
        
        // 2. Depreciation cost
        const depreciationCost = depreciationTime > 0 ? 
            (machineValue / depreciationTime) * timeForCalc : 0;
        
        // 3. Material cost
        let materialCost = 0;
        if (currentPrinter.type === 'resin') {
            materialCost = (materialUsed / 1000) * materialPrice; // ml to liter
        } else if (currentPrinter.type === 'laser') {
            materialCost = 0; // Laser has no material cost
        } else {
            materialCost = (materialUsed / 1000) * materialPrice; // g to kg
        }

        // 4. Production cost per unit
        let productionCostPerUnit = (materialCost + energyCost + depreciationCost) * (1 + failureRate);
        
        // Add consumables for resin
        if (currentPrinter.type === 'resin') {
            productionCostPerUnit += consumables * printQuantity;
        }
        
        // 5. Batch production cost (WITHOUT STL)
        const productionCostTotal = productionCostPerUnit * printQuantity;
        
        // 6. Unit price without tax (with profit)
        const unitPriceNoTax = productionCostPerUnit * (1 + profitMargin);

        // 7. Batch price (total price)
        const totalPrice = unitPriceNoTax * printQuantity;

        // ===========================
        // DISPLAY RESULTS
        // ===========================
        
        resultsOutput.innerHTML = `
            <div class="cost-breakdown">
                <div class="cost-item">
                    <span class="cost-label">
                        <i class="fas fa-bolt"></i> Custo de Energia
                    </span>
                    <span class="cost-value">${formatCurrency(energyCost)}</span>
                </div>
                
                <div class="cost-item">
                    <span class="cost-label">
                        <i class="fas fa-chart-line"></i> Depreciação
                    </span>
                    <span class="cost-value">${formatCurrency(depreciationCost)}</span>
                </div>
                
                ${currentPrinter.type !== 'laser' ? `
                <div class="cost-item">
                    <span class="cost-label">
                        <i class="fas fa-cube"></i> Material${selectedMaterial ? ' (' + escapeHtml(selectedMaterial.name) + ')' : ''}
                    </span>
                    <span class="cost-value">${formatCurrency(materialCost)}</span>
                </div>
                ` : ''}
                
                ${currentPrinter.type === 'resin' ? `
                <div class="cost-item">
                    <span class="cost-label">
                        <i class="fas fa-tools"></i> Consumíveis (Álcool + Luva)
                    </span>
                    <span class="cost-value">${formatCurrency(consumables * printQuantity)}</span>
                </div>
                ` : ''}

                <div class="cost-item">
                    <span class="cost-label">
                        <i class="fas fa-exclamation-triangle"></i> Taxa de Falha (${(failureRate * 100).toFixed(0)}%)
                    </span>
                    <span class="cost-value">${formatCurrency((materialCost + energyCost + depreciationCost) * failureRate)}</span>
                </div>
            </div>
            
            <div class="divider"></div>
            
            <div class="cost-item">
                <span class="cost-label">
                    <strong>Custo de Produção (${printQuantity} peça${printQuantity > 1 ? 's' : ''})</strong>
                </span>
                <span class="cost-value">${formatCurrency(productionCostTotal)}</span>
            </div>
            
            <div class="total-section">
                <div class="total-item">
                    <span class="total-label">Valor Unitário</span>
                    <span class="total-value">${formatCurrency(unitPriceNoTax)}</span>
                </div>
                
                ${printQuantity > 1 ? `
                <div class="total-item">
                    <span class="total-label">Valor Total (${printQuantity} unidades)</span>
                    <span class="total-value">${formatCurrency(totalPrice)}</span>
                </div>
                ` : `
                <div class="total-item">
                    <span class="total-label">Valor Total</span>
                    <span class="total-value">${formatCurrency(totalPrice)}</span>
                </div>
                `}
            </div>
        `;

        // Store values for print
        window.printData = {
            unitPrice: unitPriceNoTax,
            totalPrice: totalPrice,
            quantity: printQuantity
        };
    }

    // ===========================
    // GENERATE PRINT FUNCTION
    // ===========================
    
    window.generatePrint = async function() {
        if (!window.printData) {
            alert('Por favor, calcule primeiro o orçamento antes de gerar o print.');
            return;
        }

        const modelName = modelNameInput.value.trim() || 'Modelo não especificado';
        
        // Create temporary container for print
        const printContainer = document.createElement('div');
        printContainer.className = 'print-container';
        printContainer.style.cssText = `
            position: fixed;
            top: -9999px;
            left: -9999px;
            width: 700px;
            height: auto;
            background: #0a0e1a;
            position: relative;
            padding: 0;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: white;
            overflow: hidden;
        `;

        const { unitPrice, totalPrice, quantity } = window.printData;

        printContainer.innerHTML = `
            <!-- Background Grid -->
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background-image:
                    linear-gradient(rgba(0, 212, 255, 0.05) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0, 212, 255, 0.05) 1px, transparent 1px);
                background-size: 25px 25px;
                pointer-events: none;">
            </div>

            <!-- Top Border -->
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px;
                background: linear-gradient(90deg, #00D4FF, #00FF88, #00D4FF);"></div>

            <!-- Content -->
            <div style="position: relative; padding: 50px;">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 40px; position: relative;">
                    <div style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
                        width: 150px; height: 2px; background: linear-gradient(90deg, transparent, #00D4FF, transparent);"></div>

                    <h1 style="font-family: 'Orbitron', monospace; font-size: 36px;
                        background: linear-gradient(135deg, #00D4FF, #57D4CA);
                        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                        background-clip: text; margin: 0; letter-spacing: 4px; text-transform: uppercase;">
                        IMAGINATECH
                    </h1>

                    <div style="margin: 15px auto; width: 200px; height: 1px;
                        background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.5), transparent);"></div>

                    <p style="color: #00FF88; font-size: 14px; margin: 0; font-weight: 600;
                        letter-spacing: 3px; text-transform: uppercase;">
                        ORÇAMENTO SIMPLIFICADO
                    </p>
                </div>

                <!-- Model Name -->
                <div style="margin-bottom: 30px; padding: 20px;
                    background: linear-gradient(135deg, rgba(0, 212, 255, 0.08), rgba(0, 255, 136, 0.08));
                    border-left: 4px solid #00D4FF; border-right: 4px solid #00FF88;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div style="width: 4px; height: 30px; background: #FFD700;"></div>
                        <h2 style="color: #FFFFFF; font-size: 24px; margin: 0;
                            font-family: 'Orbitron', monospace; font-weight: 700;">
                            ${escapeHtml(modelName)}
                        </h2>
                    </div>
                </div>

                <!-- Prices Section -->
                <div style="background: linear-gradient(135deg, rgba(0, 255, 136, 0.05), rgba(0, 212, 255, 0.05));
                    border: 2px solid #00FF88; padding: 30px; position: relative;">

                    <!-- Corner Accents -->
                    <div style="position: absolute; top: -2px; left: -2px; width: 20px; height: 20px;
                        border-top: 4px solid #00D4FF; border-left: 4px solid #00D4FF;"></div>
                    <div style="position: absolute; top: -2px; right: -2px; width: 20px; height: 20px;
                        border-top: 4px solid #00D4FF; border-right: 4px solid #00D4FF;"></div>
                    <div style="position: absolute; bottom: -2px; left: -2px; width: 20px; height: 20px;
                        border-bottom: 4px solid #00D4FF; border-left: 4px solid #00D4FF;"></div>
                    <div style="position: absolute; bottom: -2px; right: -2px; width: 20px; height: 20px;
                        border-bottom: 4px solid #00D4FF; border-right: 4px solid #00D4FF;"></div>

                    <!-- Unit Price -->
                    <div style="display: flex; justify-content: space-between; align-items: center;
                        margin-bottom: 20px; padding-bottom: 20px;
                        border-bottom: 2px solid rgba(0, 212, 255, 0.2);">
                        <span style="font-size: 18px; color: rgba(255, 255, 255, 0.9); font-weight: 500;">
                            VALOR UNITÁRIO
                        </span>
                        <span style="font-size: 28px; font-weight: 700; color: #00FF88;
                            font-family: 'Orbitron', monospace; text-shadow: 0 0 15px rgba(0, 255, 136, 0.6);">
                            ${formatCurrency(unitPrice)}
                        </span>
                    </div>

                    ${quantity > 1 ? `
                    <!-- Total Price -->
                    <div style="display: flex; justify-content: space-between; align-items: center;
                        margin-bottom: 20px; padding-bottom: 20px;
                        border-bottom: 2px solid rgba(0, 212, 255, 0.2);">
                        <span style="font-size: 18px; color: rgba(255, 255, 255, 0.9); font-weight: 500;">
                            TOTAL (${quantity} UNIDADES)
                        </span>
                        <span style="font-size: 28px; font-weight: 700; color: #00FF88;
                            font-family: 'Orbitron', monospace; text-shadow: 0 0 15px rgba(0, 255, 136, 0.6);">
                            ${formatCurrency(totalPrice)}
                        </span>
                    </div>
                    ` : ''}
                </div>

                <!-- Footer -->
                <div style="margin-top: 40px; text-align: center; position: relative;">
                    <div style="margin: 0 auto 20px; width: 200px; height: 1px;
                        background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.5), transparent);"></div>

                    <p style="color: rgba(255, 255, 255, 0.5); font-size: 13px; margin: 8px 0;">
                        ${new Date().toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                        })}
                    </p>
                    <p style="color: rgba(0, 212, 255, 0.7); font-size: 14px; margin: 8px 0;
                        font-weight: 600; letter-spacing: 1px;">
                        www.imaginatech.com.br
                    </p>
                </div>
            </div>

            <!-- Bottom Border -->
            <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 4px;
                background: linear-gradient(90deg, #00D4FF, #00FF88, #00D4FF);"></div>
        `;
        
        document.body.appendChild(printContainer);
        
        try {
            // Use html2canvas to generate image
            const canvas = await html2canvas(printContainer, {
                backgroundColor: '#0a0e1a',
                scale: 2,
                logging: false,
                width: 700,
                height: printContainer.scrollHeight,
                windowWidth: 700,
                windowHeight: printContainer.scrollHeight
            });
            
            // Convert to blob and download
            canvas.toBlob(function(blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const filename = `orcamento_${modelName.replace(/\s+/g, '_')}_${new Date().getTime()}.png`;
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
                
                // Visual feedback
                const btn = document.getElementById('generate-print-btn');
                if (btn) {
                    const originalHTML = btn.innerHTML;
                    btn.innerHTML = '<i class="fas fa-check"></i> Print Gerado!';
                    btn.style.background = 'linear-gradient(135deg, #00FF88, #44FF44)';

                    setTimeout(() => {
                        btn.innerHTML = originalHTML;
                        btn.style.background = '';
                    }, 2000);
                }
            });
            
        } catch (error) {
            logger.error('Erro ao gerar print:', error);
            alert('Erro ao gerar o print. Por favor, tente novamente.');
        } finally {
            document.body.removeChild(printContainer);
        }
    };

    // ===========================
    // EVENT LISTENERS
    // ===========================

    // Printer buttons
    printerButtons.forEach(button => {
        button.addEventListener("click", () => {
            const printerKey = button.dataset.printer;
            if (printerKey && printerDefaults[printerKey]) {
                // Remove active class from all buttons
                printerButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                button.classList.add('active');

                const newPrinter = printerDefaults[printerKey];
                const typeChanged = !currentPrinter || currentPrinter.type !== newPrinter.type;

                currentPrinter = newPrinter;

                // Só limpa material se o tipo de impressora mudou
                clearInputs(typeChanged);
                updateMaterialButtons();
                calculateCost();
            }
        });
    });

    // Time control buttons
    if (btnAdd24h) {
        btnAdd24h.addEventListener("click", () => addTime(24, 0));
    }
    if (btnSub24h) {
        btnSub24h.addEventListener("click", () => addTime(-24, 0));
    }
    if (btnAdd1h) {
        btnAdd1h.addEventListener("click", () => addTime(1, 0));
    }
    if (btnSub1h) {
        btnSub1h.addEventListener("click", () => addTime(-1, 0));
    }
    if (btnAdd15m) {
        btnAdd15m.addEventListener("click", () => addTime(0, 15));
    }
    if (btnSub15m) {
        btnSub15m.addEventListener("click", () => addTime(0, -15));
    }

    // Material control buttons
    if (btnAdd500) {
        btnAdd500.addEventListener("click", () => addMaterial(500));
    }
    if (btnSub500) {
        btnSub500.addEventListener("click", () => addMaterial(-500));
    }
    if (btnAdd100) {
        btnAdd100.addEventListener("click", () => addMaterial(100));
    }
    if (btnSub100) {
        btnSub100.addEventListener("click", () => addMaterial(-100));
    }
    if (btnAdd10) {
        btnAdd10.addEventListener("click", () => addMaterial(10));
    }
    if (btnSub10) {
        btnSub10.addEventListener("click", () => addMaterial(-10));
    }

    // Custom material price input
    customMaterialPriceInput.addEventListener("input", () => {
        if (selectedMaterial && selectedMaterial.id === 'outros') {
            customMaterialPrice = getInputValue(customMaterialPriceInput, 0);
            calculateCost();
        }
    });

    // Main inputs - recalculate in real time
    const mainInputs = [
        printQuantityInput,
        profitMarginInput,
        consumablesInput
    ];

    mainInputs.forEach(input => {
        if (input) {
            input.addEventListener("input", calculateCost);
        }
    });

    // Checkbox "dividir pela quantidade" - recalculate when changed
    if (divideByQuantityCheckbox) {
        divideByQuantityCheckbox.addEventListener("change", calculateCost);
    }

    // Initial state
    resultsOutput.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-calculator"></i>
            <p>Selecione uma impressora e preencha os dados para calcular</p>
        </div>
    `;
}

// ===========================
// VISUAL EFFECTS
// ===========================

function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    const particleCount = 30;
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 20 + 's';
        particle.style.animationDuration = (15 + Math.random() * 10) + 's';
        particlesContainer.appendChild(particle);
    }
}

// ===========================
// INITIALIZATION
// ===========================

document.addEventListener("DOMContentLoaded", () => {
    // Setup event delegation (security)
    setupEventDelegation();

    // Check authentication state
    { const el = document.getElementById('loadingOverlay'); if (el) el.style.display = 'flex'; }

    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Carregar admins do Firestore antes de verificar
            await loadAuthorizedEmails();
        }

        if (user && isAuthorizedUser(user.email)) {
            currentUser = user;
            isAuthorized = true;
            showMainApp();
        } else {
            if (user) {
                auth.signOut();
            }
            hideMainApp();
        }
    });

    logger.log('Sistema de Orcamento ImaginaTech carregado com sucesso!');
    logger.log('Versao: 4.1 - Security Hardened');
});

// ===========================
// CONNECTION MONITORING
// ===========================
function monitorConnection() {
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
        alert('Conexão restaurada!');
    });

    window.addEventListener('offline', () => {
        updateStatus(false);
        alert('Sem conexão com a internet!');
    });

    updateStatus(navigator.onLine);
}

// ===========================
// PRINT DE CORES DISPONÍVEIS
// ===========================

// Inicializar Firestore para buscar filamentos
const db = firebase.firestore();

// Função para buscar filamentos do Firebase
async function fetchFilaments() {
    try {
        const snapshot = await db.collection('filaments').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        logger.error('Erro ao buscar filamentos:', error);
        return [];
    }
}

// Função principal para gerar print de cores do orçamento
window.generateColorPrintFromBudget = async function() {
    // Verificar se tem material selecionado e quantidade
    if (!selectedMaterial) {
        alert('Selecione um material primeiro!');
        return;
    }

    if (!materialAmount || materialAmount <= 0) {
        alert('Adicione a quantidade de material necessária!');
        return;
    }

    // Mostrar loading no botão
    const btn = document.getElementById('generate-colors-btn');
    if (!btn) return;
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
    btn.disabled = true;

    try {
        // Buscar filamentos do Firebase
        const filaments = await fetchFilaments();

        if (filaments.length === 0) {
            alert('Nenhum filamento encontrado no estoque!');
            return;
        }

        // Converter quantidade de gramas para kg (peso no Firebase está em kg)
        const requiredInKg = materialAmount / 1000;

        // Nome do material selecionado (PLA, ABS, etc.)
        const materialType = selectedMaterial.name;

        // Filtrar filamentos disponíveis
        const availableAll = filaments.filter(f => {
            const weight = parseFloat(f.weight) || 0;
            // Verificar se tem quantidade suficiente
            if (weight < requiredInKg) return false;
            // Verificar se é do tipo correto
            if (f.type !== materialType) return false;
            return true;
        });

        if (availableAll.length === 0) {
            alert(`Nenhuma cor de ${materialType} disponível com ${materialAmount}g ou mais!`);
            return;
        }

        // Agrupar por cor e manter apenas o com maior quantidade
        const colorMap = new Map();
        availableAll.forEach(f => {
            const colorName = (f.color || f.name || '').toLowerCase().trim();
            const weight = parseFloat(f.weight) || 0;

            if (!colorMap.has(colorName) || weight > (parseFloat(colorMap.get(colorName).weight) || 0)) {
                colorMap.set(colorName, f);
            }
        });

        const available = Array.from(colorMap.values());

        // Atualizar informações no modal
        { const el = document.getElementById('colorPrintRequiredAmount'); if (el) el.textContent = materialAmount + 'g'; }
        { const el = document.getElementById('colorPrintMaterialType'); if (el) el.textContent = materialType; }
        { const el = document.getElementById('colorPrintAvailableCount'); if (el) el.textContent = available.length; }

        // Renderizar cores disponíveis (sem borda nas imagens)
        const printPreview = document.getElementById('colorPrintPreview');
        if (printPreview) {
            printPreview.innerHTML = available.map(f => `
                <div class="print-item" style="text-align: center; padding: 0.5rem;">
                    <img src="${escapeHtml(f.imageUrl || '/iconwpp.jpg')}" alt="${escapeHtml(f.color)}"
                         style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;"
                         data-fallback="/iconwpp.jpg">
                    <div style="margin-top: 0.5rem; font-size: 0.85rem; color: #333; font-weight: 500;">${escapeHtml(f.color || f.name)}</div>
                </div>
            `).join('');
        }

        // Abrir modal de resultado
        document.getElementById('colorPrintResultModal')?.classList.add('active');

    } catch (error) {
        logger.error('Erro ao gerar print de cores:', error);
        alert('Erro ao gerar print de cores. Tente novamente.');
    } finally {
        // Restaurar botão
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
};

// Fechar modal de print de cores
window.closeColorPrintModal = function() {
    document.getElementById('colorPrintResultModal')?.classList.remove('active');
};

// Baixar imagem do print de cores (layout estruturado igual ao print de custo)
window.downloadColorPrint = async function() {
    const printPreview = document.getElementById('colorPrintPreview');
    const materialType = document.getElementById('colorPrintMaterialType')?.textContent || '';
    const requiredAmount = document.getElementById('colorPrintRequiredAmount')?.textContent || '';
    const availableCount = document.getElementById('colorPrintAvailableCount')?.textContent || '';

    try {
        // Feedback visual
        const btn = document.querySelector('#colorPrintResultModal .btn-primary');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';
        btn.disabled = true;

        // Extrair dados dos filamentos do preview atual
        const items = printPreview.querySelectorAll('.print-item');
        const colorsData = Array.from(items).map(item => ({
            imageUrl: item.querySelector('img')?.src || '/iconwpp.jpg',
            color: item.querySelector('div:last-child')?.textContent || 'Cor'
        }));

        // Criar container temporário com layout estruturado (similar ao print de custo)
        const printContainer = document.createElement('div');
        printContainer.style.cssText = `
            position: fixed;
            top: -9999px;
            left: -9999px;
            width: 700px;
            background: #0a0e1a;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: white;
            overflow: hidden;
        `;

        // Gerar grid de cores (4 por linha)
        const colorsPerRow = 4;
        let colorsGridHTML = '';

        for (let i = 0; i < colorsData.length; i += colorsPerRow) {
            const rowItems = colorsData.slice(i, i + colorsPerRow);
            colorsGridHTML += `
                <div style="display: flex; justify-content: center; gap: 15px; margin-bottom: 15px;">
                    ${rowItems.map(c => `
                        <div style="text-align: center; width: 140px;">
                            <div style="width: 100px; height: 100px; margin: 0 auto; border-radius: 12px; overflow: hidden;
                                border: 3px solid rgba(0, 212, 255, 0.3); box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);">
                                <img src="${c.imageUrl}" alt="${escapeHtml(c.color)}"
                                     style="width: 100%; height: 100%; object-fit: cover;"
                                     crossorigin="anonymous">
                            </div>
                            <div style="margin-top: 10px; font-size: 14px; color: #fff; font-weight: 600;
                                text-transform: uppercase; letter-spacing: 1px;">${escapeHtml(c.color)}</div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        printContainer.innerHTML = `
            <!-- Background Grid -->
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background-image:
                    linear-gradient(rgba(0, 212, 255, 0.05) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0, 212, 255, 0.05) 1px, transparent 1px);
                background-size: 25px 25px;
                pointer-events: none;">
            </div>

            <!-- Top Border -->
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px;
                background: linear-gradient(90deg, #00D4FF, #00FF88, #00D4FF);"></div>

            <!-- Content -->
            <div style="position: relative; padding: 40px 50px;">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 30px; position: relative;">
                    <div style="position: absolute; top: -10px; left: 50%; transform: translateX(-50%);
                        width: 150px; height: 2px; background: linear-gradient(90deg, transparent, #00D4FF, transparent);"></div>

                    <h1 style="font-family: 'Orbitron', monospace; font-size: 32px;
                        background: linear-gradient(135deg, #00D4FF, #57D4CA);
                        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                        background-clip: text; margin: 0; letter-spacing: 4px; text-transform: uppercase;">
                        IMAGINATECH
                    </h1>

                    <div style="margin: 12px auto; width: 200px; height: 1px;
                        background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.5), transparent);"></div>

                    <p style="color: #00FF88; font-size: 13px; margin: 0; font-weight: 600;
                        letter-spacing: 3px; text-transform: uppercase;">
                        CORES DISPONÍVEIS
                    </p>
                </div>

                <!-- Info Badge -->
                <div style="display: flex; justify-content: center; gap: 30px; margin-bottom: 30px;">
                    <div style="text-align: center; padding: 15px 25px;
                        background: linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(0, 255, 136, 0.1));
                        border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 12px;">
                        <div style="font-size: 12px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Material</div>
                        <div style="font-size: 20px; font-weight: 700; color: #00D4FF; font-family: 'Orbitron', monospace;">${materialType}</div>
                    </div>
                    <div style="text-align: center; padding: 15px 25px;
                        background: linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(0, 255, 136, 0.1));
                        border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 12px;">
                        <div style="font-size: 12px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Mínimo</div>
                        <div style="font-size: 20px; font-weight: 700; color: #FFD700; font-family: 'Orbitron', monospace;">${requiredAmount}</div>
                    </div>
                    <div style="text-align: center; padding: 15px 25px;
                        background: linear-gradient(135deg, rgba(0, 212, 255, 0.1), rgba(0, 255, 136, 0.1));
                        border: 1px solid rgba(0, 212, 255, 0.3); border-radius: 12px;">
                        <div style="font-size: 12px; color: rgba(255,255,255,0.6); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Opções</div>
                        <div style="font-size: 20px; font-weight: 700; color: #00FF88; font-family: 'Orbitron', monospace;">${availableCount}</div>
                    </div>
                </div>

                <!-- Colors Grid Section -->
                <div style="background: linear-gradient(135deg, rgba(0, 255, 136, 0.03), rgba(0, 212, 255, 0.03));
                    border: 2px solid rgba(0, 255, 136, 0.3); padding: 25px; position: relative; border-radius: 12px;">

                    <!-- Corner Accents -->
                    <div style="position: absolute; top: -2px; left: -2px; width: 20px; height: 20px;
                        border-top: 4px solid #00D4FF; border-left: 4px solid #00D4FF; border-radius: 4px 0 0 0;"></div>
                    <div style="position: absolute; top: -2px; right: -2px; width: 20px; height: 20px;
                        border-top: 4px solid #00D4FF; border-right: 4px solid #00D4FF; border-radius: 0 4px 0 0;"></div>
                    <div style="position: absolute; bottom: -2px; left: -2px; width: 20px; height: 20px;
                        border-bottom: 4px solid #00D4FF; border-left: 4px solid #00D4FF; border-radius: 0 0 0 4px;"></div>
                    <div style="position: absolute; bottom: -2px; right: -2px; width: 20px; height: 20px;
                        border-bottom: 4px solid #00D4FF; border-right: 4px solid #00D4FF; border-radius: 0 0 4px 0;"></div>

                    <!-- Section Title -->
                    <div style="text-align: center; margin-bottom: 20px;">
                        <span style="font-size: 14px; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 2px;">
                            Cores em estoque imediato para o seu projeto
                        </span>
                    </div>

                    <!-- Colors Grid -->
                    ${colorsGridHTML}
                </div>

                <!-- Other Colors Notice -->
                <div style="margin-top: 20px; padding: 15px 20px;
                    background: linear-gradient(135deg, rgba(255, 215, 0, 0.08), rgba(255, 165, 0, 0.08));
                    border-left: 3px solid #FFD700; border-radius: 8px;">
                    <div style="display: flex; align-items: flex-start; gap: 12px;">
                        <div style="color: #FFD700; font-size: 18px; margin-top: 2px;">
                            <i class="fas fa-palette"></i>
                        </div>
                        <div>
                            <div style="font-size: 14px; font-weight: 600; color: #FFD700; margin-bottom: 4px;">
                                Prefere outra cor?
                            </div>
                            <div style="font-size: 13px; color: rgba(255,255,255,0.7); line-height: 1.5;">
                                Trabalhamos com diversas outras cores sob encomenda. O prazo de producao aumenta ligeiramente para cores fora do estoque.
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div style="margin-top: 30px; text-align: center; position: relative;">
                    <div style="margin: 0 auto 15px; width: 200px; height: 1px;
                        background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.5), transparent);"></div>

                    <p style="color: rgba(255, 255, 255, 0.5); font-size: 12px; margin: 5px 0;">
                        ${new Date().toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric'
                        })}
                    </p>
                    <p style="color: rgba(0, 212, 255, 0.7); font-size: 13px; margin: 5px 0;
                        font-weight: 600; letter-spacing: 1px;">
                        www.imaginatech.com.br
                    </p>
                </div>
            </div>

            <!-- Bottom Border -->
            <div style="position: absolute; bottom: 0; left: 0; right: 0; height: 4px;
                background: linear-gradient(90deg, #00D4FF, #00FF88, #00D4FF);"></div>
        `;

        document.body.appendChild(printContainer);

        // Aguardar carregamento das imagens
        const images = printContainer.querySelectorAll('img');
        await Promise.all(Array.from(images).map(img => {
            return new Promise((resolve) => {
                if (img.complete) {
                    resolve();
                } else {
                    img.onload = resolve;
                    img.onerror = resolve;
                }
            });
        }));

        // Gerar canvas com html2canvas
        const canvas = await html2canvas(printContainer, {
            backgroundColor: '#0a0e1a',
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            width: 700,
            height: printContainer.scrollHeight
        });

        // Remover container temporário
        document.body.removeChild(printContainer);

        // Download da imagem
        canvas.toBlob(function(blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `cores-${materialType}-${Date.now()}.png`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);

            // Feedback de sucesso
            btn.innerHTML = '<i class="fas fa-check"></i> Baixado!';
            btn.style.background = 'linear-gradient(135deg, #00FF88, #44FF44)';

            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.background = '';
                btn.disabled = false;
            }, 2000);
        });

    } catch (error) {
        logger.error('Erro ao baixar print:', error);
        alert('Erro ao baixar imagem. Tente novamente.');

        // Restaurar botão em caso de erro
        const btn = document.querySelector('#colorPrintResultModal .btn-primary');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-download"></i> Baixar Imagem';
            btn.disabled = false;
        }
    }
};
