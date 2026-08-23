/**
 * MÓDULO: TESOURO DIRETO (IPCA+ E RENDA+)
 * Versão atualizada com autenticação via Token (Radar Opções)
 */
function atualizarTesouroIPCA() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("Indicadores");
  const abaStatus = ss.getSheetByName("Status_Script");


  if (!aba) return;


  // Cole aqui o seu Token oficial fornecido pela API
  const RADAR_TOKEN = PropertiesService.getScriptProperties().getProperty('RADAR_TOKEN');
 
  let status = "OK ✅";
  const matrizResultados = [];
 
  try {
    const anoAtual = new Date().getFullYear();
    const nomesParaBuscar = [
      `Tesouro IPCA+ ${anoAtual + 3}`,
      `Tesouro IPCA+ ${anoAtual + 6}`,
      `Tesouro IPCA+ ${anoAtual + 14}`,
      "Tesouro Renda+ Aposentadoria Extra 2065",
      `Tesouro Selic ${anoAtual + 5}`,
     
    ];


    for (const nome of nomesParaBuscar) {
      try {
        const url = "https://api.radaropcoes.com/bonds/" + encodeURIComponent(nome);
       
        // Incluindo o cabeçalho de autenticação necessário
        const opcoes = {
          method: "get",
          headers: { "Authorization": "Bearer " + RADAR_TOKEN },
          muteHttpExceptions: true
        };


        const resposta = UrlFetchApp.fetch(url, opcoes);


        if (resposta.getResponseCode() === 200) {
          const bond = JSON.parse(resposta.getContentText());


          // Validação extra sugerida pelo próprio exemplo da API
          if (bond.treasuryBondCode === null && bond.indication) {
            Logger.log(`Aviso para ${nome}: ${bond.indication}`);
            continue;
          }


          // Função interna para limpar as taxas (ex: "IPCA + 6,88%" -> 0.0688)
          // Adicionamos proteção (try/catch) caso a chave venha vazia ou com nome mudado
          const limparTaxa = (txt) => {
            if (!txt || typeof txt !== 'string') return 0;
            try {
              const num = txt.replace("IPCA +", "").replace("%", "").replace(",", ".").trim();
              return parseFloat(num) / 100;
            } catch(e) { return 0; }
          };


          // Mapeia os dados tratando possíveis mudanças de chaves secundárias na API
          const nomeTitulo = bond.treasuryBondName || nome;
          const taxaCompra = bond.investmentProfitabilityIndexerName ? limparTaxa(bond.investmentProfitabilityIndexerName) : 0;
          const precoCompra = bond.unitaryInvestmentValue || 0;
          const taxaVenda = bond.redemptionProfitabilityFeeIndexerName ? limparTaxa(bond.redemptionProfitabilityFeeIndexerName) : 0;
          const precoVenda = bond.unitaryRedemptionValue || 0;
         
          // Trata datas para não quebrar o script caso venham nulas
          const dataAtualizacao = bond.updated_at ? new Date(bond.updated_at) : new Date();
          const dataVencimento = bond.maturityDate ? new Date(bond.maturityDate) : "";


          matrizResultados.push([
            nomeTitulo,        // Coluna A: Nome
            taxaCompra,        // Coluna B: Taxa Compra
            precoCompra,       // Coluna C: Preço Compra
            taxaVenda,         // Coluna D: Taxa Venda (Mkt)
            precoVenda,        // Coluna E: Preço Venda (Mkt)
            dataAtualizacao,   // Coluna F: Data Atualização
            dataVencimento     // Coluna G: Data Vencimento
          ]);
        } else {
          Logger.log(`Erro HTTP ${resposta.getResponseCode()} ao buscar ${nome}`);
          status = "ALERTA ⚠️";
        }
      } catch (e) {
        Logger.log(`Erro ao buscar ${nome}: ${e}`);
        status = "ALERTA ⚠️";
      }
    }


    // Limpa a área antiga (A45:G63) para evitar dados duplicados/antigos colados
    aba.getRange("A3:G6").clearContent();


    if (matrizResultados.length > 0) {
      // Escreve os novos valores dinamicamente nas 7 colunas (A até G)
      aba.getRange(3, 1, matrizResultados.length, 7).setValues(matrizResultados);
    }


  } catch (e) {
    Logger.log("Erro Geral Tesouro: " + e);
    status = "ERRO ❌";
  }


  if (abaStatus) {
    abaStatus.getRange("A5:C5").setValues([["Titulos_IPCA", status, new Date()]]);
  }
}

