/**
 * Cloud Functions - ImaginaTech
 * Monitor de Vendas Mercado Livre + Bot WhatsApp Financas
 *
 * ENDPOINTS MERCADO LIVRE:
 * - mlAuth: Iniciar OAuth
 * - mlOAuthCallback: Callback OAuth
 * - mlStatus: Status da conexao
 * - mlListItems: Listar anuncios (para vincular)
 * - mlwebhook: Receber notificacoes de vendas
 * - mlGetPendingOrders: Pedidos pagos aguardando envio
 * - mlGetSalesHistory: Historico de vendas entregues
 * - mlGetOrderDetails: Detalhes de um pedido
 * - mlGetItemDetails: Detalhes de um anuncio
 * - mlUpdateStock: Atualizar quantidade
 *
 * ENDPOINTS WHATSAPP BOT:
 * - whatsappWebhook: Receber/verificar mensagens WhatsApp
 * - sendWhatsAppMessage: Enviar mensagem para cliente
 * - whatsappStatus: Verificar status do bot
 *
 * !!! AVISO DE SINCRONIZACAO - LEIA ANTES DE EDITAR !!!
 * =====================================================
 * A funcao buildFinancialOverview() contem a logica de calculo dos KPIs.
 * Esta logica DEVE ser identica a do frontend em:
 *
 *   financas/finance-data.js -> funcao updateKPIs()
 *
 * Se voce editar os calculos la, DEVE editar tambem aqui para
 * manter os valores consistentes entre dashboard e bot WhatsApp.
 *
 * Calculos criticos que devem estar sincronizados:
 * - totalIncomeAllTime (entradas excluindo credito)
 * - totalDebitAllTime (saidas excluindo credito)
 * - totalBalance = totalIncomeAllTime - totalDebitAllTime
 * - cutoffDate filtering (userSettings.cutoffDate)
 * - paymentMethod === 'credit' exclusion
 *
 * Ultima sincronizacao: 2026-01-22
 * =====================================================
 */

// Usando firebase-functions/v1 para compatibilidade com funcoes 1a geracao
// A API functions.config() foi removida - usar apenas process.env
const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const axios = require('axios');
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

// ========== CONFIGURACOES GLOBAIS ==========
const ALLOWED_ORIGINS = [
    'https://imaginatech.com.br',
    'https://www.imaginatech.com.br',
    'http://localhost:5000',
    'http://127.0.0.1:5000'
];

const BASE_URL = process.env.BASE_URL || 'https://imaginatech.com.br';
const FUNCTIONS_URL = process.env.FUNCTIONS_URL || 'https://us-central1-imaginatech-servicos.cloudfunctions.net';

// Email do Super Admin (unico que pode gerenciar outros admins)
const SUPER_ADMIN_EMAIL = '3d3printers@gmail.com';

// SEGURANCA: Admins verificados EXCLUSIVAMENTE via Firestore
// Nenhum fallback hardcoded - fail-secure by design

// ========== CORS HELPER ==========
function setCorsHeaders(res, req) {
    const origin = req.headers.origin;
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.set('Access-Control-Allow-Origin', origin);
    } else {
        res.set('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
    }
    res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Credentials', 'true');
}

// ========== DATE HELPERS ==========
function getMonthBounds(date = new Date()) {
    const year = date.getFullYear();
    const month = date.getMonth();
    return {
        startOfMonth: new Date(year, month, 1).toISOString().split('T')[0],
        endOfMonth: new Date(year, month + 1, 0).toISOString().split('T')[0],
        year,
        month,
        monthName: date.toLocaleDateString('pt-BR', { month: 'long' }),
        daysRemaining: new Date(year, month + 1, 0).getDate() - date.getDate()
    };
}

function calculateCurrentInstallment(startYear, startMonth, totalInstallments) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const monthsElapsed = (currentYear - startYear) * 12 + (currentMonth - startMonth);
    const currentInstallment = monthsElapsed + 1;
    const isActive = currentInstallment <= totalInstallments;
    return { currentInstallment, isActive, remaining: totalInstallments - currentInstallment + 1 };
}

// ========== RATE LIMITING ==========
const rateLimitCache = new Map();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 15; // max 15 mensagens por minuto (WhatsApp)

function checkRateLimit(identifier) {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    // Limpar entradas antigas
    if (rateLimitCache.has(identifier)) {
        const timestamps = rateLimitCache.get(identifier).filter(t => t > windowStart);
        rateLimitCache.set(identifier, timestamps);
    } else {
        rateLimitCache.set(identifier, []);
    }

    const timestamps = rateLimitCache.get(identifier);
    if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
        return false; // Rate limited
    }

    timestamps.push(now);
    return true; // OK
}

// ========== IP RATE LIMITING (DDoS Protection) ==========
const ipRateLimitCache = new Map();
const IP_RATE_LIMIT_WINDOW_MS = 60000; // 1 minuto
const IP_RATE_LIMIT_CLEANUP_INTERVAL = 300000; // Limpar cache a cada 5 min

// Limites por tipo de endpoint
const RATE_LIMITS = {
    default: 60,          // 60 req/min - endpoints normais
    auth: 20,             // 20 req/min - endpoints de autenticacao
    sensitive: 10,        // 10 req/min - endpoints sensiveis (bypass password)
    webhook: 300,         // 300 req/min - webhooks externos (ML, WhatsApp)
    readonly: 120         // 120 req/min - endpoints somente leitura
};

// Limpeza periodica do cache para evitar memory leak
let lastCleanup = Date.now();
function cleanupIpCache() {
    const now = Date.now();
    if (now - lastCleanup < IP_RATE_LIMIT_CLEANUP_INTERVAL) return;

    lastCleanup = now;
    const windowStart = now - IP_RATE_LIMIT_WINDOW_MS;

    for (const [ip, data] of ipRateLimitCache.entries()) {
        const validTimestamps = data.timestamps.filter(t => t > windowStart);
        if (validTimestamps.length === 0) {
            ipRateLimitCache.delete(ip);
        } else {
            data.timestamps = validTimestamps;
        }
    }
}

/**
 * Verifica rate limit por IP
 * @param {Object} req - Request object
 * @param {string} limitType - Tipo de limite (default, auth, sensitive, webhook, readonly)
 * @returns {{ allowed: boolean, remaining: number, retryAfter?: number }}
 */
function checkIpRateLimit(req, limitType = 'default') {
    cleanupIpCache();

    // Extrair IP do request (considera proxy/load balancer)
    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : req.ip || req.connection?.remoteAddress || 'unknown';

    const now = Date.now();
    const windowStart = now - IP_RATE_LIMIT_WINDOW_MS;
    const maxRequests = RATE_LIMITS[limitType] || RATE_LIMITS.default;

    if (!ipRateLimitCache.has(ip)) {
        ipRateLimitCache.set(ip, { timestamps: [], blocked: false, blockUntil: 0 });
    }

    const data = ipRateLimitCache.get(ip);

    // Se IP esta bloqueado temporariamente (apos exceder muito o limite)
    if (data.blocked && now < data.blockUntil) {
        const retryAfter = Math.ceil((data.blockUntil - now) / 1000);
        return { allowed: false, remaining: 0, retryAfter, blocked: true };
    }

    // Limpar timestamps antigos
    data.timestamps = data.timestamps.filter(t => t > windowStart);
    data.blocked = false;

    const currentCount = data.timestamps.length;

    if (currentCount >= maxRequests) {
        // Se excedeu em 3x o limite, bloquear por 5 minutos
        if (currentCount >= maxRequests * 3) {
            data.blocked = true;
            data.blockUntil = now + 300000; // 5 minutos
            console.warn(`[RateLimit] IP ${ip} BLOQUEADO por 5 min (${currentCount}/${maxRequests} req)`);
        }

        const retryAfter = Math.ceil((data.timestamps[0] + IP_RATE_LIMIT_WINDOW_MS - now) / 1000);
        return { allowed: false, remaining: 0, retryAfter: Math.max(1, retryAfter) };
    }

    data.timestamps.push(now);
    return { allowed: true, remaining: maxRequests - currentCount - 1 };
}

/**
 * Middleware para aplicar rate limit e retornar 429 se excedido
 * @param {Object} req - Request
 * @param {Object} res - Response
 * @param {string} limitType - Tipo de limite
 * @returns {boolean} - true se permitido, false se bloqueado (ja enviou resposta)
 */
function applyRateLimit(req, res, limitType = 'default') {
    const result = checkIpRateLimit(req, limitType);

    // Headers de rate limit (padrao RFC 6585)
    res.set('X-RateLimit-Limit', RATE_LIMITS[limitType] || RATE_LIMITS.default);
    res.set('X-RateLimit-Remaining', Math.max(0, result.remaining));

    if (!result.allowed) {
        res.set('Retry-After', result.retryAfter);
        res.set('X-RateLimit-Reset', Math.ceil(Date.now() / 1000) + result.retryAfter);

        res.status(429).json({
            error: 'Too Many Requests',
            message: result.blocked
                ? 'IP temporariamente bloqueado por excesso de requisicoes'
                : 'Limite de requisicoes excedido',
            retryAfter: result.retryAfter
        });
        return false;
    }

    return true;
}

// ========== PKCE HELPERS ==========
function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function generateStateToken() {
    return crypto.randomBytes(16).toString('hex');
}

// ========== AUTH HELPERS ==========
async function verifyAdminToken(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { isAdmin: false, error: 'Token nao fornecido' };
    }

    const idToken = authHeader.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const email = decodedToken.email;

        // Verificar no Firestore (fonte primaria)
        const adminDoc = await db.collection('admins').doc(uid).get();
        let isAdmin = adminDoc.exists && adminDoc.data().active === true;

        // Super Admin sempre tem acesso (unico fallback permitido - email do dono)
        if (!isAdmin && email === SUPER_ADMIN_EMAIL) {
            isAdmin = true;
        }

        // SEGURANCA: Removido fallback de lista hardcoded
        // Admins DEVEM estar cadastrados no Firestore

        return { isAdmin, email, uid };
    } catch (error) {
        console.error('[verifyAdminToken] Erro:', error);
        return { isAdmin: false, error: 'Token invalido' };
    }
}

// Verificar se e Super Admin
function isSuperAdmin(email) {
    return email === SUPER_ADMIN_EMAIL;
}

