/**
 * Auto-Orcamento App
 * Aplicacao principal para orcamento automatico de impressao 3D
 */

import { ThreeViewer } from './three-viewer.js';
import { calculateVolumeFromGeometry, calculateSurfaceArea, isMeshWatertight } from './volume-calculator.js';

// ============================================================================
// CONFIGURACAO
// ============================================================================

const CONFIG = {
    API_URL: 'https://us-central1-imaginatech-servicos.cloudfunctions.net',
    MAX_FILE_SIZE: 200 * 1024 * 1024, // 200MB
    ALLOWED_EXTENSIONS: ['stl', 'obj', 'glb', 'gltf', '3mf'],
    WHATSAPP_NUMBER: '5521968972539',
    // Densidades dos materiais (g/cm3) para calculo de peso
    MATERIAL_DENSITIES: {
        'PLA': 1.24,
        'ABS': 1.04,
        'PETG': 1.27,
        'TPU': 1.21,
        'Resina': 1.10
    },
    // Parametros de impressao (bico 0.4mm)
    PRINT_PARAMS: {
        wallThickness: 1.6,          // mm (4 perimetros * 0.4mm bico)
        topBottomThickness: 1.2,     // mm (6 camadas * 0.2mm layer)
        wasteFactor: 1.12            // 12% desperdicio (purga + brim + suportes basicos)
    },
    // Opcoes de preenchimento
    INFILL_OPTIONS: {
        'auto': { value: 0.20, label: 'Automatico (Analise do tecnico)' },
        '10': { value: 0.10, label: '10%' },
        '20': { value: 0.20, label: '20%' },
        '30': { value: 0.30, label: '30%' },
        '80': { value: 0.80, label: '80%' },
        '100': { value: 1.00, label: '100% (Solido)' }
    },
    // Materiais disponiveis (fallback se estoque offline)
    DEFAULT_MATERIALS: ['PLA', 'ABS', 'PETG', 'TPU', 'Resina'],
    // Cores padrao (fallback)
    DEFAULT_COLORS: ['Branco', 'Preto', 'Cinza', 'Vermelho', 'Azul', 'Verde', 'Amarelo', 'Laranja']
};

// Mapa de cores CSS para nomes de filamento
const COLOR_MAP = {
    'branco': '#FFFFFF',
    'preto': '#1A1A1A',
    'cinza': '#808080',
    'vermelho': '#E53935',
    'azul': '#1E88E5',
    'verde': '#43A047',
    'amarelo': '#FDD835',
    'laranja': '#FB8C00',
    'rosa': '#EC407A',
    'roxo': '#8E24AA',
    'marrom': '#6D4C41',
    'bege': '#D7CCC8',
    'prata': '#B0BEC5',
    'dourado': '#FFD54F',
    'transparente': 'transparent',
    'natural': '#F5F5DC',
    'magenta': '#D81B60',
    'ciano': '#00BCD4',
    'oliva': '#827717',
    'coral': '#FF7043',
    'turquesa': '#26A69A',
    'vinho': '#880E4F',
    'grafite': '#455A64'
};

// Glossario interativo de acabamentos especiais
const FINISH_GLOSSARY = {
    'silk': { label: 'Silk', desc: 'Acabamento sedoso e brilhante com reflexos metalicos. Ideal para pecas decorativas.' },
    'matte': { label: 'Matte', desc: 'Acabamento fosco e suave, sem brilho. Visual mais discreto e profissional.' },
    'marble': { label: 'Marble', desc: 'Efeito marmorizado com mistura de cores. Cada peca e unica.' },
    'glow': { label: 'Glow', desc: 'Brilha no escuro apos exposicao a luz. Efeito fosforescente.' },
    'wood': { label: 'Wood', desc: 'Contem particulas de madeira real. Aspecto e textura de madeira.' },
    'transparent': { label: 'Transparente', desc: 'Material translucido que permite passagem de luz.' },
    'fosforescente': { label: 'Fosforescente', desc: 'Brilha no escuro apos exposicao a luz.' },
    'metalizado': { label: 'Metalizado', desc: 'Contem particulas metalicas. Acabamento com brilho metalico.' },
    'glitter': { label: 'Glitter', desc: 'Contem particulas de glitter. Efeito brilhante e cintilante.' }
};

