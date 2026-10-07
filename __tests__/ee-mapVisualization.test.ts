import { describe, expect, it } from "vitest";

import {
  classifyValueByThresholds,
  resolveMapVisualizationPlan,
} from "@/app/api/ee/mapVisualization";

describe("Earth Engine map visualization planning", () => {
  it("plans threshold classification for continuous rasters before palette rendering", () => {
    const palette = ["#100000", "#200000", "#300000", "#400000"];
    const plan = resolveMapVisualizationPlan(
      {
        min: 1,
        max: 4,
        palette,
        sourceBand: "raw_value",
        band: "classified_value",
        thresholds: [10, 20, 30],
      },
      palette.map((color, index) => ({
        color,
        label: `Class ${index + 1}`,
        pixelLimit: index + 1,
      })),
      0,
      30,
    );

    expect(plan).toEqual({
      sourceBand: "raw_value",
      visParams: { min: 1, max: 4, palette },
      thresholdClassification: {
        outputBand: "classified_value",
        startValue: 1,
        thresholds: [10, 20, 30],
      },
    });

    const rawValueFarAboveVisualMax = 3000;
    expect(rawValueFarAboveVisualMax).toBeGreaterThan(plan.visParams.max);
    expect(
      classifyValueByThresholds(
        rawValueFarAboveVisualMax,
        plan.thresholdClassification?.thresholds ?? [],
        plan.thresholdClassification?.startValue ?? 1,
      ),
    ).toBe(4);
  });

  it("does not create a classification plan for already categorized rasters", () => {
    const plan = resolveMapVisualizationPlan(
      {
        min: 0,
        max: 2,
        palette: ["#000000", "#111111", "#222222"],
        band: "class_code",
      },
      [],
      0,
      2,
    );

    expect(plan).toEqual({
      sourceBand: "class_code",
      visParams: {
        min: 0,
        max: 2,
        palette: ["#000000", "#111111", "#222222"],
      },
    });
  });

  it("renames threshold output without selecting that name from the source", () => {
    const plan = resolveMapVisualizationPlan(
      {
        min: 0,
        max: 2,
        outputBand: "classified_value",
        thresholds: [10, 20],
        palette: ["#000000", "#111111", "#222222"],
      },
      [],
      0,
      2,
    );

    expect(plan.sourceBand).toBeUndefined();
    expect(plan.thresholdClassification?.outputBand).toBe("classified_value");
  });

  it("keeps feature collection visualization metadata in the resolved plan", () => {
    const plan = resolveMapVisualizationPlan(
      {
        sourceType: "featureCollection",
        property: "2025",
        min: 1,
        max: 5,
        thresholds: [20, 40, 60, 80],
        palette: ["#ffffcc", "#fed976", "#feb24c", "#fd8d3c", "#bd0026"],
        legend: [
          { id: "low", label: "Baixo", color: "#ffffcc" },
          { id: "high", label: "Alto", color: "#bd0026" },
        ],
        outline: { color: "#000000", width: 0.5, opacity: 1 },
      },
      [],
      0,
      100,
    );

    expect(plan).toEqual({
      sourceType: "featureCollection",
      property: "2025",
      sourceBand: undefined,
      outline: { color: "#000000", width: 0.5, opacity: 1 },
      visParams: {
        min: 1,
        max: 5,
        palette: ["#ffffcc", "#fed976", "#feb24c", "#fd8d3c", "#bd0026"],
      },
      thresholdClassification: {
        outputBand: undefined,
        startValue: 1,
        thresholds: [20, 40, 60, 80],
      },
    });

    expect(
      classifyValueByThresholds(
        80.1,
        plan.thresholdClassification?.thresholds ?? [],
        plan.thresholdClassification?.startValue ?? 1,
      ),
    ).toBe(5);
  });
});

