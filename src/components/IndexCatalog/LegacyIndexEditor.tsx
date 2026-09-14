"use client";

import { useState } from "react";
import { CatalogMonitoringPreview } from "@/components/IndexCatalog/CatalogMonitoringPreview";
import { CatalogPreviewMapCapture } from "@/components/IndexCatalog/CatalogPreviewMapCapture";
import { LegacyAppearanceFields } from "@/components/IndexCatalog/LegacyAppearanceFields";
import { LegacyMapAssetFields } from "@/components/IndexCatalog/LegacyMapAssetFields";
import { CatalogReportPreview } from "@/components/IndexCatalog/CatalogReportPreview";
import { IndexCatalogReportFields } from "@/components/IndexCatalog/IndexCatalogReportFields";
import { PanelPositionField } from "@/components/IndexCatalog/PanelPositionField";
import {
  catalogApiRequest,
  catalogIdempotencyKey,
} from "@/components/IndexCatalog/catalogApiClient";
import {
  INDEX_CATEGORIES,
  isPresentationManagedCatalogConfig,
  type IndexCatalogItem,
  type IndexCatalogPresentationPreview,
  type IndexCategory,
} from "@/types/indexCatalog";
import {
  createEmptyReportDraft,
  isStoredReportText,
  toReportDraft,
  toReportTextPayload,
  type IndexCatalogReportDraft,
} from "@/utils/indexCatalogReportDraft";
import type { PublishedPanelLayerReportConfig } from "@/contracts/panelLayerReport";

const REPORT_INTRO =
  "Este índice hoje tira o texto do relatório de uma seção do Google Docs. O que for escrito aqui substitui essa seção — e um campo vazio devolve o texto ao documento. Use “Trazer o texto do Google Docs” para editar o texto que já está publicado em vez de começar de novo.";
const REPORT_SAVE_HINT =
  "Grava só os textos. Como o relatório lê a versão publicada do índice, o texto novo entra no relatório na próxima publicação.";

interface PresentationForm {
  name: string;
  description: string;
  category: IndexCategory;
  measurementUnit: string;
  panelPosition: string;
}

interface DocsTextResponse {
  sections: Array<{ title: string; text: string }>;
}

function toForm(item: IndexCatalogItem): PresentationForm {
  return {
    name: item.name,
    description: item.description,
    category:
      INDEX_CATEGORIES.find((category) => category === item.category) ??
      INDEX_CATEGORIES[0],
    measurementUnit: item.measurementUnit ?? "",
    panelPosition:
      item.panelPosition === undefined ? "" : String(item.panelPosition),
  };
}

/**
 * O texto gravado no catálogo, ou vazio.
 *
 * Vazio, e não o texto padrão do catálogo: num índice legado a narrativa mora
 * no Google Docs, e abrir com o padrão faria o primeiro salvamento substituir o
 * texto real por um genérico.
 */
function toInitialReport(item: IndexCatalogItem): IndexCatalogReportDraft {
  const config = item.catalogConfig;
  const stored = isPresentationManagedCatalogConfig(config)
    ? config.report
    : undefined;
  return stored ? toReportDraft(stored) : createEmptyReportDraft();
}

/**
 * Formulário de um índice legado adotado.
 *
 * Mostra somente o que o catálogo gerencia neste escopo — identidade, unidade,
 * posição, asset do mapa, legenda, imagem do cartão e texto do relatório. Não
 * há seção de fonte de estatísticas de propósito: os números deste índice vêm
 * das partições `municipalAnalysis` ou do registro estático, e gravar um
 * `statisticsSource` aqui desligaria essa origem sem volta
 * (`municipalAnalysisRepository`, que só cai para o Contentful quando a camada
 * não tem fonte dinâmica). O mapa é o caso oposto: ele já vem do Earth Engine,
 * e trocar o asset só muda qual imagem é desenhada.
 */
