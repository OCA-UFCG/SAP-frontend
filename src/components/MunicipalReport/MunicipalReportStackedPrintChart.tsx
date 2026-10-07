import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";
import {
  buildStackedChartData,
  MUNICIPAL_REPORT_STACKED_MAX_COLUMNS,
} from "@/utils/municipalReportStackedChart";

const WIDTH = 640;
const HEIGHT = 330;
const PLOT_LEFT = 44;
const PLOT_RIGHT = 12;
const PLOT_TOP = 12;
const PLOT_BOTTOM = 254;
const LEGEND_TOP = 288;
const LEGEND_COLUMNS = 4;

const PLOT_WIDTH = WIDTH - PLOT_LEFT - PLOT_RIGHT;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const Y_TICKS = [0, 20, 40, 60, 80, 100];

export function MunicipalReportStackedPrintChart({
  analysis,
  referencePeriod,
  translateLabel,
}: {
  analysis: MunicipalReportAnalysis;
  referencePeriod: string | null;
  translateLabel: (label: string) => string;
}) {
  const data = buildStackedChartData(
    analysis,
    referencePeriod,
    MUNICIPAL_REPORT_STACKED_MAX_COLUMNS,
  );
  if (data.rows.length === 0 || data.series.length === 0) return null;

  const columnCount = data.rows.length;
  const slotWidth = PLOT_WIDTH / columnCount;
  const barWidth = slotWidth * 0.62;

  return (
    <svg
      className="report-print-chart-svg block h-auto w-full"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${analysis.title}: ${data.firstPeriod} a ${data.lastPeriod}`}
    >
      {Y_TICKS.map((tick) => {
        const y = PLOT_BOTTOM - (tick / 100) * PLOT_HEIGHT;

        return (
          <g key={tick}>
            <line
              x1={PLOT_LEFT}
              x2={WIDTH - PLOT_RIGHT}
              y1={y}
              y2={y}
              stroke="#E4EBE5"
              strokeWidth="1"
            />
            <text
              x={PLOT_LEFT - 8}
              y={y + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="#58655C"
            >
              {tick}%
            </text>
          </g>
        );
      })}

      {data.rows.map((row, columnIndex) => {
        const x =
          PLOT_LEFT + columnIndex * slotWidth + (slotWidth - barWidth) / 2;
        let cursor = PLOT_BOTTOM;

        return (
          <g key={row.period}>
            {data.series.map((series) => {
              const share = row.shares[series.id] ?? 0;
              if (share <= 0) return null;
              const height = (share / 100) * PLOT_HEIGHT;
              cursor -= height;

              return (
                <rect
                  key={series.id}
                  data-stack-segment={`${row.period}:${series.id}`}
                  x={x}
                  y={cursor}
                  width={barWidth}
                  height={height}
                  fill={series.color}
                  stroke="#00000022"
                  strokeWidth="0.5"
                />
              );
            })}
            <text
              x={x + barWidth / 2}
              y={PLOT_BOTTOM + 16}
              textAnchor="middle"
              fontSize="9.5"
              fill="#58655C"
            >
              {row.highlighted ? `${row.period}*` : row.period}
            </text>
          </g>
        );
      })}

      <line
        x1={PLOT_LEFT}
        x2={WIDTH - PLOT_RIGHT}
        y1={PLOT_BOTTOM}
        y2={PLOT_BOTTOM}
        stroke="#D3DCD5"
        strokeWidth="1"
      />

      {data.series.map((series, index) => {
        const column = index % LEGEND_COLUMNS;
        const row = Math.floor(index / LEGEND_COLUMNS);
        const x = PLOT_LEFT + column * (PLOT_WIDTH / LEGEND_COLUMNS);
        const y = LEGEND_TOP + row * 16;

        return (
          <g key={series.id}>
            <rect
              x={x}
              y={y - 7}
              width={9}
              height={9}
              rx="2"
              fill={series.color}
              stroke="#00000022"
              strokeWidth="0.5"
            />
            <text x={x + 14} y={y} fontSize="9.5" fill="#2C3A31">
              {translateLabel(series.label)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
