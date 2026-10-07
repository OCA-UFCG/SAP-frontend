"use client";

import { useMemo, useState } from "react";
import { catalogApiRequest } from "@/components/IndexCatalog/catalogApiClient";
import {
  CLASSIFICATION_METHOD_OPTIONS,
  DEVIATION_INTERVAL_OPTIONS,
  findClassificationMethodOption,
} from "@/components/IndexCatalog/classificationMethodOptions";
import type { MunicipalSpreadsheetStatisticsSource } from "@/contracts/municipalSpreadsheet";
import type { DraftClassificationSample } from "@/types/indexCatalog";
import {
  computeClassBreaks,
  type ClassBreaksResult,
  type ClassificationMethodId,
} from "@/utils/classificationBreaks";
import { DEFAULT_RANGE_COUNT } from "@/utils/valueLegendRanges";

const ORIGIN_DESCRIPTION: Record<DraftClassificationSample["origin"], string> =
  {
    spreadsheet: "valores da planilha",
    municipalValueTable: "valores da tabela do Earth Engine",
    raster: "pixels sorteados do raster",
  };

interface ClassificationMethodFieldsProps {
  entryId: string | null;
  /**
   * A planilha do formulário, quando o índice é de planilha. Com ela os valores
   * são lidos do próprio link colado, sem exigir rascunho salvo nem validação —
   * é o que o antigo botão "Detectar faixas da planilha" fazia.
   */
  spreadsheetSource?: MunicipalSpreadsheetStatisticsSource | null;
  /** Períodos descobertos na validação; o primeiro é lido por padrão. */
  periods: string[];
  /** Quantas faixas a legenda tem hoje. */
  classCount: number;
  /**
   * Se a tela pode mudar a quantidade de faixas. É `false` num índice
   * classificatório, em que as classes vêm das colunas `perc_classe_XX` da
   * tabela de estatísticas e o catálogo recusa um número diferente de limites.
   */
  canChangeClassCount: boolean;
  inputClass: string;
  buttonClass: string;
  onApply: (thresholds: number[], classCount: number) => void;
}

/**
 * Calcula os limites entre as faixas do mapa por um método de classificação, em
 * vez de exigir que o operador descubra os cortes na mão.
 *
 * Mora **dentro** do bloco de faixas, logo acima do campo de limites que
 * preenche: enquanto era um bloco irmão com moldura própria, parecia mais uma
 * configuração do índice, e a relação com os campos de cima — que é toda a
 * função dele — precisava ser adivinhada.
 *
 * O resultado é escrito no mesmo campo de limites de sempre: o método é uma
 * ajuda para preencher o campo e não é gravado no Contentful, então um limite
 * gerado pode ser corrigido à mão depois sem nenhuma amarra.
 */
