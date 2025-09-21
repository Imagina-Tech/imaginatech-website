// ==================================================
// ARQUIVO: api/rastreio.js
// LOCALIZAÇÃO: pasta "api" na raiz do projeto
// FUNÇÃO: Rastreamento real de códigos dos Correios
// VERSÃO: 5.0 - Implementação funcional
// ==================================================

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Temporário para testes, depois mude para 'https://imaginatech.com.br'
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

  // Validar formato do código
  const codigoRegex = /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/;
  if (!codigoRegex.test(codigo)) {
    return res.status(400).json({ 
      error: 'Formato de código inválido' 
    });
  }

  try {
    console.log(`Buscando rastreamento para: ${codigo}`);
    
    // MÉTODO 1: BrasilAPI (funciona bem e é gratuita)
    try {
      console.log('Tentando BrasilAPI...');
      
      const brasilApiUrl = `https://brasilapi.com.br/api/rastreio/v1/encomendas/correios/${codigo}`;
      
      const brasilResponse = await fetch(brasilApiUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      if (brasilResponse.ok) {
        const brasilData = await brasilResponse.json();
        
        if (brasilData && brasilData.eventos && brasilData.eventos.length > 0) {
          console.log('Sucesso com BrasilAPI!');
          
          // Converter formato BrasilAPI para o esperado
          const eventos = brasilData.eventos.map(evento => ({
            descricao: evento.descricao || evento.status,
            dtHrCriado: `${evento.data} ${evento.hora || ''}`.trim(),
            unidade: {
              nome: evento.unidade || evento.local || 'CORREIOS'
            }
          }));
          
          return res.status(200).json({
            objetos: [{
              codObjeto: codigo,
              eventos: eventos,
              tipoPostal: { 
                categoria: brasilData.servico || 'SEDEX' 
              }
            }]
          });
        }
      }
    } catch (error) {
      console.log('Erro com BrasilAPI:', error.message);
    }
    
    // MÉTODO 2: WebScraping com Proxy
    try {
      console.log('Tentando webscraping via proxy...');
      
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(
        `https://www.linkcorreios.com.br/?id=${codigo}`
      )}`;
      
      const proxyResponse = await fetch(proxyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (proxyResponse.ok) {
        const proxyData = await proxyResponse.json();
        
        if (proxyData.contents) {
          const html = proxyData.contents;
          
          // Extrair eventos do HTML
          const eventos = [];
          
          // Buscar por padrões de status no HTML
          const statusPattern = /<li[^>]*class="[^"]*linha_status[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
          const matches = Array.from(html.matchAll(statusPattern));
          
          for (const match of matches) {
            const content = match[1];
            
            // Extrair informações
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
          
          // Se não encontrou com o primeiro padrão, tentar outro
          if (eventos.length === 0) {
            const tablePattern = /<table[^>]*class="[^"]*sro[^"]*"[^>]*>([\s\S]*?)<\/table>/i;
            const tableMatch = html.match(tablePattern);
            
            if (tableMatch) {
              const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
              const rows = Array.from(tableMatch[1].matchAll(rowPattern));
              
              for (const row of rows) {
                const cells = row[1].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
                
                if (cells && cells.length >= 2) {
                  const cleanText = (html) => html.replace(/<[^>]*>/g, '').trim();
                  
                  const dateTime = cleanText(cells[0]);
                  const status = cleanText(cells[1]);
                  const location = cells[2] ? cleanText(cells[2]) : '';
                  
                  if (status && dateTime) {
                    eventos.push({
                      descricao: status,
                      dtHrCriado: dateTime,
                      unidade: {
                        nome: location || 'CORREIOS'
                      }
                    });
                  }
                }
              }
            }
          }
          
          if (eventos.length > 0) {
            console.log('Sucesso com webscraping!');
            
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
    } catch (error) {
      console.log('Erro no webscraping:', error.message);
    }
    
    // MÉTODO 3: API Alternativa com JSONP
    try {
      console.log('Tentando API alternativa...');
      
      const alternativeUrl = `https://api.rastrearpedidos.com.br/api/rastreio/v1?codigo=${codigo}`;
      
      const altResponse = await fetch(alternativeUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      });

      if (altResponse.ok) {
        const altData = await altResponse.json();
        
        if (altData && altData.eventos && altData.eventos.length > 0) {
          console.log('Sucesso com API alternativa!');
          
          const eventos = altData.eventos.map(evento => ({
            descricao: evento.descricao,
            dtHrCriado: evento.data,
            unidade: {
              nome: evento.local || 'CORREIOS'
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
    } catch (error) {
      console.log('Erro com API alternativa:', error.message);
    }
    
    // Se nada funcionou, retornar mensagem apropriada
    console.log('Todos os métodos falharam');
    
    return res.status(200).json({
      objetos: [{
        codObjeto: codigo,
        mensagem: 'Sistema de rastreamento em manutenção',
        eventos: [{
          descricao: 'Tente acessar diretamente o site dos Correios',
          dtHrCriado: new Date().toLocaleDateString('pt-BR'),
          unidade: {
            nome: 'https://rastreamento.correios.com.br'
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

/* ==================================================
NOTAS IMPORTANTES:

1. BrasilAPI - API pública brasileira que funciona bem
   - Gratuita e sem necessidade de token
   - Dados atualizados dos Correios

2. WebScraping - Método de backup
   - Usa proxy para evitar CORS
   - Extrai dados diretamente do HTML

3. O Melhor Envio NÃO rastreia códigos dos Correios
   - Só rastreia envios feitos pela própria plataforma
   - Por isso removemos essa integração

4. CORS está temporariamente como '*' para testes
   - Depois mude para 'https://imaginatech.com.br'

5. Para testar:
   https://imaginatech-api.vercel.app/api/rastreio?codigo=AB475427204BR
================================================== */
