/*
==================================================
ARQUIVO: servicos/js/helpers.js
MODULO: Funcoes Helper Seguras
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 1.0
DESCRICAO: DOM helpers com null safety e sanitizacao
==================================================
*/

import logger from './logger.js';

// =========================
// DOM SAFE ACCESS
// =========================

/**
 * Obtem elemento por ID com null safety
 * @param {string} id - ID do elemento
 * @returns {HTMLElement|null}
 */
export function $(id) {
    return document.getElementById(id);
}

/**
 * Obtem elemento por ID, loga warning se nao existir
 * @param {string} id - ID do elemento
 * @returns {HTMLElement|null}
 */
export function $required(id) {
    const el = document.getElementById(id);
    if (!el) {
        logger.warn(`Elemento #${id} nao encontrado no DOM`);
    }
    return el;
}

/**
 * Query selector com null safety
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Elemento pai (default: document)
 * @returns {HTMLElement|null}
 */
export function $q(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * Query selector all
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Elemento pai (default: document)
 * @returns {NodeList}
 */
export function $qa(selector, parent = document) {
    return parent.querySelectorAll(selector);
}

/**
 * Define valor de input com null safety
 * @param {string} id - ID do elemento
 * @param {*} value - Valor a definir
 */
export function setInputValue(id, value) {
    const el = $(id);
    if (el) el.value = value ?? '';
}

/**
 * Obtem valor de input com null safety
 * @param {string} id - ID do elemento
 * @param {*} defaultValue - Valor default se elemento nao existir
 * @returns {string}
 */
export function getInputValue(id, defaultValue = '') {
    return $(id)?.value ?? defaultValue;
}

/**
 * Define texto de elemento com null safety (seguro contra XSS)
 * @param {string} id - ID do elemento
 * @param {string} text - Texto a definir
 */
export function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text ?? '';
}

/**
 * Define HTML de elemento com sanitizacao
 * @param {string} id - ID do elemento
 * @param {string} html - HTML a definir (sera sanitizado se necessario)
 * @param {boolean} trusted - Se true, nao sanitiza (use apenas para HTML estatico)
 */
export function setHTML(id, html, trusted = false) {
    const el = $(id);
    if (el) {
        el.innerHTML = trusted ? html : sanitizeHTML(html);
    }
}

/**
 * Adiciona/remove classe com null safety
 * @param {string} id - ID do elemento
 * @param {string} className - Nome da classe
 * @param {boolean} add - true para adicionar, false para remover
 */
export function toggleClass(id, className, add) {
    const el = $(id);
    if (el) {
        if (add === undefined) {
            el.classList.toggle(className);
        } else {
            el.classList.toggle(className, add);
        }
    }
}

/**
 * Define display style com null safety
 * @param {string} id - ID do elemento
 * @param {string} display - Valor de display ('none', 'block', 'flex', etc)
 */
export function setDisplay(id, display) {
    const el = $(id);
    if (el) el.style.display = display;
}

/**
 * Mostra elemento (remove hidden ou define display)
 * @param {string} id - ID do elemento
 * @param {string} display - Valor de display quando visivel (default: 'block')
 */
export function show(id, display = 'block') {
    const el = $(id);
    if (el) {
        el.classList.remove('hidden');
        el.style.display = display;
    }
}

/**
 * Esconde elemento
 * @param {string} id - ID do elemento
 */
export function hide(id) {
    const el = $(id);
    if (el) {
        el.style.display = 'none';
    }
}

// =========================
// SANITIZACAO XSS
// =========================

const ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
};

/**
 * Escapa HTML para prevenir XSS
 * @param {string} text - Texto a escapar
 * @returns {string} Texto escapado
 */
export function escapeHTML(text) {
    if (text == null) return '';
    return String(text).replace(/[&<>"'`=/]/g, char => ESCAPE_MAP[char]);
}

// Alias para compatibilidade
export const escapeHtml = escapeHTML;

/**
 * Sanitiza HTML removendo tags perigosas
 * Permite apenas tags seguras: b, i, em, strong, span, br, p, div
 * @param {string} html - HTML a sanitizar
 * @returns {string} HTML sanitizado
 */
export function sanitizeHTML(html) {
    if (html == null) return '';

    // Lista de tags permitidas
    const allowedTags = ['b', 'i', 'em', 'strong', 'span', 'br', 'p', 'div', 'ul', 'ol', 'li'];
    const allowedAttrs = ['class', 'style'];

    // Criar elemento temporario para parsing
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Funcao recursiva para limpar nodes
    function cleanNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            return;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
            const tagName = node.tagName.toLowerCase();

            // Se tag nao permitida, substituir por span ou remover
            if (!allowedTags.includes(tagName)) {
                // Scripts e styles sao removidos completamente
                if (tagName === 'script' || tagName === 'style' || tagName === 'iframe') {
                    node.remove();
                    return;
                }
                // Outras tags: manter conteudo mas remover tag
                const span = document.createElement('span');
                while (node.firstChild) {
                    span.appendChild(node.firstChild);
                }
                node.parentNode?.replaceChild(span, node);
                node = span;
            }

            // Remover atributos perigosos
            const attrs = Array.from(node.attributes || []);
            for (const attr of attrs) {
                if (!allowedAttrs.includes(attr.name.toLowerCase())) {
                    node.removeAttribute(attr.name);
                }
                // Verificar valores de atributos por javascript:
                if (attr.value.toLowerCase().includes('javascript:')) {
                    node.removeAttribute(attr.name);
                }
            }

            // Remover event handlers
            for (const attr of Array.from(node.attributes || [])) {
                if (attr.name.startsWith('on')) {
                    node.removeAttribute(attr.name);
                }
            }
        }

        // Processar filhos
        for (const child of Array.from(node.childNodes)) {
            cleanNode(child);
        }
    }

    cleanNode(temp);
    return temp.innerHTML;
}

