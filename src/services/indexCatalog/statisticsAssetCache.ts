import type {
  GeeStatisticsSchema,
  ResolvedGeeStatisticsSource,
} from "@/contracts/geeStatistics";

/** Resultado da validação de uma FeatureCollection estatística. */
export interface DiscoveredStatisticsAsset {
  assetId: string;
  updateTime?: string;
  schema: GeeStatisticsSchema;
  periods: string[];
  rowCount: number;
}

// Cada entrada guarda schema, períodos e contagem de um asset — algumas centenas
// de bytes. O teto existe para um processo longo não acumular assets que ninguém
// pede de novo, não por pressão de memória.
const MAX_ENTRIES = 200;

// Guardamos a promessa, não o valor: duas prévias simultâneas do mesmo rascunho
// compartilham uma validação em vez de disparar duas idas ao Earth Engine.
const validatedAssets = new Map<string, Promise<DiscoveredStatisticsAsset>>();

/**
 * Chave de memoização de um asset estatístico já validado, ou `undefined`
 * quando o asset não informa `updateTime`.
 *
 * Sem esse carimbo não há como saber que a tabela continua a mesma, e guardar o
 * resultado deixaria o catálogo cego a uma reexportação no Earth Engine. Nesse
 * caso é melhor revalidar sempre do que arriscar publicar dado velho.
 *
 * A chave inclui o mapeamento de propriedades porque a validação depende dele:
 * trocar qual coluna é a data muda os períodos descobertos no mesmo asset.
 *
 * @example
 * const key = buildStatisticsAssetKey(source, "2026-08-17T11:00:00Z");
 */
export function buildStatisticsAssetKey(
  source: ResolvedGeeStatisticsSource,
  updateTime?: string,
): string | undefined {
  if (!updateTime) return undefined;
  const properties = Object.entries(source.properties).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return JSON.stringify([
    source.assetId,
    updateTime,
    source.periodGranularity,
    properties,
  ]);
}

function markAsRecentlyUsed(
  key: string,
  entry: Promise<DiscoveredStatisticsAsset>,
) {
  validatedAssets.delete(key);
  validatedAssets.set(key, entry);
}

function evictLeastRecentlyUsed() {
  while (validatedAssets.size > MAX_ENTRIES) {
    const oldestKey = validatedAssets.keys().next().value;
    if (oldestKey === undefined) return;
    validatedAssets.delete(oldestKey);
  }
}

/**
 * Devolve a validação já feita deste asset nesta revisão, ou executa `validate`
 * e guarda o resultado. Uma validação que falha não fica guardada.
 *
 * @example
 * const asset = await getOrValidateStatisticsAsset(key, () => validateAsset(source));
 */
export function getOrValidateStatisticsAsset(
  key: string | undefined,
  validate: () => Promise<DiscoveredStatisticsAsset>,
): Promise<DiscoveredStatisticsAsset> {
  if (!key) return validate();

  const cached = validatedAssets.get(key);
  if (cached) {
    markAsRecentlyUsed(key, cached);
    return cached;
  }

  const pending = validate();
  validatedAssets.set(key, pending);
  evictLeastRecentlyUsed();
  return pending.catch((error) => {
    validatedAssets.delete(key);
    throw error;
  });
}

/**
 * Diz se esta revisão já está memoizada (ou em voo), sem executar nada.
 *
 * A descoberta usa isto para montar o lote: só as tabelas que ainda não estão
 * memoizadas entram no pedido ao Earth Engine. Sem essa consulta, um índice de
 * 35 anos em que só um ano mudou pediria as 35 tabelas outra vez, e a
 * memoização não economizaria nenhuma leitura.
 *
 * @example
 * const pendentes = planejadas.filter((item) => !isStatisticsAssetCached(item.key));
 */
export function isStatisticsAssetCached(key: string | undefined) {
  return Boolean(key && validatedAssets.has(key));
}

/** Esvazia a memoização. Usada pelos testes e por invalidações explícitas. */
export function clearStatisticsAssetCache() {
  validatedAssets.clear();
}
