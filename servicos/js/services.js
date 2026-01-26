/* ==================================================
ARQUIVO: servicos/js/services.js
MÓDULO: Lógica de Serviços (CRUD, Status, Upload, Renderização)
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 3.6 - Filtro de visualização otimizado
IMPORTANTE: NÃO REMOVER ESTE CABEÇALHO DE IDENTIFICAÇÃO
==================================================
*/

import { state, COMPANY_USER_ID, logger } from './config.js';
import {
    showToast,
    escapeHtml,
    sanitizeFileName,
    formatDate,
    formatDateBrazil,
    formatMoney,
    formatColorName,
    formatDaysText,
    getDaysColor,
    getDeliveryMethodName,
    getDeliveryIcon,
    getStatusLabel,
    getStatusIcon,
    isStatusCompleted,
    parseDateBrazil,
    calculateDaysRemaining,
    sendWhatsAppMessage,
    sendEmailNotification,
    saveClientToFirestore
} from './auth-ui.js';
import { STATUS_ORDER, STATUS_ORDER_MODELAGEM, getStatusOrderForService, getCarrierInfo } from './utils.js';

// COMPANY_USER_ID importado de config.js

// ===========================
// SERVICE MANAGEMENT
// ===========================

export const generateOrderCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const randomValues = crypto.getRandomValues(new Uint8Array(5));
    return Array.from(randomValues, v => chars[v % chars.length]).join('');
};

// ===========================
// STOCK INTEGRATION
// ===========================

let availableFilaments = [];
let filamentsListener = null; // Listener para atualizações real-time
let filamentsRequestId = 0; // ID para cancelar requests anteriores

/**
 * Encontra TODOS os filamentos que correspondem a material + cor
 * Retorna ordenado por quantidade de estoque (maior primeiro)
 * CORRIGIDO: Comparação case-insensitive para material E cor
 * @param {string} material - Tipo do material
 * @param {string} color - Cor do material
 * @returns {Array} Array de filamentos correspondentes, ordenado por estoque
 */
export function findAllMatchingFilaments(material, color) {
    if (!material || !color) return [];

    const matches = availableFilaments.filter(f => {
        if (!f.type || !f.color) return false;
        // CORRIGIDO: Ambas comparações agora são case-insensitive
        return f.type.toLowerCase() === material.toLowerCase() &&
               f.color.toLowerCase() === color.toLowerCase() &&
               f.weight > 0; // Apenas com estoque
    });

    // Ordenar por quantidade de estoque (maior primeiro)
    return matches.sort((a, b) => b.weight - a.weight);
}

/**
 * Encontra o MELHOR filamento (maior estoque) que corresponde a material + cor
 * @param {string} material - Tipo do material
 * @param {string} color - Cor do material
 * @returns {Object} Filamento com mais estoque, ou null se não encontrar
 */
export function findBestFilament(material, color) {
    const matches = findAllMatchingFilaments(material, color);
    return matches.length > 0 ? matches[0] : null;
}

/**
 * Carrega filamentos disponíveis do estoque com LISTENER REAL-TIME
 * CORRIGIDO: Usa requestId para cancelar chamadas anteriores e evitar memory leak
 */
export function loadAvailableFilaments() {
    if (!state.db) return Promise.resolve([]);

    // Incrementar requestId para invalidar chamadas anteriores
    const currentRequestId = ++filamentsRequestId;

    // Remover listener anterior se existir
    if (filamentsListener) {
        filamentsListener();
        filamentsListener = null;
    }

    return new Promise((resolve, reject) => {
        filamentsListener = state.db.collection('filaments')
            .onSnapshot(snapshot => {
                // Ignorar se esta chamada foi cancelada por uma mais recente
                if (currentRequestId !== filamentsRequestId) {
                    return;
                }

                try {
                    availableFilaments = snapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    logger.log(`[STOCK] Estoque atualizado: ${availableFilaments.length} filamentos carregados`);

                    // Atualizar dropdowns se o modal estiver aberto
                    const materialSelect = document.getElementById('serviceMaterial');
                    if (materialSelect) {
                        const currentMaterial = materialSelect.value;
                        updateMaterialDropdown();
                        if (currentMaterial) {
                            materialSelect.value = currentMaterial;
                            materialSelect.dispatchEvent(new Event('change', { bubbles: true }));
                            updateColorDropdown(currentMaterial);
                        }
                    }

                    resolve(availableFilaments);
                } catch (error) {
                    logger.error('Erro ao processar filamentos:', error);
                    reject(error);
                }
            }, error => {
                // Ignorar erros de chamadas canceladas
                if (currentRequestId !== filamentsRequestId) {
                    return;
                }
                logger.error('Erro ao carregar filamentos:', error);
                reject(error);
            });
    });
}

/**
 * Para o listener de filamentos (chamar ao desmontar/sair)
 */
export function stopFilamentsListener() {
    if (filamentsListener) {
        filamentsListener();
        filamentsListener = null;
        logger.log('🛑 Listener de filamentos parado');
    }
}

// Lista de todos os materiais disponiveis (independente do estoque)
const ALL_MATERIALS = [
    'PLA', 'PLA Flex', 'ABS', 'PETG', 'TPU',
    'PC', 'PP', 'Nylon PA6', 'Nylon PA12', 'Nylon',
    'ASA', 'HIPS', 'PVA', 'Resina', 'Outros'
];

/**
 * Atualiza dropdown de materiais
 * Mostra TODOS os materiais disponiveis, indicando quais tem estoque
 */
