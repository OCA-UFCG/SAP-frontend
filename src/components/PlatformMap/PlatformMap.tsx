"use client";

import { PlatformMapCaption } from "@/components/PlatformMapCaption/PlatformMapCaption";

/**
 * PlatformMap
 *
 * Placeholder for the real map implementation.
 *
 * In the final implementation this component will:
 * - Render the base map (Leaflet/Mapbox/etc.)
 * - Render thematic layers (e.g., drought/CDI polygons)
 * - Emit selection events (e.g., UF click)
 */
export function PlatformMap() {
  return (
    <div className="absolute inset-0">
      {/* Map canvas placeholder */}
      <div className="absolute inset-0 bg-[linear-gradient(120deg,#f3f4f6,#e5e7eb)]" />

      {/* Caption/legend overlay (bottom-right in the Figma) */}
      <PlatformMapCaption />
    </div>
  );
}
