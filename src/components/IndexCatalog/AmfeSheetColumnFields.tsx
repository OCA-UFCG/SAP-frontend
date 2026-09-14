"use client";

import { useEffect, useState } from "react";
import { catalogApiRequest } from "@/components/IndexCatalog/catalogApiClient";
import type { AmfeSheetColumnStatisticsSource } from "@/contracts/amfeSheetColumn";
import type { ClassMapping } from "@/types/indexCatalog";
import {
  MAX_SUGGESTED_RANGE_COUNT,
  MIN_SUGGESTED_RANGE_COUNT,
  type SuggestedColumnClassification,
} from "@/utils/amfeSheetColumnRanges";

export interface AmfeSheetColumn {
  column: string;
  label: string;
  unit: string;
  description: string;
  valueCount: number;
  min: number | null;
  max: number | null;
}

interface AmfeSheetColumnsResponse {
  municipalityCount: number;
  columns: AmfeSheetColumn[];
}

const DEFAULT_SUGGESTED_RANGE_COUNT = 5;

function formatAmplitude(column: AmfeSheetColumn) {
  if (column.min === null || column.max === null) return "sem valores";
  const unit = column.unit ? ` ${column.unit}` : "";
  return `de ${column.min.toLocaleString("pt-BR")}${unit} a ${column.max.toLocaleString("pt-BR")}${unit}`;
}

/**
 * O formulário de um índice cujos valores vêm da planilha da análise
 * multicritério: qual coluna, sob que ano ela é publicada e como Brasil e UFs
 * saem dos municípios.
 *
 * As colunas são lidas da própria planilha, e não digitadas: quem cadastra
 * escolhe pelo nome que a análise multicritério já mostra, e o catálogo garante
 * que a coluna existe antes de qualquer validação.
 */
export function AmfeSheetColumnFields({
  source,
  inputClass,
  buttonClass,
  rangeCount,
  onChange,
  onColumnSelected,
  onSuggestedRanges,
}: {
  source: AmfeSheetColumnStatisticsSource;
  inputClass: string;
  buttonClass: string;
  rangeCount: number;
  onChange: (values: Partial<AmfeSheetColumnStatisticsSource>) => void;
  onColumnSelected: (column: AmfeSheetColumn) => void;
  onSuggestedRanges: (
    suggestion: SuggestedColumnClassification,
    ranges: ClassMapping[],
  ) => void;
}) {
  const [columns, setColumns] = useState<AmfeSheetColumn[]>([]);
  const [municipalityCount, setMunicipalityCount] = useState<number | null>(
    null,
  );
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestedCount, setSuggestedCount] = useState(
    rangeCount >= MIN_SUGGESTED_RANGE_COUNT
      ? rangeCount
      : DEFAULT_SUGGESTED_RANGE_COUNT,
  );

  useEffect(() => {
    let active = true;

    catalogApiRequest<AmfeSheetColumnsResponse>("/api/index-catalog/amfe-sheet")
      .then((result) => {
        if (!active) return;
        setColumns(result.columns);
        setMunicipalityCount(result.municipalityCount);
        setStatus("ready");
      })
      .catch((reason) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Falha ao ler a planilha da análise multicritério.",
        );
        setStatus("error");
      });

    return () => {
      active = false;
    };
  }, []);

  const selected = columns.find((column) => column.column === source.column);

  async function suggestRanges() {
    setSuggesting(true);
    setError("");
    try {
      const suggestion = await catalogApiRequest<SuggestedColumnClassification>(
        "/api/index-catalog/amfe-sheet/ranges",
        {
          method: "POST",
          body: JSON.stringify({
            column: source.column,
            classCount: suggestedCount,
          }),
        },
      );
      onSuggestedRanges(
        suggestion,
        suggestion.ranges.map((range, position) => ({
          classIndex: position,
          pixelValue: position,
          id: range.id,
          label: range.label,
          color: range.color,
        })),
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Falha ao calcular as faixas.",
      );
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <fieldset className="mt-7 rounded-lg border border-stone-200 p-4">
      <legend className="px-2 font-bold">Coluna da planilha</legend>
      <p className="text-xs text-stone-500">
        A mesma planilha que a Análise Multicritério usa
        {municipalityCount ? `, com ${municipalityCount} municípios` : ""}. Cada
        município recebe uma cor só, de acordo com o valor dele nesta coluna.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium md:col-span-2">
          Coluna
          <select
            className={inputClass}
            value={source.column}
            disabled={status !== "ready"}
            onChange={(event) => {
              const column = columns.find(
                (candidate) => candidate.column === event.target.value,
              );
              onChange({ column: event.target.value });
              if (column) onColumnSelected(column);
            }}
          >
            <option value="">
              {status === "loading"
                ? "Lendo a planilha…"
                : "Escolha uma coluna"}
            </option>
            {columns.map((column) => (
              <option key={column.column} value={column.column}>
                {column.label} ({column.column})
              </option>
            ))}
          </select>
          {selected && (
            <span className="mt-1 block text-xs font-normal text-stone-500">
              {selected.description ? `${selected.description} ` : ""}
              Valores {formatAmplitude(selected)}, em {selected.valueCount}{" "}
              município(s).
            </span>
          )}
        </label>

        <label className="text-sm font-medium">
          Ano de exibição
          <input
            className={inputClass}
            placeholder="2024"
            inputMode="numeric"
            value={source.periodKey}
            onChange={(event) => onChange({ periodKey: event.target.value })}
          />
          <span className="mt-1 block text-xs font-normal text-stone-500">
            A planilha não tem histórico: o índice aparece em Monitoramento
            neste ano e só nele, sem gráfico de série.
          </span>
        </label>

        <label className="text-sm font-medium">
          Como somar os municípios
          <select
            className={inputClass}
            value={source.aggregation}
            onChange={(event) =>
              onChange({
                aggregation: event.target.value as "sum" | "mean",
              })
            }
          >
            <option value="mean">
              Média dos municípios (percentuais, índices)
            </option>
            <option value="sum">Soma dos municípios (contagens, totais)</option>
          </select>
          <span className="mt-1 block text-xs font-normal text-stone-500">
            O valor de cada UF e o do Brasil saem daqui. Recortes de região,
            bioma, ASD e semiárido ficam sem valor nesta forma.
          </span>
        </label>
      </div>

      <div className="mt-4 rounded-lg bg-stone-50 p-4">
        <p className="text-sm font-semibold">Calcular as faixas pelo sistema</p>
        <p className="mt-1 text-xs text-stone-500">
          Divide o intervalo entre o menor e o maior valor da coluna em partes
          iguais e escreve os limites, os rótulos e as cores abaixo. Depois é só
          editar o que quiser antes de validar.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium">
            Quantidade de faixas
            <input
              className={`${inputClass} w-28`}
              type="number"
              min={MIN_SUGGESTED_RANGE_COUNT}
              max={MAX_SUGGESTED_RANGE_COUNT}
              value={suggestedCount}
              onChange={(event) =>
                setSuggestedCount(Number(event.target.value))
              }
            />
          </label>
          <button
            type="button"
            className={`${buttonClass} border border-stone-300`}
            disabled={!source.column || suggesting}
            onClick={() => void suggestRanges()}
          >
            {suggesting ? "Calculando…" : "Calcular faixas iguais"}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
    </fieldset>
  );
}
