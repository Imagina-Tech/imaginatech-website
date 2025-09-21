// ==================================================
// ARQUIVO: api/rastreio.js
// LOCALIZAÇÃO: pasta "api" na raiz do projeto
// FUNÇÃO: Rastreamento via Melhor Envio API
// VERSÃO: 4.0 - Melhor Envio com segurança
// ==================================================

export default async function handler(req, res) {
  // Configurar CORS para seu domínio
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://imaginatech.com.br');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

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

  // Validar formato do código
  const codigoRegex = /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/;
  if (!codigoRegex.test(codigo)) {
    return res.status(400).json({ 
      error: 'Formato de código inválido' 
    });
  }

  try {
    console.log(`Buscando rastreamento para: ${codigo}`);
    
    // MÉTODO 1: API do Melhor Envio (requer token)
    const melhorEnvioToken = process.env.MELHOR_ENVIO_TOKEN;
    
    if (melhorEnvioToken) {
      try {
        // Endpoint do Melhor Envio para rastreamento
        const melhorEnvioUrl = 'https://api.melhorenvio.com.br/api/v2/me/shipment/tracking';
        
        const melhorEnvioResponse = await fetch(melhorEnvioUrl, {
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

        if (melhorEnvioResponse.ok) {
          const melhorEnvioData = await melhorEnvioResponse.json();
          
          // Verificar se tem dados de rastreamento
          if (melhorEnvioData && melhorEnvioData.data && melhorEnvioData.data.length > 0) {
            const tracking = melhorEnvioData.data[0];
            
            if (tracking.tracking && tracking.tracking.events && tracking.tracking.events.length > 0) {
              console.log('Sucesso com Melhor Envio API');
              
              // Converter formato Melhor Envio para o formato esperado
              const eventos = tracking.tracking.events.map(evento => ({
                descricao: evento.description || evento.event,
                dtHrCriado: formatarDataMelhorEnvio(evento.date || evento.timestamp),
                unidade: {
                  nome: evento.location || evento.city || 'CORREIOS'
                }
              }));
              
              return res.status(200).json({
                objetos: [{
                  codObjeto: codigo,
                  eventos: eventos,
                  tipoPostal: { 
                    categoria: tracking.service || 'SEDEX' 
                  }
                }]
              });
            }
          }
        }
      } catch (error) {
        console.log('Erro com Melhor Envio:', error.message);
      }
    } else {
      console.log('Token do Melhor Envio não configurado');
    }
    
    // MÉTODO 2: API Alternativa RastreiaEncomendas (gratuita sem token)
    try {
      console.log('Tentando API RastreiaEncomendas...');
      
      // Esta API funciona sem autenticação
      const rastreiaUrl = `https://api.rastreiaencomendas.com/v1/track/${codigo}`;
      
      const rastreiaResponse = await fetch(rastreiaUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (rastreiaResponse.ok) {
        const rastreiaData = await rastreiaResponse.json();
        
        if (rastreiaData && rastreiaData.events && rastreiaData.events.length > 0) {
          console.log('Sucesso com RastreiaEncomendas');
          
          // Converter formato
          const eventos = rastreiaData.events.map(evento => ({
            descricao: evento.status,
            dtHrCriado: `${evento.date} ${evento.time || ''}`.trim(),
            unidade: {
              nome: evento.location || 'CORREIOS'
            }
          }));
          
          return res.status(200).json({
            objetos: [{
              codObjeto: codigo,
              eventos: eventos,
              tipoPostal: { 
                categoria: rastreiaData.service || 'SEDEX' 
              }
            }]
          });
        }
      }
    } catch (error) {
      console.log('Erro com RastreiaEncomendas:', error.message);
    }
    
    // MÉTODO 3: Scraping via Puppeteer (mais confiável)
    try {
      console.log('Tentando scraping avançado...');
      
      // Usar um serviço de scraping
      const scraperUrl = `https://api.scraperapi.com/v1/scrape`;
      const scraperApiKey = process.env.SCRAPER_API_KEY || 'demo';
      
      const targetUrl = `https://rastreamento.correios.com.br/app/resultado.php?objeto=${codigo}`;
      
      const scraperResponse = await fetch(`${scraperUrl}?api_key=${scraperApiKey}&url=${encodeURIComponent(targetUrl)}`, {
        method: 'GET',
        headers: {
          'Accept': 'text/html'
        }
      });

      if (scraperResponse.ok) {
        const html = await scraperResponse.text();
        
        // Extrair eventos do HTML
        const eventos = [];
        
        // Buscar tabela de eventos no HTML
        const eventosRegex = /<tr class="[^"]*sro-table__body[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
        const matches = Array.from(html.matchAll(eventosRegex));
        
        for (const match of matches) {
          const row = match[1];
          
          // Extrair dados
          const dateRegex = /<td[^>]*>(\d{2}\/\d{2}\/\d{4})<\/td>/;
          const timeRegex = /<td[^>]*>(\d{2}:\d{2})<\/td>/;
          const statusRegex = /<td[^>]*>([^<]+)<\/td>/g;
          
          const dateMatch = row.match(dateRegex);
          const timeMatch = row.match(timeRegex);
          const statusMatches = Array.from(row.matchAll(statusRegex));
          
          if (statusMatches.length >= 2) {
            eventos.push({
              descricao: statusMatches[1][1].trim(),
              dtHrCriado: `${dateMatch ? dateMatch[1] : ''} ${timeMatch ? timeMatch[1] : ''}`.trim(),
              unidade: {
                nome: statusMatches[2] ? statusMatches[2][1].trim() : 'CORREIOS'
              }
            });
          }
        }
        
        if (eventos.length > 0) {
          console.log('Sucesso com scraping');
          
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
    } catch (error) {
      console.log('Erro no scraping:', error.message);
    }
    
    // Se todos falharem, retornar estrutura básica
    console.log('Usando fallback final');
    
    return res.status(200).json({
      objetos: [{
        codObjeto: codigo,
        mensagem: 'Rastreamento temporariamente indisponível',
        eventos: [{
          descricao: 'Tente novamente em alguns minutos',
          dtHrCriado: new Date().toLocaleDateString('pt-BR'),
          unidade: {
            nome: 'Sistema em atualização'
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
      error: 'Erro ao buscar informações de rastreamento',
      message: error.message
    });
  }
}

// Função auxiliar para formatar datas do Melhor Envio
function formatarDataMelhorEnvio(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR');
  } catch {
    return dateString;
  }
}

/* ==================================================
INSTRUÇÕES DE CONFIGURAÇÃO:

1. CRIAR CONTA NO MELHOR ENVIO:
   - Acesse: https://melhorenvio.com.br
   - Crie uma conta gratuita
   - Vá em: Configurações > API
   - Gere um Token de API

2. CONFIGURAR TOKEN NA VERCEL (SEGURO):
   - No dashboard da Vercel
   - Settings > Environment Variables
   - Adicione:
     Name: MELHOR_ENVIO_TOKEN
     Value: [seu_token_aqui]
     Environment: Production

3. OPCIONAL - SCRAPER API:
   Se quiser usar o método 3 (scraping):
   - Crie conta em: https://www.scraperapi.com
   - Adicione na Vercel:
     Name: SCRAPER_API_KEY
     Value: [sua_api_key]

4. TESTAR:
   https://imaginatech-api.vercel.app/api/rastreio?codigo=AC992130091BR

IMPORTANTE:
- NUNCA coloque tokens diretamente no código
- SEMPRE use variáveis de ambiente
- O token fica seguro no servidor da Vercel
================================================== */
