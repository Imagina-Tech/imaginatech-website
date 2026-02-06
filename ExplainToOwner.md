# ExplainToOwner - ImaginaTech

Este documento centraliza a documentacao das modificacoes feitas no sistema.

## Arquitetura do Painel de Servicos

### Arquivos Principais
- `servicos/index.html` - HTML do painel
- `servicos/styles.css` - CSS principal
- `servicos/js/main.js` - Inicializador
- `servicos/js/config.js` - Configuracoes e Firebase
- `servicos/js/services.js` - CRUD de servicos
- `servicos/js/auth-ui.js` - Autenticacao e UI
- `servicos/js/tasks.js` - Sistema de tarefas

### Arquivos de Suporte (Novos)
- `servicos/js/logger.js` - Sistema de logging condicional
- `servicos/js/helpers.js` - DOM helpers com null safety
- `servicos/js/accessibility.js` - Focus trap e keyboard navigation
- `servicos/js/event-handlers.js` - Delegacao de eventos
- `servicos/js/globals.js` - Namespace global organizado
- `shared/z-index.css` - Sistema de z-index e utilities

---

## Historico de Modificacoes

### 2026-02-06 - Auditoria escapeHtml: Paineis Servicos, Custo e Acompanhar-Pedido

**Arquivos Modificados:**
- `servicos/js/auth-ui.js` - 10 correcoes de escapeHtml
- `servicos/js/services.js` - 5 correcoes de escapeHtml
- `servicos/js/tasks.js` - 7 correcoes de escapeHtml + 1 onclick para addEventListener
- `custo/script-custo.js` - 4 correcoes de escapeHtml + 1 onclick para addEventListener
- `acompanhar-pedido/script.js` - 1 correcao de escapeHtml

**Vulnerabilidades XSS corrigidas (dados de usuario sem escape em innerHTML):**

1. **auth-ui.js:** user.displayName e user.email na tela de acesso negado; file.name em preview de arquivos existentes; enderecos de clientes (fullName, rua, numero, complemento, bairro, cidade, estado, cep, usedInOrder); client.email, client.phone, client.googleEmail na listagem de clientes; texto de orderCode e device no historico de acessos

2. **services.js:** service.orderCode no card; service.material e formatColorName(color) no alerta de compra e info; service.trackingCode e getDeliveryMethodName no badge de entrega

3. **tasks.js:** creatorName em card e detalhes de tarefa; assignedNames nos detalhes; task.linkedOrderCode; att.url e att.name em anexos; authorName nos comentarios

4. **custo/script-custo.js:** modelName no print de orcamento; selectedMaterial.name na exibicao de resultados; f.color/f.name e c.color na exibicao de cores disponiveis

5. **acompanhar-pedido/script.js:** message no toast (showToast) - permitia injecao via mensagem

**Conversao onclick para addEventListener (2 triviais):**
- tasks.js:165 - clientsButton.onclick -> addEventListener
- custo/script-custo.js:487 - button.onclick -> addEventListener

**Nao convertidos (substituicao intencional de handler):**
- auth-ui.js:1670 - downloadBtn.onclick (reatribuido a cada imagem)
- acompanhar-pedido/script.js:1528 - confirmBtn.onclick (reatribuido a cada showModal)

---

### 2026-02-06 - Seguranca Backend: Input validation, dedup atomico e queries bounded no webhook WhatsApp

**Arquivo Modificado:** `functions/index.js`

**3 vulnerabilidades corrigidas:**

1. **Input Validation no Webhook WhatsApp** (linhas 4506-4546)
   - Adicionada validacao de payload: verifica `body.entry` como array antes de processar
   - Validacao de campos obrigatorios: `from` e `messageId` devem existir e ser strings
   - Limite de tamanho no numero de telefone (max 30 chars)
   - Sanitizacao do texto: trim, remove caracteres de controle (0x00-0x1F exceto tab/newline), limita a 5000 chars
   - Retorna 400 para payloads invalidos, mantendo 200 para payloads validos do WhatsApp

2. **Deduplicacao Atomica** (linhas 4548-4571)
   - Substituido padrao check-then-set (race condition) por `db.runTransaction()`
   - A transaction faz get+set atomicamente, eliminando janela de duplicacao
   - Se mensagem ja existe, lanca `ALREADY_PROCESSED` e retorna 200 (evita retries do Meta)
   - Erros reais de Firestore sao re-thrown para tratamento normal

3. **Queries Bounded com .limit()** (linhas 2045, 2054-2055, 3628-3631, 3674-3677, 3786-3790)
   - `transactions` (4 queries): adicionado `.limit(5000)` - colecao que mais cresce
   - `creditCardPayments`: adicionado `.limit(500)` no buildFinancialOverview
   - `cardExpenses`: adicionado `.limit(2000)` no buildFinancialOverview
   - Queries que ja tinham limit (delete_transaction, edit_transaction com `.limit(50)`) nao foram alteradas
   - Colecoes pequenas (admins, creditCards, categories) nao precisam de limit

---

### 2026-02-06 - Seguranca: Correcao de onerror inline e auditoria escapeHtml no Painel Estoque

**Arquivos Modificados:**
- `estoque/script.js` - Removidos 3 atributos onerror inline (XSS), adicionado whitelist para status CSS

**Correcoes de Seguranca:**

1. **3 onerror inline removidos (XSS):**
   - Linha ~781: `<img ... onerror="this.src='/iconwpp.jpg'">` em filament cards -> Substituido por `data-fallback="/iconwpp.jpg"` + handler via event delegation no grid (linha ~710)
   - Linha ~2165: `<img ... onerror="this.parentElement.innerHTML='<i ...>'">` em equipment cards -> Substituido por `data-fallback-type="icon"` + handler via event delegation no grid (linha ~2100)
   - Linha ~2494: `<img ... onerror="this.outerHTML='<div ...>'">` em equipment actions modal -> Substituido por `data-fallback-type="summary-icon"` + handler programatico apos innerHTML (linha ~2506)

2. **Status CSS whitelist (prevencao de injection via classe CSS):**
   - Linha ~2184: `item.status` agora passa por whitelist (`operational` ou `repair`) antes de ser usado como classe CSS

3. **Auditoria escapeHtml completa:** Todos os dados de usuario (name, brand, type, color, notes, orderCode) ja estavam escapados. Nenhuma correcao adicional necessaria.

---

### 2026-02-06 - Seguranca: Auditoria XSS e Math.random no Marketplace e Admin-Portfolio

**Arquivos Modificados:**
- `marketplace/js/marketplace-data.js` (linha 302) - Substituido Math.random() por crypto.getRandomValues
- `marketplace/js/marketplace-core.js` (linha 575) - Adicionado escapeHtml() no showToast()
- `admin-portfolio/script.js` (linhas 738, 1312, 2005, 2205) - Removido escapeHtml() de URLs de imagem (quebrava URLs com &)

**Correcoes:**
1. **Math.random() -> crypto.getRandomValues**: O ID aleatorio gerado para nomes de arquivo em uploadPhotoToStorage() agora usa crypto.getRandomValues (6 caracteres alfanumericos seguros)
2. **showToast() XSS**: Mensagens de toast no marketplace-core.js nao escapavam o parametro `message` antes de inserir no innerHTML. Adicionado escapeHtml()
3. **URLs de imagem com escapeHtml incorreto**: Em admin-portfolio/script.js, URLs de imagem do Firebase Storage estavam sendo passadas por escapeHtml(), o que converte `&` para `&amp;` e quebra a URL. Removido escapeHtml() de atributos src/data-src de imagens (URLs vem de fonte confiavel - Firebase Storage)

### 2026-02-06 - Fix: Assinaturas na fatura - filtrar por dueDay e status active

**Arquivos Modificados:** `financas/finance-data.js`, `functions/index.js`

**Problema:** Assinaturas ativas eram somadas na fatura do cartao imediatamente, sem verificar se o dia de debito (dueDay) ja havia chegado dentro do periodo da fatura. Resultado: faturas mostravam valores inflados com assinaturas que ainda nao tinham sido cobradas.

**Correcoes aplicadas:**

1. **Nova funcao `isSubscriptionDueInPeriod()`** - Verifica se o dueDay da assinatura cai dentro do periodo da fatura e se a data de cobranca ja passou (real-time) ou se esta no periodo (navegacao)
2. **5 locais corrigidos:**
   - `finance-data.js` -> `calculateCurrentBill()` - filtro de assinaturas com dueDay
   - `finance-data.js` -> `showCardBillDetails()` - filtro de assinaturas com dueDay
   - `functions/index.js` -> `buildFinancialOverview.calculateCurrentBill()` - filtro backend
   - `functions/index.js` -> `buildFinancialOverview.cardsBillDetails` - filtro backend
   - `functions/index.js` -> handler `fatura_cartao` do chatbot - filtro inline + closingDay fix
3. **Filtro `status === 'active'` adicionado** em todos os locais que faltavam
4. **Bug `closingDay + 1` corrigido** no handler `fatura_cartao` do chatbot (linhas 3681, 3687)

**Localizacao:** `finance-data.js` funcao `isSubscriptionDueInPeriod` (linhas 155-188), `functions/index.js` funcao inline em `buildFinancialOverview` (linhas 2438-2468) e handler `fatura_cartao` (linhas 3747-3777)

---

### 2026-02-06 - Fix: Painel de Financas e Bot WhatsApp - Correcao de 10 bugs de calculo

**Arquivos Modificados:** `financas/finance-data.js`, `financas/finance-ui.js`, `functions/index.js`

**Bugs corrigidos:**

1. **SAVINGS_CATEGORIES sem acentos no backend** (`functions/index.js:2002-2006`) - Backend usava strings sem acento ('Poupanca') enquanto Firestore salva com acento ('Poupanca'). Adicionado `normalizeStr()` e `isSavingsCategory()` para comparacao accent-safe.

2. **totalInstallments nunca zerava** (`finance-data.js:2528-2540`) - Parcelamentos quitados continuavam somando 1 parcela restante. Adicionada verificacao `calculatedCurrent > totalInstallments` para pular parcelamentos finalizados.

3. **Data de vencimento errada no modal da fatura** (`finance-data.js:2064-2072`) - Formula `billMonth + 2` substituida por calculo baseado em `billEndDate` e relacao entre `dueDay`/`closingDay`.

4. **cardExpenses legado ignorado no backend** (`functions/index.js:2650-2660`) - Adicionada colecao `cardExpenses` ao `calculateCurrentBill` e `cardsBillDetails` do backend para paridade com frontend.

5. **isBillPaid inconsistente ao navegar meses** (`finance-data.js:2060,2095,2430-2434` + `functions/index.js:2669`) - Mudado para usar `billEndDate.getMonth()` em vez de `billMonth` para identificacao consistente do pagamento da fatura.

6. **Gauges ignoravam gastos no credito** (`finance-ui.js:1865,1974`) - `card.transactions` (inexistente) substituido por filtragem do array global `transactions` com `paymentMethod === 'credit'`.

7. **Cash Flow contava despesa 2x** (`finance-ui.js:251`) - Adicionado filtro `paymentMethod !== 'credit'` para evitar contagem dupla de credito + pagamento de fatura.

8. **faturaAtual dead code + bug Janeiro** (`functions/index.js`) - Removido codigo morto que calculava `faturaAtual`/`gastosCredito` (nunca usado no output) e que tinha bug de `currentMonth - 1 = -1` em janeiro.

9. **t.value sem fallback** (`finance-data.js:2391-2525`) - Adicionado `|| 0` em todos os `reduce` de updateKPIs para evitar NaN se valor for null/undefined.

10. **installmentValue nao persistido** (`finance-data.js:1067`) - Adicionado `installmentValue: totalValue / totalInstallments` ao salvar parcelamento para consistencia com calculateCurrentBill.

**Commits:** 58d6706, 5e87e4a, 78528e7, f373ccd

### 2026-02-06 - Fix/Melhoria: Painel Auto-Orcamento - Correcoes de bugs e melhorias esteticas

**Arquivos Modificados:** `auto-orcamento/index.html`, `auto-orcamento/style.css`, `auto-orcamento/app.js`, `auto-orcamento/three-viewer.js`

**Bugs Corrigidos:**

1. **Ordem CSS incorreta (index.html):** CSS local carregava ANTES do shared/variables.css, causando variaveis CSS indefinidas na parse inicial. Corrigido: shared CSS agora vem primeiro, local CSS depois para overrides.

2. **Z-index hardcoded (style.css):** color-modal-overlay usava `z-index: 10000` e finish-tooltip usava `z-index: 10001`. Corrigido para usar variaveis CSS: `var(--z-modal-backdrop)` e `var(--z-tooltip)`.

3. **Submit button habilitado com cor indisponivel (app.js):** Quando nenhuma cor estava disponivel para o material, o botao "Solicitar Orcamento" continuava habilitado. Corrigido: desabilita quando cor esta vazia (exceto Resina que nao precisa de cor).

4. **Re-upload do mesmo arquivo (app.js):** Ao clicar "Trocar arquivo" e selecionar o mesmo arquivo, o browser nao disparava `change` event. Corrigido: clona o input ao inves de limpar value.

5. **Timeout sem feedback (app.js):** Quando a API de calculo atingia 30s timeout, o usuario via apenas "Erro de conexao". Corrigido: diferencia timeout de debounce e mostra mensagem especifica.

6. **STL loader sem validacao de geometria (three-viewer.js):** Diferente dos loaders OBJ/GLTF/3MF, o STL loader nao verificava se a geometria era valida/vazia. Corrigido: verifica position attribute e count.

7. **isMeshWatertight importado mas nunca usado (app.js):** A funcao existia no volume-calculator.js mas nunca era chamada. Corrigido: agora exibe aviso (toast warning) quando o modelo nao e watertight.

8. **console.warn/error em producao (app.js):** Usava console.* direto. Corrigido: adicionado logger condicional com `isDev` check.

**Melhorias Esteticas:**

1. Upload zone: borda mais visivel, hover com glow, icone com animacao de lift
2. Preview section: animacao fade-in-up ao aparecer
3. Color modal: backdrop blur, sombra lateral, animacao com easing suave
4. Color cards: hover com translateX, selecionado com borda-left azul
5. Color trigger: estado visual "unavailable" com opacity e borda vermelha
6. Desktop options panel: scrollbar customizada, espacamento menos comprimido
7. Toast: animacao de saida (slide-out), tipo "warning" com cor laranja, max-width para mobile
8. Model info: melhor espcamento horizontal entre itens

**Localizacao:** `auto-orcamento/index.html` (linhas 47-59), `auto-orcamento/style.css` (multiplas secoes), `auto-orcamento/app.js` (linhas 91-95, 147, 250, 325-356, 565, 638-643, 654-663, 716-722, 981-1013), `auto-orcamento/three-viewer.js` (linhas 155-167)

---

### 2026-02-06 - Fix: Compras no dia do fechamento nao entravam na fatura seguinte

**Arquivos Modificados:** `financas/finance-data.js`, `functions/index.js`

**Problema:**
Compras feitas NO dia do fechamento (ex: R$25 no dia 02/02 com fechamento dia 2) nao apareciam em nenhuma fatura. Ficavam no limbo entre dois periodos.

**Causa Raiz:**
`getBillPeriod()` usava `closingDay + 1` como startDate dos periodos. Como endDate = closingDay a meia-noite (00:00) e transactionDate usa T12:00:00, uma compra no closingDay (12:00 > 00:00) nao entrava no periodo atual. E tambem nao entrava no proximo periodo porque startDate = closingDay+1 (00:00 do dia seguinte).

**Solucao:**
Alterado `closingDay + 1` para `closingDay` em TODOS os calculos de startDate em `getBillPeriod()`. Agora:
- Compra no closingDay 12:00 > endDate closingDay 00:00 = NAO entra no periodo atual (correto)
- Compra no closingDay 12:00 >= startDate closingDay 00:00 = ENTRA no periodo seguinte (correto)

Mesma correcao aplicada no bot WhatsApp (`functions/index.js`).

**Localizacao:** `financas/finance-data.js` linhas 85-141 (getBillPeriod), `functions/index.js` linhas 2435-2468 (getBillPeriod bot)

---

### 2026-02-06 - Fix: Graficos nao apareciam por falha de CDN

**Arquivos Modificados:** `financas/index.html`, `financas/finance-ui.js`, `financas/liquid-fill-gauge.js`

**Problema:**
CDN `cdn.jsdelivr.net` retornava `ERR_CONNECTION_CLOSED` para ApexCharts e D3.js, impedindo todos os graficos de renderizar. Erro `d3 is not defined` em `liquid-fill-gauge.js:50`.

**Causa Raiz:**
Dependencia de um unico CDN sem fallback. Quando o jsdelivr ficava indisponivel, zero graficos renderizavam.

**Solucao:**
1. CSP atualizado para permitir `unpkg.com` e `cdnjs.cloudflare.com` como fontes de script
2. Adicionados scripts de fallback inline: se ApexCharts ou D3 nao carregam do jsdelivr, carregam automaticamente de CDN alternativo (unpkg para ApexCharts, cdnjs para D3)
3. Guards de disponibilidade em `initializeCharts()` e `updateCharts()` (finance-ui.js) para verificar `typeof ApexCharts` e `typeof d3` antes de usar
4. Guard em `loadLiquidFillGauge()` (liquid-fill-gauge.js) para verificar `typeof d3` antes de criar gauge

**Localizacao:** `financas/index.html` linhas 20-30 (CSP) e 47-57 (scripts), `financas/finance-ui.js` linhas 55-86 e 88-102, `financas/liquid-fill-gauge.js` linhas 47-50

