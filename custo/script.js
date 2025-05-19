document.addEventListener("DOMContentLoaded", () => {
    const printerSelect = document.getElementById("printer-select");
    const resultsOutput = document.getElementById("results-output");
    const stlPriceInput = document.getElementById("stl-price");
    const materialUnitSpan = document.getElementById("material-unit");
    const customMaterialUnitSpan = document.getElementById("custom-material-unit");

    // Inputs de tempo
    const timePickerHoursInput = document.getElementById("time-picker-hours");
    const timePickerMinutesInput = document.getElementById("time-picker-minutes");

    const materialUsedInput = document.getElementById("material-used");
    const printQuantityInput = document.getElementById("print-quantity");
    const shippingCostInput = document.getElementById("shipping-cost");

    const toggleCustomParams = document.getElementById("toggle-custom-params");
    const customParamsFields = document.getElementById("custom-params-fields");
    const customMaterialPriceInput = document.getElementById("custom-material-price");
    const customProfitMarginInput = document.getElementById("custom-profit-margin");
    const customFailureRateInput = document.getElementById("custom-failure-rate");
    const customPotenciaMaquinaInput = document.getElementById("custom-potencia-maquina");
    const customPrecoKwhInput = document.getElementById("custom-preco-kwh");
    const customValorMaquinaInput = document.getElementById("custom-valor-maquina");
    const customTempoDepreciacaoInput = document.getElementById("custom-tempo-depreciacao");
    const customMaterialConsumoWrapper = document.getElementById("custom-material-consumo-wrapper");
    const customMaterialConsumoInput = document.getElementById("custom-material-consumo");

    const toggleClientQuote = document.getElementById("toggle-client-quote");
    const clientQuoteFields = document.getElementById("client-quote-fields");
    const clientItemNameInput = document.getElementById("client-item-name");
    const clientMaterialNameInput = document.getElementById("client-material-name");
    const clientShippingLocationInput = document.getElementById("client-shipping-location");
    const clientDeliveryDeadlineInput = document.getElementById("client-delivery-deadline");
    const clientPaintingPriceInput = document.getElementById("client-painting-price");
    const clientQuoteOutputContainer = document.getElementById("client-quote-output-container");
    const copyClientQuoteButton = document.getElementById("copy-client-quote-button");

    // Inicializar dropdowns personalizados
    initCustomDropdowns();
    
    // Limpar campos ao carregar a página
    clearInputFields();

    // Parâmetros padrão para cada impressora (lucro alterado para 230%)
    const printerDefaults = {
        "SATURN_2": {
            "TEMPO DE IMPRESSÃO": 5,
            "MATERIAL UTILIZADO": 70,
            "NÚMERO DE IMPRESSÕES": 1,
            "PREÇO POR QUILO DE MATERIAL": 125,
            "PREÇO DO KWH": 1.2,
            "POTÊNCIA DA MÁQUINA": 400,
            "VALOR DA MÁQUINA": 2600,
            "TEMPO DE DEPRECIAÇÃO": 2000,
            "TAXA DE FALHA": 20,
            "MATERIAL DE CONSUMO": 2,
            "TAXA DE LUCRO": 230
        },
        "K1M": {
            "TEMPO DE IMPRESSÃO": 3,
            "MATERIAL UTILIZADO": 234,
            "NÚMERO DE IMPRESSÕES": 100,
            "PREÇO POR QUILO DE MATERIAL": 64,
            "PREÇO DO KWH": 1.2,
            "POTÊNCIA DA MÁQUINA": 650,
            "VALOR DA MÁQUINA": 4600,
            "TEMPO DE DEPRECIAÇÃO": 6000,
            "PREÇO DO STL": 0,
            "STL PAGO EM QUANTAS PEÇAS": 5,
            "TAXA DE FALHA": 20,
            "TAXA DE LUCRO": 230
        },
        "K1": {
            "TEMPO DE IMPRESSÃO": 4,
            "MATERIAL UTILIZADO": 191,
            "NÚMERO DE IMPRESSÕES": 48,
            "PREÇO POR QUILO DE MATERIAL": 126,
            "PREÇO DO KWH": 1.2,
            "POTÊNCIA DA MÁQUINA": 400,
            "VALOR DA MÁQUINA": 2600,
            "TEMPO DE DEPRECIAÇÃO": 6000,
            "PREÇO DO STL": 0,
            "STL PAGO EM QUANTAS PEÇAS": 5,
            "TAXA DE FALHA": 20,
            "TAXA DE LUCRO": 230
        }
    };

    let currentPrinterDefaults = null;

    // Função para limpar os campos de entrada
    function clearInputFields() {
        // Limpar campos de tempo
        if (timePickerHoursInput) {
            timePickerHoursInput.value = "";
            updateCustomDropdownValue('time-picker-hours', "");
        }
        
        if (timePickerMinutesInput) {
            timePickerMinutesInput.value = "";
            updateCustomDropdownValue('time-picker-minutes', "");
        }
        
        // Limpar campo de material
        if (materialUsedInput) {
            materialUsedInput.value = "";
        }
        
        // Limpar campo de número de peças
        if (printQuantityInput) {
            printQuantityInput.value = "";
        }
        
        // Limpar outros campos
        if (stlPriceInput) stlPriceInput.value = "0";
        if (shippingCostInput) shippingCostInput.value = "0";
    }

    function getInputValue(element, defaultValue = 0) {
        if (!element) return defaultValue; // Guard clause for missing elements
        const value = parseFloat(element.value);
        return isNaN(value) || value < 0 ? defaultValue : value;
    }
    
    function getSafeDefault(key, defaultValue = 0) {
        if (currentPrinterDefaults && typeof currentPrinterDefaults[key] !== 'undefined') {
            const val = parseFloat(currentPrinterDefaults[key]);
            return isNaN(val) ? defaultValue : val;
        }
        return defaultValue;
    }

    function updatePlaceholdersAndUnits(printerKey) {
        if (!printerDefaults[printerKey]) {
            console.warn(`Dados não encontrados para a impressora: ${printerKey}`);
            currentPrinterDefaults = null;
            resultsOutput.innerHTML = "<p>Selecione uma impressora e preencha os campos.</p>";
            return;
        }
        
        currentPrinterDefaults = printerDefaults[printerKey];
        
        const isResinPrinter = printerKey === "SATURN_2";
        if (materialUnitSpan) materialUnitSpan.textContent = isResinPrinter ? "ml" : "g";
        if (customMaterialUnitSpan) customMaterialUnitSpan.textContent = isResinPrinter ? "ml" : "kg";

        // Limpar campos em vez de preencher automaticamente
        clearInputFields();

        // Atualizar placeholders para os campos de parâmetros personalizados
        if (customMaterialPriceInput) customMaterialPriceInput.placeholder = `Padrão: ${getSafeDefault("PREÇO POR QUILO DE MATERIAL")}`;
        if (customProfitMarginInput) customProfitMarginInput.placeholder = `Padrão: ${getSafeDefault("TAXA DE LUCRO")}`;
        if (customFailureRateInput) customFailureRateInput.placeholder = `Padrão: ${getSafeDefault("TAXA DE FALHA")}`;
        if (customPotenciaMaquinaInput) customPotenciaMaquinaInput.placeholder = `Padrão: ${getSafeDefault("POTÊNCIA DA MÁQUINA")}`;
        if (customPrecoKwhInput) customPrecoKwhInput.placeholder = `Padrão: ${getSafeDefault("PREÇO DO KWH")}`;
        if (customValorMaquinaInput) customValorMaquinaInput.placeholder = `Padrão: ${getSafeDefault("VALOR DA MÁQUINA")}`;
        if (customTempoDepreciacaoInput) customTempoDepreciacaoInput.placeholder = `Padrão: ${getSafeDefault("TEMPO DE DEPRECIAÇÃO")}`;

        if (customMaterialConsumoWrapper) {
            if (isResinPrinter) {
                customMaterialConsumoWrapper.style.display = "block";
                if (customMaterialConsumoInput) customMaterialConsumoInput.placeholder = `Padrão: ${getSafeDefault("MATERIAL DE CONSUMO")}`;
            } else {
                customMaterialConsumoWrapper.style.display = "none";
            }
        }
        
        // Não calcular automaticamente, aguardar entrada do usuário
        resultsOutput.innerHTML = "<p>Preencha os campos para calcular o orçamento.</p>";
    }

    function calculateCost() {
        const selectedPrinterKey = printerSelect.value;
        if (!selectedPrinterKey || !currentPrinterDefaults) {
            resultsOutput.innerHTML = "<p>Selecione uma impressora e preencha os campos.</p>";
            return;
        }

        const isResinPrinter = selectedPrinterKey === "SATURN_2";

        // Usar os inputs de tempo
        const hours = getInputValue(timePickerHoursInput, 0);
        const minutes = getInputValue(timePickerMinutesInput, 0);
        const totalTimeHours = hours + minutes / 60;

        const materialUsed = getInputValue(materialUsedInput, 0);
        const printQuantity = getInputValue(printQuantityInput, 1);
        const stlPriceVal = getInputValue(stlPriceInput, 0);
        const shippingCostVal = getInputValue(shippingCostInput, 0);

        const useCustom = toggleCustomParams.checked;

        const materialPricePerUnit = useCustom && customMaterialPriceInput.value !== "" ? 
            getInputValue(customMaterialPriceInput) : 
            getSafeDefault("PREÇO POR QUILO DE MATERIAL");
            
        const profitMargin = (useCustom && customProfitMarginInput.value !== "" ? 
            getInputValue(customProfitMarginInput) : 
            getSafeDefault("TAXA DE LUCRO")) / 100;
            
        const failureRate = (useCustom && customFailureRateInput.value !== "" ? 
            getInputValue(customFailureRateInput) : 
            getSafeDefault("TAXA DE FALHA")) / 100;
            
        const potenciaMaquinaW = useCustom && customPotenciaMaquinaInput.value !== "" ? 
            getInputValue(customPotenciaMaquinaInput) : 
            getSafeDefault("POTÊNCIA DA MÁQUINA");
            
        const precoKWh = useCustom && customPrecoKwhInput.value !== "" ? 
            getInputValue(customPrecoKwhInput) : 
            getSafeDefault("PREÇO DO KWH");
            
        const valorMaquina = useCustom && customValorMaquinaInput.value !== "" ? 
            getInputValue(customValorMaquinaInput) : 
            getSafeDefault("VALOR DA MÁQUINA");
            
        const tempoDepreciacaoHoras = useCustom && customTempoDepreciacaoInput.value !== "" ? 
            getInputValue(customTempoDepreciacaoInput) : 
            getSafeDefault("TEMPO DE DEPRECIAÇÃO", 1); // Evitar divisão por zero
        
        let materialConsumoCusto = 0;
        if (isResinPrinter) {
            materialConsumoCusto = useCustom && customMaterialConsumoInput.value !== "" ? 
                getInputValue(customMaterialConsumoInput) : 
                getSafeDefault("MATERIAL DE CONSUMO");
        }

        if (totalTimeHours === 0 && materialUsed === 0 && stlPriceVal === 0) {
            resultsOutput.innerHTML = "<p>Preencha o tempo, material ou preço do STL.</p>";
            return;
        }

        // Cálculo do custo de energia
        const custoEnergia = (potenciaMaquinaW / 1000) * totalTimeHours * precoKWh;
        
        // Cálculo do custo de depreciação
        const custoDepreciacao = tempoDepreciacaoHoras > 0 ? 
            (valorMaquina / tempoDepreciacaoHoras) * totalTimeHours : 0;
        
        // Cálculo do custo de material
        let custoMaterial;
        if (isResinPrinter) {
            custoMaterial = materialUsed * materialPricePerUnit / 1000; // ml para litro
        } else {
            custoMaterial = (materialUsed / 1000) * materialPricePerUnit; // g para kg
        }

        // Custo base total por peça
        let custoBasePorPeca = (custoEnergia + custoDepreciacao + custoMaterial + stlPriceVal);
        if (isResinPrinter) {
            custoBasePorPeca += materialConsumoCusto;
        }
        
        // Custo base total para todas as peças
        let custoBaseTotal = custoBasePorPeca * printQuantity;

        // Ajuste para taxa de falha
        const custoComFalha = failureRate > 0 ? 
            custoBaseTotal / (1 - failureRate) : 
            custoBaseTotal;
            
        // Preço final com lucro
        const precoFinalComLucro = profitMargin > 0 ? 
            custoComFalha * (1 + profitMargin) : 
            custoComFalha;
        
        // Valores unitários e do lote
        const valorUnitario = precoFinalComLucro / printQuantity;
        const valorLote = precoFinalComLucro;

        // Exibir resultados
        resultsOutput.innerHTML = `
            <p><strong>Custo de Energia:</strong> R$ ${custoEnergia.toFixed(2)}</p>
            <p><strong>Custo de Depreciação:</strong> R$ ${custoDepreciacao.toFixed(2)}</p>
            <p><strong>Custo de Material:</strong> R$ ${custoMaterial.toFixed(2)}</p>
            ${isResinPrinter ? `<p><strong>Custo de Consumíveis (resina):</strong> R$ ${materialConsumoCusto.toFixed(2)}</p>` : ''}
            ${stlPriceVal > 0 ? `<p><strong>Custo Adicional STL:</strong> R$ ${stlPriceVal.toFixed(2)}</p>` : ''}
            <hr>
            <p><strong>Custo Base Total (por ${printQuantity} peça(s)):</strong> R$ ${custoBaseTotal.toFixed(2)}</p>
            <p><strong>Custo com Taxa de Falha (${(failureRate * 100).toFixed(0)}%):</strong> R$ ${custoComFalha.toFixed(2)}</p>
            <p><strong>Preço Final (com Lucro de ${(profitMargin * 100).toFixed(0)}%):</strong> R$ ${valorLote.toFixed(2)}</p>
            <hr>
            <p style="font-size: 1.1em;"><strong>Valor Unitário (por peça):</strong> R$ ${valorUnitario.toFixed(2)}</p>
            ${shippingCostVal > 0 ? `<p style="font-size: 1.1em;"><strong>Valor Total com Frete:</strong> R$ ${(valorLote + shippingCostVal).toFixed(2)}</p>` : ''}
        `;
        
        generateClientQuoteText();
    }

    toggleCustomParams.addEventListener("change", () => {
        const isDisabled = !toggleCustomParams.checked;
        customParamsFields.classList.toggle("disabled", isDisabled);
        customParamsFields.querySelectorAll("input").forEach(input => {
            input.disabled = isDisabled;
            if (isDisabled) input.value = ''; // Limpar inputs personalizados quando desativados
        });
        calculateCost();
    });

    toggleClientQuote.addEventListener("change", () => {
        clientQuoteFields.classList.toggle("disabled", !toggleClientQuote.checked);
        if (toggleClientQuote.checked) {
            generateClientQuoteText();
        }
    });

    function generateClientQuoteText() {
        if (!toggleClientQuote.checked || !currentPrinterDefaults) {
            if (clientQuoteOutputContainer && clientQuoteOutputContainer.querySelector("p")) {
                 clientQuoteOutputContainer.querySelector("p").textContent = "Ative e preencha os campos para gerar o orçamento do cliente.";
            }
            return;
        }

        const itemName = clientItemNameInput.value.trim() || "@Nome do item/itens";
        const materialName = clientMaterialNameInput.value.trim() || "@Nome do material";
        const shippingLocation = clientShippingLocationInput.value.trim() || "@local do frete";
        const deliveryDeadline = clientDeliveryDeadlineInput.value.trim() || "@prazo";
        const paintingPrice = getInputValue(clientPaintingPriceInput, 0);
        
        const hours = getInputValue(timePickerHoursInput, 0);
        const minutes = getInputValue(timePickerMinutesInput, 0);
        const totalTimeHours = hours + minutes / 60;
        const materialUsed = getInputValue(materialUsedInput, 0);
        const printQuantity = getInputValue(printQuantityInput, 1);
        const stlPriceVal = getInputValue(stlPriceInput, 0);
        const shippingCostVal = getInputValue(shippingCostInput, 0);

        const useCustom = toggleCustomParams.checked;
        const materialPricePerUnit = useCustom && customMaterialPriceInput.value !== "" ? 
            getInputValue(customMaterialPriceInput) : 
            getSafeDefault("PREÇO POR QUILO DE MATERIAL");
            
        const profitMargin = (useCustom && customProfitMarginInput.value !== "" ? 
            getInputValue(customProfitMarginInput) : 
            getSafeDefault("TAXA DE LUCRO")) / 100;
            
        const failureRate = (useCustom && customFailureRateInput.value !== "" ? 
            getInputValue(customFailureRateInput) : 
            getSafeDefault("TAXA DE FALHA")) / 100;
            
        const potenciaMaquinaW = useCustom && customPotenciaMaquinaInput.value !== "" ? 
            getInputValue(customPotenciaMaquinaInput) : 
            getSafeDefault("POTÊNCIA DA MÁQUINA");
            
        const precoKWh = useCustom && customPrecoKwhInput.value !== "" ? 
            getInputValue(customPrecoKwhInput) : 
            getSafeDefault("PREÇO DO KWH");
            
        const valorMaquina = useCustom && customValorMaquinaInput.value !== "" ? 
            getInputValue(customValorMaquinaInput) : 
            getSafeDefault("VALOR DA MÁQUINA");
            
        const tempoDepreciacaoHoras = useCustom && customTempoDepreciacaoInput.value !== "" ? 
            getInputValue(customTempoDepreciacaoInput) : 
            getSafeDefault("TEMPO DE DEPRECIAÇÃO", 1);
        
        let materialConsumoCusto = 0;
        const isResinPrinter = printerSelect.value === "SATURN_2";
        if (isResinPrinter) {
            materialConsumoCusto = useCustom && customMaterialConsumoInput.value !== "" ? 
                getInputValue(customMaterialConsumoInput) : 
                getSafeDefault("MATERIAL DE CONSUMO");
        }

        // Cálculo do custo de energia
        const custoEnergia = (potenciaMaquinaW / 1000) * totalTimeHours * precoKWh;
        
        // Cálculo do custo de depreciação
        const custoDepreciacao = tempoDepreciacaoHoras > 0 ? 
            (valorMaquina / tempoDepreciacaoHoras) * totalTimeHours : 0;
        
        // Cálculo do custo de material
        let custoMaterial;
        if (isResinPrinter) {
            custoMaterial = materialUsed * materialPricePerUnit / 1000; // ml para litro
        } else {
            custoMaterial = (materialUsed / 1000) * materialPricePerUnit; // g para kg
        }

        // Custo base total por peça
        let custoBasePorPeca = (custoEnergia + custoDepreciacao + custoMaterial + stlPriceVal);
        if (isResinPrinter) {
            custoBasePorPeca += materialConsumoCusto;
        }
        
        // Custo base total para todas as peças
        let custoBaseTotal = custoBasePorPeca * printQuantity;

        // Ajuste para taxa de falha
        const custoComFalha = failureRate > 0 ? 
            custoBaseTotal / (1 - failureRate) : 
            custoBaseTotal;
            
        // Preço final com lucro
        const precoFinalComLucro = profitMargin > 0 ? 
            custoComFalha * (1 + profitMargin) : 
            custoComFalha;
        
        // Valores unitários e do lote
        const valorUnitario = precoFinalComLucro / printQuantity;
        const valorLote = precoFinalComLucro;
        
        // Valor total incluindo pintura artística (se aplicável)
        const valorTotalPeca = valorLote + (paintingPrice > 0 ? paintingPrice : 0);
        const valorTotalComFrete = valorTotalPeca + shippingCostVal;

        // Cálculo do desconto
        const percentualDesconto = valorTotalComFrete <= 150 ? 10 : 5;
        const valorDesconto = valorTotalComFrete * (percentualDesconto / 100);
        const valorComDesconto = valorTotalComFrete - valorDesconto;

        // Linha de pintura artística (só incluir se o valor for maior que zero)
        const linhaPinturaArtistica = paintingPrice > 0 ? 
            `- Valor da pintura artística: R$${paintingPrice.toFixed(2)}.\n` : 
            '';

        // Novo formato de mensagem conforme modelo
        const quoteText = `Olá! Revisamos o seu modelo para o ${itemName} e vamos transformá-lo em realidade.

- ${printQuantity} ${itemName}.
- Material: ${materialName}.
- Valor da modelagem: R$0,00.
- Valor do STL: R$${stlPriceVal.toFixed(2)}.
- Valor total de impressão: R$${valorLote.toFixed(2)}.
${linhaPinturaArtistica}
Valor total da peça: R$${valorTotalPeca.toFixed(2)}.


- Frete para ${shippingLocation}: ${shippingCostVal > 0 ? `R$${shippingCostVal.toFixed(2)}` : 'Grátis acima de R$500,00'}.
- Prazo de entrega: ${deliveryDeadline}.

Bônus para novos clientes: compartilhe nos stories do Instagram nos marcando quando receber, avalie-nos no google e ganhe ${percentualDesconto}% do valor total da compra de volta no Pix! 
Valor total com desconto: R$${valorComDesconto.toFixed(2)}.

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

        if (clientQuoteOutputContainer) {
            clientQuoteOutputContainer.innerHTML = `<p>${quoteText.replace(/\n/g, '<br>')}</p>
            <button id="copy-client-quote-button" title="Copiar Orçamento"><i class="fas fa-copy"></i></button>`;
            
            document.getElementById("copy-client-quote-button").addEventListener("click", () => {
                navigator.clipboard.writeText(quoteText).then(() => {
                    alert("Orçamento copiado para a área de transferência!");
                }).catch(err => {
                    console.error('Erro ao copiar texto: ', err);
                });
            });
        }
    }

    // Event Listeners
    printerSelect.addEventListener("change", () => {
        updatePlaceholdersAndUnits(printerSelect.value);
    });

    // Adicionar event listeners para todos os inputs que afetam o cálculo
    [timePickerHoursInput, timePickerMinutesInput, materialUsedInput, printQuantityInput, stlPriceInput, shippingCostInput].forEach(input => {
        if (input) {
            input.addEventListener("input", calculateCost);
        }
    });

    // Event listeners para campos de cliente
    [clientItemNameInput, clientMaterialNameInput, clientShippingLocationInput, clientDeliveryDeadlineInput, clientPaintingPriceInput].forEach(input => {
        if (input) {
            input.addEventListener("input", generateClientQuoteText);
        }
    });

    // Inicializar dropdowns personalizados
    function initCustomDropdowns() {
        // Implementação dos dropdowns personalizados
        const timeInputs = document.querySelectorAll('.time-input');
        
        timeInputs.forEach(input => {
            const inputId = input.id;
            const inputWrapper = document.createElement('div');
            inputWrapper.className = 'custom-dropdown-container';
            
            const dropdownButton = document.createElement('button');
            dropdownButton.type = 'button';
            dropdownButton.className = 'custom-dropdown-button';
            dropdownButton.innerHTML = `<span class="dropdown-value">${input.value || 'Selecionar'}</span><i class="fas fa-chevron-down"></i>`;
            
            const dropdownList = document.createElement('div');
            dropdownList.className = 'custom-dropdown-list';
            
            // Gerar opções baseadas no tipo de input (horas ou minutos)
            const maxValue = inputId.includes('hours') ? 24 : 59;
            for (let i = 0; i <= maxValue; i++) {
                const option = document.createElement('div');
                option.className = 'custom-dropdown-option';
                option.textContent = i;
                option.addEventListener('click', () => {
                    input.value = i;
                    dropdownButton.querySelector('.dropdown-value').textContent = i;
                    dropdownList.classList.remove('show');
                    input.dispatchEvent(new Event('input'));
                });
                dropdownList.appendChild(option);
            }
            
            dropdownButton.addEventListener('click', (e) => {
                e.preventDefault();
                dropdownList.classList.toggle('show');
            });
            
            // Fechar dropdown ao clicar fora
            document.addEventListener('click', (e) => {
                if (!inputWrapper.contains(e.target)) {
                    dropdownList.classList.remove('show');
                }
            });
            
            inputWrapper.appendChild(dropdownButton);
            inputWrapper.appendChild(dropdownList);
            
            // Substituir o input original pelo dropdown customizado
            input.parentNode.insertBefore(inputWrapper, input);
            input.style.display = 'none';
        });
    }

    // Função para atualizar o valor exibido no dropdown customizado
    function updateCustomDropdownValue(inputId, value) {
        const input = document.getElementById(inputId);
        if (!input) return;
        
        const dropdownContainer = input.previousElementSibling;
        if (!dropdownContainer || !dropdownContainer.classList.contains('custom-dropdown-container')) return;
        
        const valueDisplay = dropdownContainer.querySelector('.dropdown-value');
        if (valueDisplay) {
            valueDisplay.textContent = value || 'Selecionar';
        }
    }
});
