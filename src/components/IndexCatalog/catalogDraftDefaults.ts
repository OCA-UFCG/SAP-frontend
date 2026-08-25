import {
  INDEX_CATEGORIES,
  type IndexCatalogDraftInput,
} from "@/types/indexCatalog";

/** Nomes das colunas territoriais que a maioria das tabelas do projeto usa. */
export const STANDARD_PROPERTIES = {
  level: "NIVEL_AGRUPAMENTO",
  locationName: "NOME_LOCAL",
  municipalityCode: "CD_MUN",
  stateCode: "NM_UF",
  year: "ano",
  date: "data_img",
  totalArea: "area_total_ha",
};

export type StandardPropertyKey = keyof typeof STANDARD_PROPERTIES;

/**
 * Rótulos em português para as colunas territoriais. A chave técnica (`level`,
 * `stateCode`) não diz nada para quem conhece a tabela no GEE e não o nosso
 * contrato, então a tela mostra o rótulo e a chave fica no `title`.
 */
export const STANDARD_PROPERTY_LABELS: Record<StandardPropertyKey, string> = {
  level: "Nível do território",
  locationName: "Nome do território",
  municipalityCode: "Código do município",
  stateCode: "Unidade federativa",
  year: "Ano",
  date: "Data da imagem",
  totalArea: "Área total em hectares",
};

export const EMPTY_DRAFT: IndexCatalogDraftInput = {
  name: "",
  description: "",
  category: INDEX_CATEGORIES[0],
  statisticsSource: {
    kind: "gee-feature-collection",
    asset: { type: "fixed", assetId: "" },
    periodGranularity: "year",
    properties: STANDARD_PROPERTIES,
  },
  classes: [],
  earthEngine: {
    strategy: "single",
    sourceType: "image",
    singleAssetId: "",
  },
};

/**
 * Uma tabela (ou imagem) para tudo, ou uma por período. É a mesma pergunta nos
 * dois blocos do formulário, então é o mesmo tipo e o mesmo vocabulário.
 */
export type AssetLayout = "single" | "per-period";

/**
 * Como os pixels da imagem se transformam nas classes do índice. Não é um campo
 * novo do contrato: "value-ranges" é a presença de `thresholds` no
 * `mapVisualization`, que já valia para qualquer Image ou ImageCollection mas só
 * aparecia no formulário junto da previsão por emissão.
 */
export type MapClassificationMode = "pixel-codes" | "value-ranges";
