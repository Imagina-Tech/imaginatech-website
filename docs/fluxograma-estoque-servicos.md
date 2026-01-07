# Fluxograma Completo: Painel de Estoque e Integração com Serviços

## 1. Visão Geral da Arquitetura

```mermaid
flowchart TB
    subgraph PAINEIS["PAINÉIS DO SISTEMA"]
        ESTOQUE[("Painel de Estoque<br/>estoque/index.html")]
        SERVICOS[("Painel de Serviços<br/>servicos/index.html")]
    end

    subgraph FIREBASE["FIREBASE"]
        FS_FILAMENTS[(Coleção: filaments)]
        FS_SERVICES[(Coleção: services)]
        STORAGE[(Firebase Storage<br/>Imagens)]
    end

    ESTOQUE <-->|"Real-time onSnapshot"| FS_FILAMENTS
    ESTOQUE -->|"Upload/Delete"| STORAGE
    SERVICOS <-->|"Real-time onSnapshot"| FS_SERVICES
    SERVICOS <-->|"Dedução/Devolução<br/>Transaction"| FS_FILAMENTS
    SERVICOS -->|"Consulta needsMaterialPurchase"| FS_SERVICES
    ESTOQUE -.->|"Badge de Pendentes"| FS_SERVICES
```

---

## 2. Fluxo de Autenticação do Painel de Estoque

```mermaid
flowchart TD
    START((Início)) --> LOAD[Carregar página estoque/index.html]
    LOAD --> AUTH_CHECK{setupAuthListener<br/>Usuário autenticado?}

    AUTH_CHECK -->|Não| LOGIN_SCREEN[showLoginScreen<br/>Exibir tela de login]
    LOGIN_SCREEN --> BTN_GOOGLE[Botão: Login com Google]
    BTN_GOOGLE -->|Click| GOOGLE_AUTH[signInWithGoogle<br/>Popup de autenticação]

    GOOGLE_AUTH --> AUTH_RESULT{Autenticação<br/>bem-sucedida?}
    AUTH_RESULT -->|Não| LOGIN_SCREEN
    AUTH_RESULT -->|Sim| CHECK_ALLOWED{Email autorizado?<br/>5 emails permitidos}

    CHECK_ALLOWED -->|Não| DENIED[Acesso negado<br/>signOut automático]
    DENIED --> LOGIN_SCREEN

    CHECK_ALLOWED -->|Sim| DASHBOARD[showDashboard<br/>Exibir painel principal]
    AUTH_CHECK -->|Sim| CHECK_ALLOWED

    DASHBOARD --> LOAD_DATA[loadFilaments<br/>Carregar filamentos]
    LOAD_DATA --> REALTIME[Listener Real-time<br/>onSnapshot ativo]
    REALTIME --> RENDER[renderFilaments<br/>Renderizar cards]
    RENDER --> UPDATE_STATS[updateStats<br/>Atualizar estatísticas]
    UPDATE_STATS --> READY((Painel Pronto))

    subgraph LOGOUT["Logout"]
        BTN_LOGOUT[Botão: Sair]
        BTN_LOGOUT -->|Click| SIGN_OUT[signOut]
        SIGN_OUT --> LOGIN_SCREEN
    end
```

---

## 3. Estrutura do Dashboard de Estoque

```mermaid
flowchart TB
    subgraph HEADER["CABEÇALHO"]
        TITLE[Título: Gerenciamento de Estoque]
        BTN_PRINT[Botão: Gerar Print de Cores<br/>openPrintModal]
        BTN_ADD[Botão: Adicionar Filamento<br/>openAddFilamentModal]
    end

    subgraph STATS["CARDS DE ESTATÍSTICAS"]
        STAT1[Total de Filamentos<br/>id: totalFilaments]
        STAT2[Estoque OK >800g<br/>id: stockOk]
        STAT3[Estoque Baixo <600g<br/>id: stockLow]
        STAT4[Peso Total em Estoque<br/>id: totalWeight]
    end

    subgraph FILTERS["FILTROS"]
        direction LR
        F_ALL[Todos]
        F_PLA[PLA]
        F_ABS[ABS]
        F_PETG[PETG]
        F_TPU[TPU]
        F_OUTROS[Outros]
        F_LOW[Baixo <600g]
        F_OK[OK >800g]
    end

    subgraph GRID["GRID DE FILAMENTOS"]
        CARD1[Card Filamento 1]
        CARD2[Card Filamento 2]
        CARD3[Card Filamento N...]
    end

    HEADER --> STATS
    STATS --> FILTERS
    FILTERS --> GRID
```

