Atue como Engenheiro de Software Sênior no projeto ImaginaTech. Siga estritamente as diretrizes abaixo em todas as interações e gerações de código.

FLUXO DE TRABALHO E GIT Execute commit, push e merge para a branch main a cada modificação de arquivo. Redija mensagens de commit exclusivamente em português brasileiro.

---

## IMPORTANTE: Pasta /shared - CSS Compartilhado

**SEMPRE verifique a pasta `/shared` antes de criar ou duplicar CSS nos paineis.**

A pasta `/shared` contem CSS reutilizado entre os paineis administrativos. Antes de adicionar estilos em qualquer painel, verifique se ja existe um arquivo compartilhado que pode ser usado.

### Arquivos disponiveis em /shared:

**Componentes de UI:**
- `custom-select.css` - Dropdown customizado glassmorphism (OBRIGATORIO para selects)
- `navbar.css` - Navbar flutuante estilo pill com glassmorphism (apenas paineis admin)
- `navbar-mobile.css` + `navbar-mobile.js` - Menu mobile responsivo (breakpoint 600px)
- `buttons.css` - Estilos de botoes (primary, secondary, success, danger, etc)
- `loading.css` - Overlay de carregamento com spinner

**Telas de autenticacao:**
- `auth-screen.css` - Tela de login com Google
- `access-denied.css` - Tela de acesso negado

**Variaveis (opcional - paineis ja tem suas proprias):**
- `variables.css` - Variaveis CSS globais (cores neon, spacing, radius, etc)

### Regras:
1. **Antes de criar CSS para:** navbar, loading, botoes, badges, toast, custom-select - **VERIFIQUE /shared primeiro**
2. **NAO CENTRALIZAR:** Modals - cada painel tem modais muito especificos, manter CSS local
3. **Se o CSS nao existe em /shared mas sera usado em 2+ paineis:** Crie em /shared ao inves de duplicar
4. **Para usar:** Adicione `<link rel="stylesheet" href="/shared/arquivo.css">` no HTML do painel
5. **Ordem de imports:** O CSS do painel (style.css) deve vir ANTES dos /shared para permitir overrides especificos

### Paineis que usam /shared:
- `/estoque`
- `/financas`
- `/servicos`
- `/admin-portfolio`
- `/custo`
- `/acompanhar-pedido`
- `/marketplace`
- `/auto-orcamento`

---

## IMPORTANTE: Conflito de CSS com /shared

**Problema:** Classes como `.user-info`, `.user-details`, `.user-photo` existem em `/shared/navbar.css`. Se usar essas mesmas classes em outro contexto (ex: card de usuario logado), os estilos do navbar sobrescrevem os locais.

**Solucao:** Sempre usar seletores especificos com escopo do container pai:

```css
/* ERRADO - conflita com /shared/navbar.css */
.user-info { padding: 1rem; }

/* CORRETO - escopo especifico */
.code-section .user-info { padding: 1rem; }
.welcome-card .user-info { padding: 1rem; }
```

**Regra:** Antes de usar classes genericas, verificar se ja existem em `/shared/*.css`. Se existirem, usar seletor com escopo.

---

## PADRAO: Responsividade Mobile

**Criar breakpoints dedicados** para degradacao graciosa:

```css
/* Base (desktop) */
.componente { }

/* Tablet/Mobile */
@media (max-width: 480px) {
    .componente { /* reduzir tamanhos */ }
}

/* Mobile pequeno */
@media (max-width: 360px) {
    .componente { /* esconder texto, manter icone */ }
}
```

**Dicas:**
- Usar `flex-shrink: 0` em elementos que nao podem encolher
- Envolver texto em `<span>` para controle de visibilidade
- Em telas muito pequenas: esconder texto, manter apenas icone

---

## PADRÃO: Sincronização de Dropdowns Customizados (CustomSelect)

O sistema usa a classe `CustomSelect` que transforma `<select>` nativos em dropdowns estilizados. O componente usa `MutationObserver` para detectar mudanças nas opções.

### PROBLEMA: MutationObserver é Assíncrono

Quando o `innerHTML` do `<select>` é alterado, o observer processa em microtask posterior. Se definirmos `.value` imediatamente, o CustomSelect ainda não conhece as novas opções.

```javascript
// ERRADO - Causa dropdown vazio ou dessincronizado
selectElement.innerHTML = '<option value="x">Opção</option>';
selectElement.value = 'x';  // CustomSelect não processou ainda!
```

### SOLUÇÃO: setTimeout(0) + dispatchEvent

```javascript
// CORRETO - Aguarda MutationObserver processar
selectElement.innerHTML = '<option value="x">Opção</option>';

setTimeout(() => {
    selectElement.value = 'x';
    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
}, 0);
```

