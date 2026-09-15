# Índices de Monitoramento a partir da planilha da análise multicritério

Um índice do Monitoramento normalmente é um raster do Earth Engine: o mapa vem
em tiles e a estatística sai de uma FeatureCollection. Esta é a outra forma —
o valor de cada município vem de **uma coluna da planilha que a Análise
Multicritério já usa**, e o mapa pinta cada município com a cor da faixa em que
esse valor cai, como a coropleta da própria análise.

Não há Earth Engine em nenhum ponto deste caminho.

## Quando usar

Quando o dado existe como número por município e ainda não virou asset do GEE.
Continua valendo a direção do projeto: a casa dos dados territoriais é o asset
no Earth Engine, e um índice de planilha é uma forma de publicar antes disso,
não um substituto.

## O que o operador cadastra

No catálogo (`/platform?view=catalog`), a primeira pergunta do formulário é
**"De onde vem este índice"**:

- **Raster ou tabela do Google Earth Engine** — o formulário de sempre.
- **Coluna da planilha da Análise Multicritério** — esconde o formulário do
  Earth Engine inteiro (asset estatístico, asset de mapa, granularidade,
  propriedades territoriais) e pergunta:
  - **a coluna**, escolhida numa lista lida da própria planilha;
  - **o ano de exibição**, porque a planilha não tem eixo de tempo;
  - **como somar os municípios** (soma ou média) para chegar a UF e Brasil;
  - o **indicador** (rótulo, unidade, formato do número e cor), como num índice
    de valor único;
  - as **faixas de cor**, escritas à mão ou calculadas pelo sistema.

Escolher a coluna preenche o rótulo e a unidade do indicador com o que a aba
`criterios` diz sobre ela, sem sobrescrever o que já estiver escrito.

### As faixas de cor

São as duas opções que o operador escolhe:

- **escrever os limites**, na unidade do próprio indicador, um a menos que a
  quantidade de faixas;
- **"Calcular faixas iguais"**, que divide o intervalo entre o menor e o maior
  valor da coluna em partes iguais e escreve limites, rótulos e cores nos
  campos. O resultado é um ponto de partida editável: o que vale na publicação
  é o que estiver nos campos na hora de validar.

O cálculo vive em `src/utils/amfeSheetColumnRanges.ts` e é servido por
`POST /api/index-catalog/amfe-sheet/ranges`. Ele arredonda os limites conforme a
amplitude da coluna e volta aos valores exatos quando o arredondamento colaria
dois limites no mesmo número — uma faixa vazia pintaria uma cor que nenhum
município tem.

## O que é publicado

O mesmo `panelLayer` das demais camadas. Duas diferenças:

- `statisticsSource` é do tipo `amfe-sheet-column`
  (`src/contracts/amfeSheetColumn.ts`): coluna, ano de exibição e agregação.
- `imageData.mapVisualization` carrega
  `municipalChoropleth: { source: "amfe-sheet", column }`, junto com `palette` e
  `thresholds`. É essa marca que diz ao Monitoramento para desenhar a coropleta
  em vez de pedir tiles.

`years` tem um período só — o ano escolhido — e o `imageId` dele é a etiqueta
`planilha-amfe:<coluna>`, não um endereço: o contrato exige um `imageId` não
vazio, e esta camada não pede tile nenhum.

## Como o valor chega ao painel

`getGeeStatisticsYearPatch` desvia para `getAmfeSheetColumnYearPatch` antes de
inicializar o Earth Engine. O repositório
(`src/repositories/platform/amfeSheetRepository.ts`) baixa o `.xlsx` publicado
pelo Google Docs, converte a aba de dados em linhas municipais e reaproveita
`mapMunicipalValueRows`, o mesmo mapeamento da tabela municipal de valor único.

- A planilha é lida no máximo uma vez a cada 10 minutos por processo, com
  dedupe de leituras simultâneas e o valor expirado servido quando a releitura
  falha — o mesmo acordo das demais leituras da plataforma.
- Brasil e UFs saem da agregação das linhas municipais. **Região, bioma, ASD e
  semiárido ficam sem valor**, como na tabela municipal de valor único. A
  planilha até traz essas colunas, mas a agregação por elas ainda não foi
  implementada.
