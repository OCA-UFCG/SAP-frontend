import { MapLayerProvider } from "@/components/MapLayerContext/MapLayerContext";
import { PlatformMap } from "@/components/PlatformMap/PlatformMap";
import { PlatformSidebar } from "@/components/PlatformSidebar/PlatformSidebar";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";

export async function PlatformLayout() {
  const panelLayers = await getPanelLayers();

  return (
    <MapLayerProvider>
      <div className="relative w-full min-h-[calc(100vh-64px)] bg-neutral-50">
        <PlatformMap />
        <PlatformSidebar panelLayers={panelLayers} />
      </div>
    </MapLayerProvider>
  );
}
