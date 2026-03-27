"use client";
import { PlatformMap } from "@/components/PlatformMap/PlatformMap";
import { PlatformSidebar } from "@/components/PlatformSidebar/PlatformSidebar";
import { MapLayerProvider } from "@/components/MapLayerContext/MapLayerContext";

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
    <MapLayerProvider>
      <div className="relative w-full min-h-[calc(100vh-64px)] bg-neutral-50">
        {/* Main canvas (map is the background layer) */}
        <PlatformMap />
        {/* Left overlay (rail + panel) */}
        <PlatformSidebar />
      </div>
    </MapLayerProvider>
  );
}