// ============================================================================
// LOGGER CONDICIONAL
// ============================================================================

const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

const logger = window.logger || {
    log: (...args) => { if (isDev) console.log(...args); },
    error: (...args) => { if (isDev) console.error(...args); },
    warn: (...args) => { if (isDev) console.warn(...args); }
};

// ============================================================================
// ESTADO
// ============================================================================

let state = {
    currentFile: null,
    currentGeometry: null,
    viewer: null,
    volume: 0,
    surfaceArea: 0,
    dimensions: null,
    price: 0,
    isEstimate: true,
    estimatedWeight: 0,
    availableStock: null,  // Cache do estoque
    selectedColor: '',      // Cor selecionada (value)
    selectedColorImage: null, // URL da foto do filamento selecionado
    colorOptions: []        // Lista de cores disponiveis
};

// ============================================================================
// INICIALIZACAO
// ============================================================================

document.addEventListener('DOMContentLoaded', init);

async function init() {
    setupUploadZone();
    setupEventHandlers();
    // CustomSelects sao inicializados automaticamente pelo /shared/custom-select.js
    // atraves da classe .form-select nos elementos select

    // Carregar estoque disponivel na inicializacao
    await fetchAvailableFilaments();
    updateMaterialDropdown();
}

// ============================================================================
// INTEGRACAO COM ESTOQUE
// ============================================================================

async function fetchAvailableFilaments(minWeight = 0) {
    try {
        const params = new URLSearchParams();
        if (minWeight > 0) params.append('minWeight', minWeight);

        const response = await fetch(
            `${CONFIG.API_URL}/getAvailableFilaments?${params}`,
            { signal: AbortSignal.timeout(10000) }
        );

        if (!response.ok) throw new Error('Erro ao consultar estoque');

        const data = await response.json();
        if (data.success) {
            state.availableStock = data.materials;
            return data;
        }
        throw new Error('Resposta invalida');

    } catch (error) {
        logger.warn('Estoque indisponivel, usando valores padrao:', error.message);
        state.availableStock = null;
        return null;
    }
}

