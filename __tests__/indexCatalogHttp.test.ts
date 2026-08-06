import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/catalog-access", () => ({
  hasTrustedMutationOrigin: vi.fn(),
  resolveCatalogRequestAccess: vi.fn(),
}));
vi.mock("@/services/indexCatalog/indexCatalogService", () => ({
  getCatalogValidationFromError: () => undefined,
}));

import { catalogErrorResponse } from "@/app/api/index-catalog/http";

describe("index catalog HTTP errors", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 400 for a missing class or measure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = catalogErrorResponse(
      new Error("Cadastre pelo menos uma classe ou medida."),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Cadastre pelo menos uma classe ou medida.",
    });
  });
});
