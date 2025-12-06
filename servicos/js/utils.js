/*
==================================================
ARQUIVO: servicos/js/utils.js
MÓDULO: Funções Utilitárias Compartilhadas
SISTEMA: ImaginaTech - Gestão de Impressão 3D
VERSÃO: 1.0
==================================================
*/

// ===========================
// ESCAPE & SANITIZAÇÃO
// ===========================
export const escapeHtml = text => text ? text.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])) : '';

// ===========================
// FORMATAÇÃO DE DATAS
// ===========================
export function getTodayBrazil() {
    const now = new Date();
    const brazilTime = new Date(now.getTime() - (now.getTimezoneOffset() + 180) * 60000);
    brazilTime.setHours(0, 0, 0, 0);
    return brazilTime.toISOString().split('T')[0];
}

export function parseDateBrazil(dateString) {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0);
}

export function calculateDaysRemaining(dueDate) {
    if (!dueDate) return null;
    const due = parseDateBrazil(dueDate);
    const today = parseDateBrazil(getTodayBrazil());
    return due && today ? Math.round((due - today) / 86400000) : null;
}

export const formatDate = dateString => dateString ? new Date(dateString).toLocaleDateString('pt-BR') : 'N/A';

export const formatDateBrazil = dateString => {
    if (!dateString) return 'N/A';
    const date = parseDateBrazil(dateString);
    return date ? date.toLocaleDateString('pt-BR') : 'N/A';
};

export const formatDaysText = days => days === null ? 'Sem prazo' : days === 0 ? 'Entrega hoje' : days === 1 ? 'Entrega amanhã' : days < 0 ? `${Math.abs(days)} dias atrás` : `${days} dias`;

export const getDaysColor = days => days === null ? 'var(--text-secondary)' : days < 0 ? 'var(--neon-red)' : days === 0 ? 'var(--neon-orange)' : days <= 2 ? 'var(--neon-yellow)' : 'var(--text-secondary)';

export function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

export function formatTimeAgo(dateString) {
    if (!dateString) return 'Nunca';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSecs < 60) return 'Agora mesmo';
    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `há ${diffDays} dias`;

    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function formatDateTimeLocal(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// ===========================
// FORMATAÇÃO DE VALORES
// ===========================
export const formatMoney = value => (!value || isNaN(value)) ? '0,00' : value.toFixed(2).replace('.', ',');

export const formatFileSize = bytes => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

export const formatColorName = color => ({
    'branco': 'Branco',
    'preto': 'Preto',
    'cinza': 'Cinza',
    'vermelho': 'Vermelho',
    'azul': 'Azul',
    'verde': 'Verde',
    'amarelo': 'Amarelo',
    'laranja': 'Laranja',
    'rosa': 'Rosa',
    'roxo': 'Roxo',
    'marrom': 'Marrom',
    'bege': 'Bege'
}[color] || color || 'N/A');

// ===========================
// STATUS & DELIVERY
// ===========================
export const getDeliveryMethodName = method => ({
    'retirada': 'Retirada',
    'sedex': 'SEDEX',
    'uber': 'Uber Flash',
    'definir': 'A Combinar'
}[method] || method || 'N/A');

export const getDeliveryIcon = method => ({
    'retirada': 'fa-store',
    'sedex': 'fa-truck',
    'uber': 'fa-motorcycle',
    'definir': 'fa-question-circle'
}[method] || 'fa-truck');

export const getStatusLabel = status => ({
    'pendente': 'Pendente',
    'producao': 'Em Produção',
    'concluido': 'Concluído',
    'retirada': 'Pronto/Postado',
    'entregue': 'Entregue',
    'modelando': 'Modelando',
    'modelagem_concluida': 'Concluído'
}[status] || status);

export const getStatusIcon = status => ({
    'pendente': 'fa-clock',
    'producao': 'fa-cog',
    'concluido': 'fa-check',
    'retirada': 'fa-box',
    'entregue': 'fa-check-double',
    'modelando': 'fa-cube',
    'modelagem_concluida': 'fa-check-circle'
}[status] || 'fa-question');

export const isStatusCompleted = (currentStatus, checkStatus) => {
    const order = ['pendente', 'producao', 'concluido', 'retirada', 'entregue'];
    return order.indexOf(currentStatus) > order.indexOf(checkStatus);
};

// ===========================
// VALIDAÇÃO
// ===========================
export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isRecentAccess(dateString, minutes = 15) {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 1000 / 60);
    return diffMins <= minutes;
}

// ===========================
// CONSTANTES DE STATUS
// ===========================
export const STATUS = {
    PENDENTE: 'pendente',
    PRODUCAO: 'producao',
    CONCLUIDO: 'concluido',
    RETIRADA: 'retirada',
    ENTREGUE: 'entregue',
    MODELANDO: 'modelando',
    MODELAGEM_CONCLUIDA: 'modelagem_concluida'
};

// Status para serviços de impressão
export const STATUS_ORDER = ['pendente', 'producao', 'concluido', 'retirada', 'entregue'];

// Status para serviços de modelagem (apenas 3 etapas)
export const STATUS_ORDER_MODELAGEM = ['pendente', 'producao', 'concluido'];

// Retorna a ordem de status baseada no tipo de serviço
export const getStatusOrderForService = (serviceType) => {
    return serviceType === 'modelagem' ? STATUS_ORDER_MODELAGEM : STATUS_ORDER;
};

export const PRIORITY_CONFIG = {
    urgente: { icon: '🔥', color: '#FF0055', label: 'Urgente' },
    alta: { icon: '🔴', color: '#FF0055', label: 'Alta' },
    media: { icon: '🟡', color: '#FFD700', label: 'Média' },
    baixa: { icon: '🟢', color: '#00FF88', label: 'Baixa' }
};
