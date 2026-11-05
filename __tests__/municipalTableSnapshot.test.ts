import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  listMunicipalTableSnapshots,
  readMunicipalTableRows,
  removeMunicipalTableSnapshot,
  writeMunicipalTableSnapshot,
} from "@/repositories/platform/municipalTableSnapshot";

const ASSET = "projects/example/assets/Estatisticas/T_2024";
const layout = {
  columns: ["NIVEL_AGRUPAMENTO", "CD_MUN", "ano", "classe_1", "classe_2"],
  levelProperty: "NIVEL_AGRUPAMENTO",
  municipalityCodeProperty: "CD_MUN",
};

let snapshotDir: string;

beforeEach(async () => {
  snapshotDir = await mkdtemp(
    path.join(os.tmpdir(), "sedes-municipal-tables-"),
  );
  vi.stubEnv("MUNICIPAL_TABLE_SNAPSHOT_DIR", snapshotDir);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(snapshotDir, { recursive: true, force: true });
});

describe("tabelas municipais gravadas em disco", () => {
  it("devolve as linhas de um município com as colunas pedidas, como o Earth Engine", async () => {
    await writeMunicipalTableSnapshot(
      ASSET,
      layout,
      [
        ["7_Municipio", "2507507", 2023, 40.123456789, 59.876543211],
        ["7_Municipio", "1100015", 2023, 100, 0],
        ["7_Municipio", "2507507", 2024, 10, 90],
        ["7_Municipio", "5300108", 2024, 0, 100],
      ],
      1_700_000_000_000,
    );

    expect(
      await readMunicipalTableRows(ASSET, "2507507", ["ano", "classe_1"]),
    ).toEqual([
      { ano: 2023, classe_1: 40.123456789 },
      { ano: 2024, classe_1: 10 },
    ]);
    expect(
      await readMunicipalTableRows(ASSET, "1100015", ["CD_MUN", "classe_2"]),
    ).toEqual([{ CD_MUN: "1100015", classe_2: 0 }]);
    expect(await readMunicipalTableRows(ASSET, "5300108", ["ano"])).toEqual([
      { ano: 2024 },
    ]);
  });

  it("um município fora da tabela tem lista vazia, não falta de arquivo", async () => {
    await writeMunicipalTableSnapshot(
      ASSET,
      layout,
      [["7_Municipio", "2507507", 2024, 10, 90]],
      1,
    );

    expect(await readMunicipalTableRows(ASSET, "2504009", ["ano"])).toEqual([]);
  });

  it("sem arquivo, com coluna que o arquivo não tem ou com arquivo estragado, manda ler do Earth Engine", async () => {
    expect(await readMunicipalTableRows(ASSET, "2507507", ["ano"])).toBeNull();

    await writeMunicipalTableSnapshot(
      ASSET,
      layout,
      [["7_Municipio", "2507507", 2024, 10, 90]],
      1,
    );
    expect(
      await readMunicipalTableRows(ASSET, "2507507", ["ano", "media_Carbono"]),
    ).toBeNull();

    await writeFile(
      path.join(snapshotDir, `${encodeURIComponent(ASSET)}.sedestb`),
      "não é uma tabela",
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await readMunicipalTableRows(ASSET, "2507507", ["ano"])).toBeNull();
    warn.mockRestore();
  });

  it("lista as tabelas gravadas com a hora da leitura e o que é preciso para relê-las", async () => {
    await writeMunicipalTableSnapshot(
      ASSET,
      layout,
      [["7_Municipio", "2507507", 2024, 10, 90]],
      1_700_000_000_000,
    );

    expect(await listMunicipalTableSnapshots()).toEqual([
      { assetId: ASSET, readAt: 1_700_000_000_000, ...layout },
    ]);

    await removeMunicipalTableSnapshot(ASSET);
    expect(await listMunicipalTableSnapshots()).toEqual([]);
    expect(await readMunicipalTableRows(ASSET, "2507507", ["ano"])).toBeNull();
  });

  it("sem a pasta, não há tabelas", async () => {
    vi.stubEnv("MUNICIPAL_TABLE_SNAPSHOT_DIR", path.join(snapshotDir, "nada"));

    expect(await listMunicipalTableSnapshots()).toEqual([]);
  });
});
