import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCatalogAccess: vi.fn(),
  publishIndexCatalogEntry: vi.fn(),
  unpublishIndexCatalogEntry: vi.fn(),
  deleteIndexCatalogEntry: vi.fn(),
  getIndexCatalogLifecycleImpact: vi.fn(),
  clearEarthEngineCacheForLayer: vi.fn(),
  clearMunicipalAnalysisCache: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/app/api/ee/cache", () => ({
  clearEarthEngineCacheForLayer: mocks.clearEarthEngineCacheForLayer,
}));
vi.mock("@/repositories/platform/municipalAnalysisCache", () => ({
  clearMunicipalAnalysisCache: mocks.clearMunicipalAnalysisCache,
}));
vi.mock("@/services/indexCatalog/indexCatalogService", () => ({
  deleteIndexCatalogEntry: mocks.deleteIndexCatalogEntry,
  getIndexCatalogLifecycleImpact: mocks.getIndexCatalogLifecycleImpact,
  publishIndexCatalogEntry: mocks.publishIndexCatalogEntry,
  unpublishIndexCatalogEntry: mocks.unpublishIndexCatalogEntry,
}));
vi.mock("@/services/indexCatalog/idempotency", () => ({
  getIdempotencyKey: () => "test-key",
  runCatalogIdempotently: (
    _scope: string,
    _key: string,
    operation: () => Promise<unknown>,
  ) => operation(),
}));
vi.mock("@/app/api/index-catalog/http", () => ({
  requireCatalogAccess: mocks.requireCatalogAccess,
  readJsonBody: (request: Request) => request.json(),
  noStoreJson: (value: unknown, status = 200) =>
    Response.json(value, { status }),
  catalogErrorResponse: (error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    ),
}));

import {
  DELETE,
  POST,
} from "@/app/api/index-catalog/entries/[entryId]/route";

const context = { params: Promise.resolve({ entryId: "entry%201" }) };
const user = { uid: "admin", email: "oca-dev@gmail.com" };

describe("index catalog lifecycle route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCatalogAccess.mockResolvedValue({ user });
  });

  it("protects and runs unpublish as an idempotent mutation", async () => {
    mocks.unpublishIndexCatalogEntry.mockResolvedValue({
      entryId: "entry 1",
      panelLayerId: "seca",
      status: "legacy",
    });
    const request = new Request(
      "https://sap.example/api/index-catalog/entries/entry%201",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unpublish" }),
      },
    );

    const response = await POST(request, context);

    expect(response.status).toBe(200);
    expect(mocks.requireCatalogAccess).toHaveBeenCalledWith(request, {
      mutation: true,
    });
    expect(mocks.unpublishIndexCatalogEntry).toHaveBeenCalledWith(
      "entry 1",
      user,
    );
    expect(mocks.clearEarthEngineCacheForLayer).toHaveBeenCalledWith("seca");
    expect(mocks.clearMunicipalAnalysisCache).toHaveBeenCalledWith("seca");
  });

  it("passes the typed confirmation to cascade deletion", async () => {
    mocks.deleteIndexCatalogEntry.mockResolvedValue({
      entryId: "entry 1",
      panelLayerId: "seca",
      status: "deleted",
      deletedEntries: 4,
    });
    const request = new Request(
      "https://sap.example/api/index-catalog/entries/entry%201",
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "seca" }),
      },
    );

    const response = await DELETE(request, context);

    expect(response.status).toBe(200);
    expect(mocks.deleteIndexCatalogEntry).toHaveBeenCalledWith(
      "entry 1",
      "seca",
      user,
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/[locale]/platform",
      "page",
    );
  });
});
