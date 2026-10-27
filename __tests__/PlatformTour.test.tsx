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
  hasSeenPlatformTour,
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
    [
      "a report link",
      {
        initialSection: "communication" as const,
        reportRequest: { locationKey: "2507507", period: "2026", layerIds: [] },
      },
    ],
    ["an index detail link", { detailLayerId: "spi" }],
  ])("does not open by itself when arriving through %s", (_label, props) => {
    render(<PlatformSidebar panelLayers={[]} {...props} />);
    waitPastAutoStart();

    expect(driverMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      "analysis" as const,
      [
        undefined,
        '[data-tour="analysis-criteria"]',
        '[data-tour="analysis-area"]',
        '[data-tour="analysis-level"]',
        '[data-tour="analysis-submit"]',
        '[data-tour="platform-tour-replay"]',
      ],
    ],
    [
      "communication" as const,
      [
        undefined,
        '[data-tour="report-area"]',
        '[data-tour="report-layers"]',
        '[data-tour="report-submit"]',
        '[data-tour="platform-tour-replay"]',
      ],
    ],
  ])("opens the %s tour by itself on the first visit", (section, elements) => {
    window.localStorage.setItem(PLATFORM_TOUR_SEEN_KEY, "1");

    render(<PlatformSidebar panelLayers={[]} initialSection={section} />);
    waitPastAutoStart();

    expect(driverMock).toHaveBeenCalledTimes(1);
    const steps = (driverMock.mock.calls[0][0] as { steps: { element?: string }[] }).steps;
    expect(steps.map((step) => step.element)).toEqual(elements);
    expect(hasSeenPlatformTour(section)).toBe(true);
  });

  it("opens the tour of a section entered later in the visit", () => {
    window.localStorage.setItem(PLATFORM_TOUR_SEEN_KEY, "1");

    render(<PlatformSidebar panelLayers={[]} />);
    waitPastAutoStart();
    expect(driverMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Comunicação" }));
    waitPastAutoStart();

    expect(driverMock).toHaveBeenCalledTimes(1);
    expect(hasSeenPlatformTour("communication")).toBe(true);
  });

  it("replays the tour of the current section from the rail button", () => {
    window.localStorage.setItem(PLATFORM_TOUR_SEEN_KEY, "1");
    window.localStorage.setItem("sedes.platformTour.communication.v1.seen", "1");
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
    expect(onActiveSectionChange).toHaveBeenCalledWith("communication");

    waitPastAutoStart();
    expect(driverMock).toHaveBeenCalledTimes(1);
    expect(driveMock).toHaveBeenCalledTimes(1);
    const steps = (driverMock.mock.calls[0][0] as { steps: { element?: string }[] }).steps;
    expect(steps[1].element).toBe('[data-tour="report-area"]');
  });

  // No celular, quem tem itens de administração encontra o "Tutorial" dentro
  // do "Mais": o último passo aponta para lá, não para o botão escondido.
  it("points the last step at the 'Mais' button on a phone with admin items", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ count: 0 })));
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );

    try {
      render(<PlatformSidebar panelLayers={[]} showAuditLink />);
      waitPastAutoStart();

      const steps = (driverMock.mock.calls[0][0] as { steps: { element?: string }[] }).steps;
      expect(steps.at(-1)?.element).toBe('[data-tour="platform-more"]');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  // O balão vive fora do <main>: a tag <footer> dele virava um segundo rodapé
  // da página, e o div do passo sem alvo ficava com ARIA que não pode ter.
  it("keeps the popover out of the page landmarks and ARIA errors", () => {
    render(<PlatformSidebar panelLayers={[]} />);
    waitPastAutoStart();

    const config = driverMock.mock.calls[0][0] as {
      onPopoverRender: (dom: unknown, options: unknown) => void;
      onHighlighted: (element: Element | undefined) => void;
    };
    const footer = document.createElement("footer");
    config.onPopoverRender(
      { footer, progress: document.createElement("span") },
      { config: { steps: [] }, index: 0 },
    );
    expect(footer).toHaveAttribute("role", "none");

    const dummy = document.createElement("div");
    dummy.id = "driver-dummy-element";
    dummy.setAttribute("aria-haspopup", "dialog");
    dummy.setAttribute("aria-expanded", "true");
    dummy.setAttribute("aria-controls", "driver-popover-content");
    document.body.append(dummy);
    try {
      config.onHighlighted(undefined);
      expect(dummy).not.toHaveAttribute("aria-haspopup");
      expect(dummy).not.toHaveAttribute("aria-expanded");
      expect(dummy).not.toHaveAttribute("aria-controls");
    } finally {
      dummy.remove();
    }
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
