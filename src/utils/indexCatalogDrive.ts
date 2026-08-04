import type {
  DriveFileInspection,
  DriveSourceRole,
} from "@/types/indexCatalog";

type CsvRow = Record<string, string>;

function getColumns(row: CsvRow | undefined) {
  return Object.keys(row ?? {});
}

export function getCatalogClassColumns(columns: readonly string[]) {
  const candidates = [
    ...columns.filter((column) => /^perc_classe_\d+$/iu.test(column)),
    ...columns.filter((column) => /^valor_classe_\d+$/iu.test(column)),
  ];

  if (candidates.length === 0 && columns.includes("area_total_ha")) {
    candidates.push(
      ...columns.filter((column) => /^area_ha_classe_\d+$/iu.test(column)),
    );
  }

  return candidates.sort((left, right) => {
    const leftIndex = Number(left.match(/_(\d+)$/u)?.[1] ?? Infinity);
    const rightIndex = Number(right.match(/_(\d+)$/u)?.[1] ?? Infinity);
    return leftIndex - rightIndex;
  });
}

export function inferCatalogDriveRole(
  columns: readonly string[],
): DriveSourceRole {
  if (columns.includes("NIVEL_AGRUPAMENTO") && columns.includes("NOME_LOCAL")) {
    return "multilevel";
  }

  if (columns.includes("location_key") && columns.includes("location_name")) {
    return "panel";
  }

  if (
    columns.includes("CD_MUN") &&
    columns.includes("NM_MUN") &&
    columns.includes("SIGLA_UF")
  ) {
    return "municipal";
  }

  if (
    columns.includes("SIGLA_UF") &&
    columns.some((column) =>
      ["NM_UF", "NOME_UF", "UF", "CD_UF"].includes(column),
    )
  ) {
    return "state";
  }

  return "unsupported";
}

export function getCatalogRowPeriod(row: CsvRow) {
  const date = String(row.data_img ?? row.DATA_IMG ?? row.date ?? "").trim();
  const dateMatch = date.match(/^(\d{4})-(\d{2})-\d{2}$/u);

  if (dateMatch) {
    return `${dateMatch[1]}-${dateMatch[2]}`;
  }

  const year = String(row.ano ?? row.ANO ?? row.year ?? "").trim();
  if (/^\d{4}(?:-\d{2})?$/u.test(year)) {
    return year;
  }

  return null;
}

export function inspectCatalogCsvRows(rows: CsvRow[]): DriveFileInspection {
  const columns = getColumns(rows[0]);
  const classColumns = getCatalogClassColumns(columns);
  const role = inferCatalogDriveRole(columns);
  const periods = [
    ...new Set(rows.flatMap((row) => getCatalogRowPeriod(row) ?? [])),
  ].sort();
  const warnings: string[] = [];

  if (role === "unsupported") {
    warnings.push("Formato territorial não reconhecido pela pipeline.");
  }
  if (classColumns.length === 0) {
    warnings.push("Nenhuma coluna de classe reconhecida.");
  }
  if (periods.length === 0) {
    warnings.push("Nenhum período reconhecido.");
  }

  return {
    role,
    columns,
    periods,
    classColumns,
    warnings,
  };
}
