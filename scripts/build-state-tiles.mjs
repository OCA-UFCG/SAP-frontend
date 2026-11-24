#!/usr/bin/env node
/**
 * Gera `public/tiles/brazil-states.mbtiles`, o contorno dos estados no mapa,
 * em duas faixas de zoom:
 *
 * - Do zoom 7 ao 12, a união dos municípios da malha municipal do IBGE — a
 *   mesma de `brazil-cities.mbtiles`. É a partir do 7 que o mapa mostra as
 *   linhas dos municípios, e a borda do estado cai exatamente sobre elas.
 * - Do zoom 0 ao 6, os tiles do arquivo anterior, gerado pelo tippecanoe com
 *   `-S 10`, copiados sem mudança. De longe, o traço simplificado dele fica
 *   limpo; o detalhe dos municípios virava serrilhado. O problema dele era só
 *   de perto: o mapa ampliava o tile do zoom 6, e a divisa ficava com cara de
 *   linhas retas, a até ~1,5 km da borda dos municípios.
 *
 * A camada é `brazilstates`, com `SIGLA_UF` e `NM_UF` — os campos que o mapa
 * lê (`promoteId` e o rótulo do hover). As regiões não têm camada própria: o
 * mapa desenha os estados delas.
 *
 * O arquivo não é gerado no deploy: fica anexado à release `tiles-2025` do
 * GitHub, e o deploy só baixa (`scripts/download-tiles.sh`). O arquivo do
 * tippecanoe fica anexado à mesma release, com o nome
 * `brazil-states-tippecanoe.mbtiles`. Rode de novo quando o IBGE publicar uma
 * malha nova (leva uns 4 minutos) e substitua o anexo:
 *
 *   curl -LO https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_municipais/municipio_2025/Brasil/BR_Municipios_2025.zip
 *   gh release download tiles-2025 --pattern brazil-states-tippecanoe.mbtiles
 *   node scripts/build-state-tiles.mjs BR_Municipios_2025.zip brazil-states-tippecanoe.mbtiles
 *   gh release upload tiles-2025 public/tiles/brazil-states.mbtiles --clobber
 *
 * Não crie uma release nova para isso: toda tag nova dispara o deploy de
 * produção. Precisa do GDAL (`ogr2ogr`, com GEOS e Spatialite).
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import path from "node:path";

const OUTPUT = "public/tiles/brazil-states.mbtiles";
const LAYER = "brazilstates";
// O mesmo de `STATES_TILES_MAX_ZOOM` (src/components/Map/mapDefinitions.ts) e
// de `brazil-cities.mbtiles`.
const MAX_ZOOM = 12;
// O zoom em que o mapa passa a mostrar as linhas dos municípios
// (`MUNICIPALITY_MIN_ZOOM`, src/components/Map/municipalityLayers.ts). Daí em
// diante a borda do estado é a união deles; abaixo, a do tippecanoe.
const DETAIL_MIN_ZOOM = 7;
// Em unidades do tile (4.096 na largura, ~8 por pixel), do zoom 7 ao 11.
const SIMPLIFICATION = 2;
// As duas "lagoas" do RS (Lagoa dos Patos e Lagoa Mirim) entram na malha como
// áreas sem município; sem elas o RS sairia com dois buracos.
const EXPECTED_MUNICIPALITY_COUNT = 5573;
// O código IBGE do estado (os dois primeiros dígitos do município) → sigla e
// nome, do arquivo que o resto do mapa já usa.
const STATES = JSON.parse(
  readFileSync("src/data/geometria.json", "utf8"),
).features.map(({ properties: { codarea, info } }) => ({
  code: String(codarea),
  uf: info.sigla,
  name: info.nome,
}));

function resolveInput(argument) {
  if (!argument) {
    throw new Error(
      "Passe o caminho da malha municipal do IBGE (.zip ou .shp) e o do brazil-states-tippecanoe.mbtiles. Veja o topo do script.",
    );
  }
  if (!argument.toLowerCase().endsWith(".zip")) return argument;
  const shapefile = execFileSync("unzip", ["-Z1", argument], {
    encoding: "utf8",
  })
    .split("\n")
    .find((entry) => entry.toLowerCase().endsWith(".shp"));
  if (!shapefile) throw new Error(`${argument} não tem um .shp`);
  return `/vsizip/${path.resolve(argument)}/${shapefile}`;
}

const ogr2ogr = (args) =>
  execFileSync("ogr2ogr", args, { stdio: ["ignore", "inherit", "inherit"] });

const countRows = (gpkg, sql) =>
  Number(
    execFileSync("ogrinfo", ["-ro", "-q", "-sql", sql, gpkg], {
      encoding: "utf8",
    }).match(/n \(Integer\S*\) = (\d+)/)?.[1],
  );

const sqlString = (value) => `'${String(value).replace(/'/g, "''")}'`;

// Copia os tiles de longe do arquivo do tippecanoe para o arquivo novo e
// acerta os metadados, que o GDAL escreveu só com a faixa de perto.
function copyFarTiles(output, farTiles) {
  const db = new DatabaseSync(output);
  try {
    db.exec(`ATTACH DATABASE ${sqlString(farTiles)} AS far`);
    const metadata = (database, name) =>
      db
        .prepare(`SELECT value FROM ${database}.metadata WHERE name = ?`)
        .get(name)?.value;
    const farLayers = JSON.parse(metadata("far", "json")).vector_layers.map(
      (layer) => layer.id,
    );
    if (!farLayers.includes(LAYER)) {
      throw new Error(`${farTiles} não tem a camada ${LAYER}.`);
    }
    const copied = db
      .prepare(
        "INSERT INTO main.tiles SELECT zoom_level, tile_column, tile_row, tile_data FROM far.tiles WHERE zoom_level < ?",
      )
      .run(DETAIL_MIN_ZOOM).changes;
    const zooms = db
      .prepare(
        "SELECT COUNT(DISTINCT zoom_level) AS n FROM main.tiles WHERE zoom_level < ?",
      )
      .get(DETAIL_MIN_ZOOM).n;
    if (zooms !== DETAIL_MIN_ZOOM) {
      throw new Error(
        `${farTiles} tem ${zooms} dos zooms 0 a ${DETAIL_MIN_ZOOM - 1}.`,
      );
    }
    const setMetadata = (name, value) =>
      db
        .prepare("UPDATE main.metadata SET value = ? WHERE name = ?")
        .run(value, name);
    setMetadata("minzoom", "0");
    setMetadata("center", metadata("far", "center"));
    const json = JSON.parse(metadata("main", "json"));
    for (const layer of json.vector_layers) layer.minzoom = 0;
    setMetadata("json", JSON.stringify(json));
    db.exec("DETACH DATABASE far");
    return copied;
  } finally {
    db.close();
  }
}

function main() {
  const input = resolveInput(process.argv[2]);
  const farTiles = process.argv[3];
  if (!farTiles || !existsSync(farTiles)) {
    throw new Error(
      "Passe o caminho do brazil-states-tippecanoe.mbtiles (anexo da release tiles-2025). Veja o topo do script.",
    );
  }
  const workDir = mkdtempSync(path.join(tmpdir(), "brazil-states-"));
  const gpkg = path.join(workDir, "malha.gpkg");
  try {
    // A malha vem em SIRGAS 2000; em WGS 84, como o resto do mapa, a
    // diferença fica abaixo de um metro.
    ogr2ogr([
      "-f",
      "GPKG",
      gpkg,
      input,
      "-nln",
      "municipios",
      "-t_srs",
      "EPSG:4326",
      "-nlt",
      "MULTIPOLYGON",
      "-makevalid",
      "-select",
      "CD_MUN",
    ]);
    const count = countRows(gpkg, "SELECT COUNT(*) AS n FROM municipios");
    if (count !== EXPECTED_MUNICIPALITY_COUNT) {
      throw new Error(
        `A malha tem ${count} feições; esperava ${EXPECTED_MUNICIPALITY_COUNT}. Se o IBGE mudou a malha, confira e atualize EXPECTED_MUNICIPALITY_COUNT.`,
      );
    }
    console.log(`malha: ${count} municípios`);

    // A união dos municípios de cada estado. O buffer zero fecha frestas de
    // arredondamento entre vizinhos, que virariam risquinhos dentro do estado.
    const caseOf = (field) =>
      `CASE estado ${STATES.map(
        (state) =>
          `WHEN ${sqlString(state.code)} THEN ${sqlString(state[field])}`,
      ).join(" ")} END`;
    ogr2ogr([
      "-update",
      gpkg,
      gpkg,
      "-dialect",
      "SQLite",
      "-nln",
      LAYER,
      "-nlt",
      "MULTIPOLYGON",
      "-sql",
      `SELECT ${caseOf("uf")} AS SIGLA_UF, ${caseOf("name")} AS NM_UF, geometry
       FROM (SELECT substr(CD_MUN, 1, 2) AS estado,
                    CastToMultiPolygon(ST_Buffer(ST_Union(geom), 0)) AS geometry
             FROM municipios GROUP BY substr(CD_MUN, 1, 2))`,
    ]);
    const states = countRows(
      gpkg,
      `SELECT COUNT(*) AS n FROM ${LAYER} WHERE SIGLA_UF IS NOT NULL`,
    );
    if (states !== STATES.length) {
      throw new Error(`Saíram ${states} estados; esperava ${STATES.length}.`);
    }
    console.log(`${states} estados`);

    rmSync(OUTPUT, { force: true });
    ogr2ogr([
      "-f",
      "MBTILES",
      OUTPUT,
      gpkg,
      LAYER,
      "-dsco",
      "NAME=brazil-states",
      "-dsco",
      "DESCRIPTION=Estados do Brasil: união da malha municipal do IBGE",
      "-dsco",
      `MINZOOM=${DETAIL_MIN_ZOOM}`,
      "-dsco",
      `MAXZOOM=${MAX_ZOOM}`,
      "-dsco",
      "MAX_SIZE=1000000",
      // Abaixo do zoom máximo, simplifica um quarto de pixel: com o detalhe
      // todo, as voltas de rio e de divisa menores que um pixel viravam
      // serrilhado. Mais que isso descolaria a divisa da borda dos
      // municípios. O zoom máximo fica com o detalhe todo, porque é ele que o
      // mapa amplia ao aproximar.
      "-dsco",
      `SIMPLIFICATION=${SIMPLIFICATION}`,
      "-dsco",
      "SIMPLIFICATION_MAX_ZOOM=0",
    ]);
    const copied = copyFarTiles(OUTPUT, farTiles);
    console.log(
      `zoom 0 a ${DETAIL_MIN_ZOOM - 1}: ${copied} tiles do tippecanoe`,
    );
    console.log(`${OUTPUT}: zoom 0 a ${MAX_ZOOM}`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main();
