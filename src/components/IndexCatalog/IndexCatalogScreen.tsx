"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { CatalogIndexSections } from "@/components/IndexCatalog/CatalogIndexSections";
import { CatalogMonitoringPreview } from "@/components/IndexCatalog/CatalogMonitoringPreview";
import {
  CatalogPreviewMapCapture,
  resolvePreviewMapPeriod,
} from "@/components/IndexCatalog/CatalogPreviewMapCapture";
import { LegacyIndexEditor } from "@/components/IndexCatalog/LegacyIndexEditor";
import { CatalogReportPreview } from "@/components/IndexCatalog/CatalogReportPreview";
import { ClassColorField } from "@/components/IndexCatalog/ClassColorField";
import { ClassificationMethodFields } from "@/components/IndexCatalog/ClassificationMethodFields";
import {
  catalogApiRequest as apiRequest,
  catalogIdempotencyKey as idempotencyKey,
  requestCatalogPreview as requestPreview,
  type CatalogApiErrorBody as ApiErrorBody,
} from "@/components/IndexCatalog/catalogApiClient";
import { IndexCatalogGuideModal } from "@/components/IndexCatalog/IndexCatalogGuideModal";
import { IndexCatalogReportFields } from "@/components/IndexCatalog/IndexCatalogReportFields";
import { PanelPositionField } from "@/components/IndexCatalog/PanelPositionField";
import { ImageCollectionForecastGuideModal } from "@/components/IndexCatalog/ImageCollectionForecastGuideModal";
import {
  detectYearPartitionedTemplate,
  fillYearPlaceholder,
  hasPublishableValidation,
  parseNumberList,
} from "@/utils/indexCatalog";
import { resizeValueRanges } from "@/utils/municipalValueIndicator";
import { buildValueLegendRanges } from "@/utils/spreadsheetLegendDetection";
import type { PublishedPanelLayerReportConfig } from "@/contracts/panelLayerReport";
import {
  createDefaultReportDraft,
  isStoredReportText,
  toReportDraft,
  toReportTextPayload,
  type IndexCatalogReportDraft,
} from "@/utils/indexCatalogReportDraft";
import {
  INDEX_CATEGORIES,
  isFullyManagedCatalogConfig,
  type ClassMapping,
  type EarthEngineAssetMapping,
  type IndexCatalogDraftInput,
  type IndexCatalogItem,
  type IndexCatalogLifecycleImpact,
  type IndexCatalogPreview,
  type MunicipalValueIndicator,
  type PublishedNewDataScan,
} from "@/types/indexCatalog";
import {
  MunicipalValueIndicatorFields,
  ValueRangeFields,
} from "@/components/IndexCatalog/MunicipalValueTableFields";
import { SpreadsheetSourceFields } from "@/components/IndexCatalog/SpreadsheetSourceFields";
import type { MunicipalSpreadsheetStatisticsSource } from "@/contracts/municipalSpreadsheet";
import { parseGoogleFileId } from "@/utils/municipalSpreadsheetLink";
import type { DetectedValueLegend } from "@/utils/spreadsheetLegendDetection";

/**
 * O id do arquivo enquanto o operador ainda está digitando o link: um link pela
 * metade não é erro, é um campo incompleto. A recusa de verdade acontece na
 * validação, que é onde o operador pediu ao catálogo para ler a planilha.
 */
function tryParseGoogleFileId(link: string) {
  try {
    return parseGoogleFileId(link);
  } catch {
    return "";
  }
}

const STANDARD_PROPERTIES = {
  level: "NIVEL_AGRUPAMENTO",
  locationName: "NOME_LOCAL",
  municipalityCode: "CD_MUN",
  stateCode: "NM_UF",
  year: "ano",
  date: "data_img",
  totalArea: "area_total_ha",
};

/**
 * Os nomes que as tabelas municipais reais usam. Vêm do recorte do IBGE que
 * quase todo mundo exporta junto com os dados socioeconômicos.
 */
const VALUE_TABLE_PROPERTIES = {
  municipalityCode: "CD_MUN",
  locationName: "NM_MUN",
  stateCode: "SIGLA_UF",
};

const VALUE_TABLE_PROPERTY_LABELS: Record<
  keyof typeof VALUE_TABLE_PROPERTIES,
  string
> = {
  municipalityCode: "Código do município (IBGE)",
  locationName: "Nome do município",
  stateCode: "UF do município",
};

const EMPTY_VALUE_INDICATOR: MunicipalValueIndicator = {
  label: "",
  color: "#BD0026",
  measurementUnit: "%",
  valueType: "percentage",
};

const EMPTY_DRAFT: IndexCatalogDraftInput = {
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
 * As duas formas de tabela que o catálogo publica.
 *
 * `classes` é a tabela multinível com `perc_classe_XX`. `value` é a tabela
 * municipal larga — uma linha por município, uma coluna por período —, que é
 * como chegam os dados socioeconômicos e em que a mesma FeatureCollection
 * costuma ser também o asset do mapa.
 */
type StatisticsShape = "classes" | "value" | "spreadsheet";

const STATISTICS_SHAPE_HINTS: Record<StatisticsShape, string> = {
  classes:
    "A tabela tem uma linha por território e por período, com as colunas perc_classe_XX e area_ha_classe_XX. O painel mostra quanto da área cabe em cada classe.",
  value:
    "A tabela tem uma linha por município e uma coluna por período, com um número só em cada célula. O painel mostra esse número, e Brasil e UFs saem da soma ou da média dos municípios.",
  spreadsheet:
    "Os dados estão numa planilha do Google, e não no Earth Engine. O catálogo lê a planilha, guarda os valores e o mapa é pintado sobre os municípios da plataforma. Serve para as bases que nunca viraram asset.",
};

const EMPTY_SPREADSHEET_SOURCE = {
  kind: "municipal-spreadsheet" as const,
  spreadsheetUrl: "",
  fileId: "",
  valuePrefix: "",
  aggregation: "sum" as const,
};

/**
 * "year-siblings" não é uma terceira forma de contrato: ela grava o mesmo
 * `period-template` com `{year}`. A diferença é só de formulário — o operador
 * cola o endereço de um ano concreto em vez de escrever o placeholder.
 */
type StatisticsAssetMode = "fixed" | "year-siblings" | "period-template";

const STATISTICS_ASSET_MODE_HINTS: Record<StatisticsAssetMode, string> = {
  fixed: "Uma única tabela reúne todos os períodos disponíveis.",
  "year-siblings":
    "Existe uma tabela por ano e cada uma guarda os meses daquele ano. Informe o endereço de um ano; o catálogo descobre os demais na mesma pasta.",
  "period-template":
    "Várias tabelas seguem o mesmo padrão de endereço, como uma tabela para cada ano ou mês.",
};

const STATISTICS_ASSET_FIELD_LABELS: Record<StatisticsAssetMode, string> = {
  fixed: "ID da FeatureCollection",
  "year-siblings": "ID da FeatureCollection de um dos anos",
  "period-template": "Template da FeatureCollection",
};

const STATISTICS_ASSET_PLACEHOLDERS: Record<StatisticsAssetMode, string> = {
  fixed: "projects/projeto/assets/estatisticas",
  "year-siblings": "projects/projeto/assets/estatisticas_2026",
  "period-template": "projects/projeto/assets/estatisticas_{year}",
};

/** As formas cujos valores vivem no Earth Engine, e por isso têm asset. */
type GeeDraftSource = Exclude<
  IndexCatalogDraftInput["statisticsSource"],
  MunicipalSpreadsheetStatisticsSource
>;

function inferStatisticsAssetMode(
  asset: GeeDraftSource["asset"],
): StatisticsAssetMode {
  if (asset.type === "fixed") return "fixed";
  const template = asset.assetIdTemplate;
  return template.includes("{year}") &&
    !template.includes("{month}") &&
    !template.includes("{period}")
    ? "year-siblings"
    : "period-template";
}

interface ValidationProgress {
  message: string;
  percent: number;
}

function advanceValidationProgress(current: ValidationProgress | null) {
  if (!current || current.percent >= 94) return current;
  const increment =
    current.percent < 40
      ? 5
      : current.percent < 70
        ? 3
        : current.percent < 88
          ? 2
          : 1;
  const percent = Math.min(94, current.percent + increment);
  const message =
    percent < 35
      ? "Conectando ao Google Earth Engine…"
      : percent < 65
        ? "Lendo períodos, classes e colunas da tabela…"
        : percent < 82
          ? "Conferindo se os dados territoriais estão completos…"
          : percent < 92
            ? "Conferindo os mapas de cada período…"
            : "Preparando a prévia para você conferir…";
  return { message, percent };
}

interface CatalogActionButtonProps {
  children: ReactNode;
  className: string;
  description: string;
  disabled: boolean;
  onClick: () => void;
}

function CatalogActionButton({
  children,
  className,
  description,
  disabled,
  onClick,
}: CatalogActionButtonProps) {
  const descriptionId = useId();

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className={className}
        disabled={disabled}
        aria-describedby={descriptionId}
        onClick={onClick}
      >
        {children}
      </button>
      <span
        id={descriptionId}
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-[calc(100%+0.5rem)] left-0 z-30 w-72 max-w-[calc(100vw-3rem)] rounded-md bg-stone-800 px-3 py-2 text-left text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {description}
      </span>
    </span>
  );
}

