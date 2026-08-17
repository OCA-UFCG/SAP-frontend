import type { FeatureCollection, Geometry } from "geojson";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSpatialBoundaryOverlay } from "@/components/PlatformMap/useSpatialBoundaryOverlay";
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

function Probe({ selection }: { selection: SpatialSelection }) {
  const { boundaryGeoJson, status } = useSpatialBoundaryOverlay(selection);

  return (
    <div>
      <span>{status}</span>
      <span>
        {boundaryGeoJson?.features[0]?.properties.name ?? "no-boundary"}
      </span>
    </div>
  );
}

describe("useSpatialBoundaryOverlay", () => {
  beforeEach(() => {
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
      expect(screen.getByText("Caatinga")).toBeInTheDocument();
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/spatial-boundary?spatialArea=biome&spatialValue=Caatinga",
      { signal: expect.any(AbortSignal) },
    );
  });

  it("aborts the previous request and ignores its stale response", async () => {
    let resolvePampa!: (response: Response) => void;
    const pendingPampa = new Promise<Response>((resolve) => {
      resolvePampa = resolve;
    });
    vi.mocked(fetch)
      .mockImplementationOnce(() => pendingPampa)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(makeBoundary("Pantanal")), {
          status: 200,
        }),
      );

    const { rerender } = render(
      <Probe selection={{ spatialArea: "biome", spatialValue: "Pampa" }} />,
    );
    const firstSignal = vi.mocked(fetch).mock.calls[0]?.[1]?.signal;

    rerender(
      <Probe selection={{ spatialArea: "biome", spatialValue: "Pantanal" }} />,
    );

    expect(firstSignal?.aborted).toBe(true);
    await waitFor(() => {
      expect(screen.getByText("Pantanal")).toBeInTheDocument();
    });

    resolvePampa(
      new Response(JSON.stringify(makeBoundary("Pampa")), { status: 200 }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Pampa")).not.toBeInTheDocument();
      expect(screen.getByText("Pantanal")).toBeInTheDocument();
    });
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
      expect(screen.getByText("Mata Atlântica")).toBeInTheDocument();
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
    expect(screen.getByText("Mata Atlântica")).toBeInTheDocument();
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
      expect(screen.getByText("no-boundary")).toBeInTheDocument();
    });
  });
});
