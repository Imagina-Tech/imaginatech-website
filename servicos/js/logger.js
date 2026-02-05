/*
==================================================
ARQUIVO: servicos/js/logger.js
MODULO: Wrapper para Logger Centralizado
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: 2.0 - Usa Firestore Logger
DESCRICAO: Redireciona para o logger centralizado em /shared/firestore-logger.js
==================================================
*/

/**
 * Logger centralizado do Firestore
 * O logger real e carregado via /shared/firestore-logger.js no HTML
 * Este arquivo apenas exporta a referencia global para uso em ES6 modules
 */
const logger = window.logger || {
    log: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    group: () => {},
    groupEnd: () => {},
    table: () => {},
    time: () => {},
    timeEnd: () => {},
    flush: () => {}
};

// Exportar como ES Module
export default logger;
