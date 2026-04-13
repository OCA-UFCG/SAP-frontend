"use client";

import React from "react";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
import { AccordionContext } from "@/components/SidePanelContexts/AccordionContext";
import { PanelLayerI, IEEInfo } from "@/utils/interfaces";

export type SidePanelContextComponent = React.ComponentType<{
  activeSection: PlatformSection;
  panelLayers?: PanelLayerI[];
  eeConfigs?: IEEInfo[];
  onRequestSectionChange?: (next: PlatformSection) => void;
}>;

export interface PlatformSidePanelProps {
  activeSection: PlatformSection;
  panelLayers?: PanelLayerI[];
  eeConfigs?: IEEInfo[];
  ContextComponent?: SidePanelContextComponent;
  onRequestSectionChange?: (next: PlatformSection) => void;
}

export function PlatformSidePanel({
  activeSection,
  panelLayers,
  eeConfigs,
  ContextComponent = AccordionContext,
  onRequestSectionChange,
}: PlatformSidePanelProps) {
  return (
    <section className="h-full w-[424px] bg-[#F6F7F6] border-r border-neutral-200">
      <ContextComponent
        activeSection={activeSection}
        panelLayers={panelLayers}
        eeConfigs={eeConfigs}
        onRequestSectionChange={onRequestSectionChange}
      />
    </section>
  );
}
