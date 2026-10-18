import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: vi.fn(),
  getPanelLayerWithMunicipalAnalysisYear: vi.fn(),
}));
vi.mock("@/repositories/platform/geeStatisticsRepository", () => ({
  preloadGeeStatisticsSchema: vi.fn(),
}));
vi.mock("@/repositories/platform/geeStatisticsAssetRevisions", () => ({
  checkStatisticsAssetRevisions: vi.fn(),
}));
// O contrato completo do `imageData` tem teste próprio; aqui basta o formato.
vi.mock("@/utils/imageData", () => ({
  isCompactImageData: (imageData: { type?: string } | null) =>
    imageData?.type === "territorial-compact",
}));

import {
  getPanelLayers,
  getPanelLayerWithMunicipalAnalysisYear,
} from "@/repositories/platform/panelLayerRepository";
import { warmGeeStatisticsNationalRows } from "@/services/geeStatisticsWarmup";
import type { PanelLayerI } from "@/utils/interfaces";

const GEE_SOURCE = {
  schemaVersion: 1,
  kind: "gee-feature-collection",
  sourceRevision: "rev-1",
  asset: { type: "fixed", assetId: "projects/x/assets/Estatisticas/T" },
  periodGranularity: "year",
  properties: {},
};

function layer(
  id: string,
  years: string[],
  statisticsSource: unknown,
): PanelLayerI {
  return {
    sys: { id: `sys-${id}` },
    id,
    name: id,
    description: "",
    previewMap: { url: "/preview.png" },
    imageData: {
      schemaVersion: 1,
      type: "territorial-compact",
      classes: [],
      years: Object.fromEntries(years.map((year) => [year, { imageId: id }])),
    },
    statisticsSource,
  } as unknown as PanelLayerI;
}

const warmLayer = vi.mocked(getPanelLayerWithMunicipalAnalysisYear);

beforeEach(() => {
  warmLayer.mockReset();
  warmLayer.mockResolvedValue(null);
});

describe("aquecimento do recorte Brasil", () => {
  it("pede o Brasil de cada camada do Earth Engine pelo mesmo caminho da rota", async () => {
    vi.mocked(getPanelLayers).mockResolvedValue([
      layer("aridez", ["2023", "2024", "1980"], GEE_SOURCE),
      layer("ana", ["2026-08", "2024-01"], GEE_SOURCE),
    ]);

    await expect(warmGeeStatisticsNationalRows()).resolves.toBe(2);

    expect(warmLayer.mock.calls).toEqual([
      ["aridez", "2024", "br"],
      ["ana", "2026-08", "br"],
    ]);
  });

  // A planilha não é lida no Earth Engine e já responde rápido sem aquecer.
  it("deixa de fora planilhas e camadas sem estatística", async () => {
    vi.mocked(getPanelLayers).mockResolvedValue([
      layer("pib", ["2023"], { kind: "municipal-spreadsheet" }),
      layer("mapa-sem-estatistica", ["2023"], null),
      layer("ana", [], GEE_SOURCE),
    ]);

    await expect(warmGeeStatisticsNationalRows()).resolves.toBe(0);
    expect(warmLayer).not.toHaveBeenCalled();
  });

  it("segue para as outras camadas quando uma falha", async () => {
    vi.mocked(getPanelLayers).mockResolvedValue([
      layer("quebrada", ["2024"], GEE_SOURCE),
      layer("ana", ["2026-08"], GEE_SOURCE),
    ]);
    warmLayer.mockRejectedValueOnce(new Error("Earth Engine indisponível"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(warmGeeStatisticsNationalRows()).resolves.toBe(1);
    expect(warmLayer).toHaveBeenLastCalledWith("ana", "2026-08", "br");
    warn.mockRestore();
  });
});
