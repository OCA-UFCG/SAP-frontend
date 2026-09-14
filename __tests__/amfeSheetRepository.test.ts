import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { utils, write } from "xlsx";

// O repositório começa com `import "server-only"`, que estoura fora do
// servidor; o teste exercita a leitura da planilha, não o guard do Next.
vi.mock("server-only", () => ({}));

import type { AmfeSheetColumnStatisticsSource } from "@/contracts/amfeSheetColumn";
import {
  clearAmfeSheetCacheForTests,
  getAmfeSheetColumnYearPatch,
  getAmfeSheetTable,
} from "@/repositories/platform/amfeSheetRepository";

const source: AmfeSheetColumnStatisticsSource = {
  kind: "amfe-sheet-column",
  column: "ips",
  periodKey: "2024",
  aggregation: "mean",
};

/**
 * Uma planilha com as duas abas que a análise multicritério publica. A aba de
 * metadados tem uma linha de título antes do cabeçalho, como a de verdade.
 */
function buildWorkbookBytes(
  rows: Array<Record<string, unknown>> = [
    { CD_MUN: "2507507", NM_MUN: "João Pessoa", SIGLA_UF: "PB", ips: 60 },
    { CD_MUN: "3550308", NM_MUN: "São Paulo", SIGLA_UF: "SP", ips: 80 },
  ],
): ArrayBuffer {
  const workbook = utils.book_new();
  utils.book_append_sheet(
    workbook,
    utils.json_to_sheet(rows),
    "ia_spei_deg_pobrural",
  );
  const metadata = utils.aoa_to_sheet([
    ["Critérios da análise"],
    ["id", "título", "unit"],
    ["ips", "Índice de Progresso Social", ""],
  ]);
  utils.book_append_sheet(workbook, metadata, "criterios");

  return write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

describe("amfeSheetRepository", () => {
  beforeEach(() => {
    clearAmfeSheetCacheForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the criteria and the municipalities of the published workbook", async () => {
    const table = await getAmfeSheetTable({
      fetchWorkbook: async () => buildWorkbookBytes(),
    });

    expect(table.criteria).toEqual([
      {
        column: "ips",
        label: "Índice de Progresso Social",
        unit: "",
        description: "",
      },
    ]);
    expect(table.municipalities.map((entry) => entry.code)).toEqual([
      "2507507",
      "3550308",
    ]);
  });

  it("downloads the workbook once and serves the cached table afterwards", async () => {
    const fetchWorkbook = vi.fn(async () => buildWorkbookBytes());

    await getAmfeSheetTable({ fetchWorkbook });
    await getAmfeSheetTable({ fetchWorkbook });

    expect(fetchWorkbook).toHaveBeenCalledTimes(1);
  });

  // Sem o dedupe, abrir o catálogo e o painel ao mesmo tempo baixaria os ~900 KB
  // da planilha duas vezes.
  it("shares a single download between simultaneous readers", async () => {
    const fetchWorkbook = vi.fn(async () => buildWorkbookBytes());

    await Promise.all([
      getAmfeSheetTable({ fetchWorkbook }),
      getAmfeSheetTable({ fetchWorkbook }),
    ]);

    expect(fetchWorkbook).toHaveBeenCalledTimes(1);
  });

  it("serves the expired table when the refresh fails", async () => {
    let time = 0;
    const fetchWorkbook = vi
      .fn<() => Promise<ArrayBuffer>>()
      .mockResolvedValueOnce(buildWorkbookBytes())
      .mockRejectedValueOnce(new Error("Google Docs fora do ar"));

    const first = await getAmfeSheetTable({
      fetchWorkbook,
      now: () => time,
    });
    time = 1000 * 60 * 30;
    const second = await getAmfeSheetTable({ fetchWorkbook, now: () => time });

    expect(fetchWorkbook).toHaveBeenCalledTimes(2);
    expect(second).toBe(first);
  });

  it("fails when there is no previous table to fall back to", async () => {
    await expect(
      getAmfeSheetTable({
        fetchWorkbook: async () => {
          throw new Error("Google Docs fora do ar");
        },
      }),
    ).rejects.toThrow("Google Docs fora do ar");
  });

  it("refuses a workbook without the data tab", async () => {
    vi.stubEnv("AMFE_SHEET_DATA_TAB", "aba_que_nao_existe");

    await expect(
      getAmfeSheetTable({ fetchWorkbook: async () => buildWorkbookBytes() }),
    ).rejects.toThrow(/aba de dados "aba_que_nao_existe"/u);
  });
});

describe("getAmfeSheetColumnYearPatch", () => {
  beforeEach(() => {
    clearAmfeSheetCacheForTests();
  });

  it("derives Brazil and the states from the municipal rows", async () => {
    const patch = await getAmfeSheetColumnYearPatch(source, "2024", "br", {
      fetchWorkbook: async () => buildWorkbookBytes(),
    });

    expect(patch.locations?.br).toBe("Brasil");
    expect(patch.years?.["2024"].values.br).toEqual([70]);
    expect(patch.years?.["2024"].values.pb).toEqual([60]);
  });

  it("returns a single municipality when one is requested", async () => {
    const patch = await getAmfeSheetColumnYearPatch(source, "2024", "2507507", {
      fetchWorkbook: async () => buildWorkbookBytes(),
    });

    expect(Object.keys(patch.years?.["2024"].values ?? {})).toEqual([
      "2507507",
    ]);
  });

  // A planilha é uma foto só: repetir o mesmo número em outro ano faria o painel
  // afirmar algo que o dado não diz.
  it("leaves any other period without values", async () => {
    const patch = await getAmfeSheetColumnYearPatch(source, "2023", "br", {
      fetchWorkbook: async () => buildWorkbookBytes(),
    });

    expect(patch.years?.["2023"].values).toEqual({});
  });

  it("refuses a column that the sheet does not have", async () => {
    await expect(
      getAmfeSheetColumnYearPatch(
        { ...source, column: "coluna_inexistente" },
        "2024",
        "br",
        { fetchWorkbook: async () => buildWorkbookBytes() },
      ),
    ).rejects.toThrow(/não tem a coluna "coluna_inexistente"/u);
  });
});
