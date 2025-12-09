/*
==================================================
ARQUIVO: servicos/js/custom-select.js
MÓDULO: Dropdown Customizado Futurístico
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 1.0
==================================================
*/

class CustomSelect {
    constructor(selectElement) {
        this.selectElement = selectElement;
        this.selectedIndex = selectElement.selectedIndex;
        this.isOpen = false;
        this.init();
    }

    init() {
        // Criar estrutura customizada
        this.createCustomSelect();
        this.bindEvents();

        // Esconder select original
        this.selectElement.style.display = 'none';

        // Adicionar após o select original
        this.selectElement.parentNode.insertBefore(this.customSelect, this.selectElement.nextSibling);

        // Sincronizar valor inicial
        this.updateSelected();
    }

    createCustomSelect() {
        // Container principal
        this.customSelect = document.createElement('div');
        this.customSelect.className = 'custom-select';

        // Trigger (botão que abre/fecha)
        this.trigger = document.createElement('div');
        this.trigger.className = 'custom-select-trigger';
        this.trigger.innerHTML = `
            <span class="custom-select-value">Selecione...</span>
            <svg class="custom-select-arrow" viewBox="0 0 10 6" fill="none">
                <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        `;

        // Lista de opções
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'custom-select-dropdown';

        // Criar opções
        const options = Array.from(this.selectElement.options);
        options.forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.className = 'custom-select-option';
            optionElement.textContent = option.textContent;
            optionElement.dataset.value = option.value;
            optionElement.dataset.index = index;

            if (option.disabled) {
                optionElement.classList.add('disabled');
            }

            if (option.selected) {
                optionElement.classList.add('selected');
            }

            this.dropdown.appendChild(optionElement);
        });

        this.customSelect.appendChild(this.trigger);
        this.customSelect.appendChild(this.dropdown);
    }

    bindEvents() {
        // Toggle dropdown com suporte a click e touch
        const handleTriggerInteraction = (e) => {
            // Ignorar se já foi processado por outro evento
            if (e.pointerType === 'touch' && e.type === 'click') return;

            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        };

        this.trigger.addEventListener('click', handleTriggerInteraction);
        this.trigger.addEventListener('touchend', handleTriggerInteraction, { passive: false });

        // Suporte a pointer events (fallback)
        this.trigger.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'touch') {
                e.preventDefault();
                e.stopPropagation();
            }
        }, { passive: false });

        // Selecionar opção com click
        this.dropdown.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const option = e.target.closest('.custom-select-option');
            if (option && !option.classList.contains('disabled')) {
                this.selectOption(parseInt(option.dataset.index));
            }
        });

        // Selecionar opção com touch (mais confiável que touchend sozinho)
        this.dropdown.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const option = e.target.closest('.custom-select-option');
            if (option && !option.classList.contains('disabled')) {
                option.classList.add('touch-active');
            }
        }, { passive: false });

        this.dropdown.addEventListener('touchend', (e) => {
            e.preventDefault();
            const option = document.querySelector('.custom-select-option.touch-active');
            if (option && !option.classList.contains('disabled')) {
                option.classList.remove('touch-active');
                this.selectOption(parseInt(option.dataset.index));
            }
        }, { passive: false });

        // Suporte a pointer events como fallback
        this.dropdown.addEventListener('pointerup', (e) => {
            if (e.pointerType === 'touch') {
                const option = e.target.closest('.custom-select-option');
                if (option && !option.classList.contains('disabled')) {
                    this.selectOption(parseInt(option.dataset.index));
                }
            }
        }, { passive: false });

        // Fechar ao clicar/tocar fora - versão melhorada
        const closeOnOutsideClick = (e) => {
            // Não fechar se clicou dentro do select
            if (!this.customSelect.contains(e.target)) {
                // Aguardar um pouco para evitar conflitos com touchend
                setTimeout(() => {
                    if (this.isOpen) {
                        this.close();
                    }
                }, 100);
            }
        };

        document.addEventListener('click', closeOnOutsideClick);
        document.addEventListener('touchend', closeOnOutsideClick, true);

        // Keyboard navigation
        this.customSelect.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateOptions(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateOptions(-1);
            } else if (e.key === 'Escape') {
                this.close();
            }
        });

        // Observar mudanças no select original (para integração com código existente)
        const observer = new MutationObserver(() => {
            this.updateDropdownOptions();
        });
        observer.observe(this.selectElement, { childList: true, subtree: true });

        // Observar mudanças de valor
        this.selectElement.addEventListener('change', () => {
            this.updateSelected();
        });
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        this.isOpen = true;
        this.customSelect.classList.add('open');
        this.trigger.setAttribute('aria-expanded', 'true');

        // Scroll para opção selecionada
        const selectedOption = this.dropdown.querySelector('.selected');
        if (selectedOption) {
            selectedOption.scrollIntoView({ block: 'nearest' });
        }
    }

    close() {
        this.isOpen = false;
        this.customSelect.classList.remove('open');
        this.trigger.setAttribute('aria-expanded', 'false');
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

        if (selectedOption) {
            valueSpan.textContent = selectedOption.textContent;
            valueSpan.classList.remove('placeholder');
        } else {
            valueSpan.textContent = 'Selecione...';
            valueSpan.classList.add('placeholder');
        }

        // Atualizar classe selected nas opções
        this.dropdown.querySelectorAll('.custom-select-option').forEach((opt, index) => {
            opt.classList.toggle('selected', index === this.selectElement.selectedIndex);
        });
    }

    updateDropdownOptions() {
        // Recriar lista de opções quando o select original muda
        this.dropdown.innerHTML = '';

        const options = Array.from(this.selectElement.options);
        options.forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.className = 'custom-select-option';
            optionElement.textContent = option.textContent;
            optionElement.dataset.value = option.value;
            optionElement.dataset.index = index;

            if (option.disabled) {
                optionElement.classList.add('disabled');
            }

            if (index === this.selectElement.selectedIndex) {
                optionElement.classList.add('selected');
            }

            this.dropdown.appendChild(optionElement);
        });

        this.updateSelected();
    }

    navigateOptions(direction) {
        const options = Array.from(this.dropdown.querySelectorAll('.custom-select-option:not(.disabled)'));
        const currentIndex = options.findIndex(opt => opt.classList.contains('selected'));
        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = 0;
        if (newIndex >= options.length) newIndex = options.length - 1;

        if (options[newIndex]) {
            const actualIndex = parseInt(options[newIndex].dataset.index);
            this.selectOption(actualIndex);

            if (this.isOpen) {
                options[newIndex].scrollIntoView({ block: 'nearest' });
            }
        }
    }
}

// Inicializar todos os selects customizados
function initCustomSelects() {
    const selects = document.querySelectorAll('.form-select, .task-form-select, select.form-input');
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
