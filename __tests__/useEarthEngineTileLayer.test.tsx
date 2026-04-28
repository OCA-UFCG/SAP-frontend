import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/mapServices", () => ({
  fetchMapURL: vi.fn(),
}));

import { useEarthEngineTileLayer } from "@/components/PlatformMap/useEarthEngineTileLayer";
import { fetchMapURL } from "@/services/mapServices";
import type { IEEInfo, IImageParam } from "@/utils/interfaces";

const mockedFetchMapURL = vi.mocked(fetchMapURL);

const legend: IImageParam[] = [
  {
    color: "#989F43",
    label: "Legenda",
  },
];

const eeLayer = {
  id: "ee-layer",
  name: "Layer EE",
  description: "Layer EE",
  measurementUnit: "%",
  poster: "/poster.png",
  imageData: {
    2024: {
      default: true,
      imageId: "projects/example/image",
      imageParams: legend,
    },
  },
  type: "raster",
} as IEEInfo;

function Probe({
  activeEEData,
  activeYear,
}: {
  activeEEData: IEEInfo | null;
  activeYear: string;
}) {
  const tileLayerUrl = useEarthEngineTileLayer(activeEEData, activeYear);

  return <div>{tileLayerUrl ?? "no-url"}</div>;
}

describe("useEarthEngineTileLayer", () => {
  beforeEach(() => {
    mockedFetchMapURL.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("returns the fetched tile url for the active EE layer and year", async () => {
    mockedFetchMapURL.mockResolvedValueOnce("https://tiles.example/2024");

    render(<Probe activeEEData={eeLayer} activeYear="2024" />);

    await waitFor(() => {
      expect(
        screen.getByText("https://tiles.example/2024"),
      ).toBeInTheDocument();
    });

    expect(mockedFetchMapURL).toHaveBeenCalledWith(
      "ee-layer",
      "2024",
      {
        imageId: "projects/example/image",
        imageParams: legend,
        minScale: undefined,
        maxScale: undefined,
      },
      expect.any(AbortSignal),
    );
  });

  it("hides the visible tile url when an active EE layer is cleared", async () => {
    mockedFetchMapURL.mockResolvedValueOnce("https://tiles.example/2024");

    const { rerender } = render(
      <Probe activeEEData={eeLayer} activeYear="2024" />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("https://tiles.example/2024"),
      ).toBeInTheDocument();
    });

    rerender(<Probe activeEEData={null} activeYear="general" />);

    await waitFor(() => {
      expect(screen.getByText("no-url")).toBeInTheDocument();
    });
  });

  it("does not fetch when the selected year is not available for the active layer", async () => {
    render(<Probe activeEEData={eeLayer} activeYear="2023" />);

    await waitFor(() => {
      expect(screen.getByText("no-url")).toBeInTheDocument();
    });

    expect(mockedFetchMapURL).not.toHaveBeenCalled();
  });

  it("clears the visible tile url when no EE layer is active", async () => {
    render(<Probe activeEEData={null} activeYear="general" />);

    await waitFor(() => {
      expect(screen.getByText("no-url")).toBeInTheDocument();
    });

    expect(mockedFetchMapURL).not.toHaveBeenCalled();
  });
});
