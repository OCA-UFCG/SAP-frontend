import ee from "@google/earthengine";
import { LRUCache } from "lru-cache";
import { initializeGee } from "@/app/api/ee/services";
import type { MunicipalReportClass } from "@/contracts/municipalReport";
import citiesIndex from "@/data/citiesIndex.json";
const urlCache = new LRUCache<string, string>({
  max: 500,
  ttl: 1000 * 60 * 60 * 24,
});
const BRAZIL_MUNICIPALITIES_ASSET = "FAO/GAUL/2015/level2";
export async function getMunicipalReportMapUrl(
  imageId: string,
  classes: MunicipalReportClass[],
  municipalityCode: string
): Promise<string | null> {
  const cacheKey = `${municipalityCode}_${imageId}`;
  if (urlCache.has(cacheKey)) {
    return urlCache.get(cacheKey)!;
  }
  try {
    await initializeGee();
    const cityData = citiesIndex.find((c) => c.code === municipalityCode);
    if (!cityData) return null;
    const normalizedCityName = cityData.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "")
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
    const palette = classes.map((c) => c.color.replace(/^#/u, "")).reverse();
    const allMunicipalities = ee.FeatureCollection(BRAZIL_MUNICIPALITIES_ASSET);
    const cityFeature = allMunicipalities
      .filter(ee.Filter.eq("ADM0_NAME", "Brazil"))
      .filter(ee.Filter.eq("ADM2_NAME", normalizedCityName));
    const cityGeometry = cityFeature.geometry();
    const boundingRegion = cityGeometry.buffer(30000).bounds();
    const raster = ee.Image(imageId);
    const visualized = raster.visualize({
      min: 0,
      max: classes.length - 1,
      palette,
    });
    const neighborsOutline = ee
      .Image()
      .byte()
      .paint(allMunicipalities, 1, 1)
      .visualize({ palette: ["666666"], opacity: 0.7 });
    const cityOutline = ee
      .Image()
      .byte()
      .paint(cityFeature, 1, 4)
      .visualize({ palette: ["000000"], opacity: 1 });
    const finalImage = visualized.blend(neighborsOutline).blend(cityOutline);
    const url = await new Promise<string>((resolve, reject) => {
      finalImage.getThumbURL(
        {
          dimensions: "800x800",
          region: boundingRegion,
          format: "png",
        },
        (resultUrl: string, err: any) => {
          if (err) reject(err);
          else resolve(resultUrl);
        }
      );
    });
    urlCache.set(cacheKey, url);
    return url;
  } catch (error) {
    console.error(`[municipalReportMapService] GEE image error:`, error);
    return null;
  }
}