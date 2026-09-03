"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { CatalogMonitoringPreview } from "@/components/IndexCatalog/CatalogMonitoringPreview";
import { CatalogPreviewMapCapture } from "@/components/IndexCatalog/CatalogPreviewMapCapture";
import { CatalogReportPreview } from "@/components/IndexCatalog/CatalogReportPreview";
import { ClassColorField } from "@/components/IndexCatalog/ClassColorField";
import {
  catalogApiRequest as apiRequest,
  catalogIdempotencyKey as idempotencyKey,
  requestCatalogPreview as requestPreview,
  type CatalogApiErrorBody as ApiErrorBody,
} from "@/components/IndexCatalog/catalogApiClient";
import { IndexCatalogGuideModal } from "@/components/IndexCatalog/IndexCatalogGuideModal";
import { IndexCatalogReportFields } from "@/components/IndexCatalog/IndexCatalogReportFields";
import { ImageCollectionForecastGuideModal } from "@/components/IndexCatalog/ImageCollectionForecastGuideModal";
import {
  detectYearPartitionedTemplate,
  fillYearPlaceholder,
} from "@/utils/indexCatalog";
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
  isIndexCatalogConfigV2,
  type ClassMapping,
  type EarthEngineAssetMapping,
  type IndexCatalogDraftInput,
  type IndexCatalogItem,
  type IndexCatalogLifecycleImpact,
  type IndexCatalogPreview,
} from "@/types/indexCatalog";

