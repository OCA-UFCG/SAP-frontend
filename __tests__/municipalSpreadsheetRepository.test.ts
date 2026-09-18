import { afterEach, describe, expect, it, vi } from "vitest";

import type { MunicipalSpreadsheetStatisticsSource } from "@/contracts/municipalSpreadsheet";
import type { MunicipalSpreadsheetSnapshot } from "@/contracts/municipalSpreadsheetSnapshot";
import {
  buildSpreadsheetYearPatch,
  getSpreadsheetMunicipalValues,
  getSpreadsheetYearPatch,
} from "@/repositories/platform/municipalSpreadsheetRepository";
import {
  clearSpreadsheetSnapshotCache,
  getOrLoadSpreadsheetSnapshot,
} from "@/repositories/platform/municipalSpreadsheetSnapshotCache";

const SNAPSHOT_URL = "https://assets.test/pib-valores.json";

const snapshot: MunicipalSpreadsheetSnapshot = {
  schemaVersion: 1,
  type: "municipal-spreadsheet-snapshot",
  generatedAt: "2026-09-18T12:00:00.000Z",
  periods: ["2010", "2020"],
  aggregation: "sum",
  locations: {
    br: "Brasil",
    pb: "Paraíba",
    sp: "São Paulo",
    "2507507": "João Pessoa - PB",
    "3_bioma-caatinga": "Caatinga",
  },
  values: {
    br: [140, 60],
    pb: [40, 60],
    sp: [100, null],
    "2507507": [10, 20],
    "3_bioma-caatinga": [30, 40],
  },
};

const source: MunicipalSpreadsheetStatisticsSource = {
  kind: "municipal-spreadsheet",
  spreadsheetUrl: "https://docs.google.com/spreadsheets/d/planilha/edit",
  fileId: "planilha",
  valuePrefix: "pib",
  aggregation: "sum",
  snapshot: { assetId: "asset-1", url: SNAPSHOT_URL },
};

/** Serve o mesmo instantâneo e conta quantas vezes a rede foi tocada. */
class CountingSnapshotServer {
  calls = 0;

  fetch = async (): Promise<Response> => {
    this.calls += 1;
    return new Response(JSON.stringify(snapshot), { status: 200 });
  };
}

afterEach(() => {
  clearSpreadsheetSnapshotCache();
  vi.unstubAllGlobals();
});

describe("buildSpreadsheetYearPatch", () => {
  it("carries the states along with Brazil, because the ranking needs them", () => {
    const patch = buildSpreadsheetYearPatch(snapshot, "2010", "br");

    expect(Object.keys(patch.locations ?? {}).sort()).toEqual([
      "br",
      "pb",
      "sp",
    ]);
    expect(patch.years["2010"].values).toEqual({
      br: [140],
      pb: [40],
      sp: [100],
    });
  });

  it("answers an aggregate cut that no GEE value table could answer", () => {
    const patch = buildSpreadsheetYearPatch(
      snapshot,
      "2020",
      "3_bioma-caatinga",
    );

    expect(patch.years["2020"].values).toEqual({ "3_bioma-caatinga": [40] });
  });

  it("leaves a territory without value out, instead of sending zero", () => {
    const patch = buildSpreadsheetYearPatch(snapshot, "2020", "sp");

    expect(patch.locations).toEqual({ sp: "São Paulo" });
    expect(patch.years["2020"].values).toEqual({});
  });

  it("answers an unknown period with no values at all", () => {
    const patch = buildSpreadsheetYearPatch(snapshot, "1999", "br");

    expect(patch.years["1999"].values).toEqual({});
  });
});

describe("getSpreadsheetYearPatch", () => {
  it("reads the snapshot once for simultaneous requests", async () => {
    const server = new CountingSnapshotServer();
    vi.stubGlobal("fetch", server.fetch);

    const [first, second] = await Promise.all([
      getSpreadsheetYearPatch(source, "2010", "br"),
      getSpreadsheetYearPatch(source, "2020", "pb"),
    ]);

    expect(server.calls).toBe(1);
    expect(first.patch.years["2010"].values.br).toEqual([140]);
    expect(second.patch.years["2020"].values.pb).toEqual([60]);
  });

  it("serves the second request from memory", async () => {
    const server = new CountingSnapshotServer();
    vi.stubGlobal("fetch", server.fetch);

    await getSpreadsheetYearPatch(source, "2010", "br");
    await getSpreadsheetYearPatch(source, "2010", "br");

    expect(server.calls).toBe(1);
  });

  it("says to revalidate the index when there is no snapshot yet", async () => {
    await expect(
      getSpreadsheetYearPatch({ ...source, snapshot: undefined }, "2010", "br"),
    ).rejects.toThrow(/revalide-o no catálogo/u);
  });

  it("names the status when the snapshot cannot be downloaded", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 404 }));

    await expect(getOrLoadSpreadsheetSnapshot(SNAPSHOT_URL)).rejects.toThrow(
      /respondeu 404/u,
    );
  });
});

describe("getSpreadsheetMunicipalValues", () => {
  it("returns only municipalities, which is what the map paints", async () => {
    vi.stubGlobal("fetch", new CountingSnapshotServer().fetch);

    const values = await getSpreadsheetMunicipalValues(source, "2010");

    expect(values).toEqual({ "2507507": 10 });
  });
});