// ========== RETRY HELPER ==========
// Backoff exponencial com tratamento especial para 429 (rate limit)
async function withRetry(fn, maxRetries = 3, delayMs = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const errorMsg = error.message || '';
            const is429 = errorMsg.includes('429') || errorMsg.includes('Too Many Requests') || errorMsg.includes('Resource exhausted');

            if (i < maxRetries - 1) {
                // Para 429, usar backoff exponencial mais agressivo (5s, 15s, 45s)
                // Para outros erros, backoff linear (1s, 2s, 3s)
                const baseDelay = is429 ? 5000 : delayMs;
                const delay = is429 ? baseDelay * Math.pow(3, i) : delayMs * (i + 1);
                console.log(`[withRetry] Tentativa ${i + 1}/${maxRetries} falhou${is429 ? ' (429 rate limit)' : ''}, aguardando ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

// Configuracoes do Mercado Livre (usando variaveis de ambiente)
const ML_CONFIG = {
    appId: process.env.ML_APP_ID,
    secretKey: process.env.ML_SECRET_KEY,
    redirectUri: process.env.ML_REDIRECT_URI || `${FUNCTIONS_URL}/mlwebhook`,
    authUrl: 'https://auth.mercadolivre.com.br/authorization',
    tokenUrl: 'https://api.mercadolibre.com/oauth/token',
    apiUrl: 'https://api.mercadolibre.com'
};

// ========================================
// AUTENTICACAO OAUTH
// ========================================

/**
 * Gera URL de autorizacao do Mercado Livre com PKCE
 * GET /mlAuth
 */
exports.mlAuth = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!applyRateLimit(req, res, 'auth')) return;

    try {
        // Gerar PKCE code_verifier, code_challenge e state (evita race condition)
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);
        const state = generateStateToken();

        // Salvar code_verifier no Firestore usando STATE como ID (evita race condition)
        await db.collection('mlCredentials').doc(`pkce_${state}`).set({
            codeVerifier: codeVerifier,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutos
        });

        // URL com PKCE e state
        const authUrl = `${ML_CONFIG.authUrl}?response_type=code&client_id=${ML_CONFIG.appId}&redirect_uri=${encodeURIComponent(ML_CONFIG.redirectUri)}&code_challenge=${codeChallenge}&code_challenge_method=S256&state=${state}`;

        // Se for chamada AJAX, retorna a URL
        if (req.headers.accept?.includes('application/json')) {
            res.json({ authUrl, state });
        } else {
            // Se for acesso direto, redireciona
            res.redirect(authUrl);
        }
    } catch (error) {
        console.error('[mlAuth] Erro:', error.message);
        res.status(500).send('Erro ao iniciar autenticacao');
    }
});

/**
 * Callback OAuth - DEPRECATED: Redireciona para mlwebhook
 * Mantido para compatibilidade com URLs antigas
 * GET /mlOAuthCallback?code=XXX&state=YYY
 */
exports.mlOAuthCallback = functions.https.onRequest(async (req, res) => {
    if (!applyRateLimit(req, res, 'auth')) return;
    // Redirecionar para mlwebhook mantendo query params
    const queryString = Object.entries(req.query)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&');
    res.redirect(`${FUNCTIONS_URL}/mlwebhook?${queryString}`);
});

/**
 * Webhook do Mercado Livre - Recebe notificacoes E OAuth callback
 * GET /mlwebhook?code=XXX&state=YYY (OAuth callback com PKCE)
 * POST /mlwebhook (Webhook notificacoes)
 */
exports.mlwebhook = functions.https.onRequest(async (req, res) => {
    // Webhook do ML - limite mais alto para nao bloquear notificacoes
    if (!applyRateLimit(req, res, 'webhook')) return;

    // GET com code = OAuth callback
    if (req.method === 'GET' && req.query.code) {
        const { code, state } = req.query;

        try {
            // Recuperar code_verifier do Firestore usando STATE (evita race condition)
            const pkceDocId = state ? `pkce_${state}` : 'pkce';
            const pkceDoc = await db.collection('mlCredentials').doc(pkceDocId).get();

            if (!pkceDoc.exists) {
                console.error('[mlwebhook] PKCE code_verifier nao encontrado para state:', state);
                return res.redirect(`${BASE_URL}/marketplace/?ml_error=true&reason=pkce_not_found`);
            }

            const { codeVerifier, expiresAt } = pkceDoc.data();

            // Verificar se PKCE expirou
            if (expiresAt && new Date() > new Date(expiresAt)) {
                console.error('[mlwebhook] PKCE expirado');
                await db.collection('mlCredentials').doc(pkceDocId).delete();
                return res.redirect(`${BASE_URL}/marketplace/?ml_error=true&reason=pkce_expired`);
            }

            // Trocar code por access_token (com PKCE)
            const tokenResponse = await axios.post(ML_CONFIG.tokenUrl, {
                grant_type: 'authorization_code',
                client_id: ML_CONFIG.appId,
                client_secret: ML_CONFIG.secretKey,
                code: code,
                redirect_uri: ML_CONFIG.redirectUri,
                code_verifier: codeVerifier
            });

            const { access_token, refresh_token, expires_in, user_id } = tokenResponse.data;

            // Buscar informacoes do usuario ML
            const userResponse = await axios.get(`${ML_CONFIG.apiUrl}/users/${user_id}`, {
                headers: { Authorization: `Bearer ${access_token}` }
            });

            const mlUser = userResponse.data;

            // Salvar tokens no Firestore
            await db.collection('mlCredentials').doc('tokens').set({
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresAt: admin.firestore.Timestamp.fromDate(
                    new Date(Date.now() + expires_in * 1000)
                ),
                userId: user_id,
                nickname: mlUser.nickname,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Limpar documento PKCE usado
            await db.collection('mlCredentials').doc(pkceDocId).delete();

            // Redirecionar para pagina de sucesso
            return res.redirect(`${BASE_URL}/marketplace/?ml_connected=true`);

        } catch (error) {
            console.error('[mlwebhook] Erro no OAuth:', error.response?.data || error.message);
            return res.redirect(`${BASE_URL}/marketplace/?ml_error=true`);
        }
    }

    // POST = Webhook de notificacoes do ML
    if (req.method === 'POST') {
        const notification = req.body;

        // Log sem dados sensiveis
        console.log('[mlwebhook] Notificacao ML:', notification.topic, notification.resource);

        try {
            // Salvar notificacao para processamento
            await db.collection('mlNotifications').add({
                ...notification,
                receivedAt: admin.firestore.FieldValue.serverTimestamp(),
                processed: false
            });

            res.status(200).send('OK');
        } catch (error) {
            console.error('Erro ao processar notificacao ML:', error);
            res.status(500).send('Erro interno');
        }
    } else {
        // GET para validacao do endpoint
        res.status(200).send('Webhook ML ativo');
    }
});

// ========================================
// UTILITARIOS DE TOKEN
// ========================================

/**
 * Renovar access_token usando refresh_token
 */
async function refreshAccessToken() {
    const credDoc = await db.collection('mlCredentials').doc('tokens').get();

    if (!credDoc.exists) {
        throw new Error('Credenciais ML nao encontradas');
    }

    const { refreshToken } = credDoc.data();

    const response = await axios.post(ML_CONFIG.tokenUrl, {
        grant_type: 'refresh_token',
        client_id: ML_CONFIG.appId,
        client_secret: ML_CONFIG.secretKey,
        refresh_token: refreshToken
    });

    const { access_token, refresh_token, expires_in } = response.data;

    // Atualizar tokens no Firestore
    await db.collection('mlCredentials').doc('tokens').update({
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + expires_in * 1000)
        ),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return access_token;
}

/**
 * Obter access_token valido (renova se necessario)
 */
async function getValidAccessToken() {
    const credDoc = await db.collection('mlCredentials').doc('tokens').get();

    if (!credDoc.exists) {
        throw new Error('Mercado Livre nao conectado');
    }

    const { accessToken, expiresAt } = credDoc.data();

    // Verificar se token ainda e valido (com margem de 5 minutos)
    const now = new Date();
    const expiry = expiresAt.toDate();

    if (now >= new Date(expiry.getTime() - 5 * 60 * 1000)) {
        // Token expirado ou prestes a expirar, renovar
        return await refreshAccessToken();
    }

    return accessToken;
}

// ========================================
// STATUS E LISTAGEM
// ========================================

/**
 * Verificar status da conexao ML
 * GET /mlStatus
 */
exports.mlStatus = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!applyRateLimit(req, res, 'readonly')) return;

    try {
        const credDoc = await db.collection('mlCredentials').doc('tokens').get();

        if (!credDoc.exists) {
            return res.json({ connected: false });
        }

        const { nickname, expiresAt, userId } = credDoc.data();
        const isExpired = new Date() >= expiresAt.toDate();

        res.json({
            connected: !isExpired,
            nickname,
            userId,
            expiresAt: expiresAt.toDate().toISOString()
        });

    } catch (error) {
        console.error('[mlStatus] Erro:', error.message);
        res.status(500).json({ error: 'Erro ao verificar status' });
    }
});

// ========== ADMIN MANAGEMENT ENDPOINTS ==========

/**
 * Retorna lista de administradores ativos
 * GET /getAdmins
 * REQUER AUTENTICACAO
 */
exports.getAdmins = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }
    if (!applyRateLimit(req, res, 'default')) return;

    // Verificar autenticacao
    const authResult = await verifyAdminToken(req);
    if (!authResult.isAdmin) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Apenas administradores podem acessar esta funcao'
        });
    }

    try {
        const adminsSnapshot = await db.collection('admins')
            .where('active', '==', true)
            .get();

        const admins = adminsSnapshot.docs.map(doc => ({
            uid: doc.id,
            email: doc.data().email,
            name: doc.data().name,
            photoURL: doc.data().photoURL || null,
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
        }));

        res.json({ success: true, admins });

    } catch (error) {
        console.error('[getAdmins] Erro:', error);
        res.status(500).json({ error: 'Erro ao buscar administradores' });
    }
});

/**
 * Inicializar admins no Firestore (ENDPOINT TEMPORARIO)
 * POST /initAdmins
 * APENAS Super Admin pode executar
 * Cria documentos na colecao admins para cada email da lista
 */
exports.initAdmins = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }
    if (!applyRateLimit(req, res, 'sensitive')) return;

    // Verificar autenticacao - apenas Super Admin
    const authResult = await verifyAdminToken(req);
    if (!authResult.isAdmin || authResult.email !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Apenas o Super Admin pode inicializar os administradores'
        });
    }

    // Lista de admins a serem criados
    const adminsToCreate = [
        { email: '3d3printers@gmail.com', name: 'ADMIN' },
        { email: 'netrindademarcus@gmail.com', name: 'Trindade' },
        { email: 'quequell1010@gmail.com', name: 'Raquel' },
        { email: 'igor.butter@gmail.com', name: 'Leao' },
        { email: 'contato.elainesas@gmail.com', name: 'Elaine' }
    ];

    const results = [];

    for (const adminData of adminsToCreate) {
        try {
            // Buscar usuario pelo email no Firebase Auth
            const userRecord = await admin.auth().getUserByEmail(adminData.email);
            const uid = userRecord.uid;

            // Verificar se ja existe
            const existingDoc = await db.collection('admins').doc(uid).get();
            if (existingDoc.exists) {
                results.push({
                    email: adminData.email,
                    status: 'already_exists',
                    uid: uid
                });
                continue;
            }

            // Criar documento do admin
            await db.collection('admins').doc(uid).set({
                email: adminData.email,
                name: adminData.name,
                photoURL: userRecord.photoURL || null,
                active: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdBy: authResult.email
            });

            // Definir custom claim para Storage Rules
            await admin.auth().setCustomUserClaims(uid, { admin: true });

            results.push({
                email: adminData.email,
                status: 'created',
                uid: uid,
                customClaims: true
            });

        } catch (error) {
            console.error(`[initAdmins] Erro ao criar admin ${adminData.email}:`, error);
            results.push({
                email: adminData.email,
                status: 'error',
                error: error.code === 'auth/user-not-found'
                    ? 'Usuario nao encontrado no Firebase Auth'
                    : error.message
            });
        }
    }

    res.json({
        success: true,
        message: 'Inicializacao concluida',
        results
    });
});

// ========================================
// CUSTOM CLAIMS PARA STORAGE RULES
// Triggers automaticos quando admins sao modificados
// ========================================

/**
 * Trigger: Quando um admin e criado ou atualizado
 * Define custom claim 'admin: true' no token do usuario
 */
exports.onAdminCreatedOrUpdated = functions.firestore
    .document('admins/{userId}')
    .onWrite(async (change, context) => {
        const userId = context.params.userId;

        try {
            // Documento deletado
            if (!change.after.exists) {
                console.log(`[CustomClaims] Admin ${userId} removido, removendo claim`);
                await admin.auth().setCustomUserClaims(userId, { admin: false });
                return { success: true, action: 'removed' };
            }

            const adminData = change.after.data();
            const isActive = adminData.active === true;

            // Definir custom claim baseado no status active
            console.log(`[CustomClaims] Definindo admin=${isActive} para ${userId} (${adminData.email})`);
            await admin.auth().setCustomUserClaims(userId, { admin: isActive });

            // Atualizar timestamp para forcar refresh do token no frontend
            await change.after.ref.update({
                claimsUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return { success: true, action: isActive ? 'granted' : 'revoked', email: adminData.email };

        } catch (error) {
            console.error(`[CustomClaims] Erro ao definir claims para ${userId}:`, error);
            return { success: false, error: error.message };
        }
    });

/**
 * Endpoint HTTP para forcar refresh de custom claims de todos os admins
 * Util para migracao inicial ou correcao de inconsistencias
 * POST /refreshAdminClaims
 */
exports.refreshAdminClaims = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }
    if (!applyRateLimit(req, res, 'sensitive')) return;

    // Verificar autenticacao - apenas Super Admin
    const authResult = await verifyAdminToken(req);
    if (!authResult.isAdmin || authResult.email !== SUPER_ADMIN_EMAIL) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Apenas o Super Admin pode executar esta acao'
        });
    }

    try {
        const adminsSnapshot = await db.collection('admins').get();
        const results = [];

        for (const doc of adminsSnapshot.docs) {
            const adminData = doc.data();
            const userId = doc.id;
            const isActive = adminData.active === true;

            try {
                await admin.auth().setCustomUserClaims(userId, { admin: isActive });
                results.push({
                    email: adminData.email,
                    uid: userId,
                    admin: isActive,
                    status: 'success'
                });
            } catch (error) {
                results.push({
                    email: adminData.email,
                    uid: userId,
                    status: 'error',
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            message: `Custom claims atualizados para ${results.length} admins`,
            results
        });

    } catch (error) {
        console.error('[refreshAdminClaims] Erro:', error);
        res.status(500).json({
            error: 'Erro ao atualizar claims',
            message: error.message
        });
    }
});

/**
 * Verificar senha de bypass para acoes especiais (ex: pular foto obrigatoria)
 * POST /verifyBypassPassword
 * Body: { password: string }
 * Requer: Admin autenticado
 */
exports.verifyBypassPassword = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }
    // Rate limit mais restritivo para endpoint de senha
    if (!applyRateLimit(req, res, 'sensitive')) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    // Verificar autenticacao - apenas admins podem usar bypass
    const authResult = await verifyAdminToken(req);
    if (!authResult.isAdmin) {
        return res.status(403).json({
            success: false,
            error: 'Acesso negado',
            message: 'Apenas administradores podem usar esta funcao'
        });
    }

    const { password } = req.body || {};

    if (!password) {
        return res.status(400).json({
            success: false,
            error: 'Senha nao fornecida'
        });
    }

    // Senha armazenada EXCLUSIVAMENTE no backend (.env) - SEM FALLBACK
    const BYPASS_PASSWORD = process.env.BYPASS_PASSWORD;
    if (!BYPASS_PASSWORD) {
        console.error('[Bypass] BYPASS_PASSWORD nao configurado no ambiente');
        return res.status(500).json({
            success: false,
            error: 'Configuracao de bypass ausente'
        });
    }

    if (password === BYPASS_PASSWORD) {
        // Log da acao para auditoria
        console.log(`[Bypass] Admin ${authResult.email} usou bypass de senha`);

        return res.json({
            success: true,
            message: 'Senha validada'
        });
    } else {
        console.warn(`[Bypass] Tentativa falha de ${authResult.email}`);
        return res.status(401).json({
            success: false,
            error: 'Senha incorreta'
        });
    }
});

/**
 * Buscar anuncios do usuario no ML
 * GET /mlListItems
 */
exports.mlListItems = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!applyRateLimit(req, res, 'readonly')) return;

    try {
        const accessToken = await getValidAccessToken();
        const credDoc = await db.collection('mlCredentials').doc('tokens').get();
        const { userId } = credDoc.data();

        // Buscar IDs dos anuncios
        const itemsResponse = await axios.get(
            `${ML_CONFIG.apiUrl}/users/${userId}/items/search`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
                params: { limit: 100 }
            }
        );

        const itemIds = itemsResponse.data.results;

        // Buscar detalhes dos anuncios (em lotes de 20)
        const items = [];
        for (let i = 0; i < itemIds.length; i += 20) {
            const batch = itemIds.slice(i, i + 20);
            const detailsResponse = await axios.get(
                `${ML_CONFIG.apiUrl}/items`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    params: { ids: batch.join(',') }
                }
            );
            items.push(...detailsResponse.data.map(item => item.body));
        }

        res.json({ items });

    } catch (error) {
        console.error('[mlListItems] Erro:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Erro ao listar anuncios',
            details: error.response?.data || error.message
        });
    }
});

// ========================================
// MONITORAMENTO DE VENDAS
// ========================================

/**
 * Buscar pedidos pendentes (pagos, aguardando envio)
 * GET /mlGetPendingOrders
 */
exports.mlGetPendingOrders = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!applyRateLimit(req, res, 'readonly')) return;

    try {
        const accessToken = await getValidAccessToken();
        const credDoc = await db.collection('mlCredentials').doc('tokens').get();
        const { userId } = credDoc.data();

        // Buscar pedidos com status "paid" (pagos, aguardando envio)
        const response = await axios.get(
            `${ML_CONFIG.apiUrl}/orders/search`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
                params: {
                    seller: userId,
                    'order.status': 'paid',
                    sort: 'date_desc',
                    limit: 50
                }
            }
        );

        const orders = response.data.results || [];

        // Formatar dados para o frontend
        const formattedOrders = orders.map(order => ({
            id: order.id,
            dateCreated: order.date_created,
            status: order.status,
            statusDetail: order.status_detail,
            totalAmount: order.total_amount,
            buyer: {
                id: order.buyer?.id,
                nickname: order.buyer?.nickname,
                firstName: order.buyer?.first_name,
                lastName: order.buyer?.last_name
            },
            items: order.order_items?.map(item => ({
                id: item.item?.id,
                title: item.item?.title,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                thumbnail: item.item?.thumbnail || null
            })) || [],
            shipping: {
                id: order.shipping?.id,
                status: order.shipping?.status
            }
        }));

        res.json({
            success: true,
            total: response.data.paging?.total || orders.length,
            orders: formattedOrders
        });

    } catch (error) {
        console.error('[mlGetPendingOrders] Erro:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Erro ao buscar pedidos',
            details: error.response?.data || error.message
        });
    }
});

/**
 * Buscar historico de vendas (entregues/finalizadas)
 * GET /mlGetSalesHistory?days=30
 */
exports.mlGetSalesHistory = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!applyRateLimit(req, res, 'readonly')) return;

    try {
        const accessToken = await getValidAccessToken();
        const credDoc = await db.collection('mlCredentials').doc('tokens').get();
        const { userId } = credDoc.data();

        const days = parseInt(req.query.days) || 30;
        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - days);

        // Buscar pedidos finalizados
        const response = await axios.get(
            `${ML_CONFIG.apiUrl}/orders/search`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
                params: {
                    seller: userId,
                    'order.date_created.from': dateFrom.toISOString(),
                    sort: 'date_desc',
                    limit: 100
                }
            }
        );

        const orders = response.data.results || [];

        // Filtrar apenas pedidos entregues ou concluidos
        const deliveredOrders = orders.filter(order =>
            order.status === 'delivered' ||
            order.status === 'confirmed' ||
            (order.shipping?.status === 'delivered')
        );

        // Formatar dados
        const formattedOrders = deliveredOrders.map(order => ({
            id: order.id,
            dateCreated: order.date_created,
            dateClosed: order.date_closed,
            status: order.status,
            totalAmount: order.total_amount,
            buyer: {
                nickname: order.buyer?.nickname,
                firstName: order.buyer?.first_name,
                lastName: order.buyer?.last_name
            },
            items: order.order_items?.map(item => ({
                id: item.item?.id,
                title: item.item?.title,
                quantity: item.quantity,
                unitPrice: item.unit_price
            })) || []
        }));

        // Calcular totais
        const totalRevenue = formattedOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
        const totalOrders = formattedOrders.length;

        res.json({
            success: true,
            period: `${days} dias`,
            totalOrders,
            totalRevenue,
            orders: formattedOrders
        });

    } catch (error) {
        console.error('[mlGetSalesHistory] Erro:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Erro ao buscar historico',
            details: error.response?.data || error.message
        });
    }
});

/**
 * Buscar detalhes de um pedido especifico
 * GET /mlGetOrderDetails?orderId=123456789
 */
exports.mlGetOrderDetails = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!applyRateLimit(req, res, 'readonly')) return;

    const { orderId } = req.query;

    if (!orderId) {
        return res.status(400).json({ error: 'orderId obrigatorio' });
    }

    try {
            const accessToken = await getValidAccessToken();

            // Buscar detalhes do pedido
            const orderResponse = await axios.get(
                `${ML_CONFIG.apiUrl}/orders/${orderId}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            const order = orderResponse.data;

            // Buscar detalhes do envio se existir
            let shipping = null;
            if (order.shipping?.id) {
                try {
                    const shippingResponse = await axios.get(
                        `${ML_CONFIG.apiUrl}/shipments/${order.shipping.id}`,
                        { headers: { Authorization: `Bearer ${accessToken}` } }
                    );
                    shipping = shippingResponse.data;
                } catch (e) {
                    console.log('Nao foi possivel buscar envio:', e.message);
                }
            }

            res.json({
                success: true,
                order: {
                    id: order.id,
                    dateCreated: order.date_created,
                    dateClosed: order.date_closed,
                    status: order.status,
                    statusDetail: order.status_detail,
                    totalAmount: order.total_amount,
                    currencyId: order.currency_id,
                    buyer: {
                        id: order.buyer?.id,
                        nickname: order.buyer?.nickname,
                        firstName: order.buyer?.first_name,
                        lastName: order.buyer?.last_name,
                        email: order.buyer?.email
                    },
                    items: order.order_items?.map(item => ({
                        id: item.item?.id,
                        title: item.item?.title,
                        sku: item.item?.seller_custom_field,
                        quantity: item.quantity,
                        unitPrice: item.unit_price,
                        fullUnitPrice: item.full_unit_price
                    })) || [],
                    payments: order.payments?.map(p => ({
                        id: p.id,
                        status: p.status,
                        statusDetail: p.status_detail,
                        transactionAmount: p.transaction_amount,
                        dateApproved: p.date_approved
                    })) || []
                },
                shipping: shipping ? {
                    id: shipping.id,
                    status: shipping.status,
                    substatus: shipping.substatus,
                    trackingNumber: shipping.tracking_number,
                    trackingMethod: shipping.tracking_method,
                    receiverAddress: shipping.receiver_address ? {
                        city: shipping.receiver_address.city?.name,
                        state: shipping.receiver_address.state?.name,
                        zipCode: shipping.receiver_address.zip_code,
                        streetName: shipping.receiver_address.street_name,
                        streetNumber: shipping.receiver_address.street_number
                    } : null
                } : null
            });

    } catch (error) {
        console.error('[mlGetOrderDetails] Erro:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Erro ao buscar detalhes',
            details: error.response?.data || error.message
        });
    }
});

/**
 * Buscar detalhes de um anuncio (para vincular)
 * GET /mlGetItemDetails?mlbId=MLB123456789
 */
exports.mlGetItemDetails = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!applyRateLimit(req, res, 'readonly')) return;

    const { mlbId } = req.query;

    if (!mlbId) {
        return res.status(400).json({ error: 'mlbId obrigatorio' });
    }

    try {
        const accessToken = await getValidAccessToken();

        // Buscar detalhes do anuncio e descricao em paralelo
        const [itemResponse, descResponse] = await Promise.all([
            axios.get(
                `${ML_CONFIG.apiUrl}/items/${mlbId}`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            ),
            axios.get(
                `${ML_CONFIG.apiUrl}/items/${mlbId}/description`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            ).catch(() => ({ data: { plain_text: '' } }))  // Descricao pode nao existir
        ]);

        const item = itemResponse.data;
        const description = descResponse.data?.plain_text || '';

        // Verificar se e item de catalogo (tem catalog_product_id ou family_name)
        const isCatalogItem = !!(item.catalog_product_id || item.family_name);

        res.json({
            success: true,
            item: {
                id: item.id,
                title: item.title,
                description: description,
                price: item.price,
                currencyId: item.currency_id,
                availableQuantity: item.available_quantity,
                soldQuantity: item.sold_quantity,
                status: item.status,
                permalink: item.permalink,
                thumbnail: item.thumbnail,
                pictures: item.pictures?.map(p => ({
                    id: p.id,
                    url: p.secure_url || p.url
                })) || [],
                categoryId: item.category_id,
                condition: item.condition,
                listingTypeId: item.listing_type_id,
                sku: item.seller_custom_field,
                dateCreated: item.date_created,
                lastUpdated: item.last_updated,
                isCatalogItem: isCatalogItem
            }
        });

    } catch (error) {
        console.error('[mlGetItemDetails] Erro:', error.response?.data || error.message);

        if (error.response?.status === 404) {
            return res.status(404).json({ error: 'Anuncio nao encontrado' });
        }

        res.status(500).json({
            error: 'Erro ao buscar detalhes',
            details: error.response?.data || error.message
        });
    }
});

/**
 * Atualizar preco de um anuncio
 * POST /mlUpdatePrice
 * Body: { mlbId: "MLB123456789", price: 99.90 }
 */
exports.mlUpdatePrice = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!applyRateLimit(req, res, 'default')) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    const { mlbId, price } = req.body;

    if (!mlbId) {
        return res.status(400).json({ error: 'mlbId obrigatorio' });
    }

    if (price === undefined || price <= 0) {
        return res.status(400).json({ error: 'price obrigatorio e deve ser > 0' });
    }

    try {
        const accessToken = await getValidAccessToken();

        // Atualizar preco no ML
        await axios.put(
            `${ML_CONFIG.apiUrl}/items/${mlbId}`,
            { price: parseFloat(price) },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        console.log(`[mlUpdatePrice] ${mlbId} atualizado para ${price}`);

        res.json({
            success: true,
            message: 'Preco atualizado com sucesso',
            mlbId: mlbId,
            newPrice: parseFloat(price)
        });

    } catch (error) {
        console.error('[mlUpdatePrice] Erro:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Erro ao atualizar preco',
            details: error.response?.data || error.message
        });
    }
});

/**
 * Atualizar quantidade em estoque de um anuncio
 * POST /mlUpdateStock
 * Body: { mlbId: "MLB123456789", quantity: 10 }
 */
exports.mlUpdateStock = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!applyRateLimit(req, res, 'default')) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    const { mlbId, quantity } = req.body;

    if (!mlbId) {
        return res.status(400).json({ error: 'mlbId obrigatorio' });
    }

    if (quantity === undefined || quantity < 0) {
        return res.status(400).json({ error: 'quantity obrigatorio e deve ser >= 0' });
    }

    try {
        const accessToken = await getValidAccessToken();

        // Atualizar quantidade no ML
        await axios.put(
            `${ML_CONFIG.apiUrl}/items/${mlbId}`,
            { available_quantity: parseInt(quantity) },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        console.log(`[mlUpdateStock] ${mlbId} atualizado para ${quantity}`);

        res.json({
            success: true,
            message: 'Estoque atualizado com sucesso',
            mlbId: mlbId,
            newQuantity: parseInt(quantity)
        });

    } catch (error) {
        console.error('[mlUpdateStock] Erro:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Erro ao atualizar estoque',
            details: error.response?.data || error.message
        });
    }
});

