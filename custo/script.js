// ===========================
// IMAGINATECH - SISTEMA DE ORÇAMENTO
// JavaScript Principal - Versão Corrigida com Dados da Planilha
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
    const stlPiecesSection = document.getElementById("stl-pieces-section");
    const stlPiecesInput = document.getElementById("stl-pieces");

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
    // CONFIGURAÇÃO DAS IMPRESSORAS (BASEADO NA PLANILHA)
    // ===========================
    const printerDefaults = {
        "SATURN_2": {
            name: "Saturn 2",
            type: "resin",
            materialUnit: "ml",
            defaults: {
                materialPrice: 150,      // R$/litro (da planilha)
                profitMargin: 280,       // % (da planilha)
                failureRate: 20,         // % (da planilha)
                machinePower: 400,       // W (da planilha)
                kwhPrice: 1.2,           // R$/kWh (da planilha)
                machineValue: 2600,      // R$ (da planilha)
                depreciationTime: 2000,  // horas (da planilha)
                consumables: 2,          // R$ - álcool + luva (da planilha)
                stlDivision: false       // Não usa divisão de STL
            }
        },
        "K1": {
            name: "Creality K1",
            type: "fdm",
            materialUnit: "g",
            defaults: {
                materialPrice: 75,       // R$/kg (da planilha)
                profitMargin: 280,       // % (da planilha)
                failureRate: 20,         // % (da planilha)
                machinePower: 400,       // W (da planilha)
                kwhPrice: 1.2,           // R$/kWh (da planilha)
                machineValue: 2600,      // R$ (da planilha)
                depreciationTime: 6000,  // horas (da planilha)
                consumables: 0,          // Não usa consumíveis extras
                stlDivision: true,       // Usa divisão de STL
                stlPiecesDefault: 5      // Padrão de 5 peças (da planilha)
            }
        },
        "K1M": {
            name: "Creality K1 Max",
            type: "fdm",
            materialUnit: "g",
            defaults: {
                materialPrice: 70,       // R$/kg (da planilha)
                profitMargin: 280,       // % (da planilha)
                failureRate: 20,         // % (da planilha)
                machinePower: 650,       // W (da planilha)
                kwhPrice: 1.2,           // R$/kWh (da planilha)
                machineValue: 4600,      // R$ (da planilha)
                depreciationTime: 6000,  // horas (da planilha)
                consumables: 0,
                stlDivision: true,       // Usa divisão de STL
                stlPiecesDefault: 1      // Padrão de 1 peça (da planilha)
            }
        },
        "K2PLUS": {
            name: "Creality K2 Plus",
            type: "fdm",
            materialUnit: "g",
            defaults: {
                materialPrice: 70,       // R$/kg (da planilha)
                profitMargin: 280,       // % (da planilha)
                failureRate: 20,         // % (da planilha)
                machinePower: 1200,      // W (da planilha)
                kwhPrice: 1.2,           // R$/kWh (da planilha)
                machineValue: 12000,     // R$ (da planilha)
                depreciationTime: 10000, // horas (da planilha)
                consumables: 0,
                stlDivision: true,       // Usa divisão de STL
                stlPiecesDefault: 1      // Padrão de 1 peça (da planilha)
            }
        },
        "LASER": {
            name: "Máquina Laser CO2",
            type: "laser",
            materialUnit: "minutos",  // Trabalha com minutos
            defaults: {
                materialPrice: 0,        // Laser não usa material dessa forma
                profitMargin: 280,       // % (da planilha)
                failureRate: 20,         // % (da planilha)
                machinePower: 60,        // W (da planilha)
                kwhPrice: 1.2,           // R$/kWh (da planilha)
                machineValue: 2000,      // R$ (da planilha)
                depreciationTime: 10000, // horas (da planilha)
                consumables: 0,          // Sem consumíveis
                stlDivision: false       // Não usa divisão de STL
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
        if (stlPiecesInput) stlPiecesInput.value = "1";
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

        // Mostrar/ocultar campo de divisão de STL
        if (stlPiecesSection) {
            if (defaults.stlDivision) {
                stlPiecesSection.style.display = "block";
                if (stlPiecesInput) stlPiecesInput.value = defaults.stlPiecesDefault || 1;
            } else {
                stlPiecesSection.style.display = "none";
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
    // CÁLCULO PRINCIPAL (BASEADO NAS FÓRMULAS DA PLANILHA)
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
        const stlPieces = getInputValue(stlPiecesInput, 1);

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
        if (currentPrinter.type === 'resin') {
            consumables = useCustom && customConsumablesInput.value !== "" ? 
                getInputValue(customConsumablesInput) : defaults.consumables;
        }

        // ===========================
        // CÁLCULOS (SEGUINDO AS FÓRMULAS DA PLANILHA)
        // ===========================
        
        // Para laser, usar o tempo convertido
        const timeForCalc = currentPrinter.type === 'laser' ? actualTimeHours : totalTimeHours;
        
        // 1. Custo de energia (C16 da planilha)
        const energyCost = (machinePower / 1000) * timeForCalc * kwhPrice;
        
        // 2. Custo de depreciação (parte da C18)
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

        // 4. STL dividido em peças (para K1, K1M, K2+)
        let stlCostPerPiece = stlPrice;
        if (defaults.stlDivision && stlPieces > 1) {
            stlCostPerPiece = stlPrice / stlPieces;
        }

        // 5. Custo de produção por unidade (C18 da planilha)
        // Fórmula: (material + energia + depreciação) * (1 + taxa_falha) + consumíveis + STL
        let productionCostPerUnit = (materialCost + energyCost + depreciationCost) * (1 + failureRate);
        
        // Adicionar consumíveis para resina
        if (currentPrinter.type === 'resin') {
            productionCostPerUnit += consumables * printQuantity;
        }
        
        // Adicionar STL
        productionCostPerUnit += stlCostPerPiece;
        
        // 6. Custo de produção do lote (C19)
        const productionCostTotal = productionCostPerUnit * printQuantity;
        
        // 7. Valor da unidade sem imposto (C21 - usando apenas lucro, sem imposto)
        const unitPriceNoTax = productionCostPerUnit * (1 + profitMargin);
        
        // 8. Valor do lote (C23)
        const totalPrice = unitPriceNoTax * printQuantity;
        
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
                        <i class="fas fa-file-code"></i> STL ${defaults.stlDivision && stlPieces > 1 ? `(÷${stlPieces})` : ''}
                    </span>
                    <span class="cost-value">${formatCurrency(stlCostPerPiece)}</span>
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
                
                <div class="total-item">
                    <span class="total-label">Valor Total (${(profitMargin * 100).toFixed(0)}% lucro)</span>
                    <span class="total-value">${formatCurrency(totalPrice)}</span>
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
            generateClientQuote(totalPrice, shippingCost, unitPriceNoTax, printQuantity);
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
        printQuantityInput, stlPriceInput, shippingCostInput, stlPiecesInput
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
    console.log('Versão: 2.0 - Com dados da planilha');
    console.log('Máquinas disponíveis: Saturn 2, K1, K1M, K2+, Laser');
});