export function LegacyIndexEditor({
  item,
  items,
  inputClass,
  buttonClass,
  onChanged,
  onClose,
}: {
  item: IndexCatalogItem;
  /** Todos os índices do catálogo, para o aviso de posição já ocupada. */
  items: IndexCatalogItem[];
  inputClass: string;
  buttonClass: string;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PresentationForm>(() => toForm(item));
  const [report, setReport] = useState<IndexCatalogReportDraft>(() =>
    toInitialReport(item),
  );
  const [storedReport, setStoredReport] = useState<
    PublishedPanelLayerReportConfig | undefined
  >(() =>
    isPresentationManagedCatalogConfig(item.catalogConfig)
      ? item.catalogConfig.report
      : undefined,
  );
  const [preview, setPreview] =
    useState<IndexCatalogPresentationPreview | null>(null);
  // As classes do índice, para o formulário do relatório poder perguntar a
  // ordem de gravidade delas. Só chegam depois que a seção de legenda lê a
  // aparência gravada, e até lá a pergunta fica fora da tela.
  const [reportClasses, setReportClasses] = useState<
    ReadonlyArray<{ id: string; label: string }>
  >([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const entryPath = `/api/index-catalog/entries/${encodeURIComponent(item.entryId)}`;
  const draftPath = `/api/index-catalog/drafts/${encodeURIComponent(item.entryId)}`;

  async function run(action: string, operation: () => Promise<string>) {
    setBusy(action);
    setError("");
    try {
      setMessage(await operation());
    } catch (reason) {
      setMessage("");
      setError(reason instanceof Error ? reason.message : "A operação falhou.");
    } finally {
      setBusy(null);
    }
  }

  async function writeReportText() {
    const payload = toReportTextPayload(report);
    if (isStoredReportText(payload, storedReport)) return false;

    await catalogApiRequest(`${draftPath}/report-text`, {
      method: "POST",
      headers: {
        "Idempotency-Key": catalogIdempotencyKey("report-text", item.entryId),
      },
      body: JSON.stringify({ report: payload }),
    });
    setStoredReport(payload.sections.length ? payload : undefined);
    return true;
  }

  function save() {
    return run("save", async () => {
      await catalogApiRequest(`${entryPath}/presentation`, {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          panelPosition: form.panelPosition.trim(),
        }),
      });
      const wroteText = await writeReportText();
      setPreview(null);
      onChanged();
      return item.published
        ? `Alterações gravadas${wroteText ? ", texto do relatório incluído" : ""}. Publique para que elas apareçam na plataforma.`
        : "Alterações gravadas.";
    });
  }

  function loadPreview() {
    return run("preview", async () => {
      const loaded = await catalogApiRequest<IndexCatalogPresentationPreview>(
        `${entryPath}/presentation`,
      );
      setPreview(loaded);
      return `Prévia do período ${loaded.defaultPeriod} carregada.`;
    });
  }

  function importDocsText() {
    return run("docs-text", async () => {
      const loaded = await catalogApiRequest<DocsTextResponse>(
        `${entryPath}/docs-text`,
      );
      if (loaded.sections.length === 0) {
        throw new Error(
          `Não há bloco [${item.panelLayerId}] no Google Docs para trazer. Escreva as seções aqui mesmo.`,
        );
      }
      setReport((current) => ({ ...current, sections: loaded.sections }));
      return `${loaded.sections.length} seção(ões) trazida(s) do Google Docs. Nada foi gravado ainda: revise e salve.`;
    });
  }

  function publish() {
    return run("publish", async () => {
      await catalogApiRequest(entryPath, {
        method: "POST",
        headers: {
          "Idempotency-Key": catalogIdempotencyKey("publish", item.entryId),
        },
        body: JSON.stringify({ action: "publish" }),
      });
      onChanged();
      return "Índice publicado com as alterações.";
    });
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Editar índice legado</h2>
          <p className="mt-1 max-w-3xl text-sm text-stone-600">
            O catálogo gerencia a apresentação de <strong>{item.name}</strong>:
            identidade, unidade, posição, asset do mapa, legenda, imagem do
            cartão e texto do relatório. Os números continuam vindo de onde já
            vinham — a pipeline de CSV ou o registro estático —, então não há
            fonte de estatísticas a configurar aqui.
          </p>
          <p className="mt-2 text-xs text-stone-500">
            ID técnico: <code>{item.panelLayerId}</code> — congelado, porque
            telemetria, relatórios e caches usam esse ID como chave.
          </p>
        </div>
        <button
          type="button"
          className={`${buttonClass} border border-stone-300`}
          onClick={onClose}
        >
          Fechar
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-4 rounded-md border border-[#D6D89A] bg-[#F4F5D8] p-3 text-sm">
          {message}
        </p>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">
          Nome
          <input
            className={inputClass}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
          />
        </label>
        <label className="text-sm font-medium">
          Categoria
          <select
            className={inputClass}
            value={form.category}
            onChange={(event) =>
              setForm({
                ...form,
                category: event.target.value as IndexCategory,
              })
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
            value={form.description}
            onChange={(event) =>
              setForm({ ...form, description: event.target.value })
            }
          />
        </label>
        {/* A dica fica fora do <label> para o nome acessível do campo ser só
            "Unidade de medida", e não o parágrafo inteiro. */}
        <div>
          <label className="text-sm font-medium">
            Unidade de medida
            <input
              className={inputClass}
              value={form.measurementUnit}
              onChange={(event) =>
                setForm({ ...form, measurementUnit: event.target.value })
              }
            />
          </label>
          <p className="mt-1 text-xs text-stone-500">
            Rótulo de organização, guardado na ficha do índice. Ele não muda o
            que aparece na plataforma: a unidade que o painel de análise mostra
            ao lado do número vem do próprio conjunto de dados do índice, e este
            formulário ainda não a edita. Os legados usam “classes”, “%” e
            “registros” — mantenha o que este índice já tem.
          </p>
        </div>
        <PanelPositionField
          value={form.panelPosition}
          onChange={(panelPosition) => setForm({ ...form, panelPosition })}
          items={items}
          entryId={item.entryId}
          category={form.category}
          inputClass={inputClass}
        />
      </div>

      <LegacyMapAssetFields
        entryId={item.entryId}
        inputClass={inputClass}
        buttonClass={buttonClass}
        disabled={Boolean(busy)}
        onSaved={() => {
          // A prévia aberta foi desenhada com o asset anterior.
          setPreview(null);
          onChanged();
        }}
      />

      <LegacyAppearanceFields
        entryId={item.entryId}
        inputClass={inputClass}
        buttonClass={buttonClass}
        disabled={Boolean(busy)}
        onSaved={() => {
          // A prévia aberta foi desenhada com as cores anteriores; deixá-la na
          // tela depois de gravar mostraria um mapa que já não é o do índice.
          setPreview(null);
          onChanged();
        }}
        onClassesLoaded={setReportClasses}
      />

      <IndexCatalogReportFields
        report={report}
        classes={reportClasses}
        inputClass={inputClass}
        buttonClass={buttonClass}
        disabled={Boolean(busy)}
        intro={REPORT_INTRO}
        saveHint={REPORT_SAVE_HINT}
        extraActions={
          <button
            type="button"
            className="cursor-pointer rounded-md border border-[#CFD0CA] px-3 py-2 text-xs font-semibold hover:bg-[#F4F5D8] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={Boolean(busy)}
            onClick={() => void importDocsText()}
          >
            Trazer o texto do Google Docs
          </button>
        }
        onChange={setReport}
        onSave={() =>
          void run("report-text", async () => {
            const wrote = await writeReportText();
            onChanged();
            return wrote
              ? "Texto gravado. Publique o índice para que ele entre no relatório."
              : "O texto na tela já é o que está gravado.";
          })
        }
      />

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          className={`${buttonClass} border border-stone-300`}
          disabled={Boolean(busy)}
          onClick={() => void save()}
        >
          Salvar alterações
        </button>
        <button
          type="button"
          className={`${buttonClass} bg-[#E1E2B4]`}
          disabled={Boolean(busy)}
          onClick={() => void loadPreview()}
        >
          Gerar prévia
        </button>
        <button
          type="button"
          className={`${buttonClass} bg-[#989F43] text-white`}
          disabled={Boolean(busy)}
          onClick={() => void publish()}
        >
          {item.published ? "Republicar" : "Publicar"}
        </button>
      </div>
      {busy && <p className="mt-3 text-sm text-stone-600">Processando…</p>}

      {preview && (
        <div className="mt-6 space-y-4">
          <CatalogPreviewMapCapture
            preview={{
              entryId: preview.entryId,
              panelLayer: preview.panelLayer,
              period: preview.defaultPeriod,
            }}
          />
          {/* O mapa de verdade, com o painel lateral, como o índice vai ficar no
              Monitoramento. É a mesma prévia do escopo completo: sem ela, "Gerar
              prévia" num legado só mostrava a miniatura do cartão. */}
          <CatalogMonitoringPreview
            preview={{ panelLayer: preview.panelLayer }}
          />
          <CatalogReportPreview
            entryId={preview.entryId}
            tileApiPath={preview.panelLayer.tileApiPath}
          />
        </div>
      )}
    </section>
  );
}