export function updateMaterialDropdown() {
    const materialSelect = document.getElementById('serviceMaterial');
    if (!materialSelect) return;

    // Materiais com estoque disponivel
    const inStock = availableFilaments.filter(f => f.weight > 0);
    const materialsInStock = [...new Set(inStock.map(f => f.type))];

    // Salvar valor selecionado antes de atualizar
    const currentValue = materialSelect.value;

    // Atualizar dropdown com TODOS os materiais
    materialSelect.innerHTML = '<option value="">Selecione o material</option>';

    ALL_MATERIALS.forEach(material => {
        const option = document.createElement('option');
        option.value = material;
        const hasStock = materialsInStock.includes(material);
        option.textContent = hasStock ? material : `${material} (sem estoque)`;
        materialSelect.appendChild(option);
    });

    // Restaurar valor selecionado se ainda existir e sincronizar dropdown customizado
    setTimeout(() => {
        if (currentValue && ALL_MATERIALS.includes(currentValue)) {
            materialSelect.value = currentValue;
        }
        materialSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);
}

/**
 * Atualiza dropdown de cores baseado no material selecionado
 * Lista cada filamento individualmente com marca e peso para diferenciação
 */
export function updateColorDropdown(selectedMaterial) {
    const colorSelect = document.getElementById('serviceColor');
    if (!colorSelect) return;

    // Filtrar filamentos pelo tipo de material e que tenham estoque
    const filtered = availableFilaments.filter(f => {
        if (!selectedMaterial) return false;
        if (f.type !== selectedMaterial) return false;
        if (f.weight <= 0) return false; // Apenas com estoque
        return true;
    });

    // Ordenar por cor (alfabético) e depois por peso (maior primeiro)
    filtered.sort((a, b) => {
        const colorCompare = a.color.localeCompare(b.color);
        if (colorCompare !== 0) return colorCompare;
        return b.weight - a.weight; // Maior peso primeiro
    });

    // Atualizar dropdown
    colorSelect.innerHTML = '<option value="">Selecione a cor</option>';

    if (filtered.length === 0) {
        colorSelect.innerHTML += '<option value="" disabled>Sem estoque disponível</option>';
    } else {
        // Agrupar por cor para saber se precisa mostrar marca
        const colorCounts = {};
        filtered.forEach(f => {
            colorCounts[f.color] = (colorCounts[f.color] || 0) + 1;
        });

        filtered.forEach(filament => {
            const option = document.createElement('option');
            option.value = filament.color.toLowerCase();
            option.dataset.filamentId = filament.id; // Guardar ID para referência futura

            const weightGrams = (filament.weight * 1000).toFixed(0);
            const brand = filament.brand || 'S/marca';

            // Se há múltiplos da mesma cor, mostrar marca para diferenciar
            if (colorCounts[filament.color] > 1) {
                option.textContent = `${filament.color} - ${brand} (${weightGrams}g)`;
            } else {
                option.textContent = `${filament.color} (${weightGrams}g)`;
            }

            colorSelect.appendChild(option);
        });
    }
}

// ===========================
// MULTI-COLOR MODE FUNCTIONS
// ===========================

let colorEntries = []; // Array para gerenciar entradas de cor
let colorEntryCounter = 0; // Contador para IDs unicos

/**
 * Toggle entre modo single-color e multi-color
 */
export function toggleMultiColorMode() {
    const isMultiColor = document.getElementById('isMultiColor')?.checked || false;
    const singleContainer = document.getElementById('singleColorContainer');
    const multiContainer = document.getElementById('multiColorContainer');
    const weightField = document.getElementById('serviceWeight');
    const weightGroup = weightField?.closest('.form-group');

    if (isMultiColor) {
        if (singleContainer) singleContainer.style.display = 'none';
        if (multiContainer) multiContainer.style.display = 'block';
        if (weightGroup) weightGroup.style.display = 'none'; // Esconder peso individual

        // Se nao tem entradas, adicionar a primeira
        if (colorEntries.length === 0) {
            addColorEntry();
        }
    } else {
        if (singleContainer) singleContainer.style.display = 'block';
        if (multiContainer) multiContainer.style.display = 'none';
        if (weightGroup) weightGroup.style.display = 'block'; // Mostrar peso individual
    }
}

/**
 * Adiciona uma nova entrada de cor
 */
export function addColorEntry() {
    const container = document.getElementById('colorEntriesContainer');
    if (!container) return;

    const material = document.getElementById('serviceMaterial')?.value;

    // Limitar a 5 cores
    if (colorEntries.length >= 5) {
        showToast('Maximo de 5 cores por servico', 'warning');
        return;
    }

    const index = colorEntryCounter++;

    const entryDiv = document.createElement('div');
    entryDiv.className = 'color-entry';
    entryDiv.dataset.entryIndex = index;
    entryDiv.innerHTML = createColorEntryHTML(index);
    container.appendChild(entryDiv);

    // Atualizar dropdown de cores para esta entrada
    if (material) {
        updateColorDropdownForEntry(index, material);
    }

    colorEntries.push({
        index: index,
        color: '',
        weight: 0,
        needsPurchase: false
    });

    updateColorEntryNumbers();
    updateMultiColorTotal();
    updateAddColorButton();
}

/**
 * Remove uma entrada de cor
 */
export function removeColorEntry(index) {
    // Minimo de 1 entrada em modo multi-cor
    if (colorEntries.length <= 1) {
        showToast('Necessario pelo menos 1 cor', 'warning');
        return;
    }

    const container = document.getElementById('colorEntriesContainer');
    const entry = container?.querySelector(`[data-entry-index="${index}"]`);
    if (entry) {
        entry.remove();
    }

    colorEntries = colorEntries.filter(e => e.index !== index);

    updateColorEntryNumbers();
    updateMultiColorTotal();
    updateAddColorButton();
}

/**
 * Cria HTML para uma entrada de cor
 * SEGURANCA: Usa data-action para delegacao de eventos (sem onclick inline)
 */
function createColorEntryHTML(index) {
    return `
        <div class="color-entry-header">
            <span class="color-entry-number">Cor 1</span>
            <button type="button" class="btn-remove-color" data-action="removeColorEntry" data-index="${index}">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="color-entry-fields">
            <div class="form-group">
                <label>Cor *</label>
                <select class="form-select color-select" data-index="${index}" data-change="handleColorEntryChange">
                    <option value="">Selecione a cor</option>
                </select>
            </div>
            <div class="form-group">
                <label>Peso (g) *</label>
                <input type="number" class="form-input color-weight" data-index="${index}"
                       min="1" placeholder="0" data-input="handleWeightEntryChange">
            </div>
            <div class="stock-status" data-index="${index}">
                <i class="fas fa-question-circle"></i>
                <span>Selecione</span>
            </div>
        </div>
    `;
}

/**
 * Atualiza dropdown de cores para uma entrada especifica
 * Mostra cada filamento individualmente com marca (igual ao single-color)
 */
export function updateColorDropdownForEntry(index, material, existingColor = null, existingFilamentId = null) {
    const select = document.querySelector(`.color-select[data-index="${index}"]`);
    if (!select || !material) return;

    // Filtrar filamentos pelo material e ordenar
    const filtered = availableFilaments.filter(f => {
        if (!f.type || f.type.toLowerCase() !== material.toLowerCase()) return false;
        return true; // Incluir todos, mesmo sem estoque
    });

    // Ordenar por cor (alfabetico) e depois por peso (maior primeiro)
    filtered.sort((a, b) => {
        const colorCompare = a.color.localeCompare(b.color);
        if (colorCompare !== 0) return colorCompare;
        return b.weight - a.weight;
    });

    // Contar quantos filamentos de cada cor existem (para saber se precisa mostrar marca)
    const colorCounts = {};
    filtered.forEach(f => {
        colorCounts[f.color] = (colorCounts[f.color] || 0) + 1;
    });

    const currentValue = select.value;
    const currentFilamentId = select.dataset.selectedFilamentId;
    select.innerHTML = '<option value="">Selecione a cor</option>';

    // Se tem cor existente (editando) e nao esta nos filamentos, adicionar opcao virtual
    const existingInFilaments = existingColor && filtered.some(f =>
        f.color.toLowerCase() === existingColor.toLowerCase()
    );

    if (existingColor && !existingInFilaments) {
        const option = document.createElement('option');
        option.value = existingColor.toLowerCase();
        option.dataset.filamentId = existingFilamentId || 'existing';
        option.textContent = `${existingColor} (em uso - sem estoque)`;
        select.appendChild(option);
    }

    if (filtered.length === 0 && !existingColor) {
        select.innerHTML += '<option value="" disabled>Nenhuma cor cadastrada</option>';
    } else {
        // Adicionar cada filamento como opcao individual
        filtered.forEach(filament => {
            const option = document.createElement('option');
            const weightGrams = (filament.weight * 1000).toFixed(0);
            const brand = filament.brand || 'S/marca';
            const hasStock = filament.weight > 0;

            // Valor e valor combinado com ID para identificacao unica
            option.value = filament.color.toLowerCase();
            option.dataset.filamentId = filament.id;
            option.dataset.brand = brand;
            option.dataset.weight = weightGrams;

            // Se ha multiplos da mesma cor, mostrar marca para diferenciar
            if (colorCounts[filament.color] > 1) {
                if (hasStock) {
                    option.textContent = `${filament.color} - ${brand} (${weightGrams}g)`;
                } else {
                    option.textContent = `${filament.color} - ${brand} (sem estoque)`;
                    option.classList.add('no-stock-option');
                }
            } else {
                if (hasStock) {
                    option.textContent = `${filament.color} (${weightGrams}g)`;
                } else {
                    option.textContent = `${filament.color} (sem estoque)`;
                    option.classList.add('no-stock-option');
                }
            }

            select.appendChild(option);
        });
    }

    // Restaurar valor se existia (tentar pelo filamentId primeiro, depois pela cor)
    if (currentFilamentId) {
        const optionById = select.querySelector(`option[data-filament-id="${currentFilamentId}"]`);
        if (optionById) {
            select.value = optionById.value;
            select.dataset.selectedFilamentId = currentFilamentId;
        } else if (currentValue) {
            select.value = currentValue;
        }
    } else if (currentValue) {
        select.value = currentValue;
    }

    // Inicializar CustomSelect se ainda nao foi
    if (!select.dataset.customized && window.CustomSelect) {
        new window.CustomSelect(select);
        select.dataset.customized = 'true';
    }

    // Sincronizar CustomSelect
    setTimeout(() => {
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);
}

/**
 * Atualiza todos os dropdowns de cor quando material muda
 */
export function updateAllColorEntryDropdowns() {
    const material = document.getElementById('serviceMaterial')?.value;
    if (!material) return;

    colorEntries.forEach(entry => {
        updateColorDropdownForEntry(entry.index, material);
    });
}

/**
 * Handler quando cor de uma entrada muda
 */
export function handleColorEntryChange(index) {
    const select = document.querySelector(`.color-select[data-index="${index}"]`);
    const weightInput = document.querySelector(`.color-weight[data-index="${index}"]`);

    if (!select) return;

    const color = select.value;
    const weight = parseFloat(weightInput?.value) || 0;

    // Obter dados do filamento selecionado
    const selectedOption = select.options[select.selectedIndex];
    const filamentId = selectedOption?.dataset?.filamentId || null;
    const brand = selectedOption?.dataset?.brand || '';

    // Guardar filamentId no select para referencia
    select.dataset.selectedFilamentId = filamentId || '';

    // Atualizar estado
    const entry = colorEntries.find(e => e.index === index);
    if (entry) {
        entry.color = color;
        entry.filamentId = filamentId;
        entry.brand = brand;
    }

    // Atualizar status do estoque
    updateStockStatusForEntry(index, color, weight, filamentId);
}

/**
 * Handler quando peso de uma entrada muda
 */
export function handleWeightEntryChange(index) {
    const select = document.querySelector(`.color-select[data-index="${index}"]`);
    const weightInput = document.querySelector(`.color-weight[data-index="${index}"]`);

    if (!weightInput) return;

    const color = select?.value || '';
    const weight = parseFloat(weightInput.value) || 0;

    // Atualizar estado
    const entry = colorEntries.find(e => e.index === index);
    if (entry) {
        entry.weight = weight;
    }

    // Atualizar status do estoque
    updateStockStatusForEntry(index, color, weight);
    updateMultiColorTotal();
}

/**
 * Atualiza indicador de status do estoque para uma entrada
 * @param {number} index - Indice da entrada de cor
 * @param {string} color - Cor selecionada
 * @param {number} weight - Peso em gramas
 * @param {string} filamentId - ID do filamento especifico (opcional)
 */
function updateStockStatusForEntry(index, color, weight, filamentId = null) {
    const statusDiv = document.querySelector(`.stock-status[data-index="${index}"]`);
    if (!statusDiv) return;

    const material = document.getElementById('serviceMaterial')?.value;

    if (!color) {
        statusDiv.className = 'stock-status';
        statusDiv.innerHTML = `<i class="fas fa-question-circle"></i><span>Selecione</span>`;
        return;
    }

    if (!weight || weight <= 0) {
        statusDiv.className = 'stock-status';
        statusDiv.innerHTML = `<i class="fas fa-balance-scale"></i><span>Informe peso</span>`;
        return;
    }

    let stockInfo;

    // Se tem filamentId, verificar estoque do filamento especifico
    if (filamentId && filamentId !== 'existing') {
        const filament = availableFilaments.find(f => f.id === filamentId);
        if (filament) {
            const availableGrams = Math.floor(filament.weight * 1000);
            const hasStock = availableGrams >= weight;
            stockInfo = {
                hasStock,
                available: availableGrams,
                needed: weight,
                filament,
                notFound: false
            };
        } else {
            stockInfo = { hasStock: false, available: 0, needed: weight, filament: null, notFound: true };
        }
    } else {
        // Sem filamentId especifico, usar verificacao geral
        stockInfo = checkStockAvailability(material, color, weight);
    }

    // Atualizar flag de compra necessaria
    const entry = colorEntries.find(e => e.index === index);
    if (entry) {
        entry.needsPurchase = !stockInfo.hasStock;
        entry.filamentId = filamentId || stockInfo.filament?.id || null;
    }

    if (stockInfo.notFound) {
        statusDiv.className = 'stock-status no-stock';
        statusDiv.innerHTML = `<i class="fas fa-times-circle"></i><span>Nao encontrado</span>`;
    } else if (stockInfo.hasStock) {
        statusDiv.className = 'stock-status has-stock';
        statusDiv.innerHTML = `<i class="fas fa-check-circle"></i><span>${stockInfo.available}g disp.</span>`;
    } else {
        const missing = stockInfo.needed - stockInfo.available;
        statusDiv.className = 'stock-status no-stock';
        statusDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i><span>Faltam ${missing}g</span>`;
    }
}

/**
 * Atualiza numeracao das entradas de cor
 */
function updateColorEntryNumbers() {
    const container = document.getElementById('colorEntriesContainer');
    if (!container) return;

    const entries = container.querySelectorAll('.color-entry');
    entries.forEach((entry, i) => {
        const numberSpan = entry.querySelector('.color-entry-number');
        if (numberSpan) {
            numberSpan.textContent = `Cor ${i + 1}`;
        }
    });
}

/**
 * Atualiza o total de peso multi-cor
 */
function updateMultiColorTotal() {
    const totalDiv = document.getElementById('multiColorTotal');
    const totalDisplay = document.getElementById('totalWeightDisplay');

    if (!totalDiv || !totalDisplay) return;

    const total = colorEntries.reduce((sum, entry) => sum + (entry.weight || 0), 0);

    if (total > 0) {
        totalDiv.style.display = 'block';
        totalDisplay.textContent = `${total}g`;
    } else {
        totalDiv.style.display = 'none';
    }
}

/**
 * Atualiza estado do botao adicionar cor
 */
function updateAddColorButton() {
    const btn = document.querySelector('.btn-add-color');
    if (btn) {
        btn.disabled = colorEntries.length >= 5;
    }
}

/**
 * Coleta dados do formulario multi-cor
 * @returns {Object} { materials: Array, totalWeight: number, needsMaterialPurchase: boolean }
 */
export function collectMultiColorData() {
    const material = document.getElementById('serviceMaterial')?.value;
    const entries = [];
    let totalWeight = 0;
    let anyNeedsPurchase = false;

    colorEntries.forEach(entry => {
        const select = document.querySelector(`.color-select[data-index="${entry.index}"]`);
        const weightInput = document.querySelector(`.color-weight[data-index="${entry.index}"]`);

        const color = select?.value || entry.color;
        const weight = parseFloat(weightInput?.value) || entry.weight;

        // Obter filamentId da opcao selecionada ou do estado da entrada
        const selectedOption = select?.options[select?.selectedIndex];
        const filamentId = selectedOption?.dataset?.filamentId || entry.filamentId || null;
        const brand = selectedOption?.dataset?.brand || entry.brand || '';

        if (color && weight > 0) {
            let needsPurchase;
            let finalFilamentId = filamentId;

            // Se tem filamentId especifico, verificar estoque desse filamento
            if (filamentId && filamentId !== 'existing') {
                const filament = availableFilaments.find(f => f.id === filamentId);
                if (filament) {
                    const availableGrams = Math.floor(filament.weight * 1000);
                    needsPurchase = availableGrams < weight;
                } else {
                    needsPurchase = true;
                }
            } else {
                // Sem filamentId especifico, usar verificacao geral
                const stockInfo = checkStockAvailability(material, color, weight);
                needsPurchase = !stockInfo.hasStock;
                finalFilamentId = stockInfo.filament?.id || null;
            }

            entries.push({
                color: color,
                weight: weight,
                needsPurchase: needsPurchase,
                filamentId: finalFilamentId,
                brand: brand
            });

            totalWeight += weight;
            if (needsPurchase) anyNeedsPurchase = true;
        }
    });

    return {
        materials: entries,
        totalWeight: totalWeight,
        needsMaterialPurchase: anyNeedsPurchase
    };
}

/**
 * Reseta o estado multi-cor (chamar ao fechar modal)
 */
export function resetMultiColorState() {
    colorEntries = [];
    colorEntryCounter = 0;

    const container = document.getElementById('colorEntriesContainer');
    if (container) container.innerHTML = '';

    const isMultiColorCheckbox = document.getElementById('isMultiColor');
    if (isMultiColorCheckbox) isMultiColorCheckbox.checked = false;

    const singleContainer = document.getElementById('singleColorContainer');
    const multiContainer = document.getElementById('multiColorContainer');
    const weightField = document.getElementById('serviceWeight');
    const weightGroup = weightField?.closest('.form-group');

    if (singleContainer) singleContainer.style.display = 'block';
    if (multiContainer) multiContainer.style.display = 'none';
    if (weightGroup) weightGroup.style.display = 'block';

    const totalDiv = document.getElementById('multiColorTotal');
    if (totalDiv) totalDiv.style.display = 'none';
}

/**
 * Carrega dados multi-cor no formulario (ao editar servico)
 */
export function loadMultiColorData(service) {
    if (!service.isMultiColor || !service.materials || service.materials.length === 0) {
        return false; // Nao e multi-cor
    }

    // IMPORTANTE: Limpar estado ANTES de ativar modo multicor
    // Isso evita que toggleMultiColorMode() adicione entrada fantasma
    colorEntries = [];
    colorEntryCounter = 0;
    const container = document.getElementById('colorEntriesContainer');
    if (container) container.innerHTML = '';

    // Agora sim, ativar modo multicor (toggleMultiColorMode vai ver colorEntries vazio
    // e adicionar uma entrada, mas vamos sobrescrever com as entradas corretas)
    const isMultiColorCheckbox = document.getElementById('isMultiColor');
    if (isMultiColorCheckbox) {
        isMultiColorCheckbox.checked = true;
        toggleMultiColorMode();
    }

    // Limpar novamente para garantir (toggleMultiColorMode pode ter adicionado uma entrada)
    colorEntries = [];
    colorEntryCounter = 0;
    if (container) container.innerHTML = '';

    const material = service.material;

    // Carregar cada cor
    service.materials.forEach((m, i) => {
        addColorEntry();

        const entry = colorEntries[colorEntries.length - 1];
        if (!entry) return;

        // Guardar dados no estado da entrada
        entry.color = m.color;
        entry.filamentId = m.filamentId || null;
        entry.brand = m.brand || '';
        entry.weight = m.weight;
        entry.needsPurchase = m.needsPurchase;

        // Usar setTimeout para aguardar o DOM e CustomSelect processar
        const baseDelay = 100;
        setTimeout(() => {
            const select = document.querySelector(`.color-select[data-index="${entry.index}"]`);
            const weightInput = document.querySelector(`.color-weight[data-index="${entry.index}"]`);

            if (!select) return;

            // Atualizar dropdown COM a cor e filamentId existentes
            if (material) {
                updateColorDropdownForEntry(entry.index, material, m.color, m.filamentId);

                // Delay para CustomSelect processar as novas opções
                setTimeout(() => {
                    let valueSet = false;

                    // Tentar selecionar pelo filamentId primeiro
                    if (m.filamentId) {
                        const optionById = select.querySelector(`option[data-filament-id="${m.filamentId}"]`);
                        if (optionById) {
                            select.value = optionById.value;
                            select.dataset.selectedFilamentId = m.filamentId;
                            valueSet = true;
                        }
                    }

                    // Fallback: tentar pelo valor da cor
                    if (!valueSet) {
                        const colorValue = m.color.toLowerCase();
                        const optionByColor = Array.from(select.options).find(opt => opt.value === colorValue);
                        if (optionByColor) {
                            select.value = colorValue;
                        }
                    }

                    // Disparar evento para sincronizar CustomSelect
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }, 50);
            }

            // Definir peso
            if (weightInput) {
                weightInput.value = m.weight;
                setTimeout(() => {
                    handleWeightEntryChange(entry.index);
                }, 60);
            }
        }, baseDelay * (i + 1));
    });

    // Atualizar total após todas as entradas serem carregadas
    const totalDelay = 100 * (service.materials.length + 1) + 100;
    setTimeout(() => {
        updateMultiColorTotal();
    }, totalDelay);

    return true; // Carregou como multi-cor
}

/**
 * Processa edicao de servico multi-cor
 * Compara estados anterior e atual para deduzir/devolver materiais
 */
export async function processMultiColorEdit(oldService, newMaterials, material) {
    const oldMaterials = oldService.materials || [];
    const results = { devolvidos: [], deduzidos: [], erros: [] };

    // 1. Identificar cores removidas (devolver ao estoque)
    for (const oldM of oldMaterials) {
        const wasDeducted = !oldM.needsPurchase;
        const stillExists = newMaterials.find(nm =>
            nm.color.toLowerCase() === oldM.color.toLowerCase()
        );

        if (!stillExists && wasDeducted && oldM.weight > 0) {
            logger.log(`↩️ Devolvendo ${oldM.weight}g de ${oldM.color} (${oldM.brand || 'sem marca'}) ao estoque (cor removida)`);
            const success = await deductMaterialFromStock(material, oldM.color, -oldM.weight, oldM.filamentId);
            if (success) {
                results.devolvidos.push({ color: oldM.color, weight: oldM.weight });
            } else {
                results.erros.push({ color: oldM.color, action: 'devolver' });
            }
        }
    }

    // 2. Processar cores existentes e novas
    for (const newM of newMaterials) {
        const oldM = oldMaterials.find(om =>
            om.color.toLowerCase() === newM.color.toLowerCase()
        );

        if (!oldM) {
            // Cor nova - deduzir se tem estoque
            if (!newM.needsPurchase && newM.weight > 0) {
                logger.log(`🔽 Deduzindo ${newM.weight}g de ${newM.color} (${newM.brand || 'sem marca'}) - nova cor`);
                const success = await deductMaterialFromStock(material, newM.color, newM.weight, newM.filamentId);
                if (success) {
                    results.deduzidos.push({ color: newM.color, weight: newM.weight });
                } else {
                    newM.needsPurchase = true;
                    results.erros.push({ color: newM.color, action: 'deduzir' });
                }
            }
        } else {
            // Cor existente - verificar diferenca de peso
            const wasDeducted = !oldM.needsPurchase;
            const weightDiff = newM.weight - oldM.weight;
            // Usar o filamentId do material antigo para devolucoes, novo para deducoes
            const filamentIdForReturn = oldM.filamentId;
            const filamentIdForDeduct = newM.filamentId || oldM.filamentId;

            if (wasDeducted) {
                if (weightDiff > 0) {
                    // Aumentou - verificar e deduzir diferenca
                    const stockInfo = checkStockAvailability(material, newM.color, weightDiff);
                    if (stockInfo.hasStock) {
                        logger.log(`📈 Deduzindo diferenca de ${weightDiff}g de ${newM.color}`);
                        const success = await deductMaterialFromStock(material, newM.color, weightDiff, filamentIdForDeduct);
                        if (success) {
                            results.deduzidos.push({ color: newM.color, weight: weightDiff });
                            newM.needsPurchase = false;
                        } else {
                            // Falhou - devolver tudo e marcar para compra
                            await deductMaterialFromStock(material, newM.color, -oldM.weight, filamentIdForReturn);
                            newM.needsPurchase = true;
                            results.devolvidos.push({ color: newM.color, weight: oldM.weight });
                        }
                    } else {
                        // Nao tem estoque para aumento - devolver tudo
                        logger.log(`❌ Sem estoque para aumento. Devolvendo ${oldM.weight}g de ${newM.color}`);
                        await deductMaterialFromStock(material, newM.color, -oldM.weight, filamentIdForReturn);
                        newM.needsPurchase = true;
                        results.devolvidos.push({ color: newM.color, weight: oldM.weight });
                    }
                } else if (weightDiff < 0) {
                    // Diminuiu - devolver diferenca
                    const returnAmount = Math.abs(weightDiff);
                    logger.log(`📉 Devolvendo diferenca de ${returnAmount}g de ${newM.color}`);
                    await deductMaterialFromStock(material, newM.color, weightDiff, filamentIdForReturn);
                    results.devolvidos.push({ color: newM.color, weight: returnAmount });
                    newM.needsPurchase = false;
                } else {
                    // weightDiff === 0 - peso nao mudou
                    // IMPORTANTE: Preservar o estado original - ja estava deduzido
                    newM.needsPurchase = false;
                    logger.log(`⚖️ Peso de ${newM.color} nao mudou, mantendo como deduzido`);
                }
            } else {
                // Material NAO estava deduzido antes (precisava comprar)
                if (!newM.needsPurchase && newM.weight > 0) {
                    // Agora TEM estoque - deduzir
                    logger.log(`✅ Agora ha estoque! Deduzindo ${newM.weight}g de ${newM.color}`);
                    const success = await deductMaterialFromStock(material, newM.color, newM.weight, newM.filamentId);
                    if (success) {
                        results.deduzidos.push({ color: newM.color, weight: newM.weight });
                        newM.needsPurchase = false;
                    } else {
                        newM.needsPurchase = true;
                    }
                } else {
                    // Ainda nao tem estoque - manter como precisa comprar
                    newM.needsPurchase = true;
                    logger.log(`⚠️ ${newM.color} ainda precisa ser comprado`);
                }
            }
        }
    }

    return results;
}

// Exportar funcoes para uso global (onclick handlers)
window.toggleMultiColorMode = toggleMultiColorMode;
window.addColorEntry = addColorEntry;
window.removeColorEntry = removeColorEntry;
window.handleColorEntryChange = handleColorEntryChange;
window.handleWeightEntryChange = handleWeightEntryChange;

/**
 * Deduz ou devolve material do estoque
 * CORRIGIDO: Busca case-insensitive e remoção de cache local (listener cuida disso)
 * @param {string} material - Tipo do material
 * @param {string} color - Cor do material
 * @param {number} weightInGrams - Peso em gramas (positivo = deduzir, negativo = devolver)
 * @returns {Promise<boolean>} true se sucesso, false se falhou
 */
export async function deductMaterialFromStock(material, color, weightInGrams, filamentId = null) {
    if (!state.db || !material || !color || weightInGrams === 0) return false;

    try {
        const isReturn = weightInGrams < 0;
        const absWeightInGrams = Math.abs(weightInGrams);

        let filament;

        // Se foi fornecido um filamentId especifico, usar esse
        if (filamentId && filamentId !== 'existing') {
            filament = availableFilaments.find(f => f.id === filamentId);
            if (filament) {
                logger.log(`🎯 Usando filamento especifico: ${filament.brand} ${filament.color}`);
            }
        }

        // Se nao encontrou pelo ID, fazer busca normal
        if (!filament) {
            if (isReturn) {
                // Para devolução, buscar qualquer filamento correspondente (case-insensitive)
                filament = availableFilaments.find(f =>
                    f.type && f.color &&
                    f.type.toLowerCase() === material.toLowerCase() &&
                    f.color.toLowerCase() === color.toLowerCase()
                );
            } else {
                // Para dedução, buscar o que tem mais estoque (já é case-insensitive)
                filament = findBestFilament(material, color);
            }
        }

        if (!filament) {
            logger.warn('⚠️ Filamento não encontrado no estoque:', { material, color, filamentId });
            // Para devolução, se não encontrar, não é erro crítico
            if (isReturn) {
                logger.warn('↩️ Devolução ignorada - filamento não existe mais no sistema');
                return true; // Retorna true para não bloquear o fluxo
            }
            return false;
        }

        // Converter gramas para kg
        const weightInKg = absWeightInGrams / 1000;

        // Usar Firestore Transaction para evitar race condition
        const filamentRef = state.db.collection('filaments').doc(filament.id);

        await state.db.runTransaction(async (transaction) => {
            const doc = await transaction.get(filamentRef);

            if (!doc.exists) {
                if (isReturn) {
                    logger.warn('↩️ Devolução ignorada - documento não existe mais');
                    return; // Não é erro para devolução
                }
                throw new Error('Filamento não encontrado no estoque');
            }

            const currentWeight = doc.data().weight || 0;

            // Calcular novo peso (deduzir ou adicionar)
            const newWeight = isReturn
                ? currentWeight + weightInKg  // Devolver ao estoque
                : Math.max(0, currentWeight - weightInKg);  // Deduzir do estoque (nunca negativo)

            // Atualizar dentro da transaction
            transaction.update(filamentRef, {
                weight: newWeight,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            logger.log(`📊 Transação: ${currentWeight.toFixed(3)}kg → ${newWeight.toFixed(3)}kg`);
        });

        const action = isReturn ? 'devolvidos ao' : 'deduzidos do';
        const symbol = isReturn ? '+' : '-';
        logger.log(`✅ Estoque atualizado: ${symbol}${absWeightInGrams}g de ${material} ${color} ${action} estoque`);
        showToast(`Estoque: ${symbol}${absWeightInGrams}g ${material} ${color}`, 'info');

        // REMOVIDO: Cache local não precisa mais ser atualizado manualmente
        // O listener onSnapshot cuida disso automaticamente

        return true;

    } catch (error) {
        logger.error('❌ Erro ao atualizar material do estoque:', error);
        showToast('⚠️ Erro ao atualizar estoque', 'warning');
        return false;
    }
}

/**
 * Verifica se há estoque suficiente
 * @returns {object} { hasStock: boolean, available: number, needed: number, filament: object }
 */
export function checkStockAvailability(material, color, weightInGrams) {
    if (!material || !color || !weightInGrams) {
        return { hasStock: true, available: 0, needed: 0, filament: null };
    }

    // Encontrar o MELHOR filamento (maior estoque) entre todas as marcas
    const filament = findBestFilament(material, color);

    if (!filament) {
        return { hasStock: false, available: 0, needed: weightInGrams, filament: null, notFound: true };
    }

    const weightInKg = weightInGrams / 1000;
    const availableGrams = Math.floor(filament.weight * 1000);

    if (filament.weight < weightInKg) {
        return { hasStock: false, available: availableGrams, needed: weightInGrams, filament };
    }

    return { hasStock: true, available: availableGrams, needed: weightInGrams, filament };
}

export function startServicesListener() {
    if (!state.db) return logger.error('Firestore não está disponível');
    
    state.servicesListener?.();

    state.servicesListener = state.db.collection('services')
        .onSnapshot(snapshot => {
        state.services = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                name: data.name || '',
                client: data.client || '',
                clientCPF: data.clientCPF || '',
                clientEmail: data.clientEmail || '',
                clientPhone: data.clientPhone || '',
                description: data.description || '',
                material: data.material || '',
                color: data.color || '',
                priority: data.priority || 'media',
                startDate: data.startDate || '',
                dueDate: data.dueDate || '',
                dateUndefined: data.dateUndefined || false,
                value: data.value || '',
                weight: data.weight || '',
                observations: data.observations || '',
                deliveryMethod: data.deliveryMethod || '',
                status: data.status || 'pendente',
                needsMaterialPurchase: data.needsMaterialPurchase || false,
                // Campos multi-cor
                isMultiColor: data.isMultiColor || false,
                materials: data.materials || [],
                serviceType: data.serviceType || 'impressao',
                files: data.files || [],
                fileUrl: data.fileUrl || '',
                fileName: data.fileName || '',
                fileSize: data.fileSize || '',
                fileUploadedAt: data.fileUploadedAt || '',
                imageUrl: data.imageUrl || '',
                images: data.images || [],
                imageUploadedAt: data.imageUploadedAt || '',
                instagramPhoto: data.instagramPhoto || '',
                packagedPhotos: data.packagedPhotos || [],
                trackingCode: data.trackingCode || '',
                deliveryAddress: data.deliveryAddress || {},
                pickupInfo: data.pickupInfo || {},
                orderCode: data.orderCode || '',
                serviceId: data.serviceId || '',
                fileInDrive: data.fileInDrive || false,
                createdAt: data.createdAt || '',
                createdBy: data.createdBy || '',
                updatedAt: data.updatedAt || '',
                updatedBy: data.updatedBy || '',
                productionStartedAt: data.productionStartedAt || '',
                completedAt: data.completedAt || '',
                readyAt: data.readyAt || '',
                deliveredAt: data.deliveredAt || '',
                postedAt: data.postedAt || '',
                lastStatusChange: data.lastStatusChange || ''
            };
        }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        updateStats();
        renderServices();
    }, error => {
        logger.error('Erro ao carregar serviços:', error);
        showToast(error.code === 'permission-denied' ? 'Sem permissão para acessar serviços' : 'Erro ao carregar serviços', 'error');
    });
}

export async function saveService(event) {
    event.preventDefault();

    if (!state.isAuthorized || !state.db || !state.currentUser)
        return showToast(!state.isAuthorized ? 'Sem permissão' : 'Sistema não está pronto', 'error');

    // Determinar tipo de serviço primeiro
    const serviceType = state.currentServiceType || (state.editingServiceId ?
        state.services.find(s => s.id === state.editingServiceId)?.serviceType : null) || 'impressao';

    // Validar deliveryMethod apenas para serviços de impressão
    const deliveryMethod = document.getElementById('deliveryMethod')?.value;
    if (serviceType === 'impressao' && !deliveryMethod) {
        return showToast('Selecione um método de entrega', 'error');
    }
    
    const dateUndefined = document.getElementById('dateUndefined');
    const dueDateInput = document.getElementById('dueDate');
    
    const getFieldValue = (elementId, isNumeric = false) => {
        const element = document.getElementById(elementId);
        if (!element) return '';
        const value = element.value.trim();

        if (isNumeric) {
            const parsed = parseFloat(value);
            return isNaN(parsed) || parsed === 0 ? '' : parsed;
        }

        return value;
    };

    const service = {
        name: getFieldValue('serviceName'),
        client: getFieldValue('clientName'),
        clientCPF: getFieldValue('clientCPF'),
        clientEmail: getFieldValue('clientEmail'),
        clientPhone: getFieldValue('clientPhone'),
        description: getFieldValue('serviceDescription'),
        priority: document.getElementById('servicePriority')?.value,
        startDate: document.getElementById('startDate')?.value,
        dueDate: dateUndefined?.checked ? '' : (dueDateInput?.value || ''),
        dateUndefined: dateUndefined?.checked || false,
        value: getFieldValue('serviceValue', true),
        observations: getFieldValue('serviceObservations'),
        status: document.getElementById('serviceStatus')?.value,
        fileInDrive: document.getElementById('fileInDrive')?.checked || false,
        serviceType: serviceType, // Novo campo
        updatedAt: new Date().toISOString(),
        updatedBy: state.currentUser.email
    };

    // Campos específicos de impressão (não aplicam para modelagem)
    if (serviceType === 'impressao') {
        service.material = document.getElementById('serviceMaterial')?.value;
        service.color = getFieldValue('serviceColor');
        service.weight = getFieldValue('serviceWeight', true);
        service.deliveryMethod = deliveryMethod;

        // ===========================
        // DETECÇÃO DE MODO MULTI-COR
        // ===========================
        const isMultiColorCheckbox = document.getElementById('isMultiColor');
        const isMultiColor = isMultiColorCheckbox?.checked || false;

        if (isMultiColor) {
            const multiColorData = collectMultiColorData();

            if (multiColorData.materials.length === 0) {
                return showToast('Adicione pelo menos uma cor ao serviço multi-cor', 'error');
            }

            // Sobrescrever campos single-color com dados multi-cor
            service.isMultiColor = true;
            service.materials = multiColorData.materials;
            service.weight = multiColorData.totalWeight;
            service.color = multiColorData.materials.map(m => m.color).join(' + ');

            logger.log('🎨 Modo Multi-Cor ativado:', {
                cores: multiColorData.materials.length,
                pesoTotal: multiColorData.totalWeight,
                needsMaterialPurchase: multiColorData.needsMaterialPurchase
            });
        } else {
            // Garantir que campos multi-cor sejam limpos em modo single
            service.isMultiColor = false;
            service.materials = [];
        }
    } else {
        // Modelagem não tem entrega física
        service.deliveryMethod = 'digital';
        service.isMultiColor = false;
        service.materials = [];
    }
    
    if (state.editingServiceId) {
        const currentService = state.services.find(s => s.id === state.editingServiceId);
        
        if (deliveryMethod === 'sedex') {
            const trackingCodeInput = document.getElementById('editTrackingCode');
            if (trackingCodeInput) {
                service.trackingCode = trackingCodeInput.value.trim().toUpperCase();
            }
        } else {
            if (currentService && currentService.trackingCode) {
                service.trackingCode = '';
            }
        }
        
        if (currentService) {
            if (state.selectedFiles.length === 0 && currentService.files && currentService.files.length > 0) {
                service.files = currentService.files;
            }
            if (state.selectedFiles.length === 0 && !currentService.files && currentService.fileUrl) {
                service.fileUrl = currentService.fileUrl;
                service.fileName = currentService.fileName || '';
                service.fileSize = currentService.fileSize || '';
                service.fileUploadedAt = currentService.fileUploadedAt || '';
            }
            
            if (state.selectedImages.length === 0 && currentService.images && currentService.images.length > 0) {
                service.images = currentService.images;
                service.imageUploadedAt = currentService.imageUploadedAt || '';
            }
            if (state.selectedImages.length === 0 && currentService.imageUrl) {
                service.imageUrl = currentService.imageUrl;
            }
            
            if (currentService.instagramPhoto) {
                service.instagramPhoto = currentService.instagramPhoto;
            }
            
            if (currentService.packagedPhotos && currentService.packagedPhotos.length > 0) {
                service.packagedPhotos = currentService.packagedPhotos;
            }
            
            service.createdAt = currentService.createdAt;
            service.createdBy = currentService.createdBy;
            // Permitir edição do código do pedido
            const orderCodeInput = document.getElementById('orderCodeInput');
            const editedOrderCode = orderCodeInput?.value?.trim().toUpperCase();
            service.orderCode = editedOrderCode || currentService.orderCode;
            service.serviceId = currentService.serviceId;
            
            if (currentService.productionStartedAt) service.productionStartedAt = currentService.productionStartedAt;
            if (currentService.completedAt) service.completedAt = currentService.completedAt;
            if (currentService.readyAt) service.readyAt = currentService.readyAt;
            if (currentService.deliveredAt) service.deliveredAt = currentService.deliveredAt;
            if (currentService.postedAt) service.postedAt = currentService.postedAt;
        }
    }
    
    if (state.editingServiceId) {
        const currentService = state.services.find(s => s.id === state.editingServiceId);
        if (currentService && currentService.trackingCode && currentService.deliveryMethod === 'sedex' && 
            (currentService.status === 'retirada' || currentService.status === 'entregue')) {
            
            if (deliveryMethod !== 'sedex') {
                showToast('ERRO: Pedido já foi postado nos Correios! Não é possível alterar o método de entrega.', 'error');
                const deliverySelect = document.getElementById('deliveryMethod');
                deliverySelect.value = 'sedex';
                deliverySelect.dispatchEvent(new Event('change', { bubbles: true }));
                window.toggleDeliveryFields();
                return;
            }
        }
    }
    
    if (!service.dateUndefined && service.dueDate && parseDateBrazil(service.dueDate) < parseDateBrazil(service.startDate))
        return showToast('Data de entrega não pode ser anterior à data de início', 'error');

    // ===========================
    // LÓGICA COMPLETA DE INTEGRAÇÃO COM ESTOQUE
    // (APENAS PARA SERVIÇOS DE IMPRESSÃO)
    // ===========================
    let needsMaterialPurchase = false;
    let materialToDeduct = 0;
    let stockInfo = null;

    // Pular lógica de estoque para serviços de modelagem
    if (serviceType === 'modelagem') {
        needsMaterialPurchase = false;
        materialToDeduct = 0;
    } else if (service.isMultiColor && service.materials && service.materials.length > 0) {
        // ========================================
        // LÓGICA DE ESTOQUE PARA MULTI-COR
        // ========================================
        logger.log('🎨 Processando estoque multi-cor...');

        if (state.editingServiceId) {
            // EDITANDO serviço existente
            const oldService = state.services.find(s => s.id === state.editingServiceId);

            if (oldService) {
                if (oldService.isMultiColor && oldService.materials) {
                    // Multi-cor → Multi-cor: usar processMultiColorEdit
                    logger.log('🔄 Editando multi-cor → multi-cor');
                    const editResults = await processMultiColorEdit(oldService, service.materials, service.material);

                    logger.log('📊 Resultado da edição multi-cor:', editResults);

                    // Recalcular needsMaterialPurchase com base nos materiais atualizados
                    needsMaterialPurchase = service.materials.some(m => m.needsPurchase);
                    materialToDeduct = 0; // processMultiColorEdit já fez as deduções

                } else {
                    // Single-cor → Multi-cor: devolver cor antiga (se deduzida), processar novas
                    logger.log('🔄 Editando single-cor → multi-cor');

                    const wasDeducted = oldService.needsMaterialPurchase === false;
                    if (wasDeducted && oldService.material && oldService.color && oldService.weight > 0) {
                        logger.log(`↩️ Devolvendo ${oldService.weight}g de ${oldService.color} ao estoque (era single-cor)`);
                        await deductMaterialFromStock(oldService.material, oldService.color, -oldService.weight);
                    }

                    // Deduzir novas cores que têm estoque
                    for (const m of service.materials) {
                        if (!m.needsPurchase && m.weight > 0) {
                            logger.log(`🔽 Deduzindo ${m.weight}g de ${m.color} (${m.brand || 'sem marca'})`);
                            await deductMaterialFromStock(service.material, m.color, m.weight, m.filamentId);
                        }
                    }

                    needsMaterialPurchase = service.materials.some(m => m.needsPurchase);
                    materialToDeduct = 0;
                }
            }
        } else {
            // CRIANDO novo serviço multi-cor
            logger.log('🆕 Criando novo serviço multi-cor');

            for (const m of service.materials) {
                if (!m.needsPurchase && m.weight > 0) {
                    logger.log(`🔽 Deduzindo ${m.weight}g de ${m.color} (${m.brand || 'sem marca'})`);
                    await deductMaterialFromStock(service.material, m.color, m.weight, m.filamentId);
                }
            }

            needsMaterialPurchase = service.materials.some(m => m.needsPurchase);
            materialToDeduct = 0; // Já processado acima
        }

        if (needsMaterialPurchase) {
            const coresSemEstoque = service.materials.filter(m => m.needsPurchase).map(m => m.color);
            showToast(`⚠️ Cores sem estoque suficiente: ${coresSemEstoque.join(', ')}`, 'warning');
        }

    } else {
        // ========================================
        // LÓGICA DE ESTOQUE PARA SINGLE-COR
        // ========================================

    if (state.editingServiceId) {
        // ========================================
        // EDITANDO SERVIÇO EXISTENTE (Single-Cor)
        // ========================================
        const oldService = state.services.find(s => s.id === state.editingServiceId);

        if (!oldService) {
            logger.error('❌ Serviço não encontrado para edição');
            return;
        }

        // Verificar transição de multi-cor para single-cor
        if (oldService.isMultiColor && oldService.materials && oldService.materials.length > 0) {
            logger.log('🔄 Editando multi-cor → single-cor');

            // Devolver todas as cores que estavam deduzidas
            for (const oldM of oldService.materials) {
                if (!oldM.needsPurchase && oldM.weight > 0) {
                    logger.log(`↩️ Devolvendo ${oldM.weight}g de ${oldM.color} ao estoque`);
                    await deductMaterialFromStock(oldService.material, oldM.color, -oldM.weight);
                }
            }

            // Agora processar como novo single-cor
            if (service.material && service.color && service.weight) {
                stockInfo = checkStockAvailability(service.material, service.color, service.weight);

                if (stockInfo.hasStock) {
                    materialToDeduct = service.weight;
                    needsMaterialPurchase = false;
                    logger.log(`✅ TEM estoque para deduzir ${service.weight}g`);
                } else {
                    needsMaterialPurchase = true;
                    const missing = stockInfo.needed - stockInfo.available;
                    logger.log(`⚠️ NÃO TEM estoque. Faltam ${missing}g`);
                    showToast(`⚠️ Estoque insuficiente! Faltam ${missing}g.`, 'warning');
                }
            }
        } else {
            // Single-cor → Single-cor (fluxo original)

        // CORRIGIDO: Normalizar valores para evitar erros de undefined/null
        const oldMaterial = (oldService.material || '').trim();
        const oldColor = (oldService.color || '').trim();
        const oldWeight = parseFloat(oldService.weight) || 0;
        const newMaterial = (service.material || '').trim();
        const newColor = (service.color || '').trim();
        const newWeight = parseFloat(service.weight) || 0;

        // CORRIGIDO: wasAlreadyDeducted só é true se o campo existir E for false
        // Serviços antigos sem o campo são tratados como "não deduzido"
        const wasAlreadyDeducted = oldService.needsMaterialPurchase === false;

        // CORRIGIDO: Verificar material com valores normalizados
        const hadMaterial = oldMaterial && oldColor && oldWeight > 0;
        const hasMaterialNow = newMaterial && newColor && newWeight > 0;

        logger.log('📊 Estado anterior:', {
            material: oldMaterial,
            color: oldColor,
            weight: oldWeight,
            wasAlreadyDeducted,
            needsMaterialPurchase: oldService.needsMaterialPurchase
        });

        if (!hadMaterial && hasMaterialNow) {
            // ========================================
            // CASO 1: ADICIONANDO MATERIAL (não tinha → agora tem)
            // ========================================
            logger.log('📦 CASO 1: Adicionando material');

            stockInfo = checkStockAvailability(newMaterial, newColor, newWeight);

            if (stockInfo.hasStock) {
                // TEM estoque suficiente para a quantidade total
                materialToDeduct = newWeight;
                needsMaterialPurchase = false;
                logger.log(`✅ TEM estoque para deduzir ${newWeight}g`);
            } else {
                // NÃO TEM estoque suficiente
                needsMaterialPurchase = true;
                const missing = stockInfo.needed - stockInfo.available;
                logger.log(`⚠️ NÃO TEM estoque. Faltam ${missing}g`);

                if (stockInfo.notFound) {
                    showToast(`⚠️ Material ${newMaterial} ${newColor} não encontrado no estoque.`, 'warning');
                } else {
                    showToast(`⚠️ Estoque insuficiente! Faltam ${missing}g de ${newMaterial} ${newColor}.`, 'warning');
                }
            }

        } else if (hadMaterial && hasMaterialNow) {
            // ========================================
            // CASO 2: MATERIAL JÁ EXISTIA E CONTINUA
            // ========================================
            // CORRIGIDO: Comparação case-insensitive para material E cor
            const materialChanged = oldMaterial.toLowerCase() !== newMaterial.toLowerCase() ||
                                   oldColor.toLowerCase() !== newColor.toLowerCase();

            if (materialChanged) {
                // ========================================
                // CASO 2A: MUDOU TIPO/COR DO MATERIAL
                // ========================================
                logger.log(`🔄 CASO 2A: Material mudou de ${oldMaterial} ${oldColor} → ${newMaterial} ${newColor}`);

                if (wasAlreadyDeducted) {
                    // Material antigo JÁ estava deduzido do estoque - devolver
                    logger.log(`↩️ Devolvendo ${oldWeight}g de ${oldMaterial} ${oldColor} ao estoque`);
                    await deductMaterialFromStock(oldMaterial, oldColor, -oldWeight);
                }

                // Tentar deduzir novo material
                stockInfo = checkStockAvailability(newMaterial, newColor, newWeight);

                if (stockInfo.hasStock) {
                    materialToDeduct = newWeight;
                    needsMaterialPurchase = false;
                    logger.log(`✅ TEM estoque do novo material para deduzir ${newWeight}g`);
                } else {
                    needsMaterialPurchase = true;
                    const missing = stockInfo.needed - stockInfo.available;
                    logger.log(`⚠️ NÃO TEM estoque do novo material. Faltam ${missing}g`);
                    showToast(`⚠️ Estoque insuficiente do novo material! Faltam ${missing}g.`, 'warning');
                }

            } else {
                // ========================================
                // CASO 2B: APENAS O PESO MUDOU (mesmo material/cor)
                // ========================================
                const weightDifference = newWeight - oldWeight;

                if (weightDifference === 0) {
                    // Peso não mudou, manter estado atual
                    needsMaterialPurchase = oldService.needsMaterialPurchase || false;
                    logger.log('⚖️ CASO 2B: Peso não mudou');

                } else if (wasAlreadyDeducted) {
                    // ========================================
                    // CASO 2B.1: Material JÁ estava DEDUZIDO
                    // ========================================
                    logger.log(`⚖️ CASO 2B.1: Peso mudou de ${oldWeight}g → ${newWeight}g (diferença: ${weightDifference}g)`);
                    logger.log('✓ Material JÁ estava deduzido do estoque');

                    if (weightDifference > 0) {
                        // AUMENTOU a quantidade - deduzir a DIFERENÇA
                        logger.log(`📈 Aumentou ${weightDifference}g - verificando estoque para a diferença`);

                        stockInfo = checkStockAvailability(newMaterial, newColor, weightDifference);

                        if (stockInfo.hasStock) {
                            // TEM estoque para a diferença
                            materialToDeduct = weightDifference;
                            needsMaterialPurchase = false;
                            logger.log(`✅ TEM estoque para deduzir diferença de ${weightDifference}g`);
                        } else {
                            // NÃO TEM estoque para a diferença
                            // Devolver TUDO que já tinha sido deduzido
                            logger.log(`❌ NÃO TEM estoque para diferença. Devolvendo ${oldWeight}g ao estoque`);
                            await deductMaterialFromStock(newMaterial, newColor, -oldWeight);
                            needsMaterialPurchase = true;
                            const missing = stockInfo.needed - stockInfo.available;
                            showToast(`⚠️ Estoque insuficiente para o aumento! Faltam ${missing}g. Material devolvido ao estoque.`, 'warning');
                        }
                    } else {
                        // DIMINUIU a quantidade - DEVOLVER a diferença
                        const amountToReturn = Math.abs(weightDifference);
                        logger.log(`📉 Diminuiu ${amountToReturn}g - devolvendo diferença ao estoque`);
                        await deductMaterialFromStock(newMaterial, newColor, weightDifference); // negativo = devolução
                        needsMaterialPurchase = false;
                    }

                } else {
                    // ========================================
                    // CASO 2B.2: Material NÃO estava deduzido (precisava comprar)
                    // ========================================
                    logger.log(`⚖️ CASO 2B.2: Peso mudou de ${oldWeight}g → ${newWeight}g`);
                    logger.log('⚠️ Material NÃO estava deduzido (estava marcado para comprar)');
                    logger.log('🔍 Recalculando com a nova quantidade...');

                    // Recalcular com a QUANTIDADE TOTAL NOVA
                    stockInfo = checkStockAvailability(newMaterial, newColor, newWeight);

                    if (stockInfo.hasStock) {
                        // Agora TEM estoque suficiente para a quantidade total
                        materialToDeduct = newWeight;
                        needsMaterialPurchase = false;
                        logger.log(`✅ Agora TEM estoque! Deduzindo ${newWeight}g`);
                        showToast(`✅ Agora há estoque suficiente! Material será deduzido.`, 'success');
                    } else {
                        // Ainda NÃO TEM estoque suficiente
                        needsMaterialPurchase = true;
                        const missing = stockInfo.needed - stockInfo.available;
                        logger.log(`⚠️ Ainda NÃO TEM estoque. Faltam ${missing}g`);
                    }
                }
            }

        } else if (hadMaterial && !hasMaterialNow) {
            // ========================================
            // CASO 3: REMOVENDO MATERIAL (tinha → não tem mais)
            // ========================================
            logger.log('🔙 CASO 3: Removendo material');

            if (wasAlreadyDeducted) {
                // Material estava deduzido - DEVOLVER ao estoque
                logger.log(`↩️ Devolvendo ${oldWeight}g de ${oldMaterial} ${oldColor} ao estoque`);
                await deductMaterialFromStock(oldMaterial, oldColor, -oldWeight);
            } else {
                logger.log('⚠️ Material não estava deduzido, nada a devolver');
            }

            needsMaterialPurchase = false;

        } else {
            // ========================================
            // CASO 4: SEM MATERIAL (antes e agora)
            // ========================================
            logger.log('⭕ CASO 4: Sem material (antes e agora)');
            needsMaterialPurchase = false;
        }

        } // Fecha else single-cor → single-cor

    } else {
        // ========================================
        // CRIANDO NOVO SERVIÇO (Single-Cor)
        // ========================================
        logger.log('🆕 CRIANDO NOVO SERVIÇO');

        if (service.material && service.color && service.weight) {
            stockInfo = checkStockAvailability(service.material, service.color, service.weight);

            if (stockInfo.hasStock) {
                materialToDeduct = service.weight;
                needsMaterialPurchase = false;
                logger.log(`✅ TEM estoque para deduzir ${service.weight}g`);
            } else {
                needsMaterialPurchase = true;
                const missing = stockInfo.needed - stockInfo.available;
                logger.log(`⚠️ NÃO TEM estoque. Faltam ${missing}g`);

                if (stockInfo.notFound) {
                    showToast(`⚠️ Material ${service.material} ${service.color} não encontrado no estoque.`, 'warning');
                } else {
                    showToast(`⚠️ Estoque insuficiente! Faltam ${missing}g de ${service.material} ${service.color}.`, 'warning');
                }
            }
        }
    }
    } // Fecha o else da lógica de estoque (apenas para impressão)

    // Aplicar flag ao serviço
    service.needsMaterialPurchase = needsMaterialPurchase;
    logger.log('🏁 Resultado final:', {
        needsMaterialPurchase,
        materialToDeduct,
        willDeduct: materialToDeduct > 0
    });

    // Validações de entrega apenas para serviços de impressão
    if (serviceType === 'impressao' && deliveryMethod === 'retirada') {
        const pickupName = document.getElementById('pickupName')?.value.trim();
        const pickupWhatsapp = document.getElementById('pickupWhatsapp')?.value.trim();
        if (!pickupName || !pickupWhatsapp) return showToast('Preencha todos os campos de retirada', 'error');
        service.pickupInfo = { name: pickupName, whatsapp: pickupWhatsapp };
    } else if (serviceType === 'impressao' && deliveryMethod === 'sedex') {
        const fields = ['fullName', 'cpfCnpj', 'email', 'telefone', 'cep', 'estado', 'cidade', 'bairro', 'rua', 'numero'];
        const addr = {};
        
        fields.forEach(field => {
            addr[field] = document.getElementById(field)?.value.trim() || '';
        });
        addr.complemento = document.getElementById('complemento')?.value.trim() || '';
        
        if (fields.some(f => !addr[f])) return showToast('Preencha todos os campos obrigatórios de entrega', 'error');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr.email)) return showToast('E-mail inválido', 'error');
        
        service.deliveryAddress = addr;
    }
    
    try {
        let serviceDocId = state.editingServiceId;

        if (state.editingServiceId) {
            // Preservar userId se já existe, caso contrário adicionar
            const updateData = {
                ...service,
                updatedAt: new Date().toISOString(),
                updatedBy: state.currentUser.email
            };

            // Não sobrescrever userId se já existe
            if (!updateData.userId) {
                updateData.userId = COMPANY_USER_ID;
                updateData.companyId = COMPANY_USER_ID;
            }

            await state.db.collection('services').doc(state.editingServiceId).update(updateData);

            // DEDUZIR MATERIAL DO ESTOQUE (se aplicável)
            // A lógica acima já calculou materialToDeduct corretamente
            if (materialToDeduct > 0) {
                logger.log(`🔽 Deduzindo ${materialToDeduct}g de ${service.material} ${service.color} do estoque`);
                await deductMaterialFromStock(service.material, service.color, materialToDeduct);
            }

            if (needsMaterialPurchase) {
                showToast('⚠️ Serviço salvo! Lembre-se de comprar o material necessário.', 'warning');
            } else {
                showToast('Serviço atualizado com sucesso!', 'success');
            }
        } else {
            // Obter código do pedido do input (customizado ou gerado)
            const orderCodeInput = document.getElementById('orderCodeInput');
            const customOrderCode = orderCodeInput?.value?.trim().toUpperCase() || generateOrderCode();

            Object.assign(service, {
                createdAt: new Date().toISOString(),
                createdBy: state.currentUser.email,
                userId: COMPANY_USER_ID,
                companyId: COMPANY_USER_ID,
                orderCode: customOrderCode,
                serviceId: 'SRV-' + Date.now(),
                files: [],
                fileUrl: '',
                fileName: '',
                fileSize: '',
                fileUploadedAt: '',
                imageUrl: '',
                images: [],
                imageUploadedAt: '',
                instagramPhoto: '',
                packagedPhotos: [],
                trackingCode: ''
            });

            const docRef = await state.db.collection('services').add(service);
            serviceDocId = docRef.id;

            // DEDUZIR MATERIAL DO ESTOQUE (se aplicável)
            // A lógica acima já calculou materialToDeduct corretamente
            if (materialToDeduct > 0) {
                logger.log(`🔽 Deduzindo ${materialToDeduct}g de ${service.material} ${service.color} do estoque`);
                await deductMaterialFromStock(service.material, service.color, materialToDeduct);
            }

            // Destacar o código do pedido criado
            const orderCodeInputEl = document.getElementById('orderCodeInput');
            if (orderCodeInputEl) {
                orderCodeInputEl.style.background = 'linear-gradient(135deg, rgba(0, 255, 136, 0.2), rgba(0, 212, 255, 0.2))';
                orderCodeInputEl.style.borderColor = 'var(--neon-green)';
            }
            showToast(`Serviço criado! Código: ${service.orderCode}`, 'success');

            const sendWhatsapp = document.getElementById('sendWhatsappOnCreate')?.checked || false;
            const sendEmail = document.getElementById('sendEmailOnCreate')?.checked || false;
            
            if (service.clientPhone && sendWhatsapp) {
                const dueDateText = service.dateUndefined ? 'A definir' : formatDateBrazil(service.dueDate);
                const prazoLabel = service.deliveryMethod === 'sedex' ? 'Prazo de postagem' : 'Prazo de entrega';
                const message = `Olá, ${service.client}!\nSeu pedido foi registrado com sucesso.\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}\n» ${prazoLabel}: ${dueDateText}\n» Entrega: ${getDeliveryMethodName(service.deliveryMethod)}\n\nAcompanhe seu pedido em:\nhttps://imaginatech.com.br/acompanhar-pedido/?codigo=${service.orderCode}`;
                sendWhatsAppMessage(service.clientPhone, message);
            }
            
            if (service.clientEmail && sendEmail) {
                await sendEmailNotification(service);
            }

            // ===========================
            // 🔔 PONTO DE INTEGRAÇÃO: PUSH NOTIFICATIONS
            // ===========================
            // INSTRUÇÕES FUTURAS: Adicionar notificação push para admins aqui
            // Ver: /servicos/push-system/integration-points.md (PONTO 2)
            // ===========================
            // if (typeof window.sendPushToAdmins === 'function') {
            //     await window.sendPushToAdmins(
            //         'Novo Serviço Criado',
            //         `${service.client} - ${service.name} (#${service.orderCode})`,
            //         { serviceId: docRef.id, filterStatus: 'pendente', type: 'new_service' }
            //     );
            // }
            // ===========================
        }
        
        if (service.client) {
            const clientData = {
                name: service.client,
                cpf: service.clientCPF,
                email: service.clientEmail,
                phone: service.clientPhone,
                orderCode: service.orderCode
            };

            if (service.deliveryMethod === 'sedex' && service.deliveryAddress) {
                clientData.address = service.deliveryAddress;
            }

            await saveClientToFirestore(clientData);
        }
        
        // Upload de arquivos
        if (state.selectedFiles.length > 0 && serviceDocId) {
            showToast(`Preparando upload de ${state.selectedFiles.length} arquivo(s)...`, 'info');
            
            const uploadResults = await uploadMultipleFiles(state.selectedFiles, serviceDocId, 'files');
            const currentService = state.services.find(s => s.id === serviceDocId);
            const existingFiles = (state.editingServiceId && currentService?.files) ? currentService.files : [];
            
            const newFileUrls = uploadResults.map(fileData => ({
                url: fileData.url,
                name: fileData.name,
                size: fileData.size,
                uploadedAt: fileData.uploadedAt
            }));
            
            if (newFileUrls.length > 0) {
                const allFiles = [...existingFiles, ...newFileUrls];
                await state.db.collection('services').doc(serviceDocId).update({
                    files: allFiles,
                    fileUploadedAt: new Date().toISOString()
                });
                showToast(`✅ ${newFileUrls.length} ${newFileUrls.length > 1 ? 'arquivos enviados' : 'arquivo enviado'}!`, 'success');
            }
        }
        
        // Upload de imagens
        if (state.selectedImages.length > 0 && serviceDocId) {
            showToast(`Preparando upload de ${state.selectedImages.length} imagem(ns)...`, 'info');
            
            const uploadResults = await uploadMultipleFiles(state.selectedImages, serviceDocId, 'images');
            const currentService = state.services.find(s => s.id === serviceDocId);
            const existingImages = (state.editingServiceId && currentService?.images) ? currentService.images : [];
            
            const newImageUrls = uploadResults.map(imageData => ({
                url: imageData.url,
                name: imageData.name,
                uploadedAt: imageData.uploadedAt
            }));
            
            if (newImageUrls.length > 0) {
                const allImages = [...existingImages, ...newImageUrls];
                await state.db.collection('services').doc(serviceDocId).update({
                    images: allImages,
                    imageUploadedAt: new Date().toISOString()
                });
                showToast(`✅ ${newImageUrls.length} ${newImageUrls.length > 1 ? 'imagens enviadas' : 'imagem enviada'}!`, 'success');
            }
        }
        
        window.closeModal();
    } catch (error) {
        logger.error('Erro ao salvar:', error);
        showToast('Erro ao salvar serviço', 'error');
    }
}

