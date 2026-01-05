# Fluxogramas ImaginaTech

## 1. Fluxo Geral de Navegacao

```mermaid
flowchart TB
    subgraph PUBLICO["AREA PUBLICA"]
        INDEX["index.html<br/>Pagina Inicial"]
        HERO["Hero Section<br/>Cubo 3D + CTA"]
        SERVICOS_SEC["Secao Servicos"]
        STACK["Stack Tecnologico"]
        FOOTER["Footer + Links"]
    end

    subgraph CLIENTE["PORTAL DO CLIENTE"]
        ACOMPANHAR["acompanhar-pedido/<br/>Portal Cliente"]
        LOGIN_CLIENTE["Login Google<br/>Cliente"]
        INSERIR_CODIGO["Inserir Codigo<br/>5 caracteres"]
        VER_STATUS["Visualizar Status<br/>Tempo Real"]
        HISTORICO["Historico de<br/>Pedidos"]
        OBRIGADO["obrigado/<br/>Confirmacao"]
    end

    subgraph ADMIN["AREA ADMINISTRATIVA"]
        SERVICOS_ADM["servicos/<br/>Painel Principal"]
        ESTOQUE["estoque/<br/>Gestao Materiais"]
        CUSTO["custo/<br/>Orcamentos"]
        FINANCAS["financas/<br/>Dashboard"]
        DEV["dev/<br/>Desenvolvimento"]
    end

    INDEX --> HERO
    HERO --> SERVICOS_SEC
    SERVICOS_SEC --> STACK
    STACK --> FOOTER

    INDEX -->|CTA WhatsApp| WHATSAPP["WhatsApp<br/>5521968972539"]
    INDEX -->|Link Acompanhar| ACOMPANHAR

    ACOMPANHAR --> LOGIN_CLIENTE
    LOGIN_CLIENTE -->|Sucesso| INSERIR_CODIGO
    LOGIN_CLIENTE -->|Falha| ERRO_LOGIN["Erro Login"]
    INSERIR_CODIGO -->|Codigo Valido| VER_STATUS
    INSERIR_CODIGO -->|Codigo Invalido| ERRO_CODIGO["Pedido nao encontrado"]
    VER_STATUS --> HISTORICO
    VER_STATUS -->|Pedido Concluido| OBRIGADO

    SERVICOS_ADM <-->|Nav| ESTOQUE
    SERVICOS_ADM <-->|Nav| CUSTO
    SERVICOS_ADM <-->|Nav| FINANCAS
    SERVICOS_ADM <-->|Nav| DEV
```

---

## 2. Fluxo de Autenticacao Admin

```mermaid
flowchart TD
    START["Usuario acessa<br/>pagina admin"]
    CHECK_AUTH{"Verifica<br/>autenticacao"}
    SHOW_LOGIN["Exibe botao<br/>Login Google"]
    GOOGLE_AUTH["Firebase<br/>signInWithPopup"]
    GET_EMAIL["Obtem email<br/>do usuario"]
    CHECK_EMAIL{"Email na lista<br/>AUTHORIZED_EMAILS?"}
    GRANT_ACCESS["Concede acesso<br/>Carrega dashboard"]
    DENY_ACCESS["Nega acesso<br/>Exibe mensagem erro"]
    REGISTER_ACCESS["Registra<br/>lastAccess no Firestore"]
    LOGOUT["Botao Sair<br/>signOut"]

    START --> CHECK_AUTH
    CHECK_AUTH -->|Nao autenticado| SHOW_LOGIN
    CHECK_AUTH -->|Autenticado| GET_EMAIL
    SHOW_LOGIN -->|Click| GOOGLE_AUTH
    GOOGLE_AUTH -->|Sucesso| GET_EMAIL
    GOOGLE_AUTH -->|Falha| ERRO_GOOGLE["Erro Google Auth"]
    GET_EMAIL --> CHECK_EMAIL
    CHECK_EMAIL -->|Sim| GRANT_ACCESS
    CHECK_EMAIL -->|Nao| DENY_ACCESS
    GRANT_ACCESS --> REGISTER_ACCESS
    REGISTER_ACCESS --> DASHBOARD["Dashboard carregado"]
    DASHBOARD -->|Click Sair| LOGOUT
    LOGOUT --> SHOW_LOGIN

    style DENY_ACCESS fill:#ff6b6b
    style GRANT_ACCESS fill:#51cf66
```

