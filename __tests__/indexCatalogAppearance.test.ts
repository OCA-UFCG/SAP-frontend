import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const contentful = vi.hoisted(() => ({
  getCatalogEntry: vi.fn(),
  getLocalizedEntryField: vi.fn(),
  patchManagementEntry: vi.fn(),
}));

vi.mock("@/services/indexCatalog/contentfulManagement", () => contentful);

import {
  getIndexCatalogAppearance,
  updateIndexCatalogAppearance,
} from "@/services/indexCatalog/legacyAppearanceService";
import type {
  IndexCatalogConfigV2,
  IndexCatalogPresentationConfigV2,
} from "@/types/indexCatalog";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";

const user = { uid: "admin-1", email: "oca-dev@gmail.com" };

function legacyImageData(): CompactTerritorialAnalysisDataset {
  return {
    schemaVersion: 1,
    type: "territorial-compact",
    defaultYear: "2020",
    classes: [
      { id: "muito-baixo", label: "Muito baixo", color: "#FFFFCC" },
      { id: "muito-alto", label: "Muito alto", color: "#BD0026" },
    ],
    mapVisualization: { palette: ["#FFFFCC", "#BD0026"] },
    locations: { br: "Brasil" },
    years: {
      "2019": { imageId: "assets/deg_2019", values: { br: [40, 60] } },
      "2020": { imageId: "assets/deg_2020", values: { br: [30, 70] } },
    },
  };
}

const adoptedConfig: IndexCatalogPresentationConfigV2 = {
  schemaVersion: 2,
  managedScope: "presentation",
  panelLayerId: "deg",
  status: "published",
  name: "Índice de Degradação",
  description: "Degradação da terra.",
  category: "Dados Ambientais",
  measurementUnit: "classes",
  createdBy: { ...user, at: "2026-09-01T10:00:00.000Z" },
  updatedBy: { ...user, at: "2026-09-01T10:00:00.000Z" },
  adoptedFrom: { at: "2026-09-01T10:00:00.000Z" },
  auditLog: [],
};

/** Um índice criado pelo próprio catálogo, para conferir a recusa de escopo. */
const fullConfig = {
  schemaVersion: 2,
  panelLayerId: "indice-de-aridez-era5-land",
  status: "published",
} as unknown as IndexCatalogConfigV2;

function stubEntry(
  options: { published?: boolean; config?: unknown; imageData?: unknown } = {},
) {
  const entry = { sys: { id: "entry-deg", version: 7 }, fields: {} };
  contentful.getCatalogEntry.mockResolvedValue({
    entry,
    locale: "en-US",
    item: {
      entryId: "entry-deg",
      panelLayerId: "deg",
      published: options.published ?? true,
      catalogConfig: options.config ?? adoptedConfig,
    },
  });
  contentful.patchManagementEntry.mockResolvedValue(entry);
  const fields: Record<string, unknown> = {
    imageData: options.imageData ?? legacyImageData(),
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getIndexCatalogAppearance", () => {
  it("devolve as linhas gravadas e quantos períodos elas alcançam", async () => {
    stubEntry();

    const result = await getIndexCatalogAppearance("entry-deg");

    expect(result.panelLayerId).toBe("deg");
    expect(result.appearance.legend.map((row) => row.label)).toEqual([
      "Muito baixo",
      "Muito alto",
    ]);
    expect(result.periodCount).toBe(2);
  });

  it("recusa um índice que não foi adotado no escopo de apresentação", async () => {
    stubEntry({ config: fullConfig });

    await expect(getIndexCatalogAppearance("entry-deg")).rejects.toThrow(
      /escopo de apresentação/u,
    );
  });

  it("recusa um imageData que não está no formato compacto", async () => {
    stubEntry({
      imageData: { "2020": { default: true, imageId: "x", imageParams: [] } },
    });

    await expect(getIndexCatalogAppearance("entry-deg")).rejects.toThrow(
      /territorial-compact/u,
    );
  });
});

describe("updateIndexCatalogAppearance", () => {
  it("grava o imageData com os rótulos novos e preserva os valores", async () => {
    stubEntry();

    const result = await updateIndexCatalogAppearance(
      "entry-deg",
      {
        legend: [
          { id: "muito-baixo", label: "Degradação baixa", color: "#FFFFCC" },
          { id: "muito-alto", label: "Degradação alta", color: "#BD0026" },
        ],
      },
      user,
    );

    const written = patchedFields()
      .imageData as CompactTerritorialAnalysisDataset;
    expect(written.classes.map((entry) => entry.label)).toEqual([
      "Degradação baixa",
      "Degradação alta",
    ]);
    expect(written.years["2019"].values.br).toEqual([40, 60]);
    expect(result.changed).toBe("2 rótulos");
    expect(result.requiresRepublish).toBe(true);
  });

  it("registra a alteração no histórico de auditoria", async () => {
    stubEntry();

    await updateIndexCatalogAppearance(
      "entry-deg",
      {
        legend: [
          { id: "muito-baixo", label: "Muito baixo", color: "#FFFFFF" },
          { id: "muito-alto", label: "Muito alto", color: "#BD0026" },
        ],
      },
      user,
    );

    const config = patchedFields()
      .catalogConfig as IndexCatalogPresentationConfigV2;
    expect(config.auditLog?.at(-1)).toMatchObject({
      action: "appearance",
      outcome: "success",
      message: "1 cor",
      uid: "admin-1",
    });
  });

  it("não grava quando a tela reenvia o que já estava gravado", async () => {
    stubEntry();

    const result = await updateIndexCatalogAppearance(
      "entry-deg",
      {
        legend: [
          { id: "muito-baixo", label: "Muito baixo", color: "#FFFFCC" },
          { id: "muito-alto", label: "Muito alto", color: "#BD0026" },
        ],
      },
      user,
    );

    // Uma escrita à toa criaria uma versão nova e marcaria o índice publicado
    // como "alterações não publicadas" sem que exista alteração alguma.
    expect(contentful.patchManagementEntry).not.toHaveBeenCalled();
    expect(result.changed).toBe("nada");
    expect(result.requiresRepublish).toBe(false);
  });

  it("recusa uma edição que criaria uma classe nova", async () => {
    stubEntry();

    await expect(
      updateIndexCatalogAppearance(
        "entry-deg",
        {
          legend: [
            { id: "muito-baixo", label: "Muito baixo", color: "#FFFFCC" },
            { id: "muito-alto", label: "Muito alto", color: "#BD0026" },
            { id: "novo", label: "Classe nova", color: "#000000" },
          ],
        },
        user,
      ),
    ).rejects.toThrow(/mesma ordem/u);
    expect(contentful.patchManagementEntry).not.toHaveBeenCalled();
  });

  it("recusa a edição de aparência num índice criado pelo catálogo", async () => {
    stubEntry({ config: fullConfig });

    await expect(
      updateIndexCatalogAppearance(
        "entry-deg",
        { legend: [{ id: "c1", label: "X", color: "#000000" }] },
        user,
      ),
    ).rejects.toThrow(/escopo de apresentação/u);
  });
});
