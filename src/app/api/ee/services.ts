import ee from "@google/earthengine";
import { addUrlToCache, buildCacheKey } from "@/app/api/ee/cache";
import { getSpatialBoundaryFeatures } from "@/app/api/ee/spatialBoundaries";
import {
  isCategoricalMapVisualization,
  resolveMapVisualizationPlan,
  type ThresholdClassificationPlan,
} from "@/app/api/ee/mapVisualization";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import { IMapId, IEEInfo, IImageParam } from "@/utils/interfaces";
import {
  getImageDataDefaultYear,
  resolveImageCollectionPeriod,
  resolveImageCollectionSelection,
  resolveImageYearEntry,
} from "@/utils/imageData";
import type {
  CompactMapVisualizationConfig,
  ResolvedImageCollectionPeriod,
} from "@/utils/analysis";
import {
  DEFAULT_SPATIAL_SELECTION,
  type SpatialSelection,
} from "@/utils/spatialScope";
import {
  evaluateGeeObject,
  initializeGee,
} from "@/infrastructure/earth-engine/client";
import {
  normalizeGeeAssetType,
  resolveGeeAssetType,
} from "@/app/api/ee/assetType";

export { normalizeGeeAssetType };

let brazilBoundary: any | null = null;

export interface EarthEngineAssetInspection {
  id: string;
  type: "image" | "imageCollection" | "featureCollection";
  bands: string[];
  properties: string[];
  updateTime?: string;
  /**
   * Carimbo de revisão do asset. Ao contrário de `updateTime`, o `version` do
   * `ee.data.getAsset` vem preenchido em todos os assets que medimos, e é o
   * mesmo instante em microssegundos: `1787861735398000` para um `updateTime`
   * de `2026-08-27T20:15:35.398639Z`. Serve de chave de revisão nos assets em
   * que o `updateTime` simplesmente não vem na resposta.
   */
  version?: string;
}

export interface EarthEngineListedAsset {
  id: string;
  type: string;
  updateTime?: string;
}

interface ListAssetsPage {
  assets?: Array<Record<string, unknown>>;
  nextPageToken?: string;
}

// Teto alto o bastante para nenhum diretório real alcançar, e que ainda impede
// um `nextPageToken` que não avança de virar laço infinito.
const MAX_ASSET_PAGES = 100;

function requestAssetPage(parent: string, pageToken?: string) {
  return new Promise<ListAssetsPage>((resolve, reject) => {
    ee.data.listAssets(
      parent,
      pageToken ? { pageToken } : {},
      (result: ListAssetsPage | undefined, error?: unknown) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result ?? {});
      },
    );
  });
}

/**
 * Todos os assets de um diretório do Earth Engine, seguindo a paginação.
 *
 * Seguir o `nextPageToken` não é otimização: a API pagina de verdade (com
 * `pageSize: 10` ela devolve 10 assets e um token), e ler só a primeira página
 * fazia o catálogo publicar um índice com anos faltando **sem nenhum erro** —
 * a validação confirmava os anos que tinham sobrado como se fossem todos.
 */
export async function listEarthEngineAssets(
  parent: string,
): Promise<EarthEngineListedAsset[]> {
  await initializeGee();

  const listedAssets: Array<Record<string, unknown>> = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_ASSET_PAGES; page++) {
    const response = await requestAssetPage(parent, pageToken);
    listedAssets.push(...(response.assets ?? []));
    pageToken = response.nextPageToken;
    if (!pageToken) break;
  }

  return listedAssets.flatMap((asset) => {
    const id = String(asset.id ?? asset.name ?? "").trim();
    if (!id) return [];
    return [
      {
        id,
        type: String(asset.type ?? ""),
        ...(asset.updateTime || asset.update_time
          ? { updateTime: String(asset.updateTime ?? asset.update_time) }
          : {}),
      },
    ];
  });
}