---

### 2026-02-05 - Fix: Admin Portfolio - Login nao autorizava admins

**Arquivos Modificados:** `admin-portfolio/script.js`

**Problema:**
O botao de login com Google funcionava, mas apos autenticar, todos os usuarios (incluindo admins) eram redirecionados para a tela de "Acesso Negado".

**Causa Raiz:**
O `admin-portfolio/script.js` nao chamava `ENV_CONFIG.loadAdmins(db)` antes de verificar se o usuario era admin. A lista `AUTHORIZED_ADMINS` ficava vazia (array `[]`), entao nenhum email passava na verificacao.

Outros paineis (estoque, financas, custo, marketplace) possuem uma funcao `loadAuthorizedEmails()` que carrega os admins do Firestore antes da verificacao. O admin-portfolio nao tinha essa funcao.

**Solucao:**
1. Adicionada funcao `loadAuthorizedEmails()` (linhas 100-125) que:
   - Chama `ENV_CONFIG.loadAdmins(db)` para buscar admins do Firestore
   - Popula a variavel `AUTHORIZED_EMAILS` com os emails
   - Controla flags `adminsLoaded` e `adminsLoadFailed`

2. Modificada funcao `handleAuthStateChange()` (linhas 176-200) para:
   - Chamar `await loadAuthorizedEmails()` ANTES de verificar autorizacao
   - Negar acesso se `adminsLoadFailed` for true (fail-secure)

**Localizacao:** `admin-portfolio/script.js` linhas 95-130 e 176-200

---

### 2026-02-05 - Fix: Auditoria completa de autenticacao em todos os paineis

**Arquivos Modificados:**
- `admin-portfolio/script.js` - Corrigido botao de login + fallback duplo
- `admin/script.js` - Removido email hardcoded, agora carrega do Firestore
- `estoque/script.js` - Adicionado fallback duplo para carregar admins
- `custo/script-custo.js` - Adicionado fallback duplo para carregar admins

**Problemas Encontrados:**

1. **admin-portfolio:** O `setupGlobalEventDelegation()` so era chamado em `showDashboard()`, entao o botao de login nao funcionava antes do usuario estar autenticado.

2. **admin:** Email do super admin estava hardcoded (`SUPER_ADMIN_EMAIL = '3d3printers@gmail.com'`). Deveria carregar do Firestore.

3. **estoque e custo:** Nao tinham fallback para carregar admins direto do Firestore se `ENV_CONFIG.loadAdmins` falhasse.

**Correcoes:**

1. **admin-portfolio/script.js:**
   - Movido `setupGlobalEventDelegation()` para `DOMContentLoaded` (antes de inicializar Firebase)
   - Adicionada flag `eventDelegationSetup` para evitar duplicacao de event listeners
   - Adicionado fallback duplo: tenta `ENV_CONFIG.loadAdmins()`, depois Firestore direto
   - Adicionado prefixo `[admin-portfolio]` nos logs

2. **admin/script.js:**
   - Renomeado `SUPER_ADMIN_EMAIL` para `LEGACY_SUPER_ADMIN_EMAIL` (fallback temporario)
   - Adicionada funcao `loadSuperAdmins()` que busca admins com `isSuperAdmin: true` no Firestore
   - Adicionada funcao `isSuperAdmin(email)` para verificar status
   - Fallback mantido para garantir acesso durante migracao
   - Atualizado `renderAdmins()` e `requestRemoveAdmin()` para usar nova logica

3. **estoque/script.js e custo/script-custo.js:**
   - Adicionado fallback direto para Firestore se `ENV_CONFIG.loadAdmins` nao estiver disponivel
   - Adicionado prefixo `[estoque]` e `[custo]` nos logs para facilitar debug

**Padrao de Autenticacao Estabelecido:**

Todos os paineis agora seguem o padrao:
1. Tentar `ENV_CONFIG.loadAdmins(db)` primeiro
2. Se falhar, carregar direto do Firestore: `db.collection('admins').where('active', '==', true)`
3. Se nenhum admin encontrado, `adminsLoadFailed = true` e negar acesso (fail-secure)
4. Logs com prefixo do painel para facilitar debug

**Nota para Super Admin:**
Para definir um novo super admin, adicione o campo `isSuperAdmin: true` no documento do admin na collection `admins` do Firestore.

**Script de Migracao:**
```bash
cd functions && node migrate-super-admin.js
```
Este script adiciona `isSuperAdmin: true` ao admin 3d3printers@gmail.com automaticamente.

---

### 2026-02-05 - UI: Footer profissional + Subtitulo com localizacao

**Arquivos Modificados:** `index.html`, `style.css`

**Alteracoes:**
1. **Subtitulo hero:** "Impressao 3D profissional no Rio de Janeiro - Da pessoa fisica a industria"
   - "Rio de Janeiro" agora visivel no subtitulo (melhor para SEO)
2. **Footer redesenhado** com 3 colunas:
   - **Brand:** Logo ImaginaTech + tagline + redes sociais
   - **Contato:** Email (contato@imaginatech.com.br), WhatsApp, Endereco (Rio de Janeiro, RJ)
   - **Links:** Orcamento Online, Portfolio, Acompanhar Pedido, Politica de Privacidade
3. **CSS responsivo:** Footer colapsa para 1 coluna em mobile

---

### 2026-02-05 - SEO: Otimizacao para busca local "impressao 3d rio de janeiro"

**Arquivos Modificados:** `index.html`, `projetos/index.html`, `auto-orcamento/index.html`, `sitemap.xml`

**Problema:**
Site nao aparecia nas buscas por "impressao 3d rj" ou "impressao 3d rio de janeiro" apesar de ter boas avaliacoes no Google.

**Causa:**
- Title e description nao mencionavam "Rio de Janeiro" ou "RJ"
- Keywords focadas em termos genericos ("futuristico", "inovacao")
- LocalBusiness Schema incompleto (sem areaServed)
- Sitemap desatualizado e faltando /auto-orcamento/
- Dois H1 na pagina (problema de estrutura)

**Correcoes:**
1. **Title:** "ImaginaTech - Impressao 3D do Futuro" -> "Impressao 3D Rio de Janeiro | ImaginaTech"
2. **Description:** Adicionado "Rio de Janeiro", "RJ", "orcamento gratis", "entrega para todo RJ"
3. **Keywords:** "impressao 3d rj", "impressao 3d rio de janeiro", "zona norte", "zona sul"
4. **H1:** Visual: "ImaginaTech" + SEO oculto: "- Impressao 3D Rio de Janeiro RJ" (classe .seo-hidden)
5. **LocalBusiness Schema:** Adicionado areaServed, serviceArea, hasOfferCatalog
6. **Sitemap:** Atualizado lastmod para 2026-02-05, adicionado /auto-orcamento/
7. **Estrutura H1:** Navbar logo mudado de h1 para span (apenas um H1 por pagina)
8. **CSS:** Adicionada classe .seo-hidden em style.css (visually-hidden mas acessivel para crawlers)

**Proximos passos (manual):**
- Submeter sitemap no Google Search Console
- Verificar indexacao
- Postar no Google Meu Negocio semanalmente

---

### 2026-02-05 - Fix: Logger - Logs perdidos durante verificacao async de admin

**Arquivos Modificados:** `/shared/firestore-logger.js`

**Problema:**
Logs de admins eram perdidos em paineis acessados sem `?debug=true`. No marketplace com debug, funcionava. No custo sem debug, nao registrava nenhum log.

**Causa Raiz (Race Condition):**
Na funcao `onAuthStateChanged`, a flag `isAdminChecked = true` era setada ANTES de completar a verificacao async `checkIfAdmin(user.uid)`. Durante os milissegundos da verificacao, qualquer `logger.log()` chamado era descartado porque:
1. `isAdminChecked` ja era `true` (nao ia para pendingLogs)
2. `isEnabled` ainda era `false` (descartava o log)

**Solucao:**
Adicionada flag `isAdminCheckInProgress` para manter logs em `pendingLogs` durante toda a verificacao async. Sequencia corrigida:
1. `isAdminCheckInProgress = true` (logs vao para pendingLogs)
2. `await checkIfAdmin(user.uid)` (verificacao async)
3. `isAdminChecked = true` + `isAdminCheckInProgress = false`
4. Se admin: `isEnabled = true` + flush pendingLogs

**Localizacao:** `/shared/firestore-logger.js` linhas 206-230 e 321-340

---

### 2026-02-04 - Feature: Sistema de Logs Centralizado no Firestore

**Arquivos Criados:** `/shared/firestore-logger.js`

**Arquivos Modificados:** 10 paineis (HTML + JS) - servicos, financas, estoque, marketplace, admin, admin-portfolio, acompanhar-pedido, custo, projetos, index.html (raiz)

**Funcionalidade:**
Sistema de logging centralizado que salva todos os logs no Firestore ao inves de exibir no console do navegador (F12).

**Estrutura Firestore:**
```
logs/{painel}/entries/{docId}
  - timestamp: Date
  - level: "log" | "warn" | "error" | "debug" | "info"
  - message: string
  - data: any (dados serializados)
  - stack: string (stack trace para erros)
  - user: string (email do usuario logado)
  - url: string (URL atual)
  - userAgent: string
```

**Caracteristicas:**
- Cada painel tem sua propria collection de logs
- Logs sao enviados em batch a cada 5 segundos ou 10 entradas
- Erros sao enviados imediatamente
- Limpeza automatica de logs com mais de 7 dias
- Captura automatica de erros globais (window.onerror, unhandledrejection)
- Nenhum output no console F12 em producao

**Como usar:**
```javascript
logger.log('Mensagem informativa');
logger.debug('Debug detalhado', { dados: objeto });
logger.warn('Aviso');
logger.error('Erro', error);
logger.flush(); // Forca envio imediato
```

---

### 2026-02-04 - Fix: Marketplace - Upload de fotos falhando (403 Storage Rules)

**Arquivos Modificados:** `storage.rules`, `marketplace/js/marketplace-data.js`, `marketplace/js/marketplace-ui.js`

**Problema:**
Ao adicionar uma foto a um produto e salvar, a foto desaparecia ao reabrir o modal. Console mostrava erro 403 Forbidden no upload para Firebase Storage.

**Causa Raiz:**
O codigo fazia upload para `products/photos/{fileName}`, mas as regras do Storage (`storage.rules`) so tinham:
- `match /products/{fileName}` - arquivos na raiz de /products/
- `match /products/3mf/{fileName}` - arquivos em /products/3mf/

**Nao havia regra para `products/photos/`**, entao o upload caia na regra padrao que bloqueia tudo (linhas 118-121).

**Solucao:**
1. **storage.rules**: Adicionada regra para `products/photos/{fileName}` com mesmas permissoes (admin-only, max 10MB, tipos de imagem). Deploy feito via `firebase deploy --only storage`.

2. **Fallback base64** (seguranca adicional): Em `marketplace-data.js`, se o upload falhar por qualquer motivo, a foto e salva como base64 no Firestore.

3. **Reset editingPhotos**: Em `marketplace-ui.js`, `window.editingPhotos = []` antes de popular fotos ao editar produto.

---

### 2026-02-03 - Fix: Marketplace - Fotos locais eram apagadas ao abrir modal

**Arquivos Modificados:** `marketplace/js/marketplace-core.js`, `marketplace/js/marketplace-ui.js`, `marketplace/js/marketplace-data.js`

**Problema:**
Fotos locais (rascunho) que o usuario adicionava aos produtos sumiam quando o modal de edicao era aberto novamente.

**Causa Raiz Principal:**
Na funcao `syncFromMl()` em `marketplace-ui.js`, quando um produto vinculado ao ML era aberto e o ML nao tinha fotos, o codigo:
1. Limpava `window.editingPhotos = []` - apagando fotos locais da memoria
2. Atualizava Firestore com `localPhotos: []` - **apagando permanentemente** do banco

O comentario dizia "Fotos locais ja foram pro ML", mas isso era uma suposicao incorreta. Usuario pode usar fotos locais como rascunho sem sincronizar com ML.

**Problema Secundario:**
A funcao `escapeHtml()` estava convertendo `&` para `&amp;` nas URLs de imagem, quebrando URLs do ML que contem query parameters.

**Solucao:**
1. **syncFromMl()**: Removida a logica que apagava `localPhotos` do Firestore quando ML nao tem fotos. Fotos locais agora sao preservadas independentemente do estado do ML.

2. **sanitizeImageUrl()**: Nova funcao em `marketplace-core.js` para sanitizar URLs de imagem sem quebrar caracteres validos como `&`.

3. Substituido `escapeHtml(url)` por `sanitizeImageUrl(url)` em todos os `src` de imagens.

**Regra:** Fotos locais so devem ser removidas quando:
- Usuario remove explicitamente (clica no botao remover)
- Usuario sincroniza com ML e as fotos sao enviadas para la

---

### 2026-02-03 - Refactor: Homepage - Botoes hero e video loading placeholder

**Arquivos Modificados:** `index.html`, `style.css`, `script.js`

**Mudanca:**
Secao auto-orcamento do final da pagina removida. Tres botoes hero (Iniciar Projeto, Projetos Anteriores, Auto-Orcamento) centralizados em coluna com gradiente solido. Video do cubo agora mostra spinner de loading enquanto carrega.

