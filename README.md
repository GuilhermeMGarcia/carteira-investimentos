# carteira-investimentos

Sistema de acompanhamento e análise fundamentalista de uma carteira de investimentos (B3), construído em Google Sheets + Google Apps Script, com dados alimentados automaticamente por uma [API própria](https://github.com/GuilhermeMGarcia/api-indicadores-financeiros) e por fontes públicas (Banco Central, BrasilAPI, B3/FNET).

## Por que esse projeto existe

Acompanhar uma carteira de investimentos direito exige juntar três coisas que normalmente ficam espalhadas: indicadores atualizados de cada ativo, dados macroeconômicos (Selic, IPCA, Tesouro Direto) e uma análise fundamentalista mais profunda (valuation por fluxo de caixa, preço justo) para embasar a decisão de compra. Este sistema junta as três em planilhas que se comunicam entre si, com a parte repetitiva (buscar indicador, calcular índice, checar feriado) automatizada por scripts — deixando a parte que exige julgamento (ler demonstrativo, projetar fluxo de caixa, decidir alocação) manual, de propósito.

## Como as 3 planilhas se cruzam

```
┌─────────────────────────┐   FCFE_Valor, Excess_Return, TIR    ┌───────────────────┐
│                         │ ◄────────────────────────────────   │                   │
│  Carteira_Investimento  │                                     │    DFs_Ações      │
│    (Carteira/Painel)    │           (envio único —            │   (BP/DRE/DFC +   │
│                         │            DFs_Ações não recebe     │   valuation FCFE  │
│                         │            nada de volta)           │    por ativo)     │
└──────────┬──────────────┘                                     └───────────────────┘
           │        ▲
Preço_Justo│        │VP/Cota
           ▼        │
┌─────────────────────────┐
│                         │
│      DFs_FIIs           │
│   (DRE/BP mensal        │
│      por FII)           │
│                         │
└─────────────────────────┘
```

- **Carteira_Investimento** é o painel central: aloca capital por classe (Ações, FIIs, Renda Fixa, ETFs, Tesouro, Cripto) e traz os indicadores de decisão de cada ativo.
- **DFs_Ações** e **DFs_FIIs** são preenchidas manualmente, lendo demonstrativos financeiros reais (uma aba por ativo) — decisão proposital: ler e decidir é diferente de automatizar.
- A comunicação entre elas é via `IMPORTRANGE`/fórmula entre planilhas, e **não** é simétrica entre Ações e FIIs:
  - **Ações — mão única:** cada aba de ativo em DFs_Ações roda sua própria projeção de Fluxo de Caixa Livre para o Acionista (FCFE) e consolida o resultado na aba `Indicadores_Ações` em três colunas (`FCFE_Valor`, `Excess_Return`, `TIR`). A Carteira importa essas três colunas via `IMPORTRANGE` para popular a tabela de Ações na aba `HOME`. **DFs_Ações não recebe nada de volta** — é só fonte, nunca destino.
  - **FIIs — mão dupla:** a Carteira calcula o **Preço Justo** de cada FII na aba `HOME` (dividendo médio ÷ taxa-alvo, onde a taxa-alvo é NTNB + spread de risco) e envia esse valor para a aba `Indicadores` de DFs_FIIs via `IMPORTRANGE`. Em troca, DFs_FIIs devolve o **VP/Cota** (valor patrimonial por cota, extraído do balanço de cada fundo) para a Carteira usar no indicador Preço/VP.

## Planilhas (versão demo)

As versões abaixo são cópias públicas, sem dados financeiros pessoais e sem os scripts vinculados — servem para ver a estrutura, fórmulas e indicadores. *(confirmar se os links continuam válidos após a reestruturação antes de publicar)*

| Planilha | O que é | Link |
|---|---|---|
| Carteira_Investimento | Painel de alocação e indicadores de decisão | [Ver planilha](https://docs.google.com/spreadsheets/d/1miDY7IXuiTPfAb936_X-aGe-di66Souzw213ySD983Y/edit?usp=sharing) |
| DFs_Ações | Demonstrativos e valuation (FCFE) por ação | [Ver planilha](https://docs.google.com/spreadsheets/d/13BtipUqnMqTLuIjTLHxotLh69yonOifaQ-H3QjUvBGk/edit?usp=sharing) |
| DFs_FIIs | Demonstrativos mensais e indicadores de FIIs | [Ver planilha](https://docs.google.com/spreadsheets/d/1YexoNxj_9I75NcLB5j4bqKMWUJQZyOsjhfYiXJYkJNI/edit?usp=sharing) |

### O que tem em cada uma

**Carteira_Investimento**
| Aba | Função |
|---|---|
| `HOME` | Painel principal: alocação por classe, tabela de Ações (importa FCFE_Valor/Excess_Return/TIR de DFs_Ações), tabela de FIIs (calcula Preço Justo e importa VP/Cota de DFs_FIIs) |
| `Indicadores` | Selic, IPCA e cotação dos títulos do Tesouro Direto |
| `Decio_Bazin` | Dividendo médio dos últimos 3 anos por FII (usado no cálculo de Preço Justo) |
| `Eficiencia` | Rentabilidade da carteira: yield mensal, ganho de capital, comparativo vs. benchmark |
| `Aporte` | Screener de "está barato?" por ativo, para decidir o próximo aporte |
| `grafico` | Alocação por setor/ativo, para os gráficos do painel |
| `FERIADOS` | Calendário de feriados nacionais (próximo/atual/anterior) |
| `Status_Script` | Log de execução de cada script (última rodada, status OK/alerta/erro) |

**DFs_Ações** — uma aba por ativo (ex: `CMIG4`, `BBAS3`, `WEGE3`...) com Balanço Patrimonial, DRE trimestral e uma tabela de projeção de FCFE própria, mais:
| Aba | Função |
|---|---|
| `Indicadores_Ações` | Dados brutos vindos da API (linhas 9+) e o resumo de valuation por ticker: `FCFE_Valor`, `Excess_Return`, `TIR` (linhas 30+) — é esta faixa que a Carteira importa |
| `Status_Script` | Log de execução |

**DFs_FIIs** — uma aba por fundo (ex: `KNRI11`, `HGLG11`...) com DRE/BP mensal, mais:
| Aba | Função |
|---|---|
| `Indicadores` | VP/Cota de cada fundo (calculado aqui) e Preço_Justo (importado da Carteira) |
| `Calendário` | Eventos regulatórios (fatos relevantes, informes) vindos da API |
| `Status_Script` | Log de execução |

## Metodologia de valuation (resumo)

- **Ações:** cada aba de ativo projeta o Fluxo de Caixa Livre para o Acionista (FCFE) a partir dos dados contábeis de 12 meses vindos da API, chegando a um preço-alvo (`FCFE_Valor`). `Excess_Return` mede o retorno em excesso do ativo (célula dedicada dentro da própria aba do ticker) e `TIR` é a taxa interna de retorno implícita no fluxo de caixa projetado — as três métricas descem prontas para a Carteira, que só posiciona lado a lado com o preço de mercado (`GOOGLEFINANCE`).
- **FIIs:** o Preço Justo é `DPA médio (3 anos, aba Decio_Bazin) ÷ Taxa-alvo`, onde a taxa-alvo é a taxa da NTNB de referência (vinda de `/api/tesouro`) somada a um spread de risco definido manualmente por fundo. O VP/Cota, por outro lado, vem direto do balanço de cada fundo em DFs_FIIs — não é uma projeção, é dado contábil puro.

## Scripts (Google Apps Script)

Os scripts que automatizam cada planilha estão organizados por responsabilidade, um conjunto por planilha:

### `Carteira_Investimento/Script_Carteira/`
| Script | Função | Fonte de dado |
|---|---|---|
| `BCB.gs` | Busca Selic e IPCA acumulado (grava na aba `Indicadores`) | API do Banco Central |
| `ipca.gs` | Busca preços/taxas de Tesouro Selic, IPCA+ e Renda+ (grava na aba `Indicadores`) | [API própria](https://github.com/GuilhermeMGarcia/api-indicadores-financeiros) (`/api/tesouro`) |
| `Feriados.gs` | Atualiza a aba `FERIADOS` (ano anterior, atual e seguinte) | BrasilAPI |
| `Menu.gs` | Menu customizado desta planilha | interno |

### `DFs_Ações/Script_Ações/`
| Script | Função | Fonte de dado |
|---|---|---|
| `Indicadores_Ações.gs` | Busca os 11 campos de dados contábeis brutos + Beta por ticker (grava na aba `Indicadores_Ações`, em lotes de 5) | [API própria](https://github.com/GuilhermeMGarcia/api-indicadores-financeiros) (`/api/stock`) |
| `BCB.gs` | Busca Selic e IPCA acumulado (grava na aba `Indicadores_Ações`) | API do Banco Central |
| `Menu.gs` | Menu customizado desta planilha | interno |

### `DFs_FIIs/Script_FII/`
| Script | Função | Fonte de dado |
|---|---|---|
| `AtualizarIndicador_FII.gs` | Busca VP/cota, DY, cap rate, vacância e 16 campos por FII (grava na aba `Indicadores`, em lotes de 5) | [API própria](https://github.com/GuilhermeMGarcia/api-indicadores-financeiros) (`/api/fii`) |
| `Calendario.gs` | Cruza os FIIs da carteira com o CNPJ e busca fatos relevantes/informes do mês | [API própria](https://github.com/GuilhermeMGarcia/api-indicadores-financeiros) (`/api/calendar`) |
| `Filtrar.gs` | Filtra na aba `Calendário` os eventos de um ticker específico | interno |
| `Menu.gs` | Menu customizado desta planilha | interno |

Todos os três `Status_Script` das planilhas registram, para cada rotina, o status (`OK ✅` / `ALERTA ⚠️` / `ERRO ❌`) e o horário da última execução — visível também por um resumo rápido no menu (`❓ Ver Status do Sistema`).

## Configuração necessária

Pra rodar os scripts numa cópia própria das planilhas:

1. **API do Banco Central e BrasilAPI** — públicas, sem necessidade de chave.
2. **API própria de indicadores** — pública, sem chave (veja o [repositório da API](https://github.com/GuilhermeMGarcia/api-indicadores-financeiros)).
3. **Radar Opções (Tesouro Direto)** — *(confirmar se ainda é necessário após a atualização do endpoint `/api/tesouro` — o script `ipca.gs` atual chama a API própria, não mais o Radar Opções diretamente; revisar antes de publicar)*.

## Projeto relacionado

A camada de dados (indicadores brutos de Ações/FIIs, Tesouro Direto e eventos regulatórios) é servida por uma API própria em Python/FastAPI:
👉 [api-indicadores-financeiros](https://github.com/GuilhermeMGarcia/api-indicadores-financeiros) (v1.3.6)

---
> ⚠️ **Aviso:** este é um projeto pessoal em constante evolução. As planilhas podem conter erros lógicos em fórmulas internas (referências quebradas, cálculos desatualizados após alguma refatoração etc.). Os indicadores e valores aqui apresentados são de uso educacional/pessoal — confira os resultados antes de usá-los como base para qualquer decisão de investimento.

## Autor

G.Garcia
