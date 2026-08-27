import "@testing-library/jest-dom/vitest";
import type { FeatureCollection, Geometry } from "geojson";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSpatialBoundaryCache,
  useSpatialBoundaryOverlay,
} from "@/components/PlatformMap/useSpatialBoundaryOverlay";
import type { SpatialSelection } from "@/utils/spatialScope";

function makeBoundary(
  name: string,
): FeatureCollection<Geometry, { name: string }> {
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name },
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-40, -10],
              [-39, -10],
              [-39, -9],
              [-40, -10],
            ],
          ],
        },
      },
    ],
  };
}

function makeCollection(
  ...names: string[]
): FeatureCollection<Geometry, { name: string }> {
  return {
    type: "FeatureCollection",
    features: names.flatMap((name) => makeBoundary(name).features),
  };
}

const names = (
  collection: FeatureCollection<Geometry, { name: string }> | null,
) =>
  collection?.features.map((feature) => feature.properties.name).join(",") ??
  "no-boundary";

function Probe({ selection }: { selection: SpatialSelection }) {
  const { boundaryGeoJson, activeBoundaryGeoJson, status } =
    useSpatialBoundaryOverlay(selection);

  return (
    <div>
      <span>{status}</span>
      <span data-testid="drawn">{names(boundaryGeoJson)}</span>
      <span data-testid="active">{names(activeBoundaryGeoJson)}</span>
    </div>
  );
}

describe("useSpatialBoundaryOverlay", () => {
  beforeEach(() => {
    clearSpatialBoundaryCache();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("stays idle and does not fetch for national or regional scopes", () => {
    const { rerender } = render(
      <Probe selection={{ spatialArea: "national", spatialValue: "brasil" }} />,
    );

    expect(screen.getByText("idle")).toBeInTheDocument();

    rerender(
      <Probe selection={{ spatialArea: "region", spatialValue: "Nordeste" }} />,
    );

    expect(screen.getByText("idle")).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("loads and exposes boundary GeoJSON", async () => {
    const boundary = makeBoundary("Caatinga");
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(boundary), { status: 200 }),
    );

    render(
      <Probe selection={{ spatialArea: "biome", spatialValue: "Caatinga" }} />,
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("ready")).toBeInTheDocument();
      expect(screen.getByTestId("drawn")).toHaveTextContent("Caatinga");
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/spatial-boundary?spatialArea=biome&scope=area",
      { signal: expect.any(AbortSignal) },
    );
  });

  it("aborts the previous request and ignores its stale response", async () => {
    let resolveBiomes!: (response: Response) => void;
    const pendingBiomes = new Promise<Response>((resolve) => {
      resolveBiomes = resolve;
    });
    vi.mocked(fetch)
      .mockImplementationOnce(() => pendingBiomes)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(makeBoundary("ASD")), { status: 200 }),
      );

    const { rerender } = render(
      <Probe selection={{ spatialArea: "biome", spatialValue: "Pampa" }} />,
    );
    const firstSignal = vi.mocked(fetch).mock.calls[0]?.[1]?.signal;

    rerender(<Probe selection={{ spatialArea: "asd", spatialValue: "ASD" }} />);

    expect(firstSignal?.aborted).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId("drawn")).toHaveTextContent("ASD");
    });

    resolveBiomes(
      new Response(JSON.stringify(makeBoundary("Pampa")), { status: 200 }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("drawn")).not.toHaveTextContent("Pampa");
      expect(screen.getByTestId("drawn")).toHaveTextContent("ASD");
    });
  });

  it("downloads the biome collection once and reuses it for every biome", async () => {
    // Antes a URL carregava o bioma selecionado, então trocar de bioma baixava
    // de novo os mesmos 1,6 MB e guardava uma cópia por bioma.
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(makeCollection("Caatinga", "Cerrado")), {
        status: 200,
      }),
    );

    const { rerender } = render(
      <Probe selection={{ spatialArea: "biome", spatialValue: "Caatinga" }} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("active")).toHaveTextContent("Caatinga");
    });

    rerender(
      <Probe selection={{ spatialArea: "biome", spatialValue: "Cerrado" }} />,
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("active")).toHaveTextContent("Cerrado");
  });

  it("exposes the whole area to draw and only the selection to frame", async () => {
    // Regressão: enquadrar pela coleção inteira dá a caixa do Brasil, igual
    // para os seis biomas, e a câmera para de se mover ao trocar de bioma.
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify(makeCollection("Caatinga", "Cerrado", "Pampa")),
        { status: 200 },
      ),
    );

    render(
      <Probe selection={{ spatialArea: "biome", spatialValue: "Cerrado" }} />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("drawn")).toHaveTextContent(
        "Caatinga,Cerrado,Pampa",
      );
    });
    expect(screen.getByTestId("active")).toHaveTextContent("Cerrado");
  });

  it("reuses a cached boundary when returning to a previous selection", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(makeBoundary("Mata Atlântica")), {
        status: 200,
      }),
    );

    const { rerender } = render(
      <Probe
        selection={{
          spatialArea: "biome",
          spatialValue: "Mata Atlântica",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("drawn")).toHaveTextContent("Mata Atlântica");
    });

    rerender(
      <Probe selection={{ spatialArea: "national", spatialValue: "brasil" }} />,
    );
    rerender(
      <Probe
        selection={{
          spatialArea: "biome",
          spatialValue: "Mata Atlântica",
        }}
      />,
    );

    expect(screen.getByText("ready")).toBeInTheDocument();
    expect(screen.getByTestId("drawn")).toHaveTextContent("Mata Atlântica");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reports an HTTP failure without exposing invalid boundary data", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 503 }));

    render(
      <Probe selection={{ spatialArea: "biome", spatialValue: "Cerrado" }} />,
    );

    await waitFor(() => {
      expect(screen.getByText("error")).toBeInTheDocument();
      expect(screen.getByTestId("drawn")).toHaveTextContent("no-boundary");
    });
  });
});
