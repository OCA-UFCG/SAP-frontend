import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildMunicipalReportSeriesShards } from "../tools/drive-contentful-pipeline/lib/conversion/municipal-report-series-writer.mjs";
import {
  isMissingContentTypeQueryError,
  normalizePanelLayerCategory,
  validateMunicipalReportSeriesActivation,
  validateMunicipalReportSeriesManifest,
} from "../tools/drive-contentful-pipeline/lib/contentful/municipal-report-series-sync.mjs";

const pipelineConfig = {
  limits: { maxContentfulJsonBytes: 450_000, compressedDataChunkSize: 32 },
};

function decodeEnvelope(envelope: { data: string[] }) {
  return JSON.parse(
    gunzipSync(Buffer.from(envelope.data.join(""), "base64")).toString("utf8"),
  );
}

describe("municipal report series pipeline", () => {
  it("treats a missing content type as a valid initial dry-run state", () => {
    expect(isMissingContentTypeQueryError(new Error(
      'Listagem falhou com status 400: {"sys":{"id":"InvalidQuery"},"details":{"errors":[{"name":"unknownContentType","value":"DOESNOTEXIST"}]}}',
    ))).toBe(true);
    expect(isMissingContentTypeQueryError(new Error("falhou com status 404"))).toBe(true);
    expect(isMissingContentTypeQueryError(new Error("falhou com status 400: outro erro"))).toBe(false);
  });

  it("blocks activation when a required shard is missing, duplicate, or unpublished", () => {
    const entry = (key: string, published = true) => {
      const [panelLayerId, datasetVersion, shardKey] = key.split("::");
      return {
        sys: published ? { publishedAt: "2026-07-15" } : {},
        fields: {
          panelLayerId: { "en-US": panelLayerId },
          datasetVersion: { "en-US": datasetVersion },
          shardKey: { "en-US": shardKey },
        },
      };
    };
    const expected = new Set(["cdi::v1::0", "cdi::v1::1", "cdi::v1::2"]);
    const result = validateMunicipalReportSeriesActivation(
      [entry("cdi::v1::0"), entry("cdi::v1::0"), entry("cdi::v1::1", false)],
      expected,
      "en-US",
    );
    expect(result).toMatchObject({ ok: false });
    expect(result.missing).toEqual(["cdi::v1::2"]);
    expect(result.duplicates).toEqual(["cdi::v1::0"]);
    expect(result.unpublished).toEqual(["cdi::v1::1"]);
  });

  it("normalizes legacy panel layer categories required by the current model", () => {
    expect(normalizePanelLayerCategory("dados ambientais")).toBe("Dados Ambientais");
    expect(normalizePanelLayerCategory("Dados ambientais")).toBe("Dados Ambientais");
    expect(normalizePanelLayerCategory("Dados Climáticos")).toBe("Dados Climáticos");
  });

  it("transposes periods into deterministic municipality shards and preserves aggregates", () => {
    const result = buildMunicipalReportSeriesShards(
      {
        imageData: {
          years: {
            "2024-01": {
              valuesScale: 10,
              values: { "5200050": [10, 20], "5200100": [30, 40], br: [99] },
            },
            "2024-02": {
              values: { "5200050": [12, 18], "5200100": [31, 39], br: [100] },
            },
          },
        },
      },
      "cdi",
      pipelineConfig,
    );

    expect(result).toMatchObject({
      panelLayerId: "cdi",
      firstPeriod: "2024-01",
      lastPeriod: "2024-02",
      municipalityCount: 2,
      shardStrategy: "ibge-modulo",
    });
    const municipalPayloads = result.shards
      .filter((shard) => shard.shardKey !== "aggregate")
      .map((shard) => decodeEnvelope(shard.imageData));
    expect(municipalPayloads.some((payload) =>
      payload.municipalities["5200050"]?.["2024-01"]?.valuesScale === 10,
    )).toBe(true);
    const aggregate = result.shards.find((shard) => shard.shardKey === "aggregate");
    expect(decodeEnvelope(aggregate!.imageData).municipalities.br["2024-02"].values).toEqual([100]);
    expect(result.shards.every((shard) => shard.outputBytes <= 450_000)).toBe(true);
    expect(result.shards.every((shard) => shard.requestBytes <= 900_000)).toBe(true);
  });

  it("rejects duplicate keys and oversized serialized requests before publication", () => {
    const shard = {
      shardKey: "0",
      outputBytes: 450_001,
      requestBytes: 900_001,
    };
    const validation = validateMunicipalReportSeriesManifest({
      layers: [
        { panelLayerId: "cdi", datasetVersion: "v1", shards: [shard, shard] },
      ],
    });
    expect(validation.ok).toBe(false);
    expect(validation.errors.join(" ")).toContain("duplicado");
    expect(validation.errors.join(" ")).toContain("imageData");
    expect(validation.errors.join(" ")).toContain("requisição");
  });
});
