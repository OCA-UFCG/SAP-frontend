import "server-only";

import type { GeeMunicipalValueTableStatisticsSource } from "@/contracts/geeMunicipalValueTable";
import { buildColumnDiagnosis } from "@/contracts/geeStatisticsColumns";
import { initializeGee } from "@/infrastructure/earth-engine/client";
import { readStatisticsAssetProperties } from "@/services/indexCatalog/statisticsAssetProbe";
import {
  readMunicipalValueTableProbes,
  type MunicipalValueTableProbe,
} from "@/services/indexCatalog/municipalValueTableProbe";
import { getStatisticsAssetIds } from "@/services/indexCatalog/statisticsAssetDiscovery";
import { resolveGeeStateCode } from "@/utils/geeStateCode";
import {
  resolveValueTablePeriodColumns,
  type ValueTablePeriodColumn,
} from "@/utils/municipalValueTablePeriods";

export interface DiscoveredMunicipalValueTable {
  assetId: string;
  updateTime?: string;
  columns: ValueTablePeriodColumn[];
  municipalityCount: number;
}

export interface MunicipalValueTableDiscovery {
  assets: DiscoveredMunicipalValueTable[];
  periods: string[];
  municipalityCount: number;
}

// Um limite de sanidade, não um número mágico: o Brasil tem 5.570 municípios, e
// uma tabela com dezenas de milhares de linhas é sinal de que ela não é
// municipal — provavelmente é a tabela multinível de outra forma de índice.
const MAX_MUNICIPAL_ROWS = 6000;

function validateStateColumn(
  source: GeeMunicipalValueTableStatisticsSource,
  assetId: string,
  stateValues: unknown[],
) {
  const unknownValues = stateValues.filter(
    (value) => !resolveGeeStateCode(value),
  );
  if (unknownValues.length > 0) {
    throw new Error(
      `A coluna de UF ${source.properties.stateCode} de ${assetId} tem valores que não são uma UF: ${unknownValues
        .slice(0, 5)
        .map((value) => String(value ?? "(vazio)"))
        .join(", ")}. Use a sigla (PB) ou o nome (Paraíba).`,
    );
  }
  if (stateValues.length < 2) {
    throw new Error(
      `A coluna de UF ${source.properties.stateCode} de ${assetId} tem uma UF só; o ranking nacional precisa das UFs de cada município.`,
    );
  }
}

function validateProbe(
  source: GeeMunicipalValueTableStatisticsSource,
  assetId: string,
  columns: ValueTablePeriodColumn[],
  probe: MunicipalValueTableProbe,
) {
  const { rowCount } = probe;
  if (!rowCount) {
    throw new Error(`A tabela ${assetId} não possui linhas.`);
  }
  if (rowCount > MAX_MUNICIPAL_ROWS) {
    throw new Error(
      `A tabela ${assetId} tem ${rowCount} linhas; uma tabela municipal tem no máximo ${MAX_MUNICIPAL_ROWS}. Confira se ela não é uma tabela multinível.`,
    );
  }
  if (probe.codedCount !== rowCount) {
    throw new Error(
      `A tabela ${assetId} tem ${rowCount - probe.codedCount} linha(s) sem código de município em ${source.properties.municipalityCode}.`,
    );
  }
  if (probe.distinctCodeCount !== rowCount) {
    throw new Error(
      `A tabela ${assetId} repete ${rowCount - probe.distinctCodeCount} município(s) em ${source.properties.municipalityCode}; é esperada uma linha por município.`,
    );
  }
  if (probe.namedCount !== rowCount) {
    throw new Error(
      `A tabela ${assetId} tem ${rowCount - probe.namedCount} linha(s) sem nome em ${source.properties.locationName}.`,
    );
  }
  validateStateColumn(source, assetId, probe.stateValues ?? []);

  // Um vazio numa coluna de período não afeta só aquele período: a agregação por
  // UF descarta a linha inteira, então o município some de todos os períodos e o
  // total do estado sai menor sem nenhum aviso.
  const incomplete = columns.filter(
    (_column, position) => probe.completeValueCounts?.[position] !== rowCount,
  );
  if (incomplete.length > 0) {
    throw new Error(
      `A tabela ${assetId} tem municípios sem valor nas colunas ${incomplete
        .map((column) => column.column)
        .slice(0, 5)
        .join(
          ", ",
        )}. Preencha com zero em vez de deixar vazio: um vazio derruba o município de todos os períodos na soma por UF.`,
    );
  }
}

