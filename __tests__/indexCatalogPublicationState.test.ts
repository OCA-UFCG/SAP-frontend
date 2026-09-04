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

/** Uma entry legada: sem `catalogConfig`, com o `imageData` que ela tiver. */
class FakeLegacyPanelLayerApi {
  constructor(private readonly imageData: unknown) {}

  readonly fetch = async (url: string) => {
    if (String(url).endsWith("/locales")) {
      return Response.json({ items: [{ code: "en-US", default: true }] });
    }

    return Response.json({
      sys: {
        id: "legacy-entry",
        version: 4,
        firstPublishedAt: "2024-01-01T00:00:00.000Z",
        publishedAt: "2024-01-01T00:00:00.000Z",
        publishedVersion: 3,
      },
      fields: {
        id: { "en-US": "s2id_secas_estiagens" },
        name: { "en-US": "Registros de Secas e Estiagens" },
        description: { "en-US": "Ocorrências do S2iD." },
        category: { "en-US": "Dados Climáticos" },
        measurementUnit: { "en-US": "registros" },
        panelPosition: { "en-US": 4 },
        imageData: { "en-US": this.imageData },
      },
    });
  };
}

const COMPACT_IMAGE_DATA = {
  schemaVersion: 1,
  type: "territorial-compact",
  defaultYear: "2020",
  classes: [{ id: "registros", label: "Registros", color: "#8C2D04" }],
  locations: { br: "Brasil" },
  years: { "2020": { imageId: "assets/s2id", values: { br: [12] } } },
};

describe("adoção de índices legados na listagem", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CONTENTFUL_SPACE_ID", "space-teste");
    vi.stubEnv("CONTENTFUL_MANAGEMENT_TOKEN", "token-teste");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("marca como adotável o legado em territorial-compact e devolve a unidade", async () => {
    vi.stubGlobal(
      "fetch",
      new FakeLegacyPanelLayerApi(COMPACT_IMAGE_DATA).fetch,
    );

    const current = await getCatalogEntry("legacy-entry");

    expect(current.item.catalogManaged).toBe(false);
    expect(current.item.managedScope).toBeNull();
    expect(current.item.adoptable).toBe(true);
    expect(current.item.measurementUnit).toBe("registros");
    expect(current.item.status).toBe("legacy");
  });

  it("recusa a adoção do legado no formato pré-compacto", async () => {
    // `CDI` e `veg` ainda guardam `imageParams` por ano: sem `classes` nem
    // `years`, a captura da imagem e a prévia do relatório não têm o que ler.
    vi.stubGlobal(
      "fetch",
      new FakeLegacyPanelLayerApi({
        "2021": { imageId: "assets/cdi", imageParams: [] },
      }).fetch,
    );

    const current = await getCatalogEntry("legacy-entry");

    expect(current.item.adoptable).toBe(false);
    expect(current.item.adoptionBlockedReason).toMatch(/pré-compacto/u);
  });

  it("reconhece o escopo de apresentação de um legado já adotado", async () => {
    class FakeAdoptedLegacyApi {
      readonly fetch = async (url: string) => {
        if (String(url).endsWith("/locales")) {
          return Response.json({ items: [{ code: "en-US", default: true }] });
        }

        return Response.json({
          sys: {
            id: "legacy-entry",
            version: 6,
            firstPublishedAt: "2024-01-01T00:00:00.000Z",
            publishedAt: "2024-01-01T00:00:00.000Z",
            publishedVersion: 5,
          },
          fields: {
            id: { "en-US": "s2id_secas_estiagens" },
            name: { "en-US": "Registros de Secas e Estiagens" },
            description: { "en-US": "Ocorrências do S2iD." },
            imageData: { "en-US": COMPACT_IMAGE_DATA },
            catalogConfig: {
              "en-US": {
                schemaVersion: 2,
                managedScope: "presentation",
                panelLayerId: "s2id_secas_estiagens",
                status: "published",
                name: "Registros de Secas e Estiagens",
                description: "Ocorrências do S2iD.",
                category: "Dados Climáticos",
                measurementUnit: "registros",
                adoptedFrom: { at: "2026-09-01T10:00:00.000Z" },
              },
            },
          },
        });
      };
    }
    vi.stubGlobal("fetch", new FakeAdoptedLegacyApi().fetch);

    const current = await getCatalogEntry("legacy-entry");

    expect(current.item.catalogManaged).toBe(true);
    expect(current.item.managedScope).toBe("presentation");
    expect(current.item.adoptable).toBe(false);
    expect(current.item.status).toBe("published");
  });
});
