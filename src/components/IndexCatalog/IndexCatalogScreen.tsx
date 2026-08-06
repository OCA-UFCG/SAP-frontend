"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CatalogMonitoringPreview } from "@/components/IndexCatalog/CatalogMonitoringPreview";
import {
  INDEX_CATEGORIES,
  type ClassMapping,
  type DriveFileCandidate,
  type EarthEngineAssetMapping,
  type IndexCatalogDraftInput,
  type IndexCatalogItem,
  type IndexCatalogLifecycleImpact,
  type IndexCatalogPreview,
} from "@/types/indexCatalog";

const CLASS_COLORS = [
  "#D9ED92",
  "#B5E48C",
  "#76C893",
  "#34A0A4",
  "#1A759F",
  "#184E77",
];

const EMPTY_DRAFT: IndexCatalogDraftInput = {
  name: "",
  description: "",
  category: INDEX_CATEGORIES[0],
  sourceTag: "",
  selectedFiles: [],
  valueType: "percentage",
  unit: "%",
  classes: [],
  earthEngine: {
    strategy: "single",
    sourceType: "image",
    singleAssetId: "",
    continuousValues: false,
  },
};

interface ApiErrorBody {
  error?: string;
  validation?: IndexCatalogPreview["validation"];
}

function humanFileSize(value?: string) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function statusLabel(item: IndexCatalogItem) {
  if (item.published && item.hasUnpublishedChanges) {
    return "Publicado com alterações em draft";
  }
  if (item.status === "legacy") {
    return item.published ? "Legado publicado" : "Legado em draft";
  }
  if (item.status === "published") return "Publicado";
  if (item.status === "ready") return "Pronto para publicar";
  if (item.status === "error") return "Requer correções";
  return "Rascunho";
}

function correctionMessages(item: IndexCatalogItem) {
  if (item.status !== "error" || !item.catalogConfig) return [];

  const validationMessages =
    item.catalogConfig.validation?.errors.map((issue) => issue.message) ?? [];
  const lastFailure = [...(item.catalogConfig.auditLog ?? [])]
    .reverse()
    .find((event) => event.outcome === "failure")?.message;

  return [...new Set([...validationMessages, ...(lastFailure ? [lastFailure] : [])])];
}

function createClasses(files: DriveFileCandidate[]): ClassMapping[] {
  const columns =
    [...files]
      .sort(
        (left, right) =>
          right.inspection.classColumns.length -
          left.inspection.classColumns.length,
      )
      .at(0)?.inspection.classColumns ?? [];

  return columns.map((column, index) => ({
    column,
    id: `classe-${index + 1}`,
    label: columns.length === 1 ? "Medida" : `Classe ${index + 1}`,
    color: CLASS_COLORS[index % CLASS_COLORS.length],
    pixelValue: Number(column.match(/_(\d+)$/u)?.[1] ?? index),
  }));
}

function filesSafelyInferPercentage(files: DriveFileCandidate[]) {
  return (
    files.length > 0 &&
    files.every(
      (file) =>
        file.inspection.classColumns.length > 0 &&
        file.inspection.classColumns.every(
          (column) =>
            column.startsWith("perc_classe_") ||
            column.startsWith("area_ha_classe_"),
        ),
    )
  );
}

function inferDriveConfiguration(
  files: DriveFileCandidate[],
  current: IndexCatalogDraftInput,
) {
  const compatibleFiles = files.filter(
    (file) => file.inspection.role !== "unsupported",
  );
  const inferredPercentage = filesSafelyInferPercentage(compatibleFiles);

  return {
    compatibleFiles,
    draft: {
      ...current,
      selectedFiles: compatibleFiles,
      classes: createClasses(compatibleFiles),
      valueType: inferredPercentage ? ("percentage" as const) : current.valueType,
      unit: inferredPercentage ? "%" : current.unit,
    },
  };
}

function parseAssetsByPeriod(value: string) {
  return Object.fromEntries(
    value.split(/\r?\n/u).flatMap((line) => {
      const separator = line.indexOf("=");
      if (separator < 1) return [];
      const period = line.slice(0, separator).trim();
      const assetId = line.slice(separator + 1).trim();
      return period && assetId ? [[period, assetId]] : [];
    }),
  );
}

function serializeAssetsByPeriod(mapping?: Record<string, string>) {
  return Object.entries(mapping ?? {})
    .map(([period, assetId]) => `${period}=${assetId}`)
    .join("\n");
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody & T;

  if (!response.ok) {
    throw Object.assign(
      new Error(body.error ?? `A requisição falhou (${response.status}).`),
      { validation: body.validation },
    );
  }

  return body;
}

function idempotencyKey(action: string, entryId: string) {
  return `${action}-${entryId}-${crypto.randomUUID()}`;
}

