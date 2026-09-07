import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    vi.unstubAllEnvs();
    clearGeeStatisticsRowsCache();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it("descarta as entradas mais antigas quando o total de linhas estoura o teto", async () => {
    vi.stubEnv("GEE_STATISTICS_ROWS_CACHE_MAX_ROWS", "8");
    const wideRows = Array.from({ length: 4 }, (_, index) => ({
      data_img: `2025-0${index + 1}-01`,
    }));
    const readers = ["uf-25", "uf-26", "uf-27"].map(
      () => new FakeStatisticsReader(wideRows),
    );
    const keys = ["uf-25", "uf-26", "uf-27"].map((scope) =>
      buildStatisticsRowsCacheKey(["asset"], scope, ["data_img"]),
    );

    for (const [index, key] of keys.entries()) {
      await getOrLoadStatisticsRows(key, readers[index].read);
    }
    // A primeira UF já saiu para o total caber; a última continua em cache.
    await getOrLoadStatisticsRows(keys[0], readers[0].read);
    await getOrLoadStatisticsRows(keys[2], readers[2].read);

    expect(readers[0].calls).toBe(2);
    expect(readers[2].calls).toBe(1);
  });

  // As estatísticas vêm de assets publicados, que mudam quando alguém
  // republica o índice. Os dez minutos de antes eram herdados do cache de
  // conteúdo do Contentful e faziam a primeira leitura de cada estado — de 3 a
  // 6 s de Earth Engine — se repetir várias vezes por dia sem que o dado
  // tivesse mudado.
  it("guarda as linhas por doze horas, e não por dez minutos", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const key = buildStatisticsRowsCacheKey(["asset"], "uf-25", ["data_img"]);
    const reader = new FakeStatisticsReader(ROWS);

    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    await getOrLoadStatisticsRows(key, reader.read);

    vi.setSystemTime(new Date("2026-01-01T11:59:00Z"));
    await getOrLoadStatisticsRows(key, reader.read);
    expect(reader.calls).toBe(1);

    vi.setSystemTime(new Date("2026-01-01T12:01:00Z"));
    await getOrLoadStatisticsRows(key, reader.read);
    expect(reader.calls).toBe(2);
  });

  it("aceita outra validade em GEE_STATISTICS_ROWS_CACHE_TTL_SECONDS", async () => {
    vi.stubEnv("GEE_STATISTICS_ROWS_CACHE_TTL_SECONDS", "60");
    vi.useFakeTimers({ toFake: ["Date"] });
    const key = buildStatisticsRowsCacheKey(["asset"], "uf-29", ["data_img"]);
    const reader = new FakeStatisticsReader(ROWS);

    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    await getOrLoadStatisticsRows(key, reader.read);

    vi.setSystemTime(new Date("2026-01-01T00:02:00Z"));
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
