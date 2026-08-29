import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildStatisticsRowsCacheKey,
  clearGeeStatisticsRowsCache,
  getOrLoadStatisticsRows,
} from "@/repositories/platform/geeStatisticsRowsCache";

/** Leitura falsa do Earth Engine que conta quantas vezes foi acionada. */
class FakeStatisticsReader {
  calls = 0;

  constructor(private readonly rows: Record<string, unknown>[]) {}

  read = () => {
    this.calls += 1;
    return new Promise<Record<string, unknown>[]>((resolve) => {
      queueMicrotask(() => resolve(this.rows));
    });
  };
}

const ROWS = [
  { data_img: "2025-06-01", NIVEL_AGRUPAMENTO: "1_BR" },
  { data_img: "2025-07-01", NIVEL_AGRUPAMENTO: "1_BR" },
];

describe("chave do cache de linhas estatísticas", () => {
  it("separa territórios e conjuntos de propriedades no mesmo asset", () => {
    const forBrazil = buildStatisticsRowsCacheKey(["asset"], "br", ["a", "b"]);

    expect(forBrazil).not.toBe(
      buildStatisticsRowsCacheKey(["asset"], "pb", ["a", "b"]),
    );
    expect(forBrazil).not.toBe(
      buildStatisticsRowsCacheKey(["asset"], "br", ["a", "b", "media"]),
    );
  });

  // Sem isto, uma leitura de um período só responderia por toda a série: o
  // painel mostraria os demais anos vazios porque a entrada em cache não os
  // cobre.
  it("separa coberturas de assets diferentes", () => {
    const partial = buildStatisticsRowsCacheKey(["t_2020"], "br", ["ano"]);
    const full = buildStatisticsRowsCacheKey(["t_2020", "t_2021"], "br", [
      "ano",
    ]);

    expect(partial).not.toBe(full);
    expect(full).toBe(
      buildStatisticsRowsCacheKey(["t_2020", "t_2021"], "br", ["ano"]),
    );
  });

  it("mantém o primeiro asset legível na chave", () => {
    expect(
      buildStatisticsRowsCacheKey(["projects/x/t_2020"], "br", ["ano"]),
    ).toContain("projects/x/t_2020");
  });
});

describe("cache de linhas estatísticas", () => {
  beforeEach(() => {
    clearGeeStatisticsRowsCache();
  });

  it("lê o Earth Engine uma vez só quando vários períodos pedem juntos", async () => {
    const reader = new FakeStatisticsReader(ROWS);
    const key = buildStatisticsRowsCacheKey(["asset"], "br", ["data_img"]);

    // É o caso real: ao abrir a camada, o painel dispara um pedido por período
    // ao mesmo tempo, todos apontando para o mesmo território.
    const results = await Promise.all(
      Array.from({ length: 30 }, () =>
        getOrLoadStatisticsRows(key, reader.read),
      ),
    );

    expect(reader.calls).toBe(1);
    expect(results).toHaveLength(30);
    results.forEach((rows) => expect(rows).toEqual(ROWS));
  });

  it("reaproveita a leitura já concluída", async () => {
    const reader = new FakeStatisticsReader(ROWS);
    const key = buildStatisticsRowsCacheKey(["asset"], "br", ["data_img"]);

    await getOrLoadStatisticsRows(key, reader.read);
    await getOrLoadStatisticsRows(key, reader.read);

    expect(reader.calls).toBe(1);
  });

  it("não mistura territórios diferentes", async () => {
    const brazil = new FakeStatisticsReader(ROWS);
    const paraiba = new FakeStatisticsReader([]);

    await getOrLoadStatisticsRows(
      buildStatisticsRowsCacheKey(["asset"], "br", ["data_img"]),
      brazil.read,
    );
    await getOrLoadStatisticsRows(
      buildStatisticsRowsCacheKey(["asset"], "pb", ["data_img"]),
      paraiba.read,
    );

    expect(brazil.calls).toBe(1);
    expect(paraiba.calls).toBe(1);
  });

  it("volta a ler depois que a publicação do catálogo limpa o cache", async () => {
    const reader = new FakeStatisticsReader(ROWS);
    const key = buildStatisticsRowsCacheKey(["asset"], "br", ["data_img"]);

    await getOrLoadStatisticsRows(key, reader.read);
    clearGeeStatisticsRowsCache();
    await getOrLoadStatisticsRows(key, reader.read);

    expect(reader.calls).toBe(2);
  });

  it("não deixa uma leitura que falhou presa como pendente", async () => {
    const key = buildStatisticsRowsCacheKey(["asset"], "br", ["data_img"]);
    const failing = () =>
      Promise.reject(new Error("Earth Engine indisponível"));

    await expect(getOrLoadStatisticsRows(key, failing)).rejects.toThrow(
      "Earth Engine indisponível",
    );

    const reader = new FakeStatisticsReader(ROWS);
    await expect(getOrLoadStatisticsRows(key, reader.read)).resolves.toEqual(
      ROWS,
    );
    expect(reader.calls).toBe(1);
  });
});
