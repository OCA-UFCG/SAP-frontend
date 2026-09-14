import type {
  MunicipalReportAnalysis,
  MunicipalReportPeriodSnapshot,
} from "@/contracts/municipalReport";

/**
 * Quantas colunas o gráfico desenha no máximo.
 *
 * O teto é o que faz caber **um rótulo de data por coluna**: nenhuma barra fica
 * sem o período dela embaixo. Aumentar isto obrigaria a esconder rótulos, que é
 * exatamente o que não se quer.
 *
 * Tela e impressão usam o mesmo valor de propósito: assim a prévia mostra os
 * mesmos períodos que vão sair no PDF.
 */
export const MUNICIPAL_REPORT_STACKED_MAX_COLUMNS = 12;

export interface StackedChartRow {
  period: string;
  label: string;
  highlighted: boolean;
  /** Fatias que somam exatamente 100, por id de classe. É o que se desenha. */
  shares: Record<string, number>;
  /** Percentual como o serviço o produziu. É o que o tooltip mostra. */
  raw: Record<string, number>;
}

export interface StackedChartSeries {
  id: string;
  label: string;
  color: string;
}

export interface StackedChartData {
  rows: StackedChartRow[];
  series: StackedChartSeries[];
  firstPeriod: string | null;
  lastPeriod: string | null;
}

/**
 * Se faz sentido empilhar a série deste índice até 100%.
 *
 * Um índice de valor absoluto não tem partes de um todo, e um índice de classe
 * única empilharia 100% em toda coluna — os dois ficam de fora deste gráfico em
 * vez de receberem um desenho que não diz nada.
 *
 * @example
 * isStackableAnalysis(analysis); // true para o Monitor de Secas
 */
export function isStackableAnalysis(analysis: MunicipalReportAnalysis) {
  return analysis.valueType === "percentage" && analysis.classes.length > 1;
}

/**
 * As fatias de uma coluna, reescaladas para somarem exatamente 100.
 *
 * O serviço arredonda cada classe para uma casa decimal
 * (`roundReportPercentage`), então uma coluna de três classes iguais soma 99,9.
 * Num gráfico que declara 100% no eixo, essa diferença vira uma fresta branca
 * no topo de umas colunas e não de outras, e o leitor lê a fresta como uma
 * classe que não existe.
 *
 * Uma coluna inteiramente zerada devolve zeros, e não uma divisão igualitária:
 * "não há dado" não é "todas as classes empatadas".
 *
 * @example
 * normalizeStackedShares({ a: 33.3, b: 33.3, c: 33.3 }); // cada um 33.33…, soma 100
 */
export function normalizeStackedShares(
  raw: Record<string, number>,
): Record<string, number> {
  const entries = Object.entries(raw);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  if (total <= 0) {
    return Object.fromEntries(entries.map(([id]) => [id, 0]));
  }

  return Object.fromEntries(
    entries.map(([id, value]) => [id, (value / total) * 100]),
  );
}

/**
 * Os períodos que o gráfico desenha quando a série não cabe.
 *
 * A amostragem é uniforme e preserva as duas pontas, em vez do `slice(-N)` que
 * o gráfico de linha usa: cortar o começo faria o gráfico contradizer o
 * parágrafo impresso logo abaixo dele, que fala do intervalo inteiro.
 *
 * O período de referência entra sempre — é o período que o resto da seção
 * descreve —, tomando o lugar do vizinho amostrado mais próximo para a
 * contagem de colunas não mudar.
 *
 * @example
 * selectStackedChartSnapshots(serie, 12, "2026-05");
 */
export function selectStackedChartSnapshots(
  snapshots: readonly MunicipalReportPeriodSnapshot[],
  maxColumns: number,
  referencePeriod: string | null,
): MunicipalReportPeriodSnapshot[] {
  if (maxColumns <= 0) return [];

  const sorted = [...snapshots].sort((left, right) =>
    left.period.localeCompare(right.period),
  );
  if (sorted.length <= maxColumns) return sorted;
  if (maxColumns === 1) return [sorted[sorted.length - 1]];

  const lastIndex = sorted.length - 1;
  const picked = new Set<number>();
  for (let slot = 0; slot < maxColumns; slot += 1) {
    picked.add(Math.round((slot * lastIndex) / (maxColumns - 1)));
  }

  const referenceIndex = sorted.findIndex(
    (item) => item.period === referencePeriod,
  );
  if (referenceIndex >= 0 && !picked.has(referenceIndex)) {
    const nearest = [...picked].reduce((closest, index) =>
      Math.abs(index - referenceIndex) < Math.abs(closest - referenceIndex)
        ? index
        : closest,
    );
    picked.delete(nearest);
    picked.add(referenceIndex);
  }

  return [...picked]
    .sort((left, right) => left - right)
    .map((index) => sorted[index]);
}

/**
 * Os dados do gráfico de colunas empilhadas, prontos para desenhar.
 *
 * Tela e impressão chamam esta mesma função com o mesmo teto de colunas: é o
 * que garante que os dois desenhos digam a mesma coisa sobre os mesmos
 * períodos.
 *
 * @example
 * buildStackedChartData(analysis, "2026-05", MUNICIPAL_REPORT_STACKED_MAX_COLUMNS);
 */
export function buildStackedChartData(
  analysis: MunicipalReportAnalysis,
  referencePeriod: string | null,
  maxColumns: number,
): StackedChartData {
  const snapshots = selectStackedChartSnapshots(
    analysis.timeSeries,
    maxColumns,
    referencePeriod,
  );

  const rows = snapshots.map((snapshot): StackedChartRow => {
    const raw = Object.fromEntries(
      analysis.classes.map((analysisClass) => [
        analysisClass.id,
        snapshot.distribution.find((item) => item.id === analysisClass.id)
          ?.percentage ?? 0,
      ]),
    );

    return {
      period: snapshot.period,
      label: snapshot.label || snapshot.period,
      highlighted: snapshot.period === referencePeriod,
      shares: normalizeStackedShares(raw),
      raw,
    };
  });

  return {
    rows,
    // As séries saem de `analysis.classes`, e não das classes presentes na
    // janela desenhada: a legenda precisa ser a mesma em todo período, senão
    // uma cor muda de significado quando o leitor troca de município.
    series: analysis.classes.map(({ id, label, color }) => ({
      id,
      label,
      color,
    })),
    firstPeriod: rows[0]?.period ?? null,
    lastPeriod: rows.at(-1)?.period ?? null,
  };
}
