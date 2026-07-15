import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { slugifyFileName, toWorkspaceRelativePath } from "../shared/paths.mjs";

const MUNICIPALITY_CODE = /^\d{7}$/u;
const DEFAULT_MAX_REQUEST_BYTES = 900_000;
const MAX_SHARD_COUNT = 4_096;

function encodeSeriesPayload(payload, chunkSize) {
  const rawJson = JSON.stringify(payload);
  const compressed = gzipSync(Buffer.from(rawJson, "utf8"), { level: 9 });
  const encoded = compressed.toString("base64");
  const data = [];

  for (let index = 0; index < encoded.length; index += chunkSize) {
    data.push(encoded.slice(index, index + chunkSize));
  }

  return {
    schemaVersion: 1,
    type: "municipal-report-series-compressed",
    encoding: "gzip+base64",
    mediaType: "application/vnd.sedes.municipal-report-series+json",
    rawBytes: Buffer.byteLength(rawJson),
    compressedBytes: compressed.byteLength,
    chunkSize,
    data,
  };
}

function transposeMunicipalSeries(imageData) {
  const municipalities = {};
  const aggregates = {};

  for (const [period, yearEntry] of Object.entries(imageData.years ?? {})) {
    for (const [location, values] of Object.entries(yearEntry.values ?? {})) {
      const target = MUNICIPALITY_CODE.test(location)
        ? municipalities
        : location === "br"
          ? aggregates
          : null;
      if (!target) continue;

      target[location] ??= {};
      target[location][period] = {
        values,
        ...(typeof yearEntry.valuesScale === "number"
          ? { valuesScale: yearEntry.valuesScale }
          : {}),
      };
    }
  }

  return { municipalities, aggregates };
}

function addSumAggregate(transposed) {
  if (transposed.aggregates.br) return;
  const aggregate = {};
  for (const periods of Object.values(transposed.municipalities)) {
    for (const [period, entry] of Object.entries(periods)) {
      aggregate[period] ??= {
        values: Array(entry.values.length).fill(0),
        ...(typeof entry.valuesScale === "number" ? { valuesScale: entry.valuesScale } : {}),
      };
      entry.values.forEach((value, index) => {
        aggregate[period].values[index] += value;
      });
    }
  }
  transposed.aggregates.br = aggregate;
}

function buildManagementRequestBytes(fields, locale = "en-US") {
  const localized = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, { [locale]: value }]),
  );
  return Buffer.byteLength(JSON.stringify({ fields: localized }));
}

function buildShardPayload(municipalities) {
  return {
    schemaVersion: 1,
    type: "municipal-report-series",
    municipalities,
  };
}

function partitionMunicipalities(municipalities, shardCount) {
  const shards = new Map();
  for (const [municipalityCode, periods] of Object.entries(municipalities)) {
    const shardKey = String(Number(municipalityCode) % shardCount);
    const shard = shards.get(shardKey) ?? {};
    shard[municipalityCode] = periods;
    shards.set(shardKey, shard);
  }
  return shards;
}

function serializeCandidate(panelLayerId, datasetVersion, shardKey, payload, pipelineConfig) {
  const imageData = encodeSeriesPayload(
    payload,
    pipelineConfig.limits.compressedDataChunkSize,
  );
  const title = `Municipal Report Series ${panelLayerId} ${datasetVersion} ${shardKey}`;
  const outputBytes = Buffer.byteLength(JSON.stringify(imageData));
  const requestBytes = buildManagementRequestBytes({
    title,
    panelLayerId,
    shardKey,
    datasetVersion,
    imageData,
  });
  return {
    title,
    imageData,
    rawBytes: imageData.rawBytes,
    compressedBytes: imageData.compressedBytes,
    outputBytes,
    requestBytes,
  };
}

function fitsLimits(candidate, maxImageDataBytes, maxRequestBytes) {
  return (
    candidate.outputBytes <= maxImageDataBytes &&
    candidate.requestBytes <= maxRequestBytes
  );
}