export async function deleteService(serviceId) {
    if (!state.isAuthorized) return showToast('Sem permissão', 'error');
    
    const service = state.services.find(s => s.id === serviceId);
    if (!service || !confirm(`Excluir o serviço "${service.name}"?\n\nTodos os arquivos e imagens serão deletados permanentemente.`)) return;
    
    try {
        // Usar Set para evitar URLs duplicadas (mesmo arquivo em múltiplos campos)
        const filesToDeleteSet = new Set();

        if (service.files && service.files.length > 0) {
            service.files.forEach(file => file.url && filesToDeleteSet.add(file.url));
        }
        if (service.fileUrl) filesToDeleteSet.add(service.fileUrl);

        if (service.images && service.images.length > 0) {
            service.images.forEach(img => img.url && filesToDeleteSet.add(img.url));
        }
        if (service.imageUrl) filesToDeleteSet.add(service.imageUrl);
        if (service.instagramPhoto) filesToDeleteSet.add(service.instagramPhoto);

        if (service.packagedPhotos && service.packagedPhotos.length > 0) {
            service.packagedPhotos.forEach(photo => photo.url && filesToDeleteSet.add(photo.url));
        }

        const filesToDelete = [...filesToDeleteSet];
        
        if (filesToDelete.length > 0) {
            showToast('Deletando arquivos...', 'info');

            let deletionErrors = [];

            for (const fileUrl of filesToDelete) {
                try {
                    const fileRef = state.storage.refFromURL(fileUrl);
                    await fileRef.delete();
                } catch (error) {
                    // Se o arquivo já não existe, ignorar (resultado desejado)
                    if (error.code === 'storage/object-not-found') {
                        logger.log('Arquivo já não existe (ignorado):', fileUrl);
                    } else {
                        logger.error('Erro ao deletar arquivo:', fileUrl, error);
                        deletionErrors.push(fileUrl);
                    }
                }
            }

            // Apenas erros reais bloqueiam a exclusão (não "object-not-found")
            if (deletionErrors.length > 0) {
                showToast(`⚠️ ${deletionErrors.length} arquivo(s) não foi(foram) deletado(s) do Storage. Tente novamente.`, 'warning');
                logger.error('Arquivos que falharam:', deletionErrors);
                return;
            }
        }

        // Devolver material ao estoque antes de excluir (se foi deduzido)
        // CORRIGIDO: Verificar se needsMaterialPurchase é EXPLICITAMENTE false
        // Serviços antigos sem este campo (undefined) não devem tentar devolver

        if (service.isMultiColor && service.materials && service.materials.length > 0) {
            // ========================================
            // DEVOLUÇÃO MULTI-COR
            // ========================================
            logger.log('🎨 Devolvendo materiais multi-cor ao estoque...');

            for (const m of service.materials) {
                // Só devolve se foi deduzido (needsPurchase === false)
                if (!m.needsPurchase && m.weight > 0) {
                    logger.log(`↩️ Devolvendo ${m.weight}g de ${m.color} (${m.brand || 'sem marca'}) ao estoque`);
                    await deductMaterialFromStock(service.material, m.color, -m.weight, m.filamentId);
                }
            }
        } else {
            // ========================================
            // DEVOLUÇÃO SINGLE-COR (fluxo original)
            // ========================================
            const materialWasDeducted = service.needsMaterialPurchase === false;
            const hasMaterial = service.material && service.color && (parseFloat(service.weight) || 0) > 0;

            if (materialWasDeducted && hasMaterial) {
                const weightToReturn = parseFloat(service.weight) || 0;
                logger.log(`🔄 Devolvendo ${weightToReturn}g de ${service.material} ${service.color} ao estoque...`);
                await deductMaterialFromStock(service.material, service.color, -weightToReturn);
            }
        }

        await state.db.collection('services').doc(serviceId).delete();
        showToast('Serviço e arquivos excluídos!', 'success');
    } catch (error) {
        logger.error('Erro:', error);
        showToast('Erro ao excluir', 'error');
    }
}