function updateMaterialDropdown() {
    const materialSelect = document.getElementById('materialSelect');
    if (!materialSelect) return;

    let html = '';

    if (state.availableStock && Object.keys(state.availableStock).length > 0) {
        // Materiais do estoque + garantir que os DEFAULT_MATERIALS aparecem
        const stockMaterials = Object.keys(state.availableStock);
        const allMaterials = new Set([...stockMaterials, ...CONFIG.DEFAULT_MATERIALS]);
        const sorted = [...allMaterials].sort((a, b) => a.localeCompare(b, 'pt-BR'));

        sorted.forEach(material => {
            html += `<option value="${escapeHtml(material)}">${escapeHtml(material)}</option>`;
        });
    } else {
        // Fallback: materiais padrao (sem precos expostos)
        CONFIG.DEFAULT_MATERIALS.forEach(material => {
            html += `<option value="${escapeHtml(material)}">${escapeHtml(material)}</option>`;
        });
    }

    materialSelect.innerHTML = html;

    // Atualizar CustomSelect
    setTimeout(() => {
        materialSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);
}

function updateColorOptions(material, estimatedWeight = 0) {
    const colorGroup = document.getElementById('colorOptionGroup');
    const isResina = material?.toLowerCase() === 'resina';

    // Resina nao tem opcao de cor - esconder secao inteira
    if (isResina) {
        if (colorGroup) colorGroup.style.display = 'none';
        state.colorOptions = [];
        state.selectedColor = '';
        state.selectedColorImage = null;
        const colorSelect = document.getElementById('colorSelect');
        if (colorSelect) colorSelect.innerHTML = '<option value="">N/A</option>';
        return;
    }

    // Filamento: mostrar secao de cor
    if (colorGroup) colorGroup.style.display = '';

    // Construir lista de cores disponiveis para o material selecionado
    let colorList = [];

    if (state.availableStock && state.availableStock[material]) {
        const materialStock = state.availableStock[material];
        const colors = materialStock.availableColors || [];

        colors.forEach(color => {
            const stock = materialStock.colorStock[color];
            const totalGrams = stock?.totalGrams || 0;
            const sufficient = totalGrams >= estimatedWeight;

            if (sufficient) {
                colorList.push({
                    name: color,
                    value: color.toLowerCase(),
                    imageUrl: stock?.imageUrl || null
                });
            }
        });
    } else {
        // Fallback: cores padrao (sem foto)
        CONFIG.DEFAULT_COLORS.forEach(color => {
            colorList.push({ name: color, value: color.toLowerCase(), imageUrl: null });
        });
    }

    // Salvar lista no state para o modal
    state.colorOptions = colorList;

    // Atualizar select hidden (para compatibilidade com getSelectedOptions)
    const colorSelect = document.getElementById('colorSelect');
    if (colorSelect) {
        let html = '';
        colorList.forEach(c => {
            html += `<option value="${escapeHtml(c.value)}">${escapeHtml(c.name)}</option>`;
        });
        if (!html) {
            html = '<option value="" disabled>Nenhuma cor disponivel</option>';
        }
        colorSelect.innerHTML = html;
    }

    // Se a cor atual nao esta mais disponivel, selecionar a primeira
    const currentColor = state.selectedColor;
    const stillAvailable = colorList.some(c => c.value === currentColor);
    if (!stillAvailable && colorList.length > 0) {
        selectColor(colorList[0].value, colorList[0].name, colorList[0].imageUrl);
    } else if (colorList.length === 0) {
        selectColor('', 'Indisponivel', null);
    }
}

function getColorHex(colorName) {
    const lower = colorName.toLowerCase().trim();
    // Busca direta
    if (COLOR_MAP[lower]) return COLOR_MAP[lower];
    // Busca parcial (ex: "Vermelho Silk" -> vermelho)
    for (const [key, hex] of Object.entries(COLOR_MAP)) {
        if (lower.includes(key) || key.includes(lower)) return hex;
    }
    return '#808080'; // cinza padrao
}

function getFinishBadges(colorName) {
    const lower = colorName.toLowerCase();
    const badges = [];
    for (const [key, info] of Object.entries(FINISH_GLOSSARY)) {
        if (lower.includes(key)) {
            badges.push(info);
        }
    }
    return badges;
}

function renderColorModal() {
    const body = document.getElementById('colorModalBody');
    if (!body) return;

    const colors = state.colorOptions || [];

    if (colors.length === 0) {
        body.innerHTML = '<p class="color-modal-empty">Nenhuma cor disponivel para este material.</p>';
        return;
    }

    let html = '';
    colors.forEach(color => {
        const hex = getColorHex(color.name);
        const isSelected = state.selectedColor === color.value;
        const isTransparent = hex === 'transparent';
        const badges = getFinishBadges(color.name);
        const hasImage = !!color.imageUrl;

        let badgesHtml = '';
        badges.forEach(badge => {
            badgesHtml += `<span class="finish-badge">${escapeHtml(badge.label)} <i class="fas fa-info-circle"></i><span class="finish-tooltip">${escapeHtml(badge.desc)}</span></span>`;
        });

        // Guardar imageUrl no dataset para o selectColor
        const imgAttr = hasImage ? ` data-color-image="${escapeHtml(color.imageUrl)}"` : '';

        html += `<div class="color-card${isSelected ? ' selected' : ''}" data-action="select-color" data-color-value="${escapeHtml(color.value)}" data-color-name="${escapeHtml(color.name)}"${imgAttr}>`;

        // Swatch: foto do filamento se disponivel, senao circulo colorido
        if (hasImage) {
            html += `<img class="color-card-photo" src="${escapeHtml(color.imageUrl)}" alt="${escapeHtml(color.name)}" loading="lazy">`;
        } else {
            html += `<div class="color-card-swatch${isTransparent ? ' transparent-swatch' : ''}" style="background-color: ${isTransparent ? '' : hex};"></div>`;
        }

        html += `<div class="color-card-info">`;
        html += `<span class="color-card-name">${escapeHtml(color.name)}</span>`;
        if (badgesHtml) {
            html += `<div class="color-card-badges">${badgesHtml}</div>`;
        }
        html += `</div>`;
        html += `<i class="fas fa-check color-card-check"></i>`;
        html += `</div>`;
    });

    body.innerHTML = html;
}

function selectColor(value, name, imageUrl) {
    state.selectedColor = value;
    state.selectedColorImage = imageUrl || null;

    // Atualizar trigger button
    const triggerEl = document.getElementById('colorTrigger');
    const swatchEl = document.getElementById('selectedColorSwatch');
    const nameEl = document.getElementById('selectedColorName');

    // Marcar como indisponivel visualmente
    if (triggerEl) {
        triggerEl.classList.toggle('unavailable', !value);
    }

    if (swatchEl) {
        if (imageUrl) {
            swatchEl.style.background = `url('${imageUrl}') center/cover no-repeat`;
        } else if (!value) {
            swatchEl.style.background = 'rgba(255, 82, 82, 0.3)';
        } else {
            const hex = getColorHex(name || value);
            if (hex === 'transparent') {
                swatchEl.style.background = 'repeating-conic-gradient(#808080 0% 25%, #c0c0c0 0% 50%) 50% / 12px 12px';
            } else {
                swatchEl.style.background = hex;
            }
        }
    }
    if (nameEl) {
        nameEl.textContent = name || value || 'Selecione...';
    }

    // Atualizar hidden select
    const colorSelect = document.getElementById('colorSelect');
    if (colorSelect) {
        colorSelect.value = value;
        colorSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Atualizar estado do botao de submit
    const submitBtn = document.getElementById('submitQuote');
    if (submitBtn && state.price > 0) {
        const material = document.getElementById('materialSelect')?.value || '';
        const isResina = material.toLowerCase() === 'resina';
        submitBtn.disabled = !isResina && !value;
    }
}

function openColorModal() {
    renderColorModal();
    const overlay = document.getElementById('colorModalOverlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.setAttribute('aria-hidden', 'false');
    }
}

function closeColorModal() {
    const overlay = document.getElementById('colorModalOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
    }
}

// ============================================================================
// CALCULO DE PESO
// ============================================================================

function calculateFilamentWeight(volumeMm3, surfaceAreaMm2, material, infillOption = '20') {
    const volumeCm3 = volumeMm3 / 1000;
    const density = CONFIG.MATERIAL_DENSITIES[material] || 1.24;
    const infillConfig = CONFIG.INFILL_OPTIONS[infillOption] || CONFIG.INFILL_OPTIONS['20'];
    const infillPercentage = infillConfig.value;

    // Peso base do volume total (se fosse 100% solido)
    const solidWeight = volumeCm3 * density;

    // Shell dinamico baseado na area de superficie real
    // wallThickness: 4 perimetros * 0.4mm bico = 1.6mm tipico
    // topBottom: ~1.2mm (6 camadas * 0.2mm layer height)
    const wallThickness = CONFIG.PRINT_PARAMS.wallThickness;  // mm
    const shellVolumeMm3 = surfaceAreaMm2 * wallThickness;

    // shellFraction: proporcao do volume que e shell (clamped 0.05 a 0.95)
    let shellFraction = shellVolumeMm3 / volumeMm3;
    shellFraction = Math.max(0.05, Math.min(shellFraction, 0.95));

    const internalFraction = 1 - shellFraction;

    // Peso = (shell solido) + (interno * infill%)
    const effectiveWeight = solidWeight * (shellFraction + (internalFraction * infillPercentage));

    // Desperdicio (purga, brim, suportes basicos)
    const wasteMultiplier = CONFIG.PRINT_PARAMS.wasteFactor;
    return Math.ceil(effectiveWeight * wasteMultiplier);
}

function updateWeightDisplay(weight) {
    state.estimatedWeight = weight;

    const weightEl = document.getElementById('estimatedWeight');
    if (weightEl) {
        weightEl.textContent = weight;
    }
}

// ============================================================================
// UPLOAD ZONE
// ============================================================================

function setupUploadZone() {
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');

    if (!uploadZone || !fileInput || !uploadButton) return;

    // Drag and drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadZone.classList.remove('dragover');

        const file = e.dataTransfer?.files?.[0];
        if (file) handleFileSelect(file);
    });

    // Click to upload
    uploadButton.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelect(file);
    });
}