export async function inspectEarthEngineAsset(
  assetId: string,
): Promise<EarthEngineAssetInspection> {
  await initializeGee();

  const asset = await new Promise<Record<string, unknown>>(
    (resolve, reject) => {
      ee.data.getAsset(
        assetId,
        (result: Record<string, unknown> | undefined, error?: unknown) => {
          if (error) {
            reject(error);
            return;
          }

          if (!result) {
            reject(new Error(`Earth Engine asset not found: ${assetId}`));
            return;
          }

          resolve(result);
        },
      );
    },
  );
  const rawType = normalizeGeeAssetType(asset.type);
  const metadata = {
    ...(asset.updateTime || asset.update_time
      ? { updateTime: String(asset.updateTime ?? asset.update_time) }
      : {}),
    ...(asset.version ? { version: String(asset.version) } : {}),
  };

  if (rawType === "TABLE") {
    const collection = ee.FeatureCollection(assetId);
    const properties = await evaluateGeeObject<string[]>(
      ee.Feature(collection.first()).propertyNames(),
    );
    return {
      id: assetId,
      type: "featureCollection",
      bands: [],
      properties: (properties ?? []).filter(
        (property) => !property.startsWith("system:"),
      ),
      ...metadata,
    };
  }

  if (rawType === "IMAGECOLLECTION") {
    const collection = ee.ImageCollection(assetId);
    const bands = await evaluateGeeObject<string[]>(
      ee.Image(collection.first()).bandNames(),
    );
    return {
      id: assetId,
      type: "imageCollection",
      bands: bands ?? [],
      properties: [],
      ...metadata,
    };
  }

  if (rawType !== "IMAGE") {
    throw new Error(
      `Unsupported Earth Engine asset type ${rawType || "unknown"} for ${assetId}.`,
    );
  }

  return {
    id: assetId,
    type: "image",
    bands: await evaluateGeeObject<string[]>(ee.Image(assetId).bandNames()),
    properties: [],
    ...metadata,
  };
}

const getBrazilBoundary = () => {
  if (!brazilBoundary) {
    brazilBoundary = ee
      .FeatureCollection("USDOS/LSIB_SIMPLE/2017")
      .filter(ee.Filter.eq("country_na", "Brazil"));
  }

  return brazilBoundary;
};

const getSpatialClipCollection = (selection: SpatialSelection) => {
  if (selection.spatialArea === "national") {
    return getBrazilBoundary();
  }

  const features = getSpatialBoundaryFeatures(selection).map((feature) =>
    ee.Feature(ee.Geometry(feature.geometry)),
  );
  return ee.FeatureCollection(features);
};

export const applySpatialClip = (
  image: any,
  selection: SpatialSelection = DEFAULT_SPATIAL_SELECTION,
) => image.clipToCollection(getSpatialClipCollection(selection));

function rangeIncludesZero(min?: number | null, max?: number | null) {
  return (
    typeof min === "number" && typeof max === "number" && min <= 0 && max >= 0
  );
}

export function shouldApplySelfMask({
  imageParams,
  minScale,
  maxScale,
  mapVisualization,
}: {
  imageParams?: IImageParam[] | null;
  minScale?: number | null;
  maxScale?: number | null;
  mapVisualization?: CompactMapVisualizationConfig | null;
}) {
  const hasZeroPixelLimit = Array.isArray(imageParams)
    ? imageParams.some((imageParam) => imageParam.pixelLimit === 0)
    : false;

  const layerScaleIncludesZero = rangeIncludesZero(minScale, maxScale);
  const mapVisualizationIncludesZero = rangeIncludesZero(
    mapVisualization?.min,
    mapVisualization?.max,
  );

  return !(
    hasZeroPixelLimit ||
    layerScaleIncludesZero ||
    mapVisualizationIncludesZero
  );
}

export interface ImageCollectionSelection {
  latestProperty: string;
  latestValue?: string | number;
  filterProperty: string;
  filterValue: string | number;
  sortProperty?: string;
  selectFirstBand?: boolean;
}

interface GetEarthEngineUrlOptions {
  mapVisualization?: CompactMapVisualizationConfig;
  spatialSelection?: SpatialSelection;
  imageCollectionSelection?: ImageCollectionSelection;
  imageCollectionPeriod?: ResolvedImageCollectionPeriod;
}

function isFeatureCollectionAsset({
  assetType,
  mapVisualization,
}: {
  assetType: string;
  mapVisualization?: CompactMapVisualizationConfig;
}) {
  return (
    mapVisualization?.sourceType === "featureCollection" ||
    assetType === "TABLE" ||
    assetType === "FEATURECOLLECTION"
  );
}

