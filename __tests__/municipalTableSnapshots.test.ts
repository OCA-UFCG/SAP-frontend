import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: vi.fn(),
}));
vi.mock("@/repositories/platform/geeStatisticsRepository", () => ({
  describeGeeStatisticsMunicipalTables: vi.fn(),
  readGeeStatisticsMunicipalTable: vi.fn(),
}));
vi.mock("@/utils/imageData", () => ({
  isCompactImageData: (imageData: { type?: string } | null) =>
    imageData?.type === "territorial-compact",
}));

import {
  describeGeeStatisticsMunicipalTables,
  readGeeStatisticsMunicipalTable,
} from "@/repositories/platform/geeStatisticsRepository";
import {
  listMunicipalTableSnapshots,
  writeMunicipalTableSnapshot,
} from "@/repositories/platform/municipalTableSnapshot";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import {
  planMunicipalTables,
  refreshMissingMunicipalTables,
} from "@/services/municipalTableSnapshots";
import type { PanelLayerI } from "@/utils/interfaces";

const T_2024 = "projects/x/assets/Estatisticas/T_2024";
const T_2025 = "projects/x/assets/Estatisticas/T_2025";
const layout = {
  columns: ["NIVEL_AGRUPAMENTO", "CD_MUN", "ano", "perc_classe_1"],
  levelProperty: "NIVEL_AGRUPAMENTO",
  municipalityCodeProperty: "CD_MUN",
};

function layer(id: string): PanelLayerI {
  return {
    id,
    statisticsSource: { kind: "gee-feature-collection" },
    imageData: {
      type: "territorial-compact",
      years: { "2024": {}, "2025": {} },
    },
  } as unknown as PanelLayerI;
}

const describeTables = vi.mocked(describeGeeStatisticsMunicipalTables);
const readTable = vi.mocked(readGeeStatisticsMunicipalTable);

let rootDir: string;
let snapshotDir: string;

beforeEach(async () => {
  rootDir = await mkdtemp(path.join(os.tmpdir(), "sedes-tables-service-"));
  snapshotDir = path.join(rootDir, "municipal-tables");
  vi.stubEnv("MUNICIPAL_TABLE_SNAPSHOT_DIR", snapshotDir);
  (
    globalThis as { __municipalTablesFailedAt?: Map<string, number> }
  ).__municipalTablesFailedAt?.clear();
  vi.mocked(getPanelLayers).mockResolvedValue([layer("ana")]);
  describeTables.mockReset().mockResolvedValue({
    assetIds: [T_2024, T_2025],
    layout,
  });
  readTable
    .mockReset()
    .mockResolvedValue([["7_Municipio", "2507507", 2024, 100]]);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  await rm(rootDir, { recursive: true, force: true });
});

describe("tabelas municipais em disco", () => {
  it("soma num arquivo só as colunas de duas camadas na mesma tabela", async () => {
    vi.mocked(getPanelLayers).mockResolvedValue([layer("ana"), layer("outra")]);
    describeTables
      .mockResolvedValueOnce({ assetIds: [T_2024], layout })
      .mockResolvedValueOnce({
        assetIds: [T_2024],
        layout: { ...layout, columns: [...layout.columns, "media_Carbono"] },
      });

    expect(await planMunicipalTables()).toEqual(
      new Map([
        [T_2024, { ...layout, columns: [...layout.columns, "media_Carbono"] }],
      ]),
    );
  });

  it("fora da imagem do deploy, sem a pasta, não lê nada do Earth Engine", async () => {
    expect(await refreshMissingMunicipalTables()).toEqual({
      built: 0,
      failed: 0,
    });
    expect(getPanelLayers).not.toHaveBeenCalled();
    expect(readTable).not.toHaveBeenCalled();
  });

  it("grava só a tabela que falta ou que não tem todas as colunas", async () => {
    await mkdir(snapshotDir);
    await writeMunicipalTableSnapshot(T_2024, layout, [], 1);
    await writeMunicipalTableSnapshot(
      T_2025,
      { ...layout, columns: layout.columns.slice(0, 3) },
      [],
      1,
    );
    describeTables.mockResolvedValue({
      assetIds: [T_2024, T_2025, "projects/x/assets/Estatisticas/T_2026"],
      layout,
    });

    expect(await refreshMissingMunicipalTables()).toEqual({
      built: 2,
      failed: 0,
    });
    expect(readTable.mock.calls.map(([assetId]) => assetId)).toEqual([
      T_2025,
      "projects/x/assets/Estatisticas/T_2026",
    ]);
    expect(
      (await listMunicipalTableSnapshots())
        .map(({ assetId }) => assetId)
        .sort(),
    ).toEqual([T_2024, T_2025, "projects/x/assets/Estatisticas/T_2026"]);
  });

  it("não relê a cada volta uma tabela que acabou de falhar", async () => {
    await mkdir(snapshotDir);
    readTable.mockRejectedValue(new Error("célula vazia"));

    expect(await refreshMissingMunicipalTables()).toEqual({
      built: 0,
      failed: 2,
    });
    expect(await refreshMissingMunicipalTables()).toEqual({
      built: 0,
      failed: 0,
    });
    expect(readTable).toHaveBeenCalledTimes(2);
  });
});
