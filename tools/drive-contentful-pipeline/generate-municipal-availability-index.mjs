import nextEnv from "@next/env";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import {
  buildMunicipalAvailabilityIndex,
  toAvailabilityEntry,
} from "./lib/conversion/availability-index.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const PAGE_SIZE = 100;
const OUTPUT_FILE = path.resolve(
  process.cwd(),
  "src/data/municipalAvailabilityIndex.json",
);

function env(primary, fallback) {
  return process.env[primary] ?? process.env[fallback];
}

function hasContentfulCredentials() {
  const preview = env("CONTENTFUL_PREVIEW", "NEXT_PUBLIC_CONTENTFUL_PREVIEW") === "true";
  const token = preview
    ? env("CONTENTFUL_PREVIEW_TOKEN", "NEXT_PUBLIC_CONTENTFUL_PREVIEW_TOKEN")
    : env("CONTENTFUL_ACCESS_TOKEN", "NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN");

  return Boolean(
    env("CONTENTFUL_SPACE_ID", "NEXT_PUBLIC_CONTENTFUL_SPACE_ID") && token,
  );
}

function isValidIndex(index) {
  return (
    index?.schemaVersion === 1 &&
    Array.isArray(index.layers) &&
    index.layers.length > 0 &&
    index.byMunicipality &&
    typeof index.byMunicipality === "object" &&
    Object.keys(index.byMunicipality).length > 0
  );
}

async function reuseExistingIndexWithoutCredentials() {
  if (hasContentfulCredentials()) return false;

  try {
    const existing = JSON.parse(await readFile(OUTPUT_FILE, "utf8"));
    if (!isValidIndex(existing)) return false;

    console.log(
      `Reusing generated municipal availability index: ${existing.layers.length} layers, ${Object.keys(existing.byMunicipality).length} municipalities.`,
    );
    return true;
  } catch {
    return false;
  }
}

function getContentfulConfig() {
  const preview = env("CONTENTFUL_PREVIEW", "NEXT_PUBLIC_CONTENTFUL_PREVIEW") === "true";
  const spaceId = env("CONTENTFUL_SPACE_ID", "NEXT_PUBLIC_CONTENTFUL_SPACE_ID");
  const environment = env(
    "CONTENTFUL_ENVIRONMENT",
    "NEXT_PUBLIC_CONTENTFUL_ENVIRONMENT",
  ) ?? "master";
  const accessToken = preview
    ? env("CONTENTFUL_PREVIEW_TOKEN", "NEXT_PUBLIC_CONTENTFUL_PREVIEW_TOKEN")
    : env("CONTENTFUL_ACCESS_TOKEN", "NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN");

  if (!spaceId || !accessToken) {
    throw new Error(
      "Contentful credentials are required to generate municipalAvailabilityIndex.json.",
    );
  }

  return {
    accessToken,
    endpoint: `https://graphql.contentful.com/content/v1/spaces/${spaceId}/environments/${environment}`,
  };
}

async function queryContentful(query, variables = {}) {
  const { accessToken, endpoint } = getContentfulConfig();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Contentful request failed with status ${response.status}.`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(`Contentful GraphQL error: ${JSON.stringify(payload.errors)}`);
  }

  return payload.data;
}

function decodeImageData(value) {
  if (
    value?.type !== "territorial-compact-compressed" ||
    value?.encoding !== "gzip+base64"
  ) {
    return value;
  }

  const encoded = Array.isArray(value.data) ? value.data.join("") : value.data;
  return JSON.parse(gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"));
}

async function loadPanelLayers() {
  const data = await queryContentful(`
    query MunicipalAvailabilityPanelLayers {
      panelLayerCollection(limit: 100) {
        items { id name panelPosition }
      }
    }
  `);

  return (data.panelLayerCollection?.items ?? [])
    .filter((entry) => entry?.id)
    .sort(
      (left, right) =>
        (left.panelPosition ?? Number.MAX_SAFE_INTEGER) -
          (right.panelPosition ?? Number.MAX_SAFE_INTEGER) ||
        left.id.localeCompare(right.id),
    )
    .map((entry) => ({
      panelLayerId: entry.id,
      layerKey: entry.id,
      layerLabel: entry.name ?? entry.id,
    }));
}

async function loadAvailabilityEntries() {
  const query = `
    query MunicipalAvailabilityEntries($limit: Int!, $skip: Int!) {
      municipalAnalysisCollection(limit: $limit, skip: $skip) {
        total
        items { panelLayerId imageData }
      }
    }
  `;
  const entries = [];
  let skip = 0;
  let total = 0;

  do {
    const data = await queryContentful(query, { limit: PAGE_SIZE, skip });
    const collection = data.municipalAnalysisCollection;
    total = collection?.total ?? 0;

    for (const entry of collection?.items ?? []) {
      if (!entry?.panelLayerId || !entry.imageData) continue;
      const availability = toAvailabilityEntry({
        panelLayerId: entry.panelLayerId,
        imageData: decodeImageData(entry.imageData),
      });
      if (availability) entries.push(availability);
    }

    skip += PAGE_SIZE;
  } while (skip < total);

  return entries;
}

if (!(await reuseExistingIndexWithoutCredentials())) {
  const [availabilityEntries, panelLayers] = await Promise.all([
    loadAvailabilityEntries(),
    loadPanelLayers(),
  ]);

  if (availabilityEntries.length === 0) {
    throw new Error("Contentful returned no municipal availability entries.");
  }

  const index = buildMunicipalAvailabilityIndex(availabilityEntries, panelLayers);
  if (!isValidIndex(index)) {
    throw new Error("Generated municipal availability index is empty.");
  }

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(index, null, 2)}\n`, "utf8");

  console.log(
    `Generated municipal availability index: ${index.layers.length} layers, ${Object.keys(index.byMunicipality).length} municipalities.`,
  );
}
