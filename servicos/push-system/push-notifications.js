/*
==================================================
ARQUIVO: servicos/push-system/push-notifications.js
MÓDULO: Notificações Push (Capacitor + Firebase)
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 1.0 - PREPARADO MAS NÃO IMPLEMENTADO
STATUS: 🟡 OCIOSO - Aguardando implementação

OBJETIVO:
    Notificar admins/técnicos via push notification quando:
    - Novo serviço criado
    - Nova tarefa atribuída
    - Tarefa transferida
    - Novo comentário em tarefa

IMPORTANTE:
    Este módulo está PREPARADO mas NÃO INTEGRADO ao sistema.
    Para implementar, siga as instruções em:
    → /servicos/push-system/README.md (documentação completa)
    → /servicos/push-system/integration-points.md (pontos de integração)
    → /servicos/push-system/implementation-checklist.md (checklist)

PRÉ-REQUISITOS:
    1. Firebase Functions configurado (Cloud Function)
    2. App Capacitor criado (Android/iOS)
    3. google-services.json configurado
    4. Código integrado nos pontos corretos

==================================================
*/

import { state } from '../js/config.js';
import { showToast } from '../js/auth-ui.js';

// Verifica se está rodando em um app nativo (Capacitor)
const isNativeApp = () => {
    return typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
};

// ===========================
// INICIALIZAÇÃO
// ===========================
export async function initPushNotifications() {
    // Só funciona em app nativo
    if (!isNativeApp()) {
        console.log('📱 Push notifications: disponível apenas no app Android');
        return;
    }

    console.log('🔔 Inicializando push notifications...');

    try {
        // Importar o plugin dinamicamente
        const { PushNotifications } = await import('@capacitor/push-notifications');

        // Verificar permissões
        let permStatus = await PushNotifications.checkPermissions();
        
        if (permStatus.receive === 'prompt') {
            // Solicitar permissão ao usuário
            permStatus = await PushNotifications.requestPermissions();
        }
        
        if (permStatus.receive !== 'granted') {
            console.warn('⚠️ Permissão de notificação negada pelo usuário');
            showToast('Notificações desativadas. Ative nas configurações do app.', 'warning');
            return;
        }

        // Registrar para receber notificações
        await PushNotifications.register();
        console.log('✅ Push notifications registradas com sucesso');

        // ===========================
        // LISTENERS
        // ===========================

        // Listener: quando receber o token de registro
        PushNotifications.addListener('registration', (token) => {
            console.log('📝 Token de push recebido:', token.value);
            saveTokenToFirestore(token.value);
        });

        // Listener: quando houver erro no registro
        PushNotifications.addListener('registrationError', (error) => {
            console.error('❌ Erro ao registrar push notifications:', error);
        });

        // Listener: quando receber uma notificação (app aberto)
        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('🔔 Notificação recebida:', notification);
            handleNotificationReceived(notification);
        });

        // Listener: quando o usuário tocar na notificação
        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            console.log('👆 Usuário tocou na notificação:', notification.notification);
            handleNotificationAction(notification.notification);
        });

        showToast('✅ Notificações ativadas!', 'success');

    } catch (error) {
        console.error('❌ Erro ao inicializar push notifications:', error);
        showToast('Erro ao ativar notificações', 'error');
    }
}

// ===========================
// SALVAR TOKEN NO FIRESTORE
// ===========================
async function saveTokenToFirestore(token) {
    if (!state.db || !state.currentUser) {
        console.warn('⚠️ Firebase ou usuário não disponível para salvar token');
        return;
    }

    try {
        const userId = state.currentUser.uid;
        const userEmail = state.currentUser.email;

        await state.db.collection('pushTokens').doc(userId).set({
            token: token,
            userId: userId,
            userEmail: userEmail,
            platform: 'android',
            deviceInfo: {
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }, { merge: true });

        console.log('✅ Token salvo no Firestore para:', userEmail);

    } catch (error) {
        console.error('❌ Erro ao salvar token no Firestore:', error);
    }
}

// ===========================
// HANDLERS DE NOTIFICAÇÕES
// ===========================

// Quando receber notificação com app aberto
function handleNotificationReceived(notification) {
    const title = notification.title || 'Nova notificação';
    const body = notification.body || '';
    
    // Exibir toast usando o sistema existente
    if (window.showToast) {
        showToast(`🔔 ${title}: ${body}`, 'info');
    }

    // Reproduzir som de notificação (opcional)
    playNotificationSound();

    // Log para debug
    console.log('📬 Notificação recebida:', {
        title,
        body,
        data: notification.data
    });
}

// Quando usuário tocar na notificação
function handleNotificationAction(notification) {
    const data = notification.data;

    // Se a notificação tiver dados específicos, processar aqui
    if (data) {
        // Exemplo: redirecionar para um serviço específico
        if (data.serviceId) {
            redirectToService(data.serviceId);
        }
        
        // Exemplo: filtrar por status
        if (data.filterStatus) {
            filterServicesByStatus(data.filterStatus);
        }
    }

    console.log('👆 Ação de notificação processada:', notification);
}

// ===========================
// FUNÇÕES AUXILIARES
// ===========================

// Reproduzir som de notificação
function playNotificationSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSZ+zPLTgjMGHm7A7+OZRQ0QVqzn77BdGAg+ltryxXEoBSl7yvLZhzYHImjA7+WVRAwRX7Dn77FbFwk9ldjyxW8oBCd6yfHZhzYHImq/7uWXRAwSYbDn7rdZGAk+ltnywW8nBSh4yPHahzUHImy+7eSZRAsTV7Hm7bhYGAk/ltjywW8nBSh3yPDahzUHImy+7uSaRAsUVrDm7bhYFwk/ldjywW8nBSl3yPDahzYHIm2+7uSaRAsUVrDm7LdZGAg+ltjywW8nBSh4yPDaiDUGI2y+7uSaRAwUV7Dl7LdZFwk+ltjxwW8nBSh4yO/aiTUGI22+7uOaRAwUV7Dm7LdYFwo+ltfxwW8oBSh4yO/aizUGJGy+7uOaRAwTWLDm7LZZFwo9ldfxwG8oBSh4yO7aiTQGJGy77uOZRAwUV7Hm7LZZFgo9ldfxv28oBCl4x+7biTMGJWu77uOaRAwUV7Hl7LZYFQo9lNbxv24oBCp4yO7bijk');
        audio.volume = 0.3;
        audio.play().catch(err => console.log('Som de notificação desabilitado'));
    } catch (error) {
        // Ignorar erros de som
    }
}

