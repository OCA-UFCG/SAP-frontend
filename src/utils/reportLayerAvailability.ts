import { isCompactImageData } from "@/utils/imageData";
import {
  getResolvableReportLayers,
  resolveNearestReportPeriod,
  type MunicipalAvailabilityIndex,
} from "@/utils/municipalAvailability";
import type { PanelLayerI } from "@/utils/interfaces";
import type { ReportTerritory } from "@/utils/reportTerritory";

type ReportAvailabilityLayer = Pick<
  PanelLayerI,
  "id" | "imageData" | "statisticsSource" | "reportConfig"
>;

/**
 * Se o índice entra no Relatório Automático, conforme a resposta dada no
 * catálogo. A ausência da declaração significa que sim: só a exclusão é
 * gravada, e é isso que mantém no relatório todo índice publicado antes de a
 * pergunta existir.
 */
export function isReportEnabledLayer(
  layer: Pick<PanelLayerI, "reportConfig">,
): boolean {
  return layer.reportConfig?.includeInReport !== false;
}

function getPublishedPeriods(layer: ReportAvailabilityLayer): string[] {
  return isCompactImageData(layer.imageData)
    ? Object.keys(layer.imageData.years)
    : [];
}

/**
 * Os ids das camadas que o formulário do Relatório Automático pode oferecer
 * para um município e um período.
 *
 * Uma camada publicada pelo catálogo não aparece em
 * `municipalAvailabilityIndex.json`: o arquivo é gerado apenas a partir das
 * partições `municipalAnalysis` do Contentful, e o catálogo, por desenho, não
 * cria nenhuma. Consultando só o índice, o índice novo ficava cinza e
 * permanentemente desmarcável.
 *
 * Para essas camadas a disponibilidade sai dos próprios períodos publicados em
 * `imageData.years`. A tabela estatística no Earth Engine é territorial e a
 * validação do catálogo já exige que cada linha some 100 ± 0,2, então publicar
 * um período é publicá-lo para o país inteiro; um município ausente da tabela
 * aparece como distribuição vazia, não como camada indisponível. As camadas
 * legadas continuam decidindo pelo índice, que é per-município.
 *
 * Fora do município, uma camada legada nunca é oferecida: os valores dela vivem
 * nas partições municipais do Contentful, que não têm linha para estado, bioma
 * ou Brasil. Ela sai da lista com a razão visível, em vez de virar uma seção
 * vazia no documento.
 *
 * @example
 * getSelectableReportLayerIds(panelLayers, index, territory, "2026");
 */
export function getSelectableReportLayerIds(
  layers: readonly ReportAvailabilityLayer[],
  index: MunicipalAvailabilityIndex,
  territory: ReportTerritory,
  requestedPeriod: string,
): Set<string> {
  const indexedIds = new Set(
    territory.municipalityCode
      ? getResolvableReportLayers(
          index,
          territory.municipalityCode,
          requestedPeriod,
        )
      : [],
  );
  const isMunicipality = territory.level === "municipality";

  return new Set(
    layers
      .filter(isReportEnabledLayer)
      .filter((layer) =>
        layer.statisticsSource
          ? resolveNearestReportPeriod(
              getPublishedPeriods(layer),
              requestedPeriod,
            ) !== null
          : isMunicipality && indexedIds.has(layer.id),
      )
      .map((layer) => layer.id),
  );
}
