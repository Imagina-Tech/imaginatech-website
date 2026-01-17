/*
==================================================
ARQUIVO: marketplace/js/marketplace-ml-form.js
MODULO: Formulario ML - Categorias, Fotos, Atributos
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 1.0
==================================================
*/

// URL base das Cloud Functions
const ML_API_URL = 'https://us-central1-imaginatech-servicos.cloudfunctions.net';

// Estado do formulario ML
let mlFormState = {
    selectedCategory: null,
    categoryPath: [],
    photos: [],
    attributes: {},
    searchTimeout: null
};

// ========== INICIALIZACAO ==========
document.addEventListener('DOMContentLoaded', () => {
    setupCategorySearch();
    setupPhotoUpload();
    setupDimensionsCalculator();
});

// ========== BUSCA DE CATEGORIAS ==========
function setupCategorySearch() {
    const searchInput = document.getElementById('mlCategorySearch');
    const resultsContainer = document.getElementById('mlCategoryResults');

    if (!searchInput) return;

    // Busca com debounce
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();

        clearTimeout(mlFormState.searchTimeout);

        if (query.length < 2) {
            resultsContainer.classList.remove('active');
            return;
        }

        mlFormState.searchTimeout = setTimeout(() => {
            searchCategories(query);
        }, 300);
    });

    // Fechar resultados ao clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.ml-category-picker')) {
            resultsContainer.classList.remove('active');
        }
    });

    // Navegar com teclado
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            resultsContainer.classList.remove('active');
        }
    });
}

