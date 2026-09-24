import {
  LAYER_SUBGROUPS,
  type LayerSubgroupDefinition,
} from "@/config/layerSubgroups";

export interface LayerSubgroup<T> {
  key: string;
  items: T[];
}

/** Os índices de uma categoria: os soltos primeiro, os subgrupos no fim. */
export interface SubgroupedItems<T> {
  items: T[];
  subgroups: LayerSubgroup<T>[];
}

function normalizeLabel(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function matchesSubgroup(
  definition: LayerSubgroupDefinition,
  name: string,
): boolean {
  const normalizedName = normalizeLabel(name);
  return definition.namePrefixes.some((prefix) =>
    normalizedName.startsWith(normalizeLabel(prefix)),
  );
}

/**
 * Separa os índices de uma categoria entre os soltos e os subgrupos definidos
 * em `LAYER_SUBGROUPS`. A ordem relativa dentro de cada parte é preservada, e
 * um subgrupo sem índices não aparece.
 *
 * @example
 * splitIntoLayerSubgroups("Dados Climáticos", layers, (layer) => layer.name);
 * // { items: [monitorDeSecas, ...], subgroups: [{ key: "forecast", items: [...] }] }
 */
export function splitIntoLayerSubgroups<T>(
  category: string,
  items: readonly T[],
  getName: (item: T) => string,
  definitions: readonly LayerSubgroupDefinition[] = LAYER_SUBGROUPS,
): SubgroupedItems<T> {
  const normalizedCategory = normalizeLabel(category);
  const applicable = definitions.filter(
    (definition) =>
      normalizeLabel(definition.parentCategory) === normalizedCategory,
  );
  const buckets = new Map(
    applicable.map((definition) => [definition.key, [] as T[]]),
  );
  const loose: T[] = [];

  for (const item of items) {
    const definition = applicable.find((candidate) =>
      matchesSubgroup(candidate, getName(item)),
    );
    if (definition) buckets.get(definition.key)?.push(item);
    else loose.push(item);
  }

  const subgroups = [...buckets]
    .filter(([, bucket]) => bucket.length > 0)
    .map(([key, bucket]) => ({ key, items: bucket }));

  return { items: loose, subgroups };
}

/**
 * A ordem visual de uma categoria subagrupada, achatada: os soltos e depois
 * cada subgrupo. É a ordem que o relatório usa para as seções.
 *
 * @example
 * flattenLayerSubgroups({ items: [a], subgroups: [{ key: "forecast", items: [b] }] }); // [a, b]
 */
export function flattenLayerSubgroups<T>(grouped: SubgroupedItems<T>): T[] {
  return [
    ...grouped.items,
    ...grouped.subgroups.flatMap((subgroup) => subgroup.items),
  ];
}
