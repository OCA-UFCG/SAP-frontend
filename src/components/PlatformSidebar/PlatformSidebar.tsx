"use client";

import { useState } from "react";

import {
  PlatformSection,
  PlatformSideRail,
} from "@/components/PlatformSideRail/PlatformSideRail";
import { PlatformSidePanel } from "@/components/PlatformSidePanel/PlatformSidePanel";
import { ComingSoonContext } from "@/components/SidePanelContexts/ComingSoonContext";

/**
 * PlatformSidebar
 *
 * Container that encapsulates the left rail + side panel.
 *
 * Important: the rail does NOT "open the panel" directly.
 * Instead, it toggles a boolean state (isPanelOpen) that this container owns.
 * The panel UI is rendered conditionally based on this state.
 */
export function PlatformSidebar() {
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

      {isPanelOpen && (
        <PlatformSidePanel
          activeSection={activeSection}
          ContextComponent={ContextComponent}
        />
      )}
    </aside>
  );
}