/** O papel de cada coluna territorial, para o erro dizer o que ela deveria trazer. */
const TERRITORIAL_COLUMN_ROLES = [
  ["municipalityCode", "código do município"],
  ["locationName", "nome do município"],
  ["stateCode", "UF"],
] as const;

function findMissingTerritorialColumns(
  source: GeeMunicipalValueTableStatisticsSource,
  columnNames: readonly string[],
): string[] {
  const missing = TERRITORIAL_COLUMN_ROLES.filter(
    ([field]) => !columnNames.includes(source.properties[field]),
  ).map(([field, role]) => `${source.properties[field]} (${role})`);
  return missing.length > 0
    ? [`não tem estas colunas do mapeamento: ${missing.join(", ")}`]
    : [];
}

/**
 * Recusa uma tabela cujas colunas não servem para valor único por município.
 *
 * Junta a falta de coluna de período com a falta de coluna territorial numa
 * mensagem só porque um asset da outra forma de tabela falha nas duas, e são as
 * duas juntas que mostram que o errado foi escolher a forma, não o mapeamento.
 */
function assertValueTableColumns(
  source: GeeMunicipalValueTableStatisticsSource,
  assetId: string,
  columns: ValueTablePeriodColumn[],
  columnNames: readonly string[],
) {
  const problems = [
    ...(columns.length === 0
      ? [
          `não tem nenhuma coluna de período que corresponda a ${source.valueProperty}`,
        ]
      : []),
    ...findMissingTerritorialColumns(source, columnNames),
  ];
  if (problems.length === 0) return;

  throw new Error(
    buildColumnDiagnosis({ assetId, problems, columnNames, shape: "value" }),
  );
}

/**
 * Descobre os períodos e valida as tabelas municipais de valor único de um
 * índice.
 *
 * São duas idas ao Earth Engine para o conjunto todo, e não duas por tabela: uma
 * traz as colunas de cada asset — é delas que saem os períodos da tabela larga —
 * e a outra traz as contagens que dependem das colunas descobertas.
 *
 * @example
 * await discoverMunicipalValueTable(source);
 * // { periods: ["2012", ..., "2025"], municipalityCount: 5573, assets: [...] }
 */
export async function discoverMunicipalValueTable(
  source: GeeMunicipalValueTableStatisticsSource,
): Promise<MunicipalValueTableDiscovery> {
  await initializeGee();
  const candidates = await getStatisticsAssetIds(source.asset);
  const assetIds = candidates.map((candidate) => candidate.id);
  const propertiesByAsset = await readStatisticsAssetProperties(assetIds);

  const planned = candidates.map((candidate, index) => ({
    assetId: candidate.id,
    updateTime: candidate.updateTime,
    columns: resolveValueTablePeriodColumns(
      {
        assetId: candidate.id,
        assetIdTemplate:
          source.asset.type === "period-template"
            ? source.asset.assetIdTemplate
            : undefined,
      },
      source.valueProperty,
      source.periodGranularity,
      propertiesByAsset[index] ?? [],
    ),
  }));

  planned.forEach((asset, index) =>
    assertValueTableColumns(
      source,
      asset.assetId,
      asset.columns,
      propertiesByAsset[index] ?? [],
    ),
  );

  const probes = await readMunicipalValueTableProbes(
    source,
    planned.map((asset) => ({
      assetId: asset.assetId,
      valueColumns: asset.columns.map((column) => column.column),
    })),
  );

  const assets = planned.map((asset) => {
    const probe = probes.get(asset.assetId);
    if (!probe) {
      throw new Error(
        `O Earth Engine não devolveu a validação da tabela ${asset.assetId}.`,
      );
    }
    validateProbe(source, asset.assetId, asset.columns, probe);
    return { ...asset, municipalityCount: probe.rowCount };
  });

  const periodOwners = new Map<string, string>();
  for (const asset of assets) {
    for (const { periodKey } of asset.columns) {
      const owner = periodOwners.get(periodKey);
      if (owner && owner !== asset.assetId) {
        throw new Error(
          `O período ${periodKey} aparece em mais de uma tabela (${owner} e ${asset.assetId}).`,
        );
      }
      periodOwners.set(periodKey, asset.assetId);
    }
  }

  return {
    assets,
    periods: [...periodOwners.keys()].sort(),
    municipalityCount: Math.max(
      ...assets.map((asset) => asset.municipalityCount),
    ),
  };
}
