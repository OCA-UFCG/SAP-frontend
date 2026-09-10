import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const contentful = vi.hoisted(() => ({
  getCatalogEntry: vi.fn(),
  getLocalizedEntryField: vi.fn(),
  getManagementEntry: vi.fn(),
  listCatalogEntries: vi.fn(),
  patchManagementEntry: vi.fn(),
  publishManagementEntry: vi.fn(),
}));
const previewMap = vi.hoisted(() => ({
  getIndexCatalogPreviewMapUrl: vi.fn(),
}));
const docs = vi.hoisted(() => ({ getDocTemplate: vi.fn() }));

vi.mock("@/services/indexCatalog/contentfulManagement", () => contentful);
vi.mock("@/services/indexCatalog/previewMapService", () => previewMap);
vi.mock("@/services/buildDoc/buildDocTemplate", () => docs);

import {
  getIndexCatalogPresentationPreview,
  publishIndexCatalogPresentation,
  readIndexCatalogDocsText,
  resolveCatalogPreviewTileLayer,
  updateIndexCatalogPresentation,
} from "@/services/indexCatalog/presentationService";
import type { IndexCatalogPresentationConfigV2 } from "@/types/indexCatalog";

const user = { uid: "admin-1", email: "oca-dev@gmail.com" };
const imageData = {
  schemaVersion: 1,
  type: "territorial-compact",
  defaultYear: "2020",
  classes: [{ id: "registros", label: "Registros", color: "#8C2D04" }],
  locations: { br: "Brasil" },
  years: {
    "2019": { imageId: "assets/s2id", values: { br: [10] }, valuesScale: 1 },
    "2020": { imageId: "assets/s2id", values: { br: [12] }, valuesScale: 1 },
  },
};
const adoptedConfig: IndexCatalogPresentationConfigV2 = {
  schemaVersion: 2,
  managedScope: "presentation",
  panelLayerId: "s2id_secas_estiagens",
  status: "published",
  name: "Registros de Secas e Estiagens",
  description: "Ocorrências registradas no S2iD.",
  category: "Dados Climáticos",
  measurementUnit: "registros",
  panelPosition: 4,
  createdBy: { ...user, at: "2026-09-01T10:00:00.000Z" },
  updatedBy: { ...user, at: "2026-09-01T10:00:00.000Z" },
  adoptedFrom: { at: "2026-09-01T10:00:00.000Z" },
  auditLog: [],
};

const validInput = {
  name: "Registros de Secas e Estiagens (2004-2024)",
  description: "Ocorrências registradas no S2iD.",
  category: "Dados Climáticos",
  measurementUnit: "registros",
  panelPosition: "5",
};

function stubEntry(
  options: {
    published?: boolean;
    config?: unknown;
    fields?: Record<string, unknown>;
    entries?: unknown[];
  } = {},
) {
  const entry = {
    sys: {
      id: "entry-legacy",
      version: 12,
      publishedAt: options.published ? "x" : undefined,
    },
    fields: {},
  };
  contentful.getCatalogEntry.mockResolvedValue({
    entry,
    locale: "en-US",
    item: {
      entryId: "entry-legacy",
      panelLayerId: "s2id_secas_estiagens",
      published: options.published ?? true,
      catalogConfig: options.config ?? adoptedConfig,
    },
  });
  contentful.getManagementEntry.mockResolvedValue(entry);
  contentful.listCatalogEntries.mockResolvedValue(options.entries ?? []);
  contentful.patchManagementEntry.mockResolvedValue(entry);
  contentful.publishManagementEntry.mockResolvedValue({
    sys: { id: "entry-legacy", publishedAt: "2026-09-03T12:00:00.000Z" },
  });
  const fields: Record<string, unknown> = {
    imageData,
    minScale: 1000,
    maxScale: 250,
    ...options.fields,
  };
  contentful.getLocalizedEntryField.mockImplementation(
    (_entry: unknown, fieldId: string) => fields[fieldId],
  );
  return entry;
}

function patchedFields() {
  return contentful.patchManagementEntry.mock.calls[0][1] as Record<
    string,
    unknown
  >;
}