// ===========================
// FILE UPLOAD
// ===========================
export async function uploadFile(file, serviceId) {
    if (!file || !state.storage) return null;
    try {
        // SEGURANCA: Sanitizar nome do arquivo antes de salvar
        const safeName = sanitizeFileName(file.name);
        const fileName = `${serviceId}_${Date.now()}_${safeName}`;
        const storageRef = state.storage.ref(`services/${serviceId}/${fileName}`);
        const snapshot = await storageRef.put(file);
        const url = await snapshot.ref.getDownloadURL();
        return { url, name: safeName, size: file.size, uploadedAt: new Date().toISOString() };
    } catch (error) {
        logger.error('Erro ao fazer upload:', error);
        
        if (error.code === 'storage/unauthorized' || error.message.includes('CORS')) {
            showToast('⚠️ Erro de permissão no Firebase Storage. Configure CORS no console do Firebase.', 'error');
            logger.error('SOLUÇÃO: Configure CORS no Firebase Storage para o domínio imaginatech.com.br');
        } else {
            showToast('Erro ao fazer upload do arquivo: ' + error.message, 'error');
        }
        return null;
    }
}

/**
 * Upload paralelo de múltiplos arquivos com progress bar
 */
export async function uploadMultipleFiles(files, serviceId, type = 'files') {
    if (!files || files.length === 0) return [];
    const total = files.length;
    let completed = 0;
    const progressId = `progress-${type}-${Date.now()}`;
    createProgressBar(progressId, type, total);
    try {
        const uploadPromises = files.map(async (file) => {
            try {
                const result = await uploadFile(file, serviceId);
                completed++;
                updateProgressBar(progressId, completed, total);
                return result;
            } catch (error) {
                logger.error(`Erro no upload de ${file.name}:`, error);
                completed++;
                updateProgressBar(progressId, completed, total);
                return null;
            }
        });
        const results = await Promise.all(uploadPromises);
        setTimeout(() => removeProgressBar(progressId), 1000);
        return results.filter(r => r !== null);
    } catch (error) {
        logger.error('Erro no upload múltiplo:', error);
        removeProgressBar(progressId);
        throw error;
    }
}