export function ClassificationMethodFields({
  entryId,
  spreadsheetSource,
  periods,
  classCount,
  canChangeClassCount,
  inputClass,
  buttonClass,
  onApply,
}: ClassificationMethodFieldsProps) {
  const [chosenPeriod, setChosenPeriod] = useState("");
  /**
   * Os períodos só existem depois da validação, que roda com o formulário já
   * aberto: guardar `periods[0]` no estado inicial deixaria o campo vazio para
   * sempre no caminho normal de uso.
   */
  const period = chosenPeriod || (periods[0] ?? "");
  const [sample, setSample] = useState<DraftClassificationSample | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /**
   * O quantil é o corte que funciona nos dados territoriais brasileiros: quase
   * todo indicador municipal é torto — poucos municípios enormes e milhares
   * pequenos —, e dividir o intervalo em partes iguais joga 95% do país na
   * primeira cor. Era também o corte fixo do antigo "Detectar faixas da
   * planilha", então abrir já nele mantém a sugestão que aquele botão dava.
   */
  const [method, setMethod] = useState<ClassificationMethodId>("quantile");
  /**
   * A quantidade de faixas é derivada, e não copiada para o estado no primeiro
   * render: quando o bloco monta, a validação ainda não rodou e `classCount` é
   * zero. Guardar esse zero deixava o campo travado em "0" depois que as
   * classes apareciam, e todo método recusava o cálculo.
   */
  const [chosenClassCount, setChosenClassCount] = useState<number | null>(null);
  /**
   * Um índice novo de valor único chega aqui sem nenhuma faixa, e `classCount`
   * zero fazia todo método recusar o cálculo com "Quantidade de faixas
   * inválida: 0". Cinco é a sugestão de partida, a mesma do botão de detecção
   * que este bloco substituiu.
   */
  const suggestedClassCount =
    classCount >= 2 ? classCount : DEFAULT_RANGE_COUNT;
  const requestedClassCount = canChangeClassCount
    ? (chosenClassCount ?? suggestedClassCount)
    : classCount;
  const [intervalSize, setIntervalSize] = useState("");
  const [deviationInterval, setDeviationInterval] = useState(1);

  const option = findClassificationMethodOption(method);
  /**
   * Sem planilha, a leitura acontece sobre o rascunho gravado e sobre um
   * período que só a validação descobre; com planilha, o link basta e o
   * servidor escolhe o período mais recente quando ainda não há lista.
   */
  const canLoad = Boolean(spreadsheetSource ?? (entryId && period));
  const outcome = useMemo(
    () =>
      sample && method !== "manual"
        ? tryComputeBreaks(sample, {
            method,
            classCount: requestedClassCount,
            intervalSize: Number(intervalSize.replace(",", ".")),
            deviationInterval,
          })
        : null,
    [sample, method, requestedClassCount, intervalSize, deviationInterval],
  );

  const blockedByClassCount = Boolean(
    outcome?.result &&
    !canChangeClassCount &&
    outcome.result.classCount !== classCount,
  );

  /**
   * Um índice de planilha lê os valores do link do formulário; as demais formas
   * dependem do asset do Earth Engine que só existe no rascunho gravado.
   */
  async function loadSample() {
    if (!canLoad) return;
    setLoading(true);
    setLoadError(null);
    try {
      const body = spreadsheetSource
        ? await catalogApiRequest<{ sample: DraftClassificationSample }>(
            "/api/index-catalog/classification-sample",
            {
              method: "POST",
              body: JSON.stringify({
                source: spreadsheetSource,
                period: period || undefined,
              }),
            },
          )
        : await catalogApiRequest<{ sample: DraftClassificationSample }>(
            `/api/index-catalog/drafts/${encodeURIComponent(entryId as string)}/classification-sample?year=${encodeURIComponent(period)}`,
          );
      setSample(body.sample);
    } catch (reason) {
      setSample(null);
      setLoadError((reason as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 rounded-md bg-stone-50 p-3">
      <p className="text-sm font-semibold">Calcular as faixas pelos dados</p>
      <p className="mt-1 text-xs text-stone-500">
        Lê os valores de um período e preenche os limites das faixas pelo
        método que você escolher. Tudo continua editável depois.
      </p>

      <div className="mt-3 grid items-end gap-3 md:grid-cols-[200px_auto]">
        {periods.length > 0 && (
          <label className="text-sm font-medium">
            Período lido
            <select
              className={inputClass}
              value={period}
              onChange={(event) => setChosenPeriod(event.target.value)}
            >
              {periods.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="button"
          className={`${buttonClass} border border-stone-300 bg-white`}
          disabled={!canLoad || loading}
          onClick={() => void loadSample()}
        >
          {loading ? "Lendo os valores…" : "Ler os valores"}
        </button>
      </div>

      {periods.length === 0 && spreadsheetSource && (
        <p className="mt-3 text-xs text-stone-500">
          Lê o período mais recente da planilha. Depois de validar, você escolhe
          o período aqui.
        </p>
      )}
      {periods.length === 0 && !spreadsheetSource && (
        <p className="mt-3 text-xs text-stone-500">
          Valide os assets primeiro: é a validação que descobre os períodos do
          índice, e é de um deles que os valores são lidos.
        </p>
      )}
      {!entryId && !spreadsheetSource && (
        <p className="mt-3 text-xs text-stone-500">
          Salve o rascunho antes: a leitura acontece no servidor, sobre o índice
          já guardado.
        </p>
      )}
      {loadError && <p className="mt-3 text-sm text-red-700">{loadError}</p>}

      {sample && (
        <>
          <SampleSummary sample={sample} />
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium md:col-span-2">
              Método de classificação
              <select
                className={inputClass}
                value={method}
                onChange={(event) =>
                  setMethod(event.target.value as ClassificationMethodId)
                }
              >
                {CLASSIFICATION_METHOD_OPTIONS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs font-normal text-stone-500">
                {option.description}
              </span>
            </label>

            {method !== "manual" && !option.derivesClassCount && (
              <label className="text-sm font-medium">
                Quantidade de faixas
                <input
                  className={inputClass}
                  type="number"
                  min={2}
                  max={24}
                  value={requestedClassCount}
                  disabled={!canChangeClassCount}
                  onChange={(event) =>
                    setChosenClassCount(Number(event.target.value))
                  }
                />
                <span className="mt-1 block text-xs font-normal text-stone-500">
                  {canChangeClassCount
                    ? "As faixas a mais entram sem rótulo e em cinza, para você nomear."
                    : `Fixa em ${classCount}: as classes vêm das colunas da tabela de estatísticas.`}
                </span>
              </label>
            )}

            {option.parameter === "intervalSize" && (
              <label className="text-sm font-medium">
                Largura de cada faixa
                <input
                  className={inputClass}
                  placeholder="50"
                  value={intervalSize}
                  onChange={(event) => setIntervalSize(event.target.value)}
                />
                <span className="mt-1 block text-xs font-normal text-stone-500">
                  Na unidade do próprio dado.
                </span>
              </label>
            )}

            {option.parameter === "deviationInterval" && (
              <label className="text-sm font-medium">
                Tamanho do passo
                <select
                  className={inputClass}
                  value={deviationInterval}
                  onChange={(event) =>
                    setDeviationInterval(Number(event.target.value))
                  }
                >
                  {DEVIATION_INTERVAL_OPTIONS.map((entry) => (
                    <option key={entry.label} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {outcome?.error && (
            <p className="mt-3 text-sm text-red-700">{outcome.error}</p>
          )}
          {outcome?.result && (
            <BreaksOutcome
              result={outcome.result}
              currentClassCount={classCount}
              blocked={blockedByClassCount}
            />
          )}
          {outcome?.result && (
            <button
              type="button"
              className={`${buttonClass} mt-4 border border-stone-300 bg-white`}
              disabled={blockedByClassCount}
              onClick={() =>
                onApply(outcome.result!.thresholds, outcome.result!.classCount)
              }
            >
              Usar estes limites
            </button>
          )}
        </>
      )}
    </div>
  );
}

function SampleSummary({ sample }: { sample: DraftClassificationSample }) {
  return (
    <p className="mt-3 rounded border border-stone-200 bg-white p-3 text-xs text-stone-600">
      {sample.count.toLocaleString("pt-BR")} {ORIGIN_DESCRIPTION[sample.origin]}{" "}
      em {sample.period}: menor {formatSampleNumber(sample.min)}, maior{" "}
      {formatSampleNumber(sample.max)}, média {formatSampleNumber(sample.mean)}.
      {sample.origin === "raster" &&
        " Como os pixels são sorteados, uma nova leitura pode mover os limites um pouco."}
    </p>
  );
}

/**
 * O resultado do método, com o aviso quando ele muda a quantidade de faixas.
 *
 * O aviso é explícito de propósito: corrigir o número em silêncio — cortando os
 * limites que sobram — entregaria um mapa que não é o do método escolhido, e a
 * pessoa só descobriria olhando a legenda publicada.
 */
function BreaksOutcome({
  result,
  currentClassCount,
  blocked,
}: {
  result: ClassBreaksResult;
  currentClassCount: number;
  blocked: boolean;
}) {
  const changesCount = result.classCount !== currentClassCount;
  return (
    <div className="mt-4 rounded border border-stone-200 bg-white p-3 text-sm">
      <p className="font-medium">
        {result.classCount} faixas, cortadas em{" "}
        {result.thresholds.map(formatSampleNumber).join(", ")}.
      </p>
      {changesCount && !blocked && (
        <p className="mt-2 text-xs text-amber-700">
          A legenda passa de {currentClassCount} para {result.classCount}{" "}
          faixas. As faixas novas entram em cinza e sem rótulo; as que sobrarem
          são removidas do fim da lista.
        </p>
      )}
      {blocked && (
        <p className="mt-2 text-xs text-red-700">
          Este índice tem {currentClassCount} classes vindas da tabela de
          estatísticas, e a validação exige exatamente {currentClassCount - 1}{" "}
          limite(s). Ajuste o parâmetro do método até ele gerar{" "}
          {currentClassCount} faixas, ou escolha um método em que você informa a
          quantidade.
        </p>
      )}
    </div>
  );
}

interface BreaksOutcomeState {
  result?: ClassBreaksResult;
  error?: string;
}

function tryComputeBreaks(
  sample: DraftClassificationSample,
  request: Parameters<typeof computeClassBreaks>[1],
): BreaksOutcomeState {
  try {
    return { result: computeClassBreaks(sample, request) };
  } catch (reason) {
    return { error: (reason as Error).message };
  }
}

function formatSampleNumber(value: number) {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}
