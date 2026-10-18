import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";
import { formatAbsoluteNumber } from "@/utils/formatTerritorialNumber";
import {
  buildMunicipalReportChartData,
  getVisibleChartColor,
  resolveMunicipalReportChartAxisMax,
} from "@/utils/municipalReportChart";

const WIDTH = 640;
const HEIGHT = 280;
const PLOT_LEFT = 92;
const PLOT_RIGHT = 16;
const PLOT_TOP = 14;
const PLOT_BOTTOM = 232;

/**
 * A série histórica de um índice de valor único (pobreza, PIB, IDH), em SVG
 * puro para o PDF.
 *
 * O gráfico da tela é do Recharts e mede o próprio contêiner, que não existe
 * na janela de impressão; esta versão tem tamanho fixo e sai igual no papel. É
 * a contrapartida de `MunicipalReportStackedPrintChart` para as séries que não
 * são classes somando 100%.
 */
export function MunicipalReportLinePrintChart({
  analysis,
  locale,
  referencePeriod,
  translateLabel,
}: {
  analysis: MunicipalReportAnalysis;
  locale: string;
  referencePeriod: string;
  translateLabel: (label: string) => string;
}) {
  const chartData = buildMunicipalReportChartData(analysis, referencePeriod);
  const categoryCount = chartData.categories.length;
  if (categoryCount === 0 || chartData.series.length === 0) return null;

  const observedMax = Math.max(
    0,
    ...chartData.series.flatMap((series) =>
      series.points.map((point) => point.value),
    ),
  );
  const axisMax = resolveMunicipalReportChartAxisMax(
    analysis.valueType,
    observedMax,
  );
  const yTicks = Array.from({ length: 6 }, (_, index) => (axisMax / 5) * index);
  const plotWidth = WIDTH - PLOT_LEFT - PLOT_RIGHT;

  const xForIndex = (index: number) =>
    categoryCount <= 1
      ? PLOT_LEFT + plotWidth / 2
      : PLOT_LEFT + (index / (categoryCount - 1)) * plotWidth;
  const yForValue = (value: number) => {
    const clamped = Math.max(0, Math.min(axisMax, value));
    return PLOT_BOTTOM - (clamped / axisMax) * (PLOT_BOTTOM - PLOT_TOP);
  };
  // Com muitos períodos os rótulos se atropelam; ficam o primeiro, o último e
  // um a cada três — menos os vizinhos do último, que encostariam nele.
  const visiblePeriodIndexes = new Set(
    chartData.categories
      .map((_, index) => index)
      .filter(
        (index) =>
          categoryCount <= 6 ||
          index === 0 ||
          index === categoryCount - 1 ||
          (index % 3 === 0 && index < categoryCount - 2),
      ),
  );
  const referenceIndex = chartData.categories.findIndex(
    (category) => category.period === chartData.referencePeriod,
  );

  return (
    <div className="w-full">
      <svg
        className="block h-auto w-full"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${analysis.title}: ${chartData.categories[0]?.label} a ${chartData.categories.at(-1)?.label}`}
      >
        {yTicks.map((value) => {
          const y = yForValue(value);
          return (
            <g key={value}>
              <line
                x1={PLOT_LEFT}
                y1={y}
                x2={WIDTH - PLOT_RIGHT}
                y2={y}
                stroke="#E3E7EA"
                strokeDasharray="4 6"
              />
              <text
                x={PLOT_LEFT - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="13"
                fill="#5F6670"
              >
                {analysis.valueType === "percentage"
                  ? `${value.toFixed(0)}%`
                  : formatAbsoluteNumber(value, locale)}
              </text>
            </g>
          );
        })}
        <line
          x1={PLOT_LEFT}
          y1={PLOT_TOP}
          x2={PLOT_LEFT}
          y2={PLOT_BOTTOM}
          stroke="#B8C0C5"
        />
        <line
          x1={PLOT_LEFT}
          y1={PLOT_BOTTOM}
          x2={WIDTH - PLOT_RIGHT}
          y2={PLOT_BOTTOM}
          stroke="#B8C0C5"
        />
        {referenceIndex >= 0 && (
          <line
            x1={xForIndex(referenceIndex)}
            y1={PLOT_TOP}
            x2={xForIndex(referenceIndex)}
            y2={PLOT_BOTTOM}
            stroke="#989F43"
            strokeDasharray="5 5"
            strokeWidth="2"
          />
        )}
        {chartData.series.map((series) => {
          const color = getVisibleChartColor(series.color);
          return (
            <g key={series.id}>
              <polyline
                points={series.points
                  .map(
                    (point, index) =>
                      `${xForIndex(index).toFixed(1)},${yForValue(point.value).toFixed(1)}`,
                  )
                  .join(" ")}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {series.points.map((point, index) => (
                <circle
                  key={point.period}
                  cx={xForIndex(index)}
                  cy={yForValue(point.value)}
                  r={point.highlighted ? 3.8 : 2.5}
                  fill="#FFFFFF"
                  stroke={color}
                  strokeWidth={point.highlighted ? 2.5 : 1.8}
                />
              ))}
            </g>
          );
        })}
        {chartData.categories.map((category, index) => {
          if (!visiblePeriodIndexes.has(index)) return null;
          return (
            <text
              key={category.period}
              x={xForIndex(index)}
              y={PLOT_BOTTOM + 28}
              textAnchor={
                categoryCount <= 1
                  ? "middle"
                  : index === 0
                    ? "start"
                    : index === categoryCount - 1
                      ? "end"
                      : "middle"
              }
              fontSize="13"
              fontWeight={category.highlighted ? 700 : 400}
              fill="#5F6670"
            >
              {category.label}
            </text>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] font-semibold text-[#292829]">
        {chartData.series.map((series) => (
          <span key={series.id} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: getVisibleChartColor(series.color) }}
            />
            {translateLabel(series.label)}
          </span>
        ))}
      </div>
    </div>
  );
}
