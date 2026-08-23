const BASE_URL = "https://api-indicadores-financeiros.vercel.app/api/";

/**
 * FUNÇÃO MESTRE: Orquestra a atualização sem travar a planilha
 */
function atualizarFIIs() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaIndicadores = ss.getSheetByName("Indicadores");
  const abaStatus = ss.getSheetByName("Status_Script");

  if (!abaIndicadores || !abaStatus) {
    SpreadsheetApp.getUi().alert("Erro: Certifique-se que as abas 'Indicadores' e 'Status_Script' existem.");
    return;
  }

  let statusGeral = "OK ✅";
  let errosEncontrados = [];

  try {
    // Processa o bloco de FIIs de forma dinâmica e segura
    const logFiis = processarBlocoFiisDinamico(abaIndicadores);
    if (logFiis) errosEncontrados.push(...logFiis);

    if (errosEncontrados.length > 0) statusGeral = "ALERTA ⚠️";

  } catch (e) {
    statusGeral = "ERRO ❌";
    Logger.log("Erro Crítico: " + e);
  }

  // Grava o status na aba de log
  abaStatus.getRange("A2:C2").setValues([[
    "Script_Indicador", 
    statusGeral, 
    new Date()
  ]]);

  if (errosEncontrados.length > 0) {
    SpreadsheetApp.getUi().alert("Finalizado com alertas:\n" + errosEncontrados.join("\n"));
  } else {
    ss.toast("Indicadores atualizados com sucesso!", "🚀 Sucesso", 5);
  }
}

/**
 * MÓDULO FIIs: Processamento dinâmico inteligente e isolado por blocos
 */
function processarBlocoFiisDinamico(aba) {
  const linhaInicial = 23; // Linha do cabeçalho "Fii, # VP/Cota..."
  const colunaInicial = 1; // Coluna A (onde ficam os Tickers)
  
  // 1. PEGA TODOS OS VALORES DA COLUNA A A PARTIR DA LINHA DE CABEÇALHO
  const limiteMaximoLinhas = aba.getLastRow() - linhaInicial + 1;
  if (limiteMaximoLinhas <= 0) return null;
  
  const valoresColunaA = aba.getRange(linhaInicial, colunaInicial, limiteMaximoLinhas, 1).getValues().flat();
  
  // 2. IDENTIFICA O TAMANHO DO BLOCO DE FIIS DINAMICAMENTE
  // O loop vai descer a coluna A. Se achar uma linha em branco ou o começo da tabela "BCB_2", ele para ali!
  let totalLinhasBloco = 0;
  
  for (let i = 1; i < valoresColunaA.length; i++) { // Começa de 1 para pular o cabeçalho "Fii"
    const valorCelulas = valoresColunaA[i] ? valoresColunaA[i].toString().trim() : "";
    
    // Se a célula estiver vazia ou encontrar a palavra "Renda" ou "BCB_2", o bloco de FIIs acabou
    if (valorCelulas === "" || valorCelulas.includes("Renda") || valorCelulas.includes("BCB")) {
      break;
    }
    totalLinhasBloco++;
  }

  // Se não houver nenhum ticker listado abaixo do cabeçalho, encerra o processamento
  if (totalLinhasBloco === 0) return null;

  // Extrai apenas os tickers pertencentes ao bloco dinâmico detectado
  const tickers = valoresColunaA.slice(1, totalLinhasBloco + 1);
  
  const matrizResultados = [];
  const erros = [];
  const totalColunasMapeadas = 13; // B até N (Quantidade exata de colunas de dados)

  tickers.forEach((ticker) => {
    const tickerLimpo = ticker ? ticker.toString().trim() : "";

    if (!tickerLimpo) {
      matrizResultados.push(new Array(totalColunasMapeadas).fill(""));
      return;
    }

    try {
      const res = UrlFetchApp.fetch(`${BASE_URL}/fii/${tickerLimpo}`, { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) throw new Error("Ticker não encontrado");
      
      const json = JSON.parse(res.getContentText());

      matrizResultados.push([
        json.vp_cota || "",             // Coluna B
        json.ffo_yield || "",            // Coluna C
        json.div_yield || "",  
        json.patrimonio || "",          
        json.patrimonio_liq || "",      
        json.receita_3m || "",          
        json.venda_de_ativos_3m || "",  
        json.ffo_3m || "",              
        json.rend_distribuído_3m || "", 
        json.rend_distribuído_12m || "",
        json.cap_rate || "",            
        json.vacância_média || "",      
        json.qtd_imóveis || "",         
        json.qtd_unidades || "",        
        json.qtd_cotas || "",
        json.doc || ""            
      ]);
    } catch (e) {
      erros.push(`FII ${tickerLimpo}: ${e.message}`);
      matrizResultados.push(new Array(totalColunasMapeadas).fill("⚠️"));
    }
  });

  if (matrizResultados.length > 0) {
    const totalLinhasNovas = matrizResultados.length;
    const totalColunasNovas = matrizResultados[0].length;

    // Define a região exata para os dados na coluna B (coluna 2), logo abaixo do cabeçalho
    const rangeDestino = aba.getRange(linhaInicial + 1, 2, totalLinhasNovas, totalColunasNovas);
    
    // Limpa apenas o espaço correspondente aos dados deste bloco e insere os novos valores
    rangeDestino.clearContent();
    rangeDestino.setValues(matrizResultados);
  }

  return erros.length > 0 ? erros : null;
}