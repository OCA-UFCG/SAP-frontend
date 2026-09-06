"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { MapLayerProvider } from "@/components/MapLayerContext/MapLayerContext";
import { AmfeAnalysisProvider } from "@/components/Amfe/AmfeAnalysisContext";
import { AmfeAnalysisFormColumn } from "@/components/Amfe/AmfeAnalysisFormColumn";
import { PlatformMap } from "@/components/PlatformMap/PlatformMap";
import type { PlatformMapSection } from "@/components/PlatformMap/PlatformMap";
import { PlatformSidebar } from "@/components/PlatformSidebar/PlatformSidebar";
import type { PlatformSidebarInitialSection } from "@/components/PlatformSidebar/PlatformSidebar";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
import { PLATFORM_SHELL_MIN_HEIGHT_CLASS } from "./platformShell";
import type { PanelLayerI } from "@/utils/interfaces";

type DefaultPlatformLayoutProps = {
  panelLayers: PanelLayerI[];
  showAuditLink?: boolean;
  initialSection?: PlatformSidebarInitialSection;
  viewMode?: "default";
  telemetryDashboard?: never;
  reportRequest?: {
    municipalityCode: string;
    period: string;
    layerIds: string[];
  };
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

type PlatformLayoutProps =
  | DefaultPlatformLayoutProps
  | LogsPlatformLayoutProps
  | CatalogPlatformLayoutProps;

function resolveMapSection(activeSection: PlatformSection): PlatformMapSection {
  if (activeSection === "analysis") return "analysis";
  if (activeSection === "communication") return "communication";
  return "monitoring";
}

export function PlatformLayout({
  showAuditLink = false,
  initialSection = "monitoring",
  ...props
}: PlatformLayoutProps) {
  const viewMode = props.viewMode ?? "default";
  const isLogsView = props.viewMode === "logs";
  const isCatalogView = props.viewMode === "catalog";
  const sidebarStateKey = `${viewMode}:${initialSection}`;
  const sidebarPanelLayers =
    props.viewMode === "logs" || props.viewMode === "catalog"
      ? []
      : props.panelLayers;
  const [activeSection, setActiveSection] =
    useState<PlatformSection>(initialSection);

  return (
    <MapLayerProvider>
      <AmfeAnalysisProvider>
        {/* Toda seção começa na mesma altura: o que sobra da viewport abaixo do
            cabeçalho. O rodapé vem logo depois, fora da dobra, e só aparece
            quando a pessoa rola. */}
        <div
          className={`relative flex w-full flex-col bg-neutral-50 ${PLATFORM_SHELL_MIN_HEIGHT_CLASS}`}
        >
          {isLogsView ? (
            <div data-testid="platform-logs-shell" className="w-full">
              {props.telemetryDashboard}
            </div>
          ) : isCatalogView ? (
            <div
              data-testid="platform-catalog-shell"
              className={`w-full pl-[140px] ${PLATFORM_SHELL_MIN_HEIGHT_CLASS}`}
            >
              {props.catalogDashboard}
            </div>
          ) : (
            <>
              {/* Monitoramento, Análise e Comunicação compartilham este mapa:
                  trocar de seção muda as propriedades dele, não a instância. */}
              <PlatformMap
                section={resolveMapSection(activeSection)}
                showMonitoringControls={activeSection === "monitoring"}
              />
              {activeSection === "analysis" && <AmfeAnalysisFormColumn />}
            </>
          )}
          <PlatformSidebar
            key={sidebarStateKey}
            panelLayers={sidebarPanelLayers}
            showAuditLink={showAuditLink}
            initialSection={initialSection}
            viewMode={viewMode}
            reportRequest={
              props.viewMode === "logs" || props.viewMode === "catalog"
                ? undefined
                : props.reportRequest
            }
            onActiveSectionChange={setActiveSection}
          />
        </div>
      </AmfeAnalysisProvider>
    </MapLayerProvider>
  );
}
