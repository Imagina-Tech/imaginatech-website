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
    { email: '3d3printers@gmail.com', name: '3D Printers' },
    { email: 'netrindademarcus@gmail.com', name: 'Marcus Trindade' },
    { email: 'quequell1010@gmail.com', name: 'Quequell' },
    { email: 'igor.butter@gmail.com', name: 'Igor Butter' }
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
    // TODO: Implementar modal de detalhes (FASE 2)
    console.log('Detalhes da tarefa:', task);
    showToast('Detalhes da tarefa (em breve)', 'info');
}

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
