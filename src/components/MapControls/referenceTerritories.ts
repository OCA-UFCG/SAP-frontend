import type { ReferenceLayerId } from "@/components/MapLayerContext/mapLayerState";

/**
 * A lista que a busca de Territórios usa, gerada por
 * `scripts/build-reference-territories.mjs` a partir dos assets do Earth Engine.
 * Fica fora do bundle porque passa de 300 KB: só é baixada quando alguém usa a
 * busca.
 */
export const REFERENCE_TERRITORIES_URL = "/data/reference-territories.json";

/** [camada, nome, UF, município, oeste, sul, leste, norte] — o formato do arquivo. */
type ReferenceTerritoryRow = [
  number,
  string,
  string,
  string,
  number,
  number,
  number,
  number,
];

interface ReferenceTerritoriesFile {
  layers: ReferenceLayerId[];
  territories: ReferenceTerritoryRow[];
}

export type TerritoryBounds = [number, number, number, number];

export interface ReferenceTerritory {
  layerId: ReferenceLayerId;
  name: string;
  uf: string;
  municipality: string;
  /** [oeste, sul, leste, norte] — o retângulo que contém o território. */
  bounds: TerritoryBounds;
  /** Nome e município sem acento nem maiúscula, para comparar com a busca. */
  searchText: string;
  normalizedName: string;
}

/** Sem acento, minúsculo e com espaços simples — "Lagoa  Grande" vira "lagoa grande". */
export function normalizeTerritorySearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function parseReferenceTerritories(
  file: ReferenceTerritoriesFile,
): ReferenceTerritory[] {
  return file.territories.map(
    ([layerIndex, name, uf, municipality, west, south, east, north]) => {
      const normalizedName = normalizeTerritorySearch(name);
      return {
        layerId: file.layers[layerIndex],
        name,
        uf,
        municipality,
        bounds: [west, south, east, north],
        normalizedName,
        searchText: `${normalizedName} ${normalizeTerritorySearch(municipality)}`,
      };
    },
  );
}

let territoriesPromise: Promise<ReferenceTerritory[]> | null = null;

/** Baixa a lista uma vez por sessão; uma falha libera a próxima tentativa. */
export function loadReferenceTerritories(): Promise<ReferenceTerritory[]> {
  territoriesPromise ??= fetch(REFERENCE_TERRITORIES_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Territories request failed with ${response.status}`);
      }
      return response.json() as Promise<ReferenceTerritoriesFile>;
    })
    .then(parseReferenceTerritories)
    .catch((error) => {
      territoriesPromise = null;
      throw error;
    });

  return territoriesPromise;
}

const MIN_QUERY_LENGTH = 2;

/**
 * Os territórios que têm todas as palavras digitadas no nome ou no município,
 * com quem começa pelo que foi digitado na frente.
 *
 * @example
 * searchReferenceTerritories(territories, "kiriri") // [{ name: "Kiriri", ... }]
 */
export function searchReferenceTerritories(
  territories: readonly ReferenceTerritory[],
  query: string,
  limit = 8,
): ReferenceTerritory[] {
  const normalizedQuery = normalizeTerritorySearch(query);
  if (normalizedQuery.length < MIN_QUERY_LENGTH) return [];

  const words = normalizedQuery.split(" ");
  const rank = (territory: ReferenceTerritory) => {
    if (territory.normalizedName.startsWith(normalizedQuery)) return 0;
    if (territory.normalizedName.includes(normalizedQuery)) return 1;
    return 2;
  };

  return territories
    .filter((territory) =>
      words.every((word) => territory.searchText.includes(word)),
    )
    .map((territory) => ({ territory, rank: rank(territory) }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        a.territory.name.length - b.territory.name.length ||
        a.territory.name.localeCompare(b.territory.name, "pt-BR"),
    )
    .slice(0, limit)
    .map(({ territory }) => territory);
}
