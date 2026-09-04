"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { MapLayerProvider } from "@/components/MapLayerContext/MapLayerContext";
import { PlatformMap } from "@/components/PlatformMap/PlatformMap";
import { AmfeScreen } from "@/components/Amfe/AmfeScreen";
import { PlatformSidebar } from "@/components/PlatformSidebar/PlatformSidebar";
import type { PlatformSidebarInitialSection } from "@/components/PlatformSidebar/PlatformSidebar";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
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

type CatalogPlatformLayoutProps = {
  showAuditLink?: boolean;
  initialSection?: PlatformSidebarInitialSection;
  viewMode: "catalog";
  catalogDashboard: ReactNode;
  panelLayers?: never;
  telemetryDashboard?: never;
  reportRequest?: never;
};

type AmfePlatformLayoutProps = {
  showAuditLink?: boolean;
  initialSection?: PlatformSidebarInitialSection;
  viewMode: "amfe";
  panelLayers?: never;
  telemetryDashboard?: never;
  reportRequest?: never;
};

type PlatformLayoutProps =
  | DefaultPlatformLayoutProps
  | LogsPlatformLayoutProps
  | CatalogPlatformLayoutProps
  | AmfePlatformLayoutProps;

export function PlatformLayout({
  showAuditLink = false,
  initialSection = "monitoring",
  ...props
}: PlatformLayoutProps) {
  const viewMode = props.viewMode ?? "default";
  const isLogsView = props.viewMode === "logs";
  const isCatalogView = props.viewMode === "catalog";
  const isAmfeView = props.viewMode === "amfe";
  const isCommunicationView = !isLogsView && initialSection === "communication";
  const sidebarStateKey = `${viewMode}:${initialSection}`;
  const sidebarPanelLayers =
    props.viewMode === "logs" ||
    props.viewMode === "catalog" ||
    props.viewMode === "amfe"
      ? []
      : props.panelLayers;
  const [activeSection, setActiveSection] =
    useState<PlatformSection>(initialSection);

  return (
    <MapLayerProvider>
      <div className="relative flex flex-col w-full flex-1 min-h-0 bg-neutral-50">
        {isLogsView ? (
          <div data-testid="platform-logs-shell" className="w-full">
            {props.telemetryDashboard}
          </div>
        ) : isCatalogView ? (
          <div
            data-testid="platform-catalog-shell"
            className="min-h-[calc(100vh-64px)] w-full pl-[140px]"
          >
            {props.catalogDashboard}
          </div>
        ) : isAmfeView ? (
          <div
            data-testid="platform-amfe-shell"
            className="flex flex-1 min-h-0 w-full overflow-hidden pl-[140px]"
          >
            <AmfeScreen />
          </div>
        ) : isCommunicationView ? (
          <div className="absolute inset-0 bg-[#F6F7F6]" aria-hidden="true" />
        ) : (
          <PlatformMap
            showMonitoringOverlays={activeSection === "monitoring"}
          />
        )}
        <PlatformSidebar
          key={sidebarStateKey}
          panelLayers={sidebarPanelLayers}
          showAuditLink={showAuditLink}
          initialSection={initialSection}
          viewMode={viewMode}
          reportRequest={
            props.viewMode === "logs" ||
            props.viewMode === "catalog" ||
            props.viewMode === "amfe"
              ? undefined
              : props.reportRequest
          }
          onActiveSectionChange={setActiveSection}
        />
      </div>
    </MapLayerProvider>
  );
}
