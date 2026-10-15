#!/usr/bin/env node
/**
 * Gera `brazil-territories.mbtiles`, de onde o mapa desenha as terras indígenas
 * com o contorno, o nome e o clique — em vez das imagens já pintadas pelo Earth
 * Engine, que levam de 1,4 s a 2,6 s por tile e não dizem ao navegador onde
 * está cada território.
 *
 * O arquivo não é gerado no deploy: ele fica anexado à release `tiles-2025` do
 * GitHub, junto com os tiles de estados e municípios, e o deploy só baixa
 * (`scripts/download-tiles.sh`). Rode de novo quando o asset mudar e substitua
 * o anexo:
 *
 *   set -a; source .env; set +a
 *   node scripts/build-territory-tiles.mjs
 *   gh release upload tiles-2025 public/tiles/brazil-territories.mbtiles --clobber
 *
 * Não crie uma release nova para isso: toda tag nova dispara o deploy de
 * produção.
 *
 * Precisa de GEE_PRIVATE_KEY no ambiente e do GDAL (`ogr2ogr`, com GEOS e
 * Spatialite) instalado. Leva uns 5 minutos.
 *
 * Cada grupo vira três camadas no arquivo:
 * - `<grupo>`: os polígonos, com o nome — o que o mapa pinta e o clique acha;
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
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ee from "@google/earthengine";

const REFERENCE_LAYERS_PATH = "src/config/referenceLayers.json";
const VECTOR_TILES_CONFIG_PATH = "src/config/territoryVectorTiles.json";
const DEFAULT_OUTPUT = "public/tiles/brazil-territories.mbtiles";
// A máscara cobre o Brasil inteiro com um polígono só, cheio de buracos. Cortar
// esse polígono em cada tile levava mais de 10 minutos; em quadrados de 1° cada
// tile só recorta os pedaços que caem nele.
const MASK_CELL_DEGREES = 1;

const output = process.argv[2] ?? DEFAULT_OUTPUT;
const referenceLayers = JSON.parse(readFileSync(REFERENCE_LAYERS_PATH, "utf8"));
const tilesConfig = JSON.parse(readFileSync(VECTOR_TILES_CONFIG_PATH, "utf8"));

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

/** O asset inteiro, sem simplificar: quem simplifica é o GDAL, por zoom. */
async function downloadLayer(layerId, destination) {
  const { assetId, fields } = referenceLayers[layerId];
  const collection = ee.FeatureCollection(assetId).select([fields.name], ["name"]);
  const url = await new Promise((resolve, reject) =>
    collection.getDownloadURL("geojson", null, layerId, (value, error) =>
      error ? reject(new Error(error)) : resolve(value),
    ),
  );
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${layerId}: download do Earth Engine falhou (HTTP ${response.status})`);
  }
  writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
}

const ogr2ogr = (args) =>
  execFileSync("ogr2ogr", args, { stdio: ["ignore", "inherit", "inherit"] });

const sqlInto = (gpkg, layerName, geometryType, sql) =>
  ogr2ogr([
    "-update", gpkg, gpkg,
    "-dialect", "SQLite",
    "-nln", layerName,
    "-nlt", geometryType,
    "-sql", sql,
  ]);

/** Os polígonos, os pontos dos nomes e a máscara de um grupo, no GeoPackage. */
function buildLayer(layerId, geojson, gpkg) {
  const raw = `${layerId}_bruto`;
  const cells = `${layerId}_celulas`;
  const [west, south, east, north] = tilesConfig.maskBounds;
  const bounds = `BuildMbr(${west}, ${south}, ${east}, ${north}, 4326)`;

  // Alguns polígonos do asset se cruzam; sem consertar, a união da máscara falha.
  const update = existsSync(gpkg) ? ["-update"] : [];
  ogr2ogr(["-f", "GPKG", ...update, gpkg, geojson, "-makevalid", "-nln", raw]);
  // O conserto às vezes devolve uma coleção com linhas soltas: só os polígonos
  // interessam.
  sqlInto(gpkg, layerId, "MULTIPOLYGON",
    `SELECT name, CastToMultiPolygon(ST_CollectionExtract(geom, 3)) AS geometry FROM ${raw}`);
  // A área ordena os nomes: quando dois disputam o espaço, fica o maior.
  sqlInto(gpkg, `${layerId}_rotulos`, "POINT",
    `SELECT name, ST_Area(geometry) AS area, ST_PointOnSurface(geometry) AS geometry FROM ${layerId}`);
  ogr2ogr([
    "-update", gpkg, gpkg,
    "-dialect", "SQLite",
    "-nln", cells,
    "-nlt", "POLYGON",
    "-explodecollections",
    "-sql", `SELECT ST_SquareGrid(${bounds}, ${MASK_CELL_DEGREES}) AS geometry`,
  ]);
  // A grade começa em graus inteiros e passa da borda do retângulo: cada
  // quadrado é cortado nela antes de perder os territórios. Um quadrado sem
  // território fica inteiro; um que cai todo dentro de um território some.
  sqlInto(gpkg, `${layerId}_mascara`, "MULTIPOLYGON",
    `SELECT CastToMultiPolygon(geometry) AS geometry FROM (
       SELECT CASE WHEN territories IS NULL THEN cell
                   ELSE ST_Difference(cell, territories) END AS geometry
       FROM (
         SELECT ST_Intersection(c.geometry, ${bounds}) AS cell,
                (SELECT ST_Union(t.geometry) FROM ${layerId} t
                 WHERE ST_Intersects(t.geometry, c.geometry)) AS territories
         FROM ${cells} c))
     WHERE geometry IS NOT NULL`);
  sqlInto(gpkg, `${layerId}_mascara_fora`, "MULTIPOLYGON",
    `SELECT CastToMultiPolygon(ST_Difference(BuildMbr(-180, -85.06, 180, 85.06, 4326), ${bounds})) AS geometry`);
}

async function main() {
  await initializeEarthEngine();
  const workDir = mkdtempSync(path.join(tmpdir(), "territory-tiles-"));
  const gpkg = path.join(workDir, "territories.gpkg");

  try {
    const tileLayers = [];
    const layerConfig = {};
    for (const layerId of tilesConfig.layers) {
      const geojson = path.join(workDir, `${layerId}.geojson`);
      console.log(`${layerId}: baixando do Earth Engine`);
      await downloadLayer(layerId, geojson);
      console.log(`${layerId}: polígonos, nomes e máscara`);
      buildLayer(layerId, geojson, gpkg);

      tileLayers.push(
        layerId,
        `${layerId}_rotulos`,
        `${layerId}_mascara`,
        `${layerId}_mascara_fora`,
      );
      // De perto o mapa amplia a máscara do zoom `maskMaxZoom`: a borda dela
      // fica embaixo do contorno do território, que é mais largo que o erro.
      layerConfig[`${layerId}_mascara`] = { maxzoom: tilesConfig.maskMaxZoom };
      layerConfig[`${layerId}_mascara_fora`] = {
        maxzoom: tilesConfig.maskBoundsZoom - 1,
      };
    }

    console.log("gerando os tiles");
    rmSync(output, { force: true });
    ogr2ogr([
      "-f", "MBTILES", output, gpkg, ...tileLayers,
      "-dsco", `MINZOOM=${tilesConfig.minZoom}`,
      "-dsco", `MAXZOOM=${tilesConfig.maxZoom}`,
      // O padrão (500 KB) descarta detalhe dos tiles de longe, onde a máscara
      // do Brasil inteiro cabe num tile só.
      "-dsco", "MAX_SIZE=1000000",
      "-dsco", `CONF=${JSON.stringify(layerConfig)}`,
    ]);
    console.log(`pronto: ${output}`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
