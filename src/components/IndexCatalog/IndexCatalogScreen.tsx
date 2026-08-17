"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CatalogMonitoringPreview } from "@/components/IndexCatalog/CatalogMonitoringPreview";
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

interface ApiErrorBody {
  error?: string;
  validation?: IndexCatalogPreview["validation"];
}

async function apiRequest<T>(path: string, options: RequestInit = {}) {
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

export function IndexCatalogScreen() {
  const [items, setItems] = useState<IndexCatalogItem[]>([]);
  const [draft, setDraft] = useState<IndexCatalogDraftInput>(EMPTY_DRAFT);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [periodAssetsText, setPeriodAssetsText] = useState("");
  const [preview, setPreview] = useState<IndexCatalogPreview | null>(null);
  const [deleteImpact, setDeleteImpact] =
    useState<IndexCatalogLifecycleImpact | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>("load");
  const entryIdRef = useRef<string | null>(null);
  const createKeyRef = useRef<string | null>(null);

  const loadItems = useCallback(async () => {
    const result = await apiRequest<{ items: IndexCatalogItem[] }>(
      "/api/index-catalog",
    );
    setItems(result.items);
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
    };
  }, []);

  function resetEditor() {
    setDraft(structuredClone(EMPTY_DRAFT));
    setEntryId(null);
    entryIdRef.current = null;
    createKeyRef.current = null;
    setPeriodAssetsText("");
    setPreview(null);
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
      earthEngine: config.earthEngine,
    });
    setEntryId(item.entryId);
    entryIdRef.current = item.entryId;
    createKeyRef.current = null;
    setPeriodAssetsText(
      serializeAssetsByPeriod(config.earthEngine.assetsByPeriod),
    );
    setPreview(null);
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
    return {
      ...draft,
      earthEngine: {
        ...draft.earthEngine,
        ...(draft.earthEngine.strategy === "perPeriod"
          ? { assetsByPeriod: parseAssetsByPeriod(periodAssetsText) }
          : {}),
      },
    };
  }

  async function saveDraft() {
    setBusy("save");
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
      setMessage("Rascunho salvo. Nada foi publicado.");
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
      setBusy(null);
    }
  }

  async function revalidateAndPreview() {
    const savedEntryId = await saveDraft();
    if (!savedEntryId) return;
    setBusy("preview");
    setMessage(
      "Validando FeatureCollections, períodos, classes, percentuais e assets de mapa…",
    );
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
        "Assets revalidados. A prévia usa o GEE diretamente e continua privada.",
      );
      await loadItems();
    } catch (reason) {
      const validation = (reason as ApiErrorBody).validation;
      setPreview(null);
      setError(
        [
          reason instanceof Error ? reason.message : "Falha na validação.",
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
    setMessage("Revalidando os assets e publicando somente o panelLayer…");
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
      resetEditor();
      setMessage("Índice publicado no Monitoramento sem copiar estatísticas.");
      await loadItems();
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
          className={`${buttonClass} bg-[#292829] text-white`}
          onClick={resetEditor}
        >
          Novo índice
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
                value={draft.statisticsSource.asset.type}
                onChange={(event) =>
                  updateStatisticsAsset(
                    event.target.value === "fixed"
                      ? { type: "fixed", assetId: "" }
                      : { type: "period-template", assetIdTemplate: "" },
                  )
                }
              >
                <option value="fixed">FeatureCollection única</option>
                <option value="period-template">Template por período</option>
              </select>
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
            </label>
            <label className="text-sm font-medium md:col-span-2">
              {draft.statisticsSource.asset.type === "fixed"
                ? "ID da FeatureCollection"
                : "Template da FeatureCollection"}
              <input
                className={inputClass}
                placeholder={
                  draft.statisticsSource.asset.type === "fixed"
                    ? "projects/projeto/assets/estatisticas"
                    : "projects/projeto/assets/estatisticas_{year}"
                }
                value={
                  draft.statisticsSource.asset.type === "fixed"
                    ? draft.statisticsSource.asset.assetId
                    : draft.statisticsSource.asset.assetIdTemplate
                }
                onChange={(event) =>
                  updateStatisticsAsset(
                    draft.statisticsSource.asset.type === "fixed"
                      ? { type: "fixed", assetId: event.target.value }
                      : {
                          type: "period-template",
                          assetIdTemplate: event.target.value,
                        },
                  )
                }
              />
              <span className="mt-1 block text-xs font-normal text-stone-500">
                Templates aceitam {"{year}"}, {"{month}"} e {"{period}"}.
              </span>
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
                onChange={(event) =>
                  updateMap({
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
            <label className="text-sm font-medium">
              Organização
              <select
                className={inputClass}
                value={draft.earthEngine.strategy}
                onChange={(event) =>
                  updateMap({
                    strategy: event.target.value as "single" | "perPeriod",
                  })
                }
              >
                <option value="single">Asset único</option>
                <option value="perPeriod">Por período</option>
              </select>
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
              <>
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
                <label className="text-sm font-medium md:col-span-2">
                  Exceções por período (opcional, uma por linha)
                  <textarea
                    className={inputClass}
                    rows={3}
                    placeholder="2025=projects/projeto/assets/mapa_2025"
                    value={periodAssetsText}
                    onChange={(event) => {
                      setPeriodAssetsText(event.target.value);
                      setPreview(null);
                    }}
                  />
                </label>
              </>
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
          </div>
        </fieldset>

        <fieldset className="mt-7 rounded-lg border border-stone-200 p-4">
          <legend className="px-2 font-bold">Classes</legend>
          {draft.classes.length === 0 ? (
            <p className="text-sm text-stone-500">
              Clique em “Revalidar assets” para inferir os índices de
              perc_classe_XX e area_ha_classe_XX.
            </p>
          ) : (
            <div className="space-y-3">
              {draft.classes.map((entry, index) => (
                <div
                  key={entry.classIndex}
                  className="grid items-end gap-3 md:grid-cols-[110px_1fr_110px]"
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
                  <label className="text-xs font-medium">
                    Cor
                    <input
                      className={`${inputClass} h-10 p-1`}
                      type="color"
                      value={entry.color}
                      onChange={(event) =>
                        updateClass(index, {
                          color: event.target.value.toUpperCase(),
                        })
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs text-stone-500">
            O valor é sempre percentual e a unidade é sempre % nesta versão.
          </p>
        </fieldset>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            className={`${buttonClass} border border-stone-300`}
            disabled={Boolean(busy)}
            onClick={() => void saveDraft()}
          >
            Salvar rascunho
          </button>
          <button
            type="button"
            className={`${buttonClass} bg-[#E1E2B4]`}
            disabled={Boolean(busy)}
            onClick={() => void revalidateAndPreview()}
          >
            Revalidar assets e gerar prévia
          </button>
          <button
            type="button"
            className={`${buttonClass} bg-[#989F43] text-white`}
            disabled={Boolean(busy) || !preview}
            onClick={() => void publishDraft()}
          >
            Publicar panelLayer
          </button>
        </div>
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
          <CatalogMonitoringPreview preview={preview} />
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
    </div>
  );
}
