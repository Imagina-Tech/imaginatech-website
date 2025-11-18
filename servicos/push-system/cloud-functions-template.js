/* ==================================================
ARQUIVO: cloud-functions-template.js
MÓDULO: Template de Cloud Functions para Push Notifications
SISTEMA: ImaginaTech - Gestão de Impressão 3D
STATUS: 🟡 TEMPLATE - NÃO IMPLEMENTADO

INSTRUÇÕES:
1. Criar pasta /functions na raiz do projeto
2. Executar: firebase init functions
3. Copiar este código para functions/index.js
4. Executar: npm install no diretório /functions
5. Deploy: firebase deploy --only functions
==================================================*/

const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Inicializar Firebase Admin
admin.initializeApp();

// ===========================
// FUNÇÃO PRINCIPAL
// ===========================

/**
 * Envia notificações push quando um documento é criado em pendingNotifications
 *
 * Trigger: Firestore onCreate em collection pendingNotifications
 *
 * Estrutura do documento esperado:
 * {
 *   token: "fcm_token_here...",
 *   userId: "firebase_uid",
 *   notification: {
 *     title: "Título da notificação",
 *     body: "Corpo da mensagem"
 *   },
 *   data: {
 *     serviceId: "optional_service_id",
 *     taskId: "optional_task_id",
 *     filterStatus: "optional_filter"
 *   },
 *   status: "pending",
 *   createdAt: "2025-01-18T..."
 * }
 */
exports.sendPushNotification = functions.firestore
    .document('pendingNotifications/{notificationId}')
    .onCreate(async (snap, context) => {
        const notificationId = context.params.notificationId;
        const notificationData = snap.data();

        console.log('🔔 Nova notificação detectada:', notificationId);
        console.log('📝 Dados:', notificationData);

        // Validar dados
        if (!notificationData.token) {
            console.error('❌ Token FCM não encontrado no documento');
            await snap.ref.update({ status: 'failed', error: 'Token não encontrado' });
            return null;
        }

        if (!notificationData.notification) {
            console.error('❌ Objeto notification não encontrado');
            await snap.ref.update({ status: 'failed', error: 'Notification não encontrado' });
            return null;
        }

        // Preparar mensagem FCM
        const message = {
            token: notificationData.token,
            notification: {
                title: notificationData.notification.title || 'ImaginaTech',
                body: notificationData.notification.body || 'Nova notificação'
            },
            data: notificationData.data || {},
            // Configurações Android
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    channelId: 'imaginatech_notifications',
                    priority: 'high',
                    defaultVibrateTimings: true
                }
            },
            // Configurações iOS
            apns: {
                payload: {
                    aps: {
                        sound: 'default',
                        badge: 1
                    }
                }
            }
        };

        try {
            // Enviar via Firebase Cloud Messaging
            const response = await admin.messaging().send(message);

            console.log('✅ Notificação enviada com sucesso:', response);

            // Atualizar status ou deletar documento
            await snap.ref.update({
                status: 'sent',
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                fcmResponse: response
            });

            // Opcional: Deletar documento após envio (manter Firestore limpo)
            // await snap.ref.delete();

            return response;

        } catch (error) {
            console.error('❌ Erro ao enviar notificação:', error);

            // Salvar erro no documento
            await snap.ref.update({
                status: 'failed',
                error: error.message,
                errorCode: error.code,
                failedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return null;
        }
    });

// ===========================
// FUNÇÃO AUXILIAR: Limpar notificações antigas
// ===========================

/**
 * Limpa notificações processadas com mais de 7 dias
 *
 * Executar manualmente ou agendar via Cloud Scheduler:
 * firebase functions:config:set scheduler.enabled=true
 */
exports.cleanupOldNotifications = functions.pubsub
    .schedule('every 24 hours')
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
        console.log('🧹 Limpando notificações antigas...');

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const snapshot = await admin.firestore()
            .collection('pendingNotifications')
            .where('status', '==', 'sent')
            .where('sentAt', '<', sevenDaysAgo)
            .get();

        const batch = admin.firestore().batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        console.log(`✅ ${snapshot.size} notificações antigas removidas`);
        return null;
    });

// ===========================
// FUNÇÃO AUXILIAR: Limpar tokens inválidos
// ===========================

/**
 * Remove tokens FCM que falharam repetidamente
 *
 * Útil para manter collection pushTokens limpa
 */
exports.cleanupInvalidTokens = functions.pubsub
    .schedule('every 7 days')
    .timeZone('America/Sao_Paulo')
    .onRun(async (context) => {
        console.log('🧹 Limpando tokens inválidos...');

        // Buscar notificações que falharam por token inválido
        const failedNotifications = await admin.firestore()
            .collection('pendingNotifications')
            .where('status', '==', 'failed')
            .where('errorCode', '==', 'messaging/registration-token-not-registered')
            .get();

        const tokensToRemove = new Set();
        failedNotifications.docs.forEach(doc => {
            tokensToRemove.add(doc.data().token);
        });

        // Remover tokens inválidos
        const pushTokensSnapshot = await admin.firestore()
            .collection('pushTokens')
            .get();

        const batch = admin.firestore().batch();
        let removedCount = 0;

        pushTokensSnapshot.docs.forEach(doc => {
            if (tokensToRemove.has(doc.data().token)) {
                batch.delete(doc.ref);
                removedCount++;
            }
        });

        await batch.commit();

        console.log(`✅ ${removedCount} tokens inválidos removidos`);
        return null;
    });

// ===========================
// LOGS E MONITORAMENTO
// ===========================

/**
 * Ver logs:
 * firebase functions:log
 *
 * Ou no Firebase Console:
 * Functions → Logs
 */
