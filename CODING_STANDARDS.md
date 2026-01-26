# Padrao de Codificacao - ImaginaTech

Este documento define as regras e boas praticas de desenvolvimento para o projeto ImaginaTech.
Siga estas orientacoes para manter a qualidade, seguranca e consistencia do codigo.

---

## Indice

1. [Seguranca](#1-seguranca)
2. [Acessibilidade](#2-acessibilidade)
3. [JavaScript](#3-javascript)
4. [CSS](#4-css)
5. [HTML](#5-html)
6. [Organizacao de Codigo](#6-organizacao-de-codigo)
7. [Git e Commits](#7-git-e-commits)

---

## 1. Seguranca

### 1.1 Prevencao de XSS (Cross-Site Scripting)

**NUNCA** insira dados de usuario diretamente no HTML via `innerHTML`.

```javascript
// ERRADO - Vulneravel a XSS
element.innerHTML = `<p>Nome: ${userData.name}</p>`;
element.innerHTML = `<span>${clienteNome}</span>`;

// CORRETO - Usar escapeHtml()
import { escapeHtml } from './helpers.js';
element.innerHTML = `<p>Nome: ${escapeHtml(userData.name)}</p>`;
element.innerHTML = `<span>${escapeHtml(clienteNome)}</span>`;
```

**Campos que SEMPRE precisam de escape:**
- Nome do cliente
- Email
- Telefone
- Endereco (rua, cidade, CEP)
- CPF/CNPJ
- Descricao/Observacoes
- Qualquer campo de texto livre

**Quando NAO precisa de escape:**
- IDs gerados pelo sistema
- Valores de enums (status, tipo)
- Datas formatadas pelo sistema
- Numeros

### 1.2 Credenciais e API Keys

**NUNCA** coloque credenciais diretamente no codigo.

```javascript
// ERRADO - Credenciais expostas no codigo fonte
const firebaseConfig = {
    apiKey: "AIzaSyB1234567890abcdefg",  // NUNCA FACA ISSO!
    authDomain: "projeto.firebaseapp.com"
};

// CORRETO - Usar ENV_CONFIG
const ENV = window.ENV_CONFIG || {};
const firebaseConfig = {
    apiKey: ENV.FIREBASE_API_KEY,
    authDomain: ENV.FIREBASE_AUTH_DOMAIN
};
```

**Regras:**
- Credenciais ficam em `/js/env-config.js` (gitignore)
- Usar `window.ENV_CONFIG` para acessar
- Nunca commitar arquivos com credenciais reais

---

## 2. Acessibilidade

### 2.1 Modais

Todo modal DEVE ter atributos ARIA:

```html
<!-- ERRADO -->
<div class="modal" id="meuModal">
    <div class="modal-content">
        <h2>Titulo</h2>
    </div>
</div>

<!-- CORRETO -->
<div class="modal" id="meuModal"
     role="dialog"
     aria-modal="true"
     aria-labelledby="meuModalTitle"
     aria-hidden="true">
    <div class="modal-content">
        <h2 id="meuModalTitle">Titulo</h2>
        <button class="modal-close" aria-label="Fechar modal">
            <i class="fas fa-times" aria-hidden="true"></i>
        </button>
    </div>
</div>
```

**Checklist para modais:**
- [ ] `role="dialog"`
- [ ] `aria-modal="true"`
- [ ] `aria-labelledby` apontando para o titulo
- [ ] `aria-hidden="true"` (quando fechado)
- [ ] Botao de fechar com `aria-label`
- [ ] Icones decorativos com `aria-hidden="true"`

### 2.2 Botoes e Links

```html
<!-- ERRADO - Botao sem contexto -->
<button><i class="fas fa-trash"></i></button>

<!-- CORRETO - Com aria-label -->
<button aria-label="Excluir servico">
    <i class="fas fa-trash" aria-hidden="true"></i>
</button>

<!-- CORRETO - Com texto visivel -->
<button>
    <i class="fas fa-trash" aria-hidden="true"></i>
    <span>Excluir</span>
</button>
```

### 2.3 Notificacoes (Toast)

```html
<!-- Container de toasts DEVE ter aria-live -->
<div id="toastContainer" class="toast-container"
     aria-live="polite"
     aria-atomic="true">
</div>
```

### 2.4 Skip Link (Navegacao por Teclado)

Adicionar no inicio do body:

```html
<a href="#main-content" class="skip-link">
    Pular para o conteudo principal
</a>
```

---

## 3. JavaScript

### 3.1 Console.log em Producao

**NUNCA** use `console.log` diretamente. Use o sistema de logger.

```javascript
// ERRADO - Logs aparecem em producao
console.log('Dados carregados:', data);
console.error('Erro:', error);

// CORRETO - Usar logger (so aparece em desenvolvimento)
import { logger } from './config.js';
logger.log('Dados carregados:', data);
logger.error('Erro:', error);  // Erros sempre aparecem
```

**Niveis de log:**
- `logger.log()` - Informacoes gerais (so em dev)
- `logger.warn()` - Avisos (so em dev)
- `logger.error()` - Erros (sempre aparece)
- `logger.debug()` - Debug detalhado (so em dev)

### 3.2 getElementById e Null Safety

**SEMPRE** use optional chaining ou verificacao de null.

```javascript
// ERRADO - Pode causar erro se elemento nao existir
document.getElementById('meuElemento').classList.add('active');
document.getElementById('meuInput').value = 'texto';

// CORRETO - Optional chaining para leitura
document.getElementById('meuElemento')?.classList.add('active');
const valor = document.getElementById('meuInput')?.value || '';

// CORRETO - Verificacao explicita para escrita
const elemento = document.getElementById('meuElemento');
if (elemento) {
    elemento.value = 'texto';
    elemento.style.display = 'block';
}

// CORRETO - Usar helper $()
import { $ } from './helpers.js';
const elemento = $('meuElemento');  // Retorna null se nao existir
if (elemento) {
    elemento.value = 'texto';
}
```

**ATENCAO:** Optional chaining (`?.`) NAO funciona para atribuicoes!

```javascript
// ERRO DE SINTAXE!
document.getElementById('x')?.value = 'texto';  // SyntaxError!

// CORRETO
const el = document.getElementById('x');
if (el) el.value = 'texto';
```

### 3.3 Event Handlers (onclick)

**NUNCA** use `onclick` inline no HTML. Use delegacao de eventos.

```html
<!-- ERRADO - onclick inline -->
<button onclick="minhaFuncao()">Clique</button>
<button onclick="salvar(123)">Salvar</button>

<!-- CORRETO - data-action -->
<button data-action="minhaFuncao">Clique</button>
<button data-action="salvar" data-id="123">Salvar</button>
```

```javascript
// Registrar handler em event-handlers.js
import { registerAction } from './event-handlers.js';

registerAction('minhaFuncao', () => {
    // codigo aqui
});

registerAction('salvar', (event, element) => {
    const id = element.dataset.id;
    // codigo aqui
});
```

### 3.4 Funcoes Globais

Use o namespace `ImaginaTech` para organizar funcoes globais.

```javascript
// ERRADO - Poluir window global
window.minhaFuncao = () => { ... };
window.outraFuncao = () => { ... };

// CORRETO - Usar namespace organizado
import { registerFunction } from './globals.js';

registerFunction('ui', 'minhaFuncao', () => { ... });
registerFunction('services', 'outraFuncao', () => { ... });

// Acesso:
// window.ImaginaTech.ui.minhaFuncao()
// window.minhaFuncao() (compatibilidade)
```

### 3.5 Imports e Exports

Verifique sempre se a funcao esta sendo exportada do arquivo correto.

```javascript
// ERRADO - Importar de arquivo que nao exporta
import { confirmStatusChange } from './auth-ui.js';  // Se auth-ui nao exporta!

// CORRETO - Importar da origem real
import { confirmStatusChange } from './services.js';  // Onde esta definida
```

**Dica:** Se uma funcao e definida em A.js, importada em B.js, e voce quer usar em C.js:
- Importe diretamente de A.js (origem)
- OU adicione re-export em B.js: `export { funcao } from './A.js';`

---

## 4. CSS

### 4.1 Z-Index

**SEMPRE** use variaveis CSS para z-index de elementos de overlay.

```css
/* ERRADO - Valores magicos */
.modal { z-index: 1000; }
.dropdown { z-index: 100; }
.toast { z-index: 9999; }

/* CORRETO - Usar variaveis do sistema */
.modal { z-index: var(--z-modal, 1000); }
.dropdown { z-index: var(--z-dropdown, 100); }
.toast { z-index: var(--z-toast, 1200); }
.loading { z-index: var(--z-loading, 9999); }
```

**Escala de z-index (definida em /shared/z-index.css):**
| Variavel | Valor | Uso |
|----------|-------|-----|
| `--z-base` | 0 | Elementos normais |
| `--z-raised` | 1 | Elementos levemente elevados |
| `--z-dropdown` | 100 | Menus dropdown |
| `--z-sticky` | 200 | Headers sticky |
| `--z-fixed` | 300 | Elementos fixos |
| `--z-navbar` | 400 | Navbar |
| `--z-sidebar` | 500 | Sidebar |
| `--z-overlay` | 900 | Overlays/backdrops |
| `--z-modal` | 1000 | Modais |
| `--z-popover` | 1100 | Popovers |
| `--z-toast` | 1200 | Notificacoes |
| `--z-tooltip` | 1300 | Tooltips |
| `--z-loading` | 9999 | Loading overlay |

**Excecao:** z-index baixos (1-10) dentro de componentes NAO precisam de variaveis.

### 4.2 !important

**EVITE** usar `!important`. Aumente a especificidade do seletor.

```css
/* ERRADO - Usar !important */
.btn { background: blue !important; }

/* CORRETO - Aumentar especificidade */
.modal .btn,
.btn { background: blue; }

/* Ou usar ID se necessario */
#meuModal .btn { background: blue; }
```

**Casos onde !important e ACEITAVEL:**
- `.hidden { display: none !important; }` - Utility class
- Estados de drag-over que precisam sobrescrever
- Media queries para esconder elementos

### 4.3 Inline Styles

**EVITE** inline styles no HTML. Crie classes CSS.

```html
<!-- ERRADO - Inline styles -->
<div style="display: flex; gap: 1rem; margin-top: 1rem;">
<button style="background: linear-gradient(135deg, #43e97b, #38f9d7);">

<!-- CORRETO - Classes CSS -->
<div class="flex gap-md mt-3">
<button class="btn-success">
```

**Excecao:** `style="display: none"` controlado por JavaScript e aceitavel.

```html
<!-- OK - Controlado por JS -->
<div id="campoOpcional" style="display: none;">
```

### 4.4 Classes Utilitarias

Use as classes utilitarias de `/shared/z-index.css`:

```html
<!-- Spacing -->
<div class="mt-3 mb-2 p-4">  <!-- margin-top, margin-bottom, padding -->

<!-- Flex -->
<div class="flex items-center justify-between gap-md">

<!-- Display -->
<div class="d-none">  <!-- display: none -->
<div class="d-flex">  <!-- display: flex -->

<!-- Text -->
<p class="text-secondary text-sm text-center">

<!-- Width -->
<div class="w-full max-w-500">
```

### 4.5 Variaveis de Cores

Use as variaveis definidas no :root:

```css
/* ERRADO - Cores hardcoded */
color: #9ca3af;
background: #00D4FF;

/* CORRETO - Usar variaveis */
color: var(--text-secondary);
background: var(--neon-blue);
```

---

## 5. HTML

### 5.1 Formularios

```html
<!-- CORRETO - Estrutura de form-group -->
<div class="form-group">
    <label for="clientName">
        <i class="fas fa-user" aria-hidden="true"></i> Nome do Cliente
    </label>
    <input type="text" id="clientName" class="form-input"
           placeholder="Digite o nome" autocomplete="off">
</div>
```

### 5.2 Icones

Icones decorativos devem ter `aria-hidden`:

```html
<!-- Icone decorativo -->
<i class="fas fa-check" aria-hidden="true"></i>

<!-- Icone com significado - adicionar sr-only -->
<i class="fas fa-warning" aria-hidden="true"></i>
<span class="visually-hidden">Aviso</span>
```

### 5.3 Estrutura de Modais

```html
<div class="modal" id="nomeModal"
     role="dialog" aria-modal="true"
     aria-labelledby="nomeModalTitle" aria-hidden="true">
    <div class="modal-content">
        <div class="modal-header">
            <h2 id="nomeModalTitle">Titulo do Modal</h2>
            <button class="modal-close" type="button"
                    aria-label="Fechar modal" data-action="closeNomeModal">
                <i class="fas fa-times" aria-hidden="true"></i>
            </button>
        </div>
        <div class="modal-body">
            <!-- Conteudo -->
        </div>
        <div class="modal-footer">
            <button type="button" class="btn-secondary" data-action="closeNomeModal">
                Cancelar
            </button>
            <button type="button" class="btn-primary" data-action="confirmarNome">
                Confirmar
            </button>
        </div>
    </div>
</div>
```

---

## 6. Organizacao de Codigo

### 6.1 Estrutura de Arquivos JS

```
servicos/js/
├── config.js        # Configuracoes, Firebase, constantes
├── main.js          # Inicializacao, entry point
├── auth-ui.js       # Autenticacao e UI principal
├── services.js      # CRUD de servicos
├── tasks.js         # Sistema de tarefas
├── utils.js         # Funcoes utilitarias (datas, formatacao)
├── helpers.js       # DOM helpers, escapeHtml
├── logger.js        # Sistema de logging
├── globals.js       # Namespace global
├── accessibility.js # Focus trap, keyboard nav
└── event-handlers.js # Delegacao de eventos
```

### 6.2 Cabecalho de Arquivo

Todo arquivo JS deve ter cabecalho de identificacao:

```javascript
/*
==================================================
ARQUIVO: servicos/js/nome-arquivo.js
MODULO: Descricao do Modulo
SISTEMA: ImaginaTech - Gestao de Impressao 3D
VERSAO: X.X
DESCRICAO: O que este arquivo faz
IMPORTANTE: NAO REMOVER ESTE CABECALHO DE IDENTIFICACAO
==================================================
*/
```

### 6.3 Imports

Ordem recomendada de imports:

```javascript
// 1. Config e estado
import { state, logger } from './config.js';

// 2. Utilitarios
import { escapeHtml, formatDate } from './utils.js';
import { $, addListener } from './helpers.js';

// 3. Funcoes de outros modulos
import { saveService, deleteService } from './services.js';
```

---

## 7. Git e Commits

### 7.1 Formato de Mensagem

```
[TAG] Descricao curta em portugues

Descricao detalhada se necessario.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

### 7.2 Tags Permitidas

| Tag | Uso |
|-----|-----|
| `[FEATURE]` | Nova funcionalidade |
| `[FIX]` | Correcao de bug |
| `[REFACTOR]` | Refatoracao sem mudar comportamento |
| `[STYLE]` | Mudancas de CSS/estilo |
| `[DOCS]` | Documentacao |
| `[SECURITY]` | Correcoes de seguranca |
| `[PERF]` | Melhorias de performance |
| `[TEST]` | Testes |
| `[CHORE]` | Tarefas de manutencao |

### 7.3 Regras de Commit

- **NUNCA** use emojis/unicode em mensagens (Windows compatibility)
- **NUNCA** commite arquivos com credenciais
- **NUNCA** use `git push --force` em main
- **SEMPRE** verifique `git status` antes de commitar
- **SEMPRE** adicione arquivos especificos (evite `git add .`)

---

## Checklist Antes de Commitar

- [ ] Todos os `console.log` substituidos por `logger.*`?
- [ ] Dados de usuario escapados com `escapeHtml()`?
- [ ] Nenhuma credencial hardcoded?
- [ ] Modais tem atributos ARIA?
- [ ] Nenhum `onclick` inline?
- [ ] `getElementById` com null safety?
- [ ] CSS usa variaveis para z-index de overlays?
- [ ] Nenhum `!important` desnecessario?
- [ ] Arquivo `ExplainToOwner.md` atualizado?

---

## Recursos

- `/shared/z-index.css` - Sistema de z-index e classes utilitarias
- `/servicos/js/helpers.js` - DOM helpers e escapeHtml
- `/servicos/js/logger.js` - Sistema de logging
- `/servicos/js/globals.js` - Namespace ImaginaTech
- `/ExplainToOwner.md` - Documentacao de arquitetura

---

*Documento gerado durante auditoria tecnica em 2026-01-24*