describe("updateIndexCatalogPresentation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("grava a identidade e a unidade sem tocar nos dados do índice", async () => {
    stubEntry();

    const result = await updateIndexCatalogPresentation(
      "entry-legacy",
      validInput,
      user,
    );

    expect(result).toMatchObject({
      managedScope: "presentation",
      requiresRepublish: true,
    });
    expect(patchedFields()).toMatchObject({
      name: validInput.name,
      measurementUnit: "registros",
    });
    // A posição pedida fica no catalogConfig; o campo da entry só é escrito na
    // publicação, que é onde a troca com o ocupante pode ser aplicada.
    expect(patchedFields().panelPosition).toBeUndefined();
    expect(patchedFields().catalogConfig).toMatchObject({ panelPosition: 5 });
    expect(patchedFields().imageData).toBeUndefined();
    expect(patchedFields().statisticsSource).toBeUndefined();
  });

  it("preserva a unidade do legado em vez de normalizar para %", async () => {
    // Regressão: toda escrita do catálogo mandava `measurementUnit: "%"`, o que
    // trocaria "registros" por "%" no painel de análise sem ninguém pedir.
    stubEntry();

    await updateIndexCatalogPresentation("entry-legacy", validInput, user);

    expect(patchedFields().measurementUnit).toBe("registros");
  });

  it("não derruba o status nem apaga validação alguma", async () => {
    stubEntry();

    await updateIndexCatalogPresentation("entry-legacy", validInput, user);

    const config = patchedFields()
      .catalogConfig as IndexCatalogPresentationConfigV2;
    expect(config.status).toBe("published");
    expect(config.managedScope).toBe("presentation");
  });

  it("recusa a edição de um índice em escopo completo", async () => {
    stubEntry({
      config: { schemaVersion: 2, panelLayerId: "aridez", status: "ready" },
    });

    await expect(
      updateIndexCatalogPresentation("entry-legacy", validInput, user),
    ).rejects.toThrow(/escopo de apresentação/u);
  });

  it("recusa unidade em branco", async () => {
    stubEntry();

    await expect(
      updateIndexCatalogPresentation(
        "entry-legacy",
        { ...validInput, measurementUnit: "  " },
        user,
      ),
    ).rejects.toThrow(/Unidade de medida/u);
  });
});

describe("getIndexCatalogPresentationPreview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("devolve o mapa do período padrão sem exigir validação", async () => {
    stubEntry();
    previewMap.getIndexCatalogPreviewMapUrl.mockResolvedValue(null);

    const preview = await getIndexCatalogPresentationPreview("entry-legacy");

    expect(preview.defaultPeriod).toBe("2020");
    expect(preview.panelLayer.tileApiPath).toBe(
      "/api/index-catalog/drafts/entry-legacy/ee",
    );
    expect(preview.panelLayer.minScale).toBe(1000);
  });

  it("não aponta o painel para a rota de rascunho do catálogo", async () => {
    // Sem `municipalAnalysisApiPath` o painel usa a rota de produção do índice,
    // que é a única que sabe ler as partições `municipalAnalysis` do legado.
    stubEntry();
    previewMap.getIndexCatalogPreviewMapUrl.mockResolvedValue(null);

    const preview = await getIndexCatalogPresentationPreview("entry-legacy");

    expect(preview.panelLayer.municipalAnalysisApiPath).toBeUndefined();
    expect(preview.panelLayer.statisticsSource).toBeUndefined();
  });

  it("recusa imageData no formato pré-compacto", async () => {
    stubEntry({ fields: { imageData: { "2020": { imageId: "x" } } } });

    await expect(
      getIndexCatalogPresentationPreview("entry-legacy"),
    ).rejects.toThrow(/territorial-compact/u);
  });
});

describe("publishIndexCatalogPresentation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("publica e confirma o publishedAt do Contentful", async () => {
    stubEntry();

    await expect(
      publishIndexCatalogPresentation("entry-legacy", user),
    ).resolves.toMatchObject({ status: "published" });
    expect(contentful.publishManagementEntry).toHaveBeenCalledTimes(1);
  });

  it("falha quando o Contentful não registra a publicação", async () => {
    stubEntry();
    contentful.publishManagementEntry.mockResolvedValue({
      sys: { id: "entry-legacy" },
    });

    await expect(
      publishIndexCatalogPresentation("entry-legacy", user),
    ).rejects.toThrow(/publishedAt ausente/u);
  });
});

describe("resolveCatalogPreviewTileLayer", () => {
  beforeEach(() => vi.clearAllMocks());

  it("serve tiles de um legado adotado, que nunca terá validação", async () => {
    stubEntry();

    const layer = await resolveCatalogPreviewTileLayer("entry-legacy");

    expect(layer.id).toBe("s2id_secas_estiagens");
    expect(layer.imageData.defaultYear).toBe("2020");
  });

  it("continua exigindo prévia validada no escopo completo", async () => {
    stubEntry({
      config: { schemaVersion: 2, panelLayerId: "aridez", status: "draft" },
    });

    await expect(
      resolveCatalogPreviewTileLayer("entry-legacy"),
    ).rejects.toThrow(/prévia válida/u);
  });
});

describe("readIndexCatalogDocsText", () => {
  beforeEach(() => vi.clearAllMocks());

  it("traz as seções do Google Docs com os colchetes intactos", async () => {
    stubEntry();
    docs.getDocTemplate.mockResolvedValue({
      s2id_secas_estiagens: [
        { title: "Situação atual", text: "Em [municipio], [valor] registros." },
      ],
    });

    const result = await readIndexCatalogDocsText("entry-legacy");

    expect(docs.getDocTemplate).toHaveBeenCalledWith({
      themes: ["s2id_secas_estiagens"],
    });
    expect(result.sections[0].text).toContain("[municipio]");
  });

  it("devolve lista vazia quando o índice não tem bloco no documento", async () => {
    stubEntry();
    docs.getDocTemplate.mockResolvedValue({});

    await expect(
      readIndexCatalogDocsText("entry-legacy"),
    ).resolves.toMatchObject({ sections: [] });
  });
});
