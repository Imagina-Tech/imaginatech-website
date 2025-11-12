// ===========================
// SISTEMA DE TAREFAS
// ImaginaTech - Gestão de Tarefas
// FASE 1 - MVP
// ===========================

import { state } from './config.js';
import { showToast } from './auth-ui.js';

// ===========================
// CONSTANTES
// ===========================

const AUTHORIZED_ADMINS = [
    { email: '3d3printers@gmail.com', name: 'ADMIN' },
    { email: 'netrindademarcus@gmail.com', name: 'Trindade' },
    { email: 'allanedg01@gmail.com', name: 'Gonçalves' },
    { email: 'quequell1010@gmail.com', name: 'Raquel' },
    { email: 'igor.butter@gmail.com', name: 'Leão' }
];

const PRIORITY_CONFIG = {
    alta: { icon: '🔴', color: '#FF0055', label: 'Alta' },
    media: { icon: '🟡', color: '#FFD700', label: 'Média' },
    baixa: { icon: '🟢', color: '#00FF88', label: 'Baixa' }
};

// ===========================
// ESTADO DO SISTEMA
// ===========================

const tasksState = {
    tasks: [],
    filteredTasks: [],
    viewMode: 'mine', // 'mine' | 'all'
    statusFilter: 'all', // 'all' | 'pendente' | 'concluida'
    unsubscribe: null,
    dropdownOpen: false,
    currentUser: null
};

// ===========================
// INICIALIZAÇÃO
// ===========================

export function initTasksSystem() {
    console.log('🎯 Inicializando sistema de tarefas...');

    if (!state.currentUser) {
        console.warn('Usuário não autenticado. Sistema de tarefas não será inicializado.');
        return;
    }

    tasksState.currentUser = state.currentUser;

    // Criar elementos do UI
    createTasksUI();

    // Iniciar listener de tarefas
    startTasksListener();

    // Event listeners
    setupEventListeners();

    console.log('✅ Sistema de tarefas inicializado');
}

// ===========================
// CRIAÇÃO DO UI
// ===========================

function createTasksUI() {
    // Verificar se o botão já existe
    if (document.getElementById('tasksIconWrapper')) {
        console.log('UI de tarefas já existe');
        return;
    }

    // Encontrar navbar-right
    const navbarRight = document.querySelector('.navbar-right');
    if (!navbarRight) {
        console.error('navbar-right não encontrado');
        return;
    }

    // Criar wrapper do ícone
    const wrapper = document.createElement('div');
    wrapper.id = 'tasksIconWrapper';
    wrapper.className = 'tasks-icon-wrapper';

    // Criar botão de tarefas
    wrapper.innerHTML = `
        <button class="btn-tasks" id="btnTasks">
            <i class="fas fa-clipboard-list"></i>
            <span>Tarefas</span>
            <span class="tasks-badge hidden" id="tasksBadge">0</span>
        </button>

        <!-- Dropdown -->
        <div class="tasks-dropdown" id="tasksDropdown">
            <div class="tasks-dropdown-header">
                <div class="tasks-dropdown-title">
                    <i class="fas fa-clipboard-list"></i>
                    <span id="dropdownTitle">Minhas Tarefas (0)</span>
                </div>
                <div class="tasks-dropdown-actions">
                    <button class="btn-new-task" id="btnNewTask">
                        <i class="fas fa-plus"></i>
                        Nova
                    </button>
                </div>
            </div>

            <!-- Admins overview -->
            <div class="tasks-admins-overview" id="tasksAdminsOverview">
                <!-- Será preenchido dinamicamente -->
            </div>

            <div class="tasks-filters">
                <div class="tasks-toggle">
                    <button class="active" data-view="mine">Minhas</button>
                    <button data-view="all">Todas</button>
                </div>
                <select class="tasks-status-filter" id="statusFilter">
                    <option value="all">Todas as Tarefas</option>
                    <option value="pendente">Apenas Pendentes</option>
                    <option value="concluida">Apenas Concluídas</option>
                </select>
            </div>

            <div class="tasks-list" id="tasksList">
                <div class="tasks-empty">
                    <i class="fas fa-clipboard-check"></i>
                    <p><strong>Nenhuma tarefa encontrada</strong></p>
                    <p>Crie uma nova tarefa ou ajuste os filtros</p>
                </div>
            </div>

            <div class="tasks-footer">
                <a href="#" id="btnViewCompleted">Ver tarefas concluídas (0)</a>
            </div>
        </div>
    `;

    // Inserir antes do user-info
    const userInfo = navbarRight.querySelector('.user-info');
    if (userInfo) {
        navbarRight.insertBefore(wrapper, userInfo);
    } else {
        navbarRight.appendChild(wrapper);
    }

    // Criar modal
    createTaskModal();
}

