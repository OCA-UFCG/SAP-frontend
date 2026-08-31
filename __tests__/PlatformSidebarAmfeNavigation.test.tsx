import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("@/translations/routing", () => ({
  useRouter: () => ({ push: pushMock }),
  Link: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
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

afterEach(() => {
  cleanup();
  pushMock.mockReset();
});

describe("PlatformSidebar analysis navigation", () => {
  it("sends the analysis rail entry to the multicriteria page", async () => {
    const user = userEvent.setup();

    render(<PlatformSidebar panelLayers={[]} />);

    await user.click(screen.getByRole("button", { name: /Análise/i }));

    expect(pushMock).toHaveBeenCalledWith("/platform/amfe");
  });

  it("keeps the analysis entry pointing at the same page while it is open", async () => {
    const user = userEvent.setup();

    render(<PlatformSidebar panelLayers={[]} viewMode="amfe" />);

    await user.click(screen.getByRole("button", { name: /Análise/i }));

    expect(pushMock).toHaveBeenCalledWith("/platform/amfe");
  });

  it("returns to the monitoring page when leaving the multicriteria view", async () => {
    const user = userEvent.setup();

    render(<PlatformSidebar panelLayers={[]} viewMode="amfe" />);

    await user.click(screen.getByRole("button", { name: /Monitoramento/i }));

    expect(pushMock).toHaveBeenCalledWith("/platform");
  });
});
