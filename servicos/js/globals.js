/*
==================================================
ARQUIVO: servicos/js/globals.js
MODULO: Registro de Funcoes Globais
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 1.0
DESCRICAO: Centraliza registro de funcoes no namespace global
==================================================
*/

import { logger } from './config.js';

// ===========================
// NAMESPACE PRINCIPAL
// ===========================

window.ImaginaTech = window.ImaginaTech || {
    version: '3.4',
    modules: {},
    utils: {},
    ui: {},
    services: {}
};

/**
 * Registra funcao no namespace e opcionalmente no window global
 * @param {string} namespace - Namespace dentro de ImaginaTech (ex: 'ui', 'services')
 * @param {string} name - Nome da funcao
 * @param {Function} func - Funcao a registrar
 * @param {boolean} exposeGlobally - Se true, tambem expoe como window[name]
 */
export function registerFunction(namespace, name, func, exposeGlobally = true) {
    // Garantir que o namespace existe
    if (!window.ImaginaTech[namespace]) {
        window.ImaginaTech[namespace] = {};
    }

    // Registrar no namespace
    window.ImaginaTech[namespace][name] = func;

    // Opcionalmente expor globalmente para compatibilidade com onclick
    if (exposeGlobally) {
        window[name] = func;
    }

    logger.debug(`Funcao registrada: ImaginaTech.${namespace}.${name}`);
}

/**
 * Registra multiplas funcoes de um modulo
 * @param {string} namespace - Namespace dentro de ImaginaTech
 * @param {Object} funcs - Objeto com funcoes { nome: funcao }
 * @param {boolean} exposeGlobally - Se true, tambem expoe como window[name]
 */
export function registerModule(namespace, funcs, exposeGlobally = true) {
    Object.entries(funcs).forEach(([name, func]) => {
        if (typeof func === 'function') {
            registerFunction(namespace, name, func, exposeGlobally);
        }
    });
}

/**
 * Obtem funcao do namespace
 * @param {string} path - Caminho da funcao (ex: 'ui.openModal')
 * @returns {Function|undefined}
 */
export function getFunction(path) {
    const parts = path.split('.');
    let current = window.ImaginaTech;

    for (const part of parts) {
        if (current && typeof current === 'object') {
            current = current[part];
        } else {
            return undefined;
        }
    }

    return typeof current === 'function' ? current : undefined;
}

/**
 * Verifica se funcao existe no namespace
 * @param {string} path - Caminho da funcao
 * @returns {boolean}
 */
export function hasFunction(path) {
    return getFunction(path) !== undefined;
}

/**
 * Lista todas as funcoes registradas em um namespace
 * @param {string} namespace - Namespace a listar
 * @returns {string[]}
 */
export function listFunctions(namespace) {
    const ns = window.ImaginaTech[namespace];
    if (!ns || typeof ns !== 'object') return [];

    return Object.keys(ns).filter(key => typeof ns[key] === 'function');
}

// ===========================
// DEPRECATION WARNINGS
// ===========================

const deprecatedFunctions = new Set();

/**
 * Marca funcao como deprecated e loga warning quando usada
 * @param {string} oldName - Nome antigo da funcao
 * @param {string} newPath - Novo caminho (ex: 'ImaginaTech.ui.openModal')
 */
export function deprecateFunction(oldName, newPath) {
    const originalFunc = window[oldName];
    if (!originalFunc) return;

    window[oldName] = function(...args) {
        if (!deprecatedFunctions.has(oldName)) {
            logger.warn(`[DEPRECATED] window.${oldName}() esta obsoleto. Use ${newPath}() no lugar.`);
            deprecatedFunctions.add(oldName);
        }
        return originalFunc.apply(this, args);
    };
}

// ===========================
// AUTO-REGISTER UTILS
// ===========================

// Registrar utilitarios comuns no namespace
window.ImaginaTech.utils = {
    // DOM helpers
    $: (id) => document.getElementById(id),
    $q: (sel) => document.querySelector(sel),
    $qa: (sel) => document.querySelectorAll(sel),

    // Formatacao
    formatMoney: (val) => val?.toFixed(2).replace('.', ',') || '0,00',
    formatDate: (date) => date ? new Date(date).toLocaleDateString('pt-BR') : 'N/A',

    // Escape
    escapeHtml: (text) => {
        if (!text) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return String(text).replace(/[&<>"']/g, c => map[c]);
    }
};

// Exportar namespace para acesso direto
export default window.ImaginaTech;