function createProgressBar(id, type, total) {
    const typeLabels = {
        'images': 'Imagens',
        'files': 'Arquivos',
        'instagram': 'Fotos Instagram',
        'packaged': 'Fotos Embaladas'
    };
    const container = document.getElementById('toastContainer') || document.body;
    const progressDiv = document.createElement('div');
    progressDiv.id = id;
    progressDiv.className = 'upload-progress-bar';
    progressDiv.innerHTML = `
        <div class="progress-header">
            <i class="fas fa-cloud-upload-alt"></i>
            <span class="progress-label">Enviando ${typeLabels[type]} (0/${total})</span>
        </div>
        <div class="progress-track">
            <div class="progress-fill" style="width: 0%"></div>
        </div>
        <div class="progress-percentage">0%</div>
    `;
    container.appendChild(progressDiv);
}

function updateProgressBar(id, completed, total) {
    const progressDiv = document.getElementById(id);
    if (!progressDiv) return;
    const percentage = Math.round((completed / total) * 100);
    const label = progressDiv.querySelector('.progress-label');
    const fill = progressDiv.querySelector('.progress-fill');
    const percentageText = progressDiv.querySelector('.progress-percentage');
    if (label) label.textContent = label.textContent.replace(/\(\d+\/\d+\)/, `(${completed}/${total})`);
    if (fill) fill.style.width = `${percentage}%`;
    if (percentageText) percentageText.textContent = `${percentage}%`;
    if (completed === total) {
        progressDiv.classList.add('complete');
        if (fill) fill.style.background = 'var(--success-color, #10b981)';
    }
}

function removeProgressBar(id) {
    const progressDiv = document.getElementById(id);
    if (progressDiv) {
        progressDiv.style.opacity = '0';
        setTimeout(() => progressDiv.remove(), 300);
    }
}

/**
 * Remove um arquivo específico do serviço
 */
export async function removeFileFromService(serviceId, fileIndex, fileUrl) {
    if (!state.isAuthorized) return showToast('Sem permissão para remover arquivos', 'error');
    
    const service = state.services.find(s => s.id === serviceId);
    if (!service || !service.files || !service.files[fileIndex]) {
        return showToast('Arquivo não encontrado', 'error');
    }
    
    if (!confirm('Deseja realmente remover este arquivo?\n\nEsta ação não pode ser desfeita.')) return;
    
    try {
        showToast('Removendo arquivo...', 'info');
        
        try {
            const fileRef = state.storage.refFromURL(fileUrl);
            await fileRef.delete();
        } catch (storageError) {
            logger.error('Erro ao deletar do Storage:', storageError);
        }
        
        const updatedFiles = service.files.filter((_, index) => index !== fileIndex);
        
        await state.db.collection('services').doc(serviceId).update({
            files: updatedFiles,
            lastModified: new Date().toISOString()
        });
        
        showToast('Arquivo removido com sucesso!', 'success');
        
        const modal = document.getElementById('filesViewerModal');
        if (modal && modal.classList.contains('show')) {
            const { showFilesModal } = await import('./auth-ui.js');
            setTimeout(() => showFilesModal(service.name, updatedFiles, serviceId), 300);
        }
        
    } catch (error) {
        logger.error('Erro ao remover arquivo:', error);
        showToast('Erro ao remover arquivo: ' + error.message, 'error');
    }
}

/**
 * Remove uma imagem específica do serviço
 */
