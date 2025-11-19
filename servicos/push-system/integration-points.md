# 🔗 Pontos de Integração - Push Notifications

> **INSTRUÇÕES PARA O FUTURO:**
> Este arquivo mapeia EXATAMENTE onde adicionar código para integrar push notifications.
> Copie e cole os snippets nos locais indicados.

---

## 📍 PONTO 1: Inicialização (main.js)

**Arquivo:** `servicos/js/main.js`

**Linhas 27 e 68-73**

### ✅ O que fazer:

1. **Descomentar o import** (linha 27)
2. **Descomentar a inicialização** (linhas 68-73)
3. **Atualizar o path** do import

### 📝 Código atual (COMENTADO):

```javascript
// LINHA 27 - Import está comentado
// import { initPushNotifications } from './push-notifications.js';

// LINHAS 68-73 - Inicialização está comentada
// if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
//     initPushNotifications();
// } else {
//     console.log('📱 Push notifications: disponível apenas no app');
// }
```

### ✅ Código para usar (DESCOMENTAR e CORRIGIR path):

```javascript
// LINHA 27 - Descomentar e corrigir path
import { initPushNotifications } from '../push-system/push-notifications.js';

// LINHAS 68-73 - Descomentar
if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
    initPushNotifications();
} else {
    console.log('📱 Push notifications: disponível apenas no app');
}
```

---

## 📍 PONTO 2: Criar Serviço (services.js)

**Arquivo:** `servicos/js/services.js`

**Linha ~270** (após criar serviço no Firestore)

### 🎯 Objetivo:
Notificar **todos os admins** quando um novo serviço é criado.

### 📝 Código atual:

```javascript
// LINHA ~263-270
const docRef = await state.db.collection('services').add(service);

const sendWhatsapp = document.getElementById('sendWhatsappOnCreate')?.checked || false;
const sendEmail = document.getElementById('sendEmailOnCreate')?.checked || false;

if (service.clientPhone && sendWhatsapp) {
    const dueDateText = service.dateUndefined ? 'A definir' : formatDateBrazil(service.dueDate);
    const message = `Olá, ${service.client}!...`;
    sendWhatsAppMessage(service.clientPhone, message);
}
```

### ✅ Adicionar APÓS linha ~277 (depois do sendWhatsAppMessage):

```javascript
// 🔔 PUSH NOTIFICATION: Notificar todos admins sobre novo serviço
if (typeof window.sendPushToAdmins === 'function') {
    await window.sendPushToAdmins(
        'Novo Serviço Criado',
        `${service.client} - ${service.name} (#${service.orderCode})`,
        {
            serviceId: docRef.id,
            filterStatus: 'pendente',
            type: 'new_service'
        }
    );
    console.log('✅ Push notification enviada para admins');
}
```

---

## 📍 PONTO 3: Criar Tarefa (tasks.js)

**Arquivo:** `servicos/js/tasks.js`

**Linha ~1296** (após criar tarefa no Firestore)

### 🎯 Objetivo:
Notificar **responsáveis** quando uma nova tarefa é atribuída.

### 📝 Código atual:

```javascript
// LINHA ~1296-1299
await state.db.collection('tasks').add(taskData);

showToast('✓ Tarefa criada com sucesso!', 'success');
closeTaskModal();
```

### ✅ Adicionar ANTES do showToast (linha ~1297):

```javascript
// 🔔 PUSH NOTIFICATION: Notificar responsáveis sobre nova tarefa
const docRef = await state.db.collection('tasks').add(taskData);

// Notificar cada responsável
if (typeof window.sendPushToUser === 'function') {
    for (const assigneeEmail of taskData.assignedTo) {
        // Buscar UID do admin pelo email
        const usersSnapshot = await state.db.collection('pushTokens')
            .where('userEmail', '==', assigneeEmail)
            .limit(1)
            .get();

        if (!usersSnapshot.empty) {
            const userId = usersSnapshot.docs[0].data().userId;

            await window.sendPushToUser(
                userId,
                'Nova Tarefa Atribuída',
                `${taskData.title} - Prazo: ${new Date(taskData.dueDate).toLocaleDateString('pt-BR')}`,
                {
                    taskId: docRef.id,
                    type: 'new_task',
                    priority: taskData.priority
                }
            );
        }
    }
    console.log('✅ Push notifications enviadas para responsáveis');
}

showToast('✓ Tarefa criada com sucesso!', 'success');
closeTaskModal();
```

---

## 📍 PONTO 4: Transferir Tarefa (tasks.js)

**Arquivo:** `servicos/js/tasks.js`

**Linha ~1047** (após transferir tarefa)

### 🎯 Objetivo:
Notificar **novos responsáveis** quando tarefa é transferida.

### 📝 Código atual:

```javascript
// LINHA ~1040-1049
await state.db.collection('tasks').doc(taskId).update({
    assignedTo: newAssignedTo,
    status: 'transferida',
    updatedAt: new Date().toISOString()
});

