import { isCompactImageData } from "@/utils/imageData";
import {
  getResolvableReportLayers,
  resolveNearestReportPeriod,
  type MunicipalAvailabilityIndex,
} from "@/utils/municipalAvailability";
import type { PanelLayerI } from "@/utils/interfaces";

type ReportAvailabilityLayer = Pick<
  PanelLayerI,
  "id" | "imageData" | "statisticsSource"
>;

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
 * @example
 * getSelectableReportLayerIds(panelLayers, index, "2504009", "2026");
 */
export function getSelectableReportLayerIds(
  layers: readonly ReportAvailabilityLayer[],
  index: MunicipalAvailabilityIndex,
  municipalityCode: string,
  requestedPeriod: string,
): Set<string> {
  const indexedIds = new Set(
    getResolvableReportLayers(index, municipalityCode, requestedPeriod),
  );

  return new Set(
    layers
      .filter((layer) =>
        layer.statisticsSource
          ? resolveNearestReportPeriod(
              getPublishedPeriods(layer),
              requestedPeriod,
            ) !== null
          : indexedIds.has(layer.id),
      )
      .map((layer) => layer.id),
  );
}
