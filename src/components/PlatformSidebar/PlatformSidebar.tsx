"use client";

import { useState } from "react";
import {
  PlatformSection,
  PlatformSideRail,
} from "@/components/PlatformSideRail/PlatformSideRail";
import { PlatformSidePanel } from "@/components/PlatformSidePanel/PlatformSidePanel";
import { AnalysisContext } from "@/components/SidePanelContexts/AnalysisContext";
import { ComingSoonContext } from "@/components/SidePanelContexts/ComingSoonContext";
import { PanelLayerI, IEEInfo } from "@/utils/interfaces";

interface PlatformSidebarProps {
  panelLayers: PanelLayerI[];
  eeConfigs: IEEInfo[];
}

export function PlatformSidebar({ panelLayers, eeConfigs }: PlatformSidebarProps) {
  const [activeSection, setActiveSection] =
    useState<PlatformSection>("modules");
  const [panelSection, setPanelSection] = useState<PlatformSection>("modules");
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const ContextComponent =
    panelSection === "analysis"
      ? AnalysisContext
      : panelSection === "modules"
        ? undefined
        : ComingSoonContext;

  function handleSectionChange(next: PlatformSection) {
    setActiveSection(next);
    setPanelSection(next);
    setIsPanelOpen(true);
  }

  function handlePanelSectionChange(next: PlatformSection) {
    setPanelSection(next);

    if (next === "modules" && activeSection === "analysis") {
      setActiveSection("modules");
    }

    setIsPanelOpen(true);
  }

  return (
    <aside className="absolute left-0 top-0 h-full flex z-20">
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
            eeConfigs={eeConfigs}
            ContextComponent={ContextComponent}
            onRequestSectionChange={handlePanelSectionChange}
          />
        </div>
      </div>
    </aside>
  );
}
