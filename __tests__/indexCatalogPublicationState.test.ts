import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getCatalogEntry } from "@/services/indexCatalog/contentfulManagement";
import type { IndexCatalogConfigV2 } from "@/types/indexCatalog";

const statisticsSource = {
  kind: "gee-feature-collection" as const,
  asset: {
    type: "fixed" as const,
    assetId: "projects/obscaatinga/assets/Estatisticas/Prev_T_Anomalia",
  },
  periodGranularity: "month" as const,
  properties: {
    level: "NIVEL_AGRUPAMENTO",
    locationName: "NOME_LOCAL",
    municipalityCode: "CD_MUN",
    stateCode: "NM_UF",
    year: "ano",
    date: "data_img",
    totalArea: "area_total_ha",
  },
};

const publishedConfig = {
  schemaVersion: 2,
  panelLayerId: "teste-temperatura",
  status: "published",
  name: "Previsão: Anomalia Temperatura | CPTEC INPE",
  description: "Anomalia mensal de temperatura prevista pelo CPTEC/INPE.",
  category: "Dados Climáticos",
  statisticsSource,
  validatedStatisticsSource: {
    ...statisticsSource,
    schemaVersion: 1,
    sourceRevision: "2".repeat(64),
  },
  classes: [
    { classIndex: 0, id: "classe-0", label: "Muito abaixo", color: "#35398F" },
  ],
  earthEngine: {
    strategy: "single",
    sourceType: "imageCollection",
    singleAssetId: "projects/obscaatinga/assets/ColecaoImagens/Prev_T",
    band: "b1",
  },
  createdBy: {
    uid: "admin",
    email: "oca@example.test",
    at: "2026-08-21T17:49:37.844Z",
  },
  updatedBy: {
    uid: "admin",
    email: "oca@example.test",
    at: "2026-08-21T18:21:53.978Z",
  },
  validation: {
    validatedAt: "2026-08-21T18:21:53.977Z",
    valid: true,
    errors: [],
    warnings: [],
    inferred: {
      panelLayerId: "teste-temperatura",
      periods: ["2026-09", "2026-10"],
      classIndexes: [0],
      statisticsAssetCount: 1,
    },
    sourceFingerprint: "c".repeat(64),
  },
  auditLog: [],
};

/** Responde só o que `getCatalogEntry` consulta: locales e uma entry. */
class FakeContentfulManagementApi {
  constructor(private readonly sys: Record<string, unknown>) {}

  readonly fetch = async (url: string) => {
    if (String(url).endsWith("/locales")) {
      return Response.json({ items: [{ code: "en-US", default: true }] });
    }

    return Response.json({
      sys: { id: "abfYEqHEfwTFEtRv8w3RX", version: 16, ...this.sys },
      fields: {
        id: { "en-US": "teste-temperatura" },
        name: { "en-US": publishedConfig.name },
        description: { "en-US": publishedConfig.description },
        category: { "en-US": publishedConfig.category },
        catalogConfig: { "en-US": publishedConfig },
      },
    });
  };
}

describe("estado de publicação lido do Contentful", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CONTENTFUL_SPACE_ID", "space-teste");
    vi.stubEnv("CONTENTFUL_MANAGEMENT_TOKEN", "token-teste");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("trata como ready o índice marcado como published que voltou a rascunho", async () => {
    // Regressão do estado observado em teste-temperatura: publishedCounter 2,
    // nenhum publishedVersion e catalogConfig.status "published". Sem
    // reconciliar, publicar de novo caía em assertPublishable.
    const api = new FakeContentfulManagementApi({
      firstPublishedAt: "2026-08-21T18:08:41.116Z",
    });
    vi.stubGlobal("fetch", api.fetch);

    const current = await getCatalogEntry("abfYEqHEfwTFEtRv8w3RX");

    expect(current.item.published).toBe(false);
    expect(current.item.everPublished).toBe(true);
    expect(current.item.status).toBe("ready");
    expect((current.item.catalogConfig as IndexCatalogConfigV2).status).toBe(
      "ready",
    );
  });

  it("mantém published quando a entry está publicada no Contentful", async () => {
    const api = new FakeContentfulManagementApi({
      firstPublishedAt: "2026-08-21T18:08:41.116Z",
      publishedAt: "2026-08-21T18:21:56.755Z",
      publishedVersion: 15,
    });
    vi.stubGlobal("fetch", api.fetch);

    const current = await getCatalogEntry("abfYEqHEfwTFEtRv8w3RX");

    expect(current.item.published).toBe(true);
    expect(current.item.status).toBe("published");
    expect((current.item.catalogConfig as IndexCatalogConfigV2).status).toBe(
      "published",
    );
  });
});
