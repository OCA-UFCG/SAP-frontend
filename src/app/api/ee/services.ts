import ee from "@google/earthengine";
import { createSign } from "node:crypto";
import { addUrlToCache, buildCacheKey } from "@/app/api/ee/cache";
import {
  resolveMapVisualizationPlan,
  type ThresholdClassificationPlan,
} from "@/app/api/ee/mapVisualization";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import { IMapId, IEEInfo, IImageParam } from "@/utils/interfaces";
import { getImageDataYearKeys, resolveImageYearEntry } from "@/utils/imageData";
import type { CompactMapVisualizationConfig } from "@/utils/analysis";

// ====== GEE Singleton for Authentication and Initialization ======

let geeInitialized: Promise<void> | null = null;
let brazilBoundary: any | null = null;

const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GEE_AUTH_SCOPES = [
  "https://www.googleapis.com/auth/earthengine",
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/devstorage.read_write",
];

interface GeeServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

interface GoogleOAuthToken {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

function encodeJwtPart(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function parseGeeCredentials(rawCredentials: string) {
  const parsed = JSON.parse(
    rawCredentials,
  ) as Partial<GeeServiceAccountCredentials>;

  if (
    typeof parsed.client_email !== "string" ||
    !parsed.client_email.trim() ||
    typeof parsed.private_key !== "string" ||
    !parsed.private_key.includes("BEGIN PRIVATE KEY")
  ) {
    throw new Error(
      "GEE_PRIVATE_KEY must contain valid client_email and private_key fields.",
    );
  }

  return parsed as GeeServiceAccountCredentials;
}

async function fetchGoogleOAuthToken(
  credentials: GeeServiceAccountCredentials,
): Promise<GoogleOAuthToken> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const encodedHeader = encodeJwtPart({ alg: "RS256", typ: "JWT" });
  const encodedPayload = encodeJwtPart({
    iss: credentials.client_email,
    scope: GEE_AUTH_SCOPES.join(" "),
    aud: GOOGLE_OAUTH_TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  });
  const unsignedJwt = `${encodedHeader}.${encodedPayload}`;
  const signature = createSign("RSA-SHA256")
    .update(unsignedJwt)
    .end()
    .sign(credentials.private_key, "base64url");
  const assertion = `${unsignedJwt}.${signature}`;

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await response.json()) as {
    access_token?: unknown;
    error?: unknown;
    error_description?: unknown;
    expires_in?: unknown;
    token_type?: unknown;
  };

  if (!response.ok || typeof body.access_token !== "string") {
    const oauthError =
      typeof body.error === "string" ? body.error : `HTTP ${response.status}`;
    const description =
      typeof body.error_description === "string"
        ? `: ${body.error_description}`
        : "";
    throw new Error(
      `Google OAuth token exchange failed (${oauthError}${description}).`,
    );
  }

  return {
    accessToken: body.access_token,
    expiresIn: typeof body.expires_in === "number" ? body.expires_in : 3600,
    tokenType: typeof body.token_type === "string" ? body.token_type : "Bearer",
  };
}

function configureGeeTokenRefresh(credentials: GeeServiceAccountCredentials) {
  ee.data.setAuthTokenRefresher(
    (
      _authArgs: unknown,
      callback: (result: Record<string, unknown>) => void,
    ) => {
      void fetchGoogleOAuthToken(credentials)
        .then((token) => {
          callback({
            access_token: token.accessToken,
            token_type: token.tokenType,
            expires_in: token.expiresIn,
          });
        })
        .catch((error: unknown) => {
          callback({ error });
        });
    },
  );
}

/**
 * Ensures that Google Earth Engine is authenticated and initialized, but only runs the process once.
 * This is a singleton pattern to prevent re-authentication on every API call.
 */
export const initializeGee = async () => {
  if (geeInitialized) {
    return geeInitialized;
  }

  geeInitialized = authenticateAndInitialize().catch((error) => {
    // Do not keep a rejected promise in the singleton. A transient
    // authentication or initialization failure must be retryable.
    geeInitialized = null;
    throw error;
  });

  return geeInitialized;
};

