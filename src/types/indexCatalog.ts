import type {
  GeeFeatureCollectionStatisticsSource,
  PublishedGeeStatisticsSource,
} from "@/contracts/geeStatistics";
import type {
  MunicipalReportData,
  MunicipalReportDocsContent,
} from "@/contracts/municipalReport";
import type { PublishedPanelLayerReportConfig } from "@/contracts/panelLayerReport";
import type {
  CompactMapVisualizationConfig,
  CompactTerritorialAnalysisDataset,
} from "@/utils/analysis";

export const INDEX_CATEGORIES = [
  "Dados Climáticos",
  "Dados Ambientais",
  "Dados Socioeconômicos",
] as const;

export type IndexCategory = (typeof INDEX_CATEGORIES)[number];

export interface ClassMapping {
  /** Index from perc_classe_XX/area_ha_classe_XX. */
  classIndex: number;
  id: string;
  label: string;
  color: string;
  pixelValue?: number;
}

export type EarthEngineSourceType =
  "image" | "imageCollection" | "featureCollection";

export interface ForecastImageCollectionSelection {
  type: "latest-emission-leads";
  emissionProperty: string;
  leadProperty: string;
  targetDateProperty: string;
  leadValues: number[];
}

/** Map rendering is deliberately independent from the statistics table. */
export interface EarthEngineAssetMapping {
  strategy: "single" | "perPeriod";
  sourceType: EarthEngineSourceType;
  singleAssetId?: string;
  assetPattern?: string;
  assetsByPeriod?: Record<string, string>;
  band?: string;
  property?: string;
  thresholds?: number[];
  collectionSelection?: ForecastImageCollectionSelection;
}

export interface CatalogValidationIssue {
  code: string;
  message: string;
  assetId?: string;
  period?: string;
}

export interface CatalogValidationReport {
  validatedAt: string;
  valid: boolean;
  errors: CatalogValidationIssue[];
  warnings: CatalogValidationIssue[];
  inferred: {
    panelLayerId: string;
    periods: string[];
    defaultPeriod?: string;
    timeScale?: "Anual" | "Mensal";
    classIndexes: number[];
    statisticsAssetCount: number;
    imageDataBytes?: number;
  };
  sourceFingerprint: string;
}

export interface IndexCatalogDraftInput {
  name: string;
  description: string;
  category: IndexCategory;
  statisticsSource: GeeFeatureCollectionStatisticsSource;
  classes: ClassMapping[];
  earthEngine: EarthEngineAssetMapping;
}

interface IndexCatalogAuditData {
  panelLayerId: string;
  status: "draft" | "ready" | "error" | "published";
  createdBy: { uid: string; email: string | null; at: string };
  updatedBy: { uid: string; email: string | null; at: string };
  validation?: CatalogValidationReport;
  /**
   * Asset do Contentful com a imagem de prévia do mapa capturada na validação.
   * Guardamos o id para reaproveitar o mesmo asset em cada nova captura, em vez
   * de deixar um rastro de imagens órfãs no espaço.
   */
  previewMap?: { assetId: string; capturedAt: string };
  /**
   * Texto do Relatório Automático escrito no catálogo. Fica aqui, e não em
   * `IndexCatalogDraftInput`, porque não descreve os dados: mudar uma frase não
   * pode invalidar a prévia nem entrar no `sourceFingerprint` conferido na
   * publicação. É a mesma razão pela qual `previewMap` mora aqui.
   */
  report?: PublishedPanelLayerReportConfig;
  auditLog?: Array<{
    action:
      | "create"
      | "adopt"
      | "update"
      | "revalidate"
      | "preview"
      | "preview-map"
      | "report-text"
      | "publish"
      | "unpublish";
    outcome: "success" | "failure";
    uid: string;
    email: string | null;
    at: string;
    message?: string;
  }>;
}

