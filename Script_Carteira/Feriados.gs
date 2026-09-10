/**
 * MÓDULO: FERIADOS
 * Busca feriados nacionais via BrasilAPI para: Ano Anterior, Ano Atual e Próximo Ano.
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
      aba.clearContents(); // Limpa apenas o conteúdo das células mantendo estrutura
    }

    const anoAtual = new Date().getFullYear();
    const anosParaBuscar = [anoAtual - 1, anoAtual, anoAtual + 1];

    // 1. MONTA AS REQUISIÇÕES EM PARALELO
    const requests = anosParaBuscar.map(ano => ({
      url: `https://brasilapi.com.br/api/feriados/v1/${ano}`,
      method: 'get',
      muteHttpExceptions: true
    }));

    // Dispara as 3 chamadas juntas
    const responses = UrlFetchApp.fetchAll(requests);
    let todosFeriados = [];

    // 2. EXTRAI E CONSOLIDA OS DADOS
    responses.forEach((resposta, index) => {
      if (resposta.getResponseCode() === 200) {
        const dados = JSON.parse(resposta.getContentText());
        if (Array.isArray(dados)) {
          todosFeriados.push(...dados);
        }
      } else {
        Logger.log(`Aviso: Erro ao buscar feriados do ano ${anosParaBuscar[index]}`);
      }
    });

    if (todosFeriados.length === 0) {
      throw new Error("Nenhum feriado retornado pela API");
    }

    // 3. CONVERTE PARA OBJETO DATE E ORDENA CRONOLOGICAMENTE
    const matrizFeriados = todosFeriados
      .map(f => {
        // Correção de Fuso Horário (YYYY-MM-DD)
        const partes = f.date.split("-");
        return new Date(partes[0], partes[1] - 1, partes[2]);
      })
      .sort((a, b) => a - b) // Ordena do mais antigo para o mais recente
      .map(dataObj => [dataObj]); // Formata em matriz coluna [[Data]]

    // 4. GRAVAÇÃO EM MASSA (BATCH UPDATE)
    if (matrizFeriados.length > 0) {
      const rangeDestino = aba.getRange(1, 1, matrizFeriados.length, 1);
      rangeDestino.setValues(matrizFeriados);

      // Tenta formatar como data (com fallback seguro para não travar se for Tabela)
      try {
        rangeDestino.setNumberFormat("dd/mm/yyyy");
      } catch (e) {
        Logger.log("Aviso: Formatação herdada da Tabela/Planilha.");
      }
    }

  } catch (e) {
    Logger.log("Erro ao buscar feriados: " + e);
    status = "ERRO ❌";
    SpreadsheetApp.getUi().alert("Erro ao atualizar feriados: " + e.message);
  }

  // ==== ATUALIZAÇÃO DE STATUS (Linha A6:C6) ====
  if (abaStatus) {
    abaStatus.getRange("A6:C6").setValues([[
      "Feriados", 
      status, 
      new Date()
    ]]);
  }
}
