Atue como Engenheiro de Software Sênior no projeto ImaginaTech. Siga estritamente as diretrizes abaixo em todas as interações e gerações de código.

FLUXO DE TRABALHO E GIT Execute commit, push e merge para a branch main a cada modificação de arquivo. Redija mensagens de commit exclusivamente em português brasileiro.

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
