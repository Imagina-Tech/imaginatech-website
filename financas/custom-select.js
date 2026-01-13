/*
==================================================
ARQUIVO: financas/custom-select.js
MODULO: Dropdown Customizado com Icones e Navegacao por Teclado
SISTEMA: ImaginaTech - Gestao Financeira
VERSAO: 1.0
==================================================
*/

class CustomSelect {
    constructor(selectElement) {
        this.selectElement = selectElement;
        this.selectedIndex = selectElement.selectedIndex;
        this.isOpen = false;
        this.searchBuffer = '';
        this.searchTimeout = null;
        this.highlightedIndex = -1;
        this.init();
    }

    init() {
        // Criar estrutura customizada
        this.createCustomSelect();
        this.bindEvents();

        // Esconder select original
        this.selectElement.style.display = 'none';

        // Adicionar apos o select original
        this.selectElement.parentNode.insertBefore(this.customSelect, this.selectElement.nextSibling);

        // Sincronizar valor inicial
        this.updateSelected();
    }

    createCustomSelect() {
        // Container principal
        this.customSelect = document.createElement('div');
        this.customSelect.className = 'custom-select';
        this.customSelect.setAttribute('tabindex', '0');

        // Trigger (botao que abre/fecha)
        this.trigger = document.createElement('div');
        this.trigger.className = 'custom-select-trigger';
        this.trigger.innerHTML = `
            <span class="custom-select-value">Selecione...</span>
            <svg class="custom-select-arrow" viewBox="0 0 10 6" fill="none">
                <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;

        // Lista de opcoes
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'custom-select-dropdown';

        // Criar opcoes
        this.createOptions();

        this.customSelect.appendChild(this.trigger);
        this.customSelect.appendChild(this.dropdown);
    }

    createOptions() {
        this.dropdown.innerHTML = '';
        const options = Array.from(this.selectElement.options);

        options.forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.className = 'custom-select-option';
            optionElement.dataset.value = option.value;
            optionElement.dataset.index = index;

            // Verificar se tem icone no dataset
            const icon = option.dataset.icon;
            if (icon) {
                optionElement.innerHTML = `
                    <i class="fas ${icon} option-icon"></i>
                    <span class="option-text">${option.textContent}</span>
                `;
            } else {
                optionElement.innerHTML = `<span class="option-text">${option.textContent}</span>`;
            }

            if (option.disabled) {
                optionElement.classList.add('disabled');
            }

            if (option.selected) {
                optionElement.classList.add('selected');
            }

            this.dropdown.appendChild(optionElement);
        });
    }

    bindEvents() {
        // Toggle dropdown (com suporte a touch)
        this.trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });

        // Prevenir double-tap zoom em iOS
        this.trigger.addEventListener('touchend', (e) => {
            e.preventDefault();
        }, { passive: false });

        // Selecionar opcao (com suporte a touch)
        this.dropdown.addEventListener('click', (e) => {
            e.preventDefault();
            const option = e.target.closest('.custom-select-option');
            if (option && !option.classList.contains('disabled')) {
                this.selectOption(parseInt(option.dataset.index));
            }
        });

        // Suporte a touch para selecao de opcoes
        this.dropdown.addEventListener('touchend', (e) => {
            e.preventDefault();
            const option = e.target.closest('.custom-select-option');
            if (option && !option.classList.contains('disabled')) {
                this.selectOption(parseInt(option.dataset.index));
            }
        }, { passive: false });

        // Fechar ao clicar/tocar fora
        const closeOnOutsideClick = (e) => {
            if (!this.customSelect.contains(e.target) && !this.dropdown.contains(e.target)) {
                this.close();
            }
        };

        document.addEventListener('click', closeOnOutsideClick);
        document.addEventListener('touchstart', closeOnOutsideClick);

        // Keyboard navigation
        this.customSelect.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (this.isOpen && this.highlightedIndex >= 0) {
                    this.selectOption(this.highlightedIndex);
                } else {
                    this.toggle();
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!this.isOpen) {
                    this.open();
                } else {
                    this.navigateOptions(1);
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.isOpen) {
                    this.navigateOptions(-1);
                }
            } else if (e.key === 'Escape') {
                this.close();
            } else if (e.key === 'Tab') {
                this.close();
            }
        });

        // Navegacao por letra - busca incremental
        this.customSelect.addEventListener('keypress', (e) => {
            const char = e.key.toLowerCase();
            if (/[a-zA-Z0-9]/.test(char)) {
                e.preventDefault();
                this.handleLetterSearch(char);
            }
        });

        // Observar mudancas no select original (para integracao com codigo existente)
        const observer = new MutationObserver(() => {
            this.updateDropdownOptions();
        });
        observer.observe(this.selectElement, { childList: true, subtree: true, attributes: true });

        // Observar mudancas de valor
        this.selectElement.addEventListener('change', () => {
            this.updateSelected();
        });
    }

    handleLetterSearch(char) {
        // Limpar timeout anterior
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // Adicionar caractere ao buffer de busca
        this.searchBuffer += char;

        // Abrir dropdown se estiver fechado
        if (!this.isOpen) {
            this.open();
        }

        // Buscar opcao que comeca com o buffer
        this.jumpToText(this.searchBuffer);

        // Limpar buffer apos 1 segundo de inatividade
        this.searchTimeout = setTimeout(() => {
            this.searchBuffer = '';
        }, 1000);
    }

    jumpToText(text) {
        const options = this.dropdown.querySelectorAll('.custom-select-option:not(.disabled)');
        const searchText = text.toLowerCase();

        for (let option of options) {
            const optionText = option.textContent.trim().toLowerCase();
            if (optionText.startsWith(searchText)) {
                const index = parseInt(option.dataset.index);
                this.highlightOption(index);
                option.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                return;
            }
        }

        // Se nao encontrou, tentar apenas com a primeira letra (reset)
        if (text.length > 1) {
            this.searchBuffer = text.charAt(text.length - 1);
            this.jumpToText(this.searchBuffer);
        }
    }

    highlightOption(index) {
        // Remover highlight anterior
        const options = this.dropdown.querySelectorAll('.custom-select-option');
        options.forEach(opt => opt.classList.remove('highlighted'));

        // Adicionar novo highlight
        const targetOption = this.dropdown.querySelector(`.custom-select-option[data-index="${index}"]`);
        if (targetOption && !targetOption.classList.contains('disabled')) {
            targetOption.classList.add('highlighted');
            this.highlightedIndex = index;
        }
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        this.isOpen = true;
        this.customSelect.classList.add('open');
        this.trigger.setAttribute('aria-expanded', 'true');

        // Posicionar dropdown com position fixed
        const triggerRect = this.trigger.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - triggerRect.bottom;
        const spaceAbove = triggerRect.top;

        // Calcular se abre para cima ou para baixo
        const dropdownHeight = 300;
        const openUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;

        // Aplicar estilos base ANTES de mover para o body (invisivel)
        this.dropdown.style.position = 'fixed';
        this.dropdown.style.width = `${triggerRect.width}px`;
        this.dropdown.style.left = `${triggerRect.left}px`;
        this.dropdown.style.zIndex = '999999';
        this.dropdown.style.pointerEvents = 'auto';
        this.dropdown.style.background = 'linear-gradient(180deg, rgba(26, 26, 46, 0.98) 0%, rgba(16, 24, 39, 0.98) 100%)';
        this.dropdown.style.backdropFilter = 'blur(15px)';
        this.dropdown.style.border = '1px solid rgba(0, 212, 255, 0.3)';
        this.dropdown.style.boxShadow = '0 10px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(0, 212, 255, 0.2)';
        this.dropdown.style.overflow = 'auto';

        // Estado inicial da animacao (invisivel e comprimido)
        this.dropdown.style.opacity = '0';
        this.dropdown.style.transformOrigin = openUp ? 'bottom center' : 'top center';
        this.dropdown.style.transform = openUp ? 'scaleY(0.8) translateY(10px)' : 'scaleY(0.8) translateY(-10px)';
        this.dropdown.style.transition = 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)';

        // Posicao vertical
        if (openUp) {
            this.dropdown.style.bottom = `${viewportHeight - triggerRect.top}px`;
            this.dropdown.style.top = 'auto';
            this.dropdown.style.maxHeight = `${Math.min(300, spaceAbove - 10)}px`;
            this.dropdown.style.borderRadius = '12px 12px 0 0';
            this.customSelect.classList.add('open-up');
        } else {
            this.dropdown.style.top = `${triggerRect.bottom}px`;
            this.dropdown.style.bottom = 'auto';
            this.dropdown.style.maxHeight = `${Math.min(300, spaceBelow - 10)}px`;
            this.dropdown.style.borderRadius = '0 0 12px 12px';
            this.customSelect.classList.remove('open-up');
        }

        // Mover para o body
        document.body.appendChild(this.dropdown);

        // Animar entrada (proximo frame)
        requestAnimationFrame(() => {
            this.dropdown.style.opacity = '1';
            this.dropdown.style.transform = 'scaleY(1) translateY(0)';
        });

        // Scroll para opcao selecionada e highlight
        const selectedOption = this.dropdown.querySelector('.selected');
        if (selectedOption) {
            this.highlightedIndex = parseInt(selectedOption.dataset.index);
            selectedOption.classList.add('highlighted');
            setTimeout(() => {
                selectedOption.scrollIntoView({ block: 'nearest' });
            }, 100);
        }
    }

    close() {
        if (!this.isOpen) return;

        this.isOpen = false;
        this.customSelect.classList.remove('open');
        this.trigger.setAttribute('aria-expanded', 'false');
        this.highlightedIndex = -1;
        this.searchBuffer = '';

        const openUp = this.customSelect.classList.contains('open-up');

        // Remover highlights
        this.dropdown.querySelectorAll('.highlighted').forEach(opt => opt.classList.remove('highlighted'));

        // Animar saida
        this.dropdown.style.opacity = '0';
        this.dropdown.style.transform = openUp ? 'scaleY(0.8) translateY(10px)' : 'scaleY(0.8) translateY(-10px)';

        // Apos animacao, mover de volta e limpar estilos
        setTimeout(() => {
            this.customSelect.classList.remove('open-up');
            this.customSelect.appendChild(this.dropdown);
            this.dropdown.style.cssText = '';
        }, 200);
    }

    selectOption(index) {
        this.selectedIndex = index;
        this.selectElement.selectedIndex = index;

        // Disparar evento change
        const event = new Event('change', { bubbles: true });
        this.selectElement.dispatchEvent(event);

        this.updateSelected();
        this.close();
    }

    updateSelected() {
        const selectedOption = this.selectElement.options[this.selectElement.selectedIndex];
        const valueSpan = this.trigger.querySelector('.custom-select-value');

        if (selectedOption && selectedOption.value) {
            const icon = selectedOption.dataset.icon;
            if (icon) {
                valueSpan.innerHTML = `<i class="fas ${icon} option-icon"></i><span>${selectedOption.textContent}</span>`;
            } else {
                valueSpan.textContent = selectedOption.textContent;
            }
            valueSpan.classList.remove('placeholder');
        } else {
            valueSpan.textContent = 'Selecione...';
            valueSpan.classList.add('placeholder');
        }

        // Atualizar classe selected nas opcoes
        this.dropdown.querySelectorAll('.custom-select-option').forEach((opt, index) => {
            opt.classList.toggle('selected', index === this.selectElement.selectedIndex);
        });
    }

    updateDropdownOptions() {
        // Recriar lista de opcoes quando o select original muda
        this.createOptions();
        this.updateSelected();
    }

    navigateOptions(direction) {
        const options = Array.from(this.dropdown.querySelectorAll('.custom-select-option:not(.disabled)'));
        if (options.length === 0) return;

        let currentIndex = options.findIndex(opt => opt.classList.contains('highlighted'));
        if (currentIndex === -1) {
            currentIndex = options.findIndex(opt => opt.classList.contains('selected'));
        }

        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = 0;
        if (newIndex >= options.length) newIndex = options.length - 1;

        if (options[newIndex]) {
            const actualIndex = parseInt(options[newIndex].dataset.index);
            this.highlightOption(actualIndex);
            options[newIndex].scrollIntoView({ block: 'nearest' });
        }
    }
}

// Inicializar todos os selects customizados
function initCustomSelects() {
    const selects = document.querySelectorAll('.form-select, select.form-input');
    selects.forEach(select => {
        if (!select.dataset.customized) {
            new CustomSelect(select);
            select.dataset.customized = 'true';
        }
    });
}

// Auto-inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCustomSelects);
} else {
    initCustomSelects();
}

// Exportar para uso global
window.initCustomSelects = initCustomSelects;
window.CustomSelect = CustomSelect;