// Voltar para pendente imediatamente
await state.db.collection('tasks').doc(taskId).update({
    status: 'pendente'
});
```

### ✅ Adicionar ANTES do showToast (linha ~1051):

```javascript
// 🔔 PUSH NOTIFICATION: Notificar novos responsáveis
const task = tasksState.tasks.find(t => t.id === taskId);
if (typeof window.sendPushToUser === 'function' && task) {
    for (const assigneeEmail of newAssignedTo) {
        // Buscar UID do admin pelo email
        const usersSnapshot = await state.db.collection('pushTokens')
            .where('userEmail', '==', assigneeEmail)
            .limit(1)
            .get();

        if (!usersSnapshot.empty) {
            const userId = usersSnapshot.docs[0].data().userId;

            await window.sendPushToUser(
                userId,
                'Tarefa Transferida para Você',
                `${task.title} - ${task.category}`,
                {
                    taskId: taskId,
                    type: 'task_transferred',
                    priority: task.priority
                }
            );
        }
    }
    console.log('✅ Push notifications enviadas para novos responsáveis');
}

showToast('✓ Tarefa transferida!', 'success');
```

---

## 📍 PONTO 5: Adicionar Comentário (tasks.js)

**Arquivo:** `servicos/js/tasks.js`

**Linha ~957** (após adicionar comentário)

### 🎯 Objetivo:
Notificar **responsáveis** quando há novo comentário (exceto quem comentou).

### 📝 Código atual:

```javascript
// LINHA ~957-960
await state.db.collection('tasks').doc(taskId).update({
    comments,
    updatedAt: new Date().toISOString()
});

input.value = '';
showToast('✓ Comentário adicionado', 'success');
```

### ✅ Adicionar ANTES do input.value = '' (linha ~962):

```javascript
// 🔔 PUSH NOTIFICATION: Notificar responsáveis sobre novo comentário
const task = tasksState.tasks.find(t => t.id === taskId);
if (typeof window.sendPushToUser === 'function' && task) {
    for (const assigneeEmail of task.assignedTo) {
        // Não notificar quem fez o comentário
        if (assigneeEmail === tasksState.currentUser.email) continue;

        // Buscar UID do admin pelo email
        const usersSnapshot = await state.db.collection('pushTokens')
            .where('userEmail', '==', assigneeEmail)
            .limit(1)
            .get();

        if (!usersSnapshot.empty) {
            const userId = usersSnapshot.docs[0].data().userId;

            await window.sendPushToUser(
                userId,
                'Novo Comentário',
                `${task.title}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`,
                {
                    taskId: taskId,
                    type: 'new_comment'
                }
            );
        }
    }
    console.log('✅ Push notifications enviadas sobre comentário');
}

input.value = '';
showToast('✓ Comentário adicionado', 'success');
```

---

## 📍 PONTO 6: Imports Necessários

### Em `services.js` - Adicionar no topo (após imports existentes):

```javascript
// Push Notifications (apenas se Capacitor estiver disponível)
// Funções exportadas globalmente via window em push-notifications.js
// window.sendPushToAdmins(title, body, data)
```

### Em `tasks.js` - Adicionar no topo (após imports existentes):

```javascript
// Push Notifications (apenas se Capacitor estiver disponível)
// Funções exportadas globalmente via window em push-notifications.js
// window.sendPushToUser(userId, title, body, data)
```

---

## 🧪 TESTES

Após implementar, testar:

### ✅ Teste 1: Novo Serviço
1. Abrir app Android com login feito
2. Criar serviço no painel web
3. Verificar push notification no celular

### ✅ Teste 2: Nova Tarefa
1. Abrir app Android com login feito
2. Criar tarefa atribuída a você
3. Verificar push notification no celular

### ✅ Teste 3: Transferir Tarefa
1. Abrir app Android com login feito
2. Transferir tarefa para você
3. Verificar push notification no celular

### ✅ Teste 4: Comentário
1. Abrir app Android com login feito
2. Outro admin comenta em tarefa atribuída a você
3. Verificar push notification no celular

---

## 🐛 DEBUG

### Ver se funções estão disponíveis:
```javascript
console.log('sendPushToAdmins:', typeof window.sendPushToAdmins);
console.log('sendPushToUser:', typeof window.sendPushToUser);
```

### Ver tokens salvos:
```javascript
const tokens = await state.db.collection('pushTokens').get();
tokens.forEach(doc => console.log(doc.data()));
```

### Ver notificações pendentes:
```javascript
const pending = await state.db.collection('pendingNotifications').get();
pending.forEach(doc => console.log(doc.data()));
```

---

**Última atualização:** 18/01/2025
**Status:** Mapeamento completo - Pronto para integrar
