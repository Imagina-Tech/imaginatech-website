/**
 * Auto-Orcamento App
 * Aplicacao principal para orcamento automatico de impressao 3D
 */

import { ThreeViewer } from './three-viewer.js';
import { calculateVolumeFromGeometry, isMeshWatertight } from './volume-calculator.js';

// ============================================================================
// CONFIGURACAO
// ============================================================================

const CONFIG = {
    API_URL: 'https://us-central1-imaginatech-servicos.cloudfunctions.net',
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
    ALLOWED_EXTENSIONS: ['stl', 'obj', 'glb', 'gltf', '3mf'],
    WHATSAPP_NUMBER: '5521968972539',
    // Custos locais (fallback se backend falhar)
    MATERIAL_COSTS: {
        'PLA': { perCm3: 0.08, minPrice: 15 },
        'ABS': { perCm3: 0.10, minPrice: 18 },
        'PETG': { perCm3: 0.12, minPrice: 20 },
        'TPU': { perCm3: 0.18, minPrice: 25 },
        'Resina': { perCm3: 0.25, minPrice: 30 }
    },
    FINISH_MULTIPLIERS: {
        'padrao': 1.0,
        'lixado': 1.2,
        'pintado': 1.4
    },
    PRIORITY_MULTIPLIERS: {
        'normal': 1.0,
        'urgente': 1.5
    },
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
        infillPercentage: 0.20,      // 20% infill
        wallThickness: 0.08,         // ~8% para paredes
        topBottomLayers: 0.05,       // ~5% para topo/fundo
        wasteFactor: 1.10            // 10% desperdicio
    },
    // Cores padrao (fallback)
    DEFAULT_COLORS: ['Branco', 'Preto', 'Cinza', 'Vermelho', 'Azul', 'Verde', 'Amarelo', 'Laranja']
};

// ============================================================================
// ESTADO
// ============================================================================

let state = {
    currentFile: null,
    currentGeometry: null,
    viewer: null,
    volume: 0,
    dimensions: null,
    price: 0,
    isEstimate: true,
    estimatedWeight: 0,
    availableStock: null  // Cache do estoque
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
        console.warn('Estoque indisponivel, usando valores padrao:', error.message);
        state.availableStock = null;
        return null;
    }
}

