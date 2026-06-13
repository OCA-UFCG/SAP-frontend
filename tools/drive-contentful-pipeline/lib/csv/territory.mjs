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

export function inferTerritory(row) {
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
