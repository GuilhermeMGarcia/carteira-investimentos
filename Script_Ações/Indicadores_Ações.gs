// URL base da API que fornece os dados dos indicadores financeiros das Ações
const BASE_URL = "https://api-indicadores-financeiros.vercel.app/api/";

/**
 * FUNÇÃO MESTRE: Orquestra a atualização do bloco de Ações sem travar a planilha
 */
function atualizarAcoes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaIndicadores = ss.getSheetByName("Indicadores_Ações");
  const abaStatus = ss.getSheetByName("Status_Script");

  // Validação de segurança para garantir que as abas necessárias existem no arquivo
  if (!abaIndicadores || !abaStatus) {
    SpreadsheetApp.getUi().alert("Erro: Certifique-se que as abas 'Indicadores_Ações' e 'Status_Script' existem.");
    return;
  }

  let statusGeral = "OK ✅";
  let errosEncontrados = [];

  try {
    // Executa o processamento do bloco de Ações de forma totalmente dinâmica
    const logAcoes = processarBlocoAcoesDinamico(abaIndicadores);
    if (logAcoes) errosEncontrados.push(...logAcoes);

    // Se houver algum erro pontual em algum ticker, muda o status para Alerta
    if (errosEncontrados.length > 0) statusGeral = "ALERTA ⚠️";

  } catch (e) {
    statusGeral = "ERRO ❌";
    Logger.log("Erro Crítico no Bloco de Ações: " + e);
  }

  // Registra o log de execução na aba de controle de status
  // Modificado para a linha 3 (A3:C3) para não sobrescrever o log dos FIIs que está na linha 2!
  if (abaStatus) {
    abaStatus.getRange("A2:C2").setValues([[
      "Script_Acoes", 
      statusGeral, 
      new Date()
    ]]);
  }

  // Notifica o usuário sobre o resultado final do processamento
  if (errosEncontrados.length > 0) {
    SpreadsheetApp.getUi().alert("Finalizado com alertas de Ações:\n" + errosEncontrados.join("\n"));
  } else {
    ss.toast("Indicadores de Ações atualizados com sucesso!", "🚀 Sucesso", 5);
  }
}

/**
 * MÓDULO AÇÕES: Captura e processamento dinâmico e isolado por blocos.
 * Lê a coluna A, interrompe o fluxo de forma inteligente e escreve de B até T.
 */
function processarBlocoAcoesDinamico(aba) {
  const linhaInicial = 10;  // Linha onde começam os tickers das ações (ex: A3)
  const colunaInicial = 1; // Coluna A (onde ficam os Tickers)
  
  // 1. CAPTURA O INTERVALO MÁXIMO POSSÍVEL DA COLUNA A
  const limiteMaximoLinhas = aba.getLastRow() - linhaInicial + 1;
  if (limiteMaximoLinhas <= 0) return null; // Aborta se a planilha estiver vazia abaixo da linha 3
  
  const valoresColunaA = aba.getRange(linhaInicial, colunaInicial, limiteMaximoLinhas, 1).getValues().flat();
  
  // 2. IDENTIFICAÇÃO DINÂMICA DO FIM DO BLOCO (Algoritmo de Interrupção Controlada)
  let totalLinhasBloco = 0;
  
  for (let i = 0; i < valoresColunaA.length; i++) {
    const tickerAtual = valoresColunaA[i] ? valoresColunaA[i].toString().trim() : "";
    
    // CRITÉRIO DE PARADA: Se achar uma linha em branco ou o cabeçalho de outra tabela, para de contar imediatamente!
    // Isso protege as tabelas que estiverem posicionadas abaixo deste bloco
    if (tickerAtual === "" || tickerAtual.includes("Renda") || tickerAtual.includes("BCB")) {
      break;
    }
    totalLinhasBloco++;
  }

  // Se o bloco não contiver nenhum ticker válido, encerra o processamento
  if (totalLinhasBloco === 0) return null;

  // Extrai da lista global apenas os tickers pertencentes ao bloco ativo calculado
  const tickers = valoresColunaA.slice(0, totalLinhasBloco);
  
  const matrizResultados = [];
  const erros = [];
  
  // Quantidade exata de colunas mapeadas de dados vindos da API (Colunas B até T = 19 colunas)
  const totalColunasMapeadas = 19; 

  // 3. PROCESSAMENTO DAS REQUISIÇÕES DA API
  tickers.forEach((ticker) => {
    const tickerLimpo = ticker ? ticker.toString().trim() : "";

    // Proteção para o caso de alguma célula intermediária inválida
    if (!tickerLimpo) {
      matrizResultados.push(new Array(totalColunasMapeadas).fill(""));
      return;
    }

    try {
      // Faz a chamada HTTP utilizando o endpoint específico de ações ('/stock/')
      const res = UrlFetchApp.fetch(`${BASE_URL}/stock/${tickerLimpo}`, { muteHttpExceptions: true });
      
      // Se o servidor retornar algo diferente de 200 OK, dispara o tratamento de erro
      if (res.getResponseCode() !== 200) throw new Error("Ticker não encontrado na API");
      
      const json = JSON.parse(res.getContentText());

      // Mapeamento exato das propriedades do JSON para as colunas B até T da planilha
      matrizResultados.push([
        json.roe || "",                 // Coluna B
        json.roic || "",                // Coluna C
        json.margem_liquida || "",      // Coluna D
        json.divida_patrimonio || "",   // Coluna E
        json.cagr_lucro_5a || "",       // Coluna F
        json.patrimonio_liquido || "",  // Coluna G
        json.qtd_acao || "",            // Coluna H
        json.p_l || "",                 // Coluna I
        json.p_vp || "",                // Coluna J
        json.p_ebit || "",              // Coluna K
        json.ev_ebitda || "",           // Coluna L
        json.ev_ebit || "",             // Coluna M
        json.margem_ebit || "",         // Coluna N
        json.ativo || "",               // Coluna O
        json.divida_liquida || "",      // Coluna P
        json.divida_bruta || "",        // Coluna Q
        json.lucro_liquido_12m || "",   // Coluna R
        json.lucro_liquido_3m || "",    // Coluna S
        json.div_yield || ""            // Coluna T
      ]);
    } catch (e) {
      // Captura o erro pontual deste ativo para reportar no final sem quebrar a execução dos outros
      erros.push(`Ação ${tickerLimpo}: ${e.message}`);
      // Preenche a linha inteira da planilha deste ativo com alertas visuais
      matrizResultados.push(new Array(totalColunasMapeadas).fill("⚠️"));
    }
  });

  // 4. GRAVAÇÃO DOS DADOS NA PLANILHA DE FORMA DIMENSIONAL
  if (matrizResultados.length > 0) {
    const totalLinhasNovas = matrizResultados.length;
    const totalColunasNovas = matrizResultados[0].length; // Calcula a largura exata da matriz dinamicamente

    // Define a região exata de destino: inicia na linha 3, coluna 2 (Coluna B)
    const rangeDestino = aba.getRange(linhaInicial, 2, totalLinhasNovas, totalColunasNovas);
    
    // Limpa estritamente o conteúdo da área calculada para remover dados antigos antes de injetar os novos
    rangeDestino.clearContent();
    rangeDestino.setValues(matrizResultados);
  }

  // Retorna a lista de erros se houver, caso contrário retorna nulo
  return erros.length > 0 ? erros : null;
}