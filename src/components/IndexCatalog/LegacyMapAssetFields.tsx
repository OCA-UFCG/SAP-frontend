"use client";

import { useEffect, useState } from "react";

import { catalogApiRequest } from "@/components/IndexCatalog/catalogApiClient";
import type {
  LegacyMapAssetRow,
  LegacyMapAssets,
} from "@/utils/legacyMapAssets";

interface MapAssetsResponse {
  panelLayerId: string;
  assets: LegacyMapAssets;
  changed?: string;
}

function periodLabel(row: LegacyMapAssetRow) {
  return row.year && row.year !== row.period
    ? `${row.period} (${row.year})`
    : row.period;
}

function SharedAssetField({
  value,
  count,
  inputClass,
  onChange,
}: {
  value: string;
  count: number;
  inputClass: string;
  onChange: (imageId: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium">
        Asset usado pelos {count} períodos
        <input
          className={inputClass}
          value={value}
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <p className="mt-1 text-xs text-stone-500">
        Este índice desenha todos os períodos com a mesma imagem, então trocar
        aqui troca o mapa inteiro.
      </p>
    </div>
  );
}

function PerPeriodAssetFields({
  rows,
  inputClass,
  onChange,
}: {
  rows: LegacyMapAssetRow[];
  inputClass: string;
  onChange: (period: string, imageId: string) => void;
}) {
  return (
    // A altura é limitada porque um índice mensal longo tem centenas de
    // períodos (o CDI tem 301), e a lista inteira empurraria os botões de
    // salvar e publicar para fora da tela.
    <div className="max-h-96 space-y-2 overflow-y-auto pr-2">
      {rows.map((row) => (
        <label
          key={row.period}
          className="grid items-center gap-2 md:grid-cols-[10rem_1fr]"
        >
          <span className="text-xs font-medium">{periodLabel(row)}</span>
          <input
            className={inputClass}
            value={row.imageId}
            spellCheck={false}
            onChange={(event) => onChange(row.period, event.target.value)}
          />
        </label>
      ))}
    </div>
  );
}

/**
 * Troca o asset do Earth Engine que desenha o mapa de cada período.
 *
 * É a única parte de um índice legado que já vem do Earth Engine: as
 * estatísticas continuam vindo do Contentful, e por isso não há campo de fonte
 * de estatísticas aqui. Períodos não são criados nem removidos — um período sem
 * partição no Contentful apareceria no mapa com o painel de análise vazio.
 */
export function LegacyMapAssetFields({
  entryId,
  inputClass,
  buttonClass,
  disabled,
  onSaved,
}: {
  entryId: string;
  inputClass: string;
  buttonClass: string;
  disabled: boolean;
  onSaved: () => void;
}) {
  const [loaded, setLoaded] = useState<MapAssetsResponse | null>(null);
  const [rows, setRows] = useState<LegacyMapAssetRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    catalogApiRequest<MapAssetsResponse>(
      `/api/index-catalog/entries/${encodeURIComponent(entryId)}/map-assets`,
    )
      .then((response) => {
        if (!active) return;
        setLoaded(response);
        setRows(response.assets.rows.map((row) => ({ ...row })));
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Não foi possível ler os assets do mapa deste índice.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [entryId]);

  function setRowAsset(period: string, imageId: string) {
    setRows(
      (current) =>
        current?.map((row) =>
          row.period === period ? { ...row, imageId } : row,
        ) ?? null,
    );
  }

  function setAllAssets(imageId: string) {
    setRows((current) => current?.map((row) => ({ ...row, imageId })) ?? null);
  }

  async function save() {
    if (!rows) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const response = await catalogApiRequest<MapAssetsResponse>(
        `/api/index-catalog/entries/${encodeURIComponent(entryId)}/map-assets`,
        {
          method: "PUT",
          body: JSON.stringify({
            assets: rows.map((row) => ({
              period: row.period,
              imageId: row.imageId,
            })),
          }),
        },
      );
      setLoaded(response);
      setRows(response.assets.rows.map((row) => ({ ...row })));
      setStatus(
        response.changed === "nada"
          ? "Os assets na tela já são os que estão gravados."
          : `Gravado: ${response.changed}. Gere a prévia para conferir o mapa e publique o índice para que a troca entre no ar.`,
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
      <legend className="px-2 font-bold">Asset do mapa</legend>
      {error && (
        <p className="mb-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}
      {!rows || !loaded ? (
        <p className="text-sm text-stone-500">
          {error ? "" : "Lendo os assets gravados…"}
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm text-stone-600">
            A imagem que o Earth Engine desenha no mapa deste índice. Os números
            do painel de análise não vêm daqui — eles continuam vindo do
            Contentful. Os períodos são fixos: o catálogo troca a imagem de um
            período, mas não cria nem remove período.
          </p>
          {loaded.assets.sharedImageId !== undefined ? (
            <SharedAssetField
              value={rows[0].imageId}
              count={rows.length}
              inputClass={inputClass}
              onChange={setAllAssets}
            />
          ) : (
            <PerPeriodAssetFields
              rows={rows}
              inputClass={inputClass}
              onChange={setRowAsset}
            />
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={`${buttonClass} border border-stone-300`}
              disabled={disabled || busy}
              onClick={() => void save()}
            >
              Salvar assets do mapa
            </button>
            {status && <span className="text-sm text-stone-600">{status}</span>}
          </div>
        </>
      )}
    </fieldset>
  );
}