// Buscar categorias na API
async function searchCategories(query) {
    const resultsContainer = document.getElementById('mlCategoryResults');

    resultsContainer.innerHTML = '<div class="ml-attributes-loading"><div class="loading-spinner"></div> Buscando...</div>';
    resultsContainer.classList.add('active');

    try {
        const response = await fetch(`${ML_API_URL}/mlSearchCategories?q=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.categories && data.categories.length > 0) {
            resultsContainer.innerHTML = data.categories.map(cat => `
                <div class="ml-category-item" onclick="selectCategory('${cat.id}', '${escapeHtmlAttr(cat.name)}', '${escapeHtmlAttr(cat.domain || '')}')">
                    <div class="category-name">${escapeHtml(cat.name)}</div>
                    ${cat.domain ? `<div class="category-path">${escapeHtml(cat.domain)}</div>` : ''}
                    <div class="category-id">${cat.id}</div>
                </div>
            `).join('');
        } else {
            resultsContainer.innerHTML = '<div class="ml-attributes-placeholder"><span>Nenhuma categoria encontrada</span></div>';
        }
    } catch (error) {
        console.error('Erro ao buscar categorias:', error);
        resultsContainer.innerHTML = '<div class="ml-attributes-placeholder"><span>Erro ao buscar categorias</span></div>';
    }
}

// Selecionar categoria
async function selectCategory(categoryId, categoryName, domain) {
    const resultsContainer = document.getElementById('mlCategoryResults');
    const selectedContainer = document.getElementById('mlCategorySelected');
    const breadcrumbContainer = document.getElementById('mlCategoryBreadcrumb');
    const hiddenInput = document.getElementById('mlCategoryId');
    const searchInput = document.getElementById('mlCategorySearch');

    // Atualizar estado
    mlFormState.selectedCategory = { id: categoryId, name: categoryName };

    // Atualizar UI
    resultsContainer.classList.remove('active');
    searchInput.value = '';

    selectedContainer.classList.add('has-category');
    selectedContainer.innerHTML = `
        <div class="ml-selected-icon">
            <i class="fas fa-folder-open"></i>
        </div>
        <div class="ml-selected-info">
            <span class="ml-selected-label">${escapeHtml(categoryName)}</span>
            <span class="ml-selected-hint">${categoryId}</span>
        </div>
        <button type="button" class="btn-clear-category" onclick="clearSelectedCategory()">
            <i class="fas fa-times"></i>
        </button>
    `;

    hiddenInput.value = categoryId;

    // Buscar path da categoria e atributos
    await loadCategoryDetails(categoryId);
}

// Carregar detalhes da categoria (path e atributos)
async function loadCategoryDetails(categoryId) {
    const breadcrumbContainer = document.getElementById('mlCategoryBreadcrumb');
    const attributesContainer = document.getElementById('mlAttributesContainer');

    // Mostrar loading nos atributos
    attributesContainer.innerHTML = '<div class="ml-attributes-loading"><div class="loading-spinner"></div> Carregando atributos...</div>';

    try {
        // Buscar subcategorias (para pegar o path)
        const subResponse = await fetch(`${ML_API_URL}/mlSubcategories?id=${categoryId}`);
        const subData = await subResponse.json();

        // Mostrar breadcrumb
        if (subData.category && subData.category.pathFromRoot) {
            mlFormState.categoryPath = subData.category.pathFromRoot;
            breadcrumbContainer.innerHTML = subData.category.pathFromRoot.map(p => `<span>${escapeHtml(p.name)}</span>`).join('');
        }

        // Se tem subcategorias, mostrar aviso
        if (subData.hasChildren) {
            const selectedContainer = document.getElementById('mlCategorySelected');
            selectedContainer.innerHTML += `
                <span style="font-size:0.8rem;color:var(--neon-orange);margin-left:10px;">
                    <i class="fas fa-exclamation-triangle"></i> Categoria tem subcategorias
                </span>
            `;
        }

        // Buscar atributos
        const attrResponse = await fetch(`${ML_API_URL}/mlCategoryAttributes?id=${categoryId}`);
        const attrData = await attrResponse.json();

        renderAttributes(attrData);

    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        attributesContainer.innerHTML = '<div class="ml-attributes-placeholder"><i class="fas fa-exclamation-circle"></i><span>Erro ao carregar atributos</span></div>';
    }
}

// Renderizar atributos
function renderAttributes(data) {
    const container = document.getElementById('mlAttributesContainer');

    if (!data.required || data.required.length === 0) {
        if (!data.recommended || data.recommended.length === 0) {
            container.innerHTML = '<div class="ml-attributes-placeholder"><i class="fas fa-check-circle" style="color:var(--neon-green)"></i><span>Nenhum atributo obrigatorio para esta categoria</span></div>';
            return;
        }
    }

    let html = '';

    if (data.required && data.required.length > 0) {
        html += '<h4 style="margin:0 0 15px;font-size:0.9rem;color:#FFE600;"><i class="fas fa-asterisk"></i> Atributos Obrigatorios</h4>';
        html += '<div class="ml-attributes-grid">';
        html += data.required.map(attr => renderAttributeField(attr, true)).join('');
        html += '</div>';
    }

    if (data.recommended && data.recommended.length > 0) {
        html += '<h4 style="margin:20px 0 15px;font-size:0.9rem;color:var(--text-secondary);"><i class="fas fa-thumbs-up"></i> Atributos Recomendados</h4>';
        html += '<div class="ml-attributes-grid">';
        html += data.recommended.map(attr => renderAttributeField(attr, false)).join('');
        html += '</div>';
    }

    container.innerHTML = html;
}

// Renderizar campo de atributo
// NOTA: Nao usar 'required' HTML pois causa erro de foco em campos dinamicos
// A validacao e feita via JavaScript no submit
function renderAttributeField(attr, required) {
    const fieldId = `mlAttr_${attr.id}`;
    let inputHtml = '';

    // Marcar como obrigatorio via data-attribute para validacao JS
    const requiredAttr = required ? 'data-ml-required="true"' : '';

    if (attr.values && attr.values.length > 0) {
        // Dropdown com opcoes predefinidas (usa value_id)
        inputHtml = `
            <select id="${fieldId}" name="${fieldId}" data-attr-id="${attr.id}" data-has-values="true" ${requiredAttr}>
                <option value="">Selecione...</option>
                ${attr.values.map(v => `<option value="${v.id}">${escapeHtml(v.name)}</option>`).join('')}
            </select>
        `;
    } else if (attr.type === 'number' || attr.type === 'number_unit') {
        // Input numerico
        inputHtml = `<input type="number" id="${fieldId}" name="${fieldId}" data-attr-id="${attr.id}" placeholder="${attr.hint || ''}" ${requiredAttr}>`;
    } else if (attr.type === 'boolean') {
        // Checkbox
        inputHtml = `
            <select id="${fieldId}" name="${fieldId}" data-attr-id="${attr.id}">
                <option value="">Selecione...</option>
                <option value="true">Sim</option>
                <option value="false">Nao</option>
            </select>
        `;
    } else {
        // Input texto
        inputHtml = `<input type="text" id="${fieldId}" name="${fieldId}" data-attr-id="${attr.id}" placeholder="${attr.hint || ''}" ${requiredAttr}>`;
    }

    return `
        <div class="ml-attribute-field" ${required ? 'data-required="true"' : ''}>
            <label for="${fieldId}">
                ${escapeHtml(attr.name)}
                ${required ? '<span class="required">*</span>' : ''}
            </label>
            ${inputHtml}
        </div>
    `;
}

// Limpar categoria selecionada
function clearSelectedCategory() {
    const selectedContainer = document.getElementById('mlCategorySelected');
    const breadcrumbContainer = document.getElementById('mlCategoryBreadcrumb');
    const hiddenInput = document.getElementById('mlCategoryId');
    const attributesContainer = document.getElementById('mlAttributesContainer');

    mlFormState.selectedCategory = null;
    mlFormState.categoryPath = [];

    selectedContainer.classList.remove('has-category');
    selectedContainer.innerHTML = `
        <div class="ml-selected-icon">
            <i class="fas fa-folder"></i>
        </div>
        <div class="ml-selected-info">
            <span class="ml-selected-label">Nenhuma categoria selecionada</span>
            <span class="ml-selected-hint">Use a busca acima ou clique em "Sugerir"</span>
        </div>
    `;
    breadcrumbContainer.innerHTML = '';
    hiddenInput.value = '';
    attributesContainer.innerHTML = `
        <div class="ml-attributes-placeholder">
            <i class="fas fa-list-check"></i>
            <span>Selecione uma categoria para carregar os atributos</span>
            <small>Os campos obrigatorios serao exibidos aqui</small>
        </div>
    `;
}

// Predizer categoria baseado no titulo
async function predictCategoryFromTitle() {
    const titleInput = document.getElementById('productName');
    const title = titleInput ? titleInput.value.trim() : '';

    if (!title || title.length < 3) {
        window.showToast('Digite o nome do produto primeiro', 'warning');
        return;
    }

    const resultsContainer = document.getElementById('mlCategoryResults');
    resultsContainer.innerHTML = '<div class="ml-attributes-loading"><div class="loading-spinner"></div> Analisando titulo...</div>';
    resultsContainer.classList.add('active');

    try {
        const response = await fetch(`${ML_API_URL}/mlPredictCategory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title })
        });

        const data = await response.json();

        if (data.predictions && data.predictions.length > 0) {
            resultsContainer.innerHTML = `
                <div style="padding:10px 15px;border-bottom:1px solid var(--glass-border);color:var(--text-muted);font-size:0.85rem;">
                    <i class="fas fa-magic"></i> Categorias sugeridas para "${escapeHtml(title)}"
                </div>
                ${data.predictions.map(pred => `
                    <div class="ml-category-item" onclick="selectCategory('${pred.categoryId}', '${escapeHtmlAttr(pred.categoryName)}', '${escapeHtmlAttr(pred.domainName || '')}')">
                        <div class="category-name">${escapeHtml(pred.categoryName)}</div>
                        ${pred.domainName ? `<div class="category-path">${escapeHtml(pred.domainName)}</div>` : ''}
                        <div class="category-id">${pred.categoryId}</div>
                    </div>
                `).join('')}
            `;
        } else {
            resultsContainer.innerHTML = '<div class="ml-attributes-placeholder"><span>Nenhuma sugestao encontrada</span></div>';
        }
    } catch (error) {
        console.error('Erro ao predizer categoria:', error);
        resultsContainer.innerHTML = '<div class="ml-attributes-placeholder"><span>Erro ao analisar titulo</span></div>';
    }
}

