import "server-only";

import { classifyValueByThresholds } from "@/app/api/ee/mapVisualization";
import { getAmfeSheetTable } from "@/repositories/platform/amfeSheetRepository";
import { getPanelLayerById } from "@/repositories/platform/panelLayerRepository";
import type { CompactMapVisualizationConfig } from "@/utils/analysis";
import { isCompactImageData } from "@/utils/imageData";

/**
 * A classificação municipal de uma camada de planilha: o nível da faixa de cor
 * de cada município, e os que não têm valor.
 */
export interface SheetChoroplethResult {
  column: string;
  classificationByCode: Record<string, number>;
  excludedCodes: string[];
  palette: string[];
}

const CACHE_TTL_MS = 1000 * 60 * 10;

interface CachedChoropleth {
  result: SheetChoroplethResult;
  loadedAt: number;
}

const choroplethByPanelLayer = new Map<string, CachedChoropleth>();
// Dedupe por camada: ao abrir o Monitoramento, uma camada ligada dispara um
// pedido por aba aberta, e todos caem na mesma leitura da planilha.
const pendingByPanelLayer = new Map<
  string,
  Promise<SheetChoroplethResult | null>
>();

/**
 * A coropleta descrita por um `mapVisualization`, ou `null` quando aquela
 * camada não é pintada a partir da planilha.
 *
 * Lê tudo do próprio `mapVisualization` — coluna, limites e paleta — para que a
 * prévia de um rascunho, que ainda não tem `panelLayer` publicado, use
 * exatamente o mesmo caminho do Monitoramento.
 *
 * @example
 * await buildSheetChoropleth(panelLayer.imageData.mapVisualization);
 */
export async function buildSheetChoropleth(
  mapVisualization: CompactMapVisualizationConfig | undefined,
): Promise<SheetChoroplethResult | null> {
  const choropleth = mapVisualization?.municipalChoropleth;
  if (!choropleth) return null;

  const thresholds = mapVisualization?.thresholds ?? [];
  const palette = mapVisualization?.palette ?? [];

  if (thresholds.length === 0 || palette.length !== thresholds.length + 1) {
    throw new Error(
      `A camada da coluna ${choropleth.column} tem ${palette.length} cor(es) e ${thresholds.length} limite(s); a paleta precisa ter uma cor a mais que os limites.`,
    );
  }

  const table = await getAmfeSheetTable();
  const classificationByCode: Record<string, number> = {};
  const excludedCodes: string[] = [];

  for (const municipality of table.municipalities) {
    const value = municipality.values[choropleth.column];

    if (typeof value !== "number") {
      excludedCodes.push(municipality.code);
      continue;
    }

    classificationByCode[municipality.code] = classifyValueByThresholds(
      value,
      thresholds,
      0,
    );
  }

  return {
    column: choropleth.column,
    classificationByCode,
    excludedCodes,
    palette,
  };
}

async function buildPublishedChoropleth(panelLayerId: string) {
  const panelLayer = await getPanelLayerById(panelLayerId);

  if (!panelLayer || !isCompactImageData(panelLayer.imageData)) return null;

  return buildSheetChoropleth(panelLayer.imageData.mapVisualization);
}

/**
 * A coropleta de uma camada publicada, relida no máximo a cada 10 minutos.
 *
 * Devolve `null` quando a camada não é pintada a partir de uma coluna da
 * planilha — é o que a rota traduz em 404, em vez de devolver um mapa vazio que
 * pareceria uma camada sem dado.
 *
 * @example
 * const choropleth = await getCachedSheetChoropleth("indice-de-aridez");
 */
export async function getCachedSheetChoropleth(
  panelLayerId: string,
): Promise<SheetChoroplethResult | null> {
  const cached = choroplethByPanelLayer.get(panelLayerId);
  if (cached && Date.now() - cached.loadedAt <= CACHE_TTL_MS) {
    return cached.result;
  }

  const pending = pendingByPanelLayer.get(panelLayerId);
  if (pending) return pending;

  const request = buildPublishedChoropleth(panelLayerId)
    .then((result) => {
      if (result) {
        choroplethByPanelLayer.set(panelLayerId, {
          result,
          loadedAt: Date.now(),
        });
      }
      return result;
    })
    .finally(() => {
      pendingByPanelLayer.delete(panelLayerId);
    });

  pendingByPanelLayer.set(panelLayerId, request);
  return request;
}

export function clearSheetChoroplethCache() {
  choroplethByPanelLayer.clear();
  pendingByPanelLayer.clear();
}