// Redirecionar para um serviço específico
function redirectToService(serviceId) {
    // Tentar abrir o modal de edição do serviço
    if (window.openEditModal && typeof window.openEditModal === 'function') {
        setTimeout(() => {
            window.openEditModal(serviceId);
        }, 500);
    }
}

// Filtrar serviços por status
function filterServicesByStatus(status) {
    if (window.filterServices && typeof window.filterServices === 'function') {
        setTimeout(() => {
            window.filterServices(status);
        }, 500);
    }
}

// ===========================
// FUNÇÕES PARA ENVIAR NOTIFICAÇÕES
// ===========================

/**
 * Envia notificação push para um usuário específico
 * @param {string} userId - ID do usuário no Firebase
 * @param {string} title - Título da notificação
 * @param {string} body - Corpo da mensagem
 * @param {object} data - Dados adicionais (opcional)
 */
export async function sendPushToUser(userId, title, body, data = {}) {
    if (!state.db) {
        console.error('Firebase não disponível');
        return;
    }

    try {
        // Buscar token do usuário
        const tokenDoc = await state.db.collection('pushTokens').doc(userId).get();
        
        if (!tokenDoc.exists) {
            console.log('Usuário não possui token de push registrado');
            return;
        }

        const tokenData = tokenDoc.data();
        const token = tokenData.token;

        // Criar documento de notificação pendente no Firestore
        // (será processado por uma Cloud Function no backend)
        await state.db.collection('pendingNotifications').add({
            token: token,
            userId: userId,
            notification: {
                title: title,
                body: body
            },
            data: data,
            createdAt: new Date().toISOString(),
            status: 'pending'
        });

        console.log('✅ Notificação agendada para envio:', { userId, title });

    } catch (error) {
        console.error('❌ Erro ao enviar notificação:', error);
    }
}

/**
 * Envia notificação para todos os administradores
 * @param {string} title - Título da notificação
 * @param {string} body - Corpo da mensagem
 * @param {object} data - Dados adicionais (opcional)
 */
export async function sendPushToAdmins(title, body, data = {}) {
    if (!state.db) {
        console.error('Firebase não disponível');
        return;
    }

    try {
        // Buscar tokens de todos os admins
        const tokensSnapshot = await state.db.collection('pushTokens').get();
        
        const notifications = [];
        
        tokensSnapshot.forEach(doc => {
            const tokenData = doc.data();
            notifications.push({
                token: tokenData.token,
                userId: tokenData.userId,
                notification: {
                    title: title,
                    body: body
                },
                data: data,
                createdAt: new Date().toISOString(),
                status: 'pending'
            });
        });

        // Salvar todas as notificações pendentes
        const batch = state.db.batch();
        notifications.forEach(notif => {
            const docRef = state.db.collection('pendingNotifications').doc();
            batch.set(docRef, notif);
        });
        
        await batch.commit();
        
        console.log(`✅ ${notifications.length} notificações agendadas para admins`);

    } catch (error) {
        console.error('❌ Erro ao enviar notificações para admins:', error);
    }
}

// ===========================
// EXPORTAR FUNÇÕES GLOBAIS
// ===========================
window.initPushNotifications = initPushNotifications;
window.sendPushToUser = sendPushToUser;
window.sendPushToAdmins = sendPushToAdmins;
