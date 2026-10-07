"use client";

import { useEffect, useRef, useState } from "react";

import { ClassColorField } from "@/components/IndexCatalog/ClassColorField";
import { catalogApiRequest } from "@/components/IndexCatalog/catalogApiClient";
import { parseNumberList } from "@/utils/indexCatalog";
import type {
  LegacyAppearance,
  LegacyAppearanceRow,
} from "@/utils/legacyAppearance";

interface AppearanceResponse {
  panelLayerId: string;
  appearance: LegacyAppearance;
  periodCount: number;
  changed?: string;
}

interface AppearanceDraft {
  legend: LegacyAppearanceRow[];
  series?: LegacyAppearanceRow[];
  thresholds: string;
}

function toDraft(appearance: LegacyAppearance): AppearanceDraft {
  return {
    legend: appearance.legend.map((row) => ({ ...row })),
    ...(appearance.series
      ? { series: appearance.series.map((row) => ({ ...row })) }
      : {}),
    thresholds: (appearance.thresholds ?? []).join(", "),
  };
}

/**
 * As classes que o relatório conhece, que nem sempre são as linhas da legenda:
 * num índice de valor único as faixas coloridas do mapa moram em
 * `mapVisualization.legend` e a série medida é que está em `classes`. É por
 * essas que a ordem de gravidade do relatório é declarada.
 */
function toReportClasses(appearance: LegacyAppearance) {
  return (appearance.series ?? appearance.legend).map(({ id, label }) => ({
    id,
    label,
  }));
}

function replaceRow(
  rows: LegacyAppearanceRow[],
  index: number,
  patch: Partial<LegacyAppearanceRow>,
) {
  return rows.map((row, position) =>
    position === index ? { ...row, ...patch } : row,
  );
}

