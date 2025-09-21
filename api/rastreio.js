// ==================================================
// ARQUIVO: api/rastreio.js
// LOCALIZAÇÃO: pasta "api" na raiz do projeto
// FUNÇÃO: Rastreamento APENAS via Melhor Envio com Debug Aprimorado
// VERSÃO: 12.0 - Debug e Tratamento de Erros
// ==================================================

export default async function handler(req, res) {
  console.log('=== INICIANDO HANDLER DE RASTREAMENTO ===');
  console.log('Método:', req.method);
  console.log('Query params:', req.query);
  console.log('Headers recebidos:', req.headers);
  
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    console.log('Requisição OPTIONS - retornando 200');
    res.status(200).end();
    return;
  }

  const { codigo } = req.query;
  
  console.log('Código recebido:', codigo);
  
  if (!codigo) {
    console.error('ERRO: Código não fornecido');
    return res.status(400).json({ 
      error: 'Código de rastreamento não fornecido' 
    });
  }

  // Verificar token antes de fazer requisições
  const melhorEnvioToken = process.env.MELHOR_ENVIO_TOKEN;
  
  if (!melhorEnvioToken) {
    console.error('ERRO CRÍTICO: Token do Melhor Envio não está configurado!');
    return res.status(500).json({ 
      error: 'Configuração ausente',
      message: 'Token do Melhor Envio não configurado. Configure MELHOR_ENVIO_TOKEN nas variáveis de ambiente da Vercel.',
      details: 'Acesse: Vercel Dashboard > Settings > Environment Variables'
    });
  }
  
  console.log('Token encontrado, tamanho:', melhorEnvioToken.length);
  console.log('Primeiros caracteres do token:', melhorEnvioToken.substring(0, 20) + '...');

  try {
    console.log('=== INICIANDO BUSCA NO MELHOR ENVIO ===');
    
    // MÉTODO 1: Buscar via endpoint de tracking
    console.log('--- Tentando método 1: Endpoint de tracking ---');
    
    const trackingUrl = `https://api.melhorenvio.com.br/api/v2/me/shipment/tracking`;
    console.log('URL de tracking:', trackingUrl);
    console.log('Enviando POST com código:', codigo);
    
    let trackingResponse;
    let trackingData = null;
    
    try {
      const trackingBody = JSON.stringify({
        orders: [codigo]
      });
      
      console.log('Body da requisição:', trackingBody);
      console.log('Headers a enviar:', {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + melhorEnvioToken.substring(0, 10) + '...',
        'User-Agent': 'ImaginaTech/1.0'
      });
      
      trackingResponse = await fetch(trackingUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${melhorEnvioToken}`,
          'User-Agent': 'ImaginaTech/1.0'
        },
        body: trackingBody
      });
      
      console.log('Response status do tracking:', trackingResponse.status);
      console.log('Response headers:', trackingResponse.headers);
      
      const responseText = await trackingResponse.text();
      console.log('Response body (texto):', responseText);
      
      if (responseText) {
        try {
          trackingData = JSON.parse(responseText);
          console.log('Response parseado como JSON:', JSON.stringify(trackingData, null, 2));
        } catch (parseError) {
          console.error('Erro ao fazer parse do JSON:', parseError);
          console.log('Resposta não é JSON válido');
        }
      }
      
    } catch (trackingError) {
      console.error('ERRO no fetch de tracking:', trackingError);
      console.error('Tipo do erro:', trackingError.constructor.name);
      console.error('Mensagem:', trackingError.message);
      console.error('Stack:', trackingError.stack);
      
      // Se falhou no fetch, pode ser problema de rede ou token
      if (trackingError.message.includes('fetch failed')) {
        console.log('Possível problema de rede ou autenticação');
      }
    }
    
    // Processar resposta do tracking se teve sucesso
    if (trackingResponse && trackingResponse.ok && trackingData) {
      console.log('✓ Resposta OK do endpoint de tracking');
      
      if (Object.keys(trackingData).length > 0) {
        console.log('Dados encontrados no tracking:', Object.keys(trackingData));
        
        const tracking = trackingData[codigo] || Object.values(trackingData)[0];
        
        if (tracking) {
          console.log('Objeto de tracking encontrado');
          const eventos = processarEventosMelhorEnvio(tracking);
          
          if (eventos.length > 0) {
            console.log(`✓ ${eventos.length} eventos encontrados via tracking`);
            
            return res.status(200).json({
              objetos: [{
                codObjeto: codigo,
                eventos: eventos,
                tipoPostal: { 
                  categoria: tracking.service || tracking.service_name || 'SEDEX'
                }
              }]
            });
          }
        }
      }
    }
    
    // MÉTODO 2: Buscar lista de envios (mais confiável)
    console.log('--- Tentando método 2: Buscar lista de envios ---');
    
    const searchUrl = `https://api.melhorenvio.com.br/api/v2/me/shipment/search`;
    console.log('URL de busca:', searchUrl);
    
    let searchResponse;
    let searchData = null;
    
    try {
      console.log('Fazendo GET para buscar envios...');
      
      searchResponse = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${melhorEnvioToken}`,
          'User-Agent': 'ImaginaTech/1.0'
        }
      });
      
      console.log('Search response status:', searchResponse.status);
      
      if (searchResponse.ok) {
        const searchText = await searchResponse.text();
        console.log('Tamanho da resposta:', searchText.length, 'caracteres');
        
        if (searchText) {
          try {
            searchData = JSON.parse(searchText);
            console.log('Total de envios encontrados:', searchData.data?.length || 0);
            
            if (searchData.data && searchData.data.length > 0) {
              // Listar primeiros 5 envios para debug
              console.log('Primeiros envios (para debug):');
              searchData.data.slice(0, 5).forEach(s => {
                console.log(`- ID: ${s.id}, Protocol: ${s.protocol}, Tracking: ${s.tracking}`);
              });
            }
          } catch (parseError) {
            console.error('Erro ao parsear resposta de busca:', parseError);
          }
        }
      } else {
        const errorText = await searchResponse.text();
        console.error('Erro na resposta de busca:', searchResponse.status);
        console.error('Mensagem de erro:', errorText);
        
        // Verificar se é erro de autenticação
        if (searchResponse.status === 401) {
          return res.status(401).json({
            error: 'Token inválido ou expirado',
            message: 'O token do Melhor Envio está inválido ou expirou. Verifique o token nas configurações da Vercel.',
            statusCode: 401
          });
        }
      }
      
    } catch (searchError) {
      console.error('ERRO no fetch de busca:', searchError);
      console.error('Tipo:', searchError.constructor.name);
      console.error('Mensagem:', searchError.message);
    }
    
    // Processar dados da busca se encontrou
    if (searchData && searchData.data && searchData.data.length > 0) {
      console.log('Procurando envio com código:', codigo);
      
      // Buscar de forma mais flexível
      const shipment = searchData.data.find(s => {
        // Comparações case-insensitive e com trim
        const codigoLimpo = codigo.toString().trim().toLowerCase();
        
        const matches = [
          s.id?.toString().toLowerCase() === codigoLimpo,
          s.protocol?.toLowerCase() === codigoLimpo,
          s.self_tracking?.toLowerCase() === codigoLimpo,
          s.tracking?.toLowerCase() === codigoLimpo,
          // Tentar sem o prefixo ORD- se existir
          codigoLimpo.startsWith('ord-') && s.id?.toString() === codigoLimpo.replace('ord-', ''),
          // Tentar com ORD- se não tiver
          !codigoLimpo.startsWith('ord-') && s.id?.toString() === 'ord-' + codigoLimpo
        ];
        
        const match = matches.some(m => m === true);
        
        if (match) {
          console.log('✓ Envio encontrado!');
          console.log('  - ID:', s.id);
          console.log('  - Protocol:', s.protocol);
          console.log('  - Tracking:', s.tracking);
          console.log('  - Self Tracking:', s.self_tracking);
          console.log('  - Status:', s.status);
          console.log('  - Service:', s.service?.name);
        }
        
        return match;
      });
      
      if (shipment) {
        console.log('Processando envio encontrado...');
        
        const eventos = [];
        
        // Adicionar evento de status atual
        if (shipment.status) {
          eventos.push({
            descricao: traduzirStatusMelhorEnvio(shipment.status),
            dtHrCriado: formatarDataMelhorEnvio(shipment.updated_at || shipment.created_at),
            unidade: {
              nome: shipment.company?.name || shipment.agency?.name || 'MELHOR ENVIO'
            }
          });
        }
        
        // Adicionar evento de criação
        if (shipment.created_at && shipment.created_at !== shipment.updated_at) {
          eventos.push({
            descricao: 'Pedido criado',
            dtHrCriado: formatarDataMelhorEnvio(shipment.created_at),
            unidade: {
              nome: 'MELHOR ENVIO'
            }
          });
        }
        
        // Adicionar evento de postagem
        if (shipment.posted_at) {
          eventos.push({
            descricao: 'Objeto postado nos Correios',
            dtHrCriado: formatarDataMelhorEnvio(shipment.posted_at),
            unidade: {
              nome: shipment.agency?.name || 'CORREIOS'
            }
          });
        }
        
        // Adicionar evento de entrega
        if (shipment.delivered_at) {
          eventos.push({
            descricao: 'Objeto entregue ao destinatário',
            dtHrCriado: formatarDataMelhorEnvio(shipment.delivered_at),
            unidade: {
              nome: 'Destino'
            }
          });
        }
        
        // Ordenar eventos por data (mais recente primeiro)
        eventos.sort((a, b) => {
          const dateA = parseDate(a.dtHrCriado);
          const dateB = parseDate(b.dtHrCriado);
          return dateB - dateA;
        });
        
        console.log(`✓ Retornando ${eventos.length} eventos do envio`);
        
        return res.status(200).json({
          objetos: [{
            codObjeto: codigo,
            eventos: eventos,
            tipoPostal: { 
              categoria: shipment.service?.name || 'SEDEX'
            },
            // Informações adicionais úteis
            info: {
              tracking: shipment.tracking,
              protocol: shipment.protocol,
              status: shipment.status
            }
          }]
        });
      } else {
        console.log('✗ Nenhum envio encontrado com o código:', codigo);
      }
    }
    
    // Se chegou aqui, não encontrou nada
    console.log('=== NENHUM DADO ENCONTRADO ===');
    
    return res.status(200).json({
      objetos: [{
        codObjeto: codigo,
        mensagem: 'Código não encontrado',
        eventos: [{
          descricao: 'Código não encontrado no sistema. Verifique se está correto ou aguarde o processamento.',
          dtHrCriado: new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR'),
          unidade: {
            nome: 'SISTEMA'
          }
        }],
        tipoPostal: { 
          categoria: 'INDEFINIDO'
        }
      }]
    });
    
  } catch (error) {
    console.error('=== ERRO CRÍTICO GERAL ===');
    console.error('Tipo:', error.constructor.name);
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);
    
    // Retornar erro mais amigável
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: 'Ocorreu um erro ao processar a requisição. Tente novamente em alguns instantes.',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

// Função para processar eventos do Melhor Envio
function processarEventosMelhorEnvio(tracking) {
  console.log('Processando eventos do tracking...');
  const eventos = [];
  
  // Processar tracking_events se existir
  if (tracking.tracking_events && Array.isArray(tracking.tracking_events)) {
    console.log(`Encontrados ${tracking.tracking_events.length} tracking_events`);
    
    tracking.tracking_events.forEach((event, index) => {
      console.log(`Evento ${index + 1}:`, event);
      
      eventos.push({
        descricao: event.description || event.event || event.status || 'Status atualizado',
        dtHrCriado: formatarDataMelhorEnvio(event.date || event.created_at || event.timestamp),
        unidade: {
          nome: event.city || event.location || 'MELHOR ENVIO'
        }
      });
    });
  }
  
  // Se não tem eventos mas tem status
  if (eventos.length === 0 && tracking.status) {
    console.log('Sem tracking_events, usando status:', tracking.status);
    
    eventos.push({
      descricao: traduzirStatusMelhorEnvio(tracking.status),
      dtHrCriado: formatarDataMelhorEnvio(tracking.updated_at || tracking.created_at),
      unidade: {
        nome: tracking.company_name || 'MELHOR ENVIO'
      }
    });
  }
  
  // Adicionar posted_at se existir
  if (tracking.posted_at) {
    console.log('Adicionando evento de postagem');
    eventos.push({
      descricao: 'Objeto postado',
      dtHrCriado: formatarDataMelhorEnvio(tracking.posted_at),
      unidade: {
        nome: tracking.agency || 'CORREIOS'
      }
    });
  }
  
  // Adicionar delivered_at se existir
  if (tracking.delivered_at) {
    console.log('Adicionando evento de entrega');
    eventos.push({
      descricao: 'Objeto entregue ao destinatário',
      dtHrCriado: formatarDataMelhorEnvio(tracking.delivered_at),
      unidade: {
        nome: 'Destino'
      }
    });
  }
  
  console.log(`Total de eventos processados: ${eventos.length}`);
  return eventos;
}

// Função para formatar datas
function formatarDataMelhorEnvio(dateString) {
  if (!dateString) {
    console.log('Data vazia, usando data atual');
    return new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR');
  }
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.log('Data inválida:', dateString);
      return dateString;
    }
    
    const formatted = date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    }) + ' ' + date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    console.log(`Data formatada: ${dateString} -> ${formatted}`);
    return formatted;
  } catch (error) {
    console.error('Erro ao formatar data:', error);
    return dateString;
  }
}

// Função para traduzir status
function traduzirStatusMelhorEnvio(status) {
  const traducoes = {
    'pending': 'Aguardando pagamento',
    'released': 'Liberado para envio',
    'posted': 'Postado nos Correios',
    'delivered': 'Entregue ao destinatário',
    'canceled': 'Cancelado',
    'cancelled': 'Cancelado',
    'expired': 'Expirado',
    'on_route': 'Em trânsito',
    'out_for_delivery': 'Saiu para entrega',
    'waiting': 'Aguardando coleta',
    'returned': 'Devolvido',
    'paid': 'Pago',
    'generated': 'Etiqueta gerada',
    'not_generated': 'Etiqueta não gerada'
  };
  
  const traducao = traducoes[status?.toLowerCase()] || status;
  console.log(`Status traduzido: ${status} -> ${traducao}`);
  return traducao;
}

// Função para fazer parse de datas brasileiras
function parseDate(dateStr) {
  if (!dateStr) return new Date();
  
  // Tentar parse direto primeiro
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }
  
  // Formato: DD/MM/AAAA HH:MM
  const parts = dateStr.split(' ');
  if (parts[0]) {
    const dateParts = parts[0].split('/');
    if (dateParts.length === 3) {
      const day = parseInt(dateParts[0]);
      const month = parseInt(dateParts[1]) - 1;
      const year = parseInt(dateParts[2]);
      
      let hours = 0, minutes = 0;
      if (parts[1]) {
        const timeParts = parts[1].split(':');
        hours = parseInt(timeParts[0]) || 0;
        minutes = parseInt(timeParts[1]) || 0;
      }
      
      return new Date(year, month, day, hours, minutes);
    }
  }
  
  return new Date();
}

/* ==================================================
DIAGNÓSTICO E SOLUÇÕES:

1. VERIFIQUE O TOKEN:
   - Acesse Vercel Dashboard
   - Settings > Environment Variables
   - Certifique-se que MELHOR_ENVIO_TOKEN está configurado
   - O token deve ser válido e não expirado

2. FORMATOS DE CÓDIGO ACEITOS:
   - ID numérico: 123456
   - Com prefixo: ORD-202508115509001
   - Protocol: ME-XXXXX
   - Tracking: XXXXX

3. LOGS DETALHADOS:
   - Verifique os logs na Vercel (Functions > Logs)
   - Procure por "ERRO" para identificar problemas
   - O sistema agora registra cada etapa

4. POSSÍVEIS PROBLEMAS:
   - Token ausente ou inválido
   - Código não existe no Melhor Envio
   - Problema de rede temporário
================================================== */