const STANDARD_PROPERTIES = {
  level: "NIVEL_AGRUPAMENTO",
  locationName: "NOME_LOCAL",
  municipalityCode: "CD_MUN",
  stateCode: "NM_UF",
  year: "ano",
  date: "data_img",
  totalArea: "area_total_ha",
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

function inferStatisticsAssetMode(
  asset: IndexCatalogDraftInput["statisticsSource"]["asset"],
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

function statusLabel(item: IndexCatalogItem) {
  if (!item.catalogManaged) return "Legado — somente leitura";
  if (item.published && item.hasUnpublishedChanges) {
    return "Publicado com revisão em rascunho";
  }
  if (item.published) return "Publicado";
  if (item.status === "ready") return "Prévia validada";
  if (item.status === "error") return "Requer correções";
  return "Rascunho";
}

function parseNumberList(value: string, label: string, integersOnly = false) {
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const numbers = parts.map(Number);
  if (
    numbers.some(
      (number) =>
        !Number.isFinite(number) || (integersOnly && !Number.isInteger(number)),
    )
  ) {
    throw new Error(`${label} deve usar números separados por vírgula.`);
  }
  return numbers;
}

export function IndexCatalogScreen() {
  const [items, setItems] = useState<IndexCatalogItem[]>([]);
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
  const [leadValuesInput, setLeadValuesInput] = useState("1, 2, 3, 4");
  const [preview, setPreview] = useState<IndexCatalogPreview | null>(null);
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

  const loadItems = useCallback(async () => {
    const result = await apiRequest<{ items: IndexCatalogItem[] }>(
      "/api/index-catalog",
    );
    setItems(result.items);
    return result.items;
  }, []);

  useEffect(() => {
    let active = true;
    apiRequest<{ items: IndexCatalogItem[] }>("/api/index-catalog")
      .then((result) => {
        if (active) setItems(result.items);
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
  }, []);

  const editingItem = entryId
    ? items.find((item) => item.entryId === entryId)
    : undefined;

  function resetEditor() {
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
    setLeadValuesInput("1, 2, 3, 4");
  }

  function resumeDraft(item: IndexCatalogItem) {
    if (!isIndexCatalogConfigV2(item.catalogConfig)) return;
    const config = item.catalogConfig;
    setDraft({
      name: config.name,
      description: config.description,
      category: config.category,
      statisticsSource: config.statisticsSource,
      classes: config.classes,
      earthEngine: { ...config.earthEngine, assetsByPeriod: undefined },
    });
    // Um rascunho sem texto salvo recebe o padrão, e não campos vazios: é o
    // mesmo ponto de partida de um índice novo, inclusive para os que foram
    // criados antes de existir texto de relatório no catálogo.
    setReport(toReportDraft(config.report));
    storedReportRef.current = config.report;
    const assetMode = inferStatisticsAssetMode(config.statisticsSource.asset);
    setStatisticsAssetMode(assetMode);
    // Reexibe o ano que o operador digitou, e não o placeholder gravado.
    setYearSampleAssetId(
      assetMode === "year-siblings" &&
        config.statisticsSource.asset.type === "period-template"
        ? fillYearPlaceholder(
            config.statisticsSource.asset.assetIdTemplate,
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

  function updateStatisticsAsset(
    values: Partial<IndexCatalogDraftInput["statisticsSource"]["asset"]>,
  ) {
    setDraft((current) => ({
      ...current,
      statisticsSource: {
        ...current.statisticsSource,
        asset: {
          ...current.statisticsSource.asset,
          ...values,
        } as IndexCatalogDraftInput["statisticsSource"]["asset"],
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

  function updateStatisticsProperty(
    key: keyof typeof STANDARD_PROPERTIES,
    value: string,
  ) {
    setDraft((current) => ({
      ...current,
      statisticsSource: {
        ...current.statisticsSource,
        properties: { ...current.statisticsSource.properties, [key]: value },
      },
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

  function normalizedDraft() {
    const collectionSelection = draft.earthEngine.collectionSelection;
    return {
      ...draft,
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
        classes: result.panelLayer.imageData.classes.map((entry, position) => ({
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
    if (!entryId || !preview) return;
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

  async function togglePublication(item: IndexCatalogItem) {
    const action = item.published ? "unpublish" : "publish";
    setBusy(`lifecycle-${item.entryId}`);
    try {
      await apiRequest(
        `/api/index-catalog/entries/${encodeURIComponent(item.entryId)}`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": idempotencyKey(action, item.entryId),
          },
          body: JSON.stringify({ action }),
        },
      );
      setMessage(
        item.published
          ? `“${item.name}” foi despublicado.`
          : `“${item.name}” foi publicado.`,
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

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-lg font-bold">Índices existentes</h2>
        {busy === "load" ? (
          <p className="mt-3 text-sm">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">
            Nenhum panelLayer encontrado.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <article
                key={item.entryId}
                className="rounded-lg border border-stone-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold">{item.name}</h3>
                  <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px]">
                    {statusLabel(item)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  {item.panelLayerId}
                </p>
                {!item.catalogManaged && (
                  <p className="mt-3 text-xs text-amber-800">
                    Configuração v1 ou índice externo. Visível, mas não editável
                    por este formulário.
                  </p>
                )}
                {item.catalogManaged && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`${buttonClass} bg-[#E8E9DC]`}
                      onClick={() => resumeDraft(item)}
                    >
                      Abrir e editar
                    </button>
                    {item.published && (
                      <button
                        type="button"
                        className={`${buttonClass} border border-stone-300`}
                        onClick={() => void togglePublication(item)}
                      >
                        Despublicar
                      </button>
                    )}
                    {!item.published && item.status === "ready" && (
                      <button
                        type="button"
                        className={`${buttonClass} bg-[#989F43] text-white`}
                        onClick={() => void togglePublication(item)}
                      >
                        Publicar
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${buttonClass} text-red-700`}
                      onClick={() => void reviewDeletion(item)}
                    >
                      Remover
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

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
            Obrigatoriamente FeatureCollection. Classes e períodos são
            inferidos.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
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
                <option value="period-template">Template por período</option>
              </select>
              <span className="mt-1 block text-xs font-normal text-stone-500">
                {STATISTICS_ASSET_MODE_HINTS[statisticsAssetMode]}
              </span>
            </label>
            <label className="text-sm font-medium">
              Granularidade
              <select
                className={inputClass}
                value={draft.statisticsSource.periodGranularity}
                onChange={(event) =>
                  updateDraft("statisticsSource", {
                    ...draft.statisticsSource,
                    periodGranularity: event.target.value as "year" | "month",
                  })
                }
              >
                <option value="year">Anual</option>
                <option value="month">Mensal</option>
              </select>
              <span className="mt-1 block text-xs font-normal text-stone-500">
                Anual gera períodos como 2026; Mensal gera 2026-09. Precisa
                bater com os períodos da tabela.
              </span>
            </label>
            <label className="text-sm font-medium md:col-span-2">
              {STATISTICS_ASSET_FIELD_LABELS[statisticsAssetMode]}
              <input
                className={inputClass}
                placeholder={STATISTICS_ASSET_PLACEHOLDERS[statisticsAssetMode]}
                value={
                  statisticsAssetMode === "year-siblings"
                    ? yearSampleAssetId
                    : draft.statisticsSource.asset.type === "fixed"
                      ? draft.statisticsSource.asset.assetId
                      : draft.statisticsSource.asset.assetIdTemplate
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
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold">
              Propriedades territoriais padronizadas
            </summary>
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(
                Object.keys(STANDARD_PROPERTIES) as Array<
                  keyof typeof STANDARD_PROPERTIES
                >
              ).map((key) => (
                <label key={key} className="text-xs font-medium">
                  {key}
                  <input
                    className={inputClass}
                    value={draft.statisticsSource.properties[key]}
                    onChange={(event) =>
                      updateStatisticsProperty(key, event.target.value)
                    }
                  />
                </label>
              ))}
            </div>
          </details>
        </fieldset>

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
                  onChange={(event) => updateMap({ band: event.target.value })}
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
                    value={draft.earthEngine.collectionSelection.leadProperty}
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
                      draft.earthEngine.collectionSelection.targetDateProperty
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
                    onChange={(event) => setLeadValuesInput(event.target.value)}
                  />
                  <span className="mt-1 block text-xs font-normal text-stone-500">
                    Números inteiros separados por vírgula.
                  </span>
                </label>
                <label className="text-sm font-medium md:col-span-2">
                  Limites das classes
                  <input
                    className={inputClass}
                    placeholder="-90, -30, 0, 30, 90"
                    value={thresholdsInput}
                    onChange={(event) => setThresholdsInput(event.target.value)}
                  />
                  <span className="mt-1 block text-xs font-normal text-stone-500">
                    Informe um limite a menos que a quantidade de classes, em
                    ordem crescente. Exemplo: 6 classes exigem 5 limites.
                  </span>
                </label>
              </>
            )}
          </div>
        </fieldset>

        <fieldset className="mt-7 rounded-lg border border-stone-200 p-4">
          <legend className="px-2 font-bold">Classes</legend>
          {draft.classes.length === 0 ? (
            <p className="text-sm text-stone-500">
              Clique em “Validar assets e gerar prévia” para inferir os índices
              de perc_classe_XX e area_ha_classe_XX.
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

        <IndexCatalogReportFields
          report={report}
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
            disabled={Boolean(busy) || !preview}
            onClick={() => void publishDraft()}
            description="Faz uma última conferência e disponibiliza o índice no Monitoramento. Os dados continuam guardados no Google Earth Engine."
          >
            Publicar
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
            preview={preview}
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
          <CatalogReportPreview entryId={preview.entryId} />
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
