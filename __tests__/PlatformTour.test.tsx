import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { driverMock, driveMock, destroyMock } = vi.hoisted(() => {
  const driveMock = vi.fn();
  const destroyMock = vi.fn();
  return {
    driveMock,
    destroyMock,
    driverMock: vi.fn(() => ({ drive: driveMock, destroy: destroyMock })),
  };
});

vi.mock("driver.js", () => ({ driver: driverMock }));

vi.mock("@/translations/routing", () => ({
  useRouter: () => ({ push: vi.fn() }),
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/MapLayerContext/MapLayerContext", () => ({
  useMapLayerActions: () => ({ setActiveLegend: vi.fn() }),
}));

vi.mock("@/components/PlatformSidePanel/PlatformSidePanel", () => ({
  PlatformSidePanel: () => <div data-testid="platform-side-panel-probe" />,
}));

vi.mock("@/components/MunicipalReport/MunicipalReportPreview", () => ({
  MunicipalReportPreview: () => <div data-testid="municipal-report-probe" />,
}));

import { PlatformSidebar } from "@/components/PlatformSidebar/PlatformSidebar";
import { LayerAccordion } from "@/components/LayerAccordion/LayerAccordion";
import {
  PLATFORM_TOUR_SEEN_KEY,
  revealFirstLayerCard,
} from "@/components/PlatformTour/usePlatformTour";

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  driverMock.mockClear();
  driveMock.mockClear();
  destroyMock.mockClear();
});

function waitPastAutoStart() {
  act(() => {
    vi.advanceTimersByTime(1000);
  });
}

describe("platform tour", () => {
  it("opens by itself on the first visit to the monitoring list", () => {
    render(<PlatformSidebar panelLayers={[]} />);
    waitPastAutoStart();

    expect(driverMock).toHaveBeenCalledTimes(1);
    expect(driverMock.mock.calls[0][0]).toMatchObject({ showProgress: true });
    expect(
      (driverMock.mock.calls[0][0] as { steps: unknown[] }).steps,
    ).toHaveLength(7);
    expect(driveMock).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(PLATFORM_TOUR_SEEN_KEY)).toBe("1");
  });

  it("does not open by itself again once seen", () => {
    window.localStorage.setItem(PLATFORM_TOUR_SEEN_KEY, "1");

    render(<PlatformSidebar panelLayers={[]} />);
    waitPastAutoStart();

    expect(driverMock).not.toHaveBeenCalled();
  });

  // Quem chega por um link de relatório ou de detalhamento veio fazer outra
  // coisa: escurecer a tela por cima disso atrapalha.
  it.each([
    ["a report link", { initialSection: "communication" as const }],
    ["an index detail link", { detailLayerId: "spi" }],
  ])("does not open by itself when arriving through %s", (_label, props) => {
    render(<PlatformSidebar panelLayers={[]} {...props} />);
    waitPastAutoStart();

    expect(driverMock).not.toHaveBeenCalled();
  });

  it("replays from the rail button, back on the monitoring list", () => {
    window.localStorage.setItem(PLATFORM_TOUR_SEEN_KEY, "1");
    const onActiveSectionChange = vi.fn();

    render(
      <PlatformSidebar
        panelLayers={[]}
        initialSection="communication"
        onActiveSectionChange={onActiveSectionChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Ver o tutorial da plataforma" }),
    );
    expect(onActiveSectionChange).toHaveBeenCalledWith("monitoring");

    waitPastAutoStart();
    expect(driverMock).toHaveBeenCalledTimes(1);
    expect(driveMock).toHaveBeenCalledTimes(1);
  });

  it("hides the replay button on the audit and catalog views", () => {
    render(<PlatformSidebar panelLayers={[]} viewMode="logs" />);

    expect(
      screen.queryByRole("button", { name: "Ver o tutorial da plataforma" }),
    ).not.toBeInTheDocument();
  });
});

describe("revealFirstLayerCard", () => {
  it("opens every closed accordion around the first card", () => {
    render(
      <LayerAccordion title="Dados climáticos">
        <LayerAccordion title="Seca">
          <div data-tour="layer-card" />
        </LayerAccordion>
      </LayerAccordion>,
    );

    let opened = false;
    act(() => {
      opened = revealFirstLayerCard();
    });

    expect(opened).toBe(true);
    expect(
      screen.getByRole("button", { name: "Dados climáticos" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Seca" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("reports nothing to wait for when the card is already visible", () => {
    render(
      <LayerAccordion title="Dados climáticos" defaultOpen>
        <div data-tour="layer-card" />
      </LayerAccordion>,
    );

    expect(revealFirstLayerCard()).toBe(false);
  });
});