---

## 4. Estrutura do Card de Filamento

```mermaid
flowchart TB
    subgraph CARD["CARD DE FILAMENTO"]
        direction TB

        subgraph INDICATORS["INDICADORES"]
            STOCK_DOT{Indicador de Estoque}
            STOCK_DOT -->|"peso >= 800g"| GREEN[Verde: OK]
            STOCK_DOT -->|"peso < 600g"| RED[Vermelho: Baixo<br/>+ Animação pulsante]
            STOCK_DOT -->|"peso = 0"| OVERLAY[Overlay: Sem Estoque]
        end

        subgraph BADGE["BADGE DE PENDENTES"]
            PENDING{Serviços pendentes<br/>aguardando material?}
            PENDING -->|Sim| SHOW_BADGE[Badge Laranja<br/>- Qtd serviços<br/>- Total gramas<br/>- Lista de pedidos]
            PENDING -->|Não| NO_BADGE[Sem badge]
        end

        subgraph INFO["INFORMAÇÕES"]
            IMG[Imagem do Filamento]
            TYPE[Tipo: PLA/ABS/etc]
            NAME[Nome/Cor]
            BRAND[Marca]
            WEIGHT[Peso atual em gramas]
        end
    end

    CARD -->|Click| OPEN_ACTIONS[openCardActionsModal<br/>Abrir menu de ações]
```

---

## 5. Fluxo de Filtros

```mermaid
flowchart TD
    START((Grid de Filamentos)) --> FILTER_TYPE{Filtro por Tipo<br/>selecionado?}

    FILTER_TYPE -->|Click PLA| F_PLA[filterByType 'PLA']
    FILTER_TYPE -->|Click ABS| F_ABS[filterByType 'ABS']
    FILTER_TYPE -->|Click PETG| F_PETG[filterByType 'PETG']
    FILTER_TYPE -->|Click TPU| F_TPU[filterByType 'TPU']
    FILTER_TYPE -->|Click Outros| F_OUTROS[filterByType 'Outros']
    FILTER_TYPE -->|Click Todos| F_ALL[filterByType null<br/>Limpar filtro tipo]

    F_PLA & F_ABS & F_PETG & F_TPU & F_OUTROS & F_ALL --> APPLY_TYPE[Aplicar filtro de tipo]

    APPLY_TYPE --> FILTER_STOCK{Filtro por Estoque<br/>selecionado?}

    FILTER_STOCK -->|Click Baixo| F_LOW[filterByStock 'low'<br/>peso < 600g]
    FILTER_STOCK -->|Click OK| F_OK[filterByStock 'ok'<br/>peso >= 800g]
    FILTER_STOCK -->|Nenhum| F_NONE[Sem filtro estoque]

    F_LOW & F_OK & F_NONE --> RENDER[renderFilaments<br/>Filtrar array local]
    RENDER --> DISPLAY[Exibir cards filtrados]
    DISPLAY --> UPDATE[updateStats<br/>Estatísticas refletem<br/>dados filtrados]
```

---

## 6. Modal de Adicionar/Editar Filamento

