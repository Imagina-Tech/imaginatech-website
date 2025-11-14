// ==========================
// IMAGINATECH - SISTEMA DE ORÇAMENTO
// JavaScript Principal - Versão com Autenticação
// Arquivo: script-custo.js
// ==========================

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDZxuazTrmimr0951TmTCKckI4Ede2hdn4",
    authDomain: "imaginatech-servicos.firebaseapp.com",
    projectId: "imaginatech-servicos",
    storageBucket: "imaginatech-servicos.firebasestorage.app",
    messagingSenderId: "321455309872",
    appId: "1:321455309872:web:e7ba49a0f020bbae1159f5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// Authorized Emails
const AUTHORIZED_EMAILS = [
    "3d3printers@gmail.com",
    "igor.butter@gmail.com"
];

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

// ===========================
// AUTHENTICATION FUNCTIONS
// ===========================

async function loginWithGoogle() {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        
        if (AUTHORIZED_EMAILS.includes(user.email)) {
            currentUser = user;
            isAuthorized = true;
            showMainApp();
        } else {
            await auth.signOut();
            alert(`Acesso negado! O email ${user.email} não está autorizado.`);
        }
    } catch (error) {
        console.error('Erro no login:', error);
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
        console.error('Erro ao fazer logout:', error);
    }
}

function showMainApp() {
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';

    // Update user info
    if (currentUser) {
        document.getElementById('userPhoto').src = currentUser.photoURL ||
            'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.displayName || 'User');
        document.getElementById('userName').textContent = currentUser.displayName || currentUser.email;
    }

    // Initialize app
    initializeCalculator();
    monitorConnection();
}

function hideMainApp() {
    document.getElementById('loadingOverlay').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
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
    "SATURN_2": {
        name: "Saturn 2",
        type: "resin",
        materialUnit: "ml",
        defaults: {
            materialPrice: 150,      // R$/litro
            profitMargin: 280,       // %
            failureRate: 20,         // %
            machinePower: 400,       // W
            kwhPrice: 1.2,           // R$/kWh
            machineValue: 2600,      // R$
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
    // DOM Elements
    const resultsOutput = document.getElementById("results-output");
    const materialUnitSpan = document.getElementById("material-unit");
    const customUnitSpan = document.getElementById("custom-unit");

    // Printer buttons
    const printerButtons = document.querySelectorAll(".printer-btn");

    // Time controls
    const timeHoursDisplay = document.getElementById("time-hours-display");
    const timeMinutesDisplay = document.getElementById("time-minutes-display");
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
    const stlPriceInput = document.getElementById("stl-price");
    const shippingCostInput = document.getElementById("shipping-cost");
    const modelNameInput = document.getElementById("model-name");
    const profitMarginInput = document.getElementById("profit-margin");
    const consumablesInput = document.getElementById("consumables");
    const customMaterialPriceInput = document.getElementById("custom-material-price");

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
        if (stlPriceInput) stlPriceInput.value = "0";
        if (shippingCostInput) shippingCostInput.value = "0";
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
            button.onclick = () => selectMaterial(material);
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
            materialUsageLabel.innerHTML = `<i class="fas fa-cube"></i> Material Utilizado (<span id="material-unit">${currentPrinter.materialUnit}</span>)`;
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
        const totalTimeHours = timeHours + timeMinutes / 60;
        const materialUsed = materialAmount; // Using global variable
        const printQuantity = getInputValue(printQuantityInput, 1);
        const stlPrice = getInputValue(stlPriceInput, 0);
        const shippingCost = getInputValue(shippingCostInput, 0);
        const profitMargin = getInputValue(profitMarginInput, 280) / 100;
        const consumables = getInputValue(consumablesInput, 2);

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
            if (materialUsed === 0 && stlPrice === 0) {
                resultsOutput.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Preencha o tempo de corte em minutos</p>
                    </div>
                `;
                return;
            }
        } else {
            if (totalTimeHours === 0 && materialUsed === 0 && stlPrice === 0) {
                resultsOutput.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Preencha pelo menos o tempo, material ou preço do STL</p>
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
        
        // 7. Batch price (WITHOUT STL yet)
        const batchPrice = unitPriceNoTax * printQuantity;
        
        // 8. Total with STL (STL is added only once to final total)
        const totalPrice = batchPrice + stlPrice;
        
        // 9. Total with shipping
        const totalWithShipping = totalPrice + shippingCost;

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
                        <i class="fas fa-cube"></i> Material${selectedMaterial ? ' (' + selectedMaterial.name + ')' : ''}
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
                
                ${stlPrice > 0 ? `
                <div class="cost-item">
                    <span class="cost-label">
                        <i class="fas fa-file-code"></i> STL
                    </span>
                    <span class="cost-value">${formatCurrency(stlPrice)}</span>
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
                
                ${shippingCost > 0 ? `
                <div class="total-item">
                    <span class="total-label">Total com Frete</span>
                    <span class="total-value">${formatCurrency(totalWithShipping)}</span>
                </div>
                ` : ''}
            </div>
        `;

        // Store values for print
        window.printData = {
            unitPrice: unitPriceNoTax,
            totalPrice: totalPrice,
            totalWithShipping: totalWithShipping,
            quantity: printQuantity,
            hasShipping: shippingCost > 0
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

        const { unitPrice, totalPrice, totalWithShipping, quantity, hasShipping } = window.printData;

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
                            ${modelName}
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

                    ${hasShipping ? `
                    <!-- Total with Shipping -->
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 18px; color: rgba(255, 255, 255, 0.9); font-weight: 500;">
                            TOTAL COM FRETE
                        </span>
                        <span style="font-size: 28px; font-weight: 700; color: #FFD700;
                            font-family: 'Orbitron', monospace; text-shadow: 0 0 15px rgba(255, 215, 0, 0.6);">
                            ${formatCurrency(totalWithShipping)}
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
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Print Gerado!';
                btn.style.background = 'linear-gradient(135deg, #00FF88, #44FF44)';
                
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.style.background = '';
                }, 2000);
            });
            
        } catch (error) {
            console.error('Erro ao gerar print:', error);
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
        printQuantityInput, stlPriceInput, shippingCostInput,
        profitMarginInput, consumablesInput
    ];
    
    mainInputs.forEach(input => {
        if (input) {
            input.addEventListener("input", calculateCost);
        }
    });

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
    createParticles();
    
    // Check authentication state
    document.getElementById('loadingOverlay').style.display = 'flex';
    
    auth.onAuthStateChanged((user) => {
        if (user && AUTHORIZED_EMAILS.includes(user.email)) {
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

    console.log('Sistema de Orçamento ImaginaTech carregado com sucesso!');
    console.log('Versão: 4.0 - Com Autenticação e Seletor de Materiais');
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
