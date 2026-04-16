import ee from "@google/earthengine";
import { IMapId, IEEInfo, PanelLayerI } from "@/utils/interfaces";
import { getContent } from "@/utils/contentful";
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

    const GEEImage = ee
      .Image(imageId)
      .selfMask()
      .reduceResolution(ee.Reducer.mode(), true, 128);
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

// ====== Cache ======
const TTL = 1000 * 60 * 30; // 0.5 hour in milliseconds

interface CacheEntry {
  url: string;
  timestamp: number;
}

let cached = false;
const cacheUrls = new Map<string, CacheEntry>();

/**
 * Checks if a given key exists in cache.
 * @param {string} key - The unique key to be search in the cache.
 * @returns {boolean} - True if the key exists, false otherwise.
 */
export const hasKey = (key: string) => {
  const entry = cacheUrls.get(key);
  if (!entry) {
    return false;
  }

  // Check if the entry has expired
  const expired = Date.now() - entry.timestamp > TTL;
  if (expired) {
    cacheUrls.delete(key); // Clean up expired entry
  }

  return !expired;
};

/**
 * Retrieves the caches URL for a given key.
 * @param {string} key - The unique key that refers to the URL to be returned.
 * @return {string | undefined} - The cached URL or undefined if the url is not present or has expired.
 */
export const getCachedUrl = (key: string) => {
  // The hasKey function also handles expiration checks and cleanup
  return cacheUrls.get(key)?.url || undefined;
};

/**
 * Removes a URL from the cache for a given key.
 * @param {string} key - The unique key that refers to the URL to be removed.
 */
export const removeCacheUrl = (key: string) => cacheUrls.delete(key);

/**
 * Adds a url to the cache, based on a key composed by the name and year of the map visualization.
 * @param {string} key - The unique key that refers to the URL to be returned.
 * @param {string} url - The URL to cache.
 */
export const addUrlToCache = (key: string, url: string | null) => {
  if (url) {
    const entry: CacheEntry = { url, timestamp: Date.now() };
    cacheUrls.set(key, entry);
  } else {
    cacheUrls.delete(key);
  }
};

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

      for (const year of Object.keys(imageData)) {
        const yearConfig = imageData[year];
        if (!yearConfig) continue;

        const url = await getEarthEngineUrl(
          yearConfig.imageId,
          yearConfig.imageParams,
          minScale,
          maxScale,
        );
        addUrlToCache(id + year, url);
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
