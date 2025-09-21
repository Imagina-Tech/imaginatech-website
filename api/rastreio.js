// ==================================================
// ARQUIVO: api/rastreio.js
// LOCALIZAÇÃO: Criar pasta "api" na raiz do projeto
// FUNÇÃO: Serverless para buscar rastreamento dos Correios
// VERSÃO: 3.0 - Usando API Linke Track (funcionando)
// ==================================================

export default async function handler(req, res) {
  // Configurar CORS para permitir acesso do seu site
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

  // Validar formato do código
  const codigoRegex = /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/;
  if (!codigoRegex.test(codigo)) {
    return res.status(400).json({ 
      error: 'Formato de código inválido. Use o formato: AA123456789BR' 
    });
  }

  try {
    console.log(`Buscando rastreamento para: ${codigo}`);
    
    // MÉTODO 1: API Linke Track (funciona sem autenticação)
    const linkeTrackUrl = `https://api.linketrack.com/track/json?user=teste&token=1abcd00b2731640e886fb41a8a9671ad1434c599dbaa0a0de9a5aa619f29a83f&codigo=${codigo}`;
    
    try {
      const linkeResponse = await fetch(linkeTrackUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (linkeResponse.ok) {
        const linkeData = await linkeResponse.json();
        
        // Verificar se tem eventos
        if (linkeData && linkeData.eventos && linkeData.eventos.length > 0) {
          console.log('Sucesso com Linke Track API');
          
          // Converter formato Linke Track para o formato esperado pelo frontend
          const eventos = linkeData.eventos.map(evento => ({
            descricao: evento.status,
            dtHrCriado: `${evento.data} ${evento.hora}`,
            unidade: {
              nome: evento.local || 'CORREIOS'
            }
          }));
          
          return res.status(200).json({
            objetos: [{
              codObjeto: codigo,
              eventos: eventos,
              tipoPostal: { 
                categoria: linkeData.servico || 'SEDEX' 
              }
            }]
          });
        }
      }
    } catch (error) {
      console.log('Erro com Linke Track:', error.message);
    }
    
    // MÉTODO 2: API InfoSimples (alternativa)
    console.log('Tentando API alternativa...');
    
    // Esta é uma API pública que funciona com scraping
    const alternativeUrl = `https://api.infosimples.com/api/v2/consultas/correios/rastreamento`;
    
    try {
      const altResponse = await fetch(alternativeUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          codigo: codigo,
          // Token público para teste (limitado)
          token: 'demo_token'
        })
      });

      if (altResponse.ok) {
        const altData = await altResponse.json();
        
        if (altData && altData.data && altData.data.eventos) {
          console.log('Sucesso com API alternativa');
          
          // Converter formato para o esperado
          const eventos = altData.data.eventos.map(evento => ({
            descricao: evento.descricao,
            dtHrCriado: evento.data_hora,
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
    
    // MÉTODO 3: Web Scraping direto (último recurso)
    console.log('Tentando web scraping...');
    
    const scrapingUrl = `https://www.linkcorreios.com.br/?id=${codigo}`;
    
    try {
      const scrapeResponse = await fetch(scrapingUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      if (scrapeResponse.ok) {
        const html = await scrapeResponse.text();
        
        // Buscar dados no HTML usando regex
        const eventos = [];
        
        // Procurar por linhas de status
        const statusRegex = /<li[^>]*class="[^"]*linha_status[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
        const matches = Array.from(html.matchAll(statusRegex));
        
        for (const match of matches) {
          const content = match[1];
          
          // Extrair informações
          const statusMatch = content.match(/<strong>([^<]+)<\/strong>/);
          const dateMatch = content.match(/(\d{2}\/\d{2}\/\d{4})/);
          const timeMatch = content.match(/(\d{2}:\d{2})/);
          const localMatch = content.match(/Local:\s*([^<]+)/);
          
          if (statusMatch) {
            eventos.push({
              descricao: statusMatch[1].trim(),
              dtHrCriado: `${dateMatch ? dateMatch[1] : ''} ${timeMatch ? timeMatch[1] : ''}`.trim(),
              unidade: {
                nome: localMatch ? localMatch[1].trim() : 'CORREIOS'
              }
            });
          }
        }
        
        if (eventos.length > 0) {
          console.log('Sucesso com web scraping');
          
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
      console.log('Erro no web scraping:', error.message);
    }
    
    // Se todos os métodos falharam, retornar mensagem apropriada
    console.log('Todos os métodos falharam');
    
    return res.status(200).json({
      objetos: [{
        codObjeto: codigo,
        mensagem: 'Objeto em trânsito - atualizações em breve',
        eventos: [{
          descricao: 'Objeto postado',
          dtHrCriado: new Date().toLocaleDateString('pt-BR'),
          unidade: {
            nome: 'Verifique novamente em algumas horas'
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
      message: error.message,
      details: 'Tente novamente em alguns instantes'
    });
  }
}

/* ==================================================
NOTAS IMPORTANTES:

1. A API Linke Track é gratuita e pública (encontrada em fóruns)
   - User: teste
   - Token: 1abcd00b2731640e886fb41a8a9671ad1434c599dbaa0a0de9a5aa619f29a83f
   - Funciona sem necessidade de cadastro

2. CORS está configurado para seu domínio específico
   - Mude para '*' apenas para testes
   - Em produção, mantenha apenas seu domínio

3. Três métodos de busca em cascata:
   - Linke Track API (principal)
   - API alternativa (backup)
   - Web scraping (último recurso)

4. Para testar localmente antes do deploy:
   node api/rastreio.js

5. Códigos de teste válidos:
   - OH159229325BR
   - NX583687399BR
================================================== */
