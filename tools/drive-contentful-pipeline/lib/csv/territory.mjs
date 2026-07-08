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

const MULTILEVEL_TERRITORIES = new Set([
  "1_BR",
  "2_Regiao",
  "3_Bioma",
  "4_ASD",
  "5_Semiarido",
  "6_Estado",
  "7_Municipio",
]);

function normalizeBlank(value) {
  const normalized = String(value ?? "").trim();

  return normalized && normalized !== "---" ? normalized : "";
}

function slugifyLocation(value) {
  return normalizeBlank(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

function firstPresent(...values) {
  return values.map(normalizeBlank).find(Boolean) ?? "";
}

function getStateCode(row) {
  const uf = normalizeBlank(row.SIGLA_UF).toLowerCase();

  if (uf) return uf;

  const stateName = normalizeBlank(row.NM_UF ?? row.NOME_UF ?? row.UF);
  const matchedState = Object.entries(STATE_NAMES).find(
    ([, name]) => name.toLowerCase() === stateName.toLowerCase(),
  );

  return matchedState?.[0] ?? "";
}

export function isMultilevelTerritoryRow(row) {
  return MULTILEVEL_TERRITORIES.has(normalizeBlank(row.NIVEL_AGRUPAMENTO));
}

export function inferTerritory(row) {
  if (isMultilevelTerritoryRow(row)) {
    return "multilevel";
  }

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

export function getLocation(row, territory) {
  if (territory === "multilevel") {
    return getMultilevelLocation(row);
  }

  if (territory === "municipality") {
    return {
      key: String(row.CD_MUN).trim(),
      label: `${String(row.NM_MUN).trim()} - ${String(row.SIGLA_UF).trim().toUpperCase()}`,
    };
  }

  const uf = String(row.SIGLA_UF).trim().toLowerCase();
  const stateName =
    String(row.NM_UF ?? row.NOME_UF ?? "").trim() ||
    STATE_NAMES[uf] ||
    uf.toUpperCase();

  return { key: uf, label: stateName };
}

export function getMultilevelLocation(row) {
  const level = normalizeBlank(row.NIVEL_AGRUPAMENTO);
  const name = normalizeBlank(row.NOME_LOCAL);

  if (level === "1_BR") {
    return { key: "br", label: "Brasil" };
  }

  if (level === "6_Estado") {
    const key = getStateCode(row);

    if (!key) {
      throw new Error(
        `Linha multinível de estado sem UF: ${JSON.stringify(row)}`,
      );
    }

    return {
      key,
      label: STATE_NAMES[key] || name || key.toUpperCase(),
    };
  }

  if (level === "7_Municipio") {
    const key = normalizeBlank(row.CD_MUN);
    const uf = getStateCode(row).toUpperCase();

    if (!key) {
      throw new Error(
        `Linha multinível de município sem CD_MUN: ${JSON.stringify(row)}`,
      );
    }

    return { key, label: uf ? `${name} - ${uf}` : name };
  }

  const groupedName = firstPresent(
    row.NM_REGIAO,
    row.BIOMA_PRED,
    row.ASD_ENTORN,
    row["SEMIÁRIDO"],
    name,
  );
  const groupedKey = slugifyLocation(groupedName);

  if (!groupedKey) {
    throw new Error(`Linha multinível sem localidade: ${JSON.stringify(row)}`);
  }

  return {
    key: `${level.toLowerCase()}-${groupedKey}`,
    label: name || groupedName,
  };
}

export function getMultilevelPanelLayerLocation(row) {
  const level = normalizeBlank(row.NIVEL_AGRUPAMENTO);

  if (level !== "1_BR" && level !== "6_Estado") return null;

  return getMultilevelLocation(row);
}

export function getPanelLayerLocation(row) {
  const key = String(row.location_key ?? "")
    .trim()
    .toLowerCase();
  const providedLabel = String(row.location_name ?? "").trim();
  const label =
    key === "br"
      ? "Brasil"
      : STATE_NAMES[key] || providedLabel || key.toUpperCase();

  if (!key) {
    throw new Error(`Linha sem location_key: ${JSON.stringify(row)}`);
  }

  return { key, label };
}

export { STATE_NAMES };