// ============================================================================
// VALIDACAO DE ARQUIVO
// ============================================================================

async function validateFile(file) {
    // Verificar tamanho
    if (file.size > CONFIG.MAX_FILE_SIZE) {
        return { valid: false, error: 'Arquivo muito grande (maximo 200MB)' };
    }

    // Verificar extensao
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!CONFIG.ALLOWED_EXTENSIONS.includes(ext)) {
        return { valid: false, error: 'Formato nao suportado. Use STL, OBJ, GLB ou 3MF.' };
    }

    // Validar magic bytes
    try {
        const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());

        // GLB: "glTF" (0x67 0x6C 0x54 0x46)
        if (ext === 'glb') {
            if (!(bytes[0] === 0x67 && bytes[1] === 0x6C && bytes[2] === 0x54 && bytes[3] === 0x46)) {
                return { valid: false, error: 'Arquivo GLB invalido ou corrompido' };
            }
        }

        // 3MF: ZIP signature (0x50 0x4B)
        if (ext === '3mf') {
            if (!(bytes[0] === 0x50 && bytes[1] === 0x4B)) {
                return { valid: false, error: 'Arquivo 3MF invalido ou corrompido' };
            }
        }

        // STL binario: verifica se nao comeca com "solid" mas tem tamanho correto
        // STL ASCII: comeca com "solid"
        // OBJ: geralmente comeca com "#" ou "v "
    } catch (err) {
        return { valid: false, error: 'Erro ao validar arquivo' };
    }

    return { valid: true };
}

