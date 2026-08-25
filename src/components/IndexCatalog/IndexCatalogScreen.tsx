"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CatalogActionButton } from "@/components/IndexCatalog/CatalogActionButton";
import { CatalogEntryList } from "@/components/IndexCatalog/CatalogEntryList";
import { CatalogMonitoringPreview } from "@/components/IndexCatalog/CatalogMonitoringPreview";
import { CatalogPreviewMapCapture } from "@/components/IndexCatalog/CatalogPreviewMapCapture";
import { CatalogDeleteDialog } from "@/components/IndexCatalog/CatalogDeleteDialog";
import { CatalogValidationProgressPanel } from "@/components/IndexCatalog/CatalogValidationProgressPanel";
import { ClassesFieldset } from "@/components/IndexCatalog/ClassesFieldset";
import { IdentificationFieldset } from "@/components/IndexCatalog/IdentificationFieldset";
import { MapSourceFieldset } from "@/components/IndexCatalog/MapSourceFieldset";
import { StatisticsSourceFieldset } from "@/components/IndexCatalog/StatisticsSourceFieldset";
import {
  catalogApiRequest as apiRequest,
  catalogIdempotencyKey as idempotencyKey,
  type CatalogApiErrorBody as ApiErrorBody,
} from "@/components/IndexCatalog/catalogApiClient";
import { CATALOG_BUTTON_CLASS } from "@/components/IndexCatalog/catalogFormStyles";
import {
  advanceValidationProgress,
  type ValidationProgress,
} from "@/components/IndexCatalog/catalogValidationProgress";
import { useCatalogDraftEditor } from "@/components/IndexCatalog/useCatalogDraftEditor";
import { useCatalogEntryLifecycle } from "@/components/IndexCatalog/useCatalogEntryLifecycle";
import { IndexCatalogGuideModal } from "@/components/IndexCatalog/IndexCatalogGuideModal";
import { ImageCollectionForecastGuideModal } from "@/components/IndexCatalog/ImageCollectionForecastGuideModal";
import {
  isIndexCatalogConfigV2,
  type IndexCatalogItem,
  type IndexCatalogPreview,
} from "@/types/indexCatalog";

