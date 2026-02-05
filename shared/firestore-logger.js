/**
 * ==================================================
 * ARQUIVO: /shared/firestore-logger.js
 * MODULO: Sistema de Logs Centralizado no Firestore
 * SISTEMA: ImaginaTech - Gestao de Impressao 3D
 * VERSAO: 2.0 - Auto-ativa para admins
 * ==================================================
 *
 * ESTRUTURA NO FIRESTORE:
 * logs/{painel}/entries/{docId}
 *   - timestamp: Date
 *   - level: "log" | "warn" | "error" | "debug" | "info"
 *   - message: string
 *   - data: any (dados adicionais serializados)
 *   - stack: string (stack trace se erro)
 *   - user: string (email do usuario logado)
 *   - url: string (URL atual)
 *   - userAgent: string
 *
 * ATIVACAO:
 * - Automatica para usuarios admin (collection /admins)
 * - Manual com ?debug=true na URL (qualquer usuario)
 *
 * LIMPEZA AUTOMATICA: Logs > 7 dias sao removidos ao inicializar
 */

(function() {
    'use strict';

    // ========================================
    // CONFIGURACAO
    // ========================================

    const CONFIG = {
        COLLECTION: 'logs',
        MAX_AGE_DAYS: 7,
        BATCH_SIZE: 10,
        FLUSH_INTERVAL_MS: 5000,
        MAX_MESSAGE_LENGTH: 5000,
        MAX_DATA_LENGTH: 10000,
        ENABLE_CONSOLE_IN_DEV: false
    };

    // Debug mode forcado via URL
    const DEBUG_MODE = window.location.search.includes('debug=true');

    // Estado do logger
    let isEnabled = DEBUG_MODE; // Comeca ativado se ?debug=true
    let isAdminChecked = false;
    let pendingLogs = []; // Buffer enquanto verifica se e admin

    // ========================================
    // DETECCAO DO PAINEL
    // ========================================

    function detectPanelName() {
        const path = window.location.pathname;

        // Mapeamento de paths para nomes de painel
        const panelMap = {
            '/servicos': 'servicos',
            '/financas': 'financas',
            '/estoque': 'estoque',
            '/marketplace': 'marketplace',
            '/admin-portfolio': 'admin-portfolio',
            '/admin': 'admin',
            '/acompanhar-pedido': 'acompanhar-pedido',
            '/custo': 'custo',
            '/auto-orcamento': 'auto-orcamento',
            '/projetos': 'projetos',
            '/obrigado': 'obrigado'
        };

        for (const [pathPrefix, panelName] of Object.entries(panelMap)) {
            if (path.startsWith(pathPrefix)) {
                return panelName;
            }
        }

        // Fallback: usar primeiro segmento do path ou 'root'
        const segments = path.split('/').filter(s => s);
        return segments[0] || 'root';
    }

    // ========================================
    // BUFFER DE LOGS (para envio em batch)
    // ========================================

    let logBuffer = [];
    let flushTimeout = null;
    let isInitialized = false;
    let firestoreDb = null;
    let currentUser = null;
    const panelName = detectPanelName();

    // ========================================
    // UTILITARIOS
    // ========================================

    function truncate(str, maxLength) {
        if (typeof str !== 'string') return str;
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength) + '... [truncado]';
    }

    function safeStringify(data) {
        if (data === undefined) return undefined;
        if (data === null) return null;

        try {
            const seen = new WeakSet();
            return JSON.stringify(data, (key, value) => {
                // Ignorar funcoes
                if (typeof value === 'function') return '[Function]';
                // Ignorar DOM elements
                if (value instanceof HTMLElement) return '[HTMLElement]';
                // Evitar referencias circulares
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value)) return '[Circular]';
                    seen.add(value);
                }
                // Converter Error para objeto
                if (value instanceof Error) {
                    return {
                        name: value.name,
                        message: value.message,
                        stack: value.stack
                    };
                }
                return value;
            }, 2);
        } catch (e) {
            return '[Erro ao serializar]';
        }
    }

    function formatMessage(args) {
        return args.map(arg => {
            if (typeof arg === 'string') return arg;
            if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
            return safeStringify(arg);
        }).join(' ');
    }

    function extractStack(args) {
        for (const arg of args) {
            if (arg instanceof Error && arg.stack) {
                return arg.stack;
            }
        }
        // Capturar stack atual para contexto
        try {
            throw new Error('LogTrace');
        } catch (e) {
            // Remover as primeiras linhas que sao do proprio logger
            const lines = e.stack.split('\n');
            return lines.slice(4).join('\n');
        }
    }

    function extractData(args) {
        const data = [];
        for (const arg of args) {
            if (typeof arg === 'object' && arg !== null && !(arg instanceof Error)) {
                data.push(arg);
            }
        }
        if (data.length === 0) return undefined;
        const serialized = safeStringify(data.length === 1 ? data[0] : data);
        return truncate(serialized, CONFIG.MAX_DATA_LENGTH);
    }

    // ========================================
    // VERIFICACAO DE ADMIN
    // ========================================

    async function checkIfAdmin(userUid) {
        if (!firestoreDb || !userUid) return false;

        try {
            const adminDoc = await firestoreDb.collection('admins').doc(userUid).get();
            return adminDoc.exists && adminDoc.data()?.active !== false;
        } catch (e) {
            return false;
        }
    }

    // ========================================
    // INICIALIZACAO DO FIRESTORE
    // ========================================

    function initializeFirestore() {
        if (isInitialized) return;

        // Aguardar Firebase estar disponivel
        const checkFirebase = () => {
            if (typeof firebase !== 'undefined' && firebase.firestore) {
                firestoreDb = firebase.firestore();
                isInitialized = true;

                // Observar mudancas de autenticacao e verificar se e admin
                if (firebase.auth) {
                    firebase.auth().onAuthStateChanged(async (user) => {
                        currentUser = user ? user.email : null;

                        if (user && !isAdminChecked) {
                            isAdminChecked = true;

                            // Verificar se usuario e admin
                            const userIsAdmin = await checkIfAdmin(user.uid);

                            if (userIsAdmin) {
                                // Admin confirmado - ativar logger
                                isEnabled = true;
                                // Flush logs pendentes que estavam em buffer
                                if (pendingLogs.length > 0) {
                                    pendingLogs.forEach(entry => addToBuffer(entry));
                                    pendingLogs = [];
                                }
                            } else if (!DEBUG_MODE) {
                                // Nao e admin e nao tem ?debug=true - descartar logs
                                pendingLogs = [];
                                isEnabled = false;
                            }
                        }
                    });
                }

                // Executar limpeza de logs antigos (apenas se habilitado)
                if (isEnabled) {
                    cleanOldLogs();
                }

                // Flush buffer pendente
                flushBuffer();
            } else {
                setTimeout(checkFirebase, 100);
            }
        };

        checkFirebase();
    }

    // ========================================
    // LIMPEZA DE LOGS ANTIGOS (> 7 DIAS)
    // ========================================

    async function cleanOldLogs() {
        if (!firestoreDb) return;

        try {
            const panelDocRef = firestoreDb.collection(CONFIG.COLLECTION).doc(panelName);
            const panelDoc = await panelDocRef.get();

            const now = new Date();
            const lastCleanup = panelDoc.exists && panelDoc.data().lastCleanup
                ? panelDoc.data().lastCleanup.toDate()
                : null;

            // Executar limpeza apenas uma vez por dia
            if (lastCleanup) {
                const hoursSinceCleanup = (now - lastCleanup) / (1000 * 60 * 60);
                if (hoursSinceCleanup < 24) return;
            }

            // Calcular data limite (7 dias atras)
            const limitDate = new Date(now.getTime() - (CONFIG.MAX_AGE_DAYS * 24 * 60 * 60 * 1000));

            // Buscar logs antigos
            const entriesRef = panelDocRef.collection('entries');
            const oldLogs = await entriesRef
                .where('timestamp', '<', limitDate)
                .limit(500)
                .get();

            if (oldLogs.empty) {
                // Atualizar lastCleanup mesmo sem logs para deletar
                await panelDocRef.set({ lastCleanup: now }, { merge: true });
                return;
            }

            // Deletar em batches
            const batch = firestoreDb.batch();
            oldLogs.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            await panelDocRef.set({ lastCleanup: now }, { merge: true });

        } catch (error) {
            // Silencioso - nao quebrar a aplicacao por erro de limpeza
        }
    }

    // ========================================
    // ENVIO DE LOGS PARA FIRESTORE
    // ========================================

    function addToBuffer(entry) {
        logBuffer.push(entry);

        // Flush imediato se buffer cheio
        if (logBuffer.length >= CONFIG.BATCH_SIZE) {
            flushBuffer();
            return;
        }

        // Agendar flush
        if (!flushTimeout) {
            flushTimeout = setTimeout(flushBuffer, CONFIG.FLUSH_INTERVAL_MS);
        }
    }

    /**
     * Controla o fluxo de logs baseado no estado de admin
     * - Se ainda nao verificou admin: guarda em pendingLogs
     * - Se verificou e nao e admin/debug: descarta
     * - Se e admin ou debug mode: envia para buffer
     */
    function handleLog(entry) {
        // Se ainda nao verificamos se e admin, guardar no pendingLogs
        if (!isAdminChecked) {
            pendingLogs.push(entry);
            return;
        }

        // Se verificamos e nao e admin nem debug, ignorar
        if (!isEnabled) {
            return;
        }

        // Admin confirmado ou debug mode - enviar para buffer
        addToBuffer(entry);
    }

    async function flushBuffer() {
        if (flushTimeout) {
            clearTimeout(flushTimeout);
            flushTimeout = null;
        }

        if (logBuffer.length === 0) return;
        if (!firestoreDb) {
            // Firestore nao inicializado, manter no buffer
            return;
        }

        const entries = [...logBuffer];
        logBuffer = [];

        try {
            const entriesRef = firestoreDb
                .collection(CONFIG.COLLECTION)
                .doc(panelName)
                .collection('entries');

            // Usar batch para eficiencia
            const batch = firestoreDb.batch();

            entries.forEach(entry => {
                const docRef = entriesRef.doc();
                batch.set(docRef, entry);
            });

            await batch.commit();

        } catch (error) {
            // Em caso de erro, re-adicionar ao buffer (com limite)
            if (logBuffer.length < 100) {
                logBuffer = [...entries, ...logBuffer].slice(0, 100);
            }
        }
    }

    // ========================================
    // CRIACAO DE ENTRADA DE LOG
    // ========================================

    function createLogEntry(level, args) {
        const message = truncate(formatMessage(args), CONFIG.MAX_MESSAGE_LENGTH);

        const entry = {
            timestamp: new Date(),
            level: level,
            message: message,
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        // Adicionar usuario se logado
        if (currentUser) {
            entry.user = currentUser;
        }

        // Adicionar dados extras se houver
        const data = extractData(args);
        if (data) {
            entry.data = data;
        }

        // Adicionar stack trace para erros ou debug
        if (level === 'error' || level === 'debug') {
            entry.stack = extractStack(args);
        }

        return entry;
    }

    // ========================================
    // LOGGER PRINCIPAL
    // ========================================

    const logger = {
        /**
         * Log informativo geral
         */
        log: function(...args) {
            if (args.length === 0) return;
            const entry = createLogEntry('log', args);
            handleLog(entry);
        },

        /**
         * Log informativo (alias para log)
         */
        info: function(...args) {
            if (args.length === 0) return;
            const entry = createLogEntry('info', args);
            handleLog(entry);
        },

        /**
         * Aviso - algo inesperado mas nao critico
         */
        warn: function(...args) {
            if (args.length === 0) return;
            const entry = createLogEntry('warn', args);
            handleLog(entry);
        },

        /**
         * Erro - problema que precisa atencao
         */
        error: function(...args) {
            if (args.length === 0) return;
            const entry = createLogEntry('error', args);
            handleLog(entry);
            // Flush imediato para erros (se habilitado)
            if (isEnabled) flushBuffer();
        },

        /**
         * Debug - informacoes detalhadas para debugging
         */
        debug: function(...args) {
            if (args.length === 0) return;
            const entry = createLogEntry('debug', args);
            handleLog(entry);
        },

        /**
         * Grupo de logs (para organizacao)
         */
        group: function(label) {
            const entry = createLogEntry('log', [`[GROUP START] ${label}`]);
            handleLog(entry);
        },

        /**
         * Fim do grupo
         */
        groupEnd: function(label) {
            const entry = createLogEntry('log', [`[GROUP END] ${label || ''}`]);
            handleLog(entry);
        },

        /**
         * Tabela de dados
         */
        table: function(data, label) {
            const entry = createLogEntry('log', [label || '[TABLE]', data]);
            handleLog(entry);
        },

        /**
         * Timer - inicio
         */
        time: function(label) {
            logger._timers = logger._timers || {};
            logger._timers[label] = performance.now();
            const entry = createLogEntry('log', [`[TIMER START] ${label}`]);
            handleLog(entry);
        },

        /**
         * Timer - fim
         */
        timeEnd: function(label) {
            logger._timers = logger._timers || {};
            const start = logger._timers[label];
            if (start) {
                const duration = (performance.now() - start).toFixed(2);
                delete logger._timers[label];
                const entry = createLogEntry('log', [`[TIMER END] ${label}: ${duration}ms`]);
                handleLog(entry);
            }
        },

        /**
         * Forca envio imediato dos logs pendentes
         */
        flush: function() {
            return flushBuffer();
        },

        /**
         * Retorna nome do painel detectado
         */
        getPanelName: function() {
            return panelName;
        }
    };

    // ========================================
    // CAPTURA DE ERROS GLOBAIS
    // ========================================

    window.addEventListener('error', function(event) {
        logger.error('[ERRO GLOBAL]', event.message, {
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno,
            error: event.error
        });
    });

    window.addEventListener('unhandledrejection', function(event) {
        logger.error('[PROMISE REJEITADA]', event.reason);
    });

    // Flush ao sair da pagina
    window.addEventListener('beforeunload', function() {
        flushBuffer();
    });

    // ========================================
    // EXPORTACAO
    // ========================================

    // Disponibilizar globalmente
    window.logger = logger;
    window.FirestoreLogger = logger;

    // Suporte a ES6 modules
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = logger;
    }

    // Inicializar quando DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeFirestore);
    } else {
        initializeFirestore();
    }

})();
