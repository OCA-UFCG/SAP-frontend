# Ingestion Pipeline

## Visão Geral

A pipeline transforma CSVs exportados do Google Earth Engine em entries
`municipalAnalysis` no Contentful, permitindo que o frontend consuma
dados já normalizados e particionados.

## Arquitetura

```mermaid
flowchart TB
  subgraph External[Fontes externas]
    GEE[Google Earth Engine]
    DRIVE[Google Drive]
  end

  subgraph Pipeline[Ingestion Pipeline]
    INGEST[Ingestão]
    TRANSFORM[Transformação]
    SPLIT[Particionamento]
    ENCODE[Compressão e encoding]
  end

  subgraph CMS[Contentful]
    MA[municipalAnalysis]
    PL[panelLayer]
  end

  subgraph App[Frontend]
    MAP[Mapa]
    ANALYTICS[Painéis analíticos]
  end

  GEE --> DRIVE
  DRIVE --> INGEST
  INGEST --> TRANSFORM
  TRANSFORM --> SPLIT
  SPLIT --> ENCODE
  ENCODE --> MA

  MA --> ANALYTICS
  PL --> MAP
  MAP --> ANALYTICS

  CONTRACTS[Contratos: nome do arquivo, colunas, ano e território]
  LIMITS[Limites: tamanho das entries e payloads]

  CONTRACTS -. governam .-> Pipeline
  LIMITS -. influenciam .-> SPLIT
```

## Responsabilidades

### Ingestão

- Ler CSVs exportados do Google Earth Engine via Google Drive

### Transformação

- Normalizar os dados
- Associar cada dataset a um panelLayerId

### Particionamento

- Dividir payloads grandes em partes menores

### Publicação

- Criar, atualizar e publicar entries municipalAnalysis

## Dependências

- Google Earth Engine
- Google Drive API
- Contentful GraphQL API
- Contentful Management API

## Limitações

- Dependência de convenções de nomes de arquivos
- Dependência de colunas específicas nos CSVs
- Limites de tamanho do Contentful
- Não cria ou gerencia assets panelLayer
