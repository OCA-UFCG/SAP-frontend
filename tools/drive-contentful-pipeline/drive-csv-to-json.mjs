#!/usr/bin/env node

import { mkdir, open, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { gzipSync } from "node:zlib";

const DEFAULT_FOLDER_ID = "1otPt3-bhLAIaIG15cFUp5wzFdt1ALNOr";
const DEFAULT_CSV_DIR = "data/contentful-pipeline/csv";
const DEFAULT_JSON_DIR = "data/contentful-pipeline/json";
const DEFAULT_MAX_CONTENTFUL_JSON_BYTES = 450_000;
const COMPRESSED_DATA_CHUNK_SIZE = 30_000;
const DRIVE_API_BASE_URL = "https://www.googleapis.com/drive/v3";
const execFileAsync = promisify(execFile);
const MUNICIPALITY_TEMPLATE =
  "No município de {name}, predomina a classe {label} com {value}% da área analisada.";
const STATE_TEMPLATE =
  "Em {name}, predomina a classe {label} com {value}% da área analisada.";
const PANEL_LAYER_RULES = [
  {
    key: "carbono",
    label: "Carbono",
    panelLayerId: "carbonoembrapa",
    patterns: [/carbono/iu],
  },
  {
    key: "cdi",
    label: "CDI",
    panelLayerId: "CDI_Test",
    patterns: [/cdi/iu],
  },
  {
    key: "gpp",
    label: "GPP",
    panelLayerId: "prodprimariabruta",
    patterns: [/gpp/iu],
  },
  {
    key: "cobterra",
    label: "Cobertura da terra",
    panelLayerId: "terraibge",
    patterns: [/cobterra/iu, /cobertura[-_\s]?terra/iu],
  },
  {
    key: "ia",
    label: "Indice de aridez",
    panelLayerId: "indicearidez",
    patterns: [/(^|[-_\s])ia($|[-_\s])/iu],
  },
  {
    key: "idt",
    label: "IDT",
    panelLayerId: "deg",
    patterns: [/idt/iu],
  },
  {
    key: "ods",
    label: "ODS",
    panelLayerId: "ods",
    patterns: [/ods/iu],
  },
  {
    key: "cemaden",
    label: "Cemaden seca",
    panelLayerId: "cemadenseca",
    patterns: [/cemaden/iu],
  },
  {
    key: "ana",
    label: "Monitor de seca ANA",
    panelLayerId: "anaseca",
    patterns: [/ana/iu],
  },
];
const STATE_NAMES = {
  ac: "Acre",
  al: "Alagoas",
  ap: "Amapá",
  am: "Amazonas",
  ba: "Bahia",
  ce: "Ceará",
  df: "Distrito Federal",
  es: "Espírito Santo",
  go: "Goiás",
  ma: "Maranhão",
  mt: "Mato Grosso",
  ms: "Mato Grosso do Sul",
  mg: "Minas Gerais",
  pa: "Pará",
  pb: "Paraíba",
  pr: "Paraná",
  pe: "Pernambuco",
  pi: "Piauí",
  rj: "Rio de Janeiro",
  rn: "Rio Grande do Norte",
  rs: "Rio Grande do Sul",
  ro: "Rondônia",
  rr: "Roraima",
  sc: "Santa Catarina",
  sp: "São Paulo",
  se: "Sergipe",
  to: "Tocantins",
};

function parseArgs(argv) {
  const options = {
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || DEFAULT_FOLDER_ID,
    csvDir: DEFAULT_CSV_DIR,
    jsonDir: DEFAULT_JSON_DIR,
    accessToken: process.env.GOOGLE_DRIVE_ACCESS_TOKEN || "",
    apiKey: process.env.GOOGLE_DRIVE_API_KEY || "",
    skipDownload: false,
    fileNamePattern: "\\.csv$",
    writeAggregates: false,
    writeRawPartitions: false,
    maxContentfulJsonBytes: DEFAULT_MAX_CONTENTFUL_JSON_BYTES,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const nextValue = () => {
      const value = argv[index + 1];

      if (!value || value.startsWith("--")) {
        throw new Error(`Argumento sem valor: ${argument}`);
      }

      index += 1;
      return value;
    };

    if (argument === "--folder-id") {
      options.folderId = nextValue();
    } else if (argument === "--folder-url") {
      options.folderId = extractDriveFolderId(nextValue());
    } else if (argument === "--csv-dir") {
      options.csvDir = nextValue();
    } else if (argument === "--json-dir") {
      options.jsonDir = nextValue();
    } else if (argument === "--access-token") {
      options.accessToken = nextValue();
    } else if (argument === "--api-key") {
      options.apiKey = nextValue();
    } else if (argument === "--file-name-pattern") {
      options.fileNamePattern = nextValue();
    } else if (argument === "--skip-download") {
      options.skipDownload = true;
    } else if (argument === "--write-aggregates") {
      options.writeAggregates = true;
    } else if (argument === "--write-raw-partitions") {
      options.writeRawPartitions = true;
    } else if (argument === "--max-contentful-json-bytes") {
      options.maxContentfulJsonBytes = Number(nextValue());
    } else if (argument === "--help" || argument === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Argumento desconhecido: ${argument}`);
    }
  }

  if (
    !Number.isFinite(options.maxContentfulJsonBytes) ||
    options.maxContentfulJsonBytes <= 0
  ) {
    throw new Error("--max-contentful-json-bytes deve ser um número positivo.");
  }

  return options;
}

function printHelp() {
  console.log(`Uso:
  node tools/drive-contentful-pipeline/drive-csv-to-json.mjs [opções]

Opções:
  --folder-id <id>              ID da pasta do Google Drive.
  --folder-url <url>            URL da pasta do Google Drive.
  --csv-dir <path>              Pasta destino dos CSVs baixados.
  --json-dir <path>             Pasta destino dos JSONs convertidos.
  --skip-download               Converte os CSVs já existentes em --csv-dir.
  --write-aggregates            Também escreve JSONs agregados grandes por panelLayerId.
  --write-raw-partitions        Escreve partições sem gzip/base64 para depuração local.
  --max-contentful-json-bytes <n>
                                Limite por JSON gerado. Padrão: ${DEFAULT_MAX_CONTENTFUL_JSON_BYTES}.
  --file-name-pattern <regex>   Filtra nomes de arquivos do Drive. Padrão: \\.csv$
  --access-token <token>        OAuth token do Google Drive.
  --api-key <key>               API key para arquivos/pastas públicos.

Ambiente:
  GOOGLE_DRIVE_ACCESS_TOKEN, GOOGLE_DRIVE_API_KEY, GOOGLE_DRIVE_FOLDER_ID

Se GOOGLE_DRIVE_ACCESS_TOKEN e GOOGLE_DRIVE_API_KEY nao forem informados, o
script tenta obter um token com: gcloud auth print-access-token
Se o gcloud retornar invalid_scope, refaca o login com:
  gcloud auth login --enable-gdrive-access --force
`);
}

function extractDriveFolderId(value) {
  const match = value.match(/\/folders\/([^/?#]+)/);

  if (!match?.[1]) {
    throw new Error(`URL de pasta do Drive inválida: ${value}`);
  }

  return match[1];
}

function resolveWorkspacePath(value) {
  return path.resolve(process.cwd(), value);
}

function withAuth(url, options) {
  if (options.apiKey && !options.accessToken) {
    url.searchParams.set("key", options.apiKey);
  }

  return {
    headers: options.accessToken
      ? { Authorization: `Bearer ${options.accessToken}` }
      : {},
  };
}

async function fetchJson(url, options) {
  const response = await fetch(url, withAuth(url, options));

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Falha ao consultar Google Drive (${response.status}): ${body}`,
    );
  }

  return response.json();
}

async function listDriveCsvFiles(options) {
  const files = [];
  const namePattern = new RegExp(options.fileNamePattern, "iu");
  let pageToken = "";

  do {
    const url = new URL(`${DRIVE_API_BASE_URL}/files`);
    url.searchParams.set(
      "q",
      `'${options.folderId}' in parents and trashed = false`,
    );
    url.searchParams.set(
      "fields",
      "nextPageToken,files(id,name,mimeType,modifiedTime,size)",
    );
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    url.searchParams.set("pageSize", "1000");

    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const data = await fetchJson(url, options);

    for (const file of data.files ?? []) {
      if (
        namePattern.test(file.name) ||
        file.mimeType === "text/csv" ||
        file.mimeType === "application/vnd.google-apps.spreadsheet"
      ) {
        files.push(file);
      }
    }

    pageToken = data.nextPageToken ?? "";
  } while (pageToken);

  return files.sort((left, right) => left.name.localeCompare(right.name));
}

async function downloadDriveFile(file, destinationDir, options) {
  const url =
    file.mimeType === "application/vnd.google-apps.spreadsheet"
      ? new URL(`${DRIVE_API_BASE_URL}/files/${file.id}/export`)
      : new URL(`${DRIVE_API_BASE_URL}/files/${file.id}`);

  if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
    url.searchParams.set("mimeType", "text/csv");
  } else {
    url.searchParams.set("alt", "media");
  }

  const response = await fetch(url, withAuth(url, options));

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Falha ao baixar ${file.name} (${response.status}): ${body}`,
    );
  }

  const safeName = file.name.endsWith(".csv") ? file.name : `${file.name}.csv`;
  const outputPath = path.join(destinationDir, safeName);
  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));

  return outputPath;
}

async function downloadCsvFiles(options) {
  if (!options.accessToken && !options.apiKey) {
    options.accessToken = await getGcloudAccessToken();
  }

  const csvDir = resolveWorkspacePath(options.csvDir);
  await mkdir(csvDir, { recursive: true });

  const files = await listDriveCsvFiles(options);

  if (files.length === 0) {
    throw new Error("Nenhum CSV encontrado na pasta do Google Drive.");
  }

  const downloads = [];

  for (const file of files) {
    const outputPath = await downloadDriveFile(file, csvDir, options);
    downloads.push({
      id: file.id,
      name: file.name,
      outputPath: path.relative(process.cwd(), outputPath),
    });
  }

  return downloads;
}

async function getGcloudAccessToken() {
  try {
    const { stdout } = await execFileAsync("gcloud", [
      "auth",
      "print-access-token",
      "--scopes=https://www.googleapis.com/auth/drive",
    ]);
    const token = stdout.trim();

    if (!token) {
      throw new Error("gcloud nao retornou token.");
    }

    return token;
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);

    throw new Error(
      `Para baixar do Drive, informe GOOGLE_DRIVE_ACCESS_TOKEN ou GOOGLE_DRIVE_API_KEY, ou configure o gcloud com acesso ao Drive. Se aparecer invalid_scope, rode: gcloud auth login --enable-gdrive-access --force. Use --skip-download para converter CSVs locais. Detalhe: ${details}`,
    );
  }
}

function parseCsv(text) {
  const rows = [];
  let currentCell = "";
  let currentRow = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (insideQuotes && text[index + 1] === '"') {
        currentCell += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += character;
  }

  if (insideQuotes) {
    throw new Error("CSV com aspas não fechadas.");
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
}

function toRows(csvText) {
  const [header, ...dataRows] = parseCsv(csvText);

  if (!header || dataRows.length === 0) {
    throw new Error("CSV sem linhas de dados.");
  }

  return dataRows.map((cells, rowIndex) => {
    if (cells.length !== header.length) {
      throw new Error(
        `Linha ${rowIndex + 2} com ${cells.length} colunas; esperado ${header.length}.`,
      );
    }

    return Object.fromEntries(header.map((column, index) => [column, cells[index]]));
  });
}

function getClassColumns(rows) {
  const columns = Object.keys(rows[0] ?? {});
  const percentColumns = columns
    .filter((column) => /^perc_classe_\d+$/iu.test(column))
    .sort(compareClassColumns);

  if (percentColumns.length > 0) {
    return { type: "percent", columns: percentColumns };
  }

  const areaColumns = columns
    .filter((column) => /^area_ha_classe_\d+$/iu.test(column))
    .sort(compareClassColumns);

  if (areaColumns.length > 0 && columns.includes("area_total_ha")) {
    return { type: "area", columns: areaColumns };
  }

  throw new Error(
    "CSV sem colunas de classe. Esperado perc_classe_N ou area_ha_classe_N + area_total_ha.",
  );
}

function compareClassColumns(left, right) {
  return getClassColumnIndex(left) - getClassColumnIndex(right);
}

function getClassColumnIndex(column) {
  const match = column.match(/_(\d+)$/u);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function inferTerritory(row) {
  if (row.CD_MUN && row.NM_MUN && row.SIGLA_UF) {
    return "municipality";
  }

  if (row.SIGLA_UF && (row.NM_UF || row.NOME_UF || row.UF || row.CD_UF)) {
    return "state";
  }

  throw new Error(
    "CSV sem colunas territoriais reconhecidas. Para municípios use CD_MUN, NM_MUN, SIGLA_UF; para estados use SIGLA_UF e NM_UF/NOME_UF.",
  );
}

function getLocation(row, territory) {
  if (territory === "municipality") {
    return {
      key: String(row.CD_MUN).trim(),
      label: `${String(row.NM_MUN).trim()} - ${String(row.SIGLA_UF).trim().toUpperCase()}`,
    };
  }

  const uf = String(row.SIGLA_UF).trim().toLowerCase();
  const stateName =
    String(row.NM_UF ?? row.NOME_UF ?? "").trim() || STATE_NAMES[uf] || uf.toUpperCase();

  return {
    key: uf,
    label: stateName,
  };
}

function getYearKey(row) {
  const date = String(row.data_img ?? row.DATA_IMG ?? row.date ?? "").trim();
  const dateMatch = date.match(/^(\d{4})-(\d{2})-\d{2}$/u);

  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2]}`;
  }

  const year = String(row.ano ?? row.ANO ?? row.year ?? "").trim();

  if (/^\d{4}$/u.test(year)) {
    return year;
  }

  throw new Error(
    `Linha sem data_img YYYY-MM-DD ou ano YYYY reconhecido: ${JSON.stringify(row)}`,
  );
}