export function buildMunicipalReportSeriesShards(conversion, panelLayerId, pipelineConfig, options = {}) {
  const maxImageDataBytes = options.maxImageDataBytes ?? pipelineConfig.limits.maxContentfulJsonBytes;
  const maxRequestBytes = options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;
  const transposed = transposeMunicipalSeries(conversion.imageData);
  if (pipelineConfig.panelLayerProfiles?.[panelLayerId]?.reportSeriesAggregate === "sum") {
    addSumAggregate(transposed);
  }
  const periodKeys = Object.keys(conversion.imageData.years ?? {}).sort();
  const versionHash = createHash("sha256");
  for (const [municipalityCode, periods] of Object.entries(transposed.municipalities).sort()) {
    versionHash.update(municipalityCode);
    versionHash.update(JSON.stringify(periods));
  }
  for (const [aggregateKey, periods] of Object.entries(transposed.aggregates).sort()) {
    versionHash.update(aggregateKey);
    versionHash.update(JSON.stringify(periods));
  }
  const datasetVersion = versionHash.digest("hex").slice(0, 20);

  // Starting at 64 avoids ever serializing a CDI-sized all-municipality object
  // merely to discover that it cannot fit in Contentful.
  let shardCount = 64;
  let shardCandidates = [];
  while (shardCount <= MAX_SHARD_COUNT) {
    shardCandidates = [...partitionMunicipalities(transposed.municipalities, shardCount)]
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([shardKey, municipalities]) => ({
        shardKey,
        municipalityCodes: Object.keys(municipalities).sort(),
        ...serializeCandidate(
          panelLayerId,
          datasetVersion,
          shardKey,
          buildShardPayload(municipalities),
          pipelineConfig,
        ),
      }));
    if (shardCandidates.every((candidate) => fitsLimits(candidate, maxImageDataBytes, maxRequestBytes))) break;
    shardCount *= 2;
  }

  if (
    shardCount > MAX_SHARD_COUNT ||
    !shardCandidates.every((candidate) => fitsLimits(candidate, maxImageDataBytes, maxRequestBytes))
  ) {
    throw new Error(`Não foi possível limitar os shards de ${panelLayerId} a ${maxImageDataBytes} bytes de imageData e ${maxRequestBytes} bytes de requisição.`);
  }

  const aggregateCandidates = Object.keys(transposed.aggregates).length
    ? [
        {
          shardKey: "aggregate",
          municipalityCodes: Object.keys(transposed.aggregates).sort(),
          ...serializeCandidate(
            panelLayerId,
            datasetVersion,
            "aggregate",
            buildShardPayload(transposed.aggregates),
            pipelineConfig,
          ),
        },
      ]
    : [];
  if (!aggregateCandidates.every((candidate) => fitsLimits(candidate, maxImageDataBytes, maxRequestBytes))) {
    throw new Error(`Agregado de ${panelLayerId} excede os limites configurados.`);
  }

  return {
    schemaVersion: 1,
    panelLayerId,
    datasetVersion,
    shardCount,
    shardStrategy: "ibge-modulo",
    firstPeriod: periodKeys[0] ?? null,
    lastPeriod: periodKeys.at(-1) ?? null,
    municipalityCount: Object.keys(transposed.municipalities).length,
    periodCount: periodKeys.length,
    shards: [...shardCandidates, ...aggregateCandidates],
  };
}

export async function writeMunicipalReportSeries(conversion, group, outputDir, pipelineConfig, options = {}) {
  if (!group.panelLayerId) return null;
  await mkdir(outputDir, { recursive: true });
  const series = buildMunicipalReportSeriesShards(
    conversion,
    group.panelLayerId,
    pipelineConfig,
    options,
  );
  const files = [];

  for (const shard of series.shards) {
    const fileName = `municipal-report-series.${slugifyFileName(group.panelLayerId)}.${series.datasetVersion}.${shard.shardKey}.imageData.json`;
    const outputPath = path.join(outputDir, fileName);
    await writeFile(outputPath, `${JSON.stringify(shard.imageData)}\n`, "utf8");
    files.push({
      panelLayerId: group.panelLayerId,
      datasetVersion: series.datasetVersion,
      shardKey: shard.shardKey,
      title: shard.title,
      imageDataPath: toWorkspaceRelativePath(outputPath),
      municipalityCodes: shard.municipalityCodes,
      municipalityCount: shard.municipalityCodes.length,
      rawBytes: shard.rawBytes,
      compressedBytes: shard.compressedBytes,
      outputBytes: shard.outputBytes,
      requestBytes: shard.requestBytes,
    });
  }

  return {
    ...series,
    shards: files,
    reportSeriesConfig: {
      schemaVersion: 1,
      datasetVersion: series.datasetVersion,
      shardCount: series.shardCount,
      shardStrategy: series.shardStrategy,
      firstPeriod: series.firstPeriod,
      lastPeriod: series.lastPeriod,
    },
  };
}
