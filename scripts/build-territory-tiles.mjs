#!/usr/bin/env node
/**
 * Gera `brazil-territories-<grupo>.mbtiles`, um arquivo para cada grupo de
 * Territórios (terras indígenas, unidades de conservação, quilombolas e
 * assentamentos), de onde o mapa desenha o contorno, o nome e o clique — em vez
 * das imagens já pintadas pelo Earth Engine, que levam de 1,4 s a 2,6 s por
 * tile e não dizem ao navegador onde está cada território. Um arquivo por
 * grupo porque, juntos, quem ligava só as terras indígenas baixava também os
 * assentamentos: o tile do Brasil inteiro ia de 54 KB a 463 KB.
 *
 * Os arquivos não são gerados no deploy: ficam anexados à release `tiles-2025`
 * do GitHub, junto com os tiles de estados e municípios, e o deploy só baixa
 * (`scripts/download-tiles.sh`). Rode de novo quando um asset mudar, só para o
 * grupo dele, e substitua o anexo:
 *
 *   set -a; source .env; set +a
 *   node scripts/build-territory-tiles.mjs quilombolas
 *   gh release upload tiles-2025 public/tiles/brazil-territories-quilombolas.mbtiles --clobber
 *
 * Sem o nome do grupo, gera os quatro. Não crie uma release nova para isso:
 * toda tag nova dispara o deploy de produção.
 *
 * Precisa de GEE_PRIVATE_KEY no ambiente e do GDAL (`ogr2ogr`, com GEOS e
 * Spatialite) instalado. Os quatro levam uns 25 minutos; os assentamentos e
 * as unidades de conservação, uns 10 cada.
 *
 * Cada arquivo tem quatro camadas:
 * - `<grupo>`: os polígonos, com o nome e o município — o que o mapa pinta e
 *   o clique acha;
 * - `<grupo>_rotulos`: um ponto dentro de cada território, onde vai o nome;
 * - `<grupo>_mascara`: o retângulo de `maskBounds` menos os territórios, que
 *   escurece o resto do mapa quando o grupo está em destaque. Fora do
 *   retângulo, quem escurece é o próprio mapa, com um polígono só.
 *
 * O retângulo segue a grade dos tiles do zoom `maskBoundsZoom`: assim a borda
 * dele cai exatamente na borda de um tile, onde a máscara e o escuro de fora
 * se encontram sem sobrepor — sobrepostos, os dois deixavam uma linha mais
 * escura no meio do mapa. Abaixo desse zoom a grade é mais larga que o
 * retângulo, e os tiles levam também o resto do mundo (`<grupo>_mascara_fora`).
 */

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ee from "@google/earthengine";

const REFERENCE_LAYERS_PATH = "src/config/referenceLayers.json";
const VECTOR_TILES_CONFIG_PATH = "src/config/territoryVectorTiles.json";
// A máscara cobre o Brasil inteiro com um polígono só, cheio de buracos. Cortar
// esse polígono em cada tile levava mais de 10 minutos; em quadrados de 1° cada
// tile só recorta os pedaços que caem nele.
const MASK_CELL_DEGREES = 1;
// Quantos territórios, em média, cada pedido de download leva.
const DOWNLOAD_SLICE_SIZE = 500;
// ~5 m: a borda da máscara fica sob o contorno do território.
const MASK_SIMPLIFY_DEGREES = 0.00005;
const SLICE_COLUMN = "fatia";
const FALLBACK_SIMPLIFY_METERS = 1;

const OUTPUT_DIR = "public/tiles";
const referenceLayers = JSON.parse(readFileSync(REFERENCE_LAYERS_PATH, "utf8"));
const tilesConfig = JSON.parse(readFileSync(VECTOR_TILES_CONFIG_PATH, "utf8"));
// Sem argumento, todos os grupos; com argumentos, só os pedidos.
const requestedLayers =
  process.argv.length > 2 ? process.argv.slice(2) : tilesConfig.layers;

