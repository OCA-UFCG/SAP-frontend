import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TelemetryDashboardData } from "@/types/telemetry";

const { getTelemetryDashboardDataMock, telemetryDashboardMock } = vi.hoisted(
  () => ({
    getTelemetryDashboardDataMock: vi.fn(),
    telemetryDashboardMock: vi.fn(),
  }),
);

vi.mock("@/services/telemetry/telemetryService", () => ({
  getTelemetryDashboardData: getTelemetryDashboardDataMock,
}));

vi.mock("@/components/TelemetryDashboard/TelemetryDashboard", () => ({
  TelemetryDashboard: (props: Record<string, unknown>) => {
    telemetryDashboardMock(props);
    return <div data-testid="telemetry-dashboard-probe" />;
  },
}));

import { TelemetryDashboardServer } from "@/components/TelemetryDashboard/TelemetryDashboardServer";

const dashboardData: TelemetryDashboardData = {
  sampledEventCount: 4,
  sampledWindowLabel: "Janela recente",
  lastReceivedAt: "2026-05-29T12:00:00.000Z",
  eventCounts: [],
  surfaceCounts: [],
  topSearchQueries: [],
  topNotFoundQueries: [],
  topActivatedLayers: [],
  topDetailedLayers: [],
  recentEvents: [],
};

afterEach(() => {
  cleanup();
});

describe("TelemetryDashboardServer", () => {
  beforeEach(() => {
    getTelemetryDashboardDataMock.mockReset();
    telemetryDashboardMock.mockReset();
    getTelemetryDashboardDataMock.mockResolvedValue(dashboardData);
  });

  it("loads the dashboard data server-side before rendering the dashboard", async () => {
    const result = await TelemetryDashboardServer();
    render(result);

    expect(getTelemetryDashboardDataMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("telemetry-dashboard-probe")).toBeInTheDocument();
    expect(telemetryDashboardMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        data: dashboardData,
      }),
    );
  });
});
