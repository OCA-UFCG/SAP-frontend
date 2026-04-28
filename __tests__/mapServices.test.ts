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
        imageId: "projects/demo/assets/layer-a",
        imageParams: [],
      }),
    ).rejects.toThrow("Erro ao buscar fontes de mapa.");
  });

  it("posts only the resolved Earth Engine payload", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: vi
        .fn()
        .mockResolvedValue({ url: "https://tiles.example/{z}/{x}/{y}" }),
    } as unknown as Response);

    await fetchMapURL("layer-a", "2024", {
      imageId: "projects/demo/assets/layer-a",
      imageParams: [{ color: "#111111", label: "Classe A", pixelLimit: 10 }],
      minScale: 0,
      maxScale: 100,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/ee?name=layer-a&year=2024"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          imageId: "projects/demo/assets/layer-a",
          imageParams: [
            { color: "#111111", label: "Classe A", pixelLimit: 10 },
          ],
          minScale: 0,
          maxScale: 100,
        }),
      }),
    );
  });
});
