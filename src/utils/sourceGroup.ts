import type { PanelLayerSourceGroup } from "@/contracts/panelLayerSourceGroup";

/**
 * O mesmo índice calculado com bases diferentes aparece no Monitoramento como
 * um cartão só, e o Detalhamento troca a fonte (`PanelLayerSourceGroup`). Este
 * módulo decide quem está junto: os índices com o mesmo nome de grupo, na
 * ordem em que chegam. Um grupo com um índice só não junta nada, e o índice
 * continua com o cartão e o nome dele.
 */

export interface SourceGroupMember<T> extends PanelLayerSourceGroup {
  item: T;
}

/** "Índice de Aridez" e "indice de aridez " são o mesmo grupo. */
function normalizeGroupName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function isSameSourceGroup(left: string, right: string): boolean {
  return normalizeGroupName(left) === normalizeGroupName(right);
}

/**
 * Os grupos com pelo menos dois índices, cada um na ordem dos itens recebidos.
 *
 * @example
 * groupBySource(panelLayers, (layer) => layer.sourceGroup);
 * // [[{ group: "Índice de Aridez", source: "BR-DWGD", item: brDwgd },
 * //   { group: "Índice de Aridez", source: "ERA5 Land", item: era5Land }]]
 */
export function groupBySource<T>(
  items: readonly T[],
  getSourceGroup: (item: T) => PanelLayerSourceGroup | null | undefined,
): SourceGroupMember<T>[][] {
  const groups = new Map<string, SourceGroupMember<T>[]>();

  for (const item of items) {
    const sourceGroup = getSourceGroup(item);
    if (!sourceGroup) continue;

    const key = normalizeGroupName(sourceGroup.group);
    const members = groups.get(key) ?? [];
    members.push({ ...sourceGroup, item });
    groups.set(key, members);
  }

  return [...groups.values()].filter((members) => members.length > 1);
}
