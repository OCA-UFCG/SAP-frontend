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

    await expect(fetchMapURL("layer-a", "2024")).rejects.toThrow(
      "Erro ao buscar fontes de mapa.",
    );
  });

  it("posts only the layer identifier and year", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: vi
        .fn()
        .mockResolvedValue({ url: "https://tiles.example/{z}/{x}/{y}" }),
    } as unknown as Response);

    await fetchMapURL("layer-a", "2024");

    const fetchOptions = fetchSpy.mock.calls[0]?.[1];
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/ee?name=layer-a&year=2024"),
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchOptions).not.toHaveProperty("body");
  });
});
