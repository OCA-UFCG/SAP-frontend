# Contrato `panelLayer.imageData`

`panelLayer.imageData` e o contrato que conecta Contentful, pipeline de CSV,
mapa, legenda, Earth Engine e analise territorial. A fonte executavel desse
contrato fica em `src/contracts/imageDataContract.mjs`.

## Versao atual

O formato versionado atual e `territorial-compact` com `schemaVersion: 1`.
Novas publicacoes de `panelLayer.imageData` devem usar esse formato.

```json
{
  "schemaVersion": 1,
  "type": "territorial-compact",
  "defaultYear": "2026",
  "classes": [{ "id": "a", "label": "Classe A", "color": "#111111" }],
  "locations": { "br": "Brasil" },
  "mapVisualization": { "sourceType": "image", "min": 0, "max": 100 },
  "years": {
    "2026": {
      "imageId": "projects/example/assets/layer_2026",
      "year": "2026",
      "valuesScale": 1,
      "values": { "br": [100] }
    }
  }
}
```

Para publicar `panelLayer.imageData`, a pipeline exige:

- `schemaVersion: 1`;
- `type: "territorial-compact"`;
- `defaultYear` existente em `years`;
- `classes` nao vazia, com `id`, `label` e `color`;
- `locations` nao vazio;
- `years` nao vazio;
- cada ano com `imageId` string nao vazia e `values` como objeto de arrays
  numericos.

## Periodos trimestrais (previsao sazonal)

Os indices de previsao sazonal (CPTEC/INMET) publicam um trimestre por periodo,
mas a chave continua sendo o **mes em que o trimestre comeca** (`2026-09`). O
que diz que aquele mes e, na verdade, um trimestre e a coluna `temporada` do
asset no Earth Engine, que guarda a sigla de tres letras (`SON`, `OND`, `NDJ`).

A publicacao do catalogo detecta essa coluna na mesma leitura que ja descobre as
classes — sem nenhuma ida extra ao Earth Engine e sem nenhum campo novo no
formulario — e grava `statisticsSource.properties.season`. Com isso, no runtime:

- o seletor de periodo do Monitoramento escreve "Setembro - Outubro - Novembro -
  2026" no lugar de `2026-09` (`src/utils/seasonalPeriod.ts`);
- a camada fica com uma opcao so, o trimestre que ainda nao terminou
  (`keepOnlyCurrentSeasonPeriod` em `src/utils/imageData.ts`, aplicada no
  `panelLayerRepository`).

A presenca da coluna nao basta. A previsao **mensal** do INMET tambem publica
`temporada`, mas com a sigla da emissao repetida em todos os meses (`2026-10`,
`2026-11` e `2026-12` todos como `OND`), enquanto no asset trimestral a sigla
acompanha o periodo (`2026-09` = `SON`, `2026-10` = `OND`). Por isso a
publicacao so grava `properties.season` quando, em **todos** os assets da fonte,
a sigla de cada periodo e a do trimestre que comeca naquele mes
(`seasonPairsDescribeQuarters`). Sem essa conferencia um indice mensal apareceria
rotulado como trimestral.

## Patches `municipalAnalysis`

`municipalAnalysis.imageData` pode ser um patch parcial. O asset visual do mapa
continua vindo do `panelLayer`, entao `imageId` e opcional nos anos do patch.

```json
{
  "templates": {
    "municipality": "No municipio de {name}, predomina {label}."
  },
  "years": {
    "2026": {
      "valuesScale": 1,
      "values": { "2507507": [80, 20] }
    }
  }
}
```

O patch municipal deve ter `years` nao vazio. Quando `values` aparece, ele deve
ser objeto de arrays numericos.

O runtime também pode produzir o mesmo patch sob demanda a partir de uma
`FeatureCollection` do Earth Engine. Essa origem não muda o contrato consumido
pelo frontend: classes, templates, visualização e `imageId` continuam no
`panelLayer`, enquanto o patch GEE acrescenta apenas `locations` e os `values`
do período e território solicitados. Veja `docs/gee-statistics.md`.

## Envelope comprimido

Particoes grandes de `municipalAnalysis` sao publicadas no Contentful com
compressao sem perda.

```json
{
  "schemaVersion": 1,
  "type": "territorial-compact-compressed",
  "encoding": "gzip+base64",
  "mediaType": "application/vnd.sedes.territorial-analysis+json",
  "data": ["H4sI..."]
}
```

