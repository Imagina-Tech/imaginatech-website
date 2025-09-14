// ===========================
// IMAGINATECH - SISTEMA DE ORÇAMENTO
// JavaScript Principal - Versão Simplificada
// Arquivo: script.js
// ===========================

document.addEventListener("DOMContentLoaded", () => {
    // ===========================
    // ELEMENTOS DO DOM
    // ===========================
    const printerSelect = document.getElementById("printer-select");
    const resultsOutput = document.getElementById("results-output");
    const materialUnitSpan = document.getElementById("material-unit");
    const customMaterialUnitSpan = document.getElementById("custom-material-unit");

    // Inputs principais
    const timeHoursInput = document.getElementById("time-hours");
    const timeMinutesInput = document.getElementById("time-minutes");
    const materialUsedInput = document.getElementById("material-used");
    const printQuantityInput = document.getElementById("print-quantity");
    const stlPriceInput = document.getElementById("stl-price");
    const shippingCostInput = document.getElementById("shipping-cost");
    const modelNameInput = document.getElementById("model-name");

    // Toggle e campos customizados
    const toggleCustomParams = document.getElementById("toggle-custom-params");
    const customParamsFields = document.getElementById("custom-params-fields");
    const customMaterialPriceInput = document.getElementById("custom-material-price");
    const customProfitMarginInput = document.getElementById("custom-profit-margin");
    const customConsumablesWrapper = document.getElementById("custom-consumables-wrapper");
    const customConsumablesInput = document.getElementById("custom-consumables");

    // ===========================
    // CONFIGURAÇÃO DAS IMPRESSORAS (VALORES OCULTOS INTERNOS)
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

    let currentPrinter = null;

    // ===========================
    // FUNÇÕES UTILITÁRIAS
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

    function clearInputs() {
        [timeHoursInput, timeMinutesInput, materialUsedInput].forEach(input => {
            if (input) input.value = "";
        });
        if (printQuantityInput) printQuantityInput.value = "1";
        if (stlPriceInput) stlPriceInput.value = "0";
        if (shippingCostInput) shippingCostInput.value = "0";
    }

    function updatePlaceholders() {
        if (!currentPrinter) return;
        
        const defaults = currentPrinter.defaults;
        
        // Atualizar unidades
        if (materialUnitSpan) {
            materialUnitSpan.textContent = currentPrinter.materialUnit;
        }
        
        if (customMaterialUnitSpan) {
            if (currentPrinter.type === 'resin') {
                customMaterialUnitSpan.textContent = 'litro';
            } else if (currentPrinter.type === 'laser') {
                customMaterialUnitSpan.textContent = 'minuto';
            } else {
                customMaterialUnitSpan.textContent = 'kg';
            }
        }

        // Atualizar placeholders
        if (customMaterialPriceInput) customMaterialPriceInput.placeholder = `Padrão: ${defaults.materialPrice}`;
        if (customProfitMarginInput) customProfitMarginInput.placeholder = `Padrão: ${defaults.profitMargin}`;
        
        // Mostrar/ocultar campo de consumíveis
        if (customConsumablesWrapper) {
            if (currentPrinter.type === 'resin') {
                customConsumablesWrapper.style.display = "block";
                if (customConsumablesInput) customConsumablesInput.placeholder = `Padrão: ${defaults.consumables}`;
            } else {
                customConsumablesWrapper.style.display = "none";
            }
        }

        // Ajustar label para máquina laser
        if (currentPrinter.type === 'laser') {
            document.querySelector('label[for="material-used"]').innerHTML = 
                '<i class="fas fa-clock"></i> Tempo de Corte (minutos)';
        } else {
            document.querySelector('label[for="material-used"]').innerHTML = 
                `<i class="fas fa-cube"></i> Material Utilizado (<span id="material-unit">${currentPrinter.materialUnit}</span>)`;
        }
    }

    // ===========================
    // CÁLCULO PRINCIPAL
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

        // Obter valores dos inputs
        const hours = getInputValue(timeHoursInput, 0);
        const minutes = getInputValue(timeMinutesInput, 0);
        const totalTimeHours = hours + minutes / 60;
        const materialUsed = getInputValue(materialUsedInput, 0);
        const printQuantity = getInputValue(printQuantityInput, 1);
        const stlPrice = getInputValue(stlPriceInput, 0);
        const shippingCost = getInputValue(shippingCostInput, 0);

        // Para laser, o "material" é na verdade o tempo em minutos
        let actualTimeHours = totalTimeHours;
        if (currentPrinter.type === 'laser') {
            actualTimeHours = materialUsed / 60; // Converter minutos para horas
        }

        // Verificar se há dados suficientes
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

        // Obter parâmetros (customizados ou padrão)
        const useCustom = toggleCustomParams.checked;
        const defaults = currentPrinter.defaults;
        
        const materialPrice = useCustom && customMaterialPriceInput.value !== "" ? 
            getInputValue(customMaterialPriceInput) : defaults.materialPrice;
            
        const profitMargin = (useCustom && customProfitMarginInput.value !== "" ? 
            getInputValue(customProfitMarginInput) : defaults.profitMargin) / 100;
            
        // Valores internos (não exibidos ao usuário)
        const failureRate = defaults.failureRate / 100;
        const machinePower = defaults.machinePower;
        const kwhPrice = defaults.kwhPrice;
        const machineValue = defaults.machineValue;
        const depreciationTime = defaults.depreciationTime;
        
        let consumables = 0;
        if (currentPrinter.type === 'resin') {
            consumables = useCustom && customConsumablesInput.value !== "" ? 
                getInputValue(customConsumablesInput) : defaults.consumables;
        }

        // ===========================
        // CÁLCULOS
        // ===========================
        
        // Para laser, usar o tempo convertido
        const timeForCalc = currentPrinter.type === 'laser' ? actualTimeHours : totalTimeHours;
        
        // 1. Custo de energia
        const energyCost = (machinePower / 1000) * timeForCalc * kwhPrice;
        
        // 2. Custo de depreciação
        const depreciationCost = depreciationTime > 0 ? 
            (machineValue / depreciationTime) * timeForCalc : 0;
        
        // 3. Custo de material
        let materialCost = 0;
        if (currentPrinter.type === 'resin') {
            materialCost = (materialUsed / 1000) * materialPrice; // ml para litro
        } else if (currentPrinter.type === 'laser') {
            materialCost = 0; // Laser não tem custo de material dessa forma
        } else {
            materialCost = (materialUsed / 1000) * materialPrice; // g para kg
        }

        // 4. Custo de produção por unidade
        let productionCostPerUnit = (materialCost + energyCost + depreciationCost) * (1 + failureRate);
        
        // Adicionar consumíveis para resina
        if (currentPrinter.type === 'resin') {
            productionCostPerUnit += consumables * printQuantity;
        }
        
        // 5. Custo de produção do lote (SEM STL)
        const productionCostTotal = productionCostPerUnit * printQuantity;
        
        // 6. Valor da unidade sem imposto (com lucro)
        const unitPriceNoTax = productionCostPerUnit * (1 + profitMargin);
        
        // 7. Valor do lote (SEM STL ainda)
        const batchPrice = unitPriceNoTax * printQuantity;
        
        // 8. Total com STL (STL é somado apenas uma vez ao total final)
        const totalPrice = batchPrice + stlPrice;
        
        // 9. Total com frete
        const totalWithShipping = totalPrice + shippingCost;

        // ===========================
        // EXIBIR RESULTADOS
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
                        <i class="fas fa-cube"></i> Material
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

        // Armazenar valores para o print
        window.printData = {
            unitPrice: unitPriceNoTax,
            totalPrice: totalPrice,
            totalWithShipping: totalWithShipping,
            quantity: printQuantity,
            hasShipping: shippingCost > 0
        };
    }

    // ===========================
    // FUNÇÃO GERAR PRINT
    // ===========================
    
    window.generatePrint = async function() {
        if (!window.printData) {
            alert('Por favor, calcule primeiro o orçamento antes de gerar o print.');
            return;
        }

        const modelName = modelNameInput.value.trim() || 'Modelo não especificado';
        
        // Criar um container temporário para o print
        const printContainer = document.createElement('div');
        printContainer.className = 'print-container';
        printContainer.style.cssText = `
            position: fixed;
            top: -9999px;
            left: -9999px;
            width: 600px;
            background: linear-gradient(135deg, #1a2332, #0a0e1a);
            border: 2px solid rgba(0, 255, 136, 0.3);
            border-radius: 20px;
            padding: 40px;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: white;
        `;

        const { unitPrice, totalPrice, totalWithShipping, quantity, hasShipping } = window.printData;
        
        printContainer.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="font-family: 'Orbitron', monospace; font-size: 28px; 
                    background: linear-gradient(135deg, #00D4FF, #57D4CA); 
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                    background-clip: text; margin: 0;">
                    ImaginaTech
                </h1>
                <p style="color: #00FF88; font-size: 18px; margin: 10px 0; font-weight: 600;">
                    Orçamento Simplificado
                </p>
            </div>
            
            <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); 
                border-radius: 15px; padding: 25px; margin-bottom: 25px;">
                <h2 style="color: #00D4FF; font-size: 20px; margin: 0 0 20px 0; 
                    font-family: 'Orbitron', monospace;">
                    <span style="color: #FFD700;">📦</span> ${modelName}
                </h2>
                
                <div style="background: linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 212, 255, 0.1));
                    border: 2px solid #00FF88; border-radius: 10px; padding: 20px;">
                    
                    <div style="display: flex; justify-content: space-between; margin-bottom: 15px; 
                        padding-bottom: 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                        <span style="font-size: 18px; color: white;">Valor Unitário:</span>
                        <span style="font-size: 22px; font-weight: 700; color: #00FF88; 
                            font-family: 'Orbitron', monospace; text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);">
                            ${formatCurrency(unitPrice)}
                        </span>
                    </div>
                    
                    ${quantity > 1 ? `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 15px;
                        padding-bottom: 15px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                        <span style="font-size: 18px; color: white;">
                            Valor Total (${quantity} unidades):
                        </span>
                        <span style="font-size: 22px; font-weight: 700; color: #00FF88; 
                            font-family: 'Orbitron', monospace; text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);">
                            ${formatCurrency(totalPrice)}
                        </span>
                    </div>
                    ` : ''}
                    
                    ${hasShipping ? `
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-size: 18px; color: white;">Total com Frete:</span>
                        <span style="font-size: 22px; font-weight: 700; color: #FFD700; 
                            font-family: 'Orbitron', monospace; text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);">
                            ${formatCurrency(totalWithShipping)}
                        </span>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 25px;">
                <p style="color: rgba(255, 255, 255, 0.6); font-size: 14px;">
                    ${new Date().toLocaleDateString('pt-BR', { 
                        day: '2-digit', 
                        month: 'long', 
                        year: 'numeric' 
                    })}
                </p>
                <p style="color: rgba(255, 255, 255, 0.4); font-size: 12px; margin-top: 10px;">
                    www.imaginatech.com.br
                </p>
            </div>
        `;
        
        document.body.appendChild(printContainer);
        
        try {
            // Usar html2canvas para gerar a imagem
            const canvas = await html2canvas(printContainer, {
                backgroundColor: null,
                scale: 2,
                logging: false,
                width: 600,
                height: printContainer.scrollHeight
            });
            
            // Converter para blob e fazer download
            canvas.toBlob(function(blob) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                const filename = `orcamento_${modelName.replace(/\s+/g, '_')}_${new Date().getTime()}.png`;
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
                
                // Feedback visual
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
    
    // Mudança de impressora
    printerSelect.addEventListener("change", (e) => {
        const selectedPrinter = e.target.value;
        if (selectedPrinter && printerDefaults[selectedPrinter]) {
            currentPrinter = printerDefaults[selectedPrinter];
            clearInputs();
            updatePlaceholders();
            calculateCost();
        } else {
            currentPrinter = null;
            calculateCost();
        }
    });

    // Toggle parâmetros customizados
    toggleCustomParams.addEventListener("change", (e) => {
        const isEnabled = e.target.checked;
        customParamsFields.classList.toggle("disabled", !isEnabled);
        
        // Habilitar/desabilitar inputs
        customParamsFields.querySelectorAll("input").forEach(input => {
            input.disabled = !isEnabled;
            if (!isEnabled) input.value = ''; // Limpar valores ao desabilitar
        });
        
        calculateCost(); // Recalcular imediatamente
    });

    // Inputs principais - recalcular em tempo real
    const mainInputs = [
        timeHoursInput, timeMinutesInput, materialUsedInput, 
        printQuantityInput, stlPriceInput, shippingCostInput
    ];
    
    mainInputs.forEach(input => {
        if (input) {
            input.addEventListener("input", calculateCost);
        }
    });

    // Inputs customizados - recalcular em tempo real
    const customInputs = [
        customMaterialPriceInput, customProfitMarginInput, customConsumablesInput
    ];
    
    customInputs.forEach(input => {
        if (input) {
            input.addEventListener("input", () => {
                if (toggleCustomParams.checked) {
                    calculateCost();
                }
            });
        }
    });

    // ===========================
    // EFEITOS VISUAIS
    // ===========================
    
    // Criar partículas de fundo
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
    // INICIALIZAÇÃO
    // ===========================
    
    createParticles();
    
    // Estado inicial
    resultsOutput.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-calculator"></i>
            <p>Selecione uma impressora e preencha os dados para calcular</p>
        </div>
    `;

    console.log('Sistema de Orçamento ImaginaTech carregado com sucesso!');
    console.log('Versão: 3.0 - Simplificada');
    console.log('Máquinas disponíveis: Saturn 2, K1, K1M, K2+, Laser');
});
