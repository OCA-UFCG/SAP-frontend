import { describe, expect, it } from "vitest";

import type {
  CompactAnalysisClass,
  CompactTerritorialAnalysisDataset,
} from "@/utils/analysis";
import { readLegacyClassification } from "@/utils/legacyClassification";

function dataset(
  classes: CompactAnalysisClass[],
  mapVisualization?: CompactTerritorialAnalysisDataset["mapVisualization"],
): CompactTerritorialAnalysisDataset {
  return {
    schemaVersion: 1,
    type: "territorial-compact",
    defaultYear: "2020",
    classes,
    ...(mapVisualization ? { mapVisualization } : {}),
    locations: { br: "Brasil" },
    years: { "2020": { imageId: "assets/x", values: { br: [1] } } },
  };
}

function row(id: string, pixelLimit?: number): CompactAnalysisClass {
  return {
    id,
    label: id,
    color: "#000000",
    ...(pixelLimit === undefined ? {} : { pixelLimit }),
  };
}

describe("readLegacyClassification", () => {
  it("usa os thresholds explícitos quando existem, como prodprimariabruta", () => {
    const imageData = dataset([row("c1", 1), row("c2", 2), row("c3", 3)], {
      thresholds: [7000, 13000],
      palette: ["#000000"],
    });

    expect(
      readLegacyClassification(imageData, { minScale: 0, maxScale: 25 }),
    ).toEqual({
      kind: "value-bounds",
      values: [7000, 13000],
    });
  });

  it("trata pixelLimit em todas as classes como código de pixel, como terraibge", () => {
    const imageData = dataset([
      row("area-artificial", 1),
      row("area-umida", 9),
      row("area-descoberta", 14),
    ]);

    expect(
      readLegacyClassification(imageData, { minScale: 1, maxScale: 14 }),
    ).toEqual({
      kind: "pixel-codes",
      values: [1, 9, 14],
    });
  });

  it("preserva a ordem inversa dos códigos, como cemadenseca", () => {
    const imageData = dataset([
      row("normais", 6),
      row("seca-fraca", 5),
      row("seca-extrema", 1),
    ]);

    expect(
      readLegacyClassification(imageData, { minScale: 1, maxScale: 6 }),
    ).toEqual({
      kind: "pixel-codes",
      values: [6, 5, 1],
    });
  });

  it("trata a última classe sem limite como faixa aberta, como carbonoembrapa", () => {
    // O legado grava 4.999, 6, 8, 10 e 16 g/kg em cinco das seis classes: a
    // última é ">16" e por isso não tem limite superior.
    const imageData = dataset([
      row("menor-que-5", 4.999),
      row("de-5-a-6", 6),
      row("de-6-a-8", 8),
      row("de-8-a-10", 10),
      row("de-10-a-16", 16),
      row("maior-que-16"),
    ]);

    expect(
      readLegacyClassification(imageData, { minScale: 0, maxScale: 50 }),
    ).toEqual({
      kind: "value-bounds",
      values: [4.999, 6, 8, 10, 16],
    });
  });

  it("deduz códigos consecutivos de minScale e maxScale, como deg e ods", () => {
    const deg = dataset([row("c1"), row("c2"), row("c3"), row("c4")]);
    const ods = dataset([row("estavel"), row("melhora"), row("piora")]);

    expect(readLegacyClassification(deg, { minScale: 1, maxScale: 4 })).toEqual(
      {
        kind: "pixel-codes",
        values: [1, 2, 3, 4],
      },
    );
    expect(
      readLegacyClassification(ods, { minScale: 9, maxScale: 11 }),
    ).toEqual({
      kind: "pixel-codes",
      values: [9, 10, 11],
    });
  });

  it("não adivinha quando a escala não corresponde à quantidade de classes", () => {
    // s2id_secas_estiagens: uma classe só, escala 0 a 50 e nenhum limite.
    const imageData = dataset([row("registros")]);

    expect(
      readLegacyClassification(imageData, { minScale: 0, maxScale: 50 }),
    ).toEqual({
      kind: "unknown",
      values: [],
    });
  });

  it("não adivinha sem escala nenhuma", () => {
    expect(readLegacyClassification(dataset([row("c1"), row("c2")]))).toEqual({
      kind: "unknown",
      values: [],
    });
  });
});
