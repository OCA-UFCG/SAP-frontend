import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildStatisticsRowsCacheKey,
  clearGeeStatisticsRowsCache,
  getCachedStatisticsAssetReadTimes,
  getOrLoadStatisticsRows,
  getStatisticsRowsGeneration,
  GEE_STATISTICS_ROWS_CACHE_TTL_MS,
  invalidateStatisticsRows,
  MUNICIPALITIES_BY_PERIOD_LIMIT,
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

describe("validade das linhas guardadas", () => {
  beforeEach(() => {
    clearGeeStatisticsRowsCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Regressão: com 10 min de validade, três em cada quatro aberturas do
  // Detalhamento na produção achavam o cache vazio e esperavam o Earth Engine.
  it("continua servindo horas depois sem voltar ao Earth Engine", async () => {
    vi.useFakeTimers();
    const reader = new FakeStatisticsReader(ROWS);
    const key = buildStatisticsRowsCacheKey(["asset"], "br", ["data_img"]);

    await getOrLoadStatisticsRows(key, reader.read, ["asset"]);
    vi.advanceTimersByTime(8 * 60 * 60 * 1000);
    await getOrLoadStatisticsRows(key, reader.read, ["asset"]);

    expect(reader.calls).toBe(1);
  });

  it("passado o prazo, responde na hora com a entrada vencida e relê em segundo plano", async () => {
    vi.useFakeTimers();
    const oldRows = [{ data_img: "2025-06-01" }];
    const newRows = [{ data_img: "2025-07-01" }];
    const key = buildStatisticsRowsCacheKey(["asset"], "br", ["data_img"]);

    await getOrLoadStatisticsRows(key, () => Promise.resolve(oldRows), [
      "asset",
    ]);
    vi.advanceTimersByTime(GEE_STATISTICS_ROWS_CACHE_TTL_MS + 1);

    let resolveReload!: (rows: Record<string, unknown>[]) => void;
    const reload = vi.fn(
      () =>
        new Promise<Record<string, unknown>[]>((resolve) => {
          resolveReload = resolve;
        }),
    );

    await expect(getOrLoadStatisticsRows(key, reload, ["asset"])).resolves.toBe(
      oldRows,
    );
    expect(reload).toHaveBeenCalledOnce();

    resolveReload(newRows);
    await vi.waitFor(async () =>
      expect(await getOrLoadStatisticsRows(key, reload, ["asset"])).toBe(
        newRows,
      ),
    );
  });

  it("mantém a entrada vencida quando a releitura falha", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const key = buildStatisticsRowsCacheKey(["asset"], "br", ["data_img"]);

    await getOrLoadStatisticsRows(key, () => Promise.resolve(ROWS), ["asset"]);
    vi.advanceTimersByTime(GEE_STATISTICS_ROWS_CACHE_TTL_MS + 1);
    await getOrLoadStatisticsRows(
      key,
      () => Promise.reject(new Error("Earth Engine indisponível")),
      ["asset"],
    );
    await vi.waitFor(() => expect(warn).toHaveBeenCalledOnce());

    await expect(
      getOrLoadStatisticsRows(key, () => Promise.resolve([]), ["asset"]),
    ).resolves.toEqual(ROWS);
    warn.mockRestore();
  });
});

describe("descarte das linhas de uma tabela alterada", () => {
  beforeEach(() => {
    clearGeeStatisticsRowsCache();
  });

  it("descarta só as entradas que leram a tabela alterada", async () => {
    const changed = new FakeStatisticsReader(ROWS);
    const untouched = new FakeStatisticsReader(ROWS);
    const changedKey = buildStatisticsRowsCacheKey(["t_2024", "t_2025"], "br", [
      "ano",
    ]);
    const untouchedKey = buildStatisticsRowsCacheKey(["outra"], "br", ["ano"]);

    await getOrLoadStatisticsRows(changedKey, changed.read, [
      "t_2024",
      "t_2025",
    ]);
    await getOrLoadStatisticsRows(untouchedKey, untouched.read, ["outra"]);

    expect(invalidateStatisticsRows((assetId) => assetId === "t_2025")).toBe(1);

    await getOrLoadStatisticsRows(changedKey, changed.read, [
      "t_2024",
      "t_2025",
    ]);
    await getOrLoadStatisticsRows(untouchedKey, untouched.read, ["outra"]);
    expect(changed.calls).toBe(2);
    expect(untouched.calls).toBe(1);
  });

  it("informa quando cada tabela guardada foi lida", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    await getOrLoadStatisticsRows(
      buildStatisticsRowsCacheKey(["a", "b"], "br", ["ano"]),
      () => Promise.resolve(ROWS),
      ["a", "b"],
    );
    vi.setSystemTime(5_000);
    await getOrLoadStatisticsRows(
      buildStatisticsRowsCacheKey(["b"], "pb", ["ano"]),
      () => Promise.resolve(ROWS),
      ["b"],
    );
    vi.useRealTimers();

    expect(Object.fromEntries(getCachedStatisticsAssetReadTimes())).toEqual({
      a: 1_000,
      b: 1_000,
    });
  });

  it("muda a geração só quando algo é descartado", async () => {
    await getOrLoadStatisticsRows(
      buildStatisticsRowsCacheKey(["a"], "br", ["ano"]),
      () => Promise.resolve(ROWS),
      ["a"],
    );
    const before = getStatisticsRowsGeneration();

    invalidateStatisticsRows(() => false);
    expect(getStatisticsRowsGeneration()).toBe(before);

    invalidateStatisticsRows((assetId) => assetId === "a");
    expect(getStatisticsRowsGeneration()).toBe(before + 1);
  });

  // A leitura em voo pode ter visto a tabela antiga: ela responde a quem já
  // estava esperando, mas não pode ficar guardada como se fosse a nova.
  it("não guarda uma leitura que estava em voo quando a tabela mudou", async () => {
    const key = buildStatisticsRowsCacheKey(["a"], "br", ["ano"]);
    let resolveRead!: (rows: Record<string, unknown>[]) => void;
    const inFlight = getOrLoadStatisticsRows(
      key,
      () =>
        new Promise((resolve) => {
          resolveRead = resolve;
        }),
      ["a"],
    );

    await getOrLoadStatisticsRows(
      buildStatisticsRowsCacheKey(["outra"], "br", ["ano"]),
      () => Promise.resolve(ROWS),
      ["a"],
    );
    invalidateStatisticsRows((assetId) => assetId === "a");
    resolveRead(ROWS);
    await inFlight;

    const reader = new FakeStatisticsReader(ROWS);
    await getOrLoadStatisticsRows(key, reader.read, ["a"]);
    expect(reader.calls).toBe(1);
  });

  // Regressão do mesmo tipo da que já houve com as colunas: a subida do
  // servidor e a rota recebem cópias separadas do módulo.
  it("serve o que a subida leu a outra cópia do módulo, como a da rota", async () => {
    const key = buildStatisticsRowsCacheKey(["a"], "br", ["ano"]);
    await getOrLoadStatisticsRows(key, () => Promise.resolve(ROWS), ["a"]);

    vi.resetModules();
    const routeCopy =
      await import("@/repositories/platform/geeStatisticsRowsCache");
    const reader = new FakeStatisticsReader([]);

    await expect(
      routeCopy.getOrLoadStatisticsRows(key, reader.read, ["a"]),
    ).resolves.toEqual(ROWS);
    expect(reader.calls).toBe(0);
  });
});

describe("teto das entradas grandes", () => {
  beforeEach(() => {
    clearGeeStatisticsRowsCache();
  });

  it("descarta a entrada grande menos usada sem tocar nas pequenas", async () => {
    const limit = { ...MUNICIPALITIES_BY_PERIOD_LIMIT, maxEntries: 2 };
    const small = new FakeStatisticsReader(ROWS);
    const large = new FakeStatisticsReader(ROWS);

    await getOrLoadStatisticsRows("pequena", small.read, ["a"]);
    await getOrLoadStatisticsRows("grande-1", large.read, ["a"], limit);
    await getOrLoadStatisticsRows("grande-2", large.read, ["a"], limit);
    await getOrLoadStatisticsRows("grande-1", large.read, ["a"], limit);
    await getOrLoadStatisticsRows("grande-3", large.read, ["a"], limit);

    expect(large.calls).toBe(3);

    await getOrLoadStatisticsRows("grande-1", large.read, ["a"], limit);
    await getOrLoadStatisticsRows("pequena", small.read, ["a"]);
    expect(large.calls).toBe(3);
    expect(small.calls).toBe(1);

    await getOrLoadStatisticsRows("grande-2", large.read, ["a"], limit);
    expect(large.calls).toBe(4);
  });
});
