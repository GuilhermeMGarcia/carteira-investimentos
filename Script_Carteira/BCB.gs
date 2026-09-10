/**
 * MÓDULO: BANCO CENTRAL (SELIC E IPCA)
 * Busca indicadores macroeconômicos via API do BCB de forma paralela e resiliente.
 */
function atualizarBCB() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("Indicadores");
  const abaStatus = ss.getSheetByName("Status_Script");

  if (!aba) return;

  let status = "OK ✅";
  const resultados = [[""], [""]]; // Selic (Linha 3) e IPCA (Linha 4)

  try {
    // 1. REQUISIÇÕES EM PARALELO (Reduz o tempo de espera pela metade)
    const requests = [
      {
        url: 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.1178/dados/ultimos/1?formato=json',
        method: 'get',
        muteHttpExceptions: true
      },
      {
        url: 'https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json',
        method: 'get',
        muteHttpExceptions: true
      }
    ];

    const [resSelic, resIpca] = UrlFetchApp.fetchAll(requests);

    // 2. PROCESSA SELIC
    try {
      if (resSelic.getResponseCode() === 200) {
        const jsonSelic = JSON.parse(resSelic.getContentText());
        if (jsonSelic && jsonSelic.length > 0 && jsonSelic[0].valor) {
          resultados[0][0] = parseFloat(jsonSelic[0].valor) / 100;
        } else {
          throw new Error("Payload Selic inválido");
        }
      } else {
        throw new Error(`HTTP ${resSelic.getResponseCode()}`);
      }
    } catch (e) {
      Logger.log("Erro Selic: " + e.message);
      resultados[0][0] = "Erro Selic";
      status = "ALERTA ⚠️";
    }

    // 3. PROCESSA IPCA (Acumulado 12 meses via Juros Compostos)
    try {
      if (resIpca.getResponseCode() === 200) {
        const jsonIpca = JSON.parse(resIpca.getContentText());
        if (Array.isArray(jsonIpca) && jsonIpca.length > 0) {
          const produtoFatores = jsonIpca.reduce((accFator, item) => {
            const taxaMensalDecimal = parseFloat(item.valor) / 100;
            return accFator * (1 + taxaMensalDecimal);
          }, 1);

          resultados[1][0] = produtoFatores - 1;
        } else {
          throw new Error("Payload IPCA inválido");
        }
      } else {
        throw new Error(`HTTP ${resIpca.getResponseCode()}`);
      }
    } catch (e) {
      Logger.log("Erro IPCA: " + e.message);
      resultados[1][0] = "Erro IPCA";
      status = "ALERTA ⚠️";
    }

    // 4. ESCRITA E FORMATAÇÃO EM MASSA (Junta setValues e setNumberFormat)
    const rangeAlvo = aba.getRange(3, 10, 2, 1);
    rangeAlvo.setValues(resultados);
    rangeAlvo.setNumberFormat("0.00%");

  } catch (e) {
    Logger.log("Erro Geral BCB: " + e);
    status = "ERRO ❌";
  }

  // 5. REGISTRO DE STATUS (A4:C4)
  if (abaStatus) {
    abaStatus.getRange("A4:C4").setValues([[
      "Selic_IPCA", 
      status, 
      new Date()
    ]]);
  }
}