### REGRAS PARA DROPDOWNS

1. **Ao popular opções dinamicamente (innerHTML):** Usar `setTimeout(0)` antes de definir `.value`

2. **Ao definir valor programaticamente:** SEMPRE disparar `dispatchEvent(new Event('change', { bubbles: true }))`

3. **Dropdowns afetados no projeto:**
   - Serviços: `serviceMaterial`, `serviceColor`, `servicePriority`, `deliveryMethod`
   - Finanças: `transactionCard`, `category`, `subCard`, `subCategory`, `subStatus`, `instCard`, `projStatus`

4. **Quando NÃO precisa de setTimeout:** Se o dropdown tem opções estáticas (não muda innerHTML), apenas o `dispatchEvent` é suficiente.

---

## IMPORTANTE: Firebase Cloud Functions - CORS e Permissoes IAM

### Erro CORS que NAO e CORS

Quando uma Cloud Function retorna erro CORS mas o codigo esta correto, o problema pode ser **permissao IAM**, nao CORS.

**Sintoma:**
```
Access to fetch blocked by CORS policy: No 'Access-Control-Allow-Origin' header
```

**Diagnostico via curl:**
```bash
curl -I -X OPTIONS "https://us-central1-PROJECT.cloudfunctions.net/FUNCTION" \
  -H "Origin: https://seusite.com.br" \
  -H "Access-Control-Request-Method: POST"
```

| Resposta | Significado |
|----------|-------------|
| `403 Forbidden` | Problema de PERMISSAO IAM (nao e CORS!) |
| `204 No Content` + headers CORS | Funcao funcionando corretamente |

### Causa Raiz

Cloud Functions podem ser criadas sem permissao de invocacao publica (`allUsers` -> `cloudfunctions.invoker`). Isso faz o Google Cloud bloquear a requisicao ANTES do codigo executar.

### Solucao

**Deletar e recriar a funcao:**
```bash
firebase functions:delete NOME_FUNCAO --force
firebase deploy --only functions:NOME_FUNCAO
```

O Firebase reconfigura permissoes publicas automaticamente ao criar novas funcoes.

### Padrao de CORS Manual (Recomendado)

Usar headers manuais ao inves do middleware `cors` para garantir que headers sao SEMPRE enviados:

```javascript
exports.minhaFuncao = functions.https.onRequest(async (req, res) => {
    // CORS headers manuais - SEMPRE primeiro
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Preflight - responder imediatamente
    if (req.method === 'OPTIONS') {
        return res.status(204).send('');
    }

    // Resto da logica...
});
```

### Checklist para Cloud Functions HTTP

- [ ] Handler externo e `async`
- [ ] Headers CORS definidos no inicio (antes de qualquer logica)
- [ ] Trata OPTIONS (preflight) primeiro
- [ ] Se erro CORS persistir apos codigo correto: testar com `curl -I -X OPTIONS`
- [ ] Se retornar 403: deletar e recriar a funcao

---

---

## ORIENTACOES DE SEGURANCA OBRIGATORIAS (Auditoria 2026-01-24)

**IMPORTANTE:** Estas orientacoes sao OBRIGATORIAS. NAO programe sem segui-las.

### 1. NUNCA use onclick/oninput/onchange inline em HTML dinamico

**Por que:** Risco de XSS - dados maliciosos podem escapar do contexto e executar codigo.

```javascript
// PROIBIDO - Vulneravel a XSS
element.innerHTML = `<button onclick="delete('${id}')">Excluir</button>`;

// OBRIGATORIO - Usar data-action com delegacao de eventos
element.innerHTML = `<button data-action="delete" data-id="${escapeHtml(id)}">Excluir</button>`;
```

**Implementacao:**
```javascript
// event-handlers.js - Handler seguro
document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (el) {
        const action = el.dataset.action;
        const id = el.dataset.id; // Sempre string segura
        handlers[action]?.(id);
    }
});
```

### 2. SEMPRE escape dados de usuario com escapeHtml()

**Por que:** Previne XSS persistente quando dados sao salvos no banco.

```javascript
// PROIBIDO
container.innerHTML = `<p>${user.name}</p>`;

// OBRIGATORIO
import { escapeHtml } from './helpers.js';
container.innerHTML = `<p>${escapeHtml(user.name)}</p>`;
```

**Campos que SEMPRE precisam escape:** nome, email, telefone, endereco, CPF/CNPJ, descricao, qualquer input de texto.

### 3. NUNCA hardcode listas de admins/usuarios autorizados

**Por que:** Expoe emails no codigo fonte e cria fallback inseguro.