function updateMaterialDropdown() {
    const materialSelect = document.getElementById('materialSelect');
    if (!materialSelect) return;

    let html = '';

    if (state.availableStock && Object.keys(state.availableStock).length > 0) {
        // Materiais do estoque
        const materials = Object.keys(state.availableStock).sort((a, b) => a.localeCompare(b, 'pt-BR'));
        materials.forEach(material => {
            html += `<option value="${escapeHtml(material)}">${escapeHtml(material)}</option>`;
        });
    } else {
        // Fallback: materiais padrao
        Object.keys(CONFIG.MATERIAL_COSTS).forEach(material => {
            html += `<option value="${escapeHtml(material)}">${escapeHtml(material)}</option>`;
        });
    }

    materialSelect.innerHTML = html;

    // Atualizar CustomSelect
    setTimeout(() => {
        materialSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);
}

function updateColorDropdown(material, estimatedWeight = 0) {
    const colorSelect = document.getElementById('colorSelect');
    if (!colorSelect) return;

    let html = '';

    if (state.availableStock && state.availableStock[material]) {
        const materialStock = state.availableStock[material];
        const colors = materialStock.availableColors || [];

        if (colors.length === 0) {
            html = '<option value="" disabled>Nenhuma cor disponivel</option>';
        } else {
            colors.forEach(color => {
                const stock = materialStock.colorStock[color];
                const totalGrams = stock?.totalGrams || 0;
                const sufficient = totalGrams >= estimatedWeight;

                if (sufficient) {
                    // Mostrar estoque disponivel
                    const stockLabel = totalGrams >= 1000
                        ? `${(totalGrams / 1000).toFixed(1)}kg`
                        : `${totalGrams}g`;
                    html += `<option value="${escapeHtml(color.toLowerCase())}">${escapeHtml(color)} (${stockLabel})</option>`;
                }
            });
        }

        if (!html) {
            html = '<option value="" disabled>Estoque insuficiente</option>';
        }
    } else {
        // Fallback: cores padrao
        CONFIG.DEFAULT_COLORS.forEach(color => {
            html += `<option value="${escapeHtml(color.toLowerCase())}">${escapeHtml(color)}</option>`;
        });
    }

    colorSelect.innerHTML = html;

    // Atualizar CustomSelect
    setTimeout(() => {
        colorSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);
}

// ============================================================================
// CALCULO DE PESO
// ============================================================================

function calculateFilamentWeight(volumeMm3, material) {
    const volumeCm3 = volumeMm3 / 1000;
    const density = CONFIG.MATERIAL_DENSITIES[material] || 1.24;

    // Peso base = volume * densidade
    const baseDensityWeight = volumeCm3 * density;

    // Fator de preenchimento efetivo (~33% para peca tipica)
    const effectiveFillFactor =
        CONFIG.PRINT_PARAMS.infillPercentage +
        CONFIG.PRINT_PARAMS.wallThickness +
        CONFIG.PRINT_PARAMS.topBottomLayers;

    // Peso estimado com desperdicio
    const estimatedWeight = baseDensityWeight * effectiveFillFactor * CONFIG.PRINT_PARAMS.wasteFactor;

    return Math.ceil(estimatedWeight); // Arredonda para cima (gramas)
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
        return { valid: false, error: 'Arquivo muito grande (maximo 50MB)' };
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

        // Calcular volume e dimensoes
        state.volume = calculateVolumeFromGeometry(geometry);
        state.dimensions = state.viewer.getBoundingBox();

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
        const estimatedWeight = calculateFilamentWeight(state.volume, material);
        updateWeightDisplay(estimatedWeight);

        // Atualizar estoque com peso minimo e recarregar cores
        await fetchAvailableFilaments(estimatedWeight);
        updateMaterialDropdown();
        updateColorDropdown(material, estimatedWeight);

        // Calcular preco
        await calculateQuote();

    } catch (error) {
        console.error('Erro ao carregar modelo:', error);
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
        submitBtn.disabled = price <= 0;
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

    // Limpar input
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
}

// ============================================================================
// CALCULO DE ORCAMENTO
// ============================================================================

async function calculateQuote() {
    if (!state.currentFile || !state.volume) return;

    const options = getSelectedOptions();

    try {
        // Tentar backend primeiro
        const formData = new FormData();
        formData.append('file', state.currentFile, sanitizeFileName(state.currentFile.name));
        formData.append('material', options.material);
        formData.append('color', options.color);
        formData.append('finish', options.finish);
        formData.append('priority', options.priority);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(`${CONFIG.API_URL}/calculateQuote`, {
            method: 'POST',
            body: formData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
            const result = await response.json();
            if (result.success && result.price) {
                updatePrice(result.price, false);
                return;
            }
        }

        throw new Error('Backend nao disponivel');

    } catch (error) {
        // Fallback: calculo local
        console.warn('Usando calculo local (fallback):', error.message);
        const price = calculateLocalEstimate(state.volume, options);
        updatePrice(price, true);
    }
}

function calculateLocalEstimate(volumeMm3, options) {
    const material = CONFIG.MATERIAL_COSTS[options.material] || CONFIG.MATERIAL_COSTS['PLA'];
    const finishMultiplier = CONFIG.FINISH_MULTIPLIERS[options.finish] || 1.0;
    const priorityMultiplier = CONFIG.PRIORITY_MULTIPLIERS[options.priority] || 1.0;

    const volumeCm3 = volumeMm3 / 1000;
    let price = volumeCm3 * material.perCm3;
    price *= finishMultiplier;
    price *= priorityMultiplier;

    return Math.max(price, material.minPrice);
}

function getSelectedOptions() {
    return {
        material: document.getElementById('materialSelect')?.value || 'PLA',
        color: document.getElementById('colorSelect')?.value || 'branco',
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
        }
    });

    // Mudanca de material: recalcular peso e atualizar cores
    const materialSelect = document.getElementById('materialSelect');
    if (materialSelect) {
        materialSelect.addEventListener('change', async () => {
            const material = materialSelect.value;

            // Atualizar cores disponiveis para este material
            if (state.volume > 0) {
                const estimatedWeight = calculateFilamentWeight(state.volume, material);
                updateWeightDisplay(estimatedWeight);
                updateColorDropdown(material, estimatedWeight);
            } else {
                updateColorDropdown(material, 0);
            }

            // Recalcular preco
            if (state.currentFile && state.volume) {
                calculateQuote();
            }
        });
    }

    // Mudanca de outras opcoes recalcula preco
    const otherSelectIds = ['colorSelect', 'finishSelect', 'prioritySelect'];
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
            state.dimensions = null;
            state.price = 0;
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
    const weightG = state.estimatedWeight || calculateFilamentWeight(state.volume, options.material);

    const message = encodeURIComponent(
        `Ola! Vim do Auto-Orcamento do site.\n\n` +
        `*Arquivo:* ${state.currentFile.name}\n` +
        `*Dimensoes:* ${dims?.width?.toFixed(1) || '--'} x ${dims?.height?.toFixed(1) || '--'} x ${dims?.depth?.toFixed(1) || '--'} mm\n` +
        `*Volume:* ${volumeCm3} cm3\n` +
        `*Peso estimado:* ${weightG}g de filamento\n\n` +
        `*Configuracoes:*\n` +
        `- Material: ${options.material}\n` +
        `- Cor: ${options.color}\n` +
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

function showLoading(text = 'Processando...') {
    const overlay = document.getElementById('loadingOverlay');
    const textEl = document.getElementById('loadingText');

    if (overlay) {
        overlay.classList.remove('hidden');
        overlay.setAttribute('aria-hidden', 'false');
    }
    if (textEl) textEl.textContent = text;
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
    }
}

function showError(message) {
    const toast = document.getElementById('errorToast');
    const messageEl = document.getElementById('errorMessage');

    if (toast && messageEl) {
        messageEl.textContent = message;
        toast.classList.remove('hidden');

        setTimeout(() => {
            toast.classList.add('hidden');
        }, 5000);
    }
}
