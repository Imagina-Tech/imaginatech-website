// ==================================================
// ARQUIVO: api/rastreio.js
// LOCALIZAÇÃO: Criar pasta "api" na raiz do projeto
// FUNÇÃO: Serverless para buscar rastreamento dos Correios
// VERSÃO: 2.0 - Usando API Cainiao Global (funciona com Correios)
// ==================================================

export default async function handler(req, res) {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
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
      error: 'Formato de código inválido. Use o formato: AA123456789BR' 
    });
  }

  try {
    console.log(`Buscando rastreamento para: ${codigo}`);
    
    // Método 1: Usar API Cainiao (funciona globalmente incluindo Correios)
    const cainiaoUrl = `https://global.cainiao.com/trackWebQueryRpc/getTrackingInfo.json?mailNos=${codigo}&lang=pt-BR`;
    
    const cainiaoResponse = await fetch(cainiaoUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://global.cainiao.com/'
      }
    });

    if (cainiaoResponse.ok) {
      const cainiaoData = await cainiaoResponse.json();
      
      // Processar resposta da Cainiao
      if (cainiaoData && cainiaoData.success && cainiaoData.data && cainiaoData.data.length > 0) {
        const tracking = cainiaoData.data[0];
        
        if (tracking.detailList && tracking.detailList.length > 0) {
          // Converter formato Cainiao para formato esperado
          const eventos = tracking.detailList.map(detail => ({
            descricao: detail.desc || detail.status,
            dtHrCriado: detail.time || detail.date,
            unidade: {
              nome: detail.standerdDesc || detail.location || 'CORREIOS'
            }
          }));
          
          return res.status(200).json({
            objetos: [{
              codObjeto: codigo,
              eventos: eventos,
              tipoPostal: { 
                categoria: tracking.productType || 'SEDEX' 
              }
            }]
          });
        }
      }
    }
    
    console.log('Cainiao falhou, tentando método alternativo...');
    
    // Método 2: Usar API alternativa (17Track public endpoint)
    const trackUrl = `https://t.17track.net/restapi/track`;
    
    const trackResponse = await fetch(trackUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Origin': 'https://www.17track.net'
      },
      body: JSON.stringify({
        nums: [codigo],
        fc: 0,
        sc: 0
      })
    });
    
    if (trackResponse.ok) {
      const trackData = await trackResponse.json();
      
      if (trackData && trackData.ret && trackData.ret === "1" && trackData.msg && trackData.msg.length > 0) {
        const tracking = trackData.msg[0];
        
        if (tracking.z1 && tracking.z1.length > 0) {
          // Converter formato 17track para formato esperado
          const eventos = tracking.z1.map(event => ({
            descricao: event.d || 'Status atualizado',
            dtHrCriado: event.a,
            unidade: {
              nome: event.c || 'CORREIOS'
            }
          }));
          
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
    }
    
    console.log('17Track falhou, tentando scraping direto...');
    
    // Método 3: Web scraping direto do site dos Correios
    const correiosPageUrl = `https://rastreamento.correios.com.br/app/resultado.php?objeto=${codigo}&mqs=S`;
    
    const pageResponse = await fetch(correiosPageUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    
    if (pageResponse.ok) {
      const html = await pageResponse.text();
      
      // Parser HTML para encontrar eventos
      const eventos = [];
      
      // Regex para encontrar a tabela de eventos
      const tableRegex = /<table[^>]*class="[^"]*sro-table[^"]*"[^>]*>(.*?)<\/table>/s;
      const tableMatch = html.match(tableRegex);
      
      if (tableMatch) {
        // Extrair linhas da tabela
        const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gs;
        const rows = tableMatch[1].matchAll(rowRegex);
        
        for (const row of rows) {
          const rowContent = row[1];
          
          // Extrair dados da linha
          const cellRegex = /<td[^>]*>(.*?)<\/td>/gs;
          const cells = Array.from(rowContent.matchAll(cellRegex));
          
          if (cells.length >= 2) {
            // Limpar HTML das células
            const cleanText = (html) => {
              return html.replace(/<[^>]*>/g, '').trim();
            };
            
            const dateTime = cleanText(cells[0][1]);
            const description = cleanText(cells[1][1]);
            const location = cells[2] ? cleanText(cells[2][1]) : '';
            
            if (description) {
              eventos.push({
                descricao: description,
                dtHrCriado: dateTime,
                unidade: {
                  nome: location || 'CORREIOS'
                }
              });
            }
          }
        }
      }
      
      if (eventos.length > 0) {
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
    
    // Se todos os métodos falharam, buscar via proxy de API
    console.log('Todos métodos falharam, tentando último recurso...');
    
    // Método 4: Usar serviço de proxy API
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://rastreamento.correios.com.br/app/resultado.php?objeto=${codigo}&mqs=S`)}`;
    
    const proxyResponse = await fetch(proxyUrl);
    
    if (proxyResponse.ok) {
      const proxyData = await proxyResponse.json();
      
      if (proxyData.contents) {
        const html = proxyData.contents;
        
        // Buscar dados no HTML
        const statusRegex = /class="[^"]*status[^"]*"[^>]*>([^<]+)</gi;
        const matches = Array.from(html.matchAll(statusRegex));
        
        if (matches.length > 0) {
          const eventos = [{
            descricao: matches[0][1].trim(),
            dtHrCriado: new Date().toISOString(),
            unidade: {
              nome: 'Verificar no site dos Correios'
            }
          }];
          
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
    }
    
    // Se absolutamente nada funcionou
    return res.status(200).json({
      objetos: [{
        codObjeto: codigo,
        mensagem: 'Sistema temporariamente indisponível. Tente novamente em alguns minutos.',
        eventos: [],
        tipoPostal: { 
          categoria: 'SEDEX' 
        }
      }]
    });
    
  } catch (error) {
    console.error('Erro crítico:', error);
    
    return res.status(500).json({ 
      error: 'Erro ao buscar informações de rastreamento',
      message: error.message,
      details: 'Tente novamente em alguns instantes'
    });
  }
}