function isImageCollectionAsset({
  assetType,
  mapVisualization,
}: {
  assetType: string;
  mapVisualization?: CompactMapVisualizationConfig;
}) {
  return (
    mapVisualization?.sourceType === "imageCollection" ||
    assetType === "IMAGECOLLECTION"
  );
}

/**
 * A coleção reduzida às imagens do período pedido.
 *
 * A mesma etiqueta de ano aparece como número num asset (`ano_fim_janela: 1990`)
 * e como texto em outro (`ano: "2000"`), então o filtro por etiqueta aceita as
 * duas formas em vez de exigir que o catálogo saiba o tipo.
 */
function filterCollectionByPeriod(
  collection: any,
  period: ResolvedImageCollectionPeriod,
) {
  if (!period.property || !period.value) {
    return collection.filterDate(period.startMillis, period.endMillis);
  }

  const numericValue = Number(period.value);

  return collection.filter(
    Number.isFinite(numericValue)
      ? ee.Filter.or(
          ee.Filter.eq(period.property, numericValue),
          ee.Filter.eq(period.property, period.value),
        )
      : ee.Filter.eq(period.property, period.value),
  );
}

/**
 * Mosaico apenas das imagens do período pedido, caindo para a coleção inteira
 * quando nenhuma imagem casa com o período.
 *
 * O `ee.Algorithms.If` decide isso dentro da própria expressão do Earth Engine:
 * medir o tamanho da coleção aqui custaria uma ida extra de ~1 s em cada miss de
 * cache. O fallback preserva o comportamento antigo para coleções que são
 * pedaços de um mesmo período e evita mapa em branco quando a data do asset não
 * corresponde ao período publicado.
 */
function selectPeriodMosaic(
  collection: any,
  period: ResolvedImageCollectionPeriod,
) {
  const periodCollection = filterCollectionByPeriod(collection, period);

  return ee.Image(
    ee.Algorithms.If(
      periodCollection.size().gt(0),
      periodCollection.mosaic(),
      collection.mosaic(),
    ),
  );
}

export function selectImageCollectionImage(
  collection: any,
  selection?: ImageCollectionSelection,
  period?: ResolvedImageCollectionPeriod,
) {
  if (!selection) {
    const projection = collection.first().projection();
    const mosaic = period
      ? selectPeriodMosaic(collection, period)
      : collection.mosaic();
    return mosaic.setDefaultProjection(projection);
  }

  const latestValue =
    selection.latestValue ??
    collection.aggregate_array(selection.latestProperty).sort().get(-1);
  let selectedCollection = collection.filter(
    ee.Filter.eq(selection.latestProperty, latestValue),
  );

  if (selection.sortProperty) {
    selectedCollection = selectedCollection.sort(selection.sortProperty);
  }

  selectedCollection = selectedCollection.filter(
    ee.Filter.eq(selection.filterProperty, selection.filterValue),
  );
  const selectedImage = selectedCollection.first();
  return selection.selectFirstBand ? selectedImage.select(0) : selectedImage;
}

function applyThresholdClassification(
  image: any,
  classification: ThresholdClassificationPlan,
) {
  let classifiedImage = ee.Image(classification.startValue);

  classification.thresholds.forEach((threshold, index) => {
    classifiedImage = classifiedImage.where(
      image.gte(threshold),
      classification.startValue + index + 1,
    );
  });

  if (classification.outputBand) {
    classifiedImage = classifiedImage.rename(classification.outputBand);
  }

  return classifiedImage.updateMask(image.mask());
}

/**
 * Aplica o plano de visualização à imagem: seleciona a banda, classifica por
 * limites quando houver, e densifica classes esparsas. Exportada para o teste
 * poder afirmar que o remapeamento chega à imagem, e não só ao plano.
 */
