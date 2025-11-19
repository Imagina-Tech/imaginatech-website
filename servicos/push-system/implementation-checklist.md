# ✅ Checklist de Implementação - Push Notifications

> **INSTRUÇÕES:**
> Siga este checklist passo a passo quando for implementar o sistema.
> Marque cada item com [x] conforme for completando.

---

## 📋 FASE 1: Preparação Firebase

### 1.1. Configurar Firebase Console
- [ ] Acessar Firebase Console (https://console.firebase.google.com)
- [ ] Selecionar projeto ImaginaTech
- [ ] Ir em **Project Settings** (engrenagem)
- [ ] Aba **Cloud Messaging**
- [ ] Copiar **Server Key** (guardar em local seguro)
- [ ] Copiar **Sender ID** (guardar em local seguro)

### 1.2. Upgrade para Plano Blaze
- [ ] Ir em **Upgrade Plan**
- [ ] Selecionar **Blaze (Pay as you go)**
- [ ] Configurar billing (cadastrar cartão)
- [ ] ⚠️ **IMPORTANTE:** Configurar alertas de custo (máximo $5/mês)

### 1.3. Ativar Firebase Cloud Messaging
- [ ] Verificar se FCM está habilitado
- [ ] Criar notification channel (se necessário)

**Tempo estimado:** 15 minutos

---

## 📋 FASE 2: Configurar Firebase Functions

### 2.1. Instalar Firebase CLI
```bash
npm install -g firebase-tools
```
- [ ] Firebase CLI instalado
- [ ] Executar: `firebase --version` (confirmar instalação)

### 2.2. Login no Firebase
```bash
firebase login
```
- [ ] Login realizado com conta correta
- [ ] Permissões de admin no projeto

### 2.3. Inicializar Functions
```bash
cd C:\Users\Trindade\Desktop\imaginatech-website
firebase init functions
```
**Respostas para o wizard:**
- Use existing project → **Selecionar projeto ImaginaTech**
- Language → **JavaScript**
- ESLint → **Yes**
- Install dependencies → **Yes**

- [ ] Pasta `/functions` criada
- [ ] `functions/index.js` criado
- [ ] `functions/package.json` criado

### 2.4. Copiar código da Cloud Function
```bash
# Copiar conteúdo de servicos/push-system/cloud-functions-template.js
# para functions/index.js
```
- [ ] Código copiado para `functions/index.js`
- [ ] Verificar que todas as funções estão presentes

### 2.5. Instalar dependências
```bash
cd functions
npm install firebase-admin firebase-functions
```
- [ ] firebase-admin instalado
- [ ] firebase-functions instalado
- [ ] node_modules criado

### 2.6. Deploy das Functions
```bash
firebase deploy --only functions
```
- [ ] Deploy bem-sucedido
- [ ] Ver functions no Firebase Console → Functions
- [ ] Confirmar que `sendPushNotification` aparece

**Tempo estimado:** 20 minutos

---

## 📋 FASE 3: Criar App Capacitor (Android)

### 3.1. Instalar Capacitor
```bash
cd C:\Users\Trindade\Desktop\imaginatech-website
npm install @capacitor/core @capacitor/cli
```
- [ ] @capacitor/core instalado
- [ ] @capacitor/cli instalado

### 3.2. Inicializar Capacitor
```bash
npx cap init
```
**Respostas:**
- App name → **ImaginaTech**
- App ID → **br.com.imaginatech.app**
- Web directory → **servicos** (pasta do painel)

- [ ] `capacitor.config.json` criado
- [ ] Configurações verificadas

### 3.3. Adicionar plataforma Android
```bash
npm install @capacitor/android
npx cap add android
```
- [ ] Pasta `/android` criada
- [ ] Android Studio pode abrir o projeto

### 3.4. Instalar plugin Push Notifications
```bash
npm install @capacitor/push-notifications
npx cap sync
```
- [ ] @capacitor/push-notifications instalado
- [ ] Plugin sincronizado com Android

### 3.5. Configurar google-services.json
```bash
# 1. Baixar google-services.json do Firebase Console:
#    Project Settings → Your apps → Android app → google-services.json
# 2. Copiar para: android/app/google-services.json
```
- [ ] google-services.json baixado
- [ ] Arquivo copiado para `android/app/`
- [ ] Verificar que package name está correto (br.com.imaginatech.app)

### 3.6. Configurar AndroidManifest.xml
Adicionar em `android/app/src/main/AndroidManifest.xml`:
```xml
<meta-data
    android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="imaginatech_notifications" />
```
- [ ] Meta-data adicionado ao AndroidManifest.xml

**Tempo estimado:** 30 minutos

---

## 📋 FASE 4: Integrar Código no Sistema

### 4.1. Atualizar main.js
- [ ] Abrir `servicos/js/main.js`
- [ ] Descomentar linha 27 (import)
- [ ] Corrigir path: `../push-system/push-notifications.js`
- [ ] Descomentar linhas 68-73 (inicialização)
- [ ] Salvar arquivo

### 4.2. Integrar em services.js
- [ ] Abrir `servicos/js/services.js`
- [ ] Localizar linha ~277 (após sendWhatsAppMessage)
- [ ] Adicionar código de push (ver integration-points.md - PONTO 2)
- [ ] Salvar arquivo

### 4.3. Integrar em tasks.js - Criar Tarefa
- [ ] Abrir `servicos/js/tasks.js`
- [ ] Localizar linha ~1296 (após criar tarefa)
- [ ] Adicionar código de push (ver integration-points.md - PONTO 3)
- [ ] Salvar arquivo

### 4.4. Integrar em tasks.js - Transferir Tarefa
- [ ] Localizar linha ~1047 (após transferir)
- [ ] Adicionar código de push (ver integration-points.md - PONTO 4)
- [ ] Salvar arquivo

### 4.5. Integrar em tasks.js - Comentário
- [ ] Localizar linha ~957 (após comentário)
- [ ] Adicionar código de push (ver integration-points.md - PONTO 5)
- [ ] Salvar arquivo

**Tempo estimado:** 20 minutos

---

## 📋 FASE 5: Gerar APK e Testar

### 5.1. Build do projeto web
```bash
# Se necessário, fazer build do código web
# (Capacitor usa os arquivos da pasta servicos/)
```
- [ ] Arquivos atualizados em servicos/

### 5.2. Sincronizar com Capacitor
```bash
npx cap sync android
```
- [ ] Arquivos copiados para pasta android/
- [ ] Plugins sincronizados

### 5.3. Abrir no Android Studio
```bash
npx cap open android
```
- [ ] Android Studio aberto
- [ ] Projeto carregado sem erros
- [ ] Gradle sync completo

### 5.4. Gerar APK
No Android Studio:
1. Build → Generate Signed Bundle/APK
2. APK → Next
3. Criar keystore (primeira vez) ou usar existente
4. Release → Finish

- [ ] APK gerado em `android/app/release/app-release.apk`
- [ ] Keystore salvo (IMPORTANTE: guardar em local seguro!)

### 5.5. Instalar APK no celular
```bash
# Transferir APK para celular
# Instalar (pode precisar habilitar "Fontes desconhecidas")
```
- [ ] APK instalado no celular
- [ ] App abre sem erros
- [ ] Login funciona

**Tempo estimado:** 30 minutos

---

## 📋 FASE 6: Testes Funcionais

### 6.1. Teste: Registro de Token
- [ ] Abrir app no celular
- [ ] Fazer login com conta admin
- [ ] Permitir notificações quando solicitado
- [ ] Verificar no Firestore Console se token foi salvo:
  - Collection: `pushTokens`
  - Documento com seu userId
  - Campo `token` preenchido

### 6.2. Teste: Novo Serviço
- [ ] Com app aberto no celular
- [ ] No PC, criar novo serviço no painel
- [ ] ✅ Deve receber notificação no celular
- [ ] Tocar na notificação → app deve abrir

### 6.3. Teste: Nova Tarefa
- [ ] Com app aberto no celular
- [ ] No PC, criar nova tarefa atribuída a você
- [ ] ✅ Deve receber notificação no celular
- [ ] Tocar na notificação → app deve abrir tarefa

### 6.4. Teste: Background
- [ ] **Fechar app** no celular (não minimizar, FECHAR)
- [ ] No PC, criar novo serviço
- [ ] ✅ Deve receber notificação na bandeja do celular
- [ ] Tocar → app deve abrir

### 6.5. Verificar Firestore
- [ ] Ir no Firestore Console
- [ ] Collection `pendingNotifications`
- [ ] Verificar que documentos são criados
- [ ] Verificar que status muda para "sent" após envio
- [ ] Verificar campo `sentAt` preenchido

### 6.6. Verificar Logs da Cloud Function
```bash
firebase functions:log
```
- [ ] Ver logs de sucesso: "✅ Notificação enviada"
- [ ] Não ter erros críticos

**Tempo estimado:** 20 minutos

---

## 📋 FASE 7: Ajustes Finais

### 7.1. Configurar ícone do app
- [ ] Criar ícone 1024x1024 (Android adaptive icon)
- [ ] Usar ferramenta: https://icon.kitchen/
- [ ] Substituir ícones em `android/app/src/main/res/`

### 7.2. Configurar nome do app
- [ ] Editar `android/app/src/main/res/values/strings.xml`
- [ ] Mudar `<string name="app_name">` para "ImaginaTech"

### 7.3. Configurar splash screen (opcional)
- [ ] Instalar: `npm install @capacitor/splash-screen`
- [ ] Configurar imagem de splash

### 7.4. Testar em múltiplos dispositivos
- [ ] Testar em Android 8+
- [ ] Testar em Android 12+
- [ ] Verificar diferentes tamanhos de tela

### 7.5. Otimizações
- [ ] Configurar canal de notificação personalizado
- [ ] Ajustar ícone da notificação
- [ ] Configurar som personalizado (opcional)

**Tempo estimado:** 30 minutos

---

## 🎉 CONCLUSÃO

- [ ] Sistema totalmente funcional
- [ ] Testes aprovados
- [ ] Documentação atualizada
- [ ] APK distribuído para equipe

---

## 📞 SUPORTE

Se tiver problemas:

1. **Verificar logs:**
   ```bash
   firebase functions:log
   ```

2. **Debug no Android:**
   ```bash
   npx cap run android
   # Depois ver logcat no Android Studio
   ```

3. **Testar envio manual:**
   - Firebase Console → Cloud Messaging
   - Send test message
   - Usar token de pushTokens/{userId}

4. **Pedir ajuda ao Claude:**
   - "Erro ao implementar push notifications"
   - Enviar logs completos
   - Mencionar qual FASE está

---

## ⏱️ TEMPO TOTAL ESTIMADO

- **FASE 1:** 15 min
- **FASE 2:** 20 min
- **FASE 3:** 30 min
- **FASE 4:** 20 min
- **FASE 5:** 30 min
- **FASE 6:** 20 min
- **FASE 7:** 30 min

**TOTAL: ~2h30min** (primeira implementação)

---

**Última atualização:** 18/01/2025
**Status:** Checklist completo e pronto para usar