---

## 3. Fluxo Completo de Servicos (CRUD)

```mermaid
flowchart TD
    subgraph CRIAR["CRIAR SERVICO"]
        BTN_NOVO["Click Novo Servico"]
        SELECT_TYPE{"Selecionar Tipo"}
        IMPRESSAO["Impressao 3D"]
        MODELAGEM["Modelagem 3D"]
        FORM_MODAL["Abre Modal<br/>Formulario"]

        subgraph FORM["FORMULARIO"]
            DADOS_CLIENTE["Dados Cliente<br/>Nome, CPF, Email, WhatsApp"]
            DADOS_SERVICO["Dados Servico<br/>Material, Cor, Prioridade"]
            DADOS_ENTREGA["Dados Entrega<br/>Metodo, CEP, Endereco"]
            DADOS_VALOR["Valor e Peso"]
            UPLOAD_FILES["Upload Arquivos<br/>STL, OBJ, 3MF"]
            UPLOAD_IMAGES["Upload Imagens<br/>Referencia"]
            DESC_OBS["Descricao e<br/>Observacoes"]
        end

        VALIDAR_FORM{"Validar<br/>campos"}
        SAVE_FIREBASE["Salvar no<br/>Firestore"]
        GERAR_CODIGO["Gerar codigo<br/>5 caracteres"]
        NOTIF_OPTIONS{"Notificar<br/>cliente?"}
        SEND_WHATSAPP["Enviar<br/>WhatsApp"]
        SEND_EMAIL["Enviar<br/>Email"]
    end

    BTN_NOVO --> SELECT_TYPE
    SELECT_TYPE -->|Impressao| IMPRESSAO
    SELECT_TYPE -->|Modelagem| MODELAGEM
    IMPRESSAO --> FORM_MODAL
    MODELAGEM --> FORM_MODAL
    FORM_MODAL --> DADOS_CLIENTE
    DADOS_CLIENTE --> DADOS_SERVICO
    DADOS_SERVICO --> DADOS_ENTREGA
    DADOS_ENTREGA --> DADOS_VALOR
    DADOS_VALOR --> UPLOAD_FILES
    UPLOAD_FILES --> UPLOAD_IMAGES
    UPLOAD_IMAGES --> DESC_OBS
    DESC_OBS --> VALIDAR_FORM
    VALIDAR_FORM -->|Invalido| ERRO_FORM["Exibe erros"]
    ERRO_FORM --> DADOS_CLIENTE
    VALIDAR_FORM -->|Valido| SAVE_FIREBASE
    SAVE_FIREBASE --> GERAR_CODIGO
    GERAR_CODIGO --> NOTIF_OPTIONS
    NOTIF_OPTIONS -->|WhatsApp| SEND_WHATSAPP
    NOTIF_OPTIONS -->|Email| SEND_EMAIL
    NOTIF_OPTIONS -->|Nenhum| FIM_CRIAR["Lista atualizada"]
    SEND_WHATSAPP --> FIM_CRIAR
    SEND_EMAIL --> FIM_CRIAR

    style ERRO_FORM fill:#ff6b6b
    style FIM_CRIAR fill:#51cf66
```

---

## 4. Fluxo de Status do Pedido (6 Estagios)

```mermaid
flowchart LR
    subgraph STATUS["CICLO DE VIDA DO PEDIDO"]
        S1["1. PENDENTE<br/>Aguardando inicio"]
        S2["2. PRODUCAO<br/>Em impressao"]
        S3["3. CONCLUIDO<br/>Impressao finalizada"]
        S4["4. RETIRADA<br/>Pronto para retirar"]
        S5["5. TRANSPORTE<br/>Em entrega"]
        S6["6. ENTREGUE<br/>Finalizado"]
    end

    S1 -->|"Iniciar producao"| S2
    S2 -->|"Finalizar impressao"| S3
    S3 -->|"Metodo: Retirada"| S4
    S3 -->|"Metodo: Sedex/Uber"| S5
    S4 -->|"Cliente retirou"| S6
    S5 -->|"Entrega confirmada"| S6

    style S1 fill:#ffd43b
    style S2 fill:#4dabf7
    style S3 fill:#51cf66
    style S4 fill:#da77f2
    style S5 fill:#ff922b
    style S6 fill:#20c997
```

