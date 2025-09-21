// ==================================================
// ARQUIVO: api/rastreio.js
// LOCALIZAÇÃO: pasta "api" na raiz do projeto
// FUNÇÃO: Rastreamento via Melhor Envio para envios comprados na plataforma
// VERSÃO: 8.0 - Melhor Envio Tracking Correto
// ==================================================

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Mude para 'https://imaginatech.com.br' em produção
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { codigo } = req.query;
  
  if (!codigo) {
    return res.status(400).json({ 
      error: 'Código de rastreamento não fornecido' 
    });
  }

  try {
    console.log(`Buscando rastreamento para: ${codigo}`);
    
    // Token do Melhor Envio configurado na Vercel
    const melhorEnvioToken = process.env.MELHOR_ENVIO_TOKEN;
    
    if (!melhorEnvioToken) {
      console.error('Token do Melhor Envio não configurado');
      return res.status(500).json({ 
        error: 'Token do Melhor Envio não configurado no servidor' 
      });
    }
    
    // BUSCAR RASTREAMENTO NO MELHOR ENVIO
    try {
      console.log('Buscando no Melhor Envio...');
      
      // Primeiro, buscar o envio pelo código de rastreamento
      const searchUrl = `https://api.melhorenvio.com.br/api/v2/me/shipment/tracking`;
      
      const searchResponse = await fetch(searchUrl, {
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

      if (!searchResponse.ok) {
        console.log('Erro na resposta do Melhor Envio:', searchResponse.status);
        
        // Se não encontrou pelo código de rastreamento, tentar buscar na lista de envios
        const shipmentsUrl = `https://api.melhorenvio.com.br/api/v2/me/shipment/search`;
        
        const shipmentsResponse = await fetch(shipmentsUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${melhorEnvioToken}`,
            'User-Agent': 'ImaginaTech/1.0'
          }
        });
        
        if (shipmentsResponse.ok) {
          const shipmentsData = await shipmentsResponse.json();
          
          // Procurar o envio pelo código de rastreamento
          const shipment = shipmentsData.data?.find(s => 
            s.tracking === codigo || 
            s.protocol === codigo ||
            s.self_tracking === codigo
          );
          
          if (shipment) {
            return processarEnvioMelhorEnvio(shipment, codigo);
          }
        }
      }

      const trackingData = await searchResponse.json();
      
      // Verificar se retornou dados válidos
      if (trackingData && Object.keys(trackingData).length > 0) {
        // O Melhor Envio retorna um objeto com o código como chave
        const tracking = trackingData[codigo] || Object.values(trackingData)[0];
        
        if (tracking) {
          console.log('Dados encontrados no Melhor Envio');
          
          // Processar eventos de rastreamento
          const eventos = [];
          
          // Se tem eventos de tracking
          if (tracking.tracking_events && Array.isArray(tracking.tracking_events)) {
            tracking.tracking_events.forEach(event => {
              eventos.push({
                descricao: event.description || event.event || 'Status atualizado',
                dtHrCriado: formatarDataMelhorEnvio(event.date || event.created_at),
                unidade: {
                  nome: event.city || event.location || 'MELHOR ENVIO'
                }
              });
            });
          }
          
          // Se tem status mas não eventos detalhados
          if (eventos.length === 0 && tracking.status) {
            eventos.push({
              descricao: traduzirStatusMelhorEnvio(tracking.status),
              dtHrCriado: formatarDataMelhorEnvio(tracking.updated_at || tracking.created_at),
              unidade: {
                nome: tracking.company_name || 'MELHOR ENVIO'
              }
            });
          }
          
          // Adicionar evento de postagem se existir
          if (tracking.posted_at) {
            eventos.push({
              descricao: 'Objeto postado',
              dtHrCriado: formatarDataMelhorEnvio(tracking.posted_at),
              unidade: {
                nome: tracking.agency || 'CORREIOS'
              }
            });
          }
          
          // Adicionar evento de entrega se existir
          if (tracking.delivered_at) {
            eventos.push({
              descricao: 'Objeto entregue ao destinatário',
              dtHrCriado: formatarDataMelhorEnvio(tracking.delivered_at),
              unidade: {
                nome: 'Destino'
              }
            });
          }
          
          // Ordenar eventos por data (mais recente primeiro)
          eventos.sort((a, b) => {
            const dateA = new Date(a.dtHrCriado.split(' ').reverse().join('-'));
            const dateB = new Date(b.dtHrCriado.split(' ').reverse().join('-'));
            return dateB - dateA;
          });
          
          if (eventos.length > 0) {
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
      
    } catch (error) {
      console.error('Erro ao buscar no Melhor Envio:', error);
    }
    
    // FALLBACK: Buscar direto nos Correios se não encontrou no Melhor Envio
    console.log('Tentando buscar direto nos Correios...');
    
    // Usar proxy para buscar no site dos Correios
    const correiosUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
      `https://www.linkcorreios.com.br/?id=${codigo}`
    )}`;
    
    const correiosResponse = await fetch(correiosUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (correiosResponse.ok) {
      const html = await correiosResponse.text();
      
      // Extrair eventos do HTML (scraping básico)
      const eventos = [];
      
      // Buscar por padrões de eventos no HTML
      const eventRegex = /<li[^>]*class="[^"]*linha_status[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
      const matches = html.matchAll(eventRegex);
      
      for (const match of matches) {
        const content = match[1];
        
        const statusMatch = content.match(/<strong>([^<]+)<\/strong>/);
        const dateMatch = content.match(/(\d{2}\/\d{2}\/\d{4})/);
        const timeMatch = content.match(/(\d{2}:\d{2})/);
        const localMatch = content.match(/Local:\s*([^<]+)/);
        
        if (statusMatch && dateMatch) {
          eventos.push({
            descricao: statusMatch[1].trim(),
            dtHrCriado: `${dateMatch[1]} ${timeMatch ? timeMatch[1] : ''}`.trim(),
            unidade: {
              nome: localMatch ? localMatch[1].trim() : 'CORREIOS'
            }
          });
        }
      }
      
      if (eventos.length > 0) {
        console.log('Dados encontrados via scraping');
        
        return res.status(200).json({
          objetos: [{
            codObjeto: codigo,
            eventos: eventos,
            tipoPostal: { 
              categoria: 'SEDEX'
            }
          }]
        });
      }
    }
    
    // Se não encontrou nada
    console.log('Nenhum dado encontrado');
    
    return res.status(200).json({
      objetos: [{
        codObjeto: codigo,
        mensagem: 'Objeto em processamento',
        eventos: [{
          descricao: 'Aguardando atualização do sistema',
          dtHrCriado: new Date().toLocaleDateString('pt-BR'),
          unidade: {
            nome: 'Verifique novamente em alguns minutos'
          }
        }],
        tipoPostal: { 
          categoria: 'SEDEX'
        }
      }]
    });
    
  } catch (error) {
    console.error('Erro crítico:', error);
    
    return res.status(500).json({ 
      error: 'Erro ao processar requisição',
      message: error.message
    });
  }
}

// Função para processar dados de envio do Melhor Envio
function processarEnvioMelhorEnvio(shipment, codigo) {
  const eventos = [];
  
  // Adicionar eventos baseados no status
  if (shipment.status) {
    eventos.push({
      descricao: traduzirStatusMelhorEnvio(shipment.status),
      dtHrCriado: formatarDataMelhorEnvio(shipment.updated_at),
      unidade: {
        nome: shipment.company?.name || 'MELHOR ENVIO'
      }
    });
  }
  
  // Adicionar evento de postagem
  if (shipment.posted_at) {
    eventos.push({
      descricao: 'Objeto postado',
      dtHrCriado: formatarDataMelhorEnvio(shipment.posted_at),
      unidade: {
        nome: 'CORREIOS'
      }
    });
  }
  
  // Adicionar evento de entrega
  if (shipment.delivered_at) {
    eventos.push({
      descricao: 'Objeto entregue',
      dtHrCriado: formatarDataMelhorEnvio(shipment.delivered_at),
      unidade: {
        nome: 'Destino'
      }
    });
  }
  
  return {
    objetos: [{
      codObjeto: codigo,
      eventos: eventos,
      tipoPostal: { 
        categoria: shipment.service?.name || 'SEDEX'
      }
    }]
  };
}

// Função para formatar datas do Melhor Envio
function formatarDataMelhorEnvio(dateString) {
  if (!dateString) return new Date().toLocaleDateString('pt-BR');
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + 
           date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateString;
  }
}

// Função para traduzir status do Melhor Envio
function traduzirStatusMelhorEnvio(status) {
  const traducoes = {
    'pending': 'Aguardando pagamento',
    'released': 'Liberado para envio',
    'posted': 'Postado',
    'delivered': 'Entregue',
    'canceled': 'Cancelado',
    'expired': 'Expirado',
    'on_route': 'Em trânsito',
    'out_for_delivery': 'Saiu para entrega'
  };
  
  return traducoes[status] || status;
}

/* ==================================================
IMPORTANTE:

Como você COMPROU o frete através do Melhor Envio:
1. O Melhor Envio TEM os dados de rastreamento
2. A API deles DEVE funcionar para esses envios
3. Use o token que você já configurou

VERIFICAR NO MELHOR ENVIO:
1. Entre no painel do Melhor Envio
2. Vá em "Envios" ou "Minhas Etiquetas"
3. Encontre o envio e veja se tem:
   - Código de rastreamento
   - Protocolo
   - ID do envio

Use qualquer um desses códigos para rastrear.

Se ainda não funcionar, verifique:
1. Se o token tem a permissão "shipping-tracking"
2. Se o envio foi realmente postado
3. Se o código está correto
================================================== */