function toNumber(value, context) {
  const normalized = String(value).trim().replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor numérico inválido em ${context}: ${value}`);
  }

  return parsed;
}

function getClassValues(row, classColumns, locationKey, yearKey) {
  if (classColumns.type === "percent") {
    return classColumns.columns.map((column) =>
      toNumber(row[column], `${locationKey}/${yearKey}/${column}`),
    );
  }

  const totalArea = toNumber(row.area_total_ha, `${locationKey}/${yearKey}/area_total_ha`);

  if (totalArea <= 0) {
    return classColumns.columns.map(() => 0);
  }

  return classColumns.columns.map((column) =>
    Number(
      ((toNumber(row[column], `${locationKey}/${yearKey}/${column}`) / totalArea) * 100).toFixed(10),
    ),
  );
}

function sortRecordEntries(record) {
  return Object.fromEntries(
    Object.entries(record).sort(([leftKey], [rightKey]) =>
      leftKey.localeCompare(rightKey),
    ),
  );
}

function slugifyFileName(fileName) {
  return path
    .basename(fileName, path.extname(fileName))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-zA-Z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .toLowerCase();
}

function inferPanelLayerMapping(fileName) {
  const baseName = path.basename(fileName);
  const matchedRule = PANEL_LAYER_RULES.find((rule) =>
    rule.patterns.some((pattern) => pattern.test(baseName)),
  );

  if (!matchedRule) {
    return {
      layerKey: null,
      layerLabel: null,
      panelLayerId: null,
      mappingStatus: "unmapped",
      mappingRule: null,
    };
  }

  return {
    layerKey: matchedRule.key,
    layerLabel: matchedRule.label,
    panelLayerId: matchedRule.panelLayerId,
    mappingStatus: "mapped",
    mappingRule: matchedRule.patterns.map((pattern) => pattern.source).join("|"),
  };
}

async function convertCsvFile(inputPath) {
  const rows = toRows(await readFile(inputPath, "utf8"));
  const territory = inferTerritory(rows[0]);
  const classColumns = getClassColumns(rows);
  const panelLayerMapping = inferPanelLayerMapping(inputPath);
  const locations = new Map();
  const years = new Map();

  for (const row of rows) {
    const location = getLocation(row, territory);
    const yearKey = getYearKey(row);
    const values = getClassValues(row, classColumns, location.key, yearKey);

    locations.set(location.key, location.label);

    if (!years.has(yearKey)) {
      years.set(yearKey, {
        valuesScale: 1,
        values: {},
      });
    }

    const yearEntry = years.get(yearKey);

    if (yearEntry.values[location.key]) {
      throw new Error(
        `Duplicidade detectada para localidade ${location.key} na referência ${yearKey}.`,
      );
    }

    yearEntry.values[location.key] = values;
  }

  const imageData = {
    templates:
      territory === "municipality"
        ? { municipality: MUNICIPALITY_TEMPLATE }
        : { state: STATE_TEMPLATE },
    years: Object.fromEntries(
      Array.from(years.entries())
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([yearKey, yearEntry]) => [
          yearKey,
          {
            valuesScale: yearEntry.valuesScale,
            values: sortRecordEntries(yearEntry.values),
          },
        ]),
    ),
  };
  return {
    inputPath: path.relative(process.cwd(), inputPath),
    territory,
    ...panelLayerMapping,
    imageData,
    locationCount: locations.size,
    yearKeys: Array.from(years.keys()).sort(),
    classColumns: classColumns.columns,
  };
}

function getAggregatedOutputFileName(group) {
  if (!group.panelLayerId) {
    return `${slugifyFileName(group.sourceCsvPaths[0])}.unmapped.${group.territory}.imageData.json`;
  }

  return `municipal-analysis.${slugifyFileName(group.panelLayerId)}.${group.territory}.imageData.json`;
}

async function cleanGeneratedImageDataFiles(jsonDir) {
  const entries = await readdir(jsonDir, { withFileTypes: true }).catch((error) => {
    if (error?.code === "ENOENT") {
      return [];
    }

    throw error;
  });

  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".imageData.json"))
      .map((entry) => unlink(path.join(jsonDir, entry.name))),
  );
}

async function cleanGeneratedPartitionFiles(jsonDir) {
  const partitionDir = path.join(jsonDir, "partitions");
  await rm(partitionDir, { recursive: true, force: true });
  await mkdir(partitionDir, { recursive: true });

  return partitionDir;
}

function getCalendarYear(yearKey) {
  const match = String(yearKey).match(/^(\d{4})(?:-\d{2})?$/u);

  if (!match) {
    throw new Error(`Chave temporal inválida para particionar por ano: ${yearKey}`);
  }

  return match[1];
}

function encodeImageDataPayload(imageData, options) {
  if (options.writeRawPartitions) {
    return imageData;
  }

  const rawJson = JSON.stringify(imageData);
  const compressed = gzipSync(Buffer.from(rawJson, "utf8"), { level: 9 });
  const encoded = compressed.toString("base64");
  const chunks = [];

  for (let index = 0; index < encoded.length; index += COMPRESSED_DATA_CHUNK_SIZE) {
    chunks.push(encoded.slice(index, index + COMPRESSED_DATA_CHUNK_SIZE));
  }

  return {
    schemaVersion: 1,
    type: "territorial-compact-compressed",
    encoding: "gzip+base64",
    mediaType: "application/vnd.sap.territorial-analysis+json",
    rawBytes: Buffer.byteLength(rawJson),
    compressedBytes: compressed.byteLength,
    chunkSize: COMPRESSED_DATA_CHUNK_SIZE,
    data: chunks,
  };
}

function getPartitionOutputFileName(group, territory, partitionKey) {
  const baseName = group.panelLayerId
    ? `municipal-analysis.${slugifyFileName(group.panelLayerId)}`
    : `${slugifyFileName(group.sourceCsvPaths[0])}.unmapped`;

  return `${baseName}.${partitionKey}.${territory}.imageData.json`;
}

function buildPartitionPayload(conversion, years, options) {
  const imageData = {
    templates: conversion.imageData.templates,
    years,
  };
  const outputPayload = encodeImageDataPayload(imageData, options);

  return {
    outputPayload,
    rawBytes: Buffer.byteLength(JSON.stringify(imageData)),
    outputBytes: Buffer.byteLength(JSON.stringify(outputPayload)),
  };
}

async function writePartitionFile({
  conversion,
  group,
  partitionDir,
  writtenPartitions,
  partitionKey,
  calendarYear,
  years,
  splitReason,
  options,
}) {
  const uniquePartitionKey = `${group.panelLayerId ?? group.sourceCsvPaths[0]}::${conversion.territory}::${partitionKey}`;

  if (writtenPartitions.has(uniquePartitionKey)) {
    throw new Error(
      `Partição duplicada para ${uniquePartitionKey} ao processar ${conversion.inputPath}.`,
    );
  }

  writtenPartitions.add(uniquePartitionKey);

  const { outputPayload, rawBytes, outputBytes } = buildPartitionPayload(
    conversion,
    years,
    options,
  );

  if (outputBytes > options.maxContentfulJsonBytes) {
    throw new Error(
      `Partição ${partitionKey} de ${conversion.inputPath} gerou ${outputBytes} bytes, acima do limite ${options.maxContentfulJsonBytes}.`,
    );
  }

  const outputPath = path.join(
    partitionDir,
    getPartitionOutputFileName(group, conversion.territory, partitionKey),
  );

  await writeFile(outputPath, `${JSON.stringify(outputPayload)}\n`, "utf8");

  return {
    panelLayerId: group.panelLayerId,
    layerKey: group.layerKey,
    layerLabel: group.layerLabel,
    territory: conversion.territory,
    partitionKey,
    calendarYear,
    outputPath: path.relative(process.cwd(), outputPath),
    sourceCsvPath: conversion.inputPath,
    locationCount: conversion.locationCount,
    yearKeys: Object.keys(years).sort(),
    encoding: outputPayload.encoding ?? "identity",
    rawBytes,
    outputBytes,
    ...(splitReason ? { splitReason } : {}),
  };
}

async function writeAnnualPartitions(
  conversion,
  group,
  partitionDir,
  writtenPartitions,
  options,
) {
  const yearsByCalendarYear = new Map();

  for (const [yearKey, yearEntry] of Object.entries(conversion.imageData.years)) {
    const calendarYear = getCalendarYear(yearKey);

    if (!yearsByCalendarYear.has(calendarYear)) {
      yearsByCalendarYear.set(calendarYear, {});
    }

    yearsByCalendarYear.get(calendarYear)[yearKey] = yearEntry;
  }

  const partitionFiles = [];

  for (const [calendarYear, years] of yearsByCalendarYear) {
    const annualPayload = buildPartitionPayload(conversion, years, options);

    if (annualPayload.outputBytes <= options.maxContentfulJsonBytes) {
      partitionFiles.push(
        await writePartitionFile({
          conversion,
          group,
          partitionDir,
          writtenPartitions,
          partitionKey: calendarYear,
          calendarYear,
          years,
          options,
        }),
      );
      continue;
    }

    for (const [yearKey, yearEntry] of Object.entries(years).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      partitionFiles.push(
        await writePartitionFile({
          conversion,
          group,
          partitionDir,
          writtenPartitions,
          partitionKey: yearKey,
          calendarYear,
          years: { [yearKey]: yearEntry },
          splitReason: `annual partition exceeded ${options.maxContentfulJsonBytes} bytes`,
          options,
        }),
      );
    }
  }

  return partitionFiles;
}

function indentJson(json, spaces) {
  return json.replace(/\n/gu, `\n${" ".repeat(spaces)}`);
}

function assertSameRecord(left, right, label, sourceCsvPath) {
  const leftJson = JSON.stringify(sortRecordEntries(left));
  const rightJson = JSON.stringify(sortRecordEntries(right));

  if (leftJson !== rightJson) {
    throw new Error(`${label} divergente ao agregar ${sourceCsvPath}.`);
  }
}

function groupCsvPaths(csvPaths) {
  const groups = new Map();

  for (const csvPath of csvPaths) {
    const mapping = inferPanelLayerMapping(csvPath);
    const groupKey = mapping.panelLayerId
      ? mapping.panelLayerId
      : `unmapped::${slugifyFileName(csvPath)}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        ...mapping,
        sourceCsvPaths: [],
      });
    }

    groups.get(groupKey).sourceCsvPaths.push(csvPath);
  }

  return Array.from(groups.values()).sort((left, right) => {
    const leftKey = left.panelLayerId ?? left.sourceCsvPaths[0];
    const rightKey = right.panelLayerId ?? right.sourceCsvPaths[0];

    return leftKey.localeCompare(rightKey);
  });
}

