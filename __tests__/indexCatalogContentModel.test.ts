import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ensureIndexCatalogContentModel } from "@/services/indexCatalog/contentfulManagement";

const CATALOG_FIELDS = [
  "catalogConfig",
  "statisticsSource",
  "reportConfig",
  "forecastFacets",
  "sourceGroup",
].map((id) => ({ id, type: "Object" }));

function contentType(timeScaleValidations: unknown[]) {
  return {
    sys: { id: "panelLayer", version: 46 },
    name: "Panel Layer",
    displayField: "id",
    fields: [
      ...CATALOG_FIELDS,
      {
        id: "timeScale",
        name: "Escala Temporal",
        type: "Symbol",
        validations: timeScaleValidations,
      },
    ],
  };
}

function mockContentful(timeScaleValidations: unknown[]) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body =
      init?.method === "GET"
        ? contentType(timeScaleValidations)
        : { sys: { id: "panelLayer", version: 47 } };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("ensureIndexCatalogContentModel — escala temporal", () => {
  beforeEach(() => {
    vi.stubEnv("CONTENTFUL_SPACE_ID", "space");
    vi.stubEnv("CONTENTFUL_MANAGEMENT_TOKEN", "token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("libera Decendial quando a lista do campo só tem Mensal e Anual", async () => {
    const fetchMock = mockContentful([{ in: ["Mensal", "Anual"] }]);

    await expect(ensureIndexCatalogContentModel()).resolves.toEqual({
      changed: true,
    });

    const put = fetchMock.mock.calls.find(
      ([url, init]) =>
        init?.method === "PUT" && url.endsWith("/content_types/panelLayer"),
    );
    const sent = JSON.parse(String(put?.[1]?.body));
    const timeScale = sent.fields.find(
      (field: { id: string }) => field.id === "timeScale",
    );
    expect(timeScale.validations).toEqual([
      { in: ["Mensal", "Anual", "Decendial"] },
    ]);
  });

  it("não mexe no content type quando a lista já aceita as três escalas", async () => {
    const fetchMock = mockContentful([{ in: ["Anual", "Mensal", "Decendial"] }]);

    await expect(ensureIndexCatalogContentModel()).resolves.toEqual({
      changed: false,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("não cria lista fechada num campo que aceita qualquer valor", async () => {
    const fetchMock = mockContentful([]);

    await expect(ensureIndexCatalogContentModel()).resolves.toEqual({
      changed: false,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
