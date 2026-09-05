import "server-only";

import ee from "@google/earthengine";
import { inspectEarthEngineAsset } from "@/app/api/ee/services";
import { evaluateGeeObject } from "@/infrastructure/earth-engine/client";
import type {
  EarthEngineAssetMapping,
  IndexCatalogConfigV2,
} from "@/types/indexCatalog";
import { expandAssetForPeriod } from "@/utils/indexCatalog";

export interface ValidatedForecastCollection {
  latestValue: string | number;
  leadByPeriod: Record<string, number>;
}

export interface ValidatedMapAssets {
  assets: Array<{ assetId: string; updateTime?: string }>;
  forecast?: ValidatedForecastCollection;
}

function normalizeForecastPeriod(value: unknown) {
  if (value == null) return null;
  if (typeof value === "string") {
    const directPeriod = value.match(/^\d{4}-(?:0[1-9]|1[0-2])/u)?.[0];
    if (directPeriod) return directPeriod;
  }

  const numeric = Number(value);
  if (Number.isInteger(numeric) && /^\d{8}$/u.test(String(numeric))) {
    const compactDate = String(numeric);
    const period = `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}`;
    return /^\d{4}-(?:0[1-9]|1[0-2])$/u.test(period) ? period : null;
  }
  const date = new Date(Number.isFinite(numeric) ? numeric : String(value));
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function validateForecastCollection(
  mapping: EarthEngineAssetMapping,
  periods: string[],
  assetId: string,
): Promise<ValidatedForecastCollection | undefined> {
  const selection = mapping.collectionSelection;
  if (!selection) return undefined;
  if (periods.some((period) => !/^\d{4}-\d{2}$/u.test(period))) {
    throw new Error(
      "Previsão por emissão e horizonte exige estatísticas mensais.",
    );
  }
  if (!mapping.band) {
    throw new Error("Previsão por emissão e horizonte exige uma banda.");
  }
  if (!mapping.thresholds?.length) {
    throw new Error(
      "Previsão por emissão e horizonte exige os limites das classes.",
    );
  }

  const collection = ee.ImageCollection(assetId);
  const emissionValues = await evaluateGeeObject<Array<string | number>>(
    collection.aggregate_array(selection.emissionProperty).distinct().sort(),
  );
  const latestValue = emissionValues?.at(-1);
  if (latestValue == null) {
    throw new Error(
      `A coleção ${assetId} não possui valores em ${selection.emissionProperty}.`,
    );
  }

  const latestCollection = collection
    .filter(ee.Filter.eq(selection.emissionProperty, latestValue))
    .sort(selection.leadProperty);
  const [rawLeads, rawTargetDates] = await Promise.all([
    evaluateGeeObject<unknown[]>(
      latestCollection.aggregate_array(selection.leadProperty),
    ),
    evaluateGeeObject<unknown[]>(
      latestCollection.aggregate_array(selection.targetDateProperty),
    ),
  ]);
  if (rawLeads.length !== rawTargetDates.length) {
    throw new Error(
      `A coleção ${assetId} retornou horizontes e datas em quantidades diferentes.`,
    );
  }

  const rows = rawLeads.map((rawLead, index) => ({
    lead: Number(rawLead),
    period: normalizeForecastPeriod(rawTargetDates[index]),
  }));
  const leadByPeriod: Record<string, number> = {};
  for (const expectedLead of selection.leadValues) {
    const matches = rows.filter((row) => row.lead === expectedLead);
    if (matches.length !== 1) {
      throw new Error(
        `A emissão ${latestValue} de ${assetId} deve possuir exatamente uma imagem com ${selection.leadProperty}=${expectedLead}.`,
      );
    }
    const period = matches[0].period;
    if (!period) {
      throw new Error(
        `A imagem do horizonte ${expectedLead} não possui uma data válida em ${selection.targetDateProperty}.`,
      );
    }
    if (leadByPeriod[period] != null) {
      throw new Error(
        `Mais de um horizonte da emissão ${latestValue} aponta para ${period}.`,
      );
    }
    leadByPeriod[period] = expectedLead;
  }

  const forecastPeriods = Object.keys(leadByPeriod).sort();
  const expectedPeriods = [...periods].sort();
  if (forecastPeriods.join(",") !== expectedPeriods.join(",")) {
    throw new Error(
      `Os períodos da emissão ${latestValue} (${forecastPeriods.join(", ")}) não correspondem aos períodos estatísticos (${expectedPeriods.join(", ")}).`,
    );
  }

  return { latestValue, leadByPeriod };
}

export async function validateMapAssets(
  config: IndexCatalogConfigV2,
  periods: string[],
): Promise<ValidatedMapAssets> {
  const assets = new Map<string, string[]>();
  for (const period of periods) {
    const assetId = expandAssetForPeriod(config.earthEngine, period);
    if (!assetId) {
      throw new Error(`Não há asset de mapa para o período ${period}.`);
    }
    assets.set(assetId, [...(assets.get(assetId) ?? []), period]);
  }

  const metadata: Array<{ assetId: string; updateTime?: string }> = [];
  for (const [assetId, assetPeriods] of assets) {
    const inspection = await inspectEarthEngineAsset(assetId);
    if (inspection.type !== config.earthEngine.sourceType) {
      throw new Error(
        `O asset de mapa ${assetId} é ${inspection.type}, mas o formulário informa ${config.earthEngine.sourceType}.`,
      );
    }
    for (const period of assetPeriods) {
      const band = config.earthEngine.band
        ?.replaceAll("{period}", period)
        .replaceAll("{year}", period.slice(0, 4))
        .replaceAll("{month}", period.slice(5, 7));
      const property = config.earthEngine.property
        ?.replaceAll("{period}", period)
        .replaceAll("{year}", period.slice(0, 4))
        .replaceAll("{month}", period.slice(5, 7));
      if (band && !inspection.bands.includes(band)) {
        throw new Error(
          `A banda ${band} não existe em ${assetId} (${period}).`,
        );
      }
      if (property && !inspection.properties.includes(property)) {
        throw new Error(
          `A propriedade ${property} não existe em ${assetId} (${period}).`,
        );
      }
    }
    if (
      inspection.type === "featureCollection" &&
      !config.earthEngine.property
    ) {
      throw new Error("FeatureCollection de mapa exige uma propriedade.");
    }
    if (
      inspection.type !== "featureCollection" &&
      inspection.bands.length > 1 &&
      !config.earthEngine.band
    ) {
      throw new Error("Asset de mapa com várias bandas exige uma banda.");
    }
    metadata.push({ assetId, updateTime: inspection.updateTime });
  }
  const forecast = config.earthEngine.collectionSelection
    ? await validateForecastCollection(
        config.earthEngine,
        periods,
        config.earthEngine.singleAssetId ?? "",
      )
    : undefined;
  return { assets: metadata, ...(forecast ? { forecast } : {}) };
}