---

## 5. Fluxo Detalhado de Transicao de Status

```mermaid
flowchart TD
    subgraph TRANS["TRANSICAO DE STATUS"]
        CLICK_STATUS["Click mudar status"]
        CHECK_CURRENT{"Status atual?"}

        subgraph PENDENTE_TO_PROD["Pendente -> Producao"]
            PP_CONFIRM["Confirmar inicio"]
            PP_UPDATE["Atualizar Firestore"]
            PP_NOTIF["Notificar cliente<br/>Pedido em producao"]
        end

        subgraph PROD_TO_CONC["Producao -> Concluido"]
            PC_PHOTOS_INSTA{"Fotos Instagram<br/>obrigatorias?"}
            PC_UPLOAD_INSTA["Upload fotos<br/>formato vertical"]
            PC_VALIDATE_INSTA{"Validar<br/>orientacao"}
            PC_PHOTOS_EMB["Upload fotos<br/>embalagem"]
            PC_UPDATE["Atualizar Firestore"]
            PC_NOTIF["Notificar cliente<br/>Pedido pronto"]
        end

        subgraph CONC_TO_RET["Concluido -> Retirada"]
            CR_PICKUP_INFO["Informar local<br/>e horario"]
            CR_UPDATE["Atualizar Firestore"]
            CR_NOTIF["Notificar cliente<br/>Disponivel retirada"]
        end

        subgraph CONC_TO_TRANS["Concluido -> Transporte"]
            CT_METHOD{"Metodo<br/>entrega?"}
            CT_SEDEX["SEDEX:<br/>Codigo rastreio"]
            CT_UBER["Uber:<br/>Info motorista"]
            CT_UPDATE["Atualizar Firestore"]
            CT_NOTIF["Notificar cliente<br/>Em transporte"]
        end

        subgraph FINAL["Finalizacao"]
            FN_CONFIRM["Confirmar entrega"]
            FN_UPDATE["Atualizar Firestore"]
            FN_NOTIF["Notificar cliente<br/>Pedido entregue"]
            FN_END["Pedido finalizado"]
        end
    end

    CLICK_STATUS --> CHECK_CURRENT
    CHECK_CURRENT -->|Pendente| PP_CONFIRM
    PP_CONFIRM --> PP_UPDATE
    PP_UPDATE --> PP_NOTIF

    CHECK_CURRENT -->|Producao| PC_PHOTOS_INSTA
    PC_PHOTOS_INSTA -->|Sim| PC_UPLOAD_INSTA
    PC_PHOTOS_INSTA -->|Nao| PC_PHOTOS_EMB
    PC_UPLOAD_INSTA --> PC_VALIDATE_INSTA
    PC_VALIDATE_INSTA -->|Horizontal| ERRO_ORIENT["Erro: foto deve<br/>ser vertical"]
    PC_VALIDATE_INSTA -->|Vertical| PC_PHOTOS_EMB
    PC_PHOTOS_EMB --> PC_UPDATE
    PC_UPDATE --> PC_NOTIF

    CHECK_CURRENT -->|Concluido Retirada| CR_PICKUP_INFO
    CR_PICKUP_INFO --> CR_UPDATE
    CR_UPDATE --> CR_NOTIF

    CHECK_CURRENT -->|Concluido Entrega| CT_METHOD
    CT_METHOD -->|SEDEX| CT_SEDEX
    CT_METHOD -->|Uber| CT_UBER
    CT_SEDEX --> CT_UPDATE
    CT_UBER --> CT_UPDATE
    CT_UPDATE --> CT_NOTIF

    CHECK_CURRENT -->|Retirada/Transporte| FN_CONFIRM
    FN_CONFIRM --> FN_UPDATE
    FN_UPDATE --> FN_NOTIF
    FN_NOTIF --> FN_END

    style ERRO_ORIENT fill:#ff6b6b
    style FN_END fill:#51cf66
```

