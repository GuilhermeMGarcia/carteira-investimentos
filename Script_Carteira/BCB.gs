/**
 * MÓDULO: BANCO CENTRAL (SELIC E IPCA)
 * Busca indicadores macroeconômicos via API do BCB com capitalização composta.
 * Mantém a escrita fixa no bloco de células conforme configurado.
 */
function atualizarBCB() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("Indicadores");
  const abaStatus = ss.getSheetByName("Status_Script");

  if (!aba) return;

  let status = "OK ✅";
  let resultados = [[""], [""]]; // Matriz para as duas linhas de respostas (Ex: Selic na linha 3, IPCA na linha 4)

  try {
    // 1. BUSCAR SELIC (SGS 1178) - Taxa anualizada
    try {
      const resSelic = UrlFetchApp.fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.1178/dados/ultimos/1?formato=json');
      const jsonSelic = JSON.parse(resSelic.getContentText());
      resultados[0][0] = parseFloat(jsonSelic[0].valor) / 100; // Salva como decimal para formatar como % na planilha
    } catch (e) {
      Logger.log("Erro Selic: " + e);
      resultados[0][0] = "Erro Selic";
      status = "ALERTA ⚠️";
    }

    // 2. BUSCAR IPCA (SGS 433) - Acumulado 12 meses via Juros Compostos
    try {
      const resIpca = UrlFetchApp.fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json');
      const jsonIpca = JSON.parse(resIpca.getContentText());
      
      // ALGORITMO DE JUROS COMPOSTOS:
      // Transforma cada taxa da API em fator multiplicador (1 + taxa) e multiplica todos entre si.
      const produtoFatores = jsonIpca.reduce((accFator, item) => {
        const taxaMensalDecimal = parseFloat(item.valor) / 100;
        const fatorMensal = 1 + taxaMensalDecimal;
        return accFator * fatorMensal;
      }, 1);

      // Subtrai 1 do produto final para retornar ao formato de taxa decimal puro (ex: 0.0431 para 4,31%)
      const acumuladoComposto = produtoFatores - 1;
      
      resultados[1][0] = acumuladoComposto; // Salva o IPCA corrigido na matriz
    } catch (e) {
      Logger.log("Erro IPCA: " + e);
      resultados[1][0] = "Erro IPCA";
      status = "ALERTA ⚠️";
    }

    // ESCREVE NO SEU BLOCO ORIGINAL (Linha 3, Coluna 10, tamanho de 2 linhas por 1 coluna)
    aba.getRange(3, 10, 2, 1).setValues(resultados);
    aba.getRange(3, 10, 2, 1).setNumberFormat("0.00%"); // Aplica a formatação de porcentagem

  } catch (e) {
    Logger.log("Erro Geral BCB: " + e);
    status = "ERRO ❌";
  }

  // ==== ATUALIZAÇÃO DE STATUS (A4:C4) ====
  if (abaStatus) {
    abaStatus.getRange("A4:C4").setValues([[
      "Selic_IPCA", 
      status, 
      new Date()
    ]]);
  }
}