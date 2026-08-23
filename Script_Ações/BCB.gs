/**
 * MÓDULO: BANCO CENTRAL (SELIC E IPCA)
 * Busca indicadores macroeconômicos via API do BCB
 */
function atualizarBCB() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("Indicadores_Ações");
  const abaStatus = ss.getSheetByName("Status_Script");

  let status = "OK ✅";
  let resultados = [[""], [""]]; // Matriz para as células B36 e B37

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
    
    // ESCREVE NO BLOCO A3:B4 (2 linhas, 1 coluna)
    aba.getRange(3, 2, 2, 1).setValues(resultados);
    aba.getRange(3, 2, 2, 1).setNumberFormat("0.00%"); // Formata como porcentagem

  } catch (e) {
    Logger.log("Erro Geral BCB: " + e);
    status = "ERRO ❌";
  }

  // ==== ATUALIZAÇÃO DE STATUS (A3:C3) ====
  if (abaStatus) {
    abaStatus.getRange("A3:C3").setValues([[
      "Selic_IPCA", 
      status, 
      new Date()
    ]]);
  }
}