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
// VALIDAÇÃO DE ARQUIVOS (MAGIC BYTES)
// ===========================

/**
 * Magic bytes (assinaturas) de tipos de arquivo conhecidos
 * Formato: { bytes: Uint8Array, offset: number (opcional) }
 */
const FILE_SIGNATURES = {
    // Imagens
    'image/jpeg': [{ bytes: [0xFF, 0xD8, 0xFF] }],
    'image/png': [{ bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] }],
    'image/gif': [{ bytes: [0x47, 0x49, 0x46, 0x38] }], // GIF8
    'image/webp': [{ bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, { bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 }], // RIFF...WEBP
    'image/bmp': [{ bytes: [0x42, 0x4D] }], // BM

    // Documentos
    'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46] }], // %PDF

    // Arquivos compactados
    'application/zip': [{ bytes: [0x50, 0x4B, 0x03, 0x04] }, { bytes: [0x50, 0x4B, 0x05, 0x06] }, { bytes: [0x50, 0x4B, 0x07, 0x08] }],
    'application/x-rar-compressed': [{ bytes: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07] }], // Rar!
    'application/x-7z-compressed': [{ bytes: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C] }], // 7z

    // Modelos 3D (STL ASCII comeca com "solid")
    'model/stl': [{ bytes: [0x73, 0x6F, 0x6C, 0x69, 0x64] }] // "solid"
};

/**
 * Verifica se um arquivo corresponde ao tipo declarado usando magic bytes
 * @param {File} file - Arquivo a validar
 * @param {string[]} allowedTypes - Tipos MIME permitidos
 * @returns {Promise<{valid: boolean, detectedType: string|null, message: string}>}
 */
export async function validateFileMagicBytes(file, allowedTypes) {
    try {
        // Ler primeiros 16 bytes do arquivo
        const buffer = await file.slice(0, 16).arrayBuffer();
        const bytes = new Uint8Array(buffer);

        // Verificar cada tipo permitido
        for (const mimeType of allowedTypes) {
            const signatures = FILE_SIGNATURES[mimeType];
            if (!signatures) continue;

            // Verificar se alguma assinatura corresponde
            for (const sig of signatures) {
                const offset = sig.offset || 0;
                let match = true;

                for (let i = 0; i < sig.bytes.length; i++) {
                    if (bytes[offset + i] !== sig.bytes[i]) {
                        match = false;
                        break;
                    }
                }

                if (match) {
                    return { valid: true, detectedType: mimeType, message: '' };
                }
            }
        }

        // Verificar se o arquivo e texto (STL ASCII, OBJ, MTL, etc.)
        const isTextFile = isLikelyTextFile(bytes);
        const textExtensions = ['.stl', '.obj', '.mtl', '.txt'];
        const fileName = file.name.toLowerCase();

        if (isTextFile && textExtensions.some(ext => fileName.endsWith(ext))) {
            return { valid: true, detectedType: 'text/plain', message: '' };
        }

        // Se ZIP e permitido, aceitar (muitos formatos sao ZIP: .3mf, .step, etc.)
        if (allowedTypes.includes('application/zip') && bytes[0] === 0x50 && bytes[1] === 0x4B) {
            return { valid: true, detectedType: 'application/zip', message: '' };
        }

        return {
            valid: false,
            detectedType: null,
            message: 'Conteudo do arquivo nao corresponde ao tipo declarado'
        };

    } catch (error) {
        // Em caso de erro de leitura, permitir (validacao no backend)
        return { valid: true, detectedType: null, message: '' };
    }
}

/**
 * Verifica se os bytes parecem ser de um arquivo de texto
 */
function isLikelyTextFile(bytes) {
    // Verificar se a maioria dos bytes sao caracteres ASCII imprimiveis
    let printableCount = 0;
    const sampleSize = Math.min(bytes.length, 16);

    for (let i = 0; i < sampleSize; i++) {
        const byte = bytes[i];
        // ASCII imprimivel (32-126) ou whitespace (9, 10, 13)
        if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
            printableCount++;
        }
    }

    return printableCount / sampleSize > 0.8;
}

