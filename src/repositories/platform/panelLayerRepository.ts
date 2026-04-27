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
        previewMap {
          url
          title
          width
          height
        }
        imageData
        minScale
        maxScale
      }
    }
  }
`;

interface PanelLayerResponse {
  panelLayerCollection: { items: Array<PanelLayerI | null> };
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

export async function getPanelLayers(): Promise<PanelLayerI[]> {
  try {
    const data = await getContent<PanelLayerResponse>(GET_PANEL_LAYER);

    return data.panelLayerCollection?.items?.filter(isDefined) ?? [];
  } catch (error) {
    console.error("Erro ao buscar camadas da plataforma no Contentful:", error);
    return [];
  }
}
