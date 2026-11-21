"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  memo,
  useMemo,
  useRef,
} from "react";
import {
  type AxisTick,
  dominantRuns,
  dragWindow,
  overviewFill,
  shiftWindow,
  type TemporalWindow,
  type WindowDragMode,
} from "./temporalVisionChart";

interface OverviewSeries {
  color: string;
  stroke: string;
  values: Array<number | null>;
}

interface TemporalOverviewProps {
  width: number;
  periodCount: number;
  series: OverviewSeries[];
  valueType: "percentage" | "absolute";
  ticks: AxisTick[];
  visible: TemporalWindow;
  minSize: number;
  keyStep: number;
  label: string;
  valueText: string;
  onChange: (visible: TemporalWindow) => void;
}

const HEIGHT = 50;
const SIDE = 6;
const BAND_TOP = 4;
const BAND_HEIGHT = 26;
// Um ano de CDI ocupa 14 px dos 354 da faixa: a janela desenhada nunca fica
// mais estreita que isto, para as duas alças não se encostarem.
const MIN_WINDOW_WIDTH = 26;
// Área de pegar cada alça: avança bastante para fora da janela e só um pouco
// para dentro, para o meio de uma janela estreita continuar sendo "arrastar".
const HANDLE_HIT = {
  mouse: { outside: 8, inside: 3 },
  touch: { outside: 14, inside: 5 },
};
const OLIVE = "#5B612A";
const MUTED_COLOR = "#6F6F6F";

/** A série inteira em miniatura, desenhada uma vez por índice e local. */
const OverviewBand = memo(function OverviewBand({
  width,
  periodCount,
  series,
  valueType,
  ticks,
}: Pick<
  TemporalOverviewProps,
  "width" | "periodCount" | "series" | "valueType" | "ticks"
>) {
  const span = width - SIDE * 2;
  const x = (boundary: number) => SIDE + (boundary / periodCount) * span;

  if (valueType === "percentage") {
    const runs = dominantRuns(
      series.map((item) => item.values),
      periodCount,
    );
    return (
      <g>
        {runs.map((run) => (
          <rect
            key={run.start}
            x={x(run.start)}
            y={BAND_TOP + 1}
            width={x(run.end + 1) - x(run.start) + 0.3}
            height={BAND_HEIGHT - 2}
            fill={overviewFill(series[run.classIndex].color)}
          />
        ))}
        <Ticks ticks={ticks} x={x} />
      </g>
    );
  }

  // Índice em valor (PIB, IDH): não há classe com mais área, então cada série
  // vira uma linha fina na escala do seu maior valor.
  const bandY = (value: number, max: number) =>
    BAND_TOP + BAND_HEIGHT - 3 - (value / max) * (BAND_HEIGHT - 6);
  return (
    <g>
      <rect
        x={SIDE}
        y={BAND_TOP}
        width={span}
        height={BAND_HEIGHT}
        rx={4}
        fill="#F6F7F6"
      />
      {series.map((item, classIndex) => {
        const max = Math.max(0, ...item.values.map((value) => value ?? 0));
        if (max <= 0) return null;
        let path = "";
        let penDown = false;
        item.values.forEach((value, index) => {
          if (value === null || value === undefined) {
            penDown = false;
            return;
          }
          path += `${penDown ? "L" : "M"}${x(index + 0.5).toFixed(1)} ${bandY(value, max).toFixed(1)}`;
          penDown = true;
        });
        return (
          <path
            key={classIndex}
            d={path}
            fill="none"
            stroke={item.stroke}
            strokeWidth={1.25}
          />
        );
      })}
      <Ticks ticks={ticks} x={x} />
    </g>
  );
});

function Ticks({
  ticks,
  x,
}: {
  ticks: AxisTick[];
  x: (boundary: number) => number;
}) {
  return ticks.map((tick) => (
    <g key={tick.index}>
      <line
        x1={x(tick.index)}
        x2={x(tick.index)}
        y1={BAND_TOP + BAND_HEIGHT}
        y2={BAND_TOP + BAND_HEIGHT + 4}
        stroke="#C8CAC5"
      />
      <text
        x={x(tick.index)}
        y={HEIGHT - 4}
        textAnchor="middle"
        fontSize={11}
        fill={MUTED_COLOR}
      >
        {tick.label}
      </text>
    </g>
  ));
}

function Handle({ x }: { x: number }) {
  const middle = BAND_TOP + BAND_HEIGHT / 2;
  return (
    <g transform={`translate(${x} 0)`}>
      <rect
        x={-3.5}
        y={middle - 9}
        width={7}
        height={18}
        rx={2.5}
        fill={OLIVE}
        stroke="#FFFFFF"
      />
      <line x1={0} x2={0} y1={middle - 4} y2={middle + 4} stroke="#FFFFFF" />
    </g>
  );
}

/**
 * O mini-mapa embaixo da Visão temporal: a série inteira numa faixa, com uma
 * janela que marca o trecho do gráfico. Arrastar a janela muda o período;
 * puxar uma borda mostra mais ou menos tempo; clicar fora leva a janela até lá.
 */