```mermaid
flowchart TD
    subgraph TRIGGER["GATILHOS"]
        BTN_ADD[Botão: Adicionar Filamento]
        BTN_EDIT[Ação: Editar Filamento]
    end

    BTN_ADD -->|Click| OPEN_NEW[openAddFilamentModal<br/>Modal vazio]
    BTN_EDIT -->|Click| OPEN_EDIT[editFilament id<br/>Modal preenchido]

    OPEN_NEW & OPEN_EDIT --> MODAL[Modal filamentModal]

    subgraph FORM["FORMULÁRIO"]
        direction TB
        F_IMG[Upload Imagem PNG<br/>previewImage]
        F_TYPE[Dropdown Tipo<br/>PLA/ABS/PETG/TPU/PC/<br/>PP/Nylon/ASA/HIPS/PVA/Outros]
        F_BRAND[Dropdown Marca<br/>13 marcas + Outros]
        F_COLOR[Input Cor]
        F_WEIGHT[Input Peso kg]
        F_NOTES[Textarea Observações]
    end

    MODAL --> FORM

    FORM --> ACTIONS{Ação do usuário}

    ACTIONS -->|Cancelar| CLOSE[closeFilamentModal<br/>Fechar e limpar]
    ACTIONS -->|Salvar| VALIDATE{Validar campos<br/>obrigatórios}

    VALIDATE -->|Faltando| ERROR[Mostrar erro<br/>Toast vermelho]
    ERROR --> FORM

    VALIDATE -->|OK| CHECK_DUP{Verificar duplicata<br/>tipo+cor+marca}

    CHECK_DUP -->|Existe| DUP_ERROR[Erro: Filamento<br/>já cadastrado]
    DUP_ERROR --> FORM

    CHECK_DUP -->|Único| HAS_IMG{Tem imagem?}

    HAS_IMG -->|Sim| UPLOAD[Upload para Storage<br/>filaments/timestamp_nome]
    HAS_IMG -->|Não/Mantém| SAVE_DATA[Preparar dados]

    UPLOAD --> SAVE_DATA

    SAVE_DATA --> IS_EDIT{Modo edição?}

    IS_EDIT -->|Não| CREATE[db.collection filaments.add<br/>Criar novo documento]
    IS_EDIT -->|Sim| UPDATE[db.collection filaments.doc.update<br/>Atualizar documento]

    CREATE & UPDATE --> SUCCESS[Toast: Salvo com sucesso]
    SUCCESS --> CLOSE
    CLOSE --> RENDER[renderFilaments<br/>Listener atualiza UI]
```

---

## 7. Modal de Ações do Card (Menu de Contexto)

```mermaid
flowchart TD
    CARD_CLICK[Click no Card<br/>do Filamento] --> OPEN[openCardActionsModal id]

    OPEN --> MODAL[Modal cardActionsModal]

    subgraph INFO["INFORMAÇÕES EXIBIDAS"]
        I_NAME[Nome do Filamento]
        I_BRAND[Marca]
        I_STOCK[Estoque Atual em gramas]
    end

    MODAL --> INFO
    INFO --> BUTTONS

    subgraph BUTTONS["BOTÕES DE AÇÃO"]
        B1[Recompra 1kg<br/>handleRestock1kg]
        B2[Adicionar Quantidade Fracionada<br/>handleAddFractional]
        B3[Editar Filamento<br/>handleEditFilament]
        B4[Excluir Filamento<br/>handleDeleteFilament]
    end

    B1 -->|Click| RESTOCK_1KG
    B2 -->|Click| FRACTIONAL
    B3 -->|Click| EDIT
    B4 -->|Click| DELETE

    subgraph RESTOCK_1KG["RECOMPRA 1KG"]
        R1_CALC[Calcular: peso atual + 1.0 kg]
        R1_UPDATE[Firestore update<br/>weight: novo valor]
        R1_TOAST[Toast: +1kg adicionado]
    end

    subgraph FRACTIONAL["ADICIONAR FRACIONADO"]
        FR_PROMPT[Prompt: Quantidade em gramas?]
        FR_VALIDATE{Valor válido?<br/>número > 0}
        FR_VALIDATE -->|Não| FR_ERROR[Cancelar/Erro]
        FR_VALIDATE -->|Sim| FR_CALC[Calcular: peso + gramas/1000]
        FR_CALC --> FR_UPDATE[Firestore update<br/>weight: novo valor]
        FR_UPDATE --> FR_TOAST[Toast: +Xg adicionados]
    end

    subgraph EDIT["EDITAR FILAMENTO"]
        ED_CLOSE[Fechar modal ações]
        ED_OPEN[editFilament id<br/>Abrir modal edição]
    end

    subgraph DELETE["EXCLUIR FILAMENTO"]
        DEL_CONFIRM{Confirm:<br/>Tem certeza?}
        DEL_CONFIRM -->|Não| DEL_CANCEL[Cancelar]
        DEL_CONFIRM -->|Sim| DEL_IMG{Tem imagem?}
        DEL_IMG -->|Sim| DEL_STORAGE[Delete imagem<br/>do Storage]
        DEL_IMG -->|Não| DEL_DOC
        DEL_STORAGE --> DEL_DOC[Delete documento<br/>Firestore]
        DEL_DOC --> DEL_TOAST[Toast: Excluído]
    end

    R1_TOAST & FR_TOAST & ED_OPEN & DEL_TOAST & DEL_CANCEL --> CLOSE_MODAL[closeCardActionsModal]
    CLOSE_MODAL --> LISTENER[Listener onSnapshot<br/>atualiza automaticamente]
```

