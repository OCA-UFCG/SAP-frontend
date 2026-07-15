import { describe, expect, it } from "vitest";
import {
  getAvailablePeriods,
  getAvailableReportLayers,
  getResolvableReportLayers,
  hasMunicipalLayerPeriod,
  resolveMunicipalLayerPeriod,
  resolveNearestReportPeriod,
  type MunicipalAvailabilityIndex,
} from "@/utils/municipalAvailability";

const index: MunicipalAvailabilityIndex = {
  schemaVersion: 1,
  generatedAt: "2026-01-01T00:00:00.000Z",
  layers: [
    {
      panelLayerId: "seca",
      order: 0,
      periods: ["2024-01", "2024-02", "2025"],
    },
    {
      panelLayerId: "pobreza",
      order: 1,
      periods: ["2023", "2024"],
    },
  ],
  byMunicipality: {
    "5200050": {
      seca: "0-1",
      pobreza: "1",
    },
    "5200100": {
      seca: "2",
      pobreza: "0",
    },
  },
};

describe("municipal availability helpers", () => {
  it("matches exact monthly periods and annual requests backed by monthly periods", () => {
    expect(hasMunicipalLayerPeriod(index, "5200050", "seca", "2024-01")).toBe(true);
    expect(hasMunicipalLayerPeriod(index, "5200050", "seca", "2024")).toBe(true);
    expect(hasMunicipalLayerPeriod(index, "5200050", "seca", "2025")).toBe(false);
    expect(hasMunicipalLayerPeriod(index, "5200100", "seca", "2025")).toBe(true);
  });

  it("lists available report layers for a municipality and requested period", () => {
    expect(getAvailableReportLayers(index, "5200050", "2024")).toEqual([
      "seca",
      "pobreza",
    ]);
    expect(getAvailableReportLayers(index, "5200100", "2024")).toEqual([]);
  });

  it("resolves exact, annual, previous and future report periods in order", () => {
    expect(resolveNearestReportPeriod(["2024-01", "2024-04"], "2024-01")).toBe("2024-01");
    expect(resolveNearestReportPeriod(["2024-01", "2024-04"], "2024")).toBe("2024-04");
    expect(resolveNearestReportPeriod(["2020", "2026"], "2025")).toBe("2020");
    expect(resolveNearestReportPeriod(["2026", "2028"], "2025")).toBe("2026");
    expect(resolveNearestReportPeriod([], "2025")).toBeNull();
  });

  it("resolves report periods per municipality without changing exact availability", () => {
    expect(resolveMunicipalLayerPeriod(index, "5200050", "seca", "2025")).toBe("2024-02");
    expect(resolveMunicipalLayerPeriod(index, "5200100", "pobreza", "2022")).toBe("2023");
    expect(resolveMunicipalLayerPeriod(index, "5200050", "missing", "2024")).toBeNull();
    expect(getResolvableReportLayers(index, "5200050", "2025")).toEqual(["seca", "pobreza"]);
    expect(getAvailableReportLayers(index, "5200050", "2025")).toEqual([]);
  });

  it("returns available period years globally or scoped to a municipality", () => {
    expect(getAvailablePeriods(index)).toEqual(["2025", "2024", "2023"]);
    expect(getAvailablePeriods(index, "5200050")).toEqual(["2024"]);
    expect(getAvailablePeriods(index, "5200100")).toEqual(["2025", "2023"]);
  });
});