/**
 * Sanitiza nome de arquivo removendo caracteres perigosos
 * Previne path traversal e caracteres problematicos
 * @param {string} filename - Nome do arquivo original
 * @returns {string} Nome sanitizado
 */
export function sanitizeFileName(filename) {
    if (!filename || typeof filename !== 'string') return 'arquivo';

    // Remover path traversal
    let sanitized = filename
        .replace(/\.\./g, '')           // Remove ..
        .replace(/[\/\\]/g, '')         // Remove / e \
        .replace(/^\.+/, '');           // Remove pontos no inicio

    // Remover caracteres perigosos (manter apenas alfanumericos, -, _, .)
    sanitized = sanitized.replace(/[^a-zA-Z0-9\-_\.]/g, '_');

    // Remover multiplos underscores consecutivos
    sanitized = sanitized.replace(/_+/g, '_');

    // Remover underscores no inicio e fim
    sanitized = sanitized.replace(/^_+|_+$/g, '');

    // Limitar tamanho (max 200 caracteres)
    if (sanitized.length > 200) {
        const ext = sanitized.split('.').pop();
        const name = sanitized.slice(0, 200 - ext.length - 1);
        sanitized = `${name}.${ext}`;
    }

    // Se ficou vazio, usar nome padrao
    return sanitized || 'arquivo';
}

/**
 * Mascara CPF/CNPJ para exibicao segura (LGPD)
 * CPF: ***.XXX.XXX-XX (mostra ultimos 5 digitos)
 * CNPJ: **.***.XXX/XXXX-XX (mostra ultimos 8 digitos)
 * @param {string} value - CPF ou CNPJ (formatado ou apenas numeros)
 * @returns {string} Valor mascarado
 */
export function maskCPFCNPJ(value) {
    if (!value || typeof value !== 'string') return '';

    const numbers = value.replace(/\D/g, '');

    if (numbers.length === 11) {
        // CPF: ***.XXX.XXX-XX
        return `***.${numbers.slice(3, 6)}.${numbers.slice(6, 9)}-${numbers.slice(9)}`;
    }

    if (numbers.length === 14) {
        // CNPJ: **.***.XXX/XXXX-XX
        return `**.***. ${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12)}`;
    }

    // Valor invalido - mascarar tudo exceto ultimos 3 caracteres
    if (numbers.length > 3) {
        return '*'.repeat(numbers.length - 3) + numbers.slice(-3);
    }

    return value;
}

/**
 * Mascara telefone para exibicao segura (LGPD)
 * Mostra apenas DDD e ultimos 4 digitos: (XX) *****-XXXX
 * @param {string} phone - Telefone (formatado ou apenas numeros)
 * @returns {string} Telefone mascarado
 */
export function maskPhone(phone) {
    if (!phone || typeof phone !== 'string') return '';

    const numbers = phone.replace(/\D/g, '');

    if (numbers.length === 11) {
        // Celular: (XX) *****-XXXX
        return `(${numbers.slice(0, 2)}) *****-${numbers.slice(-4)}`;
    }

    if (numbers.length === 10) {
        // Fixo: (XX) ****-XXXX
        return `(${numbers.slice(0, 2)}) ****-${numbers.slice(-4)}`;
    }

    // Outro formato - mascarar tudo exceto ultimos 4 digitos
    if (numbers.length > 4) {
        return '*'.repeat(numbers.length - 4) + numbers.slice(-4);
    }

    return phone;
}

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

// Detecta transportadora pelo codigo de rastreamento
// Letra (A-Z) = Correios | Numero (0-9) = Jadlog
export const getCarrierInfo = trackingCode => {
    if (!trackingCode) return { name: 'transportadora', isCorreios: true };
    const firstChar = trackingCode.charAt(0);
    const isCorreios = /[a-zA-Z]/.test(firstChar);
    return {
        name: isCorreios ? 'Correios' : 'Jadlog',
        isCorreios,
        url: isCorreios
            ? `https://rastreamento.correios.com.br/app/index.php?objeto=${trackingCode}`
            : `https://www.jadlog.com.br/siteInstitucional/tracking.jad?cte=${trackingCode}`,
        icon: isCorreios ? 'fa-truck' : 'fa-shipping-fast',
        label: isCorreios ? 'Rastrear Correios' : 'Rastrear Jadlog'
    };
};

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
export function isRecentAccess(dateString, minutes = 15) {
    if (!dateString) return false;
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 1000 / 60);
    return diffMins <= minutes;
}

