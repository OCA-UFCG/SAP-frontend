#!/usr/bin/env node
/**
 * Gera a lista de recortes (bioma, Semiárido, ASD) a que cada município
 * pertence.
 *
 * As tabelas estatísticas do Earth Engine trazem as colunas `BIOMA_PRED`,
 * `SEMIÁRIDO` e `ASD_ENTORN`, mas nas linhas municipais elas vêm como `---`
 * (conferido nos 35 assets em outubro de 2026). Sem essa informação o painel não
 * sabe quais municípios listar em "Territórios por classificação" quando o
 * recorte é um bioma, o Semiárido ou a ASD. As planilhas municipais do catálogo
 * trazem as três colunas preenchidas, então o script lê uma vez e grava o
 * resultado em `src/data`.
 *
 * Cada município vira a lista das chaves territoriais da plataforma
 * (`3_bioma-caatinga`, `5_semiarido-semiarido-total`, `4_asd-asd-entorno`), as
 * mesmas que o painel usa para pedir o recorte. Estado e região não entram:
 * saem do próprio código IBGE.
 *
 * Rode de novo quando o IBGE mudar a malha municipal ou quando a delimitação
 * do Semiárido ou da ASD for revista:
 *
 *   node scripts/build-municipality-territories.mjs [fileId ...]
 *
 * Sem argumentos, lê as seis planilhas publicadas no catálogo em outubro de
 * 2026 e para com erro se alguma discordar das outras sobre um município.
 */

import { readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";

const OUTPUT_PATH = "src/data/municipalityTerritories.json";
const CITIES_INDEX_PATH = "src/data/citiesIndex.json";

// PIB, IDHM, S2ID e as três de pobreza do CadÚnico: todas repetem as mesmas
// colunas territoriais.
const DEFAULT_FILE_IDS = [
  "1OgW6thfyXJX1TlW225BwNg4qvpXHzYAu",
  "1sazVqPQpWtuvMCGTdVqVSBzDLlFEbZSq",
  "10DuZo8jnl6N5Cq3A2fWP5OfaKp6g6Jtt",
  "14xEPRgYJi_FAX1AiVWZ89deSNEkaoiwz",
  "1zphYLUZ-j3byu7WmT0BvftjDJyVtXOHl",
  "1i6a986rIeQZw81KxF5uF9lT4cczd3fXv",
];

// As chaves seguem `buildSpatialLocationKey` (src/contracts/spatialLocationKey.mjs).
const BIOME_KEYS = {
  amazonia: "3_bioma-amazonia",
  caatinga: "3_bioma-caatinga",
  cerrado: "3_bioma-cerrado",
  "mata atlantica": "3_bioma-mata-atlantica",
  pampa: "3_bioma-pampa",
  pantanal: "3_bioma-pantanal",
};
const SEMIARID_KEY = "5_semiarido-semiarido-total";
// "ASD" e "Entorno" formam um recorte só na plataforma.
const ASD_KEY = "4_asd-asd-entorno";

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

async function readSpreadsheet(fileId) {
  const url = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} respondeu ${response.status}.`);
  }
  const workbook = XLSX.read(new Uint8Array(await response.arrayBuffer()));
  const [header, ...rows] = XLSX.utils.sheet_to_json(
    workbook.Sheets[workbook.SheetNames[0]],
    { header: 1, defval: null, blankrows: false },
  );
  const column = (name) => {
    const position = header.findIndex((cell) => normalize(cell) === normalize(name));
    if (position < 0) {
      throw new Error(`A planilha ${fileId} não tem a coluna ${name}.`);
    }
    return position;
  };
  const columns = {
    code: column("CD_MUN"),
    biome: column("BIOMA_PRED"),
    semiarid: column("SEMIÁRIDO"),
    asd: column("ASD_ENTORN"),
  };

  const territories = new Map();
  for (const row of rows) {
    const code = String(row[columns.code] ?? "").trim();
    if (!/^\d{7}$/u.test(code)) continue;

    const keys = [];
    const biome = normalize(row[columns.biome]);
    if (biome) {
      const biomeKey = BIOME_KEYS[biome];
      if (!biomeKey) {
        throw new Error(`Bioma desconhecido "${row[columns.biome]}" em ${code} (${fileId}).`);
      }
      keys.push(biomeKey);
    }
    if (normalize(row[columns.semiarid]) === "sim") keys.push(SEMIARID_KEY);
    const asd = normalize(row[columns.asd]);
    if (asd && asd !== "nao") keys.push(ASD_KEY);

    territories.set(code, keys);
  }
  return territories;
}

const fileIds = process.argv.length > 2 ? process.argv.slice(2) : DEFAULT_FILE_IDS;
const platformCodes = new Set(
  JSON.parse(readFileSync(CITIES_INDEX_PATH, "utf8")).map((city) => city.code),
);

const [reference, ...others] = await Promise.all(fileIds.map(readSpreadsheet));
const disagreements = [];
others.forEach((territories, index) => {
  for (const [code, keys] of territories) {
    const expected = reference.get(code);
    if (expected && expected.join() !== keys.join()) {
      disagreements.push(`${code}: ${fileIds[0]} diz ${expected.join(", ")}; ${fileIds[index + 1]} diz ${keys.join(", ")}`);
    }
  }
});
if (disagreements.length > 0) {
  throw new Error(`As planilhas discordam:\n${disagreements.join("\n")}`);
}

// Só os códigos que a plataforma conhece. As áreas operacionais das lagoas
// Mirim e dos Patos (4300001 e 4300002) só aparecem nas planilhas de pobreza,
// por isso a lista de referência é completada pelas outras.
const municipalities = {};
const withoutTerritory = [];
for (const code of [...platformCodes].sort()) {
  const keys = reference.get(code) ?? others.find((t) => t.has(code))?.get(code);
  if (!keys?.length) {
    withoutTerritory.push(code);
    continue;
  }
  municipalities[code] = keys;
}

const body = Object.entries(municipalities)
  .map(([code, keys]) => `    ${JSON.stringify(code)}: ${JSON.stringify(keys)}`)
  .join(",\n");
writeFileSync(
  OUTPUT_PATH,
  `{\n  "source": ${JSON.stringify(`Colunas BIOMA_PRED, SEMIÁRIDO e ASD_ENTORN das planilhas ${fileIds.join(", ")}. Gerado por scripts/build-municipality-territories.mjs.`)},\n  "municipalities": {\n${body}\n  }\n}\n`,
);

console.log(`${Object.keys(municipalities).length} municípios gravados em ${OUTPUT_PATH}.`);
if (withoutTerritory.length > 0) {
  console.log(`Sem recorte nas planilhas (ficam fora das listas de bioma): ${withoutTerritory.join(", ")}`);
}