function createTaskModal() {
    // Verificar se já existe
    if (document.getElementById('taskModalOverlay')) {
        return;
    }

    const modalHTML = `
        <div class="task-modal-overlay" id="taskModalOverlay">
            <div class="task-modal">
                <div class="task-modal-header">
                    <div class="task-modal-title">
                        <i class="fas fa-plus-circle"></i>
                        <span id="modalTitle">Nova Tarefa</span>
                    </div>
                    <button class="btn-close-modal" id="btnCloseModal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <div class="task-modal-body">
                    <form id="taskForm">
                        <!-- Título -->
                        <div class="task-form-group">
                            <label class="task-form-label required">
                                <i class="fas fa-heading"></i>
                                Título
                            </label>
                            <input type="text" class="task-form-input" id="taskTitle"
                                   placeholder="Ex: Embalar pedido #ABC123" required>
                        </div>

                        <!-- Categoria -->
                        <div class="task-form-group">
                            <label class="task-form-label required">
                                <i class="fas fa-tag"></i>
                                Categoria
                            </label>
                            <input type="text" class="task-form-input" id="taskCategory"
                                   placeholder="Ex: Produção, Atendimento, Financeiro" required>
                        </div>

                        <!-- Descrição -->
                        <div class="task-form-group">
                            <label class="task-form-label">
                                <i class="fas fa-align-left"></i>
                                Descrição (opcional)
                            </label>
                            <textarea class="task-form-textarea" id="taskDescription"
                                      placeholder="Detalhes adicionais..."></textarea>
                        </div>

                        <!-- Responsáveis -->
                        <div class="task-form-group">
                            <label class="task-form-label required">
                                <i class="fas fa-users"></i>
                                Responsável(is)
                            </label>
                            <div class="assignees-list" id="assigneesList"></div>
                        </div>

                        <!-- Prazo -->
                        <div class="task-form-group">
                            <label class="task-form-label required">
                                <i class="fas fa-calendar-alt"></i>
                                Prazo
                            </label>
                            <input type="datetime-local" class="task-form-input" id="taskDueDate" required>
                        </div>

                        <!-- Prioridade -->
                        <div class="task-form-group">
                            <label class="task-form-label required">
                                <i class="fas fa-exclamation-circle"></i>
                                Prioridade
                            </label>
                            <div class="priority-selector">
                                <div class="priority-option alta" data-priority="alta">
                                    <i class="fas fa-circle"></i>
                                    <span>Alta</span>
                                </div>
                                <div class="priority-option media selected" data-priority="media">
                                    <i class="fas fa-circle"></i>
                                    <span>Média</span>
                                </div>
                                <div class="priority-option baixa" data-priority="baixa">
                                    <i class="fas fa-circle"></i>
                                    <span>Baixa</span>
                                </div>
                            </div>
                        </div>

                        <!-- Pedido vinculado (opcional) -->
                        <div class="task-form-group">
                            <label class="task-form-label">
                                <i class="fas fa-link"></i>
                                Código do Pedido (opcional)
                            </label>
                            <input type="text" class="task-form-input" id="taskOrderCode"
                                   placeholder="Ex: ABC123" style="text-transform: uppercase;">
                        </div>
                    </form>
                </div>

                <div class="task-modal-footer">
                    <button type="button" class="btn-task btn-task-secondary" id="btnCancelTask">
                        Cancelar
                    </button>
                    <button type="submit" form="taskForm" class="btn-task btn-task-primary" id="btnSaveTask">
                        <i class="fas fa-check"></i>
                        Criar Tarefa
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Popular lista de responsáveis
    populateAssigneesList();
}

function populateAssigneesList() {
    const list = document.getElementById('assigneesList');
    if (!list) return;

    list.innerHTML = AUTHORIZED_ADMINS.map(admin => `
        <label class="assignee-option">
            <input type="checkbox" class="assignee-checkbox" value="${admin.email}">
            <span class="assignee-name">${admin.name}</span>
        </label>
    `).join('');
}

// ===========================
// EVENT LISTENERS
// ===========================

function setupEventListeners() {
    // Toggle dropdown
    const btnTasks = document.getElementById('btnTasks');
    btnTasks?.addEventListener('click', toggleDropdown);

    // Fechar dropdown ao clicar fora
    document.addEventListener('click', (e) => {
        const wrapper = document.getElementById('tasksIconWrapper');
        if (wrapper && !wrapper.contains(e.target) && tasksState.dropdownOpen) {
            closeDropdown();
        }
    });

    // Nova tarefa
    document.getElementById('btnNewTask')?.addEventListener('click', openTaskModal);

    // Toggle view (Minhas/Todas)
    document.querySelectorAll('.tasks-toggle button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tasks-toggle button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tasksState.viewMode = btn.dataset.view;
            filterAndRenderTasks();
        });
    });

    // Status filter
    document.getElementById('statusFilter')?.addEventListener('change', (e) => {
        tasksState.statusFilter = e.target.value;
        filterAndRenderTasks();
    });

    // Modal events
    document.getElementById('btnCloseModal')?.addEventListener('click', closeTaskModal);
    document.getElementById('btnCancelTask')?.addEventListener('click', closeTaskModal);
    document.getElementById('taskModalOverlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'taskModalOverlay') closeTaskModal();
    });

    // Form submit
    document.getElementById('taskForm')?.addEventListener('submit', handleCreateTask);

    // Priority selector
    document.querySelectorAll('.priority-option').forEach(option => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.priority-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
        });
    });

    // Ver concluídas
    document.getElementById('btnViewCompleted')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('statusFilter').value = 'concluida';
        tasksState.statusFilter = 'concluida';
        filterAndRenderTasks();
    });
}

function toggleDropdown() {
    const dropdown = document.getElementById('tasksDropdown');
    if (!dropdown) return;

    if (tasksState.dropdownOpen) {
        closeDropdown();
    } else {
        dropdown.classList.add('active');
        tasksState.dropdownOpen = true;
    }
}

function closeDropdown() {
    const dropdown = document.getElementById('tasksDropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
        tasksState.dropdownOpen = false;
    }
}

function openTaskModal() {
    const modal = document.getElementById('taskModalOverlay');
    if (!modal) return;

    // Reset form
    document.getElementById('taskForm')?.reset();
    document.querySelectorAll('.assignee-checkbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.priority-option').forEach(o => o.classList.remove('selected'));
    document.querySelector('.priority-option.media')?.classList.add('selected');

    // Set default due date (tomorrow 18:00)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(18, 0, 0, 0);
    document.getElementById('taskDueDate').value = formatDateTimeLocal(tomorrow);

    modal.classList.add('active');
}

function closeTaskModal() {
    const modal = document.getElementById('taskModalOverlay');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ===========================
// FIRESTORE LISTENER
// ===========================

function startTasksListener() {
    if (tasksState.unsubscribe) {
        tasksState.unsubscribe();
    }

    console.log('📡 Iniciando listener de tarefas...');

    tasksState.unsubscribe = state.db.collection('tasks')
        .orderBy('priority', 'asc') // alta=0, media=1, baixa=2
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            tasksState.tasks = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`📋 ${tasksState.tasks.length} tarefas carregadas`);

            filterAndRenderTasks();
            updateBadge();
        }, error => {
            console.error('Erro ao carregar tarefas:', error);
            showToast('Erro ao carregar tarefas', 'error');
        });
}

// ===========================
// FILTROS E RENDERIZAÇÃO
// ===========================

async function renderAdminsOverview() {
    const container = document.getElementById('tasksAdminsOverview');
    if (!container) return;

    // Calcular tarefas pendentes por admin
    const pendingTasksByAdmin = {};

    // Inicializar contadores
    AUTHORIZED_ADMINS.forEach(admin => {
        pendingTasksByAdmin[admin.email] = 0;
    });

    // Contar tarefas pendentes
    tasksState.tasks
        .filter(task => task.status === 'pendente')
        .forEach(task => {
            if (task.assignedTo && Array.isArray(task.assignedTo)) {
                task.assignedTo.forEach(email => {
                    if (pendingTasksByAdmin.hasOwnProperty(email)) {
                        pendingTasksByAdmin[email]++;
                    }
                });
            }
        });

    // Renderizar apenas admins COM tarefas pendentes
    const adminsWithTasks = AUTHORIZED_ADMINS.filter(admin => pendingTasksByAdmin[admin.email] > 0);

    if (adminsWithTasks.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';

    // Buscar fotos de forma assíncrona
    const adminsData = await Promise.all(
        adminsWithTasks.map(async (admin) => {
            const count = pendingTasksByAdmin[admin.email];
            const photoURL = await getAdminPhotoURL(admin.email);
            return { admin, count, photoURL };
        })
    );

    const adminsHTML = adminsData.map(({ admin, count, photoURL }) => {
        return `
            <div class="admin-overview-item">
                <div class="admin-avatar" style="background-image: url('${photoURL}')"></div>
                <div class="admin-info">
                    <span class="admin-name">${escapeHtml(admin.name)}</span>
                    <span class="admin-tasks-count has-tasks">${count}</span>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = adminsHTML;
}

