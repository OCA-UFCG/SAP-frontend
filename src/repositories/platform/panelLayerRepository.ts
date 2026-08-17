import { getContent } from "@/infrastructure/contentful/client";
import {
  attachMunicipalAnalysisToPanelLayer,
  attachMunicipalAnalysisToPanelLayers,
  attachMunicipalAnalysisYearToPanelLayer,
} from "@/repositories/platform/municipalAnalysisRepository";
import { validateImageDataContract } from "@/contracts/imageDataContract.mjs";
import { PanelLayerI } from "@/utils/interfaces";
import { keepOnlyFutureForecastPeriods } from "@/utils/imageData";
import { tryParsePublishedGeeStatisticsSource } from "@/contracts/geeStatistics";

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
        statisticsSource
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
        statisticsSource
      }
    }
  }
`;

function queryVariants(query: string) {
  return [
    query,
    query.replace("\n        reportSeriesConfig", ""),
    query.replace("\n        statisticsSource", ""),
    query
      .replace("\n        reportSeriesConfig", "")
      .replace("\n        statisticsSource", ""),
  ];
}

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

function normalizePanelLayer(layer: PanelLayerI) {
  logInvalidPanelLayerImageData(layer);

  const statisticsSource = tryParsePublishedGeeStatisticsSource(
    layer.statisticsSource,
  );
  if (layer.statisticsSource && !statisticsSource) {
    console.warn(
      `[panelLayerRepository] statisticsSource inválido para panelLayer ${layer.id}; a fonte dinâmica foi ignorada.`,
    );
  }

  return {
    ...layer,
    imageData: keepOnlyFutureForecastPeriods(layer.id, layer.imageData),
    ...(statisticsSource ? { statisticsSource } : { statisticsSource: null }),
  };
}

function normalizePanelLayers(items: Array<PanelLayerI | null> = []) {
  return items.filter(isDefined).map(normalizePanelLayer);
}

export async function getPanelLayers(
  options: GetPanelLayersOptions = {},
): Promise<PanelLayerI[]> {
  let firstError: unknown;
  for (const query of queryVariants(GET_PANEL_LAYER)) {
    try {
      const data = await getContent<PanelLayerResponse>(query);
      const panelLayers = normalizePanelLayers(
        data.panelLayerCollection?.items,
      ).sort(comparePanelLayers);
      return options.includeMunicipalAnalysis
        ? await attachMunicipalAnalysisToPanelLayers(panelLayers)
        : panelLayers;
    } catch (error) {
      firstError ??= error;
    }
  }
  console.error(
    "Erro ao buscar camadas da plataforma no Contentful:",
    firstError,
  );
  return [];
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
  locationKey?: string,
): Promise<PanelLayerI | null> {
  const panelLayer = await getPanelLayerById(panelLayerId);

  if (!panelLayer) {
    return null;
  }

  return attachMunicipalAnalysisYearToPanelLayer(
    panelLayer,
    yearKey,
    locationKey,
  );
}

async function getPanelLayerById(
  panelLayerId: string,
): Promise<PanelLayerI | null> {
  let firstError: unknown;
  for (const query of queryVariants(GET_PANEL_LAYER_BY_ID)) {
    try {
      const data = await getContent<PanelLayerResponse>(query, {
        id: panelLayerId,
      });
      const panelLayer =
        data.panelLayerCollection?.items?.find(isDefined) ?? null;
      return panelLayer ? normalizePanelLayer(panelLayer) : null;
    } catch (error) {
      firstError ??= error;
    }
  }
  console.error(
    "Erro ao buscar camada da plataforma no Contentful:",
    firstError,
  );
  return null;
}
