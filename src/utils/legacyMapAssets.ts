import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";
import { canonicalJson } from "@/utils/canonicalJson";
import { getLegacyForecastLeadTime } from "@/utils/imageData";

/** O asset do Earth Engine que desenha o mapa de um período. */
export interface LegacyMapAssetRow {
  /** Chave do período dentro de `imageData.years`, como o mapa a pede. */
  period: string;
  imageId: string;
  /** Rótulo do período, quando a entry grava um diferente da chave. */
  year?: string;
}

export interface LegacyMapAssets {
  rows: LegacyMapAssetRow[];
  /**
   * O mesmo asset em todos os períodos. Metade dos legados é assim — um único
   * asset com uma coluna por ano —, e para eles a tela mostra um campo só em
   * vez de repetir a mesma linha catorze vezes.
   */
  sharedImageId?: string;
}

export interface LegacyMapAssetsInput {
  assets: Array<{ period: string; imageId: string }>;
}

/**
 * Os assets que desenham o mapa deste índice legado hoje.
 *
 * Diferente das estatísticas, que vêm do Contentful, o mapa de um legado sempre
 * vem do Earth Engine: `imageData.years[período].imageId` é o que
 * `/api/ee` entrega ao Earth Engine para gerar o tile.
 *
 * @example
 * readLegacyMapAssets(imageData).rows[0]; // { period: "2001", imageId: "projects/ee-oca/assets/deg_2001" }
 */
export function readLegacyMapAssets(
  imageData: CompactTerritorialAnalysisDataset,
): LegacyMapAssets {
  const rows = Object.entries(imageData.years).map(([period, entry]) => ({
    period,
    // Uma coropleta municipal não tem asset; a tela de assets de mapa mostra a
    // linha vazia em vez de sumir com o período.
    imageId: entry.imageId ?? "",
    ...(entry.year ? { year: entry.year } : {}),
  }));
  const first = rows[0]?.imageId;
  const shared =
    rows.length > 1 && first && rows.every((row) => row.imageId === first);

  return { rows, ...(shared ? { sharedImageId: first } : {}) };
}

/**
 * Um id de asset do Earth Engine, e não um caminho qualquer.
 *
 * A validação é deliberadamente frouxa quanto ao conteúdo: convivem aqui assets
 * do projeto (`projects/ee-ocaufcg/assets/IA_1961_1990`) e coleções públicas
 * (`MODIS/061/MOD17A3HGF/2001_01_01`), e inventar um formato canônico recusaria
 * um dos dois. O que ela pega são os erros de digitação que o Earth Engine só
 * reportaria como um mapa em branco: espaço no meio, barra sobrando, URL colada
 * do navegador.
 */
function parseImageId(value: unknown, period: string): string {
  const imageId = typeof value === "string" ? value.trim() : "";

  if (!imageId) {
    throw new Error(
      `O asset do período ${period} não pode ficar vazio: sem ele o mapa desse período não tem o que desenhar.`,
    );
  }
  if (/\s/u.test(imageId)) {
    throw new Error(
      `O asset do período ${period} não pode ter espaços; recebido "${imageId}".`,
    );
  }
  if (imageId.includes("://")) {
    throw new Error(
      `O asset do período ${period} deve ser o id do Earth Engine (por exemplo projects/ee-ocaufcg/assets/IA_1961_1990), e não um endereço da web; recebido "${imageId}".`,
    );
  }
  if (
    imageId.startsWith("/") ||
    imageId.endsWith("/") ||
    imageId.includes("//")
  ) {
    throw new Error(
      `O asset do período ${period} tem barra sobrando; recebido "${imageId}".`,
    );
  }

  return imageId;
}

/**
 * Valida o corpo enviado pela tela.
 *
 * Pela mesma razão da aparência, o corpo carrega só os pares período/asset e
 * nunca o `imageData` inteiro: os valores territoriais do índice moram no mesmo
 * campo e não podem trafegar pelo navegador nem voltar corrompidos.
 *
 * @example
 * parseLegacyMapAssetsInput({ assets: [{ period: "2001", imageId: "projects/ee-oca/assets/deg_2001" }] });
 */
export function parseLegacyMapAssetsInput(raw: unknown): LegacyMapAssetsInput {
  const body = (raw ?? {}) as Record<string, unknown>;
  const assets = body.assets;

  if (!Array.isArray(assets) || assets.length === 0) {
    throw new Error(
      `assets deve ser uma lista não vazia de {period, imageId}; recebido ${JSON.stringify(assets)}.`,
    );
  }

  return {
    assets: assets.map((entry, index) => {
      const row = entry as { period?: unknown; imageId?: unknown } | null;
      const period = typeof row?.period === "string" ? row.period.trim() : "";

      if (!period) {
        throw new Error(
          `assets[${index}].period deve ser a chave do período; recebido ${JSON.stringify(entry)}.`,
        );
      }

      return { period, imageId: parseImageId(row?.imageId, period) };
    }),
  };
}