async function getAdminPhotoURL(email) {
    // 1. Tentar obter foto do usuário logado atual
    if (state.currentUser && state.currentUser.email === email && state.currentUser.photoURL) {
        return state.currentUser.photoURL;
    }

    // 2. Tentar obter do Firebase Auth atual
    const auth = firebase.auth();
    const user = auth.currentUser;
    if (user && user.email === email && user.photoURL) {
        return user.photoURL;
    }

    // 3. Tentar buscar no Firestore (adminUsers collection)
    try {
        const userDoc = await state.db.collection('adminUsers').doc(email).get();
        if (userDoc.exists && userDoc.data().photoURL) {
            return userDoc.data().photoURL;
        }
    } catch (error) {
        console.log('Não foi possível buscar foto do Firestore:', error);
    }

    // 4. Fallback: gerar avatar com iniciais
    const name = AUTHORIZED_ADMINS.find(a => a.email === email)?.name || email.split('@')[0];
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=00D4FF&color=fff&bold=true&size=128`;
}

function filterAndRenderTasks() {
    const userEmail = tasksState.currentUser?.email;
    let filtered = [...tasksState.tasks];

    // Filtro por responsável (Minhas / Todas)
    if (tasksState.viewMode === 'mine') {
        filtered = filtered.filter(task =>
            task.assignedTo && task.assignedTo.includes(userEmail)
        );
    }

    // Filtro por status
    if (tasksState.statusFilter !== 'all') {
        filtered = filtered.filter(task => task.status === tasksState.statusFilter);
    } else {
        // No modo "Todas", mostrar apenas pendentes por padrão para todos
        if (tasksState.viewMode === 'all') {
            filtered = filtered.filter(task => task.status === 'pendente');
        }
    }

    tasksState.filteredTasks = filtered;
    renderAdminsOverview(); // Renderizar overview dos admins
    renderTasksList();
    updateDropdownTitle();
}

function renderTasksList() {
    const container = document.getElementById('tasksList');
    if (!container) return;

    if (tasksState.filteredTasks.length === 0) {
        container.innerHTML = `
            <div class="tasks-empty">
                <i class="fas fa-clipboard-check"></i>
                <p><strong>Nenhuma tarefa encontrada</strong></p>
                <p>Crie uma nova tarefa ou ajuste os filtros</p>
            </div>
        `;
        return;
    }

    // Ordenar por prioridade e data
    const sorted = [...tasksState.filteredTasks].sort((a, b) => {
        const priorityOrder = { alta: 0, media: 1, baixa: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    container.innerHTML = sorted.map(task => renderTaskCard(task)).join('');

    // Add event listeners
    attachTaskEventListeners();
}

function renderTaskCard(task) {
    const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.media;
    const isCompleted = task.status === 'concluida';
    const dueDate = new Date(task.dueDate);
    const now = new Date();
    const isOverdue = dueDate < now && !isCompleted;
    const creatorName = AUTHORIZED_ADMINS.find(a => a.email === task.createdBy)?.name || 'Desconhecido';

    return `
        <div class="task-card priority-${task.priority} ${isCompleted ? 'completed' : ''}" data-task-id="${task.id}">
            <div class="task-card-header">
                <div class="task-checkbox ${isCompleted ? 'checked' : ''}"
                     onclick="toggleTaskComplete('${task.id}', ${!isCompleted})">
                </div>
                <div class="task-card-content">
                    <div class="task-title-row">
                        <span class="task-priority-icon">${priority.icon}</span>
                        <span class="task-title">${escapeHtml(task.title)}</span>
                    </div>
                    <div class="task-meta">
                        <span class="task-meta-item">
                            <i class="fas fa-calendar"></i>
                            ${isOverdue ? '⚠️ ' : ''}${formatDueDate(task.dueDate)}
                        </span>
                        ${task.category ? `<span class="task-category">${escapeHtml(task.category)}</span>` : ''}
                        ${task.createdBy !== tasksState.currentUser.email ?
                            `<span class="task-meta-item">
                                <i class="fas fa-user"></i>
                                ${creatorName}
                            </span>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function attachTaskEventListeners() {
    document.querySelectorAll('.task-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Ignorar clique no checkbox
            if (e.target.closest('.task-checkbox')) return;

            const taskId = card.dataset.taskId;
            const task = tasksState.tasks.find(t => t.id === taskId);
            if (task) {
                showTaskDetails(task);
            }
        });
    });
}

// ===========================
// AÇÕES DE TAREFA
// ===========================

window.toggleTaskComplete = async function(taskId, completed) {
    try {
        await state.db.collection('tasks').doc(taskId).update({
            status: completed ? 'concluida' : 'pendente',
            completedAt: completed ? new Date().toISOString() : null,
            completedBy: completed ? tasksState.currentUser.email : null,
            updatedAt: new Date().toISOString()
        });

        showToast(
            completed ? '✓ Tarefa concluída!' : 'Tarefa reaberta',
            completed ? 'success' : 'info'
        );
    } catch (error) {
        console.error('Erro ao atualizar tarefa:', error);
        showToast('Erro ao atualizar tarefa', 'error');
    }
};

function showTaskDetails(task) {
    // Criar modal de detalhes
    const detailsModal = createTaskDetailsModal(task);
    document.body.appendChild(detailsModal);

    // Listener de comentários em tempo real
    startCommentsListener(task.id);

    // Setup event listeners
    setupDetailsModalListeners(task);
}

function createTaskDetailsModal(task) {
    const modal = document.createElement('div');
    modal.className = 'task-modal-overlay active';
    modal.id = 'taskDetailsModal';

    const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.media;
    const creatorName = AUTHORIZED_ADMINS.find(a => a.email === task.createdBy)?.name || task.createdBy;
    const assignedNames = task.assignedTo.map(email =>
        AUTHORIZED_ADMINS.find(a => a.email === email)?.name || email
    ).join(', ');

    const isCompleted = task.status === 'concluida';
    const isNotFeasible = task.status === 'nao_factivel';

    modal.innerHTML = `
        <div class="task-modal" style="max-width: 700px;">
            <div class="task-modal-header">
                <div class="task-modal-title">
                    <span style="font-size: 1.5rem;">${priority.icon}</span>
                    <span>Detalhes da Tarefa</span>
                </div>
                <button class="btn-close-modal" onclick="closeTaskDetailsModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <div class="task-modal-body" style="max-height: 70vh; overflow-y: auto;">
                <!-- Título -->
                <div class="task-detail-section">
                    <h2 style="margin: 0 0 1rem 0; color: ${priority.color}; font-size: 1.3rem;">
                        ${escapeHtml(task.title)}
                    </h2>

                    <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1rem;">
                        ${task.category ? `<span class="task-category">${escapeHtml(task.category)}</span>` : ''}
                        <span class="task-category" style="background: ${priority.color}20; color: ${priority.color};">
                            ${priority.label} Prioridade
                        </span>
                        ${isCompleted ? '<span class="task-category" style="background: rgba(0,255,136,0.2); color: var(--neon-green);">✓ Concluída</span>' : ''}
                        ${isNotFeasible ? '<span class="task-category" style="background: rgba(255,0,85,0.2); color: var(--neon-red);">✗ Não Factível</span>' : ''}
                    </div>
                </div>

                <!-- Informações -->
                <div class="task-detail-section">
                    <div class="task-detail-grid">
                        <div class="task-detail-item">
                            <i class="fas fa-user"></i>
                            <div>
                                <strong>Criado por</strong>
                                <p>${creatorName}</p>
                            </div>
                        </div>

                        <div class="task-detail-item">
                            <i class="fas fa-users"></i>
                            <div>
                                <strong>Responsável(is)</strong>
                                <p>${assignedNames}</p>
                            </div>
                        </div>

                        <div class="task-detail-item">
                            <i class="fas fa-calendar-plus"></i>
                            <div>
                                <strong>Criada em</strong>
                                <p>${formatDateTime(task.createdAt)}</p>
                            </div>
                        </div>

                        <div class="task-detail-item">
                            <i class="fas fa-calendar-check"></i>
                            <div>
                                <strong>Prazo</strong>
                                <p>${formatDateTime(task.dueDate)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Descrição -->
                ${task.description ? `
                <div class="task-detail-section">
                    <h3><i class="fas fa-align-left"></i> Descrição</h3>
                    <p style="color: var(--text-secondary); line-height: 1.6;">${escapeHtml(task.description)}</p>
                </div>
                ` : ''}

                <!-- Pedido vinculado -->
                ${task.linkedOrderCode ? `
                <div class="task-detail-section">
                    <h3><i class="fas fa-link"></i> Pedido Vinculado</h3>
                    <p>
                        <span class="task-category" style="font-family: 'Orbitron', monospace; font-size: 1rem;">
                            #${task.linkedOrderCode}
                        </span>
                    </p>
                </div>
                ` : ''}

                <!-- Anexos -->
                ${task.attachments && task.attachments.length > 0 ? `
                <div class="task-detail-section">
                    <h3><i class="fas fa-paperclip"></i> Anexos (${task.attachments.length})</h3>
                    <div class="attachments-list">
                        ${task.attachments.map(att => `
                            <a href="${att.url}" target="_blank" class="attachment-item">
                                <i class="fas fa-file"></i>
                                <span>${att.name}</span>
                            </a>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- Comentários -->
                <div class="task-detail-section">
                    <h3><i class="fas fa-comments"></i> Comentários <span id="commentsCount">(0)</span></h3>
                    <div class="comments-container" id="commentsContainer">
                        <div class="comments-loading">
                            <i class="fas fa-spinner fa-spin"></i>
                            Carregando comentários...
                        </div>
                    </div>

                    ${!isCompleted && !isNotFeasible ? `
                    <div class="comment-input-container">
                        <textarea id="commentInput" placeholder="Adicionar comentário..."
                                  class="task-form-textarea" style="min-height: 80px;"></textarea>
                        <button class="btn-task btn-task-primary" onclick="addComment('${task.id}')">
                            <i class="fas fa-paper-plane"></i>
                            Enviar
                        </button>
                    </div>
                    ` : ''}
                </div>
            </div>

            <div class="task-modal-footer">
                ${!isCompleted && !isNotFeasible ? `
                    <button class="btn-task btn-task-secondary" onclick="openTransferModal('${task.id}')">
                        <i class="fas fa-exchange-alt"></i>
                        Transferir
                    </button>
                    <button class="btn-task btn-task-secondary" onclick="openAttachmentsModal('${task.id}')">
                        <i class="fas fa-paperclip"></i>
                        Anexar
                    </button>
                    <button class="btn-task btn-task-secondary" style="border-color: var(--neon-red); color: var(--neon-red);"
                            onclick="markAsNotFeasible('${task.id}')">
                        <i class="fas fa-times-circle"></i>
                        Não Factível
                    </button>
                    <button class="btn-task btn-task-primary" onclick="toggleTaskComplete('${task.id}', true)">
                        <i class="fas fa-check"></i>
                        Concluir
                    </button>
                ` : `
                    <button class="btn-task btn-task-secondary" onclick="closeTaskDetailsModal()">
                        Fechar
                    </button>
                `}
            </div>
        </div>
    `;

    return modal;
}

function setupDetailsModalListeners(task) {
    // Fechar ao clicar fora
    const overlay = document.getElementById('taskDetailsModal');
    overlay?.addEventListener('click', (e) => {
        if (e.target.id === 'taskDetailsModal') {
            closeTaskDetailsModal();
        }
    });

    // Esc para fechar
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeTaskDetailsModal();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);
}

window.closeTaskDetailsModal = function() {
    const modal = document.getElementById('taskDetailsModal');
    if (modal) {
        // Parar listener de comentários
        if (tasksState.commentsUnsubscribe) {
            tasksState.commentsUnsubscribe();
            tasksState.commentsUnsubscribe = null;
        }
        modal.remove();
    }
};

// ===========================
// COMENTÁRIOS
// ===========================

function startCommentsListener(taskId) {
    if (tasksState.commentsUnsubscribe) {
        tasksState.commentsUnsubscribe();
    }

    tasksState.commentsUnsubscribe = state.db.collection('tasks').doc(taskId)
        .onSnapshot(doc => {
            if (doc.exists) {
                const task = doc.data();
                const comments = task.comments || [];
                renderComments(comments);
            }
        });
}

function renderComments(comments) {
    const container = document.getElementById('commentsContainer');
    const countSpan = document.getElementById('commentsCount');

    if (!container) return;

    countSpan.textContent = `(${comments.length})`;

    if (comments.length === 0) {
        container.innerHTML = `
            <div class="comments-empty">
                <i class="fas fa-comments"></i>
                <p>Nenhum comentário ainda</p>
            </div>
        `;
        return;
    }

    // Ordenar por data (mais recentes por último)
    const sorted = [...comments].sort((a, b) =>
        new Date(a.timestamp) - new Date(b.timestamp)
    );

    container.innerHTML = sorted.map(comment => {
        const authorName = AUTHORIZED_ADMINS.find(a => a.email === comment.author)?.name || comment.author;
        const isOwn = comment.author === tasksState.currentUser.email;

        return `
            <div class="comment-item ${isOwn ? 'own' : ''}">
                <div class="comment-header">
                    <strong>${authorName}</strong>
                    <span class="comment-time">${formatCommentTime(comment.timestamp)}</span>
                </div>
                <div class="comment-text">${escapeHtml(comment.text)}</div>
            </div>
        `;
    }).join('');

    // Scroll para o final
    container.scrollTop = container.scrollHeight;
}

window.addComment = async function(taskId) {
    const input = document.getElementById('commentInput');
    if (!input) return;

    const text = input.value.trim();
    if (!text) {
        showToast('Digite um comentário', 'error');
        return;
    }

    try {
        const task = tasksState.tasks.find(t => t.id === taskId);
        const comments = task.comments || [];

        comments.push({
            author: tasksState.currentUser.email,
            text,
            timestamp: new Date().toISOString()
        });

        await state.db.collection('tasks').doc(taskId).update({
            comments,
            updatedAt: new Date().toISOString()
        });

        input.value = '';
        showToast('✓ Comentário adicionado', 'success');
    } catch (error) {
        console.error('Erro ao adicionar comentário:', error);
        showToast('Erro ao adicionar comentário', 'error');
    }
};

// ===========================
// TRANSFERIR TAREFA
// ===========================

window.openTransferModal = function(taskId) {
    const task = tasksState.tasks.find(t => t.id === taskId);
    if (!task) return;

    const transferModal = document.createElement('div');
    transferModal.className = 'task-modal-overlay active';
    transferModal.id = 'transferModal';
    transferModal.style.zIndex = '10001';

    transferModal.innerHTML = `
        <div class="task-modal" style="max-width: 500px;">
            <div class="task-modal-header">
                <div class="task-modal-title">
                    <i class="fas fa-exchange-alt"></i>
                    <span>Transferir Tarefa</span>
                </div>
                <button class="btn-close-modal" onclick="closeTransferModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <div class="task-modal-body">
                <p style="color: var(--text-secondary); margin-bottom: 1rem;">
                    Selecione os novos responsáveis para: <strong>${escapeHtml(task.title)}</strong>
                </p>

                <div class="assignees-list" id="transferAssigneesList">
                    ${AUTHORIZED_ADMINS.map(admin => `
                        <label class="assignee-option">
                            <input type="checkbox" class="assignee-checkbox" value="${admin.email}"
                                   ${task.assignedTo.includes(admin.email) ? 'checked' : ''}>
                            <span class="assignee-name">${admin.name}</span>
                        </label>
                    `).join('')}
                </div>
            </div>

            <div class="task-modal-footer">
                <button class="btn-task btn-task-secondary" onclick="closeTransferModal()">
                    Cancelar
                </button>
                <button class="btn-task btn-task-primary" onclick="confirmTransfer('${taskId}')">
                    <i class="fas fa-check"></i>
                    Transferir
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(transferModal);
};

window.closeTransferModal = function() {
    document.getElementById('transferModal')?.remove();
};

window.confirmTransfer = async function(taskId) {
    const checkboxes = document.querySelectorAll('#transferAssigneesList .assignee-checkbox:checked');
    const newAssignedTo = Array.from(checkboxes).map(cb => cb.value);

    if (newAssignedTo.length === 0) {
        showToast('Selecione pelo menos um responsável', 'error');
        return;
    }

    try {
        await state.db.collection('tasks').doc(taskId).update({
            assignedTo: newAssignedTo,
            status: 'transferida',
            updatedAt: new Date().toISOString()
        });

        // Voltar para pendente imediatamente
        await state.db.collection('tasks').doc(taskId).update({
            status: 'pendente'
        });

        showToast('✓ Tarefa transferida!', 'success');
        closeTransferModal();
        closeTaskDetailsModal();
    } catch (error) {
        console.error('Erro ao transferir:', error);
        showToast('Erro ao transferir tarefa', 'error');
    }
};

// ===========================
// NÃO FACTÍVEL
// ===========================

window.markAsNotFeasible = async function(taskId) {
    if (!confirm('Tem certeza que deseja marcar esta tarefa como Não Factível?')) {
        return;
    }

    try {
        await state.db.collection('tasks').doc(taskId).update({
            status: 'nao_factivel',
            completedAt: new Date().toISOString(),
            completedBy: tasksState.currentUser.email,
            updatedAt: new Date().toISOString()
        });

        showToast('✓ Tarefa marcada como Não Factível', 'success');
        closeTaskDetailsModal();
    } catch (error) {
        console.error('Erro ao marcar como não factível:', error);
        showToast('Erro ao atualizar tarefa', 'error');
    }
};

// ===========================
// ANEXOS
// ===========================

window.openAttachmentsModal = function(taskId) {
    const attachModal = document.createElement('div');
    attachModal.className = 'task-modal-overlay active';
    attachModal.id = 'attachModal';
    attachModal.style.zIndex = '10001';

    attachModal.innerHTML = `
        <div class="task-modal" style="max-width: 500px;">
            <div class="task-modal-header">
                <div class="task-modal-title">
                    <i class="fas fa-paperclip"></i>
                    <span>Anexar Arquivo</span>
                </div>
                <button class="btn-close-modal" onclick="closeAttachModal()">
                    <i class="fas fa-times"></i>
                </button>
            </div>

            <div class="task-modal-body">
                <div class="task-form-group">
                    <label class="task-form-label">
                        <i class="fas fa-file-upload"></i>
                        Selecione um arquivo
                    </label>
                    <input type="file" id="attachmentInput" class="task-form-input"
                           accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt">
                    <small style="color: var(--text-secondary); margin-top: 0.5rem; display: block;">
                        Máximo: 10MB
                    </small>
                </div>

                <div id="attachmentPreview" style="display: none; margin-top: 1rem;">
                    <div style="display: flex; align-items: center; gap: 0.75rem; padding: 1rem;
                                background: var(--glass-bg); border-radius: 8px;">
                        <i class="fas fa-file" style="font-size: 2rem; color: var(--neon-blue);"></i>
                        <div style="flex: 1;">
                            <div id="attachmentName" style="font-weight: 600;"></div>
                            <div id="attachmentSize" style="font-size: 0.85rem; color: var(--text-secondary);"></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="task-modal-footer">
                <button class="btn-task btn-task-secondary" onclick="closeAttachModal()">
                    Cancelar
                </button>
                <button class="btn-task btn-task-primary" onclick="uploadAttachment('${taskId}')" id="btnUploadAttachment" disabled>
                    <i class="fas fa-upload"></i>
                    Enviar
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(attachModal);

    // Preview do arquivo
    document.getElementById('attachmentInput')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('attachmentPreview').style.display = 'block';
            document.getElementById('attachmentName').textContent = file.name;
            document.getElementById('attachmentSize').textContent = formatFileSize(file.size);
            document.getElementById('btnUploadAttachment').disabled = false;
        }
    });
};

window.closeAttachModal = function() {
    document.getElementById('attachModal')?.remove();
};

window.uploadAttachment = async function(taskId) {
    const input = document.getElementById('attachmentInput');
    const file = input?.files[0];

    if (!file) {
        showToast('Selecione um arquivo', 'error');
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showToast('Arquivo muito grande (máx: 10MB)', 'error');
        return;
    }

    try {
        showToast('Enviando arquivo...', 'info');

        // Upload para Firebase Storage
        const storageRef = firebase.storage().ref();
        const fileRef = storageRef.child(`tasks/${taskId}/${Date.now()}_${file.name}`);
        const uploadTask = await fileRef.put(file);
        const url = await uploadTask.ref.getDownloadURL();

        // Adicionar aos anexos da tarefa
        const task = tasksState.tasks.find(t => t.id === taskId);
        const attachments = task.attachments || [];

        attachments.push({
            name: file.name,
            url,
            uploadedBy: tasksState.currentUser.email,
            uploadedAt: new Date().toISOString(),
            size: file.size
        });

        await state.db.collection('tasks').doc(taskId).update({
            attachments,
            updatedAt: new Date().toISOString()
        });

        showToast('✓ Arquivo anexado!', 'success');
        closeAttachModal();

        // Recarregar modal de detalhes
        closeTaskDetailsModal();
        const updatedTask = tasksState.tasks.find(t => t.id === taskId);
        if (updatedTask) {
            setTimeout(() => showTaskDetails(updatedTask), 300);
        }
    } catch (error) {
        console.error('Erro ao enviar anexo:', error);
        showToast('Erro ao enviar arquivo', 'error');
    }
};

// ===========================
// UTILITÁRIOS FASE 2
// ===========================

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatCommentTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `Há ${minutes} min`;
    if (hours < 24) return `Há ${hours}h`;
    if (days === 1) return 'Ontem';
    if (days < 7) return `Há ${days} dias`;

    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Adicionar ao estado
tasksState.commentsUnsubscribe = null;


async function handleCreateTask(e) {
    e.preventDefault();

    const title = document.getElementById('taskTitle').value.trim();
    const category = document.getElementById('taskCategory').value.trim();
    const description = document.getElementById('taskDescription').value.trim();
    const dueDate = document.getElementById('taskDueDate').value;
    const orderCode = document.getElementById('taskOrderCode').value.trim().toUpperCase();

    // Pegar responsáveis selecionados
    const assignedTo = Array.from(document.querySelectorAll('.assignee-checkbox:checked'))
        .map(cb => cb.value);

    if (assignedTo.length === 0) {
        showToast('Selecione pelo menos um responsável', 'error');
        return;
    }

    // Pegar prioridade selecionada
    const selectedPriority = document.querySelector('.priority-option.selected');
    const priority = selectedPriority?.dataset.priority || 'media';

    try {
        const taskData = {
            title,
            category,
            description: description || null,
            assignedTo,
            createdBy: tasksState.currentUser.email,
            createdAt: new Date().toISOString(),
            dueDate: new Date(dueDate).toISOString(),
            priority,
            status: 'pendente',
            linkedOrderCode: orderCode || null,
            updatedAt: new Date().toISOString()
        };

        await state.db.collection('tasks').add(taskData);

        showToast('✓ Tarefa criada com sucesso!', 'success');
        closeTaskModal();
    } catch (error) {
        console.error('Erro ao criar tarefa:', error);
        showToast('Erro ao criar tarefa', 'error');
    }
}

// ===========================
// BADGE E NOTIFICAÇÕES
// ===========================

function updateBadge() {
    const badge = document.getElementById('tasksBadge');
    if (!badge) return;

    // Contar tarefas pendentes do usuário
    const myPendingTasks = tasksState.tasks.filter(task =>
        task.status === 'pendente' &&
        task.assignedTo &&
        task.assignedTo.includes(tasksState.currentUser.email)
    );

    const count = myPendingTasks.length;

    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
        badge.classList.add('pulsing');
    } else {
        badge.classList.add('hidden');
        badge.classList.remove('pulsing');
    }

    // Atualizar contador de concluídas
    const completedCount = tasksState.tasks.filter(task =>
        task.status === 'concluida' &&
        task.assignedTo &&
        task.assignedTo.includes(tasksState.currentUser.email)
    ).length;

    const btnViewCompleted = document.getElementById('btnViewCompleted');
    if (btnViewCompleted) {
        btnViewCompleted.textContent = `Ver tarefas concluídas (${completedCount})`;
    }
}

function updateDropdownTitle() {
    const title = document.getElementById('dropdownTitle');
    if (!title) return;

    const count = tasksState.filteredTasks.length;
    const viewText = tasksState.viewMode === 'mine' ? 'Minhas Tarefas' : 'Todas as Tarefas';
    title.textContent = `${viewText} (${count})`;
}

// ===========================
// UTILITÁRIOS
// ===========================

function formatDueDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = date - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (days < 0) return 'Atrasada';
    if (days === 0) {
        if (hours <= 0) return 'Vence agora!';
        return `Vence em ${hours}h`;
    }
    if (days === 1) return 'Vence amanhã';
    if (days <= 7) return `Vence em ${days} dias`;

    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===========================
// CLEANUP
// ===========================

export function destroyTasksSystem() {
    if (tasksState.unsubscribe) {
        tasksState.unsubscribe();
        tasksState.unsubscribe = null;
    }
    console.log('🗑️ Sistema de tarefas destruído');
}