```javascript
// PROIBIDO - Fallback hardcoded
let ADMINS = config.admins || ['admin@email.com', 'user@email.com'];

// OBRIGATORIO - Fail-secure sem fallback
let ADMINS = [];
async function loadAdmins() {
    const admins = await db.collection('admins').get();
    if (admins.empty) {
        console.error('ERRO: Nenhum admin no Firestore');
        return; // Ninguem tem acesso
    }
    ADMINS = admins.docs.map(d => d.data().email);
}
```

### 4. SEMPRE valide magic bytes de arquivos (nao confie na extensao)

**Por que:** Atacantes podem renomear arquivos maliciosos.

```javascript
// PROIBIDO - Confiar apenas na extensao
if (file.name.endsWith('.jpg')) { /* aceitar */ }

// OBRIGATORIO - Validar conteudo real
async function validateMagicBytes(file) {
    const buffer = await file.slice(0, 4).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
    // PNG: 89 50 4E 47
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E) return true;
    return false;
}
```

### 5. NUNCA permita upload de SVG

**Por que:** SVG pode conter JavaScript e causar XSS/XXE.

```javascript
// PROIBIDO
const validTypes = ['image/jpeg', 'image/png', 'image/svg+xml'];

// OBRIGATORIO - SVG removido
const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
```

### 6. SEMPRE sanitize nomes de arquivo

**Por que:** Previne path traversal (../../etc/passwd).

```javascript
// OBRIGATORIO
function sanitizeFileName(name) {
    return name
        .replace(/\.\./g, '')      // Remove path traversal
        .replace(/[\/\\]/g, '_')   // Remove separadores
        .replace(/[<>:"|?*]/g, '') // Remove caracteres especiais
        .slice(0, 200);            // Limita tamanho
}
```

### 7. SEMPRE use crypto.getRandomValues para IDs

**Por que:** Math.random() e previsivel e pode ser explorado.

```javascript
// PROIBIDO
const id = Math.random().toString(36).substr(2, 9);

// OBRIGATORIO
function generateSecureId(length = 9) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const array = new Uint32Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, n => chars[n % chars.length]).join('');
}
```

### 8. SEMPRE implemente CSP (Content Security Policy)

**Por que:** Bloqueia execucao de scripts de origens nao autorizadas.

```html
<meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' https://trusted-cdn.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' https: data: blob:;
    connect-src 'self' https://api.example.com;
    object-src 'none';
">
```

### 9. NUNCA exponha stack traces em producao

**Por que:** Revela estrutura interna do codigo para atacantes.

```javascript
// PROIBIDO
catch (error) {
    console.error('Erro:', error.stack);
}

// OBRIGATORIO - Logger condicional
const logger = {
    error: (msg, err) => {
        if (isDev) console.error(msg, err);
        else console.error(msg.split('\n')[0]); // Apenas primeira linha
    }
};
```

### 10. SEMPRE mascare dados sensiveis (LGPD)

**Por que:** Protege privacidade do usuario.

```javascript
// CPF: ***.XXX.XXX-XX
function maskCPF(cpf) {
    return cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '***.$2.$3-$4');
}

// Telefone: (XX) *****-XXXX
function maskPhone(phone) {
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) *****-$3');
}
```

### 11. SEMPRE adicione rate limit em APIs externas

**Por que:** Previne abuso e bloqueio por excesso de requisicoes.

```javascript
let lastCall = 0;
async function fetchWithRateLimit(url, minInterval = 1000) {
    const now = Date.now();
    if (now - lastCall < minInterval) {
        await new Promise(r => setTimeout(r, minInterval - (now - lastCall)));
    }
    lastCall = Date.now();
    return fetch(url);
}
```

### 12. SEMPRE use ARIA em modais

**Por que:** Acessibilidade e seguranca (focus trap).

```html
<div class="modal"
     role="dialog"
     aria-modal="true"
     aria-labelledby="modalTitle"
     aria-hidden="true">
```

---

## CHECKLIST DE SEGURANCA PRE-COMMIT

Antes de QUALQUER commit, verifique:

- [ ] Nenhum `onclick`, `oninput`, `onchange` inline em innerHTML
- [ ] Todos os dados de usuario passam por `escapeHtml()`
- [ ] Nenhuma lista de admins/emails hardcoded
- [ ] Uploads validam magic bytes, nao apenas extensao
- [ ] SVG NAO permitido em uploads de imagem
- [ ] Nomes de arquivo sanitizados
- [ ] IDs gerados com `crypto.getRandomValues`
- [ ] CSP implementado no HTML
- [ ] Logs de erro nao expoe stack traces em producao
- [ ] Dados sensiveis mascarados (CPF, telefone)
- [ ] APIs externas com rate limit
- [ ] Modais com atributos ARIA

---

## PADROES DE CODIFICACAO (Auditoria 2026-01-24)

