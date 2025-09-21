// ==================================================
// ARQUIVO: api/rastreio.js
// LOCALIZAÇÃO: pasta "api" na raiz do projeto
// FUNÇÃO: Rastreamento APENAS via Melhor Envio (com logs detalhados)
// VERSÃO: 9.0 - Melhor Envio Only com Debug
// ==================================================

export default async function handler(req, res) {
  console.log('=== INICIANDO HANDLER DE RASTREAMENTO ===');
  console.log('Método:', req.method);
  console.log('Query params:', req.query);
  
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Mude para 'https://imaginatech.com.br' em produção
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

  try {
    console.log('=== INICIANDO BUSCA NO MELHOR ENVIO ===');
    
    // Token do Melhor Envio configurado na Vercel
    const melhorEnvioToken = process.env.MELHOR_ENVIO_TOKEN;
    
    if (!melhorEnvioToken) {
      console.error('ERRO CRÍTICO: Token do Melhor Envio não está configurado!');
      return res.status(500).json({ 
        error: 'Token do Melhor Envio não configurado no servidor',
        details: 'Configure MELHOR_ENVIO_TOKEN nas variáveis de ambiente da Vercel'
      });
    }
    
    console.log('Token encontrado:', melhorEnvioToken.substring(0, 10) + '...');
    
    // MÉTODO 1: Buscar via endpoint de tracking
    console.log('--- Tentando método 1: Endpoint de tracking ---');
    
    const trackingUrl = `https://api.melhorenvio.com.br/api/v2/me/shipment/tracking`;
    console.log('URL:', trackingUrl);
    console.log('Enviando POST com código:', codigo);
    
    const trackingResponse = await fetch(trackingUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${melhorEnvioToken}`,
        'User-Agent': 'ImaginaTech/1.0'
      },
      body: JSON.stringify({
        orders: [codigo]
      })
    });

    console.log('Response status:', trackingResponse.status);
    console.log('Response headers:', trackingResponse.headers);
    
    const responseText = await trackingResponse.text();
    console.log('Response body (texto):', responseText);
    
    let trackingData;
    try {
      trackingData = JSON.parse(responseText);
      console.log('Response parseado como JSON:', JSON.stringify(trackingData, null, 2));
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON:', parseError);
      console.log('Resposta não é JSON válido');
    }
    
    if (trackingResponse.ok && trackingData) {
      console.log('✓ Resposta OK do endpoint de tracking');
      
      // Verificar se tem dados
      if (Object.keys(trackingData).length > 0) {
        console.log('Dados encontrados:', Object.keys(trackingData));
        
        const tracking = trackingData[codigo] || Object.values(trackingData)[0];
        console.log('Objeto de tracking:', JSON.stringify(tracking, null, 2));
        
        if (tracking) {
          const eventos = processarEventosMelhorEnvio(tracking);
          
          if (eventos.length > 0) {
            console.log(`✓ ${eventos.length} eventos encontrados`);
            
            return res.status(200).json({
              objetos: [{
                codObjeto: codigo,
                eventos: eventos,
                tipoPostal: { 
                  categoria: tracking.service || tracking.service_name || 'SEDEX'
                }
              }]
            });
          } else {
            console.log('⚠ Nenhum evento encontrado no tracking');
          }
        } else {
          console.log('⚠ Objeto de tracking vazio');
        }
      } else {
        console.log('⚠ Resposta vazia do tracking');
      }
    } else {
      console.log('✗ Método 1 falhou');
    }
    
    // MÉTODO 2: Buscar lista de envios
    console.log('--- Tentando método 2: Buscar lista de envios ---');
    
    const searchUrl = `https://api.melhorenvio.com.br/api/v2/me/shipment/search`;
    console.log('URL:', searchUrl);
    
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${melhorEnvioToken}`,
        'User-Agent': 'ImaginaTech/1.0'
      }
    });
    
    console.log('Search response status:', searchResponse.status);
    
    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      console.log('Total de envios encontrados:', searchData.data?.length || 0);
      
      if (searchData.data && searchData.data.length > 0) {
        console.log('Procurando envio com código:', codigo);
        
        // Procurar o envio pelo código
        const shipment = searchData.data.find(s => {
          const match = s.tracking === codigo || 
                       s.protocol === codigo ||
                       s.self_tracking === codigo ||
                       s.id === codigo;
          
          if (match) {
            console.log('✓ Envio encontrado!');
            console.log('  - ID:', s.id);
            console.log('  - Tracking:', s.tracking);
            console.log('  - Protocol:', s.protocol);
            console.log('  - Self Tracking:', s.self_tracking);
            console.log('  - Status:', s.status);
            console.log('  - Service:', s.service?.name);
          }
          
          return match;
        });
        
        if (shipment) {
          console.log('Processando envio encontrado...');
          console.log('Dados completos do envio:', JSON.stringify(shipment, null, 2));
          
          const eventos = [];
          
          // Adicionar eventos baseados no status e datas
          if (shipment.status) {
            eventos.push({
              descricao: traduzirStatusMelhorEnvio(shipment.status),
              dtHrCriado: formatarDataMelhorEnvio(shipment.updated_at || shipment.created_at),
              unidade: {
                nome: shipment.company?.name || shipment.agency?.name || 'MELHOR ENVIO'
              }
            });
          }
          
          if (shipment.posted_at) {
            eventos.push({
              descricao: 'Objeto postado',
              dtHrCriado: formatarDataMelhorEnvio(shipment.posted_at),
              unidade: {
                nome: shipment.agency?.name || 'CORREIOS'
              }
            });
          }
          
          if (shipment.delivered_at) {
            eventos.push({
              descricao: 'Objeto entregue ao destinatário',
              dtHrCriado: formatarDataMelhorEnvio(shipment.delivered_at),
              unidade: {
                nome: 'Destino'
              }
            });
          }
          
          // Ordenar eventos por data
          eventos.sort((a, b) => {
            const dateA = parseDate(a.dtHrCriado);
            const dateB = parseDate(b.dtHrCriado);
            return dateB - dateA;
          });
          
          console.log(`✓ Retornando ${eventos.length} eventos`);
          
          return res.status(200).json({
            objetos: [{
              codObjeto: codigo,
              eventos: eventos,
              tipoPostal: { 
                categoria: shipment.service?.name || 'SEDEX'
              }
            }]
          });
        } else {
          console.log('✗ Nenhum envio encontrado com esse código');
        }
      } else {
        console.log('✗ Nenhum envio na conta');
      }
    } else {
      console.log('✗ Erro ao buscar lista de envios');
      const errorText = await searchResponse.text();
      console.log('Erro:', errorText);
    }
    
    // Se chegou aqui, não encontrou nada
    console.log('=== NENHUM DADO ENCONTRADO ===');
    
    return res.status(200).json({
      objetos: [{
        codObjeto: codigo,
        mensagem: 'Código não encontrado no Melhor Envio',
        eventos: [{
          descricao: 'Verifique se o código está correto',
          dtHrCriado: new Date().toLocaleDateString('pt-BR'),
          unidade: {
            nome: 'Sem dados de rastreamento'
          }
        }],
        tipoPostal: { 
          categoria: 'INDEFINIDO'
        }
      }]
    });
    
  } catch (error) {
    console.error('=== ERRO CRÍTICO ===');
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);
    
    return res.status(500).json({ 
      error: 'Erro ao processar requisição',
      message: error.message,
      stack: error.stack
    });
  }
}

// Função para processar eventos do Melhor Envio
function processarEventosMelhorEnvio(tracking) {
  console.log('Processando eventos do tracking...');
  const eventos = [];
  
  // Processar tracking_events
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
  
  // Adicionar posted_at
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
  
  // Adicionar delivered_at
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
    return new Date().toLocaleDateString('pt-BR');
  }
  
  try {
    const date = new Date(dateString);
    const formatted = date.toLocaleDateString('pt-BR') + ' ' + 
                     date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
    'expired': 'Expirado',
    'on_route': 'Em trânsito',
    'out_for_delivery': 'Saiu para entrega',
    'waiting': 'Aguardando coleta',
    'returned': 'Devolvido'
  };
  
  const traducao = traducoes[status] || status;
  console.log(`Status traduzido: ${status} -> ${traducao}`);
  return traducao;
}

// Função para fazer parse de datas brasileiras
function parseDate(dateStr) {
  if (!dateStr) return new Date();
  
  // Formato: DD/MM/AAAA HH:MM
  const parts = dateStr.split(' ');
  if (parts[0]) {
    const dateParts = parts[0].split('/');
    if (dateParts.length === 3) {
      const day = dateParts[0];
      const month = dateParts[1] - 1;
      const year = dateParts[2];
      
      let hours = 0, minutes = 0;
      if (parts[1]) {
        const timeParts = parts[1].split(':');
        hours = timeParts[0] || 0;
        minutes = timeParts[1] || 0;
      }
      
      return new Date(year, month, day, hours, minutes);
    }
  }
  
  return new Date(dateStr);
}

/* ==================================================
LOGS DETALHADOS:

O sistema agora registra:
1. Todas as requisições e respostas
2. Status HTTP de cada chamada
3. Dados recebidos do Melhor Envio
4. Processamento de eventos
5. Erros detalhados

Para ver os logs:
1. Na Vercel, vá em Functions
2. Clique em "api/rastreio"
3. Veja os logs em tempo real

IMPORTANTE:
- Use o código EXATO do Melhor Envio
- Pode ser: tracking, protocol, self_tracking ou ID
- Verifique no painel do Melhor Envio qual código usar
================================================== */