export async function removeImageFromService(serviceId, imageIndex, imageSource, imageUrl) {
    if (!state.isAuthorized) {
        return showToast('Sem permissão para remover imagens', 'error');
    }
    
    const service = state.services.find(s => s.id === serviceId);
    if (!service) {
        return showToast('Serviço não encontrado', 'error');
    }
    
    // Validação por fonte
    let isValid = false;
    let imageName = 'imagem';
    
    switch (imageSource) {
        case 'images':
            isValid = service.images && service.images[imageIndex];
            imageName = 'imagem';
            break;
        case 'imageUrl':
            isValid = service.imageUrl === imageUrl;
            imageName = 'imagem legado';
            break;
        case 'instagramPhoto':
            isValid = service.instagramPhoto === imageUrl;
            imageName = 'foto instagramável';
            break;
        case 'packagedPhotos':
            isValid = service.packagedPhotos && service.packagedPhotos[imageIndex];
            imageName = 'foto embalada';
            break;
        default:
            return showToast('Fonte de imagem inválida', 'error');
    }
    
    if (!isValid) {
        return showToast('Imagem não encontrada', 'error');
    }
    
    if (!confirm(`Deseja realmente remover esta ${imageName}?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }
    
    try {
        showToast('Removendo imagem...', 'info');
        
        // Deletar do Storage
        try {
            const imageRef = state.storage.refFromURL(imageUrl);
            await imageRef.delete();
        } catch (storageError) {
            logger.error('Erro ao deletar do Storage:', storageError);
        }
        
        // Atualizar Firestore
        const updates = { lastModified: new Date().toISOString() };
        
        switch (imageSource) {
            case 'images':
                const updatedImages = service.images.filter((_, index) => index !== imageIndex);
                updates.images = updatedImages;
                if (service.instagramPhoto === imageUrl) {
                    updates.instagramPhoto = firebase.firestore.FieldValue.delete();
                }
                break;
            case 'imageUrl':
                updates.imageUrl = firebase.firestore.FieldValue.delete();
                break;
            case 'instagramPhoto':
                updates.instagramPhoto = firebase.firestore.FieldValue.delete();
                break;
            case 'packagedPhotos':
                const updatedPackaged = service.packagedPhotos.filter((_, index) => index !== imageIndex);
                updates.packagedPhotos = updatedPackaged;
                break;
        }
        
        await state.db.collection('services').doc(serviceId).update(updates);
        showToast(`✅ ${imageName.charAt(0).toUpperCase() + imageName.slice(1)} removida!`, 'success');
        
        const imageModal = document.getElementById('imageViewerModal');
        if (imageModal && imageModal.classList.contains('active')) {
            window.closeImageModal();
        }
        
    } catch (error) {
        logger.error('Erro ao remover imagem:', error);
        showToast('Erro ao remover imagem: ' + error.message, 'error');
    }
}

// ===========================
// STATUS MANAGEMENT
// ===========================
export async function updateStatus(serviceId, newStatus) {
    if (!state.isAuthorized) return showToast('Sem permissão', 'error');

    const service = state.services.find(s => s.id === serviceId);
    if (!service || service.status === newStatus) return;

    const isModelagem = service.serviceType === 'modelagem';
    const statusOrder = getStatusOrderForService(service.serviceType);

    const currentIndex = statusOrder.indexOf(service.status);
    const newIndex = statusOrder.indexOf(newStatus);

    if (newIndex > currentIndex) {
        const nextAllowedStatus = statusOrder[currentIndex + 1];

        if (newStatus !== nextAllowedStatus) {
            const statusNames = isModelagem ? {
                'modelando': 'Modelando',
                'modelagem_concluida': 'Concluído'
            } : {
                'pendente': 'Pendente',
                'producao': 'Produção',
                'concluido': 'Concluído',
                'retirada': 'Processo de Entrega',
                'entregue': 'Entregue'
            };
            showToast(`❌ Você deve seguir a ordem: ${statusNames[service.status]} → ${statusNames[nextAllowedStatus]}`, 'error');
            return;
        }
    }

    // Instagram photo requirement for modelagem_concluida and concluido
    if ((newStatus === 'concluido' || newStatus === 'modelagem_concluida') && !service.instagramPhoto && (!service.images || service.images.length === 0)) {
        state.pendingStatusUpdate = { serviceId, newStatus, service, requiresInstagramPhoto: true };
        window.showStatusModalWithPhoto(service, newStatus);
        return;
    }

    // Only for impressão services - delivery-related validations
    if (!isModelagem) {
        if (newStatus === 'retirada') {
            // Se não tem foto instagramável, abre modal para bypass
            if (!service.instagramPhoto && (!service.images || service.images.length === 0)) {
                state.pendingStatusUpdate = { serviceId, newStatus, service, requiresInstagramPhoto: true, skipToBypass: true };
                window.showBypassPasswordModal();
                return;
            }

            if (!service.packagedPhotos || service.packagedPhotos.length === 0) {
                state.pendingStatusUpdate = { serviceId, newStatus, service, requiresPackagedPhoto: true };
                window.showStatusModalWithPackagedPhoto(service, newStatus);
                return;
            }
        }

        if (newStatus === 'entregue') {
            // Se não tem foto instagramável, abre modal para bypass
            if (!service.instagramPhoto && (!service.images || service.images.length === 0)) {
                state.pendingStatusUpdate = { serviceId, newStatus, service, requiresInstagramPhoto: true, skipToBypass: true };
                window.showBypassPasswordModal();
                return;
            }

            // Se não tem foto embalada, abre modal para bypass
            if (!service.packagedPhotos || service.packagedPhotos.length === 0) {
                state.pendingStatusUpdate = { serviceId, newStatus, service, requiresPackagedPhoto: true, skipToBypass: true };
                window.showBypassPasswordModal();
                return;
            }
        }

        const currentStatusIndex = statusOrder.indexOf(service.status);
        const newStatusIndex = statusOrder.indexOf(newStatus);

        if (service.trackingCode && service.deliveryMethod === 'sedex' && newStatusIndex < statusOrder.indexOf('retirada')) {
            if (!confirm(`ATENÇÃO: Este pedido já foi postado nos Correios!\nRegredir o status irá REMOVER o código de rastreio: ${service.trackingCode}\n\nDeseja continuar?`)) {
                return;
            }
        }

        if (service.deliveryMethod === 'sedex' && newStatus === 'retirada' && !service.trackingCode) {
            state.pendingStatusUpdate = { serviceId, newStatus, service };
            return window.showTrackingCodeModal();
        }
    }

    state.pendingStatusUpdate = { serviceId, newStatus, service };

    const statusMessages = isModelagem ? {
        'modelando': 'Iniciar Modelagem',
        'modelagem_concluida': 'Marcar como Concluído'
    } : {
        'pendente': 'Marcar como Pendente',
        'producao': 'Iniciar Produção',
        'concluido': 'Marcar como Concluído',
        'retirada': service.deliveryMethod === 'retirada' ? 'Pronto para Retirada' :
                   service.deliveryMethod === 'sedex' ? 'Marcar como Postado' :
                   service.deliveryMethod === 'uber' ? 'Marcar como Postado' :
                   service.deliveryMethod === 'definir' ? 'Marcar como Combinado' :
                   'Marcar Processo de Entrega',
        'entregue': 'Confirmar Entrega'
    };

    document.getElementById('statusModalMessage') &&
        (document.getElementById('statusModalMessage').textContent = `Deseja ${statusMessages[newStatus]} para o serviço "${service.name}"?`);

    const whatsappOption = document.getElementById('whatsappOption');
    if (whatsappOption) {
        const hasPhone = service.clientPhone && service.clientPhone.trim().length > 0;
        // WhatsApp disponível para modelagem_concluida e para retirada (impressão)
        if (hasPhone && (newStatus === 'retirada' || newStatus === 'modelagem_concluida')) {
            whatsappOption.style.display = 'block';
            const whatsappCheckbox = document.getElementById('sendWhatsappNotification');
            if (whatsappCheckbox) whatsappCheckbox.checked = true;
        } else {
            whatsappOption.style.display = 'none';
        }
    }

    const emailOption = document.getElementById('emailOption');
    if (emailOption) {
        const hasEmail = service.clientEmail && service.clientEmail.trim().length > 0;
        const emailStatuses = isModelagem ?
            ['modelando', 'modelagem_concluida'] :
            ['producao', 'concluido', 'retirada', 'entregue'];
        if (hasEmail && emailStatuses.includes(newStatus)) {
            emailOption.style.display = 'block';
            const emailCheckbox = document.getElementById('sendEmailNotification');
            if (emailCheckbox) emailCheckbox.checked = true;
        } else {
            emailOption.style.display = 'none';
        }
    }

    const photoField = document.getElementById('instagramPhotoField');
    if (photoField) photoField.style.display = 'none';

    document.getElementById('statusModal')?.classList.add('active');
}

export async function confirmStatusChange() {
    if (!state.pendingStatusUpdate || !state.db) return;
    
    const { serviceId, newStatus, service, requiresInstagramPhoto, requiresPackagedPhoto } = state.pendingStatusUpdate;
    const sendWhatsapp = document.getElementById('sendWhatsappNotification')?.checked || false;
    const sendEmail = document.getElementById('sendEmailNotification')?.checked || false;
    
    if (requiresPackagedPhoto) {
        if (state.pendingPackagedPhotos.length === 0) {
            window.showBypassPasswordModal();
            return;
        }
        
        const trackingInput = document.getElementById('statusTrackingCodeInput');
        let trackingCode = null;
        
        if (service.deliveryMethod === 'sedex' && !service.trackingCode) {
            if (!trackingInput || !trackingInput.value.trim()) {
                return showToast('❌ Digite o código de rastreio dos Correios', 'error');
            }
            
            trackingCode = trackingInput.value.trim().toUpperCase();
            
            if (trackingCode.length < 10) {
                return showToast('❌ Código de rastreio inválido (muito curto)', 'error');
            }
        }
        
        try {
            showToast(`Preparando upload de ${state.pendingPackagedPhotos.length} foto(s) embalada(s)...`, 'info');
            const uploadResults = await uploadMultipleFiles(state.pendingPackagedPhotos, serviceId, 'packaged');
            const newPackagedPhotos = uploadResults.map(photoData => ({ 
                url: photoData.url, 
                name: photoData.name, 
                uploadedAt: photoData.uploadedAt
            }));

            if (newPackagedPhotos.length === 0) {
                return showToast('❌ Erro ao fazer upload das fotos embaladas', 'error');
            }

            const existingPackaged = service.packagedPhotos || [];
            const allPackaged = [...existingPackaged, ...newPackagedPhotos];

            const updates = {
                packagedPhotos: allPackaged,
                status: 'retirada',
                readyAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                updatedBy: state.currentUser.email,
                lastStatusChange: new Date().toISOString()
            };
            
            if (trackingCode) {
                updates.trackingCode = trackingCode;
                updates.postedAt = new Date().toISOString();
            }

            await state.db.collection('services').doc(serviceId).update(updates);

            showToast(`✅ ${newPackagedPhotos.length} foto(s) embalada(s) anexada(s)! Status alterado para Postado.`, 'success');

            if (sendWhatsapp && service.clientPhone) {
                let message = `Olá, ${service.client}!\n\n📦 Seu pedido foi postado!\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}`;

                if (trackingCode) {
                    message += `\n» Rastreio: ${trackingCode}\n\nRastreie em:\nhttps://rastreamento.correios.com.br/app/index.php\n\nPrazo estimado: 3-7 dias úteis`;
                } else {
                    message += `\n\n${service.deliveryMethod === 'retirada' ? 'Venha buscar seu pedido!' : 'Em breve chegará até você!'}`;
                }

                message += `\n\nAcompanhe em:\nhttps://imaginatech.com.br/acompanhar-pedido/?codigo=${service.orderCode}`;

                sendWhatsAppMessage(service.clientPhone, message);
            }

            if (sendEmail && service.clientEmail) {
                await sendEmailNotification(service);
            }

            window.closeStatusModal();
            return;
        } catch (error) {
            logger.error('Erro ao confirmar fotos embaladas:', error);
            showToast('❌ Erro ao processar as fotos embaladas', 'error');
            return;
        }
    }
    
    if (requiresInstagramPhoto) {
        if (state.pendingInstagramPhotos.length === 0) {
            window.showBypassPasswordModal();
            return;
        }

        try {
            showToast(`Preparando upload de ${state.pendingInstagramPhotos.length} foto(s)...`, 'info');
            const uploadResults = await uploadMultipleFiles(state.pendingInstagramPhotos, serviceId, 'instagram');
            const newImageUrls = uploadResults.map(photoData => ({
                url: photoData.url,
                name: photoData.name,
                uploadedAt: photoData.uploadedAt,
                isInstagram: true
            }));

            if (newImageUrls.length === 0) {
                return showToast('Erro ao fazer upload das fotos.', 'error');
            }

            const existingImages = service.images || [];
            const allImages = [...existingImages, ...newImageUrls];

            const isModelagem = service.serviceType === 'modelagem';
            const finalStatus = isModelagem ? 'modelagem_concluida' : 'concluido';

            await state.db.collection('services').doc(serviceId).update({
                images: allImages,
                instagramPhoto: newImageUrls[0].url,
                status: finalStatus,
                completedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                updatedBy: state.currentUser.email,
                lastStatusChange: new Date().toISOString()
            });

            showToast(`✅ ${newImageUrls.length} foto(s) anexada(s)! Status alterado para Concluído.`, 'success');

            if (sendEmail && service.clientEmail) {
                await sendEmailNotification(service);
            }

            if (sendWhatsapp && service.clientPhone && isModelagem) {
                const trackingLink = `\n\nAcompanhe em:\nhttps://imaginatech.com.br/acompanhar-pedido/?codigo=${service.orderCode}`;
                const message = `Olá, ${service.client}!\n\n✅ Modelagem concluída!\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}\n\nSeu modelo 3D está pronto!${trackingLink}`;
                sendWhatsAppMessage(service.clientPhone, message);
            }

            window.closeStatusModal();
            return;
        } catch (error) {
            logger.error('Erro ao confirmar fotos instagramáveis:', error);
            showToast('Erro ao processar as fotos.', 'error');
            return;
        }
    }
    
    try {
        const isModelagem = service.serviceType === 'modelagem';
        const statusOrder = getStatusOrderForService(service.serviceType);

        const updates = {
            status: newStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: state.currentUser.email,
            lastStatusChange: new Date().toISOString()
        };

        const currentStatusIndex = statusOrder.indexOf(service.status);
        const newStatusIndex = statusOrder.indexOf(newStatus);

        if (newStatusIndex > currentStatusIndex) {
            let timestampField = null;

            if (isModelagem) {
                timestampField = newStatus === 'modelando' ? 'productionStartedAt' :
                                newStatus === 'modelagem_concluida' ? 'completedAt' : null;
            } else {
                timestampField = newStatus === 'producao' ? 'productionStartedAt' :
                                newStatus === 'concluido' ? 'completedAt' :
                                newStatus === 'retirada' ? 'readyAt' :
                                newStatus === 'entregue' ? 'deliveredAt' : null;
            }

            if (timestampField) {
                updates[timestampField] = new Date().toISOString();
            }
        }
        else if (newStatusIndex < currentStatusIndex) {
            const timestampsToDelete = [];

            if (isModelagem) {
                if (newStatusIndex < statusOrder.indexOf('modelagem_concluida')) {
                    timestampsToDelete.push('completedAt');
                }
                if (newStatusIndex < statusOrder.indexOf('modelando')) {
                    timestampsToDelete.push('productionStartedAt');
                }
            } else {
                if (newStatusIndex < statusOrder.indexOf('entregue')) {
                    timestampsToDelete.push('deliveredAt');
                }
                if (newStatusIndex < statusOrder.indexOf('retirada')) {
                    timestampsToDelete.push('readyAt');
                    if (service.deliveryMethod === 'sedex' && service.trackingCode) {
                        updates.trackingCode = firebase.firestore.FieldValue.delete();
                        updates.postedAt = firebase.firestore.FieldValue.delete();
                    }
                }
                if (newStatusIndex < statusOrder.indexOf('concluido')) {
                    timestampsToDelete.push('completedAt');
                }
                if (newStatusIndex < statusOrder.indexOf('producao')) {
                    timestampsToDelete.push('productionStartedAt');
                }
            }

            timestampsToDelete.forEach(field => {
                updates[field] = firebase.firestore.FieldValue.delete();
            });
        }
        
        await state.db.collection('services').doc(serviceId).update(updates);
        showToast('Status atualizado!', 'success');
        
        if (sendWhatsapp && service.clientPhone) {
            const trackingLink = `\n\nAcompanhe em:\nhttps://imaginatech.com.br/acompanhar-pedido/?codigo=${service.orderCode}`;
            const messages = isModelagem ? {
                'modelando': `Olá, ${service.client}!\n\n✅ Iniciamos a modelagem 3D!\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}${trackingLink}`,
                'modelagem_concluida': `Olá, ${service.client}!\n\n✅ Modelagem concluída!\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}\n\nSeu modelo 3D está pronto!${trackingLink}`
            } : {
                'producao': `Olá, ${service.client}!\n\n✅ Iniciamos a produção!\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}${trackingLink}`,
                'retirada': service.deliveryMethod === 'retirada' ?
                    `Olá, ${service.client}!\n\n🎉 Pronto para retirada!\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}\n\nVenha buscar seu pedido!${trackingLink}` :
                    service.deliveryMethod === 'sedex' ?
                    `Olá, ${service.client}!\n\n📦 Postado nos Correios!\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}${service.trackingCode ? `\n» Rastreio: ${service.trackingCode}` : ''}${trackingLink}` :
                    service.deliveryMethod === 'uber' ?
                    `Olá, ${service.client}!\n\n📦 Postado via Uber Flash!\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}\n\nEm breve chegará até você!${trackingLink}` :
                    service.deliveryMethod === 'definir' ?
                    `Olá, ${service.client}!\n\n📦 Entrega combinada!\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}\n\nConforme combinado com você!${trackingLink}` :
                    `Olá, ${service.client}!\n\n📦 Em processo de entrega!\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}${trackingLink}`,
                'entregue': `Olá, ${service.client}!\n\n✅ Entregue com sucesso!\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}\n\nObrigado! 😊`
            };
            messages[newStatus] && sendWhatsAppMessage(service.clientPhone, messages[newStatus]);
        }
        
        if (sendEmail && service.clientEmail) {
            sendEmailNotification(service);
        }
    } catch (error) {
        logger.error('Erro:', error);
        showToast('Erro ao atualizar status', 'error');
    }
    window.closeStatusModal();
}

// ===========================
// BYPASS DE FOTO OBRIGATÓRIA
// ===========================
export async function proceedWithStatusChangeWithoutPhoto() {
    if (!state.pendingStatusUpdate || !state.db) return;

    const { serviceId, newStatus, service, requiresInstagramPhoto, requiresPackagedPhoto } =
        state.pendingStatusUpdate;
    const sendWhatsapp = document.getElementById('sendWhatsappNotification')?.checked || false;
    const sendEmail = document.getElementById('sendEmailNotification')?.checked || false;

    try {
        const isModelagem = service.serviceType === 'modelagem';
        const updates = {
            status: newStatus,
            updatedAt: new Date().toISOString(),
            updatedBy: state.currentUser.email,
            lastStatusChange: new Date().toISOString(),
            photoBypassUsed: true // Flag para auditoria
        };

        // Adiciona timestamps específicos por status
        if (newStatus === 'concluido' || newStatus === 'modelagem_concluida') {
            updates.completedAt = new Date().toISOString();
        } else if (newStatus === 'retirada') {
            updates.readyAt = new Date().toISOString();

            // Se for Sedex, verificar código de rastreio
            if (service.deliveryMethod === 'sedex') {
                const trackingInput = document.getElementById('statusTrackingCodeInput');
                if (trackingInput?.value.trim()) {
                    updates.trackingCode = trackingInput.value.trim().toUpperCase();
                    updates.postedAt = new Date().toISOString();
                }
            }
        } else if (newStatus === 'entregue') {
            updates.deliveredAt = new Date().toISOString();
        }

        await state.db.collection('services').doc(serviceId).update(updates);

        showToast(`✅ Status alterado para ${getStatusLabel(newStatus)} (bypass autorizado)`, 'success');

        // Enviar notificações se selecionado
        if (sendWhatsapp && service.clientPhone) {
            const trackingLink = `\n\nAcompanhe em:\nhttps://imaginatech.com.br/acompanhar-pedido/?codigo=${service.orderCode}`;
            const messages = isModelagem ? {
                'modelagem_concluida': `Olá, ${service.client}!\n\n✅ Modelagem concluída!\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}\n\nSeu modelo 3D está pronto!${trackingLink}`
            } : {
                'concluido': `Olá, ${service.client}!\n\n✅ Concluído!\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}${trackingLink}`,
                'retirada': service.deliveryMethod === 'retirada' ?
                    `Olá, ${service.client}!\n\n🎉 Pronto para retirada!\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}\n\nVenha buscar seu pedido!${trackingLink}` :
                    `Olá, ${service.client}!\n\n📦 Postado!\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}${trackingLink}`,
                'entregue': `Olá, ${service.client}!\n\n✅ Entregue com sucesso!\n\n» Serviço: ${service.name}\n» Código: ${service.orderCode}\n\nObrigado! 😊`
            };
            messages[newStatus] && sendWhatsAppMessage(service.clientPhone, messages[newStatus]);
        }

        if (sendEmail && service.clientEmail) {
            sendEmailNotification(service);
        }

        window.closeStatusModal();

    } catch (error) {
        logger.error('Erro ao alterar status com bypass:', error);
        showToast('❌ Erro ao alterar status', 'error');
    }
}

// ===========================
// RENDERING
// ===========================
export function renderServices() {
    const grid = document.getElementById('servicesGrid');
    const emptyState = document.getElementById('emptyState');
    if (!grid || !emptyState) return;

    let filtered;
    if (state.currentFilter === 'todos') {
        filtered = state.services.filter(s => !['entregue', 'retirada', 'modelagem_concluida'].includes(s.status));
    } else if (state.currentFilter === 'producao') {
        filtered = state.services.filter(s => s.status === 'producao' || s.status === 'modelando');
    } else if (state.currentFilter === 'concluido') {
        filtered = state.services.filter(s => s.status === 'concluido' || s.status === 'modelagem_concluida');
    } else {
        filtered = state.services.filter(s => s.status === state.currentFilter);
    }

    if (state.currentFilter === 'concluido') {
        filtered.sort((a, b) => {
            const dateA = new Date(a.completedAt || a.createdAt || 0);
            const dateB = new Date(b.completedAt || b.createdAt || 0);
            return dateB - dateA;
        });
    } else if (state.currentFilter === 'entregue') {
        filtered.sort((a, b) => {
            const dateA = new Date(a.deliveredAt || a.createdAt || 0);
            const dateB = new Date(b.deliveredAt || b.createdAt || 0);
            return dateB - dateA;
        });
    } else {
        filtered.sort((a, b) => {
            const priority = { urgente: 4, alta: 3, media: 2, baixa: 1 };
            const diff = (priority[b.priority] || 0) - (priority[a.priority] || 0);
            if (diff !== 0) return diff;

            if (a.dateUndefined !== b.dateUndefined) return a.dateUndefined ? 1 : -1;
            return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
        });
    }
    
    if (filtered.length === 0) {
        grid.style.display = 'none';
        emptyState.style.display = 'flex';
        const emptyText = document.getElementById('emptyText');
        emptyText && (emptyText.textContent = state.currentFilter === 'todos' ? 
            'Nenhum serviço ativo encontrado' : 
            `Nenhum serviço ${getStatusLabel(state.currentFilter).toLowerCase()} encontrado`);
    } else {
        grid.style.display = 'grid';
        emptyState.style.display = 'none';
        grid.innerHTML = filtered.map(service => createServiceCard(service)).join('');
    }
}

