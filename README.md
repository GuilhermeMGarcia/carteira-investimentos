# carteira-investimentos

Sistema de acompanhamento e análise fundamentalista de uma carteira de investimentos (B3), construído em Google Sheets + Google Apps Script, com dados alimentados automaticamente por uma [API própria](https://github.com/GuilhermeMGarcia/api-indicadores-financeiros) e por fontes públicas (Banco Central, BrasilAPI, B3/FNET).

## Por que esse projeto existe

Acompanhar uma carteira de investimentos direito exige juntar três coisas que normalmente ficam espalhadas: indicadores atualizados de cada ativo, dados macroeconômicos (Selic, IPCA) e uma análise fundamentalista mais profunda (fluxo de caixa descontado, valuation) para embasar decisão. Este sistema junta as três em planilhas que se comunicam entre si, com a parte repetitiva (buscar indicador, calcular índice) automatizada por scripts — deixando a parte que exige julgamento (ler demonstrativo, decidir alocação) manual, de propósito.

## Como as 3 planilhas se cruzam

```
┌───────────────────────┐   Preço Teto Bazin, DPA,    ┌───────────────────┐
│                        │   Margem do Fluxo de Caixa  │                   │
│   Guilherme            │ ───────────────────────────►│   DFs_Ações       │
│   (Carteira/Painel)    │                              │   (BP/DRE/DFC     │
│                        │ ◄─────────────────────────── │   trimestral)     │
│                        │      FCD_Valor               │                   │
└──────────┬─────────────┘   (valor intrínseco)         └───────────────────┘
           │
           │ Preço_Justo
           │ (NTNB + Spread)
           ▼
┌───────────────────────┐
│                        │
│   DFs_FIIs             │
│   (DRE/BP mensal       │
│   por FII)             │
│                        │
└────────────────────────┘
```

- **Carteira_Ivestimento** é o painel central: aloca capital por classe, e traz os indicadores de decisão de Ações e FIIs (Bazin, margem de segurança, DY).
- **DFs_Ações** e **DFs_FIIs** são preenchidas manualmente, lendo demonstrativos financeiros reais — decisão proposital: ler e decidir é diferente de automatizar.
- A comunicação entre elas é via referência de fórmula entre planilhas (mão dupla com DFs_Ações, mão única com DFs_FIIs):
  - Carteira envia **Preço Teto Bazin, DPA e Margem do Fluxo de Caixa** para DFs_Ações, e recebe de volta o **FCD_Valor** (valor intrínseco calculado por fluxo de caixa descontado).
  - Carteira envia o **Preço_Justo** (calculado via NTNB + Spread) para DFs_FIIs, que não envia nada de volta.

## Planilhas (versão demo)

As versões abaixo são cópias públicas, sem dados financeiros pessoais e sem os scripts vinculados — servem para ver a estrutura, fórmulas e indicadores.

| Planilha | O que é | Link |
|---|---|---|
| Carteira_Ivestimento | Painel de alocação e indicadores de decisão | [Ver planilha](https://docs.google.com/spreadsheets/d/1Yca_yKkSs8XODN8UQRDbkv06m2JPZPWGfDlAvqOuFnA/edit?gid=0#gid=0) |
| DFs_Ações | Demonstrativos trimestrais e valuation de ações | [Ver planilha](https://docs.google.com/spreadsheets/d/1ujByqR8S8LRZ2kRtkvuCwCRPYw31ta3JdfXYcMP7NC4) |
| DFs_FIIs | Demonstrativos mensais e indicadores de FIIs | [Ver planilha](https://docs.google.com/spreadsheets/d/1QSIy9lwTqT_vZX8hgawV3Wk65pDSb5Yv9jC2D0-rHDM) |

## Scripts (Google Apps Script)

Os scripts que automatizam a planilha "Guilherme" estão organizados por responsabilidade:

### `Script_Carteira/`
| Script | Função | Fonte de dado |
|---|---|---|
| `BCB.gs` | Busca Selic e IPCA acumulado | API do Banco Central |
| `ipca.gs` | Busca preços/taxas de Tesouro IPCA+ e Renda+ | API Radar Opções (requer token — veja Configuração) |
| `Feriados.gs` | Atualiza a aba de feriados nacionais | BrasilAPI |
| `Menu.gs` | Cria o menu customizado da planilha | interno |

### `Script_Ações/`
| Script | Função | Fonte de dado |
|---|---|---|
| `Indicadores_Ações.gs` | Busca ROE, P/L, dívida, margens por ticker de ação | [API própria](https://github.com/GuilhermeMGarcia/api-indicadores-financeiros) |
| `BCB.gs` | Busca indicadores macroeconômicos (Selic/IPCA) | API do Banco Central |
| `Menu.gs` | Menu customizado desta seção | interno |

### `Script_FII/`
| Script | Função | Fonte de dado |
|---|---|---|
| `AtualizarIndicador_FII.gs` | Busca VP/cota, DY, cap rate, vacância por FII | [API própria](https://github.com/GuilhermeMGarcia/api-indicadores-financeiros) |
| `Calendario.gs` | Cruza os FIIs da carteira com CNPJ e busca fatos relevantes/informes | [API própria](https://github.com/GuilhermeMGarcia/api-indicadores-financeiros) (`/calendar`) |
| `Filtrar.gs` | Filtra os eventos do calendário por ticker | interno |
| `Menu.gs` | Menu customizado desta seção | interno |

## Configuração necessária

Pra rodar os scripts numa cópia própria da planilha:

1. **API do Banco Central e BrasilAPI** — públicas, sem necessidade de chave.
2. **API própria de indicadores** — pública, sem chave (veja o [repositório da API](https://github.com/GuilhermeMGarcia/api-indicadores-financeiros)).
3. **Radar Opções (Tesouro Direto)** — precisa de um token. É gratuito: crie uma conta em [radaropcoes.com](https://radaropcoes.com/) e gere seu token. No editor do Apps Script, vá em **Configurações do projeto → Propriedades do script** e adicione a propriedade `RADAR_TOKEN` com o valor gerado — o script lê o token de lá, nunca do código-fonte.

## Projeto relacionado

A camada de dados (indicadores de Ações/FIIs e eventos regulatórios) é servida por uma API própria em Python/FastAPI:
👉 [api-indicadores-financeiros](https://github.com/GuilhermeMGarcia/api-indicadores-financeiros)

## Autor

Guilherme Marcelino Garcia de Oliveira
