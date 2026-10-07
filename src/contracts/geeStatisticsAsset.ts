/**
 * O que as duas formas de fonte estatística compartilham: como o asset do Earth
 * Engine é endereçado e como um período vira um endereço concreto.
 *
 * Mora num módulo próprio porque `geeStatistics.ts` (distribuição por classes) e
 * `geeMunicipalValueTable.ts` (valor único por município) precisam dos mesmos
 * validadores, e um importar o outro fecharia um ciclo.
 */

export type GeeStatisticsPeriodGranularity = "year" | "month";

export type GeeStatisticsAssetSource =
  | {
      type: "fixed";
      assetId: string;
    }
  | {
      type: "period-template";
      assetIdTemplate: string;
    };

export const MONTH_PERIOD_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/u;
export const YEAR_PERIOD_PATTERN = /^\d{4}$/u;
export const PERIOD_PLACEHOLDER_PATTERN = /\{(?:year|month|period)\}/u;

const ASSET_ID_PATTERN = /^[A-Za-z0-9_./{}-]{3,300}$/u;

export function isGeeStatisticsRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Texto obrigatório de uma configuração estatística, com as regras que valem
 * para nome de coluna e para endereço de asset.
 *
 * requiredGeeStatisticsProperty("CD_MUN", "Propriedade de município"); // "CD_MUN"
 */
export function requiredGeeStatisticsProperty(
  value: unknown,
  label: string,
  options: { asset?: boolean; allowTemplate?: boolean } = {},
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} é obrigatório.`);
  }

  const normalized = value.trim();
  if (
    normalized.length > 300 ||
    (options.asset && !ASSET_ID_PATTERN.test(normalized))
  ) {
    throw new Error(`${label} é inválido.`);
  }
  if (!options.allowTemplate && /[{}]/u.test(normalized)) {
    throw new Error(`${label} não pode conter placeholders.`);
  }

  return normalized;
}

export function parseGeeStatisticsAssetSource(
  value: unknown,
  periodGranularity: GeeStatisticsPeriodGranularity,
): GeeStatisticsAssetSource {
  if (!isGeeStatisticsRecord(value)) {
    throw new Error("A configuração da fonte estatística está incompleta.");
  }

  if (value.type === "fixed") {
    return {
      type: "fixed",
      assetId: requiredGeeStatisticsProperty(
        value.assetId,
        "Asset estatístico",
        {
          asset: true,
        },
      ),
    };
  }

  if (value.type !== "period-template") {
    throw new Error("A estratégia da fonte estatística é inválida.");
  }

  const assetIdTemplate = requiredGeeStatisticsProperty(
    value.assetIdTemplate,
    "Template do asset estatístico",
    { asset: true, allowTemplate: true },
  );
  if (!PERIOD_PLACEHOLDER_PATTERN.test(assetIdTemplate)) {
    throw new Error(
      "O template estatístico deve conter {year}, {month} ou {period}.",
    );
  }
  if (assetIdTemplate.includes("{month}") && periodGranularity !== "month") {
    throw new Error("O placeholder {month} exige granularidade mensal.");
  }

  return { type: "period-template", assetIdTemplate };
}

export function assertGeeStatisticsPeriod(
  periodKey: string,
  periodGranularity: GeeStatisticsPeriodGranularity,
): void {
  const isValidPeriod =
    periodGranularity === "month"
      ? MONTH_PERIOD_PATTERN.test(periodKey)
      : YEAR_PERIOD_PATTERN.test(periodKey);

  if (!isValidPeriod) {
    throw new Error(
      `Período ${periodKey} incompatível com granularidade ${periodGranularity} do asset estatístico.`,
    );
  }
}

/**
 * Troca `{year}`, `{month}` e `{period}` pelo período pedido.
 *
 * Serve tanto para o endereço do asset quanto para o nome da coluna de valor de
 * uma tabela larga, em que cada período é uma coluna (`2024`, `2025`, ...).
 *
 * expandGeeStatisticsPeriodTemplate("estat_{year}", "2025-03", "month", {
 *   templateLabel: "Template de asset",
 *   invalidMessage: "Configuração de asset estatístico inválida",
 * }); // "estat_2025"
 */
export function expandGeeStatisticsPeriodTemplate(
  template: string,
  periodKey: string,
  periodGranularity: GeeStatisticsPeriodGranularity,
  messages: { templateLabel: string; invalidMessage: string },
): string {
  const month = periodGranularity === "month" ? periodKey.slice(5, 7) : null;
  if (template.includes("{month}") && !month) {
    throw new Error(
      `${messages.templateLabel} com {month} exige uma fonte de granularidade mensal.`,
    );
  }

  const expanded = template
    .replaceAll("{period}", periodKey)
    .replaceAll("{year}", periodKey.slice(0, 4))
    .replaceAll("{month}", month ?? "");

  if (!expanded.trim() || /\{[^}]+\}/u.test(expanded)) {
    throw new Error(`${messages.invalidMessage}: ${expanded}.`);
  }

  return expanded;
}

export function resolveGeeStatisticsAssetId(
  asset: GeeStatisticsAssetSource,
  periodKey: string,
  periodGranularity: GeeStatisticsPeriodGranularity,
): string {
  return asset.type === "fixed"
    ? asset.assetId
    : expandGeeStatisticsPeriodTemplate(
        asset.assetIdTemplate,
        periodKey,
        periodGranularity,
        {
          templateLabel: "Template de asset",
          invalidMessage: "Configuração de asset estatístico inválida",
        },
      );
}