/**
 * O catálogo troca o asset de um período, nunca cria nem remove período.
 *
 * Um período novo apareceria no mapa sem número nenhum no painel de análise: as
 * estatísticas de um legado vêm das partições `municipalAnalysis` da pipeline
 * de CSV, que esta tela não escreve. E remover um período apagaria os valores
 * gravados junto dele, que não têm outra cópia no Contentful.
 */
function assertSamePeriods(current: string[], next: string[]) {
  const missing = current.filter((period) => !next.includes(period));
  const unknown = next.filter((period) => !current.includes(period));

  if (missing.length > 0 || unknown.length > 0) {
    throw new Error(
      `A edição tem de enviar exatamente os períodos que o índice já tem. Faltaram [${missing.join(", ")}] e vieram períodos desconhecidos [${unknown.join(", ")}].`,
    );
  }
}

/**
 * Recusa uma troca que mudaria o tempo de previsão do período.
 *
 * Nos índices de previsão sem `leadTime` gravado, esse número é lido do fim do
 * nome do asset (`..._01`). Trocar o asset por um de sufixo diferente moveria o
 * período de "previsão para o mês seguinte" para outro horizonte sem que a tela
 * dissesse nada.
 */
function assertForecastLeadTimeKept(
  before: CompactTerritorialAnalysisDataset,
  after: CompactTerritorialAnalysisDataset,
) {
  for (const [period, entry] of Object.entries(after.years)) {
    const previous = before.years[period];
    if (previous.leadTime != null) continue;

    const previousLead = getLegacyForecastLeadTime(previous.imageId ?? "");
    if (previousLead === undefined) continue;
    if (getLegacyForecastLeadTime(entry.imageId ?? "") === previousLead)
      continue;

    throw new Error(
      `O período ${period} tira o tempo de previsão do fim do nome do asset ("${previous.imageId}" vale ${previousLead}), e "${entry.imageId}" mudaria esse número. Mantenha o mesmo sufixo _0N ou grave o leadTime na entry antes de trocar.`,
    );
  }
}

function withoutMapAssets(imageData: CompactTerritorialAnalysisDataset) {
  const clone = structuredClone(imageData) as unknown as Record<
    string,
    unknown
  >;
  clone.years = Object.fromEntries(
    Object.entries(imageData.years).map(([period, entry]) => {
      const rest = { ...entry } as Record<string, unknown>;
      delete rest.imageId;
      return [period, rest];
    }),
  );

  return clone;
}

/**
 * Confere que a edição mexeu apenas nos ids dos assets.
 *
 * Existe pela mesma razão da conferência de aparência: gravar o `imageData` de
 * um legado reescreve o campo que também guarda os valores territoriais dele,
 * sem outra cópia no Contentful. Um erro aqui não é uma tela errada, é um dado
 * perdido.
 */
export function assertOnlyMapAssetsChanged(
  before: CompactTerritorialAnalysisDataset,
  after: CompactTerritorialAnalysisDataset,
) {
  if (
    canonicalJson(withoutMapAssets(before)) ===
    canonicalJson(withoutMapAssets(after))
  ) {
    return;
  }

  throw new Error(
    "A troca de assets mudaria algo além do id do asset de cada período, e por isso não foi gravada.",
  );
}

/**
 * Aplica os assets novos ao `imageData` gravado, por cópia do objeto original.
 *
 * @example
 * applyLegacyMapAssets(imageData, { assets: [{ period: "2001", imageId: "projects/ee-oca/assets/deg_2001_v5" }] });
 */
export function applyLegacyMapAssets(
  imageData: CompactTerritorialAnalysisDataset,
  input: LegacyMapAssetsInput,
): CompactTerritorialAnalysisDataset {
  assertSamePeriods(
    Object.keys(imageData.years),
    input.assets.map((asset) => asset.period),
  );

  const next = structuredClone(imageData);
  for (const asset of input.assets) {
    next.years[asset.period].imageId = asset.imageId;
  }
  assertForecastLeadTimeKept(imageData, next);
  assertOnlyMapAssetsChanged(imageData, next);

  return next;
}

/**
 * Resumo da alteração para o registro de auditoria e para a mensagem da tela.
 *
 * @example
 * summarizeLegacyMapAssetsChange(before, after); // "o asset de 2 períodos"
 */
export function summarizeLegacyMapAssetsChange(
  before: CompactTerritorialAnalysisDataset,
  after: CompactTerritorialAnalysisDataset,
): string {
  const changed = Object.entries(after.years).filter(
    ([period, entry]) => before.years[period]?.imageId !== entry.imageId,
  );

  if (changed.length === 0) return "nada";
  if (changed.length === 1) return `o asset do período ${changed[0][0]}`;
  return `o asset de ${changed.length} períodos`;
}
