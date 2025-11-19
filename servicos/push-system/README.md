# 📱 Sistema de Push Notifications - ImaginaTech

> **STATUS:** 🟡 **PREPARADO MAS NÃO IMPLEMENTADO**
>
> Este módulo contém todo o código necessário para notificações push via app Android/iOS (Capacitor).
> Atualmente está **OCIOSO** e **NÃO ESTÁ INTEGRADO** ao sistema principal.

---

## 🎯 OBJETIVO

Notificar **admins/técnicos** via push notification no app quando:

1. ✅ **Novo serviço criado** → Todos os admins são notificados
2. ✅ **Nova tarefa atribuída** → Responsáveis são notificados
3. ✅ **Tarefa transferida** → Novos responsáveis são notificados
4. ✅ **Comentário em tarefa** → Responsáveis são notificados

**NÃO tem relação com cliente** - Cliente continua recebendo apenas WhatsApp + Email.

---

## 📁 ESTRUTURA DO MÓDULO

```
servicos/push-system/
├── README.md                    ← Este arquivo (documentação completa)
├── push-notifications.js        ← Lógica cliente (frontend)
├── cloud-functions-template.js  ← Template da Cloud Function (backend)
├── integration-points.md        ← Pontos de integração no código
└── implementation-checklist.md  ← Checklist passo a passo
```

---

## ⚙️ ARQUITETURA

### **Frontend (Cliente - Já implementado)**
```
push-notifications.js
├── initPushNotifications()     → Inicializa sistema no app
├── saveTokenToFirestore()      → Salva token FCM no Firestore
├── handleNotificationReceived() → Quando app recebe notificação
├── handleNotificationAction()   → Quando usuário toca na notificação
├── sendPushToUser()            → Agenda push para 1 usuário
└── sendPushToAdmins()          → Agenda push para todos admins
```

**Fluxo Frontend:**
```javascript
// 1. App Android abre → Pede permissão de notificações
initPushNotifications()

// 2. Google retorna token FCM
saveTokenToFirestore(token) → Salva em Firestore collection 'pushTokens'

// 3. Quando criar serviço/tarefa
sendPushToAdmins(title, body, data) → Cria doc em 'pendingNotifications'
```

---

### **Backend (Cloud Function - NÃO IMPLEMENTADO)**
```
Cloud Function (Firebase Functions)
└── Ouve collection 'pendingNotifications'
    └── Quando novo documento criado:
        1. Lê token FCM do documento
        2. Envia via Firebase Cloud Messaging (FCM)
        3. Marca como 'sent' ou deleta documento
```

**Fluxo Backend (FALTA IMPLEMENTAR):**
```javascript
// Cloud Function escuta Firestore
exports.sendPushNotification = functions.firestore
    .document('pendingNotifications/{notificationId}')
    .onCreate(async (snap, context) => {
        const notif = snap.data();

        // Envia via FCM
        await admin.messaging().send({
            token: notif.token,
            notification: notif.notification,
            data: notif.data
        });

        // Deleta documento processado
        await snap.ref.delete();
    });
```

---

## 🔧 COLEÇÕES FIRESTORE

### **1. `pushTokens` (Tokens dos dispositivos)**
```javascript
pushTokens/{userId}
├── token: "fcm_token_aqui..."           // Token FCM do dispositivo
├── userId: "firebase_uid"                // UID do usuário
├── userEmail: "admin@email.com"          // Email para debug
├── platform: "android"                   // android | ios
├── deviceInfo: {
│   ├── userAgent: "..."
│   └── timestamp: "2025-01-18..."
│   }
├── createdAt: "2025-01-18..."
└── updatedAt: "2025-01-18..."
```

### **2. `pendingNotifications` (Fila de notificações)**
```javascript
pendingNotifications/{notificationId}
├── token: "fcm_token_aqui..."           // Token FCM do destinatário
├── userId: "firebase_uid"                // UID do destinatário
├── notification: {
│   ├── title: "Novo Serviço Criado"
│   └── body: "Pedido #ABC123 - Cliente João"
│   }
├── data: {                               // Dados customizados (abrir tela específica)
│   ├── serviceId: "doc_id"               // ID do serviço (opcional)
│   ├── taskId: "doc_id"                  // ID da tarefa (opcional)
│   └── filterStatus: "pendente"          // Filtro a aplicar (opcional)
│   }
├── status: "pending"                     // pending | sent | failed
└── createdAt: "2025-01-18..."
```

