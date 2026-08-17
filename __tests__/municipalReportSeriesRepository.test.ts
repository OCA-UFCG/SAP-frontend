import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  buildMunicipalReportSeriesPatch,
  decodeMunicipalReportSeries,
  getMunicipalReportShardKey,
} from "@/repositories/platform/municipalReportSeriesRepository";

describe("municipalReportSeriesRepository", () => {
  it("uses the IBGE modulo shard strategy", () => {
    expect(
      getMunicipalReportShardKey("5200050", {
        schemaVersion: 1,
        datasetVersion: "v1",
        shardCount: 64,
        shardStrategy: "ibge-modulo",
        firstPeriod: "2001-01",
        lastPeriod: "2026-01",
      }),
    ).toBe(String(5_200_050 % 64));
  });

  it("decodes gzip+base64 series envelopes", () => {
    const payload = {
      schemaVersion: 1,
      type: "municipal-report-series",
      municipalities: {
        "5200050": { "2024": { values: [10], valuesScale: 1 } },
      },
    };
    const data = gzipSync(Buffer.from(JSON.stringify(payload))).toString(
      "base64",
    );
    expect(
      decodeMunicipalReportSeries({
        schemaVersion: 1,
        type: "municipal-report-series-compressed",
        encoding: "gzip+base64",
        data: [data.slice(0, 10), data.slice(10)],
      }),
    ).toEqual(payload);
  });

  it("builds a compact patch with only the requested municipality", () => {
    expect(
      buildMunicipalReportSeriesPatch("5200050", {
        "2023": { values: [10, 90], valuesScale: 10 },
        "2024": { values: [20, 80] },
      }),
    ).toEqual({
      schemaVersion: 1,
      type: "territorial-compact",
      years: {
        "2023": {
          valuesScale: 10,
          values: { "5200050": [10, 90] },
        },
        "2024": {
          values: { "5200050": [20, 80] },
        },
      },
    });
  });
});
