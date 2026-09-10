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
 * MÓDULO FIIs: Processamento dinâmico em lotes controlados (Ultra-rápido, Estável e Seguro)
 */
function processarBlocoFiisDinamico(aba) {
  const linhaInicial = 23; // Linha do cabeçalho
  const colunaInicial = 1; // Coluna A (Tickers)
  
  const limiteMaximoLinhas = aba.getLastRow() - linhaInicial + 1;
  if (limiteMaximoLinhas <= 0) return null;
  
  const valoresColunaA = aba.getRange(linhaInicial, colunaInicial, limiteMaximoLinhas, 1).getValues().flat();
  
  let totalLinhasBloco = 0;
  for (let i = 1; i < valoresColunaA.length; i++) {
    const valorCelulas = valoresColunaA[i] ? valoresColunaA[i].toString().trim() : "";
    if (valorCelulas === "" || valorCelulas.includes("Renda") || valorCelulas.includes("BCB")) {
      break;
    }
    totalLinhasBloco++;
  }

  if (totalLinhasBloco === 0) return null;

  const tickers = valoresColunaA.slice(1, totalLinhasBloco + 1);
  const erros = [];
  const TOTAL_COLUNAS_MAPEADAS = 16;
  const matrizResultados = [];

  // 🎯 CONTROLE DE FLUXO: Divide a lista em lotes de no máximo 5 FIIs por vez
  const TAMANHO_LOTE = 5;

  for (let i = 0; i < tickers.length; i += TAMANHO_LOTE) {
    const loteTickers = tickers.slice(i, i + TAMANHO_LOTE);

    const requests = loteTickers.map(ticker => {
      const tickerLimpo = ticker ? ticker.toString().trim() : "";
      return {
        url: `${BASE_URL}fii/${tickerLimpo}`,
        method: "get",
        muteHttpExceptions: true
      };
    });

    // Dispara o lote atual (máximo 5 em paralelo por vez)
    const responses = UrlFetchApp.fetchAll(requests);

    responses.forEach((res, index) => {
      const tickerAtual = loteTickers[index].toString().trim();

      try {
        if (res.getResponseCode() !== 200) {
          throw new Error(`HTTP ${res.getResponseCode()}`);
        }
        
        const json = JSON.parse(res.getContentText());

        matrizResultados.push([
          json.vp_cota ?? "",               // Coluna B
          json.ffo_yield ?? "",             // Coluna C
          json.div_yield ?? "",             // Coluna D
          json.patrimonio ?? "",            // Coluna E
          json.patrimonio_liq ?? "",        // Coluna F
          json.receita_3m ?? "",            // Coluna G
          json.venda_de_ativos_3m ?? "",    // Coluna H
          json.ffo_3m ?? "",                // Coluna I
          json.rend_distribuído_3m ?? "",   // Coluna J
          json.rend_distribuído_12m ?? "",  // Coluna K
          json.cap_rate ?? "",              // Coluna L
          json.vacância_média ?? "",        // Coluna M
          json.qtd_imóveis ?? "",           // Coluna N
          json.qtd_unidades ?? "",          // Coluna O
          json.qtd_cotas ?? "",             // Coluna P
          json.doc ?? ""                    // Coluna Q
        ]);
      } catch (e) {
        erros.push(`FII ${tickerAtual}: ${e.message}`);
        matrizResultados.push(new Array(TOTAL_COLUNAS_MAPEADAS).fill("⚠️"));
      }
    });

    // Pequena pausa entre lotes (250ms) para não sobrecarregar o Fundamentus
    if (i + TAMANHO_LOTE < tickers.length) {
      Utilities.sleep(250);
    }
  }

  // GRAVAÇÃO EM MASSA (Zero congelamento de planilha)
  if (matrizResultados.length > 0) {
    const rangeDestino = aba.getRange(linhaInicial + 1, 2, matrizResultados.length, TOTAL_COLUNAS_MAPEADAS);
    rangeDestino.clearContent();
    rangeDestino.setValues(matrizResultados);
  }

  return erros.length > 0 ? erros : null;
}