---

## 🚀 IMPLEMENTAÇÃO FUTURA

### **FASE 1: Configurar Firebase (Primeiro passo)**

#### **1.1. Ativar Firebase Cloud Messaging**
```bash
# No Console do Firebase:
1. Ir em Project Settings
2. Cloud Messaging
3. Copiar "Server Key" (vai precisar depois)
```

#### **1.2. Upgrade Firebase para Plano Blaze**
```
⚠️ Cloud Functions só funciona no plano PAGO (Blaze)
- Preço: Pay-as-you-go
- Custo estimado: ~$0.50/mês (uso baixo)
```

#### **1.3. Instalar Firebase CLI**
```bash
npm install -g firebase-tools
firebase login
firebase init functions
```

---

### **FASE 2: Criar App Capacitor (Android/iOS)**

#### **2.1. Instalar Capacitor**
```bash
cd imaginatech-website
npm install @capacitor/core @capacitor/cli
npx cap init
```

#### **2.2. Adicionar plataformas**
```bash
# Android
npm install @capacitor/android
npx cap add android

# iOS (opcional)
npm install @capacitor/ios
npx cap add ios
```

#### **2.3. Instalar plugin de Push Notifications**
```bash
npm install @capacitor/push-notifications
npx cap sync
```

#### **2.4. Configurar google-services.json**
```bash
# Baixar google-services.json do Firebase Console
# Copiar para: android/app/google-services.json
```

---

### **FASE 3: Implementar Cloud Function**

#### **3.1. Criar arquivo functions/index.js**
Ver template em: `cloud-functions-template.js`

#### **3.2. Deploy da Cloud Function**
```bash
cd functions
npm install firebase-admin firebase-functions
firebase deploy --only functions
```

---

### **FASE 4: Integrar no Código**

Ver arquivo: `integration-points.md`

Resumo dos pontos de integração:

**1. `servicos/js/main.js` (linha 27, 68-73)**
- Descomentar import e inicialização

**2. `servicos/js/services.js`**
- Adicionar `sendPushToAdmins()` após criar serviço (linha ~270)

**3. `servicos/js/tasks.js`**
- Adicionar `sendPushToUser()` após criar tarefa (linha ~1296)
- Adicionar `sendPushToUser()` após transferir tarefa (linha ~1047)
- Adicionar `sendPushToUser()` após adicionar comentário (linha ~957)

**4. Atualizar path do import**
```javascript
// ANTES:
import { initPushNotifications } from './push-notifications.js';

// DEPOIS:
import { initPushNotifications } from '../push-system/push-notifications.js';
```

---

### **FASE 5: Testar**

#### **5.1. Gerar APK**
```bash
npx cap open android
# Android Studio → Build → Generate Signed Bundle/APK
```

#### **5.2. Instalar no celular e testar**
```bash
# Instalar APK
# Fazer login com conta admin
# Criar serviço no painel web
# ✅ Deve receber push notification no celular!
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

Ver arquivo: `implementation-checklist.md`

---

## 🔍 DEBUG

### **Ver tokens salvos (Firestore Console)**
```
Firebase Console → Firestore Database → pushTokens
```

### **Ver notificações pendentes**
```
Firebase Console → Firestore Database → pendingNotifications
```

### **Logs da Cloud Function**
```bash
firebase functions:log
# ou no Firebase Console → Functions → Logs
```

---

## 💡 DICAS

### **Testar envio manual via Firebase Console**
```
Firebase Console → Cloud Messaging → Send test message
Copiar token de pushTokens/{userId} → Colar no campo Token
```

### **Notificações em Background vs Foreground**

- **Foreground (app aberto):** `handleNotificationReceived()` é chamado
- **Background (app fechado):** Sistema operacional mostra notificação
- **Usuário toca:** `handleNotificationAction()` é chamado

---

## ⚠️ LIMITAÇÕES ATUAIS

1. ❌ Cloud Function não existe (backend)
2. ❌ Não está integrado nos eventos (criar serviço, criar tarefa, etc)
3. ❌ App Android/iOS não foi criado
4. ❌ Google services não configurados
5. ✅ Código frontend pronto e funcional

---

## 📞 SUPORTE

Quando for implementar, peça ajuda ao Claude com:
- Link deste README
- Mensagem: "Quero implementar o sistema de push notifications que está em /servicos/push-system/"

---

**Última atualização:** 18/01/2025
**Status:** Preparado mas não implementado
**Autor:** Claude Code