---

## 6. Fluxo do Estoque

```mermaid
flowchart TD
    subgraph ESTOQUE["GESTAO DE ESTOQUE"]
        LOAD["Carregar filamentos<br/>do Firestore"]
        RENDER["Renderizar grid<br/>de cards"]

        subgraph FILTROS["FILTROS"]
            F_TIPO["Filtrar por tipo<br/>PLA, ABS, PETG, TPU"]
            F_STATUS["Filtrar por status<br/>OK, Baixo"]
            F_BUSCA["Buscar por<br/>cor/marca"]
        end

        subgraph ACOES["ACOES"]
            ADD_NEW["Adicionar novo<br/>filamento"]
            EDIT["Editar<br/>filamento"]
            DELETE["Excluir<br/>filamento"]
            RESTOCK["Reabastecer<br/>+1kg ou fracionado"]
            PRINT["Gerar print<br/>cores disponiveis"]
        end

        subgraph MODAL_ADD["MODAL ADICIONAR"]
            MA_TIPO["Selecionar tipo"]
            MA_MARCA["Selecionar marca<br/>3DLab, Creality, eSUN"]
            MA_COR["Informar cor"]
            MA_PESO["Informar peso kg"]
            MA_FOTO["Upload foto PNG"]
            MA_OBS["Observacoes"]
            MA_SAVE["Salvar Firestore"]
        end

        STATS["Atualizar<br/>estatisticas"]
        PENDING["Ver servicos<br/>aguardando material"]
    end

    LOAD --> RENDER
    RENDER --> FILTROS
    F_TIPO --> RENDER
    F_STATUS --> RENDER
    F_BUSCA --> RENDER

    RENDER -->|Click card| ACOES
    ADD_NEW --> MA_TIPO
    MA_TIPO --> MA_MARCA
    MA_MARCA --> MA_COR
    MA_COR --> MA_PESO
    MA_PESO --> MA_FOTO
    MA_FOTO --> MA_OBS
    MA_OBS --> MA_SAVE
    MA_SAVE --> LOAD

    EDIT --> MA_TIPO
    DELETE -->|Confirmar| LOAD
    RESTOCK --> LOAD
    PRINT --> DOWNLOAD["Download PNG"]

    LOAD --> STATS
    RENDER --> PENDING

    style MA_SAVE fill:#51cf66
```

---

## 7. Fluxo do Cliente Acompanhar Pedido

```mermaid
flowchart TD
    subgraph ACOMPANHAR["ACOMPANHAR PEDIDO"]
        ACCESS["Cliente acessa<br/>/acompanhar-pedido"]
        CHECK_URL{"URL tem<br/>?codigo=XXXXX"}

        subgraph AUTH["AUTENTICACAO"]
            SHOW_LOGIN["Exibir botao<br/>Login Google"]
            DO_LOGIN["Firebase Auth<br/>signInWithPopup"]
            GET_USER["Obter dados<br/>usuario"]
        end

        subgraph CODIGO["BUSCA POR CODIGO"]
            INPUT_CODE["Input codigo<br/>5 caracteres"]
            VALIDATE_CODE{"Codigo<br/>valido?"}
            SEARCH_DB["Buscar no<br/>Firestore"]
            FOUND{"Pedido<br/>encontrado?"}
        end

        subgraph VISUALIZAR["VISUALIZAR PEDIDO"]
            SHOW_STATUS["Exibir status<br/>atual"]
            SHOW_TIMELINE["Exibir timeline<br/>de progresso"]
            SHOW_DETAILS["Exibir detalhes<br/>do pedido"]
            REALTIME["Listener<br/>tempo real"]
        end

        subgraph HISTORICO["HISTORICO"]
            LOAD_ORDERS["Carregar pedidos<br/>do cliente"]
            LIST_ORDERS["Listar pedidos<br/>anteriores"]
            SELECT_ORDER["Selecionar<br/>pedido"]
        end
    end

    ACCESS --> CHECK_URL
    CHECK_URL -->|Sim| DO_LOGIN
    CHECK_URL -->|Nao| SHOW_LOGIN
    SHOW_LOGIN -->|Click| DO_LOGIN
    DO_LOGIN -->|Sucesso| GET_USER
    DO_LOGIN -->|Falha| ERRO_AUTH["Erro autenticacao"]
    GET_USER --> INPUT_CODE

    CHECK_URL -->|Com codigo| INPUT_CODE
    INPUT_CODE --> VALIDATE_CODE
    VALIDATE_CODE -->|Invalido| ERRO_CODE["Formato invalido"]
    VALIDATE_CODE -->|Valido| SEARCH_DB
    SEARCH_DB --> FOUND
    FOUND -->|Nao| ERRO_NOT_FOUND["Pedido nao encontrado"]
    FOUND -->|Sim| SHOW_STATUS

    SHOW_STATUS --> SHOW_TIMELINE
    SHOW_TIMELINE --> SHOW_DETAILS
    SHOW_DETAILS --> REALTIME
    REALTIME -->|Status mudou| SHOW_STATUS

    GET_USER --> LOAD_ORDERS
    LOAD_ORDERS --> LIST_ORDERS
    LIST_ORDERS -->|Click| SELECT_ORDER
    SELECT_ORDER --> SHOW_STATUS

    style ERRO_AUTH fill:#ff6b6b
    style ERRO_CODE fill:#ff6b6b
    style ERRO_NOT_FOUND fill:#ff6b6b
    style SHOW_STATUS fill:#51cf66
```