const getBrazilBoundary = () => {
  if (!brazilBoundary) {
    brazilBoundary = ee
      .FeatureCollection("USDOS/LSIB_SIMPLE/2017")
      .filter(ee.Filter.eq("country_na", "Brazil"));
  }

  return brazilBoundary;
};

const clipImageToBrazil = (image: any) =>
  image.clipToCollection(getBrazilBoundary());

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

interface GetEarthEngineUrlOptions {
  mapVisualization?: CompactMapVisualizationConfig;
}

function normalizeGeeAssetType(type?: unknown) {
  return type
    ? String(type)
        .toUpperCase()
        .replace(/[_\s-]/g, "")
    : "";
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

function applyMapVisualization(
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

  return { image: selectedImage, visParams: plan.visParams };
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
    const { mapVisualization } = options ?? {};

    await initializeGee();

    // 1. Fetch asset metadata dynamically to check if it's an Image or ImageCollection
    const assetMeta: any = await new Promise((resolve) => {
      ee.data.getAsset(
        imageId,
        (asset: any) => resolve(asset),
        () => resolve(null), // Safe fallback
      );
    });

    // 2. Instantiate correctly based on type
    let GEEImage: any;

    // GEE api might return "ImageCollection" or "IMAGE_COLLECTION" depending on the endpoint version
    const assetType = normalizeGeeAssetType(assetMeta?.type);
    const shouldUseFeatureCollection = isFeatureCollectionAsset({
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
    } else if (assetType === "IMAGECOLLECTION") {
      // Squash the collection into a single image dynamically
      const collection = ee.ImageCollection(imageId);
      // Mosaicking a collection drops native projection info (since images inside could vary).
      // We must explicitly re-assign the projection from its first image so reduceResolution() doesn't crash.
      const proj = collection.first().projection();
      GEEImage = collection.mosaic().setDefaultProjection(proj);
    } else {
      // Default behavior
      GEEImage = ee.Image(imageId);
    }

    let configuredVisParams: any;

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
      // 3. Fetch the list of available bands and automatically select one.
      try {
        const bandNames = await new Promise((resolve, reject) => {
          GEEImage.bandNames().evaluate(
            (bands: any) => resolve(bands),
            (err: any) => reject(err),
          );
        });
        if (bandNames && Array.isArray(bandNames) && bandNames.length > 0) {
          GEEImage = GEEImage.select(bandNames[bandNames.length - 1]);
        }
      } catch (bandErr) {
        console.error(
          `[GEE] -> Failed to fetch bands for ${imageId}:`,
          bandErr,
        );
      }
    }

    if (!shouldUseFeatureCollection) {
      GEEImage = clipImageToBrazil(GEEImage);
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
    const mapId = (await getMapId(
      mapImage,
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
 * Authenticates and initializes Google Earth Engine using a private key.
 * This function should only be called by the `initializeGee` singleton.
 * @returns {Promise<void>} - Resolves when initialization is successful.
 */
async function authenticateAndInitialize(): Promise<void> {
  const key = process.env.GEE_PRIVATE_KEY;
  if (!key) {
    throw new Error("GEE_PRIVATE_KEY environment variable not set.");
  }

  const credentials = parseGeeCredentials(key);

  const token = await fetchGoogleOAuthToken(credentials);
  ee.data.setAuthToken(
    credentials.client_email,
    token.tokenType,
    token.accessToken,
    token.expiresIn,
    GEE_AUTH_SCOPES,
    undefined,
    false,
    true,
  );
  configureGeeTokenRefresh(credentials);

  await new Promise<void>((resolve, reject) => {
    ee.initialize(null, null, resolve, reject);
  });
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

      for (const year of getImageDataYearKeys(imageData)) {
        const yearConfig = resolveImageYearEntry(imageData, year);
        if (!yearConfig) continue;

        const cacheKey = buildCacheKey(
          id,
          year,
          yearConfig.imageId,
          yearConfig.imageParams,
          minScale,
          maxScale,
          yearConfig.mapVisualization,
        );
        const url = await getEarthEngineUrl(
          yearConfig.imageId,
          yearConfig.imageParams,
          minScale,
          maxScale,
          {
            mapVisualization: yearConfig.mapVisualization,
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
