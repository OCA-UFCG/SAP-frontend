import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/infrastructure/earth-engine/client", () => ({
  initializeGee: vi.fn().mockResolvedValue(undefined),
  listGeeFolderAssetUpdateTimes: vi.fn(),
}));
vi.mock("@/repositories/platform/geeStatisticsRepository", () => ({
  clearGeeStatisticsSchemaCache: vi.fn(),
}));

import { listGeeFolderAssetUpdateTimes } from "@/infrastructure/earth-engine/client";
import { checkStatisticsAssetRevisions } from "@/repositories/platform/geeStatisticsAssetRevisions";
import { clearGeeStatisticsSchemaCache } from "@/repositories/platform/geeStatisticsRepository";
import {
  buildStatisticsRowsCacheKey,
  clearGeeStatisticsRowsCache,
  getOrLoadStatisticsRows,
} from "@/repositories/platform/geeStatisticsRowsCache";
import {
  listMunicipalTableSnapshots,
  writeMunicipalTableSnapshot,
} from "@/repositories/platform/municipalTableSnapshot";

const FOLDER = "projects/x/assets/Estatisticas";
const ANA_2025 = `${FOLDER}/ANA_2025`;
const ANA_2026 = `${FOLDER}/ANA_2026`;
const ARIDEZ = `${FOLDER}/Aridez`;
const HOUR = 60 * 60 * 1000;
const READ_AT = Date.parse("2026-10-16T08:00:00Z");

const listFolder = vi.mocked(listGeeFolderAssetUpdateTimes);

/** Um leitor falso que conta as idas ao Earth Engine de um recorte. */
function reader() {
  const read = vi.fn(() => Promise.resolve([{ ano: 2025 }]));
  return read;
}

async function cache(assetIds: string[], read = reader()) {
  await getOrLoadStatisticsRows(
    buildStatisticsRowsCacheKey(assetIds, "br", ["ano"]),
    read,
    assetIds,
  );
  return read;
}

function folderWith(times: Record<string, number>) {
  listFolder.mockResolvedValue(new Map(Object.entries(times)));
}

let snapshotDir: string;

beforeEach(async () => {
  snapshotDir = await mkdtemp(path.join(os.tmpdir(), "sedes-revisions-"));
  vi.stubEnv("MUNICIPAL_TABLE_SNAPSHOT_DIR", snapshotDir);
  vi.useFakeTimers();
  vi.setSystemTime(READ_AT);
  clearGeeStatisticsRowsCache();
  delete (globalThis as { __geeStatisticsListedAssets?: unknown })
    .__geeStatisticsListedAssets;
  listFolder.mockReset();
  vi.mocked(clearGeeStatisticsSchemaCache).mockClear();
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  await rm(snapshotDir, { recursive: true, force: true });
});

