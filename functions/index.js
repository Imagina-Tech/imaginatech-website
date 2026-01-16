/**
 * Cloud Functions - ImaginaTech
 * Integracao com Mercado Livre + Cloudinary
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors')({ origin: true });
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;

admin.initializeApp();
const db = admin.firestore();

// ========== CONFIGURACAO CLOUDINARY ==========
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

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

/**
 * Busca categorias do ML por termo de pesquisa
 * GET /mlSearchCategories?q=decoracao
 */
exports.mlSearchCategories = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        const query = req.query.q || '';

        if (!query || query.length < 2) {
            return res.json({ categories: [] });
        }

        try {
            // Buscar categorias usando predictor do ML
            const response = await axios.get(
                `${ML_CONFIG.apiUrl}/sites/MLB/domain_discovery/search?q=${encodeURIComponent(query)}`
            );

            const categories = response.data.map(item => ({
                id: item.category_id,
                name: item.category_name,
                domain: item.domain_name,
                path: item.attributes?.find(a => a.id === 'BRAND')?.value_name || ''
            }));

            res.json({ categories });
        } catch (error) {
            console.error('Erro ao buscar categorias:', error.response?.data || error.message);

            // Fallback: buscar nas categorias raiz
            try {
                const fallback = await axios.get(`${ML_CONFIG.apiUrl}/sites/MLB/categories`);
                const filtered = fallback.data.filter(cat =>
                    cat.name.toLowerCase().includes(query.toLowerCase())
                );
                res.json({
                    categories: filtered.map(c => ({
                        id: c.id,
                        name: c.name,
                        domain: '',
                        path: ''
                    }))
                });
            } catch {
                res.json({ categories: [] });
            }
        }
    });
});

/**
 * Obtem categorias raiz do ML
 * GET /mlRootCategories
 */
exports.mlRootCategories = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        try {
            const response = await axios.get(`${ML_CONFIG.apiUrl}/sites/MLB/categories`);

            const categories = response.data.map(cat => ({
                id: cat.id,
                name: cat.name
            }));

            res.json({ categories });
        } catch (error) {
            console.error('Erro ao buscar categorias raiz:', error.message);
            res.status(500).json({ error: 'Erro ao buscar categorias' });
        }
    });
});

/**
 * Obtem subcategorias de uma categoria
 * GET /mlSubcategories?id=MLB1039
 */
exports.mlSubcategories = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        const categoryId = req.query.id;

        if (!categoryId) {
            return res.status(400).json({ error: 'ID da categoria obrigatorio' });
        }

        try {
            const response = await axios.get(`${ML_CONFIG.apiUrl}/categories/${categoryId}`);

            const data = response.data;
            const subcategories = (data.children_categories || []).map(cat => ({
                id: cat.id,
                name: cat.name,
                totalItems: cat.total_items_in_this_category
            }));

            res.json({
                category: {
                    id: data.id,
                    name: data.name,
                    pathFromRoot: data.path_from_root
                },
                subcategories,
                hasChildren: subcategories.length > 0
            });
        } catch (error) {
            console.error('Erro ao buscar subcategorias:', error.message);
            res.status(500).json({ error: 'Erro ao buscar subcategorias' });
        }
    });
});

/**
 * Obtem atributos obrigatorios de uma categoria
 * GET /mlCategoryAttributes?id=MLB1039
 */