/**
 * Valida CPF (11 digitos)
 * @param {string} cpf - CPF apenas numeros
 * @returns {boolean} true se valido
 */
export function isValidCPF(cpf) {
    if (!cpf || typeof cpf !== 'string') return false;

    // Remove caracteres nao numericos
    cpf = cpf.replace(/\D/g, '');

    // Deve ter 11 digitos
    if (cpf.length !== 11) return false;

    // Verifica se todos os digitos sao iguais (invalido)
    if (/^(\d)\1+$/.test(cpf)) return false;

    // Calcula primeiro digito verificador
    let soma = 0;
    for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(9))) return false;

    // Calcula segundo digito verificador
    soma = 0;
    for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(10))) return false;

    return true;
}

/**
 * Valida CNPJ (14 digitos)
 * @param {string} cnpj - CNPJ apenas numeros
 * @returns {boolean} true se valido
 */
export function isValidCNPJ(cnpj) {
    if (!cnpj || typeof cnpj !== 'string') return false;

    // Remove caracteres nao numericos
    cnpj = cnpj.replace(/\D/g, '');

    // Deve ter 14 digitos
    if (cnpj.length !== 14) return false;

    // Verifica se todos os digitos sao iguais (invalido)
    if (/^(\d)\1+$/.test(cnpj)) return false;

    // Validacao do primeiro digito verificador
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    const digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
        if (pos < 2) pos = 9;
    }

    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0))) return false;

    // Validacao do segundo digito verificador
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;

    for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
        if (pos < 2) pos = 9;
    }

    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(1))) return false;

    return true;
}

/**
 * Valida CPF ou CNPJ
 * @param {string} value - CPF ou CNPJ (com ou sem formatacao)
 * @returns {{valid: boolean, type: string|null, message: string}}
 */
export function validateCPFCNPJ(value) {
    if (!value || typeof value !== 'string') {
        return { valid: false, type: null, message: 'Valor vazio' };
    }

    const numbers = value.replace(/\D/g, '');

    if (numbers.length === 0) {
        return { valid: true, type: null, message: '' }; // Campo vazio e permitido
    }

    if (numbers.length === 11) {
        const valid = isValidCPF(numbers);
        return {
            valid,
            type: 'CPF',
            message: valid ? '' : 'CPF invalido'
        };
    }

    if (numbers.length === 14) {
        const valid = isValidCNPJ(numbers);
        return {
            valid,
            type: 'CNPJ',
            message: valid ? '' : 'CNPJ invalido'
        };
    }

    return {
        valid: false,
        type: null,
        message: 'Digite um CPF (11 digitos) ou CNPJ (14 digitos)'
    };
}

/**
 * Valida formato de email
 * @param {string} email - Email a validar
 * @returns {{valid: boolean, message: string}}
 */
export function validateEmail(email) {
    if (!email || typeof email !== 'string') {
        return { valid: true, message: '' }; // Campo vazio e permitido
    }

    const trimmed = email.trim();
    if (trimmed.length === 0) {
        return { valid: true, message: '' };
    }

    // Regex padrao para validacao de email
    // Aceita: usuario@dominio.extensao
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(trimmed)) {
        return { valid: false, message: 'Email invalido' };
    }

    // Validacoes adicionais
    if (trimmed.length > 254) {
        return { valid: false, message: 'Email muito longo' };
    }

    const [localPart, domain] = trimmed.split('@');
    if (localPart.length > 64) {
        return { valid: false, message: 'Email invalido' };
    }

    // Verifica caracteres consecutivos problematicos
    if (/\.{2,}/.test(trimmed)) {
        return { valid: false, message: 'Email invalido' };
    }

    return { valid: true, message: '' };
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

// Status para serviços de modelagem
export const STATUS_ORDER_MODELAGEM = ['modelando', 'modelagem_concluida'];

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