describe("checagem das tabelas alteradas no Earth Engine", () => {
  it("descarta só o recorte cuja tabela mudou depois da leitura", async () => {
    const ana = await cache([ANA_2025, ANA_2026]);
    const aridez = await cache([ARIDEZ]);
    folderWith({
      [ANA_2025]: READ_AT - 30 * 24 * HOUR,
      [ANA_2026]: READ_AT + HOUR,
      [ARIDEZ]: READ_AT - 30 * 24 * HOUR,
    });
    vi.setSystemTime(READ_AT + 2 * HOUR);

    const result = await checkStatisticsAssetRevisions();
    await cache([ANA_2025, ANA_2026], ana);
    await cache([ARIDEZ], aridez);

    expect(result).toEqual({
      listedFolders: 1,
      invalidatedEntries: 1,
      removedMunicipalTables: 0,
    });
    expect(ana).toHaveBeenCalledTimes(2);
    expect(aridez).toHaveBeenCalledTimes(1);
    expect(clearGeeStatisticsSchemaCache).toHaveBeenCalledOnce();
  });

  it("não descarta nada quando nenhuma tabela mudou", async () => {
    const ana = await cache([ANA_2025]);
    folderWith({ [ANA_2025]: READ_AT - 30 * 24 * HOUR });

    await checkStatisticsAssetRevisions();
    await cache([ANA_2025], ana);

    expect(ana).toHaveBeenCalledOnce();
    expect(clearGeeStatisticsSchemaCache).not.toHaveBeenCalled();
  });

  it("lista cada pasta uma vez só", async () => {
    await cache([ANA_2025, ANA_2026]);
    await cache([ARIDEZ, "projects/x/assets/Outra/Tabela"]);
    folderWith({});

    await checkStatisticsAssetRevisions();

    expect(listFolder.mock.calls.map(([folder]) => folder).sort()).toEqual([
      FOLDER,
      "projects/x/assets/Outra",
    ]);
  });

  // A série lida sem um ano que ainda não existia fica em cache; quando a
  // tabela desse ano aparece, a próxima leitura precisa incluí-la.
  it("descarta o recorte quando aparece a tabela que faltava na leitura", async () => {
    const ana = await cache([ANA_2025, ANA_2026]);
    folderWith({ [ANA_2025]: READ_AT - 30 * 24 * HOUR });
    await checkStatisticsAssetRevisions();

    folderWith({
      [ANA_2025]: READ_AT - 30 * 24 * HOUR,
      [ANA_2026]: READ_AT + HOUR,
    });
    vi.setSystemTime(READ_AT + 2 * HOUR);
    await checkStatisticsAssetRevisions();
    await cache([ANA_2025, ANA_2026], ana);

    expect(ana).toHaveBeenCalledTimes(2);
  });

  it("descarta o recorte quando uma tabela lida é apagada", async () => {
    const ana = await cache([ANA_2025, ANA_2026]);
    folderWith({
      [ANA_2025]: READ_AT - 30 * 24 * HOUR,
      [ANA_2026]: READ_AT - 30 * 24 * HOUR,
    });
    await checkStatisticsAssetRevisions();

    folderWith({ [ANA_2025]: READ_AT - 30 * 24 * HOUR });
    await checkStatisticsAssetRevisions();
    await cache([ANA_2025, ANA_2026], ana);

    expect(ana).toHaveBeenCalledTimes(2);
  });

  it("não descarta por uma tabela que nunca existiu", async () => {
    const ana = await cache([ANA_2025, ANA_2026]);
    folderWith({ [ANA_2025]: READ_AT - 30 * 24 * HOUR });

    await checkStatisticsAssetRevisions();
    await checkStatisticsAssetRevisions();
    await cache([ANA_2025, ANA_2026], ana);

    expect(ana).toHaveBeenCalledOnce();
  });

  // Uma leitura feita logo depois da troca pode ainda ter visto a versão antiga.
  it("refaz uma vez a leitura feita logo depois da alteração", async () => {
    const ana = await cache([ANA_2025]);
    folderWith({ [ANA_2025]: READ_AT - 60_000 });

    await checkStatisticsAssetRevisions();
    // A releitura acontece no uso seguinte, já longe da alteração.
    vi.setSystemTime(READ_AT + 10 * 60_000);
    await cache([ANA_2025], ana);
    await checkStatisticsAssetRevisions();
    await cache([ANA_2025], ana);

    expect(ana).toHaveBeenCalledTimes(2);
  });

  it("mantém o cache da pasta que não pôde ser listada", async () => {
    const ana = await cache([ANA_2025]);
    listFolder.mockRejectedValue(new Error("Earth Engine indisponível"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(checkStatisticsAssetRevisions()).resolves.toEqual({
      listedFolders: 0,
      invalidatedEntries: 0,
      removedMunicipalTables: 0,
    });
    await cache([ANA_2025], ana);

    expect(ana).toHaveBeenCalledOnce();
  });

  it("não consulta o Earth Engine com o cache vazio", async () => {
    await checkStatisticsAssetRevisions();

    expect(listFolder).not.toHaveBeenCalled();
  });

  describe("arquivos das tabelas municipais", () => {
    const layout = {
      columns: ["NIVEL_AGRUPAMENTO", "CD_MUN", "ano"],
      levelProperty: "NIVEL_AGRUPAMENTO",
      municipalityCodeProperty: "CD_MUN",
    };

    async function saveTable(assetId: string, readAt: number) {
      await writeMunicipalTableSnapshot(
        assetId,
        layout,
        [["7_Municipio", "2507507", 2025]],
        readAt,
      );
    }

    /** O recorte de um município lido do arquivo, em memória desde agora. */
    async function cacheMunicipality(assetIds: string[], read = reader()) {
      await getOrLoadStatisticsRows(
        buildStatisticsRowsCacheKey(assetIds, "2507507", ["ano"]),
        read,
        assetIds,
      );
      return read;
    }

    it("apaga o arquivo da tabela que mudou e o recorte lido dele, mesmo lido do disco depois da mudança", async () => {
      await saveTable(ANA_2025, READ_AT - 30 * 24 * HOUR);
      await saveTable(ARIDEZ, READ_AT - 30 * 24 * HOUR);
      const municipality = await cacheMunicipality([ANA_2025]);
      folderWith({
        [ANA_2025]: READ_AT - HOUR,
        [ARIDEZ]: READ_AT - 40 * 24 * HOUR,
      });

      const result = await checkStatisticsAssetRevisions();
      await cacheMunicipality([ANA_2025], municipality);

      expect(result.removedMunicipalTables).toBe(1);
      expect(
        (await listMunicipalTableSnapshots()).map(({ assetId }) => assetId),
      ).toEqual([ARIDEZ]);
      expect(municipality).toHaveBeenCalledTimes(2);
      expect(clearGeeStatisticsSchemaCache).toHaveBeenCalled();
    });

    it("confere as tabelas dos arquivos mesmo com o cache em memória vazio", async () => {
      await saveTable(ANA_2025, READ_AT - 30 * 24 * HOUR);
      folderWith({ [ANA_2025]: READ_AT - 40 * 24 * HOUR });

      const result = await checkStatisticsAssetRevisions();

      expect(listFolder).toHaveBeenCalledWith(FOLDER);
      expect(result).toEqual({
        listedFolders: 1,
        invalidatedEntries: 0,
        removedMunicipalTables: 0,
      });
      expect(await listMunicipalTableSnapshots()).toHaveLength(1);
    });
  });
});
