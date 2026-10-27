import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@google/earthengine", () => ({ default: {} }));
vi.mock("@/infrastructure/earth-engine/client", () => ({
  evaluateGeeObject: vi.fn(),
  initializeGee: vi.fn(),
}));

import type { PublishedGeeStatisticsSource } from "@/contracts/geeStatistics";
import { initializeGee } from "@/infrastructure/earth-engine/client";
import { getGeeStatisticsMunicipalitiesYearValues } from "@/repositories/platform/geeStatisticsRepository";
import {
  readMunicipalStatisticsSnapshot,
  writeMunicipalStatisticsSnapshot,
} from "@/repositories/platform/municipalStatisticsSnapshot";

const source = {
  kind: "gee-feature-collection",
  schemaVersion: 1,
  sourceRevision: "rev-1",
  asset: { type: "fixed", assetId: "projects/example/assets/ana" },
  periodGranularity: "month",
  properties: {
    level: "NIVEL_AGRUPAMENTO",
    locationName: "NOME_LOCAL",
    municipalityCode: "CD_MUN",
    stateCode: "NM_UF",
    year: "ano",
    date: "data_img",
    totalArea: "area_total_ha",
  },
} as PublishedGeeStatisticsSource;

const identity = {
  assetId: "projects/example/assets/ana",
  sourceRevision: "rev-1",
  classCount: 3,
};

let snapshotDir: string;

beforeEach(async () => {
  snapshotDir = await mkdtemp(path.join(os.tmpdir(), "sedes-municipal-stats-"));
  vi.stubEnv("MUNICIPAL_STATISTICS_SNAPSHOT_DIR", snapshotDir);
  vi.mocked(initializeGee).mockClear();
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(snapshotDir, { recursive: true, force: true });
});

describe("estatísticas dos municípios gravadas no deploy", () => {
  it("guarda os percentuais com as duas casas que a lista mostra", async () => {
    await writeMunicipalStatisticsSnapshot("anaseca", "2026-09", identity, {
      "2507507": [49.70286444062753, 25.15742852287414, 25.139707036498326],
    });

    expect(
      await readMunicipalStatisticsSnapshot("anaseca", "2026-09", identity),
    ).toEqual({ "2507507": [49.7, 25.16, 25.14] });
  });

  it("não vale para outra tabela, outra revisão do catálogo ou outra legenda", async () => {
    await writeMunicipalStatisticsSnapshot("anaseca", "2026-09", identity, {
      "2507507": [0, 100, 0],
    });

    for (const other of [
      { ...identity, assetId: "projects/example/assets/ana_v2" },
      { ...identity, sourceRevision: "rev-2" },
      { ...identity, classCount: 4 },
    ]) {
      expect(
        await readMunicipalStatisticsSnapshot("anaseca", "2026-09", other),
      ).toBeNull();
    }
  });

  it("responde a lista de municípios sem ir ao Earth Engine", async () => {
    await writeMunicipalStatisticsSnapshot("anaseca", "2026-09", identity, {
      "2507507": [0, 100, 0],
    });

    await expect(
      getGeeStatisticsMunicipalitiesYearValues("anaseca", "2026-09", 3, source),
    ).resolves.toEqual({ "2507507": [0, 100, 0] });
    expect(initializeGee).not.toHaveBeenCalled();
  });

  it("lê do Earth Engine um período sem arquivo", async () => {
    // O `ee` falso não monta a consulta; o que importa é ter ido até ele.
    await getGeeStatisticsMunicipalitiesYearValues(
      "anaseca",
      "2026-10",
      3,
      source,
    ).catch(() => undefined);

    expect(initializeGee).toHaveBeenCalled();
  });
});