export function applyMapVisualization(
  image: any,
  mapVisualization: CompactMapVisualizationConfig,
  imageParams: IImageParam[],
  minScale: number,
  maxScale: number,
) {
  const plan = resolveMapVisualizationPlan(
    mapVisualization,
    imageParams,
    minScale,
    maxScale,
  );
  let selectedImage = plan.sourceBand ? image.select(plan.sourceBand) : image;

  if (plan.thresholdClassification) {
    selectedImage = applyThresholdClassification(
      selectedImage,
      plan.thresholdClassification,
    );
  }

  // Classes esparsas (1 a 6 e 9 a 14 na cobertura do solo do IBGE) viram
  // posições densas antes de visualizar, senão o Earth Engine espalha as 12
  // cores por 14 valores e cada classe recebe a cor da vizinha.
  if (plan.categoricalRemap) {
    // `round().int()` antes do remap por causa do zoom. Longe, o Earth Engine
    // serve a pirâmide do asset, e num raster `float` ela é feita de MÉDIAS: o
    // pixel que mistura as classes 2 e 6 chega como 4,3. Como `remap` mascara
    // todo valor fora da lista, sem arredondar a camada some quando o mapa está
    // afastado — medido no semiárido, 90% dos pixels sumiam na escala de ~40 km
    // e 100% voltam com o arredondamento. A correção de raiz é reexportar o
    // asset como inteiro com pyramidingPolicy MODE; isto é a rede de proteção
    // para quando ela não existir.
    selectedImage = selectedImage
      .round()
      .int()
      .remap(plan.categoricalRemap.from, plan.categoricalRemap.to);
  }

  return { image: selectedImage, visParams: plan.visParams };
}

/**
 * Acima desta escala nativa a pirâmide do asset não chega a ser usada nos zooms
 * que a plataforma abre, então forçar a escala nativa seria custo sem ganho.
 *
 * O corte é generoso de propósito: os assets categóricos do catálogo se dividem
 * entre ~500 m, que sofrem o problema, e ~11 km, que não sofrem em zoom nenhum
 * (conferido até z2, com o Brasil inteiro na tela). Qualquer valor nessa folga
 * de 20x separa os dois grupos.
 */
const FINE_ASSET_SCALE_LIMIT_METERS = 1000;

/**
 * A projeção nativa da banda que vai ser desenhada, para servir de referência a
 * `renderAtNativeScale`.
 */
function resolveNativeProjection(
  image: any,
  mapVisualization: CompactMapVisualizationConfig,
) {
  const band = mapVisualization.sourceBand ?? mapVisualization.band;
  return (band ? image.select(band) : image.select(0)).projection();
}

/**
 * Prende a imagem à escala nativa do asset, tirando a pirâmide do caminho — ver
 * `isCategoricalMapVisualization` para o porquê.
 *
 * O teste de escala roda dentro da própria expressão do Earth Engine, e não com
 * um `evaluate()` antes: ler `nominalScale()` no cliente custaria um round trip
 * de ~1 s em cada miss de cache, que é o custo dominante ao abrir uma camada.
 * É o mesmo padrão de `selectPeriodMosaic`.
 *
 * Medido em z5 no semiárido: sem isto, 67,7% dos pixels do Índice de Degradação
 * da Terra saíam numa cor que não existe na legenda; com isto, 0%.
 */
function renderAtNativeScale(image: any, nativeProjection: any) {
  const scale = nativeProjection.nominalScale();

  return ee.Image(
    ee.Algorithms.If(
      scale.lte(FINE_ASSET_SCALE_LIMIT_METERS),
      image.reproject({ crs: nativeProjection, scale }),
      image,
    ),
  );
}

/**
 * A última banda da imagem, escolhida por uma expressão do Earth Engine em vez
 * de um `bandNames().evaluate()` no cliente. As duas formas dão a mesma banda;
 * esta não gasta um round trip, que é o custo dominante ao abrir uma camada.
 *
 * @example
 * selectLastBand(ee.Image("...cdi_v1_2026_01")); // banda "CDI"
 */
export function selectLastBand(image: any) {
  const bandNames = image.bandNames();
  return image.select([bandNames.get(bandNames.size().subtract(1))]);
}

function buildFeatureCollectionImage(
  imageId: string,
  mapVisualization: CompactMapVisualizationConfig,
) {
  const collection = ee.FeatureCollection(imageId);
  const property =
    mapVisualization.property ??
    mapVisualization.sourceBand ??
    mapVisualization.band;

  if (!property) {
    throw new Error(
      `FeatureCollection layer ${imageId} requires mapVisualization.property.`,
    );
  }

  let image = collection.reduceToImage({
    properties: [property],
    reducer: ee.Reducer.first(),
  });

  if (mapVisualization.band) {
    image = image.rename(mapVisualization.band);
  }

  return { collection, image };
}