// ============================================================================
// PROCESSAMENTO DE ARQUIVO
// ============================================================================

async function handleFileSelect(file) {
    showLoading('Validando arquivo...');

    // Validar
    const validation = await validateFile(file);
    if (!validation.valid) {
        hideLoading();
        showError(validation.error);
        return;
    }

    state.currentFile = file;
    showLoading('Carregando modelo 3D...');

    try {
        // Inicializar viewer se necessario
        if (!state.viewer) {
            const canvas = document.getElementById('viewer3D');
            if (!canvas) throw new Error('Canvas nao encontrado');
            state.viewer = new ThreeViewer(canvas);
        }

        // Carregar modelo
        const geometry = await state.viewer.loadFile(file);
        state.currentGeometry = geometry;

        // Calcular volume, area de superficie e dimensoes
        state.volume = calculateVolumeFromGeometry(geometry);
        state.surfaceArea = calculateSurfaceArea(geometry);
        state.dimensions = state.viewer.getBoundingBox();

        // Detectar unidade do modelo
        const maxDim = Math.max(state.dimensions.width, state.dimensions.height, state.dimensions.depth);
        if (maxDim < 1) {
            showWarning('Modelo muito pequeno (< 1mm). Verifique se esta em milimetros.');
        } else if (maxDim > 2000) {
            showWarning('Modelo muito grande (> 2m). Verifique se esta em milimetros, nao metros ou polegadas.');
        }

        // Avisar se mesh nao e watertight (volume pode ser impreciso)
        if (!isMeshWatertight(geometry)) {
            showWarning('Modelo nao esta fechado (watertight). O volume pode ser impreciso.');
        }

        // Atualizar UI
        updateModelInfo();
        showPreviewSection();

        // Nome do arquivo
        const fileNameEl = document.getElementById('fileName');
        if (fileNameEl) {
            fileNameEl.textContent = escapeHtml(file.name);
        }

        // Calcular peso estimado
        const material = document.getElementById('materialSelect')?.value || 'PLA';
        const infill = document.getElementById('infillSelect')?.value || '20';
        const estimatedWeight = calculateFilamentWeight(state.volume, state.surfaceArea, material, infill);
        updateWeightDisplay(estimatedWeight);

        // Atualizar estoque com peso minimo e recarregar cores
        await fetchAvailableFilaments(estimatedWeight);
        updateMaterialDropdown();
        updateColorOptions(material, estimatedWeight);

        // Calcular preco
        await calculateQuote();

    } catch (error) {
        logger.error('Erro ao carregar modelo:', error);
        showError('Erro ao processar o arquivo. Verifique se esta corrompido.');
    } finally {
        hideLoading();
    }
}

// ============================================================================
// ATUALIZACAO DE UI
// ============================================================================

