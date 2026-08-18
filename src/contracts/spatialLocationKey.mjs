export const SPATIAL_LOCATION_NAMES = Object.freeze({
  asdAndSurroundings: "ASD + Entorno",
  semiarid: "Semiárido Total",
});

const SPATIAL_GROUP_LEVELS = new Set([
  "2_Regiao",
  "3_Bioma",
  "4_ASD",
  "5_Semiarido",
  "6_Estado",
]);

export function slugifySpatialLocationName(value) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

/**
 * Canonical key contract for aggregate rows in multilevel statistics CSVs.
 * The key is derived exclusively from NIVEL_AGRUPAMENTO + NOME_LOCAL.
 */
export function buildSpatialLocationKey(level, locationName) {
  const normalizedLevel = String(level ?? "").trim();

  if (!SPATIAL_GROUP_LEVELS.has(normalizedLevel)) {
    throw new Error(`Nível espacial agregado inválido: ${normalizedLevel}.`);
  }

  const locationSlug = slugifySpatialLocationName(locationName);

  if (!locationSlug) {
    throw new Error(
      `NOME_LOCAL obrigatório para o nível espacial ${normalizedLevel}.`,
    );
  }

  return `${normalizedLevel.toLowerCase()}-${locationSlug}`;
}
