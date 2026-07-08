import type { ReactNode } from "react";
import { MapLayerProvider } from "@/components/MapLayerContext/MapLayerContext";
import { PlatformMap } from "@/components/PlatformMap/PlatformMap";
import { PlatformSidebar } from "@/components/PlatformSidebar/PlatformSidebar";
import type { PlatformSidebarInitialSection } from "@/components/PlatformSidebar/PlatformSidebar";
import type { PanelLayerI } from "@/utils/interfaces";

type DefaultPlatformLayoutProps = {
  panelLayers: PanelLayerI[];
  showAuditLink?: boolean;
  initialSection?: PlatformSidebarInitialSection;
  viewMode?: "default";
  telemetryDashboard?: never;
  reportRequest?: { municipalityCode: string; period: string; layerIds: string[] };
};

type LogsPlatformLayoutProps = {
  showAuditLink?: boolean;
  initialSection?: PlatformSidebarInitialSection;
  viewMode: "logs";
  telemetryDashboard: ReactNode;
  panelLayers?: never;
  reportRequest?: never;
};

type PlatformLayoutProps = DefaultPlatformLayoutProps | LogsPlatformLayoutProps;

export function PlatformLayout({
  showAuditLink = false,
  initialSection = "monitoring",
  ...props
}: PlatformLayoutProps) {
  const viewMode = props.viewMode ?? "default";
  const isLogsView = props.viewMode === "logs";
  const isCommunicationView = !isLogsView && initialSection === "communication";
  const sidebarStateKey = `${viewMode}:${initialSection}`;
  const sidebarPanelLayers = props.viewMode === "logs" ? [] : props.panelLayers;

  return (
    <MapLayerProvider>
      <div className="relative w-full min-h-[calc(100vh-64px)] bg-neutral-50">
        {isLogsView ? (
          <div data-testid="platform-logs-shell" className="w-full">
            {props.telemetryDashboard}
          </div>
        ) : isCommunicationView ? (
          <div className="absolute inset-0 bg-[#F6F7F6]" aria-hidden="true" />
        ) : (
          <PlatformMap />
        )}
        <PlatformSidebar
          key={sidebarStateKey}
          panelLayers={sidebarPanelLayers}
          showAuditLink={showAuditLink}
          initialSection={initialSection}
          viewMode={viewMode}
          reportRequest={props.viewMode === "logs" ? undefined : props.reportRequest}
        />
      </div>
    </MapLayerProvider>
  );
}
