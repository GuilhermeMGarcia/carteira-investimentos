/**
 * MÓDULO: TESOURO DIRETO (Sincronizado via API - Compatível com Tabelas do Google Sheets)
 */
function atualizarTesouroIPCA() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("Indicadores");
  const abaStatus = ss.getSheetByName("Status_Script");

  if (!aba) return;

  const API_URL = "https://api-indicadores-financeiros.vercel.app/api/tesouro"; 

  let status = "OK ✅";
  const matrizResultados = [];

  try {
    const anoAtual = new Date().getFullYear();
    
    const nomesParaBuscar = [
      `Tesouro IPCA+ ${anoAtual + 3}`,
      `Tesouro IPCA+ ${anoAtual + 6}`,
      `Tesouro IPCA+ ${anoAtual + 14}`,
      "Tesouro Renda+ Aposentadoria Extra 2065",
      `Tesouro Selic ${anoAtual + 5}`
    ];

    const opcoes = {
      method: "get",
      muteHttpExceptions: true
    };

    let json = null;
    const maxTentativas = 3;

    for (let i = 1; i <= maxTentativas; i++) {
      const resposta = UrlFetchApp.fetch(API_URL, opcoes);
      
      if (resposta.getResponseCode() === 200) {
        const dados = JSON.parse(resposta.getContentText());
        
        if (dados && dados.status === "OK" && Array.isArray(dados.titulos) && !dados.detail) {
          json = dados;
          break;
        }
      }
      
      Logger.log(`Tentativa ${i} de ${maxTentativas} falhou...`);
      if (i < maxTentativas) {
        Utilities.sleep(1500);
      }
    }

    if (json) {
      const limparTaxa = (txt) => {
        if (txt === null || txt === undefined) return 0;
        if (typeof txt === 'number') return txt > 1 ? txt / 100 : txt;
        try {
          const num = txt.toString().replace(/[^0-9,-]/g, "").replace(",", ".").trim();
          return parseFloat(num) / 100;
        } catch(e) { return 0; }
      };

      const limparPreco = (txt) => {
        if (txt === null || txt === undefined) return 0;
        if (typeof txt === 'number') return txt;
        try {
          const num = txt.toString().replace("R$", "").replace(/\./g, "").replace(",", ".").trim();
          return parseFloat(num);
        } catch(e) { return 0; }
      };

      for (const nomeAlvo of nomesParaBuscar) {
        const t = json.titulos.find(item => 
          item.nome && item.nome.trim().toLowerCase() === nomeAlvo.trim().toLowerCase()
        );

        if (t) {
          matrizResultados.push([
            t.nome,                         // Coluna A
            limparTaxa(t.taxa_compra),      // Coluna B
            limparPreco(t.preco_compra),    // Coluna C
            limparTaxa(t.taxa_venda),       // Coluna D
            limparPreco(t.preco_venda),     // Coluna E
            new Date(),                     // Coluna F
            t.vencimento || ""              // Coluna G
          ]);
        } else {
          Logger.log(`Aviso: Título não encontrado na API: ${nomeAlvo}`);
        }
      }
    } else {
      status = "ALERTA ⚠️";
    }

    // ESCRITA EM LOTE (Sem forçar formatação para respeitar o tipo da Tabela)
    if (matrizResultados.length > 0) {
      const rangeDestino = aba.getRange(3, 1, 5, 7);
      rangeDestino.clearContent();

      const rangeNovosDados = aba.getRange(3, 1, matrizResultados.length, 7);
      rangeNovosDados.setValues(matrizResultados);
    } else {
      status = "ALERTA ⚠️";
    }

  } catch (e) {
    Logger.log("Erro Geral no Script do Tesouro: " + e);
    status = "ERRO ❌";
  }

  if (abaStatus) {
    abaStatus.getRange("A5:C5").setValues([["Titulos_IPCA", status, new Date()]]);
  }
}