// ========== UPLOAD DE FOTOS ==========
function setupPhotoUpload() {
    const dropzone = document.getElementById('mlPhotosDropzone');
    const fileInput = document.getElementById('mlPhotosInput');

    if (!dropzone || !fileInput) return;

    // Click para selecionar
    dropzone.addEventListener('click', () => fileInput.click());

    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');

        const files = e.dataTransfer.files;
        handleFiles(files);
    });

    // Selecao de arquivos
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
}

// Processar arquivos selecionados
function handleFiles(files) {
    const maxFiles = 10;
    const maxSize = 5 * 1024 * 1024; // 5MB

    for (const file of files) {
        if (mlFormState.photos.length >= maxFiles) {
            window.showToast(`Maximo de ${maxFiles} fotos permitido`, 'warning');
            break;
        }

        if (!file.type.match(/image\/(jpeg|png|webp)/)) {
            window.showToast(`Formato nao suportado: ${file.name}`, 'error');
            continue;
        }

        if (file.size > maxSize) {
            window.showToast(`Arquivo muito grande: ${file.name}`, 'error');
            continue;
        }

        // Ler arquivo e criar preview
        const reader = new FileReader();
        reader.onload = (e) => {
            addPhoto({
                type: 'file',
                data: e.target.result,
                name: file.name,
                file: file
            });
        };
        reader.readAsDataURL(file);
    }
}

// Adicionar foto de URL
function addPhotoFromUrl() {
    const urlInput = document.getElementById('mlPhotoUrlInput');
    const url = urlInput.value.trim();

    if (!url) {
        window.showToast('Digite uma URL', 'warning');
        return;
    }

    if (!url.match(/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i)) {
        window.showToast('URL deve terminar com .jpg, .png ou .webp', 'warning');
        return;
    }

    if (mlFormState.photos.length >= 10) {
        window.showToast('Maximo de 10 fotos permitido', 'warning');
        return;
    }

    addPhoto({
        type: 'url',
        data: url,
        name: url.split('/').pop().split('?')[0]
    });

    urlInput.value = '';
}