export function IndexCatalogScreen() {
  const [items, setItems] = useState<IndexCatalogItem[]>([]);
  const [newDataScan, setNewDataScan] = useState<PublishedNewDataScan | null>(
    null,
  );
  const [scanningNewData, setScanningNewData] = useState(true);
  const [draft, setDraft] = useState<IndexCatalogDraftInput>(EMPTY_DRAFT);
  const [report, setReport] = useState<IndexCatalogReportDraft>(
    createDefaultReportDraft,
  );
  const [statisticsAssetMode, setStatisticsAssetMode] =
    useState<StatisticsAssetMode>("fixed");
  const [yearSampleAssetId, setYearSampleAssetId] = useState("");
  const [entryId, setEntryId] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [forecastGuideOpen, setForecastGuideOpen] = useState(false);
  const [thresholdsInput, setThresholdsInput] = useState("");
  // A posição fica em texto porque o campo aceita vazio, que significa "onde
  // está" e não zero.
  const [panelPositionInput, setPanelPositionInput] = useState("");
  const [leadValuesInput, setLeadValuesInput] = useState("1, 2, 3, 4");
  const [preview, setPreview] = useState<IndexCatalogPreview | null>(null);
  /** Índice legado adotado em edição; o formulário v2 fica escondido enquanto ele existe. */
  const [legacyItem, setLegacyItem] = useState<IndexCatalogItem | null>(null);
  const [deleteImpact, setDeleteImpact] =
    useState<IndexCatalogLifecycleImpact | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>("load");
  const [validationProgress, setValidationProgress] =
    useState<ValidationProgress | null>(null);
  const entryIdRef = useRef<string | null>(null);
  const createKeyRef = useRef<string | null>(null);
  const previewKeyRef = useRef<string | null>(null);
  /**
   * O texto do relatório já gravado neste índice. Fica num ref, e não vem da
   * lista de itens, porque o `saveDraft` compara logo depois de criar a entry —
   * antes de a lista ser recarregada.
   */
  const storedReportRef = useRef<PublishedPanelLayerReportConfig | undefined>(
    undefined,
  );
  const validationRunRef = useRef(0);
  const validationCompletionTimerRef = useRef<number | null>(null);

  /**
   * Pede a verificação de todos os índices publicados de uma vez, que é o que
   * enche a seção "Publicados sem os dados mais recentes".
   *
   * Só vale a pena com a listagem em mãos: sem nenhum índice publicado criado
   * pelo catálogo não há o que verificar, e a varredura é a parte lenta da tela
   * (uma listagem de pasta do Earth Engine por índice).
   */
  const loadNewDataScan = useCallback((items: IndexCatalogItem[]) => {
    const scannable = items.some(
      (item) => item.published && item.managedScope === "full",
    );
    if (!scannable) {
      setNewDataScan(null);
      setScanningNewData(false);
      return;
    }
    setScanningNewData(true);
    apiRequest<PublishedNewDataScan>("/api/index-catalog/new-data")
      .then(setNewDataScan)
      .catch(() => setNewDataScan(null))
      .finally(() => setScanningNewData(false));
  }, []);

  const loadItems = useCallback(async () => {
    const result = await apiRequest<{ items: IndexCatalogItem[] }>(
      "/api/index-catalog",
    );
    setItems(result.items);
    // A varredura acompanha a listagem: publicar, despublicar ou revalidar um
    // índice muda quem está desatualizado, e a resposta do servidor é
    // memoizada, então repetir o pedido custa quase nada quando nada mudou.
    loadNewDataScan(result.items);
    return result.items;
  }, [loadNewDataScan]);

  useEffect(() => {
    let active = true;
    apiRequest<{ items: IndexCatalogItem[] }>("/api/index-catalog")
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        loadNewDataScan(result.items);
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : "Falha ao carregar.",
          );
        }
      })
      .finally(() => {
        if (active) setBusy(null);
      });
    return () => {
      active = false;
      if (validationCompletionTimerRef.current !== null) {
        window.clearTimeout(validationCompletionTimerRef.current);
      }
    };
  }, [loadNewDataScan]);

  const editingItem = entryId
    ? items.find((item) => item.entryId === entryId)
    : undefined;
  /**
   * Publicar exige uma prévia gerada agora — exceto num índice já publicado que
   * recebeu só texto do relatório ou uma imagem nova: essas escritas não mexem
   * na validação gravada, e é aqui, de dentro do editor, que quem as fez
   * procura o botão para levá-las ao ar.
   *
   * Um rascunho editado fica de fora porque o `PUT` do rascunho apaga a
   * validação: a rota recusaria a publicação, e o botão só levaria o operador
   * a um "Revalide os assets" depois do clique.
   */
  const canRepublish = Boolean(
    editingItem?.published &&
    editingItem.hasUnpublishedChanges &&
    hasPublishableValidation(editingItem.status),
  );
  const canPublishDraft = Boolean(preview) || canRepublish;

  function resetEditor() {
    setLegacyItem(null);
    setDraft(structuredClone(EMPTY_DRAFT));
    setReport(createDefaultReportDraft());
    setStatisticsAssetMode("fixed");
    setYearSampleAssetId("");
    setEntryId(null);
    entryIdRef.current = null;
    createKeyRef.current = null;
    previewKeyRef.current = null;
    storedReportRef.current = undefined;
    setPreview(null);
    setThresholdsInput("");
    setPanelPositionInput("");
    setLeadValuesInput("1, 2, 3, 4");
  }

  function openLegacyEditor(item: IndexCatalogItem) {
    resetEditor();
    setLegacyItem(item);
    setMessage(`“${item.name}” aberto para edição da apresentação.`);
  }

  function resumeDraft(item: IndexCatalogItem) {
    if (!isFullyManagedCatalogConfig(item.catalogConfig)) return;
    // O formulário do catálogo só é renderizado quando não há índice legado
    // aberto, então trocar de um índice adotado para um índice v2 sem fechar o
    // editor legado carregava o rascunho numa seção invisível: o clique em
    // "Abrir e editar" parecia não funcionar. É o simétrico do reset que
    // openLegacyEditor já faz no sentido contrário.
    setLegacyItem(null);
    const config = item.catalogConfig;
    setDraft({
      name: config.name,
      description: config.description,
      category: config.category,
      statisticsSource: config.statisticsSource,
      classes: config.classes,
      earthEngine: { ...config.earthEngine, assetsByPeriod: undefined },
      ...(config.valueIndicator
        ? { valueIndicator: config.valueIndicator }
        : {}),
    });
    // Um rascunho sem texto salvo recebe o padrão, e não campos vazios: é o
    // mesmo ponto de partida de um índice novo, inclusive para os que foram
    // criados antes de existir texto de relatório no catálogo.
    setReport(toReportDraft(config.report));
    storedReportRef.current = config.report;
    const openedGeeSource =
      config.statisticsSource.kind === "municipal-spreadsheet"
        ? null
        : config.statisticsSource;
    const assetMode = openedGeeSource
      ? inferStatisticsAssetMode(openedGeeSource.asset)
      : "fixed";
    setStatisticsAssetMode(assetMode);
    // Reexibe o ano que o operador digitou, e não o placeholder gravado.
    setYearSampleAssetId(
      assetMode === "year-siblings" &&
        openedGeeSource?.asset.type === "period-template"
        ? fillYearPlaceholder(
            openedGeeSource.asset.assetIdTemplate,
            config.validation?.inferred.periods.at(-1)?.slice(0, 4),
          )
        : "",
    );
    setEntryId(item.entryId);
    entryIdRef.current = item.entryId;
    createKeyRef.current = null;
    previewKeyRef.current = null;
    setPreview(null);
    setThresholdsInput(config.earthEngine.thresholds?.join(", ") ?? "");
    setPanelPositionInput(
      item.panelPosition === undefined ? "" : String(item.panelPosition),
    );
    setLeadValuesInput(
      config.earthEngine.collectionSelection?.leadValues.join(", ") ??
        "1, 2, 3, 4",
    );
    setMessage(`“${item.name}” aberto para edição.`);
  }

  function updateDraft<K extends keyof IndexCatalogDraftInput>(
    key: K,
    value: IndexCatalogDraftInput[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setPreview(null);
  }

  function updateStatisticsAsset(values: Partial<GeeDraftSource["asset"]>) {
    setDraft((current) => ({
      ...current,
      statisticsSource:
        current.statisticsSource.kind === "municipal-spreadsheet"
          ? current.statisticsSource
          : {
              ...current.statisticsSource,
              asset: {
                ...current.statisticsSource.asset,
                ...values,
              } as GeeDraftSource["asset"],
            },
    }));
    setPreview(null);
  }

  function changeStatisticsAssetMode(mode: StatisticsAssetMode) {
    setStatisticsAssetMode(mode);
    setYearSampleAssetId("");
    updateStatisticsAsset(
      mode === "fixed"
        ? { type: "fixed", assetId: "" }
        : { type: "period-template", assetIdTemplate: "" },
    );
  }

  function changeStatisticsAssetId(value: string) {
    if (statisticsAssetMode !== "year-siblings") {
      updateStatisticsAsset(
        statisticsAssetMode === "fixed"
          ? { type: "fixed", assetId: value }
          : { type: "period-template", assetIdTemplate: value },
      );
      return;
    }
    // O contrato só entende o template; o ano digitado fica só na tela.
    setYearSampleAssetId(value);
    updateStatisticsAsset({
      type: "period-template",
      assetIdTemplate:
        detectYearPartitionedTemplate(value)?.assetIdTemplate ?? value.trim(),
    });
  }

  function updateStatisticsProperty(key: string, value: string) {
    setDraft((current) => ({
      ...current,
      statisticsSource:
        current.statisticsSource.kind === "municipal-spreadsheet"
          ? current.statisticsSource
          : ({
              ...current.statisticsSource,
              properties: {
                ...current.statisticsSource.properties,
                [key]: value,
              },
            } as IndexCatalogDraftInput["statisticsSource"]),
    }));
    setPreview(null);
  }

  function updateValueTableSource(
    values: Partial<
      Pick<
        Extract<
          IndexCatalogDraftInput["statisticsSource"],
          { kind: "gee-municipal-value-table" }
        >,
        "valueProperty" | "aggregation"
      >
    >,
  ) {
    setDraft((current) => ({
      ...current,
      statisticsSource: {
        ...current.statisticsSource,
        ...values,
      } as IndexCatalogDraftInput["statisticsSource"],
    }));
    setPreview(null);
  }

  function updateSpreadsheetSource(
    values: Partial<MunicipalSpreadsheetStatisticsSource>,
  ) {
    setDraft((current) => ({
      ...current,
      statisticsSource: {
        ...current.statisticsSource,
        ...values,
        // O id é derivado do link, e não digitado: é ele que a leitura usa, e
        // pedir os dois ao operador seria pedir a mesma coisa duas vezes.
        ...(values.spreadsheetUrl !== undefined
          ? { fileId: tryParseGoogleFileId(values.spreadsheetUrl) }
          : {}),
      } as IndexCatalogDraftInput["statisticsSource"],
    }));
    setPreview(null);
  }

  function updateValueIndicator(values: Partial<MunicipalValueIndicator>) {
    setDraft((current) => ({
      ...current,
      valueIndicator: {
        ...(current.valueIndicator ?? EMPTY_VALUE_INDICATOR),
        ...values,
      },
    }));
    setPreview(null);
  }

  /**
   * Trocar a forma da tabela troca o contrato inteiro da fonte: as propriedades
   * territoriais, o eixo de período e o significado das cores mudam juntos. Por
   * isso o rascunho recomeça a fonte em vez de tentar aproveitar o que estava
   * preenchido, que produziria uma configuração meio de cada.
   */
  function changeStatisticsShape(shape: StatisticsShape) {
    setStatisticsAssetMode("fixed");
    setYearSampleAssetId("");
    setThresholdsInput("");
    setDraft((current) => ({
      ...current,
      classes: [],
      statisticsSource:
        shape === "spreadsheet"
          ? EMPTY_SPREADSHEET_SOURCE
          : shape === "value"
            ? {
                kind: "gee-municipal-value-table",
                asset: { type: "fixed", assetId: "" },
                periodGranularity: "year",
                valueProperty: "{year}",
                aggregation: "mean",
                properties: VALUE_TABLE_PROPERTIES,
              }
            : {
                kind: "gee-feature-collection",
                asset: { type: "fixed", assetId: "" },
                periodGranularity: "year",
                properties: STANDARD_PROPERTIES,
              },
      // O mapa desta forma é sempre a própria FeatureCollection, e a validação
      // recusa qualquer outro tipo. Deixar o formulário no padrão "Image" só
      // renderia um erro no fim de uma validação inteira.
      ...(shape === "spreadsheet"
        ? {
            // Uma planilha não tem asset: o mapa é a coropleta municipal, e
            // deixar o formulário em "Image" só renderia um erro no fim de
            // uma validação inteira.
            earthEngine: {
              ...current.earthEngine,
              sourceType: "municipalChoropleth" as const,
              strategy: "single" as const,
              singleAssetId: undefined,
              assetPattern: undefined,
              collectionSelection: undefined,
            },
            valueIndicator: current.valueIndicator ?? EMPTY_VALUE_INDICATOR,
          }
        : shape === "value"
          ? {
              earthEngine: {
                ...current.earthEngine,
                sourceType: "featureCollection" as const,
              },
              valueIndicator: current.valueIndicator ?? EMPTY_VALUE_INDICATOR,
            }
          : { valueIndicator: undefined }),
    }));
    setPreview(null);
  }

  function updateMap(values: Partial<EarthEngineAssetMapping>) {
    setDraft((current) => ({
      ...current,
      earthEngine: { ...current.earthEngine, ...values },
    }));
    setPreview(null);
  }

  function updateClass(index: number, values: Partial<ClassMapping>) {
    setDraft((current) => ({
      ...current,
      classes: current.classes.map((entry, position) =>
        position === index ? { ...entry, ...values } : entry,
      ),
    }));
    setPreview(null);
  }

  /**
   * Preenche as faixas de cor a partir dos valores da própria planilha.
   *
   * Substitui limites, rótulos e cores de uma vez, e diz na mensagem o que
   * usou — período, quantos municípios e qual corte —, porque quem revisa a
   * legenda precisa saber de onde vieram os números antes de aceitá-los. O
   * resultado é rascunho de formulário: nada é gravado até salvar ou validar.
   */
  async function detectSpreadsheetRanges() {
    const source = spreadsheetSource;
    if (!source?.fileId || !source.valuePrefix.trim()) {
      setError(
        "Cole o link da planilha e escreva o prefixo das colunas de dado antes de detectar as faixas.",
      );
      return;
    }
    setBusy("detect-ranges");
    setError("");
    setMessage("");
    try {
      const legend = await apiRequest<
        DetectedValueLegend & { periodKey: string }
      >("/api/index-catalog/spreadsheet-legend", {
        method: "POST",
        body: JSON.stringify({
          source,
          indicator: draft.valueIndicator ?? EMPTY_VALUE_INDICATOR,
        }),
      });
      setThresholdsInput(legend.thresholds.join(", "));
      updateDraft("classes", legend.ranges);
      setMessage(
        `${legend.rangeCount} faixas detectadas em ${legend.periodKey}, a partir de ${legend.sampleCount.toLocaleString("pt-BR")} municípios com valor. ${
          legend.method === "quantile"
            ? "Cada cor ficou com mais ou menos o mesmo número de municípios."
            : "Os valores se repetem demais para dividir por quantidade de municípios, então o intervalo foi cortado em partes iguais."
        } Ajuste o que quiser e valide para ver no mapa.`,
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao detectar as faixas da planilha.",
      );
    } finally {
      setBusy(null);
    }
  }

  const statisticsShape: StatisticsShape =
    draft.statisticsSource.kind === "municipal-spreadsheet"
      ? "spreadsheet"
      : draft.statisticsSource.kind === "gee-municipal-value-table"
        ? "value"
        : "classes";
  const isValueTable = statisticsShape === "value";
  const isSpreadsheet = statisticsShape === "spreadsheet";
  /** O painel mostra um número por território nas duas formas de valor único. */
  const hasValueIndicator = isValueTable || isSpreadsheet;
  /**
   * Os períodos que o método de classificação pode ler. Saem da validação
   * porque é ela que descobre quais períodos a tabela tem; antes dela não há o
   * que ler, e o campo aparece com a lista vazia.
   */
  const classificationPeriods =
    preview?.validation.inferred.periods ??
    (editingItem?.catalogConfig?.schemaVersion === 2
      ? (editingItem.catalogConfig.validation?.inferred.periods ?? [])
      : []);

  /**
   * Escreve os limites calculados no mesmo campo que o operador digitaria.
   *
   * Num índice de valor único a quantidade de faixas é dele, então o método
   * pode acrescentar ou remover faixas; num índice classificatório ela vem das
   * colunas da tabela, e a própria tela já impede aplicar um método que mudaria
   * esse número.
   */
  function applyClassificationBreaks(thresholds: number[], classCount: number) {
    setThresholdsInput(thresholds.join(", "));
    if (!hasValueIndicator) return;
    // Num índice de valor único as faixas são da legenda do mapa, então os
    // limites novos trazem consigo rótulos e cores — pelos mesmos rótulos que
    // "Detectar faixas da planilha" escreve, para as duas entradas não
    // produzirem legendas com convenções diferentes.
    updateDraft(
      "classes",
      draft.valueIndicator
        ? buildValueLegendRanges(thresholds, draft.valueIndicator)
        : resizeValueRanges(draft.classes, classCount),
    );
  }

  const spreadsheetSource =
    draft.statisticsSource.kind === "municipal-spreadsheet"
      ? draft.statisticsSource
      : null;
  // Fora da planilha, a fonte é sempre uma FeatureCollection do Earth Engine;
  // renderizar por esta variável é o que estreita o tipo nos campos de asset.
  const geeSource =
    draft.statisticsSource.kind === "municipal-spreadsheet"
      ? null
      : draft.statisticsSource;
  const valueTableSource =
    draft.statisticsSource.kind === "gee-municipal-value-table"
      ? draft.statisticsSource
      : null;
  // As duas formas de fonte têm conjuntos diferentes de propriedades
  // territoriais, e o formulário renderiza a lista que a forma escolhida usa.
  function statisticsPropertyValue(key: string) {
    const properties: Record<string, unknown> = { ...geeSource?.properties };
    const value = properties[key];
    return typeof value === "string" ? value : "";
  }
  const statisticsPropertyFields = isValueTable
    ? (
        Object.keys(VALUE_TABLE_PROPERTIES) as Array<
          keyof typeof VALUE_TABLE_PROPERTIES
        >
      ).map((key) => ({ key, label: VALUE_TABLE_PROPERTY_LABELS[key] }))
    : (
        Object.keys(STANDARD_PROPERTIES) as Array<
          keyof typeof STANDARD_PROPERTIES
        >
      ).map((key) => ({ key, label: key }));

  function normalizedDraft() {
    const collectionSelection = draft.earthEngine.collectionSelection;
    return {
      ...draft,
      panelPosition:
        panelPositionInput.trim() === ""
          ? undefined
          : Number(panelPositionInput),
      earthEngine: {
        ...draft.earthEngine,
        assetsByPeriod: undefined,
        thresholds: thresholdsInput.trim()
          ? parseNumberList(thresholdsInput, "Limites das classes")
          : undefined,
        ...(collectionSelection
          ? {
              collectionSelection: {
                ...collectionSelection,
                leadValues: parseNumberList(
                  leadValuesInput,
                  "Horizontes",
                  true,
                ),
              },
            }
          : { collectionSelection: undefined }),
      },
    };
  }

  async function saveDraft(options: { withinValidation?: boolean } = {}) {
    const withinValidation = options.withinValidation === true;
    if (!withinValidation) {
      setBusy("save");
      setValidationProgress(null);
    }
    setError("");
    setMessage("");
    try {
      const input = normalizedDraft();
      const currentEntryId = entryIdRef.current;
      const result = currentEntryId
        ? await apiRequest<{ entryId: string }>(
            `/api/index-catalog/drafts/${encodeURIComponent(currentEntryId)}`,
            { method: "PUT", body: JSON.stringify(input) },
          )
        : await apiRequest<{ entryId: string }>("/api/index-catalog", {
            method: "POST",
            headers: {
              "Idempotency-Key": (createKeyRef.current ??= idempotencyKey(
                "create",
                "draft",
              )),
            },
            body: JSON.stringify(input),
          });
      entryIdRef.current = result.entryId;
      setEntryId(result.entryId);
      setDraft(input);
      // O texto do relatório vai junto. Ele tem rota própria porque um ajuste de
      // frase não deve refazer a validação, mas quem clica "Salvar rascunho" — ou
      // "Validar assets e gerar prévia", que passa por aqui — espera que o que
      // está na tela seja gravado. Sem isto o texto ficava só no navegador e a
      // prévia do relatório mostrava a frase automática.
      await writeReportText(result.entryId);
      if (!withinValidation) {
        setMessage("Rascunho salvo no sistema. Nada foi publicado.");
      }
      await loadItems();
      return result.entryId;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao salvar o rascunho.",
      );
      return null;
    } finally {
      if (!withinValidation) setBusy(null);
    }
  }

  /**
   * Grava o texto do relatório pela rota própria, que não zera a validação.
   *
   * Devolve `null` quando não havia nada a gravar, para o chamador saber que
   * nenhuma requisição foi feita. Uma escrita à toa custaria uma ida ao
   * Contentful e um evento na trilha de auditoria em cada salvamento.
   */
  async function writeReportText(currentEntryId: string) {
    const payload = toReportTextPayload(report);
    if (isStoredReportText(payload, storedReportRef.current)) return null;
    const result = await apiRequest<{ requiresRepublish: boolean }>(
      `/api/index-catalog/drafts/${encodeURIComponent(currentEntryId)}/report-text`,
      {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey("report-text", currentEntryId),
        },
        body: JSON.stringify({ report: payload }),
      },
    );
    storedReportRef.current = payload;
    return result;
  }

  /**
   * O botão dedicado da seção: grava só o texto, sem passar pelo `PUT` do
   * rascunho, que zeraria a validação e obrigaria uma nova conferência de todos
   * os assets no Earth Engine só para corrigir uma frase.
   */
  async function saveReportText() {
    const currentEntryId = entryIdRef.current;
    if (!currentEntryId) {
      setError("Salve o rascunho antes de escrever os textos do relatório.");
      return;
    }
    setBusy("report-text");
    setError("");
    setMessage("");
    try {
      const result = await writeReportText(currentEntryId);
      setMessage(
        result?.requiresRepublish
          ? "Textos salvos. Publique o índice de novo para que eles apareçam no relatório."
          : "Textos do relatório salvos.",
      );
      await loadItems();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao salvar os textos do relatório.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function validateAndPreview() {
    const runId = ++validationRunRef.current;
    if (validationCompletionTimerRef.current !== null) {
      window.clearTimeout(validationCompletionTimerRef.current);
      validationCompletionTimerRef.current = null;
    }
    setBusy("preview");
    setError("");
    setMessage("");
    setValidationProgress({
      percent: 5,
      message: "Guardando o preenchimento como rascunho no sistema…",
    });
    const savedEntryId = await saveDraft({ withinValidation: true });
    if (!savedEntryId) {
      setValidationProgress(null);
      setBusy(null);
      return;
    }
    setValidationProgress({
      percent: 20,
      message: "Rascunho guardado. Conectando ao Google Earth Engine…",
    });
    const progressTimer = window.setInterval(() => {
      setValidationProgress(advanceValidationProgress);
    }, 2_500);
    // A mesma chave é reenviada enquanto a validação não der certo. O servidor
    // deduplica por ela (runCatalogIdempotently), então clicar de novo depois de
    // um "Failed to fetch" espera a validação que já está rodando em vez de
    // disparar uma segunda em paralelo, competindo pela mesma cota do GEE.
    const previewKey = (previewKeyRef.current ??= idempotencyKey(
      "preview",
      savedEntryId,
    ));
    try {
      const result = await requestPreview(savedEntryId, previewKey);
      previewKeyRef.current = null;
      setPreview(result);
      const indexes = result.validation.inferred.classIndexes;
      setDraft((current) => ({
        ...current,
        // Nas formas de valor único — a tabela do GEE e a planilha — as faixas
        // foram escritas à mão e a camada tem uma classe só; reler as classes
        // da prévia apagaria a legenda do mapa que o operador acabou de montar.
        classes:
          current.statisticsSource.kind === "gee-municipal-value-table" ||
          current.statisticsSource.kind === "municipal-spreadsheet"
            ? current.classes
            : result.panelLayer.imageData.classes.map((entry, position) => ({
                classIndex: indexes[position],
                id: entry.id,
                label: entry.label,
                color: entry.color,
                pixelValue: entry.pixelLimit ?? indexes[position],
              })),
      }));
      setMessage(
        "Assets validados. A prévia usa o GEE diretamente e continua privada.",
      );
      setValidationProgress({
        percent: 100,
        message: "Validação concluída. A prévia privada está pronta.",
      });
      validationCompletionTimerRef.current = window.setTimeout(() => {
        if (validationRunRef.current === runId) setValidationProgress(null);
        validationCompletionTimerRef.current = null;
      }, 1_500);
      await loadItems();
    } catch (reason) {
      const validation = (reason as ApiErrorBody).validation;
      setPreview(null);
      setError(
        [
          reason instanceof Error ? reason.message : "Falha na validação.",
          ...(validation?.errors.map((issue) => issue.message) ?? []),
        ]
          .filter(
            (message, index, messages) => messages.indexOf(message) === index,
          )
          .join(" "),
      );
      setMessage("");
      setValidationProgress(null);
      await loadItems().catch(() => undefined);
    } finally {
      window.clearInterval(progressTimer);
      setBusy(null);
    }
  }

  async function publishDraft() {
    if (!entryId || !canPublishDraft) return;
    const publishedEntryId = entryId;
    setBusy("publish");
    setMessage("Fazendo a conferência final e publicando o índice…");
    try {
      await apiRequest(
        `/api/index-catalog/drafts/${encodeURIComponent(publishedEntryId)}/publish`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": idempotencyKey("publish", publishedEntryId),
          },
        },
      );
      resetEditor();
      // A lista recarregada vem do Contentful, então é ela — e não a resposta
      // da publicação — que diz se o índice está de fato no Monitoramento.
      const publishedItem = (await loadItems()).find(
        (item) => item.entryId === publishedEntryId,
      );
      if (publishedItem && !publishedItem.published) {
        setMessage("");
        setError(
          "A publicação não ficou registrada no Contentful: o índice continua como rascunho e não vai aparecer no Monitoramento. Tente publicar novamente.",
        );
        return;
      }
      setMessage(
        "Índice publicado no Monitoramento. As estatísticas continuam sendo lidas do asset no GEE a cada consulta — nada foi copiado para o Contentful.",
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao publicar.");
      setMessage("");
    } finally {
      setBusy(null);
    }
  }

  /**
   * A ação vem de quem clicou, e não do estado do item: um índice publicado
   * agora tem dois botões — "Republicar", para levar ao ar o que está no
   * rascunho, e "Despublicar" —, e deduzir a ação de `item.published` faria o
   * primeiro tirar o índice do Monitoramento.
   */
  async function changePublication(
    item: IndexCatalogItem,
    action: "publish" | "unpublish",
  ) {
    setBusy(`lifecycle-${item.entryId}`);
    try {
      const result = await apiRequest<{ positionNote?: string }>(
        `/api/index-catalog/entries/${encodeURIComponent(item.entryId)}`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": idempotencyKey(action, item.entryId),
          },
          body: JSON.stringify({ action }),
        },
      );
      // A troca de posição mexe em outro índice, então ela tem de aparecer na
      // tela: sem isso o operador não saberia para onde foi o índice que estava
      // no lugar pedido.
      setMessage(
        [
          action === "unpublish"
            ? `“${item.name}” foi despublicado.`
            : `“${item.name}” foi publicado.`,
          result.positionNote,
        ]
          .filter(Boolean)
          .join(" "),
      );
      await loadItems();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha no ciclo de vida.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function reviewDeletion(item: IndexCatalogItem) {
    setBusy(`delete-${item.entryId}`);
    try {
      setDeleteImpact(
        await apiRequest<IndexCatalogLifecycleImpact>(
          `/api/index-catalog/entries/${encodeURIComponent(item.entryId)}`,
        ),
      );
      setDeleteConfirmation("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao revisar.");
    } finally {
      setBusy(null);
    }
  }

  async function removeIndex() {
    if (!deleteImpact) return;
    setBusy("delete");
    try {
      await apiRequest(
        `/api/index-catalog/entries/${encodeURIComponent(
          deleteImpact.item.entryId,
        )}`,
        {
          method: "DELETE",
          headers: {
            "Idempotency-Key": idempotencyKey(
              "delete",
              deleteImpact.item.entryId,
            ),
          },
          body: JSON.stringify({ confirmation: deleteConfirmation }),
        },
      );
      setDeleteImpact(null);
      setMessage("O panelLayer foi removido. Nenhum asset GEE foi alterado.");
      resetEditor();
      await loadItems();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao remover.");
    } finally {
      setBusy(null);
    }
  }

  const detectedYearPartition =
    statisticsAssetMode === "year-siblings"
      ? detectYearPartitionedTemplate(yearSampleAssetId)
      : null;
  const inputClass =
    "mt-1 w-full rounded-md border border-[#CFD0CA] bg-white px-3 py-2 text-sm outline-none focus:border-[#989F43] focus:ring-2 focus:ring-[#E1E2B4]";
  const buttonClass =
    "cursor-pointer rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-6 bg-[#F6F7F3] p-6 text-[#292829]">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Catálogo de índices via GEE</h1>
          <p className="mt-1 max-w-3xl text-sm text-stone-600">
            O catálogo publica configuração e aparência. Os valores territoriais
            permanecem nas FeatureCollections do Earth Engine.
          </p>
        </div>
        <button
          type="button"
          className={`${buttonClass} border border-[#989F43] bg-white text-[#62672D]`}
          onClick={() => setGuideOpen(true)}
        >
          GUIA
        </button>
      </header>

      {error && (
        <div
          className="fixed right-6 top-6 z-[100] max-w-xl rounded-lg border border-red-300 bg-red-50 p-4 shadow-xl"
          role="alert"
        >
          <button
            className="float-right cursor-pointer font-bold"
            type="button"
            aria-label="Fechar notificação de erro"
            onClick={() => setError("")}
          >
            ×
          </button>
          <p className="pr-6 text-sm text-red-900">{error}</p>
        </div>
      )}
      {message && (
        <p className="rounded-md border border-[#D6D89A] bg-[#F4F5D8] p-3 text-sm">
          {message}
        </p>
      )}

      <CatalogIndexSections
        items={items}
        loading={busy === "load"}
        newDataChecks={newDataScan?.checks ?? {}}
        scanningNewData={scanningNewData}
        newDataFailures={newDataScan?.failed ?? 0}
        inputClass={inputClass}
        buttonClass={buttonClass}
        onOpenLegacyEditor={openLegacyEditor}
        onResumeDraft={resumeDraft}
        onChangePublication={(item, action) =>
          void changePublication(item, action)
        }
        onReviewDeletion={(item) => void reviewDeletion(item)}
      />

      {legacyItem && (
        <LegacyIndexEditor
          item={legacyItem}
          items={items}
          inputClass={inputClass}
          buttonClass={buttonClass}
          onChanged={() => void loadItems()}
          onClose={() => setLegacyItem(null)}
        />
      )}

      {!legacyItem && (
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="text-lg font-bold">
            {entryId ? "Editar índice" : "Cadastrar índice"}
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">
              Nome
              <input
                className={inputClass}
                value={draft.name}
                onChange={(event) => updateDraft("name", event.target.value)}
              />
              {editingItem && (
                <span className="mt-1 block text-xs font-normal text-stone-600">
                  ID técnico: <code>{editingItem.panelLayerId}</code> —{" "}
                  {editingItem.everPublished
                    ? "congelado: o índice já foi publicado e telemetria, relatórios e caches usam esse ID como chave."
                    : "gerado a partir do nome; acompanha o nome até a primeira publicação."}
                </span>
              )}
            </label>
            <label className="text-sm font-medium">
              Categoria
              <select
                className={inputClass}
                value={draft.category}
                onChange={(event) =>
                  updateDraft(
                    "category",
                    event.target.value as IndexCatalogDraftInput["category"],
                  )
                }
              >
                {INDEX_CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <PanelPositionField
              value={panelPositionInput}
              onChange={(value) => {
                setPanelPositionInput(value);
                setPreview(null);
              }}
              items={items}
              entryId={entryId}
              category={draft.category}
              inputClass={inputClass}
            />
            <label className="text-sm font-medium md:col-span-2">
              Descrição
              <textarea
                className={inputClass}
                rows={3}
                value={draft.description}
                onChange={(event) =>
                  updateDraft("description", event.target.value)
                }
              />
            </label>
          </div>

          <fieldset className="mt-7 rounded-lg border border-stone-200 p-4">
            <legend className="px-2 font-bold">Fonte das estatísticas</legend>
            <p className="text-xs text-stone-500">
              {isSpreadsheet
                ? "Os períodos são inferidos das colunas da planilha que terminam em _{ano}."
                : "Obrigatoriamente FeatureCollection. Períodos são inferidos da própria tabela."}
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-medium md:col-span-2">
                Forma da tabela
                <select
                  className={inputClass}
                  value={statisticsShape}
                  onChange={(event) =>
                    changeStatisticsShape(event.target.value as StatisticsShape)
                  }
                >
                  <option value="classes">
                    Distribuição por classes (perc_classe_XX)
                  </option>
                  <option value="value">
                    Valor único por município (uma coluna por período)
                  </option>
                  <option value="spreadsheet">
                    Planilha do Google (link da planilha)
                  </option>
                </select>
                <span className="mt-1 block text-xs font-normal text-stone-500">
                  {STATISTICS_SHAPE_HINTS[statisticsShape]}
                </span>
              </label>
              {geeSource && (
                <>
                  <label className="text-sm font-medium">
                    Organização dos assets
                    <select
                      className={inputClass}
                      value={statisticsAssetMode}
                      onChange={(event) =>
                        changeStatisticsAssetMode(
                          event.target.value as StatisticsAssetMode,
                        )
                      }
                    >
                      <option value="fixed">FeatureCollection única</option>
                      <option value="year-siblings">
                        Uma tabela por ano (detectar os anos)
                      </option>
                      <option value="period-template">
                        Template por período
                      </option>
                    </select>
                    <span className="mt-1 block text-xs font-normal text-stone-500">
                      {STATISTICS_ASSET_MODE_HINTS[statisticsAssetMode]}
                    </span>
                  </label>
                  <label className="text-sm font-medium">
                    Granularidade
                    <select
                      className={inputClass}
                      value={geeSource.periodGranularity}
                      onChange={(event) =>
                        updateDraft("statisticsSource", {
                          ...geeSource,
                          periodGranularity: event.target.value as
                            "year" | "month",
                        })
                      }
                    >
                      <option value="year">Anual</option>
                      <option value="month">Mensal</option>
                    </select>
                    <span className="mt-1 block text-xs font-normal text-stone-500">
                      Anual gera períodos como 2026; Mensal gera 2026-09.
                      Precisa bater com os períodos da tabela.
                    </span>
                  </label>
                  <label className="text-sm font-medium md:col-span-2">
                    {STATISTICS_ASSET_FIELD_LABELS[statisticsAssetMode]}
                    <input
                      className={inputClass}
                      placeholder={
                        STATISTICS_ASSET_PLACEHOLDERS[statisticsAssetMode]
                      }
                      value={
                        statisticsAssetMode === "year-siblings"
                          ? yearSampleAssetId
                          : geeSource.asset.type === "fixed"
                            ? geeSource.asset.assetId
                            : geeSource.asset.assetIdTemplate
                      }
                      onChange={(event) =>
                        changeStatisticsAssetId(event.target.value)
                      }
                    />
                    <span className="mt-1 block text-xs font-normal text-stone-500">
                      {statisticsAssetMode === "period-template"
                        ? "Templates aceitam {year}, {month} e {period}."
                        : statisticsAssetMode === "fixed"
                          ? "Endereço exato da tabela, que precisa conter todos os períodos."
                          : "Cole o endereço completo de um dos anos; o ano no fim do nome vira a chave de busca."}
                    </span>
                    {statisticsAssetMode === "year-siblings" &&
                      yearSampleAssetId.trim() !== "" && (
                        <span
                          className={`mt-2 block rounded-md px-3 py-2 text-xs font-normal ${
                            detectedYearPartition
                              ? "bg-[#F4F5D8] text-[#4B4E15]"
                              : "bg-amber-50 text-amber-800"
                          }`}
                        >
                          {detectedYearPartition
                            ? `Ano ${detectedYearPartition.year} detectado. O catálogo vai procurar ${detectedYearPartition.assetIdTemplate} no mesmo diretório e reunir todos os anos encontrados. Cada tabela pode guardar vários meses: escolha "Mensal" na granularidade para que os períodos venham de data_img.`
                            : "Não encontramos um ano de 4 dígitos neste endereço. Inclua o ano (por exemplo, ..._2026) ou use “Template por período”."}
                        </span>
                      )}
                  </label>
                </>
              )}
            </div>
            {spreadsheetSource && (
              <SpreadsheetSourceFields
                source={spreadsheetSource}
                inputClass={inputClass}
                onChange={updateSpreadsheetSource}
              />
            )}
            {isValueTable && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium">
                  Coluna do valor
                  <input
                    className={inputClass}
                    placeholder="{year}"
                    value={valueTableSource?.valueProperty ?? ""}
                    onChange={(event) =>
                      updateValueTableSource({
                        valueProperty: event.target.value,
                      })
                    }
                  />
                  <span className="mt-1 block text-xs font-normal text-stone-500">
                    Numa tabela cujas colunas são os anos (2004, 2005, …),
                    escreva {"{year}"}. O catálogo lê a tabela, encontra todas
                    as colunas que casam e transforma cada uma num período.
                  </span>
                </label>
                <label className="text-sm font-medium">
                  Como somar os municípios
                  <select
                    className={inputClass}
                    value={valueTableSource?.aggregation ?? "mean"}
                    onChange={(event) =>
                      updateValueTableSource({
                        aggregation: event.target.value as "sum" | "mean",
                      })
                    }
                  >
                    <option value="mean">
                      Média dos municípios (percentuais, índices)
                    </option>
                    <option value="sum">
                      Soma dos municípios (contagens, totais)
                    </option>
                  </select>
                  <span className="mt-1 block text-xs font-normal text-stone-500">
                    A tabela só tem municípios; o valor de cada UF e o do Brasil
                    saem daqui. Recortes de região, bioma, ASD e semiárido ficam
                    sem valor nesta forma.
                  </span>
                </label>
              </div>
            )}
            {geeSource && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold">
                  Propriedades territoriais padronizadas
                </summary>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {statisticsPropertyFields.map(({ key, label }) => (
                    <label key={key} className="text-xs font-medium">
                      {label}
                      <input
                        className={inputClass}
                        value={statisticsPropertyValue(key)}
                        onChange={(event) =>
                          updateStatisticsProperty(key, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
              </details>
            )}
          </fieldset>

          {!isSpreadsheet && (
            <fieldset className="mt-7 rounded-lg border border-stone-200 p-4">
              <legend className="px-2 font-bold">Visualização do mapa</legend>
              <p className="text-xs text-stone-500">
                Fonte separada: Image, ImageCollection ou FeatureCollection.
              </p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium">
                  Tipo
                  <select
                    className={inputClass}
                    value={draft.earthEngine.sourceType}
                    onChange={(event) => {
                      if (
                        event.target.value !== "imageCollection" &&
                        draft.earthEngine.collectionSelection
                      ) {
                        setThresholdsInput("");
                      }
                      updateMap({
                        sourceType: event.target
                          .value as EarthEngineAssetMapping["sourceType"],
                        collectionSelection:
                          event.target.value === "imageCollection"
                            ? draft.earthEngine.collectionSelection
                            : undefined,
                      });
                    }}
                  >
                    <option value="image">Image</option>
                    <option value="imageCollection">ImageCollection</option>
                    <option value="featureCollection">FeatureCollection</option>
                  </select>
                </label>
                {draft.earthEngine.sourceType === "imageCollection" && (
                  <div className="text-sm font-medium md:col-span-2">
                    <div className="flex items-center gap-2">
                      <label htmlFor="image-collection-treatment">
                        Tratamento da coleção
                      </label>
                      <button
                        type="button"
                        className="grid size-6 cursor-pointer place-items-center rounded-full border border-[#989F43] bg-white text-xs font-bold text-[#62672D] hover:bg-[#F4F5D8]"
                        aria-label="Ajuda sobre previsão por emissão e horizonte"
                        onClick={() => setForecastGuideOpen(true)}
                      >
                        ?
                      </button>
                    </div>
                    <select
                      id="image-collection-treatment"
                      className={inputClass}
                      value={
                        draft.earthEngine.collectionSelection
                          ? "latest-emission-leads"
                          : "mosaic"
                      }
                      onChange={(event) => {
                        if (event.target.value === "latest-emission-leads") {
                          updateMap({
                            strategy: "single",
                            collectionSelection: {
                              type: "latest-emission-leads",
                              emissionProperty: "data_emissao",
                              leadProperty: "lead_time",
                              targetDateProperty: "system:time_start",
                              leadValues: [1, 2, 3, 4],
                            },
                          });
                          setLeadValuesInput("1, 2, 3, 4");
                        } else {
                          updateMap({
                            collectionSelection: undefined,
                            thresholds: undefined,
                          });
                          setThresholdsInput("");
                        }
                      }}
                    >
                      <option value="mosaic">Usar todas as imagens</option>
                      <option value="latest-emission-leads">
                        Previsão por emissão e horizonte
                      </option>
                    </select>
                    <span className="mt-1 block text-xs font-normal text-stone-500">
                      Use previsão quando a coleção guarda várias rodadas e um
                      horizonte diferente para cada mês.
                    </span>
                  </div>
                )}
                <label className="text-sm font-medium">
                  Organização
                  <select
                    className={inputClass}
                    value={draft.earthEngine.strategy}
                    disabled={Boolean(draft.earthEngine.collectionSelection)}
                    onChange={(event) =>
                      updateMap({
                        strategy: event.target.value as "single" | "perPeriod",
                      })
                    }
                  >
                    <option value="single">Asset único</option>
                    <option value="perPeriod">Por período</option>
                  </select>
                  {draft.earthEngine.collectionSelection && (
                    <span className="mt-1 block text-xs font-normal text-stone-500">
                      Previsões por emissão usam uma única coleção.
                    </span>
                  )}
                </label>
                {draft.earthEngine.strategy === "single" ? (
                  <label className="text-sm font-medium md:col-span-2">
                    ID do asset de mapa
                    <input
                      className={inputClass}
                      value={draft.earthEngine.singleAssetId ?? ""}
                      onChange={(event) =>
                        updateMap({ singleAssetId: event.target.value })
                      }
                    />
                  </label>
                ) : (
                  <label className="text-sm font-medium md:col-span-2">
                    Template do asset de mapa
                    <input
                      className={inputClass}
                      placeholder="projects/projeto/assets/mapa_{period}"
                      value={draft.earthEngine.assetPattern ?? ""}
                      onChange={(event) =>
                        updateMap({ assetPattern: event.target.value })
                      }
                    />
                  </label>
                )}
                {draft.earthEngine.sourceType === "featureCollection" ? (
                  <label className="text-sm font-medium">
                    Propriedade para renderizar
                    <input
                      className={inputClass}
                      value={draft.earthEngine.property ?? ""}
                      onChange={(event) =>
                        updateMap({ property: event.target.value })
                      }
                    />
                  </label>
                ) : (
                  <label className="text-sm font-medium">
                    Banda (obrigatória se houver várias)
                    <input
                      className={inputClass}
                      value={draft.earthEngine.band ?? ""}
                      onChange={(event) =>
                        updateMap({ band: event.target.value })
                      }
                    />
                  </label>
                )}
                {draft.earthEngine.collectionSelection && (
                  <>
                    <label className="text-sm font-medium">
                      Propriedade da emissão
                      <input
                        className={inputClass}
                        value={
                          draft.earthEngine.collectionSelection.emissionProperty
                        }
                        onChange={(event) =>
                          updateMap({
                            collectionSelection: {
                              ...draft.earthEngine.collectionSelection!,
                              emissionProperty: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Propriedade do horizonte
                      <input
                        className={inputClass}
                        value={
                          draft.earthEngine.collectionSelection.leadProperty
                        }
                        onChange={(event) =>
                          updateMap({
                            collectionSelection: {
                              ...draft.earthEngine.collectionSelection!,
                              leadProperty: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Propriedade do mês previsto
                      <input
                        className={inputClass}
                        value={
                          draft.earthEngine.collectionSelection
                            .targetDateProperty
                        }
                        onChange={(event) =>
                          updateMap({
                            collectionSelection: {
                              ...draft.earthEngine.collectionSelection!,
                              targetDateProperty: event.target.value,
                            },
                          })
                        }
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Horizontes
                      <input
                        className={inputClass}
                        placeholder="1, 2, 3, 4"
                        value={leadValuesInput}
                        onChange={(event) =>
                          setLeadValuesInput(event.target.value)
                        }
                      />
                      <span className="mt-1 block text-xs font-normal text-stone-500">
                        Números inteiros separados por vírgula.
                      </span>
                    </label>
                  </>
                )}
                {/* Fora do bloco de previsão: um raster contínuo precisa dos
                  limites qualquer que seja a estratégia de asset. Sem este
                  campo visível, um índice como o Carbono Orgânico do Solo era
                  publicado com `min` 1 e `max` 6 sobre valores em g/kg, e o
                  mapa saía inteiro na cor da última classe. */}
                {!isValueTable && (
                  <label className="text-sm font-medium md:col-span-2">
                    Limites das classes (opcional)
                    <input
                      className={inputClass}
                      placeholder="-90, -30, 0, 30, 90"
                      value={thresholdsInput}
                      onChange={(event) =>
                        setThresholdsInput(event.target.value)
                      }
                    />
                    <span className="mt-1 block text-xs font-normal text-stone-500">
                      Só para raster contínuo, em que cada classe é uma faixa de
                      valores: informe os limites na unidade do próprio asset
                      (g/kg, mm, °C), um a menos que a quantidade de classes e
                      em ordem crescente — 6 classes exigem 5 limites. Deixe
                      vazio quando o raster já guarda o número da classe em cada
                      pixel.
                    </span>
                  </label>
                )}
              </div>
            </fieldset>
          )}

          {hasValueIndicator ? (
            <>
              <MunicipalValueIndicatorFields
                indicator={draft.valueIndicator ?? EMPTY_VALUE_INDICATOR}
                inputClass={inputClass}
                onChange={updateValueIndicator}
              />
              <ValueRangeFields
                ranges={draft.classes}
                thresholdsInput={thresholdsInput}
                inputClass={inputClass}
                buttonClass={buttonClass}
                onChangeRange={updateClass}
                onChangeRanges={(ranges) => updateDraft("classes", ranges)}
                onChangeThresholds={setThresholdsInput}
                detecting={busy === "detect-ranges"}
                onDetectRanges={
                  isSpreadsheet
                    ? () => void detectSpreadsheetRanges()
                    : undefined
                }
              />
            </>
          ) : (
            <fieldset className="mt-7 rounded-lg border border-stone-200 p-4">
              <legend className="px-2 font-bold">Classes</legend>
              {draft.classes.length === 0 ? (
                <p className="text-sm text-stone-500">
                  Clique em “Validar assets e gerar prévia” para inferir os
                  índices de perc_classe_XX e area_ha_classe_XX.
                </p>
              ) : (
                <div className="space-y-3">
                  {draft.classes.map((entry, index) => (
                    <div
                      key={entry.classIndex}
                      className="grid items-end gap-3 md:grid-cols-[110px_1fr_260px]"
                    >
                      <label className="text-xs font-medium">
                        Índice
                        <input
                          className={`${inputClass} bg-stone-100`}
                          readOnly
                          value={entry.classIndex}
                        />
                      </label>
                      <label className="text-xs font-medium">
                        Rótulo
                        <input
                          className={inputClass}
                          value={entry.label}
                          onChange={(event) =>
                            updateClass(index, { label: event.target.value })
                          }
                        />
                      </label>
                      <ClassColorField
                        color={entry.color}
                        inputClass={inputClass}
                        label={`classe ${entry.classIndex}`}
                        onChange={(color) => updateClass(index, { color })}
                      />
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-stone-500">
                O valor é sempre percentual e a unidade é sempre % nesta versão.
              </p>
            </fieldset>
          )}

          <ClassificationMethodFields
            entryId={entryId}
            periods={classificationPeriods}
            classCount={draft.classes.length}
            canChangeClassCount={hasValueIndicator}
            inputClass={inputClass}
            buttonClass={buttonClass}
            onApply={applyClassificationBreaks}
          />

          <IndexCatalogReportFields
            report={report}
            classes={draft.classes}
            inputClass={inputClass}
            buttonClass={buttonClass}
            disabled={Boolean(busy) || !entryId}
            onChange={setReport}
            onSave={() => void saveReportText()}
          />

          <div className="mt-6 flex flex-wrap gap-3">
            <CatalogActionButton
              className={`${buttonClass} border border-stone-300`}
              disabled={Boolean(busy)}
              onClick={() => void saveDraft()}
              description="Guarda as informações preenchidas para você continuar depois. O índice ainda não aparece no Monitoramento."
            >
              Salvar rascunho
            </CatalogActionButton>
            <CatalogActionButton
              className={`${buttonClass} bg-[#E1E2B4]`}
              disabled={Boolean(busy)}
              onClick={() => void validateAndPreview()}
              description="Confere se os dados e mapas podem ser usados e mostra uma prévia privada. O índice ainda não aparece no Monitoramento."
            >
              Validar assets e gerar prévia
            </CatalogActionButton>
            <CatalogActionButton
              className={`${buttonClass} bg-[#989F43] text-white`}
              disabled={Boolean(busy) || !canPublishDraft}
              onClick={() => void publishDraft()}
              description="Faz uma última conferência e disponibiliza o índice no Monitoramento. Os dados continuam guardados no Google Earth Engine."
            >
              {canRepublish && !preview ? "Republicar" : "Publicar"}
            </CatalogActionButton>
          </div>
          {validationProgress && (
            <div
              className="mt-4 rounded-lg border border-[#D6D89A] bg-[#F4F5D8] p-4"
              aria-live="polite"
            >
              <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                <span>Progresso estimado da validação</span>
                <span>{validationProgress.percent}%</span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-white"
                role="progressbar"
                aria-label="Progresso estimado da validação"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={validationProgress.percent}
              >
                <div
                  className="h-full rounded-full bg-[#989F43] transition-[width] duration-500 ease-out"
                  style={{ width: `${validationProgress.percent}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-stone-700">
                {validationProgress.message}
              </p>
              {validationProgress.percent < 100 && (
                <p className="mt-1 text-xs text-stone-500">
                  Tabelas grandes podem levar alguns minutos. Você pode manter
                  esta tela aberta enquanto a conferência é feita.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {preview && (
        <section className="space-y-4">
          <div className="rounded-lg border border-[#D6D89A] bg-white p-4 text-sm">
            <strong>{preview.validation.inferred.periods.length}</strong>{" "}
            período(s),{" "}
            <strong>{preview.validation.inferred.classIndexes.length}</strong>{" "}
            classe(s) e{" "}
            <strong>{preview.validation.inferred.statisticsAssetCount}</strong>{" "}
            asset(s) estatístico(s) validados.
          </div>
          <CatalogPreviewMapCapture
            preview={{
              entryId: preview.entryId,
              panelLayer: preview.panelLayer,
              period: resolvePreviewMapPeriod(preview),
            }}
            onSaved={(url) =>
              setPreview((current) =>
                current
                  ? {
                      ...current,
                      panelLayer: {
                        ...current.panelLayer,
                        previewMap: { url },
                      },
                    }
                  : current,
              )
            }
          />
          <CatalogMonitoringPreview preview={preview} />
          <CatalogReportPreview
            entryId={preview.entryId}
            tileApiPath={preview.panelLayer.tileApiPath}
          />
        </section>
      )}

      {deleteImpact && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/40 p-4">
          <div className="max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">
              Remover {deleteImpact.item.name}?
            </h2>
            <p className="mt-3 text-sm text-stone-600">
              Somente o panelLayer será removido do Contentful. Os assets GEE
              nunca serão apagados. Digite o ID técnico para confirmar:
            </p>
            <code className="mt-2 block rounded bg-stone-100 p-2 text-sm">
              {deleteImpact.item.panelLayerId}
            </code>
            <input
              className={inputClass}
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className={`${buttonClass} border border-stone-300`}
                onClick={() => setDeleteImpact(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${buttonClass} bg-red-700 text-white`}
                disabled={
                  deleteConfirmation !== deleteImpact.item.panelLayerId ||
                  busy === "delete"
                }
                onClick={() => void removeIndex()}
              >
                Remover panelLayer
              </button>
            </div>
          </div>
        </div>
      )}
      {guideOpen && (
        <IndexCatalogGuideModal onClose={() => setGuideOpen(false)} />
      )}
      {forecastGuideOpen && (
        <ImageCollectionForecastGuideModal
          onClose={() => setForecastGuideOpen(false)}
        />
      )}
    </div>
  );
}
