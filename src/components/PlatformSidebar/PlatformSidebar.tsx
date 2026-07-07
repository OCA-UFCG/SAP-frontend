"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlatformSection,
  PlatformSideRail,
} from "@/components/PlatformSideRail/PlatformSideRail";
import { PlatformSidePanel } from "@/components/PlatformSidePanel/PlatformSidePanel";
import { CommunicationReportViewer } from "@/components/CommunicationReportViewer/CommunicationReportViewer";
import { AnalysisContext } from "@/components/SidePanelContexts/AnalysisContext";
import { CommunicationContext } from "@/components/SidePanelContexts/CommunicationContext";
import type { CommunicationReportSelection } from "@/components/SidePanelContexts/CommunicationContext";
import { ComingSoonContext } from "@/components/SidePanelContexts/ComingSoonContext";
import { PanelLayerI } from "@/utils/interfaces";
import { useMapLayerActions } from "@/components/MapLayerContext/MapLayerContext";
import { useTranslations, useLocale } from "next-intl";

export type PlatformSidebarInitialSection =
  | "monitoring"
  | "analysis"
  | "communication";

export type PlatformSidebarViewMode = "default" | "logs";

function buildSidebarState(
  viewMode: PlatformSidebarViewMode,
  initialSection: PlatformSidebarInitialSection,
) {
  if (viewMode === "logs") {
    return {
      activeSection: "logs" as const,
      panelSection: "monitoring" as const,
      isPanelOpen: false,
      showAnalysisFrame: false,
    };
  }

  if (initialSection === "analysis") {
    return {
      activeSection: "analysis" as const,
      panelSection: "monitoring" as const,
      isPanelOpen: false,
      showAnalysisFrame: true,
    };
  }

  return {
    activeSection: initialSection,
    panelSection: initialSection,
    isPanelOpen: true,
    showAnalysisFrame: false,
  };
}

function buildPlatformHref(section: PlatformSidebarInitialSection) {
  if (section === "monitoring") {
    return "/platform";
  }

  return `/platform?section=${section}`;
}

interface PlatformSidebarProps {
  panelLayers: PanelLayerI[];
  showAuditLink?: boolean;
  initialSection?: PlatformSidebarInitialSection;
  viewMode?: PlatformSidebarViewMode;
}

export function PlatformSidebar({
  panelLayers,
  showAuditLink = false,
  initialSection = "monitoring",
  viewMode = "default",
}: PlatformSidebarProps) {
  const t = useTranslations("PlatformSidebar");
  const router = useRouter();
  const { clearActiveLayer, setActiveLegend } = useMapLayerActions();
  const initialSidebarState = buildSidebarState(viewMode, initialSection);
  const isLogsView = viewMode === "logs";

  const [activeSection, setActiveSection] = useState<PlatformSection>(
    initialSidebarState.activeSection,
  );
  const [panelSection, setPanelSection] = useState<PlatformSection>(
    initialSidebarState.panelSection,
  );
  const [isPanelOpen, setIsPanelOpen] = useState(
    initialSidebarState.isPanelOpen,
  );
  const [showAnalysisFrame, setShowAnalysisFrame] = useState(
    initialSidebarState.showAnalysisFrame,
  );
  const [communicationReport, setCommunicationReport] =
    useState<CommunicationReportSelection | null>(null);
  const locale = useLocale();
  const analysisFrameUrl = `https://analise-multicriterial.oca-portal.com/${locale}`;

  const ContextComponent =
    panelSection === "monitoring"
      ? undefined
      : panelSection === "analysis-detail"
        ? AnalysisContext
        : panelSection === "analysis"
          ? ComingSoonContext
          : panelSection === "communication"
            ? CommunicationContext
            : undefined;

  function handleSectionChange(next: PlatformSection) {
    if (isLogsView) {
      if (next === "analysis" || next === "communication") {
        router.push(buildPlatformHref(next));
        return;
      }

      router.push(buildPlatformHref("monitoring"));
      return;
    }

    if (next === "analysis") {
      setShowAnalysisFrame(true);
      setCommunicationReport(null);
      setActiveSection(next);
      setIsPanelOpen(false);
      setActiveLegend(null);
      return;
    }
    setActiveSection(next);
    setPanelSection(next);
    setIsPanelOpen(true);
    setShowAnalysisFrame(false);
    setCommunicationReport(null);

    if (next !== "monitoring" && next !== "analysis-detail") {
      clearActiveLayer();
    }
  }

  function handlePanelSectionChange(next: PlatformSection) {
    setPanelSection(next);
    setCommunicationReport(null);

    if (next === "monitoring" && activeSection === "analysis-detail") {
      setActiveSection("monitoring");
    }

    setIsPanelOpen(true);
  }

  function handleGenerateCommunicationReport(
    selection: CommunicationReportSelection,
  ) {
    setCommunicationReport(selection);
    setShowAnalysisFrame(false);
    setActiveSection("communication");
    setPanelSection("communication");
    setIsPanelOpen(true);
    setActiveLegend(null);
    clearActiveLayer();
  }

  return (
    <>
      <aside
        className="absolute left-0 top-0 z-20 flex h-full"
        data-platform-sidebar-overlay
      >
        <PlatformSideRail
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
          isPanelOpen={isPanelOpen}
          onTogglePanel={() => setIsPanelOpen((v) => !v)}
          showAuditLink={showAuditLink}
        />

        {!isLogsView && (
          <div
            data-platform-side-panel
            className={`
        relative h-full overflow-hidden
          transition-[width] duration-300 ease-in-out
          ${isPanelOpen ? "w-[420px]" : "w-0"}
        `}
          >
            <div
              className={`
            absolute left-0 top-0 h-full w-full
            transform transition-transform duration-300 ease-in-out
            ${isPanelOpen ? "translate-x-0" : "-translate-x-full"}
          `}
            >
              <PlatformSidePanel
                activeSection={panelSection}
                panelLayers={panelLayers}
                ContextComponent={ContextComponent}
                onRequestSectionChange={handlePanelSectionChange}
                onGenerateReport={handleGenerateCommunicationReport}
              />
            </div>
          </div>
        )}
      </aside>

      {showAnalysisFrame && !isLogsView && (
        <div
          className="absolute top-0 bottom-0 right-0 z-10 bg-neutral-50 transition-all duration-300 ease-in-out"
          style={{ left: isPanelOpen ? "560px" : "140px" }}
        >
          <iframe
            src={analysisFrameUrl}
            title={t("MulticriterialAnalysis")}
            className="w-full h-full border-0"
            allowFullScreen
          />
        </div>
      )}

      {communicationReport && !isLogsView && (
        <div
          className="absolute top-0 bottom-0 right-0 z-10 bg-neutral-50 transition-all duration-300 ease-in-out"
          style={{ left: isPanelOpen ? "560px" : "140px" }}
        >
          <CommunicationReportViewer selection={communicationReport} />
        </div>
      )}
    </>
  );
}