---

## 8. Fluxo Detalhado: Adição de Estoque

```mermaid
flowchart TD
    subgraph ADICAO["FORMAS DE ADICIONAR ESTOQUE"]
        A1[Recompra 1kg<br/>handleRestock1kg]
        A2[Adicionar Fracionado<br/>handleAddFractional]
        A3[Novo Filamento<br/>saveFilament]
        A4[Devolução de Serviço<br/>deductMaterialFromStock<br/>valor negativo]
    end

    A1 --> CALC1[peso_atual + 1.0 kg]
    A2 --> CALC2[peso_atual + X gramas / 1000]
    A3 --> CALC3[peso inicial informado]
    A4 --> CALC4[peso_atual + material_devolvido]

    CALC1 & CALC2 & CALC3 & CALC4 --> FIRESTORE[Firestore Update]

    FIRESTORE --> TRANSACTION{Operação}

    TRANSACTION -->|Simples| SIMPLE[db.doc.update<br/>weight: novo_valor<br/>updatedAt: serverTimestamp]

    TRANSACTION -->|Transação<br/>Serviços| TRANS[db.runTransaction<br/>Leitura atômica<br/>+ Atualização]

    SIMPLE & TRANS --> LISTENER[onSnapshot dispara]
    LISTENER --> UPDATE_UI[renderFilaments<br/>updateStats]
    UPDATE_UI --> RESULT((Estoque Atualizado))
```

---

## 9. Fluxo Detalhado: Dedução de Estoque (Integração com Serviços)

```mermaid
flowchart TD
    subgraph SERVICOS["PAINEL DE SERVIÇOS"]
        SAVE_SVC[Salvar Serviço<br/>saveService]
    end

    SAVE_SVC --> HAS_MATERIAL{Serviço tem<br/>material definido?}

    HAS_MATERIAL -->|Não| NO_DEDUCT[Não deduzir<br/>needsMaterialPurchase = false]

    HAS_MATERIAL -->|Sim| CHECK_STOCK[checkStockAvailability<br/>material, cor, peso_gramas]

    CHECK_STOCK --> FIND[findBestFilament<br/>tipo + cor]

    FIND --> FOUND{Filamento<br/>encontrado?}

    FOUND -->|Não| NOT_FOUND[notFound: true<br/>needsMaterialPurchase = true]

    FOUND -->|Sim| HAS_ENOUGH{Estoque >= <br/>peso necessário?}

    HAS_ENOUGH -->|Não| INSUFFICIENT[hasStock: false<br/>Mostrar aviso ao usuário]
    INSUFFICIENT --> MARK_PENDING[needsMaterialPurchase = true<br/>NÃO deduzir]

    HAS_ENOUGH -->|Sim| DEDUCT[deductMaterialFromStock<br/>Transação Firestore]

    subgraph TRANSACTION["TRANSAÇÃO ATÔMICA"]
        T_READ[Ler peso atual]
        T_CALC[novo_peso = atual - necessário]
        T_ENSURE[Math.max 0, novo_peso<br/>Evitar negativo]
        T_UPDATE[Atualizar documento]
    end

    DEDUCT --> T_READ
    T_READ --> T_CALC
    T_CALC --> T_ENSURE
    T_ENSURE --> T_UPDATE

    T_UPDATE --> SUCCESS[needsMaterialPurchase = false<br/>Material deduzido]

    NO_DEDUCT & NOT_FOUND & MARK_PENDING & SUCCESS --> SAVE_FINAL[Salvar serviço<br/>no Firestore]

    SAVE_FINAL --> ESTOQUE_UPDATE[Estoque atualiza<br/>via onSnapshot]
```