async function writeAggregatedGroup(group, jsonDir, partitionDir, options) {
  let fileHandle;
  let initialized = false;
  let outputPath = "";
  let territory = "";
  let baseTemplates = null;
  let hasYear = false;
  const conversions = [];
  const classColumnsBySource = [];
  const skipped = [];
  const partitionFiles = [];
  const writtenPartitions = new Set();
  const yearKeys = new Set();

  try {
    for (const csvPath of group.sourceCsvPaths.sort((left, right) =>
      left.localeCompare(right),
    )) {
      let conversion;

      try {
        conversion = await convertCsvFile(csvPath);
      } catch (error) {
        skipped.push({
          inputPath: path.relative(process.cwd(), csvPath),
          reason: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      const sortedTemplates = sortRecordEntries(conversion.imageData.templates);

      if (!initialized) {
        territory = conversion.territory;
        baseTemplates = sortedTemplates;
        initialized = true;

        if (options.writeAggregates) {
          outputPath = path.join(
            jsonDir,
            getAggregatedOutputFileName({
              ...group,
              territory,
            }),
          );
          fileHandle = await open(outputPath, "w");
          await fileHandle.write("{\n");
          await fileHandle.write(
            `  "templates": ${indentJson(JSON.stringify(baseTemplates, null, 2), 2)},\n`,
          );
          await fileHandle.write('  "years": {\n');
        }
      } else {
        if (conversion.territory !== territory) {
          throw new Error(
            `Território divergente ao agregar ${conversion.inputPath}: ${conversion.territory} / ${territory}`,
          );
        }

        assertSameRecord(baseTemplates, sortedTemplates, "templates", conversion.inputPath);
      }

      if (options.writeAggregates && fileHandle) {
        for (const [yearKey, yearEntry] of Object.entries(conversion.imageData.years)) {
          if (yearKeys.has(yearKey)) {
            throw new Error(
              `Ano/referência duplicado ao agregar ${conversion.inputPath}: ${yearKey}`,
            );
          }

          yearKeys.add(yearKey);
          await fileHandle.write(
            `${hasYear ? ",\n" : ""}    ${JSON.stringify(yearKey)}: ${indentJson(
              JSON.stringify(yearEntry, null, 2),
              4,
            )}`,
          );
          hasYear = true;
        }
      }

      conversions.push(toReportConversion(conversion));
      classColumnsBySource.push({
        sourceCsvPath: conversion.inputPath,
        classColumns: conversion.classColumns,
      });
      partitionFiles.push(
        ...(await writeAnnualPartitions(
          conversion,
          group,
          partitionDir,
          writtenPartitions,
          options,
        )),
      );
    }

    if (!fileHandle) {
      return {
        conversions,
        aggregatedFile: null,
        partitionFiles,
        skipped,
      };
    }

    await fileHandle.write("\n  }\n}\n");
    await fileHandle.close();

    return {
      conversions,
      skipped,
      partitionFiles,
      aggregatedFile: {
        panelLayerId: group.panelLayerId,
        layerKey: group.layerKey,
        layerLabel: group.layerLabel,
        territory,
        outputPath: path.relative(process.cwd(), outputPath),
        sourceCsvPaths: conversions.map((conversion) => conversion.inputPath),
        classColumnsBySource,
        locationCount: Object.keys(baseLocations).length,
        yearKeys: Array.from(yearKeys).sort(),
      },
    };
  } catch (error) {
    if (fileHandle) {
      await fileHandle.close();
    }

    throw error;
  }
}

function buildMunicipalAnalysisManifest(aggregatedFiles, partitionFiles) {
  return {
    generatedAt: new Date().toISOString(),
    mappingRules: PANEL_LAYER_RULES.map((rule) => ({
      key: rule.key,
      label: rule.label,
      panelLayerId: rule.panelLayerId,
      patterns: rule.patterns.map((pattern) => pattern.source),
    })),
    mapped: aggregatedFiles
      .filter((conversion) => conversion.panelLayerId)
      .map((conversion) => ({
        panelLayerId: conversion.panelLayerId,
        layerKey: conversion.layerKey,
        layerLabel: conversion.layerLabel,
        territory: conversion.territory,
        imageDataPath: conversion.outputPath,
        sourceCsvPaths: conversion.sourceCsvPaths,
        yearKeys: conversion.yearKeys,
        locationCount: conversion.locationCount,
      })),
    unmapped: aggregatedFiles
      .filter((conversion) => !conversion.panelLayerId)
      .map((conversion) => ({
        territory: conversion.territory,
        imageDataPath: conversion.outputPath,
        sourceCsvPaths: conversion.sourceCsvPaths,
        yearKeys: conversion.yearKeys,
        locationCount: conversion.locationCount,
      })),
    partitions: partitionFiles
      .filter((partition) => partition.panelLayerId)
      .map((partition) => ({
        panelLayerId: partition.panelLayerId,
        layerKey: partition.layerKey,
        layerLabel: partition.layerLabel,
        territory: partition.territory,
        partitionKey: partition.partitionKey,
        calendarYear: partition.calendarYear,
        imageDataPath: partition.outputPath,
        sourceCsvPath: partition.sourceCsvPath,
        yearKeys: partition.yearKeys,
        locationCount: partition.locationCount,
        encoding: partition.encoding,
        rawBytes: partition.rawBytes,
        outputBytes: partition.outputBytes,
        ...(partition.splitReason ? { splitReason: partition.splitReason } : {}),
      })),
    unmappedPartitions: partitionFiles
      .filter((partition) => !partition.panelLayerId)
      .map((partition) => ({
        territory: partition.territory,
        partitionKey: partition.partitionKey,
        calendarYear: partition.calendarYear,
        imageDataPath: partition.outputPath,
        sourceCsvPath: partition.sourceCsvPath,
        yearKeys: partition.yearKeys,
        locationCount: partition.locationCount,
        encoding: partition.encoding,
        rawBytes: partition.rawBytes,
        outputBytes: partition.outputBytes,
        ...(partition.splitReason ? { splitReason: partition.splitReason } : {}),
      })),
  };
}

function toReportConversion(conversion) {
  const reportConversion = { ...conversion };
  delete reportConversion.imageData;

  return reportConversion;
}

async function convertCsvDirectory(options) {
  const csvDir = resolveWorkspacePath(options.csvDir);
  const jsonDir = resolveWorkspacePath(options.jsonDir);
  await mkdir(jsonDir, { recursive: true });

  const entries = await readdir(csvDir, { withFileTypes: true });
  const csvPaths = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv"))
    .map((entry) => path.join(csvDir, entry.name))
    .sort((left, right) => left.localeCompare(right));

  if (csvPaths.length === 0) {
    throw new Error(`Nenhum CSV encontrado em ${path.relative(process.cwd(), csvDir)}.`);
  }

  const conversions = [];
  const skipped = [];
  const aggregatedFiles = [];
  const partitionFiles = [];

  await cleanGeneratedImageDataFiles(jsonDir);
  const partitionDir = await cleanGeneratedPartitionFiles(jsonDir);

  for (const group of groupCsvPaths(csvPaths)) {
    try {
      const result = await writeAggregatedGroup(group, jsonDir, partitionDir, options);
      conversions.push(...result.conversions);
      skipped.push(...result.skipped);
      partitionFiles.push(...result.partitionFiles);

      if (result.aggregatedFile) {
        aggregatedFiles.push(result.aggregatedFile);
      }
    } catch (error) {
      skipped.push({
        inputPath: group.sourceCsvPaths
          .map((csvPath) => path.relative(process.cwd(), csvPath))
          .join(", "),
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { aggregatedFiles, conversions, partitionFiles, skipped };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const downloads = options.skipDownload ? [] : await downloadCsvFiles(options);
  const { aggregatedFiles, conversions, partitionFiles, skipped } =
    await convertCsvDirectory(options);
  const municipalAnalysisManifest = buildMunicipalAnalysisManifest(
    aggregatedFiles,
    partitionFiles,
  );
  const report = {
    csvDir: options.csvDir,
    jsonDir: options.jsonDir,
    downloadedFiles: downloads.length,
    convertedFiles: conversions.length,
    skippedFiles: skipped.length,
    mappedSourceFiles: conversions.filter((conversion) => conversion.panelLayerId).length,
    unmappedSourceFiles: conversions.filter((conversion) => !conversion.panelLayerId).length,
    aggregatedFiles: aggregatedFiles.length,
    mappedAggregatedFiles: municipalAnalysisManifest.mapped.length,
    unmappedAggregatedFiles: municipalAnalysisManifest.unmapped.length,
    partitionFiles: partitionFiles.length,
    mappedPartitionFiles: municipalAnalysisManifest.partitions.length,
    unmappedPartitionFiles: municipalAnalysisManifest.unmappedPartitions.length,
    downloads,
    conversions,
    aggregatedFilesDetails: aggregatedFiles,
    partitionFilesDetails: partitionFiles,
    skipped,
  };

  await mkdir(resolveWorkspacePath(options.jsonDir), { recursive: true });
  await writeFile(
    path.join(resolveWorkspacePath(options.jsonDir), "municipal-analysis-manifest.json"),
    `${JSON.stringify(municipalAnalysisManifest, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(resolveWorkspacePath(options.jsonDir), "conversion-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
