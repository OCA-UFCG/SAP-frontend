import "server-only";

import ee from "@google/earthengine";
import { isMunicipalSpreadsheetSource } from "@/contracts/municipalSpreadsheet";
import { isGeeMunicipalValueTableSource } from "@/contracts/geeMunicipalValueTable";
import {
  evaluateGeeObject,
  initializeGee,
} from "@/infrastructure/earth-engine/client";
import { selectMunicipalSpreadsheetValues } from "@/repositories/platform/municipalSpreadsheetRepository";
import { getDraftSpreadsheetSnapshot } from "@/services/indexCatalog/draftSpreadsheetSnapshot";
import { discoverMunicipalValueTable } from "@/services/indexCatalog/municipalValueTableBuild";
import type {
  DraftClassificationSample,
  IndexCatalogConfigV2,
} from "@/types/indexCatalog";
import type { ClassificationSampleOrigin } from "@/types/indexCatalog";
import { buildClassificationSample } from "@/utils/classificationSample";
import { expandAssetForPeriod } from "@/utils/indexCatalog";

/**
 * Quantos pixels a amostra de um raster pede ao Earth Engine.
 *
 * Três mil pixels descrevem a distribuição de um índice territorial com folga e
 * mantêm a leitura numa chamada curta. Ler o raster inteiro custaria uma redução
 * sobre a imagem toda — o tipo de chamada que o `/api/ee` existe para evitar.
 */
const RASTER_PIXEL_SAMPLE_SIZE = 3000;

/**
 * A menor resolução em metros usada para amostrar um raster.
 *
 * Um asset de 30 m sobre o Brasil obrigaria o Earth Engine a percorrer a
 * pirâmide inteira para sortear os pixels; 500 m é fino o bastante para a
 * distribuição de um índice territorial e devolve em segundos.
 */
const MIN_RASTER_SAMPLE_SCALE = 500;

/**
 * A distribuição de valores de um rascunho num período, para os métodos de
 * classificação calcularem os limites das faixas.
 *
 * Devolve `null` quando o rascunho não tem de onde ler valores — é o caso de um
 * índice classificatório cujo raster já guarda o número da classe em cada pixel,
 * em que não há limites a calcular.
 *
 * @example
 * await readDraftClassificationSample(config, "2024");
 * // { origin: "spreadsheet", count: 5570, min: 0, max: 98.2, ... }
 */
export async function readDraftClassificationSample(
  config: IndexCatalogConfigV2,
  period: string,
): Promise<DraftClassificationSample | null> {
  const values = await readDraftValues(config, period);
  if (!values) return null;

  const sample = buildClassificationSample(values.numbers);
  if (!sample) {
    throw new Error(
      `Nenhum valor numérico foi lido para o período ${period}. Confira se o período tem dados antes de gerar os limites.`,
    );
  }
  return { ...sample, origin: values.origin, period };
}

interface DraftValues {
  origin: ClassificationSampleOrigin;
  numbers: Array<number | null>;
}

async function readDraftValues(
  config: IndexCatalogConfigV2,
  period: string,
): Promise<DraftValues | null> {
  const source = config.validatedStatisticsSource ?? config.statisticsSource;
  if (isMunicipalSpreadsheetSource(source)) {
    return {
      origin: "spreadsheet",
      numbers: await readSpreadsheetValues(source, period),
    };
  }
  if (isGeeMunicipalValueTableSource(source)) {
    return {
      origin: "municipalValueTable",
      numbers: await readValueTableValues(source, period),
    };
  }
  if (!config.earthEngine.thresholds && !isContinuousRaster(config))
    return null;
  return { origin: "raster", numbers: await readRasterValues(config, period) };
}

/**
 * Só um raster contínuo tem limites a calcular: numa FeatureCollection a cor
 * vem da propriedade escolhida, e num raster já classificado cada pixel guarda
 * o número da classe.
 */
function isContinuousRaster(config: IndexCatalogConfigV2) {
  return (
    config.earthEngine.sourceType === "image" ||
    config.earthEngine.sourceType === "imageCollection"
  );
}

async function readSpreadsheetValues(
  source: Parameters<typeof getDraftSpreadsheetSnapshot>[0],
  period: string,
) {
  const snapshot = await getDraftSpreadsheetSnapshot(source);
  return Object.values(selectMunicipalSpreadsheetValues(snapshot, period));
}

/**
 * Os valores municipais de uma tabela do Earth Engine num período.
 *
 * A descoberta roda de novo em vez de reaproveitar a validação porque é ela que
 * sabe qual asset e qual coluna guardam aquele período — numa tabela por ano com
 * meses dentro, o período `2026-03` mora na coluna `março` do asset `..._2026`.
 */
async function readValueTableValues(
  source: Parameters<typeof discoverMunicipalValueTable>[0],
  period: string,
) {
  const discovery = await discoverMunicipalValueTable(source);
  for (const asset of discovery.assets) {
    const column = asset.columns.find((entry) => entry.periodKey === period);
    if (!column) continue;
    return evaluateGeeObject<Array<number | null>>(
      ee.FeatureCollection(asset.assetId).aggregate_array(column.column),
    );
  }
  throw new Error(
    `Nenhuma tabela do índice tem o período ${period}. Períodos disponíveis: ${discovery.periods.join(", ")}.`,
  );
}

/**
 * Uma amostra aleatória de pixels do raster do período.
 *
 * `sample` sorteia pixels dentro da própria área da imagem, então não é preciso
 * uma geometria do Brasil: o recorte territorial já é o do asset.
 */
async function readRasterValues(config: IndexCatalogConfigV2, period: string) {
  await initializeGee();
  const assetId = expandAssetForPeriod(config.earthEngine, period);
  if (!assetId) {
    throw new Error(
      `O período ${period} não tem asset de mapa informado, e é dele que os valores do raster são lidos.`,
    );
  }

  const image = selectRasterBand(config, assetId);
  const bandName = ee.Image(image).bandNames().get(0);
  const sampled = ee.Image(image).sample({
    region: ee.Image(image).geometry(),
    scale: ee
      .Number(ee.Image(image).projection().nominalScale())
      .max(MIN_RASTER_SAMPLE_SCALE),
    numPixels: RASTER_PIXEL_SAMPLE_SIZE,
    dropNulls: true,
    tileScale: 4,
  });
  return evaluateGeeObject<Array<number | null>>(
    sampled.aggregate_array(bandName),
  );
}

/**
 * A imagem do período, com a banda que o formulário escolheu.
 *
 * Numa ImageCollection a amostra usa o mosaico da coleção do período: a
 * distribuição que interessa é a do dado que o mapa desenha, e o mosaico é a
 * mesma composição que a visualização produz.
 */
function selectRasterBand(config: IndexCatalogConfigV2, assetId: string) {
  const image =
    config.earthEngine.sourceType === "imageCollection"
      ? ee.ImageCollection(assetId).mosaic()
      : ee.Image(assetId);
  const band = config.earthEngine.band?.trim();
  return band ? image.select([band]) : image.select(0);
}