async function initializeEarthEngine() {
  const rawKey = process.env.GEE_PRIVATE_KEY;
  if (!rawKey) {
    throw new Error(
      "GEE_PRIVATE_KEY não está no ambiente. Rode `set -a; source .env; set +a` antes.",
    );
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

/**
 * Igual à de `build-reference-territories.mjs`, que gera a lista da busca: os
 * dois arquivos precisam escrever o município do mesmo jeito.
 */
function normalizeMunicipality(value) {
  return String(value ?? "")
    .split(",")
    .map((part) => part.replace(/\s*\([A-Z]{2}\)\s*$/, "").trim())
    .filter(Boolean)
    .join(", ");
}

const evaluate = (value) =>
  new Promise((resolve, reject) =>
    value.evaluate((result, error) =>
      error ? reject(new Error(error)) : resolve(result),
    ),
  );

const sliceOf = (collection, from, to) =>
  collection.filter(ee.Filter.rangeContains(SLICE_COLUMN, from, to));

/** A coleção em GeoJSON, ou `null` se o Earth Engine recusar. */
async function downloadFeatures(collection, layerId) {
  const url = await new Promise((resolve, reject) =>
    collection
      .select(["name", "municipio"])
      .getDownloadURL("geojson", null, layerId, (value, error) =>
        error ? reject(new Error(error)) : resolve(value),
      ),
  );
  const response = await fetch(url);
  if (!response.ok) return null;
  return (await response.json()).features;
}

/**
 * Um território que o Earth Engine recusa sozinho tem vértices demais: a ARIE
 * Paulo Nogueira Neto tem uma parte com 450 mil. A 1 m, abaixo do que o tile
 * mais detalhado distingue, ele passa.
 */
async function downloadSimplified(slice, layerId) {
  const features = await downloadFeatures(
    slice.map((feature) => feature.simplify(FALLBACK_SIMPLIFY_METERS)),
    layerId,
  );
  if (!features) {
    throw new Error(`${layerId}: o Earth Engine recusou um território`);
  }
  for (const feature of features) {
    console.log(
      `${layerId}: ${feature.properties.name} simplificado a ${FALLBACK_SIMPLIFY_METERS} m`,
    );
  }
  return features;
}

/**
 * O asset inteiro, sem simplificar: quem simplifica é o GDAL, por zoom.
 *
 * Em fatias: de uma vez, as unidades de conservação passam do que o Earth
 * Engine aceita montar ("No space left on device"). Cada território ganha um
 * número sorteado com semente fixa, e cada fatia é uma faixa desses números;
 * uma faixa recusada é pedida de novo em duas metades, até sobrar um
 * território só.
 */
async function downloadLayer(layerId, destination) {
  const { assetId, fields } = referenceLayers[layerId];
  const collection = ee
    .FeatureCollection(assetId)
    .select([fields.name, fields.municipality], ["name", "municipio"])
    .randomColumn(SLICE_COLUMN, 0);
  const total = await evaluate(collection.size());
  const slices = Math.max(1, Math.ceil(total / DOWNLOAD_SLICE_SIZE));
  // A última faixa fecha em 1,0: `rangeContains` inclui as duas pontas.
  const pending = Array.from({ length: slices }, (_, index) => [
    index / slices,
    (index + 1) / slices,
  ]);
  const features = [];
  while (pending.length) {
    const [from, to] = pending.shift();
    const slice = sliceOf(collection, from, to);
    const downloaded = await downloadFeatures(slice, layerId);
    if (downloaded) {
      features.push(...downloaded);
    } else if ((await evaluate(slice.size())) <= 1) {
      features.push(...(await downloadSimplified(slice, layerId)));
    } else {
      const middle = (from + to) / 2;
      pending.unshift([from, middle], [middle, to]);
    }
  }
  // As faixas vizinhas dividem a ponta: um número que caia exatamente nela
  // vem duas vezes.
  const unique = [...new Map(features.map((f) => [f.id, f])).values()];
  for (const { properties } of unique) {
    properties.municipio = normalizeMunicipality(properties.municipio);
  }
  if (unique.length !== total) {
    throw new Error(
      `${layerId}: vieram ${unique.length} de ${total} territórios`,
    );
  }
  console.log(`${layerId}: ${total} territórios`);
  writeFileSync(
    destination,
    JSON.stringify({ type: "FeatureCollection", features: unique }),
  );
}

const ogr2ogr = (args) =>
  execFileSync("ogr2ogr", args, { stdio: ["ignore", "inherit", "inherit"] });

const sqlInto = (gpkg, layerName, geometryType, sql) =>
  ogr2ogr([
    "-update",
    gpkg,
    gpkg,
    "-dialect",
    "SQLite",
    "-nln",
    layerName,
    "-nlt",
    geometryType,
    "-sql",
    sql,
  ]);

/** Os polígonos, os pontos dos nomes e a máscara de um grupo, no GeoPackage. */
function buildLayer(layerId, geojson, gpkg) {
  const raw = `${layerId}_bruto`;
  const cells = `${layerId}_celulas`;
  const simple = `${layerId}_simples`;
  const [west, south, east, north] = tilesConfig.maskBounds;
  const bounds = `BuildMbr(${west}, ${south}, ${east}, ${north}, 4326)`;

  // Alguns polígonos do asset se cruzam; sem consertar, a união da máscara falha.
  ogr2ogr(["-f", "GPKG", gpkg, geojson, "-makevalid", "-nln", raw]);
  // O conserto às vezes devolve uma coleção com linhas soltas: só os polígonos
  // interessam. Nome e município saem como na lista da busca
  // (`build-reference-territories.mjs`): o contorno grosso do marcado compara
  // os dois, porque só o nome se repete — 2.598 dos 8.215 assentamentos.
  sqlInto(
    gpkg,
    layerId,
    "MULTIPOLYGON",
    `SELECT TRIM(name) AS name, municipio, CastToMultiPolygon(ST_CollectionExtract(geom, 3)) AS geometry FROM ${raw}`,
  );
  // A área ordena os nomes: quando dois disputam o espaço, fica o maior.
  sqlInto(
    gpkg,
    `${layerId}_rotulos`,
    "POINT",
    `SELECT name, ST_Area(geometry) AS area, ST_PointOnSurface(geometry) AS geometry FROM ${layerId}`,
  );
  ogr2ogr([
    "-update",
    gpkg,
    gpkg,
    "-dialect",
    "SQLite",
    "-nln",
    cells,
    "-nlt",
    "POLYGON",
    "-explodecollections",
    "-sql",
    `SELECT ST_SquareGrid(${bounds}, ${MASK_CELL_DEGREES}) AS geometry`,
  ]);
  // A máscara só vai até o zoom `maskMaxZoom`, onde o tile já arredonda a
  // borda em uns 10 m: o contorno inteiro, com até 450 mil vértices num
  // território, só deixava o recorte lento. O buffer zero junta as partes de
  // um território que se sobrepõem — sobrepostas, a união do quadrado falhava
  // e ele saía todo escuro.
  sqlInto(
    gpkg,
    simple,
    "MULTIPOLYGON",
    `SELECT CastToMultiPolygon(ST_Buffer(ST_SimplifyPreserveTopology(geometry, ${MASK_SIMPLIFY_DEGREES}), 0)) AS geometry FROM ${layerId}`,
  );
  // A grade começa em graus inteiros e passa da borda do retângulo: cada
  // quadrado é cortado nela antes de perder os territórios. Cada território
  // entra só com o pedaço que cai no quadrado, e o retângulo envolvente
  // descarta de cara os que estão longe. Um quadrado sem território fica
  // inteiro; um que cai todo dentro de um território some.
  sqlInto(
    gpkg,
    `${layerId}_mascara`,
    "MULTIPOLYGON",
    `SELECT CastToMultiPolygon(geometry) AS geometry FROM (
       SELECT CASE WHEN territories IS NULL THEN cell
                   ELSE ST_Difference(cell, territories) END AS geometry
       FROM (
         SELECT ST_Intersection(c.geometry, ${bounds}) AS cell,
                (SELECT ST_Union(ST_Intersection(t.geometry, c.geometry))
                 FROM ${simple} t
                 WHERE MbrIntersects(t.geometry, c.geometry)) AS territories
         FROM ${cells} c))
     WHERE geometry IS NOT NULL`,
  );
  sqlInto(
    gpkg,
    `${layerId}_mascara_fora`,
    "MULTIPOLYGON",
    `SELECT CastToMultiPolygon(ST_Difference(BuildMbr(-180, -85.06, 180, 85.06, 4326), ${bounds})) AS geometry`,
  );
}

/** O arquivo de um grupo: os polígonos, os nomes e a máscara dele. */
function writeTiles(layerId, gpkg) {
  const output = path.join(OUTPUT_DIR, `brazil-territories-${layerId}.mbtiles`);
  // De perto o mapa amplia a máscara do zoom `maskMaxZoom`: a borda dela
  // fica embaixo do contorno do território, que é mais largo que o erro.
  const layerConfig = {
    [`${layerId}_mascara`]: { maxzoom: tilesConfig.maskMaxZoom },
    [`${layerId}_mascara_fora`]: { maxzoom: tilesConfig.maskBoundsZoom - 1 },
  };
  rmSync(output, { force: true });
  ogr2ogr([
    "-f",
    "MBTILES",
    output,
    gpkg,
    layerId,
    `${layerId}_rotulos`,
    `${layerId}_mascara`,
    `${layerId}_mascara_fora`,
    "-dsco",
    `MINZOOM=${tilesConfig.minZoom}`,
    "-dsco",
    `MAXZOOM=${tilesConfig.maxZoom}`,
    // O padrão (500 KB) descarta detalhe dos tiles de longe, onde a máscara
    // do Brasil inteiro cabe num tile só.
    "-dsco",
    "MAX_SIZE=1000000",
    "-dsco",
    `CONF=${JSON.stringify(layerConfig)}`,
  ]);
  return output;
}

async function main() {
  const unknown = requestedLayers.filter(
    (layerId) => !tilesConfig.layers.includes(layerId),
  );
  if (unknown.length) {
    throw new Error(
      `Grupo desconhecido: ${unknown.join(", ")}. Os grupos são ${tilesConfig.layers.join(", ")}.`,
    );
  }
  await initializeEarthEngine();
  const workDir = mkdtempSync(path.join(tmpdir(), "territory-tiles-"));
  // Para rodar de novo sem baixar tudo outra vez:
  // TERRITORY_DOWNLOAD_DIR=/algum/lugar node scripts/build-territory-tiles.mjs
  const downloadDir = process.env.TERRITORY_DOWNLOAD_DIR || workDir;

  try {
    for (const layerId of requestedLayers) {
      const gpkg = path.join(workDir, `${layerId}.gpkg`);
      const geojson = path.join(downloadDir, `${layerId}.geojson`);
      if (existsSync(geojson)) {
        console.log(`${layerId}: usando ${geojson}`);
      } else {
        console.log(`${layerId}: baixando do Earth Engine`);
        await downloadLayer(layerId, geojson);
      }
      console.log(`${layerId}: polígonos, nomes e máscara`);
      buildLayer(layerId, geojson, gpkg);
      console.log(`${layerId}: gerando os tiles`);
      console.log(`${layerId}: pronto em ${writeTiles(layerId, gpkg)}`);
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
