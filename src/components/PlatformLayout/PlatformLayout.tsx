import { MapLayerProvider } from "@/components/MapLayerContext/MapLayerContext";
import { PlatformMap } from "@/components/PlatformMap/PlatformMap";
import { PlatformSidebar } from "@/components/PlatformSidebar/PlatformSidebar";
import { TelemetryDashboard } from "@/components/TelemetryDashboard/TelemetryDashboard";
import type { PlatformSidebarInitialSection } from "@/components/PlatformSidebar/PlatformSidebar";
import type { TelemetryDashboardData } from "@/types/telemetry";
import type { PanelLayerI } from "@/utils/interfaces";

type DefaultPlatformLayoutProps = {
  panelLayers: PanelLayerI[];
  showAuditLink?: boolean;
  initialSection?: PlatformSidebarInitialSection;
  viewMode?: "default";
  telemetryDashboardData?: never;
};

type LogsPlatformLayoutProps = {
  showAuditLink?: boolean;
  initialSection?: PlatformSidebarInitialSection;
  viewMode: "logs";
  telemetryDashboardData: TelemetryDashboardData;
  panelLayers?: never;
};

type PlatformLayoutProps = DefaultPlatformLayoutProps | LogsPlatformLayoutProps;

export function PlatformLayout({
  showAuditLink = false,
  initialSection = "monitoring",
  ...props
}: PlatformLayoutProps) {
  const viewMode = props.viewMode ?? "default";
  const isLogsView = props.viewMode === "logs";
  const sidebarStateKey = `${viewMode}:${initialSection}`;
  const sidebarPanelLayers =
    props.viewMode === "logs" ? [] : props.panelLayers;

  return (
    <MapLayerProvider>
      <div className="relative w-full min-h-[calc(100vh-64px)] bg-neutral-50">
        {isLogsView ? (
          <div data-testid="platform-logs-shell" className="w-full">
            <TelemetryDashboard data={props.telemetryDashboardData} />
          </div>
        ) : (
          <PlatformMap />
        )}
        <PlatformSidebar
          key={sidebarStateKey}
          panelLayers={sidebarPanelLayers}
          showAuditLink={showAuditLink}
          initialSection={initialSection}
          viewMode={viewMode}
        />
      </div>
    </MapLayerProvider>
  );
}
