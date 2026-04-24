import { getContent } from "@/infrastructure/contentful/client";
import { PanelLayerI } from "@/utils/interfaces";
import { GET_PANEL_LAYER } from "@/utils/queries";

interface PanelLayerResponse {
  panelLayerCollection: { items: PanelLayerI[] };
}

export async function getPanelLayers(): Promise<PanelLayerI[]> {
  const data = await getContent<PanelLayerResponse>(GET_PANEL_LAYER);

  return data.panelLayerCollection?.items ?? [];
}