---

## 10. Fluxo de Edição de Serviço (Impacto no Estoque)

```mermaid
flowchart TD
    EDIT_SVC[Editar Serviço<br/>Existente] --> COMPARE{Comparar<br/>dados antigos<br/>vs novos}

    COMPARE --> SCENARIO

    subgraph SCENARIO["CENÁRIOS DE EDIÇÃO"]
        S1[Adicionar material<br/>não tinha → agora tem]
        S2[Remover material<br/>tinha → não tem mais]
        S3[Mudar tipo/cor<br/>material diferente]
        S4[Mudar quantidade<br/>mesmo material]
    end

    S1 --> S1_ACTION[Verificar estoque novo<br/>Se disponível: deduzir<br/>Se não: marcar pendente]

    S2 --> S2_ACTION{Material foi<br/>deduzido antes?}
    S2_ACTION -->|Sim| S2_RETURN[Devolver ao estoque<br/>deductMaterialFromStock<br/>valor negativo]
    S2_ACTION -->|Não| S2_NOTHING[Nenhuma ação<br/>estava pendente]

    S3 --> S3_ACTION[1. Devolver material antigo<br/>2. Verificar novo material<br/>3. Deduzir se disponível]

    S4 --> S4_CHECK{Peso aumentou<br/>ou diminuiu?}

    S4_CHECK -->|Aumentou| S4_MORE[Verificar diferença<br/>Se disponível: deduzir extra<br/>Se não: marcar pendente]

    S4_CHECK -->|Diminuiu| S4_LESS[Devolver diferença<br/>ao estoque]

    S1_ACTION & S2_RETURN & S2_NOTHING & S3_ACTION & S4_MORE & S4_LESS --> SAVE[Salvar alterações<br/>serviço + estoque]
```

---

## 11. Fluxo de Exclusão de Serviço (Devolução ao Estoque)

```mermaid
flowchart TD
    DELETE_SVC[Excluir Serviço] --> CHECK{Serviço tinha<br/>material?}

    CHECK -->|Não| DELETE_ONLY[Apenas excluir<br/>documento]

    CHECK -->|Sim| WAS_DEDUCTED{needsMaterialPurchase<br/>era false?<br/>Material foi deduzido}

    WAS_DEDUCTED -->|Não| DELETE_ONLY

    WAS_DEDUCTED -->|Sim| RETURN[Devolver material<br/>deductMaterialFromStock<br/>peso negativo = devolução]

    RETURN --> DELETE_ONLY
    DELETE_ONLY --> FIRESTORE[Delete documento<br/>Firestore]
    FIRESTORE --> UPDATE[Estoque atualiza<br/>automaticamente]
```

---

## 12. Modal de Geração de Print de Cores

```mermaid
flowchart TD
    BTN[Botão: Gerar Print de Cores] -->|Click| OPEN[openPrintModal]

    OPEN --> MODAL[Modal printModal]

    subgraph INPUTS["CAMPOS"]
        I_WEIGHT[Peso mínimo necessário<br/>Default: 500g]
        I_TYPE[Filtro por tipo<br/>Opcional]
    end

    MODAL --> INPUTS
    INPUTS --> ACTION{Ação}

    ACTION -->|Cancelar| CLOSE[closePrintModal]
    ACTION -->|Gerar| GENERATE[generateColorPrint]

    GENERATE --> FILTER[Filtrar filamentos:<br/>peso >= peso_mínimo<br/>AND tipo = tipo_selecionado]

    FILTER --> RESULT_MODAL[Modal printResultModal]

    subgraph RESULT["RESULTADO"]
        R_INFO[Quantidade necessária<br/>Cores disponíveis]
        R_GRID[Grid de filamentos<br/>com imagens]
    end

    RESULT_MODAL --> RESULT

    RESULT --> RESULT_ACTION{Ação}

    RESULT_ACTION -->|Fechar| CLOSE_RESULT[closePrintResultModal]
    RESULT_ACTION -->|Baixar| DOWNLOAD[downloadPrint<br/>Converter para PNG]
```

---

## 13. Fluxo de Sincronização Real-Time

