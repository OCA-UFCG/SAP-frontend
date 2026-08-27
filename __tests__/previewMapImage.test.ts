import { describe, expect, it } from "vitest";
import {
  buildPreviewMapFileName,
  decodePreviewMapDataUrl,
  PREVIEW_MAP_DATA_URL_PREFIX,
  PREVIEW_MAP_MAX_BYTES,
} from "@/utils/previewMapImage";

const PNG_HEADER = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

function pngDataUrl(extraBytes = 32) {
  const bytes = Buffer.concat([PNG_HEADER, Buffer.alloc(extraBytes, 7)]);
  return `${PREVIEW_MAP_DATA_URL_PREFIX}${bytes.toString("base64")}`;
}

describe("decodePreviewMapDataUrl", () => {
  it("decodes a captured PNG into bytes named after the index", () => {
    const image = decodePreviewMapDataUrl(pngDataUrl(), "indice-aridez");

    expect(image.contentType).toBe("image/png");
    expect(image.fileName).toBe("indice-aridez-previa-mapa.png");
    expect(image.bytes.byteLength).toBe(40);
    expect(Array.from(image.bytes.slice(0, 8))).toEqual(Array.from(PNG_HEADER));
  });

  it("rejects anything that is not a PNG data URL", () => {
    expect(() => decodePreviewMapDataUrl(null, "indice-aridez")).toThrow(
      PREVIEW_MAP_DATA_URL_PREFIX,
    );
    expect(() =>
      decodePreviewMapDataUrl("data:image/jpeg;base64,AAAA", "indice-aridez"),
    ).toThrow(PREVIEW_MAP_DATA_URL_PREFIX);
  });

  it("rejects a payload without the PNG signature", () => {
    expect(() =>
      decodePreviewMapDataUrl(
        `${PREVIEW_MAP_DATA_URL_PREFIX}${Buffer.from("nao sou um png").toString("base64")}`,
        "indice-aridez",
      ),
    ).toThrow("assinatura PNG");
  });

  it("rejects a capture larger than the allowed size", () => {
    expect(() =>
      decodePreviewMapDataUrl(
        pngDataUrl(PREVIEW_MAP_MAX_BYTES),
        "indice-aridez",
      ),
    ).toThrow(String(PREVIEW_MAP_MAX_BYTES));
  });

  it("names the file after the technical id", () => {
    expect(buildPreviewMapFileName("previsao-anomalia-temperatura")).toBe(
      "previsao-anomalia-temperatura-previa-mapa.png",
    );
  });
});
