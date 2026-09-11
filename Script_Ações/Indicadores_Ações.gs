// URL base da API que fornece os dados dos indicadores financeiros das Ações
const BASE_URL = "https://api-indicadores-financeiros.vercel.app/api/";

/**
 * FUNÇÃO MESTRE: Orquestra a atualização do bloco de Ações sem travar a planilha
 */
function atualizarAcoes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaIndicadores = ss.getSheetByName("Indicadores_Ações");
  const abaStatus = ss.getSheetByName("Status_Script");

  if (!abaIndicadores || !abaStatus) {
    SpreadsheetApp.getUi().alert("Erro: Certifique-se que as abas 'Indicadores_Ações' e 'Status_Script' existem.");
    return;
  }

  let statusGeral = "OK ✅";
  let errosEncontrados = [];

  try {
    const logAcoes = processarBlocoAcoesDinamico(abaIndicadores);
    if (logAcoes) errosEncontrados.push(...logAcoes);

    if (errosEncontrados.length > 0) statusGeral = "ALERTA ⚠️";
  } catch (e) {
    statusGeral = "ERRO ❌";
    Logger.log("Erro Crítico no Bloco de Ações: " + e);
  }

  // Registra o log de execução na aba de controle de status
  if (abaStatus) {
    abaStatus.getRange("A2:C2").setValues([[
      "Script_Acoes",
      statusGeral,
      new Date()
    ]]);
  }

  if (errosEncontrados.length > 0) {
    SpreadsheetApp.getUi().alert("Finalizado com alertas de Ações:\n" + errosEncontrados.join("\n"));
  } else {
    ss.toast("Dados contábeis de Ações atualizados com sucesso!", "🚀 Sucesso", 5);
  }
}

/**
 * MÓDULO AÇÕES: Captura e processamento em lotes controlados.
 */
function processarBlocoAcoesDinamico(aba) {
  const linhaInicial = 10;  // Linha onde começam os tickers das ações
  const colunaInicial = 1; // Coluna A (Tickers)
  
  const limiteMaximoLinhas = aba.getLastRow() - linhaInicial + 1;
  if (limiteMaximoLinhas <= 0) return null;
  
  const valoresColunaA = aba.getRange(linhaInicial, colunaInicial, limiteMaximoLinhas, 1).getValues().flat();
  
  let totalLinhasBloco = 0;
  for (let i = 0; i < valoresColunaA.length; i++) {
    const tickerAtual = valoresColunaA[i] ? valoresColunaA[i].toString().trim() : "";
    if (tickerAtual === "" || tickerAtual.includes("Renda") || tickerAtual.includes("BCB")) {
      break;
    }
    totalLinhasBloco++;
  }

  if (totalLinhasBloco === 0) return null;

  const tickers = valoresColunaA.slice(0, totalLinhasBloco);
  const erros = [];
  
  // 🎯 15 Colunas mapeadas (B até P)
  const TOTAL_COLUNAS_MAPEADAS = 15; 
  const matrizResultados = [];

  // Busca a API Key cadastrada em "Propriedades do Script"
  const apiKeyMaisRetorno = PropertiesService.getScriptProperties().getProperty("Key_MaisRetorno") || "";

  // 🎯 DIVISÃO EM LOTES: No máximo 5 ações simultâneas por rodada
  const TAMANHO_LOTE = 5;

  for (let i = 0; i < tickers.length; i += TAMANHO_LOTE) {
    const loteTickers = tickers.slice(i, i + TAMANHO_LOTE);

    const requests = loteTickers.map(ticker => {
      const tickerLimpo = ticker ? ticker.toString().trim() : "";
      return {
        url: BASE_URL + "stock/" + tickerLimpo,
        method: "get",
        headers: {
          "X-MaisRetorno-Key": apiKeyMaisRetorno
        },
        muteHttpExceptions: true
      };
    });

    // Dispara o lote atual
    const responses = UrlFetchApp.fetchAll(requests);

    responses.forEach((res, index) => {
      const tickerAtual = loteTickers[index] ? loteTickers[index].toString().trim() : "";

      if (!tickerAtual) {
        matrizResultados.push(new Array(TOTAL_COLUNAS_MAPEADAS).fill(""));
        return;
      }

      try {
        if (res.getResponseCode() !== 200) {
          throw new Error(`HTTP ${res.getResponseCode()}`);
        }
        
        const json = JSON.parse(res.getContentText());

        // Mapeamento dos Dados:
        // Colunas B a L -> Mantêm o dado puro exatamente como vem da API
        // Colunas M a P -> Tratam a string para número puro via parseValorNumerico
        matrizResultados.push([
          json.ult_balanco_processado ?? "",                     // Coluna B
          json.qtd_acao ?? "",                                   // Coluna C
          json.cagr_receita_5a ?? "",                            // Coluna D
          json.ativo ?? "",                                      // Coluna E
          json.disponibilidades ?? "",                           // Coluna F
          json.divida_bruta ?? "",                               // Coluna G
          json.patrimonio_liquido ?? "",                         // Coluna H
          json.receita_liquida_12m ?? "",                        // Coluna I
          json.ebit_12m ?? "",                                   // Coluna J
          json.lucro_liquido_12m ?? "",                          // Coluna K
          json.beta_ibov_3a ?? "",                               // Coluna L
          parseValorNumerico(json.rentabilidade_total),          // Coluna M
          json.sharpe_total ?? "",                 // Coluna N
          json.rentabilidade_12m ?? "",            // Coluna O
          json.sharpe_12m ?? ""                    // Coluna P
        ]);
      } catch (e) {
        erros.push(`Ação \({tickerAtual}:\){e.message}`);
        matrizResultados.push(new Array(TOTAL_COLUNAS_MAPEADAS).fill("⚠️"));
      }
    });

    // Pausa de 250ms entre os lotes
    if (i + TAMANHO_LOTE < tickers.length) {
      Utilities.sleep(250);
    }
  }

  // GRAVAÇÃO EM MASSA (Colunas B em diante)
  if (matrizResultados.length > 0) {
    const rangeDestino = aba.getRange(linhaInicial, 2, matrizResultados.length, TOTAL_COLUNAS_MAPEADAS);
    rangeDestino.clearContent();
    rangeDestino.setValues(matrizResultados);
  }

  return erros.length > 0 ? erros : null;
}


/**
 * HELPER: Remove apenas o caractere de porcentagem %, mantendo a formatação PT-BR intacta ("36.433,34")
 */
function parseValorNumerico(valor) {
  if (valor === null || valor === undefined || valor === "") return "";
  
  // Apenas remove o símbolo de % e limpa espaços nas pontas
  return valor.toString().replace("%", "").trim();
}
