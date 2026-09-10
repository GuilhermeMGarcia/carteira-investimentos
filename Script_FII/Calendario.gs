const URL_API_CALENDARIO = "https://api-indicadores-financeiros.vercel.app/api/calendar";

function atualizarCalendarioEventos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaIndicadores = ss.getSheetByName("Indicadores");
  const abaCalendario = ss.getSheetByName("Calendário");
  const abaStatus = ss.getSheetByName("Status_Script");

  if (!abaIndicadores || !abaCalendario || !abaStatus) {
    SpreadsheetApp.getUi().alert("Erro: Verifique se as abas 'Indicadores', 'Calendário' e 'Status_Script' existem.");
    return;
  }

  ss.toast("Iniciando leitura da carteira...", "Processando", 3);

  try {
    // ------------------------------------------------------------------
    // 1. EXTRAI A LISTA DE FIIs DA CARTEIRA
    // ------------------------------------------------------------------
    const ultimaLinhaInd = abaIndicadores.getLastRow();
    const tickersPermitidos = [];

    if (ultimaLinhaInd >= 3) {
      const listaFlls = abaIndicadores.getRange(3, 2, ultimaLinhaInd - 2, 1).getValues();
      for (let i = 0; i < listaFlls.length; i++) {
        const ticker = listaFlls[i][0] ? listaFlls[i][0].toString().trim().toUpperCase() : "";
        if (ticker === "") break;
        tickersPermitidos.push(ticker);
      }
    }

    if (tickersPermitidos.length === 0) {
      abaStatus.getRange("A3:C3").setValues([["Script_Calendario", "Erro ❌", new Date()]]);
      ss.toast("Aviso: Nenhum FII encontrado na coluna B (a partir da B3).", "Aviso", 4);
      return;
    }

    // ------------------------------------------------------------------
    // 2. BUSCA OS CNPJs CORRESPONDENTES
    // ------------------------------------------------------------------
    ss.toast("Filtrando CNPJs dos FIIs...", "Processando", 3);
    const dadosColunaA = abaIndicadores.getRange(23, 1, Math.max(1, ultimaLinhaInd - 22), 1).getValues().flat();
    const dadosColunaQ = abaIndicadores.getRange(23, 17, Math.max(1, ultimaLinhaInd - 22), 1).getValues().flat();
    const fundosLote = [];

    for (let i = 0; i < dadosColunaA.length; i++) {
      const ticker = dadosColunaA[i] ? dadosColunaA[i].toString().trim().toUpperCase() : "";
      const linkDoc = dadosColunaQ[i] ? dadosColunaQ[i].toString().trim() : "";

      if (ticker === "" || ticker.includes("RENDA")) break;

      if (tickersPermitidos.includes(ticker)) {
        const cnpjMatch = linkDoc.match(/cnpjFundo=(\d{14})/i) || linkDoc.match(/\d{14}/);
        if (cnpjMatch) {
          fundosLote.push({ "ticker": ticker, "cnpj": cnpjMatch[0].replace(/\D/g, "") });
        }
      }
    }

    if (fundosLote.length === 0) {
      abaStatus.getRange("A3:C3").setValues([["Script_Calendario", "Erro ❌", new Date()]]);
      ss.toast("Nenhum CNPJ correspondente encontrado para os FIIs da carteira.", "Aviso", 4);
      return;
    }

    // ------------------------------------------------------------------
    // 3. REQUISIÇÃO À API
    // ------------------------------------------------------------------
    ss.toast(`Consultando API para ${fundosLote.length} FIIs...`, "Aguarde", 5);

    const resposta = UrlFetchApp.fetch(URL_API_CALENDARIO, {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify({ "fundos": fundosLote }),
      "muteHttpExceptions": true
    });

    if (resposta.getResponseCode() === 200) {
      const eventos = JSON.parse(resposta.getContentText());
      eventos.sort((a, b) => a.ticker.localeCompare(b.ticker));

      // Limpa dados e formatações anteriores
      const ultimaLinhaCal = abaCalendario.getLastRow();
      if (ultimaLinhaCal > 1) {
        abaCalendario.getRange(2, 1, ultimaLinhaCal - 1, 5).clearContent().clearFormat();
      }

      if (eventos.length === 0) {
        abaStatus.getRange("A3:C3").setValues([["Script_Calendario", "OK ✅", new Date()]]);
        ss.toast("Nenhum evento encontrado para o mês atual.", "Sucesso", 5);
        return;
      }

      // ------------------------------------------------------------------
      // 4. PREPARAÇÃO DE MATRIZES EM LOTE (Sem loops lentos na planilha)
      // ------------------------------------------------------------------
      const matrizValores = [];
      const matrizCores = [];

      eventos.forEach(ev => {
        const dataPura = ev.data_envio ? ev.data_envio.substring(0, 10) : "";
        const linkFinal = (ev.link && ev.link !== "") ? ev.link : "https://fnet.bmfbovespa.com.br/fnet/publico/abrirGerenciadorDocumentosCVM";

        // Prepara linha de dados
        matrizValores.push([
          ev.ticker,
          dataPura,
          ev.tipo_documento,
          ev.assunto,
          `=HYPERLINK("${linkFinal}"; "Visualizar PDF 📄")`
        ]);

        // Prepara cores da linha
        let cor = "#ffffff";
        if (ev.tipo_documento.includes("Informe")) cor = "#d9ead3";
        else if (ev.tipo_documento.includes("Relatório")) cor = "#c9daf8";
        else if (ev.tipo_documento.includes("Fato")) cor = "#fce5cd";

        matrizCores.push([cor, cor, cor, cor, cor]);
      });

      // ------------------------------------------------------------------
      // 5. ESCRITA EM LOTE NA PLANILHA (Execução em ms)
      // ------------------------------------------------------------------
      ss.toast("Preenchendo planilha...", "Processando", 3);
      const rangeAlvo = abaCalendario.getRange(2, 1, eventos.length, 5);
      
      rangeAlvo.setValues(matrizValores);
      rangeAlvo.setBackgrounds(matrizCores);

      // Recria o Filtro
      let filter = abaCalendario.getFilter();
      if (filter) filter.remove();
      abaCalendario.getRange(1, 1, eventos.length + 1, 5).createFilter();

      abaStatus.getRange("A3:C3").setValues([["Script_Calendario", "OK ✅", new Date()]]);
      ss.toast(`Calendário atualizado! (${eventos.length} registros)`, "Sucesso", 5);

    } else {
      abaStatus.getRange("A3:C3").setValues([["Script_Calendario", "Erro ❌", new Date()]]);
      ss.toast("Erro na API: Código " + resposta.getResponseCode(), "Erro", 5);
    }

  } catch (e) {
    Logger.log(e);
    abaStatus.getRange("A3:C3").setValues([["Script_Calendario", "Erro ❌", new Date()]]);
    ss.toast("Erro ao processar: " + e.message, "Erro", 5);
  }
}