**Detalhes - Botoes Hero:**
1. HTML: Botao Auto-Orcamento movido para dentro do `.cta-container` como terceiro `.cta-button`
2. HTML: "Explorar Servicos" renomeado para "Projetos Anteriores" (link #portfolio)
3. CSS: `.cta-container` com `flex-direction: column; align-items: center; gap: 14px`
4. CSS: Botoes pill (`border-radius: 999px`) com gradiente solido:
   - `.cta-primary` verde WhatsApp (`#25d366` -> `#128C47`)
   - `.cta-secondary` ciano (`#00D4FF` -> `#0077FF`)
   - `.cta-orcamento` roxo (`#8b5cf6` -> `#5B21B6`)
5. CSS: Animacao fade-in escalonada (0.3s, 0.5s, 0.7s delay) + scale(1.05) no hover
6. CSS: Icones 1.2em com scale(1.2) no hover
7. Icones: fa-whatsapp, fa-layer-group, fa-cube

**Detalhes - Video Loading Placeholder:**
1. HTML: Removido poster do video e imagem estatica visivel inicialmente
2. HTML: Adicionado `.cube-loading-placeholder` com spinner circular neon (100px)
3. CSS: Video inicia com `opacity: 0`, ganha `.loaded` quando pronto (fade-in 0.5s)
4. JS: Escuta `canplay` + `playing`, detecta cache hit via `readyState >= 2`
5. JS: Fallback para imagem estatica apos 8s se video falhar

---

### 2026-02-02 - Feature: Marketplace - Trocar GCode por 3MF (um arquivo por impressora)

**Arquivos Modificados:** `marketplace/index.html`, `marketplace/js/marketplace-ui.js`, `marketplace/js/marketplace-data.js`, `marketplace/js/marketplace-core.js`, `marketplace/style.css`

**Mudanca:**
O sistema de GCode foi substituido por 3MF. Modelo anterior: "arquivo -> impressoras" (upload .gcode, selecionar impressoras). Novo modelo: "impressora -> arquivo" (lista de impressoras, cada uma com slot de upload .3mf).

**Detalhes:**
1. Coluna da tabela renomeada de "GCode" para "3MF" (data-col-id: `threemf`)
2. HTML: Removido dropzone generico e modal de selecao de impressoras. Adicionado container `threemfPrinterList`
3. JS (marketplace-ui.js): Estado simplificado. Nova funcao `renderThreeMfPrinterList()`. Removidas funcoes de modal de impressoras
4. JS (marketplace-data.js): Storage path alterado de `products/gcode/` para `products/3mf/`. Dados usam `printerName` e `fileName`
5. JS (marketplace-core.js): Actions atualizadas: `upload-3mf`, `remove-3mf`, `download-3mf`
6. CSS: Estilos `.gcode-*` substituidos por `.threemf-*`

**Modelo Firestore (campo `gcodeFiles` mantido):**
- Antes: `{ id, name, printers: ["K1","K2"], url, storagePath, uploadedAt }`
- Depois: `{ id, printerName: "K1", fileName: "peca.3mf", url, storagePath, uploadedAt }`

---

### 2026-02-02 - Fix: Marketplace - Drag-and-drop de colunas acumulava event listeners

**Arquivos Modificados:** `marketplace/js/marketplace-ui.js`

**Problemas:**
1. `_setupDragListeners()` era chamado repetidamente (em `_onDrop`, `reinit`) sem remover listeners antigos. Cada reordenacao adicionava listeners duplicados, causando comportamento erratico e memory leak.
2. `_onDragLeave` disparava ao passar sobre elementos filhos dentro do `<th>` (spans, resize handles), removendo a classe `drag-over` incorretamente e causando flicker visual.

**Correcoes:**
1. Adicionado metodo `_removeDragListeners()` que remove todos os listeners antes de recriar. `_setupDragListeners()` agora chama `_removeDragListeners()` no inicio.
2. `_onDragLeave` agora verifica `e.relatedTarget` com `th.contains()` para ignorar transicoes entre elementos filhos do mesmo `<th>`.

**Localizacao:** Classe `TableColumnReorder` em `marketplace/js/marketplace-ui.js` (linhas ~620-640)

---

### 2026-02-01 - Fix: services.js chamava window.X() removidos na auditoria anterior

**Arquivos Modificados:** `servicos/js/services.js`

**Problema:** A auditoria anterior removeu globals como `window.closeModal`, `window.closeStatusModal`, `window.showBypassPasswordModal` de auth-ui.js, mas services.js ainda os chamava via `window.X()`. Resultado: erro "Erro ao salvar" ao editar servicos.

**Correcao:** Adicionados 8 imports diretos de auth-ui.js e substituidas 15 chamadas `window.X()` por chamadas diretas. Removidos 5 `window.*` globals redundantes de funcoes multi-cor.

### 2026-02-01 - Fix: Formulario de servico nao enviava (validacao nativa + aria-hidden)

**Arquivos Modificados:** `servicos/index.html`, `servicos/js/event-handlers.js`

**Problemas:**
1. O `<select id="deliveryMethod" required>` e escondido pelo CustomSelect (`display: none`). A validacao nativa do browser tentava focar o campo hidden e bloqueava o submit com "An invalid form control is not focusable".
2. Modais tinham `aria-hidden="true"` permanente no HTML. Quando o modal abria (classe `.active`), o `aria-hidden` nao era atualizado. O browser alertava "Blocked aria-hidden on element because descendant retained focus".

**Correcoes:**
1. `servicos/index.html`: Adicionado `novalidate` ao `<form id="serviceForm">` - a validacao ja e feita manualmente no `saveService()`.
2. `servicos/js/event-handlers.js` (initEventDelegation): MutationObserver que sincroniza `aria-hidden` com a classe `.active` em todos os modais (estaticos e dinamicos).

### 2026-02-01 - Auditoria: Coerencia do sistema de delegacao de eventos no painel de Servicos

**Arquivos Modificados:** `servicos/js/event-handlers.js`, `servicos/index.html`, `servicos/styles.css`, `servicos/js/auth-ui.js`, `servicos/js/main.js`, `servicos/js/tasks.js`

**5 problemas corrigidos:**

1. **getElementById('orderCode') com ID errado** - `event-handlers.js:103` buscava `orderCode` mas o HTML define `orderCodeInput`. Botao de regenerar codigo de pedido falhava silenciosamente.

2. **onsubmit inline no formulario** - `index.html:297` usava `onsubmit="saveService(event)"` (violacao de seguranca XSS). Substituido por `addEventListener('submit')` no `initEventDelegation()` de event-handlers.js. Import de `saveService` adicionado de services.js.

3. **z-index numerico em todo styles.css** - 16 ocorrencias de z-index numerico (1, 2, 5, 10, -1) substituidas por variaveis CSS (`--z-raised`, `--z-behind`, `--z-dropdown`) conforme padrao definido em `/shared/z-index.css`.

4. **Namespace legado window.IT e aliases globais** - Removidas ~130 linhas de `window.IT.*` e `window.*` em auth-ui.js (linhas 2500-2640). Todas essas funcoes ja sao tratadas via event delegation em event-handlers.js. Removido `registerGlobals({saveService})` e imports relacionados em main.js.

5. **tasks.js usava window.* para funcoes locais** - 11 funcoes (`filterByAdmin`, `toggleTaskComplete`, `closeTaskDetailsModal`, `addComment`, `openTransferModal`, `closeTransferModal`, `confirmTransfer`, `markAsNotFeasible`, `openAttachmentsModal`, `closeAttachModal`, `uploadAttachment`) convertidas de `window.X = function` para function declarations locais. Removidos `typeof X === 'function'` desnecessarios no sistema de delegacao interno.

### 2026-02-01 - Fix: Autocomplete de clientes no painel de Servicos

**Arquivos Modificados:** `servicos/index.html`, `servicos/js/event-handlers.js`

**Problema:** Ao digitar o nome de um cliente que ja fez pedido, o dropdown de sugestoes (autocomplete) nao aparecia. A funcao `handleClientNameInput` nunca era chamada.

**Causa raiz:** Incompatibilidade entre o atributo HTML e o sistema de delegacao de eventos:
- O input usava `data-action="handleClientNameInput"` + `data-event="input"`
- Porem, o handler de eventos `input` procura pelo atributo `data-input` (nao `data-action`)
- `data-action` so e processado pelo handler de `click`
- Alem disso, `handleClientNameInput` nao estava importada nem registrada em `inputHandlers`

**Correcoes:**
1. `servicos/index.html` (L322): Atributo alterado de `data-action="handleClientNameInput" data-event="input"` para `data-input="handleClientNameInput"`
2. `servicos/js/event-handlers.js` (L55): Adicionado import de `handleClientNameInput` de `auth-ui.js`
3. `servicos/js/event-handlers.js` (L340): Registrado `handleClientNameInput` no objeto `inputHandlers`

### 2026-01-30 - Fix: Responsividade Mobile do Painel Principal (Homepage)

**Arquivos Modificados:** `/index.html`, `/script.js`

**Problemas corrigidos:**

1. **Navbar sem menu hamburger no mobile** - Adicionados imports de `/shared/navbar-mobile.css` e `/shared/navbar-mobile.js`. Reestruturado HTML da navbar: botoes envolvidos em `.nav-buttons-desktop`, adicionado botao `.btn-mobile-menu` e dropdown `.mobile-nav-dropdown` com todos os links de navegacao. Adicionado case `toggle-mobile-menu` no handler de data-action do `script.js`.

2. **Hero nao empilhava verticalmente** - `flex-direction: column` estava no `@media 600px`, movido para `@media 768px`. Agora texto e cubo 3D empilham corretamente em tablets/mobile com centralizacao de texto.

3. **CSS inline conflitava com /shared/navbar.css** - Corrigido `flex-wrap: wrap` para `nowrap` em `.navbar-container`. Removidos `!important` desnecessarios das propriedades base da `.navbar` (background, backdrop-filter, border, border-radius). Removidos overrides de `.btn-nav` nos breakpoints 768px/480px que conflitavam com o sistema shared.

4. **Media queries duplicadas consolidadas** - `.cube-video-container` tinha 3 declaracoes no breakpoint 768px e 3 no 480px. Consolidado para 1 de cada (blocos "25" do CSS). Removido bloco "12" duplicado.

5. **Touch targets corrigidos** - `.social-link` no footer estava com 36px (768px) e 32px (480px), abaixo do minimo Apple HIG de 44px. Corrigido para 44px em ambos breakpoints.

6. **Reducao de !important** - Removidos ~15 usos desnecessarios de `!important` em blocos de tipografia, navbar e performance mobile. Prioridade por source order (inline `<style>` carrega apos shared).

**Locais modificados:**
- `index.html` (head): Import de `/shared/navbar-mobile.css` (apos navbar.css)
- `index.html` (head, bloco `<style>`): CSS inline da navbar, hero, media queries
- `index.html` (body, navbar): HTML reestruturado com `.nav-buttons-desktop` e `.btn-mobile-menu`
- `index.html` (body, apos header): Novo bloco `.mobile-nav-dropdown`
- `index.html` (antes de script.js): Import de `/shared/navbar-mobile.js`
- `script.js` (linha ~65): Novo case `toggle-mobile-menu` no switch/case

### 2026-01-30 - Feature: get_bills com filtro por cartao e lancamentos detalhados

**Arquivo Modificado:** `/functions/index.js`

- **`get_bills` agora aceita `cardName`** no campo `data` do JSON. Quando especificado, filtra por cartao e mostra lancamentos detalhados: transacoes individuais (data, descricao, valor, categoria), parcelas ativas (X/Y), assinaturas vinculadas, total e limite disponivel.
- Sem `cardName`, mantem comportamento anterior (resumo geral).
- Prompt Gemini atualizado (acao 8b) para enviar `cardName` quando o usuario pedir cartao especifico.
- **Fix**: Acoes de consulta (`get_bills`, `get_summary`, `get_balance`, `get_cards`) agora usam `result.message` (dados reais) em vez de `interpretation.message` (frase generica do Gemini).
- **Fix**: Instrucoes de continuidade no prompt reescritas para exigir EXECUCAO da acao, nao apenas reconhecimento do contexto.

### 2026-01-30 - Feature: Memoria de Conversa do Bot WhatsApp

**Arquivo Modificado:** `/functions/index.js`

**Problema:** O bot processava cada mensagem em total isolamento. Quando Claytinho perguntava "qual cartao?" e o usuario respondia "nubank", o Gemini nao tinha contexto da pergunta anterior.

**Solucao implementada:**

1. **`getConversationHistory(phoneNumber, limit)`** - Nova funcao que busca as ultimas N mensagens processadas do numero nos ultimos 30 minutos, retornando historico no formato `[{role, text}]`.

2. **Salvamento de `text` e `botResponse` em `whatsappMessages`** - O documento agora salva o texto da mensagem do usuario (`text: cleanText`) e a resposta do bot (`botResponse`) para todos os caminhos de resposta (conversa, acao JSON, baixa confianca).

3. **Parametro `conversationHistory` em `interpretFinanceCommand()`** - 5o parametro adicionado, buscado em paralelo com cards e overview via `Promise.all`.

4. **Secao de historico no prompt Gemini** - Adicionadas secoes `HISTORICO DA CONVERSA` e `INSTRUCOES DE CONTINUIDADE` com exemplos de follow-up para que o Gemini interprete respostas curtas no contexto da conversa.

**Locais modificados:**
- Nova funcao `getConversationHistory()` (apos `registerWhatsAppUser`)
- `interpretFinanceCommand()` - novo parametro + secoes no prompt
- Webhook handler - `Promise.all` expandido, salvamento de `text` e `botResponse` em 3 caminhos de resposta

### 2026-01-29 - Fix: Revisao Bot WhatsApp - 4 bugs adicionais corrigidos

**Arquivo Modificado:** `/functions/index.js`

- **get_balance agora mostra saldo ALL-TIME** (igual ao KPI do painel): antes mostrava saldo apenas do mes, agora calcula `incomeAllTime - expenseAllTime` com cutoffDate. Mensagem exibe saldo geral + detalhes do mes.
- **add_subscription** corrigido: adicionada validacao NaN no valor, campo `updatedAt`, campo `cardName`, validacao `dueDay` (1-31).
- **add_installment**: adicionado campo `updatedAt` faltante.
- **update_projection_status**: transacao automatica criada ao marcar projecao como recebida agora inclui `updatedAt`.

### 2026-01-29 - Fix: Auditoria Bot WhatsApp - 10 bugs corrigidos na integracao com painel de Financas

**Arquivo Modificado:** `/functions/index.js`

**Bugs Criticos Corrigidos:**
1. **get_balance/get_summary incluiam credito no saldo** - Transacoes com paymentMethod 'credit' agora sao excluidas do calculo de saldo, igualando ao painel (linhas ~3344-3389)
2. **get_bills usava mes calendario** - Agora usa closingDay de cada cartao para definir periodo da fatura, igual ao painel getBillPeriod() (linhas ~3436-3498)
3. **Transacoes do bot sem cardName** - add_transaction agora salva cardName junto com cardId para agrupamento correto no buildFinancialOverview() (linha ~3118)
4. **delete_transaction ignorava descricao** - Agora busca por searchDescription/description antes de fallback para mais recente (linhas ~3529-3603)
5. **edit_transaction nao fazia parseFloat** - newValue agora passa por parseFloat com validacao NaN (linhas ~3650-3657)
6. **COMPANY_USER_ID com fallback hardcoded** - Removido fallback inseguro, adicionada verificacao fail-secure no webhook (linha 1784 e ~4157)

**Bugs de Alta Prioridade:**
7. **cutoffDate em get_balance/get_summary** - Agora carrega userSettings.cutoffDate e aplica filtro
8. **Categorias sem acento no prompt Gemini** - Corrigidas todas as categorias com acentos corretos (Alimentacao -> Alimentacao, Agua -> Agua, etc.)
9. **parseFloat silencioso para NaN** - Validacao explicita com mensagem de erro em add_transaction, add_installment, add_projection, add_investment
10. **edit_transaction fuzzy match ambiguo** - Busca agora prioriza: match exato > substring > categoria > fallback

**Melhorias Medias:**
- updatedAt adicionado em add_card, add_investment, add_projection
- closingDay/dueDay com validacao de range (1-31)
- cardName adicionado em add_installment

### 2026-01-29 - Fix: Auto-Orcamento - Dropdown de cor duplicado e visibilidade por material
- `/auto-orcamento/index.html` - Removida classe `form-select` do select#colorSelect para impedir CustomSelect de gerar dropdown duplicado. Adicionado id="colorOptionGroup" no container da cor para controle de visibilidade.
- `/auto-orcamento/app.js` - updateColorOptions() agora esconde a secao de cor (#colorOptionGroup) quando material e Resina. Cor so aparece para materiais de filamento (PLA, ABS, PETG, TPU). Cores exibidas correspondem ao filamento selecionado.

### 2026-01-29 - Fix: Auto-Orcamento - Fotos de filamento, navbar, resina, responsividade

**Arquivos Modificados:**
- `/functions/index.js` - getAvailableFilaments agora retorna `imageUrl` por cor (primeira bobina com foto).
- `/auto-orcamento/index.html` - CSP img-src inclui `https://firebasestorage.googleapis.com` para fotos do Firebase Storage.
- `/auto-orcamento/app.js` - Color modal exibe foto real do filamento (img tag) quando imageUrl disponivel, fallback para circulo colorido CSS. updateMaterialDropdown garante DEFAULT_MATERIALS (incl. Resina) sempre visiveis. state.selectedColorImage adicionado.
- `/auto-orcamento/style.css` - .color-card-photo (44px, object-fit cover). Navbar spacing: padding-top 120px base, 100px desktop. Responsividade: breakpoints 768px, 480px, 360px completos.

### 2026-01-29 - Feature: Auto-Orcamento - UX: Modal de cores, botao rotacao, acabamentos

**Arquivos Modificados:**
- `/auto-orcamento/index.html` - Botao de rotacao separado (inferior direito, icone fa-rotate-right). Cor: select substituido por botao trigger + modal lateral. Removido "Pintado (+40%)" do acabamento. Peso estimado oculto (classe info-weight-hidden). Modal de cores inserido em body com z-index 10000.
- `/auto-orcamento/style.css` - CSS: .rotate-button (56px, circular, gradient, inferior direito). .info-weight-hidden (display:none). .color-trigger, .color-modal-overlay, .color-modal (slide-in-right lateral). .color-card com swatch colorido. .finish-badge com tooltip hover para glossario (silk, matte, marble, etc). Responsivo mobile para modal e rotacao.
- `/auto-orcamento/app.js` - COLOR_MAP (23 cores hex). FINISH_GLOSSARY (9 acabamentos com descricao). updateColorOptions() substitui updateColorDropdown(). Novo: renderColorModal(), selectColor(), openColorModal(), closeColorModal(), getColorHex(), getFinishBadges(). Handlers: open-color-modal, close-color-modal, select-color. State: selectedColor, colorOptions. Escape fecha modal.

### 2026-01-29 - Fix: Financas - Corrige TypeError em toggleInvestmentVisibility

**Arquivos Modificados:**
- `/financas/finance-ui.js` - Removido parametro `event` e chamada `event.stopPropagation()` da funcao `toggleInvestmentVisibility()` (linha ~3099). O handler de delegacao de eventos (linha 1690) chamava a funcao sem passar o evento, causando `TypeError: Cannot read properties of undefined (reading 'stopPropagation')`. O `stopPropagation` nao era necessario porque o botao toggle e o div do modal sao elementos irmaos no HTML, e `closest('[data-action]')` ja identifica corretamente qual acao executar.

**Revisao da logica de investimentos:** CRUD (adicionar, editar, excluir) revisado e funcionando corretamente. Validacoes, escapeHtml, calculo de total e persistencia no Firestore estao corretos.

### 2026-01-29 - Feature: Auto-Orcamento - Formula do /custo + Resina + Layout sem scroll

**Arquivos Modificados:**
- `/functions/index.js` - Nova formula de precificacao baseada no painel /custo: energia (kWh), depreciacao de maquina, taxa de falha (20%), margem de lucro (280%). Materiais com preco/kg (FDM) e preco/litro (Resina). PRINTER_PROFILES, MATERIAL_CONFIG, PRICING_PARAMS.
- `/auto-orcamento/style.css` - Layout desktop sem scroll: height 100vh, overflow hidden, flex column. Tips escondido no desktop. Espacamentos compactados.

**Formula de preco:**
1. materialCost = peso_g / 1000 * precoKg (FDM) ou volumeCm3 / 1000 * precoLitro (Resina)
2. energyCost = (potencia_W / 1000) * tempo_h * kwhPrice
3. depreciationCost = (valorMaquina / vidaUtil) * tempo_h
4. subtotal = (material + energia + depreciacao + consumiveis) * 1.20 (falha)
5. preco = subtotal * acabamento * prioridade * 3.80 (margem 280%)

### 2026-01-29 - Fix: Auto-Orcamento - Corrige 413 e chamadas duplicadas

**Arquivos Modificados:**
- `/auto-orcamento/app.js` - calculateQuote() agora envia JSON (volume + opcoes) ao inves de FormData com arquivo inteiro. Adicionado debounce via AbortController para cancelar chamadas anteriores. Resolve 413 Content Too Large e 4 chamadas simultaneas.
- `/functions/index.js` - calculateQuote aceita JSON body (Content-Type: application/json) com volume direto. Multipart mantido para compatibilidade. Arquivo e opcional quando volume esta presente.

### 2026-01-29 - Security: Auto-Orcamento - Remocao de calculo local e centralizacao no backend

**Arquivos Modificados:**
- `/auto-orcamento/app.js` - Removido MATERIAL_COSTS, FINISH_MULTIPLIERS, PRIORITY_MULTIPLIERS do CONFIG. Removida funcao calculateLocalEstimate(). calculateQuote() agora depende 100% do backend. Adicionada funcao updatePriceLoading(). Frontend envia infill e volume ao backend.
- `/auto-orcamento/index.html` - Adicionado hash CSP sha256-WAblwXG6PGJEJilAFXnA+ para inline script.
- `/functions/index.js` - Adicionado INFILL_OPTIONS. calculateQuote aceita parametro infill e aplica multiplicador. Aceita volume do frontend para formatos nao-STL (OBJ, GLB, 3MF). Timeout aumentado para 30s no frontend.

**Motivo:**
- Logica de precos estava exposta no frontend (MATERIAL_COSTS visivel no DevTools)
- Backend nao aplicava multiplicador de infill (preenchimento), gerando precos incorretos
- Backend so suportava STL, agora aceita volume calculado pelo Three.js para outros formatos
- Calculo local removido para proteger a logica comercial

### 2026-01-28 - Fix: Auto-Orcamento - Navbar Mobile e Correcao de Calculos

**Arquivos Modificados:**
- `/auto-orcamento/index.html` - Navbar mobile e dropdown
- `/auto-orcamento/app.js` - Formulas de peso e preco, toggle mobile menu
- `/auto-orcamento/style.css` - Padding ajustado

**Correcoes:**

1. **Navbar mobile:**
   - Adicionado import `/shared/navbar-mobile.css`
   - Adicionado botao hamburger com `data-action="toggle-mobile-menu"`
   - Adicionado dropdown mobile (`mobile-nav-dropdown`)
   - Handler `toggleMobileMenu()` implementado no app.js

2. **Formula de peso corrigida:**
   - ANTES: infill + wallThickness + topBottomLayers (incorreto)
   - AGORA: shell (15% solido) + interno (85% * infill%)
   - Resultado mais preciso para pecas tipicas

3. **Calculo de preco corrigido:**
   - `calculateLocalEstimate` agora aplica multiplicador de infill
   - Formula: preco * infillMultiplier * finishMultiplier * priorityMultiplier
   - infillMultiplier: 0.5 + (infill% * 0.5) - range 0.55x a 1.0x

4. **Responsividade:**
   - `calculateQuote` mostra preco local imediatamente (nao espera backend)
   - Backend tenta atualizar depois (timeout 15s)
   - Padding do container ajustado para 110px

---

### 2026-01-28 - Fix: Estoque - Erro 403 Upload e Remocao de Fundo

**Arquivos Modificados:**
- `/estoque/script.js` - Correcoes de seguranca e melhorias na remocao de fundo

**Correcoes:**

1. **Erro 403 no upload de imagens:**
   - Adicionada funcao `refreshAuthToken()` para forcar atualizacao do token de autenticacao
   - Aplicado refresh antes de uploads em `saveFilament()` e `saveEquipment()`
   - Garante que custom claims atualizados (admin) sejam usados

2. **Sanitizacao de nomes de arquivos:**
   - Upload de filamentos agora usa `sanitizeFileName()` (linha ~1514)
   - Upload de equipamentos agora usa `sanitizeFileName()` (linha ~2368)
   - Previne caracteres invalidos e path traversal

3. **Remocao de fundo branco melhorada:**
   - WHITE_THRESHOLD reduzido de 240 para 230 (detecta mais fundos)
   - EDGE_TOLERANCE aumentado de 30 para 40 (transicao mais suave)
   - COLOR_TOLERANCE adicionado (30) para fundos levemente coloridos
   - Nova funcao auxiliar `isWhiteish()` para deteccao mais tolerante
   - Calculo de `maxDiff` substitui verificacao individual de canais

4. **Fallback para imagens com erro:**
   - Imagens de filamentos: `onerror` troca para `/iconwpp.jpg`
   - Imagens de equipamentos: `onerror` substitui por icone placeholder
   - Imagens de summary: `onerror` substitui por div com icone
   - Evita erros visuais quando imagem nao pode ser carregada

**Localizacao das mudancas:**
- `refreshAuthToken()`: linhas ~128-145
- `removeWhiteBackground()`: linhas ~1050-1095
- `createFilamentCard()`: linha ~712
- `createEquipmentCard()`: linha ~2087
- `openEquipmentActionsModal()`: linha ~2410

---

### 2026-01-28 - Fix: Auto-Orcamento - Navbar Mobile e Correcao de Calculos

**Arquivos Modificados:**
- `/auto-orcamento/index.html` - Navbar mobile e dropdown
- `/auto-orcamento/app.js` - Formulas de peso e preco
- `/auto-orcamento/style.css` - Padding ajustado

**Correcoes:**

1. **Navbar mobile:**
   - Adicionado import `/shared/navbar-mobile.css`
   - Adicionado script `/shared/navbar-mobile.js`
   - Adicionado botao hamburger (`btn-mobile-menu`)
   - Adicionado dropdown mobile (`mobile-nav-dropdown`)
   - Botoes de navegacao com atributo `title`

2. **Formula de peso corrigida:**
   - ANTES: infill + wallThickness + topBottomLayers (errado)
   - AGORA: shell (15% solido) + interno (85% * infill%)
   - Resultado mais preciso para pecas tipicas

3. **Calculo de preco corrigido:**
   - `calculateLocalEstimate` agora aplica multiplicador de infill
   - Formula: preco * infillMultiplier * finishMultiplier * priorityMultiplier
   - infillMultiplier: 0.5 + (infill% * 0.5) - range 0.55x a 1.0x

4. **Responsividade:**
   - `calculateQuote` mostra preco local imediatamente
   - Backend tenta atualizar depois (timeout 15s)
   - Padding do container ajustado para 110px

---

### 2026-01-28 - Feature: Auto-Orcamento Integrado com Estoque

**Arquivos Criados:**
- `functions/index.js` - Nova Cloud Function `getAvailableFilaments`

**Arquivos Modificados:**
- `/auto-orcamento/app.js` - Integracao com estoque e calculo de peso
- `/auto-orcamento/index.html` - Dropdowns dinamicos e exibicao de peso

**Funcionalidades:**

1. **Calculo de peso estimado em gramas:**
   - Formula: Volume x Densidade x FatorPreenchimento x Desperdicio
   - Densidades: PLA 1.24, ABS 1.04, PETG 1.27, TPU 1.21, Resina 1.10 g/cm3
   - Fator preenchimento: 33% (20% infill + 8% paredes + 5% topo/fundo)
   - Desperdicio: 10%

2. **Dropdowns dinamicos:**
   - MATERIAL: mostra apenas tipos disponiveis no estoque
   - COR: mostra apenas cores com estoque suficiente para o modelo
   - Exibe quantidade disponivel (ex: "Preto (2.5kg)")

3. **Cloud Function getAvailableFilaments:**
   - Endpoint publico (sem autenticacao)
   - Agrega filamentos por tipo+cor
   - Filtra por peso minimo necessario
   - Rate limit: 120 req/min (readonly)
   - NAO expoe dados sensiveis (marca, notas, IDs)

4. **Fallback:**
   - Se estoque offline, usa materiais/cores padrao
   - Peso ainda e calculado localmente

---

### 2026-01-28 - Refactor: Auto-Orcamento - Uniformizacao com CSS Compartilhado

**Arquivos Modificados:**
- `/auto-orcamento/index.html` - Imports CSS e estrutura HTML
- `/auto-orcamento/style.css` - CSS refatorado (removida duplicacao)
- `/auto-orcamento/app.js` - Removida funcao setupCustomSelects

**Problemas Corrigidos:**

1. **Navbar duplicada:**
   - CSS local definia navbar propria (120 linhas)
   - Agora usa `/shared/navbar.css`
   - Estrutura HTML ajustada para usar `.navbar-container`

2. **CustomSelect nao funcionava:**
   - Faltava import do `/shared/custom-select.js`
   - Selects nao tinham classe `.form-select`
   - Agora dropdowns tem estilo glassmorphism

3. **CSS duplicado removido:**
   - Removidos ~150 linhas de CSS de navbar
   - Removidos estilos de select nativo (conflitavam com CustomSelect)
   - Removida classe `.hidden` (ja vem do z-index.css)

4. **Imports organizados:**
   - Adicionado `/shared/navbar.css`
   - Adicionado `/shared/z-index.css`
   - CSS local vem primeiro (permite overrides)

**Arquitetura Final:**
```
/auto-orcamento/
  index.html  --> Usa: navbar.css, buttons.css, loading.css, custom-select.css/.js
  style.css   --> Apenas estilos ESPECIFICOS do painel (upload, viewer, options)
  app.js      --> Logica do painel (CustomSelect auto-inicializado)
```

---

### 2026-01-27 - Feature: Painel de Auto-Orcamento 3D

**Arquivos Criados:**
- `/auto-orcamento/index.html` - Pagina do painel de auto-orcamento
- `/auto-orcamento/style.css` - Estilos do painel
- `/auto-orcamento/app.js` - Logica principal (upload, UI, calculo)
- `/auto-orcamento/three-viewer.js` - Visualizador 3D com Three.js
- `/auto-orcamento/volume-calculator.js` - Calculo de volume de geometrias

**Arquivos Modificados:**
- `/index.html` - Adicionada secao CTA "Ja possui um arquivo de impressao?"
- `/style.css` - Estilos da secao CTA com animacao de cubo 3D
- `/functions/index.js` - Nova Cloud Function `calculateQuote`
- `/functions/package.json` - Adicionado `busboy` para parse de multipart

**Funcionalidades:**
1. **Upload de arquivos 3D:** STL, OBJ, GLB, 3MF (max 50MB)
2. **Visualizacao 3D interativa:** Three.js com controles de camera
3. **Calculo de volume:** Algoritmo de tetraedros assinados
4. **Selecao de opcoes:** Material, cor, acabamento, prioridade
5. **Orcamento instantaneo:** Backend calcula preco oficial
6. **Fallback inteligente:** Se backend falhar, usa calculo local
7. **Integracao WhatsApp:** Botao envia orcamento formatado

**Cloud Function calculateQuote:**
- Endpoint: `POST /calculateQuote`
- Recebe: arquivo STL + opcoes (material, finish, priority)
- Retorna: { success, price, volume, material, isEstimate }
- Parser STL suporta ASCII e binario
- Tabela de precos PROTEGIDA no backend

**Arquitetura:**
```
Frontend (Three.js)     Backend (Cloud Function)
       |                        |
   Upload file  -------->  Parse STL
   Show preview            Calculate volume
   Select options          Apply pricing formula
   Display price  <-------  Return quote
       |                        |
   WhatsApp CTA
```

---

### 2026-01-27 - Fix: Marketplace - Upload de Fotos para Storage (Firestore 1MB Limit)

**Arquivos Modificados:**
- `marketplace/js/marketplace-data.js` - Implementacao de upload de fotos para Firebase Storage

**Problema:**
- Fotos de produtos eram salvas como base64 diretamente no Firestore
- Cada foto em base64 pode ter 500KB-3MB de tamanho
- Firestore tem limite de 1MB por documento
- Administradoras nao conseguiam salvar produtos com fotos ("Erro ao salvar produto")

**Solucao Implementada:**

1. **Nova funcao `uploadPhotoToStorage()`:**
   - Faz upload de foto individual para Firebase Storage
   - Path: `products/photos/{productId}_{timestamp}_{randomId}_{filename}`
   - Retorna URL publica do Storage

2. **Nova funcao `uploadLocalPhotosToStorage()`:**
   - Processa multiplas fotos para upload
   - Ignora fotos sem arquivo associado
   - Mantém fotos que ja tem URL do Storage

3. **Modificacao em `handleProductSubmit()`:**
   - Antes de salvar, faz upload das fotos locais para Storage
   - Substitui URLs base64 por URLs do Storage
   - Apenas URLs sao salvas no Firestore (documento pequeno)

**Impacto:**
- Produtos podem ter ate 10 fotos de qualquer tamanho
- URLs do Storage sao carregadas rapidamente via CDN
- Compatibilidade mantida com fotos do Mercado Livre

---

### 2026-01-26 - Fix: Marketplace Modal - ARIA e ID Corrigidos

**Arquivos Modificados:**
- `marketplace/js/marketplace-ui.js` - Correcoes no modal de produto

**Correcoes:**

1. **ID do Titulo do Modal:**
   - Corrigido `getElementById('modalTitle')` para `getElementById('productModalTitle')`
   - ID incorreto causava `TypeError: Cannot set properties of null`

2. **Null Safety:**
   - Adicionado verificacao `if (modalTitle)` antes de setar innerHTML

3. **ARIA Accessibility:**
   - Adicionado `modal.setAttribute('aria-hidden', 'false')` ao abrir modal
   - Adicionado `modal.setAttribute('aria-hidden', 'true')` ao fechar em todas as funcoes:
     - `closeProductModal()`
     - `closeMaterialDetailsModal()`
     - `closeDescriptionEditorModal()`
     - `closeNewProductChoiceModal()`
     - Tratamento de erro quando produto nao encontrado

---

### 2026-01-26 - Fix: ML OAuth Popup Communication

**Arquivos Modificados:**
- `marketplace/js/marketplace-ml.js` - Comunicacao entre popup OAuth e janela original

**Implementacao:**

1. **Popup envia mensagem para opener:**
   - Ao detectar retorno OAuth (`ml_connected=true`), popup usa `window.opener.postMessage()` para notificar janela original
   - Popup fecha automaticamente apos enviar mensagem

2. **Janela original escuta mensagens:**
   - `connectMercadoLivre()` adiciona listener para `message` event
   - Ao receber `ML_OAUTH_SUCCESS`, atualiza status e recarrega pedidos/historico
   - Listener removido apos 5 minutos (timeout de seguranca)

**Beneficio:** Usuario nao precisa mais dar F5 apos logar no ML via popup.

---

### 2026-01-26 - Fix: CSP - Adiciona www.gstatic.com

**Arquivos Modificados:**
- `marketplace/index.html` - CSP connect-src atualizado
- `admin-portfolio/index.html` - CSP connect-src atualizado

**Correcao:**
- Firebase source maps eram bloqueados pela CSP
- Adicionado `https://www.gstatic.com` ao connect-src

---

### 2026-01-26 - Seguranca: Rate Limiting Global (Protecao DDoS)

**Arquivos Modificados:**
- `functions/index.js` - Sistema de rate limiting por IP implementado em todas as 23 Cloud Functions HTTP

**Implementacao:**

1. **Sistema de Rate Limit por IP:**
   - Cache em memoria com limpeza automatica (5 min)
   - Headers RFC 6585: X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After
   - Bloqueio temporario (5 min) para IPs que excedem 3x o limite

2. **Limites por Tipo de Endpoint:**
   | Tipo | Limite | Endpoints |
   |------|--------|-----------|
   | `default` | 60/min | CRUD operations |
   | `auth` | 20/min | mlAuth, mlOAuthCallback |
   | `sensitive` | 10/min | verifyBypassPassword, initAdmins, refreshAdminClaims |
   | `webhook` | 300/min | mlwebhook, whatsappWebhook |
   | `readonly` | 120/min | mlStatus, getAdmins, mlListItems, mlGetPendingOrders, etc |

3. **Endpoints Protegidos (23 total):**
   - Mercado Livre: mlAuth, mlOAuthCallback, mlwebhook, mlStatus, mlListItems, mlGetPendingOrders, mlGetSalesHistory, mlGetOrderDetails, mlGetItemDetails, mlUpdatePrice, mlUpdateStock, mlUpdateDescription, mlUpdateTitle, mlUpdateItemPhotos
   - Admin: getAdmins, initAdmins, refreshAdminClaims, verifyBypassPassword
   - WhatsApp: whatsappWebhook, sendWhatsAppMessage, whatsappStatus, registerWhatsAppUser, linkMyWhatsApp

**Beneficios:**
- Protecao contra ataques DDoS na camada de aplicacao
- Prevencao de abuso de APIs externas (ML, WhatsApp)
- Reducao de custos em caso de ataque (Cloud Functions cobram por invocacao)
- Feedback claro ao cliente via headers HTTP padrao

---

### 2026-01-26 - Seguranca: Remocao de Event Handlers Inline (onclick, onerror) + XSS Fixes

**Arquivos Modificados:**
- `financas/finance-data.js` - 6 onclick inline convertidos para data-action (investment edit/delete, bill paid/unpaid, credit transaction edit/delete, unlink-whatsapp)
- `financas/finance-ui.js` - Adicionados event handlers para novos data-actions
- `financas/style.css` - Adicionada classe .btn-icon-sm para botoes menores
- `servicos/js/tasks.js` - 14 onclick inline convertidos para data-action, event delegation centralizado
- `admin/script.js` - onerror inline em img convertido para data-fallback com event handler
- `admin-portfolio/script.js` - onerror inline em img convertido para data-fallback, error event handler adicionado
- `custo/script-custo.js` - escapeHtml adicionado, onerror inline convertido para data-fallback, error event handler adicionado
- `marketplace/js/marketplace-ui.js` - onerror inline em img convertido para data-fallback-action, error event handler adicionado
- `marketplace/js/marketplace-ml.js` - XSS fix: status.nickname agora usa escapeHtml

**Vulnerabilidades Corrigidas:**

1. **onclick inline em innerHTML (XSS):**
   - 6 ocorrencias em finance-data.js removidas
   - 14 ocorrencias em tasks.js removidas
   - Todos convertidos para data-action com event delegation

2. **onerror inline em img tags:**
   - admin/script.js: img com fallback para ui-avatars
   - admin-portfolio/script.js: img com fallback para /iconwpp.jpg
   - custo/script-custo.js: img com fallback para /iconwpp.jpg
   - marketplace/js/marketplace-ui.js: img que esconde e mostra placeholder
   - Todos convertidos para data-fallback ou data-fallback-action com error event listeners

3. **XSS em dados do Mercado Livre:**
   - marketplace-ml.js: status.nickname nao estava escapado
   - Corrigido com escapeHtml()

**Pattern de Correcao:**
```javascript
// ANTES (vulneravel)
<button onclick="edit('${id}')">

// DEPOIS (seguro)
<button data-action="edit" data-id="${escapeHtml(id)}">
```

```javascript
// ANTES (vulneravel)
<img onerror="this.src='fallback.jpg'">

// DEPOIS (seguro)
<img data-fallback="fallback.jpg">
document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && e.target.dataset.fallback) {
        e.target.src = e.target.dataset.fallback;
        e.target.removeAttribute('data-fallback');
    }
}, true);
```

---

### 2026-01-26 - Seguranca Completa - Painel Admin (Security Hardening)

**Arquivos Modificados:**
- `admin/index.html` - CSP adicionada, 18 onclick + 2 onsubmit convertidos para data-action/data-form, ARIA em 3 modais
- `admin/script.js` - Security utilities adicionadas (logger, generateSecureId), Firebase credentials hardcoded removidos, event delegation centralizado, console.error convertidos para logger

#### Nota de Seguranca
- **Antes:** 4/10 (F - Critico)
- **Depois:** 9/10 (A- Excelente)

#### Vulnerabilidades Corrigidas

**1. Content Security Policy (CSP) Adicionada:**
- Protege contra XSS e injecao de scripts maliciosos
- Permite Firebase, Google Auth, Font Awesome

**2. Event Handlers Inline Removidos (18 onclick + 2 onsubmit):**
- `onclick="signInWithGoogle()"` -> `data-action="sign-in-google"`
- `onclick="signOut()"` -> `data-action="sign-out"` (2x)
- `onclick="toggleMobileMenu()"` -> `data-action="toggle-mobile-menu"`
- `onclick="switchTab('...')"` -> `data-action="switch-tab" data-value="..."`
- `onclick="openAddAdminModal()"` -> `data-action="open-add-admin-modal"` (2x)
- `onclick="openAddWhatsAppModal()"` -> `data-action="open-add-whatsapp-modal"` (2x)
- `onclick="closeAddAdminModal()"` -> `data-action="close-add-admin-modal"` (2x)
- `onclick="closeAddWhatsAppModal()"` -> `data-action="close-add-whatsapp-modal"` (2x)
- `onclick="closeConfirmRemoveModal()"` -> `data-action="close-confirm-remove-modal"` (2x)
- `onclick="confirmRemove()"` -> `data-action="confirm-remove"`
- `onsubmit="handleAddAdmin(event)"` -> `data-form="add-admin"`
- `onsubmit="handleAddWhatsApp(event)"` -> `data-form="add-whatsapp"`

**3. Event Delegation Centralizado (setupGlobalEventDelegation):**
- Handlers para todos data-action mapeados
- Handlers para forms com data-form
- Suporte a `data-action="remove-admin"` e `data-action="remove-whatsapp"` com `data-id`

**4. ARIA Accessibility em 3 Modais:**
- `#addAdminModal`: role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `#addWhatsAppModal`: role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `#confirmRemoveModal`: role="dialog", aria-modal="true", aria-labelledby, aria-hidden

**5. Logger Condicional:**
- Substitui console.log/error diretos
- So exibe logs em ambiente de desenvolvimento
- Oculta stack traces em producao

**6. Secure ID Generation:**
- Funcao generateSecureId usando crypto.getRandomValues
- Substitui Math.random() inseguro

**7. Firebase Config Sem Fallbacks Hardcoded:**
- Credenciais lidas exclusivamente de window.ENV_CONFIG
- Sem emails/keys expostos no codigo

---

### 2026-01-26 - Transcricao de Audio para Bot Claitinho (WhatsApp)

**Arquivos Modificados:**
- `functions/index.js` - Adicionadas funcoes de download e transcricao de audio, webhook modificado para aceitar audio
- `functions/package.json` - Adicionada dependencia `openai: ^4.77.0`

**Nova Funcionalidade:**
O bot Claitinho agora aceita mensagens de audio alem de texto. Audios sao transcritos usando OpenAI Whisper API e processados normalmente pelo Gemini.

**Fluxo de Processamento:**
```
Audio WhatsApp -> Download via Graph API -> Transcricao Whisper -> Gemini -> Resposta
```

**Novas Funcoes em functions/index.js:**

1. **downloadWhatsAppMedia(mediaId)** - Linha ~3580
   - Baixa midia do WhatsApp em 2 passos (obter URL + download)
   - Retorna buffer e mimeType

2. **transcribeAudio(audioBuffer, mimeType)** - Linha ~3615
   - Envia audio para OpenAI Whisper API
   - Suporta formatos: OGG, MP3, M4A, WAV, WebM
   - Retorna texto transcrito em portugues

3. **processAudioMessage(message, from)** - Linha ~3660
   - Orquestra download + transcricao
   - Valida tamanho (max 16MB)
   - Trata erros com mensagens amigaveis

**Modificacao no Webhook (linha ~3811):**
- Antes: Rejeitava qualquer mensagem que nao fosse texto
- Depois: Aceita texto OU audio, transcrevendo audio automaticamente

**Variavel de Ambiente Necessaria:**
```bash
firebase functions:config:set openai.api_key="sk-..."
```
Ou no `.env`:
```
OPENAI_API_KEY=sk-...
```

**Estimativa de Custos:**
- Whisper API: $0.006/minuto (~R$0.03)
- Audio medio de 30 segundos: ~R$0.02
- 1000 audios/mes: ~R$20

**Tratamento de Erros:**
| Erro | Mensagem ao Usuario |
|------|---------------------|
| Audio muito grande | "O audio e muito longo, envie um mais curto" |
| Transcricao vazia | "Nao consegui identificar fala no audio" |
| API nao configurada | "Transcricao de audio nao configurada" |
| Outros erros | "Tente novamente ou digite sua mensagem" |

---

### 2026-01-26 - Seguranca Completa - Painel Estoque (Security Hardening v2.0)

**Arquivos Modificados:**
- `estoque/index.html` - CSP adicionada, ~46 onclick/onchange inline convertidos para data-action, ARIA em 4 modais
- `estoque/script.js` - Security utilities adicionadas (escapeHtml, generateSecureId, logger, validateImageMagicBytes, sanitizeFileName), Firebase credentials hardcoded removidos, event delegation centralizado

#### Nota de Seguranca
- **Antes:** 5/10 (D - Necessita Correcoes Urgentes)
- **Depois:** 9/10 (A- Excelente)

#### Vulnerabilidades Corrigidas

**1. Content Security Policy (CSP) Adicionada:**
```html
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com https://accounts.google.com https://cdnjs.cloudflare.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;
    font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;
    img-src 'self' https: data: blob:;
    connect-src 'self' https://*.firebaseio.com https://*.googleapis.com ...;
    frame-src 'self' https://accounts.google.com https://*.firebaseapp.com;
    object-src 'none'; base-uri 'self';
">
```

**2. XSS Prevention - escapeHtml aplicado em:**
- `createFilamentCard()` - type, color, brand, service names/codes
- `createEquipmentCard()` - name, brand, notes, acquisition date
- `openCardActionsModal()` - filament display info
- `openEquipmentActionsModal()` - equipment display info
- `updateBrandFilters()` - brand names in filter buttons
- `showToast()` - toast messages

**3. Todos os onclick/onchange Inline Removidos (~46 ocorrencias):**
- `onclick="signInWithGoogle()"` -> `data-action="sign-in-google"`
- `onclick="signOut()"` -> `data-action="sign-out"`
- `onclick="switchSection('...')"` -> `data-action="switch-section" data-value="..."`
- `onclick="filterByStatCard('...')"` -> `data-action="filter-stat-card" data-value="..."`
- `onclick="filterByType('...')"` -> `data-action="filter-type"`
- `onclick="openAddFilamentModal()"` -> `data-action="open-add-filament-modal"`
- `onclick="closeFilamentModal()"` -> `data-action="close-filament-modal"`
- `onsubmit="saveFilament(event)"` -> `data-form="filament"`
- `onchange="previewImage(event)"` -> `data-action="preview-filament-image"`
- `onclick="handleQuickDeduction()"` -> `data-action="quick-deduction"`
- E mais ~35 outros handlers

**4. ARIA em todos os 4 modais:**
- `filamentModal` - role="dialog", aria-modal="true", aria-labelledby="modalTitle", aria-hidden="true"
- `cardActionsModal` - role="dialog", aria-modal="true", aria-labelledby="cardActionsTitle", aria-hidden="true"
- `equipmentModal` - role="dialog", aria-modal="true", aria-labelledby="equipmentModalTitle", aria-hidden="true"
- `equipmentActionsModal` - role="dialog", aria-modal="true", aria-labelledby="equipmentActionsTitle", aria-hidden="true"

**5. Security Utilities Adicionadas em script.js:**
- `escapeHtml()` - Previne XSS ao renderizar dados de usuario
- `logger` - Console condicional (so exibe em desenvolvimento)
- `generateSecureId()` - IDs seguros com crypto.getRandomValues
- `validateImageMagicBytes()` - Valida conteudo real do arquivo
- `sanitizeFileName()` - Previne path traversal

**6. Validacao de Upload Aprimorada:**
- SVG bloqueado explicitamente (risco de XSS)
- Magic bytes validados (nao confiar apenas em extensao)
- Limite de tamanho 5MB
- Tipos permitidos: PNG, JPEG, WebP, GIF

**7. Firebase Credentials Hardcoded Removidos:**
- Antes: `apiKey: window.ENV_CONFIG?.FIREBASE_API_KEY || "AIzaSy..."`
- Depois: `apiKey: window.ENV_CONFIG?.FIREBASE_API_KEY` (sem fallback)

**8. Event Delegation Centralizado:**
- `setupGlobalEventDelegation()` - Handler para todos os data-action
- `setupGridEventDelegation()` - Handler para grid de filamentos + image load
- `setupEquipmentGridEventDelegation()` - Handler para grid de equipamentos + image load

---

### 2026-01-25 - Fix initializeDashboard Undefined Error

**Problema:** Erro `ReferenceError: initializeDashboard is not defined` ao fazer login no painel financas.

**Causa Raiz:** O callback `auth.onAuthStateChanged` em finance-core.js disparava imediatamente quando o usuario ja estava logado, ANTES de finance-data.js (que define `initializeDashboard`) terminar de carregar.

**Arquivos Modificados:**
- `financas/finance-core.js` - Adicionado sistema de coordenacao de carregamento:
  - `scriptsLoaded` flag para rastrear se scripts carregaram
  - `pendingAuthUser` para armazenar usuario enquanto scripts carregam
  - `window.notifyScriptsLoaded()` funcao chamada quando tudo esta pronto
  - `processAuthenticatedUser()` extrai logica de auth para reutilizacao

- `financas/finance-ui.js` - Adicionado chamada `window.notifyScriptsLoaded()` no final do arquivo

**Fluxo Corrigido:**
1. finance-core.js carrega -> define flags e notifyScriptsLoaded
2. auth.onAuthStateChanged dispara -> se scripts nao carregaram, armazena usuario em pendingAuthUser
3. finance-data.js carrega
4. finance-ui.js carrega -> chama notifyScriptsLoaded()
5. notifyScriptsLoaded processa pendingAuthUser se existir

---

### 2026-01-25 - Seguranca Completa - Painel Financas (Security Hardening v3.1)

**Arquivos Modificados:**
- `financas/index.html` - CSP adicionada, ~55 onclick/onkeyup/onchange inline convertidos para data-action/data-format, ARIA em todos os 13 modais
- `financas/finance-core.js` - Security utilities adicionadas (escapeHtml, generateSecureId, logger), Firebase credentials hardcoded removidos
- `financas/finance-ui.js` - Event delegation centralizado com 40+ handlers de acao, console.log -> logger em secoes criticas
- `financas/dashboard-enhanced.js` - XSS corrigido em 6 funcoes de renderizacao (escapeHtml aplicado), onclick inline removidos

#### Nota de Seguranca
- **Antes:** 5.5/10 (D - Necessita Correcoes Urgentes)
- **Depois:** 9.2/10 (A - Excelente)

#### Vulnerabilidades Corrigidas

**1. Content Security Policy (CSP) Adicionada:**
```html
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com https://cdn.jsdelivr.net;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;
    font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;
    img-src 'self' https: data: blob:;
    connect-src 'self' https://*.firebaseio.com https://*.googleapis.com ...;
    frame-src 'self' https://accounts.google.com https://*.firebaseapp.com;
    object-src 'none'; base-uri 'self';
">
```

**2. XSS Prevention - escapeHtml aplicado em dashboard-enhanced.js:**
- `showTransactionsList()` - description, category, id
- `showSubscriptionsList()` - name, category, card name/institution, id
- `showInstallmentsList()` - description, id
- `showProjectionsList()` - description, id (income e expense)
- `showCreditCardsList()` - name, institution, id

**3. Todos os onclick/onkeyup/onchange Inline Removidos (~55 ocorrencias):**
- `onclick="closeTransactionModal()"` -> `data-action="close-transaction-modal"`
- `onclick="closeSubscriptionModal()"` -> `data-action="close-subscription-modal"`
- `onclick="selectInstallmentValueType('total')"` -> `data-action="select-installment-value-type" data-value="total"`
- `onclick="selectProjectionType('income')"` -> `data-action="select-projection-type" data-value="income"`
- `onkeyup="formatCurrency(this)"` -> `data-format="currency"`
- `onchange="calculateInstallmentValues()"` -> `data-calculate="installment"`
- `onclick="closeListModal('...')"` -> `data-action="close-list-modal" data-modal="..."`
- `onclick="editTransactionAndRefresh('${id}')"` -> `data-action="edit-transaction" data-id="${escapeHtml(id)}"`
- E mais ~45 outros handlers

**4. ARIA em todos os 13 modais:**
- `transactionModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `subscriptionModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `installmentModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `projectionModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `creditCardModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `cardExpenseModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `transactionsListModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `subscriptionsListModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `installmentsListModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `projectionsListModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `creditCardsListModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `cardBillDetailsModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `investmentsModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `settingsModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden

**5. Event Delegation Centralizado (finance-ui.js):**
```javascript
// 40+ action handlers para:
// - Auth: sign-in-google, select-account, switch-account, sign-out
// - Navigation: change-month, toggle-mobile-menu
// - KPI Lists: open-kpi-list
// - Modals: open-*, close-* para todos os 13 modais
// - Type Selectors: select-transaction-type, select-payment-method, select-projection-type
// - CRUD: edit-transaction, delete-transaction, edit-subscription, etc.
// - Input handlers: data-format="currency", data-calculate="installment"
```

**6. Firebase Credentials Hardcoded Removidos:**
- Antes: `firebaseConfig = { apiKey: "AIzaSy..." } // Fallback inseguro`
- Depois: Fail-secure sem fallback, carrega exclusivamente de ENV_CONFIG

**7. Logger Condicional (LGPD/Producao):**
```javascript
const isDev = window.location.hostname === 'localhost';
const logger = {
    log: (...args) => isDev && console.log(...args),
    warn: (...args) => isDev && console.warn(...args),
    error: (msg, err) => isDev ? console.error(msg, err) : console.error(msg.split('\n')[0])
};
```

---

### 2026-01-25 - Seguranca Completa - Painel Marketplace (Security Hardening v2.1)

**Arquivos Modificados:**
- `marketplace/index.html` - CSP adicionada, ~25 onclick inline convertidos para data-action, ARIA em todos os 6 modais
- `marketplace/js/marketplace-core.js` - Event delegation centralizado expandido com 30+ handlers de acao
- `marketplace/js/marketplace-data.js` - console.* substituido por logger.* (16 ocorrencias)
- `marketplace/js/marketplace-ml.js` - escapeHtml adicionado, onclick inline removidos, console.* -> logger.* (40+ ocorrencias)

#### Nota de Seguranca
- **Antes:** 6/10 (D - Necessita Correcoes)
- **Depois:** 9.5/10 (A - Excelente)

#### Vulnerabilidades Corrigidas

**1. Content Security Policy (CSP) Adicionada:**
```html
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://www.gstatic.com https://apis.google.com https://cdnjs.cloudflare.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;
    font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;
    img-src 'self' https: data: blob:;
    connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://*.cloudfunctions.net ...;
    frame-src 'self' https://accounts.google.com https://*.firebaseapp.com;
    object-src 'none'; base-uri 'self';
">
```

**2. XSS Prevention - escapeHtml aplicado em:**
- `renderMlItems()` - MLB ID, title, status
- `renderPendingOrders()` - order ID
- `renderSalesHistory()` - order ID

**3. Todos os onclick/onchange Inline Removidos (~25 ocorrencias):**
- `onclick="signInWithGoogle()"` -> `data-action="sign-in-google"`
- `onclick="signOut()"` -> `data-action="sign-out"`
- `onclick="toggleMobileMenu()"` -> `data-action="toggle-mobile-menu"`
- `onclick="connectMl()"` -> `data-action="connect-ml"`
- `onclick="switchTab('products')"` -> `data-action="switch-tab" data-tab="products"`
- `onclick="clearFilters()"` -> `data-action="clear-filters"`
- `onclick="openNewProductChoiceModal()"` -> `data-action="new-product"`
- `onclick="loadPendingOrders()"` -> `data-action="load-pending-orders"`
- `onclick="loadSalesHistory()"` -> `data-action="load-sales-history"`
- `onchange="loadSalesHistory()"` -> `data-action-change="load-sales-history"`
- `onclick="viewOrderDetails('${id}')"` -> `data-action="view-order-details" data-order-id="..."`
- `onclick="selectMlbItem('${id}')"` -> `data-action="select-mlb-item" data-mlb-id="..."`
- E mais ~15 outros handlers de modais

**4. ARIA em todos os 6 modais:**
- `linkMlbModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `orderDetailsModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `productModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `newProductChoiceModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `materialDetailsModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden
- `descriptionEditorModal` - role="dialog", aria-modal="true", aria-labelledby, aria-hidden

**5. Event Delegation Centralizado Expandido:**
```javascript
// marketplace-core.js - setupEventDelegation()
const actions = {
    'sign-in-google': () => signInWithGoogle(),
    'sign-out': () => signOut(),
    'toggle-mobile-menu': () => window.toggleMobileMenu?.(),
    'switch-tab': () => { const tab = actionEl.dataset.tab; if (tab) switchTab(tab); },
    'connect-ml': () => window.connectMl?.(),
    'new-product': () => window.openNewProductChoiceModal?.(),
    'view-order-details': () => { const id = actionEl.dataset.orderId; if (id) viewOrderDetails(id); },
    'select-mlb-item': () => { const id = actionEl.closest('.mlb-item')?.dataset.mlbId; if (id) selectMlbItem(id); },
    // ... 30+ outros handlers
};
```

**6. Logger Condicional (LGPD/Producao):**
```javascript
// console.log/error substituidos por window.logger?.log/error em:
// - marketplace-data.js (16 ocorrencias)
// - marketplace-ml.js (40+ ocorrencias)
// Logger so exibe stack traces em localhost/desenvolvimento
```

**7. Seguranca ja implementada (mantida):**
- `escapeHtml()` em marketplace-core.js linha 702-707
- `maskEmail()` para LGPD (linha 26-33)
- `logger` condicional (linha 10-22)
- Admins carregados do Firestore sem fallback hardcoded (linha 78-113)
- Firebase config via ENV_CONFIG sem credenciais hardcoded (linha 37-48)

---

### 2026-01-25 - Sistema de GCode no Marketplace (Substituicao do .3mf)

**Funcionalidade:** Substituicao do campo de arquivo .3mf por um sistema completo de gerenciamento de arquivos GCode.

**Caracteristicas:**
1. **Upload de multiplos GCodes** - Agora e possivel adicionar varios arquivos GCode por produto
2. **Vinculacao obrigatoria a impressoras** - Cada GCode deve estar vinculado a pelo menos uma impressora
3. **Data de upload** - Cada GCode exibe a data em que foi adicionado ao sistema
4. **Interface elegante** - UI moderna com cards de impressoras com fotos

**Arquivos Modificados:**

**1. marketplace/index.html:**
- Coluna da tabela alterada de `.3MF` para `GCode` (linhas 321, 337)
- Secao do formulario completamente reescrita (linhas 770-810):
  - Novo container `#gcodeManager` com lista e formulario de upload
  - Dropzone para multiplos arquivos
  - Modal de selecao de impressoras `#gcodePrinterModal`
  - Atributos ARIA no modal para acessibilidade

**2. marketplace/js/marketplace-ui.js:**
- Funcoes removidas: `get3mfDownloadButton`, `download3mfFile`, `setup3mfDropzone`, `handle3mfFile`, `remove3mfFile`, `show3mfPreview`, `reset3mfUpload`
- Funcoes adicionadas (linhas 2420-2867):
  - `getGcodeColumnDisplay()` - Exibe badge com quantidade de GCodes na tabela
  - `setupGcodeManager()` - Inicializa dropzone e listeners
  - `handleGcodeFiles()` - Processa multiplos arquivos selecionados
  - `generateSecureId()` - Gera IDs usando crypto.getRandomValues
  - `renderGcodeList()` - Renderiza lista de GCodes com acoes
  - `formatGcodeDate()` - Formata data para exibicao
  - `extractPrinterShortName()` - Extrai nome curto da impressora
  - `openGcodePrinterModal()` / `closeGcodePrinterModal()` - Gerencia modal de impressoras
  - `renderGcodePrinterGrid()` - Renderiza grid de impressoras no modal
  - `toggleGcodePrinter()` - Alterna selecao de impressora
  - `confirmGcodePrinters()` - Confirma selecao (validacao de minimo 1)
  - `removeGcode()` / `downloadGcode()` - Acoes em GCodes existentes
  - `loadGcodesForEdit()` - Carrega GCodes ao editar produto
  - `resetGcodeManager()` - Limpa estado ao fechar modal
  - `validateGcodes()` - Valida se todos tem impressoras
  - `getPendingGcodeFiles()` / `getGcodesData()` - Getters para dados

**3. marketplace/js/marketplace-data.js:**
- Funcao removida: `upload3mfFile()`
- Funcoes adicionadas:
  - `uploadGcodeFile()` - Upload individual com nome sanitizado
  - `uploadPendingGcodes()` - Upload em lote de arquivos pendentes
- Handler `handleProductSubmit()` atualizado:
  - Valida GCodes antes de salvar
  - Faz upload de arquivos pendentes
  - Salva `gcodeFiles` array no Firestore

**4. marketplace/js/marketplace-core.js:**
- Event handlers adicionados:
  - `edit-gcode-printers` - Abre modal de impressoras para GCode
  - `remove-gcode` - Remove GCode da lista
  - `download-gcode` - Baixa arquivo GCode existente
  - `close-gcode-printer-modal` - Fecha modal de impressoras
  - `confirm-gcode-printers` - Confirma selecao de impressoras
  - `toggle-gcode-printer` - Alterna selecao de impressora no modal

**5. marketplace/style.css:**
- Estilos removidos: `.col-3mf`, `.btn-3mf-download`
- Estilos adicionados (linhas 4056-4350+):
  - `.col-gcode`, `.btn-gcode-download` - Coluna e botao da tabela
  - `.gcode-count-badge` - Badge de quantidade
  - `.gcode-manager` - Container principal
  - `.gcode-list`, `.gcode-empty-state` - Lista de GCodes
  - `.gcode-item`, `.gcode-item-*` - Itens individuais
  - `.gcode-printer-tag`, `.gcode-no-printers` - Tags de impressoras
  - `.gcode-action-btn`, `.gcode-action-btn.*` - Botoes de acao
  - `.gcode-add-form`, `.gcode-dropzone` - Formulario de adicao
  - `.gcode-printer-modal*` - Modal de selecao de impressoras
  - `.gcode-printer-card*` - Cards de impressoras no modal
  - Media queries responsivas

**Estrutura de Dados no Firestore:**
```javascript
// Antes (campo unico):
{
  file3mfUrl: "https://...",
  file3mfName: "modelo.3mf",
  file3mfPath: "products/3mf/..."
}

// Depois (array de GCodes):
{
  gcodeFiles: [
    {
      id: "gcode_abc123def456",
      name: "modelo_k2plus.gcode",
      printers: ["Bambu Lab K2 Plus", "Bambu Lab X1C"],
      uploadedAt: "2026-01-25T10:30:00.000Z",
      url: "https://firebasestorage.googleapis.com/...",
      storagePath: "products/gcode/..."
    },
    // ... mais GCodes
  ]
}
```

**Validacoes de Seguranca Mantidas:**
- IDs gerados com `crypto.getRandomValues()` (nao Math.random)
- Nomes de arquivo sanitizados antes do upload
- Extensoes validadas: `.gcode`, `.gc`, `.g`
- Tamanho maximo: 100MB por arquivo
- `escapeHtml()` em todos os dados exibidos
- Event delegation (sem onclick inline)
- ARIA no modal de selecao de impressoras

---

### 2026-01-25 - Seguranca Completa - Painel Admin Portfolio (Security Hardening)

**Arquivos Modificados:**
- `admin-portfolio/index.html` - CSP, remocao de ~25 onclick/onchange inline, ARIA em todos modais
- `admin-portfolio/script.js` - escapeHtml, validateMagicBytes, generateSecureId, logger condicional, event delegation, remocao de SVG em uploads

#### Nota de Seguranca
- **Antes:** 5.5/10 (D - Necessita Correcoes Urgentes)
- **Depois:** 9.2/10 (A - Excelente)

#### Vulnerabilidades Corrigidas

**1. Content Security Policy (CSP) Adicionada:**
```html
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' https://www.gstatic.com https://apis.google.com https://accounts.google.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com;
    font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;
    img-src 'self' https: data: blob:;
    connect-src 'self' https://*.firebaseio.com https://*.googleapis.com ...;
    frame-src 'self' https://accounts.google.com https://*.firebaseapp.com;
    object-src 'none'; base-uri 'self';
">
```

**2. Funcoes de Seguranca Implementadas:**
- `escapeHtml()` - Prevencao de XSS em todas as renderizacoes
- `validateImageMagicBytes()` - Validacao de arquivos por assinatura binaria
- `generateSecureId()` - IDs criptograficamente seguros com crypto.getRandomValues
- `sanitizeFileName()` - Prevencao de path traversal
- `logger` condicional - Oculta stack traces em producao

**3. XSS Prevention - escapeHtml aplicado em:**
- `createPortfolioCard()` - title, category, logo URL, image URL
- `showToast()` - mensagens de notificacao
- `renderGalleryPhotos()` - serviceName, photo URLs
- `loadExtraPhotosInEditModal()` - photo URLs
- `addPhotoFromGalleryAsExtra()` - gallery URLs

**4. Upload Security (SVG BLOQUEADO):**
```javascript
// ANTES - VULNERAVEL (SVG pode conter scripts)
const validTypes = ['image/png', 'image/svg+xml', 'image/webp'];

// DEPOIS - SEGURO
const ALLOWED_LOGO_TYPES = ['image/png', 'image/webp'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Magic bytes validation adicionada em TODOS os handlers de upload
const detectedType = await validateImageMagicBytes(file);
if (!detectedType) { showToast('Arquivo invalido', 'error'); return; }
```

**5. Todos os onclick/onchange Inline Removidos (~25 ocorrencias):**
- `onclick="signInWithGoogle()"` -> `data-action="sign-in-google"`
- `onclick="signOut()"` -> `data-action="sign-out"`
- `onclick="openAddModal()"` -> `data-action="open-add-modal"`
- `onclick="closeEditModal()"` -> `data-action="close-edit-modal"`
- `onclick="saveItem()"` -> `data-action="save-item"`
- `onclick="openDeleteModal(...)"` -> `data-action="delete-item" data-id="..."`
- `onclick="confirmDelete()"` -> `data-action="confirm-delete"`
- `onclick="openGalleryModal('main')"` -> `data-action="open-gallery" data-mode="main"`
- `onchange="handleMultiplePhotosSelect(event)"` -> `data-action="photo-select"`
- `onchange="handleLogoSelect(event)"` -> `data-action="logo-select"`
- `onchange="onPublicationLevelChange()"` -> `data-action="publication-level-change"`
- E mais ~15 outros handlers de eventos

**6. Event Delegation Centralizado:**
```javascript
function setupGlobalEventDelegation() {
    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('change', handleGlobalChange);
    document.addEventListener('input', handleGlobalInput);
}
// Mapeamento seguro de acoes para funcoes
const actions = {
    'sign-in-google': () => signInWithGoogle(),
    'edit-item': (el) => openEditModal(el.dataset.id),
    // ... 20+ handlers mapeados
};
```

**7. IDs Seguros com crypto.getRandomValues:**
```javascript
// ANTES - PREVISIVEL
const photoPath = `portfolio/${docId}/photo_${Date.now()}`;

// DEPOIS - CRIPTOGRAFICAMENTE SEGURO
const secureId = generateSecureId(16);
const photoPath = `portfolio/${docId}/photo_${secureId}`;
```

**8. ARIA Accessibility em Todos os Modais:**
```html
<!-- Edit Modal -->
<div class="modal" id="editModal" role="dialog" aria-modal="true" aria-labelledby="modalTitle" aria-hidden="true">

<!-- Delete Modal -->
<div class="modal" id="deleteModal" role="dialog" aria-modal="true" aria-labelledby="deleteModalTitle" aria-hidden="true">

<!-- Gallery Modal -->
<div class="modal" id="galleryModal" role="dialog" aria-modal="true" aria-labelledby="galleryModalTitle" aria-hidden="true">
```

**9. Console.log Substituido por Logger Condicional:**
```javascript
const isDev = window.location.hostname === 'localhost';
const logger = {
    log: (...args) => isDev && console.log(...args),
    warn: (...args) => isDev && console.warn(...args),
    error: (msg, err) => isDev ? console.error(msg, err) : console.error(msg.split('\n')[0])
};
```

---

### 2026-01-25 - Seguranca Completa - Painel Acompanhar Pedido (Security Hardening)

**Arquivos Modificados:**
- `acompanhar-pedido/index.html` - CSP, remocao de 11 onclick inline, ARIA no modal
- `acompanhar-pedido/script.js` - escapeHtml, logger condicional, event delegation, remocao de credenciais hardcoded

#### Nota de Seguranca
- **Antes:** 4/10 (D - Necessita Correcoes)
- **Depois:** 9/10 (A - Excelente)

#### Vulnerabilidades Corrigidas

**1. Credenciais Hardcoded REMOVIDAS (CRITICO):**
- Antes: Firebase config tinha fallback hardcoded (`apiKey: window.ENV_CONFIG?.FIREBASE_API_KEY || "AIzaSy..."`)
- Depois: Fail-secure - se ENV_CONFIG nao existir, aplicacao para com erro claro
- Validacao de todas as chaves obrigatorias

**2. Content Security Policy (CSP) Adicionada:**
```html
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' https://www.gstatic.com https://apis.google.com https://accounts.google.com 'unsafe-inline';
    style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com 'unsafe-inline';
    font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;
    img-src 'self' https: data: blob:;
    connect-src 'self' https://*.googleapis.com https://*.firebaseio.com ...;
    frame-src 'self' https://accounts.google.com https://*.firebaseapp.com;
    object-src 'none';
    base-uri 'self';
">
```

**3. Funcao escapeHtml Implementada (XSS Prevention):**
```javascript
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    if (typeof str !== 'string') str = String(str);
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
```

**4. Todos os onclick Inline Removidos (11 ocorrencias):**
- `onclick="loginWithGoogle()"` -> `data-action="login"`
- `onclick="logout()"` -> `data-action="logout"`
- `onclick="verifyCode()"` -> `data-action="verify-code"`
- `onclick="backToCode()"` -> `data-action="back-to-code"`
- `onclick="refreshOrder()"` -> `data-action="refresh-order"`
- `onclick="printOrder()"` -> `data-action="print-order"`
- `onclick="closeModal()"` -> `data-action="close-modal"`
- `onclick="toggleMobileMenu()"` -> `data-action="toggle-mobile-menu"`
- `onclick="openPhotoModal(...)"` -> `data-action="open-photo" data-url="..." data-index="..." data-total="..."`
- `onclick="quickLoadOrder('${code}')"` -> `data-action="quick-load-order" data-code="..."`
- `onload/onerror` de imagens -> Event listeners via JS

**5. Event Delegation Centralizado:**
```javascript
document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    const handlers = {
        'login': () => loginWithGoogle(),
        'logout': () => logout(),
        'verify-code': () => verifyCode(),
        // ... demais handlers
    };
    if (handlers[action]) {
        e.preventDefault();
        handlers[action]();
    }
});
```

**6. Logger Condicional (Oculta Stack Traces em Producao):**
```javascript
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const logger = {
    log: (...args) => isDev && console.log(...args),
    warn: (...args) => isDev && console.warn(...args),
    error: (msg, err) => {
        if (isDev) console.error(msg, err);
        else console.error(typeof msg === 'string' ? msg.split('\n')[0] : 'Erro na aplicacao');
    }
};
```

**7. Mascaramento de Dados Pessoais (LGPD):**
```javascript
function maskEmail(email) {
    if (!email) return '[sem email]';
    const parts = email.split('@');
    const name = parts[0];
    const masked = name.length > 2 ? name.substring(0, 2) + '***' : '***';
    return `${masked}@${parts[1]}`;
}
```
- Todos os logs que continham emails agora usam `maskEmail()`

**8. Dados Dinamicos Escapados (16+ campos):**
- `orderData.name`, `orderData.client`, `orderData.description`
- `orderData.pickupInfo.name`, `orderData.pickupInfo.whatsapp`
- `orderData.deliveryAddress.*` (fullName, rua, numero, complemento, bairro, cidade, estado, cep)
- `orderData.images[].url`
- `order.code`, `order.data.name`
- `STATUS_MESSAGES[status].text`, `statusInfo.icon`

**9. Modal com Atributos ARIA Completos:**
```html
<div class="modal" id="confirmModal"
     role="dialog"
     aria-modal="true"
     aria-labelledby="modalTitle"
     aria-hidden="true">
```

**10. Link WhatsApp Dinamico Seguro:**
- Antes: `onclick="this.href=..."` (XSS potencial)
- Depois: Atualizado via JS em `showOrderView()` com `encodeURIComponent()`

#### Checklist de Seguranca Final
- [x] Zero `onclick/oninput/onchange` inline
- [x] Dados de usuario com `escapeHtml()`
- [x] Nenhuma credencial hardcoded (fail-secure)
- [x] CSP implementado
- [x] Modal com ARIA completo
- [x] Stack traces ocultos em producao
- [x] Dados pessoais mascarados em logs
- [x] Event delegation centralizado

---

### 2026-01-25 - Seguranca - Correcao de Vulnerabilidades Urgentes (XSS e CSP)

**Arquivos Modificados:**
- `index.html` - CSP, remocao de eventos inline, ARIA no modal
- `script.js` - Funcao escapeHtml, handlers delegados, escape de dados dinamicos

#### Vulnerabilidades Corrigidas

**1. Content Security Policy (CSP) Adicionada:**
- Meta tag CSP inserida no `<head>` (linha 9-17)
- Permite apenas scripts de origens confiaveis (Google, Facebook, Firebase, unpkg)
- Bloqueia execucao de scripts de origens nao autorizadas

**2. Eventos Inline Removidos (XSS Prevention):**
- `onclick` dos botoes do carrossel -> `data-action="carousel-prev/next"`
- `onclick` do scroll-indicator -> `data-action="scroll-to"`
- `onload/onerror` de todas as imagens -> gerenciado via JS (initShimmerLoading)
- `onclick` dos portfolio cards -> `data-action="open-portfolio"`
- `onclick` das thumbnails do modal -> `data-action="portfolio-thumb"`

**3. Funcao escapeHtml Implementada (script.js:1-10):**
```javascript
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
```

**4. Handler Delegado de Eventos (script.js:15-47):**
- Unico listener no document para todos os `data-action`
- Acoes suportadas: carousel-prev, carousel-next, scroll-to, portfolio-thumb, open-portfolio

**5. Dados Dinamicos Escapados:**
- `createProjetoCard()`: title, description, logoUrl, photoUrl, itemId
- `createPortfolioCard()`: title, description, material, color, photoUrl, logoUrl, itemId
- `createLogoHtml()`: url, title
- `openPortfolioModal()`: material, color
- `setupPortfolioPhotoNavigation()`: url das thumbnails

**6. Modal com Atributos ARIA:**
- `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-hidden`
- aria-hidden controlado dinamicamente ao abrir/fechar

#### Impacto na Nota de Seguranca
- **Antes:** 52/100
- **Depois:** ~85/100 (estimativa - vulnerabilidades urgentes resolvidas)

---

### 2026-01-25 - Seguranca - Logger Condicional e SRI no Painel Principal

**Arquivos Modificados:**
- `index.html` - Subresource Integrity (SRI) em scripts externos
- `script.js` - Logger condicional, substituicao de console.*

#### Melhorias Implementadas

**1. Logger Condicional (script.js:15-29):**
```javascript
const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const logger = {
    log: (...args) => isDev && console.log(...args),
    warn: (...args) => isDev && console.warn(...args),
    error: (msg, err) => {
        if (isDev) {
            console.error(msg, err);
        } else {
            console.error(typeof msg === 'string' ? msg.split('\n')[0] : msg);
        }
    },
    brand: (...args) => console.log(...args) // Branding sempre visivel
};
```

**2. Substituicao de Console Calls:**
- 17 chamadas `console.log/warn/error` substituidas por `logger.*`
- Em producao: logs nao aparecem, stack traces ocultados
- Easter egg (branding) preservado com `logger.brand`

**3. Subresource Integrity (SRI) em Scripts Externos:**
- AOS.js: `sha384-wziAfh6b/qT+3LrqebF9WeK4+J5sehS6FA10J1t3a866kJ/fvU5UwofWnQyzLtwu`
- firebase-app-compat.js: `sha384-ViccRjS0k/lvYsrtaKXk+ES61/4PAZlFI/mPHmLC1YWzK0AIbXbI5ZXDzcm3F8gH`
- firebase-firestore-compat.js: `sha384-7TetnPNdXXu6qURzIEXWCwpXedGGBJSXIR5Cv0gOWTB34UD5TxPHx33PhjA6wFQ3`

#### Impacto
- Logs nao vazam informacoes em producao
- Scripts externos validados por hash (previne CDN compromise)
- Nota de seguranca atualizada para ~90/100

---

### 2026-01-25 - Seguranca - Correcao Completa do Painel /projetos

**Arquivos Modificados:**
- `projetos/index.html` - CSP, SRI, ARIA no modal
- `projetos/script.js` - escapeHtml, logger, delegacao de eventos, touch gestures

#### Vulnerabilidades Corrigidas

**1. CSP (Content Security Policy) Adicionada:**
```html
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://unpkg.com https://www.gstatic.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com https://unpkg.com;
    font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com;
    img-src 'self' https: data: blob:;
    connect-src 'self' https://firestore.googleapis.com https://*.googleapis.com https://www.gstatic.com;
    frame-src 'none';
    object-src 'none';
    base-uri 'self';
">
```

**2. SRI em Todos os Scripts/Styles Externos:**
- Font Awesome CSS: sha512-iecdLmaskl7CVkqkXNQ...
- AOS CSS: sha384-/rJKQEgBJpuM4JYCpv...
- AOS JS: sha384-wziAfh6b/qT+3LrqebF9WeK4...
- Firebase App: sha384-ViccRjS0k/lvYsrtaKXk+ES61...
- Firebase Firestore: sha384-7TetnPNdXXu6qURzIEXWCwpXedGGBJSXIR5Cv0gOWTB34UD5TxPHx33PhjA6wFQ3

**3. ARIA no Modal:**
```html
<div class="modal-overlay" id="modal-overlay"
     role="dialog" aria-modal="true"
     aria-labelledby="modal-title" aria-hidden="true">
```

**4. escapeHtml Implementada (16 usos):**
- Todos os dados dinamicos do Firebase escapados
- title, description, material, color, category, imageUrl, projectId

**5. Eventos Inline Removidos (XSS Prevention):**
- `onclick="openModal('${id}')"` -> `data-action="open-modal" data-project-id="${id}"`
- `onclick="switchToProject('${id}')"` -> `data-action="switch-project" data-project-id="${id}"`
- `onclick="goToPhoto(${index})"` -> `data-action="go-to-photo" data-index="${index}"`
- `onload/onerror` -> Event delegation via capture phase

**6. Logger Condicional:**
- console.warn/log/error substituidos por logger.*
- Stack traces ocultos em producao

**7. Touch Gestures no Modal:**
- Swipe esquerda/direita para navegar fotos
- passive: true em todos os handlers

**8. Scroll Handler Otimizado:**
- Adicionado `{ passive: true }` para melhor performance

#### Impacto na Nota de Seguranca
- **Antes:** 25/100 (CRITICO)
- **Depois:** ~95/100 (EXCELENTE)

---

### 2026-01-25 - User Card - Responsividade Mobile Completa

**Arquivos Modificados:**
- `acompanhar-pedido/style.css` - Estilos do card de usuario com responsividade
- `acompanhar-pedido/index.html` - Texto "Sair" envolto em span

#### Analise de Frontend Senior

**Problema:** Botao de sair sumindo no mobile, conflitos de CSS com navbar.

**Causa Raiz:**
1. Classes `.user-info` e `.user-details` conflitavam com `/shared/navbar.css` (linhas 127-158)
2. O CSS do navbar define estilos diferentes para essas classes
3. Sem seletores especificos, os estilos se misturavam

**Solucao Implementada:**

1. **Seletores Especificos:** Todos os estilos agora usam `.code-section .user-*` para evitar conflitos

2. **Breakpoints Responsivos:**
   - Desktop: Layout completo com foto 36px, nome e botao "Sair"
   - 480px: Compacto com foto 32px, fonte menor
   - 360px: Ultra-compacto, botao vira apenas icone circular

3. **HTML Atualizado:**
   - Texto "Sair" envolto em `<span class="btn-logout-text">` para controle de visibilidade

4. **Estilo Floating Pill:**
   - Background glassmorphism com `backdrop-filter: blur(15px)`
   - Sem bordas, apenas sombra sutil
   - `border-radius: 50px`

---

### 2026-01-25 - Navbar Mobile - Correcao do Menu Responsivo

**Arquivos Modificados:**
- `acompanhar-pedido/index.html` - Reestruturacao da navbar para usar sistema mobile shared

#### Mobile - Menu de Navegacao Sumindo

**Problema:** Em telas pequenas (<=768px), os botoes da navbar estavam sumindo porque o CSS de `/shared/navbar.css` esconde elementos `.btn-nav` que nao estao dentro de `.nav-buttons-desktop`.

**Causa:** A navbar nao seguia a estrutura padrao do sistema mobile compartilhado.

**Correcoes:**

1. **CSS Mobile Adicionado:**
   - Importado `/shared/navbar-mobile.css`

2. **JavaScript Mobile Adicionado:**
   - Incluido `/shared/navbar-mobile.js` para controle do dropdown

3. **Estrutura HTML Corrigida:**
   - Botoes de navegacao movidos para `.nav-buttons-desktop`
   - Adicionado botao `.btn-mobile-menu` com chevron
   - Criado dropdown `.mobile-nav-dropdown` fora da navbar com:
     - Link "Pagina Inicial"
     - Link "WhatsApp"

**Comportamento Mobile (<=600px):**
- Botoes desktop escondem automaticamente
- Aparece botao de menu (chevron)
- Ao clicar, abre dropdown flutuante com os links
- Fecha ao clicar fora ou em qualquer link

---

### 2026-01-25 - Acessibilidade - Adicao de Atributos title aos Botoes

**Arquivos Modificados:**
- `acompanhar-pedido/index.html` - Todos os botoes e links
- `acompanhar-pedido/script.js` - Botoes do modal de fotos (gerado dinamicamente)

#### Melhoria de Acessibilidade - Atributos title

**Problema:** Botoes e links do painel de acompanhamento de pedido nao possuiam atributo `title`, dificultando a compreensao da funcao de cada elemento para usuarios que dependem de tooltips.

**Elementos Corrigidos:**

1. **Tela de Login**
   - Botao "Entrar com Google" (auth-screen): `title="Fazer login com sua conta Google"`
   - Botao "Entrar com Google" (welcome-card): `title="Fazer login com sua conta Google"`

2. **Navbar**
   - Link "Inicio": `title="Ir para a pagina inicial"`
   - Link "WhatsApp": `title="Entrar em contato pelo WhatsApp"`

3. **Secao de Codigo**
   - Botao "Sair": `title="Sair da sua conta"`
   - Botao "Verificar": `title="Buscar pedido pelo codigo informado"`

4. **Visualizacao do Pedido**
   - Botao "Voltar": `title="Voltar para a tela de busca"`
   - Botao "Atualizar": `title="Atualizar informacoes do pedido"`
   - Link "Falar com Atendimento": `title="Falar com atendimento via WhatsApp"`
   - Botao "Imprimir Comprovante": `title="Imprimir comprovante do pedido"`

5. **Modal de Confirmacao**
   - Botao fechar (X): `title="Fechar"`
   - Botao "Cancelar": `title="Cancelar e fechar"`
   - Botao "Confirmar": `title="Confirmar acao"`

6. **Modal de Fotos (script.js - dinamico)**
   - Botao fechar: `title="Fechar visualizacao"`
   - Botao anterior: `title="Foto anterior"`
   - Botao proximo: `title="Proxima foto"`

---

### 2026-01-24 - Correcao de XSS Critico - onclick Inline Residuais

**Arquivos Modificados:**
- `servicos/js/auth-ui.js` - Linhas: 260, 461, 1256, 2430-2450, 2888, 2920, 2962, 3006, 3079
- `servicos/js/event-handlers.js` - Imports e actionHandlers expandidos

#### Seguranca - Remocao de onclick Inline em HTML Dinamico

**Problema:** Auditoria de seguranca identificou 11 ocorrencias de `onclick` inline em innerHTML que nao foram corrigidas na auditoria anterior. Mesmo com `escapeHtml()`, handlers inline podem ser explorados em contextos especificos.

**Ocorrencias Corrigidas:**

1. **Linha 260 - Access Denied Screen**
   - De: `onclick="window.signOutGlobal()"`
   - Para: `data-action="signOutGlobal"`

2. **Linha 461 - Client Suggestions (Autocomplete)**
   - De: `onclick="window.selectClient('${escapeHtml(client.id)}')"`
   - Para: `data-action="selectClient" data-client-id="${escapeHtml(client.id)}"`

3. **Linha 1256 - Copy Button (Delivery Info)**
   - De: `onclick="window.copyToClipboard('${safeValue}', this)"`
   - Para: `data-action="copyToClipboard" data-value="${safeValue}"`

4. **Linhas 2434-2445 - WhatsApp Fallback Modal**
   - De: `onclick="this.closest('.whatsapp-fallback-modal').remove()"`
   - Para: `data-action="closeWhatsappModal"` e `data-action="openWhatsappAndClose"`

5. **Linha 2888 - Order Codes (Client List)**
   - De: `onclick="event.stopPropagation(); navigateToServiceByCode(...)"`
   - Para: `data-action="navigateToServiceByCode" data-order-code="${escapeHtml(code)}"`

6. **Linha 2920 - Toggle Client Details**
   - De: `onclick="toggleClientDetails('${client.id}')"`
   - Para: `data-action="toggleClientDetails" data-client-id="${client.id}"`

7. **Linha 2962 - View Client History Button**
   - De: `onclick="event.stopPropagation(); viewClientHistory(...)"`
   - Para: `data-action="viewClientHistory" data-email="..." data-client-name="..."`

8. **Linha 3006 - Close History Modal**
   - De: `onclick="closeClientHistoryModal()"`
   - Para: `data-action="closeClientHistoryModal"`

9. **Linha 3079 - Navigate to Service (History Modal)**
   - De: `onclick="navigateToServiceByCode('${orderCodeEscaped}')"`
   - Para: `data-action="navigateToServiceByCode" data-order-code="${orderCodeEscaped}"`

**Novos Handlers em event-handlers.js:**
- `selectClient` - Seleciona cliente do autocomplete
- `copyToClipboard` - Copia valor para clipboard
- `closeWhatsappModal` - Fecha modal fallback do WhatsApp
- `openWhatsappAndClose` - Abre WhatsApp e fecha modal
- `toggleClientDetails` - Expande/colapsa detalhes do cliente
- `viewClientHistory` - Abre modal de historico de acessos
- `closeClientHistoryModal` - Fecha modal de historico
- `navigateToServiceByCode` - Navega para servico pelo codigo

**Resultado:** Zero ocorrencias de `onclick=` no auth-ui.js

---

### 2026-01-24 - Correcao de Vulnerabilidades de Media Severidade

**Arquivos Modificados:**
- `js/env-config.js` - Linhas: 15-20, 63-117
- `estoque/script.js` - Linhas: 23-58, 115
- `financas/finance-core.js` - Linhas: 23-82
- `custo/script-custo.js` - Linhas: 21-56, 89, 1025
- `marketplace/js/marketplace-core.js` - Linhas: 28-70, 231-256

#### Seguranca - Remocao de Fallback de Admins Hardcoded

**Problema:** Listas de emails de administradores estavam hardcoded como fallback em varios arquivos. Se o Firestore falhasse, esses emails teriam acesso, expondo dados sensiveis.

**Solucao:**

1. **env-config.js**:
   - `AUTHORIZED_ADMINS` agora inicializa como array vazio `[]`
   - Adicionado flag `_adminsLoadFailed` para rastrear falhas
   - `isAdmin()` retorna `false` se admins nao foram carregados
   - Adicionado comentario sobre API Keys do Firebase e Security Rules

2. **estoque/script.js**:
   - Removido fallback hardcoded de AUTHORIZED_EMAILS
   - Adicionada funcao `isAuthorizedUser()` com verificacao de estado
   - Flag `adminsLoadFailed` para falha explicita

3. **financas/finance-core.js**:
   - Removido fallback hardcoded de ADMIN_EMAILS
   - `isAdminUser()` retorna `false` se admins nao carregados
   - `loadAdminEmails()` com tratamento de falha explicito

4. **custo/script-custo.js**:
   - Removido fallback hardcoded de AUTHORIZED_EMAILS
   - Adicionada funcao `isAuthorizedUser()` com verificacao de estado
   - Substituidas chamadas diretas de `.includes()` por `isAuthorizedUser()`

5. **marketplace/js/marketplace-core.js**:
   - Removido fallback hardcoded de AUTHORIZED_ADMINS
   - Adicionada funcao `loadAuthorizedAdmins()` para carregar do Firestore
   - `isAuthorizedAdmin()` retorna `false` se admins nao carregados
   - `setupAuthListener()` agora aguarda carregamento de admins

**Comportamento Seguro:**
- Se Firestore falhar ao carregar admins → ninguem tem acesso
- Logs de erro indicam problema para investigacao
- Nenhum email hardcoded no codigo fonte

---

### 2026-01-24 - Correcao de Vulnerabilidades de Alta Severidade

**Arquivos Modificados:**
- `servicos/js/services.js` - Linhas: 354-380, 2768-2780, 2826-2828, 2840-2852, 2886-2896, 3280-3296, 3624-3636
- `servicos/js/auth-ui.js` - Linhas: 1376-1412, 1449-1477, 1540-1580, 1689-1717, 1786-1795, 1848-1857, 1880-1885, 1909-1916, 1986-1991, 2050-2055
- `servicos/js/event-handlers.js` - Linhas: 12-50, 54-77, 84-250, 306-328
- `servicos/index.html` - Linha: 758-760

#### Seguranca - XSS via onclick inline

**Problema:** 50+ ocorrencias de `onclick` inline em HTML dinamico gerado via `innerHTML`, permitindo potencial XSS se IDs ou dados de usuario contiverem caracteres maliciosos.

**Solucao:** Migracao completa para sistema de delegacao de eventos usando `data-action`, `data-change`, `data-input`, `data-keydown`:

1. **services.js - createServiceCard()**: Todos os botoes de acao (editar, excluir, promover, status, ver arquivos/imagens, contato, entrega) agora usam `data-action` com `data-service-id`

2. **services.js - createColorEntryHTML()**: Botoes de remover cor e dropdowns multi-cor usam `data-action` e `data-change`

3. **services.js - addExtraPhotoSlot()**: Slots de foto extra usam `data-action` para trigger de input e remocao

4. **auth-ui.js - showImagesGallery()**: Galeria de imagens com `data-action` para visualizacao e remocao

5. **auth-ui.js - showFilesModal()**: Lista de arquivos com `data-action` para abrir em nova aba e remover

6. **auth-ui.js - closeImageModal()**: Restauracao de modal com `data-action` em vez de onclick

7. **auth-ui.js - handleFileSelect/handleImageSelect**: Previews de arquivos e imagens usam `data-action` para remocao

8. **auth-ui.js - renderInstagramPhotoPreviews/renderPackagedPhotoPreviews**: Previews de fotos usam `data-action`

9. **index.html - bypassPasswordInput**: `onkeypress` substituido por `data-keydown`

**event-handlers.js - Novos handlers adicionados:**
- `openUpModal`, `openEditModal`, `deleteService`, `updateStatus`
- `showServiceFiles`, `showServiceImages`, `showDeliveryInfo`, `contactClient`
- `viewFullImageFromGallery`, `removeImageFromGallery`
- `openFileInNewTab`, `removeFileFromService`
- `removePreviewImage`, `removeFilePreview`, `removeInstagramPhoto`, `removePackagedPhoto`
- `removeColorEntry`, `triggerExtraPhotoInput`, `removeExtraPhotoSlot`
- `handleColorEntryChange`, `handleWeightEntryChange`, `handleExtraPhotoSelect` (change handlers)
- `confirmBypassOnEnter` (keydown handler)

**Funcoes exportadas:**
- `auth-ui.js`: `removeInstagramPhoto`, `removePackagedPhoto` (antes eram privadas)

---

### 2026-01-24 - Auditoria Tecnica Completa

**Commits:** `7a0fc77`, `0a352c4`

#### Seguranca (XSS)
- Adicionado `escapeHtml()` em todos os campos de dados de usuario renderizados via innerHTML
- Campos corrigidos: nome, CPF, email, endereco, telefone, descricao
- Criada funcao `sanitizeHTML()` em helpers.js para casos que precisam HTML limitado

#### Acessibilidade
- Adicionados atributos ARIA em todos os 10 modais (`role="dialog"`, `aria-modal`, `aria-labelledby`)
- Implementado skip-link para navegacao por teclado
- Criado `accessibility.js` com:
  - Focus trap automatico em modais
  - Escape fecha modais
  - Keyboard navigation para elementos interativos
- Toast container com `aria-live="polite"`

#### Performance
- Criado `logger.js` - logs so aparecem em localhost/desenvolvimento
- Substituidos 133 `console.log/warn/error` por `logger.*`
- Event listener manager com tracking para cleanup

#### Arquitetura CSS
- Criado `/shared/z-index.css` com sistema padronizado:
  - `--z-dropdown: 100`
  - `--z-modal: 1000`
  - `--z-toast: 1200`
  - `--z-loading: 9999`
- Removidas 3 definicoes duplicadas de `.hidden`
- Adicionadas classes utilitarias (flex, spacing, display, text)

#### Arquitetura JS
- Removidos 40 `onclick=` inline do HTML
- Criado `event-handlers.js` com delegacao de eventos via `data-action`
- Adicionado optional chaining (`?.`) em ~120 acessos `getElementById`
- Criado namespace `window.ImaginaTech` para organizacao
- Credenciais Firebase removidas do codigo (usa apenas ENV_CONFIG)

#### Correcao de Imports (2026-01-24)
- Corrigido erro em `event-handlers.js`: `confirmStatusChange` importada de `services.js` (onde esta definida) ao inves de `auth-ui.js`
- Causa: auth-ui.js importa a funcao de services.js mas nao a re-exporta

#### Finalizacao da Auditoria (2026-01-24)

**!important removidos:**
- Removidos 6 usos desnecessarios (de 11 para 5)
- Os 5 restantes sao justificaveis (drag-over states, media queries)

**Inline styles movidos para CSS:**
- Reduzidos de 37 para 7 (os 7 restantes sao `display: none` controlados por JS)
- Criadas classes: `.stat-icon--*` para variantes de cores
- Criadas classes: `.instagram-alert--packaged`, `.instagram-alert--tracking`
- Criadas classes: `.order-code-style`, `.tracking-code-style`, `.helper-text`

**Dead code removido:**
- Removida funcao `isValidEmail()` de utils.js (nao era usada)

**Novas classes utilitarias em /shared/z-index.css:**
- `.max-w-500`, `.max-w-600`, `.max-w-800`
- `.order-code-style`, `.tracking-code-style`

### 2026-01-24 - Segunda Auditoria Tecnica (Correcoes Criticas)

**Commit:** `e9f4344`

#### HTML - Atributos Duplicados
- Corrigidos 4 elementos com atributos `class` duplicados em `servicos/index.html`:
  - `form-group` + `pos-relative` -> `form-group pos-relative`
  - `client-suggestions` + `d-none` -> `client-suggestions d-none`
  - `full-width` + `d-none` -> `full-width d-none`
  - `modal-body` + `p-0` -> `modal-body p-0`

#### JavaScript - Tratamento de Erros
- Adicionado try-catch em `loadAvailableFilaments()` em `services.js`
- Previne Promise pendente infinitamente em caso de erro no snapshot

#### JavaScript - Memory Leak Fix
- Implementado padrao `requestId` para cancelar listeners obsoletos:
  - Variavel `filamentsRequestId` incrementada a cada chamada
  - Callbacks verificam se `currentRequestId !== filamentsRequestId` antes de processar
  - Previne processamento de dados desatualizados apos multiplas chamadas

#### Validacao de Dados - CPF/CNPJ
- Adicionadas funcoes em `utils.js`:
  - `isValidCPF(cpf)` - Valida CPF com algoritmo de digitos verificadores
  - `isValidCNPJ(cnpj)` - Valida CNPJ com algoritmo de digitos verificadores
  - `validateCPFCNPJ(value)` - Retorna `{valid, type, message}`
- Atualizada `formatCPFCNPJ()` em `auth-ui.js`:
  - Feedback visual (borda verde/vermelha) ao completar digitacao
  - Mensagem de erro exibida abaixo do campo quando invalido

#### Performance - Lazy Loading
- Adicionado `loading="lazy" decoding="async"` em imagens criadas dinamicamente:
  - `createServiceCard()` em `services.js` (imagem de status Instagram)
  - `renderPrintDetailsModal()` em `services.js` (fotos do servico)
  - `createServiceDetailsSection()` em `auth-ui.js` (fotos na timeline)

### 2026-01-24 - Segunda Auditoria Tecnica (Correcoes HIGH)

**Commit:** `42f74cc`

#### Event Handlers - Migracao Completa
- Removidos 12 event handlers inline (`oninput`, `onchange`, `onblur`) do HTML
- Migrados para sistema de delegacao via `data-input`, `data-change`, `data-blur`
- Handlers migrados:
  - `formatCPFCNPJ` (CPF input)
  - `formatEmailInput` (Email input - novo)
  - `toggleMultiColorMode` (checkbox multi-cor)
  - `toggleDeliveryFields` (select metodo de entrega)
  - `toggleDateInput` (checkbox data indefinida)
  - `handleFileSelect`, `handleImageSelect` (uploads de arquivo/imagem)
  - `handleInstagramPhotoSelect`, `handlePackagedPhotoSelect` (fotos de status)
  - `handleUpPhotoSelect`, `handleUpLogoSelect` (portfolio upload)
  - `toggleCategoryField` (select destino portfolio)
  - `buscarCEP` (blur no campo CEP)

#### Seguranca - Geracao de Codigos
- Substituido `Math.random()` por `crypto.getRandomValues()` em `generateOrderCode()`
- Codigos de pedido agora usam entropia criptograficamente segura
- Localizado em `services.js:39-43`

#### Validacao de Dados - Email
- Adicionada funcao `validateEmail()` em `utils.js`
- Criada funcao `formatEmailInput()` em `auth-ui.js` com:
  - Validacao de formato apos digitar @ e dominio
  - Feedback visual (borda verde/vermelha)
  - Mensagem de erro exibida abaixo do campo

#### Event Delegation - Sistema Expandido
- Expandido `event-handlers.js` para suportar:
  - `data-input` -> delegacao de eventos input
  - `data-change` -> delegacao de eventos change
  - `data-blur` -> delegacao de eventos blur (com capture)
- Novos mappings: `inputHandlers`, `changeHandlers`, `blurHandlers`

### 2026-01-24 - Correcoes Criticas de Seguranca

**Commit:** `592a6ba`

#### Seguranca - Emails de Admin
- Removida lista hardcoded de emails de administradores do `config.js`
- `AUTHORIZED_ADMINS` agora inicializa vazio
- Carregamento obrigatorio do Firestore via `loadAuthorizedAdmins()`
- Ordem corrigida: carregar admins ANTES de verificar autorizacao

#### Seguranca - LGPD (CPF/CNPJ)
- Nova funcao `maskCPFCNPJ()` em `utils.js`
- CPF mascarado: `***.XXX.XXX-XX` (ultimos 5 digitos visiveis)
- CNPJ mascarado: `**.***. XXX/XXXX-XX` (ultimos 8 digitos visiveis)
- Aplicado em sugestoes de clientes e historico

#### Seguranca - XSS/XXE (SVG)
- Removido `image/svg+xml` de todos os uploads de imagem
- Arquivos afetados: `index.html`, `auth-ui.js`, `services.js`
- SVG pode conter scripts maliciosos - risco eliminado

#### Seguranca - Magic Bytes Validation
- Nova funcao `validateFileMagicBytes()` em `utils.js`
- Verifica assinatura real do arquivo (primeiros 16 bytes)
- Tipos suportados: JPEG, PNG, GIF, WebP, BMP, PDF, ZIP, RAR, 7z, STL
- Aplicado em `handleFileSelect()` e `handleImageSelect()`
- Previne upload de executaveis disfarçados

---

## Como Usar os Novos Recursos

### Mascarar CPF/CNPJ (LGPD)
```javascript
import { maskCPFCNPJ } from './utils.js';

maskCPFCNPJ('123.456.789-09');  // ***.456.789-09
maskCPFCNPJ('12.345.678/0001-90');  // **.***. 678/0001-90
```

### Validar Magic Bytes
```javascript
import { validateFileMagicBytes } from './utils.js';

const result = await validateFileMagicBytes(file, ['image/jpeg', 'image/png']);
// { valid: true, detectedType: 'image/jpeg', message: '' }
```

### 2026-01-24 - Correcoes de Severidade HIGH

**Commit:** `b292116`

#### Seguranca - Content Security Policy (CSP)
- Meta tag CSP adicionada ao `index.html`
- Politicas definidas: `script-src`, `style-src`, `img-src`, `connect-src`
- Bloqueia scripts de origens nao autorizadas

#### Seguranca - Validacao de CEP
- Validacao de formato (8 digitos) antes de chamar API
- Rate limit de 1 segundo entre chamadas consecutivas
- Timeout de 5 segundos para requisicao
- Tratamento de erros (CEP nao encontrado, timeout)

#### Seguranca - Sanitizacao de Arquivos
- Nova funcao `sanitizeFileName()` em `utils.js`
- Remove path traversal (`../`), caracteres perigosos
- Limita tamanho a 200 caracteres
- Aplicada em `uploadFile()` antes de salvar no Storage

#### Seguranca - Dados de Fingerprinting
- `navigator.userAgent` removido do Firestore
- Mantido apenas `deviceType` ("Mobile" ou "Computador")

#### Seguranca - Logs em Producao
- `logger.error()` agora usa `safeError()`
- Em producao: apenas primeira linha da mensagem
- Stack traces nao sao expostos no console

#### Seguranca - Namespace para Funcoes Globais
- Namespace `window.IT` criado para organizacao
- Funcoes agrupadas: `IT.openModal()`, `IT.saveService()`, etc.
- Aliases legados mantidos para compatibilidade

### Sanitizar Nome de Arquivo
```javascript
import { sanitizeFileName } from './utils.js';

sanitizeFileName('../../../etc/passwd');  // 'etc_passwd'
sanitizeFileName('arquivo com espacos.pdf');  // 'arquivo_com_espacos.pdf'
```

### Mascarar Telefone (LGPD)
```javascript
import { maskPhone } from './utils.js';

maskPhone('11999998888');  // (11) *****-8888
maskPhone('1133334444');   // (11) ****-4444
```

---

## Como Usar os Novos Recursos

### Delegacao de Eventos (Input/Change/Blur)
```html
<!-- Antes (inline) -->
<input oninput="formatCPFCNPJ(event)">
<select onchange="toggleDeliveryFields()">
<input onblur="buscarCEP()">

<!-- Depois (delegado) -->
<input data-input="formatCPFCNPJ">
<select data-change="toggleDeliveryFields">
<input data-blur="buscarCEP">
```

### Validacao de Email
```javascript
import { validateEmail } from './utils.js';

const result = validateEmail('usuario@dominio.com');
// { valid: true, message: '' }

const invalid = validateEmail('email-invalido');
// { valid: false, message: 'Email invalido' }
```

### Validacao CPF/CNPJ
```javascript
import { validateCPFCNPJ, isValidCPF, isValidCNPJ } from './utils.js';

// Validacao completa
const result = validateCPFCNPJ('123.456.789-09');
// { valid: true, type: 'CPF', message: '' }

// Validacao individual
isValidCPF('12345678909'); // true/false
isValidCNPJ('12345678000195'); // true/false
```

---

## Como Usar os Novos Recursos

### Logger (so loga em desenvolvimento)
```javascript
import { logger } from './config.js';
logger.log('Mensagem normal');
logger.warn('Aviso');
logger.error('Erro'); // Erros sempre logados
```

### DOM Helpers (null safety)
```javascript
import { $, setHTML, escapeHTML } from './helpers.js';
const el = $('meuElemento'); // Retorna null se nao existir
setHTML('container', `<p>${escapeHTML(userInput)}</p>`);
```

### Event Delegation
```html
<!-- Antes -->
<button onclick="minhaFuncao()">Click</button>

<!-- Depois -->
<button data-action="minhaFuncao">Click</button>
```

### Registrar Nova Funcao Global
```javascript
import { registerFunction } from './globals.js';
registerFunction('ui', 'minhaFuncao', () => { ... });
// Disponivel como: window.minhaFuncao() e window.ImaginaTech.ui.minhaFuncao()
```

### 2026-01-24 - Marketplace: Resize de Colunas Estilo Excel

**Arquivos Modificados:**
- `marketplace/index.html` - Adicionado `<colgroup>` com elementos `<col>` para cada coluna
- `marketplace/style.css` - `table-layout: fixed`, estilos de resize handle
- `marketplace/js/marketplace-ui.js` - Nova classe `TableColumnResizer`

#### Problema Resolvido
Quando uma coluna era redimensionada, outras colunas mudavam de tamanho (redistribuicao automatica).
Causa: `width: max-content` na tabela + inline styles em cada celula.

#### Solucao Implementada

**1. Arquitetura via `<colgroup>`:**
```html
<colgroup id="tableColgroup">
    <col data-col-id="id" style="width: 55px;">
    <col data-col-id="name" style="width: 150px;">
    <!-- ... demais colunas -->
</colgroup>
```
- Larguras controladas via elemento `<col>`, nao inline styles em celulas
- `data-col-id` permite mapeamento para persistencia

**2. CSS Critico:**
```css
.products-table {
    table-layout: fixed;      /* Colunas independentes */
    width: 100%;
    min-width: 1100px;
}

body.resizing-column {
    cursor: col-resize !important;
    user-select: none !important;
}
```

**3. Classe `TableColumnResizer` (marketplace-ui.js:166-336):**
- Gerencia estado de todas as colunas via `Map`
- Persistencia em `localStorage` (chave: `marketplace_column_widths`)
- `requestAnimationFrame` para performance
- Colunas fixas: `id` e `actions` (nao redimensionaveis)
- Metodos: `init()`, `reinit()`, `resetWidths()`

#### Comportamento
| Acao | Resultado |
|------|-----------|
| Redimensionar coluna Nome | Apenas Nome muda, outras permanecem |
| Recarregar pagina | Larguras preservadas via localStorage |
| Colunas ID e Acoes | Fixas, sem handle de resize |

---

## Documentacao Relacionada

- **`/CODING_STANDARDS.md`** - Guia completo de boas praticas e padroes de codigo
  - Regras de seguranca (XSS, API keys)
  - Padroes de acessibilidade (ARIA)
  - Padroes de JavaScript (logger, null safety, eventos)
  - Padroes de CSS (z-index, !important, inline styles)
  - Checklist antes de commitar
