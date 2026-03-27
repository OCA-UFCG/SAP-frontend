"use client";

import { useState } from "react";
import {
  PlatformSection,
  PlatformSideRail,
} from "@/components/PlatformSideRail/PlatformSideRail";
import { PlatformSidePanel } from "@/components/PlatformSidePanel/PlatformSidePanel";
import { ComingSoonContext } from "@/components/SidePanelContexts/ComingSoonContext";
import { PanelLayerI } from "@/utils/interfaces";

interface PlatformSidebarProps {
  panelLayers: PanelLayerI[];
}

export function PlatformSidebar({ panelLayers }: PlatformSidebarProps) {
  const [activeSection, setActiveSection] = useState<PlatformSection>("modules");
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const ContextComponent =
    activeSection === "modules" ? undefined : ComingSoonContext;

  return (
    <aside className="absolute left-0 top-0 h-full flex z-20">
      <PlatformSideRail
        activeSection={activeSection}
        onSectionChange={setActiveSection}
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
            activeSection={activeSection}
            panelLayers={panelLayers}
          ContextComponent={ContextComponent}
          />
        </div>
      </div>
    </aside>
  );
}