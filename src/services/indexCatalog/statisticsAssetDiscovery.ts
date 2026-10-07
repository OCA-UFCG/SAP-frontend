import "server-only";

import type { GeeStatisticsAssetSource } from "@/contracts/geeStatisticsAsset";
import {
  inspectEarthEngineAsset,
  listEarthEngineAssets,
} from "@/app/api/ee/services";

export interface StatisticsAssetCandidate {
  id: string;
  /**
   * Só o que entra no `sourceRevision` do índice publicado. Mantido igual ao
   * que a versão anterior gravava, para uma prévia validada antes desta
   * mudança continuar passando na conferência de impressão digital da
   * publicação.
   */
  updateTime?: string;
  /** Carimbo de revisão usado apenas como chave da memoização. */
  revision?: string;
}

/**
 * O padrão de nome que um template de asset descreve, para reconhecer os irmãos
 * dele no mesmo diretório.
 *
 * templatePattern("projects/x/assets/estat_{year}"); // /^projects\/x\/assets\/estat_\d{4}$/
 */
export function templatePattern(template: string) {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `^${escaped
      .replaceAll("\\{year\\}", "\\d{4}")
      .replaceAll("\\{month\\}", "(?:0[1-9]|1[0-2])")
      .replaceAll("\\{period\\}", "\\d{4}(?:-(?:0[1-9]|1[0-2]))?")}$`,
    "u",
  );
}

/**
 * As FeatureCollections que uma fonte estatística cobre, com o carimbo de
 * revisão de cada uma.
 *
 * Vale para as duas formas de tabela — distribuição por classes e valor único
 * por município —, porque as duas endereçam o asset do mesmo jeito.
 */
export async function getStatisticsAssetIds(
  asset: GeeStatisticsAssetSource,
): Promise<StatisticsAssetCandidate[]> {
  if (asset.type === "fixed") {
    // O tipo do asset é conferido aqui porque, ao contrário do caminho por
    // template, não existe listagem que já garanta que ele é uma tabela.
    const assetId = asset.assetId;
    const inspection = await inspectEarthEngineAsset(assetId);
    if (inspection.type !== "featureCollection") {
      throw new Error(
        `O asset estatístico ${assetId} é ${inspection.type}; esperado FeatureCollection.`,
      );
    }
    return [
      {
        id: assetId,
        updateTime: inspection.updateTime,
        // O `getAsset` não devolve `updateTime` em nenhum asset que medimos, e
        // sem carimbo a memoização nunca engatava num asset fixo. O `version`
        // vem sempre, e é o mesmo instante em microssegundos.
        revision: inspection.updateTime ?? inspection.version,
      },
    ];
  }

  const template = asset.assetIdTemplate;
  const separator = template.lastIndexOf("/");
  if (separator < 1) {
    throw new Error("O template estatístico precisa ter um diretório-pai.");
  }
  const parent = template.slice(0, separator);
  const pattern = templatePattern(template);
  const assets = (await listEarthEngineAssets(parent)).filter(
    (item) => pattern.test(item.id) && item.type.toUpperCase() === "TABLE",
  );
  if (assets.length === 0) {
    throw new Error(
      `Nenhuma FeatureCollection corresponde ao template ${template}.`,
    );
  }
  // A listagem do diretório-pai já respondeu o tipo e o `updateTime` de todas
  // as tabelas de uma vez. Um `getAsset` por tabela só repetiria isso: eram
  // 35 idas e voltas (39 s medidos) sem nenhuma garantia nova.
  return assets.map(({ id, updateTime }) => ({
    id,
    updateTime,
    revision: updateTime,
  }));
}

const PLACEHOLDER_GROUPS: Record<string, string> = {
  "\\{year\\}": "(?<year>\\d{4})",
  "\\{month\\}": "(?<month>0[1-9]|1[0-2])",
  "\\{period\\}": "(?<period>\\d{4}(?:-(?:0[1-9]|1[0-2]))?)",
};

/**
 * O período que o nome de um asset carrega, segundo o template que o descreve.
 *
 * É o que permite dizer "a pasta tem 2026 e o índice publicado não" sem ler
 * nenhuma tabela: o período está no próprio nome do asset, e a listagem do
 * diretório já o trouxe.
 *
 * periodFromAssetId("projects/x/assets/estat_{year}", "projects/x/assets/estat_2026"); // "2026"
 */
export function periodFromAssetId(template: string, assetId: string) {
  let pattern = template.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  for (const [placeholder, group] of Object.entries(PLACEHOLDER_GROUPS)) {
    pattern = pattern.replaceAll(placeholder, group);
  }
  const groups = new RegExp(`^${pattern}$`, "u").exec(assetId)?.groups;
  if (!groups) return null;
  if (groups.period) return groups.period;
  if (!groups.year) return null;
  return groups.month ? `${groups.year}-${groups.month}` : groups.year;
}
