import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getCatalogEntry: vi.fn(),
  getStatisticsAssetIds: vi.fn(),
}));

vi.mock("@/services/indexCatalog/contentfulManagement", () => ({
  getCatalogEntry: mocks.getCatalogEntry,
}));

vi.mock("@/services/indexCatalog/statisticsAssetDiscovery", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/indexCatalog/statisticsAssetDiscovery")
  >("@/services/indexCatalog/statisticsAssetDiscovery");
  return { ...actual, getStatisticsAssetIds: mocks.getStatisticsAssetIds };
});

import { checkCatalogNewData } from "@/services/indexCatalog/newDataCheck";
import { periodFromAssetId } from "@/services/indexCatalog/statisticsAssetDiscovery";

const TEMPLATE = "projects/x/assets/estat_{year}";
const VALIDATED_AT = "2026-01-10T12:00:00.000Z";

function catalogEntry(overrides: Record<string, unknown> = {}) {
  return {
    item: {
      catalogConfig: {
        schemaVersion: 2,
        panelLayerId: "indice_teste",
        status: "published",
        statisticsSource: {
          kind: "gee-feature-collection",
          asset: { type: "period-template", assetIdTemplate: TEMPLATE },
          periodGranularity: "year",
        },
        validation: {
          validatedAt: VALIDATED_AT,
          valid: true,
          errors: [],
          warnings: [],
          inferred: {
            panelLayerId: "indice_teste",
            periods: ["2024", "2025"],
            classIndexes: [1, 2],
            statisticsAssetCount: 2,
          },
          sourceFingerprint: "abc",
        },
        ...overrides,
      },
    },
  };
}

function listedAsset(period: string, updateTime: string) {
  return {
    id: `projects/x/assets/estat_${period}`,
    updateTime,
    revision: updateTime,
  };
}

describe("periodFromAssetId", () => {
  it("lê o ano do nome do asset", () => {
    expect(periodFromAssetId(TEMPLATE, "projects/x/assets/estat_2026")).toBe(
      "2026",
    );
  });

  it("junta ano e mês num período mensal", () => {
    expect(
      periodFromAssetId(
        "projects/x/assets/e_{year}_{month}",
        "projects/x/assets/e_2026_03",
      ),
    ).toBe("2026-03");
  });

  it("ignora um asset que não segue o template", () => {
    expect(periodFromAssetId(TEMPLATE, "projects/x/assets/outro")).toBeNull();
  });
});