---

## 8. Fluxo Financeiro

```mermaid
flowchart TD
    subgraph FINANCAS["DASHBOARD FINANCEIRO"]
        ACCESS_FIN["Acessa /financas"]
        CHECK_DEVICE{"Dispositivo?"}
        BLOCK_MOBILE["BLOQUEADO<br/>Desktop only"]

        subgraph AUTH_FIN["AUTENTICACAO"]
            LOGIN_FIN["Login Google"]
            VALIDATE_FIN["Validar email<br/>autorizado"]
        end

        subgraph DASHBOARD["DASHBOARD"]
            LOAD_DATA["Carregar dados<br/>Firestore"]
            RENDER_CHARTS["Renderizar<br/>graficos ApexCharts"]
            SHOW_KPIS["Exibir KPIs"]
            SHOW_BALANCE["Exibir saldo<br/>e projecoes"]
        end

        subgraph TRANSACOES["TRANSACOES"]
            LIST_TRANS["Listar transacoes"]
            ADD_TRANS["Adicionar<br/>transacao"]
            EDIT_TRANS["Editar<br/>transacao"]
            DELETE_TRANS["Excluir<br/>transacao"]
            FILTER_TRANS["Filtrar por<br/>mes/categoria"]
        end

        subgraph ASSINATURAS["ASSINATURAS"]
            LIST_SUBS["Listar<br/>assinaturas"]
            ADD_SUB["Adicionar<br/>assinatura"]
            CANCEL_SUB["Cancelar<br/>assinatura"]
        end

        subgraph PARCELAMENTOS["PARCELAMENTOS"]
            LIST_PARC["Listar<br/>parcelamentos"]
            ADD_PARC["Adicionar<br/>parcelamento"]
            TRACK_PARC["Acompanhar<br/>parcelas"]
        end
    end

    ACCESS_FIN --> CHECK_DEVICE
    CHECK_DEVICE -->|Mobile| BLOCK_MOBILE
    CHECK_DEVICE -->|Desktop| LOGIN_FIN
    LOGIN_FIN --> VALIDATE_FIN
    VALIDATE_FIN -->|Invalido| ERRO_FIN["Acesso negado"]
    VALIDATE_FIN -->|Valido| LOAD_DATA

    LOAD_DATA --> RENDER_CHARTS
    LOAD_DATA --> SHOW_KPIS
    LOAD_DATA --> SHOW_BALANCE

    LOAD_DATA --> LIST_TRANS
    LIST_TRANS --> ADD_TRANS
    LIST_TRANS --> EDIT_TRANS
    LIST_TRANS --> DELETE_TRANS
    LIST_TRANS --> FILTER_TRANS

    LOAD_DATA --> LIST_SUBS
    LIST_SUBS --> ADD_SUB
    LIST_SUBS --> CANCEL_SUB

    LOAD_DATA --> LIST_PARC
    LIST_PARC --> ADD_PARC
    LIST_PARC --> TRACK_PARC

    style BLOCK_MOBILE fill:#ff6b6b
    style ERRO_FIN fill:#ff6b6b
```

