import { getContent } from "@/infrastructure/contentful/client";
import {
  attachMunicipalAnalysisToPanelLayer,
  attachMunicipalAnalysisToPanelLayers,
  attachMunicipalAnalysisYearToPanelLayer,
} from "@/repositories/platform/municipalAnalysisRepository";
import { validateImageDataContract } from "@/contracts/imageDataContract.mjs";
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
        reportSeriesConfig
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
        reportSeriesConfig
      }
    }
  }
`;

const GET_PANEL_LAYER_LEGACY = GET_PANEL_LAYER.replace(
  "\n        reportSeriesConfig",
  "",
);
const GET_PANEL_LAYER_BY_ID_LEGACY = GET_PANEL_LAYER_BY_ID.replace(
  "\n        reportSeriesConfig",
  "",
);

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

function logInvalidPanelLayerImageData(layer: PanelLayerI) {
  const validation = validateImageDataContract(layer.imageData, {
    context: "runtimeRead",
  });

  if (validation.ok) {
    return;
  }

  console.warn(
    `[panelLayerRepository] imageData inválido vindo do Contentful para panelLayer ${layer.id}: ${validation.errors.join("; ")}`,
  );
}

function normalizePanelLayers(items: Array<PanelLayerI | null> = []) {
  return items.filter(isDefined).map((layer) => {
    logInvalidPanelLayerImageData(layer);
    return layer;
  });
}

export async function getPanelLayers(
  options: GetPanelLayersOptions = {},
): Promise<PanelLayerI[]> {
  try {
    const data = await getContent<PanelLayerResponse>(GET_PANEL_LAYER);

    const panelLayers = normalizePanelLayers(
      data.panelLayerCollection?.items,
    ).sort(comparePanelLayers);

    if (!options.includeMunicipalAnalysis) {
      return panelLayers;
    }

    return await attachMunicipalAnalysisToPanelLayers(panelLayers);
  } catch (error) {
    try {
      const data = await getContent<PanelLayerResponse>(GET_PANEL_LAYER_LEGACY);
      const panelLayers = normalizePanelLayers(data.panelLayerCollection?.items).sort(comparePanelLayers);
      return options.includeMunicipalAnalysis
        ? await attachMunicipalAnalysisToPanelLayers(panelLayers)
        : panelLayers;
    } catch (legacyError) {
      console.error("Erro ao buscar camadas da plataforma no Contentful:", error, legacyError);
      return [];
    }
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

export async function getPanelLayerWithMunicipalAnalysisYear(
  panelLayerId: string,
  yearKey: string,
): Promise<PanelLayerI | null> {
  const panelLayer = await getPanelLayerById(panelLayerId);

  if (!panelLayer) {
    return null;
  }

  return attachMunicipalAnalysisYearToPanelLayer(panelLayer, yearKey);
}

async function getPanelLayerById(
  panelLayerId: string,
): Promise<PanelLayerI | null> {
  try {
    const data = await getContent<PanelLayerResponse>(GET_PANEL_LAYER_BY_ID, {
      id: panelLayerId,
    });

    const panelLayer = data.panelLayerCollection?.items?.find(isDefined) ?? null;

    if (panelLayer) {
      logInvalidPanelLayerImageData(panelLayer);
    }

    return panelLayer;
  } catch (error) {
    try {
      const data = await getContent<PanelLayerResponse>(GET_PANEL_LAYER_BY_ID_LEGACY, {
        id: panelLayerId,
      });
      return data.panelLayerCollection?.items?.find(isDefined) ?? null;
    } catch (legacyError) {
      console.error("Erro ao buscar camada da plataforma no Contentful:", error, legacyError);
      return null;
    }
  }
}