/**
 * Atualizar descricao de um anuncio
 * POST /mlUpdateDescription
 * Body: { mlbId: "MLB123456789", description: "Nova descricao" }
 */
exports.mlUpdateDescription = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }
    if (!applyRateLimit(req, res, 'default')) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    const { mlbId, description } = req.body;

    if (!mlbId) {
        return res.status(400).json({ error: 'mlbId obrigatorio' });
    }

    if (description === undefined) {
        return res.status(400).json({ error: 'description obrigatorio' });
    }

    try {
        const accessToken = await getValidAccessToken();

        // Atualizar descricao no ML (endpoint especifico)
        const response = await axios.put(
            `${ML_CONFIG.apiUrl}/items/${mlbId}/description`,
            { plain_text: description },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`Descricao ${mlbId} atualizada`);

        res.json({
            success: true,
            message: 'Descricao atualizada com sucesso',
            mlbId: mlbId
        });

    } catch (error) {
        console.error('Erro ao atualizar descricao:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Erro ao atualizar descricao',
            details: error.response?.data || error.message
        });
    }
});

/**
 * Atualizar titulo de um anuncio
 * POST /mlUpdateTitle
 * Body: { mlbId: "MLB123456789", title: "Novo titulo" }
 */
exports.mlUpdateTitle = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!applyRateLimit(req, res, 'default')) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    const { mlbId, title } = req.body;

    if (!mlbId) {
        return res.status(400).json({ error: 'mlbId obrigatorio' });
    }

    if (!title || title.trim().length === 0) {
        return res.status(400).json({ error: 'title obrigatorio e nao pode ser vazio' });
    }

    try {
        const accessToken = await getValidAccessToken();

        // Atualizar titulo no ML
        const response = await axios.put(
            `${ML_CONFIG.apiUrl}/items/${mlbId}`,
            { title: title.trim() },
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`Titulo ${mlbId} atualizado para: ${title}`);

        res.json({
            success: true,
            message: 'Titulo atualizado com sucesso',
            mlbId: mlbId,
            newTitle: title.trim()
        });

    } catch (error) {
        console.error('Erro ao atualizar titulo:', error.response?.data || error.message);

        // Verificar se e erro de catalogo do ML
        const mlError = error.response?.data;
        if (mlError && mlError.error === 'You cannot modify the title if the item has a family_name') {
            return res.status(400).json({
                success: false,
                error: 'Titulo nao pode ser alterado',
                reason: 'catalog_item',
                message: 'Este anuncio esta vinculado a um catalogo do Mercado Livre. O titulo e gerenciado pelo catalogo.'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Erro ao atualizar titulo',
            details: error.response?.data || error.message
        });
    }
});

// ========================================
// SINCRONIZACAO DE FOTOS
// ========================================

/**
 * Fazer upload de uma foto para o ML
 * Recebe base64, retorna picture_id
 */
async function uploadPictureToMl(base64Data, accessToken) {
    try {
        // Extrair dados do base64
        const matches = base64Data.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
        if (!matches) {
            console.error('[uploadPictureToMl] Formato base64 invalido');
            return null;
        }

        const imageType = matches[1].toLowerCase();
        const base64Content = matches[2];
        const buffer = Buffer.from(base64Content, 'base64');

        // Criar FormData para upload multipart
        const FormData = require('form-data');
        const form = new FormData();
        form.append('file', buffer, {
            filename: `photo.${imageType === 'jpeg' ? 'jpg' : imageType}`,
            contentType: `image/${imageType}`
        });

        const uploadResponse = await axios.post(
            'https://api.mercadolibre.com/pictures/items/upload',
            form,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    ...form.getHeaders()
                }
            }
        );

        if (uploadResponse.data && uploadResponse.data.id) {
            console.log('[uploadPictureToMl] Upload OK:', uploadResponse.data.id);
            return uploadResponse.data.id;
        } else {
            console.error('[uploadPictureToMl] Resposta sem ID:', uploadResponse.data);
            return null;
        }

    } catch (error) {
        console.error('[uploadPictureToMl] Erro:', error.response?.data || error.message);
        return null;
    }
}

/**
 * Atualizar fotos de um anuncio no ML
 * POST /mlUpdateItemPhotos
 * Body: { mlbId: "MLB123", pictures: [{ type: 'ml'|'local', url: string, id?: string }] }
 *
 * - Fotos type='ml' com id: mantidas pelo ID
 * - Fotos type='local' com url base64: upload + adiciona
 * - A ORDEM do array determina a ordem no anuncio
 * - Fotos nao incluidas sao REMOVIDAS do anuncio
 */
exports.mlUpdateItemPhotos = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!applyRateLimit(req, res, 'default')) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    const { mlbId, pictures } = req.body;

    if (!mlbId) {
        return res.status(400).json({ success: false, error: 'mlbId obrigatorio' });
    }

    if (!pictures || !Array.isArray(pictures)) {
        return res.status(400).json({ success: false, error: 'pictures deve ser um array' });
    }

    try {
        const accessToken = await getValidAccessToken();

        const finalPictures = [];
        const uploadResults = [];

        console.log(`[mlUpdateItemPhotos] Processando ${pictures.length} fotos para ${mlbId}`);

        // Processar cada foto
        for (let i = 0; i < pictures.length; i++) {
            const pic = pictures[i];

            if (pic.type === 'ml' && pic.id) {
                // Foto ja existe no ML - manter pelo ID
                finalPictures.push({ id: pic.id });
                uploadResults.push({ index: i, type: 'ml', status: 'kept', id: pic.id });
                console.log(`[mlUpdateItemPhotos] Foto ${i}: ML existente, mantida (${pic.id})`);

            } else if (pic.type === 'local' && pic.url && pic.url.startsWith('data:image')) {
                // Foto local com base64 - fazer upload
                console.log(`[mlUpdateItemPhotos] Foto ${i}: Local, iniciando upload...`);
                const uploadedId = await uploadPictureToMl(pic.url, accessToken);

                if (uploadedId) {
                    finalPictures.push({ id: uploadedId });
                    uploadResults.push({ index: i, type: 'local', status: 'uploaded', id: uploadedId });
                    console.log(`[mlUpdateItemPhotos] Foto ${i}: Upload OK (${uploadedId})`);
                } else {
                    uploadResults.push({ index: i, type: 'local', status: 'failed' });
                    console.error(`[mlUpdateItemPhotos] Foto ${i}: Upload falhou`);
                }
            } else {
                console.warn(`[mlUpdateItemPhotos] Foto ${i}: Ignorada (tipo=${pic.type}, temUrl=${!!pic.url})`);
                uploadResults.push({ index: i, type: pic.type, status: 'ignored' });
            }
        }

        if (finalPictures.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhuma foto valida para sincronizar',
                uploadResults
            });
        }

        console.log(`[mlUpdateItemPhotos] Atualizando ${mlbId} com ${finalPictures.length} fotos`);

        // Atualizar item com novo array de fotos
        const updateResponse = await axios.put(
            `${ML_CONFIG.apiUrl}/items/${mlbId}`,
            { pictures: finalPictures },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const updateData = updateResponse.data;

        // Extrair URLs atualizadas das fotos
        const updatedPhotos = updateData.pictures?.map(p => ({
            id: p.id,
            url: (p.secure_url || p.url || '').replace(/^http:\/\//i, 'https://')
        })) || [];

        console.log(`[mlUpdateItemPhotos] Sucesso! ${updatedPhotos.length} fotos no anuncio`);

        return res.json({
            success: true,
            photos: updatedPhotos,
            count: updatedPhotos.length,
            uploadResults
        });

    } catch (error) {
        console.error('[mlUpdateItemPhotos] Erro:', error.response?.data || error.message);

        // Erro especifico da API do ML
        if (error.response?.data) {
            return res.status(400).json({
                success: false,
                error: error.response.data.message || 'Erro ao atualizar fotos no ML',
                details: error.response.data
            });
        }

        return res.status(500).json({
            success: false,
            error: error.message || 'Erro interno ao atualizar fotos'
        });
    }
});

// ========================================
// WHATSAPP BOT - CONFIGURACAO
// ========================================

// SDK Google GenAI atualizado (substituiu @google/generative-ai em nov/2025)
const { GoogleGenAI } = require('@google/genai');

// Configuracoes do WhatsApp Cloud API (variaveis de ambiente)
// Para configurar: Definir no arquivo .env.local ou no Firebase Console (Functions > Configuration)
const WA_CONFIG = {
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
    verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'imaginatech_whatsapp_verify_2024',
    apiVersion: 'v21.0',
    apiUrl: 'https://graph.facebook.com'
};

// Configuracao do Gemini
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Configuracao da OpenAI (para transcricao de audio com Whisper)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// ID do usuario da EMPRESA (para comandos com prefixo "empresa:")
// IMPORTANTE: Deve ser o MESMO ID usado no painel de financas (js/env-config.js)
// Email: 3d3printers@gmail.com | Nome: ImaginaTech
const COMPANY_USER_ID = process.env.COMPANY_USER_ID || 'BdmqXJFgMja4SY6DRXdf3dMyzaq1';

// Numeros autorizados para comandos de financas (formato: 5511999999999)
// Se vazio, qualquer numero cadastrado em whatsappUsers pode usar
const AUTHORIZED_WHATSAPP_NUMBERS = (process.env.AUTHORIZED_WHATSAPP_NUMBERS || '').split(',').filter(Boolean);

// Lista de saudacoes simples (nao precisa carregar overview completa)
const SIMPLE_GREETINGS = ['oi', 'ola', 'olá', 'hey', 'hi', 'hello', 'bom dia', 'boa tarde', 'boa noite', 'e ai', 'eai', 'salve', 'fala'];

// ========================================
// WHATSAPP BOT - MAPEAMENTO DE USUARIOS
// ========================================

/**
 * Buscar userId pelo numero de WhatsApp
 * Colecao: whatsappUsers/{numero} -> { userId, userName, createdAt }
 * @param {string} whatsappNumber - Numero no formato 5511999999999
 * @returns {Promise<{userId: string, userName: string} | null>}
 */
async function getUserByWhatsAppNumber(whatsappNumber) {
    try {
        const doc = await db.collection('whatsappUsers').doc(whatsappNumber).get();
        if (doc.exists) {
            const data = doc.data();
            return {
                userId: data.userId,
                userName: data.userName || 'Usuario'
            };
        }
        return null;
    } catch (error) {
        console.error('[getUserByWhatsAppNumber] Erro:', error.message);
        return null;
    }
}

/**
 * Registrar numero de WhatsApp para um usuario
 * @param {string} whatsappNumber - Numero no formato 5511999999999
 * @param {string} userId - Firebase Auth UID
 * @param {string} userName - Nome do usuario
 */
async function registerWhatsAppUser(whatsappNumber, userId, userName) {
    await db.collection('whatsappUsers').doc(whatsappNumber).set({
        userId: userId,
        userName: userName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`[registerWhatsAppUser] ${whatsappNumber} -> ${userId} (${userName})`);
}

/**
 * Parsear contexto da mensagem (grupo vs individual, mencoes, empresa vs pessoal)
 *
 * REGRAS:
 * - Em GRUPOS: mencao obrigatoria (@Claytinho ou @Empresa)
 *   - @Claytinho = conta pessoal
 *   - @Empresa = conta da empresa
 *   - Sem mencao = ignora mensagem
 *
 * - Em CHAT INDIVIDUAL: funciona como antes
 *   - @Empresa = conta da empresa
 *   - Sem prefixo = conta pessoal
 *
 * @param {string} text - Texto original da mensagem
 * @param {boolean} isGroup - Se a mensagem veio de um grupo
 * @returns {{ shouldProcess: boolean, isCompany: boolean, cleanText: string, mentionType: string|null }}
 */
function parseMessageContext(text, isGroup) {
    // Regex para detectar mencoes (@Claytinho ou @Empresa) em qualquer posicao
    const claytinhoRegex = /@claytinho\s*/gi;
    const empresaRegex = /@empresa\s*/gi;

    const hasClaytinho = claytinhoRegex.test(text);
    const hasEmpresa = empresaRegex.test(text);

    // Reset regex lastIndex para usar novamente
    claytinhoRegex.lastIndex = 0;
    empresaRegex.lastIndex = 0;

    if (isGroup) {
        // EM GRUPOS: mencao obrigatoria
        if (!hasClaytinho && !hasEmpresa) {
            // Sem mencao em grupo = ignorar
            return {
                shouldProcess: false,
                isCompany: false,
                cleanText: text,
                mentionType: null
            };
        }

        // Tem mencao - processar
        // @Empresa tem prioridade se ambas estiverem presentes
        const isCompany = hasEmpresa;

        // Remover as mencoes do texto
        let cleanText = text
            .replace(claytinhoRegex, '')
            .replace(empresaRegex, '')
            .trim();

        return {
            shouldProcess: true,
            isCompany: isCompany,
            cleanText: cleanText,
            mentionType: hasEmpresa ? '@Empresa' : '@Claytinho'
        };
    } else {
        // EM CHAT INDIVIDUAL: funciona como antes
        // @Empresa no inicio = empresa, senao = pessoal
        const prefixEmpresaRegex = /^@empresa\s*/i;

        if (prefixEmpresaRegex.test(text)) {
            return {
                shouldProcess: true,
                isCompany: true,
                cleanText: text.replace(prefixEmpresaRegex, '').trim(),
                mentionType: '@Empresa'
            };
        }

        // Tambem aceita @Claytinho no individual (remove e processa)
        if (hasClaytinho) {
            return {
                shouldProcess: true,
                isCompany: false,
                cleanText: text.replace(claytinhoRegex, '').trim(),
                mentionType: '@Claytinho'
            };
        }

        // Sem prefixo = conta pessoal (SEMPRE)
        return {
            shouldProcess: true,
            isCompany: false,
            cleanText: text,
            mentionType: null
        };
    }
}

// ========================================
// WHATSAPP BOT - FUNCOES AUXILIARES
// ========================================

/**
 * Mapa de apelidos populares para nomes de cartoes/bancos
 * Permite que usuarios usem termos informais como "roxinho" para Nubank
 */
const CARD_ALIASES = {
    // Nubank
    'roxinho': 'nubank', 'roxo': 'nubank', 'nu': 'nubank', 'nubank': 'nubank',
    // Inter
    'laranjinha': 'inter', 'laranja': 'inter', 'inter': 'inter',
    // C6
    'c6': 'c6 bank', 'carbono': 'c6 bank', 'c6 bank': 'c6 bank', 'c6bank': 'c6 bank',
    // Itau
    'itau': 'itau', 'itaú': 'itau', 'iti': 'itau',
    // Bradesco
    'bradesco': 'bradesco', 'brades': 'bradesco',
    // Banco do Brasil
    'bb': 'banco do brasil', 'ourocard': 'banco do brasil', 'banco do brasil': 'banco do brasil',
    // Caixa
    'caixa': 'caixa', 'cef': 'caixa',
    // Outros bancos
    'santander': 'santander', 'neon': 'neon', 'picpay': 'picpay',
    'mp': 'mercado pago', 'mercadopago': 'mercado pago', 'mercado pago': 'mercado pago',
    'will': 'will bank', 'will bank': 'will bank', 'willbank': 'will bank',
    'next': 'next', 'original': 'banco original', 'banco original': 'banco original',
    'pan': 'banco pan', 'banco pan': 'banco pan',
    'xp': 'xp', 'btg': 'btg'
};

// Categorias consideradas como economia/investimento (nao contam como gasto)
const SAVINGS_CATEGORIES = ['Investimentos', 'Poupanca', 'Reserva de Emergencia', 'Previdencia'];

/**
 * Buscar todos os cartoes de um usuario
 * @param {string} userId - ID do usuario no Firestore
 * @returns {Array} - Lista de cartoes com id, name e institution
 */
async function getUserCards(userId) {
    const cardsSnapshot = await db.collection('creditCards')
        .where('userId', '==', userId)
        .get();

    return cardsSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        institution: doc.data().institution || doc.data().name
    }));
}

/**
 * Gerar overview financeira em texto para enviar ao Gemini
 *
 * !!! SINCRONIZADO COM: financas/finance-data.js -> updateKPIs() !!!
 * Se editar os calculos aqui, edite tambem no frontend.
 *
 * @param {string} userId - ID do usuario
 * @param {string} userName - Nome do usuario
 * @returns {string} - Overview em texto
 */