/**
 * O Earth Engine distribui a paleta linearmente entre `min` e `max`. Numa
 * camada com classes 1 a 6 e 9 a 14 são 12 cores para 14 valores, e cada classe
 * recebe a cor da vizinha. Estes casos fixam o remapeamento que corrige isso.
 */
describe("classes esparsas na paleta do mapa", () => {
  const GAPPED_INDEXES = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14];

  function legendFor(indexes: number[]) {
    return indexes.map((pixelLimit) => ({
      id: `classe-${pixelLimit}`,
      label: `Classe ${pixelLimit}`,
      color: `#${String(pixelLimit).padStart(2, "0")}0000`,
      pixelLimit,
    }));
  }

  function planFor(indexes: number[], overrides = {}) {
    const legend = legendFor(indexes);
    return resolveMapVisualizationPlan(
      {
        min: Math.min(...indexes),
        max: Math.max(...indexes),
        palette: legend.map((entry) => entry.color),
        legend,
        band: "b1",
        ...overrides,
      },
      [],
      0,
      0,
    );
  }

  it("traduz cada valor de classe para a posição dela na paleta", () => {
    const plan = planFor(GAPPED_INDEXES);

    expect(plan.categoricalRemap).toEqual({
      from: GAPPED_INDEXES,
      to: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    });
  });

  it("estreita a faixa de visualização para o tamanho da paleta", () => {
    const plan = planFor(GAPPED_INDEXES);

    expect(plan.visParams.min).toBe(1);
    expect(plan.visParams.max).toBe(12);
    expect(plan.visParams.palette).toHaveLength(12);
  });

  // Começar em 1 e não em 0 é deliberado: `selfMask()` roda depois de
  // applyMapVisualization e apagaria a primeira classe se ela virasse zero.
  it("nunca remapeia uma classe para zero", () => {
    expect(planFor(GAPPED_INDEXES).categoricalRemap?.to).not.toContain(0);
  });

  it("não remapeia uma faixa densa, que já cai nos valores certos", () => {
    const plan = planFor([2, 3, 4, 5]);

    expect(plan.categoricalRemap).toBeUndefined();
    expect(plan.visParams).toEqual({
      min: 2,
      max: 5,
      palette: ["#020000", "#030000", "#040000", "#050000"],
    });
  });

  it("não remapeia quando a classificação por limites já densificou os valores", () => {
    const plan = planFor(GAPPED_INDEXES, { thresholds: [10, 20, 30] });

    expect(plan.categoricalRemap).toBeUndefined();
    expect(plan.thresholdClassification).toBeDefined();
  });

  // Sem uma legenda completa não há como dizer qual cor pertence a qual valor,
  // e adivinhar seria pior do que manter o comportamento atual.
  it("não remapeia quando a legenda não cobre todas as cores da paleta", () => {
    const legend = legendFor(GAPPED_INDEXES);
    const plan = resolveMapVisualizationPlan(
      {
        min: 1,
        max: 14,
        palette: legend.map((entry) => entry.color),
        legend: legend.slice(0, 5),
      },
      [],
      0,
      0,
    );

    expect(plan.categoricalRemap).toBeUndefined();
  });

  it("não remapeia quando um valor de classe cai fora de min..max", () => {
    const legend = legendFor([1, 2, 30]);
    const plan = resolveMapVisualizationPlan(
      { min: 1, max: 14, palette: legend.map((entry) => entry.color), legend },
      [],
      0,
      0,
    );

    expect(plan.categoricalRemap).toBeUndefined();
  });

  it("não remapeia valores de classe fracionários", () => {
    const legend = legendFor([1, 2]).map((entry, position) => ({
      ...entry,
      pixelLimit: position === 0 ? 1 : 2.5,
    }));
    const plan = resolveMapVisualizationPlan(
      { min: 1, max: 14, palette: legend.map((entry) => entry.color), legend },
      [],
      0,
      0,
    );

    expect(plan.categoricalRemap).toBeUndefined();
  });
});