function updateModelInfo() {
    const dimensionsEl = document.getElementById('dimensions');
    const volumeEl = document.getElementById('volume');

    if (dimensionsEl && state.dimensions) {
        const d = state.dimensions;
        dimensionsEl.textContent = `${d.width.toFixed(1)} x ${d.height.toFixed(1)} x ${d.depth.toFixed(1)} mm`;
    }

    if (volumeEl && state.volume) {
        const volumeCm3 = state.volume / 1000; // mm3 para cm3
        volumeEl.textContent = volumeCm3.toFixed(2);
    }
}

function updatePriceLoading(loading) {
    const priceEl = document.getElementById('priceValue');
    const disclaimerEl = document.getElementById('priceDisclaimer');
    const submitBtn = document.getElementById('submitQuote');

    if (loading) {
        if (priceEl) {
            priceEl.textContent = 'Calculando...';
            priceEl.classList.add('estimate');
        }
        if (disclaimerEl) {
            disclaimerEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculando orcamento no servidor...';
        }
        if (submitBtn) submitBtn.disabled = true;
    } else {
        if (priceEl) {
            priceEl.textContent = 'R$ --';
            priceEl.classList.remove('estimate');
        }
        if (disclaimerEl) {
            disclaimerEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Nao foi possivel calcular. Tente novamente.';
        }
        if (submitBtn) submitBtn.disabled = true;
    }
}

function updatePrice(price, isEstimate = true) {
    state.price = price;
    state.isEstimate = isEstimate;

    const priceEl = document.getElementById('priceValue');
    const disclaimerEl = document.getElementById('priceDisclaimer');
    const submitBtn = document.getElementById('submitQuote');

    if (priceEl) {
        priceEl.textContent = `R$ ${price.toFixed(2).replace('.', ',')}`;
        priceEl.classList.toggle('estimate', isEstimate);
    }

    if (disclaimerEl) {
        if (isEstimate) {
            disclaimerEl.innerHTML = '<i class="fas fa-info-circle"></i> Estimativa aproximada. O preco final pode variar conforme complexidade.';
        } else {
            disclaimerEl.innerHTML = '<i class="fas fa-check-circle"></i> Preco calculado com base no volume do modelo.';
        }
    }

    if (submitBtn) {
        // Desabilitar se preco invalido ou cor indisponivel (exceto Resina que nao precisa de cor)
        const material = document.getElementById('materialSelect')?.value || '';
        const isResina = material.toLowerCase() === 'resina';
        const colorUnavailable = !isResina && !state.selectedColor;
        submitBtn.disabled = price <= 0 || colorUnavailable;
    }
}

function showPreviewSection() {
    const uploadSection = document.getElementById('uploadSection');
    const previewSection = document.getElementById('previewSection');

    if (uploadSection) uploadSection.classList.add('hidden');
    if (previewSection) previewSection.classList.remove('hidden');
}

function showUploadSection() {
    const uploadSection = document.getElementById('uploadSection');
    const previewSection = document.getElementById('previewSection');

    if (uploadSection) uploadSection.classList.remove('hidden');
    if (previewSection) previewSection.classList.add('hidden');

    // Limpar input (clonar para permitir re-upload do mesmo arquivo)
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        const newInput = fileInput.cloneNode(true);
        fileInput.parentNode.replaceChild(newInput, fileInput);
        newInput.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
        });
    }
}

// ============================================================================
// CALCULO DE ORCAMENTO
// ============================================================================

// Debounce: cancela chamada anterior quando uma nova e feita
let quoteAbortController = null;

async function calculateQuote() {
    if (!state.currentFile || !state.volume) return;

    // Cancelar chamada anterior (debounce)
    if (quoteAbortController) {
        quoteAbortController.abort();
    }
    quoteAbortController = new AbortController();
    const signal = quoteAbortController.signal;

    const options = getSelectedOptions();

    // Mostrar loading enquanto calcula no backend
    updatePriceLoading(true);

    try {
        const timeoutId = setTimeout(() => quoteAbortController.abort(), 30000);

        // Enviar apenas volume e opcoes (sem arquivo - evita 413)
        const response = await fetch(`${CONFIG.API_URL}/calculateQuote`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                volume: state.volume,
                material: options.material,
                color: options.color,
                infill: options.infill,
                finish: options.finish,
                priority: options.priority
            }),
            signal: signal
        });

        clearTimeout(timeoutId);

        const result = await response.json();

        if (response.ok && result.success && result.price) {
            updatePrice(result.price, result.isEstimate || false);
            return;
        }

        // Backend retornou erro
        showError(result.error || 'Erro ao calcular orcamento. Tente novamente.');
        updatePriceLoading(false);
    } catch (error) {
        // Ignorar AbortError de debounce (chamada substituida por outra)
        if (error.name === 'AbortError') {
            // Diferenciar timeout de debounce: se nao ha novo controller, foi timeout
            if (!quoteAbortController || signal === quoteAbortController.signal) {
                showError('Tempo esgotado ao calcular orcamento. Tente novamente.');
                updatePriceLoading(false);
            }
            return;
        }

        showError('Erro de conexao com o servidor. Verifique sua internet.');
        updatePriceLoading(false);
    }
}

