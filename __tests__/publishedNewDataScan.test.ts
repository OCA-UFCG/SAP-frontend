import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  listCatalogEntries: vi.fn(),
  checkCatalogNewData: vi.fn(),
}));

vi.mock("@/services/indexCatalog/contentfulManagement", () => ({
  listCatalogEntries: mocks.listCatalogEntries,
}));

vi.mock("@/services/indexCatalog/newDataCheck", () => ({
  checkCatalogNewData: mocks.checkCatalogNewData,
}));

import {
  clearPublishedNewDataScan,
  scanPublishedNewData,
} from "@/services/indexCatalog/publishedNewDataScan";

function item(overrides: Record<string, unknown> = {}) {
  return {
    entryId: "a",
    panelLayerId: "indice_a",
    published: true,
    managedScope: "full",
    ...overrides,
  };
}

function check(status: string) {
  return {
    checkedAt: "2026-09-21T12:00:00.000Z",
    status,
    message: status,
    knownPeriods: [],
    newPeriods: [],
    updatedAssets: [],
  };
}

describe("scanPublishedNewData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPublishedNewDataScan();
    mocks.checkCatalogNewData.mockImplementation(async () =>
      check("up-to-date"),
    );
  });

  it("verifica só os índices publicados que o catálogo criou", async () => {
    mocks.listCatalogEntries.mockResolvedValue([
      item({ entryId: "a" }),
      item({ entryId: "b", published: false }),
      item({ entryId: "c", managedScope: "presentation" }),
      item({ entryId: "d", managedScope: null }),
    ]);

    const scan = await scanPublishedNewData();

    expect(Object.keys(scan.checks)).toEqual(["a"]);
    expect(scan.checked).toBe(1);
    expect(mocks.checkCatalogNewData).toHaveBeenCalledTimes(1);
  });

  it("conta a falha de um índice sem derrubar a varredura dos outros", async () => {
    mocks.listCatalogEntries.mockResolvedValue([
      item({ entryId: "a" }),
      item({ entryId: "b" }),
    ]);
    mocks.checkCatalogNewData.mockImplementation(async (entryId: string) => {
      if (entryId === "a") throw new Error("asset fora do ar");
      return check("new-data");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const scan = await scanPublishedNewData();

    expect(scan.failed).toBe(1);
    expect(scan.checks.b.status).toBe("new-data");
    expect(scan.checks.a).toBeUndefined();
  });

  it("compartilha uma varredura em voo entre dois acessos simultâneos", async () => {
    mocks.listCatalogEntries.mockResolvedValue([item()]);

    const [first, second] = await Promise.all([
      scanPublishedNewData(),
      scanPublishedNewData(),
    ]);

    expect(first).toBe(second);
    expect(mocks.listCatalogEntries).toHaveBeenCalledTimes(1);
  });

  it("reaproveita o resultado dentro do TTL e refaz depois dele", async () => {
    mocks.listCatalogEntries.mockResolvedValue([item()]);
    const start = Date.parse("2026-09-21T12:00:00.000Z");

    await scanPublishedNewData(start);
    await scanPublishedNewData(start + 60_000);
    expect(mocks.listCatalogEntries).toHaveBeenCalledTimes(1);

    await scanPublishedNewData(start + 11 * 60_000);
    expect(mocks.listCatalogEntries).toHaveBeenCalledTimes(2);
  });

  // Sem isto uma falha de rede na listagem do Contentful ficaria guardada os
  // dez minutos do TTL, e o operador não teria como pedir de novo.
  it("não guarda uma varredura que falhou inteira", async () => {
    mocks.listCatalogEntries.mockRejectedValueOnce(
      new Error("Contentful fora"),
    );

    await expect(scanPublishedNewData()).rejects.toThrow("Contentful fora");

    mocks.listCatalogEntries.mockResolvedValue([item()]);
    const scan = await scanPublishedNewData();
    expect(scan.checked).toBe(1);
  });

  it("esquece o resultado quando uma publicação invalida os caches", async () => {
    mocks.listCatalogEntries.mockResolvedValue([item()]);

    await scanPublishedNewData();
    clearPublishedNewDataScan();
    await scanPublishedNewData();

    expect(mocks.listCatalogEntries).toHaveBeenCalledTimes(2);
  });
});
