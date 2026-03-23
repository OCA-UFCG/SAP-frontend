"use client";

import React from "react";
import type { PlatformSection } from "@/components/PlatformSideRail/PlatformSideRail";
import { AccordionContext } from "@/components/SidePanelContexts/AccordionContext";

export type SidePanelContextComponent = React.ComponentType<{
  activeSection: PlatformSection;
}>;

export interface PlatformSidePanelProps {
  /**
   * Determines which "mode" the panel should show.
   * These are coarse sections driven by the rail (modules / analysis / forecast).
   */
  activeSection: PlatformSection;

  /**
  * Determines the full content rendered inside the panel.
  * Think of it as the panel's current "screen".
   */
  ContextComponent?: SidePanelContextComponent;
}

/**
 * PlatformSidePanel
 *
 * The larger scrollable panel sitting next to PlatformSideRail.
 *
 * For now this is a skeleton whose job is to make the component tree explicit.
 * The real implementation will evolve to include steps (chooseModule, chooseLocation, viewSummary, etc.).
 */
export function PlatformSidePanel({
  activeSection,
  ContextComponent = AccordionContext,
}: PlatformSidePanelProps) {
  return (
    <section className="h-full w-[424px] bg-[#F6F7F6] border-r border-neutral-200">
      <ContextComponent activeSection={activeSection} />
    </section>
  );
}
