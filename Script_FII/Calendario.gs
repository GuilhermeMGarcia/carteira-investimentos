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
    // 1. EXTRAI A LISTA DE FIIs DA CARTEIRA (Aba Indicadores | Coluna B3 em diante)
    // ------------------------------------------------------------------
    const ultimaLinhaInd = abaIndicadores.getLastRow();
    const tickersPermitidos = [];
    
    if (ultimaLinhaInd >= 3) {
      const listaFlls = abaIndicadores.getRange(3, 2, ultimaLinhaInd - 2, 1).getValues();
      for (let i = 0; i < listaFlls.length; i++) {
        const ticker = listaFlls[i][0] ? listaFlls[i][0].toString().trim().toUpperCase() : "";
        if (ticker === "") break; // Para na primeira célula em branco
        tickersPermitidos.push(ticker);
      }
    }

    if (tickersPermitidos.length === 0) {
      // Registra Erro na linha 3 do Status
      abaStatus.getRange("A3:C3").setValues([["Script_Calendario", "Erro ❌", new Date()]]);
      ss.toast("Aviso: Nenhum FII encontrado na coluna B (a partir da B3).", "Aviso", 4);
      return;
    }

    // ------------------------------------------------------------------
    // 2. BUSCA OS CNPJs NA MESMA ABA (A partir da linha 23) E FILTRA A CARTEIRA
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

      ss.toast("Limpando e preenchendo aba Calendário...", "Processando", 3);

      // Limpeza do Calendário
      abaCalendario.getRange(2, 1, Math.max(1, abaCalendario.getLastRow() - 1), 5).clearContent().clearFormat();

      // ------------------------------------------------------------------
      // 4. GRAVAÇÃO DOS DADOS E CORES
      // ------------------------------------------------------------------
      eventos.forEach((ev, index) => {
        const linha = index + 2;
        const dataPura = ev.data_envio ? ev.data_envio.substring(0, 10) : "";
        const linkFinal = (ev.link && ev.link !== "") ? ev.link : "https://fnet.bmfbovespa.com.br/fnet/publico/abrirGerenciadorDocumentosCVM";
        
        const rowData = [
          ev.ticker, 
          dataPura, 
          ev.tipo_documento, 
          ev.assunto, 
          `=HYPERLINK("${linkFinal}"; "Visualizar PDF 📄")`
        ];
        
        const rangeLinha = abaCalendario.getRange(linha, 1, 1, 5);
        rangeLinha.setValues([rowData]);

        // Cores
        let cor = "#ffffff";
        if (ev.tipo_documento.includes("Informe")) cor = "#d9ead3";
        else if (ev.tipo_documento.includes("Relatório")) cor = "#c9daf8";
        else if (ev.tipo_documento.includes("Fato")) cor = "#fce5cd";
        
        rangeLinha.setBackground(cor);
      });

      // Recria o Filtro
      let filter = abaCalendario.getFilter();
      if (filter) filter.remove();
      abaCalendario.getRange(1, 1, eventos.length + 1, 5).createFilter();

      // 🔥 ATUALIZA A LINHA 3 DA ABA STATUS_SCRIPT (A3:C3)
      abaStatus.getRange("A3:C3").setValues([["Script_Calendario", "OK ✅", new Date()]]);

      ss.toast(`Calendário atualizado com sucesso! (${eventos.length} registros)`, "Sucesso", 5);

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