/**
 * O que o catálogo gerencia numa entry.
 *
 * `full` é o índice que o próprio catálogo criou: os valores vivem numa
 * FeatureCollection do Earth Engine e o formulário controla estatísticas,
 * mapa, classes e períodos. `presentation` é um índice legado adotado: os
 * valores continuam vindo de onde já vinham — partições `municipalAnalysis`
 * escritas pela pipeline de CSV ou o registro estático de `geeStatisticsLayers`
 * — e o catálogo gerencia apenas o que mora na própria entry.
 *
 * A separação existe porque a trava antiga era do formulário, não dos dados:
 * nome, unidade, imagem de prévia e texto do relatório nunca dependeram do
 * Earth Engine, mas ficavam inacessíveis junto com a configuração de dados.
 */
export type IndexCatalogManagedScope = "full" | "presentation";

/** O que o escopo de apresentação deixa editar num índice legado. */
export interface IndexCatalogPresentationInput {
  name: string;
  description: string;
  category: IndexCategory;
  /**
   * Editável, e não fixada em `%` como no escopo completo: os legados usam
   * "classes", "%" e "registros", e sobrescrever a unidade trocaria o rótulo
   * do painel de análise em silêncio.
   */
  measurementUnit: string;
  panelPosition?: number;
}

export interface IndexCatalogConfigV2
  extends IndexCatalogDraftInput, IndexCatalogAuditData {
  schemaVersion: 2;
  /**
   * Ausente nas entries publicadas antes de o escopo existir; todas elas são
   * `full`, então a ausência é lida como `full`.
   */
  managedScope?: "full";
  /** Filled by validation and copied to panelLayer.statisticsSource. */
  validatedStatisticsSource?: PublishedGeeStatisticsSource;
}

/**
 * Índice legado adotado pelo catálogo.
 *
 * Não tem `statisticsSource`, `classes` nem `earthEngine` de propósito: gravar
 * qualquer um dos três mudaria a origem dos números do índice. Em especial,
 * gravar `panelLayer.statisticsSource` desliga o fallback do Contentful sem
 * volta (`municipalAnalysisRepository` relança o erro do GEE em vez de cair
 * para as partições), então a adoção nunca o escreve.
 */
export interface IndexCatalogPresentationConfigV2
  extends IndexCatalogPresentationInput, IndexCatalogAuditData {
  schemaVersion: 2;
  managedScope: "presentation";
  /** Como o índice estava quando foi adotado, para a auditoria da adoção. */
  adoptedFrom: {
    at: string;
    /** `1` quando o legado já tinha um `catalogConfig` v1 sobrescrito aqui. */
    previousSchemaVersion?: 1;
  };
}

export type ManagedIndexCatalogConfig =
  IndexCatalogConfigV2 | IndexCatalogPresentationConfigV2;

/** Only enough of v1 is retained to identify and display it safely. */
export interface LegacyIndexCatalogConfigV1 {
  schemaVersion: 1;
  panelLayerId: string;
  status: "draft" | "ready" | "error" | "published";
  name?: string;
  description?: string;
  category?: IndexCategory;
  updatedBy?: { uid?: string; email?: string | null; at?: string };
  validation?: unknown;
  [key: string]: unknown;
}

export type IndexCatalogConfig =
  ManagedIndexCatalogConfig | LegacyIndexCatalogConfigV1;

/**
 * Um índice que o catálogo criou, com dados no Earth Engine. É o único escopo
 * em que validação, prévia com fingerprint e remoção da entry fazem sentido.
 */
export function isFullyManagedCatalogConfig(
  config: IndexCatalogConfig | null | undefined,
): config is IndexCatalogConfigV2 {
  return config?.schemaVersion === 2 && config.managedScope !== "presentation";
}

/** Um índice legado adotado: só o que mora na entry é editável. */
export function isPresentationManagedCatalogConfig(
  config: IndexCatalogConfig | null | undefined,
): config is IndexCatalogPresentationConfigV2 {
  return config?.schemaVersion === 2 && config.managedScope === "presentation";
}

export function isManagedCatalogConfig(
  config: IndexCatalogConfig | null | undefined,
): config is ManagedIndexCatalogConfig {
  return config?.schemaVersion === 2;
}

