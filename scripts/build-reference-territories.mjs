#!/usr/bin/env node
/**
 * Gera a lista de nomes da busca de territórios do mapa.
 *
 * As camadas de Territórios (quilombolas, assentamentos, terras indígenas e
 * unidades de conservação) chegam ao mapa como imagens já pintadas pelo Earth
 * Engine — o navegador não sabe o nome de nenhum território. Este script lê os
 * assets uma vez e grava, para cada território, o nome, a UF, o município e o
 * retângulo que o contém. A busca roda inteira no navegador sobre esse arquivo.
 *
 * Rode de novo sempre que um asset de `src/config/referenceLayers.json` for
 * trocado:
 *
 *   set -a; source .env; set +a
 *   node scripts/build-reference-territories.mjs
 *
 * Lê GEE_PRIVATE_KEY (e GEE_PROJECT_ID, opcional) do ambiente.
 */

import { readFileSync, writeFileSync } from "node:fs";
import ee from "@google/earthengine";

const CONFIG_PATH = "src/config/referenceLayers.json";
const OUTPUT_PATH = "public/data/reference-territories.json";
// O Earth Engine recusa devolver mais de 5000 elementos de uma vez.
const PAGE_SIZE = 2000;
// ~100 m: sobra para enquadrar o território e corta o arquivo quase pela metade.
const COORDINATE_DECIMALS = 3;
const BOUNDS_ERROR_MARGIN_METERS = 100;

// A UC grava a UF por extenso ("BAHIA"); as demais camadas, pela sigla.
const UF_BY_STATE_NAME = {
  ACRE: "AC", ALAGOAS: "AL", AMAPA: "AP", AMAZONAS: "AM", BAHIA: "BA",
  CEARA: "CE", "DISTRITO FEDERAL": "DF", "ESPIRITO SANTO": "ES", GOIAS: "GO",
  MARANHAO: "MA", "MATO GROSSO": "MT", "MATO GROSSO DO SUL": "MS",
  "MINAS GERAIS": "MG", PARA: "PA", PARAIBA: "PB", PARANA: "PR",
  PERNAMBUCO: "PE", PIAUI: "PI", "RIO DE JANEIRO": "RJ",
  "RIO GRANDE DO NORTE": "RN", "RIO GRANDE DO SUL": "RS", RONDONIA: "RO",
  RORAIMA: "RR", "SANTA CATARINA": "SC", "SAO PAULO": "SP", SERGIPE: "SE",
  TOCANTINS: "TO",
};

const stripAccents = (value) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "");

const evaluate = (eeObject) =>
  new Promise((resolve, reject) =>
    eeObject.evaluate((value, error) =>
      error ? reject(new Error(error)) : resolve(value),
    ),
  );

async function initializeEarthEngine() {
  const rawKey = process.env.GEE_PRIVATE_KEY;
  if (!rawKey) {
    throw new Error("GEE_PRIVATE_KEY não está no ambiente. Rode `set -a; source .env; set +a` antes.");
  }
  const credentials = JSON.parse(rawKey);
  const project = process.env.GEE_PROJECT_ID?.trim() || credentials.project_id;

  await new Promise((resolve, reject) =>
    ee.data.authenticateViaPrivateKey(
      credentials,
      () => ee.initialize(null, null, resolve, reject, null, project),
      reject,
    ),
  );
}

/** "BA", "AM,PA" ou "BAHIA, MINAS GERAIS" viram "BA" e "AM, PA". */
function normalizeUf(value) {
  return String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => UF_BY_STATE_NAME[stripAccents(part).toUpperCase()] ?? part.toUpperCase())
    .join(", ");
}

/** Tira o "(UF)" que a UC repete em cada município e padroniza a vírgula. */
function normalizeMunicipality(value) {
  return String(value ?? "")
    .split(",")
    .map((part) => part.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim())
    .filter(Boolean)
    .join(", ");
}

const round = (value) => Number(value.toFixed(COORDINATE_DECIMALS));

function ringBounds(ring) {
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  return [
    round(Math.min(...xs)),
    round(Math.min(...ys)),
    round(Math.max(...xs)),
    round(Math.max(...ys)),
  ];
}

async function readLayer(layerIndex, { assetId, fields }) {
  const collection = ee.FeatureCollection(assetId);
  const slim = collection.map((feature) =>
    ee.Feature(null, {
      n: feature.get(fields.name),
      u: feature.get(fields.uf),
      m: feature.get(fields.municipality),
      // Lista vazia quando a feição não tem geometria; essas ficam de fora.
      b: feature.geometry().bounds(BOUNDS_ERROR_MARGIN_METERS).coordinates(),
    }),
  );
  const size = await evaluate(collection.size());
  const territories = [];

  for (let offset = 0; offset < size; offset += PAGE_SIZE) {
    const page = await evaluate(
      slim.toList(PAGE_SIZE, offset).map((feature) =>
        ee.Feature(feature).toDictionary(),
      ),
    );
    for (const { n, u, m, b } of page) {
      const name = String(n ?? "").trim();
      const ring = Array.isArray(b) ? b[0] : null;
      if (!name || !Array.isArray(ring) || ring.length === 0) continue;
      territories.push([
        layerIndex,
        name,
        normalizeUf(u),
        normalizeMunicipality(m),
        ...ringBounds(ring),
      ]);
    }
  }

  return territories;
}

async function main() {
  const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  const layers = Object.keys(config);

  await initializeEarthEngine();

  const perLayer = await Promise.all(
    layers.map((layerId, index) => readLayer(index, config[layerId])),
  );
  layers.forEach((layerId, index) =>
    console.log(`${layerId}: ${perLayer[index].length} territórios`),
  );

  const output = {
    generatedAt: new Date().toISOString(),
    layers,
    // [camada, nome, UF, município, oeste, sul, leste, norte]
    territories: perLayer.flat(),
  };
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(output)}\n`);
  console.log(`Gravado em ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
