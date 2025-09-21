// ==================================================
// ARQUIVO: api/rastreio.js
// LOCALIZAÇÃO: Criar pasta "api" na raiz do projeto
// FUNÇÃO: Serverless para buscar rastreamento dos Correios
// DEPLOY: Vercel (gratuito)
// ==================================================

export default async function handler(req, res) {
  // Habilitar CORS para seu domínio
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', 'https://imaginatech.com.br');
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
      error: 'Formato de código inválido' 
    });
  }

  try {
    console.log(`Buscando rastreamento para: ${codigo}`);
    
    // Opção 1: API oficial dos Correios (mais confiável)
    const correiosUrl = `https://proxyapp.correios.com.br/v1/sro-rastro/${codigo}`;
    
    const response = await fetch(correiosUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Referer': 'https://rastreamento.correios.com.br/',
        'Origin': 'https://rastreamento.correios.com.br'
      }
    });

    if (!response.ok) {
      // Se a API principal falhar, tentar alternativa
      console.log('API principal falhou, tentando alternativa...');
      
      // Opção 2: API alternativa dos Correios
      const alternativeUrl = `https://api.correios.com.br/rastro/v2/objetos/${codigo}`;
      
      const altResponse = await fetch(alternativeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json'
        }
      });

      if (!altResponse.ok) {
        throw new Error('Nenhuma API disponível no momento');
      }

      const altData = await altResponse.json();
      return res.status(200).json(altData);
    }

    const data = await response.json();
    
    // Verificar se há dados válidos
    if (!data.objetos || data.objetos.length === 0) {
      return res.status(404).json({ 
        error: 'Código de rastreamento não encontrado',
        codigo: codigo 
      });
    }

    // Retornar os dados
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('Erro ao buscar rastreamento:', error);
    
    return res.status(500).json({ 
      error: 'Erro ao buscar informações de rastreamento',
      message: error.message 
    });
  }
}
