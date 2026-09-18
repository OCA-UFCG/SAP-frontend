import type {
  CompactMapVisualizationConfig,
  CompactTerritorialAnalysisDataset,
  ResolvedImageCollectionPeriod,
  ResolvedImageCollectionSelection,
} from "@/utils/analysis";
import type {
  IImageParam,
  ImageDataConfig,
  LegacyImageDataEntry,
} from "@/utils/interfaces";
import { isCompactTerritorialImageData } from "@/contracts/imageDataContract.mjs";
import {
  buildCptecForecastMapVisualization,
  CPTEC_FORECAST_CLASSES,
  CPTEC_FORECAST_COLLECTION_ID,
  CPTEC_FORECAST_PANEL_LAYER_ID,
  getCptecForecastCollectionSelection,
} from "@/contracts/cptecForecast.mjs";
import { resolveSeasonEndMonthKey } from "@/utils/seasonalPeriod";

const FORECAST_TIME_ZONE = "America/Sao_Paulo";

/** Ano-mês corrente (`2026-09`) no fuso da plataforma, comparável como texto. */
function resolveCurrentMonthKey(currentDate: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FORECAST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(currentDate);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;

  return `${year}-${month}`;
}

export interface ResolvedImageYearEntry {
  default: boolean;
  year?: string;
  leadTime?: number;
  /** Ausente quando o mapa é uma coropleta municipal, sem asset a carregar. */
  imageId?: string;
  imageParams: IImageParam[];
  analysis?: LegacyImageDataEntry["analysis"];
  mapVisualization?: CompactMapVisualizationConfig;
}

export function resolveImageCollectionSelection(
  yearConfig: ResolvedImageYearEntry,
): ResolvedImageCollectionSelection | undefined {
  const configured = yearConfig.mapVisualization?.imageCollectionSelection;
  if (configured && Number.isInteger(yearConfig.leadTime)) {
    return {
      ...configured,
      filterValue: yearConfig.leadTime as number,
    };
  }

  return getCptecForecastCollectionSelection(
    yearConfig.imageId,
    yearConfig.leadTime,
  );
}

const YEAR_PERIOD_PATTERN = /^(\d{4})$/u;
const MONTH_PERIOD_PATTERN = /^(\d{4})-(\d{2})$/u;

/**
 * Janela UTC do período, ou `undefined` para chaves que não são um período
 * datável (`general`, rótulos livres).
 */
function resolvePeriodRange(period: string) {
  const yearMatch = YEAR_PERIOD_PATTERN.exec(period);

  if (yearMatch) {
    const year = Number(yearMatch[1]);
    return {
      startMillis: Date.UTC(year, 0, 1),
      endMillis: Date.UTC(year + 1, 0, 1),
    };
  }

  const monthMatch = MONTH_PERIOD_PATTERN.exec(period);
  if (!monthMatch) {
    return undefined;
  }

  const year = Number(monthMatch[1]);
  const month = Number(monthMatch[2]);
  if (month < 1 || month > 12) {
    return undefined;
  }

  return {
    startMillis: Date.UTC(year, month - 1, 1),
    endMillis: Date.UTC(year, month, 1),
  };
}

/**
 * Como escolher, dentro de uma `ImageCollection`, a imagem do período pedido
 * quando a camada não traz uma `imageCollectionSelection` explícita.
 *
 * Sem isso a coleção inteira era empilhada com `mosaic()` e o mapa mostrava
 * sempre a última imagem, qualquer que fosse o ano selecionado — o bug das
 * camadas Índice de Aridez (BR-DWGD e ERA5 Land) e Cobertura da Terra IBGE,
 * cujos 35, 45 e 6 períodos apontam todos para o mesmo endereço de coleção.
 *
 * @example
 * resolveImageCollectionPeriod({ year: "1990", ... });
 * // { startMillis: 631152000000, endMillis: 662688000000 }
 */
export function resolveImageCollectionPeriod(
  yearConfig: ResolvedImageYearEntry,
): ResolvedImageCollectionPeriod | undefined {
  // As camadas de previsão já sabem escolher a imagem pela rodada e pelo
  // lead time; filtrar por data em cima disso descartaria a escolha delas.
  if (resolveImageCollectionSelection(yearConfig)) {
    return undefined;
  }

  const period = yearConfig.year;
  const range = period ? resolvePeriodRange(period) : undefined;
  if (!period || !range) {
    return undefined;
  }

  const property = yearConfig.mapVisualization?.imageCollectionPeriodProperty;

  return { ...range, ...(property ? { property, value: period } : {}) };
}