export function IndexCatalogScreen() {
  const [items, setItems] = useState<IndexCatalogItem[]>([]);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [forecastGuideOpen, setForecastGuideOpen] = useState(false);
  const [preview, setPreview] = useState<IndexCatalogPreview | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>("load");
  const [validationProgress, setValidationProgress] =
    useState<ValidationProgress | null>(null);
  const entryIdRef = useRef<string | null>(null);
  const createKeyRef = useRef<string | null>(null);
  const validationRunRef = useRef(0);
  const validationCompletionTimerRef = useRef<number | null>(null);

  const editingItem = entryId
    ? items.find((item) => item.entryId === entryId)
    : undefined;
  const editingConfig =
    editingItem && isIndexCatalogConfigV2(editingItem.catalogConfig)
      ? editingItem.catalogConfig
      : undefined;
  // Sem um período conhecido não há como reexibir um template como o endereço
  // concreto que o operador digitou.
  const lastValidatedPeriod =
    preview?.validation.inferred.periods.at(-1) ??
    editingConfig?.validation?.inferred.periods.at(-1);

  const editor = useCatalogDraftEditor({
    lastValidatedPeriod,
    onDraftChange: () => setPreview(null),
  });
  const { draft } = editor;

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

  const lifecycle = useCatalogEntryLifecycle({
    loadItems,
    setBusy,
    setMessage,
    setError,
    resetEditor: () => resetEditor(),
  });

  function resetEditor() {
    editor.reset();
    setEntryId(null);
    entryIdRef.current = null;
    createKeyRef.current = null;
    setPreview(null);
  }

  function resumeDraft(item: IndexCatalogItem) {
    if (!isIndexCatalogConfigV2(item.catalogConfig)) return;
    editor.loadFromConfig(item.catalogConfig);
    setEntryId(item.entryId);
    entryIdRef.current = item.entryId;
    createKeyRef.current = null;
    setPreview(null);
    setMessage(`“${item.name}” aberto para edição.`);
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
      const input = editor.normalizedDraft();
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
      editor.setSavedDraft(input);
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
      editor.applyValidatedClasses(
        result.panelLayer.imageData.classes.map((entry, position) => ({
          classIndex: indexes[position],
          id: entry.id,
          label: entry.label,
          color: entry.color,
          pixelValue: entry.pixelLimit ?? indexes[position],
        })),
      );
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
          className={`${CATALOG_BUTTON_CLASS} border border-[#989F43] bg-white text-[#62672D]`}
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

      <CatalogEntryList
        items={items}
        loading={busy === "load"}
        onResume={resumeDraft}
        onTogglePublication={(item) => void lifecycle.togglePublication(item)}
        onReviewDeletion={(item) => void lifecycle.reviewDeletion(item)}
      />

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="text-lg font-bold">
          {entryId ? "Editar índice" : "Cadastrar índice"}
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Preencha os passos na ordem: o passo 4 só tem conteúdo depois de
          validar os assets, porque as classes vêm da tabela do GEE.
        </p>

        <IdentificationFieldset
          name={draft.name}
          onNameChange={(name) => editor.updateDraft("name", name)}
          category={draft.category}
          onCategoryChange={(category) =>
            editor.updateDraft("category", category)
          }
          description={draft.description}
          onDescriptionChange={(description) =>
            editor.updateDraft("description", description)
          }
          technicalId={editingItem?.panelLayerId}
          technicalIdFrozen={editingItem?.everPublished}
        />

        <StatisticsSourceFieldset
          source={draft.statisticsSource}
          {...editor.statistics}
        />

        <MapSourceFieldset
          {...editor.map}
          classCount={draft.classes.length}
          onOpenForecastGuide={() => setForecastGuideOpen(true)}
        />

        <ClassesFieldset
          {...editor.classes}
          onValidate={() => void validateAndPreview()}
          disabled={Boolean(busy)}
        />

        <div className="mt-6 flex flex-wrap gap-3">
          <CatalogActionButton
            className={`${CATALOG_BUTTON_CLASS} border border-stone-300`}
            disabled={Boolean(busy)}
            onClick={() => void saveDraft()}
            description="Guarda as informações preenchidas para você continuar depois. O índice ainda não aparece no Monitoramento."
          >
            Salvar rascunho
          </CatalogActionButton>
          <CatalogActionButton
            className={`${CATALOG_BUTTON_CLASS} bg-[#E1E2B4]`}
            disabled={Boolean(busy)}
            onClick={() => void validateAndPreview()}
            description="Confere se os dados e mapas podem ser usados e mostra uma prévia privada. O índice ainda não aparece no Monitoramento."
          >
            Validar assets e gerar prévia
          </CatalogActionButton>
          <CatalogActionButton
            className={`${CATALOG_BUTTON_CLASS} bg-[#989F43] text-white`}
            disabled={Boolean(busy) || !preview}
            onClick={() => void publishDraft()}
            description="Faz uma última conferência e disponibiliza o índice no Monitoramento. Os dados continuam guardados no Google Earth Engine."
          >
            Publicar
          </CatalogActionButton>
        </div>
        {validationProgress && (
          <CatalogValidationProgressPanel progress={validationProgress} />
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
        </section>
      )}

      {lifecycle.deleteImpact && (
        <CatalogDeleteDialog
          impact={lifecycle.deleteImpact}
          confirmation={lifecycle.deleteConfirmation}
          onConfirmationChange={lifecycle.setDeleteConfirmation}
          onCancel={lifecycle.cancelDeletion}
          onConfirm={() => void lifecycle.removeIndex()}
          removing={busy === "delete"}
        />
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