exports.mlCategoryAttributes = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        const categoryId = req.query.id;

        if (!categoryId) {
            return res.status(400).json({ error: 'ID da categoria obrigatorio' });
        }

        try {
            const response = await axios.get(`${ML_CONFIG.apiUrl}/categories/${categoryId}/attributes`);

            const attributes = response.data
                .filter(attr => attr.tags && (attr.tags.required || attr.tags.catalog_required))
                .map(attr => ({
                    id: attr.id,
                    name: attr.name,
                    type: attr.value_type,
                    required: true,
                    values: attr.values || [],
                    allowedUnits: attr.allowed_units || [],
                    hint: attr.hint || '',
                    tags: attr.tags
                }));

            // Tambem pegar alguns atributos importantes nao obrigatorios
            const recommended = response.data
                .filter(attr => !attr.tags?.required && !attr.tags?.catalog_required &&
                    ['BRAND', 'MODEL', 'GTIN', 'MPN', 'COLOR', 'SIZE'].includes(attr.id))
                .map(attr => ({
                    id: attr.id,
                    name: attr.name,
                    type: attr.value_type,
                    required: false,
                    values: attr.values || [],
                    allowedUnits: attr.allowed_units || [],
                    hint: attr.hint || ''
                }));

            res.json({
                required: attributes,
                recommended: recommended,
                total: response.data.length
            });
        } catch (error) {
            console.error('Erro ao buscar atributos:', error.message);
            res.status(500).json({ error: 'Erro ao buscar atributos' });
        }
    });
});

/**
 * Faz upload de imagem para o ML
 * POST /mlUploadImage
 * Body: { imageUrl: "https://...", productId: "xxx" }
 */
exports.mlUploadImage = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Metodo nao permitido' });
        }

        const { imageUrl } = req.body;

        if (!imageUrl) {
            return res.status(400).json({ error: 'imageUrl obrigatoria' });
        }

        try {
            const accessToken = await getValidAccessToken();

            // Fazer upload da imagem para o ML
            const response = await axios.post(
                `${ML_CONFIG.apiUrl}/pictures/items/upload`,
                { source: imageUrl },
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );

            res.json({
                success: true,
                pictureId: response.data.id,
                url: response.data.secure_url || response.data.url,
                variations: response.data.variations
            });
        } catch (error) {
            console.error('Erro ao fazer upload:', error.response?.data || error.message);
            res.status(500).json({
                error: 'Erro ao fazer upload da imagem',
                details: error.response?.data || error.message
            });
        }
    });
});

/**
 * Prediz a categoria baseada no titulo do produto
 * POST /mlPredictCategory
 * Body: { title: "Kit 10 Miniaturas Pokemon" }
 */
exports.mlPredictCategory = functions.https.onRequest(async (req, res) => {
    cors(req, res, async () => {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Metodo nao permitido' });
        }

        const { title } = req.body;

        if (!title || title.length < 3) {
            return res.status(400).json({ error: 'Titulo obrigatorio (min 3 caracteres)' });
        }

        try {
            const response = await axios.get(
                `${ML_CONFIG.apiUrl}/sites/MLB/domain_discovery/search?q=${encodeURIComponent(title)}`
            );

            if (response.data.length === 0) {
                return res.json({ predictions: [] });
            }

            const predictions = response.data.slice(0, 5).map(item => ({
                categoryId: item.category_id,
                categoryName: item.category_name,
                domainId: item.domain_id,
                domainName: item.domain_name,
                confidence: item.match_score || 0
            }));

            res.json({ predictions });
        } catch (error) {
            console.error('Erro ao predizer categoria:', error.message);
            res.status(500).json({ error: 'Erro ao predizer categoria' });
        }
    });
});

/**
 * ========================================
 * CLOUDINARY - Upload de Imagens
 * ========================================
 */

/**
 * Faz upload de imagem base64 para o Cloudinary
 * POST /uploadImage
 * Body: { image: "data:image/jpeg;base64,..." } ou { image: "https://..." }
 * Returns: { url: "https://res.cloudinary.com/..." }
 */
