import { getContent } from "@/infrastructure/contentful/client";
import { PanelLayerI } from "@/utils/interfaces";

const GET_PANEL_LAYER = `
  query GetPanelLayer {
    panelLayerCollection {
      items {
        sys {
          id
        }
        name
        id
        description
        category
        previewMap {
          url
          title
          width
          height
        }
        imageData
        minScale
        maxScale
        years
      }
    }
  }
`;

interface PanelLayerResponse {
  panelLayerCollection: { items: PanelLayerI[] };
}

export async function getPanelLayers(): Promise<PanelLayerI[]> {
  try {
    const data = await getContent<PanelLayerResponse>(GET_PANEL_LAYER);

    return data.panelLayerCollection?.items ?? [];
  } catch (error) {
    console.error("Erro ao buscar camadas da plataforma no Contentful:", error);
    return [];
  }
}