function getSelectedOptions() {
    return {
        material: document.getElementById('materialSelect')?.value || 'PLA',
        color: state.selectedColor || document.getElementById('colorSelect')?.value || 'branco',
        infill: document.getElementById('infillSelect')?.value || '20',
        finish: document.getElementById('finishSelect')?.value || 'padrao',
        priority: document.getElementById('prioritySelect')?.value || 'normal'
    };
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function setupEventHandlers() {
    // Data-action handlers (seguranca - sem onclick inline)
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;

        const action = el.dataset.action;

        switch (action) {
            case 'rotate-model':
                state.viewer?.rotateModel();
                break;

            case 'reset-camera':
                state.viewer?.resetCamera();
                break;

            case 'toggle-wireframe':
                const wireframe = state.viewer?.toggleWireframe();
                el.classList.toggle('active', wireframe);
                break;

            case 'toggle-grid':
                const grid = state.viewer?.toggleGrid();
                el.classList.toggle('active', grid);
                break;

            case 'toggle-mobile-menu':
                toggleMobileMenu();
                break;

            case 'open-color-modal':
                openColorModal();
                break;

            case 'close-color-modal':
                closeColorModal();
                break;

            case 'select-color': {
                const colorValue = el.dataset.colorValue;
                const colorName = el.dataset.colorName;
                const colorImage = el.dataset.colorImage || null;
                selectColor(colorValue, colorName, colorImage);
                closeColorModal();
                // Recalcular preco
                if (state.currentFile && state.volume) {
                    calculateQuote();
                }
                break;
            }
        }
    });

    // Fechar modal de cores ao clicar no overlay (fora do modal)
    const colorOverlay = document.getElementById('colorModalOverlay');
    if (colorOverlay) {
        colorOverlay.addEventListener('click', (e) => {
            if (e.target === colorOverlay) {
                closeColorModal();
            }
        });
    }

    // Fechar modal de cores com Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('colorModalOverlay');
            if (overlay && !overlay.classList.contains('hidden')) {
                closeColorModal();
            }
        }
    });

    // Fechar menu mobile ao clicar fora
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('mobileNavDropdown');
        const btn = document.getElementById('btnMobileMenu');
        if (!dropdown || !btn) return;

        if (!dropdown.contains(e.target) && !btn.contains(e.target)) {
            dropdown.classList.remove('open');
            btn.classList.remove('open');
        }
    });

    // Mudanca de material: recalcular peso e atualizar cores
    const materialSelect = document.getElementById('materialSelect');
    if (materialSelect) {
        materialSelect.addEventListener('change', async () => {
            const material = materialSelect.value;
            const infill = document.getElementById('infillSelect')?.value || '20';

            // Atualizar cores disponiveis para este material
            if (state.volume > 0) {
                const estimatedWeight = calculateFilamentWeight(state.volume, state.surfaceArea, material, infill);
                updateWeightDisplay(estimatedWeight);
                updateColorOptions(material, estimatedWeight);
            } else {
                updateColorOptions(material, 0);
            }

            // Recalcular preco
            if (state.currentFile && state.volume) {
                calculateQuote();
            }
        });
    }

    // Mudanca de infill: recalcular peso e atualizar cores
    const infillSelect = document.getElementById('infillSelect');
    if (infillSelect) {
        infillSelect.addEventListener('change', async () => {
            const material = document.getElementById('materialSelect')?.value || 'PLA';
            const infill = infillSelect.value;

            if (state.volume > 0) {
                const estimatedWeight = calculateFilamentWeight(state.volume, state.surfaceArea, material, infill);
                updateWeightDisplay(estimatedWeight);
                updateColorOptions(material, estimatedWeight);
            }

            // Recalcular preco
            if (state.currentFile && state.volume) {
                calculateQuote();
            }
        });
    }

    // Mudanca de outras opcoes recalcula preco
    const otherSelectIds = ['finishSelect', 'prioritySelect'];
    otherSelectIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                if (state.currentFile && state.volume) {
                    calculateQuote();
                }
            });
        }
    });

    // Trocar arquivo
    const changeFileBtn = document.getElementById('changeFile');
    if (changeFileBtn) {
        changeFileBtn.addEventListener('click', () => {
            showUploadSection();
            state.currentFile = null;
            state.currentGeometry = null;
            state.volume = 0;
            state.surfaceArea = 0;
            state.dimensions = null;
            state.price = 0;
            state.selectedColor = '';
            state.colorOptions = [];
        });
    }

    // Submeter orcamento via WhatsApp
    const submitBtn = document.getElementById('submitQuote');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitQuoteWhatsApp);
    }
}