- Pedir qualquer outro período devolve o recorte sem valores: repetir o número
  do único ano publicado faria o painel afirmar algo que o dado não diz.

## Como o mapa é desenhado

`useSheetChoroplethLayer` (`src/components/PlatformMap/`) vê a marca no
`imageData`, não pede tile ao `/api/ee` e busca
`GET /api/municipal-analysis/[panelLayerId]/choropleth`. A rota devolve o
**nível da faixa** de cada município e a paleta — não os valores, que seriam
uma resposta muito maior para pintar o mesmo mapa.

A pintura reusa a coropleta da AMFE (`classificationLayers.ts`): as duas fontes
de municípios (tiles acima do zoom 5, GeoJSON de visão geral abaixo) e o
`feature-state`. A única mudança foi tornar a paleta configurável — a AMFE tem
cinco níveis fixos de prioridade, e um índice do catálogo tem a quantidade de
faixas que o operador escolheu.

A prévia do catálogo desenha um rascunho, que ainda não é um `panelLayer`
publicado, e por isso existe
`GET /api/index-catalog/drafts/[entryId]/choropleth`, o equivalente da rota de
tiles do rascunho.

As duas rotas aceitam `?locationKey=<código IBGE>` e devolvem então só aquele
município. É o que o mapa do Relatório Automático pede: ele enquadra um
município, e baixar a classificação dos 5.571 para pintar um polígono seria uma
resposta ~100x maior — multiplicada pelos até vinte índices do relatório.

### Onde mais a coropleta é desenhada

Três telas desenham a mesma classificação, cada uma com a fonte de geometria
que o enquadramento delas alcança:

- **Monitoramento** (`useSheetChoroplethLayer`) — tiles da malha municipal acima
  do zoom 5, GeoJSON de visão geral abaixo.
- **Relatório Automático e a prévia dele no catálogo**
  (`ReportMapPreview` + `reportChoroplethMap.ts`) — só os tiles, porque o quadro
  sempre enquadra um município; baixar os ~490 KB da visão geral por item do
  relatório custaria mais do que o mapa inteiro. O quadro sabe que é uma
  coropleta porque o lote de URLs devolve `municipal_choropleth`, que deixou de
  ser tratado como falta de imagem no período.
- **Imagem do cartão** (`CatalogPreviewMapCapture`) — só o GeoJSON de visão
  geral, porque o cartão enquadra o Brasil inteiro, abaixo do zoom 5, onde o
  `brazil-cities.mbtiles` não tem tile nenhum.

## Limitações conhecidas

- **Sem série histórica.** Um período só, e o painel não mostra gráfico.
- **Sem recortes agregados.** Região, bioma, ASD e semiárido ficam sem valor.
- **Municípios muito grandes no relatório.** O quadro do relatório pinta a
  coropleta a partir dos tiles da malha municipal, que existem do zoom 5 para
  cima. Um município cujo enquadramento caia abaixo disso sairia sem cor.
- **A planilha é pública e externa.** Ela é lida pela URL de exportação do
  Google Docs, sem credencial; se a planilha deixar de ser compartilhada por
  link, a leitura passa a falhar.

## O texto do relatório

Um índice de planilha tem **uma classe só** — o próprio indicador —, então o
catálogo o trata como índice de valor único também na narrativa: ele recebe
`[valor]`, `[unidade]` e `[valor_com_unidade]`, e **não** recebe `[percentual]`
nem `[classe]`. O texto padrão desses índices é
`DEFAULT_VALUE_INDEX_REPORT_SECTIONS`, e existe porque o genérico afirmava
"[percentual]% do seu território está na classe [classe]" — falso aqui: o número
é o valor do indicador, não uma fração de área.

## Variáveis de ambiente

`AMFE_SPREADSHEET_ID`, `AMFE_SHEET_DATA_TAB` e `AMFE_SHEET_METADATA_TAB`. Os
padrões são os mesmos do backend da análise multicritério; apontar as duas
aplicações para planilhas diferentes faria o mesmo critério mostrar números
diferentes em Monitoramento e em Análise.
