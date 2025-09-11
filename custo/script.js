// ===========================
// IMAGINATECH - SISTEMA DE ORÇAMENTO
// JavaScript Principal - Versão Corrigida e Otimizada
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

    // Toggle e campos customizados
    const toggleCustomParams = document.getElementById("toggle-custom-params");
    const customParamsFields = document.getElementById("custom-params-fields");
    const customMaterialPriceInput = document.getElementById("custom-material-price");
    const customProfitMarginInput = document.getElementById("custom-profit-margin");
    const customFailureRateInput = document.getElementById("custom-failure-rate");
    const customMachinePowerInput = document.getElementById("custom-machine-power");
    const customKwhPriceInput = document.getElementById("custom-kwh-price");
    const customMachineValueInput = document.getElementById("custom-machine-value");
    const customDepreciationTimeInput = document.getElementById("custom-depreciation-time");
    const customConsumablesWrapper = document.getElementById("custom-consumables-wrapper");
    const customConsumablesInput = document.getElementById("custom-consumables");

    // Cliente quote
    const toggleClientQuote = document.getElementById("toggle-client-quote");
    const clientQuoteFields = document.getElementById("client-quote-fields");
    const clientItemNameInput = document.getElementById("client-item-name");
    const clientMaterialNameInput = document.getElementById("client-material-name");
    const clientShippingLocationInput = document.getElementById("client-shipping-location");
    const clientDeliveryDeadlineInput = document.getElementById("client-delivery-deadline");
    const clientPaintingPriceInput = document.getElementById("client-painting-price");
    const clientQuoteOutput = document.getElementById("client-quote-output");

    // ===========================
    // CONFIGURAÇÃO DAS IMPRESSORAS
    // ===========================
    const printerDefaults = {
        "SATURN_2": {
            name: "Saturn 2",
            type: "resin",
            materialUnit: "ml",
            defaults: {
                materialPrice: 125,      // R$/litro
                profitMargin: 230,       // %
                failureRate: 20,         // %
                machinePower: 400,       // W
                kwhPrice: 1.2,           // R$/kWh
                machineValue: 2600,      // R$
                depreciationTime: 2000,  // horas
                consumables: 2           // R$ por impressão
            }
        },
        "K1": {
            name: "Creality K1",
            type: "fdm",
            materialUnit: "g",
            defaults: {
                materialPrice: 126,      // R$/kg
                profitMargin: 230,       // %
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
                materialPrice: 64,       // R$/kg
                profitMargin: 230,       // %
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
                materialPrice: 75,       // R$/kg (estimativa)
                profitMargin: 230,       // %
                failureRate: 15,         // % (menor por ser mais nova)
                machinePower: 800,       // W (estimativa)
                kwhPrice: 1.2,           // R$/kWh
                machineValue: 8000,      // R$ (estimativa)
                depreciationTime: 7000,  // horas
                consumables: 0
            }
        },
        "LASER": {
            name: "Máquina Laser",
            type: "laser",
            materialUnit: "cm²",
            defaults: {
                materialPrice: 0.05,     // R$/cm² (custo do material por área)
                profitMargin: 250,       // % (maior margem)
                failureRate: 5,          // % (muito baixa)
                machinePower: 1500,      // W
                kwhPrice: 1.2,           // R$/kWh
                machineValue: 15000,     // R$
                depreciationTime: 10000, // horas
                consumables: 0.5         // R$ por trabalho (manutenção laser)
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
        if (materialUnitSpan) materialUnitSpan.textContent = currentPrinter.materialUnit;
        if (customMaterialUnitSpan) {
            if (currentPrinter.type === 'resin') {
                customMaterialUnitSpan.textContent = 'litro';
            } else if (currentPrinter.type === 'laser') {
                customMaterialUnitSpan.textContent = 'cm²';
            } else {
                customMaterialUnitSpan.textContent = 'kg';
            }
        }

        // Atualizar placeholders
        if (customMaterialPriceInput) customMaterialPriceInput.placeholder = `Padrão: ${defaults.materialPrice}`;
        if (customProfitMarginInput) customProfitMarginInput.placeholder = `Padrão: ${defaults.profitMargin}`;
        if (customFailureRateInput) customFailureRateInput.placeholder = `Padrão: ${defaults.failureRate}`;
        if (customMachinePowerInput) customMachinePowerInput.placeholder = `Padrão: ${defaults.machinePower}`;
        if (customKwhPriceInput) customKwhPriceInput.placeholder = `Padrão: ${defaults.kwhPrice}`;
        if (customMachineValueInput) customMachineValueInput.placeholder = `Padrão: ${defaults.machineValue}`;
        if (customDepreciationTimeInput) customDepreciationTimeInput.placeholder = `Padrão: ${defaults.depreciationTime}`;
        
        // Mostrar/ocultar campo de consumíveis
        if (customConsumablesWrapper) {
            if (currentPrinter.type === 'resin' || currentPrinter.type === 'laser') {
                customConsumablesWrapper.style.display = "block";
                if (customConsumablesInput) customConsumablesInput.placeholder = `Padrão: ${defaults.consumables}`;
            } else {
                customConsumablesWrapper.style.display = "none";
            }
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

        // Verificar se há dados suficientes
        if (totalTimeHours === 0 && materialUsed === 0 && stlPrice === 0) {
            resultsOutput.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Preencha pelo menos o tempo, material ou preço do STL</p>
                </div>
            `;
            return;
        }

        // Obter parâmetros (customizados ou padrão)
        const useCustom = toggleCustomParams.checked;
        const defaults = currentPrinter.defaults;
        
        const materialPrice = useCustom && customMaterialPriceInput.value !== "" ? 
            getInputValue(customMaterialPriceInput) : defaults.materialPrice;
            
        const profitMargin = (useCustom && customProfitMarginInput.value !== "" ? 
            getInputValue(customProfitMarginInput) : defaults.profitMargin) / 100;
            
        const failureRate = (useCustom && customFailureRateInput.value !== "" ? 
            getInputValue(customFailureRateInput) : defaults.failureRate) / 100;
            
        const machinePower = useCustom && customMachinePowerInput.value !== "" ? 
            getInputValue(customMachinePowerInput) : defaults.machinePower;
            
        const kwhPrice = useCustom && customKwhPriceInput.value !== "" ? 
            getInputValue(customKwhPriceInput) : defaults.kwhPrice;
            
        const machineValue = useCustom && customMachineValueInput.value !== "" ? 
            getInputValue(customMachineValueInput) : defaults.machineValue;
            
        const depreciationTime = useCustom && customDepreciationTimeInput.value !== "" ? 
            getInputValue(customDepreciationTimeInput) : defaults.depreciationTime;
        
        let consumables = 0;
        if (currentPrinter.type === 'resin' || currentPrinter.type === 'laser') {
            consumables = useCustom && customConsumablesInput.value !== "" ? 
                getInputValue(customConsumablesInput) : defaults.consumables;
        }

        // ===========================
        // CÁLCULOS
        // ===========================
        
        // 1. Custo de energia
        const energyCost = (machinePower / 1000) * totalTimeHours * kwhPrice;
        
        // 2. Custo de depreciação
        const depreciationCost = depreciationTime > 0 ? 
            (machineValue / depreciationTime) * totalTimeHours : 0;
        
        // 3. Custo de material (diferente para cada tipo)
        let materialCost = 0;
        if (currentPrinter.type === 'resin') {
            materialCost = materialUsed * materialPrice / 1000; // ml para litro
        } else if (currentPrinter.type === 'laser') {
            materialCost = materialUsed * materialPrice; // cm² direto
        } else {
            materialCost = (materialUsed / 1000) * materialPrice; // g para kg
        }

        // 4. Custo base por peça
        let baseCostPerPiece = energyCost + depreciationCost + materialCost + stlPrice;
        if (currentPrinter.type === 'resin' || currentPrinter.type === 'laser') {
            baseCostPerPiece += consumables;
        }
        
        // 5. Custo base total
        const baseCostTotal = baseCostPerPiece * printQuantity;
        
        // 6. Custo com taxa de falha
        const costWithFailure = failureRate > 0 ? 
            baseCostTotal / (1 - failureRate) : baseCostTotal;
        
        // 7. Preço final com lucro
        const finalPrice = costWithFailure * (1 + profitMargin);
        
        // 8. Valores unitários
        const unitPrice = finalPrice / printQuantity;
        const totalWithShipping = finalPrice + shippingCost;

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
                
                <div class="cost-item">
                    <span class="cost-label">
                        <i class="fas fa-cube"></i> Material
                    </span>
                    <span class="cost-value">${formatCurrency(materialCost)}</span>
                </div>
                
                ${(currentPrinter.type === 'resin' || currentPrinter.type === 'laser') ? `
                <div class="cost-item">
                    <span class="cost-label">
                        <i class="fas fa-tools"></i> Consumíveis
                    </span>
                    <span class="cost-value">${formatCurrency(consumables)}</span>
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
            </div>
            
            <div class="divider"></div>
            
            <div class="cost-item">
                <span class="cost-label">
                    <strong>Custo Base (${printQuantity} peça${printQuantity > 1 ? 's' : ''})</strong>
                </span>
                <span class="cost-value">${formatCurrency(baseCostTotal)}</span>
            </div>
            
            <div class="cost-item">
                <span class="cost-label">
                    Taxa de Falha (${(failureRate * 100).toFixed(0)}%)
                </span>
                <span class="cost-value">${formatCurrency(costWithFailure - baseCostTotal)}</span>
            </div>
            
            <div class="total-section">
                <div class="total-item">
                    <span class="total-label">Valor Unitário</span>
                    <span class="total-value">${formatCurrency(unitPrice)}</span>
                </div>
                
                <div class="total-item">
                    <span class="total-label">Valor Total (${(profitMargin * 100).toFixed(0)}% lucro)</span>
                    <span class="total-value">${formatCurrency(finalPrice)}</span>
                </div>
                
                ${shippingCost > 0 ? `
                <div class="total-item">
                    <span class="total-label">Total com Frete</span>
                    <span class="total-value">${formatCurrency(totalWithShipping)}</span>
                </div>
                ` : ''}
            </div>
        `;

        // Gerar orçamento do cliente se ativado
        if (toggleClientQuote.checked) {
            generateClientQuote(finalPrice, shippingCost, unitPrice, printQuantity);
        }
    }

    // ===========================
    // ORÇAMENTO DO CLIENTE
    // ===========================
    
    function generateClientQuote(finalPrice, shippingCost, unitPrice, quantity) {
        const itemName = clientItemNameInput.value.trim() || "@Nome do item";
        const materialName = clientMaterialNameInput.value.trim() || "@Material";
        const location = clientShippingLocationInput.value.trim() || "@local";
        const deadline = clientDeliveryDeadlineInput.value.trim() || "@prazo";
        const paintingPrice = getInputValue(clientPaintingPriceInput, 0);
        const stlPrice = getInputValue(stlPriceInput, 0);
        
        const totalPiece = finalPrice + paintingPrice;
        const totalWithShipping = totalPiece + shippingCost;
        
        // Calcular desconto
        const discountPercent = totalWithShipping <= 150 ? 10 : 5;
        const discountValue = totalWithShipping * (discountPercent / 100);
        const finalWithDiscount = totalWithShipping - discountValue;
        
        // Linha de pintura (opcional)
        const paintingLine = paintingPrice > 0 ? 
            `- Valor da pintura artística: ${formatCurrency(paintingPrice)}.\n` : '';
        
        const quoteText = `Olá! Revisamos o seu modelo para o ${itemName} e vamos transformá-lo em realidade.

- ${quantity} ${itemName}.
- Material: ${materialName}.
- Valor da modelagem: R$0,00.
- Valor do STL: ${formatCurrency(stlPrice)}.
- Valor total de impressão: ${formatCurrency(finalPrice)}.
${paintingLine}
Valor total da peça: ${formatCurrency(totalPiece)}.

- Frete para ${location}: ${shippingCost > 0 ? formatCurrency(shippingCost) : 'Grátis acima de R$500,00'}.
- Prazo de entrega: ${deadline}.

Bônus para novos clientes: compartilhe nos stories do Instagram nos marcando quando receber, avalie-nos no google e ganhe ${discountPercent}% do valor total da compra de volta no Pix! 
Valor total com desconto: ${formatCurrency(finalWithDiscount)}.

Formas de pagamento:
- Pix (instantâneo).
- Transferência bancária/TED.
- Cartão de crédito via link de pagamento (opção de parcelamento com juros baixos).

Durante todo o processo, enviaremos fotos e atualizações da sua impressão, assim você acompanha cada etapa.

Política de produção:
50% do valor para iniciarmos a produção.
50% no ato da entrega.
(emitimos nota fiscal para pj caso necessário).

Iniciaremos a produção o mais rápido possível. Confirma o pedido?`;

        clientQuoteOutput.innerHTML = `
            <div class="quote-text">${quoteText.replace(/\n/g, '<br>')}</div>
            <button class="copy-button" onclick="copyQuoteToClipboard()">
                <i class="fas fa-copy"></i>
                Copiar Orçamento
            </button>
        `;
        
        // Salvar texto no window para a função de copiar
        window.currentQuoteText = quoteText;
    }

    // Função global para copiar
    window.copyQuoteToClipboard = function() {
        if (window.currentQuoteText) {
            navigator.clipboard.writeText(window.currentQuoteText).then(() => {
                // Feedback visual
                const button = document.querySelector('.copy-button');
                const originalHTML = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check"></i> Copiado!';
                button.style.background = 'linear-gradient(135deg, #00FF88, #44FF44)';
                
                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.style.background = '';
                }, 2000);
            }).catch(err => {
                console.error('Erro ao copiar:', err);
                alert('Erro ao copiar o orçamento. Tente selecionar e copiar manualmente.');
            });
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

    // Toggle orçamento do cliente
    toggleClientQuote.addEventListener("change", (e) => {
        const isEnabled = e.target.checked;
        clientQuoteFields.classList.toggle("disabled", !isEnabled);
        
        if (isEnabled) {
            calculateCost(); // Recalcular para gerar o orçamento
        } else {
            clientQuoteOutput.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-alt"></i>
                    <p>Preencha os campos para gerar o orçamento</p>
                </div>
            `;
        }
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

    // Inputs customizados - recalcular em tempo real (CORREÇÃO DO BUG)
    const customInputs = [
        customMaterialPriceInput, customProfitMarginInput, customFailureRateInput,
        customMachinePowerInput, customKwhPriceInput, customMachineValueInput,
        customDepreciationTimeInput, customConsumablesInput
    ];
    
    customInputs.forEach(input => {
        if (input) {
            input.addEventListener("input", () => {
                if (toggleCustomParams.checked) {
                    calculateCost(); // Recalcular apenas se os parâmetros customizados estiverem ativados
                }
            });
        }
    });

    // Inputs do cliente
    const clientInputs = [
        clientItemNameInput, clientMaterialNameInput, clientShippingLocationInput,
        clientDeliveryDeadlineInput, clientPaintingPriceInput
    ];
    
    clientInputs.forEach(input => {
        if (input) {
            input.addEventListener("input", () => {
                if (toggleClientQuote.checked) {
                    calculateCost(); // Recalcular para atualizar o orçamento
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
    
    clientQuoteOutput.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-file-alt"></i>
            <p>Preencha os campos para gerar o orçamento</p>
        </div>
    `;

    console.log('Sistema de Orçamento ImaginaTech carregado com sucesso!');
});