```mermaid
flowchart TD
    subgraph ESTOQUE["PAINEL ESTOQUE"]
        E_LISTENER[onSnapshot<br/>filaments collection]
        E_RENDER[renderFilaments]
        E_STATS[updateStats]
    end

    subgraph SERVICOS["PAINEL SERVIÇOS"]
        S_LISTENER[onSnapshot<br/>services collection]
        S_LOAD[loadAvailableFilaments]
        S_DROPDOWNS[Atualizar dropdowns<br/>material/cor]
    end

    subgraph FIREBASE["FIRESTORE"]
        F_FILAMENTS[(filaments)]
        F_SERVICES[(services)]
    end

    F_FILAMENTS -->|Mudança detectada| E_LISTENER
    E_LISTENER --> E_RENDER
    E_RENDER --> E_STATS

    F_FILAMENTS -->|Mudança detectada| S_LOAD
    S_LOAD --> S_DROPDOWNS

    F_SERVICES -->|Mudança detectada| S_LISTENER
    F_SERVICES -->|needsMaterialPurchase=true| E_LISTENER
    E_LISTENER -->|Badge de pendentes| E_RENDER
```

---

## 14. Tabela Completa de Botões e Ações

| Localização | Botão | Handler | Ação no Estoque |
|-------------|-------|---------|-----------------|
| Header | Gerar Print de Cores | `openPrintModal()` | Nenhuma - apenas consulta |
| Header | Adicionar Filamento | `openAddFilamentModal()` | **ADIÇÃO**: Novo registro |
| Filtros | Todos/PLA/ABS/PETG/TPU/Outros | `filterByType(tipo)` | Nenhuma - apenas visual |
| Filtros | Baixo/OK | `filterByStock(nivel)` | Nenhuma - apenas visual |
| Card | Click no card | `openCardActionsModal(id)` | Abre menu de ações |
| Modal Ações | Recompra 1kg | `handleRestock1kg()` | **ADIÇÃO**: +1000g |
| Modal Ações | Adicionar Fracionado | `handleAddFractional()` | **ADIÇÃO**: +Xg customizado |
| Modal Ações | Editar Filamento | `handleEditFilament()` | **EDIÇÃO**: Dados do registro |
| Modal Ações | Excluir Filamento | `handleDeleteFilament()` | **REMOÇÃO**: Delete completo |
| Modal Filamento | Cancelar | `closeFilamentModal()` | Nenhuma |
| Modal Filamento | Salvar | `saveFilament()` | **ADIÇÃO/EDIÇÃO** |
| Modal Print | Cancelar | `closePrintModal()` | Nenhuma |
| Modal Print | Gerar | `generateColorPrint()` | Nenhuma - apenas consulta |
| Modal Resultado | Fechar | `closePrintResultModal()` | Nenhuma |
| Modal Resultado | Baixar Imagem | `downloadPrint()` | Nenhuma |

---

## 15. Tabela de Impacto no Estoque por Operação de Serviço

| Operação | Condição | Ação no Estoque |
|----------|----------|-----------------|
| **Criar Serviço** | Com material + estoque disponível | **DEDUÇÃO** automática |
| **Criar Serviço** | Com material + sem estoque | Nenhuma (marca pendente) |
| **Criar Serviço** | Sem material | Nenhuma |
| **Editar Serviço** | Adicionar material + estoque OK | **DEDUÇÃO** automática |
| **Editar Serviço** | Adicionar material + sem estoque | Nenhuma (marca pendente) |
| **Editar Serviço** | Remover material (foi deduzido) | **DEVOLUÇÃO** automática |
| **Editar Serviço** | Remover material (não deduzido) | Nenhuma |
| **Editar Serviço** | Trocar material | **DEVOLUÇÃO** + **DEDUÇÃO** |
| **Editar Serviço** | Aumentar peso (estoque OK) | **DEDUÇÃO** da diferença |
| **Editar Serviço** | Aumentar peso (sem estoque) | Nenhuma (marca pendente) |
| **Editar Serviço** | Diminuir peso | **DEVOLUÇÃO** da diferença |
| **Excluir Serviço** | Material foi deduzido | **DEVOLUÇÃO** total |
| **Excluir Serviço** | Material não deduzido | Nenhuma |

---

## 16. Fluxograma Consolidado: Ciclo de Vida do Estoque

