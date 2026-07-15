import "server-only";

import { gunzipSync } from "node:zlib";
import { getContent } from "@/infrastructure/contentful/client";
import type { MunicipalReportSeriesConfig } from "@/utils/interfaces";

const GET_REPORT_SERIES = `
  query GetMunicipalReportSeries($panelLayerId: String!, $datasetVersion: String!, $shardKey: String!) {
    municipalReportSeriesCollection(
      limit: 2
      where: {
        panelLayerId: $panelLayerId
        datasetVersion: $datasetVersion
        shardKey: $shardKey
      }
    ) {
      items { panelLayerId datasetVersion shardKey imageData }
    }
  }
`;

interface SeriesValue {
  values: number[];
  valuesScale?: number;
}

export type MunicipalReportLocationSeries = Record<string, SeriesValue>;

interface SeriesPayload {
  schemaVersion: 1;
  type: "municipal-report-series";
  municipalities: Record<string, MunicipalReportLocationSeries>;
}

interface SeriesResponse {
  municipalReportSeriesCollection?: {
    items?: Array<{ imageData?: unknown } | null>;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getMunicipalReportShardKey(
  municipalityCode: string,
  config: MunicipalReportSeriesConfig,
): string {
  if (
    config.shardStrategy !== "ibge-modulo" ||
    !Number.isInteger(config.shardCount) ||
    config.shardCount <= 0
  ) {
    throw new Error("Configuração municipalReportSeries inválida.");
  }
  return String(Number(municipalityCode) % config.shardCount);
}

export function decodeMunicipalReportSeries(value: unknown): SeriesPayload | null {
  if (
    !isRecord(value) ||
    value.type !== "municipal-report-series-compressed" ||
    value.encoding !== "gzip+base64" ||
    !(typeof value.data === "string" ||
      (Array.isArray(value.data) && value.data.every((item) => typeof item === "string")))
  ) return null;

  try {
    const encoded = Array.isArray(value.data) ? value.data.join("") : value.data;
    const decoded: unknown = JSON.parse(
      gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"),
    );
    if (
      !isRecord(decoded) ||
      decoded.schemaVersion !== 1 ||
      decoded.type !== "municipal-report-series" ||
      !isRecord(decoded.municipalities)
    ) return null;
    return decoded as unknown as SeriesPayload;
  } catch {
    return null;
  }
}

async function loadShard(
  panelLayerId: string,
  datasetVersion: string,
  shardKey: string,
): Promise<SeriesPayload | null> {
  const data = await getContent<SeriesResponse>(
    GET_REPORT_SERIES,
    { panelLayerId, datasetVersion, shardKey },
    { cache: "no-store" },
  );
  const items = data.municipalReportSeriesCollection?.items ?? [];
  if (items.length > 1) {
    throw new Error(`municipalReportSeries duplicado para ${panelLayerId}/${datasetVersion}/${shardKey}.`);
  }
  return decodeMunicipalReportSeries(items[0]?.imageData);
}

export interface MunicipalReportSeriesResult {
  municipality: MunicipalReportLocationSeries | null;
  aggregate: MunicipalReportLocationSeries | null;
}

export async function getMunicipalReportSeries(
  panelLayerId: string,
  municipalityCode: string,
  config: MunicipalReportSeriesConfig,
  includeAggregate = false,
): Promise<MunicipalReportSeriesResult> {
  const shardKey = getMunicipalReportShardKey(municipalityCode, config);
  const [municipalShard, aggregateShard] = await Promise.all([
    loadShard(panelLayerId, config.datasetVersion, shardKey),
    includeAggregate
      ? loadShard(panelLayerId, config.datasetVersion, "aggregate")
      : Promise.resolve(null),
  ]);
  return {
    municipality: municipalShard?.municipalities[municipalityCode] ?? null,
    aggregate: aggregateShard?.municipalities.br ?? null,
  };
}