export interface IndexCatalogItem {
  entryId: string;
  panelLayerId: string;
  name: string;
  description: string;
  category?: string;
  panelPosition?: number;
  published: boolean;
  /**
   * True depois da primeira publicação, mesmo que a entry esteja despublicada
   * agora. É o que congela o ID técnico do panelLayer.
   */
  everPublished: boolean;
  hasUnpublishedChanges: boolean;
  /** True para qualquer config v2, em escopo completo ou de apresentação. */
  catalogManaged: boolean;
  /** `null` enquanto a entry não foi adotada pelo catálogo. */
  managedScope: IndexCatalogManagedScope | null;
  /**
   * Unidade gravada no `panelLayer`. Vem na listagem porque o formulário de
   * apresentação a edita, e um formulário que abrisse com o campo vazio a
   * apagaria no primeiro salvamento.
   */
  measurementUnit?: string;
  /**
   * Um legado que o catálogo consegue adotar no escopo de apresentação. Falso
   * quando o `imageData` ainda está no formato pré-compacto: ali não há
   * `classes` nem `years` para o resto da tela ler.
   */
  adoptable: boolean;
  /** Por que a adoção não é oferecida, para a tela poder dizer ao operador. */
  adoptionBlockedReason?: string;
  status: "legacy" | IndexCatalogConfigV2["status"];
  catalogConfig?: IndexCatalogConfig;
}

export interface IndexCatalogLifecycleImpact {
  item: IndexCatalogItem;
  linkedEntries: [];
  counts: {
    panelLayer: 1;
    municipalAnalysis: 0;
    municipalReportSeries: 0;
    total: 1;
  };
}

export interface IndexCatalogPreview {
  entryId: string;
  panelLayer: {
    sys: { id: string };
    id: string;
    name: string;
    description: string;
    category: string;
    panelPosition?: number;
    previewMap?: { url: string } | null;
    imageData: CompactTerritorialAnalysisDataset;
    minScale?: number;
    maxScale?: number;
    timeScale?: string;
    /** Ausente na prévia de um legado adotado: os valores não vêm do GEE. */
    statisticsSource?: PublishedGeeStatisticsSource;
    tileApiPath: string;
    /**
     * Ausente na prévia de um legado adotado, e é a ausência que importa: sem
     * ela o painel de análise usa a rota de produção do índice, que é
     * justamente quem sabe ler as partições `municipalAnalysis`.
     */
    municipalAnalysisApiPath?: string;
  };
  validation: CatalogValidationReport;
}

/**
 * Prévia de um índice legado adotado no escopo de apresentação.
 *
 * Não tem `validation` nem `statisticsSource` porque não há assets a validar:
 * o mapa vem do `imageId` que já está publicado no `imageData` e os valores
 * continuam vindo de onde vinham. Serve para capturar a imagem do cartão e
 * conferir o texto do relatório antes de republicar.
 */
export interface IndexCatalogPresentationPreview {
  entryId: string;
  managedScope: "presentation";
  panelLayer: IndexCatalogPreview["panelLayer"];
  /** Período que o mapa da prévia desenha: o padrão do próprio `imageData`. */
  defaultPeriod: string;
}

export interface IndexCatalogBuildResult {
  panelLayerImageData: CompactTerritorialAnalysisDataset;
  validation: CatalogValidationReport;
  mapVisualization: CompactMapVisualizationConfig;
  statisticsSource: PublishedGeeStatisticsSource;
  classes: ClassMapping[];
}

/**
 * Como um índice em rascunho apareceria no Relatório Automático.
 *
 * Vive nos tipos, e não no serviço, porque a tela do catálogo consome a
 * resposta: o serviço é `server-only` e importar o tipo de lá acoplaria o
 * bundle do navegador a um módulo que não pode entrar nele.
 */
export interface IndexCatalogReportPreview {
  municipality: { code: string; name: string; uf: string };
  period: string;
  report: MunicipalReportData;
  /** As seções escritas no catálogo, já com as variáveis trocadas pelos dados. */
  docsContent: MunicipalReportDocsContent;
}
