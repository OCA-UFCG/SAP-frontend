function compareClassColumns(left, right) {
  return getClassColumnIndex(left) - getClassColumnIndex(right);
}

function getClassColumnIndex(column) {
  const match = column.match(/_(\d+)$/u);

  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function toNumber(value, context) {
  const normalized = String(value).trim().replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor numérico inválido em ${context}: ${value}`);
  }

  return parsed;
}

export function getClassColumns(rows) {
  const columns = Object.keys(rows[0] ?? {});
  const percentColumns = columns
    .filter((column) => /^perc_classe_\d+$/iu.test(column))
    .sort(compareClassColumns);

  if (percentColumns.length > 0) {
    return { type: "percent", columns: percentColumns };
  }

  const valueColumns = columns
    .filter((column) => /^valor_classe_\d+$/iu.test(column))
    .sort(compareClassColumns);

  if (valueColumns.length > 0) {
    return { type: "value", columns: valueColumns };
  }

  const areaColumns = columns
    .filter((column) => /^area_ha_classe_\d+$/iu.test(column))
    .sort(compareClassColumns);

  if (areaColumns.length > 0 && columns.includes("area_total_ha")) {
    return { type: "area", columns: areaColumns };
  }

  throw new Error(
    "CSV sem colunas de classe. Esperado perc_classe_N, valor_classe_N ou area_ha_classe_N + area_total_ha.",
  );
}

export function getClassValues(row, classColumns, locationKey, yearKey) {
  if (classColumns.type === "percent" || classColumns.type === "value") {
    return classColumns.columns.map((column) =>
      toNumber(row[column], `${locationKey}/${yearKey}/${column}`),
    );
  }

  const totalArea = toNumber(
    row.area_total_ha,
    `${locationKey}/${yearKey}/area_total_ha`,
  );

  if (totalArea <= 0) {
    return classColumns.columns.map(() => 0);
  }

  return classColumns.columns.map((column) =>
    Number(
      (
        (toNumber(row[column], `${locationKey}/${yearKey}/${column}`) /
          totalArea) *
        100
      ).toFixed(10),
    ),
  );
}
