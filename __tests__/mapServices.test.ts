import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchMapURL } from "@/services/mapServices";

describe("mapServices.fetchMapURL", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws a readable API error instead of a JSON parsing error for non-JSON failures", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token <")),
    } as unknown as Response);

    await expect(
      fetchMapURL("layer-a", "2024", {
        id: "layer-a",
        name: "Layer A",
        description: "Layer A",
        measurementUnit: "%",
        poster: "/poster.png",
        imageData: {},
        type: "raster",
      }),
    ).rejects.toThrow("Erro ao buscar fontes de mapa.");
  });
});
