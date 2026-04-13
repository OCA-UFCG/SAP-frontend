import { MapLayerProvider } from "@/components/MapLayerContext/MapLayerContext";
import { PlatformMap } from "@/components/PlatformMap/PlatformMap";
import { PlatformSidebar } from "@/components/PlatformSidebar/PlatformSidebar";
import { getContent } from "@/utils/contentful";
import { getContent as getRestContent } from "@/utils/functions";
import { PanelLayerI, IEEInfo } from "@/utils/interfaces";
import { GET_PANEL_LAYER } from "@/utils/queries";

interface PanelLayerResponse {
  panelLayerCollection: { items: PanelLayerI[] };
}

async function getPanelLayers(): Promise<PanelLayerI[]> {
  const data = await getContent<PanelLayerResponse>(GET_PANEL_LAYER);
  return data?.panelLayerCollection?.items;
}

async function getEEConfigs(): Promise<IEEInfo[]> {
  try {
    const { tiffInfo } = await getRestContent(["tiffInfo"]);
    return tiffInfo || [];
  } catch (e) {
    console.error("Failed to fetch tiffInfo", e);
    return [];
  }
}

export async function PlatformLayout() {
  const [panelLayers, eeConfigs] = await Promise.all([
    getPanelLayers(),
    getEEConfigs(),
  ]);

  return (
    <MapLayerProvider>
      <div className="relative w-full min-h-[calc(100vh-64px)] bg-neutral-50">
        <PlatformMap />
        <PlatformSidebar panelLayers={panelLayers} eeConfigs={eeConfigs} />
      </div>
    </MapLayerProvider>
  );
}