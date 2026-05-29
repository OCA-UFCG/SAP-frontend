import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/telemetry/client", () => ({
  trackUiEvent: vi.fn(),
}));

vi.mock("@/utils/functions", () => ({
  normalize: (value: string) => value.toLowerCase(),
}));

vi.mock("@/utils/constants", () => ({
  statesObj: {
    pb: "paraiba",
    sp: "sao paulo",
  },
}));

vi.mock("@/data/citiesIndex.json", () => ({
  default: [
    {
      code: "2504009",
      label: "Campina Grande - PB",
      name: "Campina Grande",
      uf: "pb",
    },
  ],
}));

const searchBarMock = vi.fn();

vi.mock("@/components/SearchBar/SearchBar", () => ({
  default: (props: Record<string, unknown>) => {
    searchBarMock(props);
    return <div data-testid="search-bar-probe" />;
  },
}));

vi.mock("@/components/Map/MapComponent", () => ({
  default: () => <div data-testid="map-component-probe" />,
}));

vi.mock("@/components/AlertTiers/AlertTiers", () => ({
  AlertTiers: () => <div data-testid="alert-tiers-probe" />,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

import MapSection from "@/components/MapSection/MapSection";
import { trackUiEvent } from "@/services/telemetry/client";

describe("MapSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchBarMock.mockReset();
  });

  it("tracks municipality searches as not found on the home surface", () => {
    render(<MapSection />);

    const props = searchBarMock.mock.calls.at(-1)?.[0] as {
      onSearch: (
        value: string,
        metadata: { selectionMethod: "enter"; visibleOptionCount: number },
      ) => void;
    };

    act(() => {
      props.onSearch("Campina Grande - PB", {
        selectionMethod: "enter",
        visibleOptionCount: 1,
      });
    });

    expect(trackUiEvent).toHaveBeenCalledTimes(1);
    expect(trackUiEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "search_not_found",
        surface: "home",
        query: "Campina Grande - PB",
        resolvedLocationType: "city",
        resolvedStateKey: "pb",
        resolvedMunicipalityCode: "2504009",
        activeLayerId: "CDI",
        activeDateLabel: "31/01/24",
      }),
    );
  });
});