function submitQuoteWhatsApp() {
    if (!state.currentFile || state.price <= 0) return;

    const options = getSelectedOptions();
    const dims = state.dimensions;
    const volumeCm3 = (state.volume / 1000).toFixed(2);
    const weightG = state.estimatedWeight || calculateFilamentWeight(state.volume, state.surfaceArea, options.material, options.infill);

    // Obter label do infill
    const infillLabel = CONFIG.INFILL_OPTIONS[options.infill]?.label || '20%';

    const message = encodeURIComponent(
        `Ola! Vim do Auto-Orcamento do site.\n\n` +
        `*Arquivo:* ${state.currentFile.name}\n` +
        `*Dimensoes:* ${dims?.width?.toFixed(1) || '--'} x ${dims?.height?.toFixed(1) || '--'} x ${dims?.depth?.toFixed(1) || '--'} mm\n` +
        `*Volume:* ${volumeCm3} cm3\n` +
        `*Peso estimado:* ${weightG}g de filamento\n\n` +
        `*Configuracoes:*\n` +
        `- Material: ${options.material}\n` +
        `- Cor: ${options.color}\n` +
        `- Preenchimento: ${infillLabel}\n` +
        `- Acabamento: ${options.finish}\n` +
        `- Prioridade: ${options.priority}\n\n` +
        `*Estimativa:* R$ ${state.price.toFixed(2).replace('.', ',')}\n\n` +
        `Gostaria de confirmar esse orcamento!`
    );

    const url = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${message}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

// ============================================================================
// UTILITARIOS
// ============================================================================

function toggleMobileMenu() {
    const dropdown = document.getElementById('mobileNavDropdown');
    const btn = document.getElementById('btnMobileMenu');

    if (!dropdown || !btn) return;

    const isOpen = dropdown.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function sanitizeFileName(name) {
    if (!name) return 'file';
    return name
        .replace(/\.\./g, '')
        .replace(/[\/\\:*?"<>|]/g, '_')
        .slice(0, 200);
}

let _loadingStart = Date.now();

function showLoading(message = '') {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.setAttribute('aria-hidden', 'false');
        const msgEl = overlay.querySelector('.loading-message');
        if (msgEl) msgEl.textContent = message;
    }
    _loadingStart = Date.now();
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    const remaining = Math.max(0, 1500 - (Date.now() - _loadingStart));
    setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
    }, remaining);
}

let toastTimeout = null;

function showError(message) {
    showToast(message, 'error');
}

function showWarning(message) {
    showToast(message, 'warning');
}

function showToast(message, type = 'error') {
    const toast = document.getElementById('errorToast');
    const messageEl = document.getElementById('errorMessage');

    if (toast && messageEl) {
        // Limpar timeout anterior
        if (toastTimeout) clearTimeout(toastTimeout);

        messageEl.textContent = message;
        toast.classList.remove('hidden', 'toast-hiding', 'toast-warning');
        if (type === 'warning') toast.classList.add('toast-warning');

        toastTimeout = setTimeout(() => {
            toast.classList.add('toast-hiding');
            setTimeout(() => {
                toast.classList.add('hidden');
                toast.classList.remove('toast-hiding', 'toast-warning');
            }, 300);
        }, 5000);
    }
}