function createServiceCard(service) {
    const days = (service.status === 'entregue' || service.dateUndefined) ? null : calculateDaysRemaining(service.dueDate);
    const daysText = service.status === 'entregue' ? 'Entregue' : 
                   service.dateUndefined ? 'Data a definir' : 
                   formatDaysText(days);
    const daysColor = service.status === 'entregue' ? 'var(--neon-green)' :
                    service.dateUndefined ? 'var(--neon-yellow)' : 
                    getDaysColor(days);
    
    const hasImages = (service.images && service.images.length > 0) || service.imageUrl || service.instagramPhoto || (service.packagedPhotos && service.packagedPhotos.length > 0);
    
    const getTotalImagesCount = (svc) => {
        let count = 0;
        if (svc.images && svc.images.length > 0) count += svc.images.length;
        if (svc.imageUrl && !(svc.images && svc.images.find(img => img.url === svc.imageUrl))) count += 1;
        if (svc.instagramPhoto && !(svc.images && svc.images.find(img => img.url === svc.instagramPhoto))) count +=1;
        if (svc.packagedPhotos && svc.packagedPhotos.length > 0) count += svc.packagedPhotos.length;
        return count;
    };
    
    const filesCount = (service.files && service.files.length > 0) ? service.files.length : (service.fileUrl ? 1 : 0);
    
    const isModelagem = service.serviceType === 'modelagem';

    return `
        <div class="service-card priority-${service.priority || 'media'} ${isModelagem ? 'service-modelagem' : 'service-impressao'}" data-service-id="${service.id}">
            <div class="service-header">
                <div class="service-title">
                    <h3>${escapeHtml(service.name || 'Sem nome')}</h3>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        ${isModelagem ? '<span class="service-type-badge modelagem"><i class="fas fa-cube"></i> Modelagem</span>' : '<span class="service-type-badge impressao"><i class="fas fa-print"></i> Impressão</span>'}
                        <span class="service-code">${service.orderCode || 'N/A'}</span>
                    </div>
                </div>
                <div class="service-actions">
                    ${['concluido', 'retirada', 'entregue', 'modelagem_concluida'].includes(service.status) ? `
                    <button class="btn-icon btn-up" data-action="openUpModal" data-service-id="${escapeHtml(service.id)}" title="Promover para Portfolio">
                        <i class="fas fa-arrow-up"></i>
                    </button>
                    ` : ''}
                    <button class="btn-icon" data-action="openEditModal" data-service-id="${escapeHtml(service.id)}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon btn-delete" data-action="deleteService" data-service-id="${escapeHtml(service.id)}" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>

            ${!isModelagem && service.needsMaterialPurchase ? `
            <div class="material-purchase-alert">
                <i class="fas fa-exclamation-triangle"></i>
                <span>COMPRAR MATERIAL PARA FAZER O SERVIÇO</span>
                <div class="material-info-alert">
                    ${service.isMultiColor && service.materials && service.materials.length > 0 ?
                        `${service.material} - ${service.materials.filter(m => m.needsPurchase).map(m => `${formatColorName(m.color)} (${m.weight}g)`).join(', ')}` :
                        (service.material && service.color ? `${service.material} ${formatColorName(service.color)}${service.weight ? ` - ${service.weight}g` : ''}` : 'Material não especificado')
                    }
                </div>
            </div>` : ''}

            ${!isModelagem && service.deliveryMethod ? `
            <div class="delivery-badge ${service.status !== 'entregue' && days !== null && days < 0 ? 'badge-late' : service.status !== 'entregue' && days !== null && days <= 2 ? 'badge-urgent' : ''}">
                <div class="delivery-info">
                    <i class="fas ${getDeliveryIcon(service.deliveryMethod)}"></i>
                    ${getDeliveryMethodName(service.deliveryMethod)}${service.trackingCode ? ` - ${service.trackingCode}` : ''}
                </div>
                <div class="delivery-time ${service.status === 'entregue' ? 'time-delivered' : days !== null && days < 0 ? 'time-late' : days !== null && days <= 2 ? 'time-urgent' : days !== null && days <= 5 ? 'time-warning' : 'time-normal'}">
                    <i class="fas ${service.status === 'entregue' ? 'fa-check-circle' : 'fa-clock'}"></i>
                    ${daysText}
                </div>
            </div>` : ''}

            ${isModelagem ? `
            <div class="delivery-badge">
                <div class="delivery-info">
                    <i class="fas fa-laptop-code"></i>
                    Serviço Digital
                </div>
                <div class="delivery-time ${service.status === 'modelagem_concluida' ? 'time-delivered' : days !== null && days < 0 ? 'time-late' : days !== null && days <= 2 ? 'time-urgent' : days !== null && days <= 5 ? 'time-warning' : 'time-normal'}">
                    <i class="fas ${service.status === 'modelagem_concluida' ? 'fa-check-circle' : 'fa-clock'}"></i>
                    ${daysText}
                </div>
            </div>` : ''}
            
            <div class="service-info">
                <div class="info-item"><i class="fas fa-user"></i><span>${escapeHtml(service.client || 'Cliente não informado')}</span></div>
                ${!isModelagem && service.material ? `<div class="info-item"><i class="fas fa-layer-group"></i><span>${service.material}</span></div>` : ''}
                ${!isModelagem && service.color ? `<div class="info-item${service.isMultiColor ? ' multi-color-badge' : ''}"><i class="fas fa-palette"></i><span>${service.isMultiColor ? '🎨 ' : ''}${formatColorName(service.color)}</span></div>` : ''}
                <div class="info-item"><i class="fas fa-calendar"></i><span>${formatDate(service.startDate)}</span></div>
                ${service.value ? `<div class="info-item"><i class="fas fa-dollar-sign"></i><span>R$ ${formatMoney(service.value)}</span></div>` : ''}
                ${!isModelagem && service.weight ? `<div class="info-item"><i class="fas fa-weight"></i><span>${service.weight}g</span></div>` : ''}
                ${filesCount > 0 ? `<div class="info-item"><button class="btn-download" data-action="showServiceFiles" data-service-id="${escapeHtml(service.id)}" title="Ver Arquivos"><i class="fas fa-file"></i><span>${filesCount} ${filesCount > 1 ? 'Arquivos' : 'Arquivo'}</span></button></div>` : ''}
                ${service.fileInDrive ? `<div class="info-item drive-badge"><i class="fab fa-microsoft"></i><span>Arquivo no OneDrive</span></div>` : ''}
                ${hasImages ? `<div class="info-item"><button class="btn-image-view" data-action="showServiceImages" data-service-id="${escapeHtml(service.id)}" title="Ver Imagens"><i class="fas fa-image"></i><span>${getTotalImagesCount(service)} ${getTotalImagesCount(service) > 1 ? 'Imagens' : 'Imagem'}</span></button></div>` : ''}
            </div>
            
            ${service.description ? `<div class="service-description"><p>${escapeHtml(service.description)}</p></div>` : ''}
            
            <div class="service-status">
                <div class="status-timeline">
                    ${createStatusTimeline(service)}
                </div>
            </div>
            
            <div class="service-footer">
                ${(service.status === 'concluido' || service.status === 'retirada' || service.status === 'entregue') && service.clientPhone ?
                    `<button class="btn-whatsapp" data-action="contactClient" data-phone="${escapeHtml(service.clientPhone)}" data-service-name="${escapeHtml(service.name || '')}" data-order-code="${escapeHtml(service.orderCode || 'N/A')}" data-client-name="${escapeHtml(service.client || '')}">
                        <i class="fab fa-whatsapp"></i> Contatar
                    </button>` : ''}
                ${service.deliveryMethod ? `<button class="btn-delivery" data-action="showDeliveryInfo" data-service-id="${escapeHtml(service.id)}"><i class="fas fa-truck"></i> Ver Entrega</button>` : ''}
                ${service.trackingCode && service.deliveryMethod === 'sedex' && (service.status === 'retirada' || service.status === 'entregue') ?
                    (() => {
                        const carrier = getCarrierInfo(service.trackingCode);
                        return `<a href="${escapeHtml(carrier.url)}" target="_blank" class="btn-tracking" title="${escapeHtml(carrier.label)}" rel="noopener noreferrer">
                            <i class="fas ${carrier.icon}"></i> ${escapeHtml(carrier.label)}
                        </a>`;
                    })() : ''}
            </div>
        </div>
    `;
}

function createStatusTimeline(service) {
    const isModelagem = service.serviceType === 'modelagem';
    const statusOrder = isModelagem ? STATUS_ORDER_MODELAGEM : STATUS_ORDER;

    return statusOrder.map(status => {
        const isActive = service.status === status;
        const isCompleted = statusOrder.indexOf(service.status) > statusOrder.indexOf(status);

        let label;
        if (isModelagem) {
            // Labels para modelagem
            if (status === 'modelando') label = 'Modelando';
            else if (status === 'modelagem_concluida') label = 'Concluído';
        } else {
            // Labels para impressão
            if (status === 'pendente') label = 'Pendente';
            else if (status === 'producao') label = 'Produção';
            else if (status === 'concluido') label = 'Concluído';
            else if (status === 'retirada') {
                if (service.deliveryMethod === 'retirada') label = 'Para Retirar';
                else if (service.deliveryMethod === 'sedex') label = 'Postado';
                else if (service.deliveryMethod === 'uber') label = 'Postado';
                else if (service.deliveryMethod === 'definir') label = 'Combinado';
                else label = 'Entrega';
            }
            else if (status === 'entregue') label = 'Entregue';
        }

        return `
            <div class="timeline-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}">
                <button class="step-button"
                        data-action="updateStatus" data-service-id="${escapeHtml(service.id)}" data-status="${escapeHtml(status)}"
                        ${isActive ? 'disabled' : ''}>
                    <span class="step-icon">
                        <i class="fas ${getStatusIcon(status)}"></i>
                    </span>
                    <span class="step-text">${label}</span>
                </button>
            </div>
        `;
    }).join('');
}

export function updateStats() {
    const stats = {
        active: state.services.filter(s => !['entregue', 'retirada', 'modelagem_concluida'].includes(s.status)).length,
        pendente: state.services.filter(s => s.status === 'pendente').length,
        producao: state.services.filter(s => s.status === 'producao' || s.status === 'modelando').length,
        concluido: state.services.filter(s => s.status === 'concluido' || s.status === 'modelagem_concluida').length,
        retirada: state.services.filter(s => s.status === 'retirada').length,
        entregue: state.services.filter(s => s.status === 'entregue').length
    };

    Object.entries({
        'stat-active': stats.active,
        'stat-pending': stats.pendente,
        'stat-production': stats.producao,
        'stat-completed': stats.concluido,
        'stat-ready': stats.retirada,
        'stat-delivered': stats.entregue
    }).forEach(([id, value]) => {
        const el = document.getElementById(id);
        el && (el.textContent = value);
    });
}

export function filterServices(filter) {
    state.currentFilter = filter;
    document.querySelectorAll('.stat-card').forEach(card => card.classList.remove('active'));
    const activeCard = document.querySelector(`.stat-card[data-filter="${filter}"]`);
    if (activeCard) activeCard.classList.add('active');
    renderServices();
}

// ===========================
// PORTFOLIO UP FUNCTIONS
// ===========================

let upPhotoFile = null;
let upLogoFile = null;
let upExtraPhotosFiles = []; // Array de fotos extras
let existingPortfolioItems = []; // Cache dos itens existentes

export async function openUpModal(serviceId) {
    const service = state.services.find(s => s.id === serviceId);
    if (!service) {
        showToast('Servico nao encontrado', 'error');
        return;
    }

    // Preencher informacoes do servico
    document.getElementById('upServiceId').value = serviceId;
    document.getElementById('upEditingId').value = '';
    document.getElementById('upServiceName').textContent = service.name || 'Sem nome';
    document.getElementById('upServiceMaterial').textContent = service.material || 'N/A';
    document.getElementById('upServiceColor').textContent = formatColorName(service.color) || 'N/A';

    // Abrir modal primeiro (para feedback visual)
    document.getElementById('upModal')?.classList.add('active');

    // Buscar ups existentes deste servico
    try {
        const snapshot = await state.db.collection('portfolio')
            .where('serviceId', '==', serviceId)
            .orderBy('createdAt', 'desc')
            .get();

        existingPortfolioItems = [];
        snapshot.forEach(doc => {
            existingPortfolioItems.push({ id: doc.id, ...doc.data() });
        });

        if (existingPortfolioItems.length > 0) {
            // Mostrar lista de ups existentes
            showExistingUpsList();
        } else {
            // Mostrar formulario direto
            showUpForm();
        }
    } catch (error) {
        logger.error('Erro ao buscar portfolio:', error);
        // Em caso de erro, mostrar formulario
        showUpForm();
    }
}

/**
 * Mostra a lista de ups existentes (simplificado - gerenciamento no admin)
 */