---

## 9. Fluxo de Upload de Arquivos

```mermaid
flowchart TD
    subgraph UPLOAD["SISTEMA DE UPLOAD"]
        subgraph ARQUIVOS["ARQUIVOS PROJETO"]
            SELECT_FILE["Selecionar arquivo"]
            CHECK_EXT{"Extensao<br/>valida?"}
            VALID_EXT["STL, OBJ, STEP,<br/>3MF, ZIP, TXT,<br/>MTL, RAR, 7Z, PDF"]
            INVALID_EXT["Extensao invalida"]
            CHECK_SIZE{"Tamanho<br/>OK?"}
            UPLOAD_STORAGE["Upload para<br/>Firebase Storage"]
            GET_URL["Obter URL<br/>download"]
            SAVE_REF["Salvar referencia<br/>no documento"]
        end

        subgraph IMAGENS["IMAGENS REFERENCIA"]
            SELECT_IMG["Selecionar imagem"]
            CHECK_IMG_EXT{"Extensao<br/>valida?"}
            VALID_IMG["JPG, PNG, GIF,<br/>WebP, BMP, SVG"]
            PREVIEW_IMG["Exibir preview"]
            UPLOAD_IMG["Upload Storage"]
        end

        subgraph INSTAGRAM["FOTOS INSTAGRAM"]
            SELECT_INSTA["Selecionar foto"]
            CHECK_ORIENT{"Orientacao?"}
            VERTICAL["Vertical OK"]
            HORIZONTAL["ERRO: deve ser<br/>vertical"]
            UPLOAD_INSTA["Upload Storage"]
        end

        subgraph EMBALAGEM["FOTOS EMBALAGEM"]
            SELECT_EMB["Selecionar foto"]
            UPLOAD_EMB["Upload Storage"]
        end

        subgraph ESTOQUE_IMG["IMAGEM FILAMENTO"]
            SELECT_FIL["Selecionar PNG"]
            CHECK_PNG{"E PNG?"}
            UPLOAD_FIL["Upload Storage"]
        end
    end

    SELECT_FILE --> CHECK_EXT
    CHECK_EXT -->|Valida| CHECK_SIZE
    CHECK_EXT -->|Invalida| INVALID_EXT
    CHECK_SIZE -->|OK| UPLOAD_STORAGE
    CHECK_SIZE -->|Grande demais| ERRO_SIZE["Arquivo muito grande"]
    UPLOAD_STORAGE --> GET_URL
    GET_URL --> SAVE_REF

    SELECT_IMG --> CHECK_IMG_EXT
    CHECK_IMG_EXT -->|Valida| PREVIEW_IMG
    CHECK_IMG_EXT -->|Invalida| ERRO_IMG["Formato invalido"]
    PREVIEW_IMG --> UPLOAD_IMG

    SELECT_INSTA --> CHECK_ORIENT
    CHECK_ORIENT -->|Vertical| UPLOAD_INSTA
    CHECK_ORIENT -->|Horizontal| HORIZONTAL

    SELECT_EMB --> UPLOAD_EMB

    SELECT_FIL --> CHECK_PNG
    CHECK_PNG -->|Sim| UPLOAD_FIL
    CHECK_PNG -->|Nao| ERRO_PNG["Apenas PNG"]

    style INVALID_EXT fill:#ff6b6b
    style ERRO_SIZE fill:#ff6b6b
    style ERRO_IMG fill:#ff6b6b
    style HORIZONTAL fill:#ff6b6b
    style ERRO_PNG fill:#ff6b6b
    style SAVE_REF fill:#51cf66
```

---

## 10. Fluxo de Notificacoes