function sortYearKeys(keys: string[]): string[] {
  return [...keys].sort((left, right) => {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    const bothNumeric =
      Number.isFinite(leftNumber) && Number.isFinite(rightNumber);

    if (bothNumeric) {
      return leftNumber - rightNumber;
    }

    if (left === "general") return -1;
    if (right === "general") return 1;

    return left.localeCompare(right);
  });
}

function buildCompactImageParams(
  imageData: CompactTerritorialAnalysisDataset,
): IImageParam[] {
  const legend = imageData.mapVisualization?.legend ?? imageData.classes;

  return legend.map((item) => ({
    color: item.color,
    label: item.label,
    ...(typeof item.pixelLimit === "number"
      ? { pixelLimit: item.pixelLimit }
      : {}),
  }));
}

/**
 * O `_01`.. `_04` no fim do nome do asset, usado como tempo de previsão quando
 * a entry não grava `leadTime` explicitamente. Exportado porque a edição do
 * asset do mapa no catálogo precisa recusar uma troca que mudaria esse número
 * sem que ninguém tivesse pedido (`src/utils/legacyMapAssets.ts`).
 */
export function getLegacyForecastLeadTime(imageId: string) {
  const match = imageId.match(/_(0[1-4])$/u);
  return match?.[1] ? Number(match[1]) : undefined;
}

function resolveForecastLeadTime(
  yearData: CompactTerritorialAnalysisDataset["years"][string],
  visibleIndex: number,
) {
  return (
    yearData.leadTime ??
    getLegacyForecastLeadTime(yearData.imageId ?? "") ??
    visibleIndex + 1
  );
}

export function isCompactImageData(
  imageData: ImageDataConfig | null | undefined,
): imageData is CompactTerritorialAnalysisDataset {
  return isCompactTerritorialImageData(imageData);
}

export function getImageDataYearKeys(
  imageData: ImageDataConfig | null | undefined,
): string[] {
  if (!imageData) {
    return [];
  }

  return sortYearKeys(
    isCompactImageData(imageData)
      ? Object.keys(imageData.years)
      : Object.keys(imageData),
  );
}

/**
 * Uma camada sazonal descreve a previsão de um trimestre: o seletor de período
 * do Monitoramento fica com uma opção só, o trimestre que ainda não terminou.
 * Quem diz que a camada é sazonal é a coluna `temporada` do asset, detectada na
 * publicação do catálogo — nenhum índice declara isso à mão.
 */
export function keepOnlyCurrentSeasonPeriod(
  imageData: ImageDataConfig,
  seasonal: boolean,
  currentDate = new Date(),
): ImageDataConfig {
  if (!seasonal || !isCompactImageData(imageData)) {
    return imageData;
  }

  const seasonEnds = Object.keys(imageData.years).map(
    (periodKey) => [periodKey, resolveSeasonEndMonthKey(periodKey)] as const,
  );

  if (seasonEnds.some(([, endKey]) => !endKey)) {
    return imageData;
  }

  const currentMonthKey = resolveCurrentMonthKey(currentDate);
  const ongoing = seasonEnds
    .filter(([, endKey]) => (endKey as string) >= currentMonthKey)
    .sort(([, left], [, right]) =>
      (left as string).localeCompare(right as string),
    );
  // Sem trimestre em curso resta o mais recente, para a camada não ficar sem
  // nenhum período enquanto o asset não recebe a previsão seguinte.
  const [selectedPeriod] =
    ongoing[0] ?? seasonEnds[seasonEnds.length - 1] ?? [];

  if (!selectedPeriod) {
    return imageData;
  }

  return {
    ...imageData,
    defaultYear: selectedPeriod,
    years: { [selectedPeriod]: imageData.years[selectedPeriod] },
  };
}