function showExistingUpsList() {
    const section = document.getElementById('existingUpsSection');
    const list = document.getElementById('existingUpsList');
    const formSection = document.getElementById('upFormSection');
    const footer = document.getElementById('upModalFooter');

    // Esconder formulario e footer
    formSection.style.display = 'none';
    footer.style.display = 'none';

    // Gerar HTML da lista (simplificado - sem botoes de edicao/exclusao)
    let html = existingPortfolioItems.map(item => `
        <div class="existing-up-card" data-id="${item.id}">
            <div class="up-card-image">
                <img src="${item.mainPhoto?.url || ''}" alt="${item.title}" loading="lazy" decoding="async">
                ${item.logo ? `<img src="${item.logo.url}" alt="Logo" class="up-card-logo" loading="lazy" decoding="async">` : ''}
            </div>
            <div class="up-card-info">
                <h4>${item.title || 'Sem titulo'}</h4>
                <div class="up-card-meta">
                    <span class="up-destination ${item.destination}">
                        <i class="fas ${item.destination === 'carrossel' ? 'fa-images' : 'fa-th-large'}"></i>
                        ${item.destination === 'carrossel' ? 'Carrossel' : 'Projetos'}
                    </span>
                    ${item.category ? `<span class="up-category">${formatCategoryName(item.category)}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');

    // Adicionar link para gerenciamento no admin
    html += `
        <a href="../admin-portfolio/" class="btn-manage-portfolio" target="_blank">
            <i class="fas fa-cog"></i> Gerenciar Portfolio
        </a>
    `;

    list.innerHTML = html;

    // Mostrar secao
    section.style.display = 'block';
}

/**
 * Formata nome da categoria
 */
function formatCategoryName(category) {
    const names = {
        'industrial': 'Industrial',
        'personalizado': 'Personalizado',
        'prototipagem': 'Prototipagem',
        'reposicao': 'Reposicao',
        'decorativo': 'Decorativo',
        'tecnico': 'Tecnico'
    };
    return names[category] || category;
}

/**
 * Mostra o formulario de novo up
 */
export function showUpForm(editItem = null) {
    const section = document.getElementById('existingUpsSection');
    const formSection = document.getElementById('upFormSection');
    const footer = document.getElementById('upModalFooter');
    const saveBtn = document.getElementById('upSaveBtn');

    // Esconder lista
    section.style.display = 'none';

    // Mostrar formulario e footer
    formSection.style.display = 'block';
    footer.style.display = 'flex';

    // Resetar campos
    upPhotoFile = null;
    upLogoFile = null;
    document.getElementById('upPhoto').value = '';
    document.getElementById('upLogo').value = '';

    if (editItem) {
        // Modo edicao
        document.getElementById('upEditingId').value = editItem.id;
        document.getElementById('upTitle').value = editItem.title || '';
        document.getElementById('upDestination').value = editItem.destination || '';
        document.getElementById('upCategory').value = editItem.category || '';

        // Mostrar categoria se for projetos
        if (editItem.destination === 'projetos') {
            document.getElementById('upCategoryGroup').style.display = 'block';
        } else {
            document.getElementById('upCategoryGroup').style.display = 'none';
        }

        // Mostrar imagem existente
        if (editItem.mainPhoto?.url) {
            document.getElementById('upPhotoImg').src = editItem.mainPhoto.url;
            document.getElementById('upPhotoPreview').style.display = 'block';
            document.getElementById('upPhotoPlaceholder').style.display = 'none';
        } else {
            document.getElementById('upPhotoPreview').style.display = 'none';
            document.getElementById('upPhotoPlaceholder').style.display = 'flex';
        }

        // Mostrar logo existente
        if (editItem.logo?.url) {
            document.getElementById('upLogoImg').src = editItem.logo.url;
            document.getElementById('upLogoPreview').style.display = 'block';
            document.getElementById('upLogoPlaceholder').style.display = 'none';
        } else {
            document.getElementById('upLogoPreview').style.display = 'none';
            document.getElementById('upLogoPlaceholder').style.display = 'flex';
        }

        // Atualizar botao
        saveBtn.innerHTML = '<i class="fas fa-save"></i> Salvar Alteracoes';
    } else {
        // Modo novo
        document.getElementById('upEditingId').value = '';
        const service = state.services.find(s => s.id === document.getElementById('upServiceId')?.value);
        document.getElementById('upTitle').value = service?.name || '';
        document.getElementById('upDestination').value = '';
        document.getElementById('upCategory').value = '';
        document.getElementById('upCategoryGroup').style.display = 'none';

        document.getElementById('upPhotoPreview').style.display = 'none';
        document.getElementById('upPhotoPlaceholder').style.display = 'flex';
        document.getElementById('upLogoPreview').style.display = 'none';
        document.getElementById('upLogoPlaceholder').style.display = 'flex';

        // Atualizar botao
        saveBtn.innerHTML = '<i class="fas fa-arrow-up"></i> Promover';
    }

    // Sincronizar CustomSelects
    setTimeout(() => {
        document.getElementById('upDestination')?.dispatchEvent(new Event('change', { bubbles: true }));
        document.getElementById('upCategory')?.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);
}

// Funcoes editPortfolioItem e deletePortfolioItem movidas para admin-portfolio/script.js

export function closeUpModal() {
    document.getElementById('upModal')?.classList.remove('active');
    upPhotoFile = null;
    upLogoFile = null;
    clearExtraPhotos();
}

export function toggleCategoryField() {
    const destination = document.getElementById('upDestination')?.value;
    const categoryGroup = document.getElementById('upCategoryGroup');
    const categorySelect = document.getElementById('upCategory');
    const extraPhotosGroup = document.getElementById('upExtraPhotosGroup');
    const descriptionGroup = document.getElementById('upDescriptionGroup');

    if (destination === 'projetos') {
        categoryGroup.style.display = 'block';
        categorySelect.required = true;
        // Mostrar opcao de fotos extras e descricao para projetos
        if (extraPhotosGroup) {
            extraPhotosGroup.style.display = 'block';
        }
        if (descriptionGroup) {
            descriptionGroup.style.display = 'block';
        }
    } else {
        categoryGroup.style.display = 'none';
        categorySelect.required = false;
        categorySelect.value = '';
        // Esconder e limpar fotos extras e descricao para carrossel
        if (extraPhotosGroup) {
            extraPhotosGroup.style.display = 'none';
            clearExtraPhotos();
        }
        if (descriptionGroup) {
            descriptionGroup.style.display = 'none';
            document.getElementById('upDescription').value = '';
        }
    }

    // Atualizar CustomSelect se existir
    if (typeof window.initCustomSelects === 'function') {
        setTimeout(() => window.initCustomSelects(), 0);
    }
}

export function handleUpPhotoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.match(/image\/(jpeg|jpg|png|webp)/)) {
        showToast('Formato invalido. Use JPG, PNG ou WebP', 'error');
        return;
    }

    // Validar tamanho (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showToast('Imagem muito grande. Maximo 10MB', 'error');
        return;
    }

    upPhotoFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('upPhotoImg').src = e.target.result;
        document.getElementById('upPhotoPreview').style.display = 'block';
        document.getElementById('upPhotoPlaceholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

export function removeUpPhoto() {
    upPhotoFile = null;
    document.getElementById('upPhoto').value = '';
    document.getElementById('upPhotoPreview').style.display = 'none';
    document.getElementById('upPhotoPlaceholder').style.display = 'flex';
}

export function handleUpLogoSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // SEGURANCA: SVG removido - pode conter scripts maliciosos (XSS/XXE)
    if (!file.type.match(/image\/(png|webp)/)) {
        showToast('Logo deve ser PNG ou WebP (transparente)', 'error');
        return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Logo muito grande. Maximo 5MB', 'error');
        return;
    }

    upLogoFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('upLogoImg').src = e.target.result;
        document.getElementById('upLogoPreview').style.display = 'block';
        document.getElementById('upLogoPlaceholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

export function removeUpLogo() {
    upLogoFile = null;
    document.getElementById('upLogo').value = '';
    document.getElementById('upLogoPreview').style.display = 'none';
    document.getElementById('upLogoPlaceholder').style.display = 'flex';
}

// ===========================
// FOTOS EXTRAS (GALERIA)
// ===========================

let extraPhotoSlotCounter = 0;

/**
 * Limpa todas as fotos extras
 */
function clearExtraPhotos() {
    upExtraPhotosFiles = [];
    extraPhotoSlotCounter = 0;
    const container = document.getElementById('upExtraPhotosContainer');
    if (container) {
        container.innerHTML = '';
    }
    // Resetar estado da area de drop
    const area = document.getElementById('upExtraPhotosDropArea');
    if (area) {
        area.classList.remove('has-photos');
        area.classList.remove('drag-over');
    }
}

/**
 * Adiciona um novo slot para foto extra
 */
export function addExtraPhotoSlot() {
    const container = document.getElementById('upExtraPhotosContainer');
    if (!container) return;

    // Limitar a 5 fotos extras (6 total com a principal)
    if (upExtraPhotosFiles.filter(f => f !== null).length >= 5) {
        showToast('Maximo de 5 fotos extras permitido', 'warning');
        return;
    }

    const slotId = extraPhotoSlotCounter++;
    const slotHtml = `
        <div class="extra-photo-slot" id="extraSlot_${slotId}" data-action="triggerExtraPhotoInput" data-slot-id="${slotId}">
            <input type="file" id="extraPhotoInput_${slotId}" accept="image/jpeg,image/jpg,image/png,image/webp"
                   data-change="handleExtraPhotoSelect" data-slot-id="${slotId}" style="display: none;">
            <div class="slot-placeholder">
                <i class="fas fa-plus"></i>
                <span>Foto ${upExtraPhotosFiles.filter(f => f !== null).length + 2}</span>
            </div>
            <div class="slot-preview">
                <img id="extraPhotoImg_${slotId}" src="" alt="Preview">
            </div>
            <button type="button" class="btn-remove-slot" data-action="removeExtraPhotoSlot" data-slot-id="${slotId}">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', slotHtml);

    // Expandir o array para acomodar o novo slot
    while (upExtraPhotosFiles.length <= slotId) {
        upExtraPhotosFiles.push(null);
    }
}

/**
 * Handler para selecao de foto extra
 */
export function handleExtraPhotoSelect(event, slotId) {
    const file = event.target.files[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.match(/image\/(jpeg|jpg|png|webp)/)) {
        showToast('Formato invalido. Use JPG, PNG ou WebP', 'error');
        return;
    }

    // Validar tamanho (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showToast('Imagem muito grande. Maximo 10MB', 'error');
        return;
    }

    upExtraPhotosFiles[slotId] = file;

    const slot = document.getElementById(`extraSlot_${slotId}`);
    const img = document.getElementById(`extraPhotoImg_${slotId}`);

    if (slot && img) {
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
            slot.classList.add('has-image');
        };
        reader.readAsDataURL(file);
    }
}

/**
 * Remove uma foto extra
 */
export function removeExtraPhoto(slotId) {
    upExtraPhotosFiles[slotId] = null;

    const slot = document.getElementById(`extraSlot_${slotId}`);
    if (slot) {
        slot.remove();
    }

    // Atualizar estado da area de drop
    updateExtraPhotosDropAreaState();
}

/**
 * Retorna array de arquivos de fotos extras (sem nulls)
 */
function getExtraPhotosFiles() {
    return upExtraPhotosFiles.filter(f => f !== null);
}

// ===========================
// DRAG & DROP PARA PORTFOLIO
// ===========================

let upPhotoDragCounter = 0;
let upLogoDragCounter = 0;

export function setupUpModalDragDrop() {
    const photoArea = document.getElementById('upPhotoUploadArea');
    const logoArea = document.getElementById('upLogoUploadArea');
    const extraPhotosArea = document.getElementById('upExtraPhotosDropArea');

    if (photoArea) {
        photoArea.addEventListener('dragenter', handleUpPhotoDragEnter, false);
        photoArea.addEventListener('dragover', handleUpPhotoDragOver, false);
        photoArea.addEventListener('dragleave', handleUpPhotoDragLeave, false);
        photoArea.addEventListener('drop', handleUpPhotoDrop, false);
    }

    if (logoArea) {
        logoArea.addEventListener('dragenter', handleUpLogoDragEnter, false);
        logoArea.addEventListener('dragover', handleUpLogoDragOver, false);
        logoArea.addEventListener('dragleave', handleUpLogoDragLeave, false);
        logoArea.addEventListener('drop', handleUpLogoDrop, false);
    }

    if (extraPhotosArea) {
        extraPhotosArea.addEventListener('dragenter', handleExtraPhotosDragEnter, false);
        extraPhotosArea.addEventListener('dragover', handleExtraPhotosDragOver, false);
        extraPhotosArea.addEventListener('dragleave', handleExtraPhotosDragLeave, false);
        extraPhotosArea.addEventListener('drop', handleExtraPhotosDrop, false);
    }

    // Input file para clique na area de extra photos
    const extraPhotosInput = document.getElementById('upExtraPhotosInput');
    if (extraPhotosInput) {
        extraPhotosInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                processDroppedExtraPhotos(e.target.files);
                e.target.value = ''; // Reset para permitir selecionar mesmos arquivos novamente
            }
        });
    }
}

function preventUpDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// === FOTO DRAG & DROP ===
function handleUpPhotoDragEnter(e) {
    preventUpDefaults(e);
    upPhotoDragCounter++;
    const area = document.getElementById('upPhotoUploadArea');
    if (area) area.classList.add('drag-over');
}

function handleUpPhotoDragOver(e) {
    preventUpDefaults(e);
    const area = document.getElementById('upPhotoUploadArea');
    if (area && !area.classList.contains('drag-over')) {
        area.classList.add('drag-over');
    }
}

function handleUpPhotoDragLeave(e) {
    preventUpDefaults(e);
    upPhotoDragCounter--;
    if (upPhotoDragCounter === 0) {
        const area = document.getElementById('upPhotoUploadArea');
        if (area) area.classList.remove('drag-over');
    }
}

function handleUpPhotoDrop(e) {
    preventUpDefaults(e);
    upPhotoDragCounter = 0;
    const area = document.getElementById('upPhotoUploadArea');
    if (area) area.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processUpPhotoFile(files[0]);
    }
}

function processUpPhotoFile(file) {
    // Validar tipo
    if (!file.type.match(/image\/(jpeg|jpg|png|webp)/)) {
        showToast('Formato invalido. Use JPG, PNG ou WebP', 'error');
        return;
    }

    // Validar tamanho (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showToast('Imagem muito grande. Maximo 10MB', 'error');
        return;
    }

    upPhotoFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('upPhotoImg').src = e.target.result;
        document.getElementById('upPhotoPreview').style.display = 'block';
        document.getElementById('upPhotoPlaceholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
    showToast('Foto carregada!', 'success');
}

// === LOGO DRAG & DROP ===
function handleUpLogoDragEnter(e) {
    preventUpDefaults(e);
    upLogoDragCounter++;
    const area = document.getElementById('upLogoUploadArea');
    if (area) area.classList.add('drag-over');
}

function handleUpLogoDragOver(e) {
    preventUpDefaults(e);
    const area = document.getElementById('upLogoUploadArea');
    if (area && !area.classList.contains('drag-over')) {
        area.classList.add('drag-over');
    }
}

function handleUpLogoDragLeave(e) {
    preventUpDefaults(e);
    upLogoDragCounter--;
    if (upLogoDragCounter === 0) {
        const area = document.getElementById('upLogoUploadArea');
        if (area) area.classList.remove('drag-over');
    }
}

function handleUpLogoDrop(e) {
    preventUpDefaults(e);
    upLogoDragCounter = 0;
    const area = document.getElementById('upLogoUploadArea');
    if (area) area.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processUpLogoFile(files[0]);
    }
}

function processUpLogoFile(file) {
    if (!file.type.match(/image\/(png|svg\+xml|webp)/)) {
        showToast('Logo deve ser PNG, SVG ou WebP (transparente)', 'error');
        return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Logo muito grande. Maximo 5MB', 'error');
        return;
    }

    upLogoFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('upLogoImg').src = e.target.result;
        document.getElementById('upLogoPreview').style.display = 'block';
        document.getElementById('upLogoPlaceholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
    showToast('Logo carregado!', 'success');
}

// === EXTRA PHOTOS DRAG & DROP ===
let extraPhotosDragCounter = 0;

function handleExtraPhotosDragEnter(e) {
    preventUpDefaults(e);
    extraPhotosDragCounter++;
    const area = document.getElementById('upExtraPhotosDropArea');
    if (area) area.classList.add('drag-over');
}

function handleExtraPhotosDragOver(e) {
    preventUpDefaults(e);
    const area = document.getElementById('upExtraPhotosDropArea');
    if (area && !area.classList.contains('drag-over')) {
        area.classList.add('drag-over');
    }
}

function handleExtraPhotosDragLeave(e) {
    preventUpDefaults(e);
    extraPhotosDragCounter--;
    if (extraPhotosDragCounter === 0) {
        const area = document.getElementById('upExtraPhotosDropArea');
        if (area) area.classList.remove('drag-over');
    }
}

function handleExtraPhotosDrop(e) {
    preventUpDefaults(e);
    extraPhotosDragCounter = 0;
    const area = document.getElementById('upExtraPhotosDropArea');
    if (area) area.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        processDroppedExtraPhotos(files);
    }
}

function processDroppedExtraPhotos(files) {
    // Verificar quantas fotos ainda podem ser adicionadas
    const currentCount = upExtraPhotosFiles.filter(f => f !== null).length;
    const maxAllowed = 5 - currentCount;

    if (maxAllowed <= 0) {
        showToast('Maximo de 5 fotos extras atingido', 'warning');
        return;
    }

    let addedCount = 0;
    const filesToProcess = Array.from(files).slice(0, maxAllowed);

    for (const file of filesToProcess) {
        // Validar tipo
        if (!file.type.match(/image\/(jpeg|jpg|png|webp)/)) {
            showToast(`${file.name}: formato invalido`, 'error');
            continue;
        }

        // Validar tamanho (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            showToast(`${file.name}: muito grande (max 10MB)`, 'error');
            continue;
        }

        // Adicionar foto
        addExtraPhotoWithFile(file);
        addedCount++;
    }

    if (addedCount > 0) {
        showToast(`${addedCount} foto(s) adicionada(s)!`, 'success');
        updateExtraPhotosDropAreaState();
    }
}

function addExtraPhotoWithFile(file) {
    const container = document.getElementById('upExtraPhotosContainer');
    if (!container) return;

    const slotId = extraPhotoSlotCounter++;

    // Expandir o array para acomodar o novo slot
    while (upExtraPhotosFiles.length <= slotId) {
        upExtraPhotosFiles.push(null);
    }

    upExtraPhotosFiles[slotId] = file;

    const slotHtml = `
        <div class="extra-photo-slot has-image" id="extraSlot_${slotId}">
            <input type="file" id="extraPhotoInput_${slotId}" accept="image/jpeg,image/jpg,image/png,image/webp"
                   data-change="handleExtraPhotoSelect" data-slot-id="${slotId}" style="display: none;">
            <div class="slot-preview">
                <img id="extraPhotoImg_${slotId}" src="" alt="Preview">
            </div>
            <button type="button" class="btn-remove-slot" data-action="removeExtraPhotoSlot" data-slot-id="${slotId}">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', slotHtml);

    // Carregar preview
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.getElementById(`extraPhotoImg_${slotId}`);
        if (img) img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function updateExtraPhotosDropAreaState() {
    const area = document.getElementById('upExtraPhotosDropArea');
    const count = upExtraPhotosFiles.filter(f => f !== null).length;

    if (area) {
        if (count > 0) {
            area.classList.add('has-photos');
        } else {
            area.classList.remove('has-photos');
        }
    }
}

export async function saveToPortfolio() {
    const serviceId = document.getElementById('upServiceId')?.value;
    const editingId = document.getElementById('upEditingId')?.value;
    const title = document.getElementById('upTitle')?.value.trim();
    const description = document.getElementById('upDescription')?.value.trim() || '';
    const destination = document.getElementById('upDestination')?.value;
    const category = document.getElementById('upCategory')?.value;

    const isEditing = !!editingId;
    const existingItem = isEditing ? existingPortfolioItems.find(i => i.id === editingId) : null;

    // Validacoes
    if (!isEditing && !upPhotoFile) {
        showToast('Selecione uma foto de qualidade', 'error');
        return;
    }

    if (!title) {
        showToast('Digite um titulo para o projeto', 'error');
        return;
    }

    if (!destination) {
        showToast('Selecione o destino', 'error');
        return;
    }

    if (destination === 'projetos' && !category) {
        showToast('Selecione uma categoria', 'error');
        return;
    }

    const service = state.services.find(s => s.id === serviceId);
    if (!service) {
        showToast('Servico nao encontrado', 'error');
        return;
    }

    try {
        showToast(isEditing ? 'Salvando alteracoes...' : 'Enviando para portfolio...', 'info');

        const timestamp = Date.now();
        let photoData = existingItem?.mainPhoto || null;
        let logoData = existingItem?.logo || null;

        // Upload da foto principal (se nova foto foi selecionada)
        if (upPhotoFile) {
            // Deletar foto antiga se existir
            if (existingItem?.mainPhoto?.path) {
                try {
                    await state.storage.ref().child(existingItem.mainPhoto.path).delete();
                } catch (e) {
                    logger.warn('Erro ao deletar foto antiga:', e);
                }
            }

            const photoExt = upPhotoFile.name.split('.').pop();
            const photoPath = `portfolio/${timestamp}_main.${photoExt}`;
            const photoRef = state.storage.ref().child(photoPath);
            await photoRef.put(upPhotoFile);
            const photoUrl = await photoRef.getDownloadURL();
            photoData = { url: photoUrl, path: photoPath };
        }

        // Upload do logo (se novo logo foi selecionado)
        if (upLogoFile) {
            // Deletar logo antigo se existir
            if (existingItem?.logo?.path) {
                try {
                    await state.storage.ref().child(existingItem.logo.path).delete();
                } catch (e) {
                    logger.warn('Erro ao deletar logo antigo:', e);
                }
            }

            const logoExt = upLogoFile.name.split('.').pop();
            const logoPath = `portfolio/${timestamp}_logo.${logoExt}`;
            const logoRef = state.storage.ref().child(logoPath);
            await logoRef.put(upLogoFile);
            const logoUrl = await logoRef.getDownloadURL();
            logoData = { url: logoUrl, path: logoPath };
        }

        // Upload das fotos extras (apenas para projetos)
        let extraPhotosData = [];
        if (destination === 'projetos') {
            const extraFiles = getExtraPhotosFiles();
            if (extraFiles.length > 0) {
                showToast(`Enviando ${extraFiles.length} foto(s) extra(s)...`, 'info');
                for (let i = 0; i < extraFiles.length; i++) {
                    const file = extraFiles[i];
                    const ext = file.name.split('.').pop();
                    const path = `portfolio/${timestamp}_extra_${i}.${ext}`;
                    const ref = state.storage.ref().child(path);
                    await ref.put(file);
                    const url = await ref.getDownloadURL();
                    extraPhotosData.push({ url, path });
                }
            }
        }

        if (isEditing) {
            // Atualizar documento existente
            const updateData = {
                title: title,
                description: destination === 'projetos' ? description : null,
                category: destination === 'projetos' ? category : null,
                destination: destination,
                mainPhoto: photoData,
                logo: logoData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedBy: state.currentUser?.email || 'unknown'
            };

            await state.db.collection('portfolio').doc(editingId).update(updateData);
            showToast('Portfolio atualizado!', 'success');
        } else {
            // Criar documento novo
            const portfolioDoc = {
                title: title,
                description: destination === 'projetos' ? description : null,
                category: destination === 'projetos' ? category : null,
                destination: destination,
                serviceId: serviceId,
                material: service.material || null,
                color: service.color || null,
                orderCode: service.orderCode || null,
                mainPhoto: photoData,
                extraPhotos: extraPhotosData.length > 0 ? extraPhotosData : null,
                logo: logoData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: state.currentUser?.email || 'unknown',
                featured: false,
                order: 0,
                active: true
            };

            await state.db.collection('portfolio').add(portfolioDoc);
            const totalPhotos = 1 + extraPhotosData.length;
            showToast(`Projeto adicionado ao portfolio com ${totalPhotos} foto(s)!`, 'success');
        }

        closeUpModal();

    } catch (error) {
        logger.error('Erro ao salvar no portfolio:', error);
        showToast('Erro ao salvar. Tente novamente.', 'error');
    }
}