```mermaid
flowchart TD
    START((Início)) --> CREATE[Criar Filamento<br/>saveFilament]

    CREATE --> INVENTORY[(Filamento no<br/>Inventário)]

    INVENTORY --> OPERATIONS{Operações}

    OPERATIONS --> ADD_1KG[Recompra 1kg<br/>+1000g]
    OPERATIONS --> ADD_FRAC[Adicionar Fracionado<br/>+Xg]
    OPERATIONS --> EDIT[Editar Dados<br/>nome/cor/marca/etc]
    OPERATIONS --> SERVICE_USE[Uso em Serviço<br/>-Xg]
    OPERATIONS --> SERVICE_RETURN[Devolução de Serviço<br/>+Xg]
    OPERATIONS --> DELETE[Excluir Filamento]

    ADD_1KG --> INVENTORY
    ADD_FRAC --> INVENTORY
    EDIT --> INVENTORY
    SERVICE_USE --> CHECK_ZERO{Peso = 0?}
    SERVICE_RETURN --> INVENTORY

    CHECK_ZERO -->|Não| INVENTORY
    CHECK_ZERO -->|Sim| EMPTY[Filamento sem estoque<br/>Overlay visual]
    EMPTY --> INVENTORY

    DELETE --> CONFIRM{Confirmado?}
    CONFIRM -->|Não| INVENTORY
    CONFIRM -->|Sim| REMOVE_IMG[Remover imagem<br/>Storage]
    REMOVE_IMG --> REMOVE_DOC[Remover documento<br/>Firestore]
    REMOVE_DOC --> END((Fim))

    subgraph INDICATORS["INDICADORES VISUAIS"]
        I_GREEN[Verde: peso >= 800g]
        I_RED[Vermelho + Pulso: peso < 600g]
        I_OVERLAY[Overlay: peso = 0]
        I_BADGE[Badge: serviços pendentes]
    end
```

---

## 17. Estrutura de Dados Firestore

### Coleção: `filaments`
```javascript
{
  id: "auto-generated",           // ID único Firestore
  type: "PLA",                    // Tipo do material
  brand: "3D Fila",               // Marca
  color: "Preto",                 // Cor
  name: "PLA Preto",              // Nome composto
  weight: 0.850,                  // Peso em KG (850g)
  notes: "Observações",           // Texto livre
  imageUrl: "https://...",        // URL do Storage
  createdAt: Timestamp,           // Data criação
  updatedAt: Timestamp            // Última atualização
}
```

### Coleção: `services` (campos relevantes para estoque)
```javascript
{
  id: "auto-generated",
  material: "PLA",                // Tipo do material usado
  color: "Preto",                 // Cor do material
  materialWeight: 150,            // Peso em gramas
  needsMaterialPurchase: false,   // true = aguardando compra
  // ... outros campos do serviço
}
```

---

## 18. Resumo de Conexões entre Painéis

```mermaid
flowchart LR
    subgraph ESTOQUE["PAINEL DE ESTOQUE"]
        E1[Adicionar filamento]
        E2[Editar filamento]
        E3[Recompra 1kg]
        E4[Adicionar fracionado]
        E5[Excluir filamento]
        E6[Visualizar pendentes]
    end

    subgraph FIREBASE["FIRESTORE"]
        DB[(filaments)]
    end

    subgraph SERVICOS["PAINEL DE SERVIÇOS"]
        S1[Listar materiais disponíveis]
        S2[Deduzir ao salvar serviço]
        S3[Devolver ao editar/excluir]
        S4[Marcar needsMaterialPurchase]
    end

    E1 -->|add| DB
    E2 -->|update| DB
    E3 -->|update +1kg| DB
    E4 -->|update +Xg| DB
    E5 -->|delete| DB

    DB -->|onSnapshot| E6
    DB -->|query| S1

    S2 -->|transaction -Xg| DB
    S3 -->|transaction +Xg| DB
    S4 -->|consulta| DB
```

---

Este fluxograma documenta completamente:
- Todos os botões e suas funções
- Todos os fluxos de adição e dedução de estoque
- Integração bidirecional entre estoque e serviços
- Estrutura de dados no Firestore
- Indicadores visuais e seus gatilhos
- Operações atômicas com transações