```mermaid
flowchart TD
    subgraph NOTIFICACOES["SISTEMA DE NOTIFICACOES"]
        subgraph TRIGGER["GATILHOS"]
            T_CREATE["Servico criado"]
            T_STATUS["Status alterado"]
            T_READY["Pronto retirada"]
            T_SHIPPING["Em transporte"]
            T_DELIVERED["Entregue"]
        end

        subgraph CANAIS["CANAIS"]
            C_WHATSAPP["WhatsApp<br/>wa.me API"]
            C_EMAIL["Email<br/>EmailJS"]
            C_TOAST["Toast<br/>UI notification"]
        end

        subgraph WHATSAPP_FLOW["FLUXO WHATSAPP"]
            W_CHECK{"Checkbox<br/>marcado?"}
            W_BUILD["Montar mensagem"]
            W_OPEN["Abrir wa.me<br/>com texto"]
        end

        subgraph EMAIL_FLOW["FLUXO EMAIL"]
            E_CHECK{"Checkbox<br/>marcado?"}
            E_TEMPLATE["Carregar template<br/>EmailJS"]
            E_SEND["Enviar email"]
            E_CONFIRM["Confirmar envio"]
        end

        subgraph TOAST_FLOW["FLUXO TOAST"]
            TO_TYPE{"Tipo?"}
            TO_SUCCESS["Toast success<br/>verde"]
            TO_ERROR["Toast error<br/>vermelho"]
            TO_INFO["Toast info<br/>azul"]
            TO_WARNING["Toast warning<br/>amarelo"]
            TO_SHOW["Exibir 3 segundos"]
            TO_HIDE["Auto-hide"]
        end
    end

    T_CREATE --> W_CHECK
    T_CREATE --> E_CHECK
    T_STATUS --> C_TOAST
    T_READY --> W_CHECK
    T_SHIPPING --> W_CHECK
    T_DELIVERED --> W_CHECK

    W_CHECK -->|Sim| W_BUILD
    W_CHECK -->|Nao| SKIP_W["Pular"]
    W_BUILD --> W_OPEN

    E_CHECK -->|Sim| E_TEMPLATE
    E_CHECK -->|Nao| SKIP_E["Pular"]
    E_TEMPLATE --> E_SEND
    E_SEND --> E_CONFIRM

    C_TOAST --> TO_TYPE
    TO_TYPE -->|success| TO_SUCCESS
    TO_TYPE -->|error| TO_ERROR
    TO_TYPE -->|info| TO_INFO
    TO_TYPE -->|warning| TO_WARNING
    TO_SUCCESS --> TO_SHOW
    TO_ERROR --> TO_SHOW
    TO_INFO --> TO_SHOW
    TO_WARNING --> TO_SHOW
    TO_SHOW --> TO_HIDE
```

---

## 11. Fluxo de Integracao ViaCEP

```mermaid
flowchart TD
    subgraph VIACEP["BUSCA CEP"]
        INPUT_CEP["Usuario digita CEP"]
        FORMAT_CEP["Formatar CEP<br/>XXXXX-XXX"]
        VALIDATE_CEP{"CEP valido?<br/>8 digitos"}
        CALL_API["Chamar API<br/>viacep.com.br"]
        CHECK_RESPONSE{"Retorno<br/>valido?"}
        FILL_FIELDS["Preencher campos<br/>automaticamente"]
        ERRO_CEP["CEP nao encontrado"]

        subgraph CAMPOS["CAMPOS PREENCHIDOS"]
            F_RUA["Rua/Logradouro"]
            F_BAIRRO["Bairro"]
            F_CIDADE["Cidade"]
            F_UF["Estado/UF"]
        end
    end

    INPUT_CEP --> FORMAT_CEP
    FORMAT_CEP --> VALIDATE_CEP
    VALIDATE_CEP -->|Invalido| ERRO_FORMAT["Formato invalido"]
    VALIDATE_CEP -->|Valido| CALL_API
    CALL_API --> CHECK_RESPONSE
    CHECK_RESPONSE -->|Erro| ERRO_CEP
    CHECK_RESPONSE -->|OK| FILL_FIELDS
    FILL_FIELDS --> F_RUA
    FILL_FIELDS --> F_BAIRRO
    FILL_FIELDS --> F_CIDADE
    FILL_FIELDS --> F_UF

    style ERRO_FORMAT fill:#ff6b6b
    style ERRO_CEP fill:#ff6b6b
    style FILL_FIELDS fill:#51cf66
```

