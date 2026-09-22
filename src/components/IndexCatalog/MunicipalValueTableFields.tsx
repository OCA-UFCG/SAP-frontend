"use client";

import type { ReactNode } from "react";

import { ClassColorField } from "@/components/IndexCatalog/ClassColorField";
import type {
  ClassMapping,
  MunicipalValueIndicator,
} from "@/types/indexCatalog";

/**
 * Descreve o número que o painel mostra num índice de valor único.
 *
 * O rótulo e a unidade não são enfeite: as frases do painel ("Registros de
 * secas e estiagens em Paraíba: 34 registros.") e o título do ranking são
 * montados a partir deles na validação.
 */
export function MunicipalValueIndicatorFields({
  indicator,
  inputClass,
  onChange,
}: {
  indicator: MunicipalValueIndicator;
  inputClass: string;
  onChange: (values: Partial<MunicipalValueIndicator>) => void;
}) {
  return (
    <fieldset className="mt-7 rounded-lg border border-stone-200 p-4">
      <legend className="px-2 font-bold">Indicador</legend>
      <p className="text-xs text-stone-500">
        O número que aparece no painel de análise para cada território.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">
          Nome do indicador
          <input
            className={inputClass}
            placeholder="Registros de secas e estiagens"
            value={indicator.label}
            onChange={(event) => onChange({ label: event.target.value })}
          />
          <span className="mt-1 block text-xs font-normal text-stone-500">
            Entra nas frases do painel e no título do ranking de estados.
          </span>
        </label>
        <label className="text-sm font-medium">
          Unidade
          <input
            className={inputClass}
            placeholder="registros"
            value={indicator.measurementUnit}
            onChange={(event) =>
              onChange({ measurementUnit: event.target.value })
            }
          />
          <span className="mt-1 block text-xs font-normal text-stone-500">
            Escreva como aparece ao lado do número: %, registros, pessoas.
          </span>
        </label>
        <label className="text-sm font-medium">
          Formato do número
          <select
            className={inputClass}
            value={indicator.valueType}
            onChange={(event) =>
              onChange({
                valueType: event.target
                  .value as MunicipalValueIndicator["valueType"],
              })
            }
          >
            <option value="percentage">Percentual (70,3)</option>
            <option value="absolute">Contagem (1.482)</option>
          </select>
          <span className="mt-1 block text-xs font-normal text-stone-500">
            Percentual mostra uma casa decimal; contagem usa separador de
            milhar.
          </span>
        </label>
        <ClassColorField
          color={indicator.color}
          inputClass={inputClass}
          label="do indicador"
          onChange={(color) => onChange({ color })}
        />
      </div>
    </fieldset>
  );
}

/**
 * As faixas de cor do mapa de um índice de valor único.
 *
 * São da legenda do mapa, e não da estatística: o painel mostra um número só
 * por território, e as faixas existem para pintar o município conforme esse
 * número.
 *
 * `methodSlot` é o cálculo das faixas pelos próprios dados, e fica dentro deste
 * bloco de propósito: é o campo de limites logo abaixo dele que ele preenche.
 * O que o cálculo escreve continua editável, porque quem publica é quem decide
 * onde cada faixa começa.
 */
export function ValueRangeFields({
  ranges,
  thresholdsInput,
  inputClass,
  methodSlot,
  buttonClass,
  onChangeRange,
  onChangeRanges,
  onChangeThresholds,
}: {
  ranges: ClassMapping[];
  thresholdsInput: string;
  inputClass: string;
  buttonClass: string;
  /** O cálculo das faixas pelos dados, desenhado acima do campo de limites. */
  methodSlot?: ReactNode;
  onChangeRange: (index: number, values: Partial<ClassMapping>) => void;
  onChangeRanges: (ranges: ClassMapping[]) => void;
  onChangeThresholds: (value: string) => void;
}) {
  /**
   * O `id` da faixa não aparece no formulário, mas o cadastro recusa dois iguais
   * ("As classes não podem ter índices ou IDs duplicados"). Remover uma faixa
   * renumera a posição e não o `id`, então contar as faixas para nomear a
   * próxima repetia um nome já usado — apagar a faixa do meio de três e
   * acrescentar outra travava o salvamento sem nada na tela para corrigir.
   */
  function nextRangeId() {
    const used = new Set(ranges.map((range) => range.id));
    for (let position = ranges.length + 1; ; position += 1) {
      const candidate = `faixa-${position}`;
      if (!used.has(candidate)) return candidate;
    }
  }

  function addRange() {
    onChangeRanges([
      ...ranges,
      {
        classIndex: ranges.length,
        id: nextRangeId(),
        label: "",
        color: "#CCCCCC",
        pixelValue: ranges.length,
      },
    ]);
  }

  function removeRange(index: number) {
    onChangeRanges(
      ranges
        .filter((_range, position) => position !== index)
        .map((range, position) => ({
          ...range,
          classIndex: position,
          pixelValue: position,
        })),
    );
  }

  return (
    <fieldset className="mt-7 rounded-lg border border-stone-200 p-4">
      <legend className="px-2 font-bold">Faixas de cor do mapa</legend>
      <p className="text-xs text-stone-500">
        Da menor para a maior. Cada faixa é uma cor no mapa e uma linha na
        legenda.
      </p>
      {methodSlot}
      <label className="mt-4 block text-sm font-medium">
        Limites entre as faixas
        <input
          className={inputClass}
          placeholder="6, 12, 18, 24"
          value={thresholdsInput}
          onChange={(event) => onChangeThresholds(event.target.value)}
        />
        <span className="mt-1 block text-xs font-normal text-stone-500">
          Na unidade do indicador, em ordem crescente e um a menos que a
          quantidade de faixas — {Math.max(0, ranges.length - 1)} limite(s) para
          as {ranges.length} faixas atuais. Um município com valor igual ao
          limite entra na faixa de cima.
        </span>
      </label>
      <div className="mt-4 space-y-3">
        {ranges.map((range, index) => (
          <div
            key={index}
            className="grid items-end gap-3 md:grid-cols-[1fr_260px_auto]"
          >
            <label className="text-xs font-medium">
              Rótulo da faixa {index + 1}
              <input
                className={inputClass}
                placeholder={index === 0 ? "0 a 6" : "> 6 a 12"}
                value={range.label}
                onChange={(event) =>
                  onChangeRange(index, { label: event.target.value })
                }
              />
            </label>
            <ClassColorField
              color={range.color}
              inputClass={inputClass}
              label={`faixa ${index + 1}`}
              onChange={(color) => onChangeRange(index, { color })}
            />
            <button
              type="button"
              className={`${buttonClass} border border-stone-300`}
              onClick={() => removeRange(index)}
            >
              Remover
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className={`${buttonClass} mt-4 border border-stone-300`}
        onClick={addRange}
      >
        Adicionar faixa
      </button>
    </fieldset>
  );
}
