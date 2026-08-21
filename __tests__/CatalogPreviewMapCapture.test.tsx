import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mapInstances, MapConstructorMock } = vi.hoisted(() => ({
  mapInstances: [] as Array<{
    getCanvas: ReturnType<typeof vi.fn>;
    handlers: Map<string, Array<() => void>>;
    remove: ReturnType<typeof vi.fn>;
  }>,
  MapConstructorMock: vi.fn(),
}));

vi.mock("maplibre-gl", () => {
  class MockMap {
    handlers = new globalThis.Map<string, Array<() => void>>();

    on = vi.fn((eventName: string, callback: () => void) => {
      this.handlers.set(eventName, [
        ...(this.handlers.get(eventName) ?? []),
        callback,
      ]);
      return this;
    });
    getCanvas = vi.fn(() => ({
      toDataURL: vi.fn(() => `data:image/png;base64,${"a".repeat(160)}`),
    }));
    remove = vi.fn();

    constructor(public readonly options: unknown) {
      MapConstructorMock(options);
      mapInstances.push(this);
    }
  }

  return { default: { Map: MockMap }, Map: MockMap };
});

vi.mock("@/components/Map/mapBounds", () => ({
  BRAZIL_RASTER_BOUNDS: [-74, -34, -34, 5],
}));

vi.mock("@/components/Map/mapDefinitions", () => ({
  BASE_STYLE: { version: 8, sources: {}, layers: [] },
  ensureMapLayers: vi.fn(),
}));

vi.mock("@/services/mapServices", () => ({ fetchMapURL: vi.fn() }));

import { CatalogPreviewMapCapture } from "@/components/IndexCatalog/CatalogPreviewMapCapture";
import { ensureMapLayers } from "@/components/Map/mapDefinitions";
import { fetchMapURL } from "@/services/mapServices";
import type { IndexCatalogPreview } from "@/types/indexCatalog";

const preview = {
  entryId: "entry-1",
  panelLayer: {
    sys: { id: "entry-1" },
    id: "indice-aridez",
    name: "Índice de Aridez",
    description: "",
    category: "Dados Climáticos",
    imageData: {
      schemaVersion: 1,
      type: "territorial-compact",
      defaultYear: "2025",
      classes: [{ id: "classe-0", label: "Classe 0", color: "#D9ED92" }],
      locations: { br: "Brasil" },
      years: {
        "2024": { imageId: "mapa-2024", values: {} },
        "2025": { imageId: "mapa-2025", values: {} },
      },
    },
    statisticsSource: {},
    tileApiPath: "/api/index-catalog/drafts/entry-1/ee",
    municipalAnalysisApiPath:
      "/api/index-catalog/drafts/entry-1/municipal-analysis",
  },
  validation: {
    validatedAt: "2026-08-21T18:00:00.000Z",
    valid: true,
    errors: [],
    warnings: [],
    inferred: {
      panelLayerId: "indice-aridez",
      periods: ["2024", "2025"],
      classIndexes: [0],
      statisticsAssetCount: 1,
    },
    sourceFingerprint: "a".repeat(64),
  },
} as unknown as IndexCatalogPreview;

function emit(instanceIndex: number, eventName: string) {
  const handlers = mapInstances[instanceIndex]?.handlers.get(eventName) ?? [];
  act(() => {
    for (const handler of handlers) handler();
  });
}

describe("CatalogPreviewMapCapture", () => {
  beforeEach(() => {
    mapInstances.length = 0;
    vi.clearAllMocks();
    vi.mocked(fetchMapURL).mockResolvedValue(
      "https://tiles.example/{z}/{x}/{y}",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          url: "https://images.ctfassets.net/space/asset/previa.png",
          requiresRepublish: false,
        }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("captures the default period map and saves it through the catalog route", async () => {
    render(<CatalogPreviewMapCapture preview={preview} />);

    await waitFor(() => expect(mapInstances).toHaveLength(1));
    expect(fetchMapURL).toHaveBeenCalledWith(
      "indice-aridez",
      "2025",
      expect.any(AbortSignal),
      undefined,
      undefined,
      "/api/index-catalog/drafts/entry-1/ee",
    );
    expect(MapConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({ preserveDrawingBuffer: true, pixelRatio: 2 }),
    );

    emit(0, "load");
    expect(ensureMapLayers).toHaveBeenCalledWith(
      expect.anything(),
      "platform",
      true,
      false,
      "https://tiles.example/{z}/{x}/{y}",
    );

    emit(0, "idle");

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/index-catalog/drafts/entry-1/preview-map",
        expect.objectContaining({ method: "POST" }),
      );
    });
    const [, requestInit] = vi.mocked(globalThis.fetch).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(requestInit.body)).image).toMatch(
      /^data:image\/png;base64,/,
    );
    expect(
      (requestInit.headers as Record<string, string>)["Idempotency-Key"],
    ).toMatch(/^preview-map-entry-1-/);
    await screen.findByText(
      "Imagem guardada. Ela será publicada junto com o índice.",
    );
  });

  it("reports a capture the browser could not produce", async () => {
    render(<CatalogPreviewMapCapture preview={preview} />);

    await waitFor(() => expect(mapInstances).toHaveLength(1));
    mapInstances[0].getCanvas.mockReturnValueOnce({
      toDataURL: vi.fn(() => {
        throw new Error("contexto perdido");
      }),
    });

    emit(0, "load");
    emit(0, "idle");

    await screen.findByText(/não conseguiu capturar o mapa/);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("says a published index only shows the new image after republishing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          url: "https://images/previa.png",
          requiresRepublish: true,
        }),
      ),
    );

    render(<CatalogPreviewMapCapture preview={preview} />);
    await waitFor(() => expect(mapInstances).toHaveLength(1));
    emit(0, "load");
    emit(0, "idle");

    await screen.findByText(/próxima publicação deste índice/);
  });
});