O envelope precisa declarar `type`, `encoding` e `data`. Depois de descomprimir,
o payload tambem passa pelo contrato de patch municipal.

## Compatibilidade legada

O runtime ainda aceita o formato legado no contexto `runtimeRead` para nao
quebrar entradas antigas do Contentful. A pipeline nao aceita o formato legado
para novas publicacoes.

Formato legado simplificado:

```json
{
  "general": {
    "default": true,
    "imageId": "projects/example/assets/legacy",
    "imageParams": [{ "label": "Classe A", "color": "#111111" }]
  }
}
```

## `mapVisualization.sourceType` evita uma ida ao Earth Engine

Para instanciar a camada, `getEarthEngineUrl` precisa saber se o `imageId` é uma
`Image`, uma `ImageCollection` ou uma `FeatureCollection`. Quando o
`mapVisualization` declara `sourceType`, essa resposta já está no contrato e
nenhuma pergunta é feita ao Earth Engine; sem ele, `resolveGeeAssetType`
pergunta uma vez por asset e memoriza a resposta por 6 h
(`src/app/api/ee/assetType.ts`).

O tipo de um asset só muda quando alguém o reexporta com outra estrutura, e a
publicação do catálogo descarta esse cache junto com os demais. Uma leitura que
falha **não** é memorizada: guardá-la fixaria o ramo `ee.Image` numa camada que
é FeatureCollection.

Publicar `sourceType` é, portanto, a diferença entre uma e nenhuma ida ao Earth
Engine por URL de tiles. Das 19 camadas publicadas hoje, 11 o declaram.

## Uma `ImageCollection` é filtrada pelo período pedido

Quando `sourceType` é `imageCollection`, todos os períodos da camada podem
apontar para o mesmo endereço de coleção — é o caso do Índice de Aridez
(BR-DWGD, 35 anos; ERA5 Land, 45 anos) e da Cobertura da Terra IBGE (6 anos).
Nesses casos a chave do período é o único dado que diz qual imagem exibir.

`resolveImageCollectionPeriod` (`src/utils/imageData.ts`) converte a chave do
período na janela UTC correspondente (`1990` → 1º/jan/1990 até 1º/jan/1991;
`2024-12` → 1º/dez/2024 até 1º/jan/2025) e `selectImageCollectionImage`
(`src/app/api/ee/services.ts`) reduz a coleção a essa janela por
`system:time_start` antes de mosaicar. Se nenhuma imagem casar, a coleção
inteira volta a ser empilhada — o comportamento anterior, preservado para
coleções que são pedaços de um mesmo período. A decisão acontece dentro da
expressão do Earth Engine (`ee.Algorithms.If`), sem ida extra à rede.

Camadas com `imageCollectionSelection` (as de previsão) escolhem a imagem pela
rodada e pelo lead time e não passam por essa filtragem.

`mapVisualization.imageCollectionPeriodProperty` é o escape hatch para assets
cuja `system:time_start` não corresponde ao período publicado: ele nomeia a
etiqueta de ano das imagens (`ano_fim_janela`, `ano`, ...) e o filtro passa a
usá-la, aceitando o valor como número ou como texto, porque a mesma etiqueta
aparece nas duas formas dependendo de quem exportou o asset. O catálogo não
preenche esse campo; ele existe para edição direta no Contentful quando a data
do asset estiver errada.

## Exemplo invalido

```json
{
  "schemaVersion": 2,
  "type": "territorial-compact",
  "classes": [],
  "years": {}
}
```

Esse payload e invalido para publicacao porque usa versao desconhecida, nao tem
classes, nao tem anos e nao declara `defaultYear`.

# Extensão pelo catálogo administrativo

O Catálogo de índices gera somente `territorial-compact` v1 e usa os mesmos
validadores e particionamento da pipeline. O `panelLayer` mantém Brasil/UF e as
partições `municipalAnalysis` carregam os dados territoriais sob demanda. A
prévia usa as entries ainda não publicadas pela Contentful Management API; ela
não altera o modo global de preview da aplicação.

Camadas novas ainda ausentes do índice estático municipal podem tentar a API
sob demanda no detalhamento. Essa exceção não se aplica ao Relatório
Automático.
