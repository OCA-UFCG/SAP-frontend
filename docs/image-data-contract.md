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

## Envelope comprimido

Particoes grandes de `municipalAnalysis` sao publicadas no Contentful com
compressao sem perda.

```json
{
  "schemaVersion": 1,
  "type": "territorial-compact-compressed",
  "encoding": "gzip+base64",
  "mediaType": "application/vnd.sap.territorial-analysis+json",
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