async function buildFinancialOverview(userId, userName) {
    const { startOfMonth, endOfMonth, year: currentYear, month: currentMonth, monthName, daysRemaining } = getMonthBounds();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    try {
        // Carregar TODOS os dados em paralelo com Promise.allSettled (tolerante a falhas)
        // NOTA: Inclui userSettings para pegar cutoffDate (igual ao dashboard)
        // NOTA: Inclui creditCardPayments para verificar faturas pagas (igual ao dashboard)
        const results = await Promise.allSettled([
            db.collection('transactions').where('userId', '==', userId).get(),
            db.collection('projections').where('userId', '==', userId).get(),
            db.collection('subscriptions').where('userId', '==', userId).get(),
            db.collection('installments').where('userId', '==', userId).get(),
            db.collection('creditCards').where('userId', '==', userId).get(),
            db.collection('investments').where('userId', '==', userId).get(),
            db.collection('goals').where('userId', '==', userId).get(),
            db.collection('accounts').where('userId', '==', userId).get(),
            db.collection('userSettings').doc(userId).get(), // Para cutoffDate
            db.collection('creditCardPayments').where('userId', '==', userId).get() // Para verificar faturas pagas
        ]);

        // Extrair resultados (usar array vazio se falhou)
        const transSnap = results[0].status === 'fulfilled' ? results[0].value : { docs: [] };
        const projSnap = results[1].status === 'fulfilled' ? results[1].value : { docs: [] };
        const subsSnap = results[2].status === 'fulfilled' ? results[2].value : { docs: [] };
        const instSnap = results[3].status === 'fulfilled' ? results[3].value : { docs: [] };
        const cardsSnap = results[4].status === 'fulfilled' ? results[4].value : { docs: [] };
        const investSnap = results[5].status === 'fulfilled' ? results[5].value : { docs: [] };
        const goalsSnap = results[6].status === 'fulfilled' ? results[6].value : { docs: [] };
        const accountsSnap = results[7].status === 'fulfilled' ? results[7].value : { docs: [] };
        const userSettingsDoc = results[8].status === 'fulfilled' ? results[8].value : null;
        const paymentsSnap = results[9].status === 'fulfilled' ? results[9].value : { docs: [] };

        // Obter cutoffDate das configuracoes do usuario (igual ao dashboard)
        // SINCRONIZADO COM: finance-data.js linha ~2212
        const userSettings = userSettingsDoc?.exists ? userSettingsDoc.data() : {};
        const cutoffDate = userSettings.cutoffDate || null;
        console.log('[buildFinancialOverview] cutoffDate:', cutoffDate);

        // Log de erros parciais (sem interromper)
        const collections = ['transactions', 'projections', 'subscriptions', 'installments', 'creditCards', 'investments', 'goals', 'accounts', 'userSettings', 'creditCardPayments'];
        results.forEach((r, i) => {
            if (r.status === 'rejected') {
                console.warn(`[buildFinancialOverview] Erro ao buscar ${collections[i]}:`, r.reason?.message);
            }
        });

        // ============================================
        // PROCESSAR CARTOES DE CREDITO
        // ============================================
        const cardsData = cardsSnap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            faturaAtual: 0,
            faturaProximoMes: 0,
            gastosCredito: []
        }));
        const cardsByName = {};
        const cardsById = {};
        cardsData.forEach(c => {
            cardsByName[c.name?.toLowerCase()] = c;
            cardsById[c.id] = c;
        });

        // ============================================
        // PROCESSAR PAGAMENTOS DE FATURA (creditCardPayments)
        // SINCRONIZADO COM: finance-data.js linha 1061-1066 (isBillPaid)
        // ============================================
        const creditCardPayments = paymentsSnap.docs.map(d => ({
            id: d.id,
            ...d.data()
        }));

        // Funcao helper: verificar se fatura foi paga (identica ao dashboard)
        const isBillPaid = (cardId, month, year) => {
            return creditCardPayments.find(p =>
                p.cardId === cardId &&
                p.month === month &&
                p.year === year
            );
        };

        // ============================================
        // PROCESSAR PARCELAMENTOS (com cardId)
        // ============================================
        const installmentsData = instSnap.docs.map(d => ({
            id: d.id,
            ...d.data()
        }));

        // ============================================
        // PROCESSAR ASSINATURAS (com cardId)
        // ============================================
        const subscriptionsData = subsSnap.docs.map(d => ({
            id: d.id,
            ...d.data()
        }));

        // ============================================
        // PROCESSAR TODAS AS TRANSACOES
        // ============================================
        // !!! SINCRONIZADO COM: finance-data.js linhas ~2295-2329 !!!
        // A logica de calculo do saldo DEVE ser identica ao dashboard

        let totalIncome = 0, totalExpense = 0, totalSavings = 0;
        // SALDO: Apenas debito/pix/dinheiro afetam o saldo (credito e pago pela fatura)
        // IMPORTANTE: Usar logica IDENTICA ao dashboard (paymentMethod === 'credit')
        let allTimeIncomeDebit = 0, allTimeExpenseDebit = 0;
        // Gastos de credito do mes atual (para calculo de fatura)
        let creditExpensesThisMonth = 0;
        // Para estatisticas gerais (incluindo credito)
        let allTimeIncomeTotal = 0, allTimeExpenseTotal = 0, allTimeSavings = 0;
        const categoryTotals = {};
        const categoryTotalsAllTime = {};
        const allTransactions = [];
        const monthlyHistory = {}; // { "2026-01": { income: X, expense: Y }, ... }
        const expensesByCard = {}; // Gastos por cartao
        const expensesByPaymentMethod = { debit: 0, credit: 0, pix: 0, cash: 0, other: 0 };

        // Converter docs para array para processamento
        const transactionsArray = transSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // ============================================
        // CALCULO DO SALDO - LOGICA IDENTICA AO DASHBOARD
        // SINCRONIZADO COM: finance-data.js linhas 2295-2329
        // ============================================
        // Entradas: type === 'income' E paymentMethod !== 'credit' E date >= cutoffDate
        allTimeIncomeDebit = transactionsArray
            .filter(t => {
                // EXATAMENTE igual ao dashboard (linha 2297):
                // if (!t.type || t.type !== 'income' || t.paymentMethod === 'credit') return false;
                if (!t.type || t.type !== 'income' || t.paymentMethod === 'credit') return false;
                // Se ha data de corte, so conta transacoes apos essa data (linha 2299)
                if (cutoffDate && t.date < cutoffDate) return false;
                return true;
            })
            .reduce((sum, t) => sum + (t.value || 0), 0);

        // Saidas: type === 'expense' E paymentMethod !== 'credit' E date >= cutoffDate
        allTimeExpenseDebit = transactionsArray
            .filter(t => {
                // EXATAMENTE igual ao dashboard (linha 2309):
                // if (!t.type || t.type !== 'expense' || t.paymentMethod === 'credit') return false;
                if (!t.type || t.type !== 'expense' || t.paymentMethod === 'credit') return false;
                // Se ha data de corte, so conta transacoes apos essa data (linha 2311)
                if (cutoffDate && t.date < cutoffDate) return false;
                return true;
            })
            .reduce((sum, t) => sum + (t.value || 0), 0);

        console.log('[buildFinancialOverview] Saldo calculado - Entradas:', allTimeIncomeDebit, 'Saidas:', allTimeExpenseDebit, 'Saldo:', allTimeIncomeDebit - allTimeExpenseDebit);
        // ============================================
        // FIM DO CALCULO DO SALDO SINCRONIZADO
        // ============================================

        // Processar transacoes para outras estatisticas (historico, categorias, etc)
        transactionsArray.forEach(t => {
            const value = t.value || 0;
            const date = t.date || '';
            const monthKey = date.substring(0, 7); // "2026-01"
            const method = (t.paymentMethod || '').toLowerCase();
            const isCredit = t.paymentMethod === 'credit'; // Usar igualdade exata como dashboard

            // Guardar todas as transacoes para historico
            allTransactions.push({
                id: t.id,
                date: date,
                type: t.type,
                value: value,
                description: t.description || '',
                category: t.category || 'Outros',
                cardName: t.cardName || '',
                paymentMethod: t.paymentMethod || ''
            });

            // Historico mensal
            if (!monthlyHistory[monthKey]) {
                monthlyHistory[monthKey] = { income: 0, expense: 0, savings: 0, incomeDebit: 0, expenseDebit: 0 };
            }

            // PROCESSAR TRANSACOES para estatisticas
            if (t.type === 'income') {
                allTimeIncomeTotal += value;
                monthlyHistory[monthKey].income += value;
                if (!isCredit) {
                    monthlyHistory[monthKey].incomeDebit += value;
                }
            } else if (t.type === 'expense') {
                const cat = t.category || 'Outros';
                categoryTotalsAllTime[cat] = (categoryTotalsAllTime[cat] || 0) + value;
                allTimeExpenseTotal += value;

                if (SAVINGS_CATEGORIES.includes(cat)) {
                    allTimeSavings += value;
                    monthlyHistory[monthKey].savings += value;
                } else {
                    monthlyHistory[monthKey].expense += value;
                }

                if (!isCredit) {
                    monthlyHistory[monthKey].expenseDebit += value;
                }

                // Gastos por metodo de pagamento
                if (method.includes('debit') || method.includes('debito')) expensesByPaymentMethod.debit += value;
                else if (isCredit) expensesByPaymentMethod.credit += value;
                else if (method.includes('pix')) expensesByPaymentMethod.pix += value;
                else if (method.includes('cash') || method.includes('dinheiro')) expensesByPaymentMethod.cash += value;
                else expensesByPaymentMethod.other += value;

                // Gastos por cartao
                if (t.cardName) {
                    const cardKey = t.cardName.toLowerCase();
                    if (!expensesByCard[cardKey]) expensesByCard[cardKey] = { total: 0, thisMonth: 0, credit: 0, debit: 0 };
                    expensesByCard[cardKey].total += value;
                    if (isCredit) expensesByCard[cardKey].credit += value;
                    else expensesByCard[cardKey].debit += value;

                    // Fatura do cartao (gastos no credito)
                    if (isCredit) {
                        const card = cardsByName[cardKey];
                        if (card) {
                            // Verificar se esta no ciclo atual da fatura
                            const closingDay = card.closingDay || 1;
                            const transDate = new Date(date);
                            const transMonth = transDate.getMonth();
                            const transDay = transDate.getDate();

                            // Logica simplificada: gastos do mes atual antes do fechamento
                            if (transMonth === currentMonth || (transMonth === currentMonth - 1 && transDay > closingDay)) {
                                card.faturaAtual += value;
                                card.gastosCredito.push({ date, value, description: t.description });
                            }
                        }
                    }
                }
            }

            // KPIs do mes atual
            if (date >= startOfMonth && date <= endOfMonth) {
                if (t.type === 'income') totalIncome += value;
                else if (t.type === 'expense') {
                    const cat = t.category || 'Outros';
                    if (SAVINGS_CATEGORIES.includes(cat)) totalSavings += value;
                    else totalExpense += value;
                    categoryTotals[cat] = (categoryTotals[cat] || 0) + value;

                    // Gastos de credito do mes (para calculo de fatura)
                    if (isCredit) {
                        creditExpensesThisMonth += value;
                    }
                }

                // Gastos por cartao no mes
                if (t.cardName) {
                    const cardKey = t.cardName.toLowerCase();
                    if (expensesByCard[cardKey]) expensesByCard[cardKey].thisMonth += value;
                }
            }
        });

        // Ordenar todas as transacoes por data (mais recente primeiro)
        allTransactions.sort((a, b) => b.date.localeCompare(a.date));
        const last30Transactions = allTransactions.slice(0, 30);
        const transacoesDoMes = allTransactions.filter(t => t.date >= startOfMonth && t.date <= endOfMonth);

        // Saldos
        // SINCRONIZADO COM: finance-data.js linha 2329
        // totalBalance = totalIncomeAllTime - totalDebitAllTime
        // Transacoes de credito NAO afetam o saldo (sao pagas pela fatura)
        // cutoffDate ja foi aplicado no calculo de allTimeIncomeDebit/allTimeExpenseDebit acima
        const monthBalance = totalIncome - totalExpense - totalSavings;
        const totalBalance = allTimeIncomeDebit - allTimeExpenseDebit; // SALDO REAL (igual ao dashboard linha 2329)
        const expensePercent = totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0;

        // Top categorias (mes e historico)
        const topCatsMonth = Object.entries(categoryTotals)
            .filter(([cat]) => !SAVINGS_CATEGORIES.includes(cat))
            .sort((a, b) => b[1] - a[1]).slice(0, 10);

        const topCatsAllTime = Object.entries(categoryTotalsAllTime)
            .filter(([cat]) => !SAVINGS_CATEGORIES.includes(cat))
            .sort((a, b) => b[1] - a[1]).slice(0, 10);

        // ============================================
        // HISTORICO MENSAL (ultimos 6 meses)
        // ============================================
        const sortedMonths = Object.keys(monthlyHistory).sort().reverse().slice(0, 6);
        const monthlyStats = sortedMonths.map(m => {
            const data = monthlyHistory[m];
            // Saldo do mes = entradas(debito) - saidas(debito)
            const balance = (data.incomeDebit || data.income) - (data.expenseDebit || data.expense);
            return `${m}: Entrada R$${data.income.toFixed(2)} | Gasto R$${data.expense.toFixed(2)} | Saldo R$${balance.toFixed(2)}`;
        });

        // Media historica (ultimos 6 meses)
        let avgIncome = 0, avgExpense = 0;
        if (sortedMonths.length > 1) {
            const monthsForAvg = sortedMonths.slice(1); // Excluir mes atual
            monthsForAvg.forEach(m => {
                avgIncome += monthlyHistory[m].income;
                avgExpense += monthlyHistory[m].expense;
            });
            avgIncome = avgIncome / monthsForAvg.length;
            avgExpense = avgExpense / monthsForAvg.length;
        }

        // Comparativo com media
        const incomeVsAvg = avgIncome > 0 ? ((totalIncome - avgIncome) / avgIncome * 100).toFixed(0) : 0;
        const expenseVsAvg = avgExpense > 0 ? ((totalExpense - avgExpense) / avgExpense * 100).toFixed(0) : 0;

        // ============================================
        // PROJECOES
        // SINCRONIZADO COM: finance-data.js linhas 2284-2302
        // ============================================
        const projPending = [];
        const projReceived = [];
        let pendingIncome = 0, pendingExpense = 0;

        projSnap.docs.forEach(doc => {
            const p = doc.data();
            const projInfo = `${p.type === 'income' ? '+' : '-'}R$${p.value} ${p.description} (${p.date})${p.recurrence ? ` [${p.recurrence}]` : ''}`;

            if (p.status === 'pending') {
                projPending.push(projInfo);
                // CORRECAO: Filtrar por mes atual (igual ao dashboard)
                // Antes: p.date >= todayStr (errado - pegava qualquer data futura)
                // Agora: verificar se a projecao e do mes atual
                const projDate = new Date(p.date + 'T12:00:00');
                const isCurrentMonth = projDate.getMonth() === currentMonth && projDate.getFullYear() === currentYear;

                if (isCurrentMonth) {
                    if (p.type === 'income' || !p.type) pendingIncome += p.value || 0; // !p.type para compatibilidade
                    else if (p.type === 'expense') pendingExpense += p.value || 0;
                }
            } else if (p.status === 'received' || p.status === 'paid') {
                projReceived.push(projInfo);
            }
        });

        // ============================================
        // ASSINATURAS
        // ============================================
        const subsActive = [];
        const subsInactive = [];
        let totalSubsActive = 0;

        subsSnap.docs.forEach(doc => {
            const s = doc.data();
            const subInfo = `R$${s.value}/mes - ${s.name} (vence dia ${s.dueDay}${s.cardName ? `, cartao: ${s.cardName}` : ''}${s.category ? `, categoria: ${s.category}` : ''})`;

            if (s.status === 'active') {
                subsActive.push(subInfo);
                totalSubsActive += s.value || 0;
            } else {
                subsInactive.push(`${s.name} - R$${s.value} (${s.status || 'INATIVA'})`);
            }
        });

        // ============================================
        // PARCELAMENTOS
        // ============================================
        const installmentsActive = [];
        const installmentsFinished = [];
        let totalInstActive = 0;
        let totalRemainingDebt = 0; // Divida total restante

        instSnap.docs.forEach(doc => {
            const i = doc.data();
            const monthsElapsed = (currentYear - i.startYear) * 12 + (currentMonth - i.startMonth);
            const currentInstallment = monthsElapsed + 1;
            const parcelaValue = i.totalValue / i.totalInstallments;

            if (currentInstallment <= i.totalInstallments) {
                const remaining = i.totalInstallments - currentInstallment + 1;
                const remainingValue = parcelaValue * remaining;
                totalRemainingDebt += remainingValue;

                installmentsActive.push(
                    `R$${parcelaValue.toFixed(2)}/mes - ${i.description} (parcela ${currentInstallment}/${i.totalInstallments}, faltam ${remaining}, restam R$${remainingValue.toFixed(2)}${i.cardName ? `, cartao: ${i.cardName}` : ''})`
                );
                totalInstActive += parcelaValue;
            } else {
                installmentsFinished.push(`${i.description} - R$${i.totalValue} em ${i.totalInstallments}x (QUITADO)`);
            }
        });

        // ============================================
        // FUNCAO: getLastDayOfMonth - Retorna ultimo dia valido do mes
        // ============================================
        const getLastDayOfMonth = (year, month) => {
            return new Date(year, month + 1, 0).getDate();
        };

        // ============================================
        // FUNCAO: createSafeDate - Cria data com dia ajustado para ultimo dia valido
        // Resolve edge case de dia 31 em meses com 30 dias
        // ============================================
        const createSafeDate = (year, month, day) => {
            const lastDay = getLastDayOfMonth(year, month);
            const safeDay = Math.min(day, lastDay);
            return new Date(year, month, safeDay);
        };

        // ============================================
        // FUNCAO: getBillPeriod (identica ao dashboard linha 79-129)
        // ============================================
        const getBillPeriod = (card) => {
            let startDate, endDate, billMonth, billYear;
            const closingDay = card.closingDay || 1;

            // Logica baseada no dia de fechamento (modo real-time, nao navegando)
            if (today.getDate() < closingDay) {
                // Ainda no periodo atual
                startDate = createSafeDate(currentYear, currentMonth - 1, closingDay + 1);
                endDate = createSafeDate(currentYear, currentMonth, closingDay);
                billMonth = currentMonth;
                billYear = currentYear;

                if (currentMonth === 0) {
                    startDate = createSafeDate(currentYear - 1, 11, closingDay + 1);
                }
            } else {
                // Ja passou do fechamento
                startDate = createSafeDate(currentYear, currentMonth, closingDay + 1);
                let nextMonth = currentMonth + 1;
                let nextYear = currentYear;
                if (nextMonth > 11) {
                    nextMonth = 0;
                    nextYear++;
                }
                endDate = createSafeDate(nextYear, nextMonth, closingDay);
                billMonth = currentMonth;
                billYear = currentYear;
            }

            return { startDate, endDate, billMonth, billYear };
        };

        // ============================================
        // CARTOES DE CREDITO DETALHADOS COM BREAKDOWN DA FATURA
        // ============================================
        const cardsBillDetails = cardsData.map(c => {
            const { startDate: billStartDate, endDate: billEndDate, billMonth, billYear } = getBillPeriod(c);

            // Transacoes de credito no periodo da fatura
            const billTransactions = transactionsArray
                .filter(t => {
                    if (t.paymentMethod !== 'credit' || t.cardId !== c.id) return false;
                    const transactionDate = new Date(t.date + 'T12:00:00');
                    return transactionDate >= billStartDate && transactionDate <= billEndDate;
                })
                .map(t => ({
                    date: t.date,
                    value: t.type === 'expense' ? t.value : -t.value,
                    description: t.description,
                    category: t.category
                }))
                .sort((a, b) => a.date.localeCompare(b.date));

            // Parcelas que caem nesta fatura
            const billInstallments = installmentsData
                .filter(inst => {
                    if (inst.cardId !== c.id) return false;
                    if (inst.startMonth === undefined || inst.startYear === undefined) {
                        return inst.currentInstallment <= inst.totalInstallments;
                    }
                    const monthsSinceStart = (billYear - inst.startYear) * 12 + (billMonth - inst.startMonth);
                    if (monthsSinceStart < 0) return false;
                    const installmentForThisMonth = 1 + monthsSinceStart;
                    return installmentForThisMonth >= 1 && installmentForThisMonth <= inst.totalInstallments;
                })
                .map(inst => {
                    const monthsSinceStart = (billYear - inst.startYear) * 12 + (billMonth - inst.startMonth);
                    const currentInst = 1 + monthsSinceStart;
                    const instValue = inst.installmentValue || (inst.totalValue / inst.totalInstallments);
                    return {
                        description: inst.description,
                        value: instValue,
                        current: currentInst,
                        total: inst.totalInstallments
                    };
                });

            // Assinaturas neste cartao
            const billSubscriptions = subscriptionsData
                .filter(sub => sub.cardId === c.id && sub.status === 'active')
                .map(sub => ({
                    name: sub.name,
                    value: sub.value,
                    dueDay: sub.dueDay
                }));

            // Calcular totais
            const totalTransactions = billTransactions.reduce((sum, t) => sum + t.value, 0);
            const totalInstallments = billInstallments.reduce((sum, i) => sum + i.value, 0);
            const totalSubscriptions = billSubscriptions.reduce((sum, s) => sum + s.value, 0);
            const totalBill = totalTransactions + totalInstallments + totalSubscriptions;

            const limiteDisponivel = c.limit ? c.limit - totalBill : null;
            const percentUsado = c.limit ? Math.round((totalBill / c.limit) * 100) : 0;

            return {
                name: c.name,
                limit: c.limit,
                closingDay: c.closingDay,
                dueDay: c.dueDay,
                billStartDate,
                billEndDate,
                totalBill,
                limiteDisponivel,
                percentUsado,
                transactions: billTransactions,
                installments: billInstallments,
                subscriptions: billSubscriptions
            };
        });

        // Formato resumido para a secao de cartoes
        const cardsDetailed = cardsBillDetails.map(c => {
            let info = `${c.name}`;
            if (c.limit) info += ` | Limite: R$${c.limit}`;
            if (c.totalBill > 0) info += ` | Fatura atual: R$${c.totalBill.toFixed(2)}`;
            if (c.limiteDisponivel !== null) info += ` | Disponivel: R$${c.limiteDisponivel.toFixed(2)} (${100 - c.percentUsado}%)`;
            if (c.closingDay) info += ` | Fecha dia ${c.closingDay}`;
            if (c.dueDay) info += ` | Vence dia ${c.dueDay}`;
            return info;
        });

        // ============================================
        // INVESTIMENTOS
        // ============================================
        const investments = [];
        let totalInvested = 0;

        investSnap.docs.forEach(doc => {
            const inv = doc.data();
            const value = inv.value || inv.amount || 0;
            totalInvested += value;
            investments.push(`R$${value.toFixed(2)} - ${inv.name || inv.description || 'Investimento'} (${inv.type || 'Outros'}${inv.institution ? `, ${inv.institution}` : ''})`);
        });

        // ============================================
        // METAS FINANCEIRAS
        // ============================================
        const goals = [];
        goalsSnap.docs.forEach(doc => {
            const g = doc.data();
            const target = g.targetValue || g.target || 0;
            const current = g.currentValue || g.current || 0;
            const percent = target > 0 ? Math.round((current / target) * 100) : 0;
            goals.push(`${g.name || g.description}: R$${current.toFixed(2)} / R$${target.toFixed(2)} (${percent}%)${g.deadline ? ` - Prazo: ${g.deadline}` : ''}`);
        });

        // ============================================
        // CONTAS BANCARIAS
        // ============================================
        const accounts = [];
        let totalInAccounts = 0;
        accountsSnap.docs.forEach(doc => {
            const acc = doc.data();
            const balance = acc.balance || 0;
            totalInAccounts += balance;
            accounts.push(`${acc.name || acc.bank}: R$${balance.toFixed(2)}${acc.type ? ` (${acc.type})` : ''}`);
        });

        // ============================================
        // PROJECAO FIM DE MES
        // SINCRONIZADO COM: finance-data.js linha 2458
        // balanceProjection = totalBalance + pendingIncomeProjections - totalUnpaidBills - pendingExpenseProjections
        // ============================================

        // ============================================
        // FUNCAO: calculateCurrentBill (identica ao dashboard linha 1734-1829)
        // ============================================
        const calculateCurrentBill = (card) => {
            const { startDate: billStartDate, endDate: billEndDate, billMonth, billYear } = getBillPeriod(card);

            // Somar transacoes de credito do periodo (filtradas por cardId)
            const creditTransactionsTotal = transactionsArray
                .filter(t => {
                    if (t.paymentMethod !== 'credit' || t.cardId !== card.id) return false;
                    const transactionDate = new Date(t.date + 'T12:00:00');
                    return transactionDate >= billStartDate && transactionDate <= billEndDate;
                })
                .reduce((sum, t) => {
                    // Expense soma, income subtrai (reembolso)
                    return sum + (t.type === 'expense' ? (t.value || 0) : -(t.value || 0));
                }, 0);

            // Somar parcelas ativas deste cartao no mes da fatura
            const installmentsTotal = installmentsData
                .filter(inst => {
                    if (inst.cardId !== card.id) return false;

                    // Para parcelamentos antigos sem startMonth/startYear, usar logica antiga
                    if (inst.startMonth === undefined || inst.startYear === undefined) {
                        return inst.currentInstallment <= inst.totalInstallments;
                    }

                    // Calcular quantos meses se passaram desde o inicio do parcelamento
                    const monthsSinceStart = (billYear - inst.startYear) * 12 + (billMonth - inst.startMonth);

                    if (monthsSinceStart < 0) return false;

                    const installmentForThisMonth = 1 + monthsSinceStart;
                    return installmentForThisMonth >= 1 && installmentForThisMonth <= inst.totalInstallments;
                })
                .reduce((sum, inst) => {
                    const installmentValue = inst.installmentValue || (inst.totalValue / inst.totalInstallments);
                    return sum + installmentValue;
                }, 0);

            // Somar assinaturas ativas deste cartao
            const subscriptionsTotal = subscriptionsData
                .filter(sub => sub.cardId === card.id && sub.status === 'active')
                .reduce((sum, sub) => sum + (sub.value || 0), 0);

            return creditTransactionsTotal + installmentsTotal + subscriptionsTotal;
        };

        // ============================================
        // CALCULAR totalUnpaidBills (identico ao dashboard linha 2277-2281)
        // ============================================
        const totalUnpaidBills = cardsData.reduce((sum, card) => {
            const billValue = calculateCurrentBill(card);
            const isPaid = isBillPaid(card.id, currentMonth, currentYear);
            return sum + (isPaid ? 0 : billValue);
        }, 0);

        // SALDO PROJETADO = Saldo atual + Entradas pendentes - Faturas nao pagas - Saidas pendentes
        const projectedBalance = totalBalance + pendingIncome - totalUnpaidBills - pendingExpense;

        // Projecao do mes (mantido para compatibilidade)
        const projectedMonthBalance = monthBalance + pendingIncome - pendingExpense;

        const diasPassados = today.getDate();
        const gastoMedioDiario = diasPassados > 0 ? totalExpense / diasPassados : 0;
        const projecaoGastoTotal = gastoMedioDiario * new Date(currentYear, currentMonth + 1, 0).getDate();

        console.log('[buildFinancialOverview] Projecao - Saldo:', totalBalance, 'Entradas pend:', pendingIncome, 'Faturas nao pagas:', totalUnpaidBills, 'Saidas pend:', pendingExpense, '=> Projetado:', projectedBalance);

        // ============================================
        // GERAR OVERVIEW COMPLETA EM TEXTO
        // ============================================
        return `
================================================================================
OVERVIEW FINANCEIRA COMPLETA - ${userName}
================================================================================
Data de hoje: ${todayStr} (${today.toLocaleDateString('pt-BR', { weekday: 'long' })})
Mes atual: ${monthName}/${currentYear}
Dias passados no mes: ${diasPassados}
Dias restantes no mes: ${daysRemaining}

================================================================================
PATRIMONIO TOTAL (SALDO ACUMULADO)
================================================================================
*** SALDO DISPONIVEL: R$${totalBalance.toFixed(2)} ***
(Este e o valor que o usuario tem disponivel - calculado como: entradas - saidas, excluindo credito)

*** SALDO PROJETADO: R$${projectedBalance.toFixed(2)} *** ${projectedBalance >= 0 ? '(POSITIVO)' : '(NEGATIVO - ATENCAO!)'}
(O que vai sobrar apos pagar faturas e despesas pendentes do mes)
Calculo: Saldo atual (${totalBalance.toFixed(2)}) + Entradas pendentes (${pendingIncome.toFixed(2)}) - Faturas cartao (${totalUnpaidBills.toFixed(2)}) - Saidas pendentes (${pendingExpense.toFixed(2)})

Detalhamento:
- Entradas totais (debito/pix): R$${allTimeIncomeDebit.toFixed(2)}
- Saidas totais (debito/pix): R$${allTimeExpenseDebit.toFixed(2)}
- Gastos no credito (pago via fatura): R$${expensesByPaymentMethod.credit.toFixed(2)}
- Faturas de cartao a pagar: R$${totalUnpaidBills.toFixed(2)}
- Total guardado/investido: R$${allTimeSavings.toFixed(2)}
${totalInAccounts > 0 ? `- Saldo em contas bancarias: R$${totalInAccounts.toFixed(2)}` : ''}
${totalInvested > 0 ? `- Total em investimentos: R$${totalInvested.toFixed(2)}` : ''}
${totalRemainingDebt > 0 ? `- Divida em parcelamentos: R$${totalRemainingDebt.toFixed(2)}` : ''}
${totalRemainingDebt > 0 ? `- Patrimonio liquido (saldo - dividas): R$${(totalBalance - totalRemainingDebt).toFixed(2)}` : ''}

================================================================================
SITUACAO DO MES ATUAL (${monthName.toUpperCase()} ${currentYear})
================================================================================
Entradas do mes: R$${totalIncome.toFixed(2)}${avgIncome > 0 ? ` (${incomeVsAvg >= 0 ? '+' : ''}${incomeVsAvg}% vs media)` : ''}
Gastos do mes: R$${totalExpense.toFixed(2)} (${expensePercent}% da receita)${avgExpense > 0 ? ` (${expenseVsAvg >= 0 ? '+' : ''}${expenseVsAvg}% vs media)` : ''}
${totalSavings > 0 ? `Guardado/Investido no mes: R$${totalSavings.toFixed(2)}` : ''}
Saldo do mes: R$${monthBalance.toFixed(2)}
Projecao fim de mes: R$${projectedMonthBalance.toFixed(2)} ${projectedMonthBalance >= 0 ? '(POSITIVO)' : '(NEGATIVO - ATENCAO!)'}

Gasto medio diario: R$${gastoMedioDiario.toFixed(2)}
Projecao de gasto total do mes: R$${projecaoGastoTotal.toFixed(2)}
${avgExpense > 0 ? `Media de gastos (ultimos meses): R$${avgExpense.toFixed(2)}` : ''}
${avgIncome > 0 ? `Media de entradas (ultimos meses): R$${avgIncome.toFixed(2)}` : ''}

Total de transacoes no mes: ${transacoesDoMes.length}

================================================================================
GASTOS POR CATEGORIA - MES ATUAL (TOP 10)
================================================================================
${topCatsMonth.length > 0 ? topCatsMonth.map(([c, v], i) => `${i + 1}. ${c}: R$${v.toFixed(2)}`).join('\n') : 'Nenhum gasto registrado este mes'}

================================================================================
GASTOS POR CATEGORIA - HISTORICO TOTAL (TOP 10)
================================================================================
${topCatsAllTime.length > 0 ? topCatsAllTime.map(([c, v], i) => `${i + 1}. ${c}: R$${v.toFixed(2)}`).join('\n') : 'Nenhum gasto registrado'}

================================================================================
GASTOS POR METODO DE PAGAMENTO (HISTORICO)
================================================================================
- Debito: R$${expensesByPaymentMethod.debit.toFixed(2)}
- Credito: R$${expensesByPaymentMethod.credit.toFixed(2)}
- PIX: R$${expensesByPaymentMethod.pix.toFixed(2)}
- Dinheiro: R$${expensesByPaymentMethod.cash.toFixed(2)}
- Outros: R$${expensesByPaymentMethod.other.toFixed(2)}

================================================================================
CARTOES DE CREDITO (${cardsDetailed.length})
================================================================================
${cardsDetailed.length > 0 ? cardsDetailed.join('\n') : 'Nenhum cartao cadastrado'}

================================================================================
GASTOS POR CARTAO
================================================================================
${Object.keys(expensesByCard).length > 0 ? Object.entries(expensesByCard).map(([card, data]) =>
    `- ${card}: Total R$${data.total.toFixed(2)} | Este mes R$${data.thisMonth.toFixed(2)}`
).join('\n') : 'Nenhum gasto em cartao'}

================================================================================
DETALHAMENTO DAS FATURAS (O QUE TEM EM CADA FATURA)
================================================================================
${cardsBillDetails.filter(c => c.totalBill > 0).map(c => {
    let detail = `\n--- FATURA ${c.name.toUpperCase()} ---`;
    detail += `\nPeriodo: ${c.billStartDate.toLocaleDateString('pt-BR')} a ${c.billEndDate.toLocaleDateString('pt-BR')}`;
    detail += `\nTotal da fatura: R$${c.totalBill.toFixed(2)}`;
    if (c.dueDay) detail += ` | Vence dia ${c.dueDay}`;

    if (c.transactions.length > 0) {
        detail += `\n\nCOMPRAS NO CARTAO (${c.transactions.length}):`;
        c.transactions.forEach(t => {
            detail += `\n  - ${t.date}: R$${t.value.toFixed(2)} - ${t.description} [${t.category || 'Outros'}]`;
        });
    }

    if (c.installments.length > 0) {
        detail += `\n\nPARCELAS NESTA FATURA (${c.installments.length}):`;
        c.installments.forEach(i => {
            detail += `\n  - R$${i.value.toFixed(2)} - ${i.description} (${i.current}/${i.total})`;
        });
    }

    if (c.subscriptions.length > 0) {
        detail += `\n\nASSINATURAS NESTE CARTAO (${c.subscriptions.length}):`;
        c.subscriptions.forEach(s => {
            detail += `\n  - R$${s.value.toFixed(2)}/mes - ${s.name}`;
        });
    }

    return detail;
}).join('\n') || 'Nenhuma fatura com valor'}

================================================================================
HISTORICO MENSAL (ULTIMOS 6 MESES)
================================================================================
${monthlyStats.length > 0 ? monthlyStats.join('\n') : 'Sem historico'}

================================================================================
ULTIMAS 30 TRANSACOES (TODAS, NAO SO DO MES)
================================================================================
${last30Transactions.length > 0 ? last30Transactions.map(t =>
    `${t.date}: ${t.type === 'income' ? '+' : '-'}R$${t.value.toFixed(2)} ${t.description} [${t.category}]${t.cardName ? ` (${t.cardName})` : ''}`
).join('\n') : 'Nenhuma transacao'}

================================================================================
ASSINATURAS ATIVAS (${subsActive.length}) - Total: R$${totalSubsActive.toFixed(2)}/mes
================================================================================
${subsActive.length > 0 ? subsActive.join('\n') : 'Nenhuma assinatura ativa'}
${subsInactive.length > 0 ? `\nAssinaturas inativas/canceladas:\n${subsInactive.join('\n')}` : ''}

================================================================================
PARCELAMENTOS ATIVOS (${installmentsActive.length}) - Total: R$${totalInstActive.toFixed(2)}/mes
================================================================================
${installmentsActive.length > 0 ? installmentsActive.join('\n') : 'Nenhum parcelamento ativo'}
${totalRemainingDebt > 0 ? `\nDIVIDA TOTAL EM PARCELAMENTOS: R$${totalRemainingDebt.toFixed(2)}` : ''}
${installmentsFinished.length > 0 ? `\nParcelamentos quitados: ${installmentsFinished.length}` : ''}

================================================================================
PROJECOES PENDENTES (${projPending.length})
================================================================================
${projPending.length > 0 ? projPending.join('\n') : 'Nenhuma projecao pendente'}
${pendingIncome > 0 ? `\nTotal a receber: R$${pendingIncome.toFixed(2)}` : ''}
${pendingExpense > 0 ? `Total a pagar: R$${pendingExpense.toFixed(2)}` : ''}
${projReceived.length > 0 ? `\nProjecoes ja realizadas: ${projReceived.length}` : ''}

================================================================================
INVESTIMENTOS (${investments.length}) - Total: R$${totalInvested.toFixed(2)}
================================================================================
${investments.length > 0 ? investments.join('\n') : 'Nenhum investimento cadastrado'}

================================================================================
METAS FINANCEIRAS (${goals.length})
================================================================================
${goals.length > 0 ? goals.join('\n') : 'Nenhuma meta cadastrada'}

================================================================================
CONTAS BANCARIAS (${accounts.length}) - Total: R$${totalInAccounts.toFixed(2)}
================================================================================
${accounts.length > 0 ? accounts.join('\n') : 'Nenhuma conta cadastrada'}

================================================================================
RESUMO DE GASTOS FIXOS MENSAIS
================================================================================
- Assinaturas: R$${totalSubsActive.toFixed(2)}
- Parcelas: R$${totalInstActive.toFixed(2)}
- TOTAL FIXO MENSAL: R$${(totalSubsActive + totalInstActive).toFixed(2)}
${totalIncome > 0 ? `- Comprometimento da renda: ${Math.round(((totalSubsActive + totalInstActive) / totalIncome) * 100)}%` : ''}

================================================================================
FIM DA OVERVIEW
================================================================================
`.trim();

    } catch (error) {
        console.error('[buildFinancialOverview] Erro:', error);
        return `Nome: ${userName}\nErro ao carregar dados financeiros: ${error.message}`;
    }
}

