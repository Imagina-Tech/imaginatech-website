// ==================================================
// ARQUIVO: api/rastreio.js
// LOCALIZAÇÃO: Criar pasta "api" na raiz do projeto
// FUNÇÃO: Serverless para buscar rastreamento dos Correios
// DEPLOY: Vercel (gratuito)
// ==================================================

export default async function handler(req, res) {
  // Habilitar CORS para permitir acesso do seu site
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Temporariamente permitir todos para teste
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight request
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

  // Validar formato do código (brasileiro)
  const codigoRegex = /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/;
  if (!codigoRegex.test(codigo)) {
    return res.status(400).json({ 
      error: 'Formato de código inválido. Use o formato: AA123456789BR' 
    });
  }

  try {
    console.log(`Buscando rastreamento para: ${codigo}`);
    
    // Usar Web Scraping do site dos Correios (mais confiável)
    const trackingUrl = `https://www.linkcorreios.com.br/?id=${codigo}`;
    
    // Buscar a página HTML
    const response = await fetch(trackingUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      }
    });

    if (!response.ok) {
      throw new Error('Erro ao buscar dados de rastreamento');
    }

    const html = await response.text();
    
    // Parser simples para extrair dados do HTML
    // Procurar por padrões conhecidos no HTML
    const eventos = [];
    
    // Regex para encontrar eventos no HTML
    const eventRegex = /<li[^>]*class="[^"]*linha_status[^"]*"[^>]*>(.*?)<\/li>/gs;
    const matches = html.matchAll(eventRegex);
    
    for (const match of matches) {
      const eventHtml = match[1];
      
      // Extrair descrição
      const descMatch = eventHtml.match(/<strong>([^<]+)<\/strong>/);
      const descricao = descMatch ? descMatch[1].trim() : 'Status';
      
      // Extrair data/hora
      const dateMatch = eventHtml.match(/(\d{2}\/\d{2}\/\d{4})/);
      const timeMatch = eventHtml.match(/(\d{2}:\d{2})/);
      const dataHora = (dateMatch && timeMatch) ? `${dateMatch[1]} ${timeMatch[1]}` : '';
      
      // Extrair local
      const localMatch = eventHtml.match(/Local:\s*([^<]+)/);
      const local = localMatch ? localMatch[1].trim() : '';
      
      if (descricao) {
        eventos.push({
          descricao: descricao,
          dtHrCriado: dataHora,
          unidade: local ? { nome: local } : null
        });
      }
    }
    
    // Se não encontrou eventos pelo parser, tentar buscar via API proxy alternativa
    if (eventos.length === 0) {
      console.log('Parser HTML não encontrou eventos, tentando API alternativa...');
      
      // Tentar API pública alternativa
      const apiUrl = `https://api.rastrearpedidos.com.br/api/rastreio/v1?codigo=${codigo}`;
      
      try {
        const apiResponse = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          timeout: 5000
        });
        
        if (apiResponse.ok) {
          const apiData = await apiResponse.json();
          
          // Formatar resposta no formato esperado
          return res.status(200).json({
            objetos: [{
              codObjeto: codigo,
              eventos: apiData.eventos || [],
              tipoPostal: { categoria: 'SEDEX' }
            }]
          });
        }
      } catch (apiError) {
        console.log('API alternativa também falhou:', apiError.message);
      }
      
      // Se ainda não tem eventos, retornar mensagem apropriada
      return res.status(200).json({
        objetos: [{
          codObjeto: codigo,
          mensagem: 'Objeto postado recentemente. Aguarde a atualização do sistema.',
          eventos: []
        }]
      });
    }
    
    // Formatar resposta no formato esperado pelo frontend
    const responseData = {
      objetos: [{
        codObjeto: codigo,
        eventos: eventos,
        tipoPostal: {
          categoria: 'SEDEX'
        }
      }]
    };
    
    return res.status(200).json(responseData);
    
  } catch (error) {
    console.error('Erro ao buscar rastreamento:', error);
    
    // Tentar última alternativa: retornar dados simulados para teste
    // REMOVA ESTA SEÇÃO EM PRODUÇÃO
    if (codigo === 'TEST00000000BR') {
      return res.status(200).json({
        objetos: [{
          codObjeto: codigo,
          eventos: [
            {
              descricao: 'Objeto postado',
              dtHrCriado: new Date().toISOString(),
              unidade: { nome: 'AC RIO DE JANEIRO' }
            }
          ],
          tipoPostal: { categoria: 'SEDEX' }
        }]
      });
    }
    
    return res.status(500).json({ 
      error: 'Erro ao buscar informações de rastreamento',
      message: error.message,
      details: 'As APIs dos Correios podem estar temporariamente indisponíveis'
    });
  }
}