export function IndexCatalogScreen() {
  const [items, setItems] = useState<IndexCatalogItem[]>([]);
  const [draft, setDraft] = useState<IndexCatalogDraftInput>(EMPTY_DRAFT);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [driveResults, setDriveResults] = useState<DriveFileCandidate[]>([]);
  const [driveError, setDriveError] = useState("");
  const [driveMessage, setDriveMessage] = useState("");
  const [periodAssetsText, setPeriodAssetsText] = useState("");
  const [preview, setPreview] = useState<IndexCatalogPreview | null>(null);
  const [deleteImpact, setDeleteImpact] =
    useState<IndexCatalogLifecycleImpact | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>("load");
  const entryIdRef = useRef<string | null>(null);
  const createRequestKeyRef = useRef<string | null>(null);
  const savePromiseRef = useRef<Promise<string | null> | null>(null);

  const loadItems = useCallback(async () => {
    const result = await apiRequest<{ items: IndexCatalogItem[] }>(
      "/api/index-catalog",
    );
    setItems(result.items);
  }, []);

  useEffect(() => {
    apiRequest<{ items: IndexCatalogItem[] }>("/api/index-catalog")
      .then((result) => setItems(result.items))
      .catch((requestError) =>
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Falha ao carregar o catálogo.",
        ),
      )
      .finally(() => setBusy(null));
  }, [loadItems]);

  const selectedIds = useMemo(
    () => new Set(draft.selectedFiles.map((file) => file.id)),
    [draft.selectedFiles],
  );
  const duplicateNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) {
      const key = item.name.trim().toLocaleLowerCase("pt-BR");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [items]);
  const safelyInferredPercentage = filesSafelyInferPercentage(
    draft.selectedFiles,
  );

  function startNewDraft() {
    setDraft({ ...EMPTY_DRAFT, earthEngine: { ...EMPTY_DRAFT.earthEngine } });
    setEntryId(null);
    entryIdRef.current = null;
    createRequestKeyRef.current = null;
    setDriveResults([]);
    setDriveError("");
    setDriveMessage("");
    setPeriodAssetsText("");
    setPreview(null);
    setMessage("");
  }

  function clearEditor() {
    setDraft({ ...EMPTY_DRAFT, earthEngine: { ...EMPTY_DRAFT.earthEngine } });
    setEntryId(null);
    entryIdRef.current = null;
    createRequestKeyRef.current = null;
    setDriveResults([]);
    setDriveError("");
    setDriveMessage("");
    setPeriodAssetsText("");
    setPreview(null);
  }

  function resumeDraft(item: IndexCatalogItem) {
    if (!item.catalogConfig || item.published) return;
    const input: IndexCatalogDraftInput = {
      name: item.catalogConfig.name,
      description: item.catalogConfig.description,
      category: item.catalogConfig.category,
      sourceTag: item.catalogConfig.sourceTag,
      selectedFiles: item.catalogConfig.selectedFiles,
      valueType: item.catalogConfig.valueType,
      unit: item.catalogConfig.unit,
      classes: item.catalogConfig.classes,
      earthEngine: item.catalogConfig.earthEngine,
    };
    setEntryId(item.entryId);
    entryIdRef.current = item.entryId;
    createRequestKeyRef.current = null;
    setDraft(input);
    setDriveResults(input.selectedFiles);
    setDriveError("");
    setDriveMessage("");
    setPeriodAssetsText(
      serializeAssetsByPeriod(input.earthEngine.assetsByPeriod),
    );
    setPreview(null);
    setMessage(`Rascunho “${item.name}” carregado.`);
  }

  function updateDraft<K extends keyof IndexCatalogDraftInput>(
    key: K,
    value: IndexCatalogDraftInput[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setPreview(null);
  }

  function updateEarthEngine(values: Partial<EarthEngineAssetMapping>) {
    setDraft((current) => ({
      ...current,
      earthEngine: { ...current.earthEngine, ...values },
    }));
    setPreview(null);
  }

  async function searchDrive() {
    setBusy("drive");
    setDriveError("");
    setDriveMessage("");
    setDriveResults([]);
    setMessage("");
    try {
      const result = await apiRequest<{ items: DriveFileCandidate[] }>(
        "/api/index-catalog/drive-search",
        {
          method: "POST",
          body: JSON.stringify({ tag: draft.sourceTag }),
        },
      );
      setDriveResults(result.items);
      const inferred = inferDriveConfiguration(result.items, draft);
      setDraft(inferred.draft);
      setPreview(null);
      setDriveMessage(
        result.items.length
          ? `${inferred.compatibleFiles.length} arquivo(s) compatível(is) selecionado(s) automaticamente${
              result.items.length > inferred.compatibleFiles.length
                ? `; ${result.items.length - inferred.compatibleFiles.length} incompatível(is) ficou(aram) de fora.`
                : "."
            }`
          : "A pasta está acessível, mas nenhum CSV ou Google Sheet corresponde à tag informada.",
      );
    } catch (requestError) {
      const reason =
        requestError instanceof Error
          ? requestError.message
          : "Erro inesperado na requisição.";
      setDriveError(reason);
    } finally {
      setBusy(null);
    }
  }

  function toggleDriveFile(file: DriveFileCandidate) {
    setDraft((current) => {
      const selected = current.selectedFiles.some(
        (candidate) => candidate.id === file.id,
      )
        ? current.selectedFiles.filter((candidate) => candidate.id !== file.id)
        : [...current.selectedFiles, file];
      const inferredClasses = createClasses(selected);

      return {
        ...current,
        selectedFiles: selected,
        valueType: filesSafelyInferPercentage(selected)
          ? "percentage"
          : current.valueType,
        unit: filesSafelyInferPercentage(selected) ? "%" : current.unit,
        classes:
          selected.length === 0
            ? []
            : inferredClasses.length > 0 &&
                current.classes.length !== inferredClasses.length
            ? inferredClasses
            : current.classes,
      };
    });
    setPreview(null);
  }

  function updateClass(index: number, values: Partial<ClassMapping>) {
    setDraft((current) => ({
      ...current,
      classes: current.classes.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...values } : entry,
      ),
    }));
    setPreview(null);
  }

  function normalizedDraft(): IndexCatalogDraftInput {
    return {
      ...draft,
      unit: draft.valueType === "percentage" ? "%" : draft.unit,
      earthEngine: {
        ...draft.earthEngine,
        ...(draft.earthEngine.strategy === "perPeriod"
          ? { assetsByPeriod: parseAssetsByPeriod(periodAssetsText) }
          : {}),
      },
    };
  }

  async function persistDraft() {
    setBusy("save");
    setMessage("");
    try {
      let input = normalizedDraft();
      if (input.selectedFiles.length === 0 && input.sourceTag.trim()) {
        const driveSearch = await apiRequest<{ items: DriveFileCandidate[] }>(
          "/api/index-catalog/drive-search",
          {
            method: "POST",
            body: JSON.stringify({ tag: input.sourceTag }),
          },
        );
        const inferred = inferDriveConfiguration(driveSearch.items, input);
        input = inferred.draft;
        setDriveResults(driveSearch.items);
        setDriveMessage(
          `${inferred.compatibleFiles.length} arquivo(s) compatível(is) selecionado(s) automaticamente.`,
        );
        setDraft(input);

        if (inferred.compatibleFiles.length === 0) {
          throw new Error(
            "Nenhum arquivo compatível foi encontrado para a tag informada.",
          );
        }
        if (input.classes.length === 0) {
          throw new Error(
            "As fontes encontradas ainda não possuem colunas reconhecidas para inferir classes ou medidas.",
          );
        }
      }
      const currentEntryId = entryIdRef.current;
      const result = currentEntryId
        ? await apiRequest<{ entryId: string }>(
            `/api/index-catalog/drafts/${encodeURIComponent(currentEntryId)}`,
            { method: "PUT", body: JSON.stringify(input) },
          )
        : await apiRequest<{ entryId: string }>("/api/index-catalog", {
            method: "POST",
            headers: {
              "Idempotency-Key":
                (createRequestKeyRef.current ??= idempotencyKey(
                  "create",
                  "draft",
                )),
            },
            body: JSON.stringify(input),
          });
      entryIdRef.current = result.entryId;
      setEntryId(result.entryId);
      setDraft(input);
      setMessage("Rascunho salvo no Contentful sem publicação.");
      await loadItems();
      return result.entryId;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Falha ao salvar o rascunho.",
      );
      return null;
    } finally {
      setBusy(null);
    }
  }

  function saveDraft() {
    if (savePromiseRef.current) return savePromiseRef.current;

    const promise = persistDraft().finally(() => {
      if (savePromiseRef.current === promise) {
        savePromiseRef.current = null;
      }
    });
    savePromiseRef.current = promise;
    return promise;
  }

  async function generatePreview() {
    const savedEntryId = await saveDraft();
    if (!savedEntryId) return;

    setBusy("preview");
    setMessage("Validando Drive, Earth Engine e payloads…");
    try {
      const result = await apiRequest<IndexCatalogPreview>(
        `/api/index-catalog/drafts/${encodeURIComponent(savedEntryId)}/preview`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": idempotencyKey("preview", savedEntryId),
          },
        },
      );
      setPreview(result);
      setMessage(
        "Prévia validada. O conteúdo permanece em rascunho e não está público.",
      );
      await loadItems();
    } catch (requestError) {
      const validation = (
        requestError as Error & {
          validation?: IndexCatalogPreview["validation"];
        }
      ).validation;
      setPreview(null);
      setError(
        [
          requestError instanceof Error
            ? requestError.message
            : "Falha ao gerar a prévia.",
          ...(validation?.errors.map((issue) => issue.message) ?? []),
        ].join(" "),
      );
      setMessage("");
      await loadItems().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  }

  async function publishDraft() {
    if (!entryId || !preview) return;
    setBusy("publish");
    setMessage("Revalidando fontes e publicando partições…");
    try {
      await apiRequest(
        `/api/index-catalog/drafts/${encodeURIComponent(entryId)}/publish`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": idempotencyKey("publish", entryId),
          },
        },
      );
      clearEditor();
      setMessage(
        "Índice publicado. O panelLayer foi ativado somente após as partições.",
      );
      await loadItems();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Falha ao publicar o índice.",
      );
      setMessage("");
    } finally {
      setBusy(null);
    }
  }

  async function togglePublication(item: IndexCatalogItem) {
    const action = item.published ? "unpublish" : "publish";
    setBusy(`lifecycle-${item.entryId}`);
    setMessage(
      item.published
        ? `Movendo “${item.name}” para draft…`
        : `Publicando “${item.name}”…`,
    );
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
      if (!item.published && entryId === item.entryId) {
        clearEditor();
      }
      setMessage(
        item.published
          ? `“${item.name}” está em draft e não aparece mais no Monitoramento.`
          : `“${item.name}” foi publicado e está ativo no Monitoramento.`,
      );
      await loadItems();
    } catch (requestError) {
      setMessage("");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Falha ao alterar o estado do índice.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function reviewDeletion(item: IndexCatalogItem) {
    setBusy(`delete-impact-${item.entryId}`);
    setMessage("");
    try {
      const impact = await apiRequest<IndexCatalogLifecycleImpact>(
        `/api/index-catalog/entries/${encodeURIComponent(item.entryId)}`,
      );
      setDeleteImpact(impact);
      setDeleteConfirmation("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Falha ao calcular o impacto da remoção.",
      );
    } finally {
      setBusy(null);
    }
  }

  function closeDeletion() {
    if (busy === "delete") return;
    setDeleteImpact(null);
    setDeleteConfirmation("");
  }

  async function removeIndex() {
    if (
      !deleteImpact ||
      deleteConfirmation !== deleteImpact.item.panelLayerId
    ) {
      return;
    }

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
      if (entryId === deleteImpact.item.entryId) {
        clearEditor();
      }
      const deletedName = deleteImpact.item.name;
      const deletedEntries = deleteImpact.counts.total;
      setDeleteImpact(null);
      setDeleteConfirmation("");
      setMessage(
        `“${deletedName}” foi removido do Contentful (${deletedEntries} entrada(s)).`,
      );
      await loadItems();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Falha ao remover o índice.",
      );
    } finally {
      setBusy(null);
    }
  }

  const inputClass =
    "mt-1 w-full rounded-md border border-[#CFD0CA] bg-white px-3 py-2 text-sm text-[#292829] outline-none focus:border-[#989F43] focus:ring-2 focus:ring-[#E1E2B4]";
  const buttonClass =
    "rounded-md bg-[#989F43] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#7E8537] disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[#F6F7F6] pl-[140px]">
      {error && (
        <div className="fixed left-4 right-4 top-20 z-[70] flex justify-center sm:left-[156px] sm:right-8">
          <div
            role="alert"
            aria-live="assertive"
            aria-atomic="true"
            className="flex w-full max-w-[1500px] items-start gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg"
          >
            <span className="flex-1">{error}</span>
            <button
              type="button"
              className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded text-xl leading-none text-red-800 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400"
              aria-label="Fechar notificação de erro"
              onClick={() => setError("")}
            >
              ×
            </button>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-[1500px] space-y-6 px-8 py-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#777B3D]">
              Administração
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-[#292829]">
              Catálogo de índices
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[#666164]">
              Cadastre fontes, valide o contrato territorial e confira uma
              prévia fiel ao Monitoramento antes de publicar. Índices existentes
              podem ser movidos entre draft e publicado ou removidos.
            </p>
          </div>
          <button type="button" className={buttonClass} onClick={startNewDraft}>
            Novo índice
          </button>
        </header>

        {message && (
          <div
            role="status"
            className="rounded-lg border border-[#D7D9B3] bg-[#F3F4DE] px-4 py-3 text-sm text-[#5B612A]"
          >
            {message}
          </div>
        )}

        <section className="rounded-xl border border-[#E1E2DE] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-[#292829]">
            Índices cadastrados
          </h2>
          <p className="mt-1 text-sm text-[#7E797B]">
            Despublicar preserva os dados no Contentful, mas remove o índice do
            Monitoramento. Remover apaga o panelLayer e suas entradas
            territoriais vinculadas.
          </p>
          <div className="mt-4 space-y-3">
            {items.map((item) => {
              const corrections = correctionMessages(item);
              const duplicateCount =
                duplicateNameCounts.get(
                  item.name.trim().toLocaleLowerCase("pt-BR"),
                ) ?? 0;
              const canPublish =
                item.published ||
                !item.catalogManaged ||
                item.status === "ready" ||
                item.status === "published";

              return (
                <article
                  key={item.entryId}
                  className={`rounded-lg border p-4 ${
                    item.status === "error"
                      ? "border-red-200 bg-red-50/40"
                      : "border-[#E4E5E2] bg-[#FAFAF8]"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-[#292829]">
                        {item.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#7E797B]">
                        <span>{item.category ?? "Sem categoria"}</span>
                        <span>ID técnico: {item.panelLayerId || "—"}</span>
                        {item.catalogConfig?.updatedBy.at && (
                          <span>
                            Atualizado em{" "}
                            {new Date(
                              item.catalogConfig.updatedBy.at,
                            ).toLocaleString("pt-BR")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {duplicateCount > 1 && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                          Possível duplicado
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          item.status === "error"
                            ? "bg-red-100 text-red-800"
                            : item.status === "ready" || item.published
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-[#F1F2E5] text-[#5B612A]"
                        }`}
                      >
                        {statusLabel(item)}
                      </span>
                    </div>
                  </div>

                  {item.status === "error" && (
                    <div className="mt-3 rounded-md border border-red-200 bg-white px-3 py-2 text-sm text-red-800">
                      <p className="font-semibold">O que precisa ser corrigido</p>
                      {corrections.length > 0 ? (
                        <ul className="mt-1 list-disc space-y-1 pl-5">
                          {corrections.map((correction) => (
                            <li key={correction}>{correction}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1">
                          Abra o rascunho e gere uma nova prévia para obter o
                          diagnóstico atualizado.
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-4 border-t border-[#E4E5E2] pt-3">
                    {item.catalogConfig && !item.published && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        onClick={() => resumeDraft(item)}
                        className="text-sm font-semibold text-[#777B3D] disabled:cursor-not-allowed disabled:text-[#AAA6A8]"
                      >
                        {item.status === "error"
                          ? "Abrir e corrigir"
                          : "Continuar configuração"}
                      </button>
                    )}
                    {canPublish ? (
                      <button
                        type="button"
                        disabled={busy !== null}
                        aria-label={`${
                          item.published ? "Mover para draft" : "Publicar"
                        } ${item.name}`}
                        onClick={() => togglePublication(item)}
                        className="text-sm font-semibold text-[#5B612A] disabled:cursor-not-allowed disabled:text-[#AAA6A8]"
                      >
                        {busy === `lifecycle-${item.entryId}`
                          ? "Alterando…"
                          : item.published
                            ? "Mover para draft"
                            : "Publicar"}
                      </button>
                    ) : (
                      <span className="text-xs text-[#7E797B]">
                        Próximo passo: abrir e gerar uma prévia válida
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={busy !== null}
                      aria-label={`Remover ${item.name}`}
                      onClick={() => reviewDeletion(item)}
                      className="text-sm font-semibold text-red-700 disabled:cursor-not-allowed disabled:text-[#AAA6A8]"
                    >
                      {busy === `delete-impact-${item.entryId}`
                        ? "Verificando…"
                        : "Remover"}
                    </button>
                  </div>
                </article>
              );
            })}
            {!busy && items.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-[#7E797B]">
                Nenhum panelLayer encontrado.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[#E1E2DE] bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-[#292829]">
                {entryId ? "Editar rascunho" : "Novo rascunho"}
              </h2>
              <p className="mt-1 text-sm text-[#7E797B]">
                Somente os campos necessários para gerar e validar o índice.
              </p>
            </div>
            {entryId && (
              <code className="rounded bg-[#F5F5F2] px-2 py-1 text-xs text-[#666164]">
                entry {entryId}
              </code>
            )}
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="text-sm font-medium text-[#292829]">
              Nome
              <input
                className={inputClass}
                value={draft.name}
                maxLength={120}
                onChange={(event) => updateDraft("name", event.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-[#292829]">
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
            <label className="text-sm font-medium text-[#292829] md:col-span-2">
              Descrição curta
              <textarea
                className={`${inputClass} min-h-20`}
                value={draft.description}
                maxLength={500}
                onChange={(event) =>
                  updateDraft("description", event.target.value)
                }
              />
            </label>
          </div>

          <div className="mt-8 border-t border-[#E4E5E2] pt-6">
            <h3 className="font-semibold text-[#292829]">Fontes do Drive</h3>
            <p className="mt-1 text-sm text-[#7E797B]">
              A tag procura uma substring no nome, ignorando maiúsculas e
              acentos. A seleção final usa IDs e datas exatas.
            </p>
            <div className="mt-4 flex gap-3">
              <input
                className={inputClass}
                value={draft.sourceTag}
                placeholder="Ex.: desertificacao"
                onChange={(event) => {
                  updateDraft("sourceTag", event.target.value);
                  setDriveError("");
                  setDriveMessage("");
                }}
              />
              <button
                type="button"
                className={`${buttonClass} mt-1 shrink-0`}
                disabled={busy !== null}
                onClick={searchDrive}
              >
                {busy === "drive" ? "Buscando…" : "Buscar no Drive"}
              </button>
            </div>

            {driveError && (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                <span className="font-semibold">
                  Não foi possível buscar no Drive.
                </span>{" "}
                {driveError}
              </div>
            )}

            {driveMessage && (
              <div
                role="status"
                className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
                  driveResults.length > 0
                    ? "border-[#D7D9B3] bg-[#F3F4DE] text-[#5B612A]"
                    : "border-amber-200 bg-amber-50 text-amber-800"
                }`}
              >
                {driveMessage}
              </div>
            )}

            {driveResults.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-lg border border-[#E4E5E2]">
                <table className="w-full min-w-[980px] text-left text-xs">
                  <thead className="bg-[#F7F7F4] text-[#666164]">
                    <tr>
                      <th className="p-3">Selecionar</th>
                      <th className="p-3">Arquivo</th>
                      <th className="p-3">Modificação</th>
                      <th className="p-3">Tamanho</th>
                      <th className="p-3">Papel</th>
                      <th className="p-3">Períodos</th>
                      <th className="p-3">Colunas / alertas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driveResults.map((file) => (
                      <tr key={file.id} className="border-t border-[#E4E5E2]">
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(file.id)}
                            disabled={file.inspection.role === "unsupported"}
                            onChange={() => toggleDriveFile(file)}
                            aria-label={`Selecionar ${file.name}`}
                          />
                        </td>
                        <td className="max-w-[240px] p-3 font-medium text-[#292829]">
                          {file.name}
                        </td>
                        <td className="p-3 text-[#666164]">
                          {new Date(file.modifiedTime).toLocaleString("pt-BR")}
                        </td>
                        <td className="p-3">{humanFileSize(file.size)}</td>
                        <td className="p-3">{file.inspection.role}</td>
                        <td className="p-3">
                          {file.inspection.periods.join(", ") || "—"}
                        </td>
                        <td className="max-w-[360px] p-3 text-[#666164]">
                          <div>{file.inspection.columns.join(", ")}</div>
                          {file.inspection.warnings.map((warning) => (
                            <div key={warning} className="mt-1 text-amber-700">
                              {warning}
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="mt-8 border-t border-[#E4E5E2] pt-6">
            <h3 className="font-semibold text-[#292829]">
              Configuração inferida dos arquivos
            </h3>
            <p className="mt-1 text-sm text-[#7E797B]">
              O catálogo preenche esta etapa pelas colunas dos CSVs
              selecionados automaticamente. Os ajustes abaixo são opcionais.
            </p>
            {draft.selectedFiles.length > 0 && (
              <div className="mt-4 rounded-md border border-[#D7D9B3] bg-[#F3F4DE] px-3 py-3 text-sm text-[#5B612A]">
                <p className="font-semibold">Detectado automaticamente</p>
                <p className="mt-1">
                  {draft.selectedFiles.length} fonte(s), {draft.classes.length}{" "}
                  classe(s) ou medida(s)
                  {draft.classes.length > 0
                    ? `: ${draft.classes.map((entry) => entry.column).join(", ")}`
                    : "."}
                </p>
              </div>
            )}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {safelyInferredPercentage ? (
                <div className="rounded-md border border-[#D7D9B3] bg-[#F3F4DE] px-3 py-2 text-sm text-[#5B612A]">
                  Tipo inferido com segurança: percentual (%).
                </div>
              ) : (
                <label className="text-sm font-medium text-[#292829]">
                  Tipo de valor
                  <select
                    className={inputClass}
                    value={draft.valueType}
                    onChange={(event) =>
                      updateDraft(
                        "valueType",
                        event.target
                          .value as IndexCatalogDraftInput["valueType"],
                      )
                    }
                  >
                    <option value="percentage">Percentual</option>
                    <option value="absolute">Absoluto</option>
                  </select>
                </label>
              )}
              {draft.valueType === "absolute" && (
                <label className="text-sm font-medium text-[#292829]">
                  Unidade
                  <input
                    className={inputClass}
                    value={draft.unit}
                    placeholder="Ex.: ha, mm, pessoas"
                    onChange={(event) =>
                      updateDraft("unit", event.target.value)
                    }
                  />
                </label>
              )}
            </div>

            {draft.classes.length > 0 && (
              <details className="mt-4 rounded-lg border border-[#E4E5E2] bg-[#FAFAF8] p-4">
                <summary className="cursor-pointer text-sm font-semibold text-[#5B612A]">
                  Ajustar colunas, nomes, cores e códigos (opcional)
                </summary>
                <div className="mt-4 space-y-3">
                  {draft.classes.map((classEntry, index) => (
                    <div
                      key={`${classEntry.column}-${index}`}
                      className="grid gap-3 rounded-lg border border-[#E4E5E2] bg-white p-4 md:grid-cols-[1.3fr_1.3fr_110px_100px]"
                    >
                      <label className="text-xs font-medium text-[#666164]">
                        Coluna
                        <input
                          className={inputClass}
                          value={classEntry.column}
                          onChange={(event) =>
                            updateClass(index, { column: event.target.value })
                          }
                        />
                      </label>
                      <label className="text-xs font-medium text-[#666164]">
                        Nome
                        <input
                          className={inputClass}
                          value={classEntry.label}
                          onChange={(event) =>
                            updateClass(index, { label: event.target.value })
                          }
                        />
                      </label>
                      <label className="text-xs font-medium text-[#666164]">
                        Cor
                        <input
                          type="color"
                          className={`${inputClass} h-10 p-1`}
                          value={classEntry.color}
                          onChange={(event) =>
                            updateClass(index, { color: event.target.value })
                          }
                        />
                      </label>
                      <label className="text-xs font-medium text-[#666164]">
                        Código
                        <input
                          type="number"
                          className={inputClass}
                          value={classEntry.pixelValue ?? index}
                          onChange={(event) =>
                            updateClass(index, {
                              pixelValue: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </details>
            )}
            {draft.selectedFiles.length > 0 && draft.classes.length === 0 && (
              <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                As fontes encontradas ainda não possuem nomes de colunas que o
                catálogo reconheça automaticamente.
              </p>
            )}
          </div>

          <div className="mt-8 border-t border-[#E4E5E2] pt-6">
            <h3 className="font-semibold text-[#292829]">
              Asset do Earth Engine
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium text-[#292829]">
                Estratégia
                <select
                  className={inputClass}
                  value={draft.earthEngine.strategy}
                  onChange={(event) =>
                    updateEarthEngine({
                      strategy: event.target
                        .value as EarthEngineAssetMapping["strategy"],
                    })
                  }
                >
                  <option value="single">Asset único</option>
                  <option value="perPeriod">Asset por período</option>
                </select>
              </label>
              <label className="text-sm font-medium text-[#292829]">
                Tipo do asset
                <select
                  className={inputClass}
                  value={draft.earthEngine.sourceType}
                  onChange={(event) =>
                    updateEarthEngine({
                      sourceType: event.target
                        .value as EarthEngineAssetMapping["sourceType"],
                    })
                  }
                >
                  <option value="image">Image</option>
                  <option value="imageCollection">ImageCollection</option>
                  <option value="featureCollection">FeatureCollection</option>
                </select>
              </label>
              {draft.earthEngine.strategy === "single" ? (
                <label className="text-sm font-medium text-[#292829]">
                  ID do asset
                  <input
                    className={inputClass}
                    value={draft.earthEngine.singleAssetId ?? ""}
                    onChange={(event) =>
                      updateEarthEngine({
                        singleAssetId: event.target.value,
                      })
                    }
                  />
                </label>
              ) : (
                <label className="text-sm font-medium text-[#292829]">
                  Padrão do asset
                  <input
                    className={inputClass}
                    value={draft.earthEngine.assetPattern ?? ""}
                    placeholder="projects/.../indice_{period}"
                    onChange={(event) =>
                      updateEarthEngine({ assetPattern: event.target.value })
                    }
                  />
                </label>
              )}
            </div>

            {draft.earthEngine.strategy === "perPeriod" && (
              <label className="mt-4 block text-sm font-medium text-[#292829]">
                Assets específicos por período (opcional, um por linha)
                <textarea
                  className={`${inputClass} min-h-24 font-mono`}
                  value={periodAssetsText}
                  placeholder={
                    "2025-01=projects/.../asset_2025_01\n2025-02=projects/.../asset_2025_02"
                  }
                  onChange={(event) => {
                    setPeriodAssetsText(event.target.value);
                    setPreview(null);
                  }}
                />
              </label>
            )}

            <details className="mt-5 rounded-lg border border-[#E4E5E2] p-4">
              <summary className="cursor-pointer text-sm font-semibold text-[#5B612A]">
                Opções avançadas de visualização
              </summary>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {draft.earthEngine.sourceType !== "featureCollection" && (
                  <label className="text-sm font-medium text-[#292829]">
                    Banda (se houver mais de uma)
                    <input
                      className={inputClass}
                      value={draft.earthEngine.band ?? ""}
                      onChange={(event) =>
                        updateEarthEngine({ band: event.target.value })
                      }
                    />
                  </label>
                )}
                {draft.earthEngine.sourceType === "featureCollection" && (
                  <label className="text-sm font-medium text-[#292829]">
                    Propriedade
                    <input
                      className={inputClass}
                      value={draft.earthEngine.property ?? ""}
                      onChange={(event) =>
                        updateEarthEngine({ property: event.target.value })
                      }
                    />
                  </label>
                )}
                <label className="flex items-center gap-2 pt-6 text-sm font-medium text-[#292829]">
                  <input
                    type="checkbox"
                    checked={draft.earthEngine.continuousValues ?? false}
                    onChange={(event) =>
                      updateEarthEngine({
                        continuousValues: event.target.checked,
                      })
                    }
                  />
                  Asset com valores contínuos
                </label>
                {draft.earthEngine.continuousValues && (
                  <label className="text-sm font-medium text-[#292829]">
                    Limites das faixas
                    <input
                      className={inputClass}
                      value={draft.earthEngine.thresholds?.join(", ") ?? ""}
                      placeholder="20, 40, 60, 80"
                      onChange={(event) =>
                        updateEarthEngine({
                          thresholds: event.target.value
                            .split(",")
                            .map((value) => Number(value.trim()))
                            .filter(Number.isFinite),
                        })
                      }
                    />
                  </label>
                )}
              </div>
            </details>
          </div>

          <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-[#E4E5E2] pt-6">
            <button
              type="button"
              className="rounded-md border border-[#989F43] px-4 py-2 text-sm font-semibold text-[#5B612A] disabled:opacity-50"
              disabled={busy !== null}
              onClick={saveDraft}
            >
              {busy === "save" ? "Salvando…" : "Salvar rascunho"}
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={busy !== null}
              onClick={generatePreview}
            >
              {busy === "preview" ? "Validando…" : "Validar e gerar prévia"}
            </button>
            <button
              type="button"
              className="rounded-md bg-[#292829] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              disabled={busy !== null || !preview}
              onClick={publishDraft}
            >
              {busy === "publish" ? "Publicando…" : "Publicar índice"}
            </button>
          </div>
        </section>

        {preview && (
          <section className="space-y-4">
            <div className="rounded-xl border border-[#E1E2DE] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-[#292829]">
                    Revisão gerada
                  </h2>
                  <p className="mt-1 text-sm text-[#666164]">
                    ID técnico:{" "}
                    <code>{preview.validation.inferred.panelLayerId}</code>
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Válida em{" "}
                  {new Date(preview.validation.validatedAt).toLocaleString(
                    "pt-BR",
                  )}
                </span>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-[#7E797B]">Períodos</dt>
                  <dd className="font-medium">
                    {preview.validation.inferred.periods.join(", ")}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#7E797B]">Periodicidade</dt>
                  <dd className="font-medium">
                    {preview.validation.inferred.timeScale ?? "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#7E797B]">Localidades</dt>
                  <dd className="font-medium">
                    {preview.validation.inferred.locations}
                  </dd>
                </div>
                <div>
                  <dt className="text-[#7E797B]">Municípios</dt>
                  <dd className="font-medium">
                    {preview.validation.inferred.municipalLocations}
                  </dd>
                </div>
              </dl>
              {preview.validation.warnings.length > 0 && (
                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-800">
                  {preview.validation.warnings.map((warning, index) => (
                    <li key={`${warning.code}-${index}`}>{warning.message}</li>
                  ))}
                </ul>
              )}
            </div>
            <CatalogMonitoringPreview preview={preview} />
          </section>
        )}
      </div>

      {deleteImpact && (
        <div
          className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/40 px-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeDeletion();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-index-title"
            className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl"
          >
            <h2
              id="delete-index-title"
              className="text-xl font-semibold text-[#292829]"
            >
              Remover “{deleteImpact.item.name}”?
            </h2>
            <p className="mt-3 text-sm text-[#666164]">
              Esta ação despublica o índice imediatamente e apaga do Contentful
              as entradas vinculadas. Ela não pode ser desfeita pela tela.
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-[#F7F7F4] p-4 text-sm">
              <div>
                <dt className="text-[#7E797B]">panelLayer</dt>
                <dd className="font-semibold">1</dd>
              </div>
              <div>
                <dt className="text-[#7E797B]">municipalAnalysis</dt>
                <dd className="font-semibold">
                  {deleteImpact.counts.municipalAnalysis}
                </dd>
              </div>
              <div>
                <dt className="text-[#7E797B]">municipalReportSeries</dt>
                <dd className="font-semibold">
                  {deleteImpact.counts.municipalReportSeries}
                </dd>
              </div>
              <div>
                <dt className="text-[#7E797B]">Total</dt>
                <dd className="font-semibold">{deleteImpact.counts.total}</dd>
              </div>
            </dl>
            <label className="mt-5 block text-sm font-medium text-[#292829]">
              Digite{" "}
              <code className="rounded bg-[#F1F1EE] px-1.5 py-0.5">
                {deleteImpact.item.panelLayerId}
              </code>{" "}
              para confirmar
              <input
                autoFocus
                className={inputClass}
                value={deleteConfirmation}
                onChange={(event) =>
                  setDeleteConfirmation(event.target.value)
                }
              />
            </label>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={busy === "delete"}
                onClick={closeDeletion}
                className="rounded-md border border-[#CFD0CA] px-4 py-2 text-sm font-semibold text-[#4F4B4D] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  busy === "delete" ||
                  deleteConfirmation !== deleteImpact.item.panelLayerId
                }
                onClick={removeIndex}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy === "delete"
                  ? "Removendo…"
                  : `Remover ${deleteImpact.counts.total} entrada(s)`}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
