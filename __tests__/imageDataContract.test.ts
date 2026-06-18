import { describe, expect, it } from "vitest";
import {
  isCompactTerritorialImageData,
  isLegacyImageDataMap,
  validateCompressedTerritorialEnvelope,
  validateImageDataContract,
} from "@/contracts/imageDataContract.mjs";

function buildValidCompactImageData() {
  return {
    schemaVersion: 1,
    type: "territorial-compact",
    defaultYear: "2026",
    classes: [{ id: "a", label: "Classe A", color: "#111111" }],
    locations: { br: "Brasil" },
    mapVisualization: {
      sourceType: "image",
      min: 0,
      max: 100,
      palette: ["#111111"],
      legend: [{ id: "a", label: "Classe A", color: "#111111" }],
      thresholds: [50],
      sourceRange: { min: 0, max: 100, unit: "%" },
      valueMeaning: { high: "Alto" },
    },
    years: {
      "2026": {
        imageId: "projects/example/assets/layer_2026",
        year: "2026",
        valuesScale: 1,
        values: { br: [100] },
      },
    },
  };
}

describe("imageData contract", () => {
  it("accepts a complete territorial-compact payload for panel layer publish", () => {
    const validation = validateImageDataContract(buildValidCompactImageData(), {
      context: "panelLayerPublish",
    });

    expect(validation).toEqual({ ok: true, errors: [] });
    expect(isCompactTerritorialImageData(buildValidCompactImageData())).toBe(
      true,
    );
  });

  it("rejects panel layer publish payloads without a defaultYear in years", () => {
    const imageData = buildValidCompactImageData();
    imageData.defaultYear = "2025";

    expect(
      validateImageDataContract(imageData, {
        context: "panelLayerPublish",
      }).errors,
    ).toContain("defaultYear: deve existir em years.");
  });

  it("rejects panel layer publish payloads without locations", () => {
    const imageData: Record<string, unknown> = buildValidCompactImageData();
    delete imageData.locations;

    expect(
      validateImageDataContract(imageData, {
        context: "panelLayerPublish",
      }).errors,
    ).toContain("locations: deve ser um objeto não vazio de strings.");
  });

  it("rejects unknown schema versions", () => {
    const imageData = buildValidCompactImageData();
    imageData.schemaVersion = 2;

    expect(
      validateImageDataContract(imageData, {
        context: "panelLayerPublish",
      }).errors,
    ).toContain("schemaVersion: deve ser 1; recebido 2.");
  });

  it("rejects empty classes", () => {
    const imageData = buildValidCompactImageData();
    imageData.classes = [];

    expect(
      validateImageDataContract(imageData, {
        context: "panelLayerPublish",
      }).errors,
    ).toContain("classes: deve ser uma lista não vazia.");
  });

  it("rejects empty years", () => {
    const imageData = buildValidCompactImageData();
    imageData.years = {};

    expect(
      validateImageDataContract(imageData, {
        context: "panelLayerPublish",
      }).errors,
    ).toContain("years: deve ser um objeto não vazio.");
  });

  it("rejects complete year entries without imageId", () => {
    const imageData = buildValidCompactImageData();
    delete imageData.years["2026"].imageId;

    expect(
      validateImageDataContract(imageData, {
        context: "panelLayerPublish",
      }).errors,
    ).toContain("years.2026.imageId: deve ser string não vazia.");
  });

  it("accepts municipal patches without imageId", () => {
    expect(
      validateImageDataContract(
        {
          templates: { municipality: "template" },
          years: {
            "2026": {
              valuesScale: 1,
              values: { "2507507": [80, 20] },
            },
          },
        },
        { context: "municipalPatch" },
      ),
    ).toEqual({ ok: true, errors: [] });
  });

  it("rejects municipal patches without years", () => {
    expect(
      validateImageDataContract(
        { templates: { municipality: "template" } },
        { context: "municipalPatch" },
      ).errors,
    ).toContain("years: deve ser um objeto não vazio.");
  });

  it("accepts compressed municipal patch envelopes", () => {
    expect(
      validateCompressedTerritorialEnvelope({
        schemaVersion: 1,
        type: "territorial-compact-compressed",
        encoding: "gzip+base64",
        mediaType: "application/vnd.sap.territorial-analysis+json",
        rawBytes: 10,
        compressedBytes: 8,
        chunkSize: 100,
        data: ["H4sI"],
      }),
    ).toEqual({ ok: true, errors: [] });
  });

  it("keeps legacy imageData readable but blocks it from panel layer publish", () => {
    const legacy = {
      general: {
        default: true,
        imageId: "projects/example/assets/legacy",
        imageParams: [{ label: "Classe A", color: "#111111" }],
      },
    };

    expect(isLegacyImageDataMap(legacy)).toBe(true);
    expect(
      validateImageDataContract(legacy, { context: "runtimeRead" }),
    ).toEqual({ ok: true, errors: [] });
    expect(
      validateImageDataContract(legacy, { context: "panelLayerPublish" }).ok,
    ).toBe(false);
  });
});
