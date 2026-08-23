/**
 * MENU CENTRALIZADO (Atualizado)
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  ui.createMenu('🚀 Scripts')
    .addItem('📊 Atualizar Indicadores (Ações)', 'atualizarAcoes')
    .addItem('🏦 Atualizar Macro (Selic/IPCA)', 'atualizarBCB')
    .addSeparator() // NOVA LINHA
    .addItem('❓ Ver Status do Sistema', 'mostrarStatusRapido')
    .addToUi();
}

// Mantenha a função mostrarStatusRapido() aqui também...
/**
 * Exibe um resumo rápido da aba Status_Script
 */
function mostrarStatusRapido() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaStatus = ss.getSheetByName("Status_Script");
  
  if (!abaStatus) {
    SpreadsheetApp.getUi().alert("Aba 'Status_Script' não encontrada.");
    return;
  }
  
  const dados = abaStatus.getRange("A2:C5").getValues();
  
  // Monta uma mensagem bonita com os dados da aba Status
  let mensagem = "RESUMO DE EXECUÇÃO:\n\n";
  
  dados.forEach(linha => {
    if (linha[0]) { // Se a célula do nome do script não estiver vazia
      mensagem += `${linha[0]}: ${linha[1]} (${Utilities.formatDate(new Date(linha[2]), "GMT-3", "dd/mm HH:mm")})\n`;
    }
  });

  SpreadsheetApp.getUi().alert(mensagem);
}