---

## 12. Fluxo Completo do Sistema (Visao Geral)

```mermaid
flowchart TB
    subgraph VISITANTE["VISITANTE"]
        V_HOME["Acessa site"]
        V_CONTATO["Contato WhatsApp"]
        V_ACOMP["Acompanhar pedido"]
    end

    subgraph CLIENTE["CLIENTE"]
        C_LOGIN["Login Google"]
        C_CODIGO["Inserir codigo"]
        C_STATUS["Ver status"]
        C_HIST["Ver historico"]
    end

    subgraph ADMIN["ADMINISTRADOR"]
        A_LOGIN["Login Google"]
        A_AUTH["Validar email"]

        subgraph SERVICOS["SERVICOS"]
            S_LIST["Listar servicos"]
            S_CREATE["Criar servico"]
            S_UPDATE["Atualizar status"]
            S_NOTIF["Notificar cliente"]
        end

        subgraph ESTOQUE_ADM["ESTOQUE"]
            E_LIST["Listar filamentos"]
            E_ADD["Adicionar"]
            E_RESTOCK["Reabastecer"]
            E_PRINT["Print cores"]
        end

        subgraph CUSTO_ADM["CUSTO"]
            CU_CALC["Calcular orcamento"]
        end

        subgraph FIN_ADM["FINANCAS"]
            F_DASH["Dashboard"]
            F_TRANS["Transacoes"]
            F_SUBS["Assinaturas"]
        end
    end

    subgraph FIREBASE["FIREBASE"]
        FB_AUTH["Authentication"]
        FB_STORE["Firestore"]
        FB_STORAGE["Storage"]
    end

    subgraph EXTERNO["INTEGRACOES"]
        EXT_WA["WhatsApp"]
        EXT_EMAIL["EmailJS"]
        EXT_GA["Google Analytics"]
        EXT_META["Meta Pixel"]
        EXT_CEP["ViaCEP"]
    end

    V_HOME --> V_CONTATO
    V_HOME --> V_ACOMP
    V_ACOMP --> C_LOGIN
    C_LOGIN --> FB_AUTH
    FB_AUTH --> C_CODIGO
    C_CODIGO --> FB_STORE
    FB_STORE --> C_STATUS
    C_STATUS --> C_HIST

    A_LOGIN --> FB_AUTH
    FB_AUTH --> A_AUTH
    A_AUTH --> S_LIST
    S_LIST --> FB_STORE
    S_CREATE --> FB_STORE
    S_CREATE --> FB_STORAGE
    S_UPDATE --> FB_STORE
    S_UPDATE --> S_NOTIF
    S_NOTIF --> EXT_WA
    S_NOTIF --> EXT_EMAIL

    E_LIST --> FB_STORE
    E_ADD --> FB_STORE
    E_ADD --> FB_STORAGE
    E_RESTOCK --> FB_STORE

    CU_CALC --> FB_STORE

    F_DASH --> FB_STORE
    F_TRANS --> FB_STORE
    F_SUBS --> FB_STORE

    V_HOME --> EXT_GA
    V_HOME --> EXT_META
    S_CREATE --> EXT_CEP
```

---

## Pontos de Atencao para Quebras de Logica

### Potenciais Problemas Identificados:

1. **Autenticacao**
   - Verificar se todos os modulos validam emails corretamente
   - Checar se sessao expira corretamente

2. **Status do Pedido**
   - Validar transicoes permitidas (nao pular etapas)
   - Garantir fotos obrigatorias antes de avancar

3. **Upload de Arquivos**
   - Validacao de extensoes em todos os pontos
   - Limite de tamanho de arquivo

4. **Notificacoes**
   - Verificar se WhatsApp abre corretamente
   - Checar se EmailJS esta configurado

5. **Dados do Cliente**
   - Validacao de CPF/CNPJ
   - Validacao de CEP com ViaCEP

6. **Mobile**
   - Financas bloqueado em mobile
   - Verificar responsividade das outras paginas

---

*Gerado automaticamente para identificacao de quebras de logica*