export function TemporalOverview({
  width,
  periodCount,
  series,
  valueType,
  ticks,
  visible,
  minSize,
  keyStep,
  label,
  valueText,
  onChange,
}: TemporalOverviewProps) {
  const drag = useRef<{ mode: WindowDragMode; grab: number } | null>(null);
  const span = width - SIDE * 2;
  const [start, end] = visible;

  const [left, right] = useMemo(() => {
    const realLeft = SIDE + (start / periodCount) * span;
    const realRight = SIDE + ((end + 1) / periodCount) * span;
    if (realRight - realLeft >= MIN_WINDOW_WIDTH) return [realLeft, realRight];
    const center = (realLeft + realRight) / 2;
    const drawnLeft = Math.max(
      SIDE,
      Math.min(SIDE + span - MIN_WINDOW_WIDTH, center - MIN_WINDOW_WIDTH / 2),
    );
    return [drawnLeft, drawnLeft + MIN_WINDOW_WIDTH];
  }, [start, end, periodCount, span]);

  const pointerX = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return ((event.clientX - bounds.left) / bounds.width) * width;
  };
  const boundaryAt = (svgX: number) =>
    Math.max(
      0,
      Math.min(periodCount, Math.round(((svgX - SIDE) / span) * periodCount)),
    );
  const zoneAt = (svgX: number, pointerType: string) => {
    const hit = pointerType === "touch" ? HANDLE_HIT.touch : HANDLE_HIT.mouse;
    if (svgX >= left - hit.outside && svgX <= left + hit.inside) return "start";
    if (svgX >= right - hit.inside && svgX <= right + hit.outside) return "end";
    return svgX > left && svgX < right ? "move" : "jump";
  };
  const cursorFor = (zone: string) =>
    zone === "move" ? "grab" : zone === "jump" ? "pointer" : "ew-resize";

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    const svgX = pointerX(event);
    const boundary = boundaryAt(svgX);
    const zone = zoneAt(svgX, event.pointerType);
    let current = visible;
    if (zone === "jump") {
      const size = end - start + 1;
      current = shiftWindow(
        visible,
        boundary - Math.floor(size / 2) - start,
        periodCount,
      );
      onChange(current);
    }
    drag.current =
      zone === "jump" || zone === "move"
        ? { mode: "move", grab: boundary - current[0] }
        : { mode: zone, grab: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.style.cursor =
      drag.current.mode === "move" ? "grabbing" : "ew-resize";
  };
  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const svgX = pointerX(event);
    if (!drag.current) {
      event.currentTarget.style.cursor = cursorFor(
        zoneAt(svgX, event.pointerType),
      );
      return;
    }
    const next = dragWindow(
      visible,
      drag.current.mode,
      boundaryAt(svgX),
      drag.current.grab,
      periodCount,
      minSize,
    );
    if (next[0] !== start || next[1] !== end) onChange(next);
  };
  const endDrag = (event: PointerEvent<SVGSVGElement>) => {
    drag.current = null;
    event.currentTarget.style.cursor = "grab";
  };
  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const size = end - start + 1;
    const delta =
      event.key === "ArrowLeft"
        ? -keyStep
        : event.key === "ArrowRight"
          ? keyStep
          : event.key === "PageUp"
            ? -size
            : event.key === "PageDown"
              ? size
              : event.key === "Home"
                ? -start
                : event.key === "End"
                  ? periodCount
                  : 0;
    if (delta === 0) return;
    event.preventDefault();
    onChange(shiftWindow(visible, delta, periodCount));
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${HEIGHT}`}
      width={width}
      height={HEIGHT}
      className="block h-auto w-full touch-pan-y select-none outline-none outline-offset-2 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-[#5B612A]"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={periodCount - (end - start + 1)}
      aria-valuenow={start}
      aria-valuetext={valueText}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={handleKeyDown}
      style={{ fontFamily: "inherit" }}
    >
      <OverviewBand
        width={width}
        periodCount={periodCount}
        series={series}
        valueType={valueType}
        ticks={ticks}
      />
      <g pointerEvents="none">
        <rect
          x={SIDE}
          y={BAND_TOP}
          width={Math.max(0, left - SIDE)}
          height={BAND_HEIGHT}
          fill="#FFFFFF"
          fillOpacity={0.62}
        />
        <rect
          x={right}
          y={BAND_TOP}
          width={Math.max(0, SIDE + span - right)}
          height={BAND_HEIGHT}
          fill="#FFFFFF"
          fillOpacity={0.62}
        />
        <rect
          x={left}
          y={BAND_TOP - 2}
          width={right - left}
          height={BAND_HEIGHT + 4}
          rx={4}
          fill="none"
          stroke={OLIVE}
          strokeWidth={2}
        />
        <Handle x={left} />
        <Handle x={right} />
      </g>
    </svg>
  );
}
