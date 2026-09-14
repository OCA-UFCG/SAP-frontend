import "server-only";

import type { AmfeSheetColumnStatisticsSource } from "@/contracts/amfeSheetColumn";
import {
  buildAmfeSheetValueRows,
  parseAmfeSheetTable,
  type AmfeSheetTable,
} from "@/repositories/platform/amfeSheetTable";
import { mapMunicipalValueRows } from "@/repositories/platform/geeMunicipalValueTable";
import type { CompactTerritorialAnalysisDatasetPatch } from "@/utils/municipalAnalysisMerge";

/**
 * A planilha que a análise multicritério lê. Os mesmos valores padrão do
 * backend (`app/services/dataset/fetching.py`): as duas aplicações precisam
 * apontar para a mesma planilha, senão o mesmo critério mostraria números
 * diferentes em Monitoramento e em Análise.
 */
const DEFAULT_SPREADSHEET_ID = "1XQjSM5PUqtsG2KcSciKCNmNF8xTc_6EnUVaiWLHi4RI";
const DEFAULT_DATA_TAB = "ia_spei_deg_pobrural";
const DEFAULT_METADATA_TAB = "criterios";

// A aba de metadados tem uma linha de título antes do cabeçalho — é assim que o
// backend a lê (`header=1` no pandas).
const METADATA_HEADER_ROW_OFFSET = 1;

const CACHE_TTL_MS = 1000 * 60 * 10;

export interface AmfeSheetDependencies {
  fetchWorkbook?: (url: string) => Promise<ArrayBuffer>;
  now?: () => number;
}

interface CachedSheet {
  table: AmfeSheetTable;
  loadedAt: number;
}

let cachedSheet: CachedSheet | null = null;
// Uma leitura em voo por processo: a planilha é uma só, e abrir o catálogo
// dispara a lista de colunas enquanto o painel pode estar pedindo valores. Sem
// o dedupe, cada pedido baixaria os ~900 KB do arquivo por conta própria.
let pendingSheet: Promise<AmfeSheetTable> | null = null;

function resolveSpreadsheetExportUrl(): string {
  const spreadsheetId =
    process.env.AMFE_SPREADSHEET_ID?.trim() || DEFAULT_SPREADSHEET_ID;
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
}

async function downloadWorkbook(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url, { redirect: "follow" });

  if (!response.ok) {
    throw new Error(
      `Falha ao baixar a planilha da análise multicritério (${response.status}): ${url}`,
    );
  }

  return response.arrayBuffer();
}

function requireSheet(
  sheetNames: readonly string[],
  name: string,
  role: string,
) {
  if (sheetNames.includes(name)) return name;

  throw new Error(
    `A planilha não tem a aba de ${role} "${name}". Abas encontradas: ${sheetNames.join(", ") || "(nenhuma)"}.`,
  );
}

async function readSheetTable(
  dependencies: AmfeSheetDependencies,
): Promise<AmfeSheetTable> {
  const url = resolveSpreadsheetExportUrl();
  const workbookBytes = await (dependencies.fetchWorkbook ?? downloadWorkbook)(
    url,
  );
  // Import dinâmico: o `xlsx` passa de 1 MB e só as rotas da planilha precisam
  // dele — um import estático o colocaria no grafo de qualquer rota do servidor.
  const { read, utils } = await import("xlsx");
  const workbook = read(workbookBytes, { type: "array" });

  const dataTab = requireSheet(
    workbook.SheetNames,
    process.env.AMFE_SHEET_DATA_TAB?.trim() || DEFAULT_DATA_TAB,
    "dados",
  );
  const metadataTab = requireSheet(
    workbook.SheetNames,
    process.env.AMFE_SHEET_METADATA_TAB?.trim() || DEFAULT_METADATA_TAB,
    "metadados",
  );

  const table = parseAmfeSheetTable(
    utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[dataTab]),
    utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[metadataTab], {
      range: METADATA_HEADER_ROW_OFFSET,
    }),
  );

  if (table.municipalities.length === 0) {
    throw new Error(
      `A aba de dados "${dataTab}" não tem nenhuma linha municipal com CD_MUN válido.`,
    );
  }

  return table;
}

/**
 * A planilha da análise multicritério, lida no máximo uma vez a cada 10 minutos
 * por processo.
 *
 * Quando a releitura falha, o valor expirado continua servindo em vez de
 * derrubar a página: é o mesmo acordo das demais leituras da plataforma, e aqui
 * ele importa mais, porque a origem é um arquivo do Google Docs sobre o qual
 * esta aplicação não tem controle nenhum.
 *
 * @example
 * const { criteria } = await getAmfeSheetTable();
 */
export async function getAmfeSheetTable(
  dependencies: AmfeSheetDependencies = {},
): Promise<AmfeSheetTable> {
  const now = dependencies.now ?? Date.now;
  const cached = cachedSheet;

  if (cached && now() - cached.loadedAt <= CACHE_TTL_MS) {
    return cached.table;
  }

  if (pendingSheet) return pendingSheet;

  pendingSheet = readSheetTable(dependencies)
    .then((table) => {
      cachedSheet = { table, loadedAt: now() };
      return table;
    })
    .catch((error) => {
      if (cached) {
        console.warn(
          `[amfeSheet] falha ao reler a planilha; servindo o valor expirado: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return cached.table;
      }
      throw error;
    })
    .finally(() => {
      pendingSheet = null;
    });

  return pendingSheet;
}

function requireColumn(table: AmfeSheetTable, column: string) {
  const criterion = table.criteria.find(
    (candidate) => candidate.column === column,
  );

  if (!criterion) {
    throw new Error(
      `A planilha da análise multicritério não tem a coluna "${column}". Colunas disponíveis: ${table.criteria
        .map((candidate) => candidate.column)
        .join(", ")}.`,
    );
  }

  return criterion;
}

/**
 * O patch territorial de um período lido de uma coluna da planilha.
 *
 * A camada tem um período só — o `periodKey` da fonte —, então um pedido de
 * outro período devolve o recorte sem valores, e o painel mostra "sem dado" em
 * vez de repetir o número do único ano publicado.
 *
 * @example
 * await getAmfeSheetColumnYearPatch(source, "2024", "2507507");
 */
export async function getAmfeSheetColumnYearPatch(
  source: AmfeSheetColumnStatisticsSource,
  yearKey: string,
  locationKey: string,
  dependencies: AmfeSheetDependencies = {},
): Promise<CompactTerritorialAnalysisDatasetPatch> {
  const table = await getAmfeSheetTable(dependencies);
  requireColumn(table, source.column);

  if (yearKey !== source.periodKey) {
    return {
      locations: {},
      years: { [yearKey]: { valuesScale: 1, values: {} } },
    };
  }

  const rows = buildAmfeSheetValueRows(
    table,
    source.column,
    source.periodKey,
    source.aggregation,
  );

  return mapMunicipalValueRows(rows, yearKey, locationKey);
}

export function clearAmfeSheetCacheForTests() {
  cachedSheet = null;
  pendingSheet = null;
}