/**
 * Cria elemento HTML de forma segura
 * @param {string} tag - Nome da tag
 * @param {Object} attrs - Atributos do elemento
 * @param {string|HTMLElement|Array} children - Conteudo filho
 * @returns {HTMLElement}
 */
export function createElement(tag, attrs = {}, children = null) {
    const el = document.createElement(tag);

    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'className') {
            el.className = value;
        } else if (key === 'dataset') {
            Object.assign(el.dataset, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        } else {
            el.setAttribute(key, value);
        }
    }

    if (children) {
        if (Array.isArray(children)) {
            children.forEach(child => {
                if (typeof child === 'string') {
                    el.appendChild(document.createTextNode(child));
                } else if (child instanceof HTMLElement) {
                    el.appendChild(child);
                }
            });
        } else if (typeof children === 'string') {
            el.textContent = children;
        } else if (children instanceof HTMLElement) {
            el.appendChild(children);
        }
    }

    return el;
}

// =========================
// EVENT LISTENER MANAGER
// =========================

const listenerRegistry = new Map();

/**
 * Adiciona event listener com tracking para cleanup
 * @param {string|HTMLElement} target - ID ou elemento
 * @param {string} event - Nome do evento
 * @param {Function} handler - Handler do evento
 * @param {Object} options - Opcoes do listener
 * @returns {Function} Funcao para remover o listener
 */
export function addListener(target, event, handler, options = {}) {
    const el = typeof target === 'string' ? $(target) : target;
    if (!el) {
        logger.warn(`addListener: elemento nao encontrado`, target);
        return () => {};
    }

    el.addEventListener(event, handler, options);

    // Registrar para cleanup
    const key = el.id || el;
    if (!listenerRegistry.has(key)) {
        listenerRegistry.set(key, []);
    }
    listenerRegistry.get(key).push({ event, handler, options });

    // Retornar funcao de cleanup
    return () => {
        el.removeEventListener(event, handler, options);
    };
}

/**
 * Remove todos os listeners de um elemento
 * @param {string|HTMLElement} target - ID ou elemento
 */
export function removeAllListeners(target) {
    const el = typeof target === 'string' ? $(target) : target;
    const key = el?.id || target;

    const listeners = listenerRegistry.get(key);
    if (listeners && el) {
        listeners.forEach(({ event, handler, options }) => {
            el.removeEventListener(event, handler, options);
        });
        listenerRegistry.delete(key);
    }
}

/**
 * Limpa todos os listeners registrados
 */
export function cleanupAllListeners() {
    for (const [key, listeners] of listenerRegistry.entries()) {
        const el = typeof key === 'string' ? $(key) : key;
        if (el) {
            listeners.forEach(({ event, handler, options }) => {
                el.removeEventListener(event, handler, options);
            });
        }
    }
    listenerRegistry.clear();
}

// =========================
// DEBOUNCE & THROTTLE
// =========================

/**
 * Debounce function
 * @param {Function} func - Funcao a ser debounced
 * @param {number} wait - Tempo de espera em ms
 * @returns {Function}
 */
export function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function
 * @param {Function} func - Funcao a ser throttled
 * @param {number} limit - Intervalo minimo em ms
 * @returns {Function}
 */
export function throttle(func, limit = 300) {
    let inThrottle;
    return function executedFunction(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// =========================
// NAMESPACE GLOBAL
// =========================

// Criar namespace unico para funcoes globais
window.ImaginaTech = window.ImaginaTech || {};

/**
 * Registra funcao no namespace global
 * @param {string} name - Nome da funcao
 * @param {Function} func - Funcao a registrar
 */
export function registerGlobal(name, func) {
    window.ImaginaTech[name] = func;
    // Tambem expor diretamente no window para compatibilidade com onclick
    window[name] = func;
}

/**
 * Registra multiplas funcoes no namespace global
 * @param {Object} funcs - Objeto com funcoes
 */
export function registerGlobals(funcs) {
    for (const [name, func] of Object.entries(funcs)) {
        registerGlobal(name, func);
    }
}
