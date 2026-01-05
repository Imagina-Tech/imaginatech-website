# Fluxograma Unico - Painel de Servicos ImaginaTech

Copie todo o codigo abaixo e cole em https://mermaid.live

```mermaid
flowchart TD
    %% ========================================
    %% INICIALIZACAO E AUTENTICACAO
    %% ========================================

    subgraph INIT["1. INICIALIZACAO"]
        START["Usuario acessa /servicos/"]
        LOADING["Loading: Conectando..."]
        FIREBASE_INIT["Firebase Init:<br/>db, auth, storage, emailjs"]
        CHECK_FIREBASE{"Firebase OK?"}
        ERROR_FIREBASE["ERRO: Recarregue"]
        SETUP_EVENTS["Setup eventos:<br/>date, phone, cep, notif"]
        AUTH_STATE["onAuthStateChanged()"]
        HIDE_LOADING["Oculta loading"]
    end

    subgraph AUTH["2. AUTENTICACAO"]
        CHECK_USER{"Usuario<br/>logado?"}

        subgraph LOGIN["TELA LOGIN"]
            SHOW_LOGIN["Exibe tela login"]
            BTN_GOOGLE["Btn: Entrar Google"]
            GOOGLE_POPUP["signInWithPopup()"]
        end

        CHECK_EMAIL{"Email autorizado?<br/>AUTHORIZED_EMAILS"}

        subgraph AUTHORIZED["ACESSO AUTORIZADO"]
            SET_AUTH_TRUE["isAuthorized = true"]
            SHOW_DASHBOARD["showAdminDashboard()"]
            START_LISTENER["startServicesListener()"]
            LOAD_CLIENTS["loadClientsFromFirestore()"]
            UPDATE_ACCESS["updateLastAccess()"]
            INIT_TASKS["initTasksSystem()"]
            TOAST_WELCOME["Toast: Bem-vindo!"]
        end

        subgraph DENIED["ACESSO NEGADO"]
            SET_AUTH_FALSE["isAuthorized = false"]
            SHOW_DENIED["showAccessDeniedScreen()"]
            BTN_HOME["Btn: Voltar Inicio"]
            BTN_TRACK["Btn: Acompanhar Pedido"]
            BTN_LOGOUT_DENIED["Btn: Logout"]
        end

        subgraph LOGOUT["LOGOUT"]
            BTN_SAIR["Btn: Sair (navbar)"]
            DESTROY_TASKS["destroyTasksSystem()"]
            SIGN_OUT["auth.signOut()"]
            BACK_LOGIN["Volta tela login"]
        end
    end

    %% Conexoes INIT
    START --> LOADING
    LOADING --> FIREBASE_INIT
    FIREBASE_INIT --> CHECK_FIREBASE
    CHECK_FIREBASE -->|Erro| ERROR_FIREBASE
    CHECK_FIREBASE -->|OK| SETUP_EVENTS
    SETUP_EVENTS --> AUTH_STATE
    AUTH_STATE --> HIDE_LOADING
    HIDE_LOADING --> CHECK_USER

    %% Conexoes AUTH
    CHECK_USER -->|Nao| SHOW_LOGIN
    SHOW_LOGIN --> BTN_GOOGLE
    BTN_GOOGLE -->|Click| GOOGLE_POPUP
    GOOGLE_POPUP -->|Sucesso| CHECK_EMAIL
    CHECK_USER -->|Sim| CHECK_EMAIL

    CHECK_EMAIL -->|Sim| SET_AUTH_TRUE
    SET_AUTH_TRUE --> SHOW_DASHBOARD
    SHOW_DASHBOARD --> START_LISTENER
    START_LISTENER --> LOAD_CLIENTS
    LOAD_CLIENTS --> UPDATE_ACCESS
    UPDATE_ACCESS --> INIT_TASKS
    INIT_TASKS --> TOAST_WELCOME

    CHECK_EMAIL -->|Nao| SET_AUTH_FALSE
    SET_AUTH_FALSE --> SHOW_DENIED

    BTN_SAIR -->|Click| DESTROY_TASKS
    DESTROY_TASKS --> SIGN_OUT
    SIGN_OUT --> BACK_LOGIN
    BACK_LOGIN --> SHOW_LOGIN

    %% ========================================
    %% DASHBOARD PRINCIPAL
    %% ========================================

    subgraph DASH["3. DASHBOARD"]
        subgraph NAVBAR["NAVBAR"]
            NAV_LOGO["ImaginaTech"]
            NAV_CONN["Status Conexao"]
            NAV_ESTOQUE["Link: /estoque/"]
            NAV_CAIXA["Link: /caixa/"]
            NAV_CUSTO["Link: /custo/"]
            NAV_FIN["Link: /financas/"]
            NAV_USER["Foto + Nome"]
        end

        subgraph STATS["GRID ESTATISTICAS"]
            STAT_ATIVOS["Card: Ativos<br/>filter=todos"]
            STAT_PEND["Card: Pendentes<br/>filter=pendente"]
            STAT_PROD["Card: Producao<br/>filter=producao"]
            STAT_CONC["Card: Concluidos<br/>filter=concluido"]
            STAT_RET["Card: Entrega<br/>filter=retirada"]
            STAT_ENT["Card: Entregues<br/>filter=entregue"]
        end

        BTN_NOVO["Btn: Novo Servico"]
        SERVICES_GRID["Grid de Cards"]
        EMPTY_STATE["Estado Vazio"]
    end

    TOAST_WELCOME --> DASH

    %% ========================================
    %% FILTROS
    %% ========================================

    subgraph FILTER["4. FILTROS"]
        CLICK_STAT["Click em stat-card"]
        SET_FILTER["state.currentFilter = X"]
        CALL_RENDER["renderServices()"]

        subgraph FILTER_LOGIC["LOGICA"]
            F_TODOS["todos: exclui entregue,<br/>retirada, mod_concluida"]
            F_PROD["producao: inclui<br/>producao + modelando"]
            F_CONC["concluido: inclui<br/>concluido + mod_concluida"]
            F_OTHER["outros: filtra exato"]
        end

        subgraph SORT["ORDENACAO"]
            SORT_CONC["Por completedAt"]
            SORT_ENT["Por deliveredAt"]
            SORT_PRIO["Por prioridade<br/>urgente>alta>media>baixa"]
        end

        CHECK_EMPTY{"Lista vazia?"}
        SHOW_EMPTY["Exibe emptyState"]
        SHOW_GRID["Exibe cards"]
    end

    STAT_ATIVOS -->|Click| CLICK_STAT
    STAT_PEND -->|Click| CLICK_STAT
    STAT_PROD -->|Click| CLICK_STAT
    STAT_CONC -->|Click| CLICK_STAT
    STAT_RET -->|Click| CLICK_STAT
    STAT_ENT -->|Click| CLICK_STAT

    CLICK_STAT --> SET_FILTER
    SET_FILTER --> CALL_RENDER
    CALL_RENDER --> CHECK_EMPTY
    CHECK_EMPTY -->|Sim| SHOW_EMPTY
    CHECK_EMPTY -->|Nao| SHOW_GRID

    %% ========================================
    %% CRIAR SERVICO
    %% ========================================

    subgraph CREATE["5. CRIAR SERVICO"]
        OPEN_TYPE_MODAL["Abre modal tipo"]

        subgraph TYPE_SELECT["SELECAO TIPO"]
            BTN_IMPRESSAO["Btn: Impressao 3D"]
            BTN_MODELAGEM["Btn: Modelagem 3D"]
        end

        CLOSE_TYPE["Fecha modal tipo"]
        SET_TYPE["state.currentServiceType"]
        CLEAR_STATE["Limpa state:<br/>editingId, files, images"]

        subgraph FORM_SETUP["SETUP FORM"]
            SET_TITLE["modalTitle = Novo..."]
            RESET_FORM["form.reset()"]
            SETUP_DATES["startDate = hoje"]
            SET_PRIORITY["priority = media"]
            SET_STATUS_INIT["status = pendente/modelando"]
        end

        subgraph ADAPT["ADAPTAR FORM"]
            CHECK_TYPE_FORM{"Tipo?"}

            subgraph IMP_FORM["IMPRESSAO"]
                SHOW_MAT["Exibe Material"]
                SHOW_COR["Exibe Cor"]
                SHOW_PESO["Exibe Peso"]
                SHOW_ENTREGA["Exibe Entrega"]
                LOAD_STOCK["loadAvailableFilaments()"]
                UPDATE_MAT_DD["updateMaterialDropdown()"]
            end

            subgraph MOD_FORM["MODELAGEM"]
                HIDE_MAT["Oculta Material"]
                HIDE_COR["Oculta Cor"]
                HIDE_PESO["Oculta Peso"]
                HIDE_ENTREGA["Oculta Entrega"]
            end
        end

        OPEN_SERVICE_MODAL["Abre serviceModal"]
    end

    BTN_NOVO -->|Click| OPEN_TYPE_MODAL
    OPEN_TYPE_MODAL --> BTN_IMPRESSAO
    OPEN_TYPE_MODAL --> BTN_MODELAGEM

    BTN_IMPRESSAO -->|Click| CLOSE_TYPE
    BTN_MODELAGEM -->|Click| CLOSE_TYPE

    CLOSE_TYPE --> SET_TYPE
    SET_TYPE --> CLEAR_STATE
    CLEAR_STATE --> SET_TITLE
    SET_TITLE --> RESET_FORM
    RESET_FORM --> SETUP_DATES
    SETUP_DATES --> SET_PRIORITY
    SET_PRIORITY --> SET_STATUS_INIT
    SET_STATUS_INIT --> CHECK_TYPE_FORM

    CHECK_TYPE_FORM -->|impressao| SHOW_MAT
    SHOW_MAT --> SHOW_COR
    SHOW_COR --> SHOW_PESO
    SHOW_PESO --> SHOW_ENTREGA
    SHOW_ENTREGA --> LOAD_STOCK
    LOAD_STOCK --> UPDATE_MAT_DD
    UPDATE_MAT_DD --> OPEN_SERVICE_MODAL

    CHECK_TYPE_FORM -->|modelagem| HIDE_MAT
    HIDE_MAT --> HIDE_COR
    HIDE_COR --> HIDE_PESO
    HIDE_PESO --> HIDE_ENTREGA
    HIDE_ENTREGA --> OPEN_SERVICE_MODAL

    %% ========================================
    %% FORMULARIO
    %% ========================================

    subgraph FORM["6. FORMULARIO"]
        subgraph CAMPOS_BASICOS["DADOS BASICOS"]
            F_NOME["serviceName *"]
            F_CLIENTE["clientName *"]
            F_CPF["clientCPF"]
            F_EMAIL["clientEmail"]
            F_PHONE["clientPhone"]
        end

        subgraph AUTOCOMPLETE["AUTOCOMPLETE"]
            INPUT_CLIENTE["Digita nome"]
            SEARCH_CACHE["Busca clientsCache"]
            SHOW_SUGG["Exibe sugestoes"]
            CLICK_SUGG["Click sugestao"]
            FILL_ALL["Preenche todos campos"]
        end

        subgraph MATERIAL_COR["MATERIAL/COR"]
            SELECT_MAT["Material (estoque)"]
            ON_MAT_CHANGE["onChange"]
            UPDATE_CORES["updateColorDropdown()"]
            SELECT_COR["Cor (estoque)"]
        end

        subgraph ENTREGA_FIELDS["CAMPOS ENTREGA"]
            SELECT_ENTREGA["deliveryMethod *"]
            ON_ENTREGA_CHANGE["toggleDeliveryFields()"]

            subgraph RETIRADA["RETIRADA"]
                PICKUP_NAME["Nome retira *"]
                PICKUP_WHATS["WhatsApp *"]
            end

            subgraph SEDEX["SEDEX"]
                ADDR_NOME["fullName *"]
                ADDR_CPF["cpfCnpj *"]
                ADDR_EMAIL["email *"]
                ADDR_TEL["telefone *"]
                ADDR_CEP["cep * + ViaCEP"]
                ADDR_END["estado, cidade,<br/>bairro, rua, numero"]
            end
        end

        subgraph DATAS_PRIO["DATAS/PRIORIDADE"]
            F_PRIO["priority *"]
            F_START["startDate *"]
            F_DUE["dueDate *"]
            F_UNDEF["checkbox: A definir"]
        end

        subgraph VALOR_PESO_F["VALOR/PESO"]
            F_VALOR["value R$"]
            F_PESO["weight g"]
        end

        subgraph ARQUIVOS["ARQUIVOS"]
            FILE_INPUT["Input arquivos<br/>STL,OBJ,3MF..."]
            ON_FILE["handleFileSelect()"]
            FILE_PREVIEW["Preview arquivos"]
            FILE_DRIVE["checkbox: No Drive"]

            IMG_INPUT["Input imagens"]
            ON_IMG["handleImageSelect()"]
            IMG_PREVIEW["Preview imagens"]
        end

        subgraph DESC["DESCRICAO"]
            F_DESC["description"]
            F_OBS["observations"]
        end

        subgraph NOTIF["NOTIFICACOES"]
            CHECK_WHATS_CREATE["Enviar WhatsApp"]
            CHECK_EMAIL_CREATE["Enviar Email"]
        end

        subgraph FOOTER_FORM["FOOTER"]
            BTN_CANCEL["Btn: Cancelar"]
            BTN_SAVE["Btn: Salvar"]
        end
    end

    INPUT_CLIENTE --> SEARCH_CACHE
    SEARCH_CACHE --> SHOW_SUGG
    SHOW_SUGG --> CLICK_SUGG
    CLICK_SUGG --> FILL_ALL

    SELECT_MAT --> ON_MAT_CHANGE
    ON_MAT_CHANGE --> UPDATE_CORES
    UPDATE_CORES --> SELECT_COR

    SELECT_ENTREGA --> ON_ENTREGA_CHANGE
    ON_ENTREGA_CHANGE -->|retirada| RETIRADA
    ON_ENTREGA_CHANGE -->|sedex| SEDEX

    ADDR_CEP -->|blur| VIACEP["API ViaCEP"]
    VIACEP --> ADDR_END

    FILE_INPUT --> ON_FILE
    ON_FILE --> FILE_PREVIEW

    IMG_INPUT --> ON_IMG
    ON_IMG --> IMG_PREVIEW

    BTN_CANCEL -->|Click| CLOSE_MODAL["closeModal()"]

    %% ========================================
    %% SALVAR SERVICO
    %% ========================================

    subgraph SAVE["7. SALVAR SERVICO"]
        SAVE_CLICK["Click: Salvar"]
        PREVENT["preventDefault()"]

        subgraph VALIDACOES["VALIDACOES"]
            V_AUTH{"isAuthorized?"}
            V_DELIVERY{"Entrega ok?"}
            V_DATE{"Data valida?"}
            V_FIELDS{"Campos ok?"}
        end

        GET_VALUES["Obtem valores campos"]

        subgraph STOCK_LOGIC["LOGICA ESTOQUE"]
            CHECK_EDITING{"Editando?"}

            subgraph NEW_STOCK["NOVO SERVICO"]
                CHECK_STOCK_NEW["checkStockAvailability()"]
                HAS_STOCK_N{"Tem estoque?"}
                SET_DEDUCT["materialToDeduct = peso"]
                SET_PURCHASE["needsMaterialPurchase = true"]
            end

            subgraph EDIT_STOCK["EDITANDO"]
                COMPARE_MAT["Compara material antigo/novo"]
                RETURN_OLD["Devolve material antigo"]
                CALC_DIFF["Calcula diferenca"]
            end
        end

        subgraph SAVE_DB["SALVAR FIRESTORE"]
            CHECK_EDIT_SAVE{"Editando?"}

            subgraph UPDATE_EXIST["ATUALIZAR"]
                DO_UPDATE["db.doc(id).update()"]
                DEDUCT_UPD["deductMaterialFromStock()"]
                TOAST_UPD["Toast: Atualizado"]
            end

            subgraph CREATE_NEW["CRIAR"]
                SET_IDS["userId, companyId"]
                GEN_CODE["orderCode = 5 chars"]
                DO_ADD["db.collection.add()"]
                SHOW_CODE["Exibe orderCode"]
                DEDUCT_NEW["deductMaterialFromStock()"]
                TOAST_NEW["Toast: Criado!"]
            end
        end

        subgraph NOTIF_SAVE["NOTIFICACOES"]
            CHECK_WHATS_SAVE{"Enviar WhatsApp?"}
            SEND_WHATS["sendWhatsAppMessage()"]
            CHECK_EMAIL_SAVE{"Enviar Email?"}
            SEND_EMAIL["sendEmailNotification()"]
        end

        subgraph SAVE_CLIENT["SALVAR CLIENTE"]
            HAS_CLIENT{"Tem cliente?"}
            DO_SAVE_CLIENT["saveClientToFirestore()"]
        end

        subgraph UPLOAD["UPLOAD"]
            HAS_FILES{"selectedFiles > 0?"}
            DO_UPLOAD_F["uploadMultipleFiles()"]
            UPDATE_FILES_DB["Atualiza service.files"]

            HAS_IMGS{"selectedImages > 0?"}
            DO_UPLOAD_I["uploadMultipleFiles()"]
            UPDATE_IMGS_DB["Atualiza service.images"]
        end

        CLOSE_MODAL_SAVE["closeModal()"]
    end

    BTN_SAVE -->|Click| SAVE_CLICK
    SAVE_CLICK --> PREVENT
    PREVENT --> V_AUTH
    V_AUTH -->|Nao| ERR_AUTH["Toast: Sem permissao"]
    V_AUTH -->|Sim| V_DELIVERY
    V_DELIVERY -->|Erro| ERR_DEL["Toast: Erro"]
    V_DELIVERY -->|OK| V_DATE
    V_DATE -->|Erro| ERR_DATE["Toast: Data invalida"]
    V_DATE -->|OK| GET_VALUES

    GET_VALUES --> CHECK_EDITING
    CHECK_EDITING -->|Nao| CHECK_STOCK_NEW
    CHECK_STOCK_NEW --> HAS_STOCK_N
    HAS_STOCK_N -->|Sim| SET_DEDUCT
    HAS_STOCK_N -->|Nao| SET_PURCHASE

    CHECK_EDITING -->|Sim| COMPARE_MAT

    SET_DEDUCT --> CHECK_EDIT_SAVE
    SET_PURCHASE --> CHECK_EDIT_SAVE
    COMPARE_MAT --> CHECK_EDIT_SAVE

    CHECK_EDIT_SAVE -->|Sim| DO_UPDATE
    DO_UPDATE --> DEDUCT_UPD
    DEDUCT_UPD --> TOAST_UPD
    TOAST_UPD --> HAS_CLIENT

    CHECK_EDIT_SAVE -->|Nao| SET_IDS
    SET_IDS --> GEN_CODE
    GEN_CODE --> DO_ADD
    DO_ADD --> SHOW_CODE
    SHOW_CODE --> DEDUCT_NEW
    DEDUCT_NEW --> TOAST_NEW
    TOAST_NEW --> CHECK_WHATS_SAVE

    CHECK_WHATS_SAVE -->|Sim| SEND_WHATS
    SEND_WHATS --> CHECK_EMAIL_SAVE
    CHECK_WHATS_SAVE -->|Nao| CHECK_EMAIL_SAVE
    CHECK_EMAIL_SAVE -->|Sim| SEND_EMAIL
    SEND_EMAIL --> HAS_CLIENT
    CHECK_EMAIL_SAVE -->|Nao| HAS_CLIENT

    HAS_CLIENT -->|Sim| DO_SAVE_CLIENT
    DO_SAVE_CLIENT --> HAS_FILES
    HAS_CLIENT -->|Nao| HAS_FILES

    HAS_FILES -->|Sim| DO_UPLOAD_F
    DO_UPLOAD_F --> UPDATE_FILES_DB
    UPDATE_FILES_DB --> HAS_IMGS
    HAS_FILES -->|Nao| HAS_IMGS

    HAS_IMGS -->|Sim| DO_UPLOAD_I
    DO_UPLOAD_I --> UPDATE_IMGS_DB
    UPDATE_IMGS_DB --> CLOSE_MODAL_SAVE
    HAS_IMGS -->|Nao| CLOSE_MODAL_SAVE

    %% ========================================
    %% CARD DE SERVICO
    %% ========================================

    subgraph CARD["8. CARD DE SERVICO"]
        CARD_ROOT["service-card"]

        subgraph CARD_HEADER["HEADER"]
            C_NAME["Nome servico"]
            C_TYPE["Badge tipo"]
            C_CODE["Codigo XXXXX"]
            C_BTN_EDIT["Btn: Editar"]
            C_BTN_DEL["Btn: Excluir"]
        end

        subgraph CARD_ALERT["ALERTAS"]
            ALERT_MAT["COMPRAR MATERIAL<br/>(needsMaterialPurchase)"]
        end

        subgraph CARD_BADGE["BADGE ENTREGA"]
            BADGE_METHOD["Metodo + Rastreio"]
            BADGE_DAYS["Dias restantes"]
        end

        subgraph CARD_INFO["INFORMACOES"]
            I_CLIENTE["Cliente"]
            I_MAT["Material"]
            I_COR["Cor"]
            I_DATA["Data"]
            I_VALOR["Valor"]
            I_PESO["Peso"]
            I_FILES["Btn: X Arquivos"]
            I_IMGS["Btn: X Imagens"]
        end

        C_DESC["Descricao"]

        subgraph TIMELINE["TIMELINE STATUS"]
            subgraph TL_IMP["IMPRESSAO"]
                TL_PEND["Pendente"]
                TL_PROD["Producao"]
                TL_CONC["Concluido"]
                TL_RET["Retirada/Postado"]
                TL_ENT["Entregue"]
            end

            subgraph TL_MOD["MODELAGEM"]
                TL_MODL["Modelando"]
                TL_MODC["Concluido"]
            end
        end

        subgraph CARD_FOOTER["FOOTER"]
            C_BTN_WHATS["Btn: Contatar"]
            C_BTN_ENTREGA["Btn: Ver Entrega"]
        end
    end

    SHOW_GRID --> CARD_ROOT

    C_BTN_EDIT -->|Click| EDIT_MODAL["openEditModal(id)"]
    C_BTN_DEL -->|Click| DELETE_SVC["deleteService(id)"]
    I_FILES -->|Click| FILES_MODAL["showServiceFiles(id)"]
    I_IMGS -->|Click| IMGS_MODAL["showServiceImages(id)"]
    C_BTN_WHATS -->|Click| CONTACT["contactClient()"]
    C_BTN_ENTREGA -->|Click| DEL_MODAL["showDeliveryInfo(id)"]

    TL_PEND -->|Click| UPD_PEND["updateStatus(id,'pendente')"]
    TL_PROD -->|Click| UPD_PROD["updateStatus(id,'producao')"]
    TL_CONC -->|Click| UPD_CONC["updateStatus(id,'concluido')"]
    TL_RET -->|Click| UPD_RET["updateStatus(id,'retirada')"]
    TL_ENT -->|Click| UPD_ENT["updateStatus(id,'entregue')"]
    TL_MODL -->|Click| UPD_MODL["updateStatus(id,'modelando')"]
    TL_MODC -->|Click| UPD_MODC["updateStatus(id,'modelagem_concluida')"]

    %% ========================================
    %% SISTEMA DE STATUS
    %% ========================================

    subgraph STATUS["9. SISTEMA DE STATUS"]
        CALL_UPDATE["updateStatus(id, newStatus)"]

        subgraph STATUS_VAL["VALIDACOES"]
            SV_AUTH{"isAuthorized?"}
            SV_EXIST{"Servico existe?"}
            SV_SAME{"Mesmo status?"}
            SV_SKIP{"Pulando etapas?"}
        end

        subgraph STATUS_RULES["REGRAS"]
            subgraph RULES_IMP["IMPRESSAO"]
                R_CONC{"Para concluido:<br/>tem fotos?"}
                R_RET{"Para retirada:<br/>tem fotos embalagem?"}
                R_SEDEX{"Sedex:<br/>tem tracking?"}
                R_ENT{"Para entregue:<br/>todas fotos ok?"}
            end

            subgraph RULES_MOD["MODELAGEM"]
                R_MODC{"Para mod_concluida:<br/>tem fotos?"}
            end
        end

        SET_PENDING_STATUS["state.pendingStatusUpdate"]

        subgraph STATUS_MODAL["MODAL CONFIRMACAO"]
            SM_MSG["Mensagem confirmacao"]
            SM_WHATS["Opcao WhatsApp"]
            SM_EMAIL["Opcao Email"]
            SM_CANCEL["Btn: Cancelar"]
            SM_CONFIRM["Btn: Confirmar"]
        end

        subgraph PHOTO_MODALS["MODAIS FOTOS"]
            PM_INSTA["Modal fotos Instagram<br/>showStatusModalWithPhoto()"]
            PM_PACK["Modal fotos embalagem<br/>showStatusModalWithPackagedPhoto()"]
            PM_TRACK["Modal codigo rastreio<br/>showTrackingCodeModal()"]
        end
    end

    UPD_PEND --> CALL_UPDATE
    UPD_PROD --> CALL_UPDATE
    UPD_CONC --> CALL_UPDATE
    UPD_RET --> CALL_UPDATE
    UPD_ENT --> CALL_UPDATE
    UPD_MODL --> CALL_UPDATE
    UPD_MODC --> CALL_UPDATE

    CALL_UPDATE --> SV_AUTH
    SV_AUTH -->|Nao| ERR_AUTH2["Toast: Sem permissao"]
    SV_AUTH -->|Sim| SV_EXIST
    SV_EXIST -->|Nao| RETURN_S["return"]
    SV_EXIST -->|Sim| SV_SAME
    SV_SAME -->|Sim| RETURN_S
    SV_SAME -->|Nao| SV_SKIP
    SV_SKIP -->|Sim| ERR_SKIP["Toast: Siga ordem"]
    SV_SKIP -->|Nao| SET_PENDING_STATUS

    SET_PENDING_STATUS --> R_CONC
    R_CONC -->|Nao tem fotos| PM_INSTA
    R_CONC -->|Tem fotos| R_RET
    R_RET -->|Nao tem fotos| PM_PACK
    R_RET -->|Tem fotos| R_SEDEX
    R_SEDEX -->|Nao tem tracking| PM_TRACK
    R_SEDEX -->|OK| SM_MSG

    R_MODC -->|Nao tem fotos| PM_INSTA
    R_MODC -->|Tem fotos| SM_MSG

    SM_MSG --> SM_WHATS
    SM_WHATS --> SM_EMAIL
    SM_CANCEL -->|Click| CLOSE_STATUS["closeStatusModal()"]

    %% ========================================
    %% CONFIRMAR STATUS
    %% ========================================

    subgraph CONFIRM["10. CONFIRMAR STATUS"]
        CONFIRM_CLICK["Click: Confirmar"]
        GET_PENDING["Obtem pendingStatusUpdate"]

        subgraph CONF_PACK["COM FOTOS EMBALAGEM"]
            CP_CHECK{"Tem fotos?"}
            CP_TRACK{"Sedex: tem codigo?"}
            CP_UPLOAD["Upload fotos embalagem"]
            CP_SET_STATUS["status = retirada"]
            CP_SET_TRACK["trackingCode = X"]
            CP_UPDATE["db.update()"]
            CP_TOAST["Toast: Postado!"]
        end

        subgraph CONF_INSTA["COM FOTOS INSTAGRAM"]
            CI_CHECK{"Tem fotos?"}
            CI_UPLOAD["Upload fotos"]
            CI_SET_IMG["instagramPhoto = url"]
            CI_SET_STATUS["status = concluido"]
            CI_UPDATE["db.update()"]
            CI_TOAST["Toast: Concluido!"]
        end

        subgraph CONF_NORMAL["MUDANCA NORMAL"]
            CN_BUILD["Monta updates"]
            CN_SET_STATUS["status = newStatus"]
            CN_TIMESTAMPS["Define timestamps"]
            CN_UPDATE["db.update()"]
            CN_TOAST["Toast: Atualizado"]
        end

        subgraph CONF_NOTIF["NOTIFICACOES"]
            CN_WHATS{"Enviar WhatsApp?"}
            CN_MSG["Monta mensagem"]
            CN_SEND_W["sendWhatsAppMessage()"]
            CN_EMAIL{"Enviar Email?"}
            CN_SEND_E["sendEmailNotification()"]
        end

        CLOSE_STATUS_FINAL["closeStatusModal()"]
    end

    SM_CONFIRM -->|Click| CONFIRM_CLICK
    CONFIRM_CLICK --> GET_PENDING

    GET_PENDING -->|requiresPackagedPhoto| CP_CHECK
    CP_CHECK -->|Nao| ERR_PACK["Toast: Selecione fotos"]
    CP_CHECK -->|Sim| CP_TRACK
    CP_TRACK -->|Nao| ERR_TRACK["Toast: Digite codigo"]
    CP_TRACK -->|Sim/NA| CP_UPLOAD
    CP_UPLOAD --> CP_SET_STATUS
    CP_SET_STATUS --> CP_SET_TRACK
    CP_SET_TRACK --> CP_UPDATE
    CP_UPDATE --> CP_TOAST
    CP_TOAST --> CN_WHATS

    GET_PENDING -->|requiresInstagramPhoto| CI_CHECK
    CI_CHECK -->|Nao| ERR_INSTA["Toast: Selecione fotos"]
    CI_CHECK -->|Sim| CI_UPLOAD
    CI_UPLOAD --> CI_SET_IMG
    CI_SET_IMG --> CI_SET_STATUS
    CI_SET_STATUS --> CI_UPDATE
    CI_UPDATE --> CI_TOAST
    CI_TOAST --> CN_EMAIL

    GET_PENDING -->|normal| CN_BUILD
    CN_BUILD --> CN_SET_STATUS
    CN_SET_STATUS --> CN_TIMESTAMPS
    CN_TIMESTAMPS --> CN_UPDATE
    CN_UPDATE --> CN_TOAST
    CN_TOAST --> CN_WHATS

    CN_WHATS -->|Sim| CN_MSG
    CN_MSG --> CN_SEND_W
    CN_SEND_W --> CN_EMAIL
    CN_WHATS -->|Nao| CN_EMAIL
    CN_EMAIL -->|Sim| CN_SEND_E
    CN_SEND_E --> CLOSE_STATUS_FINAL
    CN_EMAIL -->|Nao| CLOSE_STATUS_FINAL

    %% ========================================
    %% EXCLUIR SERVICO
    %% ========================================

    subgraph DELETE["11. EXCLUIR SERVICO"]
        DEL_CLICK["Click: Excluir"]
        DEL_AUTH{"isAuthorized?"}
        DEL_FIND["Busca servico"]
        DEL_CONFIRM["confirm: Excluir?"]

        subgraph DEL_FILES["DELETAR ARQUIVOS"]
            DF_COLLECT["Coleta URLs"]
            DF_LOOP["Para cada URL"]
            DF_REF["storage.refFromURL()"]
            DF_DELETE["fileRef.delete()"]
        end

        DEL_DOC["db.doc(id).delete()"]
        DEL_TOAST["Toast: Excluido"]
    end

    DELETE_SVC --> DEL_CLICK
    DEL_CLICK --> DEL_AUTH
    DEL_AUTH -->|Nao| ERR_AUTH3["Toast: Sem permissao"]
    DEL_AUTH -->|Sim| DEL_FIND
    DEL_FIND --> DEL_CONFIRM
    DEL_CONFIRM -->|Cancelar| RETURN_D["return"]
    DEL_CONFIRM -->|OK| DF_COLLECT
    DF_COLLECT --> DF_LOOP
    DF_LOOP --> DF_REF
    DF_REF --> DF_DELETE
    DF_DELETE --> DF_LOOP
    DF_LOOP -->|fim| DEL_DOC
    DEL_DOC --> DEL_TOAST

    %% ========================================
    %% MODAIS VISUALIZACAO
    %% ========================================

    subgraph MODAIS["12. MODAIS VISUALIZACAO"]
        subgraph MOD_FILES["MODAL ARQUIVOS"]
            MF_OPEN["showServiceFiles(id)"]
            MF_GET["Coleta arquivos"]
            MF_RENDER["Renderiza lista"]
            MF_ITEM["Icone + Nome + Tamanho"]
            MF_OPEN_BTN["Btn: Abrir"]
            MF_DOWN_BTN["Btn: Baixar"]
            MF_DEL_BTN["Btn: Remover"]
            MF_CLOSE["Btn: Fechar"]
        end

        subgraph MOD_IMGS["MODAL IMAGENS"]
            MI_OPEN["showServiceImages(id)"]
            MI_COLLECT["Coleta todas imagens"]
            MI_GALLERY["Renderiza galeria"]
            MI_THUMB["Thumbnails"]
            MI_BADGES["Badges tipo"]
            MI_CLICK["Click thumbnail"]
            MI_VIEWER["Abre viewer"]
            MI_PREV["Btn: Anterior"]
            MI_NEXT["Btn: Proximo"]
            MI_DOWN["Btn: Baixar"]
            MI_CLOSE["Btn: Fechar"]
        end

        subgraph MOD_DEL["MODAL ENTREGA"]
            MD_OPEN["showDeliveryInfo(id)"]
            MD_BUILD["Monta HTML"]
            MD_METHOD["Exibe metodo"]
            MD_PICKUP["Info retirada"]
            MD_SEDEX["Info endereco"]
            MD_CLOSE["Btn: Fechar"]
        end
    end

    FILES_MODAL --> MF_OPEN
    MF_OPEN --> MF_GET
    MF_GET --> MF_RENDER

    IMGS_MODAL --> MI_OPEN
    MI_OPEN --> MI_COLLECT
    MI_COLLECT --> MI_GALLERY
    MI_GALLERY --> MI_THUMB
    MI_THUMB --> MI_CLICK
    MI_CLICK --> MI_VIEWER

    DEL_MODAL --> MD_OPEN
    MD_OPEN --> MD_BUILD
    MD_BUILD --> MD_METHOD

    %% ========================================
    %% UPLOAD DE ARQUIVOS
    %% ========================================

    subgraph UPLOAD_SYS["13. UPLOAD"]
        subgraph UP_SELECT["SELECAO"]
            US_FILE["Input arquivos"]
            US_VALIDATE_F{"Extensao valida?"}
            US_ADD_F["state.selectedFiles.push()"]
            US_PREVIEW_F["Renderiza preview"]

            US_IMG["Input imagens"]
            US_VALIDATE_I{"Extensao valida?"}
            US_ADD_I["state.selectedImages.push()"]
            US_READER["FileReader"]
            US_PREVIEW_I["Renderiza preview"]
        end

        subgraph UP_PROCESS["PROCESSO"]
            UP_CALL["uploadMultipleFiles()"]
            UP_PROGRESS["Cria progressBar"]
            UP_PARALLEL["Promise.all()"]
            UP_SINGLE["uploadFile()"]
            UP_REF["storage.ref()"]
            UP_PUT["storageRef.put()"]
            UP_URL["getDownloadURL()"]
            UP_RESULT["return {url, name, size}"]
            UP_UPDATE_PROG["Atualiza progress"]
            UP_REMOVE_PROG["Remove progressBar"]
        end
    end

    US_FILE --> US_VALIDATE_F
    US_VALIDATE_F -->|Sim| US_ADD_F
    US_ADD_F --> US_PREVIEW_F

    US_IMG --> US_VALIDATE_I
    US_VALIDATE_I -->|Sim| US_ADD_I
    US_ADD_I --> US_READER
    US_READER --> US_PREVIEW_I

    UP_CALL --> UP_PROGRESS
    UP_PROGRESS --> UP_PARALLEL
    UP_PARALLEL --> UP_SINGLE
    UP_SINGLE --> UP_REF
    UP_REF --> UP_PUT
    UP_PUT --> UP_URL
    UP_URL --> UP_RESULT
    UP_RESULT --> UP_UPDATE_PROG
    UP_UPDATE_PROG --> UP_PARALLEL
    UP_PARALLEL -->|fim| UP_REMOVE_PROG

    %% ========================================
    %% INTEGRACAO ESTOQUE
    %% ========================================

    subgraph ESTOQUE["14. INTEGRACAO ESTOQUE"]
        subgraph EST_LOAD["CARREGAR"]
            EL_CALL["loadAvailableFilaments()"]
            EL_GET["db.collection('filaments').get()"]
            EL_MAP["Mapeia documentos"]
            EL_SET["availableFilaments = [...]"]
        end

        subgraph EST_MAT["MATERIAIS"]
            EM_CALL["updateMaterialDropdown()"]
            EM_FILTER["Filtra weight > 0"]
            EM_UNIQUE["Tipos unicos"]
            EM_OPTIONS["Cria options"]
        end

        subgraph EST_COR["CORES"]
            EC_CALL["updateColorDropdown()"]
            EC_FILTER["Filtra por material"]
            EC_GROUP["Agrupa por cor"]
            EC_BEST["Melhor marca (mais estoque)"]
            EC_OPTIONS["Cria options"]
        end

        subgraph EST_CHECK["VERIFICAR"]
            EV_CALL["checkStockAvailability()"]
            EV_FIND["findBestFilament()"]
            EV_COMPARE{"peso <= disponivel?"}
            EV_OK["hasStock = true"]
            EV_FAIL["hasStock = false"]
        end

        subgraph EST_DEDUCT["DEDUZIR"]
            ED_CALL["deductMaterialFromStock()"]
            ED_FIND["Busca filamento"]
            ED_CALC["Calcula novo peso"]
            ED_UPDATE["db.doc.update({weight})"]
            ED_TOAST["Toast: Estoque atualizado"]
        end
    end

    %% ========================================
    %% TOAST E CONEXAO
    %% ========================================

    subgraph TOAST_SYS["15. TOAST/CONEXAO"]
        subgraph TOAST_FLOW["TOAST"]
            TF_CALL["showToast(msg, type)"]
            TF_CREATE["Cria elemento"]
            TF_APPEND["Adiciona ao container"]
            TF_TIMEOUT["setTimeout 3000ms"]
            TF_REMOVE["Remove elemento"]
        end

        subgraph CONN_FLOW["CONEXAO"]
            CF_MONITOR["monitorConnection()"]
            CF_ONLINE["Event: online"]
            CF_OFFLINE["Event: offline"]
            CF_UPDATE["Atualiza status"]
        end
    end

    %% ========================================
    %% ESTILOS
    %% ========================================

    style ERROR_FIREBASE fill:#ff6b6b
    style ERR_AUTH fill:#ff6b6b
    style ERR_AUTH2 fill:#ff6b6b
    style ERR_AUTH3 fill:#ff6b6b
    style ERR_DEL fill:#ff6b6b
    style ERR_DATE fill:#ff6b6b
    style ERR_SKIP fill:#ff6b6b
    style ERR_PACK fill:#ff6b6b
    style ERR_TRACK fill:#ff6b6b
    style ERR_INSTA fill:#ff6b6b
    style SHOW_DENIED fill:#ff6b6b

    style TOAST_WELCOME fill:#51cf66
    style TOAST_UPD fill:#51cf66
    style TOAST_NEW fill:#51cf66
    style CP_TOAST fill:#51cf66
    style CI_TOAST fill:#51cf66
    style CN_TOAST fill:#51cf66
    style DEL_TOAST fill:#51cf66
    style CLOSE_MODAL_SAVE fill:#51cf66
    style CLOSE_STATUS_FINAL fill:#51cf66
```

---

## Instrucoes:

1. Copie todo o codigo entre ` ```mermaid ` e ` ``` `
2. Acesse https://mermaid.live
3. Cole no editor
4. O diagrama sera renderizado automaticamente

**Nota:** Este e um diagrama muito grande. Se o Mermaid Live apresentar problemas de performance, considere usar os fluxogramas separados do arquivo `fluxograma-servicos-detalhado.md`.
