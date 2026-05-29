import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TelemetryDashboard } from "@/components/TelemetryDashboard/TelemetryDashboard";
import type { TelemetryDashboardData } from "@/types/telemetry";

const dashboardData: TelemetryDashboardData = {
  sampledEventCount: 4,
  sampledWindowLabel: "Ultimos 120 eventos",
  lastReceivedAt: "2026-05-29T12:10:00.000Z",
  eventCounts: [
    { label: "search_found", count: 2 },
    { label: "search_not_found", count: 1 },
    { label: "layer_details_opened", count: 1 },
    { label: "layer_toggled", count: 3 },
  ],
  surfaceCounts: [
    { label: "analysis-panel", count: 3 },
    { label: "home", count: 1 },
  ],
  topSearchQueries: [],
  topNotFoundQueries: [],
  topActivatedLayers: [{ label: "Home - CDI Jan 2024", count: 1 }],
  topDetailedLayers: [{ label: "Home - CDI Jan 2024", count: 1 }],
  recentEvents: [
    {
      eventName: "search_not_found",
      surface: "analysis-panel",
      anonymousSessionId: "anon-1",
      occurredAt: "2026-05-29T12:09:59.000Z",
      receivedAt: "2026-05-29T12:10:00.000Z",
      receivedDay: "2026-05-29",
      uid: null,
      userEmail: "oca@gmail.com",
      query: "cidade sem dado",
      selectionMethod: "button",
      activeLayerId: "layer-1",
      activeLayerName: "CDI Jan 2024",
      activeDateLabel: "2024",
      resolvedLocationType: "city",
    },
    {
      eventName: "layer_details_opened",
      surface: "home",
      anonymousSessionId: "anon-2",
      occurredAt: "2026-05-29T12:08:59.000Z",
      receivedAt: "2026-05-29T12:09:00.000Z",
      receivedDay: "2026-05-29",
      uid: null,
      userEmail: null,
      activeLayerId: "CDI",
      activeLayerName: "CDI Jan 2024",
      activeDateLabel: "31/01/24",
      activeSection: "overview",
    },
  ],
};

describe("TelemetryDashboard", () => {
  it("renders readable labels for events, surfaces, and the Layer column", () => {
    render(<TelemetryDashboard data={dashboardData} />);

    expect(screen.getByText("Logs da plataforma")).toBeInTheDocument();
    expect(screen.getByText("Busca encontrada")).toBeInTheDocument();
    expect(screen.getAllByText("Busca não encontrada").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getAllByText("Clique em Detalhamento").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Layer ativado")).toBeInTheDocument();
    expect(screen.getAllByText("Plataforma").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Home - CDI Jan 2024").length).toBeGreaterThan(
      0,
    );
    const surfaceCard = screen
      .getByText("Logs por superfície")
      .closest("article");

    expect(surfaceCard).not.toBeNull();

    const scopedCard = within(surfaceCard as HTMLElement);

    expect(scopedCard.getByText("Plataforma")).toBeInTheDocument();
    expect(scopedCard.getByText("Home")).toBeInTheDocument();
    expect(scopedCard.getByText("3")).toBeInTheDocument();
    expect(scopedCard.getByText("1")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Layer" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Usuário" }),
    ).toBeInTheDocument();
    expect(screen.getByText("oca@gmail.com")).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: "Camada" }),
    ).not.toBeInTheDocument();
  });
});
