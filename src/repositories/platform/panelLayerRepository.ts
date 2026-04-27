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
        panelPosition
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

function comparePanelLayers(left: PanelLayerI, right: PanelLayerI): number {
  const leftPosition = left.panelPosition;
  const rightPosition = right.panelPosition;
  const leftMissing = leftPosition == null;
  const rightMissing = rightPosition == null;

  if (leftMissing && rightMissing) {
    return 0;
  }

  if (leftMissing) {
    return -1;
  }

  if (rightMissing) {
    return 1;
  }

  return leftPosition - rightPosition;
}

export async function getPanelLayers(): Promise<PanelLayerI[]> {
  try {
    const data = await getContent<PanelLayerResponse>(GET_PANEL_LAYER);

    return (
      data.panelLayerCollection?.items
        ?.filter(isDefined)
        .sort(comparePanelLayers) ?? []
    );
  } catch (error) {
    console.error("Erro ao buscar camadas da plataforma no Contentful:", error);
    return [];
  }
}
