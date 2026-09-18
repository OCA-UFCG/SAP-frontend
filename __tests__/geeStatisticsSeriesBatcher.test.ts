import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  readStatisticsSeries,
  SERIES_ASSETS_PER_REQUEST,
  setMergedCollectionsEvaluator,
  STATISTICS_OWNER_PROPERTY,
} from "@/repositories/platform/geeStatisticsSeriesBatcher";

interface FakeCollection {
  assetId: string;
  ownerTag: number;
}

/**
 * Earth Engine falso: devolve uma linha por asset, já marcada com o dono, que é
 * o que o Earth Engine de verdade faz quando a sub-coleção aplica
 * `toDictionary(...).set(STATISTICS_OWNER_PROPERTY, tag)`.
 */
class FakeMergedEvaluator {
  readonly groups: string[][] = [];
  brokenAssetIds: string[] = [];
  omitOwnerTag = false;

  evaluate = async (
    collections: readonly unknown[],
    assetIds: readonly string[],
  ) => {
    this.groups.push([...assetIds]);
    const broken = assetIds.filter((assetId) =>
      this.brokenAssetIds.includes(assetId),
    );
    if (broken.length > 0) {
      throw new Error(`Collection asset '${broken[0]}' not found.`);
    }

    return (collections as FakeCollection[]).map(({ assetId, ownerTag }) => ({
      asset: assetId,
      ...(this.omitOwnerTag ? {} : { [STATISTICS_OWNER_PROPERTY]: ownerTag }),
    }));
  };
}

let evaluator: FakeMergedEvaluator;

function readSeries(assetIds: readonly string[]) {
  return readStatisticsSeries(
    assetIds.map((assetId) => ({
      assetId,
      buildCollection: (ownerTag: number) => ({ assetId, ownerTag }),
    })),
  );
}

beforeEach(() => {
  evaluator = new FakeMergedEvaluator();
  setMergedCollectionsEvaluator(evaluator.evaluate);
});

describe("leitura conjunta de séries estatísticas", () => {
  // Regressão de desempenho: cada camada do relatório municipal era uma ida
  // própria ao Earth Engine, e o SDK espaça o despacho em 350 ms.
  it("junta numa ida só as séries pedidas na mesma janela", async () => {
    const [aridez, seca] = await Promise.all([
      readSeries(["aridez_2023", "aridez_2024"]),
      readSeries(["seca_2024"]),
    ]);

    expect(evaluator.groups).toEqual([
      ["aridez_2023", "aridez_2024", "seca_2024"],
    ]);
    expect(aridez.rows.map((row) => row.asset)).toEqual([
      "aridez_2023",
      "aridez_2024",
    ]);
    expect(seca.rows.map((row) => row.asset)).toEqual(["seca_2024"]);
  });

  it("não deixa a marcação de dono vazar para quem consome as linhas", async () => {
    const { rows } = await readSeries(["aridez_2024"]);

    expect(rows[0]).not.toHaveProperty(STATISTICS_OWNER_PROPERTY);
  });

  it("respeita o teto de assets por ida ao Earth Engine", async () => {
    const assetIds = Array.from(
      { length: SERIES_ASSETS_PER_REQUEST + 2 },
      (_, index) => `aridez_${index}`,
    );

    await readSeries(assetIds);

    expect(evaluator.groups.map((group) => group.length)).toEqual([
      SERIES_ASSETS_PER_REQUEST,
      2,
    ]);
  });

  it("entrega as séries em pedidos separados quando saem de janelas diferentes", async () => {
    await readSeries(["aridez_2024"]);
    await readSeries(["seca_2024"]);

    expect(evaluator.groups).toEqual([["aridez_2024"], ["seca_2024"]]);
  });
});

/**
 * Regressão: o Monitor de Secas da ANA sumiu do painel e do relatório porque a
 * tabela de 2026 estava sendo reingerida e ia no mesmo `flatten()` dos outros
 * anos. Agora o mesmo pedido carrega assets de camadas diferentes, então a
 * releitura precisa devolver cada camada que respondeu.
 */
describe("asset indisponível dentro do pedido conjunto", () => {
  it("relê asset a asset e mantém as séries que responderam", async () => {
    evaluator.brokenAssetIds = ["seca_2026"];

    const [aridez, seca] = await Promise.all([
      readSeries(["aridez_2024"]),
      readSeries(["seca_2025", "seca_2026"]),
    ]);

    expect(aridez.rows.map((row) => row.asset)).toEqual(["aridez_2024"]);
    expect(seca.rows.map((row) => row.asset)).toEqual(["seca_2025"]);
    expect(seca.unavailableAssetIds).toEqual(["seca_2026"]);
  });

  it("informa todos os assets de uma série que não respondeu, com o erro", async () => {
    evaluator.brokenAssetIds = ["seca_2025", "seca_2026"];

    const [, seca] = await Promise.all([
      readSeries(["aridez_2024"]),
      readSeries(["seca_2025", "seca_2026"]),
    ]);

    expect(seca.unavailableAssetIds).toEqual(["seca_2025", "seca_2026"]);
    expect(seca.firstError).toBeInstanceOf(Error);
  });

  // Uma linha entregue ao dono errado não apareceria como erro: apareceria como
  // número de outra camada dentro do relatório.
  it("relê asset a asset quando a resposta conjunta vem sem a marcação de dono", async () => {
    evaluator.omitOwnerTag = true;

    const [aridez, seca] = await Promise.all([
      readSeries(["aridez_2024"]),
      readSeries(["seca_2024"]),
    ]);

    expect(evaluator.groups).toEqual([
      ["aridez_2024", "seca_2024"],
      ["aridez_2024"],
      ["seca_2024"],
    ]);
    expect(aridez.rows.map((row) => row.asset)).toEqual(["aridez_2024"]);
    expect(seca.rows.map((row) => row.asset)).toEqual(["seca_2024"]);
  });
});
