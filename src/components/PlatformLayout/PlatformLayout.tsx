"use client";

import { PlatformMap } from "@/components/PlatformMap/PlatformMap";
import { PlatformSidebar } from "@/components/PlatformSidebar/PlatformSidebar";

/**
 * PlatformLayout
 *
 * Encapsulates the Platform screen composition.
 *
 * Desired high-level hierarchy:
 *
 * PlatformLayout
 * ├─ PlatformMap
 * │  └─ PlatformMapCaption (legend / map caption overlay)
 * └─ PlatformSidebar
 *    ├─ PlatformSideRail
 *    └─ PlatformSidePanel
 *       ├─ SidePanelHeader
 *       └─ SidePanelBody
 *
 * This is currently a *skeleton* whose primary purpose is to clarify component
 * boundaries and responsibilities. The UI shown here is intentionally minimal.
 */
export function PlatformLayout() {
  return (
    <div className="relative w-full h-[calc(100vh-64px)] bg-neutral-50">
      {/* background layer */}
      <PlatformMap />

      {/* Left overlay (rail + panel) */}
      <PlatformSidebar />
    </div>
  );
}
