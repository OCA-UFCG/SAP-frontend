import { getContent } from "@/infrastructure/contentful/client";
import {
  attachMunicipalAnalysisToPanelLayer,
  attachMunicipalAnalysisToPanelLayers,
} from "@/repositories/platform/municipalAnalysisRepository";
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
        category
        timeScale
      }
    }
  }
`;

const GET_PANEL_LAYER_BY_ID = `
  query GetPanelLayerById($id: String!) {
    panelLayerCollection(limit: 1, where: { id: $id }) {
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
        category
        timeScale
      }
    }
  }
`;

interface PanelLayerResponse {
  panelLayerCollection: { items: Array<PanelLayerI | null> };
}

interface GetPanelLayersOptions {
  includeMunicipalAnalysis?: boolean;
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

export async function getPanelLayers(
  options: GetPanelLayersOptions = {},
): Promise<PanelLayerI[]> {
  try {
    const data = await getContent<PanelLayerResponse>(GET_PANEL_LAYER);

    const panelLayers =
      data.panelLayerCollection?.items
        ?.filter(isDefined)
        .sort(comparePanelLayers) ?? [];

    if (!options.includeMunicipalAnalysis) {
      return panelLayers;
    }

    return await attachMunicipalAnalysisToPanelLayers(panelLayers);
  } catch (error) {
    console.error("Erro ao buscar camadas da plataforma no Contentful:", error);
    return [];
  }
}

export async function getPanelLayerWithMunicipalAnalysis(
  panelLayerId: string,
): Promise<PanelLayerI | null> {
  const panelLayer = await getPanelLayerById(panelLayerId);

  if (!panelLayer) {
    return null;
  }

  return attachMunicipalAnalysisToPanelLayer(panelLayer);
}

async function getPanelLayerById(panelLayerId: string): Promise<PanelLayerI | null> {
  try {
    const data = await getContent<PanelLayerResponse>(GET_PANEL_LAYER_BY_ID, {
      id: panelLayerId,
    });

    return data.panelLayerCollection?.items?.find(isDefined) ?? null;
  } catch (error) {
    console.error("Erro ao buscar camada da plataforma no Contentful:", error);
    return null;
  }
}
