/**
 * Cloud Functions - ImaginaTech
 * Integracao com Mercado Livre
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors')({ origin: true });
const crypto = require('crypto');

admin.initializeApp();
const db = admin.firestore();

// ========== PKCE HELPERS ==========
function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// Configuracoes do Mercado Livre (usando variaveis de ambiente)
const ML_CONFIG = {
    appId: process.env.ML_APP_ID,
    secretKey: process.env.ML_SECRET_KEY,
    redirectUri: process.env.ML_REDIRECT_URI || 'https://us-central1-imaginatech-servicos.cloudfunctions.net/mlOAuthCallback',
    authUrl: 'https://auth.mercadolivre.com.br/authorization',
    tokenUrl: 'https://api.mercadolibre.com/oauth/token',
    apiUrl: 'https://api.mercadolibre.com'
};

/**
 * Gera URL de autorizacao do Mercado Livre com PKCE
 * GET /mlAuth
 */
exports.mlAuth = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            // Gerar PKCE code_verifier e code_challenge
            const codeVerifier = generateCodeVerifier();
            const codeChallenge = generateCodeChallenge(codeVerifier);

            // Salvar code_verifier no Firestore (expira em 10 min)
            await db.collection('mlCredentials').doc('pkce').set({
                codeVerifier: codeVerifier,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutos
            });

            // URL com PKCE
            const authUrl = `${ML_CONFIG.authUrl}?response_type=code&client_id=${ML_CONFIG.appId}&redirect_uri=${encodeURIComponent(ML_CONFIG.redirectUri)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

            // Se for chamada AJAX, retorna a URL
            if (req.headers.accept?.includes('application/json')) {
                res.json({ authUrl });
            } else {
                // Se for acesso direto, redireciona
                res.redirect(authUrl);
            }
        } catch (error) {
            console.error('Erro ao gerar URL de auth:', error);
            res.status(500).send('Erro ao iniciar autenticacao');
        }
    });
});

/**
 * Callback OAuth - Recebe code e troca por token
 * GET /mlOAuthCallback?code=XXX
 */
exports.mlOAuthCallback = functions.https.onRequest(async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send('Codigo de autorizacao nao fornecido');
    }

    try {
        // Trocar code por access_token
        const tokenResponse = await axios.post(ML_CONFIG.tokenUrl, {
            grant_type: 'authorization_code',
            client_id: ML_CONFIG.appId,
            client_secret: ML_CONFIG.secretKey,
            code: code,
            redirect_uri: ML_CONFIG.redirectUri
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

        // Redirecionar para pagina de sucesso
        res.redirect('https://imaginatech.com.br/marketplace/?ml_connected=true');

    } catch (error) {
        console.error('Erro no OAuth ML:', error.response?.data || error.message);
        res.redirect('https://imaginatech.com.br/marketplace/?ml_error=true');
    }
});

/**
 * Webhook do Mercado Livre - Recebe notificacoes E OAuth callback
 * GET /mlwebhook?code=XXX (OAuth callback)
 * POST /mlwebhook (Webhook notificacoes)
 */
exports.mlwebhook = functions.https.onRequest(async (req, res) => {
    // GET com code = OAuth callback
    if (req.method === 'GET' && req.query.code) {
        const { code } = req.query;

        try {
            // Recuperar code_verifier do Firestore (PKCE)
            const pkceDoc = await db.collection('mlCredentials').doc('pkce').get();
            if (!pkceDoc.exists) {
                console.error('PKCE code_verifier nao encontrado');
                return res.redirect('https://imaginatech.com.br/marketplace/?ml_error=true');
            }
            const { codeVerifier } = pkceDoc.data();

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

            // Redirecionar para pagina de sucesso
            return res.redirect('https://imaginatech.com.br/marketplace/?ml_connected=true');

        } catch (error) {
            console.error('Erro no OAuth ML:', error.response?.data || error.message);
            return res.redirect('https://imaginatech.com.br/marketplace/?ml_error=true');
        }
    }

    // POST = Webhook de notificacoes do ML
    if (req.method === 'POST') {
        const notification = req.body;

        console.log('Notificacao ML recebida:', JSON.stringify(notification));

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

/**
 * Sincronizar produto com Mercado Livre
 * POST /syncProductToML
 * Body: { productId: "xxx" }
 */
exports.syncProductToML = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Metodo nao permitido' });
        }

        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ error: 'productId obrigatorio' });
        }

        try {
            // Buscar produto no Firestore
            const productDoc = await db.collection('products').doc(productId).get();

            if (!productDoc.exists) {
                return res.status(404).json({ error: 'Produto nao encontrado' });
            }

            const product = productDoc.data();
            const accessToken = await getValidAccessToken();

            // Preparar dados para ML
            const mlData = {
                title: product.name,
                available_quantity: product.minStockQuantity || 1,
                // Adicionar mais campos conforme necessario
            };

            let response;

            if (product.mlbId) {
                // Atualizar anuncio existente
                response = await axios.put(
                    `${ML_CONFIG.apiUrl}/items/${product.mlbId}`,
                    mlData,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );

                console.log(`Produto ${productId} atualizado no ML: ${product.mlbId}`);
            } else {
                // Criar novo anuncio (requer mais campos)
                return res.status(400).json({
                    error: 'Produto sem mlbId. Use vincularProdutoML primeiro.',
                    message: 'Para criar um novo anuncio, vincule manualmente o produto a um anuncio existente no ML.'
                });
            }

            // Atualizar timestamp de sincronizacao
            await db.collection('products').doc(productId).update({
                mlLastSync: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                success: true,
                message: 'Produto sincronizado com sucesso',
                mlbId: product.mlbId
            });

        } catch (error) {
            console.error('Erro ao sincronizar produto:', error.response?.data || error.message);
            res.status(500).json({
                error: 'Erro ao sincronizar',
                details: error.response?.data || error.message
            });
        }
    });
});

/**
 * Verificar status da conexao ML
 * GET /mlStatus
 */
exports.mlStatus = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
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
            console.error('Erro ao verificar status ML:', error);
            res.status(500).json({ error: 'Erro ao verificar status' });
        }
    });
});

/**
 * Buscar anuncios do usuario no ML
 * GET /mlListItems
 */
exports.mlListItems = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
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
            console.error('Erro ao listar anuncios ML:', error.response?.data || error.message);
            res.status(500).json({
                error: 'Erro ao listar anuncios',
                details: error.response?.data || error.message
            });
        }
    });
});

/**
 * Criar novo anuncio no Mercado Livre
 * POST /createMLItem
 * Body: { productId: "xxx" }
 */
exports.createMLItem = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Metodo nao permitido' });
        }

        const { productId } = req.body;

        if (!productId) {
            return res.status(400).json({ error: 'productId obrigatorio' });
        }

        try {
            // Buscar produto no Firestore
            const productDoc = await db.collection('products').doc(productId).get();

            if (!productDoc.exists) {
                return res.status(404).json({ error: 'Produto nao encontrado' });
            }

            const product = productDoc.data();

            // Validar campos obrigatorios para ML
            if (!product.name) {
                return res.status(400).json({ error: 'Nome do produto obrigatorio' });
            }
            if (!product.price || product.price <= 0) {
                return res.status(400).json({ error: 'Preco obrigatorio e deve ser maior que zero' });
            }
            if (!product.mlCategoryId) {
                return res.status(400).json({ error: 'Categoria ML obrigatoria' });
            }

            // Se ja tem mlbId, nao criar novo
            if (product.mlbId) {
                return res.status(400).json({
                    error: 'Produto ja publicado no ML',
                    mlbId: product.mlbId
                });
            }

            const accessToken = await getValidAccessToken();

            // Preparar fotos
            const pictures = (product.photos || []).map(url => ({ source: url }));
            if (pictures.length === 0) {
                return res.status(400).json({ error: 'Pelo menos uma foto e obrigatoria' });
            }

            // Preparar dados para criar anuncio
            const mlData = {
                title: product.name.substring(0, 60), // ML limita a 60 caracteres
                category_id: product.mlCategoryId,
                price: product.price,
                currency_id: 'BRL',
                available_quantity: product.minStockQuantity || 1,
                buying_mode: 'buy_it_now',
                listing_type_id: product.listingType || 'gold_special',
                condition: product.condition || 'new',
                pictures: pictures,
                description: {
                    plain_text: product.description || product.name
                }
            };

            console.log('Criando anuncio ML:', JSON.stringify(mlData));

            // Criar anuncio no ML
            const response = await axios.post(
                `${ML_CONFIG.apiUrl}/items`,
                mlData,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            const mlbId = response.data.id;
            const permalink = response.data.permalink;

            console.log(`Anuncio criado com sucesso: ${mlbId}`);

            // Salvar mlbId no produto
            await db.collection('products').doc(productId).update({
                mlbId: mlbId,
                mlPermalink: permalink,
                mlCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
                mlLastSync: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({
                success: true,
                message: 'Anuncio criado com sucesso!',
                mlbId: mlbId,
                permalink: permalink
            });

        } catch (error) {
            console.error('Erro ao criar anuncio ML:', error.response?.data || error.message);
            res.status(500).json({
                error: 'Erro ao criar anuncio',
                details: error.response?.data || error.message
            });
        }
    });
});