exports.uploadImage = functions.https.onRequest((req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    (async () => {

        const { image, folder = 'marketplace' } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'Imagem obrigatoria' });
        }

        // Verificar se Cloudinary esta configurado
        if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
            console.error('Cloudinary nao configurado');
            return res.status(500).json({ error: 'Servico de imagens nao configurado' });
        }

        try {
            console.log(`[CLOUDINARY] Upload iniciado, tamanho: ${image.length} chars`);

            // Upload para Cloudinary (aceita base64 ou URL)
            const result = await cloudinary.uploader.upload(image, {
                folder: `imaginatech/${folder}`,
                resource_type: 'image',
                transformation: [
                    { width: 1200, height: 1200, crop: 'limit' }, // Limita tamanho maximo
                    { quality: 'auto:good' }, // Otimiza qualidade
                    { fetch_format: 'auto' } // Formato otimizado (webp quando suportado)
                ]
            });

            console.log(`[CLOUDINARY] Upload concluido: ${result.secure_url}`);

            res.json({
                success: true,
                url: result.secure_url,
                publicId: result.public_id,
                width: result.width,
                height: result.height,
                format: result.format,
                bytes: result.bytes
            });

        } catch (error) {
            console.error('[CLOUDINARY] Erro no upload:', error.message);
            res.status(500).json({
                error: 'Erro ao fazer upload da imagem',
                details: error.message
            });
        }
    })();
});

/**
 * Faz upload de multiplas imagens para o Cloudinary
 * POST /uploadImages
 * Body: { images: ["data:image/...", "https://..."] }
 * Returns: { urls: ["https://res.cloudinary.com/..."] }
 */
exports.uploadImages = functions.https.onRequest((req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metodo nao permitido' });
    }

    const { images, folder = 'marketplace' } = req.body;

    if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'Array de imagens obrigatorio' });
    }

    if (images.length > 10) {
        return res.status(400).json({ error: 'Maximo de 10 imagens por vez' });
    }

    // Verificar se Cloudinary esta configurado
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
        return res.status(500).json({ error: 'Servico de imagens nao configurado' });
    }

    (async () => {
        try {
            console.log(`[CLOUDINARY] Upload de ${images.length} imagens iniciado`);

            const uploadPromises = images.map(async (image, index) => {
                try {
                    // Se ja e URL do Cloudinary, retorna direto
                    if (image.includes('res.cloudinary.com')) {
                        console.log(`[CLOUDINARY] Imagem ${index + 1} ja e URL Cloudinary`);
                        return { success: true, url: image, skipped: true };
                    }

                    // Se e URL externa (nao base64), retorna direto
                    if (image.startsWith('http') && !image.startsWith('data:')) {
                        console.log(`[CLOUDINARY] Imagem ${index + 1} e URL externa, mantendo`);
                        return { success: true, url: image, external: true };
                    }

                    // Upload base64 para Cloudinary
                    const result = await cloudinary.uploader.upload(image, {
                        folder: `imaginatech/${folder}`,
                        resource_type: 'image',
                        transformation: [
                            { width: 1200, height: 1200, crop: 'limit' },
                            { quality: 'auto:good' },
                            { fetch_format: 'auto' }
                        ]
                    });

                    console.log(`[CLOUDINARY] Imagem ${index + 1} uploaded: ${result.secure_url}`);
                    return { success: true, url: result.secure_url };

                } catch (err) {
                    console.error(`[CLOUDINARY] Erro na imagem ${index + 1}:`, err.message);
                    return { success: false, error: err.message, original: image.substring(0, 50) };
                }
            });

            const results = await Promise.all(uploadPromises);

            const urls = results
                .filter(r => r.success)
                .map(r => r.url);

            const errors = results.filter(r => !r.success);

            console.log(`[CLOUDINARY] Upload concluido: ${urls.length} sucesso, ${errors.length} erros`);

            res.json({
                success: errors.length === 0,
                urls: urls,
                total: images.length,
                uploaded: urls.length,
                errors: errors.length > 0 ? errors : undefined
            });

        } catch (error) {
            console.error('[CLOUDINARY] Erro geral:', error.message);
            res.status(500).json({
                error: 'Erro ao fazer upload das imagens',
                details: error.message
            });
        }
    })();
});