describe("checkCatalogNewData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCatalogEntry.mockResolvedValue(catalogEntry());
  });

  it("aponta o período que existe na pasta e não no índice", async () => {
    mocks.getStatisticsAssetIds.mockResolvedValue([
      listedAsset("2024", "2025-01-01T00:00:00.000Z"),
      listedAsset("2025", "2026-01-01T00:00:00.000Z"),
      listedAsset("2026", "2026-01-05T00:00:00.000Z"),
    ]);

    const check = await checkCatalogNewData("entry-1");

    expect(check.status).toBe("new-data");
    expect(check.newPeriods).toEqual(["2026"]);
    expect(check.updatedAssets).toEqual([]);
    expect(check.knownPeriods).toEqual(["2024", "2025"]);
  });

  // Regressão: o Monitor de Secas da ANA guarda um asset por ano mas é mensal,
  // e a comparação de texto entre "2026" (nome do asset) e "2026-08" (período
  // validado) marcava os três anos da pasta como novos a cada verificação,
  // mesmo recém-validado e republicado.
  it("não inventa período novo num índice mensal com um asset por ano", async () => {
    mocks.getCatalogEntry.mockResolvedValue(
      catalogEntry({
        statisticsSource: {
          kind: "gee-feature-collection",
          asset: { type: "period-template", assetIdTemplate: TEMPLATE },
          periodGranularity: "month",
        },
        validation: {
          validatedAt: VALIDATED_AT,
          valid: true,
          errors: [],
          warnings: [],
          inferred: {
            panelLayerId: "indice_teste",
            periods: ["2024-11", "2024-12", "2025-01"],
            classIndexes: [1, 2],
            statisticsAssetCount: 2,
          },
          sourceFingerprint: "abc",
        },
      }),
    );
    mocks.getStatisticsAssetIds.mockResolvedValue([
      listedAsset("2024", "2025-01-01T00:00:00.000Z"),
      listedAsset("2025", "2026-01-01T00:00:00.000Z"),
      listedAsset("2026", "2026-01-01T00:00:00.000Z"),
    ]);

    const check = await checkCatalogNewData("entry-1");

    expect(check.newPeriods).toEqual(["2026"]);
  });

  it("aponta o asset reescrito depois da validação", async () => {
    mocks.getStatisticsAssetIds.mockResolvedValue([
      listedAsset("2024", "2025-01-01T00:00:00.000Z"),
      listedAsset("2025", "2026-02-01T00:00:00.000Z"),
    ]);

    const check = await checkCatalogNewData("entry-1");

    expect(check.status).toBe("new-data");
    expect(check.newPeriods).toEqual([]);
    expect(check.updatedAssets).toEqual([
      {
        assetId: "projects/x/assets/estat_2025",
        updateTime: "2026-02-01T00:00:00.000Z",
      },
    ]);
  });

  it("diz que está em dia quando nada mudou", async () => {
    mocks.getStatisticsAssetIds.mockResolvedValue([
      listedAsset("2024", "2025-01-01T00:00:00.000Z"),
      listedAsset("2025", "2026-01-01T00:00:00.000Z"),
    ]);

    const check = await checkCatalogNewData("entry-1");

    expect(check.status).toBe("up-to-date");
    expect(check.message).toContain("Nenhum dado novo");
  });

  it("lê o carimbo em microssegundos de um asset fixo sem updateTime", async () => {
    mocks.getStatisticsAssetIds.mockResolvedValue([
      {
        id: "projects/x/assets/estat_fixa",
        revision: String(Date.parse("2026-03-01T00:00:00.000Z") * 1000),
      },
    ]);

    const check = await checkCatalogNewData("entry-1");

    expect(check.status).toBe("new-data");
    expect(check.updatedAssets[0].updateTime).toBe("2026-03-01T00:00:00.000Z");
  });

  it("não consulta o Earth Engine quando o índice nunca foi validado", async () => {
    mocks.getCatalogEntry.mockResolvedValue(
      catalogEntry({ validation: undefined }),
    );

    const check = await checkCatalogNewData("entry-1");

    expect(check.status).toBe("never-validated");
    expect(mocks.getStatisticsAssetIds).not.toHaveBeenCalled();
  });

  // Regressão: a primeira versão lia `source.asset.type` direto e devolvia 502
  // (`Cannot read properties of undefined`) nos índices de planilha, que não
  // têm asset nenhum — `municipal-spreadsheet` e `amfe-sheet-column`.
  it.each(["municipal-spreadsheet", "amfe-sheet-column"])(
    "dispensa a verificação num índice de planilha (%s)",
    async (kind) => {
      mocks.getCatalogEntry.mockResolvedValue(
        catalogEntry({ statisticsSource: { kind, column: "pct_2022" } }),
      );

      const check = await checkCatalogNewData("entry-1");

      expect(check.status).toBe("not-applicable");
      expect(mocks.getStatisticsAssetIds).not.toHaveBeenCalled();
    },
  );

  it("recusa um índice legado adotado só na apresentação", async () => {
    mocks.getCatalogEntry.mockResolvedValue({
      item: {
        catalogConfig: { schemaVersion: 2, managedScope: "presentation" },
      },
    });

    await expect(checkCatalogNewData("entry-1")).rejects.toThrow(/legado/iu);
  });
});
