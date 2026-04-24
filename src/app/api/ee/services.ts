import ee from "@google/earthengine";
import { addUrlToCache, buildCacheKey } from "@/app/api/ee/cache";
import { getContent } from "@/infrastructure/contentful/client";
import { IMapId, IEEInfo, PanelLayerI } from "@/utils/interfaces";
import { getImageDataYearKeys, resolveImageYearEntry } from "@/utils/imageData";
import { GET_PANEL_LAYER } from "@/utils/queries";

// ====== GEE Singleton for Authentication and Initialization ======

let geeInitialized: Promise<void> | null = null;

/**
 * Ensures that Google Earth Engine is authenticated and initialized, but only runs the process once.
 * This is a singleton pattern to prevent re-authentication on every API call.
 */
const initializeGee = async () => {
  if (geeInitialized) {
    return geeInitialized;
  }
  geeInitialized = authenticateAndInitialize();

  return geeInitialized;
};

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
) => {
  try {
    await initializeGee();
    console.log(new Date().toISOString(), " - GEE Initialized successfully");

    // 1. Fetch asset metadata dynamically to check if it's an Image or ImageCollection
    const assetMeta: any = await new Promise((resolve) => {
      ee.data.getAsset(
        imageId,
        (asset: any) => resolve(asset),
        (err: any) => resolve(null), // Safe fallback
      );
    });

    console.log(
      `\n[GEE] Asset: ${imageId} | Type: ${assetMeta?.type || "Unknown"}`,
    );

    // 2. Instantiate correctly based on type
    let GEEImage: any;

    // GEE api might return "ImageCollection" or "IMAGE_COLLECTION" depending on the endpoint version
    const assetType = assetMeta?.type
      ? String(assetMeta.type).toUpperCase().replace("_", "")
      : "";

    if (assetType === "IMAGECOLLECTION") {
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

    // 3. Fetch list of available bands and print them, then automatically select the first one
    try {
      const bandNames = await new Promise((resolve, reject) => {
        GEEImage.bandNames().evaluate(
          (bands: any) => resolve(bands),
          (err: any) => reject(err),
        );
      });
      console.log(`[GEE] -> Bands available:`, bandNames);

      // Explicitly select the first band so we don't accidentally try to render all of them
      if (bandNames && Array.isArray(bandNames) && bandNames.length > 0) {
        GEEImage = GEEImage.select(bandNames[bandNames.length - 1]);
      }
    } catch (bandErr) {
      console.error(`[GEE] -> Failed to fetch bands for ${imageId}:`, bandErr);
    }

    GEEImage = GEEImage.selfMask();
    const { categorizedImage, visParams } = getImageScale(
      GEEImage,
      imageParams,
      minScale,
      maxScale,
    );
    const mapId = (await getMapId(categorizedImage, visParams)) as IMapId;

    return mapId.urlFormat;
  } catch (error: any) {
    console.error("Error in getEarthEngineUrl:", error.message);

    return null;
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
    (imageParam: any) => imageParam.pixelLimit,
  );

  let categorizedImage = image;

  if (hasPixelLimits) {
    for (let index = 0; index < imageParams.length; index++) {
      const lowerLimit =
        index > 0 ? imageParams[index - 1].pixelLimit : Number.MIN_SAFE_INTEGER;

      const upperLimit =
        index < imageParams.length - 1
          ? imageParams[index].pixelLimit
          : Number.MAX_SAFE_INTEGER;

      categorizedImage = categorizedImage.where(
        image.gt(lowerLimit).and(image.lte(upperLimit)),
        index + 1,
      );
    }
  }

  const palette = imageParams.map((imageParam: any) => imageParam.color);

  // After categorization, pixel values are always 1..N (one integer per category).
  // Using Contentful's minScale/maxScale would cause all values to be clamped to
  // one palette extreme. Only use them for non-categorical (continuous) images.
  const visParams = hasPixelLimits
    ? { min: 1, max: imageParams.length, palette }
    : { min: minScale ?? 0, max: maxScale ?? 1, palette };

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

  console.log(new Date().toISOString(), " - Starting GEE authentication...");

  return new Promise((resolve, reject) => {
    ee.data.authenticateViaPrivateKey(
      JSON.parse(key),
      () => {
        console.log(
          new Date().toISOString(),
          " - GEE Authentication successful. Initializing...",
        );
        ee.initialize(null, null, resolve, reject);
      },
      (err: string) => {
        console.error(
          new Date().toISOString(),
          " - GEE Authentication failed:",
          err,
        );
        reject(new Error(err));
      },
    );
  }).then(() => {
    console.log(new Date().toISOString(), " - GEE Initialized.");
  });
}

let cached = false;
/**
 * Fetches and caches map data from Contentful/GEE API sources.
 * Runs recursively every 12 hours to keep the cache updated.
 */
export const cacheMapData = async () => {
  try {
    type PanelLayerResponse = {
      panelLayerCollection: { items: PanelLayerI[] };
    };
    const data = await getContent<PanelLayerResponse>(GET_PANEL_LAYER);
    const panelLayers = data?.panelLayerCollection?.items ?? [];

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

        const cacheKey = buildCacheKey(id, year);
        const url = await getEarthEngineUrl(
          yearConfig.imageId,
          yearConfig.imageParams,
          minScale,
          maxScale,
        );
        addUrlToCache(cacheKey, url);
      }
    }

    cached = true;
  } catch (error) {
    // Don’t crash the server on startup if Contentful/GEE is misconfigured.
    console.error("Error caching EE map data:", error);
  }
};

if (!cached) {
  cacheMapData();
  setInterval(cacheMapData, 1000 * 60 * 60 * 12);
}
