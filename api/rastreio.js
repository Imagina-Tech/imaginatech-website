// ==================================================
// ARQUIVO: api/rastreio.js
// LOCALIZAÇÃO: pasta "api" na raiz do projeto
// FUNÇÃO: Rastreamento via Melhor Envio com Resolução DNS
// VERSÃO: 13.0 - Fix DNS e Conectividade
// ==================================================

import https from 'https';
import dns from 'dns';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);

export default async function handler(req, res) {
  console.log('=== INICIANDO HANDLER DE RASTREAMENTO ===');
  console.log('Método:', req.method);
  console.log('Query params:', req.query);
  
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    console.log('Requisição OPTIONS - retornando 200');
    return res.status(200).end();
  }

  const { codigo } = req.query;
  
  console.log('Código recebido:', codigo);
  
  if (!codigo) {
    console.error('ERRO: Código não fornecido');
    return res.status(400).json({ 
      error: 'Código de rastreamento não fornecido' 
    });
  }

  // Verificar token
  const melhorEnvioToken = process.env.MELHOR_ENVIO_TOKEN;
  
  if (!melhorEnvioToken) {
    console.error('ERRO: Token não configurado');
    return res.status(500).json({ 
      error: 'Token não configurado',
      message: 'Configure MELHOR_ENVIO_TOKEN na Vercel'
    });
  }

  console.log('Token encontrado:', melhorEnvioToken.substring(0, 20) + '...');

  // Testar resolução DNS primeiro
  try {
    console.log('Testando resolução DNS para api.melhorenvio.com.br...');
    const dnsResult = await dnsLookup('api.melhorenvio.com.br');
    console.log('DNS resolvido:', dnsResult);
  } catch (dnsError) {
    console.error('Erro ao resolver DNS:', dnsError);
    console.log('Tentando método alternativo...');
  }

  try {
    // Método alternativo usando HTTPS nativo do Node.js
    console.log('=== USANDO MÉTODO HTTPS NATIVO ===');
    
    // Primeiro, tentar buscar lista de envios (GET é mais simples)
    const searchData = await makeHttpsRequest({
      hostname: 'api.melhorenvio.com.br',
      path: '/api/v2/me/shipment/search',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${melhorEnvioToken}`,
        'User-Agent': 'ImaginaTech/1.0'
      }
    });

    console.log('Resposta recebida:', searchData ? 'Sim' : 'Não');
    
    if (searchData) {
      let parsedData;
      try {
        parsedData = JSON.parse(searchData);
        console.log('Dados parseados com sucesso');
      } catch (e) {
        console.error('Erro ao parsear JSON:', e);
        console.log('Resposta raw:', searchData.substring(0, 200));
      }

      if (parsedData && parsedData.data) {
        console.log('Total de envios:', parsedData.data.length);
        
        // Buscar o envio específico
        const codigoLimpo = codigo.toString().trim().toLowerCase();
        const shipment = parsedData.data.find(s => {
          const matches = [
            s.id?.toString().toLowerCase() === codigoLimpo,
            s.protocol?.toLowerCase() === codigoLimpo,
            s.self_tracking?.toLowerCase() === codigoLimpo,
            s.tracking?.toLowerCase() === codigoLimpo,
            // Tentar sem o prefixo ORD-
            codigoLimpo.replace('ord-', '') === s.id?.toString().toLowerCase(),
            'ord-' + s.id?.toString().toLowerCase() === codigoLimpo
          ];
          
          return matches.some(m => m === true);
        });

        if (shipment) {
          console.log('✓ Envio encontrado!');
          
          const eventos = [];
          
          // Status atual
          if (shipment.status) {
            eventos.push({
              descricao: traduzirStatus(shipment.status),
              dtHrCriado: formatarData(shipment.updated_at || shipment.created_at),
              unidade: { nome: 'MELHOR ENVIO' }
            });
          }
          
          // Postagem
          if (shipment.posted_at) {
            eventos.push({
              descricao: 'Objeto postado',
              dtHrCriado: formatarData(shipment.posted_at),
              unidade: { nome: 'CORREIOS' }
            });
          }
          
          // Entrega
          if (shipment.delivered_at) {
            eventos.push({
              descricao: 'Entregue',
              dtHrCriado: formatarData(shipment.delivered_at),
              unidade: { nome: 'DESTINO' }
            });
          }
          
          // Ordenar por data
          eventos.sort((a, b) => {
            const dateA = new Date(a.dtHrCriado.split(' ').reverse().join('-'));
            const dateB = new Date(b.dtHrCriado.split(' ').reverse().join('-'));
            return dateB - dateA;
          });
          
          return res.status(200).json({
            objetos: [{
              codObjeto: codigo,
              eventos: eventos.length > 0 ? eventos : [{
                descricao: 'Pedido em processamento',
                dtHrCriado: formatarData(new Date()),
                unidade: { nome: 'SISTEMA' }
              }],
              tipoPostal: { 
                categoria: shipment.service?.name || 'SEDEX'
              }
            }]
          });
        } else {
          console.log('Envio não encontrado na lista');
        }
      }
    }

    // Se chegou aqui, não encontrou
    return res.status(200).json({
      objetos: [{
        codObjeto: codigo,
        mensagem: 'Não encontrado',
        eventos: [{
          descricao: 'Código não encontrado. Verifique se está correto.',
          dtHrCriado: formatarData(new Date()),
          unidade: { nome: 'SISTEMA' }
        }],
        tipoPostal: { categoria: 'INDEFINIDO' }
      }]
    });

  } catch (error) {
    console.error('Erro geral:', error.message);
    
    // Retornar resposta de fallback
    return res.status(200).json({
      objetos: [{
        codObjeto: codigo,
        mensagem: 'Serviço temporariamente indisponível',
        eventos: [{
          descricao: 'Sistema de rastreamento temporariamente indisponível. Tente novamente em alguns minutos.',
          dtHrCriado: formatarData(new Date()),
          unidade: { nome: 'SISTEMA' }
        }],
        tipoPostal: { categoria: 'INDEFINIDO' }
      }]
    });
  }
}

// Função para fazer requisição HTTPS nativa
function makeHttpsRequest(options) {
  return new Promise((resolve, reject) => {
    console.log('Fazendo requisição HTTPS para:', options.hostname + options.path);
    
    const req = https.request(options, (res) => {
      let data = '';
      
      console.log('Status da resposta:', res.statusCode);
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          console.error('Resposta não-200:', res.statusCode);
          console.error('Body:', data.substring(0, 200));
          resolve(null);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error('Erro na requisição:', error.message);
      reject(error);
    });
    
    // Timeout de 10 segundos
    req.setTimeout(10000, () => {
      console.error('Timeout na requisição');
      req.destroy();
      reject(new Error('Timeout'));
    });
    
    req.end();
  });
}

// Função simplificada para formatar data
function formatarData(dateString) {
  if (!dateString) return new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR');
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (error) {
    return dateString;
  }
}

// Função para traduzir status
function traduzirStatus(status) {
  const map = {
    'pending': 'Aguardando pagamento',
    'released': 'Liberado para envio', 
    'posted': 'Postado',
    'delivered': 'Entregue',
    'canceled': 'Cancelado',
    'on_route': 'Em trânsito',
    'out_for_delivery': 'Saiu para entrega',
    'waiting': 'Aguardando coleta',
    'returned': 'Devolvido'
  };
  
  return map[status?.toLowerCase()] || status || 'Em processamento';
}

/* ==================================================
SOLUÇÃO PARA PROBLEMA DE DNS:

1. Usa HTTPS nativo do Node.js ao invés de fetch
2. Testa resolução DNS antes de fazer requisições
3. Implementa timeout para evitar travamento
4. Retorna mensagem amigável em caso de erro

VERIFICAÇÕES:
1. Token configurado na Vercel ✓
2. Código no formato correto ✓
3. Tratamento de erro de rede ✓

Se continuar com erro, possíveis soluções:
- Usar um proxy/gateway para a API
- Implementar cache local
- Usar webhook do Melhor Envio
================================================== */