export function keepOnlyFutureForecastPeriods(
  panelLayerId: string,
  imageData: ImageDataConfig,
  currentDate = new Date(),
): ImageDataConfig {
  if (
    panelLayerId !== CPTEC_FORECAST_PANEL_LAYER_ID ||
    !isCompactImageData(imageData)
  ) {
    return imageData;
  }

  const currentMonthKey = resolveCurrentMonthKey(currentDate);
  const currentAndFutureEntries = sortYearKeys(Object.keys(imageData.years))
    .filter(
      (yearKey) =>
        /^\d{4}-(?:0[1-9]|1[0-2])$/u.test(yearKey) &&
        yearKey >= currentMonthKey,
    )
    .map((yearKey) => [yearKey, imageData.years[yearKey]] as const);
  const currentAndFutureYears = Object.fromEntries(
    currentAndFutureEntries.map(([yearKey, yearData], visibleIndex) => [
      yearKey,
      {
        ...yearData,
        imageId: CPTEC_FORECAST_COLLECTION_ID,
        leadTime: resolveForecastLeadTime(yearData, visibleIndex),
      },
    ]),
  );
  const currentAndFutureYearKeys = sortYearKeys(
    Object.keys(currentAndFutureYears),
  );
  const defaultYear = currentAndFutureYearKeys[0];

  return {
    ...imageData,
    classes: CPTEC_FORECAST_CLASSES.map((forecastClass) => ({
      ...forecastClass,
    })),
    mapVisualization:
      buildCptecForecastMapVisualization() as CompactMapVisualizationConfig,
    ...(defaultYear ? { defaultYear } : { defaultYear: undefined }),
    years: currentAndFutureYears,
  };
}

export function getImageDataDefaultYear(
  imageData: ImageDataConfig | null | undefined,
): string | null {
  const years = getImageDataYearKeys(imageData);

  if (years.length === 0 || !imageData) {
    return null;
  }

  if (isCompactImageData(imageData)) {
    if (imageData.defaultYear && imageData.years[imageData.defaultYear]) {
      return imageData.defaultYear;
    }

    return years[0] ?? null;
  }

  const defaultFromFlag = years.find((year) => imageData[year]?.default);

  return (
    defaultFromFlag ??
    (years.includes("general") ? "general" : (years[0] ?? null))
  );
}

export function resolveImageYearEntry(
  imageData: ImageDataConfig | null | undefined,
  year: string,
): ResolvedImageYearEntry | null {
  if (!imageData) {
    return null;
  }

  if (isCompactImageData(imageData)) {
    const yearData = imageData.years[year];

    if (!yearData) {
      return null;
    }

    const resolvedYear = yearData.year ?? year;

    return {
      default: year === getImageDataDefaultYear(imageData),
      year: resolvedYear,
      leadTime: yearData.leadTime,
      imageId: yearData.imageId,
      imageParams: buildCompactImageParams(imageData),
      mapVisualization: resolveMapVisualizationForYear(
        imageData.mapVisualization,
        resolvedYear,
      ),
    };
  }

  const yearData = imageData[year];

  if (!yearData) {
    return null;
  }

  return {
    default: Boolean(yearData.default),
    year: yearData.year,
    imageId: yearData.imageId,
    imageParams: yearData.imageParams,
    analysis: yearData.analysis,
  };
}

function replacePeriodTokens(value: string | undefined, period: string) {
  return value
    ?.replace(/\{period\}/gu, period)
    .replace(/\{year\}/gu, period.slice(0, 4))
    .replace(/\{month\}/gu, period.slice(5, 7));
}

function resolveMapVisualizationForYear(
  mapVisualization: CompactMapVisualizationConfig | undefined,
  year: string,
): CompactMapVisualizationConfig | undefined {
  if (!mapVisualization) {
    return undefined;
  }

  return {
    ...mapVisualization,
    property: replacePeriodTokens(mapVisualization.property, year),
    sourceBand: replacePeriodTokens(mapVisualization.sourceBand, year),
    outputBand: replacePeriodTokens(mapVisualization.outputBand, year),
    band: replacePeriodTokens(mapVisualization.band, year),
  };
}

export function getImageDataLegend(
  imageData: ImageDataConfig | null | undefined,
  year?: string | null,
): IImageParam[] | null {
  const effectiveYear = year ?? getImageDataDefaultYear(imageData);

  if (!effectiveYear) {
    return null;
  }

  return resolveImageYearEntry(imageData, effectiveYear)?.imageParams ?? null;
}
