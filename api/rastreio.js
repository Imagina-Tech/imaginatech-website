// ==================================================
// ARQUIVO: api/rastreio.js
// LOCALIZAÇÃO: pasta "api" na raiz do projeto
// FUNÇÃO: Rastreamento via Correios E Melhor Envio
// VERSÃO: 10.0 - Suporte Correios + Melhor Envio
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

  // Detectar tipo de código
  const isCodigoCorreios = /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(codigo.toUpperCase());
  console.log('É código dos Correios?', isCodigoCorreios);

  try {
    // SE FOR CÓDIGO DOS CORREIOS (formato: AA123456789BR)
    if (isCodigoCorreios) {
      console.log('=== BUSCANDO DIRETO NOS CORREIOS ===');
      
      // Usar API alternativa dos Correios
      const correiosUrl = `https://api.linketrack.com/track/json?user=teste&token=1abcd00b2731640e886fb41a8a9671ad1434c599dbaa0a0de9a5aa619f29a83f&codigo=${codigo}`;
      
      console.log('Buscando em:', correiosUrl);
      
      const correiosResponse = await fetch(correiosUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'ImaginaTech/1.0'
        }
      });
      
      console.log('Response status Correios:', correiosResponse.status);
      
      if (correiosResponse.ok) {
        const correiosData = await correiosResponse.json();
        console.log('Dados dos Correios:', JSON.stringify(correiosData, null, 2));
        
        if (correiosData && correiosData.eventos && correiosData.eventos.length > 0) {
          console.log(`✓ ${correiosData.eventos.length} eventos encontrados nos Correios`);
          
          // Formatar resposta no padrão esperado
          return res.status(200).json({
            objetos: [{
              codObjeto: codigo,
              eventos: correiosData.eventos.map(evento => ({
                descricao: evento.status || 'Status atualizado',
                dtHrCriado: formatarDataCorreios(evento.data, evento.hora),
                unidade: {
                  nome: evento.local || 'CORREIOS'
                },
                cidade: evento.cidade,
                uf: evento.uf,
                destino: evento.destino ? {
                  local: evento.destino.local,
                  cidade: evento.destino.cidade,
                  uf: evento.destino.uf
                } : null
              })),
              tipoPostal: { 
                categoria: correiosData.servico || 'SEDEX'
              }
            }]
          });
        }
      }
      
      // Se não encontrou nos Correios, tentar no Melhor Envio também
      console.log('Não encontrado nos Correios, tentando Melhor Envio...');
    }
    
    // BUSCAR NO MELHOR ENVIO (para códigos internos ou como fallback)
    console.log('=== INICIANDO BUSCA NO MELHOR ENVIO ===');
    
    // Token do Melhor Envio configurado na Vercel
    const melhorEnvioToken = process.env.MELHOR_ENVIO_TOKEN;
    
    if (!melhorEnvioToken) {
      console.error('AVISO: Token do Melhor Envio não configurado');
      
      // Se for código dos Correios e não tem token do Melhor Envio, retornar erro específico
      if (isCodigoCorreios) {
        return res.status(200).json({
          objetos: [{
            codObjeto: codigo,
            mensagem: 'Rastreamento temporariamente indisponível',
            eventos: [{
              descricao: 'Sistema de rastreamento em manutenção. Tente novamente mais tarde ou acesse diretamente o site dos Correios.',
              dtHrCriado: new Date().toLocaleDateString('pt-BR'),
              unidade: {
                nome: 'SISTEMA'
              }
            }],
            tipoPostal: { 
              categoria: 'SEDEX'
            }
          }]
        });
      }
    } else {
      console.log('Token Melhor Envio encontrado:', melhorEnvioToken.substring(0, 10) + '...');
      
      // MÉTODO 1: Buscar via endpoint de tracking do Melhor Envio
      console.log('--- Tentando método 1: Endpoint de tracking ---');
      
      try {
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
        
        const responseText = await trackingResponse.text();
        console.log('Response body (texto):', responseText);
        
        let trackingData;
        try {
          trackingData = JSON.parse(responseText);
          console.log('Response parseado como JSON:', JSON.stringify(trackingData, null, 2));
        } catch (parseError) {
          console.error('Erro ao fazer parse do JSON:', parseError);
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
              }
            }
          }
        }
      } catch (melhorEnvioError) {
        console.error('Erro ao buscar no tracking do Melhor Envio:', melhorEnvioError.message);
      }
      
      // MÉTODO 2: Buscar lista de envios no Melhor Envio
      console.log('--- Tentando método 2: Buscar lista de envios ---');
      
      try {
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
            
            // Procurar o envio pelo código (incluindo códigos dos Correios)
            const shipment = searchData.data.find(s => {
              const match = s.tracking === codigo || 
                           s.protocol === codigo ||
                           s.self_tracking === codigo ||
                           s.id === codigo ||
                           // Adicionar busca por código dos Correios no campo tracking
                           (isCodigoCorreios && s.tracking === codigo);
              
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
              
              // Se tem código dos Correios, buscar detalhes nos Correios
              if (isCodigoCorreios && shipment.tracking) {
                console.log('Envio tem código dos Correios, buscando detalhes...');
                
                const correiosUrl = `https://api.linketrack.com/track/json?user=teste&token=1abcd00b2731640e886fb41a8a9671ad1434c599dbaa0a0de9a5aa619f29a83f&codigo=${shipment.tracking}`;
                
                try {
                  const correiosResponse = await fetch(correiosUrl);
                  if (correiosResponse.ok) {
                    const correiosData = await correiosResponse.json();
                    if (correiosData && correiosData.eventos && correiosData.eventos.length > 0) {
                      return res.status(200).json({
                        objetos: [{
                          codObjeto: codigo,
                          eventos: correiosData.eventos.map(evento => ({
                            descricao: evento.status || 'Status atualizado',
                            dtHrCriado: formatarDataCorreios(evento.data, evento.hora),
                            unidade: {
                              nome: evento.local || 'CORREIOS'
                            },
                            cidade: evento.cidade,
                            uf: evento.uf
                          })),
                          tipoPostal: { 
                            categoria: shipment.service?.name || 'SEDEX'
                          }
                        }]
                      });
                    }
                  }
                } catch (correiosError) {
                  console.error('Erro ao buscar nos Correios:', correiosError);
                }
              }
              
              // Retornar dados do Melhor Envio
              const eventos = [];
              
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
            }
          }
        }
      } catch (searchError) {
        console.error('Erro ao buscar lista de envios:', searchError.message);
      }
    }
    
    // Se chegou aqui, não encontrou nada
    console.log('=== NENHUM DADO ENCONTRADO ===');
    
    return res.status(200).json({
      objetos: [{
        codObjeto: codigo,
        mensagem: 'Código não encontrado',
        eventos: [{
          descricao: isCodigoCorreios ? 
            'Código não encontrado. Verifique se foi digitado corretamente ou aguarde a postagem ser registrada no sistema.' :
            'Código não encontrado. Verifique se está correto.',
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
      details: 'Tente novamente em alguns instantes'
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

// Função para formatar datas do Melhor Envio
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

// Função para formatar datas dos Correios
function formatarDataCorreios(data, hora) {
  if (!data) return new Date().toLocaleDateString('pt-BR');
  
  try {
    // Formato esperado: "DD/MM/YYYY" e "HH:MM"
    const dataHora = hora ? `${data} ${hora}` : data;
    return dataHora;
  } catch (error) {
    return data;
  }
}

// Função para traduzir status do Melhor Envio
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
MELHORIAS IMPLEMENTADAS:

1. DETECÇÃO AUTOMÁTICA DE CÓDIGO:
   - Códigos dos Correios: AA123456789BR
   - Códigos do Melhor Envio: IDs internos

2. INTEGRAÇÃO COM API DOS CORREIOS:
   - Busca direta quando detecta código dos Correios
   - Usa API LinkeTrack (gratuita e confiável)

3. BUSCA HÍBRIDA:
   - Tenta Correios primeiro para códigos no formato correto
   - Fallback para Melhor Envio se não encontrar
   - Suporta envios do Melhor Envio com código dos Correios

4. MELHOR TRATAMENTO DE ERROS:
   - Mensagens específicas por tipo de código
   - Logs detalhados para debug

Para testar:
- Código dos Correios: AC843580091BR
- Código Melhor Envio: Use o ID interno do pedido
================================================== */