/**
 * Interpretar comando de texto usando Gemini - Versao Humanizada
 * Retorna JSON estruturado ou texto conversacional
 * @param {string} text - Texto do comando do usuario
 * @param {Array} userCards - Lista de cartoes do usuario para contexto
 * @param {string} financialOverview - Overview financeira em texto
 * @param {string} userName - Nome do usuario
 */
async function interpretFinanceCommand(text, userCards = [], financialOverview = '', userName = '') {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY nao configurada');
    }

    // SDK @google/genai (substitui @google/generative-ai desde nov/2025)
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // Data atual para referencia
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const monthName = today.toLocaleDateString('pt-BR', { month: 'long' });

    const prompt = `=== SUA IDENTIDADE (MUITO IMPORTANTE!) ===
VOCE se chama CLAYTINHO. Voce e o assistente financeiro.
O USUARIO que esta falando com voce se chama ${userName || 'Usuario'}. Ele NAO e o Claytinho, ele e seu CLIENTE.

NUNCA confunda:
- VOCE = Claytinho (o assistente, quem RESPONDE)
- USUARIO = ${userName || 'Usuario'} (o cliente, quem PERGUNTA)

Voce tem MUITO orgulho do seu nome e adora quando te chamam de Claytinho! Seja generoso, prestativo, natural e amigavel. Use emojis com moderacao.

${financialOverview}

CARTOES DO USUARIO:
${userCards.length > 0 ? userCards.map(c => `- ${c.name}`).join('\n') : 'Nenhum cartao cadastrado'}

=== COMO RESPONDER ===

1. SEMPRE chame o usuario pelo nome (${userName || 'Usuario'}) - lembre-se: o usuario NAO e voce!
2. Seja conversacional, NAO robotizado
3. Use emojis com moderacao (1-3 por mensagem)
4. Para perguntas simples, responda naturalmente sem JSON
5. Para acoes (registrar gasto, etc), retorne JSON

=== FORMATACAO WHATSAPP (IMPORTANTE!) ===
Use formatacao do WhatsApp, NAO Markdown:
- Negrito: *texto* (UM asterisco de cada lado, NAO dois)
- Italico: _texto_ (underscore)
- Tachado: ~texto~ (til)
- ERRADO: **texto**, __texto__
- CERTO: *texto*, _texto_

=== EXEMPLOS DE RESPOSTAS NATURAIS ===

Usuario: "oi"
Resposta: "Oi ${userName || 'Usuario'}! Como posso te ajudar com suas financas hoje?"

Usuario: "como estou?"
Resposta: "Olha ${userName || 'Usuario'}, [analise baseada na overview financeira acima]"

Usuario: "vou conseguir fechar o mes?"
Resposta: "Deixa eu ver... [analise baseada nas projecoes da overview acima]"

=== QUANDO RETORNAR JSON ===

Se o usuario quer REGISTRAR algo (gasto, entrada, parcelamento, etc), retorne JSON:

{
  "action": "add_transaction|edit_transaction|add_installment|add_subscription|add_projection|add_investment|add_card|get_summary|get_balance|get_cards|get_bills|delete_transaction|update_projection_status|help",
  "data": { /* campos da acao */ },
  "confidence": 0.0 a 1.0,
  "message": "Mensagem humanizada confirmando a acao, usando o nome ${userName || 'Usuario'}"
}

=== ACOES DISPONIVEIS ===

1. add_transaction - Registrar entrada ou saida
   data: { type: "income"|"expense", value, description, category, date, paymentMethod: "debit"|"credit"|"pix", cardName }

2. add_installment - Parcelamento
   data: { description, cardName, totalValue, totalInstallments, currentInstallment }

3. add_subscription - Assinatura
   data: { name, value, dueDay, category, cardName }

4. add_projection - Projecao futura
   data: { type: "income"|"expense", description, value, date, status: "pending" }

5. add_investment - Investimento/reserva
   data: { name, value, date }

6. add_card - Cadastrar cartao
   data: { name, institution, limit, closingDay, dueDay }

7. get_summary / get_balance - Resumo financeiro
   data: {}

8. get_cards / get_bills - Listar cartoes/faturas
   data: {}

9. delete_transaction - Deletar transacao
   data: { description }

10. edit_transaction - Editar/corrigir transacao existente
    data: {
      searchDescription: "termo para encontrar a transacao (ex: coxinha, mercado, uber)",
      newValue: numero (opcional - novo valor),
      newDescription: "texto" (opcional - nova descricao),
      newCategory: "categoria" (opcional - nova categoria),
      newDate: "YYYY-MM-DD" (opcional - nova data),
      newPaymentMethod: "debit"|"credit"|"pix" (opcional),
      newCardName: "nome do cartao" (opcional - se mudar para credito)
    }
    IMPORTANTE: searchDescription e OBRIGATORIO para encontrar qual transacao editar. Inclua apenas os campos que o usuario quer alterar.

11. update_projection_status - Marcar projecao como recebida
    data: { description, newStatus: "received"|"pending"|"canceled" }

12. help - Mostrar ajuda
    data: {}

=== CATEGORIAS VALIDAS ===

ENTRADA: Salario, Freelance, Vendas, Investimentos, Bonificacao, Outros

SAIDA: Alimentacao, Supermercado, Restaurantes, iFood/Delivery, Mercado, Transporte, Combustivel, Uber/Taxi, Estacionamento, Moradia, Aluguel, Luz, Agua, Internet, Gas, Saude, Farmacia, Consultas, Educacao, Cursos, Livros, Lazer, Streaming, Cinema, Jogos, Viagens, Compras, Roupas, Eletronicos, Academia, Beleza, Pet, Assinaturas, Servicos, Seguros, Poupanca, Investimentos, Reserva de Emergencia, Previdencia, Presentes, Impostos, Outros

=== REGRAS PARA ACOES ===
1. Se mencionar cartao (nubank, inter, c6, itau, roxinho, laranjinha): paymentMethod: "credit" + cardName
2. Se mencionar PIX: paymentMethod: "pix" (SEM cardName)
3. Se nao mencionar nenhum: paymentMethod: "debit"
4. APELIDOS: roxinho/roxo/nu=nubank, laranjinha/laranja=inter, carbono/c6=c6 bank, iti=itau, bb/ourocard=banco do brasil, mp/mercadopago=mercado pago
5. "parcelei" ou "X vezes" = add_installment

=== REGRAS DE TIPO (MUITO IMPORTANTE!) ===
- "recebi", "ganhei", "entrou", "salario", "pagamento", "me pagaram", "caiu" = type: "income" (ENTRADA de dinheiro)
- "gastei", "paguei", "comprei", "saiu", "debito", "fui cobrado" = type: "expense" (SAIDA de dinheiro)
- NUNCA confunda "recebi" com gasto! "Recebi" SEMPRE significa que ENTROU dinheiro na conta (income)
- Exemplo: "recebi 500 do cliente" = income, "paguei 500 pro fornecedor" = expense

DATA ATUAL: ${todayStr}
MES ATUAL: ${monthName}/${currentYear}

=== MENSAGEM DO USUARIO ===
"${text}"

IMPORTANTE:
- Se for ACAO (registrar gasto, entrada, etc), retorne APENAS o JSON puro, sem texto antes ou depois. A mensagem humanizada vai no campo "message" do JSON.
- Se for CONVERSA/PERGUNTA, retorne APENAS texto puro, sem JSON.
- NUNCA misture texto com JSON na mesma resposta.`;

    try {
        // Chamada ao Gemini com retry automatico (3 tentativas, backoff exponencial)
        // Usando novo SDK @google/genai (jan/2026)
        const result = await withRetry(
            () => ai.models.generateContent({
                model: 'gemini-2.0-flash',
                contents: prompt,
            }),
            3,  // max retries
            1000 // initial delay ms
        );
        const response = result.text.trim();

        // Tentar extrair JSON da resposta (pode estar no meio do texto)
        const jsonMatch = response.match(/\{[\s\S]*"action"[\s\S]*"data"[\s\S]*\}/);

        if (jsonMatch) {
            // Encontrou JSON - extrair e parsear
            let jsonStr = jsonMatch[0];

            // Limpar possivel markdown
            if (jsonStr.includes('```')) {
                jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```/g, '');
            }

            try {
                const parsed = JSON.parse(jsonStr);
                console.log('[interpretFinanceCommand] Acao:', parsed.action);
                return parsed;
            } catch (parseErr) {
                console.error('[interpretFinanceCommand] Erro ao parsear JSON:', parseErr.message);
                // Se falhou o parse, retorna como texto
                return response;
            }
        } else {
            // Nao tem JSON - resposta conversacional pura
            console.log('[interpretFinanceCommand] Resposta conversacional');
            return response;
        }

    } catch (error) {
        console.error('[interpretFinanceCommand] Erro apos retries:', error.message);
        const is429 = error.message && (error.message.includes('429') || error.message.includes('Too Many Requests'));

        // FALLBACK: Se for erro de rate limit, tentar extrair dados basicos do overview
        if (is429 && financialOverview) {
            // Extrair KPIs do overview usando regex
            const saldoMatch = financialOverview.match(/Saldo atual:\s*(R\$[\s\d.,+-]+)/i);
            const entradasMatch = financialOverview.match(/Entradas.*?:\s*(R\$[\s\d.,]+)/i);
            const saidasMatch = financialOverview.match(/(?:Saidas|Gastos).*?:\s*(R\$[\s\d.,]+)/i);
            const faturaMatch = financialOverview.match(/Fatura.*?:\s*(R\$[\s\d.,]+)/i);

            if (saldoMatch || entradasMatch || saidasMatch) {
                const saldo = saldoMatch ? saldoMatch[1].trim() : 'nao disponivel';
                const entradas = entradasMatch ? entradasMatch[1].trim() : '-';
                const saidas = saidasMatch ? saidasMatch[1].trim() : '-';
                const fatura = faturaMatch ? faturaMatch[1].trim() : null;

                let fallbackMsg = `Oi ${userName || 'Usuario'}! Estou com alta demanda, mas consegui seus dados:\n\n`;
                fallbackMsg += `Saldo: ${saldo}\n`;
                fallbackMsg += `Entradas: ${entradas}\n`;
                fallbackMsg += `Saidas: ${saidas}`;
                if (fatura) fallbackMsg += `\nFatura: ${fatura}`;
                fallbackMsg += `\n\nTente novamente em alguns segundos para uma resposta mais detalhada.`;

                console.log('[interpretFinanceCommand] Fallback ativado - retornando dados basicos');
                return fallbackMsg; // Retorna como string (conversa)
            }
        }

        return {
            action: 'unknown',
            data: {},
            confidence: 0,
            message: `Desculpe ${userName || 'Usuario'}, tive um problema tecnico. Tente novamente em alguns segundos.`
        };
    }
}

/**
 * Buscar cartao por nome (helper) - com suporte a apelidos e fuzzy matching
 * @param {string} userId - ID do usuario
 * @param {string} cardName - Nome do cartao (pode ser apelido como "roxinho")
 * @returns {Object|null} - Cartao encontrado ou null
 */
async function findCardByName(userId, cardName) {
    if (!cardName) return null;

    const cardsSnapshot = await db.collection('creditCards')
        .where('userId', '==', userId)
        .get();

    if (cardsSnapshot.empty) return null;

    const searchTerm = cardName.toLowerCase().trim();
    // Resolver apelido para nome canonico (ex: "roxinho" -> "nubank")
    const canonicalName = CARD_ALIASES[searchTerm] || searchTerm;

    const card = cardsSnapshot.docs.find(doc => {
        const data = doc.data();
        const name = (data.name || '').toLowerCase();
        const institution = (data.institution || '').toLowerCase();

        // Verificar match com nome canonico (do apelido)
        if (name.includes(canonicalName) || canonicalName.includes(name) ||
            institution.includes(canonicalName) || canonicalName.includes(institution)) {
            return true;
        }

        // Verificar match direto com termo de busca original
        if (name.includes(searchTerm) || searchTerm.includes(name) ||
            institution.includes(searchTerm) || searchTerm.includes(institution)) {
            return true;
        }

        return false;
    });

    return card ? { id: card.id, ...card.data() } : null;
}

/**
 * Executar acao financeira no Firestore
 */
async function executeFinanceAction(interpretation, userId) {
    const { action, data } = interpretation;

    try {
        switch (action) {
            // ========== TRANSACOES ==========
            case 'add_transaction': {
                const transaction = {
                    userId: userId,
                    type: data.type || 'expense',
                    description: data.description || 'Sem descricao',
                    value: parseFloat(data.value) || 0,
                    category: data.category || 'Outros',
                    paymentMethod: data.paymentMethod || 'debit',
                    date: data.date || new Date().toISOString().split('T')[0],
                    cardId: null,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    source: 'whatsapp_bot'
                };

                // Se for credito, tentar encontrar o cartao
                if (data.paymentMethod === 'credit' && data.cardName) {
                    const card = await findCardByName(userId, data.cardName);
                    if (card) {
                        transaction.cardId = card.id;
                    } else {
                        // Cartao nao encontrado - dar feedback ao usuario
                        const userCards = await getUserCards(userId);
                        if (userCards.length > 0) {
                            const cardsList = userCards.map(c => `- ${c.name}`).join('\n');
                            return {
                                success: false,
                                message: `Cartao "${data.cardName}" nao encontrado.\n\nCartoes disponiveis:\n${cardsList}\n\nTente novamente com um dos cartoes acima.`
                            };
                        } else {
                            return {
                                success: false,
                                message: `Voce nao tem cartoes cadastrados.\n\nPara cadastrar: "cadastra cartao nubank limite 5000 fecha dia 10 vence dia 17"`
                            };
                        }
                    }
                }

                const docRef = await db.collection('transactions').add(transaction);
                console.log('[executeFinanceAction] Transacao criada:', docRef.id);

                return {
                    success: true,
                    message: interpretation.message,
                    transactionId: docRef.id
                };
            }

            // ========== PARCELAMENTOS ==========
            case 'add_installment': {
                const card = await findCardByName(userId, data.cardName);
                if (!card) {
                    // Cartao nao encontrado - dar feedback ao usuario
                    const userCards = await getUserCards(userId);
                    if (userCards.length > 0) {
                        const cardsList = userCards.map(c => `- ${c.name}`).join('\n');
                        return {
                            success: false,
                            message: `Cartao "${data.cardName}" nao encontrado.\n\nCartoes disponiveis:\n${cardsList}\n\nTente novamente com um dos cartoes acima.`
                        };
                    } else {
                        return {
                            success: false,
                            message: `Voce nao tem cartoes cadastrados.\n\nPara cadastrar: "cadastra cartao nubank limite 5000 fecha dia 10 vence dia 17"`
                        };
                    }
                }

                const now = new Date();
                const currentInstallment = parseInt(data.currentInstallment) || 1;

                // Calcular mes/ano de inicio baseado na parcela atual
                const monthsBack = currentInstallment - 1;
                let startMonth = now.getMonth() - monthsBack;
                let startYear = now.getFullYear();
                while (startMonth < 0) {
                    startMonth += 12;
                    startYear--;
                }

                const installment = {
                    userId: userId,
                    cardId: card.id,
                    description: data.description || 'Parcelamento',
                    totalValue: parseFloat(data.totalValue) || 0,
                    totalInstallments: parseInt(data.totalInstallments) || 12,
                    currentInstallment: currentInstallment,
                    startMonth: startMonth,
                    startYear: startYear,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    source: 'whatsapp_bot'
                };

                const docRef = await db.collection('installments').add(installment);
                const parcela = (installment.totalValue / installment.totalInstallments).toFixed(2);

                return {
                    success: true,
                    message: `Parcelamento cadastrado no ${card.name}:\n- ${data.description}\n- R$${parcela}/mes (${currentInstallment}/${installment.totalInstallments})`,
                    installmentId: docRef.id
                };
            }

            // ========== ASSINATURAS ==========
            case 'add_subscription': {
                let cardId = null;
                let cardName = '';

                let cardWarning = '';
                if (data.cardName) {
                    const card = await findCardByName(userId, data.cardName);
                    if (card) {
                        cardId = card.id;
                        cardName = ` no ${card.name}`;
                    } else {
                        // Cartao nao encontrado mas assinatura pode ser criada sem
                        const userCards = await getUserCards(userId);
                        if (userCards.length > 0) {
                            const cardsList = userCards.map(c => c.name).join(', ');
                            cardWarning = `\n\nAviso: Cartao "${data.cardName}" nao encontrado. Cartoes: ${cardsList}`;
                        }
                    }
                }

                const subscription = {
                    userId: userId,
                    name: data.name || 'Assinatura',
                    value: parseFloat(data.value) || 0,
                    dueDay: parseInt(data.dueDay) || 1,
                    category: data.category || 'Assinaturas',
                    status: 'active',
                    cardId: cardId,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    source: 'whatsapp_bot'
                };

                const docRef = await db.collection('subscriptions').add(subscription);

                return {
                    success: true,
                    message: `Assinatura cadastrada:\n- ${data.name}: R$${data.value}/mes\n- Vencimento: dia ${data.dueDay}${cardName}${cardWarning}`,
                    subscriptionId: docRef.id
                };
            }

            // ========== PROJECOES ==========
            case 'add_projection': {
                const projection = {
                    userId: userId,
                    type: data.type || 'income',
                    description: data.description || 'Projecao',
                    value: parseFloat(data.value) || 0,
                    date: data.date || new Date().toISOString().split('T')[0],
                    status: data.status || 'pending',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    source: 'whatsapp_bot'
                };

                const docRef = await db.collection('projections').add(projection);
                const tipoStr = data.type === 'income' ? 'entrada' : 'saida';

                return {
                    success: true,
                    message: `Projecao de ${tipoStr} cadastrada:\n- ${data.description}: R$${data.value}\n- Data prevista: ${data.date}`,
                    projectionId: docRef.id
                };
            }

            // ========== INVESTIMENTOS ==========
            case 'add_investment': {
                const investment = {
                    userId: userId,
                    name: data.name || 'Investimento',
                    value: parseFloat(data.value) || 0,
                    date: data.date || new Date().toISOString().split('T')[0],
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    source: 'whatsapp_bot'
                };

                const docRef = await db.collection('investments').add(investment);

                return {
                    success: true,
                    message: `Investimento registrado:\n- ${data.name}: R$${data.value}`,
                    investmentId: docRef.id
                };
            }

            // ========== CARTOES ==========
            case 'add_card': {
                const card = {
                    userId: userId,
                    name: data.name || 'Cartao',
                    institution: data.institution || data.name || 'Banco',
                    limit: parseFloat(data.limit) || 1000,
                    closingDay: parseInt(data.closingDay) || 1,
                    dueDay: parseInt(data.dueDay) || 10,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    source: 'whatsapp_bot'
                };

                const docRef = await db.collection('creditCards').add(card);

                return {
                    success: true,
                    message: `Cartao cadastrado:\n- ${data.name}\n- Limite: R$${data.limit}\n- Fecha dia ${data.closingDay}, vence dia ${data.dueDay}`,
                    cardId: docRef.id
                };
            }

            // ========== CONSULTAS ==========
            case 'get_balance': {
                const { startOfMonth, endOfMonth, monthName } = getMonthBounds();

                const transactionsSnapshot = await db.collection('transactions')
                    .where('userId', '==', userId)
                    .get();

                let income = 0;
                let expense = 0;

                transactionsSnapshot.docs.forEach(doc => {
                    const t = doc.data();
                    const tDate = t.date || '';
                    if (tDate >= startOfMonth && tDate <= endOfMonth) {
                        if (t.type === 'income') {
                            income += t.value || 0;
                        } else {
                            expense += t.value || 0;
                        }
                    }
                });

                const balance = income - expense;

                return {
                    success: true,
                    message: `Saldo de ${monthName}:\n\nEntradas: R$${income.toFixed(2)}\nSaidas: R$${expense.toFixed(2)}\n\nSaldo: R$${balance.toFixed(2)}`,
                    data: { income, expense, balance }
                };
            }

            case 'get_summary': {
                const { startOfMonth, endOfMonth, monthName } = getMonthBounds();

                // Buscar transacoes do mes
                const transactionsSnapshot = await db.collection('transactions')
                    .where('userId', '==', userId)
                    .get();

                let income = 0;
                let expense = 0;
                const categoryTotals = {};

                transactionsSnapshot.docs.forEach(doc => {
                    const t = doc.data();
                    const tDate = t.date || '';
                    if (tDate >= startOfMonth && tDate <= endOfMonth) {
                        if (t.type === 'income') {
                            income += t.value || 0;
                        } else {
                            expense += t.value || 0;
                            const cat = t.category || 'Outros';
                            categoryTotals[cat] = (categoryTotals[cat] || 0) + (t.value || 0);
                        }
                    }
                });

                // Buscar assinaturas ativas
                const subsSnapshot = await db.collection('subscriptions')
                    .where('userId', '==', userId)
                    .where('status', '==', 'active')
                    .get();

                let subscriptionsTotal = 0;
                subsSnapshot.docs.forEach(doc => {
                    subscriptionsTotal += doc.data().value || 0;
                });

                // Buscar parcelamentos ativos (usando calculo correto baseado em startMonth/startYear)
                const installmentsSnapshot = await db.collection('installments')
                    .where('userId', '==', userId)
                    .get();

                let installmentsTotal = 0;
                let activeInstallmentsCount = 0;
                installmentsSnapshot.docs.forEach(doc => {
                    const inst = doc.data();
                    const { isActive } = calculateCurrentInstallment(inst.startYear, inst.startMonth, inst.totalInstallments);
                    if (isActive) {
                        installmentsTotal += (inst.totalValue / inst.totalInstallments);
                        activeInstallmentsCount++;
                    }
                });

                // Top 5 categorias
                const topCategories = Object.entries(categoryTotals)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([cat, val]) => `  - ${cat}: R$${val.toFixed(2)}`)
                    .join('\n');

                const balance = income - expense;

                return {
                    success: true,
                    message: `Resumo de ${monthName}:\n\nEntradas: R$${income.toFixed(2)}\nSaidas: R$${expense.toFixed(2)}\nSaldo: R$${balance.toFixed(2)}\n\nAssinaturas: R$${subscriptionsTotal.toFixed(2)}/mes\nParcelas: R$${installmentsTotal.toFixed(2)}/mes (${activeInstallmentsCount} ativas)\n\nTop gastos:\n${topCategories || '  Nenhum gasto registrado'}`,
                    data: { income, expense, balance, subscriptionsTotal, installmentsTotal, activeInstallmentsCount }
                };
            }

            case 'get_cards': {
                const cardsSnapshot = await db.collection('creditCards')
                    .where('userId', '==', userId)
                    .get();

                if (cardsSnapshot.empty) {
                    return {
                        success: true,
                        message: 'Nenhum cartao cadastrado.\n\nPara cadastrar: "cadastra cartao [nome] limite [valor] fecha dia [X] vence dia [Y]"'
                    };
                }

                const cardsList = cardsSnapshot.docs.map(doc => {
                    const c = doc.data();
                    return `- ${c.name} (${c.institution})\n  Limite: R$${c.limit} | Fecha: ${c.closingDay} | Vence: ${c.dueDay}`;
                }).join('\n\n');

                return {
                    success: true,
                    message: `Seus cartoes:\n\n${cardsList}`
                };
            }

            case 'get_bills': {
                const cardsSnapshot = await db.collection('creditCards')
                    .where('userId', '==', userId)
                    .get();

                if (cardsSnapshot.empty) {
                    return {
                        success: true,
                        message: 'Nenhum cartao cadastrado.'
                    };
                }

                const { startOfMonth, endOfMonth, monthName } = getMonthBounds();

                // Buscar transacoes de credito do mes
                const transactionsSnapshot = await db.collection('transactions')
                    .where('userId', '==', userId)
                    .where('paymentMethod', '==', 'credit')
                    .get();

                // Agrupar por cartao
                const billsByCard = {};
                cardsSnapshot.docs.forEach(doc => {
                    billsByCard[doc.id] = { name: doc.data().name, total: 0 };
                });

                transactionsSnapshot.docs.forEach(doc => {
                    const t = doc.data();
                    const tDate = t.date || '';
                    if (tDate >= startOfMonth && tDate <= endOfMonth && t.cardId && billsByCard[t.cardId]) {
                        billsByCard[t.cardId].total += t.value || 0;
                    }
                });

                // Buscar parcelas ativas (usando calculo correto baseado em startMonth/startYear)
                const installmentsSnapshot = await db.collection('installments')
                    .where('userId', '==', userId)
                    .get();

                installmentsSnapshot.docs.forEach(doc => {
                    const inst = doc.data();
                    const { isActive } = calculateCurrentInstallment(inst.startYear, inst.startMonth, inst.totalInstallments);
                    if (isActive && inst.cardId && billsByCard[inst.cardId]) {
                        billsByCard[inst.cardId].total += (inst.totalValue / inst.totalInstallments);
                    }
                });

                const billsList = Object.values(billsByCard)
                    .filter(b => b.total > 0)
                    .map(b => `- ${b.name}: R$${b.total.toFixed(2)}`)
                    .join('\n');

                const total = Object.values(billsByCard).reduce((sum, b) => sum + b.total, 0);

                return {
                    success: true,
                    message: billsList
                        ? `Faturas de ${monthName}:\n\n${billsList}\n\nTotal: R$${total.toFixed(2)}`
                        : 'Nenhuma fatura pendente este mes.'
                };
            }

            // ========== DELECAO ==========
            case 'delete_transaction': {
                // Buscar transacoes recentes do usuario criadas pelo bot (indice: userId + source + createdAt)
                const transactionsSnapshot = await db.collection('transactions')
                    .where('userId', '==', userId)
                    .where('source', '==', 'whatsapp_bot')
                    .orderBy('createdAt', 'desc')
                    .limit(1)
                    .get();

                if (transactionsSnapshot.empty) {
                    return {
                        success: false,
                        message: 'Nenhuma transacao do bot encontrada para remover.'
                    };
                }

                const targetDoc = transactionsSnapshot.docs[0];
                const t = targetDoc.data();
                await db.collection('transactions').doc(targetDoc.id).delete();

                return {
                    success: true,
                    message: `Transacao removida:\n- ${t.description}: R$${t.value}`
                };
            }

            // ========== EDICAO DE TRANSACAO ==========
            case 'edit_transaction': {
                // Buscar transacoes recentes do usuario criadas pelo bot (indice: userId + source + createdAt)
                const recentTransactions = await db.collection('transactions')
                    .where('userId', '==', userId)
                    .where('source', '==', 'whatsapp_bot')
                    .orderBy('createdAt', 'desc')
                    .limit(50)
                    .get();

                // Converter para array para manipulacao
                const botTransactions = recentTransactions.docs;

                if (botTransactions.length === 0) {
                    return {
                        success: false,
                        message: 'Nenhuma transacao criada pelo bot encontrada para editar.'
                    };
                }

                // Encontrar transacao pelo termo de busca
                let targetDoc = null;
                const searchTerm = (data.searchDescription || '').toLowerCase();

                if (searchTerm) {
                    targetDoc = botTransactions.find(doc => {
                        const t = doc.data();
                        const desc = (t.description || '').toLowerCase();
                        const cat = (t.category || '').toLowerCase();
                        return desc.includes(searchTerm) || cat.includes(searchTerm);
                    });
                }

                // Se nao encontrar por busca, usa a mais recente do bot
                if (!targetDoc) {
                    targetDoc = botTransactions[0];
                }

                const originalTransaction = targetDoc.data();
                const updates = {
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                };
                const changes = [];

                // Aplicar alteracoes solicitadas
                if (data.newValue !== undefined && data.newValue !== null) {
                    updates.value = data.newValue;
                    changes.push(`valor: R$${originalTransaction.value} -> R$${data.newValue}`);
                }

                if (data.newDescription) {
                    updates.description = data.newDescription;
                    changes.push(`descricao: "${originalTransaction.description}" -> "${data.newDescription}"`);
                }

                if (data.newCategory) {
                    updates.category = data.newCategory;
                    changes.push(`categoria: ${originalTransaction.category} -> ${data.newCategory}`);
                }

                if (data.newDate) {
                    updates.date = data.newDate;
                    changes.push(`data: ${originalTransaction.date} -> ${data.newDate}`);
                }

                if (data.newPaymentMethod) {
                    updates.paymentMethod = data.newPaymentMethod;
                    changes.push(`pagamento: ${originalTransaction.paymentMethod} -> ${data.newPaymentMethod}`);
                }

                if (data.newCardName) {
                    // Buscar cartao pelo nome
                    const card = await findCardByName(userId, data.newCardName);
                    if (card) {
                        updates.cardId = card.id;
                        updates.cardName = card.name;
                        changes.push(`cartao: ${originalTransaction.cardName || 'nenhum'} -> ${card.name}`);
                    }
                }

                // Se nao houver alteracoes
                if (changes.length === 0) {
                    return {
                        success: false,
                        message: 'Nenhuma alteracao especificada. Diga o que quer mudar (valor, descricao, categoria, data, etc).'
                    };
                }

                // Aplicar updates
                await db.collection('transactions').doc(targetDoc.id).update(updates);

                return {
                    success: true,
                    message: `Transacao "${originalTransaction.description}" editada:\n${changes.map(c => `- ${c}`).join('\n')}`
                };
            }

            // ========== ATUALIZACAO DE PROJECAO ==========
            case 'update_projection_status': {
                const projectionsSnapshot = await db.collection('projections')
                    .where('userId', '==', userId)
                    .where('status', '==', 'pending')
                    .get();

                if (projectionsSnapshot.empty) {
                    return {
                        success: false,
                        message: 'Nenhuma projecao pendente encontrada.'
                    };
                }

                // Tentar encontrar por descricao
                let targetDoc = null;
                if (data.description) {
                    targetDoc = projectionsSnapshot.docs.find(doc =>
                        doc.data().description.toLowerCase().includes(data.description.toLowerCase())
                    );
                }

                // Se nao encontrar, usar a mais recente
                if (!targetDoc) {
                    targetDoc = projectionsSnapshot.docs[0];
                }

                const proj = targetDoc.data();
                const newStatus = data.newStatus || 'received';

                await db.collection('projections').doc(targetDoc.id).update({
                    status: newStatus,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // Se marcou como recebido, criar transacao
                if (newStatus === 'received') {
                    const transaction = {
                        userId: userId,
                        type: proj.type || 'income',
                        description: `[Projecao] ${proj.description}`,
                        value: proj.value,
                        category: proj.type === 'income' ? 'Projecao Recebida' : 'Projecao Paga',
                        date: new Date().toISOString().split('T')[0],
                        paymentMethod: 'debit',
                        cardId: null,
                        projectionId: targetDoc.id,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        source: 'whatsapp_bot'
                    };
                    await db.collection('transactions').add(transaction);
                }

                const statusStr = newStatus === 'received' ? 'recebida' : (newStatus === 'canceled' ? 'cancelada' : 'pendente');

                return {
                    success: true,
                    message: `Projecao "${proj.description}" marcada como ${statusStr}${newStatus === 'received' ? ' e transacao criada' : ''}.`
                };
            }

            // ========== AJUDA ==========
            case 'help': {
                return {
                    success: true,
                    message: `Comandos disponiveis:\n
TRANSACOES:
- "gastei 50 no mercado"
- "recebi 3000 de salario"
- "paguei 100 no nubank ifood"
- "gastei 200 ontem restaurante"

PARCELAMENTOS:
- "parcelei 1200 em 12x no inter celular"

ASSINATURAS:
- "assinatura netflix 55 dia 15"

PROJECOES:
- "vou receber 500 dia 20 freelance"
- "recebi o freelance" (marca como recebido)

INVESTIMENTOS:
- "guardei 1000 na poupanca"

CARTOES:
- "cadastra cartao nubank limite 5000 fecha 10 vence 17"

CONSULTAS:
- "saldo" ou "qual meu saldo"
- "resumo" ou "resumo do mes"
- "cartoes" ou "meus cartoes"
- "faturas"

OUTROS:
- "cancela ultima transacao"

EMPRESA:
- Use "@Empresa" no inicio da mensagem
- Ex: "@Empresa gastei 500 em material"
- Sem @Empresa = conta pessoal (SEMPRE)`
                };
            }

            default:
                return {
                    success: false,
                    message: interpretation.message || 'Comando nao reconhecido. Digite "ajuda" para ver os comandos disponiveis.'
                };
        }
    } catch (error) {
        console.error('[executeFinanceAction] Erro:', error);
        return {
            success: false,
            message: 'Erro ao processar comando. Tente novamente.'
        };
    }
}

/**
 * Converte formatacao Markdown para WhatsApp
 * Markdown: **bold**, __italic__, ~~strike~~
 * WhatsApp: *bold*, _italic_, ~strike~
 */
function convertMarkdownToWhatsApp(text) {
    if (!text) return text;

    return text
        // Negrito: **texto** ou __texto__ -> *texto*
        .replace(/\*\*(.+?)\*\*/g, '*$1*')
        .replace(/__(.+?)__/g, '*$1*')
        // Italico: _texto_ ja e compativel com WhatsApp
        // Tachado: ~~texto~~ -> ~texto~
        .replace(/~~(.+?)~~/g, '~$1~');
}

/**
 * Enviar mensagem via WhatsApp Cloud API
 */
async function sendWhatsAppReply(to, message) {
    if (!WA_CONFIG.phoneNumberId || !WA_CONFIG.accessToken) {
        console.error('[sendWhatsAppReply] Configuracao WhatsApp incompleta');
        return false;
    }

    // Converter formatacao Markdown para WhatsApp
    const formattedMessage = convertMarkdownToWhatsApp(message);

    try {
        const response = await axios.post(
            `${WA_CONFIG.apiUrl}/${WA_CONFIG.apiVersion}/${WA_CONFIG.phoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'text',
                text: { body: formattedMessage }
            },
            {
                headers: {
                    'Authorization': `Bearer ${WA_CONFIG.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('[sendWhatsAppReply] Mensagem enviada para', to);
        return true;

    } catch (error) {
        console.error('[sendWhatsAppReply] Erro:', error.response?.data || error.message);
        return false;
    }
}

// ========================================
// WHATSAPP BOT - TRANSCRICAO DE AUDIO
// ========================================

const FormData = require('form-data');

/**
 * Baixar midia do WhatsApp em 2 passos:
 * 1. GET /{MEDIA_ID} -> retorna URL da midia
 * 2. GET na URL -> retorna bytes do arquivo
 *
 * @param {string} mediaId - ID da midia (message.audio.id)
 * @returns {Promise<{buffer: Buffer, mimeType: string}>}
 */
async function downloadWhatsAppMedia(mediaId) {
    // Step 1: Obter URL da midia
    const mediaInfoResponse = await axios.get(
        `${WA_CONFIG.apiUrl}/${WA_CONFIG.apiVersion}/${mediaId}`,
        {
            headers: { 'Authorization': `Bearer ${WA_CONFIG.accessToken}` },
            timeout: 15000
        }
    );

    const mediaUrl = mediaInfoResponse.data.url;
    const mimeType = mediaInfoResponse.data.mime_type || 'audio/ogg';

    console.log('[downloadWhatsAppMedia] URL obtida, mimeType:', mimeType);

    // Step 2: Baixar arquivo (URL expira em 5 minutos)
    const fileResponse = await axios.get(mediaUrl, {
        headers: { 'Authorization': `Bearer ${WA_CONFIG.accessToken}` },
        responseType: 'arraybuffer',
        timeout: 30000
    });

    return {
        buffer: Buffer.from(fileResponse.data),
        mimeType: mimeType
    };
}

/**
 * Transcrever audio usando OpenAI Whisper API
 *
 * @param {Buffer} audioBuffer - Bytes do arquivo de audio
 * @param {string} mimeType - MIME type do audio (ex: audio/ogg; codecs=opus)
 * @returns {Promise<string>} - Texto transcrito
 */
async function transcribeAudio(audioBuffer, mimeType) {
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY nao configurada');
    }

    // Determinar extensao pelo mimeType
    const mimeBase = mimeType.split(';')[0].trim();
    const extensions = {
        'audio/ogg': 'ogg',
        'audio/mpeg': 'mp3',
        'audio/mp4': 'm4a',
        'audio/wav': 'wav',
        'audio/webm': 'webm'
    };
    const extension = extensions[mimeBase] || 'ogg';

    const formData = new FormData();
    formData.append('file', audioBuffer, {
        filename: `audio.${extension}`,
        contentType: mimeBase
    });
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');
    formData.append('response_format', 'text');

    const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
            headers: {
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
                ...formData.getHeaders()
            },
            timeout: 60000,
            maxContentLength: 25 * 1024 * 1024, // 25MB max
            maxBodyLength: 25 * 1024 * 1024
        }
    );

    const transcription = (typeof response.data === 'string' ? response.data : response.data.text || '').trim();
    console.log('[transcribeAudio] Transcricao:', transcription.substring(0, 100) + (transcription.length > 100 ? '...' : ''));

    return transcription;
}

/**
 * Processar mensagem de audio: download + transcricao
 *
 * @param {object} message - Objeto da mensagem WhatsApp
 * @param {string} from - Numero do remetente
 * @returns {Promise<string>} - Texto transcrito
 */
async function processAudioMessage(message, from) {
    const audioId = message.audio?.id;
    const mimeType = message.audio?.mime_type || 'audio/ogg';

    if (!audioId) {
        throw new Error('ID do audio nao encontrado');
    }

    console.log('[processAudioMessage] Baixando audio:', audioId, 'from:', from);
    const { buffer, mimeType: detectedMimeType } = await downloadWhatsAppMedia(audioId);

    // Validar tamanho (WhatsApp limita a ~16MB, Whisper aceita ate 25MB)
    const fileSizeMB = buffer.length / (1024 * 1024);
    console.log('[processAudioMessage] Tamanho do audio:', fileSizeMB.toFixed(2), 'MB');

    if (buffer.length > 16 * 1024 * 1024) {
        throw new Error('Audio muito grande (max 16MB)');
    }

    console.log('[processAudioMessage] Transcrevendo audio...');
    const transcription = await transcribeAudio(buffer, detectedMimeType || mimeType);

    if (!transcription || transcription.length < 2) {
        throw new Error('Transcricao vazia ou muito curta');
    }

    return transcription;
}

// ========================================
// WHATSAPP BOT - ENDPOINTS
// ========================================

/**
 * Webhook do WhatsApp - Recebe e processa mensagens
 * GET: Verificacao do webhook pelo Meta
 * POST: Recebimento de mensagens/notificacoes
 */
exports.whatsappWebhook = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }
    // Webhook do WhatsApp - limite mais alto para nao bloquear notificacoes
    if (!applyRateLimit(req, res, 'webhook')) return;

    // GET: Verificacao do webhook pelo Meta
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];

        if (mode === 'subscribe' && token === WA_CONFIG.verifyToken) {
            console.log('[whatsappWebhook] Webhook verificado com sucesso');
            return res.status(200).send(challenge);
        }

        console.error('[whatsappWebhook] Falha na verificacao');
        return res.status(403).send('Verificacao falhou');
    }

    // POST: Recebimento de mensagens
    if (req.method === 'POST') {
        const body = req.body;

        // Log sem dados sensiveis (apenas metadados)
        console.log('[whatsappWebhook] Notificacao:', body.object, body.entry?.[0]?.changes?.[0]?.field);

        // IMPORTANTE: Processar ANTES de responder (Cloud Functions encerra apos res.send)
        try {
            // Verificar se e uma mensagem valida
            if (body.object !== 'whatsapp_business_account') {
                return res.status(200).send('OK');
            }

            const entry = body.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;
            const messages = value?.messages;

            if (!messages || messages.length === 0) {
                // Pode ser status update, nao mensagem
                return res.status(200).send('OK');
            }

            const message = messages[0];
            const from = message.from; // Numero do remetente
            const messageType = message.type;
            const messageId = message.id;

            // DEDUPLICACAO: Usar messageId como ID do documento para atomicidade
            // Meta/WhatsApp envia o mesmo webhook multiplas vezes
            const msgDocRef = db.collection('whatsappMessages').doc(messageId);
            const existingMsg = await msgDocRef.get();

            if (existingMsg.exists) {
                // Mensagem ja processada ou em processamento, ignorar
                console.log('[whatsappWebhook] Mensagem duplicada ignorada:', messageId);
                return res.status(200).send('OK');
            }

            // Salvar imediatamente para bloquear outras requisicoes duplicadas
            await msgDocRef.set({
                from: from,
                messageId: messageId,
                receivedAt: admin.firestore.FieldValue.serverTimestamp(),
                processed: false,
                processing: true
            });

            // RATE LIMITING - max 15 mensagens por minuto por numero
            if (!checkRateLimit(from)) {
                console.log('[whatsappWebhook] Rate limit excedido para:', from);
                await sendWhatsAppReply(from, 'Voce esta enviando muitas mensagens. Aguarde um minuto e tente novamente.');
                return res.status(200).send('OK');
            }

            console.log('[whatsappWebhook] Mensagem de', from, 'tipo:', messageType);

            // Buscar usuario pelo numero de WhatsApp
            const whatsappUser = await getUserByWhatsAppNumber(from);

            // Verificar se o numero esta cadastrado
            if (!whatsappUser) {
                // Se tem lista de autorizados, verificar
                if (AUTHORIZED_WHATSAPP_NUMBERS.length > 0 && !AUTHORIZED_WHATSAPP_NUMBERS.includes(from)) {
                    console.log('[whatsappWebhook] Numero nao cadastrado:', from);
                    await sendWhatsAppReply(from, 'Seu numero nao esta cadastrado no sistema.\n\nPeca para um administrador cadastrar seu numero no painel de Financas.');
                    return res.status(200).send('OK');
                }
            }

            // Processar mensagens de texto ou audio
            let rawText = '';
            let isAudioMessage = false;

            if (messageType === 'text') {
                rawText = message.text?.body?.trim() || '';
            } else if (messageType === 'audio') {
                // Transcrever audio com OpenAI Whisper
                isAudioMessage = true;
                try {
                    console.log('[whatsappWebhook] Processando audio de:', from);
                    rawText = await processAudioMessage(message, from);

                    // Salvar info de transcricao no documento
                    await msgDocRef.update({
                        isAudioMessage: true,
                        audioTranscription: rawText.substring(0, 500)
                    });

                    console.log('[whatsappWebhook] Audio transcrito:', rawText.substring(0, 80));
                } catch (audioError) {
                    console.error('[whatsappWebhook] Erro ao processar audio:', audioError.message);

                    // Mensagem de erro apropriada
                    let errorMessage = 'Desculpe, nao consegui entender o audio. ';
                    if (audioError.message.includes('muito grande')) {
                        errorMessage += 'O audio e muito longo, envie um mais curto (max 1 minuto).';
                    } else if (audioError.message.includes('OPENAI_API_KEY')) {
                        errorMessage += 'Transcricao de audio nao configurada. Digite sua mensagem.';
                    } else if (audioError.message.includes('vazia') || audioError.message.includes('curta')) {
                        errorMessage += 'Nao consegui identificar fala no audio. Tente falar mais claramente.';
                    } else {
                        errorMessage += 'Tente novamente ou digite sua mensagem.';
                    }

                    await sendWhatsAppReply(from, errorMessage);
                    return res.status(200).send('OK');
                }
            } else {
                // Outros tipos (imagem, video, documento, etc)
                await sendWhatsAppReply(from, 'Por enquanto, so consigo processar texto e audio. Envie comandos como "gastei 50 no mercado" ou grave um audio.');
                return res.status(200).send('OK');
            }

            if (!rawText) {
                return res.status(200).send('OK');
            }

            // DETECCAO DE GRUPO: Verifica se a mensagem veio de um grupo
            // Na WhatsApp Cloud API, grupos sao identificados pelo campo 'from' terminando em @g.us
            // ou pelo campo 'context.from' em respostas, ou pelo campo 'group_id' em algumas versoes
            const isGroup = !!(
                message.context?.group_id ||
                message.group_id ||
                from.includes('-') // Grupos geralmente tem IDs com hifen (ex: 123456789-1234567890)
            );

            console.log('[whatsappWebhook] Origem:', isGroup ? 'GRUPO' : 'INDIVIDUAL', '| From:', from);

            // Parsear contexto da mensagem (mencoes e tipo de conta)
            const { shouldProcess, isCompany, cleanText, mentionType } = parseMessageContext(rawText, isGroup);

            // EM GRUPOS: Ignorar mensagens sem mencao (@Claytinho ou @Empresa)
            if (!shouldProcess) {
                console.log('[whatsappWebhook] Mensagem de grupo sem mencao, ignorando');
                // Nao registrar como processado, apenas ignorar silenciosamente
                await msgDocRef.delete(); // Remove o registro de deduplicacao
                return res.status(200).send('OK');
            }

            const targetUserId = isCompany ? COMPANY_USER_ID : (whatsappUser?.userId || COMPANY_USER_ID);

            console.log('[whatsappWebhook] Contexto:', isCompany ? 'EMPRESA' : 'PESSOAL', '| Mencao:', mentionType || 'nenhuma', '| UserId:', targetUserId);

            // Atualizar documento da mensagem com dados completos
            await msgDocRef.update({
                textLength: rawText.length,
                isCompany: isCompany,
                isGroup: isGroup,
                mentionType: mentionType,
                targetUserId: targetUserId,
                userName: whatsappUser?.userName || 'Desconhecido'
            });

            // Buscar nome do usuario
            const userName = whatsappUser?.userName || 'Usuario';

            // OTIMIZACAO: Para saudacoes simples, nao carregar overview completa
            const lowerText = cleanText.toLowerCase();
            const isSimpleGreeting = SIMPLE_GREETINGS.some(g => lowerText === g || lowerText.startsWith(g + ' ') || lowerText.startsWith(g + '!'));

            let userCards = [];
            let financialOverview = '';

            if (isSimpleGreeting) {
                // Resposta rapida para saudacoes
                const contextLabel = isCompany ? '[EMPRESA] ' : '';
                const groupTip = isGroup ? '\n\nDica: Use @Claytinho para sua conta pessoal ou @Empresa para a conta da empresa!' : '';
                const greetingResponse = `Oi ${userName}! Como posso te ajudar com suas financas hoje? Voce pode me perguntar:\n\n- "como estou?" - resumo do mes\n- "gastei X em Y" - registrar gasto\n- "quanto tenho?" - saldo atual\n- "ajuda" - ver todos os comandos${groupTip}`;
                await sendWhatsAppReply(from, contextLabel + greetingResponse);
                return res.status(200).send('OK');
            }

            // Buscar cartoes e overview financeira em paralelo
            [userCards, financialOverview] = await Promise.all([
                getUserCards(targetUserId),
                buildFinancialOverview(targetUserId, userName)
            ]);

            console.log('[whatsappWebhook] Usuario:', userName, '| Overview length:', financialOverview.length, '| Cartoes:', userCards.map(c => c.name));

            // Interpretar com contexto completo (overview + cartoes + nome)
            const interpretation = await interpretFinanceCommand(cleanText, userCards, financialOverview, userName);

            // Se for texto puro (conversa), enviar direto
            if (typeof interpretation === 'string') {
                const contextLabel = isCompany ? '[EMPRESA] ' : '';
                await sendWhatsAppReply(from, contextLabel + interpretation);
                return res.status(200).send('OK');
            }

            // Verificar confianca (para acoes JSON)
            if (interpretation.confidence < 0.5) {
                await sendWhatsAppReply(from, interpretation.message);
                return res.status(200).send('OK');
            }

            // Executar acao no Firestore com o userId correto
            const result = await executeFinanceAction(interpretation, targetUserId);

            // Adicionar indicador de contexto na resposta
            const contextLabel = isCompany ? '[EMPRESA] ' : '';

            // Resposta humanizada (gerada pelo Gemini no campo message)
            await sendWhatsAppReply(from, contextLabel + (result.success ? interpretation.message : result.message));

            // Atualizar registro como processado
            await msgDocRef.update({
                processed: true,
                processing: false,
                interpretation: interpretation,
                result: result,
                processedAt: admin.firestore.FieldValue.serverTimestamp()
            });

        } catch (error) {
            console.error('[whatsappWebhook] Erro ao processar:', error);
        }

        // Responder 200 OK apos processar (WhatsApp aceita ate 20s)
        return res.status(200).send('OK');
    }

    return res.status(405).send('Metodo nao permitido');
});

/**
 * Enviar mensagem WhatsApp para um cliente
 * POST /sendWhatsAppMessage
 * Body: { to: "5511999999999", message: "Sua mensagem", template?: { name, language, components } }
 */
exports.sendWhatsAppMessage = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!applyRateLimit(req, res, 'default')) return;

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    const { to, message, template } = req.body;

    if (!to) {
        return res.status(400).json({ error: 'Numero de destino (to) obrigatorio' });
    }

    if (!message && !template) {
        return res.status(400).json({ error: 'message ou template obrigatorio' });
    }

    if (!WA_CONFIG.phoneNumberId || !WA_CONFIG.accessToken) {
        return res.status(500).json({ error: 'Configuracao WhatsApp incompleta' });
    }

    try {
        let payload;

        if (template) {
            // Enviar mensagem com template (para mensagens proativas)
            payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'template',
                template: {
                    name: template.name,
                    language: { code: template.language || 'pt_BR' },
                    components: template.components || []
                }
            };
        } else {
            // Enviar mensagem de texto simples
            payload = {
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to: to,
                type: 'text',
                text: { body: message }
            };
        }

        const response = await axios.post(
            `${WA_CONFIG.apiUrl}/${WA_CONFIG.apiVersion}/${WA_CONFIG.phoneNumberId}/messages`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${WA_CONFIG.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log('[sendWhatsAppMessage] Enviado para', to);

        // Salvar no historico
        await db.collection('whatsappMessagesSent').add({
            to: to,
            message: message || `Template: ${template?.name}`,
            template: template || null,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            response: response.data
        });

        res.json({
            success: true,
            messageId: response.data.messages?.[0]?.id,
            to: to
        });

    } catch (error) {
        console.error('[sendWhatsAppMessage] Erro:', error.response?.data || error.message);
        res.status(500).json({
            error: 'Erro ao enviar mensagem',
            details: error.response?.data || error.message
        });
    }
});

/**
 * Verificar status do bot WhatsApp
 * GET /whatsappStatus
 */
exports.whatsappStatus = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!applyRateLimit(req, res, 'readonly')) return;

    const configured = !!(WA_CONFIG.phoneNumberId && WA_CONFIG.accessToken);
    const geminiConfigured = !!GEMINI_API_KEY;

    // Buscar ultimas mensagens
    let recentMessages = [];
    try {
        const msgsSnapshot = await db.collection('whatsappMessages')
            .orderBy('receivedAt', 'desc')
            .limit(5)
            .get();

        recentMessages = msgsSnapshot.docs.map(doc => ({
            id: doc.id,
            from: doc.data().from,
            text: doc.data().text?.substring(0, 50) + (doc.data().text?.length > 50 ? '...' : ''),
            processed: doc.data().processed,
            receivedAt: doc.data().receivedAt?.toDate?.()?.toISOString() || null
        }));
    } catch (e) {
        console.log('[whatsappStatus] Erro ao buscar mensagens:', e.message);
    }

    // Buscar usuarios cadastrados
    let registeredUsers = [];
    try {
        const usersSnapshot = await db.collection('whatsappUsers').get();
        registeredUsers = usersSnapshot.docs.map(doc => ({
            whatsappNumber: doc.id,
            userName: doc.data().userName,
            userId: doc.data().userId
        }));
    } catch (e) {
        console.log('[whatsappStatus] Erro ao buscar usuarios:', e.message);
    }

    res.json({
        status: configured && geminiConfigured ? 'ready' : 'incomplete_config',
        whatsappConfigured: configured,
        geminiConfigured: geminiConfigured,
        authorizedNumbers: AUTHORIZED_WHATSAPP_NUMBERS.length,
        registeredUsers: registeredUsers,
        companyUserId: COMPANY_USER_ID,
        webhookUrl: `${FUNCTIONS_URL}/whatsappWebhook`,
        recentMessages: recentMessages
    });
});

/**
 * Registrar numero de WhatsApp para um usuario
 * REQUER AUTENTICACAO DE ADMIN
 * POST /registerWhatsAppUser
 * Body: { whatsappNumber: "5511999999999", userId: "firebase-uid", userName: "Nome" }
 * Headers: Authorization: Bearer <firebase-id-token>
 */
exports.registerWhatsAppUser = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }
    if (!applyRateLimit(req, res, 'default')) return;

    // VERIFICAR AUTENTICACAO DE ADMIN
    const authResult = await verifyAdminToken(req);
    if (!authResult.isAdmin) {
        console.log('[registerWhatsAppUser] Acesso negado:', authResult.error, '| Email:', authResult.email);
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Apenas administradores podem gerenciar usuarios do WhatsApp',
            details: authResult.error
        });
    }

    console.log('[registerWhatsAppUser] Admin autenticado:', authResult.email);

    // GET: Listar usuarios cadastrados
    if (req.method === 'GET') {
        try {
            const usersSnapshot = await db.collection('whatsappUsers').get();
            const users = usersSnapshot.docs.map(doc => ({
                whatsappNumber: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
            }));
            return res.json({ success: true, users });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    // DELETE: Remover usuario
    if (req.method === 'DELETE') {
        const { whatsappNumber } = req.body || req.query;
        if (!whatsappNumber) {
            return res.status(400).json({ error: 'whatsappNumber obrigatorio' });
        }

        try {
            await db.collection('whatsappUsers').doc(whatsappNumber).delete();
            console.log('[registerWhatsAppUser] Usuario removido por', authResult.email, ':', whatsappNumber);
            return res.json({ success: true, message: `Usuario ${whatsappNumber} removido` });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    // POST: Registrar usuario
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    const { whatsappNumber, userId, userName, email } = req.body;

    if (!whatsappNumber) {
        return res.status(400).json({ error: 'whatsappNumber obrigatorio (formato: 5511999999999)' });
    }

    // Buscar userId pelo email se fornecido
    let finalUserId = userId;
    let finalUserName = userName;

    if (email && !userId) {
        try {
            const userRecord = await admin.auth().getUserByEmail(email);
            finalUserId = userRecord.uid;
            finalUserName = userName || userRecord.displayName || email.split('@')[0];
            console.log(`[registerWhatsAppUser] Email ${email} -> UID ${finalUserId}`);
        } catch (emailError) {
            return res.status(404).json({
                error: 'Email nao encontrado no Firebase Auth',
                email: email,
                details: emailError.message
            });
        }
    }

    if (!finalUserId) {
        return res.status(400).json({ error: 'userId ou email obrigatorio' });
    }

    // Limpar numero (remover caracteres especiais)
    const cleanNumber = whatsappNumber.replace(/\D/g, '');

    try {
        await registerWhatsAppUser(cleanNumber, finalUserId, finalUserName || 'Usuario');

        res.json({
            success: true,
            message: `Numero ${cleanNumber} cadastrado para ${finalUserName || finalUserId}`,
            data: {
                whatsappNumber: cleanNumber,
                userId: finalUserId,
                userName: finalUserName || 'Usuario',
                email: email || null
            }
        });
    } catch (error) {
        console.error('[registerWhatsAppUser] Erro:', error);
        res.status(500).json({ error: 'Erro ao registrar usuario', details: error.message });
    }
});

/**
 * Vincular/desvincular MEU numero de WhatsApp (para usuarios comuns)
 * Permite que qualquer usuario autenticado vincule APENAS seu proprio numero
 *
 * GET /linkMyWhatsApp - Verifica se tem numero vinculado
 * POST /linkMyWhatsApp - Vincula numero a propria conta
 * DELETE /linkMyWhatsApp - Remove vinculo do proprio numero
 *
 * Headers: Authorization: Bearer <firebase-id-token>
 */
exports.linkMyWhatsApp = functions.https.onRequest(async (req, res) => {
    setCorsHeaders(res, req);

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }
    if (!applyRateLimit(req, res, 'default')) return;

    // Verificar autenticacao (qualquer usuario logado)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token de autenticacao obrigatorio' });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;

    try {
        decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
        console.error('[linkMyWhatsApp] Token invalido:', error.message);
        return res.status(401).json({ error: 'Token invalido ou expirado' });
    }

    const userId = decodedToken.uid;
    const userEmail = decodedToken.email;
    const userName = decodedToken.name || userEmail?.split('@')[0] || 'Usuario';

    console.log('[linkMyWhatsApp] Usuario autenticado:', userEmail, '| UID:', userId);

    // GET: Verificar se usuario tem numero vinculado
    if (req.method === 'GET') {
        try {
            const snapshot = await db.collection('whatsappUsers')
                .where('userId', '==', userId)
                .limit(1)
                .get();

            if (snapshot.empty) {
                return res.json({
                    success: true,
                    linked: false,
                    whatsappNumber: null
                });
            }

            const doc = snapshot.docs[0];
            return res.json({
                success: true,
                linked: true,
                whatsappNumber: doc.id,
                linkedAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
            });
        } catch (error) {
            console.error('[linkMyWhatsApp] Erro ao buscar:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // DELETE: Remover vinculo do proprio numero
    if (req.method === 'DELETE') {
        try {
            // Buscar numero vinculado ao usuario
            const snapshot = await db.collection('whatsappUsers')
                .where('userId', '==', userId)
                .get();

            if (snapshot.empty) {
                return res.status(404).json({
                    error: 'Nenhum numero vinculado',
                    message: 'Voce nao tem nenhum numero de WhatsApp vinculado'
                });
            }

            // Remover todos os numeros vinculados (normalmente so 1)
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();

            const removedNumbers = snapshot.docs.map(d => d.id);
            console.log('[linkMyWhatsApp] Numeros removidos por', userEmail, ':', removedNumbers);

            return res.json({
                success: true,
                message: 'Numero desvinculado com sucesso',
                removedNumbers: removedNumbers
            });
        } catch (error) {
            console.error('[linkMyWhatsApp] Erro ao remover:', error);
            return res.status(500).json({ error: error.message });
        }
    }

    // POST: Vincular numero a propria conta
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    const { whatsappNumber } = req.body;

    if (!whatsappNumber) {
        return res.status(400).json({
            error: 'whatsappNumber obrigatorio',
            example: '5521999999999'
        });
    }

    // Limpar numero (remover caracteres especiais)
    const cleanNumber = whatsappNumber.replace(/\D/g, '');

    // Validar formato do numero
    if (cleanNumber.length < 12 || cleanNumber.length > 13) {
        return res.status(400).json({
            error: 'Numero invalido',
            message: 'Use o formato completo com DDI+DDD+numero (ex: 5521999999999)',
            received: cleanNumber
        });
    }

    try {
        // Verificar se o numero ja esta vinculado a outro usuario
        const existingDoc = await db.collection('whatsappUsers').doc(cleanNumber).get();

        if (existingDoc.exists) {
            const existingUserId = existingDoc.data().userId;

            if (existingUserId === userId) {
                // Ja esta vinculado a este usuario
                return res.json({
                    success: true,
                    message: 'Este numero ja esta vinculado a sua conta',
                    alreadyLinked: true,
                    whatsappNumber: cleanNumber
                });
            } else {
                // Vinculado a outro usuario
                return res.status(409).json({
                    error: 'Numero ja vinculado',
                    message: 'Este numero ja esta vinculado a outra conta'
                });
            }
        }

        // Remover vinculos anteriores deste usuario (1 numero por usuario)
        const previousSnapshot = await db.collection('whatsappUsers')
            .where('userId', '==', userId)
            .get();

        if (!previousSnapshot.empty) {
            const batch = db.batch();
            previousSnapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            console.log('[linkMyWhatsApp] Vinculos anteriores removidos para', userEmail);
        }

        // Criar novo vinculo
        await db.collection('whatsappUsers').doc(cleanNumber).set({
            userId: userId,
            userName: userName,
            email: userEmail,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            linkedBy: 'self' // Indica que o proprio usuario vinculou
        });

        console.log('[linkMyWhatsApp] Numero vinculado:', cleanNumber, '->', userEmail);

        return res.json({
            success: true,
            message: 'Numero vinculado com sucesso!',
            whatsappNumber: cleanNumber,
            userName: userName
        });

    } catch (error) {
        console.error('[linkMyWhatsApp] Erro ao vincular:', error);
        return res.status(500).json({ error: 'Erro ao vincular numero', details: error.message });
    }
});
