/*
==================================================
ARQUIVO: servicos/js/logger.js
MODULO: Sistema de Logging Condicional
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 1.0
DESCRICAO: Logger que so exibe logs em ambiente de desenvolvimento
==================================================
*/

const isDev = window.location.hostname === 'localhost' ||
              window.location.hostname === '127.0.0.1' ||
              window.location.search.includes('debug=true');

const noop = () => {};

// SEGURANCA: Funcao de erro que nao expoe stack traces em producao
const safeError = (...args) => {
    if (isDev) {
        console.error('[ImaginaTech]', ...args);
    } else {
        // Em producao, logar apenas mensagem generica sem stack trace
        const message = args[0];
        if (typeof message === 'string') {
            console.error('[ImaginaTech] Erro:', message.split('\n')[0]); // Apenas primeira linha
        }
        // Nao logar objetos de erro completos em producao
    }
};

const logger = {
    log: isDev ? console.log.bind(console, '[ImaginaTech]') : noop,
    info: isDev ? console.info.bind(console, '[ImaginaTech]') : noop,
    warn: isDev ? console.warn.bind(console, '[ImaginaTech]') : noop,
    error: safeError, // SEGURANCA: Erros sanitizados em producao
    debug: isDev ? console.debug.bind(console, '[ImaginaTech DEBUG]') : noop,

    // Grupo de logs
    group: isDev ? console.group.bind(console) : noop,
    groupEnd: isDev ? console.groupEnd.bind(console) : noop,

    // Tabela para dados estruturados
    table: isDev ? console.table.bind(console) : noop,

    // Timer para performance
    time: isDev ? console.time.bind(console) : noop,
    timeEnd: isDev ? console.timeEnd.bind(console) : noop
};

// Exportar como ES Module
export default logger;

// Também disponibilizar globalmente para scripts legados
window.logger = logger;