// Adicionar foto ao estado
function addPhoto(photo) {
    photo.id = 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    mlFormState.photos.push(photo);
    renderPhotosList();
    updatePhotosHiddenInput();
}

// Remover foto
function removePhoto(photoId) {
    mlFormState.photos = mlFormState.photos.filter(p => p.id !== photoId);
    renderPhotosList();
    updatePhotosHiddenInput();
}

// Renderizar lista de fotos
function renderPhotosList() {
    const container = document.getElementById('mlPhotosList');

    if (mlFormState.photos.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = mlFormState.photos.map((photo, index) => `
        <div class="ml-photo-item ${index === 0 ? 'main-photo' : ''}"
             data-photo-id="${photo.id}"
             draggable="true"
             ondragstart="handlePhotoDragStart(event)"
             ondragover="handlePhotoDragOver(event)"
             ondrop="handlePhotoDrop(event)"
             ondragend="handlePhotoDragEnd(event)">
            <img src="${photo.data}" alt="${escapeHtml(photo.name)}">
            <span class="photo-order">${index + 1}</span>
            <div class="photo-actions">
                <button type="button" class="btn-remove-photo" onclick="removePhoto('${photo.id}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Atualizar input hidden com URLs das fotos
function updatePhotosHiddenInput() {
    const hiddenInput = document.getElementById('productPhotos');
    const urls = mlFormState.photos
        .filter(p => p.type === 'url')
        .map(p => p.data);

    // Para fotos de arquivo, precisamos fazer upload primeiro
    // Por enquanto, salvamos apenas URLs
    hiddenInput.value = urls.join(', ');
}

// ========== DRAG AND DROP FOTOS ==========
let draggedPhotoId = null;

function handlePhotoDragStart(e) {
    draggedPhotoId = e.target.closest('.ml-photo-item').dataset.photoId;
    e.target.closest('.ml-photo-item').classList.add('dragging');
}

function handlePhotoDragOver(e) {
    e.preventDefault();
    const item = e.target.closest('.ml-photo-item');
    if (item && item.dataset.photoId !== draggedPhotoId) {
        item.classList.add('drag-over');
    }
}

function handlePhotoDrop(e) {
    e.preventDefault();
    const targetItem = e.target.closest('.ml-photo-item');
    if (!targetItem || targetItem.dataset.photoId === draggedPhotoId) return;

    const targetId = targetItem.dataset.photoId;

    // Reordenar array
    const draggedIndex = mlFormState.photos.findIndex(p => p.id === draggedPhotoId);
    const targetIndex = mlFormState.photos.findIndex(p => p.id === targetId);

    const [draggedPhoto] = mlFormState.photos.splice(draggedIndex, 1);
    mlFormState.photos.splice(targetIndex, 0, draggedPhoto);

    renderPhotosList();
    updatePhotosHiddenInput();
}

function handlePhotoDragEnd(e) {
    document.querySelectorAll('.ml-photo-item').forEach(item => {
        item.classList.remove('dragging', 'drag-over');
    });
    draggedPhotoId = null;
}

// ========== CALCULADORA DE DIMENSOES PARA FRETE ==========
function setupDimensionsCalculator() {
    const fields = ['packLength', 'packWidth', 'packHeight', 'packWeight'];

    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', calculateShippingWeight);
        }
    });
}

// Calcular peso cubado e peso para frete
function calculateShippingWeight() {
    const length = parseFloat(document.getElementById('packLength')?.value) || 0;
    const width = parseFloat(document.getElementById('packWidth')?.value) || 0;
    const height = parseFloat(document.getElementById('packHeight')?.value) || 0;
    const weight = parseFloat(document.getElementById('packWeight')?.value) || 0;

    const cubicWeightEl = document.getElementById('mlCubicWeight');
    const shippingWeightEl = document.getElementById('mlShippingWeight');

    if (!cubicWeightEl || !shippingWeightEl) return;

    // Se nao tem dimensoes, mostrar "--"
    if (length === 0 || width === 0 || height === 0) {
        cubicWeightEl.textContent = '--';
        shippingWeightEl.textContent = '--';
        return;
    }

    // Peso cubado (formula do Mercado Livre: C x L x A / 6000 em cm)
    // Resultado em kg
    const cubicWeight = (length * width * height) / 6000;

    // Peso real em kg
    const realWeightKg = weight / 1000;

    // Peso para frete = maior entre peso real e peso cubado
    const shippingWeight = Math.max(cubicWeight, realWeightKg);

    // Exibir valores
    cubicWeightEl.textContent = cubicWeight.toFixed(3) + ' kg';

    if (weight > 0) {
        const usedWeight = shippingWeight === cubicWeight ? 'cubado' : 'real';
        shippingWeightEl.textContent = shippingWeight.toFixed(3) + ' kg (' + usedWeight + ')';
    } else {
        shippingWeightEl.textContent = cubicWeight.toFixed(3) + ' kg (cubado)';
    }
}

// ========== HELPERS ==========
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeHtmlAttr(text) {
    if (!text) return '';
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"');
}

// Coletar atributos do formulario
function collectMlAttributes() {
    const attributes = [];
    document.querySelectorAll('[data-attr-id]').forEach(input => {
        const value = input.value.trim();
        if (value) {
            // Se tem valores predefinidos (select), usa value_id
            // Senao (input texto), usa value_name
            const hasValues = input.dataset.hasValues === 'true';
            if (hasValues) {
                attributes.push({
                    id: input.dataset.attrId,
                    value_id: value
                });
            } else {
                attributes.push({
                    id: input.dataset.attrId,
                    value_name: value
                });
            }
        }
    });
    return attributes;
}

// Popular formulario com dados existentes
function populateMlFormWithProduct(product) {
    console.log('[ML-FORM] Populando dados ML:', {
        mlCategoryId: product.mlCategoryId,
        mlCategoryName: product.mlCategoryName,
        photos: product.photos,
        mlAttributes: product.mlAttributes
    });

    // ========== CATEGORIA ML ==========
    if (product.mlCategoryId) {
        const categoryName = product.mlCategoryName || 'Categoria ' + product.mlCategoryId;
        console.log('[ML-FORM] Selecionando categoria:', product.mlCategoryId, categoryName);

        // Popular categoria diretamente sem chamar API
        const selectedContainer = document.getElementById('mlCategorySelected');
        const hiddenInput = document.getElementById('mlCategoryId');

        if (selectedContainer && hiddenInput) {
            mlFormState.selectedCategory = { id: product.mlCategoryId, name: categoryName };

            selectedContainer.classList.add('has-category');
            selectedContainer.innerHTML = `
                <div class="ml-selected-icon">
                    <i class="fas fa-folder-open"></i>
                </div>
                <div class="ml-selected-info">
                    <span class="ml-selected-label">${escapeHtml(categoryName)}</span>
                    <span class="ml-selected-hint">${product.mlCategoryId}</span>
                </div>
                <button type="button" class="btn-clear-category" onclick="clearSelectedCategory()">
                    <i class="fas fa-times"></i>
                </button>
            `;

            hiddenInput.value = product.mlCategoryId;
            console.log('[ML-FORM] Categoria definida com sucesso');

            // Carregar atributos da categoria
            loadCategoryDetails(product.mlCategoryId);
        }
    }

    // ========== FOTOS ==========
    mlFormState.photos = [];
    console.log('[ML-FORM] Fotos do produto:', product.photos);

    if (product.photos && Array.isArray(product.photos) && product.photos.length > 0) {
        product.photos.forEach((url, index) => {
            if (url && typeof url === 'string' && url.trim()) {
                console.log(`[ML-FORM] Adicionando foto ${index + 1}:`, url);
                const photoId = 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                mlFormState.photos.push({
                    id: photoId,
                    type: 'url',
                    data: url.trim(),
                    name: url.split('/').pop().split('?')[0] || 'foto'
                });
            }
        });

        // Renderizar fotos
        renderPhotosList();
        updatePhotosHiddenInput();
        console.log('[ML-FORM] Total de fotos carregadas:', mlFormState.photos.length);
    } else {
        renderPhotosList();
        console.log('[ML-FORM] Nenhuma foto para carregar');
    }

    // ========== ATRIBUTOS ML ==========
    if (product.mlAttributes && Array.isArray(product.mlAttributes) && product.mlAttributes.length > 0) {
        // Esperar atributos serem carregados pela API antes de popular
        setTimeout(() => {
            console.log('[ML-FORM] Populando atributos:', product.mlAttributes);
            product.mlAttributes.forEach(attr => {
                const input = document.querySelector(`[data-attr-id="${attr.id}"]`);
                if (input) {
                    input.value = attr.value_name || attr.value_id || '';
                    console.log(`[ML-FORM] Atributo ${attr.id} = "${input.value}"`);
                }
            });
        }, 800); // Tempo maior para garantir que atributos foram carregados
    }
}

// Resetar formulario ML
function resetMlForm() {
    clearSelectedCategory();
    mlFormState.photos = [];
    renderPhotosList();

    // Reset campos
    const fields = [
        'productPhotos', 'productPrice', 'mlPhotoUrlInput', 'mlCategorySearch',
        'mlQuantity', 'mlShippingMode', 'mlFreeShipping', 'mlLocalPickup',
        'mlShippingDays', 'mlWarrantyType', 'mlWarrantyDays',
        'dimLength', 'dimWidth', 'dimHeight', 'productWeight',
        'packLength', 'packWidth', 'packHeight', 'packWeight'
    ];

    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'SELECT') {
                el.selectedIndex = 0;
            } else {
                el.value = '';
            }
        }
    });

    // Reset quantidade para 1
    const qtyField = document.getElementById('mlQuantity');
    if (qtyField) qtyField.value = '1';

    // Reset preview de dimensoes
    const cubicWeightEl = document.getElementById('mlCubicWeight');
    const shippingWeightEl = document.getElementById('mlShippingWeight');
    if (cubicWeightEl) cubicWeightEl.textContent = '--';
    if (shippingWeightEl) shippingWeightEl.textContent = '--';

    // Reset video
    const videoInput = document.getElementById('mlVideoUrl');
    const videoPreview = document.getElementById('mlVideoPreview');
    if (videoInput) videoInput.value = '';
    if (videoPreview) {
        videoPreview.classList.remove('has-video');
        videoPreview.innerHTML = `
            <div class="video-preview-placeholder">
                <i class="fas fa-film"></i>
                <span>Preview do video aparecera aqui</span>
            </div>
        `;
    }

    // Reset variacoes
    resetVariations();
}

// ========== VIDEO DO YOUTUBE ==========
function extractYouTubeId(url) {
    if (!url) return null;

    // Formatos suportados:
    // https://www.youtube.com/watch?v=VIDEO_ID
    // https://youtu.be/VIDEO_ID
    // https://www.youtube.com/embed/VIDEO_ID

    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            return match[1];
        }
    }

    return null;
}

function previewVideo() {
    const urlInput = document.getElementById('mlVideoUrl');
    const previewContainer = document.getElementById('mlVideoPreview');
    const hiddenInput = document.getElementById('productVideo');

    if (!urlInput || !previewContainer) return;

    const url = urlInput.value.trim();

    if (!url) {
        window.showToast('Digite a URL do video do YouTube', 'warning');
        return;
    }

    const videoId = extractYouTubeId(url);

    if (!videoId) {
        window.showToast('URL do YouTube invalida. Use o formato: youtube.com/watch?v=...', 'error');
        return;
    }

    // Montar URL do embed
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;

    // Atualizar preview
    previewContainer.classList.add('has-video');
    previewContainer.style.position = 'relative';
    previewContainer.innerHTML = `
        <iframe
            src="${embedUrl}"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen>
        </iframe>
        <button type="button" class="ml-video-remove" onclick="removeVideo()" title="Remover video">
            <i class="fas fa-times"></i>
        </button>
    `;

    // Salvar no hidden input
    if (hiddenInput) {
        hiddenInput.value = `https://www.youtube.com/watch?v=${videoId}`;
    }

    window.showToast('Video carregado!', 'success');
}

function removeVideo() {
    const urlInput = document.getElementById('mlVideoUrl');
    const previewContainer = document.getElementById('mlVideoPreview');
    const hiddenInput = document.getElementById('productVideo');

    if (urlInput) urlInput.value = '';
    if (hiddenInput) hiddenInput.value = '';

    if (previewContainer) {
        previewContainer.classList.remove('has-video');
        previewContainer.style.position = '';
        previewContainer.innerHTML = `
            <div class="video-preview-placeholder">
                <i class="fas fa-film"></i>
                <span>Preview do video aparecera aqui</span>
            </div>
        `;
    }

    window.showToast('Video removido', 'info');
}

function setVideoUrl(url) {
    const urlInput = document.getElementById('mlVideoUrl');
    if (urlInput && url) {
        urlInput.value = url;
        // Disparar preview automaticamente
        previewVideo();
    }
}

// ========== VARIACOES DO PRODUTO ==========
// Cores padrao do Mercado Livre
const ML_COLORS = [
    { id: '52049', name: 'Preto', hex: '#000000' },
    { id: '52007', name: 'Branco', hex: '#FFFFFF' },
    { id: '52051', name: 'Cinza', hex: '#808080' },
    { id: '52014', name: 'Vermelho', hex: '#FF0000' },
    { id: '52005', name: 'Azul', hex: '#0000FF' },
    { id: '52010', name: 'Verde', hex: '#00FF00' },
    { id: '52003', name: 'Amarelo', hex: '#FFFF00' },
    { id: '52028', name: 'Laranja', hex: '#FFA500' },
    { id: '52012', name: 'Rosa', hex: '#FFC0CB' },
    { id: '52013', name: 'Roxo', hex: '#800080' },
    { id: '52008', name: 'Marrom', hex: '#8B4513' },
    { id: '52019', name: 'Bege', hex: '#F5F5DC' },
    { id: '283164', name: 'Dourado', hex: '#FFD700' },
    { id: '52055', name: 'Prata', hex: '#C0C0C0' },
    { id: '51993', name: 'Azul-marinho', hex: '#000080' },
    { id: '51994', name: 'Azul-claro', hex: '#ADD8E6' },
    { id: '52000', name: 'Verde-escuro', hex: '#006400' },
    { id: '51998', name: 'Verde-claro', hex: '#90EE90' },
    { id: '52053', name: 'Transparente', hex: 'transparent' }
];

// Estado das variacoes
let variationsState = {
    enabled: false,
    type: 'COLOR',
    items: []
};

// Inicializar com uma variacao
function initVariations() {
    variationsState.items = [];
    renderVariationsList();
}

// Toggle variacoes
function toggleVariations() {
    const checkbox = document.getElementById('mlEnableVariations');
    const content = document.getElementById('mlVariationsContent');

    variationsState.enabled = checkbox?.checked || false;

    if (variationsState.enabled) {
        content?.classList.remove('hidden');
        if (variationsState.items.length === 0) {
            addVariation(); // Adicionar primeira variacao
        }
    } else {
        content?.classList.add('hidden');
        variationsState.items = [];
        renderVariationsList();
    }

    updateVariationsHidden();
}

// Atualizar campos baseado no tipo de variacao
function updateVariationFields() {
    const typeSelect = document.getElementById('mlVariationType');
    variationsState.type = typeSelect?.value || 'COLOR';

    // Re-renderizar lista com novo tipo
    renderVariationsList();
}

// Adicionar nova variacao
function addVariation() {
    const newVariation = {
        id: Date.now(),
        color: '',
        colorId: '',
        size: '',
        quantity: 1,
        price: ''
    };

    variationsState.items.push(newVariation);
    renderVariationsList();
}

// Remover variacao
function removeVariation(variationId) {
    variationsState.items = variationsState.items.filter(v => v.id !== variationId);
    renderVariationsList();
    updateVariationsHidden();
}

// Renderizar lista de variacoes
function renderVariationsList() {
    const container = document.getElementById('mlVariationsList');
    if (!container) return;

    if (variationsState.items.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">Nenhuma variacao adicionada</p>';
        return;
    }

    const type = variationsState.type;
    let gridClass = '';

    if (type === 'COLOR') gridClass = 'color-only';
    else if (type === 'SIZE') gridClass = 'size-only';

    container.innerHTML = variationsState.items.map((v, index) => `
        <div class="ml-variation-item ${gridClass}" data-variation-id="${v.id}">
            ${type === 'COLOR' || type === 'COLOR_SIZE' ? `
                <div class="ml-variation-field">
                    <label>Cor</label>
                    <select onchange="updateVariationColor(${v.id}, this.value)">
                        <option value="">Selecione a cor...</option>
                        ${ML_COLORS.map(c => `
                            <option value="${c.id}" ${v.colorId === c.id ? 'selected' : ''} data-hex="${c.hex}">
                                ${c.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
            ` : ''}
            ${type === 'SIZE' || type === 'COLOR_SIZE' ? `
                <div class="ml-variation-field">
                    <label>Tamanho</label>
                    <input type="text" value="${escapeHtml(v.size || '')}" placeholder="Ex: P, M, G, GG"
                           onchange="updateVariationSize(${v.id}, this.value)">
                </div>
            ` : ''}
            <div class="ml-variation-field">
                <label>Qtd.</label>
                <input type="number" min="1" value="${v.quantity || 1}"
                       onchange="updateVariationQuantity(${v.id}, this.value)">
            </div>
            <div class="ml-variation-field">
                <label>Preco (R$)</label>
                <input type="number" min="0" step="0.01" value="${v.price || ''}" placeholder="Padrao"
                       onchange="updateVariationPrice(${v.id}, this.value)">
            </div>
            <button type="button" class="btn-remove-variation" onclick="removeVariation(${v.id})" title="Remover">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `).join('');
}

// Atualizar cor da variacao
function updateVariationColor(variationId, colorId) {
    const variation = variationsState.items.find(v => v.id === variationId);
    if (variation) {
        variation.colorId = colorId;
        const color = ML_COLORS.find(c => c.id === colorId);
        variation.color = color ? color.name : '';
    }
    updateVariationsHidden();
}

// Atualizar tamanho da variacao
function updateVariationSize(variationId, size) {
    const variation = variationsState.items.find(v => v.id === variationId);
    if (variation) {
        variation.size = size;
    }
    updateVariationsHidden();
}

// Atualizar quantidade da variacao
function updateVariationQuantity(variationId, quantity) {
    const variation = variationsState.items.find(v => v.id === variationId);
    if (variation) {
        variation.quantity = parseInt(quantity) || 1;
    }
    updateVariationsHidden();
}

// Atualizar preco da variacao
function updateVariationPrice(variationId, price) {
    const variation = variationsState.items.find(v => v.id === variationId);
    if (variation) {
        variation.price = price ? parseFloat(price) : '';
    }
    updateVariationsHidden();
}

// Atualizar campo hidden com dados das variacoes
function updateVariationsHidden() {
    const hidden = document.getElementById('productVariations');
    if (hidden) {
        if (variationsState.enabled && variationsState.items.length > 0) {
            hidden.value = JSON.stringify({
                enabled: true,
                type: variationsState.type,
                items: variationsState.items
            });
        } else {
            hidden.value = '';
        }
    }
}

// Coletar variacoes para salvar
function collectVariations() {
    if (!variationsState.enabled || variationsState.items.length === 0) {
        return null;
    }

    return {
        type: variationsState.type,
        items: variationsState.items.map(v => ({
            colorId: v.colorId || null,
            colorName: v.color || null,
            size: v.size || null,
            quantity: v.quantity || 1,
            price: v.price || null
        })).filter(v => v.colorId || v.size) // Filtrar variacoes vazias
    };
}

// Carregar variacoes do produto
function loadVariations(productVariations) {
    if (!productVariations || !productVariations.enabled) {
        variationsState.enabled = false;
        variationsState.items = [];

        const checkbox = document.getElementById('mlEnableVariations');
        const content = document.getElementById('mlVariationsContent');

        if (checkbox) checkbox.checked = false;
        if (content) content.classList.add('hidden');

        return;
    }

    variationsState.enabled = true;
    variationsState.type = productVariations.type || 'COLOR';
    variationsState.items = (productVariations.items || []).map((item, index) => ({
        id: Date.now() + index,
        colorId: item.colorId || '',
        color: item.colorName || '',
        size: item.size || '',
        quantity: item.quantity || 1,
        price: item.price || ''
    }));

    const checkbox = document.getElementById('mlEnableVariations');
    const content = document.getElementById('mlVariationsContent');
    const typeSelect = document.getElementById('mlVariationType');

    if (checkbox) checkbox.checked = true;
    if (content) content.classList.remove('hidden');
    if (typeSelect) typeSelect.value = variationsState.type;

    renderVariationsList();
}

// Reset variacoes
function resetVariations() {
    variationsState = {
        enabled: false,
        type: 'COLOR',
        items: []
    };

    const checkbox = document.getElementById('mlEnableVariations');
    const content = document.getElementById('mlVariationsContent');
    const typeSelect = document.getElementById('mlVariationType');
    const hidden = document.getElementById('productVariations');

    if (checkbox) checkbox.checked = false;
    if (content) content.classList.add('hidden');
    if (typeSelect) typeSelect.value = 'COLOR';
    if (hidden) hidden.value = '';

    renderVariationsList();
}

// ========== EXPORTAR PARA GLOBAL ==========
window.searchCategories = searchCategories;
window.selectCategory = selectCategory;
window.clearSelectedCategory = clearSelectedCategory;
window.predictCategoryFromTitle = predictCategoryFromTitle;
window.addPhotoFromUrl = addPhotoFromUrl;
window.removePhoto = removePhoto;
window.handlePhotoDragStart = handlePhotoDragStart;
window.handlePhotoDragOver = handlePhotoDragOver;
window.handlePhotoDrop = handlePhotoDrop;
window.handlePhotoDragEnd = handlePhotoDragEnd;
window.collectMlAttributes = collectMlAttributes;
window.populateMlFormWithProduct = populateMlFormWithProduct;
window.resetMlForm = resetMlForm;
window.mlFormState = mlFormState;
window.calculateShippingWeight = calculateShippingWeight;
window.previewVideo = previewVideo;
window.removeVideo = removeVideo;
window.setVideoUrl = setVideoUrl;
window.extractYouTubeId = extractYouTubeId;
window.toggleVariations = toggleVariations;
window.updateVariationFields = updateVariationFields;
window.addVariation = addVariation;
window.removeVariation = removeVariation;
window.updateVariationColor = updateVariationColor;
window.updateVariationSize = updateVariationSize;
window.updateVariationQuantity = updateVariationQuantity;
window.updateVariationPrice = updateVariationPrice;
window.collectVariations = collectVariations;
window.loadVariations = loadVariations;
window.resetVariations = resetVariations;
window.variationsState = variationsState;
