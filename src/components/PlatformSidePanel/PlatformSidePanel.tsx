"use client";

import React from "react";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
import { AccordionContext } from "@/components/SidePanelContexts/AccordionContext";
import { PanelLayerI } from "@/utils/interfaces";

export type SidePanelContextComponent = React.ComponentType<{
  activeSection: PlatformSection;
  panelLayers?: PanelLayerI[];
}>;

export interface PlatformSidePanelProps {
  activeSection: PlatformSection;
  panelLayers?: PanelLayerI[];
  ContextComponent?: SidePanelContextComponent;
}

export function PlatformSidePanel({
  activeSection,
  panelLayers,
  ContextComponent = AccordionContext,
}: PlatformSidePanelProps) {
  return (
    <section className="h-full w-[424px] bg-[#F6F7F6] border-r border-neutral-200">
      <ContextComponent activeSection={activeSection} panelLayers={panelLayers} />
    </section>
  );
}
