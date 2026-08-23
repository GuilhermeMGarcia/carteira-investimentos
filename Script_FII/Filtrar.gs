function buscarTickerNoCalendario() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName("Calendário");
  
  // 1. Pega o Ticker em G1
  const tickerBusca = aba.getRange("G1").getValue().toString().trim().toUpperCase();
  if (!tickerBusca) return;

  // 2. Lê os dados da tabela principal
  const ultimaLinha = aba.getLastRow();
  const rangeDados = aba.getRange(2, 1, Math.max(1, ultimaLinha - 1), 5);
  const dados = rangeDados.getDisplayValues();
  const richText = rangeDados.getRichTextValues();

  // 3. Filtra os resultados
  const resultados = [];
  const resultadosLinks = [];

  for (let i = 0; i < dados.length; i++) {
    if (dados[i][0].toString().toUpperCase() === tickerBusca) {
      resultados.push(dados[i]);
      resultadosLinks.push(richText[i][4].getLinkUrl());
    }
  }

  // 4. LIMPEZA SEGURA: Limpa APENAS da linha 2 até a linha 7 (6 linhas max, das colunas G até K)
  // Isso garante que a tabela da linha 9 em diante NUNCA seja afetada.
  aba.getRange(2, 7, 6, 5).clearContent().clearFormat();

  if (resultados.length > 0) {
    // Limita o número de resultados gravados a 6 para segurança
    const quantidade = Math.min(resultados.length, 6);
    
    // 5. Escreve os resultados na coluna G (índice 7)
    const rangeDestino = aba.getRange(2, 7, quantidade, 5);
    rangeDestino.setValues(resultados.slice(0, quantidade));
    
    // 6. Recria os links e aplica formatação
    for (let i = 0; i < quantidade; i++) {
      const celulaLink = aba.getRange(i + 2, 11); // Coluna K (11)
      const url = resultadosLinks[i];
      if (url) {
        celulaLink.setRichTextValue(SpreadsheetApp.newRichTextValue()
          .setText("Visualizar PDF 📄")
          .setLinkUrl(url)
          .build());
      }
      
      // Formatação de cor (Verde para Informe, Azul para Relatório)
      let cor = resultados[i][2].includes("Informe") ? "#d9ead3" : "#c9daf8";
      aba.getRange(i + 2, 7, 1, 5).setBackground(cor);
    }
    
    ss.toast("Busca finalizada!", "Sucesso", 3);
  } else {
    ss.toast("Nenhum registro encontrado para " + tickerBusca, "Aviso", 3);
  }
}