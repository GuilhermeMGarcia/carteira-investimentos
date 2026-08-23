/**
 * MÓDULO: FERIADOS
 * Busca feriados nacionais via BrasilAPI e atualiza a aba FERIADOS
 */
function atualizarFeriadosNacionais() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  let aba = planilha.getSheetByName("FERIADOS");
  const abaStatus = planilha.getSheetByName("Status_Script");

  let status = "OK ✅";

  try {
    if (!aba) {
      aba = planilha.insertSheet("FERIADOS");
    } else {
      aba.clear(); // Limpa dados antigos para não sobrar lixo
    }

    const anoAtual = new Date().getFullYear();
    const url = `https://brasilapi.com.br/api/feriados/v1/${anoAtual}`;
    const resposta = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    
    if (resposta.getResponseCode() !== 200) throw new Error("Erro na API de Feriados");
    
    const feriados = JSON.parse(resposta.getContentText());

    // --- BATCH UPDATE (O segredo da velocidade) ---
    // Criamos uma matriz (lista de listas) para as datas
    const matrizFeriados = feriados.map(f => {
      // Ajuste para evitar erro de fuso horário (YYYY-MM-DD)
      const partes = f.date.split("-");
      const dataCorreta = new Date(partes[0], partes[1] - 1, partes[2]);
      return [dataCorreta]; // Coluna A
    });

    if (matrizFeriados.length > 0) {
      // Escreve todas as datas de uma vez só, começando na A1
      aba.getRange(1, 1, matrizFeriados.length, 1).setValues(matrizFeriados);
      // Formata a coluna como Data
      aba.getRange(1, 1, matrizFeriados.length, 1).setNumberFormat("dd/mm/yyyy");
    }

  } catch (e) {
    Logger.log("Erro ao buscar feriados: " + e);
    status = "ERRO ❌";
    SpreadsheetApp.getUi().alert("Erro ao atualizar feriados: " + e.message);
  }

  // ==== ATUALIZAÇÃO DE STATUS ====
  if (abaStatus) {
    abaStatus.getRange("A6:C6").setValues([[
      "Feriados", 
      status, 
      new Date()
    ]]);
  }
}