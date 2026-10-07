"use client";

import React from "react";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
import { ModulesContext } from "@/components/SidePanelContexts/ModulesContext";
import type { PanelLayerI } from "@/utils/interfaces";

export type SidePanelContextComponent = React.ComponentType<{
  activeSection: PlatformSection;
  panelLayers?: PanelLayerI[];
  detailLayerId?: string;
  onRequestSectionChange?: (next: PlatformSection) => void;
}>;

export interface PlatformSidePanelProps {
  activeSection: PlatformSection;
  panelLayers?: PanelLayerI[];
  ContextComponent?: SidePanelContextComponent;
  detailLayerId?: string;
  onRequestSectionChange?: (next: PlatformSection) => void;
}

export function PlatformSidePanel({
  activeSection,
  panelLayers,
  ContextComponent = ModulesContext,
  detailLayerId,
  onRequestSectionChange,
}: PlatformSidePanelProps) {
  return (
    <section className="h-full w-full max-w-[424px] bg-[#F6F7F6] border-r border-neutral-200">
      <ContextComponent
        activeSection={activeSection}
        panelLayers={panelLayers}
        detailLayerId={detailLayerId}
        onRequestSectionChange={onRequestSectionChange}
      />
    </section>
  );
}
