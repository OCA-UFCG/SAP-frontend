"use client";

import { useState } from "react";
import {
  PlatformSection,
  PlatformSideRail,
} from "@/components/PlatformSideRail/PlatformSideRail";
import { PlatformSidePanel } from "@/components/PlatformSidePanel/PlatformSidePanel";
import { AnalysisContext } from "@/components/SidePanelContexts/AnalysisContext";
import { ComingSoonContext } from "@/components/SidePanelContexts/ComingSoonContext";
import { PanelLayerI } from "@/utils/interfaces";
import { useMapLayerActions } from "@/components/MapLayerContext/MapLayerContext";

interface PlatformSidebarProps {
  panelLayers: PanelLayerI[];
}

export function PlatformSidebar({ panelLayers }: PlatformSidebarProps) {
  const { clearActiveLayer } = useMapLayerActions();

  const [activeSection, setActiveSection] =
    useState<PlatformSection>("monitoring");
  const [panelSection, setPanelSection] =
    useState<PlatformSection>("monitoring");
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const ContextComponent =
    panelSection === "monitoring"
      ? undefined
      : panelSection === "analysis-detail"
        ? AnalysisContext
        : panelSection === "analysis"
          ? ComingSoonContext
          : panelSection === "communication"
            ? ComingSoonContext
            : undefined;

  function handleSectionChange(next: PlatformSection) {
    setActiveSection(next);
    setPanelSection(next);
    setIsPanelOpen(true);

    if (next !== "monitoring" && next !== "analysis-detail") {
      clearActiveLayer();
    }
  }

  function handlePanelSectionChange(next: PlatformSection) {
    setPanelSection(next);

    if (next === "monitoring" && activeSection === "analysis-detail") {
      setActiveSection("monitoring");
    }

    setIsPanelOpen(true);
  }

  return (
    <aside
      className="absolute left-0 top-0 z-20 flex h-full"
      data-platform-sidebar-overlay
    >
      <PlatformSideRail
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        isPanelOpen={isPanelOpen}
        onTogglePanel={() => setIsPanelOpen((v) => !v)}
      />

      <div
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
          />
        </div>
      </div>
    </aside>
  );
}