function renderFeatureCollectionMapImage({
  collection,
  image,
  visParams,
  mapVisualization,
}: {
  collection: any;
  image: any;
  visParams: { min: number; max: number; palette: string[] };
  mapVisualization: CompactMapVisualizationConfig;
}) {
  const outline = mapVisualization.outline ?? {};
  const outlineColor = (outline.color ?? "#000000").replace(/^#/, "");
  const outlineWidth = typeof outline.width === "number" ? outline.width : 0.5;
  const outlineOpacity =
    typeof outline.opacity === "number" ? outline.opacity : 1;
  const fillImage = image.visualize(visParams);
  const outlineImage = ee
    .Image()
    .byte()
    .paint(collection, 1, outlineWidth)
    .visualize({
      palette: [outlineColor],
      opacity: outlineOpacity,
    });

  return fillImage.blend(outlineImage);
}

// ====== GEE ======

/**
 * Fetches a URL for an Earth Engine image with given parameters.
 * @param {any} imageId - ID of the Earth Engine image.
 * @param {any} imageParams - Visualization parameters for the image.
 * @param {any} minScale - Minimum scale for the visualization.
 * @param {any} maxScale - Maximum scale for the visualization.
 * @returns {Promise<string>} - The formatted URL for the image.
 */
export const getEarthEngineUrl = async (
  imageId: any,
  imageParams: any,
  minScale: any,
  maxScale: any,
  options?: GetEarthEngineUrlOptions,
) => {
  try {
    const {
      mapVisualization,
      spatialSelection = DEFAULT_SPATIAL_SELECTION,
      imageCollectionSelection,
      imageCollectionPeriod,
    } = options ?? {};

    await initializeGee();

    // 1. Descobrir se o asset é Image, ImageCollection ou FeatureCollection.
    // `resolveGeeAssetType` só vai à rede quando o `mapVisualization` não
    // declara `sourceType` e nenhum outro período do mesmo asset já perguntou.
    const assetType = await resolveGeeAssetType(imageId, mapVisualization);

    // 2. Instantiate correctly based on type
    let GEEImage: any;
    const shouldUseFeatureCollection = isFeatureCollectionAsset({
      assetType,
      mapVisualization,
    });
    const shouldUseImageCollection = isImageCollectionAsset({
      assetType,
      mapVisualization,
    });
    let featureCollection: any | null = null;

    if (shouldUseFeatureCollection) {
      if (!mapVisualization) {
        throw new Error(
          `FeatureCollection layer ${imageId} requires mapVisualization.`,
        );
      }

      const featureCollectionImage = buildFeatureCollectionImage(
        imageId,
        mapVisualization,
      );
      featureCollection = featureCollectionImage.collection;
      GEEImage = featureCollectionImage.image;
    } else if (shouldUseImageCollection) {
      const collection = ee.ImageCollection(imageId);
      GEEImage = selectImageCollectionImage(
        collection,
        imageCollectionSelection,
        imageCollectionPeriod,
      );
    } else {
      // Default behavior
      GEEImage = ee.Image(imageId);
    }

    let configuredVisParams: any;
    // Lida antes de `applyMapVisualization` porque o remap e a classificação
    // trocam as bandas da imagem, e a referência tem de ser a do asset.
    const nativeProjection =
      mapVisualization &&
      !shouldUseFeatureCollection &&
      isCategoricalMapVisualization(mapVisualization)
        ? resolveNativeProjection(GEEImage, mapVisualization)
        : null;

    if (mapVisualization) {
      const configuredImage = applyMapVisualization(
        GEEImage,
        mapVisualization,
        imageParams,
        minScale,
        maxScale,
      );

      GEEImage = configuredImage.image;
      configuredVisParams = configuredImage.visParams;
    } else {
      // 3. Camada legada, sem `mapVisualization`: a banda visualizada é a
      // última do asset. A escolha é feita dentro da própria expressão, e não
      // com um `evaluate()` antes do `getMapId`, porque cada ida ao Earth
      // Engine custa cerca de um segundo e essa custava uma por período aberto.
      GEEImage = selectLastBand(GEEImage);
    }

    if (
      !shouldUseFeatureCollection &&
      shouldApplySelfMask({
        imageParams,
        minScale,
        maxScale,
        mapVisualization,
      })
    ) {
      GEEImage = GEEImage.selfMask();
    }

    if (nativeProjection) {
      GEEImage = renderAtNativeScale(GEEImage, nativeProjection);
    }

    const { categorizedImage, visParams } = configuredVisParams
      ? { categorizedImage: GEEImage, visParams: configuredVisParams }
      : getImageScale(GEEImage, imageParams, minScale, maxScale);
    const mapImage =
      shouldUseFeatureCollection && featureCollection && mapVisualization
        ? renderFeatureCollectionMapImage({
            collection: featureCollection,
            image: categorizedImage,
            visParams,
            mapVisualization,
          })
        : categorizedImage;
    const clippedMapImage = applySpatialClip(mapImage, spatialSelection);
    const mapId = (await getMapId(
      clippedMapImage,
      shouldUseFeatureCollection ? undefined : visParams,
    )) as IMapId;

    return mapId.urlFormat;
  } catch (error: any) {
    console.error("Error in getEarthEngineUrl:", error.message);
    throw error;
  }
};

/**
 * Adjusts the scale of an image based on visualization parameters.
 * This function applies category limits based on pixel values
 * and assigns colors to different categories if there are pixel limits.
 *
 * @param {object} image - The Earth Engine image.
 * @param {Array} imageParams - Array of parameters containing pixel limits and colors.
 * @param {number} minScale - Minimum scale for visualization.
 * @param {number} maxScale - Maximum scale for visualization.
 * @returns {object} - The categorized image and visualization parameters.
 */
const getImageScale = (
  image: any,
  imageParams: Array<any>,
  minScale: number,
  maxScale: number,
) => {
  const hasPixelLimits = imageParams.some(
    (imageParam: any) => typeof imageParam.pixelLimit === "number",
  );

  let categorizedImage = image;

  if (hasPixelLimits) {
    // Build helper structure with numeric pixelLimit and color.
    const paramsWithPixel = imageParams.map((p: any, i: number) => ({
      color: p.color,
      pixelLimit:
        typeof p.pixelLimit === "number" ? Number(p.pixelLimit) : i + 1,
    }));

    // Determine numeric range of provided pixel limits.
    const pixelValues = paramsWithPixel.map((p) => p.pixelLimit);
    const pixelMin = Math.min(...pixelValues);
    const pixelMax = Math.max(...pixelValues);
    const isContiguousRange =
      pixelMax - pixelMin + 1 === paramsWithPixel.length;

    // Order parameters by their numeric pixel value for recategorization cases.
    const orderedByPixel = [...paramsWithPixel].sort(
      (a, b) => a.pixelLimit - b.pixelLimit,
    );
    const orderedPalette = orderedByPixel.map((p) => p.color);

    // If the consumer provided an explicit numeric visualization range that
    // exactly matches the number of classes, prefer the simple mapping where
    // the palette is used in the same order as the `imageParams` array — this
    // preserves legacy behavior for layers that list classes in semantic
    // order while the raster codes are an offset range (e.g. 2..5).
    if (
      typeof minScale === "number" &&
      typeof maxScale === "number" &&
      maxScale - minScale + 1 === imageParams.length
    ) {
      // If pixel limits actually correspond to the numeric raster codes
      // (e.g. pixelLimit range equals minScale..maxScale), map colors by value.
      if (isContiguousRange && pixelMin === minScale && pixelMax === maxScale) {
        const length = maxScale - minScale + 1;
        const paletteByValue = new Array(length).fill(null);

        for (const p of paramsWithPixel) {
          const idx = p.pixelLimit - minScale;
          if (idx >= 0 && idx < length) {
            paletteByValue[idx] = p.color;
          }
        }

        // Fill any missing entries using the ordered palette as fallback.
        for (let i = 0; i < length; i++) {
          if (!paletteByValue[i])
            paletteByValue[i] = orderedPalette[i] ?? "#000000";
        }

        const visParams = {
          min: minScale,
          max: maxScale,
          palette: paletteByValue,
        };
        return { categorizedImage: image, visParams };
      }

      // Otherwise, fall back to legacy behavior: assume `imageParams` is already
      // in the visual order that should be mapped to minScale..maxScale.
      const palette = imageParams.map((p: any) => p.color);
      const visParams = { min: minScale, max: maxScale, palette };
      return { categorizedImage: image, visParams };
    }

    // No explicit numeric visualization range provided — re-categorize
    // continuous values into categories ordered by pixelLimit.
    for (let index = 0; index < orderedByPixel.length; index++) {
      const lowerLimit =
        index > 0
          ? orderedByPixel[index - 1].pixelLimit
          : Number.MIN_SAFE_INTEGER;

      const upperLimit =
        index < orderedByPixel.length - 1
          ? orderedByPixel[index].pixelLimit
          : Number.MAX_SAFE_INTEGER;

      categorizedImage = categorizedImage.where(
        image.gt(lowerLimit).and(image.lte(upperLimit)),
        index + 1,
      );
    }

    const visParams = {
      min: 1,
      max: imageParams.length,
      palette: orderedPalette,
    };
    return { categorizedImage, visParams };
  }

  const palette = imageParams.map((imageParam: any) => imageParam.color);
  const visParams = { min: minScale ?? 0, max: maxScale ?? 1, palette };
  return { categorizedImage, visParams };
};

/**
 * Retrieves the map ID for the given image with visualization parameters.
 * @param {any} image - The Earth Engine image.
 * @param {any} visParams - Visualization parameters for the image.
 * @returns {Promise<Object>} - The map ID object.
 */
function getMapId(image: any, visParams?: any) {
  return new Promise((resolve, reject) => {
    image.getMapId(visParams, (obj: any, error: any) =>
      error ? reject(new Error(error)) : resolve(obj),
    );
  });
}

/**
 * Períodos que o warmup deve aquecer. Aquecer todos custava 496 idas SEQUENCIAIS
 * ao Earth Engine (301 só do CDI_Test), disparadas pelo primeiro request após
 * cada restart e repetidas a cada 12 h, competindo com os usuários pela mesma
 * cota. O painel abre no período default, então é ele que vale pré-aquecer; os
 * demais viram miss sob demanda, já protegidos pelo dedupe de getOrCreateCachedUrl.
 *
 * getWarmupYearKeys(layer.imageData); // ["2020"]
 */
export function getWarmupYearKeys(
  imageData: IEEInfo["imageData"] | undefined,
): string[] {
  const defaultYear = getImageDataDefaultYear(imageData);

  return defaultYear ? [defaultYear] : [];
}

let warmupStarted = false;
/**
 * Fetches and caches map data from Contentful/GEE API sources.
 * Runs recursively every 12 hours to keep the cache updated.
 */
export const cacheMapData = async () => {
  try {
    const panelLayers = await getPanelLayers();

    for (const layer of panelLayers) {
      const id = layer.id;
      const imageData = layer.imageData as IEEInfo["imageData"] | undefined;

      if (!id || !imageData || typeof imageData !== "object") {
        continue;
      }

      const minScale = layer.minScale;
      const maxScale = layer.maxScale;

      for (const year of getWarmupYearKeys(imageData)) {
        const yearConfig = resolveImageYearEntry(imageData, year);
        if (!yearConfig) continue;
        const imageCollectionSelection =
          resolveImageCollectionSelection(yearConfig);
        const imageCollectionPeriod = resolveImageCollectionPeriod(yearConfig);

        const cacheKey = buildCacheKey(
          id,
          year,
          yearConfig.imageId,
          yearConfig.imageParams,
          minScale,
          maxScale,
          yearConfig.mapVisualization,
          DEFAULT_SPATIAL_SELECTION,
          imageCollectionSelection,
        );
        const url = await getEarthEngineUrl(
          yearConfig.imageId,
          yearConfig.imageParams,
          minScale,
          maxScale,
          {
            mapVisualization: yearConfig.mapVisualization,
            ...(imageCollectionSelection ? { imageCollectionSelection } : {}),
            ...(imageCollectionPeriod ? { imageCollectionPeriod } : {}),
          },
        );
        addUrlToCache(cacheKey, url);
      }
    }
  } catch (error) {
    // Don’t crash the server on startup if Contentful/GEE is misconfigured.
    console.error("Error caching EE map data:", error);
  }
};

export function ensureEeCacheWarmupStarted() {
  if (warmupStarted) {
    return;
  }

  warmupStarted = true;

  void cacheMapData();
  setInterval(cacheMapData, 1000 * 60 * 60 * 12);
}