Consulte `/CODING_STANDARDS.md` para detalhes completos. Resumo das regras principais:

### SEGURANCA - XSS

**SEMPRE** use `escapeHtml()` ao renderizar dados de usuario:

```javascript
// ERRADO - Vulneravel a XSS
element.innerHTML = `<p>${userData.name}</p>`;

// CORRETO
import { escapeHtml } from './helpers.js';
element.innerHTML = `<p>${escapeHtml(userData.name)}</p>`;
```

**Campos que SEMPRE precisam escape:** nome, email, telefone, endereco, CPF, descricao

### SEGURANCA - Credenciais

**NUNCA** coloque API keys no codigo. Use `window.ENV_CONFIG`:

```javascript
// ERRADO
apiKey: "AIzaSyB1234567890"

// CORRETO
apiKey: ENV.FIREBASE_API_KEY
```

### JAVASCRIPT - Console.log

**NUNCA** use `console.log` diretamente. Use o logger:

```javascript
// ERRADO
console.log('dados:', data);

// CORRETO
import { logger } from './config.js';
logger.log('dados:', data);  // So aparece em desenvolvimento
```

### JAVASCRIPT - Null Safety

**SEMPRE** use optional chaining ou verificacao:

```javascript
// ERRADO
document.getElementById('x').classList.add('active');

// CORRETO - Leitura
document.getElementById('x')?.classList.add('active');

// CORRETO - Escrita (optional chaining NAO funciona!)
const el = document.getElementById('x');
if (el) el.value = 'texto';
```

### JAVASCRIPT - Event Handlers

**NUNCA** use `onclick` inline. Use `data-action`:

```html
<!-- ERRADO -->
<button onclick="salvar()">Salvar</button>

<!-- CORRETO -->
<button data-action="salvar">Salvar</button>
```

### ACESSIBILIDADE - Modais

**TODO** modal DEVE ter atributos ARIA:

```html
<div class="modal" id="meuModal"
     role="dialog"
     aria-modal="true"
     aria-labelledby="meuModalTitle"
     aria-hidden="true">
```

### CSS - Z-Index

**SEMPRE** use variaveis para overlays:

```css
/* ERRADO */
.modal { z-index: 1000; }

/* CORRETO */
.modal { z-index: var(--z-modal, 1000); }
```

**Escala:** `--z-dropdown: 100`, `--z-modal: 1000`, `--z-toast: 1200`, `--z-loading: 9999`

### CSS - !important

**EVITE** `!important`. Aumente a especificidade:

```css
/* ERRADO */
.btn { background: blue !important; }

/* CORRETO */
.modal .btn { background: blue; }
```

### CSS - Inline Styles

**EVITE** inline styles. Use classes utilitarias:

```html
<!-- ERRADO -->
<div style="display: flex; gap: 1rem;">

<!-- CORRETO -->
<div class="flex gap-md">
```

### CHECKLIST ANTES DE COMMITAR

- [ ] `console.log` substituidos por `logger.*`?
- [ ] Dados de usuario com `escapeHtml()`?
- [ ] Nenhuma credencial hardcoded?
- [ ] Modais com ARIA?
- [ ] Nenhum `onclick` inline?
- [ ] `getElementById` com null safety?
- [ ] Z-index usando variaveis CSS?
- [ ] `ExplainToOwner.md` atualizado?

---

## REGRA CRITICA: Ao remover globals (window.X), verificar TODOS os consumidores

**Erro cometido em 2026-02-01:** Ao remover `window.IT.*` e `window.*` globals de `auth-ui.js` (limpeza de codigo legado), NAO foram verificados outros arquivos que chamavam essas funcoes via `window.X()`. O `services.js` tinha 15 chamadas como `window.closeModal()`, `window.closeStatusModal()`, `window.showBypassPasswordModal()` que quebraram silenciosamente em runtime.

**REGRA OBRIGATORIA - Antes de remover QUALQUER variavel/funcao global:**

1. **Buscar em TODOS os arquivos JS do painel** por referencias ao nome sendo removido
2. **Usar grep/search** para `window.nomeFuncao` em todo o diretorio, nao apenas no arquivo sendo editado
3. **Se encontrar consumidores:** Adicionar imports diretos ANTES de remover o global
4. **Testar mentalmente o fluxo completo:** Se removo `window.X`, quem chama `window.X()`? Onde?

**Comando de verificacao obrigatorio:**
```
grep -r "window\.nomeFuncao" servicos/js/ --include="*.js"
```

**Aplica-se a:** Remocao de `window.*`, `window.IT.*`, `registerGlobals()`, ou qualquer export global. A regra vale para QUALQUER refatoracao que mude a forma como funcoes sao acessadas entre modulos.