function AppearanceRows({
  rows,
  groupLabel,
  inputClass,
  onChange,
}: {
  rows: LegacyAppearanceRow[];
  groupLabel: string;
  inputClass: string;
  onChange: (index: number, patch: Partial<LegacyAppearanceRow>) => void;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div
          key={row.id}
          className="grid items-end gap-3 md:grid-cols-[1fr_260px]"
        >
          <label className="text-xs font-medium">
            Rótulo
            <input
              aria-label={`Rótulo da ${groupLabel} ${index + 1}`}
              className={inputClass}
              value={row.label}
              onChange={(event) =>
                onChange(index, { label: event.target.value })
              }
            />
          </label>
          <ClassColorField
            color={row.color}
            inputClass={inputClass}
            label={`${groupLabel} ${index + 1}`}
            onChange={(color) => onChange(index, { color })}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Rótulos, cores e limites de um índice legado adotado.
 *
 * Carrega a aparência gravada por conta própria em vez de recebê-la pronta: o
 * `imageData` de um legado chega a 200 KB de valores territoriais, e a tela só
 * precisa das linhas da legenda. O que é gravado também são só as linhas — o
 * servidor aplica a alteração em cima do objeto que está no Contentful.
 *
 * A quantidade de linhas é fixa por um motivo de dados, não de interface: os
 * valores de cada período são listas na ordem das classes, então criar ou
 * remover uma linha desalinharia todos os números já publicados.
 */
export function LegacyAppearanceFields({
  entryId,
  inputClass,
  buttonClass,
  disabled,
  onSaved,
  onClassesLoaded,
}: {
  entryId: string;
  inputClass: string;
  buttonClass: string;
  disabled: boolean;
  onSaved: () => void;
  /**
   * As classes lidas do `imageData`, para o formulário do relatório poder
   * perguntar a ordem de gravidade delas. Vem daqui porque é esta seção que já
   * carrega a aparência do legado, e carregá-la duas vezes traria 200 KB de
   * valores territoriais de novo.
   */
  onClassesLoaded?: (
    classes: ReadonlyArray<{ id: string; label: string }>,
  ) => void;
}) {
  const [loaded, setLoaded] = useState<AppearanceResponse | null>(null);
  const [draft, setDraft] = useState<AppearanceDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  // Referência, e não dependência do efeito: um callback recriado a cada
  // render do pai recarregaria a aparência inteira a cada tecla digitada.
  const onClassesLoadedRef = useRef(onClassesLoaded);

  useEffect(() => {
    onClassesLoadedRef.current = onClassesLoaded;
  }, [onClassesLoaded]);

  useEffect(() => {
    let active = true;
    catalogApiRequest<AppearanceResponse>(
      `/api/index-catalog/entries/${encodeURIComponent(entryId)}/appearance`,
    )
      .then((response) => {
        if (!active) return;
        setLoaded(response);
        setDraft(toDraft(response.appearance));
        onClassesLoadedRef.current?.(toReportClasses(response.appearance));
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível ler a legenda deste índice.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [entryId]);

  async function save() {
    if (!draft || !loaded) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const thresholds = loaded.appearance.thresholds
        ? parseNumberList(draft.thresholds, "Limites do mapa")
        : undefined;
      const response = await catalogApiRequest<AppearanceResponse>(
        `/api/index-catalog/entries/${encodeURIComponent(entryId)}/appearance`,
        {
          method: "PUT",
          body: JSON.stringify({
            legend: draft.legend,
            ...(draft.series ? { series: draft.series } : {}),
            ...(thresholds ? { thresholds } : {}),
          }),
        },
      );
      setLoaded(response);
      setDraft(toDraft(response.appearance));
      onClassesLoadedRef.current?.(toReportClasses(response.appearance));
      setStatus(
        response.changed === "nada"
          ? "A legenda na tela já é a que está gravada."
          : `Gravado: ${response.changed}. Publique o índice para que a alteração apareça no mapa.`,
      );
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Não foi possível gravar.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="mt-7 rounded-lg border border-stone-200 p-4">
      <legend className="px-2 font-bold">Legenda e cores</legend>
      {error && (
        <p className="mb-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}
      {!draft || !loaded ? (
        <p className="text-sm text-stone-500">
          {error ? "" : "Lendo a legenda gravada…"}
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-stone-600">
            Estes rótulos e cores valem para os {loaded.periodCount} períodos do
            índice, no mapa, na legenda, no painel de análise e no relatório. A
            quantidade de linhas não muda: os valores de cada período estão
            gravados na ordem delas.
          </p>
          <AppearanceRows
            rows={draft.legend}
            groupLabel="faixa"
            inputClass={inputClass}
            onChange={(index, patch) =>
              setDraft((current) =>
                current
                  ? {
                      ...current,
                      legend: replaceRow(current.legend, index, patch),
                    }
                  : current,
              )
            }
          />
          {draft.series && (
            <div className="mt-6">
              <p className="text-sm font-semibold">Série medida</p>
              <p className="mb-3 text-xs text-stone-500">
                O nome do que este índice mede, usado no painel de análise e no
                gráfico. As faixas acima são as cores do mapa.
              </p>
              <AppearanceRows
                rows={draft.series}
                groupLabel="série"
                inputClass={inputClass}
                onChange={(index, patch) =>
                  setDraft((current) =>
                    current?.series
                      ? {
                          ...current,
                          series: replaceRow(current.series, index, patch),
                        }
                      : current,
                  )
                }
              />
            </div>
          )}
          {loaded.appearance.thresholds && (
            <div className="mt-6">
              <label className="text-xs font-medium">
                Limites entre as faixas
                <input
                  className={inputClass}
                  value={draft.thresholds}
                  onChange={(event) =>
                    setDraft((current) =>
                      current
                        ? { ...current, thresholds: event.target.value }
                        : current,
                    )
                  }
                />
              </label>
              <p className="mt-1 text-xs text-stone-500">
                {loaded.appearance.thresholds.length} números em ordem
                crescente, separados por vírgula, na unidade do asset
                {loaded.appearance.thresholdUnit
                  ? ` (${loaded.appearance.thresholdUnit})`
                  : ""}
                . São eles que decidem qual faixa cada valor recebe no mapa — a
                quantidade não pode mudar.
              </p>
            </div>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={`${buttonClass} border border-stone-300`}
              disabled={disabled || busy}
              onClick={() => void save()}
            >
              Salvar legenda e cores
            </button>
            {status && <span className="text-sm text-stone-600">{status}</span>}
          </div>
        </>
      )}
    </fieldset>
  );
}
