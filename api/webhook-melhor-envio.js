// ==================================================
// ARQUIVO: api/webhook-melhor-envio.js
// LOCALIZAÇÃO: pasta "api" na raiz do projeto
// FUNÇÃO: Receber webhooks do Melhor Envio e salvar no Firebase
// VERSÃO: 1.0 - Webhook Receiver
// ==================================================

import crypto from 'crypto';
import admin from 'firebase-admin';

// Inicializar Firebase Admin (para salvar no Firestore)
if (!admin.apps.length) {
  try {
    // Use as credenciais do Firebase Admin SDK
    // IMPORTANTE: Configure FIREBASE_ADMIN_KEY na Vercel com o JSON da service account
    const serviceAccount = process.env.FIREBASE_ADMIN_KEY ? 
      JSON.parse(process.env.FIREBASE_ADMIN_KEY) : null;

    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: "imaginatech-servicos"
      });
    } else {
      // Fallback para ambiente de desenvolvimento
      admin.initializeApp({
        projectId: "imaginatech-servicos"
      });
    }
  } catch (error) {
    console.error('Erro ao inicializar Firebase Admin:', error);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  console.log('=== WEBHOOK RECEBIDO DO MELHOR ENVIO ===');
  console.log('Método:', req.method);
  console.log('Headers:', req.headers);
  
  // Apenas aceitar POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Pegar o body da requisição
    const body = req.body;
    console.log('Body recebido:', JSON.stringify(body, null, 2));

    // Verificar assinatura HMAC se o secret estiver configurado
    const melhorEnvioSecret = process.env.MELHOR_ENVIO_SECRET;
    const signature = req.headers['x-me-signature'];
    
    if (melhorEnvioSecret && signature) {
      console.log('Verificando assinatura HMAC...');
      
      // Gerar hash HMAC-SHA256
      const bodyString = JSON.stringify(body);
      const expectedSignature = crypto
        .createHmac('sha256', melhorEnvioSecret)
        .update(bodyString)
        .digest('base64');
      
      console.log('Assinatura recebida:', signature);
      console.log('Assinatura esperada:', expectedSignature);
      
      if (signature !== expectedSignature) {
        console.error('Assinatura inválida!');
        return res.status(401).json({ error: 'Assinatura inválida' });
      }
      
      console.log('✓ Assinatura válida');
    } else {
      console.log('⚠ Verificação de assinatura desabilitada (configure MELHOR_ENVIO_SECRET)');
    }

    // Processar o evento
    const { event, data } = body;
    
    if (!event || !data) {
      console.error('Formato inválido do webhook');
      return res.status(400).json({ error: 'Formato inválido' });
    }

    console.log('Evento:', event);
    console.log('ID do pedido:', data.id);
    console.log('Protocol:', data.protocol);
    console.log('Status:', data.status);
    console.log('Tracking:', data.tracking);

    // Mapear status do Melhor Envio para português
    const statusMap = {
      'created': 'Pedido criado',
      'pending': 'Aguardando pagamento',
      'released': 'Liberado para envio',
      'generated': 'Etiqueta gerada',
      'received': 'Recebido no ponto de distribuição',
      'posted': 'Postado nos Correios',
      'delivered': 'Entregue',
      'cancelled': 'Cancelado',
      'undelivered': 'Não foi possível entregar',
      'paused': 'Entrega pausada - ação necessária',
      'suspended': 'Entrega suspensa'
    };

    // Preparar dados para salvar no Firebase
    const trackingData = {
      // IDs do pedido
      melhorEnvioId: data.id,
      protocol: data.protocol,
      tracking: data.tracking || null,
      selfTracking: data.self_tracking || null,
      
      // Status e evento
      status: data.status,
      statusText: statusMap[data.status] || data.status,
      lastEvent: event,
      
      // Datas importantes
      createdAt: data.created_at || null,
      paidAt: data.paid_at || null,
      generatedAt: data.generated_at || null,
      postedAt: data.posted_at || null,
      deliveredAt: data.delivered_at || null,
      canceledAt: data.canceled_at || null,
      
      // URLs e metadados
      trackingUrl: data.tracking_url || null,
      userId: data.user_id || null,
      tags: data.tags || [],
      
      // Timestamp da atualização
      updatedAt: new Date().toISOString(),
      webhookReceivedAt: new Date().toISOString()
    };

    // Salvar no Firebase Firestore
    try {
      // Coleção: melhor_envio_tracking
      // Documento: usar o protocol como ID principal
      const docRef = db.collection('melhor_envio_tracking').doc(data.protocol);
      
      // Salvar/atualizar dados
      await docRef.set(trackingData, { merge: true });
      
      console.log('✓ Dados salvos no Firebase:', data.protocol);
      
      // Também salvar histórico de eventos
      const eventHistory = {
        event: event,
        data: data,
        timestamp: new Date().toISOString()
      };
      
      await docRef.collection('history').add(eventHistory);
      console.log('✓ Evento adicionado ao histórico');
      
      // Se tiver um código de 5 caracteres no Firebase (orderCode), também indexar por ele
      const servicesQuery = await db.collection('services')
        .where('melhorEnvioId', '==', data.id)
        .limit(1)
        .get();
      
      if (!servicesQuery.empty) {
        const serviceDoc = servicesQuery.docs[0];
        const orderCode = serviceDoc.data().orderCode;
        
        if (orderCode) {
          // Criar índice pelo orderCode também
          await db.collection('melhor_envio_tracking')
            .doc(`order_${orderCode}`)
            .set({
              ...trackingData,
              orderCode: orderCode
            }, { merge: true });
          
          console.log('✓ Indexado também por orderCode:', orderCode);
        }
      }
      
    } catch (firebaseError) {
      console.error('Erro ao salvar no Firebase:', firebaseError);
      // Não retornar erro para o Melhor Envio para evitar reenvios
    }

    // Responder sucesso para o Melhor Envio
    res.status(200).json({ 
      success: true,
      message: 'Webhook recebido com sucesso',
      event: event,
      protocol: data.protocol
    });
    
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    
    // Retornar sucesso mesmo com erro para evitar reenvios
    res.status(200).json({ 
      success: false,
      message: 'Erro interno, mas webhook recebido',
      error: error.message
    });
  }
}

/* ==================================================
CONFIGURAÇÃO DO WEBHOOK NO MELHOR ENVIO:

1. Acesse o Melhor Envio
2. Vá em: Integrações → Área Dev
3. Selecione seu aplicativo
4. Clique em "Novo Webhook"
5. Configure a URL:
   https://imaginatech-api.vercel.app/api/webhook-melhor-envio

VARIÁVEIS DE AMBIENTE NA VERCEL:

1. MELHOR_ENVIO_SECRET
   - Copie o secret do seu aplicativo no Melhor Envio
   - Usado para validar a assinatura HMAC

2. FIREBASE_ADMIN_KEY
   - JSON da service account do Firebase
   - Baixe em: Firebase Console → Configurações → Service Accounts
   - Gere uma nova chave privada
   - Cole o JSON completo como string na Vercel

EVENTOS RECEBIDOS:
- order.created: Pedido criado
- order.pending: Aguardando pagamento
- order.released: Liberado
- order.generated: Etiqueta gerada
- order.posted: Postado
- order.delivered: Entregue
- order.cancelled: Cancelado

DADOS SALVOS NO FIREBASE:
- Coleção: melhor_envio_tracking
- Documento: protocol (ORD-XXXXX)
- Subcoleção: history (histórico de eventos)
================================================== */
